// ========================================
// 📊 SERVICES - Data Processing, Cache, Sync
// ========================================

// ========================================
// 1. DATA PROCESSING FUNKCIJE
// ========================================

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
