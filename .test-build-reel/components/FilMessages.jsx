"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.erreurV15 = erreurV15;
exports.default = FilMessages;
/**
 * Fil de messages directs (v1.5) — composant PARTAGÉ : page client
 * « Messages », section Messages du Dossier console, discussions de
 * rattachement et supervision (lecture seule).
 *
 * À l'ouverture : charge les messages puis marque le fil comme lu
 * pour le côté de l'acteur courant (marquerLu). En mode lecture
 * seule (supervision plateforme d'un fil rattachement), aucune zone
 * de saisie n'est rendue — l'interdiction d'écrire vient de la base.
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
const format_1 = require("@/lib/format");
function erreurV15(t, e) {
    const code = e instanceof Error ? e.message : "";
    if (code.startsWith("ERR_")) {
        try {
            return t(`errors.${code}`);
        }
        catch {
            return t("errors.generic");
        }
    }
    return t("errors.generic");
}
function FilMessages({ conversationId, lectureSeule = false, marquerLuAuto = true, }) {
    const t = (0, next_intl_1.useTranslations)("v15");
    const locale = (0, next_intl_1.useLocale)();
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [monId, setMonId] = (0, react_1.useState)(null);
    const [saisie, setSaisie] = (0, react_1.useState)("");
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [envoi, setEnvoi] = (0, react_1.useState)(false);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const basRef = (0, react_1.useRef)(null);
    const charger = (0, react_1.useCallback)(async () => {
        const provider = (0, data_1.getDataProvider)();
        const [liste, profil] = await Promise.all([
            provider.listerMessages(conversationId),
            provider.getProfil(),
        ]);
        setMessages(liste);
        setMonId(profil?.id ?? null);
        if (marquerLuAuto) {
            await provider.marquerLu(conversationId).catch(() => undefined);
        }
    }, [conversationId, marquerLuAuto]);
    (0, react_1.useEffect)(() => {
        setChargement(true);
        charger()
            .catch((e) => setErreur(erreurV15(t, e)))
            .finally(() => setChargement(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [charger]);
    (0, react_1.useEffect)(() => {
        basRef.current?.scrollIntoView({ block: "nearest" });
    }, [messages]);
    async function envoyer() {
        const corps = saisie.trim();
        if (!corps || envoi)
            return;
        setEnvoi(true);
        setErreur(null);
        try {
            await (0, data_1.getDataProvider)().envoyerMessage(conversationId, corps);
            setSaisie("");
            await charger();
        }
        catch (e) {
            setErreur(erreurV15(t, e));
        }
        finally {
            setEnvoi(false);
        }
    }
    if (chargement) {
        return <p className="text-sm text-slate-500">{t("noMessages")}</p>;
    }
    return (<div>
      {lectureSeule ? (<p className="mb-3 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          🔒 {t("supervisionReadOnly")} — {t("supervisionBanner")}
        </p>) : null}
      {messages.length === 0 ? (<p className="text-sm text-slate-500">{t("noMessages")}</p>) : (<ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {messages.map((m) => {
                const mien = monId !== null && m.expediteur_id === monId;
                return (<li key={m.id} className={`flex ${mien ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mien
                        ? "bg-navy text-white"
                        : "bg-slate-100 text-slate-800"}`}>
                  <p className={`text-xs font-bold ${mien ? "text-gold" : "text-navy"}`}>
                    {mien ? t("you") : (m.expediteur_nom ?? t("platformName"))}
                    {" · "}
                    <span className="font-normal opacity-70">
                      {(0, format_1.formatDate)(m.created_at, locale)}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{m.corps}</p>
                </div>
              </li>);
            })}
        </ul>)}
      <div ref={basRef}/>
      {erreur ? (<p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>) : null}
      {!lectureSeule ? (<form className="mt-4 flex gap-2" onSubmit={(e) => {
                e.preventDefault();
                void envoyer();
            }}>
          <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={t("placeholder")} aria-label={t("placeholder")} className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-gold"/>
          <button type="submit" disabled={envoi || !saisie.trim()} className="shrink-0 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
            {envoi ? t("sending") : t("send")}
          </button>
        </form>) : null}
    </div>);
}
