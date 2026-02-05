// ========================================
// 🛠️ UTILS & TRIGGERS - Utility funkcije i automatski triggeri
// ========================================
// Ovaj fajl sadrži pomoćne utility funkcije koje se koriste u cijeloj aplikaciji
// kao i setup funkcije za automatske triggere

// ========================================
// UTILITY FUNKCIJE
// ========================================

// Kreiranje prazne mjesečne statistike
function createMonthlyStats() {
  const mjeseci = [
    'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
    'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
  ];

  return mjeseci.map(mjesec => ({
    mjesec: mjesec,
    sječa: 0,
    otprema: 0
  }));
}

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
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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

// ========================================
// TRIGGER SETUP FUNKCIJE
// ========================================

/**
 * Setup dnevnog triggera za sinkronizaciju stanja odjela
 * Izvršava se svaki dan u 2:00 AM
 */
function setupStanjeOdjelaDailyTrigger() {
  // Obriši postojeće triggere za ovu funkciju
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncStanjeOdjela') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Obrisan stari trigger za syncStanjeOdjela');
    }
  });

  // Kreiraj novi trigger koji se izvršava svaki dan u 2:00 AM
  ScriptApp.newTrigger('syncStanjeOdjela')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();

  Logger.log('Kreiran novi dnevni trigger za syncStanjeOdjela (izvršavanje u 2:00 AM)');

  // Odmah izvrši prvi put
  syncStanjeOdjela();
}
