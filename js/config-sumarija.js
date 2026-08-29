// ============================================================
// KONFIGURACIJA ŠUMARIJE — JEDINO MJESTO ZA PODATKE SPECIFIČNE ZA ŠUMARIJU
//
// Za postavljanje aplikacije za DRUGU šumariju mijenja se SAMO ovaj fajl
// (plus Google ID-evi u apps-script/config.gs na backend strani).
//
// Ranije su ovi podaci bili razbacani po šest fajlova, a četiri vrijednosti
// su postojale u PO DVIJE KOPIJE (koordinate, godišnji plan, PLAN_YEAR,
// poslovođa→radilište) — što je bila stalna opasnost da kopije odu u
// nesklad pa Mapa i Godišnji plan pokažu različite brojeve.
//
// VAŽNO: ovaj fajl se učitava PRVI (vidi redoslijed <script> tagova u
// index.html) — svi ostali fajlovi čitaju iz window.SUMARIJA_CONFIG.
//
// Detaljno uputstvo: docs/TEMPLATE-ZA-DRUGE-SUMARIJE.md
// ============================================================
(function () {
    'use strict';

    // ---- 1. OSNOVNI PODACI ----
    var NAZIV_PUNI = 'Pogon gospodarenja Bos. Krupa';
    var NAZIV_KRATKI = 'Šumarija Krupa';   // koristi se kao naziv dashboard taba

    // Lokacija kancelarije — centar mape, marker i početna tačka rute.
    var LOKACIJA = [44.883425, 16.154427];

    // ---- 2. BACKEND ----
    // URL Google Apps Script Web App-a (Deploy → New deployment → Web app).
    // Mijenja se pri svakom NOVOM deploymentu backenda.
    var API_URL = 'https://script.google.com/macros/s/AKfycbwePAboaXBdfnmdzaYfp8sOofi29nhm2oaE4KwjsHN9F2AaZdao1Z1NPn8a25rEcUY/exec';

    // ---- 3. GOSPODARSKE JEDINICE ----
    // Nazivi se MORAJU tačno poklapati sa property "gj" u data/odjeli.geojson,
    // inače se sječa ne poveže sa poligonom na mapi.
    var GJ_LIST = ['Risovac Krupa', 'Grmeč Jasenica', 'Vojskova'];
    var GJ_COLOR = {
        'Risovac Krupa': '#1d4ed8',
        'Grmeč Jasenica': '#15803d',
        'Vojskova': '#b45309',
        'Slučajni užici': '#7c3aed'   // nije prava GJ — grupa za vanplanske odjele
    };
    var GJ_BG = {
        'Risovac Krupa': '#eff6ff',
        'Grmeč Jasenica': '#f0fdf4',
        'Vojskova': '#fff7ed',
        'Slučajni užici': '#f5f3ff'
    };

    // ---- 4. GODINA I VERZIJA PODLOGE ----
    var PLAN_YEAR = 2026;

    // Povećati nakon svake zamjene data/odjeli.geojson — briše stari keš
    // poligona kod korisnika.
    var GEOJSON_VERSION = '20260603a';

    // ---- 5. GODIŠNJI PLAN SJEČE ----
    // Jedan unos po odjelu. Polja:
    //   bruto/neto  — planirana drvna masa (m³)
    //   cTrupci     — trupci četinara
    //   dzgo        — celuloza/cijepano četinari (u Mapi se zove cijepanoC)
    //   lTrupci     — trupci lišćara
    //   cijepano    — ogrijev/cijepano lišćari (u Mapi se zove cijepanoL)
    var PLAN_ENTRIES = [
        { gj: 'Risovac Krupa', odjel: '13',    bruto: 3244, neto: 2768, cTrupci: 3,    dzgo: 2,   lTrupci: 875,  cijepano: 1888 },
        { gj: 'Risovac Krupa', odjel: '35',    bruto: 5417, neto: 4648, cTrupci: 122,  dzgo: 44,  lTrupci: 1813, cijepano: 2670 },
        { gj: 'Risovac Krupa', odjel: '50',    bruto: 5161, neto: 4329, cTrupci: 1824, dzgo: 227, lTrupci: 971,  cijepano: 1307 },
        { gj: 'Risovac Krupa', odjel: '54P',   bruto: 1511, neto: 1276, cTrupci: 639,  dzgo: 109, lTrupci: 208,  cijepano: 320  },
        { gj: 'Risovac Krupa', odjel: '55',    bruto: 5195, neto: 4258, cTrupci: 2193, dzgo: 328, lTrupci: 789,  cijepano: 948  },
        { gj: 'Risovac Krupa', odjel: '56',    bruto: 3877, neto: 3206, cTrupci: 1779, dzgo: 263, lTrupci: 439,  cijepano: 725  },
        { gj: 'Risovac Krupa', odjel: '59/1',  bruto: 3724, neto: 3087, cTrupci: 1545, dzgo: 208, lTrupci: 658,  cijepano: 676  },
        { gj: 'Risovac Krupa', odjel: '63',    bruto: 4033, neto: 3339, cTrupci: 1309, dzgo: 236, lTrupci: 796,  cijepano: 998  },
        { gj: 'Risovac Krupa', odjel: '66',    bruto: 2645, neto: 2307, cTrupci: 0,    dzgo: 52,  lTrupci: 949,  cijepano: 1307 },
        { gj: 'Risovac Krupa', odjel: '68/2',  bruto: 2605, neto: 2287, cTrupci: 35,   dzgo: 6,   lTrupci: 1012, cijepano: 1234 },
        { gj: 'Risovac Krupa', odjel: '71P',   bruto: 1957, neto: 1655, cTrupci: 664,  dzgo: 114, lTrupci: 401,  cijepano: 476  },
        { gj: 'Risovac Krupa', odjel: '97',    bruto: 4889, neto: 4058, cTrupci: 1253, dzgo: 236, lTrupci: 901,  cijepano: 1668 },
        { gj: 'Risovac Krupa', odjel: '113P',  bruto: 5177, neto: 4300, cTrupci: 225,  dzgo: 74,  lTrupci: 1278, cijepano: 2723 },
        { gj: 'Grmeč Jasenica', odjel: '4/1',   bruto: 2490, neto: 2117, cTrupci: 0,   dzgo: 0,   lTrupci: 303,  cijepano: 1814 },
        { gj: 'Grmeč Jasenica', odjel: '11P',   bruto: 208,  neto: 179,  cTrupci: 0,   dzgo: 0,   lTrupci: 73,   cijepano: 106  },
        { gj: 'Grmeč Jasenica', odjel: '43P',   bruto: 1099, neto: 740,  cTrupci: 40,  dzgo: 100, lTrupci: 160,  cijepano: 440  },
        { gj: 'Grmeč Jasenica', odjel: '60',    bruto: 3551, neto: 3061, cTrupci: 295, dzgo: 65,  lTrupci: 1050, cijepano: 1651 },
        { gj: 'Grmeč Jasenica', odjel: '61',    bruto: 4774, neto: 4105, cTrupci: 454, dzgo: 102, lTrupci: 1393, cijepano: 2156 },
        { gj: 'Grmeč Jasenica', odjel: '64/2P', bruto: 996,  neto: 608,  cTrupci: 13,  dzgo: 23,  lTrupci: 211,  cijepano: 361  },
        { gj: 'Grmeč Jasenica', odjel: '66',    bruto: 5339, neto: 4493, cTrupci: 0,   dzgo: 0,   lTrupci: 1025, cijepano: 3468 },
        { gj: 'Grmeč Jasenica', odjel: '67',    bruto: 4853, neto: 4199, cTrupci: 0,   dzgo: 0,   lTrupci: 1530, cijepano: 2669 },
        { gj: 'Grmeč Jasenica', odjel: '69P',   bruto: 1309, neto: 1204, cTrupci: 82,  dzgo: 32,  lTrupci: 390,  cijepano: 700  },
        { gj: 'Grmeč Jasenica', odjel: '85P',   bruto: 678,  neto: 418,  cTrupci: 0,   dzgo: 73,  lTrupci: 25,   cijepano: 320  },
        { gj: 'Grmeč Jasenica', odjel: '88P',   bruto: 1805, neto: 1200, cTrupci: 0,   dzgo: 0,   lTrupci: 20,   cijepano: 1180 },
        { gj: 'Vojskova', odjel: '15',  bruto: 450, neto: 383, cTrupci: 0, dzgo: 0, lTrupci: 0,   cijepano: 383 },
        { gj: 'Vojskova', odjel: '21P', bruto: 787, neto: 624, cTrupci: 0, dzgo: 0, lTrupci: 202, cijepano: 422 },
        { gj: 'Vojskova', odjel: '25',  bruto: 750, neto: 637, cTrupci: 0, dzgo: 0, lTrupci: 0,   cijepano: 637 }
    ];

    // Odjeli planirani za NAREDNU godinu (prikazuju se na mapi drugom bojom).
    var PLAN_ENTRIES_NAREDNA = [
        { gj: 'Grmeč Jasenica', odjel: '5/1'   },
        { gj: 'Grmeč Jasenica', odjel: '5/2'   },
        { gj: 'Grmeč Jasenica', odjel: '68'    },
        { gj: 'Grmeč Jasenica', odjel: '8'     },
        { gj: 'Grmeč Jasenica', odjel: '80'    },
        { gj: 'Grmeč Jasenica', odjel: '81'    },
        { gj: 'Risovac Krupa',  odjel: '112'   },
        { gj: 'Risovac Krupa',  odjel: '120'   },
        { gj: 'Risovac Krupa',  odjel: '14'    },
        { gj: 'Risovac Krupa',  odjel: '34'    },
        { gj: 'Risovac Krupa',  odjel: '4'     },
        { gj: 'Risovac Krupa',  odjel: '44/1P' },
        { gj: 'Risovac Krupa',  odjel: '5'     },
        { gj: 'Risovac Krupa',  odjel: '6'     },
        { gj: 'Risovac Krupa',  odjel: '60'    },
        { gj: 'Risovac Krupa',  odjel: '7'     },
        { gj: 'Risovac Krupa',  odjel: '78'    },
        { gj: 'Risovac Krupa',  odjel: '81'    },
        { gj: 'Vojskova',       odjel: '15'    },
        { gj: 'Vojskova',       odjel: '22'    },
        { gj: 'Vojskova',       odjel: '23/2'  },
        { gj: 'Vojskova',       odjel: '25'    }
    ];

    // ---- 6. POSLOVOĐA → RADILIŠTE (rezervne liste) ----
    // Prava lista dolazi sa servera (INFO sheet). Ovo su rezerve ako server
    // ne odgovori. NAMJERNO su DVIJE i NISU iste:
    //   • OSNOVNI — prosta lista radilišta, imena SA dijakritikom, oba
    //     redoslijeda (ime prezime / prezime ime)
    //   • KARTA — dodatno dozvoljava ograničenje na pojedine odjele unutar
    //     radilišta (npr. Vojskova samo odjel 21), imena BEZ dijakritike
    // Ako se ujednače, izgubi se ograničenje po odjelu na karti.
    var POSLOVODJA_RADILISTA_OSNOVNI = {
        'MEHMEDALIJA HARBAŠ': ['BJELAJSKE UVALE', 'VOJSKOVA'],
        'HARBAŠ MEHMEDALIJA': ['BJELAJSKE UVALE', 'VOJSKOVA'],
        'JASMIN PORIĆ': ['RADIĆKE UVALE'],
        'PORIĆ JASMIN': ['RADIĆKE UVALE'],
        'IRFAN HADŽIPAŠIĆ': ['TURSKE VODE'],
        'HADŽIPAŠIĆ IRFAN': ['TURSKE VODE']
    };
    var POSLOVODJA_RADILISTA_KARTA = {
        'JASMIN PORIC': [{ radiliste: 'RADICKE UVALE' }],
        'HADZIPASIC IRFAN': [{ radiliste: 'TURSKE VODE' }],
        'HARBAS MEHMEDALIJA': [
            { radiliste: 'BJELAJSKE UVALE' },
            { radiliste: 'VOJSKOVA', odjeli: ['21'] }
        ]
    };

    // ============================================================
    // IZVEDENE VRIJEDNOSTI — ne mijenjati ručno
    // ============================================================

    // Mapa čita plan pod drugim imenima polja (istorijski razlog):
    //   dzgo → cijepanoC,  cijepano → cijepanoL
    // Izvodi se automatski iz PLAN_ENTRIES iznad, pa ne može doći do
    // neslaganja između Mape i Godišnjeg plana.
    var PLAN_ENTRIES_MAPA = PLAN_ENTRIES.map(function (e) {
        return {
            gj: e.gj, odjel: e.odjel, bruto: e.bruto, neto: e.neto,
            cTrupci: e.cTrupci, cijepanoC: e.dzgo,
            lTrupci: e.lTrupci, cijepanoL: e.cijepano
        };
    });

    window.SUMARIJA_CONFIG = {
        NAZIV_PUNI: NAZIV_PUNI,
        NAZIV_KRATKI: NAZIV_KRATKI,
        LOKACIJA: LOKACIJA,
        API_URL: API_URL,
        GJ_LIST: GJ_LIST,
        GJ_COLOR: GJ_COLOR,
        GJ_BG: GJ_BG,
        PLAN_YEAR: PLAN_YEAR,
        GEOJSON_VERSION: GEOJSON_VERSION,
        PLAN_ENTRIES: PLAN_ENTRIES,
        PLAN_ENTRIES_MAPA: PLAN_ENTRIES_MAPA,
        PLAN_ENTRIES_NAREDNA: PLAN_ENTRIES_NAREDNA,
        POSLOVODJA_RADILISTA_OSNOVNI: POSLOVODJA_RADILISTA_OSNOVNI,
        POSLOVODJA_RADILISTA_KARTA: POSLOVODJA_RADILISTA_KARTA
    };
})();
