// Test — Convertisseur public de la mini-grille (accueil anonyme) :
// fusion Frankfurter (prioritaire) + ER-API (repli, monnaies africaines)
// dans lib/taux.ts. Fonction PURE testée avec des réponses figées.
// Compilation préalable via scripts/run-tests.sh (TEST_BUILD_DIR).
const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m7test";

const { fusionnerTauxConvertisseur } = require(`${BUILD}/taux.js`);

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}

// Réponses figées (formes réelles des deux services, valeurs d'exemple).
// Frankfurter : date propre, EUR/GBP/CAD/BRL — AUCUNE monnaie africaine.
const FRANK = {
  date: "2026-11-06",
  rates: { EUR: 0.8957, GBP: 0.7471, CAD: 1.4066, BRL: 5.5037 },
};
// ER-API : couvre les 12 devises ; date DIFFÉRENTE (2026-11-05 UTC) pour
// prouver que chaque ligne garde la date de SA source.
const ER = {
  time_last_update_utc: "Thu, 05 Nov 2026 23:02:31 +0000",
  rates: {
    EUR: 0.91, GBP: 0.76, CAD: 1.39, BRL: 5.61,
    BIF: 2980, XAF: 605, XOF: 605, KES: 129.1, TZS: 2490, RWF: 1440, UGX: 3690,
  },
};

function ligne(lignes, devise) {
  return lignes.find((l) => l.devise_cible === devise);
}

(() => {
  console.log("== Fusion complète : Frankfurter prioritaire, ER-API en repli ==");
  const lignes = fusionnerTauxConvertisseur(FRANK, ER);
  check("11 lignes produites (toutes les devises non-USD)", lignes.length === 11, `reçu ${lignes.length}`);
  check("toutes les lignes : source USD, source « auto »", lignes.every((l) => l.devise_source === "USD" && l.source === "auto"));
  const eur = ligne(lignes, "EUR");
  check("EUR : valeur Frankfurter (0.8957)", eur && eur.taux === 0.8957, JSON.stringify(eur));
  check("EUR : date Frankfurter (2026-11-06)", eur && eur.date_taux === "2026-11-06", JSON.stringify(eur));
  check("GBP : valeur+date Frankfurter", ligne(lignes, "GBP")?.taux === 0.7471 && ligne(lignes, "GBP")?.date_taux === "2026-11-06");
  check("CAD : valeur+date Frankfurter", ligne(lignes, "CAD")?.taux === 1.4066 && ligne(lignes, "CAD")?.date_taux === "2026-11-06");
  check("BRL : valeur Frankfurter (pas celle d'ER-API)", ligne(lignes, "BRL")?.taux === 5.5037, JSON.stringify(ligne(lignes, "BRL")));

  console.log("== Repli africain : valeur + date ER-API ==");
  const xof = ligne(lignes, "XOF");
  check("XOF : valeur ER-API (605)", xof && xof.taux === 605, JSON.stringify(xof));
  check("XOF : date ER-API convertie en AAAA-MM-JJ UTC (2026-11-05)", xof && xof.date_taux === "2026-11-05", JSON.stringify(xof));
  const bif = ligne(lignes, "BIF");
  check("BIF : valeur ER-API (2980) + date ER-API", bif && bif.taux === 2980 && bif.date_taux === "2026-11-05", JSON.stringify(bif));
  check("les 7 devises africaines présentes via ER-API",
    ["BIF", "XAF", "XOF", "KES", "TZS", "RWF", "UGX"].every((d) => ligne(lignes, d)));

  console.log("== Dégradation : une seule source ==");
  const frankSeul = fusionnerTauxConvertisseur(FRANK, null);
  check("Frankfurter seul : 4 lignes (EUR, GBP, CAD, BRL)", frankSeul.length === 4, `reçu ${frankSeul.length}`);
  check("Frankfurter seul : aucune ligne XOF/BIF inventée", !ligne(frankSeul, "XOF") && !ligne(frankSeul, "BIF"));
  const erSeul = fusionnerTauxConvertisseur(null, ER);
  check("ER-API seul : 11 lignes", erSeul.length === 11, `reçu ${erSeul.length}`);
  check("ER-API seul : EUR prend valeur+date ER-API", ligne(erSeul, "EUR")?.taux === 0.91 && ligne(erSeul, "EUR")?.date_taux === "2026-11-05");

  console.log("== Aucune ligne inventée ==");
  check("deux sources absentes : 0 ligne", fusionnerTauxConvertisseur(null, null).length === 0);
  const erSansUgx = { ...ER, rates: { ...ER.rates } };
  delete erSansUgx.rates.UGX;
  const sansUgx = fusionnerTauxConvertisseur(FRANK, erSansUgx);
  check("devise absente des deux sources : pas de ligne UGX", !ligne(sansUgx, "UGX") && sansUgx.length === 10, `reçu ${sansUgx.length}`);
  const frankDateInvalide = { date: "pas-une-date", rates: { ...FRANK.rates } };
  const repli = fusionnerTauxConvertisseur(frankDateInvalide, ER);
  check("date Frankfurter invalide : repli ER-API pour EUR", ligne(repli, "EUR")?.taux === 0.91 && ligne(repli, "EUR")?.date_taux === "2026-11-05", JSON.stringify(ligne(repli, "EUR")));

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
