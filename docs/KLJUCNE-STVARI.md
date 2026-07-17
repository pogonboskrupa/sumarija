# Ključne stvari — arhitektura, zamke i nalazi provjere koda

> Zadnje ažurirano: v1.4.32 (juli 2026). Ovaj dokument je obavezno štivo prije
> većih izmjena — sadrži zamke koje su već tri puta proizvele "prazan tab" bugove.

## 1. Arhitektura ukratko

- **Frontend**: vanilla JS PWA, bez build koraka. Fajlovi se služe direktno sa
  GitHub Pages, **sa `claude/cool-goodall-16hUL` brancha** (ne main!). Main se
  održava sinhronizovanim kao backup.
- **Backend**: Google Apps Script (`apps-script/*.gs`), spor (2-10s po pozivu).
  Svi pozivi idu kroz `buildApiUrl(path, params)` + `fetchWithCache(url, cacheKey,
  forceRefresh, timeout)`.
- **Verzionisanje**: `VERSION` fajl u rootu + `APP_VERSION` u `js/app.js` vrh —
  **ručno se bumpa uz SVAKI commit** (nema CI). Prikazuje se u meniju pored
  "Odjavi se"; update banner obavještava korisnike o novoj verziji.
- **Uloge**: `admin`, `operativa`, `poslovođa`, `primac`, `otpremac` — tabovi po
  ulozi se dinamički grade u `js/auth.js` (`showApp()`, `tabsConfig`).
  NAPOMENA: **OPERATIVA panel je izbrisan u v1.4.32** — uloga `operativa` i dalje
  postoji (dashboard, kupci, mjesečni pregled, izvještaji), samo bez
  "Operativa & Analiza" taba.

## 2. Keš slojevi (offline-first)

| Sloj | Šta drži | Ključno |
|---|---|---|
| `localStorage` `cache_*` | JSON `{data, timestamp}` po prikazu | LRU eviction pri punoj kvoti (briše najstarije, jedan po jedan) |
| IndexedDB (`idb-helper.js`, META store, `blob_` prefiks) | **Samo** `cache_primke_sjeca` i `cache_otpreme_tab` (2-3MB svaki) | `IDB_LARGE_KEYS` u app.js; localStorage kvota (5-10MB) ih ne može držati |
| Service Worker | statika + `data/odjeli.geojson` (7.5MB, cache-first) | GeoJSON se NIKAD ne drži u localStorage |

Pravila:
- `fetchWithCache` **nikad ne baca** — vraća `{offline:true}` ili `{error}`.
  Каller mora provjeriti `data.offline || data.error`.
- Invalidacija je **meka**: `timestamp=0`, `data` ostaje kao offline fallback
  (`invalidateCachePrefixes`). Nikad ne brisati keš destruktivno.
- `hasSafetyNet`: ako postoji stari keš, mrežni timeout se reže na 20s/1 pokušaj;
  bez keša puni timeout/2 pokušaja.
- Bulk preload (`preloadAllViews`) reže timeout na 35s po stavci (`BULK_TIMEOUT_CAP`)
  i ima guard protiv paralelnih pokretanja (`_preloadRunning`).
- `alsoCache` u preload listama piše **alias pokazivač** `{__alias: primarniKljuc}`,
  ne kopiju podataka (kvota!). Čitanje ide kroz `_resolveCacheRaw`.

## 3. ⚠️ ZAMKA #1: `[id$="-content"]` kolizija (3 buga do sada)

`switchTab()` u `js/ui.js` skriva **sve** elemente čiji ID završava na
`-content` (generički selektor). Svaki **ugniježđeni** div (podtab sadržaj)
čiji ID završava na `-content` biva trajno sakriven — sadržaj se upiše, ali
div ostane `display:none` → "prazan tab".

Dosadašnje žrtve:
1. `kupci-statistika-content` — workaround: `classList.remove('hidden')` u loaderu
2. `kupci-sortiment-content` — isti workaround
3. `izvjestaji-po-odjelima-content` — preimenovan u `...-prikaz`

**Pravilo: novi ugniježđeni kontejneri NE SMIJU imati ID koji završava na
`-content`.** Koristi `-prikaz`, `-view`, `-panel`...

## 3b. ⚠️ ZAMKA #1b: async loader otkrije panel nakon promjene taba (v1.4.35)

Async loaderi (`loadX`) rade `getElementById('X-content').classList.remove(
'hidden')` **nakon `await`-a**. Ako korisnik pređe na drugi tab dok fetch traje,
stari loader se razriješi i **ponovo otkrije SVOJ panel** — dva `-content`
panela su vidljiva istovremeno, naslagana vertikalno, pa lista prethodnog taba
"procuri" na dno tekućeg ("podaci od drugog taba na dnu liste").

Rješenje: helper `showTabContent(contentId)` (app.js, blizu `isActiveTab`) —
otkriva panel SAMO ako pripada trenutno aktivnom tabu (obrnuta pretraga kroz
`TAB_CONTENT_MAP`). Podpaneli van mape (edit/add/stanje-odjela-admin/
poslovodja-zadnjih5) prolaze nepromijenjeno. **Svi** `-content` un-hide pozivi
u app.js (47 mjesta) idu kroz ovaj helper. **Pravilo: nikad ne raditi sirovi
`getElementById('X-content').classList.remove('hidden')` u async kodu — koristi
`showTabContent('X-content')`.**

## 4. ⚠️ ZAMKA #2: duple globalne funkcije / redoslijed skripti

Defer skripte se izvršavaju po redu u `index.html`; **kasnija `function`
deklaracija tiho pregazi raniju**. `js/app.js` se učitava POSLIJE pomoćnih
fajlova, pa njegove verzije uvijek pobjeđuju:

| Funkcija | Duplikat u | Aktivna verzija |
|---|---|---|
| `fetchWithCache` | ~~`js/cache-helper.js`~~ (obrisan v1.4.33) | app.js |
| `buildApiUrl` | ~~`js/api-optimized.js`~~ (obrisan v1.4.33) | app.js |
| `checkManifest` | `data-sync.js` | app.js |
| `getWeekWithinMonth`, `formatDateDDMMYYYY` | ~~`js/week-fix.js`~~ (obrisan v1.4.33) | app.js |

**Update v1.4.33**: `js/cache-helper.js`, `js/api-optimized.js` i `js/week-fix.js`
su bili u potpunosti inertan mrtvi kod (nijedna njihova funkcija/`window.API`/
`window.CacheHelper` izvoz se nije koristio nigdje van sebe samih — provjereno
grep-om kroz cijeli repo) i **fizički su obrisani**, zajedno sa `<script>`/
`<link rel="preload">` tagovima u `index.html`. `data-sync.js`s `checkManifest`
i dalje postoji kao živ (ali pregažen) duplikat — nije dirano jer je fajl aktivan
za drugu funkcionalnost (delta sync), samo ta jedna funkcija je mrtva.

## 5. Nalazi provjere koda (v1.4.32)

### Ispravljeno
- **OPERATIVA panel izbrisan** (zahtjev): `index.html` blok (~155 linija),
  `ui.js` mapa+grana, `auth.js` tab+panel lista, `app.js` ~690 linija funkcija
  (`loadOperativa`, `loadStatsForOperativa`, `loadOperativaData`, 8× `render*`).
- **Duplikat `id="kupci-content"`** — drugi (mrtvi legacy "Analiza Kupaca",
  104 linije) blok obrisan iz index.html. `getElementById` je uvijek pogađao
  prvi, pa je legacy blok bio nedostupan mrtvi teret sa duplim unutrašnjim
  ID-jevima (`kupci-mjesecni-table`!).
- **`deleteAllPendingUnosi()` nije postojala** — dugme "Obriši sve" u Dodani
  unosi bacalo `ReferenceError` (klik ne radi ništa) iako backend endpoint
  `delete-all-pending` postoji. Implementirana s confirm modalom.
- **Mrtve funkcije obrisane**: `renderKupciTop5BySortimenti`, `renderKupciTop10`
  (ciljale legacy blok), `filterAnalyticsTable` (ciljala operativa panel),
  `renderKupciMjesecniTrend` — nikad pozvana **i imala cache-poisoning bug**:
  keširala odgovor `otpremaci` endpointa pod tuđi ključ `cache_kupci_<godina>`.
- **Mrtvi preload unosi**: `Operativa (Stats)` (admin + operativa liste) —
  `cache_stats_<year>` se pisao ali **nigdje nije čitan**; svaki puni refresh
  je bacao težak `stats` GAS poziv (180s timeout) uzalud. `Operativa - Dashboard`
  (`cache_dashboard_<godina>` bez mjeseca) — nakon brisanja panela bez čitaoca.
- **Fizički obrisani mrtvi fajlovi** (v1.4.33): `js/cache-helper.js`,
  `js/api-optimized.js`, `js/week-fix.js` — vidi tabelu iznad. -664 linije.

### Poznato, namjerno ostavljeno
- `cache-helper.js` / `api-optimized.js` / `week-fix.js` su mrtvi (v. Zamka #2) —
  ne diramo ih dok se ne izdvoji vrijeme za bezbjedno uklanjanje iz index.html.
- `getDayName` definisana 2× unutar app.js — obje su **lokalne** (ugniježđene
  u različitim funkcijama), bezopasno.
- Uloga `operativa` u auth.js i njena preload grana u app.js ostaju (korisnici
  tog tipa i dalje postoje).

## 6. Konvencije za izmjene

1. **Svaki commit**: bump `VERSION` + `APP_VERSION`, detaljan opis uzroka u
   commit poruci, push na `claude/cool-goodall-16hUL`, merge u `main`.
2. `node --check js/<fajl>.js` prije svakog commita.
3. Netrivijalne logičke izmjene prvo dokazati `node -e` simulacijom.
4. Novi prikazi: podaci kroz `fetchWithCache` s postojećim ključem ako endpoint
   već ima keš (ne izmišljati novi ključ za isti URL — kvota + konzistentnost).
5. Novi prikaz mora u `preloadAllViews` listu odgovarajuće uloge (offline).
6. "Ukupno" redovi tabela: crna slova s bijelim outlineom (text-shadow), ne
   bijela (v1.4.31).
7. Print prozori ne učitavaju main.css — sve stilove definisati inline u
   print HTML-u.
