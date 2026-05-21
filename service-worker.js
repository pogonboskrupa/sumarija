// ========== Service Worker - Offline Support ==========

const CACHE_VERSION = 'v11';
const CACHE_NAME = `sumarija-cache-${CACHE_VERSION}`;

// Svi statički fajlovi koji se pre-kešuju pri instalaciji
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.webmanifest',
    '/favicon.png',
    '/favicon.svg',
    '/logo-zuti.png',
    '/idb-helper.js',
    '/data-sync.js',
    '/css/main.css',
    '/css/styles.css',
    '/css/login-optimized.css',
    '/css/table-contrast-fix.css',
    '/js/app.js',
    '/js/auth.js',
    '/js/ui.js',
    '/js/charts.js',
    '/js/godisnji-plan.js',
    '/js/izvjestaji-new.js',
    '/js/kubikator.js',
    '/js/utils.js',
    '/js/notifications.js',
    '/js/drag-scroll.js',
    '/js/week-fix.js',
    '/js/print-utils.js',
    '/js/cache-helper.js',
];

// Install — pre-keširaj sve statičke fajlove
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
            .catch(err => console.error('[SW] Install error:', err))
    );
});

// Activate — obriši stare cacheove
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

// Poruka SKIP_WAITING od app.js
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch — strategija po tipu zahtjeva
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Google Apps Script API — ne keširamo u SW (radi localStorage)
    if (url.hostname === 'script.google.com') return;

    // Navigacija (učitavanje stranice) — network-first, fallback na keširani index.html
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(res => {
                    // Keširaj svježi index.html
                    if (res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    }
                    return res;
                })
                .catch(() =>
                    caches.match('/index.html').then(r => r || caches.match('/offline.html'))
                )
        );
        return;
    }

    // Statički fajlovi (JS, CSS, slike) — cache-first, mreža kao fallback
    if (
        url.pathname.startsWith('/js/') ||
        url.pathname.startsWith('/css/') ||
        url.pathname.match(/\.(png|svg|ico|webmanifest|js|css)$/)
    ) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(res => {
                    if (res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    }
                    return res;
                });
            })
        );
        return;
    }

    // Ostalo — network-first s cache fallbackom
    event.respondWith(
        fetch(request)
            .then(res => {
                if (res.status === 200) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, clone));
                }
                return res;
            })
            .catch(() => caches.match(request))
    );
});
