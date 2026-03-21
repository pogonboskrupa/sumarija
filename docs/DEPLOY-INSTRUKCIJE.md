# 🚨 KAKO PRAVILNO DEPLOY-OVATI NOVU VERZIJU

## Problem: "timeout is not defined"

Ova greška znači da browser učitava **STARU verziju** JavaScript koda, ne novu!

---

## ✅ RJEŠENJE: Koraci za pravilan deploy

### 1️⃣ Preuzmi NAJNOVIJI `index.html`

**VAŽNO**: Mora biti sa commit-a: `302d909` ili novijeg!

**Provjeri**: Otvori `index.html` i provjeri da linija **4202** ima:
```javascript
async function fetchWithCache(url, cacheKey, forceRefresh = false, timeout = 8000) {
```

**Provjeri verziju**: Linija **3951** treba imati:
```javascript
const APP_VERSION = '2026-01-04-v6-CACHE-BUST';
```

### 2️⃣ Deploy-aj na GitHub

- Ubaci `index.html` na GitHub (main branch ili kako već deploy-aš)
- Pričekaj 2-3 minute da GitHub Pages build-a

### 3️⃣ OBAVEZNO: Očisti browser cache!

**Ovo je NAJVAŽNIJE!** Bez ovoga, browser će koristiti stari keširani kod!

**Opcije:**

**A) Hard Refresh (PREPORUČENO)**
- Windows/Linux: `Ctrl + Shift + R` ili `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**B) Otvori Developer Tools i disable cache**
- Pritisni `F12` da otvoriš Developer Tools
- Idi na **Network** tab
- Checkmark "Disable cache"
- Refresh stranicu

**C) Incognito/Private mode**
- Otvori Incognito/Private prozor (ne keširava)
- Idi na sajt

**D) Ručno očisti cache**
- Chrome: Settings → Privacy → Clear browsing data → Cached images and files
- Firefox: Settings → Privacy → Clear Data → Cached Web Content

### 4️⃣ Provjeri verziju

Nakon što refresh-uješ stranicu:

1. Otvori **konzolu** (F12 → Console tab)
2. Trebao bi vidjeti:
   ```
   🌲 ŠUMARIJA v2026-01-04-v6-CACHE-BUST
   Build: a936a5b
   ```

3. **Ako NE vidiš ovu verziju** → browser još uvijek koristi stari cache!
   - Ponovi hard refresh
   - Probaj incognito mode
   - Očisti cache ručno

### 5️⃣ Ako i dalje ne radi...

Ako vidiš grešku **"timeout is not defined"** čak i nakon hard refresh-a:

**Dijagnoza**: Otvori `index.html` na sajtu i provjeri:
- Da li linija 4202 ima `timeout = 8000` parametar?
- Da li linija 3951 ima verziju `v6-CACHE-BUST`?

**Ako ne vidiš ove promjene** → GitHub Pages nije deploy-ovao novi fajl:
- Provjeri da li si upload-ovao pravi fajl
- Provjeri GitHub Pages settings (da li deploy-a sa pravog branch-a)
- Pričekaj još 5 minuta da GitHub Pages build-a

---

## 📋 Checklist

- [ ] Preuzeo najnoviji `index.html` (commit 302d909 ili noviji)
- [ ] Provjerio da linija 4202 ima `timeout = 8000` parametar
- [ ] Deploy-ovao na GitHub
- [ ] Pričekao 2-3 minute
- [ ] Napravio **hard refresh** (Ctrl+Shift+R)
- [ ] Otvorio konzolu i vidio verziju `v6-CACHE-BUST`
- [ ] Testirao aplikaciju

---

## 🎯 Očekivani rezultat

Kada se sve pravilno učita:

✅ Konzola prikazuje verziju: `2026-01-04-v6-CACHE-BUST`
✅ Admin panel dashboard se učitava (može trajati 10-20s, ali bez timeout greške)
✅ Izvještaji → Primač/Otpremač sedmični/mjesečni rade
✅ Sortimenti u izvještajima prikazani po poslovnom redu (F/L Č, I Č, II Č...)
✅ NEMA greške "timeout is not defined"

---

## ❌ Ako još uvijek ima problema

Pošalji mi screenshot konzole (F12 → Console tab) sa:
- Verzijom koja se učitava
- Greškom koja se prikazuje

Tako da mogu vidjeti šta se dešava!
