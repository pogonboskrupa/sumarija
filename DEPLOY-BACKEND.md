# 🚀 BACKEND DEPLOYMENT INSTRUKCIJE

## Problem
Backend promjene u `apps-script-code.gs` fajlu **NISU automatski deploy-ane** u Google Apps Script!

## Rješenje

### Korak 1: Kopiraj kod
```bash
# Kopiraj CIJELI sadržaj apps-script-code.gs fajla
cat apps-script-code.gs | pbcopy  # MacOS
# ili
cat apps-script-code.gs | xclip -selection clipboard  # Linux
# ili otvori fajl i kopiraj ručno (Ctrl+A, Ctrl+C)
```

### Korak 2: Deploy u Google Apps Script

1. **Otvori Google Apps Script editor**
   - URL: https://script.google.com/home
   - Pronađi svoj projekt (vjerujem da je vezan za spreadsheet)

2. **Paste novi kod**
   - Selektuj SVE u Code.gs fajlu (Ctrl+A)
   - Delete (Ctrl+X)
   - Paste novi kod (Ctrl+V)
   - Save (Ctrl+S)

3. **Deploy nova verzija**
   - Klikni **Deploy** > **Manage deployments**
   - Klikni na ikonu **Edit** (pencil) pored trenutnog deployment-a
   - U **Version** dropdown, izaberi **New version**
   - Dodaj description: "Fix: odjel.includes error - String conversion"
   - Klikni **Deploy**

4. **Obriši cache u browseru**
   ```javascript
   // Otvori browser konzolu (F12) i upiši:
   localStorage.clear()
   ```
   - Zatim refresh (Ctrl+Shift+R)

### Korak 3: Testiranje

Nakon deployment-a, testiraj:
- Primač > Izvještaji > Sedmični
- Primač > Izvještaji > Mjesečni
- Otpremač > Izvještaji > Sedmični
- Otpremač > Izvještaji > Mjesečni

---

## Šta je promijenjeno u backend-u?

### handlePrimke() - linija 3632
```javascript
// ✅ PRIJE (GREŠNO):
const odjel = row[0];
const radiliste = odjel.includes(' - ') ? ... // ERROR!

// ✅ POSLIJE (ISPRAVNO):
const odjelStr = String(odjel || '');
const radiliste = odjelStr.includes(' - ') ? ...
primke.push({ odjel: odjelStr, ... });
```

### handleOtpreme() - linija 3712
```javascript
// ✅ PRIJE (GREŠNO):
const odjel = row[0];
const radiliste = odjel.includes(' - ') ? ... // ERROR!

// ✅ POSLIJE (ISPRAVNO):
const odjelStr = String(odjel || '');
const radiliste = odjelStr.includes(' - ') ? ...
otpreme.push({ odjel: odjelStr, ... });
```

---

## Zašto se greška dešava?

Excel/Sheets ponekad vraća vrijednosti kao:
- `Number` (npr. `39` umjesto `"ODJEL 39"`)
- `Object` (ako je cell objekat)
- `null` ili `undefined`

Kada pokušamo pozvati `.includes()` na number/object, dobijamo:
```
TypeError: odjel.includes is not a function
```

Rješenje je konvertovati u string PRIJE pozivanja `.includes()`:
```javascript
const odjelStr = String(odjel || '');  // ✅ Uvijek vraća string
```
