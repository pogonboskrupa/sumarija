// ============================================
// SERVICES.GS - Business Logic & Data Processing
// ============================================
// Sadrži: Cache management, data processing, sync operations, dinamika

// ========================================
// DINAMIKA HELPER
// ========================================

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

// ========================================
// DATA PROCESSING - PRIMKA & OTPREMA
// ========================================

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

// ========================================
// CACHESERVICE - In-Memory Caching for 10-20x Speed Boost
// ========================================

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
