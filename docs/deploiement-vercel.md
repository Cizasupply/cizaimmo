# Déploiement CizaImmo sur Vercel — cizaimmo.com

Guide de déploiement de la version complète (modules 1 à 7, spec v1.1).
**On ne déploie rien ici : ce document décrit les étapes exactes à
suivre par le fondateur.** Aucun compte n'est créé par ce dépôt.

## Prérequis (comptes externes, dans l'ordre)

1. **Projet Supabase** créé (console Supabase) — base + Auth + Storage.
   Le code ne crée aucun compte Supabase.
2. **Dépôt Git** contenant ce dossier (`~/workspace/cizaimmo`) — Vercel
   importe depuis Git (GitHub, GitLab ou Bitbucket). Le dossier n'est
   **pas** encore un dépôt Git : il faut d'abord faire `git init`,
   puis pousser vers le dépôt distant choisi.
3. **Compte Vercel** (plan gratuit suffisant pour commencer) connecté
   au même fournisseur Git.
4. **Stripe — compte EXISTANT Ciza Group / CizaShop, en MODE TEST
   d'abord.** Ne jamais créer un nouveau compte Stripe. Voir
   `docs/stripe-test-setup.md` pour les 6 prix test à créer.
5. **WhatsApp Business Platform (Meta)** — optionnel au lancement :
   sans configuration, le statut affiché est « non configuré » et
   aucun envoi n'est effectué. Voir `docs/whatsapp-setup.md`.
   Point ouvert : le numéro +1 514 502 9503 est utilisé en manuel
   dans l'application WhatsApp Business — migrer ce numéro vers
   l'API ou utiliser un autre numéro pour les alertes automatiques.
6. **Clé publique Web3Forms** (alias d'e-mail, pas un secret) — la
   même que sur cizagroup.com et cizasupply.com. Sans elle, le
   formulaire Contact bascule honnêtement sur un lien mailto vers
   infos@cizagroup.com.
7. **Fournisseur d'e-mail** (Resend, SendGrid, Mailgun…) — optionnel
   au lancement : sans lui, les alertes affichent « e-mail non
   configuré » et aucun e-mail n'est simulé.

## 1. Base Supabase : exécuter les SQL, dans cet ordre

Dans le dashboard Supabase du projet → **SQL Editor** → coller le
contenu de chaque fichier → **Run**, dans l'ordre suivant :

| Ordre | Fichier | Contenu |
|-------|---------|---------|
| 1 | `supabase/schema.sql` | Les 14 tables (§13) + table technique `gestionnaires_immeubles`, RLS partout, politiques propriétaire / gestionnaire / co-propriétaire lecture seule, trigger `handle_new_user` (profil + essai Pro 30 jours à l'inscription) |
| 2 | `supabase/storage.sql` | Bucket privé `documents-prives` + politiques Storage (lecture/écriture limitées au propriétaire, liens signés temporaires) |
| 3 | `supabase/module5.sql` | Colonnes de fin de période + tables `factures_abonnement` et `paiements_mobile_money` (abonnements) |

Vérification après l'étape 1 :
`select count(*) from pg_tables where schemaname = 'public';`
doit retourner **15 tables**.

Puis, dans **Authentication → Providers → Email** : activer la
confirmation d'e-mail (l'essai démarre à la validation de l'e-mail)
et définir l'URL du site sur `NEXT_PUBLIC_APP_URL` (l'URL Vercel,
puis `https://cizaimmo.com` une fois le domaine branché).

## 2. Import du dépôt dans Vercel

1. Vercel → **Add New → Project** → **Import Git Repository** →
   choisir le dépôt contenant ce dossier.
2. Framework : **Next.js** (détecté automatiquement).
3. Root Directory : le dossier du projet si le dépôt contient
   d'autres choses, sinon la racine.
4. Build Command : `npm run build` (défaut). Output : défaut Next.js.
5. **Aucun `vercel.json` n'est nécessaire** : Next.js sur Vercel
   fonctionne sans, et ce dépôt n'en contient volontairement pas.
6. **Ne pas** lancer le déploiement avant l'étape 3 (variables
   d'environnement) : sans les variables Supabase, l'application se
   déploie en **MODE DÉMO** (données fictives, bandeau doré visible).

## 3. Variables d'environnement (Vercel → Settings → Environment Variables)

Copier `.env.example` comme référence. Toutes les valeurs en
`..._placeholder` doivent être remplacées par les vraies valeurs.

### Obligatoires (sans elles : mode démo, pas de données réelles)

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase (`https://….supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme (publique) Supabase |
| `NEXT_PUBLIC_APP_URL` | `https://cizaimmo.com` (ou l'URL `*.vercel.app` avant le domaine) |

### Obligatoires pour les abonnements par carte (Stripe, MODE TEST)

| Variable | Valeur |
|----------|--------|
| `STRIPE_SECRET_KEY` | Clé secrète **test** (`sk_test_…`) — une clé live (`sk_live_…`) est **refusée** par le code |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe (voir `docs/stripe-test-setup.md`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clé publique test (`pk_test_…`) |
| `STRIPE_PRICE_AFRIQUE_STARTER` / `_PRO` / `_AGENCE` | Les 6 prix test créés dans Stripe (voir `docs/stripe-test-setup.md`) |
| `STRIPE_PRICE_INTERNATIONALE_STARTER` / `_PRO` / `_AGENCE` | Idem |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role Supabase — **serveur uniquement**, pour les webhooks Stripe / mobile money. Sans elle, les webhooks accusent réception sans rien appliquer (aucune fausse activation). |

### Optionnelles (fonctionnement dégradé honnête si absentes)

| Variable | Effet si absente |
|----------|------------------|
| `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp « non configuré » : aucun envoi, statut affiché (voir `docs/whatsapp-setup.md`) |
| `NEXT_PUBLIC_WEB3FORMS_KEY` | Formulaire Contact → bascule mailto vers infos@cizagroup.com |
| `EMAIL_API_URL`, `EMAIL_API_KEY` | Alertes e-mail « non configuré » : aucun envoi simulé |
| `TAUX_API_URL` | Défaut : `https://open.er-api.com/v6/latest/USD` (gratuit, sans clé) |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | Défaut : `fr` |

Après chaque modification de variable : **Redeploy** (Vercel →
Deployments → ⋯ → Redeploy) — les variables ne s'appliquent qu'au
déploiement suivant.

## 4. Webhooks

- **Stripe** : dans le dashboard Stripe (mode test) → Developers →
  Webhooks → ajouter l'endpoint
  `https://cizaimmo.com/api/stripe/webhook`, événements
  `checkout.session.completed`, `invoice.paid`,
  `invoice.payment_failed`, `customer.subscription.deleted`
  (voir `docs/stripe-test-setup.md`). Copier le secret dans
  `STRIPE_WEBHOOK_SECRET`.
- **Mobile money** : l'endpoint
  `https://cizaimmo.com/api/mobile-money/webhook` attend la
  confirmation du partenaire / agrégateur local (EcoCash, Lumicash,
  eNoti). Tant qu'aucun partenaire n'est branché, les demandes
  mobile money expirent après 24 h sans activation et sans frais.

## 5. Domaine cizaimmo.com (DNS)

1. Vercel → projet → **Settings → Domains** → ajouter `cizaimmo.com`
   (et `www.cizaimmo.com` si souhaité).
2. Chez le registrar du domaine, ajouter les enregistrements DNS
   indiqués par Vercel (enregistrement `A` vers `76.76.21.21` et/ou
   `CNAME` vers `cname.vercel-dns.com` — **suivre exactement les
   valeurs affichées par Vercel**, elles peuvent varier).
3. Attendre la propagation DNS (quelques minutes à quelques heures),
   puis vérifier que `https://cizaimmo.com` répond (certificat
   HTTPS automatique Vercel).
4. Mettre à jour `NEXT_PUBLIC_APP_URL` avec `https://cizaimmo.com`
   et l'URL du site dans Supabase Auth, puis **redeployer**.

## 6. Vérifications après déploiement

Dans l'ordre, sur l'URL déployée (d'abord `*.vercel.app`, puis
`https://cizaimmo.com`) :

1. **Build** : le déploiement Vercel est vert (`npm run build`
   passe en local avant toute poussée — voir README).
2. **Pages publiques FR** : `/`, `/tarifs`, `/contact`,
   `/legal/confidentialite`, `/legal/cgu`, `/legal/mentions-legales`,
   `/legal/cookies`, `/a-louer` — toutes en HTTP 200, sans
   défilement horizontal à 390 px.
3. **Pages publiques EN** : `/en`, `/en/tarifs`, `/en/contact`,
   `/en/legal/confidentialite`, `/en/a-louer` — même contrôle.
4. **Bascule de langue** : le lien « English / Français » change
   de langue et le choix est mémorisé.
5. **Connexion démo** : `/connexion` → « Continuer en démo » →
   le tableau de bord affiche le parc démo (Bujumbura BIF +
   Montréal CAD) avec le bandeau doré « MODE DÉMO ».
6. **Inscription réelle** (une fois Supabase branché) : créer un
   compte, valider l'e-mail → essai Pro 30 jours actif, création
   d'1 immeuble avec ses appartements en une session sur téléphone.
7. **Abonnement** : `/abonnement` affiche le plan, les deux
   grilles, et (en mode test) le paiement par carte Stripe test
   et la demande mobile money.
8. **WhatsApp / e-mail** : si non configurés, les statuts affichés
   sont « non configuré » — c'est le comportement attendu, pas
   une erreur.

## 7. Retours en arrière

- **Annuler un déploiement** : Vercel → Deployments → choisir un
  déploiement antérieur → ⋯ → **Promote to Production**.
- **Revenir en mode démo** : retirer les deux variables Supabase
  et redeployer (aucune donnée réelle n'est touchée).
- **Données** : aucune donnée n'est jamais supprimée par un
  déploiement ; après la fin d'un abonnement, lecture seule
  pendant 90 jours, puis suppression (voir CGU).
