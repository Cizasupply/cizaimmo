-- ============================================================================
-- CizaImmo — Module v1.4 : la BASE est la source de vérité.
-- Voir docs/v14-base-source-de-verite.md.
--
-- À appliquer APRÈS schema.sql, storage.sql, module5.sql,
-- module-admin.sql, module-finance.sql et module-v13.sql.
-- IDEMPOTENT : réexécutable sans danger (add column if not exists,
-- create or replace, drop policy if exists).
--
-- Décisions du fondateur (2026-11-07) :
--  (1) Le frontend ne décide RIEN : c'est la base qui refuse les
--      écritures quand l'abonnement ne le permet pas. Jusqu'ici, le
--      passage en lecture seule (fin d'essai, grâce dépassée…) était
--      calculé par le code de l'application : un appel direct à la
--      base pouvait le contourner. La fonction de garde ci-dessous,
--      branchée sur les politiques RLS d'ÉCRITURE des tables métier,
--      rend le refus inviolable — la LECTURE reste toujours permise
--      (c'est le principe même de la lecture seule).
--  (2) Toute première inscription reçoit l'essai de 30 jours avec le
--      pack STARTER ; le client choisit son pack pour la fin de
--      l'essai (colonne plan_apres_essai, défaut Starter).
--
-- Contenu :
--  1. abonnements.plan_apres_essai (pack choisi pour la fin d'essai).
--  2. Helpers de résolution du propriétaire des données + fonction de
--     garde public.abonnement_permets_ecriture(owner).
--  3. Politiques d'ÉCRITURE des tables métier rebranchées sur la
--     garde (lecture, politiques plateforme et tables exclues —
--     abonnements, factures_abonnement, paiements_mobile_money,
--     profils — INCHANGÉES).
--  4. handle_new_user (reprise de la DERNIÈRE définition, module
--     v1.3) : l'abonnement naît avec le plan « starter ».
--  5. public.approuver_compte(cible) : la transition d'approbation
--     vit désormais dans la base — elle démarre l'essai sur le pack
--     Starter, avec la durée dynamique (parametres_finance).
-- ============================================================================

-- --- 1. abonnements.plan_apres_essai ------------------------------------------
-- Le pack que le client choisit PENDANT son essai pour la suite.
-- Défaut « starter » : sans choix explicite, la fin d'essai bascule
-- sur Starter (ou en lecture seule si aucun paiement — flux existant).
alter table public.abonnements
  add column if not exists plan_apres_essai text not null default 'starter';

alter table public.abonnements drop constraint if exists abonnements_plan_apres_essai_check;
alter table public.abonnements
  add constraint abonnements_plan_apres_essai_check
  check (plan_apres_essai in ('starter', 'pro', 'agence'));

-- --- 2. Garde d'écriture : la base décide --------------------------------------
-- Résolution du PROPRIÉTAIRE DES DONNÉES : pour un gestionnaire qui
-- écrit sur l'immeuble d'un propriétaire, c'est l'abonnement DU
-- PROPRIÉTAIRE qui décide — jamais celui du rédacteur. Fonctions
-- SECURITY DEFINER (même patron que est_proprietaire_immeuble) pour
-- éviter toute récursion RLS entre tables.
create or replace function public.proprietaire_immeuble(p_immeuble_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select i.owner_id from public.immeubles i where i.id = p_immeuble_id;
$$;

create or replace function public.proprietaire_par_appartement(p_appartement_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select i.owner_id
  from public.appartements a
  join public.immeubles i on i.id = a.immeuble_id
  where a.id = p_appartement_id;
$$;

create or replace function public.proprietaire_par_bail(p_bail_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select i.owner_id
  from public.baux b
  join public.appartements a on a.id = b.appartement_id
  join public.immeubles i on i.id = a.immeuble_id
  where b.id = p_bail_id;
$$;

create or replace function public.proprietaire_par_echeance(p_loyer_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select i.owner_id
  from public.loyers l
  join public.baux b on b.id = l.bail_id
  join public.appartements a on a.id = b.appartement_id
  join public.immeubles i on i.id = a.immeuble_id
  where l.id = p_loyer_id;
$$;

-- LA GARDE. Vrai si l'abonnement LE PLUS RÉCENT du propriétaire
-- autorise l'écriture à l'instant présent :
--   * « actif » sans échec de paiement ;
--   * « actif » avec échec de paiement mais grâce encore en cours
--     (grace_ends_at > now()) ;
--   * « essai » dont la fin n'est pas atteinte (trial_ends_at > now()).
-- Faux dans tous les autres cas : en_attente, suspendu, lecture_seule,
-- annule, essai expiré, grâce dépassée — et aucun abonnement.
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

-- --- 3. Politiques d'ÉCRITURE branchées sur la garde ---------------------------
-- Chaque politique est recréée À L'IDENTIQUE, avec la condition de
-- garde AJOUTÉE (AND) à sa condition d'origine. Les politiques de
-- LECTURE (select) ne sont pas touchées : en lecture seule, le client
-- continue de consulter tout son parc.

-- immeubles : le propriétaire des données est owner_id.
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

-- appartements : garde résolue sur le propriétaire de l'immeuble parent.
drop policy if exists appartements_insert on public.appartements;
create policy appartements_insert on public.appartements
  for insert with check (
    (public.est_proprietaire_immeuble(immeuble_id) or public.est_gestionnaire_immeuble(immeuble_id))
    and public.abonnement_permets_ecriture(public.proprietaire_immeuble(immeuble_id))
  );
drop policy if exists appartements_update on public.appartements;
create policy appartements_update on public.appartements
  for update using (
    (public.est_proprietaire_immeuble(immeuble_id) or public.est_gestionnaire_immeuble(immeuble_id))
    and public.abonnement_permets_ecriture(public.proprietaire_immeuble(immeuble_id))
  )
  with check (
    (public.est_proprietaire_immeuble(immeuble_id) or public.est_gestionnaire_immeuble(immeuble_id))
    and public.abonnement_permets_ecriture(public.proprietaire_immeuble(immeuble_id))
  );
drop policy if exists appartements_delete_owner on public.appartements;
create policy appartements_delete_owner on public.appartements
  for delete using (
    public.est_proprietaire_immeuble(immeuble_id)
    and public.abonnement_permets_ecriture(public.proprietaire_immeuble(immeuble_id))
  );

-- locataires : écriture réservée au propriétaire (owner_id direct).
drop policy if exists locataires_write_owner on public.locataires;
create policy locataires_write_owner on public.locataires
  for all using (
    owner_id = auth.uid()
    and public.abonnement_permets_ecriture(owner_id)
  )
  with check (
    owner_id = auth.uid()
    and public.abonnement_permets_ecriture(owner_id)
  );

-- baux : garde résolue via l'appartement → l'immeuble → le propriétaire.
drop policy if exists baux_write on public.baux;
create policy baux_write on public.baux
  for all using (
    exists (select 1 from public.appartements a where a.id = baux.appartement_id
      and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
    and public.abonnement_permets_ecriture(public.proprietaire_par_appartement(baux.appartement_id))
  ) with check (
    exists (select 1 from public.appartements a where a.id = baux.appartement_id
      and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
    and public.abonnement_permets_ecriture(public.proprietaire_par_appartement(baux.appartement_id))
  );

-- loyers (échéances) : garde résolue via le bail → … → le propriétaire.
drop policy if exists loyers_write on public.loyers;
create policy loyers_write on public.loyers
  for all using (
    exists (select 1 from public.baux b join public.appartements a on a.id = b.appartement_id
      where b.id = loyers.bail_id
        and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
    and public.abonnement_permets_ecriture(public.proprietaire_par_bail(loyers.bail_id))
  ) with check (
    exists (select 1 from public.baux b join public.appartements a on a.id = b.appartement_id
      where b.id = loyers.bail_id
        and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
    and public.abonnement_permets_ecriture(public.proprietaire_par_bail(loyers.bail_id))
  );

-- paiements (déclarés) : garde résolue via l'échéance → … → le propriétaire.
drop policy if exists paiements_write on public.paiements;
create policy paiements_write on public.paiements
  for all using (
    exists (select 1 from public.loyers l join public.baux b on b.id = l.bail_id
      join public.appartements a on a.id = b.appartement_id
      where l.id = paiements.echeance_id
        and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
    and public.abonnement_permets_ecriture(public.proprietaire_par_echeance(paiements.echeance_id))
  ) with check (
    exists (select 1 from public.loyers l join public.baux b on b.id = l.bail_id
      join public.appartements a on a.id = b.appartement_id
      where l.id = paiements.echeance_id
        and (public.est_proprietaire_immeuble(a.immeuble_id) or public.est_gestionnaire_immeuble(a.immeuble_id)))
    and public.abonnement_permets_ecriture(public.proprietaire_par_echeance(paiements.echeance_id))
  );

-- depenses : owner_id porte l'IDENTITÉ DU RÉDACTEUR (session) — la
-- garde se résout donc sur le propriétaire de l'IMMEUBLE de la
-- dépense, jamais sur le rédacteur (un gestionnaire peut écrire une
-- dépense sur l'immeuble d'un propriétaire : c'est l'abonnement du
-- propriétaire qui décide).
drop policy if exists depenses_write on public.depenses;
create policy depenses_write on public.depenses
  for all using (
    (owner_id = auth.uid() or public.est_gestionnaire_immeuble(immeuble_id))
    and public.abonnement_permets_ecriture(public.proprietaire_immeuble(immeuble_id))
  ) with check (
    (owner_id = auth.uid() or public.est_gestionnaire_immeuble(immeuble_id))
    and public.abonnement_permets_ecriture(public.proprietaire_immeuble(immeuble_id))
  );

-- documents : le dossier d'inscription (entite_type = 'compte' —
-- photo, pièce d'identité, contrat) doit pouvoir être complété
-- PENDANT l'attente d'approbation, donc hors garde. Tout autre
-- document (immeuble, bail, dépense…) suit la garde du propriétaire.
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for all using (
    owner_id = auth.uid()
    and (entite_type = 'compte' or public.abonnement_permets_ecriture(owner_id))
  )
  with check (
    owner_id = auth.uid()
    and (entite_type = 'compte' or public.abonnement_permets_ecriture(owner_id))
  );

-- --- 4. handle_new_user : essai STARTER dès la naissance du compte -------------
-- Reprise INTÉGRALE de la dernière définition (module-v13.sql :
-- Display ID, téléphone, intention, grille anti-fraude, abonnement
-- « en_attente ») — seul le plan change : « starter » (et
-- plan_apres_essai « starter »), quel que soit tout ancien choix.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text := coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1));
  v_pays text := new.raw_user_meta_data ->> 'pays';
  v_devise text := coalesce(new.raw_user_meta_data ->> 'devise_principale', 'USD');
  v_langue text := coalesce(new.raw_user_meta_data ->> 'langue', 'fr');
  v_pays_ip text := new.raw_user_meta_data ->> 'pays_ip';
  v_grille text := new.raw_user_meta_data ->> 'grille_attribuee';
  v_grille_statut text := coalesce(new.raw_user_meta_data ->> 'grille_statut', 'ok');
  v_telephone text := new.raw_user_meta_data ->> 'telephone';
  v_intention text := coalesce(new.raw_user_meta_data ->> 'intention', 'proprietaire');
  v_display_id text;
begin
  if v_grille is null or v_grille not in ('afrique', 'internationale') then
    v_grille := case
      when v_pays in ('Burundi','Rwanda','République démocratique du Congo','Congo','Kenya','Tanzanie','Ouganda','Cameroun','Sénégal','Côte d''Ivoire','Mali','Burkina Faso','Bénin','Togo','Gabon','Tchad','Niger','Guinée','Madagascar','Éthiopie','Ghana','Nigeria','Angola','Zambie','Zimbabwe','Mozambique','Afrique du Sud','Maroc','Algérie','Tunisie','Égypte')
      then 'afrique' else 'internationale' end;
  end if;
  if v_grille_statut not in ('ok', 'a_verifier') then v_grille_statut := 'ok'; end if;
  if v_intention not in ('proprietaire', 'gestionnaire') then v_intention := 'proprietaire'; end if;

  v_display_id := 'CIM-' || lpad(nextval('public.display_id_seq')::text, 6, '0');

  insert into public.profils (id, nom, email, pays, langue, devise_principale, role, pays_declare, pays_ip, grille_attribuee, grille_statut, display_id, telephone, type_intention, statut_contrat)
  values (new.id, v_nom, new.email, v_pays, v_langue, v_devise, 'proprietaire', v_pays, v_pays_ip, v_grille, v_grille_statut, v_display_id, v_telephone, v_intention, 'sans_objet')
  on conflict (id) do nothing;

  -- APPROBATION MANUELLE (ajout n°3) + ESSAI STARTER (v1.4) :
  -- l'abonnement naît « en_attente », SANS dates d'essai, sur le pack
  -- STARTER. L'essai (jours_essai, paramètre dynamique) ne démarrera
  -- qu'à l'approbation (public.approuver_compte), toujours sur
  -- Starter ; le client choisira ensuite son pack (plan_apres_essai).
  insert into public.abonnements (owner_id, plan, grille, statut, debut_periode, fin_periode, trial_ends_at, plan_apres_essai)
  values (new.id, 'starter', v_grille, 'en_attente', now(), null, null, 'starter')
  on conflict do nothing;

  return new;
end;
$$;

-- --- 5. Approbation : la transition vit dans la base ----------------------------
-- Jusqu'ici, l'application mettait elle-même l'abonnement à jour à
-- l'approbation. La transition est désormais UNE fonction de la base,
-- avec contrôle de rôle INTERNE (même appelée directement, elle
-- refuse tout acteur non plateforme — même patron que
-- supprimer_compte_definitivement) : elle force le pack STARTER et
-- démarre l'essai avec la durée DYNAMIQUE de parametres_finance.
-- Retourne la date de fin d'essai posée (l'application s'en sert
-- pour l'e-mail de bienvenue et le journal d'audit).
create or replace function public.approuver_compte(cible uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement_id uuid;
  v_statut text;
  v_jours integer;
  v_fin timestamptz;
begin
  if not public.est_admin_plateforme() then
    raise exception 'ADMIN_PLATEFORME_REQUIS';
  end if;

  select a.id, a.statut into v_abonnement_id, v_statut
    from public.abonnements a
   where a.owner_id = cible
   order by a.created_at desc
   limit 1;
  if v_abonnement_id is null then
    raise exception 'ABONNEMENT_INTROUVABLE';
  end if;
  if v_statut <> 'en_attente' then
    raise exception 'COMPTE_NON_EN_ATTENTE';
  end if;

  select p.jours_essai into v_jours
    from public.parametres_finance p
   where p.id = 1;
  v_jours := coalesce(v_jours, 30);
  v_fin := now() + make_interval(days => v_jours);

  update public.abonnements
     set statut = 'essai',
         plan = 'starter',
         plan_apres_essai = 'starter',
         debut_periode = now(),
         trial_ends_at = v_fin,
         fin_periode = v_fin
   where id = v_abonnement_id;

  return v_fin;
end;
$$;
revoke all on function public.approuver_compte(uuid) from public;
grant execute on function public.approuver_compte(uuid) to authenticated;
