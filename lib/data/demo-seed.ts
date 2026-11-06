import type {
  Abonnement,
  Activite,
  Alerte,
  Appartement,
  Bail,
  Coproprietaire,
  Depense,
  Document,
  EcheanceLoyer,
  FactureAbonnement,
  GestionnaireInvite,
  Immeuble,
  Locataire,
  Paiement,
  PaiementMobileMoney,
  PreferencesNotifications,
  Profil,
  TauxChange,
} from "./types";

/**
 * CizaImmo — données de DÉMONSTRATION (Module 1).
 *
 * DONNÉES FICTIVES, étiquetées DÉMO partout dans l'interface. Elles ne
 * doivent JAMAIS être présentées comme réelles. Le mode démo permet de
 * parcourir l'application avant la création du projet Supabase.
 *
 * Parc de démo : 1 propriétaire, 3 immeubles (Bujumbura en BIF, Montréal
 * en CAD, 1 archivé), 7 appartements (dont 1 vacant depuis sept. 2026),
 * 5 locataires, 5 baux, échéances d'octobre et novembre 2026, paiements
 * déclarés et dépenses.
 *
 * Les montants sont fictifs mais réalistes et cohérents entre eux
 * (loyers = montants dus des échéances ; paiements ≤ montants dus).
 * Les échéances couvrent les 5 statuts (spec §9) : à venir, dû, partiel,
 * payé, en retard — dont un paiement annulé (reçu conservé, marqué ANNULÉ).
 */

export interface DemoDb {
  profil: Profil;
  abonnement: Abonnement;
  immeubles: Immeuble[];
  appartements: Appartement[];
  locataires: Locataire[];
  baux: Bail[];
  echeances: EcheanceLoyer[];
  paiements: Paiement[];
  depenses: Depense[];
  documents: Document[];
  alertes: Alerte[];
  activites: Activite[];
  taux: TauxChange[];
  gestionnaires: GestionnaireInvite[];
  preferences: PreferencesNotifications;
  /** Module 5 : factures d'abonnement + paiements mobile money. */
  factures: FactureAbonnement[];
  paiementsMobileMoney: PaiementMobileMoney[];
  /** Module 6 : indivision familiale (parts en %, somme = 100 %). */
  coproprietaires: Coproprietaire[];
}

const OWNER_ID = "00000000-0000-4000-8000-000000000001";

export function buildDemoDb(): DemoDb {
  const now = new Date().toISOString();
  const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const profil: Profil = {
    id: OWNER_ID,
    nom: "Démo — Amina Niyonzima",
    email: "demo@cizaimmo.com",
    pays: "Burundi",
    langue: "fr",
    devise_principale: "BIF",
    role: "proprietaire",
    telephone: "+257 79 00 00 01",
    created_at: now,
  };

  const abonnement: Abonnement = {
    id: "00000000-0000-4000-8000-000000000101",
    owner_id: OWNER_ID,
    plan: "pro",
    grille: "afrique",
    statut: "essai",
    debut_periode: now,
    fin_periode: trialEnds,
    trial_ends_at: trialEnds,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    mobile_money_ref: null,
    created_at: now,
    plan_en_attente: null,
    date_effet_plan: null,
    resiliation_programmee: false,
    echec_paiement: false,
    grace_ends_at: null,
    lecture_seule_jusqu_au: null,
  };

  const immeubles: Immeuble[] = [
    {
      id: "00000000-0000-4000-8000-000000000201",
      owner_id: OWNER_ID,
      nom: "Immeuble Buhomba",
      adresse: "6ème Avenue N° 47, Quartier Buhomba",
      ville: "Bujumbura",
      pays: "Burundi",
      devise: "BIF",
      type: "immeuble",
      etages: 3,
      photo_url: null,
      notes: "Immeuble de démonstration — données fictives.",
      valeur_bien: 180000000,
      devise_valeur: "BIF",
      date_acquisition: "2022-03-15",
      prix_acquisition: 150000000,
      date_estimation: "2026-10-01",
      mode_acquisition: "achat",
      statut: "actif",
      created_at: now,
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      owner_id: OWNER_ID,
      nom: "Bloc Saint-Laurent",
      adresse: "4820 boul. Saint-Laurent",
      ville: "Montréal",
      pays: "Canada",
      devise: "CAD",
      type: "bloc",
      etages: 2,
      photo_url: null,
      notes: "Bloc de démonstration — données fictives.",
      valeur_bien: 850000,
      devise_valeur: "CAD",
      date_acquisition: "2021-06-01",
      prix_acquisition: 790000,
      date_estimation: null,
      mode_acquisition: "achat",
      statut: "actif",
      created_at: now,
    },
    {
      id: "00000000-0000-4000-8000-000000000203",
      owner_id: OWNER_ID,
      nom: "Maison Kigobe",
      adresse: "Avenue Kigobe N° 12",
      ville: "Bujumbura",
      pays: "Burundi",
      devise: "BIF",
      type: "maison",
      etages: 1,
      photo_url: null,
      notes: "Maison archivée — exemple d'historique consultable.",
      valeur_bien: 95000000,
      devise_valeur: "BIF",
      date_acquisition: "2019-05-20",
      prix_acquisition: 80000000,
      date_estimation: null,
      mode_acquisition: "heritage",
      statut: "archive",
      created_at: now,
    },
  ];

  const appartements: Appartement[] = [
    { id: "00000000-0000-4000-8000-000000000301", immeuble_id: immeubles[0].id, numero: "A1", type: "T2", surface_m2: 58, loyer_defaut: 450000, devise: "BIF", charges: 50000, etage: 0, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000302", immeuble_id: immeubles[0].id, numero: "A2", type: "T3", surface_m2: 82, loyer_defaut: 650000, devise: "BIF", charges: 50000, etage: 1, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000303", immeuble_id: immeubles[0].id, numero: "A3", type: "studio", surface_m2: 32, loyer_defaut: 280000, devise: "BIF", charges: 30000, etage: 2, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000304", immeuble_id: immeubles[1].id, numero: "101", type: "T2", surface_m2: 64, loyer_defaut: 1250, devise: "CAD", charges: 0, etage: 1, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000305", immeuble_id: immeubles[1].id, numero: "102", type: "T1", surface_m2: 45, loyer_defaut: 980, devise: "CAD", charges: 0, etage: 1, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000306", immeuble_id: immeubles[2].id, numero: "RDC", type: "T3", surface_m2: 75, loyer_defaut: 500000, devise: "BIF", charges: 0, etage: 0, description: null, photos: [], statut: "vacant", vitrine: false, archive: true, valeur_bien: null, devise_valeur: null, created_at: now },
    // Vacant depuis le 20 sept. 2026 : vacance prolongée (> 30 jours) au 6 nov.
    { id: "00000000-0000-4000-8000-000000000307", immeuble_id: immeubles[0].id, numero: "A4", type: "T1", surface_m2: 41, loyer_defaut: 350000, devise: "BIF", charges: 30000, etage: 2, description: null, photos: [], statut: "vacant", vitrine: true, archive: false, valeur_bien: null, devise_valeur: null, created_at: "2026-09-20T00:00:00.000Z" },
  ];

  const locataires: Locataire[] = [
    { id: "00000000-0000-4000-8000-000000000401", owner_id: OWNER_ID, nom: "Jean-Claude Hakizimana", telephone: "+25779123456", email: "jc.hakizimana@exemple.bi", piece_type: "cni", piece_numero: "1234567890123", adresse_precedente: "Rohero, Bujumbura", contact_urgence: "+25779998877", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000402", owner_id: OWNER_ID, nom: "Sandrine Nkurunziza", telephone: "+25779555666", email: "s.nkurunziza@exemple.bi", piece_type: "cni", piece_numero: "1234567890456", adresse_precedente: "Kinindo, Bujumbura", contact_urgence: "+25779444333", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000403", owner_id: OWNER_ID, nom: "Marie Tremblay", telephone: "+15145550101", email: "marie.tremblay@exemple.ca", piece_type: "passeport", piece_numero: "CA1234567", adresse_precedente: "Montréal, QC", contact_urgence: "+15145550102", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000404", owner_id: OWNER_ID, nom: "Éric Ndayishimiye", telephone: "+25779666777", email: null, piece_type: "cni", piece_numero: "1234567890789", adresse_precedente: "Mutanga, Bujumbura", contact_urgence: "+25779333222", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000405", owner_id: OWNER_ID, nom: "Sophie Gagnon", telephone: "+15145550103", email: "sophie.gagnon@exemple.ca", piece_type: "passeport", piece_numero: "CA7654321", adresse_precedente: "Laval, QC", contact_urgence: "+15145550104", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
  ];

  const baux: Bail[] = [
    { id: "00000000-0000-4000-8000-000000000501", appartement_id: appartements[0].id, locataire_id: locataires[0].id, debut: "2026-01-01", fin: "2026-12-31", loyer_mensuel: 450000, devise: "BIF", caution: 450000, devise_caution: "BIF", caution_recue_le: "2025-12-28", caution_statut: "recue", jour_exigibilite: 5, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000502", appartement_id: appartements[1].id, locataire_id: locataires[1].id, debut: "2026-03-01", fin: "2027-02-28", loyer_mensuel: 650000, devise: "BIF", caution: 650000, devise_caution: "BIF", caution_recue_le: "2026-02-25", caution_statut: "recue", jour_exigibilite: 5, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000503", appartement_id: appartements[3].id, locataire_id: locataires[2].id, debut: "2026-09-01", fin: "2027-08-31", loyer_mensuel: 1250, devise: "CAD", caution: 1250, devise_caution: "CAD", caution_recue_le: "2026-08-28", caution_statut: "recue", jour_exigibilite: 1, charges_incluses: true, statut: "actif", doc_url: null, created_at: now },
    // Entrée en cours de mois (15 oct.) : premier mois au prorata (17/31 jours).
    { id: "00000000-0000-4000-8000-000000000504", appartement_id: appartements[2].id, locataire_id: locataires[3].id, debut: "2026-10-15", fin: "2027-10-14", loyer_mensuel: 280000, devise: "BIF", caution: 280000, devise_caution: "BIF", caution_recue_le: "2026-10-14", caution_statut: "recue", jour_exigibilite: 20, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
    // Bail démarrant le 1er nov., jour d'exigibilité 3 : échéance « due » début nov.
    { id: "00000000-0000-4000-8000-000000000505", appartement_id: appartements[4].id, locataire_id: locataires[4].id, debut: "2026-11-01", fin: "2027-10-31", loyer_mensuel: 980, devise: "CAD", caution: 980, devise_caution: "CAD", caution_recue_le: "2026-10-30", caution_statut: "recue", jour_exigibilite: 3, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
  ];

  // Échéances d'octobre et novembre 2026 (mois = 1er du mois).
  // Statuts stockés = ceux calculés au 6 nov. 2026 ; la lecture recalcule toujours.
  const echeances: EcheanceLoyer[] = [
    // Octobre 2026
    { id: "00000000-0000-4000-8000-000000000611", bail_id: baux[0].id, mois: "2026-10-01", montant_du: 450000, devise: "BIF", statut: "paye", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000612", bail_id: baux[1].id, mois: "2026-10-01", montant_du: 650000, devise: "BIF", statut: "en_retard", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000613", bail_id: baux[2].id, mois: "2026-10-01", montant_du: 1250, devise: "CAD", statut: "paye", prorata: false, prorata_detail: null, created_at: now },
    // Prorata : 280 000 × 17/31 = 153 548 BIF (entrée le 15 oct., 17 jours sur 31).
    { id: "00000000-0000-4000-8000-000000000614", bail_id: baux[3].id, mois: "2026-10-01", montant_du: 153548, devise: "BIF", statut: "en_retard", prorata: true, prorata_detail: "17/31", created_at: now },
    // Novembre 2026
    { id: "00000000-0000-4000-8000-000000000601", bail_id: baux[0].id, mois: "2026-11-01", montant_du: 450000, devise: "BIF", statut: "paye", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000602", bail_id: baux[1].id, mois: "2026-11-01", montant_du: 650000, devise: "BIF", statut: "partiel", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000603", bail_id: baux[2].id, mois: "2026-11-01", montant_du: 1250, devise: "CAD", statut: "paye", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000604", bail_id: baux[3].id, mois: "2026-11-01", montant_du: 280000, devise: "BIF", statut: "a_venir", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000605", bail_id: baux[4].id, mois: "2026-11-01", montant_du: 980, devise: "CAD", statut: "du", prorata: false, prorata_detail: null, created_at: now },
  ];

  const paiements: Paiement[] = [
    // Octobre 2026
    { id: "00000000-0000-4000-8000-000000000711", echeance_id: echeances[2].id, montant: 1250, devise: "CAD", date_paiement: "2026-10-01", moyen: "virement", reference: "Virement démo", declare_par: OWNER_ID, recu_numero: "CIM-2026-000001", statut: "valide", created_at: now },
    { id: "00000000-0000-4000-8000-000000000712", echeance_id: echeances[0].id, montant: 450000, devise: "BIF", date_paiement: "2026-10-04", moyen: "mobile_money", reference: "EcoCash démo", declare_par: OWNER_ID, recu_numero: "CIM-2026-000002", statut: "valide", created_at: now },
    // Déclaration annulée (erreur de montant) : le reçu reste visible, marqué ANNULÉ.
    { id: "00000000-0000-4000-8000-000000000713", echeance_id: echeances[1].id, montant: 200000, devise: "BIF", date_paiement: "2026-10-06", moyen: "especes", reference: null, declare_par: OWNER_ID, recu_numero: "CIM-2026-000003", statut: "annule", annule_par: OWNER_ID, annule_le: "2026-10-07T09:00:00.000Z", motif_annulation: "Erreur de montant déclaré", created_at: now },
    // Novembre 2026
    { id: "00000000-0000-4000-8000-000000000703", echeance_id: echeances[6].id, montant: 1250, devise: "CAD", date_paiement: "2026-11-01", moyen: "virement", reference: "Virement démo", declare_par: OWNER_ID, recu_numero: "CIM-2026-000004", statut: "valide", created_at: now },
    { id: "00000000-0000-4000-8000-000000000701", echeance_id: echeances[4].id, montant: 450000, devise: "BIF", date_paiement: "2026-11-04", moyen: "mobile_money", reference: "EcoCash démo", declare_par: OWNER_ID, recu_numero: "CIM-2026-000005", statut: "valide", created_at: now },
    { id: "00000000-0000-4000-8000-000000000702", echeance_id: echeances[5].id, montant: 400000, devise: "BIF", date_paiement: "2026-11-05", moyen: "especes", reference: null, declare_par: OWNER_ID, recu_numero: "CIM-2026-000006", statut: "valide", created_at: now },
  ];

  const depenses: Depense[] = [
    { id: "00000000-0000-4000-8000-000000000801", owner_id: OWNER_ID, immeuble_id: immeubles[0].id, appartement_id: null, date: "2026-11-02", categorie: "reparation", libelle: "Réparation plomberie — A2", montant: 120000, devise: "BIF", fournisseur: "Plombier démo", justificatif_url: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000802", owner_id: OWNER_ID, immeuble_id: immeubles[1].id, appartement_id: appartements[3].id, date: "2026-10-28", categorie: "entretien", libelle: "Nettoyage commun — Bloc Saint-Laurent", montant: 85, devise: "CAD", fournisseur: "Nettoyage démo", justificatif_url: null, created_at: now },
  ];

  // Taux de change datés (spec §9) : jamais présentés comme « taux du jour ».
  // Source « auto » = taux stockés ; un taux manuel de secours peut primer.
  const taux: TauxChange[] = [
    { id: "00000000-0000-4000-8000-000000000901", devise_source: "USD", devise_cible: "BIF", taux: 2900, date_taux: "2026-11-05", source: "auto", created_at: now },
    { id: "00000000-0000-4000-8000-000000000902", devise_source: "EUR", devise_cible: "BIF", taux: 3350, date_taux: "2026-11-05", source: "auto", created_at: now },
    { id: "00000000-0000-4000-8000-000000000903", devise_source: "CAD", devise_cible: "BIF", taux: 2080, date_taux: "2026-11-05", source: "auto", created_at: now },
    { id: "00000000-0000-4000-8000-000000000904", devise_source: "USD", devise_cible: "CAD", taux: 1.39, date_taux: "2026-11-05", source: "auto", created_at: now },
    { id: "00000000-0000-4000-8000-000000000905", devise_source: "USD", devise_cible: "EUR", taux: 0.86, date_taux: "2026-11-05", source: "auto", created_at: now },
  ];

  const documents: Document[] = [
    {
      id: "00000000-0000-4000-8000-000000000a01",
      owner_id: OWNER_ID,
      type: "bail",
      entite_type: "bail",
      entite_id: baux[0].id,
      nom_fichier: "bail-signe-hakizimana-a1.pdf",
      storage_path: "demo:00000000-0000-4000-8000-000000000a01",
      taille_octets: 184320,
      mime_type: "application/pdf",
      ajoute_par: OWNER_ID,
      created_at: "2026-01-02T09:00:00.000Z",
      contenu: null,
      contenu_non_conserve: true,
    },
  ];

  // Fil d'actualité de départ : il se nourrit des événements déjà enregistrés.
  const activites: Activite[] = [
    { id: "00000000-0000-4000-8000-000000000b01", owner_id: OWNER_ID, type: "paiement", entite_type: "loyer", entite_id: echeances[4].id, auteur: OWNER_ID, description: "Paiement déclaré : 450 000 BIF — Jean-Claude Hakizimana (A1, nov. 2026)", created_at: "2026-11-04T10:15:00.000Z" },
    { id: "00000000-0000-4000-8000-000000000b02", owner_id: OWNER_ID, type: "paiement", entite_type: "loyer", entite_id: echeances[5].id, auteur: OWNER_ID, description: "Paiement déclaré : 400 000 BIF — Sandrine Nkurunziza (A2, nov. 2026)", created_at: "2026-11-05T16:40:00.000Z" },
    { id: "00000000-0000-4000-8000-000000000b03", owner_id: OWNER_ID, type: "depense", entite_type: "depense", entite_id: depenses[0].id, auteur: OWNER_ID, description: "Dépense ajoutée : Réparation plomberie — A2 (120 000 BIF)", created_at: "2026-11-02T11:00:00.000Z" },
    { id: "00000000-0000-4000-8000-000000000b04", owner_id: OWNER_ID, type: "bail", entite_type: "bail", entite_id: baux[4].id, auteur: OWNER_ID, description: "Bail créé : Sophie Gagnon — appartement 102 (dès le 2026-11-01)", created_at: "2026-10-30T14:20:00.000Z" },
    { id: "00000000-0000-4000-8000-000000000b05", owner_id: OWNER_ID, type: "document", entite_type: "document", entite_id: documents[0].id, auteur: OWNER_ID, description: "Document ajouté : bail-signe-hakizimana-a1.pdf (bail signé)", created_at: "2026-01-02T09:00:00.000Z" },
  ];

  const preferences: PreferencesNotifications = {
    owner_id: OWNER_ID,
    types_coupes: [],
    canal_app: true,
    canal_email: true,
    canal_whatsapp: true,
    seuil_vacance_jours: 30,
    updated_at: now,
  };

  // Indivision familiale (module 6) : Immeuble Buhomba partagé en famille,
  // 60 % / 40 % = 100 %. La diaspora (Diane, à Montréal) a un accès
  // lecture seule sur ce bien uniquement.
  const coproprietaires: Coproprietaire[] = [
    {
      id: "00000000-0000-4000-8000-000000000c01",
      immeuble_id: immeubles[0].id,
      nom: "Jean-Marie Niyonzima",
      email: "jean-marie@exemple.bi",
      telephone: "+257 79 22 22 22",
      part: 60,
      statut: "actif",
      created_at: now,
    },
    {
      id: "00000000-0000-4000-8000-000000000c02",
      immeuble_id: immeubles[0].id,
      nom: "Diane Niyonzima",
      email: "diane@exemple.ca",
      telephone: "+1 514 555 0104",
      part: 40,
      statut: "actif",
      created_at: now,
    },
  ];

  return { profil, abonnement, immeubles, appartements, locataires, baux, echeances, paiements, depenses, documents, alertes: [], activites, taux, gestionnaires: [], preferences, factures: [], paiementsMobileMoney: [], coproprietaires };
}
