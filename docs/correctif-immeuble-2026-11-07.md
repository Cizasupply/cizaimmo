# Correctif « premier immeuble en réel » — 2026-11-07

## Symptôme (production)

La première cliente réelle (Kaneza Rehema, CIM-000002, approuvée,
essai Starter actif) crée son premier immeuble : la soumission échoue
avec le bandeau générique « Une erreur est survenue. Réessayez dans
un instant. » — et le bouton de soumission affiche la clé brute
`crud.common.create` au lieu de « Créer ».

## Causes

1. **i18n (certaine)** — `crud.common.create` absente de
   `messages/fr.json` ET `messages/en.json` : next-intl affiche la
   clé brute. Six pages de création sont touchées (immeubles,
   appartements, baux ×2, locataires, dépenses), plus
   `crud.receipts.resendWhatsAppApi` sur la page reçus. Le contrôle
   historique (`i18n-check.py`) ne vérifiait que la parité FR↔EN des
   clés définies — les deux fichiers manquaient la clé de la même
   façon, donc rien ne sonnait l'alarme.

2. **Base (racine de l'échec d'écriture)** — l'insert d'un immeuble
   envoie TOUJOURS `date_estimation` et `mode_acquisition`
   (`ImmeubleForm` → `lib/data/real.ts`, spread intégral du payload).
   Ces deux colonnes ne sont créées QUE par la section « Module 6 »
   en fin de `supabase/schema.sql` ; aucun module ultérieur ne les
   ajoute (contrairement à `profils.telephone`, couvert par v1.3, et
   `immeubles.quartier`, couvert par v1.6 et vérifié en base). Si la
   section Module 6 n'a pas été appliquée, PostgREST rejette
   l'insert : PGRST204 — erreur brute que `messageErreur` ne connaît
   pas, d'où le bandeau générique. Le chemin client et la garde
   d'écriture v1.4 (qui autorise explicitement un essai non expiré)
   ont été revérifiés ligne par ligne : ils sont sains.
   Même exposition pour `coproprietaires.statut`,
   `alertes.whatsapp_statut` et
   `preferences_notifications.canal_whatsapp`, définies par la même
   section et écrites par le code.

## Correctifs livrés

- `messages/fr.json` / `messages/en.json` : `crud.common.create`
  (« Créer » / « Create ») et `crud.receipts.resendWhatsAppApi`
  (« Renvoyer par WhatsApp (API) » / « Resend via WhatsApp (API) »).
- `supabase/module-correctif-immeuble.sql` : idempotent — ajoute les
  colonnes de la section Module 6 (formulations de schema.sql),
  réaffirme la garde `abonnement_permets_ecriture` et les politiques
  d'écriture des immeubles à l'identique de v1.4, et se termine par
  des requêtes de vérification (la requête d'anomalies de garde doit
  retourner zéro ligne). **À appliquer à la base live** (morceau prêt
  dans `~/workspace/cizaimmo-sql-correctif-immeuble/`).
- `lib/translateError.ts` : une erreur non reconnue est désormais
  journalisée dans la console du navigateur (diagnostic), le message
  utilisateur reste le générique.
- Régression : `scripts/i18n-cles-utilisees.py` (balayage complet
  des clés UTILISÉES dans le code vs messages, résolution
  positionnelle des namespaces) et
  `scripts/test-correctif-immeuble.cjs`, branchés dans
  `scripts/run-tests.sh`. Suite complète verte, build OK.

## Preuve finale attendue

Après application du SQL à la base : la cliente (ou un test) recrée
un immeuble — la création doit aboutir sur la page du bien, avec le
bouton libellé « Créer ».
