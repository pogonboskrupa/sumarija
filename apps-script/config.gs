// ========================================
// 🔧 CONFIGURATION - Konstante i postavke
// ========================================
// Ovaj fajl sadrži sve konstante i konfiguracije za Šumarija API
// VAŽNO: Ažuriraj Spreadsheet ID-ove prema svom Google Drive okruženju

// ⚠️ VAŽNO: Postavi svoje Spreadsheet ID-ove ovdje
const KORISNICI_SPREADSHEET_ID = '1rpl0RiqsE6lrU9uDMTjf127By7b951rP3a5Chis9qwg'; // SUMARIJA_KORISNICI
const INDEX_SPREADSHEET_ID = '1nPkSx2fCbtHGcwdq8rDo9A3dsSt9QpcF7f0JBCg1K1I';     // SUMARIJA_INDEX (zastarjelo)
const BAZA_PODATAKA_ID = '1DIpllQlrMJwE9wpF1Gtwbnbh6ghYM5f1PimSK2gwVQQ';         // BAZA PODATAKA - glavni izvor
const ODJELI_FOLDER_ID = '1NQ0s_F4j9iRDaZafexzP5Bwyv0NXfMMK';                      // Folder sa svim odjelima
const IMAGES_FOLDER_ID = '1vtWCkjMoms4EO38zStZD9IADz859LmeI';                      // Folder za temp slike (auto-brisanje 5 dana)

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

// Cache TTL (Time To Live) - vrijeme zadržavanja podataka u kešu
// 10 minuta (bilo 3) — korisnik potvrdio da svježina agregatnih pogleda
// (dnevni/mjesečni zbirovi, pregled po odjelima, itd.) za primača/otpremača
// nije kritična; targetna invalidacija (invalidateCacheZa u services.gs) i
// dalje odmah čisti pogled koji je upravo izmijenjen unosom sječe/otpreme,
// pa produžen TTL utiče samo na NEZAVISNE posmatrače (drugi korisnici koji
// gledaju, ne mijenjaju). Duži TTL = rjeđi hladni startovi cijelog 26-pogled
// preloada (na svake 3 min → na svakih 10 min), što direktno smanjuje broj
// 404 grešaka od prekoračenja limita istovremenih Apps Script izvršavanja.
const CACHE_TTL = 600;

// ========================================
// 📊 BAZA PODATAKA - Struktura kolona
// ========================================

// INDEKS_PRIMKA kolone (A-Z, 26 kolona)
const PRIMKA_COL = {
  DATE: 0,        // A - Datum
  RADNIK: 1,      // B - Primač
  ODJEL: 2,       // C - Odjel
  RADILISTE: 3,   // D - Radilište
  IZVODJAC: 4,    // E - Izvođač
  POSLOVODJA: 5,  // F - Poslovođa
  SORT_START: 6,  // G - Početak sortimenta (F/L Č)
  SORT_END: 25,   // Z - Kraj sortimenta (UKUPNO Č+L)
  UKUPNO: 25      // Z - UKUPNO Č+L
};

// INDEKS_OTPREMA kolone (A-AA, 27 kolona)
const OTPREMA_COL = {
  DATE: 0,        // A - Datum
  OTPREMAC: 1,    // B - Otpremač
  KUPAC: 2,       // C - Kupac
  ODJEL: 3,       // D - Odjel
  RADILISTE: 4,   // E - Radilište
  IZVODJAC: 5,    // F - Izvođač
  POSLOVODJA: 6,  // G - Poslovođa
  SORT_START: 7,  // H - Početak sortimenta (F/L Č)
  SORT_END: 26,   // AA - Kraj sortimenta (UKUPNO Č+L)
  UKUPNO: 26      // AA - UKUPNO Č+L
};

// Nazivi sortimenta (20 kolona) - koristi se za oba sheeta
const SORTIMENTI_NAZIVI = [
  "F/L Č", "I Č", "II Č", "III Č", "RD", "TRUPCI Č",
  "CEL.DUGA", "CEL.CIJEPANA", "ŠKART", "Σ ČETINARI",
  "F/L L", "I L", "II L", "III L", "TRUPCI L",
  "OGR.DUGI", "OGR.CIJEPANI", "GULE", "LIŠĆARI", "UKUPNO Č+L"
];

// Dinamika po mjesecima (plan 2025) - ZASTARJELO - koristi se DINAMIKA sheet
// const DINAMIKA_2025 = [788, 2389, 6027, 5597, 6977, 6934, 7336, 6384, 6997, 7895, 5167, 2016];
