# Nettoyage « langage client » (2026-11-07)

Suite du correctif bandeau Stripe (commit 30e98e0d) : le balayage avait
repéré 6 autres textes en langage développeur visibles par les clients.
Le fondateur a donné la main pour en convertir 5 en langage client, en
**gardant tel quel** le bandeau « Stripe en MODE TEST » (clé
`stripeTestMode`) — il protège pendant la phase test et ne sera retiré
qu'au passage en production réelle.

## Les 5 textes convertis

### 1. Erreur API au clic « Payer par carte » (`app/api/stripe/checkout/route.ts`)

- Avant : « Stripe n'est pas configuré (mode test). Renseignez les clés
  test dans .env.local. »
- Après : « Le paiement par carte n'est pas encore disponible. Vous
  serez prévenu dès son ouverture — aucun montant ne sera prélevé sans
  votre accord. »

C'était le texte le plus exposé : la page Abonnement affiche le message
de la route tel quel (`corps.message`), donc c'est lui que la cliente
voyait, avant même le bandeau adouci au commit précédent.
**Remarque** : les messages de cette route sont en français uniquement
(comportement inchangé par ce correctif).

### 2. Erreur API « prix manquant » (même fichier)

- Avant : « Identifiant de prix Stripe manquant pour ce plan (voir
  docs/stripe-test-setup.md). »
- Après : « Ce pack n'est pas encore ouvert au paiement par carte. »

### 3. Bouton « Payer par carte » (clé `payByCard`)

- FR avant : « Payer par carte (Stripe, mode test) » → après : « Payer
  par carte »
- EN avant : « Pay by card (Stripe, test mode) » → après : « Pay by
  card »

### 4. Note WhatsApp de la page Paramètres (clé `whatsappNote`)

- FR avant : « WhatsApp : envoi via l'API officielle Meta (WhatsApp
  Business Platform). Sans configuration (token + numéro), aucun
  message n'est envoyé — le statut « non configuré » est affiché. Voir
  docs/whatsapp-setup.md. »
- FR après : « WhatsApp : envoi via l'API officielle Meta (WhatsApp
  Business Platform). Les alertes WhatsApp arrivent bientôt — tant
  qu'elles ne sont pas activées, aucun message n'est envoyé. »
- EN adapté de la même façon (« WhatsApp alerts are coming soon — until
  they are enabled, no message is sent. »).

### 5. Bouton d'envoi WhatsApp (clé `notConfigured`)

- FR avant : « WhatsApp non configuré : aucun message envoyé. Voir
  docs/whatsapp-setup.md. »
- FR après : « WhatsApp arrive bientôt : aucun message n'a été
  envoyé. »
- EN avant : « WhatsApp not configured: no message sent. See
  docs/whatsapp-setup.md. »
- EN après : « WhatsApp is coming soon: no message was sent. »

## Non touché (volontairement)

- Clé `stripeTestMode` : « Stripe en MODE TEST : cartes de test
  uniquement (4242 4242 4242 4242…), aucun débit réel. » — conservée
  telle quelle sur décision du fondateur.
- Aucune logique modifiée ; les codes d'erreur API (`error`) sont
  inchangés, seuls les messages affichables changent.

## Vérifications

- Parité i18n stricte : 1767 clés FR = 1767 EN (aucune clé ajoutée ni
  retirée) ; contrôle des clés utilisées relancé : OK.
- Suite complète verte : `bash scripts/run-tests.sh` (exit 0 — « Tous
  les tests demandés sont passés »).
- Build OK (exit 0). Aucun SQL, aucune donnée touchée.

**Preuve finale restant au fondateur** (déploiement Vercel automatique
sur push) : page Abonnement de Kaneza → le bouton dit maintenant
simplement « Payer par carte » ; un clic affiche le message client
n° 1 ci-dessus (Stripe toujours non configuré).
