-- ============================================================================
-- CizaImmo — Option C « Contrat de service PROPRIÉTAIRE non bloquant »
-- (2026-11-08, décision du fondateur : variante C du dossier
-- cizaimmo-contrat-proprietaires-DECISION.md).
--
-- Principe : le propriétaire reçoit son contrat de service PDF
-- personnalisé en pièce jointe de l'e-mail de bienvenue (à
-- l'approbation), il le signe et le redépose depuis son espace, un
-- Admin le valide ou le refuse (avec motif). NON BLOQUANT : l'accès
-- aux modules et l'essai démarrent à l'approbation comme avant —
-- AUCUNE garde d'écriture ne lit ces colonnes (la garde v1.4
-- abonnement_permets_ecriture est inchangée).
--
-- Ce module ne fait que suivre le cycle dans la base (patron v1.3 du
-- contrat gestionnaire, colonnes DÉDIÉES pour ne pas toucher au
-- cycle gestionnaire existant profils.statut_contrat) :
--   profils.statut_contrat_proprietaire :
--     'sans_objet'   — pas encore approuvé, ou compte gestionnaire ;
--     'a_signer'     — approuvé, contrat envoyé (ou rattrapage) ;
--     'signe_depose' — contrat signé redéposé, en attente de revue ;
--     'valide'       — validé par un Admin ;
--     'refuse'       — refusé par un Admin (motif dans
--                      profils.motif_contrat_proprietaire).
--
-- RÉTROACTIVITÉ (section 2) : les propriétaires DÉJÀ approuvés
-- (abonnement né et non « en_attente ») basculent à « a_signer » —
-- leur contrat devient disponible dans leur espace (téléchargement
-- + dépôt du signé) et leur statut apparaît dans leur Dossier
-- console. AUCUN e-mail n'est envoyé par ce rattrapage (l'envoi
-- reste un geste applicatif, à l'approbation uniquement).
-- Cas connu au 2026-11-08 : Kaneza Rehema, CIM-000002.
--
-- Aucune politique RLS nouvelle : les colonnes vivent sur profils,
-- dont les politiques existantes couvrent déjà les lectures et les
-- mises à jour du titulaire et de la plateforme (le cycle
-- gestionnaire v1.3 repose sur les mêmes politiques). Aucune RPC :
-- les transitions sont des UPDATE applicatifs journalisés dans
-- journal_audit par l'application, comme validerContrat en v1.3.
--
-- Idempotent : réexécutable sans effet de bord. À appliquer APRÈS
-- module-v17.sql et module-checklist-audit.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes + contrainte de cycle.
-- ----------------------------------------------------------------------------
alter table public.profils
  add column if not exists statut_contrat_proprietaire text not null default 'sans_objet';

alter table public.profils
  add column if not exists motif_contrat_proprietaire text;

alter table public.profils
  drop constraint if exists profils_statut_contrat_proprietaire_check;
alter table public.profils
  add constraint profils_statut_contrat_proprietaire_check
  check (statut_contrat_proprietaire in
    ('sans_objet', 'a_signer', 'signe_depose', 'valide', 'refuse'));

-- ----------------------------------------------------------------------------
-- 2. Rétroactivité : propriétaires déjà approuvés -> « a_signer ».
--    Un compte est « déjà approuvé » si son abonnement existe et n'est
--    plus « en_attente » (essai / actif / lecture_seule / suspendu).
--    Les comptes refusés (abonnement « annule ») et en attente restent
--    « sans_objet ». Aucun e-mail n'est émis par cette bascule.
-- ----------------------------------------------------------------------------
update public.profils p
   set statut_contrat_proprietaire = 'a_signer'
 where p.type_intention = 'proprietaire'
   and p.statut_contrat_proprietaire = 'sans_objet'
   and exists (
     select 1
       from public.abonnements a
      where a.owner_id = p.id
        and a.statut not in ('en_attente', 'annule')
   );

-- ============================================================================
-- VÉRIFICATIONS (lecture seule, après application) :
--  V1. Colonnes présentes (2 lignes attendues) :
--      select column_name from information_schema.columns
--       where table_schema = 'public' and table_name = 'profils'
--         and column_name in ('statut_contrat_proprietaire',
--           'motif_contrat_proprietaire')
--       order by column_name;
--  V2. Contrainte de cycle présente (1 ligne, définition contenant
--      les 5 statuts) :
--      select pg_get_constraintdef(oid) from pg_constraint
--       where conrelid = 'public.profils'::regclass
--         and conname = 'profils_statut_contrat_proprietaire_check';
--  V3. Rétroactivité — répartition des statuts (les propriétaires
--      approuvés sont en « a_signer », les autres en « sans_objet ») :
--      select statut_contrat_proprietaire, count(*)
--        from public.profils
--       where type_intention = 'proprietaire'
--       group by statut_contrat_proprietaire
--       order by statut_contrat_proprietaire;
--  V4. Cas Kaneza (CIM-000002) : 1 ligne, statut « a_signer » :
--      select display_id, statut_contrat_proprietaire
--        from public.profils
--       where display_id = 'CIM-000002';
-- ============================================================================
