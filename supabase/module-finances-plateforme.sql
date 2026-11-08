-- ============================================================================
-- CizaImmo — Finances de la plateforme : PAIE des employés + DÉPENSES
-- supervisées (2026-11-08, décision VALIDÉE par le fondateur).
--
-- Modèle décidé :
--  - la PAIE s'émet DEPUIS le dossier employé : montant, devise et
--    modalités sont tirés du contrat d'engagement stocké sur la ligne
--    `profils` (colonnes contrat_employe_* du module pack employé) —
--    jamais ressaisis à l'émission. Si le dossier employé est
--    INCOMPLET, l'application refuse l'émission (garde applicative,
--    la complétude est CALCULÉE, patron du dossier employé) ; cette
--    table ne conserve que les paies effectivement ÉMISES.
--  - les DÉPENSES de fonctionnement sont saisies par l'Admin (ou le
--    Super Admin) puis VALIDÉES par le Super Admin : celui qui
--    saisit ne valide jamais (la validation est réservée au rôle
--    super_admin, y compris en RLS ci-dessous).
--  - périmètre : CizaImmo seulement.
--
-- TABLES :
--  - paies_employes : une ligne par paie émise. UNICITÉ (profil_id,
--    mois) pour le statut 'emise' (index unique partiel) — un seul
--    salaire par employé et par mois, garanti par la base en plus de
--    la garde applicative.
--  - depenses_plateforme : date, libellé, catégorie (liste fermée),
--    montant, devise, justificatif (chemin dans le bucket PRIVÉ
--    « documents-prives », préfixe <saisi_par>/depenses-plateforme/ —
--    les politiques Storage existantes couvrent déjà ce patron :
--    écriture dans son propre dossier, lecture plateforme via
--    documents_prives_select_plateforme), saisie par, cycle de
--    validation (en_attente -> validee / refusee avec motif).
--
-- RLS (patron des politiques existantes, helpers de module-admin.sql) :
--  - paies_employes : lecture plateforme (est_admin_plateforme) ;
--    insertion Super Admin seul (est_super_admin) ; aucune mise à
--    jour ni suppression (une paie émise est un fait).
--  - depenses_plateforme : lecture plateforme ; insertion plateforme
--    avec saisi_par = auth.uid() ; mise à jour (validation) Super
--    Admin seul ; aucune suppression.
--
-- RÉTROACTIVITÉ : les deux tables naissent VIDES — aucun historique
-- n'est inventé ; les employés actuels (fondateur CIM-000001, compte
-- de test CIM-000003 promu Admin) n'ont aucune paie ni dépense tant
-- que rien n'a été émis ou saisi.
--
-- Idempotent : réexécutable sans effet de bord. À appliquer APRÈS
-- module-admin.sql (helpers RLS), module-dossier-employe.sql et
-- module-pack-employe.sql (la paie lit les colonnes contrat_employe_*).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Paies des employés (émises depuis le dossier + le contrat en base).
-- ----------------------------------------------------------------------------
create table if not exists public.paies_employes (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils (id),
  -- Mois de paie au format « AAAA-MM ».
  mois text not null check (mois ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  -- Montant, devise et modalités COPIÉS du contrat d'engagement au
  -- moment de l'émission (le contrat fait foi ; la copie fige le fait).
  montant numeric(12, 2) not null check (montant > 0),
  devise text not null,
  modalites text,
  -- Référence libre de l'émission (n° de virement, reçu…) — optionnelle.
  reference text,
  statut text not null default 'emise' check (statut in ('emise')),
  emis_par uuid not null references public.profils (id),
  emis_le timestamptz not null default now(),
  cree_le timestamptz not null default now()
);

-- Unicité : une seule paie émise par employé et par mois.
create unique index if not exists paies_employes_unique_mois
  on public.paies_employes (profil_id, mois)
  where statut = 'emise';

create index if not exists paies_employes_mois_idx
  on public.paies_employes (mois);

comment on table public.paies_employes is
  'Finances plateforme : paies émises aux employés (depuis leur dossier complet + leur contrat d''engagement en base). Une seule paie émise par employé et par mois.';

-- ----------------------------------------------------------------------------
-- 2. Dépenses de fonctionnement supervisées.
-- ----------------------------------------------------------------------------
create table if not exists public.depenses_plateforme (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  libelle text not null check (btrim(libelle) <> ''),
  -- Liste fermée (miroir de lib/finances-plateforme.ts).
  categorie text not null check (categorie in
    ('hebergement_services', 'communication', 'marketing',
     'fournitures', 'deplacements', 'autre')),
  montant numeric(12, 2) not null check (montant > 0),
  devise text not null,
  -- Justificatif dans le bucket privé « documents-prives » (optionnel).
  justificatif_path text,
  saisi_par uuid not null references public.profils (id),
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'validee', 'refusee')),
  -- Motif du refus (obligatoire côté application quand statut refusee).
  motif_refus text,
  valide_par uuid references public.profils (id),
  valide_le timestamptz,
  cree_le timestamptz not null default now()
);

create index if not exists depenses_plateforme_statut_idx
  on public.depenses_plateforme (statut);
create index if not exists depenses_plateforme_date_idx
  on public.depenses_plateforme (date);

comment on table public.depenses_plateforme is
  'Finances plateforme : dépenses de fonctionnement saisies par la plateforme et validées par le Super Admin seul (celui qui saisit ne valide pas).';

-- ----------------------------------------------------------------------------
-- 3. RLS — patron des politiques existantes (module-admin / finance).
-- ----------------------------------------------------------------------------
alter table public.paies_employes enable row level security;
alter table public.depenses_plateforme enable row level security;

-- Paies : lecture plateforme.
drop policy if exists paies_employes_select_plateforme on public.paies_employes;
create policy paies_employes_select_plateforme on public.paies_employes
  for select using (public.est_admin_plateforme());

-- Paies : émission Super Admin seul.
drop policy if exists paies_employes_insert_super_admin on public.paies_employes;
create policy paies_employes_insert_super_admin on public.paies_employes
  for insert with check (public.est_super_admin());

-- Dépenses : lecture plateforme.
drop policy if exists depenses_plateforme_select_plateforme on public.depenses_plateforme;
create policy depenses_plateforme_select_plateforme on public.depenses_plateforme
  for select using (public.est_admin_plateforme());

-- Dépenses : saisie plateforme, toujours sous SON propre identifiant.
drop policy if exists depenses_plateforme_insert_plateforme on public.depenses_plateforme;
create policy depenses_plateforme_insert_plateforme on public.depenses_plateforme
  for insert with check (
    public.est_admin_plateforme() and saisi_par = auth.uid()
  );

-- Dépenses : validation (toute mise à jour) Super Admin seul — un
-- Admin ne peut donc valider AUCUNE dépense, pas même les siennes.
drop policy if exists depenses_plateforme_update_super_admin on public.depenses_plateforme;
create policy depenses_plateforme_update_super_admin on public.depenses_plateforme
  for update using (public.est_super_admin())
  with check (public.est_super_admin());

-- ============================================================================
-- VÉRIFICATIONS (lecture seule, après application) :
--  V1. Les deux tables existent (2 lignes) :
--      select table_name from information_schema.tables
--       where table_schema = 'public'
--         and table_name in ('paies_employes', 'depenses_plateforme')
--       order by table_name;
--  V2. Colonnes clés présentes (paies : 11 ; dépenses : 13) :
--      select table_name, count(*) from information_schema.columns
--       where table_schema = 'public'
--         and ((table_name = 'paies_employes' and column_name in
--               ('id','profil_id','mois','montant','devise','modalites',
--                'reference','statut','emis_par','emis_le','cree_le'))
--           or (table_name = 'depenses_plateforme' and column_name in
--               ('id','date','libelle','categorie','montant','devise',
--                'justificatif_path','saisi_par','statut','motif_refus',
--                'valide_par','valide_le','cree_le')))
--       group by table_name order by table_name;
--      -> 11 pour paies_employes et 13 pour depenses_plateforme.
--  V3. RLS activée + 5 politiques présentes :
--      select relname, relrowsecurity from pg_class
--       where relname in ('paies_employes','depenses_plateforme');
--      -> 2 lignes, relrowsecurity = true.
--      select policyname from pg_policies
--       where schemaname = 'public'
--         and policyname like '%\_employes\_%' or policyname like 'depenses\_plateforme\_%'
--       order by policyname;
--      -> paies_employes_insert_super_admin,
--         paies_employes_select_plateforme,
--         depenses_plateforme_insert_plateforme,
--         depenses_plateforme_select_plateforme,
--         depenses_plateforme_update_super_admin.
--  V4. Index d'unicité paie/mois présent :
--      select indexname from pg_indexes
--       where schemaname = 'public'
--         and indexname = 'paies_employes_unique_mois';
--      -> 1 ligne.
--  V5. Rétroactivité — les tables naissent vides (aucun historique
--      inventé) et les CLIENTS n'ont aucune ligne :
--      select (select count(*) from public.paies_employes) as paies,
--             (select count(*) from public.depenses_plateforme) as depenses;
--      -> 0 et 0 à l'application.
-- ============================================================================
