// ========================================
// js/karta-odjela.js — Mapa odjela 2026
// ========================================
(function () {
  'use strict';

  const GEOJSON_URL = 'data/odjeli.geojson';
  const CACHE_SJECA = 'cache_primke_sjeca';
  const CACHE_OTPR  = 'cache_otpreme_karta';

  // Lokacija Šumarije Bosanska Krupa — Trg Alije Izetbegovića 1
  const SUMARIJA_LATLNG = [44.8872, 16.1521];
  const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

  let _map          = null;
  let _osmLayer     = null;
  let _satLayer     = null;
  let _isSat        = false;
  let _layer        = null;
  let _geojson      = null;
  let _statusMap    = new Map();
  let _slucajniSet  = new Set(); // normKeys primki koje nisu u planu
  let _allFeatures  = [];
  let _mapBounds    = null;
  let _routeLine    = null;
  let _routeLine2   = null; // ruta odjel→odjel
  let _sumarijaMark = null;
  let _currentLatlng     = null;
  let _currentOdjelLabel = null;
  let _odjelRutaMode = false;    // da li je aktivan režim rute između odjela
  let _odjelRutaFrom = null;     // { latlng, label }
  let _odjelRutaFromMark = null;

  // ---- BOJE ----
  function _getColor(status) {
    switch (status) {
      case 'posjeceno':  return '#16a34a';
      case 'u-sjeci':    return '#d97706';
      case 'planirano':  return '#9ca3af';
      case 'slucajni':   return '#7c3aed';
      default:           return '#6366f1';
    }
  }
  function _getStyle(status) {
    const c = _getColor(status);
    return { fillColor:c, fillOpacity:0.55, color:c, weight:2, opacity:0.85 };
  }
  function _getHoverStyle(status) {
    const c = _getColor(status);
    return { fillColor:c, fillOpacity:0.8, color:'#1e293b', weight:3, opacity:1 };
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

  function _fmt(n) {
    if (n == null || isNaN(n)) return '—';
    const v = Math.round(n);
    return v === 0 ? '—' : v.toLocaleString('de-DE') + ' m³';
  }

  const PLAN_YEAR = 2026;

  function _getYear(p) {
    const parts = (p.datum||'').split('.');
    return parts.length >= 3 ? parseInt(parts[2]) : null;
  }

  // ---- STATUS MAP + SLUČAJNI ----
  function _buildStatusMap(primke, otpreme) {
    const planEntries    = _planEntries();
    const planKeys       = new Set(planEntries.map(e => _normKey(e.gj+' '+e.odjel)));
    const map            = new Map();
    _slucajniSet         = new Set();

    const primkeTekuce  = (primke||[]).filter(p => _getYear(p) === PLAN_YEAR);
    const primkeOstale  = (primke||[]).filter(p => _getYear(p) !== PLAN_YEAR);
    const otpremeTekuce = (otpreme||[]).filter(p => _getYear(p) === PLAN_YEAR);
    const otremeOstale  = (otpreme||[]).filter(p => _getYear(p) !== PLAN_YEAR);

    // Slučajni užici — primke čiji odjel nije ni u jednom planu (p.odjel sadrži GJ prefix)
    primkeTekuce.forEach(p => {
      const k = _normKey(p.odjel);
      if (!planKeys.has(k)) _slucajniSet.add(k);
    });

    planEntries.forEach(entry => {
      const key  = _normKey(entry.gj+' '+entry.odjel);  // matches normKey(p.odjel)
      const sjeca = _emptySort();
      const otpr  = _emptySort();
      const sjecaOst = _emptySort();
      const otprOst  = _emptySort();

      primkeTekuce.filter(p => _normKey(p.odjel) === key).forEach(p => _addSort(sjeca, p.sortiment, p.kolicina));
      otpremeTekuce.filter(p => _normKey(p.odjel) === key).forEach(p => _addSort(otpr, p.sortiment, p.kolicina));
      primkeOstale.filter(p => _normKey(p.odjel) === key).forEach(p => _addSort(sjecaOst, p.sortiment, p.kolicina));
      otremeOstale.filter(p => _normKey(p.odjel) === key).forEach(p => _addSort(otprOst, p.sortiment, p.kolicina));

      // Radilište, izvođač, poslovođa — iz tekućih primki za ovaj odjel
      const odjelPrimke = primkeTekuce.filter(p => _normKey(p.odjel) === key);
      const uniq = (arr, fn) => [...new Set(arr.map(fn).filter(Boolean))].join(', ') || '—';
      const radiliste  = uniq(odjelPrimke, p => p.radiliste);
      const izvodjac   = uniq(odjelPrimke, p => p.izvodjac);
      const poslovodja = uniq(odjelPrimke, p => p.poslovodja);

      sjeca.ukupno    = _sumSort(sjeca);
      otpr.ukupno     = _sumSort(otpr);
      sjecaOst.ukupno = _sumSort(sjecaOst);
      otprOst.ukupno  = _sumSort(otprOst);

      const pct    = entry.neto > 0 ? sjeca.ukupno / entry.neto * 100 : 0;
      const status = pct >= 95 ? 'posjeceno' : pct > 5 ? 'u-sjeci' : 'planirano';
      map.set(key, { gj:entry.gj, odjel:entry.odjel, status, pct, sjeca, otpr, sjecaOst, otprOst, neto:entry.neto, bruto:entry.bruto, radiliste, izvodjac, poslovodja });
    });

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
      const resp = await fetch(url);
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
      const resp = await fetch(url);
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

  // ---- DETALJI MODAL ----
  function _openDetaljiModal(props, info, latlng) {
    _currentLatlng     = latlng;
    _currentOdjelLabel = String(props.odjel || props.name || '?');
    const odjel  = _currentOdjelLabel;
    const gj     = props.gj   || '—';
    const odsjek = props.odsjek || '—';
    const gjColor = {'Risovac Krupa':'#1d4ed8','Grmeč Jasenica':'#15803d','Vojskova':'#b45309'}[gj]||'#374151';

    document.getElementById('mapa-modal-title').textContent = 'Odjel ' + odjel;
    document.getElementById('mapa-modal-gj').textContent = gj;
    document.getElementById('mapa-modal-gj').style.color = gjColor;

    const metaDiv = document.getElementById('mapa-modal-meta');
    if (metaDiv && info) {
      const metaItem = (icon, label, val) => val && val !== '—'
        ? `<div style="display:flex;align-items:center;gap:4px;font-size:11px;opacity:.9;"><span>${icon}</span><span><b>${label}:</b> ${val}</span></div>`
        : '';
      metaDiv.innerHTML =
        metaItem('📍', 'Radilište', info.radiliste) +
        metaItem('👷', 'Izvođač',   info.izvodjac)  +
        metaItem('👤', 'Poslovođa', info.poslovodja);
      metaDiv.style.display = metaDiv.innerHTML ? 'flex' : 'none';
    } else if (metaDiv) {
      metaDiv.innerHTML = ''; metaDiv.style.display = 'none';
    }

    const statusLabel = { posjeceno:'Posječeno','u-sjeci':'U sječi',planirano:'Planirano',slucajni:'Slučajni užitak' };
    const statusColor = { posjeceno:'#166534','u-sjeci':'#92400e',planirano:'#6b7280',slucajni:'#7c3aed' };
    const statusBg    = { posjeceno:'#dcfce7','u-sjeci':'#fef3c7',planirano:'#f3f4f6',slucajni:'#f5f3ff' };

    const routeBtn = `
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button onclick="routeToOdjel()" style="flex:1;display:flex;align-items:center;gap:6px;background:#2563eb;color:white;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;justify-content:center;">🏢 Ruta od Šumarije</button>
        <button onclick="routeOdjelToOdjel()" style="flex:1;display:flex;align-items:center;gap:6px;background:#dc2626;color:white;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;justify-content:center;">🔀 Ruta do odjela…</button>
      </div>`;

    const odjelNormKey = _normKey((props.gj||'') + ' ' + (props.odjel||props.name||''));
    const isSlucajni   = !info && _slucajniSet.has(_normKey(props.odjel||props.name||''));

    let body;
    if (!info) {
      const label = isSlucajni ? 'Slučajni užitak' : 'Bez plana';
      const bg    = isSlucajni ? '#f5f3ff' : '#f3f4f6';
      const col   = isSlucajni ? '#7c3aed' : '#6b7280';
      const note  = isSlucajni
        ? `${gj} — ima podatke sječe, nije u godišnjem planu 2026`
        : `${gj} — nema podataka za ovaj odjel`;
      body = `
        <div style="text-align:center;padding:20px 0 0;">
          <span style="background:${bg};color:${col};padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;">${label}</span>
          <div style="font-size:13px;color:#6b7280;margin-top:8px;">${note}</div>
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

      const td  = (v, col, bold) => `<td style="padding:5px 8px;font-size:12px;text-align:right;border-bottom:1px solid #f1f5f9;color:${col};${bold?'font-weight:700;':''}">${_fmt(v)}</td>`;
      const tdL = (v) => `<td style="padding:5px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;color:#374151;">${v}</td>`;

      const grpRow = (label, sv, ov, pv) => {
        const z  = sv - (ov||0);
        const zC = z<0?'#dc2626':z===0?'#6b7280':'#059669';
        return `<tr>${tdL(label)}${td(sv,'#15803d',true)}${hasOtpr?td(ov,'#92400e',false)+td(z,zC,true):''}${td(pv,'#9ca3af',false)}</tr>`;
      };
      const subRow = (label, sv, ov) => {
        return `<tr style="background:#fafafa;">${tdL('<span style="font-size:11px;color:#9ca3af;padding-left:10px;">↳ '+label+'</span>')}${td(sv,'#6b7280',false)}${hasOtpr?td(ov,'#9ca3af',false)+'<td style="border-bottom:1px solid #f1f5f9;"></td>':''}<td style="border-bottom:1px solid #f1f5f9;"></td></tr>`;
      };

      body = `
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;">
          <div style="flex:1;min-width:130px;">
            <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Gospodarska jedinica</div>
            <div style="font-weight:700;font-size:13px;">${gj}</div>
          </div>
          <div style="flex:1;min-width:70px;">
            <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Odsjek</div>
            <div style="font-weight:600;font-size:13px;">${odsjek}</div>
          </div>
          <span style="background:${statusBg[s]};color:${statusColor[s]};padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;align-self:flex-start;">${statusLabel[s]||s}</span>
        </div>

        <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <span style="font-size:12px;font-weight:600;color:#374151;">Realizacija plana ${PLAN_YEAR}</span>
            <span style="font-size:15px;font-weight:800;color:${statusColor[s]};">${pct}%</span>
          </div>
          <div style="height:7px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin-bottom:8px;">
            <div style="height:100%;width:${barW}%;background:${barCol};border-radius:4px;"></div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <div style="background:white;border-radius:6px;padding:4px 10px;text-align:center;flex:1;min-width:70px;">
              <div style="font-size:10px;color:#9ca3af;">Sječa ${PLAN_YEAR}</div>
              <div style="font-weight:800;font-size:13px;color:#15803d;">${_fmt(sj.ukupno)}</div>
            </div>
            ${hasOtpr?`
            <div style="background:white;border-radius:6px;padding:4px 10px;text-align:center;flex:1;min-width:70px;">
              <div style="font-size:10px;color:#9ca3af;">Otprema ${PLAN_YEAR}</div>
              <div style="font-weight:800;font-size:13px;color:#b45309;">${_fmt(ot.ukupno)}</div>
            </div>
            <div style="background:white;border-radius:6px;padding:4px 10px;text-align:center;flex:1;min-width:70px;">
              <div style="font-size:10px;color:#9ca3af;">Zaliha</div>
              <div style="font-weight:800;font-size:13px;color:${zaliha<0?'#dc2626':'#1d4ed8'};">${_fmt(zaliha)}</div>
            </div>`:''}
            <div style="background:white;border-radius:6px;padding:4px 10px;text-align:center;flex:1;min-width:70px;">
              <div style="font-size:10px;color:#9ca3af;">Plan neto</div>
              <div style="font-weight:800;font-size:13px;color:#6b7280;">${_fmt(info.neto)}</div>
            </div>
          </div>
        </div>

        <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;">Sortimenti — ${PLAN_YEAR}</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
          <thead><tr style="background:#f1f5f9;">
            <th style="padding:5px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600;">Sortiment</th>
            <th style="padding:5px 8px;font-size:11px;text-align:right;color:#15803d;font-weight:600;">Sječa</th>
            ${hasOtpr?'<th style="padding:5px 8px;font-size:11px;text-align:right;color:#b45309;font-weight:600;">Otprema</th><th style="padding:5px 8px;font-size:11px;text-align:right;color:#1d4ed8;font-weight:600;">Zaliha</th>':''}
            <th style="padding:5px 8px;font-size:11px;text-align:right;color:#9ca3af;font-weight:600;">Plan</th>
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
            <tr style="background:#f8fafc;font-weight:800;border-top:2px solid #e5e7eb;">
              <td style="padding:6px 8px;font-size:12px;">UKUPNO</td>
              <td style="padding:6px 8px;font-size:13px;text-align:right;color:#15803d;">${_fmt(sj.ukupno)}</td>
              ${hasOtpr?`<td style="padding:6px 8px;font-size:13px;text-align:right;color:#b45309;">${_fmt(ot.ukupno)}</td>
              <td style="padding:6px 8px;font-size:13px;text-align:right;color:${zaliha<0?'#dc2626':'#1d4ed8'};">${_fmt(zaliha)}</td>`:''}
              <td style="padding:6px 8px;font-size:12px;text-align:right;color:#9ca3af;">${_fmt(info.neto)}</td>
            </tr>
          </tbody>
        </table>

        ${hasOst ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:12px;color:#92400e;">
          ⚠️ <b>Sječa/otprema iz prethodnih godina:</b> sječa ${_fmt(so.ukupno)}, otprema ${_fmt(oo.ukupno)}
        </div>` : ''}
        ${routeBtn}`;
    }

    document.getElementById('mapa-modal-body').innerHTML = body;
    document.getElementById('mapa-modal').style.display = 'flex';
  }

  window.closeMapaModal = function() {
    document.getElementById('mapa-modal').style.display = 'none';
  };

  // ---- SATELITSKI SLOJ ----
  window.toggleMapaSat = function() {
    _isSat = !_isSat;
    if (_isSat) {
      if (_osmLayer) _map.removeLayer(_osmLayer);
      if (!_satLayer) {
        _satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution:'© Esri',
          maxZoom: 19,
        });
      }
      _satLayer.addTo(_map);
    } else {
      if (_satLayer) _map.removeLayer(_satLayer);
      if (_osmLayer) _osmLayer.addTo(_map);
    }
    const btn = document.getElementById('karta-sat-btn');
    if (btn) btn.textContent = _isSat ? '🗺️ OSM' : '🛰️ Satelit';
  };

  // ---- PRETRAGA ----
  window.searchKartaOdjel = function() {
    const term = (document.getElementById('karta-search') || {}).value || '';
    const q    = term.trim().toUpperCase();
    if (!q) { _allFeatures.forEach(l => { if (!_map.hasLayer(l)) l.addTo(_map); }); return; }

    let found = null;
    _allFeatures.forEach(lyr => {
      const p = lyr._kartaProps || {};
      const o = String(p.odjel || p.name || '').trim().toUpperCase();
      const g = String(p.gj || '').trim().toUpperCase();
      if (o === q || o.startsWith(q) || g.includes(q)) {
        if (!_map.hasLayer(lyr)) lyr.addTo(_map);
        if (!found) found = lyr;
      } else {
        if (_map.hasLayer(lyr)) _map.removeLayer(lyr);
      }
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
    const gjF = (document.getElementById('karta-filter-gj')     || {}).value || 'sve';
    const stF = (document.getElementById('karta-filter-status') || {}).value || 'sve';
    const q   = ((document.getElementById('karta-search')       || {}).value || '').trim().toUpperCase();

    _allFeatures.forEach(lyr => {
      const p   = lyr._kartaProps || {};
      const o   = String(p.odjel || p.name || '').trim().toUpperCase();
      const gjM = gjF === 'sve' || lyr._kartaGj === gjF;
      const stM = stF === 'sve' || lyr._kartaStatus === stF;
      const qM  = !q || o.startsWith(q) || String(p.gj||'').toUpperCase().includes(q);
      if (gjM && stM && qM) { if (!_map.hasLayer(lyr)) lyr.addTo(_map); }
      else                  { if (_map.hasLayer(lyr))  _map.removeLayer(lyr); }
    });
  };

  window.resetKartaView = function() {
    const s = document.getElementById('karta-search'); if (s) s.value = '';
    document.getElementById('karta-filter-gj').value     = 'sve';
    document.getElementById('karta-filter-status').value = 'sve';
    applyKartaFilter();
    if (_mapBounds && _mapBounds.isValid()) _map.fitBounds(_mapBounds, { padding:[20,20] });
  };

  // ---- RENDEROVANJE ----
  function _renderLayer(geojson, statusMap) {
    if (_layer) { _map.removeLayer(_layer); _layer = null; }
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
        const key    = _normKey((p.gj||'') + ' ' + (p.odjel||p.name||''));
        const info   = statusMap.get(key);
        const isSluc = !info && (_slucajniSet.has(key) || _slucajniSet.has(_normKey(p.odjel||p.name||'')));
        return _getStyle(info ? info.status : isSluc ? 'slucajni' : 'bez-plana');
      },
      onEachFeature: (feature, lyr) => {
        const props  = feature.properties || {};
        const odjel  = String(props.odjel || props.name || '').trim();
        const gj     = String(props.gj    || '').trim();
        const key    = _normKey(gj + ' ' + odjel);
        const info   = statusMap.get(key);
        const isSluc = !info && (_slucajniSet.has(key) || _slucajniSet.has(_normKey(odjel)));
        const status = info ? info.status : isSluc ? 'slucajni' : 'bez-plana';

        lyr._kartaStatus = status;
        lyr._kartaGj     = gj;
        lyr._kartaInfo   = info;
        lyr._kartaProps  = props;
        _allFeatures.push(lyr);

        lyr.bindTooltip(odjel || '?', { permanent:false, direction:'center', className:'karta-tooltip' });
        lyr.on('mouseover', function() { this.setStyle(_getHoverStyle(this._kartaStatus)); });
        lyr.on('mouseout',  function() { if (_layer) _layer.resetStyle(this); });
        lyr.on('click',     function(e) {
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

          _openDetaljiModal(this._kartaProps, this._kartaInfo, center);
        });
      }
    });

    _layer.addTo(_map);

    // Postavi maxBounds iz GeoJSON extenta
    try {
      _mapBounds = _layer.getBounds();
      if (_mapBounds.isValid()) {
        _map.fitBounds(_mapBounds, { padding:[20,20] });
        const sw  = _mapBounds.getSouthWest(), ne = _mapBounds.getNorthEast();
        const lp  = (_mapBounds.getNorth()-_mapBounds.getSouth())*0.3;
        const lgp = (_mapBounds.getEast()-_mapBounds.getWest())*0.3;
        _map.setMaxBounds([[sw.lat-lp,sw.lng-lgp],[ne.lat+lp,ne.lng+lgp]]);
        _map.options.minZoom = 9;
      }
    } catch(e) {}

    // Marker šumarije
    if (!_sumarijaMark) {
      _sumarijaMark = L.marker(SUMARIJA_LATLNG, {
        icon: L.divIcon({
          html:'<div style="background:#166534;color:white;font-size:11px;font-weight:700;padding:3px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);">🏢 Šumarija</div>',
          className:'', iconAnchor:[40,20]
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
        const raw = localStorage.getItem(cacheKey);
        if (raw) { const obj=JSON.parse(raw); return (obj&&obj.data&&obj.data[dataKey])||[]; }
      } catch(_) {}
      return [];
    }
  }

  async function _loadGeojson() {
    if (_geojson) return _geojson;
    try {
      const r = await fetch(GEOJSON_URL);
      if (!r.ok) throw new Error('HTTP '+r.status);
      _geojson = await r.json();
      return _geojson;
    } catch(e) {
      console.error('[Mapa] GeoJSON failed:', e.message);
      return { type:'FeatureCollection', features:[] };
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

      _map = L.map('karta-odjela-map', { center:SUMARIJA_LATLNG, zoom:11, zoomControl:true, maxBoundsViscosity:0.9 });

      _osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom:18,
      });
      _osmLayer.addTo(_map);

    } else if (!force) {
      _map.invalidateSize();
      return;
    }

    setTimeout(() => { if (_map) _map.invalidateSize(); }, 100);

    const ld = document.getElementById('karta-loading');
    if (ld) { ld.style.display='flex'; ld.textContent='⏳ Učitavam podatke...'; }

    const [geojson, primke, otpreme] = await Promise.all([
      _loadGeojson(),
      _loadArr('primke',  CACHE_SJECA, 'primke',  force),
      _loadArr('otpreme', CACHE_OTPR,  'otpreme', force),
    ]);

    _statusMap = _buildStatusMap(primke, otpreme);
    _renderLayer(geojson, _statusMap);

    setTimeout(() => { if (_map) _map.invalidateSize(); }, 200);
  };

  // ---- PLAN ENTRIES ----
  // cTrupci=TRUPCI Č, cijepanoC=CEL.DUGA+CEL.CIJEPANA+ŠKART, lTrupci=TRUPCI L, cijepanoL=OGR.DUGI+OGR.CIJEPANI+GULE
  function _planEntries() {
    return [
      { gj:'Risovac Krupa', odjel:'13',    bruto:3244,  neto:2768, cTrupci:3,    cijepanoC:2,   lTrupci:875,  cijepanoL:1888 },
      { gj:'Risovac Krupa', odjel:'35',    bruto:5417,  neto:4648, cTrupci:122,  cijepanoC:44,  lTrupci:1813, cijepanoL:2670 },
      { gj:'Risovac Krupa', odjel:'50',    bruto:5161,  neto:4329, cTrupci:1824, cijepanoC:227, lTrupci:971,  cijepanoL:1307 },
      { gj:'Risovac Krupa', odjel:'54P',   bruto:1511,  neto:1276, cTrupci:639,  cijepanoC:109, lTrupci:208,  cijepanoL:320  },
      { gj:'Risovac Krupa', odjel:'55',    bruto:5195,  neto:4258, cTrupci:2193, cijepanoC:328, lTrupci:789,  cijepanoL:948  },
      { gj:'Risovac Krupa', odjel:'56',    bruto:3877,  neto:3206, cTrupci:1779, cijepanoC:263, lTrupci:439,  cijepanoL:725  },
      { gj:'Risovac Krupa', odjel:'59/1',  bruto:3724,  neto:3087, cTrupci:1545, cijepanoC:208, lTrupci:658,  cijepanoL:676  },
      { gj:'Risovac Krupa', odjel:'63',    bruto:4033,  neto:3339, cTrupci:1309, cijepanoC:236, lTrupci:796,  cijepanoL:998  },
      { gj:'Risovac Krupa', odjel:'66',    bruto:2645,  neto:2307, cTrupci:0,    cijepanoC:52,  lTrupci:949,  cijepanoL:1307 },
      { gj:'Risovac Krupa', odjel:'68/2',  bruto:2605,  neto:2287, cTrupci:35,   cijepanoC:6,   lTrupci:1012, cijepanoL:1234 },
      { gj:'Risovac Krupa', odjel:'71P',   bruto:1957,  neto:1655, cTrupci:664,  cijepanoC:114, lTrupci:401,  cijepanoL:476  },
      { gj:'Risovac Krupa', odjel:'97',    bruto:4889,  neto:4058, cTrupci:1253, cijepanoC:236, lTrupci:901,  cijepanoL:1668 },
      { gj:'Risovac Krupa', odjel:'113P',  bruto:5177,  neto:4300, cTrupci:225,  cijepanoC:74,  lTrupci:1278, cijepanoL:2723 },
      { gj:'Grmeč Jasenica', odjel:'4/1',   bruto:2490, neto:2117, cTrupci:0,   cijepanoC:0,   lTrupci:303,  cijepanoL:1814 },
      { gj:'Grmeč Jasenica', odjel:'11P',   bruto:208,  neto:179,  cTrupci:0,   cijepanoC:0,   lTrupci:73,   cijepanoL:106  },
      { gj:'Grmeč Jasenica', odjel:'43P',   bruto:1099, neto:740,  cTrupci:40,  cijepanoC:100, lTrupci:160,  cijepanoL:440  },
      { gj:'Grmeč Jasenica', odjel:'60',    bruto:3551, neto:3061, cTrupci:295, cijepanoC:65,  lTrupci:1050, cijepanoL:1651 },
      { gj:'Grmeč Jasenica', odjel:'61',    bruto:4774, neto:4105, cTrupci:454, cijepanoC:102, lTrupci:1393, cijepanoL:2156 },
      { gj:'Grmeč Jasenica', odjel:'64/2P', bruto:996,  neto:608,  cTrupci:13,  cijepanoC:23,  lTrupci:211,  cijepanoL:361  },
      { gj:'Grmeč Jasenica', odjel:'66',    bruto:5339, neto:4493, cTrupci:0,   cijepanoC:0,   lTrupci:1025, cijepanoL:3468 },
      { gj:'Grmeč Jasenica', odjel:'67',    bruto:4853, neto:4199, cTrupci:0,   cijepanoC:0,   lTrupci:1530, cijepanoL:2669 },
      { gj:'Grmeč Jasenica', odjel:'69P',   bruto:1309, neto:1204, cTrupci:82,  cijepanoC:32,  lTrupci:390,  cijepanoL:700  },
      { gj:'Grmeč Jasenica', odjel:'85P',   bruto:678,  neto:418,  cTrupci:0,   cijepanoC:73,  lTrupci:25,   cijepanoL:320  },
      { gj:'Grmeč Jasenica', odjel:'88P',   bruto:1805, neto:1200, cTrupci:0,   cijepanoC:0,   lTrupci:20,   cijepanoL:1180 },
      { gj:'Vojskova', odjel:'15',  bruto:450, neto:383, cTrupci:0, cijepanoC:0, lTrupci:0,   cijepanoL:383 },
      { gj:'Vojskova', odjel:'21P', bruto:787, neto:624, cTrupci:0, cijepanoC:0, lTrupci:202, cijepanoL:422 },
      { gj:'Vojskova', odjel:'25',  bruto:750, neto:637, cTrupci:0, cijepanoC:0, lTrupci:0,   cijepanoL:637 },
    ];
  }

})();
