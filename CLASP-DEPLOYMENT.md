# 🚀 CLASP Deployment Guide

## Šta je clasp?
**clasp** (Command Line Apps Script Projects) je CLI alat koji omogućava rad sa Google Apps Script projektima direktno iz terminala.

---

## 📦 Preduslovi

### 1. Node.js i npm
```bash
node --version  # Trebalo bi biti v14+
npm --version
```

Ako nemaš Node.js, instaliraj sa: https://nodejs.org

### 2. Instaliraj clasp globalno
```bash
npm install -g @google/clasp
```

### 3. Provjeri instalaciju
```bash
clasp --version
```

---

## 🔐 Autentifikacija

### Korak 1: Enable Google Apps Script API
1. Idi na https://script.google.com/home/usersettings
2. **Google Apps Script API → ON** (uključi toggle)

### Korak 2: Login sa clasp
```bash
clasp login
```

Ovo će:
- Otvoriti browser za Google autentifikaciju
- Tražiti pristup Apps Script API-ju
- Sačuvati credentials u `~/.clasprc.json`

---

## 📋 Deployment - 2 OPCIJE

### OPCIJA A: Kreiraj NOVI Google Apps Script projekat ✅ PREPORUČENO

#### 1. Kreiraj novi projekat
```bash
cd /home/user/sumarija
clasp create --type webapp --title "Šumarija API Refactored"
```

Ovo će:
- Kreirati novi Apps Script projekat na script.google.com
- Automatski popuniti `scriptId` u `.clasp.json`
- Spremiti projekat u tvoj Google Drive

#### 2. Push lokalne fajlove na Google Apps Script
```bash
clasp push
```

Ovo će uploadovati SVE fajlove iz `apps-script/` direktorija:
- `config.gs`
- `main.gs`
- `authentication.gs`
- `utils-triggers.gs`
- `services.gs`
- `api-handlers.gs`
- `diagnostic.gs`
- `appsscript.json` (manifest)

#### 3. Otvori projekat u browseru
```bash
clasp open
```

#### 4. Deploy kao Web App
```bash
clasp deploy --description "Modular refactored version"
```

Ili deploy kroz browser:
1. `clasp open`
2. **Deploy → New deployment → Web app**
3. **Execute as:** Me
4. **Who has access:** Anyone
5. **Deploy**
6. Kopiraj deployment URL

---

### OPCIJA B: Poveži sa POSTOJEĆIM projektom

Ako već imaš Apps Script projekat na script.google.com:

#### 1. Pronađi Script ID
1. Otvori svoj projekat: https://script.google.com
2. **Project Settings** (lijeva strana, ikona sa zupčanikom)
3. Kopiraj **Script ID** (npr. `1a2b3c4d5e6f7g8h9i0j`)

#### 2. Kloniraj projekat
```bash
cd /home/user/sumarija
clasp clone <SCRIPT_ID>
```

**OPREZ:** Ovo će prepisati lokalne fajlove sa remotnim verzijama!

#### 3. Backup postojećih fajlova
Prije kloniranja, sačuvaj backup:
```bash
clasp pull  # Povuci trenutnu verziju sa servera
cp -r apps-script apps-script-backup
```

#### 4. Push nove izmjene
```bash
clasp push
```

**OPREZ:** Ovo će prepisati sve fajlove na Apps Script sa lokalnim verzijama!

---

## 🔄 Tipičan Workflow

### 1. Napravi izmjene lokalno
Edituj bilo koji `.gs` fajl u `apps-script/` direktoriju

### 2. Push izmjene na Google
```bash
clasp push
```

### 3. Deploy novu verziju (opciono)
```bash
clasp deploy --description "Bug fix XYZ"
```

### 4. Pogledaj logs (za debugging)
```bash
clasp logs
```

### 5. Otvori projekat u browseru
```bash
clasp open
```

---

## 📁 Struktura projekta

```
/home/user/sumarija/
├── .clasp.json              # clasp konfiguracija
├── apps-script/             # Svi Apps Script fajlovi
│   ├── config.gs
│   ├── main.gs
│   ├── authentication.gs
│   ├── utils-triggers.gs
│   ├── services.gs
│   ├── api-handlers.gs
│   ├── diagnostic.gs
│   └── appsscript.json      # Manifest (timeZone, permissions...)
├── public/                  # Frontend files (index.html, script.js...)
└── CLASP-DEPLOYMENT.md      # Ovaj fajl
```

---

## ⚙️ .clasp.json Konfiguracija

Trenutna konfiguracija:

```json
{
  "scriptId": "",
  "rootDir": "./apps-script"
}
```

- **scriptId**: Automatski popunjeno nakon `clasp create` ili `clasp clone`
- **rootDir**: Direktorij sa .gs fajlovima (default je root)

---

## 🎯 Korisne komande

| Komanda | Opis |
|---------|------|
| `clasp login` | Autentifikacija sa Google računom |
| `clasp logout` | Odjavljivanje |
| `clasp create` | Kreiranje novog Apps Script projekta |
| `clasp clone <scriptId>` | Kloniranje postojećeg projekta |
| `clasp push` | Upload lokalnih fajlova na Google |
| `clasp pull` | Download fajlova sa Google-a |
| `clasp open` | Otvori projekat u browseru |
| `clasp deploy` | Deploy nova verzija |
| `clasp deployments` | Lista svih deployments |
| `clasp undeploy <id>` | Obriši deployment |
| `clasp logs` | Prikaži execution logs |
| `clasp version` | Kreiranje nove verzije |
| `clasp versions` | Lista svih verzija |

---

## 🔒 Sigurnost

### .claspignore
Kreiraj `.claspignore` fajl da sprječiš upload osjetljivih fajlova:

```
# Node modules
node_modules/

# Environment variables
.env
.env.local

# Git
.git/
.gitignore

# Logs
*.log

# OS files
.DS_Store
Thumbs.db
```

### Ne commituj credentials!
Dodaj u `.gitignore`:
```
.clasp.json   # Ako sadrži scriptId
~/.clasprc.json  # Google credentials
```

---

## ❗ Troubleshooting

### Problem: "User has not enabled the Apps Script API"
**Rješenje:** Idi na https://script.google.com/home/usersettings i uključi API

### Problem: "Error retrieving access token"
**Rješenje:**
```bash
clasp logout
clasp login
```

### Problem: "Push failed"
**Rješenje:** Provjeri da li imaš permissions na projektu:
```bash
clasp open  # Otvori projekat i provjeri pristup
```

### Problem: "Cannot find appsscript.json"
**Rješenje:** Kreiraj `appsscript.json` u `apps-script/` direktoriju (vidi strukturu gore)

---

## 🎉 Automatski Deployment sa GitHub Actions

Možeš automatizovati deployment sa CI/CD:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Apps Script

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install -g @google/clasp
      - run: echo "$CLASPRC" > ~/.clasprc.json
        env:
          CLASPRC: ${{ secrets.CLASPRC_JSON }}
      - run: clasp push
      - run: clasp deploy
```

---

## 📚 Dodatni resursi

- **clasp GitHub:** https://github.com/google/clasp
- **Apps Script dokumentacija:** https://developers.google.com/apps-script
- **clasp full documentation:** https://github.com/google/clasp/blob/master/docs/

---

**Happy coding!** 🚀
