// ============================================
// 📋 NOVI IZVJEŠTAJI - Sedmični i Mjesečni
// ============================================

console.log('🔵 [IZVJEŠTAJI-NEW.JS] File loaded successfully!');

// Switch between Sedmični and Mjesečni sub-tabs
function switchIzvjestajiSubTab(subTab) {
    console.log('[IZVJEŠTAJI] Switching to:', subTab);

    const sedmicniElem = document.getElementById('izvjestaji-sedmicni');
    const mjesecniElem = document.getElementById('izvjestaji-mjesecni');

    // ✅ SAFETY CHECK: Elementi moraju postojati
    if (!sedmicniElem || !mjesecniElem) {
        console.error('[IZVJEŠTAJI] ❌ Elements not found! sedmicni:', !!sedmicniElem, 'mjesecni:', !!mjesecniElem);
        return;
    }

    const subTabs = document.querySelectorAll('#izvjestaji-content .sub-tab');
    subTabs.forEach(tab => tab.classList.remove('active'));

    if (subTab === 'sedmicni') {
        sedmicniElem.classList.remove('hidden');
        mjesecniElem.classList.add('hidden');
        document.querySelector('#izvjestaji-content .sub-tab[onclick*="sedmicni"]').classList.add('active');

        // Set default to current month/year
        const currentDate = new Date();
        document.getElementById('izvjestaji-sedmicni-year').value = currentDate.getFullYear();
        document.getElementById('izvjestaji-sedmicni-month').value = currentDate.getMonth();

        loadIzvjestajiSedmicni();
    } else if (subTab === 'mjesecni') {
        sedmicniElem.classList.add('hidden');
        mjesecniElem.classList.remove('hidden');
        document.querySelector('#izvjestaji-content .sub-tab[onclick*="mjesecni"]').classList.add('active');

        // Set default to current month/year
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

// Grupiraj podatke po sedmicama i odjelima
function aggregateByWeekAndOdjel(data, sortimentiNazivi, weeks, year, month) {
    // Struktura: { weekNum: { odjel: { sortimenti } } }
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

        const odjel = String(row.odjel || 'Nepoznat');

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
function renderIzvjestajiSedmicniTable(dataByWeek, sortimentiNazivi, tablePrefix, weeks) {
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
    let headerHtml = '<tr><th class="col-sedmica">SEDMICA</th><th>Odjel</th>';
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

        const year = yearElem.value;
        const month = monthElem.value;

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
            const value = parseFloat(row.sortimenti[sortiment]) || 0;
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
            const value = parseFloat(row.sortimenti[sortiment]) || 0;
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

console.log('[IZVJEŠTAJI] ✓ New izvjestaji functions loaded');
