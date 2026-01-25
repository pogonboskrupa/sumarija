# 🚀 Apps Script Deployment - CORS Fix

CORS headeri su popravljeni u kodu. Sada treba deployment.

---

## ✅ NAČIN 1: Automatski (clasp) - PREPORUČENO

Pokreni:

```bash
chmod +x deploy-apps-script.sh
./deploy-apps-script.sh
```

Script će:
1. Autentifikovati clasp (otvoriće browser)
2. Push-ovati kod na Google Apps Script
3. Kreirati novi deployment
4. Automatski ažurirati `js/api-optimized.js` sa novim URL-om

**Gotovo!** Samo commit i push.

---

## 🔧 NAČIN 2: Ručno (3 klika)

Ako clasp ne radi ili ne želiš da ga koristiš:

### Step 1: Otvori Apps Script projekat

Klikni: https://script.google.com/d/1_hlDUggXnHHNZOrnaLqZqu1XdrwXRY3egxL9U_CWjn1WL6t4dtM5RW2q/edit

### Step 2: Deploy

1. Klikni **Deploy** → **Manage deployments**
2. Klikni edit (pencil icon) pored trenutnog Web app deployment-a
3. Version: **New version**
4. Opis: "CORS fix"
5. Klikni **Deploy**

**ILI ako nema deployment-a:**

1. Klikni **Deploy** → **New deployment**
2. Tip: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Klikni **Deploy**

### Step 3: Kopiraj URL

Nakon deployment-a, videćeš **Web app URL**:
```
https://script.google.com/macros/s/AKfycby.../exec
```

**Kopiraj taj URL!**

### Step 4: Ažuriraj frontend

Otvori `js/api-optimized.js` i zamijeni stari URL sa novim:

```javascript
const API_BASE_URL = 'TVOJ_NOVI_URL';
```

### Step 5: Commit i push

```bash
git add .
git commit -m "🚀 DEPLOY: Apps Script CORS fix"
git push -u origin claude/find-last-branch-AKhOE
```

---

## 🧪 Testiranje

Testiraj endpoint-e:

```bash
# Test: get-odjeli-list
curl "TVOJ_URL?path=get-odjeli-list"

# Test: dashboard
curl "TVOJ_URL?path=dashboard&username=USER&password=PASS&year=2025"
```

Trebao bi dobiti JSON odgovore bez CORS grešaka!

---

## 📝 Šta je popravljeno

1. **utils-triggers.gs**: `createJsonResponse` - UVIJEK postavlja CORS headere
2. **main.gs**: `doOptions` - UVIJEK postavlja CORS headere za preflight

CORS Headeri:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Max-Age: 86400`

Runtime: **V8** ✅

---

**Odaberi način 1 ili način 2 i deploy-uj. Onda javi novi URL da ažuriram frontend.**
