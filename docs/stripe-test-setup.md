# CizaImmo — Abonnements : Stripe (mode test) + mobile money

Module 5, spec §12. **Règles absolues :**

- On utilise le compte Stripe **EXISTANT** de Ciza Group / CizaShop, en
  **MODE TEST** d'abord. **Ne créez JAMAIS un nouveau compte Stripe.**
- **Aucun débit réel** : cartes de test uniquement (`4242 4242 4242 4242`,
  expiration future, CVC quelconque). Une clé live (`sk_live_…`) est
  **refusée** par le code (`lib/stripe.ts`) : Stripe est alors considéré
  comme non configuré.
- Sans clés, l'interface affiche honnêtement « Stripe non configuré —
  mode test » et ne prétend **jamais** qu'un paiement a réussi. En mode
  démo, le changement de plan est simulé et étiqueté **DÉMO**.

## 1. Prix à créer dans le compte test existant

Dans le Dashboard Stripe, **basculer en mode Test** (interrupteur en
haut), puis **Produits → Ajouter un produit** (ou Catalogue des prix).
Créer **6 prix récurrents mensuels** (en USD, abonnement mensuel) :

| Plan | Grille | Nom du prix (suggéré) | Montant mensuel | Variable d'environnement |
|---|---|---|---|---|
| Starter | Afrique | CizaImmo Starter — Afrique | **2,00 $** (200 cents) | `STRIPE_PRICE_AFRIQUE_STARTER` |
| Pro | Afrique | CizaImmo Pro — Afrique | **5,99 $** (599 cents) | `STRIPE_PRICE_AFRIQUE_PRO` |
| Agence | Afrique | CizaImmo Agence — Afrique | **11,99 $** (1199 cents) | `STRIPE_PRICE_AFRIQUE_AGENCE` |
| Starter | Internationale | CizaImmo Starter — Internationale | **4,99 $** (499 cents) | `STRIPE_PRICE_INTERNATIONALE_STARTER` |
| Pro | Internationale | CizaImmo Pro — Internationale | **14,99 $** (1499 cents) | `STRIPE_PRICE_INTERNATIONALE_PRO` |
| Agence | Internationale | CizaImmo Agence — Internationale | **29,99 $** (2999 cents) | `STRIPE_PRICE_INTERNATIONALE_AGENCE` |

Montants verrouillés (spec §12). Pour chaque prix, copier son
identifiant (`price_…`) dans `.env.local` (voir §2). La grille
applicable est déterminée par le pays du compte à l'inscription ; un
changement de pays ne change pas la grille en cours de période.

## 2. Variables à remplir dans `.env.local`

```bash
# Clés TEST du compte Stripe existant (Développeurs → Clés API, mode test)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# Secret du webhook (Développeurs → Webhooks, voir §3)
STRIPE_WEBHOOK_SECRET=whsec_...

# Identifiants des 6 prix test (voir §1)
STRIPE_PRICE_AFRIQUE_STARTER=price_...
STRIPE_PRICE_AFRIQUE_PRO=price_...
STRIPE_PRICE_AFRIQUE_AGENCE=price_...
STRIPE_PRICE_INTERNATIONALE_STARTER=price_...
STRIPE_PRICE_INTERNATIONALE_PRO=price_...
STRIPE_PRICE_INTERNATIONALE_AGENCE=price_...

# Clé service Supabase (webhooks uniquement, jamais côté client)
SUPABASE_SERVICE_ROLE_KEY=...
```

Ne commitez **jamais** `.env.local`. Les placeholders sont dans
`.env.example`.

## 3. Webhook Stripe (mode test)

1. Dashboard Stripe (mode test) → **Développeurs → Webhooks →
   Ajouter un endpoint**.
2. URL : `https://<domaine>/api/stripe/webhook` (en local, utilisez
   `stripe listen --forward-to localhost:3000/api/stripe/webhook` avec
   la CLI Stripe ; le secret affiché par `stripe listen` va dans
   `STRIPE_WEBHOOK_SECRET`).
3. Événements à écouter : `checkout.session.completed`,
   `invoice.payment_failed`, `customer.subscription.deleted`.
4. La route vérifie la signature avec `STRIPE_WEBHOOK_SECRET` et
   applique : activation du plan payé, grâce de 5 jours en cas d'échec (décision Ciza 2026-11-07 : 5 jours partout, paramètre base déjà à 5)
   de paiement, résiliation effective en fin de période.
5. **Sans `SUPABASE_SERVICE_ROLE_KEY`**, le webhook accuse réception
   (HTTP 200) mais **n'applique rien** (`applied: false`) — jamais de
   fausse activation. La clé service se trouve dans Supabase →
   Paramètres → API → `service_role` (à garder secrète, serveur
   uniquement).

## 4. Base de données (Supabase)

Exécuter **une fois** le fichier `supabase/module5.sql` dans le SQL
Editor de Supabase (après `supabase/schema.sql`) : il ajoute les
colonnes de fin de période sur `abonnements` et crée les tables
`factures_abonnement` et `paiements_mobile_money` (RLS : propriétaire
uniquement).

## 5. Mobile money — EcoCash, Lumicash, eNoti

Flux (spec §12) : la demande de paiement est envoyée sur le numéro du
propriétaire, qui la confirme sur son téléphone ; l'abonnement ne
s'active ou ne se renouvelle qu'**APRÈS** confirmation reçue. Un
paiement non confirmé sous **24 heures** est annulé et signalé, sans
frais.

- **En démo**, la confirmation est simulée par un bouton explicitement
  étiqueté « Simuler la confirmation (démo) » — jamais présenté comme
  un vrai paiement.
- **En réel**, la confirmation arrive par le webhook
  `POST /api/mobile-money/webhook` (`{ reference: "MM-XXXXXXXX",
  statut: "confirme" | "annule" }`), qui valide la référence et active
  l'abonnement. Sans fournisseur branché, la demande reste « en
  attente de confirmation » avec ses instructions, sans jamais
  prétendre être payée.
- **L'automatisation complète dépend d'un agrégateur / partenaire
  local** (à choisir et à brancher par le fondateur) : aucun numéro de
  paiement ni partenaire n'est inventé dans ce dépôt. Le partenaire
  devra appeler le webhook ci-dessus à chaque confirmation (ou
  annulation) de paiement, avec la référence `MM-…` fournie au client.

## 6. Cartes de test Stripe

- Succès : `4242 4242 4242 4242`, expiration future, CVC quelconque.
- Échec (pour tester la grâce de 5 jours) : `4000 0000 0000 0002`
  (carte refusée).
- Authentification 3-D Secure : `4000 0025 0000 3155`.

## 7. Passage en production (plus tard, sur décision du fondateur)

1. Créer les **mêmes 6 prix** dans le compte Stripe en **mode live**.
2. Remplacer les variables par les clés live et les `price_…` live.
3. Recréer l'endpoint webhook en mode live et mettre à jour
   `STRIPE_WEBHOOK_SECRET`.
4. Retirer le garde-fou « test uniquement » de `lib/stripe.ts`
   **seulement** à ce moment-là, sur décision explicite du fondateur.
