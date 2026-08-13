/**
 * Tests za "round half up" zaokruživanje u Kubikatoru
 * Izvor: js/kubikator.js (_roundHalfUp, _fmt), js/print-utils.js (fmt2)
 *
 * toLocaleString/toFixed zaokružuju na osnovu STVARNE binarne reprezentacije
 * broja, ne "matematičke" decimalne vrijednosti — npr. 0,345 se u memoriji
 * čuva kao 0,34499999999999997, pa standardno zaokruživanje zna pogrešno
 * otići na dolje (0,34 umjesto očekivanog 0,35 kad je treća decimala 5).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANE FUNKCIJE IZ js/kubikator.js =====

function _roundHalfUp(v, dec) {
    var p = Math.pow(10, dec);
    return Math.round(v * p * (1 + Number.EPSILON)) / p;
}

function _fmt(v, dec) {
    return _roundHalfUp(Number(v), dec).toLocaleString('de-DE', {
        minimumFractionDigits: dec, maximumFractionDigits: dec
    });
}

function _zapremina(precnik, duzina) {
    return (Math.PI / 4) * Math.pow(precnik / 100, 2) * duzina;
}

describe('_roundHalfUp — treca decimala 5 zaokruzuje na vecu', () => {
    test('0,345 -> 0,35 (klasican JS toFixed bug: 0.345 je zapravo 0.34499...)', () => {
        assert.equal(_roundHalfUp(0.345, 2), 0.35);
    });

    test('0,005 -> 0,01', () => {
        assert.equal(_roundHalfUp(0.005, 2), 0.01);
    });

    test('1,005 -> 1,01', () => {
        assert.equal(_roundHalfUp(1.005, 2), 1.01);
    });

    test('2,675 -> 2,68', () => {
        assert.equal(_roundHalfUp(2.675, 2), 2.68);
    });

    test('99,995 -> 100,00 (prenosi se preko granice decimale)', () => {
        assert.equal(_roundHalfUp(99.995, 2), 100);
    });

    test('brojevi bez granicne treće decimale ostaju nepromijenjeni', () => {
        assert.equal(_roundHalfUp(0.344, 2), 0.34);
        assert.equal(_roundHalfUp(0.346, 2), 0.35);
        assert.equal(_roundHalfUp(3.14159, 2), 3.14);
    });
});

describe('_fmt — prikaz sa zarezom kao decimalnim separatorom', () => {
    test('0,345 m3 prikazuje "0,35"', () => {
        assert.equal(_fmt(0.345, 2), '0,35');
    });

    test('nula prikazuje "0,00"', () => {
        assert.equal(_fmt(0, 2), '0,00');
    });
});

describe('_roundHalfUp na stvarnim Huberovim zapreminama (granica .xx5)', () => {
    // Precnik/duzina kombinacije cija zapremina (Huberova formula) pada tacno
    // na granicu trece decimale = 5 — provjerava da se zaokruzivanje ponasa
    // ispravno i na stvarno izracunatim (ne rucno upisanim) brojevima.
    const slucajevi = [
        { precnik: 9, duzina: 3.93, ocekivano: '0,03' },
        { precnik: 10, duzina: 1.91, ocekivano: '0,02' },
        { precnik: 12, duzina: 8.40, ocekivano: '0,10' },
        { precnik: 17, duzina: 7.71, ocekivano: '0,18' },
    ];
    slucajevi.forEach(({ precnik, duzina, ocekivano }) => {
        test(`precnik=${precnik}cm, duzina=${duzina}m -> ${ocekivano} m3`, () => {
            const v = _zapremina(precnik, duzina);
            assert.equal(_fmt(v, 2), ocekivano);
        });
    });
});
