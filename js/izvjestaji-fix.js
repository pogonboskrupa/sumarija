// 🔧 JEDNOSTAVNA VERZIJA - SVE LIŠĆARI ISTE BOJE, SVE ČETINARI ISTE BOJE

window.renderIzvjestajiTableFixed = function(data, sortimentiNazivi, tip) {
    const headerElem = document.getElementById('izvjestaji-' + tip + '-header');
    const bodyElem = document.getElementById('izvjestaji-' + tip + '-body');

    if (data.length === 0) {
        headerElem.innerHTML = '';
        bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za odabrani mjesec</td></tr>';
        return;
    }

    // Helper funkcija - provjera da li je lišćari
    function isLiscari(sortiment) {
        return sortiment.includes(' L') || sortiment.includes('OGR.') || sortiment.includes('TRUPCI') || sortiment === 'LIŠĆARI';
    }

    // Helper funkcija - provjera da li je četinari
    function isCetinari(sortiment) {
        return sortiment.includes(' Č') || sortiment.includes('CEL.') || sortiment.includes('RUDNO') || sortiment === 'ČETINARI';
    }

    // Build header
    let headerHtml = '<tr><th style="position: sticky; left: 0; background: #f9fafb; z-index: 20; min-width: 200px; padding: 12px; font-weight: 600;">Odjel</th>';

    sortimentiNazivi.forEach(sortiment => {
        let bgColor, textColor = 'white';

        if (sortiment === 'SVEUKUPNO') {
            bgColor = '#dc2626'; // Red
        } else if (isLiscari(sortiment)) {
            bgColor = '#f59e0b'; // Orange za SVE lišćari
        } else if (isCetinari(sortiment)) {
            bgColor = '#059669'; // Green za SVE četinari
        } else {
            bgColor = '#6b7280'; // Gray za nepoznate
        }

        headerHtml += '<th style="background: ' + bgColor + '; color: ' + textColor + '; font-weight: 700; padding: 12px; text-align: right; min-width: 80px;">' + sortiment + '</th>';
    });
    headerHtml += '</tr>';
    headerElem.innerHTML = headerHtml;

    // Build body
    let bodyHtml = '';
    const totals = {};
    sortimentiNazivi.forEach(s => totals[s] = 0);

    data.forEach((row, index) => {
        const rowBg = index % 2 === 0 ? '#f9fafb' : 'white';
        bodyHtml += '<tr>';
        bodyHtml += '<td style="font-weight: 600; position: sticky; left: 0; background: ' + rowBg + '; z-index: 9; padding: 10px;">' + row.odjel + '</td>';

        sortimentiNazivi.forEach(sortiment => {
            const value = row.sortimenti[sortiment] || 0;
            totals[sortiment] += value;

            let bgColor = 'transparent', textColor = '#374151';

            if (value > 0) {
                if (sortiment === 'SVEUKUPNO') {
                    bgColor = '#fecaca'; // Light red
                    textColor = '#7f1d1d';
                } else if (sortiment === 'LIŠĆARI') {
                    bgColor = '#fbbf24'; // Medium amber - AGREGAT
                    textColor = '#78350f';
                } else if (sortiment === 'ČETINARI') {
                    bgColor = '#a7f3d0'; // Medium green - AGREGAT
                    textColor = '#065f46';
                } else if (isLiscari(sortiment)) {
                    bgColor = '#fed7aa'; // Light amber za SVE lišćari
                    textColor = '#78350f';
                } else if (isCetinari(sortiment)) {
                    bgColor = '#d1fae5'; // Light green za SVE četinari
                    textColor = '#065f46';
                }
            }

            const displayValue = value === 0 ? '' : value.toFixed(2);
            bodyHtml += '<td style="background: ' + bgColor + '; color: ' + textColor + '; font-weight: ' + (value > 0 ? '600' : '400') + '; padding: 10px; text-align: right;">' + displayValue + '</td>';
        });

        bodyHtml += '</tr>';
    });

    bodyElem.innerHTML = bodyHtml;
    console.log('[IZVJEŠTAJI FIX] ✅ Jednostavna verzija - SVE lišćari narandžaste, SVE četinari zelene');
};

console.log('[IZVJEŠTAJI FIX] ✅ Jednostavna fixed funkcija učitana');
