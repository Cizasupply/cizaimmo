-- ============================================================================
-- CizaImmo — MODULE FINANCE (extension v1.2) : tarifs et paramètres finance
-- DYNAMIQUES. RIEN EN DUR : le front public (page tarifs, accueil), la page
-- abonnement et la facturation lisent ces tables via la couche données.
-- Changer un prix ici (ou via la console Super Admin « Paramètres —
-- Finances ») change l'affichage sans redéploiement de code.
-- À exécuter UNE FOIS dans le SQL Editor de Supabase, APRÈS
-- supabase/schema.sql, supabase/module5.sql et supabase/module-admin.sql
-- (module-admin définit les helpers RLS est_admin_plateforme /
-- est_super_admin). Idempotent (insert ... on conflict do nothing :
-- un re-run ne réécrase JAMAIS un tarif déjà modifié par le fondateur).
-- Référence : docs/admin-finance-v1.2.md.
-- ============================================================================

-- --- 1. Tarifs de la plateforme -----------------------------------------------
-- Une ligne par (grille, plan). Prix mensuels en USD (numeric, jamais float).
create table if not exists public.tarifs_plateforme (
  id uuid primary key default gen_random_uuid(),
  grille text not null check (grille in ('afrique', 'internationale')),
  plan text not null check (plan in ('starter', 'pro', 'agence')),
  prix_mensuel numeric(10, 2) not null check (prix_mensuel > 0), -- USD
  devise text not null default 'USD',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profils (id),
  unique (grille, plan)
);

-- Seed : tarifs verrouillés v1.1 (spec §12). on conflict do nothing :
-- les modifications du fondateur ne sont jamais écrasées par un re-run.
insert into public.tarifs_plateforme (grille, plan, prix_mensuel) values
  ('afrique', 'starter', 1.99),
  ('afrique', 'pro', 5.99),
  ('afrique', 'agence', 11.99),
  ('internationale', 'starter', 4.99),
  ('internationale', 'pro', 14.99),
  ('internationale', 'agence', 29.99)
on conflict (grille, plan) do nothing;

-- --- 2. Paramètres finance (ligne unique) --------------------------------------
create table if not exists public.parametres_finance (
  id integer primary key default 1 check (id = 1), -- ligne unique
  remise_annuelle_pct numeric(5, 2) not null default 20 check (remise_annuelle_pct >= 0 and remise_annuelle_pct <= 100),
  jours_essai integer not null default 30 check (jours_essai > 0),
  jours_grace integer not null default 5 check (jours_grace >= 0),
  penalites_retard_actives boolean not null default false,
  -- Anti-fraude tarifaire : codes ISO des pays éligibles à la grille
  -- Afrique. Liste DYNAMIQUE éditable par le Super Admin (console
  -- « Paramètres — Finances ») — la matrice d'attribution (lib/grille.ts)
  -- la lit ici, jamais en dur dans le code.
  pays_grille_afrique text[] not null default array['BI','RW','CD','CG','KE','TZ','UG','CM','SN','CI','ML','BF','BJ','TG','GA','TD','NE','GN','MG','ET','GH','NG','AO','ZM','ZW','MZ','ZA','MA','DZ','TN','EG'],
  -- Approbation manuelle (ajout n°3) : délai affiché sur l'écran
  -- « en attente d'approbation » (texte libre, éditable Super Admin).
  delai_approbation_affiche text not null default '24 h ouvrées',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profils (id)
);
-- Idempotence : si la table existait déjà sans les colonnes.
alter table public.parametres_finance
  add column if not exists pays_grille_afrique text[] not null
  default array['BI','RW','CD','CG','KE','TZ','UG','CM','SN','CI','ML','BF','BJ','TG','GA','TD','NE','GN','MG','ET','GH','NG','AO','ZM','ZW','MZ','ZA','MA','DZ','TN','EG'];
alter table public.parametres_finance
  add column if not exists delai_approbation_affiche text not null default '24 h ouvrées';

insert into public.parametres_finance (id, remise_annuelle_pct, jours_essai, jours_grace, penalites_retard_actives, pays_grille_afrique, delai_approbation_affiche)
values (1, 20, 30, 5, false, array['BI','RW','CD','CG','KE','TZ','UG','CM','SN','CI','ML','BF','BJ','TG','GA','TD','NE','GN','MG','ET','GH','NG','AO','ZM','ZW','MZ','ZA','MA','DZ','TN','EG'], '24 h ouvrées')
on conflict (id) do nothing;

-- --- 3. RLS ----------------------------------------------------------------------
-- Les prix sont PUBLICS : lecture pour anon (front public sans connexion)
-- et authenticated. Écriture : Super Admin uniquement (les paramètres de
-- la plateforme sont réservés au fondateur — décisions verrouillées).
alter table public.tarifs_plateforme enable row level security;
alter table public.parametres_finance enable row level security;

drop policy if exists tarifs_select_public on public.tarifs_plateforme;
create policy tarifs_select_public on public.tarifs_plateforme
  for select using (true);
drop policy if exists tarifs_update_super_admin on public.tarifs_plateforme;
create policy tarifs_update_super_admin on public.tarifs_plateforme
  for update using (public.est_super_admin())
  with check (public.est_super_admin());

drop policy if exists parametres_finance_select_public on public.parametres_finance;
create policy parametres_finance_select_public on public.parametres_finance
  for select using (true);
drop policy if exists parametres_finance_update_super_admin on public.parametres_finance;
create policy parametres_finance_update_super_admin on public.parametres_finance
  for update using (public.est_super_admin())
  with check (public.est_super_admin());
