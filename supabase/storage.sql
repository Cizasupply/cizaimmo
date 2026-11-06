-- ============================================================================
-- CizaImmo — Supabase Storage privé : documents (Module 4, spec §14).
-- À exécuter dans le SQL Editor du projet Supabase (le bucket ne peut pas
-- être créé par le client navigateur).
--
-- Règle : stockage PRIVÉ, jamais de lien public. Un document n'est
-- accessible qu'aux rôles autorisés du compte propriétaire, par lien signé
-- temporaire (1 heure) généré pour un utilisateur autorisé.
-- ============================================================================

-- 1. Bucket privé (public = false : aucun accès anonyme).
insert into storage.buckets (id, name, public)
values ('documents-prives', 'documents-prives', false)
on conflict (id) do nothing;

-- 2. Politiques Storage : lecture/écriture limitées au propriétaire du
--    dossier (chemin = <owner_id>/...) et aux gestionnaires des immeubles
--    concernés (via gestionnaires_immeubles — lecture seule ici).
--    Les chemins sont de la forme : <owner_id>/<entite_type>/<entite_id>/<fichier>

-- Lecture : le propriétaire du dossier (1er segment du chemin = auth.uid()).
drop policy if exists "documents_prives_select_owner" on storage.objects;
create policy "documents_prives_select_owner" on storage.objects
  for select using (
    bucket_id = 'documents-prives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Écriture (upload) : le propriétaire uniquement.
drop policy if exists "documents_prives_insert_owner" on storage.objects;
create policy "documents_prives_insert_owner" on storage.objects
  for insert with check (
    bucket_id = 'documents-prives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Mise à jour / suppression : le propriétaire uniquement.
drop policy if exists "documents_prives_update_owner" on storage.objects;
create policy "documents_prives_update_owner" on storage.objects
  for update using (
    bucket_id = 'documents-prives'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'documents-prives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_prives_delete_owner" on storage.objects;
create policy "documents_prives_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'documents-prives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Vérification : select * from storage.buckets where id = 'documents-prives';
