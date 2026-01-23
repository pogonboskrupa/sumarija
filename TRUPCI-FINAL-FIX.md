# 🔧 FINALNI FIX - TRUPCI Kolone u Izvještajima

## 📋 Problem koji je riješen

TRUPCI kolone u **Mjesečnim izvještajima** (Izvještaji → Mjesečni izvještaj) su imale:
- Bijele ili vrlo svijetle boje sa bijelim tekstom
- Podatke je bilo NEMOGUĆE pročitati
- CSS stilovi nisu radili zbog inline stilova u JavaScript kodu

## ✅ Rješenje

Kreirana je **potpuno nova render funkcija** koja:
1. **Ne koristi CSS klase** - sve je inline stilovi direktno u HTML-u
2. **Eksplicitno definiše boju za SVAKI sortiment** po nazivu
3. **Automatski primjenjuje boje** bez potrebe za CSS fajlovima

### Novi Fajlovi:
- **`js/izvjestaji-fix.js`** - Nova render funkcija sa inline stilovima
- **`index.html`** - Dodat novi script tag
- **`js/app.js`** - Dodat redirect na novu funkciju

---

## 🎨 Paleta Boja

### **Headers (Naslovi kolona):**
- **TRUPCI** (sve varijante): `#ea580c` (dark orange) + white text
- **Ostale lišćari** (F/L L, I L, II L, III L, OGR.): `#f59e0b` (medium orange) + white text
- **ČETINARI grupa**: `#059669` (green) + white text
- **LIŠĆARI agregat**: `#f59e0b` (medium orange) + white text
- **SVEUKUPNO**: `#dc2626` (red) + white text

### **Body Cells (Podaci):**
- **TRUPCI** (sve varijante): `#fbbf24` (medium amber) + `#78350f` (dark brown text)
- **Ostale lišćari** (F/L L, I L, II L, III L, OGR.): `#fed7aa` (light amber) + `#78350f` (dark brown text)
- **ČETINARI grupa**: `#d1fae5` (light green) + `#065f46` (dark green text)
- **LIŠĆARI agregat**: `#fbbf24` (medium amber) + `#78350f` (dark brown text)
- **SVEUKUPNO**: `#fecaca` (light red) + `#7f1d1d` (dark red text)

---

## 🚀 Kako Deploy-ovati

### **1. Merge u Main:**

Otvori:
```
https://github.com/pogonboskrupa/sumarija/compare/main...claude/find-last-branch-AKhOE
```

Koraci:
1. Klikni **"Create pull request"**
2. Naslov: `🔧 FINAL FIX: TRUPCI columns with inline styles`
3. Klikni **"Create pull request"** ponovo
4. Klikni **"Merge pull request"**
5. Klikni **"Confirm merge"**

### **2. Sačekaj GitHub Pages Deploy:**

Provjeri:
```
https://github.com/pogonboskrupa/sumarija/actions
```

- **OBAVEZNO** sačekaj dok ne vidiš **ZELENU KVAČICU** ✓
- Može trajati **2-5 minuta**
- NE testiraj dok deploy nije završen!

### **3. Obriši Cache:**

**Na telefonu:**
- Chrome: Settings → Privacy → Clear browsing data → Cached images and files
- Safari: Settings → Safari → Clear History and Website Data

**Na desktop-u:**
- Hard refresh: `Ctrl + Shift + R` (Windows/Linux) ili `Cmd + Shift + R` (Mac)

### **4. Testiraj:**

```
https://pogonboskrupa.github.io/sumarija/
```

- Logiraj se
- Idi na **Izvještaji** → **Mjesečni izvještaj**
- Odaberi Januar 2026
- **TRUPCI kolone MORAJU biti žute sa tamno smeđim tekstom**

---

## 🔍 Kako Radi

Nova funkcija `window.renderIzvjestajiTableFixed()`:

1. **Učitava se PRE glavne aplikacije** (`js/izvjestaji-fix.js` prije `js/app.js`)
2. **Postojeća funkcija provjerava** da li nova postoji: `if (window.renderIzvjestajiTableFixed)`
3. **Ako postoji, koristi novu** - ako ne, koristi staru
4. **Svi stilovi su inline** - `style="background: #fbbf24; color: #78350f;"`
5. **Nema dependency na CSS klase** - sve radi čak i bez CSS fajlova

---

## 📊 Rezultat

**PRIJE:**
```html
<th class="col-group-liscari" style="color: white;">TRUPCI</th>
<td class="col-group-liscari">44.17</td>
```
- CSS klase ne rade
- Inline stil sa `color: white` čini tekst nevidljivim
- Bijela pozadina + bijeli tekst = NEVIDLJIVO ❌

**POSLIJE:**
```html
<th style="background: #ea580c; color: white; font-weight: 700;">TRUPCI</th>
<td style="background: #fbbf24; color: #78350f; font-weight: 600;">44.17</td>
```
- SVE je inline stilovi - nema konflikta
- Tamna narandžasta header sa bijelim tekstom
- Žuta ćelija sa tamno smeđim tekstom
- **SAVRŠENO VIDLJIVO** ✅

---

## ✅ Checklist

- [ ] Merge-ovao PR u main
- [ ] Sačekao da GitHub Actions završi (zelena kvačica)
- [ ] Obrisao cache na uređaju
- [ ] Testirao na sajtu
- [ ] TRUPCI kolone su ŽUTE sa TAMNIM TEKSTOM

---

**Ako i dalje ne radi poslije svih ovih koraka, pošalji mi screenshot sa Developer Tools (F12) otvorenim!** 🚀
