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

        // Filtriraj po radilištima poslovođe (ako je poslovođa ulogiran)
        var primkaFiltered = filterByPoslovodjaRadilista(primkaData.data);
        var otpremaFiltered = filterByPoslovodjaRadilista(otpremaData.data);

        // Izračunaj sedmice u mjesecu (1. počinje od prvog dana, sedmica završava u nedjelju)
        const weeks = calculateWeeksInMonth(year, month);
        console.log('[IZVJEŠTAJI SEDMICNI] Weeks:', weeks);

        // Grupiraj podatke po sedmicama i odjelima
        const primkaByWeek = aggregateByWeekAndOdjel(primkaFiltered, primkaData.sortimentiNazivi, weeks, year, month);
        const otpremaByWeek = aggregateByWeekAndOdjel(otpremaFiltered, otpremaData.sortimentiNazivi, weeks, year, month);

        // Render tables po sedmicama
        renderIzvjestajiSedmicniTable(primkaByWeek, primkaData.sortimentiNazivi, 'sedmicni-primka', weeks);
        renderIzvjestajiSedmicniTable(otpremaByWeek, otpremaData.sortimentiNazivi, 'sedmicni-otprema', weeks);

        console.log('[IZVJEŠTAJI SEDMICNI] ✓ Data loaded successfully');

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

        var primkaFiltered = filterByPoslovodjaRadilista(primkaData.data);
        var otpremaFiltered = filterByPoslovodjaRadilista(otpremaData.data);

        const weeks = calculateWeeksInMonth(year, month);

        // Grupiraj po radniku (primac/otpremac) umjesto po odjelu
        const primkaByWeek = aggregateByWeekAndOdjel(primkaFiltered, primkaData.sortimentiNazivi, weeks, year, month, 'primac');
        const otpremaByWeek = aggregateByWeekAndOdjel(otpremaFiltered, otpremaData.sortimentiNazivi, weeks, year, month, 'otpremac');

        renderIzvjestajiSedmicniTable(primkaByWeek, primkaData.sortimentiNazivi, 'sedmicni-radnik-primka', weeks, 'Radnik');
        renderIzvjestajiSedmicniTable(otpremaByWeek, otpremaData.sortimentiNazivi, 'sedmicni-radnik-otprema', weeks, 'Radnik');

        console.log('[IZVJEŠTAJI SEDMICNI RADNIK] ✓ Data loaded successfully');

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

        // Filtriraj po radilištima poslovođe (ako je poslovođa ulogiran)
        var primkaFiltered = filterByPoslovodjaRadilista(primkaData.data);
        var otpremaFiltered = filterByPoslovodjaRadilista(otpremaData.data);

        // Aggregate by odjel
        const primkaByOdjel = aggregateByOdjelIzvjestaji(primkaFiltered, primkaData.sortimentiNazivi);
        const otpremaByOdjel = aggregateByOdjelIzvjestaji(otpremaFiltered, otpremaData.sortimentiNazivi);

        // Render tables
        renderIzvjestajiTable(primkaByOdjel, primkaData.sortimentiNazivi, 'mjesecni-primka');
        renderIzvjestajiTable(otpremaByOdjel, otpremaData.sortimentiNazivi, 'mjesecni-otprema');

        console.log('[IZVJEŠTAJI MJESECNI] ✓ Data loaded successfully');

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
    const isSedmicni = tip === 'sedmicni';

    const year = document.getElementById(`izvjestaji-${tip}-year`).value;
    const monthIdx = parseInt(document.getElementById(`izvjestaji-${tip}-month`).value);
    const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
                           'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    const monthName = mjeseciNazivi[monthIdx];
    const tipLabel = isSedmicni ? 'Sedmični izvještaj' : 'Mjesečni izvještaj';
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

<div class="section-title">🌲 Sječa po odjelima — ${monthName} ${year}</div>
${primkaHtml}

<div class="section-title">🚛 Otprema po odjelima — ${monthName} ${year}</div>
${otpremaHtml}

<div class="print-footer">
  <span>ŠPD "Unsko-Sanske Šume" d.o.o. — Šumarija Bosanska Krupa</span>
  <span>Štampano: ${datumStampe}</span>
</div>

</body>
</html>`);
    printWindow.document.close();
}

console.log('[IZVJEŠTAJI] ✓ New izvjestaji functions loaded');
