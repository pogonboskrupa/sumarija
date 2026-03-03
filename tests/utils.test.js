/**
 * Tests za utility funkcije
 * Izvor: js/utils.js
 *
 * Testira se:
 * - debounce(func, wait)
 * - throttle(func, limit)
 * - paginateTable(data, pageSize)
 * - SORTIMENTI_ORDER - 20 sortimenta u ispravnom poslovnom redoslijedu
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANE FUNKCIJE IZ js/utils.js =====

const SORTIMENTI_ORDER = [
    "F/L C", "I C", "II C", "III C", "RD", "TRUPCI C",
    "CEL.DUGA", "CEL.CIJEPANA", "SKART", "SUM CETINARI",
    "F/L L", "I L", "II L", "III L", "TRUPCI L",
    "OGR.DUGI", "OGR.CIJEPANI", "GULE", "LISCARI", "UKUPNO C+L"
];

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function paginateTable(data, pageSize = 100) {
    const pages = [];
    for (let i = 0; i < data.length; i += pageSize) {
        pages.push(data.slice(i, i + pageSize));
    }
    return pages;
}

// ===== TESTOVI =====

describe('SORTIMENTI_ORDER konstanta', () => {
    test('Ima tacno 20 sortimenta', () => {
        assert.equal(SORTIMENTI_ORDER.length, 20);
    });

    test('Pocetak je F/L C (cetinari)', () => {
        assert.equal(SORTIMENTI_ORDER[0], 'F/L C');
    });

    test('Kraj je UKUPNO C+L (ukupni zbir)', () => {
        assert.equal(SORTIMENTI_ORDER[19], 'UKUPNO C+L');
    });

    test('Suma cetinara je na poziciji 9 (indeks 9)', () => {
        assert.equal(SORTIMENTI_ORDER[9], 'SUM CETINARI');
    });

    test('Liscari sortimenti pocinju na poziciji 10 (F/L L)', () => {
        assert.equal(SORTIMENTI_ORDER[10], 'F/L L');
    });

    test('Nema duplikata', () => {
        const unique = new Set(SORTIMENTI_ORDER);
        assert.equal(unique.size, SORTIMENTI_ORDER.length);
    });
});

describe('paginateTable', () => {
    test('Prazni podaci vracaju prazan niz', () => {
        const result = paginateTable([], 10);
        assert.deepEqual(result, []);
    });

    test('Podaci manji od stranice - jedna stranica', () => {
        const data = [1, 2, 3, 4, 5];
        const result = paginateTable(data, 10);
        assert.equal(result.length, 1);
        assert.deepEqual(result[0], [1, 2, 3, 4, 5]);
    });

    test('Podaci tacno velicine stranice - jedna stranica', () => {
        const data = Array.from({ length: 10 }, (_, i) => i);
        const result = paginateTable(data, 10);
        assert.equal(result.length, 1);
        assert.equal(result[0].length, 10);
    });

    test('Podaci veci od stranice - ispravno paginira', () => {
        const data = Array.from({ length: 25 }, (_, i) => i);
        const result = paginateTable(data, 10);
        assert.equal(result.length, 3);
        assert.equal(result[0].length, 10);
        assert.equal(result[1].length, 10);
        assert.equal(result[2].length, 5);
    });

    test('100 redova, velicina stranice 100 - jedna stranica', () => {
        const data = Array.from({ length: 100 }, (_, i) => i);
        const result = paginateTable(data, 100);
        assert.equal(result.length, 1);
    });

    test('Defaultna velicina stranice je 100', () => {
        const data = Array.from({ length: 150 }, (_, i) => i);
        const result = paginateTable(data);
        assert.equal(result.length, 2);
        assert.equal(result[0].length, 100);
        assert.equal(result[1].length, 50);
    });

    test('Podaci su u ispravnom redoslijedu', () => {
        const data = ['a', 'b', 'c', 'd', 'e'];
        const result = paginateTable(data, 2);
        assert.deepEqual(result[0], ['a', 'b']);
        assert.deepEqual(result[1], ['c', 'd']);
        assert.deepEqual(result[2], ['e']);
    });

    test('Velicina stranice 1 - svaki element je zasebna stranica', () => {
        const data = [10, 20, 30];
        const result = paginateTable(data, 1);
        assert.equal(result.length, 3);
        assert.deepEqual(result[0], [10]);
        assert.deepEqual(result[1], [20]);
        assert.deepEqual(result[2], [30]);
    });
});

describe('debounce', () => {
    test('Funkcija se poziva nakon cekanja', (_, done) => {
        let callCount = 0;
        const debounced = debounce(() => { callCount++; }, 50);

        debounced();
        assert.equal(callCount, 0); // Jos nije pozvana

        setTimeout(() => {
            assert.equal(callCount, 1); // Sada je pozvana
            done();
        }, 100);
    });

    test('Visestruki pozivi debounce - samo zadnji se izvrsava', (_, done) => {
        let callCount = 0;
        let lastArg = null;
        const debounced = debounce((arg) => { callCount++; lastArg = arg; }, 50);

        debounced('prvi');
        debounced('drugi');
        debounced('treci');

        setTimeout(() => {
            assert.equal(callCount, 1, 'Samo jedan poziv treba biti izvrsena');
            assert.equal(lastArg, 'treci', 'Zadnji argument treba biti proslijedjen');
            done();
        }, 150);
    });

    test('Debounce resetira timer na svaki poziv', (_, done) => {
        let callCount = 0;
        const debounced = debounce(() => { callCount++; }, 100);

        debounced(); // t=0
        setTimeout(() => debounced(), 50);  // t=50ms, resetira timer
        setTimeout(() => debounced(), 100); // t=100ms, resetira opet

        setTimeout(() => {
            assert.equal(callCount, 0, 'Jos ne treba biti pozvana');
        }, 150);

        setTimeout(() => {
            assert.equal(callCount, 1, 'Sada treba biti pozvana jednom');
            done();
        }, 250);
    });
});

describe('throttle', () => {
    test('Funkcija se poziva odmah pri prvom pozivu', () => {
        let callCount = 0;
        const throttled = throttle(() => { callCount++; }, 100);

        throttled();
        assert.equal(callCount, 1);
    });

    test('Dupliki pozivi unutar limita se ignoriraju', () => {
        let callCount = 0;
        const throttled = throttle(() => { callCount++; }, 200);

        throttled();
        throttled();
        throttled();

        assert.equal(callCount, 1, 'Samo prvi poziv treba proci');
    });

    test('Poziv nakon isteka limita prolazi', (_, done) => {
        let callCount = 0;
        const throttled = throttle(() => { callCount++; }, 50);

        throttled(); // Prolazi (callCount=1)
        assert.equal(callCount, 1);

        setTimeout(() => {
            throttled(); // Treba proci jer je limit istekao (callCount=2)
            assert.equal(callCount, 2);
            done();
        }, 100);
    });
});
