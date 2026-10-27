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
    var state = { odjel: '', tab: 'sjeca', dana: 30, primke: null, otpreme: null, greska: '', samoPoslovodja: false };

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

    // Poslovođa vidi samo zapise svojih radilišta / svoje ime (isto pravilo kao tabovi SJEČA/OTPREMA)
    function poslovodjinZapis() {
        var user = window.currentUser || {};
        var ime = String(user.fullName || '').toUpperCase().trim();
        var rad = (typeof getPoslovodjaRadilista === 'function' ? getPoslovodjaRadilista() : []).map(function (r) { return String(r).toUpperCase().trim(); });
        return function (z) {
            var pp = String(z.poslovodja || '').toUpperCase().trim();
            if (pp && pp === ime) return true;
            return rad.length > 0 && rad.indexOf(String(z.radiliste || '').toUpperCase().trim()) > -1;
        };
    }

    function filtriraj(lista, odjel, dana) {
        var granica = dana > 0 ? startDana(new Date()) - dana * 86400000 : -Infinity;
        var out = [];
        var smijeVidjeti = state.samoPoslovodja ? poslovodjinZapis() : null;
        (lista || []).forEach(function (z) {
            if (smijeVidjeti && !smijeVidjeti(z)) return;
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

    // Tabela: kolone radnik (+ kupac za otpremu) + sortimenti + UKUPNO; dan se ispisuje samo na prvom redu
    function tabela(redovi, imeKolone, saKupcem) {
        if (!redovi.length) return '<div class="oa-empty">Nema evidentiranih unosa u odabranom periodu.</div>';
        var kolone = koloneSortimenata(redovi);
        var ukupno = {}; var sveUkupno = 0;
        kolone.forEach(function (k) { ukupno[k] = 0; });

        redovi.sort(function (a, b) { return (b.ts - a.ts) || String(a.meta.radnik).localeCompare(String(b.meta.radnik), 'bs'); });

        // Granica između grupa: prva kolona lišćara (iza Σ ČETINARI) dobija istaknutu lijevu liniju
        var grupaPocetak = null;
        kolone.forEach(function (k) {
            if (grupaPocetak === null && typeof sortimentColClass === 'function' && sortimentColClass(k).indexOf('col-liscari') > -1) grupaPocetak = k;
        });
        function kolClass(k) {
            return (typeof sortimentColClass === 'function' ? sortimentColClass(k) : '') + (k === grupaPocetak ? ' oa-grp-start' : '');
        }
        var html = '<div class="oa-scroll"><table class="oa-table"><thead><tr><th>Datum</th><th>' + imeKolone + '</th>' +
            (saKupcem ? '<th>Kupac</th>' : '') +
            kolone.map(function (k) { return '<th class="right ' + kolClass(k) + '">' + esc(k) + '</th>'; }).join('') +
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
                kolone.map(function (k) { return '<td class="right ' + kolClass(k) + '">' + fmt(r.sort[k] || 0) + '</td>'; }).join('') +
                '<td class="right oa-ukupno"><b>' + fmt(u) + '</b></td></tr>';
        });

        html += '<tr class="sum-row oa-total"><td colspan="' + (saKupcem ? 3 : 2) + '">UKUPNO</td>' +
            kolone.map(function (k) { return '<td class="right ' + kolClass(k) + '">' + fmt(ukupno[k]) + '</td>'; }).join('') +
            '<td class="right">' + fmt(sveUkupno) + '</td></tr></tbody></table></div>';
        return html;
    }

    function render() {
        var body = document.getElementById('oa-body');
        if (!body) return;
        if (state.greska) { body.innerHTML = '<div class="oa-empty">❌ ' + esc(state.greska) + '</div>'; return; }
        if (!state.primke || !state.otpreme) { body.innerHTML = '<div class="oa-empty">⏳ Učitavam podatke…</div>'; return; }

        var main;
        if (state.tab === 'sjeca') {
            var z = filtriraj(state.primke, state.odjel, state.dana);
            var redovi = grupisi(z, function (x) { return x._ts + '|' + x.primac; }, function (x) { return { radnik: x.primac }; });
            main = tabela(redovi, 'Primač', false);
        } else {
            var o = filtriraj(state.otpreme, state.odjel, state.dana);
            var redoviO = grupisi(o, function (x) { return x._ts + '|' + x.otpremac + '|' + x.kupac; }, function (x) { return { radnik: x.otpremac, kupac: x.kupac }; });
            main = tabela(redoviO, 'Otpremač', true);
        }
        var html = '<div class="oa-layout oa-single"><section class="oa-main">' + main + '</section></div>';
        body.innerHTML = html;

        // Modal je izvan #app-screen pa ga drag-scroll observer ne vidi — priključi ručno
        if (typeof window.initDragScroll === 'function') window.initDragScroll();
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

    window.otvoriOdjelAktivnost = async function (odjelNaziv, radiliste, izvodjac, samoPoslovodja) {
        osiguraj();
        state.odjel = odjelNaziv; state.tab = 'sjeca'; state.dana = 30; state.greska = ''; state.samoPoslovodja = !!samoPoslovodja;
        document.getElementById('oa-title').textContent = odjelNaziv;
        document.getElementById('oa-meta').textContent = [radiliste, izvodjac].filter(Boolean).join(' · ');
        document.getElementById('oa-modal').classList.add('show');
        document.body.classList.add('oa-open');
        render();

        try {
            var podaci = await ucitajPodatke();
            state.primke = podaci.primke;
            state.otpreme = podaci.otpreme;
        } catch (e) {
            state.greska = e.message || 'Greška pri učitavanju podataka';
        }
        render();
    };

    // Primke + otpreme (isti keš kao Karta/Stanje zaliha); baca grešku ako nisu dostupne
    async function ucitajPodatke() {
        var rez = await Promise.all([
            fetchWithCache(buildApiUrl('primke'), 'cache_primke_sjeca', false, 180000),
            fetchWithCache(buildApiUrl('otpreme'), 'cache_otpreme_tab', false, 180000)
        ]);
        if (rez[0].error || rez[1].error) throw new Error(rez[0].error || rez[1].error);
        if (rez[0].offline || rez[1].offline) throw new Error('Nema mreže, a podaci još nisu sačuvani. Otvorite tab dok ste online.');
        return { primke: rez[0].primke || [], otpreme: rez[1].otpreme || [] };
    }

    // ===== POSLOVOĐA: tab "Aktivni odjeli" =====
    var pa = { dana: 10 };

    window.setPoslovodjaAktivniDana = function (d) { pa.dana = d; window.loadPoslovodjaAktivni(); };

    window.loadPoslovodjaAktivni = async function () {
        var body = document.getElementById('poslovodja-aktivni-body');
        if (!body) return;
        var radEl = document.getElementById('poslovodja-aktivni-radilista-list');
        if (radEl && typeof getPoslovodjaRadilista === 'function') radEl.textContent = getPoslovodjaRadilista().join(', ') || '—';
        if (!state.primke) body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#4b5563;">⏳ Učitavam…</td></tr>';

        try {
            var podaci = await ucitajPodatke();
            state.primke = podaci.primke; state.otpreme = podaci.otpreme;
            var moje = poslovodjinZapis();
            var odjeli = {};
            function odjelZapis(z) {
                var k = norm(z.odjel);
                if (!odjeli[k]) odjeli[k] = { naziv: String(z.odjel || ''), radiliste: '', izvodjac: '', sjeca: 0, otprema: 0, zadnja: 0 };
                return odjeli[k];
            }
            var godina = new Date().getFullYear();
            // Ukupno po odjelu: Σ ČETINARI + LIŠĆARI (zapisi su po sortimentu); zadnja sječa preko svih godina
            podaci.primke.forEach(function (z) {
                if (!moje(z)) return;
                var d = parseDatum(z.datum); if (!d) return;
                var o = odjelZapis(z);
                if (z.radiliste) o.radiliste = z.radiliste;
                if (z.izvodjac) o.izvodjac = z.izvodjac;
                var kol = parseFloat(z.kolicina) || 0;
                if (kol > 0) o.zadnja = Math.max(o.zadnja, startDana(d));
                if (d.getFullYear() === godina && (z.sortiment === 'Σ ČETINARI' || z.sortiment === 'LIŠĆARI')) o.sjeca += kol;
            });
            podaci.otpreme.forEach(function (z) {
                if (!moje(z)) return;
                var d = parseDatum(z.datum); if (!d || d.getFullYear() !== godina) return;
                if (z.sortiment === 'Σ ČETINARI' || z.sortiment === 'LIŠĆARI') odjelZapis(z).otprema += parseFloat(z.kolicina) || 0;
            });

            var danas = startDana(new Date());
            var lista = Object.keys(odjeli).map(function (k) { return odjeli[k]; })
                .filter(function (o) {
                    if (pa.dana === 'god') return o.sjeca > 0 || o.otprema > 0; // svi odjeli sa sječom/otpremom u tekućoj godini
                    return o.zadnja && Math.round((danas - o.zadnja) / 86400000) <= pa.dana;
                })
                .sort(function (a, b) { return b.zadnja - a.zadnja; });

            body.innerHTML = lista.length ? lista.map(function (o) {
                var dana = o.zadnja ? Math.round((danas - o.zadnja) / 86400000) : null;
                var kad = dana === null ? 'nema sječe' : dana <= 0 ? 'danas' : dana === 1 ? 'jučer' : 'prije ' + dana + ' d';
                var pan = o.sjeca - o.otprema;
                return '<tr style="cursor:pointer;" onclick="otvoriOdjelAktivnost(\'' + jsAttr(o.naziv) + '\', \'' + jsAttr(o.radiliste) + '\', \'' + jsAttr(o.izvodjac) + '\', true)" title="Klikni za sječu i otpremu po danima">' +
                    '<td style="font-weight:700;">' + esc(o.naziv) + '</td>' +
                    '<td class="right">' + o.sjeca.toFixed(2) + '</td>' +
                    '<td class="right">' + o.otprema.toFixed(2) + '</td>' +
                    '<td class="right">' + pan.toFixed(2) + '</td>' +
                    '<td>' + esc(o.radiliste || '-') + '</td><td>' + esc(o.izvodjac || '-') + '</td>' +
                    '<td><b>' + (o.zadnja ? datumTekst(o.zadnja) : '-') + '</b> <small style="color:#6b7280;">(' + kad + ')</small></td></tr>';
            }).join('') : '<tr><td colspan="7" style="text-align:center;padding:28px;color:#4b5563;">Nema odjela vaših radilišta ' + (pa.dana === 'god' ? 'sa sječom ili otpremom u ' + godina + '. godini.' : 'sa sječom u zadnjih ' + pa.dana + ' dana.') + '</td></tr>';

            var cnt = document.getElementById('poslovodja-aktivni-count');
            if (cnt) cnt.textContent = lista.length + ' odjela';
            document.querySelectorAll('#poslovodja-aktivni-chips .sz-chip').forEach(function (c) {
                c.classList.toggle('active', (c.dataset.dana === 'god' ? 'god' : parseInt(c.dataset.dana, 10)) === pa.dana);
            });
            if (typeof markTabRendered === 'function') markTabRendered('poslovodja-aktivni');
        } catch (e) {
            body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px;color:#dc2626;">❌ ' + esc(e.message || 'Greška pri učitavanju') + '</td></tr>';
        }
    };
})();
