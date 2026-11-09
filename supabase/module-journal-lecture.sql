-- ============================================================================
-- CizaImmo — Journal d'audit : ÉTAT DE LECTURE (lu / archivé) — table
-- LATÉRALE (2026-11-08, demande du fondateur, passe corrective captures
-- point 9).
--
-- CONTRAINTE D'ARCHITECTURE : la table `journal_audit` est APPEND-ONLY
-- — son contenu n'est ni modifiable ni supprimable (c'est la garantie
-- d'audit). Les marqueurs « lu » / « archivé » ne vivent donc PAS sur
-- les entrées : ils vivent dans cette table latérale, une ligne par
-- entrée touchée (une entrée sans ligne = non lue, non archivée).
-- AUCUNE écriture sur `journal_audit` n'est ajoutée ni altérée par ce
-- module : la traçabilité des faits reste intacte, seule la LECTURE
-- par le Super Admin gagne un état de travail (boîte de réception).
--
-- MODÈLE :
--  - entree_id : référence l'entrée du journal (clé primaire — un
--    seul état par entrée) ; suppression en cascade si l'entrée
--    disparaissait (impossible en pratique : journal append-only).
--  - lu_le : horodatage de lecture (null = non lue).
--  - archive_le : horodatage d'archivage (null = dans la liste
--    principale) ; le désarchivage remet null.
--  - par : le Super Admin qui a posé le dernier marqueur.
--  - maj_le : dernière modification de l'état.
--
-- RLS : lecture ET écriture réservées au Super Admin
-- (public.est_super_admin(), helper de module-admin.sql) — cohérent
-- avec le verrouillage 2026-11-08 de la lecture du journal (Super
-- Admin seul, chez les fournisseurs ET en base pour cette table).
--
-- IDEMPOTENT : réapplicable sans effet de bord.
-- ============================================================================

create table if not exists public.journal_lecture (
  entree_id uuid primary key references public.journal_audit(id) on delete cascade,
  lu_le timestamptz,
  archive_le timestamptz,
  par uuid references public.profils(id),
  maj_le timestamptz not null default now()
);

alter table public.journal_lecture enable row level security;

drop policy if exists "journal_lecture_super_admin" on public.journal_lecture;
create policy "journal_lecture_super_admin" on public.journal_lecture
  for all
  using (public.est_super_admin())
  with check (public.est_super_admin());

comment on table public.journal_lecture is
  'État de lecture (lu/archivé) des entrées du journal d''audit — table latérale : journal_audit reste append-only, aucune entrée n''est modifiée. Super Admin seul (RLS).';
