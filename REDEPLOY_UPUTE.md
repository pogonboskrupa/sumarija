# 🚀 RUČNI REDEPLOY APPS SCRIPT - CORS FIX

## ❗ VAŽNO
Kod sa CORS podrškom JE već implementiran u `apps-script/` folderu, ali **NIJE deploy-ovan** na Google Apps Script.

Morate izvršiti **REDEPLOY** kako bi novi kod postao aktivan.

---

## 📋 KORAK PO KORAK

### **OPCIJA 1: Push i Redeploy pomoću clasp (PREPORUČENO)**

#### 1️⃣ Autentifikujte clasp (JEDNOM)
```bash
clasp login
```
- Otvorićce se browser prozor
- Klikni **Allow** da dozvoliš pristup
- Zatvori browser kada je gotovo

#### 2️⃣ Push novi kod na Apps Script
```bash
clasp push
```
- Ova komanda će push-ovati SVE fajlove iz `apps-script/` foldera

#### 3️⃣ Kreiraj novi deployment
```bash
clasp deploy --description "CORS fix - $(date +%Y-%m-%d)"
```

#### 4️⃣ Dobij novi Web App URL
```bash
clasp deployments
```
- Kopiraj **Web app URL** iz output-a
- Treba da izgleda ovako: `https://script.google.com/macros/s/AKfycby.../exec`

#### 5️⃣ Ažuriraj frontend
Otvori `js/api-optimized.js` i zameni stari URL sa novim:
```javascript
const API_BASE_URL = 'https://script.google.com/macros/s/TVOJ_NOVI_URL/exec';
```

Takođe ažuriraj `js/app.js`:
```javascript
const API_URL = 'https://script.google.com/macros/s/TVOJ_NOVI_URL/exec';
```

#### 6️⃣ Commit i push promene
```bash
git add .
git commit -m "🚀 DEPLOY: Apps Script CORS fix"
git push -u origin claude/find-last-branch-AKhOE
```

---

### **OPCIJA 2: Ručni upload u browser (ako clasp ne radi)**

#### 1️⃣ Otvori Apps Script projekat
Klikni ovaj link: [https://script.google.com/d/1_hlDUggXnHHNZOrnaLqZqu1XdrwXRY3egxL9U_CWjn1WL6t4dtM5RW2q/edit](https://script.google.com/d/1_hlDUggXnHHNZOrnaLqZqu1XdrwXRY3egxL9U_CWjn1WL6t4dtM5RW2q/edit)

#### 2️⃣ Kopiraj SVE fajlove iz `apps-script/` foldera
Ručno kopiraj sadržaj sledećih fajlova:
- `apps-script/main.gs` → `main.gs`
- `apps-script/utils-triggers.gs` → `utils-triggers.gs`
- `apps-script/config.gs` → `config.gs`
- `apps-script/authentication.gs` → `authentication.gs`
- `apps-script/services.gs` → `services.gs`
- `apps-script/api-handlers.gs` → `api-handlers.gs`
- `apps-script/diagnostic.gs` → `diagnostic.gs`
- `apps-script/appsscript.json` → `appsscript.json`

**KRITIČNO:** Proveri da li `utils-triggers.gs` sadrži CORS headere:
```javascript
// Pomoćna funkcija za JSON response
function createJsonResponse(data, success) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  // ✅ CORS Support - KRITIČNO za GitHub Pages pristup
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  output.setHeader('Access-Control-Max-Age', '86400');

  return output;
}
```

#### 3️⃣ Redeploy
1. Klikni **Deploy** → **Manage deployments**
2. Klikni **Edit** (pencil icon) pored trenutnog Web app deployment-a
3. Version: **New version**
4. Description: "CORS fix"
5. **PROVERI** deployment postavke:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Klikni **Deploy**

#### 4️⃣ Kopiraj novi URL
Nakon deployment-a, kopiraj **Web app URL**:
```
https://script.google.com/macros/s/AKfycby.../exec
```

#### 5️⃣ Ažuriraj frontend (isti kao u Opciji 1, korak 5)

#### 6️⃣ Commit i push (isti kao u Opciji 1, korak 6)

---

## 🧪 TESTIRANJE

Testiraj direktno u browseru:

1. **Test 1: Osnovni GET zahtev**
```
https://script.google.com/macros/s/TVOJ_URL/exec?path=get-odjeli-list
```
Trebao bi da vidiš JSON odgovor sa listom odjela.

2. **Test 2: Provera CORS headera**
Otvori Developer Tools (F12) → Network tab → Refresh stranicu → Pogledaj zahtev ka API-ju → Proveri Response Headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

3. **Test 3: Aplikacija na GitHub Pages**
Otvori: `https://pogonboskrupa.github.io/sumarija/`
- Prijavi se
- Proveri da li ima CORS grešaka u konzoli (F12)

---

## 🔍 ŠTA JE POPRAVLJENO

### CORS Headeri dodati u:
1. **`utils-triggers.gs:86-89`** - `createJsonResponse()` funkcija
2. **`main.gs:130-133`** - `doOptions()` preflight handler

### Deployment postavke (već konfigurisano):
- Runtime: **V8** ✅
- Execute as: **USER_DEPLOYING** ✅
- Access: **ANYONE** ✅

---

## ❓ AKO PROBLEM OPSTAJE

Ako i dalje vidiš CORS greške nakon redeploy-a:

1. **Hard refresh browser cache**
   - Chrome/Firefox: `Ctrl + Shift + R`
   - Safari: `Cmd + Shift + R`

2. **Proveri da li je novi deployment aktivan**
   ```bash
   curl "https://script.google.com/macros/s/TVOJ_URL/exec?path=get-odjeli-list" -v 2>&1 | grep -i "access-control"
   ```
   Trebao bi da vidiš `access-control-allow-origin: *`

3. **Proveri Apps Script Execution Log**
   - Otvori Apps Script projekat
   - Klikni **Executions** (lijevo)
   - Pogledaj da li ima grešaka

---

**Nakon uspešnog redeploy-a, aplikacija bi trebala da radi bez CORS grešaka!**
