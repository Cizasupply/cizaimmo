"use strict";
/**
 * CizaImmo — WhatsApp via l'API officielle Meta « WhatsApp Business
 * Platform » (Module 6, spec §10).
 *
 * SERVEUR UNIQUEMENT : ce module lit les variables d'environnement
 * WHATSAPP_API_TOKEN et WHATSAPP_PHONE_NUMBER_ID et ne doit JAMAIS être
 * importé par un composant client (le token ne doit jamais atteindre
 * le navigateur). Les routes API (app/api/whatsapp/…) sont le seul
 * point d'entrée.
 *
 * RÈGLE ABSOLUE : si WhatsApp n'est pas configuré, la fonction retourne
 * { envoye: false, raison: "non_configuré" } — on ne simule JAMAIS un
 * envoi. Un échec réel est signalé (raison "echec", détail HTTP) sans
 * bloquer les autres canaux : l'appelant affiche le statut et continue.
 *
 * Envois uniquement vers des numéros valides (10 à 15 chiffres) ayant
 * accepté ce canal ; le message ne porte jamais de donnée d'un autre
 * bien ni d'un autre locataire — c'est la responsabilité de l'appelant
 * de ne composer que le message du destinataire concerné.
 *
 * Configuration : voir docs/whatsapp-setup.md — notamment le point
 * ouvert sur le numéro +1 514 502 9503 (manuel dans l'appli WhatsApp
 * Business : un numéro ne peut pas être à la fois dans l'appli et
 * dans l'API).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappConfigure = whatsappConfigure;
exports.normaliserNumeroWhatsApp = normaliserNumeroWhatsApp;
exports.envoyerWhatsApp = envoyerWhatsApp;
exports.statutDepuisResultat = statutDepuisResultat;
const helpers_1 = require("./data/helpers");
/** Vrai si l'API WhatsApp est configurée (token + phone_number_id). */
function whatsappConfigure() {
    return Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}
/** Numéro normalisé pour l'API Meta : chiffres seuls, sans « + ». */
function normaliserNumeroWhatsApp(telephone) {
    return telephone.replace(/[\s\-().]/g, "").replace(/^\+/, "");
}
/**
 * Envoie un message WhatsApp via l'API officielle Meta.
 * Côté serveur uniquement (fetch Node). Sans configuration, retourne
 * immédiatement « non_configuré » sans rien envoyer.
 */
async function envoyerWhatsApp(message) {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
        return { envoye: false, raison: "non_configuré" };
    }
    if (!(0, helpers_1.telephoneValide)(message.destinataire)) {
        return { envoye: false, raison: "numero_invalide" };
    }
    const vers = normaliserNumeroWhatsApp(message.destinataire);
    try {
        const reponse = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: vers,
                type: "text",
                text: { preview_url: false, body: message.texte },
            }),
        });
        if (!reponse.ok) {
            let detail = `HTTP ${reponse.status}`;
            try {
                const corps = (await reponse.json());
                if (corps.error?.message)
                    detail = `${detail} — ${corps.error.message}`;
            }
            catch {
                // Corps non JSON : on garde le statut HTTP.
            }
            return { envoye: false, raison: "echec", detail };
        }
        const corps = (await reponse.json());
        return {
            envoye: true,
            raison: "ok",
            message_id: corps.messages?.[0]?.id,
        };
    }
    catch (e) {
        return {
            envoye: false,
            raison: "echec",
            detail: e instanceof Error ? e.message : "erreur réseau",
        };
    }
}
/** Convertit le résultat d'un envoi en statut stockable sur une alerte. */
function statutDepuisResultat(resultat) {
    if (resultat.raison === "ok")
        return "envoye";
    if (resultat.raison === "non_configuré")
        return "non_configuré";
    return "echec";
}
