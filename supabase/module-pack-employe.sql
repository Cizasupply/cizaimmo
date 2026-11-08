-- ============================================================================
-- CizaImmo — Pack employé Admin : contrat d'engagement à deux voies,
-- charte de confidentialité datée, carte employé (2026-11-08, décision
-- du fondateur : « un contrat de travail à signer pour ce job et ses
-- tâches, confidentialités, carte employé » — pack validé en entier,
-- avec la voie hors Burundi validée le même jour).
--
-- Le pack se branche PAR-DESSUS le dossier employé (module-dossier-
-- employe.sql) : identité + adresse vivent déjà en base ; ce module
-- ajoute le suivi du CONTRAT D'ENGAGEMENT et de la CHARTE.
--
-- CONTRAT À DEUX VOIES (choix du Super Admin à la préparation) :
--   voie « travail »    — contrat de travail, employé au Burundi ;
--   voie « prestation » — contrat de prestation de services,
--                         collaborateur indépendant hors du Burundi.
-- Les champs employeur (type, durée, montant, devise, modalités de
-- paiement, lieu, horaires, date de début, période d'essai — voie
-- travail seulement) sont stockés EN BASE au moment de la
-- préparation ; le PDF personnalisé est régénéré à la demande à
-- partir de ces valeurs et du dossier employé (la base fait foi).
--
-- CYCLE (patron des contrats clients, colonnes DÉDIÉES) :
--   profils.statut_contrat_employe :
--     'sans_objet'   — contrat pas encore préparé par le Super Admin ;
--     'a_signer'     — préparé, PDF envoyé par e-mail à l'employé ;
--     'signe_depose' — contrat signé redéposé, en attente de revue ;
--     'valide'       — validé par le Super Admin ;
--     'refuse'       — refusé par le Super Admin (motif dans
--                      profils.motif_contrat_employe — redépôt possible).
-- NON BLOQUANT : aucun état du pack ne conditionne l'accès console
-- (comme le contrat propriétaires option C).
--
-- CHARTE DE CONFIDENTIALITÉ : acceptée à la première connexion
-- console ; profils.charte_acceptee_le horodate l'acceptation
-- (null = en attente). L'acceptation est définitive : jamais
-- réécrite une fois posée.
--
-- CARTE EMPLOYÉ : aucun statut stocké — elle est « émise » dès que
-- le dossier employé est COMPLET (calculé) ET le contrat VALIDÉ ;
-- le code-barres de la carte encode le Display ID et la vérification
-- se fait contre la base (voir la page console « Vérifier un
-- employé »). Un compte suspendu ne « passe » plus.
--
-- RÉTROACTIVITÉ : rien à basculer — tout compte admin / super_admin
-- existant démarre naturellement « sans_objet » (contrat non
-- préparé) et charte « en attente » ; la charte lui sera présentée à
-- sa prochaine connexion console. Cas connus au 2026-11-08 : le
-- fondateur CIM-000001 et le compte de test CIM-000003 (après sa
-- promotion Admin).
--
-- Aucune politique RLS nouvelle : les colonnes vivent sur profils,
-- dont les politiques existantes couvrent déjà les lectures et les
-- mises à jour du titulaire et de la plateforme (mêmes patrons que
-- module-contrat-proprietaire.sql). Aucune RPC : transitions
-- applicatives journalisées dans journal_audit par l'application
-- (contrat_employe_prepare / signe depose via le dépôt de document /
-- valide / refuse / charte_acceptee).
--
-- Idempotent : réexécutable sans effet de bord. À appliquer APRÈS
-- module-dossier-employe.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cycle du contrat d'engagement.
-- ----------------------------------------------------------------------------
alter table public.profils
  add column if not exists statut_contrat_employe text not null default 'sans_objet';

alter table public.profils
  add column if not exists motif_contrat_employe text;

alter table public.profils
  drop constraint if exists profils_statut_contrat_employe_check;
alter table public.profils
  add constraint profils_statut_contrat_employe_check
  check (statut_contrat_employe in
    ('sans_objet', 'a_signer', 'signe_depose', 'valide', 'refuse'));

-- ----------------------------------------------------------------------------
-- 2. Champs employeur du contrat (fixés par le Super Admin à la
--    préparation ; null tant que le contrat n'est pas préparé).
-- ----------------------------------------------------------------------------
alter table public.profils
  add column if not exists contrat_employe_voie text;

alter table public.profils
  drop constraint if exists profils_contrat_employe_voie_check;
alter table public.profils
  add constraint profils_contrat_employe_voie_check
  check (contrat_employe_voie is null or contrat_employe_voie in
    ('travail', 'prestation'));

alter table public.profils
  add column if not exists contrat_employe_type text,
  add column if not exists contrat_employe_duree text,
  add column if not exists contrat_employe_montant numeric,
  add column if not exists contrat_employe_devise text,
  add column if not exists contrat_employe_modalites text,
  add column if not exists contrat_employe_lieu text,
  add column if not exists contrat_employe_horaires text,
  add column if not exists contrat_employe_date_debut date,
  add column if not exists contrat_employe_periode_essai text,
  add column if not exists contrat_employe_prepare_le timestamptz;

comment on column public.profils.contrat_employe_voie is
  'Pack employé : voie du contrat d''engagement — ''travail'' (employé au Burundi) ou ''prestation'' (collaborateur indépendant hors Burundi).';
comment on column public.profils.contrat_employe_periode_essai is
  'Pack employé : période d''essai — voie « travail » uniquement (toujours null en voie « prestation »).';

-- ----------------------------------------------------------------------------
-- 3. Charte de confidentialité : acceptation datée (première
--    connexion console). Null = en attente d'acceptation.
-- ----------------------------------------------------------------------------
alter table public.profils
  add column if not exists charte_acceptee_le timestamptz;

comment on column public.profils.charte_acceptee_le is
  'Pack employé : date/heure d''acceptation de la charte de confidentialité console (posée une seule fois, jamais réécrite).';

-- ============================================================================
-- VÉRIFICATIONS (lecture seule, après application) :
--  V1. Colonnes présentes (14 lignes attendues) :
--      select column_name from information_schema.columns
--       where table_schema = 'public' and table_name = 'profils'
--         and column_name in ('statut_contrat_employe',
--           'motif_contrat_employe', 'contrat_employe_voie',
--           'contrat_employe_type', 'contrat_employe_duree',
--           'contrat_employe_montant', 'contrat_employe_devise',
--           'contrat_employe_modalites', 'contrat_employe_lieu',
--           'contrat_employe_horaires', 'contrat_employe_date_debut',
--           'contrat_employe_periode_essai', 'contrat_employe_prepare_le',
--           'charte_acceptee_le')
--       order by column_name;
--  V2. Contraintes de cycle et de voie présentes (2 lignes, définitions
--      contenant les statuts / les deux voies) :
--      select conname, pg_get_constraintdef(oid) from pg_constraint
--       where conrelid = 'public.profils'::regclass
--         and conname in ('profils_statut_contrat_employe_check',
--           'profils_contrat_employe_voie_check')
--       order by conname;
--  V3. Rétroactivité — répartition des statuts chez les comptes
--      plateforme (tous « sans_objet » à l'application, charte en
--      attente partout) :
--      select statut_contrat_employe, count(*),
--             count(charte_acceptee_le) as chartes_acceptees
--        from public.profils
--       where role in ('admin','super_admin')
--       group by statut_contrat_employe
--       order by statut_contrat_employe;
--  V4. Cas du fondateur CIM-000001 et du compte de test CIM-000003 :
--      select display_id, role, statut_contrat_employe,
--             charte_acceptee_le
--        from public.profils
--       where display_id in ('CIM-000001','CIM-000003')
--       order by display_id;
--      -> statut « sans_objet », charte_acceptee_le null pour les deux
--         (le compte de test n'apparaît qu'après sa promotion Admin
--         pour le suivi Équipe ; sa ligne existe dès l'inscription).
--  V5. Les CLIENTS ne sont pas touchés : aucune ligne client n'a de
--      voie de contrat employe ni de charte acceptée posée par ce
--      module (les colonnes restent à leurs valeurs par défaut) :
--      select count(*) as clients_avec_pack
--        from public.profils
--       where role not in ('admin','super_admin')
--         and (contrat_employe_voie is not null
--              or charte_acceptee_le is not null
--              or statut_contrat_employe <> 'sans_objet');
--      -> 0.
-- ============================================================================
