/**
 * Tests za grupisanje ulova feromonskih klopki po vrsti potkornjaka
 * (js/karta-odjela.js, _renderKlopkePoVrsti — grouping/sort logika).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANA LOGIKA IZ _renderKlopkePoVrsti (js/karta-odjela.js) =====

function _grupisiPoVrsti(klopke) {
    const poVrsti = new Map();
    klopke.forEach(k => {
        const vrsta = (k.vrsta || '').trim() || 'Nepoznato';
        poVrsti.set(vrsta, (poVrsti.get(vrsta) || 0) + (parseInt(k.ulov, 10) || 0));
    });
    return [...poVrsti.entries()].sort((a, b) => b[1] - a[1]);
}

describe('_grupisiPoVrsti — ulov po vrsti potkornjaka', () => {
    test('sabira ulov istih vrsta preko više očitanja', () => {
        const klopke = [
            { vrsta: 'Ips typographus', ulov: 10 },
            { vrsta: 'Ips typographus', ulov: 25 },
            { vrsta: 'Pityogenes chalcographus', ulov: 5 },
        ];
        const r = _grupisiPoVrsti(klopke);
        assert.deepEqual(r, [['Ips typographus', 35], ['Pityogenes chalcographus', 5]]);
    });

    test('sortira opadajuće po ukupnom ulovu (najdominantnija vrsta prva)', () => {
        const klopke = [
            { vrsta: 'A', ulov: 3 },
            { vrsta: 'B', ulov: 50 },
            { vrsta: 'C', ulov: 12 },
        ];
        const r = _grupisiPoVrsti(klopke);
        assert.deepEqual(r.map(x => x[0]), ['B', 'C', 'A']);
    });

    test('prazna/nepostojeća vrsta pada pod "Nepoznato"', () => {
        const klopke = [{ vrsta: '', ulov: 4 }, { vrsta: '   ', ulov: 6 }];
        const r = _grupisiPoVrsti(klopke);
        assert.deepEqual(r, [['Nepoznato', 10]]);
    });

    test('neispravan (ne-brojevni) ulov se tretira kao 0, ne baca grešku', () => {
        const klopke = [{ vrsta: 'X', ulov: 'nije broj' }, { vrsta: 'X', ulov: 5 }];
        const r = _grupisiPoVrsti(klopke);
        assert.deepEqual(r, [['X', 5]]);
    });

    test('prazna lista klopki daje praznu listu grupa', () => {
        assert.deepEqual(_grupisiPoVrsti([]), []);
    });
});
