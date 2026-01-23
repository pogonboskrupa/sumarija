// 🔧 FIKSIRANA VERZIJA - Izvještaji tabele render funkcija
// Ova funkcija ZAMENJUJE postojeću renderIzvjestajiTable funkciju

// UPOTREBA: Dodaj ovu liniju na početak renderIzvjestajiTable funkcije:
// if (window.renderIzvjestajiTableFixed) return window.renderIzvjestajiTableFixed(data, sortimentiNazivi, tip);

window.renderIzvjestajiTableFixed = function(data, sortimentiNazivi, tip) {
    const headerElem = document.getElementById('izvjestaji-' + tip + '-header');
    const bodyElem = document.getElementById('izvjestaji-' + tip + '-body');

    if (data.length === 0) {
        headerElem.innerHTML = '';
        bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za odabrani mjesec</td></tr>';
        return;
    }

    // Build header - SVI stilovi inline, BEZ klasa
    let headerHtml = '<tr><th style="position: sticky; left: 0; background: #f9fafb; z-index: 20; min-width: 200px; padding: 12px; font-weight: 600;">Odjel</th>';

    sortimentiNazivi.forEach(sortiment => {
        let bgColor = '#3b82f6'; // Default blue
        let textColor = 'white';

        // Eksplicitno definiši boju za SVAKI sortiment
        if (sortiment === 'ČETINARI') {
            bgColor = '#059669';
        } else if (sortiment === 'LIŠĆARI') {
            bgColor = '#f59e0b';
        } else if (sortiment === 'SVEUKUPNO') {
            bgColor = '#dc2626';
        } else if (sortiment === 'TRUPCI' || sortiment === 'TRUPCI Č' || sortiment === 'TRUPCI L') {
            bgColor = '#ea580c'; // Darker orange za TRUPCI
        } else if (sortiment.includes('F/L') && sortiment.includes('L')) {
            bgColor = '#f59e0b'; // Orange za F/L L
        } else if (sortiment.includes('I L') || sortiment.includes('II L') || sortiment.includes('III L')) {
            bgColor = '#f59e0b'; // Orange za I/II/III L
        } else if (sortiment.includes('OGR.')) {
            bgColor = '#f59e0b'; // Orange za OGR
        } else if (sortiment.includes('CEL.')) {
            bgColor = '#059669'; // Green za CEL
        } else if (sortiment.includes('Č')) {
            bgColor = '#059669'; // Green za četinari
        }

        headerHtml += '<th style="background: ' + bgColor + '; color: ' + textColor + '; font-weight: 700; padding: 12px; text-align: right; min-width: 80px; border: 1px solid rgba(0,0,0,0.1);">' + sortiment + '</th>';
    });
    headerHtml += '</tr>';
    headerElem.innerHTML = headerHtml;

    // Build body - SVI stilovi inline, BEZ klasa
    let bodyHtml = '';
    const totals = {};
    sortimentiNazivi.forEach(s => totals[s] = 0);

    data.forEach((row, index) => {
        const rowBg = index % 2 === 0 ? '#f9fafb' : 'white';
        bodyHtml += '<tr>';
        bodyHtml += '<td style="font-weight: 600; position: sticky; left: 0; background: ' + rowBg + '; z-index: 9; padding: 10px; border: 1px solid #e5e7eb;">' + row.odjel + '</td>';

        sortimentiNazivi.forEach(sortiment => {
            const value = row.sortimenti[sortiment] || 0;
            totals[sortiment] += value;

            let bgColor = 'transparent';
            let textColor = '#374151';

            // Eksplicitno definiši boju za SVAKI sortiment
            if (value > 0) {
                if (sortiment === 'ČETINARI') {
                    bgColor = '#d1fae5';
                    textColor = '#065f46';
                } else if (sortiment === 'LIŠĆARI') {
                    bgColor = '#fbbf24';
                    textColor = '#78350f';
                } else if (sortiment === 'SVEUKUPNO') {
                    bgColor = '#fecaca';
                    textColor = '#7f1d1d';
                } else if (sortiment === 'TRUPCI' || sortiment === 'TRUPCI Č' || sortiment === 'TRUPCI L') {
                    bgColor = '#fbbf24'; // Medium amber za TRUPCI
                    textColor = '#78350f';
                } else if (sortiment.includes('F/L') && sortiment.includes('L')) {
                    bgColor = '#fed7aa'; // Light amber za F/L L
                    textColor = '#78350f';
                } else if (sortiment.includes('I L') || sortiment.includes('II L') || sortiment.includes('III L')) {
                    bgColor = '#fed7aa'; // Light amber
                    textColor = '#78350f';
                } else if (sortiment.includes('OGR.')) {
                    bgColor = '#fed7aa'; // Light amber
                    textColor = '#78350f';
                } else if (sortiment.includes('CEL.')) {
                    bgColor = '#d1fae5'; // Light green
                    textColor = '#065f46';
                } else if (sortiment.includes('Č')) {
                    bgColor = '#d1fae5'; // Light green za četinari
                    textColor = '#065f46';
                }
            }

            const displayValue = value === 0 ? '' : value.toFixed(2);
            bodyHtml += '<td style="background: ' + bgColor + '; color: ' + textColor + '; font-weight: ' + (value > 0 ? '600' : '400') + '; padding: 10px; text-align: right; border: 1px solid #e5e7eb; min-width: 80px;">' + displayValue + '</td>';
        });

        bodyHtml += '</tr>';
    });

    bodyElem.innerHTML = bodyHtml;
    console.log('[IZVJEŠTAJI FIX] ✅ Table rendered with fixed styles');
};

console.log('[IZVJEŠTAJI FIX] ✅ Fixed render function loaded');
