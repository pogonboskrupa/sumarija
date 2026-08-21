// Testovi za izvanmrežno preuzimanje karte (js/mapa-radnika.js
// _doOfflineDownload) i za tile granu u service-worker.js.
//
// Po konvenciji ovog projekta logika je OVDJE PREKOPIRANA (ne importovana) —
// oba fajla su vezana za browser (Leaflet / ServiceWorkerGlobalScope).

const test = require('node:test');
const assert = require('node:assert');

// --- kopija iz service-worker.js: tile grana ---
// Vraca sta ce SW posluziti: 'kes' | 'mreza' | '503'
function swTile({ cacheMode, uKesu, mrezaRadi }) {
    const traziSvjeze = cacheMode === 'reload' || cacheMode === 'no-store';
    if (!traziSvjeze && uKesu) return 'kes';
    return mrezaRadi ? 'mreza' : '503';
}

// --- kopija iz js/mapa-radnika.js: brojanje uspjesno preuzetih plocica ---
function brojiKaoPreuzeto(odgovor) {
    // SW na neuspjeh vraca RIJESEN 503 odgovor (ne odbacen), pa se mora
    // gledati resp.ok; 'opaque' je legitimna cross-origin plocica.
    if (!odgovor) return false;
    return odgovor.ok === true || odgovor.type === 'opaque';
}

// --- kopija iz js/mapa-radnika.js: odluka nakon preuzimanja ---
function ishodPreuzimanja({ done, ukupno, otkazano }) {
    if (otkazano) return 'otkazano';
    return done >= ukupno * 0.9 ? 'zapisano' : 'nepotpuno';
}

test('Service worker — tile grana', async (t) => {
    await t.test('Leaflet (obican zahtjev) dobija kes — offline rad netaknut', () => {
        assert.strictEqual(
            swTile({ cacheMode: 'default', uKesu: true, mrezaRadi: false }), 'kes');
    });

    await t.test('obican zahtjev bez kesa ide na mrezu', () => {
        assert.strictEqual(
            swTile({ cacheMode: 'default', uKesu: false, mrezaRadi: true }), 'mreza');
    });

    await t.test('"osvjezi plocice" MORA na mrezu i kad plocica postoji u kesu', () => {
        // Ovo je bio bug: kes je uvijek pobjedjivao, pa "Skinuti ponovo i
        // osvjeziti plocice?" nije osvjezavalo apsolutno nista.
        assert.strictEqual(
            swTile({ cacheMode: 'reload', uKesu: true, mrezaRadi: true }), 'mreza');
    });

    await t.test('neuspjelo osvjezavanje vraca 503, NE staru plocicu', () => {
        // Da vracamo stari kes, brojac bi ga prihvatio kao "preuzeto" i
        // javio "Karta preuzeta" iako se nista nije skinulo.
        assert.strictEqual(
            swTile({ cacheMode: 'reload', uKesu: true, mrezaRadi: false }), '503');
    });

    await t.test('bez mreze i bez kesa — 503', () => {
        assert.strictEqual(
            swTile({ cacheMode: 'default', uKesu: false, mrezaRadi: false }), '503');
    });
});

test('Brojanje stvarno preuzetih plocica', async (t) => {
    await t.test('uspjesan odgovor se broji', () => {
        assert.strictEqual(brojiKaoPreuzeto({ ok: true, type: 'cors' }), true);
    });

    await t.test('opaque (cross-origin) se broji', () => {
        assert.strictEqual(brojiKaoPreuzeto({ ok: false, type: 'opaque' }), true);
    });

    await t.test('503 od service workera se NE broji', () => {
        assert.strictEqual(brojiKaoPreuzeto({ ok: false, type: 'default' }), false);
    });

    await t.test('izostanak odgovora se NE broji', () => {
        assert.strictEqual(brojiKaoPreuzeto(null), false);
        assert.strictEqual(brojiKaoPreuzeto(undefined), false);
    });
});

test('Ishod preuzimanja', async (t) => {
    await t.test('sve plocice — zapisi kvacicu', () => {
        assert.strictEqual(ishodPreuzimanja({ done: 950, ukupno: 950 }), 'zapisano');
    });

    await t.test('95% je dovoljno', () => {
        assert.strictEqual(ishodPreuzimanja({ done: 903, ukupno: 950 }), 'zapisano');
    });

    await t.test('pola karte NE smije nositi kvacicu "spremno za teren"', () => {
        assert.strictEqual(ishodPreuzimanja({ done: 475, ukupno: 950 }), 'nepotpuno');
    });

    await t.test('nijedna plocica (offline) — nepotpuno, nikako uspjeh', () => {
        assert.strictEqual(ishodPreuzimanja({ done: 0, ukupno: 950 }), 'nepotpuno');
    });

    await t.test('otkazano na pola ne zapisuje kvacicu', () => {
        assert.strictEqual(
            ishodPreuzimanja({ done: 940, ukupno: 950, otkazano: true }), 'otkazano');
    });
});

// --- kopija iz js/mapa-radnika.js: raspodjela posla na paralelne radnike ---
async function preuzmiSve(plocice, paralelno, dohvati, prekid) {
    let zapoceto = 0, done = 0, obradjeno = 0;
    async function radnik() {
        while (true) {
            if (prekid && prekid()) return;
            const i = zapoceto++;
            if (i >= plocice.length) return;
            const r = await dohvati(plocice[i]);
            if (brojiKaoPreuzeto(r)) done++;
            obradjeno++;
        }
    }
    const radnici = [];
    for (let w = 0; w < paralelno; w++) radnici.push(radnik());
    await Promise.all(radnici);
    return { done, obradjeno };
}

test('Paralelno preuzimanje', async (t) => {
    const plocice = Array.from({ length: 50 }, (_, i) => i);
    const ok = async () => ({ ok: true, type: 'cors' });

    await t.test('svaka plocica se dohvati tacno jednom', async () => {
        const trazene = [];
        await preuzmiSve(plocice, 5, async (p) => { trazene.push(p); return { ok: true }; });
        assert.strictEqual(trazene.length, 50);
        assert.strictEqual(new Set(trazene).size, 50, 'nema duplikata ni preskocenih');
    });

    await t.test('broji sve uspjesne', async () => {
        const r = await preuzmiSve(plocice, 5, ok);
        assert.strictEqual(r.done, 50);
    });

    await t.test('neuspjele se ne broje ali se obrade', async () => {
        const r = await preuzmiSve(plocice, 5,
            async (p) => (p % 2 === 0 ? { ok: true } : { ok: false, type: 'default' }));
        assert.strictEqual(r.done, 25);
        assert.strictEqual(r.obradjeno, 50);
    });

    await t.test('prekid zaustavlja preuzimanje', async () => {
        let brojac = 0;
        const r = await preuzmiSve(plocice, 5, async () => { brojac++; return { ok: true }; },
            () => brojac >= 10);
        assert.ok(r.obradjeno < 50, 'ne smije obraditi sve nakon prekida');
        assert.ok(brojac < 50, 'ne smije nastaviti dohvatati nakon prekida');
    });
});
