// ========================================
// 🔐 AUTHENTICATION - Login i autentifikacija
// ========================================
// Ovaj fajl sadrži funkcije za autentifikaciju korisnika
// - verifyUser: Provjerava kredencijale i vraća korisnički objekt
// - handleLogin: API endpoint za login

// Helper function to verify user credentials
function verifyUser(username, password) {
  const ss = SpreadsheetApp.openById(KORISNICI_SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName('Korisnici');

  if (!usersSheet) {
    return null;
  }

  const data = usersSheet.getDataRange().getValues();

  // Check if admin
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return {
      username: username,
      ime: 'Administrator',
      uloga: 'admin',
      tip: 'admin'
    };
  }

  // Check regular users
  // Structure: A = username, B = password, C = ime_prezime, D = tip (primac/otpremac)
  for (let i = 1; i < data.length; i++) {
    const storedPassword = String(data[i][1]);
    const inputPassword = String(password);

    if (String(data[i][0]) === String(username) && storedPassword === inputPassword) {
      return {
        username: username,
        ime: data[i][2], // Full name
        uloga: 'user',
        tip: data[i][3] || 'user'
      };
    }
  }

  return null;
}

// Upiši vrijeme zadnje prijave u list Korisnici (kolona "ZADNJI LOGIN").
// Kolona se traži po zaglavlju; ako ne postoji, dodaje se iza zadnje popunjene kolone,
// pa se nikad ne prepisuje postojeći sadržaj. Greška ovdje NE smije srušiti prijavu.
// Upis se preskače ako je zadnji upis mlađi od 5 min (auto-prijava pri svakom otvaranju
// aplikacije bi inače pisala u sheet stalno).
function zabiljeziLogin(usersSheet, headerRow, rowValues, sheetRowNumber) {
  try {
    const NAZIV = 'ZADNJI LOGIN';
    let col = -1;
    for (let c = 0; c < headerRow.length; c++) {
      if (String(headerRow[c] || '').trim().toUpperCase() === NAZIV) { col = c; break; }
    }
    if (col === -1) {
      col = headerRow.length; // iza zadnje kolone koja je u opsegu podataka
      usersSheet.getRange(1, col + 1).setValue(NAZIV).setFontWeight('bold');
    }

    const prethodni = rowValues[col];
    const sada = new Date();
    if (prethodni instanceof Date && (sada - prethodni) < 5 * 60 * 1000) return;

    usersSheet.getRange(sheetRowNumber, col + 1)
      .setValue(sada)
      .setNumberFormat('dd.MM.yyyy HH:mm:ss');
  } catch (e) {
    Logger.log('zabiljeziLogin greška (ignorisano): ' + e);
  }
}

// Login handler
// zabiljezi=true samo za pravu prijavu (path=login) — handleLogin se interno poziva i
// iz svakog drugog handlera radi autentikacije, i tada se ništa ne upisuje
function handleLogin(username, password, zabiljezi) {
  const ss = SpreadsheetApp.openById(KORISNICI_SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName('Korisnici'); // Sheet name: "Korisnici"

  if (!usersSheet) {
    return createJsonResponse({ error: 'Users sheet not found' }, false);
  }

  const data = usersSheet.getDataRange().getValues();

  // Struktura: A = username, B = password, C = ime_prezime, D = tip (primac/otpremac)
  for (let i = 1; i < data.length; i++) { // skip header (red 1)
    // Konverzija password u string za poređenje
    const storedPassword = String(data[i][1]);
    const inputPassword = String(password);

    if (String(data[i][0]) === String(username) && storedPassword === inputPassword) {
      if (zabiljezi) zabiljeziLogin(usersSheet, data[0], data[i], i + 1);
      // trim/lowercase — bez ovoga bilo koji razmak ili varijanta velikih
      // slova u koloni D šifrarnika (npr. "Primac " ili "primač") ne pogađa
      // strogo poređenje na frontendu i korisnik tiho dobije PUN admin prikaz
      // (vidi js/auth.js showApp/loadData, else grana)
      const tip = String(data[i][3] || '').trim().toLowerCase(); // primac ili otpremac

      return createJsonResponse({
        success: true,
        username: username,
        fullName: data[i][2], // ime_prezime je već kompletno ime
        role: 'user', // svi su radnici
        type: tip || 'Korisnik',
        userType: tip === 'primac' ? 'Primač' : (tip === 'otpremac' ? 'Otpremač' : 'Korisnik')
      }, true);
    }
  }

  return createJsonResponse({
    success: false,
    error: 'Pogrešno korisničko ime ili šifra'
  }, false);
}
