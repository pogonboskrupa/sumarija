# Viewport: uzrok "uvećanog prikaza" i rješenje (v2.68)

Zapis o grešci koja je kroz više verzija davala različite, naizgled nepovezane
simptome. Cilj: da se ne troši vrijeme na ponovno otkrivanje istog uzroka.

## Simptomi (svi su bili ISTA greška)

- Aplikacija zauzima samo dio ekrana, ostatak je gola (ljubičasta) pozadina
- Tabovi ogromni — samo tri stanu u red, ostalo se mora skrolati vodoravno
- Sadržaj "zalijepljen" uz lijevu ivicu, prazan prostor desno
- Donja traka na Karti čas velika, čas sitna, bez očigledne logike
- Prvo učitavanje izgleda ispravno, prelazak na drugi tab pokvari prikaz

## Uzrok

Aplikacija je koristila **tri različite širine viewporta**, zavisno od toga šta je
korisnik ranije kliknuo:

| Kada | `meta[name=viewport]` |
|---|---|
| Login ekran | `width=device-width, initial-scale=1.0` |
| Aplikacija (`setAppViewport`) | `width=1280` |
| "Desktop"/"Android prikaz" UKLJUČEN | `width=1200, initial-scale=0.5` |
| "Desktop"/"Android prikaz" ISKLJUČEN | `width=device-width` ← **greška** |

Ključni previd: gašenje moda je vraćalo `width=device-width` (~400px na telefonu)
umjesto na aplikacijskih 1280px. Aplikacija bi ostala na 400px layout viewportu →
sve renderovano uvećano, malo sadržaja stane u ekran, vodoravno skrolanje.

Uz to, `@media (min-width: ...)` upiti su se ponašali različito zavisno od moda:
- `width=1280` → `min-width:1025px` grane se poklapaju
- "desktop site" u browseru (~980px) → NE poklapaju se
- `width=1200` → poklapaju se, ali uz `initial-scale=0.5`

Zbog toga je npr. donja traka na Karti (velike vrijednosti su stajale samo unutar
`@media (min-width:1025px)`) znala pasti na sitnu osnovu bez vidljivog razloga.

### Zašto se pojavilo tek u v2.65

Do v2.65 je `setAppViewport()` **bezuslovno** postavljao 1280 i poziva se iz
`showApp()`, dakle POSLIJE vraćanja zapamćenih postavki — pa je promjena viewporta
iz prekidača bila bez ikakvog efekta. Greška je postojala u kodu, ali je bila
neaktivna. U v2.65 je `setAppViewport()` izmijenjen da "poštuje" izabrani mod, čime
je latentna greška postala vidljiva.

**Pouka:** kad izmjena "otkrije" grešku, uzrok obično nije ta izmjena.

## Rješenje (v2.68)

**JEDNA širina viewporta za cijelu aplikaciju.**

- `setAppViewport()` uvijek postavlja `width=1280`, bez izuzetaka
- `toggleDesktopView()` / `toggleAndroidView()` (`js/ui.js`) i vraćanje postavki pri
  pokretanju (`js/app.js`) **ne diraju viewport** — mijenjaju samo raspored, preko
  klasa na `<body>`: `force-desktop-view` / `force-android-view` /
  `force-horizontal-tabs`
- `width=device-width` ostaje isključivo za login ekran (`setLoginViewport`)

Time `@media` upiti imaju predvidivo ponašanje bez obzira na izabrani mod.

## Pravila za ubuduće

1. **Ne mijenjati `meta[name=viewport]` nigdje osim u `setLoginViewport` /
   `setAppViewport`.** Ako se pojavi potreba za drugom širinom, to je gotovo sigurno
   znak da problem treba riješiti u CSS-u.
2. **`@media (min-width: ...)` ne razlikuje telefon od desktopa** u ovoj aplikaciji,
   jer je viewport fiksiran na 1280px za sve. Za stvarnu širinu uređaja koristiti
   `window.screen.width` (viewport meta je ne mijenja) — vidi `markScreenClass()` u
   `index.html`, koja postavlja klasu `body.is-desktop-screen`.
3. **Ne vezivati veličine terenskih elemenata za `@media` širinu.** Donja traka na
   Karti je zbog toga znala biti sitna; ako treba da bude velika, neka joj vrijednosti
   budu bezuslovna osnova.
4. **Dijagnostika prelijevanja** — u konzoli na samom uređaju:
   ```js
   document.documentElement.scrollWidth   // > 1280 znači da nešto prelijeva
   [...document.querySelectorAll('*')]
     .filter(e => e.getBoundingClientRect().right > 1281)
     .slice(0, 10)
     .map(e => e.tagName + '.' + e.className + ' → ' + Math.round(e.getBoundingClientRect().right))
   ```
   Prvi red kaže IMA LI problema, drugi kaže GDJE je. Bez ovoga se uzrok traži
   nagađanjem, što je u ovom slučaju odnijelo nekoliko krugova.

## Povezano

- `docs/ZAGLAVLJE-DESKTOP-ANDROID-PRIKAZ.md` — kako je izgledao izbor prikaza i na šta
  paziti pri izmjenama zaglavlja.
- Poznata zaostala greška: klasa `login-active` se dodaje na `<body>` ali se nikad ne
  uklanja, pa u aplikaciji ostaje login gradijent iz `css/login-optimized.css`. To je
  ta ljubičasta pozadina koja se vidi sa strane kad nešto prelijeva. Zaseban problem,
  nije dirano.
