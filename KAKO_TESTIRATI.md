# 🚀 Kako testirati aplikaciju sa mobitela

## ⚡ Brzi start - 3 koraka

### 1. Download fajlove
Preuzmi ova 2 fajla na mobitel ili računar:
- `index-demo.html`
- `mock-api.js`

> **Važno**: Oba fajla moraju biti u istom folderu!

### 2. Otvori index-demo.html
- Na mobitelu: otvori fajl u browseru (Chrome, Safari, Firefox)
- Na računaru: dvaput klikni na `index-demo.html`

### 3. Prijavi se
Koristi jedan od demo naloga:
- **Admin**: `admin` / `admin123`
- **Šumar**: `sumar1` / `sumar123`
- **Vozač**: `vozac1` / `vozac123`

---

## 📱 Testiranje na mobitelu - Opcije

### Opcija A: Direktno otvaranje (najbrže)
1. Prebaci `index-demo.html` i `mock-api.js` na mobitel
   - Preko email-a
   - Preko cloud storage (Dropbox, Google Drive)
   - Preko USB kabla
2. Otvori `index-demo.html` u browseru
3. Gotovo!

### Opcija B: Lokalni server (preporučeno za development)
Ako imaš Python instaliran:

```bash
# Navigiraj do foldera sa fajlovima
cd /putanja/do/sumarija

# Pokreni server
python -m http.server 8000

# Na mobitelu otvori:
http://[IP-ADRESA]:8000/index-demo.html
```

Kako naći IP adresu:
- **Windows**: `ipconfig` (IPv4 Address)
- **Mac/Linux**: `ifconfig` ili `ip addr`
- Obično je nešto kao `192.168.1.xxx`

### Opcija C: GitHub Pages (za deployment)
1. Push kod na GitHub
2. Idi u Settings > Pages
3. Enable GitHub Pages
4. Otvori link na mobitelu

---

## 🎯 Šta testirati

### Login ekran ✅
- [ ] Login sa ispravnim podacima radi
- [ ] Login sa pogrešnim podacima prikazuje grešku
- [ ] Demo banner je vidljiv

### Dashboard ✅
- [ ] KPI kartice prikazuju brojeve
- [ ] Mjesečna tabela ima 12 redova
- [ ] Line grafikon se prikazuje
- [ ] Tabela odjela ima 10 odjela
- [ ] Progress bars su vidljivi

### Toolbar ✅
- [ ] Search box filtrira odjele
- [ ] Refresh dugme učitava podatke ponovo
- [ ] Export CSV download-uje fajl
- [ ] Export PDF prikazuje uputstvo

### Mini statistike ✅
- [ ] Broj odjela = 10
- [ ] Prosječna sječa je izračunata
- [ ] Top odjel je prikazan

### Responsive ✅
- [ ] UI se prilagođava veličini ekrana
- [ ] Sve je klikabilno na touch ekranu
- [ ] Tabele su scrollable

### Offline mode ✅
- [ ] Nakon prvog učitavanja, refresh je brži (koristi cache)
- [ ] Logout pa login ponovo - automatski login radi

---

## 🐛 Problemi?

### Aplikacija ne radi?
1. Provjeri da li su oba fajla (`index-demo.html` i `mock-api.js`) u istom folderu
2. Otvori Developer Tools (F12 na računaru)
3. Provjeri Console za greške

### Login ne radi?
- Koristi tačne pristupne podatke: `admin` / `admin123`
- Provjeri da nemaš typo u username/password

### Grafikon se ne prikazuje?
- Refresh stranicu (F5 ili povuci sa vrha na mobitelu)
- Provjeri Console za greške

### Export ne radi?
- CSV export bi trebao automatski download-ovati fajl
- PDF export prikazuje uputstvo za Print to PDF

---

## 📸 Screenshot funkcionalnosti

Možeš testirati:
1. **Login** - unesi credentials i prijavi se
2. **Dashboard** - vidi sve statistike i grafikone
3. **Search** - kucaj "01" u search box
4. **Export** - klikni Export CSV dugme
5. **Refresh** - klikni Refresh da učitaš podatke ponovo
6. **Logout** - klikni "Odjavi se" dugme

---

## ✅ Sve radi? Šta dalje?

### Za deploy na produkciju:
1. Pročitaj `APPS_SCRIPT_UPUTSTVO.md`
2. Setup Google Apps Script
3. Koristi `index.html` (bez demo banner-a)
4. Updateuj API_URL

### Za dodatne funkcionalnosti:
1. Pročitaj `APPS_SCRIPT_NAPREDNE_OPCIJE.md`
2. Implementiraj caching, email notifikacije, backup, itd.

---

## 💡 Tips

- **Za najbolje iskustvo**: koristi Chrome ili Safari
- **Za development**: koristi Developer Tools (F12)
- **Za testiranje**: otvori u Incognito mode da izbjegneš cache probleme
- **Za mobilno testiranje**: koristi Chrome DevTools Device Mode

---

**Enjoy!** 🌲
