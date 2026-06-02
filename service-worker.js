// ========== Service Worker - Offline Support ==========
// Cache static assets, fallback za offline

const CACHE_VERSION = 'v9';
const CACHE_NAME = `sumarija-cache-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/idb-helper.js',
    '/data-sync.js',
    '/js/notifications.js',
    '/js/karta-odjela.js',
    '/css/main.css',
    '/data/odjeli.geojson',
];

// Resursi koji se kešuju pri prvom uspješnom fetchu (geojson, js, css)
const CACHE_ON_FETCH_PATTERNS = [
    /\/data\/.*\.geojson$/,
    /\/js\/.*\.js$/,
    /\/css\/.*\.css$/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Service worker installed');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache assets:', error);
            })
    );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // Google Apps Script — ne interceptuj, fetchWithCache u app.js rješava stale cache
    if (url.hostname === 'script.google.com') return;

    // Manifest API pozivi
    if (url.searchParams.has('path') && url.searchParams.get('path').includes('manifest')) {
        event.respondWith(
            fetch(request).catch(() => new Response(JSON.stringify({
                error: 'offline', primkaRowCount: 0, otpremaRowCount: 0
            }), { headers: { 'Content-Type': 'application/json' } }))
        );
        return;
    }

    // GeoJSON — cache-first (velik fajl, rijetko se mijenja)
    if (url.pathname.endsWith('.geojson')) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(resp => {
                    if (resp.status === 200) {
                        const clone = resp.clone();
                        caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    }
                    return resp;
                });
            }).catch(() => caches.match(request))
        );
        return;
    }

    // Statični resursi (HTML, JS, CSS) — cache-first
    if (STATIC_ASSETS.includes(url.pathname) ||
        CACHE_ON_FETCH_PATTERNS.some(p => p.test(url.pathname))) {
        event.respondWith(
            caches.match(request).then(cached => {
                const networkFetch = fetch(request).then(resp => {
                    if (resp.status === 200) {
                        const clone = resp.clone();
                        caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    }
                    return resp;
                });
                // Vrati cache odmah, osvježi u pozadini (stale-while-revalidate)
                return cached || networkFetch;
            }).catch(() => caches.match(request))
        );
        return;
    }

    // Sve ostalo — network-first, cache kao fallback
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request).then(cached => {
                if (cached) return cached;
                if (request.mode === 'navigate') return caches.match('/offline.html');
                return new Response(JSON.stringify({
                    success: false, error: 'Offline', offline: true
                }), { status: 503, headers: { 'Content-Type': 'application/json' } });
            }))
    );
});

// Handle notification click - open/focus the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if found
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new window
                return clients.openWindow(urlToOpen);
            })
    );
});

console.log('[SW] Service worker loaded');
