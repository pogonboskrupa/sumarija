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
// čita u.odjel/u.sortiment/u.napomena bezuslovno — u.odjel i u.napomena i
// dalje ostaju prazan string (nemaju UI za unos), a u.sortiment se od sad
// puni iz #kub-sortiment-select dropdowna (KUB_SORT_OBLOVINA/PROSTORNO
// ispod) — prazan string i dalje znači "bez sortimenta" (dropdown ostavljen
// na "— Sortiment —", ili stariji zapis od prije ove funkcije), _renderRekap
// takve grupiše pod "Bez sortimenta".
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
    var PRVI_PROSTORNI_KEY = 'kubikator_prvi_prostorni_gotov'; // isto, za "1,20"/"1,50" (prostorno drvo)
    var MEM_PRIKAZ = 30;          // koliko zadnjih unosa se prikazuje u memoriji
    var KUB_STRANICA = 20;        // "stranica" u službenoj knjizi = 20 unosa (mjerenja)
    var UPOZORENJE_PRAG = 200;    // svakih 200 unosa (10 stranica) — podsjeti na izvoz/čišćenje

    // Dozvoljeni opsezi — sve van ovoga je gotovo sigurno omaška u kucanju
    // (npr. prečnik u milimetrima ili dužina u centimetrima).
    var P_MIN = 7,  P_MAX = 150;  // prečnik, cijeli centimetri
    var D_MIN = 1,  D_MAX = 10;   // dužina u metrima, dvije decimale
    var KOEF_PROSTORNI = 0.63;    // prostorni → zapreminski oblik: 0,7 − 10% = 0,63
    var DEC_KEY = 'kubikator_dec'; // pamti izabran broj decimala između sesija
    var DEC = 2;                  // zapremina se prikazuje na dvije (podrazumijevano) ili tri decimale — kubikatorToggleDecimals

    // Sortiment (dropdown u zaglavlju, #kub-sortiment-select) — čisto
    // klasifikacija unosa, ne utiče na računicu. Različita lista po modu:
    // Oblovina (trupci) vs Prostorno drvo (cijepano/slagano). NAMJERNO
    // odvojeno od KUBIKATOR_CETINARI/LISCARI iznad (drugi nazivi, druga
    // svrha — te liste boje kolone drugdje u appu, ove pune OVAJ dropdown).
    var KUB_SORT_OBLOVINA = [
        'I JT', 'II JT', 'III JT', 'Cel.duga', 'Cel.cijepana', 'I BT', 'II BT', 'III BT',
        'Ogr.dugo', 'Ogr.cijepano', 'Furnir Č', 'Furnir L', 'Gule', 'Škart'
    ];
    var KUB_SORT_PROSTORNO = ['Ogrijev cijepani', 'Cel.cijepana'];
    var _unosi = [];
    var _vrsta = 'oblovina';      // 'oblovina' | 'prostorno'
    var _inited = false;
    var _lockDuzina = false;      // dužina ostaje poslije Dodaj (gomila je obično jednake dužine)
    var _justAdded = false;       // animacija u memoriji samo na redu koji je TEK dodan
    var _kubZadnjeAktivno = null; // zadnje fokusirano .kub-input polje — vidi _initTastatura
    var _prviUnosGotov = false;   // true poslije prvog unosa ikad — gasi placeholder "24"/"4,50"
    var _prviProstornoGotov = false; // isto, za placeholder "1,20"/"1,50" u modu prostorno drvo

    // Zarez i tačka su na terenu ravnopravni ("4,50" i "4.50")
    function _num(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')); }

    // toLocaleString/toFixed zaokružuju na osnovu STVARNE binarne reprezentacije
    // broja, ne "matematičke" decimalne vrijednosti — npr. 0,345 se u memoriji
    // čuva kao 0,34499999999999997 (posljedica Huberove formule i sličnih
    // množenja), pa standardno zaokruživanje zna pogrešno otići na dolje
    // (0,34 umjesto očekivanog 0,35 kad je treća decimala 5). Množenje sa
    // (1 + Number.EPSILON) prije Math.round nježno "gurne" broj preko granice
    // kad je razlog čisto reprezentacijska greška, bez uticaja na brojeve koji
    // stvarno nisu na granici.
    function _roundHalfUp(v, dec) {
        var p = Math.pow(10, dec);
        return Math.round(v * p * (1 + Number.EPSILON)) / p;
    }

    function _fmt(v, dec) {
        return _roundHalfUp(Number(v), dec).toLocaleString('de-DE', {
            minimumFractionDigits: dec, maximumFractionDigits: dec
        });
    }

    function _load() {
        try {
            var raw = localStorage.getItem(KUB_KEY);
            _unosi = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(_unosi)) _unosi = [];
        } catch (_) { _unosi = []; }
        // Migracija: stariji zapisi (prije nego je "stranica" postala TRAJNO
        // svojstvo svakog unosa — vidi _trenutnaStranica/_renderRekap) nemaju
        // u.stranica. Dodijeli im ga JEDNOM, po trenutnom redoslijedu u nizu
        // (isti raspored kao dosadašnji pozicioni obračun) — od sad se taj broj
        // više NE mijenja pri brisanju, čime rekap po stranicama postaje stabilan.
        var trebaMigracija = false;
        for (var mi = 0; mi < _unosi.length; mi++) { if (!_unosi[mi].stranica) { trebaMigracija = true; break; } }
        if (trebaMigracija) {
            _unosi.forEach(function(u, i) { if (!u.stranica) u.stranica = Math.floor(i / KUB_STRANICA) + 1; });
            _save();
        }
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
        try {
            _prviProstornoGotov = localStorage.getItem(PRVI_PROSTORNI_KEY) === '1';
        } catch (_) { _prviProstornoGotov = false; }
        try {
            var dec = parseInt(localStorage.getItem(DEC_KEY), 10);
            DEC = (dec === 3) ? 3 : 2;
        } catch (_) { DEC = 2; }
    }
    function _save() {
        try { localStorage.setItem(KUB_KEY, JSON.stringify(_unosi)); } catch (_) {}
    }
    function _saveLock() {
        try { localStorage.setItem(LOCK_KEY, JSON.stringify({ duzina: _lockDuzina })); } catch (_) {}
    }
    function _saveDec() {
        try { localStorage.setItem(DEC_KEY, String(DEC)); } catch (_) {}
    }

    // "24"/"4,50" (prečnik/dužina) i "1,20"/"1,50" (širina/visina) su prijedlog
    // SAMO dok korisnik nikad nije dodao nijedan unos u tom modu — poslije
    // prvog "Dodaj" (ikad, trajno, po modu) nestaju, da se ne pomiješaju sa
    // stvarnom vrijednosti kad je polje prazno.
    function _osvjeziPlaceholdere() {
        var p = _el('kub-precnik'), d = _el('kub-duzina');
        if (p) p.placeholder = _prviUnosGotov ? '' : '24';
        if (d) d.placeholder = _prviUnosGotov ? '' : '4,50';
        var s = _el('kub-sirina'), v = _el('kub-visina');
        if (s) s.placeholder = _prviProstornoGotov ? '' : '1,20';
        if (v) v.placeholder = _prviProstornoGotov ? '' : '1,50';
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

    // ─── Broj decimala (2 podrazumijevano, 3 po izboru) ──────────────────
    // Utiče samo na PRIKAZ/zaokruživanje (_fmt/_roundHalfUp) — sirova
    // izračunata zapremina se u _unosi i dalje čuva punom preciznošću, pa
    // prebacivanje broja decimala odmah tačno preračuna i već postojeće
    // unose, bez migracije podataka.
    window.kubikatorToggleDecimals = function() {
        DEC = (DEC === 2) ? 3 : 2;
        _saveDec();
        _osvjeziDecUI();
        _osvjeziRezultat();
        _renderMemorija();
        _invalidirajRekapCache(); // DEC mijenja prikazane m3 na SVAKOJ stranici, uklj. već zatvorene
        _renderRekap();
    };
    function _osvjeziDecUI() {
        var b = _el('kub-dec-toggle');
        if (b) {
            b.textContent = DEC === 3 ? '.000' : '.00';
            b.classList.toggle('tri-decimale', DEC === 3);
            b.setAttribute('aria-pressed', String(DEC === 3));
        }
    }

    function _renderMemorija() {
        var lista = _el('kub-mem-lista');
        var ukupnoEl = _el('kub-ukupno');
        if (ukupnoEl) {
            // Zbir VEĆ ZAOKRUŽENIH vrijednosti (onih koje korisnik vidi po
            // stavci), ne zaokruženi zbir sirovih vrijednosti — inače zbir
            // stavki na ekranu ne odgovara prikazanom ukupnom (npr.
            // 0,51 + 0,75 mora dati 1,26, ne 1,25 iz sirovog zbira).
            var m3 = _unosi.reduce(function(s, u) { return s + _roundHalfUp(Number(u.zapremina) || 0, DEC); }, 0);
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
            var sortHtml = u.sortiment ? '<span class="kub-mem-sort">' + u.sortiment + '</span>' : '';
            html += '<div class="kub-mem-red' + animKlasa + '">' +
                '<span class="kub-mem-info">' + sortHtml +
                '<span class="kub-mem-dim">' + ikona + ' ' + dim + '</span></span>' +
                '<span class="kub-mem-m3">' + _fmt(u.zapremina, DEC) + ' m³</span>' +
                '<button type="button" class="kub-mem-obrisi" onclick="kubikatorObrisi(\'' + u.id + '\')" ' +
                'aria-label="Obriši unos">🗑️</button>' +
                '</div>';
        });
        lista.innerHTML = html;
        _justAdded = false;
    }

    // Sortimentski rekap za JEDNU grupu unosa (jednu "stranicu") — "Bez
    // sortimenta" hvata unose gdje dropdown nije korišten (ostavljen na
    // "— Sortiment —") i starije zapise od prije te funkcije. Redoslijed
    // prati kanonske liste (Oblovina pa Prostorno drvo), "Bez sortimenta"
    // uvijek zadnji.
    var BEZ_SORTIMENTA = 'Bez sortimenta';
    function _rekapGrupe(grupa) {
        var mapa = {};
        grupa.forEach(function(u) {
            var kljuc = u.sortiment || BEZ_SORTIMENTA;
            if (!mapa[kljuc]) mapa[kljuc] = { kom: 0, m3: 0 };
            mapa[kljuc].kom += 1;
            // Zbir zaokruženih vrijednosti — vidi komentar u _renderMemorija.
            mapa[kljuc].m3 += _roundHalfUp(Number(u.zapremina) || 0, DEC);
        });
        var redoslijed = KUB_SORT_OBLOVINA.concat(KUB_SORT_PROSTORNO);
        var kljucevi = Object.keys(mapa).sort(function(a, b) {
            if (a === BEZ_SORTIMENTA) return 1;
            if (b === BEZ_SORTIMENTA) return -1;
            var ia = redoslijed.indexOf(a), ib = redoslijed.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
        var html = '';
        kljucevi.forEach(function(k) {
            var red = mapa[k];
            var bezKlasa = k === BEZ_SORTIMENTA ? ' kub-rekap-bez' : '';
            html += '<div class="kub-rekap-red' + bezKlasa + '">' +
                '<span class="kub-rekap-naziv">' + k + '</span>' +
                '<span class="kub-rekap-kom">' + red.kom + ' kom</span>' +
                '<span class="kub-rekap-m3">' + _fmt(red.m3, DEC) + ' m³</span>' +
                '</div>';
        });
        return html;
    }

    // Koja "stranica" prima SLJEDEĆI unos. u.stranica je TRAJNO svojstvo
    // (dodijeljeno jednom u kubikatorDodaj/migraciji u _load) — ne
    // preračunava se po trenutnoj dužini niza, zato brisanje bilo kog unosa
    // NE pomjera ostale unose na drugu stranicu (raniji bug: stranice su se
    // računale čisto po poziciji u nizu, pa je brisanje jednog unosa sa
    // stranice 1 "povuklo" prvi unos stranice 2 na stranicu 1, itd. — rekap
    // po stranicama više nije odgovarao onome što je stvarno upisano na toj
    // fizičkoj stranici). Ako je zadnja stranica već puna (ili unosa još
    // nema), otvara se sljedeća; inače nastavlja popunjavati istu — čak i
    // ako joj je broj stavki privremeno ispod 20 zbog brisanja (isto kao što
    // bi radnik na terenu nastavio pisati na istoj papirnoj stranici poslije
    // precrtavanja jednog reda).
    function _trenutnaStranica() {
        if (!_unosi.length) return 1;
        var zadnja = _unosi[_unosi.length - 1];
        var brStr = zadnja.stranica || 1;
        var brojUStranici = 0;
        for (var i = 0; i < _unosi.length; i++) { if ((_unosi[i].stranica || 1) === brStr) brojUStranici++; }
        return brojUStranici >= KUB_STRANICA ? brStr + 1 : brStr;
    }

    // Predmemorija HTML-a za ZATVORENE stranice (sve osim trenutne, otvorene) —
    // kubikatorDodaj poziva _renderRekap() na SVAKI unos, a na terenu se u
    // jednoj sesiji zna nakupiti stotine unosa (desetine stranica). Bez ove
    // predmemorije bi se pri svakom tapu na "Dodaj" iznova agregiralo i
    // gradilo HTML za SVE već zatvorene stranice, iako se one više ne
    // mijenjaju — čisto bačen posao koji na duže sesije primjetno uspori
    // unos. Nevažeća (invalidate) se pri bilo kojoj promjeni koja MOŽE
    // uticati na već zatvorenu stranicu (brisanje, promjena broja decimala,
    // brisanje svega) — samo obično dodavanje ostavlja predmemoriju netaknutu.
    var _rekapCacheValid = false;
    var _rekapPageHtmlCache = {}; // stranica -> HTML string

    function _invalidirajRekapCache() {
        _rekapCacheValid = false;
        _rekapPageHtmlCache = {};
    }

    function _rekapStranicaHtml(broj, grupa, uToku) {
        var statusHtml = uToku
            ? '<span class="kub-rekap-stranica-status">' + grupa.length + '/' + KUB_STRANICA + ' · u toku</span>'
            : '<span class="kub-rekap-stranica-status kub-rekap-stranica-puna">popunjena</span>';
        return '<div class="kub-rekap-stranica">' +
            '<div class="kub-rekap-stranica-naslov"><span>📄 Stranica ' + broj + '</span>' + statusHtml + '</div>' +
            _rekapGrupe(grupa) +
            '</div>';
    }

    // Rekap organizovan po "stranicama" od KUB_STRANICA (20) unosa — isto kao
    // u službenoj knjizi na terenu: puni se 20 redova, na kraju stranice ide
    // rekap po sortimentima, pa se nastavlja na sljedećoj stranici. Stranice
    // se prikazuju najnovija prva (isti obrazac kao "Zadnji unosi" ispod).
    // Nedovršena (trenutna) stranica se i dalje prikazuje, obilježena "u toku".
    function _renderRekap() {
        var lista = _el('kub-rekap-lista');
        var ukupnoEl = _el('kub-rekap-ukupno');
        if (ukupnoEl) {
            // Zbir zaokruženih vrijednosti — vidi komentar u _renderMemorija.
            var m3Uk = _unosi.reduce(function(s, u) { return s + _roundHalfUp(Number(u.zapremina) || 0, DEC); }, 0);
            ukupnoEl.textContent = _unosi.length + ' kom · ' + _fmt(m3Uk, DEC) + ' m³';
        }
        if (!lista) return;
        if (!_unosi.length) {
            lista.innerHTML = '<div class="kub-rekap-prazno">Još nema unosa.</div>';
            _invalidirajRekapCache();
            return;
        }
        var grupePoStranici = {};
        var redoslijedStranica = [];
        _unosi.forEach(function(u) {
            var s = u.stranica || 1;
            if (!grupePoStranici[s]) { grupePoStranici[s] = []; redoslijedStranica.push(s); }
            grupePoStranici[s].push(u);
        });
        var trenutna = _trenutnaStranica();
        var poredane = redoslijedStranica.slice().sort(function(a, b) { return b - a; });
        var html = '';
        poredane.forEach(function(s) {
            var grupa = grupePoStranici[s];
            var uToku = (s === trenutna) && grupa.length < KUB_STRANICA;
            if (!uToku && _rekapCacheValid && _rekapPageHtmlCache[s] !== undefined) {
                html += _rekapPageHtmlCache[s];
                return;
            }
            var blok = _rekapStranicaHtml(s, grupa, uToku);
            if (!uToku) _rekapPageHtmlCache[s] = blok;
            html += blok;
        });
        lista.innerHTML = html;
        _rekapCacheValid = true;
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
        var sortSel = _el('kub-sortiment-select');
        var unos = {
            id: id, ts: ts, vrsta: _vrsta,
            // odjel/napomena ostaju prazan string — vidi komentar na vrhu fajla
            // (printKubikator ih čita bezuslovno). sortiment se od sad PUNI iz
            // dropdowna (#kub-sortiment-select) umjesto da ostane trajno prazan.
            odjel: '', sortiment: sortSel ? sortSel.value : '', napomena: '',
            // Trajno dodijeljena "stranica" — vidi _trenutnaStranica. Mora se
            // izračunati PRIJE push-a (na osnovu dosadašnjeg stanja _unosi).
            stranica: _trenutnaStranica()
        };
        if (_vrsta === 'prostorno') {
            unos.sirina = t.sirina; unos.visina = t.visina; unos.zapremina = t.zapremina;
        } else {
            unos.precnik = t.precnik; unos.duzina = t.duzina; unos.zapremina = t.zapremina;
        }
        _unosi.push(unos);
        _save();
        if (_vrsta === 'prostorno') {
            if (!_prviProstornoGotov) {
                _prviProstornoGotov = true;
                try { localStorage.setItem(PRVI_PROSTORNI_KEY, '1'); } catch (_) {}
                _osvjeziPlaceholdere();
            }
        } else if (!_prviUnosGotov) {
            _prviUnosGotov = true;
            try { localStorage.setItem(PRVI_KEY, '1'); } catch (_) {}
            _osvjeziPlaceholdere();
        }
        _justAdded = true;
        _renderMemorija();
        _renderRekap();

        // Podaci su ISKLJUČIVO lokalni (localStorage, bez servera/backupa) i
        // ništa ih automatski ne čisti — nakon sedmica/mjeseci terenskog rada
        // bi mogli neopaženo narasti do granice localStorage prostora.
        // Podsjeti (svakih UPOZORENJE_PRAG unosa = 10 punih stranica), ne
        // spriječi — radnik i dalje odlučuje kad će stvarno izvesti/obrisati.
        if (_unosi.length > 0 && _unosi.length % UPOZORENJE_PRAG === 0 && typeof showWarning === 'function') {
            showWarning('Puno lokalnih unosa (' + _unosi.length + ')',
                'Razmislite da izvezete (📤 Podijeli ili 🖨️ Štampaj) i obrišete stare unose (🗑️ Obriši sve) da oslobodite prostor na uređaju.');
        }

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
        // Zbir zaokruženih vrijednosti — vidi komentar u _renderMemorija.
        var ukupno = _unosi.reduce(function(s, u) { return s + _roundHalfUp(Number(u.zapremina) || 0, DEC); }, 0);
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
        _osvjeziSortimentOptions();
        _osvjeziRezultat();
        var polja = _poljaZaVrstu();
        if (polja.prvo) setTimeout(function() { polja.prvo.focus(); }, 30);
    }

    // Puni #kub-sortiment-select prema trenutnom modu — Oblovina i Prostorno
    // drvo imaju POTPUNO različite liste (trupci naspram cijepanog/slaganog
    // drveta), pa se dropdown mora ponovo napuniti pri svakom prebacivanju
    // moda, ne samo jednom pri otvaranju. Oblovina počinje PRAZNA (korisnik
    // mora svjesno izabrati); Prostorno drvo počinje na "Ogrijev cijepani"
    // (ubjedljivo najčešći slučaj na terenu za slagano drvo).
    function _osvjeziSortimentOptions() {
        var sel = _el('kub-sortiment-select');
        if (!sel) return;
        var lista = _vrsta === 'prostorno' ? KUB_SORT_PROSTORNO : KUB_SORT_OBLOVINA;
        var html = _vrsta === 'oblovina' ? '<option value="">— Sortiment —</option>' : '';
        lista.forEach(function(s) {
            html += '<option value="' + s.replace(/"/g, '&quot;') + '">' + s + '</option>';
        });
        sel.innerHTML = html;
        sel.value = _vrsta === 'prostorno' ? KUB_SORT_PROSTORNO[0] : '';
    }

    window.kubikatorObrisi = function(id) {
        // String() poredi jer stariji zapisi imaju u.id kao broj (Date.now()),
        // a noviji kao string (ts + slučajan sufiks, vidi kubikatorDodaj) —
        // onclick uvijek šalje string, pa se bez ovoga stariji unosi ne bi
        // mogli obrisati (broj !== string).
        _unosi = _unosi.filter(function(u) { return String(u.id) !== String(id); });
        _save();
        // Brisanje mijenja broj stavki na NJENOJ stranici — predmemorirani
        // HTML te (i eventualno drugih, ako je izmjenjen ranije spor) stranice
        // više ne bi odgovarao stvarnom stanju. Cijela stranica se ionako
        // rijetko briše (nasuprot čestom "Dodaj"), pa puna invalidacija ovdje
        // ne ugrožava perfomanse — samo garantuje tačnost.
        _invalidirajRekapCache();
        _renderMemorija();
        _renderRekap();
    };

    window.kubikatorOcistiSve = function() {
        if (!_unosi.length) return;
        var poruka = 'Obrisati svih ' + _unosi.length + ' unosa? Ova radnja se ne može poništiti.';
        var obrisi = function() { _unosi = []; _save(); _invalidirajRekapCache(); _renderMemorija(); _renderRekap(); };
        if (typeof showConfirmModal === 'function') {
            showConfirmModal('Obriši sve unose', poruka, obrisi, { confirmText: '🗑️ Obriši sve', danger: true });
        } else if (confirm(poruka)) { obrisi(); }
    };

    // Koristi ih printKubikator (js/print-utils.js)
    window.getKubikatorUnosi = function() { return _unosi; };
    window.getKubikatorDec = function() { return DEC; };
    // Isti redoslijed sortimenata kao _rekapGrupe iznad (Oblovina pa Prostorno
    // drvo) — koristi printKubikator (js/print-utils.js) da rekapitulacija na
    // štampi sortira sortimente dosljedno sa ekranskim rekapom.
    window.getKubikatorSortimentRedoslijed = function() { return KUB_SORT_OBLOVINA.concat(KUB_SORT_PROSTORNO); };

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

    // ─── Sopstvena tastatura (#kub-keypad) ──────────────────────────────
    // Polja imaju inputmode="none" (index.html) — OS tastatura se uopšte ne
    // otvara, ovo je JEDINI način unosa na dodir. Namjerno NE dira internu
    // logiku iznad (_osvjeziRezultat, Enter lanac): svaki taster samo mijenja
    // .value pa emituje pravi 'input'/'keydown' event, isti koje bi emitovala
    // fizička tastatura — postojeći listeneri (već ožičeni u initKubikator)
    // rade ostatak posla bez ijedne duplirane linije logike.
    function _kubAktivnoPolje() {
        var a = document.activeElement;
        if (a && a.classList && a.classList.contains('kub-input')) return a;
        return _kubZadnjeAktivno;
    }
    function _kubOsvjeziEnterDugme() {
        var btn = _el('kub-key-enter');
        if (!btn) return;
        var polje = _kubAktivnoPolje();
        // "Drugo" polje para (dužina/visina) — Enter tu zove kubikatorDodaj
        // (vidi Enter lanac u initKubikator), pa dugme postaje "✓ Dodaj".
        // Svako drugo stanje (prvo polje ili ništa fokusirano) znači da Enter
        // samo pomjera fokus na drugo polje — "→ Dalje".
        var jeDrugo = !!polje && (polje.id === 'kub-duzina' || polje.id === 'kub-visina');
        btn.textContent = jeDrugo ? '✓ Dodaj' : '→ Dalje';
        btn.classList.toggle('kub-key-enter-dalje', !jeDrugo);
    }
    function _initTastatura() {
        var keypad = _el('kub-keypad');
        if (!keypad) return;

        // Prati zadnje fokusirano polje — hvata SVAKI .focus() poziv u ovom
        // fajlu (init, kubikatorDodaj, promjena moda, ručni tap na polje) bez
        // posebnog kačenja na svaki od njih pojedinačno.
        document.addEventListener('focusin', function(e) {
            var t = e.target;
            if (t && t.classList && t.classList.contains('kub-input')) {
                _kubZadnjeAktivno = t;
                _kubOsvjeziEnterDugme();
            }
        });

        // preventDefault na pointerdown — polje NIKAD ne izgubi fokus dok se
        // kuca po ovoj tastaturi (standardni obrazac za "custom on-screen
        // keyboard"; bez ovoga bi dodir na dugme blur-ovao polje PRIJE nego
        // stigne click, pa bi _kubAktivnoPolje() vratio null).
        keypad.addEventListener('pointerdown', function(e) {
            if (e.target.closest('.kub-key, .kub-key-enter')) e.preventDefault();
        });

        keypad.addEventListener('click', function(e) {
            var dugme = e.target.closest('.kub-key, .kub-key-enter');
            if (!dugme) return;
            var k = dugme.getAttribute('data-k');
            var polje = _kubAktivnoPolje();
            if (!polje) return;
            if (k === 'enter') {
                polje.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
                return;
            }
            if (k === 'back') {
                polje.value = polje.value.slice(0, -1);
            } else if (k === ',') {
                // Jedan zarez po polju, i ne kao prvi znak (nema smisla ",5").
                if (polje.value !== '' && polje.value.indexOf(',') === -1) polje.value += ',';
            } else {
                polje.value += k;
            }
            polje.dispatchEvent(new Event('input', { bubbles: true }));
        });

        _kubOsvjeziEnterDugme();
    }

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
            _initTastatura();
        } else {
            _primijeniVrstu(); // uskladi prikaz i pri povratku na već renderovan tab
        }

        _osvjeziLockUI();
        _osvjeziDecUI();
        _osvjeziPlaceholdere();
        _renderMemorija();
        _renderRekap();
        _osvjeziRezultat();
        _naVrh(); // otvaranje taba uvijek počinje od unosa, ne od mjesta gdje je prošli put ostalo skrolano
        var pf = _poljaZaVrstu().prvo;
        if (pf) setTimeout(function() { pf.focus(); }, 60);

        var ls = _el('loading-screen');
        if (ls) ls.classList.add('hidden');
        if (typeof markTabRendered === 'function') markTabRendered('kubikator');
    };
})();
