# Finances de la plateforme — Paie des employés + Dépenses supervisées

**Date :** 2026-11-08 · **Décision validée par le fondateur** le jour même.
**Périmètre : CizaImmo seulement** (la finance du groupe relèvera du futur
logiciel central des employés — projet séparé, « pas maintenant »).

## Ce que c'est

Une nouvelle section console **« Paie & Dépenses »** (groupe Plateforme,
`/console/finances-plateforme`), visible par les Admins et le Super Admin :

### 1. Paie des employés — émise depuis le dossier employé

- Pour le mois choisi (sélecteur, défaut = mois courant), la page liste les
  comptes plateforme (admin / super_admin) avec leur **contrat d'engagement**
  (montant, devise, modalités — colonnes `contrat_employe_*` du pack employé).
- **Dossier employé incomplet ⇒ émission impossible** : pastille
  « Émission impossible », blocage « Dossier incomplet » et **liste des
  éléments manquants** (photo, pièce d'identité, téléphone, adresse),
  calculés par la fonction de complétude existante (`lib/dossier-employe.ts`).
- Dossier complet mais **pas de contrat préparé** (ou contrat sans montant)
  ⇒ émission impossible également (`ERR_PAIE_SANS_CONTRAT`).
- Bouton **« Émettre la paie »** (Super Admin seul, avec confirmation et
  référence libre optionnelle) : la ligne insérée **copie montant, devise et
  modalités du contrat**. **Unicité : une seule paie par employé et par
  mois** — contrainte base (index unique partiel) + garde applicative
  (`ERR_PAIE_DEJA_EMISE`).
- Historique des paies émises (global pour le Super Admin ; l'Admin ne voit
  que les siennes).

### 2. Dépenses de fonctionnement — saisies par l'Admin, validées par le Super Admin

- Formulaire de saisie (Admin **et** Super Admin) : date, libellé,
  **catégorie fermée** (Hébergement & services, Communication, Marketing,
  Fournitures, Déplacements, Autre), montant, devise, **justificatif
  optionnel** (bucket privé `documents-prives`, préfixe
  `<saisi_par>/depenses-plateforme/`).
- Liste du mois, filtrable par statut (`en_attente` / `validee` / `refusee`).
- **Validation : Super Admin seulement** — celui qui saisit ne valide pas,
  **pas même ses propres dépenses** (garde par rôle dans les deux
  fournisseurs, testée ; RLS `update` réservée au Super Admin en réel).
  Refus = **motif obligatoire**. Validateur et date de décision enregistrés.
- **Totaux du mois par devise** (aucune conversion inventée) : paie émise +
  dépenses validées ; les dépenses **en attente comptées à part**, les
  refusées exclues.

### 3. Côté employé — « Ma paie »

Dans **« Mon dossier employé »**, une section **« Ma paie »** liste les paies
émises de l'employé connecté (mois, montant, devise, date d'émission,
référence, modalités) — **lecture seule, ses données uniquement**.

### 4. Journalisation

Émission de paie (`paie_emise`), saisie (`depense_plateforme_saisie`),
validation (`depense_plateforme_validee`) et refus
(`depense_plateforme_refusee`) sont écrits dans le **journal d'audit**
existant. Parcours client intégralement inchangé ; i18n FR/EN complet
(namespace `financesPlateforme`).

## Technique

| Pièce | Emplacement |
|---|---|
| Règles pures | `lib/finances-plateforme.ts` (mois `AAAA-MM`, catégories fermées, `blocagesPaie`, `totauxParDevise`) |
| SQL | `supabase/module-finances-plateforme.sql` — tables `paies_employes` + `depenses_plateforme`, RLS plateforme (lecture admin+super_admin ; insertion dépenses plateforme ; validation super_admin seul ; paies : insertion super_admin seul, ni update ni delete), index unique partiel `(profil_id, mois) WHERE statut='emise'`, vérifications V1–V5 en commentaires |
| Fournisseur | `getVueFinancesPlateforme`, `emettrePaieEmploye`, `saisirDepensePlateforme`, `validerDepensePlateforme`, `refuserDepensePlateforme`, `listerMesPaies` (démo + réel) |
| Page | `app/[locale]/console/finances-plateforme/page.tsx` + section « Ma paie » dans `app/[locale]/console/mon-dossier/page.tsx` |
| Test | `scripts/test-finances-plateforme.cjs` (branché dans `scripts/run-tests.sh`) |

Codes d'erreur : `ERR_DOSSIER_INCOMPLET`, `ERR_PAIE_SANS_CONTRAT`,
`ERR_PAIE_DEJA_EMISE`, `ERR_DEPENSE_INVALIDE`, `ERR_MOIS_INVALIDE`
(+ réutilisés : `ERR_SUPER_ADMIN_REQUIS`, `ERR_MOTIF_REQUIS`,
`ERR_STATUT_INVALIDE`, `ERR_ACCES_PLATEFORME`).

## ⚠️ À appliquer au live

`supabase/module-finances-plateforme.sql` est **versionné mais NON
appliqué** : l'appliquer dans le SQL Editor Supabase (projet CizaImmo,
réf. ikyhrzgsdmztlngyqhmw) après le push, puis vérifier V1–V5
(2 tables, 11/13 colonnes, 5 politiques, index unique, tables vides).
