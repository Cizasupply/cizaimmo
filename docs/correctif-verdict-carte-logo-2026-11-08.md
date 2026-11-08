# Correctifs 2026-11-08 (soir) — verdict de vérification en 3 états + logo Ciza Group sur la carte employé

Deux correctifs issus du test réel du parcours employé par le fondateur.

## Point préalable — « fuite de contrat » : AUCUNE

Les captures lues dans un premier temps comme « la page Mon dossier
employé de Barros affichant le contrat du fondateur » étaient en fait
la page « Mon dossier employé » DU FONDATEUR lui-même (sa propre
photo). La base confirme la cohérence complète : CIM-000001 a un
contrat préparé puis signé déposé puis validé, carte émise ;
CIM-000003 (Barros) est resté `sans_objet`, ce qui est correct —
aucun contrat ne lui a jamais été préparé. Le périmètre de lecture
et d'écriture du contrat employé était déjà strictement filtré sur
le profil de la session (`profils.id = auth.uid()`) dans les deux
fournisseurs : **aucune modification de périmètre n'a été faite**.

## Correctif 1 — Verdict « Vérifier un employé » en trois états

**Défaut réel** (capture du fondateur) : la vérification de
CIM-000003 affichait le bandeau vert « CARTE VALIDE — employé en
règle » alors que la même page indiquait « Contrat : Non préparé »
et « Carte employé : Non émise ». Le verdict ne dépendait que du
compte (actif + accès ouvert), jamais de l'émission de la carte.

**Nouveau modèle** (fonction pure `verdictVerificationEmploye`,
`lib/pack-employe.ts`) :

| État | Condition | Bandeau |
|---|---|---|
| `non_valide` | compte suspendu OU accès console fermé | rouge « NON VALIDE — compte suspendu ou accès fermé » (inchangé) |
| `valide` | compte en règle ET carte ÉMISE | vert « CARTE VALIDE — employé en règle » (inchangé) |
| `carte_non_emise` | compte en règle, carte NON émise | ambre « CARTE NON ÉMISE » + sous-texte « Le compte est en règle, mais aucune carte employé n'a encore été émise. » |

- `VerificationEmploye` gagne le champ `verdict` ; `valide` ne vaut
  plus vrai que pour le verdict « valide ».
- Les deux fournisseurs (réel + démo) calculent le verdict par la
  même fonction pure ; le détail des lignes de la page (statut du
  compte, accès, dossier, contrat, charte, carte) est inchangé.
- i18n FR/EN : `packEmploye.verifyCardNotIssued` +
  `verifyCardNotIssuedHint` (parité vérifiée).

## Correctif 2 — Logo Ciza Group sur la carte employé

Demande directe du fondateur : la carte employé Marine & Or porte
désormais le **logo de la maison mère Ciza Group**, bien visible en
haut à droite, en plus des textes existants (nom, « Admin —
CizaImmo », « Division de Ciza Group », Display ID, code-barres).

- Asset : `public/cizagroup-logo-transparent.png` — copie **à
  l'identique** (md5 `1f033b14f15830cb21cc0abe34c9dc5a`) du fichier
  de marque `cizagroup-logo-transparent.png` : PNG RGBA 2000×2000,
  version or sur fond **transparent**, adaptée au fond marine de la
  carte (aucun fond blanc parasite — vérifié par rastérisation du
  PDF : le coin du cadre du logo ressort marine (28, 40, 73), zéro
  pixel blanc pur dans la zone).
- Le canevas source est carré et le visuel réel y est centré avec
  une marge transparente : les tailles posées en tiennent compte
  (écran : boîte 44 px ; PDF : 11×11 mm en haut à droite).
- Écran : `<img>` absolue en haut à droite du badge ; la colonne de
  texte reçoit un retrait à droite (`pr-12`) pour ne jamais passer
  sous le logo. PDF (jsPDF) : même asset ajouté par `addImage` aux
  mêmes coordonnées relatives ; la largeur de retour à la ligne du
  nom passe de 56 à 40 mm pour rester hors de la zone du logo.
  Impression : elle passe par le rendu écran, logo compris.

## Tests

Bloc `scripts/test-pack-employe.cjs` étendu (suite complète verte) :

- fonction pure : table de vérité complète du verdict (5 cas) ;
- flux démo : vérification AVANT émission → `carte_non_emise`
  (jamais « valide » sans carte) ; après cycle complet →
  `valide` ; suspendu → `non_valide` (même avec une carte émise) ;
  réactivé → `valide` ;
- statique : la page rend les trois états (ambre compris), les deux
  fournisseurs câblent la fonction pure ; l'asset logo existe, est
  un PNG à canal alpha (type couleur 6) et est référencé à l'écran
  ET dans le PDF du composant carte.
