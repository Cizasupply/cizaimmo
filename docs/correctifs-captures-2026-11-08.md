# Passe corrective — captures du fondateur (2026-11-08)

Neuf points issus des captures d'écran du fondateur sur son téléphone
(points 1-6 : passe initiale ; point 7 : ajout « l'employé n'a pas pu
téléverser son contrat signé » ; point 8 : ajout « le sous-admin n'a
pas le droit de voir les paies de tous les employés » ; point 9 :
ajout « journal : fonction lu/archivé + pagination »). Périmètre
strict : aucun autre comportement n'est touché.

## Point 1 — Cartes appartements de la Vitrine (mobile)

`app/[locale]/vitrine/page.tsx` : le conteneur de la carte passe en
`flex flex-col` sur mobile (titre pleine largeur, bouton « Demander
la publication » en dessous) et ne redevient horizontal qu'à partir
de `sm:`. Les mots coupés (« Bujumbur-a », « Descripti-on »)
disparaissent : les textes étaient déjà en `break-words`, c'est la
colonne étroite imposée par le bouton qui forçait les coupures.
Bureau inchangé.

## Point 2 — En-tête public (mobile)

`components/PublicHeader.tsx` : sous 400 px, la rangée de navigation
réduit ses écarts (`gap-x-1`, `text-[11px]`) — les 4 liens restent
sur une ligne, comme validé. La rangée des boutons passe en `min-w-0`
avec libellés `whitespace-nowrap` et padding réduit sous 400 px :
« Se connecter » et « Essai gratuit » ne débordent plus, « Contact »
n'est plus coupé.

## Point 3 — Audit : aucun code technique visible

Formateur partagé `lib/format.ts` :

- `ACTIONS_AUDIT` : inventaire des 44 actions réellement journalisées
  dans le code (balayage complet : appels `journaliserAudit` côté TS
  + insertions `journal_audit` côté SQL/fournisseurs). Chacune a son
  libellé FR + EN dans `messages/*.json` (`console.audit.*`), dont les
  16 manquantes ajoutées par cette passe (assignation, contrat
  employé préparé/déposé/refusé/validé, charte acceptée, accès admin
  modifié, rôle admin retiré, suppression demandée/annulée/exécutée,
  consultation des messages, vitrine approuvée/refusée/publication).
- `actionAuditConnue()` : toute action hors inventaire retombe sur le
  libellé générique « Autre action enregistrée » — jamais la clé
  brute `console.audit.…` qu'affichait next-intl.
- `formatCibleAudit()` : la cible affiche l'e-mail quand il existe ;
  pour une dépense plateforme, « libellé — montant formaté » tiré des
  détails ; sinon « — ». **Jamais un UUID seul.**
- Branché sur les trois surfaces : Journal (`console/journal`),
  Activité récente (`console/page.tsx`), historique du dossier d'un
  compte (`console/comptes/[id]`).

## Point 4 — Finances plateforme : destinations sans débordement

`console/finances-plateforme/page.tsx` : le bloc de droite des cartes
membres passe en `min-w-0` (au lieu de `shrink-0`), les destinations
composées (« Virement — BCB, agence Rohero — compte …, SWIFT … — nom »)
passent en `break-words` (carte membre + historique), et les montants
sont verrouillés en `whitespace-nowrap`. Plus aucun défilement
horizontal de page.

## Point 5 — « Ma paie » : le « 400000 » brut

**Nuance trouvée à l'exploration** : le « 400000 » brut des captures
n'est pas le montant (celui-ci est formaté, en gras : « 400 000 BIF »)
mais la **référence libre** de la paie, affichée telle quelle dans la
ligne de détail. Correctif : `formatReferencePaie()` (lib/format.ts)
— une référence purement numérique (4 à 15 chiffres, sans zéro
initial) est groupée par milliers selon la locale ; toute autre
référence (alphanumérique, code interne) reste inchangée. Appliquée
aux trois rendus : « Ma paie » (Mon dossier), carte membre et
historique des Finances.

## Point 6 — Contrats PDF aux deux logos

Nouveau module partagé `lib/logos-pdf.ts` (chargeur des deux logos,
réduction canvas 512 px — patron du talon de paie). Les générateurs
`lib/contrat.ts` (gestionnaire + propriétaire) et
`lib/contrat-employe.ts` reçoivent un paramètre optionnel `images` :
bandeau marine en tête portant le logo CizaImmo (recadré compact) à
gauche et le logo Ciza Group (or, transparent) à droite, ligne
Dossier/Display ID centrée entre les deux. Sans logos chargeables
(hors navigateur), repli sur l'en-tête texte historique. **Textes des
contrats strictement inchangés**, cycle de signature/dépôt inchangé.
Test : génération réelle des trois PDF — les deux images sont
vérifiées dans le PDF (largeurs natives 820 et 2000 px).

## Point 7 — Dépôt du contrat employé signé : CAUSE RACINE DOUBLE

Symptôme exact du fondateur : « quand tu cliques sur le bouton, il
ne réagissait pas » — aucun sélecteur, aucun message.

**(a) Le bouton mort (cause du symptôme)** —
`components/DocumentUpload.tsx` ouvrait le sélecteur par un clic
programmé (`inputRef.current?.click()`) sur un `<input type="file">`
en `display:none` (`className="hidden"`). iOS Safari ignore les
clics programmés sur un input fichier `display:none` : ni sélecteur
ni erreur — le bouton semblait mort, précisément sur iPhone.
**Correctif** : activation NATIVE du navigateur — `<label htmlFor>`
+ `useId()` (id désinfecté), input en `sr-only` (présent mais
invisible visuellement). Le clic ouvre le sélecteur dans tous les
statuts où le dépôt est permis. Bénéficie à tous les usages de
DocumentUpload (pièces, justificatifs, contrat).

**(b) Le HEIC refusé partout (barrière suivante)** — une fois le
sélecteur ouvert, la photo native de l'iPhone (HEIC) était rejetée
par toutes les listes de formats (accept=, validation du composant,
fournisseurs réel et démo), alors que le bucket `documents-prives`
n'a **aucune** restriction de type (ni `allowed_mime_types`, ni la
politique INSERT, qui ne borne que le préfixe `<uid>/` du chemin —
respecté par le flux). **Correctif** : liste partagée
`EXTENSIONS_DOCUMENT_ACCEPTEES = [pdf, jpg, jpeg, png, heic, heif]`
+ MIME `image/heic` / `image/heif` (`lib/data/types.ts`), consommée
par les deux fournisseurs et le composant ; mentions de formats
mises à jour FR + EN. Les flux photo (photo de profil, photos
d'immeuble) ne sont volontairement pas étendus.

Garde de statut inchangée (dépôt permis en `a_signer` / `refuse`
seulement) ; l'erreur de statut est désormais traduite côté page
(`dossierEmploye.errorContractStatus`) et, le contrat une fois
« validé », la section affiche une note dédiée au lieu de proposer
un téléversement voué à échouer.

**Hors périmètre (signalé, non touché)** : `ImmeubleForm` utilise le
même patron de clic programmé sur input `display:none` pour les
photos d'immeuble — même risque de bouton mort sur iPhone, à traiter
dans une passe dédiée si le fondateur le demande.

## Point 8 — Périmètre PAIES de la vue Finances

**Constat : le filtre existait DÉJÀ dans les deux fournisseurs**
(miroir du périmètre dépenses verrouillé au commit précédent) :
pour un Admin (non Super), les lignes de paie sont filtrées sur son
propre id, l'historique est contraint `profil_id = acteur`, et les
totaux du mois sont calculés depuis ces listes filtrées — aucune
paie d'un autre employé ne fuit, ni en lignes, ni en historique, ni
en totaux. Le talon d'un autre était déjà refusé
(`ERR_TALON_INTROUVABLE`) des deux côtés.

Fait dans cette passe : commentaires « PÉRIMÈTRE PAIES (fondateur,
2026-11-08, point 8) » aux points de verrouillage (réel + démo) et
**tests dédiés** qui verrouillent le comportement :

- Démo (trois membres payés le même mois) : chaque Admin ne voit que
  sa ligne, son historique et ses totaux (500 000 / 450 000 BIF) ; le
  Super Admin voit les 3 paies (total 1 850 000 BIF) ; talons croisés
  refusés. Note démo : un seul profil client promouvable y est
  modélisé (id partagé) — le « second Admin » du test est l'employé
  du point 7, déjà validé.
- Réel contraint (comptes de test existants) : l'Admin ne voit que sa
  paie de 500 000 BIF (ligne, historique, totaux) ; le Super Admin
  voit les deux (1 400 000 BIF). Aucun compte réel supplémentaire
  n'a été créé.

## Point 9 — Journal : lu / archivé + pagination

**Architecture** : la table `journal_audit` est append-only — les
marqueurs ne vivent PAS sur les entrées. Nouveau module SQL
idempotent **`supabase/module-journal-lecture.sql`** : table latérale
`journal_lecture` (`entree_id` PK → `journal_audit(id)`, `lu_le`,
`archive_le`, `par`, `maj_le`), RLS **Super Admin seul** en lecture
comme en écriture (`est_super_admin()`), cohérente avec le
verrouillage de lecture du journal. Aucune écriture existante au
journal n'est altérée. **SQL à appliquer au live par le fondateur**
(le fournisseur réel lit l'état en tolérant l'absence de la table :
le journal reste lisible avant application, sans état).

Fournisseurs (réel + démo, garde Super Admin partout) :
`listerJournalAudit` fusionne l'état (`lu`, `archive` sur
`EntreeAudit`) ; nouvelles actions `marquerEntreesAuditLues(ids?)`
(sans ids = toutes), `archiverEntreeAudit`,
`desarchiverEntreeAudit`, `archiverEntreesAuditLues()` (retourne le
nombre d'entrées archivées).

Page Journal : pastille « Nouveau » sur les non-lues, bouton par
entrée (Marquer comme lu / Archiver / Désarchiver), « Tout marquer
comme lu », « Archiver les lues », onglets Liste principale /
Archivées, et **pagination 20/page** (`paginerListe`, fonction pure
de lib/format.ts) composée APRÈS les filtres existants (recherche,
Action, Acteur, Période) et la vue — précédent/suivant + compteur
« Page X / Y », retour page 1 à chaque changement de filtre ou de
vue.

## Tests

- `scripts/test-correctifs-captures.cjs` (nouveau, 57 contrôles) :
  statiques par point, runtime du formateur (audit, références,
  pagination), génération réelle des 3 PDF, flux démo complets
  (dépôt HEIC, périmètre paies ×3 membres, journal lu/archivé +
  pagination + refus Admin).
- `scripts/test-finances-reel.cjs` : section « périmètre paies réel »
  ajoutée (fournisseur réel contraint).
- Suite complète verte ; build OK.
