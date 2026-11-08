# Pack employé Admin — contrat à deux voies, charte, carte à code-barres (2026-11-08)

Pack VALIDÉ par le fondateur le 2026-11-08 (« Je valide le pack
employé complet », puis « Je valide les textes avec les deux
voies »), branché PAR-DESSUS le dossier employé (voir
`docs/dossier-employe-admin-2026-11-08.md`). Le dossier employé
était la brique identité + adresse ; le pack ajoute l'engagement
signé, la charte acceptée et datée, et la carte vérifiable contre
la base. Pensé pour être absorbé, plus tard, par le futur fichier
central des employés de Ciza Group (projet « pas maintenant »).

## 1. Contrat d'engagement à DEUX VOIES

Préparé par le Super Admin depuis la page Équipe (panneau « Pack
employé » du détail d'un membre). Le formulaire fixe les champs
employeur, stockés EN BASE (`profils.contrat_employe_*`) :

- **voie** : `travail` (A. Contrat de travail — employé au Burundi)
  ou `prestation` (B. Contrat de prestation de services —
  collaborateur hors du Burundi) ;
- type (codes canoniques CDI / CDD / PRESTA_INDET / PRESTA_DET,
  traduits dans la langue du compte par `lib/contrat-employe.ts`),
  durée, montant + devise, modalités de paiement, lieu, horaires,
  date de début, période d'essai (voie A seulement — forcée à null
  en voie B, en base comme dans les deux fournisseurs).

Le PDF personnalisé (moteur partagé des contrats clients :
préambule CIZA GROUP SURL, RC 0082870/26, NIF 4003446905, siège
Bujumbura, signature du Président Directeur + cachet apposés)
pré-remplit les données de l'employé depuis son dossier en base
(nom, Display ID, adresse, téléphone, pièce d'identité).

- **Voie A** = le texte validé par le fondateur à l'égalité
  (14 articles ; INSS retiré à sa demande — verrouillé par test :
  aucun « INSS » dans les textes générés).
- **Voie B** = variante rédigée en miroir, différences STRICTEMENT
  limitées : nature du lien (collaborateur indépendant, ni contrat
  de travail ni lien de subordination), lieu/droit applicable,
  honoraires et virement international, fin de mission (sans
  certificat de travail ni solde de tout compte salarié — négation
  explicite). Tâches, confidentialité et traçabilité IDENTIQUES.
  Texte consigné pour relecture du fondateur :
  `~/workspace/goals/lancer-cizaimmo-en-saas/files/pack-employe-contrat-prestation-BROUILLON.md`.

## 2. Cycle de signature (patron des contrats clients)

Statuts en base `profils.statut_contrat_employe` :
`sans_objet → a_signer → signe_depose → valide / refuse` (motif
obligatoire, `ERR_MOTIF_REQUIS`). À la préparation : e-mail de mise
à disposition avec le PDF en pièce jointe ; dépôt du signé depuis
« Mon dossier employé » ; revue Super Admin dans Équipe (Ouvrir le
signé / Valider / Refuser) ; e-mails de décision ; journalisation
(`contrat_employe_prepare`, `contrat_employe_signe_depose`,
`contrat_employe_valide`, `contrat_employe_refuse`,
`charte_acceptee`). Une re-préparation est refusée tant que le
contrat est déposé ou validé (`ERR_STATUT_INVALIDE`). NON BLOQUANT
pour l'accès console (patron option C du contrat propriétaires).

## 3. Charte de confidentialité

À la première connexion console d'un compte plateforme sans
acceptation, le portail `components/CharteConfidentialite.tsx`
(monté dans `ConsoleShell`) affiche la charte validée (8 engagements
+ journalisation) avec case à cocher et bouton « J'accepte ».
L'acceptation est horodatée EN BASE (`profils.charte_acceptee_le`,
première date jamais réécrite — idempotente) et ne se représente
plus. Équipe : pastille « Charte : acceptée le … / en attente ».

## 4. Carte employé à code-barres

Émise (calculé, jamais stocké) si dossier employé COMPLET **et**
contrat VALIDÉ : badge Marine & Or 85,6 × 54 mm — photo, nom,
« Admin — CizaImmo, division de Ciza Group », Display ID et
code-barres **Code 128** encodant le Display ID.
`lib/code128.ts` : encodeur Code 128 jeu B pur (aucune dépendance
barcode dans le projet), vecteurs de test calculés à la main
(« CIM-000001 » → contrôle 5, 145 modules). Rendu écran +
téléchargement PDF + impression depuis « Mon dossier employé » ;
sinon l'état « non émise » liste ce qui bloque (dossier / contrat).

## 5. Vérification contre la base

Entrée console « Vérifier un employé » (Admin + Super Admin) :
saisie/collage d'un Display ID → identité, photo, rôle, statut du
compte (actif/suspendu), dossier complet ou non, contrat (statut),
charte (acceptée ou non), carte émise ou non — lus en direct. Un
compte suspendu ou un accès console fermé ressort VISIBLEMENT
« NON VALIDE » (bannière rouge) : la carte ne passe plus.

## 6. Progression

« Mon dossier employé » affiche la progression en 4 étapes
(Dossier → Charte → Contrat → Carte, calculée par
`lib/pack-employe.ts`) ; l'Équipe affiche par membre les pastilles
dossier + contrat + charte + carte.

## Données et surfaces

- SQL versionné : `supabase/module-pack-employe.sql` (14 colonnes
  sur `profils`, 2 contraintes CHECK, vérifications V1..V5,
  idempotent) — **à appliquer au live APRÈS
  `module-dossier-employe.sql`, NON appliqué par le code**. Le code
  déployé tolère l'absence des colonnes en lecture (pack « au
  départ ») mais l'écriture échouera tant que le SQL n'est pas
  appliqué, comme pour le dossier employé.
- Fournisseur : 9 méthodes (`getMonPackEmploye`, `getPackEmploye`,
  `accepterCharteEmploye`, `preparerContratEmploye`,
  `genererContratEmploye`, `televerserContratEmployeSigne`,
  `validerContratEmploye`, `refuserContratEmploye`,
  `verifierEmploye`) implémentées en réel et en démo.
- UI : portail charte, `components/CarteEmploye.tsx`,
  `components/PackEmployeAdmin.tsx` (Équipe), sections du pack dans
  « Mon dossier employé », page `console/verifier-employe`.
- i18n : namespace `packEmploye` FR/EN complet (parité stricte,
  1 982 clés) + `console.verifyEmployee`.
- Parcours client intégralement inchangé (verrouillé par test).

## Tests

`scripts/test-pack-employe.cjs` (57 OK / 0 KO) : vecteurs Code 128,
logique pure (carte/progression/vérification), textes des deux
voies (différences strictes, aucun INSS), statique (SQL, surfaces,
client inchangé) et flux démo complet (promotion → charte datée →
préparation voie A + e-mail PDF → dépôt → refus motivé → redépôt →
dossier complété → validation → carte émise → vérification actif /
suspendu / inconnu → voie B sur un persona promu). Suite complète
`bash scripts/run-tests.sh` verte (exit 0), build OK.
