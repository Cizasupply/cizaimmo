# Correctif « 403 sur les écritures » — RLS, INSERT…RETURNING et auto-scan (2026-11-07)

Module SQL : `supabase/module-correctif-rls-insert.sql` (idempotent, à appliquer au live).
Symptôme d'origine : la création d'un immeuble par un client en mode réel échouait avec
le bandeau générique « Une erreur est survenue » — en base, un refus RLS **42501** —
alors que le même compte lisait et gérait ses biens existants sans problème.

## 1. Mécanisme prouvé en live

Protocole « rôle réel » : transactions simulées sous le JWT du compte client de test
(rôle `authenticated`, identité du client), **tout annulé par rollback** :

| Expérience | Résultat |
|---|---|
| Politiques `immeubles` (pg_policies) | toutes **PERMISSIVE** (pas de politique restrictive en cause) |
| Immeuble créé par une instruction **précédente** : `immeuble_visible(id)` | **TRUE** |
| Même ligne : `est_proprietaire_immeuble(id)` | **TRUE** |
| Même ligne : `SELECT` sous le rôle du client | **1 ligne** |
| `INSERT` **sans** RETURNING sous son JWT | **SUCCÈS** |
| `INSERT` **avec** RETURNING (chemin de l'app : `real.ts` `.insert().select().single()`) | **42501** |

Diagnostic : pendant le `RETURNING`, PostgreSQL applique la politique **SELECT** aux
lignes retournées. `immeubles_select` ne contenait qu'un terme :
`public.immeuble_visible(id)` → `est_proprietaire_immeuble` **relit `public.immeubles`
par id** (fonction `STABLE` : elle s'exécute avec le snapshot de l'instruction). La ligne
en cours d'insertion est **invisible pour ce scan** → le terme vaut FALSE → la ligne
retournée est refusée → 42501, alors que le `WITH CHECK` de l'insert
(`owner_id = auth.uid()` + garde d'écriture v1.4) est satisfait.

Le piège n'est donc ni la garde, ni un privilège manquant, ni une politique
restrictive : c'est **l'auto-scan de la table insérée par sa propre politique SELECT**,
déclenché uniquement par le `RETURNING` (un insert simple, sans lecture de retour,
ne déclenche pas l'évaluation).

## 2. Correctif racine (section 3 du module)

```sql
drop policy if exists immeubles_select on public.immeubles;
create policy immeubles_select on public.immeubles
  for select using (owner_id = auth.uid() or public.immeuble_visible(id));
```

Le terme **local à la ligne** (`owner_id = auth.uid()`) est évalué sur la ligne
elle-même, sans aucun scan : pendant le RETURNING, `owner_id` est déjà renseigné
par l'insert → TRUE immédiat. Le second terme conserve à l'identique la visibilité
gestionnaire / co-propriétaire (lignes pré-existantes, visibles au scan
d'`immeuble_visible`). Aucun élargissement d'accès : pour toute ligne pré-existante,
l'ensemble des lignes visibles est inchangé.

Le module conserve en plus, en filets idempotents : les privilèges de table
(section 1 — le dépôt n'en pose aucun), la réaffirmation SECURITY DEFINER des
fonctions de la chaîne et des autres politiques immeubles/abonnements (sections 2
et 3), et le maillon manquant des tarifs (section 4 : politique INSERT
`tarifs_insert_super_admin`, sans laquelle l'UPSERT de `mettreAJourTarifs` est
refusé malgré la politique UPDATE existante ; symétrie défensive pour
`parametres_finance`).

## 3. Balayage du même piège — toutes les tables insérées via `.insert().select()`

Critère : la visibilité de la ligne neuve pendant le RETURNING dépend-elle d'un
**scan de la table insérée elle-même**, portant sur la ligne en cours ? Croisement
exhaustif des chaînes `.insert(...).select()` de `lib/data/real.ts` (et des routes
API) avec la politique SELECT en vigueur de chaque table.

| Table | Politique SELECT évaluée | Verdict |
|---|---|---|
| **immeubles** | `immeuble_visible(id)` → auto-scan d'`immeubles` par id | **CAS RÉEL — corrigé (§2)** |
| profils | `profils_select_own` : `id = auth.uid()` | Écarté — terme local ; la ligne neuve porte `id` = uid de session |
| appartements | `immeuble_visible(immeuble_id)` | Écarté — scan de la table **parente** `immeubles`, ligne pré-existante (créée par une instruction antérieure) ; aucun auto-scan d'`appartements` |
| locataires | `owner_id = auth.uid()` en tête (+ EXISTS sur baux/appartements) | Écarté — terme local en tête |
| baux | EXISTS sur `appartements` + `immeuble_visible` du parent | Écarté — parent pré-existant |
| paiements | chaîne `loyers → baux → appartements` + `immeuble_visible` du parent | Écarté — parents pré-existants ; aucun scan de `paiements` |
| depenses | `immeuble_visible(immeuble_id)` | Écarté — parent pré-existant |
| documents | `owner_id = auth.uid()` en tête | Écarté — terme local en tête |
| taux_change | `auth.uid() is not null` | Écarté — aucun scan |
| alertes | `owner_id = auth.uid()` en tête | Écarté — terme local en tête |
| invitations_gestionnaires | politique FOR ALL `owner_id = auth.uid()` | Écarté — terme local |
| coproprietaires | `est_proprietaire_immeuble` / `est_gestionnaire_immeuble` (parents) + EXISTS sur `profils` | Écarté — aucun auto-scan de `coproprietaires` ; le créateur est le propriétaire de l'immeuble parent |
| paiements_mobile_money | politique FOR ALL `owner_id = auth.uid()` | Écarté — terme local |
| avis | `avis_plateforme` FOR ALL : `est_admin_plateforme()` (scan de `profils`, ligne de l'admin pré-existante) | Écarté — aucun scan d'`avis` |
| rattachements_gestionnaires | `gestionnaire_id = auth.uid() or proprietaire_id = auth.uid() or est_admin_plateforme()` | Écarté — termes locaux sur la ligne |
| demandes_rattachement | FOR ALL : `proprietaire_id = auth.uid() or gestionnaire_id = auth.uid()` | Écarté — termes locaux ; le créateur est le propriétaire demandeur |
| conversations | `proprietaire_id = auth.uid() or gestionnaire_id = auth.uid() or est_admin_plateforme()` | Écarté — termes locaux sur la ligne |
| messages_directs | `est_participant_conversation(conversation_id)` → scan de `conversations` | Écarté — le **parent** (le fil) pré-existe toujours : un message n'est jamais inséré dans la même instruction que la création de son fil |

Hors champ RETURNING (aucune évaluation de la politique SELECT à l'insert) :
inserts **sans** `.select()` dans `real.ts` (`abonnements`, `loyers`, `activites`,
`factures_abonnement`, `journal_audit`) ; webhooks Stripe / mobile-money
(insert `factures_abonnement` sans `.select()`, via le client `service_role` qui
contourne la RLS) ; route `taux/actualiser` (insert simple, service role lorsqu'il
est configuré). L'UPSERT des tarifs (`mettreAJourTarifs`) relève de la section 4
du module (politique INSERT manquante) ; sa politique SELECT est `using (true)`,
sans auto-scan.

## 4. Limites et points de vigilance

- Le piège est spécifique à **INSERT … RETURNING** (et, par construction, à tout
  `UPSERT … RETURNING`). Les UPDATE/DELETE portent sur des lignes pré-existantes —
  créées par des instructions antérieures, donc visibles au snapshot des scans —
  et ne sont pas concernés : les politiques d'écriture qui appellent
  `est_proprietaire_immeuble(id)` restent valides telles quelles.
- Règle à retenir pour toute future politique SELECT : **si la table peut être
  insérée avec RETURNING par l'application, la politique doit comporter un terme
  évaluable sur la seule ligne** (colonne comparée à `auth.uid()`), ou ne dépendre
  que de lignes d'autres tables garanties pré-existantes — jamais d'un scan de la
  table elle-même indexé sur la ligne neuve.
- Après application au live, rejouer le protocole « rôle réel » : l'INSERT AVEC
  RETURNING du compte client et l'upsert tarifs du fondateur doivent passer avant
  rollback (section 5 du module : contrôles `pg_policies` / `prosecdef` /
  privilèges en lecture seule).
