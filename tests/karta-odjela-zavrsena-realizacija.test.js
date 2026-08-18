/**
 * Tests za ručni override "Završena realizacija" (js/karta-odjela.js) —
 * admin u modalu odjela može ručno potvrditi da je odjel gotov iako
 * automatski izračunata realizacija (sječa/projektovana masa) nikad ne
 * dostigne 95% (teren, procjena bila preoptimistična, itd.).
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

// Podskup logike iz _buildStatusMap: status po pct-u, pa ručni override.
function _statusZaOdjel(zavrseniMap, entry, sjecaUkupno, ciljMasa) {
    const key = _normKey(entry.gj + ' ' + entry.odjel);
    const pct = ciljMasa > 0 ? sjecaUkupno / ciljMasa * 100 : 0;
    let status = pct >= 95 ? 'posjeceno' : pct > 5 ? 'u-sjeci' : 'planirano';

    const zOverride = zavrseniMap && zavrseniMap.get(key);
    const rucnoZavrseno = !!(zOverride && zOverride.zavrseno);
    if (rucnoZavrseno) status = 'posjeceno';

    return { status, pct, rucnoZavrseno, rucnoZavrsenoOd: zOverride || null };
}

describe('Ručni override "Završena realizacija"', () => {
    test('override na true forsira status "posjeceno" iako je pct ispod 95%', () => {
        const zavrseniMap = new Map([
            ['RISOVAC KRUPA 71', { zavrseno: true, korisnik: 'Ivo Ivić', datum: '18.08.2026' }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '71P' };
        const r = _statusZaOdjel(zavrseniMap, entry, 1799.17, 4998);
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.rucnoZavrseno, true);
        assert.equal(r.rucnoZavrsenoOd.korisnik, 'Ivo Ivić');
        // pct i dalje odražava stvarnu realizaciju (36%) — override mijenja
        // samo status, ne i prikazani procenat (transparentnost za admina).
        assert.ok(Math.abs(r.pct - 36.0) < 0.1);
    });

    test('bez unosa u zavrseniMap — status ostaje po pct-u (nema override)', () => {
        const entry = { gj: 'Risovac Krupa', odjel: '71P' };
        const r = _statusZaOdjel(null, entry, 1799.17, 4998);
        assert.equal(r.status, 'u-sjeci');
        assert.equal(r.rucnoZavrseno, false);
        assert.equal(r.rucnoZavrsenoOd, null);
    });

    test('unos postoji ali zavrseno===false (oznaka uklonjena checkboxom) — nema override', () => {
        const zavrseniMap = new Map([
            ['RISOVAC KRUPA 71', { zavrseno: false, korisnik: 'Ivo Ivić', datum: '18.08.2026' }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '71P' };
        const r = _statusZaOdjel(zavrseniMap, entry, 1799.17, 4998);
        assert.equal(r.status, 'u-sjeci');
        assert.equal(r.rucnoZavrseno, false);
    });

    test('override ne mijenja status kad je odjel već prirodno "posjeceno" (idempotentno)', () => {
        const zavrseniMap = new Map([
            ['RISOVAC KRUPA 64', { zavrseno: true, korisnik: 'Ana Anić', datum: '01.01.2026' }]
        ]);
        const entry = { gj: 'Risovac Krupa', odjel: '64' };
        const r = _statusZaOdjel(zavrseniMap, entry, 4900, 5000); // 98% — već prirodno posjeceno
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.rucnoZavrseno, true);
    });

    test('"planirano" odjel (0% sječe) se override-om ipak forsira na "posjeceno"', () => {
        const zavrseniMap = new Map([
            ['GRMEC JASENICA 60', { zavrseno: true, korisnik: 'Mirko Mirković', datum: '05.05.2026' }]
        ]);
        const entry = { gj: 'Grmeč Jasenica', odjel: '60' };
        const r = _statusZaOdjel(zavrseniMap, entry, 0, 3000); // inače bi bilo "planirano"
        assert.equal(r.status, 'posjeceno');
        assert.equal(r.rucnoZavrseno, true);
    });

    test('override za JEDAN odjel ne utiče na susjedni odjel bez unosa u mapi', () => {
        const zavrseniMap = new Map([
            ['RISOVAC KRUPA 71', { zavrseno: true, korisnik: 'Ivo Ivić', datum: '18.08.2026' }]
        ]);
        const susjed = { gj: 'Risovac Krupa', odjel: '63' };
        const r = _statusZaOdjel(zavrseniMap, susjed, 500, 3339);
        assert.equal(r.status, 'u-sjeci');
        assert.equal(r.rucnoZavrseno, false);
    });
});
