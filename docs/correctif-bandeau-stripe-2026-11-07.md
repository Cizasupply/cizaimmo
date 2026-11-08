# Correctif — bandeau Stripe en langage client (2026-11-07)

## Demande du fondateur
Le bandeau affiché sur la page **Abonnement** de l'espace connecté quand Stripe
n'est pas configuré parlait en langage développeur. Validé par lui : adoucir le
texte en langage client.

## Avant
- FR : « Stripe non configuré — mode test. Renseignez les clés test dans
  .env.local (voir docs/stripe-test-setup.md) pour activer le paiement par
  carte. »
- EN : « Stripe not configured — test mode. Set the test keys in .env.local
  (see docs/stripe-test-setup.md) to enable card payment. »

## Après (clé i18n existante `stripeNotConfigured`, messages/fr.json + en.json)
- FR : « Le paiement par carte arrive bientôt. Vous serez prévenu avant la fin
  de votre essai — aucun montant ne sera prélevé sans votre accord. »
- EN : « Card payment is coming soon. We will let you know before your trial
  ends — nothing will be charged without your agreement. »

## Périmètre
- Seul le **texte** change (valeur de la clé existante, aucune clé ajoutée ni
  renommée). La condition d'affichage (`stripeConfig.configured === false`,
  hors démo) et toute la logique sont inchangées.
- La même clé sert aussi de message de repli quand le checkout par carte
  échoue : ce repli devient donc lui aussi en langage client.

## Balayage associé (lecture seule — NON modifiés, décision du fondateur)
Autres textes en langage développeur visibles par les clients, repérés le même
jour et laissés tels quels :
1. `app/api/stripe/checkout/route.ts:51` — message d'erreur API affiché tel
   quel par la page Abonnement : « Stripe n'est pas configuré (mode test).
   Renseignez les clés test dans .env.local. »
2. `app/api/stripe/checkout/route.ts:92` — « Identifiant de prix Stripe
   manquant pour ce plan (voir docs/stripe-test-setup.md). » (même canal).
3. `messages/*.json` clé `payByCard` — « Payer par carte (Stripe, mode test) »
   (bouton, page Abonnement).
4. `messages/*.json` clé `stripeTestMode` — « Stripe en MODE TEST : cartes de
   test uniquement (4242 4242 4242 4242…), aucun débit réel. » (bandeau page
   Abonnement quand Stripe est configuré).
5. `messages/*.json` clé `whatsappNote` — « …Voir docs/whatsapp-setup.md. »
   (page Paramètres).
6. `messages/*.json` clé `notConfigured` — « WhatsApp non configuré : aucun
   message envoyé. Voir docs/whatsapp-setup.md. » (bouton d'envoi WhatsApp).
