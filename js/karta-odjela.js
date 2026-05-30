// ========================================
// js/karta-odjela.js
// Interaktivna karta odjela — Pogon Bosanska Krupa 2026
// ========================================
(function () {
  'use strict';

  const GEOJSON_URL = 'data/odjeli.geojson';
  const CACHE_KEY   = 'cache_karta_primke';
  const CACHE_TTL   = 5 * 60 * 1000; // 5 minuta

  let _map        = null;
  let _layer      = null;
  let _geojson    = null;
  let _statusMap  = new Map(); // "GJ|odjel" → {status, pct, actual, neto}
  let _allFeatures = [];       // svi L.layer objekti za filter

  // ---- BOJE ----
  function _getColor(status) {
    switch (status) {
      case 'posjeceno': return '#16a34a';
      case 'u-sjeci':   return '#d97706';
      case 'planirano': return '#9ca3af';
      default:          return '#6366f1'; // bez-plana
    }
  }

  function _getStyle(status) {
    const color = _getColor(status);
    return {
      fillColor: color,
      fillOpacity: 0.55,
      color: color,
      weight: 2,
      opacity: 0.85,
    };
  }

  // ---- NORMALIZACIJA (isti algoritam kao u godisnji-plan.js) ----
  function _normKey(s) {
    return String(s || '').trim().toUpperCase()
      .replace(/Č/g, 'C').replace(/Ć/g, 'C')
      .replace(/Š/g, 'S').replace(/Ž/g, 'Z').replace(/Đ/g, 'DJ')
      .replace(/P\s*$/, '').trim();
  }

  // ---- STATUS MAP ----
  // Gradi Map<normKey("GJ odjel") → {status, pct, actual, neto}> iz primki
  function _buildStatusMap(primke) {
    // Isti PLAN_ENTRIES kao u godisnji-plan.js — dohvatamo ih odande ako su dostupni
    const planEntries = (typeof window._GP_PLAN_ENTRIES !== 'undefined')
      ? window._GP_PLAN_ENTRIES
      : _fallbackPlanEntries();

    const map = new Map();

    planEntries.forEach(entry => {
      const key = _normKey(entry.gj + ' ' + entry.odjel);
      const actual = {
        cTrupci: 0, celDuga: 0, celCijepana: 0, skart: 0,
        lTrupci: 0, ogrDugi: 0, ogrCijepani: 0, gule: 0, ukupno: 0
      };

      primke.filter(p => _normKey(p.odjel) === key).forEach(p => {
        switch (p.sortiment) {
          case 'TRUPCI Č':     actual.cTrupci     += p.kolicina; break;
          case 'CEL.DUGA':     actual.celDuga      += p.kolicina; break;
          case 'CEL.CIJEPANA': actual.celCijepana  += p.kolicina; break;
          case 'ŠKART':        actual.skart        += p.kolicina; break;
          case 'TRUPCI L':     actual.lTrupci      += p.kolicina; break;
          case 'OGR.DUGI':     actual.ogrDugi      += p.kolicina; break;
          case 'OGR.CIJEPANI': actual.ogrCijepani  += p.kolicina; break;
          case 'GULE':         actual.gule         += p.kolicina; break;
        }
        actual.ukupno += p.kolicina;
      });

      const pct = entry.neto > 0 ? (actual.ukupno / entry.neto * 100) : 0;
      const status = pct >= 95 ? 'posjeceno' : pct > 5 ? 'u-sjeci' : 'planirano';

      map.set(key, {
        gj: entry.gj,
        odjel: entry.odjel,
        status,
        pct,
        actual,
        neto: entry.neto,
        bruto: entry.bruto,
      });
    });

    return map;
  }

  // ---- POPUP HTML ----
  function _buildPopup(props, info) {
    const odjel  = props.name || props.odjel || '?';
    const gj     = props.gj   || '—';
    const odsjek = props.odsjek ? ` / odsjek ${props.odsjek}` : '';

    if (!info) {
      return `<div style="font-family:system-ui,sans-serif;min-width:180px;">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Odjel ${odjel}${odsjek}</div>
        <div style="font-size:12px;color:#6b7280;">${gj}</div>
        <div style="margin-top:8px;font-size:12px;color:#6366f1;background:#f0f0ff;padding:4px 8px;border-radius:6px;">Nije u godišnjem planu</div>
      </div>`;
    }

    const pct = info.pct != null ? info.pct.toFixed(1) + '%' : '—';
    const statusLabel = { posjeceno: 'Posječeno', 'u-sjeci': 'U sječi', planirano: 'Planirano' };
    const statusColor = { posjeceno: '#166534', 'u-sjeci': '#92400e', planirano: '#6b7280' };
    const statusBg    = { posjeceno: '#dcfce7', 'u-sjeci': '#fef3c7', planirano: '#f3f4f6' };
    const s = info.status;
    const ukupno = Math.round(info.actual.ukupno || 0).toLocaleString('de-DE');
    const neto   = Math.round(info.neto || 0).toLocaleString('de-DE');

    return `<div style="font-family:system-ui,sans-serif;min-width:210px;max-width:260px;">
      <div style="font-weight:700;font-size:14px;margin-bottom:2px;">Odjel ${odjel}${odsjek}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">${gj}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span style="background:${statusBg[s]};color:${statusColor[s]};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">${statusLabel[s] || s}</span>
        <span style="font-size:12px;font-weight:700;color:${statusColor[s]};">${pct}</span>
      </div>
      <div style="font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
        <div style="background:#f8fafc;border-radius:6px;padding:4px 8px;">
          <div style="color:#9ca3af;font-size:10px;">Posječeno</div>
          <div style="font-weight:700;color:#111;">${ukupno} m³</div>
        </div>
        <div style="background:#f8fafc;border-radius:6px;padding:4px 8px;">
          <div style="color:#9ca3af;font-size:10px;">Plan (neto)</div>
          <div style="font-weight:700;color:#111;">${neto} m³</div>
        </div>
      </div>
    </div>`;
  }

  // ---- RENDEROVANJE LAYERA ----
  function _renderLayer(geojson, statusMap) {
    if (_layer) {
      _map.removeLayer(_layer);
      _layer = null;
    }
    _allFeatures = [];

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      document.getElementById('karta-loading').style.display = 'flex';
      document.getElementById('karta-loading').textContent = '📭 Nema podataka o poligonima. Dodajte data/odjeli.geojson s poligonima odjela.';
      return;
    }

    document.getElementById('karta-loading').style.display = 'none';

    _layer = L.geoJSON(geojson, {
      style: feature => {
        const props = feature.properties || {};
        const odjel = String(props.name || props.odjel || '').trim();
        const gj    = String(props.gj || '').trim();
        const key   = _normKey(gj + ' ' + odjel);
        const info  = statusMap.get(key);
        const status = info ? info.status : 'bez-plana';
        return _getStyle(status);
      },
      onEachFeature: (feature, leafletLayer) => {
        const props  = feature.properties || {};
        const odjel  = String(props.name || props.odjel || '').trim();
        const gj     = String(props.gj || '').trim();
        const key    = _normKey(gj + ' ' + odjel);
        const info   = statusMap.get(key);
        const status = info ? info.status : 'bez-plana';

        leafletLayer._kartaStatus = status;
        leafletLayer._kartaGj     = gj;
        _allFeatures.push(leafletLayer);

        leafletLayer.bindPopup(_buildPopup(props, info), { maxWidth: 280 });

        leafletLayer.on('mouseover', function (e) {
          this.setStyle({ weight: 3, fillOpacity: 0.75 });
          this.openPopup();
        });
        leafletLayer.on('mouseout', function (e) {
          _layer.resetStyle(this);
          // popup ostaje otvoren dok korisnik ne klikne drugdje
        });
        leafletLayer.on('click', function (e) {
          this.openPopup();
        });
      }
    });

    _layer.addTo(_map);

    // Zoom na sve poligone
    try {
      const bounds = _layer.getBounds();
      if (bounds.isValid()) _map.fitBounds(bounds, { padding: [20, 20] });
    } catch (e) {}
  }

  // ---- FILTER ----
  window.applyKartaFilter = function () {
    const gjF  = (document.getElementById('karta-filter-gj')     || {}).value || 'sve';
    const stF  = (document.getElementById('karta-filter-status') || {}).value || 'sve';

    _allFeatures.forEach(lyr => {
      const gjMatch  = gjF === 'sve' || lyr._kartaGj === gjF;
      const stMatch  = stF === 'sve' || lyr._kartaStatus === stF;
      if (gjMatch && stMatch) {
        if (!_map.hasLayer(lyr)) lyr.addTo(_map);
      } else {
        if (_map.hasLayer(lyr)) _map.removeLayer(lyr);
      }
    });
  };

  window.resetKartaView = function () {
    document.getElementById('karta-filter-gj').value     = 'sve';
    document.getElementById('karta-filter-status').value = 'sve';
    applyKartaFilter();
    if (_layer) {
      try {
        const bounds = _layer.getBounds();
        if (bounds.isValid()) _map.fitBounds(bounds, { padding: [20, 20] });
      } catch (e) {}
    }
  };

  // ---- UČITAVANJE PODATAKA ----
  async function _loadPrimke(force) {
    try {
      const url = (typeof buildApiUrl === 'function') ? buildApiUrl('primke') : null;
      if (!url) return [];
      const data = await fetchWithCache(url, CACHE_KEY, force || false, 150000);
      return (data && data.primke) ? data.primke : [];
    } catch (e) {
      console.warn('[Karta] primke fetch failed:', e.message);
      // pokušaj stale cache
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          return (obj && obj.data && obj.data.primke) ? obj.data.primke : [];
        }
      } catch (_) {}
      return [];
    }
  }

  async function _loadGeojson() {
    if (_geojson) return _geojson;
    try {
      const resp = await fetch(GEOJSON_URL);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      _geojson = await resp.json();
      return _geojson;
    } catch (e) {
      console.error('[Karta] GeoJSON fetch failed:', e.message);
      return { type: 'FeatureCollection', features: [] };
    }
  }

  // ---- INICIJALIZACIJA ----
  window.initKartaOdjela = async function (force) {
    const mapDiv = document.getElementById('karta-odjela-map');
    const loadingDiv = document.getElementById('karta-loading');
    if (!mapDiv) return;

    // Prikaži sadržaj
    const content = document.getElementById('karta-odjela-content');
    if (content) content.classList.remove('hidden');

    // Inicijalizuj Leaflet mapu samo jednom
    if (!_map) {
      // Sakrij loading poruku dok se mapa ne postavi
      if (loadingDiv) loadingDiv.style.display = 'none';

      _map = L.map('karta-odjela-map', {
        center: [44.55, 16.3], // Bosanska Krupa — grubo centriranje
        zoom: 11,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(_map);
    } else if (!force) {
      // Mapa već postoji i ne forsiramo refresh — samo popraviti veličinu
      _map.invalidateSize();
      return;
    }

    // Leaflet treba da zna dimenzije diva
    setTimeout(() => { if (_map) _map.invalidateSize(); }, 100);

    if (loadingDiv) {
      loadingDiv.style.display = 'flex';
      loadingDiv.textContent = '⏳ Učitavam podatke...';
    }

    // Paralelno učitaj GeoJSON i primke
    const [geojson, primke] = await Promise.all([
      _loadGeojson(),
      _loadPrimke(force),
    ]);

    _statusMap = _buildStatusMap(primke);
    _renderLayer(geojson, _statusMap);

    // Popraviti veličinu nakon rendera
    setTimeout(() => { if (_map) _map.invalidateSize(); }, 200);
  };

  // ---- FALLBACK PLAN ENTRIES ----
  // Kopija PLAN_ENTRIES ako godisnji-plan.js nije učitan (ili ih nije eksportovao)
  // Ovo osigurava da karta radi i bez godisnji-plan.js
  function _fallbackPlanEntries() {
    return [
      { gj:'Risovac Krupa', odjel:'13',    bruto:3244,  neto:2768 },
      { gj:'Risovac Krupa', odjel:'35',    bruto:5417,  neto:4648 },
      { gj:'Risovac Krupa', odjel:'50',    bruto:5161,  neto:4329 },
      { gj:'Risovac Krupa', odjel:'54P',   bruto:1511,  neto:1276 },
      { gj:'Risovac Krupa', odjel:'55',    bruto:5195,  neto:4258 },
      { gj:'Risovac Krupa', odjel:'56',    bruto:3877,  neto:3206 },
      { gj:'Risovac Krupa', odjel:'59/1',  bruto:3724,  neto:3087 },
      { gj:'Risovac Krupa', odjel:'63',    bruto:4033,  neto:3339 },
      { gj:'Risovac Krupa', odjel:'66',    bruto:2645,  neto:2307 },
      { gj:'Risovac Krupa', odjel:'68/2',  bruto:2605,  neto:2287 },
      { gj:'Risovac Krupa', odjel:'71P',   bruto:1957,  neto:1655 },
      { gj:'Risovac Krupa', odjel:'97',    bruto:4889,  neto:4058 },
      { gj:'Risovac Krupa', odjel:'113P',  bruto:5177,  neto:4300 },
      { gj:'Grmeč Jasenica', odjel:'4/1',   bruto:2490, neto:2117 },
      { gj:'Grmeč Jasenica', odjel:'11P',   bruto:208,  neto:179  },
      { gj:'Grmeč Jasenica', odjel:'43P',   bruto:1099, neto:740  },
      { gj:'Grmeč Jasenica', odjel:'60',    bruto:3551, neto:3061 },
      { gj:'Grmeč Jasenica', odjel:'61',    bruto:4774, neto:4105 },
      { gj:'Grmeč Jasenica', odjel:'64/2P', bruto:996,  neto:608  },
      { gj:'Grmeč Jasenica', odjel:'66',    bruto:5339, neto:4493 },
      { gj:'Grmeč Jasenica', odjel:'67',    bruto:4853, neto:4199 },
      { gj:'Grmeč Jasenica', odjel:'69P',   bruto:1309, neto:1204 },
      { gj:'Grmeč Jasenica', odjel:'85P',   bruto:678,  neto:418  },
      { gj:'Grmeč Jasenica', odjel:'88P',   bruto:1805, neto:1200 },
      { gj:'Vojskova', odjel:'15',  bruto:450, neto:383 },
      { gj:'Vojskova', odjel:'21P', bruto:787, neto:624 },
      { gj:'Vojskova', odjel:'25',  bruto:750, neto:637 },
    ];
  }

})();
