// ============================================================
// AKTIVNI ODJELI — detalji: sječa po danima (ko je primao) i otprema (ko je otpremao, kupac, sortiment)
//
// Podaci dolaze iz istih endpointa/keša kao Karta i Stanje zaliha ('primke', 'otpreme'),
// jedan red po (datum, radnik[, kupac]) sa kolonama sortimenata — kao u odjel-sheetu
// iz kojeg se podaci indeksiraju.
// ============================================================
(function () {
    'use strict';

    var AGREGATI = ['TRUPCI Č', 'Σ ČETINARI', 'TRUPCI L', 'LIŠĆARI', 'UKUPNO Č+L'];
    var state = { odjel: '', tab: 'sjeca', dana: 30, primke: null, otpreme: null, greska: '' };

    function esc(s) { return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s == null ? '' : s); }
    function fmt(v) { return v > 0 ? v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'; }

    function norm(s) {
        return String(s || '').toUpperCase().replace(/[ČĆ]/g, 'C').replace(/Š/g, 'S').replace(/Ž/g, 'Z').replace(/Đ/g, 'DJ').replace(/\s+/g, ' ').trim();
    }
    // Isti odjel: tačan naziv ili jedan završava drugim na granici riječi ("RISOVAC KRUPA 55" ↔ "55")
    function istiOdjel(a, b) {
        var x = norm(a), y = norm(b);
        return x === y || x.endsWith(' ' + y) || y.endsWith(' ' + x);
    }

    function startDana(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
    function parseDatum(s) {
        return typeof parseDatumDDMMYYYY === 'function' ? parseDatumDDMMYYYY(s) : null;
    }

    // Ukupno reda: Σ ČETINARI + LIŠĆARI kad postoje, inače zbir pojedinačnih sortimenata
    function ukupnoReda(sort) {
        if (sort['Σ ČETINARI'] != null || sort['LIŠĆARI'] != null) return (sort['Σ ČETINARI'] || 0) + (sort['LIŠĆARI'] || 0);
        var t = 0;
        Object.keys(sort).forEach(function (k) { if (AGREGATI.indexOf(k) === -1) t += sort[k]; });
        return t;
    }

    // Grupiši zapise (jedan zapis = jedan sortiment) po ključu → { meta, sort{} , ts }
    function grupisi(zapisi, kljucFn, metaFn) {
        var mapa = {};
        zapisi.forEach(function (z) {
            var k = kljucFn(z);
            if (!mapa[k]) mapa[k] = { meta: metaFn(z), ts: z._ts, sort: {} };
            mapa[k].sort[z.sortiment] = (mapa[k].sort[z.sortiment] || 0) + (parseFloat(z.kolicina) || 0);
        });
        return Object.keys(mapa).map(function (k) { return mapa[k]; });
    }

    function filtriraj(lista, odjel, dana) {
        var granica = dana > 0 ? startDana(new Date()) - dana * 86400000 : -Infinity;
        var out = [];
        (lista || []).forEach(function (z) {
            if (!istiOdjel(z.odjel, odjel)) return;
            var d = parseDatum(z.datum);
            if (!d) return;
            var ts = startDana(d);
            if (ts < granica) return;
            out.push(Object.assign({}, z, { _ts: ts }));
        });
        return out;
    }

    function koloneSortimenata(redovi) {
        var prisutni = {};
        redovi.forEach(function (r) { Object.keys(r.sort).forEach(function (k) { if (r.sort[k] > 0) prisutni[k] = true; }); });
        var order = (typeof SORTIMENTI_ORDER !== 'undefined') ? SORTIMENTI_ORDER : [];
        var kolone = order.filter(function (k) { return prisutni[k] && k !== 'UKUPNO Č+L'; });
        Object.keys(prisutni).forEach(function (k) { if (kolone.indexOf(k) === -1 && k !== 'UKUPNO Č+L') kolone.push(k); });
        return kolone;
    }

    function datumTekst(ts) {
        var d = new Date(ts);
        return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
    }

    function sazetak(naslov, mapa) {
        var stavke = Object.keys(mapa).map(function (k) { return { ime: k, v: mapa[k] }; }).sort(function (a, b) { return b.v - a.v; });
        if (!stavke.length) return '';
        return '<div class="oa-sum"><div class="oa-sum-title">' + naslov + '</div><div class="oa-sum-chips">' +
            stavke.map(function (s) { return '<span class="oa-chip"><b>' + esc(s.ime || '—') + '</b> ' + fmt(s.v) + ' m³</span>'; }).join('') +
            '</div></div>';
    }

    // Tabela: kolone radnik (+ kupac za otpremu) + sortimenti + UKUPNO; dan se ispisuje samo na prvom redu
    function tabela(redovi, imeKolone, saKupcem) {
        if (!redovi.length) return '<div class="oa-empty">Nema evidentiranih unosa u odabranom periodu.</div>';
        var kolone = koloneSortimenata(redovi);
        var ukupno = {}; var sveUkupno = 0;
        kolone.forEach(function (k) { ukupno[k] = 0; });

        redovi.sort(function (a, b) { return (b.ts - a.ts) || String(a.meta.radnik).localeCompare(String(b.meta.radnik), 'bs'); });

        var html = '<div class="oa-scroll"><table class="oa-table"><thead><tr><th>Datum</th><th>' + imeKolone + '</th>' +
            (saKupcem ? '<th>Kupac</th>' : '') +
            kolone.map(function (k) { return '<th class="right ' + (typeof sortimentColClass === 'function' ? sortimentColClass(k) : '') + '">' + esc(k) + '</th>'; }).join('') +
            '<th class="right oa-ukupno">UKUPNO</th></tr></thead><tbody>';

        var prethodniTs = null;
        redovi.forEach(function (r) {
            var u = ukupnoReda(r.sort);
            sveUkupno += u;
            kolone.forEach(function (k) { ukupno[k] += r.sort[k] || 0; });
            var prviUDanu = r.ts !== prethodniTs;
            prethodniTs = r.ts;
            html += '<tr class="' + (prviUDanu ? 'oa-novi-dan' : '') + '"><td class="oa-datum">' + (prviUDanu ? datumTekst(r.ts) : '') + '</td>' +
                '<td class="oa-radnik">' + esc(r.meta.radnik || '—') + '</td>' +
                (saKupcem ? '<td>' + esc(r.meta.kupac || '—') + '</td>' : '') +
                kolone.map(function (k) { return '<td class="right ' + (typeof sortimentColClass === 'function' ? sortimentColClass(k) : '') + '">' + fmt(r.sort[k] || 0) + '</td>'; }).join('') +
                '<td class="right oa-ukupno"><b>' + fmt(u) + '</b></td></tr>';
        });

        html += '<tr class="sum-row oa-total"><td colspan="' + (saKupcem ? 3 : 2) + '">UKUPNO</td>' +
            kolone.map(function (k) { return '<td class="right">' + fmt(ukupno[k]) + '</td>'; }).join('') +
            '<td class="right">' + fmt(sveUkupno) + '</td></tr></tbody></table></div>';
        return html;
    }

    function render() {
        var body = document.getElementById('oa-body');
        if (!body) return;
        if (state.greska) { body.innerHTML = '<div class="oa-empty">❌ ' + esc(state.greska) + '</div>'; return; }
        if (!state.primke || !state.otpreme) { body.innerHTML = '<div class="oa-empty">⏳ Učitavam podatke…</div>'; return; }

        var html;
        if (state.tab === 'sjeca') {
            var z = filtriraj(state.primke, state.odjel, state.dana);
            var redovi = grupisi(z, function (x) { return x._ts + '|' + x.primac; }, function (x) { return { radnik: x.primac }; });
            var poPrimacu = {};
            redovi.forEach(function (r) { poPrimacu[r.meta.radnik] = (poPrimacu[r.meta.radnik] || 0) + ukupnoReda(r.sort); });
            html = sazetak('Ko je primao (ukupno u periodu)', poPrimacu) + tabela(redovi, 'Primač', false);
        } else {
            var o = filtriraj(state.otpreme, state.odjel, state.dana);
            var redoviO = grupisi(o, function (x) { return x._ts + '|' + x.otpremac + '|' + x.kupac; }, function (x) { return { radnik: x.otpremac, kupac: x.kupac }; });
            var poOtpremacu = {}, poKupcu = {};
            redoviO.forEach(function (r) {
                var u = ukupnoReda(r.sort);
                poOtpremacu[r.meta.radnik] = (poOtpremacu[r.meta.radnik] || 0) + u;
                poKupcu[r.meta.kupac || '—'] = (poKupcu[r.meta.kupac || '—'] || 0) + u;
            });
            html = sazetak('Ko je otpremao', poOtpremacu) + sazetak('Kupci', poKupcu) + tabela(redoviO, 'Otpremač', true);
        }
        body.innerHTML = html;

        document.querySelectorAll('#oa-modal [data-oa-tab]').forEach(function (b) { b.classList.toggle('active', b.dataset.oaTab === state.tab); });
        document.querySelectorAll('#oa-modal [data-oa-dana]').forEach(function (b) { b.classList.toggle('active', parseInt(b.dataset.oaDana, 10) === state.dana); });
    }

    function osiguraj() {
        if (document.getElementById('oa-modal')) return;
        var m = document.createElement('div');
        m.id = 'oa-modal';
        m.className = 'oa-modal';
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-modal', 'true');
        m.innerHTML =
            '<div class="oa-card">' +
              '<div class="oa-head"><div><div class="oa-kicker">Aktivni odjel</div><h3 id="oa-title"></h3><div class="oa-meta" id="oa-meta"></div></div>' +
              '<button type="button" class="oa-close" onclick="zatvoriOdjelAktivnost()" aria-label="Zatvori">✕</button></div>' +
              '<div class="oa-toolbar">' +
                '<div class="oa-tabs" role="tablist">' +
                  '<button type="button" role="tab" data-oa-tab="sjeca" onclick="oaPostavi(\'tab\',\'sjeca\')">🪓 Sječa po danima</button>' +
                  '<button type="button" role="tab" data-oa-tab="otprema" onclick="oaPostavi(\'tab\',\'otprema\')">🚛 Otprema</button>' +
                '</div>' +
                '<div class="oa-periods" role="group" aria-label="Period">' +
                  '<button type="button" data-oa-dana="10" onclick="oaPostavi(\'dana\',10)">10 dana</button>' +
                  '<button type="button" data-oa-dana="30" onclick="oaPostavi(\'dana\',30)">30 dana</button>' +
                  '<button type="button" data-oa-dana="90" onclick="oaPostavi(\'dana\',90)">90 dana</button>' +
                  '<button type="button" data-oa-dana="0" onclick="oaPostavi(\'dana\',0)">Sve</button>' +
                '</div>' +
              '</div>' +
              '<div class="oa-body" id="oa-body"></div>' +
            '</div>';
        m.addEventListener('click', function (e) { if (e.target === m) window.zatvoriOdjelAktivnost(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.zatvoriOdjelAktivnost(); });
        document.body.appendChild(m);
    }

    window.oaPostavi = function (kljuc, vrijednost) {
        state[kljuc] = vrijednost;
        render();
    };

    window.zatvoriOdjelAktivnost = function () {
        var m = document.getElementById('oa-modal');
        if (m) m.classList.remove('show');
        document.body.classList.remove('oa-open');
    };

    window.otvoriOdjelAktivnost = async function (odjelNaziv, radiliste, izvodjac) {
        osiguraj();
        state.odjel = odjelNaziv; state.tab = 'sjeca'; state.dana = 30; state.greska = '';
        document.getElementById('oa-title').textContent = odjelNaziv;
        document.getElementById('oa-meta').textContent = [radiliste, izvodjac].filter(Boolean).join(' · ');
        document.getElementById('oa-modal').classList.add('show');
        document.body.classList.add('oa-open');
        render();

        try {
            var rez = await Promise.all([
                fetchWithCache(buildApiUrl('primke'), 'cache_primke_sjeca', false, 180000),
                fetchWithCache(buildApiUrl('otpreme'), 'cache_otpreme_tab', false, 180000)
            ]);
            if (rez[0].error || rez[1].error) throw new Error(rez[0].error || rez[1].error);
            if (rez[0].offline || rez[1].offline) throw new Error('Nema mreže, a podaci još nisu sačuvani. Otvorite Stanje zaliha dok ste online.');
            state.primke = rez[0].primke || [];
            state.otpreme = rez[1].otpreme || [];
        } catch (e) {
            state.greska = e.message || 'Greška pri učitavanju podataka';
        }
        render();
    };
})();
