/**
 * Tests za algoritam poklapanja poslovodja imena
 * Izvor: js/app.js linije 2213-2239
 *
 * Algoritam:
 * 1. Direktno poklapanje (case-insensitive)
 * 2. Normalized poklapanje: sortiraju se dijelovi imena pa se uporeduju
 *    -> "MARKO MARKOVIC" i "MARKOVIC MARKO" daju isti normalized string
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANA LOGIKA IZ app.js (linije 2225-2238) =====
// Cista (pure) funkcija bez browser zavisnosti
function matchName(fullName, mapping) {
    if (!fullName || typeof fullName !== 'string') return [];

    const upperName = fullName.toUpperCase().trim();

    // Direktno poklapanje
    if (mapping[upperName]) {
        return mapping[upperName];
    }

    // Normalized poklapanje: sortiraj dijelove imena i uporeduj
    const normalizedName = upperName.split(/\s+/).sort().join(' ');
    for (const key in mapping) {
        const normalizedKey = key.toUpperCase().trim().split(/\s+/).sort().join(' ');
        if (normalizedKey === normalizedName) {
            return mapping[key];
        }
    }

    return [];
}

// ===== TEST MAPPING (odgovara POSLOVODJA_RADILISTA_FALLBACK iz app.js) =====
const FULL_MAPPING = {
    'MEHMEDALIJA HARBAS': ['BJELAJSKE UVALE', 'VOJSKOVA'],
    'HARBAS MEHMEDALIJA': ['BJELAJSKE UVALE', 'VOJSKOVA'],
    'JASMIN PORIC': ['RADICKE UVALE'],
    'PORIC JASMIN': ['RADICKE UVALE'],
    'IRFAN HADZIPASIC': ['TURSKE VODE'],
    'HADZIPASIC IRFAN': ['TURSKE VODE']
};

// Mapping sa samo jednim redoslijedom - testira normalized fallback
const SINGLE_ORDER_MAPPING = {
    'MEHMEDALIJA HARBAS': ['BJELAJSKE UVALE', 'VOJSKOVA'],
    'JASMIN PORIC': ['RADICKE UVALE']
};

// ===== TESTOVI =====

describe('Poslovodja ime matching', () => {

    describe('Direktno poklapanje', () => {
        test('Tacno IME PREZIME vraca ispravna radilista', () => {
            assert.deepEqual(
                matchName('MEHMEDALIJA HARBAS', FULL_MAPPING),
                ['BJELAJSKE UVALE', 'VOJSKOVA']
            );
        });

        test('Tacno PREZIME IME vraca ispravna radilista', () => {
            assert.deepEqual(
                matchName('HARBAS MEHMEDALIJA', FULL_MAPPING),
                ['BJELAJSKE UVALE', 'VOJSKOVA']
            );
        });

        test('Jedno radiliste - IME PREZIME', () => {
            assert.deepEqual(
                matchName('JASMIN PORIC', FULL_MAPPING),
                ['RADICKE UVALE']
            );
        });

        test('Jedno radiliste - PREZIME IME', () => {
            assert.deepEqual(
                matchName('PORIC JASMIN', FULL_MAPPING),
                ['RADICKE UVALE']
            );
        });

        test('Trece ime - IRFAN HADZIPASIC', () => {
            assert.deepEqual(
                matchName('IRFAN HADZIPASIC', FULL_MAPPING),
                ['TURSKE VODE']
            );
        });
    });

    describe('Case-insensitive poklapanje', () => {
        test('Sva mala slova', () => {
            assert.deepEqual(
                matchName('mehmedalija harbas', FULL_MAPPING),
                ['BJELAJSKE UVALE', 'VOJSKOVA']
            );
        });

        test('Titlcase (Ime Prezime)', () => {
            assert.deepEqual(
                matchName('Jasmin Poric', FULL_MAPPING),
                ['RADICKE UVALE']
            );
        });

        test('Inverzni redoslijed + mala slova', () => {
            assert.deepEqual(
                matchName('poric jasmin', FULL_MAPPING),
                ['RADICKE UVALE']
            );
        });
    });

    describe('Normalized matching - obostrani redoslijed kroz sortiranje', () => {
        test('Obrnuti redoslijed pronalazi match kroz normalizaciju', () => {
            assert.deepEqual(
                matchName('HARBAS MEHMEDALIJA', SINGLE_ORDER_MAPPING),
                ['BJELAJSKE UVALE', 'VOJSKOVA']
            );
        });

        test('Mala slova + obrnuti redoslijed', () => {
            assert.deepEqual(
                matchName('harbas mehmedalija', SINGLE_ORDER_MAPPING),
                ['BJELAJSKE UVALE', 'VOJSKOVA']
            );
        });

        test('IME PREZIME pronalazi PREZIME IME kroz normalizaciju', () => {
            const onlyReverseMapping = { 'PORIC JASMIN': ['RADICKE UVALE'] };
            assert.deepEqual(
                matchName('JASMIN PORIC', onlyReverseMapping),
                ['RADICKE UVALE']
            );
        });
    });

    describe('Visestruki razmaci i bijeli znakovi', () => {
        test('Visestruki razmaci izmedju dijelova se ignoriraju', () => {
            assert.deepEqual(
                matchName('JASMIN   PORIC', FULL_MAPPING),
                ['RADICKE UVALE']
            );
        });

        test('Razmak na pocetku i kraju se ignorira', () => {
            assert.deepEqual(
                matchName('  IRFAN HADZIPASIC  ', FULL_MAPPING),
                ['TURSKE VODE']
            );
        });
    });

    describe('Edge cases', () => {
        test('Nepoznato ime vraca prazan niz', () => {
            assert.deepEqual(matchName('NEPOZNATO IME', FULL_MAPPING), []);
        });

        test('Prazna string vraca prazan niz', () => {
            assert.deepEqual(matchName('', FULL_MAPPING), []);
        });

        test('null vraca prazan niz', () => {
            assert.deepEqual(matchName(null, FULL_MAPPING), []);
        });

        test('undefined vraca prazan niz', () => {
            assert.deepEqual(matchName(undefined, FULL_MAPPING), []);
        });

        test('Prazan mapping vraca prazan niz', () => {
            assert.deepEqual(matchName('JASMIN PORIC', {}), []);
        });
    });

});
