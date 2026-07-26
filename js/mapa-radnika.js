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

    // ---- HARDKODIRANO: poslovođa → radilišta (SAMO za Karta tab) ----
    // Na Karta tabu se NE oslanjamo na POSLOVOĐA polje iz STANJE_ZALIHA sheeta
    // (zna biti prazno/nedosljedno upisano po odjelima) nego na ovu fiksnu mapu:
    // dohvata se cijelo stanje zaliha i filtrira po RADILIŠTE polju odjela.
    // Ključevi su normalizovani (velika slova, bez dijakritika, dijelovi imena
    // sortirani) da "Jasmin Porić" i "Porić Jasmin" oba matchuju.
    // Svako pravilo je { radiliste: '<NAZIV>' } — cijelo radilište — ili
    // { radiliste: '<NAZIV>', odjeli: ['21'] } kad poslovođa sa tog radilišta
    // vodi SAMO navedene odjele.
    var POSLOVODJA_RADILISTA_KARTA = {
        'JASMIN PORIC': [{ radiliste: 'RADICKE UVALE' }],
        'HADZIPASIC IRFAN': [{ radiliste: 'TURSKE VODE' }],
        'HARBAS MEHMEDALIJA': [
            { radiliste: 'BJELAJSKE UVALE' },
            { radiliste: 'VOJSKOVA', odjeli: ['21'] }
        ]
    };
    // Uppercase + bez dijakritika (Č/Ć→C, Š→S, Ž→Z, Đ→DJ) — isti pristup kao
    // _normKey, ali bez strip-anja odjel sufiksa (ovdje su imena/radilišta).
    function _plainUp(s) {
        return String(s || '').trim().toUpperCase()
            .replace(/Č/g, 'C').replace(/Ć/g, 'C')
            .replace(/Š/g, 'S').replace(/Ž/g, 'Z').replace(/Đ/g, 'DJ')
            .replace(/\s+/g, ' ').trim();
    }
    function _sortedName(s) { return _plainUp(s).split(' ').sort().join(' '); }
    // Vraća niz pravila za dato ime poslovođe ([] ako nije u mapi — tada se ne
    // filtrira po radilištu, vidi initMapaRadnika).
    function _radilistaZaPoslovodju(fullName) {
        var key = _sortedName(fullName);
        for (var k in POSLOVODJA_RADILISTA_KARTA) {
            if (_sortedName(k) === key) return POSLOVODJA_RADILISTA_KARTA[k];
        }
        return [];
    }
    // Broj odjela iz punog "GJ odjel" stringa ("Vojskova 21" → "21"); _normKey
    // dodatno skida P sufiks i /N pododsjek, pa "21", "21P" i "21/1" matchuju.
    function _brojOdjela(puniNaziv) {
        var parts = _plainUp(puniNaziv).split(' ');
        return _normKey(parts[parts.length - 1] || '');
    }
    // Da li odjel (jedan zapis iz stanje-zaliha) prolazi pravila poslovođe
    function _odjelProlaziPravila(o, pravila) {
        var r = _plainUp(o && o.radiliste);
        for (var i = 0; i < pravila.length; i++) {
            if (_plainUp(pravila[i].radiliste) !== r) continue;
            if (!pravila[i].odjeli) return true; // cijelo radilište
            var broj = _brojOdjela(o && o.odjel);
            for (var j = 0; j < pravila[i].odjeli.length; j++) {
                if (_normKey(pravila[i].odjeli[j]) === broj) return true;
            }
        }
        return false;
    }

    // currentUser je modul-scoped `let` u js/app.js IIFE-u i NIJE na window-u,
    // pa se ime poslovođe mora čitati iz localStorage ('sumarija_user', upisuje
    // ga prijava/auto-login) — window.currentUser je uvijek undefined.
    function _currentUserObj() {
        if (window.currentUser) return window.currentUser;
        try { return JSON.parse(localStorage.getItem('sumarija_user') || 'null') || {}; }
        catch (e) { return {}; }
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

    // Poruke korisniku kroz aplikacijski toast (js/utils.js showSuccess/showError/
    // showWarning/showInfo) umjesto native alert() — alert() UVIJEK prikazuje ime
    // domene/browsera ("stranica kaže..."/"github.io says"), što izgleda kao dio
    // browsera, ne aplikacije, i ne može se prilagoditi iz JS-a. Fallback na
    // alert() samo ako toast sistem baš nije učitan (npr. vrlo rani poziv prije
    // ostatka app.js-a).
    function _notify(type, title, msg) {
        if (typeof window[type] === 'function') window[type](title, msg);
        else alert(title + (msg ? ': ' + msg : ''));
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

    // Jedna sekcija (npr. "Sječa" ili "Otprema") — dva odvojena reda: prvi red
    // četinari, drugi red lišćari, po istoj klasifikaciji/bojama koje se već
    // koriste u Izvještaju po odjelima (zeleno četinari, plavo lišćari).
    function _sectionHtml(naslov, sort, ukupno) {
        sort = sort || {};
        var cChips = _chipsFor(sort, typeof KUBIKATOR_CETINARI !== 'undefined' ? KUBIKATOR_CETINARI : [], 'rm-chip-cetinar');
        var lChips = _chipsFor(sort, typeof KUBIKATOR_LISCARI !== 'undefined' ? KUBIKATOR_LISCARI : [], 'rm-chip-liscar');
        var rows =
            (cChips ? '<div class="rm-popup-row-label">🌲 Četinari</div><div class="rm-popup-grid">' + cChips + '</div>' : '') +
            (lChips ? '<div class="rm-popup-row-label">🍂 Lišćari</div><div class="rm-popup-grid">' + lChips + '</div>' : '') +
            (!cChips && !lChips ? '<span style="color:#9ca3af;font-size:12px;">Nema sortimenata</span>' : '');
        return '<div class="rm-popup-section">' +
            '<div class="rm-popup-section-title">' + naslov + '</div>' +
            rows +
            '<div class="rm-popup-total"><span>UKUPNO</span><span>' + _fmt(ukupno) + '</span></div>' +
            '</div>';
    }

    // Poslovođa vidi OBJE sekcije (sječa + otprema) — primač samo sječu, otpremač
    // samo otpremu (njihovi endpointi ionako vraćaju samo taj jedan skup).
    function _popupHtml(o) {
        var sekcije = o.sekcije || [{
            naslov: _workerType === 'otpremac' ? '🚚 Otprema' : '🪓 Sječa',
            sort: o.sortimenti,
            ukupno: o.ukupno
        }];
        return '<div class="rm-odjel-popup">' +
            '<div class="rm-popup-title">📁 Odjel ' + (o.odjel || '?') + '</div>' +
            '<div class="rm-popup-datum">Zadnji unos: ' + (o.zadnjiDatum || '—') + '</div>' +
            sekcije.map(function(s) { return _sectionHtml(s.naslov, s.sort, s.ukupno); }).join('') +
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
        // NAPOMENA: poslovođa vidi SVE odjele (kao primač/otpremač) — nema filter-a
        // koji bi sakrio poligone; njegovi odjeli (iz stanje-zaliha) su samo
        // OBOJENI drugačije (zeleno) u style funkciji ispod, isto kao kod primača.
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
                        // poligon "krao" klik od tih moda. ("Tačka" ne koristi klik na
                        // mapu — vidi nišan u centru ekrana, mapaRadnikaStartTacka.)
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

    // ---- OSM / SATELIT / TOPO ---- (v1.4.122: dodat treći sloj, ciklično dugme)
    // Satelit: isti izvor kao admin karta (js/karta-odjela.js toggleMapaSat) —
    // ArcGIS World_Imagery. Topo: OpenTopoMap (topografski/reljefni prikaz,
    // koristan na terenu za konture/šumske puteve) — planirano da se kasnije
    // zamijeni/dopuni Protomaps vektorskim slojem.
    var _baseMode = 'topo'; // 'osm' | 'sat' | 'topo' — default TOPO (izohipse/konture, v1.4.124)
    var _topoLayer = null;
    function _toggleSat() {
        if (!_map) return;
        if (_osmLayer) _map.removeLayer(_osmLayer);
        if (_satLayer) _map.removeLayer(_satLayer);
        if (_topoLayer) _map.removeLayer(_topoLayer);

        _baseMode = _baseMode === 'osm' ? 'sat' : (_baseMode === 'sat' ? 'topo' : 'osm');
        _isSat = _baseMode === 'sat'; // zadržano za _handleSat konzistentnost sa offline preuzimanjem niže

        if (_baseMode === 'sat') {
            if (!_satLayer) {
                _satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: '© Esri', maxZoom: 19
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
        var btn = document.getElementById('radnik-mapa-sat-btn');
        if (btn) btn.textContent = _baseMode === 'osm' ? '🛰️ Satelit' : (_baseMode === 'sat' ? '⛰️ Topo' : '🗺️ OSM');
        // Svaki sloj se skida odvojeno — kvačica "Izvanmrežni prikaz karte" mora
        // odmah pokazati stanje NOVOG sloja, ne prethodnog.
        if (typeof _refreshOfflineToggle === 'function') _refreshOfflineToggle();
    }
    window.mapaRadnikaToggleSat = _toggleSat;

    // ---- OFFLINE PREUZIMANJE — SAMO PLOČICE KOJE POKRIVAJU POLIGONE ----
    // Ranije se skidao jedan veliki KVADRAT oko svih odjela: na stvarnim
    // podacima (1151 poligon) to je 2300 pločica na z11-15, od čega ~60% pada
    // na rijeku, njive i susjedne općine gdje radnik nikad ne dolazi.
    // Sada se pločice biraju po SVAKOM odjelu posebno (okvir odjela + rezerva),
    // pa se skida samo ono što stvarno pokriva poligone — 936 pločica za isto
    // područje, uz identičnu pokrivenost terena.
    // Sekvencijalni fetch trenutno aktivnog sloja (OSM/Satelit/Topo); Service
    // Worker (v1.4.73+) ih automatski kešira (uklj. opaque OSM/Topo odgovore).
    // Planirano da se kasnije dopuni/zamijeni Protomaps vektorskim slojem.
    var OFFLINE_BUFFER_M = 200; // rezerva oko odjela — hvata prilazni put i granicu
    var OFFLINE_Z_MIN = 11, OFFLINE_Z_MAX = 15;

    // Skup {z/x/y} pločica koje dodiruju bilo koji od datih bounds-a (+rezerva).
    // Set uklanja duplikate tamo gdje se susjedni odjeli preklapaju na istoj
    // pločici — bez toga bi se ista pločica skidala i po deset puta.
    function _tilesForBoundsList(boundsList, zMin, zMax, bufferM) {
        var seen = {};
        var tiles = [];
        boundsList.forEach(function(b) {
            var latBuf = bufferM / 111320;
            var midLat = (b.getNorth() + b.getSouth()) / 2;
            var lngBuf = bufferM / (111320 * Math.cos(midLat * Math.PI / 180));
            var w = b.getWest() - lngBuf, e = b.getEast() + lngBuf;
            var s = b.getSouth() - latBuf, n = b.getNorth() + latBuf;
            for (var z = zMin; z <= zMax; z++) {
                var nw = _lonLatToTile(w, n, z);
                var se = _lonLatToTile(e, s, z);
                for (var x = nw.x; x <= se.x; x++) {
                    for (var y = nw.y; y <= se.y; y++) {
                        var k = z + '/' + x + '/' + y;
                        if (seen[k]) continue;
                        seen[k] = 1;
                        tiles.push({ z: z, x: x, y: y });
                    }
                }
            }
        });
        return tiles;
    }
    // Gruba procjena veličine — radnik na mobilnim podacima treba vidjeti
    // koliko MB skida PRIJE nego potvrdi.
    function _offlineSizeMb(brojPlocica, mode) {
        var kbPo = mode === 'sat' ? 25 : 15;
        return Math.round(brojPlocica * kbPo / 1024);
    }
    function _lonLatToTile(lon, lat, z) {
        var x = Math.floor((lon + 180) / 360 * Math.pow(2, z));
        var latRad = lat * Math.PI / 180;
        var y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z));
        return { x: x, y: y };
    }
    function _tileUrl(t) {
        var subdomains = ['a', 'b', 'c'];
        var s = subdomains[(t.x + t.y) % subdomains.length];
        if (_baseMode === 'sat') return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + t.z + '/' + t.y + '/' + t.x;
        if (_baseMode === 'topo') return 'https://' + s + '.tile.opentopomap.org/' + t.z + '/' + t.x + '/' + t.y + '.png';
        return 'https://' + s + '.tile.openstreetmap.org/' + t.z + '/' + t.x + '/' + t.y + '.png';
    }
    // Zabilješka o skinutoj karti — po sloju (OSM/Satelit/Topo se skidaju
    // odvojeno), da checkbox "Izvanmrežni prikaz karte" pokazuje STVARNO stanje
    // za sloj koji je trenutno prikazan, a ne jedno zajedničko "skinuto".
    function _offlineFlagKey(mode) { return 'mapa_radnika_offline_' + (mode || _baseMode); }
    function _offlineInfo(mode) {
        try { return JSON.parse(localStorage.getItem(_offlineFlagKey(mode)) || 'null'); }
        catch (e) { return null; }
    }
    function _setOfflineInfo(mode, info) {
        try {
            if (info) localStorage.setItem(_offlineFlagKey(mode), JSON.stringify(info));
            else localStorage.removeItem(_offlineFlagKey(mode));
        } catch (e) {}
    }
    function _slojNaziv(mode) {
        return mode === 'sat' ? 'Satelit' : (mode === 'topo' ? 'Topo' : 'OSM');
    }
    // Uskladi checkbox + status tekst sa zabilježenim stanjem za tekući sloj.
    // Poziva se pri otvaranju "Ostalo" popup-a i nakon promjene sloja/preuzimanja.
    // Status tekst je "toast" — vidljiv par sekundi pa nestane (fade), umjesto
    // da trajno stoji ispod checkboxa svaki put kad se popup otvori.
    var OFFLINE_STATUS_MS = 4000;
    var _offlineStatusTimer = null;
    function _refreshOfflineToggle() {
        var cb = document.getElementById('radnik-mapa-offline-toggle');
        var st = document.getElementById('radnik-mapa-offline-status');
        var info = _offlineInfo(_baseMode);
        if (cb) cb.checked = !!info;
        if (st) {
            st.textContent = info
                ? 'Skinuto ' + info.datum + ' · ' + info.plocica + ' pločica (' + _slojNaziv(_baseMode) + ')'
                : 'Nije skinuto za sloj ' + _slojNaziv(_baseMode) + ' — uključite da preuzmete.';
            st.classList.remove('rm-fade-out');
            if (_offlineStatusTimer) clearTimeout(_offlineStatusTimer);
            _offlineStatusTimer = setTimeout(function() { st.classList.add('rm-fade-out'); }, OFFLINE_STATUS_MS);
        }
    }
    window.mapaRadnikaRefreshOfflineToggle = _refreshOfflineToggle;

    // Checkbox umjesto ranijeg "⬇️ Offline" dugmeta: štiklirano = karta za
    // tekući sloj je skinuta. Sam checkbox NIKAD ne mijenja stanje direktno
    // (preventDefault) — stanje diktira ishod preuzimanja/brisanja, inače bi
    // kvačica lagala kad korisnik otkaže dijalog ili preuzimanje padne.
    window.mapaRadnikaToggleOffline = function(e) {
        if (e && e.preventDefault) e.preventDefault();
        var info = _offlineInfo(_baseMode);
        if (info) {
            // _showTragConfirm koristi textContent — poruka mora biti čist tekst
            _showTragConfirm(
                'Karta (' + _slojNaziv(_baseMode) + ') je skinuta ' + info.datum +
                '. Skinuti ponovo i osvježiti pločice?',
                function() { _downloadOfflineNow(); }
            );
            return;
        }
        _downloadOfflineNow();
    };

    function _downloadOfflineNow() {
        if (!_map || !_allLayers.length) { _notify('showWarning', 'Odjeli još nisu učitani'); return; }
        var mode = _baseMode;
        var boundsList = _allLayers.map(function(lyr) { return lyr.getBounds(); });
        var tiles = _tilesForBoundsList(boundsList, OFFLINE_Z_MIN, OFFLINE_Z_MAX, OFFLINE_BUFFER_M);
        if (!tiles.length) return;
        _showTragConfirm(
            'Preuzeti ' + tiles.length + ' pločica (~' + _offlineSizeMb(tiles.length, mode) + ' MB, ' +
            _slojNaziv(mode) + ', zoom ' + OFFLINE_Z_MIN + '-' + OFFLINE_Z_MAX + ')? ' +
            'Skida se samo područje oko odjela (' + _allLayers.length + ' poligona, +' + OFFLINE_BUFFER_M + ' m rezerve), ' +
            'ne cijeli kvadrat oko njih. Može potrajati i potrošiti mobilne podatke.',
            function() { _doOfflineDownload(tiles, mode); },
            { title: '⬇️ Izvanmrežni prikaz karte', confirmLabel: 'Preuzmi' }
        );
        // Ako korisnik otkaže, checkbox mora ostati u stanju PRIJE dodira (jer
        // je onclick već preventDefault-ovao promjenu) — _refreshOfflineToggle
        // se ovdje ne poziva na "otkaži" jer trag-confirm-modal nema poseban
        // cancel-callback (samo zatvara modal); stanje ostaje netaknuto, što je
        // ionako tačno stanje ekrana prije ovog poziva.
    }

    async function _doOfflineDownload(tiles, mode) {
        var cb = document.getElementById('radnik-mapa-offline-toggle');
        var st = document.getElementById('radnik-mapa-offline-status');
        if (cb) cb.disabled = true;
        if (st) st.classList.remove('rm-fade-out'); // vidljivo tokom cijelog preuzimanja, ne samo nakon refresha
        if (_offlineStatusTimer) clearTimeout(_offlineStatusTimer);
        var done = 0;
        for (var i = 0; i < tiles.length; i++) {
            try { await fetch(_tileUrl(tiles[i])); done++; } catch (_) {}
            if (st) st.textContent = 'Preuzimam... ' + done + '/' + tiles.length;
        }
        if (cb) cb.disabled = false;
        // Zabilježi samo ako je preuzeta bar velika većina — pola skinute karte
        // ne smije prikazivati kvačicu kao da je sve spremno za teren.
        if (done >= tiles.length * 0.9) {
            _setOfflineInfo(mode, { datum: new Date().toLocaleDateString('bs-BA'), plocica: done });
            _notify('showSuccess', 'Karta preuzeta', done + ' od ' + tiles.length + ' pločica (' + _slojNaziv(mode) + ')');
        } else {
            _setOfflineInfo(mode, null);
            _notify('showError', 'Preuzimanje nepotpuno', 'Preuzeto samo ' + done + ' od ' + tiles.length + ' pločica — pokušajte ponovo uz bolju vezu.');
        }
        _refreshOfflineToggle();
    }

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
        _hideOstaloMenu(); // pokreće se iz "Ostalo" popup-a
        if (typeof window.mapaRadnikaCancelPoligon === 'function') window.mapaRadnikaCancelPoligon(); // samo jedan mod aktivan odjednom
        if (typeof window.mapaRadnikaCancelTacka === 'function') window.mapaRadnikaCancelTacka();
        if (typeof window.mapaRadnikaStopExplorer === 'function') window.mapaRadnikaStopExplorer();
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
        if (!navigator.geolocation) { _notify('showError', 'Vaš uređaj ne podržava geolokaciju.'); return; }
        _showRouteHint('<span>📍 Tražim lokaciju...</span>');
        navigator.geolocation.getCurrentPosition(function(pos) {
            _setRoutePointA(pos.coords.latitude, pos.coords.longitude);
        }, function() {
            _notify('showError', 'Nije moguće dobiti trenutnu lokaciju.');
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
            _notify('showError', 'Greška pri učitavanju rute', e.message);
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
        _hideOstaloMenu(); // pokreće se iz "Ostalo" popup-a
        window.mapaRadnikaCancelRoutePick(); // samo jedan mod (ruta/poligon/tačka) aktivan odjednom
        if (typeof window.mapaRadnikaCancelTacka === 'function') window.mapaRadnikaCancelTacka();
        if (typeof window.mapaRadnikaStopExplorer === 'function') window.mapaRadnikaStopExplorer();
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

    // ---- TAČKA — radnik obilježi jednu tačku, imenuje je, i ona ostaje
    // sačuvana/vidljiva na mapi (per-korisnik localStorage, isti obrazac kao
    // tragovi/površine). Klik na tačku na mapi otvara popup sa "🧭 Vodi me do
    // tačke" ("explorer" način — strelica + udaljenost u metrima, vidi
    // _startExplorer niže) i brisanjem.
    //
    // NAPOMENA o dizajnu: NE koristi se klik-na-mapu biranje (kao "Vodi me do
    // lokacije"/"Označi površinu") — odjeli pokrivaju skoro cijelu vidljivu
    // površinu mape kao klikabilni poligoni sa SVOJIM click handlerom, pa bi
    // takav klik gotovo uvijek "upao" na neki odjel i otvorio njegov info
    // panel umjesto da obilježi tačku. Umjesto toga: fiksni ⊕ nišan trajno u
    // centru EKRANA (obična HTML ikona preko mape, ne Leaflet marker vezan za
    // koordinatu) — korisnik pomjeri/zumira MAPU dok željeno mjesto ne bude
    // ispod nišana, pa potvrdi. Stvarna koordinata je uvijek _map.getCenter().
    var _tackaPicking = false;
    var _pendingTackaLatLng = null;
    var _tackaMarkers = [];

    function _tackaStorageKey() {
        return 'mapa_radnika_tacke_' + (_currentUserObj().username || 'anon');
    }
    function _loadSavedTacke() {
        try {
            var raw = localStorage.getItem(_tackaStorageKey());
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }
    function _saveTacke(list) {
        try { localStorage.setItem(_tackaStorageKey(), JSON.stringify(list)); } catch (_) {}
    }
    function _tackaCrosshairEl() { return document.getElementById('radnik-mapa-tacka-crosshair'); }
    function _showTackaCrosshair() {
        var el = _tackaCrosshairEl();
        if (el) el.classList.remove('hidden');
    }
    function _hideTackaCrosshair() {
        var el = _tackaCrosshairEl();
        if (el) el.classList.add('hidden');
    }
    window.mapaRadnikaStartTacka = function() {
        _hideTragoviMenu();
        _hideOstaloMenu();
        if (typeof window.mapaRadnikaCancelRoutePick === 'function') window.mapaRadnikaCancelRoutePick();
        if (typeof window.mapaRadnikaCancelPoligon === 'function') window.mapaRadnikaCancelPoligon();
        if (typeof window.mapaRadnikaStopExplorer === 'function') window.mapaRadnikaStopExplorer();
        _tackaPicking = true;
        _showTackaCrosshair();
        _showRouteHint(
            '<span>🎯 Pomjerite mapu da tačka bude na željenom mjestu</span>' +
            '<span style="display:flex;gap:6px;">' +
            '<button type="button" onclick="mapaRadnikaCenterTackaOnMyLocation()">Moja lokacija</button>' +
            '<button type="button" onclick="mapaRadnikaConfirmTackaHere()">✅ Sačuvaj ovdje</button>' +
            '<button type="button" onclick="mapaRadnikaCancelTacka()">✕</button>' +
            '</span>'
        );
    };
    window.mapaRadnikaCancelTacka = function() {
        _tackaPicking = false;
        _hideTackaCrosshair();
        _hideRouteHint();
    };
    // Centrira mapu na trenutnu GPS lokaciju — nišan ostaje u centru ekrana
    // (crtan preko mape), korisnik može dalje fino pomjeriti mapu prije potvrde.
    window.mapaRadnikaCenterTackaOnMyLocation = function() {
        if (!navigator.geolocation) { _notify('showError', 'Vaš uređaj ne podržava geolokaciju.'); return; }
        navigator.geolocation.getCurrentPosition(function(pos) {
            if (_map) _map.setView([pos.coords.latitude, pos.coords.longitude], Math.max(_map.getZoom(), 15));
        }, function() {
            _notify('showError', 'Nije moguće dobiti trenutnu lokaciju.');
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    };
    window.mapaRadnikaConfirmTackaHere = function() {
        if (!_tackaPicking || !_map) return;
        var c = _map.getCenter();
        _finishTackaPick(c.lat, c.lng);
    };
    function _finishTackaPick(lat, lng) {
        _tackaPicking = false;
        _hideTackaCrosshair();
        _hideRouteHint();
        _pendingTackaLatLng = { lat: lat, lng: lng };
        var modal = document.getElementById('tacka-name-modal');
        var input = document.getElementById('tacka-name-input');
        if (!modal || !input) { _saveTackaNow('Tačka ' + new Date().toLocaleString('bs-BA')); return; }
        input.value = 'Tačka ' + new Date().toLocaleString('bs-BA');
        modal.classList.add('show');
        setTimeout(function() { input.focus(); input.select(); }, 50);
    }
    window.closeTackaNameModal = function() {
        var modal = document.getElementById('tacka-name-modal');
        if (modal) modal.classList.remove('show');
        _pendingTackaLatLng = null;
    };
    window.confirmSaveTacka = function() {
        var input = document.getElementById('tacka-name-input');
        var name = (input && input.value.trim()) || ('Tačka ' + new Date().toLocaleString('bs-BA'));
        var modal = document.getElementById('tacka-name-modal');
        if (modal) modal.classList.remove('show');
        _saveTackaNow(name);
    };
    function _saveTackaNow(name) {
        if (!_pendingTackaLatLng) return;
        var list = _loadSavedTacke();
        list.push({ name: name, created: new Date().toISOString(), lat: _pendingTackaLatLng.lat, lng: _pendingTackaLatLng.lng });
        _saveTacke(list);
        _pendingTackaLatLng = null;
        _drawSavedTacke();
        _renderTackeList();
    }
    // Radijus tačke srazmjeran zumu — isti obrazac kao _updateLabelSizes
    // (veće približeno, manje odzumirano), samo za L.circleMarker (setRadius),
    // ne CSS, jer je r atribut SVG kruga koji Leaflet crta.
    function _tackaRadiusForZoom() {
        var z = _map ? _map.getZoom() : 13;
        return z >= 16 ? 8 : z >= 15 ? 7 : z >= 14 ? 6 : z >= 13 ? 5 : z >= 12 ? 4 : 3;
    }
    function _updateTackaSizes() {
        var r = _tackaRadiusForZoom();
        _tackaMarkers.forEach(function(m) { m.setRadius(r); });
    }
    function _drawSavedTacke() {
        _tackaMarkers.forEach(function(m) { _map.removeLayer(m); });
        _tackaMarkers = [];
        var r = _tackaRadiusForZoom();
        _loadSavedTacke().forEach(function(t, i) {
            var safeName = String(t.name || 'Tačka').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var marker = L.circleMarker([t.lat, t.lng], { radius: r, color: '#6d28d9', weight: 2, fillColor: '#a78bfa', fillOpacity: 0.9 })
                .bindTooltip(safeName, { permanent: false, direction: 'top', className: 'karta-tooltip' })
                .bindPopup(
                    '<div class="rm-tacka-popup">' +
                    '<div class="rm-tacka-popup-title">📍 ' + safeName + '</div>' +
                    '<button type="button" class="rm-tacka-popup-route" onclick="mapaRadnikaRouteToTacka(' + i + ')">🧭 Vodi me do tačke</button>' +
                    '<button type="button" class="rm-tacka-popup-delete" onclick="mapaRadnikaDeleteTacka(' + i + ')">🗑️ Obriši</button>' +
                    '</div>'
                )
                .addTo(_map);
            _tackaMarkers.push(marker);
        });
    }
    // ---- "EXPLORER" — vodi me do tačke BEZ rute po putu (za razliku od
    // "Vodi me do lokacije", koja crta stvarnu rutu preko OSRM/cestovne mreže).
    // Kroz šumu/vanputa nema smisla ionako pratiti cestu — umjesto toga: velika
    // strelica koja pokazuje SMJER prema tački (vazdušnom linijom) + udaljenost
    // u metrima, oboje se uživo ažuriraju dok se korisnik kreće (watchPosition).
    // Strelica se rotira prema kompasu telefona (device orientation) ako je
    // dozvoljen pristup; bez njega pokazuje apsolutni azimut (sjever gore) uz
    // tekstualnu stranu svijeta (S/SI/I/...), i dalje upotrebljivo bez kompasa.
    var _explorerTarget = null;     // { lat, lng, name }
    var _explorerLastPos = null;    // { lat, lng } — zadnja GPS pozicija
    var _explorerHeading = null;    // stepeni 0-360 (0=sjever), null ako kompas nije aktivan
    var _explorerWatchId = null;
    var _explorerOrientationEventName = null; // ime event-a na koji je listener zakačen (za uklanjanje)

    function _bearingDeg(lat1, lng1, lat2, lng2) {
        var phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
        var dLambda = (lng2 - lng1) * Math.PI / 180;
        var y = Math.sin(dLambda) * Math.cos(phi2);
        var x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }
    function _cardinalFromDeg(deg) {
        var dirs = ['S', 'SI', 'I', 'JI', 'J', 'JZ', 'Z', 'SZ'];
        return dirs[Math.round(deg / 45) % 8];
    }
    function _fmtDistanceM(m) {
        return m < 1000 ? (Math.round(m) + ' m') : ((m / 1000).toFixed(2) + ' km');
    }
    function _updateExplorerHud() {
        if (!_explorerTarget) return;
        var arrowEl = document.getElementById('radnik-mapa-explorer-arrow');
        var distEl = document.getElementById('radnik-mapa-explorer-distance');
        var dirEl = document.getElementById('radnik-mapa-explorer-dir');
        if (!_explorerLastPos) return;
        var bearing = _bearingDeg(_explorerLastPos.lat, _explorerLastPos.lng, _explorerTarget.lat, _explorerTarget.lng);
        var dist = _distM([_explorerLastPos.lat, _explorerLastPos.lng], [_explorerTarget.lat, _explorerTarget.lng]);
        var rotate = _explorerHeading != null ? (bearing - _explorerHeading + 360) % 360 : bearing;
        if (arrowEl) arrowEl.style.transform = 'rotate(' + rotate + 'deg)';
        if (distEl) distEl.textContent = _fmtDistanceM(dist);
        if (dirEl) dirEl.textContent = _explorerHeading != null ? '' : ('(' + _cardinalFromDeg(bearing) + ' od sjevera)');
    }
    function _explorerOrientationHandler(e) {
        var heading = null;
        if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading; // iOS Safari — već tačan azimut
        else if (typeof e.alpha === 'number') heading = (360 - e.alpha) % 360; // Android — najbolja dostupna aproksimacija
        if (heading == null || isNaN(heading)) return;
        _explorerHeading = heading;
        var btn = document.getElementById('radnik-mapa-explorer-compass-btn');
        if (btn) btn.classList.add('hidden');
        _updateExplorerHud();
    }
    window.mapaRadnikaEnableExplorerCompass = function() {
        function attach() {
            _explorerOrientationEventName = ('ondeviceorientationabsolute' in window) ? 'deviceorientationabsolute' : 'deviceorientation';
            window.addEventListener(_explorerOrientationEventName, _explorerOrientationHandler);
        }
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(function(state) {
                if (state === 'granted') attach();
                else _notify('showWarning', 'Pristup kompasu je odbijen — strelica pokazuje azimut bez okretanja telefona.');
            }).catch(function() { _notify('showError', 'Nije moguće aktivirati kompas.'); });
        } else if (typeof DeviceOrientationEvent !== 'undefined') {
            attach();
        } else {
            _notify('showWarning', 'Vaš uređaj ne podržava kompas — strelica pokazuje azimut bez okretanja telefona.');
        }
    };
    function _stopExplorer() {
        if (_explorerWatchId != null) { navigator.geolocation.clearWatch(_explorerWatchId); _explorerWatchId = null; }
        if (_explorerOrientationEventName) { window.removeEventListener(_explorerOrientationEventName, _explorerOrientationHandler); _explorerOrientationEventName = null; }
        _explorerHeading = null;
        _explorerLastPos = null;
        _explorerTarget = null;
        var el = document.getElementById('radnik-mapa-explorer');
        if (el) el.classList.add('hidden');
        var btn = document.getElementById('radnik-mapa-explorer-compass-btn');
        if (btn) btn.classList.remove('hidden');
    }
    window.mapaRadnikaStopExplorer = _stopExplorer;
    function _startExplorer(t) {
        _stopExplorer(); // ne gomilaj watchPosition/listener ako je već aktivan za drugu tačku
        _explorerTarget = { lat: t.lat, lng: t.lng, name: t.name || 'Tačka' };
        var nameEl = document.getElementById('radnik-mapa-explorer-name');
        if (nameEl) nameEl.textContent = String(_explorerTarget.name); // textContent — bez ručnog HTML-escapinga
        var el = document.getElementById('radnik-mapa-explorer');
        if (el) el.classList.remove('hidden');
        _explorerWatchId = navigator.geolocation.watchPosition(function(pos) {
            _explorerLastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            _updateExplorerHud();
        }, function() {
            _notify('showError', 'Nije moguće pratiti lokaciju za navigaciju do tačke.');
        }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
        // Kompas se uključuje automatski (poziv je i dalje unutar istog klika
        // na "Vodi me do tačke", pa iOS-ov requestPermission() i dalje broji
        // kao gest korisnika). Dugme ostaje vidljivo kao ručni retry ako
        // korisnik prvi put odbije dozvolu ili automatsko uključivanje ne uspije.
        window.mapaRadnikaEnableExplorerCompass();
    }
    // Klik na "🧭 Vodi me do tačke" (popup na mapi ili spisak u Tragovi popup-u).
    window.mapaRadnikaRouteToTacka = function(index) {
        var t = _loadSavedTacke()[index];
        if (!t) return;
        if (_map) _map.closePopup();
        if (!navigator.geolocation) { _notify('showError', 'Vaš uređaj ne podržava geolokaciju.'); return; }
        _hideTragoviMenu();
        _startExplorer(t);
    };
    window.mapaRadnikaDeleteTacka = function(index) {
        var list = _loadSavedTacke();
        var t = list[index];
        if (!t) return;
        if (_map) _map.closePopup();
        _showTragConfirm('Obrisati tačku "' + (t.name || 'Tačka') + '"?', function() {
            var fresh = _loadSavedTacke();
            fresh.splice(index, 1);
            _saveTacke(fresh);
            _drawSavedTacke();
            _renderTackeList();
        });
    };
    function _renderTackeList() {
        var list = document.getElementById('radnik-mapa-tacke-list');
        if (!list) return;
        var items = _loadSavedTacke();
        if (!items.length) {
            list.innerHTML = '<div class="rm-tragovi-empty">Nema sačuvanih tačaka.</div>';
            return;
        }
        list.innerHTML = items.map(function(t, i) {
            var when = t.created ? new Date(t.created).toLocaleString('bs-BA') : '?';
            var name = (t.name || 'Tačka').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return '<div class="rm-tragovi-row">' +
                '<span class="rm-tragovi-row-info">📍 ' + name + '<br><small>' + when + '</small></span>' +
                '<span style="display:flex;gap:4px;">' +
                '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaRouteToTacka(' + i + ')" aria-label="Vodi me do tačke">🧭</button>' +
                '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaDeleteTacka(' + i + ')" aria-label="Obriši tačku">🗑️</button>' +
                '</span>' +
                '</div>';
        }).join('');
    }

    // ---- USLIKAJ FOTOGRAFIJU — foto se snimi na trenutnoj GPS lokaciji,
    // imenuje se (isti obrazac kao Tačka/Trag), i čuva se PO KORISNIKU u
    // IndexedDB (window.IDBHelper, idb-helper.js) — NE u localStorage, jer
    // fotografije (čak i komprimovane) lako pređu localStorage kvotu (5-10MB)
    // koju dijele svi ostali podaci aplikacije (isti razlog zbog kojeg su
    // primke/otprema ranije premještene u IndexedDB, vidi js/app.js).
    // Dijeljenje ide kroz Web Share API (native meni telefona — WhatsApp,
    // Viber, SMS, email...) — korisnik sam bira poslovođu kao kontakt; nema
    // upload-a na server niti novog backend endpointa.
    var _fotoMarkers = [];
    var _pendingFotoDataUrl = null;
    var _pendingFotoLatLng = null;

    function _fotoStorageKey() {
        return 'mapa_radnika_foto_' + (_currentUserObj().username || 'anon');
    }
    async function _loadSavedFoto() {
        if (!window.IDBHelper) return [];
        try { return (await window.IDBHelper.getMeta(_fotoStorageKey())) || []; }
        catch (e) { return []; }
    }
    async function _saveFoto(list) {
        if (!window.IDBHelper) { _notify('showError', 'Čuvanje fotografija nije dostupno na ovom uređaju.'); return; }
        try { await window.IDBHelper.setMeta(_fotoStorageKey(), list); }
        catch (e) { _notify('showError', 'Greška pri čuvanju fotografije', e.message); }
    }
    // Downscale + JPEG kompresija na canvas-u prije čuvanja — kamera fotografije
    // znaju biti 4000×3000+ (nekoliko MB), što bi brzo napunilo IndexedDB i
    // usporilo dijeljenje; 1600px najduža strana je i dalje sasvim čitljivo.
    function _compressImage(file, maxDim, quality) {
        return new Promise(function(resolve, reject) {
            var img = new Image();
            var url = URL.createObjectURL(file);
            img.onload = function() {
                URL.revokeObjectURL(url);
                var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                var cw = Math.round(img.width * scale), ch = Math.round(img.height * scale);
                var canvas = document.createElement('canvas');
                canvas.width = cw; canvas.height = ch;
                canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Neispravna slika.')); };
            img.src = url;
        });
    }
    window.mapaRadnikaTakePhoto = function() {
        _hideTragoviMenu();
        var input = document.getElementById('radnik-mapa-photo-input');
        if (input) input.click();
    };
    window.mapaRadnikaPhotoSelected = async function(e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = ''; // reset — isti fajl može ponovo okinuti change ako se opet odabere
        if (!file) return;
        try {
            var posPromise = new Promise(function(resolve) {
                if (!navigator.geolocation) { resolve(null); return; }
                navigator.geolocation.getCurrentPosition(
                    function(pos) { resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
                    function() { resolve(null); }, // GPS ne uspije — foto se ipak čuva, samo bez lokacije/markera
                    { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
                );
            });
            var results = await Promise.all([_compressImage(file, 1600, 0.72), posPromise]);
            _pendingFotoDataUrl = results[0];
            _pendingFotoLatLng = results[1];
        } catch (err) {
            _notify('showError', 'Greška pri obradi fotografije', err.message);
            return;
        }
        _showFotoNameModal();
    };
    function _showFotoNameModal() {
        var modal = document.getElementById('foto-name-modal');
        var input = document.getElementById('foto-name-input');
        var preview = document.getElementById('foto-name-preview');
        var gpsStatus = document.getElementById('foto-name-gps-status');
        if (!modal || !input) { _saveFotoNow('Foto ' + new Date().toLocaleString('bs-BA')); return; }
        input.value = 'Foto ' + new Date().toLocaleString('bs-BA');
        if (preview) preview.src = _pendingFotoDataUrl;
        if (gpsStatus) gpsStatus.textContent = _pendingFotoLatLng ? '📍 Lokacija zabilježena' : '⚠️ Lokacija nije dostupna — foto se čuva bez oznake na mapi';
        modal.classList.add('show');
        setTimeout(function() { input.focus(); input.select(); }, 50);
    }
    window.closeFotoNameModal = function() {
        var modal = document.getElementById('foto-name-modal');
        if (modal) modal.classList.remove('show');
        _pendingFotoDataUrl = null;
        _pendingFotoLatLng = null;
    };
    window.confirmSaveFoto = function() {
        var input = document.getElementById('foto-name-input');
        var name = (input && input.value.trim()) || ('Foto ' + new Date().toLocaleString('bs-BA'));
        var modal = document.getElementById('foto-name-modal');
        if (modal) modal.classList.remove('show');
        _saveFotoNow(name);
    };
    async function _saveFotoNow(name) {
        if (!_pendingFotoDataUrl) return;
        var list = await _loadSavedFoto();
        list.push({
            name: name,
            created: new Date().toISOString(),
            dataUrl: _pendingFotoDataUrl,
            lat: _pendingFotoLatLng ? _pendingFotoLatLng.lat : null,
            lng: _pendingFotoLatLng ? _pendingFotoLatLng.lng : null
        });
        await _saveFoto(list);
        _pendingFotoDataUrl = null;
        _pendingFotoLatLng = null;
        await _drawSavedFoto();
        await _renderFotoList();
    }
    async function _drawSavedFoto() {
        _fotoMarkers.forEach(function(m) { _map.removeLayer(m); });
        _fotoMarkers = [];
        var list = await _loadSavedFoto();
        list.forEach(function(f, i) {
            if (f.lat == null || f.lng == null) return; // nema lokacije — ostaje u spisku, bez markera na mapi
            var safeName = String(f.name || 'Foto').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var marker = L.marker([f.lat, f.lng], {
                icon: L.divIcon({ className: 'rm-foto-marker-icon', html: '📷', iconSize: [30, 30], iconAnchor: [15, 15] })
            }).bindPopup(
                '<div class="rm-foto-popup">' +
                '<div class="rm-foto-popup-title">📷 ' + safeName + '</div>' +
                '<img class="rm-foto-popup-img" src="' + f.dataUrl + '" />' +
                '<button type="button" class="rm-tacka-popup-route" onclick="mapaRadnikaShareFoto(' + i + ')">📤 Podijeli</button>' +
                '<button type="button" class="rm-tacka-popup-delete" onclick="mapaRadnikaDeleteFoto(' + i + ')">🗑️ Obriši</button>' +
                '</div>'
            ).addTo(_map);
            _fotoMarkers.push(marker);
        });
    }
    // Web Share API sa fajlom — otvara telefonov standardni meni za dijeljenje
    // (WhatsApp, Viber, SMS, email...), korisnik sam bira poslovođu kao kontakt.
    window.mapaRadnikaShareFoto = async function(index) {
        var list = await _loadSavedFoto();
        var f = list[index];
        if (!f) return;
        if (_map) _map.closePopup();
        try {
            var resp = await fetch(f.dataUrl);
            var blob = await resp.blob();
            var file = new File([blob], (f.name || 'foto').replace(/[^\w\-]+/g, '_') + '.jpg', { type: 'image/jpeg' });
            var text = (f.name || 'Fotografija') + (f.lat != null ? (' — ' + f.lat.toFixed(5) + ', ' + f.lng.toFixed(5)) : '');
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: f.name || 'Fotografija', text: text });
            } else if (navigator.share) {
                // Stariji browseri ne podržavaju dijeljenje fajlova — podijeli bar opis/koordinate.
                await navigator.share({ title: f.name || 'Fotografija', text: text });
            } else {
                _notify('showWarning', 'Dijeljenje nije podržano na ovom uređaju/browseru.');
            }
        } catch (err) {
            if (err && err.name === 'AbortError') return; // korisnik zatvorio share meni — nije greška
            _notify('showError', 'Greška pri dijeljenju fotografije', err.message);
        }
    };
    window.mapaRadnikaDeleteFoto = function(index) {
        _loadSavedFoto().then(function(list) {
            var f = list[index];
            if (!f) return;
            if (_map) _map.closePopup();
            _showTragConfirm('Obrisati fotografiju "' + (f.name || 'Foto') + '"?', async function() {
                var fresh = await _loadSavedFoto();
                fresh.splice(index, 1);
                await _saveFoto(fresh);
                await _drawSavedFoto();
                await _renderFotoList();
            });
        });
    };
    async function _renderFotoList() {
        var list = document.getElementById('radnik-mapa-foto-list');
        if (!list) return;
        var items = await _loadSavedFoto();
        if (!items.length) {
            list.innerHTML = '<div class="rm-tragovi-empty">Nema sačuvanih fotografija.</div>';
            return;
        }
        list.innerHTML = items.map(function(f, i) {
            var when = f.created ? new Date(f.created).toLocaleString('bs-BA') : '?';
            var name = (f.name || 'Foto').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return '<div class="rm-tragovi-row">' +
                '<span class="rm-tragovi-row-info">📷 ' + name + '<br><small>' + when + '</small></span>' +
                '<span style="display:flex;gap:4px;">' +
                '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaShareFoto(' + i + ')" aria-label="Podijeli fotografiju">📤</button>' +
                '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaDeleteFoto(' + i + ')" aria-label="Obriši fotografiju">🗑️</button>' +
                '</span>' +
                '</div>';
        }).join('');
    }

    // ---- MOJA LOKACIJA (GPS) ----
    // Ikonica lokacije — samo plava tačka, bez teksta "Vi ste ovdje" i bez
    // konusa smjera gledanja (isprobano pa ugašeno na korisnikov zahtjev).
    function _locIconHtml() {
        return '<div class="rm-loc-wrap"><div class="rm-loc-dot"></div></div>';
    }

    // Iscrtava/ažurira plavu tačku + krug preciznosti GPS signala (radijus =
    // pos.coords.accuracy u metrima, sa tooltip-om "±Xm" — bez ovoga krug je
    // bio nevidljivo "tih" podatak, korisnik nije mogao SAZNATI koliko je
    // signal precizan, samo naslutiti iz veličine kruga).
    function _updateLocDisplay(pos) {
        var ll = [pos.coords.latitude, pos.coords.longitude];
        var acc = pos.coords.accuracy || 30;
        if (_locMarker) { _map.removeLayer(_locMarker); _locMarker = null; }
        if (_locCircle) { _map.removeLayer(_locCircle); _locCircle = null; }
        _locCircle = L.circle(ll, {
            radius: acc,
            color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 1
        }).bindTooltip('±' + Math.round(acc) + ' m preciznost', { direction: 'top', className: 'karta-tooltip' }).addTo(_map);
        _locMarker = L.marker(ll, {
            icon: L.divIcon({ className: 'rm-loc-icon', html: _locIconHtml(), iconSize: [40, 40], iconAnchor: [20, 20] }),
            interactive: false
        }).addTo(_map);
        return ll;
    }

    // ---- "PRATI ME" (follow mode) — kontinuirano praćenje umjesto
    // jednokratnog centriranja. Tapni "Moja lokacija" da uključiš, tapni
    // ponovo (ili ručno pomjeri mapu) da isključiš — isto ponašanje kao
    // navigacione aplikacije (ručni pan prekida automatsko centriranje). ----
    var _followMode = false;
    var _followWatchId = null;
    function _stopFollowOnManualPan() {
        if (_followMode) _stopFollow();
    }
    function _startFollow() {
        _followMode = true;
        if (_locBtnEl) { _locBtnEl.textContent = '🎯 Prati me (uključeno)'; _locBtnEl.classList.add('following'); }
        _followWatchId = navigator.geolocation.watchPosition(function(pos) {
            var ll = _updateLocDisplay(pos);
            if (_map) _map.panTo(ll, { animate: true });
        }, function(err) {
            console.error('[MapaRadnika] praćenje lokacije — greška:', err);
        }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
        if (_map) _map.on('dragstart', _stopFollowOnManualPan);
    }
    function _stopFollow() {
        if (_followWatchId != null) { navigator.geolocation.clearWatch(_followWatchId); _followWatchId = null; }
        _followMode = false;
        if (_map) _map.off('dragstart', _stopFollowOnManualPan);
        if (_locBtnEl) { _locBtnEl.textContent = '📍 Moja lokacija'; _locBtnEl.classList.remove('following'); }
    }

    function _locateMe() {
        if (!navigator.geolocation) {
            _notify('showError', 'Vaš uređaj ne podržava geolokaciju.');
            return;
        }
        if (!_map) return;

        // Drugi tap dok je "Prati me" aktivno — isključi praćenje (toggle,
        // isti obrazac kao Snimi trag).
        if (_followMode) { _stopFollow(); return; }

        if (_locBtnEl) { _locBtnEl.disabled = true; _locBtnEl.textContent = '📍 Tražim...'; }

        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var ll = _updateLocDisplay(pos);
                _map.setView(ll, 15);
                if (_locBtnEl) _locBtnEl.disabled = false;
                _startFollow();
            },
            function(err) {
                if (_locBtnEl) { _locBtnEl.disabled = false; _locBtnEl.textContent = '📍 Moja lokacija'; }
                var msg = err.code === 1
                    ? 'Pristup lokaciji je odbijen. Dozvolite lokaciju u postavkama uređaja/browsera.'
                    : (err.code === 3 ? 'Isteklo vrijeme čekanja na GPS signal. Pokušajte ponovo na otvorenom.' : 'Nije moguće dobiti lokaciju.');
                _notify('showError', msg);
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
            _notify('showError', 'Vaš uređaj ne podržava geolokaciju.');
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
                _notify('showError', msg);
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

    // Opća custom potvrda (zamjena za native browser confirm(), koji uvijek
    // prikazuje ime domene/browsera umjesto aplikacije — "pro" izgled, isti
    // modal-overlay obrazac kao #trag-name-modal). Koristi se za SVE potvrde
    // u ovom modulu, ne samo brisanje tragova — otud opcioni naslov/labela.
    var _tragConfirmCallback = null;
    function _showTragConfirm(message, onConfirm, opts) {
        opts = opts || {};
        var modal = document.getElementById('trag-confirm-modal');
        var msgEl = document.getElementById('trag-confirm-message');
        var titleEl = document.getElementById('trag-confirm-title');
        var btnEl = document.getElementById('trag-confirm-btn');
        if (!modal || !msgEl) { if (confirm(message)) onConfirm(); return; } // fallback ako modal nije u DOM-u
        msgEl.textContent = message;
        if (titleEl) titleEl.textContent = opts.title || '🗑️ Potvrda brisanja';
        if (btnEl) {
            btnEl.textContent = opts.confirmLabel || 'Obriši';
            btnEl.className = opts.confirmLabel ? 'btn btn-primary' : 'btn btn-danger';
        }
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

    // ---- Popup meniji donje trake ----
    // "Tragovi" (srednje dugme): Snimi trag / Obriši tragove + spisak tragova.
    // "Ostalo" (desno dugme): Izvanmrežni prikaz karte / Prikaži odjele /
    // Vodi me do lokacije / Označi površinu + spisak površina.
    // Otvoren je uvijek najviše jedan. Pozicija
    // (bottom) se računa dinamički iz stvarne visine donje trake — traka
    // nema fiksnu visinu (safe-area-inset, breakpoint override-i), pa
    // hardkodovan CSS offset ne bi bio pouzdan na svim uređajima.
    function _hideTragoviMenu() {
        var menu = document.getElementById('radnik-mapa-tragovi-menu');
        if (menu) menu.classList.add('hidden');
    }
    function _hideOstaloMenu() {
        var menu = document.getElementById('radnik-mapa-ostalo-menu');
        if (menu) menu.classList.add('hidden');
    }
    function _toggleTragoviMenu() {
        var menu = document.getElementById('radnik-mapa-tragovi-menu');
        var bar = document.getElementById('radnik-mapa-bottombar');
        if (!menu) return;
        var willShow = menu.classList.contains('hidden');
        if (willShow) {
            _hideOstaloMenu(); // samo jedan popup otvoren odjednom
            if (bar) menu.style.bottom = (bar.getBoundingClientRect().height + 8) + 'px';
            _renderTragoviList();
            _renderTackeList();
            _renderFotoList();
        }
        menu.classList.toggle('hidden', !willShow);
    }
    function _toggleOstaloMenu() {
        var menu = document.getElementById('radnik-mapa-ostalo-menu');
        var bar = document.getElementById('radnik-mapa-bottombar');
        if (!menu) return;
        var willShow = menu.classList.contains('hidden');
        if (willShow) {
            _hideTragoviMenu();
            if (bar) menu.style.bottom = (bar.getBoundingClientRect().height + 8) + 'px';
            _renderPoligoniList();
            _refreshOfflineToggle();
        }
        menu.classList.toggle('hidden', !willShow);
    }
    // Klik van popup-a (i van dugmeta koje ga otvara) ga zatvara.
    document.addEventListener('click', function(e) {
        [['radnik-mapa-tragovi-menu', 'radnik-mapa-tragovi-btn', _hideTragoviMenu],
         ['radnik-mapa-ostalo-menu',  'radnik-mapa-ostalo-btn',  _hideOstaloMenu]].forEach(function(cfg) {
            var menu = document.getElementById(cfg[0]);
            var btn = document.getElementById(cfg[1]);
            if (!menu || menu.classList.contains('hidden')) return;
            if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
            cfg[2]();
        });
    });
    window.mapaRadnikaToggleTragoviMenu = _toggleTragoviMenu;
    window.mapaRadnikaToggleOstaloMenu = _toggleOstaloMenu;

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
        _hideOstaloMenu();
        if (typeof window.mapaRadnikaCancelRoutePick === 'function') window.mapaRadnikaCancelRoutePick();
        if (typeof window.mapaRadnikaCancelPoligon === 'function') window.mapaRadnikaCancelPoligon();
        if (typeof window.mapaRadnikaCancelTacka === 'function') window.mapaRadnikaCancelTacka();
        if (typeof window.mapaRadnikaStopExplorer === 'function') window.mapaRadnikaStopExplorer();
        _stopFollow(); // ne ostavljaj GPS watchPosition da radi u pozadini nakon izlaska s mape
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
        if (nextTab !== 'primac-mapa' && nextTab !== 'otpremac-mapa' && nextTab !== 'poslovodja-mapa') _exitMapaFullscreen();
    };
    // Poziva se iz switchTab i kad se ponovo ulazi na Mapu odjela preko
    // "instant cache" grane (svjež keš → switchTab se vrati prije nego što
    // stigne do initMapaRadnika poziva) — bez ovoga donja traka ostaje
    // display:none od prethodnog izlaska jer se _enterMapaFullscreen() nikad
    // ne pozove ponovo.
    window.enterMapaRadnikaFullscreenIfActive = function(tab) {
        if (tab === 'primac-mapa' || tab === 'otpremac-mapa' || tab === 'poslovodja-mapa') _enterMapaFullscreen();
    };

    window.mapaRadnikaLocateMe = _locateMe;
    window.mapaRadnikaToggleTrag = _toggleTrag;
    window.mapaRadnikaClearTracks = _clearTracks;
    window.closeMapaRadnika = function() {
        _exitMapaFullscreen();
        var home = _workerType === 'otpremac' ? 'otpremac-personal'
            : _workerType === 'poslovodja' ? 'poslovodja-sjeca'
            : 'primac-personal';
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
            });
            // Default sloj je TOPO (izohipse/konture) umjesto OSM — vidljivije na
            // terenu (reljef, šumski putevi). _osmLayer se kreira ali NE dodaje.
            _topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap (CC-BY-SA)', maxZoom: 17
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
            _map.on('zoomend', _updateTackaSizes);
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
            _drawSavedTacke();
            _drawSavedFoto();
        }
        // Leaflet mora preračunati veličinu nakon što tab postane vidljiv
        setTimeout(function() { if (_map) _map.invalidateSize(); }, 100);

        var status = document.getElementById('radnik-mapa-status');
        // poslovođa nema svoje primke/otpreme (ne radi lično) — koristi se isti
        // 'stanje-zaliha' endpoint koji već poslužuje "Stanje zaliha" tab, ali
        // BEZ 'poslovodja' parametra: na Karta tabu se filtrira client-side po
        // RADILIŠTE polju, prema hardkodiranoj mapi POSLOVODJA_RADILISTA_KARTA
        // (POSLOVOĐA polje u sheetu zna biti prazno/nedosljedno po odjelima).
        var isPoslovodja = (type === 'poslovodja');
        var endpoint = isPoslovodja ? 'stanje-zaliha' : (type === 'otpremac' ? 'otpremac-odjeli' : 'primac-odjeli');
        var tabId = isPoslovodja ? 'poslovodja-mapa' : (type === 'otpremac' ? 'otpremac-mapa' : 'primac-mapa');
        // Zaseban keš (viši limit) da mapa prikaže SVE radnikove odjele, ne samo top 15.
        // Poslovođin keš ima "_sve" sufiks — od v1.4.128 se kešira NEFILTRIRAN
        // odgovor (filtriranje po radilištu je client-side), pa stari keš pod
        // ranijim ključem ne smije biti poslužen kao da je isti sadržaj.
        var cacheKey = 'cache_' + type + '_odjeli_mapa' + (isPoslovodja ? '_sve' : '');

        if (status) status.textContent = navigator.onLine ? '⏳ Učitavam...' : '📦 Keširano...';

        try {
            var poslovodjaName = _currentUserObj().fullName || '';
            var mojaPravila = isPoslovodja ? _radilistaZaPoslovodju(poslovodjaName) : [];
            if (isPoslovodja) {
                console.log('[MapaRadnika] poslovođa:', poslovodjaName, '→ pravila:', JSON.stringify(mojaPravila));
            }
            var url = isPoslovodja
                ? buildApiUrl(endpoint)          // svi odjeli — filtriramo ispod po radilištu
                : buildApiUrl(endpoint, { limit: 300 });
            var data = await fetchWithCache(url, cacheKey);
            var odjeli = (data && data.odjeli) || [];

            // Hardkodirano filtriranje po radilištu/odjelu (ako je poslovođa u
            // mapi; ako nije — ne filtriraj, da mu karta ne ostane prazna).
            if (isPoslovodja && mojaPravila.length) {
                odjeli = odjeli.filter(function(o) { return _odjelProlaziPravila(o, mojaPravila); });
            }
            // Normalizuj 'stanje-zaliha' oblik ({odjel, sjeca:{...}, otprema:{...},
            // ukupnoSjeca, ukupnoOtprema, zadnjaOtprema, radiliste, ...}) na oblik
            // koji ostatak ove funkcije očekuje. Poslovođa dobija OBJE sekcije
            // (sječa + otprema) u popup-u — za razliku od primača (samo sječa) i
            // otpremača (samo otprema).
            //
            // Istaknuti (obojeni) su SAMO odjeli gdje stvarno IMA sječe ili otpreme
            // — stanje-zaliha vraća i odjele sa samo planiranim (projektnim)
            // količinama, a oni nisu "rađeni" pa se ne boje.
            if (isPoslovodja) {
                odjeli = odjeli
                    .filter(function(o) { return (o.ukupnoSjeca || 0) > 0 || (o.ukupnoOtprema || 0) > 0; })
                    .map(function(o) {
                        return {
                            odjel: o.odjel,
                            radiliste: o.radiliste || '',
                            sortimenti: o.sjeca || {},
                            ukupno: o.ukupnoSjeca || 0,
                            zadnjiDatum: o.zadnjaOtprema || '',
                            sekcije: [
                                { naslov: '🪓 Sječa',  sort: o.sjeca   || {}, ukupno: o.ukupnoSjeca   || 0 },
                                { naslov: '🚚 Otprema', sort: o.otprema || {}, ukupno: o.ukupnoOtprema || 0 }
                            ]
                        };
                    });
            }

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
                legendExtra.innerHTML =
                    (type === 'primac' && _recentSet.size) ? ' · <strong style="color:#dc2626;">crveno</strong> = zadnja 3 odjela.'
                    : isPoslovodja ? ' · <strong style="color:#047857;">zeleno</strong> = odjeli vaših radilišta sa sječom/otpremom.'
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
                var sufiks = isPoslovodja ? ' (vaša radilišta)' : '';
                status.textContent = odjeli.length
                    ? (odjeli.length + ' odjela' + sufiks + ' · ' + brojIstaknuto + ' istaknuto na mapi')
                    : 'Nema odjela za prikaz — svi ostali odjeli su ipak vidljivi na mapi';
            }
            if (typeof markTabRendered === 'function') markTabRendered(tabId);
        } catch (e) {
            console.error('[MapaRadnika] load fail:', e);
            if (status) status.textContent = 'Greška: ' + e.message;
        }
    };

    // ---- Modali sa unosom teksta (Tačka/Trag/Površina) i mobilna tastatura ----
    // Overlay je position:fixed preko cijelog layout viewport-a i centrira
    // svoj sadržaj (align-items:center) — kad se otvori mobilna tastatura,
    // VIZUELNI viewport se smanji, ali layout viewport (na kojem je overlay
    // fiksiran) ostaje pun ekran, pa centrirani modal završi napola ISPOD
    // tastature (dugmad u footeru postanu nedodirljiva/nevidljiva — upravo
    // ovaj bug je prijavljen za "Nova tačka"). VisualViewport API javlja
    // stvarnu vidljivu visinu; ograničimo overlay na nju dok je otvoren, pa
    // "centrirano" znači centrirano u ONOME što se stvarno vidi.
    var INPUT_MODAL_IDS = ['tacka-name-modal', 'trag-name-modal', 'poligon-name-modal', 'foto-name-modal'];
    function _resizeInputModalsForKeyboard() {
        if (!window.visualViewport) return;
        var h = window.visualViewport.height;
        INPUT_MODAL_IDS.forEach(function(id) {
            var el = document.getElementById(id);
            if (el && el.classList.contains('show')) { el.style.height = h + 'px'; }
        });
    }
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', _resizeInputModalsForKeyboard);
    }
    // Reset visine (na punu, default iz CSS-a) svaki put kad se neki od ovih
    // modala otvori — spriječi da ostane "zaglavljena" visina od PRETHODNOG
    // otvaranja tastature ako se sljedeći put modal otvori dok je tastatura
    // (iz nekog drugog razloga, npr. prebacivanja aplikacija) već drugačija.
    INPUT_MODAL_IDS.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        new MutationObserver(function() {
            if (el.classList.contains('show')) {
                el.style.height = '';
                _resizeInputModalsForKeyboard();
            }
        }).observe(el, { attributes: true, attributeFilter: ['class'] });
    });

    console.log('[MapaRadnika] modul učitan');
})();
