# Boîte de réception console + badge « Messages » — 2026-11-07

## Déclencheur (test réel du fondateur)

Un message cliente (« Bonjour test », Kaneza Rehema, CIM-000002) était
bien arrivé dans le fil plateforme de son Dossier — vérifié en base :
`lu_par_plateforme = false`, conversation de type `plateforme` — mais
**rien ne le signalait dans la console** :

- « Mes dossiers » ne liste que les dossiers **assignés** à l'Admin
  connecté ; le dossier de Kaneza est **non assigné**
  (`admin_responsable_id` NULL).
- « Messages supervisés » ne montre que les fils **rattachement**
  (propriétaire ↔ gestionnaire, lecture seule).

Décision du fondateur : « on doit ajouter les notifications et un
badge ». Modèle verrouillé respecté : **l'assignation est une
responsabilité, pas une restriction d'accès** — la politique RLS
`conversations_select` autorise déjà `est_admin_plateforme()` sur
tous les fils ; il ne manquait que la surface console.

**Aucun SQL, aucune modification du modèle de données** : les
colonnes v1.5 (`conversations`, `messages_directs.lu_par_plateforme`)
suffisent.

## Ce qui est construit

### 1. Compteur plateforme (provider, réel + miroir démo)

Deux méthodes ajoutées à l'interface (`lib/data/provider.ts`),
implémentées dans `real.ts` et `demo.ts` :

- `listerConversationsPlateforme()` : **tous** les fils de type
  `plateforme` (assignés ou non), enrichis (client, Display ID,
  responsable, dernier message), triés par **dernier message
  décroissant**. Le `non_lus` de chaque fil compte **uniquement les
  messages du client** : `expediteur_id = proprietaire_id` ET
  `lu_par_plateforme = false` — jamais les messages d'un autre
  membre de l'équipe (paramètre dédié dans `enrichirConversations`
  côté réel, helper `enrichirConversationPlateforme` côté démo).
- `compterMessagesPlateformeNonLus()` : somme des `non_lus` de la
  boîte — le badge égale donc **par construction** la somme des
  pastilles de la page Messages. Réservé plateforme
  (`acteurPlateforme`, ERR_ACCES_PLATEFORME sinon).

### 2. Entrée « Messages » + pastille (ConsoleShell)

Nouvelle entrée de la barre latérale, entre « Mes dossiers » et
« Messages supervisés », vers `/console/messages`. Pastille compteur
**or, texte marine** (inversée sur le lien actif), affichée
**seulement si le total > 0**. Le compteur se recalcule à chaque
navigation : après la lecture d'un fil dans un Dossier, la pastille
retombe dès le retour dans la console. Visible pour Admin **et**
Super Admin (et dans le tiroir mobile, même composant de liens).

### 3. Page `/console/messages` — boîte de réception plateforme

Liste de toutes les conversations plateforme, triées par dernier
message décroissant. Par ligne : nom du client + **Display ID**,
e-mail, Admin responsable (ou **« Non assigné »** mis en évidence),
aperçu + date/heure du dernier message, **pastille de non-lus** de
la conversation. Le titre porte le total. Clic sur une ligne →
**Dossier du client, ancre `#messages`** (la section du fil du
Dossier porte désormais `id="messages"`). État vide propre,
bilingue FR/EN.

### 4. Bloc notification — Vue d'ensemble de la console

Carte « Messages clients non lus » : total + les **3 conversations
non lues les plus récentes** (nom du client + aperçu, pastille),
lien « Ouvrir la boîte de réception ». **Mise en évidence ambre**
dès que le total > 0 ; carte calme (blanche) à zéro avec le texte
« Aucun message client en attente de lecture. ».

### 5. Marquage lu — vérifié

L'ouverture du fil dans le Dossier rend `FilMessages` avec
`marquerLuAuto` (défaut) : `marquerLu` passe `lu_par_plateforme =
true` pour les messages des autres (réel : politique UPDATE
plateforme sur les fils `plateforme` ; démo : miroir). Le test B
prouve la chaîne complète : compteur à 1 → ouverture façon Dossier
→ compteur à 0, pastille de la conversation à 0. Le badge du shell
se recalcule à la navigation suivante.

## i18n

7 clés `console.*` ajoutées en FR et EN (parité stricte 1774 = 1774,
contrôle des clés utilisées OK) : `messages`, `messagesTitle`,
`messagesSubtitle`, `messagesEmpty`, `unreadMessagesTitle`,
`unreadMessagesNone`, `viewInbox`. Réutilisation des clés `v15.*`
existantes (`unread`, `responsible`, `unassigned`, `noMessages`).

## Tests

Nouveau bloc `scripts/test-console-messages-badge.cjs` (branché
dans `run-tests.sh` avec les contrôles i18n) : **25 OK / 0 KO**,
dont **le cas de régression exact de ce soir** en fournisseur démo —
cliente non assignée (précondition vérifiée : `admin_responsable_id`
NULL) envoie « Bonjour test » → compteur = 1 pour le Super Admin
**et** pour un Admin non responsable, conversation présente dans
la boîte avec `non_lus = 1` ; une réponse plateforme ne gonfle pas
le compteur ; l'ouverture du fil fait retomber le compteur à 0 ;
tri par dernier message décroissant ; garde client
(ERR_ACCES_PLATEFORME). Suite complète verte, build OK.

## Preuve finale (fondateur)

Ouvrir la console : la pastille « Messages » doit afficher **1**
(le « Bonjour test » de Kaneza, toujours non lu côté plateforme) ;
la page Messages liste son fil (« Non assigné ») ; un clic ouvre son
Dossier directement sur le fil ; après lecture, la pastille
disparaît.
