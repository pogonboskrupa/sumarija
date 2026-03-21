# Plan Implementacije: Radilišta i Izvođači Radova

## 🎯 Cilj
Dodati prikaze po radilištima i izvođačima radova sa mjesečnim sortimentima i godišnjom rekapitulacijom.

## 📋 Backend Tasks (Apps Script)

### 1. Dodati helper funkciju za povlačenje podataka iz odjelnih fajlova
```javascript
/**
 * Povlači radilište i izvođača iz odjel fajla
 * @param {string} odjel - Naziv odjela (npr. "101")
 * @return {Object} {radiliste: "...", izvodjac: "..."}
 */
function getOdjelInfo(odjel) {
  // TODO: Implementirati logiku
  // 1. Naći spreadsheet ID za dati odjel
  // 2. Otvoriti taj spreadsheet
  // 3. Pristupiti sheet-u "PRIMKA"
  // 4. Pročitati W2 (radilište) i W3 (izvođač)
  // 5. Vratiti objekat sa podacima
}
```

### 2. Modifikovati procesiranje INDEX_PRIMKA i INDEX_OTPREMA
- Dodati kolone W i X prilikom čitanja podataka
- Ako podaci ne postoje, povući ih iz odjelnih fajlova
- Cache-irati podatke da se ne povlače svaki put

### 3. Kreirati nove API endpoints

#### `/primaci-by-radiliste`
- Parametri: `year`, `username`, `password`
- Vraća: Lista radilišta sa mjesečnim sortimentima i ukupnim

#### `/primaci-by-izvodjac`
- Parametri: `year`, `username`, `password`
- Vraća: Lista izvođača sa mjesečnim sortimentima i ukupnim

#### `/otpremaci-by-radiliste`
- Parametri: `year`, `username`, `password`
- Vraća: Lista radilišta sa mjesečnim sortimentima i ukupnim

#### `/otpremaci-by-izvodjac`
- Parametri: `year`, `username`, `password`
- Vraća: Lista izvođača sa mjesečnim sortimentima i ukupnim

## 🎨 Frontend Tasks (index.html)

### 1. Dodati submenu tab-ove

**Primači:**
```javascript
<div class="submenu">
  <button onclick="switchPrimaciSubmenu('monthly')">📊 Mjesečni prikaz</button>
  <button onclick="switchPrimaciSubmenu('daily')">📅 Po danima</button>
  <button onclick="switchPrimaciSubmenu('radilista')">🏗️ Radilišta</button>  // NOVO
  <button onclick="switchPrimaciSubmenu('izvodjaci')">👷 Izvođači</button>   // NOVO
</div>
```

**Otpremači:**
```javascript
<div class="submenu">
  <button onclick="switchOtremaciSubmenu('monthly')">📊 Mjesečni prikaz</button>
  <button onclick="switchOtremaciSubmenu('daily')">📅 Po danima</button>
  <button onclick="switchOtremaciSubmenu('radilista')">🏗️ Radilišta</button>  // NOVO
  <button onclick="switchOtremaciSubmenu('izvodjaci')">👷 Izvođači</button>   // NOVO
</div>
```

### 2. HTML sekcije za prikaze

```html
<!-- Prikaz po radilištima -->
<div id="primaci-radilista-view" class="submenu-content hidden">
  <h3>🏗️ Prikaz po radilištima</h3>

  <!-- Mjesečni prikaz -->
  <table>
    <thead>
      <tr>
        <th>Radilište</th>
        <th>Januar</th>
        <th>Februar</th>
        ...
        <th>Ukupno</th>
      </tr>
    </thead>
    <tbody id="radilista-body"></tbody>
  </table>

  <!-- Godišnja rekapitulacija po sortimentima -->
  <h4>📊 Godišnja rekapitulacija po sortimentima</h4>
  <table id="radilista-rekapitulacija"></table>
</div>

<!-- Prikaz po izvođačima -->
<div id="primaci-izvodjaci-view" class="submenu-content hidden">
  <!-- Slično kao gore -->
</div>
```

### 3. JavaScript funkcije

```javascript
async function loadPrimaciByRadiliste(year) {
  // Fetch data from API
  // Render mjesečni prikaz
  // Render godišnju rekapitulaciju
}

async function loadPrimaciByIzvodjac(year) {
  // Fetch data from API
  // Render mjesečni prikaz
  // Render godišnju rekapitulaciju
}

// Isto za otpremače...
```

## 📊 Struktura podataka

### Primjer API response za `primaci-by-radiliste`:

```json
{
  "radilista": [
    {
      "naziv": "Radilište 1",
      "mjeseci": [45.2, 67.3, 89.1, ...],  // 12 mjeseci
      "sortimenti": {
        "F/L Č": [10.5, 12.3, ...],
        "I Č": [5.2, 7.8, ...],
        ...
      },
      "ukupno": 856.3
    },
    {
      "naziv": "Radilište 2",
      ...
    }
  ],
  "sortimentiNazivi": ["F/L Č", "I Č", "II Č", ...]
}
```

## ⏱️ Estimacija

- Backend (Apps Script): 2-3 sata
- Frontend (HTML/JS): 2-3 sata
- Testing i debugging: 1 sat
- **Ukupno: 5-7 sati**

## 🚀 Sljedeći koraci

1. ✅ Zatamniti pozadinu datum zaglavlja (GOTOVO)
2. ⏳ Implementirati backend funkcije
3. ⏳ Dodati API endpoints
4. ⏳ Kreirati frontend UI
5. ⏳ Testiranje i refinement
