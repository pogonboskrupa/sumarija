// ========== Service Worker - Offline Support ==========
// Cache static assets, fallback za offline

const CACHE_VERSION = 'v3'; // 🔄 Updated to force Service Worker refresh (bypass Apps Script)
const CACHE_NAME = `sumarija-cache-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/idb-helper.js',
    '/data-sync.js'
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

// Fetch event - network-first with cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') {
        return;
    }

    // 🚨 BYPASS: Don't intercept Google Apps Script requests
    // This allows CORS errors to surface properly in the browser console
    // Remove this bypass after deploying Apps Script with CORS headers
    if (url.hostname === 'script.google.com') {
        console.log('[SW] BYPASS: Not intercepting Apps Script request:', url.pathname);
        return; // Let browser handle it directly
    }

    // Handle manifest requests
    if (url.searchParams.has('path') && url.searchParams.get('path').includes('manifest')) {
        event.respondWith(
            fetch(request, { timeout: 10000 })
                .catch(() => {
                    return new Response(JSON.stringify({
                        error: 'offline',
                        primkaRowCount: 0,
                        otpremaRowCount: 0
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // Handle static assets - cache-first
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(request);
                })
        );
        return;
    }

    // Network-first for everything else
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Return proper JSON error response instead of plain text
                        return new Response(JSON.stringify({
                            success: false,
                            error: 'Offline - no cached data available',
                            offline: true
                        }), {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
            })
    );
});

console.log('[SW] Service worker loaded');
