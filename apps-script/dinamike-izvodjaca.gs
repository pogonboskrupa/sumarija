// ============================================================
// 📊 DINAMIKE IZVOĐAČA — plan vs realizacija po odjelu (mjesečni pregled)
// ============================================================
// Podtab u SJEČA tabu ("📊 Dinamike izvođača"). Za svaki odjel koji ima
// sječu/otpremu (lista odjela preuzeta iz STANJE_ODJELA_CACHE — vidi
// syncStanjeOdjela u services.gs, isti izvor kao "Stanje zaliha po odjelu")
// prikazuje: naziv odjela, radilište/GJ, izvođač, poslovođa, ugovorenu
// (projektovanu) drvnu masu (SVEUKUPNO iz PROJEKAT reda), i realizaciju
// razdvojenu na "prošli period" (sve prije prošlog mjeseca) i "prošli
// mjesec" — odvojeno za SJEČU (INDEKS_PRIMKA) i OTPREMU (INDEKS_OTPREMA).
//
// VAŽNO — namjerni pomak mjeseca: izvještaji za ovaj podtab se rade za
// PROTEKLI kalendarski mjesec (ne za tekući u toku), pa je "tekući mjesec"
// ovdje zapravo prošli mjesec — za razliku od svih drugih tabova u
// aplikaciji. Ovaj pomak je NAMJERNO izolovan samo u ovaj fajl.
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

function _dinamikePeriodGranice() {
  var now = new Date();
  var godTekuca = now.getFullYear();
  var mjTekuci = now.getMonth(); // 0-11, stvarni tekući mjesec

  // "Izvještajni mjesec" ovog podtaba = protekli kalendarski mjesec
  var mjProsli = mjTekuci - 1, godProsli = godTekuca;
  if (mjProsli < 0) { mjProsli = 11; godProsli = godTekuca - 1; }

  var pocetakProslogMjeseca = new Date(godProsli, mjProsli, 1, 0, 0, 0);
  var krajProslogMjeseca = new Date(godProsli, mjProsli + 1, 1, 0, 0, 0); // ekskluzivna gornja granica

  return {
    pocetakProslogMjeseca: pocetakProslogMjeseca,
    krajProslogMjeseca: krajProslogMjeseca,
    godinaIzvjestaja: godProsli,
    mjesecIzvjestaja: mjProsli
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
function handleDinamikeIzvodjaca(year, username, password) {
  var loginResult = JSON.parse(handleLogin(username, password).getContent());
  if (!loginResult.success) return createJsonResponse({ error: 'Unauthorized' }, false);

  var cacheKey = 'dinamike_izvodjaca_' + year;
  var cached = getCachedData(cacheKey);
  if (cached) return createJsonResponse(cached, true);

  try {
    var granice = _dinamikePeriodGranice();
    var ss = SpreadsheetApp.openById(BAZA_PODATAKA_ID);

    // 1) Lista odjela + ugovorena (projektovana) ukupna masa + izvođač/radilište
    //    — iz STANJE_ODJELA_CACHE (isti izvor kao "Stanje zaliha po odjelu").
    var cacheSheet = ss.getSheetByName('STANJE_ODJELA_CACHE');
    if (!cacheSheet) {
      syncStanjeOdjela();
      cacheSheet = ss.getSheetByName('STANJE_ODJELA_CACHE');
    }

    var odjeliMap = {};   // KLJUČ (velika slova, trim) -> objekat
    var poredak = [];     // redoslijed kako se pojavljuju u cache sheetu

    if (cacheSheet) {
      var allData = cacheSheet.getDataRange().getValues();
      for (var i = 2; i < allData.length; i++) {
        var row = allData[i];
        var redTip = row[0];
        var odjelNaziv = String(row[1] || '').trim();
        if (!odjelNaziv) continue;
        var odjelKljuc = odjelNaziv.toUpperCase();
        var radiliste = row[2];
        var izvodjac = row[3];
        var dataRow = row.slice(5); // cijeli red iz per-odjel OTPREMA sheeta
        var sveukupno = parseFloat(dataRow[dataRow.length - 1]) || 0;

        if (!odjeliMap[odjelKljuc]) {
          odjeliMap[odjelKljuc] = {
            odjel: odjelNaziv,
            radiliste: radiliste || '',
            izvodjac: izvodjac || '',
            poslovodja: '',
            zadnjiDatumSjece: null,
            zadnjiDatumOtpreme: null,
            ugovorenoUkupno: 0,
            sjeca: { prosliPeriod: _prazniSortimentiObjekat(), prosliMjesec: _prazniSortimentiObjekat() },
            otprema: { prosliPeriod: _prazniSortimentiObjekat(), prosliMjesec: _prazniSortimentiObjekat() }
          };
          poredak.push(odjelKljuc);
        }
        if (redTip === 'PROJEKAT') {
          odjeliMap[odjelKljuc].ugovorenoUkupno = sveukupno;
        }
      }
    }

    // 2) Realizacija SJEČE — iz INDEKS_PRIMKA, podijeljena na prošli period / prošli mjesec.
    //    Redovi iz STVARNOG tekućeg mjeseca (u toku) se namjerno isključuju —
    //    izvještaj je uvijek za protekli mjesec.
    var primkaSheet = ss.getSheetByName('INDEKS_PRIMKA');
    if (primkaSheet) {
      var primkaData = primkaSheet.getDataRange().getValues();
      for (var pi = 1; pi < primkaData.length; pi++) {
        var prow = primkaData[pi];
        var pdatum = prow[PRIMKA_COL.DATE];
        if (!pdatum) continue;
        var pdatumObj = parseDate(pdatum);
        if (!pdatumObj || isNaN(pdatumObj.getTime())) continue;
        if (pdatumObj >= granice.krajProslogMjeseca) continue;

        var pOdjelKljuc = String(prow[PRIMKA_COL.ODJEL] || '').trim().toUpperCase();
        if (!pOdjelKljuc || !odjeliMap[pOdjelKljuc]) continue;

        var podj = odjeliMap[pOdjelKljuc];
        var pbucket = (pdatumObj >= granice.pocetakProslogMjeseca) ? podj.sjeca.prosliMjesec : podj.sjeca.prosliPeriod;
        for (var pj = 0; pj < SORTIMENTI_NAZIVI.length; pj++) {
          pbucket[SORTIMENTI_NAZIVI[pj]] += parseFloat(prow[PRIMKA_COL.SORT_START + pj]) || 0;
        }

        if (!podj.zadnjiDatumSjece || pdatumObj > podj.zadnjiDatumSjece) {
          podj.zadnjiDatumSjece = pdatumObj;
          var pposl = String(prow[PRIMKA_COL.POSLOVODJA] || '').trim();
          if (pposl) podj.poslovodja = pposl;
        }
      }
    }

    // 3) Realizacija OTPREME — iz INDEKS_OTPREMA, isto grananje.
    var otpremaSheet = ss.getSheetByName('INDEKS_OTPREMA');
    if (otpremaSheet) {
      var otpremaData = otpremaSheet.getDataRange().getValues();
      for (var oi = 1; oi < otpremaData.length; oi++) {
        var orow = otpremaData[oi];
        var odatum = orow[OTPREMA_COL.DATE];
        if (!odatum) continue;
        var odatumObj = parseDate(odatum);
        if (!odatumObj || isNaN(odatumObj.getTime())) continue;
        if (odatumObj >= granice.krajProslogMjeseca) continue;

        var oOdjelKljuc = String(orow[OTPREMA_COL.ODJEL] || '').trim().toUpperCase();
        if (!oOdjelKljuc || !odjeliMap[oOdjelKljuc]) continue;

        var oodj = odjeliMap[oOdjelKljuc];
        var obucket = (odatumObj >= granice.pocetakProslogMjeseca) ? oodj.otprema.prosliMjesec : oodj.otprema.prosliPeriod;
        for (var oj = 0; oj < SORTIMENTI_NAZIVI.length; oj++) {
          obucket[SORTIMENTI_NAZIVI[oj]] += parseFloat(orow[OTPREMA_COL.SORT_START + oj]) || 0;
        }

        if (!oodj.zadnjiDatumOtpreme || odatumObj > oodj.zadnjiDatumOtpreme) {
          oodj.zadnjiDatumOtpreme = odatumObj;
          if (!oodj.poslovodja) {
            var oposl = String(orow[OTPREMA_COL.POSLOVODJA] || '').trim();
            if (oposl) oodj.poslovodja = oposl;
          }
        }
      }
    }

    // 4) Izbaci odjele ručno označene kao "pregledani" za ovu godinu
    var pregledMap = _citajDinamikePregledMap(year);
    var ukupnoKey = SORTIMENTI_NAZIVI[SORTIMENTI_NAZIVI.length - 1]; // "UKUPNO Č+L"

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
          indexOtprema: o.ugovorenoUkupno > 0 ? (otpremaUkupno / o.ugovorenoUkupno) * 100 : 0
        };
      });

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
