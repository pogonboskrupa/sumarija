// ========== Service Worker - Offline Support ==========

const CACHE_VERSION = 'v172';
const CACHE_NAME = `sumarija-cache-${CACHE_VERSION}`;

// Resursi koji se keširaju odmah pri instalaciji — aplikacija se tako otvara offline već
// poslije PRVOG online posjeta (ranije se lazy keširalo samo ono što je stvarno učitano).
const PRECACHE_LOCAL = [
    './', 'index.html', 'offline.html', 'manifest.webmanifest', 'logo-zuti.png', 'favicon.svg', 'favicon.png',
    'idb-helper.js', 'data-sync.js',
    'css/main.css', 'css/login-optimized.css', 'css/table-contrast-fix.css',
    'js/config-sumarija.js', 'js/izvjestaji-new.js', 'js/print-utils.js', 'js/kubikator.js', 'js/sihtarica.js',
    'js/utils.js', 'js/app.js', 'js/auth.js', 'js/ui.js', 'js/drag-scroll.js', 'js/charts.js',
    'js/godisnji-plan.js', 'js/karta-odjela.js', 'js/mapa-radnika.js', 'js/notifications.js',
    'js/odjel-aktivnost.js', 'js/odjeli-kartice.js'
];
const PRECACHE_CDN = [
    'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Jedan neuspjeli URL ne smije srušiti instalaciju — svaki se kešuje zasebno.
// CDN: prvo CORS (potrebno za <script crossorigin>), pa no-cors (opaque) kao rezerva.
async function _precacheOne(cache, url, cdn) {
    try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (resp && resp.ok) { await cache.put(url, resp); return; }
    } catch (_) { /* pokušaj rezervu */ }
    if (cdn) {
        try { await cache.put(url, await fetch(new Request(url, { mode: 'no-cors' }))); } catch (_) {}
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(c => Promise.all([
                ...PRECACHE_LOCAL.map(u => _precacheOne(c, u, false)),
                ...PRECACHE_CDN.map(u => _precacheOne(c, u, true))
            ]))
            .then(() => self.skipWaiting())
    );
});

// Activate — obriši stare cacheove, preuzmi kontrolu odmah
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // Google Apps Script — ne interceptuj (fetchWithCache u app.js ima stale fallback)
    if (url.hostname === 'script.google.com') return;

    // Stranice (navigate) — mreža-prvo, ali najviše 3 s: ako je veza spora, odmah se otvara
    // keširana aplikacija (nova verzija stiže pri sljedećem otvaranju). {cache:'no-cache'} =
    // uslovna provjera (304 kad nema promjena) umjesto punog preuzimanja 'reload'.
    if (request.mode === 'navigate') {
        const fallback = () => caches.match(request, { ignoreSearch: true })
            .then(c => c || caches.match('index.html') || caches.match('./'))
            .then(c => c || caches.match('offline.html'));
        event.respondWith(new Promise(resolve => {
            const t = setTimeout(() => fallback().then(c => c && resolve(c)), 3000);
            fetch(request, { cache: 'no-cache' })
                .then(resp => { clearTimeout(t); _cacheIfOk(resp.clone(), request); resolve(resp); })
                .catch(() => { clearTimeout(t); fallback().then(c => resolve(c || new Response('Offline', { status: 503 }))); });
        }));
        return;
    }

    // GeoJSON — cache-first (7.5MB, rijetko se mijenja)
    if (url.pathname.endsWith('.geojson')) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) {
                    // Osvježi u pozadini
                    fetch(request).then(resp => { if (resp.ok) _cacheIfOk(resp, request); }).catch(() => {});
                    return cached;
                }
                return fetch(request).then(resp => { _cacheIfOk(resp.clone(), request); return resp; })
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
        event.respondWith(
            caches.match(request).then(cached => cached || fetch(request)
                .then(resp => { _cacheIfOk(resp.clone(), request); return resp; })
                .catch(() => new Response('', { status: 503 })))
        );
        return;
    }

    // JS i CSS aplikacije — mreža-prvo (max 4 s), pa keš. Stale-while-revalidate je korisniku
    // prvo servirao STARI kod pa tek poslije reloada novi ("stari prikaz pa novi"); ovako
    // nova verzija stiže odmah, a offline/spora mreža i dalje koriste keš.
    if (url.origin === self.location.origin && /\.(js|css)$/.test(url.pathname)) {
        event.respondWith(
            new Promise(resolve => {
                const t = setTimeout(() => caches.match(request).then(c => c && resolve(c)), 4000);
                fetch(request, { cache: 'no-cache' })
                    .then(resp => { clearTimeout(t); _cacheIfOk(resp.clone(), request); resolve(resp); })
                    .catch(() => { clearTimeout(t); caches.match(request).then(c => resolve(c || new Response('', { status: 503 }))); });
            })
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
                const network = fetch(request, { cache: 'no-cache' }).then(resp => { _cacheIfOk(resp.clone(), request); return resp; })
                    .catch(() => cached || new Response('', { status: 503 }));
                if (cached) event.waitUntil(network.catch(() => {}));
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

function _cacheIfOk(response, request) {
    // status 200 = normalan (isti-origin) odgovor. type 'opaque' = cross-origin
    // no-cors odgovor (npr. OSM tile <img>) — status je UVIJEK 0 po spec-u bez
    // obzira na stvarni HTTP status, ali Cache API dozvoljava da se ipak snimi
    // i posluži offline (standardan pristup za offline tile keširanje).
    if (response && (response.status === 200 || response.type === 'opaque')) {
        caches.open(CACHE_NAME).then(c => c.put(request, response));
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
