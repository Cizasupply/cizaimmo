-- ============================================================================
-- CizaImmo — Extension v1.7 « Passeport photo + autorisation de gestion »
-- (2026-11-07, décision du fondateur : étape 2 prioritaire).
--
-- 1. PHOTO DU BIEN = PHOTO DU PASSEPORT : les photos téléversées d'un
--    immeuble vivent dans le bucket PRIVÉ « documents-prives » (mêmes
--    politiques Storage que les documents : chemin préfixé par l'id de
--    l'uploader, lecture propriétaire + plateforme). La table
--    immeubles ne stocke que les CHEMINS (colonne photos, text[]) ;
--    l'affichage passe par des liens signés (1 h) résolus par
--    l'application. La PREMIÈRE photo est la photo principale.
--
-- 2. IMMEUBLE CRÉÉ PAR UN GESTIONNAIRE : au lieu du titre de
--    propriété, il dépose une AUTORISATION DE GESTION signée par le
--    propriétaire (document de type « autorisation », table documents)
--    et DÉCLARE le nom + l'e-mail du propriétaire. L'immeuble part en
--    REVUE PLATEFORME (validation_statut = 'en_attente') ; la décision
--    passe par la RPC decider_validation_immeuble (section 5),
--    journalisée. Le contrôle allégé (proprietaire_concordance) est
--    calculé par l'application à la création : propriétaire déclaré
--    déjà rattaché au gestionnaire et validé → concordance signalée,
--    mais l'autorisation reste exigée au dossier.
--
-- Idempotent : réexécutable sans effet de bord. À appliquer APRÈS
-- module-v16.sql et module-correctif-grille.sql. Aucune politique RLS
-- nouvelle : les colonnes immeubles héritent des politiques existantes
-- (la garde d'écriture v1.4 couvre les UPDATE), le bucket privé couvre
-- les fichiers, la RPC de décision vérifie le rôle en interne.
-- ============================================================================

-- --- 1. Colonnes v1.7 sur immeubles ------------------------------------------
alter table public.immeubles
  add column if not exists photos text[] not null default '{}';
alter table public.immeubles
  add column if not exists origine_creation text not null default 'proprietaire';
alter table public.immeubles drop constraint if exists immeubles_origine_creation_check;
alter table public.immeubles
  add constraint immeubles_origine_creation_check
  check (origine_creation in ('proprietaire', 'gestionnaire'));
alter table public.immeubles
  add column if not exists proprietaire_declare_nom text;
alter table public.immeubles
  add column if not exists proprietaire_declare_email text;
alter table public.immeubles
  add column if not exists proprietaire_concordance boolean not null default false;
alter table public.immeubles
  add column if not exists validation_statut text not null default 'valide';
alter table public.immeubles drop constraint if exists immeubles_validation_statut_check;
alter table public.immeubles
  add constraint immeubles_validation_statut_check
  check (validation_statut in ('valide', 'en_attente', 'refuse'));
alter table public.immeubles
  add column if not exists validation_motif text;

-- Cohérence (la base décide) : un immeuble créé par un gestionnaire
-- déclare TOUJOURS le nom et l'e-mail du propriétaire ; un immeuble
-- « gestionnaire » naît en attente de revue (l'application le pose,
-- la contrainte garantit le déclaré).
alter table public.immeubles drop constraint if exists immeubles_gestionnaire_declare_check;
alter table public.immeubles
  add constraint immeubles_gestionnaire_declare_check
  check (
    origine_creation = 'proprietaire'
    or (
      proprietaire_declare_nom is not null
      and btrim(proprietaire_declare_nom) <> ''
      and proprietaire_declare_email is not null
      and btrim(proprietaire_declare_email) <> ''
    )
  );

-- --- 2. documents : nouveau type « autorisation » -----------------------------
-- Même patron que module-v13.sql (ajout de « contrat ») : on remplace
-- le CHECK de type par la liste complète, « autorisation » incluse.
alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents drop constraint if exists documents_type_check_v13;
alter table public.documents drop constraint if exists documents_type_check_v17;
alter table public.documents
  add constraint documents_type_check_v17
  check (type in ('bail', 'piece_identite', 'justificatif', 'facture', 'contrat', 'autorisation', 'autre'));

-- --- 3. journal_audit : cible_type élargi à 'immeuble' ------------------------
-- Même patron que module-v16.sql section 3 : la décision de revue
-- écrit l'audit avec cible_type = 'immeuble'.
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
  check (cible_type in ('compte', 'admin', 'tarif', 'parametre', 'gestionnaire', 'plateforme', 'appartement', 'immeuble'));

-- --- 4. Décision de revue : decider_validation_immeuble -----------------------
-- Réservée à la plateforme (est_admin_plateforme, vérifié EN INTERNE).
-- L'immeuble doit être « en_attente » ; le refus exige un motif (montré
-- au gestionnaire, qui pourra corriger et resoumettre). La décision
-- est journalisée (cible = l'immeuble, e-mail cible = le gestionnaire
-- créateur : son Dossier affiche l'entrée).
create or replace function public.decider_validation_immeuble(
  p_immeuble uuid, p_accepter boolean, p_motif text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_acteur_email text;
  v_acteur_role text;
  v_owner_id uuid;
  v_owner_email text;
  v_statut text;
  v_nom text;
begin
  if not public.est_admin_plateforme() then
    raise exception 'ERR_ACCES_PLATEFORME';
  end if;

  select i.owner_id, i.validation_statut, i.nom
    into v_owner_id, v_statut, v_nom
    from public.immeubles i
   where i.id = p_immeuble;
  if not found then
    raise exception 'ERR_NOT_FOUND';
  end if;
  if v_statut <> 'en_attente' then
    raise exception 'ERR_VALIDATION_PAS_EN_ATTENTE';
  end if;

  select p.email into v_owner_email
    from public.profils p
   where p.id = v_owner_id;
  select p.email, p.role into v_acteur_email, v_acteur_role
    from public.profils p
   where p.id = v_acteur;

  if p_accepter then
    update public.immeubles
       set validation_statut = 'valide',
           validation_motif = null
     where id = p_immeuble;

    insert into public.journal_audit
      (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
    values
      (v_acteur, v_acteur_email, v_acteur_role, 'immeuble_gestion_valide',
       'immeuble', p_immeuble::text, v_owner_email,
       jsonb_build_object('immeuble_nom', v_nom));
  else
    if p_motif is null or btrim(p_motif) = '' then
      raise exception 'ERR_VALIDATION_MOTIF_REQUIS';
    end if;

    update public.immeubles
       set validation_statut = 'refuse',
           validation_motif = btrim(p_motif)
     where id = p_immeuble;

    insert into public.journal_audit
      (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
    values
      (v_acteur, v_acteur_email, v_acteur_role, 'immeuble_gestion_refuse',
       'immeuble', p_immeuble::text, v_owner_email,
       jsonb_build_object('immeuble_nom', v_nom, 'motif', btrim(p_motif)));
  end if;
end;
$$;
revoke all on function public.decider_validation_immeuble(uuid, boolean, text) from public;
grant execute on function public.decider_validation_immeuble(uuid, boolean, text) to authenticated;

-- ============================================================================
-- VÉRIFICATIONS (lecture seule, après application) :
--  V1. Colonnes présentes (7 lignes attendues) :
--      select column_name from information_schema.columns
--       where table_schema = 'public' and table_name = 'immeubles'
--         and column_name in ('photos', 'origine_creation',
--           'proprietaire_declare_nom', 'proprietaire_declare_email',
--           'proprietaire_concordance', 'validation_statut',
--           'validation_motif')
--       order by column_name;
--  V2. Fonction présente (1 ligne) :
--      select proname from pg_proc
--       where pronamespace = 'public'::regnamespace
--         and proname = 'decider_validation_immeuble';
--  V3. Type de document élargi (le CHECK contient 'autorisation') :
--      select pg_get_constraintdef(oid) from pg_constraint
--       where conrelid = 'public.documents'::regclass
--         and conname = 'documents_type_check_v17';
--  V4. Aucun immeuble existant en revue (informatif — les biens
--      actuels sont 'valide' / origine 'proprietaire' par défaut) :
--      select count(*) from public.immeubles
--       where validation_statut = 'en_attente';
-- ============================================================================
