// ============================================================
// 🖨️ PRINT UTILS — Profesionalni ispis tabela
// printActiveView(contentId, tabLabel, accentColor)
// printMjesecniCard(tip)       — za Sječa/otprema tab
// printStanjeZaliha()          — za Stanje zaliha tab
// ============================================================

function printStanjeZaliha() {
    const accent = '#1e3a5f';
    const year = new Date().getFullYear();
    const datumStampe   = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

    // Radilište filter kontekst
    const radilisteEl = document.getElementById('stanje-zaliha-radiliste');
    const radiliste = radilisteEl && radilisteEl.value ? radilisteEl.value : 'Sva radilišta';

    // 1. Agregirana tabela
    const glavnaTabela = document.getElementById('stanje-zaliha-tabela');

    // 2. Detaljna tabela po odjelima (unutar <details>)
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
    win.document.write(buildPrintDocument({
        tabLabel: 'Stanje Zaliha',
        activeTabLabel: radiliste !== 'Sva radilišta' ? radiliste : 'Sve odjele',
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
    const tableId   = isSjeca ? 'mjesecna-sjeca-table'  : 'mjesecna-otprema-table';
    const cardTitle = isSjeca ? 'Sječa po mjesecima i sortimentima' : 'Otprema po mjesecima i sortimentima';
    const accent    = isSjeca ? '#1e3a5f' : '#7c2d12';

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
    const MONTHS = ['Januar','Februar','Mart','April','Maj','Juni','Juli','Avgust','Septembar','Oktobar','Novembar','Decembar'];
    const monthSel = activeView.querySelector('select.month-select');
    const monthIdx = monthSel ? parseInt(monthSel.value) : new Date().getMonth();
    const year = new Date().getFullYear();
    const monthName = MONTHS[monthIdx];
    const datumStampe = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const vrijemeStampe = new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });

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
    win.document.write(buildPrintDocument({
        tabLabel, activeTabLabel, accentColor,
        monthName, year, datumStampe, vrijemeStampe,
        sectionsHtml
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
function buildPrintDocument({ tabLabel, activeTabLabel, accentColor, monthName, year, datumStampe, vrijemeStampe, sectionsHtml }) {
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
.company-sub { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
.doc-header-right { text-align: right; }
.doc-title { font-size: 15px; font-weight: 700; color: ${dark}; }
.doc-subtitle { font-size: 11px; color: #374151; margin-top: 2px; }
.doc-meta { font-size: 9px; color: #9ca3af; margin-top: 4px; }

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
    white-space: nowrap;
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
    white-space: nowrap;
    vertical-align: middle;
}
tbody td:first-child {
    text-align: left;
    font-weight: 600;
    color: #1e293b;
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

/* Highlight kolone */
td.col-cetinari, th.col-cetinari { background: #ede9fe; }
td.col-liscari, th.col-liscari { background: #fef9c3; }
td.col-sveukupno, th.col-sveukupno { background: #dcfce7; }

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
    color: #9ca3af;
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
    .print-section { page-break-inside: avoid; }
    .section-header { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
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
