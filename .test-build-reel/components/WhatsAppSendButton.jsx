"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WhatsAppSendButton;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
/**
 * Bouton « Envoyer par WhatsApp (API) » — Module 6, spec §10.
 *
 * Appelle la route serveur POST /api/whatsapp/envoyer (le token Meta ne
 * quitte jamais le serveur) et affiche le statut de l'envoi :
 * envoyé / échec / non configuré. Un échec est signalé sans bloquer
 * les autres canaux (le lien wa.me manuel reste disponible à côté).
 * Si WhatsApp n'est pas configuré, le statut est « non configuré » —
 * on ne simule JAMAIS un envoi.
 */
function WhatsAppSendButton({ to, message, label, disabled, onResult, }) {
    const t = (0, next_intl_1.useTranslations)("whatsapp");
    const [envoi, setEnvoi] = (0, react_1.useState)(false);
    const [statut, setStatut] = (0, react_1.useState)(null);
    async function envoyer() {
        if (!to || envoi)
            return;
        setEnvoi(true);
        setStatut(null);
        try {
            const reponse = await fetch("/api/whatsapp/envoyer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to, message }),
            });
            const corps = (await reponse.json());
            const nouveau = corps.raison === "ok"
                ? "envoye"
                : corps.raison === "non_configuré"
                    ? "non_configuré"
                    : "echec";
            setStatut(nouveau);
            onResult?.(nouveau);
        }
        catch {
            setStatut("echec");
            onResult?.("echec");
        }
        finally {
            setEnvoi(false);
        }
    }
    if (!to) {
        return <span className="text-sm text-slate-400">{t("noPhone")}</span>;
    }
    return (<span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={envoyer} disabled={disabled || envoi} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50">
        {envoi ? t("sending") : label}
      </button>
      {statut === "envoye" ? (<span role="status" className="text-sm font-semibold text-green-700">{t("sent")}</span>) : null}
      {statut === "echec" ? (<span role="alert" className="text-sm font-semibold text-red-700">{t("failed")}</span>) : null}
      {statut === "non_configuré" ? (<span role="status" className="text-sm font-semibold text-amber-700">{t("notConfigured")}</span>) : null}
    </span>);
}
