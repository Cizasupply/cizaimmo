# Coordonnées de paiement, liste « Vérifier un employé », talon de paie — et correctif du bug Finances (2026-11-08)

Trois ajouts VALIDÉS par le fondateur le 2026-11-08 (coordonnées précisées par lui :
**coordonnées bancaires complètes, structurées selon le moyen** ; talon ajouté par lui
dans la foulée, en-tête aux **deux logos** précisé ensuite), plus le **correctif d'un bug
réel de production** signalé par le fondateur le même jour. Base de départ : `7b04435d`.

## 🐛 BUG PRODUCTION — page « Paie & Dépenses » en erreur (CORRIGÉ)

**Symptôme** (capture du fondateur) : bandeau rouge « Une erreur est survenue.
Réessayez. » sur la page Finances, le reste en états vides — pour n'importe quel mois.

**Cause racine** : `lib/data/real.ts`, `getVueFinancesPlateforme` (code déployé
`95d3dd2d`, ligne ~4642) — la requête des dépenses se terminait par
`.order("created_at", { ascending: false })`, or la table `depenses_plateforme`
n'a **pas** de colonne `created_at` : son horodatage de saisie s'appelle **`cree_le`**
(`supabase/module-finances-plateforme.sql`). PostgREST répond `42703 — column
depenses_plateforme.created_at does not exist`, le fournisseur jette, la page affiche
le bandeau. La clause étant inconditionnelle, la page n'a **jamais** chargé en
production. Le fournisseur démo ne pouvait pas le voir (objets en mémoire, pas de
vrais noms de colonnes) — d'où des tests verts et un bug live.

**Diagnostic** : code déployé relu depuis GitHub (le dépôt local n'est pas un clone
git) ; reproduction exacte avec un faux client PostgREST contraint au schéma live
(reconstruit depuis les modules SQL du dépôt) : rejet
`column depenses_plateforme.created_at does not exist`, identique à la production.

**Correctif** : tri par `cree_le` ; au passage, `depenseAvecDetails` alimente le
`created_at` du type d'affichage depuis `cree_le` (même famille de dérive).
**Non-régression** : `scripts/test-finances-reel.cjs` (voir § Tests).

## Ajout 1 — Coordonnées de paiement de l'employé

Où l'employé (Admin / Super Admin) reçoit son salaire, en coordonnées **bancaires
complètes structurées selon le moyen** :

- **SQL** `supabase/module-coordonnees-paiement.sql` (idempotent, **à appliquer au
  live par le parent**) : 9 colonnes nullables sur `profils` — `paiement_moyen`
  (CHECK `virement`/`mobile_money`/`especes`), `paiement_titulaire` (toujours),
  virement : `paiement_banque`, `paiement_agence` (optionnel),
  `paiement_numero_compte`, `paiement_iban` (optionnel), `paiement_swift`
  (optionnel) ; mobile money : `paiement_operateur`, `paiement_numero_mobile` ;
  espèces : rien de plus. Plus 2 colonnes sur `paies_employes` : `paiement_moyen`
  (copie à l'émission) et `paiement_destination` (instantané texte). **Aucune
  politique nouvelle** (lectures par les politiques `profils` existantes).
- **Complétude CALCULÉE** (`lib/finances-plateforme.ts`, fonction pure partagée) :
  moyen + titulaire + champs requis du moyen. Elle ne change **ni** la complétude
  du dossier employé (4 éléments) **ni** les règles de la carte — décision explicite
  du fondateur : les coordonnées ne bloquent que la paie.
- **Employé** : section « Mes coordonnées de paiement » dans *Mon dossier employé* —
  les champs affichés dépendent du moyen choisi ; titulaire prérempli avec son nom ;
  état présent/absent affiché avec la destination formatée.
- **Plateforme** : bloc structuré lisible selon le moyen dans le détail Équipe
  (Super Admin) et dans chaque ligne de la page Finances (composant partagé
  `components/CoordonneesPaiementVue.tsx`).
- **Porte d'émission** (`emettrePaieEmploye`, deux fournisseurs) — ordre documenté :
  dossier incomplet (`ERR_DOSSIER_INCOMPLET`) → contrat/montant
  (`ERR_PAIE_SANS_CONTRAT`) → **coordonnées (`ERR_COORDONNEES_PAIEMENT_MANQUANTES`)**
  → déjà émise. La page Finances affiche la pastille « En attente — coordonnées de
  paiement manquantes ». Moyen hors liste refusé à l'enregistrement
  (`ERR_COORDONNEES_PAIEMENT_INVALIDES`).
- **Instantané figé** : à l'émission, la paie enregistre le moyen + la destination
  composée des champs pertinents (ex. « Virement — Banque X, agence Y — compte …,
  IBAN …, SWIFT … — Titulaire » ; « Mobile money — EcoCash +257 … — Titulaire » ;
  « Espèces — Titulaire »). Historique Finances et « Ma paie » affichent la
  destination utilisée ; un changement ultérieur du profil ne la réécrit jamais.

## Ajout 2 — « Vérifier un employé » : liste + recherche

La page garde la saisie directe du Display ID (carte présentée) et gagne, dessous :
un champ de recherche (nom ou Display ID, insensible à la casse **et aux accents**,
fonction pure `filtrerMembresEmployes` dans `lib/pack-employe.ts`) et la **liste de
tous les membres plateforme** (photo, nom, Display ID insécable, rôle, pastille
« Carte émise / Non émise »). Un clic charge la fiche de vérification existante du
membre (même fonction `verifierEmploye`, même verdict trois états). Données :
`listerEquipeAdmins` (le fournisseur réel expose désormais `display_id` + URL de
photo signée ; le démo symétrique) — liste limitée aux comptes plateforme, aucun
client.

## Ajout 3 — Talon de paie dynamique (ajout du fondateur)

- **Génération à la demande, patron des contrats** (`lib/talon-paie.ts`) : rien de
  stocké, rien de codé en dur — le talon est régénéré depuis la **ligne de paie
  émise** (instantanés : montant, devise, modalités, moyen + destination, référence,
  émis par / émis le) et l'identité de l'employé lue en base (nom, Display ID,
  fonction). Contenu : titre « Talon de paie / Pay stub », employé, mois de paie,
  ligne « Salaire selon contrat d'engagement », **« Total à payer » = même montant
  (aucune retenue modélisée — pas d'INSS)**, destination (l'instantané), référence
  si présente, « Émis par … le … », pied entreprise sobre.
- **En-tête aux DEUX logos** (précision du fondateur, patron des cartes de fin
  vidéo) : bandeau marine ; logo CizaImmo (version compacte du v4 — même artwork
  blanc/or, recadrée : le PNG v4 brut porte un large padding transparent qui le
  rendrait illisible à cette taille) à gauche ; logo Ciza Group transparent or à
  droite (26 mm). Les deux PNG sont transparents : **aucun fond blanc parasite**
  (vérifié par rastérisation PyMuPDF : fond du bandeau marine uniforme, pixels dorés
  des deux côtés). Le logo Ciza Group est redimensionné à 512 px max via canvas
  avant embarquement (le 2000×2000 brut gonflerait le PDF à plusieurs Mo).
- **Langue = celle du compte de l'employé** (`profils.langue`), patron du contrat
  employé — le Super Admin obtient le talon dans la langue de l'employé.
- **Accès** (`genererTalonPaie`, deux fournisseurs) : l'employé télécharge **ses**
  talons depuis « Ma paie » (bouton par paie) ; le Super Admin télécharge le talon
  de chaque paie depuis l'historique Finances. Paie d'un autre employé ou
  inexistante → `ERR_TALON_INTROUVABLE` (aucune fuite d'existence).

## Tests

- `scripts/test-coordonnees-paiement.cjs` (**57 OK / 0 KO**) : complétude par moyen
  (banque sans n° de compte = incomplet ; virement complet sans IBAN = complet ;
  mobile sans opérateur = incomplet ; espèces titulaire seul = complet),
  normalisation (champs hors moyen neutralisés), formats d'instantané par moyen,
  ordre des trois portes, instantané figé après changement du profil, recherche
  (nom partiel, accents, Display ID), liste limitée aux plateforme, talon (données
  d'entrée, accès croisés refusés), contrôles statiques SQL/surfaces/logos.
- `scripts/test-finances-reel.cjs` (**24 OK / 0 KO**) : fournisseur **réel** compilé
  contre un faux client PostgREST qui valide chaque colonne contre le schéma live
  reconstruit depuis les modules SQL — non-régression du bug `created_at`,
  émission réelle avec instantané, talon réel (données d'entrée capturées, accès
  employé limité à ses paies).
- `scripts/test-finances-plateforme.cjs` mis à jour (signature `blocagesPaie`,
  coordonnées de l'Admin démo, instantané vérifié) : **41 OK / 0 KO**.
- Suite complète `bash scripts/run-tests.sh` **verte (exit 0)** ; `npx tsc --noEmit`
  propre ; `npm run build` OK. Parité i18n : **2 093 clés FR = EN**.

## Reste à faire (parent)

- **Appliquer `supabase/module-coordonnees-paiement.sql` au live** (le contenu est
  joint au rapport de livraison) puis vérifier V1–V5 du module.
- Après déploiement Vercel : recharger la page Finances en production — le bandeau
  d'erreur doit avoir disparu (le correctif `cree_le` part avec ce push).
