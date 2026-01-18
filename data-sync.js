// ========== Data Sync Module - Delta Sync + Smart Scheduling ==========
// Instant offline-first sa stale-while-revalidate strategijom

const SYNC_CONFIG = {
    MANIFEST_ENDPOINT: null, // Set dynamically: buildApiUrl('manifest_data')
    DELTA_PRIMKA_ENDPOINT: null, // Set dynamically: buildApiUrl('delta_primka')
    DELTA_OTPREMA_ENDPOINT: null, // Set dynamically: buildApiUrl('delta_otprema')

    // Smart scheduling
    PEAK_HOURS_START: 7,  // 07:00
    PEAK_HOURS_END: 9,    // 09:00
    PEAK_CHECK_INTERVAL: 2 * 60 * 1000,  // 2 min tijekom peak hours
    NORMAL_CHECK_INTERVAL: 2 * 60 * 60 * 1000,  // 2h van peak hours

    // Retry & timeout
    FETCH_TIMEOUT: 30000,  // 30s timeout
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000  // 2s initial delay, exponential backoff
};

let syncIntervalId = null;
let lastSyncTimestamp = 0;
let peakHoursUpdateDone = false;

// Performance metrics
const syncMetrics = {
    manifestChecks: 0,
    deltaFetches: 0,
    rowsApplied: 0,
    cacheHits: 0,
    errors: 0,
    lastTTFP: 0
};

// Initialize sync config with API URLs
function initSyncConfig(apiUrl, username, password) {
    SYNC_CONFIG.MANIFEST_ENDPOINT = `${apiUrl}?path=manifest_data&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    SYNC_CONFIG.DELTA_PRIMKA_ENDPOINT = `${apiUrl}?path=delta_primka&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    SYNC_CONFIG.DELTA_OTPREMA_ENDPOINT = `${apiUrl}?path=delta_otprema&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    console.log('[SYNC] Config initialized');
}

// Hardened fetch with timeout, retry, and abort
async function fetchWithRetry(url, options = {}, retries = SYNC_CONFIG.MAX_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.FETCH_TIMEOUT);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            if (attempt === retries) {
                console.error(`[SYNC] Fetch failed after ${retries + 1} attempts:`, error);
                throw error;
            }

            const delay = SYNC_CONFIG.RETRY_DELAY * Math.pow(2, attempt);
            console.warn(`[SYNC] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Check manifest za delta sync
async function checkManifest() {
    const startTime = performance.now();
    syncMetrics.manifestChecks++;

    try {
        const manifest = await fetchWithRetry(SYNC_CONFIG.MANIFEST_ENDPOINT);
        console.log('[SYNC] Manifest fetched:', manifest);

        // Loguj performance
        const fetchTime = performance.now() - startTime;
        console.log(`⚡ [PERF] Manifest fetch: ${fetchTime.toFixed(0)}ms`);

        return manifest;

    } catch (error) {
        console.error('[SYNC] Manifest check failed:', error);
        syncMetrics.errors++;
        return null;
    }
}

// Delta sync za primku
async function deltaSyncPrimka(fromRow, toRow) {
    syncMetrics.deltaFetches++;

    try {
        const url = `${SYNC_CONFIG.DELTA_PRIMKA_ENDPOINT}&fromRow=${fromRow}&toRow=${toRow}`;
        const data = await fetchWithRetry(url);

        if (data.error) {
            throw new Error(data.error);
        }

        console.log(`[SYNC] Delta primka: ${data.rows?.length || 0} rows (${fromRow}-${toRow})`);
        return data.rows || [];

    } catch (error) {
        console.error('[SYNC] Delta primka failed:', error);
        syncMetrics.errors++;
        return [];
    }
}

// Delta sync za otpremu
async function deltaSyncOtprema(fromRow, toRow) {
    syncMetrics.deltaFetches++;

    try {
        const url = `${SYNC_CONFIG.DELTA_OTPREMA_ENDPOINT}&fromRow=${fromRow}&toRow=${toRow}`;
        const data = await fetchWithRetry(url);

        if (data.error) {
            throw new Error(data.error);
        }

        console.log(`[SYNC] Delta otprema: ${data.rows?.length || 0} rows (${fromRow}-${toRow})`);
        return data.rows || [];

    } catch (error) {
        console.error('[SYNC] Delta otprema failed:', error);
        syncMetrics.errors++;
        return [];
    }
}

// Load instant snapshot from IndexedDB
async function loadInstantSnapshot() {
    const ttfpStart = performance.now();

    try {
        const [primkaData, otpremaData] = await Promise.all([
            window.IDBHelper.getAllData(window.IDBHelper.STORES.PRIMKA),
            window.IDBHelper.getAllData(window.IDBHelper.STORES.OTPREMA)
        ]);

        const ttfp = performance.now() - ttfpStart;
        syncMetrics.lastTTFP = ttfp;
        syncMetrics.cacheHits++;

        console.log(`⚡ [PERF] TTFP (Time To First Paint): ${ttfp.toFixed(0)}ms`);
        console.log(`📊 [DATA] Loaded from IDB - Primka: ${primkaData.length}, Otprema: ${otpremaData.length}`);

        return { primka: primkaData, otprema: otpremaData };

    } catch (error) {
        console.error('[SYNC] Failed to load snapshot from IDB:', error);
        syncMetrics.errors++;
        return { primka: [], otprema: [] };
    }
}

// Perform delta sync and update IDB
async function performDeltaSync() {
    try {
        console.log('[SYNC] Starting delta sync check...');

        // Check manifest
        const manifest = await checkManifest();
        if (!manifest) {
            console.warn('[SYNC] Manifest unavailable, skipping sync');
            return { updated: false, reason: 'manifest_unavailable' };
        }

        // Get local meta
        const [localPrimkaRow, localOtpremaRow] = await Promise.all([
            window.IDBHelper.getMeta('primka_lastRow') || 0,
            window.IDBHelper.getMeta('otprema_lastRow') || 0
        ]);

        const remotePrimkaRow = manifest.primkaRowCount || 0;
        const remoteOtpremaRow = manifest.otpremaRowCount || 0;

        console.log(`[SYNC] Local: Primka=${localPrimkaRow}, Otprema=${localOtpremaRow}`);
        console.log(`[SYNC] Remote: Primka=${remotePrimkaRow}, Otprema=${remoteOtpremaRow}`);

        let updatedPrimka = false;
        let updatedOtprema = false;
        let newRowsCount = 0;

        // Delta sync primka
        if (remotePrimkaRow > localPrimkaRow) {
            console.log(`🔄 [SYNC] Fetching primka delta (${localPrimkaRow + 1} → ${remotePrimkaRow})...`);
            const newRows = await deltaSyncPrimka(localPrimkaRow + 1, remotePrimkaRow);

            if (newRows.length > 0) {
                await window.IDBHelper.saveData(window.IDBHelper.STORES.PRIMKA, newRows);
                await window.IDBHelper.setMeta('primka_lastRow', remotePrimkaRow);
                syncMetrics.rowsApplied += newRows.length;
                newRowsCount += newRows.length;
                updatedPrimka = true;
                console.log(`✅ [SYNC] Applied ${newRows.length} new primka rows`);
            }
        }

        // Delta sync otprema
        if (remoteOtpremaRow > localOtpremaRow) {
            console.log(`🔄 [SYNC] Fetching otprema delta (${localOtpremaRow + 1} → ${remoteOtpremaRow})...`);
            const newRows = await deltaSyncOtprema(localOtpremaRow + 1, remoteOtpremaRow);

            if (newRows.length > 0) {
                await window.IDBHelper.saveData(window.IDBHelper.STORES.OTPREMA, newRows);
                await window.IDBHelper.setMeta('otprema_lastRow', remoteOtpremaRow);
                syncMetrics.rowsApplied += newRows.length;
                newRowsCount += newRows.length;
                updatedOtprema = true;
                console.log(`✅ [SYNC] Applied ${newRows.length} new otprema rows`);
            }
        }

        // Update last sync timestamp
        lastSyncTimestamp = Date.now();
        await window.IDBHelper.setMeta('lastSyncTimestamp', lastSyncTimestamp);

        if (updatedPrimka || updatedOtprema) {
            console.log(`🎉 [SYNC] Delta sync complete - ${newRowsCount} new rows applied`);
            return { updated: true, newRowsCount, updatedPrimka, updatedOtprema };
        } else {
            console.log('[SYNC] No new data available');
            return { updated: false, reason: 'no_new_data' };
        }

    } catch (error) {
        console.error('[SYNC] Delta sync failed:', error);
        syncMetrics.errors++;
        return { updated: false, reason: 'error', error };
    }
}

// Smart scheduling: češće 07-09h, rijetko van toga
function isPeakHours() {
    const now = new Date();
    const hour = now.getHours();
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5; // Mon-Fri
    return isWeekday && hour >= SYNC_CONFIG.PEAK_HOURS_START && hour < SYNC_CONFIG.PEAK_HOURS_END;
}

function startSmartSync() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Vikend: ISKLJUČI data sync (nema unosa)
    if (isWeekend) {
        console.log('[SYNC] Smart sync SKIPPED (weekend - no data entry expected)');
        return;
    }

    // Stop existing interval
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
    }

    // Reset peak hours flag at start of day
    if (now.getHours() < SYNC_CONFIG.PEAK_HOURS_START) {
        peakHoursUpdateDone = false;
    }

    function scheduleNextCheck() {
        const interval = isPeakHours() ? SYNC_CONFIG.PEAK_CHECK_INTERVAL : SYNC_CONFIG.NORMAL_CHECK_INTERVAL;
        console.log(`[SYNC] Next check in ${interval / 1000 / 60} min (${isPeakHours() ? 'PEAK' : 'NORMAL'} hours)`);

        syncIntervalId = setInterval(async () => {
            const result = await performDeltaSync();

            // If we got update during peak hours, mark as done
            if (isPeakHours() && result.updated) {
                peakHoursUpdateDone = true;
                console.log('[SYNC] Peak hours update done, reducing frequency');
            }

            // If peak hours ended, reset flag for tomorrow
            if (!isPeakHours()) {
                peakHoursUpdateDone = false;
            }

            // Trigger UI refresh if data updated
            if (result.updated && window.onDataSyncUpdate) {
                window.onDataSyncUpdate(result);
            }
        }, interval);
    }

    // Initial check
    performDeltaSync().then(result => {
        if (result.updated && window.onDataSyncUpdate) {
            window.onDataSyncUpdate(result);
        }
        scheduleNextCheck();
    });

    console.log('[SYNC] Smart sync started');
}

function stopSmartSync() {
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
        console.log('[SYNC] Smart sync stopped');
    }
}

// Log sync metrics
function logSyncMetrics() {
    console.log('📊 [SYNC METRICS]');
    console.log(`  Manifest checks: ${syncMetrics.manifestChecks}`);
    console.log(`  Delta fetches: ${syncMetrics.deltaFetches}`);
    console.log(`  Rows applied: ${syncMetrics.rowsApplied}`);
    console.log(`  Cache hits: ${syncMetrics.cacheHits}`);
    console.log(`  Errors: ${syncMetrics.errors}`);
    console.log(`  Last TTFP: ${syncMetrics.lastTTFP.toFixed(0)}ms`);
}

// Export
window.DataSync = {
    initSyncConfig,
    loadInstantSnapshot,
    performDeltaSync,
    startSmartSync,
    stopSmartSync,
    logSyncMetrics,
    syncMetrics
};

console.log('[SYNC] Data sync module loaded');
