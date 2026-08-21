// Testovi za "Azuriraj" kao pripremu za teren — skidanje izvanmrezne karte
// (js/app.js _pripremiKartuZaTeren + js/mapa-radnika.js
// mapaRadnikaPripremiOfflineKartu).
//
// Po konvenciji projekta logika je OVDJE PREKOPIRANA (ne importovana).

const test = require('node:test');
const assert = require('node:assert');

// --- kopija iz js/app.js: koje uloge uopste skidaju terensku kartu ---
const TERENSKE_ULOGE = new Set(['primac', 'otpremac', 'poslovođa', 'poslovodja']);
function skidaKartu(tip) {
    return TERENSKE_ULOGE.has(String(tip || '').trim().toLowerCase());
}

// --- kopija iz js/mapa-radnika.js: mapaRadnikaPripremiOfflineKartu ---
function odlukaPreuzimanja({ force, vecSkinuto, online, uToku, imaGranica }) {
    if (!force && vecSkinuto) return 'vec-skinuto';
    if (!online) return 'offline';
    if (uToku) return 'zauzeto';
    if (!imaGranica) return 'nema-podataka';
    return 'preuzimaj';
}
function ishodPoslijePreuzimanja({ done, ukupno, prekinuto }) {
    if (prekinuto) return 'nepotpuno';
    return done >= ukupno * 0.9 ? 'preuzeto' : 'nepotpuno';
}

test('Koje uloge skidaju terensku kartu', async (t) => {
    await t.test('terenske uloge da', () => {
        ['primac', 'otpremac', 'poslovodja', 'poslovođa'].forEach((u) => {
            assert.strictEqual(skidaKartu(u), true, u + ' mora skidati kartu');
        });
    });

    await t.test('kancelarijske uloge ne (drugi modul mape, cisto trosenje podataka)', () => {
        ['admin', 'operativa', 'operateri'].forEach((u) => {
            assert.strictEqual(skidaKartu(u), false, u + ' ne smije skidati terensku kartu');
        });
    });

    await t.test('velika slova i razmaci se toleriraju', () => {
        assert.strictEqual(skidaKartu('  PRIMAC '), true);
        assert.strictEqual(skidaKartu('Poslovodja'), true);
    });

    await t.test('prazna/nepoznata uloga ne skida nista', () => {
        assert.strictEqual(skidaKartu(''), false);
        assert.strictEqual(skidaKartu(null), false);
        assert.strictEqual(skidaKartu(undefined), false);
        assert.strictEqual(skidaKartu('nepoznato'), false);
    });
});

test('Kad "Azuriraj" stvarno skida kartu', async (t) => {
    const spremno = { force: false, vecSkinuto: false, online: true, uToku: false, imaGranica: true };

    await t.test('sve spremno — preuzima', () => {
        assert.strictEqual(odlukaPreuzimanja(spremno), 'preuzimaj');
    });

    await t.test('vec skinuto — NE preuzima ponovo (svaki tap bi bio desetine MB)', () => {
        assert.strictEqual(
            odlukaPreuzimanja({ ...spremno, vecSkinuto: true }), 'vec-skinuto');
    });

    await t.test('force preskace provjeru "vec skinuto"', () => {
        assert.strictEqual(
            odlukaPreuzimanja({ ...spremno, vecSkinuto: true, force: true }), 'preuzimaj');
    });

    await t.test('offline — nema sta skinuti', () => {
        assert.strictEqual(
            odlukaPreuzimanja({ ...spremno, online: false }), 'offline');
    });

    await t.test('offline ima prednost nad "vec skinuto" samo ako nije skinuto', () => {
        // Vec skinuto se provjerava PRVO — offline korisnik sa skinutom kartom
        // ne treba nikakvu poruku, sve mu radi.
        assert.strictEqual(
            odlukaPreuzimanja({ ...spremno, vecSkinuto: true, online: false }), 'vec-skinuto');
    });

    await t.test('preuzimanje vec u toku — ne pokrecu se dva odjednom', () => {
        assert.strictEqual(
            odlukaPreuzimanja({ ...spremno, uToku: true }), 'zauzeto');
    });

    await t.test('nema ucitanih odjela — nema granica za racunanje plocica', () => {
        assert.strictEqual(
            odlukaPreuzimanja({ ...spremno, imaGranica: false }), 'nema-podataka');
    });
});

test('Ishod preuzimanja karte', async (t) => {
    await t.test('sve plocice — spremno za teren', () => {
        assert.strictEqual(ishodPoslijePreuzimanja({ done: 900, ukupno: 900 }), 'preuzeto');
    });

    await t.test('90% je granica', () => {
        assert.strictEqual(ishodPoslijePreuzimanja({ done: 810, ukupno: 900 }), 'preuzeto');
        assert.strictEqual(ishodPoslijePreuzimanja({ done: 809, ukupno: 900 }), 'nepotpuno');
    });

    await t.test('prekinuto na pola — nikako "spremno"', () => {
        assert.strictEqual(
            ishodPoslijePreuzimanja({ done: 890, ukupno: 900, prekinuto: true }), 'nepotpuno');
    });

    await t.test('nijedna plocica — nepotpuno', () => {
        assert.strictEqual(ishodPoslijePreuzimanja({ done: 0, ukupno: 900 }), 'nepotpuno');
    });
});
