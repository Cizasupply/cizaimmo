# CizaImmo v1.6 — Vitrine vérifiée : aucune annonce affichée sans approbation Admin

Suite directe des v1.4 (« la base est la source de vérité ») et
v1.5 : chaque règle de la vitrine vit dans la base (RPC + trigger
+ RLS), le frontend ne fait qu'afficher et appeler. SQL :
`supabase/module-v16.sql` (idempotent, à appliquer APRÈS
`module-v15.sql`). La garde d'écriture de la v1.4
(`abonnement_permets_ecriture`) est réutilisée telle quelle, ni
recréée ni modifiée ; les politiques d'écriture ne sont pas
touchées.

Décisions du fondateur (2026-11-07) : aucune annonce affichée
sans approbation Admin ; badge « ✓ Vérifié » sur les annonces
affichées ; règle contact + justification ; anti-fraude par
revalidation automatique.

## Le modèle : 4 statuts

`appartements.vitrine_statut` (nouveau, défaut `non_publie`) :

| Statut | Sens | Visible publiquement |
|---|---|---|
| `non_publie` | Jamais demandé, ou retiré | Non |
| `en_attente` | Demande déposée, en file de validation | Non |
| `approuve` | Relu et approuvé par un Admin | **Oui** (badge « ✓ Vérifié ») |
| `refuse` | Refusé avec motif (`vitrine_motif_refus`) | Non |

L'ancien booléen `vitrine` reste le drapeau « le propriétaire
veut publier », mais il ne suffit plus : les trois politiques
publiques anonymes (`appartements_select_public`,
`immeubles_select_public`, `profils_select_vitrine`) sont
recréées avec la condition `vitrine_statut = 'approuve'`
ajoutée à leurs conditions d'origine (`vitrine = true`,
`statut in ('vacant','reserve')`, `archive = false`). Une
annonce approuvée est tracée : `vitrine_valide_par` /
`vitrine_valide_le` sont posés à l'approbation comme au refus.

**Migration des annonces existantes.** Au moment de
l'application du module, toute annonce déjà publiée
(`vitrine = true`, statut encore `non_publie` par défaut)
repasse en `en_attente` : aucune ne reste affichée sans
approbation. Elles réapparaîtront une à une, au fil des
validations dans la console.

## Demande de publication — `demander_publication_vitrine(appartement)`

Appelée par le propriétaire ou un gestionnaire de l'immeuble.
La base vérifie, dans l'ordre, et refuse avec un code explicite :

1. **Accès** (`ERR_VITRINE_ACCES`) : propriétaire de l'immeuble
   (`est_proprietaire_immeuble`), gestionnaire affecté
   (`est_gestionnaire_immeuble`), ou gestionnaire rattaché
   actif à cet immeuble (`rattachements_gestionnaires`,
   `immeuble_id = any(immeuble_ids)`, `statut = 'actif'`).
2. **Garde d'écriture v1.4** (`ERR_VITRINE_ECRITURE`) :
   `abonnement_permets_ecriture(owner_id)` — c'est
   l'abonnement du propriétaire des données qui décide.
3. **Plan** (`ERR_VITRINE_PLAN`) : le dernier abonnement vivant
   (`essai`/`actif`) du propriétaire doit être `pro` ou
   `agence` — la vitrine reste une fonction Pro/Agence.
4. **Statut** (`ERR_VITRINE_STATUT`) : l'appartement doit être
   `vacant` ou `reserve`.
5. **Photos** (`ERR_VITRINE_PHOTOS`) : entre 1 et 10 photos.
   Ce sont des **URL** (`photos text[]`, champ existant) — le
   flux actuel ne téléverse pas de fichiers photo ; la règle
   compte les liens présents, elle ne valide ni leur format
   ni leur contenu.
6. **Contact présent** (`ERR_VITRINE_CONTACT_MANQUANT`) :
   au moins un canal parmi `contact_telephone` /
   `contact_email`.

Succès : `vitrine = true`, `vitrine_statut = 'en_attente'`,
traces de validation effacées, et journalisation
(`vitrine_publication_demandee`, cible `appartement` — le
check `cible_type` de `journal_audit` est élargi par ce module
pour admettre `appartement` ; `details` porte `immeuble_id` et
le drapeau `divergent`).

## La règle contact + justification

Le contact public attendu est celui du **dossier** : le
gestionnaire du premier rattachement actif (contexte
`proprietaire`, couvrant l'immeuble) s'il en existe un, sinon
le propriétaire. La comparaison se fait champ par champ, pour
chaque canal **renseigné** (un canal vide ne diverge pas) :

- téléphone : comparé **normalisé** — seuls les chiffres et
  `+` sont conservés (`regexp_replace(x, '[^0-9+]', '', 'g')`),
  donc espaces, tirets et parenthèses ne créent pas de fausse
  divergence ;
- e-mail : comparé en minuscules, espaces de bord ignorés.

Si le contact saisi diverge et que `contact_justification`
est vide, la demande est refusée (`ERR_JUSTIFICATION_CONTACT`).
Avec une justification écrite, la demande passe — et le
drapeau `divergent: true` dans le journal signale à l'Admin
que ce dossier mérite un œil attentif sur le contact.

## Validation — `valider_publication_vitrine(appartement, accepter, motif)`

Admin plateforme seulement (`ERR_ACCES_PLATEFORME`), annonce
en attente seulement (`ERR_VITRINE_PAS_EN_ATTENTE`).

- **Acceptée** : statut `approuve`, `vitrine_valide_par` /
  `vitrine_valide_le` posés, motif effacé. Journalisé
  (`vitrine_approuvee`). L'annonce devient visible et porte
  le badge « ✓ Vérifié ».
- **Refusée** : motif **obligatoire**
  (`ERR_VITRINE_MOTIF_REQUIS`) — il est conservé dans
  `vitrine_motif_refus` pour être montré au propriétaire, et
  dans le journal (`vitrine_refusee`, `details.motif`).
  Validateur et date sont posés aussi : un refus est une
  décision tracée, pas une absence de décision.

## Retrait — `retirer_publication_vitrine(appartement)`

Même contrôle d'accès que la demande, **sans** les validations
de contenu : retirer une annonce doit toujours rester
possible. Pose `vitrine = false`, statut `non_publie`, traces
effacées ; journalisé (`vitrine_publication_retiree`).

## Anti-fraude : le trigger de revalidation

`trg_vitrine_revalidation` (BEFORE UPDATE sur `appartements`,
fonction `vitrine_revalidation_auto`). Si l'annonce est
`approuve` **et** que l'écriture ne change pas le statut,
tout changement (`is distinct from`) sur un champ surveillé
repasse le statut à `en_attente` et efface la trace de
validation — dans la même écriture : l'annonce disparaît de
la vitrine à l'instant de la modification, sans fenêtre où le
contenu nouveau bénéficierait de l'ancienne approbation.

Champs surveillés : `loyer_defaut`, `devise`, `charges`,
`photos`, `description`, `visite_jours`, `visite_heures`,
`contact_nom`, `contact_telephone`, `contact_email`.

La garde « pas de changement de statut dans la même
écriture » est essentielle : les RPC du module (demande,
validation, retrait) posent elles-mêmes le statut dans leurs
UPDATE — le trigger les laisse passer et ne frappe que les
modifications directes de contenu sur une annonce approuvée.

## Colonnes ajoutées

- `appartements` : `vitrine_statut`, `vitrine_motif_refus`,
  `vitrine_valide_par`, `vitrine_valide_le`, `pieces`
  (nullable, `> 0` si présent), `meuble` (défaut false),
  `disponible_le`, `visite_jours` (défaut `'{}'`),
  `visite_heures`, `contact_nom`, `contact_telephone`,
  `contact_email`, `contact_justification`.
- `immeubles` : `quartier` (affiché sur l'annonce, sans
  exposer l'adresse exacte).

## Limites honnêtes

- **Pas de notification automatique au propriétaire** lors de
  la décision : ni l'approbation ni le refus ne déclenchent
  d'e-mail ou d'avis depuis la base. Le propriétaire voit le
  nouveau statut (et le motif, en cas de refus) dans son
  espace ; la journalisation existe, l'envoi reste à brancher
  côté application si le fondateur le demande.
- **La file de validation console est lue par requêtes**,
  pas par une RPC dédiée : la console interroge directement
  les appartements `vitrine_statut = 'en_attente'` (les
  politiques plateforme existantes le permettent). Pas de
  fonction `lister_file_vitrine` dans ce module — si la file
  grossit et demande tri/pagination serveur, ce sera un ajout
  séparé.
- La revalidation ne surveille que les champs listés
  ci-dessus : modifier `pieces`, `meuble`, `disponible_le` ou
  le quartier de l'immeuble ne repasse pas l'annonce en
  attente. C'est un choix : seuls les champs qui changent
  l'offre (prix, contenu, contact, visites) exigent une
  relecture.
- Les photos restent des URL fournies par le client : la base
  contrôle leur nombre (1 à 10), pas ce qu'elles montrent —
  c'est la relecture humaine de l'Admin, avant approbation,
  qui fait foi. D'où le badge : « Vérifié » signifie relu par
  la plateforme, pas authentifié par un tiers.
