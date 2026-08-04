# Prompt app — kompletan prompt za izradu aplikacije za drugu šumariju

> **Kako se koristi:** popuni **DIO 1** (podaci tvoje šumarije), pa cijeli
> ovaj fajl kopiraj kao prompt u Claude Code (ili drugi AI alat) u praznom
> folderu/repozitoriju.
>
> **Prije nego počneš — pročitaj ovo:** postojeća aplikacija ima **41.300+
> linija koda** (40 tabova, 6 uloga, Apps Script backend, offline PWA, mape,
> grafikoni). Nijedan AI to ne može regenerisati identično iz jednog prompta.
> Zato prompt nudi **dva puta** — u DIJELU 2 izaberi jedan:
>
> - **PUT A (preporučeno)** — kopirati postojeći repozitorij i zamijeniti
>   hardkodirane podatke. Traje sat-dva, dobiješ provjeren kod 1:1.
> - **PUT B** — graditi iz nule po specifikaciji ispod. Traje danima, dobiješ
>   sličnu ali ne identičnu aplikaciju. Ima smisla samo ako svjesno želiš
>   drugačiju aplikaciju.

---

# DIO 1 — PODACI MOJE ŠUMARIJE (popuniti prije korištenja)

```
NAZIV ŠUMARIJE / POGONA:      ______________________________
   (npr. "Pogon gospodarenja Bos. Krupa")
KRATKI NAZIV (za PWA ikonu):  ______________________________
   (npr. "Šumarija Bos. Krupa")
GRAD/SJEDIŠTE:                ______________________________

KOORDINATE KANCELARIJE:       [ ____.______ , ____.______ ]
   (lat, lng — npr. [44.883425, 16.154427])

GOSPODARSKE JEDINICE (GJ):
   1. ______________________  boja: #________
   2. ______________________  boja: #________
   3. ______________________  boja: #________
   (dodaj po potrebi)

GODINA PLANA:                 ________  (npr. 2026)

GOOGLE PODACI (popuniti nakon što se naprave — vidi DIO 3):
   BAZA_PODATAKA_ID:          ______________________________
   KORISNICI_SPREADSHEET_ID:  ______________________________
   ODJELI_FOLDER_ID:          ______________________________
   IMAGES_FOLDER_ID:          ______________________________
   APPS SCRIPT WEB APP URL:   ______________________________
   ADMIN_USERNAME:            ______________________________
   ADMIN_PASSWORD:            ______________________________  (jaka lozinka!)

DOMENA (ako se koristi):      ______________________________

GODIŠNJI PLAN SJEČE — tabela po odjelu:
   | GJ | odjel | bruto | neto | trupci Č | cijep. Č | trupci L | cijep. L |
   |----|-------|-------|------|----------|----------|----------|----------|
   |    |       |       |      |          |          |          |          |
   (priložiti kao Excel/CSV ili prepisati ovdje)

GEOJSON GRANICA ODJELA:       fajl: ______________________________
   (svaki poligon mora imati properties: gj, odjel, opciono name, odsjek)

SPISAK KORISNIKA:
   | username | lozinka | ime i prezime | tip |
   |----------|---------|---------------|-----|
   |          |         |               |     |
   (tip = primac | otpremac | poslovodja | operativa | operateri | admin)
```

---

# DIO 2 — PROMPT (odavde kopirati AI-u)

## Zadatak

Napravi PWA aplikaciju za praćenje drvne mase (sječa i otprema) za šumariju
navedenu u DIJELU 1. Aplikacija je već napravljena za jednu šumariju i treba
mi ista takva za drugu.

**Izaberi put:**

### PUT A — kopiranje postojeće aplikacije (PREPORUČENO)

Ako imaš pristup postojećem repozitoriju (`pogonboskrupa/sumarija` ili kopiji):

1. Kopiraj cijeli repozitorij.
2. Pročitaj `docs/TEMPLATE-ZA-DRUGE-SUMARIJE.md` — to je kompletno uputstvo za
   ovaj postupak, sa checklistom od 28 koraka.
3. Zamijeni **samo** hardkodirane podatke navedene u DIJELU 3 ovog prompta.
4. **Ne diraj ništa drugo** — logika izračuna, strukture podataka i UI su
   provjereni u radu i ne treba ih mijenjati.

Ovo je jedini put koji garantuje identičnu aplikaciju. Ako je moguće — koristi
njega i preskoči ostatak prompta osim DIJELA 3.

### PUT B — izrada iz nule

Ako repozitorij nije dostupan, izgradi aplikaciju po specifikaciji ispod.
Radi **inkrementalno, tab po tab**, i nakon svake cjeline provjeri da radi.
Ne pokušavaj sve odjednom.

---

## Specifikacija aplikacije

### Arhitektura

Tri odvojena dijela:

1. **Baza podataka** — Google Sheets tabele na Google nalogu šumarije.
2. **Backend** — Google Apps Script Web App (`doGet` sa `?path=` routingom),
   deployan kao "Execute as: Me, Access: Anyone". Nema sesija ni tokena —
   username i lozinka se šalju kao query parametri u **svakom** zahtjevu.
3. **Frontend** — statična PWA (vanilla HTML/CSS/JS, **bez build koraka i bez
   framework-a**), hostovana na GitHub Pages. Sve se učitava `<script defer>`
   tagovima.

**Bez npm-a, bez bundlera, bez TypeScript-a.** Jedine vanjske biblioteke
(preko CDN-a): Leaflet (mape), Chart.js 4.4 (grafikoni, lazy preko
`window.loadChartJs()`), SheetJS/xlsx (Excel export).

### Podaci — struktura Google Sheets

**Tabela 1: BAZA_PODATAKA**

Glavne tabele koje aplikacija čita:

- `INDEKS_PRIMKA` (A–Z, 26 kolona): A=DATUM (`dd.mm.yyyy`), B=RADNIK,
  C=ODJEL, D=RADILIŠTE, E=IZVOĐAČ, F=POSLOVOĐA, G–Z = 20 sortimenata
  (Z = UKUPNO Č+L)
- `INDEKS_OTPREMA` (A–AA, 27 kolona): A=DATUM, B=OTPREMAČ, **C=KUPAC**,
  D=ODJEL, E=RADILIŠTE, F=IZVOĐAČ, G=POSLOVOĐA, H–AA = 20 sortimenata
- `PRIMAČ_UNOS` / `OTPREMAČ_UNOS` — unosi sa terena koji čekaju odobrenje
  (kolone kao gore + STATUS, TIMESTAMP, IMAGE_URL)
- `INFO` — kolona I = POSLOVOĐA, kolona J = RADILIŠTE (mapiranje)
- `STANJE_ZALIHA` — blokovi po 6 redova po odjelu
  (ODJEL / RADILIŠTE / IZVOĐAČ / POSLOVOĐA / ZADNJA OTPREMA, sa
  OPIS / PROJEKAT / SJEČA / OTPREMA / ZALIHA po sortimentima D:W)
- `DINAMIKA` — GODINA, JAN…DEC, UKUPNO (godišnji plan po mjesecima)
- `STANJE_ODJELA_CACHE`, `TEMP_IMAGES`, `PREKLASIRANJE`,
  `ŠIHTARICA_*` — aplikacija ih kreira sama

**20 sortimenata, ovim redoslijedom (fiksno):**

```
F/L Č, I Č, II Č, III Č, RD, TRUPCI Č, CEL.DUGA, CEL.CIJEPANA, ŠKART,
Σ ČETINARI, F/L L, I L, II L, III L, TRUPCI L, OGR.DUGI, OGR.CIJEPANI,
GULE, LIŠĆARI, UKUPNO Č+L
```

Indeks 9 (`Σ ČETINARI`) i 18 (`LIŠĆARI`) su zbirne kolone; 19 je ukupno.

**Tabela 2: KORISNICI** (odvojena tabela!), jedan sheet `Korisnici`:

| A | B | C | D |
|---|---|---|---|
| `username` | `password` | `ime_prezime` | `tip` |

Red 1 je zaglavlje. Lozinke su običan tekst (poznato ograničenje).
`ime_prezime` se mora **tačno** poklapati sa kolonom B u `INDEKS_PRIMKA` —
po tome radnik vidi svoje unose.

**Izvor podataka:** jedan Google Sheets fajl **po odjelu** u zasebnom Drive
folderu (naziv fajla = naziv odjela), sa sheetovima `PRIMKA` (metapodaci u
W2=RADILIŠTE, W3=IZVOĐAČ, W4=POSLOVOĐA; redovi: B=DATUM, C=PRIMAČ, D–W =
sortimenti) i `OTPREMA` (A=KUPAC, B=DATUM, C=OTPREMAČ, D–W). Funkcija
`INDEKS_DODAJ_NOVE()` inkrementalno prepisuje te fajlove u `INDEKS_*` tabele.

### Uloge korisnika i tabovi

Uloga je vrijednost kolone `tip`. **Nepoznata vrijednost mora prikazati grešku
i odjaviti korisnika — NIKAD tiho dati admin pristup** (to je bio ozbiljan
sigurnosni bug).

| `tip` | Tabovi (prvi je početni) |
|---|---|
| `primac` | Pregled sječe, Izvještaji, Karta, Godišnji prikaz, Prikaz po odjelima, Šihtarica, Kubikator, Dodaj sječu, Moje sječe |
| `otpremac` | isto, ali za otpremu (Dodaj otpremu, Moje otpreme) |
| `poslovodja` (i `poslovođa`) | SJEČA, OTPREMA, Stanje zaliha, Karta, Izvještaji, PREGLED, Izvještaj po odjelima, Dodani unosi |
| `operativa` | Dashboard, Kupci, Mjesečni pregled, Izvještaji |
| `operateri` | Prikaz po kupcima, Sječa po danima, Otprema po danima |
| `admin` | Dashboard, Kupci, Stanje zaliha, Sječa/otprema, SJEČA, OTPREMA, Izvještaji, Primači na šuma panju, Godišnji plan, Mapa, Dodani unosi, Kubikator |

Uloga `operateri` se prepoznaje tolerantno (jednina/množina, i ako je greškom
upisana u kolonu C umjesto D). Sve poređenja uloga rade
`String(x).trim().toLowerCase()` — **bez `trim()` nastaje bug** gdje razmak u
tabeli ruši prepoznavanje.

### Funkcionalnosti po tabovima

**Zajedničko (svi):** prijava, offline rad, PWA instalacija, automatska
provjera nove verzije, toast obavještenja, print izvještaji, Excel export.

**Radnik (primač/otpremač):**
- *Pregled sječe/otpreme* — sve svoje unose za godinu, tabela + grafikoni
- *Izvještaji* — sedmični i mjesečni, po odjelima
- *Karta* — puni ekran, Leaflet, GPS lokacija, snimanje tragova i tačaka,
  izvoz GPX-a, offline tile keš, prikaz odjela sa statusima
- *Godišnji prikaz* / *Prikaz po odjelima*
- *Šihtarica* — puni ekran; mjesečna evidencija radnih dana, dani sa
  evidentiranom sječom se označavaju automatski, ručni unos ostalih vrsta
  (terenski rad, godišnji, bolovanje, praznik, slobodan dan), rekap mjeseca,
  praćenje iskorištenog godišnjeg odmora
- *Kubikator* — puni ekran, terenski kalkulator zapremine (detalji ispod)
- *Dodaj sječu/otpremu* — unos sa terena, ide u `PRIMAČ_UNOS` kao PENDING
- *Moje sječe/otpreme* — pregled i izmjena vlastitih unosa

**Admin:**
- *Dashboard* — pregled cijele godine, grafikoni
- *Kupci* — mjesečni (sa izborom mjeseca), kvartalni, godišnji, statistika po
  kupcu i po sortimentu (dropdown + grafikon)
- *Stanje zaliha* — agregatno i po odjelima
- *Sječa/otprema* — mjesečna tabela sa toplotnom mapom po vrijednosti
- *SJEČA* — podtabovi: po danima, **Mjesečni prikaz po radnicima** (sa
  analizom radnika: po mjesecu / po godini / po odjelu + grafikoni),
  Radilišta, **Izvođači** (dropdown + detaljan pregled + timeline
  realizacije), Sortimenti po primačima
- *OTPREMA* — analogno
- *Izvještaji* — sedmični/mjesečni, po odjelima i po radnicima
- *Primači na šuma panju* — dropdown radnika + godine, detaljan pregled
- *Godišnji plan* — podtabovi: po grupama, po sortimentima, pregled plana,
  plan po projektu, **Timeline realizacije**; filteri: GJ, status, izvođač,
  pretraga
- *Mapa* — Leaflet mapa svih odjela, bojenje po statusu, filteri, detalji u
  modalu, rute, offline preuzimanje
- *Dodani unosi* — odobravanje/odbijanje unosa sa terena

**Poslovođa** — vidi samo svoja radilišta (mapiranje iz `INFO` sheeta).

### Ključna poslovna pravila (OBAVEZNO tačno)

**Kubikator — zapremina:**
- Oblovina (Huberova formula): `V = (π/4) × (d/100)² × L`
  gdje je d prečnik u cm (7–150), L dužina u m (1–10)
- Prostorno drvo: `V = širina × visina × 0,63`
  (0,63 = koeficijent pretvorbe 0,7 umanjen za 10%)
- Rezultat na 2 decimale, računa se dok se kuca
- Podaci se čuvaju samo lokalno (localStorage), bez servera

**Status odjela (iz procenta realizacije plana):**
```
pct = sječa_ukupno / plan_neto × 100
pct >= 95  → "posjeceno"   (zeleno)
pct  >  5  → "u-sjeci"     (crveno)
inače      → "planirano"   (sivo/žuto)
```

**Povezivanje odjela — KRITIČNO (izvor ozbiljnog buga):**
Odjeli imaju pododsjeke sa `/N` sufiksom (npr. `68/1`, `68/2`). Potrebna su
**dva nivoa preciznosti**:
1. **precizno** (`labelKey`) — ČUVA `/N`; koristi se kad zapis navodi tačan
   pododsjek
2. **rezerva** (`normKey`) — briše `/N`; koristi se **SAMO** za zapise koji
   nemaju `/N` u nazivu (agregatni unos)

Ako se svuda koristi samo `normKey`, sječa iz `68/1` se lažno prelije i na
`68/2` — odjel koji nije ni počeo da se siječe prikaže se kao "u sječi".
Ovo pravilo vrijedi za sječu, otpremu i statuse.

Obje funkcije normalizuju: velika slova, bez dijakritike (Č→C, Š→S, Ž→Z,
Đ→DJ), bez završnog `P`.

**Početak i kraj sječe po odjelu:**
- početak = najraniji datum evidentirane sječe
- kraj = najkasniji datum, **ali preskačući dane kad je jedini upisani
  sortiment bio `OGR.CIJEPANI` i/ili `CEL.CIJEPANA`** — to ogrijevno/celulozno
  drvo se često dovršava i poslije stvarnog kraja sječe, pa takav dan nije
  pravi nastavak. Dan sa bilo kojim drugim sortimentom se normalno računa.

**Timeline realizacije:** jedan red po odjelu; ako je pauza između uzastopnih
dana sječe **duža od 30 dana**, odjel se prikazuje sa **više odvojenih traka
na istom redu** (ne u više redova).

### Ključne arhitektonske odluke (ne mijenjati bez razloga)

1. **Viewport je fiksiran na `width=1280`** za sve korisnike i sve uređaje
   (`setAppViewport()`). Posljedice:
   - `@media (min-width: …)` **ne razlikuje telefon od desktopa** — za to se
     koristi `window.screen.width` i klasa `body.is-desktop-screen`
   - bilo koji element širi od 1280px natjera browser da smanji cijelu
     stranicu (izgleda kao "aplikacija zauzima pola ekrana")
2. **Punoekranski tabovi** (Karta, Kubikator, Šihtarica) — obrazac:
   klasa na `<body>` + `position:fixed; inset:0; z-index:10500` +
   `contain:none !important` (jer `.container` ima `contain: layout style`),
   privremena zamjena viewporta na `device-width`, dugme "✕ Zatvori".
   Enter/exit hook-ovi se zovu iz `switchTab()` **prije** grane koja može rano
   izaći na svjež keš; **svi "exit" hookovi idu prije svih "enter" hookova**.
3. **Modali moraju imati `z-index` iznad punoekranskih tabova** (20000) —
   inače se potvrda otvori nevidljiva iza mape/kalkulatora.
4. **Offline-first:** `fetchWithCache()` sa localStorage + IndexedDB (za
   velike/binarne podatke), stale-fallback kad mreža padne, Service Worker sa
   različitim strategijama (GeoJSON i tile pločice cache-first, JS/CSS
   stale-while-revalidate, navigacija network-first).
5. **Excel export se gradi iz izvornih podataka, ne iz DOM-a** — inače se
   formatiranje prikaza (razdjelnik hiljada, `–` za nulu) prenese u Excel i
   brojevi postanu tekst.
6. **Ne koristiti `alert()`** — postoji toast sistem
   (`showSuccess/showError/showInfo/showWarning`, potpis: naslov pa poruka).
7. **Escapovati slobodan tekst** prije upisa u `innerHTML` (`escapeHtml`).

### Konvencija verzioniranja (obavezno)

Pri **svakoj** izmjeni povećati **tri** vrijednosti, inače korisnici ostaju na
staroj verziji iz keša:
- `VERSION` (korijen repozitorija)
- `APP_VERSION` u `js/app.js`
- `CACHE_VERSION` u `service-worker.js`

### Stil i jezik

- Cijeli UI je na **bosanskom jeziku** (Sječa, Otprema, Odjel, Izvođač,
  Poslovođa, Primač, Otpremač, Šihtarica, Kubikator…).
- Komentari u kodu na bosanskom, objašnjavaju **zašto**, ne šta.
- Brojevi: `de-DE` format (tačka za hiljade, zarez za decimale), 2 decimale,
  nula se prikazuje kao `–`.
- Datumi: `dd.mm.yyyy`.
- Aplikacija se koristi **na terenu, na telefonu, često u rukavicama** —
  polja i dugmad moraju biti velika, unos brz, sve mora raditi offline.

---

# DIO 3 — ŠTA SE MIJENJA ZA NOVU ŠUMARIJU

Ovo je popis svih hardkodiranih podataka. **Za PUT A ovo je jedini posao.**

## Backend — `apps-script/config.gs`

```js
const KORISNICI_SPREADSHEET_ID = '<novi ID>';
const BAZA_PODATAKA_ID         = '<novi ID>';
const ODJELI_FOLDER_ID         = '<novi ID>';
const IMAGES_FOLDER_ID         = '<novi ID>';
const ADMIN_USERNAME           = '<promijeniti>';
const ADMIN_PASSWORD           = '<jaka lozinka — NE "admin">';
```

Sve ostalo u `config.gs` ostaje isto.

## Frontend

| # | Šta | Gdje | Napomena |
|---|---|---|---|
| 1 | `API_URL` | `js/app.js` (~132) | URL Apps Script Web App-a. **Jedino mjesto.** |
| 2 | `SUMARIJA_LATLNG` | `js/karta-odjela.js` (~15) **i** `js/mapa-radnika.js` (~24) | **Dvije kopije — obje!** |
| 3 | `PLAN_ENTRIES` | `js/godisnji-plan.js` (~9) | polja: `gj, odjel, bruto, neto, cTrupci, dzgo, lTrupci, cijepano` |
| 4 | `_planEntries()` | `js/karta-odjela.js` (~1442) | **Isti podaci, druga imena:** `dzgo`→`cijepanoC`, `cijepano`→`cijepanoL` |
| 5 | `_plan2027Entries()` | `js/karta-odjela.js` (~1475) | samo `{gj, odjel}` za narednu godinu |
| 6 | `GJ_LIST`, `GJ_COLOR`, `GJ_BG` | `js/godisnji-plan.js` (~39–41) | nazivi GJ **moraju se poklapati sa `gj` u GeoJSON-u** |
| 7 | `PLAN_YEAR` | `js/godisnji-plan.js` (~46) **i** `js/karta-odjela.js` (~98) | dvije kopije |
| 8 | `POSLOVODJA_RADILISTA_FALLBACK` | `js/app.js` | rezerva ako `INFO` sheet ne odgovori |
| 9 | `POSLOVODJA_RADILISTA_KARTA` | `js/mapa-radnika.js` (~61) | druga kopija istog |
| 10 | `data/odjeli.geojson` | | properties: `gj`, `odjel` (+ opciono `name`, `odsjek`) |
| 11 | `GEOJSON_VERSION` | `js/karta-odjela.js` (~7) | **povećati** nakon zamjene GeoJSON-a |
| 12 | Naziv šumarije | `index.html`, `js/auth.js` (naziv taba), `manifest.webmanifest`, `offline.html` | |
| 13 | Ikone i logo | `icon-192.png`, `icon-512.png`, `icon-*-maskable.png`, `favicon.*`, logo u zaglavlju | |
| 14 | `CNAME` | korijen | nova domena, ili obrisati fajl |
| 15 | `.well-known/assetlinks.json` | | samo ako se pravi Android TWA |

> **Upozorenje na duplikate:** stavke 2, 4, 7 i 9 postoje na **po dva mjesta**
> koja se moraju ručno održavati usklađenim. Ako se razlikuju, mapa i Godišnji
> plan pokazuju različite brojeve.

## Format koji se mora poklapati

Ključ za povezivanje sječe sa poligonom na mapi je normalizovan
`gj + " " + odjel`. Zato:
- kolona **ODJEL** u `INDEKS_PRIMKA` mora biti u formatu `"GJ odjel"`
  (npr. `"RISOVAC KRUPA 64"`)
- `gj` u GeoJSON-u mora biti tačno onaj naziv koji je u `GJ_LIST`

## Redoslijed rada

1. Napraviti Google nalog šumarije (+ 2FA)
2. Napraviti obje Sheets tabele i oba Drive foldera → zapisati 4 ID-a
3. Popuniti `Korisnici`, `INFO`, `STANJE_ZALIHA`, `DINAMIKA`
4. Dodati fajlove odjela u folder
5. Apps Script: kopirati `.gs` fajlove, upisati ID-e, deploy → zapisati URL
6. Pokrenuti `setupStanjeOdjelaDailyTrigger()` i `setupDeleteOldImagesTrigger()`
7. Pokrenuti `INDEKS_DODAJ_NOVE()`
8. Frontend: proći kroz tabelu iznad (15 stavki)
9. GitHub Pages + domena
10. Testirati sa po jednim korisnikom svake uloge

Detaljan checklist od 28 koraka: `docs/TEMPLATE-ZA-DRUGE-SUMARIJE.md`.

---

# DIO 4 — SIGURNOST (pročitati prije puštanja u rad)

1. **Lozinke su običan tekst** u tabeli i šalju se u svakom zahtjevu. Pristup
   tabeli `Korisnici` = pristup svim nalozima. Ograničiti dijeljenje.
2. **`ADMIN_PASSWORD` je u originalu `admin`** — obavezno promijeniti.
3. **Web App je javno dostupan** — jedina zaštita je username/lozinka.
4. **Kolona `tip` mora biti tačna** — provjeriti da nema suvišnih razmaka.
5. Ne stavljati stvarne lozinke u dokumentaciju ni commit poruke.

> Ako gradiš iz nule (PUT B) i imaš mogućnost — razmisli o hashiranju lozinki
> i tokenima umjesto slanja kredencijala u svakom zahtjevu. Postojeća
> aplikacija to nema iz istorijskih razloga.
