# Design « Marine & Or premium » — déploiement aux pages + correctif héros (2026-11-07)

Le fondateur a **validé** la passe tableau de bord (« Je valide et c'est
très beau », capture bureau du compte réel de Kaneza à l'appui). Cette
livraison : (1) un **correctif de cohérence** repéré sur sa capture,
(2) le **déploiement du même traitement à toutes les autres pages de
l'espace client**, (3) l'**alignement léger de la console** (point 7 de
la proposition validée). Aucun contenu, aucune donnée, aucune logique
métier, aucune route ni aucun libellé modifié — classes visuelles
uniquement, plus l'extraction d'une fonction pure (voir §1).

## 1. Correctif héros — « Attendus : 0 BIF » contre KPI « 680 000 BIF »

**Symptôme (capture du fondateur)** : la carte héros du tableau de bord
affichait « Loyers collectés du mois : 0 BIF — **Attendus : 0 BIF** »
alors que la carte KPI « Loyers collectés du mois » du même écran
affichait « **Attendus : 680 000 BIF** » — et le taux de collecte
n'apparaissait pas.

**Cause** : la fonction `totauxConvertis`, alors locale à la page du
tableau de bord, n'ajoutait au `totalConverti` que les groupes
**convertis** (devise ≠ devise d'affichage). Un groupe déjà dans la
devise d'affichage retournait tôt (`converti: total` pour la ligne)
**sans s'additionner au total**. Le KPI, qui lit les **lignes**, était
juste ; le héros, qui lit le **total**, tombait à 0. Cas Kaneza : tout
en BIF, affichage BIF → attendus total = 0 (et taux masqué, le taux
n'étant calculé que si attendus > 0).

**Correctif** : la fonction est extraite dans `lib/module4.ts`
(`totauxConvertis(groupes, deviseAffichage, taux)`, fonction pure) avec
l'addition manquante ; la page du tableau de bord l'utilise pour les
trois agrégats (collectés, attendus, retards). Héros et KPI lisent
désormais **les mêmes objets** : lignes pour les KPI, `totalConverti`
pour le héros. Pour Kaneza : héros = collecté 0 BIF, attendus
680 000 BIF, taux de collecte 0 % (affiché).

**Verrouillage** : nouveau test `scripts/test-design-heros.cjs`
(enregistré dans `run-tests.sh`) — 19 contrôles : le cas Kaneza exact,
la propriété « total = somme des lignes converties » sur 5 cas, le cas
mixte même-devise + convertie, le taux manquant (total `null`, repli
par lignes, lignes intactes), et des contrôles statiques garantissant
que la page n'a plus de fonction locale et que héros et KPI passent
par la fonction partagée.

## 2. Déploiement aux pages clientes — patron appliqué

Le cadre (fond crème, sidebar marine, menu) était déjà en place via
l'AppShell. Harmonisation du **contenu** de chaque page :

- **Titres** de sections/cartes (h1/h2/h3) en **marine SemiBold**
  (`font-semibold text-navy`, étaient `font-bold`) — 47 titres côté
  client.
- **Un seul bouton primaire par page, en or** (`bg-gold`, texte
  marine, gras, survol `gold-light`) ; **tous les autres boutons
  pleins marine deviennent des secondaires** : fond blanc, contour
  marine, texte marine SemiBold. Les actions destructrices restent
  rouges ; les états de sélection restent marine (conversation
  sélectionnée dans Messages, bascule Unitaire/Lot des appartements,
  badges « Principale » des photos).
- **En-têtes de tableaux** : fond **crème** `#F7F5F0`, texte marine
  SemiBold (étaient gris slate sur blanc).
- **Formulaires** : les boutons d'envoi des formulaires partagés
  passent en or ; le focus des champs était déjà marine/or
  (`focus:border-gold` + anneau or dans `Field` et les champs en
  ligne) — vérifié, rien à changer.
- **Badges de statut** : couleurs métier inchangées partout.

### Primaires en or, par page

| Page | Action primaire |
|---|---|
| Immeubles | « Nouvel immeuble » |
| Passeport du bien | « Ajouter un appartement » |
| Appartements | « Nouvel appartement » |
| Appartement (détail) | « Nouveau bail » |
| Locataires | « Nouveau locataire » |
| Locataire (détail) | « Nouveau bail » |
| Loyers | « Déclarer » (par échéance) + envoi du dialogue de déclaration |
| Dépenses | « Nouvelle dépense » |
| Documents | Envoi du formulaire de téléversement |
| Rapports | « Exporter PDF » (Excel reste secondaire) |
| Vitrine | « Voir les plans » / « Vitrine publique » (selon l'état) + « Demander la publication » |
| Abonnement | « Payer par carte » |
| Paramètres | « Enregistrer » du profil |
| Contrat | Téléverser le contrat signé |
| Formulaires (création/édition) | Bouton d'envoi (Immeuble/Appartement/Locataire/Bail/Dépense) |
| États vides (EmptyState) | L'action unique proposée |

### Secondaires passés en contour marine

Réessayer (Immeubles, Abonnement), retour « Limite atteinte »
(Immeubles/nouveau), « Générer le lien » (Locataire), « Marquer comme
traitée » (Alertes), bascule du formulaire Documents, « Retirer la
publication » (Vitrine), « Enregistrer le pack d'essai », « Choisir »
des cartes plans, demande Mobile Money et « Annuler la suppression »
(Abonnement), envois Taux/Gestionnaires/Copropriété et « Annuler la
suppression » (Paramètres), « Confirmer » du renommage (DocumentList),
envoi de la section Indivision (passeport).

## 3. Console — alignement léger seulement

- Fond de la zone de contenu : **crème** `#F7F5F0`
  (`ConsoleShell` : `bg-slate-50` → `bg-cream`) — sa sidebar était
  déjà marine.
- Titres de sections en **marine SemiBold** : 37 titres dans les
  13 pages console. Rien d'autre côté console (ni boutons, ni
  tableaux, ni badge Messages).

## Fichiers touchés

- **Correctif héros** : `lib/module4.ts`,
  `app/[locale]/dashboard/page.tsx`, `scripts/test-design-heros.cjs`
  (nouveau), `scripts/run-tests.sh` (enregistrement du test).
- **Pages clientes (19)** : immeubles (liste, détail, nouveau),
  appartements (liste, détail), locataires (liste, détail), loyers,
  reçus, dépenses, documents, alertes, messages, rapports, vitrine,
  abonnement, paramètres, contrat.
- **Composants (8)** : ImmeubleForm, AppartementForm, LocataireForm,
  BailForm, DepenseForm, DocumentList, IndivisionSection, EmptyState.
- **Console (14)** : ConsoleShell + 13 pages (vue d'ensemble, comptes,
  dossier compte, admins, gestionnaires, finances, journal,
  mes-dossiers, messages, messages supervisés, supervision,
  suppressions, vitrine).

## Adaptations de tests

**Aucune.** La suite passe sans modifier un seul test existant : les
patrons remplacés n'étaient verrouillés par aucune assertion (seul le
tableau de bord l'était, déjà adapté lors de la passe précédente). Le
seul ajout est le nouveau test héros/KPI (§1). Le recensement
« aucune carte sans bordure » du test cartes+graphique reste vert :
aucune carte n'a été créée ni dé-bordée.

## Vérifications

- `bash scripts/run-tests.sh` : **suite complète verte — 1017 OK,
  0 KO** (998 avant + 19 du nouveau test héros).
- `npm run build` : OK.
- Reste au fondateur : contrôle visuel sur le compte de Kaneza
  (héros corrigé : Attendus 680 000 BIF, taux 0 % ; pages au nouveau
  patron) après déploiement.
