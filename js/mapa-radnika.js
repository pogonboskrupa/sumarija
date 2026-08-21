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
    // Podaci specifični za šumariju — js/config-sumarija.js (jedini fajl koji
    // se mijenja za drugu šumariju).
    var _CFG = window.SUMARIJA_CONFIG || {};
    // Lokacija kancelarije (default centar dok GPS ne stigne)
    var SUMARIJA_LATLNG = _CFG.LOKACIJA || [44.883425, 16.154427];

    // Filter tačaka trага — ne dodavaj novu tačku ako je bliže od MIN_DIST_M
    // metara ILI je prošlo manje od MIN_TIME_MS od zadnje tačke (GPS na terenu
    // zna "drhtati" u mjestu — bez ovoga bi se localStorage brzo napunio).
    var TRAG_MIN_DIST_M = 8;
    var TRAG_MIN_TIME_MS = 3000;

    // ---- Snimanje STVARNO OFARBANE sjekačke linije ----
    // Finiji filter nego kod običnog traga: sjekač ide sporo (staje da ofarba
    // stablo), a rezultat mora biti upotrebljiva GEOMETRIJA linije, ne samo
    // zapis "gdje sam bio". Uslov je namjerno OBRNUT u odnosu na trag gore:
    // tamo je (blizu I skoro) => preskoči, pa radnik koji stoji svejedno dobija
    // tačku svake 3 s (čisti GPS šum). Ovdje tačka ulazi tek nakon stvarnog
    // pomaka, uz "heartbeat" tačku svake minute kao dokaz da se stajalo.
    var SJEK_MIN_DIST_M   = 4;      // nova tačka tek nakon 4 m pomaka
    var SJEK_HEARTBEAT_MS = 60000;  // ...ali bar jedna tačka svake minute
    var SJEK_MAX_ACC_M    = 30;     // fix lošiji od ovoga se odbacuje (ne krivi liniju)
    var SJEK_SIMPLIFY_M   = 2;      // Douglas-Peucker prag prije slanja (ispod GPS šuma)
    var SJEK_MAX_JSON     = 45000;  // sigurnosna margina ispod Sheets limita ćelije (50.000)
    var SJEK_TTL_MS       = 5 * 60 * 1000; // keš tuđih linija — vidi _fetchSjekLinije
    // Boje po autoru — namjerno različite od crvene (plan linije) i
    // ljubičaste (sačuvani tragovi), da se na prvi pogled razlikuju.
    var SJEK_PALETTE = ['#0ea5e9', '#f59e0b', '#10b981', '#ec4899',
                        '#14b8a6', '#f97316', '#84cc16', '#06b6d4'];

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
    var POSLOVODJA_RADILISTA_KARTA = _CFG.POSLOVODJA_RADILISTA_KARTA || {};
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
    var _headingActive = false;      // uključen/isključen prikaz smjera gledanja (klik na "moja lokacija")
    var _headingListening = false;   // da li su device orientation listeneri trenutno zakačeni
    var _headingNoDataTimer = null;  // upozori korisnika ako ni jedan event ne isporuči upotrebljiv azimut
    var _headingCone = null;         // L.polygon — plavi prozirni konus (FOV) smjera gledanja
    var _headingLastLL = null;       // [lat,lng] zadnje poznate GPS lokacije (vrh/apeks konusa)
    var _headingLastDeg = null;      // zadnji poznati kompas azimut (stepeni, 0 = sjever)
    var _headingAbsoluteConfirmed = false; // true čim prvi put stigne azimut iz apsolutnog (sjever-referentnog) izvora
    var _odjeliByKey = null; // labelKey/normKey -> radnikov odjel objekat
    var _recentSet = null;   // Set referenci na zadnja 3 odjela (samo za primača) — vidi initMapaRadnika
    var _allLayers = [];     // SVI polygon layer-i (radio i ne-radio) — za "Prikaži odjele" grupisanje po odsjeku
    var _labelMarkers = [];  // trajne oznake brojeva odjela (checkbox "Prikaži odjele")
    var _autoFitDone = false; // spriječi da automatski fitBounds "otme" pogled nakon prvog prikaza/kad postoji sačuvan pogled

    // ---- Snimanje traga ----
    var _recording = false;
    var _currentTrackPoints = []; // [[lat,lng], ...]
    var _currentTrackPolyline = null;
    var _savedTrackLayers = [];   // L.polyline instance za već sačuvane tragove
    var _lastTragTs = 0;
    var _tragStartIso = null;
    var _tragPaused = false;
    var _tragActiveMs = 0;          // zbir SEGMENATA aktivnog snimanja (bez pauza)
    var _tragSegmentStartTs = 0;    // Date.now() kad je tekući (ne-pauzirani) segment počeo
    var _tragModalTimerId = null;   // setInterval koji osvježava sat/km u modalu dok snima

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

    // ---- ZAJEDNIČKI GPS — JEDAN watchPosition za SVE potrošače ----
    // Karta ima tri nezavisne funkcije koje trebaju kontinuiranu lokaciju:
    // "Prati me" (follow), "Vodi me do tačke" (explorer) i "Snimi trag".
    // Ranije je svaka otvarala SVOJ watchPosition sa enableHighAccuracy —
    // do tri paralelna GPS toka, što bespotrebno prazni bateriju (kritično
    // za cio radni dan na terenu).
    //
    // NAMJERNO se NE gase međusobno: snimanje traga je pozadinsko prikupljanje
    // podataka i ne smije se tiho prekinuti kad radnik usput tapne "Moja
    // lokacija" ili krene navigirati do tačke — to bi mu izgubilo snimljeni
    // posao. Umjesto toga svi dijele JEDAN GPS tok; hardver radi jednom, a
    // svaki potrošač dobija iste pozicije.
    var _gpsConsumers = {};   // id -> { onPos, onErr }
    var _gpsWatchId = null;
    var _gpsLastPos = null;
    var _gpsLastPosTs = 0;    // kad je zadnji fix stigao (Date.now())
    // Koliko dugo se PROLAZNA GPS greška guta prije nego se prijavi potrošačima.
    // Pod krošnjama je gubitak signala na po minutu sasvim normalan, a
    // watchPosition sam nastavlja pokušavati — vidi obrazloženje u onErr ispod.
    var GPS_GRACE_MS = 90000;
    var _gpsPrviProblemTs = 0;

    function _gpsSubscribe(id, onPos, onErr) {
        if (!navigator.geolocation) return false;
        _gpsConsumers[id] = { onPos: onPos, onErr: onErr };
        // Novi potrošač odmah dobija zadnju poznatu poziciju (ako je ima) —
        // bez ovoga bi npr. Explorer HUD stajao prazan do prvog novog fix-a.
        if (_gpsLastPos && onPos) { try { onPos(_gpsLastPos); } catch (e) {} }
        if (_gpsWatchId == null) {
            _gpsWatchId = navigator.geolocation.watchPosition(function(pos) {
                _gpsLastPos = pos;
                _gpsLastPosTs = Date.now();
                _gpsPrviProblemTs = 0;   // signal se vratio — poništi grace period
                Object.keys(_gpsConsumers).forEach(function(k) {
                    var c = _gpsConsumers[k];
                    if (c && c.onPos) { try { c.onPos(pos); } catch (e) { console.error('[MapaRadnika] GPS potrošač', k, e); } }
                });
            }, function(err) {
                // TIMEOUT (code 3) i POSITION_UNAVAILABLE (code 2) su pod
                // krošnjama NORMALNI i PROLAZNI — watchPosition ne prestaje
                // raditi, sam nastavlja pokušavati i signal se obično vrati za
                // koji trenutak. Ranije je svaka takva greška ODMAH išla svim
                // potrošačima, pa je jedan propušten fix rušio snimanje traga i
                // bacao poruku "Isteklo vrijeme čekanja na GPS signal"
                // (prijavljeno: "nekad javi isteklo vrijeme čekanja na GPS").
                // Zato se prosljeđuje tek ako signal ne dođe ni nakon
                // GPS_GRACE_MS. PERMISSION_DENIED (code 1) je jedina greška bez
                // oporavka — ona ide odmah.
                var fatalna = err && err.code === 1;
                if (!fatalna) {
                    if (!_gpsPrviProblemTs) _gpsPrviProblemTs = Date.now();
                    if (Date.now() - _gpsPrviProblemTs < GPS_GRACE_MS) {
                        console.warn('[MapaRadnika] GPS prolazna greška (code ' +
                            (err && err.code) + ') — čekam oporavak signala');
                        return;
                    }
                }
                Object.keys(_gpsConsumers).forEach(function(k) {
                    var c = _gpsConsumers[k];
                    if (c && c.onErr) { try { c.onErr(err); } catch (e) {} }
                });
            }, {
                // maximumAge 5s (bilo 2s) i timeout 45s (bilo 20s): pod gustom
                // krošnjom fix zna kasniti i preko 20s, a fix star 5 sekundi je
                // za sve ovdje (prikaz tačke, trag, navigacija) sasvim dovoljan.
                enableHighAccuracy: true, maximumAge: 5000, timeout: 45000
            });
        }
        return true;
    }
    function _gpsUnsubscribe(id) {
        delete _gpsConsumers[id];
        // Zadnji potrošač otišao — ugasi hardver (ne ostavljaj GPS da radi
        // u pozadini kad ništa na karti više ne treba lokaciju).
        if (!Object.keys(_gpsConsumers).length && _gpsWatchId != null) {
            navigator.geolocation.clearWatch(_gpsWatchId);
            _gpsWatchId = null;
        }
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
        // Korisnički zahtjev: oznake su bile prevelike — sve veličine (i
        // padding, da se cijela "pilula" smanji proporcionalno, ne samo
        // tekst) su prepolovljene u odnosu na prijašnje vrijednosti, uz
        // zadržano skaliranje po zoom nivou (veće približeno, manje odzumirano).
        var size =
            z >= 16 ? (mobile ? 13  : 7.5) :
            z >= 15 ? (mobile ? 11  : 6.5) :
            z >= 14 ? (mobile ? 9.5 : 5.5) :
            z >= 13 ? (mobile ? 7.5 : 4.5) :
            z >= 12 ? (mobile ? 6   : 3.5) :
            z >= 11 ? (mobile ? 4   : 2.5) : 0;
        var vis = size > 0 ? 'visible' : 'hidden';
        if (!_labelStyleEl) {
            _labelStyleEl = document.createElement('style');
            _labelStyleEl.id = 'rm-label-zoom-style';
            document.head.appendChild(_labelStyleEl);
        }
        var pad = size <= 0 ? '0' : (mobile ? '2.5px 6px' : '1.5px 4px');
        _labelStyleEl.textContent =
            '.rm-odjel-label { font-size:' + size + 'px !important; visibility:' + vis + '; padding:' + pad + ' !important; }';
    }

    function _clearLabels() {
        _labelMarkers.forEach(function(m) { _map.removeLayer(m); });
        _labelMarkers = [];
    }
    function _renderLabelGroup(lyrs) {
        var groups = new Map();
        lyrs.forEach(function(lyr) {
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
    // Oznake odjela u kojima je radnik radio (lyr._rmRadio) su UVIJEK vidljive
    // — isti princip kao admin karta (js/karta-odjela.js), koja po defaultu
    // labelira samo odjele sa planom/statusom, ne baš svaki poligon. Checkbox
    // "Prikaži sve odjele" dodaje i ostatak (odjele van radnikovih zaduženja),
    // za slučaj da mu zatreba orijentacija po širem području.
    function _renderLabels(showAll) {
        _clearLabels();
        _renderLabelGroup(_allLayers.filter(function(lyr) { return lyr._rmRadio; }));
        if (showAll) {
            _renderLabelGroup(_allLayers.filter(function(lyr) { return !lyr._rmRadio; }));
        }
    }
    window.mapaRadnikaToggleLabels = function() {
        var cb = document.getElementById('radnik-mapa-labels-toggle');
        _renderLabels(!!(cb && cb.checked));
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
                lyr._rmRadio = radio;
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
                if (radio) radnikLayers.push(lyr);
                // Klik se veže na SVAKI odjel (radio ili ne) — "Sjekačke linije"
                // biranje odjela (_handleSjeceOdjelClick) mora moći pogoditi bilo
                // koji odjel, ne samo istaknute. Za neistaknute, van sjece-picking
                // moda, ponašanje ostaje isto kao ranije (klik ne otvara ništa,
                // samo zatvori eventualni otvoren info panel — inače bi bez ovoga
                // taj klik bubble-ovao do _map.on('click',...) koji to radi).
                lyr.on('click', function(e) {
                    L.DomEvent.stopPropagation(e);
                    // Ako je u toku biranje tačke rute ("Vodi me do lokacije"),
                    // crtanje poligona ("Označi poligon") ili biranje odjela za
                    // sječačke linije, klik na odjel broji se kao klik za tu
                    // radnju (ne otvara info panel) — inače bi poligon "krao"
                    // klik od tih moda. ("Tačka" ne koristi klik na mapu — vidi
                    // nišan u centru ekrana, mapaRadnikaStartTacka.)
                    if (_handleRoutePickClick(e.latlng)) return;
                    if (_handlePoligonClick(e.latlng)) return;
                    if (_handleIzvrsenoClick(e.latlng)) return;
                    if (_handleSjeceOdjelClick(e.latlng, feature)) return;
                    if (_handleSjeceDirectionClick(e.latlng)) return;
                    if (_handleMjerenjeClick(e.latlng)) return;
                    if (radio) {
                        // Fiksni info panel u gornjem dijelu mape (NE Leaflet popup
                        // vezan za tačku klika) — pozicija je uvijek ista i predvidiva
                        // bez obzira gdje se na odjelu klikne, cifre se nikad ne
                        // isijeku/sakriju iza ruba ekrana ili donje trake.
                        _showInfoPanel(o);
                        return;
                    }
                    _hideInfoPanel(); // isto ponašanje kao ranije (bubbling do map click handlera)
                });
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
                } else {
                    // Nema sačuvanog pogleda niti odjela na kojima radnik radi (npr.
                    // novi korisnik, ili STANJE_ZALIHA za njega prazna) — umjesto da
                    // mapa ostane centrirana na Šumariji (praznina, ne govori ništa
                    // radniku), fokusiraj RISOVAC KRUPA 60 kao razuman podrazumijevani
                    // odjel (korisnički zahtjev).
                    var fallbackKey = _labelKey('RISOVAC KRUPA 60');
                    var fallbackLyr = _allLayers.filter(function(lyr) { return lyr._rmLabelKey === fallbackKey; })[0];
                    if (fallbackLyr) _map.fitBounds(fallbackLyr.getBounds(), { padding: [40, 40], maxZoom: 15 });
                }
            } catch (_) {}
            _autoFitDone = true;
        }

        // Oznake odjela u kojima radnik radi su uvijek prikazane (vidi
        // _renderLabels) — ponovo iscrtaj nad svježim slojem nakon svakog
        // osvježavanja podataka, i dodaj i ostale ako je "Prikaži sve odjele"
        // bio uključen prije osvježavanja (inače bi ta oznaka ostala ugašena).
        var labelsCb = document.getElementById('radnik-mapa-labels-toggle');
        _renderLabels(!!(labelsCb && labelsCb.checked));

        // Poligoni odjela su upravo dodati IZNAD korisnikovih slojeva (iste
        // Leaflet "pane") pa bi hvatali klik namijenjen površini/tragu ispod.
        _bringUserLayersToFront();

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
    var OFFLINE_Z_MIN = 11;
    // Max zoom po sloju — usklađeno sa stvarnim maxZoom vrijednostima L.tileLayer
    // definicija niže (OSM 18, Satelit/ArcGIS 19, Topo 17 — OpenTopoMap-ov stvarni
    // serverski maksimum). Ranije je bio jedan zajednički OFFLINE_Z_MAX=15 za sva
    // tri sloja — znatno ispod stvarne oštrine koju svaki sloj podržava.
    var OFFLINE_Z_MAX_BY_MODE = { osm: 18, sat: 19, topo: 17 };
    function _offlineZMax(mode) { return OFFLINE_Z_MAX_BY_MODE[mode] || 17; }

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
    // Preuzimanje karte zna trajati minutama — mora se moći prekinuti (dugme
    // "✕ Otkaži" u statusnoj liniji), a i samo mora stati kad korisnik napusti
    // Kartu, da stotine zahtjeva ne nastave curiti u pozadini.
    var _offlineAbort = false;
    var _offlinePreuzimanjeUToku = false;
    window.mapaRadnikaCancelOfflineDownload = function() {
        if (!_offlinePreuzimanjeUToku) return;
        _offlineAbort = true;
    };
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
        var zMax = _offlineZMax(mode);
        var boundsList = _allLayers.map(function(lyr) { return lyr.getBounds(); });
        var tiles = _tilesForBoundsList(boundsList, OFFLINE_Z_MIN, zMax, OFFLINE_BUFFER_M);
        // Ranije `return` bez ijedne riječi — korisnik tapne i ne desi se
        // baš ništa, bez naznake zašto.
        if (!tiles.length) {
            _notify('showWarning', 'Nema šta preuzeti', 'Za tekući prikaz nije izračunata nijedna pločica.');
            return;
        }
        _showTragConfirm(
            'Preuzeti ' + tiles.length + ' pločica (~' + _offlineSizeMb(tiles.length, mode) + ' MB, ' +
            _slojNaziv(mode) + ', zoom ' + OFFLINE_Z_MIN + '-' + zMax + ')? ' +
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
        // Bez mreže nema šta da se skine — bez ove provjere bi korisnik čekao
        // da prođe kroz stotine zahtjeva koji svi propadaju.
        if (!navigator.onLine) {
            _notify('showWarning', 'Nema internet konekcije', 'Kartu treba preuzeti dok ste na mreži, prije izlaska na teren.');
            _refreshOfflineToggle();
            return;
        }
        var cb = document.getElementById('radnik-mapa-offline-toggle');
        var st = document.getElementById('radnik-mapa-offline-status');
        if (cb) cb.disabled = true;
        if (st) st.classList.remove('rm-fade-out'); // vidljivo tokom cijelog preuzimanja, ne samo nakon refresha
        if (_offlineStatusTimer) clearTimeout(_offlineStatusTimer);

        _offlineAbort = false;
        _offlinePreuzimanjeUToku = true;
        var done = 0, zapoceto = 0, obradjeno = 0;

        function _prikaziNapredak() {
            if (!st) return;
            // innerHTML (ne textContent) zbog dugmeta za otkazivanje — sadržaj je
            // isključivo naš literal + brojevi, nema korisničkog unosa.
            st.innerHTML = 'Preuzimam... ' + obradjeno + '/' + tiles.length +
                ' <button type="button" onclick="mapaRadnikaCancelOfflineDownload()" ' +
                'style="margin-left:8px;padding:2px 8px;border:1px solid #b91c1c;border-radius:6px;' +
                'background:#fff;color:#b91c1c;font-size:11px;font-weight:700;cursor:pointer;">✕ Otkaži</button>';
        }
        _prikaziNapredak();

        // Preuzimanje u NEKOLIKO paralelnih tokova umjesto jedan-po-jedan.
        // Sekvencijalno je za ~1000 pločica značilo više minuta čekanja iako
        // je najveći dio tog vremena bio mrežni round-trip, ne propusni opseg.
        // Skromnih 5 tokova: dovoljno za veliko ubrzanje, a daleko ispod
        // granice pristojnosti prema besplatnim tile serverima (OSM/Topo).
        var PARALELNO = 5;
        async function _radnik() {
            while (true) {
                if (_offlineAbort) return;
                var i = zapoceto++;
                if (i >= tiles.length) return;
                // Broji SAMO stvarno dobavljene pločice. Service Worker na neuspjeh
                // vraća `new Response('', {status:503})` — a to je RIJEŠEN odgovor,
                // ne odbačen, pa bi golo `await fetch(); done++` brojalo i pločice
                // koje uopšte nisu skinute. Posljedica je bila najgora moguća: bez
                // mreže bi javilo "Karta preuzeta, 950/950" i uključilo kvačicu, a
                // radnik bi otišao na teren bez ijedne pločice.
                // `type === 'opaque'` je legitiman slučaj (cross-origin pločica
                // keširana iz <img> taga) — status joj je po spec-u uvijek 0.
                //
                // cache:'reload' — bez toga service worker vrati POSTOJEĆU keširanu
                // pločicu i "osvježi pločice" ne osvježi baš ništa (vidi tile granu
                // u service-worker.js).
                try {
                    var resp = await fetch(_tileUrl(tiles[i]), { cache: 'reload' });
                    if (resp && (resp.ok || resp.type === 'opaque')) done++;
                } catch (_) {}
                obradjeno++;
                if (obradjeno % 10 === 0 || obradjeno === tiles.length) _prikaziNapredak();
            }
        }
        var radnici = [];
        for (var w = 0; w < PARALELNO; w++) radnici.push(_radnik());
        await Promise.all(radnici);

        _offlinePreuzimanjeUToku = false;
        if (cb) cb.disabled = false;

        if (_offlineAbort) {
            // Otkazano na pola — zatečeno stanje NE smije nositi kvačicu
            // "spremno za teren"; ostaje zapisano ono što je bilo prije.
            _notify('showWarning', 'Preuzimanje otkazano', 'Preuzeto ' + done + ' od ' + tiles.length + ' pločica.');
            _refreshOfflineToggle();
            return;
        }
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

    // ---- MAPA KAO DIO "PRIPREMI ME ZA TEREN" ----
    // Dugme "Ažuriraj" (checkForNewData, js/app.js) je korisnikovo "pripremi me
    // za teren": povuče sve podatke u keš. Mapa je do sada bila JEDINA stvar van
    // njega — skidala se samo ručno (Karta → ⚙️ Ostalo) i to zasebno po sloju,
    // pa je radnik znao otići u šumu misleći da je spreman, a bez ijedne
    // pločice (ili sa skinutim pogrešnim slojem). Korisnički zahtjev: neka to
    // radi "Ažuriraj", automatski i bez pitanja.
    //
    // Mora raditi i kad Karta NIJE otvorena u ovoj sesiji — tada je _allLayers
    // prazan i _map ne postoji. Zato se granice računaju iz GeoJSON-a preko
    // L.geoJSON BEZ dodavanja na mapu (Leaflet to podržava; treba nam samo
    // getBounds() po odjelu).
    async function _granicePoOdjelu() {
        if (_allLayers.length) {
            return _allLayers.map(function(lyr) { return lyr.getBounds(); });
        }
        if (typeof L === 'undefined') return [];
        var gj = await _loadGeojson();
        if (!gj || !gj.features || !gj.features.length) return [];
        var granice = [];
        L.geoJSON(gj, {
            onEachFeature: function(f, lyr) {
                try {
                    var b = lyr.getBounds();
                    if (b && b.isValid()) granice.push(b);
                } catch (_) {}
            }
        });
        return granice;
    }

    // opts: { force, onProgress(preuzeto, ukupno) }
    // Vraća: 'vec-skinuto' | 'preuzeto' | 'nepotpuno' | 'offline' | 'nema-podataka' | 'zauzeto'
    window.mapaRadnikaPripremiOfflineKartu = async function(opts) {
        var o = opts || {};
        var mode = _baseMode;
        // Već skinuto za aktivni sloj → ne diraj. Korisnik je tražio "bez
        // pitanja", ali to ne smije značiti da svaki tap na "Ažuriraj" ponovo
        // povuče desetine MB mobilnih podataka. Osvježavanje već skinutih
        // pločica ostaje svjesna radnja (Karta → ⚙️ Ostalo).
        if (!o.force && _offlineInfo(mode)) return 'vec-skinuto';
        if (!navigator.onLine) return 'offline';
        if (_offlinePreuzimanjeUToku) return 'zauzeto';

        var granice = await _granicePoOdjelu();
        if (!granice.length) return 'nema-podataka';

        var tiles = _tilesForBoundsList(granice, OFFLINE_Z_MIN, _offlineZMax(mode), OFFLINE_BUFFER_M);
        if (!tiles.length) return 'nema-podataka';

        _offlineAbort = false;
        _offlinePreuzimanjeUToku = true;
        var done = 0, zapoceto = 0, obradjeno = 0;
        var PARALELNO = 5;   // isti obrazac kao _doOfflineDownload

        async function radnik() {
            while (true) {
                if (_offlineAbort) return;
                var i = zapoceto++;
                if (i >= tiles.length) return;
                try {
                    // cache:'reload' — vidi tile granu u service-worker.js
                    var resp = await fetch(_tileUrl(tiles[i]), { cache: 'reload' });
                    if (resp && (resp.ok || resp.type === 'opaque')) done++;
                } catch (_) {}
                obradjeno++;
                if (o.onProgress && (obradjeno % 10 === 0 || obradjeno === tiles.length)) {
                    try { o.onProgress(obradjeno, tiles.length); } catch (_) {}
                }
            }
        }
        var radnici = [];
        for (var w = 0; w < PARALELNO; w++) radnici.push(radnik());
        await Promise.all(radnici);
        _offlinePreuzimanjeUToku = false;

        if (_offlineAbort) return 'nepotpuno';
        // Isti prag kao ručno preuzimanje: pola skinute karte ne smije nositi
        // oznaku "spremno za teren".
        if (done >= tiles.length * 0.9) {
            _setOfflineInfo(mode, { datum: new Date().toLocaleDateString('bs-BA'), plocica: done });
            _refreshOfflineToggle();
            return 'preuzeto';
        }
        _setOfflineInfo(mode, null);
        _refreshOfflineToggle();
        return 'nepotpuno';
    };

    // Naziv aktivnog sloja — za poruku korisniku iz js/app.js.
    window.mapaRadnikaAktivniSlojNaziv = function() { return _slojNaziv(_baseMode); };

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
        if (typeof window.mapaRadnikaCloseSjecePanel === 'function') window.mapaRadnikaCloseSjecePanel();
        if (typeof window.mapaRadnikaCancelMjerenje === 'function') window.mapaRadnikaCancelMjerenje();
        if (typeof window.mapaRadnikaCancelIzvrsenoPoligon === 'function') window.mapaRadnikaCancelIzvrsenoPoligon();
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
    // Površina poligona u m² — lokalna ravna projekcija (oko prve tačke) +
    // "shoelace" formula. Na skali odjela/radne površine (stotine metara)
    // greška projekcije je zanemarljiva.
    function _polygonAreaM2(points) {
        if (!points || points.length < 3) return 0;
        var lat0 = points[0][0], lng0 = points[0][1];
        var pts = points.map(function(p) { return _toLocalXY(p[0], p[1], lat0, lng0); });
        var sum = 0;
        for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            sum += (pts[j].x * pts[i].y) - (pts[i].x * pts[j].y);
        }
        return Math.abs(sum / 2);
    }
    function _fmtPovrsina(m2) {
        if (m2 >= 10000) return (m2 / 10000).toFixed(2) + ' ha (' + Math.round(m2).toLocaleString('de-DE') + ' m²)';
        return Math.round(m2).toLocaleString('de-DE') + ' m²';
    }
    // Klik na SAČUVANU korisničku stavku (površina/mjerenje/tačka/foto) dok je
    // aktivan neki mod crtanja ili biranja: klik tada pripada TOM modu i sloj
    // ga ne smije "ukrasti" da otvori svoj popup. Leaflet bindPopup sam veže
    // otvaranje popup-a na 'click' (Layer._openPopup), pa se taj njegov
    // listener skida i zamjenjuje ovim koji klik prvo propusti kroz isti lanac
    // modova koji koriste i poligoni odjela (vidi lyr.on('click') u _renderLayer).
    // Bez ovoga se, npr. pri označavanju nove površine preko već sačuvane,
    // umjesto nove tačke otvarao popup te stare površine.
    function _bindStavkaPopupClick(lyr) {
        lyr.off('click');
        lyr.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            if (_handleRoutePickClick(e.latlng)) return;
            if (_handlePoligonClick(e.latlng)) return;
            if (_handleIzvrsenoClick(e.latlng)) return;
            if (_handleSjeceDirectionClick(e.latlng)) return;
            if (_handleMjerenjeClick(e.latlng)) return;
            if (_tackaPicking) return; // "Tačka" se bira nišanom — klik po mapi ništa ne radi
            lyr.openPopup(e.latlng);
        });
    }

    function _drawSavedPoligoni() {
        _savedPoligonLayers.forEach(function(l) { _map.removeLayer(l); });
        _savedPoligonLayers = [];
        _loadSavedPoligoni().forEach(function(p, i) {
            if (!p.points || p.points.length < 3) return;
            var safeName = String(p.name || 'Površina').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var when = p.created ? new Date(p.created).toLocaleString('bs-BA') : '';
            var povrsina = _polygonAreaM2(p.points);
            var poly = L.polygon(p.points, { color: '#ea580c', weight: 2.5, fillColor: '#fb923c', fillOpacity: 0.3 }).addTo(_map);
            poly.bindTooltip('✏️ ' + safeName, { sticky: true });
            // Klik na površinu otvara info + brisanje (isti obrazac kao tačke i
            // fotografije) — ranije se površina uopšte nije mogla kliknuti, pa
            // se brisala isključivo preko spiska u "Ostalo".
            poly.bindPopup(
                '<div class="rm-tacka-popup">' +
                '<div class="rm-tacka-popup-title">✏️ ' + safeName + '</div>' +
                '<div style="font-size:12px;color:#4b5563;margin-bottom:8px;">' +
                'Površina: <strong>' + _fmtPovrsina(povrsina) + '</strong>' +
                (when ? '<br>Označeno: ' + when : '') +
                '</div>' +
                '<button type="button" class="rm-tacka-popup-delete" onclick="mapaRadnikaDeletePoligon(' + i + ')">🗑️ Obriši</button>' +
                '</div>'
            );
            _bindStavkaPopupClick(poly);
            _savedPoligonLayers.push(poly);
        });
        _bringUserLayersToFront();
    }
    // Korisnikovi slojevi (površine, tragovi, sječačke linije, tačke, mjerenja)
    // dijele Leaflet "overlayPane" sa poligonima odjela — TAČKE SU L.circleMarker,
    // ne L.marker, pa su i one vektorski sloj u istom "overlayPane" (markerPane
    // koriste jedino fotografije, njih ovo ne treba). Poligoni odjela se crtaju
    // KASNIJE (kad stignu podaci, _renderLayer), pa završe IZNAD i onda oni
    // hvataju klik umjesto onoga ispod — zato se korisnikovi slojevi moraju
    // vratiti na vrh, uvijek nakon svakog ponovnog iscrtavanja poligona odjela.
    // NAPOMENA: _doznakaMarkers namjerno NIJE u nizu ispod — ti markeri su na
    // SVOM L.canvas() rendereru/pane-u (rmDoznakaPane, vidi _drawSavedDoznaka),
    // pa bringToFront() preko granice canvas/SVG ne bi ništa uradio (isti
    // razlog kao kod konusa smjera gledanja). Njihova vidljivost iznad odjel
    // poligona garantovana je pane z-indexom, ne redosljedom ovdje.
    function _bringUserLayersToFront() {
        [_savedPoligonLayers, _savedTrackLayers, _sjeceLayers, _mjerenjeLayers, _tackaMarkers].forEach(function(arr) {
            (arr || []).forEach(function(l) { if (l && l.bringToFront && _map && _map.hasLayer(l)) l.bringToFront(); });
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
        _hideTragoviMenu(); // pokreće se iz "Tragovi" popup-a
        window.mapaRadnikaCancelRoutePick(); // samo jedan mod (ruta/poligon/tačka) aktivan odjednom
        if (typeof window.mapaRadnikaCancelTacka === 'function') window.mapaRadnikaCancelTacka();
        if (typeof window.mapaRadnikaStopExplorer === 'function') window.mapaRadnikaStopExplorer();
        if (typeof window.mapaRadnikaCloseSjecePanel === 'function') window.mapaRadnikaCloseSjecePanel();
        if (typeof window.mapaRadnikaCancelMjerenje === 'function') window.mapaRadnikaCancelMjerenje();
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
    function _renderPoligoniList() { return _renderStavke(); }
    window.mapaRadnikaDeletePoligon = function(index) {
        var list = _loadSavedPoligoni();
        var p = list[index];
        if (!p) return;
        if (_map) _map.closePopup(); // poziv može doći iz popup-a na samoj površini
        _showTragConfirm('Obrisati površinu "' + (p.name || 'Površina') + '"?', function() {
            var fresh = _loadSavedPoligoni();
            fresh.splice(index, 1);
            _savePoligoni(fresh);
            _drawSavedPoligoni();
            _renderPoligoniList();
        });
    };

    // ---- OZNAČI IZVRŠENU PRIMKU (poligon) — radnik ocrtava poligon preko
    // dijela mape (isti obrazac klika kao "Označi površinu", _poligonPoints
    // gore), a sva NEIZVRŠENA doznačena stabla unutar tog poligona (iz SVIH
    // sačuvanih doznaka slojeva, bez obzira na trenutnu vidljivost) se
    // označe kao izvršena — nakon potvrde koliko će ih biti pogođeno.
    var _izvrsenoDrawing = false;
    var _izvrsenoPoints = [];
    var _izvrsenoDrawLayer = null;

    function _redrawIzvrsenoDraw() {
        if (_izvrsenoDrawLayer) { _map.removeLayer(_izvrsenoDrawLayer); _izvrsenoDrawLayer = null; }
        if (!_izvrsenoPoints.length) return;
        if (_izvrsenoPoints.length < 2) {
            _izvrsenoDrawLayer = L.circleMarker(_izvrsenoPoints[0], { radius: 6, color: '#047857', fillColor: '#10b981', fillOpacity: 0.9 }).addTo(_map);
            return;
        }
        _izvrsenoDrawLayer = L.polygon(_izvrsenoPoints, { color: '#047857', weight: 3, fillColor: '#10b981', fillOpacity: 0.25, dashArray: '6 4' }).addTo(_map);
    }
    function _updateIzvrsenoHint() {
        var n = _izvrsenoPoints.length;
        _showRouteHint(
            '<span>✅ Obuhvatite stabla (' + n + (n >= 3 ? ', spremno)' : ', treba još)') + '</span>' +
            '<span style="display:flex;gap:6px;">' +
            (n > 0 ? '<button type="button" onclick="mapaRadnikaUndoIzvrsenoPoint()">↩️</button>' : '') +
            (n >= 3 ? '<button type="button" onclick="mapaRadnikaFinishIzvrsenoPoligon()">✅ Označi</button>' : '') +
            '<button type="button" onclick="mapaRadnikaCancelIzvrsenoPoligon()">✕</button>' +
            '</span>'
        );
    }
    window.mapaRadnikaStartIzvrsenoPoligon = function() {
        _hideTragoviMenu();
        if (typeof window.mapaRadnikaCancelRoutePick === 'function') window.mapaRadnikaCancelRoutePick();
        if (typeof window.mapaRadnikaCancelPoligon === 'function') window.mapaRadnikaCancelPoligon();
        if (typeof window.mapaRadnikaCancelTacka === 'function') window.mapaRadnikaCancelTacka();
        if (typeof window.mapaRadnikaStopExplorer === 'function') window.mapaRadnikaStopExplorer();
        if (typeof window.mapaRadnikaCloseSjecePanel === 'function') window.mapaRadnikaCloseSjecePanel();
        if (typeof window.mapaRadnikaCloseMjerenjePanel === 'function') window.mapaRadnikaCloseMjerenjePanel();
        _izvrsenoDrawing = true;
        _izvrsenoPoints = [];
        _redrawIzvrsenoDraw();
        _updateIzvrsenoHint();
    };
    window.mapaRadnikaCancelIzvrsenoPoligon = function() {
        _izvrsenoDrawing = false;
        _izvrsenoPoints = [];
        if (_izvrsenoDrawLayer) { _map.removeLayer(_izvrsenoDrawLayer); _izvrsenoDrawLayer = null; }
        _hideRouteHint();
    };
    window.mapaRadnikaUndoIzvrsenoPoint = function() {
        if (!_izvrsenoDrawing || !_izvrsenoPoints.length) return;
        _izvrsenoPoints.pop();
        _redrawIzvrsenoDraw();
        _updateIzvrsenoHint();
    };
    // Ray-casting point-in-polygon — lat/lng se koriste direktno kao y/x, bez
    // projekcije (na skali odjela/radne površine greška je zanemarljiva, isti
    // pristup kao _polygonAreaM2 iznad).
    function _pointInPolygon(lat, lng, poly) {
        var inside = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            var yi = poly[i][0], xi = poly[i][1];
            var yj = poly[j][0], xj = poly[j][1];
            var intersect = ((yi > lat) !== (yj > lat)) &&
                (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
    function _findDoznakaMatchesInPolygon(poly) {
        var list = _loadSavedDoznaka();
        var matches = [];
        list.forEach(function(d, si) {
            (d.points || []).forEach(function(p, pi) {
                if (!p.done && _pointInPolygon(p.lat, p.lng, poly)) matches.push({ setIdx: si, pointIdx: pi });
            });
        });
        return matches;
    }
    function _applyIzvrsenoMatches(matches) {
        var list = _loadSavedDoznaka();
        matches.forEach(function(m) {
            if (list[m.setIdx] && list[m.setIdx].points && list[m.setIdx].points[m.pointIdx]) {
                list[m.setIdx].points[m.pointIdx].done = true;
            }
        });
        _saveDoznaka(list);
        _drawSavedDoznaka();
        _renderStavke();
    }
    window.mapaRadnikaFinishIzvrsenoPoligon = function() {
        if (!_izvrsenoDrawing || _izvrsenoPoints.length < 3) return;
        var matches = _findDoznakaMatchesInPolygon(_izvrsenoPoints);
        if (!matches.length) {
            _notify('showWarning', 'Nijedno neizvršeno stablo nije obuhvaćeno ovim poligonom.');
            return;
        }
        _showTragConfirm('Označiti ' + matches.length + ' stabala kao izvršenu primku?', function() {
            _applyIzvrsenoMatches(matches);
            window.mapaRadnikaCancelIzvrsenoPoligon();
            _notify('showSuccess', 'Izvršena primka', matches.length + ' stabala označeno.');
        });
    };
    // Poziva se iz istog centralnog map-click lanca kao _handlePoligonClick.
    function _handleIzvrsenoClick(latlng) {
        if (!_izvrsenoDrawing) return false;
        _izvrsenoPoints.push([latlng.lat, latlng.lng]);
        _redrawIzvrsenoDraw();
        _updateIzvrsenoHint();
        return true;
    }
    // Ručni switch pojedinačnog stabla — poziva se iz popup dugmeta (vidi
    // _drawSavedDoznaka). Nezavisno od poligon-obuhvata iznad; koristan za
    // pojedinačnu ispravku/poništavanje.
    window.mapaRadnikaToggleDoznakaTreeDone = function(setIdx, pointIdx) {
        var list = _loadSavedDoznaka();
        var d = list[setIdx];
        if (!d || !d.points || !d.points[pointIdx]) return;
        d.points[pointIdx].done = !d.points[pointIdx].done;
        _saveDoznaka(list);
        if (_map) _map.closePopup();
        _drawSavedDoznaka();
        _renderStavke();
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

    // ---- DOZNAČENA STABLA — učitavaju se iz KML fajla (dugme u "Tragovi"
    // meniju), čuvaju se po korisniku (isti localStorage obrazac kao tragovi/
    // tačke/površine). Svaki upload je JEDAN imenovani sloj (može ih biti
    // više, npr. po odjelu). Namjerno vidljivi SAMO na krupnoj razmjeri (vidi
    // _updateDoznakaVisibility niže) — pri stotinama stabala po odjelu bi na
    // sitnoj razmjeri markeri prekrili cijelu mapu.
    var _doznakaMarkers = [];      // flat niz L.circleMarker preko SVIH sačuvanih slojeva (bringToFront)
    var _doznakaLayerGroups = [];  // L.featureGroup po sačuvanom sloju — idx poravnat sa _loadSavedDoznaka()
    var _pendingDoznakaPoints = null;
    var _pendingDoznakaDefaultName = '';

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
        if (typeof window.mapaRadnikaCloseSjecePanel === 'function') window.mapaRadnikaCloseSjecePanel();
        if (typeof window.mapaRadnikaCancelMjerenje === 'function') window.mapaRadnikaCancelMjerenje();
        if (typeof window.mapaRadnikaCancelIzvrsenoPoligon === 'function') window.mapaRadnikaCancelIzvrsenoPoligon();
        _tackaPicking = true;
        _showTackaCrosshair();
        _showRouteHint(
            '<span>🔵 Pomjerite mapu da tačka bude na željenom mjestu</span>' +
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
            _bindStavkaPopupClick(marker);
            _tackaMarkers.push(marker);
        });
        _bringUserLayersToFront();
    }

    // ---- DOZNAČENA STABLA — storage (isti obrazac kao tačke/tragovi) ----
    function _doznakaStorageKey() {
        return 'mapa_radnika_doznaka_' + (_currentUserObj().username || 'anon');
    }
    function _loadSavedDoznaka() {
        try {
            var raw = localStorage.getItem(_doznakaStorageKey());
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }
    function _saveDoznaka(list) {
        try { localStorage.setItem(_doznakaStorageKey(), JSON.stringify(list)); } catch (_) {}
    }

    // Parsira KML (goli DOMParser, bez eksterne biblioteke) — vadi samo
    // Point Placemark-ove (doznačena stabla su pojedinačne tačke), ignoriše
    // eventualne LineString/Polygon geometrije u istom fajlu. Ne podržava KML
    // sa eksplicitnim namespace prefiksom (npr. <kml:Placemark>) — u praksi
    // gotovo svi izvozi (Google Earth, QGIS, terenski GPS alati) koriste
    // podrazumijevani namespace bez prefiksa, pa getElementsByTagName radi.
    function _parseKmlPoints(xmlText) {
        var doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        if (doc.getElementsByTagName('parsererror').length) return null;
        var placemarks = doc.getElementsByTagName('Placemark');
        var points = [];
        for (var i = 0; i < placemarks.length; i++) {
            var pm = placemarks[i];
            var pointEls = pm.getElementsByTagName('Point');
            if (!pointEls.length) continue;
            var coordEl = pointEls[0].getElementsByTagName('coordinates')[0];
            if (!coordEl) continue;
            var parts = coordEl.textContent.trim().split(',');
            var lng = parseFloat(parts[0]);
            var lat = parseFloat(parts[1]);
            if (isNaN(lat) || isNaN(lng)) continue;
            var nameEl = pm.getElementsByTagName('name')[0];
            points.push({ lat: lat, lng: lng, name: nameEl ? nameEl.textContent.trim() : '' });
        }
        return points;
    }

    // Dva izvora KML fajla: sa uređaja (postojeći file picker) ili sa
    // "servera" — statički fajlovi u repou (data/doznaka/), popisani u
    // data/doznaka/manifest.json. Nema pravog backend-a: dodavanje novog
    // fajla na "server" znači commit+push u taj folder (vidi manifest.json).
    window.mapaRadnikaStartDoznaka = function() {
        _hideTragoviMenu();
        var modal = document.getElementById('doznaka-source-modal');
        if (!modal) { _doznakaLocalPick(); return; } // fallback ako modal nije u DOM-u
        modal.classList.add('show');
    };
    window.closeDoznakaSourceModal = function() {
        var modal = document.getElementById('doznaka-source-modal');
        if (modal) modal.classList.remove('show');
    };
    function _doznakaLocalPick() {
        var input = document.getElementById('radnik-mapa-doznaka-input');
        if (input) input.click();
    }
    window.mapaRadnikaDoznakaLocalPick = function() {
        window.closeDoznakaSourceModal();
        _doznakaLocalPick();
    };
    var DOZNAKA_MANIFEST_URL = 'data/doznaka/manifest.json';
    var _doznakaServerManifest = [];
    window.mapaRadnikaDoznakaServerPick = function() {
        window.closeDoznakaSourceModal();
        var modal = document.getElementById('doznaka-server-modal');
        var list = document.getElementById('doznaka-server-list');
        if (!modal || !list) return;
        list.innerHTML = '<div class="rm-tragovi-empty">Učitavanje...</div>';
        modal.classList.add('show');
        fetch(DOZNAKA_MANIFEST_URL, { cache: 'no-store' })
            .then(function(r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
            .then(function(items) {
                _doznakaServerManifest = Array.isArray(items) ? items : [];
                if (!_doznakaServerManifest.length) {
                    list.innerHTML = '<div class="rm-tragovi-empty">Nema dostupnih fajlova na serveru.</div>';
                    return;
                }
                list.innerHTML = _doznakaServerManifest.map(function(it, i) {
                    return '<button type="button" class="rm-tragovi-item" onclick="mapaRadnikaDoznakaServerFetch(' + i + ')">' +
                        '<span>🌲</span><span>' + _esc(it.name || it.file) +
                        (it.added ? ' <small style="color:#9ca3af;">(' + _esc(it.added) + ')</small>' : '') +
                        '</span></button>';
                }).join('');
            })
            .catch(function() {
                list.innerHTML = '<div class="rm-tragovi-empty">Nije moguće učitati spisak — provjerite internet konekciju.</div>';
            });
    };
    window.closeDoznakaServerModal = function() {
        var modal = document.getElementById('doznaka-server-modal');
        if (modal) modal.classList.remove('show');
    };
    window.mapaRadnikaDoznakaServerFetch = function(index) {
        var item = _doznakaServerManifest[index];
        if (!item || !item.file) return;
        window.closeDoznakaServerModal();
        fetch('data/doznaka/' + item.file, { cache: 'no-store' })
            .then(function(r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
            .then(function(text) {
                var points;
                try { points = _parseKmlPoints(text); } catch (err) { points = null; }
                if (!points) { _notify('showError', 'Greška', 'Fajl na serveru nije ispravan KML.'); return; }
                if (!points.length) { _notify('showWarning', 'KML ne sadrži nijednu tačku (stablo).'); return; }
                _pendingDoznakaPoints = points;
                _pendingDoznakaDefaultName = item.name || item.file.replace(/\.kml$/i, '') || 'Doznaka';
                _showDoznakaNameModal(points.length);
            })
            .catch(function() {
                _notify('showError', 'Greška', 'Nije moguće preuzeti fajl sa servera.');
            });
    };
    window.mapaRadnikaDoznakaFileSelected = function(e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = ''; // reset — isti fajl može ponovo okinuti change ako se opet odabere
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function() {
            var points;
            try { points = _parseKmlPoints(String(reader.result)); }
            catch (err) { points = null; }
            if (!points) { _notify('showError', 'Greška pri čitanju KML fajla', 'Fajl nije ispravan KML.'); return; }
            if (!points.length) { _notify('showWarning', 'KML ne sadrži nijednu tačku (stablo).'); return; }
            _pendingDoznakaPoints = points;
            _pendingDoznakaDefaultName = file.name.replace(/\.kml$/i, '') || 'Doznaka';
            _showDoznakaNameModal(points.length);
        };
        reader.onerror = function() { _notify('showError', 'Greška pri čitanju fajla.'); };
        reader.readAsText(file);
    };
    function _showDoznakaNameModal(count) {
        var modal = document.getElementById('doznaka-name-modal');
        var input = document.getElementById('doznaka-name-input');
        var info = document.getElementById('doznaka-name-info');
        if (!modal || !input) { _saveDoznakaNow(_pendingDoznakaDefaultName); return; }
        input.value = _pendingDoznakaDefaultName;
        if (info) info.textContent = '🌲 ' + count + ' stabala učitano · vidljivo na mapi ispod razmjere 1:' + DOZNAKA_MAX_SCALE;
        modal.classList.add('show');
        setTimeout(function() { input.focus(); input.select(); }, 50);
    }
    window.closeDoznakaNameModal = function() {
        var modal = document.getElementById('doznaka-name-modal');
        if (modal) modal.classList.remove('show');
        _pendingDoznakaPoints = null;
    };
    window.confirmSaveDoznaka = function() {
        var input = document.getElementById('doznaka-name-input');
        var name = (input && input.value.trim()) || _pendingDoznakaDefaultName || 'Doznaka';
        var modal = document.getElementById('doznaka-name-modal');
        if (modal) modal.classList.remove('show');
        _saveDoznakaNow(name);
    };
    function _saveDoznakaNow(name) {
        if (!_pendingDoznakaPoints || !_pendingDoznakaPoints.length) return;
        var list = _loadSavedDoznaka();
        list.push({ name: name, created: new Date().toISOString(), points: _pendingDoznakaPoints });
        _saveDoznaka(list);
        var count = _pendingDoznakaPoints.length;
        _pendingDoznakaPoints = null;
        _drawSavedDoznaka();
        _renderStavke();
        var visible = _currentMapScale() <= DOZNAKA_MAX_SCALE;
        _notify('showSuccess', 'Doznačena stabla sačuvana',
            count + ' stabala' + (visible ? '' : ' — približite mapu ispod razmjere 1:' + DOZNAKA_MAX_SCALE + ' da ih vidite'));
    }
    // Ručni switch vidljivo/sakrij po sloju — NEZAVISAN od automatske
    // razmjere (_updateDoznakaVisibility), primjenjuje se KAO DODATNI uslov:
    // sloj je vidljiv samo ako je razmjera dovoljno krupna I nije ručno
    // sakriven. Sakrivanje traje dok se ponovo ne uključi (nije privremeno).
    window.mapaRadnikaToggleDoznakaVisible = function(index) {
        var list = _loadSavedDoznaka();
        var d = list[index];
        if (!d) return;
        d.hidden = !d.hidden;
        _saveDoznaka(list);
        _updateDoznakaVisibility();
        _renderStavke();
    };
    window.mapaRadnikaDeleteDoznaka = function(index) {
        var list = _loadSavedDoznaka();
        var d = list[index];
        if (!d) return;
        if (_map) _map.closePopup();
        _showTragConfirm('Obrisati "' + (d.name || 'Doznačena stabla') + '" (' + (d.points || []).length + ' stabala)?', function() {
            var fresh = _loadSavedDoznaka();
            fresh.splice(index, 1);
            _saveDoznaka(fresh);
            _drawSavedDoznaka();
            _renderStavke();
        });
    };

    // Imenilac razmjere (1:X) — sloj je vidljiv kad je trenutna razmjera <=
    // ovoga (krupnije/detaljnije od 1:5000, npr. 1:2000). Standardna Web
    // Mercator formula za rezoluciju (m/piksel po zumu, zavisi od geografske
    // širine preko cos(lat)), konvertovana u razmjeru preko OGC standardnog
    // piksela (0.28mm) — isti pristup kao kod glavnih web-mapping servisa
    // (Leaflet/OpenLayers/Esri) za prikaz "map scale". Računa se iz TRENUTNOG
    // centra mape, ne fiksno po zumu, jer razmjera zavisi i od širine.
    var DOZNAKA_MAX_SCALE = 5000;
    function _currentMapScale() {
        if (!_map) return Infinity;
        var metersPerPixel = 156543.03392 * Math.cos(_map.getCenter().lat * Math.PI / 180) / Math.pow(2, _map.getZoom());
        return metersPerPixel / 0.00028;
    }
    function _updateDoznakaVisibility() {
        if (!_map || !_doznakaLayerGroups.length) return;
        var scaleVisible = _currentMapScale() <= DOZNAKA_MAX_SCALE;
        var saved = _loadSavedDoznaka();
        var anyVisible = false;
        _doznakaLayerGroups.forEach(function(lg, i) {
            if (!lg) return;
            var visible = scaleVisible && !(saved[i] && saved[i].hidden);
            if (visible && !_map.hasLayer(lg)) lg.addTo(_map);
            else if (!visible && _map.hasLayer(lg)) _map.removeLayer(lg);
            if (visible) anyVisible = true;
        });
        if (anyVisible) _bringUserLayersToFront();
    }
    // Stvarni KML-ovi iz terena znaju imati i preko 2000-2800 stabala u JEDNOM
    // sloju (potvrđeno na fajlovima koje je poslovođa dodao) — toliko markera
    // na Leaflet-ovom DIJELJENOM SVG rendereru (svaki marker = poseban DOM
    // čvor) zna primjetno usporiti pomjeranje/zumiranje mape na slabijem
    // telefonu. Doznaka zato koristi SVOJ L.canvas() renderer (jedan <canvas>
    // umjesto hiljada SVG čvorova) — isti obrazac kao konus smjera gledanja
    // (_drawHeadingCone). Klik/tooltip/popup i dalje rade normalno preko
    // canvasa (Leaflet ugrađeno hit-testiranje), ništa se ne gubi.
    var _doznakaCanvasRenderer = null;
    function _drawSavedDoznaka() {
        if (!_doznakaCanvasRenderer) _doznakaCanvasRenderer = L.canvas({ pane: 'rmDoznakaPane' });
        _doznakaLayerGroups.forEach(function(lg) { if (lg && _map.hasLayer(lg)) _map.removeLayer(lg); });
        _doznakaLayerGroups = [];
        _doznakaMarkers = [];
        _loadSavedDoznaka().forEach(function(d, si) {
            var lg = L.featureGroup();
            (d.points || []).forEach(function(p, pi) {
                var safeName = String(p.name || 'Stablo').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                var done = !!p.done;
                var marker = L.circleMarker([p.lat, p.lng], {
                    renderer: _doznakaCanvasRenderer,
                    radius: 5,
                    color: done ? '#4b5563' : '#15803d',
                    weight: 2,
                    fillColor: done ? '#9ca3af' : '#22c55e',
                    fillOpacity: 0.9
                })
                    .bindTooltip((done ? '✅ ' : '') + safeName, { permanent: false, direction: 'top', className: 'karta-tooltip' })
                    .bindPopup(
                        '<div class="rm-tacka-popup">' +
                        '<div class="rm-tacka-popup-title">🌲 ' + safeName + '</div>' +
                        '<div style="font-size:12px;color:#6b7280;margin-bottom:8px;">' + (done ? '✅ Izvršena primka' : '⬜ Nije izvršeno') + '</div>' +
                        '<button type="button" class="rm-tacka-popup-route" onclick="mapaRadnikaToggleDoznakaTreeDone(' + si + ',' + pi + ')">' +
                        (done ? '↩️ Poništi izvršeno' : '✅ Označi izvršeno') + '</button>' +
                        '</div>'
                    );
                _bindStavkaPopupClick(marker);
                marker.addTo(lg);
                _doznakaMarkers.push(marker);
            });
            _doznakaLayerGroups.push(lg);
        });
        _updateDoznakaVisibility();
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
        _gpsUnsubscribe('explorer');
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
        _stopExplorer(); // ne gomilaj listener ako je već aktivan za drugu tačku
        // Samo auto-centriranje smeta Exploreru (vraćalo bi mapu na korisnika);
        // praćenje se NE gasi — plava tačka mora ostati živa dok navigira.
        _pauzirajFollow();
        _explorerTarget = { lat: t.lat, lng: t.lng, name: t.name || 'Tačka' };
        var nameEl = document.getElementById('radnik-mapa-explorer-name');
        if (nameEl) nameEl.textContent = String(_explorerTarget.name); // textContent — bez ručnog HTML-escapinga
        var el = document.getElementById('radnik-mapa-explorer');
        if (el) el.classList.remove('hidden');
        _gpsSubscribe('explorer', function(pos) {
            _explorerLastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            _updateExplorerHud();
        }, function() {
            _notify('showError', 'Nije moguće pratiti lokaciju za navigaciju do tačke.');
        });
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
    function _renderTackeList() { return _renderStavke(); }

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
            _bindStavkaPopupClick(marker);
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
    // Fotografije se čuvaju kao base64 data URL — stvarna veličina slike je
    // 3/4 dužine base64 dijela (minus padding "="). Radniku treba prikazati
    // koliko prostora zauzimaju, inače se tokom sezone neopaženo nagomilaju.
    var FOTO_CLEANUP_DANA = 30;
    function _dataUrlBytes(dataUrl) {
        if (!dataUrl) return 0;
        var comma = dataUrl.indexOf(',');
        var b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        var pad = 0;
        if (b64.slice(-2) === '==') pad = 2;
        else if (b64.slice(-1) === '=') pad = 1;
        return Math.max(0, Math.floor(b64.length * 3 / 4) - pad);
    }
    function _fmtBytes(b) {
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
        return (b / (1024 * 1024)).toFixed(1) + ' MB';
    }
    function _fotoCutoffTs() {
        return Date.now() - FOTO_CLEANUP_DANA * 24 * 60 * 60 * 1000;
    }
    // Fotografije BEZ datuma se NIKAD ne brišu automatski — ne možemo im
    // pouzdano odrediti starost, pa je sigurnije zadržati ih.
    function _fotoIsOld(f, cutoff) {
        var t = f && f.created ? new Date(f.created).getTime() : 0;
        return !!t && t < cutoff;
    }
    window.mapaRadnikaCleanupFoto = function() {
        _loadSavedFoto().then(function(items) {
            var cutoff = _fotoCutoffTs();
            var old = items.filter(function(f) { return _fotoIsOld(f, cutoff); });
            if (!old.length) {
                _notify('showInfo', 'Nema fotografija starijih od ' + FOTO_CLEANUP_DANA + ' dana.');
                return;
            }
            var bytes = old.reduce(function(s, f) { return s + _dataUrlBytes(f.dataUrl); }, 0);
            _showTragConfirm(
                'Obrisati ' + old.length + ' fotografija starijih od ' + FOTO_CLEANUP_DANA +
                ' dana? Oslobodiće se oko ' + _fmtBytes(bytes) + '.',
                function() {
                    // Svježe učitavanje prije brisanja — ne oslanjaj se na
                    // podatke učitane prije otvaranja potvrde.
                    _loadSavedFoto().then(async function(fresh) {
                        var c = _fotoCutoffTs();
                        var kept = fresh.filter(function(f) { return !_fotoIsOld(f, c); });
                        var removed = fresh.length - kept.length;
                        await _saveFoto(kept);
                        await _drawSavedFoto();
                        await _renderFotoList();
                        _notify('showSuccess', 'Obrisano ' + removed + ' fotografija', 'Oslobođeno oko ' + _fmtBytes(bytes) + '.');
                    });
                }
            );
        });
    };
    // Foto se čuvaju u IndexedDB pa se keš mora poništiti pri svakoj izmjeni —
    // inače bi objedinjena lista prikazivala staro stanje do idućeg punog čitanja.
    function _renderFotoList() { _stavkeFotoCache = null; return _renderStavke(); }

    // ---- SJEČAČKE LINIJE — linije za obilježavanje sječe, OKOMITE na
    // izohipse (niz padinu — "fall line"), na razmaku koji radnik zada
    // (obično ~50m). App nema stvaran izvor podataka o izohipsama (Topo sloj
    // je čisti raster, bez geometrije) — smjer zato UNOSI/HVATA radnik sam
    // (kompas telefona ili ručni unos ugla).
    //
    // KLJUČNA DIZAJN-ODLUKA (više radnika, BEZ interneta na terenu): nema
    // nikakve sinhronizacije podataka. Linije se generišu isključivo iz (1)
    // granice odjela — već identična na svim telefonima jer dolazi iz istog
    // offline-keširanog data/odjeli.geojson, i (2) dva broja koje radnici
    // izgovore jedni drugima na terenu — azimut i razmak. Isti odjel + ista
    // dva broja = matematički IDENTIČAN, deterministički numerisan set
    // linija na svakom telefonu, bez ijednog bajta prenesenih podataka.
    var _sjeceOdjelKey = null;   // labelKey izabranog odjela (_featureKeys().lk)
    var _sjeceOdjelLabel = '';   // prikazni naziv (npr. "73" ili "59/1")
    var _sjecePicking = false;   // čeka klik na odjel-poligon
    var _sjeceLines = [];        // rezultat _generateSjeceLines
    var _sjeceLayers = [];       // Leaflet polyline-ovi trenutno iscrtanih linija

    function _sjeceConfigKey() {
        return 'mapa_radnika_sjece_' + (_currentUserObj().username || 'anon');
    }
    function _loadSjeceConfig() {
        try { return JSON.parse(localStorage.getItem(_sjeceConfigKey()) || 'null'); }
        catch (e) { return null; }
    }
    function _saveSjeceConfig(cfg) {
        try {
            if (cfg) localStorage.setItem(_sjeceConfigKey(), JSON.stringify(cfg));
            else localStorage.removeItem(_sjeceConfigKey());
        } catch (e) {}
    }

    // ---- Čista geometrija (bez Leaflet/DOM zavisnosti — lako provjerljivo) ----

    // Ravna (lokalna) projekcija oko referentne tačke — na skali jednog
    // odjela (stotine metara) dovoljno precizna, mnogo jednostavnija i brža
    // od prave geodetske projekcije.
    function _toLocalXY(lat, lng, lat0, lng0) {
        var mPerDegLat = 111320;
        var mPerDegLng = 111320 * Math.cos(lat0 * Math.PI / 180);
        return { x: (lng - lng0) * mPerDegLng, y: (lat - lat0) * mPerDegLat };
    }
    function _fromLocalXY(x, y, lat0, lng0) {
        var mPerDegLat = 111320;
        var mPerDegLng = 111320 * Math.cos(lat0 * Math.PI / 180);
        return { lat: lat0 + y / mPerDegLat, lng: lng0 + x / mPerDegLng };
    }

    // Even-odd (ray-casting) test PREKO SVIH prstenova zajedno — ispravno
    // tretira i rupe (holes) i višedijelne (MultiPolygon) odjele bez posebne
    // logike: to je standardno matematičko svojstvo even-odd pravila kad se
    // svaki prsten tretira kao još jedna "ivica koja se prelazi".
    function _pointInRings(pt, ringsXY) {
        var inside = false;
        for (var r = 0; r < ringsXY.length; r++) {
            var ring = ringsXY[r];
            var n = ring.length;
            for (var i = 0, j = n - 1; i < n; j = i++) {
                var xi = ring[i].x, yi = ring[i].y;
                var xj = ring[j].x, yj = ring[j].y;
                var intersect = ((yi > pt.y) !== (yj > pt.y)) &&
                    (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
        }
        return inside;
    }
    // Presjek duži p1->p2 sa duži p3->p4 — vraća parametar t (0..1, duž
    // p1->p2) ili null ako nema presjeka NA OBJE duži (standardna
    // parametarska formula za presjek dvije duži).
    function _segIntersectT(p1, p2, p3, p4) {
        var d1x = p2.x - p1.x, d1y = p2.y - p1.y;
        var d2x = p4.x - p3.x, d2y = p4.y - p3.y;
        var denom = d1x * d2y - d1y * d2x;
        if (Math.abs(denom) < 1e-9) return null; // paralelne duži
        var t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
        var u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
        if (t < 0 || t > 1 || u < 0 || u > 1) return null;
        return t;
    }
    // Generiše paralelne linije preko geometrije odjela (ringsXY — niz
    // prstenova, svaki niz {x,y} tačaka u lokalnim metrima), na datom azimutu
    // (0-359°, 0=sjever) i razmaku (metri). Vraća niz { index, segments }
    // (segments = niz lanaca tačaka u LOKALNIM koordinatama — svaki lanac ima
    // BAR 2 tačke, pozivalac ih vraća u lat/lng preko _fromLocalXY), sortiran
    // po index-u (rastuće, deterministički za istu geometriju+azimut+razmak).
    // SVE linije su prave; raspored ih centrira tako da nijedna (pa ni prva/
    // zadnja) ne padne tik uz granicu odjela — vidi "RASPORED LINIJA" niže.
    function _generateSjeceLinesXY(ringsXY, azimuthDeg, spacingM) {
        var azRad = azimuthDeg * Math.PI / 180;
        var d = { x: Math.sin(azRad), y: Math.cos(azRad) };   // smjer linije (niz padinu)
        var p = { x: d.y, y: -d.x };                           // okomito na d (duž koje se linijeređaju)

        var allPts = [];
        ringsXY.forEach(function(ring) { ring.forEach(function(pt) { allPts.push(pt); }); });
        if (!allPts.length) return [];

        var minProj = Infinity, maxProj = -Infinity;
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        allPts.forEach(function(pt) {
            var proj = pt.x * p.x + pt.y * p.y;
            if (proj < minProj) minProj = proj;
            if (proj > maxProj) maxProj = proj;
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        });

        var diag = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2));
        var halfLen = diag * 2 + spacingM; // sigurno predugo — oba kraja garantovano van geometrije

        // RASPORED LINIJA — centriran unutar odjela, sa jednakom marginom na
        // oba kraja koja je UVIJEK bar pola razmaka.
        //
        // Ranije su linije bile "zakačene" na apsolutnu mrežu (k * razmak), pa
        // je prva/zadnja znala pasti tik uz samu granicu odjela — u uglu gdje
        // je odjel uzan, što je davalo beskoristan kratki patrljak (i to je
        // bio razlog ranijeg pokušaja da prva/zadnja prate granicu, što je
        // opet pogrešno jer linija onda POSTANE granica umjesto da bude
        // sječačka linija).
        //
        // Sada: n linija razmaknutih TAČNO za zadati razmak, ali pomjerenih
        // tako da su podjednako udaljene od oba ruba (margina >= razmak/2).
        // Prva linija time uvijek stoji pravilno unutar prvog pojasa (od
        // granice do druge linije), puna dužina, prava — kao i sve ostale.
        var width = maxProj - minProj;
        var lineCount = Math.max(1, Math.floor(width / spacingM));
        var margin = (width - (lineCount - 1) * spacingM) / 2;

        var result = [];
        for (var li = 0; li < lineCount; li++) {
            var originProj = minProj + margin + li * spacingM;
            var basePt = { x: p.x * originProj, y: p.y * originProj };
            var segA = { x: basePt.x - d.x * halfLen, y: basePt.y - d.y * halfLen };
            var segB = { x: basePt.x + d.x * halfLen, y: basePt.y + d.y * halfLen };

            var ts = [];
            ringsXY.forEach(function(ring) {
                var n = ring.length;
                for (var i = 0, j = n - 1; i < n; j = i++) {
                    var t = _segIntersectT(segA, segB, ring[j], ring[i]);
                    if (t != null) ts.push(t);
                }
            });
            if (ts.length < 2) continue;
            ts.sort(function(a, b) { return a - b; });

            var segments = [];
            for (var m = 0; m < ts.length - 1; m++) {
                var t0 = ts[m], t1 = ts[m + 1];
                if (t1 - t0 < 1e-6) continue; // zanemarljivo kratak interval (dodir ivice/tjeme)
                var midT = (t0 + t1) / 2;
                var midPt = { x: segA.x + (segB.x - segA.x) * midT, y: segA.y + (segB.y - segA.y) * midT };
                if (!_pointInRings(midPt, ringsXY)) continue;
                var pt0 = { x: segA.x + (segB.x - segA.x) * t0, y: segA.y + (segB.y - segA.y) * t0 };
                var pt1 = { x: segA.x + (segB.x - segA.x) * t1, y: segA.y + (segB.y - segA.y) * t1 };
                segments.push([pt0, pt1]);
            }
            if (segments.length) result.push({ proj: originProj, segments: segments });
        }
        // Prikazni broj linije — sekvencijalno od 1, redoslijed fiksiran
        // rasporedom iznad (deterministički za iste ulaze, isti na svakom telefonu).
        result.forEach(function(line, idx) { line.index = idx + 1; });
        return result;
    }

    // ---- UI/state — reuse istog obrasca kao "Vodi me do lokacije"/"Označi
    // površinu" (pick-mod preko klika na mapu/poligon, traka-savjet). ----
    function _sjecePanelEl() { return document.getElementById('radnik-mapa-sjece-panel'); }
    function _updateSjecePanel() {
        var panel = _sjecePanelEl();
        if (!panel) return;
        var odjelEl = document.getElementById('sjece-odjel-label');
        var pickBtn = document.getElementById('sjece-pick-btn');
        var genBtn = document.getElementById('sjece-generate-btn');
        var az = document.getElementById('sjece-azimuth-input');
        var sp = document.getElementById('sjece-spacing-input');
        if (odjelEl) odjelEl.textContent = _sjeceOdjelLabel ? ('Odjel ' + _sjeceOdjelLabel) : '— (izaberite odjel)';
        if (pickBtn) pickBtn.textContent = _sjecePicking ? '📍 Kliknite na odjel na mapi...' : '📍 Izaberi odjel';
        if (genBtn) {
            var azOk = az && az.value !== '' && !isNaN(parseFloat(az.value));
            var spOk = sp && sp.value !== '' && parseFloat(sp.value) > 0;
            genBtn.disabled = !(_sjeceOdjelKey && azOk && spOk);
        }
        // Snimanje ofarbane linije traži samo odjel (azimut/razmak su za PLAN).
        var recBtn = document.getElementById('sjek-record-btn');
        if (recBtn) recBtn.disabled = !_sjeceOdjelKey;
        var refBtn = document.getElementById('sjek-refresh-btn');
        if (refBtn) refBtn.disabled = !_sjeceOdjelKey;
    }
    window.mapaRadnikaStartSjeceLinije = function() {
        _hideTragoviMenu();
        if (typeof window.mapaRadnikaCancelRoutePick === 'function') window.mapaRadnikaCancelRoutePick();
        if (typeof window.mapaRadnikaCancelPoligon === 'function') window.mapaRadnikaCancelPoligon();
        if (typeof window.mapaRadnikaCancelTacka === 'function') window.mapaRadnikaCancelTacka();
        if (typeof window.mapaRadnikaStopExplorer === 'function') window.mapaRadnikaStopExplorer();
        if (typeof window.mapaRadnikaCancelIzvrsenoPoligon === 'function') window.mapaRadnikaCancelIzvrsenoPoligon();
        var panel = _sjecePanelEl();
        if (panel) panel.classList.remove('hidden');
        var cfg = _loadSjeceConfig();
        if (cfg) {
            var az = document.getElementById('sjece-azimuth-input');
            var sp = document.getElementById('sjece-spacing-input');
            if (az && !az.value) az.value = cfg.azimuth;
            if (sp && !sp.value) sp.value = cfg.spacing;
        }
        _updateSjecePanel();
    };
    window.mapaRadnikaCloseSjecePanel = function() {
        _sjecePicking = false;
        if (typeof window.mapaRadnikaCancelSjeceDirection === 'function') window.mapaRadnikaCancelSjeceDirection();
        var panel = _sjecePanelEl();
        if (panel) panel.classList.add('hidden');
    };
    window.mapaRadnikaSjecePickOdjel = function() {
        if (typeof window.mapaRadnikaCancelSjeceDirection === 'function') window.mapaRadnikaCancelSjeceDirection();
        _sjecePicking = true;
        _updateSjecePanel();
    };
    window.mapaRadnikaSjeceInputChanged = _updateSjecePanel;
    // Poziva se iz istog centralnog lanca klika na odjel-poligone (onEachFeature)
    // kao _handleRoutePickClick/_handlePoligonClick. Vraća true ako je klik
    // "potrošen" za biranje odjela (pozivalac onda ne otvara info panel).
    function _handleSjeceOdjelClick(latlng, feature) {
        if (!_sjecePicking) return false;
        var k = _featureKeys(feature);
        _sjeceOdjelKey = k.lk;
        var p = feature.properties || {};
        _sjeceOdjelLabel = String(p.odjel || p.name || k.lk);
        _sjecePicking = false;
        _updateSjecePanel();
        // Odjel je promijenjen — povuci ofarbane linije tog odjela (tuđe i moje).
        _restoreSjekLinije(true);
        return true;
    }

    // ---- Treća opcija za smjer: nacrtaj pravac (dvije tačke na mapi) —
    // umjesto kompasa/ručnog unosa, radnik klikne DVIJE tačke koje pokazuju
    // smjer niz padinu (npr. poravnato sa vidljivim konturama na Topo
    // podlozi), azimut se izračuna preko postojećeg _bearingDeg (isti kao
    // kod "Vodi me do lokacije") i upiše u polje za azimut. ----
    var _sjeceDirPickState = null; // null | 'awaiting-a' | 'awaiting-b'
    var _sjeceDirPointA = null;
    var _sjeceDirAMarker = null;
    var _sjeceDirLine = null;
    // Panel se PRIVREMENO sklanja dok se bira pravac: stoji na istom mjestu
    // (top:10px) kao traka-savjet ali sa višim z-index-om (1400 vs 1300), pa
    // bi inače prekrio uputu "kliknite početnu tačku" i zaklonio dio mape na
    // koji radnik treba kliknuti. Vraća se čim je pravac izabran/otkazan.
    var _sjeceDirPanelWasOpen = false;
    function _restoreSjecePanelAfterDir() {
        if (_sjeceDirPanelWasOpen) {
            _sjeceDirPanelWasOpen = false;
            var panel = _sjecePanelEl();
            if (panel) panel.classList.remove('hidden');
        }
        // Uvijek osvježi (ne samo kad je panel vraćen) — azimut je upravo
        // upisan, pa "Generiši" treba prestati biti onemogućen.
        _updateSjecePanel();
    }
    window.mapaRadnikaSjeceDrawDirection = function() {
        if (typeof window.mapaRadnikaCancelRoutePick === 'function') window.mapaRadnikaCancelRoutePick();
        if (typeof window.mapaRadnikaCancelPoligon === 'function') window.mapaRadnikaCancelPoligon();
        if (typeof window.mapaRadnikaCancelTacka === 'function') window.mapaRadnikaCancelTacka();
        if (typeof window.mapaRadnikaStopExplorer === 'function') window.mapaRadnikaStopExplorer();
        if (typeof window.mapaRadnikaCancelMjerenje === 'function') window.mapaRadnikaCancelMjerenje();
        if (typeof window.mapaRadnikaCancelIzvrsenoPoligon === 'function') window.mapaRadnikaCancelIzvrsenoPoligon();
        _sjecePicking = false; // ne miješaj sa biranjem odjela — samo jedan klik-mod aktivan
        _sjeceDirPickState = 'awaiting-a';
        _sjeceDirPointA = null;
        if (_sjeceDirAMarker) { _map.removeLayer(_sjeceDirAMarker); _sjeceDirAMarker = null; }
        var panel = _sjecePanelEl();
        _sjeceDirPanelWasOpen = !!(panel && !panel.classList.contains('hidden'));
        if (panel) panel.classList.add('hidden');
        _showRouteHint(
            '<span>✏️ Kliknite POČETNU tačku pravca (niz padinu)</span>' +
            '<span><button type="button" onclick="mapaRadnikaCancelSjeceDirection()">✕</button></span>'
        );
    };
    window.mapaRadnikaCancelSjeceDirection = function() {
        _sjeceDirPickState = null;
        _sjeceDirPointA = null;
        if (_sjeceDirAMarker) { _map.removeLayer(_sjeceDirAMarker); _sjeceDirAMarker = null; }
        _hideRouteHint();
        _restoreSjecePanelAfterDir();
    };
    // Poziva se iz istog centralnog lanca klika (onEachFeature + generički
    // _map.on('click',...)) kao _handleRoutePickClick/_handlePoligonClick/
    // _handleSjeceOdjelClick. Vraća true ako je klik "potrošen".
    function _handleSjeceDirectionClick(latlng) {
        if (_sjeceDirPickState === 'awaiting-a') {
            _sjeceDirPointA = { lat: latlng.lat, lng: latlng.lng };
            _sjeceDirAMarker = L.circleMarker([latlng.lat, latlng.lng], { radius: 8, color: '#dc2626', fillColor: '#f87171', fillOpacity: 0.9, weight: 2 }).addTo(_map);
            _sjeceDirPickState = 'awaiting-b';
            _showRouteHint(
                '<span>✏️ Kliknite ZAVRŠNU tačku pravca (niz padinu)</span>' +
                '<span><button type="button" onclick="mapaRadnikaCancelSjeceDirection()">✕</button></span>'
            );
            return true;
        }
        if (_sjeceDirPickState === 'awaiting-b') {
            var b = { lat: latlng.lat, lng: latlng.lng };
            var az = _bearingDeg(_sjeceDirPointA.lat, _sjeceDirPointA.lng, b.lat, b.lng);
            _sjeceDirPickState = null;
            if (_sjeceDirAMarker) { _map.removeLayer(_sjeceDirAMarker); _sjeceDirAMarker = null; }
            _hideRouteHint();
            if (_sjeceDirLine) { _map.removeLayer(_sjeceDirLine); _sjeceDirLine = null; }
            _sjeceDirLine = L.polyline(
                [[_sjeceDirPointA.lat, _sjeceDirPointA.lng], [b.lat, b.lng]],
                { color: '#dc2626', weight: 3, dashArray: '4 4' }
            ).addTo(_map);
            var azEl = document.getElementById('sjece-azimuth-input');
            if (azEl) azEl.value = Math.round(az);
            _restoreSjecePanelAfterDir(); // vrati panel (već zove _updateSjecePanel)
            _notify('showSuccess', 'Pravac zabilježen', 'Azimut ' + Math.round(az) + '°.');
            return true;
        }
        return false;
    }
    function _clearSjeceDirLine() {
        if (_sjeceDirLine) { _map.removeLayer(_sjeceDirLine); _sjeceDirLine = null; }
    }
    // Skupi SVE prstenove (outer+holes, iz SVIH GeoJSON feature-a koji dijele
    // isti labelKey — odjel zna biti "rasparčan" na više odvojenih feature-a,
    // vidi _featureKeys/_rmLabelKey) za izabrani odjel, projektuj u lokalne
    // metre oko zajedničkog centroida.
    function _collectOdjelRingsXY(odjelKey) {
        if (!_geojson || !_geojson.features) return null;
        var feats = _geojson.features.filter(function(f) { return _featureKeys(f).lk === odjelKey; });
        if (!feats.length) return null;

        var allLatLng = [];
        var rawRings = []; // niz [[lat,lng],...]
        feats.forEach(function(f) {
            var g = f.geometry;
            if (!g) return;
            var polys = g.type === 'MultiPolygon' ? g.coordinates : (g.type === 'Polygon' ? [g.coordinates] : []);
            polys.forEach(function(poly) {
                poly.forEach(function(ring) {
                    if (ring.length < 3) return;
                    var latLngRing = ring.map(function(c) { return { lat: c[1], lng: c[0] }; });
                    rawRings.push(latLngRing);
                    allLatLng = allLatLng.concat(latLngRing);
                });
            });
        });
        if (!rawRings.length) return null;

        var lat0 = allLatLng.reduce(function(s, p) { return s + p.lat; }, 0) / allLatLng.length;
        var lng0 = allLatLng.reduce(function(s, p) { return s + p.lng; }, 0) / allLatLng.length;
        var ringsXY = rawRings.map(function(ring) {
            return ring.map(function(p) { return _toLocalXY(p.lat, p.lng, lat0, lng0); });
        });
        return { ringsXY: ringsXY, lat0: lat0, lng0: lng0 };
    }
    function _clearSjeceLayers() {
        _sjeceLayers.forEach(function(l) { _map.removeLayer(l); });
        _sjeceLayers = [];
    }
    // Pretvori generisane linije (lokalne x,y) u lat/lng. Segment je lanac
    // tačaka (u praksi 2 — prava linija); lanac je zadržan kao oblik jer
    // jedna linija zna imati VIŠE odvojenih segmenata kad presiječe rupu u
    // odjelu ili prazninu između dva dijela rasparčanog odjela.
    function _sjeceLinesToLatLng(linesXY, lat0, lng0) {
        return linesXY.map(function(line) {
            return {
                index: line.index,
                segments: line.segments.map(function(chain) {
                    return chain.map(function(pt) {
                        var ll = _fromLocalXY(pt.x, pt.y, lat0, lng0);
                        return { lat: ll.lat, lng: ll.lng, x: pt.x, y: pt.y };
                    });
                })
            };
        });
    }
    function _drawSjeceLines() {
        _clearSjeceLayers();
        _sjeceLines.forEach(function(line) {
            var longest = null, longestLen = -1;
            line.segments.forEach(function(chain) {
                var latlngs = chain.map(function(pt) { return [pt.lat, pt.lng]; });
                var poly = L.polyline(latlngs, { color: '#dc2626', weight: 3, dashArray: '10 6', opacity: 0.9 }).addTo(_map);
                _sjeceLayers.push(poly);
                var len = 0;
                for (var i = 1; i < chain.length; i++) {
                    len += Math.hypot(chain[i].x - chain[i - 1].x, chain[i].y - chain[i - 1].y);
                }
                if (len > longestLen) { longestLen = len; longest = poly; }
            });
            if (longest) {
                longest.bindTooltip('Linija ' + line.index, { permanent: true, direction: 'center', className: 'karta-tooltip' });
            }
        });
        _bringUserLayersToFront();
    }
    window.mapaRadnikaGenerisiSjeceLinije = function() {
        if (!_sjeceOdjelKey) { _notify('showWarning', 'Prvo izaberite odjel.'); return; }
        var azEl = document.getElementById('sjece-azimuth-input');
        var spEl = document.getElementById('sjece-spacing-input');
        var azimuth = azEl ? parseFloat(azEl.value) : NaN;
        var spacing = spEl ? parseFloat(spEl.value) : NaN;
        if (isNaN(azimuth) || azimuth < 0 || azimuth > 359) { _notify('showWarning', 'Unesite ispravan azimut (0-359°).'); return; }
        if (isNaN(spacing) || spacing <= 0) { _notify('showWarning', 'Unesite ispravan razmak u metrima.'); return; }

        var collected = _collectOdjelRingsXY(_sjeceOdjelKey);
        if (!collected) { _notify('showError', 'Geometrija odjela nije dostupna.'); return; }

        var linesXY = _generateSjeceLinesXY(collected.ringsXY, azimuth, spacing);
        _sjeceLines = _sjeceLinesToLatLng(linesXY, collected.lat0, collected.lng0);
        _clearSjeceDirLine(); // ukloni privremeni pravac (ako je crtan) — zamijenjen je stvarnim linijama
        _drawSjeceLines();
        _saveSjeceConfig({ odjelKey: _sjeceOdjelKey, odjelLabel: _sjeceOdjelLabel, azimuth: azimuth, spacing: spacing });
        _notify('showSuccess', 'Sjekačke linije generisane', _sjeceLines.length + ' linija, razmak ' + spacing + ' m.');
        // Panel se sklanja nakon generisanja — nazad se ide preko spiska
        // "Sjekačke linije" u Tragovi tabu (vidi _renderSjeceList/✏️ Uredi).
        if (typeof window.mapaRadnikaCloseSjecePanel === 'function') window.mapaRadnikaCloseSjecePanel();
        _renderSjeceList();
    };
    window.mapaRadnikaUkloniSjeceLinije = function() {
        _sjeceLines = [];
        _clearSjeceLayers();
        _clearSjeceDirLine();
        _saveSjeceConfig(null);
        _sjeceOdjelKey = null;
        _sjeceOdjelLabel = '';
        _updateSjecePanel();
        _renderSjeceList();
    };
    // Spisak u Ostalo popup-u — jedan red sa trenutnom konfiguracijom (ako
    // postoji), sa "✏️ Uredi" (ponovo otvara panel, predpopunjen) i "🗑️"
    // (isto kao Ukloni linije). Ovo je JEDINI način da se panel ponovo otvori
    // nakon što se zatvorio pri generisanju.
    function _renderSjeceList() { return _renderStavke(); }
    // Pri otvaranju mape, ako postoji sačuvana konfiguracija (odjel+azimut+
    // razmak), automatski regeneriši i prikaži linije bez ponovnog unosa —
    // geometrija se lako ponovo izračuna (ne čuvamo je samu, samo konfiguraciju).
    function _restoreSjeceIfSaved() {
        var cfg = _loadSjeceConfig();
        if (!cfg || !cfg.odjelKey) return;
        _sjeceOdjelKey = cfg.odjelKey;
        _sjeceOdjelLabel = cfg.odjelLabel || cfg.odjelKey;
        var collected = _collectOdjelRingsXY(_sjeceOdjelKey);
        if (!collected) return;
        var linesXY = _generateSjeceLinesXY(collected.ringsXY, cfg.azimuth, cfg.spacing);
        _sjeceLines = _sjeceLinesToLatLng(linesXY, collected.lat0, collected.lng0);
        _drawSjeceLines();
        _renderSjeceList();
    }
    // Kompas za azimut — hvata JEDAN heading i upisuje ga u polje (za razliku
    // od Explorer kompasa koji kontinuirano prati; ovdje treba samo trenutna
    // vrijednost dok radnik stoji okrenut niz padinu).
    function _sjeceAzimuthOrientationHandler(e) {
        var heading = null;
        if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading;
        else if (typeof e.alpha === 'number') heading = (360 - e.alpha) % 360;
        if (heading == null || isNaN(heading)) return;
        var eventName = ('ondeviceorientationabsolute' in window) ? 'deviceorientationabsolute' : 'deviceorientation';
        window.removeEventListener(eventName, _sjeceAzimuthOrientationHandler);
        var azEl = document.getElementById('sjece-azimuth-input');
        if (azEl) azEl.value = Math.round(heading);
        _updateSjecePanel();
    }
    window.mapaRadnikaCaptureAzimuthForSjece = function() {
        function attach() {
            var eventName = ('ondeviceorientationabsolute' in window) ? 'deviceorientationabsolute' : 'deviceorientation';
            window.addEventListener(eventName, _sjeceAzimuthOrientationHandler);
        }
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(function(state) {
                if (state === 'granted') attach();
                else _notify('showWarning', 'Pristup kompasu je odbijen.');
            }).catch(function() { _notify('showError', 'Nije moguće aktivirati kompas.'); });
        } else if (typeof DeviceOrientationEvent !== 'undefined') {
            attach();
        } else {
            _notify('showWarning', 'Vaš uređaj ne podržava kompas — unesite azimut ručno.');
        }
    };

    // ================= STVARNO OFARBANE SJEKAČKE LINIJE =================
    // Generisane linije iznad su PLAN (matematika iz azimuta i razmaka, ista
    // na svakom telefonu, ništa se ne šalje). Ovdje se snima STVARNO prohodana
    // putanja dok radnik farba stabla, šalje se na server i vide je SVI radnici
    // — jedini dio ovog modula koji nešto upisuje na server.
    //
    // Ključ dijeljenja je _sjeceOdjelKey (labelKey, npr. "VOJSKOVA 73"), koji
    // se izvodi iz istog offline geojsona na svakom uređaju.

    var _sjekRecording = false;
    var _sjekPaused = false;
    var _sjekPoints = [];          // [{ ll:[lat,lng], t:ms, acc:m }]
    var _sjekUuid = null;
    var _sjekStartIso = null;
    var _sjekActiveMs = 0;
    var _sjekSegmentStartTs = 0;
    var _sjekOdbaceno = 0;         // broj fixova odbačenih zbog loše preciznosti
    var _sjekZadnjaAcc = null;
    var _sjekDrawLayer = null;     // živa linija dok snima
    var _sjekLayers = [];          // sačuvane/tuđe linije na mapi (index = _sjekVisible())
    var _sjekRenderer = null;
    var _sjekServerLinije = [];    // zadnje povučeno sa servera
    var _sjekPendingNaziv = '';
    var _sjekPendingBroj = '';

    function _sjekUuidNovi() {
        try {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        } catch (_) {}
        // Fallback za starije webview-e bez crypto.randomUUID
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
        });
    }

    // ---- Douglas-Peucker u LOKALNIM METRIMA ----
    // Ne u stepenima — bez lokalne projekcije prag je besmislen jer 1° dužine
    // nije isto što i 1° širine. Iterativno (eksplicitan stack) umjesto
    // rekurzije: trag od nekoliko hiljada tačaka bi rekurzijom mogao prebiti
    // stack na slabijem telefonu.
    function _dpSimplifyXY(pts, epsM) {
        var n = pts.length;
        if (n < 3) return pts.slice();
        var keep = new Array(n);
        keep[0] = keep[n - 1] = true;
        var stack = [[0, n - 1]];
        while (stack.length) {
            var seg = stack.pop(), i0 = seg[0], i1 = seg[1];
            if (i1 - i0 < 2) continue;
            var a = pts[i0], b = pts[i1];
            var dx = b.x - a.x, dy = b.y - a.y;
            var den = Math.sqrt(dx * dx + dy * dy);
            var maxD = -1, maxI = -1;
            for (var i = i0 + 1; i < i1; i++) {
                var p = pts[i], d;
                if (den < 1e-9) d = Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
                else d = Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / den;
                if (d > maxD) { maxD = d; maxI = i; }
            }
            if (maxD > epsM) { keep[maxI] = true; stack.push([i0, maxI], [maxI, i1]); }
        }
        var out = [];
        for (var k = 0; k < n; k++) if (keep[k]) out.push(pts[k]);
        return out;
    }

    function _r6(v) { return Math.round(v * 1e6) / 1e6; }

    // Pojednostavi + zaokruži na 6 decimala (≈8 cm — 50× finije od samog GPS-a)
    // i GARANTUJ da JSON stane u jednu Sheets ćeliju: ako ne stane, udvostruči
    // prag i probaj ponovo. Douglas-Peucker monotono smanjuje broj tačaka pa se
    // petlja uvijek zaustavi. Time prekoračenje limita sa našeg klijenta
    // postaje nemoguće (server ipak ima svoju branu — _sjekChunkPoints).
    function _sjekPackPoints(latlngs) {
        if (!latlngs || latlngs.length < 2) return null;
        var lat0 = latlngs[0][0], lng0 = latlngs[0][1];
        var xy = latlngs.map(function(ll) {
            var p = _toLocalXY(ll[0], ll[1], lat0, lng0);
            p.ll = ll;
            return p;
        });
        var eps = SJEK_SIMPLIFY_M;
        for (var guard = 0; guard < 12; guard++) {
            var simp = _dpSimplifyXY(xy, eps);
            var out = simp.map(function(p) { return [_r6(p.ll[0]), _r6(p.ll[1])]; });
            var json = JSON.stringify(out);
            if (json.length <= SJEK_MAX_JSON || out.length <= 2) {
                return { points: out, bytes: json.length, eps: eps, sirovo: latlngs.length };
            }
            eps *= 2;
        }
        return {
            points: [[_r6(lat0), _r6(lng0)],
                     [_r6(latlngs[latlngs.length - 1][0]), _r6(latlngs[latlngs.length - 1][1])]],
            bytes: 0, eps: eps, sirovo: latlngs.length
        };
    }

    // ---- Lokalno skladište: SAMO moje linije (tuđe žive u cache_sjek_linije_*) ----
    function _sjekMojeKey()  { return 'mapa_radnika_sjek_moje_'  + (_currentUserObj().username || 'anon'); }
    function _sjekQueueKey() { return 'mapa_radnika_sjek_queue_' + (_currentUserObj().username || 'anon'); }
    function _loadSjekMoje() {
        try { return JSON.parse(localStorage.getItem(_sjekMojeKey()) || '[]') || []; } catch (_) { return []; }
    }
    function _saveSjekMoje(list) {
        // Kapa 300 — linija je ~2 KB, a localStorage je na starijim telefonima
        // tijesan. Reže se najstarije VEĆ POSLANO; ono što čeka slanje se
        // nikad ne briše (to bi bio tihi gubitak terenskog rada).
        if (list.length > 300) {
            var poslane = list.filter(function(l) { return !l.pendingSync; });
            var cekaju  = list.filter(function(l) { return l.pendingSync; });
            poslane.sort(function(a, b) { return String(b.kreirano).localeCompare(String(a.kreirano)); });
            list = cekaju.concat(poslane.slice(0, Math.max(0, 300 - cekaju.length)));
        }
        try { localStorage.setItem(_sjekMojeKey(), JSON.stringify(list)); } catch (_) {}
    }
    function _loadSjekQueue() {
        try { return JSON.parse(localStorage.getItem(_sjekQueueKey()) || '[]') || []; } catch (_) { return []; }
    }
    function _saveSjekQueue(q) {
        try { localStorage.setItem(_sjekQueueKey(), JSON.stringify(q)); } catch (_) {}
    }
    function _sjekMarkSynced(uuid, rez) {
        var list = _loadSjekMoje();
        for (var i = 0; i < list.length; i++) {
            if (list[i].uuid !== uuid) continue;
            list[i].pendingSync = false;
            delete list[i].syncError;
            if (rez && rez.duzinaM) list[i].duzinaM = rez.duzinaM;
            break;
        }
        _saveSjekMoje(list);
    }
    function _sjekMarkError(uuid, poruka) {
        var list = _loadSjekMoje();
        for (var i = 0; i < list.length; i++) {
            if (list[i].uuid !== uuid) continue;
            list[i].pendingSync = false;
            list[i].syncError = String(poruka || '').substring(0, 80);
            break;
        }
        _saveSjekMoje(list);
    }

    // ---- Povlačenje tuđih linija ----
    // NAMJERNO ne koristi fetchWithCache: getSmartCacheTTL (js/app.js) petkom
    // poslije 9h i vikendom keširа "do ponedjeljka 6:30", pa se linija koju je
    // kolega ofarbao danas ne bi vidjela do ponedjeljka. Ovdje treba svježina
    // mjerena minutama, ne danima — otud vlastiti keš od 5 minuta.
    function _sjekCacheKey() { return 'cache_sjek_linije_' + (_sjeceOdjelKey || 'SVE'); }
    async function _fetchSjekLinije(force) {
        if (!_sjeceOdjelKey) return { linije: [] }; // bez izabranog odjela ne povlačimo ništa
        var kljuc = _sjekCacheKey();
        var kes = null;
        try { var raw = localStorage.getItem(kljuc); if (raw) kes = JSON.parse(raw); } catch (_) {}
        if (!navigator.onLine) return kes ? kes.data : { linije: [] };
        if (!force && kes && (Date.now() - kes.timestamp) < SJEK_TTL_MS) return kes.data;
        try {
            var url = buildApiUrl('get-sjekacke-linije', { odjelKey: _sjeceOdjelKey });
            var r = await fetch(url, { signal: AbortSignal.timeout(30000) });
            var data = await r.json();
            if (data && data.linije) {
                try { localStorage.setItem(kljuc, JSON.stringify({ data: data, timestamp: Date.now() })); } catch (_) {}
                return data;
            }
            if (data && data.error) {
                if (String(data.error).indexOf('Unknown path') !== -1) {
                    _notify('showWarning', 'Server još nema podršku za ofarbane linije',
                        'Administrator treba napraviti novo izdanje (deployment) Apps Script projekta.');
                } else if (String(data.error).toLowerCase().indexOf('unauthorized') !== -1 &&
                           typeof window._handleUnauthorized === 'function') {
                    window._handleUnauthorized();
                }
            }
            return kes ? kes.data : { linije: [] };
        } catch (_) {
            return kes ? kes.data : { linije: [] };
        }
    }

    // Spoji moje (uklj. one koje čekaju slanje) i tuđe, dedupe po uuid-u —
    // lokalna verzija pobjeđuje da se "⏳ čeka slanje" ne izgubi nakon što
    // server vrati istu liniju.
    function _sjekVisible() {
        var out = [];
        var vidjeni = {};
        _loadSjekMoje().forEach(function(l) {
            if (_sjeceOdjelKey && l.odjelKey !== _sjeceOdjelKey) return;
            vidjeni[l.uuid] = true;
            var kopija = {};
            for (var k in l) if (Object.prototype.hasOwnProperty.call(l, k)) kopija[k] = l[k];
            kopija.mine = true;
            out.push(kopija);
        });
        (_sjekServerLinije || []).forEach(function(l) {
            if (vidjeni[l.uuid]) return;
            var kopija = {};
            for (var k in l) if (Object.prototype.hasOwnProperty.call(l, k)) kopija[k] = l[k];
            kopija.mine = (l.korisnik === (_currentUserObj().username || ''));
            out.push(kopija);
        });
        out.sort(function(a, b) { return String(b.kreirano).localeCompare(String(a.kreirano)); });
        return out;
    }

    // Stabilna boja po autoru — isti radnik uvijek ista boja na svim telefonima.
    function _sjekBoja(korisnik) {
        var h = 0, s = String(korisnik || '');
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return SJEK_PALETTE[h % SJEK_PALETTE.length];
    }

    function _clearSjekLayers() {
        _sjekLayers.forEach(function(l) { if (l && _map && _map.hasLayer(l)) _map.removeLayer(l); });
        _sjekLayers = [];
    }

    function _drawSjekLinije() {
        if (!_map) return;
        if (!_sjekRenderer) _sjekRenderer = L.canvas({ pane: 'rmSjekPane' });
        _clearSjekLayers();
        var ja = _currentUserObj().username || '';
        _sjekVisible().forEach(function(l, i) {
            var pts = l.points || [];
            if (pts.length < 2) { _sjekLayers.push(null); return; }
            var boja = _sjekBoja(l.korisnik || ja);
            var grupa = L.featureGroup();
            // Bijeli "halo" ispod — bez njega tanka linija nestane na satelitskoj
            // podlozi (isti obrazac kao _haloLayer kod granica odjela).
            L.polyline(pts, { renderer: _sjekRenderer, color: '#ffffff', weight: 7, opacity: 0.75 }).addTo(grupa);
            L.polyline(pts, {
                renderer: _sjekRenderer, color: boja, weight: 4, opacity: 0.95,
                dashArray: l.pendingSync ? '2 6' : null   // isprekidano = još nije poslano
            }).addTo(grupa);

            var kad = l.kreirano ? new Date(l.kreirano).toLocaleString('bs-BA') : '?';
            var duz = _fmtDistanceM(l.duzinaM || 0);
            var ko  = l.radnik || l.korisnik || '?';
            grupa.bindTooltip(
                (l.pendingSync ? '⏳ ' : '🎨 ') +
                (l.brojLinije ? 'Linija ' + l.brojLinije + ' · ' : '') +
                _esc(ko) + ' · ' + duz,
                { sticky: true, className: 'karta-tooltip' }
            );
            grupa.bindPopup(
                '<div class="rm-tacka-popup">' +
                '<div class="rm-tacka-popup-title">🎨 ' + _esc(l.naziv || 'Ofarbana linija') + '</div>' +
                '<div style="font-size:12px;color:#4b5563;margin-bottom:8px;">' +
                '👤 ' + _esc(ko) + '<br>📅 ' + _esc(kad) + '<br>📏 ' + duz +
                ' · ' + (pts.length) + ' tačaka' +
                (l.pendingSync ? '<br>⏳ Čeka slanje na server' : '') +
                (l.syncError ? '<br>⚠️ ' + _esc(l.syncError) : '') +
                '</div>' +
                (l.mine && !l.pendingSync
                    ? '<button type="button" class="rm-tacka-popup-delete" onclick="mapaRadnikaDeleteOfarbana(' + i + ')">🗑️ Obriši</button>'
                    : '') +
                '</div>'
            );
            _bindStavkaPopupClick(grupa);
            grupa.addTo(_map);
            _sjekLayers.push(grupa);
        });
    }

    async function _restoreSjekLinije(force) {
        if (!_sjeceOdjelKey) { _sjekServerLinije = []; _clearSjekLayers(); return; }
        var data = await _fetchSjekLinije(force);
        _sjekServerLinije = (data && data.linije) || [];
        _drawSjekLinije();
        _renderStavke();
    }
    window.mapaRadnikaOsvjeziSjekackeLinije = function() {
        if (!_sjeceOdjelKey) { _notify('showWarning', 'Prvo izaberite odjel.'); return; }
        var st = document.getElementById('sjek-status');
        if (st) st.textContent = '⏳ Osvježavam...';
        _restoreSjekLinije(true).then(function() {
            if (st) st.textContent = _sjekVisible().length + ' linija za odjel ' + (_sjeceOdjelLabel || '');
        });
    };

    // ---- Red čekanja (offline) ----
    // Radnik farba u šumi bez signala — bez ovoga bi cjelodnevni rad nestao
    // (kao što se dešava kod submitSjeca, koji offline samo baci "Failed to
    // fetch"). Linija se UVIJEK prvo snimi lokalno, pa se šalje kad ima mreže.
    var _sjekDraining = false;
    async function _drainSjekQueue() {
        if (_sjekDraining || !navigator.onLine) return;
        var red = _loadSjekQueue();
        if (!red.length) return;
        _sjekDraining = true;
        var poslato = 0;
        try {
            while (red.length) {
                var stavka = red[0];
                var moje = _loadSjekMoje();
                var linija = null;
                for (var i = 0; i < moje.length; i++) { if (moje[i].uuid === stavka.uuid) { linija = moje[i]; break; } }
                if (!linija) { red.shift(); _saveSjekQueue(red); continue; } // ručno obrisana

                var rez = null;
                try {
                    var r = await fetch(buildApiUrl('add-sjekacka-linija'), {
                        method: 'POST',
                        // text/plain => JEDNOSTAVAN zahtjev, bez CORS preflighta
                        // (doOptions u Apps Scriptu je no-op i ne bi ga preživio).
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            uuid: linija.uuid, odjelKey: linija.odjelKey,
                            odjelLabel: linija.odjelLabel, brojLinije: linija.brojLinije,
                            naziv: linija.naziv, kreirano: linija.kreirano, points: linija.points
                        })
                    });
                    rez = await r.json();
                } catch (e) {
                    // Mreža pukla — red OSTAJE netaknut, pokušaćemo kasnije.
                    stavka.tries = (stavka.tries || 0) + 1;
                    stavka.lastErr = String((e && e.message) || e);
                    stavka.lastTry = Date.now();
                    _saveSjekQueue(red);
                    break;
                }
                if (rez && rez.success) {
                    _sjekMarkSynced(linija.uuid, rez);
                    poslato++;
                    red.shift(); _saveSjekQueue(red);
                } else {
                    // Server je ODGOVORIO ali odbio (validacija/ovlaštenje) —
                    // ponavljanje nikad neće uspjeti, pa ne blokiramo red zauvijek.
                    var greska = (rez && rez.error) || 'Nepoznata greška';
                    if (String(greska).indexOf('Unknown path') !== -1) {
                        _notify('showWarning', 'Server još nema podršku za ofarbane linije',
                            'Administrator treba napraviti novo izdanje (deployment). Linija je sačuvana i poslaće se kasnije.');
                        break; // ovo NIJE greška linije — ostavi u redu za poslije
                    }
                    _sjekMarkError(linija.uuid, greska);
                    red.shift(); _saveSjekQueue(red);
                }
            }
        } finally {
            _sjekDraining = false;
        }
        if (poslato) {
            _notify('showSuccess', 'Ofarbane linije poslane', poslato + ' linija je stiglo na server.');
            _restoreSjekLinije(true);
        } else {
            _drawSjekLinije();
            _renderStavke();
        }
    }

    // ---- Auto-detekcija odjela iz GPS-a ----
    // Radnik već stoji u odjelu — nema razloga da ga traži klikom po mapi.
    // Koristi isti even-odd test (_pointInRings) kao generisanje linija.
    window.mapaRadnikaSjeceOdjelPoLokaciji = function() {
        if (!navigator.geolocation) { _notify('showError', 'Vaš uređaj ne podržava geolokaciju.'); return; }
        if (!_geojson) { _notify('showWarning', 'Karta odjela još nije učitana.'); return; }
        var st = document.getElementById('sjek-status');
        if (st) st.textContent = '⏳ Tražim lokaciju...';
        navigator.geolocation.getCurrentPosition(function(pos) {
            var lat = pos.coords.latitude, lng = pos.coords.longitude;
            var nadjen = null;
            for (var i = 0; i < _geojson.features.length && !nadjen; i++) {
                var f = _geojson.features[i];
                var k = _featureKeys(f);
                var collected = _collectOdjelRingsXY(k.lk);
                if (!collected) continue;
                var p = _toLocalXY(lat, lng, collected.lat0, collected.lng0);
                if (_pointInRings(p, collected.ringsXY)) {
                    nadjen = { key: k.lk, label: String((f.properties || {}).odjel || (f.properties || {}).name || k.lk) };
                }
            }
            if (!nadjen) {
                if (st) st.textContent = '';
                _notify('showWarning', 'Niste unutar nijednog odjela', 'Izaberite odjel ručno klikom na mapu.');
                return;
            }
            _sjeceOdjelKey = nadjen.key;
            _sjeceOdjelLabel = nadjen.label;
            _updateSjecePanel();
            if (st) st.textContent = '📍 Odjel ' + nadjen.label;
            _restoreSjekLinije(true);
        }, function() {
            if (st) st.textContent = '';
            _notify('showError', 'Nije moguće dobiti trenutnu lokaciju.');
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
    };

    // Nađi broj plan-linije najbliže datoj tački (radnici govore "linija 5").
    function _najblizaPlanLinija(ll) {
        if (!_sjeceLines.length) return '';
        var najbolji = '', najD = Infinity;
        _sjeceLines.forEach(function(line) {
            (line.segments || []).forEach(function(seg) {
                seg.forEach(function(p) {
                    var d = _distM([ll[0], ll[1]], [p.lat, p.lng]);
                    if (d < najD) { najD = d; najbolji = line.index; }
                });
            });
        });
        return najD < 60 ? najbolji : ''; // dalje od 60 m — ne nagađaj
    }

    // ---- Modal za naziv, pa snimanje ----
    window.mapaRadnikaStartSjekackoSnimanje = function() {
        if (_recording) {
            _notify('showWarning', 'Snimanje traga je u toku', 'Prvo završite snimanje traga.');
            return;
        }
        if (_sjekRecording) { _notify('showWarning', 'Snimanje linije je već u toku.'); return; }
        if (!_sjeceOdjelKey) { _notify('showWarning', 'Prvo izaberite odjel.'); return; }
        if (!navigator.geolocation) { _notify('showError', 'Vaš uređaj ne podržava geolokaciju.'); return; }
        window.mapaRadnikaCloseSjecePanel();
        var modal = document.getElementById('sjek-name-modal');
        var input = document.getElementById('sjek-name-input');
        var broj  = document.getElementById('sjek-broj-linije-input');
        var datum = document.getElementById('sjek-datum-prikaz');
        var sada = new Date();
        var podrazumijevano = 'Odjel ' + (_sjeceOdjelLabel || '?') + ' ' +
            sada.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });
        if (!modal || !input) { _sjekPendingNaziv = podrazumijevano; _sjekPendingBroj = ''; _startSjek(); return; }
        input.value = podrazumijevano;
        if (broj) broj.value = '';
        if (datum) datum.textContent = '📅 ' + sada.toLocaleString('bs-BA') + ' · odjel ' + (_sjeceOdjelLabel || '?');
        modal.classList.add('show');
        setTimeout(function() { input.focus(); input.select(); }, 50);
    };
    window.closeSjekNameModal = function() {
        var modal = document.getElementById('sjek-name-modal');
        if (modal) modal.classList.remove('show');
    };
    window.confirmStartSjek = function() {
        var input = document.getElementById('sjek-name-input');
        var broj  = document.getElementById('sjek-broj-linije-input');
        _sjekPendingNaziv = (input && input.value.trim()) || ('Odjel ' + (_sjeceOdjelLabel || '?'));
        _sjekPendingBroj = (broj && broj.value.trim()) || '';
        window.closeSjekNameModal();
        _startSjek();
    };

    function _startSjek() {
        _sjekPoints = [];
        _sjekUuid = _sjekUuidNovi();
        _sjekStartIso = new Date().toISOString();
        _sjekOdbaceno = 0;
        _sjekZadnjaAcc = null;
        if (_sjekDrawLayer) { _map.removeLayer(_sjekDrawLayer); _sjekDrawLayer = null; }
        _gpsSubscribe('sjekacka', _onSjekPosition, _handleSjekGpsError);
        _sjekRecording = true;
        _sjekPaused = false;
        _sjekActiveMs = 0;
        _sjekSegmentStartTs = Date.now();
        _hideTragoviMenu();
        _openTragRecordingModal();
        _setRecBarLabel('🎨 Odjel ' + (_sjeceOdjelLabel || '?'));
        _recWakeLockOn();
    }

    function _onSjekPosition(pos) {
        _updateLocDisplay(pos);
        var acc = pos.coords.accuracy;
        _sjekZadnjaAcc = (typeof acc === 'number') ? Math.round(acc) : null;
        // Loš fix bi iskrivio geometriju linije — odbaci ga, ali PRIKAŽI
        // preciznost u traci snimanja da radnik zna zašto tačke ne rastu
        // (pod gustom krošnjom to zna trajati). Tiho odbacivanje bi izgledalo
        // kao da aplikacija ne radi.
        if (typeof acc === 'number' && acc > SJEK_MAX_ACC_M) { _sjekOdbaceno++; return; }
        var ll = [pos.coords.latitude, pos.coords.longitude];
        var now = Date.now();
        var last = _sjekPoints[_sjekPoints.length - 1];
        if (last) {
            var moved = _distM(last.ll, ll);
            var elapsed = now - last.t;
            if (moved < SJEK_MIN_DIST_M && elapsed < SJEK_HEARTBEAT_MS) return;
        }
        _sjekPoints.push({ ll: ll, t: now, acc: _sjekZadnjaAcc });
        var latlngs = _sjekPoints.map(function(p) { return p.ll; });
        if (!_sjekDrawLayer) {
            _sjekDrawLayer = L.polyline(latlngs, { color: '#16a34a', weight: 5, opacity: 0.9 }).addTo(_map);
        } else {
            _sjekDrawLayer.setLatLngs(latlngs);
        }
    }

    // NAMJERNO drugačije od _handleTragGpsError: snimljene tačke se NE BACAJU.
    // Greška GPS-a (izgubljen signal pod krošnjama, povučena dozvola) samo
    // PAUZIRA snimanje; sve ofarbano do tog trenutka ostaje i radnik može
    // odmah pritisnuti "Završi" i sačuvati liniju.
    function _handleSjekGpsError(err) {
        console.error('[MapaRadnika] GPS greška pri snimanju ofarbane linije:', err);
        if (!_sjekRecording || _sjekPaused) return;
        _gpsUnsubscribe('sjekacka');
        _sjekActiveMs += Date.now() - _sjekSegmentStartTs;
        _sjekPaused = true;
        var btn = document.getElementById('trag-recording-pause-btn');
        var rec = document.getElementById('trag-recording-bar');
        if (btn) btn.textContent = '▶️ Nastavi';
        if (rec) rec.classList.add('paused');
        _notify('showWarning', 'GPS prekinut', err && err.code === 1
            ? 'Pristup lokaciji je odbijen — snimanje je pauzirano. Snimljeno do sada je sačuvano; možete odmah pritisnuti "Završi".'
            : 'Izgubljen GPS signal — snimanje je pauzirano. Snimljeno do sada je sačuvano.');
    }

    function _pauseResumeSjek() {
        if (!_sjekRecording) return;
        var btn = document.getElementById('trag-recording-pause-btn');
        var rec = document.getElementById('trag-recording-bar');
        if (!_sjekPaused) {
            _gpsUnsubscribe('sjekacka');
            _sjekActiveMs += Date.now() - _sjekSegmentStartTs;
            _sjekPaused = true;
            if (btn) btn.textContent = '▶️ Nastavi';
            if (rec) rec.classList.add('paused');
        } else {
            _sjekSegmentStartTs = Date.now();
            _gpsSubscribe('sjekacka', _onSjekPosition, _handleSjekGpsError);
            _sjekPaused = false;
            if (btn) btn.textContent = '⏸️ Pauza';
            if (rec) rec.classList.remove('paused');
        }
        _updateTragModalStats();
    }

    function _finishSjek() {
        if (!_sjekRecording) return;
        if (!_sjekPaused) _sjekActiveMs += Date.now() - _sjekSegmentStartTs;
        _gpsUnsubscribe('sjekacka');
        _sjekRecording = false;
        _sjekPaused = false;
        _closeTragRecordingModal();
        _recWakeLockOff();
        if (_sjekDrawLayer) { _map.removeLayer(_sjekDrawLayer); _sjekDrawLayer = null; }

        var latlngs = _sjekPoints.map(function(p) { return p.ll; });
        if (latlngs.length < 2) {
            _notify('showWarning', 'Linija nije sačuvana',
                'Snimljeno je manje od 2 upotrebljive tačke' +
                (_sjekOdbaceno ? ' (' + _sjekOdbaceno + ' fixova odbačeno zbog slabog GPS signala).' : '.'));
            _sjekPoints = [];
            return;
        }

        var pack = _sjekPackPoints(latlngs);
        if (!pack) { _notify('showError', 'Greška pri obradi linije.'); _sjekPoints = []; return; }

        // Provjera da linija stvarno leži u izabranom odjelu — odjel se bira
        // PRIJE snimanja, pa se lako desi da je ostao stari izbor.
        var sredina = latlngs[Math.floor(latlngs.length / 2)];
        var collected = _collectOdjelRingsXY(_sjeceOdjelKey);
        var vanOdjela = false;
        if (collected) {
            var p = _toLocalXY(sredina[0], sredina[1], collected.lat0, collected.lng0);
            vanOdjela = !_pointInRings(p, collected.ringsXY);
        }

        var spremi = function() {
            var duzina = 0;
            for (var i = 1; i < pack.points.length; i++) duzina += _distM(pack.points[i - 1], pack.points[i]);
            var ja = _currentUserObj();
            var linija = {
                uuid: _sjekUuid,
                odjelKey: _sjeceOdjelKey,
                odjelLabel: _sjeceOdjelLabel || '',
                brojLinije: _sjekPendingBroj,
                korisnik: ja.username || '',
                radnik: ja.fullName || ja.username || '',
                naziv: _sjekPendingNaziv || 'Ofarbana linija',
                kreirano: _sjekStartIso || new Date().toISOString(),
                points: pack.points,
                duzinaM: Math.round(duzina),
                pendingSync: true
            };
            var moje = _loadSjekMoje();
            moje.push(linija);
            _saveSjekMoje(moje);
            var red = _loadSjekQueue();
            red.push({ uuid: linija.uuid, tries: 0 });
            _saveSjekQueue(red);
            _sjekPoints = [];
            _drawSjekLinije();
            _renderStavke();
            _notify('showSuccess', 'Linija snimljena',
                pack.points.length + ' tačaka · ' + _fmtDistanceM(duzina) +
                (navigator.onLine ? ' · šaljem na server...' : ' · čeka mrežu za slanje'));
            _drainSjekQueue();
        };

        if (vanOdjela) {
            _showTragConfirm(
                'Linija izgleda da je VAN odjela ' + (_sjeceOdjelLabel || '?') +
                '. Je li odjel dobro izabran? Sačuvati ipak?',
                spremi, { title: '⚠️ Provjera odjela', confirmLabel: 'Sačuvaj ipak' }
            );
        } else {
            spremi();
        }
    }

    // Ekran se gasi => GPS staje. Progresivno: gdje postoji Wake Lock API,
    // drži ekran budnim dok traje snimanje. Dijeljeno između OBA snimanja
    // (obični trag i ofarbana sjekačka linija, vidi _recAktivno) — nikad oba
    // istovremeno (_toggleTrag odbija drugo dok je jedno u toku), pa je jedan
    // dijeljen wake lock siguran.
    var _recWakeLock = null;
    function _recWakeLockOn() {
        try {
            if (navigator.wakeLock && navigator.wakeLock.request) {
                navigator.wakeLock.request('screen').then(function(wl) { _recWakeLock = wl; }).catch(function() {});
            }
        } catch (_) {}
    }
    function _recWakeLockOff() {
        try { if (_recWakeLock) { _recWakeLock.release(); _recWakeLock = null; } } catch (_) {}
    }

    window.mapaRadnikaDeleteOfarbana = function(index) {
        var l = _sjekVisible()[index];
        if (!l) return;
        if (_map) _map.closePopup();
        if (!l.mine) { _notify('showWarning', 'Liniju može obrisati samo radnik koji ju je snimio.'); return; }
        if (l.pendingSync) {
            // Još nije na serveru — briše se samo lokalno, zajedno iz reda čekanja.
            _showTragConfirm('Obrisati liniju "' + (l.naziv || 'Ofarbana linija') + '" (još nije poslana)?', function() {
                _saveSjekMoje(_loadSjekMoje().filter(function(x) { return x.uuid !== l.uuid; }));
                _saveSjekQueue(_loadSjekQueue().filter(function(x) { return x.uuid !== l.uuid; }));
                _drawSjekLinije();
                _renderStavke();
            });
            return;
        }
        if (!navigator.onLine) { _notify('showWarning', 'Brisanje zahtijeva internet konekciju.'); return; }
        _showTragConfirm('Obrisati liniju "' + (l.naziv || 'Ofarbana linija') + '"? Nestaće i kod ostalih radnika.', function() {
            fetch(buildApiUrl('delete-sjekacka-linija', { uuid: l.uuid }), { signal: AbortSignal.timeout(30000) })
                .then(function(r) { return r.json(); })
                .then(function(rez) {
                    if (rez && rez.success) {
                        _saveSjekMoje(_loadSjekMoje().filter(function(x) { return x.uuid !== l.uuid; }));
                        _notify('showSuccess', 'Linija obrisana');
                        _restoreSjekLinije(true);
                    } else {
                        _notify('showError', 'Brisanje nije uspjelo', (rez && rez.error) || '');
                    }
                })
                .catch(function() { _notify('showError', 'Brisanje nije uspjelo — provjerite konekciju.'); });
        });
    };

    window.mapaRadnikaShareOfarbana = function(index) {
        var l = _sjekVisible()[index];
        if (!l || !l.points || l.points.length < 2) { _notify('showWarning', 'Linija nema dovoljno tačaka za izvoz.'); return; }
        var naziv = l.naziv || 'Ofarbana linija';
        _shareOrDownloadGpx(_safeFileName(naziv) + '.gpx', _gpxDoc(_gpxTrk(naziv, l.points, l.kreirano), naziv), naziv);
    };

    // ---- IZMJERI — udaljenost / površina ----
    // Oba mjerenja rade OFFLINE (čista geometrija nad kliknutim tačkama, bez
    // ijednog mrežnog poziva). Rezultat se crta na mapi, klikabilan je i otvara
    // popup sa detaljima, i pamti se po korisniku (localStorage) kao i
    // tragovi/tačke/površine.
    var MJERENJE_BOJE = { udaljenost: '#0891b2', povrsina: '#7c3aed' };
    var _mjerenjeMode = null;      // null | 'udaljenost' | 'povrsina'
    var _mjerenjePoints = [];      // [[lat,lng], ...] u toku mjerenja
    var _mjerenjeDrawLayer = null; // privremeni sloj dok se klika
    var _mjerenjeLayers = [];      // sačuvana mjerenja na mapi

    function _mjerenjeStorageKey() {
        return 'mapa_radnika_mjerenja_' + (_currentUserObj().username || 'anon');
    }
    function _loadSavedMjerenja() {
        try {
            var raw = localStorage.getItem(_mjerenjeStorageKey());
            var list = raw ? JSON.parse(raw) : [];
            // "Nagib" je uklonjen — odbaci eventualne zaostale zapise da ne
            // pucaju pri iscrtavanju (nema više koda koji ih zna prikazati).
            return list.filter(function(m) { return m && m.tip !== 'nagib'; });
        } catch (_) { return []; }
    }
    function _saveMjerenja(list) {
        try { localStorage.setItem(_mjerenjeStorageKey(), JSON.stringify(list)); } catch (_) {}
    }
    function _polyLengthM(points) {
        var d = 0;
        for (var i = 1; i < points.length; i++) d += _distM(points[i - 1], points[i]);
        return d;
    }
    function _fmtDuzina(m) {
        return m < 1000 ? (Math.round(m * 10) / 10) + ' m' : (m / 1000).toFixed(2) + ' km';
    }

    function _mjerenjePanelEl() { return document.getElementById('radnik-mapa-mjerenje-panel'); }
    window.mapaRadnikaOpenMjerenje = function() {
        _hideTragoviMenu();
        if (typeof window.mapaRadnikaCancelRoutePick === 'function') window.mapaRadnikaCancelRoutePick();
        if (typeof window.mapaRadnikaCancelPoligon === 'function') window.mapaRadnikaCancelPoligon();
        if (typeof window.mapaRadnikaCancelTacka === 'function') window.mapaRadnikaCancelTacka();
        if (typeof window.mapaRadnikaStopExplorer === 'function') window.mapaRadnikaStopExplorer();
        if (typeof window.mapaRadnikaCloseSjecePanel === 'function') window.mapaRadnikaCloseSjecePanel();
        if (typeof window.mapaRadnikaCancelIzvrsenoPoligon === 'function') window.mapaRadnikaCancelIzvrsenoPoligon();
        var panel = _mjerenjePanelEl();
        if (panel) panel.classList.remove('hidden');
        // Izbor "crtaj sa centra" se pamti između sesija — uskladi kvačicu.
        var cb = document.getElementById('radnik-mapa-mjerenje-centar');
        if (cb) cb.checked = _mjerenjeCentar;
    };
    window.mapaRadnikaCloseMjerenjePanel = function() {
        window.mapaRadnikaCancelMjerenje();
        var panel = _mjerenjePanelEl();
        if (panel) panel.classList.add('hidden');
    };
    // ---- "Crtaj sa centra ekrana" (nišan) ----
    // Na telefonu prst prekrije baš ono mjesto na koje se tapa, pa je precizno
    // obilježavanje ugla parcele teško — posebno kod mjerenja površine gdje
    // svaka tačka pomjerena par metara mijenja rezultat. U ovom modu tačka se
    // uzima iz CENTRA ekrana: radnik pomjeri mapu da nišan legne na ugao i
    // pritisne "Dodaj". Isti obrazac koji već koristi biranje Tačke, pa se
    // dijeli i isti nišan element (#radnik-mapa-tacka-crosshair) — ta dva moda
    // se ionako međusobno isključuju.
    var MJERENJE_CENTAR_KEY = 'mapa_radnika_mjerenje_centar';
    var _mjerenjeCentar = (function() {
        try { return localStorage.getItem(MJERENJE_CENTAR_KEY) === '1'; } catch (_) { return false; }
    })();
    // Pomjeranje mape SAMO po sebi dodaje tačku — radnik drži nišan na granici i
    // "vuče" mapu duž nje umjesto da pritiska dugme na svakom uglu. Prag je u
    // PIKSELIMA (ne metrima) jer mjeri stvarnu namjeru korisnika jednako na
    // svakom zoomu: sitno podrhtavanje prsta ne pravi tačku, svjestan pomak da.
    var MJERENJE_AUTO_MIN_PX = 24;
    function _onMjerenjeMoveEnd() {
        if (!_mjerenjeMode || !_mjerenjeCentar || !_map) return;
        var c = _map.getCenter();
        var last = _mjerenjePoints[_mjerenjePoints.length - 1];
        if (last) {
            var p1 = _map.latLngToContainerPoint(L.latLng(last[0], last[1]));
            var p2 = _map.latLngToContainerPoint(c);
            if (p1.distanceTo(p2) < MJERENJE_AUTO_MIN_PX) return;
        }
        _mjerenjePoints.push([c.lat, c.lng]);
        _redrawMjerenjeDraw();
        _updateMjerenjeHint();
    }
    function _bindMjerenjeAuto(on) {
        if (!_map) return;
        _map.off('moveend', _onMjerenjeMoveEnd); // nikad dvaput vezano
        if (on) _map.on('moveend', _onMjerenjeMoveEnd);
    }
    window.mapaRadnikaToggleMjerenjeCentar = function(on) {
        _mjerenjeCentar = !!on;
        try { localStorage.setItem(MJERENJE_CENTAR_KEY, _mjerenjeCentar ? '1' : '0'); } catch (_) {}
        // Prekidač radi i usred crtanja (traka-savjet ima isti checkbox), da se
        // može prebaciti na tapkanje bez gubljenja već postavljenih tačaka.
        if (_mjerenjeMode) {
            if (_mjerenjeCentar) _showTackaCrosshair(); else _hideTackaCrosshair();
            _bindMjerenjeAuto(_mjerenjeCentar);
            _updateMjerenjeHint();
        }
    };
    window.mapaRadnikaAddMjerenjeCenterPoint = function() {
        if (!_mjerenjeMode || !_map) return;
        var c = _map.getCenter();
        _mjerenjePoints.push([c.lat, c.lng]);
        _redrawMjerenjeDraw();
        _updateMjerenjeHint();
    };

    window.mapaRadnikaStartMjerenje = function(mode) {
        _mjerenjeMode = mode;
        _mjerenjePoints = [];
        _redrawMjerenjeDraw();
        // Panel se sklanja dok se klika po mapi — stoji na istom mjestu kao
        // traka-savjet (i iznad nje po z-indexu) pa bi prekrio uputu.
        var panel = _mjerenjePanelEl();
        if (panel) panel.classList.add('hidden');
        if (_mjerenjeCentar) _showTackaCrosshair();
        _bindMjerenjeAuto(_mjerenjeCentar);
        _updateMjerenjeHint();
    };
    window.mapaRadnikaCancelMjerenje = function() {
        _mjerenjeMode = null;
        _mjerenjePoints = [];
        if (_mjerenjeDrawLayer) { _map.removeLayer(_mjerenjeDrawLayer); _mjerenjeDrawLayer = null; }
        _bindMjerenjeAuto(false);
        _hideTackaCrosshair();
        _hideRouteHint();
    };
    window.mapaRadnikaUndoMjerenjePoint = function() {
        if (!_mjerenjeMode || !_mjerenjePoints.length) return;
        _mjerenjePoints.pop();
        _redrawMjerenjeDraw();
        _updateMjerenjeHint();
    };
    function _mjerenjeMinPoints() { return _mjerenjeMode === 'povrsina' ? 3 : 2; }
    function _updateMjerenjeHint() {
        if (!_mjerenjeMode) return;
        var n = _mjerenjePoints.length;
        var min = _mjerenjeMinPoints();
        var naziv = _mjerenjeMode === 'udaljenost' ? '📏 Udaljenost' : '🔷 Površina';
        var info = '';
        if (_mjerenjeMode === 'udaljenost' && n >= 2) info = ' — ' + _fmtDuzina(_polyLengthM(_mjerenjePoints));
        else if (_mjerenjeMode === 'povrsina' && n >= 3) info = ' — ' + _fmtPovrsina(_polygonAreaM2(_mjerenjePoints));
        var moze = n >= min;
        _showRouteHint(
            '<span>' + naziv + ' (' + n + (moze ? ', spremno' : ', treba još') + ')' + info +
            '<br><label style="display:inline-flex;align-items:center;gap:5px;font-size:11px;opacity:.85;cursor:pointer;">' +
            '<input type="checkbox" style="width:14px;height:14px;margin:0;cursor:pointer;"' +
            (_mjerenjeCentar ? ' checked' : '') +
            ' onchange="mapaRadnikaToggleMjerenjeCentar(this.checked)" />' +
            (_mjerenjeCentar ? 'Vučite mapu — crta samo' : 'Crtaj sa centra ekrana') + '</label></span>' +
            '<span style="display:flex;gap:6px;">' +
            (_mjerenjeCentar ? '<button type="button" onclick="mapaRadnikaAddMjerenjeCenterPoint()">➕ Dodaj</button>' : '') +
            (n > 0 ? '<button type="button" onclick="mapaRadnikaUndoMjerenjePoint()">↩️</button>' : '') +
            (moze ? '<button type="button" onclick="mapaRadnikaFinishMjerenje()">✅ Završi</button>' : '') +
            '<button type="button" onclick="mapaRadnikaCancelMjerenje()">✕</button>' +
            '</span>'
        );
    }
    function _redrawMjerenjeDraw() {
        if (_mjerenjeDrawLayer) { _map.removeLayer(_mjerenjeDrawLayer); _mjerenjeDrawLayer = null; }
        if (!_mjerenjePoints.length) return;
        var boja = MJERENJE_BOJE[_mjerenjeMode] || '#0891b2';
        if (_mjerenjePoints.length === 1) {
            _mjerenjeDrawLayer = L.circleMarker(_mjerenjePoints[0], { radius: 6, color: boja, fillColor: boja, fillOpacity: 0.9 }).addTo(_map);
            return;
        }
        _mjerenjeDrawLayer = _mjerenjeMode === 'povrsina'
            ? L.polygon(_mjerenjePoints, { color: boja, weight: 3, fillColor: boja, fillOpacity: 0.2, dashArray: '6 4' }).addTo(_map)
            : L.polyline(_mjerenjePoints, { color: boja, weight: 4, dashArray: '8 5' }).addTo(_map);
    }
    // Poziva se iz istog centralnog lanca klika kao ostali pick-modovi.
    function _handleMjerenjeClick(latlng) {
        if (!_mjerenjeMode) return false;
        // U nišan-modu se tačke dodaju ISKLJUČIVO dugmetom "➕ Dodaj" — tap po
        // mapi se i dalje "pojede" (da se ne otvori popup odjela ispod), ali ne
        // dodaje tačku: slučajni tap pri namještanju mape je upravo problem koji
        // ovaj mod rješava.
        if (_mjerenjeCentar) return true;
        _mjerenjePoints.push([latlng.lat, latlng.lng]);
        _redrawMjerenjeDraw();
        _updateMjerenjeHint();
        return true;
    }
    window.mapaRadnikaFinishMjerenje = function() {
        if (!_mjerenjeMode || _mjerenjePoints.length < _mjerenjeMinPoints()) return;
        var m = {
            tip: _mjerenjeMode,
            created: new Date().toISOString(),
            points: _mjerenjePoints.slice()
        };
        if (_mjerenjeMode === 'udaljenost') m.duzina = _polyLengthM(_mjerenjePoints);
        else m.povrsina = _polygonAreaM2(_mjerenjePoints);
        _commitMjerenje(m);
    };
    function _commitMjerenje(m) {
        var list = _loadSavedMjerenja();
        list.push(m);
        _saveMjerenja(list);
        window.mapaRadnikaCancelMjerenje();
        _drawSavedMjerenja();
        _renderMjerenjaList();
        var sazetak = m.tip === 'udaljenost' ? _fmtDuzina(m.duzina) : _fmtPovrsina(m.povrsina);
        _notify('showSuccess', 'Mjerenje sačuvano', sazetak);
    }
    // ---- Iscrtavanje sačuvanih mjerenja (klikabilna, sa info popup-om) ----
    function _mjerenjeOpis(m) {
        if (m.tip === 'udaljenost') {
            return 'Dužina: <strong>' + _fmtDuzina(m.duzina) + '</strong><br>Tačaka: ' + (m.points || []).length;
        }
        return 'Površina: <strong>' + _fmtPovrsina(m.povrsina) + '</strong><br>' +
            'Obim: ' + _fmtDuzina(_polyLengthM((m.points || []).concat([m.points[0]]))) + '<br>' +
            'Tačaka: ' + (m.points || []).length;
    }
    function _mjerenjeKratko(m) {
        return m.tip === 'udaljenost' ? ('📏 ' + _fmtDuzina(m.duzina)) : ('🔷 ' + _fmtPovrsina(m.povrsina));
    }
    function _drawSavedMjerenja() {
        _mjerenjeLayers.forEach(function(l) { _map.removeLayer(l); });
        _mjerenjeLayers = [];
        _loadSavedMjerenja().forEach(function(m, i) {
            if (!m.points || m.points.length < 2) return;
            var boja = MJERENJE_BOJE[m.tip] || '#0891b2';
            var lyr = m.tip === 'povrsina'
                ? L.polygon(m.points, { color: boja, weight: 3, fillColor: boja, fillOpacity: 0.2 })
                : L.polyline(m.points, { color: boja, weight: 4 });
            lyr.addTo(_map);
            lyr.bindTooltip(_mjerenjeKratko(m), { sticky: true });
            lyr.bindPopup(
                '<div class="rm-tacka-popup">' +
                '<div class="rm-tacka-popup-title">' + _mjerenjeKratko(m) + '</div>' +
                '<div style="font-size:12px;color:#4b5563;margin-bottom:8px;line-height:1.5;">' +
                _mjerenjeOpis(m) +
                (m.created ? '<br><span style="color:#9ca3af;">' + new Date(m.created).toLocaleString('bs-BA') + '</span>' : '') +
                '</div>' +
                '<button type="button" class="rm-tacka-popup-delete" onclick="mapaRadnikaDeleteMjerenje(' + i + ')">🗑️ Obriši</button>' +
                '</div>'
            );
            _bindStavkaPopupClick(lyr);
            _mjerenjeLayers.push(lyr);
        });
        _bringUserLayersToFront();
    }
    window.mapaRadnikaDeleteMjerenje = function(index) {
        var list = _loadSavedMjerenja();
        var m = list[index];
        if (!m) return;
        if (_map) _map.closePopup();
        _showTragConfirm('Obrisati mjerenje "' + _mjerenjeKratko(m).replace(/<[^>]*>/g, '') + '"?', function() {
            var fresh = _loadSavedMjerenja();
            fresh.splice(index, 1);
            _saveMjerenja(fresh);
            _drawSavedMjerenja();
            _renderMjerenjaList();
        });
    };
    function _renderMjerenjaList() { return _renderStavke(); }
    window.mapaRadnikaZoomMjerenje = function(index) {
        var lyr = _mjerenjeLayers[index];
        if (!lyr || !_map) return;
        _hideTragoviMenu();
        try {
            _map.fitBounds(lyr.getBounds(), { padding: [40, 40], maxZoom: 17 });
            lyr.openPopup();
        } catch (_) {}
    };

    // ---- MOJA LOKACIJA (GPS) ----
    // Ikonica lokacije — plava tačka. Klik na nju uključuje/isključuje
    // "smjer gledanja" (vidi _toggleHeadingView ispod) — konus vidnog polja
    // (kao svjetiljka/radar), ne linija — korisnik je poslao referentni
    // screenshot druge terenske aplikacije s tačno ovakvim prikazom.
    function _locIconHtml() {
        return '<div class="rm-loc-wrap"><div class="rm-loc-dot"></div></div>';
    }

    // Iscrtava/ažurira plavu tačku "moja lokacija".
    function _updateLocDisplay(pos) {
        var ll = [pos.coords.latitude, pos.coords.longitude];
        // POMJERI postojeći marker umjesto da ga rušiš i praviš novog. Ranije se
        // na SVAKI GPS fix (watchPosition ume javljati i svake sekunde) brisao
        // Leaflet marker pa se pravio novi — plava tačka je vidljivo treperila,
        // a click handler se iznova registrovao 60 puta u minuti.
        if (_locMarker) {
            _locMarker.setLatLng(ll);
        } else {
            _locMarker = L.marker(ll, {
                icon: L.divIcon({ className: 'rm-loc-icon', html: _locIconHtml(), iconSize: [40, 40], iconAnchor: [20, 20] }),
                interactive: true,
                keyboard: false
            }).on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                _toggleHeadingView();
            }).addTo(_map);
        }
        _headingLastLL = ll;
        // Lokacija se pomjerila (npr. "Prati me") — pomjeri i konus smjera
        // gledanja s njom, na zadnjem poznatom azimutu, bez čekanja na sljedeći
        // kompas event (koji na nekim uređajima stiže rjeđe od GPS fix-a).
        if (_headingActive && _headingLastDeg != null) _drawHeadingCone(_headingLastDeg);
        return ll;
    }

    // ---- SMJER GLEDANJA — plavi prozirni konus (vidno polje) od "moja
    // lokacija" u pravcu u kojem je telefon okrenut (device orientation
    // kompas), crtan na Leaflet Canvas rendereru (ne SVG) — isti obrazac
    // kompasa kao kod azimuta za sječačke linije/Explorer, ali OVDJE
    // kontinuirano (konus se okreće uživo dok se korisnik okreće), ne
    // jednokratno hvatanje. Poligon (apeks + tačke po luku) umjesto
    // pravog SVG/canvas kruga jer Leaflet nema ugrađen "sector" oblik.
    // Renderer je vezan za 'rmHeadingPane' (kreiran pri inicijalizaciji
    // mape, iznad overlayPane-a) — NAMJERNO se NE dodaje u
    // _bringUserLayersToFront(): taj sloj radi bringToFront() unutar
    // JEDNOG deljenog SVG renderera, a konus ima svoj vlastiti canvas
    // (sibling DOM element) — bringToFront preko te granice ne djeluje,
    // pa bi bio mrtav kod. Pane z-index je jedini pouzdan način da konus
    // ostane iznad odjel poligona bez obzira na redosljed redraw-a. ----
    var HEADING_CONE_ANGLE_DEG = 70;  // ukupan otvor konusa (±35° od azimuta)
    var HEADING_CONE_STEP_DEG = 5;    // gustina tačaka po luku — glađi rub
    var _headingCanvasRenderer = null; // jedan dijeljen L.canvas() renderer za konus
    // Konus je geografski sidren (stvarni metri) — na manjem zumu ista dužina
    // pokriva manje piksela i postaje sitna (isti problem kao kod tačaka, vidi
    // _tackaRadiusForZoom). Radijus u metrima raste diskretno kako se zumira
    // dalje, da konus ostane čitljiv na ekranu; rast je ograničen (cap na zumu
    // ≤12) da ne postane apsurdno velik na jako odzumiranoj karti.
    function _headingConeRadiusM() {
        var z = _map ? _map.getZoom() : 16;
        if (z >= 16) return 70;
        if (z === 15) return 140;
        if (z === 14) return 280;
        if (z === 13) return 450;
        return 700;
    }
    function _headingPointAt(ll, deg, radiusM) {
        var rad = deg * Math.PI / 180;
        var dx = radiusM * Math.sin(rad);
        var dy = radiusM * Math.cos(rad);
        var p = _fromLocalXY(dx, dy, ll[0], ll[1]);
        return [p.lat, p.lng];
    }
    // Apeks (korisnikova lokacija) + niz tačaka duž luka od (azimut-pola ugla)
    // do (azimut+pola ugla) — Leaflet L.polygon sam zatvara oblik nazad na
    // apeks, pa je rezultat pravi "pie slice"/konus.
    function _headingConeLatLngs(ll, deg) {
        var half = HEADING_CONE_ANGLE_DEG / 2;
        var radiusM = _headingConeRadiusM();
        var tacke = [ll];
        for (var a = -half; a <= half + 0.001; a += HEADING_CONE_STEP_DEG) {
            tacke.push(_headingPointAt(ll, deg + a, radiusM));
        }
        return tacke;
    }
    function _drawHeadingCone(deg) {
        if (!_map || !_headingLastLL) return;
        _headingLastDeg = deg;
        var latlngs = _headingConeLatLngs(_headingLastLL, deg);
        if (_headingCone) {
            _headingCone.setLatLngs(latlngs);
        } else {
            if (!_headingCanvasRenderer) _headingCanvasRenderer = L.canvas({ pane: 'rmHeadingPane' });
            _headingCone = L.polygon(latlngs, {
                renderer: _headingCanvasRenderer,
                stroke: false,
                fillColor: '#3b82f6',
                fillOpacity: 0.38,
                interactive: false
            }).addTo(_map);
        }
    }
    function _removeHeadingCone() {
        if (_headingCone) { _map.removeLayer(_headingCone); _headingCone = null; }
    }
    // Magnetometar je bučan — sirov azimut zna "skakati" ±10-20° iz otkucaja
    // u otkucaj i kad je telefon potpuno miran. Dva sloja protiv toga:
    //   1) Eksponencijalno glačanje (nizak alpha = sporiji ali mirniji odziv)
    //      — posebna pažnja na kružni prelaz 360°→0° (bez ovoga bi glačanje
    //      na sjeveru "skretalo" kroz jug, jer bi npr. prosjek 350° i 10°
    //      naivno ispao 180°).
    //   2) Prag za PRECRTAVANJE — i glačana vrijednost i dalje polako "diše"
    //      za par stepeni iz otkucaja u otkucaj; bez praga bi se poligon i
    //      dalje neprestano redrawovao (svaki setLatLngs je repaint), što se
    //      oku vidi kao treperenje čak i kad je stvarna promjena zanemarljiva.
    //      Konus se pomjera samo kad se glačana vrijednost stvarno promijeni
    //      za više od praga — mirno stoji dok je telefon miran, i dalje prati
    //      stvarno okretanje bez primjetnog kašnjenja.
    var HEADING_SMOOTH_ALPHA = 0.08;
    var HEADING_REDRAW_THRESHOLD_DEG = 2.5;
    var _headingSmoothedDeg = null;
    var _headingDrawnDeg = null; // zadnji azimut koji je STVARNO nacrtan (za prag)
    function _smoothHeadingDeg(raw) {
        if (_headingSmoothedDeg == null) { _headingSmoothedDeg = raw; return raw; }
        var diff = ((raw - _headingSmoothedDeg + 540) % 360) - 180; // najkraća razlika, -180..180
        _headingSmoothedDeg = (_headingSmoothedDeg + HEADING_SMOOTH_ALPHA * diff + 360) % 360;
        return _headingSmoothedDeg;
    }
    function _headingOrientationHandler(e) {
        var heading = null;
        if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading; // iOS Safari — već tačan azimut
        else if (typeof e.alpha === 'number') heading = (360 - e.alpha) % 360; // Android — najbolja dostupna aproksimacija
        if (heading == null || isNaN(heading)) return;
        // Dio Android uređaja isporučuje OBA event-a za SVAKO fizičko
        // okretanje: 'deviceorientationabsolute' (azimut referentan prema
        // sjeveru) i 'deviceorientation' (azimut referentan prema
        // proizvoljnoj/relativnoj nula-tački, koja zna biti pomjerena za
        // desetine stepeni od apsolutne). Kad se obje vrijednosti miješaju u
        // isti glačajući filter, filter naizmjenično juri dva različita cilja
        // — konus "leti" bez obzira koliko se glačanje pojača, jer problem
        // nije šum nego dva različita signala. Čim se potvrdi da apsolutni
        // izvor stvarno isporučuje podatke, relativni ('deviceorientation'
        // bez apsolutne reference) se u potpunosti ignoriše.
        var isAbsoluteSource = (e.type === 'deviceorientationabsolute') || (e.absolute === true) || (typeof e.webkitCompassHeading === 'number');
        if (isAbsoluteSource) {
            _headingAbsoluteConfirmed = true;
        } else if (_headingAbsoluteConfirmed) {
            return; // apsolutni izvor radi — relativni bi samo kvario glačanje
        }
        var smoothed = _smoothHeadingDeg(heading);
        if (_headingDrawnDeg != null) {
            var drawDiff = Math.abs(((smoothed - _headingDrawnDeg + 540) % 360) - 180);
            if (drawDiff < HEADING_REDRAW_THRESHOLD_DEG) return; // premala promjena — preskoči repaint
        }
        _headingDrawnDeg = smoothed;
        _drawHeadingCone(smoothed);
    }
    function _stopHeadingView() {
        clearTimeout(_headingNoDataTimer);
        if (_headingListening) {
            window.removeEventListener('deviceorientationabsolute', _headingOrientationHandler);
            window.removeEventListener('deviceorientation', _headingOrientationHandler);
            _headingListening = false;
        }
        _headingActive = false;
        _headingLastDeg = null;
        _headingSmoothedDeg = null; // sljedeće uključivanje kreće svježe, ne od zastarjele vrijednosti
        _headingDrawnDeg = null;
        _headingAbsoluteConfirmed = false;
        _removeHeadingCone();
    }
    function _startHeadingView() {
        // Osluškuj OBA event-a istovremeno (ne biraj jedan preko
        // feature-detekcije) — na dijelu Android uređaja
        // 'ondeviceorientationabsolute' postoji u window (feature-detekcija
        // ispadne tačna), ali event nikad ne isporuči upotrebljiv alpha (null,
        // senzor nedostupan/nekalibrisan) — dok 'deviceorientation' i dalje
        // normalno radi. _headingOrientationHandler već ignoriše događaje bez
        // brojčanog alpha/webkitCompassHeading, pa je slušanje oba potpuno
        // bezopasno (koristi se prvi koji stvarno isporuči broj) i jedini
        // pouzdan pristup preko fragmentisanog Android ekosistema senzora.
        function attach() {
            window.addEventListener('deviceorientationabsolute', _headingOrientationHandler);
            window.addEventListener('deviceorientation', _headingOrientationHandler);
            _headingListening = true;
            // Ni jedan od oba event-a ponekad ne isporuči upotrebljiv azimut
            // (senzor odbijen na OS nivou, ili uređaj nema magnetometar) —
            // korisnik bi ostao "uključen" bez ikakvog konusa i bez povratne
            // informacije zašto. Upozori umjesto tihog neuspjeha.
            clearTimeout(_headingNoDataTimer);
            _headingNoDataTimer = setTimeout(function() {
                if (_headingActive && _headingLastDeg == null) {
                    _notify('showWarning', 'Kompas ne šalje podatke o smjeru — provjerite dozvole senzora uređaja u postavkama.');
                }
            }, 4000);
        }
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(function(state) {
                if (state === 'granted') { attach(); } else { _headingActive = false; _notify('showWarning', 'Pristup kompasu je odbijen.'); }
            }).catch(function() { _headingActive = false; _notify('showError', 'Nije moguće aktivirati kompas.'); });
        } else if (typeof DeviceOrientationEvent !== 'undefined') {
            attach();
        } else {
            _headingActive = false;
            _notify('showWarning', 'Vaš uređaj ne podržava kompas.');
        }
    }
    // Klik na plavu tačku "moja lokacija" — vidi _updateLocDisplay.
    function _toggleHeadingView() {
        if (!_headingLastLL) return; // nema još GPS pozicije da se konus ima odakle crtati
        if (_headingActive) { _stopHeadingView(); return; }
        _headingActive = true;
        _startHeadingView();
    }
    // Automatski uključi smjer gledanja čim se prikaže "moja lokacija" — vidi
    // _locateMe. Korisnici nisu otkrivali da klik NA plavu tačku (odvojen
    // drugi korak) uključuje konus, pa je izgledalo kao da smjer gledanja
    // uopšte ne postoji/ne radi. Idempotentno (bez efekta ako je već
    // uključeno); i dalje se može ručno isključiti klikom na tačku.
    function _startHeadingIfInactive() {
        if (_headingActive || !_headingLastLL) return;
        _headingActive = true;
        _startHeadingView();
    }

    // ---- "MOJA LOKACIJA" ----
    // PRAĆENJE (plava tačka se ažurira uživo) i AUTO-CENTRIRANJE (mapa te sama
    // drži u sredini) su NAMJERNO razdvojena stanja. Ranije su bila jedno: ručni
    // pan je gasio cijelo praćenje, pa bi plava tačka zamrzla na mjestu; da je
    // oživi, korisnik je morao ponovo tapnuti "Moja lokacija" — što ga je opet
    // centriralo. Efekat na terenu je bio "ne da mi da skrolam dalje, stalno me
    // vraća na mene" (prijavljeno). Sada:
    //   _lokacijaAktivna — GPS radi, plava tačka živi
    //   _followMode      — mapa se DODATNO sama centrira
    // Pan/zoom gasi SAMO auto-centriranje; tačka i dalje prati kretanje, a
    // korisnik slobodno razgleda mapu. Tap na "Moja lokacija" tada centrira i
    // nastavlja praćenje; tap dok je centriranje aktivno gasi lokaciju skroz.
    var _lokacijaAktivna = false;
    var _followMode = false;
    // Naš vlastiti setView (povratak na korisnika) mijenja zoom pa okine
    // 'zoomstart' — bez ovog guarda bi sam sebi ugasio centriranje koje je
    // upravo uključio. panTo iz praćenja ne okida ni dragstart ni zoomstart
    // (ne mijenja zoom), pa njemu guard ne treba.
    var _programskiPomjeraj = false;
    function _pomjeriProgramski(fn) {
        _programskiPomjeraj = true;
        try { fn(); } finally {
            // Kratak tajmer umjesto vezivanja za 'moveend' — moveend zna izostati
            // ako Leaflet preskoči animaciju, a 'once' slušaoci bi se gomilali.
            setTimeout(function() { _programskiPomjeraj = false; }, 700);
        }
    }

    function _setLocBtn(ikona, tekst) {
        if (!_locBtnEl) return;
        // Dva <span>-a (ikona + tekst) su obavezna: .rm-bar-btn ih slaže jedan
        // ispod drugog, a .rm-bar-icon daje ikoni veći font. Raniji
        // `textContent = '📍 ...'` ih je brisao, pa bi dugme nakon prvog tapa
        // ostalo bez te podjele (ikona iste veličine kao tekst, sve u jednom redu).
        _locBtnEl.innerHTML = '<span class="rm-bar-icon">' + ikona + '</span><span>' + tekst + '</span>';
    }

    // Samo DVA naziva: "📍 Moja lokacija" ionako već znači "centriraj na mene",
    // pa poseban naziv za pauzirano stanje ne bi donio ništa novo — samo još
    // jedan izraz za istu radnju (korisnička primjedba).
    //
    // "loc-on" (zeleno) prati _lokacijaAktivna SAMU — dugme svijetli čim je
    // GPS lokacija uključena, i dok mapa aktivno prati (i tad dodatno pulsira
    // preko "following") i dok je korisnik pauzirao praćenje pomjeranjem
    // mape (GPS i dalje radi u pozadini). Bez ovoga je pauzirano stanje
    // izgledalo IDENTIČNO kao potpuno isključena lokacija — jasan on/off
    // signal je bio samo za "aktivno prati", ne za "uključeno" uopšte
    // (korisnički zahtjev).
    function _osvjeziLocDugme() {
        if (!_locBtnEl) return;
        _locBtnEl.classList.toggle('loc-on', _lokacijaAktivna);
        _locBtnEl.classList.toggle('following', _lokacijaAktivna && _followMode);
        if (_lokacijaAktivna && _followMode) _setLocBtn('🎯', 'Prati me');
        else                                 _setLocBtn('📍', 'Moja lokacija');
    }

    // Korisnik je pomjerio/zumirao mapu — prestani ga vraćati na njegovu
    // lokaciju, ali NE gasi praćenje (plava tačka mora ostati živa).
    function _pauzirajFollow() {
        if (_programskiPomjeraj) return;   // naš pomjeraj, ne korisnikov
        if (!_followMode) return;
        _followMode = false;
        _osvjeziLocDugme();
    }

    function _startLokacija() {
        // Follow i Explorer se OTIMAJU oko pogleda na mapu (follow stalno
        // centrira, Explorer očekuje da korisnik slobodno gleda/pomjera) —
        // ta dva su jedini par koji se stvarno isključuje. Snimanje traga
        // NIJE dirano (vidi _gpsSubscribe komentar).
        _stopExplorer();
        _lokacijaAktivna = true;
        _followMode = true;
        _gpsSubscribe('lokacija', function(pos) {
            var ll = _updateLocDisplay(pos);
            // Centriranje je USLOVNO — praćenje same tačke ide dalje i kad je
            // korisnik odskrolao. To je cijela poenta razdvajanja.
            if (_followMode && _map) _map.panTo(ll, { animate: true });
        }, function(err) {
            console.error('[MapaRadnika] praćenje lokacije — greška:', err);
        });
        if (_map) {
            _map.on('dragstart', _pauzirajFollow);
            _map.on('zoomstart', _pauzirajFollow);
        }
        _osvjeziLocDugme();
    }

    function _stopLokacija() {
        _gpsUnsubscribe('lokacija');
        _lokacijaAktivna = false;
        _followMode = false;
        if (_map) {
            _map.off('dragstart', _pauzirajFollow);
            _map.off('zoomstart', _pauzirajFollow);
        }
        // Ukloni plavu tačku i konus smjera — ranije su ostajali na mapi i nakon
        // gašenja lokacije, pa je radnik na terenu gledao poziciju koja se više
        // NE ažurira i djeluje kao da je trenutna. Samo ako nijedan drugi
        // potrošač GPS-a nije aktivan: snimanje traga/ofarbane linije i "Vodi me
        // do tačke" i dalje sami ažuriraju tačku i moraju je zadržati.
        if (!Object.keys(_gpsConsumers).length) {
            if (_locMarker) { _map.removeLayer(_locMarker); _locMarker = null; }
            if (_headingActive) _stopHeadingView();
        }
        _osvjeziLocDugme();
    }

    function _locateMe() {
        if (!navigator.geolocation) {
            _notify('showError', 'Vaš uređaj ne podržava geolokaciju.');
            return;
        }
        if (!_map) return;

        // Praćenje traje i mapa te centrira → tap gasi lokaciju (toggle, isti
        // obrazac kao Snimi trag).
        if (_lokacijaAktivna && _followMode) { _stopLokacija(); return; }

        // Praćenje traje ali si odskrolao → tap te vraća: centriraj i nastavi
        // praćenje. GPS već radi pa nema ponovnog čekanja na fix — koristi se
        // zadnja poznata pozicija iz zajedničkog toka (_gpsLastPos).
        if (_lokacijaAktivna && !_followMode) {
            _followMode = true;
            _osvjeziLocDugme();
            if (_gpsLastPos) {
                var zadnja = [_gpsLastPos.coords.latitude, _gpsLastPos.coords.longitude];
                _pomjeriProgramski(function() {
                    _map.setView(zadnja, Math.max(_map.getZoom(), 15));
                });
            }
            return;
        }

        // Zajednički GPS tok je možda već aktivan (snimanje traga, navigacija)
        // i ima svjež fix — onda nema nikakvog čekanja ni rizika od isteka
        // vremena, kreni odmah s njim.
        if (_gpsLastPos && (Date.now() - _gpsLastPosTs) < 60000) {
            var ll0 = _updateLocDisplay(_gpsLastPos);
            _map.setView(ll0, Math.max(_map.getZoom(), 15));
            _startLokacija();
            _startHeadingIfInactive();
            return;
        }

        if (_locBtnEl) _locBtnEl.disabled = true;
        _setLocBtn('📍', 'Tražim...');

        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var ll = _updateLocDisplay(pos);
                _map.setView(ll, 15);
                if (_locBtnEl) _locBtnEl.disabled = false;
                _startLokacija();
                _startHeadingIfInactive();
            },
            function(err) {
                if (_locBtnEl) _locBtnEl.disabled = false;
                if (err.code === 1) {   // PERMISSION_DENIED — jedina greška bez oporavka
                    _osvjeziLocDugme();
                    _notify('showError', 'Pristup lokaciji je odbijen. Dozvolite lokaciju u postavkama uređaja/browsera.');
                    return;
                }
                // TIMEOUT/POSITION_UNAVAILABLE: prvi fix zna kasniti pod
                // krošnjama, ali watchPosition u _startLokacija() nastavlja
                // pokušavati i sam će centrirati mapu čim signal stigne.
                // Zato se praćenje SVEJEDNO pokreće umjesto da se stane sa
                // porukom "Isteklo vrijeme čekanja na GPS signal" (prijavljeno)
                // — dojava je informativna, ne greška, i korisnik ne mora
                // ponovo tapkati dugme.
                _startLokacija();
                _startHeadingIfInactive();
                _notify('showInfo', 'Tražim GPS signal',
                    'Signal je slab (krošnje/zgrade). Mapa će se sama pomjeriti na tebe čim signal stigne.', 5000);
            },
            // 20s + prihvati fix star do 30s (bilo 12s / maximumAge 0): pod
            // gustom krošnjom hladan fix često traje duže od 12s, a odbijanje
            // sasvim upotrebljivog fixa od prije par sekundi je bilo čisto
            // trošenje vremena i baterije.
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
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
        // Plava tačka "moja lokacija" se inače ažurira SAMO iz "Prati me"/
        // "Moja lokacija" — bez ovoga radnik za vrijeme snimanja traga (ako
        // "Prati me" nije posebno uključeno) ne vidi nikakvu ikonicu na mjestu
        // kretanja. Ažuriraj je na SVAKOM fix-u (bez throttle-a ispod, koji je
        // samo za dodavanje tačaka u sam trag, ne za vizuelni prikaz pozicije).
        _updateLocDisplay(pos);
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

    // Zajednička GPS-greška i za start i za nastavak nakon pauze — dozvola
    // može biti povučena u bilo kom trenutku, ne samo na startu.
    //
    // Snimljene tačke se NE BACAJU (ranije jesu): greška ovdje stiže tek nakon
    // GPS_GRACE_MS gutanja prolaznih grešaka (vidi _gpsSubscribe), ali i tada
    // je jedini ispravan potez PAUZIRATI — radnik je možda prehodao kilometar
    // prije nego je zašao pod gustu krošnju, i taj posao ne smije nestati zbog
    // izgubljenog signala. Isto ponašanje kao _handleSjekGpsError; odatle i
    // preuzet obrazac.
    function _handleTragGpsError(err) {
        console.error('[MapaRadnika] GPS greška pri snimanju traga:', err);
        if (!_recording || _tragPaused) return;
        _gpsUnsubscribe('trag');
        _tragActiveMs += Date.now() - _tragSegmentStartTs;
        _tragPaused = true;
        var btn = document.getElementById('trag-recording-pause-btn');
        var rec = document.getElementById('trag-recording-bar');
        if (btn) btn.textContent = '▶️ Nastavi';
        if (rec) rec.classList.add('paused');
        _notify('showWarning', 'GPS prekinut', err && err.code === 1
            ? 'Pristup lokaciji je odbijen — snimanje je pauzirano. Snimljeno do sada je sačuvano; možete odmah pritisnuti "Završi".'
            : 'Izgubljen GPS signal — snimanje je pauzirano. Snimljeno do sada je sačuvano; tapnite "Nastavi" kad se signal vrati.');
    }

    function _startTrag() {
        if (!navigator.geolocation) {
            _notify('showError', 'Vaš uređaj ne podržava geolokaciju.');
            return;
        }
        _currentTrackPoints = [];
        _lastTragTs = 0;
        _tragStartIso = new Date().toISOString();
        if (_currentTrackPolyline) { _map.removeLayer(_currentTrackPolyline); _currentTrackPolyline = null; }

        _gpsSubscribe('trag', _onTragPosition, _handleTragGpsError);

        _recording = true;
        _tragPaused = false;
        _tragActiveMs = 0;
        _tragSegmentStartTs = Date.now();
        if (_tragBtnEl) {
            _tragBtnEl.textContent = '⏹️ Zaustavi snimanje';
            _tragBtnEl.classList.add('recording');
        }
        _hideTragoviMenu(); // traka snimanja sjeda tačno na mjesto gdje stoji ovaj meni
        _openTragRecordingModal();
        _recWakeLockOn();
    }

    function _stopTrag() {
        _gpsUnsubscribe('trag');
        _recording = false;
        _tragPaused = false;
        _recWakeLockOff();
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
                points: _currentTrackPoints,
                activeMs: _tragActiveMs // aktivno vrijeme snimanja, BEZ pauza — vidi _tragDurationStr
            });
            _saveTracks(tracks);
        }
        _pendingTragName = '';
        _tragActiveMs = 0;
        if (_currentTrackPolyline) { _map.removeLayer(_currentTrackPolyline); _currentTrackPolyline = null; }
        _currentTrackPoints = [];
        _drawSavedTracks();
        _renderTragoviList();
    }

    // ---- Modal aktivnog snimanja — otvara se na start, prikazuje uživo
    // proteklo (aktivno) vrijeme i pređenu udaljenost, sa Pauza/Nastavi i
    // Završi dugmadima. Namjerno NEMA X/minimiziraj — dok snimanje traje,
    // modal je jedini način upravljanja (klik izvan njega ga ne zatvara). ----
    // Visina "sprata" iznad donje trake. Traka snimanja stoji na prvom spratu,
    // a popup meniji (Tragovi/Ostalo) se dižu iznad nje kad snimanje traje —
    // inače bi se preklopili na istom mjestu.
    function _bottomStackOffset(iznadTrakeSnimanja) {
        var bar = document.getElementById('radnik-mapa-bottombar');
        var off = (bar ? bar.getBoundingClientRect().height : 0) + 8;
        if (iznadTrakeSnimanja) {
            var rec = document.getElementById('trag-recording-bar');
            if (rec && !rec.classList.contains('hidden')) off += rec.getBoundingClientRect().height + 8;
        }
        return off;
    }
    function _positionRecBar() {
        var rec = document.getElementById('trag-recording-bar');
        if (rec) rec.style.bottom = _bottomStackOffset(false) + 'px';
    }
    function _openTragRecordingModal() {
        var rec = document.getElementById('trag-recording-bar');
        if (!rec) return; // fallback ako traka nije u DOM-u — snimanje ipak radi, samo bez uživo prikaza
        var btn = document.getElementById('trag-recording-pause-btn');
        if (btn) btn.textContent = '⏸️ Pauza';
        rec.classList.remove('paused');
        rec.classList.remove('hidden');
        _positionRecBar();
        _updateTragModalStats();
        if (_tragModalTimerId) clearInterval(_tragModalTimerId);
        _tragModalTimerId = setInterval(_updateTragModalStats, 1000);
    }
    function _closeTragRecordingModal() {
        var rec = document.getElementById('trag-recording-bar');
        if (rec) { rec.classList.add('hidden'); rec.classList.remove('paused'); }
        if (_tragModalTimerId) { clearInterval(_tragModalTimerId); _tragModalTimerId = null; }
    }
    function _msToClockStr(ms) {
        var totalSec = Math.max(0, Math.floor(ms / 1000));
        var h = Math.floor(totalSec / 3600);
        var m = Math.floor((totalSec % 3600) / 60);
        var s = totalSec % 60;
        var pad = function(n) { return (n < 10 ? '0' : '') + n; };
        return h > 0 ? (h + ':' + pad(m) + ':' + pad(s)) : (pad(m) + ':' + pad(s));
    }
    // Traka snimanja je JEDNA (#trag-recording-bar) i opslužuje OBA snimanja
    // (obični trag i ofarbanu sjekačku liniju) — nikad oba istovremeno, vidi
    // _toggleTrag / mapaRadnikaStartSjekackoSnimanje. Ovaj akcesor vraća stanje
    // aktivnog moda, da traka ne mora znati koji je od dva u toku.
    function _recAktivno() {
        if (_sjekRecording) return {
            tacke: _sjekPoints.map(function(p) { return p.ll; }),
            activeMs: _sjekActiveMs, paused: _sjekPaused, segStart: _sjekSegmentStartTs, sjek: true
        };
        if (_recording) return {
            tacke: _currentTrackPoints,
            activeMs: _tragActiveMs, paused: _tragPaused, segStart: _tragSegmentStartTs, sjek: false
        };
        return null;
    }
    function _setRecBarLabel(txt) {
        var el = document.getElementById('trag-recording-label');
        if (el) el.textContent = txt || '';
    }
    function _updateTragModalStats() {
        var st = _recAktivno();
        if (!st) return;
        var elapsedEl = document.getElementById('trag-recording-elapsed');
        var distEl = document.getElementById('trag-recording-distance');
        var accEl = document.getElementById('trag-recording-acc');
        var ms = st.activeMs + (st.paused ? 0 : (Date.now() - st.segStart));
        if (elapsedEl) elapsedEl.textContent = _msToClockStr(ms);
        if (distEl) distEl.textContent = _tragDistanceKm(st.tacke).toFixed(2).replace('.', ',') + ' km';
        // Preciznost se prikazuje samo pri snimanju linije — tamo se loši
        // fixovi odbacuju, pa radnik mora vidjeti zašto tačke ne rastu.
        if (accEl) {
            accEl.textContent = (st.sjek && _sjekZadnjaAcc != null)
                ? ('GPS ±' + _sjekZadnjaAcc + ' m' + (_sjekOdbaceno ? ' · ' + _sjekOdbaceno + '↓' : ''))
                : '';
        }
    }
    function _pauseResumeTrag() {
        if (!_recording) return;
        var btn = document.getElementById('trag-recording-pause-btn');
        var rec = document.getElementById('trag-recording-bar');
        if (!_tragPaused) {
            _gpsUnsubscribe('trag');
            _tragActiveMs += Date.now() - _tragSegmentStartTs;
            _tragPaused = true;
            if (btn) btn.textContent = '▶️ Nastavi';
            if (rec) rec.classList.add('paused');
        } else {
            _tragSegmentStartTs = Date.now();
            _gpsSubscribe('trag', _onTragPosition, _handleTragGpsError);
            _tragPaused = false;
            if (btn) btn.textContent = '⏸️ Pauza';
            if (rec) rec.classList.remove('paused');
        }
        _updateTragModalStats();
    }
    // Dugmad na traci su zajednička za oba moda — usmjeri ih na aktivni.
    window.mapaRadnikaPauseResumeTrag = function() {
        if (_sjekRecording) return _pauseResumeSjek();
        return _pauseResumeTrag();
    };

    function _finishTrag() {
        if (!_recording) return;
        if (!_tragPaused) _tragActiveMs += Date.now() - _tragSegmentStartTs;
        _closeTragRecordingModal();
        _stopTrag();
    }
    window.mapaRadnikaFinishTrag = function() {
        if (_sjekRecording) return _finishSjek();
        return _finishTrag();
    };

    function _toggleTrag() {
        // Dok snimanje traje, upravljanje ide isključivo kroz modal
        // (Pauza/Nastavi/Završi) — ovo dugme na traci samo pokreće novo snimanje.
        if (_recording) return;
        // Traka snimanja je jedna; dva paralelna snimanja iza nje značila bi da
        // radnik drugo ne vidi niti može zaustaviti. Fizički je to ionako ista
        // šetnja. Odbij glasno, ne tiho.
        if (_sjekRecording) {
            _notify('showWarning', 'Snimanje ofarbane linije je u toku', 'Prvo završite snimanje linije.');
            return;
        }
        _showTragNameModal();
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
    function _msToDurationStr(ms) {
        if (!(ms > 0)) return '';
        var min = Math.round(ms / 60000);
        if (min < 60) return min + ' min';
        return Math.floor(min / 60) + 'h ' + (min % 60) + 'min';
    }
    // Preferira t.activeMs (aktivno vrijeme snimanja, BEZ pauza — postoji na
    // svim tragovima snimljenim nakon uvođenja pauze); stariji tragovi bez tog
    // polja padaju nazad na ukupno end-start (uključuje eventualne pauze, ali
    // takvi tragovi nisu ni imali pauzu jer ta mogućnost tad nije postojala).
    function _tragDurationStr(t) {
        if (!t) return '';
        if (typeof t.activeMs === 'number') return _msToDurationStr(t.activeMs);
        if (!t.start || !t.end) return '';
        return _msToDurationStr(new Date(t.end).getTime() - new Date(t.start).getTime());
    }
    // ---- IZVOZ TERENSKIH PODATAKA (GPX) ----
    // Tragovi/tačke/površine/mjerenja žive SAMO na radnikovom telefonu
    // (localStorage). Bez izvoza se sav taj posao nepovratno gubi kad se
    // telefon izgubi/zamijeni ili neko "očisti podatke pregledniku" — a niko
    // drugi to nikad nije ni vidio.
    //
    // GPX je odabran jer ga otvara doslovno svaki GIS/navigacioni program
    // (QGIS, Garmin, OsmAnd, Locus...) i može se poslati poslovođi preko
    // Vibera/WhatsApp-a. Dijeljenje ide kroz isti native share meni kao
    // fotografije, pa radi OFFLINE — nema servera ni upload-a.
    // Poligoni (površine) se pišu kao ZATVORENA staza (prva tačka ponovljena
    // na kraju) — GPX nema poseban tip za poligon, a zatvorena staza je
    // standardan i svuda podržan način da se područje prenese.
    function _xmlEsc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    function _gpxTime(iso) {
        try { return new Date(iso).toISOString(); } catch (_) { return new Date().toISOString(); }
    }
    function _gpxWpt(lat, lng, name, iso) {
        return '  <wpt lat="' + lat + '" lon="' + lng + '">\n' +
            '    <name>' + _xmlEsc(name) + '</name>\n' +
            (iso ? '    <time>' + _gpxTime(iso) + '</time>\n' : '') +
            '  </wpt>\n';
    }
    function _gpxTrk(name, points, iso) {
        if (!points || points.length < 2) return '';
        var s = '  <trk>\n    <name>' + _xmlEsc(name) + '</name>\n' +
            (iso ? '    <time>' + _gpxTime(iso) + '</time>\n' : '') + '    <trkseg>\n';
        points.forEach(function(p) {
            s += '      <trkpt lat="' + p[0] + '" lon="' + p[1] + '"></trkpt>\n';
        });
        return s + '    </trkseg>\n  </trk>\n';
    }
    function _gpxDoc(inner, naslov) {
        return '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<gpx version="1.1" creator="Sumarija Bosanska Krupa" xmlns="http://www.topografix.com/GPX/1/1">\n' +
            '  <metadata>\n    <name>' + _xmlEsc(naslov) + '</name>\n' +
            '    <time>' + new Date().toISOString() + '</time>\n  </metadata>\n' +
            inner + '</gpx>\n';
    }
    function _safeFileName(s) {
        return String(s || 'podaci')
            .replace(/[ČĆ]/g, 'C').replace(/[čć]/g, 'c').replace(/Š/g, 'S').replace(/š/g, 's')
            .replace(/Ž/g, 'Z').replace(/ž/g, 'z').replace(/Đ/g, 'Dj').replace(/đ/g, 'dj')
            .replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'podaci';
    }
    // Native share meni ako uređaj podržava dijeljenje fajlova (telefon),
    // inače klasično preuzimanje fajla (desktop). Oboje radi bez interneta.
    // Generička verzija (window.shareOrDownloadFile, ispod) je globalna da je
    // mogu koristiti i drugi tabovi (npr. Kubikator) bez ponavljanja ove
    // logike; ovo ostaje tanak gpx-specifičan omotač zbog postojećih poziva
    // niže u fajlu.
    async function _shareOrDownloadGpx(fileName, gpx, naslov) {
        return window.shareOrDownloadFile(fileName, gpx, 'application/gpx+xml', naslov);
    }

    // Opće dijeljenje/preuzimanje bilo kog tekstualnog fajla (CSV, GPX, ...).
    // Ista logika kao gornji gpx-specifičan omotač, samo generička po
    // mimeType-u — koristi je i js/kubikator.js za izvoz unosa.
    window.shareOrDownloadFile = async function(fileName, content, mimeType, title) {
        var file;
        try {
            file = new File([content], fileName, { type: mimeType });
        } catch (_) { file = null; }
        if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
            try {
                await navigator.share({ files: [file], title: title });
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return; // korisnik zatvorio meni
                // ostalo — padni na preuzimanje ispod
            }
        }
        try {
            var url = URL.createObjectURL(new Blob([content], { type: mimeType }));
            var a = document.createElement('a');
            a.href = url; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
            _notify('showSuccess', 'Fajl spremljen', fileName);
        } catch (e) {
            _notify('showError', 'Nije moguće izvesti podatke', e.message);
        }
    };
    window.mapaRadnikaShareTrag = function(index) {
        var t = _loadSavedTracks()[index];
        if (!t || !t.points || t.points.length < 2) { _notify('showWarning', 'Trag nema dovoljno tačaka za izvoz.'); return; }
        var naziv = t.name || 'Trag';
        _shareOrDownloadGpx(_safeFileName(naziv) + '.gpx', _gpxDoc(_gpxTrk(naziv, t.points, t.start), naziv), naziv);
    };
    window.mapaRadnikaShareTacka = function(index) {
        var t = _loadSavedTacke()[index];
        if (!t) return;
        if (_map) _map.closePopup();
        var naziv = t.name || 'Tačka';
        _shareOrDownloadGpx(_safeFileName(naziv) + '.gpx', _gpxDoc(_gpxWpt(t.lat, t.lng, naziv, t.created), naziv), naziv);
    };
    window.mapaRadnikaSharePoligon = function(index) {
        var p = _loadSavedPoligoni()[index];
        if (!p || !p.points || p.points.length < 3) return;
        if (_map) _map.closePopup();
        var naziv = p.name || 'Površina';
        var zatvoren = p.points.concat([p.points[0]]); // GPX nema poligon — zatvorena staza
        _shareOrDownloadGpx(_safeFileName(naziv) + '.gpx', _gpxDoc(_gpxTrk(naziv, zatvoren, p.created), naziv), naziv);
    };
    window.mapaRadnikaShareMjerenje = function(index) {
        var m = _loadSavedMjerenja()[index];
        if (!m || !m.points || m.points.length < 2) return;
        if (_map) _map.closePopup();
        var naziv = _mjerenjeKratko(m).replace(/<[^>]*>/g, '');
        var pts = m.tip === 'povrsina' ? m.points.concat([m.points[0]]) : m.points;
        _shareOrDownloadGpx(_safeFileName(naziv) + '.gpx', _gpxDoc(_gpxTrk(naziv, pts, m.created), naziv), naziv);
    };
    // Sve odjednom — jedan GPX sa svim tačkama i stazama (za predaju/arhivu).
    window.mapaRadnikaExportSve = function() {
        var inner = '';
        var brojac = 0;
        _loadSavedTacke().forEach(function(t) {
            inner += _gpxWpt(t.lat, t.lng, t.name || 'Tačka', t.created); brojac++;
        });
        _loadSavedFoto().then(function(foto) {
            // Fotografije nose lokaciju — u GPX idu kao tačke (sama slika se
            // dijeli zasebno, GPX ne nosi binarni sadržaj).
            foto.forEach(function(f) {
                if (f.lat != null && f.lng != null) { inner += _gpxWpt(f.lat, f.lng, '📷 ' + (f.name || 'Foto'), f.created); brojac++; }
            });
            _loadSavedTracks().forEach(function(t) {
                if (t.points && t.points.length >= 2) { inner += _gpxTrk(t.name || 'Trag', t.points, t.start); brojac++; }
            });
            _loadSavedPoligoni().forEach(function(p) {
                if (p.points && p.points.length >= 3) { inner += _gpxTrk(p.name || 'Površina', p.points.concat([p.points[0]]), p.created); brojac++; }
            });
            _loadSavedMjerenja().forEach(function(m) {
                if (m.points && m.points.length >= 2) {
                    var pts = m.tip === 'povrsina' ? m.points.concat([m.points[0]]) : m.points;
                    inner += _gpxTrk(_mjerenjeKratko(m).replace(/<[^>]*>/g, ''), pts, m.created); brojac++;
                }
            });
            _sjekVisible().forEach(function(l) {
                if (l.points && l.points.length >= 2) { inner += _gpxTrk(l.naziv || 'Ofarbana linija', l.points, l.kreirano); brojac++; }
            });
            if (!brojac) { _notify('showWarning', 'Nema terenskih podataka za izvoz.'); return; }
            var korisnik = _currentUserObj().fullName || _currentUserObj().username || 'radnik';
            var datum = new Date().toISOString().slice(0, 10);
            var naslov = 'Teren ' + korisnik + ' ' + datum;
            _hideOstaloMenu();
            _shareOrDownloadGpx(_safeFileName(naslov) + '.gpx', _gpxDoc(inner, naslov), naslov);
        });
    };

    // ================= OBJEDINJENA LISTA TERENSKIH STAVKI =================
    // Ranije je svaki tip (trag/tačka/foto/površina/sječe/mjerenje) imao svoju
    // odvojenu listu sa vlastitim naslovom, i to razbacano po dva popup-a —
    // radnik na terenu je morao pamtiti "gdje je šta" i skrolati kroz šest
    // kutija da nađe jednu stavku. Sad je sve u JEDNOJ listi sa podtabovima
    // (filter po tipu), pretragom i preimenovanjem.
    //
    // Svih šest starih _renderXList() funkcija su zadržane kao tanki omotači
    // oko _renderStavke() — postoji desetak poziva na njih po modulu (nakon
    // brisanja/spremanja/crtanja) i svi i dalje rade bez ijedne izmjene.
    var _stavkeTab = 'sve';
    var _stavkeQuery = '';
    var _stavkeFotoCache = null; // foto su u IndexedDB (base64, teško) — ne čitaj ih na svaki otkucaj u pretrazi

    var STAVKA_TABOVI = [
        { id: 'sve',      label: 'Sve' },
        { id: 'trag',     label: '⏺️ Tragovi' },
        { id: 'tacka',    label: '📍 Tačke' },
        { id: 'foto',     label: '📷 Foto' },
        { id: 'povrsina', label: '✏️ Površine' },
        { id: 'sjece',    label: '📏 Sječe' },
        { id: 'ofarbano', label: '🎨 Ofarbane' },
        { id: 'mjerenje', label: '📐 Mjerenja' },
        { id: 'doznaka',  label: '🌲 Doznaka' }
    ];

    function _esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // Pretraga tolerantna na dijakritike — radnik kuca "secacke"/"trag pcelinjak"
    // bez č/ć/š/ž/đ (česta navika na telefonskoj tastaturi) i svejedno nalazi.
    function _stavkaNorm(s) {
        return String(s == null ? '' : s).toLowerCase()
            .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj');
    }
    function _datumStr(iso) {
        return iso ? new Date(iso).toLocaleString('bs-BA') : '?';
    }

    // Skuplja SVE tipove u jedan niz zajedničkog oblika. `idx` je index unutar
    // vlastitog niza tog tipa — postojeće share/delete funkcije primaju baš taj
    // index, pa se ovdje ništa ne mora preračunavati.
    async function _collectStavke(useCache) {
        var out = [];

        _loadSavedTracks().forEach(function(t, i) {
            var km = _tragDistanceKm(t.points).toFixed(2).replace('.', ',');
            var dur = _tragDurationStr(t);
            out.push({
                tip: 'trag', idx: i, ikona: '⏺️', ime: t.name || 'Trag',
                meta: _datumStr(t.start) + ' · ' + km + ' km' + (dur ? ' · ' + dur : ''),
                ts: t.start ? new Date(t.start).getTime() : 0,
                edit: true, zoom: (t.points || []).length >= 2, share: true
            });
        });

        _loadSavedTacke().forEach(function(t, i) {
            out.push({
                tip: 'tacka', idx: i, ikona: '📍', ime: t.name || 'Tačka',
                meta: _datumStr(t.created),
                ts: t.created ? new Date(t.created).getTime() : 0,
                edit: true, zoom: true, share: true, ruta: true
            });
        });

        var fotos = (useCache && _stavkeFotoCache) ? _stavkeFotoCache : await _loadSavedFoto();
        _stavkeFotoCache = fotos;
        fotos.forEach(function(f, i) {
            out.push({
                tip: 'foto', idx: i, ikona: '📷', ime: f.name || 'Foto',
                meta: _datumStr(f.created) + ' · ' + _fmtBytes(_dataUrlBytes(f.dataUrl)),
                ts: f.created ? new Date(f.created).getTime() : 0,
                edit: true, zoom: !!(f.lat && f.lng), share: true
            });
        });

        _loadSavedPoligoni().forEach(function(p, i) {
            out.push({
                tip: 'povrsina', idx: i, ikona: '✏️', ime: p.name || 'Površina',
                meta: _datumStr(p.created) + ' · ' + _fmtPovrsina(_polygonAreaM2(p.points || [])),
                ts: p.created ? new Date(p.created).getTime() : 0,
                edit: true, zoom: (p.points || []).length >= 3, share: true
            });
        });

        _loadSavedMjerenja().forEach(function(m, i) {
            var vrijednost = m.tip === 'udaljenost' ? _fmtDuzina(m.duzina) : _fmtPovrsina(m.povrsina);
            out.push({
                tip: 'mjerenje', idx: i, ikona: m.tip === 'udaljenost' ? '📏' : '🔷',
                ime: m.name || vrijednost,
                meta: _datumStr(m.created) + (m.name ? ' · ' + vrijednost : ''),
                ts: m.created ? new Date(m.created).getTime() : 0,
                edit: true, zoom: (m.points || []).length >= 2, share: true
            });
        });

        _loadSavedDoznaka().forEach(function(d, i) {
            var doneCount = (d.points || []).filter(function(p) { return p.done; }).length;
            out.push({
                tip: 'doznaka', idx: i, ikona: '🌲', ime: d.name || 'Doznačena stabla',
                meta: _datumStr(d.created) + ' · ' + (d.points || []).length + ' stabala' +
                    (doneCount ? ' · ' + doneCount + ' izvršeno' : '') +
                    (d.hidden ? ' · sakriveno' : ''),
                ts: d.created ? new Date(d.created).getTime() : 0,
                edit: true, zoom: (d.points || []).length >= 1, share: false,
                toggle: true, hiddenManually: !!d.hidden
            });
        });

        // Sjekačke linije nisu niz sačuvanih stavki nego JEDNA konfiguracija iz
        // koje se linije svaki put deterministički regenerišu (vidi komentar uz
        // _restoreSjeceIfSaved) — otud najviše jedan red, i "uredi" umjesto
        // preimenovanja. Nema izvoza jer ih ni mapaRadnikaExportSve ne izvozi.
        if (_sjeceLines.length) {
            var cfg = _loadSjeceConfig();
            out.push({
                tip: 'sjece', idx: 0, ikona: '📏',
                ime: 'Odjel ' + (_sjeceOdjelLabel || '?'),
                meta: _sjeceLines.length + ' linija' + (cfg ? ' · ' + cfg.azimuth + '° · ' + cfg.spacing + ' m' : ''),
                ts: Date.now(), // uvijek "aktuelno" (regeneriše se pri svakom otvaranju mape)
                edit: true, zoom: true, share: false
            });
        }

        // Stvarno ofarbane linije — PRAVI niz (moje + tuđe za izabrani odjel),
        // za razliku od 'sjece' iznad koji je jedan config red. Zato zaseban
        // tip: dijeljenje 'sjece' bi slomilo idx ugovor na koji se oslanjaju
        // svi dispečeri. 'edit' namjerno izostaje — preimenovanje nakon slanja
        // tražilo bi još jedan endpoint, a "preimenovano samo na mom telefonu"
        // je gore nego bez preimenovanja (naziv se bira prije snimanja).
        _sjekVisible().forEach(function(l, i) {
            out.push({
                tip: 'ofarbano', idx: i, ikona: '🎨',
                ime: (l.brojLinije ? 'Linija ' + l.brojLinije + ' — ' : '') + (l.naziv || 'Ofarbana linija'),
                meta: _datumStr(l.kreirano) + ' · ' + _fmtDistanceM(l.duzinaM || 0) +
                      ' · ' + (l.radnik || l.korisnik || '?') +
                      (l.pendingSync ? ' · ⏳ čeka slanje' : '') +
                      (l.syncError ? ' · ⚠️ ' + l.syncError : '') +
                      (l.mine ? '' : ' · 👤 kolega'),
                ts: l.kreirano ? new Date(l.kreirano).getTime() : 0,
                edit: false, zoom: (l.points || []).length >= 2, share: true, del: !!l.mine
            });
        });

        return out;
    }

    function _stavkeTabsHtml(sve) {
        return STAVKA_TABOVI.map(function(t) {
            var n = t.id === 'sve' ? sve.length : sve.filter(function(s) { return s.tip === t.id; }).length;
            return '<button type="button" class="rm-stavke-tab' + (_stavkeTab === t.id ? ' active' : '') + '"' +
                ' onclick="mapaRadnikaStavkeTab(\'' + t.id + '\')">' +
                _esc(t.label) + ' <span class="rm-stavke-tab-n">' + n + '</span></button>';
        }).join('');
    }

    function _stavkaRowHtml(s) {
        var akcije = '';
        if (s.ruta)  akcije += '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaRouteToTacka(' + s.idx + ')" aria-label="Vodi me do tačke">🧭</button>';
        if (s.zoom)  akcije += '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaZoomStavka(\'' + s.tip + '\',' + s.idx + ')" aria-label="Prikaži na mapi">🔍</button>';
        if (s.toggle) akcije += '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaToggleDoznakaVisible(' + s.idx + ')" aria-label="' +
            (s.hiddenManually ? 'Prikaži na mapi' : 'Sakrij sa mape') + '">' + (s.hiddenManually ? '🙈' : '👁️') + '</button>';
        if (s.edit)  akcije += '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaEditStavka(\'' + s.tip + '\',' + s.idx + ')" aria-label="Preimenuj">✏️</button>';
        if (s.share) akcije += '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaShareStavka(\'' + s.tip + '\',' + s.idx + ')" aria-label="Podijeli">📤</button>';
        // s.del je undefined za sve postojeće tipove (dugme se uvijek prikazuje,
        // nema regresije) — eksplicitno false SAMO za tuđe ofarbane linije, koje
        // se ne smiju moći obrisati (isti obrazac kao provjera na serveru).
        if (s.del !== false) akcije += '<button type="button" class="rm-tragovi-delete" onclick="mapaRadnikaDeleteStavka(\'' + s.tip + '\',' + s.idx + ')" aria-label="Obriši">🗑️</button>';
        return '<div class="rm-tragovi-row">' +
            '<span class="rm-tragovi-row-info">' + s.ikona + ' ' + _esc(s.ime) +
            '<br><small>' + _esc(s.meta) + '</small></span>' +
            '<span style="display:flex;gap:4px;flex-shrink:0;">' + akcije + '</span>' +
            '</div>';
    }

    async function _renderStavke(useCache) {
        var list = document.getElementById('radnik-mapa-stavke-list');
        var tabs = document.getElementById('radnik-mapa-stavke-tabs');
        if (!list) return;

        var sve = await _collectStavke(useCache);

        // Dugme za čišćenje starih fotografija — vidljivo samo kad stvarno ima
        // šta obrisati (ranije živjelo u _renderFotoList).
        var cleanupBtn = document.getElementById('radnik-mapa-foto-cleanup-btn');
        if (cleanupBtn) {
            var cutoff = _fotoCutoffTs();
            var staro = (_stavkeFotoCache || []).filter(function(f) { return _fotoIsOld(f, cutoff); }).length;
            cleanupBtn.classList.toggle('hidden', staro === 0);
        }

        if (tabs) tabs.innerHTML = _stavkeTabsHtml(sve);

        var q = _stavkaNorm(_stavkeQuery.trim());
        var vidljive = sve
            .filter(function(s) { return _stavkeTab === 'sve' || s.tip === _stavkeTab; })
            .filter(function(s) { return !q || _stavkaNorm(s.ime + ' ' + s.meta).indexOf(q) !== -1; })
            .sort(function(a, b) { return b.ts - a.ts; }); // najnovije gore

        if (!vidljive.length) {
            list.innerHTML = '<div class="rm-tragovi-empty">' +
                (q ? 'Nema rezultata za "' + _esc(_stavkeQuery.trim()) + '".' : 'Nema sačuvanih stavki.') +
                '</div>';
            return;
        }
        list.innerHTML = vidljive.map(_stavkaRowHtml).join('');
    }

    window.mapaRadnikaStavkeTab = function(id) {
        _stavkeTab = id;
        _renderStavke(true);
    };
    window.mapaRadnikaStavkeSearch = function(v) {
        _stavkeQuery = v || '';
        _renderStavke(true); // koristi keširane foto — pretraga se okida na svaki otkucaj
    };

    // ---- Zajedničke akcije (dispatch po tipu na postojeće funkcije) ----
    window.mapaRadnikaShareStavka = function(tip, idx) {
        if (tip === 'trag')     return window.mapaRadnikaShareTrag(idx);
        if (tip === 'tacka')    return window.mapaRadnikaShareTacka(idx);
        if (tip === 'foto')     return window.mapaRadnikaShareFoto(idx);
        if (tip === 'povrsina') return window.mapaRadnikaSharePoligon(idx);
        if (tip === 'mjerenje') return window.mapaRadnikaShareMjerenje(idx);
        if (tip === 'ofarbano') return window.mapaRadnikaShareOfarbana(idx);
    };
    window.mapaRadnikaDeleteStavka = function(tip, idx) {
        if (tip === 'trag')     return window.mapaRadnikaDeleteTrag(idx);
        if (tip === 'tacka')    return window.mapaRadnikaDeleteTacka(idx);
        if (tip === 'foto')     return window.mapaRadnikaDeleteFoto(idx);
        if (tip === 'povrsina') return window.mapaRadnikaDeletePoligon(idx);
        if (tip === 'mjerenje') return window.mapaRadnikaDeleteMjerenje(idx);
        if (tip === 'sjece')    return window.mapaRadnikaUkloniSjeceLinije();
        if (tip === 'doznaka')  return window.mapaRadnikaDeleteDoznaka(idx);
        if (tip === 'ofarbano') return window.mapaRadnikaDeleteOfarbana(idx);
    };
    window.mapaRadnikaZoomStavka = async function(tip, idx) {
        if (!_map) return;
        _hideTragoviMenu();
        var lyr = null, ll = null;
        if (tip === 'trag')          lyr = _savedTrackLayers[idx];
        else if (tip === 'povrsina') lyr = _savedPoligonLayers[idx];
        else if (tip === 'mjerenje') lyr = _mjerenjeLayers[idx];
        else if (tip === 'sjece')    lyr = _sjeceLayers.length ? L.featureGroup(_sjeceLayers) : null;
        else if (tip === 'doznaka')  lyr = _doznakaLayerGroups[idx];
        else if (tip === 'ofarbano') lyr = _sjekLayers[idx];
        else if (tip === 'tacka') {
            var t = _loadSavedTacke()[idx];
            if (t) ll = [t.lat, t.lng];
        } else if (tip === 'foto') {
            var f = (await _loadSavedFoto())[idx];
            if (f && f.lat && f.lng) ll = [f.lat, f.lng];
        }
        try {
            if (lyr) {
                _map.fitBounds(lyr.getBounds(), { padding: [40, 40], maxZoom: 17 });
                if (lyr.openPopup) lyr.openPopup();
            } else if (ll) {
                _map.setView(ll, 17);
            }
        } catch (_) {}
    };

    // ---- Preimenovanje stavke ----
    // Sjekačke linije nemaju ime nego konfiguraciju — "uredi" im otvara isti
    // panel u kojem su i napravljene (odjel/azimut/razmak), ne modal za ime.
    var _stavkaEdit = null;
    window.mapaRadnikaEditStavka = async function(tip, idx) {
        if (tip === 'sjece') return window.mapaRadnikaStartSjeceLinije();
        var trenutno = '';
        if (tip === 'trag')          trenutno = (_loadSavedTracks()[idx] || {}).name || '';
        else if (tip === 'tacka')    trenutno = (_loadSavedTacke()[idx] || {}).name || '';
        else if (tip === 'povrsina') trenutno = (_loadSavedPoligoni()[idx] || {}).name || '';
        else if (tip === 'mjerenje') trenutno = (_loadSavedMjerenja()[idx] || {}).name || '';
        else if (tip === 'foto')     trenutno = ((await _loadSavedFoto())[idx] || {}).name || '';
        else if (tip === 'doznaka')  trenutno = (_loadSavedDoznaka()[idx] || {}).name || '';
        _stavkaEdit = { tip: tip, idx: idx };
        var modal = document.getElementById('stavka-edit-modal');
        var input = document.getElementById('stavka-edit-input');
        if (!modal || !input) return;
        input.value = trenutno;
        modal.classList.add('show');
        setTimeout(function() { input.focus(); input.select(); }, 50);
    };
    window.closeStavkaEditModal = function() {
        var modal = document.getElementById('stavka-edit-modal');
        if (modal) modal.classList.remove('show');
        _stavkaEdit = null;
    };
    window.confirmStavkaEdit = async function() {
        var input = document.getElementById('stavka-edit-input');
        var e = _stavkaEdit;
        window.closeStavkaEditModal();
        if (!e || !input) return;
        var novo = input.value.trim();
        if (!novo) return;
        if (e.tip === 'trag') {
            var tr = _loadSavedTracks(); if (!tr[e.idx]) return;
            tr[e.idx].name = novo; _saveTracks(tr); _drawSavedTracks();
        } else if (e.tip === 'tacka') {
            var ta = _loadSavedTacke(); if (!ta[e.idx]) return;
            ta[e.idx].name = novo; _saveTacke(ta); _drawSavedTacke();
        } else if (e.tip === 'povrsina') {
            var po = _loadSavedPoligoni(); if (!po[e.idx]) return;
            po[e.idx].name = novo; _savePoligoni(po); _drawSavedPoligoni();
        } else if (e.tip === 'mjerenje') {
            var mj = _loadSavedMjerenja(); if (!mj[e.idx]) return;
            mj[e.idx].name = novo; _saveMjerenja(mj); _drawSavedMjerenja();
        } else if (e.tip === 'foto') {
            var fo = await _loadSavedFoto(); if (!fo[e.idx]) return;
            fo[e.idx].name = novo; await _saveFoto(fo); _stavkeFotoCache = null; await _drawSavedFoto();
        } else if (e.tip === 'doznaka') {
            var dz = _loadSavedDoznaka(); if (!dz[e.idx]) return;
            dz[e.idx].name = novo; _saveDoznaka(dz); _drawSavedDoznaka();
        }
        _renderStavke();
        _notify('showSuccess', 'Preimenovano', novo);
    };

    // Stari pozivi (_renderTragoviList/_renderTackeList/...) su zadržani kao
    // omotači — svi rade isto: osvježe objedinjenu listu.
    function _renderTragoviList() { return _renderStavke(); }
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
        if (!menu) return;
        var willShow = menu.classList.contains('hidden');
        if (willShow) {
            _hideOstaloMenu(); // samo jedan popup otvoren odjednom
            menu.style.bottom = _bottomStackOffset(true) + 'px';
            _stavkeFotoCache = null; // svježe čitanje IndexedDB-a pri svakom otvaranju
            _renderStavke();
            _drainSjekQueue(); // radnik gleda spisak — dobar trenutak za pokušaj slanja
        }
        menu.classList.toggle('hidden', !willShow);
    }
    function _toggleOstaloMenu() {
        var menu = document.getElementById('radnik-mapa-ostalo-menu');
        if (!menu) return;
        var willShow = menu.classList.contains('hidden');
        if (willShow) {
            _hideTragoviMenu();
            menu.style.bottom = _bottomStackOffset(true) + 'px';
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
        // Ako je globalni "Offline" baner (index.html) već prikazan u trenutku
        // otvaranja Karte, ukloni ga odmah — showBanner() od sada odbija da se
        // ponovo prikaže dok je Karta otvorena, ali sam po sebi ne nestaje bez
        // ovog poziva. Direktna DOM manipulacija (ne offlineBannerHide()) jer
        // ta funkcija ima "if (!navigator.onLine) return;" — baš stanje u
        // kojem je ovaj baner i prikazan.
        var _offBanner = document.getElementById('app-offline-banner');
        if (_offBanner) {
            _offBanner.style.opacity = '0';
            _offBanner.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(function() { _offBanner.style.display = 'none'; }, 320);
        }
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
        if (typeof window.mapaRadnikaCloseSjecePanel === 'function') window.mapaRadnikaCloseSjecePanel();
        if (typeof window.mapaRadnikaCloseMjerenjePanel === 'function') window.mapaRadnikaCloseMjerenjePanel();
        if (typeof window.mapaRadnikaCancelIzvrsenoPoligon === 'function') window.mapaRadnikaCancelIzvrsenoPoligon();
        _stopLokacija(); // ne ostavljaj GPS watchPosition da radi u pozadini nakon izlaska s mape
        _stopHeadingView(); // ne ostavljaj deviceorientation listener da radi u pozadini
        // Isto i za preuzimanje karte: bez ovoga bi stotine zahtjeva za pločice
        // nastavile curiti u pozadini nakon što korisnik izađe s Karte.
        if (_offlinePreuzimanjeUToku) _offlineAbort = true;
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
        _positionRecBar(); // visina donje trake se mijenja pri rotaciji ekrana
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
            // Zaseban pane za "smjer gledanja" konus — z-index EKSPLICITNO iznad
            // overlayPane-a (400) gdje žive svi ostali slojevi. Konus koristi SVOJ
            // L.canvas() renderer (_drawHeadingCone), pa .bringToFront() ne djeluje
            // preko granice canvas/SVG renderera — pane sa višim z-indexom je jedini
            // garantovan način (nezavisan od redosljeda DOM-a/redraw-a) da konus
            // ostane iznad. Kreiran JEDNOM ovdje, ne lijeno u _drawHeadingCone.
            _map.createPane('rmHeadingPane');
            _map.getPane('rmHeadingPane').style.zIndex = 450; // iznad overlayPane(400), ispod markerPane(600)
            // Zaseban pane za doznačena stabla (canvas renderer, vidi
            // _drawSavedDoznaka) — isti razlog kao rmHeadingPane: canvas i
            // SVG su odvojeni DOM čvorovi u istom overlayPane-u, pa
            // .bringToFront() ne djeluje preko te granice; pane sa eksplicitnim
            // z-indexom je jedini pouzdan način da stabla ostanu iznad odjel
            // poligona nakon svakog redraw-a.
            _map.createPane('rmDoznakaPane');
            _map.getPane('rmDoznakaPane').style.zIndex = 440; // iznad overlayPane(400), ispod rmHeadingPane(450)
            // Isti razlog i za stvarno ofarbane sjekačke linije (canvas
            // renderer, _drawSjekLinije): moraju stajati IZNAD generisanih
            // plan-linija, koje su u dijeljenom SVG rendereru overlayPane-a.
            _map.createPane('rmSjekPane');
            _map.getPane('rmSjekPane').style.zIndex = 435; // iznad overlayPane(400), ispod rmDoznakaPane(440)
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
                if (_handleIzvrsenoClick(e.latlng)) return;
                if (_handleSjeceDirectionClick(e.latlng)) return;
                if (_handleMjerenjeClick(e.latlng)) return;
                _hideInfoPanel();
            });
            // Veličina "Prikaži odjele" oznaka prati zoom mape (manje odzumirano,
            // veće približeno) — vidi _updateLabelSizes.
            _map.on('zoomend', _updateLabelSizes);
            _map.on('zoomend', _updateTackaSizes);
            _map.on('zoomend', _updateDoznakaVisibility);
            // Konus smjera gledanja se inače crta samo iz kompas/GPS eventa —
            // bez ovoga bi promjena veličine (_headingConeRadiusM) kasnila dok
            // ne stigne sljedeće očitanje nakon čistog zooma.
            _map.on('zoomend', function() {
                if (_headingActive && _headingLastDeg != null) _drawHeadingCone(_headingLastDeg);
            });
            _updateLabelSizes();
            // Bez ovoga Leaflet hvata touch/scroll geste unutar panela kao
            // pan/zoom mape — skrolanje prstom kroz duži spisak sortimenata
            // (kad odjel ima puno njih) nikad ne bi stiglo do panela, pa bi
            // dio podataka ostao "nedostupan" ispod vidljivog dijela.
            // Isto vrijedi za SVE preklopne elemente unutar Leaflet kontejnera:
            // bez disableClickPropagation klik na dugme u njima PROPADNE i na
            // mapu ispod. Kod klik-modova (biranje tačke rute, crtanje pravca
            // sječačkih linija, tačke poligona) to znači da sam tap na dugme
            // koje POKREĆE mod odmah bude pojeden kao prva tačka tog moda —
            // na mjestu gdje dugme stoji, a ne gdje je radnik htio.
            ['radnik-mapa-info-panel', 'radnik-mapa-route-hint', 'radnik-mapa-sjece-panel',
             'radnik-mapa-explorer', 'radnik-mapa-sat-btn', 'radnik-mapa-close-btn',
             'radnik-mapa-mjerenje-panel'
            ].forEach(function(id) {
                var el = document.getElementById(id);
                if (!el) return;
                L.DomEvent.disableClickPropagation(el);
                L.DomEvent.disableScrollPropagation(el);
            });
            _bindBarButtons();
            _drawSavedTracks();
            _drawSavedPoligoni();
            _drawSavedTacke();
            _drawSavedFoto();
            _drawSavedMjerenja();
            _drawSavedDoznaka();
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
            // Sačuvana konfiguracija sječačkih linija (odjel+azimut+razmak) —
            // regeneriši i prikaži bez ponovnog unosa (geometrija se lako
            // ponovo izračuna, ne čuvamo je samu). Mora ići NAKON _renderLayer
            // jer zavisi od _geojson (učitanog u _loadGeojson() iznad).
            _restoreSjeceIfSaved();
            // Stvarno ofarbane linije (server) — isto zavisi od _geojson jer
            // se crtaju za odjel vraćen iz sačuvane konfiguracije. Red čekanja
            // se prazni pri svakom otvaranju mape (radnik se vratio u signal).
            _restoreSjekLinije();
            _drainSjekQueue();

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
    var INPUT_MODAL_IDS = ['tacka-name-modal', 'trag-name-modal', 'poligon-name-modal', 'foto-name-modal', 'stavka-edit-modal', 'doznaka-name-modal', 'sjek-name-modal'];
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

    // Radnik je bio bez signala, sad ga ima — pokušaj poslati sve što čeka
    // u redu (2 s odgode: 'online' zna okinuti prije nego veza stvarno proradi).
    window.addEventListener('online', function() {
        setTimeout(function() { _drainSjekQueue(); }, 2000);
    });

    console.log('[MapaRadnika] modul učitan');
})();
