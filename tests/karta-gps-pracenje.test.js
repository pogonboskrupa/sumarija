// Testovi za "Moja lokacija" na Karta tabu (js/mapa-radnika.js) — praćenje
// plave tačke i auto-centriranje mape su razdvojena stanja.
//
// Po konvenciji ovog projekta logika je OVDJE PREKOPIRANA (ne importovana) —
// mapa-radnika.js je IIFE vezan za Leaflet/DOM. Ako se prelazi stanja u
// mapa-radnika.js promijene, moraju se promijeniti i ovdje.

const test = require('node:test');
const assert = require('node:assert');

// --- model stanja iz js/mapa-radnika.js ---
function noviGps() {
    return { lokacijaAktivna: false, followMode: false, hintPrikazan: false, panPoziva: 0 };
}

// _locateMe() — tap na dugme
function tap(s) {
    if (s.lokacijaAktivna && s.followMode) {          // gasi sve
        return { ...s, lokacijaAktivna: false, followMode: false };
    }
    if (s.lokacijaAktivna && !s.followMode) {         // pauzirano -> centriraj i nastavi
        return { ...s, followMode: true };
    }
    return { ...s, lokacijaAktivna: true, followMode: true }; // prvo uključivanje
}

// _pauzirajFollow() — korisnik pomjerio/zumirao mapu
function korisnikPomjerio(s, opts) {
    const o = opts || {};
    if (o.programskiPomjeraj) return s;   // naš vlastiti pomjeraj, ne korisnikov
    if (!s.followMode) return s;
    return { ...s, followMode: false, hintPrikazan: s.hintPrikazan || o.tiho !== true };
}

// GPS fix stigao — tačka se UVIJEK ažurira, mapa se centrira samo u follow-u
function gpsFix(s) {
    if (!s.lokacijaAktivna) return { ...s, tackaAzurirana: false };
    return { ...s, tackaAzurirana: true, panPoziva: s.panPoziva + (s.followMode ? 1 : 0) };
}

// Samo dva naziva — "Moja lokacija" ionako znaci "centriraj na mene", pa
// pauzirano stanje ne treba svoj treci izraz za istu radnju.
function labelDugmeta(s) {
    return (s.lokacijaAktivna && s.followMode) ? 'Prati me' : 'Moja lokacija';
}

test('Osnovni ciklus dugmeta "Moja lokacija"', async (t) => {
    await t.test('prvi tap uključuje i praćenje i centriranje', () => {
        const s = tap(noviGps());
        assert.strictEqual(s.lokacijaAktivna, true);
        assert.strictEqual(s.followMode, true);
        assert.strictEqual(labelDugmeta(s), 'Prati me');
    });

    await t.test('tap dok centriranje radi gasi lokaciju u potpunosti', () => {
        const s = tap(tap(noviGps()));
        assert.strictEqual(s.lokacijaAktivna, false);
        assert.strictEqual(s.followMode, false);
        assert.strictEqual(labelDugmeta(s), 'Moja lokacija');
    });
});

test('Skrolanje dalje NE prekida praćenje (prijavljeni problem)', async (t) => {
    await t.test('pan gasi centriranje, ali lokacija ostaje aktivna', () => {
        const s = korisnikPomjerio(tap(noviGps()));
        assert.strictEqual(s.followMode, false, 'centriranje se mora ugasiti');
        assert.strictEqual(s.lokacijaAktivna, true, 'praćenje NE smije stati');
        assert.strictEqual(labelDugmeta(s), 'Moja lokacija');
    });

    await t.test('plava tačka se i dalje ažurira nakon skrolanja', () => {
        const poslijePana = korisnikPomjerio(tap(noviGps()));
        const s = gpsFix(poslijePana);
        assert.strictEqual(s.tackaAzurirana, true, 'tačka mora pratiti kretanje');
    });

    await t.test('mapa se NE vraća na korisnika nakon skrolanja', () => {
        // Ovo je suština zahtjeva: nekoliko GPS fixeva poslije pana, nijedan
        // ne smije pomjeriti pogled.
        let s = korisnikPomjerio(tap(noviGps()));
        s = gpsFix(gpsFix(gpsFix(s)));
        assert.strictEqual(s.panPoziva, 0, 'nijedno auto-centriranje poslije pana');
    });

    await t.test('dok centriranje radi, mapa se vraća na svaki fix', () => {
        let s = tap(noviGps());
        s = gpsFix(gpsFix(s));
        assert.strictEqual(s.panPoziva, 2);
    });

    await t.test('zoom se ponaša isto kao pan', () => {
        const s = korisnikPomjerio(tap(noviGps()));
        assert.strictEqual(s.followMode, false);
        assert.strictEqual(s.lokacijaAktivna, true);
    });
});

test('Povratak na sebe (tap na "Moja lokacija" dok je pauzirano)', async (t) => {
    await t.test('vraća centriranje bez gašenja i ponovnog paljenja GPS-a', () => {
        const s = tap(korisnikPomjerio(tap(noviGps())));
        assert.strictEqual(s.followMode, true);
        assert.strictEqual(s.lokacijaAktivna, true, 'GPS je cijelo vrijeme radio');
        assert.strictEqual(labelDugmeta(s), 'Prati me');
    });

    await t.test('pun ciklus: uključi → skrolaj → vrati se → ugasi', () => {
        let s = tap(noviGps());              // uključi
        s = korisnikPomjerio(s);             // skrolaj
        assert.strictEqual(labelDugmeta(s), 'Moja lokacija');
        s = tap(s);                          // vrati se
        assert.strictEqual(labelDugmeta(s), 'Prati me');
        s = tap(s);                          // ugasi
        assert.strictEqual(labelDugmeta(s), 'Moja lokacija');
        assert.strictEqual(s.lokacijaAktivna, false);
    });
});

test('Guard za programski pomjeraj', async (t) => {
    await t.test('naš setView pri povratku na korisnika ne gasi centriranje koje je upravo upalio', () => {
        // Bez guarda: setView mijenja zoom → zoomstart → _pauzirajFollow →
        // centriranje bi se ugasilo istog trena kad ga korisnik traži.
        const s = korisnikPomjerio(tap(korisnikPomjerio(tap(noviGps()))), { programskiPomjeraj: true });
        assert.strictEqual(s.followMode, true, 'programski pomjeraj ne smije pauzirati');
    });
});

test('Hint o pauzi', async (t) => {
    await t.test('prikaže se pri prvom korisnikovom panu', () => {
        const s = korisnikPomjerio(tap(noviGps()));
        assert.strictEqual(s.hintPrikazan, true);
    });

    await t.test('Explorer pauzira tiho (korisnik nije ništa pomjerio)', () => {
        const s = korisnikPomjerio(tap(noviGps()), { tiho: true });
        assert.strictEqual(s.followMode, false, 'centriranje se ipak gasi');
        assert.strictEqual(s.hintPrikazan, false, 'ali bez poruke korisniku');
    });

    await t.test('ne ponavlja se pri svakom sljedećem panu', () => {
        let s = korisnikPomjerio(tap(noviGps()));
        const prvi = s.hintPrikazan;
        s = korisnikPomjerio(tap(s));   // vrati se pa opet skrolaj
        assert.strictEqual(prvi, true);
        assert.strictEqual(s.hintPrikazan, true, 'flag ostaje, poruka se ne šalje ponovo');
    });
});

test('Lokacija isključena', async (t) => {
    await t.test('GPS fix ne dira tačku kad je lokacija ugašena', () => {
        const s = gpsFix(noviGps());
        assert.strictEqual(s.tackaAzurirana, false);
        assert.strictEqual(s.panPoziva, 0);
    });

    await t.test('pan bez aktivne lokacije ne mijenja ništa', () => {
        const s = korisnikPomjerio(noviGps());
        assert.deepStrictEqual(s, noviGps());
    });
});

// --- kopija iz js/mapa-radnika.js: _gpsSubscribe onErr / onPos ---
// Prolazne GPS greske (TIMEOUT/POSITION_UNAVAILABLE) se gutaju GPS_GRACE_MS
// prije nego se prijave potrosacima; PERMISSION_DENIED ide odmah.
const GPS_GRACE_MS = 90000;

function noviTok() {
    // 'sada' NE smije krenuti od 0: prviProblemTs=0 znaci "nema problema", pa bi
    // sat na nuli ucinio prvi zabiljezeni problem nevidljivim. Pravi Date.now()
    // nikad nije 0, ovo samo vjerno modeluje tu pretpostavku.
    return { prviProblemTs: 0, dojavljeno: 0, sada: 1700000000000 };
}
function gpsGreska(t, code) {
    const fatalna = code === 1;
    if (!fatalna) {
        if (!t.prviProblemTs) t.prviProblemTs = t.sada;
        if (t.sada - t.prviProblemTs < GPS_GRACE_MS) return t;   // progutano
    }
    return { ...t, dojavljeno: t.dojavljeno + 1 };
}
function gpsUspjeh(t) {
    return { ...t, prviProblemTs: 0 };   // signal se vratio
}
function protekne(t, ms) {
    return { ...t, sada: t.sada + ms };
}

test('Prolazne GPS greške se ne prijavljuju odmah', async (t) => {
    await t.test('TIMEOUT se proguta unutar grace perioda', () => {
        const s = gpsGreska(noviTok(), 3);
        assert.strictEqual(s.dojavljeno, 0, 'korisnik ne smije vidjeti poruku');
    });

    await t.test('POSITION_UNAVAILABLE se takođe proguta', () => {
        const s = gpsGreska(noviTok(), 2);
        assert.strictEqual(s.dojavljeno, 0);
    });

    await t.test('niz timeouta pod krošnjom ostaje tih dok traje grace', () => {
        let s = noviTok();
        for (let i = 0; i < 5; i++) { s = gpsGreska(s, 3); s = protekne(s, 15000); }
        assert.strictEqual(s.dojavljeno, 0, '75s prekida je i dalje samo šuma pod krošnjom');
    });

    await t.test('nakon grace perioda se ipak prijavi', () => {
        let s = gpsGreska(noviTok(), 3);
        s = protekne(s, GPS_GRACE_MS + 1000);
        s = gpsGreska(s, 3);
        assert.strictEqual(s.dojavljeno, 1, 'trajni gubitak signala se mora prijaviti');
    });

    await t.test('uspješan fix poništava grace period', () => {
        let s = gpsGreska(noviTok(), 3);      // problem počeo
        s = protekne(s, 80000);
        s = gpsUspjeh(s);                     // signal se vratio
        s = protekne(s, 80000);
        s = gpsGreska(s, 3);                  // novi, nezavisan problem
        assert.strictEqual(s.dojavljeno, 0, 'brojač kreće ispočetka nakon oporavka');
    });

    await t.test('PERMISSION_DENIED se prijavi ODMAH (nema oporavka)', () => {
        const s = gpsGreska(noviTok(), 1);
        assert.strictEqual(s.dojavljeno, 1);
    });
});

// --- kopija iz js/mapa-radnika.js: _handleTragGpsError ---
// Snimljene tacke se NIKAD ne bacaju — greska samo pauzira snimanje.
function tragGpsGreska(trag) {
    if (!trag.recording || trag.paused) return trag;
    return { ...trag, paused: true };
}

test('GPS greška pri snimanju traga ne uništava snimljeno', async (t) => {
    const uToku = { recording: true, paused: false, tacke: 420 };

    await t.test('snimanje se pauzira, ne prekida', () => {
        const s = tragGpsGreska(uToku);
        assert.strictEqual(s.paused, true);
        assert.strictEqual(s.recording, true, 'snimanje NE smije stati');
    });

    await t.test('prehodane tačke ostaju sačuvane', () => {
        const s = tragGpsGreska(uToku);
        assert.strictEqual(s.tacke, 420, 'nijedna tačka se ne smije izgubiti');
    });

    await t.test('greška dok je već pauzirano ne mijenja ništa', () => {
        const pauzirano = { recording: true, paused: true, tacke: 420 };
        assert.deepStrictEqual(tragGpsGreska(pauzirano), pauzirano);
    });

    await t.test('greška bez aktivnog snimanja ne mijenja ništa', () => {
        const neaktivno = { recording: false, paused: false, tacke: 0 };
        assert.deepStrictEqual(tragGpsGreska(neaktivno), neaktivno);
    });
});
