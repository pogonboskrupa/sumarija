// ============================================
// 📋 NOVI IZVJEŠTAJI - Sedmični i Mjesečni
// ============================================

console.log('🔵 [IZVJEŠTAJI-NEW.JS] File loaded successfully!');

// Switch between Sedmični, Sedmični po radniku, and Mjesečni sub-tabs
function switchIzvjestajiSubTab(subTab) {
    console.log('[IZVJEŠTAJI] Switching to:', subTab);

    const sedmicniElem = document.getElementById('izvjestaji-sedmicni');
    const sedmicniRadnikElem = document.getElementById('izvjestaji-sedmicni-radnik');
    const mjesecniElem = document.getElementById('izvjestaji-mjesecni');
    const poOdjelimaElem = document.getElementById('izvjestaji-po-odjelima');

    // ✅ SAFETY CHECK: Elementi moraju postojati
    if (!sedmicniElem || !mjesecniElem) {
        console.error('[IZVJEŠTAJI] ❌ Elements not found! sedmicni:', !!sedmicniElem, 'mjesecni:', !!mjesecniElem);
        return;
    }

    const subTabs = document.querySelectorAll('#izvjestaji-content .sub-tab');
    subTabs.forEach(tab => tab.classList.remove('active'));

    // Hide all sub-panels
    sedmicniElem.classList.add('hidden');
    if (sedmicniRadnikElem) sedmicniRadnikElem.classList.add('hidden');
    mjesecniElem.classList.add('hidden');
    if (poOdjelimaElem) poOdjelimaElem.classList.add('hidden');

    if (subTab === 'sedmicni') {
        sedmicniElem.classList.remove('hidden');
        const btn = document.querySelector('#izvjestaji-content .sub-tab[onclick="switchIzvjestajiSubTab(\'sedmicni\')"]');
        if (btn) btn.classList.add('active');

        const currentDate = new Date();
        document.getElementById('izvjestaji-sedmicni-year').value = currentDate.getFullYear();
        document.getElementById('izvjestaji-sedmicni-month').value = currentDate.getMonth();

        loadIzvjestajiSedmicni();
    } else if (subTab === 'sedmicni-radnik') {
        if (sedmicniRadnikElem) sedmicniRadnikElem.classList.remove('hidden');
        const btn = document.querySelector('#izvjestaji-content .sub-tab[onclick="switchIzvjestajiSubTab(\'sedmicni-radnik\')"]');
        if (btn) btn.classList.add('active');

        const currentDate = new Date();
        const yrElem = document.getElementById('izvjestaji-sedmicni-radnik-year');
        const moElem = document.getElementById('izvjestaji-sedmicni-radnik-month');
        if (yrElem) yrElem.value = currentDate.getFullYear();
        if (moElem) moElem.value = currentDate.getMonth();

        loadIzvjestajiSedmicniRadnik();
    } else if (subTab === 'mjesecni') {
        mjesecniElem.classList.remove('hidden');
        const btn = document.querySelector('#izvjestaji-content .sub-tab[onclick="switchIzvjestajiSubTab(\'mjesecni\')"]');
        if (btn) btn.classList.add('active');

        const currentDate = new Date();
        document.getElementById('izvjestaji-mjesecni-year').value = currentDate.getFullYear();
        document.getElementById('izvjestaji-mjesecni-month').value = currentDate.getMonth();

        loadIzvjestajiMjesecni();
    } else if (subTab === 'po-odjelima') {
        if (poOdjelimaElem) poOdjelimaElem.classList.remove('hidden');
        const btn = document.querySelector('#izvjestaji-content .sub-tab[onclick="switchIzvjestajiSubTab(\'po-odjelima\')"]');
        if (btn) btn.classList.add('active');

        const currentDate = new Date();
        const yrElem = document.getElementById('izvjestaji-po-odjelima-year');
        const moElem = document.getElementById('izvjestaji-po-odjelima-month');
        if (yrElem) yrElem.value = currentDate.getFullYear();
        if (moElem) moElem.value = currentDate.getMonth();

        loadIzvjestajiPoOdjelima();
    }
}

// Load SEDMIČNI izvještaj - grupirano po sedmicama u mjesecu
async function loadIzvjestajiSedmicni() {
    console.log('[IZVJEŠTAJI SEDMICNI] Loading data...');

    try {
        const yearElem = document.getElementById('izvjestaji-sedmicni-year');
        const monthElem = document.getElementById('izvjestaji-sedmicni-month');

        // ✅ SAFETY CHECK
        if (!yearElem || !monthElem) {
            console.error('[IZVJEŠTAJI SEDMICNI] ❌ Selectors not found!');
            return;
        }

        const year = parseInt(yearElem.value);
        const month = parseInt(monthElem.value);

        const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

        // Update titles
        document.getElementById('izvjestaji-sedmicni-primka-title').textContent = mjeseciNazivi[month] + ' ' + year;
        document.getElementById('izvjestaji-sedmicni-otprema-title').textContent = mjeseciNazivi[month] + ' ' + year;

        // Fetch data
        const primkaUrl = buildApiUrl('primaci-daily', { year, month });
        const otpremaUrl = buildApiUrl('otpremaci-daily', { year, month });

        const [primkaData, otpremaData] = await Promise.all([
            fetchWithCache(primkaUrl, `cache_izvjestaji_sedmicni_primka_${year}_${month}`, false, 180000),
            fetchWithCache(otpremaUrl, `cache_izvjestaji_sedmicni_otprema_${year}_${month}`, false, 180000)
        ]);

        if (primkaData.error) throw new Error('Primka: ' + primkaData.error);
        if (otpremaData.error) throw new Error('Otprema: ' + otpremaData.error);

        // Offline i nema keša za ovaj mjesec/godinu — fetchWithCache vrati {offline:true}
        // bez .data/.sortimentiNazivi. Normalizuj na prazno umjesto da agregacija
        // pukne na undefined.forEach; renderIzvjestajiSedmicniTable već ima friendly
        // "Nema podataka za odabrani period" prikaz za prazan rezultat.
        const primkaRows = primkaData.data || [];
        const otpremaRows = otpremaData.data || [];
        const primkaSort  = primkaData.sortimentiNazivi || [];
        const otpremaSort = otpremaData.sortimentiNazivi || [];

        // Filtriraj po radilištima poslovođe (ako je poslovođa ulogiran)
        var primkaFiltered = filterByPoslovodjaRadilista(primkaRows);
        var otpremaFiltered = filterByPoslovodjaRadilista(otpremaRows);

        // Izračunaj sedmice u mjesecu (1. počinje od prvog dana, sedmica završava u nedjelju)
        const weeks = calculateWeeksInMonth(year, month);
        console.log('[IZVJEŠTAJI SEDMICNI] Weeks:', weeks);

        // Grupiraj podatke po sedmicama i odjelima
        const primkaByWeek = aggregateByWeekAndOdjel(primkaFiltered, primkaSort, weeks, year, month);
        const otpremaByWeek = aggregateByWeekAndOdjel(otpremaFiltered, otpremaSort, weeks, year, month);

        // Render tables po sedmicama
        renderIzvjestajiSedmicniTable(primkaByWeek, primkaSort, 'sedmicni-primka', weeks);
        renderIzvjestajiSedmicniTable(otpremaByWeek, otpremaSort, 'sedmicni-otprema', weeks);

        console.log('[IZVJEŠTAJI SEDMICNI] ✓ Data loaded successfully');
        if (typeof markTabRendered === 'function') markTabRendered('izvjestaji');

    } catch (error) {
        console.error('[IZVJEŠTAJI SEDMICNI] Error:', error);
        showError('Greška', 'Greška pri učitavanju sedmičnog izvještaja: ' + error.message);
    }
}

// Load SEDMIČNI izvještaj PO RADNIKU - grupirano po sedmicama, ključ: primac/otpremac
async function loadIzvjestajiSedmicniRadnik() {
    console.log('[IZVJEŠTAJI SEDMICNI RADNIK] Loading data...');

    try {
        const yearElem = document.getElementById('izvjestaji-sedmicni-radnik-year');
        const monthElem = document.getElementById('izvjestaji-sedmicni-radnik-month');

        if (!yearElem || !monthElem) {
            console.error('[IZVJEŠTAJI SEDMICNI RADNIK] ❌ Selectors not found!');
            return;
        }

        const year = parseInt(yearElem.value);
        const month = parseInt(monthElem.value);

        const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

        const titlePrimka = document.getElementById('izvjestaji-sedmicni-radnik-primka-title');
        const titleOtprema = document.getElementById('izvjestaji-sedmicni-radnik-otprema-title');
        if (titlePrimka) titlePrimka.textContent = mjeseciNazivi[month] + ' ' + year;
        if (titleOtprema) titleOtprema.textContent = mjeseciNazivi[month] + ' ' + year;

        // Reuse same cache keys as sedmični po odjelu (isti API, isti parametri)
        const primkaUrl = buildApiUrl('primaci-daily', { year, month });
        const otpremaUrl = buildApiUrl('otpremaci-daily', { year, month });

        const [primkaData, otpremaData] = await Promise.all([
            fetchWithCache(primkaUrl, `cache_izvjestaji_sedmicni_primka_${year}_${month}`, false, 180000),
            fetchWithCache(otpremaUrl, `cache_izvjestaji_sedmicni_otprema_${year}_${month}`, false, 180000)
        ]);

        if (primkaData.error) throw new Error('Primka: ' + primkaData.error);
        if (otpremaData.error) throw new Error('Otprema: ' + otpremaData.error);

        // Offline i nema keša za ovaj mjesec/godinu — normalizuj na prazno umjesto pada
        const primkaRows = primkaData.data || [];
        const otpremaRows = otpremaData.data || [];
        const primkaSort  = primkaData.sortimentiNazivi || [];
        const otpremaSort = otpremaData.sortimentiNazivi || [];

        var primkaFiltered = filterByPoslovodjaRadilista(primkaRows);
        var otpremaFiltered = filterByPoslovodjaRadilista(otpremaRows);

        const weeks = calculateWeeksInMonth(year, month);

        // Grupiraj po radniku (primac/otpremac) umjesto po odjelu
        const primkaByWeek = aggregateByWeekAndOdjel(primkaFiltered, primkaSort, weeks, year, month, 'primac');
        const otpremaByWeek = aggregateByWeekAndOdjel(otpremaFiltered, otpremaSort, weeks, year, month, 'otpremac');

        renderIzvjestajiSedmicniTable(primkaByWeek, primkaSort, 'sedmicni-radnik-primka', weeks, 'Radnik');
        renderIzvjestajiSedmicniTable(otpremaByWeek, otpremaSort, 'sedmicni-radnik-otprema', weeks, 'Radnik');

        console.log('[IZVJEŠTAJI SEDMICNI RADNIK] ✓ Data loaded successfully');
        if (typeof markTabRendered === 'function') markTabRendered('izvjestaji');

    } catch (error) {
        console.error('[IZVJEŠTAJI SEDMICNI RADNIK] Error:', error);
        showError('Greška', 'Greška pri učitavanju sedmičnog izvještaja po radniku: ' + error.message);
    }
}

// Izračunaj sedmice u mjesecu - prva sedmica počinje od 1. i završava u nedjelju
function calculateWeeksInMonth(year, month) {
    const weeks = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // Zadnji dan mjeseca
    const daysInMonth = lastDay.getDate();

    let weekStart = 1;
    let currentDate = new Date(year, month, 1);

    while (weekStart <= daysInMonth) {
        // Pronađi kraj sedmice (nedjelja = 0)
        let weekEnd = weekStart;
        let tempDate = new Date(year, month, weekStart);

        // Ako nije nedjelja, idi do nedjelje
        while (tempDate.getDay() !== 0 && weekEnd < daysInMonth) {
            weekEnd++;
            tempDate = new Date(year, month, weekEnd);
        }

        // Ako smo na nedjelji ili kraju mjeseca
        const wNum = weeks.length + 1;
        const ws = String(weekStart).padStart(2, '0');
        const we = String(weekEnd).padStart(2, '0');
        const mm = String(month + 1).padStart(2, '0');
        weeks.push({
            weekNum: wNum,
            start: weekStart,
            end: weekEnd,
            label: `S${wNum}`,
            dateRange: `${ws}.${mm} - ${we}.${mm}`
        });

        weekStart = weekEnd + 1;
    }

    return weeks;
}

// Grupiraj podatke po sedmicama i odjelima (ili drugom ključnom polju)
function aggregateByWeekAndOdjel(data, sortimentiNazivi, weeks, year, month, keyField) {
    if (!keyField) keyField = 'odjel';
    // Struktura: { weekNum: { groupKey: { sortimenti } } }
    const result = {};

    // Inicijaliziraj sve sedmice
    weeks.forEach(week => {
        result[week.weekNum] = {};
    });

    data.forEach(row => {
        // Parsiraj datum (format: DD/MM/YYYY ili DD.MM.YYYY)
        const datumStr = row.datum || '';
        let day = null;

        if (datumStr.includes('/')) {
            const parts = datumStr.split('/');
            day = parseInt(parts[0]);
        } else if (datumStr.includes('.')) {
            const parts = datumStr.split('.');
            day = parseInt(parts[0]);
        }

        if (!day || day < 1 || day > 31) return;

        // Pronađi kojoj sedmici pripada
        const week = weeks.find(w => day >= w.start && day <= w.end);
        if (!week) return;

        const odjel = String(row[keyField] || 'Nepoznat');

        if (!result[week.weekNum][odjel]) {
            result[week.weekNum][odjel] = {};
            sortimentiNazivi.forEach(s => result[week.weekNum][odjel][s] = 0);
        }

        sortimentiNazivi.forEach(sortiment => {
            const value = parseFloat(row.sortimenti?.[sortiment]) || 0;
            result[week.weekNum][odjel][sortiment] += value;
        });
    });

    return result;
}

// Renderuj sedmični izvještaj - tablice po sedmicama
function renderIzvjestajiSedmicniTable(dataByWeek, sortimentiNazivi, tablePrefix, weeks, groupLabel) {
    if (!groupLabel) groupLabel = 'Odjel';
    console.log(`[RENDER ${tablePrefix}] Rendering weekly table...`);

    const headerElem = document.getElementById(`izvjestaji-${tablePrefix}-header`);
    const bodyElem = document.getElementById(`izvjestaji-${tablePrefix}-body`);

    // Provjeri ima li podataka
    let hasAnyData = false;
    for (const weekNum in dataByWeek) {
        if (Object.keys(dataByWeek[weekNum]).length > 0) {
            hasAnyData = true;
            break;
        }
    }

    if (!hasAnyData) {
        headerElem.innerHTML = '';
        bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za odabrani period</td></tr>';
        return;
    }

    // Build header - uniformna tamno siva boja
    let headerHtml = '<tr><th class="col-sedmica">SEDMICA</th><th>' + groupLabel + '</th>';
    sortimentiNazivi.forEach(sortiment => {
        let extraClass = '';
        if (sortiment === 'UKUPNO Č+L' || sortiment === 'SVEUKUPNO') extraClass = 'col-sveukupno';
        else if (sortiment === 'LIŠĆARI') extraClass = 'col-liscari';
        else if (sortiment === 'Σ ČETINARI' || sortiment === 'ČETINARI') extraClass = 'col-cetinari';

        headerHtml += `<th class="${extraClass}">${sortiment}</th>`;
    });
    headerHtml += '</tr>';
    headerElem.innerHTML = headerHtml;

    // Build body - grupirano po sedmicama
    let bodyHtml = '';
    let isFirstWeek = true;

    weeks.forEach((week) => {
        const weekData = dataByWeek[week.weekNum] || {};
        const odjeli = Object.keys(weekData).sort();

        if (odjeli.length === 0) return; // Preskoči prazne sedmice

        // Izračunaj totale za sedmicu
        const weekTotals = {};
        sortimentiNazivi.forEach(s => weekTotals[s] = 0);

        odjeli.forEach(odjel => {
            sortimentiNazivi.forEach(s => {
                weekTotals[s] += weekData[odjel][s] || 0;
            });
        });

        // Separator klasa za vizualno razdvajanje sedmica
        const separatorClass = isFirstWeek ? '' : ' week-separator';
        isFirstWeek = false;

        // SEDMICA ćelija sa rowspan - tamna pozadina, dvored prikaz
        bodyHtml += `<tr class="week-totals-row${separatorClass}">`;
        bodyHtml += `<td class="week-label-cell" rowspan="${odjeli.length + 1}">`;
        bodyHtml += `<span class="week-num">${week.label}</span>`;
        bodyHtml += `<span class="week-date">${week.dateRange}</span>`;
        bodyHtml += `</td>`;
        bodyHtml += `<td><strong>UKUPNO</strong></td>`;
        sortimentiNazivi.forEach(s => {
            const val = weekTotals[s];
            const display = val > 0 ? val.toFixed(2) : '-';
            bodyHtml += `<td>${display}</td>`;
        });
        bodyHtml += '</tr>';

        // Redovi za svaki odjel
        odjeli.forEach((odjel, idx) => {
            bodyHtml += `<tr class="week-detail-row">`;
            bodyHtml += `<td>${odjel}</td>`;

            sortimentiNazivi.forEach(sortiment => {
                const value = weekData[odjel][sortiment] || 0;
                const displayValue = value > 0 ? value.toFixed(2) : '-';

                let extraClass = '';
                if (sortiment === 'UKUPNO Č+L' || sortiment === 'SVEUKUPNO') extraClass = 'col-sveukupno';
                else if (sortiment === 'LIŠĆARI') extraClass = 'col-liscari';
                else if (sortiment === 'Σ ČETINARI' || sortiment === 'ČETINARI') extraClass = 'col-cetinari';

                bodyHtml += `<td class="${extraClass}">${displayValue}</td>`;
            });

            bodyHtml += '</tr>';
        });
    });

    // GRAND TOTAL na kraju
    const grandTotals = {};
    sortimentiNazivi.forEach(s => grandTotals[s] = 0);

    weeks.forEach(week => {
        const weekData = dataByWeek[week.weekNum] || {};
        Object.values(weekData).forEach(odjelData => {
            sortimentiNazivi.forEach(s => {
                grandTotals[s] += odjelData[s] || 0;
            });
        });
    });

    bodyHtml += `<tr class="grand-totals-row">`;
    bodyHtml += `<td colspan="2">UKUPNO MJESEC</td>`;
    sortimentiNazivi.forEach(s => {
        const val = grandTotals[s];
        const display = val > 0 ? val.toFixed(2) : '-';
        bodyHtml += `<td>${display}</td>`;
    });
    bodyHtml += '</tr>';

    bodyElem.innerHTML = bodyHtml;
    console.log(`[RENDER ${tablePrefix}] ✓ Weekly table rendered`);
}

// Load MJESEČNI izvještaj
async function loadIzvjestajiMjesecni() {
    console.log('[IZVJEŠTAJI MJESECNI] Loading data...');

    try {
        const yearElem = document.getElementById('izvjestaji-mjesecni-year');
        const monthElem = document.getElementById('izvjestaji-mjesecni-month');

        // ✅ SAFETY CHECK
        if (!yearElem || !monthElem) {
            console.error('[IZVJEŠTAJI MJESECNI] ❌ Selectors not found!');
            return;
        }

        const year = parseInt(yearElem.value);
        const month = parseInt(monthElem.value);

        const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

        // Update titles
        document.getElementById('izvjestaji-mjesecni-primka-title').textContent = mjeseciNazivi[month] + ' ' + year;
        document.getElementById('izvjestaji-mjesecni-otprema-title').textContent = mjeseciNazivi[month] + ' ' + year;

        // Fetch data (full month)
        const primkaUrl = buildApiUrl('primaci-daily', { year, month });
        const otpremaUrl = buildApiUrl('otpremaci-daily', { year, month });

        const [primkaData, otpremaData] = await Promise.all([
            fetchWithCache(primkaUrl, `cache_izvjestaji_mjesecni_primka_${year}_${month}`, false, 180000),
            fetchWithCache(otpremaUrl, `cache_izvjestaji_mjesecni_otprema_${year}_${month}`, false, 180000)
        ]);

        if (primkaData.error) throw new Error('Primka: ' + primkaData.error);
        if (otpremaData.error) throw new Error('Otprema: ' + otpremaData.error);

        // Offline i nema keša za ovaj mjesec/godinu — normalizuj na prazno umjesto pada
        const primkaRows = primkaData.data || [];
        const otpremaRows = otpremaData.data || [];
        const primkaSort  = primkaData.sortimentiNazivi || [];
        const otpremaSort = otpremaData.sortimentiNazivi || [];

        // Filtriraj po radilištima poslovođe (ako je poslovođa ulogiran)
        var primkaFiltered = filterByPoslovodjaRadilista(primkaRows);
        var otpremaFiltered = filterByPoslovodjaRadilista(otpremaRows);

        // Aggregate by odjel
        const primkaByOdjel = aggregateByOdjelIzvjestaji(primkaFiltered, primkaSort);
        const otpremaByOdjel = aggregateByOdjelIzvjestaji(otpremaFiltered, otpremaSort);

        // Render tables
        renderIzvjestajiTable(primkaByOdjel, primkaSort, 'mjesecni-primka');
        renderIzvjestajiTable(otpremaByOdjel, otpremaSort, 'mjesecni-otprema');

        console.log('[IZVJEŠTAJI MJESECNI] ✓ Data loaded successfully');
        if (typeof markTabRendered === 'function') markTabRendered('izvjestaji');

    } catch (error) {
        console.error('[IZVJEŠTAJI MJESECNI] Error:', error);
        showError('Greška', 'Greška pri učitavanju mjesečnog izvještaja: ' + error.message);
    }
}

// Aggregate data by odjel
function aggregateByOdjelIzvjestaji(data, sortimentiNazivi) {
    const odjeliMap = {};

    data.forEach(row => {
        const odjel = String(row.odjel || '');
        if (!odjeliMap[odjel]) {
            odjeliMap[odjel] = {};
            sortimentiNazivi.forEach(s => odjeliMap[odjel][s] = 0);
        }

        sortimentiNazivi.forEach(sortiment => {
            const value = parseFloat(row.sortimenti?.[sortiment]) || 0;
            odjeliMap[odjel][sortiment] += value;
        });
    });

    // Convert to array
    const result = [];
    for (const odjel in odjeliMap) {
        result.push({
            odjel: odjel,
            sortimenti: odjeliMap[odjel]
        });
    }

    return result;
}

// ============================================
// 📅 MJESEČNI IZVJEŠTAJ - Nova čista verzija
// Uniformne boje, pregledna tabela
// ============================================
function renderIzvjestajiTable(data, sortimentiNazivi, tablePrefix) {
    console.log(`[RENDER ${tablePrefix}] Rendering mjesečni table...`);

    const headerElem = document.getElementById(`izvjestaji-${tablePrefix}-header`);
    const bodyElem = document.getElementById(`izvjestaji-${tablePrefix}-body`);

    if (!data || data.length === 0) {
        headerElem.innerHTML = '';
        bodyElem.innerHTML = `
            <tr>
                <td colspan="100" style="text-align: center; padding: 60px; color: #6b7280;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                    <div style="font-size: 16px;">Nema podataka za odabrani period</div>
                </td>
            </tr>`;
        return;
    }

    // Sort po UKUPNO koloni (DESC - najveći prvi)
    data.sort((a, b) => {
        const aTotal = parseFloat(a.sortimenti['UKUPNO Č+L']) || parseFloat(a.sortimenti['SVEUKUPNO']) || 0;
        const bTotal = parseFloat(b.sortimenti['UKUPNO Č+L']) || parseFloat(b.sortimenti['SVEUKUPNO']) || 0;
        return bTotal - aTotal;
    });

    // ========== HEADER ==========
    // Uniformna tamno siva boja - sve kolone iste
    let headerHtml = '<tr>';
    headerHtml += '<th style="text-align: left;">Odjel</th>';

    sortimentiNazivi.forEach(sortiment => {
        headerHtml += `<th>${sortiment}</th>`;
    });
    headerHtml += '</tr>';
    headerElem.innerHTML = headerHtml;

    // ========== BODY ==========
    // Čisti bijeli/sivi redovi bez šarenja
    let bodyHtml = '';
    const totals = {};
    sortimentiNazivi.forEach(s => totals[s] = 0);

    data.forEach((row, index) => {
        // Naizmjenični bijeli/sivi redovi - CSS :nth-child radi ovo automatski
        bodyHtml += '<tr>';
        bodyHtml += `<td>${row.odjel}</td>`;

        sortimentiNazivi.forEach(sortiment => {
            const value = parseFloat(row.sortimenti?.[sortiment]) || 0;
            totals[sortiment] += value;

            // Prikaži vrijednost ili crticu ako je 0
            const displayValue = value > 0 ? value.toFixed(2) : '-';
            bodyHtml += `<td>${displayValue}</td>`;
        });

        bodyHtml += '</tr>';
    });

    // ========== UKUPNO ROW ==========
    // Zelena pozadina za isticanje
    bodyHtml += '<tr class="totals-row">';
    bodyHtml += '<td>📊 UKUPNO MJESEC</td>';

    sortimentiNazivi.forEach(sortiment => {
        const totalValue = totals[sortiment];
        const display = totalValue > 0 ? totalValue.toFixed(2) : '-';
        bodyHtml += `<td>${display}</td>`;
    });
    bodyHtml += '</tr>';

    bodyElem.innerHTML = bodyHtml;
    console.log(`[RENDER ${tablePrefix}] ✓ Mjesečni table renderiran (${data.length} odjela)`);
}

// Filter table by odjel name
function filterIzvjestajiTable(tablePrefix) {
    const searchId = `izvjestaji-${tablePrefix}-search`;
    const tableId = `izvjestaji-${tablePrefix}-table`;

    const input = document.getElementById(searchId);
    if (!input) return;

    const filter = input.value.toLowerCase();
    const table = document.getElementById(tableId);
    if (!table) return;

    const tr = table.getElementsByTagName('tr');

    // Start from 1 to skip header
    for (let i = 1; i < tr.length; i++) {
        const td = tr[i].getElementsByTagName('td')[0]; // First column (Odjel)
        if (td) {
            const txtValue = td.textContent || td.innerText;
            if (txtValue.toLowerCase().indexOf(filter) > -1) {
                tr[i].style.display = '';
            } else {
                tr[i].style.display = 'none';
            }
        }
    }
}

// Filtriraj podatke po radilištima poslovođe (samo za poslovođa ulogu)
function filterByPoslovodjaRadilista(data) {
    if (typeof getPoslovodjaRadilista !== 'function') return data;
    var radilista = getPoslovodjaRadilista();

    // Fallback: ako getPoslovodjaRadilista() vrati prazan niz,
    // izvuci radilišta iz poslovodjaStanjeOdjeliAll (popunjen iz Stanje zaliha taba)
    if ((!radilista || radilista.length === 0) && typeof poslovodjaStanjeOdjeliAll !== 'undefined' && poslovodjaStanjeOdjeliAll && poslovodjaStanjeOdjeliAll.length > 0) {
        var set = {};
        poslovodjaStanjeOdjeliAll.forEach(function(o) {
            if (o.radiliste) set[o.radiliste.toUpperCase().trim()] = true;
        });
        radilista = Object.keys(set);
        console.log('[IZVJEŠTAJI] Radilišta iz Stanje zaliha fallback:', radilista.join(', '));
    }

    if (!radilista || radilista.length === 0) return data;

    console.log('[IZVJEŠTAJI] Filtriranje po radilištima:', radilista.join(', '));
    var filtered = data.filter(function(row) {
        var r = (row.radiliste || '').toUpperCase().trim();
        return radilista.some(function(pr) {
            return r === pr.toUpperCase().trim();
        });
    });
    console.log('[IZVJEŠTAJI] Filtrirano: ' + filtered.length + '/' + data.length + ' redova');
    return filtered;
}

// ============================================
// 🖨️ ŠTAMPAJ - Profesionalni print prikaz
// ============================================
function printIzvjestaj(tip) {
    const isSedmicni       = tip === 'sedmicni';
    const isSedmicniRadnik = tip === 'sedmicni-radnik';

    const year = document.getElementById(`izvjestaji-${tip}-year`).value;
    const monthIdx = parseInt(document.getElementById(`izvjestaji-${tip}-month`).value);
    const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
                           'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    const monthName = mjeseciNazivi[monthIdx];
    const tipLabel = isSedmicniRadnik ? 'Sedmični izvještaj po radniku'
                   : isSedmicni      ? 'Sedmični izvještaj'
                                     : 'Mjesečni izvještaj';
    const secSjeca  = isSedmicniRadnik ? '🌲 Sječa po radniku'  : '🌲 Sječa po odjelima';
    const secOtprem = isSedmicniRadnik ? '🚛 Otprema po radniku' : '🚛 Otprema po odjelima';
    const datumStampe = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Kloniraj obje tabele iz DOM-a
    const primkaTable = document.getElementById(`izvjestaji-${tip}-primka-table`);
    const otpremaTable = document.getElementById(`izvjestaji-${tip}-otprema-table`);

    if (!primkaTable || !otpremaTable) {
        alert('Tabele još nisu učitane. Molimo sačekajte da se podaci učitaju.');
        return;
    }

    const primkaHtml = primkaTable.outerHTML;
    const otpremaHtml = otpremaTable.outerHTML;

    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) { alert('Popup blokiran — dozvolite popup prozore za štampanje.'); return; }
    printWindow.document.write(`<!DOCTYPE html>
<html lang="bs">
<head>
<meta charset="UTF-8">
<title>${tipLabel} — ${monthName} ${year}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #111;
    background: #fff;
    padding: 20mm 18mm 16mm 18mm;
  }

  /* ── ZAGLAVLJE ── */
  .print-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1e3a5f;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .print-header-left { display: flex; flex-direction: column; gap: 2px; }
  .company-name {
    font-size: 15px;
    font-weight: 700;
    color: #1e3a5f;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .company-sub {
    font-size: 10px;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .print-header-right { text-align: right; }
  .report-title {
    font-size: 14px;
    font-weight: 700;
    color: #1e3a5f;
  }
  .report-period {
    font-size: 11px;
    color: #374151;
    margin-top: 2px;
  }
  .report-meta {
    font-size: 9px;
    color: #6b7280;
    margin-top: 4px;
  }

  /* ── SEKCIJA ── */
  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    background: #1e3a5f;
    padding: 6px 12px;
    margin: 16px 0 0 0;
    border-radius: 4px 4px 0 0;
  }

  /* ── TABELA ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-bottom: 4px;
  }
  thead th {
    background: #2d5a87;
    color: #fff;
    font-weight: 700;
    text-align: center;
    padding: 5px 6px;
    border: 1px solid #1e3a5f;
    white-space: nowrap;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  thead th:first-child { text-align: left; }
  tbody tr { background: #fff; }
  tbody tr:nth-child(even) { background: #f0f4f8; }
  tbody td {
    padding: 4px 6px;
    border: 1px solid #cbd5e1;
    text-align: right;
    white-space: nowrap;
  }
  tbody td:first-child { text-align: left; font-weight: 600; color: #1e3a5f; }

  /* Sedmični specifični stilovi */
  .week-label-cell {
    background: #1e3a5f !important;
    color: #fff !important;
    font-weight: 700;
    text-align: center !important;
    vertical-align: middle;
    padding: 6px !important;
  }
  .week-num { display: block; font-size: 11px; font-weight: 700; }
  .week-date { display: block; font-size: 8px; color: #93c5fd; margin-top: 2px; }
  .week-totals-row td { background: #dbeafe; font-weight: 700; color: #1e40af; }
  .week-totals-row .week-label-cell { background: #1e3a5f !important; color: #fff !important; }
  .week-separator td { border-top: 2px solid #1e3a5f; }
  .grand-totals-row td {
    background: #1e3a5f !important;
    color: #fff !important;
    font-weight: 700;
    border-color: #1e3a5f;
  }

  /* Ukupno row za mjesečni */
  .totals-row td, .ukupno-row td {
    background: #1e3a5f !important;
    color: #fff !important;
    font-weight: 700;
  }

  /* Kolone specijalnog prikaza */
  .col-cetinari, .col-sveukupno { background: #ede9fe; }
  .col-liscari { background: #fef9c3; }
  tbody .week-totals-row td.col-cetinari,
  tbody .week-totals-row td.col-liscari,
  tbody .week-totals-row td.col-sveukupno { background: #bfdbfe; }

  /* ── FOOTER ── */
  .print-footer {
    margin-top: 20px;
    padding-top: 8px;
    border-top: 1px solid #d1d5db;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #6b7280;
  }

  /* ── PRINT MEDIA ── */
  @media print {
    body { padding: 0; }
    @page { size: A4 landscape; margin: 12mm 14mm; }
    .no-print { display: none; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    .section-title { page-break-after: avoid; }
  }

  /* ── PRINT DUGME (ekran) ── */
  .no-print {
    text-align: center;
    margin-bottom: 16px;
  }
  .btn-print {
    background: #1e3a5f;
    color: white;
    border: none;
    padding: 10px 28px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    margin-right: 8px;
  }
  .btn-close {
    background: #6b7280;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }
</style>
</head>
<body>

<div class="no-print" style="padding: 14px 0;">
  <button class="btn-print" onclick="window.print()">🖨️ Štampaj</button>
  <button class="btn-close" onclick="window.close()">✕ Zatvori</button>
</div>

<div class="print-header">
  <div class="print-header-left">
    <div class="company-name">ŠPD "Unsko-Sanske Šume" d.o.o.</div>
    <div class="company-sub">Šumarija Bosanska Krupa</div>
  </div>
  <div class="print-header-right">
    <div class="report-title">${tipLabel}</div>
    <div class="report-period">Period: ${monthName} ${year}</div>
    <div class="report-meta">Datum štampe: ${datumStampe}</div>
  </div>
</div>

<div class="section-title">${secSjeca} — ${monthName} ${year}</div>
${primkaHtml}

<div class="section-title">${secOtprem} — ${monthName} ${year}</div>
${otpremaHtml}

<div class="print-footer">
  <span>ŠPD "Unsko-Sanske Šume" d.o.o. — Šumarija Bosanska Krupa</span>
  <span>Štampano: ${datumStampe}</span>
</div>

</body>
</html>`);
    printWindow.document.close();
}

// ============================================
// 🏭 IZVJEŠTAJ PO ODJELIMA — sječa + otprema + radnici + sortimenti (mjesec)
// ============================================

// Grupne kolone (podzbirovi) — preskaču se u prikazu sortimenata i pri računu
// ukupnog da se izbjegne dupliranje; "UKUPNO Č+L" je primarni izvor ukupnog.
const IZV_GRUPNE_KOLONE = ['Σ ČETINARI', 'LIŠĆARI', 'UKUPNO Č+L'];
const IZV_UKUPNO_KOL    = 'UKUPNO Č+L';

function _izvRowUkupno(row, sortimentiNazivi) {
    const t = parseFloat(row.sortimenti && row.sortimenti[IZV_UKUPNO_KOL]) || 0;
    if (t) return t;
    // Fallback: zbroj svih ne-grupnih kolona (kad UKUPNO Č+L nedostaje)
    let s = 0;
    sortimentiNazivi.forEach(k => {
        if (IZV_GRUPNE_KOLONE.indexOf(k) === -1) s += parseFloat(row.sortimenti && row.sortimenti[k]) || 0;
    });
    return s;
}

async function loadIzvjestajiPoOdjelima() {
    console.log('[IZVJEŠTAJI PO ODJELIMA] Loading data...');
    const content = document.getElementById('izvjestaji-po-odjelima-content');

    try {
        const yearElem = document.getElementById('izvjestaji-po-odjelima-year');
        const monthElem = document.getElementById('izvjestaji-po-odjelima-month');
        if (!yearElem || !monthElem || !content) return;

        const year = parseInt(yearElem.value);
        const month = parseInt(monthElem.value);
        const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
        const monthName = mjeseciNazivi[month] + ' ' + year;

        content.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;"><div style="font-size:32px;margin-bottom:12px;">⏳</div>Učitavanje podataka za ' + monthName + '...</div>';

        // Isti endpoint i keš kao mjesečni izvještaj — dijeli topli keš, radi offline
        const primkaUrl = buildApiUrl('primaci-daily', { year, month });
        const otpremaUrl = buildApiUrl('otpremaci-daily', { year, month });

        const [primkaData, otpremaData] = await Promise.all([
            fetchWithCache(primkaUrl, `cache_izvjestaji_mjesecni_primka_${year}_${month}`, false, 180000),
            fetchWithCache(otpremaUrl, `cache_izvjestaji_mjesecni_otprema_${year}_${month}`, false, 180000)
        ]);

        if (primkaData.error) throw new Error('Primka: ' + primkaData.error);
        if (otpremaData.error) throw new Error('Otprema: ' + otpremaData.error);

        const primkaRows  = primkaData.data || [];
        const otpremaRows = otpremaData.data || [];
        const sortimentiNazivi = (primkaData.sortimentiNazivi && primkaData.sortimentiNazivi.length)
            ? primkaData.sortimentiNazivi
            : (otpremaData.sortimentiNazivi || []);

        // Filtriraj po radilištima poslovođe (ako je poslovođa ulogiran)
        const primkaFiltered  = filterByPoslovodjaRadilista(primkaRows);
        const otpremaFiltered = filterByPoslovodjaRadilista(otpremaRows);

        const odjeli = aggregatePoOdjelima(primkaFiltered, otpremaFiltered, sortimentiNazivi);
        renderIzvjestajiPoOdjelima(odjeli, sortimentiNazivi, monthName);

        console.log('[IZVJEŠTAJI PO ODJELIMA] ✓ Data loaded successfully');
        if (typeof markTabRendered === 'function') markTabRendered('izvjestaji');

    } catch (error) {
        console.error('[IZVJEŠTAJI PO ODJELIMA] Error:', error);
        if (content) content.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">❌ Greška pri učitavanju: ' + error.message + '</div>';
    }
}

// Agregiraj primku i otpremu po odjelu — sortimenti, radnici, kupci, ukupno
function aggregatePoOdjelima(primkaRows, otpremaRows, sortimentiNazivi) {
    const odjeli = {};

    function ensure(odjel) {
        if (!odjeli[odjel]) {
            odjeli[odjel] = {
                odjel: odjel,
                radiliste: {}, izvodjac: {},
                sjecaSort: {}, otpremaSort: {},
                primaci: {}, otpremaci: {}, kupci: {},
                sjecaUkupno: 0, otpremaUkupno: 0,
            };
            sortimentiNazivi.forEach(s => { odjeli[odjel].sjecaSort[s] = 0; odjeli[odjel].otpremaSort[s] = 0; });
        }
        return odjeli[odjel];
    }

    primkaRows.forEach(row => {
        const o = ensure(String(row.odjel || '—'));
        if (row.radiliste) o.radiliste[row.radiliste] = true;
        if (row.izvodjac) o.izvodjac[row.izvodjac] = true;
        sortimentiNazivi.forEach(s => { o.sjecaSort[s] += parseFloat(row.sortimenti && row.sortimenti[s]) || 0; });
        const t = _izvRowUkupno(row, sortimentiNazivi);
        o.sjecaUkupno += t;
        const p = row.primac || '—';
        o.primaci[p] = (o.primaci[p] || 0) + t;
    });

    otpremaRows.forEach(row => {
        const o = ensure(String(row.odjel || '—'));
        if (row.radiliste) o.radiliste[row.radiliste] = true;
        if (row.izvodjac) o.izvodjac[row.izvodjac] = true;
        sortimentiNazivi.forEach(s => { o.otpremaSort[s] += parseFloat(row.sortimenti && row.sortimenti[s]) || 0; });
        const t = _izvRowUkupno(row, sortimentiNazivi);
        o.otpremaUkupno += t;
        const ot = row.otpremac || '—';
        o.otpremaci[ot] = (o.otpremaci[ot] || 0) + t;
        const k = row.kupac || '';
        if (k) o.kupci[k] = (o.kupci[k] || 0) + t;
    });

    // Sortiraj po ukupnom prometu (sječa + otprema), najveći prvi
    return Object.keys(odjeli).map(k => odjeli[k])
        .sort((a, b) => (b.sjecaUkupno + b.otpremaUkupno) - (a.sjecaUkupno + a.otpremaUkupno));
}

function _izvSortList(obj) {
    // Vrati [{ime, ukupno}] sortirano opadajuće
    return Object.keys(obj).map(ime => ({ ime, ukupno: obj[ime] }))
        .filter(x => x.ukupno > 0)
        .sort((a, b) => b.ukupno - a.ukupno);
}

function renderIzvjestajiPoOdjelima(odjeli, sortimentiNazivi, monthName) {
    const content = document.getElementById('izvjestaji-po-odjelima-content');
    if (!content) return;

    if (!odjeli.length) {
        content.innerHTML = '<div style="text-align:center;padding:60px;color:#6b7280;"><div style="font-size:48px;margin-bottom:16px;">📭</div><div style="font-size:16px;">Nema podataka za ' + monthName + '</div></div>';
        return;
    }

    const totalSjeca   = odjeli.reduce((s, o) => s + o.sjecaUkupno, 0);
    const totalOtprema = odjeli.reduce((s, o) => s + o.otpremaUkupno, 0);
    const najveci = odjeli[0];
    const fmt = v => (v > 0 ? v.toFixed(2) : '-');
    const keys = obj => Object.keys(obj).join(', ') || '—';

    // Summary kartice
    let html = '<div class="summary-cards">';
    html += `<div class="summary-card green"><div class="summary-card-title">Ukupno sječa — ${monthName}</div><div class="summary-card-value">${totalSjeca.toFixed(2)} m³</div><div class="summary-card-subtitle">${odjeli.length} odjela</div></div>`;
    html += `<div class="summary-card blue"><div class="summary-card-title">Ukupno otprema — ${monthName}</div><div class="summary-card-value">${totalOtprema.toFixed(2)} m³</div></div>`;
    html += `<div class="summary-card"><div class="summary-card-title">Najveći odjel</div><div class="summary-card-value" style="font-size:20px;">${najveci.odjel}</div><div class="summary-card-subtitle">${(najveci.sjecaUkupno + najveci.otpremaUkupno).toFixed(2)} m³ ukupno</div></div>`;
    html += '</div>';

    // Po odjelu
    odjeli.forEach(o => {
        const sortRows = sortimentiNazivi.filter(s =>
            IZV_GRUPNE_KOLONE.indexOf(s) === -1 && ((o.sjecaSort[s] || 0) > 0 || (o.otpremaSort[s] || 0) > 0));
        const primaci = _izvSortList(o.primaci);
        const otpremaci = _izvSortList(o.otpremaci);
        const kupci = _izvSortList(o.kupci);

        html += `<div class="enterprise-card izvjestaj-odjel-card" data-odjel="${String(o.odjel).toUpperCase()}" style="margin-top:16px;">
            <div class="enterprise-card-header">
                <div>
                    <h2>🏭 Odjel ${o.odjel}</h2>
                    <span class="card-subtitle">Radilište: ${keys(o.radiliste)} · Izvođač: ${keys(o.izvodjac)}</span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <span style="background:#dcfce7;color:#166534;font-weight:700;font-size:13px;padding:6px 12px;border-radius:8px;">🌲 Sječa: ${o.sjecaUkupno.toFixed(2)} m³</span>
                    <span style="background:#dbeafe;color:#1e40af;font-weight:700;font-size:13px;padding:6px 12px;border-radius:8px;">🚛 Otprema: ${o.otpremaUkupno.toFixed(2)} m³</span>
                </div>
            </div>
            <div class="enterprise-card-body">`;

        // Sortimenti tabela (sječa vs otprema)
        html += `<h3 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 8px;">📦 Po sortimentima</h3>
            <div style="overflow-x:auto;">
            <table class="kupci-table" style="width:100%;font-size:13px;">
            <thead><tr><th style="text-align:left;">Sortiment</th><th class="right">Sječa m³</th><th class="right">Otprema m³</th></tr></thead>
            <tbody>`;
        if (sortRows.length) {
            sortRows.forEach(s => {
                html += `<tr><td style="font-weight:600;">${s}</td><td class="right">${fmt(o.sjecaSort[s] || 0)}</td><td class="right">${fmt(o.otpremaSort[s] || 0)}</td></tr>`;
            });
        } else {
            html += `<tr><td colspan="3" style="text-align:center;color:#9ca3af;">Nema sortimenata</td></tr>`;
        }
        html += `<tr class="totals-row"><td>UKUPNO</td><td class="right">${o.sjecaUkupno.toFixed(2)}</td><td class="right">${o.otpremaUkupno.toFixed(2)}</td></tr>`;
        html += `</tbody></table></div>`;

        // Radnici (primaci / otpremaci) + kupci
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:14px;">`;

        html += `<div><h3 style="font-size:14px;font-weight:700;color:#166534;margin:0 0 8px;">👷 Sječa po radniku</h3>
            <table class="kupci-table" style="width:100%;font-size:13px;"><thead><tr><th style="text-align:left;">Primač</th><th class="right">m³</th></tr></thead><tbody>`;
        if (primaci.length) primaci.forEach(p => { html += `<tr><td>${p.ime}</td><td class="right">${p.ukupno.toFixed(2)}</td></tr>`; });
        else html += `<tr><td colspan="2" style="text-align:center;color:#9ca3af;">—</td></tr>`;
        html += `</tbody></table></div>`;

        html += `<div><h3 style="font-size:14px;font-weight:700;color:#1e40af;margin:0 0 8px;">🚛 Otprema po radniku</h3>
            <table class="kupci-table" style="width:100%;font-size:13px;"><thead><tr><th style="text-align:left;">Otpremač</th><th class="right">m³</th></tr></thead><tbody>`;
        if (otpremaci.length) otpremaci.forEach(p => { html += `<tr><td>${p.ime}</td><td class="right">${p.ukupno.toFixed(2)}</td></tr>`; });
        else html += `<tr><td colspan="2" style="text-align:center;color:#9ca3af;">—</td></tr>`;
        html += `</tbody></table></div>`;

        if (kupci.length) {
            html += `<div><h3 style="font-size:14px;font-weight:700;color:#0e7490;margin:0 0 8px;">🏢 Otprema po kupcu</h3>
                <table class="kupci-table" style="width:100%;font-size:13px;"><thead><tr><th style="text-align:left;">Kupac</th><th class="right">m³</th></tr></thead><tbody>`;
            kupci.forEach(p => { html += `<tr><td>${p.ime}</td><td class="right">${p.ukupno.toFixed(2)}</td></tr>`; });
            html += `</tbody></table></div>`;
        }

        html += `</div></div></div>`;
    });

    content.innerHTML = html;
}

// Pretraga po odjelu — sakrij/prikaži kartice
function filterIzvjestajPoOdjelima() {
    const input = document.getElementById('izvjestaji-po-odjelima-search');
    if (!input) return;
    const q = input.value.toUpperCase().trim();
    document.querySelectorAll('#izvjestaji-po-odjelima-content .izvjestaj-odjel-card').forEach(card => {
        const o = card.getAttribute('data-odjel') || '';
        card.style.display = (!q || o.indexOf(q) > -1) ? '' : 'none';
    });
}

// Štampaj — otvori sadržaj u print prozoru
function printIzvjestajPoOdjelima() {
    const content = document.getElementById('izvjestaji-po-odjelima-content');
    if (!content || !content.querySelector('.izvjestaj-odjel-card')) {
        alert('Podaci još nisu učitani. Molimo sačekajte.');
        return;
    }
    const yearEl = document.getElementById('izvjestaji-po-odjelima-year');
    const monthEl = document.getElementById('izvjestaji-po-odjelima-month');
    const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    const monthName = mjeseciNazivi[parseInt(monthEl.value)] + ' ' + yearEl.value;
    const datumStampe = new Date().toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const win = window.open('', '_blank', 'width=1100,height=850');
    if (!win) { alert('Popup blokiran — dozvolite popup prozore za štampanje.'); return; }
    win.document.write(`<!DOCTYPE html><html lang="bs"><head><meta charset="UTF-8">
<title>Izvještaj po odjelima — ${monthName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#111; padding:16mm 14mm; }
  .print-header { display:flex; justify-content:space-between; border-bottom:3px solid #1e3a5f; padding-bottom:10px; margin-bottom:14px; }
  .company-name { font-size:15px; font-weight:700; color:#1e3a5f; text-transform:uppercase; }
  .company-sub { font-size:10px; color:#4b5563; text-transform:uppercase; }
  .report-title { font-size:14px; font-weight:700; color:#1e3a5f; text-align:right; }
  .report-period { font-size:11px; color:#374151; text-align:right; }
  .enterprise-card { border:1px solid #cbd5e1; border-radius:6px; margin-bottom:14px; page-break-inside:avoid; }
  .enterprise-card-header { background:#1e3a5f; color:#fff; padding:8px 12px; }
  .enterprise-card-header h2 { font-size:14px; }
  .enterprise-card-header .card-subtitle { font-size:10px; color:#cbd5e1; }
  .enterprise-card-header span[style*="background"] { color:#111 !important; }
  .enterprise-card-body { padding:10px 12px; }
  h3 { font-size:12px; margin:8px 0 6px; }
  table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:6px; }
  thead th { background:#2d5a87; color:#fff; padding:4px 6px; border:1px solid #1e3a5f; text-align:right; }
  thead th:first-child { text-align:left; }
  tbody td { padding:3px 6px; border:1px solid #cbd5e1; text-align:right; }
  tbody td:first-child { text-align:left; }
  .totals-row td { background:#1e3a5f; color:#fff; font-weight:700; }
  @media print { @page { size:A4 portrait; margin:12mm; } .no-print { display:none; } }
  .no-print { text-align:center; margin-bottom:14px; }
  .btn-print { background:#1e3a5f; color:#fff; border:none; padding:10px 28px; border-radius:8px; cursor:pointer; font-weight:700; margin-right:8px; }
  .btn-close { background:#6b7280; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; }
</style></head><body>
<div class="no-print"><button class="btn-print" onclick="window.print()">🖨️ Štampaj</button><button class="btn-close" onclick="window.close()">✕ Zatvori</button></div>
<div class="print-header">
  <div><div class="company-name">ŠPD "Unsko-Sanske Šume" d.o.o.</div><div class="company-sub">Šumarija Bosanska Krupa</div></div>
  <div><div class="report-title">Izvještaj po odjelima</div><div class="report-period">Period: ${monthName}</div><div class="report-period" style="font-size:9px;color:#6b7280;">Datum štampe: ${datumStampe}</div></div>
</div>
${content.innerHTML}
</body></html>`);
    win.document.close();
}

console.log('[IZVJEŠTAJI] ✓ New izvjestaji functions loaded');
