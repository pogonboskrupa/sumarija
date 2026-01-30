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

        // Izračunaj sedmice u mjesecu (1. počinje od prvog dana, sedmica završava u nedjelju)
        const weeks = calculateWeeksInMonth(year, month);
        console.log('[IZVJEŠTAJI SEDMICNI] Weeks:', weeks);

        // Grupiraj podatke po sedmicama i odjelima
        const primkaByWeek = aggregateByWeekAndOdjel(primkaData.data, primkaData.sortimentiNazivi, weeks, year, month);
        const otpremaByWeek = aggregateByWeekAndOdjel(otpremaData.data, otpremaData.sortimentiNazivi, weeks, year, month);

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
        weeks.push({
            weekNum: weeks.length + 1,
            start: weekStart,
            end: weekEnd,
            label: `${weekStart}. - ${weekEnd}.`
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

    // Helper functions za boje
    function isLiscari(s) {
        return s.includes(' L') || s.includes('OGR.') || s === 'TRUPCI L' || s === 'LIŠĆARI';
    }

    function isCetinari(s) {
        return s.includes(' Č') || s.includes('CEL.') || s.includes('RD') || s === 'Σ ČETINARI';
    }

    // Build header
    let headerHtml = '<tr><th style="background: #374151; color: white;">Sedmica</th><th style="background: #374151; color: white;">Odjel</th>';
    sortimentiNazivi.forEach(sortiment => {
        let bgColor;
        if (sortiment === 'UKUPNO Č+L') {
            bgColor = '#dc2626';
        } else if (sortiment === 'LIŠĆARI') {
            bgColor = '#d97706';
        } else if (sortiment === 'Σ ČETINARI') {
            bgColor = '#047857';
        } else if (isLiscari(sortiment)) {
            bgColor = '#ea580c';
        } else if (isCetinari(sortiment)) {
            bgColor = '#059669';
        } else {
            bgColor = '#6b7280';
        }
        headerHtml += `<th style="background: ${bgColor}; color: white;">${sortiment}</th>`;
    });
    headerHtml += '</tr>';
    headerElem.innerHTML = headerHtml;

    // Build body - grupirano po sedmicama
    let bodyHtml = '';

    weeks.forEach((week, weekIndex) => {
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

        // Header za sedmicu (tamni red)
        bodyHtml += `<tr style="background: #1f2937;">`;
        bodyHtml += `<td style="color: white; font-weight: bold;" rowspan="${odjeli.length + 1}">${week.label}</td>`;
        bodyHtml += `<td style="color: #fbbf24; font-weight: bold;">UKUPNO SEDMICA</td>`;
        sortimentiNazivi.forEach(s => {
            const val = weekTotals[s];
            const display = val > 0 ? val.toFixed(2) : '-';
            bodyHtml += `<td style="color: #fbbf24; font-weight: bold; text-align: right;">${display}</td>`;
        });
        bodyHtml += '</tr>';

        // Redovi za svaki odjel
        odjeli.forEach((odjel, odjelIndex) => {
            const rowBg = odjelIndex % 2 === 0 ? '#f9fafb' : 'white';
            bodyHtml += `<tr style="background: ${rowBg};">`;
            bodyHtml += `<td style="padding-left: 20px;">${odjel}</td>`;

            sortimentiNazivi.forEach(sortiment => {
                const value = weekData[odjel][sortiment] || 0;
                const displayValue = value > 0 ? value.toFixed(2) : '';

                let bgColor = 'transparent';
                let textColor = '#1f2937';

                if (value > 0) {
                    if (sortiment === 'UKUPNO Č+L') {
                        bgColor = '#fecaca';
                        textColor = '#7f1d1d';
                    } else if (sortiment === 'LIŠĆARI') {
                        bgColor = '#fed7aa';
                        textColor = '#78350f';
                    } else if (sortiment === 'Σ ČETINARI') {
                        bgColor = '#a7f3d0';
                        textColor = '#065f46';
                    } else if (isLiscari(sortiment)) {
                        bgColor = '#ffedd5';
                        textColor = '#78350f';
                    } else if (isCetinari(sortiment)) {
                        bgColor = '#d1fae5';
                        textColor = '#065f46';
                    }
                }

                bodyHtml += `<td style="background: ${bgColor}; color: ${textColor}; text-align: right;">${displayValue}</td>`;
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

    bodyHtml += `<tr style="background: linear-gradient(135deg, #047857 0%, #065f46 100%);">`;
    bodyHtml += `<td colspan="2" style="color: white; font-weight: bold;">UKUPNO MJESEC</td>`;
    sortimentiNazivi.forEach(s => {
        const val = grandTotals[s];
        const display = val > 0 ? val.toFixed(2) : '-';
        bodyHtml += `<td style="color: white; font-weight: bold; text-align: right;">${display}</td>`;
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

        // Aggregate by odjel
        const primkaByOdjel = aggregateByOdjelIzvjestaji(primkaData.data, primkaData.sortimentiNazivi);
        const otpremaByOdjel = aggregateByOdjelIzvjestaji(otpremaData.data, otpremaData.sortimentiNazivi);

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

// Render izvjestaji table with SORTING BY SVEUKUPNO (DESC)
function renderIzvjestajiTable(data, sortimentiNazivi, tablePrefix) {
    console.log(`[RENDER ${tablePrefix}] Rendering table...`);

    const headerElem = document.getElementById(`izvjestaji-${tablePrefix}-header`);
    const bodyElem = document.getElementById(`izvjestaji-${tablePrefix}-body`);

    if (!data || data.length === 0) {
        headerElem.innerHTML = '';
        bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za odabrani period</td></tr>';
        return;
    }

    // ✅ SORT BY SVEUKUPNO COLUMN (DESC - largest first)
    data.sort((a, b) => {
        const aSveukupno = parseFloat(a.sortimenti['UKUPNO Č+L']) || 0;
        const bSveukupno = parseFloat(b.sortimenti['UKUPNO Č+L']) || 0;
        return bSveukupno - aSveukupno; // DESC
    });

    // Helper functions
    function isLiscari(s) {
        return s.includes(' L') || s.includes('OGR.') || s.includes('TRUPCI') || s === 'LIŠĆARI';
    }

    function isCetinari(s) {
        return s.includes(' Č') || s.includes('CEL.') || s.includes('RD') || s === 'Σ ČETINARI';
    }

    // Build header
    let headerHtml = '<tr><th>Odjel</th>';
    sortimentiNazivi.forEach(sortiment => {
        let bgColor;
        let textColor = 'white';

        if (sortiment === 'UKUPNO Č+L') {
            bgColor = '#dc2626'; // Red
        } else if (sortiment === 'LIŠĆARI') {
            bgColor = '#d97706'; // Dark orange
        } else if (sortiment === 'Σ ČETINARI') {
            bgColor = '#047857'; // Dark green
        } else if (isLiscari(sortiment)) {
            bgColor = '#ea580c'; // Orange
        } else if (isCetinari(sortiment)) {
            bgColor = '#059669'; // Green
        } else {
            bgColor = '#6b7280'; // Gray
        }

        headerHtml += `<th style="background: ${bgColor}; color: ${textColor};">${sortiment}</th>`;
    });
    headerHtml += '</tr>';
    headerElem.innerHTML = headerHtml;

    // Build body
    let bodyHtml = '';
    data.forEach(row => {
        bodyHtml += '<tr>';
        bodyHtml += `<td>${row.odjel}</td>`;

        sortimentiNazivi.forEach(sortiment => {
            const value = parseFloat(row.sortimenti[sortiment]) || 0;
            const displayValue = value > 0 ? value.toFixed(2) : '';

            let bgColor = 'transparent';
            let textColor = '#1f2937';

            if (value > 0) {
                if (sortiment === 'UKUPNO Č+L') {
                    bgColor = '#fecaca'; // Light red
                    textColor = '#7f1d1d'; // Dark red text
                } else if (sortiment === 'LIŠĆARI') {
                    bgColor = '#fed7aa'; // Light orange
                    textColor = '#78350f'; // Dark orange text
                } else if (sortiment === 'Σ ČETINARI') {
                    bgColor = '#a7f3d0'; // Light green
                    textColor = '#065f46'; // Dark green text
                } else if (isLiscari(sortiment)) {
                    bgColor = '#ffedd5'; // Very light orange
                    textColor = '#78350f'; // Dark orange text
                } else if (isCetinari(sortiment)) {
                    bgColor = '#d1fae5'; // Very light green
                    textColor = '#065f46'; // Dark green text
                }
            }

            bodyHtml += `<td style="background: ${bgColor}; color: ${textColor};">${displayValue}</td>`;
        });

        bodyHtml += '</tr>';
    });

    bodyElem.innerHTML = bodyHtml;
    console.log(`[RENDER ${tablePrefix}] ✓ Table rendered (${data.length} rows)`);
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

console.log('[IZVJEŠTAJI] ✓ New izvjestaji functions loaded');
