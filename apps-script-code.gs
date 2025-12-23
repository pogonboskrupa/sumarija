// Google Apps Script za Šumarija API
// Deploy kao Web App: Deploy > New deployment > Web app

// ⚠️ VAŽNO: Postavi svoj Spreadsheet ID ovdje
const SPREADSHEET_ID = '1rpl0RiqsE6lrU9uDMTjf127By7b951rP3a5Chis9qwg';

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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const primkaSheet = ss.getSheetByName('PRIMKA');
  const otpremaSheet = ss.getSheetByName('OTPREMA');

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
  // Pretpostavljam strukturu:
  // Kolona A: Datum, B: Odjel, ... ostatak kolona ..., kolona sa kubikom

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const datum = row[0]; // kolona A
    const odjel = row[1]; // kolona B
    const kubik = parseFloat(row[10]) || 0; // PRILAGODI: kolona sa kubikom (npr. K = indeks 10)

    if (!datum || !odjel) continue;

    const datumObj = new Date(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

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
}

// Procesiranje OTPREMA sheet-a
function processOtpremaData(data, stats, year) {
  // Slična struktura kao PRIMKA

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const datum = row[0];
    const odjel = row[1];
    const kubik = parseFloat(row[10]) || 0; // PRILAGODI

    if (!datum || !odjel) continue;

    const datumObj = new Date(datum);
    if (datumObj.getFullYear() !== parseInt(year)) continue;

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
