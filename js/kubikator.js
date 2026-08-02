// ============================================================
// KUBIKATOR — Terenski kalkulator zapremine drvnih sortimenata
//
// Dva moda, prebacuje ih dugme uz "Zatvori" (kubikatorToggleMode):
//   • OBLOVINA (podrazumijevano) — Huberova formula: V = (π/4) × (d/100)² × L
//     d = prečnik na sredini trupca u cm, L = dužina u m.
//   • PROSTORNO DRVO — V = širina × visina × 0,63 (širina/visina slaganja u m).
//     0,63 = koeficijent pretvorbe prostornog u zapreminski oblik drvne mase
//     (0,7 osnovni koeficijent, umanjen za 10%).
//
// Namjerno svedeno na DVA polja po modu. Rezultat se računa DOK SE KUCA — ne
// treba pritiskati ništa da bi se vidjela zapremina; "Dodaj" služi samo da
// unos padne u memoriju ispod. Na terenu se kuca prstom, često u rukavicama,
// pa su polja i brojevi veliki.
//
// Otvara se preko cijelog ekrana, isti obrazac kao Karta (klasa
// body.kubikator-fullscreen + dugme "✕ Zatvori").
//
// Podaci su ISKLJUČIVO lokalni — localStorage['kubikator_unosi'], bez servera.
// VAŽNO: oblik zapisa se NE smije mijenjati. js/print-utils.js (printKubikator)
// čita u.odjel/u.sortiment/u.napomena bezuslovno — ta tri polja se zato i
// dalje upisuju kao prazan string, da i štampa i stariji zapisi (svi
// "oblovina", nastali prije nego je prostorno drvo dodano) nastave raditi.
// Svaki unos ima i u.vrsta ('oblovina'|'prostorno'); nedostaje li kod starih
// zapisa, čita se kao 'oblovina' (jedini mod koji je tad postojao).
// ============================================================

// ─── Klasifikacija sortimenata ────────────────────────────────
// NE UKLANJATI: ove liste koriste i druge komponente za bojenje sortimenata
// po grupi — js/mapa-radnika.js (_chipsFor, popup odjela) i
// js/izvjestaji-new.js (boje kolona). Sam Kubikator ih više ne koristi otkad
// je unos sveden na prečnik + dužinu.
const KUBIKATOR_CETINARI = [
    'F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'TRUPCI Č',
    'CEL.DUGA', 'CEL.CIJEPANA', 'ŠKART'
];
const KUBIKATOR_LISCARI = [
    'F/L L', 'I L', 'II L', 'III L', 'TRUPCI L',
    'OGR.DUGI', 'OGR.CIJEPANI', 'GULE'
];
const KUBIKATOR_SORTIMENTI = [...KUBIKATOR_CETINARI, ...KUBIKATOR_LISCARI];

(function() {
    'use strict';

    var KUB_KEY = 'kubikator_unosi';
    var VRSTA_KEY = 'kubikator_vrsta';   // pamti zadnje izabran mod između sesija
    var LOCK_KEY = 'kubikator_lock';     // zaključana dužina između unosa (samo oblovina)
    var PRVI_KEY = 'kubikator_prvi_unos_gotov'; // "24"/"4,50" prijedlog nestaje poslije prvog unosa ikad
    var MEM_PRIKAZ = 30;          // koliko zadnjih unosa se prikazuje u memoriji

    // Dozvoljeni opsezi — sve van ovoga je gotovo sigurno omaška u kucanju
    // (npr. prečnik u milimetrima ili dužina u centimetrima).
    var P_MIN = 7,  P_MAX = 150;  // prečnik, cijeli centimetri
    var D_MIN = 1,  D_MAX = 10;   // dužina u metrima, dvije decimale
    var KOEF_PROSTORNI = 0.63;    // prostorni → zapreminski oblik: 0,7 − 10% = 0,63
    var DEC = 2;                  // zapremina se prikazuje na dvije decimale
    var _unosi = [];
    var _vrsta = 'oblovina';      // 'oblovina' | 'prostorno'
    var _inited = false;
    var _lockDuzina = false;      // dužina ostaje poslije Dodaj (gomila je obično jednake dužine)
    var _justAdded = false;       // animacija u memoriji samo na redu koji je TEK dodan
    var _prviUnosGotov = false;   // true poslije prvog unosa ikad — gasi placeholder "24"/"4,50"

    // Zarez i tačka su na terenu ravnopravni ("4,50" i "4.50")
    function _num(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')); }

    function _fmt(v, dec) {
        return Number(v).toLocaleString('de-DE', {
            minimumFractionDigits: dec, maximumFractionDigits: dec
        });
    }

    function _load() {
        try {
            var raw = localStorage.getItem(KUB_KEY);
            _unosi = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(_unosi)) _unosi = [];
        } catch (_) { _unosi = []; }
        try {
            var v = localStorage.getItem(VRSTA_KEY);
            _vrsta = (v === 'prostorno') ? 'prostorno' : 'oblovina';
        } catch (_) { _vrsta = 'oblovina'; }
        try {
            var l = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
            _lockDuzina = !!l.duzina;
        } catch (_) { _lockDuzina = false; }
        try {
            _prviUnosGotov = localStorage.getItem(PRVI_KEY) === '1';
        } catch (_) { _prviUnosGotov = false; }
    }
    function _save() {
        try { localStorage.setItem(KUB_KEY, JSON.stringify(_unosi)); } catch (_) {}
    }
    function _saveLock() {
        try { localStorage.setItem(LOCK_KEY, JSON.stringify({ duzina: _lockDuzina })); } catch (_) {}
    }

    // "24"/"4,50" u poljima prečnik/dužina su prijedlog SAMO dok korisnik nikad
    // nije dodao nijedan unos — poslije prvog "Dodaj" (ikad, trajno) nestaju,
    // da se ne pomiješaju sa stvarnom vrijednosti kad je polje prazno.
    function _osvjeziPlaceholdere() {
        var p = _el('kub-precnik'), d = _el('kub-duzina');
        if (p) p.placeholder = _prviUnosGotov ? '' : '24';
        if (d) d.placeholder = _prviUnosGotov ? '' : '4,50';
    }

    function _el(id) { return document.getElementById(id); }

    function _zapremina(precnik, duzina) {
        return (Math.PI / 4) * Math.pow(precnik / 100, 2) * duzina;
    }
    function _zapreminaProstorna(sirina, visina) {
        return sirina * visina * KOEF_PROSTORNI;
    }

    // Polja aktivnog moda — jedno mjesto koje zna koja su "prvo"/"drugo"
    // polje trenutno na ekranu, da ga _osvjeziRezultat i kubikatorDodaj ne
    // moraju svaki posebno granati po _vrsta.
    function _poljaZaVrstu() {
        return _vrsta === 'prostorno'
            ? { prvo: _el('kub-sirina'), drugo: _el('kub-visina') }
            : { prvo: _el('kub-precnik'), drugo: _el('kub-duzina') };
    }

    // Trenutno upisane vrijednosti (za aktivni mod). Vraća { ok:false } uz
    // razlog dok unos nije potpun ili je van opsega, da se poruka i stanje
    // dugmeta izvedu s jednog mjesta.
    function _trenutno() {
        return _vrsta === 'prostorno' ? _trenutnoProstorno() : _trenutnoOblovina();
    }

    function _trenutnoOblovina() {
        var pEl = _el('kub-precnik'), dEl = _el('kub-duzina');
        var pRaw = pEl ? String(pEl.value).trim() : '';
        var dRaw = dEl ? String(dEl.value).trim() : '';
        var p = _num(pRaw), d = _num(dRaw);

        var pLose = pRaw !== '' && (!isFinite(p) || p < P_MIN || p > P_MAX);
        var dLose = dRaw !== '' && (!isFinite(d) || d < D_MIN || d > D_MAX);
        if (pLose || dLose) {
            var poruke = [];
            if (pLose) poruke.push('Prečnik mora biti između ' + P_MIN + ' i ' + P_MAX + ' cm');
            if (dLose) poruke.push('Dužina mora biti između ' + D_MIN + ' i ' + D_MAX + ' m');
            return { ok: false, greska: poruke.join(' · '), pLose: pLose, dLose: dLose };
        }
        if (pRaw === '' || dRaw === '') return { ok: false, greska: '', pLose: false, dLose: false };

        // Prečnik se mjeri u cijelim centimetrima
        p = Math.round(p);
        return { ok: true, precnik: p, duzina: d, zapremina: _zapremina(p, d) };
    }

    function _trenutnoProstorno() {
        var sEl = _el('kub-sirina'), vEl = _el('kub-visina');
        var sRaw = sEl ? String(sEl.value).trim() : '';
        var vRaw = vEl ? String(vEl.value).trim() : '';
        var s = _num(sRaw), v = _num(vRaw);

        var sLose = sRaw !== '' && (!isFinite(s) || s <= 0);
        var vLose = vRaw !== '' && (!isFinite(v) || v <= 0);
        if (sLose || vLose) {
            var poruke = [];
            if (sLose) poruke.push('Širina mora biti veća od 0');
            if (vLose) poruke.push('Visina mora biti veća od 0');
            return { ok: false, greska: poruke.join(' · '), pLose: sLose, dLose: vLose };
        }
        if (sRaw === '' || vRaw === '') return { ok: false, greska: '', pLose: false, dLose: false };

        return { ok: true, sirina: s, visina: v, zapremina: _zapreminaProstorna(s, v) };
    }

    // Živi rezultat — poziva se na svaki otkucaj
    function _osvjeziRezultat() {
        var box = _el('kub-rezultat');
        var btn = _el('kub-dodaj-btn');
        var grEl = _el('kub-greska');
        if (!box) return;
        var t = _trenutno();
        var okvir = box.parentElement;
        var polja = _poljaZaVrstu();

        if (grEl) {
            grEl.textContent = t.greska || '';
            grEl.classList.toggle('vidljiva', !!t.greska);
        }
        if (polja.prvo) polja.prvo.classList.toggle('nevalidan', !!t.pLose);
        if (polja.drugo) polja.drugo.classList.toggle('nevalidan', !!t.dLose);

        if (t.ok) {
            box.textContent = _fmt(t.zapremina, DEC) + ' m³';
            if (okvir) okvir.classList.remove('prazno');
            if (btn) btn.disabled = false;
        } else {
            box.textContent = '—';
            if (okvir) okvir.classList.add('prazno');
            if (btn) btn.disabled = true;
        }
        _osvjeziIlustraciju(t);
    }

    // Ilustracija ispod forme — prikazuje TRENUTNE vrijednosti da se odmah
    // vidi na šta se brojevi odnose i kako formula dolazi do rezultata.
    // Oba (oblovina/prostorno) bloka postoje u DOM-u; ažuriraju se oba —
    // vidljiv je samo onaj koji CSS pokazuje za trenutni mod (jeftinije i
    // jednostavnije nego pratiti koji je trenutno prikazan).
    function _osvjeziIlustraciju(t) {
        var dEl = _el('kub-ilus-d');
        if (dEl) {
            var lEl = _el('kub-ilus-l'), dmEl = _el('kub-ilus-dm'),
                lmEl = _el('kub-ilus-lm'), resEl = _el('kub-ilus-res');
            if (t.ok && _vrsta === 'oblovina') {
                dEl.textContent = _fmt(t.precnik, 0) + ' cm';
                lEl.textContent = _fmt(t.duzina, 2) + ' m';
                dmEl.textContent = _fmt(t.precnik / 100, 2) + ' m';
                lmEl.textContent = _fmt(t.duzina, 2) + ' m';
                resEl.textContent = _fmt(t.zapremina, DEC) + ' m³';
            } else {
                dEl.textContent = '—'; lEl.textContent = '—';
                dmEl.textContent = '—'; lmEl.textContent = '—'; resEl.textContent = '— m³';
            }
        }
        var sEl = _el('kub-ilus-sirina');
        if (sEl) {
            var vEl = _el('kub-ilus-visina'), smEl = _el('kub-ilus-sm'),
                vmEl = _el('kub-ilus-vm'), resEl2 = _el('kub-ilus-res2');
            if (t.ok && _vrsta === 'prostorno') {
                sEl.textContent = _fmt(t.sirina, 2) + ' m';
                vEl.textContent = _fmt(t.visina, 2) + ' m';
                smEl.textContent = _fmt(t.sirina, 2);
                vmEl.textContent = _fmt(t.visina, 2);
                resEl2.textContent = _fmt(t.zapremina, DEC) + ' m³';
            } else {
                sEl.textContent = '—'; vEl.textContent = '—';
                smEl.textContent = '—'; vmEl.textContent = '—'; resEl2.textContent = '— m³';
            }
        }
    }

    // ─── Zaključaj dužinu (samo oblovina) — ostaje ista poslije "Dodaj" ──
    window.kubikatorToggleLock = function() {
        _lockDuzina = !_lockDuzina;
        _saveLock();
        _osvjeziLockUI();
    };
    function _osvjeziLockUI() {
        var bD = _el('kub-lock-duzina');
        if (bD) {
            bD.textContent = _lockDuzina ? '🔒' : '🔓';
            bD.classList.toggle('zakljucano', _lockDuzina);
            bD.setAttribute('aria-pressed', String(_lockDuzina));
        }
    }

    function _renderMemorija() {
        var lista = _el('kub-mem-lista');
        var ukupnoEl = _el('kub-ukupno');
        if (ukupnoEl) {
            var m3 = _unosi.reduce(function(s, u) { return s + (Number(u.zapremina) || 0); }, 0);
            ukupnoEl.textContent = _unosi.length + ' kom · ' + _fmt(m3, DEC) + ' m³';
        }
        if (!lista) return;
        if (!_unosi.length) {
            lista.innerHTML = '<div class="kub-mem-prazno">Još nema unosa.</div>';
            return;
        }
        var prikaz = _unosi.slice(-MEM_PRIKAZ).reverse();   // najnoviji gore
        var html = '';
        prikaz.forEach(function(u, i) {
            // Stariji zapisi nemaju u.vrsta (nastali prije nego je prostorno
            // drvo dodano) — jedini mod koji je tad postojao bio je oblovina.
            var jeProstorno = u.vrsta === 'prostorno';
            var dim = jeProstorno
                ? _fmt(u.sirina, 2) + ' × ' + _fmt(u.visina, 2) + ' m'
                : _fmt(u.precnik, 0) + ' cm × ' + _fmt(u.duzina, 2) + ' m';
            var ikona = jeProstorno ? '🪵' : '🌲';
            var animKlasa = (_justAdded && i === 0) ? ' kub-mem-nov' : '';
            html += '<div class="kub-mem-red' + animKlasa + '">' +
                '<span class="kub-mem-dim">' + ikona + ' ' + dim + '</span>' +
                '<span class="kub-mem-m3">' + _fmt(u.zapremina, DEC) + ' m³</span>' +
                '<button type="button" class="kub-mem-obrisi" onclick="kubikatorObrisi(\'' + u.id + '\')" ' +
                'aria-label="Obriši unos">🗑️</button>' +
                '</div>';
        });
        lista.innerHTML = html;
        _justAdded = false;
    }

    // ================== JAVNE FUNKCIJE ==================

    window.kubikatorDodaj = function() {
        var t = _trenutno();
        if (!t.ok) return;
        var ts = Date.now();
        // Date.now() se već koristio kao id — ostaje kao osnova (mijenjati
        // format bi zahtijevalo migraciju starih unosa), ali se dodaje slučajan
        // dio da dva unosa u istoj milisekundi (npr. Enter+Enter na tastaturi)
        // ne dobiju isti id, što bi pokvarilo kubikatorObrisi(id).
        var id = ts + Math.random().toString(36).slice(2, 6);
        var unos = {
            id: id, ts: ts, vrsta: _vrsta,
            odjel: '', sortiment: '', napomena: ''   // vidi komentar na vrhu — ne uklanjati
        };
        if (_vrsta === 'prostorno') {
            unos.sirina = t.sirina; unos.visina = t.visina; unos.zapremina = t.zapremina;
        } else {
            unos.precnik = t.precnik; unos.duzina = t.duzina; unos.zapremina = t.zapremina;
        }
        _unosi.push(unos);
        _save();
        if (!_prviUnosGotov) {
            _prviUnosGotov = true;
            try { localStorage.setItem(PRVI_KEY, '1'); } catch (_) {}
            _osvjeziPlaceholdere();
        }
        _justAdded = true;
        _renderMemorija();

        // Prečnik se uvijek prazni; dužina ostaje ako je zaključana (gomila je
        // obično jednake dužine) — sljedeći komad se onda kuca sa samo jednim
        // brojem. Širina/visina (prostorno drvo) se uvijek prazne.
        var polja = _poljaZaVrstu();
        var zakljucanoDrugo = _vrsta === 'oblovina' && _lockDuzina;
        if (polja.prvo) polja.prvo.value = '';
        if (polja.drugo && !zakljucanoDrugo) polja.drugo.value = '';
        if (polja.prvo) polja.prvo.focus();
        _osvjeziRezultat();

        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {} }

        // Prikaz ostaje UVIJEK na vrhu (unos), da se može kubicirati komad za
        // komadom bez skrolanja — ilustraciju i spisak dodanih korisnik sam
        // otvori skrolom kad poželi da ih pogleda, to ne smije usporavati unos.
        _naVrh();
    };

    // Tekstualni/CSV izvoz svih unosa — dijeljenje (telefon) ili preuzimanje
    // (desktop) preko generičkog helpera iz js/mapa-radnika.js. Namjerno CSV,
    // ne XLSX: Kubikator radi offline na terenu, a XLSX biblioteka je vanjska
    // (CDN) skripta koja na terenu možda nije dostupna.
    window.kubikatorPodijeli = function() {
        if (!_unosi.length) {
            if (typeof showWarning === 'function') showWarning('Nema unosa za izvoz');
            return;
        }
        var redovi = ['Datum/Vrijeme;Vrsta;Dimenzije;Zapremina (m3)'];
        [].concat(_unosi).reverse().forEach(function(u) {
            var jeProstorno = u.vrsta === 'prostorno';
            var vrstaTxt = jeProstorno ? 'Prostorno drvo' : 'Oblovina';
            var dim = jeProstorno
                ? _fmt(u.sirina, 2) + ' x ' + _fmt(u.visina, 2) + ' m'
                : _fmt(u.precnik, 0) + ' cm x ' + _fmt(u.duzina, 2) + ' m';
            var datum = new Date(u.ts).toLocaleString('bs-BA', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            redovi.push([datum, vrstaTxt, dim, _fmt(u.zapremina, DEC)].join(';'));
        });
        var ukupno = _unosi.reduce(function(s, u) { return s + (Number(u.zapremina) || 0); }, 0);
        redovi.push('');
        redovi.push('UKUPNO;;;' + _fmt(ukupno, DEC));
        var csv = '\ufeff' + redovi.join('\r\n');   // BOM — da Excel prepozna UTF-8 (šđčćž)
        var naziv = 'kubikator_' + new Date().toISOString().slice(0, 10) + '.csv';
        if (typeof window.shareOrDownloadFile === 'function') {
            window.shareOrDownloadFile(naziv, csv, 'text/csv;charset=utf-8', 'Kubikator — izvoz');
        }
    };

    function _naVrh() {
        var content = _el('kubikator-content');
        if (content) content.scrollTo({ top: 0, behavior: 'auto' });
    }

    // Prebacivanje Oblovina ↔ Prostorno drvo. Oba para polja se čiste pri
    // prebacivanju — brojevi iz jednog moda nemaju smisla kao unos u drugom.
    window.kubikatorToggleMode = function() {
        _vrsta = (_vrsta === 'oblovina') ? 'prostorno' : 'oblovina';
        try { localStorage.setItem(VRSTA_KEY, _vrsta); } catch (_) {}
        _primijeniVrstu();
    };

    function _primijeniVrstu() {
        var content = _el('kubikator-content');
        if (content) content.classList.toggle('vrsta-prostorno', _vrsta === 'prostorno');
        var btn = _el('kub-mode-btn');
        // Dugme uvijek nudi PRELAZAK u drugi mod, ne opisuje trenutni.
        if (btn) btn.textContent = _vrsta === 'prostorno' ? '🪵 Oblovina' : '🪵 Prostorno drvo';
        ['kub-precnik', 'kub-duzina', 'kub-sirina', 'kub-visina'].forEach(function(id) {
            var el = _el(id);
            if (el) el.value = '';
        });
        _osvjeziRezultat();
        var polja = _poljaZaVrstu();
        if (polja.prvo) setTimeout(function() { polja.prvo.focus(); }, 30);
    }

    window.kubikatorObrisi = function(id) {
        // String() poredi jer stariji zapisi imaju u.id kao broj (Date.now()),
        // a noviji kao string (ts + slučajan sufiks, vidi kubikatorDodaj) —
        // onclick uvijek šalje string, pa se bez ovoga stariji unosi ne bi
        // mogli obrisati (broj !== string).
        _unosi = _unosi.filter(function(u) { return String(u.id) !== String(id); });
        _save();
        _renderMemorija();
    };

    window.kubikatorOcistiSve = function() {
        if (!_unosi.length) return;
        var poruka = 'Obrisati svih ' + _unosi.length + ' unosa? Ova radnja se ne može poništiti.';
        var obrisi = function() { _unosi = []; _save(); _renderMemorija(); };
        if (typeof showConfirmModal === 'function') {
            showConfirmModal('Obriši sve unose', poruka, obrisi, { confirmText: '🗑️ Obriši sve', danger: true });
        } else if (confirm(poruka)) { obrisi(); }
    };

    // Koristi je printKubikator (js/print-utils.js)
    window.getKubikatorUnosi = function() { return _unosi; };

    // ---- Puni ekran (isti obrazac kao Karta) ----
    // Aplikacija inače drži viewport na width=1280 (setAppViewport, index.html)
    // za sve korisnike, na svakom uređaju — to je namjerno (vidi
    // docs/VIEWPORT-PROBLEM-I-RJESENJE.md), ali znači da se sadržaj na telefonu
    // renderuje sitnije nego stvarni ekran i korisnik mora ručno zumirati da
    // vidi kalkulator udobno. Zato se, SAMO dok je Kubikator otvoren, viewport
    // privremeno prebaci na width=device-width — isti trik koji Karta već
    // koristi za svoju punoekransku mapu (_enterMapaFullscreen/js/mapa-radnika.js).
    // Pri izlasku se vraća na setAppViewport() (jedini izvor istine za
    // standardnu širinu), a ne ručno na 1280, da se ne udvostručuje ta logika.
    function _enterFullscreen() {
        document.body.classList.add('kubikator-fullscreen');
        var vp = document.querySelector('meta[name=viewport]');
        if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
    }
    function _exitFullscreen() {
        // Stražar: exitKubikatorFullscreenIfActive se poziva pri SVAKOM prelasku
        // na bilo koji drugi tab, ne samo kad je Kubikator stvarno bio otvoren.
        // Bez ove provjere bi se viewport (pa time i korisnikov izbor
        // Desktop/Android prikaza) resetovao na svaki klik na tab.
        if (!document.body.classList.contains('kubikator-fullscreen')) return;
        document.body.classList.remove('kubikator-fullscreen');
        if (typeof window.setAppViewport === 'function') window.setAppViewport();
    }

    // Pozivaju se iz switchTab (js/ui.js) PRIJE grane koja može rano izaći na
    // svjež keš — inače bi se pri povratku na već renderovan tab preskočilo.
    window.enterKubikatorFullscreenIfActive = function(tab) {
        if (tab === 'kubikator') _enterFullscreen();
    };
    window.exitKubikatorFullscreenIfActive = function(nextTab) {
        if (nextTab !== 'kubikator') _exitFullscreen();
    };

    window.closeKubikator = function() {
        _exitFullscreen();
        // Nazad na početni prikaz uloge, isto kao "Zatvori" na Karti
        var t = (window.currentUser && String(window.currentUser.type || '').trim().toLowerCase()) || '';
        var home = t === 'otpremac' ? 'otpremac-personal'
                 : (t === 'poslovodja' || t === 'poslovođa') ? 'poslovodja-sjeca'
                 : t === 'primac' ? 'primac-personal'
                 : 'dashboard';
        if (typeof switchTab === 'function') switchTab(home);
    };

    window.initKubikator = function() {
        var content = _el('kubikator-content');
        if (content) content.classList.remove('hidden');
        _enterFullscreen();

        if (!_inited) {
            _inited = true;
            _load();
            _primijeniVrstu(); // postavi tekst dugmeta i vidljiva polja za učitani mod

            var p = _el('kub-precnik'), d = _el('kub-duzina');
            var s = _el('kub-sirina'), v = _el('kub-visina');
            [p, d, s, v].forEach(function(inp) {
                if (inp) inp.addEventListener('input', _osvjeziRezultat);
            });
            // Enter lanac unutar svakog para: prvo polje → drugo → dodaj.
            // Oba para su ožičena bez obzira koji je trenutno vidljiv —
            // neaktivni jednostavno nikad ne dobije fokus, pa mu tastatura
            // ionako ne okine.
            if (p) p.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); if (d) d.focus(); }
            });
            if (d) d.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); window.kubikatorDodaj(); }
            });
            if (s) s.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); if (v) v.focus(); }
            });
            if (v) v.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); window.kubikatorDodaj(); }
            });
        } else {
            _primijeniVrstu(); // uskladi prikaz i pri povratku na već renderovan tab
        }

        _osvjeziLockUI();
        _osvjeziPlaceholdere();
        _renderMemorija();
        _osvjeziRezultat();
        _naVrh(); // otvaranje taba uvijek počinje od unosa, ne od mjesta gdje je prošli put ostalo skrolano
        var pf = _poljaZaVrstu().prvo;
        if (pf) setTimeout(function() { pf.focus(); }, 60);

        var ls = _el('loading-screen');
        if (ls) ls.classList.add('hidden');
        if (typeof markTabRendered === 'function') markTabRendered('kubikator');
    };
})();
