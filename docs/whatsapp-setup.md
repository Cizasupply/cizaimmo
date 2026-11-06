# WhatsApp — API officielle Meta « WhatsApp Business Platform »

CizaImmo envoie des messages WhatsApp (alertes loyer en retard / fin de bail,
renvoi des reçus, relance de loyer) par l'**API officielle Meta**, pas par un
fournisseur tiers et jamais par simulation : si l'API n'est pas configurée,
le statut affiché est **« non configuré »** et aucun envoi n'est effectué.

> **POINT OUVERT — choix du fondateur, non tranché ici.**
> Le numéro **+1 514 502 9503** est utilisé en **manuel** dans l'application
> WhatsApp Business (sur le téléphone). Un numéro de téléphone ne peut pas
> être à la fois dans l'application WhatsApp Business et dans l'API
> WhatsApp Business Platform : il faut choisir l'une des deux options :
>
> 1. **Migrer le numéro +1 514 502 9503 vers l'API** — l'application
>    WhatsApp Business ne pourra plus l'utiliser en manuel (les messages
>    reçus sur ce numéro arriveront dans l'API, pas dans l'appli) ;
> 2. **Utiliser un autre numéro pour les alertes automatiques** — garder
>    +1 514 502 9503 en manuel (contact humain) et brancher un deuxième
>    numéro (par exemple un numéro dédié aux notifications) dans l'API.
>
> Tant que ce choix n'est pas fait, CizaImmo reste en mode « non configuré »
> et les relances continuent par les liens `mailto:` / `wa.me` déjà en place.

## 1. Créer l'application Meta

1. Aller sur [developers.facebook.com](https://developers.facebook.com) et
   se connecter avec le compte Meta de Ciza Group.
2. **Mes applications → Créer une application** → type **Entreprise**
   (Business).
3. Nom de l'application : par exemple `CizaImmo` ; e-mail de contact :
   l'e-mail professionnel de Ciza Group.
4. Dans le tableau de bord de l'application, **Ajouter un produit →
   WhatsApp**.

## 2. Obtenir le numéro et le token

1. Dans **WhatsApp → Configuration de l'API**, noter le
   **Phone number ID** (`WHATSAPP_PHONE_NUMBER_ID`).
2. Créer un **token d'accès permanent** :
   - Aller dans **Paramètres de l'entreprise → Utilisateurs système**,
     créer un utilisateur système avec l'accès à l'application WhatsApp,
     puis **Générer un nouveau token** (autorisation
     `whatsapp_business_messaging`).
   - Le token temporaire fourni dans la console Meta expire en 24 h : il
     sert uniquement aux tests, jamais en production.
3. Renseigner les deux variables dans l'environnement du serveur (Vercel →
   Settings → Environment Variables, ou fichier `.env.local` en local) :
   - `WHATSAPP_API_TOKEN=<token permanent>`
   - `WHATSAPP_PHONE_NUMBER_ID=<phone number id>`
4. **Ne jamais** mettre ces valeurs dans le code, dans `.env.example`, ni
   dans une variable `NEXT_PUBLIC_*` (elles arriveraient dans le navigateur).

## 3. Modèles de message (templates)

L'API WhatsApp n'autorise l'envoi de messages **hors fenêtre de 24 h**
qu'avec des **modèles approuvés par Meta** (message template). Créer les
modèles dans **WhatsApp → Gestionnaire de modèles de message** (ou
Business Manager → Modèles de message WhatsApp) :

| Modèle | Usage | Exemple de contenu |
|---|---|---|
| `alerte_loyer_retard` | Alerte loyer en retard | `Bonjour {{1}}, votre loyer de {{2}} pour {{3}} reste impayé ({{4}}). Merci de régulariser.` |
| `alerte_fin_bail` | Alerte fin de bail | `Bonjour {{1}}, le bail de {{2}} se termine le {{3}}. Pensez au renouvellement ou à l'état des lieux.` |
| `recu_loyer` | Renvoi de reçu | `Bonjour {{1}}, voici votre reçu n° {{2}} pour {{3}} ({{4}}).` |
| `relance_loyer` | Relance de loyer | `Bonjour {{1}}, rappel : votre loyer de {{2}} pour {{3}} est dû. Montant restant : {{4}}.` |

Chaque modèle doit être **approuvé par Meta** avant usage (délai usuel :
quelques heures). Les messages envoyés par CizaImmo aujourd'hui sont des
messages **texte libre** (`type: "text"`) : ils ne fonctionnent que dans la
fenêtre de 24 h après le dernier message du destinataire. Quand les modèles
ci-dessus sont approuvés, `lib/whatsapp.ts` pourra être étendu pour les
utiliser (fonction `envoyerWhatsAppTemplate`) sans toucher aux écrans.

## 4. Tester

1. Configurer les variables, redémarrer le serveur.
2. Sur la page **Alertes**, cliquer sur **« Envoyer par WhatsApp (API) »**
   sur une alerte loyer en retard ou fin de bail : le statut affiché passe
   à **« envoyé »** (avec l'identifiant du message) ou **« échec »** (avec
   le détail de l'erreur Meta). Un échec n'empêche jamais l'affichage de
   l'alerte ni l'envoi par e-mail.
3. Sans les variables configurées, le même bouton affiche
   **« WhatsApp non configuré »** et n'envoie rien.

## 5. Règles de CizaImmo

- Envois **uniquement** vers des numéros valides (format international,
  normalisé par `normaliserNumeroWhatsApp`) ayant accepté ce canal
  (préférences de notification : canal WhatsApp).
- **Aucune donnée d'un autre bien ni d'un autre locataire** dans un message.
- Aucun envoi automatique côté navigateur : l'appel passe toujours par la
  route serveur `POST /api/whatsapp/envoyer`, qui lit le token côté
  serveur uniquement.
- Facturation : Meta facture **par conversation** (quelques centimes par
  message), il n'y a pas d'abonnement mensuel Meta pour l'API.
