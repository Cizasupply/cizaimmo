-- =====================================================================
-- CizaImmo — Dossier employé complet des Admins (2026-11-08)
-- Décision du fondateur : un Admin (employé) doit remplir SON dossier
-- complet d'employé — identité + ADRESSE — comme le dossier d'un
-- client, en plus complet.
--
-- Contenu du dossier employé (4 éléments) :
--   1. photo de profil       -> profils.photo_profil_path (existe, v1.3)
--   2. pièce d'identité      -> table documents (entite_type 'compte',
--                               type 'piece_identite', existe, v1.3)
--   3. téléphone             -> profils.telephone (existe, v1.3)
--   4. adresse postale       -> NOUVEAU : les 4 colonnes ci-dessous
--      (adresse, ville, code postal OPTIONNEL, pays).
--
-- Exigence SUIVIE, NON BLOQUANTE (patron du contrat propriétaires,
-- option C) : aucun statut n'est stocké — la complétude est CALCULÉE
-- à la lecture à partir des 4 éléments (la base reste la source de
-- vérité, aucune copie à synchroniser). La promotion Admin ne pose
-- donc rien d'autre que le rôle : tout compte admin/super_admin dont
-- les 4 éléments ne sont pas présents est « incomplet » — y compris
-- rétroactivement (compte de test CIM-000003 et Super Admin
-- fondateur CIM-000001 inclus). L'accès console n'est JAMAIS bloqué
-- par le dossier ; le Super Admin voit le statut de chaque Admin
-- dans la page Équipe et peut suspendre à tout moment.
--
-- Le parcours CLIENT est inchangé : son dossier reste photo + pièce
-- + téléphone, SANS adresse (aucune exigence nouvelle côté client ;
-- les colonnes d'adresse existent sur la même table mais ne sont
-- jamais demandées aux clients).
--
-- À appliquer dans Supabase APRÈS le déploiement du code. Idempotent :
-- ré-exécutable sans effet de bord. Aucune politique RLS nouvelle :
-- les colonnes vivent sur `profils`, déjà couverte par les politiques
-- existantes (le membre de la plateforme lit les profils via
-- est_admin_plateforme ; l'employé écrit SON profil via les
-- politiques d'auto-écriture existantes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Adresse postale de l'employé (4 colonnes, toutes OPTIONNELLES en
--    base : la complétude est une règle de lecture, pas une contrainte
--    — un dossier peut être rempli progressivement).
-- ---------------------------------------------------------------------
alter table public.profils
  add column if not exists adresse text,
  add column if not exists adresse_ville text,
  add column if not exists adresse_code_postal text,
  add column if not exists adresse_pays text;

comment on column public.profils.adresse is
  'Dossier employé (Admins) : adresse postale — rue et numéro. Jamais exigée des clients.';
comment on column public.profils.adresse_ville is
  'Dossier employé (Admins) : ville de l''adresse postale.';
comment on column public.profils.adresse_code_postal is
  'Dossier employé (Admins) : code postal — OPTIONNEL dans la complétude.';
comment on column public.profils.adresse_pays is
  'Dossier employé (Admins) : pays de l''adresse postale. Distinct de profils.pays (pays déclaré à l''inscription, anti-fraude).';

-- ---------------------------------------------------------------------
-- 2. Vérifications (à lire après exécution)
-- ---------------------------------------------------------------------
-- V1 — les 4 colonnes d'adresse existent sur profils :
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'profils'
--     and column_name in ('adresse','adresse_ville','adresse_code_postal','adresse_pays')
--   order by column_name;
--   -> 4 lignes : adresse, adresse_code_postal, adresse_pays, adresse_ville.
--
-- V2 — RÉTROACTIVITÉ : chaque compte plateforme démarre « incomplet »
--   tant que les 4 éléments ne sont pas réunis (adresse encore vide
--   pour tous à l'application de ce module) :
--   select display_id, role,
--          (photo_profil_path is not null) as photo,
--          (telephone is not null and btrim(telephone) <> '') as telephone,
--          (adresse is not null and btrim(adresse) <> ''
--           and adresse_ville is not null and btrim(adresse_ville) <> ''
--           and adresse_pays is not null and btrim(adresse_pays) <> '') as adresse_complete
--   from public.profils
--   where role in ('admin','super_admin')
--   order by display_id;
--   -> CIM-000001 (super_admin) : adresse_complete = false.
--   (La pièce se vérifie séparément : table documents,
--    entite_type = 'compte', type = 'piece_identite'.)
--
-- V3 — le compte de test destiné à être promu Admin (CIM-000003,
--   cizaimmo@yahoo.com) est bien présent ; dès sa promotion, son
--   dossier employé démarrera « incomplet » comme les autres :
--   select display_id, email, role from public.profils
--   where display_id = 'CIM-000003';
--   -> 1 ligne (role encore client à ce stade, admin après promotion).
--
-- V4 — les CLIENTS ne sont pas touchés : aucune adresse n'est exigée
--   ni posée pour eux par ce module (colonnes nulles, parcours
--   inchangé) :
--   select count(*) as clients_sans_adresse
--   from public.profils
--   where role not in ('admin','super_admin') and adresse is null;
--   -> tous les comptes clients existants.
