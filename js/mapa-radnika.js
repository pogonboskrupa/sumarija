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
    var _recentSet = null;   // Set referenci na zadnja 3 odjela (samo za primača) — vidi initMapaRadnika
    var _allLayers = [];     // SVI polygon layer-i (radio i ne-radio) — za "Prikaži odjele" grupisanje po odsjeku
    var _labelMarkers = [];  // trajne oznake brojeva odjela (checkbox "Prikaži odjele")
    var _autoFitDone = false; // spriječi da automatski fitBounds "otme" pogled nakon prvog prikaza/kad postoji sačuvan pogled

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
    var _satLayer = null; // ArcGIS satelitski sloj (isti izvor kao admin karta-odjela.js)
    var _isSat = false;

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
    // Chips za jednu grupu (četinari/lišćari) — redoslijed iz KUBIKATOR_CETINARI/
    // KUBIKATOR_LISCARI (js/kubikator.js, ista klasifikacija koja se već koristi
    // za bojenje redova sortimenata u Izvještaju po odjelima).
    function _chipsFor(sort, list, extraClass) {
        return (list || []).filter(function(s) { return (sort[s] || 0) > 0; })
            .map(function(s) {
                return '<div class="rm-popup-chip ' + extraClass + '"><span class="rm-popup-chip-label">' + s +
                    '</span><span class="rm-popup-chip-val">' + _fmt(sort[s]) + '</span></div>';
            }).join('');
    }

    function _popupHtml(o) {
        var sort = o.sortimenti || {};
        // Dva odvojena reda — prvi red četinari, drugi red lišćari — umjesto
        // jednog izmiješanog grida, po istoj klasifikaciji/bojama koje se već
        // koriste u Izvještaju po odjelima (zeleno četinari, plavo lišćari).
        var cChips = _chipsFor(sort, typeof KUBIKATOR_CETINARI !== 'undefined' ? KUBIKATOR_CETINARI : [], 'rm-chip-cetinar');
        var lChips = _chipsFor(sort, typeof KUBIKATOR_LISCARI !== 'undefined' ? KUBIKATOR_LISCARI : [], 'rm-chip-liscar');
        var rows =
            (cChips ? '<div class="rm-popup-row-label">🌲 Četinari</div><div class="rm-popup-grid">' + cChips + '</div>' : '') +
            (lChips ? '<div class="rm-popup-row-label">🍂 Lišćari</div><div class="rm-popup-grid">' + lChips + '</div>' : '') +
            (!cChips && !lChips ? '<span style="color:#9ca3af;font-size:12px;">Nema sortimenata</span>' : '');
        return '<div class="rm-odjel-popup">' +
            '<div class="rm-popup-title">📁 Odjel ' + (o.odjel || '?') + '</div>' +
            '<div class="rm-popup-datum">Zadnji unos: ' + (o.zadnjiDatum || '—') + '</div>' +
            rows +
            '<div class="rm-popup-total">' +
            '<span>UKUPNO</span><span>' + _fmt(o.ukupno) + '</span></div>' +
            '</div>';
    }

    // Fiksni info panel (vidi index.html #radnik-mapa-info-panel) — dijete
    // #radnik-mapa-map diva, prikazan/skriven preko klase "hidden", uvijek
    // pozicioniran u gornjem dijelu mape bez obzira gdje je odjel kliknut.
    function _showInfoPanel(o) {
        var panel = document.getElementById('radnik-mapa-info-panel');
        var body = document.getElementById('radnik-mapa-info-panel-body');
        if (!panel || !body) return;
        body.innerHTML = _popupHtml(o);
        panel.classList.remove('hidden');
    }
    function _hideInfoPanel() {
        var panel = document.getElementById('radnik-mapa-info-panel');
        if (panel) panel.classList.add('hidden');
    }
    window.mapaRadnikaCloseInfoPanel = _hideInfoPanel;

    function _featureKeys(feature) {
        var p = feature.properties || {};
        var s = (p.gj || '') + ' ' + (p.odjel || p.name || '');
        return { lk: _labelKey(s), nk: _normKey(s) };
    }

    // ---- "PRIKAŽI ODJELE" — trajne oznake, jedna po grupi odsjeka ----
    // Isti obrazac kao js/karta-odjela.js: grupiši sve poligone po _labelKey
    // (gj+odjel, čuva /N razlike), nađi poligon s najvećom površinom u svakoj
    // grupi (heuristika za "centar" grupe odsjeka) i postavi JEDNU trajnu
    // oznaku tamo — umjesto jedne oznake po odsjeku (što bi napravilo gomilu
    // duplih brojeva na istom mjestu za odjele sa više odsjeka).
    // Zoom-zavisna veličina oznake (isti obrazac kao js/karta-odjela.js
    // _updateLabelSizes — injektuje jedan <style> u <head> koji cilja klasu
    // umjesto da mijenja svaki marker pojedinačno). Cilja SAMO .rm-odjel-label
    // (ne .karta-tooltip generalno — tu klasu dijeli i hover tooltip u ovom
    // modulu i cijela admin karta, ne smiju biti pogođeni odavde).
    var _labelStyleEl = null;
    function _updateLabelSizes() {
        var z = _map ? _map.getZoom() : 12;
        // window.innerWidth NIJE pouzdan ovdje — "Desktop prikaz" (toggleDesktopView,
        // js/ui.js) postavlja <meta name="viewport" content="width=1200,...">, pa
        // innerWidth prijavljuje ~1200 čak i na malom telefonu. Ako je taj mod
        // uključen, tretiraj kao "mobilno" (veće oznake) bez obzira na (nepouzdanu)
        // prijavljenu širinu — Mapa odjela je terenski alat, ne pravi desktop prikaz.
        var mobile = document.body.classList.contains('force-desktop-view') || window.innerWidth <= 1024;
        var size =
            z >= 16 ? (mobile ? 26 : 15) :
            z >= 15 ? (mobile ? 22 : 13) :
            z >= 14 ? (mobile ? 19 : 11) :
            z >= 13 ? (mobile ? 15 : 9)  :
            z >= 12 ? (mobile ? 12 : 7)  :
            z >= 11 ? (mobile ? 8  : 5)  : 0;
        var vis = size > 0 ? 'visible' : 'hidden';
        if (!_labelStyleEl) {
            _labelStyleEl = document.createElement('style');
            _labelStyleEl.id = 'rm-label-zoom-style';
            document.head.appendChild(_labelStyleEl);
        }
        var pad = size <= 0 ? '0' : (mobile ? '5px 12px' : '3px 8px');
        _labelStyleEl.textContent =
            '.rm-odjel-label { font-size:' + size + 'px !important; visibility:' + vis + '; padding:' + pad + ' !important; }';
    }

    function _clearLabels() {
        _labelMarkers.forEach(function(m) { _map.removeLayer(m); });
        _labelMarkers = [];
    }
    function _renderLabels() {
        _clearLabels();
        var groups = new Map();
        _allLayers.forEach(function(lyr) {
            var k = lyr._rmLabelKey;
            if (!groups.has(k)) groups.set(k, { lyrs: [], label: lyr._rmLabel });
            groups.get(k).lyrs.push(lyr);
        });
        groups.forEach(function(grp) {
            var bestLyr = null, bestArea = -1;
            grp.lyrs.forEach(function(lyr) {
                var b = lyr.getBounds();
                var area = (b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest());
                if (area > bestArea) { bestArea = area; bestLyr = lyr; }
            });
            var center = bestLyr.getBounds().getCenter();
            var tip = L.tooltip({ permanent: true, direction: 'center', className: 'karta-tooltip rm-odjel-label', interactive: false, opacity: 1 })
                .setContent(grp.label).setLatLng(center).addTo(_map);
            _labelMarkers.push(tip);
        });
    }
    window.mapaRadnikaToggleLabels = function() {
        var cb = document.getElementById('radnik-mapa-labels-toggle');
        if (cb && cb.checked) _renderLabels(); else _clearLabels();
    };

    function _renderLayer(geojson) {
        if (_layer) { _map.removeLayer(_layer); _layer = null; }
        if (_haloLayer) { _map.removeLayer(_haloLayer); _haloLayer = null; }
        _hideInfoPanel(); // spriječi da ostane vidljiv panel sa zastarjelim odjelom
        _clearLabels();
        _allLayers = [];

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
            // Ispuna razlikuje istaknute (zeleno), zadnja 3 odjela primača (crveno)
            // i ostale (blijedo/neutralno); rub je crn i tanji od žutog haloa ispod
            // njega (halo proviruje sa obje strane crne linije — "outline" efekat,
            // čitljivo na svakoj podlozi).
            style: function(feature) {
                var k = _featureKeys(feature);
                var o = _odjeliByKey.get(k.lk) || _odjeliByKey.get(k.nk);
                var radio = !!o;
                var recent = radio && _recentSet && _recentSet.has(o);
                if (recent) return { color: '#111827', weight: 2.5, fillColor: '#dc2626', fillOpacity: 0.5 };
                return radio
                    ? { color: '#111827', weight: 2.5, fillColor: '#10b981', fillOpacity: 0.45 }
                    : { color: '#111827', weight: 1.8, fillColor: '#cbd5e1', fillOpacity: 0.08 };
            },
            onEachFeature: function(feature, lyr) {
                var p = feature.properties || {};
                var k = _featureKeys(feature);
                var o = _odjeliByKey.get(k.lk) || _odjeliByKey.get(k.nk);
                var radio = !!o;
                var recent = radio && _recentSet && _recentSet.has(o);

                lyr._rmLabelKey = k.lk;
                lyr._rmLabel = String(p.odjel || p.name || '?');
                _allLayers.push(lyr);

                lyr.bindTooltip(String(p.odjel || p.name || '?'), {
                    permanent: false, direction: 'center', className: 'karta-tooltip'
                });
                lyr.on('mouseover', function() {
                    this.setStyle(recent ? { fillOpacity: 0.8, weight: 4 } : (radio ? { fillOpacity: 0.7, weight: 4 } : { fillOpacity: 0.2, weight: 2.8 }));
                });
                lyr.on('mouseout', function() {
                    this.setStyle(recent ? { fillOpacity: 0.5, weight: 2.5 } : (radio ? { fillOpacity: 0.45, weight: 2.5 } : { fillOpacity: 0.08, weight: 1.8 }));
                });
                if (radio) {
                    radnikLayers.push(lyr);
                    lyr.on('click', function(e) {
                        L.DomEvent.stopPropagation(e);
                        // Ako je u toku biranje tačke rute ("Vodi me do lokacije") ili
                        // crtanje poligona ("Označi poligon"), klik na odjel broji se
                        // kao klik na tu tačku (ne otvara info panel) — inače bi
                        // poligon "krao" klik od tih moda.
                        if (_handleRoutePickClick(e.latlng)) return;
                        if (_handlePoligonClick(e.latlng)) return;
                        // Fiksni info panel u gornjem dijelu mape (NE Leaflet popup
                        // vezan za tačku klika) — pozicija je uvijek ista i predvidiva
                        // bez obzira gdje se na odjelu klikne, cifre se nikad ne
                        // isijeku/sakriju iza ruba ekrana ili donje trake.
                        _showInfoPanel(o);
                    });
                }
            }
        }).addTo(_map);

        // Zoomiraj na radnikove odjele (ne na cijelu mapu svih odjela) — SAMO
        // pri prvom prikazu bez sačuvanog pogleda; nakon toga (ili ako je
        // pogled vraćen iz localStorage) se ne dira, da naknadni refresh
        // podataka ne "otme" korisnikov ručni pan/zoom.
        if (!_autoFitDone) {
            try {
                if (radnikLayers.length) {
                    var b = L.featureGroup(radnikLayers).getBounds();
                    if (b.isValid()) _map.fitBounds(b, { padding: [30, 30], maxZoom: 14 });
                }
            } catch (_) {}
            _autoFitDone = true;
        }

        // Ako je "Prikaži odjele" bio uključen prije osvježavanja podataka,
        // ponovo iscrtaj oznake nad svježim slojem (inače bi ostale ugašene).
        var labelsCb = document.getElementById('radnik-mapa-labels-toggle');
        if (labelsCb && labelsCb.checked) _renderLabels();

        return radnikLayers.length;
    }

    // ---- OSM / SATELIT ----
    // Isti izvor kao admin karta (js/karta-odjela.js toggleMapaSat) — ArcGIS
    // World_Imagery, kreiran lijeno (tek pri prvom prebacivanju na satelit).
    function _toggleSat() {
        if (!_map) return;
        _isSat = !_isSat;
        if (_isSat) {
            if (_osmLayer) _map.removeLayer(_osmLayer);
            if (!_satLayer) {
                _satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: '© Esri', maxZoom: 19
                });
            }
            _satLayer.addTo(_map);
        } else {
            if (_satLayer) _map.removeLayer(_satLayer);
            if (_osmLayer) _osmLayer.addTo(_map);
        }
        var btn = document.getElementById('radnik-mapa-sat-btn');
        if (btn) btn.textContent = _isSat ? '🗺️ OSM' : '🛰️ Satelit';
    }
    window.mapaRadnikaToggleSat = _toggleSat;

    // ---- "VODI ME DO LOKACIJE" — ruta preko OSRM (isti javni servis i
    // tehnika parsiranja kao admin karta, js/karta-odjela.js _drawRoute) ----
    // Podržava DVA načina, po korisnikovom zahtjevu:
    //  1) Klik na dvije tačke na mapi (A pa B) → ruta između njih.
    //  2) "📍 Moja lokacija" dugme na traci-savjetu za tačku A (trenutni GPS),
    //     pa klik na mapu za odredište (B).
    var OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
    var _routeLine = null;
    var _routePickState = null; // null | 'awaiting-a' | 'awaiting-b'
    var _routePointA = null;    // { lat, lng }
    var _routeAMarker = null;

    function _routeHintEl() { return document.getElementById('radnik-mapa-route-hint'); }
    function _showRouteHint(html) {
        var el = _routeHintEl();
        if (!el) return;
        el.innerHTML = html;
        el.classList.remove('hidden');
    }
    function _hideRouteHint() {
        var el = _routeHintEl();
        if (el) el.classList.add('hidden');
    }
    window.mapaRadnikaStartRoutePick = function() {
        _hideTragoviMenu();
        if (typeof window.mapaRadnikaCancelPoligon === 'function') window.mapaRadnikaCancelPoligon(); // samo jedan mod aktivan odjednom
        _routePickState = 'awaiting-a';
        _routePointA = null;
        if (_routeAMarker) { _map.removeLayer(_routeAMarker); _routeAMarker = null; }
        if (_routeLine) { _map.removeLayer(_routeLine); _routeLine = null; }
        _showRouteHint(
            '<span>📍 Kliknite POLAZNU tačku na mapi</span>' +
            '<span style="display:flex;gap:6px;">' +
            '<button type="button" onclick="mapaRadnikaUseMyLocationAsA()">Moja lokacija</button>' +
            '<button type="button" onclick="mapaRadnikaCancelRoutePick()">✕</button>' +
            '</span>'
        );
    };
    window.mapaRadnikaCancelRoutePick = function() {
        _routePickState = null;
        _routePointA = null;
        if (_routeAMarker) { _map.removeLayer(_routeAMarker); _routeAMarker = null; }
        _hideRouteHint();
    };
    window.mapaRadnikaUseMyLocationAsA = function() {
        if (!navigator.geolocation) { alert('Vaš uređaj ne podržava geolokaciju.'); return; }
        _showRouteHint('<span>📍 Tražim lokaciju...</span>');
        navigator.geolocation.getCurrentPosition(function(pos) {
            _setRoutePointA(pos.coords.latitude, pos.coords.longitude);
        }, function() {
            alert('Nije moguće dobiti trenutnu lokaciju.');
            window.mapaRadnikaCancelRoutePick();
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    };
    function _setRoutePointA(lat, lng) {
        _routePointA = { lat: lat, lng: lng };
        if (_routeAMarker) { _map.removeLayer(_routeAMarker); _routeAMarker = null; }
        _routeAMarker = L.circleMarker([lat, lng], { radius: 8, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }).addTo(_map);
        _routePickState = 'awaiting-b';
        _showRouteHint(
            '<span>🏁 Kliknite ODREDIŠNU tačku na mapi</span>' +
            '<span><button type="button" onclick="mapaRadnikaCancelRoutePick()">✕</button></span>'
        );
    }
    // Poziva se iz _map.on('click', ...) — vidi initMapaRadnika(). Vraća true
    // ako je klik "potrošen" za biranje rute (pozivalac onda ne radi ništa
    // drugo, npr. ne zatvara info panel).
    function _handleRoutePickClick(latlng) {
        if (_routePickState === 'awaiting-a') {
            _setRoutePointA(latlng.lat, latlng.lng);
            return true;
        }
        if (_routePickState === 'awaiting-b') {
            _routePickState = null;
            _drawOsrmRoute(_routePointA, { lat: latlng.lat, lng: latlng.lng });
            _hideRouteHint();
            if (_routeAMarker) { _map.removeLayer(_routeAMarker); _routeAMarker = null; }
            return true;
        }
        return false;
    }
    async function _drawOsrmRoute(a, b) {
        try {
            var url = OSRM_URL + '/' + a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=full&geometries=geojson';
            var resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!resp.ok) throw new Error('Server rute nedostupan (HTTP ' + resp.status + ')');
            var data = await resp.json();
            if (data.code !== 'Ok' || !data.routes.length) throw new Error('Nema rute između te dvije tačke');
            var route = data.routes[0];
            var coords = route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
            var distKm = (route.distance / 1000).toFixed(1);
            var durMin = Math.round(route.duration / 60);
            if (_routeLine) { _map.removeLayer(_routeLine); _routeLine = null; }
            _routeLine = L.polyline(coords, { color: '#f97316', weight: 4, opacity: 0.85, dashArray: '8 4' })
                .bindTooltip(distKm + ' km · ~' + durMin + ' min', { permanent: true, direction: 'center', className: 'karta-tooltip' })
                .addTo(_map);
            _map.fitBounds(_routeLine.getBounds(), { padding: [30, 30] });
        } catch (e) {
            alert('Greška pri učitavanju rute: ' + e.message);
        }
    }

    // ---- OZNAČI POLIGON — radnik klikom na mapu ocrtava dio (npr. unutar
    // odjela) koji treba odraditi, imenuje ga, i on ostaje sačuvan/vidljiv na
    // mapi (per-korisnik localStorage, isti obrazac kao sačuvani tragovi). ----
    var _poligonDrawing = false;
    var _poligonPoints = [];   // [[lat,lng], ...] — tačka u toku crtanja
    var _poligonDrawLayer = null;
    var _savedPoligonLayers = [];

    function _poligonStorageKey() {
        var uname = (window.currentUser && window.currentUser.username) || 'anon';
        return 'mapa_radnika_poligoni_' + uname;
    }
    function _loadSavedPoligoni() {
        try {
            var raw = localStorage.getItem(_poligonStorageKey());
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }
    function _savePoligoni(list) {
        try { localStorage.setItem(_poligonStorageKey(), JSON.stringify(list)); } catch (_) {}
    }
    function _drawSavedPoligoni() {
        _savedPoligonLayers.forEach(function(l) { _map.removeLayer(l); });
        _savedPoligonLayers = [];
        _loadSavedPoligoni().forEach(function(p) {
            if (!p.points || p.points.length < 3) return;
            var poly = L.polygon(p.points, { color: '#ea580c', weight: 2.5, fillColor: '#fb923c', fillOpacity: 0.3 }).addTo(_map);
            poly.bindTooltip('✏️ ' + (p.name || 'Površina'), { sticky: true });
            _savedPoligonLayers.push(poly);
        });
    }
    function _redrawPoligonDraw() {
        if (_poligonDrawLayer) { _map.removeLayer(_poligonDrawLayer); _poligonDrawLayer = null; }
        if (!_poligonPoints.length) return;
        if (_poligonPoints.length < 2) {
            _poligonDrawLayer = L.circleMarker(_poligonPoints[0], { radius: 6, color: '#ea580c', fillColor: '#fb923c', fillOpacity: 0.9 }).addTo(_map);
            return;
        }
        _poligonDrawLayer = L.polygon(_poligonPoints, { color: '#ea580c', weight: 3, fillColor: '#fb923c', fillOpacity: 0.25, dashArray: '6 4' }).addTo(_map);
    }
    function _updatePoligonHint() {
        var n = _poligonPoints.length;
        _showRouteHint(
            '<span>✏️ Označite tačke (' + n + (n >= 3 ? ', spremno)' : ', treba još)') + '</span>' +
            '<span style="display:flex;gap:6px;">' +
            (n > 0 ? '<button type="button" onclick="mapaRadnikaUndoPoligonPoint()">↩️</button>' : '') +
            (n >= 3 ? '<button type="button" onclick="mapaRadnikaFinishPoligon()">✅ Završi</button>' : '') +
            '<button type="button" onclick="mapaRadnikaCancelPoligon()">✕</button>' +
            '</span>'
        );
    }
    window.mapaRadnikaStartPoligon = function() {
        _hideTragoviMenu();
        window.mapaRadnikaCancelRoutePick(); // samo jedan mod (ruta/poligon) aktivan odjednom
        _poligonDrawing = true;
        _poligonPoints = [];
        _redrawPoligonDraw();
        _updatePoligonHint();
    };
    window.mapaRadnikaCancelPoligon = function() {
        _poligonDrawing = false;
        _poligonPoints = [];
        if (_poligonDrawLayer) { _map.removeLayer(_poligonDrawLayer); _poligonDrawLayer = null; }
        _hideRouteHint();
    };
    window.mapaRadnikaUndoPoligonPoint = function() {
        if (!_poligonDrawing || !_poligonPoints.length) return;
        _poligonPoints.pop();
        _redrawPoligonDraw();
        _updatePoligonHint();
    };
    window.mapaRadnikaFinishPoligon = function() {
        if (!_poligonDrawing || _poligonPoints.length < 3) return;
        var modal = document.getElementById('poligon-name-modal');
        var input = document.getElementById('poligon-name-input');
        if (!modal || !input) { _savePoligonNow('Površina ' + new Date().toLocaleString('bs-BA')); return; }
        input.value = 'Površina ' + new Date().toLocaleString('bs-BA');
        modal.classList.add('show');
        setTimeout(function() { input.focus(); input.select(); }, 50);
    };
    window.closePoligonNameModal = function() {
        var modal = document.getElementById('poligon-name-modal');
        if (modal) modal.classList.remove('show');
    };
    window.confirmSavePoligon = function() {
        var input = document.getElementById('poligon-name-input');
        var name = (input && input.value.trim()) || ('Površina ' + new Date().toLocaleString('bs-BA'));
        window.closePoligonNameModal();
        _savePoligonNow(name);
    };
    function _savePoligonNow(name) {
        var list = _loadSavedPoligoni();
        list.push({ name: name, created: new Date().toISOString(), points: _poligonPoints });
        _savePoligoni(list);
        _poligonDrawing = false;
        if (_poligonDrawLayer) { _map.removeLayer(_poligonDrawLayer); _poligonDrawLayer = null; }
        _poligonPoints = [];
        _hideRouteHint();
        _drawSavedPoligoni();
        _renderPoligoniList();
    }
    // Poziva se iz istog centralnog map-click lanca kao _handleRoutePickClick.
    function _handlePoligonClick(latlng) {
        if (!_poligonDrawing) return false;
        _poligonPoints.push([latlng.lat, latlng.lng]);
        _redrawPoligonDraw();
        _updatePoligonHint();
        return true;
    }
    function _renderPoligoniList() {
        var list = document.getElementById('radnik-mapa-poligoni-list');
        if (!list) return;
        var items = _loadSavedPoligoni();
        if (!items.length) {
            list.innerHTML = '<div class="rm-tragovi-empty">Nema označenih površina.</div>';
            return;
        }
        list.innerHTML = items.map(function(p, i) {
            var when = p.created ? new Date(p.created).toLocaleString('bs-BA') : '?';
            var name = (p.name || 'Površina').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return '<div class="rm-tragovi-row">' +
                '<span class="rm-tragovi-row-info">' + name + '<br><small>' + when + '</small></span>' +
                '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaDeletePoligon(' + i + ')" aria-label="Obriši površinu">🗑️</button>' +
                '</div>';
        }).join('');
    }
    window.mapaRadnikaDeletePoligon = function(index) {
        var list = _loadSavedPoligoni();
        var p = list[index];
        if (!p) return;
        _showTragConfirm('Obrisati površinu "' + (p.name || 'Površina') + '"?', function() {
            var fresh = _loadSavedPoligoni();
            fresh.splice(index, 1);
            _savePoligoni(fresh);
            _drawSavedPoligoni();
            _renderPoligoniList();
        });
    };

    // ---- MOJA LOKACIJA (GPS) ----
    // Ikonica lokacije — samo plava tačka, bez teksta "Vi ste ovdje" i bez
    // konusa smjera gledanja (isprobano pa ugašeno na korisnikov zahtjev).
    function _locIconHtml() {
        return '<div class="rm-loc-wrap"><div class="rm-loc-dot"></div></div>';
    }

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
                _locMarker = L.marker(ll, {
                    icon: L.divIcon({ className: 'rm-loc-icon', html: _locIconHtml(), iconSize: [40, 40], iconAnchor: [20, 20] }),
                    interactive: false
                }).addTo(_map);
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

    // ---- PAMTI ZADNJI POGLED (centar + zoom) — po korisniku, preživljava
    // zatvaranje/ponovno otvaranje aplikacije, ne samo tab. ----
    function _mapViewStorageKey() {
        var uname = (window.currentUser && window.currentUser.username) || 'anon';
        return 'mapa_radnika_view_' + uname;
    }
    function _loadMapView() {
        try {
            var raw = localStorage.getItem(_mapViewStorageKey());
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }
    function _saveMapView() {
        if (!_map) return;
        try {
            var c = _map.getCenter();
            localStorage.setItem(_mapViewStorageKey(), JSON.stringify({ lat: c.lat, lng: c.lng, zoom: _map.getZoom() }));
        } catch (_) {}
    }

    function _drawSavedTracks() {
        _savedTrackLayers.forEach(function(l) { _map.removeLayer(l); });
        _savedTrackLayers = [];
        _loadSavedTracks().forEach(function(t) {
            if (!t.points || t.points.length < 2) return;
            var pl = L.polyline(t.points, { color: '#7c3aed', weight: 3, opacity: 0.6, dashArray: '6 6' }).addTo(_map);
            pl.bindTooltip((t.name || 'Trag') + ' — ' + (t.start ? new Date(t.start).toLocaleString('bs-BA') : '?'), { sticky: true });
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

    // ---- Modal za ime traga — prikazuje se PRIJE početka snimanja (ne pri
    // kraju), datum/vrijeme je uvijek "sada" (readonly, ne unosi ga korisnik). ----
    var _pendingTragName = '';
    function _defaultTragName() {
        return 'Trag ' + new Date().toLocaleString('bs-BA');
    }
    function _showTragNameModal() {
        var modal = document.getElementById('trag-name-modal');
        var input = document.getElementById('trag-name-input');
        var datumEl = document.getElementById('trag-datum-prikaz');
        if (!modal || !input) { _startTrag(); return; } // fallback ako modal nije u DOM-u
        input.value = _defaultTragName();
        if (datumEl) datumEl.textContent = '📅 ' + new Date().toLocaleString('bs-BA');
        modal.classList.add('show');
        setTimeout(function() { input.focus(); input.select(); }, 50);
    }
    window.closeTragNameModal = function() {
        var modal = document.getElementById('trag-name-modal');
        if (modal) modal.classList.remove('show');
    };
    window.confirmStartTrag = function() {
        var input = document.getElementById('trag-name-input');
        _pendingTragName = (input && input.value.trim()) || _defaultTragName();
        window.closeTragNameModal();
        _startTrag();
    };

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
            // Bez ovoga dugme ostaje "Zaustavi snimanje" (optimistički postavljeno
            // ispod) čak i kad watchPosition stvarno nikad nije uspio (npr. dozvola
            // odbijena) — korisnik vidi "snima" a ništa se ne snima, bez objašnjenja
            // zašto. Vrati UI u prvobitno stanje i objasni razlog.
            if (_watchId != null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
            _recording = false;
            if (_tragBtnEl) {
                _tragBtnEl.textContent = '⏺️ Snimi trag';
                _tragBtnEl.classList.remove('recording');
            }
            var msg = err.code === 1
                ? 'Pristup lokaciji je odbijen. Dozvolite lokaciju u postavkama uređaja/browsera da bi snimanje traga radilo.'
                : (err.code === 3 ? 'Isteklo vrijeme čekanja na GPS signal. Pokušajte ponovo na otvorenom.' : 'Nije moguće pratiti lokaciju za snimanje traga.');
            alert(msg);
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
                name: _pendingTragName || 'Trag',
                start: _tragStartIso || new Date().toISOString(),
                end: new Date().toISOString(),
                points: _currentTrackPoints
            });
            _saveTracks(tracks);
        }
        _pendingTragName = '';
        if (_currentTrackPolyline) { _map.removeLayer(_currentTrackPolyline); _currentTrackPolyline = null; }
        _currentTrackPoints = [];
        _drawSavedTracks();
        _renderTragoviList();
    }

    function _toggleTrag() {
        if (_recording) _stopTrag();
        else _showTragNameModal();
    }

    // Custom potvrda brisanja (zamjena za native browser confirm(), koji na
    // nekim uređajima/prikazima izgleda kao dio adresne trake/linka umjesto
    // dijela aplikacije — "pro" izgled, isti modal-overlay obrazac kao
    // #trag-name-modal).
    var _tragConfirmCallback = null;
    function _showTragConfirm(message, onConfirm) {
        var modal = document.getElementById('trag-confirm-modal');
        var msgEl = document.getElementById('trag-confirm-message');
        if (!modal || !msgEl) { if (confirm(message)) onConfirm(); return; } // fallback ako modal nije u DOM-u
        msgEl.textContent = message;
        _tragConfirmCallback = onConfirm;
        modal.classList.add('show');
    }
    window.mapaRadnikaCancelTragConfirm = function() {
        var modal = document.getElementById('trag-confirm-modal');
        if (modal) modal.classList.remove('show');
        _tragConfirmCallback = null;
    };
    window.mapaRadnikaConfirmTragDelete = function() {
        var modal = document.getElementById('trag-confirm-modal');
        if (modal) modal.classList.remove('show');
        var cb = _tragConfirmCallback;
        _tragConfirmCallback = null;
        if (cb) cb();
    };

    function _clearTracks() {
        _showTragConfirm('Obrisati sve sačuvane tragove? Ova radnja se ne može poništiti.', function() {
            _saveTracks([]);
            _drawSavedTracks();
            _renderTragoviList();
        });
    }

    // ---- Lista sačuvanih tragova (unutar "Tragovi" popup-a) sa pojedinačnim
    // brisanjem — uvijek se ponovo iscrtava iz SVJEŽE učitanog niza (ne
    // oslanja se na stare indekse), tako da se izbjegne bilo kakvo
    // neslaganje sa localStorage stanjem. ----
    // Ukupna dužina traga (zbir Haversine distanci uzastopnih tačaka) i
    // trajanje (end - start), za prikaz u listi.
    function _tragDistanceKm(points) {
        if (!points || points.length < 2) return 0;
        var m = 0;
        for (var i = 1; i < points.length; i++) m += _distM(points[i - 1], points[i]);
        return m / 1000;
    }
    function _tragDurationStr(start, end) {
        if (!start || !end) return '';
        var ms = new Date(end).getTime() - new Date(start).getTime();
        if (!(ms > 0)) return '';
        var min = Math.round(ms / 60000);
        if (min < 60) return min + ' min';
        return Math.floor(min / 60) + 'h ' + (min % 60) + 'min';
    }
    function _renderTragoviList() {
        var list = document.getElementById('radnik-mapa-tragovi-list');
        if (!list) return;
        var tracks = _loadSavedTracks();
        if (!tracks.length) {
            list.innerHTML = '<div class="rm-tragovi-empty">Nema sačuvanih tragova.</div>';
            return;
        }
        list.innerHTML = tracks.map(function(t, i) {
            var when = t.start ? new Date(t.start).toLocaleString('bs-BA') : '?';
            var name = (t.name || 'Trag').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var km = _tragDistanceKm(t.points).toFixed(2).replace('.', ',');
            var dur = _tragDurationStr(t.start, t.end);
            var stats = km + ' km' + (dur ? ' · ' + dur : '');
            return '<div class="rm-tragovi-row">' +
                '<span class="rm-tragovi-row-info">' + name + '<br><small>' + when + ' · ' + stats + '</small></span>' +
                '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaDeleteTrag(' + i + ')" aria-label="Obriši trag">🗑️</button>' +
                '</div>';
        }).join('');
    }
    window.mapaRadnikaDeleteTrag = function(index) {
        var tracks = _loadSavedTracks();
        var t = tracks[index];
        if (!t) return;
        _showTragConfirm('Obrisati trag "' + (t.name || 'Trag') + '"?', function() {
            var fresh = _loadSavedTracks(); // svježe učitano — index ostaje ispravan jer se lista ne mijenja dok je modal otvoren
            fresh.splice(index, 1);
            _saveTracks(fresh);
            _drawSavedTracks();
            _renderTragoviList();
        });
    };

    // ---- Dugmad — obična HTML dugmad IZVAN Leaflet kontejnera (donja traka
    // u index.html, #radnik-mapa-content), NE Leaflet control. Ranije su ova
    // dugmad bila Leaflet L.Control POVRH mape — dodir na mapu (pan gesta) je
    // hvatao dodir i oko/na dugmadima, pa je do njih bilo teško doći. Obična
    // DOM dugmad van #radnik-mapa-map rješavaju to jer ih Leaflet ne "vidi".
    function _bindBarButtons() {
        _locBtnEl = document.getElementById('radnik-mapa-loc-btn');
        _tragBtnEl = document.getElementById('radnik-mapa-trag-btn');
    }

    // ---- "Tragovi" popup — otvara se preko srednjeg dugmeta u donjoj traci,
    // sadrži Snimi trag / Obriši tragove / Prikaži odjele (sve što je ranije
    // bilo razbacano po zaglavlju i traci, sad na jednom mjestu). Pozicija
    // (bottom) se računa dinamički iz stvarne visine donje trake — traka
    // nema fiksnu visinu (safe-area-inset, breakpoint override-i), pa
    // hardkodovan CSS offset ne bi bio pouzdan na svim uređajima.
    function _hideTragoviMenu() {
        var menu = document.getElementById('radnik-mapa-tragovi-menu');
        if (menu) menu.classList.add('hidden');
    }
    function _toggleTragoviMenu() {
        var menu = document.getElementById('radnik-mapa-tragovi-menu');
        var bar = document.getElementById('radnik-mapa-bottombar');
        if (!menu) return;
        var willShow = menu.classList.contains('hidden');
        if (willShow) {
            if (bar) menu.style.bottom = (bar.getBoundingClientRect().height + 8) + 'px';
            _renderTragoviList();
            _renderPoligoniList();
        }
        menu.classList.toggle('hidden', !willShow);
    }
    // Klik van popup-a (i van dugmeta koje ga otvara) ga zatvara.
    document.addEventListener('click', function(e) {
        var menu = document.getElementById('radnik-mapa-tragovi-menu');
        var btn = document.getElementById('radnik-mapa-tragovi-btn');
        if (!menu || menu.classList.contains('hidden')) return;
        if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
        _hideTragoviMenu();
    });
    window.mapaRadnikaToggleTragoviMenu = _toggleTragoviMenu;

    // ---- Puni ekran (AlpineQuest-stil) — vidi CSS "body.radnik-mapa-fullscreen"
    // u index.html. Donja traka je poseban element van #radnik-mapa-content
    // (izvan .container "contain:layout" konteksta koji bi inače slomio njeno
    // position:fixed), pa se vidljivost mora ručno sinhronizovati sa ulaskom/
    // izlaskom iz mape — nije više dio [id$="-content"] hide/show mehanizma.
    // "Desktop prikaz"/"Android prikaz" (toggleDesktopView/toggleAndroidView,
    // js/ui.js) OBA postavljaju <meta viewport content="width=1200,
    // initial-scale=0.5,...">. To je fizičko, browser-nivo skaliranje CIJELE
    // stranice na 50% — NIKAKAV CSS font-size/padding to ne može nadjačati
    // (upravo to je pravi razlog zašto su barovi "uvijek maleni" bez obzira
    // koliko puta se CSS uveća). Mapa odjela je terenski alat — mora se
    // prikazati u punoj, nativnoj rezoluciji ekrana bez obzira na taj globalni
    // toggle, pa ga ovdje eksplicitno privremeno poništavamo.
    function _enterMapaFullscreen() {
        document.body.classList.add('radnik-mapa-fullscreen');
        var bar = document.getElementById('radnik-mapa-bottombar');
        if (bar) bar.style.display = 'flex';
        var viewport = document.querySelector('meta[name=viewport]');
        if (viewport) viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
        setTimeout(function() { if (_map) _map.invalidateSize(); }, 50);
    }
    function _exitMapaFullscreen() {
        document.body.classList.remove('radnik-mapa-fullscreen');
        var bar = document.getElementById('radnik-mapa-bottombar');
        if (bar) bar.style.display = 'none';
        _hideTragoviMenu();
        if (typeof window.mapaRadnikaCancelRoutePick === 'function') window.mapaRadnikaCancelRoutePick();
        if (typeof window.mapaRadnikaCancelPoligon === 'function') window.mapaRadnikaCancelPoligon();
        // Vrati viewport na korisnikovu preferencu (Desktop/Android prikaz) ako
        // je bila uključena prije ulaska na mapu.
        var viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            var wantsWide = document.body.classList.contains('force-desktop-view') ||
                document.body.classList.contains('force-android-view');
            viewport.setAttribute('content', wantsWide
                ? 'width=1200, initial-scale=0.5, user-scalable=yes, viewport-fit=cover'
                : 'width=device-width, initial-scale=1.0, viewport-fit=cover');
        }
    }
    // Sigurnosna mreža — gornja/donja traka moraju biti UVIJEK prisutne dok
    // se gleda Mapa odjela. Rotacija ekrana/promjena veličine prozora ne
    // smije ih ostaviti sakrivenim (npr. ako je browser u međuvremenu
    // resetovao inline style) — ponovo primijeni klasu/display na svaki
    // resize dok je fullscreen mod aktivan.
    window.addEventListener('resize', function() {
        if (document.body.classList.contains('radnik-mapa-fullscreen')) _enterMapaFullscreen();
    });
    // Poziva se iz switchTab (js/ui.js) kad se prelazi na BILO KOJI drugi tab —
    // sigurnosna mreža za slučaj da korisnik ode s mape mimo "Zatvori" dugmeta.
    window.exitMapaRadnikaFullscreenIfActive = function(nextTab) {
        if (nextTab !== 'primac-mapa' && nextTab !== 'otpremac-mapa') _exitMapaFullscreen();
    };
    // Poziva se iz switchTab i kad se ponovo ulazi na Mapu odjela preko
    // "instant cache" grane (svjež keš → switchTab se vrati prije nego što
    // stigne do initMapaRadnika poziva) — bez ovoga donja traka ostaje
    // display:none od prethodnog izlaska jer se _enterMapaFullscreen() nikad
    // ne pozove ponovo.
    window.enterMapaRadnikaFullscreenIfActive = function(tab) {
        if (tab === 'primac-mapa' || tab === 'otpremac-mapa') _enterMapaFullscreen();
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
            // Zadnji pogled (centar+zoom) iz localStorage — ako postoji, mapa se
            // otvara TAMO gdje je radnik zadnji put gledao (umjesto uvijek na
            // Šumariju), i _renderLayer() neće raditi automatski fitBounds
            // preko njega (vidi _autoFitDone niže).
            var savedView = _loadMapView();
            _autoFitDone = !!savedView;
            // zoomControl:false + ručno dodat na 'bottomleft' — gornji dio mape
            // je rezervisan za fiksni info panel (#radnik-mapa-info-panel), pa
            // zoom dugmad ne smiju stajati na uobičajenom 'topleft' mjestu.
            _map = L.map('radnik-mapa-map', {
                center: savedView ? [savedView.lat, savedView.lng] : SUMARIJA_LATLNG,
                zoom: savedView ? savedView.zoom : 11,
                zoomControl: false
            });
            L.control.zoom({ position: 'bottomleft' }).addTo(_map);
            _map.on('moveend', _saveMapView);
            _osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 18
            }).addTo(_map);
            // Klik na praznu mapu (van poligona) zatvara info panel — OSIM ako je
            // klik "potrošen" za biranje tačke rute ("Vodi me do lokacije") ili
            // crtanje poligona ("Označi poligon").
            _map.on('click', function(e) {
                if (_handleRoutePickClick(e.latlng)) return;
                if (_handlePoligonClick(e.latlng)) return;
                _hideInfoPanel();
            });
            // Veličina "Prikaži odjele" oznaka prati zoom mape (manje odzumirano,
            // veće približeno) — vidi _updateLabelSizes.
            _map.on('zoomend', _updateLabelSizes);
            _updateLabelSizes();
            // Bez ovoga Leaflet hvata touch/scroll geste unutar panela kao
            // pan/zoom mape — skrolanje prstom kroz duži spisak sortimenata
            // (kad odjel ima puno njih) nikad ne bi stiglo do panela, pa bi
            // dio podataka ostao "nedostupan" ispod vidljivog dijela.
            var infoPanelEl = document.getElementById('radnik-mapa-info-panel');
            if (infoPanelEl) {
                L.DomEvent.disableClickPropagation(infoPanelEl);
                L.DomEvent.disableScrollPropagation(infoPanelEl);
            }
            _bindBarButtons();
            _drawSavedTracks();
            _drawSavedPoligoni();
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

            // Zadnja 3 odjela (API već vraća niz sortiran najnovije-prvo po
            // zadnjiDatum — vidi handlePrimacOdjeli u apps-script/api-handlers.gs)
            // — zabilježi reference PRIJE ubacivanja u _odjeliByKey Mapu, jer se
            // tamo poredak niza gubi. Samo za primača (po eksplicitnom zahtjevu).
            _recentSet = new Set();
            if (type === 'primac') {
                odjeli.slice(0, 3).forEach(function(o) { _recentSet.add(o); });
            }
            var legendExtra = document.getElementById('radnik-mapa-legend-extra');
            if (legendExtra) {
                legendExtra.innerHTML = (type === 'primac' && _recentSet.size)
                    ? ' · <strong style="color:#dc2626;">crveno</strong> = zadnja 3 odjela.'
                    : '';
            }

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
