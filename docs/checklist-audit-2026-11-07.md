# Checklist de vérification avant approbation + registre d'audit enrichi (2026-11-07)

Demande du fondateur : (1) l'Admin / Super Admin doit **cocher la
revue du dossier** avant de pouvoir approuver un compte en attente ;
(2) le registre consigne pour chaque action plateforme **qui**
(nom et prénom, rôle) a fait **quoi**, avec **jour et heure**.

## Partie 1 — Checklist de vérification

### Où vivent les coches (base)
- Table **`dossier_checklists`** (append-only, migration
  `supabase/module-checklist-audit.sql`) : une ligne par
  consignation (`cible_id`, `acteur_id`, 4 booléens, `created_at`) —
  **la plus récente fait foi** pour l'état courant. RLS plateforme :
  lecture réservée aux Admin / Super Admin, insertion seulement
  pour soi-même en tant qu'acteur plateforme.
- RPC **`enregistrer_checklist_dossier(cible, photo, piece, infos,
  antifraude)`** : rôle plateforme vérifié en interne (patron des
  RPC existantes), erreurs nommées `ADMIN_PLATEFORME_REQUIS`,
  `COMPTE_INTROUVABLE`, `COMPTE_NON_EN_ATTENTE`. Chaque bascule de
  case dans la console appelle la RPC avec l'état complet → la
  consignation dit **qui a coché, et quand**.
- **Garde dans `approuver_compte`** (recréée à l'identique de la
  v1.4 + un bloc) : pour un compte en attente, la dernière checklist
  doit être complète — `photo_verifiee`, `piece_coherente`,
  `infos_verifiees` toujours ; `antifraude_examinee` en plus si
  `profils.grille_statut = 'a_verifier'` — sinon l'erreur nommée
  **`CHECKLIST_INCOMPLETE`** est levée et rien ne change. Le
  **refus n'est pas gardé** (on peut refuser un dossier insuffisant
  sans l'avoir validé).

### Front (miroir)
- Page Dossier (console) : bloc « Checklist de vérification » dans
  le panneau de revue — 4 cases (anti-fraude seulement si le compte
  est signalé « à vérifier »), ligne de consignation « Consignée
  par {nom} · {date} », aide tant qu'incomplet. Bouton
  **« Approuver » désactivé tant que la revue est incomplète** ;
  refus inchangé. Le provider réel relit la checklist au chargement
  du dossier et la verse (clés plates `checklist_*`) dans le détail
  journalisé de l'approbation.
- Provider démo : même garde (`ERR_CHECKLIST_INCOMPLETE`), mêmes
  consignations (mémoire `plateforme.checklistsDossiers`), refus
  libre — comportement testé de bout en bout.

## Partie 2 — Registre d'audit enrichi

### Écriture (point commun)
- Colonne **`journal_audit.acteur_nom`** : le **nom complet de
  l'acteur est figé (snapshot)** à l'écriture — un renommage
  ultérieur du profil ne réécrit pas l'histoire. `acteur_role` et
  `created_at` (timestamptz, jour + heure) existaient déjà.
- L'enrichissement est branché dans **le helper d'écriture commun**
  des providers (`journaliserAudit`) : l'acteur plateforme y porte
  désormais son nom (depuis son profil). Tous les appelants
  existants (approbation, refus, grille, suspension, assignation,
  avis, suppressions, validations…) en bénéficient sans changement.
- Filet base : trigger **`trg_journal_audit_completer_acteur`**
  (BEFORE INSERT) — si `acteur_nom` est absent, il est complété
  depuis `profils` ; couvre les insertions des RPC base (v1.5) et
  tout futur chemin d'écriture.

### Affichage
- `lib/format.ts` gagne **`formatDateTime`** (FR « 7 nov. 2026 à
  17 h 30 » / EN « Nov 7, 2026 at 5:30 PM », heure locale de
  l'appareil).
- Historique du dossier, page Journal, activité récente du tableau
  de bord console : **« Nom Prénom — rôle — jour à heure »**. Les
  entrées anciennes sans nom retombent sur l'e-mail (comme avant).

## i18n
7 clés `console.checklist*` + `console.errors.ERR_CHECKLIST_INCOMPLETE`
(FR + EN) — parité stricte : **1 700 clés FR = 1 700 EN**, balayage
des clés utilisées relancé (`scripts/i18n-cles-utilisees.py`).

## Tests
`bash scripts/run-tests.sh` — nouveau bloc
`scripts/test-checklist-audit.cjs` (**61 vérifications**) : contenu
du module SQL, gardes et consignations des deux providers, bouton
grisé / anti-fraude conditionnelle / refus libre (statique + démo
de bout en bout), enrichissement du journal (nom figé sur
l'approbation ET sur une réattribution de grille), `formatDateTime`.
Les tests historiques qui approuvaient en démo (module 5, v1.2,
v1.3, v1.4) consignent désormais la checklist avant l'approbation,
comme le geste console réel. Suite complète verte, build OK.

## SQL live requis
**Oui** — `supabase/module-checklist-audit.sql`, en morceaux dans
`~/workspace/cizaimmo-sql-checklist/` (README avec l'ordre et les
vérifications attendues). À appliquer **après** le déploiement du
code : tant qu'il n'est pas appliqué, cocher une case en réel
renvoie une erreur générique (la RPC n'existe pas encore) ; la
garde d'approbation, elle, ne peut pas bloquer à tort.
