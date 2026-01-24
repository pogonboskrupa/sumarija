# 🔧 Fix za Dinamika Persistence Problem

## 📋 Problem
Kada spremite mjesečnu dinamiku, prikazuje se poruka "uspješno spremljeno", ali kada se vratite u DINAMIKA podmeni, podaci nisu sačuvani i ponovo se prikazuju nule.

## ✅ Rješenje Implementirano

Implementirao sam sljedeće popravke:

### 1. **Popravljen Cache Invalidation Bug** ⭐
**Problem:** `invalidateAllCache()` funkcija je koristila `cache.removeAll()` bez parametara, što ne radi pravilno u Google Apps Script.

**Rješenje:** Sada briše svaki cache key individualno:
```javascript
const keys = [
  `dashboard_${currentYear}`,
  `odjeli_${currentYear}`,
  `dinamika_${currentYear}`,
  'stats',
  'primka_manifest',
  'otprema_manifest'
];

keys.forEach(key => cache.remove(key));
```

**Fajlovi ažurirani:**
- ✅ `apps-script/services.gs` (linija 269-279)
- ✅ `apps-script-code.gs` (linija 589-599)

### 2. **Dodati Debug Logs** 🔍
**Frontend (`js/app.js`):**
- ✅ Loguje rezultat save operacije sa debug info
- ✅ Loguje podatke pri učitavanju dinamike
- ✅ Dodao timeout od 500ms prije reload-a da bi backend završio upis

**Backend (`apps-script/api-handlers.gs`):**
- ✅ `handleSaveDinamika()` - Verifikuje da su podaci sačuvani čitanjem iz sheet-a
- ✅ `handleGetDinamika()` - Vraća debug informacije o učitanim podacima
- ✅ Detaljnije logiranje cache operacija

### 3. **Race Condition Fix** ⏱️
Dodao sam `setTimeout(500ms)` prije reload-a dinamike nakon spremanja, da bi backend sigurno završio upis u Google Sheets prije nego što frontend ponovo učitava podatke.

---

## 🚀 Kako Deploy-ovati Promjene

### Opcija A: Deploy Modular Apps Script (PREPORUČENO)

1. **Otvori Google Apps Script Editor**
   - Otvori Google Sheets tabelu
   - Klikni **Extensions** → **Apps Script**

2. **Upload-uj Fajlove**

   Trebate kreirati/ažurirati sljedeće fajlove u Apps Script editoru:

   **a) `services.gs`**
   - Kopiraj sadržaj iz: `/home/user/sumarija/apps-script/services.gs`
   - Paste u Apps Script editor

   **b) `api-handlers.gs`**
   - Kopiraj sadržaj iz: `/home/user/sumarija/apps-script/api-handlers.gs`
   - Paste u Apps Script editor

   **c) `main.gs`**
   - Kopiraj sadržaj iz: `/home/user/sumarija/apps-script/main.gs`
   - Paste u Apps Script editor

   **d) Ostali potrebni fajlovi:**
   - `config.gs` - kopiraj iz `/home/user/sumarija/apps-script/config.gs`
   - `authentication.gs` - kopiraj iz `/home/user/sumarija/apps-script/authentication.gs`
   - `utils-triggers.gs` - kopiraj iz `/home/user/sumarija/apps-script/utils-triggers.gs`
   - `diagnostic.gs` - kopiraj iz `/home/user/sumarija/apps-script/diagnostic.gs`

3. **Deploy**
   - Klikni **Deploy** → **Manage deployments**
   - Klikni ⚙️ (Edit) pored aktivnog deployment-a
   - U sekciji **Version**, odaberi **New version**
   - Opis: "Fix dinamika persistence bug - improved cache invalidation"
   - Klikni **Deploy**

### Opcija B: Deploy Monolithic Apps Script

Ako koristite monolithic verziju:

1. **Otvori Google Apps Script Editor**
   - Otvori Google Sheets tabelu
   - Klikni **Extensions** → **Apps Script**

2. **Zamijeni Kod**
   - Kopiraj KOMPLETAN sadržaj iz: `/home/user/sumarija/apps-script-code.gs`
   - Paste u Apps Script editor (zamijeni sve)

3. **Deploy** (isti koraci kao Opcija A, korak 3)

---

## 🧪 Testiranje Nakon Deploy-a

1. **Osvježi Aplikaciju**
   - U browseru: **Ctrl+Shift+R** (force refresh)
   - Ili **Ctrl+F5**

2. **Otvori Developer Console**
   - **F12** ili **Ctrl+Shift+I**
   - Idi na **Console** tab

3. **Test 1: Spremanje Dinamike**
   - Idi na **DINAMIKA** podmeni
   - Unesi mjesečne vrijednosti (npr. Januar=100, Februar=150, itd.)
   - Klikni **Spremi dinamiku**
   - **Provjeri Console** - trebalo bi vidjeti:
     ```
     💾 Save success: { success: true, ... }
     🔍 Debug info: { godina: 2026, savedSuccessfully: true, ... }
     🔄 Reloading dinamika after save...
     📥 Loading dinamika for year: 2026
     📊 Dinamika data received: { dinamika: { "01": 100, ... } }
     ✅ Form loaded. Has data: true
     ```

4. **Test 2: Persistence**
   - Prebaci se na **Dashboard** tab
   - Vrati se nazad na **DINAMIKA** tab
   - **Provjeri da li se podaci prikazuju** (ne smiju biti nule!)
   - **Provjeri Console** - trebalo bi vidjeti debug logs

5. **Test 3: Dashboard Prikaz**
   - Idi na **Dashboard** (**Šumarija Krupa** tab)
   - Pogledaj **Mjesečni pregled** tabelu
   - **Provjeri kolonu DINAMIKA** - trebala bi prikazati vrijednosti koje ste unijeli
   - **Provjeri kartice na vrhu** - "Razlika sa Dinamikom" bi trebala prikazati tačnu razliku

---

## 📊 Kako Provjeriti Google Apps Script Logs

Ako i dalje ne radi, provjeri backend logs:

1. **Otvori Apps Script Editor**
   - Extensions → Apps Script

2. **Otvori Execution Log**
   - Klikni na **Execution log** ikonu (lista sa satom)
   - Ili idi na **View** → **Execution log**

3. **Potraži Logove**

   **Za Save operaciju:**
   ```
   === HANDLE SAVE DINAMIKA START ===
   Username: vaš_username
   Godina: 2026
   Parsing mjeseci from string...
   Decoded param: {"01":100,"02":150,...}
   Updated existing row for year 2026
   [CACHE] Removed cache key: dashboard_2026
   VERIFICATION: Data found in sheet after save
   === HANDLE SAVE DINAMIKA END ===
   Successfully saved dinamika
   ```

   **Za Load operaciju:**
   ```
   === HANDLE GET DINAMIKA START ===
   Year: 2026
   Found dinamika for year 2026
   Dinamika values: {"01":100,"02":150,...}
   === HANDLE GET DINAMIKA END ===
   Found data: true
   ```

4. **Ako Vidiš Greške:**
   - Screenshot greške
   - Kopiraj error message
   - Vrati se i javi mi problem

---

## 🔍 Troubleshooting

### Problem: I dalje prikazuje nule nakon spremanja

**Mogući uzroci:**

1. **Deployment nije završen**
   - Provjeri da li si kreirao **New version** deployment
   - Provjeri da li si kliknuo **Deploy** (ne samo Save)

2. **Browser cache**
   - Force refresh: **Ctrl+Shift+R**
   - Clear browser cache za site
   - Ili probaj u **Incognito mode**

3. **Pogrešan Spreadsheet ID**
   - Provjeri da `INDEX_SPREADSHEET_ID` u `config.gs` pokazuje na pravu tabelu
   - Otvori DINAMIKA sheet u Google Sheets i provjeri da li se podaci fizički spremaju

4. **Permission issue**
   - Provjeri da li korisnik ima **admin** tip (samo admin može spremati dinamiku)
   - Provjeri Apps Script logs za "Only admin can add dinamika" error

### Problem: Console prikazuje grešku

Pošalji mi screenshot ili tekst greške iz console-a.

### Problem: Debug info pokazuje `savedSuccessfully: false`

Ovo znači da backend ne može pročitati podatke odmah nakon upisa. Mogući razlozi:
- Race condition (poboljšano sa timeout-om ali možda treba duže)
- Spreadsheet permission problem
- Backend upisuje u drugu tabelu

**Rješenje:** Provjeri Apps Script logs i javi mi šta piše.

---

## 📝 Dodatne Informacije

### Kako Podaci Teku Kroz Sistem:

1. **Frontend → Backend (Save)**
   ```
   User Form Input
     → saveDinamika() @ js/app.js:8915
     → POST: save_dinamika?godina=2026&mjeseci={"01":100,...}
     → handleSaveDinamika() @ apps-script/api-handlers.gs:2829
     → Write to DINAMIKA sheet
     → invalidateAllCache()
     → Return success + debug info
   ```

2. **Backend → Frontend (Load Form)**
   ```
   loadDinamika() @ js/app.js:8869
     → GET: get_dinamika?year=2026
     → handleGetDinamika() @ apps-script/api-handlers.gs:2762
     → Read from DINAMIKA sheet
     → Return { dinamika: {"01": 100, ...}, debug: {...} }
     → Populate form inputs
   ```

3. **Backend → Frontend (Dashboard)**
   ```
   loadDashboard() @ js/app.js:1835
     → GET: dashboard?year=2026
     → handleDashboard() @ apps-script/api-handlers.gs:15
     → getDinamikaForYear(2026) @ apps-script/services.gs:9
     → Read from DINAMIKA sheet
     → Calculate mjesecnaStatistika
     → Return data with dinamika values
     → Display in "Mjesečni pregled" table
   ```

### DINAMIKA Sheet Struktura:

```
| GODINA | JAN | FEB | MAR | APR | MAJ | JUN | JUL | AVG | SEP | OKT | NOV | DEC | UKUPNO |
|--------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|--------|
| 2026   | 100 | 150 | 120 | 130 | 140 | 160 | 180 | 170 | 140 | 150 | 130 | 110 | 1680   |
```

---

## ✅ Checklist Prije Kontaktiranja za Pomoć

Prije nego što se vratiš za pomoć, provjeri:

- [ ] Deploy-ovao sam novi kod u Google Apps Script
- [ ] Kreirao sam **New version** deployment (ne samo Save)
- [ ] Force refresh-ovao sam browser (Ctrl+Shift+R)
- [ ] Provjerio sam Console logs (F12)
- [ ] Provjerio sam Apps Script Execution logs
- [ ] Provjerio sam da korisnik ima admin tip
- [ ] Provjerio sam da DINAMIKA sheet postoji u Google Sheets
- [ ] Testirao sam spremanje i učitavanje nekoliko puta

Ako si sve ovo uradio i i dalje ne radi, kontaktiraj me sa:
1. Screenshot Console logs
2. Screenshot Apps Script logs
3. Screenshot DINAMIKA sheet-a iz Google Sheets
4. Opis problema

---

## 🎯 Šta se Promijenilo

**Prije:**
```javascript
// Loše - ne radi u Google Apps Script
function invalidateAllCache() {
  cache.removeAll(); // ❌ bez parametara ne radi
}
```

**Poslije:**
```javascript
// Dobro - briše svaki key individualno
function invalidateAllCache() {
  const keys = ['dashboard_2026', 'odjeli_2026', 'dinamika_2026', ...];
  keys.forEach(key => cache.remove(key)); // ✅ radi!
}
```

---

Sretno! 🚀
