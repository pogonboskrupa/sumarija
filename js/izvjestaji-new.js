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

// Load SEDMIČNI izvještaj
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

        const year = yearElem.value;
        const month = monthElem.value;

        const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

        // Update titles
        document.getElementById('izvjestaji-sedmicni-primka-title').textContent = mjeseciNazivi[month] + ' ' + year;
        document.getElementById('izvjestaji-sedmicni-otprema-title').textContent = mjeseciNazivi[month] + ' ' + year;

        // Fetch data (week view - last 7 days from month)
        const primkaUrl = buildApiUrl('primaci-daily', { year, month });
        const otpremaUrl = buildApiUrl('otpremaci-daily', { year, month });

        const [primkaData, otpremaData] = await Promise.all([
            fetchWithCache(primkaUrl, `cache_izvjestaji_sedmicni_primka_${year}_${month}`, false, 180000),
            fetchWithCache(otpremaUrl, `cache_izvjestaji_sedmicni_otprema_${year}_${month}`, false, 180000)
        ]);

        if (primkaData.error) throw new Error('Primka: ' + primkaData.error);
        if (otpremaData.error) throw new Error('Otprema: ' + otpremaData.error);

        // Aggregate by odjel
        const primkaByOdjel = aggregateByOdjelIzvjestaji(primkaData.data, primkaData.sortimentiNazivi);
        const otpremaByOdjel = aggregateByOdjelIzvjestaji(otpremaData.data, otpremaData.sortimentiNazivi);

        // Render tables
        renderIzvjestajiTable(primkaByOdjel, primkaData.sortimentiNazivi, 'sedmicni-primka');
        renderIzvjestajiTable(otpremaByOdjel, otpremaData.sortimentiNazivi, 'sedmicni-otprema');

        console.log('[IZVJEŠTAJI SEDMICNI] ✓ Data loaded successfully');

    } catch (error) {
        console.error('[IZVJEŠTAJI SEDMICNI] Error:', error);
        showError('Greška', 'Greška pri učitavanju sedmičnog izvještaja: ' + error.message);
    }
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
        const aSveukupno = parseFloat(a.sortimenti['SVEUKUPNO']) || 0;
        const bSveukupno = parseFloat(b.sortimenti['SVEUKUPNO']) || 0;
        return bSveukupno - aSveukupno; // DESC
    });

    // Helper functions
    function isLiscari(s) {
        return s.includes(' L') || s.includes('OGR.') || s.includes('TRUPCI') || s === 'LIŠĆARI';
    }

    function isCetinari(s) {
        return s.includes(' Č') || s.includes('CEL.') || s.includes('RUDNO') || s === 'ČETINARI';
    }

    // Build header
    let headerHtml = '<tr><th>Odjel</th>';
    sortimentiNazivi.forEach(sortiment => {
        let bgColor;
        let textColor = 'white';

        if (sortiment === 'SVEUKUPNO') {
            bgColor = '#dc2626'; // Red
        } else if (sortiment === 'LIŠĆARI') {
            bgColor = '#d97706'; // Dark orange
        } else if (sortiment === 'ČETINARI') {
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
                if (sortiment === 'SVEUKUPNO') {
                    bgColor = '#fecaca'; // Light red
                    textColor = '#7f1d1d'; // Dark red text
                } else if (sortiment === 'LIŠĆARI') {
                    bgColor = '#fed7aa'; // Light orange
                    textColor = '#78350f'; // Dark orange text
                } else if (sortiment === 'ČETINARI') {
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
