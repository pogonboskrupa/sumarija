# Google Apps Script - Uputstvo za postavljanje

## 📋 Sadržaj
1. Kreiranje Apps Script projekta
2. Prilagođavanje koda
3. Deploy kao Web App
4. Testiranje

---

## 1. Kreiranje Apps Script projekta

### Korak 1: Otvori Google Sheets
- Otvori svoju Google Sheets tabelu sa podacima

### Korak 2: Kreiraj Apps Script
- Klikni na **Extensions** → **Apps Script**
- Obriši postojeći kod u Code.gs
- Kopiraj kod iz `apps-script-code.gs` fajla

---

## 2. Prilagođavanje koda

### ⚠️ VAŽNO: Moraš prilagoditi sledeće:

### A) Imena sheet-ova (linije 31, 48, 49)
```javascript
const usersSheet = ss.getSheetByName('KORISNICI'); // Tvoje ime sheet-a
const primkaSheet = ss.getSheetByName('PRIMKA');   // Tvoje ime sheet-a
const otpremaSheet = ss.getSheetByName('OTPREMA'); // Tvoje ime sheet-a
```

### B) Struktura KORISNICI sheet-a (linija 40)
Trenutna pretpostavka:
- Kolona A: username
- Kolona B: password
- Kolona C: ime
- Kolona D: prezime
- Kolona E: role (admin/user)
- Kolona F: tip (Šumar/Vozač/...)

**Ako imaš drukčiju strukturu, prilagodi:**
```javascript
// Primjer ako je password u koloni C:
if (data[i][0] === username && data[i][2] === password) {
```

### C) Struktura PRIMKA sheet-a (linije 76-78, 170-171)
Trenutna pretpostavka:
- Kolona A: Datum
- Kolona B: Odjel
- Kolona K (indeks 10): Kubik (m³)
- Kolona U (indeks 20): U11 - Projektovana masa
- Kolona V (indeks 21): U12 - Ukupno posjeklo

**Provjeri svoje kolone:**
```javascript
// Da vidiš indekse:
// A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12,
// N=13, O=14, P=15, Q=16, R=17, S=18, T=19, U=20, V=21
```

**Prilagodi indekse:**
```javascript
const datum = row[0];  // Ako je datum u koloni A
const odjel = row[1];  // Ako je odjel u koloni B
const kubik = parseFloat(row[10]) || 0; // Ako je kubik u koloni K
```

### D) Čitanje U11 i U12 podataka (funkcija `processOdjeliDetails`)

**OPCIJA 1: Ako svaki odjel ima summary red**
```javascript
// Pronađi red gdje je naziv odjela jednak trenutnom
for (let i = 1; i < data.length; i++) {
  if (data[i][1] === odjel) { // kolona B
    const projekat = parseFloat(data[i][20]) || 0; // kolona U
    const ukupnoPosjeklo = parseFloat(data[i][21]) || 0; // kolona V
  }
}
```

**OPCIJA 2: Ako su U11 i U12 na fiksnoj lokaciji**
```javascript
// Direktno čitanje iz ćelija
const projekat = primkaSheet.getRange('U11').getValue();
const ukupnoPosjeklo = primkaSheet.getRange('U12').getValue();
```

**OPCIJA 3: Ako imaš poseban sheet sa projektima po odjelima**
```javascript
const projekatSheet = ss.getSheetByName('PROJEKAT');
const projekatData = projekatSheet.getDataRange().getValues();

// Pretpostavka: kolona A = odjel, B = projekat, C = ostvareno
for (let i = 1; i < projekatData.length; i++) {
  const odjel = projekatData[i][0];
  if (stats.odjeliStats[odjel]) {
    stats.odjeliStats[odjel].projekat = parseFloat(projekatData[i][1]) || 0;
    stats.odjeliStats[odjel].ukupnoPosjeklo = parseFloat(projekatData[i][2]) || 0;
  }
}
```

---

## 3. Deploy kao Web App

### Korak 1: Deploy
1. U Apps Script editoru, klikni **Deploy** → **New deployment**
2. Klikni **Select type** → **Web app**
3. Podesi:
   - **Description**: "Šumarija API"
   - **Execute as**: Me
   - **Who has access**: Anyone (ili Anyone with Google account)
4. Klikni **Deploy**

### Korak 2: Autorizuj
- Klikni **Authorize access**
- Odaberi Google account
- Klikni **Advanced** → **Go to [Project name] (unsafe)**
- Klikni **Allow**

### Korak 3: Kopiraj URL
- Kopiraj **Web app URL** (izgleda kao):
```
https://script.google.com/macros/s/AKfycbw.../exec
```

### Korak 4: Updateuj index.html
- Otvori `index.html`
- Zamijeni API_URL sa novim:
```javascript
const API_URL = 'https://script.google.com/macros/s/TVOJ_NOVI_URL/exec';
```

---

## 4. Testiranje

### Test 1: Login
Otvori u browseru:
```
https://script.google.com/macros/s/TVOJ_URL/exec?path=login&username=test&password=test123
```

Očekivani odgovor:
```json
{
  "success": true,
  "username": "test",
  "fullName": "Ime Prezime",
  "role": "admin"
}
```

### Test 2: Stats
```
https://script.google.com/macros/s/TVOJ_URL/exec?path=stats&year=2024&username=test&password=test123
```

Očekivani odgovor:
```json
{
  "totalPrimka": 12345.67,
  "totalOtprema": 11000.00,
  "monthlyStats": [...],
  "odjeliStats": {
    "01a": {
      "sječa": 500,
      "otprema": 450,
      "zadnjaSjeca": 45.5,
      "datumZadnjeSjece": "15.12.2024",
      "projekat": 600,
      "ukupnoPosjeklo": 550
    }
  }
}
```

---

## 🐛 Debugging i Rješavanje Grešaka

### ❌ Greška: "Sorry, unable to open the file at this time"

**Uzrok:** Apps Script nije pravilno deploy-an ili nemaš pristupne dozvole.

**Rješenje:**
1. Idi u Google Sheets → Extensions → Apps Script
2. Klikni **Deploy** → **Manage deployments**
3. Klikni na **✏️ Edit** (pored trenutnog deployment-a)
4. Provjeri da je:
   - **Execute as**: Me (tvoj email)
   - **Who has access**: **Anyone** (VAŽNO!)
5. Klikni **Deploy**
6. Autorizuj aplikaciju ponovo:
   - Klikni **Authorize access**
   - Odaberi svoj Google account
   - Klikni **Advanced** → **Go to [Project] (unsafe)**
   - Klikni **Allow**
7. Kopiraj novi Web app URL

### ✅ Greška: `{"error":"Unknown path"}`

**Ovo je DOBAR znak!** Znači da je API pravilno deploy-an i radi!

**Šta znači:** API očekuje `path` parametar u URL-u.

**Testiranje:**
Umjesto da otvoriš samo:
```
https://script.google.com/macros/s/TVOJ_URL/exec
```

Dodaj parametar `path`:
```
https://script.google.com/macros/s/TVOJ_URL/exec?path=login&username=admin&password=admin123
```

### ❌ Greška: `{"error":"TypeError: Cannot read properties of null (reading 'getSheetByName')"}`

**Uzrok:** Apps Script ne može pronaći Google Sheets ili sheet ne postoji.

**Rješenje 1: Container-Bound Script (preporučeno)**
1. Otvori Google Sheets sa podacima
2. Idi Extensions → Apps Script
3. Kopiraj kod iz `apps-script-code.gs`
4. Deploy kao Web App
5. Ovako će Apps Script automatski biti povezan sa tim Sheets-om

**Rješenje 2: Standalone Script**
Ako koristiš standalone Apps Script, dodaj ID Google Sheets-a:
```javascript
function doGet(e) {
  const SPREADSHEET_ID = 'TVOJ_SPREADSHEET_ID'; // iz URL-a Sheets-a
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ... ostatak koda
}
```

### ❌ Greška: `{"error":"Unauthorized"}`

**Uzrok:** Pogrešan username/password ili korisnik ne postoji u KORISNICI sheet-u.

**Rješenje:**
1. Provjeri KORISNICI sheet u Google Sheets
2. Provjeri da postoji red sa tačnim username i password
3. Provjeri da su kolone u redu (A=username, B=password)

### Ako dobijaš ostale greške:

1. **Reference error** - provjeri imena sheet-ova
2. **Undefined values** - provjeri indekse kolona
3. **Authorization error** - ponovo deploy-uj i autorizuj
4. **Empty data** - provjeri da li su imena kolona u redu

### Korisni debugging kodovi:

```javascript
// Ispiši sve sheet-ove
Logger.log(SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName()));

// Ispiši prvi red podataka
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PRIMKA');
Logger.log(sheet.getRange(2, 1, 1, 30).getValues());

// Provjeri da li postoji određeni sheet
const exists = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PRIMKA') !== null;
Logger.log('PRIMKA exists: ' + exists);
```

Pokreni **View** → **Logs** da vidiš output.

### 🔍 Kako testirati API korak po korak:

**1. Test bez parametara (očekuje "Unknown path"):**
```
https://script.google.com/macros/s/TVOJ_URL/exec
```
Odgovor: `{"error":"Unknown path"}` ✅ API radi!

**2. Test login-a:**
```
https://script.google.com/macros/s/TVOJ_URL/exec?path=login&username=admin&password=admin123
```
Odgovor: `{"success":true,"username":"admin",...}` ✅ Login radi!

**3. Test stats-a:**
```
https://script.google.com/macros/s/TVOJ_URL/exec?path=stats&year=2024&username=admin&password=admin123
```
Odgovor: `{"totalPrimka":...,"totalOtprema":...}` ✅ Sve radi!

---

## 📝 Napomene

- Nakon svake izmjene koda, moraš napraviti **novi deployment**
- Možeš koristiti **Test deployments** tokom developmenta
- Za produkciju, koristi **New deployment** sa verzijom
- Apps Script ima limit od ~6 min execution time
- Maksimalno 20,000 poziva dnevno (besplatno)
