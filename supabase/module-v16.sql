-- ============================================================================
-- CizaImmo — Module v1.6 : Vitrine vérifiée.
-- Voir docs/vitrine-verifiee-v16.md.
--
-- À appliquer APRÈS schema.sql, storage.sql, module5.sql,
-- module-admin.sql, module-finance.sql, module-v13.sql,
-- module-v14.sql et module-v15.sql. IDEMPOTENT : réexécutable
-- sans danger (add column if not exists, create or replace,
-- drop policy if exists, drop constraint if exists pour les
-- contraintes nommées, blocs DO pour les contraintes retrouvées
-- via pg_constraint).
--
-- Décisions du fondateur (2026-11-07) :
--  (1) AUCUNE annonce n'est affichée sur la vitrine publique
--      sans approbation préalable d'un Admin : la publication
--      devient un parcours en 4 statuts (non_publie, en_attente,
--      approuve, refuse) et les politiques publiques anonymes
--      n'exposent que les annonces « approuve ».
--  (2) Badge « ✓ Vérifié » sur les annonces affichées : une
--      annonce visible a été relue et approuvée par la
--      plateforme — l'approbation est tracée (qui, quand) dans
--      vitrine_valide_par / vitrine_valide_le.
--  (3) Règle contact + justification : le contact public d'une
--      annonce est, par défaut, celui du dossier — le
--      gestionnaire rattaché à l'immeuble s'il en existe un,
--      sinon le propriétaire. Tout contact différent est permis
--      UNIQUEMENT avec une justification écrite
--      (contact_justification), sinon la base refuse la demande.
--  (4) Anti-fraude par revalidation automatique : modifier un
--      champ sensible d'une annonce déjà approuvée (loyer,
--      devise, charges, photos, description, visites, contact)
--      la repasse automatiquement en « en_attente » — elle
--      disparaît de la vitrine jusqu'à nouvelle approbation.
-- Principe v1.4 conservé : « c'est la base qui décide, pas le
-- front » — toutes les transitions et tous les refus vivent
-- dans les fonctions, le trigger et les politiques ci-dessous.
-- La garde d'écriture v1.4 (abonnement_permets_ecriture) est
-- RÉUTILISÉE telle quelle : elle n'est ni recréée ni modifiée.
--
-- RÈGLE DURE (inchangée) : CizaImmo n'encaisse JAMAIS les
-- loyers — ce module ne crée aucune capacité d'encaissement.
--
-- Contenu :
--  1. appartements : colonnes vitrine (statut, motif, validation,
--     contact, visites) + migration douce des annonces déjà
--     publiées vers « en_attente ».
--  2. immeubles : quartier.
--  3. journal_audit : cible_type élargi à 'appartement'.
--  4. RPC demander_publication_vitrine.
--  5. RPC valider_publication_vitrine.
--  6. RPC retirer_publication_vitrine.
--  7. Trigger anti-fraude vitrine_revalidation_auto.
--  8. Politiques publiques recréées (annonces approuvées seules).
--  9. Grants des 3 RPC.
-- ============================================================================

-- --- 1. appartements : colonnes de la vitrine vérifiée -----------------------
-- vitrine_statut pilote l'affichage public ; l'ancien booléen
-- « vitrine » reste le drapeau « le propriétaire veut publier »,
-- mais il ne suffit PLUS à afficher : il faut statut 'approuve'
-- (politiques, section 8).
alter table public.appartements
  add column if not exists vitrine_statut text not null default 'non_publie';
alter table public.appartements drop constraint if exists appartements_vitrine_statut_check;
alter table public.appartements
  add constraint appartements_vitrine_statut_check
  check (vitrine_statut in ('non_publie', 'en_attente', 'approuve', 'refuse'));

alter table public.appartements
  add column if not exists vitrine_motif_refus text;
alter table public.appartements
  add column if not exists vitrine_valide_par uuid
    references public.profils (id) on delete set null;
alter table public.appartements
  add column if not exists vitrine_valide_le timestamptz;

-- Caractéristiques affichées sur l'annonce.
alter table public.appartements
  add column if not exists pieces int;
alter table public.appartements drop constraint if exists appartements_pieces_check;
alter table public.appartements
  add constraint appartements_pieces_check
  check (pieces is null or pieces > 0);
alter table public.appartements
  add column if not exists meuble boolean not null default false;
alter table public.appartements
  add column if not exists disponible_le date;

-- Visites : jours libres (ex. '{"samedi","dimanche"}') et
-- créneau en texte libre (le format n'est pas normalisé).
alter table public.appartements
  add column if not exists visite_jours text[] not null default '{}';
alter table public.appartements
  add column if not exists visite_heures text;

-- Contact public de l'annonce : par défaut celui du dossier
-- (gestionnaire rattaché, sinon propriétaire — section 4).
-- contact_justification n'est exigée que si le contact saisi
-- diverge de celui du dossier.
alter table public.appartements
  add column if not exists contact_nom text;
alter table public.appartements
  add column if not exists contact_telephone text;
alter table public.appartements
  add column if not exists contact_email text;
alter table public.appartements
  add column if not exists contact_justification text;

-- Migration douce : les annonces déjà publiées (vitrine = true)
-- n'ont JAMAIS été approuvées sous ce régime — elles repassent
-- en validation. Aucune annonce ne reste affichée sans
-- approbation : les politiques de la section 8 n'exposent que
-- le statut 'approuve'.
update public.appartements
   set vitrine_statut = 'en_attente'
 where vitrine = true
   and vitrine_statut = 'non_publie';

-- --- 2. immeubles : quartier ---------------------------------------------------
-- Affiché sur la carte de l'annonce (localisation publique sans
-- adresse exacte).
alter table public.immeubles
  add column if not exists quartier text;

-- --- 3. journal_audit : cible_type élargi à 'appartement' ----------------------
-- Le CHECK d'origine (module-admin.sql) vaut ('compte', 'admin',
-- 'tarif', 'parametre', 'gestionnaire', 'plateforme'). Les RPC
-- vitrine écrivent l'audit avec cible_type = 'appartement' : on
-- retrouve la contrainte via pg_constraint (même patron que la
-- section 4 de module-v15.sql pour acteur_role) et on la recrée
-- avec la liste complète. acteur_role n'est PAS touché : il
-- accepte déjà les rôles clients depuis la v1.5.
do $$
declare
  v_nom text;
begin
  select conname into v_nom
    from pg_constraint
   where conrelid = 'public.journal_audit'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%cible_type%';
  if v_nom is not null then
    execute format('alter table public.journal_audit drop constraint %I', v_nom);
  end if;
end $$;
alter table public.journal_audit
  add constraint journal_audit_cible_type_check
  check (cible_type in ('compte', 'admin', 'tarif', 'parametre', 'gestionnaire', 'plateforme', 'appartement'));

-- --- 4. Demande de publication --------------------------------------------------
-- Point d'entrée UNIQUE de la publication : toutes les règles
-- sont vérifiées ICI, dans l'ordre — accès, garde d'écriture
-- v1.4, plan Pro/Agence, statut de l'appartement, photos,
-- contact présent, contact conforme au dossier ou justifié.
-- En cas de succès, l'annonce passe en « en_attente » et sort
-- de la vitrine (si elle y était) jusqu'à décision d'un Admin.
create or replace function public.demander_publication_vitrine(p_appartement uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_acteur_email text;
  v_acteur_role text;
  v_immeuble_id uuid;
  v_owner_id uuid;
  v_owner_email text;
  v_statut text;
  v_photos text[];
  v_contact_telephone text;
  v_contact_email text;
  v_contact_justification text;
  v_plan text;
  v_gestionnaire_id uuid;
  v_attendu_id uuid;
  v_attendu_telephone text;
  v_attendu_email text;
  v_divergent boolean := false;
begin
  select a.immeuble_id, i.owner_id, a.statut, a.photos,
         a.contact_telephone, a.contact_email, a.contact_justification
    into v_immeuble_id, v_owner_id, v_statut, v_photos,
         v_contact_telephone, v_contact_email, v_contact_justification
    from public.appartements a
    join public.immeubles i on i.id = a.immeuble_id
   where a.id = p_appartement;
  if not found then
    raise exception 'ERR_NOT_FOUND';
  end if;

  -- Accès : propriétaire de l'immeuble, gestionnaire affecté
  -- (gestionnaires_immeubles, helper existant) ou gestionnaire
  -- rattaché ACTIF à cet immeuble.
  if not (public.est_proprietaire_immeuble(v_immeuble_id)
      or public.est_gestionnaire_immeuble(v_immeuble_id)
      or exists (
        select 1 from public.rattachements_gestionnaires r
        where r.gestionnaire_id = v_acteur
          and r.statut = 'actif'
          and v_immeuble_id = any (r.immeuble_ids)
      )) then
    raise exception 'ERR_VITRINE_ACCES';
  end if;

  -- Garde v1.4 : c'est l'abonnement du PROPRIÉTAIRE des données
  -- qui décide, jamais celui du rédacteur.
  if not public.abonnement_permets_ecriture(v_owner_id) then
    raise exception 'ERR_VITRINE_ECRITURE';
  end if;

  -- Plan : le dernier abonnement vivant du propriétaire doit
  -- être Pro ou Agence (la vitrine est une fonction Pro/Agence).
  select a.plan into v_plan
    from public.abonnements a
   where a.owner_id = v_owner_id
     and a.statut in ('essai', 'actif')
   order by a.created_at desc
   limit 1;
  if v_plan is null or v_plan not in ('pro', 'agence') then
    raise exception 'ERR_VITRINE_PLAN';
  end if;

  if v_statut not in ('vacant', 'reserve') then
    raise exception 'ERR_VITRINE_STATUT';
  end if;

  -- Photos : des URL (le flux actuel ne téléverse pas de
  -- fichiers) — au moins 1, au plus 10.
  if coalesce(array_length(v_photos, 1), 0) < 1
     or coalesce(array_length(v_photos, 1), 0) > 10 then
    raise exception 'ERR_VITRINE_PHOTOS';
  end if;

  if (v_contact_telephone is null or btrim(v_contact_telephone) = '')
     and (v_contact_email is null or btrim(v_contact_email) = '') then
    raise exception 'ERR_VITRINE_CONTACT_MANQUANT';
  end if;

  -- Contact attendu : le gestionnaire du PREMIER rattachement
  -- actif (contexte propriétaire) couvrant cet immeuble, sinon
  -- le propriétaire lui-même.
  select r.gestionnaire_id into v_gestionnaire_id
    from public.rattachements_gestionnaires r
   where r.contexte = 'proprietaire'
     and r.proprietaire_id = v_owner_id
     and r.statut = 'actif'
     and v_immeuble_id = any (r.immeuble_ids)
   order by r.created_at
   limit 1;
  v_attendu_id := coalesce(v_gestionnaire_id, v_owner_id);
  select p.telephone, p.email into v_attendu_telephone, v_attendu_email
    from public.profils p
   where p.id = v_attendu_id;

  -- Divergence : téléphone comparé NORMALISÉ (on ne garde que
  -- chiffres et « + »), e-mail comparé insensible à la casse et
  -- aux espaces de bord. Un champ de contact vide ne diverge
  -- pas (l'autre canal suffit, déjà exigé ci-dessus).
  v_divergent :=
    (v_contact_telephone is not null and btrim(v_contact_telephone) <> ''
     and regexp_replace(v_contact_telephone, '[^0-9+]', '', 'g')
         <> regexp_replace(coalesce(v_attendu_telephone, ''), '[^0-9+]', '', 'g'))
    or (v_contact_email is not null and btrim(v_contact_email) <> ''
        and lower(btrim(v_contact_email)) <> lower(coalesce(v_attendu_email, '')));

  if v_divergent
     and (v_contact_justification is null or btrim(v_contact_justification) = '') then
    raise exception 'ERR_JUSTIFICATION_CONTACT';
  end if;

  update public.appartements
     set vitrine = true,
         vitrine_statut = 'en_attente',
         vitrine_motif_refus = null,
         vitrine_valide_par = null,
         vitrine_valide_le = null
   where id = p_appartement;

  select p.email, p.role into v_acteur_email, v_acteur_role
    from public.profils p
   where p.id = v_acteur;
  select p.email into v_owner_email
    from public.profils p
   where p.id = v_owner_id;

  insert into public.journal_audit
    (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
  values
    (v_acteur, v_acteur_email, v_acteur_role, 'vitrine_publication_demandee',
     'appartement', p_appartement::text, v_owner_email,
     jsonb_build_object('immeuble_id', v_immeuble_id, 'divergent', v_divergent));
end;
$$;

-- --- 5. Validation par la plateforme ---------------------------------------------
-- Admin / Super Admin seulement (est_admin_plateforme), annonce
-- en attente seulement. L'approbation comme le refus sont
-- tracés (vitrine_valide_par / vitrine_valide_le posés dans les
-- deux cas) ; le refus exige un motif, qui sera montré au
-- propriétaire.
create or replace function public.valider_publication_vitrine(
  p_appartement uuid, p_accepter boolean, p_motif text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_acteur_email text;
  v_acteur_role text;
  v_immeuble_id uuid;
  v_owner_id uuid;
  v_owner_email text;
  v_statut text;
begin
  if not public.est_admin_plateforme() then
    raise exception 'ERR_ACCES_PLATEFORME';
  end if;

  select a.immeuble_id, i.owner_id, a.vitrine_statut
    into v_immeuble_id, v_owner_id, v_statut
    from public.appartements a
    join public.immeubles i on i.id = a.immeuble_id
   where a.id = p_appartement;
  if not found then
    raise exception 'ERR_NOT_FOUND';
  end if;
  if v_statut <> 'en_attente' then
    raise exception 'ERR_VITRINE_PAS_EN_ATTENTE';
  end if;

  select p.email into v_owner_email
    from public.profils p
   where p.id = v_owner_id;
  select p.email, p.role into v_acteur_email, v_acteur_role
    from public.profils p
   where p.id = v_acteur;

  if p_accepter then
    update public.appartements
       set vitrine_statut = 'approuve',
           vitrine_valide_par = v_acteur,
           vitrine_valide_le = now(),
           vitrine_motif_refus = null
     where id = p_appartement;

    insert into public.journal_audit
      (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
    values
      (v_acteur, v_acteur_email, v_acteur_role, 'vitrine_approuvee',
       'appartement', p_appartement::text, v_owner_email,
       jsonb_build_object('immeuble_id', v_immeuble_id));
  else
    if p_motif is null or btrim(p_motif) = '' then
      raise exception 'ERR_VITRINE_MOTIF_REQUIS';
    end if;

    update public.appartements
       set vitrine_statut = 'refuse',
           vitrine_motif_refus = p_motif,
           vitrine_valide_par = v_acteur,
           vitrine_valide_le = now()
     where id = p_appartement;

    insert into public.journal_audit
      (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
    values
      (v_acteur, v_acteur_email, v_acteur_role, 'vitrine_refusee',
       'appartement', p_appartement::text, v_owner_email,
       jsonb_build_object('immeuble_id', v_immeuble_id, 'motif', p_motif));
  end if;
end;
$$;

-- --- 6. Retrait de la publication --------------------------------------------------
-- Même contrôle d'accès que la demande (section 4), SANS les
-- validations de contenu : retirer une annonce doit toujours
-- rester possible. L'annonce sort immédiatement de la vitrine
-- et revient à « non_publie », traces de validation effacées.
create or replace function public.retirer_publication_vitrine(p_appartement uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_acteur_email text;
  v_acteur_role text;
  v_immeuble_id uuid;
  v_owner_id uuid;
  v_owner_email text;
begin
  select a.immeuble_id, i.owner_id
    into v_immeuble_id, v_owner_id
    from public.appartements a
    join public.immeubles i on i.id = a.immeuble_id
   where a.id = p_appartement;
  if not found then
    raise exception 'ERR_NOT_FOUND';
  end if;

  if not (public.est_proprietaire_immeuble(v_immeuble_id)
      or public.est_gestionnaire_immeuble(v_immeuble_id)
      or exists (
        select 1 from public.rattachements_gestionnaires r
        where r.gestionnaire_id = v_acteur
          and r.statut = 'actif'
          and v_immeuble_id = any (r.immeuble_ids)
      )) then
    raise exception 'ERR_VITRINE_ACCES';
  end if;

  update public.appartements
     set vitrine = false,
         vitrine_statut = 'non_publie',
         vitrine_motif_refus = null,
         vitrine_valide_par = null,
         vitrine_valide_le = null
   where id = p_appartement;

  select p.email, p.role into v_acteur_email, v_acteur_role
    from public.profils p
   where p.id = v_acteur;
  select p.email into v_owner_email
    from public.profils p
   where p.id = v_owner_id;

  insert into public.journal_audit
    (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
  values
    (v_acteur, v_acteur_email, v_acteur_role, 'vitrine_publication_retiree',
     'appartement', p_appartement::text, v_owner_email,
     jsonb_build_object('immeuble_id', v_immeuble_id));
end;
$$;

-- --- 7. Anti-fraude : revalidation automatique --------------------------------------
-- Une annonce APPROUVÉE dont un champ sensible change repasse
-- en « en_attente » DANS LA MÊME ÉCRITURE (BEFORE UPDATE) :
-- elle disparaît de la vitrine à l'instant même de la
-- modification, sans fenêtre d'exposition du contenu non relu.
-- Garde essentielle : si l'écriture change DÉJÀ le statut
-- (demande, validation, retrait — sections 4 à 6), le trigger
-- ne s'en mêle pas.
create or replace function public.vitrine_revalidation_auto()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.vitrine_statut = 'approuve'
     and new.vitrine_statut = old.vitrine_statut
     and (new.loyer_defaut is distinct from old.loyer_defaut
       or new.devise is distinct from old.devise
       or new.charges is distinct from old.charges
       or new.photos is distinct from old.photos
       or new.description is distinct from old.description
       or new.visite_jours is distinct from old.visite_jours
       or new.visite_heures is distinct from old.visite_heures
       or new.contact_nom is distinct from old.contact_nom
       or new.contact_telephone is distinct from old.contact_telephone
       or new.contact_email is distinct from old.contact_email) then
    new.vitrine_statut := 'en_attente';
    new.vitrine_valide_par := null;
    new.vitrine_valide_le := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vitrine_revalidation on public.appartements;
create trigger trg_vitrine_revalidation
  before update on public.appartements
  for each row execute function public.vitrine_revalidation_auto();

-- --- 8. Politiques publiques : annonces APPROUVÉES seulement -------------------------
-- Recréées À L'IDENTIQUE depuis schema.sql, avec la condition
-- vitrine_statut = 'approuve' AJOUTÉE à chaque condition
-- existante. Lecture ANONYME inchangée dans son périmètre :
-- appartements publiés vacants/réservés non archivés, leurs
-- immeubles, et le profil du propriétaire concerné. Les
-- politiques d'ÉCRITURE (v1.4, garde d'abonnement) ne sont PAS
-- touchées.
drop policy if exists appartements_select_public on public.appartements;
create policy appartements_select_public on public.appartements
  for select to anon using (
    vitrine = true and vitrine_statut = 'approuve'
    and statut in ('vacant', 'reserve') and archive = false
  );
drop policy if exists immeubles_select_public on public.immeubles;
create policy immeubles_select_public on public.immeubles
  for select to anon using (
    exists (
      select 1 from public.appartements a
      where a.immeuble_id = immeubles.id
        and a.vitrine = true and a.vitrine_statut = 'approuve'
        and a.statut in ('vacant', 'reserve') and a.archive = false
    )
  );
drop policy if exists profils_select_vitrine on public.profils;
create policy profils_select_vitrine on public.profils
  for select to anon using (
    exists (
      select 1 from public.immeubles i
      join public.appartements a on a.immeuble_id = i.id
      where i.owner_id = profils.id
        and a.vitrine = true and a.vitrine_statut = 'approuve'
        and a.statut in ('vacant', 'reserve') and a.archive = false
    )
  );

-- --- 9. Grants -------------------------------------------------------------------------
-- Les 3 RPC sont appelables par tout utilisateur authentifié ;
-- les gardes INTERNES (accès, plan, rôle plateforme) font le
-- tri, comme dans les modules précédents. La fonction trigger
-- ne reçoit AUCUN grant : elle n'est jamais appelée directement.
revoke all on function public.demander_publication_vitrine(uuid) from public;
grant execute on function public.demander_publication_vitrine(uuid) to authenticated;
revoke all on function public.valider_publication_vitrine(uuid, boolean, text) from public;
grant execute on function public.valider_publication_vitrine(uuid, boolean, text) to authenticated;
revoke all on function public.retirer_publication_vitrine(uuid) from public;
grant execute on function public.retirer_publication_vitrine(uuid) to authenticated;

-- ============================================================================
-- FIN DU MODULE v1.6.
-- Vérifications après exécution :
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'appartements'
--       and column_name in ('vitrine_statut', 'vitrine_motif_refus',
--         'vitrine_valide_par', 'vitrine_valide_le', 'pieces',
--         'meuble', 'disponible_le', 'visite_jours', 'visite_heures',
--         'contact_nom', 'contact_telephone', 'contact_email',
--         'contact_justification'); -- 13 lignes
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'immeubles'
--       and column_name = 'quartier'; -- 1 ligne
--   select count(*) from public.appartements
--     where vitrine = true and vitrine_statut = 'approuve';
--     -- 0 juste après migration : rien d'affiché sans approbation
--   select proname from pg_proc
--     where pronamespace = 'public'::regnamespace
--       and proname in ('demander_publication_vitrine',
--         'valider_publication_vitrine', 'retirer_publication_vitrine',
--         'vitrine_revalidation_auto'); -- 4 lignes
--   select tgname from pg_trigger
--     where tgrelid = 'public.appartements'::regclass
--       and tgname = 'trg_vitrine_revalidation'; -- 1 ligne
--   select policyname from pg_policies
--     where schemaname = 'public'
--       and policyname in ('appartements_select_public',
--         'immeubles_select_public', 'profils_select_vitrine');
--     -- 3 lignes
-- ============================================================================
