# Option C — Contrat de service PROPRIÉTAIRE non bloquant (2026-11-08)

Décision du fondateur (variante C du dossier
`cizaimmo-contrat-proprietaires-DECISION.md`) : chaque propriétaire
approuvé reçoit **son contrat de service PDF personnalisé**, sans que
rien ne soit bloqué. Déclinaison du flux gestionnaire v1.3 — aucun
mécanisme réinventé.

## Modèle livré

1. **À l'approbation d'un compte à intention PROPRIÉTAIRE** :
   l'e-mail de bienvenue devient `rendreBienvenueProprietaire`
   (lib/avis.ts) et emporte en pièce jointe le **contrat
   propriétaires PDF personnalisé** (`genererContratProprietairePdf`,
   lib/contrat.ts) : nom complet, Display ID, préambule entreprise
   identique au contrat gestionnaire (CIZA GROUP SURL, RC 0082870/26,
   NIF 4003446905, siège Bujumbura, représentée par Ciza Misigaro,
   Président Directeur), signature + cachet entreprise apposés
   électroniquement. Le moteur PDF est désormais partagé
   (`rendreContratPdf`) ; la génération gestionnaire est inchangée.
   Articles (famille gestionnaire, adaptée) : objet (ses propres
   immeubles), données et preuves de propriété, « CizaImmo n'encaisse
   jamais les loyers », abonnement/essai en termes généraux (**aucun
   prix codé en dur**), confidentialité, durée/résiliation +
   suppression de compte (règles v1.5). **Aucun article de clauses de
   paiement détaillé** (texte en attente de validation — insertion à
   l'étape 3) et **aucune mention de relecture par un juriste**.
   Repli non bloquant : si la génération du PDF échoue, la bienvenue
   part sans pièce jointe ; le contrat reste téléchargeable depuis
   l'espace (régénéré à la demande).
2. **NON BLOQUANT** : accès aux modules et essai démarrent à
   l'approbation exactement comme avant. Aucune garde d'écriture ne
   lit le statut du contrat propriétaire (la garde v1.4 est
   inchangée) — prouvé en test (création de locataire pendant
   « a_signer »).
3. **Cycle suivi en base** (colonnes dédiées sur `profils`, pour ne
   pas toucher au cycle gestionnaire) :
   `statut_contrat_proprietaire` : `sans_objet` → `a_signer`
   (approbation) → `signe_depose` (redépôt du signé depuis l'espace,
   même point d'entrée que le gestionnaire : page « Mon contrat »,
   document de type « contrat » du dossier) → `valide` (Admin) ou
   `refuse` (Admin, **motif obligatoire** conservé dans
   `motif_contrat_proprietaire`). Après un refus, le propriétaire
   voit le motif et peut redéposer une copie corrigée (retour à
   `signe_depose`, motif effacé). Validation et refus envoient un
   e-mail au propriétaire et sont journalisés
   (`contrat_proprietaire_valide` / `contrat_proprietaire_refuse`,
   libellés ajoutés au journal console).
4. **Console** : la page Dossier d'un propriétaire affiche la ligne
   « Contrat propriétaire » (+ le motif si refusé) et, quand le
   statut est `signe_depose`, une bannière de revue avec **Valider**
   et **Refuser** (champ motif) — même patron que la revue du
   contrat gestionnaire.
5. **Espace propriétaire** : entrée « Mon contrat » ajoutée pour
   l'intention propriétaire ; la page /contrat affiche la section
   dédiée (`SectionContratProprietaire`) : statut, explication,
   note « non bloquant », téléchargement du PDF, dépôt du signé,
   motif de refus le cas échéant. La section gestionnaire (verrou
   des fonctions) ne s'affiche plus pour un propriétaire.
6. **Rétroactivité Kaneza (CIM-000002, déjà approuvée)** : le SQL
   bascule à `a_signer` tous les propriétaires déjà approuvés
   (abonnement né, hors `en_attente`/`annule`) — son contrat devient
   disponible dans SON compte (téléchargement + dépôt) et son statut
   apparaît dans son Dossier console. **Aucun e-mail de rattrapage.**
   Miroir démo : la graine pose `a_signer` sur le profil principal et
   les propriétaires du registre déjà approuvés.

## SQL à appliquer au live (NON appliqué par cette livraison)

`supabase/module-contrat-proprietaire.sql` — colonnes + CHECK des 5
statuts + backfill rétroactif + vérifications V1→V4 en commentaires
(dont V4 : le cas Kaneza CIM-000002 doit ressortir à `a_signer`).
Aucune politique RLS nouvelle : les politiques `profils` existantes
couvrent déjà lectures et mises à jour du titulaire et de la
plateforme (le cycle gestionnaire v1.3 repose dessus).
**À appliquer APRÈS le push du code** (le code lit les nouvelles
colonnes ; sans le SQL, l'espace connecté réel échouerait sur les
sélections de profils qui les mentionnent — en pratique les
sélections sont en `select` explicite dans listerComptes/valider/
refuser et le profil complet transite par le mapping existant :
appliquer le SQL dans la même fenêtre que le déploiement).

## Vérifications

- Nouveau bloc `scripts/test-contrat-proprietaire.cjs` (**34 OK /
  0 KO**) : PDF FR/EN personnalisé, bienvenue + pièce jointe à
  l'approbation, essai démarré, écritures libres pendant le cycle,
  dépôt → refus motivé → redépôt → validation (+ erreurs
  ERR_MOTIF_REQUIS / ERR_STATUT_INVALIDE), rétroactivité démo sans
  e-mail, statique SQL/surfaces, aucun « juriste ».
- Adaptation documentée d'un bloc antérieur : compteurs de lignes
  de la carte Identité du Dossier console (11→13 lignes, 12→14
  libellés) — les 2 lignes ajoutées suivent le patron exact du
  correctif mobile (flex-wrap, min-w-0, shrink-0).
- Suite complète : **VERTE (exit 0)** ; parité i18n **1842 = 1842**
  (+40 clés : namespace `contratProp`, clés console, libellés
  d'audit, ERR_MOTIF_REQUIS) ; contrôle des clés utilisées OK.
- Build Next : OK.
