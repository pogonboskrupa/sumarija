// ==========================================
// ŠUMARIJA BOS. KRUPA — GAS DEPLOYMENT FILE
// Kombinirani fajl za ručno deployanje u Google Apps Script
// Sadrži SVE fajlove iz apps-script/ direktorija:
//   config.gs + authentication.gs + utils-triggers.gs +
//   services.gs + diagnostic.gs + api-handlers.gs + main.gs
// ==========================================

// ==========================================
// FILE: config.gs
// ==========================================
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
const CACHE_TTL = 180; // 3 minute cache (180 seconds)

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

// ==========================================
// FILE: authentication.gs
// ==========================================
// ========================================
// 🔐 AUTHENTICATION - Login i autentifikacija
// ========================================
// Ovaj fajl sadrži funkcije za autentifikaciju korisnika
// - verifyUser: Provjerava kredencijale i vraća korisnički objekt
// - handleLogin: API endpoint za login

// Helper function to verify user credentials
function verifyUser(username, password) {
  const ss = SpreadsheetApp.openById(KORISNICI_SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName('Korisnici');

  if (!usersSheet) {
    return null;
  }

  const data = usersSheet.getDataRange().getValues();

  // Check if admin
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return {
      username: username,
      ime: 'Administrator',
      uloga: 'admin',
      tip: 'admin'
    };
  }

  // Check regular users
  // Structure: A = username, B = password, C = ime_prezime, D = tip (primac/otpremac)
  for (let i = 1; i < data.length; i++) {
    const storedPassword = String(data[i][1]);
    const inputPassword = String(password);

    if (data[i][0] === username && storedPassword === inputPassword) {
      return {
        username: username,
        ime: data[i][2], // Full name
        uloga: 'user',
        tip: data[i][3] || 'user'
      };
    }
  }

  return null;
}

// Login handler
function handleLogin(username, password) {
  const ss = SpreadsheetApp.openById(KORISNICI_SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName('Korisnici'); // Sheet name: "Korisnici"

  if (!usersSheet) {
    return createJsonResponse({ error: 'Users sheet not found' }, false);
  }

  const data = usersSheet.getDataRange().getValues();

  // Struktura: A = username, B = password, C = ime_prezime, D = tip (primac/otpremac)
  for (let i = 1; i < data.length; i++) { // skip header (red 1)
    // Konverzija password u string za poređenje
    const storedPassword = String(data[i][1]);
    const inputPassword = String(password);

    if (data[i][0] === username && storedPassword === inputPassword) {
      const tip = data[i][3]; // primac ili otpremac

      return createJsonResponse({
        success: true,
        username: username,
        fullName: data[i][2], // ime_prezime je već kompletno ime
        role: 'user', // svi su radnici
        type: tip || 'Korisnik',
        userType: tip === 'primac' ? 'Primač' : (tip === 'otpremac' ? 'Otpremač' : 'Korisnik')
      }, true);
    }
  }

  return createJsonResponse({
    success: false,
    error: 'Pogrešno korisničko ime ili šifra'
  }, false);
}

// ==========================================
// FILE: utils-triggers.gs
// ==========================================
// ========================================
// 🛠️ UTILS & TRIGGERS - Utility funkcije i automatski triggeri
// ========================================
// Ovaj fajl sadrži pomoćne utility funkcije koje se koriste u cijeloj aplikaciji
// kao i setup funkcije za automatske triggere

// ========================================
// UTILITY FUNKCIJE
// ========================================

// Kreiranje prazne mjesečne statistike
function createMonthlyStats() {
  const mjeseci = [
    'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
    'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
  ];

  return mjeseci.map(mjesec => ({
    mjesec: mjesec,
    sječa: 0,
    otprema: 0
  }));
}

// Formatiranje datuma
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * KRITIČNA FUNKCIJA: Parsira datume iz Google Sheets
 *
 * PROBLEM: Google Sheets vraća datume kao Date objekte ILI stringove
 * Kada su stringovi u formatu "DD/MM/YYYY", JavaScript's new Date() ih
 * interpretira kao "MM/DD/YYYY" što uzrokuje da April i Oktobar budu zamijenjeni!
 *
 * RJEŠENJE: Ova funkcija detektuje format i parsira ispravno
 */
function parseDate(datum) {
  // Ako je već Date objekat, vrati ga direktno
  if (datum instanceof Date) {
    return datum;
  }

  // Ako je broj (timestamp), konvertuj u Date
  if (typeof datum === 'number') {
    return new Date(datum);
  }

  // Ako je string, parsuj pažljivo
  if (typeof datum === 'string') {
    const str = datum.trim();

    // Format: DD/MM/YYYY ili DD.MM.YYYY ili DD-MM-YYYY
    const ddmmyyyyPattern = /^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/;
    const match = str.match(ddmmyyyyPattern);

    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JavaScript mjeseci su 0-indexed
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    }

    // Fallback: pokušaj sa standardnim parserom (za ISO format)
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Ako ništa ne radi, vrati nevažeći datum
  return new Date(NaN);
}

// Pomoćna funkcija za JSON response
function createJsonResponse(data, success) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Helper funkcija za formatiranje datuma
function formatDateHelper(dateValue) {
  if (!dateValue) return '';

  try {
    const date = new Date(dateValue);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(dateValue);
  }
}

// ========================================
// TRIGGER SETUP FUNKCIJE
// ========================================

/**
 * Setup dnevnog triggera za sinkronizaciju stanja odjela
 * Izvršava se svaki dan u 2:00 AM
 */
function setupStanjeOdjelaDailyTrigger() {
  // Obriši postojeće triggere za ovu funkciju
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncStanjeOdjela') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Obrisan stari trigger za syncStanjeOdjela');
    }
  });

  // Kreiraj novi trigger koji se izvršava svaki dan u 2:00 AM
  ScriptApp.newTrigger('syncStanjeOdjela')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();

  Logger.log('Kreiran novi dnevni trigger za syncStanjeOdjela (izvršavanje u 2:00 AM)');

  // Odmah izvrši prvi put
  syncStanjeOdjela();
}

/**
 * Briši slike starije od 5 dana iz IMAGES_FOLDER_ID
 */
function deleteOldImages() {
  try {
    const folder = DriveApp.getFolderById(IMAGES_FOLDER_ID);
    const files = folder.getFiles();
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    let deletedCount = 0;
    while (files.hasNext()) {
      const file = files.next();
      if (file.getDateCreated() < fiveDaysAgo) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
    Logger.log('Obrisano ' + deletedCount + ' slika starijih od 5 dana');
  } catch (error) {
    Logger.log('ERROR deleteOldImages: ' + error.toString());
  }
}

/**
 * Setup dnevnog triggera za brisanje starih slika
 */
function setupDeleteOldImagesTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'deleteOldImages') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('deleteOldImages')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();

  Logger.log('Kreiran trigger za deleteOldImages (izvršavanje u 3:00 AM)');
}

// ==========================================
// FILE: services.gs
// ==========================================
// ========================================
// 📊 SERVICES - Data Processing, Cache, Sync
// ========================================

// ========================================
// 1. DATA PROCESSING FUNKCIJE
// ========================================

/**
 * Dohvati dinamiku (plan) za godinu iz DINAMIKA sheeta
 * Čita iz K3:K14 (Jan=K3 ... Dec=K14) - vertikalni raspon
 * Prikazuje samo mjesece <= trenutni mjesec (budući mjeseci = 0)
 * @param {number} year - Godina za koju se traži dinamika
 * @returns {Array} - Niz od 12 vrijednosti za svaki mjesec
 */
function getDinamikaForYear(year) {
  try {
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    let dinamikaSheet = ss.getSheetByName("DINAMIKA");

    // Ako sheet ne postoji, vrati nule
    if (!dinamikaSheet) {
      Logger.log('DINAMIKA sheet does not exist, returning zeros');
      return Array(12).fill(0);
    }

    // Dohvati trenutni mjesec (1-12) u Europe/Sarajevo timezone
    const now = new Date();
    const sarajevoTime = Utilities.formatDate(now, "Europe/Sarajevo", "M");
    const currentMonth = parseInt(sarajevoTime);
    const currentYear = parseInt(Utilities.formatDate(now, "Europe/Sarajevo", "yyyy"));

    Logger.log('getDinamikaForYear: year=' + year + ', currentMonth=' + currentMonth + ', currentYear=' + currentYear);

    // Čitaj K3:K14 (kolona K = 11, redovi 3-14) - plan za sve mjesece
    const planRange = dinamikaSheet.getRange("K3:K14");
    const planValues = planRange.getValues();

    // Primijeni pravilo: prikaži samo mjesece <= currentMonth (za trenutnu godinu)
    // Za prošle godine prikaži sve, za buduće godine prikaži ništa
    const mjesecneVrijednosti = [];
    for (let i = 0; i < 12; i++) {
      const mjesec = i + 1; // 1-12
      const planValue = parseFloat(planValues[i][0]) || 0;

      let dinamikaShown = 0;
      if (parseInt(year) < currentYear) {
        // Prošla godina - prikaži sve mjesece
        dinamikaShown = planValue;
      } else if (parseInt(year) === currentYear) {
        // Trenutna godina - prikaži samo do trenutnog mjeseca
        dinamikaShown = (mjesec <= currentMonth) ? planValue : 0;
      }
      // Buduća godina - sve ostaje 0

      mjesecneVrijednosti.push(dinamikaShown);
    }

    Logger.log('getDinamikaForYear: Returning dinamika for year ' + year + ': ' + JSON.stringify(mjesecneVrijednosti));
    return mjesecneVrijednosti;

  } catch (error) {
    Logger.log('ERROR in getDinamikaForYear: ' + error.toString());
    return Array(12).fill(0);
  }
}

function handleStats(year, username, password) {
  // Prvo provjerimo autentikaciju
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: 'Unauthorized' }, false);
  }

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const primkaSheet = ss.getSheetByName('INDEKS_PRIMKA');
  const otpremaSheet = ss.getSheetByName('INDEKS_OTPREMA');

  if (!primkaSheet || !otpremaSheet) {
    return createJsonResponse({ error: 'Required sheets not found' }, false);
  }

  // Čitaj podatke
  const primkaData = primkaSheet.getDataRange().getValues();
  const otpremaData = otpremaSheet.getDataRange().getValues();

  // Obradi podatke
  const stats = {
    totalPrimka: 0,
    totalOtprema: 0,
    monthlyStats: createMonthlyStats(),
    odjeliStats: {}
  };

  // Procesiranje PRIMKA podataka
  processPrimkaData(primkaData, stats, year);

  // Procesiranje OTPREMA podataka
  processOtpremaData(otpremaData, stats, year);

  // Čitanje projekata i ostvarenja za svaki odjel
  processOdjeliDetails(primkaSheet, stats);

  return createJsonResponse(stats, true);
}

function processPrimkaData(data, stats, year) {
  // INDEKS_PRIMKA nova struktura:
  // A: DATE, B: RADNIK, C: ODJEL, D: RADILIŠTE, E: IZVOĐAČ, F-Y: SORTIMENTI, Y: UKUPNO Č+L

  Logger.log('=== PRIMKA DEBUG ===');
  Logger.log('Total rows in PRIMKA: ' + data.length);

  let processedRows = 0;
  let skippedNoDatum = 0;
  let skippedWrongYear = 0;
  let totalSum = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const odjel = row[PRIMKA_COL.ODJEL];     // C - Odjel
    const datum = row[PRIMKA_COL.DATE];      // A - Datum
    const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO Č+L

    if (!datum || !odjel) {
      skippedNoDatum++;
      continue;
    }

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) {
      skippedWrongYear++;
      continue;
    }

    processedRows++;
    totalSum += kubik;

    if (processedRows <= 5) {
      Logger.log('Row ' + i + ': Odjel=' + odjel + ', Datum=' + datum + ', Kubik=' + kubik);
    }

    // Ukupna primka
    stats.totalPrimka += kubik;

    // Mjesečna statistika
    const mjesec = datumObj.getMonth();
    stats.monthlyStats[mjesec].sječa += kubik;

    // Statistika po odjelima
    if (!stats.odjeliStats[odjel]) {
      stats.odjeliStats[odjel] = {
        sječa: 0,
        otprema: 0,
        zadnjaSjeca: 0,
        datumZadnjeSjece: '',
        projekat: 0,
        ukupnoPosjeklo: 0,
        zadnjiDatum: null
      };
    }

    stats.odjeliStats[odjel].sječa += kubik;

    // Provjeri da li je ovo zadnja sječa za odjel
    if (!stats.odjeliStats[odjel].zadnjiDatum || datumObj > stats.odjeliStats[odjel].zadnjiDatum) {
      stats.odjeliStats[odjel].zadnjiDatum = datumObj;
      stats.odjeliStats[odjel].zadnjaSjeca = kubik;
      stats.odjeliStats[odjel].datumZadnjeSjece = formatDate(datumObj);
    }
  }

  Logger.log('Processed rows: ' + processedRows);
  Logger.log('Skipped (no datum/odjel): ' + skippedNoDatum);
  Logger.log('Skipped (wrong year): ' + skippedWrongYear);
  Logger.log('Total PRIMKA sum: ' + totalSum);
  Logger.log('=== END PRIMKA DEBUG ===');
}

function processOtpremaData(data, stats, year) {
  // INDEKS_OTPREMA nova struktura:
  // A: DATE, B: OTPREMAČ, C: KUPAC, D: ODJEL, E: RADILIŠTE, F: IZVOĐAČ, G-Z: SORTIMENTI, Z: UKUPNO Č+L

  Logger.log('=== OTPREMA DEBUG ===');
  Logger.log('Total rows in OTPREMA: ' + data.length);

  let processedRows = 0;
  let skippedNoDatum = 0;
  let skippedWrongYear = 0;
  let totalSum = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const odjel = row[OTPREMA_COL.ODJEL];    // D - Odjel
    const datum = row[OTPREMA_COL.DATE];     // A - Datum
    const kubik = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0; // Z - UKUPNO Č+L

    if (!datum || !odjel) {
      skippedNoDatum++;
      continue;
    }

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) {
      skippedWrongYear++;
      continue;
    }

    processedRows++;
    totalSum += kubik;

    if (processedRows <= 5) {
      Logger.log('Row ' + i + ': Odjel=' + odjel + ', Datum=' + datum + ', Kubik=' + kubik);
    }

    stats.totalOtprema += kubik;

    const mjesec = datumObj.getMonth();
    stats.monthlyStats[mjesec].otprema += kubik;

    if (!stats.odjeliStats[odjel]) {
      stats.odjeliStats[odjel] = {
        sječa: 0,
        otprema: 0,
        zadnjaSjeca: 0,
        datumZadnjeSjece: '',
        projekat: 0,
        ukupnoPosjeklo: 0
      };
    }

    stats.odjeliStats[odjel].otprema += kubik;
  }

  Logger.log('Processed rows: ' + processedRows);
  Logger.log('Skipped (no datum/odjel): ' + skippedNoDatum);
  Logger.log('Skipped (wrong year): ' + skippedWrongYear);
  Logger.log('Total OTPREMA sum: ' + totalSum);
  Logger.log('=== END OTPREMA DEBUG ===');
}

function processOdjeliDetails(primkaSheet, stats) {
  // INDEX_PRIMKA sada ima strukturu: Odjel(A) | Datum(B) | Primač(C) | Sortimenti(D-U)
  // Ne sadrži podatke o projektovanoj masi i ukupno poseklo
  // Postavi default vrednosti za sve odjele

  for (let odjel in stats.odjeliStats) {
    stats.odjeliStats[odjel].projekat = 0;
    stats.odjeliStats[odjel].ukupnoPosjeklo = stats.odjeliStats[odjel].sječa; // Ukupno poseklo = sječa
  }

  Logger.log('processOdjeliDetails: postavljene default vrednosti (projekat=0, ukupnoPosjeklo=sječa)');
}

// ========================================
// 2. CACHE FUNKCIJE
// ========================================

function getCachedData(key) {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(key);

    if (cached) {
      Logger.log(`[CACHE] HIT: ${key}`);
      return JSON.parse(cached);
    }

    Logger.log(`[CACHE] MISS: ${key}`);
    return null;
  } catch (error) {
    Logger.log(`[CACHE] Error reading cache for ${key}: ${error}`);
    return null;
  }
}

function setCachedData(key, data, ttl = CACHE_TTL) {
  try {
    const cache = CacheService.getScriptCache();
    cache.put(key, JSON.stringify(data), ttl);
    Logger.log(`[CACHE] SET: ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    Logger.log(`[CACHE] Error writing cache for ${key}: ${error}`);
    return false;
  }
}

function invalidateAllCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll();
    Logger.log('[CACHE] Invalidated all cache entries');
    return true;
  } catch (error) {
    Logger.log(`[CACHE] Error invalidating cache: ${error}`);
    return false;
  }
}

function invalidateCacheForYear(year) {
  try {
    const cache = CacheService.getScriptCache();
    // Remove all common cache keys for this year
    const keysToRemove = [
      `dashboard_${year}`,
      `primaci_${year}`,
      `otpremaci_${year}`,
      `kupci_${year}`,
      `mjesecni_sortimenti_${year}`,
      `stats_${year}`
    ];

    keysToRemove.forEach(key => cache.remove(key));
    Logger.log(`[CACHE] Invalidated cache for year ${year}`);
    return true;
  } catch (error) {
    Logger.log(`[CACHE] Error invalidating cache for year: ${error}`);
    return false;
  }
}

// ========================================
// 3. SYNC FUNKCIJE
// ========================================

function syncIndexSheet() {
  Logger.log('=== SYNC INDEX START ===');
  const startTime = new Date();

  try {
    // 1. Otvori BAZA_PODATAKA spreadsheet
    const bazaPodataka = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const indexPrimkaSheet = bazaPodataka.getSheetByName('INDEKS_PRIMKA');
    const indexOtpremaSheet = bazaPodataka.getSheetByName('INDEKS_OTPREMA');

    if (!indexPrimkaSheet || !indexOtpremaSheet) {
      throw new Error('INDEKS_PRIMKA ili INDEKS_OTPREMA sheet nije pronađen u BAZA_PODATAKA!');
    }

    Logger.log('BAZA_PODATAKA sheets otvoreni uspješno');

    // 2. Obriši sve podatke (osim header-a u redu 1)
    Logger.log('Brisanje starih podataka...');
    if (indexPrimkaSheet.getLastRow() > 1) {
      indexPrimkaSheet.deleteRows(2, indexPrimkaSheet.getLastRow() - 1);
    }
    if (indexOtpremaSheet.getLastRow() > 1) {
      indexOtpremaSheet.deleteRows(2, indexOtpremaSheet.getLastRow() - 1);
    }

    // 3. Otvori folder ODJELI
    Logger.log('Otvaranje foldera ODJELI: ' + ODJELI_FOLDER_ID);
    const folder = DriveApp.getFolderById(ODJELI_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

    let primkaRows = [];
    let otpremaRows = [];
    let processedCount = 0;
    let errorCount = 0;

    // 4. Iteriraj kroz sve spreadsheet-ove u folderu
    Logger.log('Počinjem čitanje spreadsheet-ova...');
    while (files.hasNext()) {
      const file = files.next();
      const odjelNaziv = file.getName(); // Naziv fajla = Odjel
      processedCount++;

      try {
        const ss = SpreadsheetApp.open(file);
        Logger.log(`[${processedCount}] Processing: ${odjelNaziv}`);

        // Pročitaj PRIMKA sheet
        const primkaSheet = ss.getSheetByName('PRIMKA');

        // Čitaj RADILIŠTE (W2) i IZVOĐAČ (W3) iz PRIMKA sheet-a
        let radiliste = '';
        let izvodjac = '';
        if (primkaSheet) {
          try {
            const w2Value = primkaSheet.getRange('W2').getValue();
            if (w2Value && String(w2Value).trim() !== '') {
              radiliste = String(w2Value).trim();
            }
            const w3Value = primkaSheet.getRange('W3').getValue();
            if (w3Value && String(w3Value).trim() !== '') {
              izvodjac = String(w3Value).trim();
            }
          } catch (e) {
            Logger.log(`  Greška pri čitanju W2/W3: ${e.toString()}`);
          }
        }

        if (primkaSheet) {
          const lastRow = primkaSheet.getLastRow();
          Logger.log(`  PRIMKA: ${lastRow} redova (total), radiliste="${radiliste}", izvodjac="${izvodjac}"`);

          if (lastRow > 1) {
            const data = primkaSheet.getDataRange().getValues();
            let addedRows = 0;

            // PRIMKA struktura iz odjela: PRAZNA(A) | DATUM(B) | PRIMAČ(C) | sortimenti(D-W)
            // INDEKS_PRIMKA nova struktura: DATUM(A) | RADNIK(B) | ODJEL(C) | RADILIŠTE(D) | IZVOĐAČ(E) | sortimenti(F-Y)
            for (let i = 1; i < data.length; i++) {
              const row = data[i];
              const datum = row[1]; // kolona B - datum
              const primac = row[2]; // kolona C - primač

              // Debug logging za prvi spreadsheet (prvih 20 redova)
              if (processedCount === 1 && i <= 20) {
                Logger.log(`    Red ${i}: datum="${datum}" (${typeof datum}), primac="${primac}"`);
              }

              // Preskači redove bez datuma ili primaca
              if (!datum || datum === '' || datum === 0) {
                if (processedCount === 1 && i <= 20) Logger.log(`      → Skip: nema datum`);
                continue;
              }

              if (!primac || primac === '' || primac === 0) {
                if (processedCount === 1 && i <= 20) Logger.log(`      → Skip: nema primac`);
                continue;
              }

              // Preskači header redove - provjeri i datum i primača
              const datumStr = String(datum).toUpperCase();
              const primacStr = String(primac).toUpperCase();

              if (datumStr.includes('OPIS') || datumStr.includes('#') ||
                  datumStr.includes('PLAN') || datumStr.includes('REAL') ||
                  datumStr.includes('DATUM') || datumStr === 'DATUM' ||
                  primacStr.includes('PRIMAC') || primacStr === 'PRIMAC' ||
                  primacStr.includes('PRIMAČ') || primacStr === 'PRIMAČ') {
                if (processedCount === 1 && i <= 20) Logger.log(`      → Skip: header (datum="${datum}", primac="${primac}")`);
                continue;
              }

              // Nova struktura: [DATUM, RADNIK/PRIMAČ, ODJEL, RADILIŠTE, IZVOĐAČ, ...sortimenti(20 kolona)]
              const sortimenti = row.slice(3, 23); // D-W (20 kolona sortimenti)
              const newRow = [datum, primac, odjelNaziv, radiliste, izvodjac, ...sortimenti];
              primkaRows.push(newRow);
              addedRows++;

              if (processedCount === 1 && addedRows <= 3) {
                Logger.log(`      ✓ Dodano red ${addedRows}: "${datum}" | "${primac}" | "${odjelNaziv}" | "${radiliste}" | "${izvodjac}"`);
              }
            }
            Logger.log(`  PRIMKA: dodano ${addedRows} redova`);
          } else {
            Logger.log(`  PRIMKA: preskočeno (samo header)`);
          }
        } else {
          Logger.log(`  PRIMKA: sheet ne postoji`);
        }

        // Pročitaj OTPREMA sheet
        const otpremaSheet = ss.getSheetByName('OTPREMA');
        if (otpremaSheet) {
          const lastRow = otpremaSheet.getLastRow();
          Logger.log(`  OTPREMA: ${lastRow} redova (total)`);

          if (lastRow > 1) {
            const data = otpremaSheet.getDataRange().getValues();
            let addedRows = 0;

            // OTPREMA struktura iz odjela: kupac(A) | datum(B) | otpremač(C) | sortimenti(D-W)
            // INDEKS_OTPREMA nova struktura: DATUM(A) | OTPREMAČ(B) | KUPAC(C) | ODJEL(D) | RADILIŠTE(E) | IZVOĐAČ(F) | sortimenti(G-Z)
            for (let i = 1; i < data.length; i++) {
              const row = data[i];
              const kupac = row[0]; // kolona A - kupac
              const datum = row[1]; // kolona B - datum
              const otpremac = row[2]; // kolona C - otpremač

              // Debug logging za prvi spreadsheet (prvih 20 redova)
              if (processedCount === 1 && i <= 20) {
                Logger.log(`    Red ${i}: kupac="${kupac}", datum="${datum}" (${typeof datum}), otpremac="${otpremac}"`);
              }

              // Preskači redove bez datuma ili otpremača
              if (!datum || datum === '' || datum === 0) {
                if (processedCount === 1 && i <= 20) Logger.log(`      → Skip: nema datum`);
                continue;
              }

              if (!otpremac || otpremac === '' || otpremac === 0) {
                if (processedCount === 1 && i <= 20) Logger.log(`      → Skip: nema otpremač`);
                continue;
              }

              // Preskači header redove - provjeri i datum i otpremača
              const datumStr = String(datum).toUpperCase();
              const otpremacStr = String(otpremac).toUpperCase();

              if (datumStr.includes('OPIS') || datumStr.includes('#') ||
                  datumStr.includes('PLAN') || datumStr.includes('REAL') ||
                  datumStr.includes('DATUM') || datumStr.includes('KUPCI') ||
                  datumStr.includes('UČINCI') || datumStr === 'DATUM' ||
                  otpremacStr.includes('OTPREMAČ') || otpremacStr === 'OTPREMAČ' ||
                  otpremacStr.includes('OTPREMAC') || otpremacStr === 'OTPREMAC') {
                if (processedCount === 1 && i <= 20) Logger.log(`      → Skip: header (datum="${datum}", otpremac="${otpremac}")`);
                continue;
              }

              // Nova struktura: [DATUM, OTPREMAČ, KUPAC, ODJEL, RADILIŠTE, IZVOĐAČ, ...sortimenti(20 kolona)]
              const sortimenti = row.slice(3, 23); // D-W (20 kolona sortimenti)
              const newRow = [datum, otpremac, kupac, odjelNaziv, radiliste, izvodjac, ...sortimenti];
              otpremaRows.push(newRow);
              addedRows++;

              if (processedCount === 1 && addedRows <= 3) {
                Logger.log(`      ✓ Dodano red ${addedRows}: "${datum}" | "${otpremac}" | kupac="${kupac}" | "${odjelNaziv}" | "${radiliste}" | "${izvodjac}"`);
              }
            }
            Logger.log(`  OTPREMA: dodano ${addedRows} redova`);
          } else {
            Logger.log(`  OTPREMA: preskočeno (samo header)`);
          }
        } else {
          Logger.log(`  OTPREMA: sheet ne postoji`);
        }

      } catch (error) {
        errorCount++;
        Logger.log(`ERROR processing ${odjelNaziv}: ${error.toString()}`);
      }
    }

    Logger.log(`Pročitano spreadsheet-ova: ${processedCount}`);
    Logger.log(`PRIMKA redova: ${primkaRows.length}`);
    Logger.log(`OTPREMA redova: ${otpremaRows.length}`);

    // 5. Sortiraj po datumu (kolona A = index 0)
    Logger.log('Sortiranje podataka po datumu...');
    primkaRows.sort((a, b) => {
      const dateA = parseDate(a[0]);
      const dateB = parseDate(b[0]);
      return dateA - dateB;
    });

    otpremaRows.sort((a, b) => {
      const dateA = parseDate(a[0]);
      const dateB = parseDate(b[0]);
      return dateA - dateB;
    });

    // 6. Normalizuj broj kolona (svi redovi moraju imati isti broj kolona kao INDEKS sheet)
    Logger.log('Normalizacija broja kolona...');
    const indexPrimkaHeaderCols = indexPrimkaSheet.getLastColumn();
    const indexOtpremaHeaderCols = indexOtpremaSheet.getLastColumn();

    Logger.log(`INDEKS_PRIMKA header kolone: ${indexPrimkaHeaderCols}`);
    Logger.log(`INDEKS_OTPREMA header kolone: ${indexOtpremaHeaderCols}`);

    // Normalizuj PRIMKA redove
    primkaRows = primkaRows.map(row => {
      if (row.length > indexPrimkaHeaderCols) {
        // Odreži višak kolona
        return row.slice(0, indexPrimkaHeaderCols);
      } else if (row.length < indexPrimkaHeaderCols) {
        // Dodaj prazne ćelije
        const padding = new Array(indexPrimkaHeaderCols - row.length).fill('');
        return row.concat(padding);
      }
      return row;
    });

    // Normalizuj OTPREMA redove
    otpremaRows = otpremaRows.map(row => {
      if (row.length > indexOtpremaHeaderCols) {
        return row.slice(0, indexOtpremaHeaderCols);
      } else if (row.length < indexOtpremaHeaderCols) {
        const padding = new Array(indexOtpremaHeaderCols - row.length).fill('');
        return row.concat(padding);
      }
      return row;
    });

    // 7. Upiši podatke u INDEKS sheet-ove
    Logger.log('Upisivanje podataka u INDEKS sheet-ove...');
    if (primkaRows.length > 0) {
      indexPrimkaSheet.getRange(2, 1, primkaRows.length, indexPrimkaHeaderCols).setValues(primkaRows);
      Logger.log(`✓ INDEKS_PRIMKA: upisano ${primkaRows.length} redova`);
    }

    if (otpremaRows.length > 0) {
      indexOtpremaSheet.getRange(2, 1, otpremaRows.length, indexOtpremaHeaderCols).setValues(otpremaRows);
      Logger.log(`✓ INDEKS_OTPREMA: upisano ${otpremaRows.length} redova`);
    }

    // 🚀 CACHE: Invalidate all cache after successful sync
    invalidateAllCache();

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // sekunde

    Logger.log('=== SYNC INDEX COMPLETE ===');
    Logger.log(`Trajanje: ${duration} sekundi`);
    Logger.log(`Procesovano spreadsheet-ova: ${processedCount}`);
    Logger.log(`Greške: ${errorCount}`);
    Logger.log(`PRIMKA redova: ${primkaRows.length}`);
    Logger.log(`OTPREMA redova: ${otpremaRows.length}`);

    return {
      success: true,
      duration: duration,
      processedSpreadsheets: processedCount,
      errors: errorCount,
      primkaRows: primkaRows.length,
      otpremaRows: otpremaRows.length
    };

  } catch (error) {
    Logger.log('=== SYNC INDEX FAILED ===');
    Logger.log('ERROR: ' + error.toString());
    throw error;
  }
}

function syncStanjeOdjela() {
  try {
    Logger.log('=== SYNC STANJE ODJELA START ===');
    Logger.log('Vrijeme sinkronizacije: ' + new Date().toString());

    // Fiksno sortimentno zaglavlje (D-W kolone, 20 sortimenta)
    const sortimentiNazivi = [
      'F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'TRUPCI Č',
      'CEL.DUGA', 'CEL.CIJEPANA', 'ŠKART', 'Σ ČETINARI',
      'F/L L', 'I L', 'II L', 'III L', 'TRUPCI L',
      'OGR. DUGI', 'OGR. CIJEPANI', 'GULE', 'LIŠĆARI',
      'UKUPNO Č+L'
    ];

    // Otvori folder ODJELI
    const folder = DriveApp.getFolderById(ODJELI_FOLDER_ID);
    const files = folder.getFiles();

    const odjeliData = [];

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      // Skip fajl ODJELI (glavni fajl)
      if (fileName.toUpperCase().includes('ODJELI') && !fileName.includes(' ')) {
        continue;
      }

      try {
        Logger.log('Processing fajl: ' + fileName);

        const spreadsheet = SpreadsheetApp.open(file);
        const otpremaSheet = spreadsheet.getSheetByName('OTPREMA');
        const primkaSheet = spreadsheet.getSheetByName('PRIMKA');

        if (!otpremaSheet) {
          Logger.log('OTPREMA sheet ne postoji u fajlu: ' + fileName);
          continue;
        }

        // Čitaj naziv radilišta iz PRIMKA sheet, W2 (red 2, kolona 23)
        let radilisteNaziv = fileName; // Fallback ako W2 ne postoji
        let izvodjacNaziv = ''; // W3 - izvođač
        if (primkaSheet) {
          try {
            const w2Cell = primkaSheet.getRange(2, 23); // Red 2, kolona W (23)
            const w2Value = w2Cell.getValue();
            if (w2Value && w2Value.toString().trim() !== '') {
              radilisteNaziv = w2Value.toString().trim();
            }

            const w3Cell = primkaSheet.getRange(3, 23); // Red 3, kolona W (23)
            const w3Value = w3Cell.getValue();
            if (w3Value && w3Value.toString().trim() !== '') {
              izvodjacNaziv = w3Value.toString().trim();
            }
          } catch (e) {
            Logger.log('Greška pri čitanju W2/W3: ' + e.toString());
          }
        }

        // Čitaj cijele redove 10-13 (od kolone A do kraja)
        const lastColumn = otpremaSheet.getLastColumn();
        const dataRange = otpremaSheet.getRange(10, 1, 4, lastColumn); // Redovi 10-13, od kolone A
        const dataValues = dataRange.getValues();

        const projekat = dataValues[0]; // Cijeli red PROJEKAT
        const sjeca = dataValues[1]; // Cijeli red SJEČA
        const otprema = dataValues[2]; // Cijeli red OTPREMA
        const sumaLager = dataValues[3]; // Cijeli red ZALIHA

        // Pronađi najsvježiji datum iz PRIMKA sheet
        let zadnjiDatum = null;
        if (primkaSheet) {
          const primkaData = primkaSheet.getDataRange().getValues();

          for (let i = 1; i < primkaData.length; i++) {
            const row = primkaData[i];
            const datum = row[0]; // Kolona A - datum

            if (!datum) continue;

            const datumObj = parseDate(datum);
            if (!datumObj || isNaN(datumObj.getTime())) continue;

            if (!zadnjiDatum || datumObj > zadnjiDatum) {
              zadnjiDatum = datumObj;
            }
          }
        }

        odjeliData.push({
          odjelNaziv: fileName,
          radiliste: radilisteNaziv,
          izvodjac: izvodjacNaziv,
          zadnjiDatum: zadnjiDatum ? zadnjiDatum.getTime() : null, // Sačuvaj kao timestamp
          redovi: {
            projekat: projekat,
            sjeca: sjeca,
            otprema: otprema,
            sumaLager: sumaLager
          }
        });

      } catch (error) {
        Logger.log('Greška pri obradi fajla ' + fileName + ': ' + error.toString());
      }
    }

    // Sortiraj po najsvježijem datumu (najnoviji prvo)
    odjeliData.sort((a, b) => {
      if (!a.zadnjiDatum && !b.zadnjiDatum) return 0;
      if (!a.zadnjiDatum) return 1;
      if (!b.zadnjiDatum) return -1;
      return b.zadnjiDatum - a.zadnjiDatum;
    });

    Logger.log('Broj odjela prije filtriranja: ' + odjeliData.length);

    // FILTRIRANJE ODJELA prema godini i kvartalu
    const currentYear = new Date().getFullYear(); // 2026
    const previousYear = currentYear - 1; // 2025

    const filteredOdjeliData = odjeliData.filter(odjel => {
      if (!odjel.zadnjiDatum) {
        // Ako nema datum, preskoči
        return false;
      }

      const datum = new Date(odjel.zadnjiDatum);
      const year = datum.getFullYear();
      const month = datum.getMonth() + 1; // 1-12
      const quarter = Math.ceil(month / 3); // 1-4

      // Tekuća godina: prikaži samo ako ima sječu ILI otpremu (SVEUKUPNO > 0)
      if (year === currentYear) {
        const sjecaSveukupno = odjel.redovi.sjeca[odjel.redovi.sjeca.length - 1] || 0; // Zadnji element je SVEUKUPNO
        const otpremaSveukupno = odjel.redovi.otprema[odjel.redovi.otprema.length - 1] || 0;

        if (sjecaSveukupno > 0 || otpremaSveukupno > 0) {
          return true;
        }
        return false;
      }

      // Prošla godina: prikaži samo zadnji kvartal (Q4)
      if (year === previousYear) {
        return quarter === 4;
      }

      // Sve ostale godine: ne prikazuj
      return false;
    });

    Logger.log('Broj odjela nakon filtriranja: ' + filteredOdjeliData.length);

    // Sada zapiši sve podatke na cache sheet u BAZA_PODATAKA
    const bazaPodataka = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    let cacheSheet = bazaPodataka.getSheetByName('STANJE_ODJELA_CACHE');

    // Kreiraj sheet ako ne postoji
    if (!cacheSheet) {
      Logger.log('Kreiram novi sheet: STANJE_ODJELA_CACHE');
      cacheSheet = bazaPodataka.insertSheet('STANJE_ODJELA_CACHE');
    }

    // Očisti sheet
    cacheSheet.clear();

    // Postavi zaglavlje - Red Tip + Odjel info + cijeli red iz OTPREMA
    const headerRow = ['Red Tip', 'Odjel Naziv', 'Radilište', 'Izvođač', 'Zadnji Datum'];
    cacheSheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
    cacheSheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');

    // Pripremi podatke za upis
    const dataRows = [];
    filteredOdjeliData.forEach(odjel => {
      const datumFormatted = odjel.zadnjiDatum ? new Date(odjel.zadnjiDatum).toLocaleDateString('sr-RS') : '';

      // 4 reda po odjelu: PROJEKAT, SJEČA, OTPREMA, ZALIHA
      // Red Tip je prva kolona, zatim odjel info, pa cijeli red iz OTPREMA sheeta
      dataRows.push(['PROJEKAT', odjel.odjelNaziv, odjel.radiliste, odjel.izvodjac || '', datumFormatted, ...odjel.redovi.projekat]);
      dataRows.push(['SJEČA', odjel.odjelNaziv, odjel.radiliste, odjel.izvodjac || '', datumFormatted, ...odjel.redovi.sjeca]);
      dataRows.push(['OTPREMA', odjel.odjelNaziv, odjel.radiliste, odjel.izvodjac || '', datumFormatted, ...odjel.redovi.otprema]);
      dataRows.push(['ZALIHA', odjel.odjelNaziv, odjel.radiliste, odjel.izvodjac || '', datumFormatted, ...odjel.redovi.sumaLager]);
    });

    // Zapiši podatke
    if (dataRows.length > 0) {
      cacheSheet.getRange(2, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
      Logger.log('Zapisano ' + dataRows.length + ' redova na cache sheet');
    }

    // Dodaj timestamp zadnjeg ažuriranja u A1
    const metadataRow = ['ZADNJE AŽURIRANJE: ' + new Date().toLocaleString('sr-RS')];
    cacheSheet.insertRowBefore(1);
    cacheSheet.getRange(1, 1, 1, metadataRow.length).setValues([metadataRow]);
    cacheSheet.getRange(1, 1).setFontWeight('bold').setFontColor('blue');

    Logger.log('=== SYNC STANJE ODJELA END ===');
    return { success: true, odjeliCount: filteredOdjeliData.length, rowsWritten: dataRows.length };

  } catch (error) {
    Logger.log('=== SYNC STANJE ODJELA ERROR ===');
    Logger.log(error.toString());
    throw error;
  }
}

// ========================================
// 4. INCREMENTAL INDEX SYNC - INDEKS_DODAJ_NOVE
// Dodaje samo nove unose umjesto full rebuild
// ========================================

// Konfiguracija za indeksiranje
const IDX_CFG = {
  TARGET_SS_ID: BAZA_PODATAKA_ID,        // BAZA PODATAKA spreadsheet
  FOLDER_ID: ODJELI_FOLDER_ID,           // Folder sa odjelima
  INDEX_PRIMKA: 'INDEKS_PRIMKA',
  INDEX_OTPREMA: 'INDEKS_OTPREMA'
};

// Property keys za čuvanje stanja
const IDX_PROP = {
  DODAJ_LAST_UPDATED_MAP: 'INDEKS_DODAJ_LAST_UPDATED_MAP'
};

/**
 * INDEKS_DODAJ_NOVE - Dodaje samo nove/izmijenjene fajlove u indeks
 * Koristi lastUpdated timestamp za praćenje promjena
 */
function INDEKS_DODAJ_NOVE() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('DODAJ: zaključano (drugi run radi). Pokušaj ponovo.');
    return { success: false, message: 'Lock active - retry later' };
  }

  try {
    Logger.log('=== INDEKS_DODAJ_NOVE START ===');
    const props = PropertiesService.getScriptProperties();
    const map = JSON.parse(props.getProperty(IDX_PROP.DODAJ_LAST_UPDATED_MAP) || '{}');

    const tss = SpreadsheetApp.openById(IDX_CFG.TARGET_SS_ID);
    const shP = IDX_getOrCreateSheet_(tss, IDX_CFG.INDEX_PRIMKA);
    const shO = IDX_getOrCreateSheet_(tss, IDX_CFG.INDEX_OTPREMA);

    // Provjeri/dodaj header ako je prazan sheet
    if (shP.getLastRow() < 1) IDX_writeHeaderPrimka_(shP);
    if (shO.getLastRow() < 1) IDX_writeHeaderOtprema_(shO);

    const folder = DriveApp.getFolderById(IDX_CFG.FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

    const primkaIncoming = [];
    const otpremaIncoming = [];
    let filesProcessed = 0;
    let filesSkipped = 0;

    while (files.hasNext()) {
      const f = files.next();
      const id = f.getId();
      const updated = f.getLastUpdated().getTime();
      const last = Number(map[id] || 0);

      // Preskoči ako nije ažurirano od zadnjeg indeksiranja
      if (updated <= last) {
        filesSkipped++;
        continue;
      }

      map[id] = updated;
      filesProcessed++;

      try {
        const res = IDX_readOneFileBoth_(id);
        primkaIncoming.push(...res.primka);
        otpremaIncoming.push(...res.otprema);
        Logger.log(`Processed: ${f.getName()} - PRIMKA: ${res.primka.length}, OTPREMA: ${res.otprema.length}`);
      } catch (e) {
        Logger.log(`DODAJ SKIP ${id}: ${e && e.message ? e.message : e}`);
      }
    }

    // Dodaj samo jedinstvene redove (izbjegni duplikate)
    const primkaAdded = IDX_appendUnique_(shP, primkaIncoming, IDX_primkaKey_);
    const otpremaAdded = IDX_appendUnique_(shO, otpremaIncoming, IDX_otpremaKey_);

    // Sortiraj po datumu
    IDX_sortIndexByDate_(shP);
    IDX_sortIndexByDate_(shO);

    // Formatiraj datum kolonu
    IDX_formatDateCol_(shP, 1);
    IDX_formatDateCol_(shO, 1);

    // Sačuvaj mapu
    props.setProperty(IDX_PROP.DODAJ_LAST_UPDATED_MAP, JSON.stringify(map));

    Logger.log(`=== INDEKS_DODAJ_NOVE END ===`);
    Logger.log(`Files processed: ${filesProcessed}, skipped: ${filesSkipped}`);
    Logger.log(`PRIMKA added: ${primkaAdded}, OTPREMA added: ${otpremaAdded}`);

    return {
      success: true,
      filesProcessed: filesProcessed,
      filesSkipped: filesSkipped,
      primkaAdded: primkaAdded,
      otpremaAdded: otpremaAdded
    };

  } catch (error) {
    Logger.log('=== INDEKS_DODAJ_NOVE ERROR ===');
    Logger.log(error.toString());
    return { success: false, error: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Helper: Get or create sheet
function IDX_getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    Logger.log(`Created sheet: ${name}`);
  }
  return sheet;
}

// Helper: Write PRIMKA header
function IDX_writeHeaderPrimka_(sheet) {
  const header = [
    'DATUM', 'RADNIK', 'ODJEL', 'RADILIŠTE', 'IZVOĐAČ', 'POSLOVOĐA',
    'F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'TRUPCI Č',
    'CEL.DUGA', 'CEL.CIJEPANA', 'ŠKART', 'Σ ČETINARI',
    'F/L L', 'I L', 'II L', 'III L', 'TRUPCI L',
    'OGR.DUGI', 'OGR.CIJEPANI', 'GULE', 'LIŠĆARI', 'UKUPNO Č+L'
  ];
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
}

// Helper: Write OTPREMA header
function IDX_writeHeaderOtprema_(sheet) {
  const header = [
    'DATUM', 'OTPREMAČ', 'KUPAC', 'ODJEL', 'RADILIŠTE', 'IZVOĐAČ', 'POSLOVOĐA',
    'F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'TRUPCI Č',
    'CEL.DUGA', 'CEL.CIJEPANA', 'ŠKART', 'Σ ČETINARI',
    'F/L L', 'I L', 'II L', 'III L', 'TRUPCI L',
    'OGR.DUGI', 'OGR.CIJEPANI', 'GULE', 'LIŠĆARI', 'UKUPNO Č+L'
  ];
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
}

// Helper: Read one file (both PRIMKA and OTPREMA)
function IDX_readOneFileBoth_(fileId) {
  const ss = SpreadsheetApp.openById(fileId);
  const odjelNaziv = ss.getName();

  const result = { primka: [], otprema: [] };

  // Čitaj RADILIŠTE (W2), IZVOĐAČ (W3), POSLOVOĐA (W4) iz PRIMKA sheet-a
  let radiliste = '';
  let izvodjac = '';
  let poslovodja = '';

  const primkaSheet = ss.getSheetByName('PRIMKA');
  if (primkaSheet) {
    try {
      radiliste = String(primkaSheet.getRange('W2').getValue() || '').trim();
      izvodjac = String(primkaSheet.getRange('W3').getValue() || '').trim();
      poslovodja = String(primkaSheet.getRange('W4').getValue() || '').trim();
    } catch (e) {
      Logger.log(`Error reading W2/W3/W4 for ${odjelNaziv}: ${e}`);
    }

    // Čitaj PRIMKA podatke
    const lastRow = primkaSheet.getLastRow();
    if (lastRow > 1) {
      const data = primkaSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const datum = row[1]; // B
        const primac = row[2]; // C

        // Preskoči prazne i header redove
        if (!datum || datum === '' || datum === 0) continue;
        if (!primac || primac === '' || primac === 0) continue;

        const datumStr = String(datum).toUpperCase();
        const primacStr = String(primac).toUpperCase();
        if (datumStr.includes('DATUM') || datumStr.includes('OPIS') ||
            primacStr.includes('PRIMAČ') || primacStr.includes('PRIMAC')) continue;

        // [DATUM, RADNIK, ODJEL, RADILIŠTE, IZVOĐAČ, POSLOVOĐA, ...sortimenti(20)]
        const sortimenti = row.slice(3, 23);
        result.primka.push([datum, primac, odjelNaziv, radiliste, izvodjac, poslovodja, ...sortimenti]);
      }
    }
  }

  // Čitaj OTPREMA podatke
  const otpremaSheet = ss.getSheetByName('OTPREMA');
  if (otpremaSheet) {
    const lastRow = otpremaSheet.getLastRow();
    if (lastRow > 1) {
      const data = otpremaSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const kupac = row[0]; // A
        const datum = row[1]; // B
        const otpremac = row[2]; // C

        // Preskoči prazne i header redove
        if (!datum || datum === '' || datum === 0) continue;
        if (!otpremac || otpremac === '' || otpremac === 0) continue;

        const datumStr = String(datum).toUpperCase();
        const otpremacStr = String(otpremac).toUpperCase();
        if (datumStr.includes('DATUM') || datumStr.includes('OPIS') ||
            otpremacStr.includes('OTPREMAČ') || otpremacStr.includes('OTPREMAC')) continue;

        // [DATUM, OTPREMAČ, KUPAC, ODJEL, RADILIŠTE, IZVOĐAČ, POSLOVOĐA, ...sortimenti(20)]
        const sortimenti = row.slice(3, 23);
        result.otprema.push([datum, otpremac, kupac, odjelNaziv, radiliste, izvodjac, poslovodja, ...sortimenti]);
      }
    }
  }

  return result;
}

// Helper: Unique key for PRIMKA row (datum + radnik + odjel)
function IDX_primkaKey_(row) {
  const datum = row[0] instanceof Date ? row[0].getTime() : String(row[0]);
  return `${datum}|${row[1]}|${row[2]}`;
}

// Helper: Unique key for OTPREMA row (datum + otpremač + kupac + odjel)
function IDX_otpremaKey_(row) {
  const datum = row[0] instanceof Date ? row[0].getTime() : String(row[0]);
  return `${datum}|${row[1]}|${row[2]}|${row[3]}`;
}

// Helper: Append only unique rows (skip duplicates based on key function)
function IDX_appendUnique_(sheet, incomingRows, keyFn) {
  if (incomingRows.length === 0) return 0;

  // Dohvati postojeće ključeve
  const lastRow = sheet.getLastRow();
  const existingKeys = new Set();

  if (lastRow > 1) {
    const existingData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    existingData.forEach(row => existingKeys.add(keyFn(row)));
  }

  // Filtriraj samo nove redove
  const newRows = incomingRows.filter(row => !existingKeys.has(keyFn(row)));

  if (newRows.length === 0) return 0;

  // Normalizuj broj kolona
  const targetCols = sheet.getLastColumn();
  const normalizedRows = newRows.map(row => {
    if (row.length > targetCols) return row.slice(0, targetCols);
    if (row.length < targetCols) return row.concat(new Array(targetCols - row.length).fill(''));
    return row;
  });

  // Dodaj nove redove
  sheet.getRange(lastRow + 1, 1, normalizedRows.length, targetCols).setValues(normalizedRows);

  return normalizedRows.length;
}

// Helper: Sort index by date (column 1)
function IDX_sortIndexByDate_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  range.sort({ column: 1, ascending: true });
}

// Helper: Format date column
function IDX_formatDateCol_(sheet, col) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  sheet.getRange(2, col, lastRow - 1, 1).setNumberFormat('dd.mm.yyyy');
}

// ==========================================
// FILE: diagnostic.gs
// ==========================================
// ========================================
// 🔍 DIAGNOSTIC - Dijagnostičke funkcije
// ========================================
// Ovaj fajl sadrži dijagnostičke funkcije za debugging i validaciju podataka

function diagnosticOctoberData() {
  try {
    Logger.log('=== OKTOBAR DIJAGNOSTIKA ===');

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName('INDEKS_PRIMKA');
    const otpremaSheet = ss.getSheetByName('INDEKS_OTPREMA');

    if (!primkaSheet || !otpremaSheet) {
      Logger.log('ERROR: INDEKS sheets not found');
      return;
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const otpremaData = otpremaSheet.getDataRange().getValues();

    // Analiza PRIMKA (Sječa) - nova struktura: A=DATE, B=RADNIK, C=ODJEL, Y=UKUPNO
    Logger.log('\n=== PRIMKA (SJEČA) - OKTOBAR 2025 ===');
    let primkaSum = 0;
    let primkaCount = 0;

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[PRIMKA_COL.ODJEL];      // C - Odjel
      const datum = row[PRIMKA_COL.DATE];       // A - Datum
      const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO Č+L

      if (!datum || !odjel) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== 2025) continue;
      if (datumObj.getMonth() !== 9) continue; // 9 = Oktobar (0-indexed)

      primkaCount++;
      primkaSum += kubik;

      if (primkaCount <= 20) {
        const datumStr = formatDate(datumObj);
        const rowNum = i + 1;
        Logger.log('Red ' + rowNum + ': ' + odjel + ' | Datum: ' + datumStr + ' | Kubik: ' + kubik.toFixed(2));
      }
    }

    Logger.log('\nUKUPNO PRIMKA OKTOBAR: ' + primkaSum.toFixed(2) + ' m³ (' + primkaCount + ' unosa)');

    // Analiza OTPREMA - nova struktura: A=DATE, B=OTPREMAČ, C=KUPAC, D=ODJEL, Z=UKUPNO
    Logger.log('\n=== OTPREMA - OKTOBAR 2025 ===');
    let otpremaSum = 0;
    let otpremaCount = 0;

    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const odjel = row[OTPREMA_COL.ODJEL];     // D - Odjel
      const datum = row[OTPREMA_COL.DATE];      // A - Datum
      const kupac = row[OTPREMA_COL.KUPAC] || ""; // C - Kupac
      const kubik = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0; // Z - UKUPNO Č+L

      if (!datum || !odjel) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== 2025) continue;
      if (datumObj.getMonth() !== 9) continue; // 9 = Oktobar

      otpremaCount++;
      otpremaSum += kubik;

      const datumStr = formatDate(datumObj);
      const rowNum = i + 1;
      Logger.log('Red ' + rowNum + ': ' + odjel + ' | Datum: ' + datumStr + ' | Kupac: ' + kupac + ' | Kubik: ' + kubik.toFixed(2));
    }

    Logger.log('\nUKUPNO OTPREMA OKTOBAR: ' + otpremaSum.toFixed(2) + ' m³ (' + otpremaCount + ' unosa)');
    Logger.log('RAZLIKA: ' + (primkaSum - otpremaSum).toFixed(2) + ' m³');
    Logger.log('=== KRAJ DIJAGNOSTIKE ===');

  } catch (error) {
    Logger.log('ERROR in diagnosticOctoberData: ' + error.toString());
  }
}

/**
 * DIJAGNOSTIČKA FUNKCIJA: Prikazuje RAW datume iz INDEX_PRIMKA
 * Pomaže da vidimo kako su datumi spremljeni i kako ih parseDate() parsira
 */
function diagnosticRawDates() {
  try {
    Logger.log('=== RAW DATUMI DIJAGNOSTIKA ===');

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName('INDEKS_PRIMKA');

    if (!primkaSheet) {
      Logger.log('ERROR: INDEKS_PRIMKA sheet not found');
      return;
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    Logger.log('Ukupno redova u INDEKS_PRIMKA: ' + primkaData.length);
    Logger.log('\n=== PRVIH 30 REDOVA (primjeri datuma) ===\n');

    const mjeseciCounter = {};
    for (let m = 0; m < 12; m++) {
      mjeseciCounter[m] = 0;
    }

    for (let i = 1; i < Math.min(30, primkaData.length); i++) {
      const row = primkaData[i];
      const odjel = row[PRIMKA_COL.ODJEL];       // C - Odjel
      const rawDatum = row[PRIMKA_COL.DATE];     // A - Datum
      const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO

      const datumType = typeof rawDatum;
      const isDateObj = rawDatum instanceof Date;

      Logger.log('Red ' + (i+1) + ':');
      Logger.log('  Odjel: ' + odjel);
      Logger.log('  RAW datum: "' + rawDatum + '"');
      Logger.log('  Tip: ' + datumType + (isDateObj ? ' (Date objekat)' : ''));

      if (rawDatum) {
        const datumObj = parseDate(rawDatum);
        const isValid = !isNaN(datumObj.getTime());

        if (isValid) {
          const mjesec = datumObj.getMonth();
          const godina = datumObj.getFullYear();
          Logger.log('  Parsiran: ' + formatDate(datumObj) + ' (mjesec=' + mjesec + ', godina=' + godina + ')');

          if (godina === 2025) {
            mjeseciCounter[mjesec]++;
          }
        } else {
          Logger.log('  Parsiran: INVALID DATE!');
        }
      }
      Logger.log('  Kubik: ' + kubik.toFixed(2) + '\n');
    }

    Logger.log('\n=== DISTRIBUCIJA PO MJESECIMA (2025) ===');
    const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
                          'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    for (let m = 0; m < 12; m++) {
      Logger.log(mjeseciNazivi[m] + ': ' + mjeseciCounter[m] + ' unosa');
    }

    Logger.log('\n=== KRAJ DIJAGNOSTIKE ===');

  } catch (error) {
    Logger.log('ERROR in diagnosticRawDates: ' + error.toString());
  }
}

/**
 * DIJAGNOSTIČKA FUNKCIJA: Traži specifični unos od 25.78 m³ u Oktobru
 * Da vidimo zašto se taj unos pojavljuje u PRIMKA
 */
function diagnosticFind2578() {
  try {
    Logger.log('=== TRAŽIM 25.78 UNOS U OKTOBRU ===');

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName('INDEKS_PRIMKA');

    if (!primkaSheet) {
      Logger.log('ERROR: INDEKS_PRIMKA sheet not found');
      return;
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    Logger.log('Ukupno redova u INDEKS_PRIMKA: ' + primkaData.length);
    Logger.log('\n=== TRAŽIM UNOSE SA KUBIK = 25.78 U OKTOBRU ===\n');

    let foundCount = 0;

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[PRIMKA_COL.ODJEL];       // C - Odjel
      const datum = row[PRIMKA_COL.DATE];        // A - Datum
      const primac = row[PRIMKA_COL.RADNIK];     // B - Primač
      const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO Č+L

      if (!datum || !odjel) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== 2025) continue;
      if (datumObj.getMonth() !== 9) continue; // 9 = Oktobar

      // Traži unose koji su približno 25.78 (± 0.1)
      if (Math.abs(kubik - 25.78) < 0.1) {
        foundCount++;
        Logger.log('PRONAĐENO! Red ' + (i+1) + ':');
        Logger.log('  Odjel: ' + odjel);
        Logger.log('  Datum: ' + formatDate(datumObj));
        Logger.log('  Primač: ' + primac);
        Logger.log('  Kubik: ' + kubik.toFixed(2));
        Logger.log('  Radilište: ' + (row[PRIMKA_COL.RADILISTE] || ''));
        Logger.log('  Izvođač: ' + (row[PRIMKA_COL.IZVODJAC] || ''));
        Logger.log('');
      }
    }

    Logger.log('\n=== UKUPNO PRONAĐENO: ' + foundCount + ' unosa ===');

    // Također traži u OTPREMA
    const otpremaSheet = ss.getSheetByName('INDEKS_OTPREMA');
    if (otpremaSheet) {
      const otpremaData = otpremaSheet.getDataRange().getValues();
      Logger.log('\n=== PROVJERA U INDEKS_OTPREMA ===\n');

      let otpremaFoundCount = 0;

      for (let i = 1; i < otpremaData.length; i++) {
        const row = otpremaData[i];
        const odjel = row[OTPREMA_COL.ODJEL];      // D - Odjel
        const datum = row[OTPREMA_COL.DATE];       // A - Datum
        const otpremac = row[OTPREMA_COL.OTPREMAC]; // B - Otpremač
        const kubik = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0; // Z - UKUPNO

        if (!datum || !odjel) continue;

        const datumObj = parseDate(datum);
        if (datumObj.getFullYear() !== 2025) continue;
        if (datumObj.getMonth() !== 9) continue;

        if (Math.abs(kubik - 25.78) < 0.1) {
          otpremaFoundCount++;
          Logger.log('PRONAĐENO! Red ' + (i+1) + ':');
          Logger.log('  Odjel: ' + odjel);
          Logger.log('  Datum: ' + formatDate(datumObj));
          Logger.log('  Otpremač: ' + otpremac);
          Logger.log('  Kupac: ' + (row[OTPREMA_COL.KUPAC] || ''));
          Logger.log('  Kubik: ' + kubik.toFixed(2));
          Logger.log('');
        }
      }

      Logger.log('UKUPNO U INDEKS_OTPREMA: ' + otpremaFoundCount + ' unosa');
    }

    Logger.log('=== KRAJ DIJAGNOSTIKE ===');

  } catch (error) {
    Logger.log('ERROR in diagnosticFind2578: ' + error.toString());
  }
}

/**
 * DIJAGNOSTIČKA FUNKCIJA: Čita direktno iz originalnog "RISOVAC KRUPA 64 ZAPISNIK" Google Sheets fajla
 * Da vidimo šta piše u PRIMKA i OTPREMA sheet-ovima
 */
function diagnosticCheckOriginalSheet() {
  try {
    Logger.log('=== PROVJERA ORIGINALNOG SHEET-A "RISOVAC KRUPA 64  ZAPISNIK" ===');

    const folder = DriveApp.getFolderById(ODJELI_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

    let foundFile = null;

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      // Traži fajl sa ovim imenom (može biti sa jednim ili dva razmaka)
      if (fileName.includes('RISOVAC KRUPA 64') && fileName.includes('ZAPISNIK')) {
        foundFile = file;
        Logger.log('Pronađen fajl: "' + fileName + '"');
        break;
      }
    }

    if (!foundFile) {
      Logger.log('ERROR: Fajl "RISOVAC KRUPA 64 ZAPISNIK" nije pronađen!');
      return;
    }

    const ss = SpreadsheetApp.open(foundFile);

    // Provjeri PRIMKA sheet
    const primkaSheet = ss.getSheetByName('PRIMKA');
    if (primkaSheet) {
      Logger.log('\n=== PRIMKA SHEET - SVI OKTOBAR UNOSI ===');

      const primkaData = primkaSheet.getDataRange().getValues();
      Logger.log('Ukupno redova u PRIMKA: ' + primkaData.length);

      let primkaOktobarCount = 0;

      for (let i = 1; i < primkaData.length; i++) {
        const row = primkaData[i];
        const datum = row[1]; // kolona B
        const primac = row[2]; // kolona C
        const kubik = parseFloat(row[22]) || 0; // kolona U

        if (!datum) continue;

        const datumObj = parseDate(datum);
        if (isNaN(datumObj.getTime())) continue;
        if (datumObj.getFullYear() !== 2025) continue;
        if (datumObj.getMonth() !== 9) continue; // Oktobar

        primkaOktobarCount++;
        Logger.log('Red ' + (i+1) + ': Datum=' + formatDate(datumObj) + ' | Primač=' + primac + ' | Kubik=' + kubik.toFixed(2));

        if (Math.abs(kubik - 25.78) < 0.1) {
          Logger.log('  ⚠️ OVO JE 25.78 UNOS!');
        }
      }

      Logger.log('\nUKUPNO PRIMKA OKTOBAR: ' + primkaOktobarCount + ' unosa');
    } else {
      Logger.log('PRIMKA sheet ne postoji!');
    }

    // Provjeri OTPREMA sheet
    const otpremaSheet = ss.getSheetByName('OTPREMA');
    if (otpremaSheet) {
      Logger.log('\n=== OTPREMA SHEET - SVI OKTOBAR UNOSI ===');

      const otpremaData = otpremaSheet.getDataRange().getValues();
      Logger.log('Ukupno redova u OTPREMA: ' + otpremaData.length);

      let otpremaOktobarCount = 0;

      for (let i = 1; i < otpremaData.length; i++) {
        const row = otpremaData[i];
        const datum = row[1]; // kolona B
        const otpremac = row[2]; // kolona C
        const kubik = parseFloat(row[22]) || 0; // kolona U

        if (!datum) continue;

        const datumObj = parseDate(datum);
        if (isNaN(datumObj.getTime())) continue;
        if (datumObj.getFullYear() !== 2025) continue;
        if (datumObj.getMonth() !== 9) continue; // Oktobar

        otpremaOktobarCount++;
        Logger.log('Red ' + (i+1) + ': Datum=' + formatDate(datumObj) + ' | Otpremač=' + otpremac + ' | Kubik=' + kubik.toFixed(2));

        if (Math.abs(kubik - 25.78) < 0.1) {
          Logger.log('  ⚠️ OVO JE 25.78 UNOS!');
        }
      }

      Logger.log('\nUKUPNO OTPREMA OKTOBAR: ' + otpremaOktobarCount + ' unosa');
    } else {
      Logger.log('OTPREMA sheet ne postoji!');
    }

    Logger.log('\n=== KRAJ DIJAGNOSTIKE ===');

  } catch (error) {
    Logger.log('ERROR in diagnosticCheckOriginalSheet: ' + error.toString());
  }
}

// ==========================================
// FILE: api-handlers.gs
// ==========================================
// ========================================
// 🔌 API HANDLERS - Svi handle* endpointi
// ========================================
// Ovaj fajl sadrži sve API endpoint handlere za aplikaciju
// Organizovani su po logičkim grupama:
// 1. Data Retrieval Handlers - Dohvat podataka (dashboard, sortimenti, primaci, otpremaci, kupci, odjeli...)
// 2. Data Input Handlers - Unos podataka (add-sjeca, add-otprema, pending unosi...)
// 3. Sync/Admin Handlers - Administracija i sinkronizacija
// 4. Delta Sync Handlers - Optimizirani delta sync endpointi

// ========================================
// 1. DATA RETRIEVAL HANDLERS
// ========================================

function handleDashboard(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  // 🚀 CACHE: Try to get from cache first
  const cacheKey = `dashboard_${year}`;
  const cached = getCachedData(cacheKey);
  if (cached) {
    return createJsonResponse(cached, true);
  }

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");
  const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

  if (!primkaSheet || !otpremaSheet) {
    return createJsonResponse({ error: "INDEKS sheets not found in BAZA_PODATAKA" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const otpremaData = otpremaSheet.getDataRange().getValues();

  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
  const dinamika = getDinamikaForYear(year); // Učitaj dinamiku iz DINAMIKA sheet-a

  // Inicijalizuj mjesečne sume
  let mjesecnePrimke = Array(12).fill(0);
  let mjesecneOtpreme = Array(12).fill(0);
  let odjeliMap = {}; // Map: odjelNaziv -> { primka, otprema, zadnjaSječa }

  // Procesiranje PRIMKA podataka
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const odjel = row[PRIMKA_COL.ODJEL];     // C - ODJEL
    const datum = row[PRIMKA_COL.DATE];      // A - DATUM
    const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO Č+L

    if (!datum || !odjel) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();
    mjesecnePrimke[mjesec] += kubik;

    // Agregacija po odjelima
    if (!odjeliMap[odjel]) {
      odjeliMap[odjel] = { primka: 0, otprema: 0, zadnjaSječa: null };
    }
    odjeliMap[odjel].primka += kubik;

    // Zadnja sječa
    if (!odjeliMap[odjel].zadnjaSječa || datumObj > odjeliMap[odjel].zadnjaSječa) {
      odjeliMap[odjel].zadnjaSječa = datumObj;
    }
  }

  // Procesiranje OTPREMA podataka
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const odjel = row[OTPREMA_COL.ODJEL];    // D - ODJEL
    const datum = row[OTPREMA_COL.DATE];     // A - DATUM
    const kubik = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0; // Z - UKUPNO Č+L

    if (!datum || !odjel) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();
    mjesecneOtpreme[mjesec] += kubik;

    if (!odjeliMap[odjel]) {
      odjeliMap[odjel] = { primka: 0, otprema: 0, zadnjaSječa: null };
    }
    odjeliMap[odjel].otprema += kubik;
  }

  // Kreiraj mjesečnu statistiku
  const mjesecnaStatistika = [];
  for (let i = 0; i < 12; i++) {
    const sjeca = mjesecnePrimke[i];
    const otprema = mjesecneOtpreme[i];
    const stanje = sjeca - otprema;
    const dinamikaVrijednost = dinamika[i];
    const razlikaSjeca = sjeca - dinamikaVrijednost;
    const razlikaOtprema = otprema - dinamikaVrijednost;

    mjesecnaStatistika.push({
      mjesec: mjeseci[i],
      sjeca: sjeca,
      otprema: otprema,
      stanje: stanje,
      dinamika: dinamikaVrijednost,
      razlikaSjeca: razlikaSjeca,
      razlikaOtprema: razlikaOtprema
    });
  }

  // Kreiraj prikaz po odjelima
  const odjeliPrikaz = [];
  for (const odjelNaziv in odjeliMap) {
    const odjel = odjeliMap[odjelNaziv];
    odjeliPrikaz.push({
      odjel: odjelNaziv,
      sjeca: odjel.primka,
      otprema: odjel.otprema,
      stanje: odjel.primka - odjel.otprema,
      zadnjaSječa: odjel.zadnjaSječa ? formatDate(odjel.zadnjaSječa) : "",
      radilište: "", // TODO: dodati ako ima u INDEX sheet-u
      izvođač: "", // TODO: dodati ako ima u INDEX sheet-u
      realizacija: 0 // TODO: dodati ako ima plan podatke
    });
  }

  // Sortiraj odjele po zadnjoj sječi (najnovija prva)
  odjeliPrikaz.sort((a, b) => {
    if (!a.zadnjaSječa) return 1;
    if (!b.zadnjaSječa) return -1;
    return b.zadnjaSječa.localeCompare(a.zadnjaSječa);
  });

  // 🚀 CACHE: Store result before returning
  const result = {
    mjesecnaStatistika: mjesecnaStatistika,
    odjeli: odjeliPrikaz
  };
  setCachedData(cacheKey, result, CACHE_TTL);

  return createJsonResponse(result, true);
}


function handleSortimenti(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");
  const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

  if (!primkaSheet || !otpremaSheet) {
    return createJsonResponse({ error: "INDEKS sheets not found in BAZA_PODATAKA" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const otpremaData = otpremaSheet.getDataRange().getValues();

  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  // Inicijalizuj mjesečne sume za PRIMKA (12 mjeseci x 20 sortimenta)
  let primkaSortimenti = Array(12).fill(null).map(() => Array(20).fill(0));

  // Inicijalizuj mjesečne sume za OTPREMA
  let otpremaSortimenti = Array(12).fill(null).map(() => Array(20).fill(0));

  // Procesiranje PRIMKA podataka
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const datum = row[PRIMKA_COL.DATE]; // A - DATUM

    if (!datum) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();

    // Sortimenti (F-Y, indeksi 5-24)
    for (let j = 0; j < 20; j++) {
      const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
      primkaSortimenti[mjesec][j] += vrijednost;
    }
  }

  // Procesiranje OTPREMA podataka
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const datum = row[OTPREMA_COL.DATE]; // A - DATUM

    if (!datum) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();

    // Sortimenti (G-Z, indeksi 6-25)
    for (let j = 0; j < 20; j++) {
      const vrijednost = parseFloat(row[OTPREMA_COL.SORT_START + j]) || 0;
      otpremaSortimenti[mjesec][j] += vrijednost;
    }
  }

  // Izračunaj ukupne sume i % udio
  let primkaUkupno = Array(20).fill(0);
  let otpremaUkupno = Array(20).fill(0);

  for (let mjesec = 0; mjesec < 12; mjesec++) {
    for (let j = 0; j < 20; j++) {
      primkaUkupno[j] += primkaSortimenti[mjesec][j];
      otpremaUkupno[j] += otpremaSortimenti[mjesec][j];
    }
  }

  // Generiši response
  const primkaRedovi = [];
  const otpremaRedovi = [];

  for (let mjesec = 0; mjesec < 12; mjesec++) {
    const primkaRed = { mjesec: mjeseci[mjesec] };
    const otpremaRed = { mjesec: mjeseci[mjesec] };

    for (let j = 0; j < 20; j++) {
      primkaRed[sortimentiNazivi[j]] = primkaSortimenti[mjesec][j];
      otpremaRed[sortimentiNazivi[j]] = otpremaSortimenti[mjesec][j];
    }

    primkaRedovi.push(primkaRed);
    otpremaRedovi.push(otpremaRed);
  }

  // Dodaj UKUPNO redove
  const primkaUkupnoRed = { mjesec: "UKUPNO" };
  const otpremaUkupnoRed = { mjesec: "UKUPNO" };
  
  for (let j = 0; j < 20; j++) {
    primkaUkupnoRed[sortimentiNazivi[j]] = primkaUkupno[j];
    otpremaUkupnoRed[sortimentiNazivi[j]] = otpremaUkupno[j];
  }

  primkaRedovi.push(primkaUkupnoRed);
  otpremaRedovi.push(otpremaUkupnoRed);

  // Dodaj % UDIO redove
  const primkaUdioRed = { mjesec: "% UDIO" };
  const otpremaUdioRed = { mjesec: "% UDIO" };

  const primkaSveukupno = primkaUkupno[19]; // SVEUKUPNO je zadnja kolona
  const otpremaSveukupno = otpremaUkupno[19];

  for (let j = 0; j < 20; j++) {
    primkaUdioRed[sortimentiNazivi[j]] = primkaSveukupno > 0 ? (primkaUkupno[j] / primkaSveukupno) : 0;
    otpremaUdioRed[sortimentiNazivi[j]] = otpremaSveukupno > 0 ? (otpremaUkupno[j] / otpremaSveukupno) : 0;
  }

  primkaRedovi.push(primkaUdioRed);
  otpremaRedovi.push(otpremaUdioRed);

  return createJsonResponse({
    sortimentiNazivi: sortimentiNazivi,
    primka: primkaRedovi,
    otprema: otpremaRedovi
  }, true);
}

// ========================================
// PRIMAČI API - Prikaz po primačima
// ========================================

/**
 * Primači endpoint - vraća mjesečni prikaz po primačima
 */
function handlePrimaci(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  // 🚀 CACHE: Try to get from cache first
  const cacheKey = `primaci_${year}`;
  const cached = getCachedData(cacheKey);
  if (cached) {
    return createJsonResponse(cached, true);
  }

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");

  if (!primkaSheet) {
    return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found in BAZA_PODATAKA" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  // Map: primacIme -> { mjeseci: [0,0,0,...], ukupno: 0, radniDaniSet: [Set x 12] }
  let primaciMap = {};

  // Procesiranje PRIMKA podataka
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const datum = row[PRIMKA_COL.DATE];      // A - DATUM
    const primac = row[PRIMKA_COL.RADNIK];   // B - RADNIK/PRIMAČ
    const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO Č+L

    if (!datum || !primac) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();
    const datumKey = datumObj.toISOString().split('T')[0]; // YYYY-MM-DD za jedinstveni dan

    // Inicijalizuj primača ako ne postoji
    if (!primaciMap[primac]) {
      primaciMap[primac] = {
        mjeseci: Array(12).fill(0),
        ukupno: 0,
        radniDaniSet: Array.from({length: 12}, () => ({}))
      };
    }

    primaciMap[primac].mjeseci[mjesec] += kubik;
    primaciMap[primac].ukupno += kubik;
    primaciMap[primac].radniDaniSet[mjesec][datumKey] = true;
  }

  // Generiši array primaciPrikaz
  const primaciPrikaz = [];
  for (const primacIme in primaciMap) {
    const primac = primaciMap[primacIme];
    const radniDani = primac.radniDaniSet.map(function(daniObj) {
      return Object.keys(daniObj).length;
    });
    primaciPrikaz.push({
      primac: primacIme,
      mjeseci: primac.mjeseci,
      ukupno: primac.ukupno,
      radniDani: radniDani
    });
  }

  // Sortiraj po ukupnoj količini (od najvećeg ka najmanjem)
  primaciPrikaz.sort((a, b) => b.ukupno - a.ukupno);

  // 🚀 CACHE: Store result before returning
  const result = {
    mjeseci: mjeseci,
    primaci: primaciPrikaz
  };
  setCachedData(cacheKey, result, CACHE_TTL);

  return createJsonResponse(result, true);
}

// ========================================
// OTPREMAČI API - Prikaz po otpremačima
// ========================================

/**
 * Otpremači endpoint - vraća mjesečni prikaz po otpremačima
 */
function handleOtpremaci(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  // 🚀 CACHE: Try to get from cache first
  const cacheKey = `otpremaci_${year}`;
  const cached = getCachedData(cacheKey);
  if (cached) {
    return createJsonResponse(cached, true);
  }

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

  if (!otpremaSheet) {
    return createJsonResponse({ error: "INDEKS_OTPREMA sheet not found in BAZA_PODATAKA" }, false);
  }

  const otpremaData = otpremaSheet.getDataRange().getValues();
  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  // Map: otpremacIme -> { mjeseci: [0,0,0,...], ukupno: 0 }
  let otpremaciMap = {};

  // Procesiranje OTPREMA podataka
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const datum = row[OTPREMA_COL.DATE];       // A - DATUM
    const otpremac = row[OTPREMA_COL.OTPREMAC]; // B - OTPREMAČ
    const kubik = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0; // Z - UKUPNO Č+L

    if (!datum || !otpremac) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();

    // Inicijalizuj otpremača ako ne postoji
    if (!otpremaciMap[otpremac]) {
      otpremaciMap[otpremac] = {
        mjeseci: Array(12).fill(0),
        ukupno: 0
      };
    }

    otpremaciMap[otpremac].mjeseci[mjesec] += kubik;
    otpremaciMap[otpremac].ukupno += kubik;
  }

  // Generiši array otpremaciPrikaz
  const otpremaciPrikaz = [];
  for (const otpremacIme in otpremaciMap) {
    const otpremac = otpremaciMap[otpremacIme];
    otpremaciPrikaz.push({
      otpremac: otpremacIme,
      mjeseci: otpremac.mjeseci,
      ukupno: otpremac.ukupno
    });
  }

  // Sortiraj po ukupnoj količini (od najvećeg ka najmanjem)
  otpremaciPrikaz.sort((a, b) => b.ukupno - a.ukupno);

  // 🚀 CACHE: Store result before returning
  const result = {
    mjeseci: mjeseci,
    otpremaci: otpremaciPrikaz
  };
  setCachedData(cacheKey, result, CACHE_TTL);

  return createJsonResponse(result, true);
}

// ========================================
// KUPCI API - Prikaz po kupcima
// ========================================

/**
 * Kupci endpoint - vraća prikaz po kupcima (godišnji i mjesečni)
 */
function handleKupci(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  // 🚀 CACHE: Try to get from cache first
  const cacheKey = `kupci_${year}`;
  const cached = getCachedData(cacheKey);
  if (cached) {
    return createJsonResponse(cached, true);
  }

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

  if (!otpremaSheet) {
    return createJsonResponse({ error: "INDEKS_OTPREMA sheet not found in BAZA_PODATAKA" }, false);
  }

  const otpremaData = otpremaSheet.getDataRange().getValues();
  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  // Map za godišnji prikaz: kupac -> { sortimenti: {}, ukupno: 0 }
  let kupciGodisnji = {};

  // Map za mjesečni prikaz: kupac -> mjeseci[12] -> { sortimenti: {}, ukupno: 0 }
  let kupciMjesecni = {};

  // Procesiranje OTPREMA podataka
  // INDEKS_OTPREMA struktura: A=datum, B=otpremač, C=kupac, D=odjel, E=radilište, F=izvođač, G-Z=sortimenti(20)
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const datum = row[OTPREMA_COL.DATE];       // A - DATUM
    const odjel = row[OTPREMA_COL.ODJEL];      // D - ODJEL
    const otpremac = row[OTPREMA_COL.OTPREMAC]; // B - OTPREMAČ
    const kupac = row[OTPREMA_COL.KUPAC] || odjel; // C - KUPAC, fallback na odjel

    if (!datum) continue;

    // Skip ako nema kupca
    if (!kupac || kupac === '' || kupac === 0) {
      Logger.log(`Skip red ${i}: nema kupac (odjel="${odjel}", datum="${datum}")`);
      continue;
    }

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();
    const kupacNormalized = String(kupac).trim(); // Normalizuj naziv kupca

    // Inicijalizuj kupca u godišnjem prikazu ako ne postoji
    if (!kupciGodisnji[kupacNormalized]) {
      kupciGodisnji[kupacNormalized] = {
        sortimenti: {},
        ukupno: 0
      };
      // Inicijalizuj sve sortimente na 0
      for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
        kupciGodisnji[kupacNormalized].sortimenti[SORTIMENTI_NAZIVI[s]] = 0;
      }
    }

    // Inicijalizuj kupca u mjesečnom prikazu ako ne postoji
    if (!kupciMjesecni[kupacNormalized]) {
      kupciMjesecni[kupacNormalized] = [];
      for (let m = 0; m < 12; m++) {
        kupciMjesecni[kupacNormalized][m] = {
          sortimenti: {},
          ukupno: 0
        };
        // Inicijalizuj sve sortimente na 0
        for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
          kupciMjesecni[kupacNormalized][m].sortimenti[SORTIMENTI_NAZIVI[s]] = 0;
        }
      }
    }

    // Dodaj sortimente (G-Z, indeksi 6-25)
    for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
      const vrijednost = parseFloat(row[OTPREMA_COL.SORT_START + s]) || 0;

      // Godišnji
      kupciGodisnji[kupacNormalized].sortimenti[SORTIMENTI_NAZIVI[s]] += vrijednost;

      // Mjesečni
      kupciMjesecni[kupacNormalized][mjesec].sortimenti[SORTIMENTI_NAZIVI[s]] += vrijednost;
    }

    // Ukupno (kolona Z = UKUPNO Č+L)
    const ukupno = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0;
    kupciGodisnji[kupacNormalized].ukupno += ukupno;
    kupciMjesecni[kupacNormalized][mjesec].ukupno += ukupno;
  }

  // Generiši godišnji prikaz
  const godisnji = [];
  for (const kupacIme in kupciGodisnji) {
    const kupac = kupciGodisnji[kupacIme];
    const red = {
      kupac: kupacIme,
      sortimenti: kupac.sortimenti,
      ukupno: kupac.ukupno
    };
    godisnji.push(red);
  }

  // Sortiraj po ukupnoj količini (od najvećeg ka najmanjem)
  godisnji.sort((a, b) => b.ukupno - a.ukupno);

  // Generiši mjesečni prikaz
  const mjesecni = [];
  for (const kupacIme in kupciMjesecni) {
    for (let m = 0; m < 12; m++) {
      const mjesecData = kupciMjesecni[kupacIme][m];
      if (mjesecData.ukupno > 0) { // Samo mjeseci sa podacima
        mjesecni.push({
          kupac: kupacIme,
          mjesec: mjeseci[m],
          sortimenti: mjesecData.sortimenti,
          ukupno: mjesecData.ukupno
        });
      }
    }
  }

  Logger.log(`Kupci - Godišnji: ${godisnji.length} kupaca, Mjesečni: ${mjesecni.length} redova`);

  // 🚀 CACHE: Store result before returning
  const result = {
    sortimentiNazivi: SORTIMENTI_NAZIVI,
    godisnji: godisnji,
    mjesecni: mjesecni
  };
  setCachedData(cacheKey, result, CACHE_TTL);

  return createJsonResponse(result, true);
}

// ========================================
// ODJELI API - Pregled po odjelima
// Pregled po odjelima: realizacija iz STANJE_ZALIHA, sječa/otprema all-time iz INDEKS
// ========================================

/**
 * Odjeli endpoint - vraća prikaz po odjelima sa detaljnim podacima
 * Čita podatke iz INDEKS_PRIMKA i INDEKS_OTPREMA listova iz BAZA_PODATAKA
 * - Sječa: agregira UKUPNO Č+L iz INDEKS_PRIMKA po odjelu (ALL-TIME, bez filtra po godini)
 * - Otprema: agregira UKUPNO Č+L iz INDEKS_OTPREMA po odjelu (ALL-TIME, bez filtra po godini)
 * - Zaliha: Sječa - Otprema
 * - Realizacija: Sječa / Projekat (iz STANJE_ZALIHA, red OPIS=PROJEKAT, kolona UKUPNO Č+L)
 * - Radilište, Izvođač, Zadnji datum: čita iz INDEKS_PRIMKA
 */
function handleOdjeli(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  Logger.log('=== HANDLE ODJELI START (ALL-TIME) ===');

  try {
    // PRIMARNI IZVOR: Učitaj podatke iz INDEKS_PRIMKA, INDEKS_OTPREMA i STANJE_ZALIHA
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");
    const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");
    const stanjeSheet = ss.getSheetByName("STANJE_ZALIHA");

    if (!primkaSheet || !otpremaSheet) {
      return createJsonResponse({ error: "INDEKS sheets not found in BAZA_PODATAKA" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const otpremaData = otpremaSheet.getDataRange().getValues();

    Logger.log(`INDEKS_PRIMKA: ${primkaData.length} redova`);
    Logger.log(`INDEKS_OTPREMA: ${otpremaData.length} redova`);

    // ========================================
    // 1. Čitaj PROJEKAT vrijednosti iz STANJE_ZALIHA
    // ========================================
    const projekatMap = {};  // odjel (upper) -> projekat vrijednost
    if (stanjeSheet) {
      const stanjeData = stanjeSheet.getDataRange().getValues();
      let i = 0;
      while (i < stanjeData.length) {
        const row = stanjeData[i];
        const colA = String(row[0] || '').toUpperCase().trim();

        // Početak bloka: kolona A == "ODJEL"
        if (colA === 'ODJEL') {
          const odjelNaziv = String(row[1] || '').trim().toUpperCase();

          // Skeniraj do 6 redova za PROJEKAT marker u koloni C
          for (let offset = 0; offset < 6 && (i + offset) < stanjeData.length; offset++) {
            const blockRow = stanjeData[i + offset];
            const blockColA = String(blockRow[0] || '').toUpperCase().trim();
            const blockColC = String(blockRow[2] || '').toUpperCase().trim();

            // Ako naletimo na novi ODJEL (osim prvog), prekini
            if (offset > 0 && blockColA === 'ODJEL') break;

            // Čitaj PROJEKAT red - kolona W (index 22) = UKUPNO Č+L
            if (blockColC === 'PROJEKAT') {
              const projekatValue = parseFloat(blockRow[22]) || 0;
              projekatMap[odjelNaziv] = projekatValue;
              break;
            }
          }
        }
        i++;
      }
      Logger.log(`STANJE_ZALIHA: Učitano ${Object.keys(projekatMap).length} PROJEKAT vrijednosti`);
    }

    // ========================================
    // 2. Mapa za agregaciju po odjelima (ALL-TIME, bez filtra po godini)
    // ========================================
    const odjeliMap = {};

    // Procesiranje PRIMKA podataka (sječa) - ALL-TIME
    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const datum = row[PRIMKA_COL.DATE];      // A - DATUM
      const odjel = row[PRIMKA_COL.ODJEL];     // C - ODJEL
      const radiliste = row[PRIMKA_COL.RADILISTE]; // D - RADILIŠTE
      const izvodjac = row[PRIMKA_COL.IZVODJAC];   // E - IZVOĐAČ
      const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Z - UKUPNO Č+L

      if (!odjel) continue;

      const odjelNaziv = String(odjel).trim();
      if (!odjelNaziv) continue;

      // Parsiraj datum za sortiranje (opciono)
      let datumObj = null;
      if (datum) {
        datumObj = parseDate(datum);
        if (isNaN(datumObj.getTime())) datumObj = null;
      }

      // Inicijalizuj odjel ako ne postoji
      if (!odjeliMap[odjelNaziv]) {
        odjeliMap[odjelNaziv] = {
          sjeca: 0,
          otprema: 0,
          radiliste: '',
          izvođač: '',
          zadnjiDatumObj: null
        };
      }

      // Dodaj kubike (ALL-TIME)
      odjeliMap[odjelNaziv].sjeca += kubik;

      // Ažuriraj radilište i izvođač (zadnji unos)
      if (radiliste) odjeliMap[odjelNaziv].radiliste = String(radiliste).trim();
      if (izvodjac) odjeliMap[odjelNaziv].izvođač = String(izvodjac).trim();

      // Ažuriraj zadnji datum sječe
      if (datumObj && (!odjeliMap[odjelNaziv].zadnjiDatumObj || datumObj > odjeliMap[odjelNaziv].zadnjiDatumObj)) {
        odjeliMap[odjelNaziv].zadnjiDatumObj = datumObj;
      }
    }

    // Procesiranje OTPREMA podataka - ALL-TIME
    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const odjel = row[OTPREMA_COL.ODJEL];    // D - ODJEL
      const kubik = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0; // AA - UKUPNO Č+L

      if (!odjel) continue;

      const odjelNaziv = String(odjel).trim();
      if (!odjelNaziv) continue;

      // Inicijalizuj odjel ako ne postoji (može se desiti da ima otprema a nema sječe)
      if (!odjeliMap[odjelNaziv]) {
        odjeliMap[odjelNaziv] = {
          sjeca: 0,
          otprema: 0,
          radiliste: '',
          izvođač: '',
          zadnjiDatumObj: null
        };
      }

      // Dodaj kubike (ALL-TIME)
      odjeliMap[odjelNaziv].otprema += kubik;
    }

    Logger.log(`Pronađeno ${Object.keys(odjeliMap).length} odjela (all-time)`);

    // ========================================
    // 3. Kreiraj prikaz po odjelima sa REALIZACIJOM
    // ========================================
    const odjeliPrikaz = [];
    for (const odjelNaziv in odjeliMap) {
      const odjel = odjeliMap[odjelNaziv];
      const sjeca = odjel.sjeca;
      const otprema = odjel.otprema;
      const sumaPanj = sjeca - otprema;  // ZALIHA

      // Lookup PROJEKAT iz STANJE_ZALIHA (po odjel nazvu, UPPER)
      const projekat = projekatMap[odjelNaziv.toUpperCase()] || 0;

      // REALIZACIJA = SJEČA / PROJEKAT (ako PROJEKAT > 0)
      let realizacija = 0;
      if (projekat > 0) {
        realizacija = (sjeca / projekat) * 100;
      }

      odjeliPrikaz.push({
        odjel: odjelNaziv,
        sjeca: sjeca,
        otprema: otprema,
        sumaPanj: sumaPanj,
        radiliste: odjel.radiliste,
        izvođač: odjel.izvođač,
        datumZadnjeSjece: odjel.zadnjiDatumObj ? formatDate(odjel.zadnjiDatumObj) : '',
        projekat: projekat,
        realizacija: realizacija,
        zadnjiDatumObj: odjel.zadnjiDatumObj
      });
    }

    // Sortiraj po zadnjoj sječi (najnovija prva)
    odjeliPrikaz.sort((a, b) => {
      if (!a.zadnjiDatumObj && !b.zadnjiDatumObj) return 0;
      if (!a.zadnjiDatumObj) return 1;
      if (!b.zadnjiDatumObj) return -1;
      return b.zadnjiDatumObj - a.zadnjiDatumObj; // Descending (najnovija prva)
    });

    // Ukloni zadnjiDatumObj iz rezultata (koristili smo ga samo za sortiranje)
    const odjeliResult = odjeliPrikaz.map(o => ({
      odjel: o.odjel,
      sjeca: o.sjeca,
      otprema: o.otprema,
      sumaPanj: o.sumaPanj,
      radiliste: o.radiliste,
      izvođač: o.izvođač,
      datumZadnjeSjece: o.datumZadnjeSjece,
      projekat: o.projekat,
      realizacija: o.realizacija
    }));

    Logger.log('=== HANDLE ODJELI END (ALL-TIME) ===');
    Logger.log(`Ukupno odjela: ${odjeliResult.length}`);

    return createJsonResponse({
      odjeli: odjeliResult
    }, true);

  } catch (error) {
    Logger.log('=== HANDLE ODJELI ERROR ===');
    Logger.log('ERROR: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ========================================
// PRIMAC DETAIL API - Personalni prikaz za primača
// ========================================

/**
 * Primac Detail endpoint - vraća sve unose za specificnog primača
 * Sortiran po datumu (najnoviji prvo)
 */
function handlePrimacDetail(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  // Dohvati puno ime korisnika iz login rezultata
  const userFullName = loginResult.fullName;

  Logger.log('=== HANDLE PRIMAC DETAIL START ===');
  Logger.log('User: ' + userFullName);
  Logger.log('Year: ' + year);

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");

  if (!primkaSheet) {
    return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found in BAZA_PODATAKA" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const unosi = [];

  // Procesiranje PRIMKA podataka - filtrirati samo za ovog primača
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const datum = row[PRIMKA_COL.DATE];       // A - DATUM
    const primac = row[PRIMKA_COL.RADNIK];    // B - RADNIK/PRIMAČ
    const odjel = row[PRIMKA_COL.ODJEL];      // C - ODJEL
    const radiliste = row[PRIMKA_COL.RADILISTE]; // D - RADILIŠTE
    const izvodjac = row[PRIMKA_COL.IZVODJAC];   // E - IZVOĐAČ
    const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO Č+L

    if (!datum || !primac) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    // Filtriraj samo unose za ovog primača
    if (String(primac).trim() !== userFullName) continue;

    // Pročitaj sve sortimente (F-Y, indeksi 5-24)
    const sortimenti = {};
    for (let j = 0; j < 20; j++) {
      const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
      sortimenti[SORTIMENTI_NAZIVI[j]] = vrijednost;
    }

    unosi.push({
      datum: formatDate(datumObj),
      datumObj: datumObj,  // Za sortiranje
      odjel: odjel,
      radiliste: radiliste,
      izvodjac: izvodjac,
      primac: primac,
      sortimenti: sortimenti,
      ukupno: kubik
    });
  }

  // Sortiraj po datumu (najnoviji prvo)
  unosi.sort((a, b) => b.datumObj - a.datumObj);

  // Ukloni datumObj iz rezultata
  const unosiResult = unosi.map(u => ({
    datum: u.datum,
    odjel: u.odjel,
    radiliste: u.radiliste,
    izvodjac: u.izvodjac,
    primac: u.primac,
    sortimenti: u.sortimenti,
    ukupno: u.ukupno
  }));

  Logger.log('=== HANDLE PRIMAC DETAIL END ===');
  Logger.log(`Ukupno unosa: ${unosiResult.length}`);

  return createJsonResponse({
    sortimentiNazivi: SORTIMENTI_NAZIVI,
    unosi: unosiResult
  }, true);
}

// ========================================
// OTPREMAC DETAIL API - Personalni prikaz za otpremača
// ========================================

/**
 * Otpremac Detail endpoint - vraća sve unose za specificnog otpremača
 * Sortiran po datumu (najnoviji prvo)
 */
function handleOtpremacDetail(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  // Dohvati puno ime korisnika iz login rezultata
  const userFullName = loginResult.fullName;

  Logger.log('=== HANDLE OTPREMAC DETAIL START ===');
  Logger.log('User: ' + userFullName);
  Logger.log('Year: ' + year);

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

  if (!otpremaSheet) {
    return createJsonResponse({ error: "INDEKS_OTPREMA sheet not found in BAZA_PODATAKA" }, false);
  }

  const otpremaData = otpremaSheet.getDataRange().getValues();
  const unosi = [];

  // Procesiranje OTPREMA podataka - filtrirati samo za ovog otpremača
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const datum = row[OTPREMA_COL.DATE];         // A - DATUM
    const otpremac = row[OTPREMA_COL.OTPREMAC];  // B - OTPREMAČ
    const kupac = row[OTPREMA_COL.KUPAC];        // C - KUPAC
    const odjel = row[OTPREMA_COL.ODJEL];        // D - ODJEL
    const radiliste = row[OTPREMA_COL.RADILISTE]; // E - RADILIŠTE
    const izvodjac = row[OTPREMA_COL.IZVODJAC];   // F - IZVOĐAČ
    const kubik = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0; // Z - UKUPNO Č+L

    if (!datum || !otpremac) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    // Filtriraj samo unose za ovog otpremača
    if (String(otpremac).trim() !== userFullName) continue;

    // Pročitaj sve sortimente (G-Z, indeksi 6-25)
    const sortimenti = {};
    for (let j = 0; j < 20; j++) {
      const vrijednost = parseFloat(row[OTPREMA_COL.SORT_START + j]) || 0;
      sortimenti[SORTIMENTI_NAZIVI[j]] = vrijednost;
    }

    unosi.push({
      datum: formatDate(datumObj),
      datumObj: datumObj,  // Za sortiranje
      odjel: odjel,
      radiliste: radiliste,
      izvodjac: izvodjac,
      otpremac: otpremac,
      kupac: kupac || '',
      sortimenti: sortimenti,
      ukupno: kubik
    });
  }

  // Sortiraj po datumu (najnoviji prvo)
  unosi.sort((a, b) => b.datumObj - a.datumObj);

  // Ukloni datumObj iz rezultata
  const unosiResult = unosi.map(u => ({
    datum: u.datum,
    odjel: u.odjel,
    radiliste: u.radiliste,
    izvodjac: u.izvodjac,
    otpremac: u.otpremac,
    kupac: u.kupac,
    sortimenti: u.sortimenti,
    ukupno: u.ukupno
  }));

  Logger.log('=== HANDLE OTPREMAC DETAIL END ===');
  Logger.log(`Ukupno unosa: ${unosiResult.length}`);

  return createJsonResponse({
    sortimentiNazivi: SORTIMENTI_NAZIVI,
    unosi: unosiResult
  }, true);
}

// ========================================
// PRIMAC ODJELI API - Prikaz po odjelima za primača
// ========================================

/**
 * Primac Odjeli endpoint - vraća podatke grupisane po odjelima za specificnog primača
 * Sortiran po zadnjem datumu (najsvježiji prvo)
 */
function handlePrimacOdjeli(year, username, password, limit) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  const userFullName = loginResult.fullName;

  // ✅ OPTIMIZACIJA: Limit na broj odjela (default 15 - zadnjih 15 odjela)
  const odjeliLimit = limit ? parseInt(limit) : 15;

  Logger.log('=== HANDLE PRIMAC ODJELI START ===');
  Logger.log('User: ' + userFullName);
  Logger.log('Limit: ' + odjeliLimit);

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");

  if (!primkaSheet) {
    return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found in BAZA_PODATAKA" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  Logger.log('Total primka rows: ' + (primkaData.length - 1));

  // Map: odjelNaziv -> { sortimenti: {}, ukupno: 0, zadnjiDatum: Date }
  const odjeliMap = {};
  let matchedRows = 0;

  // ✅ OPTIMIZACIJA: Procesiranje svih godina (ne filtriramo po godini)
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const datum = row[PRIMKA_COL.DATE];       // A - DATUM
    const primac = row[PRIMKA_COL.RADNIK];    // B - RADNIK/PRIMAČ
    const odjel = row[PRIMKA_COL.ODJEL];      // C - ODJEL
    const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO Č+L

    if (!datum || !primac || !odjel) continue;

    const datumObj = parseDate(datum);

    // 🔍 DEBUG: Log prvi par redova da vidimo format podataka
    if (i <= 3) {
      Logger.log(`Row ${i}: primac="${primac}" vs userFullName="${userFullName}"`);
    }

    // ✅ CASE-INSENSITIVE matching za primača
    const primacNormalized = String(primac).trim().toLowerCase();
    const userNormalized = String(userFullName).trim().toLowerCase();

    if (primacNormalized !== userNormalized) continue;

    matchedRows++;

    // Inicijalizuj odjel ako ne postoji
    if (!odjeliMap[odjel]) {
      odjeliMap[odjel] = {
        sortimenti: {},
        ukupno: 0,
        zadnjiDatum: null
      };
      // Inicijalizuj sve sortimente na 0
      for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
        odjeliMap[odjel].sortimenti[SORTIMENTI_NAZIVI[s]] = 0;
      }
    }

    // Dodaj sortimente (F-Y, indeksi 5-24)
    for (let j = 0; j < 20; j++) {
      const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
      odjeliMap[odjel].sortimenti[SORTIMENTI_NAZIVI[j]] += vrijednost;
    }

    odjeliMap[odjel].ukupno += kubik;

    // Ažuriraj zadnji datum
    if (!odjeliMap[odjel].zadnjiDatum || datumObj > odjeliMap[odjel].zadnjiDatum) {
      odjeliMap[odjel].zadnjiDatum = datumObj;
    }
  }

  // Konvertuj u array i sortiraj po zadnjem datumu
  const odjeliArray = [];
  for (const odjelNaziv in odjeliMap) {
    const odjel = odjeliMap[odjelNaziv];
    odjeliArray.push({
      odjel: odjelNaziv,
      sortimenti: odjel.sortimenti,
      ukupno: odjel.ukupno,
      zadnjiDatum: odjel.zadnjiDatum,
      zadnjiDatumStr: odjel.zadnjiDatum ? formatDate(odjel.zadnjiDatum) : '',
      godina: odjel.zadnjiDatum ? odjel.zadnjiDatum.getFullYear() : null
    });
  }

  // Sortiraj po zadnjem datumu (najnoviji prvo)
  odjeliArray.sort((a, b) => {
    if (!a.zadnjiDatum && !b.zadnjiDatum) return 0;
    if (!a.zadnjiDatum) return 1;
    if (!b.zadnjiDatum) return -1;
    return b.zadnjiDatum - a.zadnjiDatum;
  });

  // ✅ OPTIMIZACIJA: Vrati samo top N odjela (umjesto svih)
  const topOdjeli = odjeliArray.slice(0, odjeliLimit);

  // Ukloni zadnjiDatum objekt (ostavi samo string)
  const odjeliResult = topOdjeli.map(o => ({
    odjel: o.odjel,
    sortimenti: o.sortimenti,
    ukupno: o.ukupno,
    zadnjiDatum: o.zadnjiDatumStr,
    godina: o.godina
  }));

  Logger.log('=== HANDLE PRIMAC ODJELI END ===');
  Logger.log(`Matched rows: ${matchedRows}`);
  Logger.log(`Total unique odjeli: ${odjeliArray.length}`);
  Logger.log(`Vraćeno odjela: ${odjeliResult.length} od ${odjeliArray.length}`);

  return createJsonResponse({
    sortimentiNazivi: SORTIMENTI_NAZIVI,
    odjeli: odjeliResult
  }, true);
}

// ========================================
// ADMIN: PRIMAC DETAIL - Prikaz podataka za izabranog primača (admin only)
// ========================================
function handlePrimacDetailAdmin(year, username, password, primacName) {
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }
  var userType = String(loginResult.type || '').trim().toLowerCase();
  if (userType !== 'admin' && username !== ADMIN_USERNAME) {
    return createJsonResponse({ error: "Samo admin može koristiti ovaj endpoint" }, false);
  }
  if (!primacName) {
    return createJsonResponse({ error: "Parametar primacName je obavezan" }, false);
  }

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");
  if (!primkaSheet) {
    return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found in BAZA_PODATAKA" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const unosi = [];

  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const datum = row[PRIMKA_COL.DATE];
    const primac = row[PRIMKA_COL.RADNIK];
    const odjel = row[PRIMKA_COL.ODJEL];
    const radiliste = row[PRIMKA_COL.RADILISTE];
    const izvodjac = row[PRIMKA_COL.IZVODJAC];
    const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0;

    if (!datum || !primac) continue;
    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;
    if (String(primac).trim().toLowerCase() !== String(primacName).trim().toLowerCase()) continue;

    const sortimenti = {};
    for (let j = 0; j < 20; j++) {
      sortimenti[SORTIMENTI_NAZIVI[j]] = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
    }

    unosi.push({
      datum: formatDate(datumObj), datumObj: datumObj, odjel: odjel,
      radiliste: radiliste, izvodjac: izvodjac, primac: String(primac).trim(),
      sortimenti: sortimenti, ukupno: kubik
    });
  }

  unosi.sort((a, b) => b.datumObj - a.datumObj);

  return createJsonResponse({
    sortimentiNazivi: SORTIMENTI_NAZIVI,
    unosi: unosi.map(u => ({ datum: u.datum, odjel: u.odjel, radiliste: u.radiliste, izvodjac: u.izvodjac, primac: u.primac, sortimenti: u.sortimenti, ukupno: u.ukupno }))
  }, true);
}

// ========================================
// ADMIN: PRIMAC ODJELI - Prikaz po odjelima za izabranog primača (admin only)
// ========================================
function handlePrimacOdjeliAdmin(year, username, password, primacName, limit) {
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }
  var userType = String(loginResult.type || '').trim().toLowerCase();
  if (userType !== 'admin' && username !== ADMIN_USERNAME) {
    return createJsonResponse({ error: "Samo admin može koristiti ovaj endpoint" }, false);
  }
  if (!primacName) {
    return createJsonResponse({ error: "Parametar primacName je obavezan" }, false);
  }

  const odjeliLimit = limit ? parseInt(limit) : 15;
  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");
  if (!primkaSheet) {
    return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found in BAZA_PODATAKA" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const odjeliMap = {};

  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const datum = row[PRIMKA_COL.DATE];
    const primac = row[PRIMKA_COL.RADNIK];
    const odjel = row[PRIMKA_COL.ODJEL];
    const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0;

    if (!datum || !primac || !odjel) continue;
    const datumObj = parseDate(datum);
    if (String(primac).trim().toLowerCase() !== String(primacName).trim().toLowerCase()) continue;

    if (!odjeliMap[odjel]) {
      odjeliMap[odjel] = { sortimenti: {}, ukupno: 0, zadnjiDatum: null };
      for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
        odjeliMap[odjel].sortimenti[SORTIMENTI_NAZIVI[s]] = 0;
      }
    }

    for (let j = 0; j < 20; j++) {
      odjeliMap[odjel].sortimenti[SORTIMENTI_NAZIVI[j]] += parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
    }
    odjeliMap[odjel].ukupno += kubik;
    if (!odjeliMap[odjel].zadnjiDatum || datumObj > odjeliMap[odjel].zadnjiDatum) {
      odjeliMap[odjel].zadnjiDatum = datumObj;
    }
  }

  const odjeliArray = [];
  for (const odjelNaziv in odjeliMap) {
    const o = odjeliMap[odjelNaziv];
    odjeliArray.push({
      odjel: odjelNaziv, sortimenti: o.sortimenti, ukupno: o.ukupno,
      zadnjiDatumStr: o.zadnjiDatum ? formatDate(o.zadnjiDatum) : '',
      zadnjiDatum: o.zadnjiDatum,
      godina: o.zadnjiDatum ? o.zadnjiDatum.getFullYear() : null
    });
  }

  odjeliArray.sort((a, b) => {
    if (!a.zadnjiDatum && !b.zadnjiDatum) return 0;
    if (!a.zadnjiDatum) return 1;
    if (!b.zadnjiDatum) return -1;
    return b.zadnjiDatum - a.zadnjiDatum;
  });

  return createJsonResponse({
    sortimentiNazivi: SORTIMENTI_NAZIVI,
    odjeli: odjeliArray.slice(0, odjeliLimit).map(o => ({
      odjel: o.odjel, sortimenti: o.sortimenti, ukupno: o.ukupno,
      zadnjiDatum: o.zadnjiDatumStr, godina: o.godina
    }))
  }, true);
}

// ========================================
// OTPREMAC ODJELI API - Prikaz po odjelima za otpremača
// ========================================

/**
 * Otpremac Odjeli endpoint - vraća podatke grupisane po odjelima za specificnog otpremača
 * Sortiran po zadnjem datumu (najsvježiji prvo)
 */
function handleOtpremacOdjeli(year, username, password, limit) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  const userFullName = loginResult.fullName;

  // ✅ OPTIMIZACIJA: Limit na broj odjela (default 15 - zadnjih 15 odjela)
  const odjeliLimit = limit ? parseInt(limit) : 15;

  Logger.log('=== HANDLE OTPREMAC ODJELI START ===');
  Logger.log('User: ' + userFullName);
  Logger.log('Limit: ' + odjeliLimit);

  const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

  if (!otpremaSheet) {
    return createJsonResponse({ error: "INDEKS_OTPREMA sheet not found in BAZA_PODATAKA" }, false);
  }

  const otpremaData = otpremaSheet.getDataRange().getValues();
  Logger.log('Total otprema rows: ' + (otpremaData.length - 1));

  // Map: odjelNaziv -> { sortimenti: {}, ukupno: 0, zadnjiDatum: Date }
  const odjeliMap = {};
  let matchedRows = 0;

  // ✅ OPTIMIZACIJA: Procesiranje svih godina (ne filtriramo po godini)
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const datum = row[OTPREMA_COL.DATE];        // A - DATUM
    const otpremac = row[OTPREMA_COL.OTPREMAC]; // B - OTPREMAČ
    const odjel = row[OTPREMA_COL.ODJEL];       // D - ODJEL
    const kubik = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0; // Z - UKUPNO Č+L

    if (!datum || !otpremac || !odjel) continue;

    const datumObj = parseDate(datum);

    // 🔍 DEBUG: Log prvi par redova da vidimo format podataka
    if (i <= 3) {
      Logger.log(`Row ${i}: otpremac="${otpremac}" vs userFullName="${userFullName}"`);
    }

    // ✅ CASE-INSENSITIVE matching za otpremača
    const otpremacNormalized = String(otpremac).trim().toLowerCase();
    const userNormalized = String(userFullName).trim().toLowerCase();

    if (otpremacNormalized !== userNormalized) continue;

    matchedRows++;

    // Inicijalizuj odjel ako ne postoji
    if (!odjeliMap[odjel]) {
      odjeliMap[odjel] = {
        sortimenti: {},
        ukupno: 0,
        zadnjiDatum: null
      };
      // Inicijalizuj sve sortimente na 0
      for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
        odjeliMap[odjel].sortimenti[SORTIMENTI_NAZIVI[s]] = 0;
      }
    }

    // Dodaj sortimente (G-Z, indeksi 6-25)
    for (let j = 0; j < 20; j++) {
      const vrijednost = parseFloat(row[OTPREMA_COL.SORT_START + j]) || 0;
      odjeliMap[odjel].sortimenti[SORTIMENTI_NAZIVI[j]] += vrijednost;
    }

    odjeliMap[odjel].ukupno += kubik;

    // Ažuriraj zadnji datum
    if (!odjeliMap[odjel].zadnjiDatum || datumObj > odjeliMap[odjel].zadnjiDatum) {
      odjeliMap[odjel].zadnjiDatum = datumObj;
    }
  }

  // Konvertuj u array i sortiraj po zadnjem datumu
  const odjeliArray = [];
  for (const odjelNaziv in odjeliMap) {
    const odjel = odjeliMap[odjelNaziv];
    odjeliArray.push({
      odjel: odjelNaziv,
      sortimenti: odjel.sortimenti,
      ukupno: odjel.ukupno,
      zadnjiDatum: odjel.zadnjiDatum,
      zadnjiDatumStr: odjel.zadnjiDatum ? formatDate(odjel.zadnjiDatum) : '',
      godina: odjel.zadnjiDatum ? odjel.zadnjiDatum.getFullYear() : null
    });
  }

  // Sortiraj po zadnjem datumu (najnoviji prvo)
  odjeliArray.sort((a, b) => {
    if (!a.zadnjiDatum && !b.zadnjiDatum) return 0;
    if (!a.zadnjiDatum) return 1;
    if (!b.zadnjiDatum) return -1;
    return b.zadnjiDatum - a.zadnjiDatum;
  });

  // ✅ OPTIMIZACIJA: Vrati samo top N odjela (umjesto svih)
  const topOdjeli = odjeliArray.slice(0, odjeliLimit);

  // Ukloni zadnjiDatum objekt (ostavi samo string)
  const odjeliResult = topOdjeli.map(o => ({
    odjel: o.odjel,
    sortimenti: o.sortimenti,
    ukupno: o.ukupno,
    zadnjiDatum: o.zadnjiDatumStr,
    godina: o.godina
  }));

  Logger.log('=== HANDLE OTPREMAC ODJELI END ===');
  Logger.log(`Matched rows: ${matchedRows}`);
  Logger.log(`Total unique odjeli: ${odjeliArray.length}`);
  Logger.log(`Vraćeno odjela: ${odjeliResult.length} od ${odjeliArray.length}`);

  return createJsonResponse({
    sortimentiNazivi: SORTIMENTI_NAZIVI,
    odjeli: odjeliResult
  }, true);
}

// ========================================
// ADD SJECA API - Dodavanje nove sječe
// ========================================

/**
 * Add Sjeca endpoint - dodaje novi unos u INDEX_PRIMKA
 */

// ========================================
// 2. DATA INPUT HANDLERS
// ========================================

function handleAddSjeca(params) {
  try {
    // Autentikacija
    const loginResult = JSON.parse(handleLogin(params.username, params.password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    // Samo primači mogu dodavati sječu
    if (loginResult.type !== 'primac') {
      return createJsonResponse({ error: "Only primači can add sječa entries" }, false);
    }

    const userFullName = loginResult.fullName;

    Logger.log('=== HANDLE ADD SJECA START ===');
    Logger.log('User: ' + userFullName);
    Logger.log('Odjel: ' + params.odjel);
    Logger.log('Datum: ' + params.datum);
    Logger.log('ImageUrl: ' + (params.imageUrl || 'NONE'));

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    let unosSheet = ss.getSheetByName("PRIMAČ_UNOS");

    // Kreiraj PRIMAČ_UNOS sheet ako ne postoji
    if (!unosSheet) {
      unosSheet = ss.insertSheet("PRIMAČ_UNOS");
      // Dodaj header red - ista struktura kao INDEKS_PRIMKA + STATUS + TIMESTAMP + IMAGE_URL
      const headers = ["DATUM", "RADNIK", "ODJEL", "RADILIŠTE", "IZVOĐAČ", "POSLOVOĐA",
                       "F/L Č", "I Č", "II Č", "III Č", "RD", "TRUPCI Č",
                       "CEL.DUGA", "CEL.CIJEPANA", "ŠKART", "Σ ČETINARI",
                       "F/L L", "I L", "II L", "III L", "TRUPCI L",
                       "OGR.DUGI", "OGR.CIJEPANI", "GULE", "LIŠĆARI", "UKUPNO Č+L",
                       "STATUS", "TIMESTAMP", "IMAGE_URL"];
      unosSheet.appendRow(headers);

      // Formatiraj header
      const headerRange = unosSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#047857");
      headerRange.setFontColor("white");
      headerRange.setFontWeight("bold");
    }

    // Pripremi red podataka - struktura kao INDEKS_PRIMKA
    const newRow = [
      parseDate(params.datum),  // A - DATUM
      userFullName,             // B - RADNIK/PRIMAČ
      params.odjel,             // C - ODJEL
      params.radiliste || '',   // D - RADILIŠTE
      params.izvodjac || '',    // E - IZVOĐAČ
      params.poslovodja || ''   // F - POSLOVOĐA
    ];

    // Dodaj sortimente G-Z (20 kolona)
    const sortimentiValues = [];
    for (let i = 0; i < 19; i++) { // prvih 19 sortimenti (bez UKUPNO)
      const value = parseFloat(params[SORTIMENTI_NAZIVI[i]]) || 0;
      newRow.push(value);
      sortimentiValues.push(value);
    }

    // Izračunaj UKUPNO Č+L kao ČETINARI + LIŠĆARI
    const cetinari = sortimentiValues[9];  // Σ ČETINARI je na indeksu 9
    const liscari = sortimentiValues[18];  // LIŠĆARI je na indeksu 18
    const ukupno = cetinari + liscari;

    // Dodaj UKUPNO Č+L (Y)
    newRow.push(ukupno);

    // Dodaj STATUS, TIMESTAMP i IMAGE_URL
    newRow.push("PENDING");
    newRow.push(new Date());
    newRow.push(params.imageUrl || '');  // IMAGE_URL

    // Dodaj red na kraj sheet-a
    unosSheet.appendRow(newRow);

    // 🚀 CACHE: Invalidate all cache after successful write
    invalidateAllCache();

    Logger.log('=== HANDLE ADD SJECA END ===');
    Logger.log('Successfully added new sjeca entry to PRIMAČ_UNOS');

    return createJsonResponse({
      success: true,
      message: "Sječa poslana rukovodiocu na pregled",
      ukupno: ukupno
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleAddSjeca: ' + error.toString());
    return createJsonResponse({
      error: "Greška pri dodavanju sječe: " + error.toString()
    }, false);
  }
}

// ========================================
// ADD OTPREMA API - Dodavanje nove otpreme
// ========================================

/**
 * Add Otprema endpoint - dodaje novi unos u OTPREMAČ_UNOS
 */
function handleAddOtprema(params) {
  try {
    // Autentikacija
    const loginResult = JSON.parse(handleLogin(params.username, params.password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    // Samo otpremači mogu dodavati otpremu
    if (loginResult.type !== 'otpremac') {
      return createJsonResponse({ error: "Only otpremači can add otprema entries" }, false);
    }

    const userFullName = loginResult.fullName;

    Logger.log('=== HANDLE ADD OTPREMA START ===');
    Logger.log('User: ' + userFullName);
    Logger.log('Odjel: ' + params.odjel);
    Logger.log('Datum: ' + params.datum);
    Logger.log('Kupac: ' + params.kupac);

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    let unosSheet = ss.getSheetByName("OTPREMAČ_UNOS");

    // Kreiraj OTPREMAČ_UNOS sheet ako ne postoji
    if (!unosSheet) {
      unosSheet = ss.insertSheet("OTPREMAČ_UNOS");
      // Dodaj header red - ista struktura kao INDEKS_OTPREMA + BROJ_OTPREMNICE + STATUS + TIMESTAMP
      const headers = ["DATUM", "OTPREMAČ", "KUPAC", "ODJEL", "RADILIŠTE", "IZVOĐAČ", "POSLOVOĐA",
                       "F/L Č", "I Č", "II Č", "III Č", "RD", "TRUPCI Č",
                       "CEL.DUGA", "CEL.CIJEPANA", "ŠKART", "Σ ČETINARI",
                       "F/L L", "I L", "II L", "III L", "TRUPCI L",
                       "OGR.DUGI", "OGR.CIJEPANI", "GULE", "LIŠĆARI", "UKUPNO Č+L",
                       "BROJ_OTPREMNICE", "STATUS", "TIMESTAMP"];
      unosSheet.appendRow(headers);

      // Formatiraj header
      const headerRange = unosSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#2563eb");
      headerRange.setFontColor("white");
      headerRange.setFontWeight("bold");
    }

    // Pripremi red podataka - struktura kao INDEKS_OTPREMA
    const newRow = [
      parseDate(params.datum),  // A - DATUM
      userFullName,             // B - OTPREMAČ
      params.kupac || '',       // C - KUPAC
      params.odjel,             // D - ODJEL
      params.radiliste || '',   // E - RADILIŠTE
      params.izvodjac || '',    // F - IZVOĐAČ
      params.poslovodja || ''   // G - POSLOVOĐA
    ];

    // Dodaj sortimente H-AA (20 kolona)
    const sortimentiValues = [];
    for (let i = 0; i < 19; i++) { // prvih 19 sortimenti (bez UKUPNO)
      const value = parseFloat(params[SORTIMENTI_NAZIVI[i]]) || 0;
      newRow.push(value);
      sortimentiValues.push(value);
    }

    // Izračunaj UKUPNO Č+L kao ČETINARI + LIŠĆARI
    const cetinari = sortimentiValues[9];  // Σ ČETINARI je na indeksu 9
    const liscari = sortimentiValues[18];  // LIŠĆARI je na indeksu 18
    const ukupno = cetinari + liscari;

    // Dodaj UKUPNO Č+L (Z)
    newRow.push(ukupno);

    // Dodaj BROJ_OTPREMNICE, STATUS i TIMESTAMP
    newRow.push(params.brojOtpremnice || '');
    newRow.push("PENDING");
    newRow.push(new Date());

    // Dodaj red na kraj sheet-a
    unosSheet.appendRow(newRow);

    // 🚀 CACHE: Invalidate all cache after successful write
    invalidateAllCache();

    Logger.log('=== HANDLE ADD OTPREMA END ===');
    Logger.log('Successfully added new otprema entry to OTPREMAČ_UNOS');

    return createJsonResponse({
      success: true,
      message: "Otprema poslana rukovodiocu na pregled",
      ukupno: ukupno
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleAddOtprema: ' + error.toString());
    return createJsonResponse({
      error: "Greška pri dodavanju otpreme: " + error.toString()
    }, false);
  }
}

// ========================================
// PENDING UNOSI API - Prikaz pending unosa za rukovodioca
// ========================================

/**
 * Pending Unosi endpoint - vraća sve pending unose za pregled rukovodioca
 */
function handlePendingUnosi(year, username, password) {
  try {
    // Autentikacija
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    Logger.log('=== HANDLE PENDING UNOSI START ===');
    Logger.log('User: ' + loginResult.fullName);
    Logger.log('Year: ' + year);

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);

    const primacUnosSheet = ss.getSheetByName("PRIMAČ_UNOS");
    const otpremacUnosSheet = ss.getSheetByName("OTPREMAČ_UNOS");

    const pendingUnosi = [];

    // Pročitaj PRIMAČ_UNOS
    // Struktura: A-F=Basic(0-5), G-Z=Sortimenti(6-25), AA=STATUS(26), AB=TIMESTAMP(27), AC=IMAGE_URL(28)
    if (primacUnosSheet) {
      const primkaData = primacUnosSheet.getDataRange().getValues();

      for (let i = 1; i < primkaData.length; i++) {
        const row = primkaData[i];
        const datum = row[0];       // A - DATUM
        const primac = row[1];      // B - RADNIK
        const odjel = row[2];       // C - ODJEL
        const radiliste = row[3];   // D - RADILIŠTE
        const izvodjac = row[4];    // E - IZVOĐAČ
        const status = row[26];     // AA - STATUS (index 26)
        const timestamp = row[27];  // AB - TIMESTAMP (index 27)
        const imageUrl = row[28] || '';  // AC - IMAGE_URL (index 28)

        if (!datum || status !== "PENDING") continue;

        const datumObj = parseDate(datum);
        if (year && datumObj.getFullYear() !== parseInt(year)) continue;

        // Pročitaj sortimente (G-Z, indeksi 6-25)
        const sortimenti = {};
        for (let j = 0; j < 20; j++) {
          const vrijednost = parseFloat(row[6 + j]) || 0;
          sortimenti[SORTIMENTI_NAZIVI[j]] = vrijednost;
        }

        // Izračunaj ukupno kao ČETINARI + LIŠĆARI
        const cetinari = parseFloat(sortimenti['Σ ČETINARI']) || 0;
        const liscari = parseFloat(sortimenti['LIŠĆARI']) || 0;
        const ukupno = cetinari + liscari;

        pendingUnosi.push({
          id: i,
          tip: 'SJEČA',
          datum: formatDate(datumObj),
          odjel: odjel,
          radiliste: radiliste || '',
          izvodjac: izvodjac || '',
          radnik: primac,
          kupac: '',
          sortimenti: sortimenti,
          ukupno: ukupno,
          timestamp: formatDate(new Date(timestamp)),
          timestampObj: new Date(timestamp),
          imageUrl: imageUrl
        });
      }
    }

    // Pročitaj OTPREMAČ_UNOS
    // Struktura: A=Datum, B=Otpremač, C=Kupac, D=Odjel, E=Radilište, F=Izvođač, G-Z=Sortimenti, AA=BrojOtpr, AB=STATUS, AC=TIMESTAMP
    if (otpremacUnosSheet) {
      const otpremaData = otpremacUnosSheet.getDataRange().getValues();

      for (let i = 1; i < otpremaData.length; i++) {
        const row = otpremaData[i];
        const datum = row[0];          // A - DATUM
        const otpremac = row[1];       // B - OTPREMAČ
        const kupac = row[2];          // C - KUPAC
        const odjel = row[3];          // D - ODJEL
        const radiliste = row[4];      // E - RADILIŠTE
        const izvodjac = row[5];       // F - IZVOĐAČ
        const brojOtpremnice = row[26]; // AA - BROJ_OTPREMNICE
        const status = row[27];        // AB - STATUS
        const timestamp = row[28];     // AC - TIMESTAMP

        if (!datum || status !== "PENDING") continue;

        const datumObj = parseDate(datum);
        if (year && datumObj.getFullYear() !== parseInt(year)) continue;

        // Pročitaj sortimente (G-Z, indeksi 6-25)
        const sortimenti = {};
        for (let j = 0; j < 20; j++) {
          const vrijednost = parseFloat(row[6 + j]) || 0;
          sortimenti[SORTIMENTI_NAZIVI[j]] = vrijednost;
        }

        // Izračunaj ukupno kao ČETINARI + LIŠĆARI
        const cetinari = parseFloat(sortimenti['Σ ČETINARI']) || 0;
        const liscari = parseFloat(sortimenti['LIŠĆARI']) || 0;
        const ukupno = cetinari + liscari;

        pendingUnosi.push({
          id: i,
          tip: 'OTPREMA',
          datum: formatDate(datumObj),
          odjel: odjel,
          radiliste: radiliste || '',
          izvodjac: izvodjac || '',
          radnik: otpremac,
          kupac: kupac || '',
          brojOtpremnice: brojOtpremnice || '',
          sortimenti: sortimenti,
          ukupno: ukupno,
          timestamp: formatDate(new Date(timestamp)),
          timestampObj: new Date(timestamp)
        });
      }
    }

    // Sortiraj po timestamp-u (najnoviji prvo)
    pendingUnosi.sort((a, b) => b.timestampObj - a.timestampObj);

    // Ukloni timestampObj iz rezultata
    const rezultat = pendingUnosi.map(u => ({
      id: u.id,
      tip: u.tip,
      datum: u.datum,
      odjel: u.odjel,
      radiliste: u.radiliste,
      izvodjac: u.izvodjac,
      radnik: u.radnik,
      kupac: u.kupac,
      brojOtpremnice: u.brojOtpremnice,
      sortimenti: u.sortimenti,
      ukupno: u.ukupno,
      timestamp: u.timestamp
    }));

    Logger.log('=== HANDLE PENDING UNOSI END ===');
    Logger.log(`Ukupno pending unosa: ${rezultat.length}`);

    return createJsonResponse({
      sortimentiNazivi: SORTIMENTI_NAZIVI,
      unosi: rezultat
    }, true);

  } catch (error) {
    Logger.log('ERROR in handlePendingUnosi: ' + error.toString());
    return createJsonResponse({
      error: "Greška pri učitavanju pending unosa: " + error.toString()
    }, false);
  }
}

// Handler za prikaz mojih pending unosa (zadnjih 10)
function handleMyPending(username, password, tip) {
  try {
    Logger.log('=== HANDLE MY PENDING START ===');
    Logger.log('Username: ' + username);
    Logger.log('Tip: ' + tip); // 'sjeca' ili 'otprema'

    // Verify user
    const user = verifyUser(username, password);
    if (!user) {
      return createJsonResponse({ error: 'Neispravno korisničko ime ili lozinka' }, false);
    }

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const sheetName = tip === 'sjeca' ? 'PRIMAČ_UNOS' : 'OTPREMAČ_UNOS';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return createJsonResponse({
        unosi: [],
        message: 'Nema pending unosa'
      }, true);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find column indices - nova struktura koristi RADNIK za primač i OTPREMAČ za otpremač
    const radnikCol = tip === 'sjeca' ?
      headers.indexOf('RADNIK') :
      headers.indexOf('OTPREMAČ');
    const statusCol = headers.indexOf('STATUS');
    const timestampCol = headers.indexOf('TIMESTAMP');
    const rowIdCol = headers.indexOf('ROW_ID'); // We'll add this for tracking

    const rezultat = [];

    // Process rows (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Check if this entry belongs to the current user and is pending
      if (row[statusCol] === 'PENDING' && row[radnikCol] === user.ime) {
        const unos = {
          rowIndex: i + 1, // Store row index for editing
          datum: row[headers.indexOf('DATUM')],
          odjel: row[headers.indexOf('ODJEL')],
          timestamp: row[timestampCol],
          sortimenti: {}
        };

        // Add kupac and broj otpremnice for otprema
        if (tip === 'otprema') {
          unos.kupac = row[headers.indexOf('KUPAC')] || '';
          unos.brojOtpremnice = row[headers.indexOf('BROJ_OTPREMNICE')] || '';
        }

        // Extract all sortimenti
        headers.forEach((header, idx) => {
          if (header !== 'ODJEL' && header !== 'DATUM' && header !== 'PRIMAČ' &&
              header !== 'OTPREMAČ' && header !== 'KUPAC' && header !== 'BROJ_OTPREMNICE' && header !== 'STATUS' &&
              header !== 'TIMESTAMP' && header !== 'ROW_ID' && header !== 'SVEUKUPNO') {
            unos.sortimenti[header] = row[idx] || 0;
          }
        });

        rezultat.push(unos);
      }
    }

    // Sort by timestamp (newest first) and take last 10
    rezultat.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const last10 = rezultat.slice(0, 10);

    Logger.log('=== HANDLE MY PENDING END ===');
    Logger.log(`Found ${last10.length} pending entries for user ${user.ime}`);

    return createJsonResponse({
      unosi: last10
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleMyPending: ' + error.toString());
    return createJsonResponse({
      error: "Greška pri učitavanju mojih unosa: " + error.toString()
    }, false);
  }
}

// Handler za ažuriranje pending unosa
function handleUpdatePending(params) {
  try {
    Logger.log('=== HANDLE UPDATE PENDING START ===');

    const username = params.username;
    const password = params.password;
    const tip = params.tip; // 'sjeca' ili 'otprema'
    const rowIndex = parseInt(params.rowIndex);

    // Verify user
    const user = verifyUser(username, password);
    if (!user) {
      return createJsonResponse({ error: 'Neispravno korisničko ime ili lozinka' }, false);
    }

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const sheetName = tip === 'sjeca' ? 'PRIMAČ_UNOS' : 'OTPREMAČ_UNOS';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return createJsonResponse({ error: 'Sheet ne postoji' }, false);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const row = data[rowIndex - 1];

    // Verify ownership (only the creator or admin can edit)
    const radnikCol = tip === 'sjeca' ? headers.indexOf('RADNIK') : headers.indexOf('OTPREMAČ');
    const statusCol = headers.indexOf('STATUS');

    if (row[statusCol] !== 'PENDING') {
      return createJsonResponse({ error: 'Ovaj unos nije više pending' }, false);
    }

    if (user.uloga !== 'admin' && row[radnikCol] !== user.ime) {
      return createJsonResponse({ error: 'Nemate pravo da uredite ovaj unos' }, false);
    }

    // Build updated row
    const updatedRow = [...row];

    // Update datum and odjel
    updatedRow[headers.indexOf('DATUM')] = params.datum;
    updatedRow[headers.indexOf('ODJEL')] = params.odjel;

    // Update kupac and broj otpremnice for otprema
    if (tip === 'otprema') {
      if (params.kupac !== undefined) {
        updatedRow[headers.indexOf('KUPAC')] = params.kupac;
      }
      if (params.brojOtpremnice !== undefined) {
        updatedRow[headers.indexOf('BROJ_OTPREMNICE')] = params.brojOtpremnice;
      }
    }

    // Update all sortimenti
    headers.forEach((header, idx) => {
      if (params[header] !== undefined && header !== 'ODJEL' && header !== 'DATUM' &&
          header !== 'PRIMAČ' && header !== 'OTPREMAČ' && header !== 'KUPAC' && header !== 'BROJ_OTPREMNICE' &&
          header !== 'STATUS' && header !== 'TIMESTAMP' && header !== 'SVEUKUPNO') {
        const value = parseFloat(params[header]) || 0;
        updatedRow[idx] = value;
      }
    });

    // Izračunaj SVEUKUPNO kao ČETINARI + LIŠĆARI
    const cetinariCol = headers.indexOf('ČETINARI');
    const liscariCol = headers.indexOf('LIŠĆARI');
    const cetinari = cetinariCol !== -1 ? (parseFloat(updatedRow[cetinariCol]) || 0) : 0;
    const liscari = liscariCol !== -1 ? (parseFloat(updatedRow[liscariCol]) || 0) : 0;
    const ukupno = cetinari + liscari;

    // Update SVEUKUPNO if it exists
    const sveukupnoCol = headers.indexOf('SVEUKUPNO');
    if (sveukupnoCol !== -1) {
      updatedRow[sveukupnoCol] = ukupno;
    }

    // Update timestamp to show it was edited
    updatedRow[headers.indexOf('TIMESTAMP')] = new Date();

    // Write updated row back to sheet
    sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);

    Logger.log('=== HANDLE UPDATE PENDING END ===');
    Logger.log(`Updated row ${rowIndex} in ${sheetName}`);

    return createJsonResponse({
      success: true,
      message: 'Unos uspješno ažuriran',
      ukupno: ukupno
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleUpdatePending: ' + error.toString());
    return createJsonResponse({
      error: "Greška pri ažuriranju unosa: " + error.toString()
    }, false);
  }
}

// Handler za brisanje pending unosa
function handleDeletePending(params) {
  try {
    Logger.log('=== HANDLE DELETE PENDING START ===');

    const username = params.username;
    const password = params.password;
    const tip = params.tip;
    const rowIndex = parseInt(params.rowIndex);

    // Verify user
    const user = verifyUser(username, password);
    if (!user) {
      return createJsonResponse({ error: 'Neispravno korisničko ime ili lozinka' }, false);
    }

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const sheetName = tip === 'sjeca' ? 'PRIMAČ_UNOS' : 'OTPREMAČ_UNOS';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return createJsonResponse({ error: 'Sheet ne postoji' }, false);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const row = data[rowIndex - 1];

    // Verify ownership (only the creator or admin can delete)
    const radnikCol = tip === 'sjeca' ? headers.indexOf('RADNIK') : headers.indexOf('OTPREMAČ');
    const statusCol = headers.indexOf('STATUS');

    if (row[statusCol] !== 'PENDING') {
      return createJsonResponse({ error: 'Ovaj unos nije više pending' }, false);
    }

    if (user.uloga !== 'admin' && row[radnikCol] !== user.ime) {
      return createJsonResponse({ error: 'Nemate pravo da obrišete ovaj unos' }, false);
    }

    // Delete the row
    sheet.deleteRow(rowIndex);

    Logger.log('=== HANDLE DELETE PENDING END ===');
    Logger.log(`Deleted row ${rowIndex} from ${sheetName}`);

    return createJsonResponse({
      success: true,
      message: 'Unos uspješno obrisan'
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleDeletePending: ' + error.toString());
    return createJsonResponse({
      error: "Greška pri brisanju unosa: " + error.toString()
    }, false);
  }
}

// Handler za dobijanje liste odjela iz foldera
function handleGetOdjeliList() {
  try {
    Logger.log('=== HANDLE GET ODJELI LIST START ===');

    const folder = DriveApp.getFolderById(ODJELI_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

    const odjeliList = [];

    while (files.hasNext()) {
      const file = files.next();
      // Remove file extension and get just the odjel name
      let odjelName = file.getName().replace(/\.(xlsx|xls|gsheet)$/i, '');
      odjeliList.push(odjelName);
    }

    // Sort alphabetically
    odjeliList.sort();

    Logger.log('=== HANDLE GET ODJELI LIST END ===');
    Logger.log('Found ' + odjeliList.length + ' odjeli');

    return createJsonResponse({
      success: true,
      odjeli: odjeliList
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleGetOdjeliList: ' + error.toString());
    return createJsonResponse({
      error: "Greška pri učitavanju liste odjela: " + error.toString()
    }, false);
  }
}

// Handler za mjesečne sortimente
function handleMjesecniSortimenti(year, username, password) {
  try {
    // Autentikacija
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    // 🚀 CACHE: Try to get from cache first
    const cacheKey = `mjesecni_sortimenti_${year}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return createJsonResponse(cached, true);
    }

    Logger.log('=== HANDLE MJESECNI SORTIMENTI START ===');
    Logger.log('Year: ' + year);

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");
    const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

    if (!primkaSheet || !otpremaSheet) {
      return createJsonResponse({ error: "INDEKS sheets not found in BAZA_PODATAKA" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const otpremaData = otpremaSheet.getDataRange().getValues();

    // Inicijalizuj mjesečne sume za SJEČA (12 mjeseci)
    let sjecaMjeseci = [];
    for (let m = 0; m < 12; m++) {
      const mjesecObj = {};
      for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
        mjesecObj[SORTIMENTI_NAZIVI[s]] = 0;
      }
      sjecaMjeseci.push(mjesecObj);
    }

    // Inicijalizuj mjesečne sume za OTPREMA (12 mjeseci)
    let otpremaMjeseci = [];
    for (let m = 0; m < 12; m++) {
      const mjesecObj = {};
      for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
        mjesecObj[SORTIMENTI_NAZIVI[s]] = 0;
      }
      otpremaMjeseci.push(mjesecObj);
    }

    // Procesiranje SJEČA podataka
    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const datum = row[PRIMKA_COL.DATE]; // A - DATUM

      if (!datum) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11

      // Sortimenti (F-Y, indeksi 5-24)
      for (let j = 0; j < SORTIMENTI_NAZIVI.length; j++) {
        const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
        sjecaMjeseci[mjesec][SORTIMENTI_NAZIVI[j]] += vrijednost;
      }
    }

    // Procesiranje OTPREMA podataka
    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const datum = row[OTPREMA_COL.DATE]; // A - DATUM

      if (!datum) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11

      // Sortimenti (G-Z, indeksi 6-25)
      for (let j = 0; j < SORTIMENTI_NAZIVI.length; j++) {
        const vrijednost = parseFloat(row[OTPREMA_COL.SORT_START + j]) || 0;
        otpremaMjeseci[mjesec][SORTIMENTI_NAZIVI[j]] += vrijednost;
      }
    }

    Logger.log('=== HANDLE MJESECNI SORTIMENTI END ===');

    // 🚀 CACHE: Store result before returning
    const result = {
      sjeca: {
        sortimenti: SORTIMENTI_NAZIVI,
        mjeseci: sjecaMjeseci
      },
      otprema: {
        sortimenti: SORTIMENTI_NAZIVI,
        mjeseci: otpremaMjeseci
      }
    };
    setCachedData(cacheKey, result, CACHE_TTL);

    return createJsonResponse(result, true);

  } catch (error) {
    Logger.log('ERROR in handleMjesecniSortimenti: ' + error.toString());
    return createJsonResponse({
      error: "Greška pri učitavanju mjesečnih sortimenti: " + error.toString()
    }, false);
  }
}

// ========================================
// PRIMACI DAILY API - Daily data for current month
// ========================================
function handlePrimaciDaily(year, month, username, password) {
  try {
    // Authentication
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");

    if (!primkaSheet) {
      return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found in BAZA_PODATAKA" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const dailyData = [];

    // Process PRIMKA data
    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const datum = row[PRIMKA_COL.DATE];       // A - DATUM
      const primac = row[PRIMKA_COL.RADNIK];    // B - RADNIK/PRIMAČ
      const odjel = row[PRIMKA_COL.ODJEL];      // C - ODJEL
      const radiliste = row[PRIMKA_COL.RADILISTE] || ''; // D - RADILIŠTE
      const izvodjac = row[PRIMKA_COL.IZVODJAC] || '';   // E - IZVOĐAČ

      if (!datum || !primac) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;
      if (datumObj.getMonth() !== parseInt(month)) continue;

      // Build sortimenti object
      const sortimenti = {};
      for (let j = 0; j < SORTIMENTI_NAZIVI.length; j++) {
        sortimenti[SORTIMENTI_NAZIVI[j]] = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
      }

      dailyData.push({
        datum: Utilities.formatDate(datumObj, Session.getScriptTimeZone(), "dd.MM.yyyy"),
        datumSort: datumObj.getTime(),
        odjel: odjel || "",
        radiliste: radiliste,
        izvodjac: izvodjac,
        primac: primac,
        sortimenti: sortimenti
      });
    }

    // Sort by date (newest first)
    dailyData.sort((a, b) => b.datumSort - a.datumSort);

    return createJsonResponse({
      sortimentiNazivi: SORTIMENTI_NAZIVI,
      data: dailyData
    }, true);

  } catch (error) {
    return createJsonResponse({
      error: "Greška pri učitavanju dnevnih podataka sječe: " + error.toString()
    }, false);
  }
}

// ========================================
// OTPREMACI DAILY API - Daily data for current month
// ========================================
function handleOtremaciDaily(year, month, username, password) {
  try {
    // Authentication
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

    if (!otpremaSheet) {
      return createJsonResponse({ error: "INDEKS_OTPREMA sheet not found in BAZA_PODATAKA" }, false);
    }

    const otpremaData = otpremaSheet.getDataRange().getValues();
    const dailyData = [];

    // Process OTPREMA data
    // INDEKS_OTPREMA struktura: A=datum, B=otpremac, C=kupac, D=odjel, E=radiliste, F=izvodjac, G-Z=sortimenti(20)
    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const datum = row[OTPREMA_COL.DATE];         // A - DATUM
      const otpremac = row[OTPREMA_COL.OTPREMAC];  // B - OTPREMAČ
      const kupac = row[OTPREMA_COL.KUPAC] || "";  // C - KUPAC
      const odjel = row[OTPREMA_COL.ODJEL];        // D - ODJEL
      const radiliste = row[OTPREMA_COL.RADILISTE] || ""; // E - RADILIŠTE
      const izvodjac = row[OTPREMA_COL.IZVODJAC] || "";   // F - IZVOĐAČ

      if (!datum || !otpremac) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;
      if (datumObj.getMonth() !== parseInt(month)) continue;

      // Build sortimenti object
      const sortimenti = {};
      for (let j = 0; j < SORTIMENTI_NAZIVI.length; j++) {
        sortimenti[SORTIMENTI_NAZIVI[j]] = parseFloat(row[OTPREMA_COL.SORT_START + j]) || 0;
      }

      dailyData.push({
        datum: Utilities.formatDate(datumObj, Session.getScriptTimeZone(), "dd.MM.yyyy"),
        datumSort: datumObj.getTime(),
        odjel: odjel || "",
        otpremac: otpremac,
        kupac: kupac,
        radiliste: radiliste,
        izvodjac: izvodjac,
        sortimenti: sortimenti
      });
    }

    // Sort by date (newest first)
    dailyData.sort((a, b) => b.datumSort - a.datumSort);

    return createJsonResponse({
      sortimentiNazivi: SORTIMENTI_NAZIVI,
      data: dailyData
    }, true);

  } catch (error) {
    return createJsonResponse({
      error: "Greška pri učitavanju dnevnih podataka otpreme: " + error.toString()
    }, false);
  }
}

// ========================================
// DAILY CHART API - Agregirana dnevna sječa i otprema za graf
// ========================================
function handleDailyChart(year, month, username, password) {
  try {
    // Authentication
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");
    const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

    if (!primkaSheet || !otpremaSheet) {
      return createJsonResponse({ error: "Required sheets not found in BAZA_PODATAKA" }, false);
    }

    const yearInt = parseInt(year);
    const monthInt = parseInt(month); // 0-indexed (January = 0)

    // Get current date for limiting days (only for current month)
    const now = new Date();
    const isCurrentMonth = (now.getFullYear() === yearInt && now.getMonth() === monthInt);
    const maxDay = isCurrentMonth ? now.getDate() : new Date(yearInt, monthInt + 1, 0).getDate();

    // Initialize daily totals map (day 1..maxDay)
    const dailyData = {};
    for (let d = 1; d <= maxDay; d++) {
      dailyData[d] = { day: d, sjeca: 0, otprema: 0 };
    }

    // Process SJEČA from INDEKS_PRIMKA - use UKUPNO Č+L column
    const primkaData = primkaSheet.getDataRange().getValues();
    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const datum = row[PRIMKA_COL.DATE];
      if (!datum) continue;

      const datumObj = parseDate(datum);
      if (!datumObj || isNaN(datumObj.getTime())) continue;
      if (datumObj.getFullYear() !== yearInt) continue;
      if (datumObj.getMonth() !== monthInt) continue;

      const day = datumObj.getDate();
      if (day < 1 || day > maxDay) continue;

      const ukupno = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0;
      dailyData[day].sjeca += ukupno;
    }

    // Process OTPREMA from INDEKS_OTPREMA - use UKUPNO Č+L column
    const otpremaData = otpremaSheet.getDataRange().getValues();
    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const datum = row[OTPREMA_COL.DATE];
      if (!datum) continue;

      const datumObj = parseDate(datum);
      if (!datumObj || isNaN(datumObj.getTime())) continue;
      if (datumObj.getFullYear() !== yearInt) continue;
      if (datumObj.getMonth() !== monthInt) continue;

      const day = datumObj.getDate();
      if (day < 1 || day > maxDay) continue;

      const ukupno = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0;
      dailyData[day].otprema += ukupno;
    }

    // Convert to sorted array - filter only working days
    // Mon-Fri (getDay 1-5): always include
    // Saturday (getDay 6): include only if has data (sjeca > 0 OR otprema > 0)
    // Sunday (getDay 0): never include
    const result = Object.values(dailyData)
      .filter(entry => {
        const dateObj = new Date(yearInt, monthInt, entry.day);
        const dayOfWeek = dateObj.getDay();

        // Sunday - never include
        if (dayOfWeek === 0) return false;

        // Saturday - include only if working (has data)
        if (dayOfWeek === 6) {
          return (entry.sjeca > 0 || entry.otprema > 0);
        }

        // Mon-Fri - always include
        return true;
      })
      .sort((a, b) => a.day - b.day);

    return createJsonResponse({
      year: yearInt,
      month: monthInt,
      maxDay: maxDay,
      data: result
    }, true);

  } catch (error) {
    return createJsonResponse({
      error: "Greška pri učitavanju dnevnih podataka za graf: " + error.toString()
    }, false);
  }
}

// ========================================
// 3. SYNC/ADMIN HANDLERS
// ========================================

function handleStanjeOdjela(username, password) {
  // Verify user
  const user = verifyUser(username, password);
  if (!user) {
    return createJsonResponse({ error: 'Invalid credentials' }, false);
  }

  try {
    Logger.log('=== HANDLE STANJE ODJELA START (from cache) ===');

    // Fiksno sortimentno zaglavlje (D-U kolone)
    const sortimentiNazivi = [
      'F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'TRUPCI Č',
      'CEL.DUGA', 'CEL.CIJEPANA', 'ČETINARI',
      'F/L L', 'I L', 'II L', 'III L', 'TRUPCI L',
      'OGR. DUGI', 'OGR. CIJEPANI', 'LIŠĆARI',
      'SVEUKUPNO'
    ];

    // Otvori cache sheet iz BAZA_PODATAKA
    const bazaPodataka = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const cacheSheet = bazaPodataka.getSheetByName('STANJE_ODJELA_CACHE');

    if (!cacheSheet) {
      Logger.log('Cache sheet ne postoji, pozivam syncStanjeOdjela()');
      syncStanjeOdjela();
      // Ponovo otvori nakon sinkronizacije
      const cacheSheetNew = bazaPodataka.getSheetByName('STANJE_ODJELA_CACHE');
      if (!cacheSheetNew) {
        throw new Error('Nije moguće kreirati cache sheet');
      }
      return handleStanjeOdjela(username, password); // Rekurzivno pozovi ponovo
    }

    // Čitaj podatke sa sheeta (preskoči prve 2 reda: metadata i header)
    const dataRange = cacheSheet.getDataRange();
    const allData = dataRange.getValues();

    if (allData.length <= 2) {
      Logger.log('Cache sheet je prazan, pozivam syncStanjeOdjela()');
      syncStanjeOdjela();
      return handleStanjeOdjela(username, password); // Rekurzivno pozovi ponovo
    }

    // Parse podatke sa sheeta
    // Nova struktura: [Red Tip, Odjel Naziv, Radilište, Izvođač, Zadnji Datum, ...cijeli red iz OTPREMA]
    const odjeliData = [];
    const odjeliMap = new Map(); // Mapa: odjelNaziv -> odjel objekt

    for (let i = 2; i < allData.length; i++) {
      const row = allData[i];
      const redTip = row[0]; // PROJEKAT, SJEČA, OTPREMA, ZALIHA
      const odjelNaziv = row[1];
      const radiliste = row[2];
      const izvodjac = row[3];
      const zadnjiDatumFormatted = row[4];
      const dataRow = row.slice(5); // Cijeli red iz OTPREMA sheeta (sve kolone)

      // Zadnja kolona u dataRow je SVEUKUPNO (na poziciji koja odgovara koloni U u OTPREMA)
      const sveukupno = dataRow[dataRow.length - 1] || 0;

      // Ako odjel nije u mapi, dodaj ga
      if (!odjeliMap.has(odjelNaziv)) {
        odjeliMap.set(odjelNaziv, {
          odjel: odjelNaziv,
          radiliste: radiliste,
          zadnjiDatum: zadnjiDatumFormatted,
          datumZadnjeSjece: zadnjiDatumFormatted,
          projekat: 0,
          sjeca: 0,
          otprema: 0,
          sumaPanj: 0,
          izvođač: izvodjac || '',
          realizacija: 0,
          zadnjiDatumObj: null,
          redovi: {
            projekat: [],
            sjeca: [],
            otprema: [],
            sumaLager: []
          }
        });
      }

      const odjel = odjeliMap.get(odjelNaziv);

      // dataRow sadrži sve kolone iz OTPREMA sheeta (od A do kraja)
      // Sortimenti su u kolonama D-U (indeksi 3-20 u originalnom sheetu, što je 3-20 u dataRow jer dataRow počinje od A=0)
      // Izvuci samo sortimente (18 kolona: D-U)
      const sortimentiData = dataRow.slice(3, 21); // Kolone D-U (indeksi 3-20, slice(3,21) jer je end ekskluzan)

      if (redTip === 'PROJEKAT') {
        odjel.redovi.projekat = sortimentiData;
        odjel.projekat = parseFloat(sveukupno) || 0;
      } else if (redTip === 'SJEČA') {
        odjel.redovi.sjeca = sortimentiData;
        odjel.sjeca = parseFloat(sveukupno) || 0;
      } else if (redTip === 'OTPREMA') {
        odjel.redovi.otprema = sortimentiData;
        odjel.otprema = parseFloat(sveukupno) || 0;
      } else if (redTip === 'ZALIHA') {
        odjel.redovi.sumaLager = sortimentiData;
        odjel.sumaPanj = parseFloat(sveukupno) || 0;
      }
    }

    // Konvertuj mapu u niz i izračunaj realizaciju
    odjeliMap.forEach(odjel => {
      if (odjel.projekat > 0) {
        odjel.realizacija = (odjel.sjeca / odjel.projekat) * 100;
      }
      odjeliData.push(odjel);
    });

    // Već je sortirano u syncStanjeOdjela, ali provjerimo opet
    odjeliData.sort((a, b) => {
      if (!a.zadnjiDatum && !b.zadnjiDatum) return 0;
      if (!a.zadnjiDatum) return 1;
      if (!b.zadnjiDatum) return -1;
      return b.zadnjiDatum - a.zadnjiDatum;
    });

    Logger.log('=== HANDLE STANJE ODJELA END (from cache) ===');
    Logger.log('Broj odjela iz cache-a: ' + odjeliData.length);

    return createJsonResponse({
      data: odjeliData,
      sortimentiNazivi: sortimentiNazivi
    }, true);

  } catch (error) {
    Logger.log('=== HANDLE STANJE ODJELA ERROR ===');
    Logger.log(error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

/**
 * API Endpoint za ručno osvježavanje cache-a stanja odjela
 * Samo admin korisnici mogu koristiti ovu funkciju
 */
function handleSyncStanjeOdjela(username, password) {
  // Verify user
  const user = verifyUser(username, password);
  if (!user) {
    return createJsonResponse({ error: 'Invalid credentials' }, false);
  }

  // Provjeri da li je korisnik admin
  if (user.tip.toLowerCase() !== 'admin') {
    return createJsonResponse({ error: 'Samo admin korisnici mogu osvježiti cache' }, false);
  }

  try {
    Logger.log('=== HANDLE SYNC STANJE ODJELA START (manual refresh by ' + username + ') ===');

    // Pozovi syncStanjeOdjela() funkciju
    const result = syncStanjeOdjela();

    Logger.log('=== HANDLE SYNC STANJE ODJELA END ===');
    return createJsonResponse({
      message: 'Cache uspješno osvježen',
      ...result
    }, true);

  } catch (error) {
    Logger.log('=== HANDLE SYNC STANJE ODJELA ERROR ===');
    Logger.log(error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}
function handleSyncIndex(username, password) {
  // Verify user
  const user = verifyUser(username, password);
  if (!user) {
    return createJsonResponse({ error: 'Invalid credentials' }, false);
  }

  // Provjeri da li je korisnik admin
  if (user.tip.toLowerCase() !== 'admin') {
    return createJsonResponse({ error: 'Samo admin korisnici mogu pokrenuti indeksiranje' }, false);
  }

  try {
    Logger.log('=== HANDLE SYNC INDEX START (manual trigger by ' + username + ') ===');

    // Pozovi INDEKS_DODAJ_NOVE() funkciju - inkrementalno dodavanje
    const result = INDEKS_DODAJ_NOVE();

    Logger.log('=== HANDLE SYNC INDEX END ===');
    return createJsonResponse({
      message: 'Indeksiranje uspješno pokrenuto i završeno',
      success: true,
      filesProcessed: result.filesProcessed || 0,
      filesSkipped: result.filesSkipped || 0,
      primkaAdded: result.primkaAdded || 0,
      otpremaAdded: result.otpremaAdded || 0
    }, true);

  } catch (error) {
    Logger.log('=== HANDLE SYNC INDEX ERROR ===');
    Logger.log(error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}
function handlePrimaciByRadiliste(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  Logger.log('=== HANDLE PRIMACI BY RADILISTE START ===');
  Logger.log('Year: ' + year);

  try {
    // Učitaj podatke direktno iz BAZA_PODATAKA - radilište je sada u koloni D
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");

    if (!primkaSheet) {
      return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found in BAZA_PODATAKA" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();

    // Grupisanje po radilištu
    const radilistaMap = {};

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const datum = row[PRIMKA_COL.DATE];       // A - DATUM
      const odjel = row[PRIMKA_COL.ODJEL];      // C - ODJEL
      const radiliste = row[PRIMKA_COL.RADILISTE] || 'Nepoznato'; // D - RADILIŠTE

      if (!datum) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11
      const radilisteNorm = String(radiliste).trim() || 'Nepoznato';

      // Inicijalizuj radilište ako ne postoji
      if (!radilistaMap[radilisteNorm]) {
        radilistaMap[radilisteNorm] = {
          naziv: radilisteNorm,
          mjeseci: Array(12).fill(0),
          sortimentiUkupno: {},
          ukupno: 0
        };
        SORTIMENTI_NAZIVI.forEach(s => radilistaMap[radilisteNorm].sortimentiUkupno[s] = 0);
      }

      // Dodaj kubike po mjesecu
      const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO Č+L
      radilistaMap[radilisteNorm].mjeseci[mjesec] += kubik;
      radilistaMap[radilisteNorm].ukupno += kubik;

      // Dodaj sortimente (F-Y, indeksi 5-24)
      for (let j = 0; j < 20; j++) {
        const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
        radilistaMap[radilisteNorm].sortimentiUkupno[SORTIMENTI_NAZIVI[j]] += vrijednost;
      }
    }

    // Konvertuj u array i sortiraj
    const radilista = [];
    for (const naziv in radilistaMap) {
      radilista.push(radilistaMap[naziv]);
    }
    radilista.sort((a, b) => b.ukupno - a.ukupno);

    Logger.log('=== HANDLE PRIMACI BY RADILISTE END ===');
    Logger.log('Broj radilišta: ' + radilista.length);

    return createJsonResponse({
      radilista: radilista,
      sortimentiNazivi: SORTIMENTI_NAZIVI
    }, true);

  } catch (error) {
    Logger.log('ERROR in handlePrimaciByRadiliste: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ========================================
// PRIMACI BY IZVODJAC - Prikaz sječe po izvođačima
// ========================================

function handlePrimaciByIzvodjac(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  Logger.log('=== HANDLE PRIMACI BY IZVODJAC START ===');
  Logger.log('Year: ' + year);

  try {
    // Učitaj podatke direktno iz BAZA_PODATAKA - izvođač je sada u koloni E
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");

    if (!primkaSheet) {
      return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found in BAZA_PODATAKA" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();

    // Grupisanje po izvođaču
    const izvodjaciMap = {};

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const datum = row[PRIMKA_COL.DATE];       // A - DATUM
      const odjel = row[PRIMKA_COL.ODJEL];      // C - ODJEL
      const izvodjac = row[PRIMKA_COL.IZVODJAC] || 'Nepoznat'; // E - IZVOĐAČ

      if (!datum) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11
      const izvodjacNorm = String(izvodjac).trim() || 'Nepoznat';

      // Inicijalizuj izvođača ako ne postoji
      if (!izvodjaciMap[izvodjacNorm]) {
        izvodjaciMap[izvodjacNorm] = {
          naziv: izvodjacNorm,
          mjeseci: Array(12).fill(0),
          sortimentiUkupno: {},
          ukupno: 0
        };
        SORTIMENTI_NAZIVI.forEach(s => izvodjaciMap[izvodjacNorm].sortimentiUkupno[s] = 0);
      }

      // Dodaj kubike po mjesecu
      const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0; // Y - UKUPNO Č+L
      izvodjaciMap[izvodjacNorm].mjeseci[mjesec] += kubik;
      izvodjaciMap[izvodjacNorm].ukupno += kubik;

      // Dodaj sortimente (F-Y, indeksi 5-24)
      for (let j = 0; j < 20; j++) {
        const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
        izvodjaciMap[izvodjacNorm].sortimentiUkupno[SORTIMENTI_NAZIVI[j]] += vrijednost;
      }
    }

    // Konvertuj u array i sortiraj
    const izvodjaci = [];
    for (const naziv in izvodjaciMap) {
      izvodjaci.push(izvodjaciMap[naziv]);
    }
    izvodjaci.sort((a, b) => b.ukupno - a.ukupno);

    Logger.log('=== HANDLE PRIMACI BY IZVODJAC END ===');
    Logger.log('Broj izvođača: ' + izvodjaci.length);

    return createJsonResponse({
      izvodjaci: izvodjaci,
      sortimentiNazivi: SORTIMENTI_NAZIVI
    }, true);

  } catch (error) {
    Logger.log('ERROR in handlePrimaciByIzvodjac: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ========================================
// HANDLE PRIMKE - Vraća sve pojedinačne primke
// ========================================
function handlePrimke(username, password) {
  try {
    // Autentikacija
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    Logger.log('=== HANDLE PRIMKE START ===');

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const indexSheet = ss.getSheetByName("INDEKS_PRIMKA");

    const primke = [];

    if (indexSheet) {
      const data = indexSheet.getDataRange().getValues();

      // Skip header row (row 0)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const datum = row[PRIMKA_COL.DATE];       // A - DATUM
        const primac = row[PRIMKA_COL.RADNIK];    // B - RADNIK/PRIMAČ
        const odjel = row[PRIMKA_COL.ODJEL];      // C - ODJEL
        const radiliste = row[PRIMKA_COL.RADILISTE] || ''; // D - RADILIŠTE
        const izvodjac = row[PRIMKA_COL.IZVODJAC] || '';   // E - IZVOĐAČ
        const poslovodja = row[PRIMKA_COL.POSLOVODJA] || ''; // F - POSLOVOĐA

        // Skip empty rows
        if (!datum || !odjel) continue;

        // Formatuj datum
        const datumObj = parseDate(datum);
        const datumStr = formatDate(datumObj);

        const odjelStr = String(odjel || '');

        // Dodaj svaki sortiment kao poseban zapis (ako ima količinu)
        for (let j = 0; j < 19; j++) { // Bez UKUPNO Č+L (zadnji je agregirani)
          const kolicina = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
          if (kolicina > 0) {
            primke.push({
              datum: datumStr,
              odjel: odjelStr,
              radiliste: radiliste,
              izvodjac: izvodjac,
              poslovodja: poslovodja,
              sortiment: SORTIMENTI_NAZIVI[j],
              kolicina: kolicina,
              primac: primac
            });
          }
        }
      }
    }

    Logger.log('=== HANDLE PRIMKE END ===');
    Logger.log('Broj primki: ' + primke.length);

    return createJsonResponse({ primke: primke }, true);

  } catch (error) {
    Logger.log('ERROR in handlePrimke: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ========================================
// HANDLE OTPREME - Vraća sve pojedinačne otpreme
// ========================================
function handleOtpreme(username, password) {
  try {
    // Autentikacija
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    Logger.log('=== HANDLE OTPREME START ===');

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const indexSheet = ss.getSheetByName("INDEKS_OTPREMA");

    const otpreme = [];

    if (indexSheet) {
      const data = indexSheet.getDataRange().getValues();

      // Skip header row (row 0)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const datum = row[OTPREMA_COL.DATE];       // A - DATUM
        const otpremac = row[OTPREMA_COL.OTPREMAC]; // B - OTPREMAČ
        const kupac = row[OTPREMA_COL.KUPAC];      // C - KUPAC
        const odjel = row[OTPREMA_COL.ODJEL];      // D - ODJEL
        const radiliste = row[OTPREMA_COL.RADILISTE] || ''; // E - RADILIŠTE
        const izvodjac = row[OTPREMA_COL.IZVODJAC] || '';   // F - IZVOĐAČ
        const poslovodja = row[OTPREMA_COL.POSLOVODJA] || ''; // G - POSLOVOĐA

        // Skip empty rows
        if (!datum || !odjel) continue;

        // Formatuj datum
        const datumObj = parseDate(datum);
        const datumStr = formatDate(datumObj);

        const odjelStr = String(odjel || '');

        // Dodaj svaki sortiment kao poseban zapis (ako ima količinu)
        for (let j = 0; j < 19; j++) { // Bez UKUPNO Č+L
          const kolicina = parseFloat(row[OTPREMA_COL.SORT_START + j]) || 0;
          if (kolicina > 0) {
            otpreme.push({
              datum: datumStr,
              odjel: odjelStr,
              radiliste: radiliste,
              izvodjac: izvodjac,
              poslovodja: poslovodja,
              sortiment: SORTIMENTI_NAZIVI[j],
              kolicina: kolicina,
              otpremac: otpremac,
              kupac: kupac || ''
            });
          }
        }
      }
    }

    Logger.log('=== HANDLE OTPREME END ===');
    Logger.log('Broj otprema: ' + otpreme.length);

    return createJsonResponse({ otpreme: otpreme }, true);

  } catch (error) {
    Logger.log('ERROR in handleOtpreme: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}
function handleGetDinamika(year, username, password) {
  try {
    // Autentikacija
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    // Samo admin može pristupiti dinamici
    if (loginResult.type !== 'admin') {
      return createJsonResponse({ error: "Only admin can access dinamika" }, false);
    }

    Logger.log('=== HANDLE GET DINAMIKA START ===');
    Logger.log('Year: ' + year);

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    let dinamikaSheet = ss.getSheetByName("DINAMIKA");

    // Ako sheet ne postoji, kreiraj ga
    if (!dinamikaSheet) {
      dinamikaSheet = ss.insertSheet("DINAMIKA");
      const headers = ["GODINA", "JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AVG", "SEP", "OKT", "NOV", "DEC", "UKUPNO"];
      dinamikaSheet.appendRow(headers);

      // Formatiraj header
      const headerRange = dinamikaSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#f59e0b");
      headerRange.setFontColor("white");
      headerRange.setFontWeight("bold");

      Logger.log('Created new DINAMIKA sheet');
    }

    const data = dinamikaSheet.getDataRange().getValues();
    const dinamika = {};

    // Skip header row, pronađi red za godinu
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowYear = parseInt(row[0]) || 0;

      // Ako postoji red za traženu godinu
      if (rowYear === parseInt(year)) {
        // Vrati mjesečne vrijednosti
        for (let j = 1; j <= 12; j++) {
          const mjesecKey = String(j).padStart(2, '0');
          dinamika[mjesecKey] = parseFloat(row[j]) || 0;
        }
        break;
      }
    }

    Logger.log('=== HANDLE GET DINAMIKA END ===');
    Logger.log('Found data: ' + (Object.keys(dinamika).length > 0));

    return createJsonResponse({ dinamika: dinamika }, true);

  } catch (error) {
    Logger.log('ERROR in handleGetDinamika: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

/**
 * Save Dinamika endpoint - snima mjesečnu dinamiku
 */
function handleSaveDinamika(username, password, godina, mjeseciParam) {
  try {
    Logger.log('=== HANDLE SAVE DINAMIKA START ===');
    Logger.log('Username: ' + username);
    Logger.log('Godina: ' + godina);
    Logger.log('Mjeseci param type: ' + typeof mjeseciParam);
    Logger.log('Mjeseci param: ' + mjeseciParam);

    // Autentikacija
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    // Samo admin može dodavati dinamiku
    if (loginResult.type !== 'admin') {
      return createJsonResponse({ error: "Only admin can add dinamika" }, false);
    }

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    let dinamikaSheet = ss.getSheetByName("DINAMIKA");

    // Ako sheet ne postoji, kreiraj ga
    if (!dinamikaSheet) {
      dinamikaSheet = ss.insertSheet("DINAMIKA");
      const headers = ["GODINA", "JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AVG", "SEP", "OKT", "NOV", "DEC", "UKUPNO"];
      dinamikaSheet.appendRow(headers);

      // Formatiraj header
      const headerRange = dinamikaSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#f59e0b");
      headerRange.setFontColor("white");
      headerRange.setFontWeight("bold");
    }

    const allData = dinamikaSheet.getDataRange().getValues();
    const godinaInt = parseInt(godina);

    // Parse mjeseci JSON ako je string (dolazi iz GET parametra)
    let mjeseciObj = mjeseciParam;
    if (typeof mjeseciParam === 'string') {
      Logger.log('Parsing mjeseci from string...');
      mjeseciObj = JSON.parse(mjeseciParam);
    }

    // Pripremi red podataka - 12 mjesečnih vrijednosti
    let mjesecneVrijednosti = [];
    let ukupno = 0;
    for (let i = 1; i <= 12; i++) {
      const mjesecKey = String(i).padStart(2, '0');
      const value = parseFloat(mjeseciObj[mjesecKey]) || 0;
      mjesecneVrijednosti.push(value);
      ukupno += value;
    }

    // Provjeri da li već postoji red za ovu godinu
    let existingRowIndex = -1;
    for (let i = 1; i < allData.length; i++) {
      if (parseInt(allData[i][0]) === godinaInt) {
        existingRowIndex = i;
        break;
      }
    }

    const newRow = [godinaInt, ...mjesecneVrijednosti, ukupno];

    if (existingRowIndex !== -1) {
      // Update postojeći red
      const rowNumber = existingRowIndex + 1; // +1 jer sheet rows počinju od 1
      const range = dinamikaSheet.getRange(rowNumber, 1, 1, newRow.length);
      range.setValues([newRow]);
      Logger.log('Updated existing row for year ' + godinaInt);
    } else {
      // Dodaj novi red
      dinamikaSheet.appendRow(newRow);
      Logger.log('Added new row for year ' + godinaInt);
    }

    // 🚀 CACHE: Invalidate all cache after successful write
    invalidateAllCache();

    Logger.log('=== HANDLE SAVE DINAMIKA END ===');
    Logger.log('Successfully saved dinamika');

    return createJsonResponse({
      success: true,
      message: "Mjesečna dinamika uspješno spremljena",
      ukupno: ukupno
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleSaveDinamika: ' + error.toString());
    return createJsonResponse({
      error: "Greška pri spremanju dinamike: " + error.toString()
    }, false);
  }
}

// ========================================
// 4. DELTA SYNC HANDLERS
// ========================================

function handleManifest() {
  try {
    Logger.log('Manifest endpoint called');

    // Otvori BAZA_PODATAKA spreadsheet
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);

    // Dohvati sheet-ove
    const primkaSheet = ss.getSheetByName('INDEKS_PRIMKA');
    const otpremaSheet = ss.getSheetByName('INDEKS_OTPREMA');

    // Broji redove (minus header red)
    // getLastRow() vraća broj zadnjeg reda sa podacima
    const primaciCount = primkaSheet ? Math.max(primkaSheet.getLastRow() - 1, 0) : 0;
    const otpremaciCount = otpremaSheet ? Math.max(otpremaSheet.getLastRow() - 1, 0) : 0;
    const odjeliCount = 0; // Odjeli sada direktno u podacima

    // Generiši verziju - kombinacija svih count-ova
    // Kad se doda nova sječa/otprema, count se mijenja → nova verzija
    const version = `${primaciCount}-${otpremaciCount}-${odjeliCount}`;

    Logger.log(`Manifest generated - Version: ${version}, Primaci: ${primaciCount}, Otpremaci: ${otpremaciCount}, Odjeli: ${odjeliCount}`);

    // Vrati JSON odgovor
    const manifestData = {
      version: version,
      lastUpdated: new Date().toISOString(),
      data: {
        primaci_count: primaciCount,
        otpremaci_count: otpremaciCount,
        odjeli_count: odjeliCount
      }
    };

    return createJsonResponse(manifestData, true);

  } catch (error) {
    Logger.log('ERROR in handleManifest: ' + error.toString());
    return createJsonResponse({
      error: 'Greška pri generisanju manifesta: ' + error.toString()
    }, false);
  }
}

// ========== MANIFEST DATA ENDPOINT - Delta Sync Row Counts ==========
function handleManifestData(username, password) {
  try {
    Logger.log('Manifest Data endpoint called');

    // Provjeri autentikaciju
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    // Otvori BAZA_PODATAKA spreadsheet
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);

    // Dohvati sheet-ove
    const primkaSheet = ss.getSheetByName('INDEKS_PRIMKA');
    const otpremaSheet = ss.getSheetByName('INDEKS_OTPREMA');

    // Broji redove (minus header red)
    const primkaRowCount = primkaSheet ? Math.max(primkaSheet.getLastRow() - 1, 0) : 0;
    const otpremaRowCount = otpremaSheet ? Math.max(otpremaSheet.getLastRow() - 1, 0) : 0;

    Logger.log(`Manifest Data: Primka=${primkaRowCount}, Otprema=${otpremaRowCount}`);

    // Vrati JSON odgovor
    const manifestData = {
      primkaRowCount: primkaRowCount,
      otpremaRowCount: otpremaRowCount,
      lastUpdated: new Date().toISOString()
    };

    return createJsonResponse(manifestData, true);

  } catch (error) {
    Logger.log('ERROR in handleManifestData: ' + error.toString());
    return createJsonResponse({
      error: 'Greška pri generisanju manifest data: ' + error.toString()
    }, false);
  }
}

// ========== DELTA PRIMKA ENDPOINT - Vraća samo nove redove ==========
function handleDeltaPrimka(username, password, fromRow, toRow) {
  try {
    Logger.log(`Delta Primka endpoint called - fromRow: ${fromRow}, toRow: ${toRow}`);

    // Provjeri autentikaciju
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    // Parse parametri
    const fromRowInt = parseInt(fromRow);
    const toRowInt = parseInt(toRow);

    if (isNaN(fromRowInt) || isNaN(toRowInt) || fromRowInt < 1 || toRowInt < fromRowInt) {
      return createJsonResponse({ error: 'Invalid row range' }, false);
    }

    // Otvori BAZA_PODATAKA spreadsheet
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName('INDEKS_PRIMKA');

    if (!primkaSheet) {
      return createJsonResponse({ error: 'INDEKS_PRIMKA sheet not found' }, false);
    }

    const lastRow = primkaSheet.getLastRow();

    // Adjust toRow if it exceeds lastRow
    const actualToRow = Math.min(toRowInt, lastRow - 1); // -1 for header
    const numRows = actualToRow - fromRowInt + 1;

    if (numRows <= 0) {
      Logger.log('No new rows to fetch');
      return createJsonResponse({ rows: [] }, true);
    }

    // Fetch rows (fromRow+1 jer je red 1 header)
    const startRow = fromRowInt + 1; // +1 for header
    const data = primkaSheet.getRange(startRow, 1, numRows, primkaSheet.getLastColumn()).getValues();

    // Convert to JSON objects sa rowIndex - nova struktura kolona
    const rows = data.map((row, index) => ({
      rowIndex: fromRowInt + index,
      datum: row[PRIMKA_COL.DATE] ? formatDateHelper(row[PRIMKA_COL.DATE]) : '',
      primac: row[PRIMKA_COL.RADNIK] || '',
      odjel: row[PRIMKA_COL.ODJEL] || '',
      radiliste: row[PRIMKA_COL.RADILISTE] || '',
      izvodjac: row[PRIMKA_COL.IZVODJAC] || '',
      kubici: parseFloat(row[PRIMKA_COL.UKUPNO]) || 0
    }));

    Logger.log(`Delta Primka: Returning ${rows.length} rows`);
    return createJsonResponse({ rows: rows }, true);

  } catch (error) {
    Logger.log('ERROR in handleDeltaPrimka: ' + error.toString());
    return createJsonResponse({
      error: 'Greška pri fetchovanju delta primka: ' + error.toString()
    }, false);
  }
}

// ========== DELTA OTPREMA ENDPOINT - Vraća samo nove redove ==========
function handleDeltaOtprema(username, password, fromRow, toRow) {
  try {
    Logger.log(`Delta Otprema endpoint called - fromRow: ${fromRow}, toRow: ${toRow}`);

    // Provjeri autentikaciju
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    // Parse parametri
    const fromRowInt = parseInt(fromRow);
    const toRowInt = parseInt(toRow);

    if (isNaN(fromRowInt) || isNaN(toRowInt) || fromRowInt < 1 || toRowInt < fromRowInt) {
      return createJsonResponse({ error: 'Invalid row range' }, false);
    }

    // Otvori BAZA_PODATAKA spreadsheet
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const otpremaSheet = ss.getSheetByName('INDEKS_OTPREMA');

    if (!otpremaSheet) {
      return createJsonResponse({ error: 'INDEKS_OTPREMA sheet not found' }, false);
    }

    const lastRow = otpremaSheet.getLastRow();

    // Adjust toRow if it exceeds lastRow
    const actualToRow = Math.min(toRowInt, lastRow - 1); // -1 for header
    const numRows = actualToRow - fromRowInt + 1;

    if (numRows <= 0) {
      Logger.log('No new rows to fetch');
      return createJsonResponse({ rows: [] }, true);
    }

    // Fetch rows (fromRow+1 jer je red 1 header)
    const startRow = fromRowInt + 1; // +1 for header
    const data = otpremaSheet.getRange(startRow, 1, numRows, otpremaSheet.getLastColumn()).getValues();

    // Convert to JSON objects sa rowIndex - nova struktura kolona
    const rows = data.map((row, index) => ({
      rowIndex: fromRowInt + index,
      datum: row[OTPREMA_COL.DATE] ? formatDateHelper(row[OTPREMA_COL.DATE]) : '',
      otpremac: row[OTPREMA_COL.OTPREMAC] || '',
      kupac: row[OTPREMA_COL.KUPAC] || '',
      odjel: row[OTPREMA_COL.ODJEL] || '',
      radiliste: row[OTPREMA_COL.RADILISTE] || '',
      izvodjac: row[OTPREMA_COL.IZVODJAC] || '',
      kubici: parseFloat(row[OTPREMA_COL.UKUPNO]) || 0
    }));

    Logger.log(`Delta Otprema: Returning ${rows.length} rows`);
    return createJsonResponse({ rows: rows }, true);

  } catch (error) {
    Logger.log('ERROR in handleDeltaOtprema: ' + error.toString());
    return createJsonResponse({
      error: 'Greška pri fetchovanju delta otprema: ' + error.toString()
    }, false);
  }
}

// ========================================
// POSLOVODJA AKTIVNOST - Zadnjih 5 dana sječa/otprema po odjelima
// + Sortimenti po odjelima (all-time)
// Filtrira po RADILIŠTE, grupira po ODJEL i DATUM
// ========================================
function handlePoslovodjaAktivnost(username, password, radiliste) {
  try {
    // Autentikacija
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    Logger.log('=== HANDLE POSLOVODJA AKTIVNOST START ===');
    Logger.log('Radiliste filter: ' + (radiliste || 'NONE'));

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");
    const otpremaSheet = ss.getSheetByName("INDEKS_OTPREMA");

    if (!primkaSheet || !otpremaSheet) {
      return createJsonResponse({ error: "INDEKS sheets not found in BAZA_PODATAKA" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const otpremaData = otpremaSheet.getDataRange().getValues();

    // Izračunaj zadnjih 5 dana
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);
    fiveDaysAgo.setHours(0, 0, 0, 0);

    Logger.log(`Date range: ${fiveDaysAgo.toISOString()} - ${today.toISOString()}`);

    // Radilište filter (trim + upper za poređenje)
    const radilisteFilter = radiliste ? String(radiliste).trim().toUpperCase() : null;

    // Mapa za agregaciju: { "ODJEL|DATE" -> { odjel, datum, sjeca, otprema } }
    const aktivnostMap = {};

    // Mape za sortimenti po odjelima (ALL-TIME)
    const sjecaSortimentiMap = {};   // { odjel -> { sortimenti: {...} } }
    const otpremaSortimentiMap = {}; // { odjel -> { sortimenti: {...} } }

    // Helper za formatiranje datuma DD.MM.YYYY
    const formatDateStr = (d) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}.${mm}.${yyyy}`;
    };

    // Helper za inicijalizaciju sortimenti objekta
    const initSortimenti = () => {
      const obj = {};
      SORTIMENTI_NAZIVI.forEach(s => obj[s] = 0);
      return obj;
    };

    // Procesiranje PRIMKA (sječa) - zadnjih 5 dana + ALL-TIME sortimenti
    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const datum = row[PRIMKA_COL.DATE];
      const odjel = String(row[PRIMKA_COL.ODJEL] || '').trim();
      const rowRadiliste = String(row[PRIMKA_COL.RADILISTE] || '').trim().toUpperCase();
      const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0;

      if (!odjel) continue;

      // Filter po radilištu
      if (radilisteFilter && rowRadiliste !== radilisteFilter) continue;

      const odjelKey = odjel.toUpperCase();

      // ALL-TIME sortimenti agregacija
      if (!sjecaSortimentiMap[odjelKey]) {
        sjecaSortimentiMap[odjelKey] = {
          odjel: odjel,
          sortimenti: initSortimenti()
        };
      }
      // Dodaj sortimente
      for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
        const val = parseFloat(row[PRIMKA_COL.SORT_START + s]) || 0;
        sjecaSortimentiMap[odjelKey].sortimenti[SORTIMENTI_NAZIVI[s]] += val;
      }

      // Zadnjih 5 dana aktivnost
      if (!datum) continue;
      const datumObj = parseDate(datum);
      if (isNaN(datumObj.getTime())) continue;

      if (datumObj >= fiveDaysAgo && datumObj <= today) {
        const dateKey = formatDateStr(datumObj);
        const key = `${odjelKey}|${dateKey}`;

        if (!aktivnostMap[key]) {
          aktivnostMap[key] = {
            odjel: odjel,
            datum: dateKey,
            datumObj: datumObj,
            sjeca: 0,
            otprema: 0
          };
        }
        aktivnostMap[key].sjeca += kubik;
      }
    }

    // Procesiranje OTPREMA - zadnjih 5 dana + ALL-TIME sortimenti
    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const datum = row[OTPREMA_COL.DATE];
      const odjel = String(row[OTPREMA_COL.ODJEL] || '').trim();
      const rowRadiliste = String(row[OTPREMA_COL.RADILISTE] || '').trim().toUpperCase();
      const kubik = parseFloat(row[OTPREMA_COL.UKUPNO]) || 0;

      if (!odjel) continue;

      // Filter po radilištu
      if (radilisteFilter && rowRadiliste !== radilisteFilter) continue;

      const odjelKey = odjel.toUpperCase();

      // ALL-TIME sortimenti agregacija
      if (!otpremaSortimentiMap[odjelKey]) {
        otpremaSortimentiMap[odjelKey] = {
          odjel: odjel,
          sortimenti: initSortimenti()
        };
      }
      // Dodaj sortimente
      for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
        const val = parseFloat(row[OTPREMA_COL.SORT_START + s]) || 0;
        otpremaSortimentiMap[odjelKey].sortimenti[SORTIMENTI_NAZIVI[s]] += val;
      }

      // Zadnjih 5 dana aktivnost
      if (!datum) continue;
      const datumObj = parseDate(datum);
      if (isNaN(datumObj.getTime())) continue;

      if (datumObj >= fiveDaysAgo && datumObj <= today) {
        const dateKey = formatDateStr(datumObj);
        const key = `${odjelKey}|${dateKey}`;

        if (!aktivnostMap[key]) {
          aktivnostMap[key] = {
            odjel: odjel,
            datum: dateKey,
            datumObj: datumObj,
            sjeca: 0,
            otprema: 0
          };
        }
        aktivnostMap[key].otprema += kubik;
      }
    }

    // Konvertuj mapu u listu i sortiraj po datumu (najnoviji prvo), zatim po odjelu
    const aktivnosti = Object.values(aktivnostMap).sort((a, b) => {
      const dateDiff = b.datumObj - a.datumObj;
      if (dateDiff !== 0) return dateDiff;
      return a.odjel.localeCompare(b.odjel);
    });

    // Ukloni datumObj iz rezultata
    const aktivnostiResult = aktivnosti.map(a => ({
      odjel: a.odjel,
      datum: a.datum,
      sjeca: a.sjeca,
      otprema: a.otprema
    }));

    // Konvertuj sortimenti mape u liste
    const sjecaSortimenti = Object.values(sjecaSortimentiMap).sort((a, b) => a.odjel.localeCompare(b.odjel));
    const otpremaSortimenti = Object.values(otpremaSortimentiMap).sort((a, b) => a.odjel.localeCompare(b.odjel));

    Logger.log(`=== HANDLE POSLOVODJA AKTIVNOST END ===`);
    Logger.log(`Aktivnosti (5 dana): ${aktivnostiResult.length}, Sječa odjeli: ${sjecaSortimenti.length}, Otprema odjeli: ${otpremaSortimenti.length}`);

    return createJsonResponse({
      aktivnosti: aktivnostiResult,
      sjecaSortimenti: sjecaSortimenti,
      otpremaSortimenti: otpremaSortimenti,
      sortimentiNazivi: SORTIMENTI_NAZIVI,
      radiliste: radiliste || 'ALL',
      dateRange: {
        from: formatDateStr(fiveDaysAgo),
        to: formatDateStr(today)
      }
    }, true);

  } catch (error) {
    Logger.log('=== HANDLE POSLOVODJA AKTIVNOST ERROR ===');
    Logger.log('ERROR: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ========================================
// HELPER: Dohvati radilišta poslovođe iz INFO sheeta
// Kolona I (indeks 8) = Poslovođa, Kolona J (indeks 9) = Radilište
// ========================================
function getPoslovodjaRadilistaFromInfo(ss, poslovodjaName) {
  try {
    const infoSheet = ss.getSheetByName("INFO");
    if (!infoSheet) {
      Logger.log('INFO sheet not found');
      return null;
    }

    const data = infoSheet.getDataRange().getValues();
    const radilistaSet = new Set();

    // Normalizuj ime za poređenje - sortiraj dijelove imena da podrži oba redoslijeda
    // npr. "MEHMEDALIJA HARBAŠ" i "HARBAŠ MEHMEDALIJA" će se oba pretvoriti u "HARBAŠ MEHMEDALIJA"
    const normalizedSearchName = poslovodjaName.toUpperCase().trim().split(/\s+/).sort().join(' ');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const poslovodja = String(row[8] || '').toUpperCase().trim();  // Kolona I (indeks 8)
      const radiliste = String(row[9] || '').toUpperCase().trim();   // Kolona J (indeks 9)

      // Poređenje normalizovanih imena (podržava oba redoslijeda: IME PREZIME i PREZIME IME)
      const normalizedSheetName = poslovodja.split(/\s+/).sort().join(' ');
      if (radiliste && normalizedSheetName === normalizedSearchName) {
        radilistaSet.add(radiliste);
      }
    }

    const radilistaArray = Array.from(radilistaSet);
    Logger.log('getPoslovodjaRadilistaFromInfo: Pronađeno ' + radilistaArray.length + ' radilišta za ' + poslovodjaName + ': ' + radilistaArray.join(', '));
    return radilistaArray.length > 0 ? radilistaArray : null;
  } catch (error) {
    Logger.log('ERROR in getPoslovodjaRadilistaFromInfo: ' + error.toString());
    return null;
  }
}

// ========================================
// POSLOVODJA RADILISTA API - Vraća mapping poslovodja→radilišta iz INFO sheeta
// ========================================
function handlePoslovodjaRadilista(username, password, poslovodja) {
  try {
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const poslovodjaName = (poslovodja || '').toUpperCase().trim();
    const radilista = getPoslovodjaRadilistaFromInfo(ss, poslovodjaName);

    return createJsonResponse({
      poslovodja: poslovodjaName,
      radilista: radilista || []
    }, true);
  } catch (error) {
    Logger.log('ERROR in handlePoslovodjaRadilista: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ========================================
// STANJE ZALIHA API - Čita podatke sa STANJE_ZALIHA sheeta
// Filtrira po poslovođi (čita radilišta iz INFO sheeta kolona I i J)
// ========================================
function handleStanjeZaliha(username, password, poslovodja) {
  try {
    // Autentikacija
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    Logger.log('=== HANDLE STANJE ZALIHA START ===');
    Logger.log('Poslovodja filter: ' + (poslovodja || 'NONE'));

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const stanjeSheet = ss.getSheetByName("STANJE_ZALIHA");

    if (!stanjeSheet) {
      return createJsonResponse({ error: "STANJE_ZALIHA sheet not found in BAZA_PODATAKA" }, false);
    }

    // Ako je proslijeđena poslovođa, dohvati radilišta iz INFO sheeta (kolona I=poslovođa, J=radilište)
    let poslovodjaRadilista = null;
    if (poslovodja && poslovodja.trim() !== '') {
      poslovodjaRadilista = getPoslovodjaRadilistaFromInfo(ss, poslovodja.trim().toUpperCase());
      Logger.log('Poslovodja radilista: ' + (poslovodjaRadilista ? poslovodjaRadilista.join(', ') : 'NONE'));
      // Ako poslovođa nema dodijeljena radilišta u INFO sheetu, vrati prazan rezultat
      if (!poslovodjaRadilista || poslovodjaRadilista.length === 0) {
        Logger.log('Poslovodja ' + poslovodja + ' nema dodijeljena radilišta - vraćam prazan rezultat');
        poslovodjaRadilista = ['__NO_MATCH__'];  // Osiguraj da nijedan odjel ne prođe filter
      }
    }

    const data = stanjeSheet.getDataRange().getValues();
    const odjeli = [];
    const radilistaSet = new Set();

    // Nazivi sortimenta (header)
    const sortimentiHeader = [
      "F/L Č", "I Č", "II Č", "III Č", "RD", "TRUPCI Č",
      "CEL.DUGA", "CEL.CIJEPANA", "ŠKART", "Σ ČETINARI",
      "F/L L", "I L", "II L", "III L", "TRUPCI L",
      "OGR.DUGI", "OGR.CIJEPANI", "GULE", "LIŠĆARI", "UKUPNO Č+L"
    ];

    // ========================================
    // MARKER-BASED PARSING (po labelama, ne po offset-ima)
    // ========================================
    // Struktura bloka (6 redova):
    // R1: A="ODJEL",     B=<naziv>,      C="OPIS",     D:W = zaglavlje sortimenta
    // R2: A="RADILIŠTE", B=<naziv>,      C="PROJEKAT", D:W = projekat values
    // R3: A="IZVOĐAČ",   B=<naziv>,      C="SJEČA",    D:W = sječa values
    // R4: A="POSLOVOĐA", B=<naziv>,      C="OTPREMA",  D:W = otprema values
    // R5: A="",          B="",           C="ZALIHA",   D:W = zaliha values
    // R6: prazan separator
    // ========================================

    // Parsiraj sortimente (kolone D:W = indeksi 3-22, 20 vrijednosti)
    const parseSortimenti = (row) => {
      const sortimenti = {};
      for (let j = 0; j < 20; j++) {
        const value = parseFloat(row[j + 3]) || 0;
        sortimenti[sortimentiHeader[j]] = value;
      }
      return sortimenti;
    };

    // Dijagnostika za prvi blok
    let blockCount = 0;
    let firstBlockDiag = null;

    let i = 0;
    while (i < data.length) {
      const row = data[i];
      const colA = String(row[0] || '').toUpperCase().trim();

      // Početak bloka: kolona A == "ODJEL"
      if (colA === 'ODJEL') {
        blockCount++;
        const blockStartRow = i;
        const odjelNaziv = String(row[1] || '').trim();

        // Traži redove unutar bloka po markerima u koloni C
        // Blok traje max 6 redova ili do sljedećeg ODJEL/praznog separatora
        let radilisteNaziv = '';
        let izvodjacNaziv = '';
        let poslovodjaNaziv = '';
        let projekatRow = null;
        let sjecaRow = null;
        let otpremaRow = null;
        let zalihaRow = null;

        // Skeniraj do 6 redova unaprijed za markere
        for (let offset = 0; offset < 6 && (i + offset) < data.length; offset++) {
          const blockRow = data[i + offset];
          const blockColA = String(blockRow[0] || '').toUpperCase().trim();
          const blockColC = String(blockRow[2] || '').toUpperCase().trim();

          // Ako naletimo na novi ODJEL (osim prvog), prekini
          if (offset > 0 && blockColA === 'ODJEL') break;

          // Čitaj metadata iz kolone A/B
          if (blockColA === 'RADILIŠTE' || blockColA === 'RADILISTE') {
            radilisteNaziv = String(blockRow[1] || '').trim();
          }
          if (blockColA === 'IZVOĐAČ' || blockColA === 'IZVODJAC') {
            izvodjacNaziv = String(blockRow[1] || '').trim();
          }
          if (blockColA === 'POSLOVOĐA' || blockColA === 'POSLOVODJA') {
            poslovodjaNaziv = String(blockRow[1] || '').trim();
          }

          // Čitaj podatke po markerima u koloni C
          if (blockColC === 'PROJEKAT') {
            projekatRow = { row: blockRow, idx: i + offset };
          }
          if (blockColC === 'SJEČA' || blockColC === 'SJECA') {
            sjecaRow = { row: blockRow, idx: i + offset };
          }
          if (blockColC === 'OTPREMA') {
            otpremaRow = { row: blockRow, idx: i + offset };
          }
          if (blockColC === 'ZALIHA') {
            zalihaRow = { row: blockRow, idx: i + offset };
          }
        }

        // Dijagnostika za prvi blok
        if (blockCount === 1) {
          const getFirst3 = (rowData) => {
            if (!rowData) return 'NOT_FOUND';
            const vals = [];
            for (let k = 3; k < 6 && k < rowData.row.length; k++) {
              vals.push(rowData.row[k]);
            }
            return `row=${rowData.idx}, first3=[${vals.join(', ')}]`;
          };
          firstBlockDiag = {
            odjel: odjelNaziv,
            PROJEKAT: getFirst3(projekatRow),
            SJECA: getFirst3(sjecaRow),
            OTPREMA: getFirst3(otpremaRow),
            ZALIHA: getFirst3(zalihaRow)
          };
          Logger.log('=== DIJAGNOSTIKA PRVI BLOK ===');
          Logger.log('Odjel: ' + odjelNaziv);
          Logger.log('PROJEKAT: ' + firstBlockDiag.PROJEKAT);
          Logger.log('SJEČA: ' + firstBlockDiag.SJECA);
          Logger.log('OTPREMA: ' + firstBlockDiag.OTPREMA);
          Logger.log('ZALIHA: ' + firstBlockDiag.ZALIHA);
        }

        // Parsiraj sortimente ako su nađeni redovi
        const projekatData = projekatRow ? parseSortimenti(projekatRow.row) : parseSortimenti([]);
        const sjecaData = sjecaRow ? parseSortimenti(sjecaRow.row) : parseSortimenti([]);
        const otpremaData = otpremaRow ? parseSortimenti(otpremaRow.row) : parseSortimenti([]);
        const zalihaData = zalihaRow ? parseSortimenti(zalihaRow.row) : parseSortimenti([]);

        // Ako je filter aktivan, provjeri da li radilište odjela TAČNO odgovara poslovođinim radilištima iz INFO sheeta
        if (poslovodjaRadilista !== null) {
          const radilisteUpper = radilisteNaziv.toUpperCase().trim();
          const matchFound = poslovodjaRadilista.some(pr => radilisteUpper === pr);
          if (!matchFound) {
            // Preskoči - traži sljedeći ODJEL
            i++;
            continue;
          }
        }

        // Dodaj radilište u set TEK NAKON filtriranja (da dropdown prikazuje samo poslovođina radilišta)
        if (radilisteNaziv) {
          radilistaSet.add(radilisteNaziv);
        }

        const odjelData = {
          odjel: odjelNaziv,
          radiliste: radilisteNaziv,
          izvodjac: izvodjacNaziv,
          poslovodja: poslovodjaNaziv,
          projekat: projekatData,
          sjeca: sjecaData,
          otprema: otpremaData,
          zaliha: zalihaData,
          ukupnoProjekat: projekatData["UKUPNO Č+L"] || 0,
          ukupnoSjeca: sjecaData["UKUPNO Č+L"] || 0,
          ukupnoOtprema: otpremaData["UKUPNO Č+L"] || 0,
          ukupnoZaliha: zalihaData["UKUPNO Č+L"] || 0
        };

        odjeli.push(odjelData);
      }

      i++;
    }

    // Sortiraj po zadnjoj otpremi (od najveće ka najmanjoj)
    odjeli.sort((a, b) => b.ukupnoOtprema - a.ukupnoOtprema);

    // Pretvori Set u Array za radilišta
    const radilista = Array.from(radilistaSet).sort();

    Logger.log('=== HANDLE STANJE ZALIHA END ===');
    Logger.log('Broj blokova (ODJEL): ' + blockCount);
    Logger.log('Broj odjela nakon filtriranja: ' + odjeli.length);
    Logger.log('Broj radilišta: ' + radilista.length);

    return createJsonResponse({
      odjeli: odjeli,
      radilista: radilista,
      sortimentiHeader: sortimentiHeader,
      _diag: {
        blockCount: blockCount,
        firstBlockDiag: firstBlockDiag
      }
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleStanjeZaliha: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ========================================
// IMAGE UPLOAD FUNCTIONS
// Slike se uploadaju na Google Drive i automatski brišu u 10:00h idućeg dana
// IMAGES_FOLDER_ID je definisan u config.gs
// ========================================

/**
 * Upload slike na Google Drive
 * @param {string} username - Korisničko ime
 * @param {string} password - Lozinka
 * @param {string} type - Tip unosa ('sjeca' ili 'otprema')
 * @param {string} imageData - Base64 encoded slika
 * @returns {Object} - { success: true, imageUrl: '...' } ili { success: false, error: '...' }
 */
function handleUploadImage(username, password, type, imageData) {
  Logger.log('=== HANDLE UPLOAD IMAGE ===');
  Logger.log('Type: ' + type);

  try {
    // Verify user
    const user = verifyUser(username, password);
    if (!user) {
      return createJsonResponse({ error: 'Neautorizovan pristup' }, false);
    }

    if (!imageData) {
      return createJsonResponse({ error: 'Nema podataka o slici' }, false);
    }

    // Parse base64 data
    const matches = imageData.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return createJsonResponse({ error: 'Neispravan format slike' }, false);
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType);

    // Generate filename
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
    const extension = mimeType.split('/')[1] || 'jpg';
    const filename = `${type}_${user.fullName}_${timestamp}.${extension}`;
    blob.setName(filename);

    // Get or create images folder
    let folder;
    try {
      folder = DriveApp.getFolderById(IMAGES_FOLDER_ID);
    } catch (e) {
      // Folder doesn't exist, create it in root
      folder = DriveApp.createFolder('Sumarija_Temp_Images');
      Logger.log('Created new folder: ' + folder.getId());
      // Note: Update IMAGES_FOLDER_ID with the new folder ID
    }

    // Create file
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Store metadata in spreadsheet for tracking (for auto-deletion)
    storeImageMetadata(file.getId(), filename, type, user.fullName);

    // Get URLs
    const fileId = file.getId();
    const imageUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    const webViewLink = 'https://drive.google.com/file/d/' + fileId + '/view';
    const thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w200';

    Logger.log('Image uploaded: ' + imageUrl);

    return createJsonResponse({
      success: true,
      imageUrl: imageUrl,
      fileId: fileId,
      webViewLink: webViewLink,
      thumbnailUrl: thumbnailUrl,
      filename: filename,
      createdAt: new Date().toISOString()
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleUploadImage: ' + error.toString());
    return createJsonResponse({ error: 'Greška pri uploadu slike: ' + error.toString() }, false);
  }
}

/**
 * Store image metadata for tracking (for auto-deletion)
 */
function storeImageMetadata(fileId, filename, type, userName) {
  try {
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    let sheet = ss.getSheetByName('TEMP_IMAGES');

    // Create sheet if doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('TEMP_IMAGES');
      sheet.appendRow(['FILE_ID', 'FILENAME', 'TYPE', 'USER', 'UPLOAD_TIME', 'DELETE_AFTER']);
      sheet.getRange('1:1').setFontWeight('bold');
    }

    // Calculate deletion time (next day at 10:00 AM)
    const now = new Date();
    const deleteAfter = new Date(now);
    deleteAfter.setDate(deleteAfter.getDate() + 1);
    deleteAfter.setHours(10, 0, 0, 0);

    // Add row
    sheet.appendRow([
      fileId,
      filename,
      type,
      userName,
      now,
      deleteAfter
    ]);

    Logger.log('Image metadata stored: ' + fileId);

  } catch (error) {
    Logger.log('ERROR storing image metadata: ' + error.toString());
  }
}

/**
 * Get active images (for admin view)
 */
function handleGetImages(username, password) {
  Logger.log('=== HANDLE GET IMAGES ===');

  try {
    // Verify user (admin only)
    const user = verifyUser(username, password);
    if (!user || user.type !== 'administrator') {
      return createJsonResponse({ error: 'Samo administrator može vidjeti slike' }, false);
    }

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const sheet = ss.getSheetByName('TEMP_IMAGES');

    if (!sheet) {
      return createJsonResponse({ images: [] }, true);
    }

    const data = sheet.getDataRange().getValues();
    const images = [];
    const now = new Date();

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const deleteAfter = new Date(row[5]);

      // Only include if not expired
      if (deleteAfter > now) {
        images.push({
          fileId: row[0],
          filename: row[1],
          type: row[2],
          user: row[3],
          uploadTime: row[4],
          deleteAfter: row[5],
          imageUrl: 'https://drive.google.com/uc?export=view&id=' + row[0]
        });
      }
    }

    return createJsonResponse({ images: images }, true);

  } catch (error) {
    Logger.log('ERROR in handleGetImages: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

/**
 * Auto-delete expired images
 * This function should be triggered daily at 10:00 AM
 */
function cleanupExpiredImages() {
  Logger.log('=== CLEANUP EXPIRED IMAGES ===');

  try {
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const sheet = ss.getSheetByName('TEMP_IMAGES');

    if (!sheet) {
      Logger.log('No TEMP_IMAGES sheet found');
      return;
    }

    const data = sheet.getDataRange().getValues();
    const now = new Date();
    const rowsToDelete = [];

    // Check each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const fileId = row[0];
      const deleteAfter = new Date(row[5]);

      if (deleteAfter <= now) {
        // Delete file from Drive
        try {
          const file = DriveApp.getFileById(fileId);
          file.setTrashed(true);
          Logger.log('Deleted file: ' + fileId);
        } catch (e) {
          Logger.log('File already deleted or not found: ' + fileId);
        }

        // Mark row for deletion
        rowsToDelete.push(i + 1); // +1 because sheet rows are 1-indexed
      }
    }

    // Delete rows from bottom to top (to avoid index shifting)
    rowsToDelete.sort((a, b) => b - a);
    for (const rowNum of rowsToDelete) {
      sheet.deleteRow(rowNum);
    }

    Logger.log('Cleanup completed. Deleted ' + rowsToDelete.length + ' images.');

  } catch (error) {
    Logger.log('ERROR in cleanupExpiredImages: ' + error.toString());
  }
}

/**
 * Setup daily trigger for image cleanup (run once to setup)
 */
function setupImageCleanupTrigger() {
  // Delete existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'cleanupExpiredImages') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create new daily trigger at 10:00 AM
  ScriptApp.newTrigger('cleanupExpiredImages')
    .timeBased()
    .atHour(10)
    .everyDays(1)
    .create();

  Logger.log('Image cleanup trigger created (daily at 10:00 AM)');
}

// Helper funkcija za formatiranje datuma

// ========================================
// PRIMACI SORTIMENTI BY PRIMAC - Prikaz sječe po primačima (20 sortimentnih kolona), grupisano po radilištu, za odabrani mjesec
// ========================================

function handlePrimaciSortimentiByPrimac(year, month, username, password) {
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) return createJsonResponse({ error: "Unauthorized" }, false);

  Logger.log('=== HANDLE PRIMACI SORTIMENTI BY PRIMAC START ===');
  Logger.log('Year: ' + year + ', Month: ' + month);

  try {
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const sheet = ss.getSheetByName("INDEKS_PRIMKA");
    if (!sheet) return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found" }, false);

    const data = sheet.getDataRange().getValues();
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month); // 0-11

    // Struktura: radiliste -> primac -> [20 sortimentnih vrijednosti]
    const radilistaMap = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const datum = row[PRIMKA_COL.DATE];
      if (!datum) continue;

      const d = parseDate(datum);
      if (d.getFullYear() !== targetYear) continue;
      if (d.getMonth() !== targetMonth) continue;

      const radiliste = String(row[PRIMKA_COL.RADILISTE] || 'Nepoznato').trim();
      const primac = String(row[PRIMKA_COL.RADNIK] || 'Nepoznato').trim();

      if (!radilistaMap[radiliste]) radilistaMap[radiliste] = {};
      if (!radilistaMap[radiliste][primac]) {
        radilistaMap[radiliste][primac] = Array(20).fill(0);
      }

      for (let j = 0; j < 20; j++) {
        radilistaMap[radiliste][primac][j] += parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
      }
    }

    // Konvertuj u array strukturu (sortirano po radilištu, unutar po ukupnom kubiku desc)
    const radilista = Object.keys(radilistaMap).sort().map(naziv => {
      const primaci = Object.keys(radilistaMap[naziv]).sort().map(pNaziv => ({
        naziv: pNaziv,
        sortimentiVrijednosti: radilistaMap[naziv][pNaziv],
        ukupno: radilistaMap[naziv][pNaziv][19] // indeks 19 = UKUPNO Č+L
      }));
      primaci.sort((a, b) => b.ukupno - a.ukupno);
      return { naziv, primaci };
    });

    Logger.log('=== HANDLE PRIMACI SORTIMENTI BY PRIMAC END === Radilista: ' + radilista.length);

    return createJsonResponse({ radilista: radilista, sortimentiNazivi: SORTIMENTI_NAZIVI }, true);

  } catch (err) {
    Logger.log('ERROR in handlePrimaciSortimentiByPrimac: ' + err.toString());
    return createJsonResponse({ error: err.toString() }, false);
  }
}

// ========================================
// OTPREMACI SORTIMENTI BY OTPREMAC - Prikaz otpreme po otpremačima (20 sortimentnih kolona),
// grupisano po radilištu, za odabrani mjesec
// ========================================

function handleOtremaciSortimentiByOtpremac(year, month, username, password) {
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) return createJsonResponse({ error: "Unauthorized" }, false);

  Logger.log('=== HANDLE OTPREMACI SORTIMENTI BY OTPREMAC START ===');
  Logger.log('Year: ' + year + ', Month: ' + month);

  try {
    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const sheet = ss.getSheetByName("INDEKS_OTPREMA");
    if (!sheet) return createJsonResponse({ error: "INDEKS_OTPREMA sheet not found" }, false);

    const data = sheet.getDataRange().getValues();
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month); // 0-11

    // Struktura: radiliste -> otpremac -> [20 sortimentnih vrijednosti]
    const radilistaMap = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const datum = row[OTPREMA_COL.DATE];
      if (!datum) continue;

      const d = parseDate(datum);
      if (d.getFullYear() !== targetYear) continue;
      if (d.getMonth() !== targetMonth) continue;

      const radiliste = String(row[OTPREMA_COL.RADILISTE] || 'Nepoznato').trim();
      const otpremac = String(row[OTPREMA_COL.OTPREMAC] || 'Nepoznato').trim();

      if (!radilistaMap[radiliste]) radilistaMap[radiliste] = {};
      if (!radilistaMap[radiliste][otpremac]) {
        radilistaMap[radiliste][otpremac] = Array(20).fill(0);
      }

      for (let j = 0; j < 20; j++) {
        radilistaMap[radiliste][otpremac][j] += parseFloat(row[OTPREMA_COL.SORT_START + j]) || 0;
      }
    }

    // Konvertuj u array strukturu (sortirano po radilištu, unutar po ukupnom kubiku desc)
    const radilista = Object.keys(radilistaMap).sort().map(naziv => {
      const otpremaci = Object.keys(radilistaMap[naziv]).sort().map(oNaziv => ({
        naziv: oNaziv,
        sortimentiVrijednosti: radilistaMap[naziv][oNaziv],
        ukupno: radilistaMap[naziv][oNaziv][19] // indeks 19 = UKUPNO Č+L
      }));
      otpremaci.sort((a, b) => b.ukupno - a.ukupno);
      return { naziv, otpremaci };
    });

    Logger.log('=== HANDLE OTPREMACI SORTIMENTI BY OTPREMAC END === Radilista: ' + radilista.length);

    return createJsonResponse({ radilista: radilista, sortimentiNazivi: SORTIMENTI_NAZIVI }, true);

  } catch (err) {
    Logger.log('ERROR in handleOtremaciSortimentiByOtpremac: ' + err.toString());
    return createJsonResponse({ error: err.toString() }, false);
  }
}

// ==========================================
// FILE: main.gs
// ==========================================
// ========================================
// 🚀 MAIN - Entry Points i Routing
// ========================================
// Google Apps Script za Šumarija API
// Deploy kao Web App: Deploy > New deployment > Web app
//
// Ovaj fajl sadrži glavne entry point funkcije (doGet, doPost, doOptions)
// i routing logiku za sve API endpoint-e

// Glavni handler za sve zahtjeve
function doGet(e) {
  try {
    Logger.log('=== DOGET CALLED ===');
    Logger.log('Full e.parameter: ' + JSON.stringify(e.parameter));
    Logger.log('e.queryString: ' + e.queryString);

    const path = e.parameter.path;
    Logger.log('Extracted path: ' + path);

    // Ako nema path parametra, servirati HTML stranicu
    if (!path) {
      Logger.log('No path parameter - serving HTML');
      return HtmlService.createHtmlOutputFromFile('index')
        .setTitle('Šumarija - Aplikacija za praćenje drvne mase')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (path === 'login') {
      return handleLogin(e.parameter.username, e.parameter.password);
    } else if (path === 'stats') {
      return handleStats(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'dashboard') {
      return handleDashboard(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'sortimenti') {
      return handleSortimenti(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'primaci') {
      return handlePrimaci(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'otpremaci') {
      return handleOtpremaci(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'kupci') {
      return handleKupci(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'odjeli') {
      return handleOdjeli(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'primac-detail') {
      return handlePrimacDetail(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'otpremac-detail') {
      return handleOtpremacDetail(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'primac-odjeli') {
      return handlePrimacOdjeli(e.parameter.year, e.parameter.username, e.parameter.password, e.parameter.limit);
    } else if (path === 'otpremac-odjeli') {
      return handleOtpremacOdjeli(e.parameter.year, e.parameter.username, e.parameter.password, e.parameter.limit);
    } else if (path === 'primac-detail-admin') {
      return handlePrimacDetailAdmin(e.parameter.year, e.parameter.username, e.parameter.password, e.parameter.primacName);
    } else if (path === 'primac-odjeli-admin') {
      return handlePrimacOdjeliAdmin(e.parameter.year, e.parameter.username, e.parameter.password, e.parameter.primacName, e.parameter.limit);
    } else if (path === 'add-sjeca') {
      return handleAddSjeca(e.parameter);
    } else if (path === 'add-otprema') {
      return handleAddOtprema(e.parameter);
    } else if (path === 'pending-unosi') {
      return handlePendingUnosi(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'my-pending') {
      return handleMyPending(e.parameter.username, e.parameter.password, e.parameter.tip);
    } else if (path === 'update-pending') {
      return handleUpdatePending(e.parameter);
    } else if (path === 'delete-pending') {
      return handleDeletePending(e.parameter);
    } else if (path === 'get-odjeli-list') {
      return handleGetOdjeliList();
    } else if (path === 'mjesecni-sortimenti') {
      return handleMjesecniSortimenti(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'primaci-daily') {
      return handlePrimaciDaily(e.parameter.year, e.parameter.month, e.parameter.username, e.parameter.password);
    } else if (path === 'otpremaci-daily') {
      return handleOtremaciDaily(e.parameter.year, e.parameter.month, e.parameter.username, e.parameter.password);
    } else if (path === 'daily-chart') {
      return handleDailyChart(e.parameter.year, e.parameter.month, e.parameter.username, e.parameter.password);
    } else if (path === 'stanje-odjela') {
      return handleStanjeOdjela(e.parameter.username, e.parameter.password);
    } else if (path === 'sync-stanje-odjela') {
      // Ručno osvježavanje cache-a za stanje odjela (samo za admin korisnike)
      return handleSyncStanjeOdjela(e.parameter.username, e.parameter.password);
    } else if (path === 'sync-index') {
      // Ručno pokretanje indeksiranja INDEX sheet-ova (samo za admin korisnike)
      return handleSyncIndex(e.parameter.username, e.parameter.password);
    } else if (path === 'primaci-by-radiliste') {
      return handlePrimaciByRadiliste(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'primaci-by-izvodjac') {
      return handlePrimaciByIzvodjac(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'primaci-sortimenti-by-primac') {
      return handlePrimaciSortimentiByPrimac(e.parameter.year, e.parameter.month, e.parameter.username, e.parameter.password);
    } else if (path === 'otpremaci-sortimenti-by-otpremac') {
      return handleOtremaciSortimentiByOtpremac(e.parameter.year, e.parameter.month, e.parameter.username, e.parameter.password);
    } else if (path === 'primke') {
      return handlePrimke(e.parameter.username, e.parameter.password);
    } else if (path === 'otpreme') {
      return handleOtpreme(e.parameter.username, e.parameter.password);
    } else if (path === 'get_dinamika') {
      return handleGetDinamika(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'manifest') {
      // 📊 MANIFEST ENDPOINT - Brza provjera verzije podataka
      return handleManifest();
    } else if (path === 'manifest_data') {
      // 📊 MANIFEST DATA ENDPOINT - Za delta sync (primka + otprema row counts)
      return handleManifestData(e.parameter.username, e.parameter.password);
    } else if (path === 'delta_primka') {
      // 🔄 DELTA PRIMKA - Vraća samo nove redove (fromRow do toRow)
      return handleDeltaPrimka(e.parameter.username, e.parameter.password, e.parameter.fromRow, e.parameter.toRow);
    } else if (path === 'delta_otprema') {
      // 🔄 DELTA OTPREMA - Vraća samo nove redove (fromRow do toRow)
      return handleDeltaOtprema(e.parameter.username, e.parameter.password, e.parameter.fromRow, e.parameter.toRow);
    } else if (path === 'save_dinamika') {
      Logger.log('save_dinamika endpoint called');
      Logger.log('Parameters: ' + JSON.stringify(e.parameter));
      return handleSaveDinamika(e.parameter.username, e.parameter.password, e.parameter.godina, e.parameter.mjeseci);
    } else if (path === 'stanje-zaliha') {
      // 📦 STANJE ZALIHA - Čita podatke sa STANJE_ZALIHA sheeta (opciono filtrirano po poslovođi)
      return handleStanjeZaliha(e.parameter.username, e.parameter.password, e.parameter.poslovodja);
    } else if (path === 'poslovodja-aktivnost') {
      // 📅 POSLOVODJA AKTIVNOST - Zadnjih 5 dana sječa/otprema po odjelima (filtrirano po radilištu)
      return handlePoslovodjaAktivnost(e.parameter.username, e.parameter.password, e.parameter.radiliste);
    } else if (path === 'upload-image') {
      // 📷 UPLOAD IMAGE - Upload slike na Google Drive (privremeno do 10h idućeg dana)
      return handleUploadImage(e.parameter.username, e.parameter.password, e.parameter.type, e.parameter.imageData);
    } else if (path === 'get-images') {
      // 📷 GET IMAGES - Dohvati aktivne slike (za admina)
      return handleGetImages(e.parameter.username, e.parameter.password);
    } else if (path === 'poslovodja-radilista') {
      // 🗺️ POSLOVODJA RADILISTA - Dohvati mapping poslovodja→radilišta iz INFO sheeta
      return handlePoslovodjaRadilista(e.parameter.username, e.parameter.password, e.parameter.poslovodja);
    }

    Logger.log('Unknown path: ' + path);
    return createJsonResponse({ error: 'Unknown path: ' + path }, false);
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ========================================
// OPTIONS Handler - CORS Preflight Support
// ========================================
// Handles OPTIONS preflight requests from browsers
// Required for CORS to work properly with cross-origin fetch
function doOptions(e) {
  Logger.log('=== DO OPTIONS CALLED (CORS Preflight) ===');

  // Return CORS headers for preflight requests
  const output = ContentService.createTextOutput('');
  output.setMimeType(ContentService.MimeType.JSON);

  // Try setHeader (V8 runtime), fallback if not available (Rhino)
  try {
    if (typeof output.setHeader === 'function') {
      output.setHeader('Access-Control-Allow-Origin', '*');
      output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      output.setHeader('Access-Control-Max-Age', '86400'); // 24 hours cache
      Logger.log('[OPTIONS] CORS headers set successfully');
    } else {
      Logger.log('[OPTIONS] WARNING: setHeader not available');
    }
  } catch (e) {
    Logger.log('[OPTIONS] WARNING: setHeader failed: ' + e.toString());
  }

  return output;
}

// ========================================
// POST Handler
// ========================================
// Handles POST requests (save_dinamika, upload-image)
function doPost(e) {
  try {
    const path = e.parameter.path;
    const postData = JSON.parse(e.postData.contents);

    if (path === 'save_dinamika') {
      return handleSaveDinamika(postData);
    } else if (path === 'upload-image') {
      // Upload image via POST (base64 data is too large for GET URL)
      return handleUploadImage(
        postData.username,
        postData.password,
        postData.type,
        postData.imageData
      );
    }

    return createJsonResponse({ error: 'Unknown POST path' }, false);
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}
