/**
 * Tests za stabilnu dodjelu "stranica" u Kubikatoru (rekap po 20 unosa =
 * jedna "stranica", isto kao u službenoj knjizi na terenu).
 * Izvor: js/kubikator.js (_trenutnaStranica, kubikatorDodaj, kubikatorObrisi)
 *
 * Bug koji ovo pokriva: stranice su se ranije računale ČISTO po poziciji u
 * nizu (_unosi.slice((s-1)*20, s*20)) — brisanje BILO KOG unosa je pomjeralo
 * sve iza njega na drugu stranicu, pa rekap po stranicama više nije
 * odgovarao onome što je stvarno upisano na toj fizičkoj stranici. Sada je
 * u.stranica TRAJNO svojstvo dodijeljeno u trenutku dodavanja i brisanje ga
 * ne mijenja.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const KUB_STRANICA_PRIMAC = 20;
const KUB_STRANICA_OTPREMAC = 29;

// ===== EXTRAKTOVANO IZ js/kubikator.js =====

// Kapacitet KONKRETNE stranice — iz unosa koji su na njoj, ne iz tekuce uloge.
function _kapacitetZaStranicu(unosi, brStr) {
    for (var i = 0; i < unosi.length; i++) {
        if ((unosi[i].stranica || 1) === brStr && unosi[i].kapacitet) return unosi[i].kapacitet;
    }
    return KUB_STRANICA_PRIMAC;   // stari zapisi su svi pisani po 20
}

function _trenutnaStranica(unosi) {
    if (!unosi.length) return 1;
    var zadnja = unosi[unosi.length - 1];
    var brStr = zadnja.stranica || 1;
    var brojUStranici = 0;
    for (var i = 0; i < unosi.length; i++) { if ((unosi[i].stranica || 1) === brStr) brojUStranici++; }
    return brojUStranici >= _kapacitetZaStranicu(unosi, brStr) ? brStr + 1 : brStr;
}

// Simulira niz poziva kubikatorDodaj — svaki novi unos dobija stranicu
// izračunatu PRIJE push-a, isto kao stvarna implementacija. `kapacitet` je
// kapacitet uloge koja unosi (20 primac / 29 otpremac).
function _dodaj(unosi, id, kapacitet) {
    var unos = {
        id: id,
        stranica: _trenutnaStranica(unosi),
        kapacitet: kapacitet || KUB_STRANICA_PRIMAC
    };
    unosi.push(unos);
    return unos;
}

function _obrisi(unosi, id) {
    return unosi.filter(function(u) { return u.id !== id; });
}

describe('_trenutnaStranica — dodjela pri dodavanju', () => {
    test('prvih 20 unosa ide na stranicu 1, 21. otvara stranicu 2', () => {
        var unosi = [];
        for (var i = 1; i <= 20; i++) _dodaj(unosi, i);
        assert.equal(unosi.every(u => u.stranica === 1), true);
        var dvadesetPrvi = _dodaj(unosi, 21);
        assert.equal(dvadesetPrvi.stranica, 2);
    });

    test('tačno KUB_STRANICA (20) unosa po stranici kroz više stranica', () => {
        var unosi = [];
        for (var i = 1; i <= 45; i++) _dodaj(unosi, i);
        var poStranici = {};
        unosi.forEach(u => { poStranici[u.stranica] = (poStranici[u.stranica] || 0) + 1; });
        assert.deepEqual(poStranici, { 1: 20, 2: 20, 3: 5 });
    });
});

describe('Kapacitet stranice po ulozi (primac 20 / otpremac 29)', () => {
    test('otpremac: prvih 29 unosa ide na stranicu 1, 30. otvara stranicu 2', () => {
        var unosi = [];
        for (var i = 1; i <= 29; i++) _dodaj(unosi, i, KUB_STRANICA_OTPREMAC);
        assert.equal(unosi.every(u => u.stranica === 1), true, '29 redova stane na jednu otpremnicu');
        var tridesetii = _dodaj(unosi, 30, KUB_STRANICA_OTPREMAC);
        assert.equal(tridesetii.stranica, 2);
    });

    test('otpremac: tacno 29 po stranici kroz vise stranica', () => {
        var unosi = [];
        for (var i = 1; i <= 65; i++) _dodaj(unosi, i, KUB_STRANICA_OTPREMAC);
        var poStranici = {};
        unosi.forEach(u => { poStranici[u.stranica] = (poStranici[u.stranica] || 0) + 1; });
        assert.deepEqual(poStranici, { 1: 29, 2: 29, 3: 7 });
    });

    test('primac ostaje na 20 — promjena za otpremaca ga ne dira', () => {
        var unosi = [];
        for (var i = 1; i <= 21; i++) _dodaj(unosi, i, KUB_STRANICA_PRIMAC);
        assert.equal(unosi.filter(u => u.stranica === 1).length, 20);
        assert.equal(unosi.find(u => u.id === 21).stranica, 2);
    });

    test('[KLJUCNO] vec ispisana stranica od 20 se NE produzava na 29', () => {
        // Otpremac koji je ranije unosio po starom pravilu (20/stranica): ta
        // stranica je vec prepisana na papir i predata, pa ne smije odjednom
        // primiti jos 9 redova — tek SLJEDECA stranica ide po 29.
        var unosi = [];
        for (var i = 1; i <= 20; i++) _dodaj(unosi, i, KUB_STRANICA_PRIMAC);
        var novi = _dodaj(unosi, 21, KUB_STRANICA_OTPREMAC);
        assert.equal(novi.stranica, 2, 'puna stranica od 20 se zatvara, ne dopunjava do 29');
        assert.equal(unosi.filter(u => u.stranica === 1).length, 20);

        // Nova stranica ide po novom kapacitetu (29)
        for (var j = 22; j <= 49; j++) _dodaj(unosi, j, KUB_STRANICA_OTPREMAC);
        assert.equal(unosi.filter(u => u.stranica === 2).length, 29);
        assert.equal(_dodaj(unosi, 50, KUB_STRANICA_OTPREMAC).stranica, 3);
    });

    test('stari zapisi bez kapaciteta se citaju kao 20', () => {
        var unosi = [];
        for (var i = 1; i <= 20; i++) unosi.push({ id: i, stranica: 1 }); // bez .kapacitet
        assert.equal(_kapacitetZaStranicu(unosi, 1), 20);
        assert.equal(_trenutnaStranica(unosi), 2, 'puna je po starom pravilu');
    });
});

describe('Brisanje NE smije pomjerati stranicu preostalih unosa (glavni bug)', () => {
    test('brisanje unosa sa stranice 1 ne mijenja stranicu unosa koji su bili na stranici 2', () => {
        var unosi = [];
        for (var i = 1; i <= 25; i++) _dodaj(unosi, i);
        // Unos #21 je prvi na stranici 2 (potvrda početnog stanja)
        var pre = unosi.find(u => u.id === 21);
        assert.equal(pre.stranica, 2);

        // Obriši unos #5 (na stranici 1)
        unosi = _obrisi(unosi, 5);

        var posle = unosi.find(u => u.id === 21);
        assert.equal(posle.stranica, 2, 'unos #21 mora ostati na stranici 2 i nakon brisanja sa stranice 1');
        // Stranica 1 sad ima 19 (ne 20) unosa — to je OČEKIVANO, ne "greška":
        // fizička stranica ostaje kraća, ne "krade" red sa sljedeće stranice.
        var brojNaStr1 = unosi.filter(u => u.stranica === 1).length;
        assert.equal(brojNaStr1, 19);
    });

    test('novi unos poslije brisanja na trenutnoj (nepunoj) stranici i dalje ide na istu stranicu', () => {
        var unosi = [];
        for (var i = 1; i <= 10; i++) _dodaj(unosi, i); // stranica 1, 10/20
        unosi = _obrisi(unosi, 5); // stranica 1 sad ima 9
        var novi = _dodaj(unosi, 99);
        assert.equal(novi.stranica, 1, 'nastavlja popunjavati istu (trenutnu) stranicu, ne otvara novu');
    });

    test('brisanje SVIH unosa sa trenutne stranice ne otvara pogrešno novu stranicu za sljedeći unos ako je ranija stranica prazna', () => {
        var unosi = [];
        for (var i = 1; i <= 20; i++) _dodaj(unosi, i); // stranica 1, puna
        _dodaj(unosi, 21); // otvara stranicu 2
        // Obriši JEDINI unos sa stranice 2
        unosi = _obrisi(unosi, 21);
        var novi = _dodaj(unosi, 22);
        // Stranica 1 je i dalje puna (20/20) — sljedeći unos ipak otvara
        // (novu) stranicu 2, ne vraća se da "puni" već zatvorenu stranicu 1.
        assert.equal(novi.stranica, 2);
    });
});
