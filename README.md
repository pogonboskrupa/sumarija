# 🌲 Šumarija - Web Aplikacija

Moderna web aplikacija za evidenciju sječe i otpreme drvne mase.

## 🚀 BRZI START

Pročitaj **[BRZI_START.md](BRZI_START.md)** za kompletno uputstvo!

## 📱 DEMO - Testiraj odmah!

Otvori **`index-demo.html`** u browseru (čak i sa mobitela!) i testiraj aplikaciju bez deploy-a.

### Demo pristupni podaci:
- **Admin**: `admin` / `admin123`
- **Šumar**: `sumar1` / `sumar123`
- **Vozač**: `vozac1` / `vozac123`

## ✨ Funkcionalnosti

### 📊 Dashboard
- **KPI kartice** - Ukupna sječa, otprema i razlika
- **Mjesečni pregled** - Tabelarni prikaz po mjesecima
- **Grafikon** - Smooth line chart godišnje sječe i otpreme
- **Pregled odjela** - Detaljni podaci po odjelima sa:
  - Zadnja sječa i datum
  - Progress bar projekta
  - Procenat ostvarenja

### 🔧 Alati
- **🔍 Pretraga** - Brza pretraga odjela
- **🔄 Refresh** - Osvježi podatke
- **📥 Export CSV** - Izvoz podataka u CSV format
- **📄 Export PDF** - PDF izvoz (Print to PDF)

### 📈 Statistike
- Broj odjela
- Prosječna sječa po odjelu
- Top odjel (najveća sječa)

### 💾 Offline Mode
- Automatski cache podataka (1 sat)
- Radi bez interneta nakon prvog učitavanja
- LocalStorage za login credentials

### 📱 Responsive Design
- Optimizovano za mobilne uređaje
- Touch-friendly UI
- Fleksibilan layout

## 🚀 Struktura Projekta

```
sumarija/
├── index.html                        # Produkcijska verzija (sa pravim API-jem)
├── index-demo.html                   # Demo verzija (sa Mock API-jem)
├── mock-api.js                       # Mock API za testiranje
├── apps-script-code.gs               # Google Apps Script backend kod
├── BRZI_START.md                     # ⭐ Brzi start uputstvo
├── APPS_SCRIPT_UPUTSTVO.md           # Detaljno uputstvo za setup
├── APPS_SCRIPT_NAPREDNE_OPCIJE.md    # Napredne opcije i optimizacije
├── KAKO_TESTIRATI.md                 # Uputstvo za testiranje demo verzije
└── README.md                         # Ova datoteka
```

## 📦 Setup

### Opcija 1: Demo (bez deploy-a)
1. Otvori `index-demo.html` u browseru
2. Prijavi se sa demo podacima
3. Testiraj sve funkcionalnosti

### Opcija 2: Produkcija (sa Google Sheets)
1. Pročitaj `APPS_SCRIPT_UPUTSTVO.md`
2. Kreiraj Google Apps Script
3. Kopiraj kod iz `apps-script-code.gs`
4. Prilagodi prema tvojoj strukturi
5. Deploy-uj kao Web App
6. Updateuj `index.html` sa novim API URL-om

## 🎨 Tehnologije

- **Frontend**: Pure HTML, CSS, JavaScript (bez framework-a)
- **Charts**: SVG sa smooth bezier curves
- **Backend**: Google Apps Script (serverless)
- **Database**: Google Sheets
- **Hosting**: GitHub Pages ready

## 📖 Kako koristiti

### Login
1. Otvori aplikaciju
2. Unesi username i password
3. Klikni "Prijavi se"

### Pregled podataka
- **KPI kartice** prikazuju godišnje totale
- **Mjesečna tabela** prikazuje breakdown po mjesecima
- **Line chart** prikazuje trend
- **Tabela odjela** prikazuje detaljne podatke

### Pretraga
Kucaj u search box za brzu pretragu odjela.

### Export
- **CSV**: Klikni "Export CSV" za download
- **PDF**: Klikni "Export PDF" za print preview

### Refresh
Klikni "Refresh" dugme da osvježiš podatke sa servera.

## 🔐 Sigurnost

- Password hashing (SHA-256) - implementiraj u produkciji
- Session storage za credentials
- Rate limiting - opciono
- CORS enabled

## 🐛 Troubleshooting

### Demo ne radi?
- Provjeri da li je `mock-api.js` u istom folderu
- Otvori browser console (F12) za greške

### Podaci se ne učitavaju?
- Provjeri network tab u Developer Tools
- Provjeri API URL u `index.html`
- Provjeri Apps Script deploy

### Grafikon se ne prikazuje?
- Refresh stranicu
- Provjeri da li ima podataka
- Provjeri browser console

## 📱 Testiranje na mobitelu

### Način 1: Lokalni server
```bash
# Python 3
python -m http.server 8000

# Otvori na mobitelu
http://[tvoj-ip]:8000/index-demo.html
```

### Način 2: Deploy na GitHub Pages
1. Push kod na GitHub
2. Enable GitHub Pages
3. Otvori URL na mobitelu

### Način 3: Share fajl
1. Kopiraj `index-demo.html` i `mock-api.js` na mobitel
2. Otvori HTML fajl u browseru

## 🎯 Roadmap

- [ ] PWA support (offline app)
- [ ] Push notifikacije
- [ ] Dark mode
- [ ] Multi-year comparison
- [ ] Advanced filters
- [ ] Real-time updates (WebSocket)
- [ ] User roles & permissions
- [ ] Mobile app (React Native)

## 📄 Licenca

MIT License - slobodno koristi i prilagođavaj!

## 👨‍💻 Autor

Razvijeno za Šumariju - Evidencija sječe i otpreme 2024

## 🙋 Pomoć

Za pitanja i podršku:
1. Pročitaj `APPS_SCRIPT_UPUTSTVO.md`
2. Provjeri Issues na GitHub-u
3. Kontaktiraj podršku

---

**Napomena**: Demo verzija koristi generated mock podatke. Za produkciju, koristi pravi Google Apps Script backend.
