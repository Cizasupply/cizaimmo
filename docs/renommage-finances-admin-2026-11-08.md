# Renommage de la vue Finances pour le sous-admin (2026-11-08)

## Contexte

Le périmètre **données** de la page « Paie & Dépenses » était déjà
filtré et prouvé (un Admin ne reçoit que sa ligne de paie, son
historique et ses dépenses — fournisseurs réel + démo, verrouillé par
la passe corrective captures, points 8 et périmètre dépenses). Mais
la **présentation** restait celle de la plateforme entière : un Admin
ouvrait une page intitulée « Finances de la plateforme », avec une
section « Paie des employés » et un « Historique des paies émises » —
de quoi laisser croire qu'il voyait les paies de tous les employés
(constat du fondateur : « c'est marqué finances plate-forme »).

## Changement (vue Admin uniquement — Super Admin strictement inchangé)

Même patron conditionnel par rôle que `payIntro` / `expensesTitle`
déjà présent dans `app/[locale]/console/finances-plateforme/page.tsx`
(`estSuper ? … : …Admin`). Aucune modification des fournisseurs ni
des données.

| Emplacement | Super Admin (inchangé) | Admin (nouveau) |
|---|---|---|
| Titre de page FR | Finances de la plateforme | **Ma paie et mes dépenses** |
| Sous-titre FR | Paie des employés et dépenses de fonctionnement de CizaImmo. | Vos paies émises par la plateforme et vos propres dépenses de fonctionnement. |
| Totaux FR | Totaux du mois | **Mes totaux du mois** |
| Section paie FR | Paie des employés | **Ma paie** |
| Historique FR | Historique des paies émises | **Mon historique de paies** |
| Section dépenses FR | Dépenses de fonctionnement | Mes dépenses (déjà en place, inchangé) |
| Titre de page EN | Platform finances | **My pay and my expenses** |
| Sous-titre EN | Employee payroll and CizaImmo operating expenses. | Your pay issued by the platform and your own operating expenses. |
| Totaux EN | Monthly totals | **My monthly totals** |
| Section paie EN | Employee payroll | **My pay** |
| Historique EN | Issued payroll history | **My pay history** |

Le sous-titre de la section paie côté Admin (« Votre ligne de paie
pour le mois choisi… », clé `payIntroAdmin`) existait déjà et est
conservé. L'entrée de menu « Paie & Dépenses » reste identique pour
les deux rôles.

## Nouvelles clés i18n (parité FR/EN)

`financesPlateforme.titleAdmin`, `subtitleAdmin`, `totalsTitleAdmin`,
`payTitleAdmin`, `historyTitleAdmin` — ajoutées dans
`messages/fr.json` et `messages/en.json`.

## Tests

`scripts/test-correctifs-captures.cjs`, point 10 (statique) :
patron conditionnel par rôle présent dans la page pour les quatre
emplacements ; valeurs exactes des libellés Admin FR/EN ; libellés
Super Admin inchangés dans les deux langues. Parité FR/EN vérifiée
par `scripts/i18n-check.py` et `scripts/i18n-cles-utilisees.py`
dans `scripts/run-tests.sh`. Blocs touchés verts : Finances
plateforme 52 OK, Finances réel contraint 43 OK, Correctifs
captures (point 10 inclus) 62 OK, parité i18n 2 131 clés.
Note hors périmètre : le Module 3 (statuts d'échéances de loyers,
fixtures démo dépendantes de la date du jour) sort 3 KO
préexistants, sans rapport avec ce renommage.
