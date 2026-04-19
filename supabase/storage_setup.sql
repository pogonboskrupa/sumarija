-- =========================================================
-- Supabase Storage — bucket za privremene slike (sječa/otprema)
-- Pokrenuti u Supabase SQL Editor NAKON schema.sql
-- =========================================================

-- 1. Kreiraj javni bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('sjeca-images', 'sjeca-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS politike za storage (anonimni upload/čitanje/brisanje)
CREATE POLICY IF NOT EXISTS "anon_insert_sjeca_images"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'sjeca-images');

CREATE POLICY IF NOT EXISTS "anon_select_sjeca_images"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'sjeca-images');

CREATE POLICY IF NOT EXISTS "anon_delete_sjeca_images"
  ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'sjeca-images');
