/**
 * Tests za klasifikaciju ne-planiranih odjela u js/karta-odjela.js
 * (SANITAR/ZAPISNIK/SLUCAJNI/prelazni) — _baseKey generalizacija i
 * _nonPlanKategorija prioritet.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANE FUNKCIJE IZ js/karta-odjela.js =====

function _normKey(s) {
    return String(s || '').trim().toUpperCase()
        .replace(/Č/g, 'C').replace(/Ć/g, 'C')
        .replace(/Š/g, 'S').replace(/Ž/g, 'Z').replace(/Đ/g, 'DJ')
        .replace(/P\s*$/, '')
        .replace(/\/\d+\s*$/, '')
        .trim();
}

const _baseKey = k => k
    .replace(/[\s(]+SLUCAJNI.*/, '').replace(/[\s(]+SLUCAJAN.*/, '')
    .replace(/[\s(]+SANITAR.*/, '').replace(/[\s(]+ZAPISNIK.*/, '')
    .trim();

function _klasifikujOdjel(k, sanitarSet, zapisnikSet, slucajniSet, prelazniSet) {
    // Reproducira petlju iz _buildStatusMap (prioritet SANITAR > ZAPISNIK > SLUCAJNI > prelazni)
    const bk = _baseKey(k);
    if (k.includes('SANITAR')) { sanitarSet.add(bk); return 'sanitar'; }
    if (k.includes('ZAPISNIK')) { zapisnikSet.add(bk); return 'zapisnik'; }
    if (k.includes('SLUCAJNI') || k.includes('SLUCAJAN')) { slucajniSet.add(bk); return 'slucajni'; }
    prelazniSet.add(bk);
    return 'prelazni';
}

function _nonPlanKategorija(key, sanitarSet, zapisnikSet, slucajniSet, prelazniSet) {
    if (sanitarSet.has(key)) return 'sanitar';
    if (zapisnikSet.has(key)) return 'zapisnik';
    if (slucajniSet.has(key)) return 'slucajni';
    if (prelazniSet.has(key)) return 'prelazni';
    return 'bez-plana';
}

describe('_baseKey — strip SANITAR/ZAPISNIK sufiksa (uz postojeći SLUCAJNI)', () => {
    test('"104 SANITARNA SJECA" -> "104"', () => {
        assert.equal(_baseKey(_normKey('104 SANITARNA SJECA')), '104');
    });
    test('"104 SANITAR" -> "104"', () => {
        assert.equal(_baseKey(_normKey('104 SANITAR')), '104');
    });
    test('"104 ZAPISNIK" -> "104"', () => {
        assert.equal(_baseKey(_normKey('104 ZAPISNIK')), '104');
    });
    test('"104 (ZAPISNIK 2025)" -> "104"', () => {
        assert.equal(_baseKey(_normKey('104 (ZAPISNIK 2025)')), '104');
    });
    test('postojeći SLUCAJNI slučajevi i dalje rade nepromijenjeno', () => {
        assert.equal(_baseKey(_normKey('64 SLUCAJNI UZICI')), '64');
        assert.equal(_baseKey(_normKey('64 (SLUCAJNI 2025)')), '64');
    });
    test('obično ime odjela (bez ključne riječi) ostaje nepromijenjeno', () => {
        assert.equal(_baseKey(_normKey('Risovac Krupa 73')), 'RISOVAC KRUPA 73');
    });
});

describe('_nonPlanKategorija — prioritet SANITAR > ZAPISNIK > SLUCAJNI > prelazni', () => {
    test('SANITAR ima prioritet nad SLUCAJNI kad se oba pojave u istom nazivu', () => {
        const sanitarSet = new Set(), zapisnikSet = new Set(), slucajniSet = new Set(), prelazniSet = new Set();
        const kat = _klasifikujOdjel(_normKey('104 SANITARNA SJECA SLUCAJNI'), sanitarSet, zapisnikSet, slucajniSet, prelazniSet);
        assert.equal(kat, 'sanitar');
        assert.ok(sanitarSet.has('104'));
        assert.ok(!slucajniSet.has('104'));
    });

    test('svaka kategorija se klasifikuje nezavisno za različite odjele', () => {
        const sanitarSet = new Set(), zapisnikSet = new Set(), slucajniSet = new Set(), prelazniSet = new Set();
        _klasifikujOdjel(_normKey('10 SANITARNA SJECA'), sanitarSet, zapisnikSet, slucajniSet, prelazniSet);
        _klasifikujOdjel(_normKey('20 ZAPISNIK'), sanitarSet, zapisnikSet, slucajniSet, prelazniSet);
        _klasifikujOdjel(_normKey('30 SLUCAJNI UZICI'), sanitarSet, zapisnikSet, slucajniSet, prelazniSet);
        _klasifikujOdjel(_normKey('Vojskova 40'), sanitarSet, zapisnikSet, slucajniSet, prelazniSet);

        assert.equal(_nonPlanKategorija('10', sanitarSet, zapisnikSet, slucajniSet, prelazniSet), 'sanitar');
        assert.equal(_nonPlanKategorija('20', sanitarSet, zapisnikSet, slucajniSet, prelazniSet), 'zapisnik');
        assert.equal(_nonPlanKategorija('30', sanitarSet, zapisnikSet, slucajniSet, prelazniSet), 'slucajni');
        assert.equal(_nonPlanKategorija(_baseKey(_normKey('Vojskova 40')), sanitarSet, zapisnikSet, slucajniSet, prelazniSet), 'prelazni');
    });

    test('nepoznat ključ (nije ni u jednom Setu) vraća "bez-plana"', () => {
        const prazan = new Set();
        assert.equal(_nonPlanKategorija('999', prazan, prazan, prazan, prazan), 'bez-plana');
    });
});

describe('data/odjeli.geojson — nema stvarnog odjela čiji naziv sadrži SANITAR/ZAPISNIK kao dio imena', () => {
    test('nula false-positive kolizija sa novim _baseKey stripom', () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const geojsonPath = path.join(__dirname, '..', 'data', 'odjeli.geojson');
        const raw = fs.readFileSync(geojsonPath, 'utf8');
        const geojson = JSON.parse(raw);
        const nazivi = new Set();
        (geojson.features || []).forEach(f => {
            const p = (f && f.properties) || {};
            const naziv = String(p.odjel || p.name || '').trim();
            if (naziv) nazivi.add(naziv);
        });
        const sumnjivi = [...nazivi].filter(n => /SANITAR|ZAPISNIK/i.test(n));
        assert.deepEqual(sumnjivi, []);
    });
});
