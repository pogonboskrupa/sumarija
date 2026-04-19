-- Dodaj kolone za matching slika s unosima (ako temp_images tabela već postoji)
ALTER TABLE temp_images ADD COLUMN IF NOT EXISTS radnik      TEXT DEFAULT '';
ALTER TABLE temp_images ADD COLUMN IF NOT EXISTS entry_datum TEXT DEFAULT '';
ALTER TABLE temp_images ADD COLUMN IF NOT EXISTS entry_type  TEXT DEFAULT '';
