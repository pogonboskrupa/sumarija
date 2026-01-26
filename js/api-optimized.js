// ========================================
// 🚀 API OPTIMIZED - Optimizovani API pozivi
// ========================================
// Wrapper za API pozive sa cache-om i paralelnim fetchanjem

// VAŽNO: Ova datoteka se dodaje NAKON cache-helper.js

// ========================================
// API CONFIGURATION
// ========================================

const API_BASE_URL = '// ========================================
// 🚀 API OPTIMIZED - Optimizovani API pozivi
// ========================================
// Wrapper za API pozive sa cache-om i paralelnim fetchanjem

// VAŽNO: Ova datoteka se dodaje NAKON cache-helper.js

// ========================================
// API CONFIGURATION
// ========================================

const API_BASE_URL = 'https://script.google.com/macros/s/AKfycby1ex5OXfAJy651uBTdyGXW3TBzeJ2rB43xtQOXjBwlrfXsQF1UuRBuXaghDRzGhbeC/exec';
const API_TIMEOUT = 30000; // 30 sekundi

// ========================================
// API HELPERS
// ========================================

/**
 * Napravi API URL sa parametrima
 */
function buildApiUrl(path, params = {}) {
    const url = new URL(API_BASE_URL);
    url.searchParams.set('path', path);

    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.set(key, params[key]);
        }
    });

    return url.toString();
}

/**
 * Fetch sa timeout-om
 */
async function fetchWithTimeout(url, options = {}, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - server nije odgovorio na vrijeme');
        }
        throw error;
    }
}

// ========================================
// OPTIMIZED API CALLS
// ========================================

/**
 * Glavni API fetch sa cache-om
 */
async function apiCall(path, params = {}, options = {}) {
    const url = buildApiUrl(path, params);

    // Koristi CacheHelper ako je dostupan
    if (window.CacheHelper && !options.bypassCache) {
        return window.CacheHelper.fetchWithCache(url, options);
    }

    // Fallback - obični fetch
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

/**
 * Batch API pozivi - učitaj više endpoint-a odjednom
 */
async function apiBatch(endpoints, sharedParams = {}) {
    console.log(`[API BATCH] Loading ${endpoints.length} endpoints...`);

    const urls = endpoints.map(endpoint => {
        const path = typeof endpoint === 'string' ? endpoint : endpoint.path;
        const params = typeof endpoint === 'object' ? { ...sharedParams, ...endpoint.params } : sharedParams;
        return buildApiUrl(path, params);
    });

    // Koristi CacheHelper batch ako je dostupan
    if (window.CacheHelper) {
        return window.CacheHelper.fetchMultiple(urls);
    }

    // Fallback - Promise.all
    return Promise.all(urls.map(url => fetch(url).then(r => r.json())));
}

// ========================================
// COMMON API ENDPOINTS
// ========================================

/**
 * Login
 */
async function apiLogin(username, password) {
    return apiCall('login', { username, password }, { noCache: true });
}

/**
 * Stats + Dashboard (paralelno)
 */
async function apiLoadInitialData(year, username, password) {
    const [stats, dashboard] = await apiBatch([
        { path: 'stats', params: { year, username, password } },
        { path: 'dashboard', params: { year, username, password } }
    ]);

    return { stats, dashboard };
}

/**
 * Primaci
 */
async function apiPrimaci(year, username, password, options = {}) {
    return apiCall('primaci', { year, username, password }, options);
}

/**
 * Otpremaci
 */
async function apiOtpremaci(year, username, password, options = {}) {
    return apiCall('otpremaci', { year, username, password }, options);
}

/**
 * Kupci
 */
async function apiKupci(year, username, password, options = {}) {
    return apiCall('kupci', { year, username, password }, options);
}

/**
 * Odjeli
 */
async function apiOdjeli(year, username, password, options = {}) {
    return apiCall('odjeli', { year, username, password }, options);
}

/**
 * Sortimenti
 */
async function apiSortimenti(year, username, password, options = {}) {
    return apiCall('sortimenti', { year, username, password }, options);
}

/**
 * Stanje Odjela
 */
async function apiStanjeOdjela(username, password, options = {}) {
    return apiCall('stanje-odjela', { username, password }, options);
}

/**
 * Sync Stanje Odjela (force refresh)
 */
async function apiSyncStanjeOdjela(username, password) {
    return apiCall('sync-stanje-odjela', { username, password }, { bypassCache: true, noCache: true });
}

/**
 * Add Sjeca
 */
async function apiAddSjeca(data) {
    const url = buildApiUrl('add-sjeca', data);
    const response = await fetchWithTimeout(url, { method: 'POST' });

    if (!response.ok) {
        throw new Error(`Add Sjeca failed: ${response.statusText}`);
    }

    // Invalidate relevant caches
    if (window.CacheHelper) {
        window.CacheHelper.invalidateCache('primaci');
        window.CacheHelper.invalidateCache('stats');
        window.CacheHelper.invalidateCache('dashboard');
    }

    return response.json();
}

/**
 * Add Otprema
 */
async function apiAddOtprema(data) {
    const url = buildApiUrl('add-otprema', data);
    const response = await fetchWithTimeout(url, { method: 'POST' });

    if (!response.ok) {
        throw new Error(`Add Otprema failed: ${response.statusText}`);
    }

    // Invalidate relevant caches
    if (window.CacheHelper) {
        window.CacheHelper.invalidateCache('otpremaci');
        window.CacheHelper.invalidateCache('kupci');
        window.CacheHelper.invalidateCache('stats');
        window.CacheHelper.invalidateCache('dashboard');
    }

    return response.json();
}

// ========================================
// BACKGROUND REFRESH
// ========================================

/**
 * Refresh-uj sve važne endpoint-e u pozadini
 * (ne blokira UI)
 */
function refreshAllDataInBackground(year, username, password) {
    if (!window.CacheHelper) return;

    console.log('[BACKGROUND REFRESH] Starting...');

    const endpoints = ['stats', 'dashboard', 'primaci', 'otpremaci', 'kupci', 'odjeli', 'sortimenti'];

    endpoints.forEach(path => {
        const url = buildApiUrl(path, { year, username, password });
        window.CacheHelper.refreshCacheInBackground(url);
    });
}

// ========================================
// EXPORT
// ========================================

window.API = {
    buildApiUrl,
    apiCall,
    apiBatch,

    // Auth
    login: apiLogin,

    // Data fetching
    loadInitialData: apiLoadInitialData,
    primaci: apiPrimaci,
    otpremaci: apiOtpremaci,
    kupci: apiKupci,
    odjeli: apiOdjeli,
    sortimenti: apiSortimenti,
    stanjeOdjela: apiStanjeOdjela,
    syncStanjeOdjela: apiSyncStanjeOdjela,

    // Data mutation
    addSjeca: apiAddSjeca,
    addOtprema: apiAddOtprema,

    // Background refresh
    refreshAllInBackground: refreshAllDataInBackground
};

console.log('[API OPTIMIZED] Initialized');;
const API_TIMEOUT = 30000; // 30 sekundi

// ========================================
// API HELPERS
// ========================================

/**
 * Napravi API URL sa parametrima
 */
function buildApiUrl(path, params = {}) {
    const url = new URL(API_BASE_URL);
    url.searchParams.set('path', path);

    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.set(key, params[key]);
        }
    });

    return url.toString();
}

/**
 * Fetch sa timeout-om
 */
async function fetchWithTimeout(url, options = {}, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - server nije odgovorio na vrijeme');
        }
        throw error;
    }
}

// ========================================
// OPTIMIZED API CALLS
// ========================================

/**
 * Glavni API fetch sa cache-om
 */
async function apiCall(path, params = {}, options = {}) {
    const url = buildApiUrl(path, params);

    // Koristi CacheHelper ako je dostupan
    if (window.CacheHelper && !options.bypassCache) {
        return window.CacheHelper.fetchWithCache(url, options);
    }

    // Fallback - obični fetch
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

/**
 * Batch API pozivi - učitaj više endpoint-a odjednom
 */
async function apiBatch(endpoints, sharedParams = {}) {
    console.log(`[API BATCH] Loading ${endpoints.length} endpoints...`);

    const urls = endpoints.map(endpoint => {
        const path = typeof endpoint === 'string' ? endpoint : endpoint.path;
        const params = typeof endpoint === 'object' ? { ...sharedParams, ...endpoint.params } : sharedParams;
        return buildApiUrl(path, params);
    });

    // Koristi CacheHelper batch ako je dostupan
    if (window.CacheHelper) {
        return window.CacheHelper.fetchMultiple(urls);
    }

    // Fallback - Promise.all
    return Promise.all(urls.map(url => fetch(url).then(r => r.json())));
}

// ========================================
// COMMON API ENDPOINTS
// ========================================

/**
 * Login
 */
async function apiLogin(username, password) {
    return apiCall('login', { username, password }, { noCache: true });
}

/**
 * Stats + Dashboard (paralelno)
 */
async function apiLoadInitialData(year, username, password) {
    const [stats, dashboard] = await apiBatch([
        { path: 'stats', params: { year, username, password } },
        { path: 'dashboard', params: { year, username, password } }
    ]);

    return { stats, dashboard };
}

/**
 * Primaci
 */
async function apiPrimaci(year, username, password, options = {}) {
    return apiCall('primaci', { year, username, password }, options);
}

/**
 * Otpremaci
 */
async function apiOtpremaci(year, username, password, options = {}) {
    return apiCall('otpremaci', { year, username, password }, options);
}

/**
 * Kupci
 */
async function apiKupci(year, username, password, options = {}) {
    return apiCall('kupci', { year, username, password }, options);
}

/**
 * Odjeli
 */
async function apiOdjeli(year, username, password, options = {}) {
    return apiCall('odjeli', { year, username, password }, options);
}

/**
 * Sortimenti
 */
async function apiSortimenti(year, username, password, options = {}) {
    return apiCall('sortimenti', { year, username, password }, options);
}

/**
 * Stanje Odjela
 */
async function apiStanjeOdjela(username, password, options = {}) {
    return apiCall('stanje-odjela', { username, password }, options);
}

/**
 * Sync Stanje Odjela (force refresh)
 */
async function apiSyncStanjeOdjela(username, password) {
    return apiCall('sync-stanje-odjela', { username, password }, { bypassCache: true, noCache: true });
}

/**
 * Add Sjeca
 */
async function apiAddSjeca(data) {
    const url = buildApiUrl('add-sjeca', data);
    const response = await fetchWithTimeout(url, { method: 'POST' });

    if (!response.ok) {
        throw new Error(`Add Sjeca failed: ${response.statusText}`);
    }

    // Invalidate relevant caches
    if (window.CacheHelper) {
        window.CacheHelper.invalidateCache('primaci');
        window.CacheHelper.invalidateCache('stats');
        window.CacheHelper.invalidateCache('dashboard');
    }

    return response.json();
}

/**
 * Add Otprema
 */
async function apiAddOtprema(data) {
    const url = buildApiUrl('add-otprema', data);
    const response = await fetchWithTimeout(url, { method: 'POST' });

    if (!response.ok) {
        throw new Error(`Add Otprema failed: ${response.statusText}`);
    }

    // Invalidate relevant caches
    if (window.CacheHelper) {
        window.CacheHelper.invalidateCache('otpremaci');
        window.CacheHelper.invalidateCache('kupci');
        window.CacheHelper.invalidateCache('stats');
        window.CacheHelper.invalidateCache('dashboard');
    }

    return response.json();
}

// ========================================
// BACKGROUND REFRESH
// ========================================

/**
 * Refresh-uj sve važne endpoint-e u pozadini
 * (ne blokira UI)
 */
function refreshAllDataInBackground(year, username, password) {
    if (!window.CacheHelper) return;

    console.log('[BACKGROUND REFRESH] Starting...');

    const endpoints = ['stats', 'dashboard', 'primaci', 'otpremaci', 'kupci', 'odjeli', 'sortimenti'];

    endpoints.forEach(path => {
        const url = buildApiUrl(path, { year, username, password });
        window.CacheHelper.refreshCacheInBackground(url);
    });
}

// ========================================
// EXPORT
// ========================================

window.API = {
    buildApiUrl,
    apiCall,
    apiBatch,

    // Auth
    login: apiLogin,

    // Data fetching
    loadInitialData: apiLoadInitialData,
    primaci: apiPrimaci,
    otpremaci: apiOtpremaci,
    kupci: apiKupci,
    odjeli: apiOdjeli,
    sortimenti: apiSortimenti,
    stanjeOdjela: apiStanjeOdjela,
    syncStanjeOdjela: apiSyncStanjeOdjela,

    // Data mutation
    addSjeca: apiAddSjeca,
    addOtprema: apiAddOtprema,

    // Background refresh
    refreshAllInBackground: refreshAllDataInBackground
};

console.log('[API OPTIMIZED] Initialized');
