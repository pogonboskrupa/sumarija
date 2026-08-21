// Testovi za "Odaberi period (od-do)" na Sječa → Trendovi (js/app.js).
//
// Po konvenciji ovog projekta odluke iz app.js su OVDJE PREKOPIRANE (ne
// importovane) — app.js je jedan veliki fajl vezan za DOM/browser, pa se
// testira čista logika odlučivanja. Ako se pravila u app.js promijene,
// moraju se promijeniti i ovdje.

const test = require('node:test');
const assert = require('node:assert');

// --- kopija iz js/app.js: _parseDatumIso / _fmtDatumIso ---
function parseDatumIso(s) {
    const parts = String(s || '').split('-');
    if (parts.length !== 3) return null;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return isNaN(d.getTime()) ? null : d;
}
function fmtDatumIso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// --- kopija iz js/app.js: odluka o periodu u renderPrimaciTrendOverview ---
// (pojednostavljeno — _radnihDanaProzor je nepromijenjen postojeći fallback,
// ovdje predstavljen fiksnom vrijednošću da test ostane fokusiran na NOVU
// custom-period granu).
function odluciPeriod({ danaSelValue, odValue, doValue }, fallbackProzor) {
    if (danaSelValue === 'custom') {
        const od    = odValue ? parseDatumIso(odValue) : null;
        const danas = doValue ? parseDatumIso(doValue) : null;
        if (!od || !danas || od > danas) return fallbackProzor;
        return { od, danas };
    }
    return fallbackProzor;
}

const FALLBACK = { od: new Date(2026, 0, 1), danas: new Date(2026, 0, 7) };

test('_parseDatumIso / _fmtDatumIso', async (t) => {
    await t.test('parsira "YYYY-MM-DD" kao lokalni datum (ne UTC)', () => {
        const d = parseDatumIso('2026-03-15');
        assert.strictEqual(d.getFullYear(), 2026);
        assert.strictEqual(d.getMonth(), 2); // mart = index 2
        assert.strictEqual(d.getDate(), 15);
    });

    await t.test('fmtDatumIso je inverz parseDatumIso', () => {
        assert.strictEqual(fmtDatumIso(parseDatumIso('2026-03-05')), '2026-03-05');
    });

    await t.test('prazan/nevažeći string vraća null', () => {
        assert.strictEqual(parseDatumIso(''), null);
        assert.strictEqual(parseDatumIso('nije-datum'), null);
    });

    await t.test('padStart osigurava dvocifren mjesec/dan (npr. januar, 5.)', () => {
        assert.strictEqual(fmtDatumIso(new Date(2026, 0, 5)), '2026-01-05');
    });
});

test('Odluka o periodu — preset vs. prilagođeni (od-do)', async (t) => {
    await t.test('preset opcija (npr. "7") ignoriše od/do inpute, koristi fallback prozor', () => {
        const r = odluciPeriod({ danaSelValue: '7', odValue: '', doValue: '' }, FALLBACK);
        assert.strictEqual(r, FALLBACK);
    });

    await t.test('validan custom opseg (od <= do) se koristi direktno', () => {
        const r = odluciPeriod({ danaSelValue: 'custom', odValue: '2026-02-01', doValue: '2026-02-10' }, FALLBACK);
        assert.strictEqual(r.od.getTime(), new Date(2026, 1, 1).getTime());
        assert.strictEqual(r.danas.getTime(), new Date(2026, 1, 10).getTime());
    });

    await t.test('nepotpun opseg (nedostaje "do") pada na fallback prozor', () => {
        const r = odluciPeriod({ danaSelValue: 'custom', odValue: '2026-02-01', doValue: '' }, FALLBACK);
        assert.strictEqual(r, FALLBACK);
    });

    await t.test('nepotpun opseg (nedostaje "od") pada na fallback prozor', () => {
        const r = odluciPeriod({ danaSelValue: 'custom', odValue: '', doValue: '2026-02-10' }, FALLBACK);
        assert.strictEqual(r, FALLBACK);
    });

    await t.test('obrnut opseg ("od" poslije "do") pada na fallback prozor', () => {
        const r = odluciPeriod({ danaSelValue: 'custom', odValue: '2026-02-10', doValue: '2026-02-01' }, FALLBACK);
        assert.strictEqual(r, FALLBACK);
    });

    await t.test('isti datum za od i do je validan jednodnevni opseg', () => {
        const r = odluciPeriod({ danaSelValue: 'custom', odValue: '2026-02-05', doValue: '2026-02-05' }, FALLBACK);
        assert.strictEqual(r.od.getTime(), r.danas.getTime());
    });
});
