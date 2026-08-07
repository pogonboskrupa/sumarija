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
      // trim/lowercase — bez ovoga bilo koji razmak ili varijanta velikih
      // slova u koloni D šifrarnika (npr. "Primac " ili "primač") ne pogađa
      // strogo poređenje na frontendu i korisnik tiho dobije PUN admin prikaz
      // (vidi js/auth.js showApp/loadData, else grana)
      const tip = String(data[i][3] || '').trim().toLowerCase(); // primac ili otpremac

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

// ========================================
// 📋 PRIJAVA LOG — evidencija KADA su se korisnici prijavljivali (list
// "prijava" u KORISNICI_SPREADSHEET_ID, isti spreadsheet kao "Korisnici").
//
// VAŽNO: logPrijava se poziva ISKLJUČIVO iz main.gs doGet-a, na stvarnom
// path=login pozivu — NE iz handleLogin() same. handleLogin() se poziva
// (kao obična JS funkcija, ne kroz doGet path rutiranje) na SVAKOM API
// pozivu iz gotovo svakog handlera u api-handlers.gs kao provjera
// kredencijala ("Auth idiom A") — kad bi log bio unutra, jedna sesija bi
// za par minuta rada upisala desetine/stotine redova umjesto da hvata
// stvarna otvaranja aplikacije. path=login se zove SAMO: (1) kad korisnik
// ručno unese kredencijale na login ekranu (js/auth.js), i (2) jednom pri
// svakom otvaranju aplikacije kad se prijava vraća iz localStorage-a, kao
// provjera u pozadini da lozinka nije u međuvremenu promijenjena
// (js/app.js) — oba su stvarni "korisnik je otvorio aplikaciju" signali.
var PRIJAVA_SHEET = 'prijava';
var PRIJAVA_HEADERS = ['VRIJEME', 'KORISNICKO_IME', 'IME', 'TIP', 'USPJESNO'];

function _prijavaSheet(create) {
  var ss = SpreadsheetApp.openById(KORISNICI_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(PRIJAVA_SHEET);
  if (!sheet && create) {
    sheet = ss.insertSheet(PRIJAVA_SHEET);
    sheet.appendRow(PRIJAVA_HEADERS);
    var hr = sheet.getRange(1, 1, 1, PRIJAVA_HEADERS.length);
    hr.setBackground('#166534');
    hr.setFontColor('white');
    hr.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Upisuje jedan red — NIKAD ne baca (neuspjelo logovanje ne smije oboriti
// pravu prijavu).
function logPrijava(username, ime, tip, uspjesno) {
  try {
    var sheet = _prijavaSheet(true);
    sheet.appendRow([new Date(), username || '', ime || '', tip || '', uspjesno ? 'DA' : 'NE']);
  } catch (e) {
    Logger.log('logPrijava greška: ' + e);
  }
}
