-- ============================================================================
-- CizaImmo — Checklist de vérification avant approbation + registre
-- d'audit enrichi (2026-11-07, demande du fondateur).
--
-- Contexte : en test réel, le fondateur a relevé deux manques dans la
-- console : (1) rien n'oblige l'Admin à VÉRIFIER le dossier avant
-- d'approuver — il exige une checklist cochée (photo, pièce
-- d'identité, informations, alerte anti-fraude si le compte est
-- signalé), le bouton « Approuver » restant grisé tant qu'elle est
-- incomplète ; (2) l'historique n'affiche que l'e-mail de l'acteur et
-- la date — il exige le NOM, le PRÉNOM, le RÔLE, le JOUR et l'HEURE
-- de chaque action plateforme, consignés en base.
--
-- Patron « la base décide » (v1.4) : la garde d'approbation vit dans
-- la RPC approuver_compte elle-même — même appelée directement, elle
-- refuse une checklist incomplète (CHECKLIST_INCOMPLETE). Les coches
-- sont consignées par la RPC enregistrer_checklist_dossier (acteur =
-- session, horodatage base), dans une table dédiée append-only.
--
-- Audit enrichi : journal_audit gagne la colonne acteur_nom
-- (snapshot). Un trigger BEFORE INSERT la complète depuis profils
-- quand l'application ne la fournit pas — ce qui couvre aussi les
-- entrées écrites par les RPC SECURITY DEFINER (module-v15.sql :
-- suppressions, supervision…) sans les modifier.
--
-- Module IDEMPOTENT (create if not exists, add column if not exists,
-- create or replace, drop policy/trigger if exists).
-- ============================================================================

-- --- 1. Table des checklists de dossier --------------------------------------
-- Une ligne par consignation (append-only) : la PLUS RÉCENTE fait foi
-- pour l'état courant du dossier. acteur_id = l'Admin / Super Admin
-- qui a coché ; created_at = quand.
create table if not exists public.dossier_checklists (
  id uuid primary key default gen_random_uuid(),
  cible_id uuid not null references public.profils (id) on delete cascade,
  acteur_id uuid not null references public.profils (id) on delete cascade,
  photo_verifiee boolean not null default false,
  piece_coherente boolean not null default false,
  infos_verifiees boolean not null default false,
  antifraude_examinee boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_dossier_checklists_cible
  on public.dossier_checklists (cible_id, created_at desc);

alter table public.dossier_checklists enable row level security;

-- Lecture et consignation réservées à la plateforme (Admin / Super
-- Admin à accès actif, via est_admin_plateforme) ; on ne consigne
-- que sous sa propre identité. Aucune modification ni suppression
-- (pas de politique update/delete : append-only).
drop policy if exists dossier_checklists_select_plateforme on public.dossier_checklists;
create policy dossier_checklists_select_plateforme on public.dossier_checklists
  for select using (public.est_admin_plateforme());
drop policy if exists dossier_checklists_insert_plateforme on public.dossier_checklists;
create policy dossier_checklists_insert_plateforme on public.dossier_checklists
  for insert with check (
    acteur_id = auth.uid() and public.est_admin_plateforme()
  );

-- --- 2. RPC enregistrer_checklist_dossier ------------------------------------
-- Consigne l'état complet de la checklist d'un dossier EN ATTENTE.
-- Rôle vérifié en interne (patron approuver_compte) ; erreurs nommées
-- traduites par le front : ADMIN_PLATEFORME_REQUIS,
-- COMPTE_INTROUVABLE, COMPTE_NON_EN_ATTENTE.
create or replace function public.enregistrer_checklist_dossier(
  cible uuid,
  p_photo boolean,
  p_piece boolean,
  p_infos boolean,
  p_antifraude boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
begin
  if not public.est_admin_plateforme() then
    raise exception 'ADMIN_PLATEFORME_REQUIS';
  end if;
  if not exists (select 1 from public.profils p where p.id = cible) then
    raise exception 'COMPTE_INTROUVABLE';
  end if;

  select a.statut into v_statut
    from public.abonnements a
   where a.owner_id = cible
   order by a.created_at desc
   limit 1;
  if v_statut is null then
    raise exception 'COMPTE_INTROUVABLE';
  end if;
  if v_statut <> 'en_attente' then
    raise exception 'COMPTE_NON_EN_ATTENTE';
  end if;

  insert into public.dossier_checklists (
    cible_id, acteur_id,
    photo_verifiee, piece_coherente, infos_verifiees, antifraude_examinee
  ) values (
    cible, auth.uid(),
    coalesce(p_photo, false), coalesce(p_piece, false),
    coalesce(p_infos, false), coalesce(p_antifraude, false)
  );
end;
$$;
revoke all on function public.enregistrer_checklist_dossier(uuid, boolean, boolean, boolean, boolean) from public;
grant execute on function public.enregistrer_checklist_dossier(uuid, boolean, boolean, boolean, boolean) to authenticated;

-- --- 3. approuver_compte : garde CHECKLIST ajoutée ----------------------------
-- Reprise À L'IDENTIQUE de module-v14.sql §5, avec UN ajout : avant
-- la transition, la checklist la plus récente du dossier doit être
-- COMPLÈTE — photo + pièce + infos toujours ; anti-fraude en plus si
-- le profil est signalé « a_verifier ». Sinon : CHECKLIST_INCOMPLETE.
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
  v_grille_statut text;
  v_check record;
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

  -- Checklist de vérification (fondateur, 2026-11-07) : la base
  -- refuse d'approuver un dossier dont la revue n'est pas consignée
  -- complète. Le refus, lui, reste libre (aucune garde ici).
  select p.grille_statut into v_grille_statut
    from public.profils p
   where p.id = cible;
  select c.photo_verifiee, c.piece_coherente, c.infos_verifiees,
         c.antifraude_examinee
    into v_check
    from public.dossier_checklists c
   where c.cible_id = cible
   order by c.created_at desc
   limit 1;
  if v_check is null
     or not v_check.photo_verifiee
     or not v_check.piece_coherente
     or not v_check.infos_verifiees
     or (coalesce(v_grille_statut, 'ok') = 'a_verifier'
         and not v_check.antifraude_examinee) then
    raise exception 'CHECKLIST_INCOMPLETE';
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

-- --- 4. Audit enrichi : acteur_nom (snapshot) + trigger de complétion --------
-- Le NOM de l'acteur est figé à l'écriture (un renommage ultérieur du
-- profil ne réécrit pas l'histoire). acteur_role et created_at
-- (jour + heure) existent déjà ; l'affichage console les exploitera.
alter table public.journal_audit
  add column if not exists acteur_nom text;

-- Point d'écriture COMMUN : toute insertion dont acteur_nom est
-- absent (RPC base de la v1.5, futurs chemins) est complétée depuis
-- le profil de l'acteur. L'application fournit le snapshot
-- explicitement quand elle l'a (helper journaliserAudit).
create or replace function public.journal_audit_completer_acteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.acteur_nom is null then
    select p.nom into new.acteur_nom
      from public.profils p
     where p.id = new.acteur_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_journal_audit_completer_acteur on public.journal_audit;
create trigger trg_journal_audit_completer_acteur
  before insert on public.journal_audit
  for each row execute function public.journal_audit_completer_acteur();

-- ============================================================================
-- VÉRIFICATIONS (à lire après application)
-- ============================================================================
-- V1. La table des checklists + ses 2 politiques.
-- select tablename, policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'dossier_checklists'
--  order by policyname;
-- V2. Les deux fonctions (2 lignes attendues).
-- select proname from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname in ('enregistrer_checklist_dossier', 'approuver_compte')
--  order by proname;
-- V3. La colonne acteur_nom + le trigger (1 ligne chacun).
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'journal_audit'
--    and column_name = 'acteur_nom';
-- select trigger_name from information_schema.triggers
--  where event_object_schema = 'public'
--    and event_object_table = 'journal_audit'
--    and trigger_name = 'trg_journal_audit_completer_acteur';
-- V4. Dossiers en attente SANS checklist complète (informatif :
--     leur approbation sera refusée par la base tant que la revue
--     n'est pas consignée — comportement voulu).
-- select p.id, p.email, p.grille_statut
--   from public.profils p
--   join public.abonnements a on a.owner_id = p.id
--   left join lateral (
--     select * from public.dossier_checklists c
--      where c.cible_id = p.id order by c.created_at desc limit 1
--   ) c on true
--  where a.statut = 'en_attente'
--    and (c.id is null or not c.photo_verifiee or not c.piece_coherente
--         or not c.infos_verifiees
--         or (p.grille_statut = 'a_verifier' and not c.antifraude_examinee));
