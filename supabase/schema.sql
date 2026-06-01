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

-- =========================================================
-- PRIMAC_UNOS, OTPREMAC_UNOS, PREKLASIRANJE
-- Zamjenjuju Google Sheets tabele istih naziva
-- =========================================================

CREATE TABLE IF NOT EXISTS primac_unos (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  username        TEXT        NOT NULL,
  radnik          TEXT        NOT NULL,
  datum           DATE        NOT NULL,
  odjel           TEXT        DEFAULT '',
  radiliste       TEXT        DEFAULT '',
  izvodjac        TEXT        DEFAULT '',
  poslovodja      TEXT        DEFAULT '',
  s_fl_c          NUMERIC     DEFAULT 0,
  s_i_c           NUMERIC     DEFAULT 0,
  s_ii_c          NUMERIC     DEFAULT 0,
  s_iii_c         NUMERIC     DEFAULT 0,
  s_rd            NUMERIC     DEFAULT 0,
  s_trupci_c      NUMERIC     DEFAULT 0,
  s_cel_duga      NUMERIC     DEFAULT 0,
  s_cel_cijepana  NUMERIC     DEFAULT 0,
  s_skart         NUMERIC     DEFAULT 0,
  s_cetinari      NUMERIC     DEFAULT 0,
  s_fl_l          NUMERIC     DEFAULT 0,
  s_i_l           NUMERIC     DEFAULT 0,
  s_ii_l          NUMERIC     DEFAULT 0,
  s_iii_l         NUMERIC     DEFAULT 0,
  s_trupci_l      NUMERIC     DEFAULT 0,
  s_ogr_dugi      NUMERIC     DEFAULT 0,
  s_ogr_cijepani  NUMERIC     DEFAULT 0,
  s_gule          NUMERIC     DEFAULT 0,
  s_liscari       NUMERIC     DEFAULT 0,
  s_ukupno        NUMERIC     DEFAULT 0,
  status          TEXT        DEFAULT 'PENDING',
  image_url       TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE primac_unos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "anon_all_primac_unos" ON primac_unos FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS otpremac_unos (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  username        TEXT        NOT NULL,
  otpremac        TEXT        NOT NULL,
  datum           DATE        NOT NULL,
  kupac           TEXT        DEFAULT '',
  odjel           TEXT        DEFAULT '',
  radiliste       TEXT        DEFAULT '',
  izvodjac        TEXT        DEFAULT '',
  poslovodja      TEXT        DEFAULT '',
  s_fl_c          NUMERIC     DEFAULT 0,
  s_i_c           NUMERIC     DEFAULT 0,
  s_ii_c          NUMERIC     DEFAULT 0,
  s_iii_c         NUMERIC     DEFAULT 0,
  s_rd            NUMERIC     DEFAULT 0,
  s_trupci_c      NUMERIC     DEFAULT 0,
  s_cel_duga      NUMERIC     DEFAULT 0,
  s_cel_cijepana  NUMERIC     DEFAULT 0,
  s_skart         NUMERIC     DEFAULT 0,
  s_cetinari      NUMERIC     DEFAULT 0,
  s_fl_l          NUMERIC     DEFAULT 0,
  s_i_l           NUMERIC     DEFAULT 0,
  s_ii_l          NUMERIC     DEFAULT 0,
  s_iii_l         NUMERIC     DEFAULT 0,
  s_trupci_l      NUMERIC     DEFAULT 0,
  s_ogr_dugi      NUMERIC     DEFAULT 0,
  s_ogr_cijepani  NUMERIC     DEFAULT 0,
  s_gule          NUMERIC     DEFAULT 0,
  s_liscari       NUMERIC     DEFAULT 0,
  s_ukupno        NUMERIC     DEFAULT 0,
  broj_otpremnice TEXT        DEFAULT '',
  status          TEXT        DEFAULT 'PENDING',
  image_url       TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE otpremac_unos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "anon_all_otpremac_unos" ON otpremac_unos FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS preklasiranje (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  datum           DATE        NOT NULL DEFAULT CURRENT_DATE,
  odjel           TEXT        NOT NULL,
  iz_sortimenta   TEXT        NOT NULL,
  u_sortiment     TEXT        DEFAULT '',
  kolicina        NUMERIC     DEFAULT 0,
  napomena        TEXT        DEFAULT '',
  korisnik        TEXT        DEFAULT '',
  tip             TEXT        DEFAULT 'PREKLASIRANJE',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE preklasiranje ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "anon_all_preklasiranje" ON preklasiranje FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
