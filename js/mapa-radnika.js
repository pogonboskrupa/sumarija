// ========== MAPA ODJELA — RADNIK (primač / otpremač) ==========
// Prikazuje SVE odjele na Leaflet mapi — odjeli u kojima je ulogovani radnik
// radio su istaknuti (zeleno, jače popunjeno), ostali su blijedi/neutralni
// radi orijentacije. Klik na ISTAKNUTI odjel → popup sa NJEGOVIM podacima za
// taj odjel (m³ po sortimentu, zadnji datum); klik na neistaknuti odjel ne radi
// ništa (nema podataka radnika za taj odjel). Dugme "Moja lokacija" → GPS pin
// (radi i offline).
//
// Dizajn: zaseban, lagan Leaflet instance (svoj container #radnik-mapa-map),
// NE dira postojeći admin karta-odjela.js singleton.

(function() {
    'use strict';

    var GEOJSON_URL = 'data/odjeli.geojson';
    // Lokacija Šumarije Bosanska Krupa (default centar dok GPS ne stigne)
    var SUMARIJA_LATLNG = [44.883425, 16.154427];

    // ---- Ključ helperi — OGLEDALO js/karta-odjela.js (_normKey/_labelKey).
    // Namjerno duplirano da se ne dira radni admin map modul. Sheet ODJEL kolona
    // sadrži puni "GJ odjel" string (npr. "Vojskova 73"), isti format koji admin
    // mapa koristi za matchovanje na GeoJSON poligone (properties gj + odjel).
    function _normKey(s) {
        return String(s || '').trim().toUpperCase()
            .replace(/Č/g, 'C').replace(/Ć/g, 'C')
            .replace(/Š/g, 'S').replace(/Ž/g, 'Z').replace(/Đ/g, 'DJ')
            .replace(/P\s*$/, '')       // strip trailing P prije /N
            .replace(/\/\d+\s*$/, '')   // strip /N sufiks (64/1 i 64/2 → "64")
            .trim();
    }
    function _labelKey(s) {
        return String(s || '').trim().toUpperCase()
            .replace(/Č/g, 'C').replace(/Ć/g, 'C')
            .replace(/Š/g, 'S').replace(/Ž/g, 'Z').replace(/Đ/g, 'DJ')
            .replace(/P\s*$/, '')       // čuva /N — 64/1 ≠ 64/2
            .trim();
    }

    var _map = null;
    var _layer = null;
    var _geojson = null;
    var _locMarker = null;
    var _locCircle = null;
    var _odjeliByKey = null; // labelKey/normKey -> radnikov odjel objekat

    function _fmt(n) {
        if (n == null || isNaN(n)) return '—';
        var v = Math.round(n * 100) / 100;
        return v === 0 ? '—' : v.toLocaleString('de-DE') + ' m³';
    }

    async function _loadGeojson() {
        if (_geojson) return _geojson;
        try {
            // Bez cache:'reload' — Service Worker cache-first servira offline kopiju
            var r = await fetch(GEOJSON_URL);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            _geojson = JSON.parse(await r.text());
            return _geojson;
        } catch (e) {
            console.error('[MapaRadnika] GeoJSON fetch failed:', e);
            return { type: 'FeatureCollection', features: [] };
        }
    }

    // Popup: samo radnikovi podaci za taj odjel (nenulti sortimenti + ukupno)
    function _popupHtml(o) {
        var grupne = { 'UKUPNO Č+L': 1, 'Σ ČETINARI': 1, 'LIŠĆARI': 1 };
        var sort = o.sortimenti || {};
        var rows = Object.keys(sort)
            .filter(function(s) { return (sort[s] || 0) > 0 && !grupne[s]; })
            .map(function(s) {
                return '<tr><td style="padding:2px 10px 2px 0;color:#374151;">' + s +
                    '</td><td style="text-align:right;font-weight:600;color:#164e63;">' + _fmt(sort[s]) + '</td></tr>';
            }).join('');
        return '<div style="min-width:210px;max-width:280px;">' +
            '<div style="font-weight:700;color:#047857;font-size:15px;margin-bottom:2px;">📁 Odjel ' + (o.odjel || '?') + '</div>' +
            '<div style="font-size:11px;color:#6b7280;margin-bottom:8px;">Zadnji unos: ' + (o.zadnjiDatum || '—') + '</div>' +
            '<table style="font-size:12px;border-collapse:collapse;width:100%;">' +
            (rows || '<tr><td colspan="2" style="color:#9ca3af;">Nema sortimenata</td></tr>') +
            '</table>' +
            '<div style="margin-top:6px;border-top:2px solid #10b981;padding-top:5px;font-weight:800;color:#047857;display:flex;justify-content:space-between;">' +
            '<span>UKUPNO</span><span>' + _fmt(o.ukupno) + '</span></div>' +
            '</div>';
    }

    function _featureKeys(feature) {
        var p = feature.properties || {};
        var s = (p.gj || '') + ' ' + (p.odjel || p.name || '');
        return { lk: _labelKey(s), nk: _normKey(s) };
    }

    function _renderLayer(geojson) {
        if (_layer) { _map.removeLayer(_layer); _layer = null; }

        var radnikLayers = []; // samo poligoni gdje je radnik radio — za fitBounds

        _layer = L.geoJSON(geojson, {
            // Iscrtaj SVE odjele — radnikovi su istaknuti (zeleno), ostali blijedo/neutralno
            style: function(feature) {
                var k = _featureKeys(feature);
                var radio = _odjeliByKey.has(k.lk) || _odjeliByKey.has(k.nk);
                return radio
                    ? { color: '#047857', weight: 2, fillColor: '#10b981', fillOpacity: 0.45 }
                    : { color: '#94a3b8', weight: 1, fillColor: '#cbd5e1', fillOpacity: 0.08 };
            },
            onEachFeature: function(feature, lyr) {
                var p = feature.properties || {};
                var k = _featureKeys(feature);
                var o = _odjeliByKey.get(k.lk) || _odjeliByKey.get(k.nk);
                var radio = !!o;

                lyr.bindTooltip(String(p.odjel || p.name || '?'), {
                    permanent: false, direction: 'center', className: 'karta-tooltip'
                });
                lyr.on('mouseover', function() {
                    this.setStyle(radio ? { fillOpacity: 0.7, weight: 3 } : { fillOpacity: 0.2, weight: 1.5 });
                });
                lyr.on('mouseout', function() {
                    this.setStyle(radio ? { fillOpacity: 0.45, weight: 2 } : { fillOpacity: 0.08, weight: 1 });
                });
                if (radio) {
                    radnikLayers.push(lyr);
                    lyr.on('click', function() {
                        this.bindPopup(_popupHtml(o), { maxWidth: 320 }).openPopup();
                    });
                }
            }
        }).addTo(_map);

        // Zoomiraj na radnikove odjele (ne na cijelu mapu svih odjela)
        try {
            if (radnikLayers.length) {
                var b = L.featureGroup(radnikLayers).getBounds();
                if (b.isValid()) _map.fitBounds(b, { padding: [30, 30], maxZoom: 14 });
            }
        } catch (_) {}

        return radnikLayers.length;
    }

    // ---- MOJA LOKACIJA (GPS) ----
    function _locateMe() {
        var btn = document.getElementById('radnik-mapa-loc-btn');
        if (!navigator.geolocation) {
            alert('Vaš uređaj ne podržava geolokaciju.');
            return;
        }
        if (!_map) return;
        if (btn) { btn.disabled = true; btn.textContent = '📍 Tražim...'; }

        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var ll = [pos.coords.latitude, pos.coords.longitude];
                if (_locMarker) { _map.removeLayer(_locMarker); _locMarker = null; }
                if (_locCircle) { _map.removeLayer(_locCircle); _locCircle = null; }
                _locCircle = L.circle(ll, {
                    radius: pos.coords.accuracy || 30,
                    color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 1
                }).addTo(_map);
                _locMarker = L.circleMarker(ll, {
                    radius: 9, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.95, weight: 3
                }).bindTooltip('📍 Vi ste ovdje', { permanent: true, direction: 'top', offset: [0, -8] }).addTo(_map);
                _map.setView(ll, 15);
                if (btn) { btn.disabled = false; btn.textContent = '📍 Moja lokacija'; }
            },
            function(err) {
                if (btn) { btn.disabled = false; btn.textContent = '📍 Moja lokacija'; }
                var msg = err.code === 1
                    ? 'Pristup lokaciji je odbijen. Dozvolite lokaciju u postavkama uređaja/browsera.'
                    : (err.code === 3 ? 'Isteklo vrijeme čekanja na GPS signal. Pokušajte ponovo na otvorenom.' : 'Nije moguće dobiti lokaciju.');
                alert(msg);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    }
    window.mapaRadnikaLocateMe = _locateMe;

    // ---- INICIJALIZACIJA ----
    // type: 'primac' | 'otpremac'
    window.initMapaRadnika = async function(type) {
        var mapDiv = document.getElementById('radnik-mapa-map');
        if (!mapDiv) return;
        var content = document.getElementById('radnik-mapa-content');
        if (content) content.classList.remove('hidden');

        if (!_map) {
            _map = L.map('radnik-mapa-map', { center: SUMARIJA_LATLNG, zoom: 11, zoomControl: true });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 18
            }).addTo(_map);
        }
        // Leaflet mora preračunati veličinu nakon što tab postane vidljiv
        setTimeout(function() { if (_map) _map.invalidateSize(); }, 100);

        var status = document.getElementById('radnik-mapa-status');
        var endpoint = (type === 'otpremac') ? 'otpremac-odjeli' : 'primac-odjeli';
        var tabId = (type === 'otpremac') ? 'otpremac-mapa' : 'primac-mapa';
        // Zaseban keš (viši limit) da mapa prikaže SVE radnikove odjele, ne samo top 15
        var cacheKey = 'cache_' + type + '_odjeli_mapa';

        if (status) status.textContent = navigator.onLine ? '⏳ Učitavam...' : '📦 Keširano...';

        try {
            var url = buildApiUrl(endpoint, { limit: 300 });
            var data = await fetchWithCache(url, cacheKey);
            var odjeli = (data && data.odjeli) || [];

            _odjeliByKey = new Map();
            odjeli.forEach(function(o) {
                if (!o || !o.odjel) return;
                // Precizni ključ (čuva /N) — uvijek
                _odjeliByKey.set(_labelKey(o.odjel), o);
                // normKey fallback SAMO ako radnikov zapis NEMA /N pododsjek —
                // tako "Vojskova 73" matchuje sve odsjeke odjela 73, ali "59/1"
                // NE prelijeva highlight na susjedni "59/2" (isti obrazac kao
                // precise/fallback u admin mapi za prikaz otpreme).
                var raw = String(o.odjel).replace(/P\s*$/, '');
                if (!/\/\d+\s*$/.test(raw)) {
                    var nk = _normKey(o.odjel);
                    if (!_odjeliByKey.has(nk)) _odjeliByKey.set(nk, o);
                }
            });

            var geojson = await _loadGeojson();
            var brojIstaknuto = _renderLayer(geojson);

            if (status) {
                status.textContent = odjeli.length
                    ? (odjeli.length + ' odjela · ' + brojIstaknuto + ' istaknuto na mapi')
                    : 'Nema odjela za prikaz — svi ostali odjeli su ipak vidljivi na mapi';
            }
            if (typeof markTabRendered === 'function') markTabRendered(tabId);
        } catch (e) {
            console.error('[MapaRadnika] load fail:', e);
            if (status) status.textContent = 'Greška: ' + e.message;
        }
    };

    console.log('[MapaRadnika] modul učitan');
})();
