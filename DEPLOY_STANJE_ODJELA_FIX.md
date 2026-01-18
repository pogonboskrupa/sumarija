# 🔧 STANJE ODJELA - Deployment Instrukcije

## Problem
Stranica se zaglavi na "Učitavam početni prikaz..." kada pokušaš pristupiti "Stanje odjela" tabu.

## Uzrok
Lokalni `apps-script-code.gs` fajl je ažuriran (commit a3767c6), ali promjene **NISU deploy-ovane** na Google Apps Script web app. Deployed verzija još uvijek koristi stari kod.

## ✅ RJEŠENJE: Deploy Nove Verzije

### Korak 1: Otvori Google Apps Script Editor

1. Otvori svoj Google Sheets: **SUMARIJA_INDEX**
   - Spreadsheet ID: `1nPkSx2fCbtHGcwdq8rDo9A3dsSt9QpcF7f0JBCg1K1I`

2. Klikni **Extensions** → **Apps Script**

### Korak 2: Update Kod

1. U Apps Script editoru, otvori **Code.gs** fajl

2. **OBRIŠI** sav postojeći kod

3. **KOPIRAJ** cijeli kod iz `/home/user/sumarija/apps-script-code.gs`
   - VAŽNO: Kopiraj SVE (3860 linija koda)

4. **ZALIJEPI** u Code.gs

5. **SAČUVAJ** (Ctrl+S ili File → Save)

### Korak 3: Kreiraj Novi Deployment

1. Klikni **Deploy** → **New deployment**

2. Klikni ⚙️ (zupčanik) → **Web app**

3. Podesi:
   ```
   Description: "STANJE ODJELA FIX - Novo čitanje OTPREMA redova"
   Execute as: Me (tvoj-email@gmail.com)
   Who has access: Anyone
   ```

4. Klikni **Deploy**

5. Ako traži autorizaciju:
   - Klikni **Authorize access**
   - Odaberi svoj Google account
   - Klikni **Advanced** → **Go to [Project] (unsafe)**
   - Klikni **Allow**

6. **KOPIRAJ** novi Web app URL:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

### Korak 4: Test API Endpoint

Testiraj novi URL u browseru:
```
https://script.google.com/macros/s/TVOJ_NOVI_URL/exec?path=stanje-odjela&username=ADMIN_USERNAME&password=ADMIN_PASSWORD
```

**Očekivani odgovor:**
```json
{
  "data": [
    {
      "odjel": "...",
      "radiliste": "...",
      "projekat": 123.45,
      "sjeca": 67.89,
      ...
    }
  ],
  "sortimentiNazivi": ["F/L Č", "I Č", ...]
}
```

**Ako dobiješ grešku:** Provjeri Apps Script Execution log:
- U Apps Script editoru: **Executions** (lijeva strana)
- Klikni na najnoviju execution
- Vidi error message

### Korak 5: Prvo Pokretanje Sync Funkcije

**VAŽNO:** Prvi put moraš ručno pokrenuti `syncStanjeOdjela()` da kreira cache sheet!

1. U Apps Script editoru, otvori **Code.gs**

2. Pronađi funkciju `syncStanjeOdjela()` (linija 3447)

3. Izaberi funkciju iz dropdown menija (gornji lijevi dio ekrana)

4. Klikni **Run** (▶️ dugme)

5. Prati execution log:
   - Klikni **Executions** (lijeva strana)
   - Čekaj da execution završi (može trajati 1-2 minute)
   - Provjeri da nema error-a

6. **Provjeri rezultat:**
   - Otvori Google Sheets: `1nPkSx2fCbtHGcwdq8rDo9A3dsSt9QpcF7f0JBCg1K1I`
   - Provjeri da li postoji novi sheet: **STANJE_ODJELA_CACHE**
   - Sheet treba da ima:
     - Red 1: Metadata (timestamp)
     - Red 2: Header (Red Tip, Odjel Naziv, Radilište, Izvođač, Zadnji Datum)
     - Red 3+: Podaci (4 reda po odjelu: PROJEKAT, SJEČA, OTPREMA, ZALIHA)

### Korak 6: Setup Automatsko Ažuriranje (Opciono)

Da bi cache automatski ažurirao svaki dan u 2:00 AM:

1. U Apps Script editoru, izaberi funkciju: `setupStanjeOdjelaDailyTrigger()`

2. Klikni **Run** (▶️ dugme)

3. Provjeri trigger:
   - Klikni **Triggers** (⏰ ikona, lijeva strana)
   - Treba da vidiš novi trigger:
     ```
     Function: syncStanjeOdjela
     Event source: Time-driven
     Type: Day timer
     Time: 2am to 3am
     ```

## 🧪 Testiranje Nakon Deployment-a

### Test 1: API direktno

```
https://script.google.com/macros/s/TVOJ_URL/exec?path=stanje-odjela&username=ADMIN&password=PASS
```

Očekivano: JSON sa odjelima

### Test 2: Web App

1. Otvori stranicu: https://pogonboskrupa.github.io/sumarija/

2. Prijavi se kao **ADMINISTRATOR**

3. Klikni na tab: **📦 Stanje odjela**

4. Stranica treba da učita podatke (može trajati 5-10 sekundi pri prvom učitavanju)

5. Tabela treba da prikaže:
   - Kolone: Odjel, Radilište, Izvođač, Projekat, Sječa, Otprema, Realizacija, Zadnji Unos
   - Redove sa podacima o odjelima

### Test 3: Ručno Ažuriranje Cache-a

1. U web app-u, kao admin, klikni **"Osvježi Cache"** dugme

2. Čekaj da se prikaže poruka: "✅ Stanje odjela osvježeno"

3. Tabela treba da se automatski reloaduje sa najnovijim podacima

## ❌ Ako Još Uvijek Ne Radi

### Problem 1: "Nema podataka o odjelima"

**Uzrok:** STANJE_ODJELA_CACHE sheet je prazan ili ne postoji

**Rješenje:**
1. Otvori Apps Script editor
2. Run funkciju: `syncStanjeOdjela()`
3. Provjeri Execution log za error-e
4. Provjeri da ODJELI folder ID u kodu (linija 8) je tačan:
   ```javascript
   const ODJELI_FOLDER_ID = '1NQ0s_F4j9iRDaZafexzP5Bwyv0NXfMMK';
   ```

### Problem 2: "Server je spor"

**Uzrok:** API poziv timeout nakon 300 sekundi

**Rješenje:**
1. Provjeri da li `syncStanjeOdjela()` uspješno izvršava (Executions log)
2. Provjeri da li postoje OTPREMA sheets u ODJELI folderu
3. Provjeri internet konekciju

### Problem 3: "Greška pri učitavanju stanja odjela: ..."

**Uzrok:** Backend error ili cache sheet corrupted

**Rješenje:**
1. Otvori Google Sheets: `1nPkSx2fCbtHGcwdq8rDo9A3dsSt9QpcF7f0JBCg1K1I`
2. **OBRIŠI** sheet: STANJE_ODJELA_CACHE (desni klik → Delete)
3. U Apps Script editoru, run: `syncStanjeOdjela()`
4. Refresh web app

## 📝 Šta je Promijenjeno u Commit a3767c6?

### Stara verzija (NEISPRAVNA):
- Čitala samo kolone D-U (18 kolona)
- Parsovala svaku ćeliju kao float
- Header je imao fiksna imena sortimenta

### Nova verzija (ISPRAVNA):
- Čita cijele redove 10-13 od kolone A do kraja
- Čuva cijeli red bez parsovanja
- Header ima samo metadata kolone
- Ekstraktuje sortimente iz dataRow kada je potrebno

### Ključna Izmjena:

**Prije:**
```javascript
const dataRange = otpremaSheet.getRange(10, 4, 4, 18); // Samo D-U
const projekat = dataValues[0].map(v => parseFloat(v) || 0);
```

**Poslije:**
```javascript
const lastColumn = otpremaSheet.getLastColumn();
const dataRange = otpremaSheet.getRange(10, 1, 4, lastColumn); // Cijeli red
const projekat = dataValues[0]; // Cijeli red bez parsovanja
```

Ova izmjena omogućava:
- ✅ Pravilno čitanje svih kolona iz OTPREMA sheeta
- ✅ Očuvanje originalne strukture podataka
- ✅ Fleksibilnost za različite dužine redova
- ✅ Tačno ekstraktovanje sortimenta u handleStanjeOdjela()

## ✅ Checklist

- [ ] Apps Script kod ažuriran sa apps-script-code.gs
- [ ] Novi deployment kreiran
- [ ] Novi URL testiran (stanje-odjela endpoint radi)
- [ ] syncStanjeOdjela() funkcija pokrenuta ručno
- [ ] STANJE_ODJELA_CACHE sheet postoji i ima podatke
- [ ] Trigger za automatsko ažuriranje setup-ovan
- [ ] Web app testiran - tab "Stanje odjela" prikazuje podatke
- [ ] Ručno osvježavanje cache-a radi

---

**Status:** 📋 SPREMNO ZA DEPLOYMENT

**估計 Vrijeme:** 10-15 minuta

**Zadnji Commit:** a3767c6 - 🔧 FIX: STANJE ODJELA - Doslovno prekopiranje opsega iz OTPREMA sheeta
