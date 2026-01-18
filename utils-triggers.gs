// ============================================
// UTILS-TRIGGERS.GS - Utility Functions & Triggers
// ============================================
// Sadrži: formatDate, parseDate, createJsonResponse, formatDateHelper
//         onOpen, azurirajStanjeZaliha, formatirajStanjeZalihaSheet,
//         postaviAutomatskoAzuriranjeStanjeZaliha, azurirajStanjeZalihaAutomatski

// Formatiranje datuma
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * KRITIČNA FUNKCIJA: Parsira datume iz Google Sheets
 *
 * PROBLEM: Google Sheets vraća datume kao Date objekte ILI stringove
 * Kada su stringovi u formatu "DD/MM/YYYY", JavaScript's new Date() ih
 * interpretira kao "MM/DD/YYYY" što uzrokuje da April i Oktobar budu zamijenjeni!
 *
 * RJEŠENJE: Ova funkcija detektuje format i parsira ispravno
 */
function parseDate(datum) {
  // Ako je već Date objekat, vrati ga direktno
  if (datum instanceof Date) {
    return datum;
  }

  // Ako je broj (timestamp), konvertuj u Date
  if (typeof datum === 'number') {
    return new Date(datum);
  }

  // Ako je string, parsuj pažljivo
  if (typeof datum === 'string') {
    const str = datum.trim();

    // Format: DD/MM/YYYY ili DD.MM.YYYY ili DD-MM-YYYY
    const ddmmyyyyPattern = /^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/;
    const match = str.match(ddmmyyyyPattern);

    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JavaScript mjeseci su 0-indexed
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    }

    // Fallback: pokušaj sa standardnim parserom (za ISO format)
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Ako ništa ne radi, vrati nevažeći datum
  return new Date(NaN);
}
// Pomoćna funkcija za JSON response
function createJsonResponse(data, success) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  // ✅ CORS Support - Try setHeader (V8 runtime), fallback if not available (Rhino)
  try {
    if (typeof output.setHeader === 'function') {
      output.setHeader('Access-Control-Allow-Origin', '*');
      output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      Logger.log('[CORS] Headers set successfully using setHeader()');
    } else {
      Logger.log('[CORS] WARNING: setHeader not available (Rhino runtime?)');
    }
  } catch (e) {
    Logger.log('[CORS] WARNING: setHeader failed: ' + e.toString());
    // Continue without headers - CORS won't work but at least no error
  }

  return output;
}
// Helper funkcija za formatiranje datuma
function formatDateHelper(dateValue) {
  if (!dateValue) return '';

  try {
    const date = new Date(dateValue);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(dateValue);
  }
}

// ========== STANJE ZALIHA FUNKCIONALNOST ==========

/**
 * Kreira ili ažurira meni kada se otvori INDEX spreadsheet
 */
function onOpen() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();

    ui.createMenu('STANJE ZALIHA')
      .addItem('Osvježi podatke', 'azurirajStanjeZaliha')
      .addToUi();

    Logger.log('Meni STANJE ZALIHA kreiran uspješno');
  } catch (error) {
    Logger.log('ERROR u onOpen: ' + error.toString());
  }
}

/**
 * Glavna funkcija koja ažurira STANJE ZALIHA sheet
 * Čita podatke iz svih fajlova u ODJELI folderu i prikazuje stanje zaliha po odjelima
 */
/**
 * ⚡ ULTRA OPTIMIZOVANA verzija - OTVARA SVAKI FAJL SAMO JEDNOM
 * Eliminisan dupli prolaz koji je uzrokovao "maximum execution time" grešku
 */
function azurirajStanjeZaliha() {
  try {
    Logger.log('=== AŽURIRANJE STANJE ZALIHA - START (OPTIMIZED) ===');

    // 1. Otvori INDEX spreadsheet
    const ss = SpreadsheetApp.openById(INDEX_SPREADSHEET_ID);

    // 2. Kreiraj ili očisti STANJE ZALIHA sheet
    let stanjeSheet = ss.getSheetByName('STANJE ZALIHA');

    if (!stanjeSheet) {
      Logger.log('Kreiram novi sheet STANJE ZALIHA');
      stanjeSheet = ss.insertSheet('STANJE ZALIHA');
    } else {
      Logger.log('Čistim postojeći sheet STANJE ZALIHA');
      stanjeSheet.clear();
    }

    // 3. Otvori folder sa odjelima
    Logger.log('Otvaranje foldera ODJELI: ' + ODJELI_FOLDER_ID);
    const folder = DriveApp.getFolderById(ODJELI_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

    const MAX_ODJELA = 25; // Limit da ne traje predugo i da ne prekorači execution time

    // 4. JEDAN PROLAZ: Prikupi podatke i obradi SVE ODJEDNOM
    Logger.log('Prikupljam i procesujem odjele (JEDAN PROLAZ)...');
    let odjeliSaPodacima = [];

    while (files.hasNext()) {
      const file = files.next();
      const odjelNaziv = file.getName();

      try {
        // OTVORI FAJL SAMO JEDNOM
        const odjelSS = SpreadsheetApp.open(file);
        const primkaSheet = odjelSS.getSheetByName('PRIMKA');
        const otpremaSheet = odjelSS.getSheetByName('OTPREMA');

        // Preskoči ako nema potrebnih listova
        if (!primkaSheet || !otpremaSheet) {
          Logger.log(`  Preskačem ${odjelNaziv} - nema PRIMKA ili OTPREMA`);
          continue;
        }

        // Pronađi maksimalni datum u PRIMKA listu (kolona B)
        const lastRow = primkaSheet.getLastRow();
        if (lastRow < 2) {
          Logger.log(`  Preskačem ${odjelNaziv} - nema podataka`);
          continue;
        }

        // Pročitaj sve datume iz kolone B (od reda 2 nadalje)
        const datumi = primkaSheet.getRange(2, 2, lastRow - 1, 1).getValues();

        // Pronađi maksimalni datum
        let maxDatum = null;
        for (let i = 0; i < datumi.length; i++) {
          const datum = datumi[i][0];
          if (datum && datum instanceof Date) {
            if (!maxDatum || datum > maxDatum) {
              maxDatum = datum;
            }
          }
        }

        if (!maxDatum) {
          Logger.log(`  Preskačem ${odjelNaziv} - nema validnih datuma`);
          continue;
        }

        // PROČITAJ SVE POTREBNE PODATKE ODJEDNOM (BATCH READ)
        const otpremaData = otpremaSheet.getRange('D9:U13').getValues();

        const sortimentiZaglavlje = otpremaData[0]; // Red 9
        const projekatRed = otpremaData[1];          // Red 10
        const sjecaRed = otpremaData[2];             // Red 11
        const otpremaRed = otpremaData[3];           // Red 12
        const sumaLagerRed = otpremaData[4];         // Red 13

        // SAČUVAJ SVE PODATKE U NIZ
        odjeliSaPodacima.push({
          naziv: odjelNaziv,
          maxDatum: maxDatum,
          sortimentiZaglavlje: sortimentiZaglavlje,
          projekatRed: projekatRed,
          sjecaRed: sjecaRed,
          otpremaRed: otpremaRed,
          sumaLagerRed: sumaLagerRed
        });

        Logger.log(`  ✓ ${odjelNaziv}: ${maxDatum.toLocaleDateString()}`);

      } catch (error) {
        Logger.log(`  ERROR ${odjelNaziv}: ${error.toString()}`);
      }
    }

    Logger.log(`Prikupljeno ${odjeliSaPodacima.length} odjela sa podacima`);

    // 5. Sortiraj po datumu (najnoviji prvi)
    odjeliSaPodacima.sort(function(a, b) {
      return b.maxDatum - a.maxDatum; // Descending
    });

    Logger.log('Odjeli sortirani po svježini (najnoviji prvi)');

    // 6. Formatiraj podatke za upis (samo prvih MAX_ODJELA)
    let allData = [];
    let processedCount = 0;

    const odjeliZaUpis = odjeliSaPodacima.slice(0, MAX_ODJELA);
    Logger.log(`Formatiram ${odjeliZaUpis.length} najsvježijih odjela za upis...`);

    for (let i = 0; i < odjeliZaUpis.length; i++) {
      const odjel = odjeliZaUpis[i];
      processedCount++;

      // Dodaj prazan red prije svakog odjela (osim prvog)
      if (allData.length > 0) {
        allData.push([]); // Prazan red kao separator
      }

      // Red 1: Zaglavlje sa imenom odjela
      allData.push(['ODJEL ' + odjel.naziv]);

      // Red 2: SORTIMENTI zaglavlje (prazne kolone B i C, pa onda sortimenti od D)
      allData.push(['SORTIMENTI:', '', '', ...odjel.sortimentiZaglavlje]);

      // Red 3: PROJEKAT + podaci iz reda 10
      allData.push(['PROJEKAT', '', '', ...odjel.projekatRed]);

      // Red 4: SJEČA + podaci iz reda 11
      allData.push(['SJEČA', '', '', ...odjel.sjecaRed]);

      // Red 5: OTPREMA + podaci iz reda 12
      allData.push(['OTPREMA', '', '', ...odjel.otpremaRed]);

      // Red 6: ŠUMA LAGER + podaci iz reda 13
      allData.push(['ŠUMA LAGER', '', '', ...odjel.sumaLagerRed]);
    }

    Logger.log(`Formatirano ${processedCount} odjela`);

    // 7. Upiši sve podatke u STANJE ZALIHA sheet
    if (allData.length > 0) {
      Logger.log(`Upisujem ${allData.length} redova u STANJE ZALIHA sheet`);

      // Pronađi maksimalnu širinu (broj kolona) svih redova
      let maxCols = 0;
      for (let i = 0; i < allData.length; i++) {
        if (allData[i].length > maxCols) {
          maxCols = allData[i].length;
        }
      }

      // Normalizuj sve redove da imaju istu dužinu (popuni sa praznim stringovima)
      for (let i = 0; i < allData.length; i++) {
        while (allData[i].length < maxCols) {
          allData[i].push('');
        }
      }

      Logger.log(`Maksimalan broj kolona: ${maxCols}`);
      stanjeSheet.getRange(1, 1, allData.length, maxCols).setValues(allData);

      // 8. Formatiraj sheet
      formatirajStanjeZalihaSheet(stanjeSheet);

      Logger.log('Podaci uspješno upisani i formatirani');
    } else {
      Logger.log('Nema podataka za upisivanje');
    }

    Logger.log('=== AŽURIRANJE STANJE ZALIHA - END ===');

    // Prikaži poruku korisniku
    if (SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert(`✓ Ažurirano! Procesovano ${processedCount} najsvježijih odjela.`);
    }

    return { success: true, processedCount: processedCount };

  } catch (error) {
    Logger.log('ERROR u azurirajStanjeZaliha: ' + error.toString());

    if (SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert('Greška: ' + error.toString());
    }
    throw error;
  }
}

/**
 * Formatira STANJE ZALIHA sheet za bolji prikaz
 * ULTRA OPTIMIZOVANO: Koristi BATCH operacije - formatira sve odjednom
 */
function formatirajStanjeZalihaSheet(sheet) {
  try {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0) return;

    Logger.log(`Formatiranje sheet-a: ${lastRow} redova, ${lastCol} kolona - START`);

    // 1. Podesi širinu kolona (batch operacija)
    sheet.setColumnWidth(1, 200);
    if (lastCol > 1) {
      sheet.setColumnWidths(2, lastCol - 1, 80);
    }

    // 2. Pročitaj SVE vrednosti ODJEDNOM
    const allValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();

    // 3. Kreiraj matrice - ALI PAMETNO: Fill samo kada je potrebno
    // Umjesto da inicijalizujem sve ćelije, kreiram prazne nizove
    const backgrounds = Array(lastRow).fill(null).map(() => Array(lastCol).fill('#FFFFFF'));
    const fontColors = Array(lastRow).fill(null).map(() => Array(lastCol).fill('#000000'));
    const fontWeights = Array(lastRow).fill(null).map(() => Array(lastCol).fill('normal'));
    const fontSizes = Array(lastRow).fill(null).map(() => Array(lastCol).fill(10));
    const horizontalAlignments = Array(lastRow).fill(null).map(() => Array(lastCol).fill('left'));

    // 4. Postavi formatiranje za svaki red prema tipu
    for (let row = 0; row < lastRow; row++) {
      const cellValue = allValues[row][0];

      if (!cellValue || cellValue === '') {
        continue; // Prazan red - ostavi default
      }

      // ODJEL zaglavlje (plavo)
      if (cellValue.toString().startsWith('ODJEL ')) {
        const bgRow = Array(lastCol).fill('#4A86E8');
        const fcRow = Array(lastCol).fill('white');
        const fwRow = Array(lastCol).fill('bold');
        const fsRow = Array(lastCol).fill(12);
        const haRow = Array(lastCol).fill('center');

        backgrounds[row] = bgRow;
        fontColors[row] = fcRow;
        fontWeights[row] = fwRow;
        fontSizes[row] = fsRow;
        horizontalAlignments[row] = haRow;
      }
      // SORTIMENTI zaglavlje (zeleno)
      else if (cellValue.toString().startsWith('SORTIMENTI:')) {
        backgrounds[row] = Array(lastCol).fill('#93C47D');
        fontWeights[row] = Array(lastCol).fill('bold');
        horizontalAlignments[row] = Array(lastCol).fill('center');
      }
      // Redovi sa podacima (PROJEKAT, SJEČA, OTPREMA, ŠUMA LAGER)
      else {
        // Prva kolona - label
        backgrounds[row][0] = '#F3F3F3';
        fontWeights[row][0] = 'bold';
        horizontalAlignments[row][0] = 'left';

        // Kolone sa brojevima (od D nadalje) - center align
        for (let col = 3; col < lastCol; col++) {
          horizontalAlignments[row][col] = 'center';
        }
      }
    }

    // 5. Primjeni SVE formatiranje ODJEDNOM - jedan API poziv po tipu formatiranja
    const fullRange = sheet.getRange(1, 1, lastRow, lastCol);

    fullRange.setBackgrounds(backgrounds);
    fullRange.setFontColors(fontColors);
    fullRange.setFontWeights(fontWeights);
    fullRange.setFontSizes(fontSizes);
    fullRange.setHorizontalAlignments(horizontalAlignments);

    // 6. Setuj number format samo za kolone sa brojevima (D nadalje)
    if (lastCol > 3) {
      sheet.getRange(1, 4, lastRow, lastCol - 3).setNumberFormat('#,##0.00');
    }

    // 7. Zamrzni prvu kolonu
    sheet.setFrozenColumns(1);

    Logger.log('Formatiranje završeno - END');

  } catch (error) {
    Logger.log('ERROR u formatirajStanjeZalihaSheet: ' + error.toString());
  }
}

/**
 * Postavlja timer za automatsko dnevno ažuriranje STANJE ZALIHA
 * Poziva se samo jednom da kreira trigger
 */
function postaviAutomatskoAzuriranjeStanjeZaliha() {
  try {
    // Prvo obriši postojeće triggere za ovu funkciju
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'azurirajStanjeZalihaAutomatski') {
        ScriptApp.deleteTrigger(triggers[i]);
        Logger.log('Obrisan postojeći trigger');
      }
    }

    // Kreiraj novi trigger - svaki dan u 10:00
    ScriptApp.newTrigger('azurirajStanjeZalihaAutomatski')
      .timeBased()
      .everyDays(1)
      .atHour(10)
      .create();

    Logger.log('Automatsko ažuriranje postavljeno za svaki dan u 10:00');

    if (SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert('Automatsko ažuriranje postavljeno za svaki dan u 10:00');
    }

  } catch (error) {
    Logger.log('ERROR u postaviAutomatskoAzuriranjeStanjeZaliha: ' + error.toString());

    if (SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert('Greška: ' + error.toString());
    }
  }
}

/**
 * Funkcija koja se poziva automatski svaki dan
 * Ažurira STANJE ZALIHA samo radnim danima
 */
function azurirajStanjeZalihaAutomatski() {
  try {
    const danas = new Date();
    const danUNedelji = danas.getDay(); // 0 = nedjelja, 6 = subota

    // Ažuriraj samo radnim danima (ponedeljak-petak)
    if (danUNedelji >= 1 && danUNedelji <= 5) {
      Logger.log('Automatsko ažuriranje STANJE ZALIHA - radni dan');
      azurirajStanjeZaliha();
    } else {
      Logger.log('Automatsko ažuriranje STANJE ZALIHA - preskočeno (vikend)');
    }

  } catch (error) {
    Logger.log('ERROR u azurirajStanjeZalihaAutomatski: ' + error.toString());
  }
}
