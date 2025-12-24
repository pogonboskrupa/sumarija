// Google Apps Script za Šumarija API
// Deploy kao Web App: Deploy > New deployment > Web app

// ⚠️ VAŽNO: Postavi svoje Spreadsheet ID-ove ovdje
const KORISNICI_SPREADSHEET_ID = '1rpl0RiqsE6lrU9uDMTjf127By7b951rP3a5Chis9qwg'; // SUMARIJA_KORISNICI
const INDEX_SPREADSHEET_ID = '1nPkSx2fCbtHGcwdq8rDo9A3dsSt9QpcF7f0JBCg1K1I';     // SUMARIJA_INDEX
const ODJELI_FOLDER_ID = '1NQ0s_F4j9iRDaZafexzP5Bwyv0NXfMMK';                      // Folder sa svim odjelima

// Glavni handler za sve zahtjeve
function doGet(e) {
  try {
    const path = e.parameter.path;

    if (path === 'login') {
      return handleLogin(e.parameter.username, e.parameter.password);
    } else if (path === 'stats') {
      return handleStats(e.parameter.year, e.parameter.username, e.parameter.password);
    }

    return createJsonResponse({ error: 'Unknown path' }, false);
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, false);
  }
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

// Procesiranje podataka o projektima (U11 i U12)
function processOdjeliDetails(primkaSheet, stats) {
  // Pretpostavljam da svaki odjel ima svoj red na PRIMKA sheet-u
  // gdje je U11 projektovana masa, a U12 ukupno posjeklo

  const data = primkaSheet.getDataRange().getValues();

  // VAŽNO: Prilagodi ovu logiku prema stvarnoj strukturi tvog sheet-a
  // Ovaj primjer pretpostavlja da svaki odjel ima "summary" red

  for (let odjel in stats.odjeliStats) {
    // Pronađi red za ovaj odjel
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const odjelNaziv = row[1]; // kolona B - naziv odjela

      if (odjelNaziv === odjel) {
        // U11 = kolona U = indeks 20
        // U12 = kolona V = indeks 21
        const projekat = parseFloat(row[20]) || 0; // U11
        const ukupnoPosjeklo = parseFloat(row[21]) || 0; // U12

        stats.odjeliStats[odjel].projekat = projekat;
        stats.odjeliStats[odjel].ukupnoPosjeklo = ukupnoPosjeklo;
        break;
      }
    }
  }

  // Alternativa: Ako U11 i U12 su u posebnom sheet-u ili posebnoj lokaciji
  // možeš koristiti getRange() direktno:
  // const projekat = primkaSheet.getRange('U11').getValue();
  // const ukupnoPosjeklo = primkaSheet.getRange('U12').getValue();
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

              // Preskači header redove
              const datumStr = String(datum);
              const primacStr = String(primac);
              if (datumStr.includes('OPIS') || datumStr.includes('#') ||
                  datumStr.includes('PLAN') || datumStr.includes('REAL') ||
                  datumStr.includes('DATUM') || datumStr.includes('datum') ||
                  primacStr.includes('primac') || primacStr.includes('PRIMAC')) {
                if (processedCount === 1 && i <= 20) Logger.log(`      → Skip: header`);
                continue;
              }

              // Dodaj red: [ODJEL, DATUM(B), PRIMAČ(C), ...sortimenti(D-U)]
              const newRow = [odjelNaziv, datum, primac, ...row.slice(3)];
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

              // Preskači header redove
              const datumStr = String(datum);
              if (datumStr.includes('OPIS') || datumStr.includes('#') ||
                  datumStr.includes('PLAN') || datumStr.includes('REAL') ||
                  datumStr.includes('datum') || datumStr.includes('KUPCI') ||
                  datumStr.includes('UČINCI')) {
                if (processedCount === 1 && i <= 20) Logger.log(`      → Skip: header`);
                continue;
              }

              // Kreiraj novi red za INDEX: [odjel, datum(B), otpremač(C), ...sortimenti(D-U), kupac(A)]
              const newRow = [odjelNaziv, datum, otpremac, ...row.slice(3), kupac];
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
