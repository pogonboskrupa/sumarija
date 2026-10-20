# Šumarija — znanje, greške i lekcije (za ubuduće)

Zadnje ažuriranje: v2.142. Ovaj dokument sažima sve što je naučeno kroz pregled aplikacije, redizajne tabova i ispravke. `docs/PREGLED-DIO-*.md` su **zastarjeli** (opisuju stari kod); `docs/PREGLED-SESIJA-2026-10.md` je sažetak prvog pregleda.

## 1. Arhitektura u kratkim crtama

- **Frontend:** statički `index.html` + `js/*.js` (klasične skripte, dijele globalne varijable) + `css/main.css`, `css/table-contrast-fix.css`. PWA sa service workerom (`service-worker.js`, trenutno cache `v171`).
- **Backend:** Google Apps Script (`apps-script/*.gs`): `main.gs` (doGet routing), `api-handlers.gs`, `services.gs`, `authentication.gs`, `config.gs`, `utils-triggers.gs`, `diagnostic.gs`. Podaci su u Google Sheetu (`BAZA_PODATAKA`: INDEKS_PRIMKA, INDEKS_OTPREMA, DINAMIKA, prijava…).
- **Keš:** `fetchWithCache(url, cacheKey, force, timeout)`; localStorage `cache_*` sa pametnim TTL-om; veliki kešovi (`cache_primke_sjeca`, `cache_otpreme_tab`) u IndexedDB (`IDB_LARGE_KEYS`). Server dodatno kešira odgovore (`getCachedData/setCachedData`).
- **Verzija:** `VERSION` fajl i `const APP_VERSION` u `js/app.js` moraju se mijenjati zajedno.
- **Tok rada koji korisnik traži ("MERGAJ U MAIN"):** commit na branch `claude/gifted-ride-xcq4mh` → bump verzije → merge `--no-ff` u `main` → push oba. Bez PR-ova.
- **Backend se NE deploya sam.** Korisnik ručno lijepi `.gs` fajlove i radi *Deploy → Manage deployments → Edit → New version*. Svaka izmjena `.gs` zahtijeva tu napomenu korisniku.

## 2. Domenske činjenice (šumarstvo / podaci)

- **Sječa = primka** (primač/radnik evidentira posječeno), **otprema** = izvoz drva (otpremač, kupac). **Šuma/panj (stanje) = sječa − otprema.**
- Zapisi primki/otprema dolaze **jedan red po sortimentu** `{datum 'dd.mm.yyyy', odjel, radiliste, izvodjac, poslovodja, sortiment, kolicina, primac|otpremac, kupac}`.
- Agregatni "sortimenti" u podacima: `Σ ČETINARI`, `LIŠĆARI`, `TRUPCI Č`, `TRUPCI L`, `UKUPNO Č+L`, `SVEUKUPNO`. **Pri zbrajanju kolona nikad ne zbrajati agregate zajedno sa pojedinačnim sortimentima** (dupli obračun). Kolona ukupno za dashboard je "UKUPNO Č+L" (Y u primki, Z u otpremi).
- **Dinamika = plan** po mjesecima, list `DINAMIKA`. Poredi se sječa sa planom **do kraja tekućeg mjeseca**, ne sa planom cijele godine.
- **Aktivni odjel** = sječa u zadnjih 10 dana; **nedavni** = zadnjih 60 dana (ostali odjeli su skriveni dok se ne proširi prikaz u Stanju zaliha).
- Radni dan primača = jedinstven datum sa unosom za tog primača u mjesecu. Prosjek m³/dan = ukupni kubici / ukupni radni dani (ne prosjek prosjeka).
- Odjeli se na serveru grupišu po **tačnom nazivu**; različito pisanje ("12a"/"12A"/razmak) daje dva odjela.

## 3. Greške koje su se desile (i kako ih izbjeći)

### Podaci / backend
| Problem | Uzrok | Pouka |
|---|---|---|
| Dashboard 404/CORS | Stara URL Apps Script deploymenta | Korisnik ažurira kroz *Manage deployments → New version* (isti URL). Ne praviti novi deployment. |
| "NEMA PODATAKA NIKAKO", CORS + `ERR_FAILED 200 (OK)` na svim endpointima | Apps Script vraća HTML stranicu s greškom (nema CORS headera) kad je projekat nevažeći | **Prvo otvoriti `…/exec?path=login&username=x&password=y` u tabu i pročitati grešku.** Uzrok bio: `SyntaxError: Identifier 'PRIJAVA_SHEET' has already been declared (file "services")` — blok iz `authentication.gs` je pri lijepljenju završio i u `services`. Svaki `const/function` smije postojati u tačno jednom fajlu. |
| Dinamika 0 na mobitelu, OK na desktopu | Server-side keš odgovora dashboarda bez plana/dijagnostike + stari lokalni keš | Server ne kešira odgovor bez plana; klijent preskače keš ako nema dinamike/dijagnostike (`dinamikaOk`). Keš se jednokratno čisti preko `sumarija_dashboard_cache_gen`. |
| Dinamika uopće nije čitana | Čitanje po fiksnoj koloni/formatu | `readDinamikaPlan` čita po zaglavlju (SVEUKUPNO/nazivi mjeseci), lokalni brojevi (zarez), `_dinamikaDiag` objašnjava zašto je plan prazan. |
| Radni dani mogli biti precijenjeni | `toISOString()` pomjera datum u UTC | Ključ dana praviti od lokalnih `getFullYear/getMonth/getDate`. |
| KPI "Ispod plana" uvijek u toku godine | Sječa YTD poređena sa planom cijele godine | Plan do tekućeg mjeseca. |
| Zapis prijava u list "prijava" nestao | Login se nije logovao na serveru | `zabiljeziLogin` + `handleLogin(user,pass,zabiljezi)`; `main.gs` šalje `true` samo za `path=login`. |
| Lozinke u logovima | `main.gs` logovao parametre | Lozinke su redigovane u logu. **Otvoreno:** lozinka se i dalje šalje kao GET parametar i čuva u localStorage — preporuka je token. |
| Oštećeni pending unosi | `handleUpdatePending` bez validacije | Whitelist polja, ukupno računa server, provjera granica, `invalidateAllCache`. |

### Frontend
| Problem | Uzrok | Pouka |
|---|---|---|
| **Tab "Prikaz po kupcima" prikazivao "Sječa po danima"** | Višak `</div>` u HTML-u izbacio podtabove izvan `#primaci-content`; `primaci-daily-view` nema `hidden`, pa se vidio svuda | Nakon svake HTML izmjene provjeriti **ugniježđenost** (parser koji ispiše roditelje `*-content`/`*-view`). |
| Curenje korisničkih podataka | Keševi nisu čišćeni pri promjeni korisnika | IDB clear za stranog korisnika, `_migrateAnonStorage`. |
| Podebljan zadnji red koji nije rekapitulacija | CSS `tr:last-child` bold | Samo `tbody tr.sum-row td`; `markTotalRows` prepoznaje UKUPNO/REKAPITULACIJA/ZBIR/GRAND TOTAL. Za ručno označene redove dodati `class="sum-row"`. |
| Brisanje koda pri patchiranju `app.js` / `index.html` | Anchor string koji nije jedinstven (poklopio drugi dio fajla) | `count(anchor)==1` assert prije zamjene; mijenjati **cijele funkcije** po brace-matchingu; `node --check` nakon izmjene; testirati Playwrightom. |
| `pkill -f "http.server"` ubio shell (exit 144) | Pattern poklopio i sam shell | Server pokretati sa `nohup setsid`; ne koristiti `pkill -f` sa generičkim patternom. |
| Modal ispod app zaglavlja na mobitelu | z-index | Modal 20500. |
| KPI/grid preliv na uskim ekranima | grid min-content | `minmax(0,1fr)` + `min-width:0`. |
| Prazan select mjeseca u Izvještajima | Opcije se punile samo ako oba prazna | Puniti kad bilo koji nema opcija. |
| `let` globali nisu na `window` | classic scripts | Za `currentUser` je dodan getter; za ostale koristiti direktno ime, ne `window.x`. |
| XSS | Imena (otpremač, kupac, radilište, odjel) u `innerHTML` | `escapeHtml` za tekst, `jsAttr` za vrijednosti u `onclick` atributima. |
| Aktivno dugme podmenija se ne označi | `event.target` je span unutar dugmeta | Koristiti `event.currentTarget`. |

## 4. Što je provjereno i ispravno (ne dirati bez razloga)

- **Dashboard (server):** mjesečna sječa/otprema zbrajaju kolonu "UKUPNO Č+L" po godini i mjesecu; `stanje = sjeca − otprema`; odjeli po zadnjoj sječi.
- **Sječa — Mjesečni prikaz:** zbirovi po mjesecu i ukupno; prosjek po radnom danu = Σm³/Σdani; MAX DANA po mjesecu = najveći broj radnih dana među primačima.
- **Sječa/Otprema po danima:** dnevni UKUPNO = zbir redova dana, UKUPNO mjeseca = zbir svih dnevnih (provjereno mock podacima: 27 + 12 = 39).
- **Otprema, Radilišta, Po kupcima, Sortimenti po otpremačima/primačima:** zbirni redovi se računaju iz prikazanih redova; "po kupcima" sortira po ukupnoj količini opadajuće i isključuje `SVEUKUPNO` iz kolona.
- **Stanje zaliha:** status zalihe iz `UKUPNO Č+L` (negativna < 0, visoka > `SZ_VISOKA_ZALIHA`, normalna > 0).
- **Provjera sintakse `.gs`:** `node --check --input-type=commonjs < fajl.gs` radi i za Apps Script; **ne hvata dupla imena između fajlova** — za to koristiti `grep -ohE "^(const|let|var|function) +\w+" *.gs | sort | uniq -d`.

## 5. Pregled promjena po tabovima (redizajn, sve reverzibilno — jedan commit po tabu)

Dashboard (Šumarija Krupa), Stanje zaliha, Izvještaji, Kupci, Sječa/otprema (mjesečni), Primači na šuma panju (+ Timeline kao poseban podtab), Kubikator, **Otprema (v2.138)**, **Sječa (v2.139)**. Zajednički elementi: `.dash-head`, `.enterprise-card`, `.ot-*` (tabele sa sticky zaglavljem/prvom kolonom, istaknut tekući mjesec, heatmap, `sum-row`), `renderMjesecnaMatrica` (js/app.js), `sortimentColClass` (boje grupa četinari/lišćari), drag-scroll (`js/drag-scroll.js`, dodati novu klasu u `SCROLLABLE_SELECTOR`).
Korisnik ne voli KPI redove koji ne nose vrijednost ("ne treba mi") — ne dodavati ih bez jasne koristi.

## 6. Kako testirati (Playwright)

1. `cd /home/user/sumarija && nohup setsid python3 -m http.server 8767 >/dev/null 2>&1 &`
2. `NODE_PATH=$(npm root -g)`, `chromium.launch({executablePath:'/opt/pw-browsers/chromium'})`, kontekst `serviceWorkers:'block'`.
3. Mockati `https://script.google.com/**` (po `path` parametru: login, dashboard, primaci, otpremaci, otpremaci-daily, …) i `cdn.jsdelivr.net` (Chart.js stub).
4. Pozvati `switchTab('…')`; za podtabove kliknuti `.submenu-tab`. Screenshotovi tokom CSS tranzicije su pomaknuti — gledati computed style ili sačekati ~700 ms.
5. Mock greške `Service Worker registration failed`, `ERR_TUNNEL_CONNECTION_FAILED`, `L is not defined` (Leaflet) u sandboxu su očekivane i nisu bugovi.

## 7. Otvorene preporuke

- Lozinka kao GET parametar i u localStorage → token-bazirana prijava.
- Forma otpreme šalje `''` a sječe `0` za prazna polja (nedosljednost).
- `cloudflare-worker.js` ima treći, zaseban Apps Script URL.
- Normalizacija naziva odjela na serveru (trim + velika/mala slova).
- Svaka izmjena `.gs` = podsjetiti korisnika na "New version" i na to da u editoru nema starih kopija fajlova.
