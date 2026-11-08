# Verrouillages Super Admin seul — « Vérifier un employé » + Journal d'audit (2026-11-08)

Décisions du fondateur, le même jour, en deux temps : d'abord
« Vérifier un employé » (« le sous-admin n'en a pas besoin »),
puis, dans la foulée, le Journal d'audit (« même traitement »).
Les deux surfaces de LECTURE passent **Super Admin uniquement** ;
un Admin reçoit partout le même refus propre.

## 1. « Vérifier un employé »

- **Menu** : entrée `verifyEmployee` (`/console/verifier-employe`)
  en `superSeul: true` dans `components/ConsoleShell.tsx` —
  invisible pour un Admin (barre latérale et panneau « Plus »).
- **Fournisseurs (réel + démo)** :
  - `verifierEmploye(displayId)` exige le super_admin
    (`acteurSuperAdmin`) → `ERR_SUPER_ADMIN_REQUIS` pour un Admin ;
    un client reçoit toujours `ERR_ACCES_PLATEFORME`.
  - `listerEquipeAdmins()` — la fonction qui alimente la liste +
    recherche de la page (et la page Équipe) — reçoit la même
    garde. En démo, le corps sans garde est extrait en
    `equipeAdminsInterne(db)` pour l'usage INTERNE de la vue
    Finances de l'Admin (sa ligne, filtrée sur lui-même) :
    comportement des Finances strictement inchangé. Les autres
    consommateurs de la liste (page Équipe, modale d'assignation)
    n'étaient déjà ouverts qu'au Super Admin.
- **Page** : en accès direct par URL, un Admin voit le refus
  propre (patron de la page Suppressions : titre + encadré rouge
  `v15.superOnly`, « Cette page est réservée au Super Admin. »).
- **Super Admin** : accès complet inchangé — saisie directe,
  recherche, liste, verdict trois états identiques.

## 2. Journal d'audit

- **Menu** : entrée `journal` (`/console/journal`) en
  `superSeul: true`. La **barre inférieure mobile** suit désormais
  les mêmes règles de visibilité que le menu (filtrage par
  `liensVisibles`, nombre de colonnes dynamique) : le raccourci
  « Journal » en sort aussi pour l'Admin.
- **Fournisseurs (réel + démo)** : `listerJournalAudit()` exige le
  super_admin → `ERR_SUPER_ADMIN_REQUIS` pour un Admin. Seul
  l'ACCÈS EN LECTURE est verrouillé : **l'écriture au journal
  (`journaliserAudit`, actions de tous les rôles) est inchangée** —
  les actions des Admins continuent d'y être consignées.
- **Page journal** : même refus propre en accès direct.
- **Vue d'ensemble console** : son bloc « activité récente » lit le
  journal via `listerJournalAudit()` — l'appel reçoit le repli
  silencieux déjà utilisé par les appels voisins
  (`.catch(() => [])`) : pour un Admin, la Vue d'ensemble reste
  complète, simplement sans ce bloc ; pour le Super Admin, rien
  ne change.

## Tests

- `test-pack-employe.cjs` (67 OK) : contrôle statique du drapeau
  `superSeul` sur l'entrée « Vérifier un employé » ; Admin →
  `ERR_SUPER_ADMIN_REQUIS` sur `verifierEmploye` ET
  `listerEquipeAdmins` ; flux Super Admin et verdicts inchangés.
- `test-checklist-audit.cjs` (64 OK, nouvelle section 8) :
  contrôle statique du drapeau `superSeul` sur l'entrée
  « Journal » ; Admin → `ERR_SUPER_ADMIN_REQUIS` sur
  `listerJournalAudit` ; Super Admin → lecture inchangée.
- `test-admin-finance.cjs` (54 OK) : les vérifications d'audit
  existantes (actions accomplies par l'Admin) lisent désormais le
  journal en session Super Admin — l'écriture par l'Admin reste
  éprouvée telle quelle.
- Suite complète `bash scripts/run-tests.sh` : verte (0 KO),
  parité i18n 2 093 clés FR = EN (aucun libellé nouveau : le refus
  réutilise `v15.superOnly`). Build OK.
