# 🚀 Brzi Start - Šumarija Aplikacija

## Za testiranje odmah (bez deploy-a)

### 1. Otvori Demo verziju
- Otvori fajl: **`index-demo.html`**
- Prijavi se sa: `admin` / `admin123`

**To je sve!** Demo verzija radi sa mock podacima.

---

## Za produkciju (sa pravim podacima)

### Pregled koraka
1. ✅ Setup Google Sheets
2. ✅ Deploy Apps Script
3. ✅ Testiraj API
4. ✅ Updateuj index.html
5. ✅ Deploy aplikaciju

---

## Korak 1: Setup Google Sheets

Tvoj Google Sheets treba imati:
- **KORISNICI** sheet (kolone: username, password, ime, prezime, role, tip)
- **PRIMKA** sheet (kolone: datum, odjel, ... kubik u koloni K)
- **OTPREMA** sheet (slična struktura kao PRIMKA)

---

## Korak 2: Deploy Apps Script

### A) Otvori Apps Script
1. Otvori tvoj Google Sheets
2. Extensions → Apps Script

### B) Kopiraj kod
1. Obriši postojeći kod
2. Kopiraj sve iz fajla `apps-script-code.gs`
3. Paste u Code.gs

### C) Prilagodi imena sheet-ova
Pronađi i promijeni ako treba:
```javascript
const usersSheet = ss.getSheetByName('KORISNICI');   // Tvoje ime
const primkaSheet = ss.getSheetByName('PRIMKA');     // Tvoje ime
const otpremaSheet = ss.getSheetByName('OTPREMA');   // Tvoje ime
```

### D) Deploy
1. Deploy → New deployment
2. Select type → Web app
3. Execute as: **Me**
4. Who has access: **Anyone** ⚠️ VAŽNO!
5. Deploy

### E) Autorizuj
1. Authorize access
2. Odaberi svoj Google account
3. Advanced → Go to [Project] (unsafe)
4. Allow

### F) Kopiraj URL
Dobit ćeš URL poput:
```
https://script.google.com/macros/s/AKfycbw.../exec
```

---

## Korak 3: Testiraj API

### Test 1: Basic (očekuje "Unknown path")
Otvori u browseru:
```
https://script.google.com/macros/s/TVOJ_URL/exec
```

✅ Dobar odgovor: `{"error":"Unknown path"}`

❌ Loš odgovor: "Sorry, unable to open the file"
- **Rješenje:** Idi na Deploy → Manage deployments → Edit
- Provjeri da je "Who has access" postavljen na **Anyone**
- Ponovo autorizuj

### Test 2: Login
```
https://script.google.com/macros/s/TVOJ_URL/exec?path=login&username=TVOJ_USERNAME&password=TVOJ_PASSWORD
```

✅ Dobar odgovor:
```json
{
  "success": true,
  "username": "admin",
  "fullName": "Ime Prezime",
  "role": "admin",
  "type": "Administrator"
}
```

❌ Loš odgovor: `{"error":"Unauthorized"}`
- Provjeri da korisnik postoji u KORISNICI sheet-u
- Provjeri da su username i password tačni

### Test 3: Stats
```
https://script.google.com/macros/s/TVOJ_URL/exec?path=stats&year=2024&username=TVOJ_USERNAME&password=TVOJ_PASSWORD
```

✅ Dobar odgovor:
```json
{
  "totalPrimka": 12345.67,
  "totalOtprema": 11000.00,
  "monthlyStats": [...],
  "odjeliStats": {...}
}
```

---

## Korak 4: Updateuj index.html

### Otvori index.html i promijeni:
```javascript
const API_URL = 'TVOJ_URL_OVDJE';
```

### Zamijeniti sa:
```javascript
const API_URL = 'https://script.google.com/macros/s/AKfycbw.../exec';
```

### Spremi fajl

---

## Korak 5: Deploy aplikaciju

### Opcija A: Lokalno testiranje
```bash
python -m http.server 8000
```
Otvori: `http://localhost:8000`

### Opcija B: GitHub Pages
1. Push kod na GitHub
2. Settings → Pages
3. Source: main branch
4. Otvori public URL

### Opcija C: Direktno otvaranje
- Otvori `index.html` direktno u browseru
- Radi odmah!

---

## ✅ Čeklist

- [ ] Google Sheets setup sa KORISNICI, PRIMKA, OTPREMA sheets
- [ ] Apps Script kod kopiran iz apps-script-code.gs
- [ ] Imena sheet-ova prilagođena u kodu
- [ ] Apps Script deploy-an kao Web App
- [ ] "Who has access" postavljen na **Anyone**
- [ ] Aplikacija autorizovana
- [ ] API URL testiran (sva 3 testa)
- [ ] index.html updatean sa novim API URL-om
- [ ] Aplikacija deploy-ana ili otvorena lokalno

---

## 🆘 Česte Greške

### "Sorry, unable to open the file"
➡️ Deploy → Manage deployments → Edit → Who has access: **Anyone**

### `{"error":"Unknown path"}`
➡️ **OVO JE OK!** Samo dodaj `?path=login&username=...` u URL

### `{"error":"TypeError: Cannot read properties of null"}`
➡️ Apps Script mora biti otvoren iz Google Sheets (Extensions → Apps Script)

### `{"error":"Unauthorized"}`
➡️ Provjeri KORISNICI sheet - da li postoji taj username/password

### Login ne radi u aplikaciji
➡️ Provjeri browser console (F12) za greške
➡️ Provjeri da li je API_URL tačan u index.html

---

## 📚 Dodatna Dokumentacija

- `APPS_SCRIPT_UPUTSTVO.md` - Detaljno Apps Script uputstvo
- `APPS_SCRIPT_NAPREDNE_OPCIJE.md` - Caching, email notifikacije, backup
- `KAKO_TESTIRATI.md` - Testiranje demo verzije sa mobitela
- `README.md` - Kompletan pregled projekta

---

## 🎯 Potrebna Pomoć?

1. Prvo pročitaj ovaj dokument ponovo
2. Provjeri Troubleshooting sekciju u APPS_SCRIPT_UPUTSTVO.md
3. Otvori browser console (F12) i provjeri greške
4. Provjeri da su svi koraci urađeni tačno

---

**Uživaj u aplikaciji! 🌲**
