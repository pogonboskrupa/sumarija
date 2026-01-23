// ========================================
// ⚡ CACHE HELPER - Agresivni cache sistem
// ========================================
// Optimizovan cache mehanizam za brže učitavanje podataka

const CACHE_VERSION = 'v2';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuta
const pendingRequests = new Map(); // Request deduplication

// ========================================
// CACHE MANAGEMENT
// ========================================

/**
 * Kreiraj cache key sa verzijom
 */
function getCacheKey(endpoint, params) {
    const paramsString = JSON.stringify(params || {});
    return `${CACHE_VERSION}_${endpoint}_${paramsString}`;
}

/**
 * Dohvati podatke iz cache-a
 */
function getCachedData(cacheKey) {
    try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        if (age < CACHE_DURATION) {
            console.log(`[CACHE HIT] ${cacheKey} (age: ${Math.round(age/1000)}s)`);
            return data;
        }

        // Cache istekao - obriši
        console.log(`[CACHE EXPIRED] ${cacheKey}`);
        localStorage.removeItem(cacheKey);
        return null;
    } catch (error) {
        console.warn('[CACHE ERROR]', error);
        return null;
    }
}

/**
 * Sačuvaj podatke u cache
 */
function setCachedData(cacheKey, data) {
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
        console.log(`[CACHE SET] ${cacheKey}`);
    } catch (error) {
        // LocalStorage pun - obriši stare cache-ove
        console.warn('[CACHE FULL] Cleaning old caches...');
        cleanOldCaches();

        // Pokušaj opet
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('[CACHE ERROR] Failed to save:', e);
        }
    }
}

/**
 * Invalidate cache za specifičan endpoint
 */
function invalidateCache(endpoint, params) {
    const cacheKey = getCacheKey(endpoint, params);
    localStorage.removeItem(cacheKey);
    console.log(`[CACHE INVALIDATED] ${cacheKey}`);
}

/**
 * Invalidate sve cache-ove
 */
function invalidateAllCaches() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(`${CACHE_VERSION}_`)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[CACHE CLEARED] Removed ${keysToRemove.length} cached items`);
}

/**
 * Očisti stare cache-ove (različite verzije)
 */
function cleanOldCaches() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Obriši sve što nije current verzija
        if (key.includes('_v') && !key.startsWith(`${CACHE_VERSION}_`)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[CACHE CLEANUP] Removed ${keysToRemove.length} old cached items`);
}

// ========================================
// FETCH SA CACHE-OM
// ========================================

/**
 * Fetch sa automatskim cache-om i request deduplication-om
 */
async function fetchWithCache(url, options = {}) {
    const cacheKey = getCacheKey(url, options);

    // 1. Provjeri cache
    if (!options.bypassCache) {
        const cached = getCachedData(cacheKey);
        if (cached) {
            return cached;
        }
    }

    // 2. Provjeri da li je request već u toku (deduplication)
    if (pendingRequests.has(cacheKey)) {
        console.log(`[REQUEST DEDUP] ${url}`);
        return pendingRequests.get(cacheKey);
    }

    // 3. Napravi novi request
    console.log(`[CACHE MISS] ${url} - fetching...`);
    const promise = fetch(url, options)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Sačuvaj u cache
            if (!options.noCache) {
                setCachedData(cacheKey, data);
            }
            return data;
        })
        .finally(() => {
            // Ukloni iz pending requests
            pendingRequests.delete(cacheKey);
        });

    pendingRequests.set(cacheKey, promise);
    return promise;
}

/**
 * Batch fetch - paralelni API pozivi
 */
async function fetchMultiple(urls, options = {}) {
    console.log(`[BATCH FETCH] Loading ${urls.length} endpoints in parallel...`);
    const startTime = performance.now();

    try {
        const results = await Promise.all(
            urls.map(url => fetchWithCache(url, options))
        );

        const duration = performance.now() - startTime;
        console.log(`[BATCH FETCH] Completed in ${duration.toFixed(2)}ms`);

        return results;
    } catch (error) {
        console.error('[BATCH FETCH ERROR]', error);
        throw error;
    }
}

// ========================================
// BACKGROUND REFRESH
// ========================================

/**
 * Učitaj podatke u pozadini i refresh-uj cache
 * (ne blokira UI)
 */
function refreshCacheInBackground(url, options = {}) {
    console.log(`[BACKGROUND REFRESH] ${url}`);

    fetchWithCache(url, { ...options, bypassCache: true })
        .then(() => {
            console.log(`[BACKGROUND REFRESH] Success: ${url}`);
        })
        .catch(error => {
            console.warn(`[BACKGROUND REFRESH] Failed: ${url}`, error);
        });
}

// ========================================
// CACHE STATISTICS
// ========================================

/**
 * Prikaži cache statistiku
 */
function getCacheStats() {
    let totalSize = 0;
    let itemCount = 0;
    const currentVersionCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);

        if (key.startsWith(`${CACHE_VERSION}_`)) {
            itemCount++;
            totalSize += new Blob([value]).size;
        }
    }

    return {
        version: CACHE_VERSION,
        items: itemCount,
        size: `${(totalSize / 1024).toFixed(2)} KB`,
        maxSize: '5-10 MB (browser limit)'
    };
}

// ========================================
// AUTO CLEANUP
// ========================================

// Očisti stare cache-ove pri inicijalizaciji
cleanOldCaches();

// Export funkcija
window.CacheHelper = {
    getCacheKey,
    getCachedData,
    setCachedData,
    invalidateCache,
    invalidateAllCaches,
    cleanOldCaches,
    fetchWithCache,
    fetchMultiple,
    refreshCacheInBackground,
    getCacheStats
};

console.log('[CACHE HELPER] Initialized', getCacheStats());
