-- ============================================================================
-- CizaImmo — MODULE ADMIN (extension v1.2) : rôles plateforme Super Admin /
-- Admin, suspension de comptes, rattachements de gestionnaires, journal
-- d'audit et avis aux comptes.
-- À exécuter UNE FOIS dans le SQL Editor de Supabase, APRÈS
-- supabase/schema.sql, supabase/storage.sql et supabase/module5.sql.
-- Idempotent (if not exists / drop policy if exists / do blocks).
-- Référence : docs/admin-finance-v1.2.md (décisions verrouillées du
-- fondateur, schéma « Admin / Super Admin » v2).
--
-- RÈGLE DURE (inchangée) : CizaImmo n'encaisse JAMAIS les loyers — pour
-- aucun rôle, Super Admin compris. Ce module ne crée aucune capacité
-- d'encaissement ; il ajoute l'administration de la plateforme.
--
-- Après exécution, promouvoir le compte du fondateur :
--   update public.profils set role = 'super_admin'
--   where email = '<e-mail du fondateur>';
-- ============================================================================

-- --- 1. Rôles plateforme sur profils -----------------------------------------
-- Le CHECK d'origine limite role à proprietaire/gestionnaire/coproprietaire.
-- On le remplace par la liste complète (contrainte nommée par Postgres
-- « profils_role_check » pour un CHECK en ligne ; le bloc DO couvre aussi
-- le cas où elle porterait un autre nom généré).
do $$
declare
  v_nom text;
begin
  select conname into v_nom
    from pg_constraint
   where conrelid = 'public.profils'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%role%proprietaire%';
  if v_nom is not null then
    execute format('alter table public.profils drop constraint %I', v_nom);
  end if;
end $$;
alter table public.profils
  add constraint profils_role_check
  check (role in ('proprietaire', 'gestionnaire', 'coproprietaire', 'admin', 'super_admin'));

-- Suspension de compte : accès bloqué à la connexion, données conservées.
alter table public.profils
  add column if not exists suspendu boolean not null default false;
alter table public.profils
  add column if not exists suspendu_le timestamptz;

-- --- 2. Suspension sur abonnements -------------------------------------------
alter table public.abonnements
  add column if not exists statut_pre_suspension text
    check (statut_pre_suspension is null or statut_pre_suspension in ('essai', 'actif', 'lecture_seule', 'annule'));
do $$
declare
  v_nom text;
begin
  select conname into v_nom
    from pg_constraint
   where conrelid = 'public.abonnements'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%statut%essai%actif%';
  if v_nom is not null then
    execute format('alter table public.abonnements drop constraint %I', v_nom);
  end if;
end $$;
alter table public.abonnements
  add constraint abonnements_statut_check
  check (statut in ('en_attente', 'essai', 'actif', 'lecture_seule', 'annule', 'suspendu'));
-- NB : l'index unique partiel idx_abonnements_un_actif (statut essai/actif)
-- est inchangé : un abonnement suspendu ne bloque pas sa propre réactivation
-- (le statut antérieur est restauré depuis statut_pre_suspension) et aucun
-- nouvel abonnement ne peut naître pendant la suspension (accès bloqué).

-- --- 3. Helpers RLS : rôle plateforme de l'utilisateur courant ----------------
create or replace function public.est_admin_plateforme()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profils p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and not p.suspendu
  );
$$;

create or replace function public.est_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profils p
    where p.id = auth.uid() and p.role = 'super_admin' and not p.suspendu
  );
$$;

-- --- 4. Rattachements de gestionnaires (multi-contextes) ----------------------
-- Un gestionnaire peut être rattaché à Ciza Group (contexte 'cizagroup',
-- proprietaire_id NULL) ET à des propriétaires clients (contexte
-- 'proprietaire'), en parallèle. Contextes strictement séparés :
-- immeuble_ids = les immeubles assignés DANS ce contexte.
create table if not exists public.rattachements_gestionnaires (
  id uuid primary key default gen_random_uuid(),
  gestionnaire_id uuid not null references public.profils (id) on delete cascade,
  contexte text not null check (contexte in ('cizagroup', 'proprietaire')),
  proprietaire_id uuid references public.profils (id) on delete cascade,
  immeuble_ids uuid[] not null default '{}',
  statut text not null default 'actif' check (statut in ('actif', 'suspendu')),
  created_at timestamptz not null default now(),
  constraint rattachement_contexte_coherent check (
    (contexte = 'cizagroup' and proprietaire_id is null)
    or (contexte = 'proprietaire' and proprietaire_id is not null)
  )
);
-- Un seul rattachement Ciza Group par gestionnaire (proprietaire_id est
-- NULL : un UNIQUE classique ne s'appliquerait pas aux NULL).
create unique index if not exists idx_rattachement_cizagroup_unique
  on public.rattachements_gestionnaires (gestionnaire_id)
  where contexte = 'cizagroup';
-- Un seul rattachement par couple (gestionnaire, propriétaire).
create unique index if not exists idx_rattachement_proprietaire_unique
  on public.rattachements_gestionnaires (gestionnaire_id, proprietaire_id)
  where contexte = 'proprietaire';
create index if not exists idx_rattachements_gestionnaire
  on public.rattachements_gestionnaires (gestionnaire_id, statut);

-- --- 5. Journal d'audit --------------------------------------------------------
-- Tout accès / toute action Admin et Super Admin : qui, quand, quel
-- compte, quelle action. Écrit par l'application (acteur = session).
create table if not exists public.journal_audit (
  id uuid primary key default gen_random_uuid(),
  acteur_id uuid not null references public.profils (id) on delete cascade,
  acteur_email text not null,
  acteur_role text not null
    check (acteur_role in ('admin', 'super_admin')),
  action text not null,
  cible_type text not null
    check (cible_type in ('compte', 'admin', 'tarif', 'parametre', 'gestionnaire', 'plateforme')),
  cible_id text,
  cible_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_journal_audit_created
  on public.journal_audit (created_at desc);
create index if not exists idx_journal_audit_cible
  on public.journal_audit (cible_type, cible_id);

-- --- 6. Avis aux comptes (modèles prédéfinis uniquement) -----------------------
-- Modèles : retard_paiement, fin_essai, compte_suspendu, compte_reactive.
-- Variables autorisées : {nom}, {plan}, {date} (dans variables jsonb).
-- Aucun texte libre : sujet et corps sont rendus depuis le modèle par
-- l'application (lib/avis.ts) et conservés ici comme preuve d'envoi.
create table if not exists public.avis (
  id uuid primary key default gen_random_uuid(),
  modele text not null
    check (modele in ('retard_paiement', 'fin_essai', 'compte_suspendu', 'compte_reactive', 'inscription_refusee')),
  destinataire_id uuid not null references public.profils (id) on delete cascade,
  destinataire_email text not null,
  variables jsonb not null default '{}'::jsonb,
  sujet text not null,
  corps text not null,
  envoye_par uuid not null references public.profils (id) on delete cascade,
  envoye_par_role text not null check (envoye_par_role in ('admin', 'super_admin')),
  statut_envoi text not null default 'non_configuré'
    check (statut_envoi in ('envoye', 'non_configuré', 'echec')),
  created_at timestamptz not null default now()
);
create index if not exists idx_avis_destinataire
  on public.avis (destinataire_id, created_at desc);

-- --- 7. RLS ---------------------------------------------------------------------
alter table public.rattachements_gestionnaires enable row level security;
alter table public.journal_audit enable row level security;
alter table public.avis enable row level security;

-- profils : la plateforme lit tous les profils (console) ; le Super Admin
-- gère les rôles ; Admin / Super Admin gèrent la suspension. Les politiques
-- d'origine (chacun son profil) restent en place et se cumulent (OR).
drop policy if exists profils_select_plateforme on public.profils;
create policy profils_select_plateforme on public.profils
  for select using (public.est_admin_plateforme());
drop policy if exists profils_update_suspension_plateforme on public.profils;
create policy profils_update_suspension_plateforme on public.profils
  for update using (public.est_admin_plateforme())
  with check (public.est_admin_plateforme());
drop policy if exists profils_update_role_super_admin on public.profils;
create policy profils_update_role_super_admin on public.profils
  for update using (public.est_super_admin())
  with check (public.est_super_admin());

-- abonnements : lecture plateforme (suivi des comptes et des retards) ;
-- mise à jour de la suspension par la plateforme.
drop policy if exists abonnements_select_plateforme on public.abonnements;
create policy abonnements_select_plateforme on public.abonnements
  for select using (public.est_admin_plateforme());
drop policy if exists abonnements_update_suspension_plateforme on public.abonnements;
create policy abonnements_update_suspension_plateforme on public.abonnements
  for update using (public.est_admin_plateforme())
  with check (public.est_admin_plateforme());

-- rattachements : le gestionnaire voit les siens ; la plateforme voit et
-- gère tout ; le propriétaire voit les rattachements vers son compte.
drop policy if exists rattachements_select on public.rattachements_gestionnaires;
create policy rattachements_select on public.rattachements_gestionnaires
  for select using (
    gestionnaire_id = auth.uid()
    or proprietaire_id = auth.uid()
    or public.est_admin_plateforme()
  );
drop policy if exists rattachements_write_plateforme on public.rattachements_gestionnaires;
create policy rattachements_write_plateforme on public.rattachements_gestionnaires
  for all using (public.est_admin_plateforme())
  with check (public.est_admin_plateforme());

-- journal d'audit : chacun n'écrit que ses propres entrées (acteur =
-- session) ; lecture réservée à la plateforme. Aucune modification ni
-- suppression (pas de politique update/delete : journal append-only).
drop policy if exists journal_audit_insert_acteur on public.journal_audit;
create policy journal_audit_insert_acteur on public.journal_audit
  for insert with check (acteur_id = auth.uid() and public.est_admin_plateforme());
drop policy if exists journal_audit_select_plateforme on public.journal_audit;
create policy journal_audit_select_plateforme on public.journal_audit
  for select using (public.est_admin_plateforme());

-- avis : envoi et lecture réservés à la plateforme.
drop policy if exists avis_plateforme on public.avis;
create policy avis_plateforme on public.avis
  for all using (public.est_admin_plateforme())
  with check (public.est_admin_plateforme());

-- ---------------------------------------------------------------------------
-- Supervision (lecture seule) : la plateforme peut LIRE les immeubles,
-- appartements, locataires et baux pour ouvrir le tableau d'un
-- gestionnaire rattaché. Aucune écriture plateforme sur le parc des
-- clients (les politiques d'écriture existantes restent inchangées).
-- ---------------------------------------------------------------------------
drop policy if exists immeubles_select_plateforme on public.immeubles;
create policy immeubles_select_plateforme on public.immeubles
  for select using (public.est_admin_plateforme());
drop policy if exists appartements_select_plateforme on public.appartements;
create policy appartements_select_plateforme on public.appartements
  for select using (public.est_admin_plateforme());
drop policy if exists locataires_select_plateforme on public.locataires;
create policy locataires_select_plateforme on public.locataires
  for select using (public.est_admin_plateforme());
drop policy if exists baux_select_plateforme on public.baux;
create policy baux_select_plateforme on public.baux
  for select using (public.est_admin_plateforme());

-- ---------------------------------------------------------------------------
-- Suppression DÉFINITIVE d'un compte client — Super Admin UNIQUEMENT.
-- La suppression du profil seul ne fermerait pas la connexion : on
-- supprime l'utilisateur Auth, et la cascade (profils.id → auth.users
-- ON DELETE CASCADE, puis les tables owner_id → profils) emporte le
-- reste. Fonction SECURITY DEFINER avec contrôle de rôle INTERNE :
-- même appelée directement, elle refuse tout acteur non super_admin.
-- L'appel est journalisé par l'application AVANT l'appel (la ligne
-- d'audit survit à la suppression de la cible).
-- ---------------------------------------------------------------------------
create or replace function public.supprimer_compte_definitivement(cible uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.est_super_admin() then
    raise exception 'SUPER_ADMIN_REQUIS';
  end if;
  if cible = auth.uid() then
    raise exception 'AUTO_SUPPRESSION_INTERDITE';
  end if;
  delete from auth.users where id = cible;
end;
$$;
revoke all on function public.supprimer_compte_definitivement(uuid) from public;
grant execute on function public.supprimer_compte_definitivement(uuid) to authenticated;

-- ===========================================================================
-- ANTI-FRAUDE TARIFAIRE — signaux d'attribution de la grille.
-- (a) pays déclaré au formulaire, (b) code pays de l'IP à l'inscription
-- (en-tête x-vercel-ip-country — JAMAIS l'adresse IP brute), (c) code
-- pays du premier moyen de paiement. La matrice vit dans lib/grille.ts ;
-- la grille attribuée est VERROUILLÉE (réattribution console uniquement,
-- journalisée). Voir docs/admin-finance-v1.2.md.
-- ===========================================================================
alter table public.profils
  add column if not exists pays_declare text,
  add column if not exists pays_ip text,
  add column if not exists pays_paiement text,
  add column if not exists grille_attribuee text
    check (grille_attribuee in ('afrique', 'internationale')),
  add column if not exists grille_statut text not null default 'ok'
    check (grille_statut in ('ok', 'a_verifier'));

-- Inscription : le trigger consomme l'attribution calculée par
-- l'application (métadonnées grille_attribuee / grille_statut / pays_ip)
-- et la durée d'essai DYNAMIQUE (parametres_finance.jours_essai).
-- Repli historique par nom de pays si les métadonnées sont absentes
-- (anciens clients du formulaire) — jamais de blocage d'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text := coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1));
  v_pays text := new.raw_user_meta_data ->> 'pays';
  v_devise text := coalesce(new.raw_user_meta_data ->> 'devise_principale', 'USD');
  v_langue text := coalesce(new.raw_user_meta_data ->> 'langue', 'fr');
  v_pays_ip text := new.raw_user_meta_data ->> 'pays_ip';
  v_grille text := new.raw_user_meta_data ->> 'grille_attribuee';
  v_grille_statut text := coalesce(new.raw_user_meta_data ->> 'grille_statut', 'ok');
begin
  if v_grille is null or v_grille not in ('afrique', 'internationale') then
    v_grille := case
      when v_pays in ('Burundi','Rwanda','République démocratique du Congo','Congo','Kenya','Tanzanie','Ouganda','Cameroun','Sénégal','Côte d''Ivoire','Mali','Burkina Faso','Bénin','Togo','Gabon','Tchad','Niger','Guinée','Madagascar','Éthiopie','Ghana','Nigeria','Angola','Zambie','Zimbabwe','Mozambique','Afrique du Sud','Maroc','Algérie','Tunisie','Égypte')
      then 'afrique' else 'internationale' end;
  end if;
  if v_grille_statut not in ('ok', 'a_verifier') then v_grille_statut := 'ok'; end if;

  insert into public.profils (id, nom, email, pays, langue, devise_principale, role, pays_declare, pays_ip, grille_attribuee, grille_statut)
  values (new.id, v_nom, new.email, v_pays, v_langue, v_devise, 'proprietaire', v_pays, v_pays_ip, v_grille, v_grille_statut)
  on conflict (id) do nothing;

  -- APPROBATION MANUELLE (ajout n°3) : l'abonnement naît « en_attente »,
  -- SANS dates d'essai. L'essai (jours_essai, paramètre dynamique) ne
  -- démarrera qu'à l'approbation par un Admin / Super Admin (console).
  insert into public.abonnements (owner_id, plan, grille, statut, debut_periode, fin_periode, trial_ends_at)
  values (new.id, 'pro', v_grille, 'en_attente', now(), null, null)
  on conflict do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approbation manuelle (ajout n°3) : motif de refus prédéfini, stocké sur
-- le profil (la connexion d'un compte refusé est bloquée avec un message
-- propre). Motifs : informations_insuffisantes, pays_non_desservi,
-- doublon, autre — aucun texte libre.
-- ---------------------------------------------------------------------------
alter table public.profils
  add column if not exists motif_refus text
    check (motif_refus in ('informations_insuffisantes', 'pays_non_desservi', 'doublon', 'autre'));

-- ---------------------------------------------------------------------------
-- BOOTSTRAP SUPER ADMIN (procédure, à exécuter UNE FOIS à la main) :
-- le fondateur s'inscrit normalement (son compte passe « en attente »
-- comme les autres), puis on le promeut directement en base — il ne
-- passe évidemment PAS par la file d'approbation :
--
--   update public.profils set role = 'super_admin'
--   where email = '<e-mail du fondateur>';
--   update public.abonnements set statut = 'essai',
--     debut_periode = now(), trial_ends_at = now() + interval '30 days',
--     fin_periode = now() + interval '30 days'
--   where owner_id = (select id from public.profils
--                     where email = '<e-mail du fondateur>');
--
-- (Même procédure pour promouvoir un employé en 'admin' si besoin,
--  hors console.) Documenté dans docs/admin-finance-v1.2.md §7.
-- ---------------------------------------------------------------------------
