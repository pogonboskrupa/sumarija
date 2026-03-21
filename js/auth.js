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
                    loadPoslovodjaRadilistaMapping(); // Dohvati poslovodja→radilista iz INFO sheeta
                    loadOdjeli(); // Load odjeli list after manual login

                    // Učitaj početni prikaz PA TEK ONDA preload ostale
                    const initialLoad = loadData();

                    // AUTO-PRELOAD: Čekaj da početni prikaz završi, pa tek onda preloaduj ostalo
                    if (!preloadScheduled) {
                        preloadScheduled = true;
                        Promise.resolve(initialLoad).then(() => {
                            console.log('[AUTO-PRELOAD] Initial view loaded, starting background preload...');
                            return preloadAllViews(true);
                        }).then(() => {
                            console.log('[AUTO-PRELOAD] All views preloaded in background!');
                            preloadScheduled = false;
                        }).catch(err => {
                            console.error('[AUTO-PRELOAD] Preload failed:', err);
                            preloadScheduled = false;
                        });
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

            // Initialize notification UI if module loaded
            if (typeof initNotificationUI === 'function') initNotificationUI();

            // Update sidebar user info
            const sidebarUserName = document.getElementById('sidebar-user-name');
            const sidebarUserRole = document.getElementById('sidebar-user-role');
            if (sidebarUserName) sidebarUserName.textContent = currentUser.fullName;
            if (sidebarUserRole) sidebarUserRole.textContent = currentUser.role === 'admin' ? 'Administrator' : currentUser.type;

            // Dinamicki kreiraj tab-ove na osnovu tipa korisnika
            const tabsMenu = document.getElementById('tabs-menu'); // Sidebar nav
            const tabsMenuMobile = document.getElementById('tabs-menu-mobile'); // Mobile horizontal tabs
            const userType = (currentUser.type || '').toLowerCase();

            // Define tabs based on user type
            let tabsConfig = [];

            if (userType === 'primac') {
                tabsConfig = [
                    { id: 'primac-personal', icon: '👷', label: 'Pregled sječe', active: true },
                    { id: 'primac-godisnji', icon: '📅', label: 'Godišnji prikaz' },
                    { id: 'primac-odjeli', icon: '🏭', label: 'Prikaz po odjelima' },
                    { id: 'izvjestaji-primac', icon: '📋', label: 'Izvještaji' },
                    { id: 'add-sjeca', icon: '➕', label: 'Dodaj sječu' },
                    { id: 'my-sjece', icon: '📝', label: 'Moje sječe' },
                    { id: 'kubikator', icon: '📐', label: 'Kubikator' }
                ];
            } else if (userType === 'otpremac') {
                tabsConfig = [
                    { id: 'otpremac-personal', icon: '🚛', label: 'Pregled otpreme', active: true },
                    { id: 'otpremac-godisnji', icon: '📅', label: 'Godišnji prikaz' },
                    { id: 'otpremac-odjeli', icon: '🏭', label: 'Prikaz po odjelima' },
                    { id: 'izvjestaji-otpremac', icon: '📋', label: 'Izvještaji' },
                    { id: 'add-otprema', icon: '➕', label: 'Dodaj otpremu' },
                    { id: 'my-otpreme', icon: '📝', label: 'Moje otpreme' },
                    { id: 'kubikator', icon: '📐', label: 'Kubikator' }
                ];
            } else if (userType === 'operativa') {
                tabsConfig = [
                    { id: 'dashboard', icon: '🌲', label: 'Šumarija Krupa', active: true },
                    { id: 'operativa', icon: '📊', label: 'Operativa & Analiza' },
                    { id: 'kupci', icon: '📦', label: 'Kupci' },
                    { id: 'mjesecni-sortimenti', icon: '📅', label: 'Mjesečni pregled' },
                    { id: 'izvjestaji', icon: '📋', label: 'Izvještaji' }
                ];
            } else if (userType === 'poslovođa' || userType === 'poslovodja') {
                tabsConfig = [
                    { id: 'poslovodja-sjeca', icon: '🪓', label: 'SJEČA', active: true },
                    { id: 'poslovodja-otprema', icon: '🚛', label: 'OTPREMA' },
                    { id: 'poslovodja-stanje', icon: '📦', label: 'Stanje zaliha' },
                    { id: 'izvjestaji', icon: '📋', label: 'Izvještaji' },
                    { id: 'poslovodja-pregled', icon: '📑', label: 'PREGLED' },
                    { id: 'poslovodja-unosi', icon: '📝', label: 'Dodani unosi', hasBadge: true }
                ];
            } else {
                // Admin / default user
                tabsConfig = [
                    { id: 'dashboard', icon: '🌲', label: 'Šumarija Krupa', active: true },
                    { id: 'kupci', icon: '🏢', label: 'Prikaz po kupcima' },
                    { id: 'stanje-zaliha', icon: '📦', label: 'Stanje Zaliha' },
                    { id: 'mjesecni-sortimenti', icon: '📅', label: 'Sječa/otprema' },
                    { id: 'primaci', icon: '👷', label: 'SJEČA' },
                    { id: 'otpremaci', icon: '🚛', label: 'OTPREMA' },
                    { id: 'primaci-admin', icon: '🌲', label: 'Primači na šuma panju' },
                    { id: 'izvjestaji', icon: '📋', label: 'Izvještaji' },
                    { id: 'pending-unosi', icon: '📋', label: 'Dodani unosi', hasBadge: true },
                    { id: 'ostalo', icon: '⚙️', label: 'Ostalo' }
                ];
            }

            // Generate sidebar tabs (desktop)
            tabsMenu.innerHTML = tabsConfig.map(tab => `
                <button class="tab${tab.active ? ' active' : ''}${tab.hasBadge ? ' notification-badge' : ''}" onclick="switchTab('${tab.id}')">
                    <span class="tab-icon">${tab.icon}</span>
                    <span class="tab-label">${tab.label}</span>
                    ${tab.hasBadge ? '<span class="badge-count" id="pending-count-badge"></span>' : ''}
                </button>
            `).join('');

            // Generate mobile tabs (horizontal)
            if (tabsMenuMobile) {
                tabsMenuMobile.innerHTML = tabsConfig.map(tab => `
                    <button class="tab${tab.active ? ' active' : ''}${tab.hasBadge ? ' notification-badge' : ''}" onclick="switchTab('${tab.id}')">
                        ${tab.icon} ${tab.label}
                        ${tab.hasBadge ? '<span class="badge-count" id="pending-count-badge-mobile"></span>' : ''}
                    </button>
                `).join('');
            }

            // Postavi currentTab na prvi aktivni tab PRIJE loadData
            const activeTab = tabsConfig.find(t => t.active);
            if (activeTab) {
                window.currentTab = activeTab.id;
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
        // Runs daily at 09:00 on weekdays (Monday-Friday), when data entry ends
        function setupScheduledRefresh() {
            const REFRESH_TIMES = ['09:00'];
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
            try { logCacheStats(); } catch(e) { console.error('logout logCacheStats:', e); }

            // Stop Delta Sync
            try {
                if (window.DataSync) {
                    DataSync.stopSmartSync();
                    DataSync.logSyncMetrics();
                }
            } catch(e) { console.error('logout DataSync:', e); }

            // Stop manifest checker
            try { stopManifestChecker(); } catch(e) {}

            // Cleanup chart instances to prevent memory leaks
            try { if (window.dashboardChart) { window.dashboardChart.destroy(); window.dashboardChart = null; } } catch(e) {}
            try { if (typeof primacChart !== 'undefined' && primacChart) { primacChart.destroy(); primacChart = null; } } catch(e) {}
            try { if (typeof otpremacChart !== 'undefined' && otpremacChart) { otpremacChart.destroy(); otpremacChart = null; } } catch(e) {}
            try { if (typeof primacDailyChart !== 'undefined' && primacDailyChart) { primacDailyChart.destroy(); primacDailyChart = null; } } catch(e) {}
            try { if (typeof otpremacDailyChart !== 'undefined' && otpremacDailyChart) { otpremacDailyChart.destroy(); otpremacDailyChart = null; } } catch(e) {}
            try { if (typeof primacYearlyChart !== 'undefined' && primacYearlyChart) { primacYearlyChart.destroy(); primacYearlyChart = null; } } catch(e) {}
            try { if (typeof otpremacYearlyChart !== 'undefined' && otpremacYearlyChart) { otpremacYearlyChart.destroy(); otpremacYearlyChart = null; } } catch(e) {}


            currentUser = null;
            currentPassword = null;
            _poslovodjaRadilistaFromApi = null;
            localStorage.removeItem('sumarija_user');
            localStorage.removeItem('sumarija_pass');
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app-screen').classList.add('hidden');
            if (typeof setLoginViewport === 'function') setLoginViewport();

            // Hide all content panels (safe - won't crash if element missing)
            var panelIds = [
                'dashboard-content', 'primaci-content', 'otpremaci-content', 'kupci-content',
                'primac-personal-content', 'primac-godisnji-content',
                'otpremac-personal-content', 'otpremac-godisnji-content',
                'primac-odjeli-content', 'otpremac-odjeli-content',
                'add-sjeca-content', 'add-otprema-content',
                'my-sjece-content', 'my-otpreme-content',
                'edit-sjeca-content', 'edit-otprema-content',
                'pending-unosi-content', 'operativa-content',
                'poslovodja-stanje-content',
                'poslovodja-sjeca-content', 'poslovodja-otprema-content',
                'poslovodja-pregled-content', 'poslovodja-unosi-content',
                'izvjestaji-content', 'izvjestaji-primac-content', 'izvjestaji-otpremac-content',
                'mjesecni-sortimenti-content', 'stanje-odjela-admin-content',
                'dinamika-content', 'kubikator-content', 'ostalo-content', 'stanje-zaliha-content'
            ];
            panelIds.forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });

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
                return loadPrimacPersonal();
            } else if (userType === 'otpremac') {
                return loadOtpremacPersonal();
            } else if (userType === 'poslovođa' || userType === 'poslovodja') {
                return loadPoslovodjaSjeca();
            } else {
                return loadDashboard();
            }
        }
