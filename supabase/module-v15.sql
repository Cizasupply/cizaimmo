-- ============================================================================
-- CizaImmo — Module v1.5 : suppression de compte par le client,
-- messagerie directe supervisée et assignation des dossiers.
-- Voir les décisions v1.5 du fondateur (2026-11-07).
--
-- À appliquer APRÈS schema.sql, storage.sql, module5.sql,
-- module-admin.sql, module-finance.sql, module-v13.sql et
-- module-v14.sql. IDEMPOTENT : réexécutable sans danger
-- (add column if not exists, create or replace, drop policy
-- if exists, blocs DO pour les contraintes).
--
-- Décisions du fondateur (2026-11-07) :
--  (1) Suppression de compte PAR LE CLIENT lui-même, avec délai
--      de rétractation de 30 jours : demande = lecture seule
--      IMMÉDIATE (la garde v1.4 refuse alors toute écriture
--      métier), annulation possible pendant 30 jours avec
--      restauration de l'abonnement depuis un instantané pris
--      dans la base, exécution définitive par le Super Admin
--      seul après 30 jours — les factures sont conservées
--      ANONYMISÉES (comptabilité), jamais supprimées.
--  (2) Messagerie directe bidirectionnelle : admin <-> client
--      (fil « plateforme ») ET propriétaire <-> gestionnaire
--      (fil « rattachement »). Les fils rattachement sont
--      SUPERVISÉS par la plateforme en LECTURE SEULE : la base
--      refuse toute insertion d'un admin sur ces fils, et
--      chaque consultation d'un fil rattachement par un admin
--      est journalisée dans journal_audit.
--  (3) Assignation : le Super Admin attribue chaque dossier
--      client à un Admin (« sous-admin ») responsable.
--      L'assignation = responsabilité (messages du client
--      routés vers l'Admin assigné), PAS une restriction
--      d'accès : les Admin voient tous les comptes (v1.2).
--  (4) Équipe : le Super Admin peut couper / rétablir l'accès
--      plateforme d'un Admin (acces_admin_actif) et lui retirer
--      son rôle (retour au rôle d'origine, mémorisé dans
--      role_avant_admin). Le Super Admin n'est ni désactivable
--      ni modifiable par ces fonctions.
-- Principe v1.4 conservé : « c'est la base qui décide, pas le
-- front » — toutes les transitions et tous les refus vivent
-- dans les fonctions et politiques ci-dessous.
--
-- RÈGLE DURE (inchangée) : CizaImmo n'encaisse JAMAIS les
-- loyers — ce module ne crée aucune capacité d'encaissement.
--
-- Contenu :
--  1. profils : suppression_demandee_le, admin_responsable_id,
--     acces_admin_actif, role_avant_admin.
--  2. abonnements : instantane_avant_suppression (jsonb).
--  3. factures_abonnement : anonymise.
--  4. journal_audit : acteur_role élargi aux rôles clients
--     (les RPC de suppression écrivent l'audit au nom du
--     client acteur).
--  5. est_admin_plateforme : exige acces_admin_actif.
--  6. Helper supprimer_utilisateur_auth + refonte de
--     supprimer_compte_definitivement sur ce helper.
--  7. RPC demander_suppression_compte.
--  8. RPC annuler_suppression_compte.
--  9. RPC executer_suppression_compte.
-- 10. Tables conversations + messages_directs, helpers et RLS.
-- 11. RPC journaliser_consultation_messages.
-- 12. RPC assigner_dossier.
-- 13. Fonction lister_charge_admins.
-- 14. RPC basculer_acces_admin.
-- 15. RPC retirer_role_admin.
-- ============================================================================

-- --- 1. profils : suppression, assignation, accès admin ----------------------
alter table public.profils
  add column if not exists suppression_demandee_le timestamptz;
alter table public.profils
  add column if not exists admin_responsable_id uuid
    references public.profils (id) on delete set null;
alter table public.profils
  add column if not exists acces_admin_actif boolean not null default true;
alter table public.profils
  add column if not exists role_avant_admin text;

-- Rôle d'origine avant promotion Admin (posé prudemment : drop
-- if exists puis contrainte nommée, patron module-v13).
alter table public.profils drop constraint if exists profils_role_avant_admin_check;
alter table public.profils
  add constraint profils_role_avant_admin_check
  check (role_avant_admin is null
    or role_avant_admin in ('proprietaire', 'gestionnaire', 'coproprietaire'));

create index if not exists idx_profils_admin_responsable
  on public.profils (admin_responsable_id);

-- --- 2. abonnements : instantané avant suppression ---------------------------
-- Copie complète (to_jsonb) de la ligne d'abonnement au moment
-- de la demande de suppression : l'annulation restaure DEPUIS
-- cet instantané, jamais depuis le front.
alter table public.abonnements
  add column if not exists instantane_avant_suppression jsonb;

-- --- 3. factures_abonnement : anonymisation -----------------------------------
-- À l'exécution définitive de la suppression, les factures sont
-- CONSERVÉES (comptabilité) mais leurs références externes
-- (Stripe / mobile money) sont remplacées par « ANONYMISE ».
alter table public.factures_abonnement
  add column if not exists anonymise boolean not null default false;

-- --- 4. journal_audit : acteur_role élargi aux clients ------------------------
-- Le CHECK d'origine limite acteur_role à admin/super_admin.
-- Les RPC de suppression (sections 7 et 8) écrivent l'audit au
-- nom du CLIENT acteur : on retrouve la contrainte via
-- pg_constraint (patron module-admin.sql) et on la recrée avec
-- la liste complète.
do $$
declare
  v_nom text;
begin
  select conname into v_nom
    from pg_constraint
   where conrelid = 'public.journal_audit'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%acteur_role%';
  if v_nom is not null then
    execute format('alter table public.journal_audit drop constraint %I', v_nom);
  end if;
end $$;
alter table public.journal_audit
  add constraint journal_audit_acteur_role_check
  check (acteur_role in ('admin', 'super_admin', 'proprietaire', 'gestionnaire', 'coproprietaire'));

-- --- 5. est_admin_plateforme : accès admin actif exigé ------------------------
-- Reprise À L'IDENTIQUE de module-admin.sql, avec l'ajout de
-- « and p.acces_admin_actif » : un Admin dont l'accès est coupé
-- (basculer_acces_admin) perd immédiatement tous les droits
-- plateforme portés par ce helper. est_super_admin INCHANGÉ :
-- le Super Admin n'est pas désactivable.
create or replace function public.est_admin_plateforme()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profils p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and not p.suspendu
      and p.acces_admin_actif
  );
$$;

-- --- 6. Helper interne de suppression Auth ------------------------------------
-- Point unique de suppression de l'utilisateur Auth : la
-- cascade (profils.id -> auth.users ON DELETE CASCADE, puis les
-- tables owner_id -> profils) emporte le reste. Helper INTERNE :
-- aucun grant à authenticated — il n'est appelé que depuis les
-- fonctions SECURITY DEFINER ci-dessous, jamais directement.
create or replace function public.supprimer_utilisateur_auth(cible uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = cible;
end;
$$;
revoke all on function public.supprimer_utilisateur_auth(uuid) from public;

-- Suppression DÉFINITIVE immédiate (console Super Admin) :
-- reprise de module-admin.sql sur le helper ci-dessus, gardes
-- conservées à l'identique (SUPER_ADMIN_REQUIS +
-- AUTO_SUPPRESSION_INTERDITE). L'appel reste journalisé par
-- l'application AVANT l'appel.
create or replace function public.supprimer_compte_definitivement(cible uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.est_super_admin() then
    raise exception 'SUPER_ADMIN_REQUIS';
  end if;
  if cible = auth.uid() then
    raise exception 'AUTO_SUPPRESSION_INTERDITE';
  end if;
  perform public.supprimer_utilisateur_auth(cible);
end;
$$;
revoke all on function public.supprimer_compte_definitivement(uuid) from public;
grant execute on function public.supprimer_compte_definitivement(uuid) to authenticated;

-- --- 7. Demande de suppression par le client ----------------------------------
-- Effets immédiats, tous dans la base : instantané complet de
-- l'abonnement le plus récent, passage en « lecture_seule »
-- (la garde v1.4 refuse alors toute écriture métier — lecture
-- seule IMMÉDIATE), date de demande posée, audit écrit au nom
-- du client. Retourne la date de demande : le délai de
-- rétractation de 30 jours court à partir d'elle.
create or replace function public.demander_suppression_compte()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_email text;
  v_role text;
  v_demande timestamptz;
  v_abo public.abonnements%rowtype;
  v_now timestamptz := now();
begin
  select p.email, p.role, p.suppression_demandee_le
    into v_email, v_role, v_demande
    from public.profils p
   where p.id = v_acteur;
  if not found then
    raise exception 'PROFIL_INTROUVABLE';
  end if;
  if v_role in ('admin', 'super_admin') then
    raise exception 'COMPTE_PLATEFORME';
  end if;
  if v_demande is not null then
    raise exception 'SUPPRESSION_DEJA_DEMANDEE';
  end if;

  select * into v_abo
    from public.abonnements a
   where a.owner_id = v_acteur
   order by a.created_at desc
   limit 1;
  if found then
    update public.abonnements
       set instantane_avant_suppression = to_jsonb(v_abo),
           statut = 'lecture_seule'
     where id = v_abo.id;
  end if;

  update public.profils
     set suppression_demandee_le = v_now
   where id = v_acteur;

  insert into public.journal_audit
    (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email)
  values
    (v_acteur, v_email, v_role, 'suppression_demandee', 'compte', v_acteur::text, v_email);

  return v_now;
end;
$$;
revoke all on function public.demander_suppression_compte() from public;
grant execute on function public.demander_suppression_compte() to authenticated;

-- --- 8. Annulation de la suppression (rétractation, 30 jours) -----------------
-- Restaure l'abonnement le plus récent DEPUIS l'instantané
-- jsonb (chaque champ relu via ->> avec le cast adapté et un
-- coalesce pour les champs NOT NULL), efface l'instantané et
-- la date de demande, et journalise au nom du client.
create or replace function public.annuler_suppression_compte()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_email text;
  v_role text;
  v_demande timestamptz;
  v_abo public.abonnements%rowtype;
  v_snap jsonb;
begin
  select p.email, p.role, p.suppression_demandee_le
    into v_email, v_role, v_demande
    from public.profils p
   where p.id = v_acteur;
  if not found or v_demande is null then
    raise exception 'AUCUNE_SUPPRESSION';
  end if;
  if now() >= v_demande + interval '30 days' then
    raise exception 'DELAI_EXPIRE';
  end if;

  select * into v_abo
    from public.abonnements a
   where a.owner_id = v_acteur
   order by a.created_at desc
   limit 1;
  if found then
    v_snap := v_abo.instantane_avant_suppression;
    if v_snap is not null then
      update public.abonnements
         set statut = coalesce(v_snap ->> 'statut', 'lecture_seule'),
             statut_pre_suspension = v_snap ->> 'statut_pre_suspension',
             plan = coalesce(v_snap ->> 'plan', 'starter'),
             plan_apres_essai = coalesce(v_snap ->> 'plan_apres_essai', 'starter'),
             plan_en_attente = v_snap ->> 'plan_en_attente',
             date_effet_plan = (v_snap ->> 'date_effet_plan')::timestamptz,
             debut_periode = coalesce((v_snap ->> 'debut_periode')::timestamptz, now()),
             fin_periode = (v_snap ->> 'fin_periode')::timestamptz,
             trial_ends_at = (v_snap ->> 'trial_ends_at')::timestamptz,
             grace_ends_at = (v_snap ->> 'grace_ends_at')::timestamptz,
             echec_paiement = coalesce((v_snap ->> 'echec_paiement')::boolean, false),
             resiliation_programmee = coalesce((v_snap ->> 'resiliation_programmee')::boolean, false),
             lecture_seule_jusqu_au = (v_snap ->> 'lecture_seule_jusqu_au')::timestamptz,
             grille = coalesce(v_snap ->> 'grille', 'internationale'),
             mobile_money_ref = v_snap ->> 'mobile_money_ref',
             instantane_avant_suppression = null
       where id = v_abo.id;
    else
      update public.abonnements
         set instantane_avant_suppression = null
       where id = v_abo.id;
    end if;
  end if;

  update public.profils
     set suppression_demandee_le = null
   where id = v_acteur;

  insert into public.journal_audit
    (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email)
  values
    (v_acteur, v_email, v_role, 'suppression_annulee', 'compte', v_acteur::text, v_email);
end;
$$;
revoke all on function public.annuler_suppression_compte() from public;
grant execute on function public.annuler_suppression_compte() to authenticated;

-- --- 9. Exécution définitive de la suppression (Super Admin) ------------------
-- Après 30 jours pleins : les factures du compte sont
-- ANONYMISÉES (conservées pour la comptabilité, références
-- externes remplacées), l'exécution est journalisée AVANT la
-- suppression (acteur = Super Admin : la ligne d'audit survit
-- à la suppression de la cible), puis l'utilisateur Auth est
-- supprimé via le helper (cascade complète).
create or replace function public.executer_suppression_compte(cible uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_acteur_email text;
  v_acteur_role text;
  v_cible_email text;
  v_demande timestamptz;
begin
  if not public.est_super_admin() then
    raise exception 'SUPER_ADMIN_REQUIS';
  end if;
  if cible = v_acteur then
    raise exception 'AUTO_SUPPRESSION_INTERDITE';
  end if;

  select p.email, p.suppression_demandee_le
    into v_cible_email, v_demande
    from public.profils p
   where p.id = cible;
  if not found or v_demande is null then
    raise exception 'AUCUNE_SUPPRESSION';
  end if;
  if now() < v_demande + interval '30 days' then
    raise exception 'DELAI_NON_ECOULE';
  end if;

  update public.factures_abonnement
     set anonymise = true,
         stripe_invoice_id = case
           when stripe_invoice_id is not null then 'ANONYMISE' else null end,
         reference_mobile_money = case
           when reference_mobile_money is not null then 'ANONYMISE' else null end
   where owner_id = cible;

  select p.email, p.role into v_acteur_email, v_acteur_role
    from public.profils p
   where p.id = v_acteur;

  insert into public.journal_audit
    (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email)
  values
    (v_acteur, v_acteur_email, v_acteur_role, 'suppression_executee', 'compte', cible::text, v_cible_email);

  perform public.supprimer_utilisateur_auth(cible);
end;
$$;
revoke all on function public.executer_suppression_compte(uuid) from public;
grant execute on function public.executer_suppression_compte(uuid) to authenticated;

-- --- 10. Messagerie directe -----------------------------------------------------
-- Deux types de fils, cohérence garantie par contrainte :
--  * « plateforme » : client <-> plateforme (proprietaire_id =
--    le client, aucun gestionnaire ni rattachement) ; les
--    messages de la plateforme sont routés vers
--    admin_responsable_id (section 12).
--  * « rattachement » : propriétaire <-> gestionnaire, toujours
--    rattaché à un rattachement validé.
-- Un seul fil plateforme par client, un seul fil par
-- rattachement (index uniques partiels).
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('plateforme', 'rattachement')),
  proprietaire_id uuid not null references public.profils (id) on delete cascade,
  gestionnaire_id uuid references public.profils (id) on delete cascade,
  rattachement_id uuid references public.rattachements_gestionnaires (id) on delete cascade,
  admin_responsable_id uuid references public.profils (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint conversations_coherence_check check (
    (type = 'plateforme' and gestionnaire_id is null and rattachement_id is null)
    or (type = 'rattachement' and gestionnaire_id is not null and rattachement_id is not null)
  )
);
create unique index if not exists idx_conversations_plateforme_unique
  on public.conversations (proprietaire_id)
  where type = 'plateforme';
create unique index if not exists idx_conversations_rattachement_unique
  on public.conversations (rattachement_id)
  where type = 'rattachement';
create index if not exists idx_conversations_proprietaire
  on public.conversations (proprietaire_id);
create index if not exists idx_conversations_admin_responsable
  on public.conversations (admin_responsable_id);

create table if not exists public.messages_directs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  expediteur_id uuid not null references public.profils (id) on delete cascade,
  corps text not null check (char_length(btrim(corps)) > 0),
  lu_par_client boolean not null default false,
  lu_par_plateforme boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_directs_conversation
  on public.messages_directs (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages_directs enable row level security;

-- Helpers RLS (SECURITY DEFINER, patron des modules précédents :
-- pas de récursion entre conversations et messages_directs).
create or replace function public.est_participant_conversation(p_conversation uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation
      and (c.proprietaire_id = auth.uid() or c.gestionnaire_id = auth.uid())
  );
$$;

create or replace function public.type_conversation(p_conversation uuid)
returns text language sql security definer stable set search_path = public as $$
  select c.type from public.conversations c where c.id = p_conversation;
$$;

-- conversations : les participants lisent leur fil ; la
-- plateforme lit tout (supervision) et peut créer un fil
-- plateforme ou re-router un fil (update réservé plateforme).
-- AUCUNE politique delete : un fil ne se supprime que par la
-- cascade des comptes / rattachements.
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (
    proprietaire_id = auth.uid()
    or gestionnaire_id = auth.uid()
    or public.est_admin_plateforme()
  );
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert with check (
    (type = 'plateforme'
      and (proprietaire_id = auth.uid() or public.est_admin_plateforme()))
    or (type = 'rattachement'
      and (proprietaire_id = auth.uid() or gestionnaire_id = auth.uid()))
  );
drop policy if exists conversations_update_plateforme on public.conversations;
create policy conversations_update_plateforme on public.conversations
  for update using (public.est_admin_plateforme())
  with check (public.est_admin_plateforme());

-- messages_directs : les participants lisent et écrivent ; la
-- plateforme lit tout et n'écrit QUE sur les fils plateforme.
-- POINT CLÉ : sur un fil « rattachement », un admin n'est PAS
-- participant — la politique d'insertion ci-dessous refuse
-- donc son message PAR LA BASE (supervision lecture seule,
-- décision v1.5). L'update ne sert qu'au marquage « lu ».
-- AUCUNE politique delete.
drop policy if exists messages_directs_select on public.messages_directs;
create policy messages_directs_select on public.messages_directs
  for select using (
    public.est_participant_conversation(conversation_id)
    or public.est_admin_plateforme()
  );
drop policy if exists messages_directs_insert on public.messages_directs;
create policy messages_directs_insert on public.messages_directs
  for insert with check (
    expediteur_id = auth.uid()
    and (public.est_participant_conversation(conversation_id)
      or (public.type_conversation(conversation_id) = 'plateforme'
        and public.est_admin_plateforme()))
  );
drop policy if exists messages_directs_update on public.messages_directs;
create policy messages_directs_update on public.messages_directs
  for update using (
    public.est_participant_conversation(conversation_id)
    or (public.type_conversation(conversation_id) = 'plateforme'
      and public.est_admin_plateforme())
  )
  with check (
    public.est_participant_conversation(conversation_id)
    or (public.type_conversation(conversation_id) = 'plateforme'
      and public.est_admin_plateforme())
  );

-- --- 11. Journalisation d'une consultation supervisée --------------------------
-- Toute lecture d'un fil « rattachement » par la plateforme
-- passe par cette RPC AVANT l'affichage : la consultation est
-- inscrite au journal (mention prévue aux conditions, v1.5).
-- Les fils plateforme ne sont pas supervisés : refusés ici.
create or replace function public.journaliser_consultation_messages(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_acteur_email text;
  v_acteur_role text;
  v_type text;
  v_proprietaire uuid;
  v_proprietaire_email text;
begin
  if not public.est_admin_plateforme() then
    raise exception 'ADMIN_PLATEFORME_REQUIS';
  end if;

  select c.type, c.proprietaire_id into v_type, v_proprietaire
    from public.conversations c
   where c.id = p_conversation;
  if not found or v_type <> 'rattachement' then
    raise exception 'CONVERSATION_NON_SUPERVISEE';
  end if;

  select p.email into v_proprietaire_email
    from public.profils p
   where p.id = v_proprietaire;
  select p.email, p.role into v_acteur_email, v_acteur_role
    from public.profils p
   where p.id = v_acteur;

  insert into public.journal_audit
    (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
  values
    (v_acteur, v_acteur_email, v_acteur_role, 'consultation_messages', 'compte',
     v_proprietaire::text, v_proprietaire_email,
     jsonb_build_object('conversation_id', p_conversation));
end;
$$;
revoke all on function public.journaliser_consultation_messages(uuid) from public;
grant execute on function public.journaliser_consultation_messages(uuid) to authenticated;

-- --- 12. Assignation d'un dossier à un Admin responsable ------------------------
-- Super Admin seul. admin_id peut être NULL (désassignation).
-- L'ancien responsable est mémorisé pour l'audit ; le fil
-- plateforme du client est re-routé vers le nouvel Admin
-- responsable. L'assignation ne restreint AUCUN accès (v1.2 :
-- les Admin voient tous les comptes) — responsabilité seule.
create or replace function public.assigner_dossier(cible uuid, admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_acteur_email text;
  v_acteur_role text;
  v_admin_role text;
  v_ancien uuid;
  v_cible_email text;
begin
  if not public.est_super_admin() then
    raise exception 'SUPER_ADMIN_REQUIS';
  end if;

  if admin_id is not null then
    select p.role into v_admin_role
      from public.profils p
     where p.id = admin_id;
    if not found or v_admin_role not in ('admin', 'super_admin') then
      raise exception 'ADMIN_INTROUVABLE';
    end if;
  end if;

  select p.admin_responsable_id, p.email into v_ancien, v_cible_email
    from public.profils p
   where p.id = cible;

  update public.profils
     set admin_responsable_id = admin_id
   where id = cible;

  update public.conversations
     set admin_responsable_id = admin_id
   where proprietaire_id = cible
     and type = 'plateforme';

  select p.email, p.role into v_acteur_email, v_acteur_role
    from public.profils p
   where p.id = v_acteur;

  insert into public.journal_audit
    (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
  values
    (v_acteur, v_acteur_email, v_acteur_role, 'assignation', 'compte',
     cible::text, v_cible_email,
     jsonb_build_object(
       'ancien_responsable', v_ancien::text,
       'nouveau_responsable', admin_id::text));
end;
$$;
revoke all on function public.assigner_dossier(uuid, uuid) from public;
grant execute on function public.assigner_dossier(uuid, uuid) to authenticated;

-- --- 13. Charge des Admin (vue Équipe du Super Admin) ---------------------------
-- Lecture AGRÉGÉE non sensible (des compteurs, aucune donnée
-- client) : pas de garde interne — l'accès effectif est borné
-- par les pages (console Super Admin) et leurs politiques.
-- Choix documenté ici, à l'identique du brief v1.5.
create or replace function public.lister_charge_admins()
returns table (admin_id uuid, dossiers bigint)
language sql
security definer
set search_path = public
as $$
  select p.admin_responsable_id as admin_id, count(*)::bigint as dossiers
    from public.profils p
   where p.admin_responsable_id is not null
   group by p.admin_responsable_id;
$$;
revoke all on function public.lister_charge_admins() from public;
grant execute on function public.lister_charge_admins() to authenticated;

-- --- 14. Couper / rétablir l'accès plateforme d'un Admin -----------------------
-- Super Admin seul, jamais sur soi-même, jamais sur un
-- Super Admin (cible au rôle « admin » uniquement) : poser
-- acces_admin_actif = false retire immédiatement tous les
-- droits portés par est_admin_plateforme (section 5), sans
-- toucher au rôle ni aux dossiers assignés.
create or replace function public.basculer_acces_admin(cible uuid, actif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_acteur_email text;
  v_acteur_role text;
  v_role text;
  v_email text;
begin
  if not public.est_super_admin() then
    raise exception 'SUPER_ADMIN_REQUIS';
  end if;
  if cible = v_acteur then
    raise exception 'AUTO_MODIFICATION_INTERDITE';
  end if;

  select p.role, p.email into v_role, v_email
    from public.profils p
   where p.id = cible;
  if not found or v_role <> 'admin' then
    raise exception 'CIBLE_NON_ADMIN';
  end if;

  update public.profils
     set acces_admin_actif = actif
   where id = cible;

  select p.email, p.role into v_acteur_email, v_acteur_role
    from public.profils p
   where p.id = v_acteur;

  insert into public.journal_audit
    (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
  values
    (v_acteur, v_acteur_email, v_acteur_role, 'acces_admin_modifie', 'admin',
     cible::text, v_email,
     jsonb_build_object('actif', actif));
end;
$$;
revoke all on function public.basculer_acces_admin(uuid, boolean) from public;
grant execute on function public.basculer_acces_admin(uuid, boolean) to authenticated;

-- --- 15. Retrait du rôle Admin ---------------------------------------------------
-- Super Admin seul, jamais sur soi-même, cible « admin »
-- uniquement. L'ancien Admin redevient un client ordinaire :
-- rôle restauré depuis role_avant_admin (mémorisé à la
-- promotion) ou, à défaut, déduit de son intention déclarée
-- à l'inscription. Ses dossiers assignés sont désassignés
-- (profils.admin_responsable_id) et son accès est rétabli
-- (acces_admin_actif = true, en tant que client).
create or replace function public.retirer_role_admin(cible uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acteur uuid := auth.uid();
  v_acteur_email text;
  v_acteur_role text;
  v_role text;
  v_email text;
  v_avant text;
  v_intention text;
  v_nouveau_role text;
begin
  if not public.est_super_admin() then
    raise exception 'SUPER_ADMIN_REQUIS';
  end if;
  if cible = v_acteur then
    raise exception 'AUTO_MODIFICATION_INTERDITE';
  end if;

  select p.role, p.email, p.role_avant_admin, p.type_intention
    into v_role, v_email, v_avant, v_intention
    from public.profils p
   where p.id = cible;
  if not found or v_role <> 'admin' then
    raise exception 'CIBLE_NON_ADMIN';
  end if;

  v_nouveau_role := coalesce(v_avant,
    case when v_intention = 'gestionnaire' then 'gestionnaire'
         else 'proprietaire' end);

  update public.profils
     set role = v_nouveau_role,
         role_avant_admin = null,
         acces_admin_actif = true
   where id = cible;

  update public.profils
     set admin_responsable_id = null
   where admin_responsable_id = cible;

  select p.email, p.role into v_acteur_email, v_acteur_role
    from public.profils p
   where p.id = v_acteur;

  insert into public.journal_audit
    (acteur_id, acteur_email, acteur_role, action, cible_type, cible_id, cible_email, details)
  values
    (v_acteur, v_acteur_email, v_acteur_role, 'role_admin_retire', 'admin',
     cible::text, v_email,
     jsonb_build_object('nouveau_role', v_nouveau_role));
end;
$$;
revoke all on function public.retirer_role_admin(uuid) from public;
grant execute on function public.retirer_role_admin(uuid) to authenticated;

-- ============================================================================
-- FIN DU MODULE v1.5.
-- Vérifications après exécution :
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'profils'
--       and column_name in ('suppression_demandee_le',
--         'admin_responsable_id', 'acces_admin_actif',
--         'role_avant_admin'); -- 4 lignes
--   select tablename from pg_tables
--     where schemaname = 'public'
--       and tablename in ('conversations', 'messages_directs');
--     -- 2 lignes, RLS activée sur les deux
--   select proname from pg_proc
--     where pronamespace = 'public'::regnamespace
--       and proname in ('demander_suppression_compte',
--         'annuler_suppression_compte', 'executer_suppression_compte',
--         'journaliser_consultation_messages', 'assigner_dossier',
--         'lister_charge_admins', 'basculer_acces_admin',
--         'retirer_role_admin', 'supprimer_utilisateur_auth');
--     -- 9 lignes
-- ============================================================================
