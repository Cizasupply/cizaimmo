-- ============================================================================
-- CizaImmo — MODULE 5 : abonnement & facturation (spec §12).
-- À exécuter UNE FOIS dans le SQL Editor de Supabase, APRÈS
-- supabase/schema.sql. Idempotent (if not exists / if exists).
--
--  1. Colonnes de fin de période sur abonnements :
--     descente programmée, résiliation programmée, grâce d'échec de
--     paiement, conservation 90 jours en lecture seule.
--  2. Table factures_abonnement : historique des factures (Stripe en
--     réel, enregistrements locaux en démo).
--  3. Table paiements_mobile_money : demandes EcoCash / Lumicash /
--     eNoti, confirmées uniquement après confirmation reçue (webhook).
-- ============================================================================

-- --- 1. Colonnes de fin de période ------------------------------------------
alter table public.abonnements
  add column if not exists plan_en_attente text
    check (plan_en_attente is null or plan_en_attente in ('starter', 'pro', 'agence'));
alter table public.abonnements
  add column if not exists date_effet_plan timestamptz;
alter table public.abonnements
  add column if not exists resiliation_programmee boolean not null default false;
alter table public.abonnements
  add column if not exists echec_paiement boolean not null default false;
alter table public.abonnements
  add column if not exists grace_ends_at timestamptz;
alter table public.abonnements
  add column if not exists lecture_seule_jusqu_au timestamptz;

-- --- 2. Factures d'abonnement -----------------------------------------------
create table if not exists public.factures_abonnement (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  numero text not null, -- CIM-ABO-AAAA-0001
  plan text not null check (plan in ('starter', 'pro', 'agence')),
  grille text not null check (grille in ('afrique', 'internationale')),
  montant numeric(10, 2) not null check (montant > 0), -- USD, prix mensuel (§12)
  devise text not null default 'USD',
  date_emission timestamptz not null default now(),
  date_debut timestamptz not null,
  date_fin timestamptz not null,
  moyen text not null check (moyen in ('stripe', 'mobile_money', 'demo')),
  statut text not null default 'payee' check (statut in ('payee', 'en_attente', 'annulee')),
  stripe_invoice_id text,
  reference_mobile_money text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_factures_abo_numero
  on public.factures_abonnement (owner_id, numero);
create index if not exists idx_factures_abo_owner
  on public.factures_abonnement (owner_id, date_emission desc);

-- --- 3. Paiements mobile money ----------------------------------------------
create table if not exists public.paiements_mobile_money (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profils (id) on delete cascade,
  operateur text not null check (operateur in ('ecocash', 'lumicash', 'enoti')),
  telephone text not null,
  montant numeric(10, 2) not null check (montant > 0), -- USD, prix mensuel
  plan text not null check (plan in ('starter', 'pro', 'agence')),
  reference text not null, -- MM-XXXXXXXX
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'confirme', 'annule', 'expire')),
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null, -- cree_le + 24 h
  confirme_le timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_paiements_mm_reference
  on public.paiements_mobile_money (reference);
create index if not exists idx_paiements_mm_owner
  on public.paiements_mobile_money (owner_id, cree_le desc);

-- --- RLS : propriétaire uniquement ------------------------------------------
alter table public.factures_abonnement enable row level security;
alter table public.paiements_mobile_money enable row level security;

drop policy if exists "factures_abo_proprietaire" on public.factures_abonnement;
create policy "factures_abo_proprietaire" on public.factures_abonnement
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "paiements_mm_proprietaire" on public.paiements_mobile_money;
create policy "paiements_mm_proprietaire" on public.paiements_mobile_money
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
