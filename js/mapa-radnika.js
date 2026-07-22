// ========== MAPA ODJELA — RADNIK (primač / otpremač) ==========
// Prikazuje SVE odjele na Leaflet mapi — odjeli u kojima je ulogovani radnik
// radio su istaknuti (zeleno, jače popunjeno), ostali su blijedi/neutralni
// radi orijentacije. Klik na ISTAKNUTI odjel → popup sa NJEGOVIM podacima za
// taj odjel (m³ po sortimentu, zadnji datum); klik na neistaknuti odjel ne radi
// ništa (nema podataka radnika za taj odjel).
//
// Dugmad ("📍 Moja lokacija", "⏺️ Snimi trag", "🗑️ Obriši tragove") su u
// FIKSNOJ DONJOJ TRACI IZVAN Leaflet kontejnera (obična HTML dugmad u
// index.html, ne Leaflet control) — dodir/pan gesta na mapi ih ne blokira.
// "✕ Zatvori" dugme u zaglavlju vraća na radnikov početni tab
// (primac-personal / otpremac-personal). Snimljeni trag se čuva u
// localStorage (po korisniku) i ostaje vidljiv i nakon zatvaranja/ponovnog
// otvaranja mape.
//
// Dizajn: zaseban, lagan Leaflet instance (svoj container #radnik-mapa-map),
// NE dira postojeći admin karta-odjela.js singleton.

(function() {
    'use strict';

    var GEOJSON_URL = 'data/odjeli.geojson';
    // Lokacija Šumarije Bosanska Krupa (default centar dok GPS ne stigne)
    var SUMARIJA_LATLNG = [44.883425, 16.154427];

    // Filter tačaka trага — ne dodavaj novu tačku ako je bliže od MIN_DIST_M
    // metara ILI je prošlo manje od MIN_TIME_MS od zadnje tačke (GPS na terenu
    // zna "drhtati" u mjestu — bez ovoga bi se localStorage brzo napunio).
    var TRAG_MIN_DIST_M = 8;
    var TRAG_MIN_TIME_MS = 3000;

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
    var _haloLayer = null; // žuti "halo" ispod crne linije (crtan prvi, ispod _layer)
    var _geojson = null;
    var _locMarker = null;
    var _locCircle = null;
    var _odjeliByKey = null; // labelKey/normKey -> radnikov odjel objekat

    // ---- Snimanje traga ----
    var _recording = false;
    var _watchId = null;
    var _currentTrackPoints = []; // [[lat,lng], ...]
    var _currentTrackPolyline = null;
    var _savedTrackLayers = [];   // L.polyline instance za već sačuvane tragove
    var _lastTragTs = 0;
    var _tragStartIso = null;

    var _locBtnEl = null;
    var _tragBtnEl = null;
    var _osmLayer = null; // referenca na osnovni OSM tile sloj

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

    // Popup: samo radnikovi podaci za taj odjel (nenulti sortimenti + ukupno).
    // Klasa "rm-odjel-popup" (umjesto inline min/max-width) — omogućava CSS
    // media-query da uveća tekst/razmak na mobilnom (index.html), gdje je
    // sitan popup tekst inače teško čitljiv na terenu.
    function _popupHtml(o) {
        var grupne = { 'UKUPNO Č+L': 1, 'Σ ČETINARI': 1, 'LIŠĆARI': 1 };
        var sort = o.sortimenti || {};
        var rows = Object.keys(sort)
            .filter(function(s) { return (sort[s] || 0) > 0 && !grupne[s]; })
            .map(function(s) {
                return '<tr><td class="rm-popup-label">' + s +
                    '</td><td class="rm-popup-val">' + _fmt(sort[s]) + '</td></tr>';
            }).join('');
        return '<div class="rm-odjel-popup">' +
            '<div class="rm-popup-title">📁 Odjel ' + (o.odjel || '?') + '</div>' +
            '<div class="rm-popup-datum">Zadnji unos: ' + (o.zadnjiDatum || '—') + '</div>' +
            '<table class="rm-popup-table">' +
            (rows || '<tr><td colspan="2" style="color:#9ca3af;">Nema sortimenata</td></tr>') +
            '</table>' +
            '<div class="rm-popup-total">' +
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
        if (_haloLayer) { _map.removeLayer(_haloLayer); _haloLayer = null; }

        var radnikLayers = []; // samo poligoni gdje je radnik radio — za fitBounds

        // "Halo" efekat — crna linija sa žutim obrubom (najbolja vidljivost na
        // terenu bez obzira na pozadinu karte). Tehnika: DVA sloja iste
        // geometrije — donji, širi, žut i BEZ ispune (samo halo), i gornji,
        // uži, crn, koji nosi stvarnu ispunu i sve interakcije (klik/hover/popup).
        _haloLayer = L.geoJSON(geojson, {
            interactive: false, // halo ne smije hvatati klik/hover — to radi gornji sloj
            style: function(feature) {
                var k = _featureKeys(feature);
                var radio = _odjeliByKey.has(k.lk) || _odjeliByKey.has(k.nk);
                return { color: '#facc15', weight: radio ? 7 : 4.5, fill: false, opacity: 0.95 };
            }
        }).addTo(_map);

        _layer = L.geoJSON(geojson, {
            // Ispuna razlikuje istaknute (zeleno) od ostalih (blijedo/neutralno);
            // rub je crn i tanji od žutog haloa ispod njega (halo proviruje sa obje
            // strane crne linije — "outline" efekat, čitljivo na svakoj podlozi).
            style: function(feature) {
                var k = _featureKeys(feature);
                var radio = _odjeliByKey.has(k.lk) || _odjeliByKey.has(k.nk);
                return radio
                    ? { color: '#111827', weight: 2.5, fillColor: '#10b981', fillOpacity: 0.45 }
                    : { color: '#111827', weight: 1.8, fillColor: '#cbd5e1', fillOpacity: 0.08 };
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
                    this.setStyle(radio ? { fillOpacity: 0.7, weight: 4 } : { fillOpacity: 0.2, weight: 2.8 });
                });
                lyr.on('mouseout', function() {
                    this.setStyle(radio ? { fillOpacity: 0.45, weight: 2.5 } : { fillOpacity: 0.08, weight: 1.8 });
                });
                if (radio) {
                    radnikLayers.push(lyr);
                    lyr.on('click', function() {
                        // maxWidth se računa u odnosu na širinu ekrana da popup
                        // uvijek stane na malim mobilnim ekranima bez sažimanja
                        var mw = Math.max(240, Math.min(320, window.innerWidth - 40));
                        this.bindPopup(_popupHtml(o), { maxWidth: mw, minWidth: 220, autoPan: true, autoPanPadding: [20, 20] }).openPopup();
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
        if (!navigator.geolocation) {
            alert('Vaš uređaj ne podržava geolokaciju.');
            return;
        }
        if (!_map) return;
        if (_locBtnEl) { _locBtnEl.disabled = true; _locBtnEl.textContent = '📍 Tražim...'; }

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
                if (_locBtnEl) { _locBtnEl.disabled = false; _locBtnEl.textContent = '📍 Moja lokacija'; }
            },
            function(err) {
                if (_locBtnEl) { _locBtnEl.disabled = false; _locBtnEl.textContent = '📍 Moja lokacija'; }
                var msg = err.code === 1
                    ? 'Pristup lokaciji je odbijen. Dozvolite lokaciju u postavkama uređaja/browsera.'
                    : (err.code === 3 ? 'Isteklo vrijeme čekanja na GPS signal. Pokušajte ponovo na otvorenom.' : 'Nije moguće dobiti lokaciju.');
                alert(msg);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    }

    // ---- SNIMANJE TRAGA ----
    function _tragStorageKey() {
        var uname = (window.currentUser && window.currentUser.username) || 'anon';
        return 'mapa_radnika_tragovi_' + uname;
    }

    function _loadSavedTracks() {
        try {
            var raw = localStorage.getItem(_tragStorageKey());
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }

    function _saveTracks(tracks) {
        try { localStorage.setItem(_tragStorageKey(), JSON.stringify(tracks)); } catch (_) {}
    }

    function _drawSavedTracks() {
        _savedTrackLayers.forEach(function(l) { _map.removeLayer(l); });
        _savedTrackLayers = [];
        _loadSavedTracks().forEach(function(t) {
            if (!t.points || t.points.length < 2) return;
            var pl = L.polyline(t.points, { color: '#7c3aed', weight: 3, opacity: 0.6, dashArray: '6 6' }).addTo(_map);
            pl.bindTooltip('Trag — ' + (t.start ? new Date(t.start).toLocaleString('bs-BA') : '?'), { sticky: true });
            _savedTrackLayers.push(pl);
        });
    }

    // Haversine distanca u metrima
    function _distM(a, b) {
        var R = 6371000;
        var dLat = (b[0] - a[0]) * Math.PI / 180;
        var dLng = (b[1] - a[1]) * Math.PI / 180;
        var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }

    function _onTragPosition(pos) {
        var ll = [pos.coords.latitude, pos.coords.longitude];
        var now = Date.now();
        var last = _currentTrackPoints[_currentTrackPoints.length - 1];
        if (last) {
            var elapsed = now - _lastTragTs;
            if (elapsed < TRAG_MIN_TIME_MS && _distM(last, ll) < TRAG_MIN_DIST_M) return;
        }
        _lastTragTs = now;
        _currentTrackPoints.push(ll);
        if (!_currentTrackPolyline) {
            _currentTrackPolyline = L.polyline([ll], { color: '#dc2626', weight: 4, opacity: 0.85 }).addTo(_map);
        } else {
            _currentTrackPolyline.addLatLng(ll);
        }
    }

    function _startTrag() {
        if (!navigator.geolocation) {
            alert('Vaš uređaj ne podržava geolokaciju.');
            return;
        }
        _currentTrackPoints = [];
        _lastTragTs = 0;
        _tragStartIso = new Date().toISOString();
        if (_currentTrackPolyline) { _map.removeLayer(_currentTrackPolyline); _currentTrackPolyline = null; }

        _watchId = navigator.geolocation.watchPosition(_onTragPosition, function(err) {
            console.error('[MapaRadnika] watchPosition greška:', err);
        }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });

        _recording = true;
        if (_tragBtnEl) {
            _tragBtnEl.textContent = '⏹️ Zaustavi snimanje';
            _tragBtnEl.classList.add('recording');
        }
    }

    function _stopTrag() {
        if (_watchId != null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
        _recording = false;
        if (_tragBtnEl) {
            _tragBtnEl.textContent = '⏺️ Snimi trag';
            _tragBtnEl.classList.remove('recording');
        }

        if (_currentTrackPoints.length >= 2) {
            var tracks = _loadSavedTracks();
            tracks.push({
                start: _tragStartIso || new Date().toISOString(),
                end: new Date().toISOString(),
                points: _currentTrackPoints
            });
            _saveTracks(tracks);
        }
        if (_currentTrackPolyline) { _map.removeLayer(_currentTrackPolyline); _currentTrackPolyline = null; }
        _currentTrackPoints = [];
        _drawSavedTracks();
    }

    function _toggleTrag() {
        if (_recording) _stopTrag();
        else _startTrag();
    }

    function _clearTracks() {
        if (!confirm('Obrisati sve sačuvane tragove? Ova radnja se ne može poništiti.')) return;
        _saveTracks([]);
        _drawSavedTracks();
    }

    // ---- Dugmad — obična HTML dugmad IZVAN Leaflet kontejnera (donja traka
    // u index.html, #radnik-mapa-content), NE Leaflet control. Ranije su ova
    // dugmad bila Leaflet L.Control POVRH mape — dodir na mapu (pan gesta) je
    // hvatao dodir i oko/na dugmadima, pa je do njih bilo teško doći. Obična
    // DOM dugmad van #radnik-mapa-map rješavaju to jer ih Leaflet ne "vidi".
    function _bindBarButtons() {
        _locBtnEl = document.getElementById('radnik-mapa-loc-btn');
        _tragBtnEl = document.getElementById('radnik-mapa-trag-btn');
    }

    // ---- Puni ekran (AlpineQuest-stil) — vidi CSS "body.radnik-mapa-fullscreen"
    // u index.html. Donja traka je poseban element van #radnik-mapa-content
    // (izvan .container "contain:layout" konteksta koji bi inače slomio njeno
    // position:fixed), pa se vidljivost mora ručno sinhronizovati sa ulaskom/
    // izlaskom iz mape — nije više dio [id$="-content"] hide/show mehanizma.
    function _enterMapaFullscreen() {
        document.body.classList.add('radnik-mapa-fullscreen');
        var bar = document.getElementById('radnik-mapa-bottombar');
        if (bar) bar.style.display = 'flex';
        setTimeout(function() { if (_map) _map.invalidateSize(); }, 50);
    }
    function _exitMapaFullscreen() {
        document.body.classList.remove('radnik-mapa-fullscreen');
        var bar = document.getElementById('radnik-mapa-bottombar');
        if (bar) bar.style.display = 'none';
    }
    // Poziva se iz switchTab (js/ui.js) kad se prelazi na BILO KOJI drugi tab —
    // sigurnosna mreža za slučaj da korisnik ode s mape mimo "Zatvori" dugmeta.
    window.exitMapaRadnikaFullscreenIfActive = function(nextTab) {
        if (nextTab !== 'primac-mapa' && nextTab !== 'otpremac-mapa') _exitMapaFullscreen();
    };

    window.mapaRadnikaLocateMe = _locateMe;
    window.mapaRadnikaToggleTrag = _toggleTrag;
    window.mapaRadnikaClearTracks = _clearTracks;
    window.closeMapaRadnika = function() {
        _exitMapaFullscreen();
        var home = (_workerType === 'otpremac') ? 'otpremac-personal' : 'primac-personal';
        if (typeof switchTab === 'function') switchTab(home);
    };

    // ---- INICIJALIZACIJA ----
    // type: 'primac' | 'otpremac'
    var _workerType = null;
    window.initMapaRadnika = async function(type) {
        _workerType = type;
        var mapDiv = document.getElementById('radnik-mapa-map');
        if (!mapDiv) return;
        var content = document.getElementById('radnik-mapa-content');
        if (content) content.classList.remove('hidden');
        _enterMapaFullscreen();

        if (!_map) {
            _map = L.map('radnik-mapa-map', { center: SUMARIJA_LATLNG, zoom: 11, zoomControl: true });
            _osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 18
            }).addTo(_map);
            _bindBarButtons();
            _drawSavedTracks();
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
