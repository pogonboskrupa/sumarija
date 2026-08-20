// ============================================================
// 🪤 FEROMONSKE KLOPKE — evidencija ulova potkornjaka
// ============================================================
// Admin (Mapa odjela → Šumsko uzgojni radovi) unosi očitanja klopki otprilike
// svakih 10 dana: odjel, broj klopke, vrsta potkornjaka (slobodan tekst) i
// broj ulova. Sheet: FEROMONSKE_KLOPKE u ODVOJENOM fajlu (KLOPKE_SPREADSHEET_ID,
// config.gs) — NAMJERNO ne u BAZA_PODATAKA_ID, korisnički zahtjev da ovi podaci
// budu odvojeni od glavne baze (nastaje sam pri prvom unosu). Jednostavan flat
// zapis, jedan red = jedno očitanje —
// template je handleAddPreklasiranje/handleGetPreklasiranja/
// handleDeletePreklasiranje (api-handlers.gs), NE sjekacke-linije.gs (ta nosi
// GPS-array/UUID-dedupe/offline-red kompleksnost koja ovdje nije potrebna —
// admin desk-tool, ne terenski multi-radnik unos).
//
// Google Sheets auto-import (planiran za kasnije) — ova šema (flat, jedan
// red po očitanju) je namjerno jednostavna da se lako doda kao dodatni izvor
// redova bez izmjene postojećih handlera.

var KLOPKE_SHEET   = 'FEROMONSKE_KLOPKE';
// LAT/LNG su dodati NA KRAJ (ne umetnuti usred postojećih kolona) da eventualno
// već postojeći sheet sa starijom šemom (bez pozicije) ostane čitljiv bez pomjeranja.
var KLOPKE_HEADERS = ['DATUM_OCITANJA', 'ODJEL', 'BROJ_KLOPKE', 'VRSTA_POTKORNJAKA', 'BROJ_ULOVA', 'NAPOMENA', 'KORISNIK', 'LAT', 'LNG'];

// ---------- UPIS (GET, admin) ----------
function handleAddKlopkaOcitanje(params) {
  var lock = null;
  try {
    var loginResult = JSON.parse(handleLogin(params.username, params.password).getContent());
    if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);
    if (loginResult.type !== 'admin') {
      return createJsonResponse({ error: 'Samo admin može unositi klopke' }, false);
    }

    var odjel      = String(params.odjel || '').trim();
    var brojKlopke = String(params.brojKlopke || '').trim();
    var vrsta      = String(params.vrsta || '').trim();
    var ulov       = parseInt(params.ulov, 10);

    if (!odjel || !brojKlopke || !vrsta) {
      return createJsonResponse({ error: 'Odjel, broj klopke i vrsta su obavezni' }, false);
    }
    if (isNaN(ulov) || ulov < 0) {
      return createJsonResponse({ error: 'Broj ulova mora biti 0 ili veći' }, false);
    }

    var datum = params.datumOcitanja ? parseDate(params.datumOcitanja) : new Date();
    if (isNaN(datum.getTime())) {
      return createJsonResponse({ error: 'Neispravan datum' }, false);
    }

    // Pozicija (klik na mapu, frontend) — opciono na serveru (frontend je
    // već traži obavezno prije slanja), ali ako je poslana mora biti validna
    // koordinata da se izbjegnu smeće-markeri na mapi.
    var lat = params.lat === '' || params.lat == null ? '' : parseFloat(params.lat);
    var lng = params.lng === '' || params.lng == null ? '' : parseFloat(params.lng);
    if (lat !== '' && (isNaN(lat) || lat < -90 || lat > 90)) {
      return createJsonResponse({ error: 'Neispravna lat koordinata' }, false);
    }
    if (lng !== '' && (isNaN(lng) || lng < -180 || lng > 180)) {
      return createJsonResponse({ error: 'Neispravna lng koordinata' }, false);
    }

    lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
      return createJsonResponse({ error: 'Server je zauzet, pokušajte ponovo' }, false);
    }

    var ss = SpreadsheetApp.openById(KLOPKE_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(KLOPKE_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(KLOPKE_SHEET);
      sheet.appendRow(KLOPKE_HEADERS);
      var hr = sheet.getRange(1, 1, 1, KLOPKE_HEADERS.length);
      hr.setBackground('#7c2d12');
      hr.setFontColor('white');
      hr.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      formatDate(datum), odjel, brojKlopke, vrsta, ulov,
      String(params.napomena || '').trim(), loginResult.fullName || params.username,
      lat, lng
    ]);

    invalidateAllCache();
    Logger.log('Klopka očitanje: ' + odjel + ' / klopka ' + brojKlopke + ' / ' + vrsta + ' / ' + ulov);

    return createJsonResponse({ success: true, message: 'Očitanje klopke uneseno' }, true);

  } catch (error) {
    Logger.log('ERROR in handleAddKlopkaOcitanje: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) {} }
  }
}

// ---------- ČITANJE (GET) ----------
function handleGetKlopkeOcitanja(username, password, odjel) {
  try {
    var loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);

    var ss = SpreadsheetApp.openById(KLOPKE_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(KLOPKE_SHEET);
    if (!sheet) return createJsonResponse({ success: true, klopke: [] }, true);

    var data = sheet.getDataRange().getValues();
    var odjelFilter = odjel ? String(odjel).trim() : null;
    var klopke = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue; // prazan red
      var odjelRow = String(row[1] || '').trim();
      if (odjelFilter && odjelRow !== odjelFilter) continue;
      var lat = parseFloat(row[7]);
      var lng = parseFloat(row[8]);
      klopke.push({
        rowIndex:      i + 1, // 1-based za deleteRow
        datumOcitanja: String(row[0] || ''),
        odjel:         odjelRow,
        brojKlopke:    String(row[2] || ''),
        vrsta:         String(row[3] || ''),
        ulov:          parseInt(row[4], 10) || 0,
        napomena:      String(row[5] || ''),
        korisnik:      String(row[6] || ''),
        lat:           isNaN(lat) ? null : lat,
        lng:           isNaN(lng) ? null : lng
      });
    }

    return createJsonResponse({ success: true, klopke: klopke }, true);

  } catch (error) {
    Logger.log('ERROR in handleGetKlopkeOcitanja: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ---------- BRISANJE (GET, admin) ----------
function handleDeleteKlopkaOcitanje(params) {
  try {
    var loginResult = JSON.parse(handleLogin(params.username, params.password).getContent());
    if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);
    if (loginResult.type !== 'admin') {
      return createJsonResponse({ error: 'Samo admin može brisati klopke' }, false);
    }

    var rowIndex = parseInt(params.rowIndex, 10);
    if (isNaN(rowIndex) || rowIndex < 2) {
      return createJsonResponse({ error: 'Neispravan rowIndex' }, false);
    }

    var ss = SpreadsheetApp.openById(KLOPKE_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(KLOPKE_SHEET);
    if (!sheet) return createJsonResponse({ error: 'FEROMONSKE_KLOPKE sheet ne postoji' }, false);
    if (rowIndex > sheet.getLastRow()) return createJsonResponse({ error: 'Red ne postoji' }, false);

    sheet.deleteRow(rowIndex);
    invalidateAllCache();

    return createJsonResponse({ success: true, message: 'Očitanje obrisano' }, true);

  } catch (error) {
    Logger.log('ERROR in handleDeleteKlopkaOcitanje: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}
