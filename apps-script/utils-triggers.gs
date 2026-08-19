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
    'Jul', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
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

// ========================================
// ZAGRIJAVANJE KEŠA — pozadinsko osvježavanje teških agregatnih pogleda
// ========================================
// Korisnik potvrdio stvaran obrazac korištenja: sječa/otprema se unosi
// RADNIM DANIMA UJUTRO, obično gotovo do 10-11h, i tako ostaje nepromijenjeno
// do sljedećeg radnog dana. Isti "radni prozor" (pon-pet 07:00-14:00, margina
// iznad realnog vremena unosa) kao frontend delta-sync (js/data-sync.js,
// SYNC_CONFIG.WORK_HOURS_START/END) — nema razloga za drugačiji raspored.
//
// Bez ovoga: prvi korisnik koji zatraži podatke nakon isteka CACHE_TTL (10
// min) "plaća" hladan start — desetak teških getDataRange() čitanja
// odjednom, iz frontenda kao 26 paralelnih/red-čekanja HTTP poziva. To je
// uzrok 404 talasa u konzoli (Apps Script odbija dio istovremenih izvršavanja
// kad ih ima previše odjednom).
//
// Ovaj trigger radi TAČNO taj posao unaprijed, IZ JEDNOG izvršavanja (ne 26
// odvojenih HTTP poziva, pa nema konkurentnog opterećenja), tako da kad
// korisnik stvarno zatraži podatke, keš je već topao. Handleri i sami prvo
// provjere keš (getCachedData) prije računanja — ponovni poziv dok je keš
// još važeći je jeftin (samo čitanje keša), pa je trigger samo-ograničavajuć
// i van radnog prozora se odmah vraća bez ijednog čitanja sheeta.
function _uRadnomProzoru() {
  var now = new Date();
  var dan = now.getDay(); // 0=nedjelja...6=subota
  var sat = now.getHours();
  return dan >= 1 && dan <= 5 && sat >= 7 && sat < 14;
}

function zagrijKeseve() {
  if (!_uRadnomProzoru()) {
    Logger.log('[WARM] Van radnog prozora (pon-pet 07-14h) — preskačem.');
    return;
  }

  Logger.log('=== WARM CACHE START ===');

  var now = new Date();
  var y = now.getFullYear();
  var yPrev = y - 1;
  var m = now.getMonth();
  var mPrev = m - 1, yZaMPrev = y;
  if (mPrev < 0) { mPrev = 11; yZaMPrev = y - 1; }

  // Isti skup (godina/mjesec tekući + prošli) koji frontend preload i
  // invalidateCacheZa već koriste — vidi _sviCacheKljucevi (services.gs).
  var pozivi = [
    function() { handleDashboard(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleDashboard(yPrev, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handlePrimaci(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handlePrimaci(yPrev, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleOtpremaci(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleOtpremaci(yPrev, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleKupci(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleMjesecniSortimenti(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleOdjeli(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handlePrimke(ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleOtpreme(ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleGetDinamika(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleStanjeZaliha(ADMIN_USERNAME, ADMIN_PASSWORD, null); },
    function() { handlePrimaciDaily(y, m, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleOtremaciDaily(y, m, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleDailyChart(y, m, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handlePrimaciByRadiliste(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleOtpremaciByRadiliste(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handlePrimaciByIzvodjac(y, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handlePrimaciSortimentiByPrimac(y, m, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handlePrimaciSortimentiByPrimac(yZaMPrev, mPrev, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleOtremaciSortimentiByOtpremac(y, m, ADMIN_USERNAME, ADMIN_PASSWORD); },
    function() { handleOtremaciSortimentiByOtpremac(yZaMPrev, mPrev, ADMIN_USERNAME, ADMIN_PASSWORD); }
  ];

  var uspjesno = 0, neuspjesno = 0;
  pozivi.forEach(function (fn) {
    try { fn(); uspjesno++; } catch (e) { neuspjesno++; Logger.log('[WARM] greška: ' + e.toString()); }
  });

  Logger.log('=== WARM CACHE END === uspjesno=' + uspjesno + ' neuspjesno=' + neuspjesno);
}

/**
 * Setup triggera za zagrijavanje keša — poziva se svakih 30 min tokom cijelog
 * dana, ali zagrijKeseve() interno preskače sve van radnog prozora (pon-pet
 * 07-14h), pa izvan tog prozora ne troši ništa (samo provjeru datuma).
 * POKRENI RUČNO JEDNOM u Apps Script editoru nakon deploya ove verzije.
 */
function setupZagrijavanjeKesevaTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'zagrijKeseve') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Obrisan stari trigger za zagrijKeseve');
    }
  });

  ScriptApp.newTrigger('zagrijKeseve')
    .timeBased()
    .everyMinutes(30)
    .create();

  Logger.log('Kreiran trigger za zagrijKeseve (svakih 30 min, aktivan samo pon-pet 07-14h)');

  // Odmah izvrši prvi put (ako je trenutno u radnom prozoru)
  zagrijKeseve();
}

/**
 * Briši slike starije od 5 dana iz IMAGES_FOLDER_ID
 */
function deleteOldImages() {
  try {
    const folder = DriveApp.getFolderById(IMAGES_FOLDER_ID);
    const files = folder.getFiles();
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    let deletedCount = 0;
    while (files.hasNext()) {
      const file = files.next();
      if (file.getDateCreated() < fiveDaysAgo) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
    Logger.log('Obrisano ' + deletedCount + ' slika starijih od 5 dana');
  } catch (error) {
    Logger.log('ERROR deleteOldImages: ' + error.toString());
  }
}

/**
 * Setup dnevnog triggera za brisanje starih slika
 */
function setupDeleteOldImagesTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'deleteOldImages') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('deleteOldImages')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();

  Logger.log('Kreiran trigger za deleteOldImages (izvršavanje u 3:00 AM)');
}
