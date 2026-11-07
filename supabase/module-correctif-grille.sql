-- ============================================================================
-- CizaImmo — Correctif « réattribution de grille depuis la console »
-- (2026-11-07).
--
-- Symptôme (vécu par le fondateur, Super Admin, sur le compte réel
-- CIM-000002 signalé « à vérifier ») : les boutons « Attribuer la
-- grille Afrique » / « Attribuer la grille Internationale » de la
-- console échouent — la grille et le drapeau « à vérifier » ne
-- changent jamais.
--
-- Cause : la réattribution (modèle v1.2) est restée la SEULE mutation
-- plateforme à écrire en direct dans les tables (deux UPDATE
-- PostgREST depuis le navigateur, lib/data/real.ts reattribuerGrille)
-- SANS vérifier le champ « error » du résultat : tout refus de la
-- base (politique RLS absente ou non appliquée au live, erreur
-- PostgREST) est avalé en silence et l'action ne produit aucun
-- effet. Toutes les autres mutations plateforme ont été migrées
-- depuis la v1.4 (« la base décide ») vers des RPC SECURITY DEFINER
-- qui vérifient le rôle en interne et lèvent des erreurs explicites
-- (approuver_compte, supprimer_compte_definitivement, assigner_
-- dossier, basculer_acces_admin…) — il n'existait AUCUNE fonction
-- reattribuer_grille.
--
-- Ce module est IDEMPOTENT : (1) il réaffirme à l'identique de
-- module-admin.sql §7 les deux politiques d'ÉCRITURE plateforme sur
-- profils et abonnements dont dépend l'ancien chemin ; (2) il crée
-- la RPC public.reattribuer_grille, nouveau chemin de l'application
-- (même patron que approuver_compte : rôle vérifié en interne,
-- erreurs nommées traduites par le front).
--
-- APRÈS APPLICATION : lire la section 3 (vérifications) — la
-- fonction doit apparaître (1 ligne), les deux politiques
-- plateforme d'écriture doivent être listées, et la requête
-- d'anomalie (comptes encore « à vérifier » dont la grille du
-- profil contredit celle de l'abonnement) ne doit retourner que
-- les comptes réellement en attente de décision.
-- ============================================================================

-- --- 1. Politiques d'ÉCRITURE plateforme — réaffirmées (module-admin §7) ----
drop policy if exists profils_update_suspension_plateforme on public.profils;
create policy profils_update_suspension_plateforme on public.profils
  for update using (public.est_admin_plateforme())
  with check (public.est_admin_plateforme());

drop policy if exists abonnements_update_suspension_plateforme on public.abonnements;
create policy abonnements_update_suspension_plateforme on public.abonnements
  for update using (public.est_admin_plateforme())
  with check (public.est_admin_plateforme());

-- --- 2. RPC reattribuer_grille ------------------------------------------------
-- Réattribution journalisée côté application (journal_audit, comme
-- approuver_compte) : la RPC ne fait QUE la mutation base + gardes.
create or replace function public.reattribuer_grille(cible uuid, nouvelle_grille text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement_id uuid;
begin
  if not public.est_admin_plateforme() then
    raise exception 'ADMIN_PLATEFORME_REQUIS';
  end if;
  if nouvelle_grille is null or nouvelle_grille not in ('afrique', 'internationale') then
    raise exception 'GRILLE_INVALIDE';
  end if;
  if not exists (select 1 from public.profils p where p.id = cible) then
    raise exception 'COMPTE_INTROUVABLE';
  end if;

  select a.id into v_abonnement_id
    from public.abonnements a
   where a.owner_id = cible
   order by a.created_at desc
   limit 1;
  if v_abonnement_id is null then
    raise exception 'ABONNEMENT_INTROUVABLE';
  end if;

  update public.abonnements
     set grille = nouvelle_grille
   where id = v_abonnement_id;

  update public.profils
     set grille_attribuee = nouvelle_grille,
         grille_statut = 'ok'
   where id = cible;
end;
$$;
revoke all on function public.reattribuer_grille(uuid, text) from public;
grant execute on function public.reattribuer_grille(uuid, text) to authenticated;

-- --- 3. VÉRIFICATIONS (à lire après application) ------------------------------
-- 3a. La fonction existe (1 ligne attendue).
select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'reattribuer_grille';

-- 3b. Les deux politiques d'écriture plateforme (2 lignes attendues).
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and policyname in ('profils_update_suspension_plateforme',
                      'abonnements_update_suspension_plateforme')
 order by tablename;

-- 3c. Anomalies grille : comptes « à vérifier » dont le profil et
-- l'abonnement se contredisent (informatif — un compte en attente
-- de décision du fondateur apparaît ici tant que grille_statut
-- vaut 'a_verifier' avec une grille cohérente : ne retenir que les
-- lignes où les DEUX grilles diffèrent).
select p.id, p.email, p.grille_attribuee, p.grille_statut, a.grille as grille_abonnement
  from public.profils p
  join public.abonnements a on a.owner_id = p.id
 where p.grille_statut = 'a_verifier'
   and p.grille_attribuee is distinct from a.grille;
