// Service Worker for Šumarija App
// Provides offline support and smart time-based caching

const CACHE_NAME = 'sumarija-v17-debug-monthly'; // Verzija 17 - Debug monthly report

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

/**
 * Pametno cache vrijeme ovisno o tome kada se podaci osvježavaju
 * Podaci se ubacuju radnim danima od 6:30h do 9:00h
 */
function getSmartCacheDuration() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const dayOfWeek = now.getDay(); // 0 = Nedjelja, 6 = Subota

  // Vikend - duži cache (do kraja dana)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    // Cache do ponoći
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight - now;
  }

  // Radni dan - provjeravamo vrijeme
  const currentTimeInMinutes = hours * 60 + minutes;
  const dataEntryStart = 6 * 60 + 30;  // 6:30
  const dataEntryEnd = 9 * 60;         // 9:00

  // Tokom unosa podataka (6:30-9:00) - kraći cache (5 minuta)
  if (currentTimeInMinutes >= dataEntryStart && currentTimeInMinutes < dataEntryEnd) {
    return 5 * 60 * 1000; // 5 minuta
  }

  // Prije 6:30 ujutro - cache do početka unosa
  if (currentTimeInMinutes < dataEntryStart) {
    const minutesUntilDataEntry = dataEntryStart - currentTimeInMinutes;
    return minutesUntilDataEntry * 60 * 1000;
  }

  // Nakon 9:00 - podaci stabilni do kraja radnog dana
  // Cache do sljedećeg unosa podataka (sutra u 6:30)
  const nextDataEntry = new Date(now);
  nextDataEntry.setDate(nextDataEntry.getDate() + 1);
  nextDataEntry.setHours(6, 30, 0, 0);

  // Ili maksimalno do ponoći (sigurnosna mjera)
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  return Math.min(nextDataEntry - now, midnight - now);
}

/**
 * Provjera da li je cached response još uvijek validan
 */
function isCacheValid(response) {
  if (!response) return false;

  const cachedDate = response.headers.get('sw-cached-date');
  if (!cachedDate) return false;

  const cachedTime = parseInt(cachedDate);
  const cacheDuration = getSmartCacheDuration();
  const now = Date.now();

  return (now - cachedTime) < cacheDuration;
}

/**
 * Dodaje custom headers cached response-u
 */
async function addCacheHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-date', Date.now().toString());
  headers.set('sw-cache-duration', getSmartCacheDuration().toString());

  const blob = await response.blob();
  return new Response(blob, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v2 - Smart Caching...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.error('[Service Worker] Failed to cache some assets:', err);
      });
    }).then(() => {
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating v2...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - implement smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // For API calls to Google Apps Script - smart cache strategy
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    event.respondWith(smartCacheStrategy(request));
  }
  // For static assets (CDN, etc.) - cache first
  else {
    event.respondWith(cacheFirstStrategy(request));
  }
});

// Smart Cache Strategy - vrijeme-svjesno keširanje za API pozive
async function smartCacheStrategy(request) {
  const cachedResponse = await caches.match(request);

  // Provjeri da li je cache validan
  if (cachedResponse && isCacheValid(cachedResponse)) {
    const cacheDuration = getSmartCacheDuration();
    const minutes = Math.round(cacheDuration / 60000);
    console.log(`[Service Worker] ✅ Serving from VALID cache (${minutes}min valid):`, request.url.substring(0, 80));
    return cachedResponse;
  }

  // Cache istekao ili ne postoji - traži fresh podatke
  try {
    console.log('[Service Worker] 🔄 Fetching fresh data:', request.url.substring(0, 80));
    const networkResponse = await fetch(request);

    // Cache uspješne odgovore sa custom headerima
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      const responseWithHeaders = await addCacheHeaders(networkResponse.clone());
      cache.put(request, responseWithHeaders);

      const cacheDuration = getSmartCacheDuration();
      const minutes = Math.round(cacheDuration / 60000);
      console.log(`[Service Worker] 💾 Cached for ${minutes} minutes`);
    }

    return networkResponse;
  } catch (error) {
    // Network failed - vrati stari cache ako postoji
    if (cachedResponse) {
      console.log('[Service Worker] ⚠️ Network failed, serving STALE cache:', request.url.substring(0, 80));
      return cachedResponse;
    }

    // Nema cache-a
    console.error('[Service Worker] ❌ Network failed, no cache:', error);
    return new Response(JSON.stringify({
      error: 'Offline and no cached data available',
      offline: true
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    });
  }
}

// Cache-first strategy: check cache first, fallback to network
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    console.log('[Service Worker] Serving static from cache:', request.url);
    return cachedResponse;
  }

  try {
    console.log('[Service Worker] Fetching static from network:', request.url);
    const networkResponse = await fetch(request);

    // Cache the new response
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Static fetch failed:', error);

    // Return offline page or placeholder if available
    return new Response('Offline - no cached data available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[Service Worker] Cache cleared');
        return caches.open(CACHE_NAME);
      })
    );
  }

  // Novi message handler - provjeri cache status
  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    const cacheDuration = getSmartCacheDuration();
    const minutes = Math.round(cacheDuration / 60000);
    event.ports[0].postMessage({
      cacheDurationMs: cacheDuration,
      cacheDurationMinutes: minutes,
      cacheVersion: CACHE_NAME
    });
  }
});
