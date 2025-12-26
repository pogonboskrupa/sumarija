// Google Apps Script za Šumarija API
// Deploy kao Web App: Deploy > New deployment > Web app

// ⚠️ VAŽNO: Postavi svoje Spreadsheet ID-ove ovdje
const KORISNICI_SPREADSHEET_ID = '1rpl0RiqsE6lrU9uDMTjf127By7b951rP3a5Chis9qwg'; // SUMARIJA_KORISNICI
const INDEX_SPREADSHEET_ID = '1nPkSx2fCbtHGcwdq8rDo9A3dsSt9QpcF7f0JBCg1K1I';     // SUMARIJA_INDEX
const ODJELI_FOLDER_ID = '1NQ0s_F4j9iRDaZafexzP5Bwyv0NXfMMK';                      // Folder sa svim odjelima

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

// Dinamika po mjesecima (plan 2025) - može se ažurirati za 2026
const DINAMIKA_2025 = [788, 2389, 6027, 5597, 6977, 6934, 7336, 6384, 6997, 7895, 5167, 2016];

// Glavni handler za sve zahtjeve
function doGet(e) {
  try {
    const path = e.parameter.path;

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
      return handlePrimacOdjeli(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'otpremac-odjeli') {
      return handleOtpremacOdjeli(e.parameter.year, e.parameter.username, e.parameter.password);
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
    } else if (path === 'primaci-by-radiliste') {
      return handlePrimaciByRadiliste(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'primaci-by-izvodjac') {
      return handlePrimaciByIzvodjac(e.parameter.year, e.parameter.username, e.parameter.password);
    } else if (path === 'otpremaci-by-radiliste') {
      return handleOtremaciByRadiliste(e.parameter.year, e.parameter.username, e.parameter.password);
    }

    return createJsonResponse({ error: 'Unknown path' }, false);
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, false);
  }
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

    const datumObj = new Date(datum);
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

    const datumObj = new Date(datum);
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

// Pomoćna funkcija za JSON response
function createJsonResponse(data, success) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
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

    // 1.5. Dodaj header-e za Radilište i Izvođač ako ne postoje
    Logger.log('Provjera header-a za Radilište i Izvođač...');

    // INDEX_PRIMKA: A-U (21 kolona) → dodaj V=Radilište, W=Izvođač
    const primkaLastCol = indexPrimkaSheet.getLastColumn();
    if (primkaLastCol < 22) { // Ako nema kolonu V (22)
      Logger.log(`INDEX_PRIMKA: Dodavanje header-a Radilište (V) i Izvođač (W)`);
      indexPrimkaSheet.getRange("V1").setValue("Radilište");
      indexPrimkaSheet.getRange("W1").setValue("Izvođač");
    } else {
      Logger.log(`INDEX_PRIMKA: Header-i već postoje (kolone: ${primkaLastCol})`);
    }

    // INDEX_OTPREMA: A-V (22 kolone, V=KUPAC) → dodaj samo W=Radilište (Izvođač se NE koristi za OTPREMU)
    const otpremaLastCol = indexOtpremaSheet.getLastColumn();
    if (otpremaLastCol < 22) { // Ako nema kolonu W (22)
      Logger.log(`INDEX_OTPREMA: Dodavanje header-a Radilište (W)`);
      indexOtpremaSheet.getRange("W1").setValue("Radilište");
    } else {
      Logger.log(`INDEX_OTPREMA: Header već postoji (kolone: ${otpremaLastCol})`);
    }

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

        // ✨ PROČITAJ RADILIŠTE (W2) I IZVOĐAČ (W3) IZ PRIMKA sheet-a PRVO (van if bloka da bude dostupno i za OTPREMU)
        let radiliste = "";
        let izvodjac = "";

        const primkaSheet = ss.getSheetByName('PRIMKA');
        if (primkaSheet) {
          radiliste = primkaSheet.getRange("W2").getValue() || "";
          izvodjac = primkaSheet.getRange("W3").getValue() || "";
          Logger.log(`  PRIMKA: Radilište="${radiliste}", Izvođač="${izvodjac}"`);

          const lastRow = primkaSheet.getLastRow();
          Logger.log(`  PRIMKA: ${lastRow} redova (total)`);

          if (lastRow > 1) {
            const data = primkaSheet.getDataRange().getValues();
            let addedRows = 0;

            // PRIMKA struktura: PRAZNA(A) | DATUM(B) | PRIMAČ(C) | sortimenti(D-U)
            // INDEX treba: odjel | datum | primač | sortimenti | radilište | izvođač
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

              // Dodaj red: [ODJEL, DATUM(B), PRIMAČ(C), ...sortimenti(D-U 18 kolona), RADILIŠTE(W2), IZVOĐAČ(W3)]
              // Eksplicitno uzmi samo 18 kolona sortimenti (D-U = indeksi 3-20)
              const sortimenti = row.slice(3, 21); // D-U (18 kolona)
              const newRow = [odjelNaziv, datum, primac, ...sortimenti, radiliste, izvodjac];
              primkaRows.push(newRow);
              addedRows++;

              if (processedCount === 1 && addedRows <= 3) {
                Logger.log(`      ✓ Dodano red ${addedRows}: "${odjelNaziv}" | "${datum}" | "${primac}" | radilište="${radiliste}" | izvođač="${izvodjac}"`);
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

          // ✨ PROČITAJ RADILIŠTE iz PRIMKA sheet-a (W2) - ISTI kao za sječu
          // Izvođač se NE koristi za OTPREMU
          const radilisteOtprema = radiliste; // Koristi radilište iz PRIMKA (pročitano na liniji 462)
          Logger.log(`  OTPREMA: Radilište="${radilisteOtprema}" (iz PRIMKA)`);

          if (lastRow > 1) {
            const data = otpremaSheet.getDataRange().getValues();
            let addedRows = 0;

            // OTPREMA struktura: kupci(A) | datum(B) | otpremač(C) | sortimenti(D-U)
            // INDEX treba: odjel | datum | otpremač | sortimenti | kupac | radilište | izvođač
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

              // Kreiraj novi red za INDEX: [odjel, datum(B), otpremač(C), ...sortimenti(D-U 18 kolona), kupac(A), radilište]
              // Eksplicitno uzmi samo 18 kolona sortimenti (D-U = indeksi 3-20)
              const sortimenti = row.slice(3, 21); // D-U (18 kolona)
              const newRow = [odjelNaziv, datum, otpremac, ...sortimenti, kupac, radilisteOtprema];
              otpremaRows.push(newRow);
              addedRows++;

              if (processedCount === 1 && addedRows <= 3) {
                Logger.log(`      ✓ Dodano red ${addedRows}: "${odjelNaziv}" | "${datum}" | "${otpremac}" | kupac="${kupac}" | radilište="${radilisteOtprema}"`);
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
      const dateA = new Date(a[1]);
      const dateB = new Date(b[1]);
      return dateA - dateB;
    });

    otpremaRows.sort((a, b) => {
      const dateA = new Date(a[1]);
      const dateB = new Date(b[1]);
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

  const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
  const primkaSheet = ss.getSheetByName("INDEX_PRIMKA");
  const otpremaSheet = ss.getSheetByName("INDEX_OTPREMA");

  if (!primkaSheet || !otpremaSheet) {
    return createJsonResponse({ error: "INDEX sheets not found" }, false);
  }

  const primkaData = primkaSheet.getDataRange().getValues();
  const otpremaData = otpremaSheet.getDataRange().getValues();

  const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
  const dinamika = DINAMIKA_2025;

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

    const datumObj = new Date(datum);
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

    const datumObj = new Date(datum);
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

  return createJsonResponse({
    mjesecnaStatistika: mjesecnaStatistika,
    odjeli: odjeliPrikaz
  }, true);
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

    const datumObj = new Date(datum);
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

    const datumObj = new Date(datum);
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

    const datumObj = new Date(datum);
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

  return createJsonResponse({
    mjeseci: mjeseci,
    primaci: primaciPrikaz
  }, true);
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

    const datumObj = new Date(datum);
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

  return createJsonResponse({
    mjeseci: mjeseci,
    otpremaci: otpremaciPrikaz
  }, true);
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

    const datumObj = new Date(datum);
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

  return createJsonResponse({
    sortimentiNazivi: sortimentiNazivi,
    godisnji: godisnji,
    mjesecni: mjesecni
  }, true);
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
                const datumObj = new Date(datum);

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

    const datumObj = new Date(datum);
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

    const datumObj = new Date(datum);
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
function handlePrimacOdjeli(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  const userFullName = loginResult.fullName;

  Logger.log('=== HANDLE PRIMAC ODJELI START ===');
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

  // Map: odjelNaziv -> { sortimenti: {}, ukupno: 0, zadnjiDatum: Date }
  const odjeliMap = {};

  // Procesiranje PRIMKA podataka - filtrirati samo za ovog primača
  for (let i = 1; i < primkaData.length; i++) {
    const row = primkaData[i];
    const odjel = row[0];     // A - ODJEL
    const datum = row[1];     // B - DATUM
    const primac = row[2];    // C - PRIMAČ
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

    if (!datum || !primac || !odjel) continue;

    const datumObj = new Date(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    // Filtriraj samo unose za ovog primača
    if (String(primac).trim() !== userFullName) continue;

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
      zadnjiDatumStr: odjel.zadnjiDatum ? formatDate(odjel.zadnjiDatum) : ''
    });
  }

  // Sortiraj po zadnjem datumu (najnoviji prvo)
  odjeliArray.sort((a, b) => {
    if (!a.zadnjiDatum && !b.zadnjiDatum) return 0;
    if (!a.zadnjiDatum) return 1;
    if (!b.zadnjiDatum) return -1;
    return b.zadnjiDatum - a.zadnjiDatum;
  });

  // Ukloni zadnjiDatum objekt (ostavi samo string)
  const odjeliResult = odjeliArray.map(o => ({
    odjel: o.odjel,
    sortimenti: o.sortimenti,
    ukupno: o.ukupno,
    zadnjiDatum: o.zadnjiDatumStr
  }));

  Logger.log('=== HANDLE PRIMAC ODJELI END ===');
  Logger.log(`Ukupno odjela: ${odjeliResult.length}`);

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
function handleOtpremacOdjeli(year, username, password) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  const userFullName = loginResult.fullName;

  Logger.log('=== HANDLE OTPREMAC ODJELI START ===');
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

  // Map: odjelNaziv -> { sortimenti: {}, ukupno: 0, zadnjiDatum: Date }
  const odjeliMap = {};

  // Procesiranje OTPREMA podataka - filtrirati samo za ovog otpremača
  for (let i = 1; i < otpremaData.length; i++) {
    const row = otpremaData[i];
    const odjel = row[0];       // A - ODJEL
    const datum = row[1];       // B - DATUM
    const otpremac = row[2];    // C - OTPREMAČ
    const kubik = parseFloat(row[20]) || 0; // U - SVEUKUPNO

    if (!datum || !otpremac || !odjel) continue;

    const datumObj = new Date(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

    // Filtriraj samo unose za ovog otpremača
    if (String(otpremac).trim() !== userFullName) continue;

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
      zadnjiDatumStr: odjel.zadnjiDatum ? formatDate(odjel.zadnjiDatum) : ''
    });
  }

  // Sortiraj po zadnjem datumu (najnoviji prvo)
  odjeliArray.sort((a, b) => {
    if (!a.zadnjiDatum && !b.zadnjiDatum) return 0;
    if (!a.zadnjiDatum) return 1;
    if (!b.zadnjiDatum) return -1;
    return b.zadnjiDatum - a.zadnjiDatum;
  });

  // Ukloni zadnjiDatum objekt (ostavi samo string)
  const odjeliResult = odjeliArray.map(o => ({
    odjel: o.odjel,
    sortimenti: o.sortimenti,
    ukupno: o.ukupno,
    zadnjiDatum: o.zadnjiDatumStr
  }));

  Logger.log('=== HANDLE OTPREMAC ODJELI END ===');
  Logger.log(`Ukupno odjela: ${odjeliResult.length}`);

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
      new Date(params.datum), // B - DATUM
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
      new Date(params.datum), // B - DATUM
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

        const datumObj = new Date(datum);
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

        const datumObj = new Date(datum);
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

      const datumObj = new Date(datum);
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

      const datumObj = new Date(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11

      // Kolone D-U (indeksi 3-20) = sortimenti
      for (let j = 0; j < sortimentiNazivi.length; j++) {
        const vrijednost = parseFloat(row[3 + j]) || 0;
        otpremaMjeseci[mjesec][sortimentiNazivi[j]] += vrijednost;
      }
    }

    Logger.log('=== HANDLE MJESECNI SORTIMENTI END ===');

    return createJsonResponse({
      sjeca: {
        sortimenti: sortimentiNazivi,
        mjeseci: sjecaMjeseci
      },
      otprema: {
        sortimenti: sortimentiNazivi,
        mjeseci: otpremaMjeseci
      }
    }, true);

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

      const datumObj = new Date(datum);
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

      const datumObj = new Date(datum);
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
// RADILIŠTA I IZVOĐAČI API ENDPOINTS
// ========================================

/**
 * Prikaz primaka po radilištima - mjesečni sortimenti + godišnja rekapitulacija
 */
function handlePrimaciByRadiliste(year, username, password) {
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
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI"
    ];

    // Grupisanje po radilištima
    const radilistaMap = {};

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[0];
      const datum = row[1];

      // ✨ ČITAJ RADILIŠTE IZ KOLONE V (indeks 21)
      const radiliste = row[21] || "Nepoznato radilište";

      if (!datum || !odjel) continue;

      const datumObj = new Date(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11

      // Inicijalizuj strukturu ako ne postoji
      if (!radilistaMap[radiliste]) {
        radilistaMap[radiliste] = {
          naziv: radiliste,
          mjeseci: Array(12).fill(0), // 12 mjeseci
          sortimenti: {}
        };

        // Inicijalizuj sortimente
        sortimentiNazivi.forEach(s => {
          radilistaMap[radiliste].sortimenti[s] = Array(12).fill(0);
        });
      }

      // Akumuliraj podatke - čitaj sortimente iz kolona D-U (indeksi 3-20)
      sortimentiNazivi.forEach((sortiment, idx) => {
        const value = parseFloat(row[3 + idx]) || 0;
        radilistaMap[radiliste].sortimenti[sortiment][mjesec] += value;
        radilistaMap[radiliste].mjeseci[mjesec] += value;
      });
    }

    // Konvertuj u array i dodaj ukupne sume
    const radilistaArray = Object.values(radilistaMap).map(radiliste => {
      const ukupno = radiliste.mjeseci.reduce((sum, val) => sum + val, 0);

      // Ukupno po sortimentima (godišnja rekapitulacija)
      const sortimentiUkupno = {};
      sortimentiNazivi.forEach(s => {
        sortimentiUkupno[s] = radiliste.sortimenti[s].reduce((sum, val) => sum + val, 0);
      });

      return {
        naziv: radiliste.naziv,
        mjeseci: radiliste.mjeseci,
        sortimenti: radiliste.sortimenti,
        sortimentiUkupno: sortimentiUkupno,
        ukupno: ukupno
      };
    });

    // Sortiraj po ukupnoj količini (descending)
    radilistaArray.sort((a, b) => b.ukupno - a.ukupno);

    return createJsonResponse({
      radilista: radilistaArray,
      sortimentiNazivi: sortimentiNazivi
    }, true);

  } catch (error) {
    return createJsonResponse({
      error: "Greška pri učitavanju podataka po radilištima: " + error.toString()
    }, false);
  }
}

/**
 * Prikaz primaka po izvođačima - mjesečni sortimenti + godišnja rekapitulacija
 */
function handlePrimaciByIzvodjac(year, username, password) {
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
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI"
    ];

    // Grupisanje po izvođačima
    const izvodjaciMap = {};

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[0];
      const datum = row[1];

      // ✨ ČITAJ IZVOĐAČ IZ KOLONE W (indeks 22)
      const izvodjac = row[22] || "Nepoznati izvođač";

      if (!datum || !odjel) continue;

      const datumObj = new Date(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11

      // Inicijalizuj strukturu ako ne postoji
      if (!izvodjaciMap[izvodjac]) {
        izvodjaciMap[izvodjac] = {
          naziv: izvodjac,
          mjeseci: Array(12).fill(0),
          sortimenti: {}
        };

        // Inicijalizuj sortimente
        sortimentiNazivi.forEach(s => {
          izvodjaciMap[izvodjac].sortimenti[s] = Array(12).fill(0);
        });
      }

      // Akumuliraj podatke - čitaj sortimente iz kolona D-U (indeksi 3-20)
      sortimentiNazivi.forEach((sortiment, idx) => {
        const value = parseFloat(row[3 + idx]) || 0;
        izvodjaciMap[izvodjac].sortimenti[sortiment][mjesec] += value;
        izvodjaciMap[izvodjac].mjeseci[mjesec] += value;
      });
    }

    // Konvertuj u array i dodaj ukupne sume
    const izvodjaciArray = Object.values(izvodjaciMap).map(izvodjac => {
      const ukupno = izvodjac.mjeseci.reduce((sum, val) => sum + val, 0);

      // Ukupno po sortimentima
      const sortimentiUkupno = {};
      sortimentiNazivi.forEach(s => {
        sortimentiUkupno[s] = izvodjac.sortimenti[s].reduce((sum, val) => sum + val, 0);
      });

      return {
        naziv: izvodjac.naziv,
        mjeseci: izvodjac.mjeseci,
        sortimenti: izvodjac.sortimenti,
        sortimentiUkupno: sortimentiUkupno,
        ukupno: ukupno
      };
    });

    // Sortiraj po ukupnoj količini
    izvodjaciArray.sort((a, b) => b.ukupno - a.ukupno);

    return createJsonResponse({
      izvodjaci: izvodjaciArray,
      sortimentiNazivi: sortimentiNazivi
    }, true);

  } catch (error) {
    return createJsonResponse({
      error: "Greška pri učitavanju podataka po izvođačima: " + error.toString()
    }, false);
  }
}

/**
 * Prikaz otpreme po radilištima - mjesečni sortimenti + godišnja rekapitulacija
 */
function handleOtremaciByRadiliste(year, username, password) {
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
      "OGR.DUGI", "OGR.CIJEPANI", "LIŠĆARI"
    ];

    // Grupisanje po radilištima
    const radilistaMap = {};

    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const odjel = row[0];
      const datum = row[1];

      // ✨ ČITAJ RADILIŠTE IZ KOLONE W (indeks 22)
      const radiliste = row[22] || "Nepoznato radilište";

      if (!datum || !odjel) continue;

      const datumObj = new Date(datum);
      if (datumObj.getFullYear() !== parseInt(year)) continue;

      const mjesec = datumObj.getMonth(); // 0-11

      // Inicijalizuj strukturu ako ne postoji
      if (!radilistaMap[radiliste]) {
        radilistaMap[radiliste] = {
          naziv: radiliste,
          mjeseci: Array(12).fill(0),
          sortimenti: {}
        };

        // Inicijalizuj sortimente
        sortimentiNazivi.forEach(s => {
          radilistaMap[radiliste].sortimenti[s] = Array(12).fill(0);
        });
      }

      // Akumuliraj podatke - čitaj sortimente iz kolona D-U (indeksi 3-20)
      sortimentiNazivi.forEach((sortiment, idx) => {
        const value = parseFloat(row[3 + idx]) || 0;
        radilistaMap[radiliste].sortimenti[sortiment][mjesec] += value;
        radilistaMap[radiliste].mjeseci[mjesec] += value;
      });
    }

    // Konvertuj u array i dodaj ukupne sume
    const radilistaArray = Object.values(radilistaMap).map(radiliste => {
      const ukupno = radiliste.mjeseci.reduce((sum, val) => sum + val, 0);

      // Ukupno po sortimentima
      const sortimentiUkupno = {};
      sortimentiNazivi.forEach(s => {
        sortimentiUkupno[s] = radiliste.sortimenti[s].reduce((sum, val) => sum + val, 0);
      });

      return {
        naziv: radiliste.naziv,
        mjeseci: radiliste.mjeseci,
        sortimenti: radiliste.sortimenti,
        sortimentiUkupno: sortimentiUkupno,
        ukupno: ukupno
      };
    });

    // Sortiraj po ukupnoj količini
    radilistaArray.sort((a, b) => b.ukupno - a.ukupno);

    return createJsonResponse({
      radilista: radilistaArray,
      sortimentiNazivi: sortimentiNazivi
    }, true);

  } catch (error) {
    return createJsonResponse({
      error: "Greška pri učitavanju podataka otpreme po radilištima: " + error.toString()
    }, false);
  }
}

