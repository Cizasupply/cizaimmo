-- ============================================================================
-- CizaImmo — Correctif « 403 sur les ecritures » (2026-11-07 soir).
-- Mecanisme SCELLE EN LIVE par le protocole « role reel » (transactions
-- simulees sous le JWT du compte client de test, tout annule par rollback) :
--   - politiques immeubles toutes PERMISSIVE ;
--   - pour un immeuble cree par une instruction PRECEDENTE :
--     immeuble_visible = TRUE, est_proprietaire_immeuble = TRUE,
--     SELECT sous le role du client = 1 ligne ;
--   - INSERT SANS RETURNING sous son JWT = SUCCES ;
--   - INSERT AVEC RETURNING (le chemin de l'app : real.ts
--     .insert().select().single()) = 42501.
-- Diagnostic : pendant le RETURNING, la politique SELECT immeubles_select
-- evalue immeuble_visible(id) -> est_proprietaire_immeuble RELIT
-- public.immeubles par id (fonction STABLE, snapshot de l'instruction) :
-- la ligne en cours d'insertion est INVISIBLE pour ce scan -> FALSE ->
-- refus, alors que le WITH CHECK (owner_id = auth.uid() + garde) est
-- satisfait. Le piege est l'auto-scan de la table inseree, pas la garde.
--
-- Contenu :
--  (A) CORRECTIF RACINE — section 3 : immeubles_select recreee avec un
--      terme LOCAL a la ligne en tete (owner_id = auth.uid()), evalue sur
--      la ligne elle-meme sans aucun scan : la branche historique
--      immeuble_visible(id) reste en second terme (gestionnaire /
--      co-proprietaire, lignes pre-existantes).
--  (B) Balayage du meme piege sur TOUTES les tables inserees via
--      .insert().select() dans l'application : AUCUN autre cas reel
--      (detail et justifications : docs/correctif-rls-insert-2026-11-07.md).
--  (C) tarifs_plateforme : l'application enregistre les tarifs par UPSERT
--      (lib/data/real.ts mettreAJourTarifs). Un UPSERT exige une politique
--      INSERT *et* une politique UPDATE. Le depot ne definit QUE
--      tarifs_select_public + tarifs_update_super_admin : AUCUNE politique
--      INSERT n'existe -> l'upsert est refuse par la RLS (42501), meme pour
--      des lignes existantes. => section 4 (le maillon manquant, a creer).
--  (D) Filets defensifs idempotents : privileges de table (section 1 — le
--      depot n'en pose aucun, il depend des privileges par defaut de
--      Supabase) et reaffirmation des fonctions de la chaine en SECURITY
--      DEFINER + des politiques immeubles/abonnements (sections 2 et 3).
-- IDEMPOTENT : grants, create or replace, drop policy if exists.
-- Aucune donnee touchee, aucune colonne modifiee.
-- ============================================================================

-- --- 1. Privileges de table (le depot n'en pose aucun : filet) ---------------
grant select, insert, update, delete on public.immeubles to authenticated;
grant select, insert, update on public.tarifs_plateforme to authenticated;
grant select, update on public.parametres_finance to authenticated;
grant select on public.tarifs_plateforme, public.parametres_finance to anon;

-- --- 2. Fonctions de la chaine : SECURITY DEFINER reaffirme (depot) ----------
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

create or replace function public.est_proprietaire_immeuble(p_immeuble_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.immeubles i
    where i.id = p_immeuble_id and i.owner_id = auth.uid()
  );
$$;

create or replace function public.est_gestionnaire_immeuble(p_immeuble_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.gestionnaires_immeubles g
    where g.immeuble_id = p_immeuble_id and g.profil_id = auth.uid()
  );
$$;

create or replace function public.est_coproprietaire_immeuble(p_immeuble_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.coproprietaires c
    join public.profils p on p.email = c.email
    where c.immeuble_id = p_immeuble_id and p.id = auth.uid()
  );
$$;

create or replace function public.immeuble_visible(p_immeuble_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.est_proprietaire_immeuble(p_immeuble_id)
      or public.est_gestionnaire_immeuble(p_immeuble_id)
      or public.est_coproprietaire_immeuble(p_immeuble_id);
$$;

create or replace function public.proprietaire_immeuble(p_immeuble_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select i.owner_id from public.immeubles i where i.id = p_immeuble_id;
$$;

create or replace function public.est_admin_plateforme()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profils p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and not p.suspendu
      and p.acces_admin_actif
  );
$$;

create or replace function public.est_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profils p
    where p.id = auth.uid() and p.role = 'super_admin' and not p.suspendu
  );
$$;

-- --- 3. Lecture de SON abonnement / politiques immeubles ----------------------
-- CORRECTIF RACINE (branche A) : la politique SELECT des immeubles met un
-- terme LOCAL a la ligne EN TETE. Pendant un INSERT ... RETURNING, ce
-- terme est evalue sur la ligne elle-meme (owner_id deja renseigne par
-- l'insert) : aucun scan, donc aucune dependance au snapshot. Le second
-- terme conserve la visibilite gestionnaire / co-proprietaire pour les
-- lignes pre-existantes (creees par des instructions anterieures, donc
-- visibles au scan d'immeuble_visible).
drop policy if exists abonnements_select_own on public.abonnements;
create policy abonnements_select_own on public.abonnements
  for select using (owner_id = auth.uid());

drop policy if exists immeubles_select on public.immeubles;
create policy immeubles_select on public.immeubles
  for select using (owner_id = auth.uid() or public.immeuble_visible(id));
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

-- --- 4. LE MAILLON MANQUANT : politique INSERT des tarifs ---------------------
-- Sans elle, l'UPSERT de mettreAJourTarifs est refuse par la RLS (42501)
-- alors meme que la politique UPDATE (tarifs_update_super_admin) existe.
drop policy if exists tarifs_insert_super_admin on public.tarifs_plateforme;
create policy tarifs_insert_super_admin on public.tarifs_plateforme
  for insert with check (public.est_super_admin());
-- Symetrie defensive (l'app ne fait qu'un update aujourd'hui) :
drop policy if exists parametres_finance_insert_super_admin on public.parametres_finance;
create policy parametres_finance_insert_super_admin on public.parametres_finance
  for insert with check (public.est_super_admin());

-- --- 5. VERIFICATIONS (lecture seule, apres application) -----------------------
-- 5a. Les fonctions de la chaine sont bien SECURITY DEFINER (prosecdef = true).
select proname, prosecdef from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('abonnement_permets_ecriture', 'est_proprietaire_immeuble',
     'est_gestionnaire_immeuble', 'est_coproprietaire_immeuble',
     'immeuble_visible', 'proprietaire_immeuble',
     'est_admin_plateforme', 'est_super_admin')
 order by proname;
-- 5b. Privileges du role authenticated sur les tables des deux 403.
select table_name, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and grantee = 'authenticated'
   and table_name in ('immeubles', 'tarifs_plateforme', 'parametres_finance')
 order by table_name, privilege_type;
-- 5c. Politiques en place (expressions incluses) sur les tables touchees.
select tablename, policyname, cmd, qual, with_check from pg_policies
 where schemaname = 'public'
   and tablename in ('immeubles', 'tarifs_plateforme', 'parametres_finance', 'abonnements')
 order by tablename, policyname;
-- Puis REJOUER le protocole « role reel » : l'INSERT AVEC RETURNING de
-- test (compte client) et l'upsert tarifs (fondateur) doivent passer
-- AVANT le rollback — c'est le RETURNING qui scellait le refus.
