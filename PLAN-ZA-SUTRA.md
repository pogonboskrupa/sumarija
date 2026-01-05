# 📅 PLAN ZA SUTRA - 2026-01-06

## 🎯 PRIORITETI

### 🔴 KRITIČNO - Sigurnost (Hitno!)

#### 1. JWT Autentifikacija umjesto plain text lozinke
**Trenutni problem**:
```javascript
// ❌ OPASNO - lozinka vidljiva u localStorage
localStorage.setItem('sumarija_pass', password);

// ❌ OPASNO - lozinka u URL-u
const url = `${API_URL}?path=login&username=${user}&password=${pass}`;
```

**Rješenje**:
```javascript
// ✅ SIGURNO - JWT token
localStorage.setItem('sumarija_token', jwt_token);

// ✅ SIGURNO - POST request sa Authorization header
fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
})
```

**Fajlovi za izmjenu**:
- `apps-script-code.gs` - Dodati JWT generation u `doPost()` funkciju
- `index.html` - Zamijeniti localStorage lozinke sa token-om

**Vrijeme**: ~2-3 sata

---

#### 2. Input validacija
**Problem**: Korisnik može unijeti negativne brojeve, prevelike vrijednosti, invalid datume

**Rješenje**:
```javascript
// Validacija količine
function validateKolicina(value) {
    if (value < 0) return "Količina ne može biti negativna";
    if (value > 10000) return "Količina prevelika (max 10,000 m³)";
    if (!value) return "Količina je obavezna";
    return null; // valid
}
```

**Fajlovi za izmjenu**:
- `index.html` - Dodati validaciju u forme za unos (primka, otprema)
- Dodati min/max atribute na input polja
- Client-side provjera prije slanja na backend

**Vrijeme**: ~1-2 sata

---

### 🟡 VAŽNO - User Experience

#### 3. Bolji error handling
**Problem**: Sve greške prikazane isto, korisnik ne zna šta da uradi

**Rješenje**:
- Network greška → "Nema internet konekcije. Pokušaj ponovo" + Retry button
- Auth greška → "Sesija istekla. Prijavi se ponovo"
- Validation greška → "Količina mora biti između 0 i 10,000"

**Fajlovi za izmjenu**:
- `index.html` - Refaktorisati sve catch blokove
- Dodati `showNetworkError()`, `showAuthError()`, `showValidationError()`

**Vrijeme**: ~1 sat

---

#### 4. Cache invalidation
**Problem**: Ako admin odobri primku, korisnik neće vidjeti dok se cache ne istekne

**Rješenje**:
- Backend API vraća `last-modified` timestamp
- Frontend poredi sa lokalnim cache timestamp
- Ako je backend noviji, automatski refresh podataka

**Fajlovi za izmjenu**:
- `apps-script-code.gs` - Dodati last_modified u response
- `index.html` - Provjera last_modified u fetchWithCache()

**Vrijeme**: ~1 sat

---

### 🟢 NICE TO HAVE (Ako ima vremena)

#### 5. Export izvještaja u Excel
**Korisnost**: Korisnici često moraju dijeliti izvještaje

**Biblioteka**: SheetJS (xlsx.js) - ~50KB

**Vrijeme**: ~2 sata

---

#### 6. Confirm dialozi za kritične akcije
**Primjer**: "Da li ste sigurni da želite obrisati ovu primku?"

**Vrijeme**: ~30 minuta

---

## 📋 TESTNI SCENARIJI ZA SUTRA

Kada budu gotove izmjene, testiraj:

### Sigurnost:
- [ ] Login - da li se lozinka više ne vidi u localStorage?
- [ ] Login - da li se lozinka više ne vidi u Network tab URL-u?
- [ ] Token expiration - da li nakon 24h korisnik mora ponovo login?

### Validacija:
- [ ] Unos primke - da li je blokirano unos negativne količine?
- [ ] Unos primke - da li je blokirano unos prevelike količine (>10,000)?
- [ ] Unos primke - da li prazna polja prikazuju grešku?

### Error handling:
- [ ] Isključi internet - da li prikazuje jasnu poruku i Retry button?
- [ ] Login sa pogrešnom lozinkom - da li jasno kaže "Pogrešna lozinka"?

---

## 🛠️ TEHNIČKI DETALJI

### JWT Implementacija

**Backend (apps-script-code.gs)**:
```javascript
function doPost(e) {
    const params = JSON.parse(e.postData.contents);

    if (params.action === 'login') {
        const user = validateUser(params.username, params.password);
        if (user) {
            // Generate JWT token (expiration 24h)
            const token = generateJWT(user, 24 * 60 * 60);
            return ContentService.createTextOutput(JSON.stringify({
                success: true,
                token: token,
                user: user
            })).setMimeType(ContentService.MimeType.JSON);
        }
    }

    // Verify token for all other requests
    const user = verifyJWT(params.token);
    if (!user) {
        return unauthorized();
    }

    // Process request...
}

function generateJWT(user, expiresIn) {
    // Simple JWT implementation or use library
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        userId: user.username,
        role: user.role,
        exp: Date.now() + (expiresIn * 1000)
    };
    const secret = PropertiesService.getScriptProperties().getProperty('JWT_SECRET');

    // Encode and sign
    return base64Encode(JSON.stringify(header)) + '.' +
           base64Encode(JSON.stringify(payload)) + '.' +
           sign(header, payload, secret);
}
```

**Frontend (index.html)**:
```javascript
// Login
const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'login',
        username: username,
        password: password
    })
});

const data = await response.json();
if (data.success) {
    localStorage.setItem('sumarija_token', data.token);
    localStorage.setItem('sumarija_user', JSON.stringify(data.user));
    // NE čuvaj lozinku!
}

// Sve ostale API pozive
const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sumarija_token')}`
    },
    body: JSON.stringify({ action: 'get-primke', ... })
});
```

---

## ⏰ PROCJENA VREMENA

| Task | Prioritet | Vrijeme |
|------|-----------|---------|
| JWT auth | 🔴 Kritično | 2-3h |
| Input validacija | 🔴 Kritično | 1-2h |
| Error handling | 🟡 Važno | 1h |
| Cache invalidation | 🟡 Važno | 1h |
| **UKUPNO** | | **5-7h** |

---

## 💡 NAPOMENE

1. **JWT Secret**: Generiši random string i stavi u Apps Script Properties (File → Project properties → Script properties)
   ```
   JWT_SECRET: "random-string-min-32-karaktera-dug-tajni-kljuc"
   ```

2. **CORS**: Možda će biti potrebno dodati CORS headers u Apps Script:
   ```javascript
   function doPost(e) {
       const output = ContentService.createTextOutput(jsonData);
       output.setMimeType(ContentService.MimeType.JSON);

       // Add CORS headers
       return output.setHeader('Access-Control-Allow-Origin', '*')
                    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
   }
   ```

3. **Backward compatibility**: Tokom prelaza na JWT, podržaj oba sistema (lozinka i token) na backend-u, dok svi korisnici ne pređu na novu verziju.

---

**Srećno sutra!** 🚀
