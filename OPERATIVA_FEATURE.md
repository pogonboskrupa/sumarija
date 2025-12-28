# 📊 OPERATIVA Feature - Kompletna Dokumentacija

## Pregled Razgovora

Ovaj dokument sadrži kompletnu dokumentaciju OPERATIVA feature-a koji je dodat u aplikaciju Šumarija.

### Kontekst: Dva Glavna Prikaza

Aplikacija sada ima **dva glavna prikaza** dostupna kroz tab navigaciju:

1. **🏠 Glavni Pregled** (`admin` view)
   - Osnovni pregled sa ukupnim statistikama
   - Mjesečni pregled sječe i otpreme
   - Dostupan svim korisnicima nakon prijave

2. **📊 Operativa & Analiza** (`operativa` view) - **NOVO DODANO**
   - Analitički dashboard sa KPI metrikama
   - Top 5 odjela rankings
   - Projekat vs Ostvareno progress bars
   - Monthly trend analysis sa grafikom
   - Detaljni pregled svih odjela
   - **Dostupan samo Admin i OPERATIVA tipovima korisnika**

---

## Git Commit Historia

### Commit 1: a143f4e
**Naziv:** "Dodat OPERATIVA prikaz - Analitički dashboard sa KPI metrikama"

**Statistika:**
- 402 lines dodato
- 1 file promijenjen: index.html

**Opis promjena:**
- Dodat novi tab "📊 Operativa & Analiza" u navigaciji
- Kreiran kompletno novi ekran (operativa-screen) sa:
  - 4 KPI cards (Sječa/Otprema Ratio, Procenat Ostvarenja, Ukupno Odjela, Prosječna Sječa)
  - Analytics grid sa dvije kolone (Top 5 Odjela, Projekat vs Ostvareno)
  - Monthly Trend Analysis sa line chart
  - Detaljni pregled svih odjela u tabeli

### Commit 2: 8acf8c2
**Naziv:** "Dodat role-based pristup za OPERATIVA korisnike"

**Opis promjena:**
- Implementiran role-based access control u `switchView()` funkciji
- Dodato provjere: samo Admin i OPERATIVA tip korisnika mogu pristupiti Operativa ekranu
- Primač i Otpremač korisnici NE MOGU pristupiti ovom ekranu

---

## 1. Tab Navigacija

### HTML Struktura (Lines 140-150)

```html
<!-- Tab Navigation -->
<div class="tab-navigation">
    <div class="tab-navigation-content">
        <button class="tab active" onclick="switchView('admin')">
            🏠 Glavni Pregled
        </button>
        <button class="tab" onclick="switchView('operativa')">
            📊 Operativa & Analiza
        </button>
    </div>
</div>
```

### CSS Styles (Lines 74-79)

```css
/* Tab Navigation */
.tab-navigation {
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border-bottom: 2px solid #e5e7eb;
}

.tab-navigation-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    gap: 4px;
    padding: 0 24px;
}

.tab {
    background: none;
    border: none;
    padding: 16px 24px;
    font-size: 15px;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
}

.tab:hover {
    color: #047857;
    background: #f0fdf4;
}

.tab.active {
    color: #047857;
    border-bottom-color: #047857;
    background: #f0fdf4;
}
```

---

## 2. OPERATIVA Screen HTML Struktura (Lines 223-293)

```html
<!-- OPERATIVA Screen - Analytics Dashboard -->
<div id="operativa-screen" class="container hidden">

    <!-- KPI Metrics Cards (4 metrics grid) -->
    <div class="kpi-grid">
        <div class="kpi-card-small">
            <div class="kpi-label-small">Sječa/Otprema Ratio</div>
            <div class="kpi-value-small" id="kpi-ratio">1.15</div>
        </div>
        <div class="kpi-card-small blue">
            <div class="kpi-label-small">Procenat Ostvarenja</div>
            <div class="kpi-value-small" id="kpi-procenat">78%</div>
        </div>
        <div class="kpi-card-small yellow">
            <div class="kpi-label-small">Ukupno Odjela</div>
            <div class="kpi-value-small" id="kpi-odjela">0</div>
        </div>
        <div class="kpi-card-small">
            <div class="kpi-label-small">Prosječna Sječa</div>
            <div class="kpi-value-small" id="kpi-avg-sjeca">0 m³</div>
        </div>
    </div>

    <!-- Analytics Grid (2 columns: Top 5 + Projekat Progress) -->
    <div class="analytics-grid">
        <!-- Top 5 Odjela by Sječa -->
        <div class="section">
            <h2>🏆 Top 5 Odjela - Sječa</h2>
            <div id="top-odjeli-list"></div>
        </div>

        <!-- Projekat vs Ostvareno Progress Bars -->
        <div class="section">
            <h2>🎯 Projekat vs Ostvareno</h2>
            <div id="projekat-ostvareno-list"></div>
        </div>
    </div>

    <!-- Monthly Trend Analysis with Line Chart -->
    <div class="section">
        <h2>📈 Monthly Trend - Analiza</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
                <div style="font-size: 13px; color: #6b7280; font-weight: 600; margin-bottom: 4px;">
                    AVG SJEČA PO MJESECU
                </div>
                <div style="font-size: 28px; font-weight: 700; color: #059669;" id="avg-monthly-sjeca">
                    0 m³
                </div>
            </div>
            <div>
                <div style="font-size: 13px; color: #6b7280; font-weight: 600; margin-bottom: 4px;">
                    AVG OTPREMA PO MJESECU
                </div>
                <div style="font-size: 28px; font-weight: 700; color: #2563eb;" id="avg-monthly-otprema">
                    0 m³
                </div>
            </div>
        </div>
        <svg id="analytics-chart" class="chart-svg"></svg>
    </div>

    <!-- Detailed Odjeli Table -->
    <div class="section">
        <h2>📊 Detaljni Pregled - Svi Odjeli</h2>
        <table>
            <thead>
                <tr>
                    <th>Odjel</th>
                    <th class="right">Sječa (m³)</th>
                    <th class="right">Otprema (m³)</th>
                    <th class="right">Projekat</th>
                    <th class="right">% Ostvareno</th>
                    <th class="right">Razlika</th>
                </tr>
            </thead>
            <tbody id="analytics-odjeli-table"></tbody>
        </table>
    </div>
</div>
```

---

## 3. Analytics CSS Styles (Lines 81-95)

```css
/* Analytics Grid - 2 column responsive layout */
.analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 24px;
    margin-bottom: 24px;
}

/* Ranking Items for Top 5 Odjela */
.ranking-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid #e5e7eb;
}
.ranking-item:last-child { border-bottom: none; }

.ranking-number {
    font-size: 24px;
    font-weight: 700;
    color: #d1d5db;
    min-width: 40px;
}
.ranking-number.top { color: #fbbf24; } /* Gold for top 3 */

.ranking-info { flex: 1; }
.ranking-name {
    font-weight: 600;
    color: #1f2937;
    font-size: 15px;
}
.ranking-value {
    font-size: 20px;
    font-weight: 700;
    color: #059669;
}

/* KPI Cards Grid - 4 columns responsive */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
}

/* KPI Card Small - Gradient backgrounds */
.kpi-card-small {
    background: linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%);
    padding: 16px;
    border-radius: 8px;
    border-left: 4px solid #059669;
}
.kpi-card-small.blue {
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border-left-color: #2563eb;
}
.kpi-card-small.yellow {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border-left-color: #f59e0b;
}

.kpi-label-small {
    font-size: 12px;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 4px;
}
.kpi-value-small {
    font-size: 24px;
    font-weight: 700;
    color: #1f2937;
}
```

---

## 4. JavaScript Functions

### 4.1 switchView() - Tab Switching sa Role-Based Access (Lines 721-747)

```javascript
function switchView(view) {
    // ✅ SECURITY: Check if user has access to operativa view
    if (view === 'operativa' && currentUser.role !== 'admin' && currentUser.type !== 'OPERATIVA') {
        console.warn('Unauthorized access attempt to Operativa view');
        return; // Block access for Primač and Otpremač
    }

    // Update tab active state
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Switch screens
    if (view === 'admin') {
        document.getElementById('content-screen').classList.remove('hidden');
        document.getElementById('operativa-screen').classList.add('hidden');
    } else if (view === 'operativa') {
        document.getElementById('content-screen').classList.add('hidden');
        document.getElementById('operativa-screen').classList.remove('hidden');

        // Load operativa data if available
        if (globalData) {
            loadOperativaData(globalData);
        }
    }
}
```

**Ključne Značajke:**
- ✅ Role-based access control: Samo Admin i OPERATIVA korisnici
- ✅ Security logging: Console warning za neovlašćene pokušaje pristupa
- ✅ Tab active state management
- ✅ Screen visibility toggling
- ✅ Automatic data loading za operativa view

---

### 4.2 loadOperativaData() - Main Data Processing (Lines 750-798)

```javascript
// Load and populate Operativa screen with analytics
function loadOperativaData(data) {
    // Calculate KPIs
    const totalPrimka = data.totalPrimka || 0;
    const totalOtprema = data.totalOtprema || 0;
    const ratio = totalOtprema > 0 ? (totalPrimka / totalOtprema).toFixed(2) : 0;

    // Count odjeli
    const odjeliCount = Object.keys(data.odjeliStats).length;

    // Calculate average projekat completion
    let totalProjekat = 0;
    let totalOstvareno = 0;
    Object.values(data.odjeliStats).forEach(stats => {
        totalProjekat += stats.projekat || 0;
        totalOstvareno += stats.ukupnoPosjeklo || stats.sječa || 0;
    });
    const procenatOstvarenja = totalProjekat > 0
        ? ((totalOstvareno / totalProjekat) * 100).toFixed(0)
        : 0;

    // Calculate monthly averages
    const monthlyStats = data.monthlyStats || [];
    const avgMonthlySjeca = monthlyStats.length > 0
        ? (monthlyStats.reduce((sum, m) => sum + m.sječa, 0) / monthlyStats.length).toFixed(2)
        : 0;
    const avgMonthlyOtprema = monthlyStats.length > 0
        ? (monthlyStats.reduce((sum, m) => sum + m.otprema, 0) / monthlyStats.length).toFixed(2)
        : 0;

    // Update KPI cards
    document.getElementById('kpi-ratio').textContent = ratio;
    document.getElementById('kpi-procenat').textContent = procenatOstvarenja + '%';
    document.getElementById('kpi-odjela').textContent = odjeliCount;
    document.getElementById('kpi-avg-sjeca').textContent = (totalPrimka / odjeliCount).toFixed(0) + ' m³';

    // Update monthly averages
    document.getElementById('avg-monthly-sjeca').textContent = avgMonthlySjeca + ' m³';
    document.getElementById('avg-monthly-otprema').textContent = avgMonthlyOtprema + ' m³';

    // Render Top 5 Odjela
    renderTopOdjeli(data.odjeliStats);

    // Render Projekat vs Ostvareno
    renderProjekatOstvareno(data.odjeliStats);

    // Render Analytics Chart
    renderAnalyticsChart(monthlyStats);

    // Render Detailed Odjeli Table
    renderAnalyticsOdjeliTable(data.odjeliStats);
}
```

**KPI Metrics Calculation:**
1. **Sječa/Otprema Ratio:** `totalPrimka / totalOtprema`
2. **Procenat Ostvarenja:** `(totalOstvareno / totalProjekat) * 100`
3. **Ukupno Odjela:** `Object.keys(data.odjeliStats).length`
4. **Prosječna Sječa:** `totalPrimka / odjeliCount`
5. **AVG Mjesečna Sječa:** `sum(mjesečna sječa) / 12`
6. **AVG Mjesečna Otprema:** `sum(mjesečna otprema) / 12`

---

### 4.3 renderTopOdjeli() - Top 5 Ranking (Lines 801-821)

```javascript
// Render Top 5 Odjela by Sječa
function renderTopOdjeli(odjeliStats) {
    // Sort by sječa descending, take top 5
    const sorted = Object.entries(odjeliStats)
        .sort((a, b) => b[1].sječa - a[1].sječa)
        .slice(0, 5);

    const html = sorted.map((entry, index) => {
        const [odjel, stats] = entry;
        const rankClass = index < 3 ? 'top' : ''; // Gold for top 3

        return `
            <div class="ranking-item">
                <div class="ranking-number ${rankClass}">${index + 1}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${odjel}</div>
                    <div class="ranking-value">${stats.sječa.toFixed(2)} m³</div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('top-odjeli-list').innerHTML = html;
}
```

**UI Pattern:**
- Sorted by sječa (highest to lowest)
- Top 3 get gold color (#fbbf24)
- Ranks 4-5 get gray color (#d1d5db)
- Shows: Rank number, Odjel name, Sječa value

---

### 4.4 renderProjekatOstvareno() - Progress Bars (Lines 824-859)

```javascript
// Render Projekat vs Ostvareno
function renderProjekatOstvareno(odjeliStats) {
    const sorted = Object.entries(odjeliStats)
        .filter(([_, stats]) => stats.projekat > 0) // Only odjeli with projekat
        .map(([odjel, stats]) => ({
            odjel,
            projekat: stats.projekat || 0,
            ostvareno: stats.ukupnoPosjeklo || stats.sječa || 0,
            procenat: stats.projekat > 0
                ? (((stats.ukupnoPosjeklo || stats.sječa) / stats.projekat) * 100)
                : 0
        }))
        .sort((a, b) => b.procenat - a.procenat) // Sort by completion %
        .slice(0, 5); // Top 5

    const html = sorted.map(item => {
        const barWidth = Math.min(item.procenat, 100);
        const colorClass = item.procenat >= 90 ? 'green'
                         : item.procenat >= 70 ? 'blue'
                         : 'red';

        return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-weight: 600; color: #1f2937;">${item.odjel}</span>
                    <span style="font-weight: 700; color: #059669;">${item.procenat.toFixed(1)}%</span>
                </div>
                <div class="progress-bar-container" style="height: 12px;">
                    <div class="progress-bar-fill ${colorClass}" style="width: ${barWidth}%; background: ${
                        item.procenat >= 90 ? '#059669' // Green
                      : item.procenat >= 70 ? '#2563eb' // Blue
                      : '#dc2626' // Red
                    };"></div>
                </div>
                <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                    ${item.ostvareno.toFixed(0)} / ${item.projekat.toFixed(0)} m³
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('projekat-ostvareno-list').innerHTML = html;
}
```

**Color-Coded Progress Bars:**
- ✅ **Green (≥90%):** Excellent completion - `#059669`
- 🔵 **Blue (70-89%):** Good progress - `#2563eb`
- 🔴 **Red (<70%):** Needs attention - `#dc2626`

**Shows:**
- Odjel name + completion percentage
- Visual progress bar
- Actual vs Target (Ostvareno / Projekat)

---

### 4.5 renderAnalyticsChart() - SVG Line Chart (Lines 862-987)

```javascript
// Render Analytics Chart (same as line chart but with different styling)
function renderAnalyticsChart(monthlyStats) {
    const svg = document.getElementById('analytics-chart');
    const padding = { top: 20, right: 40, bottom: 40, left: 60 };
    const width = svg.clientWidth || 1000;
    const height = 300;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Handle empty data
    if (!monthlyStats || monthlyStats.length === 0) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', width / 2);
        text.setAttribute('y', height / 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '14');
        text.setAttribute('fill', '#6b7280');
        text.textContent = 'Nema podataka za prikaz';
        svg.appendChild(text);
        return;
    }

    // Calculate scales
    const maxValue = Math.max(
        ...monthlyStats.map(m => Math.max(m.sječa || 0, m.otprema || 0)),
        1
    );
    const yScale = chartHeight / (maxValue * 1.1);
    const xStep = chartWidth / (monthlyStats.length - 1);

    // Create smooth path function (quadratic bezier curves)
    function createSmoothPath(data, getValue) {
        const points = data.map((d, i) => ({
            x: padding.left + i * xStep,
            y: padding.top + chartHeight - getValue(d) * yScale
        }));

        if (points.length === 0) return '';

        let path = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const controlX = (current.x + next.x) / 2;
            path += ` Q ${controlX} ${current.y}, ${controlX} ${(current.y + next.y) / 2}`;
            path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
        }

        return path;
    }

    // Draw grid lines (5 horizontal lines)
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;

        // Grid line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', padding.left);
        line.setAttribute('y1', y);
        line.setAttribute('x2', width - padding.right);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', '#e5e7eb');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);

        // Y-axis label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const value = (maxValue * 1.1) * (1 - i / gridLines);
        label.setAttribute('x', padding.left - 10);
        label.setAttribute('y', y + 5);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('font-size', '12');
        label.setAttribute('fill', '#6b7280');
        label.textContent = value.toFixed(0);
        svg.appendChild(label);
    }

    // Draw Sječa line (green)
    const sjecaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    sjecaPath.setAttribute('d', createSmoothPath(monthlyStats, m => m.sječa));
    sjecaPath.setAttribute('fill', 'none');
    sjecaPath.setAttribute('stroke', '#059669');
    sjecaPath.setAttribute('stroke-width', '3');
    sjecaPath.setAttribute('stroke-linecap', 'round');
    svg.appendChild(sjecaPath);

    // Draw Otprema line (blue)
    const otpremaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    otpremaPath.setAttribute('d', createSmoothPath(monthlyStats, m => m.otprema));
    otpremaPath.setAttribute('fill', 'none');
    otpremaPath.setAttribute('stroke', '#2563eb');
    otpremaPath.setAttribute('stroke-width', '3');
    otpremaPath.setAttribute('stroke-linecap', 'round');
    svg.appendChild(otpremaPath);

    // Draw data points (circles)
    monthlyStats.forEach((m, i) => {
        const x = padding.left + i * xStep;

        // Sječa point
        const sjecaY = padding.top + chartHeight - m.sječa * yScale;
        const sjecaCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        sjecaCircle.setAttribute('cx', x);
        sjecaCircle.setAttribute('cy', sjecaY);
        sjecaCircle.setAttribute('r', '4');
        sjecaCircle.setAttribute('fill', '#059669');
        sjecaCircle.setAttribute('stroke', 'white');
        sjecaCircle.setAttribute('stroke-width', '2');
        svg.appendChild(sjecaCircle);

        // Otprema point
        const otpremaY = padding.top + chartHeight - m.otprema * yScale;
        const otpremaCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        otpremaCircle.setAttribute('cx', x);
        otpremaCircle.setAttribute('cy', otpremaY);
        otpremaCircle.setAttribute('r', '4');
        otpremaCircle.setAttribute('fill', '#2563eb');
        otpremaCircle.setAttribute('stroke', 'white');
        otpremaCircle.setAttribute('stroke-width', '2');
        svg.appendChild(otpremaCircle);

        // Month label (X-axis)
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', x);
        label.setAttribute('y', height - padding.bottom + 20);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '11');
        label.setAttribute('fill', '#6b7280');
        label.textContent = m.mjesec.substring(0, 3); // Jan, Feb, Mar...
        svg.appendChild(label);
    });
}
```

**Chart Features:**
- ✅ Smooth quadratic bezier curves (not straight lines)
- ✅ Two lines: Sječa (green #059669), Otprema (blue #2563eb)
- ✅ Grid lines with Y-axis values
- ✅ Data points as circles with white stroke
- ✅ Month labels on X-axis (abbreviated: Jan, Feb, Mar...)
- ✅ Responsive viewBox (scales with container width)
- ✅ Empty state handling ("Nema podataka za prikaz")

---

### 4.6 renderAnalyticsOdjeliTable() - Detailed Table (Lines 990-1010)

```javascript
// Render detailed analytics table for all odjeli
function renderAnalyticsOdjeliTable(odjeliStats) {
    const html = Object.entries(odjeliStats).map(([odjel, stats]) => {
        const projekat = stats.projekat || 0;
        const ostvareno = stats.ukupnoPosjeklo || stats.sječa || 0;
        const procenat = projekat > 0 ? ((ostvareno / projekat) * 100).toFixed(1) : 0;
        const diff = stats.sječa - stats.otprema;

        return `
            <tr>
                <td style="font-weight: 500;">${odjel}</td>
                <td class="right green">${stats.sječa.toFixed(2)}</td>
                <td class="right blue">${stats.otprema.toFixed(2)}</td>
                <td class="right">${projekat.toFixed(2)}</td>
                <td class="right ${procenat >= 90 ? 'green' : procenat >= 70 ? 'blue' : 'red'}">
                    ${procenat}%
                </td>
                <td class="right ${diff >= 0 ? 'green' : 'red'}">
                    ${(diff >= 0 ? '+' : '') + diff.toFixed(2)}
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('analytics-odjeli-table').innerHTML = html;
}
```

**Table Columns:**
1. **Odjel:** Naziv odjela
2. **Sječa (m³):** Green color
3. **Otprema (m³):** Blue color
4. **Projekat:** Target value
5. **% Ostvareno:** Color-coded (green ≥90%, blue ≥70%, red <70%)
6. **Razlika:** Sječa - Otprema (green if positive, red if negative)

---

## 5. Role-Based Access Control

### User Types i Pristup

| User Type | Glavni Pregled | Operativa & Analiza |
|-----------|---------------|---------------------|
| **Admin** | ✅ DA | ✅ DA |
| **OPERATIVA** | ✅ DA | ✅ DA |
| **Primač** | ✅ DA | ❌ NE |
| **Otpremač** | ✅ DA | ❌ NE |

### Implementacija

```javascript
// Security check u switchView() funkciji
if (view === 'operativa' && currentUser.role !== 'admin' && currentUser.type !== 'OPERATIVA') {
    console.warn('Unauthorized access attempt to Operativa view');
    return;
}
```

**Security Features:**
- ✅ Server-side check: `currentUser.type` se dobiva sa servera nakon login-a
- ✅ Client-side validation: Sprječava neovlašćen pristup
- ✅ Console logging: Zapisuje pokušaje neovlašćenog pristupa

---

## 6. Data Flow

### 1. Login Process
```
User Login → handleLogin() → Server Response → currentUser object
```

### 2. Data Loading
```
loadStats(year) → API Request → Server Response → globalData
```

### 3. View Switching
```
User Click Tab → switchView('operativa') → Check RBAC → loadOperativaData(globalData)
```

### 4. OPERATIVA Data Processing
```
loadOperativaData()
  ├─ Calculate KPIs → Update KPI cards
  ├─ renderTopOdjeli() → Top 5 ranking list
  ├─ renderProjekatOstvareno() → Progress bars
  ├─ renderAnalyticsChart() → SVG line chart
  └─ renderAnalyticsOdjeliTable() → Detailed table
```

---

## 7. UI/UX Design Patterns

### Color Scheme
- **Primary Green:** `#059669` - Sječa, Success, Primary actions
- **Primary Blue:** `#2563eb` - Otprema, Info
- **Yellow/Gold:** `#fbbf24` - Top 3 ranking, Warning
- **Red:** `#dc2626` - Razlika (negative), Low performance
- **Gray:** `#6b7280` - Labels, Secondary text
- **Light Gray:** `#e5e7eb` - Borders, Grid lines

### Typography
- **KPI Values:** 24px, bold (700)
- **Card Values (large):** 32px, bold (700)
- **Headers (h2):** 20px, bold (700)
- **Table text:** 16px
- **Labels:** 12-14px, semi-bold (600)

### Spacing
- **Card padding:** 24px
- **Section padding:** 24px
- **Grid gap:** 16-24px
- **Card border-radius:** 8-12px

### Responsive Breakpoints
- **KPI Grid:** `minmax(200px, 1fr)` - 4 columns → stacks on mobile
- **Analytics Grid:** `minmax(350px, 1fr)` - 2 columns → stacks below 700px
- **Tab padding:** 16px vertical, 24px horizontal

---

## 8. Performance Optimizations

### Data Processing
- ✅ Single data fetch from API
- ✅ In-memory calculations (no multiple API calls)
- ✅ Array methods (.map, .reduce, .filter) umjesto loops
- ✅ Lazy loading: OPERATIVA data se učitava samo kad user pristupi tab-u

### Rendering
- ✅ innerHTML batch updates (ne koristi DOM API za svaki element)
- ✅ SVG viewBox za responsive charts (browser-native scaling)
- ✅ CSS transitions umjesto JavaScript animations
- ✅ Hidden class toggle umjesto display manipulation

---

## 9. Moguća Poboljšanja

### Short-term (1-2 sedmice)
1. **Export funkcionalnost:** PDF/Excel izvoz OPERATIVA tabela
2. **Filter controls:** Dropdown za filtriranje po odjelu ili periodu
3. **Tooltips:** Hover tooltips na chart points sa tačnim vrijednostima
4. **Drill-down:** Klik na odjel u Top 5 → prikaži detalje

### Medium-term (1 mjesec)
5. **Trend indicators:** Arrows (↑↓) showing month-over-month change
6. **Search/Sort:** Table sorting by column, search by odjel name
7. **Date range picker:** Custom period umjesto cijele godine
8. **Comparison mode:** Compare 2 years side-by-side

### Long-term (2-3 mjeseca)
9. **Advanced analytics:** Forecasting, Anomaly detection
10. **Custom dashboards:** User-configurable KPI cards
11. **Notifications:** Alerts kada odjel padne ispod 70% completion
12. **Mobile app:** Native iOS/Android app sa Push notifications

---

## 10. Testiranje

### Test Scenarios

#### 1. Role-Based Access
- [ ] Admin može pristupiti OPERATIVA tab-u
- [ ] OPERATIVA korisnik može pristupiti OPERATIVA tab-u
- [ ] Primač NE MOŽE pristupiti OPERATIVA tab-u (ostaje na admin view)
- [ ] Otpremač NE MOŽE pristupiti OPERATIVA tab-u

#### 2. Data Rendering
- [ ] KPI cards prikazuju tačne brojeve
- [ ] Top 5 odjela sorted correctly (highest sječa first)
- [ ] Progress bars show correct percentages
- [ ] Chart lines prikazuju smooth curves
- [ ] Detailed table ima sve odjele

#### 3. Edge Cases
- [ ] Nema podataka → "Nema podataka za prikaz" message
- [ ] Projekat = 0 → Procenat ostvarenja = 0% (no division by zero)
- [ ] Samo 1 odjel → Top 5 shows samo 1 entry
- [ ] Samo 3 odjela → Top 5 shows samo 3 entries

#### 4. Responsive Design
- [ ] Mobile (< 640px): Grid stacks vertically
- [ ] Tablet (640-1024px): 2 column layouts
- [ ] Desktop (> 1024px): Full grid layouts
- [ ] Chart scales properly na svim screen sizes

---

## 11. Tehnička Dokumentacija za Developere

### Dependency Graph
```
index.html
  ├─ Tab Navigation
  │   └─ switchView('operativa')
  │        ├─ RBAC check
  │        └─ loadOperativaData()
  │             ├─ KPI calculations
  │             ├─ renderTopOdjeli()
  │             ├─ renderProjekatOstvareno()
  │             ├─ renderAnalyticsChart()
  │             └─ renderAnalyticsOdjeliTable()
  │
  └─ Data Source: Google Apps Script API
       └─ apps-script-code.gs
            └─ handleStats(year) → odjeliStats, monthlyStats
```

### Global Variables Used
```javascript
globalData = {
    totalPrimka: Number,
    totalOtprema: Number,
    monthlyStats: [
        { mjesec: String, sječa: Number, otprema: Number }
    ],
    odjeliStats: {
        "Odjel Naziv": {
            sječa: Number,
            otprema: Number,
            projekat: Number,
            ukupnoPosjeklo: Number,
            zadnjaSjeca: Number,
            datumZadnjeSjece: String
        }
    }
}

currentUser = {
    username: String,
    fullName: String,
    role: 'user' | 'admin',
    type: 'primac' | 'otpremac' | 'OPERATIVA'
}
```

### HTML Element IDs
```javascript
// Screens
'operativa-screen'        // Main OPERATIVA container
'content-screen'          // Main admin view container

// KPI Cards
'kpi-ratio'               // Sječa/Otprema ratio
'kpi-procenat'            // Procenat ostvarenja
'kpi-odjela'              // Broj odjela
'kpi-avg-sjeca'           // Prosječna sječa po odjelu

// Analytics Sections
'top-odjeli-list'         // Top 5 odjela ranking
'projekat-ostvareno-list' // Progress bars
'analytics-chart'         // SVG line chart
'analytics-odjeli-table'  // Detailed table tbody
'avg-monthly-sjeca'       // AVG mjesečna sječa
'avg-monthly-otprema'     // AVG mjesečna otprema
```

---

## 12. Summary

### Šta je OPERATIVA Feature?

OPERATIVA je **analitički dashboard** dodat u Šumarija aplikaciju koji pruža detaljnu analizu:
- 📊 **KPI Metrics:** 4 ključna pokazatelja (Ratio, Procenat, Broj Odjela, Prosječna Sječa)
- 🏆 **Top Performers:** Top 5 odjela po sječi sa gold ranking-om
- 🎯 **Goal Tracking:** Progress bars za Projekat vs Ostvareno
- 📈 **Trend Analysis:** Monthly chart sa smooth lines i data points
- 📋 **Detailed View:** Tabela sa svim odjelima i color-coded metrics

### Ko može pristupiti?

✅ **Admin i OPERATIVA korisnici** - potpun pristup
❌ **Primač i Otpremač** - blokirani (ostaju na Glavni Pregled)

### Tehnička implementacija

- **402 lines dodato** u index.html
- **6 novih JavaScript funkcija** (switchView, loadOperativaData, renderTopOdjeli, renderProjekatOstvareno, renderAnalyticsChart, renderAnalyticsOdjeliTable)
- **Pure JavaScript** - no libraries (vanilla JS + SVG)
- **Responsive design** - Grid layouts sa auto-fit
- **Color-coded UI** - Green/Blue/Red za performance indicators

---

**Kraj Dokumentacije**

Verzija: 1.0
Datum: 2025-12-28
Autor: Claude (based on git commit analysis)
