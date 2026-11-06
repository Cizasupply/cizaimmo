-- ============================================================================
-- CizaImmo — Schéma de base de données (Module 1)
-- Spécification fonctionnelle v1.1 (§13 : 14 tables + §14 : sécurité / RLS)
-- ----------------------------------------------------------------------------
-- À exécuter UNE FOIS dans l'éditeur SQL de Supabase (Dashboard > SQL Editor),
-- sur le projet CizaImmo, APRÈS avoir créé le projet Supabase.
-- Le script est idempotent pour les tables (CREATE TABLE IF NOT EXISTS) mais
-- les politiques sont recréées (DROP POLICY IF EXISTS) : il peut être relancé.
--
-- RÈGLE DURE (spec §1, §12) : CizaImmo n'encaisse JAMAIS les loyers.
-- La base ne trace que des paiements DÉCLARÉS par le propriétaire ou le
-- gestionnaire. Aucune table de paiement en ligne, aucun encaissement.
--
-- Conventions : snake_case partout, UUID v4, horodatage created_at,
-- montants NUMERIC (jamais FLOAT), chaque montant garde sa devise d'origine.
-- Les taux de change ne sont JAMAIS présentés comme « en direct » : la table
-- taux_change garde la date du taux et sa source (auto / manuel).
-- ============================================================================

-- Nécessaire pour gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. profils — un profil par compte Supabase Auth (id = auth.users.id)
-- ---------------------------------------------------------------------------
create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null,
  email text not null unique,
  pays text,
  langue text not null default 'fr' check (langue in ('fr', 'en')),
  devise_principale text not null default 'USD'
    check (devise_principale in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  role text not null default 'proprietaire'
    check (role in ('proprietaire', 'gestionnaire', 'coproprietaire')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. immeubles — un bloc = un immeuble ou un ensemble géré comme une unité
--    (l'unité de comptage de l'abonnement, spec §12)
-- ---------------------------------------------------------------------------
create table if not exists public.immeubles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  nom text not null,
  adresse text not null,
  ville text not null,
  pays text not null,
  devise text not null default 'USD'
    check (devise in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  type text not null default 'immeuble' check (type in ('immeuble', 'bloc', 'maison')),
  etages integer check (etages is null or etages >= 0),
  photo_url text,
  notes text,
  -- Valeur du bien : sert au ROI (revenus - dépenses) / valeur (spec §9).
  -- Sans valeur renseignée, le ROI n'est jamais inventé.
  valeur_bien numeric(18,2) check (valeur_bien is null or valeur_bien > 0),
  devise_valeur text check (devise_valeur is null or devise_valeur in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  date_acquisition date,
  prix_acquisition numeric(18,2) check (prix_acquisition is null or prix_acquisition >= 0),
  statut text not null default 'actif' check (statut in ('actif', 'archive')),
  created_at timestamptz not null default now(),
  unique (owner_id, nom)
);

-- ---------------------------------------------------------------------------
-- 3. appartements
-- ---------------------------------------------------------------------------
create table if not exists public.appartements (
  id uuid primary key default gen_random_uuid(),
  immeuble_id uuid not null references public.immeubles (id) on delete cascade,
  numero text not null,
  type text not null default 'T1' check (type in ('studio','T1','T2','T3','T4','T5+','autre')),
  surface_m2 numeric(8,2) check (surface_m2 is null or surface_m2 > 0),
  loyer_defaut numeric(18,2) not null check (loyer_defaut > 0),
  devise text not null default 'USD'
    check (devise in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  charges numeric(18,2) not null default 0 check (charges >= 0),
  etage integer,
  description text,
  photos text[] not null default '{}', -- liens des photos de l'appartement (spec §8)
  statut text not null default 'vacant'
    check (statut in ('occupe', 'vacant', 'travaux', 'reserve')),
  vitrine boolean not null default false, -- publié sur la vitrine « à louer » (Pro/Agence)
  -- Archivé après la fin du bail : un appartement occupé ne se supprime pas
  -- (spec §6), il est archivé et disparaît des listes actives.
  archive boolean not null default false,
  valeur_bien numeric(18,2) check (valeur_bien is null or valeur_bien > 0),
  devise_valeur text check (devise_valeur is null or devise_valeur in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  created_at timestamptz not null default now(),
  unique (immeuble_id, numero)
);

-- ---------------------------------------------------------------------------
-- 4. locataires — aucun compte : accès par lien sécurisé applicatif (§14),
--    donc AUCUNE politique RLS ne leur ouvre la base.
-- ---------------------------------------------------------------------------
create table if not exists public.locataires (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  nom text not null,
  telephone text not null,
  email text,
  piece_type text check (piece_type is null or piece_type in ('cni','passeport','permis','autre')),
  piece_numero text,
  adresse_precedente text,
  contact_urgence text,
  notes text,
  lien_token text unique,          -- jeton unique du lien lecture seule
  lien_expire_le timestamptz,      -- proposition spec §15 : 30 jours, renouvelable
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. baux
-- ---------------------------------------------------------------------------
create table if not exists public.baux (
  id uuid primary key default gen_random_uuid(),
  appartement_id uuid not null references public.appartements (id) on delete restrict,
  locataire_id uuid not null references public.locataires (id) on delete restrict,
  debut date not null,
  fin date,
  loyer_mensuel numeric(18,2) not null check (loyer_mensuel > 0),
  devise text not null default 'USD'
    check (devise in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  caution numeric(18,2) check (caution is null or caution >= 0),
  devise_caution text check (devise_caution is null or devise_caution in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  caution_recue_le date,
  -- La caution n'entre jamais dans les revenus ni dans le ROI (spec §9).
  caution_statut text not null default 'en_attente'
    check (caution_statut in ('en_attente', 'recue', 'restituee', 'retenue_partielle')),
  jour_exigibilite integer not null default 1 check (jour_exigibilite between 1 and 28),
  charges_incluses boolean not null default false,
  statut text not null default 'actif' check (statut in ('actif', 'termine')),
  doc_url text,
  created_at timestamptz not null default now(),
  check (fin is null or fin > debut)
);

-- ---------------------------------------------------------------------------
-- 6. loyers (échéances mensuelles) — UNE échéance par bail et par mois,
--    garantie par la contrainte UNIQUE(bail_id, mois) (spec §9).
-- ---------------------------------------------------------------------------
create table if not exists public.loyers (
  id uuid primary key default gen_random_uuid(),
  bail_id uuid not null references public.baux (id) on delete cascade,
  mois date not null, -- toujours le 1er du mois concerné
  montant_du numeric(18,2) not null check (montant_du >= 0),
  devise text not null default 'USD'
    check (devise in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  statut text not null default 'a_venir'
    check (statut in ('a_venir', 'du', 'partiel', 'paye', 'en_retard')),
  prorata boolean not null default false,
  prorata_detail text, -- détail du calcul prorata, visible sur l'échéance
  created_at timestamptz not null default now(),
  unique (bail_id, mois)
);

-- ---------------------------------------------------------------------------
-- 7. paiements — paiements DÉCLARÉS uniquement (jamais encaissés par CizaImmo)
-- ---------------------------------------------------------------------------
create table if not exists public.paiements (
  id uuid primary key default gen_random_uuid(),
  echeance_id uuid not null references public.loyers (id) on delete restrict,
  montant numeric(18,2) not null check (montant > 0),
  devise text not null default 'USD'
    check (devise in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  date_paiement date not null,
  moyen text not null default 'especes'
    check (moyen in ('especes', 'virement', 'mobile_money', 'cheque', 'autre')),
  reference text,
  declare_par uuid references public.profils (id) on delete set null,
  recu_numero text unique, -- format proposé spec §15 : CIM-AAAA-000001, séquentiel par compte
  statut text not null default 'valide' check (statut in ('valide', 'annule')),
  created_at timestamptz not null default now()
);

-- Module 3 — conversion explicite (devise différente de celle du bail :
-- taux DATÉ, jamais présenté comme taux du jour) et trace d'annulation
-- (spec §8, §14 : auteur, date, motif ; un reçu annulé garde son numéro).
alter table if exists public.paiements
  add column if not exists taux_conversion numeric(18,6) check (taux_conversion is null or taux_conversion > 0);
alter table if exists public.paiements
  add column if not exists date_taux date;
alter table if exists public.paiements
  add column if not exists montant_converti numeric(18,2) check (montant_converti is null or montant_converti > 0);
alter table if exists public.paiements
  add column if not exists annule_par uuid references public.profils (id) on delete set null;
alter table if exists public.paiements
  add column if not exists annule_le timestamptz;
alter table if exists public.paiements
  add column if not exists motif_annulation text;
alter table if exists public.paiements
  add column if not exists remplace_paiement_id uuid references public.paiements (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 8. depenses
-- ---------------------------------------------------------------------------
create table if not exists public.depenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  immeuble_id uuid not null references public.immeubles (id) on delete cascade,
  appartement_id uuid references public.appartements (id) on delete set null,
  date date not null,
  categorie text not null
    check (categorie in ('entretien', 'reparation', 'taxe', 'assurance', 'salaire', 'autre')),
  libelle text not null,
  montant numeric(18,2) not null check (montant > 0),
  devise text not null default 'USD'
    check (devise in ('USD','EUR','GBP','CAD','BIF','XAF','XOF','KES','TZS','RWF','UGX','BRL')),
  fournisseur text,
  justificatif_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 9. documents — stockage privé, jamais de lien public (spec §14)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  type text not null
    check (type in ('bail', 'piece_identite', 'justificatif', 'facture', 'autre')),
  entite_type text not null
    check (entite_type in ('immeuble', 'appartement', 'locataire', 'bail', 'depense')),
  entite_id uuid not null,
  nom_fichier text not null,
  storage_path text not null, -- chemin dans le bucket privé Supabase Storage
  ajoute_par uuid references public.profils (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. alertes — créées automatiquement (retard, fin de bail, vacance…)
-- ---------------------------------------------------------------------------
create table if not exists public.alertes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  type text not null
    check (type in ('loyer_en_retard', 'fin_de_bail', 'vacance_prolongee', 'bail_demarrant', 'essai_abonnement', 'autre')),
  entite_type text check (entite_type is null or entite_type in ('immeuble', 'appartement', 'locataire', 'bail', 'loyer', 'abonnement')),
  entite_id uuid,
  message text not null,
  statut text not null default 'active' check (statut in ('active', 'traitee')),
  canal text not null default 'app' check (canal in ('app', 'email', 'whatsapp')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 11. coproprietaires (indivision) — parts en %, total = 100 % validé
--     CÔTÉ APPLICATION (pas de contrainte inter-lignes possible en SQL
--     simple) : la somme des parts d'un immeuble doit faire exactement 100.
-- ---------------------------------------------------------------------------
create table if not exists public.coproprietaires (
  id uuid primary key default gen_random_uuid(),
  immeuble_id uuid not null references public.immeubles (id) on delete cascade,
  nom text not null,
  email text not null,
  telephone text,
  part numeric(5,2) not null check (part > 0 and part <= 100),
  created_at timestamptz not null default now(),
  unique (immeuble_id, email) -- une part par e-mail et par immeuble
);

-- ---------------------------------------------------------------------------
-- 12. activites (fil d'actualité) — généré automatiquement, jamais saisi
--     à la main, jamais modifié (spec §6 suite).
-- ---------------------------------------------------------------------------
create table if not exists public.activites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  type text not null
    check (type in ('paiement', 'depense', 'bail', 'alerte', 'document', 'coproprietaire', 'immeuble', 'appartement', 'locataire')),
  entite_type text,
  entite_id uuid,
  auteur uuid references public.profils (id) on delete set null,
  description text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 13. taux_change — historique des taux ; la date est TOUJOURS affichée
--     à côté d'un total converti, jamais présentée comme « en direct ».
-- ---------------------------------------------------------------------------
create table if not exists public.taux_change (
  id uuid primary key default gen_random_uuid(),
  devise_source text not null,
  devise_cible text not null,
  taux numeric(18,6) not null check (taux > 0),
  date_taux timestamptz not null,
  source text not null default 'auto' check (source in ('auto', 'manuel')),
  created_at timestamptz not null default now()
);
create index if not exists idx_taux_change_paire_date
  on public.taux_change (devise_source, devise_cible, date_taux desc);

-- ---------------------------------------------------------------------------
-- 14. abonnements — 1 abonnement actif par propriétaire.
--     Essai : 30 jours, plan Pro, sans carte (spec §12).
-- ---------------------------------------------------------------------------
create table if not exists public.abonnements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  plan text not null default 'pro' check (plan in ('starter', 'pro', 'agence')),
  grille text not null default 'internationale'
    check (grille in ('afrique', 'internationale')),
  statut text not null default 'essai'
    check (statut in ('essai', 'actif', 'lecture_seule', 'annule')),
  debut_periode timestamptz not null default now(),
  fin_periode timestamptz,
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  mobile_money_ref text,
  created_at timestamptz not null default now()
);
-- Un seul abonnement essai/actif à la fois par propriétaire.
create unique index if not exists idx_abonnements_un_actif
  on public.abonnements (owner_id) where statut in ('essai', 'actif');

-- ---------------------------------------------------------------------------
-- 15. TABLE TECHNIQUE SUPPLÉMENTAIRE (hors spec §13) : gestionnaires_immeubles
--     Pourquoi : la spec §2 exige que chaque gestionnaire soit limité aux
--     immeubles qu'on lui confie, mais AUCUNE des 14 tables ne porte cette
--     affectation (profils n'a pas de lien immeuble, immeubles n'a pas de
--     gestionnaire). Sans cette table de jonction, l'isolation « gestionnaire »
--     ne peut pas être appliquée en RLS. Choix : table de jonction à clé
--     composite (profil_id, immeuble_id), gérée par le propriétaire uniquement.
-- ---------------------------------------------------------------------------
create table if not exists public.gestionnaires_immeubles (
  profil_id uuid not null references public.profils (id) on delete cascade,
  immeuble_id uuid not null references public.immeubles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profil_id, immeuble_id)
);

-- ============================================================================
-- INDEX (clés étrangères et requêtes courantes)
-- ============================================================================
create index if not exists idx_immeubles_owner on public.immeubles (owner_id);
create index if not exists idx_appartements_immeuble on public.appartements (immeuble_id);
create index if not exists idx_locataires_owner on public.locataires (owner_id);
create index if not exists idx_baux_appartement on public.baux (appartement_id);
create index if not exists idx_baux_locataire on public.baux (locataire_id);
create index if not exists idx_baux_statut on public.baux (statut);
create index if not exists idx_loyers_bail_mois on public.loyers (bail_id, mois);
create index if not exists idx_loyers_statut on public.loyers (statut);
create index if not exists idx_paiements_echeance on public.paiements (echeance_id);
create index if not exists idx_depenses_immeuble on public.depenses (immeuble_id, date);
create index if not exists idx_depenses_owner on public.depenses (owner_id);
create index if not exists idx_documents_entite on public.documents (entite_type, entite_id);
create index if not exists idx_alertes_owner_statut on public.alertes (owner_id, statut);
create index if not exists idx_activites_owner on public.activites (owner_id, created_at desc);
create index if not exists idx_coproprietaires_immeuble on public.coproprietaires (immeuble_id);
create index if not exists idx_abonnements_owner on public.abonnements (owner_id);

-- ============================================================================
-- TRIGGER : à l'inscription, créer le profil + l'abonnement d'essai
-- (plan Pro, 30 jours, sans carte — spec §3 étape 1 et §12).
-- Les métadonnées d'inscription (nom, pays, devise_principale, langue)
-- sont transmises par le code d'inscription dans auth.users.raw_user_meta_data.
-- SECURITY DEFINER : le trigger contourne la RLS pour créer ces deux lignes.
-- ============================================================================
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
  v_grille text := case
    -- Grille déterminée par le pays du compte à l'inscription (spec §12).
    -- Liste Afrique : à ajuster si besoin ; par défaut : internationale.
    when v_pays in ('Burundi','Rwanda','République démocratique du Congo','Congo','Kenya','Tanzanie','Ouganda','Cameroun','Sénégal','Côte d''Ivoire','Mali','Burkina Faso','Bénin','Togo','Gabon','Tchad','Niger','Guinée','Madagascar','Éthiopie','Ghana','Nigeria','Angola','Zambie','Zimbabwe','Mozambique','Afrique du Sud','Maroc','Algérie','Tunisie','Égypte')
    then 'afrique' else 'internationale' end;
begin
  insert into public.profils (id, nom, email, pays, langue, devise_principale, role)
  values (new.id, v_nom, new.email, v_pays, v_langue, v_devise, 'proprietaire')
  on conflict (id) do nothing;

  insert into public.abonnements (owner_id, plan, grille, statut, debut_periode, fin_periode, trial_ends_at)
  values (new.id, 'pro', v_grille, 'essai', now(), now() + interval '30 days', now() + interval '30 days')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- RLS — ACTIVÉE SUR TOUTES LES TABLES (spec §14 : l'isolation est appliquée
-- dans la base elle-même, pas seulement à l'écran).
--
-- Rôles :
--  * propriétaire : owner_id = auth.uid() (ou via l'immeuble parent) — tout.
--  * gestionnaire : lecture/écriture limitées à ses immeubles via
--    gestionnaires_immeubles ; JAMAIS l'abonnement, jamais les autres biens.
--  * co-propriétaire : lecture seule sur ses immeubles via coproprietaires
--    (jointure sur profils.email = coproprietaires.email).
--  * locataire : AUCUN accès base — lien sécurisé applicatif, hors RLS.
-- Les fonctions service_role / postgres contournent la RLS (triggers, tâches).
-- ============================================================================

alter table public.profils enable row level security;
alter table public.immeubles enable row level security;
alter table public.appartements enable row level security;
alter table public.locataires enable row level security;
alter table public.baux enable row level security;
alter table public.loyers enable row level security;
alter table public.paiements enable row level security;
alter table public.depenses enable row level security;
alter table public.documents enable row level security;
alter table public.alertes enable row level security;
alter table public.coproprietaires enable row level security;
alter table public.activites enable row level security;
alter table public.taux_change enable row level security;
alter table public.abonnements enable row level security;
alter table public.gestionnaires_immeubles enable row level security;

-- --- Helpers : un immeuble appartient-il à l'utilisateur / lui est-il confié ?
-- (fonctions SECURITY DEFINER pour éviter la récursion RLS entre tables)
create or replace function public.est_proprietaire_immeuble(p_immeuble_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.immeubles i
    where i.id = p_immeuble_id and i.owner_id = auth.uid()
  );
$$;

create or replace function public.est_gestionnaire_immeuble(p_immeuble_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.gestionnaires_immeubles g
    where g.immeuble_id = p_immeuble_id and g.profil_id = auth.uid()
  );
$$;

create or replace function public.est_coproprietaire_immeuble(p_immeuble_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.coproprietaires c
    join public.profils p on p.email = c.email
    where c.immeuble_id = p_immeuble_id and p.id = auth.uid()
  );
$$;

create or replace function public.immeuble_visible(p_immeuble_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.est_proprietaire_immeuble(p_immeuble_id)
      or public.est_gestionnaire_immeuble(p_immeuble_id)
      or public.est_coproprietaire_immeuble(p_immeuble_id);
$$;

-- --- profils : chacun ne voit que son propre profil (lecture/écriture) ---
drop policy if exists profils_select_own on public.profils;
create policy profils_select_own on public.profils
  for select using (id = auth.uid());
drop policy if exists profils_update_own on public.profils;
create policy profils_update_own on public.profils
  for update using (id = auth.uid()) with check (id = auth.uid());
-- (l'INSERT est fait par le trigger handle_new_user, pas par le client.)

-- --- immeubles ---
drop policy if exists immeubles_select on public.immeubles;
create policy immeubles_select on public.immeubles
  for select using (public.immeuble_visible(id));
drop policy if exists immeubles_insert_owner on public.immeubles;
create policy immeubles_insert_owner on public.immeubles
  for insert with check (owner_id = auth.uid());
drop policy if exists immeubles_update on public.immeubles;
create policy immeubles_update on public.immeubles
  for update using (public.est_proprietaire_immeuble(id) or public.est_gestionnaire_immeuble(id))
  with check (public.est_proprietaire_immeuble(id) or public.est_gestionnaire_immeuble(id));
drop policy if exists immeubles_delete_owner on public.immeubles;
create policy immeubles_delete_owner on public.immeubles
  for delete using (owner_id = auth.uid());

-- --- appartements (via l'immeuble parent) ---
drop policy if exists appartements_select on public.appartements;
create policy appartements_select on public.appartements
  for select using (public.immeuble_visible(immeuble_id));
drop policy if exists appartements_insert on public.appartements;
create policy appartements_insert on public.appartements
  for insert with check (public.est_proprietaire_immeuble(immeuble_id) or public.est_gestionnaire_immeuble(immeuble_id));
drop policy if exists appartements_update on public.appartements;
create policy appartements_update on public.appartements
  for update using (public.est_proprietaire_immeuble(immeuble_id) or public.est_gestionnaire_immeuble(immeuble_id))
  with check (public.est_proprietaire_immeuble(immeuble_id) or public.est_gestionnaire_immeuble(immeuble_id));
drop policy if exists appartements_delete_owner on public.appartements;
create policy appartements_delete_owner on public.appartements
  for delete using (public.est_proprietaire_immeuble(immeuble_id));

-- --- locataires (owner_id direct ; gestionnaire via le bail/appartement :
--     lecture seule si le locataire a un bail dans un de ses immeubles) ---
drop policy if exists locataires_select on public.locataires;
create policy locataires_select on public.locataires
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.baux b
      join public.appartements a on a.id = b.appartement_id
      where b.locataire_id = locataires.id
        and public.est_gestionnaire_immeuble(a.immeuble_id)
    )
  );
drop policy if exists locataires_write_owner on public.locataires;
create policy locataires_write_owner on public.locataires
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- --- baux (via l'appartement) ---
drop policy if exists baux_select on public.baux;
create policy baux_select on public.baux
  for select using (
    exists (select 1 from public.appartements a where a.id = baux.appartement_id and public.immeuble_visible(a.immeuble_id))
  );
drop policy if exists baux_write on public.baux;
create policy baux_write on public.baux
  for all using (
    exists (select 1 from public.appartements a where a.id = baux.appartement_id
      and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
  ) with check (
    exists (select 1 from public.appartements a where a.id = baux.appartement_id
      and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
  );

-- --- loyers / échéances (via bail → appartement) ---
drop policy if exists loyers_select on public.loyers;
create policy loyers_select on public.loyers
  for select using (
    exists (select 1 from public.baux b join public.appartements a on a.id = b.appartement_id
      where b.id = loyers.bail_id and public.immeuble_visible(a.immeuble_id))
  );
drop policy if exists loyers_write on public.loyers;
create policy loyers_write on public.loyers
  for all using (
    exists (select 1 from public.baux b join public.appartements a on a.id = b.appartement_id
      where b.id = loyers.bail_id
        and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
  ) with check (
    exists (select 1 from public.baux b join public.appartements a on a.id = b.appartement_id
      where b.id = loyers.bail_id
        and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
  );

-- --- paiements (via échéance → bail → appartement) ---
drop policy if exists paiements_select on public.paiements;
create policy paiements_select on public.paiements
  for select using (
    exists (select 1 from public.loyers l join public.baux b on b.id = l.bail_id
      join public.appartements a on a.id = b.appartement_id
      where l.id = paiements.echeance_id and public.immeuble_visible(a.immeuble_id))
  );
drop policy if exists paiements_write on public.paiements;
create policy paiements_write on public.paiements
  for all using (
    exists (select 1 from public.loyers l join public.baux b on b.id = l.bail_id
      join public.appartements a on a.id = b.appartement_id
      where l.id = paiements.echeance_id
        and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
  ) with check (
    exists (select 1 from public.loyers l join public.baux b on b.id = l.bail_id
      join public.appartements a on a.id = b.appartement_id
      where l.id = paiements.echeance_id
        and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
  );

-- --- depenses ---
drop policy if exists depenses_select on public.depenses;
create policy depenses_select on public.depenses
  for select using (public.immeuble_visible(immeuble_id));
drop policy if exists depenses_write on public.depenses;
create policy depenses_write on public.depenses
  for all using (
    owner_id = auth.uid()
    or public.est_gestionnaire_immeuble(immeuble_id)
  ) with check (
    owner_id = auth.uid()
    or public.est_gestionnaire_immeuble(immeuble_id)
  );

-- --- documents ---
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select using (
    owner_id = auth.uid()
    or (entite_type = 'immeuble' and public.immeuble_visible(entite_id))
    or (entite_type = 'appartement' and exists (select 1 from public.appartements a where a.id = entite_id and public.immeuble_visible(a.immeuble_id)))
  );
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- --- alertes : lecture propriétaire + gestionnaire de l'immeuble concerné ;
--     écriture propriétaire uniquement (les alertes sont créées par le système) ---
drop policy if exists alertes_select on public.alertes;
create policy alertes_select on public.alertes
  for select using (
    owner_id = auth.uid()
    or (entite_type = 'immeuble' and public.est_gestionnaire_immeuble(entite_id))
  );
drop policy if exists alertes_update_owner on public.alertes;
create policy alertes_update_owner on public.alertes
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- --- coproprietaires : le propriétaire administre ; lecture pour le concerné ---
drop policy if exists coproprietaires_select on public.coproprietaires;
create policy coproprietaires_select on public.coproprietaires
  for select using (
    public.est_proprietaire_immeuble(immeuble_id)
    or public.est_gestionnaire_immeuble(immeuble_id)
    or exists (select 1 from public.profils p where p.id = auth.uid() and p.email = coproprietaires.email)
  );
drop policy if exists coproprietaires_write_owner on public.coproprietaires;
create policy coproprietaires_write_owner on public.coproprietaires
  for all using (public.est_proprietaire_immeuble(immeuble_id))
  with check (public.est_proprietaire_immeuble(immeuble_id));

-- --- activites (fil) : lecture selon visibilité ; écriture via trigger/service ---
drop policy if exists activites_select on public.activites;
create policy activites_select on public.activites
  for select using (
    owner_id = auth.uid()
    or (entite_type = 'immeuble' and public.est_gestionnaire_immeuble(entite_id))
  );

-- --- taux_change : lecture pour tout utilisateur connecté ; écriture réservée
--     au service_role (tâche automatique) et aux insertions manuelles via
--     fonction sécurisée ultérieure — aucun INSERT direct par le client. ---
drop policy if exists taux_change_select on public.taux_change;
create policy taux_change_select on public.taux_change
  for select using (auth.uid() is not null);

-- --- abonnements : propriétaire uniquement, jamais gestionnaire/co-propriétaire ---
drop policy if exists abonnements_select_own on public.abonnements;
create policy abonnements_select_own on public.abonnements
  for select using (owner_id = auth.uid());
drop policy if exists abonnements_update_own on public.abonnements;
create policy abonnements_update_own on public.abonnements
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- (l'INSERT initial est fait par le trigger handle_new_user.)

-- --- gestionnaires_immeubles : le propriétaire gère les affectations ;
--     un gestionnaire voit ses propres lignes. ---
drop policy if exists gest_immeubles_select on public.gestionnaires_immeubles;
create policy gest_immeubles_select on public.gestionnaires_immeubles
  for select using (
    profil_id = auth.uid() or public.est_proprietaire_immeuble(immeuble_id)
  );
drop policy if exists gest_immeubles_write_owner on public.gestionnaires_immeubles;
create policy gest_immeubles_write_owner on public.gestionnaires_immeubles
  for all using (public.est_proprietaire_immeuble(immeuble_id))
  with check (public.est_proprietaire_immeuble(immeuble_id));

-- ============================================================================
-- FIN DU SCHÉMA — Module 1.
-- Vérifications après exécution :
--   select count(*) from pg_tables where schemaname = 'public'; -- 15 tables
--   select tablename from pg_tables where schemaname='public' and rowsecurity;
-- ============================================================================

-- ============================================================================
-- MODULE 4 — compléments (spec §6, §9, §10, §14).
-- Idempotent (IF NOT EXISTS) : peut être rejoué sans risque.
-- ============================================================================

-- Profil : téléphone (Paramètres — profil).
alter table if exists public.profils
  add column if not exists telephone text;

-- Documents : taille et type MIME (affichés dans la liste, spec §7).
alter table if exists public.documents
  add column if not exists taille_octets bigint;
alter table if exists public.documents
  add column if not exists mime_type text;

-- Alertes : clé d'idempotence (pas de doublon pour le même événement),
-- urgence, statut e-mail (jamais de faux envoi — spec §10) et date de clôture.
alter table if exists public.alertes
  add column if not exists dedup_key text;
alter table if exists public.alertes
  add column if not exists urgence text not null default 'moyenne'
  check (urgence in ('haute', 'moyenne', 'basse'));
alter table if exists public.alertes
  add column if not exists email_statut text not null default 'non_configuré'
  check (email_statut in ('non_configuré', 'envoye', 'echec', 'desactive'));
alter table if exists public.alertes
  add column if not exists traitee_le timestamptz;
create unique index if not exists idx_alertes_dedup
  on public.alertes (dedup_key) where dedup_key is not null;

-- Préférences de notifications (une ligne par propriétaire).
create table if not exists public.preferences_notifications (
  owner_id uuid primary key references public.profils (id) on delete cascade,
  types_coupes text[] not null default '{}',
  canal_app boolean not null default true,
  canal_email boolean not null default true,
  seuil_vacance_jours integer not null default 30 check (seuil_vacance_jours >= 7),
  updated_at timestamptz not null default now()
);
alter table public.preferences_notifications enable row level security;
drop policy if exists prefs_select_own on public.preferences_notifications;
create policy prefs_select_own on public.preferences_notifications
  for select using (owner_id = auth.uid());
drop policy if exists prefs_write_own on public.preferences_notifications;
create policy prefs_write_own on public.preferences_notifications
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Invitations de gestionnaires : l'invitation par e-mail précède la création
-- du compte gestionnaire ; le retrait supprime la ligne = perte d'accès
-- immédiate (spec §14). L'affectation aux immeubles devient effective quand
-- le gestionnaire crée son compte (module ultérieur).
create table if not exists public.invitations_gestionnaires (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  email text not null,
  nom text,
  immeuble_ids uuid[] not null default '{}',
  statut text not null default 'invite' check (statut in ('invite', 'actif')),
  created_at timestamptz not null default now(),
  unique (owner_id, email)
);
alter table public.invitations_gestionnaires enable row level security;
drop policy if exists invit_gest_owner on public.invitations_gestionnaires;
create policy invit_gest_owner on public.invitations_gestionnaires
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Taux manuels : le propriétaire peut insérer ses taux de secours datés
-- (la lecture était déjà ouverte à tout utilisateur connecté).
drop policy if exists taux_change_insert_auth on public.taux_change;
create policy taux_change_insert_auth on public.taux_change
  for insert with check (auth.uid() is not null and source = 'manuel');

-- ============================================================================
-- MODULE 6 — Indivision, vitrine publique, WhatsApp, taux automatiques
-- (spec v1.1 §6 suite, §4, §9, §10, §13, §14). À exécuter dans l'éditeur SQL
-- de Supabase, après les sections précédentes. Idempotent (IF NOT EXISTS /
-- DROP POLICY IF EXISTS) : peut être relancé sans danger.
-- ============================================================================

-- --- profils : téléphone / WhatsApp du propriétaire (alertes + vitrine) ---
alter table if exists public.profils
  add column if not exists telephone text;

-- --- immeubles : passeport — date de la dernière estimation + mode d'acquisition ---
alter table if exists public.immeubles
  add column if not exists date_estimation date;
alter table if exists public.immeubles
  add column if not exists mode_acquisition text;

-- --- coproprietaires : statut de l'invitation (invite -> actif) ---
alter table if exists public.coproprietaires
  add column if not exists statut text not null default 'invite'
  check (statut in ('invite', 'actif'));

-- --- alertes : statut d'envoi WhatsApp (jamais de faux envoi) ---
alter table if exists public.alertes
  add column if not exists whatsapp_statut text not null default 'non_configuré'
  check (whatsapp_statut in ('non_configuré', 'envoye', 'echec', 'desactive'));

-- --- preferences_notifications : canal WhatsApp (spec §10) ---
alter table if exists public.preferences_notifications
  add column if not exists canal_whatsapp boolean not null default true;

-- --- taux_change : insertion des taux automatiques par un utilisateur
--     connecté (taux publics de référence, sans donnée de propriétaire).
--     Les taux manuels restent couverts par taux_change_insert_auth.
drop policy if exists taux_change_insert_auto_auth on public.taux_change;
create policy taux_change_insert_auto_auth on public.taux_change
  for insert with check (auth.uid() is not null and source = 'auto');

-- --- locataires : un co-propriétaire peut lire (noms seulement, les
--     coordonnées sont masquées côté application) les locataires des
--     baux de ses biens partagés. Aucune écriture pour lui.
drop policy if exists locataires_select on public.locataires;
create policy locataires_select on public.locataires
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.baux b
      join public.appartements a on a.id = b.appartement_id
      where b.locataire_id = locataires.id
        and public.est_gestionnaire_immeuble(a.immeuble_id)
    )
    or exists (
      select 1 from public.baux b
      join public.appartements a on a.id = b.appartement_id
      where b.locataire_id = locataires.id
        and public.est_coproprietaire_immeuble(a.immeuble_id)
    )
  );

-- --- Vitrine publique « à louer » (spec §4, §6) : lecture ANONYME,
--     limitée aux appartements publiés (vitrine = true), vacants ou
--     réservés, et à leurs immeubles. AUCUNE donnée de locataire n'est
--     exposée par ces politiques (les locataires restent hors RLS anon).
drop policy if exists appartements_select_public on public.appartements;
create policy appartements_select_public on public.appartements
  for select to anon using (
    vitrine = true and statut in ('vacant', 'reserve') and archive = false
  );
drop policy if exists immeubles_select_public on public.immeubles;
create policy immeubles_select_public on public.immeubles
  for select to anon using (
    exists (
      select 1 from public.appartements a
      where a.immeuble_id = immeubles.id
        and a.vitrine = true and a.statut in ('vacant', 'reserve') and a.archive = false
    )
  );
-- Contact public du propriétaire : nom, e-mail et téléphone du propriétaire
-- d'un immeuble qui a au moins une annonce publiée (rien d'autre).
drop policy if exists profils_select_vitrine on public.profils;
create policy profils_select_vitrine on public.profils
  for select to anon using (
    exists (
      select 1 from public.immeubles i
      join public.appartements a on a.immeuble_id = i.id
      where i.owner_id = profils.id
        and a.vitrine = true and a.statut in ('vacant', 'reserve') and a.archive = false
    )
  );

-- --- Lien locataire (Correctif 1, spec §2, §14) : accès lecture seule par
--     jeton, sans connexion. Fonction SECURITY DEFINER : seul le locataire
--     dont le jeton correspond ET n'est pas expiré est retourné, avec son
--     bail en cours, ses échéances, ses paiements et ses reçus. AUCUNE
--     table n'est exposée en lecture anonyme (les locataires restent hors
--     RLS anon) : un jeton inconnu, expiré ou révoqué retourne NULL, sans
--     aucune donnée. Seul l'appel RPC est autorisé (grant execute to anon).
create or replace function public.acces_locataire_par_token(p_token text)
returns jsonb
language sql security definer stable
set search_path = public as $$
  with loc as (
    select l.* from public.locataires l
    where l.lien_token = p_token
      and l.lien_token is not null
      and l.lien_expire_le is not null
      and l.lien_expire_le > now()
  ),
  bc as (
    select b.* from public.baux b
    where b.locataire_id = (select id from loc)
      and b.statut = 'actif'
    order by b.debut desc
    limit 1
  ),
  apt as (
    select a.* from public.appartements a
    where a.id = (select appartement_id from bc)
  ),
  imm as (
    select i.* from public.immeubles i
    where i.id = (select immeuble_id from apt)
  ),
  ech as (
    select e.* from public.loyers e
    where e.bail_id = (select id from bc)
  ),
  pay as (
    select pa.* from public.paiements pa
    where pa.echeance_id in (select id from ech)
  )
  select
    case
      when not exists (select 1 from loc) then null
      else jsonb_build_object(
        'locataire', (select to_jsonb(l) from loc l),
        'bail', (select to_jsonb(b) from bc b),
        'appartement_numero', (select numero from apt),
        'immeuble_nom', (select nom from imm),
        'emetteur_nom', (select nom from public.profils where id = (select owner_id from loc)),
        'echeances', coalesce((select jsonb_agg(to_jsonb(e)) from ech e), '[]'::jsonb),
        'paiements', coalesce((select jsonb_agg(to_jsonb(pa)) from pay pa), '[]'::jsonb),
        'recus', coalesce((
          select jsonb_agg(jsonb_build_object(
            'numero', pa.recu_numero,
            'paiement_id', pa.id,
            'echeance_id', pa.echeance_id,
            'bail_id', e.bail_id,
            'locataire_id', (select id from loc),
            'locataire_nom', (select nom from loc),
            'locataire_telephone', (select telephone from loc),
            'locataire_email', (select email from loc),
            'immeuble_nom', (select nom from imm),
            'appartement_numero', (select numero from apt),
            'mois', e.mois,
            'montant', pa.montant,
            'devise', pa.devise,
            'moyen', pa.moyen,
            'date_paiement', pa.date_paiement,
            'date_emission', pa.created_at,
            'reference', pa.reference,
            'statut', pa.statut
          ) order by pa.date_paiement desc, pa.recu_numero desc)
          from pay pa
          join ech e on e.id = pa.echeance_id
          where pa.recu_numero is not null
        ), '[]'::jsonb)
      )
    end;
$$;
grant execute on function public.acces_locataire_par_token(text) to anon, authenticated;

-- --- Trigger d'inscription : un e-mail invité en indivision devient un
--     compte coproprietaire (lecture seule, sans abonnement d'essai).
--     Un compte existant peut aussi être rattaché (même e-mail).
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
  v_role text := case when exists (
    select 1 from public.coproprietaires c where lower(c.email) = lower(new.email)
  ) then 'coproprietaire' else 'proprietaire' end;
  v_grille text := case
    when v_pays in ('Burundi','Rwanda','République démocratique du Congo','Congo','Kenya','Tanzanie','Ouganda','Cameroun','Sénégal','Côte d''Ivoire','Mali','Burkina Faso','Bénin','Togo','Gabon','Tchad','Niger','Guinée','Madagascar','Éthiopie','Ghana','Nigeria','Angola','Zambie','Zimbabwe','Mozambique','Afrique du Sud','Maroc','Algérie','Tunisie','Égypte')
    then 'afrique' else 'internationale' end;
begin
  insert into public.profils (id, nom, email, pays, langue, devise_principale, role)
  values (new.id, v_nom, new.email, v_pays, v_langue, v_devise, v_role)
  on conflict (id) do nothing;

  -- Abonnement d'essai Pro 30 jours : propriétaires uniquement.
  if v_role = 'proprietaire' then
    insert into public.abonnements (owner_id, plan, grille, statut, debut_periode, fin_periode, trial_ends_at)
    values (new.id, 'pro', v_grille, 'essai', now(), now() + interval '30 days', now() + interval '30 days')
    on conflict do nothing;
  end if;

  -- Invitation d'indivision acceptée d'office quand le compte est créé
  -- avec l'e-mail invité (accès lecture seule sur les biens partagés).
  if v_role = 'coproprietaire' then
    update public.coproprietaires set statut = 'actif'
    where lower(email) = lower(new.email);
  end if;

  return new;
end;
$$;
