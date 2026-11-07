# CizaImmo — Extension v1.2 : Admin / Super Admin + Finances dynamiques

Document de référence de construction (intègre le §2 de la spécification v1.1,
qui ne prévoyait pas d'admin, et le §12 pour les finances). Schéma validé par
le fondateur : `cizaimmo-schema-compte-admin-v2.pdf` (diagramme + matrice des
accès). Décisions prises par le fondateur le 2026-11-06 — verrouillées, elles
ne se rediscutent pas pendant la construction.

## 1. Décisions verrouillées

### Rôles plateforme

- **SUPER ADMIN** : compte unique du fondateur (Ciza Group). Voit tout.
  Crée / suspend / retire les comptes Admin. **Suppression DÉFINITIVE d'un
  compte : Super Admin uniquement.** **Paramètres plateforme : Super Admin
  uniquement.**
- **ADMIN** : employés de Ciza Group. Voit tous les comptes clients,
  suspend / réactive un compte, envoie des avis, suit les retards de
  paiement des abonnements. Ne peut **ni** créer d'Admin, **ni** supprimer
  définitivement un compte, **ni** modifier les paramètres.
- **Connexion prioritaire** : après connexion, un compte `super_admin` ou
  `admin` est redirigé vers la **Console plateforme** (`/console`), jamais
  vers le tableau de bord client.
- **Création d'un compte Admin (mode réel)** : l'employé s'inscrit d'abord
  normalement avec son e-mail professionnel ; le Super Admin le **promeut**
  ensuite au rôle `admin` depuis la console (aucune création de compte Auth
  n'est possible depuis le client navigateur). « Retirer » un Admin =
  rétrograder son rôle à `proprietaire` (le compte et ses données restent).

### Avis aux comptes

- **Modèles prédéfinis uniquement, aucun texte libre** :
  `retard_paiement`, `fin_essai` (fin d'essai proche), `compte_suspendu`,
  `compte_reactive`. Variables autorisées : `{nom}`, `{plan}`, `{date}`.
- Le corps de l'avis est rendu depuis le modèle (FR/EN selon la langue du
  compte destinataire) par `lib/avis.ts` — fonctions pures, testées.
- Chaque avis envoyé est **journalisé** (table `avis`) et tracé au journal
  d'audit. L'envoi e-mail suit la règle d'honnêteté des alertes (§10) :
  fournisseur non configuré → statut `non_configuré`, jamais de faux envoi.

### Gestionnaire multi-rattachements

- Un gestionnaire peut être rattaché **à Ciza Group ET à des propriétaires
  clients**, en parallèle.
- **Contextes strictement séparés** : chaque rattachement définit un
  contexte (type `cizagroup` ou `proprietaire` + propriétaire concerné +
  immeubles assignés dans CE contexte). L'interface du gestionnaire affiche
  un **sélecteur de contexte** dès qu'il a plus d'un rattachement actif.
  Aucune donnée d'un contexte n'est visible dans un autre : le filtrage est
  appliqué dans la couche données (`lib/data`), pas seulement à l'écran.
- **Supervision** : Admin / Super Admin peut ouvrir le tableau d'un
  gestionnaire rattaché (vue de ses contextes et de ses immeubles
  assignés). L'ouverture affiche un **bandeau « Supervision »** et est
  **journalisée** au journal d'audit.

### Propriétaire, suspension, audit

- **Propriétaire** : voit toujours **TOUTES** les données de ses immeubles
  (loyers, dépenses, ROI), même gérés par un gestionnaire. Inchangé.
- **Suspension d'un compte** = accès bloqué à la connexion (écran de
  blocage propre), **données JAMAIS effacées**. La réactivation restaure
  l'état d'abonnement antérieur (`statut_pre_suspension`).
- **Journal d'audit** : tout accès et toute action Admin / Super Admin est
  tracé (qui, quand, quel compte, quelle action, détails). Lecture réservée
  à Admin / Super Admin.
- **Règle fondatrice inchangée** : CizaImmo n'encaisse JAMAIS les loyers —
  pour aucun rôle, Super Admin compris.

## 2. Finances dynamiques — RIEN EN DUR

Exigence explicite du fondateur : les tarifs et les paramètres finance
vivent **dans la base**, pas dans le code.

- Table `tarifs_plateforme` : grille (`afrique` / `internationale`) × plan
  (`starter` / `pro` / `agence`) → `prix_mensuel` (USD). Seed = tarifs
  verrouillés v1.1 : Afrique 1,99 / 5,99 / 11,99 ; Internationale
  4,99 / 14,99 / 29,99.
- Table `parametres_finance` (ligne unique) : `remise_annuelle_pct` = 20,
  `jours_essai` = 30, `jours_grace` = 5, `penalites_retard_actives` = false.
- Le **front public** (page `/tarifs`, section prix de l'accueil), la page
  **abonnement** et la **facturation** lisent ces valeurs via la couche
  données (`getTarifsPlateforme()` / `getParametresFinance()`). Changer un
  prix dans la table (ou via la console Super Admin « Paramètres —
  Finances ») change l'affichage **sans redéploiement de code**.
- Les littéraux de prix ne subsistent que dans : le seed SQL
  (`supabase/module-finance.sql`), le seed / fallback démo
  (`lib/abonnement.ts` `PRIX_PLANS`, réexporté par `lib/tarifs.ts`), et les
  tests qui vérifient le seed. `PRIX_PLANS` / `prixPlan()` deviennent le
  **fallback** utilisé uniquement si la table est illisible.
- `jours_grace` (paramètre plateforme, défaut 5) sert au calcul des
  **retards de paiement** de la console : un abonnement actif dont la fin
  de période est dépassée de plus de `jours_grace` jours, ou marqué
  `echec_paiement`, est « en retard ». La grâce d'échec de paiement de 7
  jours du §12 (avant lecture seule) reste inchangée.
- Toute modification de tarif ou de paramètre depuis la console est
  **journalisée** au journal d'audit (anciennes → nouvelles valeurs).

## 3. Modèle de données (mode réel — `supabase/module-admin.sql`, `supabase/module-finance.sql`)

- `profils.role` : le `CHECK` est étendu à
  `('proprietaire','gestionnaire','coproprietaire','admin','super_admin')`.
  Choix : étendre le rôle existant plutôt qu'une table dédiée — le rôle est
  déjà la clé de voûte des RLS et de `getProfil()` ; les helpers RLS
  `est_admin_plateforme()` / `est_super_admin()` lisent `profils.role` de
  l'utilisateur courant (fonctions SECURITY DEFINER, comme l'existant).
- `profils.suspendu boolean not null default false` (+ `suspendu_le`) :
  compte bloqué à la connexion.
- `abonnements.statut` : le `CHECK` gagne `'suspendu'` ; nouvelle colonne
  `statut_pre_suspension` pour restaurer l'état à la réactivation.
  L'index unique partiel « un abonnement essai/actif par propriétaire »
  n'inclut pas `suspendu` : pendant la suspension, aucun nouvel abonnement
  ne peut être créé (l'accès est bloqué) ; à la réactivation, le statut
  antérieur est restauré.
- `rattachements_gestionnaires` : `gestionnaire_id` (→ profils),
  `contexte` (`cizagroup` / `proprietaire`), `proprietaire_id` (→ profils,
  requis si contexte = proprietaire, NULL si cizagroup),
  `immeuble_ids uuid[]` (immeubles assignés DANS ce contexte),
  `statut` (`actif` / `suspendu`), `created_at`. Unicité : un seul
  rattachement cizagroup actif par gestionnaire ; un seul par couple
  (gestionnaire, propriétaire).
- `journal_audit` : `acteur_id`, `acteur_email`, `acteur_role`, `action`,
  `cible_type` (`compte` / `admin` / `tarif` / `parametre` /
  `gestionnaire` / `plateforme`), `cible_id`, `cible_email`, `details
  jsonb`, `created_at`.
- `avis` : `modele`, `destinataire_id` (→ profils), `destinataire_email`,
  `variables jsonb` ({nom, plan, date}), `sujet`, `corps` (rendus au moment
  de l'envoi), `envoye_par` (→ profils), `envoye_par_role`,
  `statut_envoi` (`envoye` / `non_configuré` / `echec`), `created_at`.
- `tarifs_plateforme` / `parametres_finance` : voir §2. Lecture publique
  (les prix sont publics) ; écriture Super Admin uniquement.

### RLS

- `tarifs_plateforme`, `parametres_finance` : `SELECT` pour `anon` et
  `authenticated` (prix publics, lus par le front sans connexion) ;
  `UPDATE` Super Admin uniquement.
- `profils` : Admin / Super Admin peuvent **lire tous les profils** et le
  Super Admin peut mettre à jour le rôle ; Admin / Super Admin peuvent
  mettre à jour `suspendu` (politique dédiée, colonnes non restreignables
  en RLS — la discipline est applicative + auditée). Le propriétaire garde
  l'accès complet à ses propres données (politiques existantes inchangées).
- `abonnements` : lecture Admin / Super Admin (tous les comptes, pour le
  suivi des retards) ; mise à jour du statut de suspension par Admin /
  Super Admin.
- `rattachements_gestionnaires` : lecture par le gestionnaire concerné et
  par Admin / Super Admin ; écriture Admin / Super Admin (console) — les
  rattachements `proprietaire` naissent aussi de l'invitation classique
  d'un gestionnaire par un propriétaire (miroir applicatif).
- `journal_audit` : `INSERT` par l'acteur lui-même (`acteur_id =
  auth.uid()`) ; `SELECT` Admin / Super Admin uniquement.
- `avis` : `INSERT` / `SELECT` Admin / Super Admin.

> Note d'application : ces fichiers SQL sont livrés mais **NON appliqués**
> au projet Supabase live. L'application se fait par le fondateur (ou sur
> son ordre explicite) dans l'éditeur SQL, dans l'ordre :
> `module-admin.sql` puis `module-finance.sql`, après `schema.sql`,
> `storage.sql` et `module5.sql`. Après application, promouvoir le compte
> fondateur : `update public.profils set role = 'super_admin' where email
> = '<e-mail du fondateur>'`.

## 4. Modèle démo (localStorage)

La base démo gagne une section `plateforme` (migration douce à la lecture,
comme les modules précédents) :

- `comptes` : registre des comptes clients fictifs de la console (plans,
  grilles, statuts variés : actif, essai, en retard, suspendu). Le compte
  démo principal (Amina) y est **reflété en direct** depuis
  `db.profil` / `db.abonnement` (suspension incluse : `db.profil.suspendu`).
- `admins` : comptes plateforme démo — Super Admin
  (`superadmin.demo@cizaimmo.com`, boutons démo sur la page connexion) et
  Admin (`admin.demo@cizaimmo.com`, « Aline »), plus la possibilité d'en
  créer / suspendre / retirer depuis la console.
- `journalAudit`, `avis`, `rattachements` : mêmes formes que le réel.
  Rattachements seedés pour le gestionnaire démo (Marc Dubois) :
  contexte **Ciza Group** (parc géré pour Ciza Group — collection séparée
  `parcCizaGroup` de la base démo, jamais mélangée au parc du propriétaire)
  et contexte **propriétaire** (Amina — Bloc Saint-Laurent, invitation
  existante). Contextes strictement séparés dans la couche données :
  `parcActif()` aiguille toutes les lectures/écritures du parc vers la
  collection du contexte actif.
- `tarifs`, `parametresFinance` : seed identique au SQL ; modifiables via
  la console démo, relus dynamiquement par le front.

## 5. Anti-fraude tarifaire — attribution de la grille (ajout fondateur n°2)

La grille Afrique étant moins chère, déclarer un pays africain ne doit
pas suffire à l'obtenir depuis l'étranger. Trois signaux sont capturés :

| Signal | Source | Stockage (`profils`) |
|---|---|---|
| (a) Pays déclaré | formulaire d'inscription | `pays_declare` (nom) + `pays` |
| (b) Pays de l'IP | en-tête `x-vercel-ip-country` (route `/api/inscription/contexte`) — **seul le code pays est stocké, jamais l'IP brute** | `pays_ip` (code ISO) |
| (c) Pays du paiement | préfixe mobile money (ex. +257 → BI) ou pays de la carte Stripe, au premier paiement | `pays_paiement` (code ISO) |

Résultat stocké : `grille_attribuee` (miroir de `abonnements.grille`) et
`grille_statut` (`ok` / `a_verifier`).

**Liste d'éligibilité DYNAMIQUE** : `parametres_finance.pays_grille_afrique`
(codes ISO, éditable par le Super Admin dans la console Finances ; seed =
pays africains du formulaire, cohérents avec les devises de l'app :
BIF, XAF, XOF, KES, TZS, RWF, UGX…). La matrice (`lib/grille.ts`,
fonction pure `attribuerGrille`) lit cette liste — rien en dur.

**Matrice d'attribution** (la concordance se juge sur l'éligibilité,
pas sur l'égalité des pays : déclaré Burundi + IP Kenya = concordants) :

| Déclaré | IP | Grille attribuée | Statut |
|---|---|---|---|
| éligible Afrique | éligible Afrique | afrique | ok |
| non éligible | non éligible | internationale | ok |
| éligible Afrique | non éligible | **internationale** (défaut prudent) | **a_verifier** |
| non éligible | éligible Afrique | **internationale** | **a_verifier** |
| éligible Afrique | indétectable | afrique | ok + revérification au 1er paiement |
| non éligible | indétectable | internationale | ok + revérification au 1er paiement |

Revérification au premier paiement (`evaluerPaysPaiement`) : si le pays
du moyen de paiement contredit l'éligibilité de la grille attribuée, le
compte passe `a_verifier` (la grille ne change pas toute seule).

**Verrouillage** : changer son pays dans les Paramètres ne modifie
JAMAIS la grille (message affiché au propriétaire, FR/EN). Seul un
Admin / Super Admin réattribue depuis la console — vue « Comptes à
vérifier » (déclaré vs IP affichés, boutons « Attribuer grille Afrique /
Internationale ») — action journalisée (`grille_reattribuee`).

**Hors champ** : la mini-grille publique de l'accueil (sélecteur de
devise) reste libre — regarder un prix dans une devise n'est pas être
facturé dans une grille ; aucun lien avec la grille du compte.

## 6. Approbation manuelle des comptes (ajout fondateur n°3)

**Aucun compte n'est validé par défaut** : chaque inscription est
approuvée par un humain (Admin ou Super Admin).

Cycle de vie :

1. **Inscription** → e-mail confirmé → abonnement créé en statut
   `en_attente`, **sans dates d'essai** (trigger `handle_new_user`).
2. **En attente** : la connexion reste possible mais atterrit sur
   l'écran « Compte en attente d'approbation » (FR/EN) qui affiche le
   délai — paramètre dynamique `parametres_finance.delai_approbation_affiche`
   (défaut « 24 h ouvrées », éditable Super Admin). Aucun accès aux
   modules, aucune création de données (`estLectureSeule` = vrai,
   limite de blocs = 0).
3. **Revue console** : la file « Comptes en attente » est FUSIONNÉE avec
   les signalements anti-fraude (§5) — un seul écran de revue : nom,
   e-mail, pays déclaré vs pays IP, grille proposée, badge
   « à vérifier » le cas échéant. Actions :
   - **APPROUVER** : la grille affichée est confirmée au même geste ;
     l'essai démarre À L'APPROBATION (`statut = essai`,
     `trial_ends_at = approbation + jours_essai` — paramètre dynamique) ;
     e-mail de bienvenue envoyé ; décision journalisée.
   - **REFUSER** : motif par modèle prédéfini uniquement (avis
     `inscription_refusee` ; motifs : `informations_insuffisantes`,
     `pays_non_desservi`, `doublon`, `autre`) ; e-mail de refus avec le
     motif ; `profils.motif_refus` posé → **connexion ensuite impossible**
     (message propre `accountRefused`) ; abonnement `annule` ; décision
     journalisée.
   - **Réattribuer la grille** avant approbation (journalisé, §5).
4. **Bootstrap Super Admin** : le fondateur ne passe PAS par la file.
   Procédure manuelle unique (aussi en commentaire dans
   `supabase/module-admin.sql`) : inscription normale, puis promotion
   SQL directe (`profils.role = 'super_admin'` + abonnement passé en
   `essai`). La base live étant à 0 utilisateur, aucune migration de
   comptes existants n'est nécessaire.
5. **Mode démo** : même flux — inscription démo → `en_attente` →
   approbation/refus via les comptes démo Super Admin / Admin → essai
   démarré ou connexion bloquée. Le compte démo historique (Amina) est
   déjà approuvé (essai en cours).

## 7. Périmètre livré

- **Phase A** : `supabase/module-admin.sql`, `supabase/module-finance.sql`
  (fichiers seulement, non appliqués).
- **Phase B** : couche données étendue (démo + réel) ; redirection
  prioritaire vers `/console` ; pages console FR+EN (vue d'ensemble,
  comptes, admins [Super Admin], journal, supervision) ; sélecteur de
  contexte gestionnaire ; écran de blocage compte suspendu ; boutons démo
  Super Admin / Admin.
- **Phase C** : `lib/tarifs.ts` ; prix dynamiques sur `/tarifs`, accueil,
  abonnement, facturation (démo + réel + webhooks en secours) ; page
  console « Paramètres — Finances » (Super Admin) avec audit.
- **Phase D** : tests ajoutés (redirection par rôle, suspension bloquante,
  avis par modèle journalisé, prix dynamique, contextes séparés) ; build +
  tsc + suite complète ; grep anti-littéraux ; parité i18n.

Hors périmètre : application des SQL au projet live, promotion réelle du
compte fondateur, envoi d'e-mails d'avis via un fournisseur (le statut
`non_configuré` s'affiche tant qu'aucun fournisseur n'est branché — même
règle que les alertes).
