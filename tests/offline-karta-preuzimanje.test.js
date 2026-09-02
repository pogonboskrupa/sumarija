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

// ============================================================
// TRAJNI KES KARTE + "NASTAVI GDJE SI STAO"
// ============================================================

// --- kopija iz service-worker.js: koji kesevi prezivljavaju activate ---
function zaBrisanje(imena, tekuci, mapKes) {
    return imena.filter(n => n !== tekuci && n !== mapKes);
}

// --- kopija iz service-worker.js: sta se seli u trajni kes ---
const TILE_HOSTOVI = /^server\.arcgisonline\.com$|(^|\.)tile\.openstreetmap\.org$|(^|\.)tile\.opentopomap\.org$/;
function jeKartaZahtjev(urlStr) {
    try {
        const u = new URL(urlStr);
        return TILE_HOSTOVI.test(u.hostname) || u.pathname.endsWith('.geojson');
    } catch (_) { return false; }
}

// --- kopija iz js/mapa-radnika.js: kljuc plocice neovisan o subdomeni ---
function tileKljuc(urlStr) {
    try {
        const u = new URL(urlStr);
        if (u.hostname === 'server.arcgisonline.com') return 'sat|' + u.pathname;
        if (/(^|\.)tile\.opentopomap\.org$/.test(u.hostname)) return 'topo|' + u.pathname;
        if (/(^|\.)tile\.openstreetmap\.org$/.test(u.hostname)) return 'osm|' + u.pathname;
        return null;
    } catch (_) { return null; }
}

// --- kopija iz js/mapa-radnika.js: _tileUrl ---
function tileUrl(t, mode) {
    const s = ['a', 'b', 'c'][(t.x + t.y) % 3];
    if (mode === 'sat') return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + t.z + '/' + t.y + '/' + t.x;
    if (mode === 'topo') return 'https://' + s + '.tile.opentopomap.org/' + t.z + '/' + t.x + '/' + t.y + '.png';
    return 'https://' + s + '.tile.openstreetmap.org/' + t.z + '/' + t.x + '/' + t.y + '.png';
}

// --- kopija iz js/mapa-radnika.js: _nedostajucePlocice ---
function nedostajuce(tiles, mode, uKesu /* Set kljuceva ili null */) {
    if (!uKesu) return tiles.slice();
    return tiles.filter(t => !uKesu.has(tileKljuc(tileUrl(t, mode))));
}

// --- kopija iz js/mapa-radnika.js: konacna ocjena po STVARNOM kesu ---
function ishodPoKesu({ imamo, ukupno }) {
    return imamo >= ukupno * 0.9 ? 'zapisano' : 'nepotpuno';
}

test('Trajni kes karte (service worker)', async (t) => {
    await t.test('azuriranje aplikacije NE brise skinute plocice', () => {
        // Ovo je bio najskuplji bug: activate je brisao svaki kes osim tekuceg,
        // pa je svako podizanje verzije aplikacije unistilo desetine MB karte
        // koju je radnik minutama skidao — a kvacica "skinuto" je ostajala.
        const brisemo = zaBrisanje(
            ['sumarija-cache-v384', 'sumarija-cache-v385', 'sumarija-map-v1'],
            'sumarija-cache-v385', 'sumarija-map-v1');
        assert.deepStrictEqual(brisemo, ['sumarija-cache-v384']);
        assert.ok(!brisemo.includes('sumarija-map-v1'), 'kes karte mora prezivjeti');
    });

    await t.test('stari verzionisani kesevi se i dalje ciste', () => {
        const brisemo = zaBrisanje(
            ['sumarija-cache-v380', 'sumarija-cache-v381', 'sumarija-cache-v385', 'sumarija-map-v1'],
            'sumarija-cache-v385', 'sumarija-map-v1');
        assert.deepStrictEqual(brisemo, ['sumarija-cache-v380', 'sumarija-cache-v381']);
    });

    await t.test('u trajni kes idu plocice i geojson, ne i app resursi', () => {
        assert.strictEqual(jeKartaZahtjev('https://a.tile.openstreetmap.org/14/9012/5893.png'), true);
        assert.strictEqual(jeKartaZahtjev('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/5893/9012'), true);
        assert.strictEqual(jeKartaZahtjev('https://b.tile.opentopomap.org/14/9012/5893.png'), true);
        assert.strictEqual(jeKartaZahtjev('https://sumarijaboskrupa.work/odjeli.geojson'), true);
        assert.strictEqual(jeKartaZahtjev('https://sumarijaboskrupa.work/js/app.js'), false);
        assert.strictEqual(jeKartaZahtjev('https://sumarijaboskrupa.work/index.html'), false);
    });
});

test('Nastavi gdje si stao (nedostajuce plocice)', async (t) => {
    const tiles = [
        { z: 14, x: 9012, y: 5893 },
        { z: 14, x: 9013, y: 5893 },
        { z: 14, x: 9014, y: 5893 }
    ];

    await t.test('prazan kes — skidaju se sve', () => {
        assert.strictEqual(nedostajuce(tiles, 'osm', new Set()).length, 3);
    });

    await t.test('sve u kesu — ne skida se nista (nema ponovnog trosenja podataka)', () => {
        const kes = new Set(tiles.map(t2 => tileKljuc(tileUrl(t2, 'osm'))));
        assert.strictEqual(nedostajuce(tiles, 'osm', kes).length, 0);
    });

    await t.test('prekinuto preuzimanje se NASTAVLJA, ne pocinje od nule', () => {
        const kes = new Set([tileKljuc(tileUrl(tiles[0], 'osm'))]);
        const fali = nedostajuce(tiles, 'osm', kes);
        assert.strictEqual(fali.length, 2);
        assert.ok(!fali.some(t2 => t2.x === 9012), 'vec skinuta plocica se ne skida opet');
    });

    await t.test('plocica keširana pod drugom subdomenom se prepoznaje', () => {
        // Leaflet bira {s} po svom pravilu, mi po svom — bez normalizacije bi
        // ista plocica izgledala kao "nedostaje" i skidala se opet.
        const kljuc = tileKljuc('https://c.tile.openstreetmap.org/14/9012/5893.png');
        assert.strictEqual(kljuc, tileKljuc(tileUrl(tiles[0], 'osm')));
    });

    await t.test('slojevi se ne mijesaju — OSM kes ne vazi za satelit', () => {
        const kesOsm = new Set(tiles.map(t2 => tileKljuc(tileUrl(t2, 'osm'))));
        assert.strictEqual(nedostajuce(tiles, 'sat', kesOsm).length, 3);
    });

    await t.test('bez Cache API-ja tretira sve kao nedostajuce (radije visak nego praznina)', () => {
        assert.strictEqual(nedostajuce(tiles, 'osm', null).length, 3);
    });
});

test('Ocjena se donosi po kesu, ne po brojacu pokusaja', async (t) => {
    await t.test('malo dohvaceno u ovom prolazu, ali kes je pun — spremno za teren', () => {
        // Drugi pokusaj na slaboj vezi dohvati samo ono sto je falilo; ranije
        // bi brojac (40) pao ispod praga i lazno javio "nepotpuno".
        assert.strictEqual(ishodPoKesu({ imamo: 940, ukupno: 950 }), 'zapisano');
    });

    await t.test('mnogo dohvaceno, ali kes prazan (npr. QuotaExceeded) — NIJE spremno', () => {
        assert.strictEqual(ishodPoKesu({ imamo: 300, ukupno: 950 }), 'nepotpuno');
    });

    await t.test('prazan kes nikad ne nosi kvacicu', () => {
        assert.strictEqual(ishodPoKesu({ imamo: 0, ukupno: 950 }), 'nepotpuno');
    });
});

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
