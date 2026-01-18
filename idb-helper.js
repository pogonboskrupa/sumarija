// ========== IndexedDB Helper Module ==========
// Brz i pouzdan pristup IndexedDB za offline-first pristup

const DB_NAME = 'sumarija_db';
const DB_VERSION = 1;

const STORES = {
    PRIMKA: 'primka',
    OTPREMA: 'otprema',
    META: 'meta'
};

let dbInstance = null;

// Inicijalizuj IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[IDB] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            console.log('[IDB] Database opened successfully');
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            console.log('[IDB] Upgrading database schema...');

            // Store za primku
            if (!db.objectStoreNames.contains(STORES.PRIMKA)) {
                const primkaStore = db.createObjectStore(STORES.PRIMKA, { keyPath: 'rowIndex' });
                primkaStore.createIndex('datum', 'datum', { unique: false });
                primkaStore.createIndex('odjel', 'odjel', { unique: false });
                console.log('[IDB] Created primka store');
            }

            // Store za otpremu
            if (!db.objectStoreNames.contains(STORES.OTPREMA)) {
                const otpremaStore = db.createObjectStore(STORES.OTPREMA, { keyPath: 'rowIndex' });
                otpremaStore.createIndex('datum', 'datum', { unique: false });
                otpremaStore.createIndex('odjel', 'odjel', { unique: false });
                console.log('[IDB] Created otprema store');
            }

            // Store za meta podatke
            if (!db.objectStoreNames.contains(STORES.META)) {
                db.createObjectStore(STORES.META, { keyPath: 'key' });
                console.log('[IDB] Created meta store');
            }
        };
    });
}

// Spremi podatke u store
async function saveData(storeName, data) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        // Batch insert
        const requests = Array.isArray(data) ? data : [data];
        let completed = 0;
        let errors = [];

        requests.forEach((item, index) => {
            const request = store.put(item);
            request.onsuccess = () => {
                completed++;
                if (completed === requests.length) {
                    resolve({ success: true, count: completed, errors });
                }
            };
            request.onerror = () => {
                errors.push({ index, error: request.error });
                completed++;
                if (completed === requests.length) {
                    resolve({ success: errors.length === 0, count: completed - errors.length, errors });
                }
            };
        });
    });
}

// Učitaj sve podatke iz store-a
async function getAllData(storeName) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            console.error(`[IDB] Failed to get all data from ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

// Učitaj podatke sa keyPath filtriranjem
async function getDataByIndex(storeName, indexName, value) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            console.error(`[IDB] Failed to get data by index ${indexName}:`, request.error);
            reject(request.error);
        };
    });
}

// Brojanje redova u store-u
async function countRows(storeName) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => {
            resolve(request.result || 0);
        };

        request.onerror = () => {
            console.error(`[IDB] Failed to count rows in ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

// Spremi meta podatak
async function setMeta(key, value) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.META], 'readwrite');
        const store = transaction.objectStore(STORES.META);
        const request = store.put({ key, value, timestamp: Date.now() });

        request.onsuccess = () => {
            resolve(true);
        };

        request.onerror = () => {
            console.error(`[IDB] Failed to set meta ${key}:`, request.error);
            reject(request.error);
        };
    });
}

// Učitaj meta podatak
async function getMeta(key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.META], 'readonly');
        const store = transaction.objectStore(STORES.META);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result ? request.result.value : null);
        };

        request.onerror = () => {
            console.error(`[IDB] Failed to get meta ${key}:`, request.error);
            reject(request.error);
        };
    });
}

// Obriši sve podatke iz store-a
async function clearStore(storeName) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
            console.log(`[IDB] Cleared store ${storeName}`);
            resolve(true);
        };

        request.onerror = () => {
            console.error(`[IDB] Failed to clear store ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

// Export funkcija
window.IDBHelper = {
    STORES,
    initDB,
    saveData,
    getAllData,
    getDataByIndex,
    countRows,
    setMeta,
    getMeta,
    clearStore
};

console.log('[IDB] Helper module loaded');
