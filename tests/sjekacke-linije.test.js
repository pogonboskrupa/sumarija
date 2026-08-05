/**
 * Tests za geometriju stvarno ofarbanih sjekačkih linija
 * Izvor: js/mapa-radnika.js (klijent) i apps-script/sjekacke-linije.gs (server)
 *
 * Testira se:
 * - _toLocalXY / _dpSimplifyXY (Douglas-Peucker pojednostavljivanje)
 * - _sjekPackPoints (zaokruživanje + adaptivno pojednostavljivanje do limita ćelije)
 * - _sjekChunkPoints (dijeljenje predugačke linije na više Sheets redova)
 * - _sjekDuzinaM (Haversine dužina)
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANE FUNKCIJE IZ js/mapa-radnika.js =====

function _toLocalXY(lat, lng, lat0, lng0) {
    var mPerDegLat = 111320;
    var mPerDegLng = 111320 * Math.cos(lat0 * Math.PI / 180);
    return { x: (lng - lng0) * mPerDegLng, y: (lat - lat0) * mPerDegLat };
}

function _dpSimplifyXY(pts, epsM) {
    var n = pts.length;
    if (n < 3) return pts.slice();
    var keep = new Array(n);
    keep[0] = keep[n - 1] = true;
    var stack = [[0, n - 1]];
    while (stack.length) {
        var seg = stack.pop(), i0 = seg[0], i1 = seg[1];
        if (i1 - i0 < 2) continue;
        var a = pts[i0], b = pts[i1];
        var dx = b.x - a.x, dy = b.y - a.y;
        var den = Math.sqrt(dx * dx + dy * dy);
        var maxD = -1, maxI = -1;
        for (var i = i0 + 1; i < i1; i++) {
            var p = pts[i], d;
            if (den < 1e-9) d = Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
            else d = Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / den;
            if (d > maxD) { maxD = d; maxI = i; }
        }
        if (maxD > epsM) { keep[maxI] = true; stack.push([i0, maxI], [maxI, i1]); }
    }
    var out = [];
    for (var k = 0; k < n; k++) if (keep[k]) out.push(pts[k]);
    return out;
}

function _r6(v) { return Math.round(v * 1e6) / 1e6; }

var SJEK_SIMPLIFY_M = 2;
var SJEK_MAX_JSON = 45000;

function _sjekPackPoints(latlngs) {
    if (!latlngs || latlngs.length < 2) return null;
    var lat0 = latlngs[0][0], lng0 = latlngs[0][1];
    var xy = latlngs.map(function(ll) {
        var p = _toLocalXY(ll[0], ll[1], lat0, lng0);
        p.ll = ll;
        return p;
    });
    var eps = SJEK_SIMPLIFY_M;
    for (var guard = 0; guard < 12; guard++) {
        var simp = _dpSimplifyXY(xy, eps);
        var out = simp.map(function(p) { return [_r6(p.ll[0]), _r6(p.ll[1])]; });
        var json = JSON.stringify(out);
        if (json.length <= SJEK_MAX_JSON || out.length <= 2) {
            return { points: out, bytes: json.length, eps: eps, sirovo: latlngs.length };
        }
        eps *= 2;
    }
    return {
        points: [[_r6(lat0), _r6(lng0)],
                 [_r6(latlngs[latlngs.length - 1][0]), _r6(latlngs[latlngs.length - 1][1])]],
        bytes: 0, eps: eps, sirovo: latlngs.length
    };
}

function _distM(a, b) {
    var R = 6371000;
    var dLat = (b[0] - a[0]) * Math.PI / 180;
    var dLng = (b[1] - a[1]) * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ===== EXTRACTOVANE FUNKCIJE IZ apps-script/sjekacke-linije.gs =====

var SJEK_MAX_CELL = 45000;

function _sjekDuzinaM(points) {
    var R = 6371000, uk = 0;
    for (var i = 1; i < points.length; i++) {
        var a = points[i - 1], b = points[i];
        var dLat = (b[0] - a[0]) * Math.PI / 180;
        var dLng = (b[1] - a[1]) * Math.PI / 180;
        var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        uk += R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }
    return Math.round(uk);
}

function _sjekChunkPoints(points) {
    var chunks = [], cur = [], curLen = 2;
    for (var i = 0; i < points.length; i++) {
        var cost = JSON.stringify(points[i]).length + 1;
        if (cur.length >= 2 && curLen + cost > SJEK_MAX_CELL) {
            chunks.push(cur);
            cur = [points[i - 1]];
            curLen = 2 + JSON.stringify(points[i - 1]).length + 1;
        }
        cur.push(points[i]);
        curLen += cost;
    }
    if (cur.length) chunks.push(cur);
    return chunks;
}

// ===== TESTOVI =====

describe('_dpSimplifyXY (Douglas-Peucker)', () => {
    test('prava linija od 100 tačaka -> tačno 2 tačke na eps=2', () => {
        var pts = [];
        for (var i = 0; i < 100; i++) pts.push({ x: i * 5, y: i * 5 });
        var out = _dpSimplifyXY(pts, 2);
        assert.equal(out.length, 2);
        assert.deepEqual(out[0], pts[0]);
        assert.deepEqual(out[out.length - 1], pts[pts.length - 1]);
    });

    test('prava linija sa ±1m šumom -> ostaje malo tačaka (šum apsorbovan)', () => {
        var pts = [];
        var seeded = 12345;
        function rnd() { seeded = (seeded * 1103515245 + 12345) & 0x7fffffff; return (seeded / 0x7fffffff) - 0.5; }
        for (var i = 0; i < 100; i++) pts.push({ x: i * 5, y: i * 5 + rnd() * 2 });
        var out = _dpSimplifyXY(pts, 2);
        assert.ok(out.length <= 8, 'ocekivano <=8 tacaka, dobijeno ' + out.length);
    });

    test('L-oblik cuva ugao (srednju tacku na uglu)', () => {
        var pts = [];
        for (var i = 0; i <= 10; i++) pts.push({ x: i * 10, y: 0 });      // vodoravno 0..100
        for (var j = 1; j <= 10; j++) pts.push({ x: 100, y: j * 10 });    // pa okomito 0..100
        var out = _dpSimplifyXY(pts, 2);
        var imaUgao = out.some(function(p) { return p.x === 100 && p.y === 0; });
        assert.ok(imaUgao, 'ugao (100,0) mora ostati u pojednostavljenoj liniji');
        assert.deepEqual(out[0], pts[0]);
        assert.deepEqual(out[out.length - 1], pts[pts.length - 1]);
    });

    test('krajnje tacke su UVIJEK ocuvane', () => {
        var pts = [{ x: 0, y: 0 }, { x: 1, y: 5 }, { x: 2, y: -3 }, { x: 3, y: 8 }, { x: 4, y: 0 }];
        var out = _dpSimplifyXY(pts, 100); // ogroman prag -> sve osim krajeva se odbacuje
        assert.equal(out.length, 2);
        assert.deepEqual(out[0], pts[0]);
        assert.deepEqual(out[1], pts[pts.length - 1]);
    });

    test('manje od 3 tacke -> vraca nepromijenjeno', () => {
        var pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
        assert.deepEqual(_dpSimplifyXY(pts, 2), pts);
    });
});

describe('_sjekPackPoints (limit Sheets celije)', () => {
    test('2045 nasumicnih tacaka -> JSON <= 45000 znakova', () => {
        var latlngs = [];
        var seeded = 999;
        function rnd() { seeded = (seeded * 1103515245 + 12345) & 0x7fffffff; return seeded / 0x7fffffff; }
        var lat = 44.9, lng = 16.2;
        for (var i = 0; i < 2045; i++) {
            lat += (rnd() - 0.5) * 0.00005;
            lng += (rnd() - 0.5) * 0.00005;
            latlngs.push([lat, lng]);
        }
        var pack = _sjekPackPoints(latlngs);
        assert.ok(pack.bytes <= SJEK_MAX_JSON || pack.points.length <= 2,
            'JSON od ' + pack.bytes + ' znakova prelazi limit');
    });

    test('5000 "vijugavih" tacaka (nasumican hod) -> adaptivna petlja poveca eps i ipak stane', () => {
        var latlngs = [];
        var seeded = 42;
        function rnd() { seeded = (seeded * 1103515245 + 12345) & 0x7fffffff; return seeded / 0x7fffffff; }
        var lat = 44.9, lng = 16.2;
        // Blago pristrasan nasumican hod (~11m korak) — DP na eps=2 skine tek
        // manji dio tacaka jer je putanja stvarno nepravilna, pa 5000 sirovih
        // tacaka ostane preko limita ćelije i na eps=2 (potvrđeno ručnim
        // izračunom prije pisanja testa: eps=2 -> 54749 znakova, eps=4 -> 23279).
        for (var i = 0; i < 5000; i++) {
            lat += (rnd() - 0.3) * 0.0001;
            lng += (rnd() - 0.5) * 0.0001;
            latlngs.push([lat, lng]);
        }
        var pack = _sjekPackPoints(latlngs);
        var json = JSON.stringify(pack.points);
        assert.ok(json.length <= SJEK_MAX_JSON, 'JSON od ' + json.length + ' prelazi limit');
        assert.ok(pack.eps > SJEK_SIMPLIFY_M, 'adaptivna petlja se morala aktivirati (eps=' + pack.eps + ')');
    });

    test('manje od 2 tacke -> null', () => {
        assert.equal(_sjekPackPoints([]), null);
        assert.equal(_sjekPackPoints([[44.9, 16.2]]), null);
    });
});

describe('_sjekChunkPoints (dijeljenje na Sheets redove)', () => {
    test('~58000 znakova -> vise dijelova, svaki <=45000, spajanje reprodukuje original', () => {
        var points = [];
        var lat = 44.9, lng = 16.2;
        // I lat I lng se mijenjaju (obje pune 6 decimala u JSON-u) -> ~22
        // znaka po tacki; 2800 tacaka daje ~58000 znakova (provjereno ručno).
        for (var i = 0; i < 2800; i++) {
            lat += 0.00001;
            lng += 0.000007;
            points.push([_r6(lat), _r6(lng)]);
        }
        var totalJson = JSON.stringify(points);
        assert.ok(totalJson.length > 45000, 'test pretpostavlja da originalni niz premasuje limit');

        var chunks = _sjekChunkPoints(points);
        assert.ok(chunks.length >= 2, 'ocekivano bar 2 dijela');
        chunks.forEach(function(c) {
            assert.ok(JSON.stringify(c).length <= SJEK_MAX_CELL);
        });

        // Spajanje: odbaci prvu tacku svakog narednog dijela (preklop)
        var spojeno = chunks[0].slice();
        for (var k = 1; k < chunks.length; k++) spojeno = spojeno.concat(chunks[k].slice(1));
        assert.deepEqual(spojeno, points);
    });

    test('mala linija -> tacno 1 dio', () => {
        var points = [[44.9, 16.2], [44.901, 16.201], [44.902, 16.202]];
        var chunks = _sjekChunkPoints(points);
        assert.equal(chunks.length, 1);
        assert.deepEqual(chunks[0], points);
    });
});

describe('_sjekDuzinaM (Haversine)', () => {
    test('1000m sjever-jug par -> +-1m', () => {
        // 1 stepen geografske sirine = ~111320 m -> 1000m = 0.0089832 stepeni
        var dLat = 1000 / 111320;
        var points = [[44.9, 16.2], [44.9 + dLat, 16.2]];
        var d = _sjekDuzinaM(points);
        assert.ok(Math.abs(d - 1000) <= 1, 'ocekivano ~1000m, dobijeno ' + d + 'm');
    });

    test('linija od vise segmenata sabira duzine', () => {
        var points = [[44.9, 16.2], [44.901, 16.2], [44.901, 16.201]];
        var d1 = _distM(points[0], points[1]);
        var d2 = _distM(points[1], points[2]);
        var uk = _sjekDuzinaM(points);
        assert.ok(Math.abs(uk - Math.round(d1 + d2)) <= 1);
    });

    test('jedna tacka -> 0', () => {
        assert.equal(_sjekDuzinaM([[44.9, 16.2]]), 0);
    });
});
