/**
 * Tests za offline red čekanja "Dodaj sječu"/"Dodaj otpremu" (js/app.js) —
 * _queueUpsert (idempotentno dodavanje/zamjena po uuid-u, da ponovni pokušaj
 * slanja tokom drain-a ne producira duplikate u redu) i fallback UUID
 * generator (za starije webview-e bez crypto.randomUUID).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANE/PARAMETRIZOVANE FUNKCIJE IZ js/app.js =====
// (localStorage zavisnost zamijenjena običnim nizom koji poziva prosljeđuje)

function _queueUpsert(queue, uuid, fields, imageUrl) {
    const item = { uuid, fields, imageUrl: imageUrl || null };
    const idx = queue.findIndex(x => x.uuid === uuid);
    if (idx >= 0) queue[idx] = item; else queue.push(item);
    return queue;
}

function _novaUuidFallback() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
    });
}

describe('_queueUpsert — idempotentno dodavanje u red čekanja', () => {
    test('nova stavka se dodaje u prazan red', () => {
        const q = _queueUpsert([], 'uuid-1', { odjel: '64', datum: '18.08.2026' }, null);
        assert.equal(q.length, 1);
        assert.equal(q[0].uuid, 'uuid-1');
    });

    test('drugi uuid se dodaje uz prvi (dva odvojena unosa)', () => {
        let q = [];
        q = _queueUpsert(q, 'uuid-1', { odjel: '64' }, null);
        q = _queueUpsert(q, 'uuid-2', { odjel: '71' }, null);
        assert.equal(q.length, 2);
    });

    test('ponovni poziv sa ISTIM uuid-om (retry poslije mrežne greške tokom drain-a) ne duplicira red', () => {
        let q = [];
        q = _queueUpsert(q, 'uuid-1', { odjel: '64', 'Σ ČETINARI': 10 }, null);
        q = _queueUpsert(q, 'uuid-1', { odjel: '64', 'Σ ČETINARI': 10 }, null); // isti pokušaj ponovljen
        assert.equal(q.length, 1);
    });

    test('upsert zamjenjuje sadržaj postojeće stavke (npr. imageUrl stigao naknadno)', () => {
        let q = [];
        q = _queueUpsert(q, 'uuid-1', { odjel: '64' }, null);
        q = _queueUpsert(q, 'uuid-1', { odjel: '64' }, 'https://slika.jpg');
        assert.equal(q.length, 1);
        assert.equal(q[0].imageUrl, 'https://slika.jpg');
    });

    test('uklanjanje po uuid-u (discardQueuedSjeca/Otprema) briše tačno jednu stavku', () => {
        let q = [];
        q = _queueUpsert(q, 'uuid-1', { odjel: '64' }, null);
        q = _queueUpsert(q, 'uuid-2', { odjel: '71' }, null);
        const posleBrisanja = q.filter(x => x.uuid !== 'uuid-1');
        assert.equal(posleBrisanja.length, 1);
        assert.equal(posleBrisanja[0].uuid, 'uuid-2');
    });
});

describe('_novaUuidFallback — generator za uređaje bez crypto.randomUUID', () => {
    test('vraća string ispravnog UUID v4 formata (36 znakova, verzija 4, varijanta 8/9/a/b)', () => {
        const uuid = _novaUuidFallback();
        assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test('uzastopni pozivi generišu različite vrijednosti (nema kolizija u praktičnom broju pokušaja)', () => {
        const skup = new Set();
        for (let i = 0; i < 500; i++) skup.add(_novaUuidFallback());
        assert.equal(skup.size, 500);
    });
});
