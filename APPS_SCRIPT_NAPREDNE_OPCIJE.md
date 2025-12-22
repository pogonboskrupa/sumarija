# Napredne opcije i optimizacije

## 🚀 Performance optimizacije

### 1. Caching za brže učitavanje

```javascript
// Dodaj na početak Code.gs
const CACHE_DURATION = 300; // 5 minuta

function handleStats(year, username, password) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `stats_${year}_${username}`;

  // Provjeri cache
  const cached = cache.get(cacheKey);
  if (cached) {
    return createJsonResponse(JSON.parse(cached), true);
  }

  // ... existing code ...

  // Sačuvaj u cache
  cache.put(cacheKey, JSON.stringify(stats), CACHE_DURATION);

  return createJsonResponse(stats, true);
}
```

### 2. Batch čitanje podataka

Umjesto `getDataRange()`, koristi specifične range-ove:

```javascript
function processPrimkaData(primkaSheet, stats, year) {
  // Čitaj samo potrebne kolone
  const lastRow = primkaSheet.getLastRow();

  // Samo kolone A, B, K (datum, odjel, kubik)
  const data = primkaSheet.getRange(2, 1, lastRow - 1, 11).getValues();

  for (let i = 0; i < data.length; i++) {
    const datum = data[i][0];
    const odjel = data[i][1];
    const kubik = parseFloat(data[i][10]) || 0;
    // ... rest of processing
  }
}
```

---

## 🔐 Poboljšana sigurnost

### 1. Hash passwords (SHA-256)

```javascript
// Umjesto plain text passworda
function handleLogin(username, password) {
  const hashedPassword = hashPassword(password);

  // ... provjera sa hashedPassword u bazi
}

function hashPassword(password) {
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password
  );

  return rawHash.map(byte => {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}
```

### 2. Rate limiting

```javascript
const MAX_REQUESTS_PER_HOUR = 100;

function checkRateLimit(username) {
  const cache = CacheService.getScriptCache();
  const key = `ratelimit_${username}`;
  const count = parseInt(cache.get(key) || '0');

  if (count >= MAX_REQUESTS_PER_HOUR) {
    throw new Error('Previše zahtjeva. Pokušajte kasnije.');
  }

  cache.put(key, (count + 1).toString(), 3600); // 1 sat
}
```

---

## 📊 Dodatne statistike

### 1. Top 5 odjela po sječi

```javascript
function getTopOdjeli(odjeliStats, limit = 5) {
  return Object.entries(odjeliStats)
    .sort((a, b) => b[1].sječa - a[1].sječa)
    .slice(0, limit)
    .map(([odjel, stats]) => ({
      odjel: odjel,
      sječa: stats.sječa
    }));
}

// U handleStats funkciji
stats.topOdjeli = getTopOdjeli(stats.odjeliStats);
```

### 2. Prosječna dnevna sječa

```javascript
function calculateDailyAverage(monthlyStats) {
  const totalDays = new Date().getDate(); // dana u trenutnom mjesecu
  const currentMonth = new Date().getMonth();
  const currentMonthSjeca = monthlyStats[currentMonth].sječa;

  return {
    dnevniProsjek: (currentMonthSjeca / totalDays).toFixed(2),
    projekcijaMjesec: (currentMonthSjeca / totalDays * 30).toFixed(2)
  };
}
```

### 3. Procenat ispunjenja po mjesecima

```javascript
function calculateMonthlyCompletion(monthlyStats) {
  // Pretpostavljeni mjesečni cilj
  const mjesecniCilj = 1000; // prilagodi

  return monthlyStats.map(m => ({
    ...m,
    procenat: ((m.sječa / mjesecniCilj) * 100).toFixed(1),
    ispunjenCilj: m.sječa >= mjesecniCilj
  }));
}
```

---

## 📅 Filtriranje po datumu

```javascript
function handleStatsWithDateRange(startDate, endDate, username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const primkaSheet = ss.getSheetByName('PRIMKA');

  const data = primkaSheet.getDataRange().getValues();
  const start = new Date(startDate);
  const end = new Date(endDate);

  const filtered = data.filter(row => {
    const datum = new Date(row[0]);
    return datum >= start && datum <= end;
  });

  // Process filtered data...
}

// U doGet dodaj:
if (path === 'stats-range') {
  return handleStatsWithDateRange(
    e.parameter.startDate,
    e.parameter.endDate,
    e.parameter.username,
    e.parameter.password
  );
}
```

---

## 🔍 Detaljni logs

```javascript
function logRequest(username, path, params) {
  const logSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('API_LOGS');

  if (!logSheet) return;

  logSheet.appendRow([
    new Date(),
    username,
    path,
    JSON.stringify(params),
    Session.getActiveUser().getEmail()
  ]);
}

// U doGet funkciji
function doGet(e) {
  logRequest(e.parameter.username, e.parameter.path, e.parameter);
  // ... rest of code
}
```

---

## 📱 Push notifikacije (Email)

```javascript
function sendDailySummary() {
  const stats = handleStats(new Date().getFullYear(), 'admin', 'adminpass');
  const statsData = JSON.parse(stats.getContent());

  const emailBody = `
    Dnevni izvještaj - ${new Date().toLocaleDateString()}

    Ukupna sječa: ${statsData.totalPrimka} m³
    Ukupna otprema: ${statsData.totalOtprema} m³
    Razlika: ${(statsData.totalPrimka - statsData.totalOtprema).toFixed(2)} m³
  `;

  MailApp.sendEmail({
    to: 'admin@example.com',
    subject: 'Šumarija - Dnevni izvještaj',
    body: emailBody
  });
}

// Postavi trigger: Edit > Current project's triggers
// Add trigger: sendDailySummary, Time-driven, Day timer, 8am-9am
```

---

## 🔄 Automatski backup

```javascript
function createDailyBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const backupFolder = DriveApp.getFolderById('FOLDER_ID'); // tvoj folder ID

  const today = Utilities.formatDate(new Date(), 'GMT+1', 'yyyy-MM-dd');
  const fileName = `Sumarija_Backup_${today}`;

  ss.copy(fileName);
  const file = DriveApp.getFilesByName(fileName).next();
  backupFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
}

// Postavi trigger za svaki dan u 23:00
```

---

## 📊 Export u Excel/CSV

```javascript
function exportToExcel(data) {
  const ss = SpreadsheetApp.create('Export_' + new Date().getTime());
  const sheet = ss.getActiveSheet();

  // Headers
  sheet.appendRow(['Odjel', 'Sječa', 'Otprema', 'Razlika']);

  // Data
  Object.entries(data.odjeliStats).forEach(([odjel, stats]) => {
    sheet.appendRow([
      odjel,
      stats.sječa,
      stats.otprema,
      stats.sječa - stats.otprema
    ]);
  });

  // Return download link
  return ss.getUrl();
}

// U doGet dodaj path='export'
```

---

## 🎯 Napredni primjeri

### Multi-year comparison

```javascript
function compareYears(year1, year2, username, password) {
  const stats1 = JSON.parse(handleStats(year1, username, password).getContent());
  const stats2 = JSON.parse(handleStats(year2, username, password).getContent());

  return {
    year1: { year: year1, total: stats1.totalPrimka },
    year2: { year: year2, total: stats2.totalPrimka },
    difference: stats2.totalPrimka - stats1.totalPrimka,
    percentChange: ((stats2.totalPrimka - stats1.totalPrimka) / stats1.totalPrimka * 100).toFixed(2)
  };
}
```

### Predviđanje trendova

```javascript
function predictTrend(monthlyStats) {
  // Jednostavna linearna regresija
  const n = monthlyStats.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  monthlyStats.forEach((m, i) => {
    sumX += i;
    sumY += m.sječa;
    sumXY += i * m.sječa;
    sumXX += i * i;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Predviđanje za sljedeća 3 mjeseca
  return [1, 2, 3].map(i => ({
    mjesec: i,
    predikcija: (slope * (n + i) + intercept).toFixed(2)
  }));
}
```

---

## ⚡ Best practices

1. **Koristi batch operations** - čitaj podatke u jednom pozivu
2. **Cache često korištene podatke** - smanji broj čitanja
3. **Validiraj input** - provjeri sve parametre
4. **Loguj greške** - za lakši debugging
5. **Optimizuj querije** - čitaj samo potrebne kolone
6. **Koristi try-catch** - uhvati sve greške
7. **Rate limiting** - zaštiti od abuse-a
8. **Version control** - čuvaj stare verzije
