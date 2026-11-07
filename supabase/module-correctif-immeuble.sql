-- ============================================================================
-- CizaImmo — Correctif « premier immeuble en réel » (2026-11-07).
--
-- Symptôme (vécu par la première cliente réelle, CIM-000002) : la
-- création de son premier immeuble échouait avec le bandeau générique
-- « Une erreur est survenue », alors que tout le reste (inscription,
-- dossier, approbation, essai Starter) fonctionnait.
--
-- Cause : le payload d'insert d'un immeuble contient TOUJOURS les
-- colonnes du passeport « date_estimation » et « mode_acquisition »
-- (components/ImmeubleForm.tsx -> lib/data/real.ts, spread intégral).
-- Ces colonnes ne sont créées QUE par la section « Module 6 » en fin
-- de supabase/schema.sql ; aucun module ultérieur (v1.3 -> v1.6) ne
-- les ajoute. Si cette section n'a pas été appliquée à la base, le
-- rejet est total : PostgREST répond PGRST204 (colonne absente du
-- cache de schéma) et l'application affiche l'erreur générique.
-- Même exposition pour les autres colonnes définies uniquement par
-- cette section et écrites par le code : coproprietaires.statut,
-- alertes.whatsapp_statut, preferences_notifications.canal_whatsapp.
--
-- Ce module est IDEMPOTENT (add column if not exists, create or
-- replace, drop policy if exists) : il aligne la base sur le code,
-- sans rien changer si tout est déjà en place. Il réaffirme aussi,
-- à l'identique de module-v14.sql, la garde d'écriture et les
-- politiques d'ÉCRITURE de la table immeubles.
--
-- APRÈS APPLICATION : lire les résultats de la section 4
-- (vérifications) — la requête d'anomalies de garde doit retourner
-- ZÉRO ligne.
-- ============================================================================

-- --- 1. Colonnes de la section « Module 6 » de schema.sql --------------------
-- (formulations reprises à l'identique de schema.sql)

-- immeubles : passeport — date de la dernière estimation + mode d'acquisition
alter table if exists public.immeubles
  add column if not exists date_estimation date;
alter table if exists public.immeubles
  add column if not exists mode_acquisition text;

-- immeubles : quartier (v1.6 — déjà vérifié présent, rappel inoffensif)
alter table if exists public.immeubles
  add column if not exists quartier text;

-- coproprietaires : statut de l'invitation (invite -> actif)
alter table if exists public.coproprietaires
  add column if not exists statut text not null default 'invite'
  check (statut in ('invite', 'actif'));

-- alertes : statut d'envoi WhatsApp (jamais de faux envoi)
alter table if exists public.alertes
  add column if not exists whatsapp_statut text not null default 'non_configuré'
  check (whatsapp_statut in ('non_configuré', 'envoye', 'echec', 'desactive'));

-- preferences_notifications : canal WhatsApp (spec §10)
alter table if exists public.preferences_notifications
  add column if not exists canal_whatsapp boolean not null default true;

-- profils : téléphone / WhatsApp (déjà ajouté par module-v13.sql, rappel)
alter table if exists public.profils
  add column if not exists telephone text;

-- --- 2. Garde d'écriture v1.4 — réaffirmée à l'identique ---------------------
-- Vrai si l'abonnement LE PLUS RÉCENT du propriétaire autorise
-- l'écriture : actif sans échec ; actif + échec + grâce en cours ;
-- essai dont la fin n'est pas atteinte. Faux sinon (dont aucun abo).
create or replace function public.abonnement_permets_ecriture(p_owner uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((
    select case
      when a.statut = 'actif' and not a.echec_paiement then true
      when a.statut = 'actif' and a.echec_paiement
           and a.grace_ends_at is not null and a.grace_ends_at > now() then true
      when a.statut = 'essai'
           and a.trial_ends_at is not null and a.trial_ends_at > now() then true
      else false
    end
    from public.abonnements a
    where a.owner_id = p_owner
    order by a.created_at desc
    limit 1
  ), false);
$$;

-- --- 3. Politiques d'ÉCRITURE des immeubles — à l'identique de v1.4 ----------
drop policy if exists immeubles_insert_owner on public.immeubles;
create policy immeubles_insert_owner on public.immeubles
  for insert with check (
    owner_id = auth.uid()
    and public.abonnement_permets_ecriture(owner_id)
  );
drop policy if exists immeubles_update on public.immeubles;
create policy immeubles_update on public.immeubles
  for update using (
    (public.est_proprietaire_immeuble(id) or public.est_gestionnaire_immeuble(id))
    and public.abonnement_permets_ecriture(public.proprietaire_immeuble(id))
  )
  with check (
    (public.est_proprietaire_immeuble(id) or public.est_gestionnaire_immeuble(id))
    and public.abonnement_permets_ecriture(public.proprietaire_immeuble(id))
  );
drop policy if exists immeubles_delete_owner on public.immeubles;
create policy immeubles_delete_owner on public.immeubles
  for delete using (
    owner_id = auth.uid()
    and public.abonnement_permets_ecriture(owner_id)
  );

-- --- 4. VÉRIFICATIONS (à lire après application) ------------------------------
-- 4a. Les colonnes du passeport et du Module 6 doivent toutes apparaître.
select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'immeubles' and column_name in ('date_estimation', 'mode_acquisition', 'quartier'))
     or (table_name = 'coproprietaires' and column_name = 'statut')
     or (table_name = 'alertes' and column_name = 'whatsapp_statut')
     or (table_name = 'preferences_notifications' and column_name = 'canal_whatsapp'))
 order by table_name, column_name;

-- 4b. Anomalies de garde : abonnements en ESSAI non expiré pour
-- lesquels la garde refuserait l'écriture. DOIT RETOURNER ZÉRO LIGNE.
select a.owner_id, a.statut, a.trial_ends_at
  from public.abonnements a
 where a.statut = 'essai'
   and a.trial_ends_at is not null
   and a.trial_ends_at > now()
   and not public.abonnement_permets_ecriture(a.owner_id);

-- 4c. Les trois politiques d'écriture des immeubles, branchées sur la garde.
select policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename = 'immeubles'
   and policyname in ('immeubles_insert_owner', 'immeubles_update', 'immeubles_delete_owner')
 order by policyname;
