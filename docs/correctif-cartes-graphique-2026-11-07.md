# Correctif visuel — bordures des cartes + graphique réduit (2026-11-07, soir)

Demandes du fondateur après ses tests **sur ordinateur** du tableau de bord cliente (Kaneza) :

1. « Toutes les cartes blanches sans bordure » — dans l'espace connecté, les cartes sont blanches sur fond blanc, sans bordure : leurs contours sont invisibles.
2. Le graphique « Collecte des 6 derniers mois » prend beaucoup trop de place (« c'est le graphique qui prend bcp de place ») : grande zone quasi vide, mois en très gros caractères. (Précision reçue par widget : cartes KPI plus compactes — le levier retenu est le graphique, les KPI restent affichés à l'identique.)

Aucun changement de données ni de logique ; aucun libellé modifié (aucun impact i18n).

## 1. Bordures — patron partagé

Il n'existe pas de composant `Card` : le patron de carte est la chaîne de classes utilitaires répétée dans les pages. La console utilisait déjà la forme bordée (`rounded-2xl border border-slate-200 bg-white …`, ex. carte des filtres du Journal) ; l'espace connecté client utilisait la forme **sans** bordure (`rounded-2xl bg-white p-4 shadow-sm`, fonds teintés pour les KPI).

**Patron partagé retenu (uniformisé partout)** : `rounded-2xl border border-slate-200 … shadow-sm` — bordure slate-200 (gris-bleu clair, cohérent marine/or), rayon et ombre légère inchangés.

Application par recensement automatisé (mini-parseur des `className`, insensible aux apostrophes du JSX) : toute chaîne « rounded-2xl + shadow-sm + fond blanc ou teinté (vert/rouge/ambre/orange/ciel pâles) » sans `border` a reçu `border border-slate-200`. **132 chaînes modifiées dans 28 fichiers.** Hors périmètre, par construction : cartes déjà bordées, bordures métier (amber-200 alertes, red-200, gold…), squelettes de chargement (`animate-pulse`), modales (`shadow-xl`, sur fond assombri), pages publiques.

Pages et composants vérifiés : tableau de bord, immeubles (liste, détail, nouveau, modifier), appartements (liste, détail, nouveau, modifier, bail nouveau), loyers, locataires (liste, détail, nouveau, modifier, bail nouveau), dépenses, documents, rapports, paramètres, abonnement, alertes, messages, reçus, contrat, vitrine (côté client), console/vitrine, composant IndivisionSection.

**Tableau de bord, explicitement** : les 4 cartes KPI héritent du traitement — occupation (fond conditionnel blanc/vert/ambre : bordure ajoutée à la partie statique de la classe), collecté (vert pâle), retard (rouge pâle), vacants (ambre pâle) — ainsi que la barre de conversion et les sections Retards, Fins de bail à 60 jours, Dépenses du mois, graphique et Fil d'actualité. **Couleurs des données inchangées** (vert = collecté, rouge = retard/dépense, ambre = attention/vacant, orange = partiel ; seuls les fonds pâles reçoivent la bordure neutre).

## 2. Graphique « Collecte des 6 derniers mois » — avant / après

Avant : SVG `viewBox="0 0 360 170"` en pleine largeur de la carte — sur un écran d'ordinateur (~950 px utiles), hauteur rendue ≈ 450 px et mois affichés à ≈ 26 px ; zone de barres 110 unités, quasi vide quand un seul mois a des montants.

Après :
- `viewBox="0 0 360 100"` ; hauteur des barres 110 → **58** unités ; ligne de base et grille recalculées (grille y = 10/28/46/64, base 72, mois à y = 86, `fontSize` 10 conservé).
- Conteneur plafonné et centré : `mx-auto max-w-[560px]` (défilement horizontal conservé sous 320 px). Hauteur rendue sur ordinateur ≈ 155 px (environ **un tiers** de l'ancienne, la zone vide disparaît), mois à ≈ 15 px — taille normale. Sur téléphone (~350 px), le graphique garde sa largeur utile et des mois à ~10 px.

Inchangés : les 6 mois et leurs montants, la légende « Collecté / Attendu », la note « Montants convertis en … (taux datés) », les couleurs des barres (marine `#1B2A4A` = collecté, or `#D4AF37` = attendu), les 4 KPI et leurs valeurs. Un resserrage des paddings KPI n'a pas été jugé nécessaire.

## 3. Vérifications

- Nouveau bloc `scripts/test-correctif-cartes-graphique.cjs` (16 contrôles, branché dans `run-tests.sh`) : recensement « zéro carte sans bordure » sur tout le périmètre, KPI et sections du tableau de bord bordés, géométrie et légende du graphique, couleurs des données intactes.
- Suite complète `bash scripts/run-tests.sh` : **verte (exit 0)** — « Tous les tests demandés sont passés », dont parité et clés utilisées i18n (aucun libellé touché).
- Build `npm run build` : **OK (exit 0)**.
- Aucun SQL, aucune donnée touchée.

**Preuve finale (fondateur)** : rouvrir le tableau de bord de Kaneza sur ordinateur — chaque carte blanche doit se détacher du fond par sa bordure fine, et le graphique doit tenir en une bande compacte avec des mois de taille normale.
