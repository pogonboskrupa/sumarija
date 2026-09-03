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
// stvarna otvaranja aplikacije.
//
// path=login se ipak zove na SVAKI refresh/otvaranje aplikacije (auto-login
// provjera kredencijala u js/app.js kad se prijava vraća iz localStorage-a)
// — ne samo pri stvarnom unosu korisničkog imena/šifre. Zato JEDAN RED PO
// KORISNIKU umjesto reda-po-događaju:
//   - Nova prijava istog korisnika unutar zadnjih 6h → ništa se ne mijenja
//     (isti "posjet"/sesija, ne novo otvaranje vrijedno bilježenja).
//   - Nova prijava poslije 6h+ pauze (ili prvi put ikad za tog korisnika)
//     → LOGIN 1 prelazi u LOGIN 2, trenutno vrijeme postaje novi LOGIN 1.
//     Samo zadnja dva otvaranja se pamte.
// Samo USPJEŠNE prijave se bilježe (pogrešna šifra se ne upisuje).
var PRIJAVA_SHEET = 'prijava';
// LOGIN 1 = zadnja (najnovija) prijava, LOGIN 2 = pretposljednja.
var PRIJAVA_HEADERS = ['KORISNICKO_IME', 'IME', 'TIP', 'LOGIN 1', 'LOGIN 2'];
var PRIJAVA_LIMIT_MS = 6 * 60 * 60 * 1000; // 6h

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

// Upisuje/ažurira red za korisnika — NIKAD ne baca (neuspjelo logovanje ne
// smije oboriti pravu prijavu). LockService štiti od trke pri dva gotovo
// istovremena otvaranja (npr. dva taba istog korisnika).
function logPrijava(username, ime, tip, uspjesno) {
  if (!uspjesno || !username) return; // samo uspješne prijave se bilježe
  var lock = LockService.getScriptLock();
  try {
    try { lock.tryLock(10000); } catch (lockErr) {}

    var sheet = _prijavaSheet(true);
    var data = sheet.getDataRange().getValues();
    var uname = String(username).trim();
    var sada = new Date();

    var redIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === uname) { redIndex = i; break; }
    }

    if (redIndex === -1) {
      sheet.appendRow([uname, ime || '', tip || '', sada, '']);
    } else {
      var zadnja = data[redIndex][3];
      var zadnjaMs = (zadnja instanceof Date) ? zadnja.getTime() : 0;
      // i van 6h-prozora (ništa se ne piše) i dalje treba proći do bojenja
      // ispod — datum se ne mijenja, ali "danas" se mijenja svaki dan.
      if (!zadnjaMs || (sada.getTime() - zadnjaMs) >= PRIJAVA_LIMIT_MS) {
        var redBroj = redIndex + 1; // 1-indexed red u sheetu (data je 0-indexed)
        sheet.getRange(redBroj, 1, 1, PRIJAVA_HEADERS.length)
          .setValues([[uname, ime || '', tip || '', sada, zadnja || '']]);
      }
    }

    _obojiISortirajPrijave(sheet);
  } catch (e) {
    Logger.log('logPrijava greška: ' + e);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// Sortira "prijava" list po LOGIN 1 (najskorija prijava na vrhu) i boji svaki
// red prema tome koliko je dana prošlo od LOGIN 1. Poziva se pri SVAKOM
// pozivu logPrijava (ne samo za red koji se upravo mijenja) — inače bi npr.
// jučerašnja "zelena" (danas) ostala zelena i sutra dok se BAŠ TAJ korisnik
// ponovo ne prijavi, jer ništa drugo ne bi ponovo izračunalo boje.
var PRIJAVA_TZ = 'Europe/Sarajevo';
var PRIJAVA_BOJA_DANAS = '#b9f6ca';    // zelena — prijavljen danas
var PRIJAVA_BOJA_JUCE = '#fff59d';     // žuta — prijavljen juče
var PRIJAVA_BOJA_PREKJUCE = '#ffcc80'; // narandžasta — prijavljen prekjuče (2 dana)

function _obojiISortirajPrijave(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var lastCol = PRIJAVA_HEADERS.length;

  // Sortiraj PRIJE bojenja (ne poslije) — boje se ispod izračunaju iz
  // vrijednosti u VEĆ sortiranom redoslijedu, pa ne ovisimo o tome da li
  // Range.sort() prenosi i pozadinske boje zajedno sa vrijednostima.
  sheet.getRange(2, 1, lastRow - 1, lastCol).sort({ column: 4, ascending: false });

  var danas = Utilities.formatDate(new Date(), PRIJAVA_TZ, 'yyyy-MM-dd');
  var vrijednosti = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
  var boje = vrijednosti.map(function (red) {
    var v = red[0];
    var boja = null;
    if (v instanceof Date) {
      var dStr = Utilities.formatDate(v, PRIJAVA_TZ, 'yyyy-MM-dd');
      var razlikaDana = Math.round((_parseYmdUtc(danas) - _parseYmdUtc(dStr)) / 86400000);
      if (razlikaDana === 0) boja = PRIJAVA_BOJA_DANAS;
      else if (razlikaDana === 1) boja = PRIJAVA_BOJA_JUCE;
      else if (razlikaDana === 2) boja = PRIJAVA_BOJA_PREKJUCE;
    }
    return new Array(lastCol).fill(boja);
  });
  sheet.getRange(2, 1, lastRow - 1, lastCol).setBackgrounds(boje);
}

function _parseYmdUtc(ymd) {
  var d = ymd.split('-');
  return Date.UTC(+d[0], +d[1] - 1, +d[2]);
}
