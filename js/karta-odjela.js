// ========================================
// js/karta-odjela.js
// Interaktivna mapa odjela — Pogon Bosanska Krupa 2026
// ========================================
(function () {
  'use strict';

  const GEOJSON_URL = 'data/odjeli.geojson';
  const CACHE_KEY   = 'cache_karta_primke';

  let _map         = null;
  let _layer       = null;
  let _geojson     = null;
  let _statusMap   = new Map();
  let _allFeatures = [];
  let _mapBounds   = null; // bounds iz GeoJSON extenta

  // ---- BOJE ----
  function _getColor(status) {
    switch (status) {
      case 'posjeceno': return '#16a34a';
      case 'u-sjeci':   return '#d97706';
      case 'planirano': return '#9ca3af';
      default:          return '#6366f1';
    }
  }

  function _getStyle(status) {
    const color = _getColor(status);
    return { fillColor: color, fillOpacity: 0.55, color: color, weight: 2, opacity: 0.85 };
  }

  function _getHoverStyle(status) {
    const color = _getColor(status);
    return { fillColor: color, fillOpacity: 0.8, color: '#1e293b', weight: 3, opacity: 1 };
  }

  // ---- NORMALIZACIJA ----
  function _normKey(s) {
    return String(s || '').trim().toUpperCase()
      .replace(/Č/g, 'C').replace(/Ć/g, 'C')
      .replace(/Š/g, 'S').replace(/Ž/g, 'Z').replace(/Đ/g, 'DJ')
      .replace(/\/\d+\s*$/, '')
      .replace(/P\s*$/, '')
      .trim();
  }

  function _fmt(n) {
    if (!n || isNaN(n)) return '—';
    const v = Math.round(n);
    return v === 0 ? '—' : v.toLocaleString('de-DE') + ' m³';
  }

  // ---- STATUS MAP ----
  function _buildStatusMap(primke) {
    const planEntries = _fallbackPlanEntries();
    const map = new Map();

    planEntries.forEach(entry => {
      const key = _normKey(entry.gj + ' ' + entry.odjel);
      const actual = { cTrupci:0, celDuga:0, celCijepana:0, skart:0, lTrupci:0, ogrDugi:0, ogrCijepani:0, gule:0, ukupno:0 };

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

      map.set(key, { gj: entry.gj, odjel: entry.odjel, status, pct, actual, neto: entry.neto, bruto: entry.bruto });
    });

    return map;
  }

  // ---- DETALJI MODAL ----
  function _openDetaljiModal(props, info) {
    const odjel  = props.odjel || props.name || '?';
    const gj     = props.gj   || '—';
    const odsjek = props.odsjek ? props.odsjek : '—';

    const statusLabel = { posjeceno:'Posječeno', 'u-sjeci':'U sječi', planirano:'Planirano' };
    const statusColor = { posjeceno:'#166534',   'u-sjeci':'#92400e', planirano:'#6b7280'   };
    const statusBg    = { posjeceno:'#dcfce7',   'u-sjeci':'#fef3c7', planirano:'#f3f4f6'   };

    let bodyHtml;

    if (!info) {
      bodyHtml = `
        <div style="text-align:center;padding:32px 0;color:#6366f1;">
          <div style="font-size:32px;margin-bottom:8px;">🌲</div>
          <div style="font-weight:700;font-size:15px;">Odjel ${odjel}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:4px;">${gj}</div>
          <div style="margin-top:16px;font-size:13px;background:#f0f0ff;padding:8px 16px;border-radius:8px;display:inline-block;">Nije u godišnjem planu 2026</div>
        </div>`;
    } else {
      const s   = info.status;
      const pct = info.pct != null ? info.pct.toFixed(1) : '0.0';
      const barW = Math.min(100, Math.round(info.pct || 0));
      const barColor = (info.pct || 0) > 100 ? '#dc2626' : _getColor(s);

      const sortRow = (label, val, plan, color) => {
        if (!val && !plan) return '';
        return `<tr>
          <td style="padding:5px 10px;font-size:12px;color:#374151;border-bottom:1px solid #f1f5f9;">${label}</td>
          <td style="padding:5px 10px;font-size:12px;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;color:${color||'#111'};">${_fmt(val)}</td>
          <td style="padding:5px 10px;font-size:12px;text-align:right;border-bottom:1px solid #f1f5f9;color:#9ca3af;">${_fmt(plan)}</td>
        </tr>`;
      };

      const a = info.actual;
      const e = _fallbackPlanEntries().find(x => _normKey(x.gj+' '+x.odjel) === _normKey(info.gj+' '+info.odjel)) || {};

      bodyHtml = `
        <!-- Header info -->
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:140px;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Gospodarska jedinica</div>
            <div style="font-weight:700;font-size:14px;">${gj}</div>
          </div>
          <div style="flex:1;min-width:80px;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Odsjek</div>
            <div style="font-weight:600;font-size:13px;">${odsjek}</div>
          </div>
          <div>
            <span style="background:${statusBg[s]};color:${statusColor[s]};padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;">${statusLabel[s]||s}</span>
          </div>
        </div>

        <!-- Realizacija bar -->
        <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:12px;font-weight:600;color:#374151;">Realizacija plana</span>
            <span style="font-size:16px;font-weight:800;color:${statusColor[s]};">${pct}%</span>
          </div>
          <div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:${barColor};border-radius:4px;transition:width .4s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;">
            <span style="font-size:11px;color:#6b7280;">Posječeno: <b style="color:#111;">${_fmt(a.ukupno)}</b></span>
            <span style="font-size:11px;color:#6b7280;">Plan neto: <b style="color:#111;">${_fmt(info.neto)}</b></span>
            <span style="font-size:11px;color:#6b7280;">Plan bruto: <b style="color:#111;">${_fmt(info.bruto)}</b></span>
          </div>
        </div>

        <!-- Sortimenti tabela -->
        <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Sortimenti</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 10px;font-size:11px;text-align:left;color:#6b7280;font-weight:600;">Sortiment</th>
              <th style="padding:6px 10px;font-size:11px;text-align:right;color:#6b7280;font-weight:600;">Posječeno</th>
              <th style="padding:6px 10px;font-size:11px;text-align:right;color:#9ca3af;font-weight:600;">Plan</th>
            </tr>
          </thead>
          <tbody>
            ${sortRow('TRUPCI Č',      a.cTrupci,     e.cTrupci,  '#1e40af')}
            ${sortRow('CEL.DUGA',      a.celDuga,     null,       '#5b21b6')}
            ${sortRow('CEL.CIJEPANA',  a.celCijepana, null,       '#7c3aed')}
            ${sortRow('ŠKART',         a.skart,       null,       '#9ca3af')}
            ${sortRow('TRUPCI L',      a.lTrupci,     e.lTrupci,  '#15803d')}
            ${sortRow('OGR.DUGI',      a.ogrDugi,     null,       '#92400e')}
            ${sortRow('OGR.CIJEPANI',  a.ogrCijepani, null,       '#b45309')}
            ${sortRow('GULE',          a.gule,        null,       '#d97706')}
            <tr style="background:#f8fafc;font-weight:800;">
              <td style="padding:7px 10px;font-size:12px;">UKUPNO</td>
              <td style="padding:7px 10px;font-size:13px;text-align:right;color:#059669;">${_fmt(a.ukupno)}</td>
              <td style="padding:7px 10px;font-size:12px;text-align:right;color:#9ca3af;">${_fmt(info.neto)}</td>
            </tr>
          </tbody>
        </table>`;
    }

    const title = `Odjel ${odjel}`;
    const gjColor = { 'Risovac Krupa':'#1d4ed8', 'Grmeč Jasenica':'#15803d', 'Vojskova':'#b45309' }[gj] || '#374151';

    document.getElementById('mapa-modal-title').textContent = title;
    document.getElementById('mapa-modal-gj').textContent = gj;
    document.getElementById('mapa-modal-gj').style.color = gjColor;
    document.getElementById('mapa-modal-body').innerHTML = bodyHtml;
    document.getElementById('mapa-modal').style.display = 'flex';
  }

  window.closeMapaModal = function () {
    document.getElementById('mapa-modal').style.display = 'none';
  };

  // ---- RENDEROVANJE LAYERA ----
  function _renderLayer(geojson, statusMap) {
    if (_layer) { _map.removeLayer(_layer); _layer = null; }
    _allFeatures = [];

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      const ld = document.getElementById('karta-loading');
      if (ld) { ld.style.display = 'flex'; ld.textContent = '📭 Nema podataka o poligonima.'; }
      return;
    }

    const ld = document.getElementById('karta-loading');
    if (ld) ld.style.display = 'none';

    _layer = L.geoJSON(geojson, {
      style: feature => {
        const p = feature.properties || {};
        const key = _normKey((p.gj||'') + ' ' + (p.odjel||p.name||''));
        const info = statusMap.get(key);
        return _getStyle(info ? info.status : 'bez-plana');
      },
      onEachFeature: (feature, lyr) => {
        const props  = feature.properties || {};
        const odjel  = String(props.odjel || props.name || '').trim();
        const gj     = String(props.gj || '').trim();
        const key    = _normKey(gj + ' ' + odjel);
        const info   = statusMap.get(key);
        const status = info ? info.status : 'bez-plana';

        lyr._kartaStatus = status;
        lyr._kartaGj     = gj;
        lyr._kartaInfo   = info;
        lyr._kartaProps  = props;
        _allFeatures.push(lyr);

        // Tooltip s brojem odjela (uvijek vidljiv)
        const label = odjel || '?';
        lyr.bindTooltip(label, { permanent: false, direction: 'center', className: 'karta-tooltip' });

        lyr.on('mouseover', function () {
          this.setStyle(_getHoverStyle(this._kartaStatus));
        });
        lyr.on('mouseout', function () {
          if (_layer) _layer.resetStyle(this);
        });
        lyr.on('click', function () {
          _openDetaljiModal(this._kartaProps, this._kartaInfo);
        });
      }
    });

    _layer.addTo(_map);

    // Postavi bounds iz extenta i zoom na njih
    try {
      _mapBounds = _layer.getBounds();
      if (_mapBounds.isValid()) {
        _map.fitBounds(_mapBounds, { padding: [20, 20] });
        // Zabrani panning van ovog područja (s malom marginom)
        const sw = _mapBounds.getSouthWest();
        const ne = _mapBounds.getNorthEast();
        const latPad = (_mapBounds.getNorth() - _mapBounds.getSouth()) * 0.3;
        const lngPad = (_mapBounds.getEast()  - _mapBounds.getWest())  * 0.3;
        _map.setMaxBounds([
          [sw.lat - latPad, sw.lng - lngPad],
          [ne.lat + latPad, ne.lng + lngPad],
        ]);
        _map.options.minZoom = 9;
      }
    } catch (e) {}
  }

  // ---- FILTER ----
  window.applyKartaFilter = function () {
    const gjF = (document.getElementById('karta-filter-gj')     || {}).value || 'sve';
    const stF = (document.getElementById('karta-filter-status') || {}).value || 'sve';
    _allFeatures.forEach(lyr => {
      const ok = (gjF === 'sve' || lyr._kartaGj === gjF) &&
                 (stF === 'sve' || lyr._kartaStatus === stF);
      if (ok) { if (!_map.hasLayer(lyr)) lyr.addTo(_map); }
      else    { if (_map.hasLayer(lyr))  _map.removeLayer(lyr); }
    });
  };

  window.resetKartaView = function () {
    document.getElementById('karta-filter-gj').value     = 'sve';
    document.getElementById('karta-filter-status').value = 'sve';
    applyKartaFilter();
    if (_mapBounds && _mapBounds.isValid()) _map.fitBounds(_mapBounds, { padding: [20, 20] });
  };

  // ---- UČITAVANJE ----
  async function _loadPrimke(force) {
    try {
      const url = (typeof buildApiUrl === 'function') ? buildApiUrl('primke') : null;
      if (!url) return [];
      const data = await fetchWithCache(url, CACHE_KEY, force || false, 150000);
      return (data && data.primke) ? data.primke : [];
    } catch (e) {
      console.warn('[Mapa] primke fetch failed:', e.message);
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) { const obj = JSON.parse(raw); return (obj && obj.data && obj.data.primke) || []; }
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
      console.error('[Mapa] GeoJSON fetch failed:', e.message);
      return { type:'FeatureCollection', features:[] };
    }
  }

  // ---- INICIJALIZACIJA ----
  window.initKartaOdjela = async function (force) {
    const mapDiv = document.getElementById('karta-odjela-map');
    if (!mapDiv) return;

    const content = document.getElementById('karta-odjela-content');
    if (content) content.classList.remove('hidden');

    if (!_map) {
      const ld = document.getElementById('karta-loading');
      if (ld) ld.style.display = 'none';

      _map = L.map('karta-odjela-map', {
        center: [44.55, 16.3],
        zoom: 11,
        zoomControl: true,
        maxBoundsViscosity: 0.9,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(_map);

    } else if (!force) {
      _map.invalidateSize();
      return;
    }

    setTimeout(() => { if (_map) _map.invalidateSize(); }, 100);

    const ld = document.getElementById('karta-loading');
    if (ld) { ld.style.display = 'flex'; ld.textContent = '⏳ Učitavam podatke...'; }

    const [geojson, primke] = await Promise.all([_loadGeojson(), _loadPrimke(force)]);
    _statusMap = _buildStatusMap(primke);
    _renderLayer(geojson, _statusMap);

    setTimeout(() => { if (_map) _map.invalidateSize(); }, 200);
  };

  // ---- PLAN ENTRIES ----
  function _fallbackPlanEntries() {
    return [
      { gj:'Risovac Krupa', odjel:'13',    bruto:3244,  neto:2768, cTrupci:3,    lTrupci:875  },
      { gj:'Risovac Krupa', odjel:'35',    bruto:5417,  neto:4648, cTrupci:122,  lTrupci:1813 },
      { gj:'Risovac Krupa', odjel:'50',    bruto:5161,  neto:4329, cTrupci:1824, lTrupci:971  },
      { gj:'Risovac Krupa', odjel:'54P',   bruto:1511,  neto:1276, cTrupci:639,  lTrupci:208  },
      { gj:'Risovac Krupa', odjel:'55',    bruto:5195,  neto:4258, cTrupci:2193, lTrupci:789  },
      { gj:'Risovac Krupa', odjel:'56',    bruto:3877,  neto:3206, cTrupci:1779, lTrupci:439  },
      { gj:'Risovac Krupa', odjel:'59/1',  bruto:3724,  neto:3087, cTrupci:1545, lTrupci:658  },
      { gj:'Risovac Krupa', odjel:'63',    bruto:4033,  neto:3339, cTrupci:1309, lTrupci:796  },
      { gj:'Risovac Krupa', odjel:'66',    bruto:2645,  neto:2307, cTrupci:0,    lTrupci:949  },
      { gj:'Risovac Krupa', odjel:'68/2',  bruto:2605,  neto:2287, cTrupci:35,   lTrupci:1012 },
      { gj:'Risovac Krupa', odjel:'71P',   bruto:1957,  neto:1655, cTrupci:664,  lTrupci:401  },
      { gj:'Risovac Krupa', odjel:'97',    bruto:4889,  neto:4058, cTrupci:1253, lTrupci:901  },
      { gj:'Risovac Krupa', odjel:'113P',  bruto:5177,  neto:4300, cTrupci:225,  lTrupci:1278 },
      { gj:'Grmeč Jasenica', odjel:'4/1',   bruto:2490, neto:2117, cTrupci:0,   lTrupci:303  },
      { gj:'Grmeč Jasenica', odjel:'11P',   bruto:208,  neto:179,  cTrupci:0,   lTrupci:73   },
      { gj:'Grmeč Jasenica', odjel:'43P',   bruto:1099, neto:740,  cTrupci:40,  lTrupci:160  },
      { gj:'Grmeč Jasenica', odjel:'60',    bruto:3551, neto:3061, cTrupci:295, lTrupci:1050 },
      { gj:'Grmeč Jasenica', odjel:'61',    bruto:4774, neto:4105, cTrupci:454, lTrupci:1393 },
      { gj:'Grmeč Jasenica', odjel:'64/2P', bruto:996,  neto:608,  cTrupci:13,  lTrupci:211  },
      { gj:'Grmeč Jasenica', odjel:'66',    bruto:5339, neto:4493, cTrupci:0,   lTrupci:1025 },
      { gj:'Grmeč Jasenica', odjel:'67',    bruto:4853, neto:4199, cTrupci:0,   lTrupci:1530 },
      { gj:'Grmeč Jasenica', odjel:'69P',   bruto:1309, neto:1204, cTrupci:82,  lTrupci:390  },
      { gj:'Grmeč Jasenica', odjel:'85P',   bruto:678,  neto:418,  cTrupci:0,   lTrupci:25   },
      { gj:'Grmeč Jasenica', odjel:'88P',   bruto:1805, neto:1200, cTrupci:0,   lTrupci:20   },
      { gj:'Vojskova', odjel:'15',  bruto:450, neto:383, cTrupci:0, lTrupci:0   },
      { gj:'Vojskova', odjel:'21P', bruto:787, neto:624, cTrupci:0, lTrupci:202 },
      { gj:'Vojskova', odjel:'25',  bruto:750, neto:637, cTrupci:0, lTrupci:0   },
    ];
  }

})();
