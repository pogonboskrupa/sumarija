// ✅ IMPROVED: Google Apps Script za Šumarija API
// Deploy kao Web App: Deploy > New deployment > Web app
// Version: 2.0 (Poboljšana verzija sa validacijom, logging-om i performance optimizacijama)

// ⚠️ VAŽNO: Postavi svoj Spreadsheet ID ovdje
const SPREADSHEET_ID = '1rpl0RiqsE6lrU9uDMTjf127By7b951rP3a5Chis9qwg';

// ✅ NOVO: Konstante za column indices (lakše održavanje)
const COLUMN_INDICES = {
  DATUM: 0,            // Kolona A - Datum
  ODJEL: 1,            // Kolona B - Odjel
  KUBIK: 10,           // Kolona K - Kubici (PRILAGODI prema stvarnoj koloni)
  PROJEKAT: 20,        // Kolona U - Projekat (U11)
  UKUPNO_POSJEKLO: 21  // Kolona V - Ukupno posjeklo (U12)
};

// ✅ NOVO: Konstante za validaciju
const VALIDATION = {
  MIN_YEAR: 2000,
  MAX_YEAR: 2100,
  CURRENT_YEAR: new Date().getFullYear()
};

// ✅ IMPROVED: Glavni handler za sve zahtjeve sa validacijom
function doGet(e) {
  try {
    // ✅ NOVO: Validacija request parametara
    if (!e || !e.parameter) {
      return createJsonResponse({ error: 'Invalid request - missing parameters' }, false);
    }

    const path = e.parameter.path;

    // ✅ NOVO: Logging za debugging
    Logger.log(`API Request - Path: ${path}, Params: ${JSON.stringify(e.parameter)}`);

    if (path === 'login') {
      const { username, password } = e.parameter;

      // ✅ NOVO: Validacija login parametara
      if (!username || !password) {
        Logger.log('Login failed - Missing username or password');
        return createJsonResponse({
          error: 'Username i password su obavezni'
        }, false);
      }

      return handleLogin(username, password);

    } else if (path === 'stats') {
      const { year, username, password } = e.parameter;

      // ✅ NOVO: Validacija stats parametara
      if (!year) {
        return createJsonResponse({
          error: 'Year parametar je obavezan'
        }, false);
      }

      if (!username || !password) {
        return createJsonResponse({
          error: 'Username i password su obavezni za pristup statistikama'
        }, false);
      }

      return handleStats(year, username, password);
    }

    Logger.log(`Unknown path requested: ${path}`);
    return createJsonResponse({ error: 'Unknown path' }, false);

  } catch (error) {
    Logger.log(`Error in doGet: ${error.toString()}`);
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// Login handler
function handleLogin(username, password) {
  Logger.log(`Login attempt for user: ${username}`);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const usersSheet = ss.getSheetByName('Korisnici');

    if (!usersSheet) {
      Logger.log('Users sheet not found');
      return createJsonResponse({ error: 'Users sheet not found' }, false);
    }

    const data = usersSheet.getDataRange().getValues();

    // Struktura: A = username, B = password, C = ime_prezime, D = tip (primac/otpremac)
    for (let i = 1; i < data.length; i++) {
      // Skip empty rows
      if (!data[i][0]) continue;

      // Konverzija password u string za poređenje
      const storedPassword = String(data[i][1]);
      const inputPassword = String(password);

      if (data[i][0] === username && storedPassword === inputPassword) {
        const tip = data[i][3]; // primac ili otpremac

        Logger.log(`Login successful for user: ${username}, type: ${tip}`);

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

    Logger.log(`Login failed for user: ${username} - Invalid credentials`);
    return createJsonResponse({
      success: false,
      error: 'Pogrešno korisničko ime ili šifra'
    }, false);

  } catch (error) {
    Logger.log(`Error in handleLogin: ${error.toString()}`);
    return createJsonResponse({
      success: false,
      error: 'Greška pri prijavi: ' + error.toString()
    }, false);
  }
}

// ✅ IMPROVED: Stats handler sa validacijom godine
function handleStats(year, username, password) {
  Logger.log(`Stats request for year: ${year}, user: ${username}`);

  try {
    // ✅ NOVO: Validacija year parametra
    const parsedYear = parseInt(year);
    if (isNaN(parsedYear) || parsedYear < VALIDATION.MIN_YEAR || parsedYear > VALIDATION.MAX_YEAR) {
      Logger.log(`Invalid year: ${year}`);
      return createJsonResponse({
        error: `Nevažeća godina. Molimo unesite godinu između ${VALIDATION.MIN_YEAR} i ${VALIDATION.MAX_YEAR}.`
      }, false);
    }

    // Prvo provjerimo autentikaciju
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      Logger.log(`Stats request unauthorized for user: ${username}`);
      return createJsonResponse({ error: 'Unauthorized' }, false);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName('PRIMKA');
    const otpremaSheet = ss.getSheetByName('OTPREMA');

    if (!primkaSheet || !otpremaSheet) {
      Logger.log('Required sheets not found');
      return createJsonResponse({ error: 'Required sheets not found' }, false);
    }

    // Čitaj podatke
    const startTime = new Date().getTime();
    const primkaData = primkaSheet.getDataRange().getValues();
    const otpremaData = otpremaSheet.getDataRange().getValues();
    const readTime = new Date().getTime() - startTime;
    Logger.log(`Data read time: ${readTime}ms`);

    // Obradi podatke
    const stats = {
      totalPrimka: 0,
      totalOtprema: 0,
      monthlyStats: createMonthlyStats(),
      odjeliStats: {}
    };

    // Procesiranje podataka
    const processStartTime = new Date().getTime();
    processPrimkaData(primkaData, stats, parsedYear);
    processorOtpremaData(otpremaData, stats, parsedYear);
    processOdjeliDetails(primkaSheet, stats);
    const processTime = new Date().getTime() - processStartTime;
    Logger.log(`Data processing time: ${processTime}ms`);

    Logger.log(`Stats request successful - Total primka: ${stats.totalPrimka}, Total otprema: ${stats.totalOtprema}`);
    return createJsonResponse(stats, true);

  } catch (error) {
    Logger.log(`Error in handleStats: ${error.toString()}`);
    return createJsonResponse({
      error: 'Greška pri učitavanju statistika: ' + error.toString()
    }, false);
  }
}

// ✅ IMPROVED: Procesiranje PRIMKA sheet-a sa validacijom datuma
function processPrimkaData(data, stats, year) {
  let processedRows = 0;
  let skippedRows = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const datum = row[COLUMN_INDICES.DATUM];
    const odjel = row[COLUMN_INDICES.ODJEL];
    const kubik = parseFloat(row[COLUMN_INDICES.KUBIK]) || 0;

    // Skip rows sa nedostajućim podacima
    if (!datum || !odjel) {
      skippedRows++;
      continue;
    }

    // ✅ NOVO: Validacija datuma
    const datumObj = new Date(datum);
    if (isNaN(datumObj.getTime())) {
      Logger.log(`Invalid date in PRIMKA row ${i}: ${datum}`);
      skippedRows++;
      continue;
    }

    if (datumObj.getFullYear() !== year) continue;

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

    processedRows++;
  }

  Logger.log(`PRIMKA processing: ${processedRows} rows processed, ${skippedRows} rows skipped`);
}

// ✅ IMPROVED: Procesiranje OTPREMA sheet-a sa validacijom datuma
function processOtpremaData(data, stats, year) {
  let processedRows = 0;
  let skippedRows = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const datum = row[COLUMN_INDICES.DATUM];
    const odjel = row[COLUMN_INDICES.ODJEL];
    const kubik = parseFloat(row[COLUMN_INDICES.KUBIK]) || 0;

    if (!datum || !odjel) {
      skippedRows++;
      continue;
    }

    // ✅ NOVO: Validacija datuma
    const datumObj = new Date(datum);
    if (isNaN(datumObj.getTime())) {
      Logger.log(`Invalid date in OTPREMA row ${i}: ${datum}`);
      skippedRows++;
      continue;
    }

    if (datumObj.getFullYear() !== year) continue;

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
    processedRows++;
  }

  Logger.log(`OTPREMA processing: ${processedRows} rows processed, ${skippedRows} rows skipped`);
}

// ✅ IMPROVED: Optimizovano procesiranje podataka o projektima (O(n) umjesto O(n*m))
function processOdjeliDetails(primkaSheet, stats) {
  const data = primkaSheet.getDataRange().getValues();

  // ✅ NOVO: Kreiraj mapu za brži lookup
  // Čuvamo zadnji red za svaki odjel (O(n) kompleksnost)
  const odjelDataMap = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const odjelNaziv = row[COLUMN_INDICES.ODJEL];

    if (odjelNaziv) {
      // Čuvaj zadnji red za svaki odjel
      odjelDataMap[odjelNaziv] = row;
    }
  }

  // Sada samo prolazi kroz stats odjele (O(n) umjesto O(n*m))
  let processedOdjels = 0;

  for (let odjel in stats.odjeliStats) {
    const row = odjelDataMap[odjel];

    if (row) {
      const projekat = parseFloat(row[COLUMN_INDICES.PROJEKAT]) || 0;
      const ukupnoPosjeklo = parseFloat(row[COLUMN_INDICES.UKUPNO_POSJEKLO]) || 0;

      stats.odjeliStats[odjel].projekat = projekat;
      stats.odjeliStats[odjel].ukupnoPosjeklo = ukupnoPosjeklo;

      processedOdjels++;
    }
  }

  Logger.log(`OdjeliDetails processing: ${processedOdjels} odjels processed`);
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

// ✅ IMPROVED: JSON response sa CORS headers
function createJsonResponse(data, success) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  // ✅ NOVO: CORS headers (opciono - Apps Script ih dodaje automatski)
  // Ali eksplicitno dodavanje ne škodi
  // output.setHeader('Access-Control-Allow-Origin', '*');
  // output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  return output;
}

// ✅ NOVO: Helper funkcija za testiranje (opciono)
function testAPI() {
  // Test login
  const loginResult = handleLogin('admin', 'admin123');
  Logger.log('Login test: ' + loginResult.getContent());

  // Test stats
  const statsResult = handleStats('2024', 'admin', 'admin123');
  Logger.log('Stats test: ' + statsResult.getContent());
}
