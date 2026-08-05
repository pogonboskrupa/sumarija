// ============================================================
// 🎨 SJEKAČKE LINIJE — stvarno ofarbane (GPS-om snimljene) linije
// ============================================================
// Za razliku od GENERISANIH sjekačkih linija (azimut + razmak, računaju se
// na svakom telefonu iz iste geometrije odjela i nikad se ne šalju nigdje),
// ovdje se čuva STVARNO prohodana putanja radnika dok farba stabla, da bi
// je vidjeli SVI radnici, a ne samo onaj koji ju je snimio.
//
// Sheet: SJEKACKE_LINIJE u BAZA_PODATAKA_ID (nastaje sam pri prvoj liniji).
// Geometrija se čuva kao JSON niz [[lat,lng],...] u koloni TACKE.
//
// Google Sheets prima najviše 50.000 znakova po ćeliji. Klijent zato
// pojednostavljuje liniju (Douglas-Peucker) prije slanja i garantuje da
// JSON stane; ovaj writer kao ZADNJU BRANU ipak dijeli predugačku liniju
// na više redova (DIO/DIJELOVA), a reader ih spaja natrag po UUID-u.
// U normalnom radu je uvijek DIO=1, DIJELOVA=1.

var SJEK_SHEET    = 'SJEKACKE_LINIJE';
var SJEK_MAX_CELL = 45000;   // sigurnosna margina ispod Sheets limita (50.000)
var SJEK_HEADERS  = ['UUID', 'ODJEL_KEY', 'ODJEL_LABEL', 'BROJ_LINIJE', 'KORISNIK',
                     'RADNIK', 'NAZIV', 'KREIRANO', 'DUZINA_M', 'BROJ_TACAKA',
                     'DIO', 'DIJELOVA', 'TACKE', 'STATUS', 'IZMIJENJENO'];
var SJEK_C = { UUID: 0, ODJEL_KEY: 1, ODJEL_LABEL: 2, BROJ_LINIJE: 3, KORISNIK: 4,
               RADNIK: 5, NAZIV: 6, KREIRANO: 7, DUZINA_M: 8, BROJ_TACAKA: 9,
               DIO: 10, DIJELOVA: 11, TACKE: 12, STATUS: 13, IZMIJENJENO: 14 };

function _sjekSheet(create) {
  var ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
  var sheet = ss.getSheetByName(SJEK_SHEET);
  if (!sheet && create) {
    sheet = ss.insertSheet(SJEK_SHEET);
    sheet.appendRow(SJEK_HEADERS);
    var hr = sheet.getRange(1, 1, 1, SJEK_HEADERS.length);
    hr.setBackground('#166534');
    hr.setFontColor('white');
    hr.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Haversine (metri). Dužina se računa NA SERVERU, ne vjeruje se klijentu —
// tako svi uređaji prikazuju isti broj za istu liniju.
function _sjekDuzinaM(points) {
  var R = 6371000, uk = 0;
  for (var i = 1; i < points.length; i++) {
    var a = points[i - 1], b = points[i];
    var dLat = (b[0] - a[0]) * Math.PI / 180;
    var dLng = (b[1] - a[1]) * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    uk += R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  return Math.round(uk);
}

// Podijeli niz tačaka tako da JSON svakog dijela stane u jednu ćeliju.
// Svaki naredni dio POČINJE zadnjom tačkom prethodnog (preklop) — bez toga
// bi spojena linija imala rupu na svakom spoju.
function _sjekChunkPoints(points) {
  var chunks = [], cur = [], curLen = 2; // '[' + ']'
  for (var i = 0; i < points.length; i++) {
    var cost = JSON.stringify(points[i]).length + 1; // +1 za zarez
    if (cur.length >= 2 && curLen + cost > SJEK_MAX_CELL) {
      chunks.push(cur);
      cur = [points[i - 1]];
      curLen = 2 + JSON.stringify(points[i - 1]).length + 1;
    }
    cur.push(points[i]);
    curLen += cost;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// ---------- UPIS (POST) ----------
function handleAddSjekackaLinija(params) {
  var lock = null;
  try {
    var loginResult = JSON.parse(handleLogin(params.username, params.password).getContent());
    if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);

    var uuid = String(params.uuid || '').trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(uuid)) {
      return createJsonResponse({ error: 'Neispravan uuid' }, false);
    }

    var odjelKey = String(params.odjelKey || '').trim().toUpperCase();
    if (!odjelKey) return createJsonResponse({ error: 'odjelKey je obavezan' }, false);

    var points = params.points;
    if (!Array.isArray(points) || points.length < 2) {
      return createJsonResponse({ error: 'Linija mora imati bar 2 tačke' }, false);
    }
    if (points.length > 20000) {
      return createJsonResponse({ error: 'Previše tačaka (max 20000)' }, false);
    }
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (!Array.isArray(p) || p.length < 2 ||
          typeof p[0] !== 'number' || typeof p[1] !== 'number' ||
          isNaN(p[0]) || isNaN(p[1]) ||
          p[0] < -90 || p[0] > 90 || p[1] < -180 || p[1] > 180) {
        return createJsonResponse({ error: 'Neispravna tačka na indexu ' + i }, false);
      }
    }

    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) {
      return createJsonResponse({ error: 'Server je zauzet, pokušajte ponovo' }, false);
    }

    var sheet = _sjekSheet(true);

    // DEDUPE po UUID-u — ponovno slanje iste linije (izgubljen odgovor na
    // lošoj vezi, ponovni pokušaj iz offline reda čekanja) NE smije
    // napraviti duplikat.
    if (sheet.getLastRow() > 1) {
      var uuidCol = sheet.getRange(2, SJEK_C.UUID + 1, sheet.getLastRow() - 1, 1).getValues();
      for (var r = 0; r < uuidCol.length; r++) {
        if (String(uuidCol[r][0]).trim() === uuid) {
          return createJsonResponse({ success: true, duplicate: true, uuid: uuid }, true);
        }
      }
    }

    var nowIso  = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
    var chunks  = _sjekChunkPoints(points);
    var duzina  = _sjekDuzinaM(points);
    var brojLin = (params.brojLinije === '' || params.brojLinije == null)
                    ? '' : (parseInt(params.brojLinije, 10) || '');

    var redovi = [];
    for (var c = 0; c < chunks.length; c++) {
      redovi.push([
        uuid, odjelKey, String(params.odjelLabel || '').trim(), brojLin,
        loginResult.username, loginResult.fullName || loginResult.username,
        String(params.naziv || '').trim().substring(0, 120),
        String(params.kreirano || nowIso).substring(0, 40),
        duzina, points.length, c + 1, chunks.length,
        JSON.stringify(chunks[c]), 'AKTIVNO', nowIso
      ]);
    }
    sheet.getRange(sheet.getLastRow() + 1, 1, redovi.length, SJEK_HEADERS.length)
         .setValues(redovi);

    invalidateAllCache();
    Logger.log('Sjekačka linija: ' + uuid + ' / ' + odjelKey + ' / ' +
               points.length + ' tačaka / ' + duzina + ' m / ' + chunks.length + ' dio(va)');

    return createJsonResponse({
      success: true, uuid: uuid, duzinaM: duzina,
      brojTacaka: points.length, dijelova: chunks.length
    }, true);

  } catch (error) {
    Logger.log('ERROR in handleAddSjekackaLinija: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) {} }
  }
}

// ---------- ČITANJE (GET) ----------
function handleGetSjekackeLinije(username, password, odjelKey, sinceDays) {
  try {
    var loginResult = JSON.parse(handleLogin(username, password).getContent());
    if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);

    var key  = String(odjelKey || '').trim().toUpperCase();
    var dana = parseInt(sinceDays, 10);
    if (isNaN(dana) || dana <= 0) dana = 0; // 0 = bez vremenskog filtera

    var cacheKey = 'sjek_linije_' + (key || 'SVE') + '_' + dana;
    var cached = getCachedData(cacheKey);
    if (cached) return createJsonResponse(cached, true);

    // Isti obrazac kao handleGetPreklasiranja: sheet koji NE POSTOJI nije
    // greška nego prazan rezultat (prvi radnik još nije ništa snimio).
    var sheet = _sjekSheet(false);
    if (!sheet || sheet.getLastRow() < 2) {
      return createJsonResponse({ success: true, linije: [] }, true);
    }

    var data   = sheet.getDataRange().getValues();
    var cutoff = dana ? (Date.now() - dana * 86400000) : 0;
    var byUuid = {}; // uuid -> { meta..., _dijelovi: {dio: tackeJson} }

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var uuid = String(row[SJEK_C.UUID] || '').trim();
      if (!uuid) continue;

      if (String(row[SJEK_C.STATUS] || 'AKTIVNO').trim().toUpperCase() === 'OBRISANO') {
        byUuid[uuid] = null; // obrisano — i ako je već skupljeno, izbaci
        continue;
      }
      if (byUuid[uuid] === null) continue;

      if (key && String(row[SJEK_C.ODJEL_KEY] || '').trim().toUpperCase() !== key) continue;
      if (cutoff) {
        var t = Date.parse(String(row[SJEK_C.KREIRANO] || ''));
        if (!isNaN(t) && t < cutoff) continue;
      }

      if (!byUuid[uuid]) {
        byUuid[uuid] = {
          uuid:       uuid,
          odjelKey:   String(row[SJEK_C.ODJEL_KEY] || '').trim(),
          odjelLabel: String(row[SJEK_C.ODJEL_LABEL] || '').trim(),
          brojLinije: row[SJEK_C.BROJ_LINIJE] === '' ? null : (parseInt(row[SJEK_C.BROJ_LINIJE], 10) || null),
          korisnik:   String(row[SJEK_C.KORISNIK] || '').trim(),
          radnik:     String(row[SJEK_C.RADNIK] || '').trim(),
          naziv:      String(row[SJEK_C.NAZIV] || '').trim(),
          kreirano:   String(row[SJEK_C.KREIRANO] || '').trim(),
          duzinaM:    parseFloat(row[SJEK_C.DUZINA_M]) || 0,
          brojTacaka: parseInt(row[SJEK_C.BROJ_TACAKA], 10) || 0,
          _dijelovi:  {}
        };
      }
      byUuid[uuid]._dijelovi[parseInt(row[SJEK_C.DIO], 10) || 1] = String(row[SJEK_C.TACKE] || '');
    }

    var linije = [];
    Object.keys(byUuid).forEach(function(u) {
      var L = byUuid[u];
      if (!L) return;
      var dijelovi = Object.keys(L._dijelovi).map(Number).sort(function(a, b) { return a - b; });
      var pts = [];
      for (var d = 0; d < dijelovi.length; d++) {
        var arr;
        try { arr = JSON.parse(L._dijelovi[dijelovi[d]]); } catch (e) { arr = null; }
        if (!Array.isArray(arr)) continue;
        // preklopna tačka između dijelova se ne duplira
        if (pts.length && arr.length) arr = arr.slice(1);
        pts = pts.concat(arr);
      }
      if (pts.length < 2) return;
      delete L._dijelovi;
      L.points = pts;
      linije.push(L);
    });

    linije.sort(function(a, b) { return String(b.kreirano).localeCompare(String(a.kreirano)); });
    var out = { success: true, linije: linije };

    // CacheService prima najviše 100 KB po ključu — veće odgovore ne keširamo.
    try {
      var s = JSON.stringify(out);
      if (s.length < 90000) setCachedData(cacheKey, out, CACHE_TTL);
    } catch (e) {}

    return createJsonResponse(out, true);

  } catch (error) {
    Logger.log('ERROR in handleGetSjekackeLinije: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ---------- MEKO BRISANJE (GET) ----------
// PRAVILO: liniju može obrisati SAMO onaj ko ju je snimio. Snimljena linija
// je dokaz cjelodnevnog rada — da svako može brisati svakome, jedan pogrešan
// tap bi uništio tuđi posao. Brisanje je "meko" (STATUS = OBRISANO): red
// ostaje u sheetu i može se ručno vratiti, terenski podaci se nikad ne gube.
function handleDeleteSjekackaLinija(params) {
  var lock = null;
  try {
    var loginResult = JSON.parse(handleLogin(params.username, params.password).getContent());
    if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);

    var uuid = String(params.uuid || '').trim();
    if (!uuid) return createJsonResponse({ error: 'uuid je obavezan' }, false);

    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) {
      return createJsonResponse({ error: 'Server je zauzet, pokušajte ponovo' }, false);
    }

    var sheet = _sjekSheet(false);
    if (!sheet) return createJsonResponse({ error: 'Linija ne postoji' }, false);

    var data = sheet.getDataRange().getValues();
    var nowIso = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
    var pogodjeno = 0;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][SJEK_C.UUID] || '').trim() !== uuid) continue;
      if (String(data[i][SJEK_C.KORISNIK] || '').trim() !== loginResult.username) {
        return createJsonResponse({ error: 'Liniju može obrisati samo radnik koji ju je snimio' }, false);
      }
      sheet.getRange(i + 1, SJEK_C.STATUS + 1, 1, 2).setValues([['OBRISANO', nowIso]]);
      pogodjeno++;
    }
    if (!pogodjeno) return createJsonResponse({ error: 'Linija ne postoji' }, false);

    invalidateAllCache();
    return createJsonResponse({ success: true, uuid: uuid }, true);

  } catch (error) {
    Logger.log('ERROR in handleDeleteSjekackaLinija: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) {} }
  }
}
