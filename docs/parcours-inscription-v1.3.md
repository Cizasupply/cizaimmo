# CizaImmo v1.3 — Parcours d'inscription et dossiers vérifiés

Extension construite sur la v1.2 (console Admin / Super Admin,
finances dynamiques, approbation manuelle, anti-fraude tarifaire).
Elle met en œuvre le schéma validé par le fondateur
(`cizaimmo-schema-inscription-v1.3.pdf`) : chaque compte reçoit un
**Display ID** unique, dépose un **dossier de vérification**, les
gestionnaires signent un **contrat de collaboration** avant
d'exercer, et tout rattachement propriétaire → gestionnaire suit une
**triple validation**.

## 1. Modèle de données

### profils (colonnes ajoutées, `supabase/module-v13.sql`)

| Colonne | Rôle |
|---|---|
| `display_id` | Identifiant de dossier public : `CIM-` + 6 chiffres, séquentiel (séquence Postgres dédiée), unique, généré par le système, jamais modifiable. Backfill des comptes existants par ordre de création. |
| `telephone` | Téléphone obligatoire à l'inscription (WhatsApp). |
| `type_intention` | `proprietaire` / `gestionnaire` — l'INTENTION déclarée à l'inscription, validée par l'Admin à l'approbation. |
| `photo_profil_path` | Chemin Storage de la photo de profil (bucket privé `documents-prives`). |
| `statut_contrat` | `sans_objet` / `a_signer` / `signe_recu` / `valide` — cycle de vie du contrat gestionnaire. |

### documents

Le CHECK `entite_type` est élargi à **`compte`** (pièce d'identité et
contrat du dossier) et le CHECK des types gagne **`contrat`**. La
preuve de propriété reste un document `justificatif` rattaché à
l'**immeuble**. Les documents `compte` ne sont lisibles que par leur
titulaire et la plateforme (politique RLS dédiée) ; le reste suit les
politiques existantes.

### demandes_rattachement (nouvelle table)

`proprietaire_id`, `gestionnaire_id`, `gestionnaire_display_id`
(dénormalisé pour l'affichage console), `statut`
(`en_attente_gestionnaire` / `en_attente_admin` / `actif` /
`refuse`), horodatages de chaque étape (`repondu_le`, `valide_le`,
`valide_par`), `rattachement_id` une fois créé. RLS : les deux
parties à leurs demandes + la plateforme.

### Recherche par Display ID (mode réel)

La RLS des profils interdit la lecture croisée : la recherche passe
par la RPC `rechercher_gestionnaire_par_display_id` (security
definer), qui ne retourne que `id`, `nom`, `display_id` des comptes
à intention gestionnaire. L'interface n'affiche que le **nom** pour
confirmation — jamais d'autre donnée.

## 2. Intention ≠ rôle (choix de modélisation central)

À l'inscription, le champ « Je suis propriétaire / Je suis
gestionnaire immobilier » est une **intention**, pas un rôle
auto-déclaré :

- le rôle technique reste `proprietaire` à l'inscription, comme
  avant — aucune élévation de privilège déclarative ;
- à l'**approbation**, l'Admin valide l'intention. Pour un
  gestionnaire, l'approbation déclenche le contrat (voir §4) ;
- les **fonctions gestionnaire** (répondre aux demandes de
  rattachement, accéder aux immeubles des propriétaires) restent
  verrouillées tant que `statut_contrat ≠ valide`, avec un message
  explicite dans l'interface (« Mon contrat »).

En mode démo, les personas portent des Display ID fixes cohérents
(fondatrice CIM-000001, Marc Dubois CIM-000002, …, Sira Diallo
CIM-000011 — gestionnaire dont le contrat signé attend validation) ;
un compteur persistant attribue les suivants aux nouvelles
inscriptions démo.

## 3. Parcours d'inscription et dossier

1. Formulaire : nom, e-mail, mot de passe, pays, devise, langue +
   **téléphone (obligatoire)** + **intention** (deux choix radio).
2. Le Display ID généré s'affiche sur l'écran d'attente : « Votre
   numéro de dossier : CIM-0000XX — conservez-le ».
3. Écran d'attente enrichi d'un bloc **« Complétez votre dossier »** :
   photo de profil + pièce d'identité (bucket privé, composants
   d'upload existants), états manquant / reçu, et mention que
   l'examen commence quand le dossier est complet.
4. Un dossier est **complet** quand photo + pièce d'identité sont
   présentes. Incomplet, le compte reste décidable par l'Admin, mais
   la console le signale (badge + KPI « Dossiers incomplets »).
5. Création d'immeuble : champ optionnel **« Preuve de propriété »**
   (titre / certificat foncier ou acte d'achat) versé dans les
   documents de l'immeuble, visible dans le Dossier console.

## 4. Contrat du gestionnaire

À l'approbation d'un compte à intention gestionnaire :

- `statut_contrat` passe à `a_signer` ;
- le contrat PDF est généré (`lib/contrat.ts`, jsPDF) dans la langue
  du compte (FR/EN) et **joint à l'e-mail de décision**
  (`lib/email.ts` : pièces jointes Resend en base64, support ajouté
  sans casser l'existant) ;
- préambule avec l'**identification complète de l'entreprise** :
  « CizaImmo, division de CIZA GROUP SURL, société enregistrée au
  Burundi sous le numéro RC 0082870/26, NIF 4003446905, dont le
  siège est situé au 6ème Avenue N° 47, Quartier Buhomba, Zone
  Mutimbuzi, Commune Ntahangwa, Bujumbura — Burundi, représentée
  par Ciza Misigaro, son Président Directeur » ;
- parties gestionnaire : nom, Display ID, e-mail, téléphone, pays,
  date ; clauses sobres (objet, indépendance, **aucun encaissement
  des loyers par CizaImmo — aucun fonds ne transite par la
  plateforme**, confidentialité, exactitude des données, durée
  indéterminée + résiliation à 30 jours) ;
- bloc signature entreprise **déjà signé et cacheté** : la
  **signature électronique du Président Directeur** (image officielle
  `public/signature-president.png`, ≈ 38 mm de large, proportions
  conservées, juste au-dessus de la ligne et du nom « Ciza Misigaro,
  Président Directeur ») et le **cachet rond officiel Ciza Group
  SURL** (≈ 44 mm, à droite). Le bloc du gestionnaire reste vierge
  pour sa signature manuscrite ;
- pied de page : émetteur + contacts (infos@cizagroup.com ·
  WhatsApp +1 514 502 9503).
- Le gestionnaire téléverse le contrat **signé** depuis sa page
  « Mon contrat » (`statut_contrat → signe_recu`) ; l'Admin le
  visualise dans le Dossier et le **valide** (`→ valide`) :
  déblocage des fonctions + e-mail d'activation.

Technique images : cachet et signature sont normalisés (largeur
max, aplatissement sur blanc, JPEG) pour garder le PDF léger
(~100 Ko) en pièce jointe. La signature est chargée par priorité
depuis le fichier public servi par l'application — apposée
automatiquement à chaque génération — avec repli sur une constante
embarquée régénérée par `scripts/sync-signature.py`. jsPDF est
importé dynamiquement (Edge Runtime du middleware : la constante de
cookie démo a été déplacée dans `lib/supabase.ts` pour ne pas tirer
le fournisseur démo dans le graphe du middleware).

## 5. Rattachement par Display ID — triple validation

1. **Le propriétaire demande** : champ « Display ID de votre
   gestionnaire » (Paramètres) → recherche (nom seul affiché) →
   envoi. Statut `en_attente_gestionnaire`.
2. **Le gestionnaire accepte** (page « Mon contrat », section
   demandes) — l'acceptation exige `statut_contrat = valide`, sinon
   erreur explicite `ERR_CONTRAT_NON_VALIDE`. Statut
   `en_attente_admin`.
3. **Un Admin valide systématiquement** (console : file dans la vue
   d'ensemble, la liste des demandes et la page Dossier) : la
   validation crée le rattachement dans `rattachements_gestionnaires`
   (contexte `proprietaire`, **`immeuble_ids` vide**). Le refus est
   journalisé.
4. **Le propriétaire assigne ensuite ses immeubles** via le
   mécanisme existant (cases à cocher dans Paramètres / contexte).

Avant l'étape 3 + l'assignation, le gestionnaire ne voit **aucune**
donnée du propriétaire (les RLS existantes + le rattachement font
foi) — comportement couvert par les tests.

## 6. Console

- **Vue d'ensemble** : 3 KPI ajoutés — dossiers incomplets, contrats
  signés en attente de validation, demandes de rattachement en
  attente Admin (les KPI existants sont inchangés).
- **Liste des comptes** : recherche texte libre (nom, Display ID,
  e-mail, téléphone) + filtres (intention, statut d'abonnement,
  grille, dossier complet / incomplet), combinables avec les filtres
  rapides existants ; chaque carte affiche Display ID, téléphone,
  intention et les badges dossier / contrat.
- **Page Dossier** (`/console/comptes/[id]`) : identité + photo
  (présence) + Display ID + téléphone ; documents du compte
  (liens signés) et preuves de propriété ; rattachements des deux
  côtés et demandes ; immeubles possédés ou gérés ; annonces
  vitrine ; abonnement ; journal d'audit filtré sur le compte.
  Actions contextuelles : approuver / refuser (motifs prédéfinis),
  valider le contrat signé, valider / refuser un rattachement en
  attente.

## 7. Tests

`scripts/test-inscription-v13.cjs` (47 vérifications) couvre en
démo : format et unicité du Display ID ; intention stockée, rôle
technique inchangé ; dossier incomplet → complet ; approbation
gestionnaire → contrat généré + e-mail de décision **avec pièce
jointe PDF** ; contrat signé → validation Admin → déblocage (+
e-mail d'activation) ; rattachement complet — avant validation
Admin : aucun accès ; après validation sans assignation : toujours
aucun accès ; après assignation : accès limité à l'immeuble
assigné ; recherche console par Display ID et par téléphone.
Suite complète : **437 vérifications, 0 KO** ; `tsc --noEmit` 0
erreur ; `npm run build` exit 0. Parité i18n : **1473 clés FR =
1473 clés EN**.

## 8. Limites honnêtes

- **`supabase/module-v13.sql` n'est PAS appliqué au Supabase live** :
  il le sera via le tableau de bord (collage par morceaux), comme
  les modules précédents. Tant qu'il n'est pas appliqué, le mode
  réel ne peut pas servir les flux v1.3 (le mode démo, lui, est
  complet).
- **Preuve e-mail réelle** : l'envoi du contrat en pièce jointe
  dépend du fournisseur configuré (Resend) ; le statut d'envoi
  rapporté dans la console est honnête (`envoye` / `non_configuré` /
  `echec`). La preuve définitive se fera au premier avis réel,
  comme pour la v1.2.
- **Comptes hybrides** : un compte à intention gestionnaire gère son
  contrat et ses demandes depuis « Mon contrat » ; l'expérience
  complète de bascule de contexte (plusieurs propriétaires) reste
  celle des comptes gestionnaires dédiés créés par invitation
  (modèle v1.2 inchangé).
- **Verrou contrat en démo mono-base** : le refus d'acceptation
  faute de contrat valide (`ERR_CONTRAT_NON_VALIDE`) n'est pas
  scénarisable de bout en bout dans la base démo unique (le seul
  gestionnaire destinataire possible y est déjà `valide`) ; la
  garde est implémentée dans les deux fournisseurs et le code
  d'erreur est traduit dans l'interface.
- La **signature du Président Directeur** est fournie et intégrée
  (`public/signature-president.png`) ; pour la remplacer, il suffit
  de déposer un nouveau fichier au même endroit (puis, pour les
  environnements sans accès au fichier public, relancer
  `scripts/sync-signature.py`).
