# 🎯 ŠUMARIJA - PREPORUKE ZA NOVE FUNKCIONALNOSTI

Bazira na postojećim podacima koje već imate u sistemu.

---

## 📊 **ADVANCED ANALYTICS**

### 1. **TREND ANALYSIS & FORECASTING**

**Šta imate:** Mjesečne podatke za sječu/otpremu po godinama

**Šta možete dodati:**

#### A) Moving Average (Klizni Prosjek)
```javascript
// 3-mjesečni klizni prosjek za glatku trend liniju
function calculateMovingAverage(monthlyData, window = 3) {
  const result = [];
  for (let i = 0; i < monthlyData.length; i++) {
    if (i < window - 1) {
      result.push(null);
      continue;
    }
    const sum = monthlyData.slice(i - window + 1, i + 1)
      .reduce((a, b) => a + b, 0);
    result.push(sum / window);
  }
  return result;
}

// U dashboard-u:
const trend = calculateMovingAverage(mjesecnaSjeca, 3);
// Prikaži kao dodatnu liniju na grafu
```

**UI Prikaz:**
- Originalna linija (plava) + Trend linija (isprekidana)
- "Trend pokazuje rast/pad od X% u odnosu na prošli kvartal"

---

#### B) Year-over-Year Comparison
```javascript
// Uporedi 2025 vs 2024 mjesečno
function calculateYoYComparison(data2025, data2024) {
  return data2025.map((val, idx) => {
    const change = val - data2024[idx];
    const percentChange = ((change / data2024[idx]) * 100).toFixed(1);
    return {
      mjesec: MJESECI[idx],
      current: val,
      previous: data2024[idx],
      change: change,
      percentChange: percentChange,
      trend: change > 0 ? '📈' : (change < 0 ? '📉' : '➡️')
    };
  });
}
```

**UI Prikaz:**
- Tabela: Januar | 2025: 800m³ | 2024: 750m³ | +50m³ (+6.7%) 📈
- Graf: Dve linije (2025 i 2024) na istom grafu za vizualno poređenje

---

#### C) Forecast za Naredne Mjesece
```javascript
// Jednostavna linearna regresija za predikciju
function forecastNextMonths(historicalData, monthsAhead = 3) {
  // Simple linear regression
  const n = historicalData.length;
  const x = Array.from({length: n}, (_, i) => i);
  const y = historicalData;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Predict
  const forecast = [];
  for (let i = n; i < n + monthsAhead; i++) {
    forecast.push(Math.max(0, slope * i + intercept));
  }

  return forecast;
}
```

**UI Prikaz:**
- "Prognoza za naredna 3 mjeseca: 5,200m³, 5,400m³, 5,600m³"
- Graf sa isprekidanom linijom za prognozu

---

### 2. **TOP PERFORMERS DASHBOARD**

**Šta imate:** Podaci o svim primačima/otpremačima sa kubicima

**Šta možete dodati:**

```javascript
// Novi endpoint: top-performers
function handleTopPerformers(year, username) {
  const data = getPrimaciData(year);

  const rankings = {
    topPrimaci: data.primaci
      .sort((a, b) => b.ukupno - a.ukupno)
      .slice(0, 5)
      .map((p, idx) => ({
        rank: idx + 1,
        name: p.primac,
        total: p.ukupno,
        average: (p.ukupno / 12).toFixed(1),
        badge: idx === 0 ? '🏆' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : ''))
      })),

    mostConsistent: findMostConsistent(data.primaci),
    fastestGrowing: findFastestGrowth(data.primaci)
  };

  return createJsonResponse(rankings, true);
}

function findMostConsistent(primaci) {
  // Najmanji standardni deviation = najkonzistentniji
  return primaci.map(p => ({
    name: p.primac,
    stdDev: calculateStdDev(p.mjeseci),
    score: (p.ukupno / calculateStdDev(p.mjeseci)).toFixed(2)
  })).sort((a, b) => b.score - a.score)[0];
}
```

**UI Prikaz:**
- Card: "🏆 Top Primač: Ime Prezime - 8,500m³"
- Podium: 1. 2. 3. sa slikama (opciono)
- "Najkonzistentniji radnik: Ime - 95% konstantnosti"

---

### 3. **RADILIŠTA DEEP DIVE**

**Šta imate:** Radilište (W2) za svaki odjel + svi podaci o sječi

**Šta možete dodati:**

#### A) Cost Analysis po Radilištu (ako dodate cijene)
```javascript
// Dodaj novi sheet: RADILISTA_CIJENE
// Kolone: radiliste | cijena_po_m3 | overhead_cost

function handleRadilisteFinancials(year, username) {
  const cijene = getCijeneRadilista(); // iz novog sheet-a
  const podaci = getPrimaciByRadiliste(year);

  const financials = podaci.radilista.map(r => {
    const cijena = cijene[r.naziv] || 0;
    const prihod = r.ukupno * cijena;
    const troskovi = cijene[r.naziv + '_overhead'] || 0;
    const profit = prihod - troskovi;

    return {
      radiliste: r.naziv,
      kubici: r.ukupno,
      prihod: prihod,
      troskovi: troskovi,
      profit: profit,
      profitMargin: ((profit / prihod) * 100).toFixed(1)
    };
  });

  return createJsonResponse(financials, true);
}
```

**UI Prikaz:**
- Tabela: Radilište | m³ | Prihod | Troškovi | Profit | Margin %
- Graf: Profitabilnost po radilištu (bar chart)
- Alert: "⚠️ Radilište XYZ radi sa gubitkom!"

---

#### B) Resource Utilization (Efficiency Score)
```javascript
// Efikasnost = stvarna sječa / planirana sječa * 100
function calculateRadilisteEfficiency(year) {
  const actual = getPrimaciByRadiliste(year);
  const planned = getPlaniranaSjecaByRadiliste(year); // iz projekat podataka

  return actual.radilista.map(r => {
    const plan = planned[r.naziv] || r.ukupno;
    const efficiency = (r.ukupno / plan * 100).toFixed(1);

    return {
      radiliste: r.naziv,
      planirana: plan,
      realizovana: r.ukupno,
      efficiency: efficiency,
      status: efficiency >= 100 ? '✅ Ispunjeno' :
              efficiency >= 80 ? '⚠️ Na putu' : '❌ Ispod plana'
    };
  });
}
```

**UI Prikaz:**
- Progress bar za svako radilište: 85% ██████████░░
- Boja: zelena (>100%), žuta (80-100%), crvena (<80%)
- Ranking: "Najefikasnije radilište: XYZ (115%)"

---

#### C) Timeline View (Gantt Chart)
```javascript
// Kada je svako radilište bilo aktivno
function getRadilisteTimeline(year) {
  const data = getDetailedPrimkaData(year);

  const timeline = {};

  data.forEach(entry => {
    const radiliste = entry.radiliste;
    const datum = new Date(entry.datum);

    if (!timeline[radiliste]) {
      timeline[radiliste] = {
        firstActivity: datum,
        lastActivity: datum,
        activeDays: new Set()
      };
    }

    timeline[radiliste].activeDays.add(entry.datum);

    if (datum < timeline[radiliste].firstActivity) {
      timeline[radiliste].firstActivity = datum;
    }
    if (datum > timeline[radiliste].lastActivity) {
      timeline[radiliste].lastActivity = datum;
    }
  });

  return Object.keys(timeline).map(r => ({
    radiliste: r,
    start: formatDate(timeline[r].firstActivity),
    end: formatDate(timeline[r].lastActivity),
    daysActive: timeline[r].activeDays.size,
    duration: Math.ceil((timeline[r].lastActivity - timeline[r].firstActivity) / (1000*60*60*24))
  }));
}
```

**UI Prikaz:**
- Gantt chart: Horizontalne trake sa start/end datumom
- "Radilište A: 15.03.2025 - 20.11.2025 (180 aktivnih dana)"

---

### 4. **IZVOĐAČI PERFORMANCE TRACKING**

**Šta imate:** Izvođač radova (W3) za svaki odjel

**Šta možete dodati:**

#### A) Quality Score (Quality Metrics)
```javascript
// Dodaj novi sheet: QUALITY_INCIDENTS
// Kolone: datum | izvodjac | odjel | incident_type | severity

function calculateQualityScore(izvodjac, year) {
  const incidents = getQualityIncidents(izvodjac, year);
  const totalWork = getIzvodjacTotalKubici(izvodjac, year);

  const severeIncidents = incidents.filter(i => i.severity === 'high').length;
  const minorIncidents = incidents.filter(i => i.severity === 'low').length;

  // Scoring: 100 - (severe * 10) - (minor * 2)
  const qualityScore = Math.max(0, 100 - (severeIncidents * 10) - (minorIncidents * 2));

  return {
    izvodjac: izvodjac,
    qualityScore: qualityScore,
    incidentRate: ((incidents.length / totalWork) * 1000).toFixed(2), // per 1000m³
    rating: qualityScore >= 90 ? '⭐⭐⭐⭐⭐' :
            qualityScore >= 80 ? '⭐⭐⭐⭐' :
            qualityScore >= 70 ? '⭐⭐⭐' : '⭐⭐'
  };
}
```

**UI Prikaz:**
- Card: "Quality Score: 85/100 ⭐⭐⭐⭐"
- "Incident Rate: 2.5 per 1000m³"
- "Top Quality Izvođač: XYZ (95/100)"

---

#### B) Productivity Comparison
```javascript
// m³ po danu rada
function compareIzvodjaciProductivity(year) {
  const izvodjaci = getPrimaciByIzvodjac(year);

  return izvodjaci.izvodjaci.map(i => {
    const activeDays = getActiveDays(i.naziv, year);
    const productivity = (i.ukupno / activeDays).toFixed(1);

    return {
      izvodjac: i.naziv,
      total: i.ukupno,
      activeDays: activeDays,
      avgPerDay: productivity,
      rank: 0 // set after sorting
    };
  }).sort((a, b) => parseFloat(b.avgPerDay) - parseFloat(a.avgPerDay))
    .map((i, idx) => ({ ...i, rank: idx + 1 }));
}
```

**UI Prikaz:**
- Tabela: Rank | Izvođač | Avg m³/dan | Total m³ | Active Days
- Bar chart: Horizontal bars za vizualno poređenje
- "Najproduktivniji: XYZ - 45.2 m³/dan"

---

### 5. **SORTIMENT ANALYSIS**

**Šta imate:** 18 različitih sortimenti za svaki unos

**Šta možete dodati:**

#### A) Sortiment Mix Analysis
```javascript
// Koja je raspodijela sortimenti
function analyzeSortimentMix(year) {
  const data = getDetailedPrimkaData(year);

  const sortimenti = {};
  SORTIMENTI_NAZIVI.forEach(s => sortimenti[s] = 0);

  data.forEach(entry => {
    SORTIMENTI_NAZIVI.forEach(s => {
      sortimenti[s] += entry.sortimenti[s] || 0;
    });
  });

  const total = Object.values(sortimenti).reduce((a, b) => a + b, 0);

  return SORTIMENTI_NAZIVI.map(s => ({
    sortiment: s,
    kubici: sortimenti[s],
    percentage: ((sortimenti[s] / total) * 100).toFixed(1),
    category: s.includes('Č') ? 'Četinari' : 'Lišćari'
  })).sort((a, b) => b.kubici - a.kubici);
}
```

**UI Prikaz:**
- Pie chart: Raspodijela sortimenti (%)
- "Dominantan sortiment: CEL.DUGA (23.5%)"
- Tabela: Top 5 sortimenti sa percentima

---

#### B) Seasonal Patterns po Sortimentu
```javascript
// Kada se koji sortiment najviše siječe
function analyzeSortimentSeasonality(sortiment, year) {
  const data = getDetailedPrimkaData(year);

  const monthly = Array(12).fill(0);

  data.forEach(entry => {
    const mjesec = new Date(entry.datum).getMonth();
    monthly[mjesec] += entry.sortimenti[sortiment] || 0;
  });

  const peakMonth = monthly.indexOf(Math.max(...monthly));
  const lowMonth = monthly.indexOf(Math.min(...monthly));

  return {
    sortiment: sortiment,
    monthlyData: monthly,
    peakMonth: MJESECI[peakMonth],
    peakValue: monthly[peakMonth],
    lowMonth: MJESECI[lowMonth],
    lowValue: monthly[lowMonth],
    seasonality: calculateSeasonalityIndex(monthly)
  };
}
```

**UI Prikaz:**
- Line chart: Mjesečna proizvodnja sortimenta
- "CEL.DUGA peak: Juli (850m³)"
- "Lowest: Januar (120m³)"
- "Sezonalnost: Visoka (index: 3.2)"

---

### 6. **KUPAC RELATIONSHIP MANAGEMENT (CRM)**

**Šta imate:** Kupac u INDEX_OTPREMA + sortimenti koje su kupili

**Šta možete dodati:**

#### A) Customer Segmentation
```javascript
// Segmentacija kupaca: Premium, Standard, Low-volume
function segmentCustomers(year) {
  const kupci = getKupciData(year);

  return kupci.godisnji.map(k => {
    const segment =
      k.ukupno > 5000 ? 'Premium' :
      k.ukupno > 1000 ? 'Standard' : 'Low-volume';

    const preferredSortiment = Object.keys(k.sortimenti)
      .reduce((a, b) => k.sortimenti[a] > k.sortimenti[b] ? a : b);

    return {
      kupac: k.kupac,
      total: k.ukupno,
      segment: segment,
      preferredSortiment: preferredSortiment,
      avgOrderSize: (k.ukupno / k.orderCount).toFixed(1),
      frequency: k.orderCount
    };
  });
}
```

**UI Prikaz:**
- Pie chart: Distribution (Premium 15%, Standard 45%, Low-volume 40%)
- Cards: "Premium Kupci: 5 | Ukupno: 45,000m³"
- Lista: Top kupci sa badge-ovima (💎 Premium, ⭐ Standard)

---

#### B) Customer Preferences Analysis
```javascript
// Šta koji kupac preferira
function analyzeCustomerPreferences(kupac, year) {
  const orders = getKupacOrders(kupac, year);

  const sortimentiPreference = {};
  SORTIMENTI_NAZIVI.forEach(s => sortimentiPreference[s] = 0);

  orders.forEach(order => {
    SORTIMENTI_NAZIVI.forEach(s => {
      sortimentiPreference[s] += order.sortimenti[s] || 0;
    });
  });

  return {
    kupac: kupac,
    preferences: Object.keys(sortimentiPreference)
      .sort((a, b) => sortimentiPreference[b] - sortimentiPreference[a])
      .slice(0, 5)
      .map(s => ({
        sortiment: s,
        quantity: sortimentiPreference[s],
        percentage: ((sortimentiPreference[s] / orders.total) * 100).toFixed(1)
      }))
  };
}
```

**UI Prikaz:**
- "Kupac XYZ preferira: CEL.DUGA (45%), I Č (25%), F/L Č (15%)"
- Bar chart: Top 5 sortimenti za kupca
- Recommendation: "Ovaj kupac bi mogao biti zainteresovan za: TRUPCI Č"

---

#### C) Delivery Schedule Optimization
```javascript
// Optimizuj dostavu na osnovu istorijskih pattern-a
function optimizeDeliverySchedule(kupac, year) {
  const orders = getKupacOrders(kupac, year);

  // Analiza kada kupac obično naručuje
  const ordersByDay = {};
  orders.forEach(order => {
    const dayOfWeek = new Date(order.datum).getDay();
    ordersByDay[dayOfWeek] = (ordersByDay[dayOfWeek] || 0) + 1;
  });

  const preferredDays = Object.keys(ordersByDay)
    .sort((a, b) => ordersByDay[b] - ordersByDay[a])
    .slice(0, 2)
    .map(d => DAYS_OF_WEEK[d]);

  return {
    kupac: kupac,
    preferredDays: preferredDays,
    avgLeadTime: calculateAvgLeadTime(orders),
    recommendation: `Zakažite dostave ${preferredDays.join(' i ')}`
  };
}
```

**UI Prikaz:**
- "Recommended delivery days: Utorak i Četvrtak"
- "Average lead time: 3 dana"
- Calendar view: Mark preferred days

---

## 🎨 **UI/UX IMPROVEMENTS**

### 7. **ADVANCED FILTERING & SEARCH**

```javascript
// Multi-column filter sa kombinacijama
const filters = {
  dateRange: { from: '01.01.2025', to: '31.12.2025' },
  primac: 'Ime Prezime',
  odjel: ['57a', '57b', '58a'],
  sortiment: 'CEL.DUGA',
  minKubik: 50,
  maxKubik: 500,
  radiliste: 'Radilište A'
};

function advancedFilter(data, filters) {
  return data.filter(entry => {
    // Date range
    if (filters.dateRange) {
      const date = parseDate(entry.datum);
      if (date < parseDate(filters.dateRange.from) ||
          date > parseDate(filters.dateRange.to)) {
        return false;
      }
    }

    // Multi-select odjel
    if (filters.odjel && filters.odjel.length > 0) {
      if (!filters.odjel.includes(entry.odjel)) return false;
    }

    // Numeric range
    if (filters.minKubik && entry.ukupno < filters.minKubik) return false;
    if (filters.maxKubik && entry.ukupno > filters.maxKubik) return false;

    // ... ostale filter conditions

    return true;
  });
}
```

**UI Prikaz:**
- Filter panel: Collapsible sidebar ili modal
- Date range picker: From/To kalendari
- Multi-select dropdown: Odjeli, Radilišta
- Range sliders: Min/Max kubici
- "Save filter preset" opcija

---

### 8. **EXPORT IMPROVEMENTS**

#### A) Excel Export sa Formatting
```javascript
// Umjesto CSV, export u Excel format
function exportToExcel(data, sheetName) {
  // Koristi library kao SheetJS (xlsx)
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Styling
  ws['!cols'] = [
    { width: 15 }, // Datum
    { width: 20 }, // Primač
    { width: 10 }, // Kubici
    // ...
  ];

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `Izvjestaj_${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
```

---

#### B) PDF Reports sa Charts
```javascript
// Generate PDF sa grafovima i logo-m
function generatePDFReport(data, options) {
  // Koristi jsPDF + html2canvas
  const doc = new jsPDF();

  // Header sa logo-m
  doc.addImage(companyLogo, 'PNG', 10, 10, 30, 30);
  doc.setFontSize(20);
  doc.text('Šumarija Krupa - Mjesečni Izvještaj', 50, 25);

  // Dodaj chart kao sliku
  const chartCanvas = document.getElementById('chart');
  const chartImage = chartCanvas.toDataURL('image/png');
  doc.addImage(chartImage, 'PNG', 10, 50, 190, 100);

  // Dodaj tabelu
  doc.autoTable({
    startY: 160,
    head: [['Primač', 'Kubici', 'Odjel']],
    body: data.map(d => [d.primac, d.ukupno, d.odjel])
  });

  doc.save(`Izvjestaj_${new Date().toISOString().split('T')[0]}.pdf`);
}
```

---

### 9. **NOTIFICATIONS & ALERTS**

```javascript
// Email notifications za važne evente
function sendEmailNotification(to, subject, body) {
  // U Apps Script:
  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: body
  });
}

// Automated alerts
function checkThresholds() {
  const danas = new Date();
  const mjesec = danas.getMonth();

  const sjeca = getMjesecnaSjeca(mjesec);
  const plan = DINAMIKA_2025[mjesec];

  if (sjeca < plan * 0.8) { // Ispod 80% plana
    sendEmailNotification(
      'admin@sumarija.ba',
      '⚠️ Alert: Sječa ispod plana',
      `Trenutna sječa za ${MJESECI[mjesec]}: ${sjeca}m³ (plan: ${plan}m³)`
    );
  }
}

// Trigger: Svaki dan u 18:00
// Tools > Script editor > Edit > Current project's triggers
```

---

### 10. **MOBILE PROGRESSIVE WEB APP (PWA)**

```html
<!-- manifest.json -->
{
  "name": "Šumarija Krupa",
  "short_name": "Šumarija",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#047857",
  "theme_color": "#047857",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

```javascript
// Service Worker za offline mode
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Registruj service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

**Features:**
- Instalacija kao native app na telefonu
- Offline mode: Radi bez interneta, sync kasnije
- Push notifications
- Camera integration: Slikaj dokumente direktno u app-u
- GPS tagging: Automatski location tag za unose

---

## 📅 **IMPLEMENTATION ROADMAP**

### **Q1 2026 (Januar - Mart):**
✅ Sigurnosni fixes (Token auth, Rate limiting)
✅ Trend analysis (Moving average, YoY)
✅ Top performers dashboard
✅ Advanced filtering

### **Q2 2026 (April - Jun):**
✅ Radilišta analytics
✅ Izvođači performance tracking
✅ Sortiment analysis
✅ Excel/PDF export

### **Q3 2026 (Juli - Septembar):**
✅ CRM features (Customer segmentation)
✅ Email notifications
✅ Forecasting

### **Q4 2026 (Oktobar - Decembar):**
✅ Mobile PWA
✅ Advanced collaboration features
✅ Audit log

---

## 💰 **ROI (Return on Investment)**

**Vremenska ušteda:**
- Advanced filtering: -30 min/dan = 10h/mjesec
- Automated reports: -2h/sedmica = 8h/mjesec
- Email notifications: -1h/sedmica = 4h/mjesec
- **TOTAL: 22h/mjesec = $500-1000/mjesec u uštedi**

**Bolje odluke:**
- Trend analysis → Bolje planiranje
- Quality tracking → Manje problema
- Efficiency score → Optimizacija resursa
- **Estimated benefit: 5-10% productivity increase = $2000-5000/mjesec**

**Total ROI: $2500-6000/mjesec**

---

Sretno sa implementacijom! 🚀
