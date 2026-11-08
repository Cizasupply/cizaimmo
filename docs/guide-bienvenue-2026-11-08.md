# Guide d'utilisation joint à la bienvenue (2026-11-08)

Idée du fondateur (« lors de la lettre de bienvenue on pourrait
glisser un guide d'utilisation »), guide v3 enrichi **validé par le
fondateur** le 2026-11-08, puis branché le même jour.

## Le guide

- **FR** : v3 validée mot pour mot (4 pages A4, logo en avant,
  étapes détaillées, usage quotidien, rôles, abonnement, FAQ,
  engagement) — inchangée.
- **EN** : traduction fidèle produite à partir du même script
  (« Getting started guide », slogan « Your properties, managed
  simply. »), même structure et même mise en page ; contrôle par
  lecture réelle des 4 pages à ~390 px + crop zoomé de l'en-tête.
- Fichiers finaux (sans « BROUILLON ») :
  - dossier du goal : `files/cizaimmo-guide-utilisation-fr.pdf`
    (87,8 Ko) et `files/cizaimmo-guide-utilisation-en.pdf` (84,5 Ko) ;
  - app : `public/guides/` (mêmes fichiers, à l'octet près —
    verrouillé par test), servis tels quels par Next.

## Branchement

- **Helper partagé** `lib/guide.ts` : `nomFichierGuide(langue)`,
  `cheminGuide(langue)` et `piecesJointesAvecGuide(pieces, langue)`
  — charge le PDF statique de la langue du compte (fetch même
  origine) et l'**ajoute après le contrat** dans les pièces jointes.
- **E-mail de bienvenue propriétaire** (option C) : pièces jointes =
  [contrat de service propriétaire, guide] — `approuverCompte` des
  deux fournisseurs (réel + démo).
- **E-mail de décision gestionnaire** (v1.3) : pièces jointes =
  [contrat de collaboration, guide] — même point d'approbation.
- **Repli non bloquant** (patron des pièces jointes existant) : si
  la lecture du guide échoue, l'e-mail part avec le contrat seul ;
  l'approbation et l'essai n'en dépendent jamais. La route
  `/api/email/envoyer` accepte déjà jusqu'à 3 pièces jointes.
- **Page « Mon contrat »** : nouveau composant
  `components/LienGuideUtilisation.tsx` — lien « Guide
  d'utilisation (PDF) » / « User guide (PDF) » (clé
  `dossier.guideDownload`, parité FR/EN) pointant vers le PDF de la
  **langue de l'interface**, affiché pour les propriétaires (sous
  leur section contrat) comme pour les gestionnaires.
- Aucun autre texte ni comportement modifié ; **aucun SQL**.

## Vérifications

- Nouveau bloc `scripts/test-guide-bienvenue.cjs` (**24 OK / 0 KO**),
  enregistré dans `scripts/run-tests.sh` (harnais : `lib/guide.ts`
  ajouté à la compilation) : fichiers présents / %PDF / poids /
  identité avec les finaux validés ; helper (noms, chemins,
  chargement, ordre [contrat, guide], replis) ; câblage statique
  des deux flux ; flux démo complets — propriétaire FR (bienvenue à
  2 pièces jointes, guide FR), gestionnaire EN (décision à 2 pièces
  jointes, guide EN), repli fetch en panne (bienvenue envoyée avec
  le contrat seul).
- **Suite complète VERTE** via `bash scripts/run-tests.sh` (exit 0).
- **Build OK** (`npm run build`, exit 0).
