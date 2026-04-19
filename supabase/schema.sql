-- =========================================================
-- ŠIHTARICA — Supabase schema
-- Pokrenuti u Supabase SQL Editor (supabase.com > SQL Editor)
-- Idempotentno — može se pokrenuti više puta
-- =========================================================

-- 1. Primač šihtarica
CREATE TABLE IF NOT EXISTS sihtarica_primac (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  datum           DATE        NOT NULL,
  username        TEXT        NOT NULL,
  radnik          TEXT        NOT NULL,
  tip_dana        TEXT        NOT NULL CHECK (tip_dana IN ('TEREN','GODIŠNJI ODMOR','BOLOVANJE')),
  odjel           TEXT        DEFAULT '',
  gj              TEXT        DEFAULT '',
  br_linije       TEXT        DEFAULT '',
  sjekacska_partija TEXT      DEFAULT '',
  napomena        TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (datum, username)
);

-- 2. Otpremač šihtarica
CREATE TABLE IF NOT EXISTS sihtarica_otpremac (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  datum       DATE        NOT NULL,
  username    TEXT        NOT NULL,
  otpremac    TEXT        NOT NULL,
  tip_dana    TEXT        NOT NULL CHECK (tip_dana IN ('TEREN','GODIŠNJI ODMOR','BOLOVANJE')),
  odjel       TEXT        DEFAULT '',
  gj          TEXT        DEFAULT '',
  br_kamiona  TEXT        DEFAULT '',
  napomena    TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (datum, username)
);

-- 3. Ugovoreni godišnji odmor (postavlja admin)
CREATE TABLE IF NOT EXISTS sihtarica_godisnji_dani (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  username        TEXT        NOT NULL,
  fullname        TEXT        NOT NULL,
  tip             TEXT        NOT NULL CHECK (tip IN ('primac','otpremac')),
  ugovoreni_dani  INTEGER     NOT NULL DEFAULT 0,
  postavio        TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (username, tip)
);

-- 4. Privremene slike (upload sječa/otprema, 5 dana TTL)
CREATE TABLE IF NOT EXISTS temp_images (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  file_path   TEXT        NOT NULL,
  type        TEXT        NOT NULL,
  username    TEXT        NOT NULL,
  radnik      TEXT        DEFAULT '',
  entry_datum TEXT        DEFAULT '',
  entry_type  TEXT        DEFAULT '',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- 5. RLS — dozvoli anonimni pristup (auth je na app razini)
ALTER TABLE sihtarica_primac        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sihtarica_otpremac      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sihtarica_godisnji_dani ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_images             ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_all_primac"       ON sihtarica_primac        FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_otpremac"     ON sihtarica_otpremac      FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_godisnji"     ON sihtarica_godisnji_dani FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_temp_images"  ON temp_images             FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_primac_updated_at   BEFORE UPDATE ON sihtarica_primac        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_otpremac_updated_at BEFORE UPDATE ON sihtarica_otpremac      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_godisnji_updated_at BEFORE UPDATE ON sihtarica_godisnji_dani FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
