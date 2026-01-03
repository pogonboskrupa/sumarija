// Service Worker for Šumarija App
// Provides offline support and caching

const CACHE_NAME = 'sumarija-v1';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
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
  console.log('[Service Worker] Activating...');
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

// Fetch event - implement caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // For API calls to Google Apps Script
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    event.respondWith(networkFirstStrategy(request));
  }
  // For static assets (CDN, etc.)
  else {
    event.respondWith(cacheFirstStrategy(request));
  }
});

// Cache-first strategy: check cache first, fallback to network
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    console.log('[Service Worker] Serving from cache:', request.url);
    return cachedResponse;
  }

  try {
    console.log('[Service Worker] Fetching from network:', request.url);
    const networkResponse = await fetch(request);

    // Cache the new response
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);

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

// Network-first strategy: try network first, fallback to cache
async function networkFirstStrategy(request) {
  try {
    console.log('[Service Worker] Trying network first:', request.url);
    const networkResponse = await fetch(request);

    // Cache successful API responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      console.log('[Service Worker] Serving stale data from cache');
      return cachedResponse;
    }

    // No cache available
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
});
