-- ============================================================================
-- CizaImmo — Verrouillage : APPROBATION des comptes = SUPER ADMIN SEUL
-- (2026-11-08, décision du fondateur).
--
-- Contexte : le fondateur a posé la règle « aucune approbation de
-- compte sans vérification de l'abonnement / du paiement ». La
-- décision d'ouverture d'accès appartient donc à celui qui détient
-- toute la chaîne argent — le Super Admin (déjà seul sur les
-- tarifs, l'émission des paies et la validation des dépenses). Le
-- sous-admin INSTRUIT le dossier : consultation des documents,
-- checklist de vérification consignée, messages aux clients — tout
-- cela lui reste ouvert (enregistrer_checklist_dossier garde son
-- contrôle « plateforme », INCHANGÉ par ce module).
--
-- Patron « la base décide » (v1.4) : la transition d'approbation
-- vit dans la RPC public.approuver_compte. Ce module la recrée À
-- L'IDENTIQUE de sa dernière définition (module-checklist-audit.sql
-- §3) avec UN SEUL changement : la garde de rôle en tête passe de
-- est_admin_plateforme() (Admin OU Super Admin) à
-- est_super_admin(), et l'erreur nommée devient SUPER_ADMIN_REQUIS
-- (traduite côté application en ERR_SUPER_ADMIN_REQUIS). La garde
-- CHECKLIST_INCOMPLETE est préservée intégralement : même appelée
-- directement par un Super Admin, la fonction refuse toujours un
-- dossier dont la revue consignée est incomplète.
--
-- REFUS : la décision de refus est APPAIRÉE à l'approbation côté
-- application (refuserCompte exige le Super Admin dans les deux
-- fournisseurs) mais AUCUNE fonction SQL ne la porte — le refus
-- s'écrit par mises à jour directes (profils.motif_refus +
-- abonnements.statut). Ce module ne couvre donc que l'approbation,
-- seule décision portée par une RPC ; le verrou du refus vit dans
-- les fournisseurs (réel + démo), comme documenté dans
-- docs/verrouillage-approbation-super-admin-2026-11-08.md.
--
-- Module IDEMPOTENT (create or replace ; revoke/grant rejouables).
-- À appliquer APRÈS module-v14.sql et module-checklist-audit.sql.
-- ============================================================================

-- --- approuver_compte : garde de rôle portée au Super Admin ------------------
-- Reprise À L'IDENTIQUE de module-checklist-audit.sql §3, avec UN
-- changement : la garde de tête (est_super_admin / SUPER_ADMIN_REQUIS
-- au lieu de est_admin_plateforme / ADMIN_PLATEFORME_REQUIS).
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
  if not public.est_super_admin() then
    raise exception 'SUPER_ADMIN_REQUIS';
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

-- ============================================================================
-- VÉRIFICATIONS (à lire après application)
-- ============================================================================
-- V1. La définition en base porte les DEUX gardes (Super Admin +
--     checklist préservée) :
-- select pg_get_functiondef(oid) from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname = 'approuver_compte';
-- -> le corps contient « est_super_admin() », « SUPER_ADMIN_REQUIS »
--    ET « CHECKLIST_INCOMPLETE ».
-- V2. Les helpers de rôle existent (2 lignes attendues) :
-- select proname from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname in ('est_super_admin', 'est_admin_plateforme')
--  order by proname;
-- V3. Rétroactivité : les dossiers EN ATTENTE restent en attente —
--     ce module ne décide rien, il verrouille seulement QUI décide
--     (informatif) :
-- select count(*) from public.abonnements where statut = 'en_attente';
