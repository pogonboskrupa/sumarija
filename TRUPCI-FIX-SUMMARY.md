# 🔧 TRUPCI Column Fix - Mjesečni Izvještaji

## 📋 Problem

U ADMIN mjesečnim izvještajima (Sječa/otprema po mjesecima), **TRUPCI kolone** su imale loš kontrast - svijetlu pozadinu sa bijelim tekstom, što je činilo podatke nevidljivim ili vrlo teško čitljivim.

### Zahvaćene Tabele:
- ✅ `#mjesecna-sjeca-table` - Sječa po mjesecima i sortimentima
- ✅ `#mjesecna-otprema-table` - Otprema po mjesecima i sortimentima

### Zahvaćene Kolone:
- **TRUPCI** (lišćari trupci)
- **TRUPCI Č** (četinari trupci)
- **TRUPCI L** (lišćari trupci explicit)
- Sve ostale **col-group-liscari** kolone (F/L L, I L, II L, III L, OGR.DUGI, OGR.CIJEPANI)
- Sve ostale **col-group-cetinari** kolone (F/L Č, I Č, II Č, III Č, RUDNO, CEL.DUGA, CEL.CIJEPANA)

---

## ✅ Rješenje

Dodani su specifični CSS override-i u `css/table-contrast-fix.css` koji osiguravaju:

### 1. **Lišćari Kolone (TRUPCI i ostali)**
- **Header (thead):**
  - Background: `#d97706` (tamna narandžasta)
  - Color: `white` sa text-shadow
  - Font-weight: `700` (bold)

- **Body cells (tbody):**
  - Background: `#fde047` (svijetlo žuta - dobra čitljivost)
  - Color: `#78350f` (tamno smeđa)
  - Font-weight: `600` (semi-bold)

- **Agregat kolona (LIŠĆARI total):**
  - Background: `#fbbf24` (srednje žuta)
  - Color: `#78350f` (tamno smeđa)
  - Font-weight: `700` (bold)

### 2. **Četinari Kolone (TRUPCI Č i ostali)**
- **Header (thead):**
  - Background: `#059669` (zelena)
  - Color: `white` sa text-shadow
  - Font-weight: `700` (bold)

- **Body cells (tbody):**
  - Background: `#d1fae5` (svijetlo zelena)
  - Color: `#065f46` (tamno zelena)
  - Font-weight: `600` (semi-bold)

---

## 🎨 Colour Palette

### Lišćari (Yellow/Orange Spectrum)
```css
/* Header */
background: #d97706; /* Dark orange */
color: white;

/* Body */
background: #fde047; /* Bright yellow */
color: #78350f; /* Dark brown */

/* Aggregate */
background: #fbbf24; /* Medium yellow */
color: #78350f; /* Dark brown */
```

### Četinari (Green Spectrum)
```css
/* Header */
background: #059669; /* Green */
color: white;

/* Body */
background: #d1fae5; /* Light green */
color: #065f46; /* Dark green */
```

---

## 📁 Promijenjeni Fajlovi

### `css/table-contrast-fix.css`
Dodato ~80 linija CSS-a sa specifičnim override-ima za:
- `#mjesecna-sjeca-table .col-group-liscari`
- `#mjesecna-otprema-table .col-group-liscari`
- `#mjesecna-sjeca-table .col-group-cetinari`
- `#mjesecna-otprema-table .col-group-cetinari`
- Header i body specifični stilovi sa `!important` za override inline stilova

---

## 🧪 Testiranje

### Prije:
- ❌ TRUPCI kolone: svijetla žuta pozadina (#fef3c7) + bijeli tekst = **nevidljivo**
- ❌ Loš kontrast na svim lišćari kolonama
- ❌ Podaci teško čitljivi

### Poslije:
- ✅ TRUPCI kolone: svijetla žuta pozadina (#fde047) + tamno smeđi tekst (#78350f) = **odličan kontrast**
- ✅ Headers: tamne boje sa bijelim tekstom i text-shadow
- ✅ Body cells: svijetle boje sa tamnim tekstom
- ✅ Svi podaci jasno vidljivi

---

## 🚀 Deployment

### 1. Lokalno testiranje:
```bash
# Otvori aplikaciju u browseru
open index.html

# Logiraj se kao ADMIN
# Idi na: "📅 Sječa/otprema po mjesecima"
# Provjeri TRUPCI kolone - treba biti tamno žuto sa tamnim tekstom
```

### 2. Deploy:
```bash
git add css/table-contrast-fix.css TRUPCI-FIX-SUMMARY.md
git commit -m "🔧 FIX: TRUPCI column contrast in monthly reports"
git push -u origin claude/find-last-branch-AKhOE
```

---

## 📊 CSS Specificity

Za override inline stilova (`style="color: white !important"`), koristimo:
- **ID selektori** (`#mjesecna-sjeca-table`)
- **Class selektori** (`.col-group-liscari`)
- **`!important` flag** na svim override pravilima
- **Attribute selektori** (`[style]`) za dodatnu specifičnost

Hijerarhija:
```
Inline style sa !important  (1000)
ID + Class + !important     (110 + !important) ✅ OVO KORISTI
ID + Class                  (110)
Class + !important          (10 + !important)
```

---

## 🎉 Rezultat

**PRIJE:** Nevidljivi podaci u TRUPCI kolonama mjesečnih izvještaja

**POSLIJE:** Kristalno jasne, dobro čitljive tabele sa izvrsnim kontrastom boja

- ✅ Headers su tamne boje sa bijelim tekstom
- ✅ Body cells su svijetle boje sa tamnim tekstom
- ✅ Svi sortimenti (TRUPCI, TRUPCI Č, TRUPCI L, itd.) su sada vidljivi
- ✅ Konzistentan dizajn sa ostalim tabelama u aplikaciji

---

**Happy readable tables!** 📊✨
