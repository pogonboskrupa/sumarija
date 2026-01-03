# 🔒 ŠUMARIJA - SIGURNOSNE POPRAVKE I PREPORUKE

## ⚠️ **KRITIČNE IZMJENE - IMPLEMENTIRAJ ODMAH!**

### 1. **HARDCODED ADMIN CREDENTIALS** (apps-script-code.gs:10-11)

**Problem:**
```javascript
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';
```

**Rješenje - Opcija A (Brzo):**
```javascript
// Koristi Google Apps Script Properties Service
// File > Project Properties > Script Properties > Add row
// Key: ADMIN_PASSWORD, Value: nekiJačiPassword123!

function getAdminPassword() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
}

// U kodu:
if (username === ADMIN_USERNAME && password === getAdminPassword()) {
  // ...
}
```

**Rješenje - Opcija B (Najbolje):**
```javascript
// Password hashing sa SHA-256
function getPasswordHash(password) {
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return rawHash.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// Generiši hash i stavi u Script Properties
function setupAdminPassword() {
  const hash = getPasswordHash('tvojNoviPassword123!');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', hash);
  Logger.log('Hash: ' + hash);
}

// U kodu za login:
const storedHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
if (username === ADMIN_USERNAME && getPasswordHash(password) === storedHash) {
  // Login successful
}
```

---

### 2. **PASSWORDI U GET PARAMETRIMA**

**Problem:**
```javascript
// Svaki API call šalje password kroz URL:
const url = `${API_URL}?path=dashboard&username=${username}&password=${password}`;
```

**Posljedice:**
- Password u browser historiji
- Password u server logovima
- Password u network logs
- HTTPS NE pomaže jer se čuva lokalno!

**Rješenje - Token-Based Authentication:**

#### **Backend (apps-script-code.gs):**

```javascript
// 1. Dodaj token generation u handleLogin
function handleLogin(username, password) {
  // ... postojeća validacija ...

  if (loginSuccessful) {
    const token = generateToken(username);

    return createJsonResponse({
      success: true,
      token: token,  // ← NOVI TOKEN
      username: username,
      fullName: fullName,
      expiresIn: 86400 // 24h u sekundama
    }, true);
  }
}

// 2. Token generation funkcija
function generateToken(username) {
  const timestamp = new Date().getTime();
  const random = Utilities.getUuid();
  const payload = `${username}:${timestamp}:${random}`;

  // Potpiši token
  const signature = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    payload,
    Utilities.Charset.UTF_8
  );
  const signatureHex = signature.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

  return Utilities.base64Encode(`${payload}:${signatureHex}`);
}

// 3. Token validation funkcija
function validateToken(token) {
  try {
    const decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;

    const [username, timestamp, random, signature] = parts;
    const payload = `${username}:${timestamp}:${random}`;

    // Verifikuj signature
    const expectedSig = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      payload,
      Utilities.Charset.UTF_8
    );
    const expectedSigHex = expectedSig.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

    if (expectedSigHex !== signature) return null;

    // Check expiry (24h)
    const tokenAge = new Date().getTime() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000;
    if (tokenAge > maxAge) return null;

    return username;
  } catch (error) {
    return null;
  }
}

// 4. Izmijeni doGet da koristi token
function doGet(e) {
  const path = e.parameter.path;

  if (path === 'login') {
    return handleLogin(e.parameter.username, e.parameter.password);
  }

  // Sve ostale rute zahtijevaju token
  const token = e.parameter.token;
  const username = validateToken(token);

  if (!username) {
    return createJsonResponse({ error: 'Unauthorized - invalid token' }, false);
  }

  // Sad koristiš username iz tokena umjesto iz parametara
  if (path === 'dashboard') {
    return handleDashboard(e.parameter.year, username);
  }

  // ... ostale rute
}
```

#### **Frontend (index.html):**

```javascript
// 1. Čuvaj token umjesto passworda
let currentToken = null;

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const response = await fetch(
    `${API_URL}?path=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  );

  const data = await response.json();

  if (data.success) {
    currentToken = data.token;  // ← Čuvaj token
    currentUser = data;

    // Čuvaj samo token, NE password!
    localStorage.setItem('sumarija_token', currentToken);
    localStorage.setItem('sumarija_user', JSON.stringify(data));

    showApp();
  }
}

// 2. Auto-login sa tokenom
async function autoLogin() {
  const savedToken = localStorage.getItem('sumarija_token');
  const savedUser = localStorage.getItem('sumarija_user');

  if (savedToken && savedUser) {
    currentToken = savedToken;
    currentUser = JSON.parse(savedUser);

    // Testiraj da li je token još važeći
    try {
      const testUrl = `${API_URL}?path=dashboard&year=2025&token=${currentToken}`;
      const response = await fetch(testUrl);
      const data = await response.json();

      if (!data.error) {
        showApp();
        return;
      }
    } catch (error) {
      // Token istekao
    }
  }

  // Ako token nije važeći, pokaži login
  localStorage.removeItem('sumarija_token');
  localStorage.removeItem('sumarija_user');
}

// 3. Izmijeni sve API pozive da koriste token
async function loadDashboard() {
  const year = new Date().getFullYear();
  const url = `${API_URL}?path=dashboard&year=${year}&token=${currentToken}`;

  const data = await fetchWithCache(url, 'cache_dashboard');
  // ... ostali kod
}

// Primijeni isto za SVE API pozive
```

---

### 3. **RATE LIMITING**

**Problem:** Nema zaštite od brute force napada

**Rješenje:**

```javascript
// Backend - dodaj u apps-script-code.gs
const rateLimitCache = {};

function checkRateLimit(username) {
  const now = Date.now();
  const key = username.toLowerCase();

  if (!rateLimitCache[key]) {
    rateLimitCache[key] = { count: 1, firstAttempt: now };
    return true;
  }

  const timeWindow = 60000; // 1 minuta

  // Reset ako je prošao time window
  if (now - rateLimitCache[key].firstAttempt > timeWindow) {
    rateLimitCache[key] = { count: 1, firstAttempt: now };
    return true;
  }

  // Check limit (max 5 pokušaja u minuti)
  if (rateLimitCache[key].count >= 5) {
    return false;
  }

  rateLimitCache[key].count++;
  return true;
}

// U handleLogin funkciji:
function handleLogin(username, password) {
  // Provjeri rate limit PRIJE svega ostalog
  if (!checkRateLimit(username)) {
    Logger.log(`Rate limit exceeded for user: ${username}`);
    return createJsonResponse({
      success: false,
      error: 'Previše pokušaja prijave. Pokušajte za 1 minut.'
    }, false);
  }

  // ... rest of login logic
}
```

---

### 4. **INPUT VALIDACIJA**

**Problem:** Nema validacije user inputa prije procesiranja

**Rješenje:**

```javascript
// Dodaj validation funkcije
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Username je obavezan');
  }
  if (username.length < 3 || username.length > 50) {
    throw new Error('Username mora biti 3-50 karaktera');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw new Error('Username može sadržati samo slova, brojeve, _ i -');
  }
  return username.trim();
}

function validateDate(dateStr) {
  const date = parseDate(dateStr);
  if (!date || isNaN(date.getTime())) {
    throw new Error('Nevažeći datum format');
  }
  const year = date.getFullYear();
  if (year < 2000 || year > 2100) {
    throw new Error('Godina mora biti između 2000 i 2100');
  }
  return date;
}

function validateNumericValue(value, fieldName, min = 0, max = 100000) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error(`${fieldName} mora biti broj`);
  }
  if (num < min || num > max) {
    throw new Error(`${fieldName} mora biti između ${min} i ${max}`);
  }
  return num;
}

// Koristi u handleAddSjeca:
function handleAddSjeca(params) {
  try {
    // Validacija
    const odjel = validateUsername(params.odjel); // reuse username validation
    const datum = validateDate(params.datum);

    SORTIMENTI_NAZIVI.slice(0, 17).forEach(sortiment => {
      const value = validateNumericValue(params[sortiment], sortiment, 0, 10000);
      params[sortiment] = value;
    });

    // ... rest of code
  } catch (error) {
    return createJsonResponse({
      error: error.message
    }, false);
  }
}
```

---

### 5. **XSS ZAŠTITA** (Frontend - index.html)

**Problem:** User data se direktno upisuje u HTML

**Rješenje:**

```javascript
// Dodaj escape funkciju u index.html
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Koristi SVUGDJE gdje upisuješ user data:
// LOŠE:
html += `<td>${row.odjel}</td>`;

// DOBRO:
html += `<td>${escapeHtml(row.odjel)}</td>`;

// Ili još bolje - koristi textContent umjesto innerHTML:
const td = document.createElement('td');
td.textContent = row.odjel; // Automatski safe
```

---

### 6. **CACHE TTL** (Frontend - index.html)

**Problem:** Cache nema expiry time, može biti danima star

**Rješenje:**

```javascript
// Izmijeni fetchWithCache funkciju
async function fetchWithCache(url, cacheKey, ttlMinutes = 30) {
  // Check cache
  const cachedStr = localStorage.getItem(cacheKey);
  if (cachedStr) {
    try {
      const cached = JSON.parse(cachedStr);
      const age = Date.now() - (cached.timestamp || 0);
      const maxAge = ttlMinutes * 60 * 1000;

      if (age < maxAge) {
        console.log(`Cache hit: ${cacheKey} (${Math.round(age/1000)}s old)`);
        return cached.data;
      } else {
        console.log(`Cache expired: ${cacheKey} (${Math.round(age/1000)}s old)`);
        localStorage.removeItem(cacheKey);
      }
    } catch (error) {
      localStorage.removeItem(cacheKey);
    }
  }

  // Fetch fresh data
  const response = await fetch(url);
  const data = await response.json();

  // Store with timestamp
  localStorage.setItem(cacheKey, JSON.stringify({
    data: data,
    timestamp: Date.now()
  }));

  return data;
}

// Koristi sa custom TTL:
await fetchWithCache(url, 'cache_dashboard', 15); // 15 min TTL
await fetchWithCache(url, 'cache_primaci', 60);   // 60 min TTL
```

---

## 📋 **PRIORITIZACIJA IMPLEMENTACIJE**

### **FAZA 1 - ODMAH (7 dana):**
1. ✅ Prebaci admin password u PropertiesService (5 min)
2. ✅ Dodaj password hashing za admin (15 min)
3. ✅ Implementiraj token-based auth (2-3h)
4. ✅ Dodaj rate limiting (30 min)
5. ✅ Dodaj cache TTL (30 min)

### **FAZA 2 - USKORO (30 dana):**
1. ✅ Dodaj XSS zaštitu (escapeHtml svugdje) (2h)
2. ✅ Dodaj input validaciju u sve handler funkcije (3h)
3. ✅ Bolji error handling (1h)
4. ✅ Logout funkcionalnost koja invalidira token (30 min)

### **FAZA 3 - NICE TO HAVE (90 dana):**
1. Session management sa server-side storage
2. OAuth 2.0 integration
3. Audit log (ko je šta promijenio)
4. Two-factor authentication (2FA)

---

## 🔧 **DEPLOYMENT UPUTE**

### Kako deploy-ovati izmjene:

1. **Backup trenutnog koda:**
   ```
   - Kopiraj apps-script-code.gs u apps-script-code-backup-DATUM.gs
   - Kopiraj index.html u index-backup-DATUM.html
   ```

2. **Implementiraj izmjene postepeno:**
   - Kreni sa Fazom 1, item po item
   - Testiraj SVAKU izmjenu posebno
   - NE implementiraj sve odjednom!

3. **Testiranje:**
   ```javascript
   // U Apps Script editoru, pokreni:
   function testTokenAuth() {
     const loginResult = handleLogin('testuser', 'testpass');
     Logger.log('Login: ' + loginResult.getContent());

     const data = JSON.parse(loginResult.getContent());
     if (data.success) {
       const token = data.token;
       Logger.log('Token: ' + token);

       // Testiraj token validation
       const username = validateToken(token);
       Logger.log('Validated username: ' + username);
     }
   }
   ```

4. **Deploy:**
   - File > Manage deployments
   - Edit existing deployment
   - New version
   - Deploy

---

## ⚠️ **BREAKING CHANGES**

**VAŽNO:** Token-based auth će prekinuti kompatibilnost sa starim klijentima!

**Migration plan:**
1. Deploy backend sa podrškom za OBA načina (password I token) - 2 sedmice
2. Deploy frontend sa token auth - testiranje
3. Nakon što svi korisnici prebace na novi frontend, ukloni password auth iz backenda

```javascript
// Backend - podržava OBA načina privremeno
function doGet(e) {
  const path = e.parameter.path;

  if (path === 'login') {
    return handleLogin(e.parameter.username, e.parameter.password);
  }

  // Try token first
  const token = e.parameter.token;
  let username = validateToken(token);

  // Fallback to old password auth (PRIVREMENO!)
  if (!username && e.parameter.username && e.parameter.password) {
    const loginResult = JSON.parse(
      handleLogin(e.parameter.username, e.parameter.password).getContent()
    );
    if (loginResult.success) {
      username = loginResult.username;
    }
  }

  if (!username) {
    return createJsonResponse({ error: 'Unauthorized' }, false);
  }

  // ... rest of code
}
```

---

## 📞 **SUPPORT**

Ako imaš pitanja ili probleme sa implementacijom, dokumentuj:
1. Koji korak pokušavaš implementirati
2. Šta si uradio
3. Koja greška se javlja (error message + stack trace)
4. Screenshot ako je moguće

Sretno! 🎯
