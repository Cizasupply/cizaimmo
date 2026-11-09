# Réorganisation « cartes d'information + bouton Modifier » des dossiers + page Finances du sous-admin — 2026-11-08

Modèle confirmé par le fondateur (2026-11-08, 19:59-20:01) : **« sa paie et les dépenses de la plateforme, deux choses différentes »** — et, pour les dossiers : **un dossier complet ne doit plus afficher les formulaires de modification ouverts** ; chaque section renseignée s'affiche en carte d'information avec son bouton « Modifier » ; **les actions de validation déjà prononcées affichent le résultat (nom du document + date de validation), pas le formulaire**.

Aucun changement de fournisseur ni de règle métier : présentation et états d'ouverture seulement. La base reste la source de vérité (complétude toujours calculée, jamais stockée).

## Patron d'ouverture des formulaires (appliqué partout)

- État local par page : `sectionOuverte` (une seule section en édition à la fois).
- Mode d'édition d'une section = `sectionOuverte === <section> || !<section>Renseignée` :
  - section **renseignée** → lecture seule par défaut ; « Modifier » ouvre le formulaire ; « Annuler » y renonce ;
  - section **non renseignée** → le formulaire est présenté directement (rien à « modifier », il faut saisir).
- Après un **enregistrement réussi**, la section se referme (`setSectionOuverte(null)`) et la carte d'information se réaffiche avec les données relues.
- « Modifier » et « Annuler » réutilisent les clés existantes `common.edit` / `common.cancel` (FR + EN).

## Lot A — Page Finances, vue Admin (`console/finances-plateforme`)

Avant : une boîte « Mes totaux du mois » mélangeait, chez l'employé, sa paie et ses dépenses — source de la confusion du fondateur (« Barros voit tout ») alors que les données étaient déjà filtrées par le fournisseur.

Après (Admin uniquement ; vue Super Admin strictement inchangée) :

1. **La boîte de totaux n'est plus rendue pour un Admin** — elle ne subsiste que dans la vue Super Admin (totaux de la plateforme). Le fournisseur continue de renvoyer les totaux filtrés de l'employé ; la page ne les affiche simplement plus.
2. **Bloc 1 « Ma paie »** : carte de paie (contrat, coordonnées, statut) + « Mon historique de paies » + talons — contenu inchangé.
3. **Bloc 2 « Mes demandes de dépenses »** (nouvelle clé `financesPlateforme.expensesTitleRequestsAdmin`, FR « Mes demandes de dépenses » / EN « My expense requests ») : intro, formulaire de saisie, filtre par statut, sa liste — contenu inchangé. Le titre dit désormais la vérité du rôle : l'employé soumet des **demandes**, le Super Admin seul voit et valide les dépenses de la plateforme.

La clé `financesPlateforme.totalsTitleAdmin` subsiste dans les fichiers de messages (historique du renommage) mais n'est plus rendue pour un Admin.

## Lot B1 — Mon dossier employé (`console/mon-dossier`)

| Section | Avant | Après |
|---|---|---|
| Photo de profil | photo + téléversement toujours ouverts | photo seule ; téléversement derrière « Modifier » |
| Pièce d'identité | nom + Ouvrir + téléversement ouverts | nom du document + « Ouvrir » en lecture ; téléversement derrière « Modifier » |
| Adresse postale | formulaire toujours ouvert | valeurs en lecture (téléphone, adresse, ville, code postal, pays ; « Non renseigné » si vide) ; formulaire derrière « Modifier » |
| Coordonnées de paiement | bandeau (vert/ambre) **et** formulaire complet affichés ensemble | le résumé enregistré est la vue par défaut ; le formulaire ne s'ouvre que par « Modifier » (toujours présenté directement tant que rien n'est enregistré, pour ne pas cacher la saisie) |
| Contrat d'engagement | ligne « Signé déposé : {document} » même après validation | si le contrat est **validé** : ligne de résultat verte « Document validé : {nom} — déposé le {date} » (clé `packEmploye.contratResultLine`). **Note honnête** : la base ne stocke pas de date de validation du contrat employé (seules `contrat_employe_prepare_le` et `charte_acceptee_le` sont datées) — la ligne affiche donc la **date de dépôt** du document validé, libellée comme telle. Sans document retrouvé, l'ancienne note explicative sert de repli. |

Les sections « progression », charte, carte employé et « Ma paie » (lecture seule par nature) sont inchangées.

## Lot B2 — Dossier client (`components/DossierBloc`, écran d'attente)

Même patron pour les deux pièces du dossier client :

- **Photo reçue** → ligne d'information (libellé + pastille « Reçu ») + « Modifier » qui ouvre le téléversement.
- **Pièce reçue** → libellé + **nom du document** (le composant conserve désormais le document de la pièce, pas seulement un booléen) + « Modifier ».
- Pièce manquante → téléversement présenté directement, comme avant. Envoi réussi → retour en lecture seule.
- Le parcours client reste sans champ adresse (règle inchangée, verrouillée par test).

## Lot B3 — Validations terminées = résultat, pas formulaire

- **Page console Dossier** (`console/comptes/[id]`) : nouveau bloc **« Décisions enregistrées »** (clés `console.decisionsTitle`, `console.decisionDocument`, `console.decisionBy`), affiché seulement s'il existe au moins une décision, et **dérivé des données déjà chargées** (journal du dossier + documents du compte — aucun appel fournisseur nouveau) :
  - compte approuvé/refusé (dernière entrée `compte_approuve` / `compte_refuse`) ;
  - contrat gestionnaire **validé** : entrée `contrat_valide` + nom du document de type « contrat » ;
  - contrat propriétaire **validé ou refusé** : entrée `contrat_proprietaire_valide` / `contrat_proprietaire_refuse` + nom du document.
  - Chaque ligne : libellé d'action du journal · document · date et heure · acteur (nom figé du journal, sinon e-mail). Les blocs d'action existants ne s'affichaient déjà que pour les éléments **en attente** — ils sont inchangés ; la checklist reste l'outil de revue **avant** décision.
- **Mon contrat (client)** : la page affichait déjà, une fois le contrat validé, un texte de résultat sans formulaire — rien à fermer.
- **Contrat employé** : voir lot B1 (ligne de résultat).

## Lot C — Photos d'immeuble (`components/ImmeubleForm`)

Le sélecteur de photos utilisait le patron mort sur iOS (clic programmé via `ref` sur un `input` en `display:none`) — le même défaut que le bouton de dépôt du contrat employé, corrigé à la passe précédente. Il passe à l'**activation native** : `<label htmlFor>` + `useId()` + `input` en `sr-only`, exactement comme `DocumentUpload`.

**Règles inchangées** : JPG/JPEG/PNG seulement, 10 Mo max, au moins une photo exigée, bucket et chemins identiques. La liste `EXTENSIONS_DOCUMENT_ACCEPTEES` (avec HEIC/PDF) n'a **pas** été appliquée aux photos : elles sont rendues en `<img>` sur le passeport du bien — un HEIC ou un PDF y casserait l'affichage ; seuls les **documents** acceptent le HEIC.

## Tests

- Nouveau bloc `scripts/test-reorganisation-dossiers.cjs` (30 contrôles : statiques sur les cinq surfaces + runtime démo du périmètre finances, inchangé), enregistré dans `scripts/run-tests.sh`.
- Point 10 de `scripts/test-correctifs-captures.cjs` mis à jour pour le nouveau modèle (totaux Super Admin seul ; nouvelle clé des demandes de dépenses) — 62 OK / 0 KO.
- Blocs relancés : finances plateforme 52 OK, finances réel contraint 43 OK, dossier employé 26 OK, pack employé 67 OK, coordonnées de paiement 60 OK, v1.7 46 OK.
- Suite complète : **1 687 OK / 3 KO** — les 3 KO sont les échecs **préexistants** du Module 3 (fixtures démo sensibles à la date : « dû » devenu « en retard » au passage du 9 novembre UTC), sans rapport avec cette passe, non corrigés ici.
- Parité i18n : **2 137 clés FR = EN** (+6). `tsc --noEmit` propre, `next build` propre.

## Fichiers de la passe

`app/[locale]/console/finances-plateforme/page.tsx`, `app/[locale]/console/mon-dossier/page.tsx`, `components/DossierBloc.tsx`, `app/[locale]/console/comptes/[id]/page.tsx`, `components/ImmeubleForm.tsx`, `messages/fr.json`, `messages/en.json`, `scripts/test-correctifs-captures.cjs`, `scripts/test-reorganisation-dossiers.cjs`, `scripts/run-tests.sh`, ce document. Aucun SQL.
