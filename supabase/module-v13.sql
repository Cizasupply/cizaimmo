-- ============================================================================
-- CizaImmo — Module v1.3 : parcours d'inscription et dossiers vérifiés.
-- Voir docs/parcours-inscription-v1.3.md.
--
-- À appliquer APRÈS schema.sql, storage.sql, module5.sql,
-- module-admin.sql et module-finance.sql. IDEMPOTENT : réexécutable
-- sans danger (add column if not exists, create or replace, drop
-- policy if exists).
--
-- Contenu :
--  1. profils : Display ID « CIM-000001 » (séquence dédiée + backfill),
--     téléphone (si absent), intention déclarée, photo de profil,
--     statut du contrat gestionnaire.
--  2. documents : entite_type « compte » + type « contrat » (dossier).
--  3. demandes_rattachement : triple validation (propriétaire →
--     gestionnaire → Admin) + RLS.
--  4. RLS documents : lecture plateforme (console Dossier) — les
--     documents « compte » restent limités au titulaire + plateforme.
--  5. handle_new_user : génère le Display ID et stocke téléphone +
--     intention depuis les métadonnées d'inscription.
-- ============================================================================

-- --- 1. profils : colonnes v1.3 ---------------------------------------------
create sequence if not exists public.display_id_seq;

alter table public.profils
  add column if not exists display_id text,
  add column if not exists telephone text,
  add column if not exists type_intention text not null default 'proprietaire',
  add column if not exists photo_profil_path text,
  add column if not exists statut_contrat text not null default 'sans_objet';

-- Contraintes (posées une fois ; drop if exists pour l'idempotence).
alter table public.profils drop constraint if exists profils_type_intention_check;
alter table public.profils
  add constraint profils_type_intention_check
  check (type_intention in ('proprietaire', 'gestionnaire'));

alter table public.profils drop constraint if exists profils_statut_contrat_check;
alter table public.profils
  add constraint profils_statut_contrat_check
  check (statut_contrat in ('sans_objet', 'a_signer', 'signe_recu', 'valide'));

-- Unicité du Display ID (les NULL restent permis pour les anciens
-- comptes non migrés ; le backfill ci-dessous les remplit tous).
create unique index if not exists idx_profils_display_id
  on public.profils (display_id)
  where display_id is not null;

-- Backfill : les comptes EXISTANTS reçoivent leur Display ID par ordre
-- de création (created_at, puis id pour départager), en continuant la
-- séquence. Ne touche jamais un Display ID déjà posé (immuable).
do $$
declare
  r record;
  v_num bigint;
begin
  for r in
    select id from public.profils
    where display_id is null
    order by created_at asc, id asc
  loop
    v_num := nextval('public.display_id_seq');
    update public.profils
      set display_id = 'CIM-' || lpad(v_num::text, 6, '0')
      where id = r.id;
  end loop;
end $$;

-- --- 2. documents : dossier de compte ---------------------------------------
-- Les CHECK d'origine sont en ligne (noms automatiques Postgres) : on
-- les remplace par des contraintes nommées aux listes ÉLARGIES —
-- entite_type « compte » (pièce d'identité + contrat du dossier) et
-- type « contrat ». La preuve de propriété reste un document
-- « justificatif » rattaché à l'immeuble (entite_type « immeuble »).
alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents drop constraint if exists documents_type_check_v13;
alter table public.documents
  add constraint documents_type_check_v13
  check (type in ('bail', 'piece_identite', 'justificatif', 'facture', 'contrat', 'autre'));

alter table public.documents drop constraint if exists documents_entite_type_check;
alter table public.documents drop constraint if exists documents_entite_type_check_v13;
alter table public.documents
  add constraint documents_entite_type_check_v13
  check (entite_type in ('immeuble', 'appartement', 'locataire', 'bail', 'depense', 'compte'));

-- --- 3. demandes_rattachement ------------------------------------------------
-- Le flux existant (rattachements_gestionnaires) ne couvre PAS la
-- demande : il naît actif. Cette table porte la demande et ses trois
-- validations ; le rattachement n'est créé qu'à la validation Admin.
create table if not exists public.demandes_rattachement (
  id uuid primary key default gen_random_uuid(),
  proprietaire_id uuid not null references public.profils (id) on delete cascade,
  gestionnaire_id uuid not null references public.profils (id) on delete cascade,
  gestionnaire_display_id text not null,
  statut text not null default 'en_attente_gestionnaire'
    check (statut in ('en_attente_gestionnaire', 'en_attente_admin', 'actif', 'refuse')),
  created_at timestamptz not null default now(),
  -- Étape gestionnaire (acceptation / refus).
  repondu_le timestamptz,
  -- Étape Admin (validation / refus) : acteur plateforme + date.
  valide_par uuid references public.profils (id) on delete set null,
  valide_le timestamptz,
  -- Rattachement créé à la validation Admin (immeuble_ids vide au départ).
  rattachement_id uuid references public.rattachements_gestionnaires (id) on delete set null
);
create index if not exists idx_demandes_rattachement_gestionnaire
  on public.demandes_rattachement (gestionnaire_id, statut);
create index if not exists idx_demandes_rattachement_proprietaire
  on public.demandes_rattachement (proprietaire_id, statut);

alter table public.demandes_rattachement enable row level security;

-- Les deux parties voient et font avancer LEUR demande ; la plateforme
-- voit tout et tranche à l'étape Admin. L'ordre des étapes est gardé
-- par l'application (le provider), la RLS borne les personnes.
drop policy if exists demandes_rattachement_parties on public.demandes_rattachement;
create policy demandes_rattachement_parties on public.demandes_rattachement
  for all
  using (proprietaire_id = auth.uid() or gestionnaire_id = auth.uid())
  with check (proprietaire_id = auth.uid() or gestionnaire_id = auth.uid());

drop policy if exists demandes_rattachement_plateforme on public.demandes_rattachement;
create policy demandes_rattachement_plateforme on public.demandes_rattachement
  for all
  using (public.est_admin_plateforme())
  with check (public.est_admin_plateforme());

-- --- 4. RLS documents : lecture plateforme (page Dossier) --------------------
-- Rappel des politiques d'origine (schema.sql) : documents_select
-- n'autorise QUE le titulaire (owner_id = auth.uid()) et la visibilité
-- via un immeuble (appartement/immeuble) — un document « compte »
-- (entite_id = le compte, pas un immeuble) n'entre dans AUCUNE branche
-- « immeuble » : il reste donc lisible par son seul titulaire, plus la
-- plateforme via la politique ci-dessous (console, page Dossier).
drop policy if exists documents_select_plateforme on public.documents;
create policy documents_select_plateforme on public.documents
  for select using (public.est_admin_plateforme());

-- --- 5. Recherche par Display ID + visibilité entre contreparties ------------
-- Un propriétaire ne peut pas lire le profil d'un autre compte (RLS
-- d'origine : chacun le sien + la plateforme). Deux mécanismes bornés :
-- (a) une RPC security definer qui ne retourne QUE l'id technique, le
--     nom et le Display ID d'un compte à intention « gestionnaire » —
--     l'écran de confirmation n'affiche que le nom ;
-- (b) une politique de lecture du profil de sa CONTREPARTIE quand une
--     demande ou un rattachement relie les deux comptes (pour afficher
--     nom/e-mail dans les listes de demandes et de rattachements).
create or replace function public.rechercher_gestionnaire_par_display_id(p_display_id text)
returns table (id uuid, nom text, display_id text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.nom, p.display_id
  from public.profils p
  where upper(p.display_id) = upper(p_display_id)
    and p.type_intention = 'gestionnaire'
  limit 1;
$$;
revoke all on function public.rechercher_gestionnaire_par_display_id(text) from public;
grant execute on function public.rechercher_gestionnaire_par_display_id(text) to authenticated;

drop policy if exists profils_select_contrepartie on public.profils;
create policy profils_select_contrepartie on public.profils
  for select using (
    exists (
      select 1 from public.demandes_rattachement d
      where (d.proprietaire_id = auth.uid() and d.gestionnaire_id = profils.id)
         or (d.gestionnaire_id = auth.uid() and d.proprietaire_id = profils.id)
    )
    or exists (
      select 1 from public.rattachements_gestionnaires r
      where (r.proprietaire_id = auth.uid() and r.gestionnaire_id = profils.id)
         or (r.gestionnaire_id = auth.uid() and r.proprietaire_id = profils.id)
    )
  );

-- --- 6. handle_new_user : Display ID + intention + téléphone -----------------
-- Reprend la version module-admin.sql (grille anti-fraude + abonnement
-- « en_attente ») et ajoute : Display ID séquentiel, téléphone et
-- intention depuis raw_user_meta_data. Le rôle technique reste
-- « proprietaire » à l'inscription : l'intention n'est PAS un rôle —
-- elle est validée par l'Admin à l'approbation.
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
  v_telephone text := new.raw_user_meta_data ->> 'telephone';
  v_intention text := coalesce(new.raw_user_meta_data ->> 'intention', 'proprietaire');
  v_display_id text;
begin
  if v_grille is null or v_grille not in ('afrique', 'internationale') then
    v_grille := case
      when v_pays in ('Burundi','Rwanda','République démocratique du Congo','Congo','Kenya','Tanzanie','Ouganda','Cameroun','Sénégal','Côte d''Ivoire','Mali','Burkina Faso','Bénin','Togo','Gabon','Tchad','Niger','Guinée','Madagascar','Éthiopie','Ghana','Nigeria','Angola','Zambie','Zimbabwe','Mozambique','Afrique du Sud','Maroc','Algérie','Tunisie','Égypte')
      then 'afrique' else 'internationale' end;
  end if;
  if v_grille_statut not in ('ok', 'a_verifier') then v_grille_statut := 'ok'; end if;
  if v_intention not in ('proprietaire', 'gestionnaire') then v_intention := 'proprietaire'; end if;

  v_display_id := 'CIM-' || lpad(nextval('public.display_id_seq')::text, 6, '0');

  insert into public.profils (id, nom, email, pays, langue, devise_principale, role, pays_declare, pays_ip, grille_attribuee, grille_statut, display_id, telephone, type_intention, statut_contrat)
  values (new.id, v_nom, new.email, v_pays, v_langue, v_devise, 'proprietaire', v_pays, v_pays_ip, v_grille, v_grille_statut, v_display_id, v_telephone, v_intention, 'sans_objet')
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
