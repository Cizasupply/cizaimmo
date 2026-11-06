# CizaImmo — « Vos biens, gérés simplement. »

Plateforme SaaS de gestion immobilière (division de Ciza Group) : immeubles/blocs →
appartements, locataires, loyers, dépenses, ROI. Pensée internationale dès le jour 1 :
français + anglais, multi-devises, double grille tarifaire Afrique / Internationale.

## Stack

| Couche        | Choix                                                                 |
|---------------|-----------------------------------------------------------------------|
| Framework     | Next.js 14 (App Router) + TypeScript                                   |
| UI            | Tailwind CSS, couleurs marque : navy `#1B2A4A`, or `#D4AF37`           |
| i18n          | next-intl, `fr` par défaut, `en` — extensible (`messages/*.json`)      |
| Base + Auth   | Supabase (PostgreSQL + Auth + Storage), via `@supabase/supabase-js`    |
| Paiements     | Stripe (phase abonnements)                                            |
| Hébergement   | Vercel (app) + Supabase (données), domaine `cizaimmo.com`              |

## Démarrage

```bash
cd /home/hatch/workspace/cizaimmo
cp .env.example .env.local   # puis renseigner les vraies valeurs Supabase
npm install
npm run dev                  # http://localhost:3000
npm run build                 # build de production
```

### Mode démo / mode réel (Module 1)

- **Sans Supabase configuré** (variables absentes ou placeholders) : l'app
  tourne en **MODE DÉMO** — bandeau doré « MODE DÉMO — données fictives »
  en haut de chaque page, bouton « Continuer en démo » sur la page de
  connexion, données fictives en localStorage (1 propriétaire, 2 immeubles :
  Bujumbura en BIF, Montréal en CAD). Les données démo ne sont jamais
  présentées comme réelles.
- **Avec Supabase configuré** (`.env.local` avec les vraies valeurs) :
  inscription/connexion via Supabase Auth, session persistée, RLS active.
  Pour basculer : renseigner les deux variables puis redémarrer le serveur.

### Exécuter le schéma SQL (une fois, dans Supabase)

1. Créer le projet Supabase (console Supabase) — aucun compte n'est créé
   par ce dépôt.
2. Dashboard Supabase → **SQL Editor** → exécuter les fichiers **dans
   cet ordre** (voir `docs/deploiement-vercel.md` §1) :
   1. `supabase/schema.sql` → **Run** (les 14 tables §13 +
      `gestionnaires_immeubles`, RLS, trigger d'inscription).
   2. `supabase/storage.sql` → **Run** (bucket privé
      `documents-prives` + politiques Storage).
   3. `supabase/module5.sql` → **Run** (tables `factures_abonnement`
      et `paiements_mobile_money`).
3. Le script crée les 14 tables de la spec §13 + la table technique
   `gestionnaires_immeubles` (affectation gestionnaire ↔ immeuble), active
   la RLS partout, crée les politiques (propriétaire / gestionnaire /
   co-propriétaire lecture seule) et le trigger `handle_new_user` qui crée
   le profil + l'abonnement d'essai (plan Pro, 30 jours, sans carte) à
   l'inscription.
4. Vérifier : `select count(*) from pg_tables where schemaname = 'public';`
   doit retourner 15 tables.
5. Dans **Authentication → Providers → Email** : activer la confirmation
   d'e-mail (l'essai démarre à la validation de l'e-mail, spec §3) et
   définir l'URL du site sur `NEXT_PUBLIC_APP_URL` (ex. `http://localhost:3000`
   en local). Aucun e-mail ne part tant que le SMTP Supabase n'est pas
   configuré — en attendant, la confirmation peut se faire depuis le
   dashboard Supabase (utilisateur → Confirm email).

### Variables d'environnement

Voir `.env.example`. Toutes les valeurs credential-shaped sont des **placeholders**
évidents (`https://your-project.supabase.co`, `your-anon-key-here`) — aucune vraie
clé n'est commise. Renseigner `.env.local` (ignoré par git) avec les valeurs du
projet Supabase.

### Module 5 — Abonnement & facturation (spec §12)
- **Plans verrouillés** : Starter 1 bloc (Afrique 1,99 $ / Internationale
  4,99 $), Pro 5 blocs (5,99 $ / 14,99 $), Agence illimité (11,99 $ /
  29,99 $). Grille déterminée par le pays du compte à l'inscription.
- **Essai 30 jours** (plan Pro, sans carte) à l'inscription ; alertes J-7
  et J-1 ; fin d'essai sans abonnement → **lecture seule** (mutations
  refusées avec `ERR_ABONNEMENT_REQUIS`, lecture et exports conservés,
  données 90 jours).
- **Montée immédiate, descente en fin de période** (contrôle de la limite
  de blocs) ; annulation en fin de période ; échec de paiement → grâce
  de 7 jours puis lecture seule.
- **Stripe en MODE TEST uniquement** (compte existant Ciza Group /
  CizaShop ; clé live refusée par le code) : voir
  `docs/stripe-test-setup.md` pour les 6 prix test à créer et les
  variables. Sans clés, l'interface l'affiche honnêtement.
- **Mobile money** (EcoCash, Lumicash, eNoti) : demande → confirmation
  sur le téléphone → activation ; non confirmé sous 24 h → annulé sans
  frais. En démo, confirmation simulée par un bouton étiqueté DÉMO. En
  réel, confirmation uniquement via le webhook
  `/api/mobile-money/webhook` (agrégateur/partenaire local à brancher).
- **Base** : exécuter `supabase/module5.sql` une fois dans Supabase.

### Module 7 — Pages publiques, FR/EN complet, polish, déploiement (spec §4, §14, §15)

- **Pages publiques** (sans connexion, FR + EN) : accueil complétée
  (bénéfices concrets, fonctionnement en 3 étapes, sélecteur de
  devise ouvert `$ USD, € EUR, BIF`, devises supportées, CTA « Commencer
  l'essai gratuit de 30 jours »), `/tarifs` (les 3 plans, deux grilles
  Afrique / Internationale affichées séparément, essai 30 j, paiement
  carte Stripe et mobile money EcoCash / Lumicash / eNoti — **aucun
  témoignage client**, il n'en existe pas de réel), `/contact`
  (formulaire + demande de démo + lien WhatsApp), pages légales
  `/legal/confidentialite`, `/legal/cgu`, `/legal/mentions-legales`,
  `/legal/cookies` (noir sur blanc : CizaImmo n'encaisse pas les
  loyers, données du parc = propriété du propriétaire, conservation
  90 jours en lecture seule après fin d'abonnement). Pied de page
  commun sur toutes les pages publiques : Tarifs, Contact, pages
  légales, bascule de langue FR/EN visible en permanence (choix
  mémorisé).
- **Formulaire Contact** : envoi via Web3Forms
  (`NEXT_PUBLIC_WEB3FORMS_KEY`, clé publique alias de Ciza Group,
  même que cizagroup.com et cizasupply.com). **Sans la clé, le
  formulaire ne prétend pas envoyer** : il bascule honnêtement sur
  un lien mailto vers infos@cizagroup.com, message déjà rédigé.
- **FR/EN complet** : `python3 scripts/i18n-check.py` compare les
  ensembles de clés de `messages/fr.json` et `messages/en.json`
  (1112 clés, 0 écart). Les messages d'alerte générés
  (`lib/module4.ts`) existent désormais en FR et en EN, selon la
  langue du profil. Les libellés du reçu PDF existent dans les deux
  langues (`lib/recu-pdf.ts`, dictionnaire FR/EN). Reste un écart
  connu : les entrées du fil d'actualité sont des messages
  enregistrés en français à leur création (jamais retraduits) —
  voir le rapport du module 7.
- **Polish mobile-first (390 px)** : aucun défilement horizontal au
  niveau de la page (`overflow-x: clip`), champs à 16 px minimum
  (iOS ne zoome pas à la saisie), tableaux repliés en cartes sur
  téléphone ou défilant dans leur propre carte, états vides /
  chargement / erreur avec « Réessayer » sans perte de saisie.
- **Déploiement** : voir `docs/deploiement-vercel.md` (import du
  dépôt, variables obligatoires / optionnelles, ordre des SQL,
  webhooks, domaine `cizaimmo.com`, vérifications après déploiement).
  Aucun `vercel.json` : Next.js sur Vercel n'en exige pas. Le
  dossier n'est pas encore un dépôt Git : c'est la première étape
  du déploiement (voir le document).

### Tests

```bash
bash scripts/run-tests.sh        # modules 3, 4, 5, 6, 7
bash scripts/run-tests.sh 3 5    # seulement les modules demandés
python3 scripts/i18n-check.py    # parité FR/EN des messages
```

Le script compile le harnais une fois dans `.test-build/` (ignoré
par git) puis lance les 5 scripts `scripts/test-module*.cjs` avec
`TEST_BUILD_DIR` pointant dessus. Résultats de référence (module 7) :
module 3 : 46 OK, module 4 : 73 OK, module 5 : 53 OK,
module 6 : 62 OK, module 7 : 19 OK — 0 KO.

## Structure

```
app/[locale]/            Routes localisées (fr par défaut, en)
  page.tsx               Landing marketing (logo v4 dans l'en-tête)
  tarifs/                Page Tarifs dédiée (Module 7 : 3 plans, 2 grilles)
  contact/               Contact / Démo (Module 7 : Web3Forms, sinon mailto)
  legal/                 Pages légales (Module 7 : confidentialité, CGU,
                         mentions légales, cookies — lecture seule)
  a-louer/               Vitrine publique des locations (Module 6)
  connexion/             Connexion e-mail + mot de passe (+ « Continuer en démo »)
  inscription/           Inscription (nom, e-mail, mot de passe, pays, devise, langue)
  mot-de-passe-oublie/   Réinitialisation par e-mail (Supabase)
  nouveau-mot-de-passe/  Choix du nouveau mot de passe (après le lien e-mail)
  dashboard/             Tableau de bord (shell)
  immeubles/             Immeubles & blocs (shell)
  appartements/          Appartements (shell)
  locataires/            Locataires (shell)
  loyers/                Loyers (shell)
  depenses/              Dépenses (shell)
  parametres/            Paramètres (shell + ancrage sécurité / 2FA « bientôt »)
  abonnement/            Abonnement & facturation (Module 5 : plan actuel,
                         comparaison des plans, paiement carte / mobile money,
                         factures, annulation — propriétaire uniquement)
app/api/stripe/checkout/ Session Checkout Stripe (mode test) + état de config
app/api/stripe/webhook/  Webhook Stripe (signature vérifiée, mode test)
app/api/mobile-money/webhook/ Webhook de confirmation mobile money
lib/abonnement.ts        Logique pure des abonnements (prix §12, grilles,
                         transitions paresseuses, lecture seule)
lib/stripe.ts            Stripe serveur uniquement, MODE TEST imposé
lib/facture-pdf.ts       Facture d'abonnement PDF (jsPDF)
lib/supabase-service.ts  Client service_role (webhooks uniquement)
docs/stripe-test-setup.md Les 6 prix test à créer + variables + webhooks
docs/whatsapp-setup.md  WhatsApp Business Platform (API officielle Meta)
docs/deploiement-vercel.md Déploiement Vercel + cizaimmo.com (Module 7)
scripts/run-tests.sh     Tests consolidés modules 3-7 (Module 7)
scripts/i18n-check.py    Parité FR/EN des messages (Module 7)
supabase/module5.sql     Colonnes de fin de période + tables factures_abonnement
                         et paiements_mobile_money (à exécuter une fois)
app/auth/callback/       Callback Supabase Auth (confirmation e-mail, reset)
components/AppShell.tsx  Layout app : sidebar navy + contenu + déconnexion
components/PublicHeader.tsx En-tête des pages publiques (Module 7 : nav + langue)
components/PublicFooter.tsx  Pied de page des pages publiques (Module 7)
components/LanguageSwitcher.tsx Bascule FR/EN, choix mémorisé (Module 7)
components/ContactForm.tsx Formulaire Contact / Démo (Module 7)
components/LegalPage.tsx   Gabarit des pages légales (Module 7)
components/AuthLayout.tsx Mise en page des pages d'auth (navy/or, mobile-first)
components/DemoBanner.tsx Bandeau « MODE DÉMO — données fictives »
components/Field.tsx     Champ de formulaire avec erreur claire sous le champ
lib/supabase.ts          Clients Supabase (navigateur / serveur / middleware)
                         + détection du mode démo/réel
lib/data/                Couche données UNIQUE (interface DataProvider)
  types.ts               Types alignés sur le schéma SQL
  provider.ts            Interface + patron des CRUD du Module 2 (documenté)
  demo.ts                Fournisseur démo (localStorage)
  demo-seed.ts           Données fictives de démo (Bujumbura BIF + Montréal CAD)
  real.ts                Fournisseur réel (Supabase Auth + RLS)
  index.ts               getDataProvider() — point d'entrée unique
lib/countries.ts         Liste des pays du formulaire d'inscription
supabase/schema.sql      Les 14 tables (§13) + gestionnaires_immeubles,
                         RLS, trigger d'inscription (profil + essai Pro 30 j)
messages/fr.json|en.json Dictionnaires next-intl (dont auth, demo, settings)
public/                  Logos (v2 fond clair, v4 fond sombre)
middleware.ts            Routage locales next-intl + protection des routes
                         (redirection vers /connexion si non authentifié)
```

## Roadmap

### Phase 1 — Fondation (cette base)
- [x] Scaffold Next.js + TS + Tailwind + next-intl (FR/EN)
- [x] Branding navy/or, logos, landing FR/EN
- [x] Shells des 7 sections, client Supabase (placeholders)

### Module 1 — Schéma + Auth + couche données (FAIT, 2026-11-06)
- [x] Schéma SQL : 14 tables spec §13 + table technique
  `gestionnaires_immeubles` (affectation gestionnaire ↔ immeuble, absente
  de la spec — voir `supabase/schema.sql`), RLS partout, politiques
  propriétaire / gestionnaire / co-propriétaire lecture seule, trigger
  d'inscription (profil + essai Pro 30 jours, sans carte)
- [x] Couche données unique (`lib/data/`) : mode démo (localStorage,
  données fictives étiquetées DÉMO, bandeau visible partout) / mode réel
  (Supabase Auth) ; interface `DataProvider` posée pour les modules suivants
- [x] Auth FR/EN : inscription, connexion (+ « Continuer en démo »),
  mot de passe oublié + nouveau mot de passe, callback e-mail ;
  routes app protégées dans `middleware.ts` ; ancrage 2FA dans Paramètres
  (proposée, non implémentée)
- [x] Règle dure respectée : aucun encaissement de loyer — seuls les
  paiements déclarés sont tracés ; aucun témoignage inventé ; aucun taux
  présenté comme « en direct » (module des taux : plus tard)
- [ ] Reste externe : créer le projet Supabase et exécuter `supabase/schema.sql`
  (voir « Exécuter le schéma SQL » ci-dessus) — le mode démo couvre l'attente

### Phase 2 — Auth & données (Supabase)
- Auth Supabase (inscription/connexion), isolation des données par utilisateur (RLS)
- Schéma : `buildings` → `units` → `tenants`, `payments`, `expenses`, `documents`, `managers`
- CRUD complet : immeubles/blocs, appartements, locataires (fiches complètes), loyers, dépenses
- Responsables d'immeuble (concierge/gardien/gestionnaire)

### Phase 3 — Pilotage
- ROI par appartement / par immeuble / global ; taux d'occupation & vacance
- Alertes loyers en retard, rappels fin de bail
- Convertisseur de devises (BIF, CAD, USD, EUR…) à taux modifiables
- Reçus de loyer PDF, export Excel comptable

### Phase 4 — SaaS / abonnements (Stripe)
- Plans par nombre de blocs : Starter (1) / Pro (5) / Agence (illimité)
- **Double grille** : Afrique (1,99 / 5,99 / 11,99 $/mois) vs Internationale (4,99 / 14,99 / 29,99 $/mois)
- Essai gratuit 30 jours, -20 % annuel, factures automatiques
- Mobile money africain (phase 2 du paiement — Stripe seul ne suffit pas)

### Phase 5 — Lancement
- Pages légales : CGU, politique de confidentialité
- Déploiement Vercel + `cizaimmo.com`, tests multi-appareils
- Dogfooding : usage réel avant ouverture des abonnements
