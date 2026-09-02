// ========== Service Worker - Offline Support ==========

const CACHE_VERSION = 'v385';
const CACHE_NAME = `sumarija-cache-${CACHE_VERSION}`;

// Karta (tile pločice + geojson) — NAMJERNO u zasebnom, NEVERZIONISANOM kešu.
// Ranije je i to živjelo u CACHE_NAME, a `activate` briše svaki keš osim
// tekućeg — što je značilo da je SVAKO ažuriranje aplikacije brisalo desetine
// MB pločica koje je radnik minutama skidao (i 7.5MB geojson-a). Najgore od
// svega tiho: kvačica "skinuto" je u localStorage-u preživjela, pa je radnik
// odlazio na teren uvjeren da ima kartu, a keš je bio prazan.
// Pločice su nepromjenjive (isti z/x/y = ista slika) pa verzija aplikacije
// za njih uopšte nije relevantna.
const MAP_CACHE = 'sumarija-map-v1';

const _TILE_HOSTOVI = /^server\.arcgisonline\.com$|(^|\.)tile\.openstreetmap\.org$|(^|\.)tile\.opentopomap\.org$/;
function _jeKartaZahtjev(urlStr) {
    try {
        const u = new URL(urlStr);
        return _TILE_HOSTOVI.test(u.hostname) || u.pathname.endsWith('.geojson');
    } catch (_) { return false; }
}

// Install — pre-keširaj samo offline.html (fallback koji se inače nikad ne
// fetcha pa lazy keširanje nikad ne bi imalo šta poslužiti offline korisniku);
// ostali resursi se kešuju lazy pri prvom fetchu
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(c => c.add('offline.html').catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

// Prebaci pločice/geojson iz starog (verzionisanog) keša u trajni MAP_CACHE
// PRIJE nego se stari keš obriše — bez ovoga bi se pri prelasku na ovu verziju
// još jednom izgubilo sve što je radnik ranije skinuo. Defanzivno: bilo kakva
// greška ovdje smije samo značiti "karta se skida ponovo", nikad srušenu
// aktivaciju service workera.
async function _migrirajKartu(staroIme) {
    try {
        const [stari, mapa] = await Promise.all([caches.open(staroIme), caches.open(MAP_CACHE)]);
        const kljucevi = await stari.keys();
        for (const req of kljucevi) {
            if (!_jeKartaZahtjev(req.url)) continue;
            if (await mapa.match(req)) continue;          // već prebačeno
            const resp = await stari.match(req);
            if (resp) await mapa.put(req, resp);
        }
    } catch (_) {}
}

// Activate — obriši stare cacheove (osim trajnog MAP_CACHE), preuzmi kontrolu odmah
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        const stari = names.filter(n => n !== CACHE_NAME && n !== MAP_CACHE);
        for (const n of stari) await _migrirajKartu(n);
        await Promise.all(stari.map(n => caches.delete(n)));
        await self.clients.claim();
    })());
});

// Fetch
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // Google Apps Script — ne interceptuj (fetchWithCache u app.js ima stale fallback)
    if (url.hostname === 'script.google.com') return;

    // Stranice (navigate) — network-first, fallback na cached ili offline.html.
    // {cache:'reload'} zaobilazi browserov HTTP keš da se index.html stvarno
    // provjeri na mreži pri svakom otvaranju (isti razlog kao kod JS/CSS ispod).
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request, { cache: 'reload' })
                .then(resp => { _cacheIfOk(resp.clone(), request); return resp; })
                .catch(() => caches.match(request)
                    .then(c => c || caches.match('offline.html')))
        );
        return;
    }

    // GeoJSON — cache-first (7.5MB, rijetko se mijenja)
    if (url.pathname.endsWith('.geojson')) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) {
                    // Osvježi u pozadini
                    fetch(request).then(resp => { if (resp.ok) _cacheIfOk(resp, request, MAP_CACHE); }).catch(() => {});
                    return cached;
                }
                return fetch(request).then(resp => { _cacheIfOk(resp.clone(), request, MAP_CACHE); return resp; })
                    .catch(() => new Response('{"error":"offline"}', { status: 503 }));
            })
        );
        return;
    }

    // Tile pločice karte — cache-first. Pločice su nepromjenjive: jednom
    // skinuta pločica vrijedi zauvijek, pa nema razloga ikad pitati mrežu.
    // OSM/Topo završavaju na .png pa bi ih uhvatilo i pravilo ispod, ali
    // ArcGIS satelit NEMA ekstenziju u putanji (/tile/{z}/{y}/{x}) pa bi inače
    // pao na "network-first" granu — što znači da bi i VEĆ SKINUTA satelitska
    // karta na terenu svaki put prvo pokušavala mrežu (sporo + troši mobilne
    // podatke) prije nego padne na keš.
    if (url.hostname === 'server.arcgisonline.com' ||
        /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname) ||
        /(^|\.)tile\.opentopomap\.org$/.test(url.hostname)) {
        // Izuzetak od "keš uvijek pobjeđuje": kad stranica EKSPLICITNO traži
        // svježu pločicu ({cache:'reload'}), mora se ići na mrežu. Bez ovoga je
        // opcija "Skinuti ponovo i osvježiti pločice?" (mapa-radnika.js) bila
        // prazno obećanje — svaka pločica bi se pročitala iz keša, brojač bi
        // odbrojao do kraja i javio "Karta preuzeta", a na disku bi ostale
        // POTPUNO ISTE stare pločice. Leaflet svoje pločice traži bez ove
        // opcije, pa mu keš i dalje odgovara odmah (offline rad netaknut).
        // Pad mreže NAMJERNO vraća 503, a NE staru keširanu pločicu: preuzimanje
        // broji samo odgovore sa resp.ok (mapa-radnika.js), pa bi vraćanje starog
        // keša tu prošlo kao "osvježeno" iako se ništa nije skinulo — tačno ona
        // vrsta lažnog "Karta preuzeta" zbog koje to brojanje i postoji.
        const traziSvjeze = request.cache === 'reload' || request.cache === 'no-store';
        event.respondWith(
            (traziSvjeze ? Promise.resolve(null) : caches.match(request))
                .then(cached => cached || fetch(request)
                    .then(resp => { _cacheIfOk(resp.clone(), request, MAP_CACHE); return resp; })
                    .catch(() => new Response('', { status: 503 })))
        );
        return;
    }

    // JS, CSS, slike — stale-while-revalidate. Bitno: revalidate fetch mora
    // zaobići browserov HTTP keš ({cache:'reload'}), inače "svježa" pozadinska
    // provjera zna sama pogoditi HTTP keš i vratiti isti stari (istekli)
    // odgovor umjesto stvarno novog sa mreže — što bi značilo da nova verzija
    // nikad ne stigne u Cache Storage ni nakon više reload-ova.
    if (/\.(js|css|png|jpg|svg|ico|woff2?)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(request).then(cached => {
                const network = fetch(request, { cache: 'reload' }).then(resp => { _cacheIfOk(resp.clone(), request); return resp; })
                    .catch(() => cached || new Response('', { status: 503 }));
                return cached || network;
            })
        );
        return;
    }

    // Sve ostalo — network-first, keširan fallback
    event.respondWith(
        fetch(request)
            .then(resp => { _cacheIfOk(resp.clone(), request); return resp; })
            .catch(() => caches.match(request)
                .then(c => c || new Response(JSON.stringify({ offline: true }), {
                    status: 503, headers: { 'Content-Type': 'application/json' }
                })))
    );
});

function _cacheIfOk(response, request, cacheName) {
    // status 200 = normalan (isti-origin) odgovor. type 'opaque' = cross-origin
    // no-cors odgovor (npr. OSM tile <img>) — status je UVIJEK 0 po spec-u bez
    // obzira na stvarni HTTP status, ali Cache API dozvoljava da se ipak snimi
    // i posluži offline (standardan pristup za offline tile keširanje).
    if (response && (response.status === 200 || response.type === 'opaque')) {
        // .catch() je bitan za tile preuzimanje (mapa-radnika.js): bez njega
        // odbijen cache.put() (npr. QuotaExceededError kad disk ostane bez
        // prostora) propadne NEČUJNO — mrežni fetch je uspio pa se pločica
        // broji kao "preuzeta", a na disku nikad nije zapisana.
        caches.open(cacheName || CACHE_NAME).then(c => c.put(request, response)).catch(() => {});
    }
}

// Notifikacije
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(list => {
                for (const c of list) {
                    if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
                }
                return clients.openWindow(event.notification.data?.url || '/');
            })
    );
});
