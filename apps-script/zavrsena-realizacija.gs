// ============================================================
// ✅ ZAVRŠENA REALIZACIJA — ručno označavanje odjela kao gotovog
// ============================================================
// Neki odjeli nikad ne dostignu 95% projektovane mase iz Stanje zaliha
// (teren, procjena bila preoptimistična, itd.), pa automatski status na
// Mapi odjela ostaje "u sječi" iako je posao na terenu stvarno završen.
// Admin u modalu odjela (Mapa) može ručno označiti "Završena realizacija" —
// override koji prisiljava status na "posjeceno" bez obzira na izračunati
// procenat. Sheet: ZAVRSENI_ODJELI u BAZA_PODATAKA_ID (nastaje sam pri
// prvom označavanju). Jedan red po (odjel, godina) — UPSERT, ne append, da
// uključi/isključi checkbox ne gomila redove.
// Template: handleAddKlopkaOcitanje (feromonske-klopke.gs), admin-only upis.

var ZAVRSENI_SHEET   = 'ZAVRSENI_ODJELI';
var ZAVRSENI_HEADERS = ['ODJEL_KEY', 'GJ', 'ODJEL', 'GODINA', 'ZAVRSENO', 'KORISNIK', 'DATUM'];

// ---------- UPIS/UPDATE (GET, admin) ----------
function handleSetZavrsenaRealizacija(params) {
  var lock = null;
  try {
    var loginResult = JSON.parse(handleLogin(params.username, params.password).getContent());
    if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);
    if (loginResult.type !== 'admin') {
      return createJsonResponse({ error: 'Samo admin može označiti odjel kao završen' }, false);
    }

    var odjelKey = String(params.odjelKey || '').trim().toUpperCase();
    var gj       = String(params.gj || '').trim();
    var odjel    = String(params.odjel || '').trim();
    var godina   = String(params.godina || '').trim();
    var zavrseno = String(params.zavrseno) === 'true';

    if (!odjelKey || !godina) {
      return createJsonResponse({ error: 'odjelKey i godina su obavezni' }, false);
    }

    lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
      return createJsonResponse({ error: 'Server je zauzet, pokušajte ponovo' }, false);
    }

    var ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    var sheet = ss.getSheetByName(ZAVRSENI_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(ZAVRSENI_SHEET);
      sheet.appendRow(ZAVRSENI_HEADERS);
      var hr = sheet.getRange(1, 1, 1, ZAVRSENI_HEADERS.length);
      hr.setBackground('#166534');
      hr.setFontColor('white');
      hr.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    var datumStr = formatDate(new Date());
    var korisnik = loginResult.fullName || params.username;

    // UPSERT: traži postojeći red za (ODJEL_KEY, GODINA) da toggle checkboxa
    // ne gomila nove redove pri svakom uključi/isključi.
    var data = sheet.getDataRange().getValues();
    var foundRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toUpperCase() === odjelKey && String(data[i][3] || '').trim() === godina) {
        foundRow = i + 1; // 1-based red za Range
        break;
      }
    }

    var rowValues = [odjelKey, gj, odjel, godina, zavrseno, korisnik, datumStr];
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, ZAVRSENI_HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    invalidateAllCache();
    Logger.log('Zavrsena realizacija: ' + odjelKey + ' / ' + godina + ' = ' + zavrseno);

    return createJsonResponse({ success: true, message: zavrseno ? 'Odjel označen kao završen' : 'Oznaka uklonjena' }, true);

  } catch (error) {
    Logger.log('ERROR in handleSetZavrsenaRealizacija: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) {} }
  }
}

// ---------- ČITANJE (GET) ----------
function handleGetZavrsenaRealizacija(username, password, godina) {
  try {
    var loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);

    var ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    var sheet = ss.getSheetByName(ZAVRSENI_SHEET);
    if (!sheet) return createJsonResponse({ success: true, odjeli: [] }, true);

    var data = sheet.getDataRange().getValues();
    var godinaFilter = godina ? String(godina).trim() : null;
    var odjeli = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      if (godinaFilter && String(row[3] || '').trim() !== godinaFilter) continue;
      odjeli.push({
        odjelKey: String(row[0] || ''),
        gj:       String(row[1] || ''),
        odjel:    String(row[2] || ''),
        godina:   String(row[3] || ''),
        zavrseno: row[4] === true || String(row[4]).toUpperCase() === 'TRUE',
        korisnik: String(row[5] || ''),
        datum:    String(row[6] || '')
      });
    }

    return createJsonResponse({ success: true, odjeli: odjeli }, true);

  } catch (error) {
    Logger.log('ERROR in handleGetZavrsenaRealizacija: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}
