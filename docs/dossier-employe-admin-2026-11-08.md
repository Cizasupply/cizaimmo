# Dossier employé complet des Admins (2026-11-08)

Décision du fondateur : un Admin (employé) doit remplir **son dossier
complet d'employé** — identité + **adresse** — comme le dossier d'un
client, en plus complet.

## Modèle

Le dossier employé compte **4 éléments** :

| Élément | Stockage | Depuis |
|---|---|---|
| Photo de profil | `profils.photo_profil_path` (bucket privé `documents-prives`) | v1.3 |
| Pièce d'identité | table `documents` (`entite_type = 'compte'`, `type = 'piece_identite'`) | v1.3 |
| Téléphone | `profils.telephone` | v1.3 |
| **Adresse postale** | **NOUVEAU** : `profils.adresse`, `adresse_ville`, `adresse_code_postal`, `adresse_pays` | ce module |

Adresse complète = adresse + ville + pays renseignés ; le **code
postal est optionnel** et n'entre jamais dans le calcul.

**Complétude CALCULÉE, jamais stockée** : la fonction pure
`evaluerDossierEmploye` (`lib/dossier-employe.ts`), partagée par les
deux fournisseurs, retourne `{ complet, manquants }` à partir des 4
éléments. Aucun statut en base, aucune copie à synchroniser — la base
reste la source de vérité.

**Exigence suivie, NON bloquante** (patron du contrat propriétaires
option C) : l'accès console d'un Admin n'est jamais conditionné à son
dossier. La promotion Admin ne pose rien d'autre que le rôle : tout
compte `admin`/`super_admin` dont les 4 éléments ne sont pas réunis
est « incomplet ». **Rétroactivité** : les comptes existants démarrent
« incomplet » — le compte de test **CIM-000003** (une fois promu) et le
**Super Admin fondateur CIM-000001** inclus ; son dossier se complète
par la même page. Le Super Admin peut suspendre un employé à tout
moment, indépendamment du dossier.

**Parcours client inchangé** : le dossier client reste photo + pièce +
téléphone, **sans adresse** (vérifié par test : aucun champ adresse
côté client, aucun texte client touché).

## Surfaces

- **Page console « Mon dossier employé »** (`/console/mon-dossier`,
  entrée du menu console visible par admin ET super_admin, icône carte
  d'identité) : statut calculé (complet / incomplet + manquants),
  photo (affichée en lien signé 1 h en réel), pièce d'identité
  (téléversement bucket privé, patron du dossier client ; bouton
  « Ouvrir » en lien signé), formulaire téléphone + adresse. Un
  client y est refusé : garde du `ConsoleShell` (rôles plateforme) +
  `ERR_ACCES_PLATEFORME` du fournisseur.
- **Page Équipe** (Super Admin) : chaque membre porte une pastille
  « Dossier employé : Complet / Incomplet » (champs
  `MembreEquipe.dossier_employe_complet` / `dossier_employe_manquants`,
  calculés dans `listerEquipeAdmins` des deux fournisseurs) et un
  bouton **« Voir le dossier employé »** qui déplie le détail :
  photo, pièce (nom + « Ouvrir » en lien signé), téléphone, adresse
  complète, éléments manquants. Le détail passe par
  `listerDossierEmploye(adminId)`, **Super Admin uniquement**
  (`ERR_SUPER_ADMIN_REQUIS` pour un admin simple).

## Fournisseur (contrat `lib/data/provider.ts`)

5 méthodes dédiées (les méthodes client partagées rejettent les
sessions plateforme en démo, d'où des méthodes propres) :

- `getMonDossierEmploye()` — le dossier de l'employé connecté ;
- `mettreAJourDossierEmploye(patch)` — téléphone + adresse (réel :
  passe par `modifierProfil`, étendu aux 4 colonnes d'adresse) ;
- `televerserPhotoDossierEmploye(input)` — réel : délègue à
  `televerserPhotoProfil` (même bucket, même patron) après garde de
  rôle ;
- `televerserPieceDossierEmploye(input)` — réel : délègue à
  `soumettreDocumentCompte("piece_identite", …)` ;
- `listerDossierEmploye(adminId)` — Super Admin, détail Équipe.

En réel, la photo et la pièce du détail sont servies en **liens signés
1 h** (bucket privé), comme le dossier client. En démo, le stockage
suit les magasins existants : entrée `comptesAdmins` pour les sessions
plateforme (champs optionnels ajoutés à `CompteAdmin`), profil
principal pour un Admin promu connecté comme lui-même, pièces dans
`documentsComptes` / `db.documents`.

## SQL — À APPLIQUER AU LIVE (non appliqué par le code)

**`supabase/module-dossier-employe.sql`** : 4 colonnes nullables sur
`profils` (`adresse`, `adresse_ville`, `adresse_code_postal`,
`adresse_pays`), idempotent, aucune politique RLS nouvelle (les
politiques `profils` existantes couvrent : lecture plateforme via
`est_admin_plateforme`, auto-écriture de son profil). Vérifications
**V1** (colonnes présentes), **V2** (rétroactivité : CIM-000001
`adresse_complete = false`), **V3** (compte de test CIM-000003
présent), **V4** (clients non touchés) en fin de fichier.

⚠️ Ordre : déployer le code (push) puis appliquer le SQL — avant
l'application, les lectures réelles tolèrent l'absence des colonnes
(valeurs nulles → dossier « incomplet »), mais l'**écriture** de
l'adresse échouera tant que le module n'est pas appliqué.

## Tests

`scripts/test-dossier-employe.cjs` (bloc « Dossier employé des
Admins » de `scripts/run-tests.sh`, harnais étendu à
`lib/dossier-employe.ts`) — **26 OK / 0 KO** :

- fonction pure : complet sans code postal, adresse sans ville →
  manquant « adresse », ordre des 4 manquants, téléphone vide ;
- statique : SQL (colonnes + V1..V4 + CIM-000001/000003), contrat du
  fournisseur, entrée console + icône, pages, parcours client sans
  adresse ;
- rôles : client refusé (`ERR_ACCES_PLATEFORME` × 2) ;
- flux démo : Admin existant incomplet (4 manquants) → console
  utilisable quand même (non bloquant) → champs → photo → pièce →
  **complet** ;
- Équipe : Admin complété « Complet », fondateur « Incomplet »
  (rétroactivité), détail Super Admin complet ; admin simple refusé
  (`ERR_SUPER_ADMIN_REQUIS`) ;
- promotion : un compte fraîchement promu démarre « incomplet »
  (adresse manquante).

Suite complète verte (0 KO) et `npm run build` OK (route
`/[locale]/console/mon-dossier` FR + EN). i18n : parité 1 880 clés
FR = EN, namespace `dossierEmploye` + `console.myEmployeeFile`.

## Texte d'introduction de « Mon dossier employé » (2026-11-08)

Demande du fondateur sur capture (« le commentaire dans la page mon
dossier, commentaire en haut à changer »), texte validé mot pour mot
par lui : les deux anciens textes internes de l'en-tête — le
sous-titre du bandeau (« Identité et adresse de l'employé — suivi par
le Super Admin, jamais bloquant. ») et le paragraphe d'introduction
(« …suivi par le Super Admin — sans jamais bloquer votre accès à la
console. ») — sont remplacés par un texte unique, affiché une seule
fois dans le bandeau (clé `dossierEmploye.subtitle`) :

- FR : « Votre dossier d'employé CizaImmo : votre identité, votre
  adresse et vos documents professionnels, réunis en un seul endroit.
  Gardez vos informations à jour — elles servent à votre contrat, à
  votre carte d'employé et à votre paie. »
- EN : “Your CizaImmo employee file: your identity, your address and
  your professional documents, all in one place. Keep your
  information up to date — it is used for your contract, your
  employee card and your pay.”

La clé `dossierEmploye.intro` (devenue inutile, utilisée par cette
seule page) est retirée des deux fichiers de messages ; la page
n'affiche plus que `t("title")` + `t("subtitle")` dans le bandeau.
Aucun autre changement (ni structure, ni règles, ni autres pages).

Tests : 5 contrôles statiques ajoutés à
`scripts/test-dossier-employe.cjs` (textes FR + EN verbatim, clé
`intro` absente, anciennes formulations « suivi par le Super Admin » /
« jamais bloquant » / EN absentes des messages, page sans
`t("intro")`) — bloc Dossier employé 31 OK / 0 KO ; parité i18n
2 136 clés FR = EN ; suite complète : seuls les 3 KO préexistants
du Module 3 (fixtures sensibles à la date) subsistent.
