// ========================================
// 🔍 DIAGNOSTIC - Dijagnostičke funkcije
// ========================================
// Ovaj fajl sadrži dijagnostičke funkcije za debugging i validaciju podataka

function diagnosticOctoberData() {
  try {
    Logger.log('=== OKTOBAR DIJAGNOSTIKA ===');

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName('INDEX_PRIMKA');
    const otpremaSheet = ss.getSheetByName('INDEX_OTPREMA');

    if (!primkaSheet || !otpremaSheet) {
      Logger.log('ERROR: INDEX sheets not found');
      return;
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    const otpremaData = otpremaSheet.getDataRange().getValues();

    // Analiza PRIMKA (Sječa)
    Logger.log('\n=== PRIMKA (SJEČA) - OKTOBAR 2025 ===');
    let primkaSum = 0;
    let primkaCount = 0;

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[0];
      const datum = row[1];
      const kubik = parseFloat(row[22]) || 0; // kolona W - UKUPNO Č+L

      if (!datum || !odjel) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== 2025) continue;
      if (datumObj.getMonth() !== 9) continue; // 9 = Oktobar (0-indexed)

      primkaCount++;
      primkaSum += kubik;

      if (primkaCount <= 20) {
        const datumStr = formatDate(datumObj);
        const rowNum = i + 1;
        Logger.log('Red ' + rowNum + ': ' + odjel + ' | Datum: ' + datumStr + ' | Kubik: ' + kubik.toFixed(2));
      }
    }

    Logger.log('\nUKUPNO PRIMKA OKTOBAR: ' + primkaSum.toFixed(2) + ' m³ (' + primkaCount + ' unosa)');

    // Analiza OTPREMA
    Logger.log('\n=== OTPREMA - OKTOBAR 2025 ===');
    let otpremaSum = 0;
    let otpremaCount = 0;

    for (let i = 1; i < otpremaData.length; i++) {
      const row = otpremaData[i];
      const odjel = row[0];
      const datum = row[1];
      const kupac = row[23] || ""; // KUPAC column
      const kubik = parseFloat(row[22]) || 0; // kolona W - UKUPNO Č+L

      if (!datum || !odjel) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== 2025) continue;
      if (datumObj.getMonth() !== 9) continue; // 9 = Oktobar

      otpremaCount++;
      otpremaSum += kubik;

      const datumStr = formatDate(datumObj);
      const rowNum = i + 1;
      Logger.log('Red ' + rowNum + ': ' + odjel + ' | Datum: ' + datumStr + ' | Kupac: ' + kupac + ' | Kubik: ' + kubik.toFixed(2));
    }

    Logger.log('\nUKUPNO OTPREMA OKTOBAR: ' + otpremaSum.toFixed(2) + ' m³ (' + otpremaCount + ' unosa)');
    Logger.log('RAZLIKA: ' + (primkaSum - otpremaSum).toFixed(2) + ' m³');
    Logger.log('=== KRAJ DIJAGNOSTIKE ===');

  } catch (error) {
    Logger.log('ERROR in diagnosticOctoberData: ' + error.toString());
  }
}

/**
 * DIJAGNOSTIČKA FUNKCIJA: Prikazuje RAW datume iz INDEX_PRIMKA
 * Pomaže da vidimo kako su datumi spremljeni i kako ih parseDate() parsira
 */
function diagnosticRawDates() {
  try {
    Logger.log('=== RAW DATUMI DIJAGNOSTIKA ===');

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName('INDEX_PRIMKA');

    if (!primkaSheet) {
      Logger.log('ERROR: INDEX_PRIMKA sheet not found');
      return;
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    Logger.log('Ukupno redova u INDEX_PRIMKA: ' + primkaData.length);
    Logger.log('\n=== PRVIH 30 REDOVA (primjeri datuma) ===\n');

    const mjeseciCounter = {};
    for (let m = 0; m < 12; m++) {
      mjeseciCounter[m] = 0;
    }

    for (let i = 1; i < Math.min(30, primkaData.length); i++) {
      const row = primkaData[i];
      const odjel = row[0];
      const rawDatum = row[1];
      const kubik = parseFloat(row[22]) || 0;

      const datumType = typeof rawDatum;
      const isDateObj = rawDatum instanceof Date;

      Logger.log('Red ' + (i+1) + ':');
      Logger.log('  Odjel: ' + odjel);
      Logger.log('  RAW datum: "' + rawDatum + '"');
      Logger.log('  Tip: ' + datumType + (isDateObj ? ' (Date objekat)' : ''));

      if (rawDatum) {
        const datumObj = parseDate(rawDatum);
        const isValid = !isNaN(datumObj.getTime());

        if (isValid) {
          const mjesec = datumObj.getMonth();
          const godina = datumObj.getFullYear();
          Logger.log('  Parsiran: ' + formatDate(datumObj) + ' (mjesec=' + mjesec + ', godina=' + godina + ')');

          if (godina === 2025) {
            mjeseciCounter[mjesec]++;
          }
        } else {
          Logger.log('  Parsiran: INVALID DATE!');
        }
      }
      Logger.log('  Kubik: ' + kubik.toFixed(2) + '\n');
    }

    Logger.log('\n=== DISTRIBUCIJA PO MJESECIMA (2025) ===');
    const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
                          'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    for (let m = 0; m < 12; m++) {
      Logger.log(mjeseciNazivi[m] + ': ' + mjeseciCounter[m] + ' unosa');
    }

    Logger.log('\n=== KRAJ DIJAGNOSTIKE ===');

  } catch (error) {
    Logger.log('ERROR in diagnosticRawDates: ' + error.toString());
  }
}

/**
 * DIJAGNOSTIČKA FUNKCIJA: Traži specifični unos od 25.78 m³ u Oktobru
 * Da vidimo zašto se taj unos pojavljuje u PRIMKA
 */
function diagnosticFind2578() {
  try {
    Logger.log('=== TRAŽIM 25.78 UNOS U OKTOBRU ===');

    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);
    const primkaSheet = ss.getSheetByName('INDEX_PRIMKA');

    if (!primkaSheet) {
      Logger.log('ERROR: INDEX_PRIMKA sheet not found');
      return;
    }

    const primkaData = primkaSheet.getDataRange().getValues();
    Logger.log('Ukupno redova u INDEX_PRIMKA: ' + primkaData.length);
    Logger.log('\n=== TRAŽIM UNOSE SA KUBIK = 25.78 U OKTOBRU ===\n');

    let foundCount = 0;

    for (let i = 1; i < primkaData.length; i++) {
      const row = primkaData[i];
      const odjel = row[0];
      const datum = row[1];
      const primac = row[2];
      const kubik = parseFloat(row[22]) || 0; // kolona W - UKUPNO Č+L

      if (!datum || !odjel) continue;

      const datumObj = parseDate(datum);
      if (datumObj.getFullYear() !== 2025) continue;
      if (datumObj.getMonth() !== 9) continue; // 9 = Oktobar

      // Traži unose koji su približno 25.78 (± 0.1)
      if (Math.abs(kubik - 25.78) < 0.1) {
        foundCount++;
        Logger.log('PRONAĐENO! Red ' + (i+1) + ':');
        Logger.log('  Odjel: ' + odjel);
        Logger.log('  Datum: ' + formatDate(datumObj));
        Logger.log('  Primač: ' + primac);
        Logger.log('  Kubik: ' + kubik.toFixed(2));
        Logger.log('  Radilište: ' + (row[21] || ''));
        Logger.log('  Izvođač: ' + (row[22] || ''));
        Logger.log('');
      }
    }

    Logger.log('\n=== UKUPNO PRONAĐENO: ' + foundCount + ' unosa ===');

    // Također traži u OTPREMA
    const otpremaSheet = ss.getSheetByName('INDEX_OTPREMA');
    if (otpremaSheet) {
      const otpremaData = otpremaSheet.getDataRange().getValues();
      Logger.log('\n=== PROVJERA U INDEX_OTPREMA ===\n');

      let otpremaFoundCount = 0;

      for (let i = 1; i < otpremaData.length; i++) {
        const row = otpremaData[i];
        const odjel = row[0];
        const datum = row[1];
        const otpremac = row[2];
        const kubik = parseFloat(row[22]) || 0;

        if (!datum || !odjel) continue;

        const datumObj = parseDate(datum);
        if (datumObj.getFullYear() !== 2025) continue;
        if (datumObj.getMonth() !== 9) continue;

        if (Math.abs(kubik - 25.78) < 0.1) {
          otpremaFoundCount++;
          Logger.log('PRONAĐENO! Red ' + (i+1) + ':');
          Logger.log('  Odjel: ' + odjel);
          Logger.log('  Datum: ' + formatDate(datumObj));
          Logger.log('  Otpremač: ' + otpremac);
          Logger.log('  Kupac: ' + (row[23] || ''));
          Logger.log('  Kubik: ' + kubik.toFixed(2));
          Logger.log('');
        }
      }

      Logger.log('UKUPNO U OTPREMA: ' + otpremaFoundCount + ' unosa');
    }

    Logger.log('=== KRAJ DIJAGNOSTIKE ===');

  } catch (error) {
    Logger.log('ERROR in diagnosticFind2578: ' + error.toString());
  }
}

/**
 * DIJAGNOSTIČKA FUNKCIJA: Čita direktno iz originalnog "RISOVAC KRUPA 64 ZAPISNIK" Google Sheets fajla
 * Da vidimo šta piše u PRIMKA i OTPREMA sheet-ovima
 */
function diagnosticCheckOriginalSheet() {
  try {
    Logger.log('=== PROVJERA ORIGINALNOG SHEET-A "RISOVAC KRUPA 64  ZAPISNIK" ===');

    const folder = DriveApp.getFolderById(ODJELI_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

    let foundFile = null;

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      // Traži fajl sa ovim imenom (može biti sa jednim ili dva razmaka)
      if (fileName.includes('RISOVAC KRUPA 64') && fileName.includes('ZAPISNIK')) {
        foundFile = file;
        Logger.log('Pronađen fajl: "' + fileName + '"');
        break;
      }
    }

    if (!foundFile) {
      Logger.log('ERROR: Fajl "RISOVAC KRUPA 64 ZAPISNIK" nije pronađen!');
      return;
    }

    const ss = SpreadsheetApp.open(foundFile);

    // Provjeri PRIMKA sheet
    const primkaSheet = ss.getSheetByName('PRIMKA');
    if (primkaSheet) {
      Logger.log('\n=== PRIMKA SHEET - SVI OKTOBAR UNOSI ===');

      const primkaData = primkaSheet.getDataRange().getValues();
      Logger.log('Ukupno redova u PRIMKA: ' + primkaData.length);

      let primkaOktobarCount = 0;

      for (let i = 1; i < primkaData.length; i++) {
        const row = primkaData[i];
        const datum = row[1]; // kolona B
        const primac = row[2]; // kolona C
        const kubik = parseFloat(row[22]) || 0; // kolona U

        if (!datum) continue;

        const datumObj = parseDate(datum);
        if (isNaN(datumObj.getTime())) continue;
        if (datumObj.getFullYear() !== 2025) continue;
        if (datumObj.getMonth() !== 9) continue; // Oktobar

        primkaOktobarCount++;
        Logger.log('Red ' + (i+1) + ': Datum=' + formatDate(datumObj) + ' | Primač=' + primac + ' | Kubik=' + kubik.toFixed(2));

        if (Math.abs(kubik - 25.78) < 0.1) {
          Logger.log('  ⚠️ OVO JE 25.78 UNOS!');
        }
      }

      Logger.log('\nUKUPNO PRIMKA OKTOBAR: ' + primkaOktobarCount + ' unosa');
    } else {
      Logger.log('PRIMKA sheet ne postoji!');
    }

    // Provjeri OTPREMA sheet
    const otpremaSheet = ss.getSheetByName('OTPREMA');
    if (otpremaSheet) {
      Logger.log('\n=== OTPREMA SHEET - SVI OKTOBAR UNOSI ===');

      const otpremaData = otpremaSheet.getDataRange().getValues();
      Logger.log('Ukupno redova u OTPREMA: ' + otpremaData.length);

      let otpremaOktobarCount = 0;

      for (let i = 1; i < otpremaData.length; i++) {
        const row = otpremaData[i];
        const datum = row[1]; // kolona B
        const otpremac = row[2]; // kolona C
        const kubik = parseFloat(row[22]) || 0; // kolona U

        if (!datum) continue;

        const datumObj = parseDate(datum);
        if (isNaN(datumObj.getTime())) continue;
        if (datumObj.getFullYear() !== 2025) continue;
        if (datumObj.getMonth() !== 9) continue; // Oktobar

        otpremaOktobarCount++;
        Logger.log('Red ' + (i+1) + ': Datum=' + formatDate(datumObj) + ' | Otpremač=' + otpremac + ' | Kubik=' + kubik.toFixed(2));

        if (Math.abs(kubik - 25.78) < 0.1) {
          Logger.log('  ⚠️ OVO JE 25.78 UNOS!');
        }
      }

      Logger.log('\nUKUPNO OTPREMA OKTOBAR: ' + otpremaOktobarCount + ' unosa');
    } else {
      Logger.log('OTPREMA sheet ne postoji!');
    }

    Logger.log('\n=== KRAJ DIJAGNOSTIKE ===');

  } catch (error) {
    Logger.log('ERROR in diagnosticCheckOriginalSheet: ' + error.toString());
  }
}
