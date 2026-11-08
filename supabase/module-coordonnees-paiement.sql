-- ============================================================================
-- CizaImmo — Coordonnées de PAIEMENT de l'employé (2026-11-08, ajout
-- VALIDÉ par le fondateur, modèle précisé par lui).
--
-- Modèle décidé : les coordonnées BANCAIRES COMPLÈTES où l'employé
-- (Admin / Super Admin) reçoit son salaire, STRUCTURÉES selon le
-- moyen, renseignées DANS SON DOSSIER :
--  - toujours : moyen + nom du titulaire ;
--  - virement : nom de la banque + numéro de compte (requis) ;
--    agence, IBAN et SWIFT/BIC OPTIONNELS (toutes les banques
--    locales ne les utilisent pas) ;
--  - mobile money : opérateur (EcoCash, Lumicash, eNoti, Orange
--    Money…) + numéro mobile ;
--  - espèces : aucun champ supplémentaire.
--
-- Les coordonnées vivent sur la ligne `profils` (colonnes
-- nullables), comme l'adresse du dossier employé
-- (module-dossier-employe.sql) : AUCUNE politique nouvelle — les
-- lectures passent par les politiques `profils` existantes.
-- La complétude est CALCULÉE par l'application (fonction pure de
-- lib/finances-plateforme.ts : moyen + titulaire + champs requis du
-- moyen) et ne conditionne QUE l'émission de la paie : elle ne
-- change NI la complétude du dossier employé (4 éléments) NI les
-- règles de la carte employé (décision explicite du fondateur).
--
-- À l'émission, la paie FIGE la destination utilisée : moyen copié
-- + instantané texte composé des champs pertinents du moyen
-- (colonnes sur `paies_employes`) — un changement ultérieur du
-- profil ne réécrit jamais l'historique des paies.
--
-- RÉTROACTIVITÉ : les colonnes naissent NULL — aucun employé actuel
-- n'a de coordonnées tant qu'il ne les a pas renseignées (son
-- émission de paie sera refusée avec
-- ERR_COORDONNEES_PAIEMENT_MANQUANTES tant qu'elles manquent), et
-- les paies déjà émises n'ont ni moyen ni destination figés (NULL :
-- rien n'est inventé a posteriori).
--
-- Idempotent : réexécutable sans effet de bord. À appliquer APRÈS
-- module-dossier-employe.sql (adresse sur profils) et
-- module-finances-plateforme.sql (table paies_employes).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Coordonnées de paiement sur le dossier employé (ligne profils).
-- ----------------------------------------------------------------------------
alter table public.profils
  add column if not exists paiement_moyen text
    check (paiement_moyen in ('virement', 'mobile_money', 'especes'));
alter table public.profils
  add column if not exists paiement_titulaire text;
-- Virement bancaire.
alter table public.profils
  add column if not exists paiement_banque text;
alter table public.profils
  add column if not exists paiement_agence text;
alter table public.profils
  add column if not exists paiement_numero_compte text;
alter table public.profils
  add column if not exists paiement_iban text;
alter table public.profils
  add column if not exists paiement_swift text;
-- Mobile money.
alter table public.profils
  add column if not exists paiement_operateur text;
alter table public.profils
  add column if not exists paiement_numero_mobile text;

comment on column public.profils.paiement_moyen is
  'Coordonnées de paiement de l''employé (2026-11-08) : moyen de réception du salaire — virement / mobile_money / especes. Conditionne uniquement l''émission de la paie (complétude calculée côté application).';
comment on column public.profils.paiement_titulaire is
  'Coordonnées de paiement de l''employé : nom du titulaire du compte ou du numéro (toujours requis).';
comment on column public.profils.paiement_banque is
  'Coordonnées de paiement de l''employé — virement : nom de la banque (requis en virement).';
comment on column public.profils.paiement_agence is
  'Coordonnées de paiement de l''employé — virement : agence (OPTIONNEL).';
comment on column public.profils.paiement_numero_compte is
  'Coordonnées de paiement de l''employé — virement : numéro de compte (requis en virement).';
comment on column public.profils.paiement_iban is
  'Coordonnées de paiement de l''employé — virement : IBAN (OPTIONNEL).';
comment on column public.profils.paiement_swift is
  'Coordonnées de paiement de l''employé — virement : code SWIFT / BIC (OPTIONNEL).';
comment on column public.profils.paiement_operateur is
  'Coordonnées de paiement de l''employé — mobile money : opérateur (EcoCash, Lumicash, eNoti, Orange Money…) (requis en mobile money).';
comment on column public.profils.paiement_numero_mobile is
  'Coordonnées de paiement de l''employé — mobile money : numéro mobile (requis en mobile money).';

-- ----------------------------------------------------------------------------
-- 2. Instantané de la destination sur chaque paie émise.
-- ----------------------------------------------------------------------------
alter table public.paies_employes
  add column if not exists paiement_moyen text
    check (paiement_moyen in ('virement', 'mobile_money', 'especes'));
alter table public.paies_employes
  add column if not exists paiement_destination text;

comment on column public.paies_employes.paiement_moyen is
  'Moyen de paiement COPIÉ des coordonnées de l''employé au moment de l''émission (le fait est figé).';
comment on column public.paies_employes.paiement_destination is
  'Instantané texte de la destination utilisée à l''émission, composé des champs pertinents du moyen (ex. « Mobile money — EcoCash +257 79 00 00 00 — Barros Innocent ») — figé, jamais réécrit par un changement ultérieur du profil.';

-- ============================================================================
-- VÉRIFICATIONS (lecture seule, après application) :
--  V1. Les 9 colonnes coordonnées existent sur profils :
--      select column_name from information_schema.columns
--       where table_schema = 'public' and table_name = 'profils'
--         and column_name in ('paiement_moyen', 'paiement_titulaire',
--               'paiement_banque', 'paiement_agence',
--               'paiement_numero_compte', 'paiement_iban',
--               'paiement_swift', 'paiement_operateur',
--               'paiement_numero_mobile')
--       order by column_name;
--      -> 9 lignes.
--  V2. Les 2 colonnes instantané existent sur paies_employes :
--      select column_name from information_schema.columns
--       where table_schema = 'public' and table_name = 'paies_employes'
--         and column_name in ('paiement_moyen', 'paiement_destination')
--       order by column_name;
--      -> 2 lignes.
--  V3. Contraintes CHECK du moyen présentes (profils + paies) :
--      select conrelid::regclass::text as table_nom, count(*)
--        from pg_constraint
--       where contype = 'c'
--         and pg_get_constraintdef(oid) like '%mobile_money%'
--       group by conrelid order by table_nom;
--      -> 1 ligne pour profils, 1 ligne pour paies_employes.
--  V4. Rétroactivité — aucune coordonnée inventée : tous les comptes
--      plateforme sont à NULL tant que rien n'a été renseigné :
--      select count(*) from public.profils
--       where role in ('admin', 'super_admin')
--         and paiement_moyen is null and paiement_titulaire is null
--         and paiement_banque is null and paiement_numero_compte is null
--         and paiement_operateur is null
--         and paiement_numero_mobile is null;
--      -> égal au nombre de comptes admin + super_admin.
--  V5. Les CLIENTS ne sont pas touchés (aucune coordonnée côté
--      client) :
--      select count(*) from public.profils
--       where role not in ('admin', 'super_admin')
--         and (paiement_moyen is not null or paiement_titulaire is not null
--              or paiement_banque is not null
--              or paiement_numero_compte is not null
--              or paiement_operateur is not null
--              or paiement_numero_mobile is not null);
--      -> 0.
-- ============================================================================
