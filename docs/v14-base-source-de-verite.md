# CizaImmo v1.4 — La base est la source de vérité

Décisions du fondateur (2026-11-07) :

1. **Le frontend ne décide rien.** Le backend — et en dernier ressort la
   base de données — est la source de vérité. Jusqu'à la v1.3, le
   passage en lecture seule (fin d'essai, grâce de paiement dépassée…)
   était calculé par le code de l'application (couche données, côté
   serveur) : un client normal était bien bloqué, mais un appel
   direct à l'API Supabase avec sa propre session pouvait écrire
   malgré un essai terminé, parce que les politiques RLS d'écriture
   ne vérifiaient que l'appartenance des données. La v1.4 branche le
   refus **dans la base elle-même**.
2. **Toute première inscription reçoit l'essai de 30 jours avec le
   pack Starter.** Le client choisira lui-même son pack après
   l'essai (ou dès l'essai, comme préférence : `plan_apres_essai`).

SQL : `supabase/module-v14.sql` (idempotent, à appliquer après
module-v13.sql). **Non appliqué au live à la livraison du code** —
l'application se fait via le SQL Editor, comme les v1.2/v1.3
(morceaux dans `~/workspace/cizaimmo-sql-v14/`).

## 1. La fonction de garde

```sql
public.abonnement_permets_ecriture(p_owner uuid) returns boolean
```

STABLE, SECURITY DEFINER, `search_path` verrouillé. Elle lit
l'abonnement **le plus récent** du propriétaire et retourne vrai si :

- statut `actif` sans échec de paiement ; ou
- statut `actif` avec `echec_paiement` mais `grace_ends_at > now()` ; ou
- statut `essai` avec `trial_ends_at > now()`.

Faux dans tous les autres cas : `en_attente`, `suspendu`,
`lecture_seule`, `annule`, essai expiré, grâce dépassée, aucun
abonnement. Elle compare les dates en direct : aucun job de
transition n'est nécessaire pour que le refus soit effectif à la
seconde où l'essai se termine.

## 2. Tables branchées (écritures uniquement)

La garde est **ajoutée** (AND) à la condition d'origine de chaque
politique d'écriture — ni les lectures (SELECT), ni les politiques
plateforme/console ne changent : en lecture seule, le client
continue de consulter tout son parc, c'est le principe.

| Table | Politiques | Propriétaire résolu via |
|---|---|---|
| immeubles | insert / update / delete | `owner_id` |
| appartements | insert / update / delete | propriétaire de l'immeuble |
| locataires | write (all) | `owner_id` |
| baux | write (all) | appartement → immeuble → propriétaire |
| loyers (échéances) | write (all) | bail → appartement → immeuble → propriétaire |
| paiements (déclarés) | write (all) | échéance → bail → … → propriétaire |
| dépenses | write (all) | propriétaire de l'**immeuble** (owner_id = rédacteur, donc jamais lui) |
| documents | write (all) | `owner_id`, **sauf** `entite_type = 'compte'` |

Résolution par des helpers SECURITY DEFINER :
`proprietaire_immeuble`, `proprietaire_par_appartement`,
`proprietaire_par_bail`, `proprietaire_par_echeance`. Pour un
gestionnaire qui écrit sur l'immeuble d'un propriétaire, c'est
**l'abonnement du propriétaire** qui décide.

Exception documents : le dossier d'inscription (photo, pièce
d'identité, contrat — `entite_type = 'compte'`) doit pouvoir être
complété **pendant l'attente d'approbation**, donc hors garde.

Exclus (inchangés) : `abonnements`, `factures_abonnement`,
`paiements_mobile_money`, `profils`, et toutes les politiques de
lecture.

## 3. Essai Starter

- `handle_new_user` (reprise de la dernière définition v1.3) :
  l'abonnement naît `en_attente` avec `plan = 'starter'` et
  `plan_apres_essai = 'starter'`.
- **Approbation dans la base** : nouvelle fonction
  `public.approuver_compte(cible uuid) returns timestamptz`
  (SECURITY DEFINER, contrôle `est_admin_plateforme()` interne,
  execute réservé aux connectés). Elle exige le statut `en_attente`,
  lit la durée d'essai dynamique (`parametres_finance.jours_essai`),
  pose `statut = 'essai'`, `plan = 'starter'`,
  `plan_apres_essai = 'starter'`, `debut_periode`,
  `trial_ends_at`, `fin_periode`, et retourne la fin d'essai.
  Le fournisseur réel appelle cette RPC (`lib/data/real.ts`) au lieu
  de mettre l'abonnement à jour lui-même ; e-mails, confirmation de
  grille sur le profil et journal d'audit restent côté application.
  Le fournisseur démo applique la même règle en miroir.
- Conséquence assumée : pendant l'essai, les limites et fonctions
  sont celles du pack Starter (1 bloc, pas de gestionnaires invités,
  pas de vitrine, pas d'indivision). Les anciens raccourcis « essai =
  fonctions Pro » (`limiteBlocs`, gardes indivision) ont été retirés :
  le plan en cours fait foi.

## 4. plan_apres_essai

Nouvelle colonne `abonnements.plan_apres_essai` (`starter` / `pro` /
`agence`, défaut `starter`). Pendant l'essai, la page Abonnement
affiche la section « Votre pack à la fin de l'essai » (3 packs, prix
lus dans les tarifs dynamiques) ; le choix est enregistré via
`definirPlanApresEssai` (réel + démo) — aucun paiement à ce stade.
La console (liste des comptes + page Dossier) affiche le pack choisi
lorsqu'il diffère du plan en cours.

## 5. Inscription sans choix de plan

La page d'inscription ne propose plus aucun plan (elle n'en
transmettait déjà plus en métadonnées) : un encadré annonce « Essai
gratuit de 30 jours — pack Starter inclus. À la fin de l'essai, vous
choisirez le pack qui vous convient. » Les pages publiques (accueil,
tarifs) sont alignées. **Le texte des conditions (`legal.terms`) n'a
pas été touché** (hors périmètre) : il mentionne encore les
fonctions Pro pendant l'essai — à faire aligner séparément.

## Tests

`scripts/test-base-verite-v14.cjs` (branché dans
`scripts/run-tests.sh`) : présence et logique de la garde dans le
SQL, les 12 politiques branchées, approbation → Starter (SQL +
démo), colonne `plan_apres_essai`, inscription sans plan (FR/EN),
choix du pack de fin d'essai (page + fournisseur démo + vue console).
`scripts/test-module5.cjs` a été mis à jour pour la nouvelle règle
(essai Starter : montée Agence d'abord, limite 1 bloc).
