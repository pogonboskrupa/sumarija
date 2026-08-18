/**
 * Tests za automatsko "završeno" kad odjel nije sječen duže od 14 dana
 * (js/karta-odjela.js, _buildStatusMap). Nije persistirano stanje — računa
 * se iznova iz datumKraja pri svakom učitavanju, pa nastavak sječe unutar
 * 14 dana sam od sebe vrati odjel na status po pct-u ("ponovna sječa = aktivan").
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const DAN_MS = 86400000;
const DANI_NEAKTIVNOSTI_ZAVRSENO = 14;

// Podskup logike iz _buildStatusMap: status po pct-u, pa automatsko
// "završeno" zbog neaktivnosti (referentni "sad" se prosljeđuje eksplicitno
// da test bude deterministički, umjesto oslanjanja na Date.now()).
function _statusZaOdjel(pct, datumKraja, now) {
    let status = pct >= 95 ? 'posjeceno' : pct > 5 ? 'u-sjeci' : 'planirano';

    let autoZavrseno = false;
    let danaNeaktivnosti = null;
    if (status !== 'posjeceno' && datumKraja) {
        danaNeaktivnosti = Math.floor((now.getTime() - datumKraja.getTime()) / DAN_MS);
        if (danaNeaktivnosti > DANI_NEAKTIVNOSTI_ZAVRSENO) {
            status = 'posjeceno';
            autoZavrseno = true;
        }
    }

    return { status, autoZavrseno, danaNeaktivnosti };
}

describe('Automatsko "završeno" — bez sječe duže od 14 dana', () => {
    const NOW = new Date('2026-08-18T12:00:00Z');

    test('"u sječi" (50%) bez aktivnosti 20 dana → "posjeceno" (autoZavrseno)', () => {
        const datumKraja = new Date('2026-07-29T00:00:00Z'); // 20 dana prije NOW
        const r = _statusZaOdjel(50, datumKraja, NOW);
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.autoZavrseno, true);
        assert.equal(r.danaNeaktivnosti, 20);
    });

    test('"u sječi" bez aktivnosti 10 dana → ostaje "u sječi" (ispod praga)', () => {
        const datumKraja = new Date('2026-08-08T12:00:00Z'); // 10 dana prije NOW
        const r = _statusZaOdjel(50, datumKraja, NOW);
        assert.equal(r.status, 'u-sjeci');
        assert.equal(r.autoZavrseno, false);
    });

    test('granica — tačno 14 dana NIJE "duže od 14" (strogo >), ostaje aktivan', () => {
        const datumKraja = new Date('2026-08-04T12:00:00Z'); // tačno 14 dana prije NOW
        const r = _statusZaOdjel(50, datumKraja, NOW);
        assert.equal(r.danaNeaktivnosti, 14);
        assert.equal(r.status, 'u-sjeci');
        assert.equal(r.autoZavrseno, false);
    });

    test('15 dana neaktivnosti već prelazi prag → "posjeceno"', () => {
        const datumKraja = new Date('2026-08-03T12:00:00Z'); // 15 dana prije NOW
        const r = _statusZaOdjel(50, datumKraja, NOW);
        assert.equal(r.danaNeaktivnosti, 15);
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.autoZavrseno, true);
    });

    test('"planirano" (2%, tek započeto pa napušteno) bez aktivnosti 30 dana → i dalje "posjeceno"', () => {
        const datumKraja = new Date('2026-07-19T12:00:00Z'); // 30 dana prije NOW
        const r = _statusZaOdjel(2, datumKraja, NOW);
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.autoZavrseno, true);
    });

    test('već prirodno "posjeceno" (98%) — auto-pravilo se ne dira (nema smisla, već gotovo)', () => {
        const datumKraja = new Date('2026-07-01T12:00:00Z'); // davno
        const r = _statusZaOdjel(98, datumKraja, NOW);
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.autoZavrseno, false); // već posjeceno po pct-u, ne po pravilu neaktivnosti
    });

    test('bez datumKraja (nikad sječeno) — auto-pravilo se ne primjenjuje, nema šta mjeriti', () => {
        const r = _statusZaOdjel(0, null, NOW);
        assert.equal(r.status, 'planirano');
        assert.equal(r.autoZavrseno, false);
        assert.equal(r.danaNeaktivnosti, null);
    });

    test('"ponovna sječa" — odjel ranije neaktivan 20 dana, nova sječa danas vraća ga na aktivan', () => {
        // Simulira ponovni izračun poslije novog primka unosa — datumKraja se
        // pomjerio na "danas", isti odjel/pct.
        const staro = _statusZaOdjel(50, new Date('2026-07-29T00:00:00Z'), NOW);
        assert.equal(staro.status, 'posjeceno');

        const novo = _statusZaOdjel(50, NOW, NOW); // sječa upravo danas
        assert.equal(novo.status, 'u-sjeci');
        assert.equal(novo.autoZavrseno, false);
    });
});
