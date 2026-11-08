# Périmètre des dépenses pour le sous-admin — 2026-11-08

**Décision du fondateur** : « le sous-admin n'a pas le droit de voir
toutes les dépenses de la plateforme, il doit voir ses propres
dépenses effectuées / demandées et approuvées ».

## Règle appliquée

Dans la vue Finances plateforme (`getVueFinancesPlateforme`) :

- Un **Admin** ne reçoit que **SES propres dépenses** (celles dont il
  est l'auteur de la saisie, `saisi_par = lui`), avec leurs statuts
  (en attente / validée / refusée). Les dépenses saisies par d'autres
  (Super Admin ou autres Admins) n'apparaissent **ni dans sa liste ni
  dans ses totaux** — les totaux sont calculés sur son seul
  périmètre.
- Le **Super Admin** garde la vue complète (toutes dépenses, tous
  auteurs).
- Ses paies étaient déjà limitées aux siennes (inchangé).
- La validation/refus des dépenses reste **Super Admin seul**
  (inchangé) ; la saisie par l'Admin reste possible (inchangé).

## Où vit le verrou

Dans les **fournisseurs**, pas dans l'affichage — la page ne reçoit
tout simplement pas les autres dépenses :

- Réel (`lib/data/real.ts`) : la requête `depenses_plateforme` porte
  `.eq("saisi_par", acteur.id)` pour tout acteur non-Super Admin ;
  les totaux sont calculés depuis la liste filtrée.
- Démo (`lib/data/demo.ts`) : même filtre
  (`estSuper || d.saisi_par === acteur.id`) avant le calcul des
  totaux.

Ce filtrage existait déjà dans les deux fournisseurs ; cette passe
l'a **vérifié, documenté aux points de verrouillage et verrouillé
par des tests dédiés** (ci-dessous), et a aligné le libellé de la
page.

## Libellé de page

La section des dépenses de `finances-plateforme` s'intitule
désormais **« Mes dépenses »** côté Admin (nouvelle clé
`financesPlateforme.expensesTitleAdmin`, FR « Mes dépenses » /
EN « My expenses ») ; le Super Admin garde « Dépenses de
fonctionnement ». Parité i18n conservée.

## Tests

- **Démo** (`scripts/test-finances-plateforme.cjs`, bloc à 52 OK) :
  nouvelle section « Périmètre des dépenses » — l'Admin a saisi 3
  dépenses (validée, en attente, refusée), le Super Admin en saisit
  une 4e (999 USD) : la vue Admin ne contient que ses 3 dépenses avec
  leurs statuts, ses totaux USD restent à 75 en attente (les 999
  exclus) ; la vue Super Admin contient les 4.
- **Réel contraint** (`scripts/test-finances-reel.cjs`, bloc à
  37 OK) : les 2 dépenses semées sont du Super Admin — la vue Admin
  n'en contient **aucune** et ses totaux sont vides de dépenses ;
  l'Admin saisit sa dépense (30 USD) : sa vue ne contient qu'elle,
  ses totaux = 30 en attente ; la vue Super Admin contient les deux
  dépenses de décembre.
- Suite complète `bash scripts/run-tests.sh` VERTE (exit 0),
  `npx tsc --noEmit` propre, `npm run build` OK.

## Aucun changement SQL

Aucune colonne ni politique à ajouter : le périmètre est porté par
les fournisseurs (la colonne `saisi_par` existe depuis
`module-finances-plateforme.sql`).
