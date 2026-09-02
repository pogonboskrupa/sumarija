// ============================================================
// 🖨️ PRINT UTILS — Profesionalni ispis tabela
// printActiveView(contentId, tabLabel, accentColor)
// printMjesecniCard(tip)           — za Sječa/otprema tab
// toggleStanjeZalihaPrintMenu(e)   — dropdown izbornik za Stanje zaliha
// printStanjeZalihaAgregatna()     — agregatna + detaljna sortabilna tabela
// printStanjeZalihaPoOdjelima()    — po odjelu: Projekat/Sječa/Otprema/Zaliha
// printKubikator()                 — Kubikator: rekapitulacija + tabela unosa
// ============================================================

// ─── Kubikator print ─────────────────────────────────────────
function printKubikator() {
    const unosi = (typeof getKubikatorUnosi === 'function') ? getKubikatorUnosi() : [];
    if (!unosi.length) {
        if (typeof showWarning === 'function') showWarning('Nema unosa za štampanje');
        else alert('Nema unosa za štampanje.');
        return;
    }

    const accent = '#047857';
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    // Isti format kao na ekranu (js/kubikator.js _fmt) — zarez kao decimalni
    // separator, ne tačka, isti "round half up" zaokruživanje (vidi
    // _roundHalfUp u js/kubikator.js), I ISTI broj decimala koji je korisnik
    // trenutno izabrao (kubikatorToggleDecimals, 2 podrazumijevano ili 3) —
    // da se brojevi na štampi i ekranu poklapaju do zadnje decimale.
    const DEC = (typeof getKubikatorDec === 'function') ? getKubikatorDec() : 2;
    const _roundHalfUp2 = n => { const p = Math.pow(10, DEC); return Math.round(n * p * (1 + Number.EPSILON)) / p; };
    const fmt2 = n => _roundHalfUp2(Number(n || 0)).toLocaleString('de-DE', { minimumFractionDigits: DEC, maximumFractionDigits: DEC });

    const fmtTs = ts => new Date(ts).toLocaleString('bs-BA', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Vrsta drveta — nedostaje li u.vrsta (zapisi od prije nego je "prostorno
    // drvo" dodano), jedini mod koji je tad postojao je oblovina.
    const vrstaNaziv = v => v === 'prostorno' ? 'Prostorno drvo' : 'Oblovina';
    // Bočni prikaz dimenzija po unosu — različit oblik podataka po vrsti
    // (precnik/duzina za oblovinu, sirina/visina za prostorno drvo), pa se
    // OVDJE svodi na jedan tekst po redu umjesto dvije odvojene kolone koje
    // bi za polovinu unosa uvijek bile prazne/pogrešno označene.
    const dimenzijeOpis = u => u.vrsta === 'prostorno'
        ? `Š ${fmt2(u.sirina)} × V ${fmt2(u.visina)} m`
        : `⌀ ${u.precnik} cm × ${fmt2(u.duzina)} m`;

    // Rekapitulacija po vrsti drveta (Oblovina / Prostorno drvo) — brz
    // ukupan pregled na vrhu. Zbir VEĆ ZAOKRUŽENIH vrijednosti (onih
    // ispisanih po redu), ne zaokruženi zbir sirovih vrijednosti — inače
    // zbir stavki na štampi ne odgovara prikazanom ukupnom (isti razlog kao
    // _renderMemorija u kubikator.js).
    const mapa = {};
    unosi.forEach(u => {
        const key = vrstaNaziv(u.vrsta);
        if (!mapa[key]) mapa[key] = { kom: 0, m3: 0 };
        mapa[key].kom++;
        mapa[key].m3 += _roundHalfUp2(Number(u.zapremina) || 0);
    });
    const ukupnoM3 = unosi.reduce((s, u) => s + _roundHalfUp2(Number(u.zapremina) || 0), 0);

    const rekapRows = Object.keys(mapa).map(s => `
        <tr>
            <td style="padding:7px 10px;font-weight:600;">${s}</td>
            <td style="padding:7px 10px;text-align:center;">${mapa[s].kom}</td>
            <td style="padding:7px 10px;text-align:right;font-weight:700;color:${accent};">${fmt2(mapa[s].m3)}</td>
        </tr>`).join('');

    const rekapHtml = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #d1d5db;">
            <thead>
                <tr style="background:${accent};color:white;">
                    <th style="padding:9px 10px;text-align:left;">Vrsta</th>
                    <th style="padding:9px 10px;text-align:center;">Komada</th>
                    <th style="padding:9px 10px;text-align:right;">m³</th>
                </tr>
            </thead>
            <tbody>
                ${rekapRows}
                <tr style="background:#f0fdf4;border-top:2px solid ${accent};">
                    <td style="padding:9px 10px;font-weight:700;">UKUPNO</td>
                    <td style="padding:9px 10px;text-align:center;font-weight:700;">${unosi.length}</td>
                    <td style="padding:9px 10px;text-align:right;font-weight:700;color:${accent};">${fmt2(ukupnoM3)}</td>
                </tr>
            </tbody>
        </table>`;

    // Rekapitulacija po STRANICAMA i SORTIMENTU — isti prikaz kao "📖
    // Rekapitulacija" na ekranu (js/kubikator.js _renderRekap/_rekapGrupe),
    // do sada je štampa imala samo grubi zbir po vrsti drveta iznad, bez
    // sortimenta i bez podjele po stranicama (fizička "stranica" = 20 unosa,
    // isto kao u službenoj knjizi na terenu). u.stranica je od nedavno
    // TRAJNO svojstvo svakog unosa (vidi kubikator.js _trenutnaStranica) —
    // stariji zapisi (prije te izmjene) nemaju ga, pa se tretiraju kao
    // stranica 1 (isto kao BEZ_SORTIMENTA fallback ispod).
    const BEZ_SORTIMENTA = 'Bez sortimenta';
    const sortimentRedoslijed = (typeof window.getKubikatorSortimentRedoslijed === 'function')
        ? window.getKubikatorSortimentRedoslijed() : [];
    const sortirajSortimente = kljucevi => kljucevi.sort((a, b) => {
        if (a === BEZ_SORTIMENTA) return 1;
        if (b === BEZ_SORTIMENTA) return -1;
        const ia = sortimentRedoslijed.indexOf(a), ib = sortimentRedoslijed.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });

    const poStranici = {};
    const redoslijedStranica = [];
    unosi.forEach(u => {
        const s = u.stranica || 1;
        if (!poStranici[s]) { poStranici[s] = []; redoslijedStranica.push(s); }
        poStranici[s].push(u);
    });
    redoslijedStranica.sort((a, b) => b - a); // najnovija stranica prva — isto kao ekran

    const stranicaHtml = redoslijedStranica.map(s => {
        const grupa = poStranici[s];
        const sortMapa = {};
        grupa.forEach(u => {
            const kljuc = u.sortiment || BEZ_SORTIMENTA;
            if (!sortMapa[kljuc]) sortMapa[kljuc] = { kom: 0, m3: 0 };
            sortMapa[kljuc].kom++;
            sortMapa[kljuc].m3 += _roundHalfUp2(Number(u.zapremina) || 0);
        });
        const ukupnoStranice = grupa.reduce((s2, u) => s2 + _roundHalfUp2(Number(u.zapremina) || 0), 0);
        const sortRows = sortirajSortimente(Object.keys(sortMapa)).map(k => `
            <tr>
                <td style="padding:6px 10px;">${escapeHtml(k)}</td>
                <td style="padding:6px 10px;text-align:center;">${sortMapa[k].kom}</td>
                <td style="padding:6px 10px;text-align:right;font-weight:700;color:${accent};">${fmt2(sortMapa[k].m3)}</td>
            </tr>`).join('');
        return `
            <div style="margin-bottom:16px;break-inside:avoid;">
                <div style="font-weight:700;margin-bottom:4px;">📄 Stranica ${s}
                    <span style="font-weight:400;color:#6b7280;">(${grupa.length} kom)</span>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #d1d5db;">
                    <thead>
                        <tr style="background:#f0fdf4;">
                            <th style="padding:6px 10px;text-align:left;">Sortiment</th>
                            <th style="padding:6px 10px;text-align:center;">Komada</th>
                            <th style="padding:6px 10px;text-align:right;">m³</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortRows}
                        <tr style="border-top:1px solid ${accent};">
                            <td style="padding:6px 10px;font-weight:700;">Ukupno stranica ${s}</td>
                            <td style="padding:6px 10px;text-align:center;font-weight:700;">${grupa.length}</td>
                            <td style="padding:6px 10px;text-align:right;font-weight:700;color:${accent};">${fmt2(ukupnoStranice)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>`;
    }).join('');

    // Tabela svih unosa — Sortiment umjesto Napomene (napomena nema UI za
    // unos u Kubikatoru, uvijek je prazna; sortiment je stvarni podatak koji
    // svaki unos nosi otkad postoji #kub-sortiment-select).
    const tabelaRows = [...unosi].reverse().map((u, i) => `
        <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:7px 8px;text-align:center;color:#4b5563;">${unosi.length - i}</td>
            <td style="padding:7px 8px;font-size:11px;">${fmtTs(u.ts)}</td>
            <td style="padding:7px 8px;font-weight:600;">${vrstaNaziv(u.vrsta)}</td>
            <td style="padding:7px 8px;text-align:center;">${dimenzijeOpis(u)}</td>
            <td style="padding:7px 8px;text-align:right;font-weight:700;color:${accent};">${fmt2(u.zapremina)}</td>
            <td style="padding:7px 8px;font-size:11px;color:#4b5563;">${escapeHtml(u.sortiment || '—')}</td>
        </tr>`).join('');

    const tabelaHtml = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #d1d5db;">
            <thead>
                <tr style="background:${accent};color:white;">
                    <th style="padding:9px 8px;text-align:center;">#</th>
                    <th style="padding:9px 8px;text-align:left;">Datum/Vrij.</th>
                    <th style="padding:9px 8px;text-align:left;">Vrsta</th>
                    <th style="padding:9px 8px;text-align:center;">Dimenzije</th>
                    <th style="padding:9px 8px;text-align:right;">m³</th>
                    <th style="padding:9px 8px;text-align:left;">Sortiment</th>
                </tr>
            </thead>
            <tbody>${tabelaRows}</tbody>
        </table>`;

    const sectionsHtml = `
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accent};">Rekapitulacija</div>
            ${rekapHtml}
        </div>
        <div class="print-section" style="page-break-before:always;">
            <div class="section-header" style="border-left:4px solid ${accent};">Rekapitulacija po stranicama i sortimentu</div>
            ${stranicaHtml}
        </div>
        <div class="print-section" style="page-break-before:always;">
            <div class="section-header" style="border-left:4px solid ${accent};">Svi unosi (${unosi.length} komada)</div>
            ${tabelaHtml}
        </div>`;

    const win = window.open('', '_blank', 'width=1100,height=900,scrollbars=yes');
    if (!win) {
        if (typeof showError === 'function') showError('Popup blokiran', 'Dozvolite popup prozore za štampanje.');
        else alert('Popup blokiran — dozvolite popup prozore za štampanje.');
        return;
    }
    win.document.write(buildPrintDocument({
        tabLabel: 'Kubikator',
        activeTabLabel: 'Terenski pregled',
        accentColor: accent,
        monthName: datumStampe,
        year: '',
        datumStampe,
        vrijemeStampe,
        sectionsHtml
    }));
    win.document.close();
}

// ─── Izvođač — sječa po sortimentima (mjesečno) print ─────────
// Štampa TAČNO ono što je trenutno izabrano u detaljnom pregledu izvođača
// (index.html #primaci-izvodjac-select / #primaci-izvodjac-mjesec-select) —
// čita direktno _primaciIzvodjaciData (js/app.js), isti podaci koje
// renderPrimaciIzvodjacMjesecniSortimenti prikazuje na ekranu, bez novog
// fetch-a. Sortimenti su ovdje REDOVI (ne kolone kao na ekranu) — 20 uskih
// kolona jedna do druge se ne bi uklopilo na štampanu stranicu, dok ekran
// ima vodoravni skrol kao sigurnu rezervu.
function printPrimaciIzvodjacMjesecniSortimenti() {
    if (typeof _primaciIzvodjaciData === 'undefined' || !_primaciIzvodjaciData) {
        if (typeof showWarning === 'function') showWarning('Nema podataka za štampanje');
        return;
    }
    const sel = document.getElementById('primaci-izvodjac-select');
    if (!sel || !sel.value) {
        if (typeof showWarning === 'function') showWarning('Prvo izaberite izvođača za detaljan pregled');
        return;
    }
    const izvodjac = (_primaciIzvodjaciData.izvodjaci || []).find(iz => iz.naziv === sel.value);
    if (!izvodjac) {
        if (typeof showWarning === 'function') showWarning('Izvođač nije pronađen');
        return;
    }

    const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    const mjesecSel = document.getElementById('primaci-izvodjac-mjesec-select');
    const mIdx = parseInt(mjesecSel ? mjesecSel.value : '0', 10) || 0;
    const mjesecNaziv = mjeseciNazivi[mIdx] || mjeseciNazivi[0];
    const godina = new Date().getFullYear();
    const sortimentiNazivi = _primaciIzvodjaciData.sortimentiNazivi || [];
    // mjeseciSortimenti nedostaje u starijem keširanom odgovoru (prije ove
    // izmjene) — prazan objekat umjesto greške dok se keš ne osvježi.
    const mjesecPodaci = (izvodjac.mjeseciSortimenti || [])[mIdx] || {};

    const accent = '#ea580c';
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });
    const fmt2 = n => (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const rows = sortimentiNazivi.map(s => {
        const v = mjesecPodaci[s] || 0;
        return `
        <tr>
            <td style="padding:7px 10px;font-weight:600;">${escapeHtml(s)}</td>
            <td style="padding:7px 10px;text-align:right;${v > 0 ? `font-weight:700;color:${accent};` : 'color:#9ca3af;'}">${v > 0 ? fmt2(v) : '-'}</td>
        </tr>`;
    }).join('');

    const tableHtml = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #d1d5db;">
            <thead>
                <tr style="background:${accent};color:white;">
                    <th style="padding:9px 10px;text-align:left;">Sortiment</th>
                    <th style="padding:9px 10px;text-align:right;">m³</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;

    const sectionsHtml = `
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accent};">Sječa po sortimentima — ${mjesecNaziv} ${godina}</div>
            ${tableHtml}
        </div>`;

    const win = window.open('', '_blank', 'width=900,height=900,scrollbars=yes');
    if (!win) {
        if (typeof showError === 'function') showError('Popup blokiran', 'Dozvolite popup prozore za štampanje.');
        else alert('Popup blokiran — dozvolite popup prozore za štampanje.');
        return;
    }
    win.document.write(buildPrintDocument({
        tabLabel: 'Izvođači radova',
        activeTabLabel: 'Sječa po sortimentima — mjesečno',
        accentColor: accent,
        monthName: mjesecNaziv,
        year: godina,
        datumStampe,
        vrijemeStampe,
        personLabel: escapeHtml(izvodjac.naziv),
        sectionsHtml
    }));
    win.document.close();
}

// ─── Izvođači radova — pojedinačno/sve print ──────────────────
// tableToCleanHtml + section-header, isti obrazac kao printMjesecniCard.
// Vraća section HTML ili null (nema podataka) — koristi ga i pojedinačni
// print (printIzvodjaciTabela) i "štampaj sve" (printIzvodjaciSve).
function _izvodjaciPrintSection(tableId, naslov, accent) {
    const tableEl = document.getElementById(tableId);
    if (!tableEl) return null;
    const tbody = tableEl.querySelector('tbody');
    if (!tbody || !tbody.querySelector('tr td')) return null;
    return `
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accent};">${naslov}</div>
            ${tableToCleanHtml(tableEl)}
        </div>`;
}

function _openIzvodjaciPrint(activeTabLabel, sectionsHtml, personLabel) {
    const accent = '#ea580c';
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    const win = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!win) {
        if (typeof showError === 'function') showError('Popup blokiran', 'Dozvolite popup prozore za štampanje.');
        else alert('Popup blokiran — dozvolite popup prozore za štampanje.');
        return;
    }
    win.document.write(buildPrintDocument({
        tabLabel: 'Izvođači radova',
        activeTabLabel,
        accentColor: accent,
        monthName: String(new Date().getFullYear()),
        year: '',
        datumStampe,
        vrijemeStampe,
        personLabel,
        sectionsHtml
    }));
    win.document.close();
}

// Štampa JEDNU stavku (tabelu) — dugme u zaglavlju svake kartice.
function printIzvodjaciTabela(tableId, naslov) {
    const section = _izvodjaciPrintSection(tableId, naslov, '#ea580c');
    if (!section) {
        if (typeof showWarning === 'function') showWarning('Nema podataka za štampanje');
        else alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }
    _openIzvodjaciPrint(naslov, section, '');
}

// Štampa "Detaljan pregled izabranog izvođača" kao jednu stavku — sve tri
// njegove tabele (mjesečni trend, sortimenti godišnje, sortimenti mjesečno)
// zajedno, s imenom izvođača kao kontekstom.
function printIzvodjaciDetalj() {
    const card = document.getElementById('primaci-izvodjac-detalj');
    if (!card || card.classList.contains('hidden')) {
        if (typeof showWarning === 'function') showWarning('Prvo izaberite izvođača za detaljan pregled');
        else alert('Prvo izaberite izvođača za detaljan pregled.');
        return;
    }
    const naslovEl = document.getElementById('primaci-izvodjac-detalj-naziv');
    const izvodjacNaziv = naslovEl ? cleanPrintText(naslovEl.textContent).replace(/^📊\s*/, '') : 'Izvođač';

    const sections = [
        _izvodjaciPrintSection('primaci-izvodjac-detalj-table', 'Mjesečni pregled i trend', '#ea580c'),
        _izvodjaciPrintSection('primaci-izvodjac-sortimenti-table', 'Sortimenti — godišnji ukupno', '#ea580c'),
        _izvodjaciPrintSection('primaci-izvodjac-mjesecni-sortimenti-table', 'Sječa po sortimentima — mjesečno', '#ea580c')
    ].filter(Boolean);

    if (!sections.length) {
        if (typeof showWarning === 'function') showWarning('Nema podataka za štampanje');
        else alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }
    _openIzvodjaciPrint('Detaljan pregled', sections.join(''), escapeHtml(izvodjacNaziv));
}

// Štampa SVE stavke podtaba odjednom (uključujući "Detaljan pregled" ako je
// trenutno prikazan), svaka na svojoj stranici — isti obrazac kao
// printKubikator (page-break-before na sve osim prve sekcije).
function printIzvodjaciSve() {
    const accent = '#ea580c';
    const sections = [];

    const detaljCard = document.getElementById('primaci-izvodjac-detalj');
    if (detaljCard && !detaljCard.classList.contains('hidden')) {
        sections.push(_izvodjaciPrintSection('primaci-izvodjac-detalj-table', 'Detaljan pregled — mjesečni trend', accent));
        sections.push(_izvodjaciPrintSection('primaci-izvodjac-sortimenti-table', 'Detaljan pregled — sortimenti (godišnji ukupno)', accent));
        sections.push(_izvodjaciPrintSection('primaci-izvodjac-mjesecni-sortimenti-table', 'Detaljan pregled — sječa po sortimentima (mjesečno)', accent));
    }
    sections.push(_izvodjaciPrintSection('primaci-izvodjaci-table', 'Sječa po mjesecima — svi izvođači', accent));
    sections.push(_izvodjaciPrintSection('primaci-izvodjaci-recap', 'Godišnja rekapitulacija po sortimentima', accent));
    sections.push(_izvodjaciPrintSection('primaci-izvodjaci-mjesecni-recap', 'Mjesečna rekapitulacija po sortimentima', accent));

    const valid = sections.filter(Boolean);
    if (!valid.length) {
        if (typeof showWarning === 'function') showWarning('Nema podataka za štampanje');
        else alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }

    const sectionsHtml = valid.map((html, idx) =>
        idx === 0 ? html : html.replace('class="print-section"', 'class="print-section" style="page-break-before:always;"')
    ).join('');

    _openIzvodjaciPrint('Svi prikazi — Izvođači radova', sectionsHtml, '');
}

// ─── Dropdown izbornik ───────────────────────────────────────
function toggleStanjeZalihaPrintMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('stanje-zaliha-print-menu');
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        const close = () => { menu.style.display = 'none'; document.removeEventListener('click', close); };
        document.addEventListener('click', close);
    }
}

// ─── Opcija 1: Agregatna tabela + detaljna sortabilna ────────
function printStanjeZalihaAgregatna() {
    document.getElementById('stanje-zaliha-print-menu').style.display = 'none';
    const accent = '#1e3a5f';
    const year = new Date().getFullYear();
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    const radilisteEl = document.getElementById('stanje-zaliha-radiliste');
    const radiliste = radilisteEl && radilisteEl.value ? radilisteEl.value : 'Sva radilišta';

    const glavnaTabela = document.getElementById('stanje-zaliha-tabela');
    const detaljniThead = document.getElementById('stanje-zaliha-detalji-section-thead');
    const detaljniTabela = detaljniThead ? detaljniThead.closest('table') : null;

    const hasGlavna   = glavnaTabela && glavnaTabela.querySelector('tbody tr td');
    const hasDetaljna = detaljniTabela && detaljniTabela.querySelector('tbody tr td');

    if (!hasGlavna && !hasDetaljna) {
        alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }

    let sectionsHtml = '';
    if (hasGlavna) {
        sectionsHtml += `
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accent};">
                Pregled zaliha po sortimentima — ${radiliste}
            </div>
            ${tableToCleanHtml(glavnaTabela)}
        </div>`;
    }
    if (hasDetaljna) {
        sectionsHtml += `
        <div class="print-section" style="page-break-before:always;">
            <div class="section-header" style="border-left:4px solid ${accent};">
                Detaljni prikaz po odjelima — ${radiliste}
            </div>
            ${tableToCleanHtml(detaljniTabela)}
        </div>`;
    }

    const win = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!win) { alert('Popup blokiran — dozvolite popup prozore za štampanje.'); return; }
    win.document.write(buildPrintDocument({
        tabLabel: 'Stanje Zaliha',
        activeTabLabel: 'Agregatna tabela',
        accentColor: accent,
        monthName: String(year),
        year: '',
        datumStampe,
        vrijemeStampe,
        sectionsHtml
    }));
    win.document.close();
}

// ─── Opcija 2: Detaljno po odjelima (Projekat/Sječa/Otprema/Zaliha) ─────
function printStanjeZalihaPoOdjelima() {
    document.getElementById('stanje-zaliha-print-menu').style.display = 'none';
    const accent = '#1e3a5f';
    const year = new Date().getFullYear();
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    const radilisteEl = document.getElementById('stanje-zaliha-radiliste');
    const radiliste = radilisteEl && radilisteEl.value ? radilisteEl.value : 'Sva radilišta';

    const cards = document.querySelectorAll('#stanje-zaliha-container .stanje-zaliha-card');
    if (!cards.length) {
        alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }

    let sectionsHtml = '';
    let first = true;

    cards.forEach(card => {
        const headerEl = card.querySelector('.stanje-zaliha-card-header');
        const nameEl   = headerEl ? headerEl.querySelector('h3') : null;
        const metaEl   = headerEl ? headerEl.querySelector('p') : null;
        const ukupnoEl = headerEl ? headerEl.querySelector('div[style*="font-size: 24px"]') : null;
        const odjelName = nameEl ? nameEl.textContent.trim() : '—';
        const meta      = metaEl ? metaEl.textContent.trim() : '';
        const ukupno    = ukupnoEl ? ukupnoEl.textContent.trim() : '';

        // Statistika (4 summary čelije: Projekat, Sječa, Otprema, Zaliha)
        const statCells = card.querySelectorAll('[style*="grid-template-columns"] > div');
        let statsHtml = '';
        if (statCells.length) {
            statsHtml = '<div style="display:flex;gap:0;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;margin-bottom:8px;">';
            statCells.forEach(cell => {
                const label = cell.querySelector('div:first-child');
                const value = cell.querySelector('div:last-child');
                statsHtml += `<div style="flex:1;text-align:center;padding:8px;border-right:1px solid #e5e7eb;background:#f9fafb;">
                    <div style="font-size:10px;color:#4b5563;">${label ? label.textContent.replace(/[📋🪓🚛📦]/g,'').trim() : ''}</div>
                    <div style="font-size:13px;font-weight:700;color:#1e3a5f;">${value ? value.textContent.trim() : '—'}</div>
                </div>`;
            });
            statsHtml += '</div>';
        }

        // Tabela Projekat/Sječa/Otprema/Zaliha po sortimentima
        const detailTable = card.querySelector('.stanje-zaliha-table');
        const tableHtml = detailTable ? tableToCleanHtml(detailTable) : '';

        sectionsHtml += `
        <div class="print-section" style="${first ? '' : 'page-break-before:always;'}">
            <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);color:white;padding:12px 16px;border-radius:6px 6px 0 0;margin-bottom:0;">
                <div style="font-size:16px;font-weight:700;">${odjelName}</div>
                <div style="font-size:11px;opacity:.85;margin-top:2px;">${meta}</div>
            </div>
            ${statsHtml}
            ${tableHtml}
        </div>`;
        first = false;
    });

    const win = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!win) { alert('Popup blokiran — dozvolite popup prozore za štampanje.'); return; }
    win.document.write(buildPrintDocument({
        tabLabel: 'Stanje Zaliha',
        activeTabLabel: 'Detaljno po odjelima',
        accentColor: accent,
        monthName: String(year),
        year: '',
        datumStampe,
        vrijemeStampe,
        sectionsHtml
    }));
    win.document.close();
}

function printMjesecniCard(tip) {
    const isSjeca = tip === 'sjeca';
    const isKombinovano = tip === 'kombinovano';
    const tableId   = isKombinovano ? 'mjesecna-kombinovano-table' : (isSjeca ? 'mjesecna-sjeca-table' : 'mjesecna-otprema-table');
    const cardTitle = isKombinovano ? 'Sječa i otprema po mjesecima (kombinovano)' : (isSjeca ? 'Sječa po mjesecima i sortimentima' : 'Otprema po mjesecima i sortimentima');
    const accent    = isKombinovano ? '#4338ca' : (isSjeca ? '#1e3a5f' : '#7c2d12');

    const tableEl = document.getElementById(tableId);
    if (!tableEl) { alert('Tabela nije učitana.'); return; }
    const tbody = tableEl.querySelector('tbody');
    if (!tbody || !tbody.querySelector('tr td')) {
        alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }

    const year = new Date().getFullYear();
    const datumStampe  = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    const sectionsHtml = `
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accent};">${cardTitle}</div>
            ${tableToCleanHtml(tableEl)}
        </div>`;

    const win = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!win) { alert('Popup blokiran — dozvolite popup prozore za štampanje.'); return; }
    win.document.write(buildPrintDocument({
        tabLabel: 'Sječa / Otprema',
        activeTabLabel: cardTitle,
        accentColor: accent,
        monthName: String(year),
        year: '',
        datumStampe,
        vrijemeStampe,
        sectionsHtml
    }));
    win.document.close();
}

// Štampa modal "Detalji kupca" (Prikaz po kupcima > klik na kupca) — isti
// pro obrazac kao printMjesecniCard: čist HTML iz već renderovane tabele
// (js/app.js showKupacDetails puni #kupac-details-table), sa "pro" print
// stilom (buildPrintDocument) umjesto sirovog "print cijelu stranicu".
function printKupacDetails() {
    const tableEl = document.getElementById('kupac-details-table');
    if (!tableEl) { alert('Podaci još nisu učitani ili nema podataka za štampanje.'); return; }
    const tbody = tableEl.querySelector('tbody');
    if (!tbody || !tbody.querySelector('tr td')) {
        alert('Nema podataka za štampanje.');
        return;
    }

    const titleElem = document.getElementById('kupac-modal-title');
    const kupacName = titleElem ? cleanPrintText(titleElem.textContent).replace(/^Otpreme za:\s*/i, '') : 'Kupac';

    const year = new Date().getFullYear();
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });
    const accent = '#0891b2';

    const sectionsHtml = `
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accent};">Otpreme po kupcu — ${year}. godina</div>
            ${tableToCleanHtml(tableEl)}
        </div>`;

    const win = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!win) { alert('Popup blokiran — dozvolite popup prozore za štampanje.'); return; }
    win.document.write(buildPrintDocument({
        tabLabel: 'Otprema',
        activeTabLabel: kupacName,
        accentColor: accent,
        monthName: String(year),
        year: '',
        datumStampe,
        vrijemeStampe,
        sectionsHtml
    }));
    win.document.close();
}

// ─── "Pregled sječe i otpreme po mjesecima" (mjesecni-pregled-card) print ──
// Container je već ispunjen gotovim HTML-om (_renderPregledByRadiliste,
// js/app.js) — po radilištu grupisan naslov, pa po odjelu SJEČA/OTPREMA
// tabela. Ovdje se samo klonira i čisti od event handlera, isti obrazac
// kao printStanjeZalihaPoOdjelima/printMjesecniCard.
function printMjesecniPregled() {
    const container = document.getElementById('mjesecni-pregled-container');
    if (!container || !container.querySelector('table')) {
        if (typeof showWarning === 'function') showWarning('Nema podataka za štampanje');
        else alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }

    const accent = '#1e3a5f';
    const year = new Date().getFullYear();
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    const radilisteEl = document.getElementById('mjesecni-pregled-radiliste-filter');
    const radiliste = radilisteEl && radilisteEl.value ? radilisteEl.value : 'Sva radilišta';

    const clone = container.cloneNode(true);
    clone.querySelectorAll('*').forEach(el => {
        ['onclick', 'onmouseover', 'onmouseout', 'onkeyup'].forEach(attr => el.removeAttribute(attr));
    });

    const sectionsHtml = `
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accent};">
                Pregled sječe i otpreme po mjesecima — ${escapeHtml(radiliste)}
            </div>
            ${clone.innerHTML}
        </div>`;

    const win = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!win) {
        if (typeof showError === 'function') showError('Popup blokiran', 'Dozvolite popup prozore za štampanje.');
        else alert('Popup blokiran — dozvolite popup prozore za štampanje.');
        return;
    }
    win.document.write(buildPrintDocument({
        tabLabel: 'Sječa / Otprema',
        activeTabLabel: 'Pregled po mjesecima — ' + radiliste,
        accentColor: accent,
        monthName: String(year),
        year: '',
        datumStampe,
        vrijemeStampe,
        sectionsHtml
    }));
    win.document.close();
}

// ─── Dinamike izvođača print ────────────────────────────────
// Štampa TAČNO ono što je trenutno učitano (_dinamikeIzvodjacaData,
// js/app.js) — svaki odjel kao zasebna kartica sa Sječa/Otprema
// mini-tabelama (prethodni period / izvještajni mjesec / ukupno), ista
// kalkulacija "ukupno" reda kao _renderDinamikeIzvodjaca na ekranu.
// odjelFilter (opciono) — naziv jednog odjela: dugme na svakoj kartici
// zove ovo da odštampa SAMO tu stavku; dugme u zaglavlju zove bez
// argumenta i štampa sve odjele odjednom (svaki na svojoj stranici).
function printDinamikeIzvodjaca(odjelFilter) {
    const data = (typeof _dinamikeIzvodjacaData !== 'undefined') ? _dinamikeIzvodjacaData : null;
    const sviOdjeli = (data && data.odjeli) || [];
    const odjeli = odjelFilter ? sviOdjeli.filter(o => o.odjel === odjelFilter) : sviOdjeli;
    if (!odjeli.length) {
        if (typeof showWarning === 'function') showWarning('Nema podataka za štampanje');
        else alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }

    const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    const nazivMjeseca = mjeseciNazivi[data.mjesecIzvjestaja] || '';
    const sortimentiNazivi = data.sortimentiNazivi || [];
    const ukupnoKey = sortimentiNazivi[sortimentiNazivi.length - 1];
    const accent = '#059669';
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    const subTable = (naslov, bojaAkcenta, redovi) => {
        const headerCells = sortimentiNazivi.map(s =>
            `<th style="${s === ukupnoKey ? 'text-decoration:underline;' : ''}">${escapeHtml(s)}</th>`
        ).join('');
        const bodyRows = redovi.map(r => {
            const cells = sortimentiNazivi.map(s => {
                const val = Number(r.podaci[s]) || 0;
                const isTotal = s === ukupnoKey;
                return `<td style="${val > 0 ? 'font-weight:700;color:#1f2937;' : 'color:#d1d5db;'}${isTotal ? 'background:#f9fafb;font-weight:800;' : ''}">${val > 0 ? val.toFixed(2) : '-'}</td>`;
            }).join('');
            return `<tr${r.istaknut ? ' class="ukupno-row"' : ''}><td style="text-align:left;font-weight:600;">${escapeHtml(r.labela)}</td>${cells}</tr>`;
        }).join('');
        return `
            <div style="margin-bottom:10px;">
                <div style="font-weight:700;font-size:11px;color:${bojaAkcenta};margin-bottom:4px;">${naslov}</div>
                <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #d1d5db;">
                    <thead><tr><th style="text-align:left;">Sortiment</th>${headerCells}</tr></thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>`;
    };

    const sectionsHtml = odjeli.map((o, idx) => {
        const sjecaUkupno = { ...o.sjeca.prosliPeriod };
        sortimentiNazivi.forEach(s => sjecaUkupno[s] = (Number(o.sjeca.prosliPeriod[s]) || 0) + (Number(o.sjeca.prosliMjesec[s]) || 0));
        const otpremaUkupno = { ...o.otprema.prosliPeriod };
        sortimentiNazivi.forEach(s => otpremaUkupno[s] = (Number(o.otprema.prosliPeriod[s]) || 0) + (Number(o.otprema.prosliMjesec[s]) || 0));

        const sjecaHtml = subTable('🪓 Sječa', '#065f46', [
            { labela: 'Prethodni period', podaci: o.sjeca.prosliPeriod },
            { labela: nazivMjeseca, podaci: o.sjeca.prosliMjesec },
            { labela: 'Ukupno izvršenje', podaci: sjecaUkupno, istaknut: true }
        ]);
        const otpremaHtml = subTable('🚛 Otprema', '#92400e', [
            { labela: 'Prethodni period', podaci: o.otprema.prosliPeriod },
            { labela: nazivMjeseca, podaci: o.otprema.prosliMjesec },
            { labela: 'Ukupno izvršenje', podaci: otpremaUkupno, istaknut: true }
        ]);

        const meta = [
            o.radiliste ? 'G. Jedinica: ' + escapeHtml(String(o.radiliste)) : '',
            'Izvođač: ' + escapeHtml(o.izvodjac || '—'),
            'Poslovođa: ' + escapeHtml(o.poslovodja || '—')
        ].filter(Boolean).join(' &middot; ');

        return `
        <div class="print-section" style="${idx ? 'page-break-before:always;' : ''}">
            <div style="background:linear-gradient(135deg,#a7f3d0,#fde68a);padding:10px 14px;border-radius:6px 6px 0 0;">
                <div style="font-size:14px;font-weight:700;color:#065f46;">🌲 Odjel ${escapeHtml(o.odjel)}</div>
                <div style="font-size:10px;color:#78350f;margin-top:2px;">${meta}</div>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;padding:10px 14px 14px;">
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;font-weight:600;color:#374151;margin-bottom:10px;">
                    <span>🎯 Ugovorena masa: <b style="color:${accent};">${(o.ugovorenoUkupno || 0).toFixed(2)} m³</b></span>
                    <span>🪓 Index sječe: <b>${(o.indexSjeca || 0).toFixed(0)}%</b></span>
                    <span>🚛 Index otpreme: <b>${(o.indexOtprema || 0).toFixed(0)}%</b></span>
                </div>
                ${sjecaHtml}
                ${otpremaHtml}
            </div>
        </div>`;
    }).join('');

    const win = window.open('', '_blank', 'width=1100,height=900,scrollbars=yes');
    if (!win) {
        if (typeof showError === 'function') showError('Popup blokiran', 'Dozvolite popup prozore za štampanje.');
        else alert('Popup blokiran — dozvolite popup prozore za štampanje.');
        return;
    }
    win.document.write(buildPrintDocument({
        tabLabel: 'Dinamike izvođača',
        activeTabLabel: odjelFilter ? ('Plan vs realizacija — Odjel ' + odjelFilter) : 'Plan vs realizacija po odjelu',
        accentColor: accent,
        monthName: nazivMjeseca,
        year: data.godinaIzvjestaja || new Date().getFullYear(),
        datumStampe,
        vrijemeStampe,
        sectionsHtml
    }));
    win.document.close();
}

function printActiveView(contentId, tabLabel, accentColor) {
    const container = document.getElementById(contentId);
    if (!container) return;

    // Pronađi vidljivi podmeni
    const activeView = container.querySelector('.submenu-content:not(.hidden)');
    if (!activeView) {
        alert('Nema učitanog sadržaja za štampanje. Odaberite podmeni i sačekajte učitavanje podataka.');
        return;
    }

    // Aktivni podmeni label (iz aktivnog submenu-tab dugmeta)
    const activeTabBtn = container.querySelector('.submenu-tab.active');
    const activeTabLabel = activeTabBtn
        ? cleanPrintText(activeTabBtn.textContent)
        : tabLabel;

    // Kontekst: year i month iz selektora unutar aktivnog viewa
    const MONTHS = ['Januar','Februar','Mart','April','Maj','Juni','Juli','August','Septembar','Oktobar','Novembar','Decembar'];
    const monthSel = activeView.querySelector('select.month-select');
    const monthIdx = monthSel ? parseInt(monthSel.value) : new Date().getMonth();
    const year = new Date().getFullYear();
    const monthName = MONTHS[monthIdx];
    const datumStampe = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    // Izabrani primač/otpremač iz dropdown-a (ako postoji)
    const personSel = container.querySelector('select:not(.month-select):not(.year-select)');
    const personLabel = (personSel && personSel.value)
        ? personSel.options[personSel.selectedIndex].text.trim()
        : '';

    // Sakupi sekcije za ispis
    const sections = collectPrintSections(activeView, activeTabLabel, accentColor);

    if (!sections.length) {
        alert('Nema podataka za štampanje. Molimo učitajte podatke pa pokušajte ponovo.');
        return;
    }

    const sectionsHtml = sections.map(s => `
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accentColor};">
                ${s.title}
            </div>
            ${s.html}
        </div>`).join('');

    const win = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!win) { alert('Popup blokiran — dozvolite popup prozore za štampanje.'); return; }
    win.document.write(buildPrintDocument({
        tabLabel, activeTabLabel, accentColor,
        monthName, year, datumStampe, vrijemeStampe,
        sectionsHtml, personLabel
    }));
    win.document.close();
}

// ── Čisti tekst od emoji i viška razmaka ──
function cleanPrintText(txt) {
    return (txt || '')
        .replace(/[\u{1F000}-\u{1FFFF}]|[\u2600-\u27FF]|[\u2B00-\u2BFF]|[\uFE00-\uFE0F]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Skuplja sekcije (heading + tabela parovi + dinamički containeri) ──
function collectPrintSections(view, fallbackTitle, accentColor) {
    const sections = [];
    let heading = fallbackTitle;

    // Prolaz kroz direktnu djecu .section div-ova unutar viewa
    const sectionDivs = view.querySelectorAll('.section');
    const targets = sectionDivs.length ? sectionDivs : [view];

    targets.forEach(sec => {
        // Pronaći h3/h4 naslove i tabele unutar ove sekcije
        const nodes = sec.querySelectorAll('h2, h3, h4, table, [id$="-container"]');

        nodes.forEach(el => {
            if (el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4') {
                heading = cleanPrintText(el.textContent);
            } else if (el.tagName === 'TABLE') {
                const tbody = el.querySelector('tbody');
                const hasRows = tbody && tbody.querySelector('tr td');
                if (!hasRows) return;

                // Preskoči tabele čiji je sadržaj samo "Nema podataka"
                const firstCell = tbody.querySelector('tr td');
                if (firstCell && firstCell.colSpan > 3 && firstCell.textContent.includes('Nema')) return;

                sections.push({ title: heading || fallbackTitle, html: tableToCleanHtml(el) });
                heading = ''; // Naslov upotrijebljen, sljedeća tabela bez ponavljanja
            } else if (el.id && el.id.endsWith('-container') && el.innerHTML.trim()) {
                // Dinamički kontejner (sortimentni po primačima/otpremačima)
                const innerTables = el.querySelectorAll('table');
                if (!innerTables.length) return;
                // Svaka unutrašnja tabela kao zasebna sekcija s vlastitim naslovom
                let containerHeading = heading || fallbackTitle;
                innerTables.forEach(t => {
                    const tbody = t.querySelector('tbody');
                    if (!tbody || !tbody.querySelector('tr td')) return;
                    // Pokušaj naći naslov ispred tabele unutar kontejnera
                    const prevEl = t.previousElementSibling;
                    const subTitle = (prevEl && (prevEl.tagName === 'H3' || prevEl.tagName === 'H4' || prevEl.tagName === 'H2'))
                        ? cleanPrintText(prevEl.textContent)
                        : containerHeading;
                    sections.push({ title: subTitle, html: tableToCleanHtml(t) });
                    containerHeading = '';
                });
                heading = '';
            }
        });
    });

    return sections;
}

// ── Klonira tabelu u čist HTML bez inline skripti i event handlera ──
function tableToCleanHtml(tableEl) {
    const clone = tableEl.cloneNode(true);
    // Ukloni search-hidden redove
    clone.querySelectorAll('tr[style*="display: none"], tr[style*="display:none"]').forEach(r => r.remove());
    // Ukloni onclick/onmouseover atribute
    clone.querySelectorAll('*').forEach(el => {
        ['onclick','onmouseover','onmouseout','onkeyup'].forEach(attr => el.removeAttribute(attr));
    });
    return clone.outerHTML;
}

// ── Gradi finalni HTML dokument za print prozor ──
function buildPrintDocument({ tabLabel, activeTabLabel, accentColor, monthName, year, datumStampe, vrijemeStampe, sectionsHtml, personLabel }) {
    const dark = accentColor;
    return `<!DOCTYPE html>
<html lang="bs">
<head>
<meta charset="UTF-8">
<title>${tabLabel} — ${activeTabLabel} — ${monthName} ${year}</title>
<style>
/* ── RESET ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: 'Segoe UI', Calibri, Arial, sans-serif;
    font-size: 11px;
    color: #111827;
    background: #fff;
    padding: 16mm 14mm 12mm 14mm;
}

/* ── ZAGLAVLJE ── */
.doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 10px;
    margin-bottom: 16px;
    border-bottom: 3px solid ${dark};
}
.doc-header-left { display: flex; flex-direction: column; gap: 3px; }
.company-name {
    font-size: 14px;
    font-weight: 700;
    color: ${dark};
    text-transform: uppercase;
    letter-spacing: 0.6px;
}
.company-sub { font-size: 9px; color: #4b5563; text-transform: uppercase; letter-spacing: 0.4px; }
.doc-header-right { text-align: right; }
.doc-title { font-size: 15px; font-weight: 700; color: ${dark}; }
.doc-subtitle { font-size: 11px; color: #374151; margin-top: 2px; }
.doc-person { font-size: 13px; font-weight: 700; color: ${dark}; margin-top: 3px; }
.doc-meta { font-size: 9px; color: #6b7280; margin-top: 4px; }

/* ── SEKCIJA ── */
.print-section { margin-bottom: 20px; page-break-inside: avoid; }
.section-header {
    font-size: 11px;
    font-weight: 700;
    color: ${dark};
    background: #f8fafc;
    padding: 5px 10px;
    margin-bottom: 0;
    border-bottom: 1px solid #e2e8f0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* ── TABELE ── */
table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-bottom: 0;
}
thead tr th {
    background: ${dark} !important;
    color: #fff !important;
    font-weight: 700;
    text-align: center;
    padding: 5px 5px;
    border: 1px solid rgba(255,255,255,0.2);
    /* NE nowrap + min-width:0 — vidi komentar uz _dailyPrintStyleBlock
       niže: uzrok "printano fale krajevi" bug-a je dvostruk. (1) nowrap na
       svakoj ćeliji + (2) ćelije klonirane iz živog DOM-a (tableToCleanHtml)
       nose SVOJ inline min-width (ekranski tabele ga koriste za sticky
       kolone/horizontalni skrol) — obje sile tabelu širom od stranice
       umjesto da se prelomi. !important ovdje NADJAČAVA taj inline
       min-width; overflow-wrap dozvoljava prelom i unutar jedne "riječi"
       (npr. duži naziv sortimenta bez razmaka) kad treba. */
    white-space: normal !important;
    overflow-wrap: break-word;
    min-width: 0 !important;
    max-width: none !important;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}
thead tr th:first-child { text-align: left; }
tbody tr { background: #fff; }
tbody tr:nth-child(even) { background: #f1f5f9; }
tbody tr:hover { background: #f1f5f9; } /* neutralise hover u printu */
tbody td {
    padding: 3px 5px;
    border: 1px solid #d1d5db;
    text-align: right;
    white-space: normal !important;
    overflow-wrap: break-word;
    min-width: 0 !important;
    max-width: none !important;
    vertical-align: middle;
}
tbody td:first-child {
    text-align: left;
    font-weight: 600;
    color: #1e293b;
}
/* Kupac kolona (2. kolona) — boldano.
   Scope-ovano na table:not(.pro-mjesecna-table): podešeno je za tabelu po
   kupcima gdje je 2. kolona ime kupca. Na mjesečnoj tabeli je 2. kolona
   obična numerička (F/L Č) pa je bezrazložno odudarala od kolona 3+. */
table:not(.pro-mjesecna-table) tbody td:nth-child(2) {
    font-weight: 700 !important;
    font-size: 11px !important;
}
/* Sortimentne vrijednosti (od 3. kolone) — blago povećan font */
table:not(.pro-mjesecna-table) tbody td:nth-child(n+3) {
    font-size: 11.5px !important;
    font-weight: 600 !important;
}
tfoot tr td {
    background: ${dark} !important;
    color: #fff !important;
    font-weight: 700;
    padding: 4px 5px;
    border: 1px solid rgba(255,255,255,0.2);
    text-align: right;
    font-size: 10px;
}
tfoot tr td:first-child { text-align: left; }

/* Ukupno / totals redovi */
tr.totals-row td, tr.grand-totals-row td, tr.ukupno-row td,
tr[class*="total"] td, tr[class*="ukupno"] td {
    background: ${dark} !important;
    color: #fff !important;
    font-weight: 700;
}
tr.week-totals-row td {
    background: #dbeafe !important;
    color: #1e40af !important;
    font-weight: 700;
}
.week-label-cell {
    background: ${dark} !important;
    color: #fff !important;
    text-align: center !important;
    font-weight: 700;
}
.week-separator td { border-top: 2px solid ${dark}; }

/* Highlight kolone (tabele koje boje cijele grupe kolona) */
td.col-cetinari, th.col-cetinari { background: #ede9fe; }
td.col-liscari, th.col-liscari { background: #fef9c3; }
td.col-sveukupno, th.col-sveukupno { background: #dcfce7; }

/* Mjesečna sječa/otprema — ista hijerarhija kao na ekranu, ne bojenje
   cijelih kolona. Toplotne mape na papiru namjerno NEMA (--i varijabla
   ostaje u markupu ali je ovdje nijedno pravilo ne koristi): manje tonera
   i čitljivije. Grupe nosi vertikalna linija, kao i na ekranu. */
.pro-mjesecna-table td.col-cetinari, .pro-mjesecna-table th.col-cetinari,
.pro-mjesecna-table td.col-liscari, .pro-mjesecna-table th.col-liscari {
    background: transparent;
}
.pro-mjesecna-table td.is-total, .pro-mjesecna-table th.is-total { background: #f1f5f9; font-weight: 700; }
.pro-mjesecna-table td.col-sveukupno, .pro-mjesecna-table th.col-sveukupno { background: #eef2ff; font-weight: 700; }
.pro-mjesecna-table td.grp-start, .pro-mjesecna-table th.grp-start { border-left: 1.5px solid #94a3b8 !important; }
.pro-mjesecna-table td.is-zero { color: #9ca3af; }
.pro-mjesecna-table tbody tr.pct-row td { background: #f8fafc; font-style: italic; color: #64748b; }

/* Progress bar — sakrij u printu */
.table-progress-bar { display: none; }

/* ── FOOTER ── */
.doc-footer {
    margin-top: 18px;
    padding-top: 7px;
    border-top: 1px solid #d1d5db;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #6b7280;
}

/* ── EKRANSKI KONTROLNI BAR ── */
.screen-only {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 10px 14mm;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: -16mm -14mm 14px -14mm;
}
.btn-print {
    background: ${dark};
    color: #fff;
    border: none;
    padding: 9px 24px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.3px;
}
.btn-print:hover { opacity: 0.88; }
.btn-close {
    background: #6b7280;
    color: #fff;
    border: none;
    padding: 9px 18px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13px;
}
.screen-label {
    margin-left: 12px;
    font-size: 12px;
    color: #374151;
    font-weight: 600;
}

/* ── PRINT MEDIA ── */
@media print {
    .screen-only { display: none !important; }
    body { padding: 0; }
    @page { size: A4 landscape; margin: 10mm 12mm; }
    .print-section { break-inside: auto; page-break-inside: auto; }
    .section-header { page-break-after: avoid; break-after: avoid; }
    table { page-break-inside: auto; break-inside: auto; }
    tr { page-break-inside: avoid; break-inside: avoid; }
}
</style>
</head>
<body>

<div class="screen-only">
    <button class="btn-print" onclick="window.print()">🖨️ &nbsp;Štampaj</button>
    <button class="btn-close" onclick="window.close()">✕ Zatvori</button>
    <span class="screen-label">${tabLabel} &mdash; ${activeTabLabel} &mdash; ${monthName} ${year}</span>
</div>

<div class="doc-header">
    <div class="doc-header-left">
        <div class="company-name">ŠPD &ldquo;Unsko-Sanske Šume&rdquo; d.o.o.</div>
        <div class="company-sub">Šumarija Bosanska Krupa</div>
    </div>
    <div class="doc-header-right">
        <div class="doc-title">${tabLabel}</div>
        <div class="doc-subtitle">${activeTabLabel} &mdash; ${monthName} ${year}</div>
        ${personLabel ? `<div class="doc-person">${personLabel}</div>` : ''}
        <div class="doc-meta">Datum štampe: ${datumStampe} &nbsp;|&nbsp; ${vrijemeStampe}</div>
    </div>
</div>

${sectionsHtml}

<div class="doc-footer">
    <span>ŠPD &ldquo;Unsko-Sanske Šume&rdquo; d.o.o. &mdash; Šumarija Bosanska Krupa</span>
    <span>Štampano: ${datumStampe} u ${vrijemeStampe}</span>
</div>

</body>
</html>`;
}

// ─── Sječa/Otprema "po danima" print ──────────────────────────
// Generički printActiveView (gornje dugme ŠTAMPAJ na tabu) i dalje radi na
// ovim tabelama, ali sa ~20 uskih sortimentnih kolona + dugim imenima
// (Primač/Otpremač/Kupac) generički print CSS ima problem baš ovdje:
// forsira white-space:nowrap na SVAKOJ ćeliji (buildPrintDocument), a
// tabela je table-layout:auto — širina kolona prati SADRŽAJ, ne stranicu.
// S ~20 nowrap sortimentnih kolona + dugim nazivima odjela/imena, tabela
// je uvijek bila ŠIRA od stranice, pa se desni dio odsijecao pri STVARNOM
// štampanju — na ekranu (prozor za pregled prije klika na "Štampaj") se
// to ne vidi jer prozor nema ograničenje širine papira, samo horizontalni
// skrol koji korisnik ne primijeti (korisnički prijavljen bug: "na
// preview izgleda dobro, printano fale krajevi").
// Raniji pokušaj popravke (wrapCols — prelomi SAMO jednu poznatu široku
// tekstualnu kolonu) nije bio dovoljan: i dalje je table-layout:auto,
// pa širina i dalje zavisi od sadržaja ostalih (nowrap) kolona.
// Stvarno rješenje: table-layout:fixed + eksplicitna širina (mm) za
// "tekstualne" vodeće kolone (Datum/Odjel/Primač/Otpremač/Kupac) —
// preostale (sortimentne) kolone automatski dijele PREOSTALI prostor
// ravnomjerno (table-layout:fixed to radi za kolone bez eksplicitne
// širine). Zbir vodećih širina je namjerno ispod stvarno dostupne širine
// (A4 landscape - @page margine - body padding, vidi buildPrintDocument)
// da ostane dovoljno prostora za ~20 sortimentnih kolona bez odsijecanja,
// bez obzira na dužinu naziva odjela/imena — dugi tekst se sad PRELOMI
// (white-space:normal + overflow-wrap), ne gura tabelu šire.
function _dailyPrintStyleBlock(tableId, sortimentiOd, leadWidthsMm) {
    const leadRules = (leadWidthsMm || []).map((w, i) =>
        `#${tableId} thead th:nth-child(${i + 1}), #${tableId} tbody td:nth-child(${i + 1}) { width: ${w}mm !important; }`
    ).join('\n        ');
    return `
    <style>
        #${tableId} { table-layout: fixed !important; width: 100% !important; }
        #${tableId} thead th, #${tableId} tbody td {
            white-space: normal !important; overflow-wrap: break-word; word-break: break-word;
            /* Klonirane ćelije (tableToCleanHtml) nose svoj inline min-width
               sa ekrana (sticky kolone/horizontalni skrol) — bez ovoga bi
               taj min-width i dalje nadjačao eksplicitnu širinu ispod. */
            min-width: 0 !important; max-width: none !important;
        }
        #${tableId} thead th { line-height: 1.15 !important; vertical-align: bottom !important; font-size: 8px !important; padding: 4px 2px !important; }
        #${tableId} tbody td { font-size: 9px !important; padding: 3px 2px !important; }
        #${tableId} tbody td:nth-child(1) { font-size: 8.5px !important; color: #475569 !important; }
        #${tableId} tbody td:nth-child(n+${sortimentiOd}) { font-weight: 600 !important; }
        ${leadRules}
    </style>`;
}

function printPrimaciDaily() {
    const tableEl = document.getElementById('primaci-daily-table');
    const tbody = tableEl && tableEl.querySelector('tbody');
    if (!tbody || !tbody.querySelector('tr td')) {
        if (typeof showWarning === 'function') showWarning('Nema podataka za štampanje');
        else alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }

    const accent = '#047857';
    const MONTHS = ['Januar','Februar','Mart','April','Maj','Juni','Juli','August','Septembar','Oktobar','Novembar','Decembar'];
    const monthSel = document.getElementById('primaci-month-select');
    const monthName = monthSel ? MONTHS[parseInt(monthSel.value)] : MONTHS[new Date().getMonth()];
    const godina = new Date().getFullYear();
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    const searchEl = document.getElementById('primaci-daily-search');
    const filterTerm = searchEl ? searchEl.value.trim() : '';
    const naslov = 'Sječa po danima' + (filterTerm ? ` — filtrirano: "${escapeHtml(filterTerm)}"` : '');

    const sectionsHtml = `
        ${_dailyPrintStyleBlock('primaci-daily-table', 4, [14, 22, 20])}
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accent};">${naslov}</div>
            ${tableToCleanHtml(tableEl)}
        </div>`;

    const win = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!win) {
        if (typeof showError === 'function') showError('Popup blokiran', 'Dozvolite popup prozore za štampanje.');
        else alert('Popup blokiran — dozvolite popup prozore za štampanje.');
        return;
    }
    win.document.write(buildPrintDocument({
        tabLabel: 'Sječa', activeTabLabel: 'Po danima', accentColor: accent,
        monthName, year: godina, datumStampe, vrijemeStampe, sectionsHtml
    }));
    win.document.close();
}

function printOtpremaciDaily() {
    const tableEl = document.getElementById('otpremaci-daily-table');
    const tbody = tableEl && tableEl.querySelector('tbody');
    if (!tbody || !tbody.querySelector('tr td')) {
        if (typeof showWarning === 'function') showWarning('Nema podataka za štampanje');
        else alert('Nema podataka za štampanje. Molimo sačekajte učitavanje.');
        return;
    }

    const accent = '#92400e';
    const MONTHS = ['Januar','Februar','Mart','April','Maj','Juni','Juli','August','Septembar','Oktobar','Novembar','Decembar'];
    const monthSel = document.getElementById('otpremaci-month-select');
    const monthName = monthSel ? MONTHS[parseInt(monthSel.value)] : MONTHS[new Date().getMonth()];
    const godina = new Date().getFullYear();
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    const searchEl = document.getElementById('otpremaci-daily-search');
    const filterTerm = searchEl ? searchEl.value.trim() : '';
    const naslov = 'Otprema po danima' + (filterTerm ? ` — filtrirano: "${escapeHtml(filterTerm)}"` : '');

    const sectionsHtml = `
        ${_dailyPrintStyleBlock('otpremaci-daily-table', 5, [12, 18, 16, 18])}
        <div class="print-section">
            <div class="section-header" style="border-left:4px solid ${accent};">${naslov}</div>
            ${tableToCleanHtml(tableEl)}
        </div>`;

    const win = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!win) {
        if (typeof showError === 'function') showError('Popup blokiran', 'Dozvolite popup prozore za štampanje.');
        else alert('Popup blokiran — dozvolite popup prozore za štampanje.');
        return;
    }
    win.document.write(buildPrintDocument({
        tabLabel: 'Otprema', activeTabLabel: 'Po danima', accentColor: accent,
        monthName, year: godina, datumStampe, vrijemeStampe, sectionsHtml
    }));
    win.document.close();
}
