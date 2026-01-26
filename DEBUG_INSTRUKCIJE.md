# 🐛 Debug Instrukcije - "Unknown path" Greška

## Problem
Greška: "Dashboard API error: Unknown path"

## Mogući Uzroci

1. **Browser cache** - Stara verzija JavaScript-a u cache-u
2. **Pogrešan fajl** - Koristiš stari HTML fajl
3. **API URL** - Pogrešan ili star API endpoint
4. **Apps Script nije deploy-an** - Backend nije pravilno postavljen

---

## Rješenje - Korak po Korak

### Korak 1: Otvori Browser Console

**Chrome/Edge/Firefox:**
1. Pritisni `F12` na tastaturi
2. Idi na **Console** tab
3. Clear sve greške (klikni Clear ili ikona 🗑️)

### Korak 2: Provjeri Network Requests

1. U Developer Tools, klikni **Network** tab
2. Refresh stranicu (F5)
3. Pronađi request koji ide na Google Apps Script URL
4. Klikni na njega
5. Provjeri:
   - **Request URL** - Da li ima `?path=login` ili `?path=stats`?
   - **Response** - Šta je tačan odgovor?

**Očekivano:**
```
Request URL: https://script.google.com/.../exec?path=login&username=...
Response: {"success": true, ...}
```

**Ako vidiš:**
```
Request URL: https://script.google.com/.../exec?path=dashboard
```
To znači da browser koristi staru verziju!

### Korak 3: Hard Refresh

**Windows/Linux:**
```
Ctrl + Shift + R
ili
Ctrl + F5
```

**Mac:**
```
Cmd + Shift + R
```

### Korak 4: Clear Browser Cache

**Chrome:**
1. F12 → Network tab
2. Desni klik na Reload dugme (pored URL bara)
3. Klikni "Empty Cache and Hard Reload"

**Firefox:**
1. F12 → Network tab
2. Ikona sa zupčanikom → "Clear browser cache"
3. Reload

### Korak 5: Provjeri Koji Fajl Koristiš

**Otvori ovaj fajl:**
```
/home/user/sumarija/index.html
```

**NEMOJ koristiti:**
- Stare verzije
- Fajlove iz drugih foldera
- Cache-ovane verzije

### Korak 6: Provjeri API URL u index.html

Otvori Developer Tools Console i unesi:
```javascript
console.log(API_URL);
```

**Očekivano:**
```
https://script.google.com/macros/s/AKfycby1ex5OXfAJy651uBTdyGXW3TBzeJ2rB43xtQOXjBwlrfXsQF1UuRBuXaghDRzGhbeC/exec
```

Ako je drugačije - imaš staru verziju!

### Korak 7: Testiraj API Direktno

Otvori ovaj URL u browser-u:
```
https://script.google.com/macros/s/AKfycby1ex5OXfAJy651uBTdyGXW3TBzeJ2rB43xtQOXjBwlrfXsQF1UuRBuXaghDRzGhbeC/exec
```

**Očekivano:**
```json
{"error":"Unknown path"}
```

Ovo je DOBRO! Znači da API radi, samo nema path parametar.

**Sada testiraj sa path parametrom:**
```
https://script.google.com/macros/s/AKfycby1ex5OXfAJy651uBTdyGXW3TBzeJ2rB43xtQOXjBwlrfXsQF1UuRBuXaghDRzGhbeC/exec?path=login&username=test&password=test
```

**Očekivano:**
```json
{"success":false,"error":"Pogrešno korisničko ime ili šifra"}
```

Ako dobijaš ovo - API radi!

---

## Alternativna Rješenja

### Rješenje A: Restart Browser

1. Zatvori SVE tab-ove
2. Zatvori browser kompletno
3. Otvori ponovo
4. Otvori index.html

### Rješenje B: Incognito/Private Mode

1. Otvori Incognito/Private window (Ctrl+Shift+N)
2. Otvori index.html
3. Testiraj login

Ako radi u Incognito → Problem je CACHE!

### Rješenje C: Drugi Browser

Testiraj u drugom browser-u (Chrome → Firefox ili obrnuto)

---

## Ako I Dalje Ne Radi

### Provjeri Apps Script

1. Otvori Google Sheets
2. Extensions → Apps Script
3. Provjeri da kod ima:

```javascript
function doGet(e) {
  try {
    const path = e.parameter.path;

    if (path === 'login') {
      return handleLogin(e.parameter.username, e.parameter.password);
    } else if (path === 'stats') {
      return handleStats(e.parameter.year, e.parameter.username, e.parameter.password);
    }

    return createJsonResponse({ error: 'Unknown path' }, false);
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, false);
  }
}
```

4. Deploy → Manage deployments
5. Provjeri:
   - Execute as: **Me**
   - Who has access: **Anyone**

---

## Console Debug Commands

Otvori Console (F12) i copy-paste ovo:

```javascript
// 1. Provjeri API URL
console.log('API_URL:', API_URL);

// 2. Provjeri da li postoji fetchWithRetry funkcija
console.log('fetchWithRetry function:', typeof fetchWithRetry);

// 3. Testiraj API poziv
fetch(API_URL + '?path=stats&year=2024&username=test&password=test')
  .then(r => r.json())
  .then(data => console.log('API Response:', data))
  .catch(err => console.error('API Error:', err));

// 4. Provjeri localStorage
console.log('Saved user:', localStorage.getItem('sumarija_user'));
console.log('Saved pass:', localStorage.getItem('sumarija_pass'));
```

---

## Ako Sve Ovo Ne Pomogne

Pošalji mi screenshot ili copy-paste:

1. **Console tab** - Sve greške
2. **Network tab** - Request URL i Response
3. Output od debug commands iznad

---

**Najčešći Problem:** Browser cache sa starom verzijom JavaScript-a!

**Najbrži Fix:** Ctrl+Shift+R (Hard Refresh)
