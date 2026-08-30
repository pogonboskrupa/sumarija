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
    const serialized = JSON.stringify(data);
    // CacheService ima tvrdo ograničenje ~100KB po ključu i put() baca grešku
    // preko toga. Veliki odgovori (primke/otpreme — više MB) tu jednostavno
    // ne mogu stati, pa se preskaču bez pokušaja umjesto da svaki poziv
    // završi u catch-u i zatrpa log lažnim greškama. Njih ionako kešira
    // frontend (IndexedDB, vidi IDB_LARGE_KEYS u js/app.js).
    if (serialized.length > 90000) {
      Logger.log(`[CACHE] SKIP (prevelik, ${Math.round(serialized.length / 1024)}KB): ${key}`);
      return false;
    }
    const cache = CacheService.getScriptCache();
    cache.put(key, serialized, ttl);
    Logger.log(`[CACHE] SET: ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    Logger.log(`[CACHE] Error writing cache for ${key}: ${error}`);
    return false;
  }
}

// Svi keš ključevi koje handleri koriste. Apps Script CacheService NEMA
// brisanje po prefiksu ni nabrajanje ključeva, pa se lista mora držati
// eksplicitno — zato je ovdje na jednom mjestu.
//
// VAŽNO: ranija verzija je zvala cache.removeAll() BEZ argumenta. Taj metod
// po Apps Script API-ju zahtijeva niz ključeva, pa je poziv bacao grešku koju
// je catch ispod gutao i samo logovao — invalidacija zapravo NIJE radila.
// Posljedica: nakon unosa sječe/otpreme keš se nije čistio i korisnik je do
// 3 minute (CACHE_TTL) mogao gledati stanje bez svog unosa.
// Tekući i prošli mjesec (0-indeksirano, isti obrazac kao parametri koje
// handleri primaju) — dovoljno da pokrije i unos koji poslovođa naknadno
// doda za prethodni mjesec. Tekuća/prošla godina se rješava odvojeno.
function _mjeseciZaInvalidaciju() {
  var d = new Date();
  var m1 = d.getMonth();
  var y1 = d.getFullYear();
  var m0 = m1 - 1, y0 = y1;
  if (m0 < 0) { m0 = 11; y0 = y1 - 1; }
  return [{ y: y1, m: m1 }, { y: y0, m: m0 }];
}

// Dinamike izvođača (dinamike-izvodjaca.gs) keširaju po IZABRANOM mjesecu
// (0-11) + 'zadnji' fallback (stariji poziv bez mjesec parametra) — do 13
// mogućih ključeva po godini, pa se generišu ovom pomoćnom funkcijom
// umjesto nabrajanja jednog fiksnog ključa.
function _dinamikeIzvodjacaKljucevi(godina) {
  var kljucevi = ['dinamike_izvodjaca_v5_' + godina + '_zadnji'];
  for (var m = 0; m < 12; m++) kljucevi.push('dinamike_izvodjaca_v5_' + godina + '_' + m);
  return kljucevi;
}

function _sviCacheKljucevi() {
  var kljucevi = [];
  var now = new Date().getFullYear();
  // Tekuća i prošla godina — jedine koje aplikacija traži (vidi preloadAllViews)
  [now, now - 1].forEach(function (y) {
    kljucevi.push(
      'dashboard_' + y, 'primaci_' + y, 'otpremaci_' + y, 'kupci_' + y,
      'mjesecni_sortimenti_' + y, 'stats_' + y, 'dinamika_' + y,
      'primaci_radiliste_' + y, 'otpremaci_radiliste_' + y, 'primaci_izvodjac_v2_' + y
    );
    kljucevi = kljucevi.concat(_dinamikeIzvodjacaKljucevi(y));
  });
  kljucevi.push('odjeli_alltime', 'primke_all', 'otpreme_all', 'stanje_zaliha_all');
  _mjeseciZaInvalidaciju().forEach(function (mj) {
    kljucevi.push(
      'primaci_daily_' + mj.y + '_' + mj.m, 'otpremaci_daily_' + mj.y + '_' + mj.m,
      'daily_chart_' + mj.y + '_' + mj.m,
      'primaci_sort_primac_' + mj.y + '_' + mj.m, 'otpremaci_sort_otpremac_' + mj.y + '_' + mj.m
    );
  });
  return kljucevi;
}

function invalidateAllCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(_sviCacheKljucevi());
    Logger.log('[CACHE] Invalidated all known cache entries');
    return true;
  } catch (error) {
    Logger.log(`[CACHE] Error invalidating cache: ${error}`);
    return false;
  }
}

// Ciljano brisanje — nakon unosa sječe nema razloga rušiti keš kupaca ili
// dinamike. Manje bespotrebnih hladnih čitanja = manje opterećenja na Sheets.
// Ključevi vezani za poslovođu (stanje_zaliha_<ime>) se namjerno ne nabrajaju:
// ne mogu se enumerisati, a CACHE_TTL je ionako samo 180s pa zastarjelost
// traje najviše toliko.
function invalidateCacheZa(tip) {
  try {
    const cache = CacheService.getScriptCache();
    const now = new Date().getFullYear();
    const y = [now, now - 1];
    let kljucevi = [];

    if (tip === 'sjeca' || tip === 'otprema') {
      y.forEach(function (g) {
        kljucevi.push('dashboard_' + g, 'mjesecni_sortimenti_' + g, 'stats_' + g, 'dinamika_' + g);
        kljucevi.push(tip === 'sjeca' ? 'primaci_' + g : 'otpremaci_' + g);
        kljucevi.push(tip === 'sjeca' ? 'primaci_radiliste_' + g : 'otpremaci_radiliste_' + g);
        if (tip === 'sjeca') kljucevi.push('primaci_izvodjac_v2_' + g);
        if (tip === 'otprema') kljucevi.push('kupci_' + g);
        kljucevi = kljucevi.concat(_dinamikeIzvodjacaKljucevi(g));
      });
      kljucevi.push('odjeli_alltime', 'stanje_zaliha_all');
      kljucevi.push(tip === 'sjeca' ? 'primke_all' : 'otpreme_all');
      _mjeseciZaInvalidaciju().forEach(function (mj) {
        kljucevi.push('daily_chart_' + mj.y + '_' + mj.m);
        kljucevi.push(tip === 'sjeca' ? 'primaci_daily_' + mj.y + '_' + mj.m : 'otpremaci_daily_' + mj.y + '_' + mj.m);
        kljucevi.push(tip === 'sjeca' ? 'primaci_sort_primac_' + mj.y + '_' + mj.m : 'otpremaci_sort_otpremac_' + mj.y + '_' + mj.m);
      });
    } else {
      // Nepoznat tip — sigurnije je očistiti sve poznato nego pogoditi krivo
      kljucevi = _sviCacheKljucevi();
    }

    cache.removeAll(kljucevi);
    Logger.log('[CACHE] Invalidated (' + tip + '): ' + kljucevi.length + ' kljuceva');
    return true;
  } catch (error) {
    Logger.log(`[CACHE] Error invalidating cache for ${tip}: ${error}`);
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
