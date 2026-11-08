# Correctif — la paie exige un contrat employé VALIDÉ (2026-11-08)

## Constat du fondateur

Sur la page « Paie & Dépenses », la paie de Barros Innocent (CIM-000003)
apparaissait **émissible** alors que son contrat d'engagement était
seulement **préparé** (400 000 BIF saisis par le Super Admin) — jamais
signé par l'employé, jamais déposé, jamais validé. Question du
fondateur : « Comment émettre la paie sans contrat ? »

Cause : la porte d'émission ne demandait qu'un contrat **préparé**
avec un montant (`blocagesPaie.contratPrepare`, garde
`ERR_PAIE_SANS_CONTRAT` sur les seuls paramètres). Le statut réel du
contrat (`profils.statut_contrat_employe`) n'était pas consulté.

## Nouvelle règle (la base décide)

L'émission d'une paie exige désormais
`statut_contrat_employe = 'valide'` pour l'employé — la même exigence
que l'émission de la **carte employé**, qui demandait déjà le contrat
validé. Un contrat préparé (à signer), déposé (signé, en attente de
revue) ou refusé ne suffit plus.

Ordre des contrôles à l'émission (inchangé sauf la porte contrat) :
**dossier complet → contrat validé → coordonnées de paiement**.

## Changements

- `lib/finances-plateforme.ts` — `blocagesPaie` reçoit
  `contratValide: boolean` (remplace `contratPrepare`). Le blocage
  « contrat » couvre tout statut ≠ `valide` ; le blocage « montant »
  ne s'évalue que contrat validé. Le montant reste lu des paramètres
  du contrat.
- `lib/data/real.ts` — la vue Finances calcule le blocage depuis
  `ligne.statut_contrat_employe` ; `emettrePaieEmploye` lève
  `ERR_CONTRAT_NON_VALIDE` quand le statut n'est pas `valide`
  (après la garde dossier, avant la garde montant
  `ERR_PAIE_SANS_CONTRAT` conservée en repli et la garde
  coordonnées).
- `lib/data/demo.ts` — miroir exact (statut du pack stocké /
  `pack.contrat_statut`).
- `lib/data/provider.ts` — documentation de l'ordre des gardes mise
  à jour.
- Libellés (parité FR/EN) :
  - `financesPlateforme.blockContrat` : « Contrat non validé » /
    "Contract not validated" (était « Contrat non préparé »).
  - `errors.ERR_CONTRAT_NON_VALIDE` : libellé généralisé —
    « Contrat non validé. » / "Contract not validated." Le code
    d'erreur existait déjà pour le contrat **gestionnaire**
    (rattachement) avec le libellé « Contrat du gestionnaire non
    validé » ; le code est maintenant partagé par les deux portes
    (gestionnaire et employé), d'où le libellé neutre, exact dans
    les deux contextes. La page Contrat gestionnaire affiche de
    toute façon son propre message de verrouillage.
- **Aucun changement SQL** : la colonne `statut_contrat_employe`
  existe déjà (module pack employé), relue à chaque émission/vue.

## Effet immédiat en production

La ligne de paie de Barros affichera le blocage « Contrat non
validé » (pastille « Émission impossible », à juste titre cette
fois). Pour émettre sa paie : Barros télécharge son contrat, le
signe et le dépose (« Mon dossier employé »), le Super Admin le
valide (Équipe), puis l'émission devient possible et le talon se
génère.

## Tests

- `scripts/test-finances-plateforme.cjs` (démo) — **48 OK / 0 KO** :
  fonction pure (contrat non validé même avec montant → « contrat »
  seul) ; cycle réel : sans contrat → refusé ; préparé non signé →
  refusé + blocage affiché ; signé déposé non validé → refusé ;
  **validé → émission possible** (montant/devise/modalités copiés,
  doublon refusé, autre mois OK) ; contrat **refusé** → refusé +
  blocage affiché.
- `scripts/test-coordonnees-paiement.cjs` — **60 OK / 0 KO** :
  l'ordre des portes devient dossier → contrat non validé
  (`ERR_CONTRAT_NON_VALIDE`, avant les coordonnées) → coordonnées ;
  le cycle complet du contrat (dépôt + validation) est intégré aux
  deux scénarios d'émission.
- `scripts/test-finances-reel.cjs` (fournisseur réel, faux client
  PostgREST contraint au schéma live) — **31 OK / 0 KO** : statuts
  `a_signer`, `signe_depose`, `refuse` → `ERR_CONTRAT_NON_VALIDE` +
  blocage « contrat » dans la vue ; statut restauré `valide` →
  aucun blocage, émission et talon inchangés.
- Suite complète `bash scripts/run-tests.sh` : **VERTE (exit 0)** ;
  parité i18n **2 095 clés FR = EN** ; `npx tsc --noEmit` propre ;
  `npm run build` OK.
