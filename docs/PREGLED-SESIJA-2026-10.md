# Pregled aplikacije — 3 dijela (sesija 18.10.2026., v2.112–2.114)

Stariji `PREGLED-DIO-*.md` opisuju raniju verziju koda (npr. `cache-helper.js`, `api-optimized.js` više ne postoje). Ovaj dokument vrijedi za trenutno stanje.

## Dio 1 — Jezgro (v2.112)
`auth.js`, `ui.js`, `utils.js`, `data-sync.js`, `idb-helper.js`, `service-worker.js`, keš/fetch dio `app.js`.
- Prijava drugog korisnika sada briše i IndexedDB primke/otpreme (curenje podataka među korisnicima).
- Data sync: race pri odjavi, tihi gubitak redova kod djelimičnog upisa, `getMeta || 0` no-op, timer leak, kredencijali u endpointima nakon odjave.
- `saveData([])` više ne visi; `mapa-fokus` se gasi prije instant putanje u `switchTab`; filter datuma u lokalnoj zoni; SW `waitUntil`.

## Dio 2 — Podaci i prikazi (v2.113)
- `window.currentUser` nije postojao (`let`) → šihtarica/mapa/kubikator radili kao `anon`. Dodan getter + migracija `anon` zapisa.
- Poslovođa "zadnjih 5 dana": `new Date('dd.mm.yyyy')` → `parseDatumDDMMYYYY`.
- `clearCacheByPattern` briše i IndexedDB keš; `jsAttr()` za nazive sa `"`/`&` u `onclick`/`data-*`; escape poruka servera.

## Dio 3 — Alati i backend (v2.114)
- **`update-pending` (korupcija podataka):** forma za uređivanje koristila `RUDNO/ČETINARI/TRUPCI`, sheet `RD/Σ ČETINARI/TRUPCI L` → RD se prikazivao kao 0, TRUPCI Č snimljen bez RD, `UKUPNO Č+L` ostajao star. Sada: alias na frontendu, bijela lista unosnih kolona i serversko računanje zbirova, `parseDate` za datum, bounds-check `rowIndex`, `invalidateAllCache()` nakon izmjene/brisanja.
- Datum u formi za uređivanje (ISO sa zonom) nije prolazio u `<input type="date">`.
- `doGet` je u Apps Script log upisivao lozinke (`e.parameter`) — redigovano. `verifyUser/handleLogin` porede korisničko ime kao `String`.
- `print-utils.js`: escape radilišta/odjela u štampanom dokumentu.

## Otvorene preporuke
1. Lozinka u plain tekstu u `localStorage` i GET parametrima svakog poziva → token iz `login`.
2. Forma za otpremu šalje sirove `.value` (prazno = `''`), forma za sječu `0` — ujednačiti.
3. Zapis traga koji traje preko odjave bi se upisao pod `anon` (rubni slučaj).
4. Šihtarica: u `apps-script/` postoji server-side verzija koja se ne koristi.
