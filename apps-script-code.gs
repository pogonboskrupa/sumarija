// Google Apps Script za Šumarija API
// Deploy kao Web App: Deploy > New deployment > Web app

// ⚠️ VAŽNO: Postavi svoje Spreadsheet ID-ove ovdje
const KORISNICI_SPREADSHEET_ID = '1rpl0RiqsE6lrU9uDMTjf127By7b951rP3a5Chis9qwg'; // SUMARIJA_KORISNICI
const INDEX_SPREADSHEET_ID = '1nPkSx2fCbtHGcwdq8rDo9A3dsSt9QpcF7f0JBCg1K1I';     // SUMARIJA_INDEX
const ODJELI_FOLDER_ID = '1NQ0s_F4j9iRDaZafexzP5Bwyv0NXfMMK';                      // Folder sa svim odjelima

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

// Dinamika po mjesecima (plan 2025) - ZASTARJELO - koristi se DINAMIKA sheet
// const DINAMIKA_2025 = [788, 2389, 6027, 5597, 6977, 6934, 7336, 6384, 6997, 7895, 5167, 2016];

// Helper funkcija - učitaj mjesečnu dinamiku iz DINAMIKA sheet-a
function getDinamikaForYear(year) {
  try {
    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    let dinamikaSheet = ss.getSheetByName("DINAMIKA");

    // Ako sheet ne postoji ili nema podataka, vrati prazne vrijednosti
    if (!dinamikaSheet) {
      Logger.log('DINAMIKA sheet does not exist, returning zeros');
      return Array(12).fill(0);
    }

    const data = dinamikaSheet.getDataRange().getValues();

    // Pronađi red za traženu godinu
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowYear = parseInt(row[0]) || 0;

      if (rowYear === parseInt(year)) {
        // Vrati mjesečne vrijednosti (kolone 1-12)
        const mjesecneVrijednosti = [];
        for (let j = 1; j <= 12; j++) {
          mjesecneVrijednosti.push(parseFloat(row[j]) || 0);
        }
        Logger.log('Found dinamika for year ' + year);
        return mjesecneVrijednosti;
      }
    }

    // Ako nema podataka za godinu, vrati nule
    Logger.log('No dinamika found for year ' + year + ', returning zeros');
    return Array(12).fill(0);

  } catch (error) {
    Logger.log('ERROR in getDinamikaForYear: ' + error.toString());
    return Array(12).fill(0);
  }
}

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
    } else if (path === 'stanje-odjela') {
      return handleStanjeOdjela(e.parameter.username, e.parameter.password);
    } else if (path === 'sync-stanje-odjela') {
      // Ručno osvježavanje cache-a za stanje odjela (samo za admin korisnike)
      return handleSyncStanjeOdjela(e.parameter.username, e.parameter.password);
    } else if (path === 'primaci-by-radiliste') {
      return handlePrimaciByRadiliste(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'primaci-by-izvodjac') {
      return handlePrimaciByIzvodjac(e.parameter.year, e.parameter.username, e.parameter.password);
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

// Stats handler - glavna funkcija za statistiku
function handleStats(year, username, password) {
  // Prvo provjerimo autentikaciju
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: 'Unauthorized' }, false);
  }

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const primkaSheet = ss.getSheetByName('INDEX_PRIMKA');
  const otpremaSheet = ss.getSheetByName('INDEX_OTPREMA');

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

// Procesiranje PRIMKA sheet-a
function processPrimkaData(data, stats, year) {
  // INDEX_PRIMKA struktura:
  // Kolona A: Odjel, B: Datum, ... U: SVEUKUPNO (indeks 20)

  Logger.log('=== PRIMKA DEBUG ===');
  Logger.log('Total rows in PRIMKA: ' + data.length);

  let processedRows = 0;
  let skippedNoDatum = 0;
  let skippedWrongYear = 0;
  let totalSum = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const odjel = row[0]; // kolona A - Odjel
    const datum = row[1]; // kolona B - Datum
    const kubik = parseFloat(row[20]) || 0; // kolona U (indeks 20) - SVEUKUPNO

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

// Procesiranje OTPREMA sheet-a
function processOtpremaData(data, stats, year) {
  // INDEX_OTPREMA struktura: ista kao INDEX_PRIMKA
  // Kolona A: Odjel, B: Datum, ... U: SVEUKUPNO (indeks 20)

  Logger.log('=== OTPREMA DEBUG ===');
  Logger.log('Total rows in OTPREMA: ' + data.length);

  let processedRows = 0;
  let skippedNoDatum = 0;
  let skippedWrongYear = 0;
  let totalSum = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const odjel = row[0]; // kolona A - Odjel
    const datum = row[1]; // kolona B - Datum
    const kubik = parseFloat(row[20]) || 0; // kolona U (indeks 20) - SVEUKUPNO

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

// Procesiranje podataka o projektima (ne koristi se u novoj strukturi)
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
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  // ✅ CORS Support - Try setHeader (V8 runtime), fallback if not available (Rhino)
  try {
    if (typeof output.setHeader === 'function') {
      output.setHeader('Access-Control-Allow-Origin', '*');
      output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      Logger.log('[CORS] Headers set successfully using setHeader()');
    } else {
      Logger.log('[CORS] WARNING: setHeader not available (Rhino runtime?)');
    }
  } catch (e) {
    Logger.log('[CORS] WARNING: setHeader failed: ' + e.toString());
    // Continue without headers - CORS won't work but at least no error
  }

  return output;
}

// ========================================
// CACHESERVICE - In-Memory Caching for 10-20x Speed Boost
// ========================================

const CACHE_TTL = 180; // 3 minute cache (180 seconds)

// Get cached data if available and fresh
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

// Set cached data with TTL
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

// Invalidate all cache entries (call on data write)
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

// Invalidate cache for specific year
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
// SYNC INDEX SHEET - Agregira podatke iz svih odjela
// ========================================

/**
 * Sync funkcija koja agregira podatke iz svih odjela u INDEX sheet-ove
 * Pozovi ručno iz Apps Script editora: Extensions > Apps Script > Run > syncIndexSheet
 */
function syncIndexSheet() {
  Logger.log('=== SYNC INDEX START ===');
  const startTime = new Date();

  try {
    // 1. Otvori INDEX spreadsheet
    const indexSS = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const indexPrimkaSheet = indexSS.getSheetByName('INDEX_PRIMKA');
    const indexOtpremaSheet = indexSS.getSheetByName('INDEX_OTPREMA');

    if (!indexPrimkaSheet || !indexOtpremaSheet) {
      throw new Error('INDEX_PRIMKA ili INDEX_OTPREMA sheet nije pronađen!');
    }

    Logger.log('INDEX sheets otvoreni uspješno');

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
        if (primkaSheet) {
          const lastRow = primkaSheet.getLastRow();
          Logger.log(`  PRIMKA: ${lastRow} redova (total)`);

          if (lastRow > 1) {
            const data = primkaSheet.getDataRange().getValues();
            let addedRows = 0;

            // PRIMKA struktura: PRAZNA(A) | DATUM(B) | PRIMAČ(C) | sortimenti(D-U)
            // INDEX treba: odjel | datum | primač | sortimenti
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

              // Dodaj red: [ODJEL, DATUM(B), PRIMAČ(C), ...sortimenti(D-U 18 kolona)]
              // Eksplicitno uzmi samo 18 kolona sortimenti (D-U = indeksi 3-20)
              const sortimenti = row.slice(3, 21); // D-U (18 kolona)
              const newRow = [odjelNaziv, datum, primac, ...sortimenti];
              primkaRows.push(newRow);
              addedRows++;

              if (processedCount === 1 && addedRows <= 3) {
                Logger.log(`      ✓ Dodano red ${addedRows}: "${odjelNaziv}" | "${datum}" | "${primac}"`);
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

            // OTPREMA struktura: kupci(A) | datum(B) | otpremač(C) | sortimenti(D-U)
            // INDEX treba: odjel | datum | otpremač | sortimenti | kupac
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

              // Kreiraj novi red za INDEX: [odjel, datum(B), otpremač(C), ...sortimenti(D-U 18 kolona), kupac(A)]
              // Eksplicitno uzmi samo 18 kolona sortimenti (D-U = indeksi 3-20)
              const sortimenti = row.slice(3, 21); // D-U (18 kolona)
              const newRow = [odjelNaziv, datum, otpremac, ...sortimenti, kupac];
              otpremaRows.push(newRow);
              addedRows++;

              if (processedCount === 1 && addedRows <= 3) {
                Logger.log(`      ✓ Dodano red ${addedRows}: "${odjelNaziv}" | "${datum}" | "${otpremac}" | kupac="${kupac}"`);
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

    // 5. Sortiraj po datumu (kolona B = index 1)
    Logger.log('Sortiranje podataka po datumu...');
    primkaRows.sort((a, b) => {
      const dateA = parseDate(a[1]);
      const dateB = parseDate(b[1]);
      return dateA - dateB;
    });

    otpremaRows.sort((a, b) => {
      const dateA = parseDate(a[1]);
      const dateB = parseDate(b[1]);
      return dateA - dateB;
    });

    // 6. Normalizuj broj kolona (svi redovi moraju imati isti broj kolona kao INDEX sheet)
    Logger.log('Normalizacija broja kolona...');
    const indexPrimkaHeaderCols = indexPrimkaSheet.getLastColumn();
    const indexOtpremaHeaderCols = indexOtpremaSheet.getLastColumn();

    Logger.log(`INDEX_PRIMKA header kolone: ${indexPrimkaHeaderCols}`);
    Logger.log(`INDEX_OTPREMA header kolone: ${indexOtpremaHeaderCols}`);

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

    // 7. Upiši podatke u INDEX sheet-ove
    Logger.log('Upisivanje podataka u INDEX sheet-ove...');
    if (primkaRows.length > 0) {
      indexPrimkaSheet.getRange(2, 1, primkaRows.length, indexPrimkaHeaderCols).setValues(primkaRows);
      Logger.log(`✓ INDEX_PRIMKA: upisano ${primkaRows.length} redova`);
    }

    if (otpremaRows.length > 0) {
      indexOtpremaSheet.getRange(2, 1, otpremaRows.length, indexOtpremaHeaderCols).setValues(otpremaRows);
      Logger.log(`✓ INDEX_OTPREMA: upisano ${otpremaRows.length} redova`);
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


// ========================================
// DASHBOARD API - Glavni pregled
// ========================================

/**
 * Dashboard endpoint - vraća mjesečni pregled i prikaz po odjelima
 */
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

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");
  const otpremaSheet = ss.getSheetByName("INDEX_OTPREMA");

  if (!primkaSheet || !otpremaSheet) {
    return createJsonResponse({ error: "INDEX sheets not found" }, false);
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
    const odjel = row[0]; // A - ODJEL
    const datum = row[1]; // B - DATUM
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

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
    const odjel = row[0]; // A - ODJEL
    const datum = row[1]; // B - DATUM  
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

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


// ========================================
// SORTIMENTI API - Detaljna mjesečna statistika
// ========================================

/**
 * Sortimenti endpoint - vraća detaljnu mjesečnu statistiku po sortimentima
 */
function handleSortimenti(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");
  const otpremaSheet = ss.getSheetByName("INDEX_OTPREMA");

  if (!primkaSheet || !otpremaSheet) {
    return createJsonResponse({ error: "INDEX sheets not found" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const otpremaData = otpremaSheet.getDataRange().getValues();

  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
  
  // Nazivi sortimenta (kolone D-U = indeksi 3-20)
  const sortimentiNazivi = [
    "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č", 
    "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI", 
    "F/L L", "I L", "II L", "III L", "TRUPCI", 
    "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
  ];

  // Inicijalizuj mjesečne sume za PRIMKA (12 mjeseci x 18 sortimenta)
  let primkaSortimenti = Array(12).fill(null).map(() => Array(18).fill(0));
  
  // Inicijalizuj mjesečne sume za OTPREMA
  let otpremaSortimenti = Array(12).fill(null).map(() => Array(18).fill(0));

  // Procesiranje PRIMKA podataka
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const datum = row[1]; // B - DATUM

    if (!datum) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();

    // Kolone D-U (indeksi 3-20) = sortimenti
    for (let j = 0; j < 18; j++) {
      const vrijednost = parseFloat(row[3 + j]) || 0;
      primkaSortimenti[mjesec][j] += vrijednost;
    }
  }

  // Procesiranje OTPREMA podataka
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const datum = row[1]; // B - DATUM

    if (!datum) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();

    // Kolone D-U (indeksi 3-20) = sortimenti
    for (let j = 0; j < 18; j++) {
      const vrijednost = parseFloat(row[3 + j]) || 0;
      otpremaSortimenti[mjesec][j] += vrijednost;
    }
  }

  // Izračunaj ukupne sume i % udio
  let primkaUkupno = Array(18).fill(0);
  let otpremaUkupno = Array(18).fill(0);

  for (let mjesec = 0; mjesec < 12; mjesec++) {
    for (let j = 0; j < 18; j++) {
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

    for (let j = 0; j < 18; j++) {
      primkaRed[sortimentiNazivi[j]] = primkaSortimenti[mjesec][j];
      otpremaRed[sortimentiNazivi[j]] = otpremaSortimenti[mjesec][j];
    }

    primkaRedovi.push(primkaRed);
    otpremaRedovi.push(otpremaRed);
  }

  // Dodaj UKUPNO redove
  const primkaUkupnoRed = { mjesec: "UKUPNO" };
  const otpremaUkupnoRed = { mjesec: "UKUPNO" };
  
  for (let j = 0; j < 18; j++) {
    primkaUkupnoRed[sortimentiNazivi[j]] = primkaUkupno[j];
    otpremaUkupnoRed[sortimentiNazivi[j]] = otpremaUkupno[j];
  }

  primkaRedovi.push(primkaUkupnoRed);
  otpremaRedovi.push(otpremaUkupnoRed);

  // Dodaj % UDIO redove
  const primkaUdioRed = { mjesec: "% UDIO" };
  const otpremaUdioRed = { mjesec: "% UDIO" };

  const primkaSveukupno = primkaUkupno[17]; // SVEUKUPNO je zadnja kolona
  const otpremaSveukupno = otpremaUkupno[17];

  for (let j = 0; j < 18; j++) {
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

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");

  if (!primkaSheet) {
    return createJsonResponse({ error: "INDEX_PRIMKA sheet not found" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  // Map: primacIme -> { mjeseci: [0,0,0,...], ukupno: 0 }
  let primaciMap = {};

  // Procesiranje PRIMKA podataka
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const datum = row[1]; // B - DATUM
    const primac = row[2]; // C - PRIMAČ
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

    if (!datum || !primac) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    const mjesec = datumObj.getMonth();

    // Inicijalizuj primača ako ne postoji
    if (!primaciMap[primac]) {
      primaciMap[primac] = {
        mjeseci: Array(12).fill(0),
        ukupno: 0
      };
    }

    primaciMap[primac].mjeseci[mjesec] += kubik;
    primaciMap[primac].ukupno += kubik;
  }

  // Generiši array primaciPrikaz
  const primaciPrikaz = [];
  for (const primacIme in primaciMap) {
    const primac = primaciMap[primacIme];
    primaciPrikaz.push({
      primac: primacIme,
      mjeseci: primac.mjeseci,
      ukupno: primac.ukupno
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

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const otpremaSheet = ss.getSheetByName("INDEX_OTPREMA");

  if (!otpremaSheet) {
    return createJsonResponse({ error: "INDEX_OTPREMA sheet not found" }, false);
  }

  const otpremaData = otpremaSheet.getDataRange().getValues();
  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  // Map: otpremacIme -> { mjeseci: [0,0,0,...], ukupno: 0 }
  let otpremaciMap = {};

  // Procesiranje OTPREMA podataka
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const datum = row[1]; // B - DATUM
    const otpremac = row[2]; // C - OTPREMAČ
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

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

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const otpremaSheet = ss.getSheetByName("INDEX_OTPREMA");

  if (!otpremaSheet) {
    return createJsonResponse({ error: "INDEX_OTPREMA sheet not found" }, false);
  }

  const otpremaData = otpremaSheet.getDataRange().getValues();
  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  // Nazivi sortimenta (kolone D-U = indeksi 3-20)
  const sortimentiNazivi = [
    "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
    "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
    "F/L L", "I L", "II L", "III L", "TRUPCI",
    "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
  ];

  // Map za godišnji prikaz: kupac -> { sortimenti: {}, ukupno: 0 }
  let kupciGodisnji = {};

  // Map za mjesečni prikaz: kupac -> mjeseci[12] -> { sortimenti: {}, ukupno: 0 }
  let kupciMjesecni = {};

  // Procesiranje OTPREMA podataka
  // INDEX_OTPREMA struktura: A=odjel, B=datum, C=otpremač, D-U=sortimenti(18), V=kupac(indeks 21)
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const odjel = row[0]; // A - ODJEL
    const datum = row[1]; // B - DATUM
    const otpremac = row[2]; // C - OTPREMAČ
    const kupac = row[21] || row[0]; // V - KUPAC (indeks 21), fallback na odjel ako nema kupca

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
      for (let s = 0; s < sortimentiNazivi.length; s++) {
        kupciGodisnji[kupacNormalized].sortimenti[sortimentiNazivi[s]] = 0;
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
        for (let s = 0; s < sortimentiNazivi.length; s++) {
          kupciMjesecni[kupacNormalized][m].sortimenti[sortimentiNazivi[s]] = 0;
        }
      }
    }

    // Dodaj sortimente (kolone D-U, indeksi 3-20)
    for (let s = 0; s < sortimentiNazivi.length; s++) {
      const vrijednost = parseFloat(row[3 + s]) || 0;

      // Godišnji
      kupciGodisnji[kupacNormalized].sortimenti[sortimentiNazivi[s]] += vrijednost;

      // Mjesečni
      kupciMjesecni[kupacNormalized][mjesec].sortimenti[sortimentiNazivi[s]] += vrijednost;
    }

    // Ukupno (kolona U = SVEUKUPNO = indeks 20)
    const ukupno = parseFloat(row[20]) || 0;
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
    sortimentiNazivi: sortimentiNazivi,
    godisnji: godisnji,
    mjesecni: mjesecni
  };
  setCachedData(cacheKey, result, CACHE_TTL);

  return createJsonResponse(result, true);
}

// ========================================
// ODJELI API - Pregled po odjelima
// ========================================

/**
 * Odjeli endpoint - vraća prikaz po odjelima sa detaljnim podacima
 * iz individualnih spreadsheet-ova (PRIMKA i OTPREMA listova)
 */
function handleOdjeli(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  Logger.log('=== HANDLE ODJELI START ===');
  Logger.log('Year: ' + year);

  try {
    // Otvori folder ODJELI
    const folder = DriveApp.getFolderById(ODJELI_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

    const odjeliPrikaz = [];
    let processedCount = 0;

    // Iteriraj kroz sve spreadsheet-ove u folderu
    while (files.hasNext()) {
      const file = files.next();
      const odjelNaziv = file.getName(); // Naziv fajla = Odjel
      processedCount++;

      try {
        const ss = SpreadsheetApp.open(file);
        Logger.log(`[${processedCount}] Processing odjel: ${odjelNaziv}`);

        // Inicijalizuj objekt za ovaj odjel
        const odjelData = {
          odjel: odjelNaziv,
          sjeca: 0,           // U12 iz PRIMKA
          otprema: 0,         // U12 iz OTPREMA
          sumaPanj: 0,        // sjeca - otprema
          radiliste: '',      // W2 iz PRIMKA
          izvođač: '',        // W3 iz PRIMKA
          datumZadnjeSjece: '', // Zadnji datum unosa u PRIMKA
          projekat: 0,        // U11 iz PRIMKA - projektovana masa
          realizacija: 0,     // (U12/U11) * 100 iz PRIMKA
          zadnjiDatumObj: null  // Za sortiranje
        };

        // Čitaj PRIMKA sheet
        const primkaSheet = ss.getSheetByName('PRIMKA');
        if (primkaSheet) {
          // Čitaj W2 (radilište) i W3 (izvođač radova)
          // W = kolona 23 (0-indexed: 22)
          odjelData.radiliste = primkaSheet.getRange('W2').getValue() || '';
          odjelData.izvođač = primkaSheet.getRange('W3').getValue() || '';

          // Čitaj U11 (projekat) i U12 (sječa)
          // U = kolona 21 (0-indexed: 20)
          const projekat = parseFloat(primkaSheet.getRange('U11').getValue()) || 0;
          odjelData.projekat = projekat; // Dodaj projekat u objekat
          odjelData.sjeca = parseFloat(primkaSheet.getRange('U12').getValue()) || 0;

          // Izračunaj realizaciju %
          if (projekat > 0) {
            odjelData.realizacija = (odjelData.sjeca / projekat) * 100;
          }

          // Pronađi zadnji datum unosa u PRIMKA (kolona B)
          const lastRow = primkaSheet.getLastRow();
          Logger.log(`  PRIMKA last row: ${lastRow}`);

          if (lastRow > 1) {
            const allData = primkaSheet.getRange(2, 2, lastRow - 1, 1).getValues(); // Kolona B (datum)

            // Filtriraj validne datume i pronađi najnoviji
            let zadnjiDatum = null;
            for (let i = 0; i < allData.length; i++) {
              const datum = allData[i][0];
              if (datum && datum !== '' && datum !== 0) {
                const datumObj = parseDate(datum);

                // Provjeri da li je validan datum i da li pripada tražnoj godini
                if (!isNaN(datumObj.getTime()) && datumObj.getFullYear() === parseInt(year)) {
                  if (!zadnjiDatum || datumObj > zadnjiDatum) {
                    zadnjiDatum = datumObj;
                  }
                }
              }
            }

            if (zadnjiDatum) {
              odjelData.datumZadnjeSjece = formatDate(zadnjiDatum);
              odjelData.zadnjiDatumObj = zadnjiDatum;
              Logger.log(`  PRIMKA zadnji datum: ${odjelData.datumZadnjeSjece}`);
            }
          }
        } else {
          Logger.log(`  PRIMKA sheet ne postoji`);
        }

        // Čitaj OTPREMA sheet
        const otpremaSheet = ss.getSheetByName('OTPREMA');
        if (otpremaSheet) {
          // Čitaj U12 (otprema)
          odjelData.otprema = parseFloat(otpremaSheet.getRange('U12').getValue()) || 0;

          // Izračunaj šuma panj + međustovarište
          odjelData.sumaPanj = odjelData.sjeca - odjelData.otprema;

          Logger.log(`  OTPREMA otprema: ${odjelData.otprema}, šuma panj: ${odjelData.sumaPanj}`);
        } else {
          Logger.log(`  OTPREMA sheet ne postoji`);
        }

        // Dodaj u rezultat
        odjeliPrikaz.push(odjelData);

      } catch (error) {
        Logger.log(`ERROR processing ${odjelNaziv}: ${error.toString()}`);
        // Nastavi sa sledećim odjelom
      }
    }

    Logger.log(`Procesovano odjela: ${processedCount}`);

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
      projekat: o.projekat,  // Dodaj projekat iz U11 ćelije PRIMKA sheet-a
      realizacija: o.realizacija
    }));

    Logger.log('=== HANDLE ODJELI END ===');
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

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");

  if (!primkaSheet) {
    return createJsonResponse({ error: "INDEX_PRIMKA sheet not found" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const sortimentiNazivi = [
    "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
    "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
    "F/L L", "I L", "II L", "III L", "TRUPCI",
    "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
  ];

  const unosi = [];

  // Procesiranje PRIMKA podataka - filtrirati samo za ovog primača
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const odjel = row[0];     // A - ODJEL
    const datum = row[1];     // B - DATUM
    const primac = row[2];    // C - PRIMAČ
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

    if (!datum || !primac) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    // Filtriraj samo unose za ovog primača
    if (String(primac).trim() !== userFullName) continue;

    // Pročitaj sve sortimente (kolone D-U, indeksi 3-20)
    const sortimenti = {};
    for (let j = 0; j < 18; j++) {
      const vrijednost = parseFloat(row[3 + j]) || 0;
      sortimenti[sortimentiNazivi[j]] = vrijednost;
    }

    unosi.push({
      datum: formatDate(datumObj),
      datumObj: datumObj,  // Za sortiranje
      odjel: odjel,
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
    primac: u.primac,
    sortimenti: u.sortimenti,
    ukupno: u.ukupno
  }));

  Logger.log('=== HANDLE PRIMAC DETAIL END ===');
  Logger.log(`Ukupno unosa: ${unosiResult.length}`);

  return createJsonResponse({
    sortimentiNazivi: sortimentiNazivi,
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

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const otpremaSheet = ss.getSheetByName("INDEX_OTPREMA");

  if (!otpremaSheet) {
    return createJsonResponse({ error: "INDEX_OTPREMA sheet not found" }, false);
  }

  const otpremaData = otpremaSheet.getDataRange().getValues();
  const sortimentiNazivi = [
    "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
    "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
    "F/L L", "I L", "II L", "III L", "TRUPCI",
    "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
  ];

  const unosi = [];

  // Procesiranje OTPREMA podataka - filtrirati samo za ovog otpremača
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const odjel = row[0];       // A - ODJEL
    const datum = row[1];       // B - DATUM
    const otpremac = row[2];    // C - OTPREMAČ
    const kupac = row[21];      // V - KUPAC
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

    if (!datum || !otpremac) continue;

    const datumObj = parseDate(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    // Filtriraj samo unose za ovog otpremača
    if (String(otpremac).trim() !== userFullName) continue;

    // Pročitaj sve sortimente (kolone D-U, indeksi 3-20)
    const sortimenti = {};
    for (let j = 0; j < 18; j++) {
      const vrijednost = parseFloat(row[3 + j]) || 0;
      sortimenti[sortimentiNazivi[j]] = vrijednost;
    }

    unosi.push({
      datum: formatDate(datumObj),
      datumObj: datumObj,  // Za sortiranje
      odjel: odjel,
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
    otpremac: u.otpremac,
    kupac: u.kupac,
    sortimenti: u.sortimenti,
    ukupno: u.ukupno
  }));

  Logger.log('=== HANDLE OTPREMAC DETAIL END ===');
  Logger.log(`Ukupno unosa: ${unosiResult.length}`);

  return createJsonResponse({
    sortimentiNazivi: sortimentiNazivi,
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

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");

  if (!primkaSheet) {
    return createJsonResponse({ error: "INDEX_PRIMKA sheet not found" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  Logger.log('Total primka rows: ' + (primkaData.length - 1));

  const sortimentiNazivi = [
    "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
    "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
    "F/L L", "I L", "II L", "III L", "TRUPCI",
    "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
  ];

  // Map: odjelNaziv -> { sortimenti: {}, ukupno: 0, zadnjiDatum: Date }
  const odjeliMap = {};
  let matchedRows = 0;

  // ✅ OPTIMIZACIJA: Procesiranje svih godina (ne filtriramo po godini)
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const odjel = row[0];     // A - ODJEL
    const datum = row[1];     // B - DATUM
    const primac = row[2];    // C - PRIMAČ
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

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
      for (let s = 0; s < sortimentiNazivi.length; s++) {
        odjeliMap[odjel].sortimenti[sortimentiNazivi[s]] = 0;
      }
    }

    // Dodaj sortimente (kolone D-U, indeksi 3-20)
    for (let j = 0; j < 18; j++) {
      const vrijednost = parseFloat(row[3 + j]) || 0;
      odjeliMap[odjel].sortimenti[sortimentiNazivi[j]] += vrijednost;
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
    sortimentiNazivi: sortimentiNazivi,
    odjeli: odjeliResult
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

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const otpremaSheet = ss.getSheetByName("INDEX_OTPREMA");

  if (!otpremaSheet) {
    return createJsonResponse({ error: "INDEX_OTPREMA sheet not found" }, false);
  }

  const otpremaData = otpremaSheet.getDataRange().getValues();
  Logger.log('Total otprema rows: ' + (otpremaData.length - 1));

  const sortimentiNazivi = [
    "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
    "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
    "F/L L", "I L", "II L", "III L", "TRUPCI",
    "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
  ];

  // Map: odjelNaziv -> { sortimenti: {}, ukupno: 0, zadnjiDatum: Date }
  const odjeliMap = {};
  let matchedRows = 0;

  // ✅ OPTIMIZACIJA: Procesiranje svih godina (ne filtriramo po godini)
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const odjel = row[0];       // A - ODJEL
    const datum = row[1];       // B - DATUM
    const otpremac = row[2];    // C - OTPREMAČ
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

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
      for (let s = 0; s < sortimentiNazivi.length; s++) {
        odjeliMap[odjel].sortimenti[sortimentiNazivi[s]] = 0;
      }
    }

    // Dodaj sortimente (kolone D-U, indeksi 3-20)
    for (let j = 0; j < 18; j++) {
      const vrijednost = parseFloat(row[3 + j]) || 0;
      odjeliMap[odjel].sortimenti[sortimentiNazivi[j]] += vrijednost;
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
    sortimentiNazivi: sortimentiNazivi,
    odjeli: odjeliResult
  }, true);
}

// ========================================
// ADD SJECA API - Dodavanje nove sječe
// ========================================

/**
 * Add Sjeca endpoint - dodaje novi unos u INDEX_PRIMKA
 */
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    let pendingSheet = ss.getSheetByName("PENDING_PRIMKA");

    // Kreiraj PENDING_PRIMKA sheet ako ne postoji
    if (!pendingSheet) {
      pendingSheet = ss.insertSheet("PENDING_PRIMKA");
      // Dodaj header red
      const headers = ["ODJEL", "DATUM", "PRIMAČ", "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
                       "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI", "F/L L", "I L", "II L", "III L", "TRUPCI",
                       "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO", "STATUS", "TIMESTAMP"];
      pendingSheet.appendRow(headers);

      // Formatiraj header
      const headerRange = pendingSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#047857");
      headerRange.setFontColor("white");
      headerRange.setFontWeight("bold");
    }

    // Pripremi red podataka
    // A-U: kao INDEX_PRIMKA, V: STATUS, W: TIMESTAMP
    const sortimentiNazivi = [
      "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
      "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
      "F/L L", "I L", "II L", "III L", "TRUPCI",
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
    ];

    const newRow = [
      params.odjel,           // A - ODJEL
      parseDate(params.datum), // B - DATUM
      userFullName            // C - PRIMAČ
    ];

    // Dodaj sortimente D-U (18 kolona)
    const sortimentiValues = [];
    for (let i = 0; i < 17; i++) { // prvih 17 sortimenti (bez SVEUKUPNO)
      const value = parseFloat(params[sortimentiNazivi[i]]) || 0;
      newRow.push(value);
      sortimentiValues.push(value);
    }

    // Izračunaj SVEUKUPNO kao ČETINARI + LIŠĆARI
    const cetinari = sortimentiValues[8];  // ČETINARI je na indeksu 8
    const liscari = sortimentiValues[16];  // LIŠĆARI je na indeksu 16
    const ukupno = cetinari + liscari;

    // Dodaj SVEUKUPNO kao zadnju kolonu (U)
    newRow.push(ukupno);

    // Dodaj STATUS (V) i TIMESTAMP (W)
    newRow.push("PENDING");
    newRow.push(new Date());

    // Dodaj red na kraj sheet-a
    pendingSheet.appendRow(newRow);

    // 🚀 CACHE: Invalidate all cache after successful write
    invalidateAllCache();

    Logger.log('=== HANDLE ADD SJECA END ===');
    Logger.log('Successfully added new sjeca entry to PENDING');

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
 * Add Otprema endpoint - dodaje novi unos u INDEX_OTPREMA
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    let pendingSheet = ss.getSheetByName("PENDING_OTPREMA");

    // Kreiraj PENDING_OTPREMA sheet ako ne postoji
    if (!pendingSheet) {
      pendingSheet = ss.insertSheet("PENDING_OTPREMA");
      // Dodaj header red
      const headers = ["ODJEL", "DATUM", "OTPREMAČ", "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
                       "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI", "F/L L", "I L", "II L", "III L", "TRUPCI",
                       "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO", "KUPAC", "BROJ_OTPREMNICE", "STATUS", "TIMESTAMP"];
      pendingSheet.appendRow(headers);

      // Formatiraj header
      const headerRange = pendingSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#2563eb");
      headerRange.setFontColor("white");
      headerRange.setFontWeight("bold");
    }

    // Pripremi red podataka
    // A-U: kao INDEX_OTPREMA, V: KUPAC, W: STATUS, X: TIMESTAMP
    const sortimentiNazivi = [
      "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
      "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
      "F/L L", "I L", "II L", "III L", "TRUPCI",
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
    ];

    const newRow = [
      params.odjel,           // A - ODJEL
      parseDate(params.datum), // B - DATUM
      userFullName            // C - OTPREMAČ
    ];

    // Dodaj sortimente D-U (18 kolona)
    const sortimentiValues = [];
    for (let i = 0; i < 17; i++) { // prvih 17 sortimenti (bez SVEUKUPNO)
      const value = parseFloat(params[sortimentiNazivi[i]]) || 0;
      newRow.push(value);
      sortimentiValues.push(value);
    }

    // Izračunaj SVEUKUPNO kao ČETINARI + LIŠĆARI
    const cetinari = sortimentiValues[8];  // ČETINARI je na indeksu 8
    const liscari = sortimentiValues[16];  // LIŠĆARI je na indeksu 16
    const ukupno = cetinari + liscari;

    // Dodaj SVEUKUPNO (U)
    newRow.push(ukupno);

    // Dodaj KUPAC (V)
    newRow.push(params.kupac || '');

    // Dodaj BROJ_OTPREMNICE (W)
    newRow.push(params.brojOtpremnice || '');

    // Dodaj STATUS (X) i TIMESTAMP (Y)
    newRow.push("PENDING");
    newRow.push(new Date());

    // Dodaj red na kraj sheet-a
    pendingSheet.appendRow(newRow);

    // 🚀 CACHE: Invalidate all cache after successful write
    invalidateAllCache();

    Logger.log('=== HANDLE ADD OTPREMA END ===');
    Logger.log('Successfully added new otprema entry to PENDING');

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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    
    const pendingPrimkaSheet = ss.getSheetByName("PENDING_PRIMKA");
    const pendingOtpremaSheet = ss.getSheetByName("PENDING_OTPREMA");

    const sortimentiNazivi = [
      "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
      "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
      "F/L L", "I L", "II L", "III L", "TRUPCI",
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
    ];

    const pendingUnosi = [];

    // Pročitaj PENDING_PRIMKA
    if (pendingPrimkaSheet) {
      const primkaData = pendingPrimkaSheet.getDataRange().getValues();
      
      for (let i = 1; i < primkaData.length; i++) {
        const row = primkaData[i];
        const odjel = row[0];       // A - ODJEL
        const datum = row[1];       // B - DATUM
        const primac = row[2];      // C - PRIMAČ
        const status = row[21];     // V - STATUS
        const timestamp = row[22];  // W - TIMESTAMP

        if (!datum || status !== "PENDING") continue;

        const datumObj = parseDate(datum);
        if (year && datumObj.getFullYear() !== parseInt(year)) continue;

        // Pročitaj sortimente (kolone D-U, indeksi 3-20)
        const sortimenti = {};
        for (let j = 0; j < 18; j++) {
          const vrijednost = parseFloat(row[3 + j]) || 0;
          sortimenti[sortimentiNazivi[j]] = vrijednost;
        }

        // Izračunaj ukupno kao ČETINARI + LIŠĆARI
        const cetinari = parseFloat(sortimenti['ČETINARI']) || 0;
        const liscari = parseFloat(sortimenti['LIŠĆARI']) || 0;
        const ukupno = cetinari + liscari;

        pendingUnosi.push({
          id: i,  // Row number za kasnije brisanje/odobravanje
          tip: 'SJEČA',
          datum: formatDate(datumObj),
          odjel: odjel,
          radnik: primac,
          kupac: '',
          sortimenti: sortimenti,
          ukupno: ukupno,
          timestamp: formatDate(new Date(timestamp)),
          timestampObj: new Date(timestamp)
        });
      }
    }

    // Pročitaj PENDING_OTPREMA
    if (pendingOtpremaSheet) {
      const otpremaData = pendingOtpremaSheet.getDataRange().getValues();
      
      for (let i = 1; i < otpremaData.length; i++) {
        const row = otpremaData[i];
        const odjel = row[0];       // A - ODJEL
        const datum = row[1];       // B - DATUM
        const otpremac = row[2];    // C - OTPREMAČ
        const kupac = row[21];      // V - KUPAC
        const brojOtpremnice = row[22]; // W - BROJ_OTPREMNICE
        const status = row[23];     // X - STATUS
        const timestamp = row[24];  // Y - TIMESTAMP

        if (!datum || status !== "PENDING") continue;

        const datumObj = parseDate(datum);
        if (year && datumObj.getFullYear() !== parseInt(year)) continue;

        // Pročitaj sortimente (kolone D-U, indeksi 3-20)
        const sortimenti = {};
        for (let j = 0; j < 18; j++) {
          const vrijednost = parseFloat(row[3 + j]) || 0;
          sortimenti[sortimentiNazivi[j]] = vrijednost;
        }

        // Izračunaj ukupno kao ČETINARI + LIŠĆARI
        const cetinari = parseFloat(sortimenti['ČETINARI']) || 0;
        const liscari = parseFloat(sortimenti['LIŠĆARI']) || 0;
        const ukupno = cetinari + liscari;

        pendingUnosi.push({
          id: i,  // Row number za kasnije brisanje/odobravanje
          tip: 'OTPREMA',
          datum: formatDate(datumObj),
          odjel: odjel,
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
      sortimentiNazivi: sortimentiNazivi,
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const sheetName = tip === 'sjeca' ? 'PENDING_PRIMKA' : 'PENDING_OTPREMA';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return createJsonResponse({
        unosi: [],
        message: 'Nema pending unosa'
      }, true);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find column indices
    const radnikCol = tip === 'sjeca' ?
      headers.indexOf('PRIMAČ') :
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const sheetName = tip === 'sjeca' ? 'PENDING_PRIMKA' : 'PENDING_OTPREMA';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return createJsonResponse({ error: 'Sheet ne postoji' }, false);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const row = data[rowIndex - 1];

    // Verify ownership (only the creator or admin can edit)
    const radnikCol = tip === 'sjeca' ? headers.indexOf('PRIMAČ') : headers.indexOf('OTPREMAČ');
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const sheetName = tip === 'sjeca' ? 'PENDING_PRIMKA' : 'PENDING_OTPREMA';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return createJsonResponse({ error: 'Sheet ne postoji' }, false);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const row = data[rowIndex - 1];

    // Verify ownership (only the creator or admin can delete)
    const radnikCol = tip === 'sjeca' ? headers.indexOf('PRIMAČ') : headers.indexOf('OTPREMAČ');
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");
    const otpremaSheet = ss.getSheetByName("INDEX_OTPREMA");

    if (!primkaSheet || !otpremaSheet) {
      return createJsonResponse({ error: "INDEX sheets not found" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const otpremaData = otpremaSheet.getDataRange().getValues();

    // Nazivi sortimenta (kolone D-U = indeksi 3-20)
    const sortimentiNazivi = [
      "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
      "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
      "F/L L", "I L", "II L", "III L", "TRUPCI",
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
    ];

    // Inicijalizuj mjesečne sume za SJEČA (12 mjeseci)
    let sjecaMjeseci = [];
    for (let m = 0; m < 12; m++) {
      const mjesecObj = {};
      for (let s = 0; s < sortimentiNazivi.length; s++) {
        mjesecObj[sortimentiNazivi[s]] = 0;
      }
      sjecaMjeseci.push(mjesecObj);
    }

    // Inicijalizuj mjesečne sume za OTPREMA (12 mjeseci)
    let otpremaMjeseci = [];
    for (let m = 0; m < 12; m++) {
      const mjesecObj = {};
      for (let s = 0; s < sortimentiNazivi.length; s++) {
        mjesecObj[sortimentiNazivi[s]] = 0;
      }
      otpremaMjeseci.push(mjesecObj);
    }

    // Procesiranje SJEČA podataka
    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const datum = row[1]; // B - DATUM

      if (!datum) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11

      // Kolone D-U (indeksi 3-20) = sortimenti
      for (let j = 0; j < sortimentiNazivi.length; j++) {
        const vrijednost = parseFloat(row[3 + j]) || 0;
        sjecaMjeseci[mjesec][sortimentiNazivi[j]] += vrijednost;
      }
    }

    // Procesiranje OTPREMA podataka
    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const datum = row[1]; // B - DATUM

      if (!datum) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11

      // Kolone D-U (indeksi 3-20) = sortimenti
      for (let j = 0; j < sortimentiNazivi.length; j++) {
        const vrijednost = parseFloat(row[3 + j]) || 0;
        otpremaMjeseci[mjesec][sortimentiNazivi[j]] += vrijednost;
      }
    }

    Logger.log('=== HANDLE MJESECNI SORTIMENTI END ===');

    // 🚀 CACHE: Store result before returning
    const result = {
      sjeca: {
        sortimenti: sortimentiNazivi,
        mjeseci: sjecaMjeseci
      },
      otprema: {
        sortimenti: sortimentiNazivi,
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");

    if (!primkaSheet) {
      return createJsonResponse({ error: "INDEX_PRIMKA sheet not found" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();

    const sortimentiNazivi = [
      "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
      "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
      "F/L L", "I L", "II L", "III L", "TRUPCI",
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
    ];

    const dailyData = [];

    // Process PRIMKA data
    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[0];
      const datum = row[1];
      const primac = row[2];

      if (!datum || !primac) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;
      if (datumObj.getMonth() !== parseInt(month)) continue;

      // Build sortimenti object
      const sortimenti = {};
      for (let j = 0; j < sortimentiNazivi.length; j++) {
        sortimenti[sortimentiNazivi[j]] = parseFloat(row[3 + j]) || 0;
      }

      dailyData.push({
        datum: Utilities.formatDate(datumObj, Session.getScriptTimeZone(), "dd.MM.yyyy"),
        datumSort: datumObj.getTime(),
        odjel: odjel || "",
        primac: primac,
        sortimenti: sortimenti
      });
    }

    // Sort by date (newest first)
    dailyData.sort((a, b) => b.datumSort - a.datumSort);

    return createJsonResponse({
      sortimentiNazivi: sortimentiNazivi,
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const otpremaSheet = ss.getSheetByName("INDEX_OTPREMA");

    if (!otpremaSheet) {
      return createJsonResponse({ error: "INDEX_OTPREMA sheet not found" }, false);
    }

    const otpremaData = otpremaSheet.getDataRange().getValues();

    const sortimentiNazivi = [
      "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
      "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
      "F/L L", "I L", "II L", "III L", "TRUPCI",
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
    ];

    const dailyData = [];

    // Process OTPREMA data
    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const odjel = row[0];
      const datum = row[1];
      const otpremac = row[2];
      const kupac = row[21] || ""; // KUPAC column

      if (!datum || !otpremac) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;
      if (datumObj.getMonth() !== parseInt(month)) continue;

      // Build sortimenti object
      const sortimenti = {};
      for (let j = 0; j < sortimentiNazivi.length; j++) {
        sortimenti[sortimentiNazivi[j]] = parseFloat(row[3 + j]) || 0;
      }

      dailyData.push({
        datum: Utilities.formatDate(datumObj, Session.getScriptTimeZone(), "dd.MM.yyyy"),
        datumSort: datumObj.getTime(),
        odjel: odjel || "",
        otpremac: otpremac,
        kupac: kupac,
        sortimenti: sortimenti
      });
    }

    // Sort by date (newest first)
    dailyData.sort((a, b) => b.datumSort - a.datumSort);

    return createJsonResponse({
      sortimentiNazivi: sortimentiNazivi,
      data: dailyData
    }, true);

  } catch (error) {
    return createJsonResponse({
      error: "Greška pri učitavanju dnevnih podataka otpreme: " + error.toString()
    }, false);
  }
}

// ========================================
// DIJAGNOSTIKA - Funkcije za debugovanje
// ========================================

/**
 * DIJAGNOSTIČKA FUNKCIJA: Prikazuje sve Oktobar unose iz INDEX_PRIMKA i INDEX_OTPREMA
 * Koristi se za debugovanje razlika u mjesečnim sumama
 */
function diagnosticOctoberData() {
  try {
    Logger.log('=== OKTOBAR DIJAGNOSTIKA ===');

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName('INDEX_PRIMKA');
    const otpremaSheet = ss.getSheetByName('INDEX_OTPREMA');

    if (!primkaSheet || !otpremaSheet) {
      Logger.log('ERROR: INDEX sheets not found');
      return;
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const otpremaData = otpremaSheet.getDataRange().getValues();

    // Analiza PRIMKA (Sječa)
    Logger.log('\n=== PRIMKA (SJEČA) - OKTOBAR 2025 ===');
    let primkaSum = 0;
    let primkaCount = 0;

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[0];
      const datum = row[1];
      const kubik = parseFloat(row[20]) || 0; // kolona U - SVEUKUPNO

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

    // Analiza OTPREMA
    Logger.log('\n=== OTPREMA - OKTOBAR 2025 ===');
    let otpremaSum = 0;
    let otpremaCount = 0;

    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const odjel = row[0];
      const datum = row[1];
      const kupac = row[21] || ""; // KUPAC column
      const kubik = parseFloat(row[20]) || 0; // kolona U - SVEUKUPNO

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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName('INDEX_PRIMKA');

    if (!primkaSheet) {
      Logger.log('ERROR: INDEX_PRIMKA sheet not found');
      return;
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    Logger.log('Ukupno redova u INDEX_PRIMKA: ' + primkaData.length);
    Logger.log('\n=== PRVIH 30 REDOVA (primjeri datuma) ===\n');

    const mjeseciCounter = {};
    for (let m = 0; m < 12; m++) {
      mjeseciCounter[m] = 0;
    }

    for (let i = 1; i < Math.min(30, primkaData.length); i++) {
      const row = primkaData[i];
      const odjel = row[0];
      const rawDatum = row[1];
      const kubik = parseFloat(row[20]) || 0;

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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName('INDEX_PRIMKA');

    if (!primkaSheet) {
      Logger.log('ERROR: INDEX_PRIMKA sheet not found');
      return;
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    Logger.log('Ukupno redova u INDEX_PRIMKA: ' + primkaData.length);
    Logger.log('\n=== TRAŽIM UNOSE SA KUBIK = 25.78 U OKTOBRU ===\n');

    let foundCount = 0;

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[0];
      const datum = row[1];
      const primac = row[2];
      const kubik = parseFloat(row[20]) || 0; // kolona U - SVEUKUPNO

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
        Logger.log('  Radilište: ' + (row[21] || ''));
        Logger.log('  Izvođač: ' + (row[22] || ''));
        Logger.log('');
      }
    }

    Logger.log('\n=== UKUPNO PRONAĐENO: ' + foundCount + ' unosa ===');

    // Također traži u OTPREMA
    const otpremaSheet = ss.getSheetByName('INDEX_OTPREMA');
    if (otpremaSheet) {
      const otpremaData = otpremaSheet.getDataRange().getValues();
      Logger.log('\n=== PROVJERA U INDEX_OTPREMA ===\n');

      let otpremaFoundCount = 0;

      for (let i = 1; i < otpremaData.length; i++) {
        const row = otpremaData[i];
        const odjel = row[0];
        const datum = row[1];
        const otpremac = row[2];
        const kubik = parseFloat(row[20]) || 0;

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
          Logger.log('  Kupac: ' + (row[21] || ''));
          Logger.log('  Kubik: ' + kubik.toFixed(2));
          Logger.log('');
        }
      }

      Logger.log('UKUPNO U OTPREMA: ' + otpremaFoundCount + ' unosa');
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
        const kubik = parseFloat(row[20]) || 0; // kolona U

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
        const kubik = parseFloat(row[20]) || 0; // kolona U

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

/**
 * SYNC STANJE ODJELA - Sinkronizuje podatke o stanju odjela na cache sheet
 * Ova funkcija se poziva jednom dnevno automatski ili ručno
 * Piše podatke na sheet "STANJE_ODJELA_CACHE" u INDEX spreadsheet-u
 */
function syncStanjeOdjela() {
  try {
    Logger.log('=== SYNC STANJE ODJELA START ===');
    Logger.log('Vrijeme sinkronizacije: ' + new Date().toString());

    // Fiksno sortimentno zaglavlje (D-U kolone)
    const sortimentiNazivi = [
      'F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'TRUPCI Č',
      'CEL.DUGA', 'CEL.CIJEPANA', 'ČETINARI',
      'F/L L', 'I L', 'II L', 'III L', 'TRUPCI L',
      'OGR. DUGI', 'OGR. CIJEPANI', 'LIŠĆARI',
      'SVEUKUPNO'
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

        // Čitaj redove 10-13, kolone D-U (indeksi 3-20)
        const dataRange = otpremaSheet.getRange(10, 4, 4, 18); // Redovi 10-13, kolona D, 18 kolona
        const dataValues = dataRange.getValues();

        const projekat = dataValues[0].map(v => parseFloat(v) || 0);
        const sjeca = dataValues[1].map(v => parseFloat(v) || 0);
        const otprema = dataValues[2].map(v => parseFloat(v) || 0);
        const sumaLager = dataValues[3].map(v => parseFloat(v) || 0);

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

    // Sada zapiši sve podatke na cache sheet
    const indexSpreadsheet = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    let cacheSheet = indexSpreadsheet.getSheetByName('STANJE_ODJELA_CACHE');

    // Kreiraj sheet ako ne postoji
    if (!cacheSheet) {
      Logger.log('Kreiram novi sheet: STANJE_ODJELA_CACHE');
      cacheSheet = indexSpreadsheet.insertSheet('STANJE_ODJELA_CACHE');
    }

    // Očisti sheet
    cacheSheet.clear();

    // Postavi zaglavlje
    const headerRow = ['Odjel Naziv', 'Radilište', 'Izvođač', 'Zadnji Datum (timestamp)', 'Zadnji Datum (formatted)', 'Red Tip', ...sortimentiNazivi];
    cacheSheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
    cacheSheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');

    // Pripremi podatke za upis
    const dataRows = [];
    filteredOdjeliData.forEach(odjel => {
      const datumFormatted = odjel.zadnjiDatum ? new Date(odjel.zadnjiDatum).toLocaleDateString('sr-RS') : '';

      // 4 reda po odjelu: PROJEKAT, SJEČA, OTPREMA, ZALIHA
      dataRows.push([odjel.odjelNaziv, odjel.radiliste, odjel.izvodjac || '', odjel.zadnjiDatum, datumFormatted, 'PROJEKAT', ...odjel.redovi.projekat]);
      dataRows.push([odjel.odjelNaziv, odjel.radiliste, odjel.izvodjac || '', odjel.zadnjiDatum, datumFormatted, 'SJEČA', ...odjel.redovi.sjeca]);
      dataRows.push([odjel.odjelNaziv, odjel.radiliste, odjel.izvodjac || '', odjel.zadnjiDatum, datumFormatted, 'OTPREMA', ...odjel.redovi.otprema]);
      dataRows.push([odjel.odjelNaziv, odjel.radiliste, odjel.izvodjac || '', odjel.zadnjiDatum, datumFormatted, 'ZALIHA', ...odjel.redovi.sumaLager]);
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

/**
 * Setup dnevnog trigger-a za sinkronizaciju stanja odjela
 * Poziva se ručno jednom da postavi automatsko izvršavanje
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
 * STANJE ODJELA - Čita trenutno stanje iz cache sheeta
 * Brža verzija koja čita već pripremljene podatke umjesto da prolazi kroz sve odjele
 * Prikazuje po radilištima sa 4 reda: PROJEKAT, SJEČA, OTPREMA, ZALIHA
 * Sortira po najsvježijim unosima u PRIMKA
 */
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

    // Otvori cache sheet
    const indexSpreadsheet = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const cacheSheet = indexSpreadsheet.getSheetByName('STANJE_ODJELA_CACHE');

    if (!cacheSheet) {
      Logger.log('Cache sheet ne postoji, pozivam syncStanjeOdjela()');
      syncStanjeOdjela();
      // Ponovo otvori nakon sinkronizacije
      const cacheSheetNew = indexSpreadsheet.getSheetByName('STANJE_ODJELA_CACHE');
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
    const odjeliData = [];
    const odjeliMap = new Map(); // Mapa: odjelNaziv -> odjel objekt

    for (let i = 2; i < allData.length; i++) {
      const row = allData[i];
      const odjelNaziv = row[0];
      const radiliste = row[1];
      const izvodjac = row[2];
      const zadnjiDatumTimestamp = row[3];
      const zadnjiDatumFormatted = row[4];
      const redTip = row[5]; // PROJEKAT, SJEČA, OTPREMA, ZALIHA
      const sortimenti = row.slice(6); // Sortimenti počinju od kolone 7

      // SVEUKUPNO je zadnja kolona u sortimentima
      const sveukupno = sortimenti[sortimenti.length - 1] || 0;

      // Ako odjel nije u mapi, dodaj ga
      if (!odjeliMap.has(odjelNaziv)) {
        odjeliMap.set(odjelNaziv, {
          odjel: odjelNaziv,
          radiliste: radiliste,
          zadnjiDatum: zadnjiDatumTimestamp ? new Date(zadnjiDatumTimestamp) : null,
          datumZadnjeSjece: zadnjiDatumFormatted,
          projekat: 0,
          sjeca: 0,
          otprema: 0,
          sumaPanj: 0,
          izvođač: izvodjac || '',
          realizacija: 0,
          zadnjiDatumObj: zadnjiDatumTimestamp ? new Date(zadnjiDatumTimestamp) : null,
          redovi: {
            projekat: [],
            sjeca: [],
            otprema: [],
            sumaLager: []
          }
        });
      }

      const odjel = odjeliMap.get(odjelNaziv);

      // Dodaj sortimente u odgovarajući red (kao nizove za detaljni prikaz)
      if (redTip === 'PROJEKAT') {
        odjel.redovi.projekat = sortimenti.map(v => parseFloat(v) || 0);
        odjel.projekat = parseFloat(sveukupno) || 0;
      } else if (redTip === 'SJEČA') {
        odjel.redovi.sjeca = sortimenti.map(v => parseFloat(v) || 0);
        odjel.sjeca = parseFloat(sveukupno) || 0;
      } else if (redTip === 'OTPREMA') {
        odjel.redovi.otprema = sortimenti.map(v => parseFloat(v) || 0);
        odjel.otprema = parseFloat(sveukupno) || 0;
      } else if (redTip === 'ZALIHA') {
        odjel.redovi.sumaLager = sortimenti.map(v => parseFloat(v) || 0);
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

// ========================================
// PRIMACI BY RADILISTE - Prikaz sječe po radilištima
// ========================================

function handlePrimaciByRadiliste(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  Logger.log('=== HANDLE PRIMACI BY RADILISTE START ===');
  Logger.log('Year: ' + year);

  try {
    // Korak 1: Mapiraj odjel -> radilište iz ODJELI foldera
    const odjelRadilisteMap = {};
    const folder = DriveApp.getFolderById(ODJELI_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

    while (files.hasNext()) {
      const file = files.next();
      const odjelNaziv = file.getName();

      try {
        const ss = SpreadsheetApp.open(file);
        const primkaSheet = ss.getSheetByName('PRIMKA');

        if (primkaSheet) {
          const radiliste = primkaSheet.getRange('W2').getValue() || 'Nepoznato';
          odjelRadilisteMap[odjelNaziv] = String(radiliste).trim();
        }
      } catch (error) {
        Logger.log('Error reading radiliste for ' + odjelNaziv + ': ' + error.toString());
        odjelRadilisteMap[odjelNaziv] = 'Nepoznato';
      }
    }

    // Korak 2: Učitaj podatke iz INDEX_PRIMKA
    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");

    if (!primkaSheet) {
      return createJsonResponse({ error: "INDEX_PRIMKA sheet not found" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const sortimentiNazivi = [
      "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
      "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
      "F/L L", "I L", "II L", "III L", "TRUPCI",
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
    ];

    // Korak 3: Grupisanje po radilištu
    const radilistaMap = {};

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[0];     // A - ODJEL
      const datum = row[1];     // B - DATUM

      if (!datum || !odjel) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11
      const radiliste = odjelRadilisteMap[odjel] || 'Nepoznato';

      // Inicijalizuj radilište ako ne postoji
      if (!radilistaMap[radiliste]) {
        radilistaMap[radiliste] = {
          naziv: radiliste,
          mjeseci: Array(12).fill(0),
          sortimentiUkupno: {},
          ukupno: 0
        };
        sortimentiNazivi.forEach(s => radilistaMap[radiliste].sortimentiUkupno[s] = 0);
      }

      // Dodaj kubike po mjesecu
      const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO
      radilistaMap[radiliste].mjeseci[mjesec] += kubik;
      radilistaMap[radiliste].ukupno += kubik;

      // Dodaj sortimente (D-U, indeksi 3-20)
      for (let j = 0; j < 18; j++) {
        const vrijednost = parseFloat(row[3 + j]) || 0;
        radilistaMap[radiliste].sortimentiUkupno[sortimentiNazivi[j]] += vrijednost;
      }
    }

    // Korak 4: Konvertuj u array i sortiraj
    const radilista = [];
    for (const naziv in radilistaMap) {
      radilista.push(radilistaMap[naziv]);
    }
    radilista.sort((a, b) => b.ukupno - a.ukupno);

    Logger.log('=== HANDLE PRIMACI BY RADILISTE END ===');
    Logger.log('Broj radilišta: ' + radilista.length);

    return createJsonResponse({
      radilista: radilista,
      sortimentiNazivi: sortimentiNazivi
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
    // Korak 1: Mapiraj odjel -> izvođač iz ODJELI foldera
    const odjelIzvodjacMap = {};
    const folder = DriveApp.getFolderById(ODJELI_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

    while (files.hasNext()) {
      const file = files.next();
      const odjelNaziv = file.getName();

      try {
        const ss = SpreadsheetApp.open(file);
        const primkaSheet = ss.getSheetByName('PRIMKA');

        if (primkaSheet) {
          const izvodjac = primkaSheet.getRange('W3').getValue() || 'Nepoznat';
          odjelIzvodjacMap[odjelNaziv] = String(izvodjac).trim();
        }
      } catch (error) {
        Logger.log('Error reading izvodjac for ' + odjelNaziv + ': ' + error.toString());
        odjelIzvodjacMap[odjelNaziv] = 'Nepoznat';
      }
    }

    // Korak 2: Učitaj podatke iz INDEX_PRIMKA
    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");

    if (!primkaSheet) {
      return createJsonResponse({ error: "INDEX_PRIMKA sheet not found" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const sortimentiNazivi = [
      "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
      "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
      "F/L L", "I L", "II L", "III L", "TRUPCI",
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
    ];

    // Korak 3: Grupisanje po izvođaču
    const izvodjaciMap = {};

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[0];     // A - ODJEL
      const datum = row[1];     // B - DATUM

      if (!datum || !odjel) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11
      const izvodjac = odjelIzvodjacMap[odjel] || 'Nepoznat';

      // Inicijalizuj izvođača ako ne postoji
      if (!izvodjaciMap[izvodjac]) {
        izvodjaciMap[izvodjac] = {
          naziv: izvodjac,
          mjeseci: Array(12).fill(0),
          sortimentiUkupno: {},
          ukupno: 0
        };
        sortimentiNazivi.forEach(s => izvodjaciMap[izvodjac].sortimentiUkupno[s] = 0);
      }

      // Dodaj kubike po mjesecu
      const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO
      izvodjaciMap[izvodjac].mjeseci[mjesec] += kubik;
      izvodjaciMap[izvodjac].ukupno += kubik;

      // Dodaj sortimente (D-U, indeksi 3-20)
      for (let j = 0; j < 18; j++) {
        const vrijednost = parseFloat(row[3 + j]) || 0;
        izvodjaciMap[izvodjac].sortimentiUkupno[sortimentiNazivi[j]] += vrijednost;
      }
    }

    // Korak 4: Konvertuj u array i sortiraj
    const izvodjaci = [];
    for (const naziv in izvodjaciMap) {
      izvodjaci.push(izvodjaciMap[naziv]);
    }
    izvodjaci.sort((a, b) => b.ukupno - a.ukupno);

    Logger.log('=== HANDLE PRIMACI BY IZVODJAC END ===');
    Logger.log('Broj izvođača: ' + izvodjaci.length);

    return createJsonResponse({
      izvodjaci: izvodjaci,
      sortimentiNazivi: sortimentiNazivi
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const indexSheet = ss.getSheetByName("INDEX_PRIMKA");  // ✅ Čita iz INDEX_PRIMKA umjesto PENDING_PRIMKA

    const primke = [];

    if (indexSheet) {
      const data = indexSheet.getDataRange().getValues();

      // Skip header row (row 0)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const odjel = row[0];       // A - ODJEL
        const datum = row[1];       // B - DATUM
        const primac = row[2];      // C - PRIMAČ
        const status = row[21];     // V - STATUS (može biti PENDING ili APPROVED)

        // Skip empty rows
        if (!datum || !odjel) continue;

        // Formatuj datum
        const datumObj = parseDate(datum);
        const datumStr = formatDate(datumObj);

        // Parse radilište iz odjel naziva (npr. "BJELAJSKE UVALE - ODJEL 1" -> "BJELAJSKE UVALE")
        // ✅ Konvertuj odjel u string prije poziva .includes()
        const odjelStr = String(odjel || '');
        const radiliste = odjelStr.includes(' - ') ? odjelStr.split(' - ')[0].trim() : '';

        // Sortimenti su u kolonama D-U (indeksi 3-20)
        // Za pojedinačnu primku trebamo svaki sortiment kao poseban zapis
        const sortimentiNazivi = [
          "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
          "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
          "F/L L", "I L", "II L", "III L", "TRUPCI",
          "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
        ];

        // Dodaj svaki sortiment kao poseban zapis (ako ima količinu)
        for (let j = 0; j < 17; j++) { // Bez SVEUKUPNO (zadnji je agregirani)
          const kolicina = parseFloat(row[3 + j]) || 0;
          if (kolicina > 0) {
            primke.push({
              datum: datumStr,
              odjel: odjelStr,  // ✅ Koristi string verziju
              radiliste: radiliste,
              sortiment: sortimentiNazivi[j],
              kolicina: kolicina,
              primac: primac,
              status: status
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const indexSheet = ss.getSheetByName("INDEX_OTPREMA");  // ✅ Čita iz INDEX_OTPREMA umjesto PENDING_OTPREMA

    const otpreme = [];

    if (indexSheet) {
      const data = indexSheet.getDataRange().getValues();

      // Skip header row (row 0)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const odjel = row[0];       // A - ODJEL
        const datum = row[1];       // B - DATUM
        const otpremac = row[2];    // C - OTPREMAČ
        const kupac = row[21];      // V - KUPAC
        const status = row[23];     // X - STATUS (može biti PENDING ili APPROVED)

        // Skip empty rows
        if (!datum || !odjel) continue;

        // Formatuj datum
        const datumObj = parseDate(datum);
        const datumStr = formatDate(datumObj);

        // Parse radilište iz odjel naziva
        // ✅ Konvertuj odjel u string prije poziva .includes()
        const odjelStr = String(odjel || '');
        const radiliste = odjelStr.includes(' - ') ? odjelStr.split(' - ')[0].trim() : '';

        // Sortimenti su u kolonama D-U (indeksi 3-20)
        const sortimentiNazivi = [
          "F/L Č", "I Č", "II Č", "III Č", "RUDNO", "TRUPCI Č",
          "CEL.DUGA", "CEL.CIJEPANA", "ČETINARI",
          "F/L L", "I L", "II L", "III L", "TRUPCI",
          "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI", "SVEUKUPNO"
        ];

        // Dodaj svaki sortiment kao poseban zapis (ako ima količinu)
        for (let j = 0; j < 17; j++) { // Bez SVEUKUPNO
          const kolicina = parseFloat(row[3 + j]) || 0;
          if (kolicina > 0) {
            otpreme.push({
              datum: datumStr,
              odjel: odjelStr,  // ✅ Koristi string verziju
              radiliste: radiliste,
              sortiment: sortimentiNazivi[j],
              kolicina: kolicina,
              otpremac: otpremac,
              kupac: kupac || '',
              status: status
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

// ========================================
// POST REQUEST HANDLER
// ========================================

/**
 * Main handler for POST requests
 */
function doPost(e) {
  try {
    const path = e.parameter.path;
    const postData = JSON.parse(e.postData.contents);

    if (path === 'save_dinamika') {
      return handleSaveDinamika(postData);
    }

    return createJsonResponse({ error: 'Unknown POST path' }, false);
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ========================================
// DINAMIKA API - Upravljanje mjesečnom dinamikom
// ========================================

/**
 * Get Dinamika endpoint - vraća mjesečnu dinamiku za odabranu godinu
 */
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
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

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
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

// ========== MANIFEST ENDPOINT - Smart Cache Invalidation ==========
// 📊 Vraća verziju i count podataka za pametnu invalidaciju keša
function handleManifest() {
  try {
    Logger.log('Manifest endpoint called');

    // Otvori spreadsheet sa podacima
    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);

    // Dohvati sheet-ove
    const primacijaSheet = ss.getSheetByName('Primacija');
    const otpremaSheet = ss.getSheetByName('Otprema');
    const odjeliSheet = ss.getSheetByName('Odjeli');

    // Broji redove (minus header red)
    // getLastRow() vraća broj zadnjeg reda sa podacima
    const primaciCount = primacijaSheet ? (primacijaSheet.getLastRow() - 1) : 0;
    const otpremaciCount = otpremaSheet ? (otpremaSheet.getLastRow() - 1) : 0;
    const odjeliCount = odjeliSheet ? (odjeliSheet.getLastRow() - 1) : 0;

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
// Vraća broj redova u Primacija i Otprema za delta sync
function handleManifestData(username, password) {
  try {
    Logger.log('Manifest Data endpoint called');

    // Provjeri autentikaciju
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    // Otvori spreadsheet sa podacima
    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);

    // Dohvati sheet-ove
    const primacijaSheet = ss.getSheetByName('Primacija');
    const otpremaSheet = ss.getSheetByName('Otprema');

    // Broji redove (minus header red)
    const primkaRowCount = primacijaSheet ? (primacijaSheet.getLastRow() - 1) : 0;
    const otpremaRowCount = otpremaSheet ? (otpremaSheet.getLastRow() - 1) : 0;

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

    // Otvori spreadsheet
    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primacijaSheet = ss.getSheetByName('Primacija');

    if (!primacijaSheet) {
      return createJsonResponse({ error: 'Primacija sheet not found' }, false);
    }

    const lastRow = primacijaSheet.getLastRow();

    // Adjust toRow if it exceeds lastRow
    const actualToRow = Math.min(toRowInt, lastRow - 1); // -1 for header
    const numRows = actualToRow - fromRowInt + 1;

    if (numRows <= 0) {
      Logger.log('No new rows to fetch');
      return createJsonResponse({ rows: [] }, true);
    }

    // Fetch rows (fromRow+1 jer je red 1 header)
    const startRow = fromRowInt + 1; // +1 for header
    const data = primacijaSheet.getRange(startRow, 1, numRows, primacijaSheet.getLastColumn()).getValues();

    // Convert to JSON objects sa rowIndex
    const rows = data.map((row, index) => ({
      rowIndex: fromRowInt + index,
      datum: row[0] ? formatDateHelper(row[0]) : '',
      odjel: row[1] || '',
      radiliste: row[2] || '',
      izvodjac: row[3] || '',
      primac: row[4] || '',
      sortiment: row[5] || '',
      kubici: parseFloat(row[6]) || 0
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

    // Otvori spreadsheet
    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const otpremaSheet = ss.getSheetByName('Otprema');

    if (!otpremaSheet) {
      return createJsonResponse({ error: 'Otprema sheet not found' }, false);
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

    // Convert to JSON objects sa rowIndex
    const rows = data.map((row, index) => ({
      rowIndex: fromRowInt + index,
      datum: row[0] ? formatDateHelper(row[0]) : '',
      odjel: row[1] || '',
      radiliste: row[2] || '',
      kupac: row[3] || '',
      otpremac: row[4] || '',
      sortiment: row[5] || '',
      kubici: parseFloat(row[6]) || 0
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
