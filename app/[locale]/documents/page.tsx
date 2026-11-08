"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DocumentList from "@/components/DocumentList";
import DocumentUpload, { fichierValide } from "@/components/DocumentUpload";
import EmptyState from "@/components/EmptyState";
import Field from "@/components/Field";
import Pagination from "@/components/Pagination";
import { getDataProvider } from "@/lib/data";
import type {
  Appartement,
  Document,
  EntiteType,
  Immeuble,
  Locataire,
  TypeDocument,
} from "@/lib/data";
import { TYPES_DOCUMENT } from "@/lib/data";
import { messageErreur } from "@/lib/translateError";

async function fichierVersDataUrl(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(new Error("lecture"));
    lecteur.readAsDataURL(fichier);
  });
}

export default function DocumentsPage() {
  const t = useTranslations("crud");
  const td = useTranslations("documents");
  const tp = useTranslations("pages");
  const tc = useTranslations("crud.common");
  const locale = useLocale();
  const router = useRouter();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [typeFiltre, setTypeFiltre] = useState("");
  const [entiteType, setEntiteType] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [aAjouter, setAAjouter] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [typeDoc, setTypeDoc] = useState<TypeDocument>("autre");
  const [entiteTypeForm, setEntiteTypeForm] = useState<EntiteType>("immeuble");
  const [entiteId, setEntiteId] = useState("");
  const [erreurForm, setErreurForm] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      const [docs, ims, apts, locs] = await Promise.all([
        p.listerDocuments(),
        p.listerImmeubles(true),
        p.listerAppartements({ inclureArchives: true }),
        p.listerLocataires(),
      ]);
      setDocuments(docs);
      setImmeubles(ims);
      setAppartements(apts);
      setLocataires(locs);
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomEntite = (d: Document): string => {
    switch (d.entite_type) {
      case "immeuble":
        return immeubles.find((i) => i.id === d.entite_id)?.nom ?? "—";
      case "appartement": {
        const a = appartements.find((x) => x.id === d.entite_id);
        return a ? `${a.numero} — ${immeubles.find((i) => i.id === a.immeuble_id)?.nom ?? ""}` : "—";
      }
      case "locataire":
        return locataires.find((l) => l.id === d.entite_id)?.nom ?? "—";
      default:
        return d.entite_id.slice(0, 8);
    }
  };

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return documents
      .filter((d) => !typeFiltre || d.type === typeFiltre)
      .filter((d) => !entiteType || d.entite_type === entiteType)
      .filter((d) => !q || d.nom_fichier.toLowerCase().includes(q));
  }, [documents, recherche, typeFiltre, entiteType]);

  const pageDocs = useMemo(
    () => filtres.slice((page - 1) * pageSize, page * pageSize),
    [filtres, page, pageSize]
  );

  const entitesForm: { id: string; label: string }[] =
    entiteTypeForm === "immeuble"
      ? immeubles.map((i) => ({ id: i.id, label: i.nom }))
      : entiteTypeForm === "appartement"
        ? appartements.map((a) => ({ id: a.id, label: `${a.numero} — ${immeubles.find((i) => i.id === a.immeuble_id)?.nom ?? ""}` }))
        : entiteTypeForm === "locataire"
          ? locataires.map((l) => ({ id: l.id, label: l.nom }))
          : [];

  async function handleTeleverser(e: React.FormEvent) {
    e.preventDefault();
    setErreurForm(null);
    if (!fichier) {
      setErreurForm(td("errorNoFile"));
      return;
    }
    if (fichierValide(fichier)) {
      setErreurForm(td("errorFormat"));
      return;
    }
    if (!entiteId) {
      setErreurForm(td("errorNoEntity"));
      return;
    }
    setEnvoi(true);
    try {
      const p = getDataProvider();
      const contenu = await fichierVersDataUrl(fichier);
      const doc = await p.televerserDocument({
        type: typeDoc,
        entite_type: entiteTypeForm,
        entite_id: entiteId,
        nom_fichier: fichier.name,
        contenu,
        taille_octets: fichier.size,
        mime_type: fichier.type,
      });
      setAAjouter(false);
      setFichier(null);
      setEntiteId("");
      setMessage(
        doc.contenu_non_conserve ? td("uploadedButNotKept") : tc("created")
      );
      await charger();
    } catch (err) {
      setErreurForm(messageErreur(t as unknown as (k: string) => string, err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <AppShell title={tp("documents.title")}>
      {message ? (
        <p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          {message}
        </p>
      ) : null}
      {erreur ? (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erreur}
          <button type="button" onClick={charger} className="ml-3 font-bold underline">
            {tc("retry")}
          </button>
        </div>
      ) : null}

      {chargement ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
          <p className="text-sm text-slate-500">{tc("loading")}</p>
        </div>
      ) : documents.length === 0 && !aAjouter ? (
        <EmptyState
          title={td("emptyTitle")}
          text={td("emptyText")}
          actionLabel={td("upload")}
          onAction={() => setAAjouter(true)}
        />
      ) : (
        <>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setAAjouter((v) => !v)}
              className="rounded-full border border-navy bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-navy/5"
            >
              {td("upload")}
            </button>
          </div>

          {aAjouter ? (
            <form onSubmit={handleTeleverser} noValidate className="mb-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <DocumentUpload fichier={fichier} onFichierChange={setFichier} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="doc-type" label={td("type")} value={typeDoc} onChange={(v) => setTypeDoc(v as TypeDocument)}>
                  {TYPES_DOCUMENT.map((ty) => (
                    <option key={ty} value={ty}>{td(`types.${ty}`)}</option>
                  ))}
                </Field>
                <Field id="doc-entite-type" label={td("linkedTo")} value={entiteTypeForm} onChange={(v) => { setEntiteTypeForm(v as EntiteType); setEntiteId(""); }}>
                  <option value="immeuble">{td("entityBuilding")}</option>
                  <option value="appartement">{td("entityApartment")}</option>
                  <option value="locataire">{td("entityTenant")}</option>
                </Field>
              </div>
              <Field id="doc-entite" label={td("entity")} value={entiteId} onChange={setEntiteId}>
                <option value="">{td("chooseEntity")}</option>
                {entitesForm.map((en) => (
                  <option key={en.id} value={en.id}>{en.label}</option>
                ))}
              </Field>
              {erreurForm ? (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erreurForm}</p>
              ) : null}
              <button
                type="submit"
                disabled={envoi}
                className="w-full rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light disabled:opacity-50 sm:w-auto"
              >
                {envoi ? tc("saving") : td("uploadButton")}
              </button>
            </form>
          ) : null}

          <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
            <label className="block text-sm font-semibold text-slate-900">
              {tc("search")}
              <input
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
                placeholder={td("searchPlaceholder")}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-normal outline-none focus:border-gold"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              {td("type")}
              <select
                value={typeFiltre}
                onChange={(e) => { setTypeFiltre(e.target.value); setPage(1); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-gold"
              >
                <option value="">{tc("all")}</option>
                {TYPES_DOCUMENT.map((ty) => (
                  <option key={ty} value={ty}>{td(`types.${ty}`)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              {td("linkedTo")}
              <select
                value={entiteType}
                onChange={(e) => { setEntiteType(e.target.value); setPage(1); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-gold"
              >
                <option value="">{tc("all")}</option>
                <option value="immeuble">{td("entityBuilding")}</option>
                <option value="appartement">{td("entityApartment")}</option>
                <option value="locataire">{td("entityTenant")}</option>
                <option value="bail">{td("entityLease")}</option>
                <option value="depense">{td("entityExpense")}</option>
              </select>
            </label>
          </div>

          {filtres.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">{tc("noResults")}</p>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <DocumentList documents={pageDocs} onChange={charger} showEntity nomEntite={nomEntite} />
              <Pagination
                page={page}
                pageSize={pageSize}
                total={filtres.length}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                perPageLabel={tc("perPage")}
                showingLabel={(from, to, total) => tc("showing", { from, to, total })}
              />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
