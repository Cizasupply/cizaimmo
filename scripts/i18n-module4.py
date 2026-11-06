#!/usr/bin/env python3
"""Ajoute les chaînes du module 4 à messages/fr.json et messages/en.json.
Vérifie ensuite que les deux fichiers ont exactement le même ensemble de clés."""
import json, sys

FR = {
 "nav": {"documents": "Documents", "alerts": "Alertes", "reports": "Rapports"},
 "pages": {
   "documents": {"title": "Documents"},
   "alerts": {"title": "Alertes"},
   "reports": {"title": "Rapports & ROI"},
 },
 "dashboard": {
   "occupancy": "Taux d'occupation", "occupiedCount": "{occupied} occupé(s) sur {total} louable(s)",
   "collectedMonth": "Loyers collectés du mois", "expectedMonth": "Attendus",
   "lateAmount": "Montant en retard", "lateCount": "{count} échéance(s) en retard",
   "vacant": "Appartements vacants", "vacantHint": "À louer ou en attente",
   "displayCurrency": "Devise d'affichage", "converterNote": "Les montants d'origine restent affichés ; les totaux convertis portent la date de leur taux.",
   "rateDate": "taux du {date}", "manualRate": "taux manuel",
   "activeAlerts": "{count} alerte(s) active(s)", "viewAlerts": "Voir les alertes",
   "quickDeclare": "Déclarer un paiement", "quickExpense": "Ajouter une dépense", "quickBuilding": "Créer un immeuble",
   "lateList": "Retards", "noLate": "Aucun retard — tout est à jour.", "remaining": "Restant", "open": "Ouvrir",
   "leasesEnding": "Fins de bail à 60 jours", "noLeaseEnding": "Aucune fin de bail dans les 60 jours.",
   "leaseEndsOn": "Fin le {date}",
   "expensesMonth": "Dépenses du mois", "noExpenseMonth": "Aucune dépense ce mois-ci.", "viewExpenses": "Voir les dépenses",
   "collectionChart": "Collecte des 6 derniers mois", "chartInCurrency": "Montants convertis en {currency} (taux datés).",
   "chartCollected": "Collecté", "chartExpected": "Attendu",
   "feedTitle": "Fil d'actualité", "feedFilterBuilding": "Immeuble", "feedEmpty": "Aucun événement pour l'instant — les événements apparaîtront ici dès qu'ils seront enregistrés.",
   "starterTitle": "Bienvenue sur CizaImmo — commençons en 3 étapes",
   "starterText": "Votre parc est vide pour l'instant. Voici le chemin le plus court vers votre premier loyer suivi.",
   "starterStep1": "Créez votre premier immeuble ou bloc, avec son adresse et sa devise.",
   "starterStep2": "Ajoutez ses appartements (un par un ou en lot) avec leur loyer.",
   "starterStep3": "Créez un locataire et son bail : les échéances se génèrent ensuite chaque mois.",
   "starterCta": "Créer mon premier immeuble",
 },
 "documents": {
   "uploadLabel": "Joindre un fichier", "uploadHint": "PDF, JPG ou PNG — 10 Mo maximum par fichier.",
   "chooseFile": "Choisir un fichier", "changeFile": "Changer de fichier", "removeFile": "Retirer",
   "errorFormat": "Format non accepté : PDF, JPG ou PNG uniquement.",
   "errorTooBig": "Fichier trop gros : 10 Mo maximum (limite : {max}).",
   "errorNoFile": "Choisissez un fichier à téléverser.", "errorNoEntity": "Choisissez l'élément auquel lier ce document.",
   "upload": "Téléverser un document", "uploadButton": "Téléverser",
   "emptyTitle": "Aucun document pour l'instant", "emptyText": "Téléversez vos baux signés, pièces d'identité, justificatifs et factures : ils restent privés, accessibles uniquement à votre compte.",
   "empty": "Aucun document pour l'instant.",
   "type": "Type", "linkedTo": "Lié à", "entity": "Élément lié", "chooseEntity": "Choisissez un élément",
   "entityBuilding": "Immeuble", "entityApartment": "Appartement", "entityTenant": "Locataire",
   "entityLease": "Bail", "entityExpense": "Dépense",
   "searchPlaceholder": "Rechercher un nom de fichier…",
   "types": {"bail": "Bail signé", "piece_identite": "Pièce d'identité", "justificatif": "Justificatif de paiement", "facture": "Facture", "autre": "Autre"},
   "download": "Télécharger", "rename": "Renommer", "renameTitle": "Renommer le document", "fileName": "Nom du fichier",
   "confirmDelete": "Supprimer « {name} » ?", "confirmDeleteText": "Le document sera définitivement supprimé.",
   "demoContentNotKept": "Contenu non conservé en démo : le fichier était trop gros pour le stockage local. Les métadonnées sont conservées.",
   "uploadedButNotKept": "Document enregistré. Contenu non conservé en démo (fichier trop gros pour le stockage local).",
 },
 "alerts": {
   "bellLabel": "Alertes : {count} active(s)",
   "types": {"loyer_en_retard": "Loyer en retard", "fin_de_bail": "Fin de bail", "vacance_prolongee": "Vacance prolongée", "bail_demarrant": "Bail démarrant", "essai_abonnement": "Essai / abonnement", "autre": "Autre"},
   "urgency": {"haute": "Urgente", "moyenne": "Moyenne", "basse": "Basse"},
   "emailStatus": "E-mail", "emailSent": "envoyé", "emailFailed": "échec d'envoi", "emailDisabled": "désactivé", "emailNotConfigured": "non configuré",
   "openItem": "Ouvrir l'élément", "markTreated": "Marquer « traitée »", "treatedDone": "Alerte traitée.",
   "treatedOn": "Traitée le {date}",
   "activeTitle": "Alertes actives ({count})", "noActive": "Aucune alerte active.",
   "treatedTitle": "Historique des alertes traitées ({count})", "noTreated": "Aucune alerte traitée pour l'instant.",
   "emptyTitle": "Aucune alerte — tout est à jour", "emptyText": "Aucun retard, aucune fin de bail proche, aucune vacance prolongée. Les alertes apparaîtront ici dès qu'un événement le justifie.",
   "goToDashboard": "Retour au tableau de bord", "manageHint": "Pour couper un type d'alerte, rendez-vous dans les", "goToSettings": "Paramètres",
 },
 "reports": {
   "periodFrom": "Du", "periodTo": "Au", "building": "Immeuble", "wholePortfolio": "Tout le parc",
   "displayCurrency": "Devise d'affichage", "income": "Revenus déclarés", "expenses": "Dépenses",
   "netResult": "Résultat net", "netMargin": "Marge nette", "valueToEnter": "valeur à renseigner", "noData": "Aucune donnée sur cette période.",
   "byBuilding": "Tableau comparatif par immeuble", "occupancy": "Occupation",
   "roiNote": "ROI = (revenus déclarés − dépenses) ÷ valeur du bien. Sans valeur du bien renseignée, le ROI affiche « valeur à renseigner » — jamais un chiffre inventé. La marge nette = (revenus − dépenses) ÷ revenus : c'est une marge, pas un ROI.",
   "byApartment": "ROI par appartement", "evolution": "Évolution mensuelle",
   "evolutionInCurrency": "Montants convertis en {currency} (taux datés).",
   "ratesUsed": "Taux de change utilisés", "noConversion": "Aucune conversion : tous les montants sont dans leur devise d'origine.",
   "rateMissing": "aucun taux disponible — montant non converti", "rateDate": "taux du {date}", "manualRate": "taux manuel",
   "exportPdf": "Exporter le rapport (PDF)", "exportExcel": "Exporter (Excel)",
 },
 "settings": {
   "profileTitle": "Profil", "name": "Nom complet", "country": "Pays", "phone": "Téléphone",
   "email": "E-mail", "emailReadOnly": "L'e-mail du compte ne se modifie pas ici.",
   "language": "Langue", "mainCurrency": "Devise principale d'affichage", "profileSaved": "Profil enregistré.",
   "ratesTitle": "Taux de change manuels", "ratesText": "Les taux automatiques sont récupérés par le système (module 6). En attendant, vous pouvez saisir un taux manuel de secours, daté : il sera signalé comme manuel partout où il sert. Un taux n'est jamais inventé.",
   "lastRate": "Dernier taux : {date} ({source})", "manual": "manuel", "auto": "automatique", "noRate": "Aucun taux enregistré pour l'instant.",
   "rateFrom": "Devise source", "rateTo": "Devise cible", "rateValue": "Taux", "rateDate": "Date du taux", "addRate": "Ajouter le taux manuel", "rateSaved": "Taux manuel enregistré.",
   "managersTitle": "Gestionnaires invités", "managersText": "Invitez un gestionnaire par e-mail et choisissez ses immeubles : il ne voit que ceux-là. Un gestionnaire retiré perd son accès immédiatement.",
   "noManager": "Aucun gestionnaire invité pour l'instant.",
   "removeManager": "Retirer", "inviteEmail": "E-mail du gestionnaire", "inviteBuildings": "Immeubles confiés",
   "inviteManager": "Inviter", "managerInvited": "Gestionnaire invité.", "managerRemoved": "Gestionnaire retiré — son accès est coupé.",
   "notificationsTitle": "Préférences de notifications", "notificationsText": "Choisissez les alertes que vous recevez et leurs canaux. Les alertes restent visibles dans l'application.",
   "alertTypes": {"loyer_en_retard": "Loyer en retard", "fin_de_bail": "Fin de bail proche", "vacance_prolongee": "Vacance prolongée", "bail_demarrant": "Bail démarrant", "essai_abonnement": "Essai / abonnement"},
   "cannotDisableSubscription": "ne peut pas être coupée", "channelApp": "Dans l'application (cloche + page Alertes)", "channelEmail": "Par e-mail",
   "vacancyThreshold": "Seuil de vacance prolongée (jours)", "prefsSaved": "Préférences enregistrées.",
   "whatsappNote": "WhatsApp arrive dans un module ultérieur : aucun envoi WhatsApp n'est effectué pour l'instant.",
   "changePassword": "Changer mon mot de passe",
 },
 "crud": {
   "expenses": {
     "add": "Ajouter une dépense", "exportExcel": "Exporter (Excel)",
     "emptyTitle": "Aucune dépense pour l'instant", "emptyText": "Enregistrez vos dépenses (entretien, réparation, taxe, assurance, salaire…) : elles alimentent directement le ROI de chaque bien.",
     "filterBuilding": "Immeuble", "filterCategory": "Catégorie", "periodFrom": "Du", "periodTo": "Au",
     "searchPlaceholder": "Rechercher un libellé, un fournisseur…",
     "totalsByCategory": "Totaux par catégorie", "totalsByBuilding": "Totaux par immeuble",
     "categories": {"entretien": "Entretien", "reparation": "Réparation", "taxe": "Taxe", "assurance": "Assurance", "salaire": "Salaire", "autre": "Autre"},
     "fields": {"date": "Date", "building": "Immeuble", "apartment": "Appartement", "category": "Catégorie", "label": "Libellé", "amount": "Montant", "supplier": "Fournisseur", "receipt": "Justificatif"},
     "sortDate": "Date (plus récentes)", "sortAmount": "Montant", "sortLabel": "Libellé",
     "formTitleNew": "Nouvelle dépense", "formTitleEdit": "Modifier la dépense",
     "existingReceipt": "Un justificatif est déjà joint à cette dépense.",
     "receiptUploadFailed": "Dépense enregistrée, mais le justificatif n'a pas pu être téléversé.",
     "receiptYes": "Oui",
   },
   "errors": {
     "ERR_CATEGORIE_MANQUANTE": "La catégorie est obligatoire : elle rend le ROI fiable.",
     "ERR_DOCUMENT_FORMAT": "Format non accepté : PDF, JPG ou PNG uniquement.",
     "ERR_DOCUMENT_TROP_GROS": "Fichier trop gros : 10 Mo maximum.",
     "ERR_DOCUMENT_DOUBLON": "Un document du même nom existe déjà pour cet élément.",
     "ERR_DOCUMENT_CONTENU_ABSENT": "Le contenu de ce document n'a pas été conservé (fichier trop gros en démo).",
     "ERR_BUCKET_MANQUANT": "Le stockage des documents n'est pas encore créé (bucket « documents-prives »). Créez-le dans Supabase (supabase/storage.sql), puis réessayez.",
     "ERR_TAUX_MEME_DEVISE": "La devise source et la devise cible doivent être différentes.",
     "ERR_EMAIL_INVALIDE": "Entrez une adresse e-mail valide.",
     "ERR_GESTIONNAIRE_DEJA_INVITE": "Ce gestionnaire est déjà invité.",
     "ERR_GESTIONNAIRE_SANS_IMMEUBLE": "Choisissez au moins un immeuble à confier.",
   },
   "validation": {"optional": "Optionnel", "chooseCategory": "Choisissez une catégorie."},
   "leases": {"fields": {"signedDocument": "Bail signé (fichier)"}},
   "buildings": {"detailDocumentsAll": "Tous les documents"},
   "tenants": {"detailDocumentsAll": "Tous les documents", "exportExcel": "Exporter (Excel)"},
   "rents": {"exportExcel": "Exporter (Excel)"},
 },
}

EN = {
 "nav": {"documents": "Documents", "alerts": "Alerts", "reports": "Reports"},
 "pages": {
   "documents": {"title": "Documents"},
   "alerts": {"title": "Alerts"},
   "reports": {"title": "Reports & ROI"},
 },
 "dashboard": {
   "occupancy": "Occupancy rate", "occupiedCount": "{occupied} occupied out of {total} lettable",
   "collectedMonth": "Rent collected this month", "expectedMonth": "Expected",
   "lateAmount": "Amount overdue", "lateCount": "{count} overdue payment(s)",
   "vacant": "Vacant units", "vacantHint": "To let or pending",
   "displayCurrency": "Display currency", "converterNote": "Original amounts stay visible; converted totals carry their rate date.",
   "rateDate": "rate of {date}", "manualRate": "manual rate",
   "activeAlerts": "{count} active alert(s)", "viewAlerts": "View alerts",
   "quickDeclare": "Declare a payment", "quickExpense": "Add an expense", "quickBuilding": "Create a building",
   "lateList": "Overdue rent", "noLate": "No overdue rent — everything is up to date.", "remaining": "Remaining", "open": "Open",
   "leasesEnding": "Leases ending within 60 days", "noLeaseEnding": "No lease ending in the next 60 days.",
   "leaseEndsOn": "Ends {date}",
   "expensesMonth": "Expenses this month", "noExpenseMonth": "No expenses this month.", "viewExpenses": "View expenses",
   "collectionChart": "Collection over the last 6 months", "chartInCurrency": "Amounts converted to {currency} (dated rates).",
   "chartCollected": "Collected", "chartExpected": "Expected",
   "feedTitle": "Activity feed", "feedFilterBuilding": "Building", "feedEmpty": "No events yet — events will appear here as they are recorded.",
   "starterTitle": "Welcome to CizaImmo — start in 3 steps",
   "starterText": "Your portfolio is empty for now. Here is the shortest path to your first tracked rent.",
   "starterStep1": "Create your first building or block, with its address and currency.",
   "starterStep2": "Add its units (one by one or in bulk) with their rent.",
   "starterStep3": "Create a tenant and their lease: monthly rent bills are then generated automatically.",
   "starterCta": "Create my first building",
 },
 "documents": {
   "uploadLabel": "Attach a file", "uploadHint": "PDF, JPG or PNG — 10 MB maximum per file.",
   "chooseFile": "Choose a file", "changeFile": "Change file", "removeFile": "Remove",
   "errorFormat": "Format not accepted: PDF, JPG or PNG only.",
   "errorTooBig": "File too large: 10 MB maximum (limit: {max}).",
   "errorNoFile": "Choose a file to upload.", "errorNoEntity": "Choose the item this document belongs to.",
   "upload": "Upload a document", "uploadButton": "Upload",
   "emptyTitle": "No documents yet", "emptyText": "Upload your signed leases, ID documents, payment proofs and invoices: they stay private, accessible only to your account.",
   "empty": "No documents yet.",
   "type": "Type", "linkedTo": "Linked to", "entity": "Linked item", "chooseEntity": "Choose an item",
   "entityBuilding": "Building", "entityApartment": "Unit", "entityTenant": "Tenant",
   "entityLease": "Lease", "entityExpense": "Expense",
   "searchPlaceholder": "Search by file name…",
   "types": {"bail": "Signed lease", "piece_identite": "ID document", "justificatif": "Payment proof", "facture": "Invoice", "autre": "Other"},
   "download": "Download", "rename": "Rename", "renameTitle": "Rename document", "fileName": "File name",
   "confirmDelete": "Delete “{name}”?", "confirmDeleteText": "The document will be permanently deleted.",
   "demoContentNotKept": "Content not kept in demo: the file was too large for local storage. Metadata is kept.",
   "uploadedButNotKept": "Document saved. Content not kept in demo (file too large for local storage).",
 },
 "alerts": {
   "bellLabel": "Alerts: {count} active",
   "types": {"loyer_en_retard": "Overdue rent", "fin_de_bail": "Lease ending", "vacance_prolongee": "Long vacancy", "bail_demarrant": "Lease starting", "essai_abonnement": "Trial / subscription", "autre": "Other"},
   "urgency": {"haute": "Urgent", "moyenne": "Medium", "basse": "Low"},
   "emailStatus": "Email", "emailSent": "sent", "emailFailed": "sending failed", "emailDisabled": "disabled", "emailNotConfigured": "not configured",
   "openItem": "Open the item", "markTreated": "Mark as handled", "treatedDone": "Alert marked as handled.",
   "treatedOn": "Handled on {date}",
   "activeTitle": "Active alerts ({count})", "noActive": "No active alerts.",
   "treatedTitle": "Handled alerts history ({count})", "noTreated": "No handled alerts yet.",
   "emptyTitle": "No alerts — everything is up to date", "emptyText": "No overdue rent, no lease ending soon, no long vacancy. Alerts will appear here when an event justifies one.",
   "goToDashboard": "Back to dashboard", "manageHint": "To turn off an alert type, go to", "goToSettings": "Settings",
 },
 "reports": {
   "periodFrom": "From", "periodTo": "To", "building": "Building", "wholePortfolio": "Whole portfolio",
   "displayCurrency": "Display currency", "income": "Declared income", "expenses": "Expenses",
   "netResult": "Net result", "netMargin": "Net margin", "valueToEnter": "value to enter", "noData": "No data for this period.",
   "byBuilding": "Comparison by building", "occupancy": "Occupancy",
   "roiNote": "ROI = (declared income − expenses) ÷ property value. Without a property value, the ROI shows “value to enter” — never an invented figure. Net margin = (income − expenses) ÷ income: it is a margin, not an ROI.",
   "byApartment": "ROI per unit", "evolution": "Monthly trend",
   "evolutionInCurrency": "Amounts converted to {currency} (dated rates).",
   "ratesUsed": "Exchange rates used", "noConversion": "No conversion: all amounts are in their original currency.",
   "rateMissing": "no rate available — amount not converted", "rateDate": "rate of {date}", "manualRate": "manual rate",
   "exportPdf": "Export report (PDF)", "exportExcel": "Export (Excel)",
 },
 "settings": {
   "profileTitle": "Profile", "name": "Full name", "country": "Country", "phone": "Phone",
   "email": "Email", "emailReadOnly": "The account email cannot be changed here.",
   "language": "Language", "mainCurrency": "Main display currency", "profileSaved": "Profile saved.",
   "ratesTitle": "Manual exchange rates", "ratesText": "Automatic rates are fetched by the system (module 6). Meanwhile, you can enter a dated manual fallback rate: it will be flagged as manual wherever it is used. A rate is never invented.",
   "lastRate": "Latest rate: {date} ({source})", "manual": "manual", "auto": "automatic", "noRate": "No rate recorded yet.",
   "rateFrom": "Source currency", "rateTo": "Target currency", "rateValue": "Rate", "rateDate": "Rate date", "addRate": "Add manual rate", "rateSaved": "Manual rate saved.",
   "managersTitle": "Invited managers", "managersText": "Invite a manager by email and choose their buildings: they only see those. A removed manager loses access immediately.",
   "noManager": "No manager invited yet.",
   "removeManager": "Remove", "inviteEmail": "Manager email", "inviteBuildings": "Assigned buildings",
   "inviteManager": "Invite", "managerInvited": "Manager invited.", "managerRemoved": "Manager removed — access revoked.",
   "notificationsTitle": "Notification preferences", "notificationsText": "Choose which alerts you receive and through which channels. Alerts remain visible in the app.",
   "alertTypes": {"loyer_en_retard": "Overdue rent", "fin_de_bail": "Lease ending soon", "vacance_prolongee": "Long vacancy", "bail_demarrant": "Lease starting", "essai_abonnement": "Trial / subscription"},
   "cannotDisableSubscription": "cannot be turned off", "channelApp": "In the app (bell + Alerts page)", "channelEmail": "By email",
   "vacancyThreshold": "Long-vacancy threshold (days)", "prefsSaved": "Preferences saved.",
   "whatsappNote": "WhatsApp comes in a later module: no WhatsApp message is sent for now.",
   "changePassword": "Change my password",
 },
 "crud": {
   "expenses": {
     "add": "Add an expense", "exportExcel": "Export (Excel)",
     "emptyTitle": "No expenses yet", "emptyText": "Record your expenses (maintenance, repairs, tax, insurance, wages…): they feed directly into each property's ROI.",
     "filterBuilding": "Building", "filterCategory": "Category", "periodFrom": "From", "periodTo": "To",
     "searchPlaceholder": "Search by label, supplier…",
     "totalsByCategory": "Totals by category", "totalsByBuilding": "Totals by building",
     "categories": {"entretien": "Maintenance", "reparation": "Repair", "taxe": "Tax", "assurance": "Insurance", "salaire": "Wages", "autre": "Other"},
     "fields": {"date": "Date", "building": "Building", "apartment": "Unit", "category": "Category", "label": "Label", "amount": "Amount", "supplier": "Supplier", "receipt": "Receipt"},
     "sortDate": "Date (newest first)", "sortAmount": "Amount", "sortLabel": "Label",
     "formTitleNew": "New expense", "formTitleEdit": "Edit expense",
     "existingReceipt": "A receipt is already attached to this expense.",
     "receiptUploadFailed": "Expense saved, but the receipt could not be uploaded.",
     "receiptYes": "Yes",
   },
   "errors": {
     "ERR_CATEGORIE_MANQUANTE": "Category is required: it makes the ROI reliable.",
     "ERR_DOCUMENT_FORMAT": "Format not accepted: PDF, JPG or PNG only.",
     "ERR_DOCUMENT_TROP_GROS": "File too large: 10 MB maximum.",
     "ERR_DOCUMENT_DOUBLON": "A document with the same name already exists for this item.",
     "ERR_DOCUMENT_CONTENU_ABSENT": "This document's content was not kept (file too large in demo).",
     "ERR_BUCKET_MANQUANT": "Document storage is not created yet (“documents-prives” bucket). Create it in Supabase (supabase/storage.sql), then try again.",
     "ERR_TAUX_MEME_DEVISE": "Source and target currencies must differ.",
     "ERR_EMAIL_INVALIDE": "Enter a valid email address.",
     "ERR_GESTIONNAIRE_DEJA_INVITE": "This manager is already invited.",
     "ERR_GESTIONNAIRE_SANS_IMMEUBLE": "Choose at least one building to assign.",
   },
   "validation": {"optional": "Optional", "chooseCategory": "Choose a category."},
   "leases": {"fields": {"signedDocument": "Signed lease (file)"}},
   "buildings": {"detailDocumentsAll": "All documents"},
   "tenants": {"detailDocumentsAll": "All documents", "exportExcel": "Export (Excel)"},
   "rents": {"exportExcel": "Export (Excel)"},
 },
}

def deep_merge(base, ajout):
    for k, v in ajout.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v
    return base

def keys(o, p=""):
    out = set()
    for k, v in o.items():
        if isinstance(v, dict):
            out |= keys(v, p + k + ".")
        else:
            out.add(p + k)
    return out

for lang, ajout in [("fr", FR), ("en", EN)]:
    path = f"messages/{lang}.json"
    d = json.load(open(path))
    deep_merge(d, ajout)
    json.dump(d, open(path, "w"), ensure_ascii=False, indent=4, sort_keys=True)
    print(lang, "ok")

fr = json.load(open("messages/fr.json"))
en = json.load(open("messages/en.json"))
kf, ke = keys(fr), keys(en)
print("clés FR:", len(kf), "| clés EN:", len(ke))
print("manquantes en EN:", sorted(kf - ke))
print("manquantes en FR:", sorted(ke - kf))
sys.exit(0 if kf == ke else 1)
