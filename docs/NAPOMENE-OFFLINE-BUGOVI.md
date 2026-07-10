# Napomene — provjera bugova offline implementacije + "Ažuriraj podatke"

**Datum:** 05.07.2026.
**Kontekst:** samoprovjera nakon implementacije potpunog offline rada (commit `b6c70a3`) i redizajn opcije "Ažuriraj podatke".

---

## 🐛 PRONAĐENI I ISPRAVLJENI BUGOVI

**1. Pending unosi — neusklađen keš ključ (offline rupa)**
Preload je keširao pod `cache_pending_unosi`, a novi offline-loader čitao `cache_pending_unosi_view`. Posljedica: admin koji nikad nije ručno otvorio tab "Dodani unosi" dok je online ne bi offline vidio ništa, iako je preload uredno keširao podatke.
**Fix:** loader sada koristi isti ključ `cache_pending_unosi`.

**2. 'online' handler mogao obrisati polupopunjenu formu**
Kad se mreža vrati, handler osvježava aktivni tab (`switchTab`). Ako radnik na terenu popunjava "Dodaj sječu" i signal zatreperi (offline→online), re-render forme bi obrisao sve uneseno.
**Fix:** tabovi s formama (`add-sjeca`, `add-otprema`, `edit-sjeca`, `edit-otprema`) izuzeti iz auto-osvježavanja — provjera i pri okidanju i unutar debounce timeouta.

---

## ⚠️ POZNATA OGRANIČENJA (svjesne odluke — ne dirati bez razloga)

**O1. Offline prijava sa starom lozinkom nakon promjene na serveru**
`sumarija_offline_auth` snapshot se osvježava tek pri sljedećoj uspješnoj online prijavi. Ako admin promijeni lozinku radniku, radnik OFFLINE i dalje može ući sa STAROM lozinkom (do prve online sesije, kada `_handleUnauthorized` odjavi i sljedeća online prijava prepiše snapshot). Prihvaćen kompromis — alternativa (nikakav offline ulaz) je gora za teren. Napomena: pri online prijavi novom lozinkom snapshot se odmah ažurira.

**O2. Lozinka u offline snapshotu je plain tekst**
Ista razina rizika kao postojeći `sumarija_pass` (poznata preporuka P1 iz Dijela 1 — čeka token sistem na GAS backendu). Kad se uvede token, offline snapshot preći na hash provjeru.

**O3. Keš preživljava odjavu (by design)**
Od commita `b6c70a3` keš se briše tek pri prijavi DRUGOG korisnika (`sumarija_cache_owner` model), ne pri odjavi. Podaci u localStorage su čitljivi svakome s fizičkim pristupom pregledniku — isto kao i prije (i sesijski ključevi su bili). Za čitanje kroz aplikaciju potrebna je tačna lozinka vlasnika keša.

**O4. Offline unos (pisanje) ne postoji**
Nova sječa/otprema offline i dalje ne radi — zahtijeva offline queue + sync + rješavanje konflikata. Svjesno van obima; kandidat za sljedeću fazu.

**O5. `AbortSignal.timeout` browser podrška**
Koristi se u `fetchPreklasiranjaCached` i manifest checku — zahtijeva Safari ≥15.4 / Chrome ≥103. Konzistentno s ostatkom koda (manifest check ga je već koristio).

---

## 🔄 REDIZAJN "AŽURIRAJ PODATKE" (osvježi-u-mjestu)

**Staro ponašanje:** obriši SAV keš → unregistruj SW → reload stranice → svaki tab se ponovo učitava sa spore GAS mreže (60-180 s po tabu) → korisnik gleda spinnere.

**Novo ponašanje (`_doRefreshAllData`):**
1. Bez brisanja ičega — stari podaci ostaju vidljivi tokom cijelog procesa
2. `preloadAllViews(false, true)` force-fetcha SVE prikaze u pozadini (progress toast "X / Y prikaza"); svaki uspješan fetch prepiše svoj keš ključ, a neuspješan OSTAVI stari keš (ranije bi taj prikaz ostao prazan!)
3. `window._tabRenderTime = {}` — svaki sljedeći ulazak u tab instantno renderuje iz svježeg keša (turboShow putanja), bez čekanja
4. Aktivni tab se odmah re-renderuje s novim podacima
5. Offline guard: bez mreže samo poruka, ništa se ne dira

**Sigurnosna mreža:** stara "spali sve" logika sačuvana kao `window.hardResetCache()` — poziva se ručno iz konzole ako keš ikad korumpira (briše localStorage cache_*, SW keševe, unregistruje SW, reload).

---

## ✔️ PROVJERENO — NEMA PROBLEMA

- `_doRefreshAllData` ne dira `sumarija_offline_auth` ni `sumarija_cache_owner` — offline prijava preživljava ažuriranje.
- `hardResetCache` ne briše offline snapshot (nije `cache_` prefiks) — offline prijava preživljava i hard reset.
- Foreign-login brisanje keša testirano simulacijom: isti korisnik zadržava keš ✓, drugi korisnik briše tuđi keš + snapshot ✓.
- `fetchPreklasiranjaCached` degradira gracefully: mreža → keš → prazan niz.
- In-flight dedup u `fetchWithCache` ne smeta force-refresh preloadu (forceRefresh zaobilazi dedup).
