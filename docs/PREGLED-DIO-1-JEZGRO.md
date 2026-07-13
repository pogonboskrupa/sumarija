# Pregled aplikacije — DIO 1: Jezgro i infrastruktura

**Datum:** 03.07.2026.
**Obuhvat:** `js/auth.js`, `js/cache-helper.js`, `js/api-optimized.js`, `js/utils.js`, `js/ui.js`, `js/drag-scroll.js` + core dio `js/app.js` (fetchWithCache, preload, keš, login/logout)

Aplikacija je za pregled podijeljena u 3 dijela:
1. **Dio 1 — Jezgro i infrastruktura** (ovaj dokument)
2. **Dio 2 — Podaci i prikazi** (dashboard, stanje zaliha, izvještaji, unosi) — slijedi
3. **Dio 3 — Mapa i alati** (karta, kubikator, print, notifikacije, PWA) — slijedi

---

## ✅ ISPRAVLJENI BUGOVI (16)

### Kritično — curenje podataka između korisnika

**1. Logout nije brisao keš → sljedeći korisnik na istom uređaju vidio tuđe podatke**
`js/auth.js` — Backend filtrira endpointe `primac-detail`, `otpremac-detail` itd. po prijavljenom korisniku, ali keš ključevi (`cache_primac_detail_2026`...) nemaju username. Radnik A se odjavi, radnik B se prijavi na istom tabletu → B vidi A-ove podatke o sječi iz keša (do isteka TTL-a).
**Fix:** logout sada briše SVE `cache_*` ključeve iz localStorage.

**2. Logout nije resetovao render-keš tabova → tuđi DOM ostajao vidljiv**
`js/auth.js` + `js/ui.js` — `switchTab` ima "instant" putanju koja prikaže postojeći sadržaj diva ako ima djecu i TTL nije istekao (vikendom TTL traje do ponedjeljka 6:30!). Nakon odjave A i prijave B, B-ov klik na isti tab prikazao bi A-ove lične podatke bez ikakvog refetcha.
**Fix:** logout resetuje `window._tabRenderTime = {}` (uz brisanje keša iz tačke 1).

### Ozbiljno — pogrešni/izgubljeni podaci

**3. Kolizija imena `fetchWithCache` trovala keš pogrešnim podacima**
`js/cache-helper.js` — I cache-helper.js i app.js definišu globalnu funkciju `fetchWithCache` s **različitim potpisima**; app.js (učitan kasnije) pobjeđuje. Interni pozivi u cache-helperu (`fetchMultiple`, `refreshCacheInBackground`) su zato u runtime-u zvali app.js verziju: options objekat postane keš ključ `"[object Object]"` za SVE pozive → paralelni batch fetch (stats + dashboard) bi drugi endpoint poslužio podacima prvog. "Background refresh" je zbog istog razloga bio no-op.
**Fix:** interni pozivi idu preko `window.CacheHelper.fetchWithCache` (uhvaćena referenca).

**4. `cleanOldCaches()` brisao `app_data_version` pri svakom učitavanju → lažne "osvježi sve" oluje među tabovima**
`js/cache-helper.js` — Pattern `key.includes('_v')` hvatao je i `app_data_version`. Otvaranje drugog taba brisalo je taj ključ, što bi u prvom tabu okinulo cross-tab storage event i bespotrebni reload svih prikaza.
**Fix:** pattern pooštren na `/^v\d+_/` (samo prave verzijske ključeve).

**5. Zakazano ažuriranje u 09:00 nije radilo ništa**
`js/auth.js` — `preloadAllViews(true)` prosljeđivao je `true` kao `silent`, a `forceRefresh` ostajao `false`. Smart-TTL keš je svjež do sutra 6:30, pa je "zakazani refresh" samo replay-ao keš.
**Fix:** `preloadAllViews(true, true)`.

**6. Force refresh brisao keš PRIJE mrežnog poziva → pad mreže = prazan ekran**
`js/app.js` — `forceRefresh` je radio `localStorage.removeItem(cacheKey)` unaprijed, pa stale-fallback nakon neuspjelih retry-a nije imao na šta pasti.
**Fix:** keš se ne briše; kod force refresha se samo preskače freshness check, a stari podaci ostaju kao rezerva.

**7. Preload prijavljivao "✅ Učitano 20/20" i kad je server mrtav**
`js/app.js` — `fetchWithCache` nikad ne baca grešku (vraća `{offline:true}` ili `{error}`), pa `catch` u preloadu nikad nije brojao neuspjehe.
**Fix:** preload sada prepoznaje `data.offline`/`data.error` kao pad i broji ga u `totalFailed`.

**8. Isti endpoint fetchovan 2–4× paralelno pri preloadu**
`js/app.js` — `primac-detail` se preloaduje 4× pod različitim ključevima; `dashboard` 2×. Bez in-flight dedupa svi promašaji keša idu paralelno na spori Apps Script (120–180 s budžeti).
**Fix:** dodan in-flight dedup po URL-u — drugi pozivač dijeli isti Promise, a odgovor se keširira i pod njegov ključ.

**9. Typo u keš ključu: `tekuci_miesec` vs `tekuci_mjesec`**
`js/app.js` — Preload je pisao sekundarni keš pod `cache_primke_tekuci_miesec`, a dashboard čita `..._mjesec` → optimizacija dijeljenog fetcha nikad nije radila.
**Fix:** typo ispravljen na svim mjestima (sed po cijelom fajlu).

**10. `invalidateCache()` u CacheHelperu nikad ništa nije obrisao**
`js/cache-helper.js` — Keš ključevi se grade od punog URL-a, a invalidacija je tražila exact-match `v2_primaci_{}` koji ne postoji → nakon upisa nove sječe korisnik je do 5 min gledao stare podatke.
**Fix:** invalidacija sada radi prefix-scan (`path=<endpoint>` u ključu).

### Srednje — crash / zaglavljeno UI stanje

**11. Šihtarica tabovi bacali `ReferenceError` → blank ekran**
`js/ui.js` — `loadSihtaricaPrimac()` / `loadSihtaricaOtpremac()` ne postoje nigdje u kodu, a switchTab prvo sakrije sav sadržaj pa ih pozove → primac koji klikne "Šihtarica" ostane na praznoj ljusci aplikacije. Isti problem: `loadKupciStatistika()`.
**Fix:** typeof-guardovi + prikaz content diva. **⚠️ Preostaje:** implementirati loadere ili ukloniti stavke iz menija (vidi Preporuke).

**12. Tihi background-refresh taba prvo bljesne podatke pa ih obriše**
`js/ui.js` — Instant putanja prikaže keširan DOM, pa fall-through na "sakrij sve sekcije" odmah sve sakrije do kraja refresha.
**Fix:** sadržaj koji se tiho osvježava izuzet je iz hide-all koraka.

**13. Interval zakazanog refresha preživljavao logout → toast + TypeError preko login ekrana**
`js/auth.js` — `setInterval(checkAndRefresh)` se nikad ne gasi; u 09:00 nakon odjave pucao je na `currentUser.type`.
**Fix:** `if (!currentUser) return;` guard u `checkAndRefresh` i u cross-tab handleru (+ `.catch` na promise).

**14. Login rušio s kriptičnom porukom kad GAS vrati HTML/500**
`js/auth.js` — `response.json()` bez `response.ok` provjere → "Unexpected token '<'...".
**Fix:** provjera `response.ok` + try/catch oko json() s razumljivom porukom.

**15. "Obriši keš" unregistrovao Service Worker ali NIJE reloadao stranicu**
`js/app.js` — Dijalog obećava "Stranica će se osvježiti", a kod je samo preloadao prikaze. PWA ostane bez offline podrške do ručnog reloada (na terenu = mrtva aplikacija bez signala).
**Fix:** `location.reload()` nakon brisanja.

**16. Offline upozorenje trajno gasilo i online error-toast**
`js/app.js` — `_offlineNoCacheWarned` flag postavljen u offline grani nikad se nije resetovao → kasniji timeout servera prošao bi bez ikakvog upozorenja i retry dugmeta.
**Fix:** flag se resetuje nakon 8 s; retry dugme dodatno guardovano za slučaj da `window.currentTab` još ne postoji (fallback: reload).

### Manje — kvalitet

**17. XSS sink u toast notifikacijama**
`js/utils.js` — `title`/`message` išli sirovi u `innerHTML`, a deseci pozivalaca prosljeđuju `error.message` (tekst sa servera).
**Fix:** dodan `escapeHtml()` helper, oba polja se escapuju.

**18. Drag-scroll gutao sljedeći legitimni klik**
`js/drag-scroll.js` — Ako drag završi izlaskom miša van elementa (`mouseleave`), one-shot click-suppressor ostane naoružan i pojede SLJEDEĆI pravi klik (npr. na dugme za uređivanje).
**Fix:** suppressor se postavlja samo pri pravom `mouseup`.

**19. Sortiranje tabela mrsilo datume i miješalo tipove**
`js/ui.js` — `"15.01.2026"` se parsirao kao broj 15.01 → hronološki pogrešan redoslijed; komparator numeričko/tekstualno po paru nije tranzitivan.
**Fix:** dd.mm.yyyy / dd/mm/yyyy se prepoznaje i poredi kao `yyyymmdd`; ne-brojevi konzistentno idu na kraj.

**20. Timer leak u retry petlji fetcha**
`js/app.js` — `catch` grana nije čistila `timeoutId`, ostavljajući tajmere koji abortuju mrtve controllere.
**Fix:** `clearTimeout` u catch grani.

---

## 📋 PREPORUKE (nije mijenjano — traži odluku/veći zahvat)

**P1. Lozinke u plain tekstu (VISOK prioritet)**
Lozinka se čuva sirova u `localStorage['sumarija_pass']` i šalje kao GET query parametar u SVAKOM API pozivu → završava u browser historiji, proxy i GAS logovima. Preporuka: login neka vrati sesijski token; lozinku slati samo jednom, POST-om; iz localStorage čuvati samo token.

**P2. Auto-login ne validira kredencijale**
Nakon što admin promijeni lozinku radniku, uređaj tog radnika prikazuje ljusku aplikacije u kojoj je svaki tab zauvijek prazan (svi pozivi vraćaju "Unauthorized", nigdje se ne detektuje). Preporuka: pri auto-loginu opaliti jeftin `login` poziv, ili centralno u `fetchWithCache` na `error === "Unauthorized"` pozvati `logout()`.

**P3. Šihtarica: implementirati ili ukloniti**
Meni "Šihtarica" postoji za primce i otpremce, HTML divovi postoje, ali loaderi su obrisani iz koda. Guard sada sprječava crash, ali tab je prazan. Supabase SDK je uključen u index.html (komentar "šihtarica") ali klijent se nigdje ne inicijalizuje — izgleda kao napola završena migracija.

**P4. Per-user keš ključevi**
Trajnije rješenje od brisanja pri logoutu: u ključeve za user-filtrirane endpointe (`cache_primac_detail_*`, `cache_primac_sedmicni_*`...) uključiti `currentUser.username`, kao što `cache_my_sjece_*` već radi.

**P5. `js/api-optimized.js` je uglavnom mrtav kod**
`window.API.*` se nigdje ne poziva iz aplikacije; njegov `API_BASE_URL` je duplikat konfiguracije. Ili obrisati fajl, ili preći na njega kao jedini API sloj — trenutno je treći paralelni fetch-mehanizam (uz app.js i cache-helper).

**P6. Submenu switcheri se oslanjaju na implicitni `window.event`**
`switchPrimaciSubmenu` i sl. čitaju globalni `event` za postavljanje `.active` klase — pri programatskom pozivu pogrešno dugme dobije aktivno stanje. Preporuka: `onclick="switchPrimaciSubmenu('daily', this)"`.

**P7. Mrtav kod u utils.js**
`enableVirtualScroll` (scroll listener po pozivu, bez teardowna) i `getCachedElement` nemaju nijednog pozivaoca — obrisati ili dovršiti.

**P8. Dvostruki keš sistem**
localStorage keširanje postoji u app.js (cache_*) i cache-helperu (v2_*) s različitim TTL-ovima i invalidacijom. Dugoročno spojiti u jedan.
