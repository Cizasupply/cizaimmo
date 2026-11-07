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
  lib/grille.ts lib/tarifs.ts lib/avis.ts lib/contrat.ts lib/cachet.ts \
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

echo ""
if [ "$ECHEC" -eq 0 ]; then
  echo "Tous les tests demandés sont passés."
else
  echo "Au moins un module a échoué (voir ci-dessus)." >&2
  exit 1
fi
