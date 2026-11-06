#!/usr/bin/env python3
"""Module 7 — pages publiques, légales et polish : ajoute les chaînes
FR/EN à messages/fr.json et messages/en.json, puis vérifie la parité
exacte des deux ensembles de clés (zéro écart exigé).

Usage : python3 scripts/i18n-module7.py
"""
import json, sys

FR = {
 "nav": {
   "home": "Accueil",
   "pricing": "Tarifs",
   "contact": "Contact",
   "privacy": "Confidentialité",
   "terms": "Conditions d'utilisation",
   "legalNotice": "Mentions légales",
   "cookies": "Cookies",
 },
 "common": {
   "retry": "Réessayer",
   "language": "Langue",
   "backToHome": "Retour à l'accueil",
   "rights": "© 2026 CizaImmo, division de Ciza Group. Tous droits réservés.",
 },
 "landing": {
   "ctaTrial": "Commencer l'essai gratuit de 30 jours",
   "howTitle": "Comment ça marche",
   "howStep1Title": "1. Créez votre parc",
   "howStep1Text": "Ajoutez vos immeubles et vos appartements en quelques minutes, avec leurs loyers et leurs devises.",
   "howStep2Title": "2. Suivez vos loyers",
   "howStep2Text": "Déclarez les paiements reçus, recevez les reçus PDF numérotés et soyez alerté en cas de retard.",
   "howStep3Title": "3. Pilotez votre rentabilité",
   "howStep3Text": "Occupation, collecte, impayés et ROI : vos quatre indicateurs, dans la devise de chaque bien.",
   "currenciesTitle": "Vos devises, affichées comme vous les utilisez",
   "currenciesText": "Chaque loyer est enregistré dans sa devise d'origine. Les totaux sont convertis avec un taux daté, jamais présenté comme un taux du jour.",
   "currenciesList": "USD · EUR · BIF · CAD · GBP · XAF · XOF · KES · TZS · RWF · UGX · BRL",
   "previewTitle": "Votre tableau de bord, en un coup d'œil",
   "previewText": "Occupation, collecte du mois, impayés et ROI — avec le montant d'origine de chaque bien à côté de sa conversion.",
   "previewCurrencyLabel": "Devise d'affichage",
   "previewNote": "Exemple d'affichage : le sélecteur de devise ouvert, avec $ USD, € EUR et BIF.",
   "benefitsTitle": "Ce que CizaImmo fait pour vous",
   "benefitOccupancy": "Occupation",
   "benefitOccupancyText": "Vos appartements occupés, vacants et bientôt libres, immeuble par immeuble.",
   "benefitCollection": "Collecte",
   "benefitCollectionText": "Chaque échéance suivie mois par mois, sans doublon, avec prorata au premier et au dernier mois.",
   "benefitReceipts": "Reçus",
   "benefitReceiptsText": "Un reçu PDF numéroté pour chaque paiement déclaré, à télécharger ou à renvoyer.",
   "benefitRoi": "ROI",
   "benefitRoiText": "La rentabilité réelle sur la valeur du bien, et la marge nette affichée séparément.",
 },
 "pricingPage": {
   "title": "Tarifs",
   "subtitle": "Un abonnement selon vos blocs. Deux grilles, affichées séparément : Afrique ou Internationale, selon le pays de votre compte à l'inscription.",
   "africaTitle": "Grille Afrique",
   "africaNote": "Pour les comptes dont le pays est en Afrique. Prix mensuels en dollars américains (USD).",
   "internationalTitle": "Grille Internationale",
   "internationalNote": "Pour les comptes hors Afrique. Prix mensuels en dollars américains (USD).",
   "trialTitle": "Essai gratuit de 30 jours",
   "trialText": "Toutes les fonctions du plan Pro pendant 30 jours, sans carte bancaire. L'essai démarre à la validation de votre e-mail.",
   "paymentTitle": "Comment payer votre abonnement",
   "paymentCard": "Par carte bancaire (Stripe) — paiement en ligne sécurisé.",
   "paymentMobileMoney": "Par mobile money — EcoCash, Lumicash, eNoti. Votre abonnement est activé seulement après confirmation du paiement.",
   "paymentNote": "CizaImmo n'encaisse jamais les loyers : l'abonnement est le seul paiement du produit.",
   "chooseCta": "Choisir ce plan",
   "gridLabel": "Grille",
   "annualNote": "Abonnement mensuel. Annulation en fin de période ; montée de plan immédiate, descente en fin de période.",
 },
 "contact": {
   "title": "Contact / Démo",
   "subtitle": "Une question, une démonstration ? Écrivez-nous — nous répondons en français ou en anglais.",
   "demoTitle": "Demander une démonstration",
   "demoText": "Indiquez le nombre de biens que vous gérez : nous préparons une démonstration adaptée à votre parc.",
   "name": "Nom",
   "email": "E-mail",
   "phone": "Téléphone / WhatsApp",
   "propertiesCount": "Nombre de biens",
   "propertiesCountHint": "Immeubles ou appartements que vous gérez (approximatif).",
   "message": "Message",
   "messagePlaceholder": "Votre question ou votre demande de démonstration…",
   "send": "Envoyer la demande",
   "sending": "Envoi…",
   "sentTitle": "Demande envoyée — merci !",
   "sentText": "Votre message a bien été envoyé à l'équipe CizaImmo. Nous vous répondrons à l'adresse e-mail indiquée.",
   "sendFailed": "L'envoi a échoué. Vérifiez votre connexion puis réessayez, ou écrivez-nous directement par e-mail.",
   "nameRequired": "Indiquez votre nom.",
   "emailRequired": "Indiquez votre e-mail.",
   "emailInvalid": "Cette adresse e-mail ne semble pas valide.",
   "messageRequired": "Écrivez votre message.",
   "propertiesRequired": "Indiquez le nombre de biens (0 si vous n'en gérez pas encore).",
   "whatsappTitle": "Préférez WhatsApp ?",
   "whatsappText": "Écrivez-nous directement sur WhatsApp : +1 514 502 9503.",
   "whatsappButton": "Ouvrir WhatsApp",
   "emailTitle": "Par e-mail",
   "emailText": "infos@cizagroup.com",
   "mailtoTitle": "Envoi par e-mail",
   "mailtoText": "Le formulaire d'envoi direct n'est pas configuré sur cette installation : votre message s'ouvrira dans votre application e-mail, adressé à infos@cizagroup.com.",
   "mailtoButton": "Ouvrir mon application e-mail",
   "noDataNote": "Aucune donnée de votre parc n'est demandée ici — seulement vos coordonnées pour vous répondre.",
 },
 "footer": {
   "tagline": "Vos biens, gérés simplement.",
   "contactEmail": "infos@cizagroup.com",
   "languageLabel": "Langue",
 },
 "legal": {
   "common": {
     "noRentCollection": "CizaImmo n'encaisse pas les loyers et ne conserve pas d'argent pour le compte de tiers. Seuls les paiements déclarés par le propriétaire ou le gestionnaire sont enregistrés.",
     "dataOwnership": "Les données de votre parc (immeubles, appartements, locataires, loyers, documents) vous appartiennent. CizaImmo ne les vend pas, ne les partage pas et ne les utilise pas à d'autres fins que le fonctionnement du service.",
     "retention90": "Après la fin de votre abonnement, vos données restent consultables en lecture seule pendant 90 jours, puis sont supprimées. Aucune donnée n'est supprimée pendant l'abonnement ou l'essai.",
     "contactLine": "Contact : infos@cizagroup.com — Ciza Group SURL, RC 0082870/26, NIF 4003446905 — 6ème Avenue N° 47, Quartier Buhomba, Zone Mutimbuzi, Commune Ntahangwa, Bujumbura, Burundi.",
     "updated": "Dernière mise à jour : novembre 2026.",
   },
   "privacy": {
     "title": "Politique de confidentialité",
     "intro": "Cette politique explique quelles données CizaImmo collecte, pourquoi, et quels sont vos droits. Elle s'applique au site cizaimmo.com et à l'application CizaImmo.",
     "s1Title": "1. Données que nous collectons",
     "s1Text": "Votre compte : nom, e-mail, pays, devise principale et langue. Votre parc : immeubles, appartements, locataires, baux, loyers déclarés, dépenses et documents que vous téléversez. Vos messages : le contenu des formulaires de contact et de demande de démonstration.",
     "s2Title": "2. Pourquoi nous les utilisons",
     "s2Text": "Faire fonctionner le service : afficher votre parc, calculer vos indicateurs (occupation, collecte, impayés, ROI), générer vos reçus et vos alertes. Vous répondre quand vous nous contactez. Rien d'autre.",
     "s3Title": "3. Partage des données",
     "s3Text": "Vos données ne sont jamais vendues ni partagées avec des tiers à des fins commerciales. Elles sont hébergées par nos prestataires techniques (hébergement de l'application et base de données) qui ne peuvent y accéder que pour faire fonctionner le service. Les paiements d'abonnement sont traités par Stripe (carte) ou par votre opérateur mobile money : CizaImmo ne voit ni ne conserve vos numéros de carte.",
     "s4Title": "4. Conservation",
     "s4Text": "Vos données sont conservées tant que votre compte est actif. Après la fin de votre abonnement, elles restent consultables en lecture seule pendant 90 jours, puis sont supprimées. Vous pouvez demander la suppression de votre compte à tout moment par e-mail.",
     "s5Title": "5. Vos droits",
     "s5Text": "Vous pouvez consulter, corriger et exporter vos données depuis l'application, et demander leur suppression en écrivant à infos@cizagroup.com. Vous pouvez aussi retirer à tout moment l'accès d'un gestionnaire ou d'un co-propriétaire : l'accès est révoqué immédiatement.",
     "s6Title": "6. Sécurité",
     "s6Text": "L'accès à votre parc est protégé par votre mot de passe (double authentification proposée dans les paramètres) et par des règles au niveau de la base de données : un compte ne peut jamais lire ni modifier les données d'un autre compte, même en modifiant une adresse de page.",
   },
   "terms": {
     "title": "Conditions d'utilisation",
     "intro": "En créant un compte CizaImmo, vous acceptez les présentes conditions. Si vous ne les acceptez pas, n'utilisez pas le service.",
     "s1Title": "1. Le service",
     "s1Text": "CizaImmo est un logiciel en ligne de gestion immobilière : immeubles et blocs, appartements, locataires, loyers déclarés, dépenses, documents et rentabilité. Le service est fourni en français et en anglais, sur le web et sur téléphone.",
     "s2Title": "2. Abonnement et essai gratuit",
     "s2Text": "L'inscription ouvre un essai gratuit de 30 jours avec les fonctions du plan Pro, sans carte bancaire ; l'essai démarre à la validation de votre e-mail. À la fin de l'essai, l'accès passe en lecture seule tant qu'aucun abonnement n'est actif : vous pouvez toujours consulter et exporter vos données, mais plus rien saisir. L'abonnement se paie par carte bancaire (Stripe) ou par mobile money (EcoCash, Lumicash, eNoti) ; il est activé seulement après confirmation du paiement. La montée de plan est immédiate, la descente et l'annulation prennent effet en fin de période.",
     "s3Title": "3. CizaImmo n'encaisse pas les loyers",
     "s3Text": "CizaImmo n'encaisse jamais les loyers et ne conserve pas d'argent pour le compte de tiers. Le produit est financé à 100 % par l'abonnement. Il enregistre uniquement les paiements déclarés par le propriétaire ou le gestionnaire. CizaImmo ne distribue pas non plus d'argent entre co-propriétaires : l'indivision affiche seulement la répartition calculée des revenus.",
     "s4Title": "4. Vos responsabilités",
     "s4Text": "Vous êtes responsable de l'exactitude des données que vous saisissez (loyers, baux, paiements déclarés) et de la confidentialité de votre mot de passe. Vous ne devez pas saisir de données illégales, ni tenter d'accéder au parc d'un autre compte.",
     "s5Title": "5. Limites du service",
     "s5Text": "Les taux de change affichés sont des taux de référence datés, fournis par un service externe ; ils ne constituent pas un taux du jour et ne sont jamais présentés comme tels. La vitrine « appartements à louer » est un service d'annonces : CizaImmo ne prend ni réservation ni paiement en ligne, le contact se fait directement avec le propriétaire ou le gestionnaire.",
     "s6Title": "6. Résiliation et conservation",
     "s6Text": "Vous pouvez résilier à tout moment : l'accès reste actif jusqu'à la fin de la période payée, puis passe en lecture seule pendant 90 jours avant suppression des données. CizaImmo peut suspendre un compte en cas de violation grave des présentes conditions, après vous en avoir informé.",
   },
   "notice": {
     "title": "Mentions légales",
     "intro": "Informations légales sur l'éditeur du site cizaimmo.com et de l'application CizaImmo.",
     "s1Title": "1. Éditeur",
     "s1Text": "Ciza Group SURL — RC 0082870/26 — NIF 4003446905 — 6ème Avenue N° 47, Quartier Buhomba, Zone Mutimbuzi, Commune Ntahangwa, Bujumbura, Burundi. E-mail : infos@cizagroup.com. CizaImmo est une division de Ciza Group.",
     "s2Title": "2. Hébergement",
     "s2Text": "Application hébergée par Vercel Inc. Données hébergées par Supabase Inc. (base de données et stockage des documents, accès privé par lien signé et temporaire uniquement).",
     "s3Title": "3. Propriété intellectuelle",
     "s3Text": "Le nom CizaImmo, le logo et les contenus du site appartiennent à Ciza Group SURL. Les données de votre parc vous appartiennent : CizaImmo ne revendique aucun droit sur elles.",
     "s4Title": "4. Contact",
     "s4Text": "Pour toute question : infos@cizagroup.com ou WhatsApp +1 514 502 9503.",
   },
   "cookies": {
     "title": "Politique cookies",
     "intro": "CizaImmo utilise uniquement des cookies strictement nécessaires au fonctionnement du service. Aucun cookie publicitaire, aucun suivi à des fins de marketing.",
     "s1Title": "1. Ce que nous utilisons",
     "s1Text": "Langue choisie (français ou anglais), session de connexion et session démo, préférences d'affichage. Ces cookies sont indispensables : sans eux, l'application ne peut pas vous reconnaître ni garder votre langue.",
     "s2Title": "2. Ce que nous n'utilisons pas",
     "s2Text": "Aucun cookie publicitaire, aucun cookie de suivi entre sites, aucune revente de données de navigation. Les statistiques de visite, quand elles existent, sont agrégées et anonymes.",
     "s3Title": "3. Contrôle",
     "s3Text": "Vous pouvez supprimer les cookies depuis les réglages de votre navigateur ; la langue et la session devront alors être choisies à nouveau à la prochaine visite.",
     "s4Title": "4. Contact",
     "s4Text": "Pour toute question sur cette politique : infos@cizagroup.com.",
   },
 },
 "alerts": {
   "messageLateRent": "Loyer en retard — échéance {month}, restant {amount} {currency}",
   "messageLeaseEnd": "Fin de bail {threshold} — {date}",
   "messageVacancy": "Appartement vacant depuis {days} jours — {number}",
   "messageLeaseStarting": "Bail démarrant demain — {date}",
   "messageTrialEnd": "Fin de l'essai {threshold} — {date}",
 },
}

EN = {
 "nav": {
   "home": "Home",
   "pricing": "Pricing",
   "contact": "Contact",
   "privacy": "Privacy",
   "terms": "Terms of use",
   "legalNotice": "Legal notice",
   "cookies": "Cookies",
 },
 "common": {
   "retry": "Try again",
   "language": "Language",
   "backToHome": "Back to home",
   "rights": "© 2026 CizaImmo, a division of Ciza Group. All rights reserved.",
 },
 "landing": {
   "ctaTrial": "Start the free 30-day trial",
   "howTitle": "How it works",
   "howStep1Title": "1. Create your portfolio",
   "howStep1Text": "Add your buildings and apartments in minutes, with their rents and currencies.",
   "howStep2Title": "2. Track your rents",
   "howStep2Text": "Record the payments you receive, get numbered PDF receipts, and be alerted when a rent is late.",
   "howStep3Title": "3. Steer your profitability",
   "howStep3Text": "Occupancy, collection, arrears and ROI: your four indicators, in each property's currency.",
   "currenciesTitle": "Your currencies, shown the way you use them",
   "currenciesText": "Every rent is recorded in its original currency. Totals are converted with a dated rate, never presented as a live rate.",
   "currenciesList": "USD · EUR · BIF · CAD · GBP · XAF · XOF · KES · TZS · RWF · UGX · BRL",
   "previewTitle": "Your dashboard, at a glance",
   "previewText": "Occupancy, this month's collection, arrears and ROI — with each property's original amount next to its conversion.",
   "previewCurrencyLabel": "Display currency",
   "previewNote": "Display example: the currency selector open, with $ USD, € EUR and BIF.",
   "benefitsTitle": "What CizaImmo does for you",
   "benefitOccupancy": "Occupancy",
   "benefitOccupancyText": "Your occupied, vacant and soon-to-be-free apartments, building by building.",
   "benefitCollection": "Collection",
   "benefitCollectionText": "Every due date tracked month by month, with no duplicates, pro-rated for the first and last month.",
   "benefitReceipts": "Receipts",
   "benefitReceiptsText": "A numbered PDF receipt for every declared payment, to download or resend.",
   "benefitRoi": "ROI",
   "benefitRoiText": "Real profitability on the property's value, with net margin shown separately.",
 },
 "pricingPage": {
   "title": "Pricing",
   "subtitle": "A subscription based on your blocks. Two price lists, shown separately: Africa or International, depending on your account's country at sign-up.",
   "africaTitle": "Africa price list",
   "africaNote": "For accounts whose country is in Africa. Monthly prices in US dollars (USD).",
   "internationalTitle": "International price list",
   "internationalNote": "For accounts outside Africa. Monthly prices in US dollars (USD).",
   "trialTitle": "Free 30-day trial",
   "trialText": "All Pro plan features for 30 days, no bank card required. The trial starts when you confirm your email.",
   "paymentTitle": "How to pay your subscription",
   "paymentCard": "By bank card (Stripe) — secure online payment.",
   "paymentMobileMoney": "By mobile money — EcoCash, Lumicash, eNoti. Your subscription is activated only after the payment is confirmed.",
   "paymentNote": "CizaImmo never collects rent: the subscription is the product's only payment.",
   "chooseCta": "Choose this plan",
   "gridLabel": "Price list",
   "annualNote": "Monthly subscription. Cancel at the end of the period; upgrades apply immediately, downgrades at the end of the period.",
 },
 "contact": {
   "title": "Contact / Demo",
   "subtitle": "A question, a demo? Write to us — we answer in French or English.",
   "demoTitle": "Request a demo",
   "demoText": "Tell us how many properties you manage: we will prepare a demo suited to your portfolio.",
   "name": "Name",
   "email": "Email",
   "phone": "Phone / WhatsApp",
   "propertiesCount": "Number of properties",
   "propertiesCountHint": "Buildings or apartments you manage (approximate).",
   "message": "Message",
   "messagePlaceholder": "Your question or demo request…",
   "send": "Send the request",
   "sending": "Sending…",
   "sentTitle": "Request sent — thank you!",
   "sentText": "Your message has been sent to the CizaImmo team. We will reply to the email address you provided.",
   "sendFailed": "Sending failed. Check your connection and try again, or email us directly.",
   "nameRequired": "Please enter your name.",
   "emailRequired": "Please enter your email.",
   "emailInvalid": "This email address does not look valid.",
   "messageRequired": "Please write your message.",
   "propertiesRequired": "Please enter the number of properties (0 if you do not manage any yet).",
   "whatsappTitle": "Prefer WhatsApp?",
   "whatsappText": "Message us directly on WhatsApp: +1 514 502 9503.",
   "whatsappButton": "Open WhatsApp",
   "emailTitle": "By email",
   "emailText": "infos@cizagroup.com",
   "mailtoTitle": "Send by email",
   "mailtoText": "Direct form sending is not configured on this installation: your message will open in your email app, addressed to infos@cizagroup.com.",
   "mailtoButton": "Open my email app",
   "noDataNote": "No portfolio data is requested here — only your contact details so we can reply.",
 },
 "footer": {
   "tagline": "Your properties, managed simply.",
   "contactEmail": "infos@cizagroup.com",
   "languageLabel": "Language",
 },
 "legal": {
   "common": {
     "noRentCollection": "CizaImmo never collects rent and never holds money on behalf of third parties. Only payments declared by the owner or the manager are recorded.",
     "dataOwnership": "Your portfolio data (buildings, apartments, tenants, rents, documents) belongs to you. CizaImmo never sells it, never shares it, and never uses it for any purpose other than running the service.",
     "retention90": "After your subscription ends, your data stays available read-only for 90 days, then is deleted. No data is deleted during the subscription or the trial.",
     "contactLine": "Contact: infos@cizagroup.com — Ciza Group SURL, RC 0082870/26, NIF 4003446905 — 6ème Avenue N° 47, Quartier Buhomba, Zone Mutimbuzi, Commune Ntahangwa, Bujumbura, Burundi.",
     "updated": "Last updated: November 2026.",
   },
   "privacy": {
     "title": "Privacy policy",
     "intro": "This policy explains what data CizaImmo collects, why, and what your rights are. It applies to cizaimmo.com and to the CizaImmo app.",
     "s1Title": "1. Data we collect",
     "s1Text": "Your account: name, email, country, main currency and language. Your portfolio: buildings, apartments, tenants, leases, declared rents, expenses and documents you upload. Your messages: the content of contact and demo-request forms.",
     "s2Title": "2. Why we use it",
     "s2Text": "To run the service: show your portfolio, compute your indicators (occupancy, collection, arrears, ROI), generate your receipts and your alerts. To reply when you contact us. Nothing else.",
     "s3Title": "3. Sharing data",
     "s3Text": "Your data is never sold or shared with third parties for commercial purposes. It is hosted by our technical providers (app hosting and database), who can only access it to run the service. Subscription payments are processed by Stripe (card) or by your mobile-money operator: CizaImmo never sees or stores your card numbers.",
     "s4Title": "4. Retention",
     "s4Text": "Your data is kept while your account is active. After your subscription ends, it stays available read-only for 90 days, then is deleted. You can request deletion of your account at any time by email.",
     "s5Title": "5. Your rights",
     "s5Text": "You can view, correct and export your data from the app, and request its deletion by writing to infos@cizagroup.com. You can also revoke a manager's or a co-owner's access at any time: access is revoked immediately.",
     "s6Title": "6. Security",
     "s6Text": "Access to your portfolio is protected by your password (two-factor authentication offered in settings) and by database-level rules: one account can never read or change another account's data, even by editing a page address.",
   },
   "terms": {
     "title": "Terms of use",
     "intro": "By creating a CizaImmo account, you agree to these terms. If you do not agree, do not use the service.",
     "s1Title": "1. The service",
     "s1Text": "CizaImmo is an online property-management software: buildings and blocks, apartments, tenants, declared rents, expenses, documents and profitability. The service is provided in French and English, on the web and on phones.",
     "s2Title": "2. Subscription and free trial",
     "s2Text": "Sign-up opens a free 30-day trial with the Pro plan's features, no bank card required; the trial starts when you confirm your email. When the trial ends, access becomes read-only until a subscription is active: you can still view and export your data, but no longer enter anything. The subscription is paid by bank card (Stripe) or by mobile money (EcoCash, Lumicash, eNoti); it is activated only after the payment is confirmed. Upgrades apply immediately; downgrades and cancellations take effect at the end of the period.",
     "s3Title": "3. CizaImmo never collects rent",
     "s3Text": "CizaImmo never collects rent and never holds money on behalf of third parties. The product is funded 100% by subscription. It only records payments declared by the owner or the manager. CizaImmo does not distribute money between co-owners either: co-ownership only shows the calculated income split.",
     "s4Title": "4. Your responsibilities",
     "s4Text": "You are responsible for the accuracy of the data you enter (rents, leases, declared payments) and for keeping your password confidential. You must not enter illegal data, nor try to access another account's portfolio.",
     "s5Title": "5. Limits of the service",
     "s5Text": "The exchange rates shown are dated reference rates from an external service; they are not a live rate and are never presented as one. The “apartments for rent” showcase is a listings service: CizaImmo takes no booking and no online payment; contact is made directly with the owner or the manager.",
     "s6Title": "6. Termination and retention",
     "s6Text": "You can cancel at any time: access stays active until the end of the paid period, then becomes read-only for 90 days before data is deleted. CizaImmo may suspend an account in case of a serious breach of these terms, after informing you.",
   },
   "notice": {
     "title": "Legal notice",
     "intro": "Legal information about the publisher of cizaimmo.com and the CizaImmo app.",
     "s1Title": "1. Publisher",
     "s1Text": "Ciza Group SURL — RC 0082870/26 — NIF 4003446905 — 6ème Avenue N° 47, Quartier Buhomba, Zone Mutimbuzi, Commune Ntahangwa, Bujumbura, Burundi. Email: infos@cizagroup.com. CizaImmo is a division of Ciza Group.",
     "s2Title": "2. Hosting",
     "s2Text": "App hosted by Vercel Inc. Data hosted by Supabase Inc. (database and document storage, private access via signed, temporary links only).",
     "s3Title": "3. Intellectual property",
     "s3Text": "The CizaImmo name, logo and site content belong to Ciza Group SURL. Your portfolio data belongs to you: CizaImmo claims no rights over it.",
     "s4Title": "4. Contact",
     "s4Text": "For any question: infos@cizagroup.com or WhatsApp +1 514 502 9503.",
   },
   "cookies": {
     "title": "Cookie policy",
     "intro": "CizaImmo only uses cookies that are strictly necessary to run the service. No advertising cookies, no tracking for marketing purposes.",
     "s1Title": "1. What we use",
     "s1Text": "Chosen language (French or English), sign-in session and demo session, display preferences. These cookies are essential: without them, the app cannot recognise you or keep your language.",
     "s2Title": "2. What we do not use",
     "s2Text": "No advertising cookies, no cross-site tracking cookies, no sale of browsing data. Visit statistics, when they exist, are aggregated and anonymous.",
     "s3Title": "3. Control",
     "s3Text": "You can delete cookies from your browser settings; the language and session will then need to be chosen again on your next visit.",
     "s4Title": "4. Contact",
     "s4Text": "For any question about this policy: infos@cizagroup.com.",
   },
 },
 "alerts": {
   "messageLateRent": "Late rent — due {month}, remaining {amount} {currency}",
   "messageLeaseEnd": "Lease ending {threshold} — {date}",
   "messageVacancy": "Apartment vacant for {days} days — {number}",
   "messageLeaseStarting": "Lease starting tomorrow — {date}",
   "messageTrialEnd": "Trial ending {threshold} — {date}",
 },
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
print(f"i18n module 7 : parité OK ({len(kf)} clés)")
