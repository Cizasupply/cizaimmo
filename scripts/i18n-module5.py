#!/usr/bin/env python3
"""Ajoute les chaînes du module 5 à messages/fr.json et messages/en.json.
Vérifie ensuite que les deux fichiers ont exactement le même ensemble de clés."""
import json, sys

FR = {
 "nav": {"subscription": "Abonnement"},
 "pages": {"subscription": {"title": "Abonnement"}},
 "landing": {
   "pricing": {
     "title": "Tarifs",
     "subtitle": "Un abonnement selon vos blocs. Deux grilles, affichées séparément : Afrique ou Internationale, selon le pays de votre compte à l'inscription.",
     "trial": "Essai gratuit de 30 jours, toutes les fonctions du plan Pro, sans carte bancaire.",
     "mobileMoney": "Paiement par carte bancaire (Stripe) ou par mobile money : EcoCash, Lumicash, eNoti.",
     "cta": "Choisir ce plan",
     "perMonth": "/ mois",
     "blocks": "{count} bloc(s)",
     "blocksUnlimited": "Blocs illimités",
     "gridAfrique": "Grille Afrique",
     "gridInternationale": "Grille Internationale",
     "managers": "{count} gestionnaire(s) invité(s)",
     "managersUnlimited": "Gestionnaires invités illimités",
     "managersNone": "Aucun gestionnaire invité",
     "vitrineYes": "Vitrine « appartements à louer » incluse",
     "vitrineNo": "Vitrine « appartements à louer » non incluse",
     "indivisionYes": "Indivision familiale incluse",
     "indivisionNo": "Indivision familiale non incluse",
     "fullManagement": "Gestion complète : immeubles, loyers, reçus, dépenses",
     "reports": "Rapports & ROI, exports Excel / PDF",
   }
 },
 "crud": {
   "errors": {
     "ERR_ABONNEMENT_REQUIS": "Votre abonnement est requis pour ajouter ou modifier des données : votre compte est en lecture seule. Choisissez un plan pour reprendre la saisie — vos données restent consultables et exportables.",
     "ERR_DESCENTE_BLOQUEE": "Descente refusée : votre parc dépasse la limite de blocs du plan inférieur. Archivez d'abord des blocs, puis réessayez.",
     "ERR_PLAN_INVALIDE": "Plan inconnu.",
     "ERR_MM_TELEPHONE_INVALIDE": "Entrez un numéro de téléphone mobile money valide (8 à 15 chiffres).",
     "ERR_MM_INTROUVABLE": "Référence de paiement mobile money introuvable.",
     "ERR_MM_EXPIRE": "Paiement mobile money non confirmé sous 24 heures : annulé, sans frais. Faites une nouvelle demande si besoin.",
     "ERR_MM_DEJA_TRAITE": "Ce paiement mobile money a déjà été traité.",
     "ERR_MM_CONFIRMATION_WEBHOOK": "En mode réel, la confirmation d'un paiement mobile money arrive uniquement par le fournisseur (webhook). Elle ne peut pas être confirmée ici."
   }
 },
 "subscription": {
   "currentPlan": "Plan actuel",
   "plan": "Plan",
   "status": "Statut",
   "statusTrial": "Essai gratuit",
   "statusActive": "Actif",
   "statusReadOnly": "Lecture seule",
   "statusCancelled": "Annulé",
   "grid": "Grille",
   "gridAfrique": "Afrique",
   "gridInternationale": "Internationale",
   "trialEnds": "Fin de l'essai",
   "period": "Période en cours",
   "periodEnds": "Fin de la période",
   "blocksUsed": "{used} / {allowed} bloc(s) utilisé(s)",
   "blocksUnlimited": "{used} bloc(s) utilisé(s) — illimité",
   "retentionUntil": "Données consultables et exportables jusqu'au",
   "pendingDowngrade": "Descente programmée",
   "pendingDowngradeText": "Vous passerez au plan {plan} le {date}, à la fin de la période payée.",
   "cancellationScheduled": "Résiliation programmée",
   "cancellationScheduledText": "Votre abonnement se termine le {date}. Vos données resteront consultables et exportables pendant 90 jours. Choisissez à nouveau votre plan pour annuler la résiliation.",
   "readOnly": "Compte en lecture seule",
   "readOnlyText": "Votre essai est terminé ou votre abonnement est suspendu : vous pouvez consulter et exporter vos données, mais plus rien saisir. Choisissez un plan pour reprendre.",
   "demoNote": "MODE DÉMO — les changements de plan et les confirmations sont simulés, aucun vrai paiement.",
   "stripeNotConfigured": "Stripe non configuré — mode test. Renseignez les clés test dans .env.local (voir docs/stripe-test-setup.md) pour activer le paiement par carte.",
   "stripeTestMode": "Stripe en MODE TEST : cartes de test uniquement (4242 4242 4242 4242…), aucun débit réel.",
   "compareTitle": "Comparer les plans",
   "choosePlan": "Choisir ce plan",
   "currentPlanButton": "Plan actuel",
   "downgradeEffective": "Effectif en fin de période",
   "upgradeNow": "Montée immédiate",
   "payTitle": "Payer pour le plan {plan}",
   "payByCard": "Payer par carte (Stripe, mode test)",
   "payByMobileMoney": "Payer par mobile money",
   "operator": "Opérateur",
   "phone": "Numéro de téléphone",
   "phonePlaceholder": "Ex. +257 79 00 00 00",
   "requestPayment": "Envoyer la demande de paiement",
   "paymentRequested": "Demande envoyée sur votre téléphone : confirmez-la sur votre téléphone. L'abonnement ne s'active qu'après confirmation reçue.",
   "reference": "Référence",
   "expiresAt": "Expire le",
   "simulateConfirm": "Simuler la confirmation (démo)",
   "simulateConfirmHint": "Démo uniquement : simule la confirmation reçue sur votre téléphone. Ce n'est pas un vrai paiement.",
   "paymentConfirmed": "Paiement confirmé — votre abonnement est actif.",
   "paymentPending": "En attente de confirmation",
   "paymentExpired": "Expiré (non confirmé sous 24 h, sans frais)",
   "paymentCancelled": "Annulé",
   "invoicesTitle": "Factures d'abonnement",
   "invoicesEmpty": "Aucune facture d'abonnement pour le moment.",
   "download": "Télécharger",
   "invoiceNumber": "N°",
   "invoiceDate": "Date",
   "invoiceAmount": "Montant",
   "invoiceMethod": "Moyen",
   "invoiceStatus": "Statut",
   "methodStripe": "Carte (Stripe)",
   "methodMobileMoney": "Mobile money",
   "methodDemo": "Démo",
   "statusPaid": "Payée",
   "statusPending": "En attente",
   "statusCancelled": "Annulée",
   "mmTitle": "Paiements mobile money",
   "mmEmpty": "Aucun paiement mobile money pour le moment.",
   "cancelTitle": "Annuler l'abonnement",
   "cancelButton": "Annuler l'abonnement",
   "cancelConfirmTitle": "Annuler votre abonnement ?",
   "cancelConfirmText": "Votre abonnement reste actif jusqu'à la fin de la période payée ({date}), puis votre compte passe en lecture seule pendant 90 jours : données consultables et exportables, aucune saisie nouvelle, aucune donnée supprimée. Vos blocs existants ne sont jamais verrouillés ni supprimés.",
   "cancelConfirmButton": "Oui, annuler en fin de période",
   "cancelDone": "Résiliation programmée en fin de période.",
   "accessDenied": "L'abonnement n'est visible que par le propriétaire du compte.",
   "changeDone": "Plan mis à jour.",
   "downgradeDone": "Descente programmée en fin de période.",
   "features": {
     "managers": "{count} gestionnaire(s) invité(s)",
     "managersUnlimited": "Gestionnaires invités illimités",
     "managersNone": "Aucun gestionnaire invité",
     "vitrineYes": "Vitrine « appartements à louer » incluse",
     "vitrineNo": "Vitrine « appartements à louer » non incluse",
     "indivisionYes": "Indivision familiale incluse",
     "indivisionNo": "Indivision familiale non incluse",
     "fullManagement": "Gestion complète : immeubles, loyers, reçus, dépenses",
     "reports": "Rapports & ROI, exports Excel / PDF"
   },
   "plans": {
     "starter": "Starter",
     "pro": "Pro",
     "agence": "Agence"
   }
 }
}

EN = {
 "nav": {"subscription": "Subscription"},
 "pages": {"subscription": {"title": "Subscription"}},
 "landing": {
   "pricing": {
     "title": "Pricing",
     "subtitle": "A subscription based on your blocks. Two pricings, shown separately: Africa or International, based on your account country at sign-up.",
     "trial": "30-day free trial, all Pro plan features, no card required.",
     "mobileMoney": "Pay by card (Stripe) or by mobile money: EcoCash, Lumicash, eNoti.",
     "cta": "Choose this plan",
     "perMonth": "/ month",
     "blocks": "{count} block(s)",
     "blocksUnlimited": "Unlimited blocks",
     "gridAfrique": "Africa pricing",
     "gridInternationale": "International pricing",
     "managers": "{count} invited manager(s)",
     "managersUnlimited": "Unlimited invited managers",
     "managersNone": "No invited manager",
     "vitrineYes": "“Apartments for rent” showcase included",
     "vitrineNo": "“Apartments for rent” showcase not included",
     "indivisionYes": "Family co-ownership included",
     "indivisionNo": "Family co-ownership not included",
     "fullManagement": "Full management: buildings, rents, receipts, expenses",
     "reports": "Reports & ROI, Excel / PDF exports",
   }
 },
 "crud": {
   "errors": {
     "ERR_ABONNEMENT_REQUIS": "A subscription is required to add or edit data: your account is read-only. Choose a plan to resume editing — your data stays viewable and exportable.",
     "ERR_DESCENTE_BLOQUEE": "Downgrade refused: your portfolio exceeds the lower plan's block limit. Archive some blocks first, then try again.",
     "ERR_PLAN_INVALIDE": "Unknown plan.",
     "ERR_MM_TELEPHONE_INVALIDE": "Enter a valid mobile money phone number (8 to 15 digits).",
     "ERR_MM_INTROUVABLE": "Mobile money payment reference not found.",
     "ERR_MM_EXPIRE": "Mobile money payment not confirmed within 24 hours: cancelled, free of charge. Send a new request if needed.",
     "ERR_MM_DEJA_TRAITE": "This mobile money payment was already processed.",
     "ERR_MM_CONFIRMATION_WEBHOOK": "In live mode, a mobile money payment can only be confirmed by the provider (webhook). It cannot be confirmed here."
   }
 },
 "subscription": {
   "currentPlan": "Current plan",
   "plan": "Plan",
   "status": "Status",
   "statusTrial": "Free trial",
   "statusActive": "Active",
   "statusReadOnly": "Read-only",
   "statusCancelled": "Cancelled",
   "grid": "Pricing",
   "gridAfrique": "Africa",
   "gridInternationale": "International",
   "trialEnds": "Trial ends",
   "period": "Current period",
   "periodEnds": "Period ends",
   "blocksUsed": "{used} / {allowed} block(s) used",
   "blocksUnlimited": "{used} block(s) used — unlimited",
   "retentionUntil": "Data viewable and exportable until",
   "pendingDowngrade": "Downgrade scheduled",
   "pendingDowngradeText": "You will move to the {plan} plan on {date}, at the end of the paid period.",
   "cancellationScheduled": "Cancellation scheduled",
   "cancellationScheduledText": "Your subscription ends on {date}. Your data will stay viewable and exportable for 90 days. Choose your plan again to cancel the cancellation.",
   "readOnly": "Read-only account",
   "readOnlyText": "Your trial has ended or your subscription is suspended: you can view and export your data, but no longer add or edit anything. Choose a plan to resume.",
   "demoNote": "DEMO MODE — plan changes and confirmations are simulated, no real payment.",
   "stripeNotConfigured": "Stripe not configured — test mode. Set the test keys in .env.local (see docs/stripe-test-setup.md) to enable card payment.",
   "stripeTestMode": "Stripe in TEST MODE: test cards only (4242 4242 4242 4242…), no real charge.",
   "compareTitle": "Compare plans",
   "choosePlan": "Choose this plan",
   "currentPlanButton": "Current plan",
   "downgradeEffective": "Effective at end of period",
   "upgradeNow": "Immediate upgrade",
   "payTitle": "Pay for the {plan} plan",
   "payByCard": "Pay by card (Stripe, test mode)",
   "payByMobileMoney": "Pay by mobile money",
   "operator": "Operator",
   "phone": "Phone number",
   "phonePlaceholder": "E.g. +1 514 000 0000",
   "requestPayment": "Send the payment request",
   "paymentRequested": "Request sent to your phone: confirm it on your phone. The subscription only activates after confirmation is received.",
   "reference": "Reference",
   "expiresAt": "Expires on",
   "simulateConfirm": "Simulate confirmation (demo)",
   "simulateConfirmHint": "Demo only: simulates the confirmation received on your phone. This is not a real payment.",
   "paymentConfirmed": "Payment confirmed — your subscription is active.",
   "paymentPending": "Awaiting confirmation",
   "paymentExpired": "Expired (not confirmed within 24 h, free of charge)",
   "paymentCancelled": "Cancelled",
   "invoicesTitle": "Subscription invoices",
   "invoicesEmpty": "No subscription invoice yet.",
   "download": "Download",
   "invoiceNumber": "No.",
   "invoiceDate": "Date",
   "invoiceAmount": "Amount",
   "invoiceMethod": "Method",
   "invoiceStatus": "Status",
   "methodStripe": "Card (Stripe)",
   "methodMobileMoney": "Mobile money",
   "methodDemo": "Demo",
   "statusPaid": "Paid",
   "statusPending": "Pending",
   "statusCancelled": "Cancelled",
   "mmTitle": "Mobile money payments",
   "mmEmpty": "No mobile money payment yet.",
   "cancelTitle": "Cancel the subscription",
   "cancelButton": "Cancel the subscription",
   "cancelConfirmTitle": "Cancel your subscription?",
   "cancelConfirmText": "Your subscription stays active until the end of the paid period ({date}), then your account becomes read-only for 90 days: data viewable and exportable, no new entries, no data deleted. Your existing blocks are never locked or deleted.",
   "cancelConfirmButton": "Yes, cancel at end of period",
   "cancelDone": "Cancellation scheduled for the end of the period.",
   "accessDenied": "The subscription is only visible to the account owner.",
   "changeDone": "Plan updated.",
   "downgradeDone": "Downgrade scheduled for the end of the period.",
   "features": {
     "managers": "{count} invited manager(s)",
     "managersUnlimited": "Unlimited invited managers",
     "managersNone": "No invited manager",
     "vitrineYes": "“Apartments for rent” showcase included",
     "vitrineNo": "“Apartments for rent” showcase not included",
     "indivisionYes": "Family co-ownership included",
     "indivisionNo": "Family co-ownership not included",
     "fullManagement": "Full management: buildings, rents, receipts, expenses",
     "reports": "Reports & ROI, Excel / PDF exports"
   },
   "plans": {
     "starter": "Starter",
     "pro": "Pro",
     "agence": "Agency"
   }
 }
}

def fusionner(cible, ajout):
    for k, v in ajout.items():
        if isinstance(v, dict):
            cible.setdefault(k, {})
            if not isinstance(cible[k], dict):
                raise SystemExit(f"Conflit de type sur la clé {k}")
            fusionner(cible[k], v)
        else:
            cible[k] = v

def cles(d, prefixe=""):
    out = set()
    for k, v in d.items():
        p = f"{prefixe}.{k}" if prefixe else k
        if isinstance(v, dict):
            out |= cles(v, p)
        else:
            out.add(p)
    return out

for chemin, ajout in [("messages/fr.json", FR), ("messages/en.json", EN)]:
    with open(chemin, encoding="utf-8") as f:
        donnees = json.load(f)
    fusionner(donnees, ajout)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(donnees, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")

fr = json.load(open("messages/fr.json", encoding="utf-8"))
en = json.load(open("messages/en.json", encoding="utf-8"))
kf, ke = cles(fr), cles(en)
if kf != ke:
    print("FR sans EN :", sorted(kf - ke))
    print("EN sans FR :", sorted(ke - kf))
    sys.exit(1)
print(f"i18n module 5 : parité OK ({len(kf)} clés)")
