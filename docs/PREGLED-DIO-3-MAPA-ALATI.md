# Pregled aplikacije — DIO 3: Mapa i alati

**Datum:** 04.07.2026.
**Obuhvat:** `js/karta-odjela.js` (Leaflet mapa, rute), `js/kubikator.js`, `js/print-utils.js`, `js/notifications.js`, `service-worker.js` + SW registracija u `app.js`, `data-sync.js`, `idb-helper.js`, `js/mock-api.js`

---

## ✅ ISPRAVLJENI BUGOVI (7)

### Kritično — PWA update mehanizam

**1. Dvije SW registracije s konfliktnim strategijama → dupli reload, reload usred rada**
`js/app.js` — Service worker se registrovao DVAPUT (linije ~15 i ~191), svaki blok sa svojim `updatefound` handlerom. Blok 1 je radio `window.location.reload()` čim se novi SW instalira — **usred rada korisnika, npr. dok popunjava formu za unos sječe**. Blok 2 je slao `SKIP_WAITING` poruke koje SW uopšte ne sluša (nema message listener — SW sam radi `skipWaiting()`), pa reload na `controllerchange`. Pri svakom deployu: dva reloada u trci. Dodatno, `clients.claim()` pri prvoj posjeti okida `controllerchange` → bespotreban reload odmah po prvom učitavanju.
**Fix:** jedna registracija, jedna strategija — SW sam radi skipWaiting/claim, stranica se reloada tačno jednom na `controllerchange`, s guardom za prvu posjetu (`hadController`) i protiv višestrukih reloada (`swRefreshing`).

**2. Offline fallback stranica nikad nije bila u kešu**
`service-worker.js` — Install je bio "lazy, bez pre-keširanja", ali `offline.html` se u normalnom radu nikad ne fetcha → nikad ne uđe u keš → offline korisnik na navigaciji dobije sirovu browser grešku umjesto offline stranice. Uz to je fallback tražio apsolutnu putanju `/offline.html` (puca ako je app u podfolderu).
**Fix:** `offline.html` se pre-kešira pri installu; relativna putanja; CACHE_VERSION v11→v12 da se izmjena primijeni.

### Ozbiljno — terenski alati

**3. Kubikator gubi decimale kod zareza**
`js/kubikator.js` — `parseFloat("32,5")` vrati 32 — pola centimetra prečnika tiho nestane, zapremina po Huberovoj formuli ispadne pogrešna. Isti bug klase kao u formama za unos (Dio 2).
**Fix:** lokalni `_num()` helper normalizuje zarez u tačku za prečnik i dužinu.

**4. OSRM rute bez timeouta i bez provjere odgovora**
`js/karta-odjela.js` — Javni OSRM demo server zna visiti minutama; `fetch` bez timeouta ostavlja korisnika da čeka zauvijek bez povratne informacije, a `resp.ok` se nije provjeravao (HTTP 429/500 → kriptična JSON greška).
**Fix:** `AbortSignal.timeout(15000)` + `resp.ok` provjera na oba mjesta (ruta od šumarije, ruta odjel→odjel).

### Srednje

**5. Popup blocker ruši sve print funkcije**
`js/print-utils.js` (5 mjesta) + `js/izvjestaji-new.js` (1 mjesto) — `window.open()` vrati `null` kad browser blokira popup → `win.document.write` baca TypeError bez ikakve poruke korisniku. Mobilni browseri često blokiraju popupe.
**Fix:** null-guard s razumljivom porukom na svih 6 mjesta.

**6. Kubikator napomena — sirov tekst u innerHTML**
`js/kubikator.js` — Napomena korisnika ide direktno u HTML tabele; `<` u tekstu lomi prikaz reda.
**Fix:** escapuje se kroz `escapeHtml` (helper iz Dijela 1).

**7. (iz Dijela 1, dovršeno ovdje)** — "Obriši keš" sada reloada stranicu pa se SW ponovo instalira; bez toga bi PWA nakon brisanja keša ostala bez offline podrške.

---

## ✔️ PROVJERENO — NIJE BUG

- **mock-api.js se NE učitava u produkciji** — nije u index.html script tagovima.
- **data-sync.js interval lifecycle** — `clearInterval` prije re-schedule, `stopSmartSync()` se zove pri logoutu; nema gomilanja intervala.
- **idb-helper.js** — sve operacije promisificirane s error handlingom.
- **notifications.js** — cooldown (5 min), permission handling i SW/fallback notifikacije uredni.
- **Referencirani fajlovi postoje** — `offline.html`, `icon-192.png`, `favicon.png`.
- **karta _loadGeojson** — localStorage quota (7.5MB GeoJSON) u try/catch s verzioniranjem i SW-cache čišćenjem starih verzija.
- **Status mapa karte** (`_buildStatusMap`, normKey/labelKey dvostruki ključevi, slučajni/prelazni setovi) — pregledana u ranijim sesijama, konzistentna.

---

## 📋 PREPORUKE (nije mijenjano)

**P1. OSRM demo server nije za produkciju**
`router.project-osrm.org` je javni demo bez SLA — usporen/ratelimitovan u špici. Za pouzdane rute na terenu razmotriti vlastiti OSRM (Docker, BiH extract ~200MB) ili komercijalni servis (ORS, Mapbox).

**P2. `notifications.js` krhka DOM-navigacija**
`knob.parentElement.previousElementSibling.nextElementSibling` (linija ~209) — puca na prvu promjenu HTML strukture togglea; bolje ciljati element po ID-u.

**P3. Print prozori koriste `document.write`**
Radi, ali je deprecated; dugoročno prijeći na Blob URL + `window.open(blobUrl)` ili skriveni iframe.

**P4. Kubikator `confirm()`/`alert()`**
Ostatak aplikacije koristi `showConfirmModal`/toast — kubikator bi trebao isto radi konzistentnosti (posebno "Obriši sve").

**P5. SW keš raste bez ograničenja**
Stale-while-revalidate kešira sve JS/CSS/slike bez LRU čišćenja unutar iste verzije — uz česte deploye bezopasno (bump verzije briše sve), ali vrijedi znati.

---

# SAŽETAK CIJELOG PREGLEDA (Dijelovi 1–3)

| Dio | Obuhvat | Ispravljeno | Izvještaj |
|-----|---------|-------------|-----------|
| 1 — Jezgro i infrastruktura | auth, cache, fetch, ui, utils | 20 bugova | `docs/PREGLED-DIO-1-JEZGRO.md` |
| 2 — Podaci i prikazi | dashboard, zaliha, forme, izvještaji | 7 bugova | `docs/PREGLED-DIO-2-PODACI.md` |
| 3 — Mapa i alati | karta, kubikator, print, SW/PWA | 7 bugova | ovaj dokument |

**Najvažnije preporuke koje čekaju odluku (svi dijelovi):**
1. Lozinke u plain tekstu u localStorage + GET parametrima → prijeći na token (Dio 1, P1)
2. Auto-login ne detektuje promijenjenu lozinku → prazna aplikacija (Dio 1, P2)
3. Šihtarica — implementirati (Supabase klijent se nikad ne inicijalizuje) ili ukloniti iz menija (Dio 1, P3)
4. OSRM demo server zamijeniti produkcijskim rješenjem (Dio 3, P1)
