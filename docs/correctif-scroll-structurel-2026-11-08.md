# Correctif « bande au scroll » — PASSE 2 STRUCTURELLE + lot C/D/E (2026-11-08)

Livraison unique regroupant :

- **Défaut A (passe 2)** — la bande marine qui traversait l'écran pendant le
  défilement iPhone (vidéo du fondateur) ;
- **Défaut C** — détail locataire : l'e-mail débordait de la carte « Contact
  details » ;
- **Défaut D** — page Messages (client) entière plus large que l'écran ;
- **Défaut E** — dialogue « New expense » : le champ DATE plus large que les
  autres champs.

Preuves : confirmations et captures iPhone du fondateur, interface EN,
compte réel de Kaneza (CIM-000002). Design uniquement — aucune donnée,
logique, route ni libellé modifiés ; parité i18n FR/EN intacte (aucune
clé touchée).

---

## Défaut A — Échec de la passe 1 constaté, mécanisme SUPPRIMÉ

### Constat

La passe 1 (voir `docs/correctif-scroll-tuiles-2026-11-08.md`) promouvait
la barre inférieure fixe des coques en couche de composition propre
(`.barre-fixe-ios` : `translateZ(0)` + `backface-visibility: hidden`).
**Le fondateur a confirmé sur son iPhone réel, après redéploiement :
« La barre de la video passe toujours. »** Le nudge ne suffisait donc
pas : tant que la barre reste un élément `position: fixed` superposé à
un document qui défile, WebKit peut la repeindre à une position périmée
pendant le scroll.

### Nouveau mécanisme (AppShell cliente + ConsoleShell, mobile)

La coque mobile devient une **colonne flex de hauteur `h-dvh`** :

```
<div class="flex h-dvh flex-col … md:block md:h-auto md:min-h-screen">   racine
  <aside> … sidebar bureau (fixed, hidden md:flex) — inchangée
  <div class="flex min-h-0 flex-1 flex-col md:contents">                 enveloppe
    <div class="min-h-0 flex-1 overflow-y-auto md:contents">             zone défilante
      <header> barre supérieure mobile (premier élément, part au scroll)
      <main> contenu de la page
    </div>
    <nav> barre inférieure DANS LE FLUX (shrink-0, safe-area portée par la barre)
  </div>
  {panneau « Plus » plein écran — fixed, sibling hors zone}
</div>
```

- **Plus rien ne flotte** au-dessus du contenu pendant le scroll : seule
  la zone du milieu défile, comme une application native.
- La barre inférieure garde fond marine plein, 5 emplacements, actif or,
  badge Messages (console, logique du compteur strictement inchangée)
  et `pb-[env(safe-area-inset-bottom)]`.
- **Compensations retirées** : le `pb-28` du `main` (devenu `py-6`) et
  la classe `.barre-fixe-ios` (globals.css + les deux coques).
- Le panneau « Plus » reste `fixed inset-0` (jamais visible pendant un
  scroll normal) ; il est **relocalisé hors de la zone défilante**
  (sibling de l'enveloppe) pour qu'aucun `fixed` ne vive dans le
  conteneur défilant.
- **Bureau strictement inchangé** : `md:contents` dissout les deux
  enveloppes, la racine redevient un bloc `min-h-screen`, la sidebar
  fixe et le `main` décalé (`md:ml-60 md:p-10`) sont identiques, le
  défilement reste celui de la fenêtre.
- Verrouillage panneau ouvert : l'effet existant (Échap + body
  `overflow: hidden`) verrouille désormais **aussi la zone interne**
  (`zoneDefilanteRef`, `overflowY: hidden`), sinon le contenu
  continuerait de défiler sous le panneau.

### Non-régressions vérifiées explicitement

1. **Défilement de la fenêtre** : balayage du dépôt — aucun
   `window.addEventListener('scroll')`, aucun `window.scrollY`, aucun
   `scrollTo`. Seul `FilMessages` utilise `scrollIntoView({block:
   "nearest"})`, qui cible l'ancêtre défilant le plus proche = la
   nouvelle zone : il continue de fonctionner.
2. **Ancre `#messages`** (boîte de réception console → Dossier) : la
   navigation par fragment fait défiler le conteneur défilant ; la
   section garde `id="messages"` + `scroll-mt-6` (la marge de défilement
   s'applique dans le conteneur ; la barre supérieure, dans le flux,
   part au scroll et ne masque rien).
3. **Modales/dialogues** (`fixed inset-0` : ConfirmDialog,
   SuppressionCompteDialog, AssignationModale, DocumentList, Loyers,
   Dépenses) : aucun ancêtre des nouvelles enveloppes n'a de
   `transform`/`filter`/`will-change`/`perspective` (balayage +
   contrôles statiques) → ils restent positionnés et centrés sur la
   fenêtre visible, comme avant.
4. **Fin de contenu atteignable** : la barre étant dans le flux, la fin
   du contenu est toujours lisible ; le `pb-28` retiré ne masque rien.
5. **Hauteur `h-dvh`** : racine à 100 dvh sur mobile → pas de double
   barre de scroll (le body ne défile plus sur mobile ; un seul
   défilement, la zone). Sur bureau, retour au défilement fenêtre
   unique.
6. Les coques sont montées **par page** (pas dans le layout) : à chaque
   navigation, la zone se remonte à `scrollTop = 0`, comme le
   défilement fenêtre d'avant.

**Preuve finale restant au fondateur** : scroller le tableau de bord
sur son iPhone — plus aucune bande ne doit passer ; la barre du bas
reste collée au bas de l'écran sans jamais traverser le contenu.

---

## Défaut C — Détail locataire : « Contact details », e-mail hors carte

**Cause** : lignes libellé/valeur rigides — `<div class="flex gap-2">`,
`<dt class="w-40 shrink-0">`, `<dd>` nu. La valeur e-mail
(`mcna2009@yahoo.ca`) est un jeton insécable ; en tant qu'item flex,
le `<dd>` a `min-width: auto` et refuse de rétrécir → la ligne (et la
carte) déborde à droite. Même cause que la carte Identité console,
corrigée le 2026-11-08 — cette page cliente n'avait pas été balayée.

**Correctif** (`app/[locale]/locataires/[id]/page.tsx`, carte
Coordonnées) : toutes les valeurs en `min-w-0` ; e-mail et téléphone
en `break-all` (jetons) ; pièce d'identité, adresse précédente,
contact d'urgence et notes en `break-words`.

**Balayage même patron (pages clientes)** :

- page publique du locataire (lien, `locataire/[token]`) : même patron
  rigide (`w-44`) — ses 7 valeurs du bail en `min-w-0 break-words` ;
- abonnement : déjà au patron (`min-w-0 break-words` sur les valeurs) —
  vérifié, inchangé ;
- loyers (totaux) : déjà au patron (`dt min-w-0`, montants `nowrap`) —
  vérifié, inchangé ;
- paramètres : e-mails des listes déjà en `break-all` — vérifié ;
- passeport du bien / détail appartement : tuiles déjà traitées
  (passe B du 2026-11-08) — vérifié.

---

## Défaut D — Page Messages (client) plus large que l'écran

**Cause** : la grille liste + fil était
`grid gap-6 lg:grid-cols-[320px_1fr]` — **aucune colonne mobile
explicite**. Sous `lg`, la piste implicite se dimensionne au contenu
le plus large (max-content) : le bandeau marine du fil sélectionné et
le sous-titre « Your direct thread with the CizaImmo team (your
assigned…) » forçaient une piste plus large que l'écran, et toute la
page débordait à droite.

**Correctif** (`app/[locale]/messages/page.tsx`) :

- grille en `grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]`
  — mobile : liste et fil empilés dans la largeur ; bureau : deux
  volets côte à côte, inchangés ;
- les deux sections en `min-w-0` ; titre du fil et sous-titre en
  `break-words`.
- Même normalisation du volet bureau sur la page console Messages
  supervisés (`340px_minmax(0,1fr)`).

---

## Défaut E — Champ DATE plus large que les autres champs (iOS)

**Cause** : WebKit iOS donne au contrôle natif `input[type="date"]`
une largeur intrinsèque (valeur + indicateur) supérieure à celle des
autres champs ; dans la grille du formulaire, l'item ne rétrécissait
pas → dans le dialogue « New expense », le champ DATE dépassait à
droite des champs alignés.

**Correctif, trois couches** :

1. **Composant `Field`** (utilisé par DepenseForm, BailForm,
   ImmeubleForm, AppartementForm, Loyers, Paramètres, Inscription…) :
   contrôle en `w-full min-w-0 max-w-full`, racine en `min-w-0` ;
2. **Champs date bruts** alignés : filtres Dépenses (×2) et période
   Rapports (×2) en `w-full min-w-0 max-w-full` ;
3. **Garde-fou global** (`globals.css`) : `input[type="date"]`,
   `datetime-local`, `month`, `time` en `min-width: 0; max-width: 100%`
   — un champ date ne dépasse jamais son conteneur, y compris dans
   les futurs formulaires.

---

## Tests — adaptations documentées

Aucune assertion fonctionnelle affaiblie ; les destinations de
navigation et la logique du badge Messages (test de régression) sont
inchangées et passent sans adaptation.

- `scripts/test-correctif-scroll-tuiles.cjs` §A **réécrite** pour le
  patron structurel : racine `h-dvh`, zone `overflow-y-auto`
  (+ verrouillage panneau ouvert), barre dans le flux (`shrink-0`,
  safe-area conservée), règle `.barre-fixe-ios` absente, `pb-28`
  absent, panneau toujours `fixed`, sidebar bureau inchangée.
- `scripts/test-design-console.cjs` et
  `scripts/test-correctif-cartes-graphique.cjs` : les trois contrôles
  qui verrouillaient `fixed inset-x-0 bottom-0` / `pb-28` /
  `min-h-screen bg-cream` sont adaptés au nouveau patron (commentaires
  « ADAPTATION (2026-11-08, passe 2) » dans les fichiers) — intentions
  (« barre présente + safe-area », « contenu jamais masqué », « fond
  crème ») inchangées.
- `scripts/test-correctif-mobile-annotations.cjs` **étendu** :
  sections C (4 contrôles), D (3), E (4) ; le contrôle « grille
  explicite » de Messages supervisés aligné sur `minmax(0,1fr)`.
- `scripts/run-tests.sh` : commentaires des deux blocs mis à jour.

## Vérifications

- **Suite complète VERTE** : `bash scripts/run-tests.sh` — exit 0,
  « Tous les tests demandés sont passés » (0 KO sur l'ensemble des
  blocs, dont scroll-tuiles 44 OK et annotations 40 OK).
- **Build OK** : `npm run build` — exit 0.
