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

    if (String(data[i][0]) === String(username) && storedPassword === inputPassword) {
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

// Evidencija prijava — list "prijava" u SUMARIJA_KORISNICI:
//   KORISNICKO_IME | IME | TIP | login 1 | login 2
// Jedan red po korisniku. "login 1" = zadnja prijava (datum + vrijeme), "login 2" = prethodna
// (prikazuje se samo datum). Pri novoj prijavi prethodni "login 1" prelazi u "login 2".
// Redovi se drže sortirani po "login 1" opadajuće (zadnje prijavljeni na vrhu).
// Upis se preskače ako je zadnja prijava mlađa od 5 min (auto-prijava pri svakom
// otvaranju aplikacije bi inače stalno pomjerala "login 2"). Greška ovdje NE smije
// srušiti prijavu.
const PRIJAVA_SHEET = 'prijava';
const PRIJAVA_FORMAT_LOGIN1 = 'd.M.yyyy. HH:mm:ss';
const PRIJAVA_FORMAT_LOGIN2 = 'd.M.yyyy.';

function zabiljeziLogin(ss, username, fullName, tipNaziv) {
  const lock = LockService.getScriptLock();
  let imaLock = false;
  try {
    imaLock = lock.tryLock(3000);
    if (!imaLock) return; // drugi upis u toku — preskoči, bolje nego blokirati prijavu

    let sheet = ss.getSheetByName(PRIJAVA_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(PRIJAVA_SHEET);
      sheet.appendRow(['KORISNICKO_IME', 'IME', 'TIP', 'login 1', 'login 2']);
      sheet.getRange(1, 1, 1, 5).setBackground('#14532d').setFontColor('white').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    const sada = new Date();
    const zadnji = sheet.getLastRow();
    const redovi = zadnji >= 2 ? sheet.getRange(2, 1, zadnji - 1, 5).getValues() : [];
    const idx = redovi.findIndex(function(r) { return String(r[0]) === String(username); });

    let red;
    if (idx === -1) {
      sheet.appendRow([username, fullName, tipNaziv, sada, '']);
      red = sheet.getLastRow();
    } else {
      red = idx + 2;
      const prethodni = redovi[idx][3];
      if (prethodni instanceof Date && (sada - prethodni) < 5 * 60 * 1000) return;
      sheet.getRange(red, 2, 1, 2).setValues([[fullName, tipNaziv]]);  // ime/tip prate šifrarnik
      sheet.getRange(red, 4, 1, 2).setValues([[sada, prethodni || '']]);
    }
    sheet.getRange(red, 4).setNumberFormat(PRIJAVA_FORMAT_LOGIN1);
    sheet.getRange(red, 5).setNumberFormat(PRIJAVA_FORMAT_LOGIN2);

    const n = sheet.getLastRow();
    if (n > 2) sheet.getRange(2, 1, n - 1, 5).sort({ column: 4, ascending: false });
    oboji_prijave_(sheet, n);
  } catch (e) {
    Logger.log('zabiljeziLogin greška (ignorisano): ' + e);
  } finally {
    if (imaLock) lock.releaseLock();
  }
}

// Boja reda prema svježini zadnje prijave: danas zeleno, jučer žuto, prekjučer narandžasto,
// starije bez boje (kao u postojećoj tabeli)
function oboji_prijave_(sheet, n) {
  if (n < 2) return;
  const TZ = 'Europe/Sarajevo';
  const dan = function(d) {
    const p = Utilities.formatDate(d, TZ, 'yyyy-MM-dd').split('-');
    return Date.UTC(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2])) / 86400000;
  };
  const danas = dan(new Date());
  const boje = ['#b7f0c3', '#fff59d', '#ffcc80'];
  const login1 = sheet.getRange(2, 4, n - 1, 1).getValues();
  const pozadine = login1.map(function(r) {
    const razlika = r[0] instanceof Date ? danas - dan(r[0]) : 99;
    const boja = razlika >= 0 && razlika < boje.length ? boje[razlika] : null;
    return [boja, boja, boja, boja, boja];
  });
  sheet.getRange(2, 1, n - 1, 5).setBackgrounds(pozadine);
}

// Login handler
// zabiljezi=true samo za pravu prijavu (path=login) — handleLogin se interno poziva i
// iz svakog drugog handlera radi autentikacije, i tada se ništa ne upisuje
function handleLogin(username, password, zabiljezi) {
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

    if (String(data[i][0]) === String(username) && storedPassword === inputPassword) {
      // trim/lowercase — bez ovoga bilo koji razmak ili varijanta velikih
      // slova u koloni D šifrarnika (npr. "Primac " ili "primač") ne pogađa
      // strogo poređenje na frontendu i korisnik tiho dobije PUN admin prikaz
      // (vidi js/auth.js showApp/loadData, else grana)
      const tip = String(data[i][3] || '').trim().toLowerCase(); // primac ili otpremac
      const userTypeNaziv = tip === 'primac' ? 'Primač' : (tip === 'otpremac' ? 'Otpremač' : 'Korisnik');
      if (zabiljezi) zabiljeziLogin(ss, data[i][0], data[i][2], userTypeNaziv);

      return createJsonResponse({
        success: true,
        username: username,
        fullName: data[i][2], // ime_prezime je već kompletno ime
        role: 'user', // svi su radnici
        type: tip || 'Korisnik',
        userType: userTypeNaziv
      }, true);
    }
  }

  return createJsonResponse({
    success: false,
    error: 'Pogrešno korisničko ime ili šifra'
  }, false);
}
