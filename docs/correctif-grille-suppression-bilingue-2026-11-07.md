# Correctif « grille console + suppression Paramètres + bilingue » (2026-11-07)

Trois défauts signalés par le fondateur en test réel (production,
comptes fondateur Super Admin + cliente CIM-000002).

## 1. Changer la grille tarifaire depuis la console échoue

**Cause (preuve code).** `RealProvider.reattribuerGrille`
(lib/data/real.ts) était la dernière mutation plateforme restée au
patron v1.2 : deux `UPDATE` PostgREST directs (abonnements.grille,
profils.grille_attribuee/grille_statut) **sans jamais lire le champ
`error`** des résultats — en supabase-js, un refus de la base n'est
pas une exception, il revient dans le résultat : il était donc
avalé en silence et la grille + le drapeau « à vérifier » ne
changeaient jamais. Toutes les autres mutations plateforme passent
depuis la v1.4 par des RPC SECURITY DEFINER à erreurs nommées
(approuver_compte, assigner_dossier, supprimer_compte_…) ; il
n'existait **aucune fonction `reattribuer_grille`** dans les modules
SQL (vérifié par balayage des `create function` de supabase/*.sql).

**Correctif.**
- `supabase/module-correctif-grille.sql` (idempotent, **à appliquer
  au live**) : crée `public.reattribuer_grille(cible, nouvelle_grille)`
  — rôle plateforme vérifié en interne (`ADMIN_PLATEFORME_REQUIS`),
  erreurs nommées (`GRILLE_INVALIDE`, `COMPTE_INTROUVABLE`,
  `ABONNEMENT_INTROUVABLE`), mutation du dernier abonnement + profil
  (grille + `grille_statut='ok'`) ; réaffirme en outre les deux
  politiques d'écriture plateforme de module-admin.sql §7.
- `lib/data/real.ts` : `reattribuerGrille` appelle la RPC et mappe
  les erreurs (patron approuverCompte), journalisation inchangée.
- Nouveau code `ERR_GRILLE_INVALIDE` traduit (console.errors FR/EN).
- Morceaux d'application : `~/workspace/cizaimmo-sql-correctif-grille/`
  (un seul morceau de 5 227 octets + README).
- Note : `suspendreCompte` / `reactiverCompte` partagent encore
  l'ancien patron d'UPDATEs directs sans lecture d'erreur — non
  signalés en défaut, laissés tels quels (à migrer si un jour un
  refus silencieux est constaté).

## 2. Bouton de suppression de compte introuvable côté client

**Cause (preuve code).** La mécanique v1.5 est complète et saine
(RPC `demander_suppression_compte` / `annuler_suppression_compte`,
instantané, lecture seule immédiate, rétractation 30 j) et l'UI
existait — mais **uniquement tout en bas de la page Abonnement**,
sous la section « Résilier l'abonnement ». La page **Paramètres**
(Profil, Grille, Taux, Gestionnaires, Rattachements,
Co-propriétaires, Notifications, Sécurité) n'avait **aucune section
compte/suppression** : le point d'entrée standard manquait.

**Correctif.** `app/[locale]/parametres/page.tsx` : nouvelle section
« Supprimer mon compte » après Sécurité (zone danger, bordure
rouge), propriétaire **et** gestionnaire (tout rôle client de
l'espace) : texte explicatif (lecture seule immédiate, délai de
rétractation de 30 jours, exécution ensuite), bouton de demande
avec `ConfirmDialog`, état « demande en cours » avec la date
d'exécution prévue et bouton d'annulation — branchée sur les mêmes
méthodes provider (`demanderSuppressionCompte` /
`annulerSuppressionCompte`) et les mêmes clés `v15.*` que la page
Abonnement (qui conserve son entrée). Aucune mécanique base nouvelle.

## 3. Tout le site doit être bilingue

**État des lieux (preuves).**
- Le contrôle `scripts/i18n-cles-utilisees.py` (clés utilisées vs
  définies) passait déjà : 1 680 clés FR = EN, aucune clé statique
  manquante ; les écrans touchés par les défauts 1 et 2 n'ont
  **aucun texte français codé en dur** (hors noms de langue
  « Français / English », convention normale).
- En revanche le **sélecteur de langue** (`LanguageSwitcher`) n'était
  monté que sur les surfaces publiques (PublicHeader/PublicFooter,
  pages vitrine et locataire) — **absent de l'espace client
  (AppShell) et de la console (ConsoleShell)**, contrairement à sa
  propre documentation (« visible en permanence », spec §4/§14).
- Et **8 codes d'erreur** atteignables depuis les écrans console
  (équipe, suppressions, messages supervisés) n'avaient **aucune
  traduction** dans `console.errors` (FR ni EN) : l'interface
  affichait alors le code brut.

**Correctif.**
- `LanguageSwitcher` monté dans `components/AppShell.tsx` (barre
  latérale, rangée d'actions près de la cloche, écran de blocage
  attente/suspension) et `components/ConsoleShell.tsx` (barre
  latérale, en-tête mobile, tiroir mobile) — même composant à
  navigation pleine page que les pages publiques (bascule vérifiée
  dans les deux sens).
- `messages/fr.json` / `messages/en.json` : `console.errors`
  complété (9 clés : ERR_GRILLE_INVALIDE, ERR_CONVERSATION_NON_SUPERVISEE,
  ERR_CIBLE_NON_ADMIN, ERR_AUTO_MODIFICATION_INTERDITE,
  ERR_AUTO_SUPPRESSION_INTERDITE, ERR_COMPTE_PLATEFORME,
  ERR_PROFIL_INTROUVABLE, ERR_COMPTE_SUSPENDU, ERR_COMPTE_REFUSE) —
  parité stricte 1 689 = 1 689.

## Tests

- `bash scripts/run-tests.sh` : suite complète verte ; nouveau bloc
  « Correctif grille + suppression + bilingue »
  (`scripts/test-correctif-grille-suppression.cjs`, branché dans
  run-tests.sh avec les deux contrôles i18n Python) : **61 OK, 0 KO**.
- `npm run build` : OK.

## Reste à faire (hors code)

- **Appliquer `module-correctif-grille.sql` à la base live**
  (morceaux prêts, voir §1) — sans lui, la RPC n'existe pas côté
  base et le nouveau code affichera une erreur explicite.
- Preuve finale : le fondateur reclique « Attribuer la grille
  Afrique » sur la fiche CIM-000002 → la grille change et le
  drapeau « à vérifier » disparaît ; et la section « Supprimer mon
  compte » est visible dans Paramètres côté client.
