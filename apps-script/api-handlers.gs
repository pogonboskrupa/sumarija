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
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  // Admin provjera - tip iz kolone D (case-insensitive) ili hardcoded admin credentials
  var userType = String(loginResult.type || '').trim().toLowerCase();
  if (userType !== 'admin' && username !== ADMIN_USERNAME) {
    Logger.log('Admin check failed: type=' + loginResult.type + ', username=' + username);
    return createJsonResponse({ error: "Samo admin može koristiti ovaj endpoint" }, false);
  }

  if (!primacName) {
    return createJsonResponse({ error: "Parametar primacName je obavezan" }, false);
  }

  Logger.log('=== HANDLE PRIMAC DETAIL ADMIN START ===');
  Logger.log('Primac: ' + primacName);
  Logger.log('Year: ' + year);

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

    // Filtriraj po izabranom primacu (case-insensitive)
    if (String(primac).trim().toLowerCase() !== String(primacName).trim().toLowerCase()) continue;

    const sortimenti = {};
    for (let j = 0; j < 20; j++) {
      const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
      sortimenti[SORTIMENTI_NAZIVI[j]] = vrijednost;
    }

    unosi.push({
      datum: formatDate(datumObj),
      datumObj: datumObj,
      odjel: odjel,
      radiliste: radiliste,
      izvodjac: izvodjac,
      primac: String(primac).trim(),
      sortimenti: sortimenti,
      ukupno: kubik
    });
  }

  unosi.sort((a, b) => b.datumObj - a.datumObj);

  const unosiResult = unosi.map(u => ({
    datum: u.datum,
    odjel: u.odjel,
    radiliste: u.radiliste,
    izvodjac: u.izvodjac,
    primac: u.primac,
    sortimenti: u.sortimenti,
    ukupno: u.ukupno
  }));

  Logger.log('=== HANDLE PRIMAC DETAIL ADMIN END ===');
  Logger.log('Ukupno unosa: ' + unosiResult.length);

  return createJsonResponse({
    sortimentiNazivi: SORTIMENTI_NAZIVI,
    unosi: unosiResult
  }, true);
}

// ========================================
// ADMIN: PRIMAC ODJELI - Prikaz po odjelima za izabranog primača (admin only)
// ========================================
function handlePrimacOdjeliAdmin(year, username, password, primacName, limit) {
  // Autentikacija
  const loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) {
    return createJsonResponse({ error: "Unauthorized" }, false);
  }

  // Admin provjera - tip iz kolone D (case-insensitive) ili hardcoded admin credentials
  var userType = String(loginResult.type || '').trim().toLowerCase();
  if (userType !== 'admin' && username !== ADMIN_USERNAME) {
    Logger.log('Admin check failed: type=' + loginResult.type + ', username=' + username);
    return createJsonResponse({ error: "Samo admin može koristiti ovaj endpoint" }, false);
  }

  if (!primacName) {
    return createJsonResponse({ error: "Parametar primacName je obavezan" }, false);
  }

  const odjeliLimit = limit ? parseInt(limit) : 15;

  Logger.log('=== HANDLE PRIMAC ODJELI ADMIN START ===');
  Logger.log('Primac: ' + primacName);
  Logger.log('Limit: ' + odjeliLimit);

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

    // Case-insensitive matching
    if (String(primac).trim().toLowerCase() !== String(primacName).trim().toLowerCase()) continue;

    if (!odjeliMap[odjel]) {
      odjeliMap[odjel] = { sortimenti: {}, ukupno: 0, zadnjiDatum: null };
      for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
        odjeliMap[odjel].sortimenti[SORTIMENTI_NAZIVI[s]] = 0;
      }
    }

    for (let j = 0; j < 20; j++) {
      const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
      odjeliMap[odjel].sortimenti[SORTIMENTI_NAZIVI[j]] += vrijednost;
    }

    odjeliMap[odjel].ukupno += kubik;

    if (!odjeliMap[odjel].zadnjiDatum || datumObj > odjeliMap[odjel].zadnjiDatum) {
      odjeliMap[odjel].zadnjiDatum = datumObj;
    }
  }

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

  odjeliArray.sort((a, b) => {
    if (!a.zadnjiDatum && !b.zadnjiDatum) return 0;
    if (!a.zadnjiDatum) return 1;
    if (!b.zadnjiDatum) return -1;
    return b.zadnjiDatum - a.zadnjiDatum;
  });

  const topOdjeli = odjeliArray.slice(0, odjeliLimit);

  const odjeliResult = topOdjeli.map(o => ({
    odjel: o.odjel,
    sortimenti: o.sortimenti,
    ukupno: o.ukupno,
    zadnjiDatum: o.zadnjiDatumStr,
    godina: o.godina
  }));

  Logger.log('=== HANDLE PRIMAC ODJELI ADMIN END ===');
  Logger.log('Total odjeli: ' + odjeliArray.length + ', vraćeno: ' + odjeliResult.length);

  return createJsonResponse({
    sortimentiNazivi: SORTIMENTI_NAZIVI,
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
// HANDLE ODJELI ALL - Pregled po odjelima za sve primače (admin), sve godine
// ========================================
function handleOdjeliAll(year, username, password) {
  try {
    const loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) {
      return createJsonResponse({ error: "Unauthorized" }, false);
    }

    var userType = String(loginResult.type || '').trim().toLowerCase();
    if (userType !== 'admin' && username !== ADMIN_USERNAME) {
      return createJsonResponse({ error: "Samo admin može koristiti ovaj endpoint" }, false);
    }

    Logger.log('=== HANDLE ODJELI ALL START ===');

    const ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    const primkaSheet = ss.getSheetByName("INDEKS_PRIMKA");

    if (!primkaSheet) {
      return createJsonResponse({ error: "INDEKS_PRIMKA sheet not found" }, false);
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const odjeliMap = {};

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const datum = row[PRIMKA_COL.DATE];
      const primac = row[PRIMKA_COL.RADNIK];
      const odjel = row[PRIMKA_COL.ODJEL];
      const kubik = parseFloat(row[PRIMKA_COL.UKUPNO]) || 0;

      if (!datum || !odjel) continue;

      const datumObj = parseDate(datum);
      const odjelStr = String(odjel);

      if (!odjeliMap[odjelStr]) {
        odjeliMap[odjelStr] = { sortimenti: {}, ukupno: 0, primaci: {}, zadnjiDatum: null };
        for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
          odjeliMap[odjelStr].sortimenti[SORTIMENTI_NAZIVI[s]] = 0;
        }
      }

      // Prati zadnji datum sječe
      if (!odjeliMap[odjelStr].zadnjiDatum || datumObj > odjeliMap[odjelStr].zadnjiDatum) {
        odjeliMap[odjelStr].zadnjiDatum = datumObj;
      }

      // Agregiraj sortimente odjela
      for (let j = 0; j < 20; j++) {
        const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
        odjeliMap[odjelStr].sortimenti[SORTIMENTI_NAZIVI[j]] += vrijednost;
      }

      // Ukupno iz UKUPNO kolone
      odjeliMap[odjelStr].ukupno += kubik;

      // Primači po odjelu - sa sortimentima
      var primacStr = String(primac || '').trim();
      if (primacStr) {
        if (!odjeliMap[odjelStr].primaci[primacStr]) {
          odjeliMap[odjelStr].primaci[primacStr] = { sortimenti: {}, ukupno: 0 };
          for (let s = 0; s < SORTIMENTI_NAZIVI.length; s++) {
            odjeliMap[odjelStr].primaci[primacStr].sortimenti[SORTIMENTI_NAZIVI[s]] = 0;
          }
        }
        for (let j = 0; j < 20; j++) {
          const vrijednost = parseFloat(row[PRIMKA_COL.SORT_START + j]) || 0;
          odjeliMap[odjelStr].primaci[primacStr].sortimenti[SORTIMENTI_NAZIVI[j]] += vrijednost;
        }
        odjeliMap[odjelStr].primaci[primacStr].ukupno += kubik;
      }
    }

    // Sortiraj po zadnjem datumu descending (najnovija sječa prvo)
    const odjeliArray = [];
    for (const odjelNaziv in odjeliMap) {
      const o = odjeliMap[odjelNaziv];
      const primaciArray = [];
      for (const pName in o.primaci) {
        primaciArray.push({
          ime: pName,
          sortimenti: o.primaci[pName].sortimenti,
          ukupno: o.primaci[pName].ukupno
        });
      }
      primaciArray.sort((a, b) => b.ukupno - a.ukupno);

      odjeliArray.push({
        odjel: odjelNaziv,
        sortimenti: o.sortimenti,
        ukupno: o.ukupno,
        primaci: primaciArray,
        zadnjiDatum: o.zadnjiDatum ? formatDate(o.zadnjiDatum) : ''
      });
    }
    odjeliArray.sort((a, b) => {
      if (!a.zadnjiDatum && !b.zadnjiDatum) return 0;
      if (!a.zadnjiDatum) return 1;
      if (!b.zadnjiDatum) return -1;
      // Parse dd.mm.yyyy za sortiranje
      var pA = a.zadnjiDatum.split('.'), pB = b.zadnjiDatum.split('.');
      var dA = new Date(pA[2], pA[1] - 1, pA[0]), dB = new Date(pB[2], pB[1] - 1, pB[0]);
      return dB - dA;
    });

    Logger.log('=== HANDLE ODJELI ALL END ===');
    Logger.log('Total odjeli: ' + odjeliArray.length);

    return createJsonResponse({
      sortimentiNazivi: SORTIMENTI_NAZIVI,
      odjeli: odjeliArray
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleOdjeliAll: ' + error.toString());
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

    // Ako je proslijeđena poslovođa, koristimo IME poslovođe za filtriranje
    // direktno po POSLOVOĐA polju u STANJE_ZALIHA (iz PRIMKA svakog odjela)
    let poslovodjaFilter = null;
    let poslovodjaRadilista = null;
    if (poslovodja && poslovodja.trim() !== '') {
      poslovodjaFilter = poslovodja.trim().toUpperCase().split(/\s+/).sort().join(' ');
      Logger.log('Poslovodja filter (normalized): ' + poslovodjaFilter);
      // Također dohvati radilišta iz INFO sheeta (za dropdown, ne za filtriranje)
      poslovodjaRadilista = getPoslovodjaRadilistaFromInfo(ss, poslovodja.trim().toUpperCase());
      Logger.log('Poslovodja radilista iz INFO: ' + (poslovodjaRadilista ? poslovodjaRadilista.join(', ') : 'NONE'));
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

        // Filtriraj po POSLOVOĐA polju iz STANJE_ZALIHA (direktno iz PRIMKA svakog odjela)
        if (poslovodjaFilter !== null) {
          const sheetPoslovodja = poslovodjaNaziv.toUpperCase().trim().split(/\s+/).sort().join(' ');
          if (sheetPoslovodja !== poslovodjaFilter) {
            // Preskoči - ovaj odjel ne pripada ovom poslovođi
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
