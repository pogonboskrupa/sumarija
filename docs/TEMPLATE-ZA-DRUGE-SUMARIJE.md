# Template — kako napraviti ovu aplikaciju za drugu šumariju

Ovaj dokument je kompletno uputstvo za postavljanje iste aplikacije za bilo koju
drugu šumariju / pogon gospodarenja. Sadrži sve što treba pripremiti (Google
nalog, tabele, folderi), kako se strukturiraju podaci, kako se zavode korisnici
sa šiframa i ulogama, i šta se sve mijenja u kodu.

> **Procjena vremena:** 3–5 sati za tehnički dio (uz spremne podatke),
> plus vrijeme za prikupljanje/prepis podataka šumarije (plan sječe, odjeli,
> GeoJSON granice).

---

## 1. Arhitektura — tri dijela

Aplikacija se sastoji od tri odvojena dijela. Za novu šumariju treba **sva tri**
napraviti iznova (kod se kopira, podaci su novi):

| Dio | Šta je | Gdje živi |
|---|---|---|
| **1. Baza podataka** | Google Sheets tabele — svi stvarni podaci | Google Drive šumarije |
| **2. Backend (API)** | Google Apps Script — čita/piše u tabele, provjerava lozinke | Apps Script projekat vezan za Google nalog |
| **3. Frontend (PWA)** | HTML/JS aplikacija koju korisnici otvaraju u telefonu | GitHub Pages (ili drugi hosting) |

Ključna stvar: **backend i baza su vezani za Google nalog šumarije**, a frontend
je javno dostupan web sajt koji samo poziva taj backend.

---

## 2. Google nalog šumarije

**Prvo se otvara jedan Google nalog koji je vlasnik svega.**

- Preporuka: poseban službeni nalog šumarije (npr.
  `sumarija.<naziv>@gmail.com` ili nalog na domeni preduzeća), **ne privatni
  nalog zaposlenika** — jer se vlasništvo nad podacima i aplikacijom veže za
  taj nalog.
- Sve tabele, Drive folderi i Apps Script projekat moraju biti na **tom istom
  nalogu** (ili barem dijeljeni s njim uz pravo uređivanja).
- Apps Script se deployuje sa opcijom **"Execute as: Me"** — što znači da svi
  zahtjevi aplikacije idu preko dozvola tog naloga. Zato taj nalog mora imati
  pristup svim tabelama i folderima.
- Uključiti 2FA na taj nalog. Ako se izgubi pristup nalogu — gubi se i backend
  i podaci.

---

## 3. Baza podataka — glavni Sheets fajl

Napraviti **novu Google Sheets tabelu**, npr. naziva `BAZA_PODATAKA`. Njen ID
se kasnije upisuje u kod kao `BAZA_PODATAKA_ID`.

> ID tabele je dio URL-a:
> `https://docs.google.com/spreadsheets/d/`**`<OVDJE_JE_ID>`**`/edit`

### 3.1 Sheetovi koji se kreiraju SAMI

Ove aplikacija kreira automatski pri prvom korištenju — **ne treba ih praviti
ručno**, samo znati da postoje:

| Sheet | Šta sadrži |
|---|---|
| `INDEKS_PRIMKA` | Objedinjena evidencija SVE sječe (glavna radna tabela) |
| `INDEKS_OTPREMA` | Objedinjena evidencija SVE otpreme |
| `PRIMAČ_UNOS` | Unosi sječe sa terena koji čekaju odobrenje (STATUS = PENDING) |
| `OTPREMAČ_UNOS` | Unosi otpreme sa terena koji čekaju odobrenje |
| `STANJE_ODJELA_CACHE` | Keš stanja zaliha po odjelu (osvježava se noću) |
| `TEMP_IMAGES` | Evidencija privremeno uploadovanih slika |
| `PREKLASIRANJE` | Zapisi preklasiranja sortimenata |
| `ŠIHTARICA_PRIMAC` / `ŠIHTARICA_OTPREMAC` | Mjesečna evidencija radnih dana |
| `ŠIHTARICA_GODISNJI_DANI` | Ugovoreni dani godišnjeg odmora po radniku |

### 3.2 Sheetovi koji se MORAJU napraviti ručno

| Sheet | Struktura | Napomena |
|---|---|---|
| `INFO` | kolona **I** = POSLOVOĐA, kolona **J** = RADILIŠTE | Mapiranje koji poslovođa pokriva koje radilište. Bez ovoga poslovođe vide prazno. |
| `STANJE_ZALIHA` | blokovi po 6 redova (vidi ispod) | Projekat/sječa/otprema/zaliha po odjelu |
| `DINAMIKA` | GODINA, JAN, FEB … DEC, UKUPNO | Godišnji plan po mjesecima (jedan red = jedna godina) |

**Struktura `STANJE_ZALIHA` — blok od 6 redova po odjelu:**

```
Red 1:  A="ODJEL"           B=<naziv odjela>   C="OPIS"      D:W = nazivi 20 sortimenata
Red 2:  A="RADILIŠTE"       B=<radilište>      C="PROJEKAT"  D:W = količine
Red 3:  A="IZVOĐAČ"         B=<izvođač>        C="SJEČA"     D:W = količine
Red 4:  A="POSLOVOĐA"       B=<poslovođa>      C="OTPREMA"   D:W = količine
Red 5:  A="ZADNJA OTPREMA"  B=<datum>          C="ZALIHA"    D:W = količine
Red 6:  (prazan — razdvaja blokove)
```

### 3.3 Struktura kolona (fiksna — ne mijenjati)

**`INDEKS_PRIMKA` (A–Z, 26 kolona):**

| Kolona | Sadržaj |
|---|---|
| A | DATUM (format `dd.mm.yyyy`) |
| B | RADNIK (primač — ime i prezime) |
| C | ODJEL |
| D | RADILIŠTE |
| E | IZVOĐAČ |
| F | POSLOVOĐA |
| G–Z | 20 sortimenata (Z = UKUPNO Č+L) |

**`INDEKS_OTPREMA` (A–AA, 27 kolona):** isto, ali sa dodatnom kolonom KUPAC:
A=DATUM, B=OTPREMAČ, **C=KUPAC**, D=ODJEL, E=RADILIŠTE, F=IZVOĐAČ,
G=POSLOVOĐA, H–AA = 20 sortimenata (AA = UKUPNO Č+L).

**20 sortimenata (istim redoslijedom, obavezno):**

```
F/L Č, I Č, II Č, III Č, RD, TRUPCI Č, CEL.DUGA, CEL.CIJEPANA, ŠKART,
Σ ČETINARI, F/L L, I L, II L, III L, TRUPCI L, OGR.DUGI, OGR.CIJEPANI,
GULE, LIŠĆARI, UKUPNO Č+L
```

> Ovo je standardna BiH klasifikacija — vjerovatno je ista i u drugoj šumariji.
> Ako nije, mijenja se `SORTIMENTI_NAZIVI` u `apps-script/config.gs`, ali onda
> treba proći i kroz frontend (`js/utils.js` → `SORTIMENTI_ORDER`,
> `sortimentColClass`) jer se sortimenti spominju na više mjesta.

---

## 4. Korisnici — poseban Sheets fajl sa šiframa

**Ovo je odvojena tabela od baze podataka** (namjerno — da se pristup šiframa
može dijeliti odvojeno od pristupa podacima).

Napraviti novu Google Sheets tabelu, npr. `SUMARIJA_KORISNICI`, sa **jednim
sheetom koji se OBAVEZNO zove `Korisnici`**. Njen ID ide u kod kao
`KORISNICI_SPREADSHEET_ID`.

### 4.1 Struktura tabele `Korisnici`

| | A | B | C | D |
|---|---|---|---|---|
| **Red 1** | `username` | `password` | `ime_prezime` | `tip` |
| Red 2 | `salkic.a` | `Tajna123` | `Salkić Adnan` | `primac` |
| Red 3 | `hadzic.m` | `Sifra456` | `Hadžić Mirsad` | `otpremac` |
| Red 4 | `poslovodja1` | `Sifra789` | `Porić Elvis` | `poslovodja` |
| … | … | … | … | … |

- **Red 1 je zaglavlje** i preskače se — podaci počinju od reda 2.
- **Kolona A (`username`)** — korisničko ime za prijavu. Bez razmaka.
- **Kolona B (`password`)** — lozinka. **Čuva se kao običan tekst** (vidi
  sigurnosnu napomenu u poglavlju 9).
- **Kolona C (`ime_prezime`)** — puno ime, prikazuje se u zaglavlju aplikacije
  i koristi se za povezivanje sa unosima u `INDEKS_PRIMKA` kolona B. **Mora se
  poklapati tačno** sa načinom kako je ime upisano u evidenciji sječe, inače
  radnik neće vidjeti svoje podatke.
- **Kolona D (`tip`)** — uloga korisnika, određuje koje tabove vidi.

### 4.2 Vrste korisnika (kolona `tip`)

Aplikacija prepoznaje **tačno ove vrijednosti** (mala slova, bez dijakritike):

| `tip` | Ko je to | Šta vidi |
|---|---|---|
| `primac` | Radnik koji prima/evidentira sječu | Pregled sječe, Izvještaji, Karta, Godišnji prikaz, Po odjelima, Šihtarica, Kubikator, Dodaj sječu, Moje sječe |
| `otpremac` | Radnik koji evidentira otpremu | Pregled otpreme, Izvještaji, Karta, Godišnji prikaz, Po odjelima, Šihtarica, Kubikator, Dodaj otpremu, Moje otpreme |
| `poslovodja` | Poslovođa (nadzor nad svojim radilištima) | SJEČA, OTPREMA, Stanje zaliha, Karta, Izvještaji, PREGLED, Izvještaj po odjelima, Dodani unosi |
| `operativa` | Operativa / analitika | Dashboard, Kupci, Mjesečni pregled, Izvještaji |
| `operateri` | Ograničen pregled | Prikaz po kupcima, Sječa po danima, Otprema po danima |
| `admin` | Administrator (puni pristup) | Sve — Dashboard, Kupci, Stanje zaliha, Sječa/otprema, SJEČA, OTPREMA, Izvještaji, Primači na šuma panju, Godišnji plan, Mapa, Dodani unosi, Kubikator |

**Važne napomene o ulogama:**

- Prihvata se i `poslovođa` (sa đ) — kod normalizuje oba oblika.
- Uloga `operateri` se prepoznaje i ako je greškom upisana u kolonu C
  (`ime_prezime`) umjesto D, i u jednini (`operater`) — namjerno tolerantno.
- **Ako `tip` nije nijedna od prepoznatih vrijednosti** (npr. tipfeler, prazno
  polje, ili razmak), korisnik dobije poruku "Nepoznata uloga korisnika" i
  bude odjavljen. Ovo je namjerno — ranije je takav korisnik tiho dobijao
  **pun admin pristup**, što je bio ozbiljan sigurnosni propust.
- Zbog toga: **pri unosu novih korisnika provjeriti da u koloni D nema
  suvišnih razmaka** i da je vrijednost tačno napisana.

### 4.3 Više korisnika iste vrste

Nema ograničenja — koliko god redova treba:

- Više primača: svaki svoj red sa `tip = primac`. Svaki vidi **samo svoje**
  unose (filtrira se po `ime_prezime` iz kolone C).
- Više otpremača: isto, `tip = otpremac`.
- Više poslovođa: svaki `tip = poslovodja`; **koja radilišta pokriva određuje
  se u `INFO` sheetu** glavne baze (kolona I = poslovođa, kolona J =
  radilište), a ne u tabeli korisnika. Jedan poslovođa može imati više
  radilišta — jedan red u `INFO` po kombinaciji.
- Više administratora: više redova sa `tip = admin`.

### 4.4 Administratorski nalog — dva mjesta

Ovo je specifičnost koju treba znati:

1. U `apps-script/config.gs` postoje `ADMIN_USERNAME` i `ADMIN_PASSWORD`
   (trenutno `admin`/`admin` — **obavezno promijeniti**). Ovaj par radi za dio
   funkcija.
2. **Ali dio API poziva ide preko funkcije koja gleda samo tabelu** — zato
   treba **i red u `Korisnici` tabeli** sa `tip = admin`.

**Preporuka: napraviti oba** — postaviti jaku lozinku u `config.gs` i dodati
odgovarajući red u tabelu `Korisnici` sa istim username/password.

---

## 5. Drive folderi

Napraviti **dva foldera** na Google Drive-u istog naloga:

| Folder | Namjena | Konstanta u kodu |
|---|---|---|
| Folder odjela | Jedan Google Sheets fajl **po odjelu** — ovo je izvor podataka | `ODJELI_FOLDER_ID` |
| Folder slika | Privremeni upload slika sa terena (briše se automatski nakon 5 dana) | `IMAGES_FOLDER_ID` |

> ID foldera je dio URL-a:
> `https://drive.google.com/drive/folders/`**`<OVDJE_JE_ID>`**

### 5.1 Kako izgleda fajl jednog odjela

**Naziv fajla = naziv odjela** (npr. `RISOVAC KRUPA 64`). Svaki fajl ima dva
sheeta:

**Sheet `PRIMKA`:**
- Ćelije **W2 = RADILIŠTE**, **W3 = IZVOĐAČ**, **W4 = POSLOVOĐA** (metapodaci
  odjela)
- Redovi podataka: **B = DATUM, C = PRIMAČ, D–W = 20 sortimenata**

**Sheet `OTPREMA`:**
- Redovi: **A = KUPAC, B = DATUM, C = OTPREMAČ, D–W = 20 sortimenata**

### 5.2 Tok podataka (bitno razumjeti)

```
Radnik unosi sječu u aplikaciji
        ↓
   PRIMAČ_UNOS (STATUS = PENDING)  ← čeka odobrenje u tabu "Dodani unosi"
        ↓
   Rukovodilac odobrava
        ↓
   Kancelarija prepisuje u fajl odjela (folder odjela, sheet PRIMKA)
        ↓
   Pokretanje sinhronizacije (?path=sync-index)
        ↓
   INDEKS_PRIMKA  ← iz ovoga aplikacija čita SVE prikaze
```

> **Važno:** ne postoji automatski put od odobrenog unosa do `INDEKS_PRIMKA` —
> kancelarija prepisuje odobrene unose u fajl odjela, pa se pokreće
> indeksiranje. Ovo je namjerno (kontrola prije nego podatak uđe u evidenciju).

---

## 6. Backend — Apps Script

### 6.1 Postavljanje projekta

1. Otvoriti [script.google.com](https://script.google.com) na nalogu šumarije →
   **New project**.
2. Kopirati **sve** `.gs` fajlove iz foldera `apps-script/` u projekat:
   - `main.gs`, `api-handlers.gs`, `authentication.gs`, `config.gs`,
     `services.gs`, `utils-triggers.gs`
   - `diagnostic.gs` je opcion
   > Ako neki nedostaje, aplikacija javlja grešku pri pokretanju — postoji
   > ugrađena provjera.
3. U `appsscript.json` provjeriti: `timeZone: "Europe/Sarajevo"`, runtime V8.

### 6.2 Izmjene u `config.gs`

Ovo je **jedini fajl koji se mijenja** za novu šumariju:

```js
const KORISNICI_SPREADSHEET_ID = '<ID tabele SUMARIJA_KORISNICI>';
const BAZA_PODATAKA_ID         = '<ID tabele BAZA_PODATAKA>';
const ODJELI_FOLDER_ID         = '<ID foldera sa fajlovima odjela>';
const IMAGES_FOLDER_ID         = '<ID foldera za slike>';

const ADMIN_USERNAME = '<promijeniti>';
const ADMIN_PASSWORD = '<jaka lozinka — NE ostavljati "admin">';
```

Ostalo (`CACHE_TTL`, `PRIMKA_COL`, `OTPREMA_COL`, `SORTIMENTI_NAZIVI`) ostaje
nepromijenjeno osim ako se struktura kolona stvarno razlikuje.

### 6.3 Deploy

**Deploy → New deployment → Web app**, sa postavkama:

| Postavka | Vrijednost |
|---|---|
| Execute as | **Me** (nalog šumarije) |
| Who has access | **Anyone** |

Rezultat je URL oblika:
`https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec` — **sačuvati ga**,
ide u frontend.

> **Svaka izmjena koda zahtijeva novi deployment** (Deploy → Manage deployments
> → uredi → New version). Sama izmjena koda u editoru **ne mijenja** ono što
> aplikacija vidi.

### 6.4 Trigeri (pokrenuti jednom)

U Apps Script editoru pokrenuti ove funkcije **jednom ručno** (Run) — one same
kreiraju vremenske trigere:

| Funkcija | Šta pravi |
|---|---|
| `setupStanjeOdjelaDailyTrigger()` | Dnevno u 02:00 osvježava keš stanja odjela |
| `setupDeleteOldImagesTrigger()` | Dnevno u 03:00 briše slike starije od 5 dana |

Pri prvom pokretanju Google traži odobrenje dozvola (Sheets, Drive, external
requests) — odobriti.

### 6.5 Prvo punjenje indeksa

Nakon što su fajlovi odjela u folderu, pokrenuti indeksiranje:
- otvaranjem `<WEB_APP_URL>?path=sync-index&username=<admin>&password=<lozinka>`
  u browseru, ili
- pokretanjem funkcije `INDEKS_DODAJ_NOVE()` direktno u editoru.

Ovo se ponavlja svaki put kad se dodaju novi podaci u fajlove odjela.

---

## 7. Frontend — aplikacija

### 7.1 Obavezne izmjene

**Gotovo sve je u jednom fajlu: `js/config-sumarija.js`.**

| Šta | Gdje | Napomena |
|---|---|---|
| **Sve specifično za šumariju** | **`js/config-sumarija.js`** | Naziv, koordinate, API URL, GJ + boje, godina plana, godišnji plan, plan naredne godine, poslovođa→radilište, verzija GeoJSON-a. **Jedan fajl.** |
| **GeoJSON granica odjela** | `data/odjeli.geojson` | Vidi 7.3 |
| **Naziv šumarije u tekstu** | `index.html`, `manifest.webmanifest`, `offline.html` | Zamijeniti "Bosanska Krupa" / "Pogon gospodarenja Bos. Krupa" |
| **Logo i ikone** | `icon-192.png`, `icon-512.png`, `icon-*-maskable.png`, `favicon.*`, logo u zaglavlju | |

> Ranije su ovi podaci bili razbacani po šest fajlova, a četiri vrijednosti su
> postojale u **po dvije kopije** (koordinate, godišnji plan, `PLAN_YEAR`,
> poslovođa→radilište) — što je bila stalna opasnost da kopije odu u nesklad
> pa Mapa i Godišnji plan pokažu različite brojeve. Sad su spojene.

### 7.2 Šta se popunjava u `js/config-sumarija.js`

Fajl je podijeljen u šest označenih dijelova:

1. **Osnovni podaci** — `NAZIV_PUNI`, `NAZIV_KRATKI`, `LOKACIJA` (`[lat, lng]`
   kancelarije — centar mape, marker, početna tačka rute)
2. **Backend** — `API_URL` (URL Apps Script Web App-a iz koraka 6.3)
3. **Gospodarske jedinice** — `GJ_LIST`, `GJ_COLOR`, `GJ_BG`
4. **Godina i verzija podloge** — `PLAN_YEAR`, `GEOJSON_VERSION`
5. **Godišnji plan** — `PLAN_ENTRIES` i `PLAN_ENTRIES_NAREDNA`
6. **Poslovođa → radilište** — dvije rezervne liste (namjerno različite, vidi
   komentar u fajlu)

**Struktura jednog unosa godišnjeg plana:**

```js
{ gj: 'Naziv GJ', odjel: '13', bruto: 3244, neto: 2768,
  cTrupci: 3,      // trupci četinara
  dzgo: 2,         // celuloza/cijepano četinari
  lTrupci: 875,    // trupci lišćara
  cijepano: 1888 } // ogrijev/cijepano lišćari
```

> Mapa interno koristi druga imena za dva polja (`dzgo`→`cijepanoC`,
> `cijepano`→`cijepanoL`). **To preslikavanje radi sam config
> automatski** (`PLAN_ENTRIES_MAPA`) — plan se upisuje samo jednom i kopije
> više ne mogu otići u nesklad.

### 7.3 GeoJSON — granice odjela

Fajl `data/odjeli.geojson` (trenutno ~4 MB, 1151 poligon). Svaki feature mora
imati u `properties`:

| Property | Obavezno | Primjer | Napomena |
|---|---|---|---|
| `gj` | **da** | `"Risovac Krupa"` | Mora se **tačno** poklapati sa nazivima u `GJ_LIST` |
| `odjel` | **da** | `"73"`, `"54P"`, `"59/1"` | Broj odjela; `/N` označava pododsjek |
| `name` | ne | | Rezerva ako `odjel` nedostaje |
| `odsjek` | ne | `"b"` | Samo za prikaz |

Geometrija: `MultiPolygon`, koordinate WGS84 (lon, lat).

**Ključno za povezivanje:** ključ za spajanje je normalizovan `gj + " " + odjel`
(velika slova, bez dijakritike, bez završnog `P`). **Kolona ODJEL u
`INDEKS_PRIMKA` mora koristiti isti format `"GJ odjel"`** (npr.
`"RISOVAC KRUPA 64"`), inače se sječa neće povezati sa poligonom na mapi.

Nakon zamjene GeoJSON-a — **povećati `GEOJSON_VERSION`** u
`js/karta-odjela.js` (~linija 7) da se obriše stari keš kod korisnika.

> Napomena: `data/POLIGONI_RIS_GRM_VOJ.geojson` (12 MB) se **ne koristi** u
> kodu — može se obrisati iz nove kopije.

### 7.4 Hosting

Trenutno: **GitHub Pages** iz korijena repozitorija, sa vlastitom domenom
(fajl `CNAME`, prisutan i `.nojekyll`). Za novu šumariju:

1. Novi GitHub repozitorij sa kopijom koda.
2. Settings → Pages → Deploy from branch (`main`, root).
3. `CNAME` — upisati novu domenu, ili **obrisati fajl** da radi na
   `<korisnik>.github.io/<repo>`.
4. DNS zapisi kod registrara domene (ako se koristi vlastita domena).
5. `.well-known/assetlinks.json` — samo ako se pravi Android TWA aplikacija;
   treba nov `package name` i SHA-256 otisak.

Alternative su dokumentovane u `docs/APPS-SCRIPT-HOSTING.md` (hosting direktno
iz Apps Script-a) i `docs/CLOUDFLARE-SETUP.md`.

### 7.5 Verzioniranje (obavezno pri svakoj izmjeni)

Aplikacija sama javlja korisnicima da postoji nova verzija. Za to se pri
**svakoj** izmjeni koda povećavaju **tri** vrijednosti:

| Fajl | Šta |
|---|---|
| `VERSION` (korijen) | npr. `2.110` → `2.111` |
| `js/app.js` | `const APP_VERSION = '2.111';` (~linija 5) |
| `service-worker.js` | `const CACHE_VERSION = 'v168';` → `'v169'` (~linija 3) |

Ako se ne povećaju, korisnici ostaju na staroj verziji iz keša.

---

## 8. Redoslijed postavljanja — checklist

```
PRIPREMA
[ ] 1. Otvoren Google nalog šumarije (+ 2FA)
[ ] 2. Prikupljeni podaci: spisak odjela, godišnji plan, GJ, radilišta,
       poslovođe, spisak zaposlenih, GeoJSON granice

GOOGLE DRIVE / SHEETS
[ ] 3. Napravljena tabela BAZA_PODATAKA           → zapisati ID
[ ] 4. Napravljena tabela SUMARIJA_KORISNICI      → zapisati ID
       [ ] sheet se zove tačno "Korisnici"
       [ ] zaglavlje: username | password | ime_prezime | tip
       [ ] upisani svi korisnici sa ispravnim "tip"
       [ ] dodan red za admina
[ ] 5. Napravljen folder odjela                   → zapisati ID
       [ ] jedan Sheets fajl po odjelu (naziv fajla = naziv odjela)
       [ ] u svakom: sheet PRIMKA (W2/W3/W4 metapodaci) + sheet OTPREMA
[ ] 6. Napravljen folder slika                    → zapisati ID
[ ] 7. U BAZA_PODATAKA ručno kreirani: INFO, STANJE_ZALIHA, DINAMIKA

BACKEND
[ ] 8. Novi Apps Script projekat, kopirani svi .gs fajlovi
[ ] 9. U config.gs upisana 4 ID-a + promijenjena admin lozinka
[ ] 10. Deploy kao Web app (Execute as: Me, Access: Anyone) → zapisati URL
[ ] 11. Pokrenuti setupStanjeOdjelaDailyTrigger() i setupDeleteOldImagesTrigger()
[ ] 12. Pokrenuti INDEKS_DODAJ_NOVE() — puni INDEKS_PRIMKA/INDEKS_OTPREMA
[ ] 13. Test: otvoriti <URL>?path=login&username=<admin>&password=<lozinka>

FRONTEND
[ ] 14. Kopija koda u novi repozitorij
[ ] 15. js/config-sumarija.js — popuniti SVIH 6 dijelova:
        [ ] naziv šumarije (puni i kratki)
        [ ] LOKACIJA (koordinate kancelarije)
        [ ] API_URL (Web App URL iz koraka 10)
        [ ] GJ_LIST / GJ_COLOR / GJ_BG
        [ ] PLAN_YEAR + GEOJSON_VERSION
        [ ] PLAN_ENTRIES + PLAN_ENTRIES_NAREDNA
        [ ] POSLOVODJA_RADILISTA (obje liste)
[ ] 16. data/odjeli.geojson zamijenjen (+ GEOJSON_VERSION povećan u configu)
[ ] 17. Naziv šumarije u index.html, manifest.webmanifest, offline.html
[ ] 18. Zamijenjene ikone i logo
[ ] 19. GitHub Pages uključen, CNAME podešen/obrisan

PROVJERA
[ ] 20. Prijava kao admin — vide li se svi tabovi
[ ] 21. Prijava kao primač — vidi li SVOJE unose
[ ] 22. Prijava kao poslovođa — vidi li svoja radilišta (INFO sheet)
[ ] 23. Mapa — poklapaju li se poligoni sa podacima o sječi
[ ] 24. Godišnji plan — slažu li se brojevi sa planom
[ ] 25. Test na telefonu + instalacija kao PWA
```

---

## 9. Sigurnosne napomene (pročitati prije puštanja u rad)

1. **Lozinke se čuvaju kao običan tekst** u tabeli `Korisnici` i šalju se kao
   parametri u svakom zahtjevu. Nema hashiranja ni sesija/tokena.
   → Posljedica: pristup tabeli `Korisnici` = pristup svim nalozima.
   Ograničiti dijeljenje te tabele na minimum ljudi.
2. **`ADMIN_PASSWORD` u `config.gs` je trenutno `admin`** — obavezno
   promijeniti prije puštanja u rad.
3. **Web App je javno dostupan** (`Anyone`) — jedina zaštita je
   username/password. Koristiti jake lozinke, posebno za admin.
4. **Kolona `tip` mora biti tačna.** Nepoznata vrijednost sad ispravno
   odjavljuje korisnika, ali provjeriti da nema suvišnih razmaka pri unosu.
5. Ne stavljati stvarne lozinke u dokumentaciju, commit poruke ni screenshot-e.

---

## 10. Česte greške i rješenja

| Simptom | Uzrok | Rješenje |
|---|---|---|
| Korisnik se prijavi ali vidi poruku "Nepoznata uloga" | `tip` u koloni D pogrešno napisan / ima razmak | Ispraviti na tačnu vrijednost iz tabele 4.2 |
| Radnik ne vidi svoje unose | `ime_prezime` (kolona C) se ne poklapa sa kolonom B u `INDEKS_PRIMKA` | Uskladiti tačno, znak po znak |
| Poslovođa vidi prazno | Nedostaje red u `INFO` sheetu | Dodati poslovođa (kol. I) + radilište (kol. J) |
| Mapa prazna / poligoni bez podataka | `gj`+`odjel` u GeoJSON-u se ne poklapaju sa kolonom ODJEL | Uskladiti format `"GJ odjel"` |
| Novi podaci se ne vide | Nije pokrenut `sync-index` | Pokrenuti indeksiranje |
| Izmjena koda backend-a nema efekta | Nije napravljen novi deployment | Deploy → Manage deployments → New version |
| Korisnici i dalje vide staru verziju | Nisu povećane sve tri verzije | Vidi 7.5 |
| Mapa/tabovi izgledaju "smanjeno" | Aplikacija fiksira viewport na 1280px | Vidi `docs/VIEWPORT-PROBLEM-I-RJESENJE.md` |

---

## 11. Šta ostaje isto (ne dirati)

- Struktura kolona `PRIMKA_COL` / `OTPREMA_COL`
- 20 sortimenata i njihov redoslijed (osim ako se stvarno razlikuju)
- Sva logika izračuna (Huberova formula u Kubikatoru, koeficijent 0,63 za
  prostorno drvo, statusi odjela, računanje zaliha)
- Struktura sheetova koje aplikacija sama kreira
- Cijeli `js/` i `css/` osim nabrojanog u poglavlju 7.1

---

## 12. Korisna postojeća dokumentacija

| Dokument | Sadržaj |
|---|---|
| `docs/APPS_SCRIPT_UPUTSTVO.md` | Detaljno uputstvo za Apps Script |
| `docs/DEPLOY-INSTRUKCIJE.md` | Postupak deploya |
| `docs/CLASP-DEPLOYMENT.md` | Deploy preko `clasp` CLI alata |
| `docs/APPS-SCRIPT-HOSTING.md` | Hosting frontenda iz Apps Script-a |
| `docs/CLOUDFLARE-SETUP.md` | Cloudflare varijanta |
| `docs/VIEWPORT-PROBLEM-I-RJESENJE.md` | Zašto je viewport fiksiran na 1280px |
| `docs/ZAGLAVLJE-DESKTOP-ANDROID-PRIKAZ.md` | Istorija prikaza zaglavlja |
