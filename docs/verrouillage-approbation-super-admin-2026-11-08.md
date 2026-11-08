# Verrouillage — Approbation et refus des comptes : Super Admin seul (2026-11-08)

**Décision du fondateur** : « aucune approbation de compte sans
vérification de l'abonnement / du paiement » — et à sa question « qui
validera alors le compte ? », sa réponse : **le Super Admin seul**.
Conséquence directe : la décision d'ouverture/fermeture d'accès
rejoint le reste de la chaîne argent, déjà Super Admin partout
ailleurs (tarifs et paramètres finance, émission des paies,
validation des dépenses, Équipe, suppression définitive).

## Le partage des rôles après verrouillage

- **Le sous-admin INSTRUIT le dossier** — tout lui reste ouvert :
  consultation des comptes et des dossiers complets (documents,
  pièces, preuves), **checklist de vérification** (cocher/décocher,
  consignée en base avec son nom et l'horodatage), messages aux
  clients, suspension de compte (**inchangée** par cette décision).
- **Le Super Admin DÉCIDE** : lui seul peut approuver ou refuser un
  compte client, depuis la page Dossier comme depuis les actions
  rapides de la liste Comptes.

## Ce qui a été verrouillé, à tous les étages

1. **Fournisseurs (réel + démo)** : `approuverCompte` et
   `refuserCompte` exigent le rôle super_admin (patron
   `acteurSuperAdmin`) → un Admin reçoit `ERR_SUPER_ADMIN_REQUIS`
   (déjà traduit FR/EN : « Action réservée au Super Admin. »).
2. **Interface** :
   - Page **Dossier** : la checklist reste visible et consignable
     par l'Admin ; le bloc décision (bouton Approuver, liste des
     motifs, bouton Refuser) ne s'affiche que pour le Super Admin.
     Pour un Admin, un encadré sobre s'affiche à la place (clé
     `console.decisionSuperAdminOnly`, FR/EN) : « La décision
     d'approbation ou de refus appartient au Super Admin. Vous
     instruisez le dossier (documents, checklist, messages) ; le
     Super Admin décidera. »
   - Liste **Comptes** : les actions rapides Approuver / Refuser et
     le formulaire de motif sont réservés au Super Admin ; l'Admin
     voit la même note. Les réattributions de grille (qui ne sont
     ni une approbation ni un refus) sont inchangées.
3. **Base** : l'approbation est portée par la RPC
   `public.approuver_compte`. Le nouveau module
   `supabase/module-approbation-super-admin.sql` la recrée **à
   l'identique** de sa dernière définition
   (module-checklist-audit.sql §3) avec un seul changement : la
   garde de tête passe de `est_admin_plateforme()` à
   `est_super_admin()`, erreur nommée `SUPER_ADMIN_REQUIS` (le
   fournisseur réel la traduit en `ERR_SUPER_ADMIN_REQUIS`).
   **La garde CHECKLIST_INCOMPLETE est préservée intégralement** :
   même un Super Admin — et même un appel direct à la RPC — ne
   peut pas approuver un dossier dont la revue consignée est
   incomplète.
   Le **refus**, lui, n'est porté par **aucune fonction SQL** : il
   s'écrit par mises à jour applicatives (profils + abonnements).
   Le verrou fournisseur suffit donc pour le refus ; le module SQL
   ne couvre que l'approbation, seule décision portée par une RPC.

## Tests

- **Nouveau bloc §9** dans `scripts/test-checklist-audit.cjs`
  (15 contrôles) : contenu du module SQL (garde Super Admin +
  checklist préservée), gardes des deux fournisseurs (statique),
  traduction de l'erreur RPC, conditionnement des deux interfaces,
  parité de la nouvelle clé i18n ; comportement démo : l'Admin
  consigne la checklist et consulte le dossier, ses tentatives
  d'approbation ET de refus → `ERR_SUPER_ADMIN_REQUIS` ; le Super
  Admin approuve sur la revue consignée par l'Admin (essai
  démarré) et reste soumis à la garde checklist
  (`ERR_CHECKLIST_INCOMPLETE` sans revue).
- **`scripts/test-admin-finance.cjs` adapté** : les flux
  d'approbation et de refus passent désormais par le Super Admin
  (avec assertions du refus `ERR_SUPER_ADMIN_REQUIS` côté Admin) ;
  toutes les autres vérifications (essai démarré à l'approbation,
  refus journalisé avec motif, connexion impossible après refus,
  anti-fraude) sont inchangées et vertes.
- Suite complète `bash scripts/run-tests.sh` verte, `tsc --noEmit`
  propre, `npm run build` OK, parité i18n FR = EN (2 094 clés, +1 :
  `console.decisionSuperAdminOnly`).

## Reste à faire (parent)

Appliquer au live, dans le SQL Editor Supabase (patron habituel) :

- `supabase/module-approbation-super-admin.sql` (idempotent —
  recrée `approuver_compte` avec la garde Super Admin ; vérifs
  V1–V3 en fin de fichier : la définition en base doit contenir
  `est_super_admin()`, `SUPER_ADMIN_REQUIS` ET
  `CHECKLIST_INCOMPLETE`).

Tant que ce module n'est pas appliqué, le verrou applicatif
(fournisseurs + interface) est actif, mais un appel direct à la RPC
par un Admin resterait possible côté base : appliquer le module
dans la foulée du déploiement.
