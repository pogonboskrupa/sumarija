# Pregled aplikacije — DIO 2: Podaci i prikazi

**Datum:** 04.07.2026.
**Obuhvat:** dashboard, Operativa, stanje zaliha (korekcijski pipeline), forme za unos (sječa/otprema), moji unosi (edit/delete), izvještaji (`izvjestaji-new.js`), grafikoni (`charts.js`), godišnji plan (`godisnji-plan.js`), kupci, pending unosi

---

## ✅ ISPRAVLJENI BUGOVI (7)

### Kritično

**1. Operativa tab potpuno slomljen — TypeError u loadStatsForOperativa**
`js/app.js` — Kod je tražio `s.odjelNaziv.toLowerCase()` ali stanje-zaliha struktura ima `s.odjel` (odjelNaziv je bio u starom stanje-odjela formatu). `undefined.toLowerCase()` baca TypeError unutar `.find()` → cijeli tab završi u catch i ne učita se. Ovo je regresija od prelaska stanje-odjela → stanje-zaliha.
**Fix:** matching sada koristi `s.odjel || s.odjelNaziv` s fallbackom; čitanje projekta prilagođeno novoj strukturi (`ukupnoProjekat` skalar → `projekat['UKUPNO Č+L']` → legacy pozicioni niz).

**2. Decimalni zarez gubi podatke pri unosu (terenski radnici!)**
`js/app.js` — Radnik ukuca "12,5": `parseFloat("12,5")` vrati **12** (tiho odsiječe decimale — tako su radili kalkulator totala i validacija), a `Number("12,5")` vrati **NaN → 0** (tako je radio submit sječe!). Rezultat: uneseno 12,5 m³, snimljeno 0 m³. `submitOtprema` šalje sirove stringove pa backend isto gubi decimale.
**Fix:** novi globalni helper `parseNumInput()` (zarez → tačka) zamijenio sva 4 lokalna `getNum`-a; submitOtprema normalizuje sva number polja prije slanja.

### Ozbiljno — stale keš nakon izmjena

**3. Uređivanje/brisanje unosa NE briše keš → korisnik vidi stare podatke**
`js/app.js` — `submitEditSjeca`, `submitEditOtprema`, `deleteMySjeca`, `deleteMyOtprema` nakon uspjeha samo reloaduju tab, ali `fetchWithCache` vrati svjež keš (`cache_my_sjece_*`), pa obrisani unos i dalje stoji u listi, a izmijenjene vrijednosti su stare — do isteka TTL-a (vikendom danima!).
**Fix:** sva 4 toka sada brišu `my_sjece`/`my_otpreme` keš i resetuju `_tabRenderTime` za tab prije reloada.

**4. Invalidacija `stanje_odjela` je no-op — pravi ključ je `stanje_zaliha`**
`js/app.js` — Nakon dodavanja sječe/otpreme kod je zvao `clearCacheByPattern('stanje_odjela')`, ali keš ključ je odavno preimenovan u `cache_stanje_zaliha` → Stanje zaliha tab pokazivao stare brojke nakon unosa.
**Fix:** dodano i `clearCacheByPattern('stanje_zaliha')` na oba mjesta.

### Srednje

**5. Mrtav stanje-odjela blok (212 linija) — obrisan**
`js/app.js` — `loadStanjeOdjela`, `populateStanjeOdjelaDropdown`, `filterStanjeOdjela`, `renderStanjeOdjelaSections` nemaju nijednog pozivaoca, a HTML elementi (`stanje-odjela-container`, `stanje-odjela-select`) ne postoje u index.html. Render bi ionako bacio TypeError (čita `redovi.projekat` iz stare strukture). Tab je davno preimenovan u Stanje zaliha koji ima svoj kod.

**6. CSV export lomio kolone kod zareza u imenu**
`js/godisnji-plan.js` — `gpExportModalCsv` je spajao vrijednosti sirovim `join(',')` — primac/radilište sa zarezom pomjeri sve kolone udesno.
**Fix:** RFC-4180 quoting (polja s `,` `"` `\n` se citiraju, `"` se dupla).

**7. Dashboard onclick — nepotpun escaping imena odjela**
`js/app.js` — `showOdjelStanjeModal('${odjelEsc}')` escapovao samo apostrof; navodnik (`"`) u imenu odjela bi prekinuo HTML atribut.
**Fix:** dodan escape za `"` i `<`.

---

## ✔️ PROVJERENO — NIJE BUG (da se ne troši vrijeme ponovo)

- **Korekcijski pipeline zaliha** (`applyPreklasiranja`, `buildCorrectedZaliha`, `getNetZaliha`) — čist, imutabilan (`Object.assign({}, ...)` svugdje), nema dvostruke primjene korekcija pri ponovnom renderu.
- **charts.js mjesečni filter** — `parseInt(dateParts[1])` bez `-1` je ISPRAVNO tamo: month selektori za daily grafikone su 1-based (`value="1"` = Januar), konzistentno s dd.mm.yyyy formatom i `new Date(year, month, 0)` trikom za broj dana.
- **Sedmična agregacija** (`aggregateByWeekAndOdjel`) parsira samo dan iz datuma — sigurno, jer backend (`handlePrimaciDaily` u apps-script) filtrira redove po year+month prije slanja (0-based month konzistentan sa selectima izvještaja koji su `value="0"` = Januar).
- **calculateWeeksInMonth** — sedmice ne prelaze granice mjeseca, nedjelja ispravno završava sedmicu.
- **Chart.js destroy** — instance se uredno uništavaju prije ponovnog kreiranja (+ `Chart.getChart` fallback), nema "Canvas is already in use".
- **pending-unosi** — namjerno uvijek svjež fetch (bez keša), view-only lista bez approve/reject akcija.
- **godisnji-plan localStorage** — svi `JSON.parse` u try/catch.

---

## 📋 PREPORUKE (nije mijenjano)

**P1. Glavni CSV export godišnjeg plana bez quotinga**
`exportCsv` za tabove grupe/sortimenti/pregled ne citira polja. Trenutno bezopasno (GJ imena i odjeli nemaju zarez), ali ista `cell()` funkcija iz modala bi se trebala primijeniti i tu.

**2. `editMyOtprema` gradi input vrijednosti interpolacijom u HTML**
`value="' + value + '"` — vrijednosti su brojevi pa je sigurno danas, ali obrazac je krhak; bolje postavljati `.value` preko DOM-a nakon rendera.

**P3. `submitOtprema` šalje sirove stringove umjesto brojeva**
Za razliku od `submitSjeca` (koji koristi getNum), otprema prosljeđuje `.value` direktno — normalizacija zareza je sada dodana, ali bi ujednačavanje s getNum pristupom bilo čišće.

**P4. Dupli fetch preklasiranja**
`loadStanjeZaliha` fetcha `get-preklasiranja` direktnim `fetch()` bez keša pri svakom otvaranju taba — kandidat za `fetchWithCache` s kratkim TTL-om.
