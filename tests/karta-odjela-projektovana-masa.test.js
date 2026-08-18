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

// Stvaran oblik odgovora handleStanjeZaliha (apps-script/api-handlers.gs):
// svaki odjel objekat ima ukupnoProjekat (broj, već izračunat server-side kao
// projekat["UKUPNO Č+L"]), NE niz + posebno ime sortimenta "SVEUKUPNO".
function _projektovanaMasa(stanjeMap, gj, odjel) {
    if (!stanjeMap) return null;
    const od = stanjeMap.get(_normKey(gj + ' ' + odjel));
    if (!od) return null;
    const v = Number(od.ukupnoProjekat);
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

describe('_projektovanaMasa — čitanje ukupnoProjekat iz Stanje zaliha', () => {
    test('vraća ukupnoProjekat vrijednost kad odjel postoji u Stanju zaliha', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { odjel: 'RISOVAC KRUPA 64', ukupnoProjekat: 150 }]
        ]);
        assert.equal(_projektovanaMasa(stanjeMap, 'Risovac Krupa', '64'), 150);
    });

    test('vraća null kad stanjeMap nije učitan (keš prazan)', () => {
        assert.equal(_projektovanaMasa(null, 'Risovac Krupa', '64'), null);
    });

    test('vraća null kad odjel nema unos u Stanju zaliha', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { odjel: 'RISOVAC KRUPA 64', ukupnoProjekat: 150 }]
        ]);
        assert.equal(_projektovanaMasa(stanjeMap, 'Risovac Krupa', '73'), null);
    });

    test('vraća null kad ukupnoProjekat nedostaje (undefined → NaN)', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { odjel: 'RISOVAC KRUPA 64' }]
        ]);
        assert.equal(_projektovanaMasa(stanjeMap, 'Risovac Krupa', '64'), null);
    });

    test('vraća null kad je ukupnoProjekat 0 ili negativno (ne dijeliti sa 0/negativnim)', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { odjel: 'RISOVAC KRUPA 64', ukupnoProjekat: 0 }]
        ]);
        assert.equal(_projektovanaMasa(stanjeMap, 'Risovac Krupa', '64'), null);
    });

    test('odjel sa "P" sufiksom (prelazni, npr. "71P" iz godišnjeg plana) i dalje pogodi ključ bez P u Stanju zaliha', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 71', { odjel: 'RISOVAC KRUPA 71', ukupnoProjekat: 4998 }]
        ]);
        assert.equal(_projektovanaMasa(stanjeMap, 'Risovac Krupa', '71P'), 4998);
    });
});

describe('Status odjela — projektovana masa (Stanje zaliha) ima prioritet nad godišnjim planom', () => {
    test('odjel sa projektovanom masom manjom od plana može biti "posjeceno" i prije nego sječa dostigne plan.neto', () => {
        // Plan (godišnji) kaže neto=200, ali Stanje zaliha kaže da je realno
        // projektovano samo 100 (preciznija/ažurnija procjena) — 95 posječeno
        // treba biti "posjeceno" (95/100=95%), iako je 95/200=47.5% (bilo bi "u-sjeci").
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { odjel: 'RISOVAC KRUPA 64', ukupnoProjekat: 100 }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '64', neto: 200 };
        const r = _statusZaOdjel(stanjeMap, entry, 95);
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.masaIzvor, 'stanje-zaliha');
        assert.equal(r.ciljMasa, 100);
    });

    test('odjel sa VEĆOM projektovanom masom od plana (npr. višegodišnji prelazni odjel) ostaje "u-sjeci" umjesto lažno "posjeceno"', () => {
        // Ovo je stvarni prijavljeni bug: RISOVAC KRUPA 71 ima plan.neto=1655,
        // ali stvarni projekat (Stanje zaliha) je 4998 (kumulativ na više
        // godina) — sječa 1799.17 je 108% plana (lažno "posjeceno"), ali samo
        // 36% stvarnog projekta (ispravno "u-sjeci").
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 71', { odjel: 'RISOVAC KRUPA 71', ukupnoProjekat: 4998 }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '71P', neto: 1655 };
        const r = _statusZaOdjel(stanjeMap, entry, 1799.17);
        assert.equal(r.status, 'u-sjeci');
        assert.equal(r.masaIzvor, 'stanje-zaliha');
        assert.equal(r.ciljMasa, 4998);
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
            ['RISOVAC KRUPA 64', { odjel: 'RISOVAC KRUPA 64', ukupnoProjekat: 100 }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '64', neto: 200 };
        const r = _statusZaOdjel(stanjeMap, entry, 30); // 30/100 = 30%
        assert.equal(r.status, 'u-sjeci');
    });

    test('"planirano" (nedirnut odjel) ostaje ispravno klasifikovano', () => {
        const stanjeMap = new Map([
            ['RISOVAC KRUPA 64', { odjel: 'RISOVAC KRUPA 64', ukupnoProjekat: 100 }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '64', neto: 200 };
        const r = _statusZaOdjel(stanjeMap, entry, 0);
        assert.equal(r.status, 'planirano');
    });
});
