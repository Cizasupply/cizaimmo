# Correctif — Display ID insécable (2026-11-08)

**Défaut (capture du fondateur, compte de test CIM-000003)** : sur
l'écran « Compte en attente d'approbation », le numéro de dossier
s'affichait coupé en deux lignes dans son encadré or :
« CIM- » / « 000003 ».

**Correctif** : le Display ID est rendu `whitespace-nowrap`
(insécable) sur cet écran (`components/AppShell.tsx`), et la même
discipline est appliquée partout où il est rendu comme une
pastille ou un élément mis en avant du même patron
(`strong font-bold tracking-wide text-navy` ou pastille
`rounded-full`) :

- `app/[locale]/contrat/page.tsx` (page « Mon contrat »)
- `components/SectionContratProprietaire.tsx`
- Console : `console/comptes`, `console/comptes/[id]`,
  `console/mes-dossiers`, `console/messages`,
  `console/suppressions`, `console/vitrine` (pastille).

Aucun texte modifié — seules des classes CSS changent ; aucun
autre comportement touché.

**Verrouillage** : `scripts/test-display-id-insecable.cjs`
(10 contrôles statiques, dont une garde anti-régression : aucun
rendu du patron sans `whitespace-nowrap` ne doit subsister),
enregistré dans `scripts/run-tests.sh`. Suite complète VERTE
(exit 0), build OK.
