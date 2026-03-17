        // VERSION INFO - Monthly report by departments
        const APP_VERSION = '2026-01-12-v18-MONTHLY-BY-ODJELI';
        const BUILD_COMMIT = 'pending';

        // Helper: provjeri da li je tab još uvijek aktivan (sprečava bleeding async sadržaja)
        function isActiveTab(tabName) {
            return window.currentTab === tabName;
        }

        // SUPER VISIBLE VERSION CHECK
        console.clear();

        // ========== SERVICE WORKER REGISTRATION ==========
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then((registration) => {
                    console.log('[SW] Service worker registered:', registration.scope);

                    // 🔄 Force update check on page load
                    registration.update().then(() => {
                        console.log('[SW] Checked for updates');
                    });

                    // Listen for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('[SW] New service worker found, installing...');

                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[SW] New service worker installed! Refreshing page...');
                                // Reload page to activate new Service Worker
                                window.location.reload();
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.error('[SW] Service worker registration failed:', error);
                });
        }

        // ========== CLEAN URL AFTER CACHE CLEAR ==========
        // Ako je stranica učitana sa ?nocache parametrom (nakon hard refresh-a),
        // očisti URL bez reload-a da bude clean
        (function cleanUrlAfterCacheClear() {
            const url = new URL(window.location.href);
            if (url.searchParams.has('nocache')) {
                console.log('[URL CLEAN] Removing nocache parameter from URL...');
                url.searchParams.delete('nocache');
                // Replace URL without reload (samo mijenja URL bar)
                window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
                console.log('[URL CLEAN] ✓ URL cleaned:', window.location.href);
            }
        })();

        const API_URL = 'https://script.google.com/macros/s/AKfycbz__4umdSqKd0o81TnDgdtHufd0FcaT-1E2oLq9pcHqfWPjVgIA9WZDz6-O4ta_fiUR/exec';

        // ========== PERFORMANCE METRICS ==========
        const perfMetrics = {
            pageLoadStart: performance.now(),
            cacheHits: 0,
            cacheMisses: 0,
            apiCalls: 0,
            apiErrors: 0
        };

        function logPerformance(action, duration) {
            console.log(`⚡ [PERF] ${action}: ${duration.toFixed(0)}ms`);
        }

        function logCacheStats() {
            const hitRate = perfMetrics.cacheHits / (perfMetrics.cacheHits + perfMetrics.cacheMisses) * 100;
            console.log(`📊 [CACHE] Hits: ${perfMetrics.cacheHits}, Misses: ${perfMetrics.cacheMisses}, Hit Rate: ${hitRate.toFixed(1)}%`);
            console.log(`📡 [API] Calls: ${perfMetrics.apiCalls}, Errors: ${perfMetrics.apiErrors}`);
        }

        // ========== MANIFEST-BASED SMART INVALIDATION ==========
        let cachedManifest = null;
        let manifestCheckInterval = null;

        async function checkManifest() {
            const startTime = performance.now();
            try {
                const url = buildApiUrl('manifest');
                const response = await fetch(url, {
                    signal: AbortSignal.timeout(10000) // 10s timeout za manifest
                });
                const manifest = await response.json();

                logPerformance('Manifest check', performance.now() - startTime);

                // Provjeri da li se version promijenio
                if (cachedManifest && cachedManifest.version !== manifest.version) {
                    console.log('🔄 [MANIFEST] Version changed! Invalidating cache...');
                    // Invalidate cache za promijenjene tabele
                    invalidateCachesByManifest(manifest);
                }

                cachedManifest = manifest;
                localStorage.setItem('manifest', JSON.stringify(manifest));

                return manifest;
            } catch (error) {
                console.error('[MANIFEST] Check failed:', error);
                // Fallback na cached manifest ako postoji
                const cached = localStorage.getItem('manifest');
                return cached ? JSON.parse(cached) : null;
            }
        }

        function invalidateCachesByManifest(newManifest) {
            // Pametna invalidacija - brišemo samo keširane podatke koji su se promijenili
            const year = new Date().getFullYear();
            const cachesToInvalidate = [
                'cache_primaci_' + year,
                'cache_otpremaci_' + year,
                'cache_odjeli_' + year,
                'cache_dashboard_' + year
            ];

            cachesToInvalidate.forEach(key => {
                localStorage.removeItem(key);
                console.log(`🗑️ [CACHE] Invalidated: ${key}`);
            });
        }

        function startManifestChecker() {
            const now = new Date();
            const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            // Vikend: ISKLJUČI manifest checker (nema unosa)
            if (isWeekend) {
                console.log(`🔄 [MANIFEST] Checker SKIPPED (weekend - no data entry expected)`);
                return;
            }

            // Provjeri odmah
            checkManifest();

            // Zatim provjeri periodično
            const hour = now.getHours();

            // Češće između 07:00-09:00 (svake 2 min), rijetko van toga (svaki 10 min)
            const interval = (hour >= 7 && hour < 9) ? 2 * 60 * 1000 : 10 * 60 * 1000;

            if (manifestCheckInterval) {
                clearInterval(manifestCheckInterval);
            }

            manifestCheckInterval = setInterval(checkManifest, interval);
            console.log(`🔄 [MANIFEST] Checker started (interval: ${interval/1000/60} min)`);
        }

        function stopManifestChecker() {
            if (manifestCheckInterval) {
                clearInterval(manifestCheckInterval);
                manifestCheckInterval = null;
            }
        }

        // ========== END PERFORMANCE & MANIFEST ==========

        // ========== MOVED TO js/utils.js ==========
        // SORTIMENTI_ORDER, performance utils (debounce, throttle, etc.), toast notifications

        // ========== CACHING & OFFLINE SUPPORT ==========

        // Register Service Worker for offline support
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {

                    // Automatski aktiviraj novi service worker ako čeka
                    if (registration.waiting) {
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }

                    // Slušaj za updatefound event
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;

                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('❌ Service Worker registration failed:', error);
                });

            // Slušaj kada novi service worker preuzme kontrolu
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }

        /**
         * Pametno cache vrijeme usklađeno sa radnim vremenom unosa podataka
         * Podaci se ubacuju radnim danima od 6:30h do 9:00h (najkasnije 9:00h)
         */
        function getSmartCacheTTL() {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const dayOfWeek = now.getDay(); // 0 = Nedjelja, 6 = Subota

            // Izračunaj ponedjeljak 6:30 (sljedeći radni dan kad se unose podaci)
            function getNextMonday630() {
                const next = new Date(now);
                const daysUntilMonday = (8 - dayOfWeek) % 7 || 7; // 1=pon
                next.setDate(next.getDate() + daysUntilMonday);
                next.setHours(6, 30, 0, 0);
                return next;
            }

            // Vikend (subota/nedjelja) - cache do ponedjeljka 6:30
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            if (isWeekend) {
                return getNextMonday630() - now;
            }

            // Radni dan - provjeravamo precizno vrijeme
            const currentTimeInMinutes = hours * 60 + minutes;
            const dataEntryStart = 6 * 60 + 30;  // 6:30
            const dataEntryEnd = 9 * 60;         // 9:00

            // Tokom unosa podataka (6:30-9:00) - kraći cache
            if (currentTimeInMinutes >= dataEntryStart && currentTimeInMinutes < dataEntryEnd) {
                return 10 * 60 * 1000; // 10 minuta
            }

            // Prije 6:30 ujutro - cache do početka unosa
            if (currentTimeInMinutes < dataEntryStart) {
                const minutesUntilDataEntry = dataEntryStart - currentTimeInMinutes;
                return minutesUntilDataEntry * 60 * 1000;
            }

            // Nakon 9:00 - PODACI STABILNI
            // Petak nakon 9:00 → cache do ponedjeljka 6:30 (cijeli vikend!)
            if (dayOfWeek === 5) {
                return getNextMonday630() - now;
            }

            // Pon-Čet nakon 9:00 → cache do sutra 6:30
            const nextDataEntry = new Date(now);
            nextDataEntry.setDate(nextDataEntry.getDate() + 1);
            nextDataEntry.setHours(6, 30, 0, 0);
            return nextDataEntry - now;
        }

        /**
         * Turbo Show: Instantly display cached data while refreshing in background.
         * Returns cached data object if found, null otherwise.
         * @param {string} cacheKey - localStorage cache key
         * @param {string} contentId - content panel element id
         * @param {function} [validate] - optional validator fn(data) returning truthy if data is usable
         */
        function turboShow(cacheKey, contentId, validate) {
            try {
                var raw = localStorage.getItem(cacheKey);
                if (!raw) return null;
                var parsed = JSON.parse(raw);
                if (!parsed || !parsed.data) return null;
                if (validate && !validate(parsed.data)) return null;
                // Instant show: hide loading, show content
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById(contentId).classList.remove('hidden');
                return parsed.data;
            } catch (e) {
                return null;
            }
        }

        // Fetch with cache - cache-first strategy
        async function fetchWithCache(url, cacheKey, forceRefresh = false, timeout = 120000) {
            // 🚀 TURBO MODE: Default 120s timeout (super patient backend!)
            // DEBUG: Confirm timeout parameter exists
            if (typeof timeout === 'undefined') {
                console.error('🔴 CRITICAL: timeout is undefined in fetchWithCache!');
                timeout = 120000; // Fallback - 2 minutes
            }

            // Use smart cache TTL optimized for data entry patterns
            const path = new URL(url).searchParams.get('path');
            const cacheTTL = getSmartCacheTTL();

            // If force refresh, clear cache for this key
            if (forceRefresh) {
                localStorage.removeItem(cacheKey);
            }

            // Check cache first
            const cacheCheckStart = performance.now();
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const cachedData = JSON.parse(cached);
                    const now = Date.now();
                    const age = now - cachedData.timestamp;

                    // If cache is fresh, return it immediately
                    if (age < cacheTTL) {
                        // If cached data is an error response, clear it and fetch fresh
                        if (cachedData.data && cachedData.data.error) {
                            localStorage.removeItem(cacheKey);
                            perfMetrics.cacheMisses++;
                        } else {
                            perfMetrics.cacheHits++;
                            showCacheIndicator(age);
                            const cacheRetrievalTime = performance.now() - cacheCheckStart;
                            logPerformance(`Cache HIT: ${path} (age: ${(age/1000).toFixed(1)}s)`, cacheRetrievalTime);
                            return cachedData.data;
                        }
                    } else {
                        perfMetrics.cacheMisses++;
                    }
                } catch (e) {
                    console.error('Cache parse error:', e);
                    perfMetrics.cacheMisses++;
                }
            } else {
                perfMetrics.cacheMisses++;
            }

            // Cache miss or stale - fetch from network with retry for transient errors
            const MAX_RETRIES = 3;
            let lastError = null;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    perfMetrics.apiCalls++;
                    const fetchStart = performance.now();

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);

                    const response = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    // Check if response is OK
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    // Check if response is JSON before parsing
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        const text = await response.text();
                        console.error('Invalid response (not JSON):', text);
                        throw new Error('Server returned invalid response format');
                    }

                    const data = await response.json();

                    logPerformance(`API call: ${path}`, performance.now() - fetchStart);

                    // Do NOT cache API error responses - let them be retried fresh
                    if (data.error) {
                        return data;
                    }

                    // Store in cache (handle QuotaExceededError)
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify({
                            data: data,
                            timestamp: Date.now()
                        }));
                    } catch (storageError) {
                        if (storageError.name === 'QuotaExceededError') {
                            // Očisti stare cache ključeve i pokušaj ponovo
                            const keysToRemove = [];
                            for (let i = 0; i < localStorage.length; i++) {
                                const key = localStorage.key(i);
                                if (key && key.startsWith('cache_')) {
                                    keysToRemove.push(key);
                                }
                            }
                            keysToRemove.forEach(k => localStorage.removeItem(k));
                            try {
                                localStorage.setItem(cacheKey, JSON.stringify({
                                    data: data,
                                    timestamp: Date.now()
                                }));
                            } catch (e) {
                                // Cache nije moguć, nastavi bez njega
                            }
                        }
                    }

                    hideCacheIndicator();
                    return data;

                } catch (error) {
                    lastError = error;

                    // Don't retry on abort (timeout) - user already waited long enough
                    if (error.name === 'AbortError') {
                        console.error(`Request timeout (${timeout/1000}s) - server too slow:`, path);
                        break;
                    }

                    // Retry on transient network errors (QUIC, Failed to fetch, network errors)
                    if (attempt < MAX_RETRIES) {
                        const delay = attempt * 2000; // 2s, 4s
                        console.warn(`Network error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay/1000}s:`, error.message);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }

                    console.error('Network error after all retries:', error);
                }
            }

            // All retries failed
            perfMetrics.apiErrors++;

            // If network fails and we have stale cache, use it
            if (cached) {
                try {
                    const cachedData = JSON.parse(cached);
                    const age = Date.now() - cachedData.timestamp;
                    showCacheIndicator(age, true);
                    console.warn(`Using stale cache (${(age/1000/60).toFixed(1)} min old) after network failure`);
                    return cachedData.data;
                } catch (e) {
                    console.error('Stale cache parse error:', e);
                }
            }

            // If timeout, show user-friendly message
            if (lastError && lastError.name === 'AbortError') {
                throw new Error('Server je spor, molimo pokušajte ponovo ili koristite keširane podatke.');
            }

            throw lastError || new Error('Network request failed');
        }

        // Show cache indicator - disabled
        function showCacheIndicator(age, isStale = false) {}

        // Hide cache indicator - disabled
        function hideCacheIndicator() {}

        // Clear cache by pattern
        function clearCacheByPattern(pattern) {
            const keys = Object.keys(localStorage);
            const matchingKeys = keys.filter(k => k.includes(pattern));
            matchingKeys.forEach(k => localStorage.removeItem(k));
            return matchingKeys.length;
        }

        // Clear all cache - TRUE HARD REFRESH (like Ctrl+Shift+R)
        async function clearAllCache() {
            showConfirmModal(
                'Brisanje keša',
                'Da li ste sigurni da želite obrisati sav keš? Stranica će se osvježiti.',
                async function() { await _doClearAllCache(); }
            );
        }

        async function _doClearAllCache() {
            try {
                console.log('[CACHE CLEAR] Starting COMPLETE cache clear (hard refresh)...');

                // Step 1: SAČUVAJ login credentials prije brisanja!
                console.log('[CACHE CLEAR] Step 1: Saving login credentials...');
                const savedUser = localStorage.getItem('sumarija_user');
                const savedPass = localStorage.getItem('sumarija_pass');
                console.log('[CACHE CLEAR] ✓ Login credentials saved');

                // Step 2: Clear cache_* keys from localStorage (NE briši login!)
                console.log('[CACHE CLEAR] Step 2: Clearing cache from localStorage...');
                const localStorageKeys = Object.keys(localStorage);
                console.log(`[CACHE CLEAR] Found ${localStorageKeys.length} localStorage keys:`, localStorageKeys);

                // Briši samo cache_* ključeve
                const cacheKeys = localStorageKeys.filter(k => k.startsWith('cache_'));
                console.log(`[CACHE CLEAR] Deleting ${cacheKeys.length} cache keys...`);
                cacheKeys.forEach(k => {
                    localStorage.removeItem(k);
                    console.log(`[CACHE CLEAR] - Deleted: ${k}`);
                });
                console.log('[CACHE CLEAR] ✓ Cache cleared from localStorage');

                // Step 3: VRATI login credentials natrag!
                if (savedUser && savedPass) {
                    localStorage.setItem('sumarija_user', savedUser);
                    localStorage.setItem('sumarija_pass', savedPass);
                    console.log('[CACHE CLEAR] ✓ Login credentials restored');
                }

                // Step 4: Clear sessionStorage (samo non-critical data)
                console.log('[CACHE CLEAR] Step 4: Clearing sessionStorage...');
                sessionStorage.clear();
                console.log('[CACHE CLEAR] ✓ sessionStorage cleared');

                // Step 5: Clear ALL Service Worker caches
                if ('caches' in window) {
                    console.log('[CACHE CLEAR] Step 5: Clearing Service Worker caches...');
                    const cacheNames = await caches.keys();
                    console.log(`[CACHE CLEAR] Found ${cacheNames.length} SW caches:`, cacheNames);
                    await Promise.all(cacheNames.map(name => {
                        console.log(`[CACHE CLEAR] Deleting cache: ${name}`);
                        return caches.delete(name);
                    }));
                    console.log('[CACHE CLEAR] ✓ All Service Worker caches deleted');
                }

                // Step 6: Unregister ALL Service Workers (force fresh install)
                if ('serviceWorker' in navigator) {
                    console.log('[CACHE CLEAR] Step 6: Unregistering Service Workers...');
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    console.log(`[CACHE CLEAR] Found ${registrations.length} SW registrations`);
                    await Promise.all(registrations.map(registration => {
                        console.log('[CACHE CLEAR] Unregistering SW:', registration.scope);
                        return registration.unregister();
                    }));
                    console.log('[CACHE CLEAR] ✓ All Service Workers unregistered');
                }

                // Step 7: Clear IndexedDB
                if (window.IDBHelper) {
                    try {
                        console.log('[CACHE CLEAR] Step 7: Clearing IndexedDB...');
                        await IDBHelper.clearAll();
                        console.log('[CACHE CLEAR] ✓ IndexedDB cleared');
                    } catch (e) {
                        console.warn('[CACHE CLEAR] IndexedDB clear failed (non-critical):', e);
                    }
                }

                closeUserMenu(); // Close menu
                showSuccess('✅ Keš obrisan', 'Učitavam sve prikaze...');

                // Step 8: Učitaj sve prikaze bez reload-a (forceRefresh = true)
                console.log('[CACHE CLEAR] Step 8: Loading all views (force refresh)...');
                setTimeout(() => {
                    preloadAllViews(false, true);
                }, 800);

            } catch (error) {
                console.error('[CACHE CLEAR] ERROR during cache clear:', error);
                closeUserMenu();
                showError('Greška', 'Nije uspjelo brisanje keša: ' + error.message);
            }
        }

        // Trigger sync index - Pokreće indeksiranje INDEX sheet-ova (samo za admin)
        async function triggerSyncIndex() {
            try {
                console.log('[SYNC INDEX] Starting manual index synchronization...');

                // Prikaži notifikaciju
                showInfo('🔄 Indeksiranje...', 'Pokrećem indeksiranje INDEX sheet-ova...');

                // Pozovi API endpoint
                const url = buildApiUrl('sync-index');
                const response = await fetch(url);
                const data = await response.json();

                if (data.success) {
                    console.log('[SYNC INDEX] ✅ Index synchronization completed successfully');

                    // 🚀 Invalidate SVE cache-ove koji koriste INDEX podatke
                    const year = new Date().getFullYear();
                    const month = new Date().getMonth();
                    const cacheKeysToInvalidate = [
                        // Glavni prikazi
                        'cache_primaci_' + year,
                        'cache_otpremaci_' + year,
                        'cache_odjeli_' + year,
                        'cache_dashboard_' + year,
                        'cache_stats_' + year,
                        'cache_kupci_' + year,
                        'cache_stanje_odjela_admin',

                        // Podmeniji - Primaci
                        'cache_primaci_daily_' + year + '_' + month,
                        'cache_primaci_radiliste_' + year,
                        'cache_primaci_izvodjac_' + year,

                        // Podmeniji - Otpremaci
                        'cache_otpremaci_daily_' + year + '_' + month,
                        'cache_otpremaci_radiliste_' + year,

                        // POSLOVOĐA paneli
                        'cache_poslovodja_odjeli_' + year,
                        'cache_poslovodja_realizacija_' + year,
                        'cache_poslovodja_zadnjih5_' + year,
                        'cache_poslovodja_suma_' + year,

                        // Ostalo
                        'cache_dinamika_' + year,
                        'cache_mjesecni_sortimenti_' + year
                    ];

                    cacheKeysToInvalidate.forEach(key => {
                        localStorage.removeItem(key);
                        console.log(`🗑️ [SYNC INDEX] Invalidated cache: ${key}`);
                    });

                    // 🚀 Update APP DATA VERSION - svi paneli će vidjeti promjenu
                    const newVersion = Date.now().toString();
                    localStorage.setItem('app_data_version', newVersion);
                    window.APP_DATA_VERSION = newVersion;
                    console.log(`📦 [SYNC INDEX] Updated app_data_version to: ${newVersion}`);

                    // 🚀 Emit custom event - svi paneli će biti obavješteni
                    window.dispatchEvent(new CustomEvent('app-data-synced', {
                        detail: {
                            version: newVersion,
                            type: 'index-sync',
                            timestamp: new Date().toISOString()
                        }
                    }));
                    console.log('📢 [SYNC INDEX] Emitted "app-data-synced" event');

                    // Prikaži rezultat sa detaljima
                    const detailMsg = `Obrađeno: ${data.filesProcessed || 0} fajlova, Preskočeno: ${data.filesSkipped || 0}\nPRIMKA: +${data.primkaAdded || 0}, OTPREMA: +${data.otpremaAdded || 0}`;
                    showSuccess('✅ Indeksiranje završeno', detailMsg);

                    // Osvježi sve prikaze nakon indeksiranja
                    console.log('[SYNC INDEX] Refreshing all views...');
                    setTimeout(() => {
                        preloadAllViews(true).then(() => {
                            console.log('[SYNC INDEX] ✅ All views refreshed after sync');
                        });
                    }, 2000);
                } else {
                    console.error('[SYNC INDEX] ✗ Index synchronization failed:', data.error);
                    showError('❌ Greška', data.error || 'Indeksiranje nije uspjelo');
                }

            } catch (error) {
                console.error('[SYNC INDEX] ERROR:', error);
                showError('❌ Greška', 'Greška pri indeksiranju: ' + error.message);
            }
        }

        // Helper: Queue processor - limitira paralelne API pozive
        async function processQueue(items, processor, maxConcurrent = 3) {
            const results = [];
            const executing = [];

            for (const item of items) {
                const promise = processor(item).then(result => {
                    executing.splice(executing.indexOf(promise), 1);
                    return result;
                });
                results.push(promise);
                executing.push(promise);

                if (executing.length >= maxConcurrent) {
                    await Promise.race(executing);
                }
            }

            return Promise.all(results);
        }

        // Preload all views function
        // silent = ne prikazuje notifikacije (za auto-preload pri loginu)
        // forceRefresh = brisuje cache i fetchuje svježe podatke (za ručni klik)
        let preloadScheduled = false; // Prevent duplicate preload scheduling
        async function preloadAllViews(silent = false, forceRefresh = false) {
            const year = new Date().getFullYear();
            let totalLoaded = 0;
            let totalFailed = 0;
            let totalViews = 0;

            try {
                // Determine user type (case-insensitive)
                const userType = (currentUser.type || '').toLowerCase();

                let allViews = [];

                if (userType === 'admin') {
                    // 🚀 KOMPLETNI PRELOAD - SVE UČITAJ (svi meniji + PODMENIJI)!
                    const currentMonth = new Date().getMonth(); // 0-11
                    const currentMonthNum = currentMonth + 1; // 1-12 (za cache key koji koristi loadDashboard)

                    allViews = [
                        // Glavni meniji
                        { name: 'Dashboard', url: buildApiUrl('dashboard', { year }), cacheKey: 'cache_dashboard_' + year + '_m' + currentMonthNum, timeout: 180000 },
                        // Operativa tab koristi cache_dashboard_${year} (bez sufiks-a mjeseca)
                        { name: 'Operativa - Dashboard', url: buildApiUrl('dashboard', { year }), cacheKey: 'cache_dashboard_' + year, timeout: 60000 },
                        { name: 'Operativa (Stats)', url: buildApiUrl('stats', { year }), cacheKey: 'cache_stats_' + year, timeout: 180000 },
                        { name: 'Stanje Odjela', url: buildApiUrl('odjeli', { year }), cacheKey: 'cache_odjeli_' + year, timeout: 180000 },
                        // SKIP: Stanje Odjela Admin se učitava lazy (kad korisnik klikne na tab) jer može trajati dugo
                        // { name: 'Stanje Odjela Admin', url: buildApiUrl('stanje-odjela'), cacheKey: 'cache_stanje_odjela_admin', timeout: 180000 },
                        { name: 'Kupci', url: buildApiUrl('kupci', { year }), cacheKey: 'cache_kupci_' + year, timeout: 180000 },
                        { name: 'Pending Unosi', url: buildApiUrl('pending-unosi'), cacheKey: 'cache_pending_unosi', timeout: 120000 },
                        { name: 'Mjesečni Sortimenti', url: buildApiUrl('mjesecni-sortimenti', { year }), cacheKey: 'cache_mjesecni_sortimenti_' + year, timeout: 120000 },
                        { name: 'Dinamika', url: buildApiUrl('get_dinamika', { year }), cacheKey: 'cache_dinamika_' + year, timeout: 120000 },

                        // PRIMACI meni + SVA 4 PODMENIJA
                        { name: 'Primaci - Monthly', url: buildApiUrl('primaci', { year }), cacheKey: 'cache_primaci_' + year, timeout: 180000 },
                        { name: 'Primaci - Daily', url: buildApiUrl('primaci-daily', { year, month: currentMonth }), cacheKey: 'cache_primaci_daily_' + year + '_' + currentMonth, timeout: 180000 },
                        { name: 'Primaci - Po radilištu', url: buildApiUrl('primaci-by-radiliste', { year }), cacheKey: 'cache_primaci_radiliste_' + year, timeout: 180000 },
                        { name: 'Primaci - Po izvođaču', url: buildApiUrl('primaci-by-izvodjac', { year }), cacheKey: 'cache_primaci_izvodjac_' + year, timeout: 180000 },

                        // OTPREMACI meni + SVA 3 PODMENIJA
                        { name: 'Otpremaci - Monthly', url: buildApiUrl('otpremaci', { year }), cacheKey: 'cache_otpremaci_' + year, timeout: 180000 },
                        { name: 'Otpremaci - Daily', url: buildApiUrl('otpremaci-daily', { year, month: currentMonth }), cacheKey: 'cache_otpremaci_daily_' + year + '_' + currentMonth, timeout: 180000 },
                        { name: 'Otpremaci - Po radilištu', url: buildApiUrl('otpremaci-by-radiliste', { year }), cacheKey: 'cache_otpremaci_radiliste_' + year, timeout: 180000 },

                        // STANJE ZALIHA
                        { name: 'Stanje Zaliha', url: buildApiUrl('stanje-zaliha'), cacheKey: 'cache_stanje_zaliha', timeout: 180000 },

                        // PRIMACI ADMIN (koristi isti endpoint kao primaci monthly)
                        { name: 'Primaci Admin', url: buildApiUrl('primaci', { year }), cacheKey: 'cache_primaci_' + year, timeout: 180000 },

                        // SORTIMENTI PO PRIMAC/OTPREMAC (tekući mjesec)
                        { name: 'Primaci - Sortimenti po primaču', url: buildApiUrl('primaci-sortimenti-by-primac', { year, month: currentMonth }), cacheKey: 'cache_primaci_sort_primac_' + year + '_' + currentMonth, timeout: 180000 },
                        { name: 'Otpremaci - Sortimenti po otpremaču', url: buildApiUrl('otpremaci-sortimenti-by-otpremac', { year, month: currentMonth }), cacheKey: 'cache_otpremaci_sort_otpremac_' + year + '_' + currentMonth, timeout: 180000 },

                        // OTPREMACI PO KUPCIMA (koristi isti endpoint kao kupci)
                        { name: 'Otpremaci - Po kupcima', url: buildApiUrl('kupci', { year }), cacheKey: 'cache_kupci_' + year, timeout: 180000 },
                    ];

                } else if (userType === 'poslovođa' || userType === 'poslovodja') {
                    var pName = currentUser ? currentUser.fullName : '';
                    var pCK = 'cache_stanje_zaliha_' + (pName || 'all').replace(/\s+/g, '_');
                    allViews = [
                        { name: 'Stanje Zaliha', url: buildApiUrl('stanje-zaliha', { poslovodja: pName }), cacheKey: pCK, timeout: 60000 },
                        { name: 'Primke (Sječa)', url: buildApiUrl('primke'), cacheKey: 'cache_primke_sjeca', timeout: 120000 },
                        { name: 'Otpreme', url: buildApiUrl('otpreme'), cacheKey: 'cache_otpreme_tab', timeout: 120000 }
                    ];

                } else if (userType === 'operativa') {
                    const currentMonth = new Date().getMonth(); // 0-11
                    allViews = [
                        { name: 'Dashboard', url: buildApiUrl('dashboard', { year }), cacheKey: 'cache_dashboard_' + year, timeout: 180000 },
                        { name: 'Operativa (Stats)', url: buildApiUrl('stats', { year }), cacheKey: 'cache_stats_' + year, timeout: 180000 },
                        { name: 'Kupci', url: buildApiUrl('kupci', { year }), cacheKey: 'cache_kupci_' + year, timeout: 180000 },
                        { name: 'Mjesečni Sortimenti', url: buildApiUrl('mjesecni-sortimenti', { year }), cacheKey: 'cache_mjesecni_sortimenti_' + year, timeout: 120000 }
                    ];

                } else if (userType === 'primac') {
                    const currentMonth = new Date().getMonth(); // 0-11
                    allViews = [
                        // Pregled sječe (primac-personal)
                        { name: 'Pregled sječe', url: buildApiUrl('primac-detail', { year }), cacheKey: 'cache_primac_detail_' + year, timeout: 120000 },
                        // Godišnji prikaz
                        { name: 'Godišnji prikaz', url: buildApiUrl('primac-detail', { year }), cacheKey: 'cache_primac_godisnji_' + year, timeout: 120000 },
                        // Prikaz po odjelima
                        { name: 'Prikaz po odjelima', url: buildApiUrl('primac-odjeli', { limit: 15 }), cacheKey: 'cache_primac_odjeli_top15', timeout: 120000 },
                        // Moje sječe
                        { name: 'Moje sječe', url: buildApiUrl('my-pending', { tip: 'sjeca' }), cacheKey: 'cache_my_sjece_' + (currentUser.username || ''), timeout: 120000 },
                        // Izvještaji - sedmični (tekući mjesec)
                        { name: 'Izvještaji (sedmični)', url: buildApiUrl('primac-detail', { year }), cacheKey: 'cache_primac_sedmicni_' + year + '_' + currentMonth, timeout: 120000 },
                        // Izvještaji - mjesečni (tekući mjesec)
                        { name: 'Izvještaji (mjesečni)', url: buildApiUrl('primac-detail', { year }), cacheKey: 'cache_primac_mjesecni_' + year + '_' + currentMonth, timeout: 120000 }
                    ];
                } else if (userType === 'otpremac') {
                    const currentMonth = new Date().getMonth(); // 0-11
                    allViews = [
                        // Pregled otpreme (otpremac-personal)
                        { name: 'Pregled otpreme', url: buildApiUrl('otpremac-detail', { year }), cacheKey: 'cache_otpremac_detail_' + year, timeout: 120000 },
                        // Godišnji prikaz
                        { name: 'Godišnji prikaz', url: buildApiUrl('otpremac-detail', { year }), cacheKey: 'cache_otpremac_godisnji_' + year, timeout: 120000 },
                        // Prikaz po odjelima
                        { name: 'Prikaz po odjelima', url: buildApiUrl('otpremac-odjeli', { limit: 15 }), cacheKey: 'cache_otpremac_odjeli_top15', timeout: 120000 },
                        // Moje otpreme
                        { name: 'Moje otpreme', url: buildApiUrl('my-pending', { tip: 'otprema' }), cacheKey: 'cache_my_otpreme_' + (currentUser.username || ''), timeout: 120000 },
                        // Izvještaji - sedmični (tekući mjesec)
                        { name: 'Izvještaji (sedmični)', url: buildApiUrl('otpremac-detail', { year }), cacheKey: 'cache_otpremac_sedmicni_' + year + '_' + currentMonth, timeout: 120000 },
                        // Izvještaji - mjesečni (tekući mjesec)
                        { name: 'Izvještaji (mjesečni)', url: buildApiUrl('otpremac-detail', { year }), cacheKey: 'cache_otpremac_mjesecni_' + year + '_' + currentMonth, timeout: 120000 }
                    ];
                }

                // Skip views that are already cached (unless forceRefresh)
                if (!forceRefresh) {
                    const smartTTL = getSmartCacheTTL();
                    const uncachedViews = allViews.filter(view => {
                        try {
                            const cached = localStorage.getItem(view.cacheKey);
                            if (cached) {
                                const cachedData = JSON.parse(cached);
                                if (cachedData.data && !cachedData.data.error && (Date.now() - cachedData.timestamp) < smartTTL) {
                                    return false; // Already cached & fresh - skip
                                }
                            }
                        } catch (e) {}
                        return true; // Not cached or stale - fetch
                    });
                    const skipped = allViews.length - uncachedViews.length;
                    if (skipped > 0) {
                        console.log(`[PRELOAD] Skipping ${skipped} already-cached views, fetching ${uncachedViews.length} remaining`);
                    }
                    allViews = uncachedViews;
                }

                totalViews = allViews.length;

                if (totalViews === 0) {
                    console.log('[PRELOAD] All views already cached - nothing to fetch!');
                    return;
                }

                // Progress toast - ostaje vidljiv tokom učitavanja (duration=0 = ne briše se automatski)
                let progressToast = null;
                if (!silent) {
                    progressToast = showInfo('⚡ Učitavanje...', `0 / ${totalViews} prikaza`, 0);
                }

                console.log(`[PRELOAD] Starting preload of ${totalViews} views (silent=${silent})...`);

                // OPTIMIZIRANO UČITAVANJE - max 8 paralelnih poziva
                await processQueue(allViews, async (view) => {
                    try {
                        await fetchWithCache(view.url, view.cacheKey, forceRefresh, view.timeout);
                        totalLoaded++;
                        console.log(`[PRELOAD] ✓ ${view.name} loaded (${totalLoaded}/${totalViews})`);
                        // Ažuriraj progress toast u realnom vremenu
                        if (!silent && progressToast) {
                            const msgEl = progressToast.querySelector('.toast-message');
                            if (msgEl) msgEl.textContent = `${totalLoaded} / ${totalViews} prikaza`;
                        }
                        return { success: true, name: view.name };
                    } catch (error) {
                        totalFailed++;
                        totalLoaded++;
                        console.error(`[PRELOAD] ✗ ${view.name} failed:`, error);
                        if (!silent && progressToast) {
                            const msgEl = progressToast.querySelector('.toast-message');
                            if (msgEl) msgEl.textContent = `${totalLoaded} / ${totalViews} prikaza`;
                        }
                        return { success: false, name: view.name };
                    }
                }, 8); // Max 8 paralelnih poziva

                console.log(`[PRELOAD] Finished! Loaded: ${totalLoaded}/${totalViews}, Failed: ${totalFailed}`);

                // Ukloni progress toast i prikaži rezultat
                if (!silent) {
                    if (progressToast) {
                        progressToast.classList.remove('show');
                        progressToast.classList.add('hide');
                        setTimeout(() => progressToast && progressToast.remove(), 300);
                    }
                    const uspjesno = totalLoaded - totalFailed;
                    if (uspjesno > 0) {
                        showSuccess('⚡ Gotovo!', `✅ Učitano ${uspjesno}/${totalViews} prikaza${totalFailed > 0 ? ` (${totalFailed} nije uspjelo)` : ' 🎉'}`);
                    } else {
                        showError('Greška', 'Nije učitano nijedan prikaz. Server je možda nedostupan.');
                    }
                }

            } catch (error) {
                console.error('[PRELOAD] Error:', error);
                if (!silent) {
                    showError('Greška', 'Greška pri učitavanju prikaza.');
                }
            }
        }

        // Toggle user menu dropdown
        function toggleUserMenu(event) {
            if (event) {
                event.stopPropagation();
            }
            const dropdown = document.getElementById('user-menu-dropdown');
            dropdown.classList.toggle('show');
        }

        // Close user menu dropdown
        function closeUserMenu() {
            const dropdown = document.getElementById('user-menu-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        }

        // Close user menu when clicking outside
        document.addEventListener('click', function(event) {
            const userMenu = document.querySelector('.user-menu');
            const dropdown = document.getElementById('user-menu-dropdown');
            if (userMenu && !userMenu.contains(event.target) && dropdown) {
                dropdown.classList.remove('show');
            }
        });

        // ========== END CACHING ==========

        let currentUser = null;
        let currentPassword = null;
        let odjeliList = [];

        // Global data version for cache invalidation across panels
        window.APP_DATA_VERSION = localStorage.getItem('app_data_version') || '1';

        // Helper function to build secure API URLs with encoded credentials
        function buildApiUrl(path, additionalParams = {}) {
            const params = new URLSearchParams();
            params.append('path', path);
            if (currentUser && currentUser.username) {
                params.append('username', currentUser.username);
            }
            if (currentPassword) {
                params.append('password', currentPassword);
            }
            // Add any additional parameters
            for (const [key, value] of Object.entries(additionalParams)) {
                if (value !== null && value !== undefined) {
                    params.append(key, value);
                }
            }
            return `${API_URL}?${params.toString()}`;
        }

        // POSLOVOĐA RADILIŠTA MAPPING (dohvaćeno sa API-ja iz INFO sheeta)
        // Hardkodirani fallback ako API ne vrati podatke
        const POSLOVODJA_RADILISTA_FALLBACK = {
            'MEHMEDALIJA HARBAŠ': ['BJELAJSKE UVALE', 'VOJSKOVA'],
            'HARBAŠ MEHMEDALIJA': ['BJELAJSKE UVALE', 'VOJSKOVA'],
            'JASMIN PORIĆ': ['RADIĆKE UVALE'],
            'PORIĆ JASMIN': ['RADIĆKE UVALE'],
            'IRFAN HADŽIPAŠIĆ': ['TURSKE VODE'],
            'HADŽIPAŠIĆ IRFAN': ['TURSKE VODE']
        };
        let _poslovodjaRadilistaFromApi = null;

        // Dohvati poslovodja→radilista mapping sa API-ja (iz INFO sheeta)
        async function loadPoslovodjaRadilistaMapping() {
            if (!currentUser) return;
            var url = buildApiUrl('poslovodja-radilista', { poslovodja: currentUser.fullName });
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    var response = await fetch(url);
                    var data = await response.json();
                    if (data && data.radilista && data.radilista.length > 0) {
                        _poslovodjaRadilistaFromApi = data.radilista;
                        console.log('[RADILISTA] Loaded from INFO sheet:', _poslovodjaRadilistaFromApi);
                    }
                    return; // Success, exit
                } catch (e) {
                    if (attempt < 3) {
                        console.warn(`[RADILISTA] Fetch failed (attempt ${attempt}/3), retrying...`, e.message);
                        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                    } else {
                        console.warn('[RADILISTA] API fetch failed after 3 attempts, using fallback:', e.message);
                    }
                }
            }
        }

        // Load odjeli list from API
        async function loadOdjeli() {
            try {
                const url = API_URL + '?path=get-odjeli-list';
                const cacheKey = 'cache_odjeli_list';

                // 🚀 Koristi cache sa TTL od 6 sati (odjeli se ne mijenjaju često)
                const data = await fetchWithCache(url, cacheKey, false, 30000);

                if (data.success && data.odjeli) {
                    odjeliList = data.odjeli;
                    populateOdjeliDropdowns();
                }
            } catch (error) {
                console.error('Error loading odjeli:', error);
            }
        }

        // Populate all odjel dropdowns
        function populateOdjeliDropdowns() {
            const dropdowns = [
                'sjeca-odjel',
                'otprema-odjel',
                'edit-sjeca-odjel',
                'edit-otprema-odjel'
            ];

            dropdowns.forEach(dropdownId => {
                const dropdown = document.getElementById(dropdownId);
                if (dropdown) {
                    // Keep the first "Izaberi odjel..." option
                    const currentValue = dropdown.value;
                    dropdown.innerHTML = '<option value="">Izaberi odjel...</option>';

                    odjeliList.forEach(odjel => {
                        const option = document.createElement('option');
                        option.value = odjel;
                        option.textContent = odjel;
                        dropdown.appendChild(option);
                    });

                    // Restore previously selected value if it exists
                    if (currentValue && odjeliList.includes(currentValue)) {
                        dropdown.value = currentValue;
                    }
                }
            });
        }

        // Initialize year selectors with current year
        function initializeYearSelectors() {
            const currentYear = new Date().getFullYear();
            const yearSelects = document.querySelectorAll('.year-select, [id*="year"]');

            yearSelects.forEach(select => {
                if (select.tagName === 'SELECT' && !select.id.includes('month')) {
                    // Populate with years: current year and previous year only
                    const options = [];
                    for (let i = 0; i <= 1; i++) {
                        const year = currentYear - i;
                        options.push(`<option value="${year}" ${i === 0 ? 'selected' : ''}>${year}</option>`);
                    }
                    select.innerHTML = options.join('');
                }
            });

            // Update any year badges/spans
            const yearBadges = document.querySelectorAll('[id*="year-badge"], #dinamika-selected-year');
            yearBadges.forEach(badge => {
                badge.textContent = currentYear;
            });

        }

        // Main initialization on page load
        window.addEventListener('DOMContentLoaded', () => {
            // ========== HARD RELOAD DETECTION ==========
            // Check if this is a hard reload from "Obriši keš" button
            const url = new URL(window.location.href);
            const isHardReload = url.searchParams.has('nocache');

            if (isHardReload) {
                console.log('[CACHE CLEAR] ✅ HARD RELOAD COMPLETED!');
                console.log('[CACHE CLEAR] Cleaning URL query parameters...');

                // Clean URL by removing nocache param
                url.searchParams.delete('nocache');
                const cleanUrl = url.pathname + url.search + url.hash;

                // Replace URL without reloading page
                window.history.replaceState({}, document.title, cleanUrl);
                console.log('[CACHE CLEAR] ✓ URL cleaned:', cleanUrl);
                console.log('[CACHE CLEAR] All caches cleared, Service Worker unregistered, fresh start!');

                // Show visual confirmation
                showSuccess('✅ Hard Refresh Završen', 'Svi cache-ovi obrisani, Service Worker reinstaliran!');
            }

            // Initialize year selectors first
            initializeYearSelectors();


            // Load desktop view preference
            const desktopView = localStorage.getItem('desktop-view');
            if (desktopView === 'enabled') {
                document.body.classList.add('force-desktop-view');
                const btn = document.getElementById('desktop-view-btn');
                if (btn) {
                    btn.classList.add('active');
                    btn.title = 'Prebaci na mobilni prikaz';
                }
                let viewport = document.querySelector('meta[name=viewport]');
                if (viewport) {
                    viewport.setAttribute('content', 'width=1200, initial-scale=0.5, user-scalable=yes');
                }
            }

            // Load Android view preference
            const androidView = localStorage.getItem('android-view');
            if (androidView === 'enabled') {
                document.body.classList.add('force-android-view');
                const aBtn = document.getElementById('android-view-btn');
                if (aBtn) {
                    aBtn.classList.add('active');
                    aBtn.title = 'Isključi Android prikaz';
                }
                let vpAndroid = document.querySelector('meta[name=viewport]');
                if (vpAndroid) {
                    vpAndroid.setAttribute('content', 'width=1200, initial-scale=0.5, user-scalable=yes');
                }
            }

            // Add event listeners for dinamika calculation inputs
            for (let i = 1; i <= 12; i++) {
                const mjesecKey = String(i).padStart(2, '0');
                const inputId = 'dinamika-' + mjesecKey;
                const inputElem = document.getElementById(inputId);
                if (inputElem) {
                    inputElem.addEventListener('input', calculateDinamikaTotal);
                }
            }

            // Check if already logged in
            const savedUser = localStorage.getItem('sumarija_user');
            const savedPass = localStorage.getItem('sumarija_pass');

            if (savedUser && savedPass) {
                currentUser = JSON.parse(savedUser);
                currentPassword = savedPass;
                showApp();
                loadPoslovodjaRadilistaMapping(); // Dohvati poslovodja→radilista iz INFO sheeta
                loadOdjeli(); // Load odjeli list after auto-login

                // Učitaj početni prikaz PA TEK ONDA preload ostale
                const initialLoad = loadData();

                // 🚀 AUTO-PRELOAD: Čekaj da početni prikaz završi, pa tek onda preloaduj ostalo
                if (!preloadScheduled) {
                    preloadScheduled = true;
                    Promise.resolve(initialLoad).then(() => {
                        console.log('[AUTO-PRELOAD] Initial view loaded, starting background preload...');
                        return preloadAllViews(true);
                    }).then(() => {
                        console.log('[AUTO-PRELOAD] ✅ All views preloaded in background!');
                        preloadScheduled = false;
                    }).catch(err => {
                        console.error('[AUTO-PRELOAD] ⚠️ Preload failed:', err);
                        preloadScheduled = false;
                    });
                }
            }
        });

        // Log cache statistics when page is closed
        window.addEventListener('beforeunload', () => {
            logCacheStats();
        });

        // ========== MOVED TO js/auth.js ==========
        // Login form handler, showApp, logout, loadData, setupAutoRefreshListeners,
        // setupScheduledRefresh, setupCrossTabSync
        // ========== MOVED TO js/ui.js ==========
        // Load dashboard data
        async function loadDashboard() {
            try {
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth() + 1; // 1-12
                // Cache key uključuje mjesec - automatski se invalidira kad se promijeni mjesec
                const cacheKey = 'cache_dashboard_' + year + '_m' + month;
                const url = buildApiUrl('dashboard', { year });

                // 🚀 TURBO MODE: INSTANT SHOW CACHED DATA (zero delay!)
                let hasCachedData = false;
                const cachedDashboard = localStorage.getItem(cacheKey);
                if (cachedDashboard) {
                    try {
                        const parsed = JSON.parse(cachedDashboard);
                        if (parsed.data && parsed.data.mjesecnaStatistika) {
                            // ✨ INSTANT: Show cached data immediately WITHOUT loading screen
                            if (!isActiveTab('dashboard')) return;
                            document.getElementById('loading-screen').classList.add('hidden');
                            document.getElementById('dashboard-content').classList.remove('hidden');
                            await renderDashboard(parsed.data);
                            hasCachedData = true;

                            // Show cache age indicator
                            const age = Date.now() - parsed.timestamp;
                            showCacheIndicator(age);
                        }
                    } catch (e) {
                        console.error('Cache parse error:', e);
                    }
                }

                // If no cache, show loading screen
                if (!hasCachedData) {
                    document.getElementById('loading-screen').classList.remove('hidden');
                    document.getElementById('dashboard-content').classList.add('hidden');
                }

                // 🔄 BACKGROUND REFRESH: Fetch fresh data in background (180s timeout - super patient!)
                try {
                    const data = await fetchWithCache(url, cacheKey, false, 180000);

                    if (data.error) {
                        if (!hasCachedData) throw new Error(data.error);
                        markTabRendered('dashboard');
                        return;
                    }

                    // Silently update with fresh data
                    if (!isActiveTab('dashboard')) return;
                    await renderDashboard(data);

                    // Hide cache indicator when fresh data arrives
                    hideCacheIndicator();
                    markTabRendered('dashboard');

                } catch (error) {
                    // If we have cached data, silently ignore errors - user already has data!
                    if (!hasCachedData) {
                        throw error;
                    } else {
                        // Silently failed but user already has cached data - no problem!
                        markTabRendered('dashboard');
                    }
                }

            } catch (error) {
                console.error('Dashboard error:', error);

                // Determine error type and show appropriate message
                let errorTitle = 'Greška pri učitavanju';
                let errorMessage = error.message;
                let errorIcon = '⚠️';

                // CORS or network errors
                if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('CORS'))) {
                    errorIcon = '🌐';
                    errorTitle = 'Offline and no cached data available';
                    errorMessage = 'Ne mogu pristupiti serveru. Provjeri internet vezu ili pokušaj ponovo.';
                } else if (error.message && error.message.includes('Server je spor')) {
                    errorIcon = '⏱️';
                    errorTitle = 'Vremensko ograničenje prekoračeno';
                    errorMessage = 'Server ne odgovara dovoljno brzo. Molimo pokušajte ponovo ili pričekajte par minuta.';
                } else if (error.message && error.message.includes('Nema podataka')) {
                    errorIcon = '📭';
                    errorTitle = 'Nema podataka';
                }

                document.getElementById('loading-screen').innerHTML = `
                    <div class="loading-icon">${errorIcon}</div>
                    <div class="loading-text">${errorTitle}</div>
                    <div class="loading-sub">${errorMessage}</div>
                    <button class="btn btn-primary" style="margin-top: 20px;" onclick="loadDashboard()">🔄 Pokušaj ponovo</button>
                `;
            }
        }

        // Separate render function for dashboard
        async function renderDashboard(data) {
                // 🚀 KRITIČNO: Učitaj Chart.js PRE korištenja
                await window.loadChartJs();

                const year = new Date().getFullYear();


                // Check for errors
                if (data.error) {
                    throw new Error('Dashboard API error: ' + data.error);
                }

                // Check if data is valid
                if (!data.mjesecnaStatistika) {
                    throw new Error('Dashboard data missing mjesecnaStatistika');
                }

                // Check if array is not empty
                if (!Array.isArray(data.mjesecnaStatistika) || data.mjesecnaStatistika.length === 0) {
                    throw new Error('Nema podataka za prikazivanje. Molimo provjerite da li postoje unosi za ovu godinu.');
                }

                // Validate that each month has required properties
                const hasInvalidData = data.mjesecnaStatistika.some(m =>
                    m.mjesec == null ||
                    (m.sjeca == null && m.otprema == null && m.dinamika == null)
                );

                if (hasInvalidData) {
                    console.warn('⚠️ Some monthly data is incomplete, using fallback values');
                }

                // Calculate summary statistics (safely handle null/undefined values)
                const totalSjeca = data.mjesecnaStatistika.reduce((sum, m) => sum + (m.sjeca || 0), 0);
                const totalOtprema = data.mjesecnaStatistika.reduce((sum, m) => sum + (m.otprema || 0), 0);
                const totalStanje = totalSjeca - totalOtprema;
                const totalDinamika = data.mjesecnaStatistika.reduce((sum, m) => sum + (m.dinamika || 0), 0);
                const razlikaDinamika = totalSjeca - totalDinamika;
                const percentDinamika = totalDinamika > 0 ? ((totalSjeca / totalDinamika) * 100).toFixed(1) : '0.0';

                // Create summary cards
                const summaryHTML = `
                    <div class="summary-card green">
                        <div class="summary-card-title">Sječa</div>
                        <div class="summary-card-value text-outline-dark">${totalSjeca.toFixed(0)} m³</div>
                        <div class="summary-card-subtitle">${percentDinamika}% dinamike</div>
                    </div>
                    <div class="summary-card blue">
                        <div class="summary-card-title">Otprema</div>
                        <div class="summary-card-value text-outline-dark">${totalOtprema.toFixed(0)} m³</div>
                        <div class="summary-card-subtitle">${totalSjeca > 0 ? ((totalOtprema/totalSjeca)*100).toFixed(1) : '0.0'}% od sječe</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-card-title">Šuma/Panj</div>
                        <div class="summary-card-value text-outline-dark">${totalStanje.toFixed(0)} m³</div>
                        <div class="summary-card-subtitle">Preostalo u šumi</div>
                    </div>
                    <div class="summary-card ${razlikaDinamika >= 0 ? 'green' : 'red'}">
                        <div class="summary-card-title">Razlika sa Dinamikom</div>
                        <div class="summary-card-value text-outline-dark">${(razlikaDinamika >= 0 ? '+' : '') + razlikaDinamika.toFixed(0)} m³</div>
                        <div class="summary-card-subtitle">${razlikaDinamika >= 0 ? 'Iznad plana' : 'Ispod plana'}</div>
                    </div>
                `;
                document.getElementById('summary-cards').innerHTML = summaryHTML;

                // Create chart
                const labels = data.mjesecnaStatistika.map(m => m.mjesec);
                const sjecaData = data.mjesecnaStatistika.map(m => m.sjeca);
                const otpremaData = data.mjesecnaStatistika.map(m => m.otprema);
                const dinamikaData = data.mjesecnaStatistika.map(m => m.dinamika);

                const ctx = document.getElementById('trendsChart');
                if (window.dashboardChart) {
                    window.dashboardChart.destroy();
                }
                window.dashboardChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Sječa',
                            data: sjecaData,
                            borderColor: '#059669',
                            backgroundColor: 'rgba(5, 150, 105, 0.1)',
                            tension: 0.4,
                            fill: true
                        }, {
                            label: 'Otprema',
                            data: otpremaData,
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            tension: 0.4,
                            fill: true
                        }, {
                            label: 'Dinamika',
                            data: dinamikaData,
                            borderColor: '#dc2626',
                            borderDash: [5, 5],
                            tension: 0.4,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: { mode: 'index', intersect: false }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'm³' } }
                        }
                    }
                });

                // Populate monthly table with UKUPNO row and future month handling
                const currentMonth = new Date().getMonth(); // 0-indexed (0 = Januar)
                const mjesecNames = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

                // Helper to get month index from month name
                const getMonthIndex = (monthName) => {
                    if (!monthName) return -1;
                    const normalizedName = monthName.trim().toLowerCase();
                    return mjesecNames.findIndex(m => m.toLowerCase() === normalizedName);
                };

                // Calculate YTD dinamika (totalSjeca and totalOtprema already calculated above)
                let ytdDinamikaSjeca = 0;  // Sum of dinamika for months up to current
                let ytdDinamikaOtprema = 0;
                let ytdSjeca = 0;  // Sum of sjeca for months up to current
                let ytdOtprema = 0;  // Sum of otprema for months up to current

                data.mjesecnaStatistika.forEach(m => {
                    const sjeca = m.sjeca || 0;
                    const otprema = m.otprema || 0;
                    const dinamika = m.dinamika || 0;
                    const monthIdx = getMonthIndex(m.mjesec);

                    // Only include months up to and including current month in YTD calculations
                    if (monthIdx >= 0 && monthIdx <= currentMonth) {
                        ytdDinamikaSjeca += dinamika;
                        ytdDinamikaOtprema += dinamika;
                        ytdSjeca += sjeca;
                        ytdOtprema += otprema;
                    }
                });

                const totalZaliha = totalSjeca - totalOtprema;

                // Render monthly rows
                const monthlyHTML = data.mjesecnaStatistika.map(m => {
                    const sjeca = m.sjeca || 0;
                    const otprema = m.otprema || 0;
                    const dinamika = m.dinamika || 0;
                    const monthIdx = getMonthIndex(m.mjesec);
                    const isFutureMonth = monthIdx > currentMonth;

                    // For future months, show "—" in DINAMIKA columns
                    if (isFutureMonth) {
                        return `
                            <tr>
                                <td>${m.mjesec || '-'}</td>
                                <td class="number green" style="min-width: 120px; font-size: 15px; font-weight: 600;">${(m.sjeca != null && !isNaN(m.sjeca)) ? m.sjeca.toFixed(2) : '0.00'}</td>
                                <td class="number blue" style="min-width: 120px; font-size: 15px; font-weight: 600;">${(m.otprema != null && !isNaN(m.otprema)) ? m.otprema.toFixed(2) : '0.00'}</td>
                                <td class="number">${(m.stanje != null && !isNaN(m.stanje)) ? m.stanje.toFixed(2) : '0.00'}</td>
                                <td class="number dinamika-dash" style="text-align: center;">—</td>
                                <td class="number dinamika-dash" style="text-align: center;">—</td>
                            </tr>
                        `;
                    }

                    const progressSjeca = dinamika > 0 ? ((sjeca / dinamika) * 100).toFixed(1) : '0.0';
                    const progressOtprema = dinamika > 0 ? ((otprema / dinamika) * 100).toFixed(1) : '0.0';

                    // Izračunaj koliko je ostalo do dinamike
                    const ostaloSjeca = dinamika - sjeca;
                    const ostaloOtprema = dinamika - otprema;

                    // Format prikaza: npr. "-1345 m³" ako je ostalo, "+123 m³" ako je prekoračeno
                    const formatOstalo = (ostalo) => {
                        if (ostalo > 0) {
                            return `<span style="color: #dc2626;">−${ostalo.toFixed(0)} m³</span>`;
                        } else if (ostalo < 0) {
                            return `<span style="color: #059669;">+${Math.abs(ostalo).toFixed(0)} m³</span>`;
                        }
                        return `<span style="color: #059669;">✓ 0 m³</span>`;
                    };

                    return `
                        <tr>
                            <td>${m.mjesec || '-'}</td>
                            <td class="number green" style="min-width: 120px; font-size: 15px; font-weight: 600;">${(m.sjeca != null && !isNaN(m.sjeca)) ? m.sjeca.toFixed(2) : '0.00'}</td>
                            <td class="number blue" style="min-width: 120px; font-size: 15px; font-weight: 600;">${(m.otprema != null && !isNaN(m.otprema)) ? m.otprema.toFixed(2) : '0.00'}</td>
                            <td class="number">${(m.stanje != null && !isNaN(m.stanje)) ? m.stanje.toFixed(2) : '0.00'}</td>
                            <td class="number">
                                ${(m.dinamika != null && !isNaN(m.dinamika)) ? m.dinamika.toFixed(2) : '0.00'}
                                <div class="table-progress-bar">
                                    <div class="table-progress-fill" style="width: ${Math.min(progressSjeca, 100)}%; background: #059669;"></div>
                                </div>
                                <small style="color: #6b7280;">${formatOstalo(ostaloSjeca)} ; ${progressSjeca}%</small>
                            </td>
                            <td class="number">
                                ${(m.dinamika != null && !isNaN(m.dinamika)) ? m.dinamika.toFixed(2) : '0.00'}
                                <div class="table-progress-bar">
                                    <div class="table-progress-fill" style="width: ${Math.min(progressOtprema, 100)}%; background: #2563eb;"></div>
                                </div>
                                <small style="color: #6b7280;">${formatOstalo(ostaloOtprema)} ; ${progressOtprema}%</small>
                            </td>
                        </tr>
                    `;
                }).join('');
                document.getElementById('dashboard-monthly-table').innerHTML = monthlyHTML;

                // Calculate YTD progress percentages for UKUPNO row
                const ukupnoProgressSjeca = ytdDinamikaSjeca > 0 ? ((ytdSjeca / ytdDinamikaSjeca) * 100).toFixed(1) : '0.0';
                const ukupnoProgressOtprema = ytdDinamikaOtprema > 0 ? ((ytdOtprema / ytdDinamikaOtprema) * 100).toFixed(1) : '0.0';

                // Izračunaj koliko je ostalo do dinamike za UKUPNO
                const ukupnoOstaloSjeca = ytdDinamikaSjeca - ytdSjeca;
                const ukupnoOstaloOtprema = ytdDinamikaOtprema - ytdOtprema;

                // Format prikaza za UKUPNO
                const formatOstaloUkupno = (ostalo) => {
                    if (ostalo > 0) {
                        return `<span style="color: #dc2626;">−${ostalo.toFixed(0)} m³</span>`;
                    } else if (ostalo < 0) {
                        return `<span style="color: #059669;">+${Math.abs(ostalo).toFixed(0)} m³</span>`;
                    }
                    return `<span style="color: #059669;">✓ 0 m³</span>`;
                };

                // Render UKUPNO row in tfoot
                const tfootHTML = `
                    <tr class="ukupno-row">
                        <td style="font-weight: 800; text-transform: uppercase; text-align: center;">UKUPNO</td>
                        <td class="number" style="min-width: 120px; font-size: 15px;">${totalSjeca.toFixed(2)}</td>
                        <td class="number" style="min-width: 120px; font-size: 15px;">${totalOtprema.toFixed(2)}</td>
                        <td class="number" style="font-size: 15px;">${totalZaliha.toFixed(2)}</td>
                        <td class="number">
                            ${ytdDinamikaSjeca.toFixed(2)}
                            <div class="table-progress-bar">
                                <div class="table-progress-fill" style="width: ${Math.min(ukupnoProgressSjeca, 100)}%;"></div>
                            </div>
                            <small>${formatOstaloUkupno(ukupnoOstaloSjeca)} ; ${ukupnoProgressSjeca}%</small>
                        </td>
                        <td class="number">
                            ${ytdDinamikaOtprema.toFixed(2)}
                            <div class="table-progress-bar">
                                <div class="table-progress-fill" style="width: ${Math.min(ukupnoProgressOtprema, 100)}%;"></div>
                            </div>
                            <small>${formatOstaloUkupno(ukupnoOstaloOtprema)} ; ${ukupnoProgressOtprema}%</small>
                        </td>
                    </tr>
                `;
                document.getElementById('dashboard-monthly-tfoot').innerHTML = tfootHTML;

                // Load "Tekući mjesec" table
                await loadTekuciMjesecTable();

                // Load "Zadnjih 5 dana" table
                await loadZadnjih5DanaTable();

                // Fetch and populate odjeli table with caching
                const odjeliUrl = buildApiUrl('odjeli', { year });
                const odjeliData = await fetchWithCache(odjeliUrl, 'cache_odjeli_' + year);


                if (odjeliData.error) {
                    console.error('Odjeli API error:', odjeliData.error);
                    document.getElementById('odjeli-table-body').innerHTML = '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Greška pri učitavanju podataka o odjelima</td></tr>';
                } else if (odjeliData.odjeli && odjeliData.odjeli.length > 0) {
                    try {
                        // Build radilište to color class mapping
                        const radilisteSet = [...new Set(odjeliData.odjeli.map(o => (o && o.radiliste) || '').filter(r => r))];
                        const radilisteColorMap = {};
                        radilisteSet.forEach((r, idx) => {
                            radilisteColorMap[r] = 'radiliste-' + ((idx % 10) + 1);
                        });

                        // Helper function for realizacija heatmap class
                        const getRealizacijaClass = (val) => {
                            if (val == null || val <= 0) return '';
                            if (val >= 116) return 'real-over-115';
                            if (val >= 106) return 'real-106-115';
                            if (val >= 76) return 'real-76-105';
                            if (val >= 51) return 'real-51-75';
                            return 'real-0-50';
                        };

                        // Deterministic hash function for izvođač colors
                        const hashString = (str) => {
                            let hash = 0;
                            for (let i = 0; i < str.length; i++) {
                                const char = str.charCodeAt(i);
                                hash = ((hash << 5) - hash) + char;
                                hash = hash & hash;
                            }
                            return Math.abs(hash);
                        };

                        // Build izvođač to color mapping (deterministic via hash)
                        const izvodjacSet = [...new Set(odjeliData.odjeli.map(o => (o && o.izvođač) || '').filter(i => i))];
                        const izvodjacColorMap = {};
                        izvodjacSet.forEach(izv => {
                            const hash = hashString(izv);
                            const hue = hash % 360;
                            const saturation = 35 + (hash % 25); // 35-60%
                            const lightness = 75 + (hash % 15); // 75-90%
                            izvodjacColorMap[izv] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                        });

                        // Month color palette for "Zadnja Sječa" column
                        const mjesecBoje = {
                            1:  { bg: '#dbeafe', color: '#1e40af' },  // Jan - plava
                            2:  { bg: '#e0e7ff', color: '#3730a3' },  // Feb - indigo
                            3:  { bg: '#d1fae5', color: '#065f46' },  // Mar - zelena
                            4:  { bg: '#ccfbf1', color: '#0f766e' },  // Apr - teal
                            5:  { bg: '#fef9c3', color: '#854d0e' },  // Maj - žuta
                            6:  { bg: '#ffedd5', color: '#9a3412' },  // Jun - narandžasta
                            7:  { bg: '#fee2e2', color: '#991b1b' },  // Jul - crvena
                            8:  { bg: '#fce7f3', color: '#9d174d' },  // Aug - roza
                            9:  { bg: '#f3e8ff', color: '#6b21a8' },  // Sep - ljubičasta
                            10: { bg: '#fef3c7', color: '#92400e' },  // Okt - amber
                            11: { bg: '#ecfccb', color: '#3f6212' },  // Nov - lime
                            12: { bg: '#e0f2fe', color: '#075985' }   // Dec - sky
                        };

                        const getSjecaMonthStyle = (datumStr) => {
                            if (!datumStr || datumStr === '-') return '';
                            const parts = datumStr.split('.');
                            if (parts.length < 2) return '';
                            const month = parseInt(parts[1], 10);
                            const m = mjesecBoje[month];
                            if (!m) return '';
                            return `background-color: ${m.bg}; color: ${m.color}; font-weight: 600; border-radius: 4px; padding: 4px 8px;`;
                        };

                        const odjeliHTML = odjeliData.odjeli.map(o => {
                            if (!o) return '';
                            const radilisteClass = radilisteColorMap[o.radiliste] || '';
                            const realizacijaClass = getRealizacijaClass(o.realizacija);
                            const izvodjacBg = izvodjacColorMap[o.izvođač] || '';
                            const izvodjacStyle = izvodjacBg ? `background-color: ${izvodjacBg};` : '';
                            const sjecaDateStyle = getSjecaMonthStyle(o.datumZadnjeSjece);
                            return `
                                <tr>
                                    <td class="${radilisteClass}" style="font-weight: 500;">${o.odjel || '-'}</td>
                                    <td class="right ${radilisteClass}">${(o.sjeca != null && !isNaN(o.sjeca)) ? o.sjeca.toFixed(2) : '0.00'}</td>
                                    <td class="right ${radilisteClass}">${(o.otprema != null && !isNaN(o.otprema)) ? o.otprema.toFixed(2) : '0.00'}</td>
                                    <td class="right ${radilisteClass}">${(o.sumaPanj != null && !isNaN(o.sumaPanj)) ? o.sumaPanj.toFixed(2) : '0.00'}</td>
                                    <td class="${radilisteClass}">${o.radiliste || '-'}</td>
                                    <td style="${izvodjacStyle}">${o.izvođač || '-'}</td>
                                    <td><span style="${sjecaDateStyle}">${o.datumZadnjeSjece || '-'}</span></td>
                                    <td class="right ${realizacijaClass}">${(o.realizacija != null && o.realizacija > 0) ? o.realizacija.toFixed(1) + '%' : '-'}</td>
                                </tr>
                            `;
                        }).join('');
                        document.getElementById('odjeli-table-body').innerHTML = odjeliHTML;
                    } catch (e) {
                        console.error('Error rendering odjeli table:', e);
                        document.getElementById('odjeli-table-body').innerHTML = '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Greška pri prikazu tabele</td></tr>';
                    }
                } else {
                    document.getElementById('odjeli-table-body').innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b7280;">Nema podataka o odjelima</td></tr>';
                }

                // Load pending count for badge (admin only)
                loadPendingCount();

                // Show content (in case it was hidden during initial load)
                if (!isActiveTab('dashboard')) return;
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('dashboard-content').classList.remove('hidden');

                // Set current month in daily chart selector and load chart (currentMonth already defined above)
                const monthSelect = document.getElementById('dashboard-daily-month-select');
                if (monthSelect) {
                    monthSelect.value = currentMonth;
                    loadDashboardDailyChart();
                }
        }

        // ========================================
        // SJEČA I OTPREMA TEKUĆEG MJESECA - Dashboard tabela
        // ========================================
        async function loadTekuciMjesecTable() {
            const headerElem = document.getElementById('tekuci-mjesec-header');
            const bodyElem = document.getElementById('tekuci-mjesec-body');
            const periodElem = document.getElementById('tekuci-mjesec-period');

            try {
                const primkeUrl = buildApiUrl('primke');
                const otpremeUrl = buildApiUrl('otpreme');

                const [primkeData, otpremeData] = await Promise.all([
                    fetchWithCache(primkeUrl, 'cache_primke_tekuci_mjesec'),
                    fetchWithCache(otpremeUrl, 'cache_otpreme_tekuci_mjesec')
                ]);

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

                const formatDate = (date) => {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}.${month}.${year}`;
                };

                const parseDateStr = (dateStr) => {
                    if (!dateStr) return null;
                    const [day, month, year] = dateStr.split('.').map(Number);
                    return new Date(year, month - 1, day);
                };

                if (periodElem) {
                    periodElem.textContent = `(Period: ${formatDate(firstDay)}–${formatDate(today)})`;
                }

                const isInCurrentMonth = (datumStr) => {
                    if (!datumStr || typeof datumStr !== 'string') return false;
                    const d = parseDateStr(datumStr.trim());
                    return d && d >= firstDay && d <= today;
                };

                const sortimentiPrikaz = [
                    { display: 'TRUPCI Č', keys: ['TRUPCI Č'] },
                    { display: 'CEL.D', keys: ['CEL.DUGA'] },
                    { display: 'CEL.C', keys: ['CEL.CIJEPANA'] },
                    { display: 'Σ ČET', keys: ['Σ ČETINARI'] },
                    { display: 'TRUPCI L', keys: ['TRUPCI L'] },
                    { display: 'OGR.D', keys: ['OGR.DUGI'] },
                    { display: 'OGR.C', keys: ['OGR.CIJEPANI'] },
                    { display: 'Σ LIŠ', keys: ['LIŠĆARI'] }
                ];

                const sjecaSortimenti = {};
                sortimentiPrikaz.forEach(s => sjecaSortimenti[s.display] = 0);

                if (primkeData.primke && Array.isArray(primkeData.primke)) {
                    primkeData.primke.forEach(primka => {
                        if (isInCurrentMonth(primka.datum)) {
                            const kolicina = parseFloat(primka.kolicina) || 0;
                            sortimentiPrikaz.forEach(sp => {
                                if (sp.keys.includes(primka.sortiment)) {
                                    sjecaSortimenti[sp.display] += kolicina;
                                }
                            });
                        }
                    });
                }

                let sjecaUkupno = 0;
                sortimentiPrikaz.forEach(sp => {
                    if (!sp.display.startsWith('Σ')) sjecaUkupno += sjecaSortimenti[sp.display] || 0;
                });

                const otpremaSortimenti = {};
                sortimentiPrikaz.forEach(s => otpremaSortimenti[s.display] = 0);

                if (otpremeData.otpreme && Array.isArray(otpremeData.otpreme)) {
                    otpremeData.otpreme.forEach(otprema => {
                        if (isInCurrentMonth(otprema.datum)) {
                            const kolicina = parseFloat(otprema.kolicina) || 0;
                            sortimentiPrikaz.forEach(sp => {
                                if (sp.keys.includes(otprema.sortiment)) {
                                    otpremaSortimenti[sp.display] += kolicina;
                                }
                            });
                        }
                    });
                }

                let otpremaUkupno = 0;
                sortimentiPrikaz.forEach(sp => {
                    if (!sp.display.startsWith('Σ')) otpremaUkupno += otpremaSortimenti[sp.display] || 0;
                });

                const razlikaSortimenti = {};
                sortimentiPrikaz.forEach(sp => {
                    razlikaSortimenti[sp.display] = (sjecaSortimenti[sp.display] || 0) - (otpremaSortimenti[sp.display] || 0);
                });
                const razlikaUkupno = sjecaUkupno - otpremaUkupno;

                // Renderuj header
                let headerHtml = '<tr style="background: linear-gradient(135deg, #047857 0%, #065f46 100%);">';
                headerHtml += '<th style="color: white; font-weight: 600; text-align: left; padding: 8px 10px; font-size: 13px;">Vrsta</th>';
                sortimentiPrikaz.forEach(sort => {
                    headerHtml += `<th style="color: white; font-weight: 600; text-align: right; padding: 8px 6px; font-size: 12px;">${sort.display}</th>`;
                });
                headerHtml += '<th style="color: white; font-weight: 700; text-align: right; padding: 8px 10px; font-size: 13px; background: #064e3b;">UKUPNO</th>';
                headerHtml += '</tr>';
                headerElem.innerHTML = headerHtml;

                // Renderuj body
                let bodyHtml = '';

                bodyHtml += '<tr style="background: #f0fdf4;">';
                bodyHtml += '<td style="font-weight: 600; color: #047857; padding: 8px 10px; font-size: 13px;">🌲 Sječa</td>';
                sortimentiPrikaz.forEach(sort => {
                    const val = sjecaSortimenti[sort.display] || 0;
                    const display = val > 0 ? val.toFixed(2) : '-';
                    const color = val > 0 ? '#059669' : '#9ca3af';
                    bodyHtml += `<td style="text-align: right; padding: 8px 6px; font-family: 'Roboto Mono', monospace; font-size: 12px; color: ${color};">${display}</td>`;
                });
                const sjecaDisp = sjecaUkupno > 0 ? sjecaUkupno.toFixed(2) : '-';
                bodyHtml += `<td style="text-align: right; padding: 8px 10px; font-family: 'Roboto Mono', monospace; font-size: 13px; font-weight: 700; color: #047857; background: #d1fae5;">${sjecaDisp}</td>`;
                bodyHtml += '</tr>';

                bodyHtml += '<tr style="background: #fef2f2;">';
                bodyHtml += '<td style="font-weight: 600; color: #dc2626; padding: 8px 10px; font-size: 13px;">🚚 Otprema</td>';
                sortimentiPrikaz.forEach(sort => {
                    const val = otpremaSortimenti[sort.display] || 0;
                    const display = val > 0 ? val.toFixed(2) : '-';
                    const color = val > 0 ? '#dc2626' : '#9ca3af';
                    bodyHtml += `<td style="text-align: right; padding: 8px 6px; font-family: 'Roboto Mono', monospace; font-size: 12px; color: ${color};">${display}</td>`;
                });
                const otpremaDisp = otpremaUkupno > 0 ? otpremaUkupno.toFixed(2) : '-';
                bodyHtml += `<td style="text-align: right; padding: 8px 10px; font-family: 'Roboto Mono', monospace; font-size: 13px; font-weight: 700; color: #dc2626; background: #fecaca;">${otpremaDisp}</td>`;
                bodyHtml += '</tr>';

                bodyHtml += '<tr style="background: #f3f4f6;">';
                bodyHtml += '<td style="font-weight: 600; color: #4b5563; padding: 8px 10px; font-size: 13px;">📊 Razlika (SJE−OTP)</td>';
                sortimentiPrikaz.forEach(sort => {
                    const val = razlikaSortimenti[sort.display] || 0;
                    let display = '-';
                    if (val !== 0) display = (val > 0 ? '+' : '') + val.toFixed(2);
                    bodyHtml += `<td style="text-align: right; padding: 8px 6px; font-family: 'Roboto Mono', monospace; font-size: 12px; color: #4b5563;">${display}</td>`;
                });
                let razlikaDisp = '-';
                if (razlikaUkupno !== 0) razlikaDisp = (razlikaUkupno > 0 ? '+' : '') + razlikaUkupno.toFixed(2);
                bodyHtml += `<td style="text-align: right; padding: 8px 10px; font-family: 'Roboto Mono', monospace; font-size: 13px; font-weight: 700; color: #4b5563; background: #e5e7eb;">${razlikaDisp}</td>`;
                bodyHtml += '</tr>';

                bodyElem.innerHTML = bodyHtml;

            } catch (error) {
                console.error('Error loading tekući mjesec table:', error);
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #dc2626;">Greška pri učitavanju podataka</td></tr>';
            }
        }

        // ========================================
        // SJEČA I OTPREMA ZADNJIH 5 RADNIH DANA - Dashboard tabela
        // ========================================
        async function loadZadnjih5DanaTable() {
            const headerElem = document.getElementById('zadnjih5-dana-header');
            const bodyElem = document.getElementById('zadnjih5-dana-body');
            const periodElem = document.getElementById('zadnjih5-period');

            try {
                // Dohvati primke i otpreme podatke
                const primkeUrl = buildApiUrl('primke');
                const otpremeUrl = buildApiUrl('otpreme');

                const [primkeData, otpremeData] = await Promise.all([
                    fetchWithCache(primkeUrl, 'cache_primke_zadnjih5_dash'),
                    fetchWithCache(otpremeUrl, 'cache_otpreme_zadnjih5_dash')
                ]);

                // Funkcija za normalizaciju datuma u DD.MM.YYYY
                const normalizeDateStr = (datum) => {
                    if (!datum) return null;
                    if (typeof datum === 'string') {
                        return datum.trim();
                    }
                    return null;
                };

                // Funkcija za parsiranje DD.MM.YYYY u Date objekt
                const parseDateStr = (dateStr) => {
                    if (!dateStr) return null;
                    const [day, month, year] = dateStr.split('.').map(Number);
                    return new Date(year, month - 1, day);
                };

                // Funkcija za formatiranje Date u DD.MM.YYYY
                const formatDate = (date) => {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}.${month}.${year}`;
                };

                // Izvuci sve datume sa subotnjim unosima iz podataka
                const suboteSaUnosom = new Set();

                if (primkeData.primke && Array.isArray(primkeData.primke)) {
                    primkeData.primke.forEach(p => {
                        const d = normalizeDateStr(p.datum);
                        if (d) {
                            const date = parseDateStr(d);
                            if (date && date.getDay() === 6) { // Subota
                                suboteSaUnosom.add(d);
                            }
                        }
                    });
                }

                if (otpremeData.otpreme && Array.isArray(otpremeData.otpreme)) {
                    otpremeData.otpreme.forEach(o => {
                        const d = normalizeDateStr(o.datum);
                        if (d) {
                            const date = parseDateStr(d);
                            if (date && date.getDay() === 6) { // Subota
                                suboteSaUnosom.add(d);
                            }
                        }
                    });
                }

                // Izračunaj zadnjih 5 RADNIH dana (pon-pet) - ne uključuje danas
                // (podaci od današnje sječe/otpreme se unose tek sutradan)
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const radniDani = []; // Datumi radnih dana (pon-pet)
                let currentDate = new Date(today);
                currentDate.setDate(currentDate.getDate() - 1); // Počni od juče

                while (radniDani.length < 5) {
                    const dayOfWeek = currentDate.getDay(); // 0=ned, 1=pon, ..., 6=sub
                    // Pon-Pet = 1-5
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        radniDani.push(new Date(currentDate));
                    }
                    currentDate.setDate(currentDate.getDate() - 1);
                }

                // radniDani je sada sortiran od najnovijeg do najstarijeg
                // Najnoviji radni dan = radniDani[0], najstariji = radniDani[4]
                const startDate = radniDani[radniDani.length - 1]; // najstariji
                const endDate = radniDani[0]; // najnoviji

                // Prikaži period u naslovu
                const startFormatted = `${String(startDate.getDate()).padStart(2, '0')}.${String(startDate.getMonth() + 1).padStart(2, '0')}`;
                const endFormatted = formatDate(endDate);
                if (periodElem) {
                    periodElem.textContent = `(Period: ${startFormatted}–${endFormatted})`;
                }

                // Kreiraj set datuma za filtriranje - uključi radne dane i subote sa unosom unutar perioda
                const validDatumi = new Set();

                // Dodaj sve radne dane
                radniDani.forEach(d => validDatumi.add(formatDate(d)));

                // Dodaj subote sa unosom koje padaju unutar perioda [startDate, endDate]
                suboteSaUnosom.forEach(subotaStr => {
                    const subotaDate = parseDateStr(subotaStr);
                    if (subotaDate && subotaDate >= startDate && subotaDate <= endDate) {
                        validDatumi.add(subotaStr);
                    }
                });

                console.log('[Zadnjih 5 radnih dana] Period:', startFormatted, '-', endFormatted);
                console.log('[Zadnjih 5 radnih dana] Validni datumi:', Array.from(validDatumi));

                // Sortimenti koje prikazujemo (kompaktni nazivi)
                const sortimentiPrikaz = [
                    { display: 'TRUPCI Č', keys: ['TRUPCI Č'] },
                    { display: 'CEL.D', keys: ['CEL.DUGA'] },
                    { display: 'CEL.C', keys: ['CEL.CIJEPANA'] },
                    { display: 'Σ ČET', keys: ['Σ ČETINARI'] },
                    { display: 'TRUPCI L', keys: ['TRUPCI L'] },
                    { display: 'OGR.D', keys: ['OGR.DUGI'] },
                    { display: 'OGR.C', keys: ['OGR.CIJEPANI'] },
                    { display: 'Σ LIŠ', keys: ['LIŠĆARI'] }
                ];

                // Agregiraj SJEČA podatke za period
                const sjecaSortimenti = {};
                sortimentiPrikaz.forEach(s => sjecaSortimenti[s.display] = 0);

                if (primkeData.primke && Array.isArray(primkeData.primke)) {
                    primkeData.primke.forEach(primka => {
                        const datumStr = normalizeDateStr(primka.datum);
                        if (datumStr && validDatumi.has(datumStr)) {
                            const sortiment = primka.sortiment;
                            const kolicina = parseFloat(primka.kolicina) || 0;

                            // Pronađi odgovarajući prikaz sortiment i dodaj količinu
                            sortimentiPrikaz.forEach(sp => {
                                if (sp.keys.includes(sortiment)) {
                                    sjecaSortimenti[sp.display] += kolicina;
                                }
                            });
                        }
                    });
                }

                // Izračunaj UKUPNO kao sumu svih prikazanih sortimenta (bez Σ kolona da ne dupliramo)
                let sjecaUkupno = 0;
                sortimentiPrikaz.forEach(sp => {
                    // Ne uključuj Σ (sume) u ukupno jer bi to bilo dupliranje
                    if (!sp.display.startsWith('Σ')) {
                        sjecaUkupno += sjecaSortimenti[sp.display] || 0;
                    }
                });
                console.log('[Zadnjih 5 radnih dana] Sječa sortimenti:', sjecaSortimenti, 'UKUPNO:', sjecaUkupno);

                // Agregiraj OTPREMA podatke za period
                const otpremaSortimenti = {};
                sortimentiPrikaz.forEach(s => otpremaSortimenti[s.display] = 0);

                if (otpremeData.otpreme && Array.isArray(otpremeData.otpreme)) {
                    otpremeData.otpreme.forEach(otprema => {
                        const datumStr = normalizeDateStr(otprema.datum);
                        if (datumStr && validDatumi.has(datumStr)) {
                            const sortiment = otprema.sortiment;
                            const kolicina = parseFloat(otprema.kolicina) || 0;

                            // Pronađi odgovarajući prikaz sortiment i dodaj količinu
                            sortimentiPrikaz.forEach(sp => {
                                if (sp.keys.includes(sortiment)) {
                                    otpremaSortimenti[sp.display] += kolicina;
                                }
                            });
                        }
                    });
                }

                // Izračunaj UKUPNO kao sumu svih prikazanih sortimenta (bez Σ kolona)
                let otpremaUkupno = 0;
                sortimentiPrikaz.forEach(sp => {
                    // Ne uključuj Σ (sume) u ukupno jer bi to bilo dupliranje
                    if (!sp.display.startsWith('Σ')) {
                        otpremaUkupno += otpremaSortimenti[sp.display] || 0;
                    }
                });
                console.log('[Zadnjih 5 radnih dana] Otprema sortimenti:', otpremaSortimenti, 'UKUPNO:', otpremaUkupno);

                // Izračunaj RAZLIKU (Sječa - Otprema)
                const razlikaSortimenti = {};
                sortimentiPrikaz.forEach(sp => {
                    razlikaSortimenti[sp.display] = (sjecaSortimenti[sp.display] || 0) - (otpremaSortimenti[sp.display] || 0);
                });
                const razlikaUkupno = sjecaUkupno - otpremaUkupno;
                console.log('[Zadnjih 5 radnih dana] Razlika sortimenti:', razlikaSortimenti, 'UKUPNO:', razlikaUkupno);

                // Renderuj header (kompaktni stil)
                let headerHtml = '<tr style="background: linear-gradient(135deg, #047857 0%, #065f46 100%);">';
                headerHtml += '<th style="color: white; font-weight: 600; text-align: left; padding: 8px 10px; font-size: 13px;">Vrsta</th>';
                sortimentiPrikaz.forEach(sort => {
                    headerHtml += `<th style="color: white; font-weight: 600; text-align: right; padding: 8px 6px; font-size: 12px;">${sort.display}</th>`;
                });
                headerHtml += '<th style="color: white; font-weight: 700; text-align: right; padding: 8px 10px; font-size: 13px; background: #064e3b;">UKUPNO</th>';
                headerHtml += '</tr>';
                headerElem.innerHTML = headerHtml;

                // Renderuj body - 3 reda (Sječa, Otprema, Razlika)
                let bodyHtml = '';

                // Red za Sječu
                bodyHtml += '<tr style="background: #f0fdf4;">';
                bodyHtml += '<td style="font-weight: 600; color: #047857; padding: 8px 10px; font-size: 13px;">🌲 Sječa</td>';
                sortimentiPrikaz.forEach(sort => {
                    const val = sjecaSortimenti[sort.display] || 0;
                    const display = val > 0 ? val.toFixed(2) : '-';
                    const color = val > 0 ? '#059669' : '#9ca3af';
                    bodyHtml += `<td style="text-align: right; padding: 8px 6px; font-family: 'Roboto Mono', monospace; font-size: 12px; color: ${color};">${display}</td>`;
                });
                // UKUPNO kolona
                const sjecaDisp = sjecaUkupno > 0 ? sjecaUkupno.toFixed(2) : '-';
                bodyHtml += `<td style="text-align: right; padding: 8px 10px; font-family: 'Roboto Mono', monospace; font-size: 13px; font-weight: 700; color: #047857; background: #d1fae5;">${sjecaDisp}</td>`;
                bodyHtml += '</tr>';

                // Red za Otpremu
                bodyHtml += '<tr style="background: #fef2f2;">';
                bodyHtml += '<td style="font-weight: 600; color: #dc2626; padding: 8px 10px; font-size: 13px;">🚚 Otprema</td>';
                sortimentiPrikaz.forEach(sort => {
                    const val = otpremaSortimenti[sort.display] || 0;
                    const display = val > 0 ? val.toFixed(2) : '-';
                    const color = val > 0 ? '#dc2626' : '#9ca3af';
                    bodyHtml += `<td style="text-align: right; padding: 8px 6px; font-family: 'Roboto Mono', monospace; font-size: 12px; color: ${color};">${display}</td>`;
                });
                // UKUPNO kolona
                const otpremaDisp = otpremaUkupno > 0 ? otpremaUkupno.toFixed(2) : '-';
                bodyHtml += `<td style="text-align: right; padding: 8px 10px; font-family: 'Roboto Mono', monospace; font-size: 13px; font-weight: 700; color: #dc2626; background: #fecaca;">${otpremaDisp}</td>`;
                bodyHtml += '</tr>';

                // Red za Razliku (Sječa - Otprema) - neutralna siva boja
                bodyHtml += '<tr style="background: #f3f4f6;">';
                bodyHtml += '<td style="font-weight: 600; color: #4b5563; padding: 8px 10px; font-size: 13px;">📊 Razlika (SJE−OTP)</td>';
                sortimentiPrikaz.forEach(sort => {
                    const val = razlikaSortimenti[sort.display] || 0;
                    let display = '-';
                    if (val !== 0) {
                        display = (val > 0 ? '+' : '') + val.toFixed(2);
                    }
                    bodyHtml += `<td style="text-align: right; padding: 8px 6px; font-family: 'Roboto Mono', monospace; font-size: 12px; color: #4b5563;">${display}</td>`;
                });
                // UKUPNO kolona za razliku
                let razlikaDisp = '-';
                if (razlikaUkupno !== 0) {
                    razlikaDisp = (razlikaUkupno > 0 ? '+' : '') + razlikaUkupno.toFixed(2);
                }
                bodyHtml += `<td style="text-align: right; padding: 8px 10px; font-family: 'Roboto Mono', monospace; font-size: 13px; font-weight: 700; color: #4b5563; background: #e5e7eb;">${razlikaDisp}</td>`;
                bodyHtml += '</tr>';

                bodyElem.innerHTML = bodyHtml;

            } catch (error) {
                console.error('Error loading zadnjih 5 radnih dana table:', error);
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #dc2626;">Greška pri učitavanju podataka</td></tr>';
            }
        }

        // ========================================
        // STANJE ZALIHA TABELA - Agregirana tabela svih odjela (čita iz zadnjeg reda ZALIHA tabele)
        // ========================================
        function renderStanjeZalihaTabela(odjeliData) {
            const headerElem = document.getElementById('stanje-zaliha-tabela-header');
            const bodyElem = document.getElementById('stanje-zaliha-tabela-body');

            if (!headerElem || !bodyElem) return;

            try {
                // Sortimenti za prikaz (mapiranje od API naziva - iz zadnjeg reda ZALIHA tabele)
                const sortimentiPrikaz = [
                    { display: 'TRUPCI Č', apiKey: 'TRUPCI Č' },
                    { display: 'CEL.DUGA', apiKey: 'CEL.DUGA' },
                    { display: 'CEL.CIJEPANA', apiKey: 'CEL.CIJEPANA' },
                    { display: 'ČETINARI', apiKey: 'Σ ČETINARI' },
                    { display: 'TRUPCI L', apiKey: 'TRUPCI L' },
                    { display: 'OGR.DUGI', apiKey: 'OGR.DUGI' },
                    { display: 'OGR.CIJEPANI', apiKey: 'OGR.CIJEPANI' },
                    { display: 'LIŠĆARI', apiKey: 'LIŠĆARI' }
                ];

                // Agregiraj zalihe iz svih odjela (čita iz odjel.zaliha - zadnji red ZALIHA tabele)
                const zalihaSortimenti = {};
                sortimentiPrikaz.forEach(s => zalihaSortimenti[s.display] = 0);

                if (odjeliData && Array.isArray(odjeliData)) {
                    odjeliData.forEach(odjel => {
                        const zalihaData = odjel.zaliha || {};
                        sortimentiPrikaz.forEach(sp => {
                            zalihaSortimenti[sp.display] += zalihaData[sp.apiKey] || 0;
                        });
                    });
                }

                // Izračunaj UKUPNO (ČETINARI + LIŠĆARI)
                const zalihaUkupno = zalihaSortimenti['ČETINARI'] + zalihaSortimenti['LIŠĆARI'];

                // Broj odjela za prikaz u naslovu
                const brojOdjela = odjeliData ? odjeliData.length : 0;

                console.log('[Stanje Zaliha Tabela] Agregirano iz', brojOdjela, 'odjela. Zalihe:', zalihaSortimenti, 'UKUPNO:', zalihaUkupno);

                // Renderuj tabelu - zaglavlje sa naslovom
                let headerHtml = `
                    <tr style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);">
                        <th colspan="10" style="color: white; font-weight: 700; text-align: center; padding: 12px 16px; font-size: 15px; letter-spacing: 0.5px;">
                            📦 Ukupne zalihe - ${brojOdjela} odjela
                        </th>
                    </tr>
                    <tr style="background: #1e3a5f;">`;
                sortimentiPrikaz.forEach(sort => {
                    const isSum = sort.display === 'ČETINARI' || sort.display === 'LIŠĆARI';
                    const bgColor = isSum ? '#2d5a87' : '#1e3a5f';
                    headerHtml += `<th style="color: white; font-weight: 600; text-align: center; padding: 10px 8px; font-size: 12px; background: ${bgColor}; border: 1px solid #374151;">${sort.display}</th>`;
                });
                headerHtml += `<th style="color: white; font-weight: 700; text-align: center; padding: 10px 12px; font-size: 13px; background: #064e3b; border: 1px solid #374151;">UKUPNO</th>`;
                headerHtml += '</tr>';
                headerElem.innerHTML = headerHtml;

                // Renderuj body - jedan red sa zalihama
                let bodyHtml = '<tr style="background: #f0fdf4;">';
                sortimentiPrikaz.forEach(sort => {
                    const val = zalihaSortimenti[sort.display] || 0;
                    const display = val.toFixed(2);
                    const color = val >= 0 ? '#059669' : '#dc2626';
                    const isSum = sort.display === 'ČETINARI' || sort.display === 'LIŠĆARI';
                    const bgColor = isSum ? '#d1fae5' : '';
                    bodyHtml += `<td style="text-align: right; padding: 12px 8px; font-family: 'Roboto Mono', monospace; font-size: 13px; font-weight: ${isSum ? '700' : '600'}; color: ${color}; border: 1px solid #d1d5db; ${bgColor ? 'background:' + bgColor + ';' : ''}">${display}</td>`;
                });
                // UKUPNO kolona
                const ukupnoColor = zalihaUkupno >= 0 ? '#047857' : '#dc2626';
                bodyHtml += `<td style="text-align: right; padding: 12px 12px; font-family: 'Roboto Mono', monospace; font-size: 14px; font-weight: 700; color: ${ukupnoColor}; background: #d1fae5; border: 1px solid #d1d5db;">${zalihaUkupno.toFixed(2)}</td>`;
                bodyHtml += '</tr>';

                bodyElem.innerHTML = bodyHtml;

            } catch (error) {
                console.error('Error rendering stanje zaliha tabela:', error);
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #dc2626;">Greška pri učitavanju podataka</td></tr>';
            }
        }

        // ========================================
        // STANJE ZALIHA TABELA - Poslovođa Panel (filtrirana radilišta)
        // ========================================
        function renderPoslovodjaStanjeZalihaTabela(odjeliData) {
            const headerElem = document.getElementById('poslovodja-stanje-zaliha-tabela-header');
            const bodyElem = document.getElementById('poslovodja-stanje-zaliha-tabela-body');

            if (!headerElem || !bodyElem) return;

            try {
                // Sortimenti za prikaz (mapiranje od API naziva)
                const sortimentiPrikaz = [
                    { display: 'TRUPCI Č', apiKey: 'TRUPCI Č' },
                    { display: 'CEL.DUGA', apiKey: 'CEL.DUGA' },
                    { display: 'CEL.CIJEPANA', apiKey: 'CEL.CIJEPANA' },
                    { display: 'ČETINARI', apiKey: 'Σ ČETINARI' },
                    { display: 'TRUPCI L', apiKey: 'TRUPCI L' },
                    { display: 'OGR.DUGI', apiKey: 'OGR.DUGI' },
                    { display: 'OGR.CIJEPANI', apiKey: 'OGR.CIJEPANI' },
                    { display: 'LIŠĆARI', apiKey: 'LIŠĆARI' }
                ];

                // Agregiraj zalihe iz svih odjela
                const zalihaSortimenti = {};
                sortimentiPrikaz.forEach(s => zalihaSortimenti[s.display] = 0);

                if (odjeliData && Array.isArray(odjeliData)) {
                    odjeliData.forEach(odjel => {
                        const zalihaData = odjel.zaliha || {};
                        sortimentiPrikaz.forEach(sp => {
                            zalihaSortimenti[sp.display] += zalihaData[sp.apiKey] || 0;
                        });
                    });
                }

                // Izračunaj UKUPNO (ČETINARI + LIŠĆARI)
                const zalihaUkupno = zalihaSortimenti['ČETINARI'] + zalihaSortimenti['LIŠĆARI'];

                // Dohvati ime poslovođe za naslov
                const poslovodjaName = currentUser ? currentUser.fullName : 'Poslovođa';

                console.log('[Poslovođa Stanje Zaliha Tabela] Zalihe:', zalihaSortimenti, 'UKUPNO:', zalihaUkupno);

                // Renderuj tabelu - zaglavlje sa naslovom
                let headerHtml = `
                    <tr style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);">
                        <th colspan="10" style="color: white; font-weight: 700; text-align: center; padding: 12px 16px; font-size: 15px; letter-spacing: 0.5px;">
                            📦 Zalihe - ${poslovodjaName}
                        </th>
                    </tr>
                    <tr style="background: #1e3a5f;">`;
                sortimentiPrikaz.forEach(sort => {
                    const isSum = sort.display === 'ČETINARI' || sort.display === 'LIŠĆARI';
                    const bgColor = isSum ? '#2d5a87' : '#1e3a5f';
                    headerHtml += `<th style="color: white; font-weight: 600; text-align: center; padding: 10px 8px; font-size: 12px; background: ${bgColor}; border: 1px solid #374151;">${sort.display}</th>`;
                });
                headerHtml += `<th style="color: white; font-weight: 700; text-align: center; padding: 10px 12px; font-size: 13px; background: #064e3b; border: 1px solid #374151;">UKUPNO</th>`;
                headerHtml += '</tr>';
                headerElem.innerHTML = headerHtml;

                // Renderuj body - jedan red sa zalihama
                let bodyHtml = '<tr style="background: #f0fdf4;">';
                sortimentiPrikaz.forEach(sort => {
                    const val = zalihaSortimenti[sort.display] || 0;
                    const display = val.toFixed(2);
                    const color = val >= 0 ? '#059669' : '#dc2626';
                    const isSum = sort.display === 'ČETINARI' || sort.display === 'LIŠĆARI';
                    const bgColor = isSum ? '#d1fae5' : '';
                    bodyHtml += `<td style="text-align: right; padding: 12px 8px; font-family: 'Roboto Mono', monospace; font-size: 13px; font-weight: ${isSum ? '700' : '600'}; color: ${color}; border: 1px solid #d1d5db; ${bgColor ? 'background:' + bgColor + ';' : ''}">${display}</td>`;
                });
                // UKUPNO kolona
                const ukupnoColor = zalihaUkupno >= 0 ? '#047857' : '#dc2626';
                bodyHtml += `<td style="text-align: right; padding: 12px 12px; font-family: 'Roboto Mono', monospace; font-size: 14px; font-weight: 700; color: ${ukupnoColor}; background: #d1fae5; border: 1px solid #d1d5db;">${zalihaUkupno.toFixed(2)}</td>`;
                bodyHtml += '</tr>';

                bodyElem.innerHTML = bodyHtml;

            } catch (error) {
                console.error('Error rendering poslovodja stanje zaliha tabela:', error);
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #dc2626;">Greška pri učitavanju podataka</td></tr>';
            }
        }

        // ========== MOVED TO js/charts.js ==========
        // ========================================
        // POSLOVOĐA FUNCTIONS
        // ========================================

        // Globalne varijable za poslovođu stanje odjela
        let poslovodjaStanjeOdjeliAll = [];
        let poslovodjaStanjeRadilista = [];

        // Helper: Get radilišta for current poslovodja (API sa fallback na hardkodirano)
        function getPoslovodjaRadilista() {
            if (!currentUser) {
                return [];
            }
            const userType = (currentUser.type || '').toLowerCase();
            if (userType !== 'poslovođa' && userType !== 'poslovodja') {
                return [];
            }
            // Prioritet: API podaci iz INFO sheeta, pa fallback na hardkodirano
            if (_poslovodjaRadilistaFromApi && _poslovodjaRadilistaFromApi.length > 0) {
                return _poslovodjaRadilistaFromApi;
            }
            const fullName = currentUser.fullName.toUpperCase().trim();
            // Pokušaj direktno ime, pa obrnuti redoslijed (IME PREZIME <-> PREZIME IME)
            if (POSLOVODJA_RADILISTA_FALLBACK[fullName]) {
                return POSLOVODJA_RADILISTA_FALLBACK[fullName];
            }
            // Fallback: normaliziraj ime (sortiraj dijelove) i traži match
            const normalizedName = fullName.split(/\s+/).sort().join(' ');
            for (const key in POSLOVODJA_RADILISTA_FALLBACK) {
                const normalizedKey = key.toUpperCase().trim().split(/\s+/).sort().join(' ');
                if (normalizedKey === normalizedName) {
                    return POSLOVODJA_RADILISTA_FALLBACK[key];
                }
            }
            return [];
        }

        // Load STANJE ZALIHA za poslovođu (filtrirano po poslovođi na backendu)
        async function loadPoslovodjaStanje() {
            if (!isActiveTab('poslovodja-stanje')) return;
            const poslovodjaName = currentUser ? currentUser.fullName : '';
            const cacheKey = 'cache_stanje_zaliha_' + (poslovodjaName || 'all').replace(/\s+/g, '_');

            // Turbo: instant show cached data
            var hasCached = false;
            var cached = turboShow(cacheKey, 'poslovodja-stanje-content', function(d) { return d.odjeli; });
            if (cached) {
                document.getElementById('poslovodja-radilista-list').textContent = poslovodjaName || 'Svi odjeli';
                // Backend već filtrira po poslovođi - koristimo podatke direktno
                poslovodjaStanjeOdjeliAll = cached.odjeli;
                populatePoslovodjaRadilisteDropdown(cached.odjeli);
                renderPoslovodjaStanjeZalihaTabela(cached.odjeli);
                renderPoslovodjaStanjeCards(cached.odjeli);
                hasCached = true;
            }

            if (!hasCached) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('poslovodja-stanje-content').classList.add('hidden');
            }

            try {
                document.getElementById('poslovodja-radilista-list').textContent = poslovodjaName || 'Svi odjeli';

                const url = buildApiUrl('stanje-zaliha', { poslovodja: poslovodjaName });
                const data = await fetchWithCache(url, cacheKey, false, 60000);

                if (data.error || !data.odjeli) {
                    throw new Error(data.error || 'Nema podataka o odjelima');
                }

                // Backend već filtrira po POSLOVOĐA polju iz STANJE_ZALIHA
                poslovodjaStanjeOdjeliAll = data.odjeli;
                populatePoslovodjaRadilisteDropdown(data.odjeli);
                renderPoslovodjaStanjeZalihaTabela(data.odjeli);
                renderPoslovodjaStanjeCards(data.odjeli);

                if (!isActiveTab('poslovodja-stanje')) return;
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-stanje-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa stanje:', error);

                // FALLBACK: Pokušaj učitati keširane podatke ako postoje
                const poslovodjaName = currentUser ? currentUser.fullName : '';
                const cacheKey = 'cache_stanje_zaliha_' + (poslovodjaName || 'all').replace(/\s+/g, '_');
                const cachedData = localStorage.getItem(cacheKey);
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        console.log('Using cached data as fallback');

                        // Frontend sigurnosni filter za fallback keširane podatke
                        var fallbackRadilista = getPoslovodjaRadilista();
                        var fallbackOdjeli = parsed.data.odjeli;
                        if (fallbackRadilista.length > 0) {
                            fallbackOdjeli = fallbackOdjeli.filter(function(odjel) {
                                var odjelRadiliste = (odjel.radiliste || '').toUpperCase().trim();
                                return fallbackRadilista.some(function(r) {
                                    return odjelRadiliste === r.toUpperCase();
                                });
                            });
                        }

                        // Sačuvaj filtrirane podatke globalno
                        poslovodjaStanjeOdjeliAll = fallbackOdjeli;

                        document.getElementById('poslovodja-radilista-list').textContent = (poslovodjaName || 'Svi odjeli') + ' (keširani podaci)';

                        // Popuni dropdown
                        populatePoslovodjaRadilisteDropdown(fallbackOdjeli);

                        // Render agregirana tabela zaliha na vrhu
                        renderPoslovodjaStanjeZalihaTabela(fallbackOdjeli);

                        renderPoslovodjaStanjeCards(fallbackOdjeli);

                        document.getElementById('loading-screen').classList.add('hidden');
                        document.getElementById('poslovodja-stanje-content').classList.remove('hidden');

                        showNotification('⚠️ Prikazani keširani podaci zbog sporog servera', 'warning');
                        return;
                    } catch (cacheError) {
                        console.error('Failed to parse cached data:', cacheError);
                    }
                }

                showError('Greška', 'Server je spor. Molimo pokušajte ponovo za par minuta.');
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Popuni dropdown sa radilištima
        function populatePoslovodjaRadilisteDropdown(odjeli) {
            const select = document.getElementById('poslovodja-radiliste-select');

            // Očisti postojeće opcije osim "Sva radilišta"
            select.innerHTML = '<option value="">Sva radilišta</option>';

            // Izvuci jedinstvena radilišta iz podataka
            const radilistaSet = new Set();
            odjeli.forEach(odjel => {
                if (odjel.radiliste && odjel.radiliste.trim() !== '') {
                    radilistaSet.add(odjel.radiliste.trim());
                }
            });

            // Sortiraj radilišta i dodaj u dropdown
            const radilistaArray = Array.from(radilistaSet).sort();
            poslovodjaStanjeRadilista = radilistaArray;

            radilistaArray.forEach(radiliste => {
                const option = document.createElement('option');
                option.value = radiliste;
                option.textContent = radiliste;
                select.appendChild(option);
            });
        }

        // Filtriraj prikaz po izabranom radilištu (filtriranje po poslovođi se radi na backendu)
        function filterPoslovodjaStanje() {
            const selectedRadiliste = document.getElementById('poslovodja-radiliste-select').value;

            let filteredOdjeli = poslovodjaStanjeOdjeliAll;

            // Primeni filter po izabranom radilištu iz dropdown-a
            if (selectedRadiliste !== '') {
                filteredOdjeli = filteredOdjeli.filter(odjel => {
                    return odjel.radiliste && odjel.radiliste.trim() === selectedRadiliste;
                });
            }

            // Ažuriraj agregiranu tabelu zaliha
            renderPoslovodjaStanjeZalihaTabela(filteredOdjeli);

            renderPoslovodjaStanjeCards(filteredOdjeli);
        }

        // Load STANJE ODJELA za admina (SVE odjele bez filtriranja)
        // Prikazuje tekuću godinu + Q4 prošle godine
        async function loadAdminStanjeOdjela() {
            try {
                const currentYear = new Date().getFullYear();
                const previousYear = currentYear - 1;

                // 🚀 TURBO MODE: INSTANT SHOW cached data
                const cacheKey = 'cache_odjeli_stanje_admin_' + currentYear;
                const cachedData = localStorage.getItem(cacheKey);

                let hasCachedData = false;
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        if (parsed.data) {
                            // ✨ INSTANT: Show cached data immediately
                            document.getElementById('loading-screen').classList.add('hidden');
                            document.getElementById('stanje-odjela-admin-content').classList.remove('hidden');
                            renderAdminStanjeTable(parsed.data);
                            hasCachedData = true;

                            // Show cache indicator
                            const age = Date.now() - parsed.timestamp;
                            showCacheIndicator(age);
                        }
                    } catch (e) {
                        console.error('Cache parse error:', e);
                    }
                }

                // If no cache, show loading screen
                if (!hasCachedData) {
                    document.getElementById('loading-screen').classList.remove('hidden');
                    document.getElementById('stanje-odjela-admin-content').classList.add('hidden');
                }

                // 🔄 BACKGROUND REFRESH: Fetch fresh data for both years
                console.log(`[STANJE ODJELA] Loading data for ${currentYear} and Q4 ${previousYear}`);

                // Učitaj podatke za tekuću i prošlu godinu paralelno
                const currentYearUrl = buildApiUrl('odjeli', { year: currentYear });
                const previousYearUrl = buildApiUrl('odjeli', { year: previousYear });

                const [currentYearData, previousYearData] = await Promise.all([
                    fetchWithCache(currentYearUrl, `cache_odjeli_${currentYear}`, false, 300000),
                    fetchWithCache(previousYearUrl, `cache_odjeli_${previousYear}`, false, 300000)
                ]);

                if (currentYearData.error || !currentYearData.odjeli) {
                    if (!hasCachedData) {
                        throw new Error(currentYearData.error || 'Nema podataka o odjelima za tekuću godinu');
                    }
                    return; // Silently fail if we have cached data
                }

                // Kombinuj podatke
                const combinedData = combineStanjeOdjelaData(
                    currentYearData.odjeli,
                    previousYearData,
                    currentYear,
                    previousYear
                );

                // Cache combined data
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: combinedData,
                    timestamp: Date.now()
                }));

                // Update with fresh data
                renderAdminStanjeTable(combinedData);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('stanje-odjela-admin-content').classList.remove('hidden');

                // Hide cache indicator when fresh data arrives
                hideCacheIndicator();

            } catch (error) {
                console.error('Error loading admin stanje odjela:', error);
                showError('Greška', 'Greška pri učitavanju stanja odjela: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Kombinuj podatke tekuće godine i Q4 prošle godine
        function combineStanjeOdjelaData(currentYearOdjeli, previousYearData, currentYear, previousYear) {
            // Kreiraj mapu odjela za tekuću godinu
            const odjeliMap = {};
            currentYearOdjeli.forEach(odjel => {
                odjeliMap[odjel.odjel] = {
                    odjel: odjel.odjel,
                    radiliste: odjel.radiliste,
                    izvođač: odjel.izvođač,
                    // Tekuća godina
                    currentYear: currentYear,
                    projekat: odjel.projekat || 0,
                    sjeca: odjel.sjeca || 0,
                    otprema: odjel.otprema || 0,
                    zaliha: (odjel.sjeca || 0) - (odjel.otprema || 0),
                    // Q4 prošle godine (inicijalno 0)
                    prevYear: previousYear,
                    prevQ4Sjeca: 0,
                    prevQ4Otprema: 0,
                    prevQ4Zaliha: 0
                };
            });

            // Dodaj podatke za prošlu godinu (kompletna godina jer Q4 podaci nisu dostupni kroz odjeli endpoint)
            // Napomena: Za sada prikazujemo totalnu prošlu godinu umesto samo Q4
            if (previousYearData && previousYearData.odjeli) {
                previousYearData.odjeli.forEach(prevOdjel => {
                    const odjelName = prevOdjel.odjel;
                    if (odjeliMap[odjelName]) {
                        // Za sada koristimo totalnu sječu/otpremu prošle godine
                        // TODO: Ako želimo samo Q4, trebamo koristiti primaci-daily endpoint
                        odjeliMap[odjelName].prevQ4Sjeca = prevOdjel.sjeca || 0;
                        odjeliMap[odjelName].prevQ4Otprema = prevOdjel.otprema || 0;
                        odjeliMap[odjelName].prevQ4Zaliha = (prevOdjel.sjeca || 0) - (prevOdjel.otprema || 0);
                    } else {
                        // Odjel postoji u prošloj godini ali ne u tekućoj - dodaj ga
                        odjeliMap[odjelName] = {
                            odjel: prevOdjel.odjel,
                            radiliste: prevOdjel.radiliste,
                            izvođač: prevOdjel.izvođač,
                            // Tekuća godina (nema podataka)
                            currentYear: currentYear,
                            projekat: 0,
                            sjeca: 0,
                            otprema: 0,
                            zaliha: 0,
                            // Prošla godina
                            prevYear: previousYear,
                            prevQ4Sjeca: prevOdjel.sjeca || 0,
                            prevQ4Otprema: prevOdjel.otprema || 0,
                            prevQ4Zaliha: (prevOdjel.sjeca || 0) - (prevOdjel.otprema || 0)
                        };
                    }
                });
            }

            return Object.values(odjeliMap);
        }

        // Ručno ažuriranje cache-a za stanje odjela (samo za admin korisnike)
        async function syncStanjeOdjelaCache() {
            try {
                document.getElementById('loading-screen').classList.remove('hidden');

                // Pozovi sync API endpoint
                const url = buildApiUrl('sync-stanje-odjela');
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                // 🚀 Invalidate SVE cache-ove koji koriste STANJE ODJELA podatke
                const year = new Date().getFullYear();
                const cacheKeysToInvalidate = [
                    'cache_odjeli_stanje',
                    'cache_odjeli_stanje_admin',
                    'cache_stanje_odjela_admin',
                    'cache_odjeli_' + year,
                    'cache_poslovodja_odjeli_' + year,
                    'cache_poslovodja_realizacija_' + year,
                    'cache_poslovodja_zadnjih5_' + year,
                    'cache_poslovodja_suma_' + year
                ];

                cacheKeysToInvalidate.forEach(key => {
                    localStorage.removeItem(key);
                    console.log(`🗑️ [SYNC STANJE] Invalidated cache: ${key}`);
                });

                // 🚀 Update APP DATA VERSION - svi paneli će vidjeti promjenu
                const newVersion = Date.now().toString();
                localStorage.setItem('app_data_version', newVersion);
                window.APP_DATA_VERSION = newVersion;
                console.log(`📦 [SYNC STANJE] Updated app_data_version to: ${newVersion}`);

                // 🚀 Emit custom event - svi paneli će biti obavješteni
                window.dispatchEvent(new CustomEvent('app-data-synced', {
                    detail: {
                        version: newVersion,
                        type: 'stanje-odjela-sync',
                        timestamp: new Date().toISOString(),
                        odjeliCount: data.odjeliCount,
                        rowsWritten: data.rowsWritten
                    }
                }));
                console.log('📢 [SYNC STANJE] Emitted "app-data-synced" event');

                document.getElementById('loading-screen').classList.add('hidden');

                // Prikaži success poruku
                showSuccess('✅ Stanje odjela osvježeno', `Cache uspješno ažuriran!\n\nOdjela: ${data.odjeliCount}\nRedova: ${data.rowsWritten}\n\nSvi paneli su obavješteni.`);

                // Automatski učitaj nove podatke
                await loadAdminStanjeOdjela();

            } catch (error) {
                console.error('Error syncing stanje odjela cache:', error);
                showError('Greška', 'Greška pri ažuriranju cache-a: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Render Stanje Odjela table for admin
        // Prikazuje tekuću godinu + Q4 prošle godine
        function renderAdminStanjeTable(odjeli) {
            const headerElem = document.getElementById('admin-stanje-header');
            const bodyElem = document.getElementById('admin-stanje-body');

            if (odjeli.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka o odjelima</td></tr>';
                return;
            }

            // Uzmi godine iz prvog odjela
            const currentYear = odjeli[0]?.currentYear || new Date().getFullYear();
            const prevYear = odjeli[0]?.prevYear || (currentYear - 1);

            // Build header sa grupnim kolonama
            let headerHtml = `
                <tr>
                    <th rowspan="2" style="vertical-align: middle; border-right: 2px solid #d1d5db;">Odjel</th>
                    <th rowspan="2" style="vertical-align: middle; border-right: 2px solid #d1d5db;">Radilište</th>
                    <th rowspan="2" style="vertical-align: middle; border-right: 3px solid #1e40af;">Izvođač</th>
                    <th colspan="4" style="background: #dbeafe; color: #1e40af; text-align: center; border-bottom: 2px solid #1e40af; font-weight: 700;">${currentYear} - Tekuća Godina</th>
                    <th colspan="3" style="background: #fef3c7; color: #92400e; text-align: center; border-bottom: 2px solid #92400e; font-weight: 700;">${prevYear} - Prošla Godina</th>
                </tr>
                <tr>
                    <th style="background: #eff6ff; color: #1e40af;">Projekat (m³)</th>
                    <th style="background: #eff6ff; color: #1e40af;">Sječa (m³)</th>
                    <th style="background: #eff6ff; color: #1e40af;">Otprema (m³)</th>
                    <th style="background: #eff6ff; color: #1e40af; border-right: 3px solid #1e40af;">🏭 Šuma Lager (m³)</th>
                    <th style="background: #fffbeb; color: #92400e;">Sječa (m³)</th>
                    <th style="background: #fffbeb; color: #92400e;">Otprema (m³)</th>
                    <th style="background: #fffbeb; color: #92400e;">🏭 Šuma Lager (m³)</th>
                </tr>
            `;
            headerElem.innerHTML = headerHtml;

            // Build body
            let bodyHtml = '';
            odjeli.forEach((odjel, index) => {
                const rowBg = index % 2 === 0 ? '#f9fafb' : 'white';

                // Tekuća godina
                const projekat = odjel.projekat || 0;
                const sjeca = odjel.sjeca || 0;
                const otprema = odjel.otprema || 0;
                const zaliha = odjel.zaliha || 0;

                // Q4 prošle godine
                const prevQ4Sjeca = odjel.prevQ4Sjeca || 0;
                const prevQ4Otprema = odjel.prevQ4Otprema || 0;
                const prevQ4Zaliha = odjel.prevQ4Zaliha || 0;

                // Color coding za zalihu
                const zalihaColor = zaliha > 0 ? '#059669' : (zaliha < 0 ? '#dc2626' : '#6b7280');
                const prevZalihaColor = prevQ4Zaliha > 0 ? '#059669' : (prevQ4Zaliha < 0 ? '#dc2626' : '#6b7280');

                // Highlight redova sa Q4 unosima
                const hasQ4Data = prevQ4Sjeca > 0 || prevQ4Otprema > 0;
                const q4RowStyle = hasQ4Data ? 'background: #fffbeb;' : '';

                bodyHtml += `
                    <tr style="background: ${rowBg};">
                        <td style="font-weight: 600; border-right: 2px solid #d1d5db;">${odjel.odjel || ''}</td>
                        <td style="border-right: 2px solid #d1d5db;">${odjel.radiliste || '-'}</td>
                        <td style="border-right: 3px solid #1e40af;">${odjel.izvođač || '-'}</td>

                        <!-- Tekuća godina -->
                        <td style="text-align: right; font-family: 'Courier New', monospace; background: #eff6ff;">${projekat.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 600; background: #eff6ff;">${sjeca.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; background: #eff6ff;">${otprema.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: ${zalihaColor}; background: #eff6ff; border-right: 3px solid #1e40af;">${zaliha.toFixed(2)}</td>

                        <!-- Q4 prošle godine -->
                        <td style="text-align: right; font-family: 'Courier New', monospace; ${q4RowStyle} ${prevQ4Sjeca > 0 ? 'font-weight: 600;' : 'color: #9ca3af;'}">${prevQ4Sjeca > 0 ? prevQ4Sjeca.toFixed(2) : '-'}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; ${q4RowStyle} ${prevQ4Otprema > 0 ? '' : 'color: #9ca3af;'}">${prevQ4Otprema > 0 ? prevQ4Otprema.toFixed(2) : '-'}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: ${prevZalihaColor}; ${q4RowStyle}">${hasQ4Data ? prevQ4Zaliha.toFixed(2) : '-'}</td>
                    </tr>
                `;
            });

            bodyElem.innerHTML = bodyHtml;
        }

        // Render Stanje Zaliha cards for poslovođa (identično admin view-u)
        function renderPoslovodjaStanjeCards(data) {
            const container = document.getElementById('poslovodja-stanje-container');
            const countEl = document.getElementById('poslovodja-stanje-count');

            if (data.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 60px; color: #6b7280; font-size: 16px;">Nema podataka za prikaz</div>';
                if (countEl) countEl.textContent = '';
                return;
            }

            if (countEl) countEl.textContent = `Prikazano: ${data.length} odjela`;

            // Sortimenti names for display (shortened for table headers)
            const sortimentiShort = [
                "F/L Č", "I Č", "II Č", "III Č", "RD", "TRUPCI Č",
                "CEL.D", "CEL.C", "ŠKART", "Σ Č",
                "F/L L", "I L", "II L", "III L", "TRUPCI L",
                "OGR.D", "OGR.C", "GULE", "LIŠĆ", "UKUPNO"
            ];

            // Full sortimenti names for data lookup
            const sortimentiFull = [
                "F/L Č", "I Č", "II Č", "III Č", "RD", "TRUPCI Č",
                "CEL.DUGA", "CEL.CIJEPANA", "ŠKART", "Σ ČETINARI",
                "F/L L", "I L", "II L", "III L", "TRUPCI L",
                "OGR.DUGI", "OGR.CIJEPANI", "GULE", "LIŠĆARI", "UKUPNO Č+L"
            ];

            let html = '';

            // Grupiraj odjele po radilištu
            var grouped = {};
            data.forEach(function(odjel) {
                var r = odjel.radiliste || 'N/A';
                if (!grouped[r]) grouped[r] = [];
                grouped[r].push(odjel);
            });

            Object.keys(grouped).forEach(function(radiliste) {
                var odjeli = grouped[radiliste];

                // Section header za radilište
                html += `
                <div style="margin: 32px 0 16px; padding: 12px 20px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #3b82f6; border-radius: 8px;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #1e3a5f;">📍 ${radiliste}</h2>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">${odjeli.length} odjela</p>
                </div>`;

                odjeli.forEach(function(odjel, index) {
                    // Determine status color based on zaliha
                    let statusClass = 'neutral';
                    let statusIcon = '📦';
                    const ukupnoZaliha = odjel.ukupnoZaliha || 0;

                    if (ukupnoZaliha > 100) {
                        statusClass = 'warning';
                        statusIcon = '⚠️';
                    } else if (ukupnoZaliha > 0) {
                        statusClass = 'success';
                        statusIcon = '✅';
                    } else if (ukupnoZaliha < 0) {
                        statusClass = 'danger';
                        statusIcon = '❌';
                    }

                    html += `
                <div class="stanje-zaliha-card ${statusClass}" style="margin-bottom: 24px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">
                    <!-- Card Header -->
                    <div class="stanje-zaliha-card-header" style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin: 0; font-size: 18px; font-weight: 700;">${odjel.odjel}</h3>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 24px; font-weight: 700;">${ukupnoZaliha.toFixed(2)} m³</div>
                            <div style="font-size: 12px; opacity: 0.85;">${statusIcon} Zaliha</div>
                        </div>
                    </div>

                    <!-- Summary Stats -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e5e7eb; border-bottom: 1px solid #e5e7eb;">
                        <div style="background: white; padding: 12px 16px; text-align: center;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">📋 Projekat</div>
                            <div style="font-size: 16px; font-weight: 700; color: #3b82f6;">${(odjel.ukupnoProjekat || 0).toFixed(2)}</div>
                        </div>
                        <div style="background: white; padding: 12px 16px; text-align: center;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">🪓 Sječa</div>
                            <div style="font-size: 16px; font-weight: 700; color: #10b981;">${(odjel.ukupnoSjeca || 0).toFixed(2)}</div>
                        </div>
                        <div style="background: white; padding: 12px 16px; text-align: center;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">🚛 Otprema</div>
                            <div style="font-size: 16px; font-weight: 700; color: #f59e0b;">${(odjel.ukupnoOtprema || 0).toFixed(2)}</div>
                        </div>
                        <div style="background: white; padding: 12px 16px; text-align: center;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">📦 Zaliha</div>
                            <div style="font-size: 16px; font-weight: 700; color: ${ukupnoZaliha >= 0 ? '#059669' : '#dc2626'};">${ukupnoZaliha.toFixed(2)}</div>
                        </div>
                    </div>

                    <!-- Expandable Detail Table -->
                    <details style="border-top: 1px solid #e5e7eb;">
                        <summary style="padding: 12px 20px; cursor: pointer; font-weight: 600; color: #374151; background: #f9fafb; display: flex; align-items: center; gap: 8px;">
                            <span style="transition: transform 0.2s;">▶</span> Detaljni prikaz po sortimentima
                        </summary>
                        <div style="overflow-x: auto; padding: 16px;">
                            <table class="stanje-zaliha-table" style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #d1d5db;">
                                <thead>
                                    <tr style="background: #1e3a5f;">
                                        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: white; border: 1px solid #374151; white-space: nowrap;">VRSTA</th>
                                        ${sortimentiShort.map((s, i) => {
                                            const isTotal = i === 9 || i === 18 || i === 19;
                                            const bgColor = isTotal ? '#2d5a87' : '#1e3a5f';
                                            return `<th style="padding: 10px 6px; text-align: center; font-weight: 600; color: white; border: 1px solid #374151; white-space: nowrap; background: ${bgColor};">${s}</th>`;
                                        }).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${['projekat', 'sjeca', 'otprema', 'zaliha'].map(vrsta => {
                                        const labels = { projekat: '📋 PROJEKAT', sjeca: '🪓 SJEČA', otprema: '🚛 OTPREMA', zaliha: '📦 ZALIHA' };
                                        const rowColors = { projekat: '#eff6ff', sjeca: '#ecfdf5', otprema: '#fffbeb', zaliha: '#faf5ff' };
                                        const textColors = { projekat: '#1e40af', sjeca: '#065f46', otprema: '#b45309', zaliha: '#7c3aed' };
                                        const sortimenti = odjel[vrsta] || {};

                                        return `
                                        <tr style="background: ${rowColors[vrsta]};">
                                            <td style="padding: 10px 12px; font-weight: 700; color: ${textColors[vrsta]}; white-space: nowrap; border: 1px solid #d1d5db;">${labels[vrsta]}</td>
                                            ${sortimentiFull.map((s, i) => {
                                                const value = sortimenti[s] || 0;
                                                const isTotal = i === 9 || i === 18 || i === 19;
                                                const displayValue = value === 0 ? '-' : value.toFixed(2);
                                                const cellColor = vrsta === 'zaliha' && value < 0 ? '#dc2626' : '#374151';
                                                const cellBg = isTotal ? (vrsta === 'zaliha' ? '#e9d5ff' : '#f3e8ff') : '';
                                                return `<td style="padding: 10px 6px; text-align: right; color: ${cellColor}; border: 1px solid #d1d5db; font-weight: ${isTotal ? '700' : '400'}; ${cellBg ? 'background:' + cellBg + ';' : ''}">${displayValue}</td>`;
                                            }).join('')}
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </details>
                </div>`;
                });
            });

            container.innerHTML = html;

            // Add style for details summary arrow rotation (reuse admin style id)
            if (!document.getElementById('stanje-zaliha-style')) {
                const style = document.createElement('style');
                style.id = 'stanje-zaliha-style';
                style.textContent = `
                    .stanje-zaliha-card details[open] summary span:first-child {
                        transform: rotate(90deg);
                    }
                    .stanje-zaliha-card.warning .stanje-zaliha-card-header {
                        background: linear-gradient(135deg, #92400e 0%, #b45309 100%);
                    }
                    .stanje-zaliha-card.success .stanje-zaliha-card-header {
                        background: linear-gradient(135deg, #065f46 0%, #059669 100%);
                    }
                    .stanje-zaliha-card.danger .stanje-zaliha-card-header {
                        background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%);
                    }
                `;
                document.head.appendChild(style);
            }
        }

        // Load ZADNJIH 5 DANA (Primka i Otprema) za poslovođu
        async function loadPoslovodjaZadnjih5() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('poslovodja-zadnjih5-content').classList.add('hidden');

            try {
                const radilista = getPoslovodjaRadilista();

                // Display radilišta
                document.getElementById('poslovodja-radilista-list-3').textContent = radilista.join(', ');

                // Izračunaj zadnjih 5 dana ne računajući danas
                // (podaci od današnje sječe/otpreme se unose tek sutradan)
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                const fiveDaysAgo = new Date(yesterday);
                fiveDaysAgo.setDate(yesterday.getDate() - 5);

                // Load primke i otpreme
                const primkeUrl = buildApiUrl('primke');
                const otpremeUrl = buildApiUrl('otpreme');

                const [primkeData, otpremeData] = await Promise.all([
                    fetchWithCache(primkeUrl, 'cache_primke_zadnjih5'),
                    fetchWithCache(otpremeUrl, 'cache_otpreme_zadnjih5')
                ]);


                if (primkeData.error) {
                    throw new Error('Greška pri učitavanju primki: ' + primkeData.error);
                }
                if (otpremeData.error) {
                    throw new Error('Greška pri učitavanju otprema: ' + otpremeData.error);
                }

                // Filter primke by poslovodja/radilišta i datum (zadnjih 5 dana)
                const userFullName = currentUser.fullName.toUpperCase().trim();
                const filteredPrimke = (primkeData.primke || []).filter(primka => {
                    // Parse datum
                    const primkaDatum = new Date(primka.datum);
                    const withinLast5Days = primkaDatum >= fiveDaysAgo;
                    if (!withinLast5Days) return false;

                    // Prvo pokušaj filtrirati po poslovodja polju
                    const primkaPoslovodja = (primka.poslovodja || '').toUpperCase().trim();
                    if (primkaPoslovodja && primkaPoslovodja === userFullName) {
                        return true;
                    }

                    // Fallback: filter po radilištima ako postoje u mapiranju
                    if (radilista.length > 0) {
                        const primkaRadiliste = (primka.radiliste || '').toUpperCase().trim();
                        return radilista.some(r => primkaRadiliste === r.toUpperCase());
                    }

                    return false;
                });

                // Filter otpreme by poslovodja/radilišta i datum (zadnjih 5 dana)
                const filteredOtpreme = (otpremeData.otpreme || []).filter(otprema => {
                    // Parse datum
                    const otpremaDatum = new Date(otprema.datum);
                    const withinLast5Days = otpremaDatum >= fiveDaysAgo;
                    if (!withinLast5Days) return false;

                    // Prvo pokušaj filtrirati po poslovodja polju
                    const otpremaPoslovodja = (otprema.poslovodja || '').toUpperCase().trim();
                    if (otpremaPoslovodja && otpremaPoslovodja === userFullName) {
                        return true;
                    }

                    // Fallback: filter po radilištima ako postoje u mapiranju
                    if (radilista.length > 0) {
                        const otpremaRadiliste = (otprema.radiliste || '').toUpperCase().trim();
                        return radilista.some(r => otpremaRadiliste === r.toUpperCase());
                    }

                    return false;
                });

                // Sortiraj po datumu (najnoviji prvi)
                filteredPrimke.sort((a, b) => new Date(b.datum) - new Date(a.datum));
                filteredOtpreme.sort((a, b) => new Date(b.datum) - new Date(a.datum));


                // Render tables
                renderPoslovodjaPrimkaTable(filteredPrimke);
                renderPoslovodjaOtpremaZ5Table(filteredOtpreme);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-zadnjih5-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa zadnjih 5:', error);
                showError('Greška', 'Greška pri učitavanju zadnjih 5 dana: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Render Primka table (zadnjih 5 dana)
        function renderPoslovodjaPrimkaTable(primke) {
            const headerElem = document.getElementById('poslovodja-primka-header');
            const bodyElem = document.getElementById('poslovodja-primka-body');

            if (primke.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema primki u zadnjih 5 dana</td></tr>';
                return;
            }

            // Build header - redosled: Radnik (Primac), Odjel, Datum, Sortiment, Količina
            let headerHtml = `
                <tr style="background: #059669;">
                    <th style="color: white; font-weight: 700;">Primac</th>
                    <th style="color: white; font-weight: 700;">Odjel</th>
                    <th style="color: white; font-weight: 700;">Datum</th>
                    <th style="color: white; font-weight: 700;">Sortiment</th>
                    <th style="color: white; font-weight: 700;">Količina (m³)</th>
                </tr>
            `;
            headerElem.innerHTML = headerHtml;

            // Build body
            let bodyHtml = '';
            primke.forEach((primka, index) => {
                const rowBg = index % 2 === 0 ? '#f0fdf4' : 'white';
                bodyHtml += `
                    <tr style="background: ${rowBg};">
                        <td style="font-weight: 600;">${primka.primac || '-'}</td>
                        <td>${primka.odjel || '-'}</td>
                        <td style="font-weight: 500;">${primka.datum || '-'}</td>
                        <td>${primka.sortiment || '-'}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #059669;">${(primka.kolicina || 0).toFixed(2)}</td>
                    </tr>
                `;
            });

            bodyElem.innerHTML = bodyHtml;
        }

        // Render Otprema table (zadnjih 5 dana) - legacy, ne koristi se u index.html
        function renderPoslovodjaOtpremaZ5Table(otpreme) {
            const headerElem = document.getElementById('poslovodja-z5-otprema-header');
            const bodyElem = document.getElementById('poslovodja-z5-otprema-body');

            if (otpreme.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema otprema u zadnjih 5 dana</td></tr>';
                return;
            }

            // Build header - redosled: Radnik (Otpremac), Odjel, Datum, Sortiment, Količina
            let headerHtml = `
                <tr style="background: #dc2626;">
                    <th style="color: white; font-weight: 700;">Otpremac</th>
                    <th style="color: white; font-weight: 700;">Odjel</th>
                    <th style="color: white; font-weight: 700;">Datum</th>
                    <th style="color: white; font-weight: 700;">Sortiment</th>
                    <th style="color: white; font-weight: 700;">Količina (m³)</th>
                </tr>
            `;
            headerElem.innerHTML = headerHtml;

            // Build body
            let bodyHtml = '';
            otpreme.forEach((otprema, index) => {
                const rowBg = index % 2 === 0 ? '#fef2f2' : 'white';
                bodyHtml += `
                    <tr style="background: ${rowBg};">
                        <td style="font-weight: 600;">${otprema.otpremac || '-'}</td>
                        <td>${otprema.odjel || '-'}</td>
                        <td style="font-weight: 500;">${otprema.datum || '-'}</td>
                        <td>${otprema.sortiment || '-'}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #dc2626;">${(otprema.kolicina || 0).toFixed(2)}</td>
                    </tr>
                `;
            });

            bodyElem.innerHTML = bodyHtml;
        }

        // ============================================
        // POSLOVOĐA - SJEČA TAB (Zadnjih 10 dana)
        // ============================================

        // Sortiment kolone za SJEČA/OTPREMA tabove
        const SORT_KOLONE = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'TRUPCI Č', 'CEL.DUGA', 'CEL.CIJEPANA', 'ŠKART', 'Σ ČETINARI', 'F/L L', 'I L', 'II L', 'III L', 'TRUPCI L', 'OGR.DUGI', 'OGR.CIJEPANI', 'GULE', 'LIŠĆARI'];
        const SORT_KOLONE_HEADER = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'TRUPCI Č', 'CEL.D', 'CEL.C', 'ŠKART', 'ČETINARI', 'F/L L', 'I L', 'II L', 'III L', 'TRUPCI L', 'OGR.D', 'OGR.C', 'GULE', 'LIŠĆARI'];

        // Helper: parse DD.MM.YYYY to Date object
        function parseDatumDDMMYYYY(dateStr) {
            if (!dateStr) return null;
            const parts = dateStr.split('.');
            if (parts.length >= 3) {
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
            return null;
        }

        // Helper: procesira primke podatke za poslovođa sječa tab
        function processPrimkeForSjeca(primkeData) {
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
            tenDaysAgo.setHours(0, 0, 0, 0);

            const radilista = getPoslovodjaRadilista();
            const userFullName = currentUser.fullName.toUpperCase().trim();
            const filteredPrimke = (primkeData.primke || []).filter(primka => {
                const primkaDatum = parseDatumDDMMYYYY(primka.datum);
                if (!primkaDatum || primkaDatum < tenDaysAgo || primkaDatum > today) return false;
                const primkaPoslovodja = (primka.poslovodja || '').toUpperCase().trim();
                if (primkaPoslovodja && primkaPoslovodja === userFullName) return true;
                if (radilista.length > 0) {
                    const primkaRadiliste = (primka.radiliste || '').toUpperCase().trim();
                    return radilista.some(r => primkaRadiliste === r.toUpperCase());
                }
                return false;
            });

            const relevantSortimenti = new Set(SORT_KOLONE);
            const grouped = {};
            filteredPrimke.forEach(primka => {
                const sortiment = primka.sortiment || '';
                if (!relevantSortimenti.has(sortiment)) return;
                const datum = primka.datum;
                const odjel = primka.odjel || 'Nepoznato';
                const primac = primka.primac || 'Nepoznato';
                const key = `${datum}|${odjel}|${primac}`;
                if (!grouped[key]) {
                    grouped[key] = { datum, odjel, primac, sort: {} };
                    SORT_KOLONE.forEach(s => grouped[key].sort[s] = 0);
                }
                grouped[key].sort[sortiment] += (primka.kolicina || 0);
            });

            Object.values(grouped).forEach(row => {
                row.ukupno = (row.sort['Σ ČETINARI'] || 0) + (row.sort['LIŠĆARI'] || 0);
            });

            return Object.values(grouped).sort((a, b) => {
                const dateA = parseDatumDDMMYYYY(a.datum);
                const dateB = parseDatumDDMMYYYY(b.datum);
                if (dateB - dateA !== 0) return dateB - dateA;
                return a.odjel.localeCompare(b.odjel);
            });
        }

        async function loadPoslovodjaSjeca() {
            if (!isActiveTab('poslovodja-sjeca')) return;

            const radilista = getPoslovodjaRadilista();
            document.getElementById('poslovodja-radilista-list-sjeca').textContent = radilista.join(', ');

            // 🚀 TURBO: instant renderovanje iz keša
            var hasCached = false;
            try {
                var raw = localStorage.getItem('cache_primke_sjeca');
                if (raw) {
                    var parsed = JSON.parse(raw);
                    if (parsed.data && parsed.data.primke) {
                        document.getElementById('loading-screen').classList.add('hidden');
                        document.getElementById('poslovodja-sjeca-content').classList.remove('hidden');
                        renderPoslovodjaSjecaTable(processPrimkeForSjeca(parsed.data));
                        hasCached = true;
                    }
                }
            } catch (e) {}

            if (!hasCached) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('poslovodja-sjeca-content').classList.add('hidden');
            }

            // Background refresh
            try {
                const primkeUrl = buildApiUrl('primke');
                const primkeData = await fetchWithCache(primkeUrl, 'cache_primke_sjeca');

                if (primkeData.error) {
                    throw new Error('Greška pri učitavanju primki: ' + primkeData.error);
                }

                if (!isActiveTab('poslovodja-sjeca')) return;
                renderPoslovodjaSjecaTable(processPrimkeForSjeca(primkeData));

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-sjeca-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa sječa:', error);
                showError('Greška', 'Greška pri učitavanju sječe: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Render SJEČA table sa sortiment kolonama
        function renderPoslovodjaSjecaTable(data) {
            const headerElem = document.getElementById('poslovodja-sjeca-header');
            const bodyElem = document.getElementById('poslovodja-sjeca-body');

            if (data.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za zadnjih 10 dana</td></tr>';
                return;
            }

            // Zaglavlje
            let headerHtml = '<tr><th style="min-width:80px;">Datum</th><th style="min-width:80px;">Odjel</th><th style="min-width:100px;">Primač</th>';
            SORT_KOLONE_HEADER.forEach(s => {
                headerHtml += `<th style="min-width:55px; font-size:10px; text-align:right; white-space:nowrap;">${s}</th>`;
            });
            headerHtml += '<th style="min-width:70px; text-align:right; font-size:10px; white-space:nowrap;">UKUPNO Č+L</th></tr>';
            headerElem.innerHTML = headerHtml;

            // Subtotali po datumu
            const totalsByDate = {};
            const grandTotals = {};
            SORT_KOLONE.forEach(s => grandTotals[s] = 0);
            grandTotals['ukupno'] = 0;

            data.forEach(item => {
                if (!totalsByDate[item.datum]) {
                    totalsByDate[item.datum] = {};
                    SORT_KOLONE.forEach(s => totalsByDate[item.datum][s] = 0);
                    totalsByDate[item.datum]['ukupno'] = 0;
                }
                SORT_KOLONE.forEach(s => {
                    totalsByDate[item.datum][s] += item.sort[s];
                    grandTotals[s] += item.sort[s];
                });
                totalsByDate[item.datum]['ukupno'] += item.ukupno;
                grandTotals['ukupno'] += item.ukupno;
            });

            // Tijelo tabele sa grupisanjem po datumu
            let bodyHtml = '';
            let currentDate = null;
            let rowIndex = 0;
            const numCols = 3 + SORT_KOLONE.length + 1;

            data.forEach(item => {
                if (item.datum !== currentDate) {
                    if (currentDate !== null) {
                        bodyHtml += buildSubtotalRow(currentDate, totalsByDate[currentDate], numCols, '#dbeafe', '#1e40af');
                    }
                    currentDate = item.datum;
                }

                const rowBg = rowIndex % 2 === 0 ? '#f9fafb' : 'white';
                rowIndex++;

                bodyHtml += `<tr style="background:${rowBg};">`;
                bodyHtml += `<td style="font-weight:500;">${item.datum}</td>`;
                bodyHtml += `<td style="font-weight:600; color:#059669;">${item.odjel}</td>`;
                bodyHtml += `<td>${item.primac}</td>`;
                SORT_KOLONE.forEach(s => {
                    const val = item.sort[s];
                    bodyHtml += `<td style="text-align:right; font-family:'Courier New',monospace; font-size:11px; color:${val > 0 ? '#1f2937' : '#d1d5db'};">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                });
                bodyHtml += `<td style="text-align:right; font-family:'Courier New',monospace; font-weight:700; color:#059669;">${item.ukupno > 0 ? item.ukupno.toFixed(2) : '-'}</td>`;
                bodyHtml += '</tr>';
            });

            // Zadnji datum subtotal
            if (currentDate !== null) {
                bodyHtml += buildSubtotalRow(currentDate, totalsByDate[currentDate], numCols, '#dbeafe', '#1e40af');
            }

            // Grand total
            bodyHtml += `<tr style="background:#059669; color:white; border-top:3px solid #047857;">`;
            bodyHtml += `<td colspan="3" style="font-weight:700; text-align:right;">UKUPNO SJEČA:</td>`;
            SORT_KOLONE.forEach(s => {
                const val = grandTotals[s];
                bodyHtml += `<td style="text-align:right; font-family:'Courier New',monospace; font-size:11px; font-weight:700;">${val > 0 ? val.toFixed(2) : '-'}</td>`;
            });
            bodyHtml += `<td style="text-align:right; font-family:'Courier New',monospace; font-weight:700;">${grandTotals['ukupno'].toFixed(2)}</td>`;
            bodyHtml += '</tr>';

            bodyElem.innerHTML = bodyHtml;
        }

        // Helper: subtotal red po datumu
        function buildSubtotalRow(datum, totals, numCols, bgColor, textColor) {
            let html = `<tr style="background:${bgColor}; border-top:1px solid ${textColor};">`;
            html += `<td colspan="3" style="font-weight:700; text-align:right; color:${textColor};">Ukupno ${datum}:</td>`;
            SORT_KOLONE.forEach(s => {
                const val = totals[s];
                html += `<td style="text-align:right; font-family:'Courier New',monospace; font-size:11px; color:${textColor}; font-weight:700;">${val > 0 ? val.toFixed(2) : '-'}</td>`;
            });
            html += `<td style="text-align:right; font-family:'Courier New',monospace; color:${textColor}; font-weight:700;">${totals['ukupno'].toFixed(2)}</td>`;
            html += '</tr>';
            return html;
        }

        // ============================================
        // POSLOVOĐA - OTPREMA TAB (Zadnjih 10 dana)
        // ============================================
        // Helper: procesira otpreme podatke za poslovođa otprema tab
        function processOtpremeForOtprema(otpremeData) {
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
            tenDaysAgo.setHours(0, 0, 0, 0);

            const radilista = getPoslovodjaRadilista();
            const userFullName = currentUser.fullName.toUpperCase().trim();
            const filteredOtpreme = (otpremeData.otpreme || []).filter(otprema => {
                const otpremaDatum = parseDatumDDMMYYYY(otprema.datum);
                if (!otpremaDatum || otpremaDatum < tenDaysAgo || otpremaDatum > today) return false;
                const otpremaPoslovodja = (otprema.poslovodja || '').toUpperCase().trim();
                if (otpremaPoslovodja && otpremaPoslovodja === userFullName) return true;
                if (radilista.length > 0) {
                    const otpremaRadiliste = (otprema.radiliste || '').toUpperCase().trim();
                    return radilista.some(r => otpremaRadiliste === r.toUpperCase());
                }
                return false;
            });

            const relevantSortimenti = new Set(SORT_KOLONE);
            const grouped = {};
            filteredOtpreme.forEach(otprema => {
                const sortiment = otprema.sortiment || '';
                if (!relevantSortimenti.has(sortiment)) return;
                const datum = otprema.datum;
                const odjel = otprema.odjel || 'Nepoznato';
                const otpremac = otprema.otpremac || 'Nepoznato';
                const kupac = otprema.kupac || 'Nepoznato';
                const key = `${datum}|${odjel}|${otpremac}|${kupac}`;
                if (!grouped[key]) {
                    grouped[key] = { datum, odjel, otpremac, kupac, sort: {} };
                    SORT_KOLONE.forEach(s => grouped[key].sort[s] = 0);
                }
                grouped[key].sort[sortiment] += (otprema.kolicina || 0);
            });

            Object.values(grouped).forEach(row => {
                row.ukupno = (row.sort['Σ ČETINARI'] || 0) + (row.sort['LIŠĆARI'] || 0);
            });

            return Object.values(grouped).sort((a, b) => {
                const dateA = parseDatumDDMMYYYY(a.datum);
                const dateB = parseDatumDDMMYYYY(b.datum);
                if (dateB - dateA !== 0) return dateB - dateA;
                if (a.odjel !== b.odjel) return a.odjel.localeCompare(b.odjel);
                return a.kupac.localeCompare(b.kupac);
            });
        }

        async function loadPoslovodjaOtprema() {
            if (!isActiveTab('poslovodja-otprema')) return;

            const radilista = getPoslovodjaRadilista();
            document.getElementById('poslovodja-radilista-list-otprema').textContent = radilista.join(', ');

            // 🚀 TURBO: instant renderovanje iz keša
            var hasCached = false;
            try {
                var raw = localStorage.getItem('cache_otpreme_tab');
                if (raw) {
                    var parsed = JSON.parse(raw);
                    if (parsed.data && parsed.data.otpreme) {
                        document.getElementById('loading-screen').classList.add('hidden');
                        document.getElementById('poslovodja-otprema-content').classList.remove('hidden');
                        renderPoslovodjaOtpremaTabTable(processOtpremeForOtprema(parsed.data));
                        hasCached = true;
                    }
                }
            } catch (e) {}

            if (!hasCached) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('poslovodja-otprema-content').classList.add('hidden');
            }

            // Background refresh
            try {
                const otpremeUrl = buildApiUrl('otpreme');
                const otpremeData = await fetchWithCache(otpremeUrl, 'cache_otpreme_tab');

                if (otpremeData.error) {
                    throw new Error('Greška pri učitavanju otprema: ' + otpremeData.error);
                }

                if (!isActiveTab('poslovodja-otprema')) return;
                renderPoslovodjaOtpremaTabTable(processOtpremeForOtprema(otpremeData));

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-otprema-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa otprema:', error);
                showError('Greška', 'Greška pri učitavanju otpreme: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Render OTPREMA TAB table sa sortiment kolonama
        function renderPoslovodjaOtpremaTabTable(data) {
            const headerElem = document.getElementById('poslovodja-otprema-header');
            const bodyElem = document.getElementById('poslovodja-otprema-body');

            if (data.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za zadnjih 10 dana</td></tr>';
                return;
            }

            // Zaglavlje
            let headerHtml = '<tr><th style="min-width:80px;">Datum</th><th style="min-width:80px;">Odjel</th><th style="min-width:100px;">Otpremač</th><th style="min-width:100px;">Kupac</th>';
            SORT_KOLONE_HEADER.forEach(s => {
                headerHtml += `<th style="min-width:55px; font-size:10px; text-align:right; white-space:nowrap;">${s}</th>`;
            });
            headerHtml += '<th style="min-width:70px; text-align:right; font-size:10px; white-space:nowrap;">UKUPNO Č+L</th></tr>';
            headerElem.innerHTML = headerHtml;

            // Subtotali po datumu
            const totalsByDate = {};
            const grandTotals = {};
            SORT_KOLONE.forEach(s => grandTotals[s] = 0);
            grandTotals['ukupno'] = 0;

            data.forEach(item => {
                if (!totalsByDate[item.datum]) {
                    totalsByDate[item.datum] = {};
                    SORT_KOLONE.forEach(s => totalsByDate[item.datum][s] = 0);
                    totalsByDate[item.datum]['ukupno'] = 0;
                }
                SORT_KOLONE.forEach(s => {
                    totalsByDate[item.datum][s] += item.sort[s];
                    grandTotals[s] += item.sort[s];
                });
                totalsByDate[item.datum]['ukupno'] += item.ukupno;
                grandTotals['ukupno'] += item.ukupno;
            });

            // Tijelo tabele sa grupisanjem po datumu
            let bodyHtml = '';
            let currentDate = null;
            let rowIndex = 0;
            const colspanInfo = 4; // datum + odjel + otpremac + kupac

            data.forEach(item => {
                if (item.datum !== currentDate) {
                    if (currentDate !== null) {
                        bodyHtml += buildOtpremaSubtotalRow(currentDate, totalsByDate[currentDate], colspanInfo);
                    }
                    currentDate = item.datum;
                }

                const rowBg = rowIndex % 2 === 0 ? '#f9fafb' : 'white';
                rowIndex++;

                bodyHtml += `<tr style="background:${rowBg};">`;
                bodyHtml += `<td style="font-weight:500;">${item.datum}</td>`;
                bodyHtml += `<td style="font-weight:600; color:#dc2626;">${item.odjel}</td>`;
                bodyHtml += `<td>${item.otpremac}</td>`;
                bodyHtml += `<td style="color:#7c3aed; font-weight:500;">${item.kupac}</td>`;
                SORT_KOLONE.forEach(s => {
                    const val = item.sort[s];
                    bodyHtml += `<td style="text-align:right; font-family:'Courier New',monospace; font-size:11px; color:${val > 0 ? '#1f2937' : '#d1d5db'};">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                });
                bodyHtml += `<td style="text-align:right; font-family:'Courier New',monospace; font-weight:700; color:#dc2626;">${item.ukupno > 0 ? item.ukupno.toFixed(2) : '-'}</td>`;
                bodyHtml += '</tr>';
            });

            // Zadnji datum subtotal
            if (currentDate !== null) {
                bodyHtml += buildOtpremaSubtotalRow(currentDate, totalsByDate[currentDate], colspanInfo);
            }

            // Grand total
            bodyHtml += `<tr style="background:#dc2626; color:white; border-top:3px solid #b91c1c;">`;
            bodyHtml += `<td colspan="${colspanInfo}" style="font-weight:700; text-align:right;">UKUPNO OTPREMA:</td>`;
            SORT_KOLONE.forEach(s => {
                const val = grandTotals[s];
                bodyHtml += `<td style="text-align:right; font-family:'Courier New',monospace; font-size:11px; font-weight:700;">${val > 0 ? val.toFixed(2) : '-'}</td>`;
            });
            bodyHtml += `<td style="text-align:right; font-family:'Courier New',monospace; font-weight:700;">${grandTotals['ukupno'].toFixed(2)}</td>`;
            bodyHtml += '</tr>';

            bodyElem.innerHTML = bodyHtml;
        }

        // Helper: OTPREMA subtotal red
        function buildOtpremaSubtotalRow(datum, totals, colspan) {
            let html = `<tr style="background:#fee2e2; border-top:1px solid #ef4444;">`;
            html += `<td colspan="${colspan}" style="font-weight:700; text-align:right; color:#dc2626;">Ukupno ${datum}:</td>`;
            SORT_KOLONE.forEach(s => {
                const val = totals[s];
                html += `<td style="text-align:right; font-family:'Courier New',monospace; font-size:11px; color:#dc2626; font-weight:700;">${val > 0 ? val.toFixed(2) : '-'}</td>`;
            });
            html += `<td style="text-align:right; font-family:'Courier New',monospace; color:#dc2626; font-weight:700;">${totals['ukupno'].toFixed(2)}</td>`;
            html += '</tr>';
            return html;
        }

        // ============================================
        // POSLOVODJA - PREGLED TAB (Mjesečni po odjelima)
        // ============================================
        // Helper: procesira primke + otpreme za poslovođa pregled tab
        function processPregledData(primkeData, otpremeData) {
            var radilista = getPoslovodjaRadilista();
            var userFullName = currentUser.fullName.toUpperCase().trim();
            var relevantSortimenti = new Set(SORT_KOLONE);

            function filterByPoslovodja(entries) {
                return entries.filter(function(entry) {
                    var entryDatum = parseDatumDDMMYYYY(entry.datum);
                    if (!entryDatum) return false;
                    var entryPoslovodja = (entry.poslovodja || '').toUpperCase().trim();
                    if (entryPoslovodja && entryPoslovodja === userFullName) return true;
                    if (radilista.length > 0) {
                        var entryRadiliste = (entry.radiliste || '').toUpperCase().trim();
                        return radilista.some(function(r) { return entryRadiliste === r.toUpperCase(); });
                    }
                    return false;
                });
            }

            var filteredPrimke = filterByPoslovodja(primkeData.primke || []);
            var filteredOtpreme = filterByPoslovodja(otpremeData.otpreme || []);

            function aggregateByOdjelMonth(entries) {
                var result = {};
                entries.forEach(function(entry) {
                    var sortiment = entry.sortiment || '';
                    if (!relevantSortimenti.has(sortiment)) return;
                    var odjel = entry.odjel || 'Nepoznato';
                    var datum = parseDatumDDMMYYYY(entry.datum);
                    if (!datum) return;
                    var yearMonth = datum.getFullYear() + '-' + String(datum.getMonth()).padStart(2, '0');
                    if (!result[odjel]) result[odjel] = {};
                    if (!result[odjel][yearMonth]) {
                        result[odjel][yearMonth] = { sort: {}, year: datum.getFullYear(), month: datum.getMonth() };
                        SORT_KOLONE.forEach(function(s) { result[odjel][yearMonth].sort[s] = 0; });
                    }
                    result[odjel][yearMonth].sort[sortiment] += (entry.kolicina || 0);
                });
                Object.values(result).forEach(function(months) {
                    Object.values(months).forEach(function(md) {
                        md.ukupno = (md.sort['Σ ČETINARI'] || 0) + (md.sort['LIŠĆARI'] || 0);
                    });
                });
                return result;
            }

            var sjecaByOdjelMonth = aggregateByOdjelMonth(filteredPrimke);
            var otpremaByOdjelMonth = aggregateByOdjelMonth(filteredOtpreme);

            var odjelRadilisteMap = {};
            filteredPrimke.concat(filteredOtpreme).forEach(function(entry) {
                var odjel = entry.odjel || 'Nepoznato';
                var rad = (entry.radiliste || '').trim();
                if (rad && !odjelRadilisteMap[odjel]) {
                    odjelRadilisteMap[odjel] = rad;
                }
            });

            var allOdjeli = new Set(Object.keys(sjecaByOdjelMonth).concat(Object.keys(otpremaByOdjelMonth)));
            var radilisteOdjeli = {};
            allOdjeli.forEach(function(odjel) {
                var rad = odjelRadilisteMap[odjel] || 'OSTALO';
                if (!radilisteOdjeli[rad]) radilisteOdjeli[rad] = [];
                radilisteOdjeli[rad].push(odjel);
            });

            function getLatestKey(odjel) {
                var sKeys = sjecaByOdjelMonth[odjel] ? Object.keys(sjecaByOdjelMonth[odjel]) : [];
                var oKeys = otpremaByOdjelMonth[odjel] ? Object.keys(otpremaByOdjelMonth[odjel]) : [];
                var allKeys = sKeys.concat(oKeys);
                if (allKeys.length === 0) return '0000-00';
                return allKeys.sort().pop();
            }
            Object.values(radilisteOdjeli).forEach(function(arr) {
                arr.sort(function(a, b) {
                    return getLatestKey(b).localeCompare(getLatestKey(a));
                });
            });

            return { radilisteOdjeli, sjecaByOdjelMonth, otpremaByOdjelMonth };
        }

        async function loadPoslovodjaPregled() {
            if (!isActiveTab('poslovodja-pregled')) return;

            var radilista = getPoslovodjaRadilista();
            document.getElementById('poslovodja-radilista-list-pregled').textContent = radilista.join(', ');

            // 🚀 TURBO: instant renderovanje iz keša (oba keša moraju postojati)
            var hasCached = false;
            try {
                var rawPrimke = localStorage.getItem('cache_primke_sjeca');
                var rawOtpreme = localStorage.getItem('cache_otpreme_tab');
                if (rawPrimke && rawOtpreme) {
                    var parsedP = JSON.parse(rawPrimke);
                    var parsedO = JSON.parse(rawOtpreme);
                    if (parsedP.data && parsedO.data) {
                        document.getElementById('loading-screen').classList.add('hidden');
                        document.getElementById('poslovodja-pregled-content').classList.remove('hidden');
                        var result = processPregledData(parsedP.data, parsedO.data);
                        renderPoslovodjaPregled(result.radilisteOdjeli, result.sjecaByOdjelMonth, result.otpremaByOdjelMonth);
                        hasCached = true;
                    }
                }
            } catch (e) {}

            if (!hasCached) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('poslovodja-pregled-content').classList.add('hidden');
            }

            // Background refresh
            try {
                var primkeUrl = buildApiUrl('primke');
                var otpremeUrl = buildApiUrl('otpreme');
                var results = await Promise.all([
                    fetchWithCache(primkeUrl, 'cache_primke_sjeca'),
                    fetchWithCache(otpremeUrl, 'cache_otpreme_tab')
                ]);
                var primkeData = results[0];
                var otpremeData = results[1];

                if (primkeData.error) throw new Error('Greška pri učitavanju primki: ' + primkeData.error);
                if (otpremeData.error) throw new Error('Greška pri učitavanju otprema: ' + otpremeData.error);

                if (!isActiveTab('poslovodja-pregled')) return;
                var result = processPregledData(primkeData, otpremeData);
                renderPoslovodjaPregled(result.radilisteOdjeli, result.sjecaByOdjelMonth, result.otpremaByOdjelMonth);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-pregled-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa pregled:', error);
                showError('Greška', 'Greška pri učitavanju pregleda: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        function renderPoslovodjaPregled(radilisteOdjeli, sjecaData, otpremaData) {
            var container = document.getElementById('poslovodja-pregled-container');

            if (Object.keys(radilisteOdjeli).length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka</div>';
                return;
            }

            var html = '';
            var sortedRadilista = Object.keys(radilisteOdjeli).sort();

            sortedRadilista.forEach(function(radiliste) {
                html += '<div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); color: white; padding: 14px 20px; border-radius: 10px; margin: 30px 0 16px 0; font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">📍 ' + radiliste + '</div>';

                var odjeli = radilisteOdjeli[radiliste];
                odjeli.forEach(function(odjel) {
                    html += renderPregledSection(odjel, 'SJEČA', sjecaData[odjel] || {}, '#059669', '#ecfdf5');
                    html += renderPregledSection(odjel, 'OTPREMA', otpremaData[odjel] || {}, '#dc2626', '#fef2f2');
                });
            });

            container.innerHTML = html;
        }

        function renderPregledSection(odjel, type, monthlyData, accentColor, headerBg) {
            // Sortiraj po year-month ključevima hronološki
            var keys = Object.keys(monthlyData).sort();
            var html = '';
            var thisYear = new Date().getFullYear();

            html += '<div style="background: ' + headerBg + '; border-left: 4px solid ' + accentColor + '; padding: 10px 16px; margin: 16px 0 8px 0; border-radius: 0 8px 8px 0;">';
            html += '<h3 style="margin: 0; color: ' + accentColor + '; font-size: 14px; font-weight: 700;">' + odjel + ' - ' + type + '</h3></div>';

            if (keys.length === 0) {
                html += '<p style="color: #9ca3af; padding: 10px 16px; font-size: 13px; font-style: italic;">Nema podataka</p>';
                return html;
            }

            html += '<div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 8px;">';
            html += '<table class="monthly-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">';

            // Header
            html += '<thead><tr style="background: #f8fafc;">';
            html += '<th style="min-width: 120px; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb;">Mjesec</th>';
            SORT_KOLONE_HEADER.forEach(function(s) {
                html += '<th style="min-width: 60px; font-size: 10px; text-align: right; white-space: nowrap; padding: 8px 6px; border-bottom: 2px solid #e5e7eb;">' + s + '</th>';
            });
            html += '<th style="min-width: 75px; text-align: right; font-size: 10px; white-space: nowrap; padding: 8px 6px; border-bottom: 2px solid #e5e7eb;">UKUPNO Č+L</th>';
            html += '</tr></thead>';

            // Body
            html += '<tbody>';
            var grandTotals = {};
            SORT_KOLONE.forEach(function(s) { grandTotals[s] = 0; });
            grandTotals['ukupno'] = 0;

            keys.forEach(function(key, rowIndex) {
                var monthData = monthlyData[key];
                var rowBg = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb';
                var monthLabel = getMonthName(monthData.month);
                if (monthData.year !== thisYear) {
                    monthLabel += ' ' + monthData.year;
                }

                html += '<tr style="background: ' + rowBg + ';">';
                html += '<td style="font-weight: 600; padding: 7px 10px; color: #374151;">' + monthLabel + '</td>';

                SORT_KOLONE.forEach(function(s) {
                    var val = monthData.sort[s] || 0;
                    grandTotals[s] += val;
                    html += '<td style="text-align: right; font-family: \'Courier New\', monospace; font-size: 11px; padding: 7px 6px; color: ' + (val > 0 ? '#1f2937' : '#d1d5db') + ';">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                });

                var ukupno = monthData.ukupno || 0;
                grandTotals['ukupno'] += ukupno;
                html += '<td style="text-align: right; font-family: \'Courier New\', monospace; font-weight: 700; padding: 7px 6px; color: ' + accentColor + ';">' + (ukupno > 0 ? ukupno.toFixed(2) : '-') + '</td>';
                html += '</tr>';
            });

            // UKUPNO row
            html += '<tr style="background: ' + accentColor + '; color: white; border-top: 2px solid ' + accentColor + ';">';
            html += '<td style="font-weight: 700; padding: 8px 10px;">UKUPNO</td>';
            SORT_KOLONE.forEach(function(s) {
                var val = grandTotals[s];
                html += '<td style="text-align: right; font-family: \'Courier New\', monospace; font-size: 11px; font-weight: 700; padding: 8px 6px;">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
            });
            html += '<td style="text-align: right; font-family: \'Courier New\', monospace; font-weight: 700; padding: 8px 6px;">' + (grandTotals['ukupno'] > 0 ? grandTotals['ukupno'].toFixed(2) : '-') + '</td>';
            html += '</tr>';

            html += '</tbody></table></div>';
            return html;
        }

        // Load primaci data
        async function loadPrimaci() {
            try {
                const year = new Date().getFullYear();
                const cacheKey = 'cache_primaci_' + year;
                const url = buildApiUrl('primaci', { year });

                // 🚀 INSTANT SHOW: Check cache first
                let hasCachedData = false;
                const cachedPrimaci = localStorage.getItem(cacheKey);
                if (cachedPrimaci) {
                    try {
                        const parsed = JSON.parse(cachedPrimaci);
                        if (parsed.data && parsed.data.primaci) {
                            // ✨ INSTANT: Show cached data immediately
                            if (!isActiveTab('primaci')) return;
                            document.getElementById('loading-screen').classList.add('hidden');
                            document.getElementById('primaci-content').classList.remove('hidden');
                            renderPrimaci(parsed.data);
                            hasCachedData = true;

                            // Show cache indicator
                            const age = Date.now() - parsed.timestamp;
                            showCacheIndicator(age);
                        }
                    } catch (e) {
                        console.error('Cache parse error:', e);
                    }
                }

                // If no cache, show loading screen
                if (!hasCachedData) {
                    document.getElementById('loading-screen').classList.remove('hidden');
                    document.getElementById('primaci-content').classList.add('hidden');
                }

                // 🔄 BACKGROUND REFRESH (180s timeout)
                try {
                    const data = await fetchWithCache(url, cacheKey, false, 180000);
                    if (data.error) {
                        if (!hasCachedData) throw new Error(data.error);
                        markTabRendered('primaci');
                        return;
                    }
                    renderPrimaci(data);
                    hideCacheIndicator();
                    markTabRendered('primaci');
                } catch (error) {
                    if (!hasCachedData) {
                        throw error;
                    }
                    markTabRendered('primaci');
                    // Silently fail if we have cached data
                }

            } catch (error) {
                console.error('Primači error:', error);

                // Determine error type and show appropriate message
                let errorTitle = 'Greška pri učitavanju primača';
                let errorMessage = error.message;
                let errorIcon = '⚠️';

                if (error.message && error.message.includes('Server je spor')) {
                    errorIcon = '⏱️';
                    errorTitle = 'Vremensko ograničenje prekoračeno';
                    errorMessage = 'Server ne odgovara dovoljno brzo. Molimo pokušajte ponovo.';
                } else if (error.message && error.message.includes('Nema podataka')) {
                    errorIcon = '📭';
                    errorTitle = 'Nema podataka';
                }

                showError('Greška', errorTitle + ': ' + errorMessage);
                document.getElementById('loading-screen').innerHTML = `
                    <div class="loading-icon">${errorIcon}</div>
                    <div class="loading-text">${errorTitle}</div>
                    <div class="loading-sub">${errorMessage}</div>
                    <button class="btn btn-primary" style="margin-top: 20px;" onclick="loadPrimaci()">🔄 Pokušaj ponovo</button>
                `;
            }
        }

        // Separate render function for primaci
        function renderPrimaci(data) {

                // Validate data structure
                if (!data || !data.primaci || !Array.isArray(data.primaci)) {
                    console.error('Invalid primaci data structure:', data);
                    showError('Greška', 'Neispravni podaci primača');
                    return;
                }

                if (!data.mjeseci || !Array.isArray(data.mjeseci)) {
                    console.error('Missing mjeseci in primaci data');
                    showError('Greška', 'Nedostaju mjeseci u podacima');
                    return;
                }

                // Calculate totals per month
                const monthTotals = new Array(12).fill(0);
                let grandTotal = 0;

                data.primaci.forEach(p => {
                    if (p.mjeseci && Array.isArray(p.mjeseci)) {
                        p.mjeseci.forEach((val, idx) => {
                            monthTotals[idx] += (val || 0);
                        });
                    }
                    grandTotal += (p.ukupno || 0);
                });

                // Create header with sticky styling
                const headerHTML = `
                    <tr>
                        <th style="position: sticky; left: 0; background: #059669; z-index: 20; border-right: 3px solid #047857; min-width: 150px;">
                            👷 Primač
                        </th>
                        ${data.mjeseci.map((m, idx) => `
                            <th class="right" style="min-width: 80px; background: #059669; color: white; font-weight: 700; border: 1px solid #047857;">
                                ${m}
                            </th>
                        `).join('')}
                        <th class="right" style="min-width: 100px; background: #047857; color: white; font-weight: 900; border: 2px solid #065f46;">
                            📊 UKUPNO
                        </th>
                    </tr>
                `;
                document.getElementById('primaci-header').innerHTML = headerHTML;

                // Create body with enhanced styling
                const bodyHTML = data.primaci.map((p, idx) => {
                    const rowBg = idx % 2 === 0 ? '#f0fdf4' : 'white';
                    const hoverBg = idx % 2 === 0 ? '#dcfce7' : '#f0fdf4';

                    return `
                        <tr style="background: ${rowBg}; transition: all 0.2s;" onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${rowBg}'">
                            <td style="font-weight: 600; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #059669; padding: 10px; font-size: 11px;">
                                ${p.primac || '-'}
                            </td>
                            ${(p.mjeseci && Array.isArray(p.mjeseci) ? p.mjeseci : new Array(12).fill(0)).map((v, mIdx) => {
                                const val = (v != null && !isNaN(v)) ? v : 0;
                                const displayVal = val > 0 ? val.toFixed(2) : '-';
                                const cellStyle = val > 0 ? 'font-weight: 600; color: #000000; text-shadow: 0 0 1px rgba(255,255,255,0.8);' : 'color: #9ca3af;';
                                return `<td class="right" style="${cellStyle} border: 1px solid #d1fae5; padding: 8px; font-size: 11px; font-family: 'Roboto Mono', ui-monospace, monospace;">${displayVal}</td>`;
                            }).join('')}
                            <td class="right" style="font-weight: 700; background: linear-gradient(to right, #d1fae5, #a7f3d0); border: 2px solid #059669; padding: 10px; font-size: 11px; color: #065f46;">
                                ${(p.ukupno != null && !isNaN(p.ukupno)) ? p.ukupno.toFixed(2) : '0.00'} m³
                            </td>
                        </tr>
                    `;
                }).join('');

                // Add totals row with softer colors
                const totalsRow = `
                    <tr style="background: linear-gradient(to bottom, #d1fae5, #a7f3d0); color: #065f46; font-weight: 700; border-top: 3px solid #34d399;">
                        <td style="position: sticky; left: 0; background: #d1fae5; z-index: 10; border-right: 3px solid #34d399; padding: 12px; font-size: 12px;">
                            📈 UKUPNO
                        </td>
                        ${monthTotals.map(total => {
                            const val = (total != null && !isNaN(total)) ? total : 0;
                            return `
                            <td class="right" style="border: 1px solid #6ee7b7; padding: 10px; font-size: 12px; font-weight: 700; color: #000000; font-family: 'Roboto Mono', ui-monospace, monospace; text-shadow: 0 0 1px rgba(255,255,255,0.8);">
                                ${val > 0 ? val.toFixed(2) : '-'}
                            </td>`;
                        }).join('')}
                        <td class="right" style="background: #a7f3d0; border: 2px solid #34d399; padding: 12px; font-size: 13px; font-weight: 900; color: #000000; font-family: 'Roboto Mono', ui-monospace, monospace;">
                            ${(grandTotal != null && !isNaN(grandTotal)) ? grandTotal.toFixed(2) : '0.00'} m³
                        </td>
                    </tr>
                `;

                document.getElementById('primaci-body').innerHTML = bodyHTML + totalsRow;

                // ===== TABELA 2: Prosječna sječa po radnom danu =====
                const prosjekHeaderHTML = `
                    <tr>
                        <th style="position: sticky; left: 0; background: #2563eb; z-index: 20; border-right: 3px solid #1d4ed8; min-width: 150px; color: white;">
                            👷 Primač
                        </th>
                        ${data.mjeseci.map((m, idx) => `
                            <th class="right" style="min-width: 80px; background: #2563eb; color: white; font-weight: 700; border: 1px solid #1d4ed8;">
                                ${m}
                            </th>
                        `).join('')}
                        <th class="right" style="min-width: 100px; background: #1d4ed8; color: white; font-weight: 900; border: 2px solid #1e3a5f;">
                            📊 PROSJEK
                        </th>
                    </tr>
                `;
                document.getElementById('primaci-prosjek-header').innerHTML = prosjekHeaderHTML;

                // Calculate average totals per month
                const prosjekMonthTotals = new Array(12).fill(0);
                const prosjekMonthDays = new Array(12).fill(0);

                const prosjekBodyHTML = data.primaci.map((p, idx) => {
                    const rowBg = idx % 2 === 0 ? '#eff6ff' : 'white';
                    const hoverBg = idx % 2 === 0 ? '#dbeafe' : '#eff6ff';
                    const radniDani = p.radniDani || new Array(12).fill(0);
                    const mjeseci = (p.mjeseci && Array.isArray(p.mjeseci)) ? p.mjeseci : new Array(12).fill(0);

                    let totalKubika = 0;
                    let totalDana = 0;

                    const cells = mjeseci.map((v, mIdx) => {
                        const val = (v != null && !isNaN(v)) ? v : 0;
                        const dani = radniDani[mIdx] || 0;
                        const prosjek = dani > 0 ? val / dani : 0;

                        if (val > 0) {
                            prosjekMonthTotals[mIdx] += val;
                            prosjekMonthDays[mIdx] += dani;
                        }
                        totalKubika += val;
                        totalDana += dani;

                        const displayVal = prosjek > 0 ? prosjek.toFixed(2) : '-';
                        const cellStyle = prosjek > 0 ? 'font-weight: 600; color: #000000;' : 'color: #9ca3af;';
                        return `<td class="right" style="${cellStyle} border: 1px solid #bfdbfe; padding: 8px; font-size: 11px; font-family: 'Roboto Mono', ui-monospace, monospace;">${displayVal}</td>`;
                    }).join('');

                    const ukupniProsjek = totalDana > 0 ? (totalKubika / totalDana).toFixed(2) : '0.00';

                    return `
                        <tr style="background: ${rowBg}; transition: all 0.2s;" onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${rowBg}'">
                            <td style="font-weight: 600; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #2563eb; padding: 10px; font-size: 11px;">
                                ${p.primac || '-'}
                            </td>
                            ${cells}
                            <td class="right" style="font-weight: 700; background: linear-gradient(to right, #dbeafe, #bfdbfe); border: 2px solid #2563eb; padding: 10px; font-size: 11px; color: #1e3a5f;">
                                ${ukupniProsjek} m³/dan
                            </td>
                        </tr>
                    `;
                }).join('');

                const prosjekTotalsRow = `
                    <tr style="background: linear-gradient(to bottom, #dbeafe, #bfdbfe); color: #1e3a5f; font-weight: 700; border-top: 3px solid #60a5fa;">
                        <td style="position: sticky; left: 0; background: #dbeafe; z-index: 10; border-right: 3px solid #60a5fa; padding: 12px; font-size: 12px;">
                            📈 PROSJEK
                        </td>
                        ${prosjekMonthTotals.map((total, idx) => {
                            const dani = prosjekMonthDays[idx];
                            const prosjek = dani > 0 ? total / dani : 0;
                            return `
                            <td class="right" style="border: 1px solid #93c5fd; padding: 10px; font-size: 12px; font-weight: 700; color: #000000; font-family: 'Roboto Mono', ui-monospace, monospace;">
                                ${prosjek > 0 ? prosjek.toFixed(2) : '-'}
                            </td>`;
                        }).join('')}
                        <td class="right" style="background: #bfdbfe; border: 2px solid #60a5fa; padding: 12px; font-size: 13px; font-weight: 900; color: #000000; font-family: 'Roboto Mono', ui-monospace, monospace;">
                            ${(() => { const tK = prosjekMonthTotals.reduce((a,b) => a+b, 0); const tD = prosjekMonthDays.reduce((a,b) => a+b, 0); return tD > 0 ? (tK/tD).toFixed(2) : '0.00'; })()} m³/dan
                        </td>
                    </tr>
                `;

                document.getElementById('primaci-prosjek-body').innerHTML = prosjekBodyHTML + prosjekTotalsRow;

                // ===== TABELA 3: Broj radnih dana po mjesecima =====
                const daniHeaderHTML = `
                    <tr>
                        <th style="position: sticky; left: 0; background: #d97706; z-index: 20; border-right: 3px solid #b45309; min-width: 150px; color: white;">
                            👷 Primač
                        </th>
                        ${data.mjeseci.map((m, idx) => `
                            <th class="right" style="min-width: 80px; background: #d97706; color: white; font-weight: 700; border: 1px solid #b45309;">
                                ${m}
                            </th>
                        `).join('')}
                        <th class="right" style="min-width: 100px; background: #b45309; color: white; font-weight: 900; border: 2px solid #92400e;">
                            📊 UKUPNO
                        </th>
                    </tr>
                `;
                document.getElementById('primaci-radni-dani-header').innerHTML = daniHeaderHTML;

                const daniMonthTotals = new Array(12).fill(0);
                let daniGrandTotal = 0;

                const daniBodyHTML = data.primaci.map((p, idx) => {
                    const rowBg = idx % 2 === 0 ? '#fffbeb' : 'white';
                    const hoverBg = idx % 2 === 0 ? '#fef3c7' : '#fffbeb';
                    const radniDani = p.radniDani || new Array(12).fill(0);
                    let ukupnoDana = 0;

                    const cells = radniDani.map((dani, mIdx) => {
                        const val = dani || 0;
                        daniMonthTotals[mIdx] = Math.max(daniMonthTotals[mIdx], val);
                        ukupnoDana += val;
                        const displayVal = val > 0 ? val : '-';
                        const cellStyle = val > 0 ? 'font-weight: 600; color: #000000;' : 'color: #9ca3af;';
                        return `<td class="right" style="${cellStyle} border: 1px solid #fde68a; padding: 8px; font-size: 11px; font-family: 'Roboto Mono', ui-monospace, monospace;">${displayVal}</td>`;
                    }).join('');

                    daniGrandTotal = Math.max(daniGrandTotal, ukupnoDana);

                    return `
                        <tr style="background: ${rowBg}; transition: all 0.2s;" onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${rowBg}'">
                            <td style="font-weight: 600; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #d97706; padding: 10px; font-size: 11px;">
                                ${p.primac || '-'}
                            </td>
                            ${cells}
                            <td class="right" style="font-weight: 700; background: linear-gradient(to right, #fef3c7, #fde68a); border: 2px solid #d97706; padding: 10px; font-size: 11px; color: #92400e;">
                                ${ukupnoDana} dana
                            </td>
                        </tr>
                    `;
                }).join('');

                const daniTotalsRow = `
                    <tr style="background: linear-gradient(to bottom, #fef3c7, #fde68a); color: #92400e; font-weight: 700; border-top: 3px solid #fbbf24;">
                        <td style="position: sticky; left: 0; background: #fef3c7; z-index: 10; border-right: 3px solid #fbbf24; padding: 12px; font-size: 12px;">
                            📈 MAX DANA
                        </td>
                        ${daniMonthTotals.map(total => {
                            return `
                            <td class="right" style="border: 1px solid #fcd34d; padding: 10px; font-size: 12px; font-weight: 700; color: #000000; font-family: 'Roboto Mono', ui-monospace, monospace;">
                                ${total > 0 ? total : '-'}
                            </td>`;
                        }).join('')}
                        <td class="right" style="background: #fde68a; border: 2px solid #fbbf24; padding: 12px; font-size: 13px; font-weight: 900; color: #000000; font-family: 'Roboto Mono', ui-monospace, monospace;">
                            ${daniGrandTotal} dana
                        </td>
                    </tr>
                `;

                document.getElementById('primaci-radni-dani-body').innerHTML = daniBodyHTML + daniTotalsRow;

                if (!isActiveTab('primaci')) return;
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('primaci-content').classList.remove('hidden');
        }

        // Load otpremaci data
        async function loadOtpremaci() {
            try {
                const year = new Date().getFullYear();
                const cacheKey = 'cache_otpremaci_' + year;
                const url = buildApiUrl('otpremaci', { year });

                // 🚀 INSTANT SHOW: Check cache first
                let hasCachedData = false;
                const cachedOtpremaci = localStorage.getItem(cacheKey);
                if (cachedOtpremaci) {
                    try {
                        const parsed = JSON.parse(cachedOtpremaci);
                        if (parsed.data && parsed.data.otpremaci) {
                            // ✨ INSTANT: Show cached data immediately
                            if (!isActiveTab('otpremaci')) return;
                            document.getElementById('loading-screen').classList.add('hidden');
                            document.getElementById('otpremaci-content').classList.remove('hidden');
                            renderOtpremaci(parsed.data);
                            hasCachedData = true;

                            // Show cache indicator
                            const age = Date.now() - parsed.timestamp;
                            showCacheIndicator(age);
                        }
                    } catch (e) {
                        console.error('Cache parse error:', e);
                    }
                }

                // If no cache, show loading screen
                if (!hasCachedData) {
                    document.getElementById('loading-screen').classList.remove('hidden');
                    document.getElementById('otpremaci-content').classList.add('hidden');
                }

                // 🔄 BACKGROUND REFRESH (180s timeout)
                try {
                    const data = await fetchWithCache(url, cacheKey, false, 180000);
                    if (data.error) {
                        if (!hasCachedData) throw new Error(data.error);
                        markTabRendered('otpremaci');
                        return;
                    }
                    renderOtpremaci(data);
                    hideCacheIndicator();
                    markTabRendered('otpremaci');
                } catch (error) {
                    if (!hasCachedData) {
                        throw error;
                    }
                    markTabRendered('otpremaci');
                    // Silently fail if we have cached data
                }

            } catch (error) {
                console.error('Otpremači error:', error);

                // Determine error type and show appropriate message
                let errorTitle = 'Greška pri učitavanju otpremača';
                let errorMessage = error.message;
                let errorIcon = '⚠️';

                if (error.message && error.message.includes('Server je spor')) {
                    errorIcon = '⏱️';
                    errorTitle = 'Vremensko ograničenje prekoračeno';
                    errorMessage = 'Server ne odgovara dovoljno brzo. Molimo pokušajte ponovo.';
                } else if (error.message && error.message.includes('Nema podataka')) {
                    errorIcon = '📭';
                    errorTitle = 'Nema podataka';
                }

                showError('Greška', errorTitle + ': ' + errorMessage);
                document.getElementById('loading-screen').innerHTML = `
                    <div class="loading-icon">${errorIcon}</div>
                    <div class="loading-text">${errorTitle}</div>
                    <div class="loading-sub">${errorMessage}</div>
                    <button class="btn btn-primary" style="margin-top: 20px;" onclick="loadOtpremaci()">🔄 Pokušaj ponovo</button>
                `;
            }
        }

        // Separate render function for otpremaci
        function renderOtpremaci(data) {

                // Validate data structure
                if (!data || !data.otpremaci || !Array.isArray(data.otpremaci)) {
                    console.error('Invalid otpremaci data structure:', data);
                    showError('Greška', 'Neispravni podaci otpremača');
                    return;
                }

                if (!data.mjeseci || !Array.isArray(data.mjeseci)) {
                    console.error('Missing mjeseci in otpremaci data');
                    showError('Greška', 'Nedostaju mjeseci u podacima');
                    return;
                }

                // Calculate totals per month
                const monthTotals = new Array(12).fill(0);
                let grandTotal = 0;

                data.otpremaci.forEach(o => {
                    if (o.mjeseci && Array.isArray(o.mjeseci)) {
                        o.mjeseci.forEach((val, idx) => {
                            monthTotals[idx] += (val || 0);
                        });
                    }
                    grandTotal += (o.ukupno || 0);
                });

                // Create header with sticky styling (blue theme)
                const headerHTML = `
                    <tr>
                        <th style="position: sticky; left: 0; background: #2563eb; z-index: 20; border-right: 3px solid #1e40af; min-width: 150px;">
                            🚛 Otpremač
                        </th>
                        ${data.mjeseci.map((m, idx) => `
                            <th class="right" style="min-width: 80px; background: #2563eb; color: white; font-weight: 700; border: 1px solid #1e40af;">
                                ${m}
                            </th>
                        `).join('')}
                        <th class="right" style="min-width: 100px; background: #1e40af; color: white; font-weight: 900; border: 2px solid #1e3a8a;">
                            📊 UKUPNO
                        </th>
                    </tr>
                `;
                document.getElementById('otpremaci-header').innerHTML = headerHTML;

                // Create body with enhanced styling (blue theme)
                const bodyHTML = data.otpremaci.map((o, idx) => {
                    const rowBg = idx % 2 === 0 ? '#eff6ff' : 'white';
                    const hoverBg = idx % 2 === 0 ? '#dbeafe' : '#eff6ff';

                    return `
                        <tr style="background: ${rowBg}; transition: all 0.2s;" onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${rowBg}'">
                            <td style="font-weight: 600; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #2563eb; padding: 10px; font-size: 11px;">
                                ${o.otpremac || '-'}
                            </td>
                            ${(o.mjeseci && Array.isArray(o.mjeseci) ? o.mjeseci : new Array(12).fill(0)).map((v, mIdx) => {
                                const val = (v != null && !isNaN(v)) ? v : 0;
                                const displayVal = val > 0 ? val.toFixed(2) : '-';
                                const cellStyle = val > 0 ? 'font-weight: 600; color: #000000; text-shadow: 0 0 1px rgba(255,255,255,0.8);' : 'color: #9ca3af;';
                                return `<td class="right" style="${cellStyle} border: 1px solid #dbeafe; padding: 8px; font-size: 11px; font-family: 'Roboto Mono', ui-monospace, monospace;">${displayVal}</td>`;
                            }).join('')}
                            <td class="right" style="font-weight: 700; background: linear-gradient(to right, #dbeafe, #bfdbfe); border: 2px solid #2563eb; padding: 10px; font-size: 11px; color: #1e40af;">
                                ${(o.ukupno != null && !isNaN(o.ukupno)) ? o.ukupno.toFixed(2) : '0.00'} m³
                            </td>
                        </tr>
                    `;
                }).join('');

                // Add totals row with softer colors
                const totalsRow = `
                    <tr style="background: linear-gradient(to bottom, #dbeafe, #bfdbfe); color: #1e40af; font-weight: 700; border-top: 3px solid #60a5fa;">
                        <td style="position: sticky; left: 0; background: #dbeafe; z-index: 10; border-right: 3px solid #60a5fa; padding: 12px; font-size: 12px;">
                            📈 UKUPNO
                        </td>
                        ${monthTotals.map(total => {
                            const val = (total != null && !isNaN(total)) ? total : 0;
                            return `
                            <td class="right" style="border: 1px solid #93c5fd; padding: 10px; font-size: 12px; font-weight: 700; color: #000000; font-family: 'Roboto Mono', ui-monospace, monospace; text-shadow: 0 0 1px rgba(255,255,255,0.8);">
                                ${val > 0 ? val.toFixed(2) : '-'}
                            </td>`;
                        }).join('')}
                        <td class="right" style="background: #bfdbfe; border: 2px solid #60a5fa; padding: 12px; font-size: 13px; font-weight: 900; color: #000000; font-family: 'Roboto Mono', ui-monospace, monospace;">
                            ${(grandTotal != null && !isNaN(grandTotal)) ? grandTotal.toFixed(2) : '0.00'} m³
                        </td>
                    </tr>
                `;

                document.getElementById('otpremaci-body').innerHTML = bodyHTML + totalsRow;

                if (!isActiveTab('otpremaci')) return;
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('otpremaci-content').classList.remove('hidden');
        }

        // Helper function to get month name
        function getMonthName(monthIndex) {
            const months = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
                           'Juli', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
            return months[monthIndex];
        }

        // Load primaci daily data (for selected month)
        async function loadPrimaciDaily(selectedMonth) {
            try {
                const now = new Date();
                const year = now.getFullYear();
                const month = selectedMonth !== undefined ? parseInt(selectedMonth) : now.getMonth(); // 0-11

                // Set the selected month in the dropdown
                const monthSelect = document.getElementById('primaci-month-select');
                if (monthSelect) {
                    monthSelect.value = month;
                }

                const url = buildApiUrl('primaci-daily', { year, month });
                const data = await fetchWithCache(url, `cache_primaci_daily_${year}_${month}`);


                if (data.error) {
                    console.error('Error loading primaci daily:', data.error);
                    document.getElementById('primaci-daily-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.data || data.data.length === 0) {
                    document.getElementById('primaci-daily-header').innerHTML = `
                        <tr>
                            <th style="background: #1e293b; color: #f8fafc; padding: 12px; font-weight: 700;">
                                📅 Sječa po danima - ${getMonthName(month)} ${year}
                            </th>
                        </tr>
                    `;
                    document.getElementById('primaci-daily-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka za tekući mjesec
                        </td></tr>
                    `;
                    return;
                }

                // ✅ Header - pro level design
                const headerHTML = `
                    <tr>
                        <th style="position: sticky; top: 0; left: 0; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); z-index: 30; border-right: 2px solid #334155; min-width: 75px; box-shadow: 2px 2px 6px rgba(0,0,0,0.2); font-size: 11px; padding: 10px 8px; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.8px;">
                            Odjel
                        </th>
                        <th style="position: sticky; top: 0; min-width: 120px; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); color: #f8fafc; font-weight: 700; border: 1px solid #334155; font-size: 11px; padding: 10px 8px; z-index: 20; box-shadow: 0 2px 6px rgba(0,0,0,0.2); text-transform: uppercase; letter-spacing: 0.8px;">
                            Primač
                        </th>
                        ${data.sortimentiNazivi.map(s => `
                            <th style="position: sticky; top: 0; min-width: 58px; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); color: #e2e8f0; font-weight: 600; border: 1px solid #334155; font-size: 9.5px; padding: 10px 4px; z-index: 20; box-shadow: 0 2px 6px rgba(0,0,0,0.2); text-transform: uppercase; line-height: 1.2; letter-spacing: 0.3px;">
                                ${s}
                            </th>
                        `).join('')}
                    </tr>
                `;
                document.getElementById('primaci-daily-header').innerHTML = headerHTML;

                // ✅ NOVO: Grupiši podatke po datumu
                const groupedByDate = {};
                data.data.forEach(row => {
                    if (!groupedByDate[row.datum]) {
                        groupedByDate[row.datum] = [];
                    }
                    groupedByDate[row.datum].push(row);
                });

                // ✅ NOVO: Helper funkcija za dan u sedmici
                function getDayName(dateStr) {
                    const parts = dateStr.split('.');
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const yearPart = parts[2] ? parseInt(parts[2]) : year;
                    const date = new Date(yearPart, month, day);
                    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
                    return days[date.getDay()];
                }

                // ✅ NOVO: Build body sa grupisanjem po datumu
                let bodyHTML = '';
                const dates = Object.keys(groupedByDate).sort((a, b) => {
                    const [dayA, monthA] = a.split('.').map(Number);
                    const [dayB, monthB] = b.split('.').map(Number);
                    return monthA !== monthB ? monthB - monthA : dayB - dayA;  // Obrnut redosled - od najnovijeg ka najstarijem
                });

                dates.forEach(datum => {
                    const rows = groupedByDate[datum];
                    const dayName = getDayName(datum);

                    // ✅ Zaglavlje datuma - čist, pro dizajn
                    const numSortimenti = data.sortimentiNazivi.length;
                    bodyHTML += `
                        <tr style="background: linear-gradient(180deg, #f97316 0%, #ea580c 100%); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.1);">
                            <td colspan="${2 + numSortimenti}" style="font-weight: 700; font-size: 13px; padding: 10px 14px; text-align: left; border-top: 2px solid #c2410c; color: #fff; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">
                                📅 ${datum} &mdash; ${dayName}
                            </td>
                        </tr>
                    `;

                    // ✅ Kalkuliši totale za ovaj dan
                    const dailyTotals = {};
                    data.sortimentiNazivi.forEach(s => dailyTotals[s] = 0);
                    rows.forEach(row => {
                        data.sortimentiNazivi.forEach(s => {
                            dailyTotals[s] += row.sortimenti[s] || 0;
                        });
                    });

                    // Data rows - clean pro design
                    rows.forEach((row, idx) => {
                        const rowBg = idx % 2 === 0 ? '#ffffff' : '#fafaf9';
                        const hoverBg = '#fff7ed';

                        const sortimentiCells = data.sortimentiNazivi.map(sortiment => {
                            const val = row.sortimenti[sortiment] || 0;
                            const displayVal = val > 0 ? val.toFixed(2) : '-';
                            const cellStyle = val > 0
                                ? 'font-weight: 600; color: #1e293b;'
                                : 'color: #cbd5e1;';
                            return `<td style="${cellStyle} border: 1px solid #e2e8f0; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; padding: 7px 5px;">${displayVal}</td>`;
                        }).join('');

                        bodyHTML += `
                            <tr style="background: ${rowBg}; transition: background 0.15s ease;" onmouseover="this.style.background='${hoverBg}';" onmouseout="this.style.background='${rowBg}';">
                                <td style="font-weight: 700; font-size: 11px; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #e2e8f0; padding: 7px 8px; border: 1px solid #e2e8f0; color: #334155; box-shadow: 2px 0 3px rgba(0,0,0,0.04);">
                                    ${row.odjel}
                                </td>
                                <td style="font-weight: 600; font-size: 11px; border: 1px solid #e2e8f0; padding: 7px 8px; color: #475569;">${row.primac}</td>
                                ${sortimentiCells}
                            </tr>
                        `;
                    });

                    // Daily subtotal - clean pro design
                    const dailyTotalsCells = data.sortimentiNazivi.map(s => {
                        const val = dailyTotals[s];
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        return `<td style="border: 1px solid #c2410c; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; padding: 8px 5px; font-weight: 700; background: #fff7ed; color: #9a3412;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: #fff7ed; border-bottom: 2px solid #ea580c;">
                            <td style="position: sticky; left: 0; background: #fff7ed; z-index: 10; border-right: 2px solid #e2e8f0; padding: 8px 8px; font-size: 11px; font-weight: 700; color: #c2410c; box-shadow: 2px 0 3px rgba(0,0,0,0.04); border: 1px solid #c2410c;">
                                UKUPNO ${datum}
                            </td>
                            <td style="background: #fff7ed; border: 1px solid #c2410c;"></td>
                            ${dailyTotalsCells}
                        </tr>
                    `;
                });

                // ✅ Grand total za cijeli mjesec (na kraju)
                const grandTotals = {};
                data.sortimentiNazivi.forEach(s => grandTotals[s] = 0);
                data.data.forEach(row => {
                    data.sortimentiNazivi.forEach(s => {
                        grandTotals[s] += row.sortimenti[s] || 0;
                    });
                });

                const grandTotalsCells = data.sortimentiNazivi.map(s => {
                    const val = grandTotals[s];
                    const displayVal = val > 0 ? val.toFixed(2) : '-';
                    return `<td style="border: 1px solid #065f46; font-family: 'Courier New', monospace; text-align: right; padding: 10px 5px; font-weight: 700; font-size: 12px; background: #065f46; color: #ecfdf5;">${displayVal}</td>`;
                }).join('');

                bodyHTML += `
                    <tr style="background: #065f46; border-top: 3px solid #047857;">
                        <td colspan="2" style="padding: 12px 14px; font-size: 13px; text-align: left; font-weight: 700; letter-spacing: 1px; color: #ecfdf5; background: #065f46;">
                            UKUPNO ${getMonthName(month).toUpperCase()}
                        </td>
                        ${grandTotalsCells}
                    </tr>
                `;

                document.getElementById('primaci-daily-body').innerHTML = bodyHTML;


            } catch (error) {
                console.error('Error in loadPrimaciDaily:', error);
                document.getElementById('primaci-daily-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }

        // Load otpremaci daily data (for selected month)
        async function loadOtremaciDaily(selectedMonth) {
            try {
                const now = new Date();
                const year = now.getFullYear();
                const month = selectedMonth !== undefined ? parseInt(selectedMonth) : now.getMonth(); // 0-11

                // Set the selected month in the dropdown
                const monthSelect = document.getElementById('otpremaci-month-select');
                if (monthSelect) {
                    monthSelect.value = month;
                }

                const url = buildApiUrl('otpremaci-daily', { year, month });
                const data = await fetchWithCache(url, `cache_otpremaci_daily_${year}_${month}`);


                if (data.error) {
                    console.error('Error loading otpremaci daily:', data.error);
                    document.getElementById('otpremaci-daily-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.data || data.data.length === 0) {
                    document.getElementById('otpremaci-daily-header').innerHTML = `
                        <tr>
                            <th style="background: #0891b2; color: white; padding: 12px;">
                                📅 Otprema po danima - ${getMonthName(month)} ${year}
                            </th>
                        </tr>
                    `;
                    document.getElementById('otpremaci-daily-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka za tekući mjesec
                        </td></tr>
                    `;
                    return;
                }

                // ✅ NOVO: Header sa kolonama ODJEL, OTPREMAČ, KUPAC + sortimenti
                const headerHTML = `
                    <tr>
                        <th style="position: sticky; top: 0; left: 0; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); z-index: 30; border-right: 3px solid #164e63; min-width: 70px; box-shadow: 2px 0 5px rgba(0,0,0,0.1); font-size: 10px; padding: 8px 6px; font-weight: 800; color: white; text-transform: uppercase; letter-spacing: 0.5px;">
                            🏢 Odjel
                        </th>
                        <th style="position: sticky; top: 0; min-width: 100px; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; font-weight: 800; border: 1px solid #164e63; font-size: 9px; padding: 8px 6px; z-index: 20; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 0.5px;">
                            🚛 Otpremač
                        </th>
                        <th style="position: sticky; top: 0; min-width: 100px; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; font-weight: 800; border: 1px solid #164e63; font-size: 9px; padding: 8px 6px; z-index: 20; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 0.5px;">
                            👤 Kupac
                        </th>
                        ${data.sortimentiNazivi.map(s => `
                            <th style="position: sticky; top: 0; min-width: 52px; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; font-weight: 700; border: 1px solid #164e63; font-size: 8.5px; padding: 8px 3px; z-index: 20; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; line-height: 1.1;">
                                ${s}
                            </th>
                        `).join('')}
                    </tr>
                `;
                document.getElementById('otpremaci-daily-header').innerHTML = headerHTML;

                // ✅ NOVO: Grupiši podatke po datumu
                const groupedByDate = {};
                data.data.forEach(row => {
                    if (!groupedByDate[row.datum]) {
                        groupedByDate[row.datum] = [];
                    }
                    groupedByDate[row.datum].push(row);
                });

                // ✅ NOVO: Helper funkcija za dan u sedmici
                function getDayName(dateStr) {
                    const parts = dateStr.split('.');
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const yearPart = parts[2] ? parseInt(parts[2]) : year;
                    const date = new Date(yearPart, month, day);
                    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
                    return days[date.getDay()];
                }

                // ✅ NOVO: Build body sa grupisanjem po datumu
                let bodyHTML = '';
                const dates = Object.keys(groupedByDate).sort((a, b) => {
                    const [dayA, monthA] = a.split('.').map(Number);
                    const [dayB, monthB] = b.split('.').map(Number);
                    return monthA !== monthB ? monthB - monthA : dayB - dayA;  // Obrnut redosled - od najnovijeg ka najstarijem
                });

                dates.forEach(datum => {
                    const rows = groupedByDate[datum];
                    const dayName = getDayName(datum);

                    // ✅ Zaglavlje datuma (3 fiksne kolone: odjel, otpremač, kupac + sortimenti)
                    const numSortimenti = data.sortimentiNazivi.length;
                    bodyHTML += `
                        <tr style="background: linear-gradient(135deg, #0e7490 0%, #155e75 50%, #164e63 100%); box-shadow: 0 2px 8px rgba(22, 78, 99, 0.4);">
                            <td colspan="${3 + numSortimenti}" style="font-weight: 800; font-size: 14px; padding: 10px 12px; text-align: center; border-top: 3px solid #083344; color: white; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                                📅 ${datum} - ${dayName}
                            </td>
                        </tr>
                    `;

                    // ✅ Kalkuliši totale za ovaj dan
                    const dailyTotals = {};
                    data.sortimentiNazivi.forEach(s => dailyTotals[s] = 0);
                    rows.forEach(row => {
                        data.sortimentiNazivi.forEach(s => {
                            dailyTotals[s] += row.sortimenti[s] || 0;
                        });
                    });

                    // ✅ Redovi za ovaj dan sa kolonama: Odjel, Otpremač, Kupac + sortimenti
                    rows.forEach((row, idx) => {
                        const rowBg = idx % 2 === 0 ? '#ecfeff' : '#ffffff';
                        const hoverBg = '#cffafe';

                        const sortimentiCells = data.sortimentiNazivi.map(sortiment => {
                            const val = row.sortimenti[sortiment] || 0;
                            const displayVal = val > 0 ? val.toFixed(2) : '-';
                            const fontWeight = val > 0 ? 'font-weight: 600; color: #164e63;' : 'color: #d1d5db;';
                            return `<td style="${fontWeight} border: 1px solid #a5f3fc; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 6px 3px; transition: all 0.15s;">${displayVal}</td>`;
                        }).join('');

                        bodyHTML += `
                            <tr style="background: ${rowBg}; transition: all 0.15s ease;" onmouseover="this.style.background='${hoverBg}'; this.style.transform='scale(1.005)'; this.style.boxShadow='0 2px 8px rgba(8,145,178,0.15)';" onmouseout="this.style.background='${rowBg}'; this.style.transform='scale(1)'; this.style.boxShadow='none';">
                                <td style="font-weight: 700; font-size: 10px; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #0891b2; padding: 6px 5px; border: 1px solid #a5f3fc; color: #164e63; box-shadow: 2px 0 3px rgba(0,0,0,0.05);">
                                    ${row.odjel}
                                </td>
                                <td style="font-weight: 600; font-size: 10px; border: 1px solid #a5f3fc; padding: 6px 5px; color: #0e7490;">${row.otpremac}</td>
                                <td style="border: 1px solid #a5f3fc; color: #155e75; font-weight: 600; font-size: 10px; padding: 6px 5px;">${row.kupac || '-'}</td>
                                ${sortimentiCells}
                            </tr>
                        `;
                    });

                    // ✅ Rekapitulacija za ovaj dan
                    const dailyTotalsCells = data.sortimentiNazivi.map(s => {
                        const val = dailyTotals[s];
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        return `<td style="border: 1px solid #22d3ee; font-family: 'Courier New', monospace; text-align: right; padding: 7px 3px; font-size: 10px; font-weight: 800; color: #164e63; background: #a5f3fc;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: linear-gradient(to bottom, #a5f3fc, #67e8f9); color: #0b1b2b; font-weight: 800;">
                            <td style="position: sticky; left: 0; background: #a5f3fc; z-index: 10; border-right: 2px solid #0891b2; padding: 10px; font-size: 13px; font-weight: 800; color: #0b1b2b;">
                                📊 UKUPNO ${datum}
                            </td>
                            <td style="background: #a5f3fc;"></td>
                            <td style="background: #a5f3fc;"></td>
                            ${dailyTotalsCells}
                        </tr>
                    `;
                });

                // ✅ Grand total za cijeli mjesec (na kraju)
                const grandTotals = {};
                data.sortimentiNazivi.forEach(s => grandTotals[s] = 0);
                data.data.forEach(row => {
                    data.sortimentiNazivi.forEach(s => {
                        grandTotals[s] += row.sortimenti[s] || 0;
                    });
                });

                const grandTotalsCells = data.sortimentiNazivi.map(s => {
                    const val = grandTotals[s];
                    const displayVal = val > 0 ? val.toFixed(2) : '-';
                    return `<td style="border: 2px solid #164e63; font-family: 'Courier New', monospace; text-align: right; padding: 9px 3px; font-weight: 800; font-size: 11px; background: #bfdbfe; color: #1e3a8a;">${displayVal}</td>`;
                }).join('');

                bodyHTML += `
                    <tr style="background: linear-gradient(135deg, #0e7490, #0891b2); color: white; font-weight: 700; border-top: 4px solid #164e63;">
                        <td colspan="3" style="padding: 12px; font-size: 13px; font-weight: 900; letter-spacing: 1.5px; text-shadow: 0 1px 3px rgba(0,0,0,0.4); text-align: center;">
                            📈 UKUPNO ${getMonthName(month).toUpperCase()}
                        </td>
                        ${grandTotalsCells}
                    </tr>
                `;

                document.getElementById('otpremaci-daily-body').innerHTML = bodyHTML;


            } catch (error) {
                console.error('Error in loadOtremaciDaily:', error);
                document.getElementById('otpremaci-daily-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }

        // ========================================
        // PRIKAZI PO RADILIŠTIMA I IZVOĐAČIMA
        // ========================================

        // Load primaci by radiliste
        async function loadPrimaciByRadiliste() {
            try {
                const year = new Date().getFullYear();
                const url = buildApiUrl('primaci-by-radiliste', { year });

                const data = await fetchWithCache(url, `cache_primaci_radiliste_${year}`);


                if (data.error) {
                    console.error('Error loading primaci by radiliste:', data.error);
                    document.getElementById('primaci-radilista-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.radilista || data.radilista.length === 0) {
                    document.getElementById('primaci-radilista-header').innerHTML = `
                        <tr><th style="background: #ea580c; color: white; padding: 12px;">
                            🏗️ Prikaz po radilištima - ${year}
                        </th></tr>
                    `;
                    document.getElementById('primaci-radilista-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka o radilištima
                        </td></tr>
                    `;
                    return;
                }

                // Render mjesečnu tabelu
                const mjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

                let headerHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            🏗️ Radilište
                        </th>
                `;
                mjeseci.forEach(mj => {
                    headerHTML += `<th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 12px;">${mj}</th>`;
                });
                headerHTML += `
                    <th style="background: linear-gradient(135deg, #7c2d12, #451a03); color: white; padding: 12px; font-weight: 900; position: sticky; top: 0; z-index: 20;">
                        UKUPNO
                    </th>
                </tr>
                `;
                document.getElementById('primaci-radilista-header').innerHTML = headerHTML;

                let bodyHTML = '';
                data.radilista.forEach((radiliste, idx) => {
                    const rowBg = idx % 2 === 0 ? '#fff7ed' : '#ffffff';
                    const hoverBg = '#ffedd5';

                    const mjeseciCells = radiliste.mjeseci.map(val => {
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #7c2d12;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #fed7aa; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: ${rowBg}; transition: all 0.15s ease;" onmouseover="this.style.background='${hoverBg}';" onmouseout="this.style.background='${rowBg}';">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #fed7aa; padding: 10px; color: #7c2d12;">
                                ${radiliste.naziv}
                            </td>
                            ${mjeseciCells}
                            <td style="background: #fef3c7; border: 2px solid #f59e0b; font-family: 'Courier New', monospace; text-align: right; padding: 10px; font-weight: 900; font-size: 13px; color: #92400e;">
                                ${radiliste.ukupno.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });
                document.getElementById('primaci-radilista-body').innerHTML = bodyHTML;

                // Render godišnju rekapitulaciju po sortimentima
                let recapHeaderHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            🏗️ Radilište
                        </th>
                `;
                data.sortimentiNazivi.forEach(s => {
                    recapHeaderHTML += `<th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 10px;">${s}</th>`;
                });
                recapHeaderHTML += `</tr>`;
                document.getElementById('primaci-radilista-recap-header').innerHTML = recapHeaderHTML;

                let recapBodyHTML = '';
                data.radilista.forEach((radiliste, idx) => {
                    const rowBg = idx % 2 === 0 ? '#fff7ed' : '#ffffff';

                    const sortimentiCells = data.sortimentiNazivi.map(s => {
                        const val = radiliste.sortimentiUkupno[s] || 0;
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #7c2d12;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #fed7aa; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    recapBodyHTML += `
                        <tr style="background: ${rowBg};">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #fed7aa; padding: 10px; color: #7c2d12;">
                                ${radiliste.naziv}
                            </td>
                            ${sortimentiCells}
                        </tr>
                    `;
                });
                document.getElementById('primaci-radilista-recap-body').innerHTML = recapBodyHTML;


            } catch (error) {
                console.error('Error in loadPrimaciByRadiliste:', error);
                document.getElementById('primaci-radilista-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }

        // Load primaci by izvodjac
        async function loadPrimaciByIzvodjac() {
            try {
                const year = new Date().getFullYear();
                const url = buildApiUrl('primaci-by-izvodjac', { year });

                const data = await fetchWithCache(url, `cache_primaci_izvodjac_${year}`);


                if (data.error) {
                    console.error('Error loading primaci by izvodjac:', data.error);
                    document.getElementById('primaci-izvodjaci-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.izvodjaci || data.izvodjaci.length === 0) {
                    document.getElementById('primaci-izvodjaci-header').innerHTML = `
                        <tr><th style="background: #ea580c; color: white; padding: 12px;">
                            👷 Prikaz po izvođačima - ${year}
                        </th></tr>
                    `;
                    document.getElementById('primaci-izvodjaci-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka o izvođačima
                        </td></tr>
                    `;
                    return;
                }

                // Render mjesečnu tabelu
                const mjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

                let headerHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            👷 Izvođač radova
                        </th>
                `;
                mjeseci.forEach(mj => {
                    headerHTML += `<th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 12px;">${mj}</th>`;
                });
                headerHTML += `
                    <th style="background: linear-gradient(135deg, #7c2d12, #451a03); color: white; padding: 12px; font-weight: 900; position: sticky; top: 0; z-index: 20;">
                        UKUPNO
                    </th>
                </tr>
                `;
                document.getElementById('primaci-izvodjaci-header').innerHTML = headerHTML;

                let bodyHTML = '';
                data.izvodjaci.forEach((izvodjac, idx) => {
                    const rowBg = idx % 2 === 0 ? '#fff7ed' : '#ffffff';
                    const hoverBg = '#ffedd5';

                    const mjeseciCells = izvodjac.mjeseci.map(val => {
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #7c2d12;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #fed7aa; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: ${rowBg}; transition: all 0.15s ease;" onmouseover="this.style.background='${hoverBg}';" onmouseout="this.style.background='${rowBg}';">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #fed7aa; padding: 10px; color: #7c2d12;">
                                ${izvodjac.naziv}
                            </td>
                            ${mjeseciCells}
                            <td style="background: #fef3c7; border: 2px solid #f59e0b; font-family: 'Courier New', monospace; text-align: right; padding: 10px; font-weight: 900; font-size: 13px; color: #92400e;">
                                ${izvodjac.ukupno.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });
                document.getElementById('primaci-izvodjaci-body').innerHTML = bodyHTML;

                // Render godišnju rekapitulaciju po sortimentima
                let recapHeaderHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            👷 Izvođač radova
                        </th>
                `;
                data.sortimentiNazivi.forEach(s => {
                    recapHeaderHTML += `<th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 10px;">${s}</th>`;
                });
                recapHeaderHTML += `</tr>`;
                document.getElementById('primaci-izvodjaci-recap-header').innerHTML = recapHeaderHTML;

                let recapBodyHTML = '';
                data.izvodjaci.forEach((izvodjac, idx) => {
                    const rowBg = idx % 2 === 0 ? '#fff7ed' : '#ffffff';

                    const sortimentiCells = data.sortimentiNazivi.map(s => {
                        const val = izvodjac.sortimentiUkupno[s] || 0;
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #7c2d12;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #fed7aa; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    recapBodyHTML += `
                        <tr style="background: ${rowBg};">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #fed7aa; padding: 10px; color: #7c2d12;">
                                ${izvodjac.naziv}
                            </td>
                            ${sortimentiCells}
                        </tr>
                    `;
                });
                document.getElementById('primaci-izvodjaci-recap-body').innerHTML = recapBodyHTML;


            } catch (error) {
                console.error('Error in loadPrimaciByIzvodjac:', error);
                document.getElementById('primaci-izvodjaci-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }

        // Load primaci sortimenti by primac (grupisano po radilištu, za odabrani mjesec)
        async function loadPrimaciSortimentiByPrimac(selectedMonth) {
            const year = new Date().getFullYear();
            const month = parseInt(selectedMonth !== undefined ? selectedMonth : new Date().getMonth());
            const cacheKey = `cache_primaci_sort_primac_${year}_${month}`;
            const url = buildApiUrl('primaci-sortimenti-by-primac', { year, month });

            const container = document.getElementById('primaci-sortimenti-primac-container');
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;">⏳ Učitavam...</div>';

            try {
                const data = await fetchWithCache(url, cacheKey, false, 180000);
                if (data.error) throw new Error(data.error);
                renderPrimaciSortimentiByPrimac(data, month, year);
            } catch (err) {
                console.error('Error in loadPrimaciSortimentiByPrimac:', err);
                container.innerHTML = `<p style="color:#dc2626;text-align:center;padding:40px;">Greška: ${err.message}</p>`;
            }
        }

        function renderPrimaciSortimentiByPrimac(data, month, year) {
            const MJESECI_NAZIVI = ['Januar','Februar','Mart','April','Maj','Juni','Juli','Avgust','Septembar','Oktobar','Novembar','Decembar'];
            const container = document.getElementById('primaci-sortimenti-primac-container');

            if (!data.radilista || data.radilista.length === 0) {
                container.innerHTML = `<p style="text-align:center;padding:40px;color:#6B7280;">Nema podataka za ${MJESECI_NAZIVI[month]} ${year}.</p>`;
                return;
            }

            const sortNazivi = data.sortimentiNazivi; // 20 naziva
            let html = `<p style="color:#6B7280;font-size:13px;margin-bottom:16px;">📅 Prikazani podaci za: <strong style="color:#2F343A;">${MJESECI_NAZIVI[month]} ${year}</strong></p>`;

            data.radilista.forEach(radiliste => {
                html += `<h4 style="background:#2F343A;color:#F3F4F6;padding:11px 18px;border-radius:8px;margin:24px 0 10px;font-weight:600;font-size:14px;letter-spacing:0.02em;">🏗️ ${radiliste.naziv}</h4>`;
                html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);border:1px solid #D1D5DB;">';
                html += '<table class="monthly-table" style="min-width:900px;border-collapse:collapse;">';
                html += '<thead><tr>';
                html += `<th style="background:#2F343A;color:#F3F4F6;padding:10px 12px;position:sticky;left:0;z-index:10;min-width:160px;font-size:12px;font-weight:600;border-bottom:2px solid #4B5563;">👷 Primač</th>`;
                sortNazivi.forEach((s, i) => {
                    const isTotal = i === 19;
                    const bg = isTotal ? '#1F2937' : '#2F343A';
                    html += `<th style="background:${bg};color:#F3F4F6;padding:8px 4px;font-size:10px;min-width:65px;white-space:nowrap;font-weight:600;border-bottom:2px solid #4B5563;">${s}</th>`;
                });
                html += '</tr></thead><tbody>';

                const radilisteUkupno = Array(20).fill(0);
                radiliste.primaci.forEach((primac, idx) => {
                    const bg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
                    html += `<tr style="background:${bg};transition:background 0.15s;" onmouseover="this.style.background='#EEF0F3'" onmouseout="this.style.background='${bg}'">`;
                    html += `<td style="font-weight:600;font-size:12px;border-bottom:1px solid #E5E7EB;padding:9px 12px;color:#2F343A;position:sticky;left:0;background:${bg};z-index:5;">${primac.naziv}</td>`;
                    primac.sortimentiVrijednosti.forEach((val, j) => {
                        radilisteUkupno[j] += val;
                        const disp = val > 0 ? val.toFixed(2) : '-';
                        const isTotal = j === 19;
                        const cellStyle = isTotal
                            ? 'background:#EEF0F3;border-left:2px solid #9CA3AF;font-weight:800;font-size:12px;color:#1F2937;'
                            : (val > 0 ? 'font-weight:600;color:#374151;' : 'color:#CBD5E1;');
                        html += `<td style="${cellStyle}border-bottom:1px solid #E5E7EB;font-family:'Courier New',monospace;font-size:11px;text-align:right;padding:7px 6px;">${disp}</td>`;
                    });
                    html += '</tr>';
                });

                // UKUPNO red za radilište
                html += `<tr style="background:#3F4752;">`;
                html += `<td style="font-weight:800;color:#FFFFFF;padding:10px 12px;border-top:2px solid #6B7280;position:sticky;left:0;background:#3F4752;z-index:5;font-size:12px;">UKUPNO</td>`;
                radilisteUkupno.forEach((val, j) => {
                    const disp = val > 0 ? val.toFixed(2) : '-';
                    const isTotal = j === 19;
                    const cellStyle = isTotal ? 'background:#2F343A;font-size:13px;font-weight:900;' : 'font-weight:700;';
                    html += `<td style="${cellStyle}color:#FFFFFF;border-top:2px solid #6B7280;font-family:'Courier New',monospace;font-size:11px;text-align:right;padding:8px 6px;">${disp}</td>`;
                });
                html += '</tr>';

                html += '</tbody></table></div>';
            });

            container.innerHTML = html;
        }

        // Load otpremaci sortimenti by otpremac (grupisano po radilištu, za odabrani mjesec)
        async function loadOtremaciSortimentiByOtpremac(selectedMonth) {
            const year = new Date().getFullYear();
            const month = parseInt(selectedMonth !== undefined ? selectedMonth : new Date().getMonth());
            const cacheKey = `cache_otpremaci_sort_otpremac_${year}_${month}`;
            const url = buildApiUrl('otpremaci-sortimenti-by-otpremac', { year, month });

            const container = document.getElementById('otpremaci-sortimenti-otpremac-container');
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;">⏳ Učitavam...</div>';

            try {
                const data = await fetchWithCache(url, cacheKey, false, 180000);
                if (data.error) throw new Error(data.error);
                renderOtremaciSortimentiByOtpremac(data, month, year);
            } catch (err) {
                console.error('Error in loadOtremaciSortimentiByOtpremac:', err);
                container.innerHTML = `<p style="color:#dc2626;text-align:center;padding:40px;">Greška: ${err.message}</p>`;
            }
        }

        function renderOtremaciSortimentiByOtpremac(data, month, year) {
            const MJESECI_NAZIVI = ['Januar','Februar','Mart','April','Maj','Juni','Juli','Avgust','Septembar','Oktobar','Novembar','Decembar'];
            const container = document.getElementById('otpremaci-sortimenti-otpremac-container');

            if (!data.radilista || data.radilista.length === 0) {
                container.innerHTML = `<p style="text-align:center;padding:40px;color:#6b7280;">Nema podataka za ${MJESECI_NAZIVI[month]} ${year}.</p>`;
                return;
            }

            const sortNazivi = data.sortimentiNazivi;
            let html = `<p style="color:#6b7280;font-size:13px;margin-bottom:12px;">📅 Prikazani podaci za: <strong>${MJESECI_NAZIVI[month]} ${year}</strong></p>`;

            data.radilista.forEach(radiliste => {
                html += `<h4 style="background:#0891b2;color:white;padding:10px 16px;border-radius:6px;margin:20px 0 8px;">🏗️ ${radiliste.naziv}</h4>`;
                html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">';
                html += '<table class="monthly-table" style="min-width:900px;">';
                html += '<thead><tr>';
                html += `<th style="background:linear-gradient(135deg,#0891b2,#0e7490);color:white;padding:10px;position:sticky;left:0;z-index:10;min-width:160px;">🚛 Otpremač</th>`;
                sortNazivi.forEach((s, i) => {
                    const isTotal = i === 19;
                    const bg = isTotal ? 'linear-gradient(135deg,#164e63,#0c4a6e)' : 'linear-gradient(135deg,#0891b2,#0e7490)';
                    html += `<th style="background:${bg};color:white;padding:8px 4px;font-size:10px;min-width:65px;white-space:nowrap;">${s}</th>`;
                });
                html += '</tr></thead><tbody>';

                const radilisteUkupno = Array(20).fill(0);
                radiliste.otpremaci.forEach((otpremac, idx) => {
                    const bg = idx % 2 === 0 ? '#e0f2fe' : '#ffffff';
                    html += `<tr style="background:${bg};" onmouseover="this.style.background='#bae6fd'" onmouseout="this.style.background='${bg}'">`;
                    html += `<td style="font-weight:700;font-size:12px;border:1px solid #bae6fd;padding:9px;color:#155e75;position:sticky;left:0;background:${bg};">${otpremac.naziv}</td>`;
                    otpremac.sortimentiVrijednosti.forEach((val, j) => {
                        radilisteUkupno[j] += val;
                        const disp = val > 0 ? val.toFixed(2) : '-';
                        const isTotal = j === 19;
                        const cellStyle = isTotal
                            ? 'background:#cffafe;border:2px solid #06b6d4;font-weight:900;font-size:12px;color:#164e63;'
                            : (val > 0 ? 'font-weight:700;color:#155e75;' : 'color:#d1d5db;');
                        html += `<td style="${cellStyle}border:1px solid #bae6fd;font-family:'Courier New',monospace;font-size:11px;text-align:right;padding:7px;">${disp}</td>`;
                    });
                    html += '</tr>';
                });

                // UKUPNO red za radilište
                html += `<tr style="background:linear-gradient(135deg,#0891b2,#0e7490);">`;
                html += `<td style="font-weight:900;color:white;padding:10px;border:1px solid #0e7490;position:sticky;left:0;background:#0891b2;">UKUPNO</td>`;
                radilisteUkupno.forEach((val, j) => {
                    const disp = val > 0 ? val.toFixed(2) : '-';
                    const isTotal = j === 19;
                    const cellStyle = isTotal ? 'background:#164e63;font-size:13px;font-weight:900;' : 'font-weight:700;';
                    html += `<td style="${cellStyle}color:white;border:1px solid #0e7490;font-family:'Courier New',monospace;font-size:11px;text-align:right;padding:8px;">${disp}</td>`;
                });
                html += '</tr>';

                html += '</tbody></table></div>';
            });

            container.innerHTML = html;
        }

        // Load otpremaci by radiliste
        async function loadOtremaciByRadiliste() {
            try {
                const year = new Date().getFullYear();
                const url = buildApiUrl('otpremaci-by-radiliste', { year });

                const data = await fetchWithCache(url, `cache_otpremaci_radiliste_${year}`);


                if (data.error) {
                    console.error('Error loading otpremaci by radiliste:', data.error);
                    document.getElementById('otpremaci-radilista-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.radilista || data.radilista.length === 0) {
                    document.getElementById('otpremaci-radilista-header').innerHTML = `
                        <tr><th style="background: #0891b2; color: white; padding: 12px;">
                            🏗️ Prikaz po radilištima - ${year}
                        </th></tr>
                    `;
                    document.getElementById('otpremaci-radilista-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka o radilištima
                        </td></tr>
                    `;
                    return;
                }

                // Render mjesečnu tabelu
                const mjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

                let headerHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #0891b2, #0e7490); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            🏗️ Radilište
                        </th>
                `;
                mjeseci.forEach(mj => {
                    headerHTML += `<th style="background: linear-gradient(135deg, #0891b2, #0e7490); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 12px;">${mj}</th>`;
                });
                headerHTML += `
                    <th style="background: linear-gradient(135deg, #155e75, #164e63); color: white; padding: 12px; font-weight: 900; position: sticky; top: 0; z-index: 20;">
                        UKUPNO
                    </th>
                </tr>
                `;
                document.getElementById('otpremaci-radilista-header').innerHTML = headerHTML;

                let bodyHTML = '';
                data.radilista.forEach((radiliste, idx) => {
                    const rowBg = idx % 2 === 0 ? '#cffafe' : '#ffffff';
                    const hoverBg = '#a5f3fc';

                    const mjeseciCells = radiliste.mjeseci.map(val => {
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #155e75;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #a5f3fc; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: ${rowBg}; transition: all 0.15s ease;" onmouseover="this.style.background='${hoverBg}';" onmouseout="this.style.background='${rowBg}';">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #a5f3fc; padding: 10px; color: #155e75;">
                                ${radiliste.naziv}
                            </td>
                            ${mjeseciCells}
                            <td style="background: #bfdbfe; border: 2px solid #3b82f6; font-family: 'Courier New', monospace; text-align: right; padding: 10px; font-weight: 900; font-size: 13px; color: #1e3a8a;">
                                ${radiliste.ukupno.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });
                document.getElementById('otpremaci-radilista-body').innerHTML = bodyHTML;

                // Render godišnju rekapitulaciju po sortimentima
                let recapHeaderHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #0891b2, #0e7490); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            🏗️ Radilište
                        </th>
                `;
                data.sortimentiNazivi.forEach(s => {
                    recapHeaderHTML += `<th style="background: linear-gradient(135deg, #0891b2, #0e7490); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 10px;">${s}</th>`;
                });
                recapHeaderHTML += `</tr>`;
                document.getElementById('otpremaci-radilista-recap-header').innerHTML = recapHeaderHTML;

                let recapBodyHTML = '';
                data.radilista.forEach((radiliste, idx) => {
                    const rowBg = idx % 2 === 0 ? '#cffafe' : '#ffffff';

                    const sortimentiCells = data.sortimentiNazivi.map(s => {
                        const val = radiliste.sortimentiUkupno[s] || 0;
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #155e75;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #a5f3fc; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    recapBodyHTML += `
                        <tr style="background: ${rowBg};">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #a5f3fc; padding: 10px; color: #155e75;">
                                ${radiliste.naziv}
                            </td>
                            ${sortimentiCells}
                        </tr>
                    `;
                });
                document.getElementById('otpremaci-radilista-recap-body').innerHTML = recapBodyHTML;


            } catch (error) {
                console.error('Error in loadOtremaciByRadiliste:', error);
                document.getElementById('otpremaci-radilista-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }


        // Load kupci data
        async function loadKupci() {
            try {
                const year = new Date().getFullYear();
                const cacheKey = 'cache_kupci_' + year;
                const url = buildApiUrl('kupci', { year });

                // 🚀 INSTANT SHOW: Check cache first
                let hasCachedData = false;
                const cachedKupci = localStorage.getItem(cacheKey);
                if (cachedKupci) {
                    try {
                        const parsed = JSON.parse(cachedKupci);
                        if (parsed.data && parsed.data.godisnji) {
                            // ✨ INSTANT: Show cached data immediately
                            if (!isActiveTab('kupci')) return;
                            document.getElementById('kupci-content').classList.remove('hidden');
                            document.getElementById('loading-screen').classList.add('hidden');
                            kupciMjesecniRawData = parsed.data.mjesecni || [];
                            renderKupciGodisnjiTable(parsed.data.godisnji, parsed.data.sortimentiNazivi);
                            renderKupciMjesecniTable(parsed.data.mjesecni, parsed.data.sortimentiNazivi);
                            hasCachedData = true;

                            // Show cache indicator
                            const age = Date.now() - parsed.timestamp;
                            showCacheIndicator(age);
                        }
                    } catch (e) {
                        console.error('Cache parse error:', e);
                    }
                }

                // If no cache, prepare for fresh load
                if (!hasCachedData) {
                    document.getElementById('kupci-content').classList.remove('hidden');
                    document.getElementById('loading-screen').classList.add('hidden');
                }

                // 🔄 BACKGROUND REFRESH (180s timeout)
                const data = await fetchWithCache(url, cacheKey, false, 180000);

                if (data.error || !data.godisnji || !data.sortimentiNazivi) {
                    if (!hasCachedData) {
                        throw new Error(data.error || 'Nema podataka');
                    }
                    markTabRendered('kupci');
                    return; // Silently fail if we have cached data
                }

                // Update with fresh data
                if (!isActiveTab('kupci')) return;
                kupciMjesecniRawData = data.mjesecni || [];
                renderKupciGodisnjiTable(data.godisnji, data.sortimentiNazivi);
                renderKupciMjesecniTable(data.mjesecni, data.sortimentiNazivi);
                hideCacheIndicator();
                markTabRendered('kupci');

            } catch (error) {
                console.error('Error loading kupci:', error);
                document.getElementById('kupci-godisnji-body').innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #dc2626;">Greška pri učitavanju: ' + error.message + '</td></tr>';
                document.getElementById('kupci-mjesecni-body').innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #dc2626;">Greška pri učitavanju: ' + error.message + '</td></tr>';
            }
        }

        // ============================================
        // 🔄 KUPCI TABELE - SORTIRANJE PO KOLONAMA
        // ============================================

        // Globalno stanje za kupci podatke i sortiranje
        let kupciGodisnjiData = [];
        let kupciMjesecniData = [];
        let kupciSortimentiNazivi = [];

        // Sort stanje za oba taba (shared)
        const kupciSortState = {
            godisnji: { key: 'SVEUKUPNO', direction: 'desc' },
            mjesecni: { key: 'SVEUKUPNO', direction: 'desc' }
        };

        // Mapiranje naziva sortimenta na ključeve u podacima
        function getSortimentKey(sortimentName) {
            // SVEUKUPNO je u 'ukupno' polju
            if (sortimentName === 'SVEUKUPNO') return 'ukupno';
            return sortimentName;
        }

        // Dohvati vrijednost za sortiranje
        function getKupacSortValue(kupac, key) {
            if (key === 'kupac') {
                return (kupac.kupac || '').toLowerCase();
            }
            if (key === 'ukupno' || key === 'SVEUKUPNO') {
                return kupac.ukupno || 0;
            }
            // Sortiment vrijednost
            const val = kupac.sortimenti ? kupac.sortimenti[key] : 0;
            if (val === null || val === undefined || val === '-' || val === '') return 0;
            return parseFloat(val) || 0;
        }

        // Shared sort funkcija
        function sortKupciData(data, key, direction) {
            const isTextSort = (key === 'kupac');
            return [...data].sort((a, b) => {
                const valA = getKupacSortValue(a, key);
                const valB = getKupacSortValue(b, key);

                let comparison;
                if (isTextSort) {
                    comparison = valA.localeCompare(valB, 'hr');
                } else {
                    comparison = valA - valB;
                }

                return direction === 'asc' ? comparison : -comparison;
            });
        }

        // Handler za klik na header kolonu
        function handleKupciHeaderClick(tabType, sortKey) {
            const state = kupciSortState[tabType];

            if (state.key === sortKey) {
                // Ista kolona - promijeni smjer
                state.direction = state.direction === 'asc' ? 'desc' : 'asc';
            } else {
                // Nova kolona - reset na desc (za brojeve) ili asc (za tekst)
                state.key = sortKey;
                state.direction = sortKey === 'kupac' ? 'asc' : 'desc';
            }

            // Re-renderuj tabelu
            if (tabType === 'godisnji') {
                renderKupciGodisnjiTableBody();
            } else if (tabType === 'kvartalni') {
                renderKupciKvartalniTableBody();
            } else {
                renderKupciMjesecniTableBody();
            }
        }

        // Renderuj header sa sort indikatorima
        function renderKupciSortableHeader(tabType, sortimentiNazivi, headerBgColor, headerBgColorAlt) {
            const state = kupciSortState[tabType];
            const stickyCol1Style = 'position: sticky; left: 0; z-index: 11; min-width: 50px;';
            const stickyCol2Style = 'position: sticky; left: 50px; z-index: 10; min-width: 150px; box-shadow: 2px 0 4px rgba(0,0,0,0.1);';

            let headerHtml = `<tr style="background: ${headerBgColor};">`;

            // R.br. kolona (nije sortabilna)
            headerHtml += `<th style="color: white; font-weight: 700; text-align: center; padding: 8px 4px; background: ${headerBgColor}; ${stickyCol1Style}">R.br.</th>`;

            // Kupac kolona (sortabilna po tekstu)
            const kupacActive = state.key === 'kupac';
            const kupacArrow = kupacActive ? (state.direction === 'asc' ? ' ↑' : ' ↓') : '';
            const kupacClass = kupacActive ? 'sort-active' : '';
            headerHtml += `<th class="sortable-header ${kupacClass}" onclick="handleKupciHeaderClick('${tabType}', 'kupac')" style="color: white; font-weight: 700; background: ${headerBgColor}; ${stickyCol2Style} cursor: pointer;">Kupac${kupacArrow}</th>`;

            // Sortiment kolone
            sortimentiNazivi.forEach(sortiment => {
                const sortKey = sortiment;
                const isActive = state.key === sortKey;
                const arrow = isActive ? (state.direction === 'asc' ? ' ↑' : ' ↓') : '';
                const activeClass = isActive ? 'sort-active' : '';
                const bgStyle = sortiment === 'SVEUKUPNO' ? ` background: ${headerBgColorAlt};` : '';
                headerHtml += `<th class="sortable-header ${activeClass}" onclick="handleKupciHeaderClick('${tabType}', '${sortKey}')" style="color: white; font-weight: 700; text-align: right; cursor: pointer;${bgStyle}">${sortiment}${arrow}</th>`;
            });

            headerHtml += '</tr>';
            return headerHtml;
        }

        // Renderuj godišnju tabelu po kupcima i sortimentima
        function renderKupciGodisnjiTable(godisnji, sortimentiNazivi) {
            // Sačuvaj podatke globalno za sortiranje
            kupciGodisnjiData = godisnji || [];
            kupciSortimentiNazivi = sortimentiNazivi || [];

            const headerElem = document.getElementById('kupci-godisnji-header');
            const bodyElem = document.getElementById('kupci-godisnji-body');

            if (!godisnji || godisnji.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za godišnji prikaz</td></tr>';
                return;
            }

            // Renderuj header sa sort funkcionalnosti
            headerElem.innerHTML = renderKupciSortableHeader('godisnji', sortimentiNazivi, '#047857', '#065f46');

            // Renderuj body
            renderKupciGodisnjiTableBody();
        }

        // Renderuj samo body dio godišnje tabele (za sortiranje)
        function renderKupciGodisnjiTableBody() {
            const bodyElem = document.getElementById('kupci-godisnji-body');
            const state = kupciSortState.godisnji;
            const sortimentiNazivi = kupciSortimentiNazivi;

            // Sortiraj podatke
            const sortedData = sortKupciData(kupciGodisnjiData, state.key, state.direction);

            // Sticky column styles
            const stickyCol1Style = 'position: sticky; left: 0; z-index: 11; min-width: 50px;';
            const stickyCol2Style = 'position: sticky; left: 50px; z-index: 10; min-width: 150px; box-shadow: 2px 0 4px rgba(0,0,0,0.1);';

            // Ažuriraj header sa aktivnim sort indikatorom
            const headerElem = document.getElementById('kupci-godisnji-header');
            headerElem.innerHTML = renderKupciSortableHeader('godisnji', sortimentiNazivi, '#047857', '#065f46');

            // Izračunaj UKUPNO sume za svaki sortiment
            const ukupnoSume = {};
            sortimentiNazivi.forEach(s => ukupnoSume[s] = 0);

            // Izračunaj top 3 za svaki sortiment (za medalje)
            const top3PoSortimentu = {};
            sortimentiNazivi.forEach(sortiment => {
                if (sortiment === 'SVEUKUPNO') return;
                const values = sortedData
                    .map(kupac => kupac.sortimenti[sortiment] || 0)
                    .filter(v => v > 0)
                    .sort((a, b) => b - a);
                top3PoSortimentu[sortiment] = [...new Set(values)].slice(0, 3);
            });

            const getMedalClass = (value, top3) => {
                if (!top3 || top3.length === 0 || value <= 0) return '';
                if (value >= top3[0]) return 'medal-gold';
                if (top3.length > 1 && value >= top3[1]) return 'medal-silver';
                if (top3.length > 2 && value >= top3[2]) return 'medal-bronze';
                return '';
            };

            // Body redovi (sa rednim brojem)
            let bodyHtml = '';
            sortedData.forEach((kupac, index) => {
                const rowBg = index % 2 === 0 ? '#f0fdf4' : 'white';
                const redniBroj = index + 1;
                const kupacName = (kupac.kupac || '').replace(/'/g, "\\'");
                bodyHtml += `<tr style="background: ${rowBg}; cursor: pointer;" data-kupac="${(kupac.kupac || '').toLowerCase()}" onclick="showKupacDetails('${kupacName}')" title="Klikni za detalje">`;
                bodyHtml += `<td style="text-align: center; font-weight: 600; color: #000000; padding: 8px 4px; background: ${rowBg}; ${stickyCol1Style}">${redniBroj}.</td>`;
                bodyHtml += `<td style="font-weight: 600; background: ${rowBg}; ${stickyCol2Style}">${kupac.kupac || '-'}</td>`;

                sortimentiNazivi.forEach(sortiment => {
                    const kolicina = kupac.sortimenti[sortiment] || 0;
                    ukupnoSume[sortiment] += kolicina; // Dodaj u sumu
                    const display = kolicina > 0 ? kolicina.toFixed(2) : '-';
                    const color = kolicina > 0 ? '#000000' : '#9ca3af';
                    const medalClass = sortiment !== 'SVEUKUPNO' ? getMedalClass(kolicina, top3PoSortimentu[sortiment]) : '';
                    const bgStyle = sortiment === 'SVEUKUPNO' ? ' background: #d1fae5; font-weight: 700;' : '';
                    bodyHtml += `<td class="${medalClass}" style="text-align: right; font-family: 'Roboto Mono', ui-monospace, system-ui, monospace; font-weight: 500; color: ${color}; text-shadow: 0 0 1px rgba(255,255,255,0.8);${bgStyle}">${display}</td>`;
                });

                bodyHtml += '</tr>';
            });

            // UKUPNO red na kraju
            bodyHtml += '<tr style="background: linear-gradient(135deg, #047857 0%, #065f46 100%); font-weight: 700;">';
            bodyHtml += `<td style="color: white; font-weight: 700; text-align: center; background: #047857; ${stickyCol1Style}"></td>`;
            bodyHtml += `<td style="color: white; font-weight: 700; background: #047857; ${stickyCol2Style}">UKUPNO</td>`;
            sortimentiNazivi.forEach(sortiment => {
                const suma = ukupnoSume[sortiment] || 0;
                const display = suma > 0 ? suma.toFixed(2) : '-';
                bodyHtml += `<td style="text-align: right; font-family: 'Roboto Mono', ui-monospace, system-ui, monospace; font-weight: 700; color: white; text-shadow: 0 1px 1px rgba(0,0,0,0.3);">${display}</td>`;
            });
            bodyHtml += '</tr>';

            bodyElem.innerHTML = bodyHtml;
        }

        // Renderuj mjesečnu tabelu za trenutni mjesec
        function renderKupciMjesecniTable(mjesecni, sortimentiNazivi) {
            const headerElem = document.getElementById('kupci-mjesecni-header');
            const bodyElem = document.getElementById('kupci-mjesecni-body');

            // Filtruj samo trenutni mjesec
            const currentDate = new Date();
            const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
            const currentMjesec = mjeseci[currentDate.getMonth()];

            const filteredData = (mjesecni || []).filter(red => red.mjesec === currentMjesec);

            // Sačuvaj filtrirane podatke globalno za sortiranje
            kupciMjesecniData = filteredData;
            kupciSortimentiNazivi = sortimentiNazivi || [];

            if (!filteredData || filteredData.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za tekući mjesec (' + currentMjesec + ')</td></tr>';
                return;
            }

            // Renderuj header sa sort funkcionalnosti
            headerElem.innerHTML = renderKupciSortableHeader('mjesecni', sortimentiNazivi, '#0369a1', '#075985');

            // Renderuj body
            renderKupciMjesecniTableBody();
        }

        // Renderuj samo body dio mjesečne tabele (za sortiranje)
        function renderKupciMjesecniTableBody() {
            const bodyElem = document.getElementById('kupci-mjesecni-body');
            const state = kupciSortState.mjesecni;
            const sortimentiNazivi = kupciSortimentiNazivi;

            // Sortiraj podatke
            const sortedData = sortKupciData(kupciMjesecniData, state.key, state.direction);

            // Sticky column styles
            const stickyCol1Style = 'position: sticky; left: 0; z-index: 11; min-width: 50px;';
            const stickyCol2Style = 'position: sticky; left: 50px; z-index: 10; min-width: 150px; box-shadow: 2px 0 4px rgba(0,0,0,0.1);';

            // Ažuriraj header sa aktivnim sort indikatorom
            const headerElem = document.getElementById('kupci-mjesecni-header');
            headerElem.innerHTML = renderKupciSortableHeader('mjesecni', sortimentiNazivi, '#0369a1', '#075985');

            // Izračunaj UKUPNO sume za svaki sortiment
            const ukupnoSume = {};
            sortimentiNazivi.forEach(s => ukupnoSume[s] = 0);

            // Izračunaj top 3 za svaki sortiment (za medalje)
            const top3PoSortimentu = {};
            sortimentiNazivi.forEach(sortiment => {
                if (sortiment === 'SVEUKUPNO') return;
                const values = sortedData
                    .map(red => red.sortimenti[sortiment] || 0)
                    .filter(v => v > 0)
                    .sort((a, b) => b - a);
                top3PoSortimentu[sortiment] = [...new Set(values)].slice(0, 3);
            });

            const getMedalClass = (value, top3) => {
                if (!top3 || top3.length === 0 || value <= 0) return '';
                if (value >= top3[0]) return 'medal-gold';
                if (top3.length > 1 && value >= top3[1]) return 'medal-silver';
                if (top3.length > 2 && value >= top3[2]) return 'medal-bronze';
                return '';
            };

            // Body redovi (sa rednim brojem)
            let bodyHtml = '';
            sortedData.forEach((red, index) => {
                const rowBg = index % 2 === 0 ? '#e0f2fe' : 'white';
                const redniBroj = index + 1;
                const kupacName = (red.kupac || '').replace(/'/g, "\\'");
                bodyHtml += `<tr style="background: ${rowBg}; cursor: pointer;" data-kupac="${(red.kupac || '').toLowerCase()}" onclick="showKupacDetails('${kupacName}')" title="Klikni za detalje">`;
                bodyHtml += `<td style="text-align: center; font-weight: 600; color: #000000; padding: 8px 4px; background: ${rowBg}; ${stickyCol1Style}">${redniBroj}.</td>`;
                bodyHtml += `<td style="font-weight: 600; background: ${rowBg}; ${stickyCol2Style}">${red.kupac || '-'}</td>`;

                sortimentiNazivi.forEach(sortiment => {
                    const kolicina = red.sortimenti[sortiment] || 0;
                    ukupnoSume[sortiment] += kolicina; // Dodaj u sumu
                    const display = kolicina > 0 ? kolicina.toFixed(2) : '-';
                    const color = kolicina > 0 ? '#000000' : '#9ca3af';
                    const medalClass = sortiment !== 'SVEUKUPNO' ? getMedalClass(kolicina, top3PoSortimentu[sortiment]) : '';
                    const bgStyle = sortiment === 'SVEUKUPNO' ? ' background: #bae6fd; font-weight: 700;' : '';
                    bodyHtml += `<td class="${medalClass}" style="text-align: right; font-family: 'Roboto Mono', ui-monospace, system-ui, monospace; font-weight: 500; color: ${color}; text-shadow: 0 0 1px rgba(255,255,255,0.8);${bgStyle}">${display}</td>`;
                });

                bodyHtml += '</tr>';
            });

            // UKUPNO red na kraju
            bodyHtml += '<tr style="background: linear-gradient(135deg, #0369a1 0%, #075985 100%); font-weight: 700;">';
            bodyHtml += `<td style="color: white; font-weight: 700; text-align: center; background: #0369a1; ${stickyCol1Style}"></td>`;
            bodyHtml += `<td style="color: white; font-weight: 700; background: #0369a1; ${stickyCol2Style}">UKUPNO</td>`;
            sortimentiNazivi.forEach(sortiment => {
                const suma = ukupnoSume[sortiment] || 0;
                const display = suma > 0 ? suma.toFixed(2) : '-';
                bodyHtml += `<td style="text-align: right; font-family: 'Roboto Mono', ui-monospace, system-ui, monospace; font-weight: 700; color: white; text-shadow: 0 1px 1px rgba(0,0,0,0.3);">${display}</td>`;
            });
            bodyHtml += '</tr>';

            bodyElem.innerHTML = bodyHtml;
        }

        // Filter funkcije za kupce
        function filterKupciGodisnjiTable() {
            const searchInput = document.getElementById('kupci-godisnji-search').value.toLowerCase();
            const rows = document.querySelectorAll('#kupci-godisnji-body tr');

            rows.forEach(row => {
                const kupac = row.getAttribute('data-kupac');
                // UKUPNO red nema data-kupac atribut - uvijek ga prikaži
                if (kupac === null) {
                    row.style.display = '';
                } else if (kupac.includes(searchInput)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        function filterKupciMjesecniTable() {
            const searchInput = document.getElementById('kupci-mjesecni-search').value.toLowerCase();
            const rows = document.querySelectorAll('#kupci-mjesecni-body tr');

            rows.forEach(row => {
                const kupac = row.getAttribute('data-kupac');
                // UKUPNO red nema data-kupac atribut - uvijek ga prikaži
                if (kupac === null) {
                    row.style.display = '';
                } else if (kupac.includes(searchInput)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        // ============================================
        // 📊 KUPCI - KVARTALNI PRIKAZ
        // ============================================

        let kupciMjesecniRawData = []; // Svi mjesečni podaci (nefiltrirani) za kvartalni prikaz
        let kupciKvartalniData = [];

        // Kvartali sa mjesecima
        const kvartalMjeseci = {
            1: ['Januar', 'Februar', 'Mart'],
            2: ['April', 'Maj', 'Juni'],
            3: ['Juli', 'August', 'Septembar'],
            4: ['Oktobar', 'Novembar', 'Decembar']
        };

        const kvartalLabels = {
            1: 'Q1 (Januar - Mart)',
            2: 'Q2 (April - Juni)',
            3: 'Q3 (Juli - Septembar)',
            4: 'Q4 (Oktobar - Decembar)'
        };

        // Sort stanje za kvartalni tab
        kupciSortState.kvartalni = { key: 'SVEUKUPNO', direction: 'desc' };

        // Renderuj kvartalnu tabelu
        function renderKupciKvartalniTable() {
            const headerElem = document.getElementById('kupci-kvartalni-header');
            const bodyElem = document.getElementById('kupci-kvartalni-body');
            const selectElem = document.getElementById('kupci-kvartalni-select');

            if (!selectElem) return;

            const selectedQuarter = parseInt(selectElem.value);
            const mjeseciZaKvartal = kvartalMjeseci[selectedQuarter];

            // Filtriraj mjesečne podatke za odabrani kvartal
            const kvartalData = (kupciMjesecniRawData || []).filter(red => mjeseciZaKvartal.includes(red.mjesec));

            // Agregiraj po kupcu
            const kupciMap = {};
            kvartalData.forEach(red => {
                const kupac = red.kupac || '-';
                if (!kupciMap[kupac]) {
                    kupciMap[kupac] = { kupac: kupac, sortimenti: {}, ukupno: 0 };
                }
                // Sumiraj sortimente
                if (red.sortimenti) {
                    Object.keys(red.sortimenti).forEach(key => {
                        if (key === 'SVEUKUPNO') return;
                        const val = parseFloat(red.sortimenti[key]) || 0;
                        kupciMap[kupac].sortimenti[key] = (kupciMap[kupac].sortimenti[key] || 0) + val;
                    });
                }
                kupciMap[kupac].ukupno += (red.ukupno || 0);
            });

            // Dodaj SVEUKUPNO u sortimente
            const aggregated = Object.values(kupciMap);
            aggregated.forEach(k => {
                k.sortimenti['SVEUKUPNO'] = k.ukupno;
            });

            kupciKvartalniData = aggregated;

            if (aggregated.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za ' + kvartalLabels[selectedQuarter] + '</td></tr>';
                return;
            }

            // Renderuj header
            headerElem.innerHTML = renderKupciSortableHeader('kvartalni', kupciSortimentiNazivi, '#7c3aed', '#6d28d9');

            // Renderuj body
            renderKupciKvartalniTableBody();
        }

        // Renderuj samo body dio kvartalne tabele
        function renderKupciKvartalniTableBody() {
            const bodyElem = document.getElementById('kupci-kvartalni-body');
            const state = kupciSortState.kvartalni;
            const sortimentiNazivi = kupciSortimentiNazivi;

            // Sortiraj podatke
            const sortedData = sortKupciData(kupciKvartalniData, state.key, state.direction);

            const stickyCol1Style = 'position: sticky; left: 0; z-index: 11; min-width: 50px;';
            const stickyCol2Style = 'position: sticky; left: 50px; z-index: 10; min-width: 150px; box-shadow: 2px 0 4px rgba(0,0,0,0.1);';

            // Ažuriraj header
            const headerElem = document.getElementById('kupci-kvartalni-header');
            headerElem.innerHTML = renderKupciSortableHeader('kvartalni', sortimentiNazivi, '#7c3aed', '#6d28d9');

            // Sume za UKUPNO red
            const ukupnoSume = {};
            sortimentiNazivi.forEach(s => ukupnoSume[s] = 0);

            // Izračunaj top 3 za svaki sortiment (za medalje)
            const top3PoSortimentu = {};
            sortimentiNazivi.forEach(sortiment => {
                if (sortiment === 'SVEUKUPNO') return;
                const values = sortedData
                    .map(kupac => kupac.sortimenti[sortiment] || 0)
                    .filter(v => v > 0)
                    .sort((a, b) => b - a);
                top3PoSortimentu[sortiment] = [...new Set(values)].slice(0, 3);
            });

            const getMedalClass = (value, top3) => {
                if (!top3 || top3.length === 0 || value <= 0) return '';
                if (value >= top3[0]) return 'medal-gold';
                if (top3.length > 1 && value >= top3[1]) return 'medal-silver';
                if (top3.length > 2 && value >= top3[2]) return 'medal-bronze';
                return '';
            };

            let bodyHtml = '';
            sortedData.forEach((kupac, index) => {
                const rowBg = index % 2 === 0 ? '#f5f3ff' : 'white';
                const redniBroj = index + 1;
                const kupacName = (kupac.kupac || '').replace(/'/g, "\\'");
                bodyHtml += `<tr style="background: ${rowBg}; cursor: pointer;" data-kupac="${(kupac.kupac || '').toLowerCase()}" onclick="showKupacDetails('${kupacName}')" title="Klikni za detalje">`;
                bodyHtml += `<td style="text-align: center; font-weight: 600; color: #000000; padding: 8px 4px; background: ${rowBg}; ${stickyCol1Style}">${redniBroj}.</td>`;
                bodyHtml += `<td style="font-weight: 600; background: ${rowBg}; ${stickyCol2Style}">${kupac.kupac || '-'}</td>`;

                sortimentiNazivi.forEach(sortiment => {
                    const kolicina = kupac.sortimenti[sortiment] || 0;
                    ukupnoSume[sortiment] += kolicina;
                    const display = kolicina > 0 ? kolicina.toFixed(2) : '-';
                    const color = kolicina > 0 ? '#000000' : '#9ca3af';
                    const medalClass = sortiment !== 'SVEUKUPNO' ? getMedalClass(kolicina, top3PoSortimentu[sortiment]) : '';
                    const bgStyle = sortiment === 'SVEUKUPNO' ? ' background: #ede9fe; font-weight: 700;' : '';
                    bodyHtml += `<td class="${medalClass}" style="text-align: right; font-family: 'Roboto Mono', ui-monospace, system-ui, monospace; font-weight: 500; color: ${color}; text-shadow: 0 0 1px rgba(255,255,255,0.8);${bgStyle}">${display}</td>`;
                });

                bodyHtml += '</tr>';
            });

            // UKUPNO red
            bodyHtml += '<tr style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); font-weight: 700;">';
            bodyHtml += `<td style="color: white; font-weight: 700; text-align: center; background: #7c3aed; ${stickyCol1Style}"></td>`;
            bodyHtml += `<td style="color: white; font-weight: 700; background: #7c3aed; ${stickyCol2Style}">UKUPNO</td>`;
            sortimentiNazivi.forEach(sortiment => {
                const suma = ukupnoSume[sortiment] || 0;
                const display = suma > 0 ? suma.toFixed(2) : '-';
                bodyHtml += `<td style="text-align: right; font-family: 'Roboto Mono', ui-monospace, system-ui, monospace; font-weight: 700; color: white; text-shadow: 0 1px 1px rgba(0,0,0,0.3);">${display}</td>`;
            });
            bodyHtml += '</tr>';

            bodyElem.innerHTML = bodyHtml;
        }

        // Filter za kvartalni prikaz
        function filterKupciKvartalniTable() {
            const searchInput = document.getElementById('kupci-kvartalni-search').value.toLowerCase();
            const rows = document.querySelectorAll('#kupci-kvartalni-body tr');

            rows.forEach(row => {
                const kupac = row.getAttribute('data-kupac');
                if (kupac === null) {
                    row.style.display = '';
                } else if (kupac.includes(searchInput)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        // ============================================
        // 🏢 KUPAC DETAILS MODAL - PRIKAZ DETALJA KUPCA
        // ============================================

        // Zatvori modal za detalje kupca
        function closeKupacDetailsModal() {
            document.getElementById('kupac-details-modal').style.display = 'none';
        }

        // Prikaži detalje kupca - učitaj sve otpreme za tog kupca
        async function showKupacDetails(kupacName) {
            if (!kupacName) return;

            const modal = document.getElementById('kupac-details-modal');
            const titleElem = document.getElementById('kupac-modal-title');
            const bodyElem = document.getElementById('kupac-modal-body');

            // Prikaži modal sa loading stanjem
            modal.style.display = 'flex';
            titleElem.innerHTML = `🏢 Otpreme za: <strong>${kupacName}</strong>`;
            bodyElem.innerHTML = `
                <div style="text-align: center; padding: 60px; color: #6b7280;">
                    <div style="font-size: 32px; margin-bottom: 15px;">⏳</div>
                    <div style="font-size: 16px;">Učitavanje podataka za kupca...</div>
                </div>
            `;

            try {
                const year = new Date().getFullYear();
                const allData = [];
                const sortimentiSet = new Set();

                // Učitaj podatke za sve mjesece (0-11)
                for (let month = 0; month < 12; month++) {
                    const url = buildApiUrl('otpremaci-daily', { year, month });
                    const cacheKey = `cache_otpremaci_daily_${year}_${month}`;

                    try {
                        const data = await fetchWithCache(url, cacheKey);
                        if (data && data.data && Array.isArray(data.data)) {
                            // Filtriraj samo za ovog kupca
                            const kupacData = data.data.filter(row =>
                                row.kupac && row.kupac.toLowerCase() === kupacName.toLowerCase()
                            );
                            allData.push(...kupacData);

                            // Skupi sve sortimente
                            if (data.sortimentiNazivi) {
                                data.sortimentiNazivi.forEach(s => sortimentiSet.add(s));
                            }
                        }
                    } catch (e) {
                        // Ignoriši greške za pojedinačne mjesece
                        console.log(`Nema podataka za mjesec ${month}`);
                    }
                }

                if (allData.length === 0) {
                    bodyElem.innerHTML = `
                        <div style="text-align: center; padding: 60px; color: #6b7280;">
                            <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                            <div style="font-size: 18px;">Nema podataka o otpremama za kupca <strong>${kupacName}</strong> u ${year}. godini</div>
                        </div>
                    `;
                    return;
                }

                const sortimentiNazivi = Array.from(sortimentiSet);

                // Sortiraj po datumu (od najnovijeg)
                allData.sort((a, b) => {
                    const parseDate = (dateStr) => {
                        if (!dateStr) return new Date(0);
                        const parts = dateStr.split('.');
                        if (parts.length >= 2) {
                            const day = parseInt(parts[0]) || 1;
                            const month = parseInt(parts[1]) - 1 || 0;
                            const yearPart = parts[2] ? parseInt(parts[2]) : year;
                            return new Date(yearPart, month, day);
                        }
                        return new Date(0);
                    };
                    return parseDate(b.datum) - parseDate(a.datum);
                });

                // Izračunaj totale po sortimentima
                const totals = {};
                sortimentiNazivi.forEach(s => totals[s] = 0);
                allData.forEach(row => {
                    sortimentiNazivi.forEach(s => {
                        totals[s] += (row.sortimenti && row.sortimenti[s]) || 0;
                    });
                });

                // Generiši HTML tabelu
                let html = `
                    <div style="padding: 16px;">
                        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <div style="color: #0891b2; font-weight: 600;">
                                📊 Ukupno ${allData.length} otprema u ${year}. godini
                            </div>
                        </div>
                        <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;" id="kupac-details-table">
                                <thead>
                                    <tr style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);">
                                        <th style="position: sticky; left: 0; z-index: 10; background: #0891b2; color: white; padding: 12px 8px; font-weight: 700; text-align: left; min-width: 90px; border-right: 2px solid #164e63;">📅 Datum</th>
                                        <th style="color: white; padding: 12px 8px; font-weight: 700; text-align: left; min-width: 80px;">🏭 Odjel</th>
                                        <th style="color: white; padding: 12px 8px; font-weight: 700; text-align: left; min-width: 120px;">🚛 Otpremač</th>
                                        ${sortimentiNazivi.map(s => `
                                            <th style="color: white; padding: 12px 6px; font-weight: 600; text-align: right; min-width: 60px; font-size: 11px;">${s}</th>
                                        `).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                `;

                allData.forEach((row, index) => {
                    const rowBg = index % 2 === 0 ? '#ecfeff' : '#ffffff';
                    html += `
                        <tr style="background: ${rowBg};">
                            <td style="position: sticky; left: 0; z-index: 5; background: ${rowBg}; padding: 10px 8px; font-weight: 600; color: #0e7490; border-right: 2px solid #a5f3fc;">${row.datum || '-'}</td>
                            <td style="padding: 10px 8px; color: #164e63; font-weight: 500;">${row.odjel || '-'}</td>
                            <td style="padding: 10px 8px; color: #0891b2; font-weight: 500;">${row.otpremac || '-'}</td>
                            ${sortimentiNazivi.map(s => {
                                const val = (row.sortimenti && row.sortimenti[s]) || 0;
                                const display = val > 0 ? val.toFixed(2) : '-';
                                const style = val > 0 ? 'color: #164e63; font-weight: 600;' : 'color: #d1d5db;';
                                return `<td style="padding: 10px 6px; text-align: right; font-family: 'Roboto Mono', monospace; ${style}">${display}</td>`;
                            }).join('')}
                        </tr>
                    `;
                });

                // UKUPNO red
                html += `
                    <tr style="background: linear-gradient(135deg, #0e7490 0%, #155e75 100%); color: white; font-weight: 700;">
                        <td style="position: sticky; left: 0; z-index: 5; background: #0e7490; padding: 12px 8px; font-weight: 800; border-right: 2px solid #164e63;">📊 UKUPNO</td>
                        <td colspan="2" style="padding: 12px 8px;"></td>
                        ${sortimentiNazivi.map(s => {
                            const val = totals[s] || 0;
                            const display = val > 0 ? val.toFixed(2) : '-';
                            return `<td style="padding: 12px 6px; text-align: right; font-family: 'Roboto Mono', monospace; font-weight: 800;">${display}</td>`;
                        }).join('')}
                    </tr>
                `;

                html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;

                bodyElem.innerHTML = html;

            } catch (error) {
                console.error('Error loading kupac details:', error);
                bodyElem.innerHTML = `
                    <div style="text-align: center; padding: 60px; color: #dc2626;">
                        <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
                        <div style="font-size: 18px;">Greška pri učitavanju: ${error.message}</div>
                    </div>
                `;
            }
        }

        // Load otpreme po kupcima u tekućem mjesecu
        async function loadOtremaciPoKupcima() {

            try {
                const year = new Date().getFullYear();
                const url = buildApiUrl('kupci', { year });
                const data = await fetchWithCache(url, 'cache_kupci_' + year);


                if (data.error || !data.mjesecni || !data.sortimentiNazivi) {
                    throw new Error(data.error || 'Nema podataka');
                }

                // Update dynamic month name in tab and title
                const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
                const currentMjesec = mjeseci[new Date().getMonth()];
                document.getElementById('current-month-name').textContent = currentMjesec;
                document.getElementById('otpremaci-po-kupcima-month-title').textContent = currentMjesec + ' ' + year;

                // Renderuj expert tabelu
                renderOtremaciPoKupcimaExpertTable(data.mjesecni, data.sortimentiNazivi);

            } catch (error) {
                console.error('Error loading otpremaci po kupcima:', error);
                document.getElementById('otpremaci-po-kupcima-body').innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #dc2626;">Greška pri učitavanju: ' + error.message + '</td></tr>';
            }
        }

        // Renderuj expert tabelu sa sortiranjem i rekapitulacijom
        function renderOtremaciPoKupcimaExpertTable(mjesecni, sortimentiNazivi) {
            const headerElem = document.getElementById('otpremaci-po-kupcima-header');
            const bodyElem = document.getElementById('otpremaci-po-kupcima-body');
            const footerElem = document.getElementById('otpremaci-po-kupcima-footer');


            // Filtruj samo trenutni mjesec
            const currentDate = new Date();
            const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
            const currentMjesec = mjeseci[currentDate.getMonth()];


            let filteredData = mjesecni.filter(red => red.mjesec === currentMjesec);


            if (!filteredData || filteredData.length === 0) {
                // DEBUG: Show which months are available
                const availableMonths = [...new Set(mjesecni.map(r => r.mjesec))].join(', ');
                headerElem.innerHTML = '';
                bodyElem.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">
                    <p>Nema podataka za tekući mjesec: <strong>${currentMjesec}</strong></p>
                    <p style="margin-top: 10px; font-size: 14px;">Dostupni mjeseci u bazi: ${availableMonths || 'Nema podataka'}</p>
                </td></tr>`;
                footerElem.innerHTML = '';
                return;
            }

            // SORTIRANJE: Od najvećeg ka najmanjem po ukupnoj količini
            filteredData.sort((a, b) => (b.ukupno || 0) - (a.ukupno || 0));

            // HEADER sa svim sortimentima
            let headerHtml = '<tr><th>Kupac</th>';
            sortimentiNazivi.forEach(sortiment => {
                if (sortiment !== 'SVEUKUPNO') {
                    headerHtml += `<th style="text-align: right;">${sortiment}</th>`;
                }
            });
            headerHtml += '<th style="text-align: right;">UKUPNO (m³)</th></tr>';
            headerElem.innerHTML = headerHtml;

            // BODY redovi + računanje rekapitulacije
            let bodyHtml = '';
            const totals = {};
            let grandTotal = 0;

            // Inicijalizuj sve sortimente na 0
            sortimentiNazivi.forEach(sortiment => {
                totals[sortiment] = 0;
            });

            filteredData.forEach((red, index) => {
                bodyHtml += `<tr data-kupac="${(red.kupac || '').toLowerCase()}">`;
                bodyHtml += `<td>${red.kupac || '-'}</td>`;

                sortimentiNazivi.forEach(sortiment => {
                    if (sortiment !== 'SVEUKUPNO') {
                        const kolicina = red.sortimenti[sortiment] || 0;
                        totals[sortiment] += kolicina;
                        const display = kolicina > 0 ? kolicina.toFixed(2) : '-';
                        bodyHtml += `<td class="sortiment-value">${display}</td>`;
                    }
                });

                const ukupno = red.ukupno || 0;
                grandTotal += ukupno;
                bodyHtml += `<td>${ukupno.toFixed(2)}</td>`;
                bodyHtml += '</tr>';
            });
            bodyElem.innerHTML = bodyHtml;

            // FOOTER - Rekapitulacija mjeseca
            let footerHtml = '<tr><td>📊 REKAPITULACIJA ' + currentMjesec.toUpperCase() + '</td>';
            sortimentiNazivi.forEach(sortiment => {
                if (sortiment !== 'SVEUKUPNO') {
                    const total = totals[sortiment] || 0;
                    const display = total > 0 ? total.toFixed(2) : '-';
                    footerHtml += `<td style="text-align: right;">${display}</td>`;
                }
            });
            footerHtml += `<td>${grandTotal.toFixed(2)}</td>`;
            footerHtml += '</tr>';
            footerElem.innerHTML = footerHtml;
        }

        // Filter funkcija za otpreme po kupcima
        function filterOtremaciPoKupcimaTable() {
            const searchInput = document.getElementById('otpremaci-po-kupcima-search').value.toLowerCase();
            const rows = document.querySelectorAll('#otpremaci-po-kupcima-body tr');

            rows.forEach(row => {
                const kupac = row.getAttribute('data-kupac') || '';
                if (kupac.includes(searchInput)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        // Render Top 5 Kupaca po sortimentima
        function renderKupciTop5BySortimenti(data) {

            // Define sortimenti categories and their indices
            const sortimentiCategories = {
                'TRUPCI Č': ['TRUPCI Č'],
                'CEL.DUGA': ['CEL.DUGA'],
                'CEL.CIJEPANA': ['CEL.CIJEPANA'],
                'TRUPCI': ['TRUPCI'],
                'OGR. DUGI': ['OGR. DUGI', 'OGR.DUGI'],
                'OGR. CIJEPANI': ['OGR. CIJEPANI', 'OGR.CIJEPANI']
            };

            const divIds = {
                'TRUPCI Č': 'kupci-trupci-cetinara',
                'CEL.DUGA': 'kupci-celuloza-duga',
                'CEL.CIJEPANA': 'kupci-celuloza-cijepana',
                'TRUPCI': 'kupci-trupci-liscara',
                'OGR. DUGI': 'kupci-ogrijev-dugi',
                'OGR. CIJEPANI': 'kupci-ogrijev-cijepani'
            };

            Object.entries(sortimentiCategories).forEach(([category, sortimenti]) => {
                const kupciMap = {};

                data.godisnji.forEach(kupac => {
                    let total = 0;
                    sortimenti.forEach(sortiment => {
                        total += (kupac.sortimenti[sortiment] || 0);
                    });
                    if (total > 0) {
                        kupciMap[kupac.kupac] = total;
                    }
                });

                const sorted = Object.entries(kupciMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                const html = sorted.length > 0
                    ? sorted.map(([kupac, volume], index) => {
                        const rankClass = index < 3 ? 'top' : '';
                        return `
                            <div class="ranking-item">
                                <div class="ranking-number ${rankClass}">${index + 1}</div>
                                <div class="ranking-info">
                                    <div class="ranking-name">${kupac}</div>
                                    <div class="ranking-value">${volume.toFixed(2)} m³</div>
                                </div>
                            </div>
                        `;
                    }).join('')
                    : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka</p>';

                const divId = divIds[category];
                if (divId) {
                    document.getElementById(divId).innerHTML = html;
                }
            });
        }

        // Render Top 10 Kupaca - Total Otprema
        function renderKupciTop10(godisnjiData) {

            const sorted = godisnjiData
                .sort((a, b) => (b.ukupno || 0) - (a.ukupno || 0))
                .slice(0, 10);

            const html = sorted.length > 0
                ? sorted.map((kupac, index) => {
                    const rankClass = index < 3 ? 'top' : '';
                    return `
                        <div class="ranking-item">
                            <div class="ranking-number ${rankClass}">${index + 1}</div>
                            <div class="ranking-info">
                                <div class="ranking-name">${kupac.kupac || 'Nepoznat'}</div>
                                <div class="ranking-value">${(kupac.ukupno || 0).toFixed(2)} m³</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka</p>';

            document.getElementById('kupci-top-10-list').innerHTML = html;
        }

        // ========== MOVED TO js/charts.js ==========
        // ========================================
        // ODJELI VIEW (BY DEPARTMENT) - WITH PAGINATION
        // ========================================

        let primacOdjeliData = null;
        let primacOdjeliCurrentPage = 0;
        const primacOdjeliPageSize = 5;

        let otpremacOdjeliData = null;
        let otpremacOdjeliCurrentPage = 0;
        const otpremacOdjeliPageSize = 5;

        // Load primac odjeli data (ZADNJIH 15 ODJELA IZ SVIH GODINA)
        // ✅ OPTIMIZOVANO: Jedan API poziv sa limit=15 (backend procesira sve godine)
        async function loadPrimacOdjeli() {
            if (!isActiveTab('primac-odjeli')) return;
            // Turbo: skip loading screen if cache exists
            if (!localStorage.getItem('cache_primac_odjeli_top15')) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('primac-odjeli-content').classList.add('hidden');
            } else {
                document.getElementById('primac-odjeli-content').classList.remove('hidden');
            }

            try {
                const url = buildApiUrl('primac-odjeli', { limit: 15 });
                const data = await fetchWithCache(url, 'cache_primac_odjeli_top15');

                if (data.error) {
                    throw new Error(data.error);
                }

                if (!data.odjeli || data.odjeli.length === 0) {
                    throw new Error('Nema podataka o odjelima');
                }

                // Backend već šalje sortiran i limitiran rezultat sa godinom
                primacOdjeliData = {
                    odjeli: data.odjeli,
                    sortimentiNazivi: data.sortimentiNazivi || []
                };

                primacOdjeliCurrentPage = 0;
                renderPrimacOdjeliPage();

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('primac-odjeli-content').classList.remove('hidden');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju podataka: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }

        function renderPrimacOdjeliPage() {
            if (!primacOdjeliData) return;

            const start = primacOdjeliCurrentPage * primacOdjeliPageSize;
            const end = Math.min(start + primacOdjeliPageSize, primacOdjeliData.odjeli.length);
            const pageOdjeli = primacOdjeliData.odjeli.slice(start, end);

            let html = '';

            pageOdjeli.forEach(odjel => {
                // Kreiraj HTML za odjel sa dve tabele
                const yearBadge = odjel.godina ? `<span style="background: #fbbf24; color: #78350f; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; margin-left: 10px;">${odjel.godina}</span>` : '';
                html += `
                    <div style="margin-bottom: 40px; border: 2px solid #10b981; border-radius: 12px; padding: 20px; background: #f0fdf4;">
                        <h3 style="color: #047857; margin-bottom: 16px;">📁 ${odjel.odjel} ${yearBadge}</h3>
                        <p style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">Zadnji unos: ${odjel.zadnjiDatum || 'N/A'}</p>

                        <!-- Apsolutne vrijednosti -->
                        <h4 style="font-size: 15px; margin-bottom: 8px; color: #059669;">Apsolutne vrijednosti (m³)</h4>
                        <div class="kupci-table-wrapper" style="margin-bottom: 20px;">
                            <table class="kupci-table">
                                <thead>
                                    <tr>
                                        ${primacOdjeliData.sortimentiNazivi.map(s => `<th class="sortiment-col">${s}</th>`).join('')}
                                        <th class="ukupno-col">Ukupno</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        ${primacOdjeliData.sortimentiNazivi.map(s => {
                                            const val = odjel.sortimenti[s] || 0;
                                            return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                                        }).join('')}
                                        <td class="ukupno-col">${odjel.ukupno.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Procentualne vrijednosti -->
                        <h4 style="font-size: 15px; margin-bottom: 8px; color: #059669;">Procentualni udio (%)</h4>
                        <div class="kupci-table-wrapper">
                            <table class="kupci-table">
                                <thead>
                                    <tr>
                                        ${primacOdjeliData.sortimentiNazivi.map(s => `<th class="sortiment-col">${s}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        ${primacOdjeliData.sortimentiNazivi.map(s => {
                                            const val = odjel.sortimenti[s] || 0;
                                            const percent = odjel.ukupno > 0 ? (val / odjel.ukupno) * 100 : 0;
                                            return `<td class="sortiment-col">${percent > 0 ? percent.toFixed(1) + '%' : '-'}</td>`;
                                        }).join('')}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });

            document.getElementById('primac-odjeli-container').innerHTML = html;

            // Update pagination controls
            const totalPages = Math.ceil(primacOdjeliData.odjeli.length / primacOdjeliPageSize);
            document.getElementById('primac-odjeli-page-info').textContent = `Stranica ${primacOdjeliCurrentPage + 1} od ${totalPages}`;
            document.getElementById('primac-odjeli-prev').disabled = primacOdjeliCurrentPage === 0;
            document.getElementById('primac-odjeli-next').disabled = primacOdjeliCurrentPage >= totalPages - 1;
        }

        function prevPagePrimacOdjeli() {
            if (primacOdjeliCurrentPage > 0) {
                primacOdjeliCurrentPage--;
                renderPrimacOdjeliPage();
            }
        }

        function nextPagePrimacOdjeli() {
            const totalPages = Math.ceil(primacOdjeliData.odjeli.length / primacOdjeliPageSize);
            if (primacOdjeliCurrentPage < totalPages - 1) {
                primacOdjeliCurrentPage++;
                renderPrimacOdjeliPage();
            }
        }

        // ========================================
        // ADMIN: PRIMAČI NA ŠUMA PANJU
        // ========================================

        // Globalne varijable za primaci-admin tab
        var primaciAdminData = null;         // Cached data od primac-detail-admin
        var primaciAdminOdjeliData = null;   // Cached data od primac-odjeli-admin
        var primaciAdminOdjeliPage = 0;
        var primaciAdminOdjeliPageSize = 5;
        var _primaciAdminCurrentSubmenu = 'pregled';

        // Default odjeli pregled varijable
        var odjeliDefaultData = null;        // Agregirani podaci po odjelima
        var odjeliDefaultPage = 0;
        var odjeliDefaultPageSize = 3;

        // Inicijalizacija taba - popuni dropdown sa primačima
        async function loadPrimaciAdminTab() {
            if (!isActiveTab('primaci-admin')) return;
            var content = document.getElementById('primaci-admin-content');
            content.classList.remove('hidden');

            var yearSelect = document.getElementById('primaci-admin-year-select');
            if (!yearSelect.options.length || yearSelect.options.length <= 1) {
                var currentYear = new Date().getFullYear();
                yearSelect.innerHTML = '';
                for (var y = currentYear; y >= 2024; y--) {
                    var opt = document.createElement('option');
                    opt.value = y;
                    opt.textContent = y;
                    yearSelect.appendChild(opt);
                }
            }

            // Popuni month selector sa default na tekući mjesec
            var monthSelect = document.getElementById('primaci-admin-month-select');
            if (monthSelect) {
                monthSelect.value = new Date().getMonth() + 1;
            }

            // Dohvati listu primača iz primaci endpoint-a
            var primacSelect = document.getElementById('primaci-admin-select');
            if (primacSelect.options.length <= 1) {
                try {
                    var year = yearSelect.value || new Date().getFullYear();
                    var url = buildApiUrl('primaci', { year: year });
                    var data = await fetchWithCache(url, 'cache_primaci_' + year);
                    if (data && data.primaci) {
                        data.primaci.forEach(function(p) {
                            var opt = document.createElement('option');
                            opt.value = p.primac;
                            opt.textContent = p.primac + ' (' + p.ukupno.toFixed(0) + ' m³)';
                            primacSelect.appendChild(opt);
                        });
                    }
                } catch (err) {
                    console.error('Greška pri učitavanju liste primača:', err);
                }
            }

            // Učitaj default pregled po odjelima
            loadOdjeliDefaultView();

            markTabRendered('primaci-admin');
        }

        // Kada se izabere primač iz dropdown-a
        function onPrimaciAdminSelectChange() {
            var primacName = document.getElementById('primaci-admin-select').value;
            var yearSelect = document.getElementById('primaci-admin-year-select');
            if (!primacName) {
                document.getElementById('primaci-admin-submenu').style.display = 'none';
                document.getElementById('primaci-admin-placeholder').style.display = 'block';
                document.getElementById('primaci-admin-pregled-view').classList.add('hidden');
                document.getElementById('primaci-admin-godisnji-view').classList.add('hidden');
                document.getElementById('primaci-admin-odjeli-view').classList.add('hidden');
                yearSelect.style.display = 'none';
                // Ponovo učitaj default odjeli pregled ako nemamo podatke
                if (!odjeliDefaultData) loadOdjeliDefaultView();
                return;
            }

            document.getElementById('primaci-admin-submenu').style.display = '';
            document.getElementById('primaci-admin-placeholder').style.display = 'none';
            yearSelect.style.display = '';

            // Reset submenu to "Pregled sječe"
            _primaciAdminCurrentSubmenu = 'pregled';
            var submenuTabs = document.querySelectorAll('#primaci-admin-content .submenu-tab');
            submenuTabs.forEach(function(t, i) { t.classList.toggle('active', i === 0); });

            // Reset cached data
            primaciAdminData = null;
            primaciAdminOdjeliData = null;

            // Load pregled sječe
            loadPrimaciAdminData();
        }

        // Kada se promijeni godina
        function onPrimaciAdminYearChange() {
            var primacName = document.getElementById('primaci-admin-select').value;
            if (!primacName) {
                // Default pregled ne ovisi o godini - ne treba reload
                return;
            }

            // Resetuj primac listu za novu godinu
            var primacSelect = document.getElementById('primaci-admin-select');
            var selectedPrimac = primacSelect.value;
            // Ponovo učitaj listu za novu godinu
            while (primacSelect.options.length > 1) primacSelect.remove(1);

            var year = document.getElementById('primaci-admin-year-select').value;
            var url = buildApiUrl('primaci', { year: year });
            fetchWithCache(url, 'cache_primaci_' + year).then(function(data) {
                if (data && data.primaci) {
                    data.primaci.forEach(function(p) {
                        var opt = document.createElement('option');
                        opt.value = p.primac;
                        opt.textContent = p.primac + ' (' + p.ukupno.toFixed(0) + ' m³)';
                        primacSelect.appendChild(opt);
                    });
                    // Re-selektuj istog primača ako postoji
                    if (selectedPrimac) {
                        primacSelect.value = selectedPrimac;
                        if (primacSelect.value === selectedPrimac) {
                            primaciAdminData = null;
                            primaciAdminOdjeliData = null;
                            loadPrimaciAdminData();
                        }
                    }
                }
            });
        }

        // Kada se promijeni mjesec za daily chart
        function onPrimaciAdminMonthChange() {
            if (!primaciAdminData) return;
            var year = document.getElementById('primaci-admin-year-select').value;
            var month = document.getElementById('primaci-admin-month-select').value;
            createWorkerDailyChart('primaci-admin-daily-chart', primaciAdminData.unosi, month, year, '#047857', '#10b981');
        }

        // Učitaj podatke za izabranog primača (Pregled sječe)
        async function loadPrimaciAdminData() {
            var primacName = document.getElementById('primaci-admin-select').value;
            var year = document.getElementById('primaci-admin-year-select').value;
            if (!primacName) return;

            var loading = document.getElementById('primaci-admin-loading');
            loading.classList.remove('hidden');
            document.getElementById('primaci-admin-pregled-view').classList.add('hidden');
            document.getElementById('primaci-admin-godisnji-view').classList.add('hidden');
            document.getElementById('primaci-admin-odjeli-view').classList.add('hidden');

            try {
                var url = buildApiUrl('primac-detail-admin', { year: year, primacName: primacName });
                var cacheKey = 'cache_primac_detail_admin_' + primacName + '_' + year;
                var data = await fetchWithCache(url, cacheKey);

                if (data.error) throw new Error(data.error);

                primaciAdminData = data;

                // Ime i ukupno badge
                var totalKubik = 0;
                data.unosi.forEach(function(u) { totalKubik += u.ukupno; });

                document.getElementById('primaci-admin-primac-name').textContent = primacName;
                document.getElementById('primaci-admin-total-badge').textContent = 'Ukupno: ' + totalKubik.toFixed(2) + ' m³';

                // Header tabele
                var headerHTML = '<tr>' +
                    '<th onclick="sortTable(0, \'primaci-admin-table\')">Datum ⇅</th>' +
                    '<th onclick="sortTable(1, \'primaci-admin-table\')">Odjel ⇅</th>' +
                    data.sortimentiNazivi.map(function(s, i) {
                        return '<th class="sortiment-col" onclick="sortTable(' + (i+2) + ', \'primaci-admin-table\')">' + s + ' ⇅</th>';
                    }).join('') +
                    '<th class="ukupno-col" onclick="sortTable(' + (data.sortimentiNazivi.length + 2) + ', \'primaci-admin-table\')">Ukupno ⇅</th>' +
                    '</tr>';
                document.getElementById('primaci-admin-header').innerHTML = headerHTML;

                // Body tabele sa totalima
                var totals = { sortimenti: {}, ukupno: 0 };
                data.sortimentiNazivi.forEach(function(s) { totals.sortimenti[s] = 0; });

                var odjelBojeMap = {}, odjelBojeIdx = 0;
                var bodyHTML = data.unosi.map(function(u) {
                    data.sortimentiNazivi.forEach(function(s) {
                        totals.sortimenti[s] += (u.sortimenti[s] || 0);
                    });
                    totals.ukupno += u.ukupno;

                    var sortimentiCells = data.sortimentiNazivi.map(function(s) {
                        var val = u.sortimenti[s] || 0;
                        return '<td class="sortiment-col">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                    }).join('');

                    var dateParts = u.datum.split('.');
                    var mjesec = dateParts.length >= 2 ? parseInt(dateParts[1]) : 1;

                    var mjesecBoje = {
                        1: '#9d174d', 2: '#6b21a8', 3: '#3730a3', 4: '#1e40af',
                        5: '#0e7490', 6: '#0f766e', 7: '#065f46', 8: '#3f6212',
                        9: '#854d0e', 10: '#9a3412', 11: '#b91c1c', 12: '#374151'
                    };
                    var mBoja = mjesecBoje[mjesec] || '#1f2937';
                    var mBg = {
                        1: '#fce7f3', 2: '#f3e8ff', 3: '#e0e7ff', 4: '#dbeafe',
                        5: '#cffafe', 6: '#ccfbf1', 7: '#d1fae5', 8: '#ecfccb',
                        9: '#fef9c3', 10: '#ffedd5', 11: '#fee2e2', 12: '#f3f4f6'
                    };

                    // Boje za odjele
                    if (!odjelBojeMap[u.odjel]) {
                        var ob = [
                            { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
                            { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
                            { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
                            { bg: '#ede9fe', text: '#5b21b6', border: '#8b5cf6' },
                            { bg: '#fce7f3', text: '#9d174d', border: '#ec4899' },
                            { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
                            { bg: '#cffafe', text: '#155e75', border: '#06b6d4' },
                            { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
                            { bg: '#e0e7ff', text: '#3730a3', border: '#6366f1' },
                            { bg: '#ecfccb', text: '#3f6212', border: '#84cc16' },
                            { bg: '#f3e8ff', text: '#6b21a8', border: '#a855f7' },
                            { bg: '#ccfbf1', text: '#134e4a', border: '#14b8a6' },
                            { bg: '#fef9c3', text: '#854d0e', border: '#eab308' },
                            { bg: '#e0f2fe', text: '#075985', border: '#0ea5e9' },
                            { bg: '#fce7f3', text: '#831843', border: '#db2777' }
                        ];
                        odjelBojeMap[u.odjel] = ob[odjelBojeIdx % ob.length];
                        odjelBojeIdx++;
                    }
                    var oBoja = odjelBojeMap[u.odjel];

                    return '<tr class="mjesec-' + mjesec + '">' +
                        '<td style="font-weight: 700; color: ' + mBoja + '; background: ' + mBg[mjesec] + '; border-left: 4px solid ' + mBoja + ';">' + u.datum + '</td>' +
                        '<td style="font-weight: 700; color: ' + oBoja.text + '; background: ' + oBoja.bg + '; border-left: 3px solid ' + oBoja.border + ';">' + u.odjel + '</td>' +
                        sortimentiCells +
                        '<td class="ukupno-col">' + u.ukupno.toFixed(2) + '</td>' +
                        '</tr>';
                }).join('');

                var totalsCells = data.sortimentiNazivi.map(function(s) {
                    var val = totals.sortimenti[s];
                    return '<td class="sortiment-col">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                }).join('');

                bodyHTML += '<tr class="totals-row">' +
                    '<td colspan="2" style="text-align: left; font-weight: 700;">UKUPNO</td>' +
                    totalsCells +
                    '<td class="ukupno-col">' + totals.ukupno.toFixed(2) + '</td>' +
                    '</tr>';

                document.getElementById('primaci-admin-body').innerHTML = bodyHTML;

                // Mjesečni chart
                await createWorkerMonthlyChart('primaci-admin-monthly-chart', data.unosi, '#047857', '#10b981');

                // Daily chart za izabrani mjesec
                var monthSelect = document.getElementById('primaci-admin-month-select');
                var selectedMonth = monthSelect ? monthSelect.value : (new Date().getMonth() + 1);
                await createWorkerDailyChart('primaci-admin-daily-chart', data.unosi, selectedMonth, year, '#047857', '#10b981');

                loading.classList.add('hidden');
                document.getElementById('primaci-admin-pregled-view').classList.remove('hidden');

            } catch (error) {
                loading.classList.add('hidden');
                showError('Greška', 'Greška pri učitavanju podataka: ' + error.message);
            }
        }

        // Godišnji prikaz za izabranog primača
        async function loadPrimaciAdminGodisnji() {
            var primacName = document.getElementById('primaci-admin-select').value;
            var year = document.getElementById('primaci-admin-year-select').value;
            if (!primacName) return;

            try {
                var data = primaciAdminData;
                if (!data) {
                    var url = buildApiUrl('primac-detail-admin', { year: year, primacName: primacName });
                    data = await fetchWithCache(url, 'cache_primac_detail_admin_' + primacName + '_' + year);
                    if (data.error) throw new Error(data.error);
                    primaciAdminData = data;
                }

                document.getElementById('primaci-admin-godisnji-name').textContent = primacName;
                document.getElementById('primaci-admin-godisnji-year-badge').textContent = year;

                // Grupiši po mjesecima
                var mjeseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
                var monthlyData = {};
                for (var i = 1; i <= 12; i++) {
                    monthlyData[i] = { mjesec: mjeseci[i-1], sortimenti: {}, ukupno: 0 };
                    data.sortimentiNazivi.forEach(function(s) { monthlyData[i].sortimenti[s] = 0; });
                }

                data.unosi.forEach(function(u) {
                    var dateParts = u.datum.split('.');
                    if (dateParts.length >= 2) {
                        var mjesec = parseInt(dateParts[1]);
                        monthlyData[mjesec].ukupno += u.ukupno || 0;
                        data.sortimentiNazivi.forEach(function(s) {
                            monthlyData[mjesec].sortimenti[s] += (u.sortimenti[s] || 0);
                        });
                    }
                });

                // Header
                var headerHTML = '<tr><th>Mjesec</th>' +
                    data.sortimentiNazivi.map(function(s) { return '<th class="sortiment-col">' + s + '</th>'; }).join('') +
                    '<th class="ukupno-col">Ukupno</th></tr>';
                document.getElementById('primaci-admin-godisnji-header').innerHTML = headerHTML;

                // Body
                var totalSortimenti = {};
                data.sortimentiNazivi.forEach(function(s) { totalSortimenti[s] = 0; });
                var totalUkupno = 0;

                var bodyHTML = mjeseci.map(function(mjesec, idx) {
                    var mjesecNum = idx + 1;
                    var md = monthlyData[mjesecNum];
                    totalUkupno += md.ukupno;

                    var sortimentiCells = data.sortimentiNazivi.map(function(s) {
                        totalSortimenti[s] += md.sortimenti[s];
                        var val = md.sortimenti[s];
                        return '<td class="sortiment-col">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                    }).join('');

                    return '<tr class="mjesec-' + mjesecNum + '">' +
                        '<td style="font-weight: 700;">' + mjesec + '</td>' +
                        sortimentiCells +
                        '<td class="ukupno-col">' + (md.ukupno > 0 ? md.ukupno.toFixed(2) : '-') + '</td>' +
                        '</tr>';
                }).join('');

                // Totals red
                var totalsCells = data.sortimentiNazivi.map(function(s) {
                    var val = totalSortimenti[s];
                    return '<td class="sortiment-col">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                }).join('');

                bodyHTML += '<tr class="totals-row">' +
                    '<td style="text-align: left; font-weight: 700;">GODIŠNJE UKUPNO</td>' +
                    totalsCells +
                    '<td class="ukupno-col">' + totalUkupno.toFixed(2) + '</td>' +
                    '</tr>';

                document.getElementById('primaci-admin-godisnji-body').innerHTML = bodyHTML;

                // Yearly chart
                await createWorkerYearlyChart('primaci-admin-yearly-chart', data.unosi, '#047857', '#10b981');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju godišnjeg prikaza: ' + error.message);
            }
        }

        // Prikaz po odjelima za izabranog primača
        async function loadPrimaciAdminOdjeli() {
            var primacName = document.getElementById('primaci-admin-select').value;
            if (!primacName) return;

            var loading = document.getElementById('primaci-admin-loading');

            try {
                if (!primaciAdminOdjeliData) {
                    loading.classList.remove('hidden');
                    var url = buildApiUrl('primac-odjeli-admin', { primacName: primacName, limit: 50 });
                    var cacheKey = 'cache_primac_odjeli_admin_' + primacName;
                    var data = await fetchWithCache(url, cacheKey);

                    if (data.error) throw new Error(data.error);
                    primaciAdminOdjeliData = data;
                    loading.classList.add('hidden');
                }

                document.getElementById('primaci-admin-odjeli-name').textContent = primacName + ' - Odjeli';
                primaciAdminOdjeliPage = 0;
                renderPrimaciAdminOdjeliPage();

            } catch (error) {
                loading.classList.add('hidden');
                showError('Greška', 'Greška pri učitavanju odjela: ' + error.message);
            }
        }

        // Renderuj stranicu odjela za primaci-admin
        function renderPrimaciAdminOdjeliPage() {
            if (!primaciAdminOdjeliData || !primaciAdminOdjeliData.odjeli) return;

            var start = primaciAdminOdjeliPage * primaciAdminOdjeliPageSize;
            var end = Math.min(start + primaciAdminOdjeliPageSize, primaciAdminOdjeliData.odjeli.length);
            var pageOdjeli = primaciAdminOdjeliData.odjeli.slice(start, end);

            var html = '';
            pageOdjeli.forEach(function(odjel) {
                var yearBadge = odjel.godina ? '<span style="background: #fbbf24; color: #78350f; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; margin-left: 10px;">' + odjel.godina + '</span>' : '';

                var sortHeaderCells = primaciAdminOdjeliData.sortimentiNazivi.map(function(s) {
                    return '<th class="sortiment-col">' + s + '</th>';
                }).join('');

                var sortValCells = primaciAdminOdjeliData.sortimentiNazivi.map(function(s) {
                    var val = odjel.sortimenti[s] || 0;
                    return '<td class="sortiment-col">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                }).join('');

                var sortPctCells = primaciAdminOdjeliData.sortimentiNazivi.map(function(s) {
                    var val = odjel.sortimenti[s] || 0;
                    var pct = odjel.ukupno > 0 ? (val / odjel.ukupno) * 100 : 0;
                    return '<td class="sortiment-col">' + (pct > 0 ? pct.toFixed(1) + '%' : '-') + '</td>';
                }).join('');

                html += '<div style="margin-bottom: 24px; border: 2px solid #10b981; border-radius: 12px; padding: 20px; background: #f0fdf4;">' +
                    '<h3 style="color: #047857; margin-bottom: 12px;">📁 ' + odjel.odjel + ' ' + yearBadge + '</h3>' +
                    '<p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">Zadnji unos: ' + (odjel.zadnjiDatum || 'N/A') + ' | Ukupno: <strong>' + odjel.ukupno.toFixed(2) + ' m³</strong></p>' +
                    '<h4 style="font-size: 14px; margin-bottom: 8px; color: #059669;">Apsolutne vrijednosti (m³)</h4>' +
                    '<div class="kupci-table-wrapper" style="margin-bottom: 16px;">' +
                    '<table class="kupci-table"><thead><tr>' + sortHeaderCells + '<th class="ukupno-col">Ukupno</th></tr></thead>' +
                    '<tbody><tr>' + sortValCells + '<td class="ukupno-col">' + odjel.ukupno.toFixed(2) + '</td></tr></tbody></table></div>' +
                    '<h4 style="font-size: 14px; margin-bottom: 8px; color: #059669;">Procentualni udio (%)</h4>' +
                    '<div class="kupci-table-wrapper">' +
                    '<table class="kupci-table"><thead><tr>' + sortHeaderCells + '</tr></thead>' +
                    '<tbody><tr>' + sortPctCells + '</tr></tbody></table></div>' +
                    '</div>';
            });

            if (pageOdjeli.length === 0) {
                html = '<div style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka o odjelima za ovog primača.</div>';
            }

            document.getElementById('primaci-admin-odjeli-container').innerHTML = html;

            // Pagination
            var totalPages = Math.ceil(primaciAdminOdjeliData.odjeli.length / primaciAdminOdjeliPageSize);
            document.getElementById('primaci-admin-odjeli-page-info').textContent = 'Stranica ' + (primaciAdminOdjeliPage + 1) + ' od ' + Math.max(totalPages, 1);
            document.getElementById('primaci-admin-odjeli-prev').disabled = primaciAdminOdjeliPage === 0;
            document.getElementById('primaci-admin-odjeli-next').disabled = primaciAdminOdjeliPage >= totalPages - 1;
        }

        function prevPagePrimaciAdminOdjeli() {
            if (primaciAdminOdjeliPage > 0) {
                primaciAdminOdjeliPage--;
                renderPrimaciAdminOdjeliPage();
            }
        }

        function nextPagePrimaciAdminOdjeli() {
            if (!primaciAdminOdjeliData) return;
            var totalPages = Math.ceil(primaciAdminOdjeliData.odjeli.length / primaciAdminOdjeliPageSize);
            if (primaciAdminOdjeliPage < totalPages - 1) {
                primaciAdminOdjeliPage++;
                renderPrimaciAdminOdjeliPage();
            }
        }

        // ========================================
        // DEFAULT PREGLED PO ODJELIMA (bez izbora primača)
        // ========================================
        async function loadOdjeliDefaultView() {
            var loadingEl = document.getElementById('primaci-admin-odjeli-default-loading');
            var containerEl = document.getElementById('primaci-admin-odjeli-default-container');
            var paginationEl = document.getElementById('primaci-admin-odjeli-default-pagination');

            if (!containerEl) return;

            try {
                if (!odjeliDefaultData) {
                    if (loadingEl) loadingEl.style.display = '';
                    if (paginationEl) paginationEl.style.display = 'none';
                    containerEl.innerHTML = '';

                    var odjeliUrl = buildApiUrl('odjeli-all');
                    var odjeliData = await fetchWithCache(odjeliUrl, 'cache_odjeli_all');

                    if (odjeliData.error) throw new Error(odjeliData.error);

                    odjeliDefaultData = {
                        odjeli: odjeliData.odjeli || [],
                        sortimentiNazivi: odjeliData.sortimentiNazivi || []
                    };
                    if (loadingEl) loadingEl.style.display = 'none';
                }

                odjeliDefaultPage = 0;
                renderOdjeliDefaultPage();

            } catch (error) {
                if (loadingEl) loadingEl.style.display = 'none';
                containerEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #dc2626;">Greška pri učitavanju: ' + error.message + '</div>';
            }
        }

        // Boje za vizualno razdvajanje odjela
        var odjelBoje = [
            { border: '#10b981', bg: '#f0fdf4', header: '#047857', accent: '#059669' },
            { border: '#3b82f6', bg: '#eff6ff', header: '#1d4ed8', accent: '#2563eb' },
            { border: '#f59e0b', bg: '#fffbeb', header: '#b45309', accent: '#d97706' },
            { border: '#8b5cf6', bg: '#f5f3ff', header: '#6d28d9', accent: '#7c3aed' },
            { border: '#ef4444', bg: '#fef2f2', header: '#b91c1c', accent: '#dc2626' },
            { border: '#06b6d4', bg: '#ecfeff', header: '#0e7490', accent: '#0891b2' }
        ];

        function renderOdjeliDefaultPage() {
            if (!odjeliDefaultData || !odjeliDefaultData.odjeli) return;

            var containerEl = document.getElementById('primaci-admin-odjeli-default-container');
            var paginationEl = document.getElementById('primaci-admin-odjeli-default-pagination');

            var start = odjeliDefaultPage * odjeliDefaultPageSize;
            var end = Math.min(start + odjeliDefaultPageSize, odjeliDefaultData.odjeli.length);
            var pageOdjeli = odjeliDefaultData.odjeli.slice(start, end);

            var html = '';
            pageOdjeli.forEach(function(odjel, idx) {
                var boja = odjelBoje[(start + idx) % odjelBoje.length];
                var primaciArr = odjel.primaci || [];
                var sortNazivi = odjeliDefaultData.sortimentiNazivi;

                // Header sortimenta za tabele
                var sortHeaderCells = sortNazivi.map(function(s) {
                    return '<th class="sortiment-col" style="white-space: nowrap;">' + s + '</th>';
                }).join('');

                // === TABELA 1: Apsolutne vrijednosti - primači kao redovi ===
                var absRows = '';
                primaciArr.forEach(function(p) {
                    var cells = sortNazivi.map(function(s) {
                        var val = (p.sortimenti && p.sortimenti[s]) || 0;
                        return '<td class="sortiment-col">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                    }).join('');
                    absRows += '<tr><td style="white-space: nowrap; font-weight: 500; position: sticky; left: 0; background: white; z-index: 1;">' + p.ime + '</td>' + cells + '</tr>';
                });
                // UKUPNO red
                var totalAbsCells = sortNazivi.map(function(s) {
                    var val = odjel.sortimenti[s] || 0;
                    return '<td class="sortiment-col" style="font-weight: 700;">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                }).join('');
                absRows += '<tr style="background: ' + boja.bg + '; border-top: 2px solid ' + boja.border + ';"><td style="font-weight: 700; position: sticky; left: 0; background: ' + boja.bg + '; z-index: 1;">UKUPNO</td>' +
                    totalAbsCells + '</tr>';

                // === TABELA 2: Procentualni udio - primači kao redovi ===
                // Izračunaj rankove po svakom sortimentu za obojenje (zlato/srebro/bronza)
                var medalBoje = ['#FFD700', '#C0C0C0', '#CD7F32'];
                var pctData = primaciArr.map(function(p) {
                    return sortNazivi.map(function(s) {
                        var pVal = (p.sortimenti && p.sortimenti[s]) || 0;
                        return p.ukupno > 0 ? (pVal / p.ukupno) * 100 : 0;
                    });
                });
                // Za svaku kolonu odredi rang (top 3)
                var colRanks = sortNazivi.map(function(s, colIdx) {
                    var vals = pctData.map(function(row, rowIdx) { return { val: row[colIdx], idx: rowIdx }; })
                        .filter(function(v) { return v.val > 0; })
                        .sort(function(a, b) { return b.val - a.val; });
                    var ranks = {};
                    for (var r = 0; r < Math.min(3, vals.length); r++) {
                        ranks[vals[r].idx] = r;
                    }
                    return ranks;
                });

                var pctRows = '';
                primaciArr.forEach(function(p, pIdx) {
                    var cells = sortNazivi.map(function(s, colIdx) {
                        var pct = pctData[pIdx][colIdx];
                        var rank = colRanks[colIdx][pIdx];
                        var bg = rank !== undefined ? ' background: ' + medalBoje[rank] + ';' : '';
                        return '<td class="sortiment-col" style="' + bg + '">' + (pct > 0 ? pct.toFixed(1) + '%' : '-') + '</td>';
                    }).join('');
                    pctRows += '<tr><td style="white-space: nowrap; font-weight: 500; position: sticky; left: 0; background: white; z-index: 1;">' + p.ime + '</td>' + cells + '</tr>';
                });

                // Zadnji datum
                var zadnjiDatumStr = odjel.zadnjiDatum ? ' \u2022 Zadnja sje\u010Da: ' + odjel.zadnjiDatum : '';

                html += '<div style="margin-bottom: 28px; border: 2px solid ' + boja.border + '; border-radius: 12px; overflow: hidden;">' +
                    // Header odjela
                    '<div style="background: ' + boja.border + '; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">' +
                    '<h3 style="margin: 0; font-size: 18px;">\uD83D\uDCC1 ' + odjel.odjel + '</h3>' +
                    '<div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">' +
                    '<span style="font-size: 13px; opacity: 0.9;">' + zadnjiDatumStr + '</span>' +
                    '<span style="background: rgba(255,255,255,0.25); padding: 4px 14px; border-radius: 6px; font-size: 14px; font-weight: 700;">' + odjel.ukupno.toFixed(2) + ' m\u00B3</span>' +
                    '</div></div>' +
                    '<div style="background: ' + boja.bg + '; padding: 12px;">' +
                    // Tabela 1: Apsolutne vrijednosti sa primačima kao redovima
                    '<h4 style="font-size: 14px; margin: 0 0 8px 0; color: ' + boja.header + ';">Apsolutne vrijednosti (m\u00B3)</h4>' +
                    '<div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 16px;">' +
                    '<table class="kupci-table"><thead><tr><th style="position: sticky; left: 0; background: inherit; z-index: 2;">Prima\u010D</th>' + sortHeaderCells + '</tr></thead>' +
                    '<tbody>' + absRows + '</tbody></table></div>' +
                    // Tabela 2: Procentualni udio sa primačima kao redovima
                    '<h4 style="font-size: 14px; margin: 0 0 8px 0; color: ' + boja.header + ';">Procentualni udio (%)</h4>' +
                    '<div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">' +
                    '<table class="kupci-table odjeli-pct-table"><thead><tr><th style="position: sticky; left: 0; background: inherit; z-index: 2;">Prima\u010D</th>' + sortHeaderCells + '</tr></thead>' +
                    '<tbody>' + pctRows + '</tbody></table></div>' +
                    '</div></div>';
            });

            if (pageOdjeli.length === 0) {
                html = '<div style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka o odjelima.</div>';
            }

            containerEl.innerHTML = html;

            // Pagination
            var totalPages = Math.ceil(odjeliDefaultData.odjeli.length / odjeliDefaultPageSize);
            if (totalPages > 1) {
                paginationEl.style.display = 'flex';
                document.getElementById('primaci-admin-odjeli-default-page-info').textContent = 'Stranica ' + (odjeliDefaultPage + 1) + ' od ' + totalPages;
                document.getElementById('primaci-admin-odjeli-default-prev').disabled = odjeliDefaultPage === 0;
                document.getElementById('primaci-admin-odjeli-default-next').disabled = odjeliDefaultPage >= totalPages - 1;
            } else {
                paginationEl.style.display = 'none';
            }
        }

        function prevPageOdjeliDefault() {
            if (odjeliDefaultPage > 0) {
                odjeliDefaultPage--;
                renderOdjeliDefaultPage();
            }
        }

        function nextPageOdjeliDefault() {
            if (!odjeliDefaultData) return;
            var totalPages = Math.ceil(odjeliDefaultData.odjeli.length / odjeliDefaultPageSize);
            if (odjeliDefaultPage < totalPages - 1) {
                odjeliDefaultPage++;
                renderOdjeliDefaultPage();
            }
        }

        // Load otpremac odjeli data (ZADNJIH 15 ODJELA IZ SVIH GODINA)
        // ✅ OPTIMIZOVANO: Jedan API poziv sa limit=15 (backend procesira sve godine)
        async function loadOtpremacOdjeli() {
            if (!isActiveTab('otpremac-odjeli')) return;
            // Turbo: skip loading screen if cache exists
            if (!localStorage.getItem('cache_otpremac_odjeli_top15')) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('otpremac-odjeli-content').classList.add('hidden');
            } else {
                document.getElementById('otpremac-odjeli-content').classList.remove('hidden');
            }

            try {
                const url = buildApiUrl('otpremac-odjeli', { limit: 15 });
                const data = await fetchWithCache(url, 'cache_otpremac_odjeli_top15');

                if (data.error) {
                    throw new Error(data.error);
                }

                if (!data.odjeli || data.odjeli.length === 0) {
                    throw new Error('Nema podataka o odjelima');
                }

                // Backend već šalje sortiran i limitiran rezultat sa godinom
                otpremacOdjeliData = {
                    odjeli: data.odjeli,
                    sortimentiNazivi: data.sortimentiNazivi || []
                };

                otpremacOdjeliCurrentPage = 0;
                renderOtpremacOdjeliPage();

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('otpremac-odjeli-content').classList.remove('hidden');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju podataka: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }

        function renderOtpremacOdjeliPage() {
            if (!otpremacOdjeliData) return;

            const start = otpremacOdjeliCurrentPage * otpremacOdjeliPageSize;
            const end = Math.min(start + otpremacOdjeliPageSize, otpremacOdjeliData.odjeli.length);
            const pageOdjeli = otpremacOdjeliData.odjeli.slice(start, end);

            let html = '';

            pageOdjeli.forEach(odjel => {
                // Kreiraj HTML za odjel sa dve tabele
                const yearBadge = odjel.godina ? `<span style="background: #fbbf24; color: #78350f; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; margin-left: 10px;">${odjel.godina}</span>` : '';
                html += `
                    <div style="margin-bottom: 40px; border: 2px solid #2563eb; border-radius: 12px; padding: 20px; background: #eff6ff;">
                        <h3 style="color: #1e40af; margin-bottom: 16px;">📁 ${odjel.odjel} ${yearBadge}</h3>
                        <p style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">Zadnji unos: ${odjel.zadnjiDatum || 'N/A'}</p>

                        <!-- Apsolutne vrijednosti -->
                        <h4 style="font-size: 15px; margin-bottom: 8px; color: #2563eb;">Apsolutne vrijednosti (m³)</h4>
                        <div class="kupci-table-wrapper" style="margin-bottom: 20px;">
                            <table class="kupci-table">
                                <thead>
                                    <tr>
                                        ${otpremacOdjeliData.sortimentiNazivi.map(s => `<th class="sortiment-col">${s}</th>`).join('')}
                                        <th class="ukupno-col">Ukupno</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        ${otpremacOdjeliData.sortimentiNazivi.map(s => {
                                            const val = odjel.sortimenti[s] || 0;
                                            return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                                        }).join('')}
                                        <td class="ukupno-col">${odjel.ukupno.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Procentualne vrijednosti -->
                        <h4 style="font-size: 15px; margin-bottom: 8px; color: #2563eb;">Procentualni udio (%)</h4>
                        <div class="kupci-table-wrapper">
                            <table class="kupci-table">
                                <thead>
                                    <tr>
                                        ${otpremacOdjeliData.sortimentiNazivi.map(s => `<th class="sortiment-col">${s}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        ${otpremacOdjeliData.sortimentiNazivi.map(s => {
                                            const val = odjel.sortimenti[s] || 0;
                                            const percent = odjel.ukupno > 0 ? (val / odjel.ukupno) * 100 : 0;
                                            return `<td class="sortiment-col">${percent > 0 ? percent.toFixed(1) + '%' : '-'}</td>`;
                                        }).join('')}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });

            document.getElementById('otpremac-odjeli-container').innerHTML = html;

            // Update pagination controls
            const totalPages = Math.ceil(otpremacOdjeliData.odjeli.length / otpremacOdjeliPageSize);
            document.getElementById('otpremac-odjeli-page-info').textContent = `Stranica ${otpremacOdjeliCurrentPage + 1} od ${totalPages}`;
            document.getElementById('otpremac-odjeli-prev').disabled = otpremacOdjeliCurrentPage === 0;
            document.getElementById('otpremac-odjeli-next').disabled = otpremacOdjeliCurrentPage >= totalPages - 1;
        }

        function prevPageOtpremacOdjeli() {
            if (otpremacOdjeliCurrentPage > 0) {
                otpremacOdjeliCurrentPage--;
                renderOtpremacOdjeliPage();
            }
        }

        function nextPageOtpremacOdjeli() {
            const totalPages = Math.ceil(otpremacOdjeliData.odjeli.length / otpremacOdjeliPageSize);
            if (otpremacOdjeliCurrentPage < totalPages - 1) {
                otpremacOdjeliCurrentPage++;
                renderOtpremacOdjeliPage();
            }
        }

        // ========== MOVED TO js/ui.js ==========
        // ========== DODANI UNOSI VIEW ==========

        // Load Dodani Unosi (Pending entries)
        // Helper to determine column group
        function getColumnGroup(sortiment) {
            const cetinariCols = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'CEL.DUGA', 'CEL.CIJEPANA', 'TRUPCI Č', 'ČETINARI'];
            const liscariCols = ['F/L L', 'I L', 'II L', 'III L', 'OGR.DUGI', 'OGR.CIJEPANI', 'TRUPCI L', 'LIŠĆARI'];

            if (cetinariCols.includes(sortiment)) return 'col-group-cetinari';
            if (liscariCols.includes(sortiment)) return 'col-group-liscari';
            return '';
        }

        // Sort state for pending (admin) table
        var pendingSortCol = null;
        var pendingSortDir = 'asc';

        function getUnosiColGroup(sortiment) {
            var cetinariCols = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'CEL.DUGA', 'CEL.CIJEPANA', 'TRUPCI Č', 'ČETINARI'];
            var liscariCols = ['F/L L', 'I L', 'II L', 'III L', 'OGR.DUGI', 'OGR.CIJEPANI', 'TRUPCI L', 'LIŠĆARI'];
            if (cetinariCols.indexOf(sortiment) !== -1) return 'cg-c';
            if (liscariCols.indexOf(sortiment) !== -1) return 'cg-l';
            return '';
        }

        function sortUnosiData(data, col, dir) {
            var sorted = data.slice();
            sorted.sort(function(a, b) {
                var va, vb;
                if (col === 'tip') { va = a.tip || ''; vb = b.tip || ''; }
                else if (col === 'datum') { va = a.datum || ''; vb = b.datum || ''; }
                else if (col === 'odjel') { va = a.odjel || ''; vb = b.odjel || ''; }
                else if (col === 'radnik') { va = a.radnik || ''; vb = b.radnik || ''; }
                else if (col === 'kupac') { va = a.kupac || ''; vb = b.kupac || ''; }
                else if (col === 'brOtpremnice') { va = a.brojOtpremnice || ''; vb = b.brojOtpremnice || ''; }
                else if (col === 'poslano') { va = a.timestamp || ''; vb = b.timestamp || ''; }
                else if (col.indexOf('sort_') === 0) {
                    var sn = col.substring(5);
                    va = sn === 'SVEUKUPNO' ? (a.ukupno || 0) : ((a.sortimenti && a.sortimenti[sn]) || 0);
                    vb = sn === 'SVEUKUPNO' ? (b.ukupno || 0) : ((b.sortimenti && b.sortimenti[sn]) || 0);
                }
                else { va = ''; vb = ''; }

                if (typeof va === 'number' && typeof vb === 'number') {
                    return dir === 'asc' ? va - vb : vb - va;
                }
                va = String(va).toLowerCase();
                vb = String(vb).toLowerCase();
                if (va < vb) return dir === 'asc' ? -1 : 1;
                if (va > vb) return dir === 'asc' ? 1 : -1;
                return 0;
            });
            return sorted;
        }

        function unosiSortIcon(col, activeCol, activeDir) {
            if (col === activeCol) {
                return '<span class="sort-icon active">' + (activeDir === 'asc' ? '▲' : '▼') + '</span>';
            }
            return '<span class="sort-icon">⇅</span>';
        }

        // Render pending table with filters
        function renderPendingTable(data) {
            var html = '';

            if (!data || data.length === 0) {
                html = '<p style="text-align: center; padding: 40px; color: #6b7280;">Nema dodanih unosa</p>';
            } else {
                var sortimentiNazivi = data[0] && data[0].sortimenti ? Object.keys(data[0].sortimenti) : [];
                var sc = pendingSortCol, sd = pendingSortDir;

                html = '<div class="unosi-table-wrapper"><table class="unosi-table" id="pending-unosi-table"><thead><tr>';
                html += '<th class="col-freeze-1" style="min-width:80px" data-sort="tip">Tip' + unosiSortIcon('tip', sc, sd) + '</th>';
                html += '<th class="col-freeze-2" style="min-width:95px" data-sort="datum">Datum' + unosiSortIcon('datum', sc, sd) + '</th>';
                html += '<th data-sort="odjel">Odjel' + unosiSortIcon('odjel', sc, sd) + '</th>';
                html += '<th data-sort="radnik">Radnik' + unosiSortIcon('radnik', sc, sd) + '</th>';
                html += '<th data-sort="kupac">Kupac' + unosiSortIcon('kupac', sc, sd) + '</th>';
                html += '<th data-sort="brOtpremnice">Br. otpr.' + unosiSortIcon('brOtpremnice', sc, sd) + '</th>';
                html += '<th style="min-width:50px">Slika</th>';

                for (var i = 0; i < sortimentiNazivi.length; i++) {
                    var cg = getUnosiColGroup(sortimentiNazivi[i]);
                    var sk = 'sort_' + sortimentiNazivi[i];
                    html += '<th class="sort-col ' + cg + '" data-sort="' + sk + '">' + sortimentiNazivi[i] + unosiSortIcon(sk, sc, sd) + '</th>';
                }

                html += '<th data-sort="poslano">Poslano' + unosiSortIcon('poslano', sc, sd) + '</th>';
                html += '<th style="min-width:50px;cursor:default"></th>';
                html += '</tr></thead><tbody>';

                for (var i = 0; i < data.length; i++) {
                    var unos = data[i];
                    var badgeClass = unos.tip === 'SJEČA' ? 'badge-sjeca' : 'badge-otprema';

                    html += '<tr>';
                    html += '<td class="col-freeze-1"><span class="badge-tip ' + badgeClass + '">' + unos.tip + '</span></td>';
                    html += '<td class="col-freeze-2 cell-datum">' + unos.datum + '</td>';
                    html += '<td class="cell-odjel">' + unos.odjel + '</td>';
                    html += '<td>' + unos.radnik + '</td>';
                    html += '<td>' + (unos.kupac || '-') + '</td>';
                    html += '<td>' + (unos.brojOtpremnice || '-') + '</td>';

                    if (unos.imageUrl) {
                        html += '<td style="text-align:center;padding:4px;">';
                        html += '<a href="' + unos.imageUrl + '" target="_blank" title="Klikni za veću sliku">';
                        html += '<img src="' + unos.imageUrl + '" alt="Slika" style="max-width:50px;max-height:38px;border-radius:3px;cursor:pointer;border:1px solid #e5e7eb;object-fit:cover;" onerror="this.style.display=\'none\'; this.parentNode.innerHTML=\'-\'">';
                        html += '</a></td>';
                    } else {
                        html += '<td style="text-align:center;color:#ccc;">-</td>';
                    }

                    for (var j = 0; j < sortimentiNazivi.length; j++) {
                        var sortiment = sortimentiNazivi[j];
                        var val = sortiment === 'SVEUKUPNO' ? unos.ukupno : (unos.sortimenti[sortiment] || 0);
                        var displayVal = val > 0 ? val.toFixed(2) : '-';
                        var cg2 = getUnosiColGroup(sortiment);
                        html += '<td class="sort-col ' + cg2 + '">' + displayVal + '</td>';
                    }

                    html += '<td class="cell-timestamp">' + unos.timestamp + '</td>';

                    html += '<td>';
                    html += '<div class="row-actions">';
                    html += '<button class="row-actions-btn" onclick="toggleRowActions(' + unos.id + ')">⋮</button>';
                    html += '<div class="row-actions-dropdown" id="row-actions-' + unos.id + '">';
                    html += '<div class="row-actions-item" onclick="editPendingUnos(' + unos.id + ', \'' + unos.tip + '\')">Uredi</div>';
                    html += '<div class="row-actions-item danger" onclick="deletePendingUnos(' + unos.id + ', \'' + unos.tip + '\')">Obriši</div>';
                    html += '</div>';
                    html += '</div>';
                    html += '</td>';

                    html += '</tr>';
                }

                html += '</tbody></table>';

                // Summary bar
                var sjecaCount = 0, otpremaCount = 0;
                for (var k = 0; k < data.length; k++) {
                    if (data[k].tip === 'SJEČA') sjecaCount++;
                    else if (data[k].tip === 'OTPREMA') otpremaCount++;
                }
                html += '<div class="unosi-summary">';
                html += '<strong>' + data.length + '</strong> unosa';
                html += '<span class="badge-tip badge-sjeca">' + sjecaCount + ' sječa</span>';
                html += '<span class="badge-tip badge-otprema">' + otpremaCount + ' otprema</span>';
                html += '</div>';
                html += '</div>';
            }

            document.getElementById('pending-unosi-container').innerHTML = html;

            // Attach sort handlers
            var table = document.getElementById('pending-unosi-table');
            if (table) {
                var ths = table.querySelectorAll('thead th[data-sort]');
                for (var t = 0; t < ths.length; t++) {
                    ths[t].addEventListener('click', function() {
                        var col = this.getAttribute('data-sort');
                        if (pendingSortCol === col) {
                            pendingSortDir = pendingSortDir === 'asc' ? 'desc' : 'asc';
                        } else {
                            pendingSortCol = col;
                            pendingSortDir = 'asc';
                        }
                        var sorted = sortUnosiData(data, pendingSortCol, pendingSortDir);
                        renderPendingTable(sorted);
                    });
                }
            }
        }

        async function loadPendingUnosi() {
            if (!isActiveTab('pending-unosi')) return;
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('pending-unosi-content').classList.add('hidden');

            try {
                const year = new Date().getFullYear();
                const url = buildApiUrl('pending-unosi', { year });

                // Don't cache pending entries - always fetch fresh
                const response = await fetch(url);
                const data = await response.json();


                if (data.error) {
                    throw new Error(data.error);
                }

                // Store unfiltered data for filtering
                unfilteredPendingData = data.unosi || [];

                // Update badge count
                updatePendingBadge(unfilteredPendingData.length);

                // Render table
                renderPendingTable(unfilteredPendingData);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('pending-unosi-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading dodani unosi:', error);
                document.getElementById('pending-unosi-container').innerHTML =
                    '<p style="color: #dc2626; text-align: center; padding: 40px;">Greška: ' + error.message + '</p>';
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('pending-unosi-content').classList.remove('hidden');
            }
        }

        // Poslovodja dodani unosi - filtrirano po radilištima
        var unfilteredPoslovodjaUnosiData = [];

        async function loadPoslovodjaUnosi() {
            if (!isActiveTab('poslovodja-unosi')) return;
            // Turbo: skip loading screen if supporting caches exist
            if (!localStorage.getItem('cache_primke_sjeca') || !localStorage.getItem('cache_otpreme_tab')) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('poslovodja-unosi-content').classList.add('hidden');
            } else {
                document.getElementById('poslovodja-unosi-content').classList.remove('hidden');
            }

            try {
                var radilista = getPoslovodjaRadilista();
                document.getElementById('poslovodja-radilista-list-unosi').textContent = radilista.join(', ');
                var userFullName = currentUser.fullName.toUpperCase().trim();

                // Dohvati pending-unosi, primke i otpreme paralelno
                var year = new Date().getFullYear();
                var pendingUrl = buildApiUrl('pending-unosi', { year: year });
                var primkeUrl = buildApiUrl('primke');
                var otpremeUrl = buildApiUrl('otpreme');

                var results = await Promise.all([
                    fetch(pendingUrl).then(function(r) { return r.json(); }),
                    fetchWithCache(primkeUrl, 'cache_primke_sjeca'),
                    fetchWithCache(otpremeUrl, 'cache_otpreme_tab')
                ]);

                var pendingData = results[0];
                var primkeData = results[1];
                var otpremeData = results[2];

                if (pendingData.error) {
                    throw new Error(pendingData.error);
                }

                // Izgradi odjel → radilište mapu iz primki i otprema
                var odjelRadilisteMap = {};
                var allEntries = (primkeData.primke || []).concat(otpremeData.otpreme || []);
                allEntries.forEach(function(entry) {
                    var odjel = (entry.odjel || '').trim();
                    var rad = (entry.radiliste || '').trim();
                    if (odjel && rad && !odjelRadilisteMap[odjel]) {
                        odjelRadilisteMap[odjel] = rad;
                    }
                });

                // Izgradi set odjela koji pripadaju poslovođi (isti pristup kao PREGLED tab)
                var mojiOdjeli = new Set();
                allEntries.forEach(function(entry) {
                    var entryPoslovodja = (entry.poslovodja || '').toUpperCase().trim();
                    var entryRadiliste = (entry.radiliste || '').toUpperCase().trim();
                    var odjel = (entry.odjel || '').trim();
                    if (!odjel) return;

                    // Poslovodja match
                    if (entryPoslovodja && entryPoslovodja === userFullName) {
                        mojiOdjeli.add(odjel);
                        return;
                    }
                    // Radilište match (tačno podudaranje)
                    if (radilista.length > 0 && entryRadiliste) {
                        var matches = radilista.some(function(r) {
                            return entryRadiliste === r.toUpperCase();
                        });
                        if (matches) mojiOdjeli.add(odjel);
                    }
                });

                // Filtriraj unose — samo odjeli koji pripadaju poslovođi
                var allUnosi = pendingData.unosi || [];
                var filtered = allUnosi.filter(function(unos) {
                    var unosOdjel = (unos.odjel || '').trim();
                    return mojiOdjeli.has(unosOdjel);
                });

                unfilteredPoslovodjaUnosiData = filtered;
                renderPoslovodjaUnosiTable(filtered);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-unosi-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa dodani unosi:', error);
                document.getElementById('poslovodja-unosi-container').innerHTML =
                    '<p style="color: #dc2626; text-align: center; padding: 40px;">Greška: ' + error.message + '</p>';
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-unosi-content').classList.remove('hidden');
            }
        }

        // Sort state for poslovodja unosi table
        var poslovodjaSortCol = null;
        var poslovodjaSortDir = 'asc';

        function renderPoslovodjaUnosiTable(data) {
            var html = '';

            if (!data || data.length === 0) {
                html = '<p style="text-align: center; padding: 40px; color: #6b7280;">Nema dodanih unosa za vaša radilišta</p>';
            } else {
                var sortimentiNazivi = data[0] && data[0].sortimenti ? Object.keys(data[0].sortimenti) : [];
                var sc = poslovodjaSortCol, sd = poslovodjaSortDir;

                html = '<div class="unosi-table-wrapper"><table class="unosi-table" id="poslovodja-unosi-table"><thead><tr>';
                html += '<th class="col-freeze-1" style="min-width:80px" data-sort="tip">Tip' + unosiSortIcon('tip', sc, sd) + '</th>';
                html += '<th class="col-freeze-2" style="min-width:95px" data-sort="datum">Datum' + unosiSortIcon('datum', sc, sd) + '</th>';
                html += '<th data-sort="odjel">Odjel' + unosiSortIcon('odjel', sc, sd) + '</th>';
                html += '<th data-sort="radnik">Radnik' + unosiSortIcon('radnik', sc, sd) + '</th>';
                html += '<th data-sort="kupac">Kupac' + unosiSortIcon('kupac', sc, sd) + '</th>';
                html += '<th data-sort="brOtpremnice">Br. otpr.' + unosiSortIcon('brOtpremnice', sc, sd) + '</th>';
                html += '<th style="min-width:50px">Slika</th>';

                for (var i = 0; i < sortimentiNazivi.length; i++) {
                    var cg = getUnosiColGroup(sortimentiNazivi[i]);
                    var sk = 'sort_' + sortimentiNazivi[i];
                    html += '<th class="sort-col ' + cg + '" data-sort="' + sk + '">' + sortimentiNazivi[i] + unosiSortIcon(sk, sc, sd) + '</th>';
                }

                html += '<th data-sort="poslano">Poslano' + unosiSortIcon('poslano', sc, sd) + '</th>';
                html += '</tr></thead><tbody>';

                for (var i = 0; i < data.length; i++) {
                    var unos = data[i];
                    var badgeClass = unos.tip === 'SJEČA' ? 'badge-sjeca' : 'badge-otprema';

                    html += '<tr>';
                    html += '<td class="col-freeze-1"><span class="badge-tip ' + badgeClass + '">' + unos.tip + '</span></td>';
                    html += '<td class="col-freeze-2 cell-datum">' + unos.datum + '</td>';
                    html += '<td class="cell-odjel">' + unos.odjel + '</td>';
                    html += '<td>' + unos.radnik + '</td>';
                    html += '<td>' + (unos.kupac || '-') + '</td>';
                    html += '<td>' + (unos.brojOtpremnice || '-') + '</td>';

                    if (unos.imageUrl) {
                        html += '<td style="text-align:center;padding:4px;">';
                        html += '<a href="' + unos.imageUrl + '" target="_blank" title="Klikni za veću sliku">';
                        html += '<img src="' + unos.imageUrl + '" alt="Slika" style="max-width:50px;max-height:38px;border-radius:3px;cursor:pointer;border:1px solid #e5e7eb;object-fit:cover;" onerror="this.style.display=\'none\'; this.parentNode.innerHTML=\'-\'">';
                        html += '</a></td>';
                    } else {
                        html += '<td style="text-align:center;color:#ccc;">-</td>';
                    }

                    for (var j = 0; j < sortimentiNazivi.length; j++) {
                        var sortiment = sortimentiNazivi[j];
                        var val = sortiment === 'SVEUKUPNO' ? unos.ukupno : (unos.sortimenti[sortiment] || 0);
                        var displayVal = val > 0 ? val.toFixed(2) : '-';
                        var cg2 = getUnosiColGroup(sortiment);
                        html += '<td class="sort-col ' + cg2 + '">' + displayVal + '</td>';
                    }

                    html += '<td class="cell-timestamp">' + unos.timestamp + '</td>';
                    html += '</tr>';
                }

                html += '</tbody></table>';

                // Summary bar
                var sjecaCount = 0, otpremaCount = 0;
                for (var k = 0; k < data.length; k++) {
                    if (data[k].tip === 'SJEČA') sjecaCount++;
                    else if (data[k].tip === 'OTPREMA') otpremaCount++;
                }
                html += '<div class="unosi-summary">';
                html += '<strong>' + data.length + '</strong> unosa';
                html += '<span class="badge-tip badge-sjeca">' + sjecaCount + ' sječa</span>';
                html += '<span class="badge-tip badge-otprema">' + otpremaCount + ' otprema</span>';
                html += '</div>';
                html += '</div>';
            }

            document.getElementById('poslovodja-unosi-container').innerHTML = html;

            // Attach sort handlers
            var table = document.getElementById('poslovodja-unosi-table');
            if (table) {
                var ths = table.querySelectorAll('thead th[data-sort]');
                for (var t = 0; t < ths.length; t++) {
                    ths[t].addEventListener('click', function() {
                        var col = this.getAttribute('data-sort');
                        if (poslovodjaSortCol === col) {
                            poslovodjaSortDir = poslovodjaSortDir === 'asc' ? 'desc' : 'asc';
                        } else {
                            poslovodjaSortCol = col;
                            poslovodjaSortDir = 'asc';
                        }
                        var sorted = sortUnosiData(data, poslovodjaSortCol, poslovodjaSortDir);
                        renderPoslovodjaUnosiTable(sorted);
                    });
                }
            }
        }

        // Load monthly sortimenti
        async function loadMjesecniSortimenti() {
            if (!isActiveTab('mjesecni-sortimenti')) return;
            const year = new Date().getFullYear();
            const msCacheKey = `cache_mjesecni_sortimenti_${year}`;

            // Turbo: instant show cached data
            var msCached = turboShow(msCacheKey, 'mjesecni-sortimenti-content', function(d) { return d.sjeca && d.otprema; });
            var msHasCached = false;
            if (msCached) {
                renderMjesecnaTabela(msCached.sjeca, 'mjesecna-sjeca');
                renderMjesecnaTabela(msCached.otprema, 'mjesecna-otprema');
                msHasCached = true;
            }

            if (!msHasCached) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('mjesecni-sortimenti-content').classList.add('hidden');
            }

            try {
                const url = buildApiUrl('mjesecni-sortimenti', { year });

                const data = await fetchWithCache(url, msCacheKey);


                if (data.error) {
                    throw new Error(data.error);
                }

                if (!data.sjeca || !data.otprema) {
                    throw new Error('Invalid data format received from server');
                }

                // Render SJEČA table
                renderMjesecnaTabela(data.sjeca, 'mjesecna-sjeca');

                // Render OTPREMA table
                renderMjesecnaTabela(data.otprema, 'mjesecna-otprema');

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('mjesecni-sortimenti-content').classList.remove('hidden');
                markTabRendered('mjesecni-sortimenti');

            } catch (error) {
                console.error('Error loading mjesečni sortimenti:', error);
                showError('Greška', 'Greška pri učitavanju mjesečnih podataka: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('mjesecni-sortimenti-content').classList.remove('hidden');
            }
        }

        // Render monthly table (SJEČA or OTPREMA) - PRO LEVEL with Comfortaa font
        function renderMjesecnaTabela(data, tableId) {

            const headerElem = document.getElementById(tableId + '-header');
            const bodyElem = document.getElementById(tableId + '-body');

            if (!headerElem || !bodyElem) {
                console.error('Table elements not found for tableId:', tableId);
                return;
            }

            if (!data || !data.sortimenti || data.sortimenti.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280; font-family: Comfortaa, sans-serif;">Nema podataka</td></tr>';
                return;
            }

            if (!data.mjeseci || !Array.isArray(data.mjeseci) || data.mjeseci.length !== 12) {
                console.error('Invalid mjeseci data for table:', tableId, data.mjeseci);
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #dc2626; font-family: Comfortaa, sans-serif;">Greška u formatu podataka</td></tr>';
                return;
            }

            const sortimenti = data.sortimenti.filter(s => s && s.trim() !== '');
            const mjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

            // Četinari sortimenti (plava grupa)
            const cetinariSortimenti = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'CEL.DUGA', 'CEL.CIJEPANA', 'ŠKART'];
            const cetinariTrupci = ['TRUPCI Č'];
            const cetinariUkupno = ['Σ ČETINARI', 'ČETINARI'];

            // Lišćari sortimenti (žuta/narandžasta grupa)
            const liscariSortimenti = ['F/L L', 'I L', 'II L', 'III L', 'OGR.DUGI', 'OGR.CIJEPANI', 'GULE'];
            const liscariTrupci = ['TRUPCI L', 'TRUPCI'];
            const liscariUkupno = ['LIŠĆARI'];

            // Grand total
            const grandTotal = ['SVEUKUPNO', 'UKUPNO Č+L'];

            // Build header - PRO STYLE with Comfortaa
            let headerHtml = '<tr style="background: #1e3a5f;">';
            headerHtml += '<th style="font-family: Comfortaa, sans-serif; min-width: 80px; position: sticky; left: 0; background: #1e3a5f; color: white; z-index: 20; font-size: 13px; font-weight: 700; padding: 12px 8px; text-align: center; border: 1px solid #374151; border-right: 2px solid #60a5fa;">MJESEC</th>';

            for (let i = 0; i < sortimenti.length; i++) {
                const s = sortimenti[i];
                let bgColor = '#1e3a5f';
                let borderColor = '#374151';

                // Header colors by group
                if (cetinariSortimenti.includes(s)) {
                    bgColor = '#1e40af'; // Plava
                } else if (cetinariTrupci.includes(s)) {
                    bgColor = '#1e3a8a'; // Tamnija plava za TRUPCI
                } else if (cetinariUkupno.includes(s)) {
                    bgColor = '#172554'; // Najtamnija plava za UKUPNO ČETINARI
                    borderColor = '#1e3a8a';
                } else if (liscariSortimenti.includes(s)) {
                    bgColor = '#b45309'; // Narandžasta
                } else if (liscariTrupci.includes(s)) {
                    bgColor = '#92400e'; // Tamnija narandžasta za TRUPCI
                } else if (liscariUkupno.includes(s)) {
                    bgColor = '#78350f'; // Najtamnija za UKUPNO LIŠĆARI
                    borderColor = '#92400e';
                } else if (grandTotal.includes(s)) {
                    bgColor = '#7f1d1d'; // Crvena za SVEUKUPNO
                    borderColor = '#991b1b';
                }

                headerHtml += `<th style="font-family: Comfortaa, sans-serif; background: ${bgColor}; color: white; border: 1px solid ${borderColor}; min-width: 65px; padding: 12px 6px; font-size: 12px; font-weight: 600; text-align: center; white-space: nowrap;">${s}</th>`;
            }
            headerHtml += '</tr>';
            headerElem.innerHTML = headerHtml;

            // Build body - 12 months + UKUPNO + %UDIO
            let bodyHtml = '';
            const totals = {};

            // Month rows - PRO STYLE with Comfortaa font and group colors
            for (let m = 0; m < 12; m++) {
                const rowBg = m % 2 === 0 ? 'white' : '#f8fafc';
                bodyHtml += `<tr style="background: ${rowBg};">`;
                bodyHtml += `<td style="font-family: Comfortaa, sans-serif; font-weight: 700; font-size: 14px; min-width: 80px; position: sticky; left: 0; background: ${rowBg}; z-index: 9; border: 1px solid #d1d5db; border-right: 2px solid #60a5fa; text-align: center; padding: 10px 8px; color: #1e3a5f;">${mjeseci[m]}</td>`;

                for (let s = 0; s < sortimenti.length; s++) {
                    const sortiment = sortimenti[s];
                    const value = data.mjeseci[m][sortiment] || 0;
                    const displayVal = value.toFixed(2);

                    // Base style with Comfortaa font
                    let cellStyle = 'font-family: Comfortaa, sans-serif; padding: 10px 6px; font-size: 13px; min-width: 65px; text-align: right; border: 1px solid #d1d5db;';

                    // Color grouping
                    if (cetinariSortimenti.includes(sortiment)) {
                        // Četinari - svijetlo plava
                        cellStyle += ' background: #dbeafe;';
                        cellStyle += value > 0 ? ' color: #1e40af; font-weight: 600;' : ' color: #93c5fd; font-weight: 400;';
                    } else if (cetinariTrupci.includes(sortiment)) {
                        // Četinari TRUPCI - tamnija plava
                        cellStyle += ' background: #bfdbfe;';
                        cellStyle += value > 0 ? ' color: #1e3a8a; font-weight: 700;' : ' color: #60a5fa; font-weight: 400;';
                    } else if (cetinariUkupno.includes(sortiment)) {
                        // Četinari UKUPNO - najtamnija plava
                        cellStyle += ' background: #93c5fd;';
                        cellStyle += value > 0 ? ' color: #172554; font-weight: 800;' : ' color: #3b82f6; font-weight: 400;';
                    } else if (liscariSortimenti.includes(sortiment)) {
                        // Lišćari - svijetlo žuta/narandžasta
                        cellStyle += ' background: #fef3c7;';
                        cellStyle += value > 0 ? ' color: #92400e; font-weight: 600;' : ' color: #fcd34d; font-weight: 400;';
                    } else if (liscariTrupci.includes(sortiment)) {
                        // Lišćari TRUPCI - tamnija narandžasta
                        cellStyle += ' background: #fde68a;';
                        cellStyle += value > 0 ? ' color: #78350f; font-weight: 700;' : ' color: #f59e0b; font-weight: 400;';
                    } else if (liscariUkupno.includes(sortiment)) {
                        // Lišćari UKUPNO - najtamnija narandžasta
                        cellStyle += ' background: #fcd34d;';
                        cellStyle += value > 0 ? ' color: #78350f; font-weight: 800;' : ' color: #b45309; font-weight: 400;';
                    } else if (grandTotal.includes(sortiment)) {
                        // SVEUKUPNO - crvena
                        cellStyle += ' background: #fecaca;';
                        cellStyle += value > 0 ? ' color: #7f1d1d; font-weight: 800;' : ' color: #f87171; font-weight: 400;';
                    } else {
                        // Default
                        cellStyle += value > 0 ? ' color: #1f2937; font-weight: 500;' : ' color: #9ca3af; font-weight: 400;';
                    }

                    bodyHtml += `<td style="${cellStyle}">${displayVal}</td>`;

                    if (!totals[sortiment]) totals[sortiment] = 0;
                    totals[sortiment] += value;
                }

                bodyHtml += '</tr>';
            }

            // UKUPNO row - PRO STYLE with Comfortaa
            bodyHtml += '<tr style="background: #1e3a5f;">';
            bodyHtml += '<td style="font-family: Comfortaa, sans-serif; min-width: 80px; position: sticky; left: 0; background: #1e3a5f; color: white; z-index: 9; border: 1px solid #374151; border-right: 2px solid #60a5fa; text-align: center; font-size: 13px; font-weight: 700; padding: 12px 8px;">📊 UKUPNO</td>';
            for (let s = 0; s < sortimenti.length; s++) {
                const sortiment = sortimenti[s];
                const total = totals[sortiment] || 0;
                let cellBg = '#e5e7eb';
                let textColor = '#1f2937';

                // Color grouping for totals
                if (cetinariSortimenti.includes(sortiment)) {
                    cellBg = '#93c5fd';
                    textColor = '#1e3a8a';
                } else if (cetinariTrupci.includes(sortiment)) {
                    cellBg = '#60a5fa';
                    textColor = '#172554';
                } else if (cetinariUkupno.includes(sortiment)) {
                    cellBg = '#3b82f6';
                    textColor = '#ffffff';
                } else if (liscariSortimenti.includes(sortiment)) {
                    cellBg = '#fcd34d';
                    textColor = '#78350f';
                } else if (liscariTrupci.includes(sortiment)) {
                    cellBg = '#f59e0b';
                    textColor = '#78350f';
                } else if (liscariUkupno.includes(sortiment)) {
                    cellBg = '#d97706';
                    textColor = '#ffffff';
                } else if (grandTotal.includes(sortiment)) {
                    cellBg = '#ef4444';
                    textColor = '#ffffff';
                }

                bodyHtml += `<td style="font-family: Comfortaa, sans-serif; font-weight: 800; font-size: 14px; padding: 12px 6px; background: ${cellBg}; min-width: 65px; text-align: right; border: 1px solid #9ca3af; color: ${textColor};">${total.toFixed(2)}</td>`;
            }
            bodyHtml += '</tr>';

            // % UČEŠĆE row - PRO STYLE with Comfortaa
            const cetinariTotalPct = totals['Σ ČETINARI'] || totals['ČETINARI'] || 0;
            const liscariTotalPct = totals['LIŠĆARI'] || 0;
            const grandTotalPct = totals['SVEUKUPNO'] || totals['UKUPNO Č+L'] || 0;

            bodyHtml += '<tr style="background: #f1f5f9;">';
            bodyHtml += '<td style="font-family: Comfortaa, sans-serif; min-width: 80px; position: sticky; left: 0; background: #f1f5f9; z-index: 9; border: 1px solid #d1d5db; border-right: 2px solid #60a5fa; text-align: center; font-size: 13px; font-weight: 700; padding: 10px 8px; color: #475569; font-style: italic;">% UČEŠĆE</td>';

            for (let s = 0; s < sortimenti.length; s++) {
                const sortiment = sortimenti[s];
                const total = totals[sortiment] || 0;
                let cellBg = '#f1f5f9';
                let percentage = '0.0';

                // Calculate percentage based on group
                if (cetinariSortimenti.includes(sortiment) || cetinariTrupci.includes(sortiment)) {
                    percentage = cetinariTotalPct > 0 ? ((total / cetinariTotalPct) * 100).toFixed(1) : '0.0';
                    cellBg = '#dbeafe';
                } else if (cetinariUkupno.includes(sortiment)) {
                    percentage = grandTotalPct > 0 ? ((total / grandTotalPct) * 100).toFixed(1) : '0.0';
                    cellBg = '#93c5fd';
                } else if (liscariSortimenti.includes(sortiment) || liscariTrupci.includes(sortiment)) {
                    percentage = liscariTotalPct > 0 ? ((total / liscariTotalPct) * 100).toFixed(1) : '0.0';
                    cellBg = '#fef3c7';
                } else if (liscariUkupno.includes(sortiment)) {
                    percentage = grandTotalPct > 0 ? ((total / grandTotalPct) * 100).toFixed(1) : '0.0';
                    cellBg = '#fcd34d';
                } else if (grandTotal.includes(sortiment)) {
                    percentage = '100.0';
                    cellBg = '#fecaca';
                }

                bodyHtml += `<td style="font-family: Comfortaa, sans-serif; font-weight: 600; font-size: 13px; padding: 10px 6px; background: ${cellBg}; min-width: 65px; text-align: right; border: 1px solid #d1d5db; color: #64748b; font-style: italic;">${percentage}%</td>`;
            }
            bodyHtml += '</tr>';

            bodyElem.innerHTML = bodyHtml;
        }


        // Sub-tab switching za primača
        function switchPrimacIzvjestajiSubTab(subTab) {
            const subTabs = document.querySelectorAll('#izvjestaji-primac-content .sub-tab');
            subTabs.forEach(tab => tab.classList.remove('active'));

            document.getElementById('primac-sedmicni-izvjestaj').classList.add('hidden');
            document.getElementById('primac-mjesecni-izvjestaj').classList.add('hidden');

            if (subTab === 'sedmicni') {
                document.querySelector('#izvjestaji-primac-content .sub-tab[onclick*="sedmicni"]').classList.add('active');
                document.getElementById('primac-sedmicni-izvjestaj').classList.remove('hidden');
                loadPrimacSedmicni();
            } else if (subTab === 'mjesecni') {
                document.querySelector('#izvjestaji-primac-content .sub-tab[onclick*="mjesecni"]').classList.add('active');
                document.getElementById('primac-mjesecni-izvjestaj').classList.remove('hidden');
                loadPrimacMjesecni();
            }
        }

        // Sub-tab switching za otpremača
        function switchOtpremacIzvjestajiSubTab(subTab) {
            const subTabs = document.querySelectorAll('#izvjestaji-otpremac-content .sub-tab');
            subTabs.forEach(tab => tab.classList.remove('active'));

            document.getElementById('otpremac-sedmicni-izvjestaj').classList.add('hidden');
            document.getElementById('otpremac-mjesecni-izvjestaj').classList.add('hidden');

            if (subTab === 'sedmicni') {
                document.querySelector('#izvjestaji-otpremac-content .sub-tab[onclick*="sedmicni"]').classList.add('active');
                document.getElementById('otpremac-sedmicni-izvjestaj').classList.remove('hidden');
                loadOtpremacSedmicni();
            } else if (subTab === 'mjesecni') {
                document.querySelector('#izvjestaji-otpremac-content .sub-tab[onclick*="mjesecni"]').classList.add('active');
                document.getElementById('otpremac-mjesecni-izvjestaj').classList.remove('hidden');
                loadOtpremacMjesecni();
            }
        }

        // ========================================
        // SEDMIČNI IZVJEŠTAJI - Functions
        // ========================================

        async function loadSedmicniIzvjestajSjeca() {
            var ssYear = document.getElementById('sedmicni-sjeca-year-select').value;
            var ssMonth = document.getElementById('sedmicni-sjeca-month-select').value;
            var ssCK = `cache_sedmicni_sjeca_${ssYear}_${ssMonth}`;
            if (!localStorage.getItem(ssCK)) {
                document.getElementById('loading-screen').classList.remove('hidden');
            }

            try {
                const year = ssYear;
                const month = ssMonth;

                const primkaUrl = buildApiUrl('primaci-daily', { year, month });
                const primkaData = await fetchWithCache(primkaUrl, ssCK);

                if (primkaData.error) throw new Error('Primka: ' + primkaData.error);

                // Group by weeks (within month boundaries)
                const weeklyData = groupDataByWeeks(primkaData.data, year, month, primkaData.sortimentiNazivi);

                // Render
                renderSedmicniIzvjestaj(weeklyData, primkaData.sortimentiNazivi, 'sedmicni-sjeca-container', year, month);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading sedmični izvještaj sječe:', error);
                showError('Greška', 'Greška pri učitavanju sedmičnog izvještaja: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        async function loadSedmicniIzvjestajOtprema() {
            var soYear = document.getElementById('sedmicni-otprema-year-select').value;
            var soMonth = document.getElementById('sedmicni-otprema-month-select').value;
            var soCK = `cache_sedmicni_otprema_${soYear}_${soMonth}`;
            if (!localStorage.getItem(soCK)) {
                document.getElementById('loading-screen').classList.remove('hidden');
            }

            try {
                const year = soYear;
                const month = soMonth;

                const otpremaUrl = buildApiUrl('otpremaci-daily', { year, month });
                const otpremaData = await fetchWithCache(otpremaUrl, soCK);

                if (otpremaData.error) throw new Error('Otprema: ' + otpremaData.error);

                // Group by weeks (within month boundaries)
                const weeklyData = groupDataByWeeks(otpremaData.data, year, month, otpremaData.sortimentiNazivi);

                // Render
                renderSedmicniIzvjestaj(weeklyData, otpremaData.sortimentiNazivi, 'sedmicni-otprema-container', year, month);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading sedmični izvještaj otpreme:', error);
                showError('Greška', 'Greška pri učitavanju sedmičnog izvještaja: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Group data by weeks (sedmice se ne prelaze preko granica mjeseca)
        function groupDataByWeeks(data, year, month, sortimentiNazivi) {
            const weeks = [];
            const weeksMap = new Map();

            // Parse year and month
            const y = parseInt(year);
            const m = parseInt(month);

            data.forEach(row => {
                // Parse datum (expecting DD/MM/YYYY format)
                const datumStr = row.datum;
                const dateParts = datumStr.split(/[\/\.\-]/);
                const day = parseInt(dateParts[0]);
                const recordMonth = parseInt(dateParts[1]) - 1;
                const recordYear = parseInt(dateParts[2]);

                // Skip if not in selected month
                if (recordYear !== y || recordMonth !== m) return;

                const datum = new Date(recordYear, recordMonth, day);

                // Get week number within the month
                const weekInfo = getWeekWithinMonth(datum, y, m);
                const weekKey = weekInfo.weekNumber;

                if (!weeksMap.has(weekKey)) {
                    weeksMap.set(weekKey, {
                        weekNumber: weekKey,
                        weekStart: weekInfo.weekStart,
                        weekEnd: weekInfo.weekEnd,
                        odjeliMap: {}
                    });
                }

                const week = weeksMap.get(weekKey);
                // ✅ Convert odjel to string to prevent "localeCompare/includes is not a function" errors
                const odjel = String(row.odjel || '');

                if (!week.odjeliMap[odjel]) {
                    week.odjeliMap[odjel] = {};
                    sortimentiNazivi.forEach(s => week.odjeliMap[odjel][s] = 0);
                }

                sortimentiNazivi.forEach(sortiment => {
                    const value = parseFloat(row.sortimenti[sortiment]) || 0;
                    week.odjeliMap[odjel][sortiment] += value;
                });
            });

            // Convert Map to Array and sort by week number
            weeksMap.forEach(week => weeks.push(week));
            weeks.sort((a, b) => a.weekNumber - b.weekNumber);

            return weeks;
        }

        // Get week number within month (kalendarske sedmice - ponedjeljak do nedjelje)
        // Sedmica 1: od 1. u mjesecu do prve nedjelje
        // Naredne sedmice: od ponedjeljka do nedjelje
        // Zadnja sedmica: od ponedjeljka do zadnjeg dana mjeseca
        function getWeekWithinMonth(date, year, month) {
            // Clone date to avoid mutation
            const d = new Date(date.getTime());

            // Get first day of month
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const firstDayOfWeek = firstDay.getDay(); // 0=Sunday, 1=Monday, ...

            // Generate all calendar weeks for the month
            const weeks = [];
            let currentWeekStart = new Date(firstDay);
            let weekNumber = 1;

            while (currentWeekStart <= lastDay && currentWeekStart.getMonth() === month) {
                let currentWeekEnd;

                if (weekNumber === 1) {
                    // First week: from 1st day to first Sunday
                    if (firstDayOfWeek === 0) {
                        // If month starts on Sunday, week 1 is just that day
                        currentWeekEnd = new Date(currentWeekStart);
                    } else {
                        // Calculate days until Sunday (0)
                        const daysUntilSunday = (7 - firstDayOfWeek) % 7;
                        currentWeekEnd = new Date(currentWeekStart);
                        currentWeekEnd.setDate(currentWeekEnd.getDate() + daysUntilSunday);
                    }
                } else {
                    // Subsequent weeks: from Monday to Sunday
                    currentWeekEnd = new Date(currentWeekStart);
                    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6); // +6 days = Sunday
                }

                // Ensure week doesn't go beyond month
                if (currentWeekEnd > lastDay) {
                    currentWeekEnd = new Date(lastDay);
                }

                weeks.push({
                    weekNumber: weekNumber,
                    start: new Date(currentWeekStart),
                    end: new Date(currentWeekEnd)
                });

                // Move to next Monday
                currentWeekStart = new Date(currentWeekEnd);
                currentWeekStart.setDate(currentWeekStart.getDate() + 1);

                // If we've gone beyond the month, stop
                if (currentWeekStart.getMonth() !== month) {
                    break;
                }

                weekNumber++;
            }

            // Find which week the given date belongs to
            for (const week of weeks) {
                if (d >= week.start && d <= week.end) {
                    return {
                        weekNumber: week.weekNumber,
                        weekStart: formatDateDDMMYYYY(week.start),
                        weekEnd: formatDateDDMMYYYY(week.end)
                    };
                }
            }

            // Fallback: return week 1
            return {
                weekNumber: 1,
                weekStart: formatDateDDMMYYYY(firstDay),
                weekEnd: formatDateDDMMYYYY(lastDay)
            };
        }

        // Format date as DD/MM/YYYY
        function formatDateDDMMYYYY(date) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return day + '/' + month + '/' + year;
        }

        // Render sedmični izvještaj (multiple tables, one per week)
        function renderSedmicniIzvjestaj(weeks, sortimentiNazivi, containerId, year, month) {
            const container = document.getElementById(containerId);
            const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

            if (weeks.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za odabrani mjesec</div>';
                return;
            }

            let html = '';

            // Show all weeks in the month, sorted from newest to oldest (reverse chronological)
            const visibleWeeks = weeks.slice().reverse();

            visibleWeeks.forEach(week => {
                // Convert odjeliMap to array
                const odjeliArray = [];
                for (const odjel in week.odjeliMap) {
                    odjeliArray.push({
                        odjel: odjel,
                        sortimenti: week.odjeliMap[odjel]
                    });
                }
                odjeliArray.sort((a, b) => a.odjel.localeCompare(b.odjel));

                // Week container with header
                html += '<div class="izvjestaj-week-container">';
                html += '<div class="izvjestaj-week-header">';
                html += '<h3>📅 Sedmica ' + week.weekNumber + '</h3>';
                html += '<div class="week-dates">' + week.weekStart + ' - ' + week.weekEnd + '</div>';
                html += '</div>';

                if (odjeliArray.length === 0) {
                    html += '<div class="izvjestaj-empty-week">Nema podataka za ovu sedmicu</div>';
                } else {
                    html += '<div style="overflow-x: auto;"><table class="izvjestaj-week-table">';

                    // Header
                    html += '<thead><tr><th>Odjel</th>';
                    sortimentiNazivi.forEach(sortiment => {
                        let extraClass = '';
                        if (sortiment === 'ČETINARI') extraClass = ' col-cetinari';
                        else if (sortiment === 'LIŠĆARI') extraClass = ' col-liscari';
                        else if (sortiment === 'SVEUKUPNO') extraClass = ' col-sveukupno';

                        html += '<th class="' + extraClass + '">' + sortiment + '</th>';
                    });
                    html += '</tr></thead>';

                    // Body
                    html += '<tbody>';
                    const totals = {};
                    sortimentiNazivi.forEach(s => totals[s] = 0);

                    odjeliArray.forEach((row) => {
                        html += '<tr>';
                        html += '<td>' + row.odjel + '</td>';

                        sortimentiNazivi.forEach(sortiment => {
                            const value = row.sortimenti[sortiment] || 0;
                            totals[sortiment] += value;

                            let extraClass = '';
                            if (sortiment === 'ČETINARI') extraClass = ' col-cetinari';
                            else if (sortiment === 'LIŠĆARI') extraClass = ' col-liscari';
                            else if (sortiment === 'SVEUKUPNO') extraClass = ' col-sveukupno';

                            const displayValue = value === 0 ? '-' : value.toFixed(2);
                            html += '<td class="' + extraClass + '">' + displayValue + '</td>';
                        });

                        html += '</tr>';
                    });

                    // UKUPNO row
                    html += '<tr class="totals-row">';
                    html += '<td>📊 UKUPNO</td>';

                    sortimentiNazivi.forEach(sortiment => {
                        let extraClass = '';
                        if (sortiment === 'ČETINARI') extraClass = ' col-cetinari';
                        else if (sortiment === 'LIŠĆARI') extraClass = ' col-liscari';
                        else if (sortiment === 'SVEUKUPNO') extraClass = ' col-sveukupno';

                        // ✅ FIX: For SVEUKUPNO, only sum ČETINARI + LIŠĆARI (not all columns)
                        let totalValue = totals[sortiment];
                        if (sortiment === 'SVEUKUPNO') {
                            totalValue = (totals['ČETINARI'] || 0) + (totals['LIŠĆARI'] || 0);
                        }

                        html += '<td class="' + extraClass + '">' + totalValue.toFixed(2) + '</td>';
                    });

                    html += '</tr>';
                    html += '</tbody></table></div>';
                }

                html += '</div>'; // close izvjestaj-week-container
            });

            container.innerHTML = html;
        }

        // ========================================
        // STANJE ODJELA - Trenutno stanje iz fajla ODJELI
        // ========================================

        // Globalne varijable za stanje odjela
        let stanjeOdjelaData = [];
        let stanjeOdjelaSortimenti = [];

        async function loadStanjeOdjela() {
            // Turbo: instant show cached data
            var soCached = turboShow('cache_stanje_odjela', 'operativa-content', function(d) { return d.data; });
            var soHasCached = false;
            if (soCached) {
                stanjeOdjelaData = soCached.data;
                stanjeOdjelaSortimenti = soCached.sortimentiNazivi;
                populateStanjeOdjelaDropdown(soCached.data);
                renderStanjeOdjelaSections(soCached.data, soCached.sortimentiNazivi);
                soHasCached = true;
            }

            if (!soHasCached) {
                document.getElementById('loading-screen').classList.remove('hidden');
            }

            try {
                const url = buildApiUrl('stanje-odjela');
                const data = await fetchWithCache(url, `cache_stanje_odjela`);

                if (data.error) throw new Error(data.error);

                // Sačuvaj podatke globalno
                stanjeOdjelaData = data.data;
                stanjeOdjelaSortimenti = data.sortimentiNazivi;

                // Populiši dropdown sa radilištima
                populateStanjeOdjelaDropdown(data.data);

                // Render sections
                renderStanjeOdjelaSections(data.data, data.sortimentiNazivi);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading stanje odjela:', error);
                showError('Greška', 'Greška pri učitavanju stanja odjela: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        function populateStanjeOdjelaDropdown(data) {
            const select = document.getElementById('stanje-odjela-select');

            // Očisti postojeće opcije osim "Sva radilišta"
            select.innerHTML = '<option value="">Sva radilišta</option>';

            // Izvuci unique radilišta
            const radilistaSet = new Set();
            data.forEach(odjel => {
                if (odjel.radiliste) {
                    radilistaSet.add(odjel.radiliste);
                }
            });

            // Sortiraj i dodaj u dropdown
            const radilista = Array.from(radilistaSet).sort();
            radilista.forEach(radiliste => {
                const option = document.createElement('option');
                option.value = radiliste;
                option.textContent = radiliste;
                select.appendChild(option);
            });
        }

        function filterStanjeOdjela() {
            const selectedRadiliste = document.getElementById('stanje-odjela-select').value;

            if (selectedRadiliste === '') {
                // Prikaži sve
                renderStanjeOdjelaSections(stanjeOdjelaData, stanjeOdjelaSortimenti);
            } else {
                // Filtriraj samo izabrano radilište
                const filteredData = stanjeOdjelaData.filter(odjel => odjel.radiliste === selectedRadiliste);
                renderStanjeOdjelaSections(filteredData, stanjeOdjelaSortimenti);
            }
        }

        function renderStanjeOdjelaSections(data, sortimentiNazivi) {
            const container = document.getElementById('stanje-odjela-container');

            if (data.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka</div>';
                return;
            }

            let html = '';

            // Za svaki odjel kreiraj zasebnu sekciju
            data.forEach((odjelData, odjelIndex) => {
                const radiliste = odjelData.radiliste || odjelData.odjelNaziv;
                const odjelNaziv = odjelData.odjelNaziv;
                const redovi = odjelData.redovi;

                // Sekcija za svaki odjel
                html += '<div class="section" style="margin-bottom: 40px; border: 2px solid #d1d5db; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">';

                // Header radilišta
                html += '<div style="background: linear-gradient(135deg, #047857 0%, #059669 100%); padding: 16px 24px; border-bottom: 3px solid #10b981;">';
                html += '<h3 style="margin: 0; color: white; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 12px;">';
                html += '<span style="font-size: 24px;">🏭</span>';
                html += '<div>';
                html += '<div>' + radiliste + '</div>';
                html += '<div style="font-size: 12px; font-weight: 400; opacity: 0.9; margin-top: 4px;">(' + odjelNaziv + ')</div>';
                html += '</div>';
                html += '</h3>';
                html += '</div>';

                // Tabela sa sortimentnim zaglavljem
                html += '<div style="overflow-x: auto;">';
                html += '<table style="width: 100%; border-collapse: collapse; background: white;">';

                // Sortimentno zaglavlje
                html += '<thead>';
                html += '<tr style="background: #f0fdf4; border-bottom: 2px solid #10b981;">';
                html += '<th style="padding: 14px 16px; text-align: left; font-weight: 700; color: #047857; border-right: 1px solid #d1d5db; min-width: 180px; position: sticky; left: 0; background: #f0fdf4; z-index: 10;">Vrsta</th>';

                sortimentiNazivi.forEach((sortiment, index) => {
                    const colClass = getColumnGroup(sortiment);
                    let bgColor = '#f0fdf4';
                    let textColor = '#047857';

                    if (sortiment === 'ČETINARI') {
                        bgColor = '#dbeafe';
                        textColor = '#1e40af';
                    } else if (sortiment === 'LIŠĆARI') {
                        bgColor = '#fef3c7';
                        textColor = '#92400e';
                    } else if (sortiment === 'SVEUKUPNO') {
                        bgColor = '#ede9fe';
                        textColor = '#5b21b6';
                    }

                    const borderRight = index < sortimentiNazivi.length - 1 ? 'border-right: 1px solid #d1d5db;' : '';
                    html += '<th style="padding: 14px 12px; text-align: right; font-weight: 700; font-size: 13px; color: ' + textColor + '; background: ' + bgColor + '; ' + borderRight + ' white-space: nowrap;">' + sortiment + '</th>';
                });

                html += '</tr>';
                html += '</thead>';

                // Body sa 4 reda
                html += '<tbody>';

                const vrste = [
                    { naziv: 'PROJEKAT', data: redovi.projekat, icon: '📋', bg: '#fef3c7', color: '#92400e', borderColor: '#fbbf24' },
                    { naziv: 'SJEČA', data: redovi.sjeca, icon: '🌲', bg: '#d1fae5', color: '#065f46', borderColor: '#10b981' },
                    { naziv: 'OTPREMA', data: redovi.otprema, icon: '🚛', bg: '#dbeafe', color: '#1e40af', borderColor: '#3b82f6' },
                    { naziv: 'ZALIHA', data: redovi.sumaLager, icon: '📦', bg: '#e9d5ff', color: '#6b21a8', borderColor: '#a855f7' }
                ];

                vrste.forEach((vrsta, vrstaIndex) => {
                    const borderBottom = vrstaIndex < vrste.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : '';

                    html += '<tr style="' + borderBottom + '">';
                    html += '<td style="padding: 12px 16px; font-weight: 700; color: ' + vrsta.color + '; background: ' + vrsta.bg + '; border-right: 3px solid ' + vrsta.borderColor + '; position: sticky; left: 0; z-index: 5;">';
                    html += '<span style="display: inline-flex; align-items: center; gap: 8px;">';
                    html += '<span style="font-size: 20px;">' + vrsta.icon + '</span>';
                    html += '<span>' + vrsta.naziv + '</span>';
                    html += '</span>';
                    html += '</td>';

                    vrsta.data.forEach((value, index) => {
                        const sortiment = sortimentiNazivi[index];
                        let bgColor = 'white';

                        if (sortiment === 'ČETINARI') bgColor = '#eff6ff';
                        else if (sortiment === 'LIŠĆARI') bgColor = '#fffbeb';
                        else if (sortiment === 'SVEUKUPNO') bgColor = '#faf5ff';

                        const borderRight = index < sortimentiNazivi.length - 1 ? 'border-right: 1px solid #e5e7eb;' : '';
                        const displayValue = value === 0 ? '-' : value.toFixed(2);
                        const fontWeight = sortiment === 'SVEUKUPNO' ? 'font-weight: 700;' : '';

                        html += '<td style="padding: 12px; text-align: right; background: ' + bgColor + '; ' + borderRight + ' ' + fontWeight + ' color: #374151;">' + displayValue + '</td>';
                    });

                    html += '</tr>';
                });

                html += '</tbody>';
                html += '</table>';
                html += '</div>';
                html += '</div>';
            });

            container.innerHTML = html;
        }

        // ============================================
        // STANJE ZALIHA FUNCTIONS
        // ============================================

        let stanjeZalihaData = [];
        let stanjeZalihaRadilista = [];
        let stanjeZalihaSortimenti = [];

        async function loadStanjeZaliha() {
            if (!isActiveTab('stanje-zaliha')) return;
            // Turbo: instant show cached data
            var szCached = turboShow('cache_stanje_zaliha', 'stanje-zaliha-content', function(d) { return d.odjeli; });
            var szHasCached = false;
            if (szCached) {
                stanjeZalihaData = szCached.odjeli || [];
                stanjeZalihaRadilista = szCached.radilista || [];
                stanjeZalihaSortimenti = szCached.sortimentiHeader || [];
                populateStanjeZalihaDropdown();
                renderStanjeZalihaTabela(stanjeZalihaData);
                renderStanjeZalihaCards(stanjeZalihaData);
                szHasCached = true;
            }

            if (!szHasCached) {
                document.getElementById('loading-screen').classList.remove('hidden');
            }

            try {
                const url = buildApiUrl('stanje-zaliha');
                const data = await fetchWithCache(url, 'cache_stanje_zaliha', false, 180000);

                if (data.error) throw new Error(data.error);

                stanjeZalihaData = data.odjeli || [];
                stanjeZalihaRadilista = data.radilista || [];
                stanjeZalihaSortimenti = data.sortimentiHeader || [];

                // Populate radilište dropdown
                populateStanjeZalihaDropdown();

                // Render agregirana tabela zaliha (svi odjeli)
                renderStanjeZalihaTabela(stanjeZalihaData);

                // Render cards
                renderStanjeZalihaCards(stanjeZalihaData);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('stanje-zaliha-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading stanje zaliha:', error);
                showError('Greška', 'Greška pri učitavanju stanja zaliha: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        function populateStanjeZalihaDropdown() {
            const select = document.getElementById('stanje-zaliha-radiliste');
            select.innerHTML = '<option value="">Sva radilišta</option>';

            // Extract unique radilišta from data
            const radilistaSet = new Set();
            stanjeZalihaData.forEach(odjel => {
                if (odjel.radiliste) {
                    radilistaSet.add(odjel.radiliste);
                }
            });

            const sortedRadilista = Array.from(radilistaSet).sort();
            sortedRadilista.forEach(radiliste => {
                const option = document.createElement('option');
                option.value = radiliste;
                option.textContent = radiliste;
                select.appendChild(option);
            });
        }

        function filterStanjeZaliha() {
            const selectedRadiliste = document.getElementById('stanje-zaliha-radiliste').value;

            if (selectedRadiliste === '') {
                // Prikaži sve odjele
                renderStanjeZalihaTabela(stanjeZalihaData);
                renderStanjeZalihaCards(stanjeZalihaData);
            } else {
                // Filtriraj po radilištu
                const filteredData = stanjeZalihaData.filter(odjel => odjel.radiliste === selectedRadiliste);
                renderStanjeZalihaTabela(filteredData);
                renderStanjeZalihaCards(filteredData);
            }
        }

        function renderStanjeZalihaCards(data) {
            const container = document.getElementById('stanje-zaliha-container');
            const countEl = document.getElementById('stanje-zaliha-count');

            if (data.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 60px; color: #6b7280; font-size: 16px;">Nema podataka za prikaz</div>';
                countEl.textContent = '';
                return;
            }

            // Sortiramo od najsvježije sječe prema najstarijoj (DD.MM.YYYY)
            const parseDatum = d => {
                if (!d) return 0;
                const [day, month, year] = d.split('.');
                return new Date(year, month - 1, day).getTime();
            };
            const sorted = [...data].sort((a, b) =>
                parseDatum(b.datumZadnjeSjece) - parseDatum(a.datumZadnjeSjece)
            );

            countEl.textContent = `Prikazano: ${sorted.length} odjela`;

            // Sortimenti names for display (shortened for table headers)
            const sortimentiShort = [
                "F/L Č", "I Č", "II Č", "III Č", "RD", "TRUPCI Č",
                "CEL.D", "CEL.C", "ŠKART", "Σ Č",
                "F/L L", "I L", "II L", "III L", "TRUPCI L",
                "OGR.D", "OGR.C", "GULE", "LIŠĆ", "UKUPNO"
            ];

            let html = '';

            sorted.forEach((odjel, index) => {
                // Determine status color based on zaliha
                let statusClass = 'neutral';
                let statusIcon = '📦';
                const ukupnoZaliha = odjel.ukupnoZaliha || 0;

                if (ukupnoZaliha > 100) {
                    statusClass = 'warning';
                    statusIcon = '⚠️';
                } else if (ukupnoZaliha > 0) {
                    statusClass = 'success';
                    statusIcon = '✅';
                } else if (ukupnoZaliha < 0) {
                    statusClass = 'danger';
                    statusIcon = '❌';
                }

                html += `
                <div class="stanje-zaliha-card ${statusClass}" style="margin-bottom: 24px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">
                    <!-- Card Header -->
                    <div class="stanje-zaliha-card-header" style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin: 0; font-size: 18px; font-weight: 700;">${odjel.odjel}</h3>
                            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.85;">📍 ${odjel.radiliste || 'N/A'}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 24px; font-weight: 700;">${ukupnoZaliha.toFixed(2)} m³</div>
                            <div style="font-size: 12px; opacity: 0.85;">${statusIcon} Zaliha</div>
                        </div>
                    </div>

                    <!-- Summary Stats -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e5e7eb; border-bottom: 1px solid #e5e7eb;">
                        <div style="background: white; padding: 12px 16px; text-align: center;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">📋 Projekat</div>
                            <div style="font-size: 16px; font-weight: 700; color: #3b82f6;">${(odjel.ukupnoProjekat || 0).toFixed(2)}</div>
                        </div>
                        <div style="background: white; padding: 12px 16px; text-align: center;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">🪓 Sječa</div>
                            <div style="font-size: 16px; font-weight: 700; color: #10b981;">${(odjel.ukupnoSjeca || 0).toFixed(2)}</div>
                        </div>
                        <div style="background: white; padding: 12px 16px; text-align: center;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">🚛 Otprema</div>
                            <div style="font-size: 16px; font-weight: 700; color: #f59e0b;">${(odjel.ukupnoOtprema || 0).toFixed(2)}</div>
                        </div>
                        <div style="background: white; padding: 12px 16px; text-align: center;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">📦 Zaliha</div>
                            <div style="font-size: 16px; font-weight: 700; color: ${ukupnoZaliha >= 0 ? '#059669' : '#dc2626'};">${ukupnoZaliha.toFixed(2)}</div>
                        </div>
                    </div>

                    <!-- Expandable Detail Table -->
                    <details style="border-top: 1px solid #e5e7eb;">
                        <summary style="padding: 12px 20px; cursor: pointer; font-weight: 600; color: #374151; background: #f9fafb; display: flex; align-items: center; gap: 8px;">
                            <span style="transition: transform 0.2s;">▶</span> Detaljni prikaz po sortimentima
                        </summary>
                        <div style="overflow-x: auto; padding: 16px;">
                            <table class="stanje-zaliha-table" style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #d1d5db;">
                                <thead>
                                    <tr style="background: #1e3a5f;">
                                        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: white; border: 1px solid #374151; white-space: nowrap;">VRSTA</th>
                                        ${sortimentiShort.map((s, i) => {
                                            const isTotal = i === 9 || i === 18 || i === 19;
                                            const bgColor = isTotal ? '#2d5a87' : '#1e3a5f';
                                            return `<th style="padding: 10px 6px; text-align: center; font-weight: 600; color: white; border: 1px solid #374151; white-space: nowrap; background: ${bgColor};">${s}</th>`;
                                        }).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${['projekat', 'sjeca', 'otprema', 'zaliha'].map(vrsta => {
                                        const labels = { projekat: '📋 PROJEKAT', sjeca: '🪓 SJEČA', otprema: '🚛 OTPREMA', zaliha: '📦 ZALIHA' };
                                        const rowColors = { projekat: '#eff6ff', sjeca: '#ecfdf5', otprema: '#fffbeb', zaliha: '#faf5ff' };
                                        const textColors = { projekat: '#1e40af', sjeca: '#065f46', otprema: '#b45309', zaliha: '#7c3aed' };
                                        const sortimenti = odjel[vrsta] || {};

                                        return `
                                        <tr style="background: ${rowColors[vrsta]};">
                                            <td style="padding: 10px 12px; font-weight: 700; color: ${textColors[vrsta]}; white-space: nowrap; border: 1px solid #d1d5db;">${labels[vrsta]}</td>
                                            ${stanjeZalihaSortimenti.map((s, i) => {
                                                const value = sortimenti[s] || 0;
                                                const isTotal = i === 9 || i === 18 || i === 19;
                                                const displayValue = value === 0 ? '-' : value.toFixed(2);
                                                const cellColor = vrsta === 'zaliha' && value < 0 ? '#dc2626' : '#374151';
                                                const cellBg = isTotal ? (vrsta === 'zaliha' ? '#e9d5ff' : '#f3e8ff') : '';
                                                return `<td style="padding: 10px 6px; text-align: right; color: ${cellColor}; border: 1px solid #d1d5db; font-weight: ${isTotal ? '700' : '400'}; ${cellBg ? 'background:' + cellBg + ';' : ''}">${displayValue}</td>`;
                                            }).join('')}
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </details>
                </div>`;
            });

            container.innerHTML = html;

            // Add style for details summary arrow rotation
            const style = document.createElement('style');
            style.textContent = `
                .stanje-zaliha-card details[open] summary span:first-child {
                    transform: rotate(90deg);
                }
                .stanje-zaliha-card.warning .stanje-zaliha-card-header {
                    background: linear-gradient(135deg, #92400e 0%, #b45309 100%);
                }
                .stanje-zaliha-card.success .stanje-zaliha-card-header {
                    background: linear-gradient(135deg, #065f46 0%, #059669 100%);
                }
                .stanje-zaliha-card.danger .stanje-zaliha-card-header {
                    background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%);
                }
            `;
            if (!document.getElementById('stanje-zaliha-style')) {
                style.id = 'stanje-zaliha-style';
                document.head.appendChild(style);
            }
        }

        // Osvježi podatke za Stanje Zaliha (briše cache i ponovo učitava)
        async function refreshStanjeZaliha() {
            // Briši cache
            localStorage.removeItem('cache_stanje_zaliha');

            // Resetiraj podatke
            stanjeZalihaData = [];
            stanjeZalihaRadilista = [];
            stanjeZalihaSortimenti = [];

            // Prikaži loading
            document.getElementById('stanje-zaliha-container').innerHTML = `
                <div style="text-align: center; padding: 60px; color: #6b7280;">
                    <div style="font-size: 32px; margin-bottom: 16px;">🔄</div>
                    <p>Osvježavam podatke...</p>
                </div>
            `;

            // Ponovo učitaj
            await loadStanjeZaliha();

            showSuccess('Osvježeno', 'Podaci su uspješno osvježeni sa servera.');
        }

        // Load pending count (for badge only)
        async function loadPendingCount() {
            try {
                const year = new Date().getFullYear();
                const url = buildApiUrl('pending-unosi', { year });
                const response = await fetch(url);
                const data = await response.json();

                if (data.success && data.unosi) {
                    updatePendingBadge(data.unosi.length);
                }
            } catch (error) {
                console.error('Error loading pending count:', error);
            }
        }

        // Update pending badge count
        function updatePendingBadge(count) {
            const badge = document.getElementById('pending-count-badge');
            if (badge) {
                if (count > 0) {
                    badge.textContent = count;
                    badge.classList.add('show');
                } else {
                    badge.classList.remove('show');
                }
            }
        }

        // Edit pending unos (placeholder for future implementation)
        function editPendingUnos(id, tip) {
            showInfo('U razvoju', 'Uređivanje unosa #' + id + ' (Tip: ' + tip + ') - Ova funkcionalnost će biti dodana uskoro.');
            // Close dropdown
            const dropdown = document.getElementById('row-actions-' + id);
            if (dropdown) dropdown.classList.remove('show');
        }

        // Delete pending unos with modal confirmation
        function deletePendingUnos(id, tip) {
            // Close dropdown first
            const dropdown = document.getElementById('row-actions-' + id);
            if (dropdown) dropdown.classList.remove('show');

            // Show confirmation modal
            showConfirmModal(
                'Potvrda brisanja',
                'Da li ste sigurni da želite obrisati ovaj unos? (ID: ' + id + ', Tip: ' + tip + ')',
                async function() {
                    try {
                        const formData = new URLSearchParams();
                        formData.append('path', 'delete-pending');
                        formData.append('rowIndex', id);
                        // Convert tip to lowercase: SJEČA -> sjeca, OTPREMA -> otprema
                        const tipLower = tip === 'SJEČA' ? 'sjeca' : 'otprema';
                        formData.append('tip', tipLower);
                        formData.append('username', currentUser.username);
                        formData.append('password', currentPassword);

                        const url = API_URL + '?' + formData.toString();
                        const response = await fetch(url);
                        const result = await response.json();

                        if (result.success) {
                            showSuccess('Uspjeh', result.message);
                            loadPendingUnosi();
                        } else {
                            throw new Error(result.error || 'Unknown error');
                        }
                    } catch (error) {
                        showError('Greška', error.message);
                    }
                }
            );
        }

        // Calculate Sjeca totals automatically
        function calculateSjeca() {
            // Safe getter helper
            const getNum = (id) => {
                const el = document.getElementById(id);
                return el ? (parseFloat(el.value) || 0) : 0;
            };
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val.toFixed(2);
            };

            // Get all četinar values
            var flC = getNum('sjeca-FL-C');
            var iC = getNum('sjeca-I-C');
            var iiC = getNum('sjeca-II-C');
            var iiiC = getNum('sjeca-III-C');
            var rd = getNum('sjeca-RD');
            var celDuga = getNum('sjeca-CEL-DUGA');
            var celCijepana = getNum('sjeca-CEL-CIJEPANA');
            var skart = getNum('sjeca-SKART');

            // Calculate TRUPCI Č = F/L Č + I Č + II Č + III Č + RD
            var trupciC = flC + iC + iiC + iiiC + rd;
            setVal('sjeca-TRUPCI-C', trupciC);

            // Calculate Σ ČETINARI = TRUPCI Č + CEL.DUGA + CEL.CIJEPANA + ŠKART
            var cetinari = trupciC + celDuga + celCijepana + skart;
            setVal('sjeca-CETINARI', cetinari);

            // Get all lišćar values
            var flL = getNum('sjeca-FL-L');
            var iL = getNum('sjeca-I-L');
            var iiL = getNum('sjeca-II-L');
            var iiiL = getNum('sjeca-III-L');
            var ogrDugi = getNum('sjeca-OGR-DUGI');
            var ogrCijepani = getNum('sjeca-OGR-CIJEPANI');
            var gule = getNum('sjeca-GULE');

            // Calculate TRUPCI L = F/L L + I L + II L + III L
            var trupciL = flL + iL + iiL + iiiL;
            setVal('sjeca-TRUPCI-L', trupciL);

            // Calculate LIŠĆARI = TRUPCI L + OGR.DUGI + OGR.CIJEPANI + GULE
            var liscari = trupciL + ogrDugi + ogrCijepani + gule;
            setVal('sjeca-LISCARI', liscari);

            // Calculate UKUPNO Č+L = Σ ČETINARI + LIŠĆARI
            var ukupno = cetinari + liscari;
            setVal('sjeca-UKUPNO-CL', ukupno);
        }

        // Calculate Otprema totals automatically
        function calculateOtprema() {
            // Safe getter helper
            const getNum = (id) => {
                const el = document.getElementById(id);
                return el ? (parseFloat(el.value) || 0) : 0;
            };
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val.toFixed(2);
            };

            // Get all četinar values
            var flC = getNum('otprema-FL-C');
            var iC = getNum('otprema-I-C');
            var iiC = getNum('otprema-II-C');
            var iiiC = getNum('otprema-III-C');
            var rd = getNum('otprema-RD');
            var celDuga = getNum('otprema-CEL-DUGA');
            var celCijepana = getNum('otprema-CEL-CIJEPANA');
            var skart = getNum('otprema-SKART');

            // Calculate TRUPCI Č = F/L Č + I Č + II Č + III Č + RD
            var trupciC = flC + iC + iiC + iiiC + rd;
            setVal('otprema-TRUPCI-C', trupciC);

            // Calculate Σ ČETINARI = TRUPCI Č + CEL.DUGA + CEL.CIJEPANA + ŠKART
            var cetinari = trupciC + celDuga + celCijepana + skart;
            setVal('otprema-CETINARI', cetinari);

            // Get all lišćar values
            var flL = getNum('otprema-FL-L');
            var iL = getNum('otprema-I-L');
            var iiL = getNum('otprema-II-L');
            var iiiL = getNum('otprema-III-L');
            var ogrDugi = getNum('otprema-OGR-DUGI');
            var ogrCijepani = getNum('otprema-OGR-CIJEPANI');
            var gule = getNum('otprema-GULE');

            // Calculate TRUPCI L = F/L L + I L + II L + III L
            var trupciL = flL + iL + iiL + iiiL;
            setVal('otprema-TRUPCI-L', trupciL);

            // Calculate LIŠĆARI = TRUPCI L + OGR.DUGI + OGR.CIJEPANI + GULE
            var liscari = trupciL + ogrDugi + ogrCijepani + gule;
            setVal('otprema-LISCARI', liscari);

            // Calculate UKUPNO Č+L = Σ ČETINARI + LIŠĆARI
            var ukupno = cetinari + liscari;
            setVal('otprema-UKUPNO-CL', ukupno);
        }

        // Show Add Sjeca Form
        function showAddSjecaForm() {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('add-sjeca-content').classList.remove('hidden');

            // Set today's date as default
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('sjeca-datum').value = today;

            // Add event listeners to all sortimenti inputs for automatic calculation
            const sjecaInputIds = ['sjeca-FL-C', 'sjeca-I-C', 'sjeca-II-C', 'sjeca-III-C', 'sjeca-RD',
                                   'sjeca-CEL-DUGA', 'sjeca-CEL-CIJEPANA', 'sjeca-SKART',
                                   'sjeca-FL-L', 'sjeca-I-L', 'sjeca-II-L', 'sjeca-III-L',
                                   'sjeca-OGR-DUGI', 'sjeca-OGR-CIJEPANI', 'sjeca-GULE'];

            sjecaInputIds.forEach(function(inputId) {
                const element = document.getElementById(inputId);
                if (element && !element.hasAttribute('data-listener-added')) {
                    element.addEventListener('input', calculateSjeca);
                    element.setAttribute('data-listener-added', 'true');
                }
            });

            // Initial calculation
            calculateSjeca();
        }

        // Show Add Otprema Form
        function showAddOtpremaForm() {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('add-otprema-content').classList.remove('hidden');

            // Set today's date as default
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('otprema-datum').value = today;

            // Add event listeners to all sortimenti inputs for automatic calculation
            const otpremaInputIds = ['otprema-FL-C', 'otprema-I-C', 'otprema-II-C', 'otprema-III-C', 'otprema-RD',
                                     'otprema-CEL-DUGA', 'otprema-CEL-CIJEPANA', 'otprema-SKART',
                                     'otprema-FL-L', 'otprema-I-L', 'otprema-II-L', 'otprema-III-L',
                                     'otprema-OGR-DUGI', 'otprema-OGR-CIJEPANI', 'otprema-GULE'];

            otpremaInputIds.forEach(function(inputId) {
                const element = document.getElementById(inputId);
                if (element && !element.hasAttribute('data-listener-added')) {
                    element.addEventListener('input', calculateOtprema);
                    element.setAttribute('data-listener-added', 'true');
                }
            });

            // Initial calculation
            calculateOtprema();
        }

        // Submit Sjeca Form
        // ========== EXCEL EXPORT ==========
        function exportTableToExcel(tableId, filename) {
            try {
                if (typeof XLSX === 'undefined') {
                    showError('Export', 'Excel biblioteka nije učitana. Provjerite internet konekciju i osvježite stranicu.');
                    return;
                }
                const table = document.getElementById(tableId);
                if (!table) {
                    showError('Export', 'Tabela nije pronađena');
                    return;
                }
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.table_to_sheet(table, { raw: false });

                // Auto-size columns
                const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
                const colWidths = [];
                for (let c = range.s.c; c <= range.e.c; c++) {
                    let maxLen = 8;
                    for (let r = range.s.r; r <= range.e.r; r++) {
                        const cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
                        if (cell && cell.v) {
                            const len = String(cell.v).length;
                            if (len > maxLen) maxLen = Math.min(len, 30);
                        }
                    }
                    colWidths.push({ wch: maxLen + 2 });
                }
                ws['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(wb, ws, filename.substring(0, 31));
                const date = new Date().toISOString().split('T')[0];
                XLSX.writeFile(wb, filename + '_' + date + '.xlsx');
                showSuccess('Export', 'Fajl uspješno preuzet');
            } catch (error) {
                showError('Export', 'Greška pri exportu: ' + error.message);
            }
        }

        // Export any visible table by its container element
        function exportVisibleTable(containerId, filename) {
            const container = document.getElementById(containerId);
            if (!container) return;

            // Find the first visible sub-content with a table, or fallback to any table
            let table = null;
            const visibleSubs = container.querySelectorAll('.submenu-content:not(.hidden), .sub-content:not(.hidden)');
            if (visibleSubs.length > 0) {
                for (const sub of visibleSubs) {
                    table = sub.querySelector('table');
                    if (table) break;
                }
            }
            if (!table) {
                table = container.querySelector('table');
            }
            if (!table) {
                showError('Export', 'Nema tabele za export');
                return;
            }
            if (!table.id) {
                table.id = 'export-temp-' + Date.now();
            }
            exportTableToExcel(table.id, filename);
        }

        // ========== INPUT VALIDATION ==========
        function validateFormData(prefix) {
            const errors = [];
            const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
            const getNum = (id) => { const el = document.getElementById(id); return el ? (parseFloat(el.value) || 0) : 0; };

            // 1. Datum validation
            const datum = getVal(prefix + '-datum');
            if (!datum) {
                errors.push('Datum je obavezan');
            } else {
                const datumDate = new Date(datum);
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                if (datumDate > today) {
                    errors.push('Datum ne može biti u budućnosti');
                }
                // Ne stariji od 90 dana
                const minDate = new Date();
                minDate.setDate(minDate.getDate() - 90);
                if (datumDate < minDate) {
                    errors.push('Datum ne može biti stariji od 90 dana');
                }
            }

            // 2. Odjel validation
            const odjel = getVal(prefix + '-odjel');
            if (!odjel || odjel.trim() === '') {
                errors.push('Odaberi odjel');
            }

            // 3. Količina validation - barem jedan sortiment mora imati vrijednost > 0
            const sortimentIds = [
                '-FL-C', '-I-C', '-II-C', '-III-C', '-RD',
                '-CEL-DUGA', '-CEL-CIJEPANA', '-SKART',
                '-FL-L', '-I-L', '-II-L', '-III-L',
                '-OGR-DUGI', '-OGR-CIJEPANI', '-GULE'
            ];
            let hasAnyValue = false;
            for (const sid of sortimentIds) {
                const val = getNum(prefix + sid);
                if (val < 0) {
                    errors.push('Količina ne može biti negativna');
                    break;
                }
                if (val > 10000) {
                    errors.push('Količina po sortimentu ne može biti veća od 10.000 m³');
                    break;
                }
                if (val > 0) hasAnyValue = true;
            }
            if (!hasAnyValue && errors.length === 0) {
                errors.push('Unesite barem jedan sortiment (količina > 0)');
            }

            // 4. Ukupno validation
            const ukupno = getNum(prefix + '-UKUPNO-CL');
            if (ukupno > 50000) {
                errors.push('Ukupna količina prevelika (max 50.000 m³)');
            }

            return errors;
        }

        async function submitSjeca(event) {
            event.preventDefault();

            const submitBtn = document.getElementById('submit-sjeca-btn');
            const messageDiv = document.getElementById('sjeca-message');

            // Safe getter: returns element value or default (empty string for text, '0' for numbers)
            const getVal = (id, defaultVal = '') => {
                const el = document.getElementById(id);
                return el ? el.value : defaultVal;
            };
            // Safe numeric getter: returns number or 0
            const getNum = (id) => {
                const el = document.getElementById(id);
                return el ? (Number(el.value) || 0) : 0;
            };

            // Validation
            const validationErrors = validateFormData('sjeca');
            if (validationErrors.length > 0) {
                messageDiv.innerHTML = '❌ ' + validationErrors.join('<br>❌ ');
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
                return;
            }

            const odjel = getVal('sjeca-odjel');

            submitBtn.disabled = true;
            submitBtn.textContent = 'Dodavanje...';
            messageDiv.classList.add('hidden');

            try {
                // Upload image first if exists
                let imageUrl = null;
                if (sjecaImageData) {
                    submitBtn.textContent = 'Učitavam sliku...';
                    console.log('Uploading image, data length:', sjecaImageData.length);
                    imageUrl = await uploadImage(sjecaImageData, 'sjeca');
                    console.log('Upload result:', imageUrl ? 'SUCCESS: ' + imageUrl : 'FAILED');
                    if (!imageUrl) {
                        console.warn('Image upload failed, continuing without image');
                    }
                }

                submitBtn.textContent = 'Dodavanje...';

                // Collect form data with safe getters (quantities default to 0)
                const formData = new URLSearchParams();
                formData.append('path', 'add-sjeca');
                formData.append('username', currentUser.username);
                formData.append('password', currentPassword);
                formData.append('datum', getVal('sjeca-datum'));
                formData.append('odjel', odjel);
                formData.append('F/L Č', getNum('sjeca-FL-C'));
                formData.append('I Č', getNum('sjeca-I-C'));
                formData.append('II Č', getNum('sjeca-II-C'));
                formData.append('III Č', getNum('sjeca-III-C'));
                formData.append('RD', getNum('sjeca-RD'));
                formData.append('TRUPCI Č', getNum('sjeca-TRUPCI-C'));
                formData.append('CEL.DUGA', getNum('sjeca-CEL-DUGA'));
                formData.append('CEL.CIJEPANA', getNum('sjeca-CEL-CIJEPANA'));
                formData.append('ŠKART', getNum('sjeca-SKART'));
                formData.append('Σ ČETINARI', getNum('sjeca-CETINARI'));
                formData.append('F/L L', getNum('sjeca-FL-L'));
                formData.append('I L', getNum('sjeca-I-L'));
                formData.append('II L', getNum('sjeca-II-L'));
                formData.append('III L', getNum('sjeca-III-L'));
                formData.append('TRUPCI L', getNum('sjeca-TRUPCI-L'));
                formData.append('OGR.DUGI', getNum('sjeca-OGR-DUGI'));
                formData.append('OGR.CIJEPANI', getNum('sjeca-OGR-CIJEPANI'));
                formData.append('GULE', getNum('sjeca-GULE'));
                formData.append('LIŠĆARI', getNum('sjeca-LISCARI'));

                // Add image URL if uploaded
                if (imageUrl) {
                    formData.append('imageUrl', imageUrl);
                }

                // Send request (don't cache this)
                const url = `${API_URL}?${formData.toString()}`;
                const response = await fetch(url);
                const result = await response.json();

                if (result.success) {
                    messageDiv.innerHTML = `✅ ${result.message}<br>Ukupno: ${result.ukupno.toFixed(2)} m³`;
                    messageDiv.style.background = '#d1fae5';
                    messageDiv.style.color = '#047857';
                    messageDiv.classList.remove('hidden');

                    // Reset form immediately so user can enter new data
                    resetSjecaForm();

                    // Hide message after delay
                    setTimeout(() => {
                        messageDiv.classList.add('hidden');
                    }, 3000);

                    // Clear all sječa-related cache entries so new data shows up
                    clearCacheByPattern('primac');
                    clearCacheByPattern('primaci');
                    clearCacheByPattern('dashboard');
                    clearCacheByPattern('izvjestaji');
                    clearCacheByPattern('sedmicni_sjeca');
                    clearCacheByPattern('stanje_odjela');
                    clearCacheByPattern('my_sjece');
                } else {
                    throw new Error(result.error || 'Unknown error');
                }

            } catch (error) {
                messageDiv.innerHTML = `❌ Greška: ${error.message}`;
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Dodaj sječu';
            }
        }

        // Submit Otprema Form
        async function submitOtprema(event) {
            event.preventDefault();

            const submitBtn = document.getElementById('submit-otprema-btn');
            const messageDiv = document.getElementById('otprema-message');

            // Validation
            const validationErrors = validateFormData('otprema');
            if (validationErrors.length > 0) {
                messageDiv.innerHTML = '❌ ' + validationErrors.join('<br>❌ ');
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Dodavanje...';
            messageDiv.classList.add('hidden');

            try {
                // Upload image first if exists
                let imageUrl = null;
                if (otpremaImageData) {
                    submitBtn.textContent = 'Učitavam sliku...';
                    imageUrl = await uploadImage(otpremaImageData, 'otprema');
                }

                submitBtn.textContent = 'Dodavanje...';

                // Collect form data
                const formData = new URLSearchParams();
                formData.append('path', 'add-otprema');
                formData.append('username', currentUser.username);
                formData.append('password', currentPassword);
                formData.append('datum', document.getElementById('otprema-datum').value);
                formData.append('odjel', document.getElementById('otprema-odjel').value);
                formData.append('kupac', document.getElementById('otprema-kupac').value);
                formData.append('brojOtpremnice', document.getElementById('otprema-broj-otpremnice').value);
                formData.append('F/L Č', document.getElementById('otprema-FL-C').value);
                formData.append('I Č', document.getElementById('otprema-I-C').value);
                formData.append('II Č', document.getElementById('otprema-II-C').value);
                formData.append('III Č', document.getElementById('otprema-III-C').value);
                formData.append('RD', document.getElementById('otprema-RD').value);
                formData.append('TRUPCI Č', document.getElementById('otprema-TRUPCI-C').value);
                formData.append('CEL.DUGA', document.getElementById('otprema-CEL-DUGA').value);
                formData.append('CEL.CIJEPANA', document.getElementById('otprema-CEL-CIJEPANA').value);
                formData.append('ŠKART', document.getElementById('otprema-SKART').value);
                formData.append('Σ ČETINARI', document.getElementById('otprema-CETINARI').value);
                formData.append('F/L L', document.getElementById('otprema-FL-L').value);
                formData.append('I L', document.getElementById('otprema-I-L').value);
                formData.append('II L', document.getElementById('otprema-II-L').value);
                formData.append('III L', document.getElementById('otprema-III-L').value);
                formData.append('TRUPCI L', document.getElementById('otprema-TRUPCI-L').value);
                formData.append('OGR.DUGI', document.getElementById('otprema-OGR-DUGI').value);
                formData.append('OGR.CIJEPANI', document.getElementById('otprema-OGR-CIJEPANI').value);
                formData.append('GULE', document.getElementById('otprema-GULE').value);
                formData.append('LIŠĆARI', document.getElementById('otprema-LISCARI').value);

                // Add image URL if uploaded
                if (imageUrl) {
                    formData.append('imageUrl', imageUrl);
                }

                // Send request (don't cache this)
                const url = `${API_URL}?${formData.toString()}`;
                const response = await fetch(url);
                const result = await response.json();

                if (result.success) {
                    messageDiv.innerHTML = `✅ ${result.message}<br>Ukupno: ${result.ukupno.toFixed(2)} m³`;
                    messageDiv.style.background = '#dbeafe';
                    messageDiv.style.color = '#1e40af';
                    messageDiv.classList.remove('hidden');

                    // Reset form immediately so user can enter new data
                    resetOtpremaForm();

                    // Hide message after delay
                    setTimeout(() => {
                        messageDiv.classList.add('hidden');
                    }, 3000);

                    // Clear all otprema-related cache entries so new data shows up
                    clearCacheByPattern('otpremac');
                    clearCacheByPattern('otpremaci');
                    clearCacheByPattern('dashboard');
                    clearCacheByPattern('kupci');
                    clearCacheByPattern('izvjestaji');
                    clearCacheByPattern('sedmicni_otprema');
                    clearCacheByPattern('stanje_odjela');
                    clearCacheByPattern('my_otpreme');
                } else {
                    throw new Error(result.error || 'Unknown error');
                }

            } catch (error) {
                messageDiv.innerHTML = `❌ Greška: ${error.message}`;
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Dodaj otpremu';
            }
        }

        // Reset Sjeca Form
        function resetSjecaForm() {
            document.getElementById('add-sjeca-form').reset();
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('sjeca-datum').value = today;

            // Reset all sortimenti to 0
            document.querySelectorAll('#add-sjeca-form input[type="number"]').forEach(input => {
                input.value = 0;
            });

            // Recalculate totals
            calculateSjeca();

            // Reset image
            removeSjecaImage();
        }

        // Reset Otprema Form
        function resetOtpremaForm() {
            document.getElementById('add-otprema-form').reset();
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('otprema-datum').value = today;

            // Reset all sortimenti to 0
            document.querySelectorAll('#add-otprema-form input[type="number"]').forEach(input => {
                input.value = 0;
            });

            // Recalculate totals
            calculateOtprema();

            // Reset image
            removeOtpremaImage();
        }

        // ==================== IMAGE UPLOAD FUNCTIONS ====================

        // Global variables for image data
        let sjecaImageData = null;
        let otpremaImageData = null;

        // Preview Sjeca Image
        function previewSjecaImage(event) {
            const file = event.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    alert('Slika je prevelika! Maksimalna veličina je 5MB.');
                    event.target.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    sjecaImageData = e.target.result;
                    document.getElementById('sjeca-image-preview-img').src = sjecaImageData;
                    document.getElementById('sjeca-image-preview').style.display = 'block';
                    document.getElementById('sjeca-image-name').textContent = file.name;
                };
                reader.readAsDataURL(file);
            }
        }

        // Preview Otprema Image
        function previewOtpremaImage(event) {
            const file = event.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    alert('Slika je prevelika! Maksimalna veličina je 5MB.');
                    event.target.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    otpremaImageData = e.target.result;
                    document.getElementById('otprema-image-preview-img').src = otpremaImageData;
                    document.getElementById('otprema-image-preview').style.display = 'block';
                    document.getElementById('otprema-image-name').textContent = file.name;
                };
                reader.readAsDataURL(file);
            }
        }

        // Remove Sjeca Image
        function removeSjecaImage() {
            sjecaImageData = null;
            const input = document.getElementById('sjeca-image-input');
            if (input) input.value = '';
            const preview = document.getElementById('sjeca-image-preview');
            if (preview) preview.style.display = 'none';
            const img = document.getElementById('sjeca-image-preview-img');
            if (img) img.src = '';
            const name = document.getElementById('sjeca-image-name');
            if (name) name.textContent = '';
        }

        // Remove Otprema Image
        function removeOtpremaImage() {
            otpremaImageData = null;
            const input = document.getElementById('otprema-image-input');
            if (input) input.value = '';
            const preview = document.getElementById('otprema-image-preview');
            if (preview) preview.style.display = 'none';
            const img = document.getElementById('otprema-image-preview-img');
            if (img) img.src = '';
            const name = document.getElementById('otprema-image-name');
            if (name) name.textContent = '';
        }

        // Capture Sjeca Photo (using camera)
        function captureSjecaPhoto() {
            const input = document.getElementById('sjeca-image-input');
            // Set capture attribute for mobile camera
            input.setAttribute('capture', 'environment');
            input.click();
            // Remove capture attribute after to allow gallery selection too
            setTimeout(() => input.removeAttribute('capture'), 100);
        }

        // Capture Otprema Photo (using camera)
        function captureOtpremaPhoto() {
            const input = document.getElementById('otprema-image-input');
            // Set capture attribute for mobile camera
            input.setAttribute('capture', 'environment');
            input.click();
            // Remove capture attribute after to allow gallery selection too
            setTimeout(() => input.removeAttribute('capture'), 100);
        }

        // Upload Image to Server (returns image URL or null)
        // Uses POST because base64 image data is too large for GET URL query string
        async function uploadImage(imageData, type) {
            if (!imageData) return null;

            try {
                console.log('uploadImage: Starting POST request to', API_URL);
                // POST request with JSON body (base64 data too large for GET URL)
                const response = await fetch(`${API_URL}?path=upload-image`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8',
                    },
                    body: JSON.stringify({
                        username: currentUser.username,
                        password: currentPassword,
                        type: type,
                        imageData: imageData
                    })
                });
                console.log('uploadImage: Response status:', response.status);
                const result = await response.json();
                console.log('uploadImage: Response data:', JSON.stringify(result).substring(0, 200));

                if (result.success && result.imageUrl) {
                    console.log('Image uploaded successfully:', result.imageUrl);
                    return result.imageUrl;
                } else {
                    console.error('Image upload failed:', result.error || 'Unknown error');
                    alert('Greška pri uploadu slike: ' + (result.error || 'Nepoznata greška'));
                    return null;
                }
            } catch (error) {
                console.error('Error uploading image:', error);
                alert('Greška pri uploadu slike: ' + error.message);
                return null;
            }
        }

        // ==================== MY PENDING ENTRIES FUNCTIONS ====================

        // Load My Sjece (last 10 pending entries for current user)
        async function loadMySjece() {
            if (!isActiveTab('my-sjece')) return;
            var msCacheKey = `cache_my_sjece_${currentUser.username}`;
            // Turbo: skip loading screen if cache exists
            if (!localStorage.getItem(msCacheKey)) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('my-sjece-content').classList.add('hidden');
            } else {
                document.getElementById('my-sjece-content').classList.remove('hidden');
            }

            try {
                const url = buildApiUrl('my-pending', { tip: 'sjeca' });
                const data = await fetchWithCache(url, msCacheKey);

                if (data.error) {
                    throw new Error(data.error);
                }

                var html = '<div style="overflow-x: auto;">';

                if (data.unosi && data.unosi.length > 0) {
                    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
                    html += '<thead><tr style="background: #047857; color: white;">';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Datum</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Odjel</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">ČETINARI</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">LIŠĆARI</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Ukupno</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Vrijeme unosa</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Akcije</th>';
                    html += '</tr></thead><tbody>';

                    for (var i = 0; i < data.unosi.length; i++) {
                        var unos = data.unosi[i];
                        var cetinari = parseFloat(unos.sortimenti['ČETINARI'] || 0);
                        var liscari = parseFloat(unos.sortimenti['LIŠĆARI'] || 0);
                        var ukupno = cetinari + liscari;

                        html += '<tr style="' + (i % 2 === 0 ? 'background: #f9fafb;' : '') + '">';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + unos.datum + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + unos.odjel + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + cetinari.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + liscari.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">' + ukupno.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + new Date(unos.timestamp).toLocaleString('hr-HR') + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">';
                        html += '<button class="btn btn-primary" style="margin-right: 8px;" onclick=\'editMySjeca(' + JSON.stringify(unos).replace(/'/g, "\\'") + ')\'><✏️ Uredi</button>';
                        html += '<button class="btn btn-secondary" onclick="deleteMySjeca(' + unos.rowIndex + ')">🗑️ Obriši</button>';
                        html += '</td>';
                        html += '</tr>';
                    }

                    html += '</tbody></table>';
                } else {
                    html += '<p style="text-align: center; color: #6b7280; padding: 40px;">Nemate pending unosa.</p>';
                }

                html += '</div>';

                document.getElementById('my-sjece-container').innerHTML = html;
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('my-sjece-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading my sjece:', error);
                document.getElementById('my-sjece-container').innerHTML = '<p style="color: #dc2626; text-align: center; padding: 40px;">Greška: ' + error.message + '</p>';
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('my-sjece-content').classList.remove('hidden');
            }
        }

        // Load My Otpreme (last 10 pending entries for current user)
        async function loadMyOtpreme() {
            if (!isActiveTab('my-otpreme')) return;
            var moCacheKey = `cache_my_otpreme_${currentUser.username}`;
            // Turbo: skip loading screen if cache exists
            if (!localStorage.getItem(moCacheKey)) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('my-otpreme-content').classList.add('hidden');
            } else {
                document.getElementById('my-otpreme-content').classList.remove('hidden');
            }

            try {
                const url = buildApiUrl('my-pending', { tip: 'otprema' });
                const data = await fetchWithCache(url, moCacheKey);

                if (data.error) {
                    throw new Error(data.error);
                }

                var html = '<div style="overflow-x: auto;">';

                if (data.unosi && data.unosi.length > 0) {
                    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
                    html += '<thead><tr style="background: #2563eb; color: white;">';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Datum</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Odjel</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Kupac</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Br. otpremnice</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">ČETINARI</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">LIŠĆARI</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Ukupno</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Vrijeme unosa</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Akcije</th>';
                    html += '</tr></thead><tbody>';

                    for (var i = 0; i < data.unosi.length; i++) {
                        var unos = data.unosi[i];
                        var cetinari = parseFloat(unos.sortimenti['ČETINARI'] || 0);
                        var liscari = parseFloat(unos.sortimenti['LIŠĆARI'] || 0);
                        var ukupno = cetinari + liscari;

                        html += '<tr style="' + (i % 2 === 0 ? 'background: #f9fafb;' : '') + '">';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + unos.datum + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + unos.odjel + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + (unos.kupac || '-') + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + (unos.brojOtpremnice || '-') + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + cetinari.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + liscari.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">' + ukupno.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + new Date(unos.timestamp).toLocaleString('hr-HR') + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">';
                        html += '<button class="btn btn-primary" style="margin-right: 8px;" onclick=\'editMyOtprema(' + JSON.stringify(unos).replace(/'/g, "\\'") + ')\'>✏️ Uredi</button>';
                        html += '<button class="btn btn-secondary" onclick="deleteMyOtprema(' + unos.rowIndex + ')">🗑️ Obriši</button>';
                        html += '</td>';
                        html += '</tr>';
                    }

                    html += '</tbody></table>';
                } else {
                    html += '<p style="text-align: center; color: #6b7280; padding: 40px;">Nemate pending unosa.</p>';
                }

                html += '</div>';

                document.getElementById('my-otpreme-container').innerHTML = html;
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('my-otpreme-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading my otpreme:', error);
                document.getElementById('my-otpreme-container').innerHTML = '<p style="color: #dc2626; text-align: center; padding: 40px;">Greška: ' + error.message + '</p>';
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('my-otpreme-content').classList.remove('hidden');
            }
        }

        // Edit My Sjeca - show edit form
        function editMySjeca(unos) {
            document.getElementById('loading-screen').classList.add('hidden');

            // Hide other content
            document.getElementById('my-sjece-content').classList.add('hidden');

            // Show edit form
            document.getElementById('edit-sjeca-content').classList.remove('hidden');

            // Populate form with existing data
            document.getElementById('edit-sjeca-rowIndex').value = unos.rowIndex;
            document.getElementById('edit-sjeca-datum').value = unos.datum;
            document.getElementById('edit-sjeca-odjel').value = unos.odjel;

            // Build sortimenti fields dynamically
            var sortimentiHtml = '';
            var sortimentiKeys = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'TRUPCI Č', 'CEL.DUGA', 'CEL.CIJEPANA', 'ŠKART', 'ČETINARI',
                                 'F/L L', 'I L', 'II L', 'III L', 'TRUPCI', 'OGR.DUGI', 'OGR.CIJEPANI', 'GULE', 'LIŠĆARI'];

            sortimentiKeys.forEach(function(key) {
                var fieldId = 'edit-sjeca-' + key.replace(/\//g, '').replace(/ /g, '-');
                var value = unos.sortimenti[key] || 0;
                var isCalculated = ['TRUPCI Č', 'ČETINARI', 'TRUPCI', 'LIŠĆARI'].indexOf(key) !== -1;
                var readonlyAttr = isCalculated ? 'readonly' : '';
                var styleExtra = isCalculated ? 'background: #f3f4f6; color: #374151; font-weight: 600;' : '';

                sortimentiHtml += '<div class="form-group">';
                sortimentiHtml += '<label>' + key + (isCalculated ? ': <span style="color: #6b7280; font-size: 0.85em;">(auto)</span>' : ':') + '</label>';
                sortimentiHtml += '<input type="number" step="0.01" id="' + fieldId + '" value="' + value + '" min="0" ' + readonlyAttr + ' class="edit-sjeca-input" style="padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; ' + styleExtra + '">';
                sortimentiHtml += '</div>';
            });

            document.getElementById('edit-sjeca-sortimenti').innerHTML = sortimentiHtml;

            // Add event listeners for auto-calculation
            var inputIds = ['edit-sjeca-FL-Č', 'edit-sjeca-I-Č', 'edit-sjeca-II-Č', 'edit-sjeca-III-Č', 'edit-sjeca-RUDNO',
                           'edit-sjeca-CEL.DUGA', 'edit-sjeca-CEL.CIJEPANA', 'edit-sjeca-ŠKART',
                           'edit-sjeca-FL-L', 'edit-sjeca-I-L', 'edit-sjeca-II-L', 'edit-sjeca-III-L',
                           'edit-sjeca-OGR.DUGI', 'edit-sjeca-OGR.CIJEPANI', 'edit-sjeca-GULE'];

            inputIds.forEach(function(inputId) {
                var element = document.getElementById(inputId);
                if (element) {
                    element.addEventListener('input', calculateEditSjeca);
                }
            });

            // Calculate initial totals
            calculateEditSjeca();
        }

        // Calculate Edit Sjeca totals
        function calculateEditSjeca() {
            var flC = parseFloat(document.getElementById('edit-sjeca-FL-Č').value) || 0;
            var iC = parseFloat(document.getElementById('edit-sjeca-I-Č').value) || 0;
            var iiC = parseFloat(document.getElementById('edit-sjeca-II-Č').value) || 0;
            var iiiC = parseFloat(document.getElementById('edit-sjeca-III-Č').value) || 0;
            var rudno = parseFloat(document.getElementById('edit-sjeca-RUDNO').value) || 0;
            var celDuga = parseFloat(document.getElementById('edit-sjeca-CEL.DUGA').value) || 0;
            var celCijepana = parseFloat(document.getElementById('edit-sjeca-CEL.CIJEPANA').value) || 0;
            var skart = parseFloat(document.getElementById('edit-sjeca-ŠKART').value) || 0;

            var trupciC = flC + iC + iiC + iiiC + rudno;
            document.getElementById('edit-sjeca-TRUPCI-Č').value = trupciC.toFixed(2);

            // Σ ČETINARI = TRUPCI Č + CEL.DUGA + CEL.CIJEPANA + ŠKART
            var cetinari = trupciC + celDuga + celCijepana + skart;
            document.getElementById('edit-sjeca-ČETINARI').value = cetinari.toFixed(2);

            var flL = parseFloat(document.getElementById('edit-sjeca-FL-L').value) || 0;
            var iL = parseFloat(document.getElementById('edit-sjeca-I-L').value) || 0;
            var iiL = parseFloat(document.getElementById('edit-sjeca-II-L').value) || 0;
            var iiiL = parseFloat(document.getElementById('edit-sjeca-III-L').value) || 0;
            var ogrDugi = parseFloat(document.getElementById('edit-sjeca-OGR.DUGI').value) || 0;
            var ogrCijepani = parseFloat(document.getElementById('edit-sjeca-OGR.CIJEPANI').value) || 0;
            var gule = parseFloat(document.getElementById('edit-sjeca-GULE').value) || 0;

            var trupciL = flL + iL + iiL + iiiL;
            document.getElementById('edit-sjeca-TRUPCI').value = trupciL.toFixed(2);

            // LIŠĆARI = TRUPCI L + OGR.DUGI + OGR.CIJEPANI + GULE
            var liscari = trupciL + ogrDugi + ogrCijepani + gule;
            document.getElementById('edit-sjeca-LIŠĆARI').value = liscari.toFixed(2);

            var sveukupno = cetinari + liscari;
            document.getElementById('edit-sjeca-UKUPNO-CL').value = sveukupno.toFixed(2);
        }

        // Submit Edit Sjeca Form
        async function submitEditSjeca(event) {
            event.preventDefault();

            var submitBtn = document.getElementById('submit-edit-sjeca-btn');
            var messageDiv = document.getElementById('edit-sjeca-message');

            submitBtn.disabled = true;
            submitBtn.textContent = 'Ažuriranje...';
            messageDiv.classList.add('hidden');

            try {
                var formData = new URLSearchParams();
                formData.append('path', 'update-pending');
                formData.append('username', currentUser.username);
                formData.append('password', currentPassword);
                formData.append('tip', 'sjeca');
                formData.append('rowIndex', document.getElementById('edit-sjeca-rowIndex').value);
                formData.append('datum', document.getElementById('edit-sjeca-datum').value);
                formData.append('odjel', document.getElementById('edit-sjeca-odjel').value);

                // Add all sortimenti
                var sortimentiKeys = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'TRUPCI Č', 'CEL.DUGA', 'CEL.CIJEPANA', 'ČETINARI',
                                     'F/L L', 'I L', 'II L', 'III L', 'TRUPCI', 'OGR.DUGI', 'OGR.CIJEPANI', 'LIŠĆARI'];

                sortimentiKeys.forEach(function(key) {
                    var fieldId = 'edit-sjeca-' + key.replace(/\//g, '').replace(/ /g, '-');
                    var value = document.getElementById(fieldId).value;
                    formData.append(key, value);
                });

                var url = API_URL + '?' + formData.toString();
                var response = await fetch(url);
                var result = await response.json();

                if (result.success) {
                    messageDiv.innerHTML = '✅ ' + result.message + '<br>Ukupno: ' + result.ukupno.toFixed(2) + ' m³';
                    messageDiv.style.background = '#d1fae5';
                    messageDiv.style.color = '#047857';
                    messageDiv.classList.remove('hidden');

                    setTimeout(function() {
                        switchTab('my-sjece');
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Unknown error');
                }

            } catch (error) {
                messageDiv.innerHTML = '❌ Greška: ' + error.message;
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sačuvaj izmjene';
            }
        }

        // Cancel Edit Sjeca
        function cancelEditSjeca() {
            switchTab('my-sjece');
        }

        // Similar functions for Edit Otprema (abbreviated for space)
        function editMyOtprema(unos) {
            // Similar to editMySjeca but for otprema
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('my-otpreme-content').classList.add('hidden');
            document.getElementById('edit-otprema-content').classList.remove('hidden');

            document.getElementById('edit-otprema-rowIndex').value = unos.rowIndex;
            document.getElementById('edit-otprema-datum').value = unos.datum;
            document.getElementById('edit-otprema-odjel').value = unos.odjel;
            document.getElementById('edit-otprema-kupac').value = unos.kupac || '';
            document.getElementById('edit-otprema-broj-otpremnice').value = unos.brojOtpremnice || '';

            var sortimentiHtml = '';
            var sortimentiKeys = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'TRUPCI Č', 'CEL.DUGA', 'CEL.CIJEPANA', 'ŠKART', 'ČETINARI',
                                 'F/L L', 'I L', 'II L', 'III L', 'TRUPCI', 'OGR.DUGI', 'OGR.CIJEPANI', 'GULE', 'LIŠĆARI'];

            sortimentiKeys.forEach(function(key) {
                var fieldId = 'edit-otprema-' + key.replace(/\//g, '').replace(/ /g, '-');
                var value = unos.sortimenti[key] || 0;
                var isCalculated = ['TRUPCI Č', 'ČETINARI', 'TRUPCI', 'LIŠĆARI'].indexOf(key) !== -1;
                var readonlyAttr = isCalculated ? 'readonly' : '';
                var styleExtra = isCalculated ? 'background: #f3f4f6; color: #374151; font-weight: 600;' : '';

                sortimentiHtml += '<div class="form-group">';
                sortimentiHtml += '<label>' + key + (isCalculated ? ': <span style="color: #6b7280; font-size: 0.85em;">(auto)</span>' : ':') + '</label>';
                sortimentiHtml += '<input type="number" step="0.01" id="' + fieldId + '" value="' + value + '" min="0" ' + readonlyAttr + ' style="padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; ' + styleExtra + '">';
                sortimentiHtml += '</div>';
            });

            document.getElementById('edit-otprema-sortimenti').innerHTML = sortimentiHtml;

            var inputIds = ['edit-otprema-FL-Č', 'edit-otprema-I-Č', 'edit-otprema-II-Č', 'edit-otprema-III-Č', 'edit-otprema-RUDNO',
                           'edit-otprema-CEL.DUGA', 'edit-otprema-CEL.CIJEPANA', 'edit-otprema-ŠKART',
                           'edit-otprema-FL-L', 'edit-otprema-I-L', 'edit-otprema-II-L', 'edit-otprema-III-L',
                           'edit-otprema-OGR.DUGI', 'edit-otprema-OGR.CIJEPANI', 'edit-otprema-GULE'];

            inputIds.forEach(function(inputId) {
                var element = document.getElementById(inputId);
                if (element) {
                    element.addEventListener('input', calculateEditOtprema);
                }
            });

            calculateEditOtprema();
        }

        function calculateEditOtprema() {
            var flC = parseFloat(document.getElementById('edit-otprema-FL-Č').value) || 0;
            var iC = parseFloat(document.getElementById('edit-otprema-I-Č').value) || 0;
            var iiC = parseFloat(document.getElementById('edit-otprema-II-Č').value) || 0;
            var iiiC = parseFloat(document.getElementById('edit-otprema-III-Č').value) || 0;
            var rudno = parseFloat(document.getElementById('edit-otprema-RUDNO').value) || 0;
            var celDuga = parseFloat(document.getElementById('edit-otprema-CEL.DUGA').value) || 0;
            var celCijepana = parseFloat(document.getElementById('edit-otprema-CEL.CIJEPANA').value) || 0;
            var skart = parseFloat(document.getElementById('edit-otprema-ŠKART').value) || 0;

            var trupciC = flC + iC + iiC + iiiC + rudno;
            document.getElementById('edit-otprema-TRUPCI-Č').value = trupciC.toFixed(2);

            // Σ ČETINARI = TRUPCI Č + CEL.DUGA + CEL.CIJEPANA + ŠKART
            var cetinari = trupciC + celDuga + celCijepana + skart;
            document.getElementById('edit-otprema-ČETINARI').value = cetinari.toFixed(2);

            var flL = parseFloat(document.getElementById('edit-otprema-FL-L').value) || 0;
            var iL = parseFloat(document.getElementById('edit-otprema-I-L').value) || 0;
            var iiL = parseFloat(document.getElementById('edit-otprema-II-L').value) || 0;
            var iiiL = parseFloat(document.getElementById('edit-otprema-III-L').value) || 0;
            var ogrDugi = parseFloat(document.getElementById('edit-otprema-OGR.DUGI').value) || 0;
            var ogrCijepani = parseFloat(document.getElementById('edit-otprema-OGR.CIJEPANI').value) || 0;
            var gule = parseFloat(document.getElementById('edit-otprema-GULE').value) || 0;

            var trupciL = flL + iL + iiL + iiiL;
            document.getElementById('edit-otprema-TRUPCI').value = trupciL.toFixed(2);

            // LIŠĆARI = TRUPCI L + OGR.DUGI + OGR.CIJEPANI + GULE
            var liscari = trupciL + ogrDugi + ogrCijepani + gule;
            document.getElementById('edit-otprema-LIŠĆARI').value = liscari.toFixed(2);

            var sveukupno = cetinari + liscari;
            document.getElementById('edit-otprema-UKUPNO-CL').value = sveukupno.toFixed(2);
        }

        async function submitEditOtprema(event) {
            event.preventDefault();

            var submitBtn = document.getElementById('submit-edit-otprema-btn');
            var messageDiv = document.getElementById('edit-otprema-message');

            submitBtn.disabled = true;
            submitBtn.textContent = 'Ažuriranje...';
            messageDiv.classList.add('hidden');

            try {
                var formData = new URLSearchParams();
                formData.append('path', 'update-pending');
                formData.append('username', currentUser.username);
                formData.append('password', currentPassword);
                formData.append('tip', 'otprema');
                formData.append('rowIndex', document.getElementById('edit-otprema-rowIndex').value);
                formData.append('datum', document.getElementById('edit-otprema-datum').value);
                formData.append('odjel', document.getElementById('edit-otprema-odjel').value);
                formData.append('kupac', document.getElementById('edit-otprema-kupac').value);
                formData.append('brojOtpremnice', document.getElementById('edit-otprema-broj-otpremnice').value);

                var sortimentiKeys = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'TRUPCI Č', 'CEL.DUGA', 'CEL.CIJEPANA', 'ČETINARI',
                                     'F/L L', 'I L', 'II L', 'III L', 'TRUPCI', 'OGR.DUGI', 'OGR.CIJEPANI', 'LIŠĆARI'];

                sortimentiKeys.forEach(function(key) {
                    var fieldId = 'edit-otprema-' + key.replace(/\//g, '').replace(/ /g, '-');
                    var value = document.getElementById(fieldId).value;
                    formData.append(key, value);
                });

                var url = API_URL + '?' + formData.toString();
                var response = await fetch(url);
                var result = await response.json();

                if (result.success) {
                    messageDiv.innerHTML = '✅ ' + result.message + '<br>Ukupno: ' + result.ukupno.toFixed(2) + ' m³';
                    messageDiv.style.background = '#dbeafe';
                    messageDiv.style.color = '#1e40af';
                    messageDiv.classList.remove('hidden');

                    setTimeout(function() {
                        switchTab('my-otpreme');
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Unknown error');
                }

            } catch (error) {
                messageDiv.innerHTML = '❌ Greška: ' + error.message;
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sačuvaj izmjene';
            }
        }

        function cancelEditOtprema() {
            switchTab('my-otpreme');
        }

        // Delete functions
        async function deleteMySjeca(rowIndex) {
            showConfirmModal(
                'Potvrda brisanja',
                'Da li ste sigurni da želite obrisati ovaj unos sječe?',
                async function() {
                    try {
                        var formData = new URLSearchParams();
                        formData.append('path', 'delete-pending');
                        formData.append('username', currentUser.username);
                        formData.append('password', currentPassword);
                        formData.append('tip', 'sjeca');
                        formData.append('rowIndex', rowIndex);

                        var url = API_URL + '?' + formData.toString();
                        var response = await fetch(url);
                        var result = await response.json();

                        if (result.success) {
                            showSuccess('Uspjeh', result.message);
                            loadMySjece();
                        } else {
                            throw new Error(result.error || 'Unknown error');
                        }
                    } catch (error) {
                        showError('Greška', error.message);
                    }
                }
            );
        }

        async function deleteMyOtprema(rowIndex) {
            showConfirmModal(
                'Potvrda brisanja',
                'Da li ste sigurni da želite obrisati ovaj unos otpreme?',
                async function() {
                    try {
                        var formData = new URLSearchParams();
                        formData.append('path', 'delete-pending');
                        formData.append('username', currentUser.username);
                        formData.append('password', currentPassword);
                        formData.append('tip', 'otprema');
                        formData.append('rowIndex', rowIndex);

                        var url = API_URL + '?' + formData.toString();
                        var response = await fetch(url);
                        var result = await response.json();

                        if (result.success) {
                            showSuccess('Uspjeh', result.message);
                            loadMyOtpreme();
                        } else {
                            throw new Error(result.error || 'Unknown error');
                        }
                    } catch (error) {
                        showError('Greška', error.message);
                    }
                }
            );
        }

        // ========== MOVED TO js/ui.js ==========
        // ============================================
        // ROW ACTIONS DROPDOWN
        // ============================================

        function toggleRowActions(id) {
            const dropdown = document.getElementById('row-actions-' + id);
            const allDropdowns = document.querySelectorAll('.row-actions-dropdown');

            // Close all other dropdowns
            allDropdowns.forEach(d => {
                if (d.id !== 'row-actions-' + id) {
                    d.classList.remove('show');
                }
            });

            // Toggle this dropdown
            dropdown.classList.toggle('show');
        }

        // Close row actions when clicking outside
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.row-actions')) {
                const allDropdowns = document.querySelectorAll('.row-actions-dropdown');
                allDropdowns.forEach(d => d.classList.remove('show'));
            }
        });

        // ============================================
        // OPERATIVA & ANALYTICS FUNCTIONS
        // ============================================

        // Load OPERATIVA screen and populate analytics
        function loadOperativa() {
            if (!isActiveTab('operativa')) return;
            document.getElementById('operativa-content').classList.remove('hidden');
            document.getElementById('loading-screen').classList.add('hidden');

            // Load stats data for current year
            const year = new Date().getFullYear();
            loadStatsForOperativa(year);
        }

        // Load and transform data for OPERATIVA screen
        async function loadStatsForOperativa(year) {
            try {
                // Fetch sva 3 endpointa PARALELNO (brže od sekvencijalnog)
                const dashboardUrl = buildApiUrl('dashboard', { year });
                const odjeliUrl = buildApiUrl('odjeli', { year });
                const stanjeOdjelaUrl = buildApiUrl('stanje-odjela');

                const [dashboardData, odjeliResponse, stanjeOdjelaData] = await Promise.all([
                    fetchWithCache(dashboardUrl, 'cache_dashboard_' + year, false, 60000),
                    fetchWithCache(odjeliUrl, 'cache_odjeli_' + year, false, 60000),
                    fetchWithCache(stanjeOdjelaUrl, 'cache_stanje_odjela'),
                ]);


                // DEBUG: Log odjeli count and total from API
                if (odjeliResponse && odjeliResponse.odjeli) {
                    const odjeliCount = odjeliResponse.odjeli.length;
                    const totalFromAPI = odjeliResponse.odjeli.reduce((sum, o) => sum + (o.sjeca || 0), 0);
                    if (Math.abs(totalFromAPI - 68171) > 1000) {
                    }
                }

                if (dashboardData.error || odjeliResponse.error) {
                    console.error('Error loading OPERATIVA data');
                    return;
                }

                // Transform dashboard data to OPERATIVA format
                const totalPrimka = dashboardData.mjesecnaStatistika.reduce((sum, m) => sum + (m.sjeca || 0), 0);
                const totalOtprema = dashboardData.mjesecnaStatistika.reduce((sum, m) => sum + (m.otprema || 0), 0);

                // Transform monthly stats: mjesecnaStatistika -> monthlyStats
                const monthlyStats = dashboardData.mjesecnaStatistika.map(m => ({
                    mjesec: m.mjesec,
                    sječa: m.sjeca || 0,
                    otprema: m.otprema || 0,
                    stanje: m.stanje || 0,
                    dinamika: m.dinamika || 0
                }));

                // **IMPROVED: Enrich odjeli data with PROJEKAT from STANJE ODJELA (red 10 Excel)**
                const odjeliStats = {};
                if (odjeliResponse.odjeli && odjeliResponse.odjeli.length > 0) {
                    odjeliResponse.odjeli.forEach(odjel => {
                        // Find matching odjel in STANJE ODJELA data
                        let projekatTotal = 0;
                        let radilisteNaziv = '';
                        let zadnjiDatum = null;

                        if (stanjeOdjelaData && stanjeOdjelaData.data && odjel.odjel) {
                            // ✅ Convert odjel.odjel to string to prevent "includes is not a function" error
                            const odjelStr = String(odjel.odjel || '').toLowerCase();
                            const stanjeMatch = stanjeOdjelaData.data.find(s =>
                                s.odjelNaziv.toLowerCase().includes(odjelStr) ||
                                odjelStr.includes(s.odjelNaziv.replace('.xlsx', '').toLowerCase())
                            );

                            if (stanjeMatch && stanjeMatch.redovi && stanjeMatch.redovi.projekat) {
                                // Sum all sortimenti from projekat row (red 10 iz Excel-a)
                                projekatTotal = stanjeMatch.redovi.projekat.reduce((sum, val) => sum + (val || 0), 0);
                                radilisteNaziv = stanjeMatch.radiliste || '';
                                zadnjiDatum = stanjeMatch.zadnjiDatum;

                                // DEBUG: Log projekat sources za GRMEČ JASENICA 39
                                const odjelDebugStr = String(odjel.odjel || '');
                                if (odjel.odjel && (odjelDebugStr.includes('JASENICA 39') || odjelDebugStr.includes('GRMEČ'))) {
                                }
                            }
                        }

                        // DEBUG: Check for duplicate odjeli
                        if (odjeliStats[odjel.odjel]) {
                        }

                        odjeliStats[odjel.odjel] = {
                            sječa: odjel.sjeca || 0,
                            otprema: odjel.otprema || 0,
                            projekat: (odjel.projekat && odjel.projekat > 0) ? odjel.projekat : projekatTotal, // Use odjel.projekat (U11) as primary source
                            ukupnoPosjeklo: odjel.sjeca || 0,
                            zadnjaSjeca: odjel.zadnjaSjeca || 0,
                            datumZadnjeSjece: odjel.datumZadnjeSjece || '',
                            radiliste: radilisteNaziv || odjel.radiliste || '',
                            izvođač: (odjel.izvođač || '').trim(), // Trim whitespace to prevent duplicates
                            zadnjiDatumUnosa: odjel.datumZadnjeSjece || '' // Use formatted date from odjel, not stanjeMatch
                        };
                    });
                }

                // Create transformed data object
                const transformedData = {
                    totalPrimka,
                    totalOtprema,
                    monthlyStats,
                    odjeliStats,
                    stanjeOdjelaRaw: stanjeOdjelaData // Pass raw data for additional features
                };


                // Load OPERATIVA with transformed data
                loadOperativaData(transformedData);
                markTabRendered('operativa');

            } catch (error) {
                console.error('Error in loadStatsForOperativa:', error);
            }
        }

        // Main data processing for Operativa screen
        function loadOperativaData(data) {

            // Calculate KPIs
            const totalPrimka = data.totalPrimka || 0;
            const totalOtprema = data.totalOtprema || 0;
            const ratio = totalOtprema > 0 ? (totalPrimka / totalOtprema).toFixed(2) : '0.00';

            // Count odjeli
            const odjeliCount = Object.keys(data.odjeliStats || {}).length;

            // Calculate average projekat completion
            let totalProjekat = 0;
            let totalOstvareno = 0;
            Object.values(data.odjeliStats || {}).forEach(stats => {
                totalProjekat += stats.projekat || 0;
                totalOstvareno += stats.ukupnoPosjeklo || stats.sječa || 0;
            });
            const procenatOstvarenja = totalProjekat > 0
                ? ((totalOstvareno / totalProjekat) * 100).toFixed(0)
                : '0';

            // Calculate monthly averages
            const monthlyStats = data.monthlyStats || [];
            const avgMonthlySjeca = monthlyStats.length > 0
                ? (monthlyStats.reduce((sum, m) => sum + (m.sječa || 0), 0) / monthlyStats.length).toFixed(2)
                : '0.00';
            const avgMonthlyOtprema = monthlyStats.length > 0
                ? (monthlyStats.reduce((sum, m) => sum + (m.otprema || 0), 0) / monthlyStats.length).toFixed(2)
                : '0.00';

            // Update KPI cards
            document.getElementById('kpi-ratio').textContent = ratio;
            document.getElementById('kpi-procenat').textContent = procenatOstvarenja + '%';
            document.getElementById('kpi-odjela').textContent = odjeliCount;
            document.getElementById('kpi-avg-sjeca').textContent = odjeliCount > 0
                ? (totalPrimka / odjeliCount).toFixed(0) + ' m³'
                : '0 m³';

            // Update monthly averages
            document.getElementById('avg-monthly-sjeca').textContent = avgMonthlySjeca + ' m³';
            document.getElementById('avg-monthly-otprema').textContent = avgMonthlyOtprema + ' m³';

            // Render components
            renderTopOdjeli(data.odjeliStats || {});
            renderProjekatOstvareno(data.odjeliStats || {});
            renderAnalyticsChart(monthlyStats);
            renderAnalyticsOdjeliTable(data.odjeliStats || {});

            // Render new features
            renderPerformanceAlerts(data.odjeliStats || {});
            renderIzvodjaciPerformance(data.odjeliStats || {});
            renderTimelineUnosi(data.odjeliStats || {});

            // Render additional analytics features
            renderSeasonalAnalysis(monthlyStats);
        }

        // Render Top 5 Odjela by Sječa
        function renderTopOdjeli(odjeliStats) {
            const sorted = Object.entries(odjeliStats)
                .sort((a, b) => (b[1].sječa || 0) - (a[1].sječa || 0))
                .slice(0, 5);

            const html = sorted.length > 0
                ? sorted.map((entry, index) => {
                    const [odjel, stats] = entry;
                    const rankClass = index < 3 ? 'top' : '';
                    return `
                        <div class="ranking-item">
                            <div class="ranking-number ${rankClass}">${index + 1}</div>
                            <div class="ranking-info">
                                <div class="ranking-name">${odjel}</div>
                                <div class="ranking-value">${(stats.sječa || 0).toFixed(2)} m³</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka</p>';

            document.getElementById('top-odjeli-list').innerHTML = html;
        }

        // Render Projekat vs Ostvareno progress bars
        function renderProjekatOstvareno(odjeliStats) {
            const sorted = Object.entries(odjeliStats)
                .filter(([_, stats]) => (stats.projekat || 0) > 0)
                .map(([odjel, stats]) => ({
                    odjel,
                    projekat: stats.projekat || 0,
                    ostvareno: stats.ukupnoPosjeklo || stats.sječa || 0,
                    procenat: (stats.projekat || 0) > 0
                        ? (((stats.ukupnoPosjeklo || stats.sječa || 0) / stats.projekat) * 100)
                        : 0
                }))
                .sort((a, b) => b.procenat - a.procenat)
                .slice(0, 5);

            const html = sorted.length > 0
                ? sorted.map(item => {
                    const barWidth = Math.min(item.procenat, 100);
                    const colorClass = item.procenat >= 90 ? 'green'
                                     : item.procenat >= 70 ? 'blue'
                                     : 'red';
                    const barColor = item.procenat >= 90 ? '#059669'
                                   : item.procenat >= 70 ? '#2563eb'
                                   : '#dc2626';

                    return `
                        <div style="margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span style="font-weight: 600; color: #1f2937;">${item.odjel}</span>
                                <span style="font-weight: 700; color: #059669;">${item.procenat.toFixed(1)}%</span>
                            </div>
                            <div class="progress-bar-container" style="height: 12px;">
                                <div class="progress-bar-fill ${colorClass}" style="width: ${barWidth}%; background: ${barColor};"></div>
                            </div>
                            <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                                ${item.ostvareno.toFixed(0)} / ${item.projekat.toFixed(0)} m³
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka o projektu</p>';

            document.getElementById('projekat-ostvareno-list').innerHTML = html;
        }

        // Render SVG Analytics Chart (Monthly Trend)
        function renderAnalyticsChart(monthlyStats) {
            const svg = document.getElementById('analytics-chart');
            if (!svg) return;

            const padding = { top: 20, right: 40, bottom: 40, left: 60 };
            const width = svg.clientWidth || 1000;
            const height = 300;
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;

            svg.innerHTML = '';
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

            // Empty state
            if (!monthlyStats || monthlyStats.length === 0) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', width / 2);
                text.setAttribute('y', height / 2);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '14');
                text.setAttribute('fill', '#6b7280');
                text.textContent = 'Nema podataka za prikaz';
                svg.appendChild(text);
                return;
            }

            // Calculate scales
            const maxValue = Math.max(
                ...monthlyStats.map(m => Math.max(m.sječa || 0, m.otprema || 0)),
                1
            );
            const yScale = chartHeight / (maxValue * 1.1);
            const xStep = chartWidth / (monthlyStats.length - 1);

            // Smooth path function
            function createSmoothPath(data, getValue) {
                const points = data.map((d, i) => ({
                    x: padding.left + i * xStep,
                    y: padding.top + chartHeight - getValue(d) * yScale
                }));

                if (points.length === 0) return '';

                let path = `M ${points[0].x} ${points[0].y}`;

                for (let i = 0; i < points.length - 1; i++) {
                    const current = points[i];
                    const next = points[i + 1];
                    const controlX = (current.x + next.x) / 2;
                    path += ` Q ${controlX} ${current.y}, ${controlX} ${(current.y + next.y) / 2}`;
                    path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
                }

                return path;
            }

            // Draw grid lines
            const gridLines = 5;
            for (let i = 0; i <= gridLines; i++) {
                const y = padding.top + (chartHeight / gridLines) * i;

                // Grid line
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', padding.left);
                line.setAttribute('y1', y);
                line.setAttribute('x2', width - padding.right);
                line.setAttribute('y2', y);
                line.setAttribute('stroke', '#e5e7eb');
                line.setAttribute('stroke-width', '1');
                svg.appendChild(line);

                // Y-axis label
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                const value = (maxValue * 1.1) * (1 - i / gridLines);
                label.setAttribute('x', padding.left - 10);
                label.setAttribute('y', y + 5);
                label.setAttribute('text-anchor', 'end');
                label.setAttribute('font-size', '12');
                label.setAttribute('fill', '#6b7280');
                label.textContent = value.toFixed(0);
                svg.appendChild(label);
            }

            // Draw Sječa line (green)
            const sjecaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            sjecaPath.setAttribute('d', createSmoothPath(monthlyStats, m => m.sječa || 0));
            sjecaPath.setAttribute('fill', 'none');
            sjecaPath.setAttribute('stroke', '#059669');
            sjecaPath.setAttribute('stroke-width', '3');
            sjecaPath.setAttribute('stroke-linecap', 'round');
            svg.appendChild(sjecaPath);

            // Draw Otprema line (blue)
            const otpremaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            otpremaPath.setAttribute('d', createSmoothPath(monthlyStats, m => m.otprema || 0));
            otpremaPath.setAttribute('fill', 'none');
            otpremaPath.setAttribute('stroke', '#2563eb');
            otpremaPath.setAttribute('stroke-width', '3');
            otpremaPath.setAttribute('stroke-linecap', 'round');
            svg.appendChild(otpremaPath);

            // Draw data points
            monthlyStats.forEach((m, i) => {
                const x = padding.left + i * xStep;

                // Sječa point
                const sjecaY = padding.top + chartHeight - (m.sječa || 0) * yScale;
                const sjecaCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                sjecaCircle.setAttribute('cx', x);
                sjecaCircle.setAttribute('cy', sjecaY);
                sjecaCircle.setAttribute('r', '4');
                sjecaCircle.setAttribute('fill', '#059669');
                sjecaCircle.setAttribute('stroke', 'white');
                sjecaCircle.setAttribute('stroke-width', '2');
                svg.appendChild(sjecaCircle);

                // Otprema point
                const otpremaY = padding.top + chartHeight - (m.otprema || 0) * yScale;
                const otpremaCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                otpremaCircle.setAttribute('cx', x);
                otpremaCircle.setAttribute('cy', otpremaY);
                otpremaCircle.setAttribute('r', '4');
                otpremaCircle.setAttribute('fill', '#2563eb');
                otpremaCircle.setAttribute('stroke', 'white');
                otpremaCircle.setAttribute('stroke-width', '2');
                svg.appendChild(otpremaCircle);

                // Month label
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', x);
                label.setAttribute('y', height - padding.bottom + 20);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('font-size', '11');
                label.setAttribute('fill', '#6b7280');
                label.textContent = (m.mjesec || '').substring(0, 3);
                svg.appendChild(label);
            });
        }

        // Render detailed analytics odjeli table
        function renderAnalyticsOdjeliTable(odjeliStats) {
            const html = Object.entries(odjeliStats).map(([odjel, stats]) => {
                const projekat = stats.projekat || 0;
                const ostvareno = stats.ukupnoPosjeklo || stats.sječa || 0;
                const procenat = projekat > 0 ? ((ostvareno / projekat) * 100).toFixed(1) : '0.0';
                const diff = (stats.sječa || 0) - (stats.otprema || 0);

                const procenatClass = procenat >= 90 ? 'green' : procenat >= 70 ? 'blue' : 'red';
                const diffClass = diff >= 0 ? 'green' : 'red';

                return `
                    <tr>
                        <td style="font-weight: 500;">${odjel}</td>
                        <td class="right green">${(stats.sječa || 0).toFixed(2)}</td>
                        <td class="right blue">${(stats.otprema || 0).toFixed(2)}</td>
                        <td class="right">${projekat.toFixed(2)}</td>
                        <td class="right ${procenatClass}">${procenat}%</td>
                        <td class="right ${diffClass}">${(diff >= 0 ? '+' : '') + diff.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');

            document.getElementById('analytics-odjeli-table').innerHTML = html || '<tr><td colspan="6" style="text-align: center; color: #6b7280;">Nema podataka</td></tr>';
        }

        // Render Performance Alerts Banner
        function renderPerformanceAlerts(odjeliStats) {
            const criticalAlerts = []; // 🔴 Kritično: > 5 dana bez unosa + projekat >> posječeno
            const warningAlerts = [];  // ⚠️ Upozorenje: posječena masa > 110% projekta (blizu 115% limite)

            const today = new Date();

            Object.entries(odjeliStats).forEach(([odjel, stats]) => {
                const projekat = stats.projekat || 0;
                const ostvareno = stats.sječa || 0;
                const zadnjiDatum = stats.zadnjiDatumUnosa || '';
                const procenat = projekat > 0 ? ((ostvareno / projekat) * 100) : 0;

                // FILTER: Ne prikazuj alerte za odjele gdje je zadnji unos stariji od 30 dana
                if (zadnjiDatum) {
                    const dateParts = zadnjiDatum.split('.');
                    if (dateParts.length === 3) {
                        const lastEntry = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
                        const daysSinceEntry = Math.floor((today - lastEntry) / (1000 * 60 * 60 * 24));

                        if (daysSinceEntry > 30) {
                            return; // Skip ovaj odjel kompletno
                        }

                        // Kriterijum 1: KRITIČNO - Nije bilo unosa > 5 dana + projekat daleko veći od posječenog
                        if (projekat > 0 && daysSinceEntry > 5 && procenat < 50) {
                            criticalAlerts.push({
                                odjel,
                                reason: `${daysSinceEntry} dana bez unosa, ${procenat.toFixed(0)}% plana`,
                                days: daysSinceEntry,
                                procenat: procenat.toFixed(0)
                            });
                        }
                    }
                }

                // Kriterijum 2: UPOZORENJE - Posječena masa > 110% projekta (blizu 115% limite za aneks)
                // Samo ako nije preskočen zbog 30-day filtera
                if (projekat > 0 && procenat > 110) {
                    warningAlerts.push({
                        odjel,
                        reason: `${procenat.toFixed(0)}% projekta - blizu limite za aneks (115%)`,
                        procenat: procenat.toFixed(0)
                    });
                }
            });


            const banner = document.getElementById('performance-alerts-banner');

            // Prikaži kritične alert-e ako postoje, inače upozorenja
            if (criticalAlerts.length > 0) {
                banner.className = 'alert-banner danger';
                banner.style.display = 'flex';
                banner.innerHTML = `
                    <span style="font-size: 24px;">🔴</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">KRITIČNO - Nema Unosa + Niska Realizacija</div>
                        <div style="font-size: 13px;">
                            ${criticalAlerts.length} odjel${criticalAlerts.length > 1 ? 'a' : ''}:
                            ${criticalAlerts.map(a => `${a.odjel} (${a.reason})`).join(', ')}
                        </div>
                    </div>
                `;
            } else if (warningAlerts.length > 0) {
                banner.className = 'alert-banner warning';
                banner.style.display = 'flex';
                banner.innerHTML = `
                    <span style="font-size: 24px;">⚠️</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">UPOZORENJE - Premašena Projektovana Masa</div>
                        <div style="font-size: 13px;">
                            ${warningAlerts.length} odjel${warningAlerts.length > 1 ? 'a' : ''} iznad 110% projekta:
                            ${warningAlerts.map(a => `${a.odjel} (${a.procenat}%)`).join(', ')}
                        </div>
                    </div>
                `;
            } else {
                // Sve je dobro - možda prikaži success banner?
                banner.className = 'alert-banner success';
                banner.style.display = 'flex';
                banner.innerHTML = `
                    <span style="font-size: 24px;">✅</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">SVE U REDU</div>
                        <div style="font-size: 13px;">
                            Nema kritičnih odjela - svi odjeli su unutar dozvoljenih parametara
                        </div>
                    </div>
                `;
            }
        }

        // Render Top Izvođači Performance
        function renderIzvodjaciPerformance(odjeliStats) {
            const izvodjaciMap = {};
            const izvodjaciOriginalNames = {}; // Track original names for display

            // Group by izvođač (normalized to prevent duplicates)
            Object.entries(odjeliStats).forEach(([odjel, stats]) => {
                let izvodjac = stats.izvođač || stats.izvodjac || '';
                izvodjac = izvodjac.trim(); // Remove whitespace

                if (!izvodjac || izvodjac === '') {
                    return; // Skip empty izvođači
                }

                // Normalize for grouping (uppercase, trim)
                const normalizedName = izvodjac.toUpperCase();
                const sjeca = stats.sječa || 0;


                if (!izvodjaciMap[normalizedName]) {
                    izvodjaciMap[normalizedName] = 0;
                    izvodjaciOriginalNames[normalizedName] = izvodjac; // Store first encountered name
                }
                izvodjaciMap[normalizedName] += sjeca;
            });


            // Calculate and log total suma
            const totalSuma = Object.values(izvodjaciMap).reduce((sum, val) => sum + val, 0);

            // Sort by volume and use original names for display
            const sorted = Object.entries(izvodjaciMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([normalizedName, volume]) => [izvodjaciOriginalNames[normalizedName], volume]);


            const html = sorted.length > 0
                ? sorted.map(([izvodjac, volume], index) => {
                    const rankClass = index < 3 ? 'top' : '';
                    return `
                        <div class="ranking-item">
                            <div class="ranking-number ${rankClass}">${index + 1}</div>
                            <div class="ranking-info">
                                <div class="ranking-name">${izvodjac}</div>
                                <div class="ranking-value">${volume.toFixed(2)} m³</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka o izvođačima</p>';

            document.getElementById('izvodjaci-performance-list').innerHTML = html;
        }

        // Render Timeline - Zadnji Unosi
        function renderTimelineUnosi(odjeliStats) {
            const timeline = [];

            Object.entries(odjeliStats).forEach(([odjel, stats]) => {
                const zadnjiDatum = stats.zadnjiDatumUnosa || stats.zadnjiUnos || '';
                if (zadnjiDatum) {
                    timeline.push({ odjel, datum: zadnjiDatum });
                }
            });


            // Sort by date (most recent first)
            timeline.sort((a, b) => {
                const dateA = new Date(a.datum.split('.').reverse().join('-'));
                const dateB = new Date(b.datum.split('.').reverse().join('-'));
                return dateB - dateA;
            });

            const html = timeline.length > 0
                ? timeline.slice(0, 10).map(item => {
                    // Calculate days since entry
                    const dateParts = item.datum.split('.');
                    const entryDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
                    const today = new Date();
                    const daysDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));

                    let statusClass = 'fresh';
                    let statusText = 'Svježe';
                    if (daysDiff > 30) {
                        statusClass = 'old';
                        statusText = `${daysDiff} dana`;
                    } else if (daysDiff > 7) {
                        statusClass = 'warning';
                        statusText = `${daysDiff} dana`;
                    } else if (daysDiff > 0) {
                        statusText = `prije ${daysDiff}d`;
                    }

                    return `
                        <div class="timeline-item">
                            <div class="timeline-date">${item.datum}</div>
                            <div class="timeline-content">
                                <div class="timeline-odjel">${item.odjel}</div>
                                <div class="timeline-status ${statusClass}">${statusText}</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka o unosima</p>';

            document.getElementById('timeline-unosi-list').innerHTML = html;
        }

        // Render Seasonal Analysis (Q1-Q4)
        function renderSeasonalAnalysis(monthlyStats) {

            // Define quarters
            const quarters = [
                { name: 'Q1', label: 'Jan-Mar', months: [0, 1, 2], icon: '❄️', color: '#3b82f6' },
                { name: 'Q2', label: 'Apr-Jun', months: [3, 4, 5], icon: '🌸', color: '#10b981' },
                { name: 'Q3', label: 'Jul-Sep', months: [6, 7, 8], icon: '☀️', color: '#f59e0b' },
                { name: 'Q4', label: 'Okt-Dec', months: [9, 10, 11], icon: '🍂', color: '#dc2626' }
            ];

            const html = quarters.map(q => {
                const quarterSjeca = q.months.reduce((sum, monthIdx) => {
                    return sum + (monthlyStats[monthIdx]?.sječa || 0);
                }, 0);

                const quarterOtprema = q.months.reduce((sum, monthIdx) => {
                    return sum + (monthlyStats[monthIdx]?.otprema || 0);
                }, 0);

                return `
                    <div class="kpi-card-small" style="background: linear-gradient(135deg, ${q.color}15 0%, ${q.color}25 100%); border-left-color: ${q.color};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span style="font-size: 28px;">${q.icon}</span>
                            <div style="text-align: right;">
                                <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase;">${q.name}</div>
                                <div style="font-size: 12px; color: #9ca3af;">${q.label}</div>
                            </div>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">Sječa</div>
                            <div style="font-size: 18px; font-weight: 700; color: #059669;">${quarterSjeca.toFixed(0)} m³</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">Otprema</div>
                            <div style="font-size: 18px; font-weight: 700; color: #2563eb;">${quarterOtprema.toFixed(0)} m³</div>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('seasonal-analysis').innerHTML = html;
        }

        // ============================================
        // ŠUMA LAGER (ZALIHA) FUNCTIONS
        // ============================================

        // Load ŠUMA LAGER screen and populate data
        function loadSumaLager() {
            // Load zaliha data from stanje-odjela endpoint
            // Note: suma-lager is now a submenu within stanje-odjela-admin
            loadZalihaData();
        }

        // Load and process ZALIHA data
        async function loadZalihaData() {
            try {
                // Fetch stanje-odjela data
                const stanjeOdjelaUrl = buildApiUrl('stanje-odjela');
                const stanjeData = await fetchWithCache(stanjeOdjelaUrl, 'cache_stanje_odjela_admin', false, 180000);

                if (!stanjeData || !stanjeData.data) {
                    console.error('No stanje-odjela data available');
                    return;
                }

                // Process data - filter only odjeli with zaliha
                const odjeliData = stanjeData.data;
                const sortimentiNazivi = stanjeData.sortimentiNazivi || [];

                const zalihaData = odjeliData.map(odjel => ({
                    odjel: odjel.odjel,
                    radiliste: odjel.radiliste || '',
                    izvodjac: odjel.izvođač || '',
                    zaliha: odjel.sumaPanj || 0,
                    sjeca: odjel.sjeca || 0,
                    otprema: odjel.otprema || 0,
                    percentOtprema: odjel.sjeca > 0 ? ((odjel.otprema / odjel.sjeca) * 100) : 0,
                    // Dodaj sortimentne podatke
                    sortimenti: {
                        zaliha: odjel.redovi?.sumaLager || [],
                        sjeca: odjel.redovi?.sjeca || [],
                        otprema: odjel.redovi?.otprema || []
                    }
                })).filter(o => o.zaliha > 0 || o.sjeca > 0); // Filter odjele sa zalihom ili sječom

                // Calculate KPIs
                const totalZaliha = zalihaData.reduce((sum, o) => sum + o.zaliha, 0);
                const avgZaliha = zalihaData.length > 0 ? totalZaliha / zalihaData.length : 0;
                const countOdjela = zalihaData.filter(o => o.zaliha > 0).length;

                // Update KPI cards
                document.getElementById('suma-lager-total').textContent = totalZaliha.toFixed(2) + ' m³';
                document.getElementById('suma-lager-average').textContent = avgZaliha.toFixed(2) + ' m³';
                document.getElementById('suma-lager-count').textContent = countOdjela;

                // Render components
                renderZalihaTop5(zalihaData);
                renderZalihaChart(zalihaData);
                renderZalihaTable(zalihaData, sortimentiNazivi);

            } catch (error) {
                console.error('Error loading Šuma Lager data:', error);
            }
        }

        // Render Top 5 Odjela by Zaliha
        function renderZalihaTop5(zalihaData) {
            const sorted = zalihaData
                .filter(o => o.zaliha > 0)
                .sort((a, b) => b.zaliha - a.zaliha)
                .slice(0, 5);

            const html = sorted.length > 0
                ? sorted.map((odjel, index) => {
                    const rankClass = index < 3 ? 'top' : '';
                    const medalColor = index === 0 ? '#fbbf24' : index === 1 ? '#d1d5db' : index === 2 ? '#f97316' : '#6b7280';
                    return `
                        <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: white; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
                            <div style="font-size: 32px; font-weight: 700; color: ${medalColor}; min-width: 40px; text-align: center;">
                                ${index + 1}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">
                                    ${odjel.odjel}
                                </div>
                                <div style="font-size: 12px; color: #6b7280;">
                                    ${odjel.radiliste ? odjel.radiliste : 'N/A'} • ${odjel.izvodjac ? odjel.izvodjac : 'N/A'}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 24px; font-weight: 700; color: #059669;">
                                    ${odjel.zaliha.toFixed(2)} m³
                                </div>
                                <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                                    Sječa: ${odjel.sjeca.toFixed(0)} m³
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka</p>';

            document.getElementById('suma-lager-top5').innerHTML = html;
        }

        // Render Zaliha Bar Chart
        function renderZalihaChart(zalihaData) {
            const sorted = zalihaData
                .filter(o => o.zaliha > 0)
                .sort((a, b) => b.zaliha - a.zaliha)
                .slice(0, 10);

            if (sorted.length === 0) {
                document.getElementById('suma-lager-chart').innerHTML = '<p style="color: #6b7280; text-align: center; padding: 40px;">Nema podataka za prikaz</p>';
                return;
            }

            const maxValue = Math.max(...sorted.map(o => o.zaliha), 1);

            const html = sorted.map((odjel, index) => {
                const percentage = (odjel.zaliha / maxValue) * 100;
                const barColor = index < 3 ? '#059669' : index < 6 ? '#2563eb' : '#6b7280';
                return `
                    <div style="margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 14px; font-weight: 600; color: #1f2937;">${odjel.odjel}</span>
                            <span style="font-size: 14px; font-weight: 700; color: ${barColor};">${odjel.zaliha.toFixed(2)} m³</span>
                        </div>
                        <div style="background: #e5e7eb; height: 32px; border-radius: 6px; overflow: hidden; position: relative;">
                            <div style="background: ${barColor}; height: 100%; width: ${percentage}%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: flex-end; padding-right: 12px;">
                                <span style="font-size: 11px; color: white; font-weight: 600;">${percentage.toFixed(0)}%</span>
                            </div>
                        </div>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                            Sječa: ${odjel.sjeca.toFixed(0)} m³ | Otprema: ${odjel.otprema.toFixed(0)} m³
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('suma-lager-chart').innerHTML = html;
        }

        // Render Zaliha Table - Sortimentni prikaz po odjelima
        function renderZalihaTable(zalihaData, sortimentiNazivi) {
            const sorted = zalihaData.sort((a, b) => b.zaliha - a.zaliha);

            if (sorted.length === 0) {
                document.getElementById('suma-lager-table').innerHTML =
                    '<tr><td colspan="19" style="text-align: center; color: #6b7280; padding: 40px;">Nema podataka</td></tr>';
                return;
            }

            const html = sorted.map((odjel, index) => {
                const odjelId = `odjel-${index}`;
                const odjelClass = `odjel-group-${index}`;

                // Helper funkcija za formatiranje brojeva
                const formatNumber = (val) => {
                    if (val === null || val === undefined || val === '') return '0.00';
                    const num = parseFloat(val);
                    return isNaN(num) ? '0.00' : num.toFixed(2);
                };

                // Helper funkcija za renderovanje reda sa sortimentnim podacima
                const renderSortimentRow = (label, data, bgColor, textColor, isBold = false) => {
                    const style = `background: ${bgColor}; color: ${textColor}; ${isBold ? 'font-weight: 700;' : ''}`;
                    const cells = data.map(val =>
                        `<td class="right" style="${style}">${formatNumber(val)}</td>`
                    ).join('');

                    return `
                        <tr class="${odjelClass}" data-odjel="${odjel.odjel.toLowerCase()}">
                            <td style="${style} padding-left: 20px;">${label}</td>
                            ${cells}
                        </tr>
                    `;
                };

                // Zaglavlje odjela
                const headerRow = `
                    <tr class="${odjelClass} odjel-header" data-odjel="${odjel.odjel.toLowerCase()}" style="background: #1f2937;">
                        <td colspan="19" style="font-weight: 700; color: white; padding: 12px 16px; font-size: 14px;">
                            ${odjel.odjel}
                        </td>
                    </tr>
                `;

                // Redovi za sortimente
                const projekatRow = renderSortimentRow(
                    'PROJEKAT',
                    odjel.redovi.projekat || [],
                    '#fef3c7',  // svijetlo žuta
                    '#92400e',  // tamno smeđa
                    false
                );

                const sjecaRow = renderSortimentRow(
                    'SJEČA',
                    odjel.redovi.sjeca || [],
                    '#d1fae5',  // svijetlo zelena
                    '#065f46',  // tamno zelena
                    false
                );

                const otpremaRow = renderSortimentRow(
                    'OTPREMA',
                    odjel.redovi.otprema || [],
                    '#dbeafe',  // svijetlo plava
                    '#1e40af',  // tamno plava
                    false
                );

                const sumaLagerRow = renderSortimentRow(
                    'ŠUMA-LAGER',
                    odjel.redovi.sumaLager || [],
                    '#1f2937',  // tamno siva/crna
                    '#f9fafb',  // bijela
                    true
                );

                return headerRow + projekatRow + sjecaRow + otpremaRow + sumaLagerRow;
            }).join('');

            document.getElementById('suma-lager-table').innerHTML = html;
        }

        // Toggle sortimenti visibility
        function toggleSortimenti(odjelId) {
            const sortimentiRow = document.getElementById(`${odjelId}-sortimenti`);
            const icon = document.getElementById(`${odjelId}-icon`);

            if (sortimentiRow) {
                const isHidden = sortimentiRow.style.display === 'none';
                sortimentiRow.style.display = isHidden ? 'table-row' : 'none';
                icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
            }
        }

        // Filter Zaliha Table by search - prilagođeno za sortimentni prikaz
        function filterSumaLagerTable() {
            const searchInput = document.getElementById('suma-lager-search').value.toLowerCase();
            const table = document.getElementById('suma-lager-main-table');
            const tbody = table.querySelector('tbody');
            const rows = tbody ? tbody.getElementsByTagName('tr') : [];

            // Grupiši redove po odjelu
            const odjeliGroups = {};
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const odjelName = row.getAttribute('data-odjel');
                if (odjelName) {
                    if (!odjeliGroups[odjelName]) {
                        odjeliGroups[odjelName] = [];
                    }
                    odjeliGroups[odjelName].push(row);
                }
            }

            // Filtriraj po odjelu
            Object.keys(odjeliGroups).forEach(odjelName => {
                const shouldShow = odjelName.includes(searchInput);
                odjeliGroups[odjelName].forEach(row => {
                    row.style.display = shouldShow ? '' : 'none';
                });
            });
        }

        // Render Mjesečni Trend Kupaca
        async function renderKupciMjesecniTrend() {

            try {
                const year = new Date().getFullYear();
                const kupciUrl = buildApiUrl('otpremaci', { year });
                const kupciData = await fetchWithCache(kupciUrl, 'cache_kupci_' + year);


                if (!kupciData || !kupciData.mjesecni) {
                    document.getElementById('kupci-mjesecni-tbody').innerHTML = '<tr><td colspan="14" style="text-align: center; color: #6b7280;">Nema podataka</td></tr>';
                    return;
                }

                // Group mjesecni by kupac
                const kupciMap = {};
                kupciData.mjesecni.forEach(entry => {
                    const kupac = entry.kupac || 'Nepoznat';
                    const mjesec = entry.mjesec; // 0-11
                    const ukupno = entry.ukupno || 0;

                    if (!kupciMap[kupac]) {
                        kupciMap[kupac] = new Array(12).fill(0);
                    }
                    kupciMap[kupac][mjesec] = ukupno;
                });

                // Calculate total per kupac and sort
                const kupciArray = Object.entries(kupciMap).map(([kupac, mjeseci]) => {
                    const total = mjeseci.reduce((sum, val) => sum + val, 0);
                    return { kupac, mjeseci, total };
                }).sort((a, b) => b.total - a.total).slice(0, 15); // Top 15 kupaca


                const html = kupciArray.map(k => {
                    return `
                        <tr>
                            <td style="font-weight: 500;">${k.kupac}</td>
                            ${k.mjeseci.map(val => {
                                const display = val > 0 ? val.toFixed(0) : '-';
                                const color = val > 1000 ? 'color: #059669; font-weight: 600;' : '';
                                return `<td class="right" style="${color}">${display}</td>`;
                            }).join('')}
                            <td class="right" style="font-weight: 700; color: #1f2937;">${k.total.toFixed(0)}</td>
                        </tr>
                    `;
                }).join('');

                document.getElementById('kupci-mjesecni-tbody').innerHTML = html || '<tr><td colspan="14" style="text-align: center; color: #6b7280;">Nema podataka</td></tr>';
            } catch (error) {
                console.error('Error loading kupci mjesecni trend:', error);
                document.getElementById('kupci-mjesecni-tbody').innerHTML = '<tr><td colspan="14" style="text-align: center; color: #dc2626;">Greška pri učitavanju</td></tr>';
            }
        }

        // Filter analytics table by search
        function filterAnalyticsTable() {
            const searchValue = document.getElementById('analytics-search').value.toLowerCase();
            const table = document.getElementById('analytics-odjeli-main-table');
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
                const odjelName = row.cells[0].textContent.toLowerCase();
                if (odjelName.includes(searchValue)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        // ============================================
        // DINAMIKA FUNKCIJE
        // ============================================

        // Load dinamika data
        async function loadDinamika() {
            if (!isActiveTab('dinamika')) return;
            const container = document.getElementById('dinamika-container');

            const year = new Date().getFullYear();
            document.getElementById('dinamika-selected-year').textContent = year;

            // Turbo: skip loading screen if cache exists
            var dinCacheKey = 'cache_dinamika_' + year;
            if (!localStorage.getItem(dinCacheKey)) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('dinamika-content').classList.add('hidden');
            } else {
                document.getElementById('dinamika-content').classList.remove('hidden');
            }

            try {
                const url = buildApiUrl('get_dinamika', { year });
                const data = await fetchWithCache(url, dinCacheKey);


                if (data.error) {
                    throw new Error(data.error);
                }

                // Popuni input polja sa mjesečnim vrijednostima
                const mjeseci = data.dinamika || {};
                for (let i = 1; i <= 12; i++) {
                    const mjesecKey = String(i).padStart(2, '0');
                    const inputId = 'dinamika-' + mjesecKey;
                    const value = mjeseci[mjesecKey] || 0;
                    document.getElementById(inputId).value = value > 0 ? value : '';
                }

                // Izračunaj ukupno
                calculateDinamikaTotal();

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('dinamika-content').classList.remove('hidden');
                markTabRendered('dinamika');

            } catch (error) {
                console.error('Error loading dinamika:', error);
                showError('Greška', 'Greška pri učitavanju dinamike: ' + error.message);
            }
        }

        // Calculate total dinamika
        function calculateDinamikaTotal() {
            let total = 0;
            for (let i = 1; i <= 12; i++) {
                const mjesecKey = String(i).padStart(2, '0');
                const inputId = 'dinamika-' + mjesecKey;
                const value = parseFloat(document.getElementById(inputId).value) || 0;
                total += value;
            }
            document.getElementById('dinamika-total').textContent = total.toFixed(2);
        }

        // Save dinamika
        async function saveDinamika(event) {
            event.preventDefault();

            const year = new Date().getFullYear(); // Tekuća godina (2026)

            // Prikupi mjesečne vrijednosti
            const mjeseci = {};
            for (let i = 1; i <= 12; i++) {
                const mjesecKey = String(i).padStart(2, '0');
                const inputId = 'dinamika-' + mjesecKey;
                const value = parseFloat(document.getElementById(inputId).value) || 0;
                mjeseci[mjesecKey] = value;
            }

            try {
                showInfo('💾 Spremanje...', 'Spremam mjesečnu dinamiku...');

                // Koristi GET sa URL parametrima da izbjegneš CORS problem
                const mjeseciJson = encodeURIComponent(JSON.stringify(mjeseci));
                const url = buildApiUrl('save_dinamika', { godina: year, mjeseci: mjeseciJson });


                const response = await fetch(url, {
                    method: 'GET'
                });

                const result = await response.json();


                if (result.success) {
                    showSuccess('✅ Spremljeno!', 'Mjesečna dinamika uspješno spremljena.');

                    // Clear cache and reload
                    localStorage.removeItem('cache_dinamika_' + year);
                    localStorage.removeItem('cache_dashboard_' + year);
                    loadDinamika();
                } else {
                    throw new Error(result.error || 'Greška pri spremanju');
                }

            } catch (error) {
                console.error('Error saving dinamika:', error);
                showError('Greška', 'Nije uspjelo spremanje dinamike: ' + error.message);
            }
        }

        // Dinamika event listeners moved to main DOMContentLoaded listener (line ~4785)

        // ========== MOVED TO js/charts.js ==========
        // ========================================
        // PRIMAČ/OTPREMAČ IZVJEŠTAJI - Sedmični i Mjesečni
        // ========================================

        // Load sedmični izvještaj za primača (suma po sortimentima za sedmice)
        async function loadPrimacSedmicni() {
            var psYear = document.getElementById('primac-sedmicni-year').value;
            var psMonth = document.getElementById('primac-sedmicni-month').value;
            var psCK = `cache_primac_sedmicni_${psYear}_${psMonth}`;
            if (!localStorage.getItem(psCK)) {
                document.getElementById('loading-screen').classList.remove('hidden');
            }

            try {
                const year = psYear;
                const month = psMonth;

                const url = buildApiUrl('primac-detail', { year });
                const response = await fetchWithCache(url, psCK);

                if (response.error) throw new Error(response.error);

                // primac-detail API returns { sortimentiNazivi: [...], unosi: [...] }
                // where unosi is already formatted with { datum, odjel, sortimenti: {}, ukupno }
                const data = response.unosi || [];
                const sortimentiNazivi = response.sortimentiNazivi || [...SORTIMENTI_ORDER];

                // Filter by year/month
                const filteredData = data.filter(row => {
                    if (!row.datum) return false;
                    const dateParts = row.datum.split(/[\/\.\-]/);
                    const day = parseInt(dateParts[0]);
                    const recordMonth = parseInt(dateParts[1]) - 1;
                    const recordYear = parseInt(dateParts[2]);
                    return recordYear === parseInt(year) && recordMonth === parseInt(month);
                });

                // Convert unosi format to primke format for grouping function
                const primkeFormat = [];
                filteredData.forEach(unos => {
                    // Each unos has sortimenti: { "sortiment1": quantity, "sortiment2": quantity, ... }
                    // Convert to separate rows for each sortiment
                    Object.keys(unos.sortimenti || {}).forEach(sortiment => {
                        const kolicina = unos.sortimenti[sortiment];
                        if (kolicina > 0) {
                            primkeFormat.push({
                                datum: unos.datum,
                                odjel: unos.odjel,
                                sortiment: sortiment,
                                kolicina: kolicina
                            });
                        }
                    });
                });

                // Group by weeks
                const weeklyData = groupPrimacOtpremacDataByWeeks(primkeFormat, year, month, sortimentiNazivi);

                // Render table
                renderPrimacOtpremacSedmicni(weeklyData, sortimentiNazivi, 'primac-sedmicni', year, month);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading primač sedmični izvještaj:', error);
                showError('Greška', 'Greška pri učitavanju sedmičnog izvještaja: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Load mjesečni izvještaj za primača (suma po sortimentima za mjesec)
        async function loadPrimacMjesecni() {
            var pmYear = document.getElementById('primac-mjesecni-year').value;
            var pmMonth = document.getElementById('primac-mjesecni-month').value;
            var pmCK = `cache_primac_mjesecni_${pmYear}_${pmMonth}`;
            if (!localStorage.getItem(pmCK)) {
                document.getElementById('loading-screen').classList.remove('hidden');
            }

            try {
                const year = pmYear;
                const month = pmMonth;

                const url = buildApiUrl('primac-detail', { year });
                const response = await fetchWithCache(url, pmCK);

                if (response.error) throw new Error(response.error);

                // primac-detail API returns { sortimentiNazivi: [...], unosi: [...] }
                const data = response.unosi || [];
                const sortimentiNazivi = response.sortimentiNazivi || [...SORTIMENTI_ORDER];

                // Filter by year/month
                const filteredData = data.filter(row => {
                    if (!row.datum) return false;
                    const dateParts = row.datum.split(/[\/\.\-]/);
                    const recordMonth = parseInt(dateParts[1]) - 1;
                    const recordYear = parseInt(dateParts[2]);
                    return recordYear === parseInt(year) && recordMonth === parseInt(month);
                });

                // ✅ NEW: Group by ODJEL (department) instead of just summing
                const odjeliMap = {};
                filteredData.forEach(row => {
                    const odjel = String(row.odjel || 'Nepoznat');

                    if (!odjeliMap[odjel]) {
                        odjeliMap[odjel] = {};
                        sortimentiNazivi.forEach(s => odjeliMap[odjel][s] = 0);
                    }

                    // Sum sortimenti for this odjel
                    Object.keys(row.sortimenti || {}).forEach(sortiment => {
                        const kolicina = parseFloat(row.sortimenti[sortiment]) || 0;
                        if (odjeliMap[odjel].hasOwnProperty(sortiment)) {
                            odjeliMap[odjel][sortiment] += kolicina;
                        }
                    });
                });

                // Convert to array and sort by odjel name
                const odjeliData = Object.keys(odjeliMap).map(odjel => ({
                    odjel: odjel,
                    sortimenti: odjeliMap[odjel]
                })).sort((a, b) => a.odjel.localeCompare(b.odjel));

                // Render table grouped by odjeli
                renderMjesecniByOdjeli(odjeliData, sortimentiNazivi, 'primac-mjesecni', year, month);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading primač mjesečni izvještaj:', error);
                showError('Greška', 'Greška pri učitavanju mjesečnog izvještaja: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Load sedmični izvještaj za otpremača (suma po sortimentima za sedmice)
        async function loadOtpremacSedmicni() {
            var osYear = document.getElementById('otpremac-sedmicni-year').value;
            var osMonth = document.getElementById('otpremac-sedmicni-month').value;
            var osCK = `cache_otpremac_sedmicni_${osYear}_${osMonth}`;
            if (!localStorage.getItem(osCK)) {
                document.getElementById('loading-screen').classList.remove('hidden');
            }

            try {
                const year = osYear;
                const month = osMonth;

                const url = buildApiUrl('otpremac-detail', { year });
                const response = await fetchWithCache(url, osCK);

                if (response.error) throw new Error(response.error);

                // otpremac-detail API returns { sortimentiNazivi: [...], unosi: [...] }
                const data = response.unosi || [];
                const sortimentiNazivi = response.sortimentiNazivi || [...SORTIMENTI_ORDER];

                // Filter by year/month
                const filteredData = data.filter(row => {
                    if (!row.datum) return false;
                    const dateParts = row.datum.split(/[\/\.\-]/);
                    const recordMonth = parseInt(dateParts[1]) - 1;
                    const recordYear = parseInt(dateParts[2]);
                    return recordYear === parseInt(year) && recordMonth === parseInt(month);
                });

                // Convert unosi format to otpreme format for grouping function
                const otpremeFormat = [];
                filteredData.forEach(unos => {
                    Object.keys(unos.sortimenti || {}).forEach(sortiment => {
                        const kolicina = unos.sortimenti[sortiment];
                        if (kolicina > 0) {
                            otpremeFormat.push({
                                datum: unos.datum,
                                odjel: unos.odjel,
                                sortiment: sortiment,
                                kolicina: kolicina
                            });
                        }
                    });
                });

                // Group by weeks
                const weeklyData = groupPrimacOtpremacDataByWeeks(otpremeFormat, year, month, sortimentiNazivi);

                // Render table
                renderPrimacOtpremacSedmicni(weeklyData, sortimentiNazivi, 'otpremac-sedmicni', year, month);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading otpremač sedmični izvještaj:', error);
                showError('Greška', 'Greška pri učitavanju sedmičnog izvještaja: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Load mjesečni izvještaj za otpremača (suma po sortimentima za mjesec)
        async function loadOtpremacMjesecni() {
            var omYear = document.getElementById('otpremac-mjesecni-year').value;
            var omMonth = document.getElementById('otpremac-mjesecni-month').value;
            var omCK = `cache_otpremac_mjesecni_${omYear}_${omMonth}`;
            if (!localStorage.getItem(omCK)) {
                document.getElementById('loading-screen').classList.remove('hidden');
            }

            try {
                const year = omYear;
                const month = omMonth;

                const url = buildApiUrl('otpremac-detail', { year });
                const response = await fetchWithCache(url, omCK);

                if (response.error) throw new Error(response.error);

                // otpremac-detail API returns { sortimentiNazivi: [...], unosi: [...] }
                const data = response.unosi || [];
                const sortimentiNazivi = response.sortimentiNazivi || [...SORTIMENTI_ORDER];

                // Filter by year/month
                const filteredData = data.filter(row => {
                    if (!row.datum) return false;
                    const dateParts = row.datum.split(/[\/\.\-]/);
                    const recordMonth = parseInt(dateParts[1]) - 1;
                    const recordYear = parseInt(dateParts[2]);
                    return recordYear === parseInt(year) && recordMonth === parseInt(month);
                });

                // ✅ NEW: Group by ODJEL (department) instead of just summing
                const odjeliMap = {};
                filteredData.forEach(row => {
                    const odjel = String(row.odjel || 'Nepoznat');

                    if (!odjeliMap[odjel]) {
                        odjeliMap[odjel] = {};
                        sortimentiNazivi.forEach(s => odjeliMap[odjel][s] = 0);
                    }

                    // Sum sortimenti for this odjel
                    Object.keys(row.sortimenti || {}).forEach(sortiment => {
                        const kolicina = parseFloat(row.sortimenti[sortiment]) || 0;
                        if (odjeliMap[odjel].hasOwnProperty(sortiment)) {
                            odjeliMap[odjel][sortiment] += kolicina;
                        }
                    });
                });

                // Convert to array and sort by odjel name
                const odjeliData = Object.keys(odjeliMap).map(odjel => ({
                    odjel: odjel,
                    sortimenti: odjeliMap[odjel]
                })).sort((a, b) => a.odjel.localeCompare(b.odjel));

                // Render table grouped by odjeli
                renderMjesecniByOdjeli(odjeliData, sortimentiNazivi, 'otpremac-mjesecni', year, month);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading otpremač mjesečni izvještaj:', error);
                showError('Greška', 'Greška pri učitavanju mjesečnog izvještaja: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Group primac/otpremac data by weeks (simple version - just sum sortimenti per week)
        function groupPrimacOtpremacDataByWeeks(data, year, month, sortimentiNazivi) {
            const weeksMap = new Map();

            const y = parseInt(year);
            const m = parseInt(month);

            // PRVO: Inicijalizuj SVE sedmice u mjesecu (sa nulama)
            const firstDayOfMonth = new Date(y, m, 1);
            const lastDayOfMonth = new Date(y, m + 1, 0);

            // Prođi kroz sve dane mjeseca i determiniši sedmice
            for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
                const datum = new Date(y, m, day);
                const weekInfo = getWeekWithinMonth(datum, y, m);
                const weekKey = weekInfo.weekNumber;

                if (!weeksMap.has(weekKey)) {
                    weeksMap.set(weekKey, {
                        weekNumber: weekKey,
                        weekStart: weekInfo.weekStart,
                        weekEnd: weekInfo.weekEnd,
                        sortimentiSums: {}
                    });
                    // Inicijalizuj sve sortimente sa 0
                    sortimentiNazivi.forEach(s => weeksMap.get(weekKey).sortimentiSums[s] = 0);
                }
            }

            // DRUGO: Popuni podatke iz data array-a
            data.forEach(row => {
                if (!row.datum || !row.sortiment || !row.kolicina) return;

                const dateParts = row.datum.split(/[\/\.\-]/);
                const day = parseInt(dateParts[0]);
                const recordMonth = parseInt(dateParts[1]) - 1;
                const recordYear = parseInt(dateParts[2]);

                if (recordYear !== y || recordMonth !== m) return;

                const datum = new Date(recordYear, recordMonth, day);
                const weekInfo = getWeekWithinMonth(datum, y, m);
                const weekKey = weekInfo.weekNumber;

                const week = weeksMap.get(weekKey);
                if (!week) return; // Safety check

                const sortiment = row.sortiment;
                const kolicina = parseFloat(row.kolicina) || 0;

                if (!week.sortimentiSums[sortiment]) {
                    week.sortimentiSums[sortiment] = 0;
                }
                week.sortimentiSums[sortiment] += kolicina;
            });

            // Konvertuj u array i sortiraj po broju sedmice
            const weeks = [];
            weeksMap.forEach(week => weeks.push(week));
            weeks.sort((a, b) => a.weekNumber - b.weekNumber);

            return weeks;
        }

        // ============================================
        // 📊 RADNICI SEDMIČNI IZVJEŠTAJ - Uniformne boje
        // ============================================
        function renderPrimacOtpremacSedmicni(weeklyData, sortimentiNazivi, tablePrefix, year, month) {
            const header = document.getElementById(`${tablePrefix}-header`);
            const body = document.getElementById(`${tablePrefix}-body`);
            const footer = document.getElementById(`${tablePrefix}-footer`);

            // ========== HEADER ==========
            // Uniformna tamno siva boja za sve kolone
            let headerHtml = '<tr><th>Sedmica</th>';
            sortimentiNazivi.forEach(sortiment => {
                headerHtml += `<th>${sortiment}</th>`;
            });
            headerHtml += '</tr>';
            header.innerHTML = headerHtml;

            // ========== BODY ==========
            // Čisti bijeli/sivi naizmjenični redovi
            let bodyHtml = '';
            const monthTotals = {};
            sortimentiNazivi.forEach(s => monthTotals[s] = 0);

            if (weeklyData.length === 0) {
                bodyHtml = `<tr><td colspan="${sortimentiNazivi.length + 1}" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za odabrani period</td></tr>`;
            } else {
                weeklyData.forEach((week) => {
                    bodyHtml += '<tr>';
                    bodyHtml += `<td><strong>Sedmica ${week.weekNumber}</strong><br><span style="color: #6b7280; font-size: 12px;">${week.weekStart} - ${week.weekEnd}</span></td>`;

                    sortimentiNazivi.forEach(sortiment => {
                        let value = week.sortimentiSums[sortiment] || 0;

                        // SVEUKUPNO = samo ČETINARI + LIŠĆARI
                        if (sortiment === 'SVEUKUPNO') {
                            value = (week.sortimentiSums['ČETINARI'] || 0) + (week.sortimentiSums['LIŠĆARI'] || 0);
                        }

                        monthTotals[sortiment] += value;
                        const displayValue = value > 0 ? value.toFixed(2) : '-';
                        bodyHtml += `<td>${displayValue}</td>`;
                    });

                    bodyHtml += '</tr>';
                });
            }

            body.innerHTML = bodyHtml;

            // ========== FOOTER ==========
            // Zelena pozadina za UKUPNO
            let footerHtml = '<tr class="totals-row">';
            footerHtml += '<td>📊 UKUPNO MJESEC</td>';
            sortimentiNazivi.forEach(sortiment => {
                let total = monthTotals[sortiment];

                if (sortiment === 'SVEUKUPNO') {
                    total = (monthTotals['ČETINARI'] || 0) + (monthTotals['LIŠĆARI'] || 0);
                }

                const display = total > 0 ? total.toFixed(2) : '-';
                footerHtml += `<td>${display}</td>`;
            });
            footerHtml += '</tr>';
            footer.innerHTML = footerHtml;
        }

        // ============================================
        // 📅 RADNICI MJESEČNI IZVJEŠTAJ - Uniformne boje
        // ============================================
        function renderMjesecniByOdjeli(odjeliData, sortimentiNazivi, tablePrefix, year, month) {
            const header = document.getElementById(`${tablePrefix}-header`);
            const body = document.getElementById(`${tablePrefix}-body`);
            const footer = document.getElementById(`${tablePrefix}-footer`);

            if (!header || !body || !footer) {
                console.error('Table elements not found for prefix:', tablePrefix);
                return;
            }

            // ========== HEADER ==========
            // Uniformna tamno siva boja za sve kolone
            let headerHtml = '<tr><th>Odjel</th>';
            sortimentiNazivi.forEach(sortiment => {
                headerHtml += `<th>${sortiment}</th>`;
            });
            headerHtml += '</tr>';
            header.innerHTML = headerHtml;

            // ========== BODY ==========
            // Čisti bijeli/sivi naizmjenični redovi
            let bodyHtml = '';
            const totals = {};
            sortimentiNazivi.forEach(s => totals[s] = 0);

            if (odjeliData.length === 0) {
                bodyHtml = `<tr><td colspan="${sortimentiNazivi.length + 1}" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za izabrani mjesec</td></tr>`;
            } else {
                odjeliData.forEach((row) => {
                    bodyHtml += '<tr>';
                    bodyHtml += `<td>${row.odjel}</td>`;

                    sortimentiNazivi.forEach(sortiment => {
                        let value = row.sortimenti[sortiment] || 0;

                        // SVEUKUPNO = samo ČETINARI + LIŠĆARI
                        if (sortiment === 'SVEUKUPNO') {
                            value = (row.sortimenti['ČETINARI'] || 0) + (row.sortimenti['LIŠĆARI'] || 0);
                        }

                        totals[sortiment] += value;
                        const displayValue = value > 0 ? value.toFixed(2) : '-';
                        bodyHtml += `<td>${displayValue}</td>`;
                    });

                    bodyHtml += '</tr>';
                });
            }

            body.innerHTML = bodyHtml;

            // ========== FOOTER ==========
            // Zelena pozadina za UKUPNO
            let footerHtml = '<tr class="totals-row">';
            footerHtml += '<td>📊 UKUPNO MJESEC</td>';

            sortimentiNazivi.forEach(sortiment => {
                let total = totals[sortiment];

                if (sortiment === 'SVEUKUPNO') {
                    total = (totals['ČETINARI'] || 0) + (totals['LIŠĆARI'] || 0);
                }

                const display = total > 0 ? total.toFixed(2) : '-';
                footerHtml += `<td>${display}</td>`;
            });

            footerHtml += '</tr>';
            footer.innerHTML = footerHtml;
        }

        // ========================================
        // KUBIKATOR - Kalkulator zapremine oblog drveta
        // ========================================

        // Globalna varijabla za čuvanje izračuna
        let kubikatorIzracuni = [];

        // Izračunaj zapreminu pomoću Huber metode
        function izracunajKubikazu() {
            const promjer = parseFloat(document.getElementById('kubikator-promjer').value);
            const duzina = parseFloat(document.getElementById('kubikator-duzina').value);

            // Validacija prečnika (7-150 cm)
            if (!promjer || promjer < 7 || promjer > 150) {
                showError('Greška', 'Prečnik mora biti između 7 i 150 cm');
                return;
            }

            // Validacija dužine (2-8 m)
            if (!duzina || duzina < 2 || duzina > 8) {
                showError('Greška', 'Dužina mora biti između 2 i 8 metara');
                return;
            }

            // Huber formula: V = π × (d/200)² × L
            // d = prečnik u cm
            // L = dužina u metrima
            // Količina je uvijek 1 komad
            const zapremina = Math.PI * Math.pow(promjer / 200, 2) * duzina;

            // Dodaj u listu izračuna
            kubikatorIzracuni.push({
                promjer: promjer,
                duzina: duzina,
                zapremina: zapremina
            });

            // Prikaži rezultat
            document.getElementById('kubikator-obujam-display').textContent = zapremina.toFixed(2);
            document.getElementById('kubikator-rezultat').style.display = 'block';

            // Ažuriraj datum u header-u rekapitulacije
            const danas = new Date();
            const datumStr = danas.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
            document.getElementById('kubikator-datum').textContent = datumStr;

            // Ažuriraj tabelu
            azurirajKubikatorTabelu();

            // Prikaži tabelu
            document.getElementById('kubikator-tabela-container').style.display = 'block';

            // Očisti input polja za sljedeći unos
            document.getElementById('kubikator-promjer').value = '';
            document.getElementById('kubikator-duzina').value = '';
        }

        // Ažuriraj tabelu sa svim izračunima
        function azurirajKubikatorTabelu() {
            const tbody = document.getElementById('kubikator-tabela-body');
            let html = '';

            let ukupnoKom = kubikatorIzracuni.length;
            let ukupnoM3 = 0;

            kubikatorIzracuni.forEach((izracun, index) => {
                ukupnoM3 += izracun.zapremina;

                html += `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="text-align: center; padding: 12px; font-weight: 600; color: #6b7280;">${index + 1}.</td>
                        <td style="text-align: center; padding: 12px;">${izracun.promjer.toFixed(0)} cm</td>
                        <td style="text-align: center; padding: 12px;">${izracun.duzina.toFixed(2)} m</td>
                        <td style="text-align: center; padding: 12px; font-weight: 600; color: #059669;">${izracun.zapremina.toFixed(2)} m³</td>
                        <td style="text-align: center; padding: 12px;">
                            <button class="btn btn-secondary" onclick="obrisiKubikatorRed(${index})" style="padding: 6px 12px; background: #dc2626; border-color: #dc2626;">🗑️</button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

            // Ažuriraj footer
            document.getElementById('kubikator-ukupno-kom').textContent = ukupnoKom;
            document.getElementById('kubikator-ukupno-m3').textContent = ukupnoM3.toFixed(2);
        }

        // Obriši red iz tabele
        function obrisiKubikatorRed(index) {
            kubikatorIzracuni.splice(index, 1);
            azurirajKubikatorTabelu();

            // Sakrij tabelu ako nema više izračuna
            if (kubikatorIzracuni.length === 0) {
                document.getElementById('kubikator-tabela-container').style.display = 'none';
                document.getElementById('kubikator-rezultat').style.display = 'none';
            } else {
                // Ažuriraj prikaz zadnjeg izračuna
                const zadnjiIzracun = kubikatorIzracuni[kubikatorIzracuni.length - 1];
                document.getElementById('kubikator-obujam-display').textContent = zadnjiIzracun.zapremina.toFixed(2);
            }
        }

        // Očisti sve izračune
        function ocistiKubikator() {
            if (kubikatorIzracuni.length === 0) return;

            if (confirm('Da li ste sigurni da želite obrisati sve izračune?')) {
                kubikatorIzracuni = [];
                document.getElementById('kubikator-tabela-container').style.display = 'none';
                document.getElementById('kubikator-rezultat').style.display = 'none';
                document.getElementById('kubikator-promjer').value = '';
                document.getElementById('kubikator-duzina').value = '';
            }
        }

        // Isprintaj rezultate
        function isprintajKubikator() {
            if (kubikatorIzracuni.length === 0) {
                showError('Greška', 'Nema izračuna za printanje');
                return;
            }

            window.print();
        }

        // ========== PWA INSTALL PROMPT ==========
        let deferredPrompt = null;

        window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            deferredPrompt = e;
            var btn = document.getElementById('pwa-install-btn');
            if (btn) btn.style.display = '';
        });

        function installPwa() {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function() {
                deferredPrompt = null;
                var btn = document.getElementById('pwa-install-btn');
                if (btn) btn.style.display = 'none';
            });
        }

        window.addEventListener('appinstalled', function() {
            deferredPrompt = null;
            var btn = document.getElementById('pwa-install-btn');
            if (btn) btn.style.display = 'none';
        });

