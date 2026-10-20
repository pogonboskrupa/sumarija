// ============================================================
// ODJELI — zajednički prikaz kartica po odjelu (Primači na šuma panju, Prikaz po odjelima
// kod primača/otpremača i izabranog primača)
//
// Jedna kartica po odjelu, tabele se otvaraju na klik (lazy render) — odjeli sa sječom u zadnjih
// 10 dana su otvoreni. Toolbar: pretraga, sortiranje, filter po svježini sječe.
//   kind 'primaci' — odjel.primaci[] (red po primaču + UKUPNO, uz % udio i "medalje")
//   kind 'simple'  — samo ukupni sortimenti odjela (m³ i %)
// ============================================================
(function () {
    'use strict';

    var AKTIVNO_DANA = 10;
    var NEDAVNO_DANA = 60;
    var stanje = {}; // containerId → { q, sort, filter, data, opts }

    function esc(s) { return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s == null ? '' : s); }
    function f2(v) { return v > 0 ? v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'; }

    function danaOd(datumStr) {
        if (!datumStr) return null;
        var d = typeof parseDatumDDMMYYYY === 'function' ? parseDatumDDMMYYYY(String(datumStr).replace(/\//g, '.').replace(/-/g, '.')) : null;
        if (!d || isNaN(d)) return null;
        var start = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
        return Math.round((start(new Date()) - start(d)) / 86400000);
    }
    function ts(datumStr) {
        var d = danaOd(datumStr);
        return d == null ? -Infinity : -d;
    }
    function opis(dana) {
        if (dana == null) return 'bez datuma';
        if (dana <= 0) return 'danas';
        if (dana === 1) return 'jučer';
        return 'prije ' + dana + ' d';
    }
    function klasa(dana) {
        if (dana == null) return 'nepoznato';
        return dana <= AKTIVNO_DANA ? 'aktivno' : dana <= NEDAVNO_DANA ? 'nedavno' : 'ostalo';
    }

    function zaglavlje(sortNazivi, prvi, ukupno) {
        var h = '<tr><th class="oc-first">' + prvi + '</th>';
        sortNazivi.forEach(function (s) {
            h += '<th class="right ' + (typeof sortimentColClass === 'function' ? sortimentColClass(s) : '') + '">' + esc(s) + '</th>';
        });
        return h + (ukupno ? '<th class="right oc-ukupno">Ukupno</th>' : '') + '</tr>';
    }

    function tijeloPrimaci(odjel, sortNazivi) {
        var primaci = odjel.primaci || [];
        var abs = '';
        primaci.forEach(function (p) {
            abs += '<tr><td class="oc-first">' + esc(p.ime) + '</td>' + sortNazivi.map(function (s) {
                var v = (p.sortimenti && p.sortimenti[s]) || 0;
                return '<td class="right ' + (typeof sortimentColClass === 'function' ? sortimentColClass(s) : '') + '">' + f2(v) + '</td>';
            }).join('') + '<td class="right oc-ukupno"><b>' + f2(p.ukupno || 0) + '</b></td></tr>';
        });
        abs += '<tr class="sum-row"><td class="oc-first">UKUPNO</td>' + sortNazivi.map(function (s) {
            return '<td class="right">' + f2((odjel.sortimenti && odjel.sortimenti[s]) || 0) + '</td>';
        }).join('') + '<td class="right oc-ukupno">' + f2(odjel.ukupno || 0) + '</td></tr>';

        // Procentualni udio svakog primača po sortimentu u SVOJOJ sječi; top 3 po koloni obojena (zlato/srebro/bronza)
        var medalje = ['#FFD700', '#C0C0C0', '#CD7F32'];
        var pct = primaci.map(function (p) {
            return sortNazivi.map(function (s) {
                var v = (p.sortimenti && p.sortimenti[s]) || 0;
                return p.ukupno > 0 ? v / p.ukupno * 100 : 0;
            });
        });
        var rang = sortNazivi.map(function (s, c) {
            var r = {};
            pct.map(function (row, i) { return { v: row[c], i: i }; })
                .filter(function (x) { return x.v > 0; })
                .sort(function (a, b) { return b.v - a.v; })
                .slice(0, 3).forEach(function (x, k) { r[x.i] = k; });
            return r;
        });
        var pr = '';
        primaci.forEach(function (p, i) {
            pr += '<tr><td class="oc-first">' + esc(p.ime) + '</td>' + sortNazivi.map(function (s, c) {
                var v = pct[i][c], k = rang[c][i];
                return '<td class="right"' + (k !== undefined ? ' style="background:' + medalje[k] + ';font-weight:700;"' : '') + '>' + (v > 0 ? v.toFixed(1).replace('.', ',') + '%' : '-') + '</td>';
            }).join('') + '</tr>';
        });
        return '<h4 class="oc-h4">Količine po primaču (m³)</h4><div class="oc-scroll"><table class="oc-table"><thead>' + zaglavlje(sortNazivi, 'Primač', true) + '</thead><tbody>' + abs + '</tbody></table></div>' +
            '<h4 class="oc-h4">Procentualni udio (%)</h4><div class="oc-scroll"><table class="oc-table"><thead>' + zaglavlje(sortNazivi, 'Primač', false) + '</thead><tbody>' + pr + '</tbody></table></div>';
    }

    function tijeloSimple(odjel, sortNazivi) {
        var uk = odjel.ukupno || 0;
        var m3 = sortNazivi.map(function (s) {
            return '<td class="right ' + (typeof sortimentColClass === 'function' ? sortimentColClass(s) : '') + '">' + f2((odjel.sortimenti && odjel.sortimenti[s]) || 0) + '</td>';
        }).join('');
        var p = sortNazivi.map(function (s) {
            var v = (odjel.sortimenti && odjel.sortimenti[s]) || 0;
            return '<td class="right ' + (typeof sortimentColClass === 'function' ? sortimentColClass(s) : '') + '">' + (v > 0 && uk > 0 ? (v / uk * 100).toFixed(1).replace('.', ',') + '%' : '-') + '</td>';
        }).join('');
        return '<div class="oc-scroll"><table class="oc-table"><thead>' + zaglavlje(sortNazivi, '', true) + '</thead><tbody>' +
            '<tr><td class="oc-first">m³</td>' + m3 + '<td class="right oc-ukupno"><b>' + f2(uk) + '</b></td></tr>' +
            '<tr><td class="oc-first">Udio</td>' + p + '<td class="right oc-ukupno">100%</td></tr></tbody></table></div>';
    }

    function kartica(odjel, idx, st) {
        var dana = danaOd(odjel.zadnjiDatum);
        var k = klasa(dana);
        var godina = odjel.godina ? '<span class="oc-year">' + esc(odjel.godina) + '</span>' : '';
        var badge = k === 'aktivno' ? '<span class="oc-badge">🪓 Aktivna sječa</span>' : '';
        var meta = odjel.zadnjiDatum ? 'Zadnji unos: ' + esc(odjel.zadnjiDatum) + ' (' + opis(dana) + ')' : 'Zadnji unos: N/A';
        var brojPrimaca = st.opts.kind === 'primaci' ? ' · ' + ((odjel.primaci || []).length) + ' primača' : '';
        return '<details class="oc-card oc-' + k + '" data-idx="' + idx + '"' + (k === 'aktivno' ? ' open' : '') + '>' +
            '<summary class="oc-head"><div class="oc-title"><span class="oc-name">📁 ' + esc(odjel.odjel) + '</span>' + godina + badge +
            '<span class="oc-meta">' + meta + brojPrimaca + '</span></div>' +
            '<div class="oc-total">' + f2(odjel.ukupno || 0) + '<small> m³</small></div><span class="oc-chev" aria-hidden="true">▾</span></summary>' +
            '<div class="oc-body" data-lazy="1"></div></details>';
    }

    function napuni(card, st) {
        var body = card.querySelector('.oc-body');
        if (!body || body.dataset.lazy !== '1') return;
        var odjel = st.lista[parseInt(card.dataset.idx, 10)];
        var sort = st.data.sortimentiNazivi || [];
        body.innerHTML = st.opts.kind === 'primaci' ? tijeloPrimaci(odjel, sort) : tijeloSimple(odjel, sort);
        body.dataset.lazy = '0';
        if (typeof window.initDragScroll === 'function') window.initDragScroll();
    }

    function iscrtaj(containerId) {
        var st = stanje[containerId];
        var host = document.getElementById(containerId);
        if (!st || !host) return;
        var list = host.querySelector('.oc-list');
        var odjeli = (st.data.odjeli || []).filter(function (o) {
            if (st.q && String(o.odjel || '').toUpperCase().indexOf(st.q.toUpperCase()) === -1) return false;
            var k = klasa(danaOd(o.zadnjiDatum));
            if (st.filter === 'aktivno') return k === 'aktivno';
            if (st.filter === '60') return k === 'aktivno' || k === 'nedavno';
            return true;
        });
        var cmp = {
            sjeca: function (a, b) { return ts(b.zadnjiDatum) - ts(a.zadnjiDatum); },
            ukupno: function (a, b) { return (b.ukupno || 0) - (a.ukupno || 0); },
            naziv: function (a, b) { return String(a.odjel || '').localeCompare(String(b.odjel || ''), 'bs', { numeric: true }); }
        }[st.sort];
        st.lista = odjeli.slice().sort(cmp);

        list.innerHTML = st.lista.length
            ? st.lista.map(function (o, i) { return kartica(o, i, st); }).join('')
            : '<div class="oc-empty">Nema odjela za odabrane filtere.</div>';
        list.querySelectorAll('details.oc-card').forEach(function (c) {
            if (c.open) napuni(c, st);
            c.addEventListener('toggle', function () { if (c.open) napuni(c, st); });
        });

        var ukupnoOdjela = (st.data.odjeli || []).length;
        host.querySelector('.oc-count').textContent = 'Prikazano: ' + st.lista.length + ' od ' + ukupnoOdjela + ' odjela';
        host.querySelectorAll('.oc-chip').forEach(function (c) { c.classList.toggle('active', c.dataset.f === st.filter); });
    }

    // data = { odjeli, sortimentiNazivi }; opts = { kind, pagPrevId, tema }
    window.renderOdjelKartice = function (containerId, data, opts) {
        var host = document.getElementById(containerId);
        if (!host || !data || !data.odjeli) return;
        opts = opts || {};
        var prev = stanje[containerId];
        stanje[containerId] = { q: prev ? prev.q : '', sort: prev ? prev.sort : 'sjeca', filter: prev ? prev.filter : '', data: data, opts: opts, lista: [] };

        // paginacija više nije potrebna (kartice se otvaraju na klik)
        if (opts.pagPrevId) {
            var pb = document.getElementById(opts.pagPrevId);
            if (pb && pb.parentElement) pb.parentElement.style.display = 'none';
        }

        var st = stanje[containerId];
        host.classList.add('oc-host', 'oc-' + (opts.tema || 'green'));
        host.innerHTML =
            '<div class="oc-toolbar">' +
              '<input type="search" class="oc-search" placeholder="🔍 Pretraži odjel…" aria-label="Pretraži odjel" value="' + esc(st.q) + '">' +
              '<select class="oc-sort" aria-label="Sortiranje">' +
                '<option value="sjeca">Zadnja sječa (najnovija)</option><option value="ukupno">Ukupno (najviše)</option><option value="naziv">Naziv odjela</option></select>' +
              '<div class="oc-chips">' +
                '<button type="button" class="oc-chip" data-f="">Svi</button>' +
                '<button type="button" class="oc-chip" data-f="aktivno">🪓 Aktivni (≤ 10 d)</button>' +
                '<button type="button" class="oc-chip" data-f="60">≤ 60 d</button></div>' +
              '<button type="button" class="oc-toggle">⇕ Otvori/zatvori sve</button>' +
              '<span class="oc-count"></span></div>' +
            '<div class="oc-list"></div>';

        host.querySelector('.oc-sort').value = st.sort;
        host.querySelector('.oc-search').addEventListener('input', function (e) { st.q = e.target.value.trim(); iscrtaj(containerId); });
        host.querySelector('.oc-sort').addEventListener('change', function (e) { st.sort = e.target.value; iscrtaj(containerId); });
        host.querySelectorAll('.oc-chip').forEach(function (c) {
            c.addEventListener('click', function () { st.filter = (st.filter === c.dataset.f) ? '' : c.dataset.f; iscrtaj(containerId); });
        });
        host.querySelector('.oc-toggle').addEventListener('click', function () {
            var cards = host.querySelectorAll('details.oc-card');
            var neOtvorene = Array.prototype.some.call(cards, function (c) { return !c.open; });
            cards.forEach(function (c) { c.open = neOtvorene; });
        });
        iscrtaj(containerId);
    };
})();
