// Testovi za "slab signal → odmah offline režim" (js/app.js).
//
// Po konvenciji ovog projekta odluke iz app.js su OVDJE PREKOPIRANE (ne
// importovane) — app.js je jedan veliki fajl vezan za DOM/browser, pa se
// testira čista logika odlučivanja. Ako se pravila u app.js promijene,
// moraju se promijeniti i ovdje.

const test = require('node:test');
const assert = require('node:assert');

// --- kopija iz js/app.js: _vezaSlabaPoAPIju() ---
function vezaSlabaPoAPIju(connection) {
    const c = connection;
    if (!c || !c.effectiveType) return false;
    return c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}

// --- kopija iz js/app.js: gate za offline fast-path u _fetchWithCacheImpl ---
function koristiOfflineFastPath({ online, slabaVeza, cached }) {
    const slabaVezaSaKesom = slabaVeza && cached && cached.data;
    return !online || !!slabaVezaSaKesom;
}

// --- kopija iz js/app.js: izbor timeouta/broja pokušaja ---
function izborTimeouta({ slabaVeza, cached, timeout }) {
    const hasSafetyNet = !!cached;
    const effectiveTimeout = slabaVeza ? 8000
        : (hasSafetyNet ? Math.min(timeout, 30000) : timeout);
    const maxRetries = (hasSafetyNet || slabaVeza) ? 1 : 2;
    return { effectiveTimeout, maxRetries };
}

const KES = { data: { ok: true }, timestamp: Date.now() };

test('Detekcija slabe veze preko Network Information API-ja', async (t) => {
    await t.test('slow-2g je slaba veza', () => {
        assert.strictEqual(vezaSlabaPoAPIju({ effectiveType: 'slow-2g' }), true);
    });

    await t.test('2g je slaba veza', () => {
        assert.strictEqual(vezaSlabaPoAPIju({ effectiveType: '2g' }), true);
    });

    await t.test('3g NIJE slaba veza (spora, ali upotrebljiva)', () => {
        assert.strictEqual(vezaSlabaPoAPIju({ effectiveType: '3g' }), false);
    });

    await t.test('4g NIJE slaba veza', () => {
        assert.strictEqual(vezaSlabaPoAPIju({ effectiveType: '4g' }), false);
    });

    await t.test('API ne postoji (iOS Safari) — ne pretpostavljaj slabu vezu', () => {
        // Mora vratiti false: odluku tada donosi probni zahtjev (_probeVeza),
        // ne smije se paušalno prijaviti slaba veza svakom iPhone korisniku.
        assert.strictEqual(vezaSlabaPoAPIju(null), false);
        assert.strictEqual(vezaSlabaPoAPIju(undefined), false);
        assert.strictEqual(vezaSlabaPoAPIju({}), false);
    });
});

test('Offline fast-path (instant keš umjesto čekanja mreže)', async (t) => {
    await t.test('offline + keš → fast-path', () => {
        assert.strictEqual(
            koristiOfflineFastPath({ online: false, slabaVeza: false, cached: KES }), true);
    });

    await t.test('offline bez keša → i dalje fast-path (vrati prazan odgovor)', () => {
        assert.strictEqual(
            koristiOfflineFastPath({ online: false, slabaVeza: false, cached: null }), true);
    });

    await t.test('slaba veza + keš → fast-path (ovo je poenta izmjene)', () => {
        assert.strictEqual(
            koristiOfflineFastPath({ online: true, slabaVeza: true, cached: KES }), true);
    });

    await t.test('slaba veza BEZ keša → NE fast-path, mreža se ipak pokušava', () => {
        // Nema šta prikazati, pa se isplati pokušati (uz skraćen timeout).
        assert.strictEqual(
            koristiOfflineFastPath({ online: true, slabaVeza: true, cached: null }), false);
    });

    await t.test('dobra veza + keš → NE fast-path (normalno osvježavanje)', () => {
        assert.strictEqual(
            koristiOfflineFastPath({ online: true, slabaVeza: false, cached: KES }), false);
    });

    await t.test('keš bez .data se ne računa kao keš', () => {
        assert.strictEqual(
            koristiOfflineFastPath({ online: true, slabaVeza: true, cached: { data: null } }), false);
    });
});

test('Timeout i broj pokušaja', async (t) => {
    await t.test('slaba veza bez keša → 8s, jedan pokušaj', () => {
        const r = izborTimeouta({ slabaVeza: true, cached: null, timeout: 180000 });
        assert.strictEqual(r.effectiveTimeout, 8000);
        assert.strictEqual(r.maxRetries, 1);
    });

    await t.test('8s je ispod watchdog-a od 10s', () => {
        // Watchdog (js/app.js, DOMContentLoaded) na 10s prikazuje ekran greške.
        // Timeout MORA isteći prije toga da tab stigne prikazati svoje
        // prazno/offline stanje umjesto "Aplikacija se nije uspjela pokrenuti".
        const r = izborTimeouta({ slabaVeza: true, cached: null, timeout: 180000 });
        assert.ok(r.effectiveTimeout < 10000, 'timeout mora biti < 10s watchdog-a');
    });

    await t.test('dobra veza + keš → skraćeno na 30s, jedan pokušaj', () => {
        const r = izborTimeouta({ slabaVeza: false, cached: KES, timeout: 180000 });
        assert.strictEqual(r.effectiveTimeout, 30000);
        assert.strictEqual(r.maxRetries, 1);
    });

    await t.test('dobra veza + keš, kratak traženi timeout → ne produžavaj ga', () => {
        const r = izborTimeouta({ slabaVeza: false, cached: KES, timeout: 5000 });
        assert.strictEqual(r.effectiveTimeout, 5000);
    });

    await t.test('dobra veza bez keša → pun timeout, dva pokušaja', () => {
        // Hladan start bez ičega za prikazati — vrijedi strpljivo čekati.
        const r = izborTimeouta({ slabaVeza: false, cached: null, timeout: 180000 });
        assert.strictEqual(r.effectiveTimeout, 180000);
        assert.strictEqual(r.maxRetries, 2);
    });

    await t.test('najgori slučaj na slaboj vezi je drastično kraći nego prije', () => {
        const prije = 180000 * 2 + 3000;             // 2 pokušaja × 180s + pauza
        const r = izborTimeouta({ slabaVeza: true, cached: null, timeout: 180000 });
        const sada = r.effectiveTimeout * r.maxRetries;
        assert.ok(sada < prije / 20, `najgori slučaj ${sada}ms mora biti puno ispod ${prije}ms`);
    });
});
