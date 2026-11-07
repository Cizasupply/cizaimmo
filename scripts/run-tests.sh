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
  lib/grille.ts lib/tarifs.ts lib/avis.ts \
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

echo ""
if [ "$ECHEC" -eq 0 ]; then
  echo "Tous les tests demandés sont passés."
else
  echo "Au moins un module a échoué (voir ci-dessus)." >&2
  exit 1
fi
