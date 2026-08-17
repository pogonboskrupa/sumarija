/**
 * Tests za "gotovo" (posjeceno) status odjela na osnovu projektovane mase
 * iz Stanje zaliha, umjesto godišnjeg plana (js/karta-odjela.js).
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

function _projektovanaMasa(stanjeMap, gj, odjel) {
    if (!stanjeMap) return null;
    const od = stanjeMap.get(_normKey(gj + ' ' + odjel));
    if (!od || !od.projekat || !od.projekat.length) return null;
    const idx = (od.sortimentiNazivi || []).findIndex(s => s === 'SVEUKUPNO');
    if (idx < 0) return null;
    const v = Number(od.projekat[idx]);
    return (!isNaN(v) && v > 0) ? v : null;
}

function _statusZaOdjel(stanjeMap, entry, sjecaUkupno) {
    const projMasa  = _projektovanaMasa(stanjeMap, entry.gj, entry.odjel);
    const ciljMasa  = projMasa != null ? projMasa : entry.neto;
    const masaIzvor = projMasa != null ? 'stanje-zaliha' : 'plan';
    const pct    = ciljMasa > 0 ? sjecaUkupno / ciljMasa * 100 : 0;
    const status = pct >= 95 ? 'posjeceno' : pct > 5 ? 'u-sjeci' : 'planirano';
    return { status, pct, ciljMasa, masaIzvor };
}

describe('_projektovanaMasa — čitanje SVEUKUPNO iz Stanje zaliha', () => {
    test('vraća SVEUKUPNO vrijednost kad odjel postoji u Stanju zaliha', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { projekat: [100, 50, 150], sortimentiNazivi: ['ČETINARI', 'LIŠĆARI', 'SVEUKUPNO'] }]
        ]);
        assert.equal(_projektovanaMasa(stanjeMap, 'Risovac Krupa', '64'), 150);
    });

    test('vraća null kad stanjeMap nije učitan (keš prazan)', () => {
        assert.equal(_projektovanaMasa(null, 'Risovac Krupa', '64'), null);
    });

    test('vraća null kad odjel nema unos u Stanju zaliha', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { projekat: [100, 50, 150], sortimentiNazivi: ['ČETINARI', 'LIŠĆARI', 'SVEUKUPNO'] }]
        ]);
        assert.equal(_projektovanaMasa(stanjeMap, 'Risovac Krupa', '73'), null);
    });

    test('vraća null kad SVEUKUPNO nedostaje u sortimentiNazivi', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { projekat: [100, 50], sortimentiNazivi: ['ČETINARI', 'LIŠĆARI'] }]
        ]);
        assert.equal(_projektovanaMasa(stanjeMap, 'Risovac Krupa', '64'), null);
    });

    test('vraća null kad je SVEUKUPNO 0 ili negativno (ne dijeliti sa 0/negativnim)', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { projekat: [0, 0, 0], sortimentiNazivi: ['ČETINARI', 'LIŠĆARI', 'SVEUKUPNO'] }]
        ]);
        assert.equal(_projektovanaMasa(stanjeMap, 'Risovac Krupa', '64'), null);
    });
});

describe('Status odjela — projektovana masa (Stanje zaliha) ima prioritet nad godišnjim planom', () => {
    test('odjel sa projektovanom masom manjom od plana može biti "posjeceno" i prije nego sječa dostigne plan.neto', () => {
        // Plan (godišnji) kaže neto=200, ali Stanje zaliha kaže da je realno
        // projektovano samo 100 (preciznija/ažurnija procjena) — 95 posječeno
        // treba biti "posjeceno" (95/100=95%), iako je 95/200=47.5% (bilo bi "u-sjeci").
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { projekat: [100], sortimentiNazivi: ['SVEUKUPNO'] }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '64', neto: 200 };
        const r = _statusZaOdjel(stanjeMap, entry, 95);
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.masaIzvor, 'stanje-zaliha');
        assert.equal(r.ciljMasa, 100);
    });

    test('fallback na godišnji plan (entry.neto) kad odjel nema unos u Stanju zaliha', () => {
        const entry = { gj: 'Risovac Krupa', odjel: '99', neto: 100 };
        const r = _statusZaOdjel(null, entry, 95);
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.masaIzvor, 'plan');
        assert.equal(r.ciljMasa, 100);
    });

    test('"u-sjeci" ostaje ispravno klasifikovano sa novim izvorom mase', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { projekat: [100], sortimentiNazivi: ['SVEUKUPNO'] }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '64', neto: 200 };
        const r = _statusZaOdjel(stanjeMap, entry, 30); // 30/100 = 30%
        assert.equal(r.status, 'u-sjeci');
    });

    test('"planirano" (nedirnut odjel) ostaje ispravno klasifikovano', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { projekat: [100], sortimentiNazivi: ['SVEUKUPNO'] }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '64', neto: 200 };
        const r = _statusZaOdjel(stanjeMap, entry, 0);
        assert.equal(r.status, 'planirano');
    });
});
