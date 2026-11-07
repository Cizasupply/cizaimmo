-- ============================================================================
-- CizaImmo — Correctif (2026-11-07) : lecture des documents clients par la
-- plateforme (console Admin / Super Admin).
--
-- PROBLÈME constaté en réel : dans la page Dossier d'un compte, le bouton
-- « Ouvrir » d'un document du dossier (pièce d'identité, photo, contrat…)
-- affichait « Une erreur est survenue ». La couche TABLE autorise la
-- console à lire les lignes de `documents` (module-admin), mais les
-- politiques du BUCKET privé « documents-prives » (storage.sql) ne
-- donnaient l'accès en lecture qu'au seul propriétaire du fichier
-- (dossier = auth.uid()) : la création du lien signé d'un document
-- client par un Admin était donc refusée par la base.
--
-- CORRECTIF : une politique de LECTURE (select) supplémentaire sur
-- storage.objects, réservée aux comptes plateforme
-- (public.est_admin_plateforme()). Aucune écriture plateforme sur les
-- fichiers clients n'est accordée. Idempotent.
--
-- À appliquer APRÈS storage.sql et module-admin.sql (définit
-- est_admin_plateforme). Compatible v1.4 et v1.5 (la fonction garde
-- le même nom et le même rôle).
-- ============================================================================

drop policy if exists "documents_prives_select_plateforme" on storage.objects;
create policy "documents_prives_select_plateforme" on storage.objects
  for select using (
    bucket_id = 'documents-prives'
    and public.est_admin_plateforme()
  );

-- Vérification : la politique doit exister (1 ligne).
-- select policyname from pg_policies
--  where schemaname = 'storage' and tablename = 'objects'
--    and policyname = 'documents_prives_select_plateforme';
