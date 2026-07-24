// ========== Service Worker - Offline Support ==========

const CACHE_VERSION = 'v42';
const CACHE_NAME = `sumarija-cache-${CACHE_VERSION}`;

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
                    fetch(request).then(resp => { if (resp.ok) _cacheIfOk(resp, request); }).catch(() => {});
                    return cached;
                }
                return fetch(request).then(resp => { _cacheIfOk(resp.clone(), request); return resp; })
                    .catch(() => new Response('{"error":"offline"}', { status: 503 }));
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
