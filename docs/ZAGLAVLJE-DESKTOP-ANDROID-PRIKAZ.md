# Zaglavlje: izbor "Desktop / Android prikaz" — kako je bilo prije v2.63

Ovaj dokument opisuje **prethodno stanje** zaglavlja i prikaza, prije nego što je
u **v2.63** izbor Desktop/Android uklonjen i zamijenjen imenom i prezimenom
radnika. Svrha: da se taj mehanizam može tačno rekonstruisati ako ikad zatreba,
i da se zna zašto je uklonjen.

- **Zadnji commit sa starim stanjem:** `e6271e8` ("Vrati zaglavlje na prethodno stanje (poništen v2.61)", v2.62)
- **Commit koji ga je uklonio:** `7b7e13d` (v2.63)
- **Povratak jednog fajla:** `git show e6271e8:index.html > index.html` (isto za `js/app.js`, `js/ui.js`, `js/auth.js`, `css/main.css`)

---

## 1. Kako je izgledalo

U zaglavlju, desno, bila su **dva dugmeta** između korisničkog imena i dugmeta "Meni":

```
[ Ažuriraj ☁️ ]   ime + uloga   [ 🖥️ Desktop ] [ 📱 Android ]   [ ⚙️ Meni ]
```

Markup (`index.html`, u `.header-right`):

```html
<div class="header-user">
    <div class="header-user-name" id="user-name"></div>
    <div class="header-user-role" id="user-role"></div>
</div>
<div class="desktop-view-toggle" style="display: flex; gap: 6px;">
    <button class="desktop-view-button" onclick="toggleDesktopView()" id="desktop-view-btn" title="Prebaci na desktop prikaz">
        <span>🖥️</span><span>Desktop</span>
    </button>
    <button class="desktop-view-button" onclick="toggleAndroidView()" id="android-view-btn" title="Prebaci na Android prikaz">
        <span>📱</span><span>Android</span>
    </button>
</div>
```

CSS je bio (i još uvijek stoji, neiskorišten) u `css/styles.css:28-31` — **napomena:**
`css/styles.css` se NE učitava u `index.html`, pa su ta pravila bila mrtva i dugmad
su se oslanjala na osnovne stilove:

```css
.desktop-view-toggle { }
.desktop-view-button { background:#f3f4f6; color:#374151; padding:8px 16px; border-radius:8px;
                       border:none; cursor:pointer; font-size:13px; font-weight:600;
                       display:flex; align-items:center; gap:8px; transition:all .2s; }
.desktop-view-button:hover { background:#e5e7eb; }
.desktop-view-button.active { background:#047857; color:white; }
```

Postojalo je i pravilo koje ih je krilo u fokus-modu karte (`index.html`):
```css
body.mapa-fokus .desktop-view-toggle { display:none !important; }
```

## 2. Šta su dugmad radila

Funkcije `toggleDesktopView()` i `toggleAndroidView()` u `js/ui.js` (~linije 429-495).
Oba su radila **isto tri stvari**, samo sa različitim klasama:

1. Isključe onaj drugi mod (klasa + `localStorage`)
2. Toggle klase na `<body>`: `force-desktop-view` / `force-android-view`
3. Zapišu izbor u `localStorage` (`'desktop-view'` / `'android-view'` = `'enabled'`/`'disabled'`)
4. **Promijene viewport meta tag:**
   - uključeno → `width=1200, initial-scale=0.5, user-scalable=yes, viewport-fit=cover`
   - isključeno → `width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover`
5. `window.scrollTo(0, 0)`

Pri svakom pokretanju aplikacije, `js/app.js` (u `DOMContentLoaded`, ~1673-1710) je
čitao te postavke i vraćao stanje:

```js
const desktopView = localStorage.getItem('desktop-view');
if (desktopView === 'enabled') {
    document.body.classList.add('force-desktop-view');
    /* + .active na dugme, + viewport width=1200, initial-scale=0.5 */
}
const androidView = localStorage.getItem('android-view');
if (androidView === 'enabled') {
    document.body.classList.add('force-android-view');
    /* isto */
}
// Horizontalni tabovi SAMO ako korisnik nikad nije dirao nijedan toggle
if (desktopView === null && androidView === null) {
    document.body.classList.add('force-horizontal-tabs');
}
```

## 3. Šta su klase radile u CSS-u (`css/main.css`)

`force-horizontal-tabs` i `force-android-view` su radili **isto** — sakriju bočni
meni, prikažu horizontalnu traku tabova i sruše grid na jednu kolonu:

```css
body.force-horizontal-tabs .sidebar.desktop-only   { display: none !important; }
body.force-horizontal-tabs .tabs-container.mobile-only { display: block !important; }
body.force-horizontal-tabs .app-layout { grid-template-columns: 1fr !important; }
/* isto za body.force-android-view, plus Kubikator touch-stilovi */
```

**`force-desktop-view` NIJE imao nijedno layout pravilo u `css/main.css`** — jedini
efekat mu je bio viewport `width=1200` i to što je bio *isključni uslov* u
`body:not(.force-desktop-view)` pravilima za Kartu (vidi dolje). Praktično: taj mod
je zadržavao bočni meni.

Klase `force-desktop-view` / `force-android-view` se od v2.63 **više nigdje ne
postavljaju**, ali CSS grane koje ih spominju su ostale u kodu i jednostavno su
neaktivne.

## 4. Zašto je uklonjeno

Korisnik je tražio da nema izbora — uvijek horizontalna traka tabova — i da na to
mjesto dođe ime i prezime radnika.

Uz to, mehanizam je bio izvor više stvarnih problema:

- **Nepredvidiv viewport.** Tri različite širine u opticaju (`1280` iz
  `setAppViewport`, `1200` iz toggle-a, `device-width` na loginu) su činile da se
  `@media` upiti ponašaju različito zavisno od toga šta je korisnik ranije kliknuo.
- **Donja traka Karte je znala biti sitna.** Velike vrijednosti (`min-height:56px`,
  `font-size:16px`, ikona `22px`) stajale su samo unutar
  `@media (min-width:1025px) { body:not(.force-desktop-view) ... }`. U "desktop site"
  načinu na telefonu layout viewport je ~980px → blok se ne poklopi → traka padne na
  osnovu `min-height:42px; font-size:10px`. **Ovo je u v2.63 riješeno tako što su
  velike vrijednosti postale bezuslovna osnova.**
- **Korisnik je mogao ostati zaglavljen.** Ko je jednom uključio "Desktop prikaz",
  ostajao bi na bočnom meniju zauvijek ako se dugmad uklone bez čišćenja
  `localStorage`. Zato v2.63 pri pokretanju **briše** ključeve `'desktop-view'` i
  `'android-view'` i bezuslovno postavlja `force-horizontal-tabs`.

## 5. Ako se ikad vraća — na šta paziti

1. **Ime i uloga su slobodan tekst** iz tabele korisnika (kolone C i D, vidi
   `apps-script/authentication.gs` `handleLogin`). Nisu iz fiksnog skupa — u praksi
   se pojavilo ime `"Tehnolog za gazdovanje šumama"` (29 znakova). Svaki element
   zaglavlja koji prikazuje te vrijednosti **mora** imati `max-width` +
   `text-overflow: ellipsis`, nikako goli `white-space: nowrap`.
2. **Zaglavlje mora ostati u jednom redu.** `.header-content` je `flex-wrap: nowrap`;
   naslov (`.header-left`) ima `min-width: 0` i skraćuje se, a `.header-right` ima
   `flex-shrink: 0` pa dugmad zadržavaju veličinu. Ako se vrati `flex-wrap: wrap`,
   desni dio se pri užem prikazu prelomi u drugi red i `justify-content: space-between`
   ga gurne skroz ulijevo ispod naslova.
3. **Layout viewport je 1280px bez `initial-scale`** (`setAppViewport`, `index.html`).
   Ako bilo šta pređe tu širinu, mobilni browser odzumira **cijelu** stranicu — pa
   aplikacija izgleda kao da zauzima samo dio ekrana, uz vidljivu pozadinu sa strane.
   Simptom djeluje globalno iako uzrok može biti jedan element.
   Dijagnostika u konzoli na uređaju:
   ```js
   document.documentElement.scrollWidth   // > 1280 znači da nešto prelijeva
   [...document.querySelectorAll('*')]
     .filter(e => e.getBoundingClientRect().right > 1281)
     .slice(0, 10)
     .map(e => e.tagName + '.' + e.className + ' → ' + Math.round(e.getBoundingClientRect().right))
   ```
4. **Ne vezivati layout za JS klasu.** Pravila za skrivanje bočnog menija i
   jednokolonski grid ne smiju zavisiti od klase koju postavlja JS unutar `try`
   bloka — ako tamo nešto pukne, raspored ostane razbijen.

## 6. Poznata zaostala greška (nije vezana za ovu izmjenu)

Klasa `login-active` se dodaje na `<body>` pri učitavanju (`index.html`) ali se
**nigdje ne uklanja** — nema nijednog `classList.remove('login-active')` u projektu.
Zbog toga u aplikaciji ostaje aktivan login stil iz `css/login-optimized.css:7`:
ljubičasti gradijent pozadine i `overflow-x: hidden`. Ljubičasta pozadina koja se
vidi sa strane kad nešto prelijeva dolazi odatle. Postoji i u starom i u novom
stanju; nije dirano jer je zaseban problem.
