# 🔧 Kako Deploy-ovati Fix za Dinamika Save

## Problem
Kada pokušate spremiti mjesečne dinamike, dobijate grešku:
```
Error saving dinamika: Error: Greška pri spremanju dinamike:
SyntaxError: Unexpected token '%', "%7B%2210%2"... is not valid JSON
```

## Rješenje
Backend kod (Google Apps Script) mora biti ažuriran da pravilno dekodira URL parametar prije parsiranja JSON-a.

---

## 📝 Koraci za Deploy

### 1. Otvori Google Apps Script
1. Otvori svoju Google Sheets tabelu
2. Klikni **Extensions** → **Apps Script**
3. Pronaći fajl gdje se nalazi funkcija `handleSaveDinamika`

### 2. Pronaći funkciju `handleSaveDinamika`
U Apps Script editoru, potraži funkciju `handleSaveDinamika`. Trebalo bi da izgleda ovako:

```javascript
function handleSaveDinamika(username, password, godina, mjeseciParam) {
  try {
    Logger.log('=== HANDLE SAVE DINAMIKA START ===');

    // ...authentication kod...

    // Parse mjeseci JSON ako je string (dolazi iz GET parametra)
    let mjeseciObj = mjeseciParam;
    if (typeof mjeseciParam === 'string') {
      Logger.log('Parsing mjeseci from string...');
      mjeseciObj = JSON.parse(mjeseciParam);  // ❌ OVO MORA BITI PROMIJENJENO
    }

    // ...ostatak funkcije...
  }
}
```

### 3. Zamijeni kod
Zamijeni ovaj dio:

**PRIJE (pogrešno):**
```javascript
if (typeof mjeseciParam === 'string') {
  Logger.log('Parsing mjeseci from string...');
  mjeseciObj = JSON.parse(mjeseciParam);
}
```

**POSLIJE (ispravno):**
```javascript
if (typeof mjeseciParam === 'string') {
  Logger.log('Parsing mjeseci from string...');
  // Decode URL-encoded string before parsing JSON
  const decodedParam = decodeURIComponent(mjeseciParam);
  Logger.log('Decoded param: ' + decodedParam);
  mjeseciObj = JSON.parse(decodedParam);
}
```

### 4. Spremi i Deploy
1. Klikni **File** → **Save** (ili Ctrl+S)
2. Klikni **Deploy** → **Manage deployments**
3. Klikni na ikonu ⚙️ (Edit) pored aktivnog deployment-a
4. U sekciji **Version**, odaberi **New version**
5. Dodaj opis verzije: "Fix URL decoding za dinamika save"
6. Klikni **Deploy**
7. Kopiraj novi URL ako se promijenio (trebalo bi ostati isti)

### 5. Testiraj
1. Osvježi aplikaciju u browseru (Ctrl+F5)
2. Idi na **DINAMIKA** stranicu
3. Unesi mjesečne vrijednosti
4. Klikni **Spremi**
5. Trebalo bi dobiti poruku: "✅ Spremljeno! Mjesečna dinamika uspješno spremljena."

---

## 🔍 Objašnjenje Problema

**Šta se dešava:**
1. Frontend (app.js) šalje podatke kao: `encodeURIComponent(JSON.stringify(mjeseci))`
   - Rezultat: `%7B%2210%22%3A100%2C%2211%22%3A200...`
2. Google Apps Script automatski dekodira URL parametre **jednom**
   - Rezultat: `{"10":100,"11":200...}` (ispravan JSON)
3. ALI ponekad dekodiranje ne radi potpuno, pa backend dobije još uvijek enkodiran string
4. Backend pokušava `JSON.parse()` na enkodiranom stringu → **greška!**

**Rješenje:**
Eksplicitno pozivanje `decodeURIComponent()` osigurava da je string potpuno dekodiran prije parsiranja.

---

## 📋 Alternativno Rješenje (ako ne možete deploy-ovati backend)

Ako ne možete pristupiti Google Apps Script backend-u, možete promijeniti frontend da NE enkodira JSON:

**U fajlu `js/app.js`, linija 8933:**

PRIJE:
```javascript
const mjeseciJson = encodeURIComponent(JSON.stringify(mjeseci));
const url = buildApiUrl('save_dinamika', { godina: year, mjeseci: mjeseciJson });
```

POSLIJE:
```javascript
const mjeseciJson = JSON.stringify(mjeseci); // Ukloni encodeURIComponent
const url = buildApiUrl('save_dinamika', { godina: year, mjeseci: mjeseciJson });
```

**NAPOMENA:** Ovo rješenje NIJE preporučeno jer JSON može sadržati karaktere koji će pokvariti URL.
Backend fix je bolji.

---

## ❓ Pitanja?

Ako imate problema sa deploy-om, provjerite:
- Da li ste sačuvali promjene prije deploy-a?
- Da li ste odabrali "New version" umjesto "HEAD"?
- Da li ste osvježili aplikaciju u browseru (Ctrl+F5)?

Ako i dalje ne radi, provjerite Google Apps Script logs:
1. U Apps Script editoru: **Execution log** (ikona sa listom)
2. Potraži greške ili log poruke
