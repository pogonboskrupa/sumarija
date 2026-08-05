// ========== ŠIHTARICA — mjesečna evidencija radnih dana ==========
//
// Prikazuje SVE dane u mjesecu (ne samo one sa unosom), pa radnik odmah vidi
// šta nije popunjeno. Dani na kojima postoji sječa/otprema se automatski
// označavaju kao Rad — ti podaci se NE čuvaju lokalno nego se svaki put
// izvode iz istog keša koji puni tab "Pregled sječe"/"Pregled otpreme"
// (cache_primac_detail_<godina>). Tako se šihtarica sama ažurira kad stigne
// nova sječa, i radi offline jednako dobro kao i taj tab.
//
// Ručni unosi (godišnji, bolovanje, praznik...) čuvaju se LOKALNO po korisniku
// u localStorage — isti obrazac kao tragovi/tačke u mapa-radnika.js. Zapisi su
// sitni (datum + tip + kratka napomena) pa localStorage kvota nije problem;
// IndexedDB je rezervisan za velike stvari (fotografije, keš primki).
//
// NAPOMENA: u apps-script/ postoji i serverski backend za šihtaricu
// (add-sihtarica-primac / get-sihtarica / ŠIHTARICA_GODISNJI_DANI). Ovdje se
// NAMJERNO ne koristi — dogovoreno je lokalno čuvanje, bez zavisnosti od toga
// da li je deployana verzija Apps Scripta u koraku sa repoom.
(function() {
    'use strict';

    var DANI = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'];
    var MJESECI = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
                   'Jul', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

    // Vrste dana. `radni: true` znači da se broji kao odrađen dan u rekapu.
    var TIPOVI = [
        { id: 'rad',       label: 'Rad',            ikona: '🪓', boja: '#047857', radni: true },
        { id: 'teren',     label: 'Terenski rad',   ikona: '🥾', boja: '#0891b2', radni: true },
        { id: 'godisnji',  label: 'Godišnji odmor', ikona: '🏖️', boja: '#d97706', radni: false },
        { id: 'bolovanje', label: 'Bolovanje',      ikona: '🏥', boja: '#dc2626', radni: false },
        { id: 'praznik',   label: 'Praznik',        ikona: '🎉', boja: '#7c3aed', radni: false },
        { id: 'slobodan',  label: 'Slobodan dan',   ikona: '🏠', boja: '#6b7280', radni: false }
    ];
    function _tip(id) {
        for (var i = 0; i < TIPOVI.length; i++) if (TIPOVI[i].id === id) return TIPOVI[i];
        return null;
    }

    // ---- Stanje prikaza ----
    var _stanje = { primac: null, otpremac: null }; // { godina, mjesec, autoDani }

    // window.currentUser NIKAD nije postavljen u aplikaciji (currentUser je
    // modul-scoped `let` u js/app.js, ne window property — isti razlog kao
    // _currentUserObj() u js/mapa-radnika.js) — bez fallback-a na localStorage
    // bi SVI korisnici na istom uređaju dijelili isti "anon" ključ.
    function _username() {
        if (window.currentUser && window.currentUser.username) return window.currentUser.username;
        try {
            var u = JSON.parse(localStorage.getItem('sumarija_user') || 'null');
            return (u && u.username) || 'anon';
        } catch (_) { return 'anon'; }
    }
    function _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ---- Čuvanje (localStorage, po korisniku) ----
    // Unosi: { "2026-07-15": { tip: "godisnji", napomena: "..." }, ... }
    function _unosiKey() { return 'sihtarica_unosi_' + _username(); }
    function _loadUnosi() {
        try {
            var raw = localStorage.getItem(_unosiKey());
            return raw ? JSON.parse(raw) : {};
        } catch (_) { return {}; }
    }
    function _saveUnosi(o) {
        try { localStorage.setItem(_unosiKey(), JSON.stringify(o)); } catch (_) {}
    }
    // Ugovoreni dani godišnjeg — jedan broj po korisniku
    function _godKey() { return 'sihtarica_godisnji_' + _username(); }
    function _loadGodDana() {
        var v = parseInt(localStorage.getItem(_godKey()), 10);
        return isNaN(v) ? 0 : v;
    }
    function _saveGodDana(n) {
        try { localStorage.setItem(_godKey(), String(n)); } catch (_) {}
    }

    // ---- Pomoćno oko datuma ----
    function _iso(g, m, d) {  // m je 0-baziran
        return g + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }
    function _danaUMjesecu(g, m) { return new Date(g, m + 1, 0).getDate(); }
    function _jeVikend(g, m, d) {
        var w = new Date(g, m, d).getDay();
        return w === 0 || w === 6;
    }

    // ---- Automatski radni dani iz sječe/otpreme ----
    // Vraća { dani: {"2026-07-15": {ukupno:12.4, unosa:2}}, greska: false }.
    // `greska: true` znači da API odgovor nije stigao/ispravan (mreža,
    // istekla sesija, serverska greška...) — RAZLIČITO od "radnik stvarno
    // nema nijednu sječu/otpremu ovaj mjesec" (validno prazan `dani`, ali
    // `greska: false`). _render koristi ovo razlikovanje da prikaže
    // upozorenje SAMO kad je nešto stvarno pošlo po zlu, ne za svaki prazan
    // mjesec (ranije se svaka greška tiho gutala — korisnik je vidio
    // "nema automatskog popunjavanja" bez ijednog traga zašto).
    // `mjesec` je opcionalan — ako se izostavi, vraća se CIJELA godina
    // (koristi _godisnjiPregled ispod). Keš je već po godini (jedan API poziv
    // za sve mjesece), pa ovo ne pravi dodatni mrežni poziv kad se mjesečni i
    // godišnji prikaz preklapaju na istoj godini.
    async function _autoDani(tip, godina, mjesec) {
        var out = {};
        try {
            if (typeof buildApiUrl !== 'function' || typeof fetchWithCache !== 'function') {
                console.warn('[ŠIHTARICA] buildApiUrl/fetchWithCache nisu dostupni — auto-popuna preskočena.');
                return { dani: out, greska: true };
            }
            var path = tip === 'primac' ? 'primac-detail' : 'otpremac-detail';
            var kljuc = 'cache_' + (tip === 'primac' ? 'primac' : 'otpremac') + '_detail_' + godina;
            var data = await fetchWithCache(buildApiUrl(path, { year: godina }), kljuc);
            if (data && data.offline) {
                // Offline bez keša — ne tretiraj kao grešku (fetchWithCache
                // ovo namjerno vraća da callers mogu tiho pokazati prazno).
                return { dani: out, greska: false };
            }
            if (!data || data.error || !data.unosi || !Array.isArray(data.unosi)) {
                console.warn('[ŠIHTARICA] Neispravan/prazan odgovor za auto-popunu (' + path + '):', data && data.error);
                return { dani: out, greska: true };
            }
            data.unosi.forEach(function(u) {
                if (!u || !u.datum) return;
                // datum stiže kao DD.MM.YYYY (formatDate u apps-script/utils-triggers.gs),
                // ali split po /.- pokriva i varijante iz starijih zapisa
                var p = String(u.datum).split(/[\/\.\-]/);
                if (p.length < 3) return;
                var d = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, g = parseInt(p[2], 10);
                if (g !== godina || (mjesec != null && m !== mjesec)) return;
                var k = _iso(g, m, d);
                if (!out[k]) out[k] = { ukupno: 0, unosa: 0, odjeli: [] };
                out[k].ukupno += (typeof u.ukupno === 'number' ? u.ukupno : parseFloat(u.ukupno) || 0);
                out[k].unosa += 1;
                // Odjel se prikazuje umjesto generičnog "Rad" — konkretnije je
                // i odmah se vidi gdje je radnik bio tog dana.
                var od = String(u.odjel == null ? '' : u.odjel).trim();
                if (od && out[k].odjeli.indexOf(od) === -1) out[k].odjeli.push(od);
            });
        } catch (e) {
            console.warn('[ŠIHTARICA] Greška pri dohvatu auto-popune:', e);
            return { dani: out, greska: true };
        }
        return { dani: out, greska: false };
    }

    // ---- Efektivna vrsta dana ----
    // Ručni unos uvijek pobjeđuje; ako ga nema, dan sa sječom/otpremom je Rad.
    function _efektivniTip(iso, unosi, auto) {
        if (unosi[iso] && unosi[iso].tip) return unosi[iso].tip;
        if (auto[iso]) return 'rad';
        return null;
    }

    // ---- Iskorišteni godišnji u CIJELOJ godini (ne samo tekućem mjesecu) ----
    function _iskoristenGodisnji(godina, unosi) {
        var n = 0;
        Object.keys(unosi).forEach(function(iso) {
            if (unosi[iso] && unosi[iso].tip === 'godisnji' && iso.slice(0, 4) === String(godina)) n++;
        });
        return n;
    }

    function _fmtM3(v) {
        return (Math.round(v * 100) / 100).toLocaleString('de-DE', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }

    // ---- Godišnji pregled (1.1. do DANAS tekuće godine) ----
    // Prikazuje se u zaglavlju pored birača mjeseca/godine, uvijek za TEKUĆU
    // kalendarsku godinu do DANAŠNJEG dana — NEZAVISNO od toga koji
    // mjesec/godinu radnik trenutno pregleda u tabeli ispod (zato se ne
    // preračunava pri svakoj promjeni mjeseca, samo jednom po otvaranju taba).
    function _izracunajGodisnjiPregled(godina, autoGodina) {
        var unosi = _loadUnosi();
        var rekap = {};
        TIPOVI.forEach(function(t) { rekap[t.id] = 0; });
        var danas = new Date();
        var zadnjiMjesec = danas.getMonth();
        var zadnjiDan = danas.getDate();
        for (var m = 0; m <= zadnjiMjesec; m++) {
            var danaUMj = (m === zadnjiMjesec) ? zadnjiDan : _danaUMjesecu(godina, m);
            for (var d = 1; d <= danaUMj; d++) {
                var t = _tip(_efektivniTip(_iso(godina, m, d), unosi, autoGodina));
                if (t) rekap[t.id]++;
            }
        }
        var radnihDana = 0;
        TIPOVI.forEach(function(t) { if (t.radni) radnihDana += rekap[t.id]; });
        return { godina: godina, radnihDana: radnihDana, rekap: rekap };
    }

    function _godPregledHtml(tip, st, akcent) {
        var sadGod = new Date().getFullYear();
        if (!st.godPregled) {
            return '<div class="sih-god-pregled"><span class="sih-god-pregled-naslov">📅 Učitavam pregled ' + sadGod + '. ...</span></div>';
        }
        var gp = st.godPregled;
        var danas = new Date();
        var html = '<div class="sih-god-pregled">';
        html += '<span class="sih-god-pregled-naslov">📅 ' + gp.godina + '. (1.1.–' +
                danas.getDate() + '.' + (danas.getMonth() + 1) + '.)</span>';
        html += '<div class="sih-god-pregled-item"><span class="sih-god-pregled-val" style="color:' + akcent + ';">' +
                gp.radnihDana + '</span><span class="sih-god-pregled-label">Radnih</span></div>';
        TIPOVI.forEach(function(t) {
            if (t.radni) return; // radni tipovi su već sabrani u "Radnih"
            html += '<div class="sih-god-pregled-item"><span class="sih-god-pregled-val">' + gp.rekap[t.id] +
                    '</span><span class="sih-god-pregled-label">' + t.ikona + ' ' + t.label + '</span></div>';
        });
        if (st.godPregledGreska) {
            html += '<span class="sih-god-pregled-greska" title="Automatsko popunjavanje iz sječe/otpreme trenutno nije uspjelo — brojevi možda nisu ažurni">⚠️</span>';
        }
        html += '</div>';
        return html;
    }

    // ================== RENDER ==================
    function _render(tip) {
        var st = _stanje[tip];
        if (!st) return;
        var body = document.getElementById('sihtarica-' + tip + '-body');
        if (!body) return;

        var g = st.godina, m = st.mjesec;
        var unosi = _loadUnosi();
        var auto = st.autoDani || {};
        var dana = _danaUMjesecu(g, m);
        var akcent = tip === 'primac' ? '#047857' : '#2563eb';

        // --- Zaglavlje: izbor mjeseca/godine ---
        var sadGod = new Date().getFullYear();
        var godOpcije = '';
        for (var y = sadGod - 2; y <= sadGod + 1; y++) {
            godOpcije += '<option value="' + y + '"' + (y === g ? ' selected' : '') + '>' + y + '</option>';
        }
        var mjOpcije = '';
        for (var i = 0; i < 12; i++) {
            mjOpcije += '<option value="' + i + '"' + (i === m ? ' selected' : '') + '>' + MJESECI[i] + '</option>';
        }

        var html = '';
        html += '<div class="sih-toolbar">' +
            '<select class="year-select" onchange="sihtaricaPromijeni(\'' + tip + '\')" id="sih-' + tip + '-mjesec">' + mjOpcije + '</select>' +
            '<select class="year-select" onchange="sihtaricaPromijeni(\'' + tip + '\')" id="sih-' + tip + '-godina">' + godOpcije + '</select>' +
            _godPregledHtml(tip, st, akcent) +
            '</div>';

        // Auto-popuna dana (iz sječe/otpreme) nije uspjela — RAZLIČITO od
        // "radnik stvarno nema nijedan unos ovaj mjesec" (tada nema ove
        // poruke). Bez ovoga korisnik vidi prazan mjesec bez ijednog traga
        // da je uzrok mreža/sesija, ne da stvarno nije radio.
        if (st.autoGreska) {
            html += '<div class="sih-upozorenje">⚠️ Automatsko popunjavanje dana iz sječe/otpreme trenutno nije uspjelo ' +
                '(mreža ili istekla sesija) — dani i kubici ispod možda nisu ažurni. Provjerite konekciju i ponovo otvorite tab.</div>';
        }

        // --- Kartica godišnjeg odmora ---
        // Naslov + ikonica su NUŽNI da se odmah vidi na šta se brojevi
        // odnose — bez njih kartica izgleda kao neobilježen skup cifara
        // (samo "Ugovoreno/Iskorišteno/Preostalo" ne kaže čega).
        var ugovoreni = _loadGodDana();
        var iskoristen = _iskoristenGodisnji(g, unosi);
        var preostalo = ugovoreni - iskoristen;
        html += '<div class="sih-god-card">';
        html += '<div class="sih-god-naslov">🏖️ Godišnji odmor</div>';
        html += '<div class="sih-god-row">' +
            '<div class="sih-god-item"><span class="sih-god-label">Ugovoreno dana</span>' +
                '<span class="sih-god-val">' + ugovoreni + '</span></div>' +
            '<div class="sih-god-item"><span class="sih-god-label">Iskorišteno ' + g + '.</span>' +
                '<span class="sih-god-val" style="color:#d97706;">' + iskoristen + '</span></div>' +
            '<div class="sih-god-item"><span class="sih-god-label">Preostalo</span>' +
                '<span class="sih-god-val" style="color:' + (preostalo < 0 ? '#dc2626' : '#047857') + ';">' + preostalo + '</span></div>' +
            '<button type="button" class="btn btn-secondary sih-god-btn" onclick="sihtaricaPostaviGodisnji(\'' + tip + '\')">' +
                '⚙️ Postavi broj dana godišnjeg odmora po ugovoru</button>' +
            '</div>';
        html += '</div>';
        if (ugovoreni === 0) {
            html += '<div class="sih-god-hint">Broj ugovorenih dana još nije postavljen — kliknite dugme iznad.</div>';
        } else if (preostalo < 0) {
            html += '<div class="sih-upozorenje">⚠️ Iskorišteno je ' + Math.abs(preostalo) +
                ' dana više nego što je ugovoreno.</div>';
        }

        // --- Tabela dana ---
        var rekap = {};
        TIPOVI.forEach(function(t) { rekap[t.id] = 0; });
        var ukupnoM3 = 0, neupisanihRadnih = 0;

        var labelKub = tip === 'primac' ? 'Sječa' : 'Otprema';
        html += '<div class="sih-scroll"><table class="sih-table"><thead><tr>' +
            '<th>Dan</th><th>Vrsta</th><th>Napomena</th><th class="sih-num">' + labelKub + '</th><th></th>' +
            '</tr></thead><tbody>';

        var danasIso = _iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

        for (var d = 1; d <= dana; d++) {
            var iso = _iso(g, m, d);
            var vikend = _jeVikend(g, m, d);
            var a = auto[iso];
            var et = _efektivniTip(iso, unosi, auto);
            var t = _tip(et);
            var napomena = (unosi[iso] && unosi[iso].napomena) || '';

            if (t) rekap[t.id]++;
            if (a) ukupnoM3 += a.ukupno;
            if (!t && !vikend) neupisanihRadnih++;

            var klase = 'sih-row' + (vikend ? ' sih-vikend' : '') +
                        (!t && !vikend ? ' sih-prazan' : '') +
                        (iso === danasIso ? ' sih-danas' : '');
            html += '<tr class="' + klase + '">';

            // Akcentna ivica lijevo u boji vrste dana — vrsta se vidi i bez
            // čitanja badža, korisno pri brzom skrolu kroz mjesec.
            var ivica = t ? t.boja : (vikend ? '#cbd5e1' : 'transparent');
            html += '<td class="sih-dan" style="box-shadow:inset 4px 0 0 ' + ivica + ';">' +
                    '<span class="sih-dan-broj">' + d + '.</span>' +
                    '<span class="sih-dan-ime">' + DANI[new Date(g, m, d).getDay()] + '</span>' +
                    (iso === danasIso ? '<span class="sih-danas-tag">danas</span>' : '') +
                    '</td>';

            if (t) {
                // Za radne dane sa evidentiranom sječom/otpremom prikazuje se
                // KONKRETAN odjel umjesto generičnog "Rad".
                var oznaka = t.label;
                if (t.id === 'rad' && a && a.odjeli.length) {
                    oznaka = (a.odjeli.length === 1 ? 'Odjel ' : 'Odjeli ') + a.odjeli.join(', ');
                }
                html += '<td data-label="Vrsta"><span class="sih-badge" style="background:' + t.boja + ';">' +
                        t.ikona + ' ' + _esc(oznaka) + '</span>' +
                        (!unosi[iso] ? '<span class="sih-auto">auto</span>' : '') + '</td>';
            } else {
                html += '<td data-label="Vrsta"><span class="sih-nema">' + (vikend ? 'vikend' : 'nije upisano') + '</span></td>';
            }

            html += '<td class="sih-napomena" data-label="Napomena">' + _esc(napomena) + '</td>';
            html += '<td class="sih-num" data-label="' + labelKub + '">' + (a ? _fmtM3(a.ukupno) + ' m³' : '<span class="sih-nula">–</span>') + '</td>';
            html += '<td class="sih-akcija"><button type="button" class="sih-edit" ' +
                    'onclick="sihtaricaUredi(\'' + tip + '\',\'' + iso + '\')" aria-label="Uredi dan">✏️</button></td>';
            html += '</tr>';
        }
        html += '</tbody></table></div>';

        // --- Rekap mjeseca ---
        var radnihDana = 0;
        TIPOVI.forEach(function(t) { if (t.radni) radnihDana += rekap[t.id]; });

        html += '<div class="sih-rekap"><div class="sih-rekap-naslov">📊 Rekap za ' + MJESECI[m] + ' ' + g + '.</div>';
        html += '<div class="sih-rekap-grid">';
        html += '<div class="sih-rekap-item sih-rekap-glavni"><span class="sih-rekap-label">Radnih dana</span>' +
                '<span class="sih-rekap-val" style="color:' + akcent + ';">' + radnihDana + '</span></div>';
        TIPOVI.forEach(function(t) {
            if (t.radni) return; // radni tipovi su već sabrani u "Radnih dana"
            html += '<div class="sih-rekap-item"><span class="sih-rekap-label">' + t.ikona + ' ' + t.label + '</span>' +
                    '<span class="sih-rekap-val">' + rekap[t.id] + '</span></div>';
        });
        html += '<div class="sih-rekap-item"><span class="sih-rekap-label">Ukupno ' +
                (tip === 'primac' ? 'sječa' : 'otprema') + '</span>' +
                '<span class="sih-rekap-val">' + _fmtM3(ukupnoM3) + ' m³</span></div>';
        html += '</div>';
        if (neupisanihRadnih > 0) {
            html += '<div class="sih-rekap-hint">Nije upisano ' + neupisanihRadnih +
                    ' radnih dana (bez vikenda) — kliknite ✏️ da popunite.</div>';
        }
        html += '</div>';

        body.innerHTML = html;
    }

    // ---- Puni ekran (isti obrazac kao Karta/Kubikator) ----
    // Aplikacija inače drži viewport na width=1280 (setAppViewport, index.html)
    // za sve korisnike, na svakom uređaju (vidi docs/VIEWPORT-PROBLEM-I-RJESENJE.md).
    // Dok je Šihtarica otvorena, viewport se privremeno prebaci na
    // width=device-width — isti trik kao Karta/Kubikator, tabela dana je
    // gusta pa se bolje čita na stvarnoj rezoluciji ekrana.
    function _enterFullscreen() {
        document.body.classList.add('sihtarica-fullscreen');
        var vp = document.querySelector('meta[name=viewport]');
        if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
    }
    function _exitFullscreen() {
        // Stražar: exitSihtaricaFullscreenIfActive se poziva pri SVAKOM prelasku
        // na bilo koji drugi tab, ne samo kad je Šihtarica stvarno bila otvorena.
        if (!document.body.classList.contains('sihtarica-fullscreen')) return;
        document.body.classList.remove('sihtarica-fullscreen');
        if (typeof window.setAppViewport === 'function') window.setAppViewport();
    }

    // Pozivaju se iz switchTab (js/ui.js) PRIJE grane koja može rano izaći na
    // svjež keš — inače bi se pri povratku na već renderovan tab preskočilo.
    window.enterSihtaricaFullscreenIfActive = function(tab) {
        if (tab === 'sihtarica-primac' || tab === 'sihtarica-otpremac') _enterFullscreen();
    };
    window.exitSihtaricaFullscreenIfActive = function(nextTab) {
        if (nextTab !== 'sihtarica-primac' && nextTab !== 'sihtarica-otpremac') _exitFullscreen();
    };

    window.closeSihtarica = function(tip) {
        _exitFullscreen();
        var home = tip === 'otpremac' ? 'otpremac-personal' : 'primac-personal';
        if (typeof switchTab === 'function') switchTab(home);
    };

    // ================== JAVNE FUNKCIJE ==================

    window.loadSihtarica = async function(tip) {
        var tabId = 'sihtarica-' + tip;
        var contentId = 'sihtarica-' + tip + '-content';
        if (typeof isActiveTab === 'function' && !isActiveTab(tabId)) return;
        _enterFullscreen();

        var el = document.getElementById(contentId);
        if (el) el.classList.remove('hidden');
        var ls = document.getElementById('loading-screen');
        if (ls) ls.classList.add('hidden');

        if (!_stanje[tip]) {
            var sad = new Date();
            _stanje[tip] = {
                godina: sad.getFullYear(), mjesec: sad.getMonth(), autoDani: {}, autoGreska: false,
                godPregled: null, godPregledGreska: false
            };
        }
        // Prvo iscrtaj iz lokalnih podataka (trenutno), pa dopuni automatskim
        // danima kad stignu — tako tab nikad ne stoji prazan dok se čeka mreža.
        _render(tip);
        var st = _stanje[tip];
        var rez = await _autoDani(tip, st.godina, st.mjesec);
        st.autoDani = rez.dani;
        st.autoGreska = rez.greska;
        if (typeof isActiveTab === 'function' && !isActiveTab(tabId)) return;
        _render(tip);

        // Godišnji pregled je UVIJEK za tekuću kalendarsku godinu (do danas),
        // nezavisno od izabranog mjeseca/godine iznad — vidi _izracunajGodisnjiPregled.
        // Isti keš/API poziv kao mjesečna auto-popuna kad je izabrana godina =
        // tekuća (fetchWithCache dedupe), pa ovo ne dodaje mrežni trošak.
        var sadGod = new Date().getFullYear();
        var rezGod = await _autoDani(tip, sadGod);
        st.autoGodina = rezGod.dani; // čuva se da se pregled može osvježiti bez ponovnog fetch-a (vidi _refreshGodPregled)
        st.godPregled = _izracunajGodisnjiPregled(sadGod, rezGod.dani);
        st.godPregledGreska = rezGod.greska;
        if (typeof isActiveTab === 'function' && !isActiveTab(tabId)) return;
        _render(tip);

        if (typeof markTabRendered === 'function') markTabRendered(tabId);
    };

    window.sihtaricaPromijeni = async function(tip) {
        var st = _stanje[tip];
        if (!st) return;
        var mEl = document.getElementById('sih-' + tip + '-mjesec');
        var gEl = document.getElementById('sih-' + tip + '-godina');
        if (mEl) st.mjesec = parseInt(mEl.value, 10);
        if (gEl) st.godina = parseInt(gEl.value, 10);
        st.autoDani = {};
        _render(tip);
        var rez = await _autoDani(tip, st.godina, st.mjesec);
        st.autoDani = rez.dani;
        st.autoGreska = rez.greska;
        _render(tip);
    };

    // ---- Modal: uređivanje jednog dana ----
    var _edit = null; // { tip, iso }
    window.sihtaricaUredi = function(tip, iso) {
        _edit = { tip: tip, iso: iso };
        var unosi = _loadUnosi();
        var u = unosi[iso] || {};
        var d = iso.split('-');
        var dat = new Date(parseInt(d[0], 10), parseInt(d[1], 10) - 1, parseInt(d[2], 10));

        var naslov = document.getElementById('sihtarica-edit-datum');
        if (naslov) {
            naslov.textContent = parseInt(d[2], 10) + '. ' + MJESECI[parseInt(d[1], 10) - 1] + ' ' +
                d[0] + '. (' + DANI[dat.getDay()] + ')';
        }
        var sel = document.getElementById('sihtarica-edit-tip');
        if (sel) {
            // "Rad" se NE nudi za ručni izbor — to je isključivo automatski
            // izvedena oznaka za dane sa evidentiranom sječom/otpremom (vidi
            // _efektivniTip). Kad radnik ručno bira vrstu dana, podrazumijeva
            // se terenski rad — najčešći slučaj (dan bez sječe/otpreme, a
            // radnik je ipak bio na terenu).
            var trenutniTip = u.tip;
            var stAuto = (_stanje[tip] && _stanje[tip].autoDani) || {};
            var imaAuto = !!stAuto[iso];
            // Default na "teren" SAMO ako dan nema ni ručni unos ni auto
            // podatak — dan koji je već automatski "Rad" (sječa/otprema)
            // ostaje prazan izbor da se ne prepiše slučajnim Sačuvaj-om.
            if (!trenutniTip && !imaAuto) trenutniTip = 'teren';

            var o = '<option value="">— nije upisano —</option>';
            TIPOVI.forEach(function(t) {
                if (t.id === 'rad') return; // vidi komentar iznad
                o += '<option value="' + t.id + '"' + (trenutniTip === t.id ? ' selected' : '') + '>' +
                     t.ikona + ' ' + t.label + '</option>';
            });
            sel.innerHTML = o;
        }
        var nap = document.getElementById('sihtarica-edit-napomena');
        if (nap) nap.value = u.napomena || '';

        var modal = document.getElementById('sihtarica-edit-modal');
        if (modal) modal.classList.add('show');
    };

    window.closeSihtaricaEditModal = function() {
        var modal = document.getElementById('sihtarica-edit-modal');
        if (modal) modal.classList.remove('show');
        _edit = null;
    };

    window.confirmSihtaricaEdit = function() {
        if (!_edit) { window.closeSihtaricaEditModal(); return; }
        var sel = document.getElementById('sihtarica-edit-tip');
        var nap = document.getElementById('sihtarica-edit-napomena');
        var vrsta = sel ? sel.value : '';
        var napomena = nap ? nap.value.trim() : '';

        var unosi = _loadUnosi();
        if (!vrsta && !napomena) {
            delete unosi[_edit.iso];          // prazno = obriši unos, vrati na auto
        } else {
            unosi[_edit.iso] = { tip: vrsta, napomena: napomena };
        }
        _saveUnosi(unosi);

        var tip = _edit.tip;
        window.closeSihtaricaEditModal();
        _refreshGodPregled(tip); // uređeni dan može biti u 1.1.-danas rasponu
        _render(tip);
        if (typeof showSuccess === 'function') showSuccess('Šihtarica ažurirana');
    };

    // Ponovo izračuna godišnji pregled iz VEĆ preuzetih auto-dana (bez novog
    // mrežnog poziva) — poziva se poslije ručne izmjene dana koja može upasti
    // u raspon 1.1.-danas tekuće godine.
    function _refreshGodPregled(tip) {
        var st = _stanje[tip];
        if (!st || !st.autoGodina) return;
        st.godPregled = _izracunajGodisnjiPregled(new Date().getFullYear(), st.autoGodina);
    }

    // ---- Modal: broj dana godišnjeg ----
    var _godTip = null;
    window.sihtaricaPostaviGodisnji = function(tip) {
        _godTip = tip;
        var inp = document.getElementById('sihtarica-god-input');
        if (inp) inp.value = _loadGodDana() || '';
        var modal = document.getElementById('sihtarica-god-modal');
        if (modal) modal.classList.add('show');
        setTimeout(function() { if (inp) { inp.focus(); inp.select(); } }, 50);
    };
    window.closeSihtaricaGodModal = function() {
        var modal = document.getElementById('sihtarica-god-modal');
        if (modal) modal.classList.remove('show');
        _godTip = null;
    };
    window.confirmSihtaricaGod = function() {
        var inp = document.getElementById('sihtarica-god-input');
        var n = inp ? parseInt(inp.value, 10) : NaN;
        if (isNaN(n) || n < 0) n = 0;
        _saveGodDana(n);
        var tip = _godTip;
        window.closeSihtaricaGodModal();
        if (tip) _render(tip);
        if (typeof showSuccess === 'function') showSuccess('Godišnji odmor', n + ' ugovorenih dana.');
    };
})();
