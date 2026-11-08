# Design « Marine & Or premium » — CONSOLE Admin / Super Admin (2026-11-07)

Ordre du fondateur, après sa validation du traitement complet sur
l'espace client (« Je valide et c'est très beau ») : **« Même chose
pour Admin »**. La console n'avait reçu que l'alignement léger
(fond crème + titres marine SemiBold) ; elle reçoit ici le
traitement COMPLET, en parité avec l'espace client. Design
uniquement : aucun contenu, aucune donnée, aucune logique, aucune
route ni aucun libellé n'a changé.

## 1. ConsoleShell — menu premium (parité AppShell)

### Bureau
- Barre latérale **marine** (#1B2A4A) devenue flex-col : logo
  compact blanc/or, titre console, navigation défilante, pied de
  barre (bloc utilisateur, « ← Site public », langue, déconnexion
  avec icône).
- **Icônes SVG uniformes** : le jeu `IconeNav`, créé pour le client
  dans AppShell, est **extrait vers `components/IconeNav.tsx`** et
  **étendu aux entrées console** (overview, accounts = dossier,
  managers = maillon de chaîne, myFiles = mallette,
  supervisedMessages = œil, journal = liste, suppressions =
  corbeille, admins = bouclier, finances = billet). AppShell
  importe désormais le composant partagé : les deux espaces
  utilisent EXACTEMENT le même jeu.
- **Actif en or** : fond marine clair + texte or + liseré or à
  gauche (`shadow-[inset_4px_0_0_0_#D4AF37]`, `aria-current`) —
  même patron que le client. La détection d'actif passe par le
  chemin sans préfixe de locale et couvre les sous-pages (la page
  Dossier allume « Comptes »).
- **Regroupements** sobres : **Gestion** (Vue d'ensemble, Comptes,
  Gestionnaires, Mes dossiers), **Supervision** (Messages,
  Messages supervisés, Vitrine, Journal), **Plateforme**
  (Suppressions, Admins, Finances — Super Admin seul ; le groupe
  disparaît s'il est vide). 3 clés i18n ajoutées
  (`console.groupManagement / groupSupervision / groupPlatform`,
  parité FR/EN : 1781 = 1781). Aucune entrée supprimée : les 11
  destinations historiques sont verrouillées par test.

### Mobile (ultra mobile-first)
- **Barre supérieure marine** : logo compact, titre console,
  sélecteur de langue, déconnexion. **Le hamburger disparaît.**
- **Barre inférieure fixe style application** (5 emplacements) :
  Vue d'ensemble, Comptes, **Messages avec la pastille or des
  non-lus plateforme**, Journal, **« Plus »**. Actif en or avec
  indicateur supérieur, zones tactiles ≥ 44 px
  (`min-h-[3.5rem]`), safe-area iPhone
  (`pb-[env(safe-area-inset-bottom)]`), contenu en `pb-28` pour
  n'être jamais masqué.
- **« Plus »** ouvre le **menu complet en panneau plein écran
  marine** : toutes les entrées groupées + site public + langue +
  bloc utilisateur + déconnexion. Un seul mécanisme de menu
  complet (l'ancien tiroir latéral est remplacé) ; Échap ferme et
  le défilement de fond est bloqué, comme côté client.

### Badge Messages — logique STRICTEMENT inchangée
Le compteur plateforme (`compterMessagesPlateformeNonLus`,
recalculé à chaque navigation, dépendances `[profil, pathname]`)
et sa pastille sidebar restent identiques ; la présentation
s'étend en plus à la barre inférieure mobile (même compteur,
pastille or sur l'icône Messages). Le test de régression dédié
(`test-console-messages-badge.cjs`, cas Kaneza « Bonjour test »)
passe sans aucune adaptation.

## 2. Vue d'ensemble — héros + KPI à accents

- **Carte « héros » marine** sous le sous-titre : 3 chiffres en or
  construits UNIQUEMENT à partir des compteurs déjà calculés par
  la page — **dossiers en attente** (`enAttente.length`),
  **comptes** (`comptes.length`), **messages non lus**
  (`totalMessagesNonLus`). Aucun nouveau calcul métier.
- **11 cartes KPI** : patron client — blanches bordées
  (`shadow-sm`) avec **barre d'accent métier de 4 px** alignée sur
  la couleur de la valeur (attente/à vérifier/incomplets/contrats/
  rattachements/vitrine = ambre, retards = rouge, actifs/MRR =
  vert, comptes/essais = marine). Valeurs et couleurs des données
  inchangées.
- Les deux liens CTA (boîte de réception, file de revue) passent de
  plein marine à **secondaires** (blanc, contour marine, SemiBold).
- Le bloc « Messages clients non lus » (ambre si > 0) est conservé
  tel quel.

## 3. Pages console — primaire or unique + secondaires

Patron identique au client : titres déjà marine SemiBold ;
**un seul primaire or par page** ; les autres boutons pleins
marine deviennent secondaires (blanc, contour marine, SemiBold,
`hover:bg-navy/5`) ; **Refuser et les destructeurs restent
rouges** ; les validations secondaires restent vertes ; les états
de sélection marine sont inchangés ; badges/statuts aux couleurs
métier inchangés.

| Page | Primaire or | Devenus secondaires / accents |
|---|---|---|
| Vue d'ensemble | — (héros marine) | 2 CTA en secondaires ; KPI à accents |
| Comptes | **Approuver** (file de revue, par carte) | Envoyer l'avis → secondaire ; KPI non-assignés : accent ambre ; chips de filtre (sélection marine) inchangés |
| Dossier | **Approuver** (garde checklist inchangée : bouton grisé tant qu'incomplète) | Valider l'immeuble → secondaire ; Valider le contrat / Valider un rattachement restent verts ; Refuser reste rouge |
| Finances | **Enregistrer** | — |
| Admins (Équipe) | **Créer un Admin** | Promouvoir → secondaire ; Suspendre (rouge) / Réactiver (vert) inchangés |
| Gestionnaires | **Ouvrir la supervision** (déjà or, conservé) | Créer le rattachement → secondaire (un seul or sur la page) |
| Vitrine | **Approuver** l'annonce | Refuser reste rouge |
| Mes dossiers | — | 4 cartes d'actions à accents métier (ambre ×2, rouge, marine) |
| Journal | — | En-tête de tableau : fond crème, texte marine SemiBold ; filtres inchangés |
| Suppressions | — | En-tête de tableau : fond crème, texte marine SemiBold ; Exécuter reste rouge |
| Messages | — | (cartes-liens et pastilles or déjà au patron) |
| Messages supervisés | — | (état de sélection marine inchangé) |
| Supervision | — | (bandeau or déjà au patron) |

Hors périmètre assumé : les composants PARTAGÉS avec l'espace
client (`FilMessages`, `ConfirmDialog`) gardent leur style actuel
(déjà harmonisé côté client) ; la modale d'assignation (sélection
par bordure or) est déjà au patron.

## 4. Fonctions strictement inchangées

Checklist d'approbation (cases, consignation, garde base et bouton
grisé), filtres du Journal (recherche libre, Action/Acteur/
Période), formulaires Finances (tarifs dynamiques), assignation,
supervisions journalisées, garde d'accès du shell — aucune ligne
de logique n'a été touchée ; seuls des `className` et la structure
de présentation du shell ont changé.

## 5. Tests

- **Nouveau bloc** `scripts/test-design-console.cjs` (enregistré
  dans `run-tests.sh`) : **54 contrôles** — menu premium console
  (icônes partagées, actif or, groupes, barre inférieure + safe
  area, panneau plein écran, destinations ×11), badge Messages
  (logique inchangée + pastille mobile), héros (compteurs
  existants), accents KPI, primaires or par page, en-têtes crème,
  parité des 3 nouvelles clés.
- **Adaptation documentée** : `test-correctif-cartes-graphique.cjs`
  §4 — l'assertion « icônes SVG du menu présentes » visait la
  définition locale dans AppShell ; le jeu étant extrait vers
  `components/IconeNav.tsx`, l'assertion vise le composant partagé
  + son import par l'AppShell. Intention inchangée, aucune
  assertion fonctionnelle affaiblie. Aucune autre adaptation.
- **Suite complète : 1071 OK / 0 KO** (1017 + 54). Parité i18n
  **1781 = 1781** (3 clés de groupes ajoutées FR + EN), contrôle
  des clés utilisées OK. **Build OK.**

## 6. Preuve finale (fondateur)

Sur la console (téléphone + ordinateur) : sidebar marine à icônes
avec groupes et actif or ; sur téléphone, barre inférieure à 5
emplacements avec la pastille Messages et « Plus » en plein écran ;
Vue d'ensemble : héros marine aux 3 chiffres or + KPI à accents ;
bouton « Approuver » or sur un dossier en attente (grisé tant que
la checklist est incomplète).
