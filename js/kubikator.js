// ============================================================
// KUBIKATOR — Terenski kalkulator zapremine drvnih sortimenata
// Huberova formula: V = (π/4) × (d/100)² × L
//   d = prečnik na sredini trupca u cm, L = dužina u m, V u m³.
//
// Namjerno svedeno na DVA polja (prečnik + dužina). Rezultat se računa DOK SE
// KUCA — ne treba pritiskati ništa da bi se vidjela zapremina; "Dodaj" služi
// samo da unos padne u memoriju ispod. Na terenu se kuca prstom, često u
// rukavicama, pa su polja i brojevi veliki.
//
// Otvara se preko cijelog ekrana, isti obrazac kao Karta (klasa
// body.kubikator-fullscreen + dugme "✕ Zatvori").
//
// Podaci su ISKLJUČIVO lokalni — localStorage['kubikator_unosi'], bez servera.
// VAŽNO: oblik zapisa se NE smije mijenjati. js/print-utils.js (printKubikator)
// bezuslovno poziva u.duzina.toFixed(2) / u.zapremina.toFixed(2) i čita
// u.odjel / u.sortiment / u.napomena — zato se ta tri polja i dalje upisuju
// kao prazan string, da i štampa i stariji zapisi nastave raditi.
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
    var MEM_PRIKAZ = 30;          // koliko zadnjih unosa se prikazuje u memoriji
    var _unosi = [];
    var _inited = false;

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
    }
    function _save() {
        try { localStorage.setItem(KUB_KEY, JSON.stringify(_unosi)); } catch (_) {}
    }

    function _el(id) { return document.getElementById(id); }

    function _zapremina(precnik, duzina) {
        return (Math.PI / 4) * Math.pow(precnik / 100, 2) * duzina;
    }

    // Trenutno upisane vrijednosti, ili null ako nisu ispravne
    function _trenutno() {
        var pEl = _el('kub-precnik'), dEl = _el('kub-duzina');
        var p = _num(pEl && pEl.value);
        var d = _num(dEl && dEl.value);
        if (!(p > 0) || !(d > 0)) return null;
        return { precnik: p, duzina: d, zapremina: _zapremina(p, d) };
    }

    // Živi rezultat — poziva se na svaki otkucaj
    function _osvjeziRezultat() {
        var box = _el('kub-rezultat');
        var btn = _el('kub-dodaj-btn');
        if (!box) return;
        var t = _trenutno();
        var okvir = box.parentElement;
        if (t) {
            box.textContent = _fmt(t.zapremina, 3) + ' m³';
            if (okvir) okvir.classList.remove('prazno');
            if (btn) btn.disabled = false;
        } else {
            box.textContent = '—';
            if (okvir) okvir.classList.add('prazno');
            if (btn) btn.disabled = true;
        }
    }

    function _renderMemorija() {
        var lista = _el('kub-mem-lista');
        var ukupnoEl = _el('kub-ukupno');
        if (ukupnoEl) {
            var m3 = _unosi.reduce(function(s, u) { return s + (Number(u.zapremina) || 0); }, 0);
            ukupnoEl.textContent = _unosi.length + ' kom · ' + _fmt(m3, 3) + ' m³';
        }
        if (!lista) return;
        if (!_unosi.length) {
            lista.innerHTML = '<div class="kub-mem-prazno">Još nema unosa.</div>';
            return;
        }
        var prikaz = _unosi.slice(-MEM_PRIKAZ).reverse();   // najnoviji gore
        lista.innerHTML = prikaz.map(function(u) {
            return '<div class="kub-mem-red">' +
                '<span class="kub-mem-dim">' + _fmt(u.precnik, 1) + ' cm × ' + _fmt(u.duzina, 2) + ' m</span>' +
                '<span class="kub-mem-m3">' + _fmt(u.zapremina, 3) + ' m³</span>' +
                '<button type="button" class="kub-mem-obrisi" onclick="kubikatorObrisi(' + u.id + ')" ' +
                'aria-label="Obriši unos">🗑️</button>' +
                '</div>';
        }).join('');
    }

    // ================== JAVNE FUNKCIJE ==================

    window.kubikatorDodaj = function() {
        var t = _trenutno();
        if (!t) return;
        var ts = Date.now();
        _unosi.push({
            id: ts, ts: ts,
            odjel: '', sortiment: '', napomena: '',   // vidi komentar na vrhu — ne uklanjati
            precnik: t.precnik, duzina: t.duzina, zapremina: t.zapremina
        });
        _save();
        _renderMemorija();

        // Dužina se između komada rjeđe mijenja nego prečnik, pa ostaje
        // upisana; kursor se vraća na prečnik za sljedeći komad.
        var p = _el('kub-precnik');
        if (p) { p.value = ''; p.focus(); }
        _osvjeziRezultat();
    };

    window.kubikatorObrisi = function(id) {
        _unosi = _unosi.filter(function(u) { return u.id !== id; });
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
    function _enterFullscreen() { document.body.classList.add('kubikator-fullscreen'); }
    function _exitFullscreen() { document.body.classList.remove('kubikator-fullscreen'); }

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
        var t = (window.currentUser && String(window.currentUser.type || '').toLowerCase()) || '';
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
            var p = _el('kub-precnik'), d = _el('kub-duzina');
            [p, d].forEach(function(inp) {
                if (inp) inp.addEventListener('input', _osvjeziRezultat);
            });
            // Enter lanac: prečnik → dužina → dodaj
            if (p) p.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); if (d) d.focus(); }
            });
            if (d) d.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); window.kubikatorDodaj(); }
            });
        }

        _renderMemorija();
        _osvjeziRezultat();
        var pf = _el('kub-precnik');
        if (pf) setTimeout(function() { pf.focus(); }, 60);

        var ls = _el('loading-screen');
        if (ls) ls.classList.add('hidden');
        if (typeof markTabRendered === 'function') markTabRendered('kubikator');
    };
})();
