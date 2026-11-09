#!/usr/bin/env bash
# Tests consolidés des modules 3, 4, 5, 6 et 7 (Module 7, spec §15),
# plus les correctifs 1 + 2 (lien locataire, e-mail des alertes).
#
# Les scripts de test des modules 3-6 dépendaient d'un harnais compilé
# dans /tmp (effacé entre sessions). Ce script compile le harnais UNE
# fois dans .test-build/ (dossier du dépôt, ignoré par git) puis lance
# les 5 scripts de test avec TEST_BUILD_DIR pointant dessus.
#
# Usage :
#   bash scripts/run-tests.sh            # tout lancer
#   bash scripts/run-tests.sh 3 5        # seulement les modules 3 et 5
set -u
cd "$(dirname "$0")/.."

BUILD_DIR="$PWD/.test-build"
export TEST_BUILD_DIR="$BUILD_DIR"

echo "== Compilation du harnais de test -> $BUILD_DIR =="
rm -rf "$BUILD_DIR"
npx tsc --outDir "$BUILD_DIR" --module commonjs --target es2020 \
  --esModuleInterop --skipLibCheck --moduleResolution node --rootDir lib \
  lib/loyers.ts lib/module4.ts lib/exports.ts lib/email.ts lib/format.ts \
  lib/abonnement.ts lib/countries.ts lib/indivision.ts lib/whatsapp.ts lib/taux.ts \
  lib/grille.ts lib/tarifs.ts lib/avis.ts lib/contrat.ts lib/cachet.ts lib/guide.ts \
  lib/dossier-employe.ts \
  lib/logos-pdf.ts \
  lib/code128.ts \
  lib/pack-employe.ts \
  lib/contrat-employe.ts \
  lib/finances-plateforme.ts \
  lib/talon-paie.ts \
  lib/data/demo.ts lib/data/demo-seed.ts lib/data/types.ts \
  lib/data/helpers.ts lib/data/provider.ts || {
  echo "ÉCHEC de la compilation du harnais." >&2
  exit 1
}

MODULES="${*:-3 4 5 6 7}"
ECHEC=0
for m in $MODULES; do
  echo ""
  echo "===== Module $m ====="
  if node "scripts/test-module$m.cjs"; then
    echo "Module $m : OK"
  else
    echo "Module $m : ÉCHEC" >&2
    ECHEC=1
  fi
done

# Correctifs 1 + 2 (lien locataire, e-mail des alertes) : même harnais.
echo ""
echo "===== Correctifs (lien locataire + e-mail alertes) ====="
if node "scripts/test-correctifs.cjs"; then
  echo "Correctifs : OK"
else
  echo "Correctifs : ÉCHEC" >&2
  ECHEC=1
fi

# Extension v1.2 — Admin / Super Admin, finances dynamiques,
# anti-fraude tarifaire, approbation manuelle : même harnais.
echo ""
echo "===== Extension v1.2 (Admin / Finances / Anti-fraude / Approbation) ====="
if node "scripts/test-admin-finance.cjs"; then
  echo "Extension v1.2 : OK"
else
  echo "Extension v1.2 : ÉCHEC" >&2
  ECHEC=1
fi

# Convertisseur public de la mini-grille : fusion Frankfurter + ER-API
# (fonction pure de lib/taux.ts) : même harnais.
echo ""
echo "===== Convertisseur public (Frankfurter + ER-API) ====="
if node "scripts/test-taux-convertisseur.cjs"; then
  echo "Convertisseur public : OK"
else
  echo "Convertisseur public : ÉCHEC" >&2
  ECHEC=1
fi

# Extension v1.3 — parcours d'inscription et dossiers vérifiés :
# Display ID, intention, dossier, contrat gestionnaire (cachet +
# pièce jointe), rattachement à triple validation : même harnais.
echo ""
echo "===== Extension v1.3 (Inscription / Dossiers / Contrat / Rattachement) ====="
if node "scripts/test-inscription-v13.cjs"; then
  echo "Extension v1.3 : OK"
else
  echo "Extension v1.3 : ÉCHEC" >&2
  ECHEC=1
fi

# Extension v1.4 — la base est la source de vérité : garde
# d'écriture SQL (politiques RLS), essai Starter forcé dans la base
# (naissance + approbation), plan_apres_essai, inscription sans plan.
echo ""
echo "===== Extension v1.4 (Base source de vérité / Essai Starter) ====="
if node "scripts/test-base-verite-v14.cjs"; then
  echo "Extension v1.4 : OK"
else
  echo "Extension v1.4 : ÉCHEC" >&2
  ECHEC=1
fi

# Extension v1.5 — suppression de compte par le client (base :
# RPC + instantané + anonymisation comptable) : même harnais.
echo ""
echo "===== Extension v1.5 (Suppression de compte par le client) ====="
if node "scripts/test-suppression-v15.cjs"; then
  echo "Extension v1.5 suppression : OK"
else
  echo "Extension v1.5 suppression : ÉCHEC" >&2
  ECHEC=1
fi

# Extension v1.5 — messagerie directe supervisée + assignation des
# dossiers + équipe / Mes dossiers : même harnais.
echo ""
echo "===== Extension v1.5 (Messagerie supervisée + Assignation) ====="
if node "scripts/test-messagerie-assignation-v15.cjs"; then
  echo "Extension v1.5 messagerie/assignation : OK"
else
  echo "Extension v1.5 messagerie/assignation : ÉCHEC" >&2
  ECHEC=1
fi

# Extension v1.6 — Vitrine vérifiée : aucune annonce publique sans
# approbation Admin (base : RPC + trigger de revalidation +
# politiques publiques), badge « ✓ Vérifié », règle contact +
# justification, file console : même harnais.
echo ""
echo "===== Extension v1.6 (Vitrine vérifiée) ====="
if node "scripts/test-vitrine-v16.cjs"; then
  echo "Extension v1.6 : OK"
else
  echo "Extension v1.6 : ÉCHEC" >&2
  ECHEC=1
fi

# Correctif e-mails (2026-11-07) : matcher middleware (exclusion « auth »,
# 404 des liens de confirmation) + gabarit e-mail premium (lib/email.ts,
# déjà dans le harnais).
echo ""
echo "===== Correctif e-mails (middleware auth + gabarit premium) ====="
if node "scripts/test-email-gabarit.cjs"; then
  echo "Correctif e-mails : OK"
else
  echo "Correctif e-mails : ÉCHEC" >&2
  ECHEC=1
fi

# Correctif « premier immeuble en réel » (2026-11-07) : clés i18n
# utilisées mais absentes (crud.common.create sur 6 pages de création)
# + colonnes passeport du Module 6 (module-correctif-immeuble.sql).
# Le balayage COMPLET des clés utilisées vit dans
# scripts/i18n-cles-utilisees.py : la parité FR/EN seule ne suffisait
# pas (les deux fichiers manquaient la clé de la même façon).
echo ""
echo "===== Correctif immeuble (i18n clés utilisées + SQL passeport) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-correctif-immeuble.cjs"; then
  echo "Correctif immeuble : OK"
else
  echo "Correctif immeuble : ÉCHEC" >&2
  ECHEC=1
fi

# Correctif « grille console + suppression Paramètres + bilingue »
# (2026-11-07) : RPC reattribuer_grille (la réattribution v1.2
# écrivait en direct sans lire les erreurs), point d'entrée
# suppression dans Paramètres, sélecteur de langue dans les shells
# App/Console, codes console.errors complétés.
echo ""
echo "===== Correctif grille + suppression + bilingue ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-correctif-grille-suppression.cjs"; then
  echo "Correctif grille/suppression/bilingue : OK"
else
  echo "Correctif grille/suppression/bilingue : ÉCHEC" >&2
  ECHEC=1
fi

# Renfort « suppression de compte : confirmation par mot de passe »
# (2026-11-07, règle du fondateur) : le mot de passe du compte est
# vérifié (Supabase Auth en réel) AVANT la RPC de suppression ; un
# mot de passe faux ne change rien. Dialogue partagé Paramètres +
# Abonnement, rétractation inchangée (sans mot de passe).
echo ""
echo "===== Renfort suppression + mot de passe ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-suppression-mdp.cjs"; then
  echo "Renfort suppression/mot de passe : OK"
else
  echo "Renfort suppression/mot de passe : ÉCHEC" >&2
  ECHEC=1
fi

# Checklist de vérification avant approbation + registre d'audit
# enrichi (2026-11-07, demande du fondateur) : garde d'approbation
# dans la base (approuver_compte lève CHECKLIST_INCOMPLETE), RPC de
# consignation des coches, journal enrichi (nom de l'acteur figé à
# l'écriture + trigger de complétion), affichage « Nom — rôle —
# jour à heure ». Module SQL :
# supabase/module-checklist-audit.sql (morceaux dans
# ~/workspace/cizaimmo-sql-checklist/, à appliquer au live).
echo ""
echo "===== Checklist + audit enrichi ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-checklist-audit.cjs"; then
  echo "Checklist/audit : OK"
else
  echo "Checklist/audit : ÉCHEC" >&2
  ECHEC=1
fi

# Extension v1.7 — Passeport photo + autorisation de gestion
# (2026-11-07, décision du fondateur) : photo de l'immeuble = photo
# du passeport (upload ≥ 1 photo, première = principale, bucket
# privé + URLs signées, vignettes listes + dossier console) ; cas
# gestionnaire : autorisation de gestion au lieu du titre,
# propriétaire déclaré obligatoire, revue plateforme (RPC
# decider_validation_immeuble), concordance rattachement. Module
# SQL : supabase/module-v17.sql (morceaux dans
# ~/workspace/cizaimmo-sql-v17/, à appliquer au live APRÈS le push).
echo ""
echo "===== Extension v1.7 (Passeport photo + autorisation) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-v17.cjs"; then
  echo "Extension v1.7 : OK"
else
  echo "Extension v1.7 : ÉCHEC" >&2
  ECHEC=1
fi

# Correctif « zone connectée figée » (2026-11-07, soir) : le
# cookie de session DÉMO (posé pendant la période démo du
# 2026-11-06, 30 jours) authentifiait dans le middleware même en
# mode réel, et RealProvider.signOut ne l'effaçait pas — après une
# déconnexion réelle, retour forcé au tableau de bord sans session :
# espace connecté figé, déconnexion/connexion impossibles.
# Correctif : cookie démo honoré seulement en mode démo (middleware)
# + effacement du cookie dans RealProvider.signOut.
echo ""
echo "===== Correctif cookie démo (zone connectée figée) ====="
if node "scripts/test-correctif-cookie-demo.cjs"; then
  echo "Correctif cookie démo : OK"
else
  echo "Correctif cookie démo : ÉCHEC" >&2
  ECHEC=1
fi

# Correctif « journal d'audit » (2026-11-07, soir, demandes du
# fondateur après son test réel) : (1) détails lisibles — l'ancien
# rendu String(v) affichait « [object Object] » pour les objets /
# tableaux imbriqués du jsonb (« Tarifs modifiés », « Paramètres
# finance modifiés ») ; formateur partagé formatDetailsAudit
# (lib/format.ts). (2) Filtre intelligent : recherche libre sur le
# texte lisible + Action / Acteur / Période, compteur, reset.
# (3) Organisation : filtres en carte, tableau bureau sans
# débordement, cartes mobile (patron de l'app connectée).
echo ""
echo "===== Correctif journal (détails lisibles + filtre + organisation) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-journal-details.cjs"; then
  echo "Correctif journal : OK"
else
  echo "Correctif journal : ÉCHEC" >&2
  ECHEC=1
fi

# Correctif visuel « cartes + graphique » (2026-11-07, soir,
# demandes du fondateur) : (1) bordure slate-200 sur TOUTES les
# cartes blanches/teintées de l'espace connecté (patron partagé,
# 132 chaînes uniformisées — les contours étaient invisibles sur
# fond blanc) ; (2) graphique « Collecte des 6 derniers mois »
# réduit (viewBox 360×170 → 360×100, conteneur plafonné à 560 px)
# pour que les mois redeviennent lisibles. Aucune donnée touchée.
echo ""
echo "===== Correctif cartes + graphique ====="
if node "scripts/test-correctif-cartes-graphique.cjs"; then
  echo "Correctif cartes + graphique : OK"
else
  echo "Correctif cartes + graphique : ÉCHEC" >&2
  ECHEC=1
fi

# Évolution « boîte de réception console + badge » (2026-11-07,
# soir, demande du fondateur après un test réel) : un message
# cliente (« Bonjour test ») était arrivé dans le fil plateforme
# d'un dossier NON assigné sans qu'aucun signal ne le montre dans
# la console. Ajouts : compteur plateforme (messages du client non
# lus, assignés ou non), entrée « Messages » + pastille dans
# ConsoleShell, page boîte de réception (tri par dernier message,
# clic -> Dossier #messages), bloc notification Vue d'ensemble.
# Aucun SQL : les colonnes lu_par_plateforme existent (v1.5).
echo ""
echo "===== Boîte de réception console + badge messages ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-console-messages-badge.cjs"; then
  echo "Boîte de réception + badge : OK"
else
  echo "Boîte de réception + badge : ÉCHEC" >&2
  ECHEC=1
fi

# Design « Marine & Or » déployé aux pages (2026-11-07, soir) :
# cohérence héros ↔ KPI du tableau de bord. Bug réel vu par le
# fondateur (Kaneza) : héros « Attendus : 0 BIF » contre KPI
# « 680 000 BIF » — l'ancienne fonction locale totauxConvertis
# n'additionnait pas les groupes déjà dans la devise d'affichage.
# La fonction vit dans lib/module4.ts (déjà au harnais) et la page
# l'utilise pour héros ET KPI ; le test verrouille les deux.
echo ""
echo "===== Design déployé (cohérence héros ↔ KPI) ====="
if node "scripts/test-design-heros.cjs"; then
  echo "Cohérence héros/KPI : OK"
else
  echo "Cohérence héros/KPI : ÉCHEC" >&2
  ECHEC=1
fi

# Design « Marine & Or » de la CONSOLE (2026-11-07, soir, ordre
# du fondateur : « Même chose pour Admin ») : menu premium console
# en parité avec l'AppShell client (sidebar à icônes partagées
# components/IconeNav, actif or, groupes ; barre inférieure mobile
# + panneau « Plus » plein écran ; pastille Messages étendue à la
# barre inférieure, logique du compteur inchangée), héros marine de
# la Vue d'ensemble (compteurs existants), KPI à accents métier,
# primaire or unique par page console, en-têtes de tableaux crème.
echo ""
echo "===== Design console (menu premium + héros + primaires or) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-design-console.cjs"; then
  echo "Design console : OK"
else
  echo "Design console : ÉCHEC" >&2
  ECHEC=1
fi

# Correctifs mobile « annotations du fondateur » (2026-11-08) :
# 3 captures annotées au doigt — (1) barre supérieure console :
# « Se déconnecter » débordait (logo réduit, langue compacte,
# déconnexion icône seule ; même discipline AppShell) ; (2) page
# Dossier : carte Identité débordante (grille grid-cols-1, lignes
# libellé/valeur enroulables, balayage grilles console) ; (3) KPI
# client « 680 000 BIF » cassé en plein milieu (break-all) :
# montants nowrap + taille responsive, client ET console ; héros
# sans break-all ; (4) héros console : libellés collés en 3
# colonnes étroites -> empilés sur mobile. Design uniquement.
# Lot additionnel du même jour (3 captures EN, compte Kaneza) :
# (C) détail locataire — e-mail insécable hors de la carte Contact ;
# (D) page Messages entière plus large que l'écran (grille sans
# colonne mobile explicite) ; (E) champ DATE des formulaires plus
# large que les autres (largeur intrinsèque WebKit iOS) — Field,
# champs bruts et garde-fou global globals.css.
echo ""
echo "===== Correctifs mobile (annotations du fondateur) ====="
if node "scripts/test-correctif-mobile-annotations.cjs"; then
  echo "Correctifs mobile : OK"
else
  echo "Correctifs mobile : ÉCHEC" >&2
  ECHEC=1
fi

# Correctif « ligne au scroll + tuiles statistiques » (2026-11-08,
# preuves du fondateur) : (A) vidéo du tableau de bord — une bande
# marine traversait l'écran pendant le défilement iOS. PASSE 1
# (couche de composition .barre-fixe-ios / translateZ(0)) jugée
# INSUFFISANTE par le fondateur sur son iPhone réel (« la barre
# passe toujours ») -> PASSE 2 STRUCTURELLE : le mécanisme est
# supprimé — coques mobiles en colonne flex h-dvh, zone défilante
# interne (overflow-y-auto), barre inférieure DANS LE FLUX, pb-28
# retiré, bureau inchangé (md:contents). (B) Capture passeport Kaneza Home :
# « 300 000 000 BIF » débordait de sa tuile (montant = jeton
# insécable, ~146 px à text-xl pour ~107 px utiles) -> tuiles
# statistiques de toute l'app au patron KPI : whitespace-nowrap +
# taille par paliers + grilles minmax(0,1fr), et plus aucun montant
# en break-all. Format d'affichage inchangé (montant complet).
echo ""
echo "===== Correctif scroll (fantôme iOS) + tuiles statistiques ====="
if node "scripts/test-correctif-scroll-tuiles.cjs"; then
  echo "Correctif scroll + tuiles : OK"
else
  echo "Correctif scroll + tuiles : ÉCHEC" >&2
  ECHEC=1
fi

# Design « Marine & Or premium » de la PAGE D'ACCUEIL PUBLIQUE
# (2026-11-08, ordre du fondateur : « il reste page d'accueil » —
# dernière surface après l'espace client et la console) : héros
# marine #1B2A4A + CTA or / contour clair, sections alternées
# crème/blanc, titres marine SemiBold + filet or, cartes blanches
# bordées au patron ; mini-grille tarifaire au patron (cartes
# blanches, prix marine gras, Pro en avant marine/or) avec
# MÉCANIQUE INTACTE (prix des tables finance, taux publics datés,
# jamais « en direct ») ; en-tête/pied publics alignés bg-navy.
# Aucun contenu, texte ni libellé nouveau.
echo ""
echo "===== Design accueil public (Marine & Or) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-design-accueil.cjs"; then
  echo "Design accueil : OK"
else
  echo "Design accueil : ÉCHEC" >&2
  ECHEC=1
fi

# Page publique « À propos » (2026-11-08, « Apropos aussi ») :
# TEXTE VALIDÉ MOT POUR MOT par le fondateur (namespace « about »,
# égalité exacte verrouillée en FR, parité FR/EN), photo du
# FONDATEUR en carte encadrée dans le héros avec légende
# (décision finale — pas de photo de résidence sur cette page),
# lien « À propos » dans l'en-tête et le pied publics, CTA final
# unique (même règle anti-doublon que l'accueil).
echo ""
echo "===== Page À propos (texte validé + photo fondateur) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-page-a-propos.cjs"; then
  echo "Page À propos : OK"
else
  echo "Page À propos : ÉCHEC" >&2
  ECHEC=1
fi

# Option C (2026-11-08) — Contrat de service PROPRIÉTAIRE non
# bloquant (variante C validée par le fondateur) : déclinaison du
# flux gestionnaire v1.3 — PDF personnalisé joint à la bienvenue,
# cycle a_signer / signe_depose / valide / refuse (motif) suivi en
# base (profils.statut_contrat_proprietaire, module SQL dédié),
# dépôt depuis l'espace, revue console, rétroactivité des comptes
# déjà approuvés (Kaneza) SANS e-mail. Aucune garde d'écriture ne
# dépend du contrat : accès + essai dès l'approbation.
echo ""
echo "===== Option C (Contrat propriétaire non bloquant) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-contrat-proprietaire.cjs"; then
  echo "Option C : OK"
else
  echo "Option C : ÉCHEC" >&2
  ECHEC=1
fi

# Micro-correctifs des captures annotées du fondateur (2026-11-08) :
# navigation de l'en-tête public sur UNE ligne en mobile (les 4
# liens au même niveau), libellés des boutons CTA publics centrés
# sur UNE ligne, ligne entreprise de la page À propos rendue par
# segments insécables (e-mail et numéro WhatsApp jamais cassés).
echo ""
echo "===== Correctif À propos / en-tête (captures fondateur) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-correctif-apropos-header.cjs"; then
  echo "Correctif À propos / en-tête : OK"
else
  echo "Correctif À propos / en-tête : ÉCHEC" >&2
  ECHEC=1
fi

# Micro-correctif capture fondateur (2026-11-08) : le Display ID
# (« CIM-000003 ») cassait en deux lignes dans l'encadré de
# l'écran d'attente — il est désormais insécable (whitespace-
# nowrap) sur cet écran et partout où il est rendu comme une
# pastille ou un élément mis en avant du même patron.
echo ""
echo "===== Correctif Display ID insécable (capture fondateur) ====="
if node "scripts/test-display-id-insecable.cjs"; then
  echo "Correctif Display ID insécable : OK"
else
  echo "Correctif Display ID insécable : ÉCHEC" >&2
  ECHEC=1
fi

# Guide d'utilisation joint à la bienvenue (2026-11-08, idée +
# validation du fondateur) : le guide PDF v3 (FR validée mot pour
# mot + traduction EN fidèle, fichiers statiques public/guides/)
# est joint EN PLUS du contrat, dans la langue du compte, aux deux
# flux d'approbation (bienvenue propriétaire option C + décision
# gestionnaire v1.3) — repli non bloquant si le guide est
# illisible. Lien de téléchargement sur la page « Mon contrat »
# (propriétaires ET gestionnaires, langue de l'interface).
echo ""
echo "===== Guide d'utilisation (bienvenue + Mon contrat) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-guide-bienvenue.cjs"; then
  echo "Guide d'utilisation : OK"
else
  echo "Guide d'utilisation : ÉCHEC" >&2
  ECHEC=1
fi

# Dossier employé complet des Admins (2026-11-08, décision du
# fondateur) : photo + pièce + téléphone + ADRESSE postale (nouveau
# champ, module SQL dédié NON appliqué par le code) ; complétude
# CALCULÉE (lib/dossier-employe.ts), exigence suivie NON bloquante ;
# page console « Mon dossier employé » (admin + super_admin, client
# refusé) ; page Équipe : statut par membre + détail Super Admin ;
# rétroactivité (fondateur et promus démarrent « incomplet ») ;
# parcours client inchangé (aucune adresse côté client).
echo ""
echo "===== Dossier employé des Admins (identité + adresse) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-dossier-employe.cjs"; then
  echo "Dossier employé : OK"
else
  echo "Dossier employé : ÉCHEC" >&2
  ECHEC=1
fi

# Pack employé Admin (2026-11-08, pack VALIDÉ par le fondateur,
# branché PAR-DESSUS le dossier employé) : contrat d'engagement à
# DEUX VOIES (travail au Burundi / prestation hors Burundi — textes
# générés, différences strictes, AUCUN « INSS » verrouillé), cycle
# de signature complet (préparation + e-mail PDF, dépôt, refus à
# motif, validation), charte de confidentialité acceptée et DATÉE,
# carte employé à code-barres Code 128 conditionnée (dossier complet
# + contrat validé), vérification contre la base (suspendu = NON
# VALIDE), progression en 4 étapes ; parcours client inchangé.
echo ""
echo "===== Pack employé Admin (contrat 2 voies + charte + carte) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-pack-employe.cjs"; then
  echo "Pack employé : OK"
else
  echo "Pack employé : ÉCHEC" >&2
  ECHEC=1
fi

# Finances de la plateforme (2026-11-08, décision VALIDÉE par le
# fondateur) : paie émise DEPUIS le dossier employé (montant /
# devise / modalités copiés du contrat d'engagement en base ;
# dossier incomplet = émission impossible, manquants listés ;
# unicité par employé et par mois) + dépenses de fonctionnement
# saisies par l'Admin et VALIDÉES par le Super Admin seul (celui
# qui saisit ne valide pas, même les siennes) ; totaux du mois PAR
# DEVISE ; l'employé ne voit que sa paie ; journalisation complète.
# Module SQL : supabase/module-finances-plateforme.sql (NON
# appliqué — à appliquer au live après le push).
echo ""
echo "===== Finances plateforme (Paie + Dépenses supervisées) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-finances-plateforme.cjs"; then
  echo "Finances plateforme : OK"
else
  echo "Finances plateforme : ÉCHEC" >&2
  ECHEC=1
fi

# Coordonnées de paiement de l'employé + liste « Vérifier un
# employé » + TALON DE PAIE (2026-11-08, ajouts VALIDÉS par le
# fondateur, coordonnées précisées : bancaires complètes structurées
# selon le moyen) : complétude calculée PAR MOYEN (virement : banque
# + n° de compte, IBAN/SWIFT/agence optionnels ; mobile : opérateur
# + numéro ; espèces : titulaire seul) ; porte d'émission APRÈS
# dossier et contrat (ERR_COORDONNEES_PAIEMENT_MANQUANTES) ;
# instantané de destination FIGÉ sur la paie émise ; coordonnées
# SANS effet sur la complétude du dossier ni sur la carte ; talon
# PDF régénéré à la demande (accès : Super Admin ou l'employé pour
# SES paies — ERR_TALON_INTROUVABLE sinon) ; recherche d'employés
# par nom / Display ID, liste limitée aux comptes plateforme.
# Module SQL : supabase/module-coordonnees-paiement.sql (à appliquer
# au live par le parent après le push).
echo ""
echo "===== Coordonnées de paiement + liste employés + talon de paie ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-coordonnees-paiement.cjs"; then
  echo "Coordonnées de paiement : OK"
else
  echo "Coordonnées de paiement : ÉCHEC" >&2
  ECHEC=1
fi

# Fournisseur RÉEL des finances contre un faux client PostgREST
# contraint au schéma LIVE (colonnes reconstruites depuis les
# modules SQL du dépôt) — non-régression du BUG PRODUCTION du
# 2026-11-08 : la vue Finances ordonnait les dépenses par
# « created_at », colonne inexistante sur depenses_plateforme
# (« cree_le ») -> PostgREST 42703 -> page en erreur en production.
# Couvre aussi l'émission réelle (instantané) et le talon (données
# d'entrée de la génération capturées, accès employé limité).
echo ""
echo "===== Finances — fournisseur réel contraint au schéma live ====="
if node "scripts/test-finances-reel.cjs"; then
  echo "Finances (fournisseur réel) : OK"
else
  echo "Finances (fournisseur réel) : ÉCHEC" >&2
  ECHEC=1
fi

# Passe corrective « captures du fondateur » (2026-11-08, 8 points) :
# (1) carte Vitrine en colonne sur mobile ; (2) en-tête public sans
# débordement ; (3) audit — inventaire COMPLET des actions avec
# libellés FR/EN, repli générique, cible lisible (jamais un UUID),
# détails de dépense au montant formaté ; (4) finances — lignes
# Destination qui se replient, montants sur une ligne ; (5) « Ma
# paie » — référence numérique groupée par milliers ; (6) contrats
# PDF aux DEUX logos (génération réelle, images vérifiées dans le
# PDF, repli texte) ; (7) dépôt du contrat employé signé — causes
# racines : bouton mort sur iPhone (clic scripté sur input
# display:none, ignoré par iOS -> label natif) + le HEIC iPhone
# refusé partout alors que le bucket n'impose aucun type (flux
# démo runtime + politiques statiques) ; (8) périmètre PAIES de
# la vue Finances : un Admin ne voit que SA paie (lignes,
# historique, totaux), talon d'un autre refusé, Super voit tout
# (démo ici, réel contraint dans test-finances-reel.cjs).
echo ""
echo "===== Passe corrective captures (points 1-10, 2026-11-08) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-correctifs-captures.cjs"; then
  echo "Passe corrective captures : OK"
else
  echo "Passe corrective captures : ÉCHEC" >&2
  ECHEC=1
fi

# Réorganisation dossiers + finances Admin (2026-11-08, modèle du
# fondateur : « sa paie et les dépenses de la plateforme, deux
# choses différentes ») : (A) vue Admin — la boîte de totaux
# DISPARAÎT (Super Admin seul), deux blocs séparés « Ma paie » /
# « Mes demandes de dépenses », fournisseurs intacts (runtime
# démo : périmètre toujours filtré) ; (B) dossiers — section
# renseignée en LECTURE SEULE, formulaire derrière « Modifier »
# (Mon dossier employé : photo, pièce, adresse, coordonnées ;
# DossierBloc client : photo, pièce) et validations prononcées
# converties en lignes de résultat (contrat employé validé ;
# « Décisions enregistrées » de la page console Dossier, alimenté
# par le journal et les documents déjà chargés) ; (C) photos
# d'immeuble : sélecteur à activation NATIVE (label htmlFor +
# useId + sr-only), le clic programmé sur input caché a disparu,
# règles photos inchangées.
echo ""
echo "===== Réorganisation dossiers + finances Admin (2026-11-08) ====="
if python3 "scripts/i18n-check.py" && python3 "scripts/i18n-cles-utilisees.py" && node "scripts/test-reorganisation-dossiers.cjs"; then
  echo "Réorganisation dossiers + finances Admin : OK"
else
  echo "Réorganisation dossiers + finances Admin : ÉCHEC" >&2
  ECHEC=1
fi

# Organisation desktop « ultra premium » (2026-11-08, fondateur,
# captures bureau) : grilles bureau lg:/xl: des pages console
# (Dossier client, Finances, Mon dossier employé, Vue d'ensemble,
# Équipe, Vérifier un employé, Messages) + conteneur 1600 px +
# bordures de cartes teintées or (Marine & Or). Test statique :
# présence des classes bureau, classes de base mobiles intactes.
echo ""
echo "===== Organisation desktop premium (2026-11-08) ====="
if python3 "scripts/i18n-check.py" && node "scripts/test-organisation-desktop.cjs"; then
  echo "Organisation desktop premium : OK"
else
  echo "Organisation desktop premium : ÉCHEC" >&2
  ECHEC=1
fi

echo ""
if [ "$ECHEC" -eq 0 ]; then
  echo "Tous les tests demandés sont passés."
else
  echo "Au moins un module a échoué (voir ci-dessus)." >&2
  exit 1
fi
