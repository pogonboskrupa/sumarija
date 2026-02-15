        // ========== AUTH MODULE ==========
        // Login, logout, showApp, auto-refresh, cross-tab sync

        // Login form handler
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('error-msg');
            const loginBtn = document.getElementById('login-btn');

            errorMsg.classList.add('hidden');
            loginBtn.disabled = true;
            loginBtn.textContent = 'Prijavljivanje...';

            try {
                const response = await fetch(`${API_URL}?path=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
                const data = await response.json();

                if (data.success) {
                    currentUser = data;
                    currentPassword = password;
                    localStorage.setItem('sumarija_user', JSON.stringify(data));
                    localStorage.setItem('sumarija_pass', password);
                    showApp();
                    startCacheStatusUpdater();
                    loadData();
                    loadOdjeli(); // Load odjeli list after manual login

                    // AUTO-PRELOAD: Automatski ucitaj SVE prikaze u pozadini (silent mod)!
                    if (!preloadScheduled) {
                        console.log('[AUTO-PRELOAD] Scheduling background preload (manual login)...');
                        preloadScheduled = true;
                        setTimeout(() => {
                            preloadAllViews(true).then(() => {
                                console.log('[AUTO-PRELOAD] All views preloaded in background!');
                                preloadScheduled = false;
                            }).catch(err => {
                                console.error('[AUTO-PRELOAD] Preload failed:', err);
                                preloadScheduled = false;
                            });
                        }, 15000);
                    }
                } else {
                    errorMsg.textContent = data.error || 'Greška pri prijavi';
                    errorMsg.classList.remove('hidden');
                }
            } catch (error) {
                errorMsg.textContent = 'Greška u komunikaciji sa serverom: ' + error.message;
                errorMsg.classList.remove('hidden');
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Prijavi se';
            }
        });

        function showApp() {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app-screen').classList.remove('hidden');
            if (typeof setAppViewport === 'function') setAppViewport();
            document.getElementById('user-name').textContent = currentUser.fullName;
            document.getElementById('user-role').textContent = currentUser.role === 'admin' ? 'Administrator' : currentUser.type;

            // Dinamicki kreiraj tab-ove na osnovu tipa korisnika
            const tabsMenu = document.getElementById('tabs-menu');
            const userType = (currentUser.type || '').toLowerCase();

            if (userType === 'primac') {
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('primac-personal')">👷 Pregled sječe u tekućoj godini</button>
                    <button class="tab" onclick="switchTab('primac-godisnji')">📅 Godišnji prikaz</button>
                    <button class="tab" onclick="switchTab('primac-odjeli')">🏭 Prikaz po odjelima</button>
                    <button class="tab" onclick="switchTab('add-sjeca')">➕ Dodaj sječu</button>
                    <button class="tab" onclick="switchTab('my-sjece')">📝 Moje sječe</button>
                    <button class="tab" onclick="switchTab('izvjestaji-primac')">📋 Izvještaji</button>
                    <button class="tab" onclick="switchTab('kubikator')">📐 Kubikator</button>
                `;
            } else if (userType === 'otpremac') {
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('otpremac-personal')">🚛 Pregled otpreme u tekućoj godini</button>
                    <button class="tab" onclick="switchTab('otpremac-odjeli')">🏭 Prikaz po odjelima</button>
                    <button class="tab" onclick="switchTab('add-otprema')">➕ Dodaj otpremu</button>
                    <button class="tab" onclick="switchTab('my-otpreme')">📝 Moje otpreme</button>
                    <button class="tab" onclick="switchTab('izvjestaji-otpremac')">📋 Izvještaji</button>
                    <button class="tab" onclick="switchTab('kubikator')">📐 Kubikator</button>
                `;
            } else if (userType === 'operativa') {
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('dashboard')">🌲 Šumarija Krupa</button>
                    <button class="tab" onclick="switchTab('operativa')">📊 Operativa & Analiza</button>
                    <button class="tab" onclick="switchTab('kupci')">📦 Kupci</button>
                    <button class="tab" onclick="switchTab('mjesecni-sortimenti')">📅 Mjesečni pregled</button>
                    <button class="tab" onclick="switchTab('izvjestaji')">📋 Izvještaji</button>
                `;
            } else if (userType === 'poslovođa' || userType === 'poslovodja') {
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('poslovodja-stanje')">📊 Stanje zaliha</button>
                    <button class="tab" onclick="switchTab('poslovodja-realizacija')">🏗️ Odjeli u realizaciji</button>
                    <button class="tab" onclick="switchTab('poslovodja-suma')">📈 Suma Mjeseca</button>
                    <button class="tab" onclick="switchTab('izvjestaji')">📋 Izvještaji</button>
                `;
            } else {
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('dashboard')">🌲 Šumarija Krupa</button>
                    <button class="tab" onclick="switchTab('kupci')">🏢 Prikaz po kupcima</button>
                    <button class="tab" onclick="switchTab('stanje-zaliha')">📦 Stanje Zaliha</button>
                    <button class="tab" onclick="switchTab('mjesecni-sortimenti')">📅 Sječa/otprema po mjesecima</button>
                    <button class="tab" onclick="switchTab('primaci')">👷 SJEČA</button>
                    <button class="tab" onclick="switchTab('otpremaci')">🚛 OTPREMA</button>
                    <button class="tab" onclick="switchTab('izvjestaji')">📋 Izvještaji</button>
                    <button class="tab notification-badge" onclick="switchTab('pending-unosi')">
                        📋 Dodani unosi
                        <span class="badge-count" id="pending-count-badge"></span>
                    </button>
                    <button class="tab" onclick="switchTab('ostalo')">⚙️ Ostalo</button>
                `;
            }

            // Initialize Delta Sync System
            if (window.DataSync) {
                DataSync.initSyncConfig(API_URL, currentUser.username, currentPassword);
                DataSync.startSmartSync();
                console.log('[APP] Delta Sync initialized and started');
            }

            // Start manifest checker after login
            startManifestChecker();

            // Setup cross-tab synchronization
            setupCrossTabSync();

            // Setup auto-refresh listener for all panels
            setupAutoRefreshListeners();

            // Setup scheduled refresh for weekdays at 10:00 and 12:00
            setupScheduledRefresh();
        }

        // Auto-refresh listeners - slusa "app-data-synced" event i osvjezava trenutni panel
        function setupAutoRefreshListeners() {
            window.addEventListener('app-data-synced', (event) => {
                const { version, type, timestamp } = event.detail;
                console.log(`[AUTO-REFRESH] Received "app-data-synced" event:`, event.detail);

                if (type === 'index-sync' || type === 'stanje-odjela-sync') {
                    console.log(`[AUTO-REFRESH] Event type "${type}" - preloadAllViews already called in trigger function`);
                    return;
                }

                console.log(`[AUTO-REFRESH] Refreshing all views for event type: ${type}`);
                preloadAllViews(true).then(() => {
                    console.log('[AUTO-REFRESH] All views refreshed');
                });
            });

            console.log('[AUTO-REFRESH] Auto-refresh listeners registered');
        }

        // Scheduled auto-refresh for Poslovodja and Radnici panels
        // Runs twice daily at 10:00 and 12:00 on weekdays (Monday-Friday)
        function setupScheduledRefresh() {
            const REFRESH_TIMES = ['10:00', '12:00'];
            let lastRefreshDate = null;

            function checkAndRefresh() {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                const currentDate = now.toDateString();

                const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

                if (!isWeekday) {
                    return;
                }

                const shouldRefresh = REFRESH_TIMES.includes(currentTime);

                if (shouldRefresh && lastRefreshDate !== currentDate + '-' + currentTime) {
                    console.log('[SCHEDULED REFRESH] Starting scheduled refresh at ' + currentTime);
                    lastRefreshDate = currentDate + '-' + currentTime;

                    showInfo('Automatsko ažuriranje', 'Pokretanje zakazanog ažuriranja podataka...');

                    preloadAllViews(true).then(() => {
                        console.log('[SCHEDULED REFRESH] Scheduled refresh completed at ' + currentTime);
                        showSuccess('Ažuriranje završeno', 'Podaci su automatski osvježeni.');
                    }).catch(err => {
                        console.error('[SCHEDULED REFRESH] Scheduled refresh failed:', err);
                        showError('Greška', 'Automatsko ažuriranje nije uspjelo.');
                    });
                }
            }

            setInterval(checkAndRefresh, 60 * 1000);
            checkAndRefresh();

            console.log('[SCHEDULED REFRESH] Scheduler initialized - will refresh at 10:00 and 12:00 on weekdays');
        }

        // Cross-tab synchronization - slusa promjene u localStorage izmedju tabova
        function setupCrossTabSync() {
            window.addEventListener('storage', (event) => {
                if (event.key === 'app_data_version') {
                    const newVersion = event.newValue;
                    const oldVersion = event.oldValue;

                    if (newVersion !== oldVersion) {
                        console.log(`[CROSS-TAB SYNC] Data synced from another tab! Version: ${newVersion}`);

                        window.APP_DATA_VERSION = newVersion;

                        showInfo('Podaci osvježeni', 'Drugi tab je pokrenuo indeksiranje. Osvježavam podatke...');

                        setTimeout(() => {
                            preloadAllViews(true).then(() => {
                                console.log('[CROSS-TAB SYNC] All views refreshed after cross-tab sync');
                                showSuccess('Podatke osvježeni', 'Prikazujem najnovije podatke.');
                            });
                        }, 1500);
                    }
                }
            });

            console.log('[CROSS-TAB SYNC] Cross-tab synchronization listener registered');
        }

        function logout() {
            // Close user menu first
            const dropdown = document.getElementById('user-menu-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }

            // Log final cache stats before logout
            logCacheStats();

            // Stop Delta Sync
            if (window.DataSync) {
                DataSync.stopSmartSync();
                DataSync.logSyncMetrics();
            }

            // Cleanup intervals to prevent memory leaks
            if (cacheStatusIntervalId) {
                clearInterval(cacheStatusIntervalId);
                cacheStatusIntervalId = null;
            }

            // Stop manifest checker
            stopManifestChecker();

            // Cleanup chart instances to prevent memory leaks
            if (window.dashboardChart) {
                window.dashboardChart.destroy();
                window.dashboardChart = null;
            }
            if (primacChart) {
                primacChart.destroy();
                primacChart = null;
            }
            if (otpremacChart) {
                otpremacChart.destroy();
                otpremacChart = null;
            }
            if (primacDailyChart) {
                primacDailyChart.destroy();
                primacDailyChart = null;
            }
            if (otpremacDailyChart) {
                otpremacDailyChart.destroy();
                otpremacDailyChart = null;
            }
            if (primacYearlyChart) {
                primacYearlyChart.destroy();
                primacYearlyChart = null;
            }
            if (otpremacYearlyChart) {
                otpremacYearlyChart.destroy();
                otpremacYearlyChart = null;
            }

            currentUser = null;
            currentPassword = null;
            localStorage.removeItem('sumarija_user');
            localStorage.removeItem('sumarija_pass');
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app-screen').classList.add('hidden');
            if (typeof setLoginViewport === 'function') setLoginViewport();
            document.getElementById('dashboard-content').classList.add('hidden');
            document.getElementById('primaci-content').classList.add('hidden');
            document.getElementById('otpremaci-content').classList.add('hidden');
            document.getElementById('kupci-content').classList.add('hidden');
            document.getElementById('primac-personal-content').classList.add('hidden');
            document.getElementById('otpremac-personal-content').classList.add('hidden');
            document.getElementById('primac-odjeli-content').classList.add('hidden');
            document.getElementById('otpremac-odjeli-content').classList.add('hidden');
            document.getElementById('add-sjeca-content').classList.add('hidden');
            document.getElementById('add-otprema-content').classList.add('hidden');
            document.getElementById('my-sjece-content').classList.add('hidden');
            document.getElementById('my-otpreme-content').classList.add('hidden');
            document.getElementById('edit-sjeca-content').classList.add('hidden');
            document.getElementById('edit-otprema-content').classList.add('hidden');
            document.getElementById('pending-unosi-content').classList.add('hidden');
            document.getElementById('operativa-content').classList.add('hidden');
            document.getElementById('poslovodja-stanje-content').classList.add('hidden');
            document.getElementById('poslovodja-realizacija-content').classList.add('hidden');
            document.getElementById('poslovodja-suma-content').classList.add('hidden');
            document.getElementById('izvjestaji-primac-content').classList.add('hidden');
            document.getElementById('izvjestaji-otpremac-content').classList.add('hidden');
            document.getElementById('loading-screen').classList.remove('hidden');
        }

        // Load initial data based on user type (OPTIMIZED - lazy loading)
        function loadData() {
            const userType = (currentUser.type || '').toLowerCase();

            // Show loading screen with progress
            const loadingText = document.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = 'Učitavam početni prikaz...';
            }

            if (userType === 'primac') {
                loadPrimacPersonal();
            } else if (userType === 'otpremac') {
                loadOtpremacPersonal();
            } else if (userType === 'poslovođa' || userType === 'poslovodja') {
                loadPoslovodjaStanje();
            } else {
                loadDashboard();
            }
        }
