# Correctif — captures annotées du fondateur : en-tête public, boutons CTA, ligne entreprise (2026-11-08)

Micro-défauts relevés au doigt par le fondateur sur son téléphone, pages publiques mobiles (captures annotées en rouge) — trois premiers sur la page À propos, le 4e ajouté par une capture suivante (pied public). Design uniquement : aucun texte, aucune route, aucune logique modifiés.

## Défaut 1 — En-tête public mobile : « Contact » tombait sous les autres liens

**Capture** : dans l'en-tête marine, « Tarifs · Appartements à louer · À propos » sur une ligne et « Contact » rejeté en dessous. Demande du fondateur : les boutons/liens « au même niveau, sans que l'un soit en bas de l'autre ».

**Cause** : la navigation de `components/PublicHeader.tsx` (partagée par toutes les pages publiques) était en `flex-wrap` avec `text-sm` et `gap-x-5` à toutes les tailles : à 360-390 px, la somme des quatre libellés FR (41 caractères, « Appartements à louer » étant le plus long) + écarts + paddings dépassait la largeur utile (~328 px), donc le 4e lien passait à la ligne.

**Correction** (`components/PublicHeader.tsx`, balise `<nav>` uniquement) :
- `flex-nowrap` — plus aucun retour à la ligne possible ;
- mobile : `text-xs`, `gap-x-2`, liens en `px-0.5` et `whitespace-nowrap` (aucun libellé coupé) ;
- paliers d'origine restaurés dès `sm` (`sm:text-sm`, `sm:gap-x-4`, `sm:px-1`) et écart bureau d'origine en `xl:gap-x-5` — **le bureau est inchangé** ;
- budget vérifié par le calcul (test) : ≈ 307 px estimés pour 328 px utiles à 360 px, FR comme EN.

## Défaut 2 — Bouton d'essai : « jours » tombait sous le libellé, texte à gauche

**Capture** : le bouton or « Commencer l'essai gratuit de 30 jours » cassait sur deux lignes (« jours » en dessous) et le texte partait à gauche dans le bouton pleine largeur.

**Cause** : libellés longs (39 caractères en FR) dans des boutons `px-8` à taille de base (16 px) : ~330 px de texte pour ~248 px utiles sur mobile → retour à la ligne libre.

**Correction** — patron appliqué à **tous les boutons CTA publics au libellé long** (héros de l'accueil : essai or + démo contour clair ; CTA final de l'À propos : essai or + démo contour marine) :
- `whitespace-nowrap` + `text-center` : une seule ligne, centrée ;
- taille responsive : `text-[13px]` + `tracking-tight` + `px-4` sur mobile, `sm:text-base` + `sm:tracking-normal` + `sm:px-8` ensuite ;
- **hauteur du système inchangée** (`min-h-12`, ≥ 48 px) ;
- budgets vérifiés FR et EN à 360 px (libellé EN « Start the free 30-day trial », 27 caractères, tient largement).

## Défaut 3 — Ligne entreprise de l'À propos : le numéro WhatsApp cassait

**Capture** : « … · infos@cizagroup.com · WhatsApp +1 514 / 502 9503 » — le numéro était coupé en plein milieu.

**Cause** : la ligne validée (`about.companyLine`) était rendue comme un texte libre : le navigateur choisissait ses points de coupure à l'intérieur des segments.

**Correction** (`app/[locale]/a-propos/page.tsx`) : la ligne est découpée sur le séparateur « · » **existant dans le texte validé** et chaque segment de contact (l'e-mail d'un bloc, « WhatsApp +1 514 502 9503 » d'un bloc) est rendu dans un `<span className="whitespace-nowrap">`. Les retours à la ligne ne se font plus qu'**entre** segments. Le premier segment (raison sociale + ville) reste fluide. Le texte affiché est **strictement identique**, caractère pour caractère — la chaîne i18n n'est pas touchée (égalité exacte verrouillée par test, FR et EN).

## Défaut 4 — Pied public : la ligne de copyright cassait sur mobile

**Capture** (ajout du fondateur) : « © 2026 CizaImmo, division de Ciza Group. Tous droits réservés. » — « réservés. » tombait sur une 2e ligne.

**Cause** : la ligne (`common.rights`, 62 caractères en FR, 63 en EN) était rendue en `text-xs` (12 px) libre : ~375 px estimés pour 328 px utiles à 360 px (pied en `px-4`).

**Correction** (`components/PublicFooter.tsx`, partagé par toutes les pages publiques) : la ligne passe en `whitespace-nowrap text-center text-[10px]` sur mobile (≈ 315 px estimés au pire cas EN — tient entière, centrée) ; alignement gauche restauré dès `sm` (`sm:text-left`, la rangée du bas redevient horizontale) et **taille d'origine restaurée dès `md`** (`md:text-xs`) — bureau strictement inchangé. Texte inchangé, caractère pour caractère (égalité exacte verrouillée FR + EN).

## Fichiers touchés

- `components/PublicHeader.tsx` — navigation une ligne (commentaire de mise en page mis à jour).
- `app/[locale]/page.tsx` — boutons du héros au patron une-ligne.
- `app/[locale]/a-propos/page.tsx` — boutons du CTA final + ligne entreprise par segments.
- `components/PublicFooter.tsx` — **défaut 4** : copyright sur une ligne en mobile (une seule ligne de classes + commentaire).
- `scripts/test-correctif-apropos-header.cjs` — **nouveau bloc, 36 contrôles** (29 initiaux + 7 pour le copyright : patrons statiques + budgets de largeur FR/EN à 360 px + égalités exactes de la ligne entreprise et du copyright), enregistré dans `scripts/run-tests.sh`.
- `scripts/test-design-accueil.cjs`, `scripts/test-page-a-propos.cjs` — **adaptations documentées** : les assertions qui nommaient les anciennes classes du bouton or (`px-8`, sans `whitespace-nowrap`) visent le nouveau patron ; l'intention (CTA unique, primaire or, bon libellé, bonne destination) est inchangée, aucune assertion fonctionnelle affaiblie.

## Vérifications

- Nouveau bloc : **36 OK / 0 KO** (29 pour les défauts 1-3, + 7 pour le copyright).
- **Suite complète VERTE** (`bash scripts/run-tests.sh`, exit 0 — « Tous les tests demandés sont passés »), i18n : parité et clés utilisées OK (aucune clé ajoutée ni modifiée).
- **Build OK** (`npm run build`, exit 0).

**Preuve finale restant au fondateur** (après redéploiement) : ouvrir n'importe quelle page publique sur son téléphone — les 4 liens de l'en-tête sur une seule ligne ; page À propos : bouton or avec « Commencer l'essai gratuit de 30 jours » entier et centré sur une ligne, et la ligne entreprise où « WhatsApp +1 514 502 9503 » ne casse plus.
