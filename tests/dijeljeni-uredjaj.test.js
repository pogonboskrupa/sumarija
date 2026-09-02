// Testovi za privatnost na DIJELJENOM terenskom telefonu:
// _clearForeignCacheOnLogin (js/auth.js) brise kes prethodnog korisnika kad
// se prijavi drugi. Kljucni detalj: dva NAJVECA prikaza (primke/sjeca i
// otprema, do 2.8MB svaki) ne zive u localStorage nego u IndexedDB
// (IDB_LARGE_KEYS, js/app.js), pa ih petlja po localStorage-u ne dodiruje.
//
// Po konvenciji ovog projekta logika je OVDJE PREKOPIRANA (ne importovana) —
// izvorni kod je vezan za browser (localStorage / IndexedDB).

const test = require('node:test');
const assert = require('node:assert');

const IDB_LARGE_KEYS = new Set(['cache_primke_sjeca', 'cache_otpreme_tab']);

// --- kopija iz js/auth.js: _clearForeignCacheOnLogin ---
async function clearForeignCacheOnLogin(username, ls, idb) {
    const owner = ls.getItem('sumarija_cache_owner');
    const uname = (username || '').toLowerCase();
    if (owner && owner.toLowerCase() !== uname) {
        const cacheKeys = [];
        for (let i = 0; i < ls.length; i++) {
            const k = ls.key(i);
            if (k && k.startsWith('cache_')) cacheKeys.push(k);
        }
        cacheKeys.forEach(k => ls.removeItem(k));
        for (const k of IDB_LARGE_KEYS) await idb.setMeta('blob_' + k, null);
        ls.removeItem('sumarija_offline_auth');
    }
    ls.setItem('sumarija_cache_owner', username || '');
}

// --- minimalni localStorage / IndexedDB dvojnici ---
function napraviLs(init = {}) {
    const m = new Map(Object.entries(init));
    return {
        get length() { return m.size; },
        key: (i) => [...m.keys()][i],
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: (k) => m.delete(k),
        _sve: () => [...m.keys()]
    };
}
function napraviIdb(init = {}) {
    const m = new Map(Object.entries(init));
    return {
        setMeta: async (k, v) => { if (v === null) m.delete(k); else m.set(k, v); },
        getMeta: async (k) => (m.has(k) ? m.get(k) : null),
        _sve: () => [...m.keys()]
    };
}

test('Dijeljeni uredjaj — prijava DRUGOG korisnika', async (t) => {
    await t.test('brise localStorage kes prethodnog korisnika', async () => {
        const ls = napraviLs({
            sumarija_cache_owner: 'salkic',
            cache_dashboard_v2_2026_m9: '{}',
            cache_kupci: '{}',
            sumarija_offline_auth: '{}'
        });
        const idb = napraviIdb();
        await clearForeignCacheOnLogin('velagic', ls, idb);
        assert.ok(!ls._sve().some(k => k.startsWith('cache_')), 'nijedan cache_ kljuc ne smije ostati');
        assert.strictEqual(ls.getItem('sumarija_offline_auth'), null, 'offline snapshot tudjeg korisnika se brise');
        assert.strictEqual(ls.getItem('sumarija_cache_owner'), 'velagic');
    });

    await t.test('[KLJUCNO] brise i IndexedDB blobove (primke/otprema)', async () => {
        // Ovo je bila rupa: petlja gleda samo localStorage, a dva najveca
        // skupa tudjih podataka su u IndexedDB — sljedeci radnik je u
        // tabovima Sjeca/Otprema vidio TUDJE primke i otpreme.
        const ls = napraviLs({ sumarija_cache_owner: 'salkic', cache_kupci: '{}' });
        const idb = napraviIdb({
            blob_cache_primke_sjeca: { data: 'tudje primke' },
            blob_cache_otpreme_tab: { data: 'tudje otpreme' }
        });
        await clearForeignCacheOnLogin('velagic', ls, idb);
        assert.strictEqual(await idb.getMeta('blob_cache_primke_sjeca'), null);
        assert.strictEqual(await idb.getMeta('blob_cache_otpreme_tab'), null);
        assert.deepStrictEqual(idb._sve(), [], 'nijedan tudji blob ne smije ostati');
    });

    await t.test('fotografije drugog korisnika ostaju netaknute (kljucane po korisniku)', async () => {
        // Fotografije se cuvaju pod 'mapa_radnika_foto_<username>' pa ih
        // brisanje tudjeg kesa ne smije (ni slucajno) pokupiti.
        const ls = napraviLs({ sumarija_cache_owner: 'salkic' });
        const idb = napraviIdb({ mapa_radnika_foto_salkic: [{ id: 1 }] });
        await clearForeignCacheOnLogin('velagic', ls, idb);
        assert.deepStrictEqual(idb._sve(), ['mapa_radnika_foto_salkic']);
    });
});

test('Dijeljeni uredjaj — prijava ISTOG korisnika', async (t) => {
    await t.test('kes se ZADRZAVA (offline rad poslije odjave)', async () => {
        const ls = napraviLs({
            sumarija_cache_owner: 'salkic',
            cache_kupci: '{}',
            sumarija_offline_auth: '{}'
        });
        const idb = napraviIdb({ blob_cache_primke_sjeca: { data: 'moje primke' } });
        await clearForeignCacheOnLogin('salkic', ls, idb);
        assert.strictEqual(ls.getItem('cache_kupci'), '{}', 'vlastiti kes ostaje');
        assert.notStrictEqual(await idb.getMeta('blob_cache_primke_sjeca'), null, 'vlastiti IDB blob ostaje');
        assert.strictEqual(ls.getItem('sumarija_offline_auth'), '{}', 'offline prijava ostaje moguca');
    });

    await t.test('razlika u velicini slova nije "drugi korisnik"', async () => {
        const ls = napraviLs({ sumarija_cache_owner: 'Salkic', cache_kupci: '{}' });
        const idb = napraviIdb({ blob_cache_otpreme_tab: { data: 'moje' } });
        await clearForeignCacheOnLogin('salkic', ls, idb);
        assert.strictEqual(ls.getItem('cache_kupci'), '{}');
        assert.notStrictEqual(await idb.getMeta('blob_cache_otpreme_tab'), null);
    });

    await t.test('prva prijava na praznom uredjaju nista ne brise', async () => {
        const ls = napraviLs({ cache_kupci: '{}' });   // nema vlasnika
        const idb = napraviIdb({ blob_cache_primke_sjeca: { data: 'x' } });
        await clearForeignCacheOnLogin('salkic', ls, idb);
        assert.strictEqual(ls.getItem('cache_kupci'), '{}');
        assert.notStrictEqual(await idb.getMeta('blob_cache_primke_sjeca'), null);
        assert.strictEqual(ls.getItem('sumarija_cache_owner'), 'salkic');
    });
});
