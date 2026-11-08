# CizaImmo v1.7 — Passeport photo + autorisation de gestion (2026-11-07)

Décision du fondateur (étape 2 prioritaire) : la photo de l'immeuble
EST la photo de son passeport — cliente, gestionnaire et support
voient d'un coup d'œil de quelle maison on parle. Et un gestionnaire
qui crée un immeuble dépose l'autorisation de gestion signée par le
propriétaire au lieu du titre de propriété.

## Point 1 — Photos du bien

- **Stockage** : les fichiers vont dans le bucket privé existant
  `documents-prives` (chemin préfixé par l'id de l'uploadeur, imposé
  par les politiques Storage). La base ne garde que les **chemins**
  (`immeubles.photos text[]`) ; l'affichage passe par des **URLs
  signées 1 h** résolues en un appel (`createSignedUrls`) dans
  `lib/data/real.ts` (`enrichirPhotosImmeubles` → `photos_urls`,
  tableaux alignés par index). Aucun nouveau bucket, aucun lien
  public permanent.
- **Exigence ≥ 1 photo** : au **formulaire** (création ET
  modification ; photos déjà téléversées + photos stagées comptent).
  Pas de contrainte provider/base : les flux historiques et les tests
  créent des immeubles sans photo ; en modification, l'ancien lien
  `photo_url` seul suffit à valider (affiché en repli, non retirable).
- **Affichage** : bandeau en tête de la page du bien + galerie du
  passeport (badge « Principale » sur la première) ; vignettes dans
  la liste des immeubles (cartes mobile + tableau desktop) ; vignette
  dans la page Dossier console (immeubles possédés et gérés).
- **Gestion** : ajout multiple (jpg/jpeg/png, ≤ 10 Mo), retrait par
  photo ; en création les photos sont téléversées juste après la
  création du bien, en modification l'ajout/retrait est immédiat.
  La garde d'écriture v1.4 s'applique (politiques immeubles).

## Point 2 — Cas gestionnaire

- Le **rôle du créateur** décide du justificatif : propriétaire =
  preuve de propriété inchangée (v1.3) ; **gestionnaire** = section
  dédiée du formulaire : **nom + e-mail du propriétaire déclarés
  (obligatoires)** et **autorisation de gestion** (document de type
  `autorisation`, téléversé sur l'immeuble).
- L'immeuble part en **revue plateforme** :
  `immeubles.validation_statut` = `en_attente` (propriétaire :
  `valide` d'office). Décision par la **RPC base**
  `decider_validation_immeuble` (rôle plateforme vérifié en interne,
  refus = motif obligatoire, journal `immeuble_gestion_valide` /
  `immeuble_gestion_refuse`). Un refus corrigé par le gestionnaire
  (déclaré modifié) **resoumet** automatiquement le bien.
- **Concordance** : si l'e-mail déclaré égale celui d'un propriétaire
  d'un rattachement **actif** du gestionnaire (contexte propriétaire,
  validé Admin), `proprietaire_concordance = true` — signalé dans la
  revue console (« Concordance automatique »). Sinon, vérification
  manuelle. L'autorisation reste exigée dans les deux cas.
- **Console** (page Dossier du compte gestionnaire) : section
  « Immeubles créés par ce gestionnaire — revue » : vignette,
  propriétaire déclaré, pastilles concordance + statut, bouton
  « Ouvrir l'autorisation », Valider / Refuser à motifs prédéfinis.
- Le propriétaire déclaré ne gagne **aucun accès** par cette
  déclaration ; aucune notification nouvelle n'est créée.

## Base (module SQL)

`supabase/module-v17.sql` (idempotent) : colonnes `photos`,
`origine_creation`, `proprietaire_declare_nom/email`,
`proprietaire_concordance`, `validation_statut`, `validation_motif` ;
contrainte « gestionnaire ⇒ déclaré présent » ; CHECK documents
élargi à `autorisation` ; cible d'audit `immeuble` ; RPC de décision.
Morceaux prêts dans `~/workspace/cizaimmo-sql-v17/` — **à appliquer
au live APRÈS le déploiement Vercel du push** (ordre habituel).

## Limites honnêtes

- Un chemin Storage est préfixé par l'uploadeur : un propriétaire ne
  peut pas signer les photos téléversées par son gestionnaire (et
  inversement) — même patron que les documents existants.
- Démo : le persona gestionnaire (Marc) n'est pas un compte listable
  de la console ; sa revue se vérifie via ses immeubles (page du bien)
  et le journal. Pour un compte gestionnaire réel, la revue apparaît
  dans son Dossier console.
- L'exigence photo est un contrôle de formulaire, pas une contrainte
  base (voir ci-dessus).
