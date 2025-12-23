// Mock API za testiranje bez Google Apps Script deploy-a
// Koristi ovaj fajl dok ne deploy-uješ pravi backend

const MOCK_API = {
  // Mock korisnici
  users: [
    { username: 'admin', password: 'admin123', fullName: 'Mirza Hodžić', role: 'admin', type: 'Administrator' },
    { username: 'sumar1', password: 'sumar123', fullName: 'Emir Kusturica', role: 'user', type: 'Šumar' },
    { username: 'vozac1', password: 'vozac123', fullName: 'Dejan Lovren', role: 'user', type: 'Vozač' }
  ],

  // Mock odjeli sa realističnim podacima
  odjeli: [
    { id: '01a', naziv: 'Odjel 01a', projekat: 850.0 },
    { id: '01b', naziv: 'Odjel 01b', projekat: 920.5 },
    { id: '02a', naziv: 'Odjel 02a', projekat: 1100.0 },
    { id: '02b', naziv: 'Odjel 02b', projekat: 780.0 },
    { id: '03a', naziv: 'Odjel 03a', projekat: 1250.0 },
    { id: '03b', naziv: 'Odjel 03b', projekat: 650.0 },
    { id: '04a', naziv: 'Odjel 04a', projekat: 990.0 },
    { id: '04b', naziv: 'Odjel 04b', projekat: 1050.0 },
    { id: '05a', naziv: 'Odjel 05a', projekat: 870.0 },
    { id: '05b', naziv: 'Odjel 05b', projekat: 940.0 }
  ],

  // Login handler
  login(username, password) {
    const user = this.users.find(u => u.username === username && u.password === password);

    if (user) {
      return {
        success: true,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        type: user.type
      };
    }

    return {
      success: false,
      error: 'Pogrešno korisničko ime ili šifra'
    };
  },

  // Generate realistic monthly stats
  generateMonthlyStats(year) {
    const months = [
      'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
      'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
    ];

    // Simuliraj veću sječu tokom ljeta i jeseni
    const seasonalFactors = [0.5, 0.6, 0.8, 0.9, 1.1, 1.2, 1.3, 1.2, 1.1, 1.0, 0.7, 0.4];

    return months.map((mjesec, index) => {
      const baseSjeca = 800 + Math.random() * 200;
      const sjeca = baseSjeca * seasonalFactors[index];
      const otprema = sjeca * (0.85 + Math.random() * 0.1); // 85-95% sječe

      return {
        mjesec,
        sječa: parseFloat(sjeca.toFixed(2)),
        otprema: parseFloat(otprema.toFixed(2))
      };
    });
  },

  // Generate realistic odjeli stats
  generateOdjeliStats() {
    const stats = {};

    this.odjeli.forEach(odjel => {
      const projekat = odjel.projekat;
      const ukupnoPosjeklo = projekat * (0.65 + Math.random() * 0.3); // 65-95% projekta
      const otprema = ukupnoPosjeklo * (0.85 + Math.random() * 0.1);
      const zadnjaSjeca = 35 + Math.random() * 50; // Zadnja sječa 35-85 m³

      // Generiši random datum u posljednjih 30 dana
      const daysAgo = Math.floor(Math.random() * 30);
      const datum = new Date();
      datum.setDate(datum.getDate() - daysAgo);
      const datumZadnjeSjece = datum.toLocaleDateString('bs-BA');

      stats[odjel.id] = {
        sječa: parseFloat(ukupnoPosjeklo.toFixed(2)),
        otprema: parseFloat(otprema.toFixed(2)),
        zadnjaSjeca: parseFloat(zadnjaSjeca.toFixed(2)),
        datumZadnjeSjece,
        projekat,
        ukupnoPosjeklo: parseFloat(ukupnoPosjeklo.toFixed(2))
      };
    });

    return stats;
  },

  // Generate worker stats (primač/otpremač)
  generateWorkerStats(username, type) {
    const months = [
      'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
      'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
    ];

    return months.map((mjesec, index) => {
      const kolicina = 50 + Math.random() * 100; // 50-150 m³ mjesečno
      return {
        mjesec,
        kolicina: parseFloat(kolicina.toFixed(2)),
        brojSjeca: Math.floor(5 + Math.random() * 15) // 5-20 sječa mjesečno
      };
    });
  },

  // Generate detailed cuts with sortiments
  generateDetailedCuts(year) {
    const cuts = [];
    const sortimenti = ['a', 'b', 'c', 'd', 'e'];

    // Generiši 50 random sječa kroz godinu
    for (let i = 0; i < 50; i++) {
      const mjesec = Math.floor(Math.random() * 12);
      const dan = Math.floor(Math.random() * 28) + 1;
      const datum = new Date(year, mjesec, dan);

      const odjel = this.odjeli[Math.floor(Math.random() * this.odjeli.length)].id;

      const cut = {
        datum: datum.toLocaleDateString('bs-BA'),
        odjel,
        sortimenti: {}
      };

      // Dodaj random količine za svaki sortiment
      sortimenti.forEach(sort => {
        const kolicina = Math.random() < 0.7 ? (Math.random() * 30).toFixed(2) : 0; // 70% šanse da ima sortiment
        if (parseFloat(kolicina) > 0) {
          cut.sortimenti[sort] = parseFloat(kolicina);
        }
      });

      cuts.push(cut);
    }

    // Sortiraj po datumu
    cuts.sort((a, b) => {
      const dateA = new Date(a.datum.split('.').reverse().join('-'));
      const dateB = new Date(b.datum.split('.').reverse().join('-'));
      return dateB - dateA; // Najnovije prvo
    });

    return cuts;
  },

  // Stats handler
  getStats(year, username, password) {
    // Provjeri autentikaciju
    const loginResult = this.login(username, password);
    if (!loginResult.success) {
      return { error: 'Unauthorized' };
    }

    const user = this.users.find(u => u.username === username);
    const monthlyStats = this.generateMonthlyStats(year);
    const odjeliStats = this.generateOdjeliStats();

    // Izračunaj totale
    const totalPrimka = monthlyStats.reduce((sum, m) => sum + m.sječa, 0);
    const totalOtprema = monthlyStats.reduce((sum, m) => sum + m.otprema, 0);

    const response = {
      totalPrimka: parseFloat(totalPrimka.toFixed(2)),
      totalOtprema: parseFloat(totalOtprema.toFixed(2)),
      monthlyStats,
      odjeliStats,
      userType: user.type
    };

    // Dodaj podatke specifične za radnike
    if (user.type === 'Šumar' || user.type === 'Primač') {
      response.workerStats = this.generateWorkerStats(username, 'primka');
      response.detailedCuts = this.generateDetailedCuts(year);
    } else if (user.type === 'Vozač' || user.type === 'Otpremač') {
      response.workerStats = this.generateWorkerStats(username, 'otprema');
      response.detailedCuts = this.generateDetailedCuts(year);
    }

    return response;
  }
};

// Export za browser
if (typeof window !== 'undefined') {
  window.MOCK_API = MOCK_API;
}

// Export za Node.js (ako treba)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MOCK_API;
}
