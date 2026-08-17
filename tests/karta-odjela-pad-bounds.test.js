/**
 * Tests za _padBoundsKm (js/karta-odjela.js) — proširenje mape bounds-a za
 * tačan broj kilometara u svakom pravcu (ne fitBounds piksel-padding).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANA FUNKCIJA (bez Leaflet-a — čist objekat umjesto L.latLngBounds) =====

function _padBoundsKm(bounds, km) {
    const sw = bounds.sw, ne = bounds.ne;
    const latMid = (sw.lat + ne.lat) / 2;
    const dLat = km / 111;
    const dLng = km / (111 * Math.cos(latMid * Math.PI / 180));
    return {
        sw: { lat: sw.lat - dLat, lng: sw.lng - dLng },
        ne: { lat: ne.lat + dLat, lng: ne.lng + dLng }
    };
}

// Haversine — provjerava da rezultat ODGOVARA stvarnoj udaljenosti (nezavisna
// provjera, ne isti kod koji se testira).
function haversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

describe('_padBoundsKm — proširenje za tačnu udaljenost u km', () => {
    test('sjeverna/južna ivica se pomjeraju za ~5km (haversine provjera, latitude ŠPD Bosanska Krupa)', () => {
        const bounds = { sw: { lat: 44.80, lng: 16.10 }, ne: { lat: 44.90, lng: 16.20 } };
        const padded = _padBoundsKm(bounds, 5);

        const distSjever = haversineKm({ lat: bounds.ne.lat, lng: bounds.ne.lng }, { lat: padded.ne.lat, lng: bounds.ne.lng });
        const distJug     = haversineKm({ lat: bounds.sw.lat, lng: bounds.sw.lng }, { lat: padded.sw.lat, lng: bounds.sw.lng });
        assert.ok(Math.abs(distSjever - 5) < 0.05, `sjever: ${distSjever} km (očekivano ~5)`);
        assert.ok(Math.abs(distJug - 5) < 0.05, `jug: ${distJug} km (očekivano ~5)`);
    });

    test('istočna/zapadna ivica se pomjeraju za ~5km (uža stepen dužine na ovoj geo. širini)', () => {
        const bounds = { sw: { lat: 44.80, lng: 16.10 }, ne: { lat: 44.90, lng: 16.20 } };
        const padded = _padBoundsKm(bounds, 5);

        const distIstok = haversineKm({ lat: bounds.ne.lat, lng: bounds.ne.lng }, { lat: bounds.ne.lat, lng: padded.ne.lng });
        const distZapad  = haversineKm({ lat: bounds.sw.lat, lng: bounds.sw.lng }, { lat: bounds.sw.lat, lng: padded.sw.lng });
        assert.ok(Math.abs(distIstok - 5) < 0.05, `istok: ${distIstok} km (očekivano ~5)`);
        assert.ok(Math.abs(distZapad - 5) < 0.05, `zapad: ${distZapad} km (očekivano ~5)`);
    });

    test('padding raste linearno sa traženim km (10km daje duplo veći pomak od 5km)', () => {
        const bounds = { sw: { lat: 44.80, lng: 16.10 }, ne: { lat: 44.90, lng: 16.20 } };
        const p5  = _padBoundsKm(bounds, 5);
        const p10 = _padBoundsKm(bounds, 10);
        const dLat5  = p5.ne.lat  - bounds.ne.lat;
        const dLat10 = p10.ne.lat - bounds.ne.lat;
        assert.ok(Math.abs(dLat10 - dLat5 * 2) < 1e-9);
    });

    test('rezultujući bounds je i dalje validan pravougaonik (sw < ne)', () => {
        const bounds = { sw: { lat: 44.80, lng: 16.10 }, ne: { lat: 44.90, lng: 16.20 } };
        const padded = _padBoundsKm(bounds, 5);
        assert.ok(padded.sw.lat < padded.ne.lat);
        assert.ok(padded.sw.lng < padded.ne.lng);
    });
});
