-- Pokrenuti u Supabase > SQL Editor
-- Ispravlja naziv kolone sjekacskaPartija → sjekacska_partija

-- Opcija A: Ako tabele još NISU kreirane — pokreni schema.sql (novi ispravni schema)

-- Opcija B: Ako tabele VEĆ postoje — pokreni ovu migraciju:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sihtarica_primac' AND column_name = 'sjekacskapartija'
  ) THEN
    ALTER TABLE sihtarica_primac RENAME COLUMN sjekacskapartija TO sjekacska_partija;
  END IF;
END $$;
