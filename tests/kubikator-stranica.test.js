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

const KUB_STRANICA = 20;

// ===== EXTRAKTOVANO IZ js/kubikator.js =====

function _trenutnaStranica(unosi) {
    if (!unosi.length) return 1;
    var zadnja = unosi[unosi.length - 1];
    var brStr = zadnja.stranica || 1;
    var brojUStranici = 0;
    for (var i = 0; i < unosi.length; i++) { if ((unosi[i].stranica || 1) === brStr) brojUStranici++; }
    return brojUStranici >= KUB_STRANICA ? brStr + 1 : brStr;
}

// Simulira niz poziva kubikatorDodaj — svaki novi unos dobija stranicu
// izračunatu PRIJE push-a, isto kao stvarna implementacija.
function _dodaj(unosi, id) {
    var unos = { id: id, stranica: _trenutnaStranica(unosi) };
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
