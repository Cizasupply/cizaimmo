# CizaImmo v1.5 — Suppression de compte par le client, messagerie directe supervisée, assignation des dossiers

Suite directe de la v1.4 (« la base est la source de vérité ») : chaque
règle de la v1.5 vit dans la base (RPC + RLS), le frontend ne fait
qu'afficher et appeler. SQL : `supabase/module-v15.sql` (idempotent, à
appliquer APRÈS `module-v14.sql`), découpé pour l'application manuelle
dans `~/workspace/cizaimmo-sql-v15/` (4 morceaux ≤ 9 000 octets,
recomposition vérifiée par diff : identique au module complet).

Décisions du fondateur (2026-11-07) : suppression par le client avec
délai de rétractation de 30 jours et factures conservées anonymisées ;
messagerie directe admin ↔ client et propriétaire ↔ gestionnaire, cette
dernière supervisée par la plateforme EN LECTURE SEULE ; assignation
des dossiers aux Admins par le Super Admin (responsabilité, pas
restriction d'accès) ; console Super Admin complète, page Équipe,
espace Admin simplifié « Mes dossiers ».

## A. Suppression de compte par le client

**Données.** `profils.suppression_demandee_le` (date de la demande,
null sinon) ; `abonnements.instantane_avant_suppression` (jsonb) —
choix de l'instantané en UNE colonne jsonb plutôt qu'une colonne par
champ : la restauration est atomique et reste exacte même si le schéma
de l'abonnement évolue (la RPC restaure champ par champ depuis le
jsonb). `factures_abonnement.anonymise` (booléen, défaut false).

**RPC (SECURITY DEFINER, contrôle d'acteur interne).**
- `demander_suppression_compte()` — l'utilisateur connecté, pour SON
  compte. Refuse les comptes plateforme (`COMPTE_PLATEFORME`) et une
  demande déjà en cours (`SUPPRESSION_DEJA_DEMANDEE`). Prend
  l'instantané complet de l'abonnement (`to_jsonb`), passe le statut à
  `lecture_seule` : la garde d'écriture de la v1.4 refuse alors
  immédiatement toute écriture métier, la lecture reste ouverte.
  Pose la demande et journalise (`suppression_demandee`, signée par le
  client — le check `acteur_role` du journal est élargi aux rôles
  clients par ce module).
- `annuler_suppression_compte()` — avant l'échéance des 30 jours
  (`DELAI_EXPIRE` après), restaure l'abonnement À L'IDENTIQUE depuis
  l'instantané (statut, plan, dates, grâce, suspension antérieure…),
  purge l'instantané et la demande. Journalise (`suppression_annulee`).
- `executer_suppression_compte(cible)` — Super Admin seulement
  (`SUPER_ADMIN_REQUIS`, auto-suppression interdite). Refuse tant que
  les 30 jours ne sont pas écoulés (`DELAI_NON_ECOULE`) : le refus
  vient de la base, le bouton console grisé n'est qu'un affichage.
  Anonymise les factures du compte (montants, dates, moyens et plans
  conservés pour la comptabilité ; `stripe_invoice_id` /
  `reference_mobile_money` non nuls remplacés par `ANONYMISE`,
  `anonymise = true`), journalise (`suppression_executee`, AVANT la
  suppression pour que la trace survive), puis supprime l'utilisateur
  Auth via le helper interne commun `supprimer_utilisateur_auth`
  (extrait de `supprimer_compte_definitivement`, qui l'utilise
  désormais aussi). Le Display ID n'est jamais réattribué : la
  séquence `display_id_seq` ne recule pas.

**Front.** Page Abonnement : section « Supprimer mon compte »
(explication + confirmation ; état « suppression prévue le … » +
bouton Annuler pendant le délai). Console Super Admin : page
« Suppressions en attente » (demande, échéance, exécution).

**Limite honnête.** Aucun planificateur ne tourne dans la base :
l'exécution est DÉCLENCHÉE depuis la console par le Super Admin une
fois l'échéance atteinte ; l'éligibilité et le refus avant 30 jours
sont, eux, dans la base. Si le projet Supabase dispose de `pg_cron`,
une tâche quotidienne appelant une variante d'exécution automatique
serait l'évolution naturelle — signalée ici comme option, NON activée.

## B. Messagerie directe

**Tables.** `conversations` (type `plateforme` | `rattachement`,
`proprietaire_id` = le client sujet du fil / le propriétaire,
`gestionnaire_id` + `rattachement_id` pour les fils rattachement,
`admin_responsable_id` = routage) — index uniques partiels : un seul
fil plateforme par client, un seul fil par rattachement.
`messages_directs` (`expediteur_id`, `corps` non vide,
`lu_par_client`, `lu_par_plateforme`). RLS activée partout.

**RLS — le cœur de la supervision.** Sur un fil `rattachement`, seuls
les deux participants peuvent lire/écrire ; la plateforme a une policy
SELECT (via `est_admin_plateforme()`) mais AUCUNE policy d'insertion
pour elle : la policy d'insertion des messages n'admet un acteur
plateforme que si `type_conversation(...) = 'plateforme'`. L'envoi
d'un Admin dans un fil propriétaire ↔ gestionnaire est donc refusé
PAR LA BASE, pas par le front. Aucune policy DELETE sur les deux
tables : personne ne supprime de messages. L'UPDATE est borné au
marquage « lu » (policy participants + plateforme sur fils plateforme).

**Consultation journalisée.** `journaliser_consultation_messages(conv)`
(admin plateforme, fils `rattachement` seulement) écrit dans
`journal_audit` l'action `consultation_messages` ; le front l'appelle
à l'ouverture d'un fil supervisé (page console « Messages
supervisés », lecture seule). En base, la cible de l'audit est le
propriétaire du fil ; en démo, la cible est la conversation (détails
portant propriétaire et gestionnaire) — divergence d'affichage
mineure, la trace existe des deux côtés.

**Routage.** À la création du fil plateforme d'un client,
`admin_responsable_id` = son `profils.admin_responsable_id` s'il
existe ; `assigner_dossier` re-route le fil plateforme existant vers
le nouveau responsable.

**Front.** Page client « Messages » (fil plateforme + ses fils
rattachement) ; panneau « Discussion » par rattachement actif (pages
Paramètres et Contrat) ; section « Messages » dans la page Dossier
console (réponse possible) ; « Mes dossiers » : fils assignés avec
badge non-lus.

**Limite du modèle (assumée par le brief).** Deux drapeaux de lecture
seulement : propriétaire et gestionnaire partagent le côté « client »
d'un fil rattachement — pas de badge non-lu distinct entre eux. Les
badges client ↔ plateforme, eux, sont exacts.

## C. Assignation des dossiers

`profils.admin_responsable_id` (FK profils, `on delete set null`).
`assigner_dossier(cible, admin_id)` — Super Admin seulement ; vérifie
que la cible est bien `admin`/`super_admin` (`ADMIN_INTROUVABLE`) ;
journalise (`assignation`, ancien → nouveau dans `details`) ; re-route
le fil plateforme. `lister_charge_admins()` retourne le nombre de
dossiers par Admin (fonction d'agrégation sans garde interne : lecture
non sensible, les pages qui l'exposent sont déjà gardées — choix
documenté). L'assignation est une RESPONSABILITÉ (routage des
messages, vue « Mes dossiers », KPI « Dossiers non assignés »), pas
une restriction : la console garde l'accès global v1.2.

## D. Équipe et accès Admin

- `profils.acces_admin_actif` (défaut true) ;
  `est_admin_plateforme()` est recréée À L'IDENTIQUE en ajoutant
  `and p.acces_admin_actif` — un employé dont l'accès est coupé perd
  du même coup toutes les policies plateforme. `est_super_admin()`
  inchangé (le fondateur n'est pas désactivable par ce biais).
- `basculer_acces_admin(cible, actif)` — Super Admin, cible `admin`
  uniquement (`CIBLE_NON_ADMIN`), pas d'auto-modification. Journalisé.
- `profils.role_avant_admin` : posé par la promotion (le provider —
  réel et démo — stocke le rôle actuel avant de passer `admin`).
- `retirer_role_admin(cible)` — Super Admin ; restaure
  `coalesce(role_avant_admin, intention → 'gestionnaire' |
  'proprietaire')`, réactive l'accès, désassigne les dossiers dont
  l'ex-Admin était responsable. Journalisé.
  Limite : pour un compte promu AVANT la v1.5 (sans `role_avant_admin`
  rempli), le repli est l'intention déclarée à l'inscription.
- Page « Équipe » : la page console Admins existante est ÉTENDUE
  (charge, accès, dernière activité depuis `journal_audit`, actions
  accès + retrait de rôle) plutôt qu'une page parallèle.
- Espace « Mes dossiers » (`console/mes-dossiers`, Admin non-super) :
  dossiers assignés (accès complet via la page Dossier), actions en
  attente calculées sur ces dossiers (approbations, contrats à
  valider, suppressions échues), fils plateforme assignés non lus.

## Couche données et tests

Miroir complet dans `provider.ts` / `demo.ts` / `real.ts`
(demander/annuler/exécuter la suppression, conversations et messages,
assignation, équipe, mes dossiers). En réel, l'audit des actions v1.5
est écrit PAR LES RPC en base (pas de double journalisation côté app).
En démo, les délais sont simulés par horloge relative (les tests
recoulent la date de demande dans le stockage local).

Tests (`scripts/run-tests.sh`, harnais existant) :
`test-suppression-v15.cjs` (36 vérifications : demande → lecture seule
effective, annulation → restauration exacte, exécution refusée avant
30 j, exécution après échéance simulée → factures anonymisées +
compte supprimé) et `test-messagerie-assignation-v15.cjs`
(41 vérifications : fil plateforme + non-lus, fil rattachement
participants seuls + envoi plateforme refusé en miroir, consultation
journalisée, assignation + charge + responsable, accès coupé → garde
refuse, mes-dossiers filtrés). Suite complète verte (modules 3-7,
correctifs, v1.2, convertisseur, v1.3, v1.4, e-mails, v1.5),
`tsc --noEmit` 0 erreur, `next build` OK.

Limites démo (miroir) : les factures ne sont stockées que pour le
compte principal (l'anonymisation y est complète ; un compte du
registre n'a pas de factures démo) ; la suppression du compte
principal est simulée par un drapeau (`principalSupprime`, données
liées vidées, factures anonymisées et audit conservés) car la
structure mono-compte ne peut pas faire disparaître physiquement
`db.profil`.
