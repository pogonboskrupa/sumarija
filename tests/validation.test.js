/**
 * Tests za input validaciju forme (sjecnja/otprema)
 * Izvor: js/app.js linije 7549-7610 (validateFormData)
 *
 * Pravila validacije:
 * - Datum: obavezan, ne u buducnosti, ne stariji od 90 dana
 * - Odjel: obavezan
 * - Kolicina: bar jedna > 0, ne negativna, max 10.000 po sortimentu
 * - Ukupno: max 50.000
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANA VALIDACIJSKA LOGIKA IZ app.js =====
// Ociscena od DOM zavisnosti - prima podatke direktno kao argumente
function validateFormData({ datum, odjel, sortimenti = [], ukupno = 0 } = {}) {
    const errors = [];

    // 1. Datum validacija
    if (!datum) {
        errors.push('Datum je obavezan');
    } else {
        const datumDate = new Date(datum);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (datumDate > today) {
            errors.push('Datum ne moze biti u buducnosti');
        }
        // Ne stariji od 90 dana
        const minDate = new Date();
        minDate.setDate(minDate.getDate() - 90);
        if (datumDate < minDate) {
            errors.push('Datum ne moze biti stariji od 90 dana');
        }
    }

    // 2. Odjel validacija
    if (!odjel || odjel.trim() === '') {
        errors.push('Odaberi odjel');
    }

    // 3. Kolicina validacija
    let hasAnyValue = false;
    for (const val of sortimenti) {
        if (val < 0) {
            errors.push('Kolicina ne moze biti negativna');
            break;
        }
        if (val > 10000) {
            errors.push('Kolicina po sortimentu ne moze biti veca od 10.000 m3');
            break;
        }
        if (val > 0) hasAnyValue = true;
    }
    if (!hasAnyValue && errors.length === 0) {
        errors.push('Unesite barem jedan sortiment (kolicina > 0)');
    }

    // 4. Ukupno validacija
    if (ukupno > 50000) {
        errors.push('Ukupna kolicina prevelika (max 50.000 m3)');
    }

    return errors;
}

// Helper: format date as YYYY-MM-DD
function dateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

const TODAY = dateOffset(0);
const YESTERDAY = dateOffset(-1);
const DAYS_91_AGO = dateOffset(-91);
const DAYS_89_AGO = dateOffset(-89);
const TOMORROW = dateOffset(1);

const VALID_BASE = {
    datum: TODAY,
    odjel: 'Odjel 10',
    sortimenti: [0, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ukupno: 50
};

// ===== TESTOVI =====

describe('Input validacija forme', () => {

    describe('Datum validacija', () => {
        test('Validan datum (danas) prolazi', () => {
            const errors = validateFormData({ ...VALID_BASE, datum: TODAY });
            assert.equal(errors.length, 0);
        });

        test('Validan datum (jucer) prolazi', () => {
            const errors = validateFormData({ ...VALID_BASE, datum: YESTERDAY });
            assert.equal(errors.length, 0);
        });

        test('Validan datum (89 dana unazad) prolazi', () => {
            const errors = validateFormData({ ...VALID_BASE, datum: DAYS_89_AGO });
            assert.equal(errors.length, 0);
        });

        test('Nedostaje datum - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, datum: '' });
            assert.ok(errors.some(e => e.includes('obavezan')), `Ocekivana greska, dobijeno: ${errors}`);
        });

        test('null datum - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, datum: null });
            assert.ok(errors.some(e => e.includes('obavezan')));
        });

        test('Datum sutra - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, datum: TOMORROW });
            assert.ok(errors.some(e => e.includes('buducnosti')), `Ocekivana greska, dobijeno: ${errors}`);
        });

        test('Datum 91 dan unazad - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, datum: DAYS_91_AGO });
            assert.ok(errors.some(e => e.includes('90 dana')), `Ocekivana greska, dobijeno: ${errors}`);
        });
    });

    describe('Odjel validacija', () => {
        test('Validan odjel prolazi', () => {
            const errors = validateFormData({ ...VALID_BASE, odjel: 'Odjel 10' });
            assert.equal(errors.length, 0);
        });

        test('Prazan odjel - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, odjel: '' });
            assert.ok(errors.some(e => e.includes('odjel')));
        });

        test('Samo razmaci - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, odjel: '   ' });
            assert.ok(errors.some(e => e.includes('odjel')));
        });

        test('null odjel - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, odjel: null });
            assert.ok(errors.some(e => e.includes('odjel')));
        });
    });

    describe('Kolicina validacija', () => {
        test('Jedna vrijednost > 0 prolazi', () => {
            const errors = validateFormData({ ...VALID_BASE, sortimenti: [0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
            assert.equal(errors.length, 0);
        });

        test('Vise vrijednosti > 0 prolazi', () => {
            const errors = validateFormData({ ...VALID_BASE, sortimenti: [50, 100, 25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
            assert.equal(errors.length, 0);
        });

        test('Sve kolicine = 0 - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, sortimenti: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
            assert.ok(errors.some(e => e.includes('barem jedan')));
        });

        test('Negativna kolicina - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, sortimenti: [0, -5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
            assert.ok(errors.some(e => e.includes('negativna')));
        });

        test('Kolicina 10.001 po sortimentu - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, sortimenti: [0, 10001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
            assert.ok(errors.some(e => e.includes('10.000')));
        });

        test('Kolicina tocno 10.000 prolazi', () => {
            const errors = validateFormData({ ...VALID_BASE, sortimenti: [0, 10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
            assert.equal(errors.length, 0);
        });

        test('Prazan niz sortimenti - greska (nema vrijednosti)', () => {
            const errors = validateFormData({ ...VALID_BASE, sortimenti: [] });
            assert.ok(errors.some(e => e.includes('barem jedan')));
        });
    });

    describe('Ukupno validacija', () => {
        test('Ukupno 50.000 prolazi', () => {
            const errors = validateFormData({ ...VALID_BASE, ukupno: 50000 });
            assert.equal(errors.length, 0);
        });

        test('Ukupno 50.001 - greska', () => {
            const errors = validateFormData({ ...VALID_BASE, ukupno: 50001 });
            assert.ok(errors.some(e => e.includes('50.000')));
        });

        test('Ukupno 0 - nije greska za ukupno (greska je u sortimenti)', () => {
            const errors = validateFormData({ ...VALID_BASE, ukupno: 0 });
            // Ukupno 0 nije greska samo po sebi - greska dolazi iz sortimenti provjere
            assert.ok(!errors.some(e => e.includes('50.000')));
        });
    });

    describe('Kombinovane greske', () => {
        test('Vise gresaka odjednom su sve prijavljene', () => {
            const errors = validateFormData({
                datum: '',
                odjel: '',
                sortimenti: [0, 0, 0],
                ukupno: 0
            });
            // Ocekujemo gresku za datum i odjel (sortimenti ce javiti greski tek kad nema datuma/odjela gresaka)
            assert.ok(errors.length >= 2);
            assert.ok(errors.some(e => e.includes('obavezan')));
            assert.ok(errors.some(e => e.includes('odjel')));
        });

        test('Validan unos - nema gresaka', () => {
            const errors = validateFormData(VALID_BASE);
            assert.equal(errors.length, 0, `Ocekivano 0 gresaka, dobijeno: ${errors.join(', ')}`);
        });
    });

});
