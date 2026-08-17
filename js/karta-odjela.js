// ========================================
// js/karta-odjela.js — Mapa odjela 2026
// ========================================
(function () {
  'use strict';

  // Podaci specifični za šumariju — js/config-sumarija.js (jedini fajl koji
  // se mijenja za drugu šumariju).
  const _CFG = window.SUMARIJA_CONFIG || {};

  const GEOJSON_VERSION = _CFG.GEOJSON_VERSION || '1';

  // Prozirna pozadina GJ značke — izvedena iz GJ_COLOR u configu (hex → rgba
  // 25%), da se nazivi/boje GJ ne moraju održavati na dva mjesta.
  function _gjBadgeBg(gj) {
    var hex = (_CFG.GJ_COLOR || {})[gj];
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return 'rgba(255,255,255,.15)';
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',.25)';
  }
  const GEOJSON_URL = 'data/odjeli.geojson';
  // ISTI ključevi kao kanonski preload primke/otpreme fetch — dijeli cache umjesto
  // da duplicira cijeli payload pod treći zaseban ključ (cache_otpreme_karta)
  const CACHE_SJECA = 'cache_primke_sjeca';
  const CACHE_OTPR  = 'cache_otpreme_tab';

  // Lokacija Šumarije Bosanska Krupa — Trg Alije Izetbegovića 1
  const SUMARIJA_LATLNG = _CFG.LOKACIJA || [44.883425, 16.154427];
  const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

  let _map          = null;
  let _osmLayer     = null;
  let _satLayer     = null;
  let _isSat        = false;
  let _layer        = null;
  let _geojson      = null;
  let _statusMap       = new Map();
  let _slucajniSet     = new Set(); // normKeys s "SLUCAJNI" u nazivu
  let _sanitarSet      = new Set(); // normKeys s "SANITAR" u nazivu (sanitarna sječa)
  let _zapisnikSet     = new Set(); // normKeys s "ZAPISNIK" u nazivu
  let _prelazniSetGlobal = new Set(); // normKeys bez plana, bez SLUCAJNI/SANITAR/ZAPISNIK — prelazni
  let _allFeatures  = [];
  let _mapBounds    = null;
  let _routeLine    = null;
  let _routeLine2   = null; // ruta odjel→odjel
  let _sumarijaMark = null;
  let _currentLatlng     = null;
  let _currentOdjelLabel = null;
  let _stanjeMap         = null; // normKey → { projekat:[], sortimentiNazivi:[] }
  let _odjelRutaMode = false;    // da li je aktivan režim rute između odjela
  let _odjelRutaFrom = null;     // { latlng, label }
  let _odjelRutaFromMark = null;

  // ---- BOJE ----
  function _getColor(status) {
    switch (status) {
      case 'posjeceno':  return '#16a34a';
      case 'u-sjeci':    return '#dc2626';
      case 'planirano':  return '#eab308';
      case 'plan-2027':  return '#2563eb'; // plava — plan za narednu godinu
      case 'slucajni':   return '#7c3aed';
      case 'sanitar':    return '#ea580c'; // narandžasta — sanitarna sječa (Proizvodnja, "Prikaži sanitar")
      case 'zapisnik':   return '#0d9488'; // teal — zapisnik odjeli (Šumsko uzgojni radovi)
      case 'prelazni':   return '#0891b2';
      default:           return '#6366f1';
    }
  }
  function _getStyle(status) {
    const c = _getColor(status);
    const noPlan = (status === 'bez-plana');
    return {
      fillColor: c, fillOpacity: noPlan ? 0.20 : 0.55,
      color: '#1a1a1a', weight: noPlan ? 1.5 : 4, opacity: noPlan ? 1 : 0.85,
      dashArray: noPlan ? '4 4' : null,
    };
  }
  function _getHoverStyle(status) {
    const c = _getColor(status);
    const noPlan = (status === 'bez-plana');
    return { fillColor:c, fillOpacity: noPlan ? 0.30 : 0.8, color:'#000', weight: noPlan ? 2 : 5, opacity:1 };
  }
  // Stil u "Prikaz otpreme" režimu — zadržava boju statusa (zeleno posječeno,
  // crveno u sječi, itd.) ali dodaje bold narandžasti obrub da odjeli s otpremom
  // jasno iskaču, uključujući "bez-plana" odjele koji su inače blijedi/isprekidani.
  function _getOtpremaStyle(status) {
    const c = _getColor(status);
    return { fillColor:c, fillOpacity:0.6, color:'#b45309', weight:4, opacity:1, dashArray:null };
  }

  // Šumsko uzgojni radovi mod — svi odjeli OSIM slucajni/zapisnik se prikazuju
  // blijedo (kontekst na mapi — korisnik traži da vidi GDJE su ti odjeli u
  // odnosu na ostale, ne da ostatak mape nestane).
  const _UZGOJNI_DIM_STYLE      = { fillColor:'#cbd5e1', fillOpacity:0.12, color:'#94a3b8', weight:1, opacity:0.5 };
  const _UZGOJNI_DIM_HOVER_STYLE = { fillColor:'#cbd5e1', fillOpacity:0.25, color:'#64748b', weight:2, opacity:0.8 };
  function _uzgojniIstaknut(status) { return status === 'slucajni' || status === 'zapisnik'; }
  // Jedno mjesto koje style/hover ODLUČUJU stil zavisno od _prikazMode-a —
  // koristi ga i style: callback (za resetStyle poslije hover-a) i mouseover
  // handler, da hover na "zatamnjenom" odjelu u Uzgojni modu ne "iscuri"
  // njegovu punu Proizvodnja boju nazad nakon mouseout-a.
  function _styleForMode(status) {
    if (_prikazMode === 'uzgojni' && !_uzgojniIstaknut(status)) return _UZGOJNI_DIM_STYLE;
    return _getStyle(status);
  }
  function _hoverStyleForMode(status) {
    if (_prikazMode === 'uzgojni' && !_uzgojniIstaknut(status)) return _UZGOJNI_DIM_HOVER_STYLE;
    return _getHoverStyle(status);
  }

  // ---- NORMALIZACIJA ----
  function _normKey(s) {
    return String(s||'').trim().toUpperCase()
      .replace(/Č/g,'C').replace(/Ć/g,'C')
      .replace(/Š/g,'S').replace(/Ž/g,'Z').replace(/Đ/g,'DJ')
      .replace(/P\s*$/,'')      // strip trailing P before stripping /N
      .replace(/\/\d+\s*$/,'') // then strip /N suffix
      .trim();
  }

  // Ključ za prikaz labela — ne strippe /N sufiks, čuva 64/1 vs 64/2
  function _labelKey(s) {
    return String(s||'').trim().toUpperCase()
      .replace(/Č/g,'C').replace(/Ć/g,'C')
      .replace(/Š/g,'S').replace(/Ž/g,'Z').replace(/Đ/g,'DJ')
      .replace(/P\s*$/,'')
      .trim();
  }

  function _fmt(n) {
    if (n == null || isNaN(n)) return '—';
    const v = Math.round(n);
    return v === 0 ? '—' : v.toLocaleString('de-DE') + ' m³';
  }

  const PLAN_YEAR = _CFG.PLAN_YEAR || new Date().getFullYear();
  const MJESECI_NAZIVI = ['Januar','Februar','Mart','April','Maj','Juni','Juli','August','Septembar','Oktobar','Novembar','Decembar'];

  let _otpremaMode = false; // "Prikaz otpreme" checkbox — prikaži samo odjele s otpremom u tekućem mjesecu
  let _prikazMode  = 'proizvodnja'; // 'proizvodnja' | 'uzgojni' — NIJE perzistirano, uvijek default pri otvaranju taba

  function _getYear(p) {
    const parts = (p.datum||'').split('.');
    return parts.length >= 3 ? parseInt(parts[2]) : null;
  }

  function _getMonth(p) {
    const parts = (p.datum||'').split('.');
    return parts.length >= 2 ? parseInt(parts[1]) : null; // 1-12
  }

  // Parsira "DD.MM.YYYY" u Date objekat, radi poređenja (min/max datum sječe
  // po odjelu) — vraća null za neispravan/nepotpun datum.
  function _parseDatum(s) {
    const parts = String(s || '').split('.');
    if (parts.length < 3) return null;
    const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  function _fmtDatum(d) {
    if (!d) return '—';
    return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear() + '.';
  }

  // ---- STATUS MAP + SLUČAJNI/SANITAR/ZAPISNIK ----
  // Stripa SLUCAJNI/SANITAR/ZAPISNIK sufiks u svim formatima: "104 SLUCAJNI",
  // "104 SLUCAJNI UZICI", "104 (SLUCAJNI 2025)", "104 SANITARNA SJECA", "104 ZAPISNIK"
  const _baseKey = k => k
    .replace(/[\s(]+SLUCAJNI.*/,'').replace(/[\s(]+SLUCAJAN.*/,'')
    .replace(/[\s(]+SANITAR.*/,'').replace(/[\s(]+ZAPISNIK.*/,'')
    .trim();

  // Klasifikacija NE-PLANIRANOG odjela (poslije provjere planKeys) — JEDNO
  // mjesto koje style/onEachFeature/_openDetaljiModal dijele umjesto da
  // svaka nezavisno ponavlja isti if/else lanac (bilo je trostruko duplirano).
  // Namjerno RAZLIČITO od šireg TL_SLUCAJNI_KEYWORDS (js/app.js) /
  // SLUCAJNI_KEYWORDS (js/godisnji-plan.js) koji SANITAR/ZAPISNIK lijepe u
  // isti "Slučajni užici" bucket za Sječa-timeline — ovdje treba finija
  // podjela (poseban "Prikaži sanitar" checkbox na Proizvodnji, zapisnik i
  // slučajni razdvojeni u Šumsko uzgojni radovi prikazu).
  function _nonPlanKategorija(key) {
    if (_sanitarSet.has(key))        return 'sanitar';
    if (_zapisnikSet.has(key))       return 'zapisnik';
    if (_slucajniSet.has(key))       return 'slucajni';
    if (_prelazniSetGlobal.has(key)) return 'prelazni';
    return 'bez-plana';
  }

  function _buildStatusMap(primke, otpreme) {
    const planEntries    = _planEntries();
    const planKeys       = new Set(planEntries.map(e => _normKey(e.gj+' '+e.odjel)));
    const map            = new Map();
    _slucajniSet         = new Set();

    const primkeTekuce  = (primke||[]).filter(p => _getYear(p) === PLAN_YEAR);
    const primkeOstale  = (primke||[]).filter(p => _getYear(p) !== PLAN_YEAR);
    const otpremeTekuce = (otpreme||[]).filter(p => _getYear(p) === PLAN_YEAR);
    const otremeOstale  = (otpreme||[]).filter(p => _getYear(p) !== PLAN_YEAR);

    _slucajniSet  = new Set(); // ima "SLUCAJNI" u nazivu odjela
    _sanitarSet   = new Set(); // ima "SANITAR" u nazivu odjela
    _zapisnikSet  = new Set(); // ima "ZAPISNIK" u nazivu odjela
    let _prelazniSet = new Set(); // nije u planu 2026, bez SLUCAJNI/SANITAR/ZAPISNIK — prelazni iz prethodne godine

    // Prioritet prvog poklapanja kad bi naziv teorijski sadržao više ključnih
    // riječi odjednom: SANITAR (operativno najspecifičniji tag) → ZAPISNIK →
    // SLUCAJNI/SLUCAJAN → prelazni (generički catch-all).
    primkeTekuce.forEach(p => {
      const k  = _normKey(p.odjel);
      const bk = _baseKey(k); // stripa sufiks da matchuje GeoJSON polygon key
      if (!planKeys.has(k)) {
        if (k.includes('SANITAR')) {
          _sanitarSet.add(bk);
        } else if (k.includes('ZAPISNIK')) {
          _zapisnikSet.add(bk);
        } else if (k.includes('SLUCAJNI') || k.includes('SLUCAJAN')) {
          _slucajniSet.add(bk); // čuvamo baseKey, ne puni normKey
        } else {
          _prelazniSet.add(bk); // isto za prelazne
        }
      }
    });
    _prelazniSetGlobal = _prelazniSet;

    planEntries.forEach(entry => {
      const key  = _normKey(entry.gj+' '+entry.odjel);  // matches normKey(p.odjel)
      const labelK = _labelKey(entry.gj+' '+entry.odjel); // precizan, čuva /N
      const sjeca = _emptySort();
      const otpr  = _emptySort();
      const sjecaOst = _emptySort();
      const otprOst  = _emptySort();

      // BUGFIX (isti obrazac kao već postojeći za otpremu niže u fajlu):
      // _normKey briše /N sufiks (68/1 i 68/2 → isti ključ "68"), pa je čist
      // normKey match "prelijevao" sječu jednog pododsjeka i na susjedni
      // (npr. 68/1 sječa je gurala i 68/2 u status "u sječi", iako 68/2
      // uopšte nema evidentiranu sječu). Dva nivoa preciznosti:
      //  1. precise: labelKey (ČUVA /N) — kad zapis već navodi tačan pododsjek
      //  2. fallback: normKey (briše /N) — SAMO za zapise koji nemaju /N u
      //     nazivu (agregatni unos bez preciznog pododsjeka) — ti se
      //     primjenjuju širom svih pododsjeka jer se iz podatka ne može
      //     znati tačno koji.
      const matchOdjel = p => {
        const raw = String(p.odjel || '');
        if (/\/\d+/.test(raw)) return _labelKey(raw) === labelK;
        return _normKey(raw) === key;
      };

      primkeTekuce.filter(matchOdjel).forEach(p => _addSort(sjeca, p.sortiment, p.kolicina));
      otpremeTekuce.filter(matchOdjel).forEach(p => _addSort(otpr, p.sortiment, p.kolicina));
      primkeOstale.filter(matchOdjel).forEach(p => _addSort(sjecaOst, p.sortiment, p.kolicina));
      otremeOstale.filter(matchOdjel).forEach(p => _addSort(otprOst, p.sortiment, p.kolicina));

      // Radilište, izvođač, poslovođa — iz tekućih primki za ovaj odjel
      const odjelPrimke = primkeTekuce.filter(matchOdjel);
      const uniq = (arr, fn) => [...new Set(arr.map(fn).filter(Boolean))].join(', ') || '—';
      const radiliste  = uniq(odjelPrimke, p => p.radiliste);
      const izvodjac   = uniq(odjelPrimke, p => p.izvodjac);
      const poslovodja = uniq(odjelPrimke, p => p.poslovodja);

      // Početak/kraj sječe — najraniji i najkasniji datum primke za ovaj
      // odjel (koristi se u modalu SAMO za status "posjeceno").
      // Grupiši prvo po (raw) datumskom stringu → skup sortimenata tog dana,
      // da "kraj sječe" može preskočiti "čišćenje" dane — kad tog dana ima
      // ISKLJUČIVO OGR.CIJEPANI i/ili CEL.CIJEPANA (bilo koje od njih, ili
      // oboje zajedno) — ti sortimenti se često dovršavaju/čiste i poslije
      // stvarnog kraja sječe glavnih sortimenata, pa sam takav dan ne
      // predstavlja pravi nastavak sječe. Dan sa bilo kojim DRUGIM
      // sortimentom (uz njih ili umjesto njih) se i dalje normalno računa.
      const KRAJ_SJECE_CISCENJE = new Set(['OGR.CIJEPANI', 'CEL.CIJEPANA']);
      const sortimentiPoDatumu = new Map(); // raw datum string -> Set(sortiment)
      odjelPrimke.forEach(p => {
        const ds = String(p.datum || '');
        if (!ds) return;
        if (!sortimentiPoDatumu.has(ds)) sortimentiPoDatumu.set(ds, new Set());
        sortimentiPoDatumu.get(ds).add(p.sortiment);
      });
      const daniOpadajuce = [...sortimentiPoDatumu.keys()]
        .map(raw => ({ raw, date: _parseDatum(raw) }))
        .filter(d => d.date)
        .sort((a, b) => b.date - a.date);

      const datumPocetka = daniOpadajuce.length ? daniOpadajuce[daniOpadajuce.length - 1].date : null;
      let datumKraja = null;
      for (const d of daniOpadajuce) {
        const skup = sortimentiPoDatumu.get(d.raw);
        const samoCiscenje = [...skup].every(s => KRAJ_SJECE_CISCENJE.has(s));
        if (!samoCiscenje) { datumKraja = d.date; break; }
      }
      if (!datumKraja && daniOpadajuce.length) datumKraja = daniOpadajuce[0].date; // svi dani su bili samo čišćenje — fallback na stvarni zadnji dan

      sjeca.ukupno    = _sumSort(sjeca);
      otpr.ukupno     = _sumSort(otpr);
      sjecaOst.ukupno = _sumSort(sjecaOst);
      otprOst.ukupno  = _sumSort(otprOst);

      const pct    = entry.neto > 0 ? sjeca.ukupno / entry.neto * 100 : 0;
      const status = pct >= 95 ? 'posjeceno' : pct > 5 ? 'u-sjeci' : 'planirano';
      const entryData = { gj:entry.gj, odjel:entry.odjel, status, pct, sjeca, otpr, sjecaOst, otprOst, neto:entry.neto, bruto:entry.bruto, radiliste, izvodjac, poslovodja, datumPocetka, datumKraja };
      map.set(key, entryData);
      // Alias bez /N stripa — sprječava 64/1 da matchuje plan od 64/2P
      const strictKey = _labelKey(entry.gj+' '+entry.odjel);
      if (strictKey !== key) map.set(strictKey, entryData);
    });

    // Plan 2027 — odjeli planirani za narednu godinu, još nisu u planu 2026
    // Guard za "već u planu 2026" se gradi ISKLJUČIVO iz planEntries (2026), a ne iz
    // map-e koju ova ista petlja puni — inače susjedni /N odjeli (npr. 5/1 i 5/2) imaju
    // identičan normKey ("GRMEC JASENICA 5" bez /N sufiksa), pa bi upis 5/1 pogrešno
    // "zauzeo" normKey i naveo guard da tiho preskoči 5/2 kao da je već obrađen.
    const plan2026NormKeys  = new Set(planEntries.map(e => _normKey(e.gj + ' ' + e.odjel)));
    const plan2026LabelKeys = new Set(planEntries.map(e => _labelKey(e.gj + ' ' + e.odjel)));
    _plan2027Entries().forEach(entry => {
      const normK  = _normKey(entry.gj + ' ' + entry.odjel);
      const labelK = _labelKey(entry.gj + ' ' + entry.odjel);
      if (plan2026NormKeys.has(normK) || plan2026LabelKeys.has(labelK)) return; // već u planu 2026
      const d = { gj: entry.gj, odjel: entry.odjel, status: 'plan-2027', pct: 0,
        sjeca: _emptySort(), otpr: _emptySort(), sjecaOst: _emptySort(), otprOst: _emptySort(),
        neto: 0, bruto: 0, radiliste: '—', izvodjac: '—', poslovodja: '—' };
      // labelK je specifičan za OVAJ /N odjel — uvijek ga upiši (to je ključ po kojem
      // se GeoJSON poligon pronalazi pri renderu). normK je dijeljeni fallback pa ga
      // upisuje samo prvi /N odjel koji ga zatraži, da ne prepiše sestrinski unos.
      if (!map.has(labelK)) map.set(labelK, d);
      if (normK !== labelK && !map.has(normK)) map.set(normK, d);
    });

    // Extra map za non-plan odjele (slučajni + prelazni)
    const extraMap = new Map();
    const nonPlanPrimke = [...primkeTekuce, ...primkeOstale].filter(p => !planKeys.has(_normKey(p.odjel)));
    const nonPlanOtpr   = [...otpremeTekuce, ...otremeOstale].filter(p => !planKeys.has(_normKey(p.odjel)));
    const nonPlanKeys   = new Set([
      ...nonPlanPrimke.map(p => _baseKey(_normKey(p.odjel))),
      ...nonPlanOtpr.map(p => _baseKey(_normKey(p.odjel)))
    ]);
    nonPlanKeys.forEach(bk => {
      const sj  = _emptySort();
      const ot  = _emptySort();
      const sjO = _emptySort();
      const otO = _emptySort();
      // Match primke čiji base key odgovara (pokriva i "104 SLUCAJNI" i "104")
      const matchP = p => _baseKey(_normKey(p.odjel)) === bk;
      primkeTekuce.filter(matchP).forEach(p => _addSort(sj, p.sortiment, p.kolicina));
      otpremeTekuce.filter(matchP).forEach(p => _addSort(ot, p.sortiment, p.kolicina));
      primkeOstale.filter(matchP).forEach(p => _addSort(sjO, p.sortiment, p.kolicina));
      otremeOstale.filter(matchP).forEach(p => _addSort(otO, p.sortiment, p.kolicina));
      sj.ukupno  = _sumSort(sj);
      ot.ukupno  = _sumSort(ot);
      sjO.ukupno = _sumSort(sjO);
      otO.ukupno = _sumSort(otO);
      const srcPrimke = primkeTekuce.filter(matchP);
      const uniq = (arr, fn) => [...new Set(arr.map(fn).filter(Boolean))].join(', ') || '—';
      extraMap.set(bk, { sjeca:sj, otpr:ot, sjecaOst:sjO, otprOst:otO,
        radiliste: uniq(srcPrimke, p => p.radiliste),
        izvodjac:  uniq(srcPrimke, p => p.izvodjac),
        poslovodja:uniq(srcPrimke, p => p.poslovodja) });
    });
    map._extra = extraMap;

    // ---- OTPREMA TEKUĆEG MJESECA ----
    // Za "Prikaz otpreme" checkbox: skup odjela koji su imali otpremu u tekućem
    // kalendarskom mjesecu/godini, sa ukupnom količinom (m³).
    //
    // BUGFIX: _normKey BRIŠE /N sufiks (64/1 i 64/2 → isti ključ "64"). Kad se
    // taj spljošteni ključ koristio za SVE zapise, otprema evidentirana za
    // POJEDINAČAN pododsjek (npr. "Risovac Krupa 59/1") je lažno "prelijevala"
    // highlight i na susjedni pododsjek (59/2) koji te otpreme uopšte nije imao
    // — na mapi se to vidjelo kao highlight "pored" pravog odjela / naizgled
    // nasumični odsjeci. Rješenje: DVA nivoa preciznosti —
    //  1. precise: labelKey (ČUVA /N) — kad zapis već navodi tačan pododsjek
    //  2. fallback: normKey (briše /N) — SAMO za zapise koji nemaju /N u nazivu
    //     (agregatni/roditeljski unos bez preciznog pododsjeka) — primjenjuje
    //     se širom svih pododsjeka jer se iz podatka ne može znati tačno koji.
    const now      = new Date();
    const curMonth = now.getMonth() + 1; // 1-12
    const curYear  = now.getFullYear();
    const otpremaPreciseMap  = new Map(); // baseKey(labelKey) → m³ (čuva /N)
    const otpremaFallbackMap = new Map(); // baseKey(normKey)  → m³ (bez /N)
    (otpreme||[]).forEach(p => {
      if (_getYear(p) === curYear && _getMonth(p) === curMonth) {
        const raw = String(p.odjel || '');
        const amt = parseFloat(p.kolicina) || 0;
        if (/\/\d+/.test(raw)) {
          const pk = _baseKey(_labelKey(raw));
          otpremaPreciseMap.set(pk, (otpremaPreciseMap.get(pk) || 0) + amt);
        } else {
          const fk = _baseKey(_normKey(raw));
          otpremaFallbackMap.set(fk, (otpremaFallbackMap.get(fk) || 0) + amt);
        }
      }
    });
    map._otpremaPrecise     = otpremaPreciseMap;
    map._otpremaFallback    = otpremaFallbackMap;
    map._otpremaMjesecNaziv = MJESECI_NAZIVI[curMonth - 1] + ' ' + curYear;

    return map;
  }

  function _emptySort() { return { cTrupci:0,celDuga:0,celCijepana:0,skart:0,lTrupci:0,ogrDugi:0,ogrCijepani:0,gule:0,ukupno:0 }; }
  function _sumSort(s)  { return s.cTrupci+s.celDuga+s.celCijepana+s.skart+s.lTrupci+s.ogrDugi+s.ogrCijepani+s.gule; }
  function _addSort(obj, sortiment, kolicina) {
    const k = parseFloat(kolicina)||0;
    switch(sortiment) {
      case 'TRUPCI Č':     obj.cTrupci     +=k; break;
      case 'CEL.DUGA':     obj.celDuga      +=k; break;
      case 'CEL.CIJEPANA': obj.celCijepana  +=k; break;
      case 'ŠKART':        obj.skart        +=k; break;
      case 'TRUPCI L':     obj.lTrupci      +=k; break;
      case 'OGR.DUGI':     obj.ogrDugi      +=k; break;
      case 'OGR.CIJEPANI': obj.ogrCijepani  +=k; break;
      case 'GULE':         obj.gule         +=k; break;
    }
  }

  // ---- CENTROID ----
  function _centroid(layer) {
    try {
      const b = layer.getBounds();
      return b.getCenter();
    } catch(e) { return null; }
  }

  // ---- OSRM RUTA ----
  async function _drawRoute(destLatLng) {
    if (_routeLine) { _map.removeLayer(_routeLine); _routeLine = null; }

    const [lat1,lng1] = SUMARIJA_LATLNG;
    const url = `${OSRM_URL}/${lng1},${lat1};${destLatLng.lng},${destLatLng.lat}?overview=full&geometries=geojson`;

    try {
      // Timeout — javni OSRM demo server zna visiti; bez ovoga UI čeka zauvijek
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error('Server rute nedostupan (HTTP ' + resp.status + ')');
      const data = await resp.json();
      if (data.code !== 'Ok' || !data.routes.length) throw new Error('Nema rute');

      const route    = data.routes[0];
      const coords   = route.geometry.coordinates.map(c => [c[1],c[0]]);
      const distKm   = (route.distance / 1000).toFixed(1);
      const durMin   = Math.round(route.duration / 60);

      _routeLine = L.polyline(coords, { color:'#2563eb', weight:4, opacity:0.85, dashArray:'8 4' })
        .bindTooltip(`${distKm} km · ~${durMin} min`, { permanent:true, direction:'center', className:'karta-tooltip' })
        .addTo(_map);

      const infoDiv = document.getElementById('mapa-ruta-info');
      if (infoDiv) {
        infoDiv.innerHTML = `🛣️ <b>${distKm} km</b> &nbsp;·&nbsp; ⏱️ ~<b>${durMin} min</b> &nbsp;
          <button onclick="clearMapaRuta()" style="margin-left:8px;font-size:11px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;background:white;">✕ Ukloni</button>`;
        infoDiv.style.display = 'inline-flex';
      }

      // Zoom na rutu + šumariju
      _map.fitBounds(_routeLine.getBounds(), { padding:[30,30] });
    } catch(e) {
      alert('Greška pri učitavanju rute: ' + e.message);
    }
  }

  window.clearMapaRuta = function() {
    if (_routeLine) { _map.removeLayer(_routeLine); _routeLine = null; }
    const infoDiv = document.getElementById('mapa-ruta-info');
    if (infoDiv) infoDiv.style.display = 'none';
  };

  window.routeToOdjel = function() {
    closeMapaModal();
    if (_currentLatlng) _drawRoute(_currentLatlng);
  };

  window.routeOdjelToOdjel = function() {
    if (!_currentLatlng) return;
    closeMapaModal();
    // Postavi polazište na trenutni odjel i čekaj klik na odredište
    if (_routeLine2) { _map.removeLayer(_routeLine2); _routeLine2 = null; }
    const infoDiv = document.getElementById('mapa-ruta-info');
    if (infoDiv) infoDiv.style.display = 'none';
    _odjelRutaMode = true;
    _odjelRutaFrom = { latlng: _currentLatlng, label: _currentOdjelLabel };
    _odjelRutaFromMark = L.circleMarker(_currentLatlng, {
      radius:10, color:'#dc2626', fillColor:'#fca5a5', fillOpacity:0.9, weight:3
    }).bindTooltip(`Polazište: Odjel ${_currentOdjelLabel}`, { permanent:true, direction:'top', offset:[0,-8] }).addTo(_map);
    const btn = document.getElementById('karta-odjel-ruta-btn');
    if (btn) { btn.style.background = '#2563eb'; btn.style.color = 'white'; }
    const hint = document.getElementById('mapa-ruta-hint');
    if (hint) { hint.textContent = `🎯 Polazište: Odjel ${_currentOdjelLabel} — kliknite na odredišni odjel`; hint.style.display = 'block'; }
  };

  // ---- RUTA IZMEĐU DVA ODJELA ----
  async function _drawOdjelRuta(from, to, fromLabel, toLabel) {
    if (_routeLine2) { _map.removeLayer(_routeLine2); _routeLine2 = null; }

    const url = `${OSRM_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    try {
      // Timeout — javni OSRM demo server zna visiti; bez ovoga UI čeka zauvijek
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error('Server rute nedostupan (HTTP ' + resp.status + ')');
      const data = await resp.json();
      if (data.code !== 'Ok' || !data.routes.length) throw new Error('Nema rute');

      const route   = data.routes[0];
      const coords  = route.geometry.coordinates.map(c => [c[1],c[0]]);
      const distKm  = (route.distance / 1000).toFixed(1);
      const durMin  = Math.round(route.duration / 60);

      _routeLine2 = L.polyline(coords, { color:'#dc2626', weight:4, opacity:0.85, dashArray:'8 4' })
        .bindTooltip(`${distKm} km · ~${durMin} min`, { permanent:true, direction:'center', className:'karta-tooltip' })
        .addTo(_map);

      const infoDiv = document.getElementById('mapa-ruta-info');
      if (infoDiv) {
        infoDiv.innerHTML = `🔀 <b>Odjel ${fromLabel} → Odjel ${toLabel}</b>: <b>${distKm} km</b> · ⏱️ ~<b>${durMin} min</b>
          <button onclick="clearOdjelRuta()" style="margin-left:8px;font-size:11px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;background:white;">✕ Ukloni</button>`;
        infoDiv.style.display = 'inline-flex';
      }
      _map.fitBounds(_routeLine2.getBounds(), { padding:[30,30] });
    } catch(e) {
      alert('Greška pri učitavanju rute: ' + e.message);
    }
  }

  function _clearOdjelRutaState() {
    _odjelRutaMode = false;
    _odjelRutaFrom = null;
    if (_odjelRutaFromMark) { _map.removeLayer(_odjelRutaFromMark); _odjelRutaFromMark = null; }
    const btn = document.getElementById('karta-odjel-ruta-btn');
    if (btn) { btn.style.background = 'white'; btn.style.color = '#374151'; }
    const hint = document.getElementById('mapa-ruta-hint');
    if (hint) hint.style.display = 'none';
  }

  window.clearOdjelRuta = function() {
    if (_routeLine2) { _map.removeLayer(_routeLine2); _routeLine2 = null; }
    const infoDiv = document.getElementById('mapa-ruta-info');
    if (infoDiv) infoDiv.style.display = 'none';
    _clearOdjelRutaState();
  };

  window.toggleOdjelRutaMode = function() {
    if (_odjelRutaMode) {
      _clearOdjelRutaState();
      return;
    }
    // Ukloni stare rute
    if (_routeLine)  { _map.removeLayer(_routeLine);  _routeLine  = null; }
    if (_routeLine2) { _map.removeLayer(_routeLine2); _routeLine2 = null; }
    const infoDiv = document.getElementById('mapa-ruta-info');
    if (infoDiv) infoDiv.style.display = 'none';

    _odjelRutaMode = true;
    _odjelRutaFrom = null;
    const btn = document.getElementById('karta-odjel-ruta-btn');
    if (btn) { btn.style.background = '#2563eb'; btn.style.color = 'white'; }
    const hint = document.getElementById('mapa-ruta-hint');
    if (hint) { hint.textContent = '📍 Kliknite na prvi odjel (polazište)'; hint.style.display = 'block'; }
  };

  // ---- STANJE ODJELA (projekat) ----
  function _getStanjeMap() {
    if (_stanjeMap) return _stanjeMap;
    try {
      // Čitaj iz cache_stanje_zaliha (projekat/sječa/zaliha po sortimentima)
      let raw = localStorage.getItem('cache_stanje_zaliha');
      // Ako nema, probaj poslovođa varijantu (cache_stanje_zaliha_Ime_Prezime)
      if (!raw) {
        const key = Object.keys(localStorage).find(k => k.startsWith('cache_stanje_zaliha_'));
        if (key) raw = localStorage.getItem(key);
      }
      if (!raw) return null;
      const wrapper = JSON.parse(raw);
      const payload = wrapper && wrapper.data;
      if (!payload) return null;

      // stanje-zaliha vraća { odjeli: [...], sortimentiHeader: [...] }
      // stanje-odjela vraća { data: [...], sortimentiNazivi: [...] }
      const odjeli   = payload.odjeli || payload.data || [];
      const sortN    = payload.sortimentiHeader || payload.sortimentiNazivi || [];

      if (!Array.isArray(odjeli) || !odjeli.length) return null;

      _stanjeMap = new Map();
      odjeli.forEach(od => {
        const naziv = od.odjelNaziv || od.odjel || '';
        if (!naziv) return;
        const k = _normKey(naziv);
        _stanjeMap.set(k, {
          projekat:        (od.redovi && od.redovi.projekat)   || [],
          sjeca:           (od.redovi && od.redovi.sjeca)       || [],
          otprema:         (od.redovi && od.redovi.otprema)     || [],
          sumaLager:       (od.redovi && od.redovi.sumaLager)   || [],
          sortimentiNazivi: sortN
        });
      });
    } catch(_) {}
    return _stanjeMap || null;
  }

  // ---- DETALJI MODAL ----
  function _openDetaljiModal(props, info, latlng, extra) {
    _currentLatlng     = latlng;
    // Uvijek koristi GeoJSON props.odjel za prikaz — ne info.odjel koji može biti od drugog poligona
    _currentOdjelLabel = String(props.odjel || props.name || (info && info.odjel) || '?');
    const odjel  = _currentOdjelLabel;
    const gj     = props.gj   || '—';
    const odsjek = props.odsjek || '—';
    // Pozadina GJ značke u modalu — boja GJ iz configa, prozirno (25%).
    const gjBg = _gjBadgeBg(gj);

    document.getElementById('mapa-modal-title').textContent = 'Odjel ' + odjel;
    const gjEl = document.getElementById('mapa-modal-gj');
    gjEl.textContent = gj;
    gjEl.style.cssText = `color:white;font-weight:600;background:${gjBg};display:inline-block;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,.4);`;

    const metaDiv = document.getElementById('mapa-modal-meta');
    if (metaDiv) {
      const src = info || extra;
      const metaItem = (icon, label, val) => val && val !== '—'
        ? `<div style="display:flex;align-items:center;gap:4px;font-size:11px;opacity:.9;"><span>${icon}</span><span><b>${label}:</b> ${val}</span></div>`
        : '';
      metaDiv.innerHTML = src
        ? metaItem('📍', 'Radilište', src.radiliste) +
          metaItem('👷', 'Izvođač',   src.izvodjac)  +
          metaItem('👤', 'Poslovođa', src.poslovodja)
        : '';
      metaDiv.style.display = metaDiv.innerHTML ? 'flex' : 'none';
    }

    const statusLabel = { posjeceno:'Posječeno','u-sjeci':'U sječi',planirano:'Planirano',slucajni:'Slučajni užitak',sanitar:'Sanitarna sječa',zapisnik:'Zapisnik','plan-2027':'Plan sječa 2027',prelazni:'Nekategorisan odjel' };
    const statusColor = { posjeceno:'#166534','u-sjeci':'#dc2626',planirano:'#6b7280',slucajni:'#7c3aed',sanitar:'#c2410c',zapisnik:'#0f766e','plan-2027':'#1e40af',prelazni:'#0e7490' };
    const statusBg    = { posjeceno:'#dcfce7','u-sjeci':'#fee2e2',planirano:'#f3f4f6',slucajni:'#f5f3ff',sanitar:'#fff7ed',zapisnik:'#f0fdfa','plan-2027':'#dbeafe',prelazni:'#ecfeff' };

    const routeBtn = `
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button onclick="routeToOdjel()" style="flex:1;display:flex;align-items:center;gap:6px;background:#2563eb;color:white;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;justify-content:center;">🏢 Ruta od Šumarije</button>
        <button onclick="routeOdjelToOdjel()" style="flex:1;display:flex;align-items:center;gap:6px;background:#dc2626;color:white;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;justify-content:center;">🔀 Ruta do odjela…</button>
      </div>`;

    const normKey2  = _labelKey((props.gj||'') + ' ' + (props.odjel||props.name||''));
    const nonPlanKat = !info ? _nonPlanKategorija(normKey2) : null;

    let body;
    if (!info) {
      const label = nonPlanKat === 'bez-plana' ? 'Bez plana' : statusLabel[nonPlanKat];
      const bg    = nonPlanKat === 'bez-plana' ? '#f3f4f6' : statusBg[nonPlanKat];
      const col   = nonPlanKat === 'bez-plana' ? '#6b7280' : statusColor[nonPlanKat];
      const note  = nonPlanKat === 'sanitar'  ? `${gj} — sječa evidentirana kao sanitarna sječa`
        : nonPlanKat === 'zapisnik' ? `${gj} — sječa evidentirana kao zapisnik`
        : nonPlanKat === 'slucajni' ? `${gj} — sječa evidentirana kao slučajni užitak`
        : nonPlanKat === 'prelazni' ? `${gj} — nije u planu 2026, vjerovatno prelazni odjel iz prethodne godine`
        : `${gj} — nema podataka za ovaj odjel`;

      let extraTable = '';
      if (extra) {
        const sj  = extra.sjeca    || _emptySort();
        const ot  = extra.otpr     || _emptySort();
        const sjO = extra.sjecaOst || _emptySort();
        const otO = extra.otprOst  || _emptySort();
        const prevYear = PLAN_YEAR - 1;
        const hasTek = sj.ukupno > 0 || ot.ukupno > 0;
        const hasOst = sjO.ukupno > 0 || otO.ukupno > 0;
        if (hasTek || hasOst) {
          const cell = (v, color, bold) =>
            `<td style="padding:7px 10px;font-size:13px;text-align:right;border-bottom:1px solid #f1f5f9;color:${color};${bold?'font-weight:700;':''}">${_fmt(v)}</td>`;
          const row = (lbl, sv, ov, svO, ovO, bold) => {
            const bS = bold?'font-weight:700;font-size:13px;':'font-size:13px;';
            return `<tr${bold?' style="background:#f8fafc;"':''}>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;${bS}">${lbl}</td>
              ${cell(sv,  '#15803d', bold)}
              ${cell(ov,  '#92400e', bold)}
              ${cell(svO, '#6b7280', bold)}
              ${cell(ovO, '#9ca3af', bold)}
            </tr>`;
          };
          const sjCijC = sj.celDuga+sj.celCijepana+sj.skart;
          const sjCijL = sj.ogrDugi+sj.ogrCijepani+sj.gule;
          const otCijC = ot.celDuga+ot.celCijepana+ot.skart;
          const otCijL = ot.ogrDugi+ot.ogrCijepani+ot.gule;
          const sjOCijC = sjO.celDuga+sjO.celCijepana+sjO.skart;
          const sjOCijL = sjO.ogrDugi+sjO.ogrCijepani+sjO.gule;
          const otOCijC = otO.celDuga+otO.celCijepana+otO.skart;
          const otOCijL = otO.ogrDugi+otO.ogrCijepani+otO.gule;
          extraTable = `
            <div style="margin-top:16px;background:#f8fafc;border-radius:12px;overflow:hidden;">
              <div style="padding:10px 14px 4px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:.5px;">Evidencija sječe</div>
              <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#e2e8f0;">
                    <th style="padding:7px 10px;font-size:12px;text-align:left;color:#475569;font-weight:600;">Sortiment</th>
                    <th style="padding:7px 10px;font-size:12px;text-align:right;color:#15803d;font-weight:600;">Sječa<br><span style="font-size:10px;">${PLAN_YEAR}</span></th>
                    <th style="padding:7px 10px;font-size:12px;text-align:right;color:#92400e;font-weight:600;">Otpr.<br><span style="font-size:10px;">${PLAN_YEAR}</span></th>
                    <th style="padding:7px 10px;font-size:12px;text-align:right;color:#4b5563;font-weight:600;">Sječa<br><span style="font-size:10px;">${prevYear}</span></th>
                    <th style="padding:7px 10px;font-size:12px;text-align:right;color:#6b7280;font-weight:600;">Otpr.<br><span style="font-size:10px;">${prevYear}</span></th>
                  </tr>
                </thead>
                <tbody>
                  ${row('TRUPCI Č',   sj.cTrupci, ot.cTrupci, sjO.cTrupci, otO.cTrupci, false)}
                  ${row('CIJEPANO Č', sjCijC, otCijC, sjOCijC, otOCijC, false)}
                  ${row('TRUPCI L',   sj.lTrupci, ot.lTrupci, sjO.lTrupci, otO.lTrupci, false)}
                  ${row('CIJEPANO L', sjCijL, otCijL, sjOCijL, otOCijL, false)}
                  ${row('UKUPNO',     sj.ukupno, ot.ukupno, sjO.ukupno, otO.ukupno, true)}
                </tbody>
              </table>
              </div>
            </div>`;
        }
      }

      body = `
        <div style="text-align:center;padding:20px 0 0;">
          <span style="background:${bg};color:${col};padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;">${label}</span>
          <div style="font-size:13px;color:#4b5563;margin-top:8px;">${note}</div>
        </div>
        ${extraTable}
        ${routeBtn}`;
    } else if (info.status === 'plan-2027') {
      body = `
        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:110px;">
            <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Gospodarska jedinica</div>
            <div style="font-weight:700;font-size:13px;">${gj}</div>
          </div>
          <div style="flex:0;min-width:50px;">
            <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Odsjek</div>
            <div style="font-weight:600;font-size:13px;">${odsjek}</div>
          </div>
          <span style="background:#dbeafe;color:#1e40af;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;align-self:flex-start;">Plan sječa 2027</span>
        </div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:12px;text-align:center;">
          <div style="font-size:28px;margin-bottom:4px;">📅</div>
          <div style="font-size:13px;font-weight:700;color:#1e40af;">Planiran za sječu u 2027. godini</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Odjel nije u planu sječe za ${PLAN_YEAR}. godinu.</div>
        </div>
        ${routeBtn}`;
    } else {
      const s       = info.status;
      const pct     = (info.pct||0).toFixed(1);
      const barW    = Math.min(100, Math.round(info.pct||0));
      const barCol  = (info.pct||0)>100 ? '#dc2626' : _getColor(s);
      const sj      = info.sjeca;
      const ot      = info.otpr;
      const hasOtpr = ot && ot.ukupno > 0;
      const zaliha  = sj.ukupno - (hasOtpr ? ot.ukupno : 0);
      const e       = _planEntries().find(x => _normKey(x.gj+' '+x.odjel) === _normKey(info.gj+' '+info.odjel)) || {};

      // Grupisani sortimenti
      const sjCijC = sj.celDuga + sj.celCijepana + sj.skart;
      const sjCijL = sj.ogrDugi + sj.ogrCijepani + sj.gule;
      const otCijC = ot.celDuga + ot.celCijepana + ot.skart;
      const otCijL = ot.ogrDugi + ot.ogrCijepani + ot.gule;

      // Sječa i otprema iz netekuće godine
      const so = info.sjecaOst || _emptySort();
      const oo = info.otprOst  || _emptySort();
      const hasOst = so.ukupno > 0 || oo.ukupno > 0;

      const td  = (v, col, bold) => `<td style="padding:7px 10px;font-size:13px;text-align:right;border-bottom:1px solid #f1f5f9;color:${col};${bold?'font-weight:700;':''}">${_fmt(v)}</td>`;
      const tdL = (v) => `<td style="padding:7px 10px;font-size:13px;border-bottom:1px solid #f1f5f9;color:#374151;">${v}</td>`;

      const grpRow = (label, sv, ov, pv) => {
        const z  = sv - (ov||0);
        const zC = z<0?'#dc2626':z===0?'#6b7280':'#059669';
        return `<tr>${tdL(label)}${td(sv,'#15803d',true)}${hasOtpr?td(ov,'#92400e',false)+td(z,zC,true):''}${td(pv,'#9ca3af',false)}</tr>`;
      };
      const subRow = (label, sv, ov) => {
        return `<tr style="background:#fafafa;">${tdL('<span style="font-size:12px;color:#6b7280;padding-left:10px;">↳ '+label+'</span>')}${td(sv,'#6b7280',false)}${hasOtpr?td(ov,'#9ca3af',false)+'<td style="border-bottom:1px solid #f1f5f9;"></td>':''}<td style="border-bottom:1px solid #f1f5f9;"></td></tr>`;
      };

      // Projekat + realizacija iz stanje-odjela cache
      const _sm = _getStanjeMap();
      const _stanjeKey = _normKey((info.gj||'') + ' ' + info.odjel);
      const _stanjeOd = _sm && _sm.get(_stanjeKey);
      let projekatSection = '';
      if (_stanjeOd && _stanjeOd.projekat && _stanjeOd.projekat.length) {
        const sortN = _stanjeOd.sortimentiNazivi;
        const proj  = _stanjeOd.projekat;
        const sj    = _stanjeOd.sjeca    || [];
        const lager = _stanjeOd.sumaLager || [];
        const fmtP  = v => (v === 0 || v == null) ? '—' : Number(v).toFixed(2);
        const getV  = (arr, name) => { const i = sortN.findIndex(s => s === name); return i >= 0 ? (arr[i] ?? null) : null; };

        const pC  = getV(proj,  'ČETINARI'), pL  = getV(proj,  'LIŠĆARI'), pSveu = getV(proj,  'SVEUKUPNO');
        const sC  = getV(sj,    'ČETINARI'), sL  = getV(sj,    'LIŠĆARI'), sSveu = getV(sj,    'SVEUKUPNO');
        const zC  = getV(lager, 'ČETINARI'), zL  = getV(lager, 'LIŠĆARI'), zSveu = getV(lager, 'SVEUKUPNO');

        const pctC = (pC && pC > 0 && sC != null) ? Math.min(999, sC / pC * 100).toFixed(1) : null;
        const pctL = (pL && pL > 0 && sL != null) ? Math.min(999, sL / pL * 100).toFixed(1) : null;
        const pctSveu = (pSveu && pSveu > 0 && sSveu != null) ? Math.min(999, sSveu / pSveu * 100).toFixed(1) : null;

        const col3 = (label, pV, sV, zV, pct, accentC, accentL) => {
          const zCol = (zV != null && zV < 0) ? '#dc2626' : '#059669';
          return `
          <div style="background:white;border-radius:8px;padding:8px 10px;flex:1;min-width:90px;border:1px solid #fde68a;">
            <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px;">${label}</div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">
              <span style="font-size:10px;color:#6b7280;">Proj.</span>
              <span style="font-size:13px;font-weight:700;color:${accentC};">${fmtP(pV)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">
              <span style="font-size:10px;color:#6b7280;">Sječa</span>
              <span style="font-size:13px;font-weight:700;color:#15803d;">${fmtP(sV)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <span style="font-size:10px;color:#6b7280;">Zaliha</span>
              <span style="font-size:13px;font-weight:700;color:${zCol};">${fmtP(zV)}</span>
            </div>
            ${pct != null ? `<div style="margin-top:5px;height:4px;background:#f3f4f6;border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(100,parseFloat(pct))}%;background:${parseFloat(pct)>=100?'#dc2626':'#15803d'};border-radius:2px;"></div>
            </div>
            <div style="text-align:right;font-size:10px;font-weight:700;color:${parseFloat(pct)>=100?'#dc2626':'#6b7280'};margin-top:1px;">${pct}%</div>` : ''}
          </div>`;
        };

        projekatSection = `
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 16px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📋 Realizacija projekta (stanje zaliha)</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${pC  != null ? col3('Četinari',  pC,  sC,  zC,  pctC,  '#1e40af', '') : ''}
              ${pL  != null ? col3('Lišćari',   pL,  sL,  zL,  pctL,  '#92400e', '') : ''}
              ${pSveu != null ? col3('Ukupno',  pSveu, sSveu, zSveu, pctSveu, '#5b21b6', '') : ''}
            </div>
          </div>`;
      }

      // Kompaktna sekcija godišnjeg plana (ide na dno)
      const godisnjiPlanSection = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;margin-bottom:10px;">
          <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">📋 Godišnji plan ${PLAN_YEAR}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <div style="background:white;border-radius:6px;padding:4px 8px;text-align:center;flex:1;min-width:60px;border:1px solid #bbf7d0;">
              <div style="font-size:10px;color:#6b7280;">Bruto</div>
              <div style="font-weight:700;font-size:12px;color:#374151;">${_fmt(e.bruto||0)}</div>
            </div>
            <div style="background:white;border-radius:6px;padding:4px 8px;text-align:center;flex:1;min-width:60px;border:1px solid #bbf7d0;">
              <div style="font-size:10px;color:#6b7280;">Neto</div>
              <div style="font-weight:700;font-size:12px;color:#166534;">${_fmt(e.neto||0)}</div>
            </div>
            ${(e.cTrupci||0)>0?`<div style="background:white;border-radius:6px;padding:4px 8px;text-align:center;flex:1;min-width:60px;border:1px solid #bbf7d0;"><div style="font-size:10px;color:#6b7280;">Trp.Č</div><div style="font-weight:700;font-size:12px;color:#1e40af;">${_fmt(e.cTrupci)}</div></div>`:''}
            ${(e.cijepanoC||0)>0?`<div style="background:white;border-radius:6px;padding:4px 8px;text-align:center;flex:1;min-width:60px;border:1px solid #bbf7d0;"><div style="font-size:10px;color:#6b7280;">Cij.Č</div><div style="font-weight:700;font-size:12px;color:#1e40af;">${_fmt(e.cijepanoC)}</div></div>`:''}
            ${(e.lTrupci||0)>0?`<div style="background:white;border-radius:6px;padding:4px 8px;text-align:center;flex:1;min-width:60px;border:1px solid #bbf7d0;"><div style="font-size:10px;color:#6b7280;">Trp.L</div><div style="font-weight:700;font-size:12px;color:#92400e;">${_fmt(e.lTrupci)}</div></div>`:''}
            ${(e.cijepanoL||0)>0?`<div style="background:white;border-radius:6px;padding:4px 8px;text-align:center;flex:1;min-width:60px;border:1px solid #bbf7d0;"><div style="font-size:10px;color:#6b7280;">Cij.L</div><div style="font-weight:700;font-size:12px;color:#92400e;">${_fmt(e.cijepanoL)}</div></div>`:''}
          </div>
        </div>`;

      body = `
        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:110px;">
            <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Gospodarska jedinica</div>
            <div style="font-weight:700;font-size:13px;">${gj}</div>
          </div>
          <div style="flex:0;min-width:50px;">
            <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Odsjek</div>
            <div style="font-weight:600;font-size:13px;">${odsjek}</div>
          </div>
          <span style="background:${statusBg[s]};color:${statusColor[s]};padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;align-self:flex-start;">${statusLabel[s]||s}</span>
        </div>

        ${projekatSection}

        <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:600;color:#374151;">Realizacija plana ${PLAN_YEAR}</span>
            <span style="font-size:16px;font-weight:800;color:${statusColor[s]};">${pct}%</span>
          </div>
          <div style="height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;margin-bottom:8px;">
            <div style="height:100%;width:${barW}%;background:${barCol};border-radius:3px;"></div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <div style="background:white;border-radius:7px;padding:4px 8px;text-align:center;flex:1;min-width:60px;">
              <div style="font-size:10px;color:#6b7280;">Sječa ${PLAN_YEAR}</div>
              <div style="font-weight:800;font-size:13px;color:#15803d;">${_fmt(sj.ukupno)}</div>
            </div>
            ${hasOtpr?`
            <div style="background:white;border-radius:7px;padding:4px 8px;text-align:center;flex:1;min-width:60px;">
              <div style="font-size:10px;color:#6b7280;">Otprema</div>
              <div style="font-weight:800;font-size:13px;color:#b45309;">${_fmt(ot.ukupno)}</div>
            </div>
            <div style="background:white;border-radius:7px;padding:4px 8px;text-align:center;flex:1;min-width:60px;">
              <div style="font-size:10px;color:#6b7280;">Zaliha</div>
              <div style="font-weight:800;font-size:13px;color:${zaliha<0?'#dc2626':'#1d4ed8'};">${_fmt(zaliha)}</div>
            </div>`:''}
            <div style="background:white;border-radius:7px;padding:4px 8px;text-align:center;flex:1;min-width:60px;">
              <div style="font-size:10px;color:#6b7280;">Plan neto</div>
              <div style="font-weight:800;font-size:13px;color:#4b5563;">${_fmt(info.neto)}</div>
            </div>
          </div>
        </div>

        ${s === 'posjeceno' && info.datumPocetka ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px;margin-bottom:10px;display:flex;gap:6px;">
          <div style="background:white;border-radius:7px;padding:4px 8px;text-align:center;flex:1;border:1px solid #bbf7d0;">
            <div style="font-size:10px;color:#6b7280;">Početak sječe</div>
            <div style="font-weight:800;font-size:13px;color:#166534;">${_fmtDatum(info.datumPocetka)}</div>
          </div>
          <div style="background:white;border-radius:7px;padding:4px 8px;text-align:center;flex:1;border:1px solid #bbf7d0;">
            <div style="font-size:10px;color:#6b7280;">Kraj sječe</div>
            <div style="font-weight:800;font-size:13px;color:#166534;">${_fmtDatum(info.datumKraja)}</div>
          </div>
        </div>` : ''}

        <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;">Sortimenti — ${PLAN_YEAR}</div>
        <div style="border-radius:10px;overflow:hidden;border:1px solid #f1f5f9;margin-bottom:10px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#e2e8f0;">
            <th style="padding:5px 8px;font-size:11px;text-align:left;color:#475569;font-weight:600;">Sortiment</th>
            <th style="padding:5px 8px;font-size:11px;text-align:right;color:#15803d;font-weight:600;">Sječa</th>
            ${hasOtpr?'<th style="padding:5px 8px;font-size:11px;text-align:right;color:#b45309;font-weight:600;">Otpr.</th><th style="padding:5px 8px;font-size:11px;text-align:right;color:#1d4ed8;font-weight:600;">Zal.</th>':''}
            <th style="padding:5px 8px;font-size:11px;text-align:right;color:#6b7280;font-weight:600;">Plan</th>
          </tr></thead>
          <tbody>
            ${grpRow('TRUPCI Č',   sj.cTrupci, ot.cTrupci, e.cTrupci||0)}
            ${grpRow('CIJEPANO Č', sjCijC,     otCijC,     e.cijepanoC||0)}
            ${subRow('Cel.duga',   sj.celDuga,    ot.celDuga)}
            ${subRow('Cel.cijepana',sj.celCijepana,ot.celCijepana)}
            ${subRow('Škart',      sj.skart,      ot.skart)}
            ${grpRow('TRUPCI L',   sj.lTrupci, ot.lTrupci, e.lTrupci||0)}
            ${grpRow('CIJEPANO L', sjCijL,     otCijL,     e.cijepanoL||0)}
            ${subRow('Ogr.dugi',   sj.ogrDugi,    ot.ogrDugi)}
            ${subRow('Ogr.cijepani',sj.ogrCijepani,ot.ogrCijepani)}
            ${subRow('Gule',       sj.gule,       ot.gule)}
            <tr style="background:#e2e8f0;font-weight:800;border-top:2px solid #cbd5e1;">
              <td style="padding:6px 8px;font-size:12px;">UKUPNO</td>
              <td style="padding:6px 8px;font-size:12px;text-align:right;color:#15803d;">${_fmt(sj.ukupno)}</td>
              ${hasOtpr?`<td style="padding:6px 8px;font-size:12px;text-align:right;color:#b45309;">${_fmt(ot.ukupno)}</td>
              <td style="padding:6px 8px;font-size:12px;text-align:right;color:${zaliha<0?'#dc2626':'#1d4ed8'};">${_fmt(zaliha)}</td>`:''}
              <td style="padding:6px 8px;font-size:11px;text-align:right;color:#6b7280;">${_fmt(info.neto)}</td>
            </tr>
          </tbody>
        </table>
        </div>

        ${hasOst ? (() => {
          const prevYear = PLAN_YEAR - 1;
          const soCijC = so.celDuga+so.celCijepana+so.skart;
          const soCijL = so.ogrDugi+so.ogrCijepani+so.gule;
          const ooCijC = oo.celDuga+oo.celCijepana+oo.skart;
          const ooCijL = oo.ogrDugi+oo.ogrCijepani+oo.gule;
          const rowO = (lbl, sv, ov, bold) => {
            const bS = bold?'font-weight:700;font-size:13px;':'font-size:13px;';
            return `<tr${bold?' style="background:#f8fafc;"':''}>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;${bS}">${lbl}</td>
              <td style="padding:7px 10px;font-size:13px;text-align:right;border-bottom:1px solid #f1f5f9;color:#15803d;${bold?'font-weight:700;':''}">${_fmt(sv)}</td>
              <td style="padding:7px 10px;font-size:13px;text-align:right;border-bottom:1px solid #f1f5f9;color:#92400e;${bold?'font-weight:700;':''}">${_fmt(ov)}</td>
            </tr>`;
          };
          return `<div style="margin-bottom:12px;border-radius:12px;overflow:hidden;border:1px solid #fde68a;">
            <div style="background:#fffbeb;padding:8px 14px 4px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.5px;">⚠️ Sječa ${prevYear} (prethodna godina)</div>
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr style="background:#fef9c3;">
                <th style="padding:6px 10px;font-size:12px;text-align:left;color:#78350f;font-weight:600;">Sortiment</th>
                <th style="padding:6px 10px;font-size:12px;text-align:right;color:#15803d;font-weight:600;">Sječa</th>
                <th style="padding:6px 10px;font-size:12px;text-align:right;color:#92400e;font-weight:600;">Otprema</th>
              </tr></thead>
              <tbody>
                ${rowO('TRUPCI Č',   so.cTrupci, oo.cTrupci, false)}
                ${rowO('CIJEPANO Č', soCijC, ooCijC, false)}
                ${rowO('TRUPCI L',   so.lTrupci, oo.lTrupci, false)}
                ${rowO('CIJEPANO L', soCijL, ooCijL, false)}
                ${rowO('UKUPNO',     so.ukupno, oo.ukupno, true)}
              </tbody>
            </table>
            </div>
          </div>`;
        })() : ''}
        ${godisnjiPlanSection}
        ${routeBtn}`;
    }

    document.getElementById('mapa-modal-body').innerHTML = body;
    document.getElementById('mapa-modal').style.display = 'flex';
  }

  window.closeMapaModal = function() {
    document.getElementById('mapa-modal').style.display = 'none';
  };

  // ---- FOKUS MODE ----
  window.toggleMapaFokus = function() {
    document.body.classList.toggle('mapa-fokus');
    const active = document.body.classList.contains('mapa-fokus');
    const btn = document.getElementById('karta-fokus-btn');
    if (btn) {
      btn.textContent = active ? '✕ Fokus' : '⛶ Fokus';
      btn.classList.toggle('active', active);
    }
    if (_map) setTimeout(() => _map.invalidateSize(), 50);
  };

  // ---- OSM / SATELIT / TOPO ---- (v1.4.122: dodat treći sloj, ciklično dugme,
  // isti obrazac kao js/mapa-radnika.js)
  let _baseMode = 'topo'; // 'osm' | 'sat' | 'topo' — default TOPO (izohipse/konture, v1.4.124)
  let _topoLayer = null;
  window.toggleMapaSat = function() {
    if (_osmLayer) _map.removeLayer(_osmLayer);
    if (_satLayer) _map.removeLayer(_satLayer);
    if (_topoLayer) _map.removeLayer(_topoLayer);

    _baseMode = _baseMode === 'osm' ? 'sat' : (_baseMode === 'sat' ? 'topo' : 'osm');
    _isSat = _baseMode === 'sat';

    if (_baseMode === 'sat') {
      if (!_satLayer) {
        _satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution:'© Esri',
          maxZoom: 19,
        });
      }
      _satLayer.addTo(_map);
    } else if (_baseMode === 'topo') {
      if (!_topoLayer) {
        _topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenTopoMap (CC-BY-SA)', maxZoom: 17
        });
      }
      _topoLayer.addTo(_map);
    } else {
      if (_osmLayer) _osmLayer.addTo(_map);
    }
    const btn = document.getElementById('karta-sat-btn');
    if (btn) btn.textContent = _baseMode === 'osm' ? '🛰️ Satelit' : (_baseMode === 'sat' ? '⛰️ Topo' : '🗺️ OSM');
  };

  // ---- OFFLINE PREUZIMANJE — SAMO PLOČICE KOJE POKRIVAJU POLIGONE ----
  // Isti obrazac kao js/mapa-radnika.js mapaRadnikaDownloadOffline: umjesto
  // jednog velikog kvadrata oko svih odjela, pločice se biraju po SVAKOM odjelu
  // posebno (okvir + rezerva), pa se ne skida rijeka/njive/susjedne općine.
  // Ovdje se uzimaju SAMO odjeli koji su trenutno vidljivi (prošli filtere
  // legende/GJ/pretrage) — admin tako sam bira opseg postojećim filterima.
  const OFFLINE_BUFFER_M_KARTA = 200;
  const OFFLINE_Z_MIN_KARTA = 11;
  // Max zoom po sloju — usklađeno sa stvarnim maxZoom L.tileLayer vrijednostima
  // niže (OSM 18, Satelit/ArcGIS 19, Topo 17 — OpenTopoMap-ov stvarni serverski
  // maksimum). Vidi identičnu logiku u js/mapa-radnika.js (nije zajednički kod).
  const OFFLINE_Z_MAX_KARTA_BY_MODE = { osm: 18, sat: 19, topo: 17 };
  function _offlineZMaxKarta(mode) { return OFFLINE_Z_MAX_KARTA_BY_MODE[mode] || 17; }

  function _tilesForBoundsListKarta(boundsList, zMin, zMax, bufferM) {
    const seen = {};
    const tiles = [];
    boundsList.forEach(b => {
      const latBuf = bufferM / 111320;
      const midLat = (b.getNorth() + b.getSouth()) / 2;
      const lngBuf = bufferM / (111320 * Math.cos(midLat * Math.PI / 180));
      const w = b.getWest() - lngBuf, e = b.getEast() + lngBuf;
      const s = b.getSouth() - latBuf, n = b.getNorth() + latBuf;
      for (let z = zMin; z <= zMax; z++) {
        const nw = _lonLatToTileKarta(w, n, z);
        const se = _lonLatToTileKarta(e, s, z);
        for (let x = nw.x; x <= se.x; x++) {
          for (let y = nw.y; y <= se.y; y++) {
            const k = `${z}/${x}/${y}`;
            if (seen[k]) continue;
            seen[k] = 1;
            tiles.push({ z, x, y });
          }
        }
      }
    });
    return tiles;
  }
  function _offlineSizeMbKarta(brojPlocica, mode) {
    const kbPo = mode === 'sat' ? 25 : 15;
    return Math.round(brojPlocica * kbPo / 1024);
  }
  function _lonLatToTileKarta(lon, lat, z) {
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, z));
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z));
    return { x, y };
  }
  function _tileUrlKarta(t) {
    const subdomains = ['a', 'b', 'c'];
    const s = subdomains[(t.x + t.y) % subdomains.length];
    if (_baseMode === 'sat') return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${t.z}/${t.y}/${t.x}`;
    if (_baseMode === 'topo') return `https://${s}.tile.opentopomap.org/${t.z}/${t.x}/${t.y}.png`;
    return `https://${s}.tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
  }
  window.downloadKartaOffline = async function() {
    if (!_map || !_allFeatures.length) { alert('Odjeli još nisu učitani.'); return; }
    const btn = document.getElementById('karta-offline-btn');
    // Samo vidljivi odjeli (prošli sve aktivne filtere); ako je filter sakrio
    // sve, padni nazad na sve učitane da dugme nikad ne bude "mrtvo".
    let vidljivi = _allFeatures.filter(lyr => _map.hasLayer(lyr));
    if (!vidljivi.length) vidljivi = _allFeatures;
    const boundsList = vidljivi.map(lyr => lyr.getBounds());
    const zMaxKarta = _offlineZMaxKarta(_baseMode);
    const tiles = _tilesForBoundsListKarta(boundsList, OFFLINE_Z_MIN_KARTA, zMaxKarta, OFFLINE_BUFFER_M_KARTA);
    if (!tiles.length) return;
    const slojNaziv = _baseMode === 'sat' ? 'Satelit' : (_baseMode === 'topo' ? 'Topo' : 'OSM');
    if (!confirm(`Preuzeti ${tiles.length} pločica (~${_offlineSizeMbKarta(tiles.length, _baseMode)} MB, ${slojNaziv}, zoom ${OFFLINE_Z_MIN_KARTA}-${zMaxKarta})?\n\n` +
      `Skida se samo područje oko odjela (${vidljivi.length} poligona, +${OFFLINE_BUFFER_M_KARTA} m rezerve), ne cijeli kvadrat oko njih. ` +
      `Može potrajati i potrošiti mobilne podatke.`)) return;

    if (btn) btn.disabled = true;
    let done = 0, failed = 0;
    for (let i = 0; i < tiles.length; i++) {
      try { await fetch(_tileUrlKarta(tiles[i])); done++; } catch (_) { failed++; }
      if (btn) btn.textContent = `⬇️ ${done}/${tiles.length}`;
    }
    if (btn) { btn.disabled = false; btn.textContent = '⬇️ Offline'; }
    alert(`Preuzeto ${done} od ${tiles.length} pločica (${slojNaziv}) za offline korištenje.`);
  };

  // ---- PRETRAGA ----
  // NAPOMENA: show/hide odluku sad u potpunosti radi applyKartaFilter() (jedini
  // izvor istine za GJ/status/legenda-checkbox/otprema/pretraga filtere
  // zajedno) — ranije je ova funkcija sama radila nezavisan add/removeLayer
  // prolaz SAMO po tekstu pretrage, zaobilazeći sve ostale aktivne filtere
  // (npr. otkačen checkbox u legendi bi ipak ponovo prikazao odjel čim se
  // nešto ukuca u pretragu). Ovdje se sad samo dodaje "skoči na prvi
  // pronađeni + kratko istakni" iznad zajedničkog filtriranja.
  window.searchKartaOdjel = function() {
    applyKartaFilter();
    const term = (document.getElementById('karta-search') || {}).value || '';
    const q    = term.trim().toUpperCase();
    if (!q) return;

    let found = null;
    _allFeatures.forEach(lyr => {
      if (found || !_map.hasLayer(lyr)) return; // samo među odjelima koji su i dalje vidljivi (prošli sve filtere)
      const p = lyr._kartaProps || {};
      const o = String(p.odjel || p.name || '').trim().toUpperCase();
      const g = String(p.gj || '').trim().toUpperCase();
      if (o === q || o.startsWith(q) || g.includes(q)) found = lyr;
    });

    if (found) {
      const b = found.getBounds ? found.getBounds() : null;
      if (b && b.isValid()) _map.fitBounds(b, { padding:[60,60], maxZoom:14 });
      found.setStyle(_getHoverStyle(found._kartaStatus));
      setTimeout(() => { if (_layer) _layer.resetStyle(found); }, 2000);
    }
  };

  window.clearKartaSearch = function() {
    const inp = document.getElementById('karta-search');
    if (inp) inp.value = '';
    applyKartaFilter();
  };

  // ---- FILTER ----
  window.applyKartaFilter = function() {
    // Šumsko uzgojni radovi mod — SVI poligoni ostaju vidljivi (kontekst
    // ostalih odjela na mapi), ali su slucajni/zapisnik istaknuti punom
    // bojom preko _styleForMode-a (style: callback u _renderLayer), a sve
    // ostalo je zatamnjeno (_UZGOJNI_DIM_STYLE). Proizvodnja-specifični
    // filteri (GJ/status/pretraga/otprema/sanitar/legenda) su sakriveni u
    // ovom modu, pa se ovdje ne primjenjuju.
    if (_prikazMode === 'uzgojni') {
      _allFeatures.forEach(lyr => {
        if (!_map.hasLayer(lyr)) lyr.addTo(_map);
        if (_layer) _layer.resetStyle(lyr);
      });
      const info = document.getElementById('karta-otprema-info');
      if (info) info.style.display = 'none';
      return;
    }

    const gjF = (document.getElementById('karta-filter-gj')     || {}).value || 'sve';
    const stF = (document.getElementById('karta-filter-status') || {}).value || 'sve';
    const q   = ((document.getElementById('karta-search')       || {}).value || '').trim().toUpperCase();
    _otpremaMode = (document.getElementById('karta-otprema-toggle') || {}).checked || false;
    const sanitarOn = (document.getElementById('karta-sanitar-toggle') || {}).checked || false;

    // Legenda checkboxovi — isključi boju/status da sakriješ sve odjele tog
    // statusa. "bez-plana" nema checkbox u legendi pa uvijek prolazi
    // (nije predstavljen tamo, ne treba ga moći sakriti odavde).
    const legendOn = {};
    document.querySelectorAll('.karta-legend-toggle').forEach(cb => { legendOn[cb.dataset.status] = cb.checked; });

    let otpremaBroj = 0;
    _allFeatures.forEach(lyr => {
      const p   = lyr._kartaProps || {};
      const o   = String(p.odjel || p.name || '').trim().toUpperCase();
      const gjM = gjF === 'sve' || lyr._kartaGj === gjF;
      const stM = stF === 'sve' || lyr._kartaStatus === stF;
      const qM  = !q || o.startsWith(q) || String(p.gj||'').toUpperCase().includes(q);
      const legendM = lyr._kartaStatus === 'bez-plana' || legendOn[lyr._kartaStatus] !== false;
      // U režimu otpreme prikaži SAMO odjele s otpremom u tekućem mjesecu
      // (uključujući bez-plana/prelazne) — ostali se sakriju.
      const otM = !_otpremaMode || (lyr._kartaOtpremaMjesec > 0);
      // Slučajni/zapisnik su se preselili isključivo u Šumsko uzgojni radovi
      // prikaz — na Proizvodnji se nikad ne prikazuju (nema više legend
      // checkboxa za njih). Sanitar se gate-uje novim "Prikaži sanitar"
      // checkboxom, podrazumijevano isključen.
      const kategM = lyr._kartaStatus !== 'slucajni' && lyr._kartaStatus !== 'zapisnik';
      const sanM   = lyr._kartaStatus !== 'sanitar' || sanitarOn;

      if (gjM && stM && qM && legendM && otM && kategM && sanM) {
        if (!_map.hasLayer(lyr)) lyr.addTo(_map);
        if (_otpremaMode) { lyr.setStyle(_getOtpremaStyle(lyr._kartaStatus)); otpremaBroj++; }
        else if (_layer)  { _layer.resetStyle(lyr); }
      } else {
        if (_map.hasLayer(lyr))  _map.removeLayer(lyr);
      }
    });

    // Info traka pored checkboxa — koliko odjela ima otpremu i za koji mjesec
    const info = document.getElementById('karta-otprema-info');
    if (info) {
      if (_otpremaMode) {
        const naziv = (_statusMap && _statusMap._otpremaMjesecNaziv) || 'tekući mjesec';
        info.textContent = `${otpremaBroj} odjela s otpremom — ${naziv}`;
        info.style.display = 'inline';
      } else {
        info.style.display = 'none';
      }
    }
  };

  // ---- SWITCH Proizvodnja ⇄ Šumsko uzgojni radovi ----
  window.switchKartaOdjelaMode = function(mode) {
    _prikazMode = (mode === 'uzgojni') ? 'uzgojni' : 'proizvodnja';

    const bProizvodnja = document.getElementById('karta-mode-proizvodnja-btn');
    const bUzgojni      = document.getElementById('karta-mode-uzgojni-btn');
    if (bProizvodnja) bProizvodnja.classList.toggle('active', _prikazMode === 'proizvodnja');
    if (bUzgojni)      bUzgojni.classList.toggle('active', _prikazMode === 'uzgojni');

    const filteri = document.getElementById('karta-proizvodnja-filteri');
    if (filteri) filteri.classList.toggle('hidden', _prikazMode === 'uzgojni');
    const panel = document.getElementById('karta-uzgojni-panel');
    if (panel) panel.classList.toggle('hidden', _prikazMode !== 'uzgojni');
    const mapEl = document.getElementById('karta-odjela-map');
    if (mapEl) mapEl.classList.toggle('kod-uzgojni', _prikazMode === 'uzgojni');

    // Fokus mod koristi !important visinu na #karta-odjela-map (index.html)
    // koja bi pregazila smanjenu visinu za Uzgojni panel — prostor za panel
    // je baš ono što Fokus mod oduzima, pa se izlaz iz Fokusa čisto rješava
    // izlaskom iz njega. Ruta-mod se čisti u oba smjera (simetrija sa
    // toggleOdjelRutaMode() koji već čisti stare rute pri ulasku).
    if (_prikazMode === 'uzgojni') {
      if (document.body.classList.contains('mapa-fokus')) window.toggleMapaFokus();
      if (_odjelRutaMode) window.toggleOdjelRutaMode();
    } else if (_odjelRutaMode) {
      window.toggleOdjelRutaMode();
    }

    applyKartaFilter();
    if (_map) setTimeout(() => _map.invalidateSize(), 50);

    if (_prikazMode === 'uzgojni') {
      _renderUzgojniPanel();
      _popuniKlopkaGjSelect();
      const datumEl = document.getElementById('klopka-datum');
      if (datumEl && !datumEl.value) datumEl.value = new Date().toISOString().slice(0, 10);
      _fetchKlopkeCached();
    } else {
      // Napusti pick mod i ukloni neposlani marker pri izlasku iz Uzgojni moda
      _klopkaPickMode = false;
      if (_klopkaPickMarker) { _map.removeLayer(_klopkaPickMarker); _klopkaPickMarker = null; }
      if (_klopkeLayer && _map.hasLayer(_klopkeLayer)) _map.removeLayer(_klopkeLayer);
    }
  };

  // ---- ŠUMSKO UZGOJNI RADOVI: lista slučajnih/zapisnik odjela ----
  // Isti izvor podataka (lyr._kartaStatus, lyr._kartaExtra) kao mapa —
  // garantuje da su lista i obojeni poligoni UVIJEK u skladu (isti Setovi,
  // ista _buildStatusMap petlja).
  let _uzgojniRedovi = [];
  function _renderUzgojniPanel() {
    const lista = document.getElementById('karta-uzgojni-lista');
    if (!lista) return;

    const seen = new Map(); // labelKey → { odjel, gj, kategorija, extra, lyr }
    _allFeatures.forEach(lyr => {
      const st = lyr._kartaStatus;
      if (st !== 'slucajni' && st !== 'zapisnik') return;
      const p     = lyr._kartaProps || {};
      const odjel = String(p.odjel || p.name || '').trim();
      const gj    = String(p.gj || '').trim();
      const key   = _labelKey(gj + ' ' + odjel);
      if (!seen.has(key)) seen.set(key, { odjel, gj, kategorija: st, extra: lyr._kartaExtra, lyr });
    });

    _uzgojniRedovi = [...seen.values()].sort((a, b) => a.odjel.localeCompare(b.odjel, 'bs'));

    if (!_uzgojniRedovi.length) {
      lista.innerHTML = '<div style="font-size:12px;color:#6b7280;padding:8px 0;">Nema slučajnih užitaka ni zapisnik odjela za tekuću godinu.</div>';
      return;
    }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
      '<thead><tr style="text-align:left;color:#6b7280;">' +
      '<th style="padding:6px 8px;">Odjel</th><th style="padding:6px 8px;">GJ</th>' +
      '<th style="padding:6px 8px;">Kategorija</th>' +
      '<th style="padding:6px 8px;text-align:right;">Sječa</th>' +
      '<th style="padding:6px 8px;text-align:right;">Otprema</th></tr></thead><tbody>';
    _uzgojniRedovi.forEach((r, i) => {
      const sj    = (r.extra && r.extra.sjeca && r.extra.sjeca.ukupno) || 0;
      const ot    = (r.extra && r.extra.otpr  && r.extra.otpr.ukupno)  || 0;
      const boja  = r.kategorija === 'slucajni' ? '#7c3aed' : '#0d9488';
      const naziv = r.kategorija === 'slucajni' ? 'Slučajni' : 'Zapisnik';
      html += `<tr style="border-top:1px solid #f1f5f9;cursor:pointer;" onclick="_klikUzgojniRed(${i})">` +
        `<td style="padding:6px 8px;font-weight:600;">${r.odjel}</td>` +
        `<td style="padding:6px 8px;">${r.gj}</td>` +
        `<td style="padding:6px 8px;"><span style="background:${boja}22;color:${boja};font-weight:700;padding:2px 8px;border-radius:10px;">${naziv}</span></td>` +
        `<td style="padding:6px 8px;text-align:right;">${_fmt(sj)}</td>` +
        `<td style="padding:6px 8px;text-align:right;">${_fmt(ot)}</td></tr>`;
    });
    html += '</tbody></table>';
    lista.innerHTML = html;
  }
  window._klikUzgojniRed = function(i) {
    const r = _uzgojniRedovi[i];
    if (!r || !r.lyr) return;
    const center = _centroid(r.lyr);
    if (center) _openDetaljiModal(r.lyr._kartaProps, r.lyr._kartaInfo, center, r.lyr._kartaExtra);
  };

  // ---- FEROMONSKE KLOPKE ----
  let _klopke = [];
  let _klopkaPickMode   = false; // true dok se čeka klik na mapu za poziciju klopke
  let _klopkaPickMarker = null;  // draggable marker — trenutno postavljena pozicija (nije još poslana)
  let _klopkeLayer      = null;  // grupa markera VEĆ sačuvanih klopki (samo Uzgojni mod)

  function _popuniKlopkaGjSelect() {
    const sel = document.getElementById('klopka-gj-select');
    if (!sel || sel.dataset.popunjeno) return;
    const gjevi = new Set();
    _allFeatures.forEach(lyr => {
      const gj = String((lyr._kartaProps || {}).gj || '').trim();
      if (gj) gjevi.add(gj);
    });
    const sorted = [...gjevi].sort((a, b) => a.localeCompare(b, 'bs'));
    sel.innerHTML = '<option value="">— GJ —</option>' +
      sorted.map(g => `<option value="${g.replace(/"/g, '&quot;')}">${g}</option>`).join('');
    sel.dataset.popunjeno = '1';
  }

  window.klopkaGjPromijenjen = function() {
    const gj = (document.getElementById('klopka-gj-select') || {}).value || '';
    const odjelSel = document.getElementById('klopka-odjel-select');
    if (!odjelSel) return;
    if (!gj) {
      odjelSel.innerHTML = '<option value="">— Odjel —</option>';
      odjelSel.disabled = true;
    } else {
      const odjeli = new Set();
      _allFeatures.forEach(lyr => {
        const p = lyr._kartaProps || {};
        if (String(p.gj || '').trim() === gj) {
          const odjel = String(p.odjel || p.name || '').trim();
          if (odjel) odjeli.add(odjel);
        }
      });
      const sorted = [...odjeli].sort((a, b) => a.localeCompare(b, 'bs', { numeric: true }));
      odjelSel.innerHTML = '<option value="">— Odjel —</option>' +
        sorted.map(o => `<option value="${o.replace(/"/g, '&quot;')}">${o}</option>`).join('');
      odjelSel.disabled = false;
    }
    window.klopkaOdjelPromijenjen();
  };

  window.klopkaOdjelPromijenjen = function() {
    _osvjeziKlopkaPozicijaBtn();
    // Novi odjel = nova klopka — poništi eventualnu prethodno postavljenu
    // (ali još neposlanu) poziciju da se slučajno ne pošalje pogrešnom odjelu.
    if (_klopkaPickMarker) { _map.removeLayer(_klopkaPickMarker); _klopkaPickMarker = null; }
    _klopkaPickMode = false;
    _osvjeziKlopkaPozicijaUI();
  };

  function _osvjeziKlopkaPozicijaBtn() {
    const gj    = (document.getElementById('klopka-gj-select')    || {}).value || '';
    const odjel = (document.getElementById('klopka-odjel-select') || {}).value || '';
    const btn = document.getElementById('klopka-pozicija-btn');
    if (btn) btn.disabled = !(gj && odjel);
  }

  // Klik na dugme "Postavi poziciju" — zumira mapu na izabrani odjel i
  // uključuje "pick" mod: sljedeći klik na mapu (bilo na poligon bilo na
  // prazan prostor) postavlja marker klopke i mod se sam isključuje.
  window.toggleKlopkaPickMode = function() {
    const gj    = (document.getElementById('klopka-gj-select')    || {}).value || '';
    const odjel = (document.getElementById('klopka-odjel-select') || {}).value || '';
    if (!gj || !odjel) return;

    _klopkaPickMode = !_klopkaPickMode;
    const btn = document.getElementById('klopka-pozicija-btn');
    if (btn) {
      btn.classList.toggle('active', _klopkaPickMode);
      btn.textContent = _klopkaPickMode ? '🎯 Kliknite na mapu…' : '🎯 Postavi poziciju';
    }
    if (_klopkaPickMode && _map) {
      const key = _labelKey(gj + ' ' + odjel);
      let bounds = null;
      _allFeatures.forEach(lyr => {
        const p = lyr._kartaProps || {};
        const lKey = _labelKey((p.gj || '') + ' ' + (p.odjel || p.name || ''));
        if (lKey !== key) return;
        try { bounds = bounds ? bounds.extend(lyr.getBounds()) : lyr.getBounds(); } catch (_) {}
      });
      if (bounds && bounds.isValid()) _map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  };

  // Zajednička tačka za mapa-klik I poligon-klik (vidi _renderLayer) dok je
  // pick mod aktivan — postavlja/pomjera marker i sam isključuje pick mod
  // (jedan klik = gotovo; naknadno fino podešavanje ide preko drag-a).
  function _zavrsiKlopkaPick(latlng) {
    _placeKlopkaMarker(latlng);
    _klopkaPickMode = false;
    const btn = document.getElementById('klopka-pozicija-btn');
    if (btn) { btn.classList.remove('active'); btn.textContent = '🎯 Postavi poziciju'; }
  }

  function _placeKlopkaMarker(latlng) {
    if (_klopkaPickMarker) {
      _klopkaPickMarker.setLatLng(latlng);
    } else {
      _klopkaPickMarker = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({ className: 'klopka-pick-marker', html: '🪤', iconSize: [26, 26], iconAnchor: [13, 24] })
      }).addTo(_map);
      _klopkaPickMarker.on('dragend', _osvjeziKlopkaPozicijaUI);
    }
    _osvjeziKlopkaPozicijaUI();
  }

  function _osvjeziKlopkaPozicijaUI() {
    const el = document.getElementById('klopka-pozicija-info');
    if (!el) return;
    if (_klopkaPickMarker) {
      const ll = _klopkaPickMarker.getLatLng();
      el.textContent = '📍 Pozicija postavljena (' + ll.lat.toFixed(5) + ', ' + ll.lng.toFixed(5) + ') — povucite marker za fino podešavanje';
      el.style.color = '#16a34a';
    } else {
      el.textContent = '⚠️ Pozicija nije postavljena';
      el.style.color = '#dc2626';
    }
  }

  window.dodajKlopkaOcitanje = async function() {
    const gj         = (document.getElementById('klopka-gj-select')    || {}).value || '';
    const odjelKrat  = (document.getElementById('klopka-odjel-select') || {}).value || '';
    const odjel      = gj && odjelKrat ? (gj + ' ' + odjelKrat) : odjelKrat;
    const brojKlopke = ((document.getElementById('klopka-broj')     || {}).value || '').trim();
    const vrsta      = ((document.getElementById('klopka-vrsta')    || {}).value || '').trim();
    const ulovRaw    = (document.getElementById('klopka-ulov')      || {}).value;
    const datum      = (document.getElementById('klopka-datum')     || {}).value || '';
    const napomena   = ((document.getElementById('klopka-napomena') || {}).value || '').trim();
    const statusEl   = document.getElementById('klopka-status');
    const ulov = parseInt(ulovRaw, 10);

    if (!gj || !odjelKrat || !brojKlopke || !vrsta || ulovRaw === '' || isNaN(ulov) || ulov < 0 || !_klopkaPickMarker) {
      if (statusEl) {
        statusEl.textContent = !_klopkaPickMarker
          ? '⚠️ Postavite poziciju klopke na mapi (dugme "🎯 Postavi poziciju").'
          : '⚠️ Popunite GJ, odjel, broj klopke, vrstu i broj ulova (0 ili veći).';
        statusEl.style.color = '#dc2626'; statusEl.style.display = 'block';
      }
      return;
    }

    const ll = _klopkaPickMarker.getLatLng();
    if (statusEl) { statusEl.textContent = '⏳ Šaljem...'; statusEl.style.color = '#6b7280'; statusEl.style.display = 'block'; }
    try {
      const url = buildApiUrl('add-klopka-ocitanje', {
        odjel, brojKlopke, vrsta, ulov, datumOcitanja: datum, napomena,
        lat: ll.lat, lng: ll.lng
      });
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const data = await r.json();
      if (!data || data.success !== true) throw new Error((data && data.error) || 'Greška');

      if (statusEl) { statusEl.textContent = '✅ Očitanje uneseno'; statusEl.style.color = '#16a34a'; }
      document.getElementById('klopka-broj').value = '';
      document.getElementById('klopka-vrsta').value = '';
      document.getElementById('klopka-ulov').value = '';
      document.getElementById('klopka-napomena').value = '';
      _map.removeLayer(_klopkaPickMarker);
      _klopkaPickMarker = null;
      _osvjeziKlopkaPozicijaUI();
      await _fetchKlopkeCached(true);
      setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2500);
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = '❌ ' + ((err && err.message) || 'Greška pri slanju');
        statusEl.style.color = '#dc2626';
      }
    }
  };

  // Isti obrazac kao fetchPreklasiranjaCached (js/app.js) — online: uvijek
  // svjež fetch, snimi u localStorage kao offline fallback; offline: vrati
  // keš. NAMJERNO ne fetchWithCache/smart TTL (može zadržati stare podatke
  // danima) — admin treba uvijek najnovije stanje kad otvori ovaj panel.
  async function _fetchKlopkeCached() {
    const CK = 'cache_klopke';
    const readCache = () => {
      try {
        const raw = localStorage.getItem(CK);
        if (raw) return JSON.parse(raw).data || { klopke: [] };
      } catch (_) {}
      return { klopke: [] };
    };
    let data;
    if (!navigator.onLine) {
      data = readCache();
    } else {
      try {
        const r = await fetch(buildApiUrl('get-klopke-ocitanja'), { signal: AbortSignal.timeout(20000) });
        data = await r.json();
        if (data && data.klopke) {
          try { localStorage.setItem(CK, JSON.stringify({ data, timestamp: Date.now() })); } catch (_) {}
        } else {
          data = readCache();
        }
      } catch (_) {
        data = readCache();
      }
    }
    _klopke = (data && data.klopke) || [];
    _renderKlopkeTabela();
    _renderKlopkeMarkers();
  }

  // Sačuvane klopke kao markeri na mapi (samo one sa validnom pozicijom —
  // stariji/uvezeni zapisi bez LAT/LNG se preskaču, ne mogu se prikazati).
  // Poseban sloj (ne _allFeatures) — čisti se u cjelini prije svakog crtanja.
  function _renderKlopkeMarkers() {
    if (!_map) return;
    if (_klopkeLayer) { _map.removeLayer(_klopkeLayer); _klopkeLayer = null; }
    if (_prikazMode !== 'uzgojni' || !_klopke.length) return;

    _klopkeLayer = L.layerGroup();
    _klopke.forEach(k => {
      const lat = parseFloat(k.lat), lng = parseFloat(k.lng);
      if (isNaN(lat) || isNaN(lng)) return;
      const m = L.marker([lat, lng], {
        icon: L.divIcon({ className: 'klopka-saved-marker', html: '🪤', iconSize: [20, 20], iconAnchor: [10, 18] })
      });
      const esc = typeof escapeHtml === 'function' ? escapeHtml : (s => String(s == null ? '' : s));
      m.bindTooltip(
        `<b>Klopka ${esc(k.brojKlopke)}</b> — ${esc(k.odjel)}<br>` +
        `${esc(k.vrsta)} · zadnje: ${esc(k.datumOcitanja)} · ulov ${k.ulov || 0}`,
        { direction: 'top', offset: [0, -16] }
      );
      _klopkeLayer.addLayer(m);
    });
    _klopkeLayer.addTo(_map);
  }

  function _renderKlopkeTabela() {
    const el = document.getElementById('klopka-tabela');
    if (!el) return;
    if (!_klopke.length) {
      el.innerHTML = '<div style="font-size:12px;color:#6b7280;padding:8px 0;">Još nema unesenih očitanja.</div>';
      return;
    }
    // DD.MM.YYYY string → YYYYMMDD za sortiranje opadajuće (najnovije prvo)
    const sortKljuc = d => {
      const p = String(d || '').split('.');
      return p.length === 3 ? p[2] + p[1].padStart(2, '0') + p[0].padStart(2, '0') : '';
    };
    const sorted = [..._klopke].sort((a, b) => sortKljuc(b.datumOcitanja).localeCompare(sortKljuc(a.datumOcitanja)));

    let html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
      '<thead><tr style="text-align:left;color:#6b7280;">' +
      '<th style="padding:6px 8px;">Datum</th><th style="padding:6px 8px;">Odjel</th>' +
      '<th style="padding:6px 8px;">Klopka</th><th style="padding:6px 8px;">Vrsta</th>' +
      '<th style="padding:6px 8px;text-align:right;">Ulov</th>' +
      '<th style="padding:6px 8px;">Napomena</th><th style="padding:6px 8px;">Unio</th><th></th></tr></thead><tbody>';
    sorted.forEach(k => {
      html += `<tr style="border-top:1px solid #f1f5f9;">` +
        `<td style="padding:6px 8px;white-space:nowrap;">${k.datumOcitanja || ''}</td>` +
        `<td style="padding:6px 8px;">${k.odjel || ''}</td>` +
        `<td style="padding:6px 8px;">${k.brojKlopke || ''}</td>` +
        `<td style="padding:6px 8px;">${k.vrsta || ''}</td>` +
        `<td style="padding:6px 8px;text-align:right;font-weight:700;">${k.ulov || 0}</td>` +
        `<td style="padding:6px 8px;color:#6b7280;">${k.napomena || ''}</td>` +
        `<td style="padding:6px 8px;color:#6b7280;">${k.korisnik || ''}</td>` +
        `<td style="padding:6px 8px;"><button type="button" onclick="obrisiKlopkaOcitanje(${k.rowIndex})" style="border:none;background:none;cursor:pointer;font-size:13px;" title="Obriši">🗑️</button></td>` +
        `</tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  window.obrisiKlopkaOcitanje = function(rowIndex) {
    const izvrsi = async () => {
      try {
        const url = buildApiUrl('delete-klopka-ocitanje', { rowIndex });
        const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
        const data = await r.json();
        if (!data || data.success !== true) throw new Error((data && data.error) || 'Greška');
        await _fetchKlopkeCached(true);
      } catch (err) {
        if (typeof showWarning === 'function') showWarning('Greška pri brisanju: ' + ((err && err.message) || ''));
        else alert('Greška pri brisanju.');
      }
    };
    if (typeof showConfirmModal === 'function') {
      showConfirmModal('Obriši očitanje', 'Da li ste sigurni da želite obrisati ovo očitanje klopke?', izvrsi, { confirmText: '🗑️ Obriši', danger: true });
    } else if (confirm('Obrisati ovo očitanje?')) {
      izvrsi();
    }
  };

  window.resetKartaView = function() {
    const s = document.getElementById('karta-search'); if (s) s.value = '';
    document.getElementById('karta-filter-gj').value     = 'sve';
    document.getElementById('karta-filter-status').value = 'sve';
    const ot = document.getElementById('karta-otprema-toggle'); if (ot) ot.checked = false;
    applyKartaFilter();
    if (_mapBounds && _mapBounds.isValid()) _map.fitBounds(_mapBounds, { padding:[20,20] });
  };

  let _labelMarkers = []; // permanentni labeli po odjelu

  // ---- ZOOM-RESPONSIVE LABELI ----
  let _labelStyleEl = null;
  function _updateLabelSizes() {
    const z = _map ? _map.getZoom() : 12;
    // font-size po zoom nivou; ispod 11 sakrij labele
    const size =
      z >= 16 ? 15 :
      z >= 15 ? 13 :
      z >= 14 ? 11 :
      z >= 13 ? 9  :
      z >= 12 ? 7  :
      z >= 11 ? 5  : 0;
    const vis = size > 0 ? 'visible' : 'hidden';
    if (!_labelStyleEl) {
      _labelStyleEl = document.createElement('style');
      _labelStyleEl.id = 'karta-label-zoom-style';
      document.head.appendChild(_labelStyleEl);
    }
    _labelStyleEl.textContent =
      `.karta-tooltip { font-size:${size}px !important; visibility:${vis}; padding:${size>0?'2px 6px':'0'} !important; }`;
  }

  // ---- RENDEROVANJE ----
  function _renderLayer(geojson, statusMap) {
    if (_layer) { _map.removeLayer(_layer); _layer = null; }
    _labelMarkers.forEach(m => _map.removeLayer(m));
    _labelMarkers = [];
    _allFeatures = [];

    if (!geojson || !geojson.features || !geojson.features.length) {
      const ld = document.getElementById('karta-loading');
      if (ld) { ld.style.display='flex'; ld.textContent='📭 Nema podataka o poligonima.'; }
      return;
    }

    const ld = document.getElementById('karta-loading');
    if (ld) ld.style.display = 'none';

    _layer = L.geoJSON(geojson, {
      style: feature => {
        const p      = feature.properties || {};
        const key    = _labelKey((p.gj||'') + ' ' + (p.odjel||p.name||''));
        const info   = statusMap.get(key);
        return _styleForMode(info ? info.status : _nonPlanKategorija(key));
      },
      onEachFeature: (feature, lyr) => {
        const props  = feature.properties || {};
        const odjel  = String(props.odjel || props.name || '').trim();
        const gj     = String(props.gj    || '').trim();
        const key    = _labelKey(gj + ' ' + odjel); // bez /N stripa — 64/1 ≠ 64/2
        const info   = statusMap.get(key);
        const status = info ? info.status : _nonPlanKategorija(key);

        lyr._kartaStatus = status;
        lyr._kartaGj     = gj;
        lyr._kartaInfo   = info;
        lyr._kartaProps  = props;
        lyr._kartaExtra  = !info ? (statusMap._extra && statusMap._extra.get(key)) || null : null;
        // Otprema tekućeg mjeseca za ovaj odjel (m³) — za "Prikaz otpreme" filter.
        // Precizan match (čuva /N) + fallback (bez /N, samo za agregatne unose
        // bez preciznog pododsjeka) — vidi komentar u _buildStatusMap.
        const otPreciseKey  = _baseKey(_labelKey(gj + ' ' + odjel));
        const otFallbackKey = _baseKey(_normKey(gj + ' ' + odjel));
        const otPrecise  = statusMap._otpremaPrecise  ? (statusMap._otpremaPrecise.get(otPreciseKey)   || 0) : 0;
        const otFallback = statusMap._otpremaFallback ? (statusMap._otpremaFallback.get(otFallbackKey) || 0) : 0;
        lyr._kartaOtpremaMjesec = otPrecise + otFallback;
        _allFeatures.push(lyr);

        // Hover tooltip za odjele bez permanentnog labela
        if (status === 'bez-plana' || status === 'prelazni') {
          lyr.bindTooltip(odjel || '?', { permanent:false, direction:'center', className:'karta-tooltip' });
        }
        lyr.on('mouseover', function() { this.setStyle(_hoverStyleForMode(this._kartaStatus)); });
        lyr.on('mouseout',  function() {
          // U režimu otpreme (SAMO Proizvodnja mod) zadrži otprema-highlight
          // umjesto default stila.
          if (_prikazMode === 'proizvodnja' && _otpremaMode && this._kartaOtpremaMjesec > 0) this.setStyle(_getOtpremaStyle(this._kartaStatus));
          else if (_layer) _layer.resetStyle(this);
        });
        lyr.on('click',     function(e) {
          // Feromonske klopke pick mod ima prioritet nad normalnim klikom
          // (otvaranje modala / ruta-mod) — klik NA poligon dok se traži
          // pozicija klopke postavlja marker, ne otvara ništa drugo.
          if (_klopkaPickMode) { _zavrsiKlopkaPick(e.latlng); return; }

          const center = _centroid(this) || e.latlng;
          const label  = String(this._kartaProps.odjel || this._kartaProps.name || '?');

          if (_odjelRutaMode) {
            if (!_odjelRutaFrom) {
              // Odabir polazišta
              _odjelRutaFrom = { latlng: center, label };
              _odjelRutaFromMark = L.circleMarker(center, {
                radius:10, color:'#dc2626', fillColor:'#fca5a5', fillOpacity:0.9, weight:3
              }).bindTooltip(`Polazište: Odjel ${label}`, { permanent:true, direction:'top', offset:[0,-8] }).addTo(_map);
              const hint = document.getElementById('mapa-ruta-hint');
              if (hint) hint.textContent = `🎯 Polazište: Odjel ${label} — kliknite na odredišni odjel`;
            } else {
              // Odabir odredišta — crtaj rutu
              const from = _odjelRutaFrom;
              _clearOdjelRutaState();
              _drawOdjelRuta(from.latlng, center, from.label, label);
            }
            return;
          }

          _openDetaljiModal(this._kartaProps, this._kartaInfo, center, this._kartaExtra);
        });
      }
    });

    _layer.addTo(_map);

    // ---- JEDAN LABEL PO ODJELU ----
    // Grupisati poligone po odjelu, naći zajednički centar, dodati jedan label
    const odjelGroups = new Map(); // _labelKey(gj+odjel) → { lyrs, odjel, isSluc }
    _allFeatures.forEach(lyr => {
      const p      = lyr._kartaProps || {};
      const odjel  = String(p.odjel || p.name || '').trim();
      const gj     = String(p.gj || '').trim();
      const key    = _labelKey(gj + ' ' + odjel); // preservira /N razlike
      const status = lyr._kartaStatus;
      const showLabel = status !== 'bez-plana' && status !== 'prelazni';
      if (!showLabel) return;

      if (!odjelGroups.has(key)) {
        odjelGroups.set(key, { lyrs:[], odjel, isSluc: status === 'slucajni' });
      }
      const grp = odjelGroups.get(key);
      grp.lyrs.push(lyr);
    });

    odjelGroups.forEach(grp => {
      // Centar najvećeg odsjeka u grupi (najveći bounding box po površini)
      let bestLyr = null, bestArea = -1;
      grp.lyrs.forEach(lyr => {
        try {
          const b = lyr.getBounds();
          const area = (b.getNorth()-b.getSouth()) * (b.getEast()-b.getWest());
          if (area > bestArea) { bestArea = area; bestLyr = lyr; }
        } catch(_) {}
      });
      if (!bestLyr) return;
      let center;
      try { center = bestLyr.getBounds().getCenter(); } catch(_) { return; }

      const cls = grp.isSluc ? 'karta-tooltip karta-tooltip-slucajni' : 'karta-tooltip';
      const tip = L.tooltip({ permanent:true, direction:'center', className:cls, interactive:false, opacity:1 })
        .setContent(grp.odjel)
        .setLatLng(center)
        .addTo(_map);
      _labelMarkers.push(tip);
    });

    // Sačuvaj bounds za Reset dugme, ali ne fituj automatski
    try {
      _mapBounds = _layer.getBounds();
    } catch(e) {}

    // Marker šumarije
    if (!_sumarijaMark) {
      _sumarijaMark = L.marker(SUMARIJA_LATLNG, {
        icon: L.divIcon({
          html:'<div style="background:#166534;color:white;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);transform:translateX(-50%);">🏢 Šumarija Bosanska Krupa</div>',
          className:'', iconAnchor:[0,0]
        })
      }).addTo(_map);
      _sumarijaMark.bindTooltip('Šumarija Bosanska Krupa — Trg Alije Izetbegovića 1');
    }
  }

  // ---- UČITAVANJE ----
  async function _loadArr(endpoint, cacheKey, dataKey, force) {
    try {
      const url = (typeof buildApiUrl==='function') ? buildApiUrl(endpoint) : null;
      if (!url) return [];
      const data = await fetchWithCache(url, cacheKey, force||false, 150000);
      return (data && data[dataKey]) ? data[dataKey] : [];
    } catch(e) {
      console.warn('[Mapa]', endpoint, 'failed:', e.message);
      try {
        // Veliki ključevi (primke/otpreme) žive u IndexedDB, ne localStorage
        if ((cacheKey === 'cache_primke_sjeca' || cacheKey === 'cache_otpreme_tab') && window.IDBHelper) {
          const entry = await window.IDBHelper.getMeta('blob_' + cacheKey);
          if (entry && entry.data) return entry.data[dataKey] || [];
        } else {
          const raw = (typeof _resolveCacheRaw === 'function') ? _resolveCacheRaw(cacheKey) : localStorage.getItem(cacheKey);
          if (raw) { const obj=JSON.parse(raw); return (obj&&obj.data&&obj.data[dataKey])||[]; }
        }
      } catch(_) {}
      return [];
    }
  }

  async function _loadGeojson() {
    if (_geojson) return _geojson;
    const ld = document.getElementById('karta-loading');

    // VAŽNO: GeoJSON (7.5MB!) se VIŠE NE ČUVA u localStorage — mobilni browseri
    // imaju kvotu od svega 5-10MB, pa je sam GeoJSON gutao gotovo cijelu kvotu.
    // Posljedica: preload podataka za tabove (cache_*) je pucao na QuotaExceeded
    // i tabovi su offline bili prazni. Offline poligone sada služi ISKLJUČIVO
    // Service Worker keš (fetch handler za .geojson je cache-first).
    const VER_KEY = 'geojson_version';
    const GEO_KEY = 'geojson_data';
    // Jednokratno čišćenje legacy zapisa — odmah oslobodi ~7.5MB za podatke tabova
    try { localStorage.removeItem(GEO_KEY); localStorage.removeItem(VER_KEY); } catch(_) {}

    try {
      if (ld) { ld.style.display='flex'; ld.textContent='⏳ Učitavam poligone (može potrajati)...'; }
      // Bez cache:'reload' — pusti SW cache-first handler da posluži keširanu
      // kopiju (i offline i online); SW u pozadini sam osvježava svoju kopiju
      const r = await fetch(GEOJSON_URL);
      if (!r.ok) throw new Error('HTTP '+r.status);
      const text = await r.text();
      if (ld) ld.textContent = '⏳ Parsiram ' + Math.round(text.length/1024) + ' KB...';
      _geojson = JSON.parse(text);
      return _geojson;
    } catch(e) {
      console.error('[Mapa] GeoJSON fetch failed:', e);
      if (ld) { ld.style.display='flex'; ld.textContent='❌ Greška pri učitavanju poligona: ' + e.message; }
      return { type:'FeatureCollection', features:[] };
    }
  }

  // ---- Centriranje na aktivne (u sječi) odjele ----
  // Korisnički zahtjev: pri svakom ulasku prikaz treba biti centriran na
  // područje gdje se trenutno siječe (južno od Bosanske Krupe), ne uvijek
  // na fiksnu tačku (SUMARIJA_LATLNG = ured Šumarije u gradu). Umjesto da se
  // nagađa/hardkoduje koordinata (plan sječe se mijenja iz godine u godinu),
  // računa se STVARNI bounding box svih poligona sa statusom 'u-sjeci' —
  // to garantovano prati gdje god se trenutno radi. Fallback na cijelu mapu
  // ako trenutno nijedan odjel nije 'u-sjeci' (npr. van sezone).
  function _centrirajNaAktivne() {
    if (!_map || !_allFeatures || !_allFeatures.length) return;
    var aktivni = _allFeatures.filter(function(lyr) { return lyr._kartaStatus === 'u-sjeci'; });
    var ciljni = aktivni.length ? aktivni : _allFeatures;
    var bounds = null;
    ciljni.forEach(function(lyr) {
      try {
        var b = lyr.getBounds();
        if (bounds) bounds.extend(b); else bounds = L.latLngBounds(b.getSouthWest(), b.getNorthEast());
      } catch (_) {}
    });
    if (bounds && bounds.isValid()) {
      _map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }

  // ---- INICIJALIZACIJA ----
  window.initKartaOdjela = async function(force) {
    const mapDiv = document.getElementById('karta-odjela-map');
    if (!mapDiv) return;

    const content = document.getElementById('karta-odjela-content');
    if (content) content.classList.remove('hidden');

    if (!_map) {
      const ld = document.getElementById('karta-loading');
      if (ld) ld.style.display = 'none';

      // Backdrop click zatvara modal
      const modal = document.getElementById('mapa-modal');
      if (modal) modal.addEventListener('click', function(e) {
        if (e.target === modal) closeMapaModal();
      });

      _map = L.map('karta-odjela-map', { center:SUMARIJA_LATLNG, zoom:12, zoomControl:true });

      _osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom:18,
      });
      // Default sloj je TOPO (izohipse/konture) umjesto OSM — _osmLayer se
      // kreira ali NE dodaje na mapu.
      _topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap (CC-BY-SA)', maxZoom: 17
      });
      _topoLayer.addTo(_map);

      // Zoom-responsive labeli
      _map.on('zoomend', _updateLabelSizes);
      _updateLabelSizes();

      // Feromonske klopke — klik na prazan prostor mape dok je pick mod
      // aktivan (klik NA poligon se hvata u onEachFeature ispod, jer bi
      // Leaflet inače prvo/umjesto ovog handlera pokrenuo poligonov click).
      _map.on('click', function(e) {
        if (_klopkaPickMode) _zavrsiKlopkaPick(e.latlng);
      });

    } else if (!force) {
      _map.invalidateSize();
      // "Svaki put" centriraj na aktivne odjele i pri brzom ponovnom ulasku
      // (bez ponovnog fetch-a — koristi već učitane _allFeatures).
      setTimeout(_centrirajNaAktivne, 60);
      return;
    }

    setTimeout(() => { if (_map) _map.invalidateSize(); }, 100);

    const ld = document.getElementById('karta-loading');
    if (ld) { ld.style.display='flex'; ld.textContent= navigator.onLine ? '⏳ Učitavam podatke...' : '📦 Učitavam keširano stanje...'; }

    const [geojson, primke, otpreme] = await Promise.all([
      _loadGeojson(),
      _loadArr('primke',  CACHE_SJECA, 'primke',  force),
      _loadArr('otpreme', CACHE_OTPR,  'otpreme', force),
    ]);

    _statusMap = _buildStatusMap(primke, otpreme);
    _renderLayer(geojson, _statusMap);
    if (typeof markTabRendered === 'function') markTabRendered('karta-odjela');

    setTimeout(() => { if (_map) _map.invalidateSize(); }, 200);
    setTimeout(_centrirajNaAktivne, 220);
  };

  // ---- PLAN ENTRIES ----
  // cTrupci=TRUPCI Č, cijepanoC=CEL.DUGA+CEL.CIJEPANA+ŠKART, lTrupci=TRUPCI L, cijepanoL=OGR.DUGI+OGR.CIJEPANI+GULE
  // Plan sječe — izvedeno iz js/config-sumarija.js. Mapa koristi druga imena
  // polja (cijepanoC/cijepanoL) nego Godišnji plan tab (dzgo/cijepano); to
  // preslikavanje radi sam config, pa dvije liste NE MOGU otići u nesklad
  // (ranije su bile dvije ručno održavane kopije).
  function _planEntries() {
    return _CFG.PLAN_ENTRIES_MAPA || [];
  }

  // ---- PLAN 2027 ----
  // Odjeli planirani za narednu godinu — js/config-sumarija.js
  function _plan2027Entries() {
    return _CFG.PLAN_ENTRIES_NAREDNA || [];
  }

})();
