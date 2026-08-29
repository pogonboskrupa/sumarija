// ============================================================
// 📊 DINAMIKE IZVOĐAČA — plan vs realizacija po odjelu (mjesečni pregled)
// ============================================================
// Podtab u Sječa/otprema tabu ("📊 Dinamike izvođača"). Za svaki odjel koji
// ima sječu/otpremu (lista odjela izvedena direktno iz INDEKS_PRIMKA/
// INDEKS_OTPREMA za izabranu godinu) prikazuje: naziv odjela, radilište/GJ,
// izvođač, poslovođa, ugovorenu (projektovanu) drvnu masu (SVEUKUPNO iz
// STANJE_ODJELA_CACHE PROJEKAT reda), i realizaciju razdvojenu na "prošli
// period" (sve prije izabranog mjeseca) i izabrani mjesec — odvojeno za
// SJEČU (INDEKS_PRIMKA) i OTPREMU (INDEKS_OTPREMA).
//
// VAŽNO — izbor izvještajnog mjeseca: korisnik bira mjesec u dropdownu
// (index.html #dinamike-izvodjaca-mjesec-select). Sve prije izabranog
// mjeseca ide u "prošli period", sam izabrani mjesec (može biti i stvarni
// tekući, u toku) ide u red imenovan po njemu. Ako mjesec nije poslan
// (stariji poziv), podrazumijeva se protekli kalendarski mjesec — staro
// ponašanje, zadržano kao fallback.
//
// VAŽNO — ugovorena masa je SAMO ukupan broj (SVEUKUPNO), ne po sortimentu:
// STANJE_ODJELA_CACHE (Drive fajlovi po odjelu) koristi drugačiji,
// nepotpun set naziva sortimenata (18, bez ŠKART/GULE, "ČETINARI" umjesto
// "Σ ČETINARI") od kanonskog SORTIMENTI_NAZIVI (20, config.gs) koji
// koriste INDEKS_PRIMKA/INDEKS_OTPREMA. Miješanje ta dva bi moglo tiho
// pogrešno spojiti pogrešne kolone (ista vrsta greške koja je već jednom
// nađena i ispravljena u ovoj aplikaciji) — zato se ugovorena masa uzima
// samo kao već sigurno izdvojen SVEUKUPNO totalni broj (zadnja kolona
// PROJEKAT reda), a puna sortimentna razrada se prikazuje samo za
// REALIZACIJU (SJEČA/OTPREMA), koja dolazi direktno iz kanonskih 20 kolona.

var DINAMIKE_PREGLED_SHEET   = 'DINAMIKE_PREGLED_ODJELA';
var DINAMIKE_PREGLED_HEADERS = ['ODJEL', 'GODINA', 'PREGLEDAN', 'KORISNIK', 'DATUM'];

function _dinamikePeriodGranice(mjesec, godina) {
  var mjIzv, godIzv;
  if (mjesec !== undefined && mjesec !== null && mjesec !== '') {
    mjIzv = parseInt(mjesec, 10);
    godIzv = (godina !== undefined && godina !== null && godina !== '') ? parseInt(godina, 10) : new Date().getFullYear();
  } else {
    // Fallback (mjesec nije poslan): protekli kalendarski mjesec
    var now = new Date();
    mjIzv = now.getMonth() - 1;
    godIzv = now.getFullYear();
    if (mjIzv < 0) { mjIzv = 11; godIzv -= 1; }
  }

  var pocetakProslogMjeseca = new Date(godIzv, mjIzv, 1, 0, 0, 0);
  var krajProslogMjeseca = new Date(godIzv, mjIzv + 1, 1, 0, 0, 0); // ekskluzivna gornja granica

  return {
    pocetakProslogMjeseca: pocetakProslogMjeseca,
    krajProslogMjeseca: krajProslogMjeseca,
    godinaIzvjestaja: godIzv,
    mjesecIzvjestaja: mjIzv
  };
}

function _prazniSortimentiObjekat() {
  var o = {};
  SORTIMENTI_NAZIVI.forEach(function(s) { o[s] = 0; });
  return o;
}

function _citajDinamikePregledMap(godina) {
  var map = {};
  try {
    var ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    var sheet = ss.getSheetByName(DINAMIKE_PREGLED_SHEET);
    if (!sheet) return map;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      if (String(row[1] || '').trim() !== String(godina)) continue;
      if (row[2] === true || String(row[2]).toUpperCase() === 'TRUE') {
        map[String(row[0]).trim().toUpperCase()] = true;
      }
    }
  } catch (e) {
    Logger.log('ERROR _citajDinamikePregledMap: ' + e.toString());
  }
  return map;
}

// ---------- GLAVNI PODACI (GET) ----------
function handleDinamikeIzvodjaca(year, mjesec, username, password) {
  var loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);

  // v4 — izvještajni mjesec je sad biran u dropdownu (mjesec parametar),
  // ne uvijek protekli kalendarski mjesec. Ključ uključuje mjesec da svaki
  // izbor ima svoj keš (i da promjena ovog ponašanja odmah istisne stari
  // keširan odgovor).
  var mjesecZaKljuc = (mjesec !== undefined && mjesec !== null && mjesec !== '') ? mjesec : 'zadnji';
  var cacheKey = 'dinamike_izvodjaca_v4_' + year + '_' + mjesecZaKljuc;
  var cached = getCachedData(cacheKey);
  if (cached) return createJsonResponse(cached, true);

  try {
    var granice = _dinamikePeriodGranice(mjesec, year);
    var ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    var godinaFilter = parseInt(year, 10);

    // Lista odjela se gradi ISKLJUČIVO iz stvarne, žive sječe/otpreme
    // (INDEKS_PRIMKA/INDEKS_OTPREMA) — NE iz STANJE_ODJELA_CACHE, koji je
    // odvojen izvor (Drive folder sa po-odjel fajlovima) što nije nužno
    // ažuran/sinhronizovan sa aktuelnim unosima (probano: odjeli sa sječom
    // svaki mjesec ove godine su se ipak vidjeli kao "nema podataka" jer ih
    // taj cache nije imao). STANJE_ODJELA_CACHE se dolje koristi SAMO kao
    // opciona dopuna za ugovorenu masu, nikad da isključi odjel iz liste.
    var odjeliMap = {};
    var poredak = [];

    function _osiguraj(odjelNaziv) {
      var odjelKljuc = odjelNaziv.toUpperCase();
      if (!odjeliMap[odjelKljuc]) {
        odjeliMap[odjelKljuc] = {
          odjel: odjelNaziv,
          radiliste: '',
          izvodjac: '',
          poslovodja: '',
          zadnjiDatumSjece: null,
          zadnjiDatumOtpreme: null,
          ugovorenoUkupno: 0,
          sjeca: { prosliPeriod: _prazniSortimentiObjekat(), prosliMjesec: _prazniSortimentiObjekat() },
          otprema: { prosliPeriod: _prazniSortimentiObjekat(), prosliMjesec: _prazniSortimentiObjekat() }
        };
        poredak.push(odjelKljuc);
      }
      return odjeliMap[odjelKljuc];
    }

    // 1) SJEČA — iz INDEKS_PRIMKA (tekuća godina), gradi listu odjela i
    //    realizaciju podijeljenu na prošli period / prošli mjesec. Redovi iz
    //    STVARNOG tekućeg mjeseca (u toku) se isključuju iz realizacije —
    //    izvještaj je uvijek za protekli mjesec — ali odjel i dalje ulazi u
    //    listu čim ima bilo kakav red ove godine.
    var primkaSheet = ss.getSheetByName('INDEKS_PRIMKA');
    if (primkaSheet) {
      var primkaData = primkaSheet.getDataRange().getValues();
      for (var pi = 1; pi < primkaData.length; pi++) {
        var prow = primkaData[pi];
        var pdatum = prow[PRIMKA_COL.DATE];
        if (!pdatum) continue;
        var pdatumObj = parseDate(pdatum);
        if (!pdatumObj || isNaN(pdatumObj.getTime())) continue;
        if (pdatumObj.getFullYear() !== godinaFilter) continue;

        var pOdjelNaziv = String(prow[PRIMKA_COL.ODJEL] || '').trim();
        if (!pOdjelNaziv) continue;
        var podj = _osiguraj(pOdjelNaziv);

        if (!podj.zadnjiDatumSjece || pdatumObj > podj.zadnjiDatumSjece) {
          podj.zadnjiDatumSjece = pdatumObj;
          podj.radiliste = String(prow[PRIMKA_COL.RADILISTE] || '').trim() || podj.radiliste;
          podj.izvodjac = String(prow[PRIMKA_COL.IZVODJAC] || '').trim() || podj.izvodjac;
          var pposl = String(prow[PRIMKA_COL.POSLOVODJA] || '').trim();
          if (pposl) podj.poslovodja = pposl;
        }

        if (pdatumObj >= granice.krajProslogMjeseca) continue;
        var pbucket = (pdatumObj >= granice.pocetakProslogMjeseca) ? podj.sjeca.prosliMjesec : podj.sjeca.prosliPeriod;
        for (var pj = 0; pj < SORTIMENTI_NAZIVI.length; pj++) {
          pbucket[SORTIMENTI_NAZIVI[pj]] += parseFloat(prow[PRIMKA_COL.SORT_START + pj]) || 0;
        }
      }
    }

    // 2) OTPREMA — iz INDEKS_OTPREMA (tekuća godina), isto grananje.
    var otpremaSheet = ss.getSheetByName('INDEKS_OTPREMA');
    if (otpremaSheet) {
      var otpremaData = otpremaSheet.getDataRange().getValues();
      for (var oi = 1; oi < otpremaData.length; oi++) {
        var orow = otpremaData[oi];
        var odatum = orow[OTPREMA_COL.DATE];
        if (!odatum) continue;
        var odatumObj = parseDate(odatum);
        if (!odatumObj || isNaN(odatumObj.getTime())) continue;
        if (odatumObj.getFullYear() !== godinaFilter) continue;

        var oOdjelNaziv = String(orow[OTPREMA_COL.ODJEL] || '').trim();
        if (!oOdjelNaziv) continue;
        var oodj = _osiguraj(oOdjelNaziv);

        if (!oodj.zadnjiDatumOtpreme || odatumObj > oodj.zadnjiDatumOtpreme) {
          oodj.zadnjiDatumOtpreme = odatumObj;
          if (!oodj.radiliste) oodj.radiliste = String(orow[OTPREMA_COL.RADILISTE] || '').trim();
          if (!oodj.izvodjac) oodj.izvodjac = String(orow[OTPREMA_COL.IZVODJAC] || '').trim();
          if (!oodj.poslovodja) {
            var oposl = String(orow[OTPREMA_COL.POSLOVODJA] || '').trim();
            if (oposl) oodj.poslovodja = oposl;
          }
        }

        if (odatumObj >= granice.krajProslogMjeseca) continue;
        var obucket = (odatumObj >= granice.pocetakProslogMjeseca) ? oodj.otprema.prosliMjesec : oodj.otprema.prosliPeriod;
        for (var oj = 0; oj < SORTIMENTI_NAZIVI.length; oj++) {
          obucket[SORTIMENTI_NAZIVI[oj]] += parseFloat(orow[OTPREMA_COL.SORT_START + oj]) || 0;
        }
      }
    }

    // 3) Ugovorena (projektovana) masa — best-effort dopuna iz STANJE_ODJELA_CACHE
    //    (isti izvor kao "Stanje zaliha po odjelu"). Odjel koji nema odgovarajući
    //    red tamo (ili sheet uopšte ne postoji) ostaje na listi sa ugovorenoUkupno=0
    //    umjesto da nestane sa liste.
    var cacheSheet = ss.getSheetByName('STANJE_ODJELA_CACHE');
    if (cacheSheet) {
      var allData = cacheSheet.getDataRange().getValues();
      for (var i = 2; i < allData.length; i++) {
        var row = allData[i];
        if (row[0] !== 'PROJEKAT') continue;
        var odjelNaziv = String(row[1] || '').trim();
        if (!odjelNaziv) continue;
        var odjelKljuc = odjelNaziv.toUpperCase();
        if (!odjeliMap[odjelKljuc]) continue; // dopuni samo postojeće, ne dodaji nove
        var dataRow = row.slice(5);
        odjeliMap[odjelKljuc].ugovorenoUkupno = parseFloat(dataRow[dataRow.length - 1]) || 0;
      }
    }

    // 4) Izbaci odjele ručno označene kao "pregledani" za ovu godinu
    var pregledMap = _citajDinamikePregledMap(year);
    var ukupnoKey = SORTIMENTI_NAZIVI[SORTIMENTI_NAZIVI.length - 1]; // "UKUPNO Č+L"

    // Zadnja aktivnost odjela = kasniji od zadnjeg datuma sječe/otpreme.
    function _zadnjaAktivnost(o) {
      var a = o.zadnjiDatumSjece, b = o.zadnjiDatumOtpreme;
      if (a && b) return a > b ? a : b;
      return a || b || null;
    }

    var odjeli = poredak
      .filter(function(kljuc) { return !pregledMap[kljuc]; })
      .map(function(kljuc) {
        var o = odjeliMap[kljuc];
        var sjecaUkupno = o.sjeca.prosliPeriod[ukupnoKey] + o.sjeca.prosliMjesec[ukupnoKey];
        var otpremaUkupno = o.otprema.prosliPeriod[ukupnoKey] + o.otprema.prosliMjesec[ukupnoKey];
        return {
          odjel: o.odjel,
          radiliste: o.radiliste,
          izvodjac: o.izvodjac,
          poslovodja: o.poslovodja,
          ugovorenoUkupno: o.ugovorenoUkupno,
          sjeca: o.sjeca,
          otprema: o.otprema,
          indexSjeca: o.ugovorenoUkupno > 0 ? (sjecaUkupno / o.ugovorenoUkupno) * 100 : 0,
          indexOtprema: o.ugovorenoUkupno > 0 ? (otpremaUkupno / o.ugovorenoUkupno) * 100 : 0,
          _zadnjaAktivnost: _zadnjaAktivnost(o)
        };
      });

    // Poredaj po izvođaču — grupe izvođača idu redoslijedom njihove
    // NAJNOVIJE aktivnosti (bilo koji njihov odjel), a unutar grupe odjeli
    // idu od najnovije ka najstarijoj aktivnosti.
    var izvodjacMaxDatum = {};
    odjeli.forEach(function(o) {
      var kljuc = String(o.izvodjac || '').trim().toUpperCase();
      var t = o._zadnjaAktivnost ? o._zadnjaAktivnost.getTime() : 0;
      if (!(kljuc in izvodjacMaxDatum) || t > izvodjacMaxDatum[kljuc]) izvodjacMaxDatum[kljuc] = t;
    });
    odjeli.sort(function(a, b) {
      var ka = String(a.izvodjac || '').trim().toUpperCase();
      var kb = String(b.izvodjac || '').trim().toUpperCase();
      var diffIzvodjac = izvodjacMaxDatum[kb] - izvodjacMaxDatum[ka];
      if (diffIzvodjac !== 0) return diffIzvodjac;
      if (ka !== kb) return ka < kb ? -1 : 1; // isti max datum, različiti izvođači — stabilnost
      var ta = a._zadnjaAktivnost ? a._zadnjaAktivnost.getTime() : 0;
      var tb = b._zadnjaAktivnost ? b._zadnjaAktivnost.getTime() : 0;
      return tb - ta;
    });
    odjeli.forEach(function(o) { delete o._zadnjaAktivnost; });

    var rezultat = {
      odjeli: odjeli,
      sortimentiNazivi: SORTIMENTI_NAZIVI,
      mjesecIzvjestaja: granice.mjesecIzvjestaja,
      godinaIzvjestaja: granice.godinaIzvjestaja
    };

    setCachedData(cacheKey, rezultat, CACHE_TTL);
    return createJsonResponse(rezultat, true);

  } catch (error) {
    Logger.log('ERROR in handleDinamikeIzvodjaca: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  }
}

// ---------- UPIS/UPDATE "završen pregled odjela" (GET, admin) ----------
function handleSetDinamikaPregled(params) {
  var lock = null;
  try {
    var loginResult = JSON.parse(handleLogin(params.username, params.password).getContent());
    if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);
    if (loginResult.type !== 'admin') {
      return createJsonResponse({ error: 'Samo admin može označiti odjel kao pregledan' }, false);
    }

    var odjel = String(params.odjel || '').trim();
    var godina = String(params.godina || '').trim();
    var pregledan = String(params.pregledan) === 'true';

    if (!odjel || !godina) {
      return createJsonResponse({ error: 'odjel i godina su obavezni' }, false);
    }

    lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
      return createJsonResponse({ error: 'Server je zauzet, pokušajte ponovo' }, false);
    }

    var ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);
    var sheet = ss.getSheetByName(DINAMIKE_PREGLED_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(DINAMIKE_PREGLED_SHEET);
      sheet.appendRow(DINAMIKE_PREGLED_HEADERS);
      var hr = sheet.getRange(1, 1, 1, DINAMIKE_PREGLED_HEADERS.length);
      hr.setBackground('#166534');
      hr.setFontColor('white');
      hr.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    var datumStr = formatDate(new Date());
    var korisnik = loginResult.fullName || params.username;
    var odjelKljuc = odjel.toUpperCase();

    // UPSERT: traži postojeći red za (ODJEL, GODINA) da toggle checkboxa
    // ne gomila nove redove pri svakom uključi/isključi.
    var data = sheet.getDataRange().getValues();
    var foundRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toUpperCase() === odjelKljuc && String(data[i][1] || '').trim() === godina) {
        foundRow = i + 1;
        break;
      }
    }

    var rowValues = [odjel, godina, pregledan, korisnik, datumStr];
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, DINAMIKE_PREGLED_HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    invalidateCacheZa('sjeca');
    invalidateCacheZa('otprema');
    Logger.log('Dinamika pregled: ' + odjel + ' / ' + godina + ' = ' + pregledan);

    return createJsonResponse({ success: true, message: pregledan ? 'Odjel označen kao pregledan' : 'Oznaka uklonjena' }, true);

  } catch (error) {
    Logger.log('ERROR in handleSetDinamikaPregled: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, false);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) {} }
  }
}
