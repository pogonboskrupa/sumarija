        const API_URL = 'https://script.google.com/macros/s/AKfycbwOyqKvRtbQWQFABXe1Q8fWf2XP9K-msArcOU8BwoyN28fSGfLnPGskR1G8qBIZrMsy/exec';

        // ========== PERFORMANCE CONFIGURATION ==========
        const MAX_TABLE_ROWS = 50; // Limit initial table rows for performance
        const LAZY_LOAD_BATCH = 25; // Load additional rows in batches

        // ========== PERFORMANCE OPTIMIZATIONS ==========

        // Batch DOM updates using DocumentFragment
        function batchRender(container, htmlArray) {
            const fragment = document.createDocumentFragment();
            const temp = document.createElement('div');
            temp.innerHTML = htmlArray.join('');
            while (temp.firstChild) {
                fragment.appendChild(temp.firstChild);
            }
            container.appendChild(fragment);
        }

        // Debounce function to limit function calls
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // Throttle function for scroll events
        function throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        // RequestAnimationFrame wrapper for smooth rendering
        function smoothRender(callback) {
            requestAnimationFrame(() => {
                requestAnimationFrame(callback);
            });
        }

        // Lazy load large tables with pagination
        function paginateTable(data, pageSize = 100) {
            const pages = [];
            for (let i = 0; i < data.length; i += pageSize) {
                pages.push(data.slice(i, i + pageSize));
            }
            return pages;
        }

        // Virtual scrolling for large datasets
        let virtualScrollCache = {};
        function enableVirtualScroll(tableId, data, renderRow) {
            const table = document.getElementById(tableId);
            if (!table) return;

            const tbody = table.querySelector('tbody');
            const rowHeight = 40; // Estimated row height
            const viewportHeight = window.innerHeight;
            const visibleRows = Math.ceil(viewportHeight / rowHeight) + 5; // Buffer

            let scrollTop = 0;

            const renderVisible = throttle(() => {
                const startIndex = Math.floor(scrollTop / rowHeight);
                const endIndex = Math.min(startIndex + visibleRows, data.length);

                const visibleData = data.slice(startIndex, endIndex);
                const html = visibleData.map((item, idx) => renderRow(item, startIndex + idx)).join('');

                tbody.innerHTML = html;
                tbody.style.paddingTop = `${startIndex * rowHeight}px`;
                tbody.style.paddingBottom = `${(data.length - endIndex) * rowHeight}px`;
            }, 100);

            window.addEventListener('scroll', () => {
                scrollTop = window.pageYOffset;
                renderVisible();
            });

            renderVisible();
        }

        // Cache DOM elements to avoid repeated queries
        const domCache = {};
        function getCachedElement(id) {
            if (!domCache[id]) {
                domCache[id] = document.getElementById(id);
            }
            return domCache[id];
        }

        // Optimize innerHTML by using textContent where possible
        function safeSetText(element, text) {
            if (element.textContent !== text) {
                element.textContent = text;
            }
        }

        // ========== TOAST NOTIFICATIONS ==========

        function showToast(type, title, message, duration = 4000) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;

            const icons = {
                success: '✓',
                error: '✕',
                info: 'ℹ',
                warning: '⚠'
            };

            toast.innerHTML = `
                <div class="toast-icon">${icons[type] || 'ℹ'}</div>
                <div class="toast-content">
                    <div class="toast-title">${title}</div>
                    ${message ? `<div class="toast-message">${message}</div>` : ''}
                </div>
                <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            `;

            container.appendChild(toast);

            // Trigger animation
            setTimeout(() => toast.classList.add('show'), 10);

            // Auto remove after duration
            if (duration > 0) {
                setTimeout(() => {
                    toast.classList.remove('show');
                    toast.classList.add('hide');
                    setTimeout(() => toast.remove(), 300);
                }, duration);
            }

            return toast;
        }

        // Convenience functions
        function showSuccess(title, message, duration) {
            return showToast('success', title, message, duration);
        }

        function showError(title, message, duration) {
            return showToast('error', title, message, duration);
        }

        function showInfo(title, message, duration) {
            return showToast('info', title, message, duration);
        }

        function showWarning(title, message, duration) {
            return showToast('warning', title, message, duration);
        }

        // ========== CACHING & OFFLINE SUPPORT ==========

        // Register Service Worker for offline support
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }

        // Smart cache TTL - optimized for data entry patterns
        // Unosi se dodaju radnim danima ujutro do 8h
        function getSmartCacheTTL() {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();

            // Prije 8:00 - unosi se još dodaju, kraći cache
            if (currentHour < 8) {
                console.log('⏰ Prije 8h - cache 30 minuta (unosi se dodaju)');
                return 30 * 60 * 1000; // 30 minuta
            }

            // Poslije 8:00 - podaci stabilni do kraja dana
            // Cache do 18:00 ili maksimalno 10 sati
            const endOfWorkDay = new Date(now);
            endOfWorkDay.setHours(18, 0, 0, 0); // 18:00

            const timeUntilEndOfDay = endOfWorkDay.getTime() - now.getTime();
            const tenHours = 10 * 60 * 60 * 1000;

            // Ako je već poslije 18h, cache do kraja dana (midnight)
            if (currentHour >= 18) {
                console.log('⏰ Poslije 18h - cache 4 sata');
                return 4 * 60 * 60 * 1000; // 4 sata
            }

            // Inače, cache do kraja radnog dana ili max 10h
            const cacheDuration = Math.min(timeUntilEndOfDay, tenHours);
            const hoursRemaining = Math.round(cacheDuration / (60 * 60 * 1000) * 10) / 10;
            console.log(`⏰ Poslije 8h - cache ${hoursRemaining}h (podaci stabilni)`);

            return cacheDuration;
        }

        // Cache configuration - different TTLs for different endpoints
        const CACHE_CONFIG = {
            'dashboard': 5 * 60 * 1000,        // 5 minutes
            'primaci': 10 * 60 * 1000,         // 10 minutes
            'otpremaci': 10 * 60 * 1000,       // 10 minutes
            'kupci': 10 * 60 * 1000,           // 10 minutes
            'odjeli': 15 * 60 * 1000,          // 15 minutes
            'primac-detail': 5 * 60 * 1000,    // 5 minutes
            'otpremac-detail': 5 * 60 * 1000,  // 5 minutes
            'primac-odjeli': 10 * 60 * 1000,   // 10 minutes
            'otpremac-odjeli': 10 * 60 * 1000, // 10 minutes
            'default': 5 * 60 * 1000           // 5 minutes default
        };

        // Fetch with cache - cache-first strategy
        async function fetchWithCache(url, cacheKey, forceRefresh = false) {
            // Use smart cache TTL optimized for data entry patterns
            const path = new URL(url).searchParams.get('path');
            const cacheTTL = getSmartCacheTTL();

            // If force refresh, clear cache for this key
            if (forceRefresh) {
                localStorage.removeItem(cacheKey);
                console.log(`🔄 Force refresh: cleared cache for ${cacheKey}`);
            }

            // Check cache first
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const cachedData = JSON.parse(cached);
                    const now = Date.now();
                    const age = now - cachedData.timestamp;

                    // If cache is fresh, return it immediately
                    if (age < cacheTTL) {
                        console.log(`✓ Cache hit (${path}): ${Math.round(age / 1000)}s old`);
                        showCacheIndicator(age);
                        return cachedData.data;
                    } else {
                        console.log(`⚠ Cache stale (${path}): ${Math.round(age / 1000)}s old, fetching fresh...`);
                    }
                } catch (e) {
                    console.error('Cache parse error:', e);
                }
            }

            // Cache miss or stale - fetch from network
            try {
                console.log(`↻ Fetching fresh data (${path})...`);
                const response = await fetch(url);
                const data = await response.json();

                // Store in cache
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: data,
                    timestamp: Date.now()
                }));

                console.log(`✓ Fresh data cached (${path})`);
                hideCacheIndicator();
                return data;

            } catch (error) {
                console.error('Network error:', error);

                // If network fails and we have stale cache, use it
                if (cached) {
                    try {
                        const cachedData = JSON.parse(cached);
                        const age = Date.now() - cachedData.timestamp;
                        console.log(`⚠ Network failed, using stale cache (${Math.round(age / 60000)} min old)`);
                        showCacheIndicator(age, true);
                        return cachedData.data;
                    } catch (e) {
                        console.error('Stale cache parse error:', e);
                    }
                }

                throw error;
            }
        }

        // Show cache indicator
        function showCacheIndicator(age, isStale = false) {
            const indicator = document.getElementById('cache-indicator');
            if (!indicator) return;

            const minutes = Math.round(age / 60000);
            const seconds = Math.round(age / 1000);
            const hours = Math.round(age / 3600000);

            if (isStale) {
                indicator.innerHTML = `⚠️ Keš ${minutes}m`;
                indicator.style.background = '#fef3c7';
                indicator.style.color = '#92400e';
            } else {
                // Show time in most appropriate unit
                let timeStr;
                if (hours > 0) {
                    timeStr = `${hours}h`;
                } else if (minutes > 0) {
                    timeStr = `${minutes}m`;
                } else {
                    timeStr = `${seconds}s`;
                }

                indicator.innerHTML = `⚡ ${timeStr}`;
                indicator.style.background = '#d1fae5';
                indicator.style.color = '#047857';
            }
            indicator.classList.remove('hidden');
        }

        // Hide cache indicator
        function hideCacheIndicator() {
            const indicator = document.getElementById('cache-indicator');
            if (indicator) {
                indicator.classList.add('hidden');
            }
        }

        // Clear cache by pattern
        function clearCacheByPattern(pattern) {
            const keys = Object.keys(localStorage);
            const matchingKeys = keys.filter(k => k.includes(pattern));
            matchingKeys.forEach(k => localStorage.removeItem(k));
            console.log(`🗑️  Cleared ${matchingKeys.length} cache entries matching '${pattern}'`);
            return matchingKeys.length;
        }

        // Clear all cache
        function clearAllCache() {
            const keys = Object.keys(localStorage);
            const cacheKeys = keys.filter(k => k.startsWith('cache_'));
            cacheKeys.forEach(k => localStorage.removeItem(k));
            console.log(`Cleared ${cacheKeys.length} cache entries`);

            // Clear Service Worker cache
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
            }

            toggleUserMenu(); // Close menu
            showInfo('Keš obrisan', 'Stranica će se osvježiti.');
            window.location.reload();
        }

        // Preload all views function
        async function preloadAllViews() {
            showInfo('⚡ Učitavanje...', 'Učitavam sve prikaze u pozadini. Ovo može potrajati.');

            const year = new Date().getFullYear();
            let totalLoaded = 0;
            let totalFailed = 0;

            try {
                // Determine user type
                const userType = currentUser.type;

                if (userType === 'ADMIN') {
                    // Admin views to preload
                    const views = [
                        { name: 'Dashboard', url: `${API_URL}?path=dashboard&year=${year}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_dashboard_' + year },
                        { name: 'Primaci', url: `${API_URL}?path=primaci&year=${year}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_primaci_' + year },
                        { name: 'Otpremaci', url: `${API_URL}?path=otpremaci&year=${year}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_otpremaci_' + year },
                        { name: 'Kupci', url: `${API_URL}?path=kupci&year=${year}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_kupci_' + year },
                        { name: 'Odjeli', url: `${API_URL}?path=odjeli&year=${year}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_odjeli_' + year },
                        { name: 'Stanje Odjela', url: `${API_URL}?path=stanje_odjela&year=${year}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_stanje_odjela_' + year },
                        { name: 'Pending Unosi', url: `${API_URL}?path=pending_unosi&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_pending_unosi' },
                        { name: 'Mjesečni Sortimenti', url: `${API_URL}?path=mjesecni_sortimenti&year=${year}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_mjesecni_sortimenti_' + year }
                    ];

                    console.log(`Preloading ${views.length} admin views...`);

                    for (const view of views) {
                        try {
                            console.log(`Loading ${view.name}...`);
                            await fetchWithCache(view.url, view.cacheKey);
                            totalLoaded++;
                            console.log(`✓ ${view.name} loaded`);
                        } catch (error) {
                            totalFailed++;
                            console.error(`✗ ${view.name} failed:`, error);
                        }
                    }

                } else if (userType === 'POSLOVOĐA') {
                    // Poslovodja views to preload
                    const views = [
                        { name: 'Stanje Odjela', url: `${API_URL}?path=odjeli&year=${year}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_poslovodja_odjeli_' + year },
                        { name: 'Odjeli u realizaciji', url: `${API_URL}?path=odjeli&year=${year}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_poslovodja_realizacija_' + year },
                        { name: 'Zadnjih 5 dana - Primke', url: `${API_URL}?path=primke&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_poslovodja_primke' },
                        { name: 'Zadnjih 5 dana - Otpreme', url: `${API_URL}?path=otpreme&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_poslovodja_otpreme' },
                        { name: 'Suma mjeseca', url: `${API_URL}?path=primke&username=${currentUser.username}&password=${currentPassword}`, cacheKey: 'cache_poslovodja_suma_primke' }
                    ];

                    console.log(`Preloading ${views.length} poslovodja views...`);

                    for (const view of views) {
                        try {
                            console.log(`Loading ${view.name}...`);
                            await fetchWithCache(view.url, view.cacheKey);
                            totalLoaded++;
                            console.log(`✓ ${view.name} loaded`);
                        } catch (error) {
                            totalFailed++;
                            console.error(`✗ ${view.name} failed:`, error);
                        }
                    }

                } else if (userType === 'PRIMAC' || userType === 'OTPREMAC') {
                    // Worker views to preload
                    const path = userType === 'PRIMAC' ? 'primke' : 'otpreme';
                    const views = [
                        { name: 'Moje unose', url: `${API_URL}?path=${path}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: `cache_my_${path}` },
                        { name: 'Godišnji prikaz', url: `${API_URL}?path=${path}&username=${currentUser.username}&password=${currentPassword}`, cacheKey: `cache_godisnji_${path}` }
                    ];

                    console.log(`Preloading ${views.length} worker views...`);

                    for (const view of views) {
                        try {
                            console.log(`Loading ${view.name}...`);
                            await fetchWithCache(view.url, view.cacheKey);
                            totalLoaded++;
                            console.log(`✓ ${view.name} loaded`);
                        } catch (error) {
                            totalFailed++;
                            console.error(`✗ ${view.name} failed:`, error);
                        }
                    }
                }

                if (totalLoaded > 0) {
                    showSuccess('⚡ Učitano!', `Učitano ${totalLoaded} prikaza. Skrolanje je sada instantno!`);
                } else {
                    showError('Greška', `Nije učitano nijedan prikaz. Provjerite internet konekciju.`);
                }

            } catch (error) {
                console.error('Preload error:', error);
                showError('Greška', 'Nije uspjelo učitavanje svih prikaza.');
            }
        }

        // Toggle user menu dropdown
        function toggleUserMenu() {
            const dropdown = document.getElementById('user-menu-dropdown');
            dropdown.classList.toggle('show');
        }

        // Close user menu when clicking outside
        document.addEventListener('click', function(event) {
            const userMenu = document.querySelector('.user-menu');
            const dropdown = document.getElementById('user-menu-dropdown');
            if (userMenu && !userMenu.contains(event.target) && dropdown) {
                dropdown.classList.remove('show');
            }
        });

        // ========== END CACHING ==========

        let currentUser = null;
        let currentPassword = null;
        let odjeliList = [];

        // POSLOVOĐA RADILIŠTA MAPPING
        const POSLOVODJA_RADILISTA = {
            'HARBAŠ MEHMEDALIJA': ['BJELAJSKE UVALE', 'VOJSKOVA'],
            'JASMIN PORIĆ': ['RADIĆKE UVALE', 'BAŠTRA ĆORKOVAČA'],
            'IRFAN HADŽIPAŠIĆ': ['TURSKE VODE']
        };

        // Load odjeli list from API
        async function loadOdjeli() {
            try {
                const url = API_URL + '?path=get-odjeli-list';
                const response = await fetch(url);
                const data = await response.json();

                if (data.success && data.odjeli) {
                    odjeliList = data.odjeli;
                    populateOdjeliDropdowns();
                }
            } catch (error) {
                console.error('Error loading odjeli:', error);
            }
        }

        // Populate all odjel dropdowns
        function populateOdjeliDropdowns() {
            const dropdowns = [
                'sjeca-odjel',
                'otprema-odjel',
                'edit-sjeca-odjel',
                'edit-otprema-odjel'
            ];

            dropdowns.forEach(dropdownId => {
                const dropdown = document.getElementById(dropdownId);
                if (dropdown) {
                    // Keep the first "Izaberi odjel..." option
                    const currentValue = dropdown.value;
                    dropdown.innerHTML = '<option value="">Izaberi odjel...</option>';

                    odjeliList.forEach(odjel => {
                        const option = document.createElement('option');
                        option.value = odjel;
                        option.textContent = odjel;
                        dropdown.appendChild(option);
                    });

                    // Restore previously selected value if it exists
                    if (currentValue && odjeliList.includes(currentValue)) {
                        dropdown.value = currentValue;
                    }
                }
            });
        }

        // Check if already logged in
        window.addEventListener('DOMContentLoaded', () => {
            const savedUser = localStorage.getItem('sumarija_user');
            const savedPass = localStorage.getItem('sumarija_pass');

            if (savedUser && savedPass) {
                currentUser = JSON.parse(savedUser);
                currentPassword = savedPass;
                showApp();
                loadData();
                loadOdjeli(); // Load odjeli list after auto-login
            }
        });
        
        // Login form
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
                    loadData();
                    loadOdjeli(); // Load odjeli list after manual login
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
            document.getElementById('user-name').textContent = currentUser.fullName;
            document.getElementById('user-role').textContent = currentUser.role === 'admin' ? 'Administrator' : currentUser.type;

            // Dinamički kreiraj tab-ove na osnovu tipa korisnika
            const tabsMenu = document.getElementById('tabs-menu');
            const userType = currentUser.type; // 'primac', 'otpremac', ili nešto drugo

            if (userType === 'primac') {
                // Primač vidi pet prikaza: pregled, godišnji prikaz, po odjelima, dodavanje, i moje sječe
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('primac-personal')">👷 Pregled sječe u tekućoj godini</button>
                    <button class="tab" onclick="switchTab('primac-godisnji')">📅 Godišnji prikaz</button>
                    <button class="tab" onclick="switchTab('primac-odjeli')">🏭 Prikaz po odjelima</button>
                    <button class="tab" onclick="switchTab('add-sjeca')">➕ Dodaj sječu</button>
                    <button class="tab" onclick="switchTab('my-sjece')">📝 Moje sječe</button>
                `;
            } else if (userType === 'otpremac') {
                // Otpremač vidi četiri prikaza: pregled, po odjelima, dodavanje, i moje otpreme
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('otpremac-personal')">🚛 Pregled otpreme u tekućoj godini</button>
                    <button class="tab" onclick="switchTab('otpremac-odjeli')">🏭 Prikaz po odjelima</button>
                    <button class="tab" onclick="switchTab('add-otprema')">➕ Dodaj otpremu</button>
                    <button class="tab" onclick="switchTab('my-otpreme')">📝 Moje otpreme</button>
                `;
            } else if (userType === 'OPERATIVA') {
                // OPERATIVA korisnik vidi samo analytics dashboards
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('dashboard')">🌲 Šumarija Krupa</button>
                    <button class="tab" onclick="switchTab('operativa')">📊 Operativa & Analiza</button>
                    <button class="tab" onclick="switchTab('kupci')">📦 Kupci</button>
                    <button class="tab" onclick="switchTab('mjesecni-sortimenti')">📅 Mjesečni pregled</button>
                    <button class="tab" onclick="switchTab('izvjestaji')">📋 Izvještaji</button>
                `;
            } else if (userType === 'POSLOVOĐA') {
                // POSLOVOĐA vidi: STANJE ODJELA, ODJELI U REALIZACIJI, ZADNJIH 5 DANA, SUMA MJESECA, IZVJEŠTAJI
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('poslovodja-stanje')">📊 Stanje Odjela</button>
                    <button class="tab" onclick="switchTab('poslovodja-realizacija')">🏗️ Odjeli u realizaciji</button>
                    <button class="tab" onclick="switchTab('poslovodja-zadnjih5')">📅 Zadnjih 5 Dana</button>
                    <button class="tab" onclick="switchTab('poslovodja-suma')">📈 Suma Mjeseca</button>
                    <button class="tab" onclick="switchTab('izvjestaji')">📋 Izvještaji</button>
                `;
            } else {
                // Admin korisnici - bez OPERATIVA tab-a (admin se loguje kao OPERATIVA tip ako želi vidjeti operativa podatke)
                tabsMenu.innerHTML = `
                    <button class="tab active" onclick="switchTab('dashboard')">🌲 Šumarija Krupa</button>
                    <button class="tab" onclick="switchTab('mjesecni-sortimenti')">📅 Sječa/otprema po mjesecima</button>
                    <button class="tab" onclick="switchTab('primaci')">👷 Prikaz sječe</button>
                    <button class="tab" onclick="switchTab('otpremaci')">🚛 Prikaz otpreme</button>
                    <button class="tab" onclick="switchTab('kupci')">🏢 Prikaz po kupcima</button>
                    <button class="tab" onclick="switchTab('izvjestaji')">📋 Izvještaji</button>
                    <button class="tab notification-badge" onclick="switchTab('pending-unosi')">
                        📋 Dodani unosi
                        <span class="badge-count" id="pending-count-badge"></span>
                    </button>
                `;
            }
        }
        
        function logout() {
            currentUser = null;
            currentPassword = null;
            localStorage.removeItem('sumarija_user');
            localStorage.removeItem('sumarija_pass');
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app-screen').classList.add('hidden');
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
            document.getElementById('poslovodja-zadnjih5-content').classList.add('hidden');
            document.getElementById('poslovodja-suma-content').classList.add('hidden');
            document.getElementById('loading-screen').classList.remove('hidden');
        }
        
        // Load initial data based on user type
        function loadData() {
            const userType = currentUser.type;
            if (userType === 'primac') {
                loadPrimacPersonal();
            } else if (userType === 'otpremac') {
                loadOtpremacPersonal();
            } else if (userType === 'POSLOVOĐA') {
                loadPoslovodjaStanje();
            } else {
                loadDashboard();
            }
        }

        // Switch between tabs
        function switchTab(tab) {
            // Update tab buttons
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');

            // Hide all content sections
            document.getElementById('dashboard-content').classList.add('hidden');
            document.getElementById('primaci-content').classList.add('hidden');
            document.getElementById('otpremaci-content').classList.add('hidden');
            document.getElementById('kupci-content').classList.add('hidden');
            document.getElementById('primac-personal-content').classList.add('hidden');
            document.getElementById('primac-godisnji-content').classList.add('hidden');
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
            document.getElementById('mjesecni-sortimenti-content').classList.add('hidden');
            document.getElementById('izvjestaji-content').classList.add('hidden');
            document.getElementById('operativa-content').classList.add('hidden');
            document.getElementById('poslovodja-stanje-content').classList.add('hidden');
            document.getElementById('poslovodja-realizacija-content').classList.add('hidden');
            document.getElementById('poslovodja-zadnjih5-content').classList.add('hidden');
            document.getElementById('poslovodja-suma-content').classList.add('hidden');

            // Load appropriate content
            if (tab === 'dashboard') {
                loadDashboard();
            } else if (tab === 'operativa') {
                loadOperativa();
            } else if (tab === 'primaci') {
                loadPrimaci();
            } else if (tab === 'otpremaci') {
                loadOtpremaci();
            } else if (tab === 'kupci') {
                loadKupci();
            } else if (tab === 'primac-personal') {
                loadPrimacPersonal();
            } else if (tab === 'primac-godisnji') {
                loadPrimacGodisnji();
                document.getElementById('primac-godisnji-content').classList.remove('hidden');
            } else if (tab === 'otpremac-personal') {
                loadOtpremacPersonal();
            } else if (tab === 'primac-odjeli') {
                loadPrimacOdjeli();
            } else if (tab === 'otpremac-odjeli') {
                loadOtpremacOdjeli();
            } else if (tab === 'add-sjeca') {
                showAddSjecaForm();
            } else if (tab === 'add-otprema') {
                showAddOtpremaForm();
            } else if (tab === 'my-sjece') {
                loadMySjece();
            } else if (tab === 'my-otpreme') {
                loadMyOtpreme();
            } else if (tab === 'pending-unosi') {
                loadPendingUnosi();
            } else if (tab === 'mjesecni-sortimenti') {
                loadMjesecniSortimenti();
            } else if (tab === 'izvjestaji') {
                // Initialize dropdowns to current month/year if not already set
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();

                // Set defaults for all izvjestaji dropdowns
                if (!document.getElementById('izvjestaji-year-select').value) {
                    document.getElementById('izvjestaji-year-select').value = currentYear;
                }
                if (!document.getElementById('izvjestaji-month-select').value) {
                    document.getElementById('izvjestaji-month-select').value = currentMonth;
                }
                if (!document.getElementById('sedmicni-sjeca-year-select').value) {
                    document.getElementById('sedmicni-sjeca-year-select').value = currentYear;
                }
                if (!document.getElementById('sedmicni-sjeca-month-select').value) {
                    document.getElementById('sedmicni-sjeca-month-select').value = currentMonth;
                }
                if (!document.getElementById('sedmicni-otprema-year-select').value) {
                    document.getElementById('sedmicni-otprema-year-select').value = currentYear;
                }
                if (!document.getElementById('sedmicni-otprema-month-select').value) {
                    document.getElementById('sedmicni-otprema-month-select').value = currentMonth;
                }

                // Load mjesečni izvještaj by default
                switchIzvjestajiSubTab('mjesecni');
            } else if (tab === 'poslovodja-stanje') {
                loadPoslovodjaStanje();
            } else if (tab === 'poslovodja-realizacija') {
                loadPoslovodjaRealizacija();
            } else if (tab === 'poslovodja-zadnjih5') {
                loadPoslovodjaZadnjih5();
            } else if (tab === 'poslovodja-suma') {
                loadPoslovodjaSuma();
            }
        }

        // Switch between primaci submenus
        function switchPrimaciSubmenu(view) {
            // Update submenu buttons
            const submenuTabs = document.querySelectorAll('#primaci-content .submenu-tab');
            submenuTabs.forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');

            // Hide all submenu content
            document.getElementById('primaci-monthly-view').classList.add('hidden');
            document.getElementById('primaci-daily-view').classList.add('hidden');
            document.getElementById('primaci-radilista-view').classList.add('hidden');
            document.getElementById('primaci-izvodjaci-view').classList.add('hidden');

            // Show selected view
            if (view === 'monthly') {
                document.getElementById('primaci-monthly-view').classList.remove('hidden');
            } else if (view === 'daily') {
                document.getElementById('primaci-daily-view').classList.remove('hidden');
                // Load daily data if not already loaded
                if (!document.getElementById('primaci-daily-header').innerHTML) {
                    loadPrimaciDaily();
                }
            } else if (view === 'radilista') {
                document.getElementById('primaci-radilista-view').classList.remove('hidden');
                // Load radilista data if not already loaded
                if (!document.getElementById('primaci-radilista-header').innerHTML) {
                    loadPrimaciByRadiliste();
                }
            } else if (view === 'izvodjaci') {
                document.getElementById('primaci-izvodjaci-view').classList.remove('hidden');
                // Load izvodjaci data if not already loaded
                if (!document.getElementById('primaci-izvodjaci-header').innerHTML) {
                    loadPrimaciByIzvodjac();
                }
            }
        }

        // Switch between otpremaci submenus
        function switchOtremaciSubmenu(view) {
            // Update submenu buttons
            const submenuTabs = document.querySelectorAll('#otpremaci-content .submenu-tab');
            submenuTabs.forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');

            // Hide all submenu content
            document.getElementById('otpremaci-monthly-view').classList.add('hidden');
            document.getElementById('otpremaci-daily-view').classList.add('hidden');
            document.getElementById('otpremaci-radilista-view').classList.add('hidden');
            document.getElementById('otpremaci-po-kupcima-view').classList.add('hidden');

            // Show selected view
            if (view === 'monthly') {
                document.getElementById('otpremaci-monthly-view').classList.remove('hidden');
            } else if (view === 'daily') {
                document.getElementById('otpremaci-daily-view').classList.remove('hidden');
                // Load daily data if not already loaded
                if (!document.getElementById('otpremaci-daily-header').innerHTML) {
                    loadOtremaciDaily();
                }
            } else if (view === 'radilista') {
                document.getElementById('otpremaci-radilista-view').classList.remove('hidden');
                // Load radilista data if not already loaded
                if (!document.getElementById('otpremaci-radilista-header').innerHTML) {
                    loadOtremaciByRadiliste();
                }
            } else if (view === 'po-kupcima') {
                document.getElementById('otpremaci-po-kupcima-view').classList.remove('hidden');
                // Load kupci data if not already loaded
                if (!document.getElementById('otpremaci-po-kupcima-header').innerHTML) {
                    loadOtremaciPoKupcima();
                }
            }
        }

        // Load dashboard data
        async function loadDashboard() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('dashboard-content').classList.add('hidden');

            try {
                const year = new Date().getFullYear();

                // Fetch dashboard data with caching
                const url = `${API_URL}?path=dashboard&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_dashboard_' + year);

                console.log('Dashboard data:', data);

                // Check for errors
                if (data.error) {
                    throw new Error('Dashboard API error: ' + data.error);
                }

                // Check if data is valid
                if (!data.mjesecnaStatistika) {
                    throw new Error('Dashboard data missing mjesecnaStatistika');
                }

                // Calculate summary statistics
                const totalSjeca = data.mjesecnaStatistika.reduce((sum, m) => sum + m.sjeca, 0);
                const totalOtprema = data.mjesecnaStatistika.reduce((sum, m) => sum + m.otprema, 0);
                const totalStanje = totalSjeca - totalOtprema;
                const totalDinamika = data.mjesecnaStatistika.reduce((sum, m) => sum + m.dinamika, 0);
                const razlikaDinamika = totalSjeca - totalDinamika;
                const percentDinamika = ((totalSjeca / totalDinamika) * 100).toFixed(1);

                // Create summary cards
                const summaryHTML = `
                    <div class="summary-card green">
                        <div class="summary-card-title">Ukupna Sječa</div>
                        <div class="summary-card-value">${totalSjeca.toFixed(0)} m³</div>
                        <div class="summary-card-subtitle">${percentDinamika}% dinamike</div>
                    </div>
                    <div class="summary-card blue">
                        <div class="summary-card-title">Ukupna Otprema</div>
                        <div class="summary-card-value">${totalOtprema.toFixed(0)} m³</div>
                        <div class="summary-card-subtitle">${((totalOtprema/totalSjeca)*100).toFixed(1)}% od sječe</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-card-title">Šuma/Panj</div>
                        <div class="summary-card-value">${totalStanje.toFixed(0)} m³</div>
                        <div class="summary-card-subtitle">Preostalo u šumi</div>
                    </div>
                    <div class="summary-card ${razlikaDinamika >= 0 ? 'green' : 'red'}">
                        <div class="summary-card-title">Razlika sa Dinamikom</div>
                        <div class="summary-card-value">${(razlikaDinamika >= 0 ? '+' : '') + razlikaDinamika.toFixed(0)} m³</div>
                        <div class="summary-card-subtitle">${razlikaDinamika >= 0 ? 'Iznad plana' : 'Ispod plana'}</div>
                    </div>
                `;
                document.getElementById('summary-cards').innerHTML = summaryHTML;

                // Create chart
                const labels = data.mjesecnaStatistika.map(m => m.mjesec);
                const sjecaData = data.mjesecnaStatistika.map(m => m.sjeca);
                const otpremaData = data.mjesecnaStatistika.map(m => m.otprema);
                const dinamikaData = data.mjesecnaStatistika.map(m => m.dinamika);

                const ctx = document.getElementById('trendsChart');
                if (window.dashboardChart) {
                    window.dashboardChart.destroy();
                }
                window.dashboardChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Sječa',
                            data: sjecaData,
                            borderColor: '#059669',
                            backgroundColor: 'rgba(5, 150, 105, 0.1)',
                            tension: 0.4,
                            fill: true
                        }, {
                            label: 'Otprema',
                            data: otpremaData,
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            tension: 0.4,
                            fill: true
                        }, {
                            label: 'Dinamika',
                            data: dinamikaData,
                            borderColor: '#dc2626',
                            borderDash: [5, 5],
                            tension: 0.4,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: { mode: 'index', intersect: false }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'm³' } }
                        }
                    }
                });

                // Populate monthly table
                const monthlyHTML = data.mjesecnaStatistika.map(m => {
                    const razlikaSjeca = m.razlikaSjeca || 0;
                    const razlikaOtprema = m.razlikaOtprema || 0;
                    const progressPercent = ((m.sjeca / m.dinamika) * 100).toFixed(1);
                    return `
                        <tr>
                            <td>${m.mjesec}</td>
                            <td class="number green">${m.sjeca.toFixed(2)}</td>
                            <td class="number blue">${m.otprema.toFixed(2)}</td>
                            <td class="number">${m.stanje.toFixed(2)}</td>
                            <td class="number">
                                ${m.dinamika.toFixed(2)}
                                <div class="table-progress-bar">
                                    <div class="table-progress-fill" style="width: ${Math.min(progressPercent, 100)}%"></div>
                                </div>
                            </td>
                            <td class="number ${razlikaSjeca >= 0 ? 'green' : 'red'}">${(razlikaSjeca >= 0 ? '+' : '') + razlikaSjeca.toFixed(2)}</td>
                            <td class="number ${razlikaOtprema >= 0 ? 'green' : 'red'}">${(razlikaOtprema >= 0 ? '+' : '') + razlikaOtprema.toFixed(2)}</td>
                        </tr>
                    `;
                }).join('');
                document.getElementById('dashboard-monthly-table').innerHTML = monthlyHTML;

                // Fetch and populate odjeli table with caching
                const odjeliUrl = `${API_URL}?path=odjeli&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const odjeliData = await fetchWithCache(odjeliUrl, 'cache_odjeli_' + year);

                console.log('Odjeli data:', odjeliData);

                if (odjeliData.error) {
                    console.error('Odjeli API error:', odjeliData.error);
                    document.getElementById('odjeli-table-body').innerHTML = '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Greška pri učitavanju podataka o odjelima</td></tr>';
                } else if (odjeliData.odjeli && odjeliData.odjeli.length > 0) {
                    const odjeliHTML = odjeliData.odjeli.map(o => {
                        const realizacijaColor = o.realizacija >= 100 ? 'green' : (o.realizacija >= 80 ? 'blue' : 'red');
                        return `
                            <tr>
                                <td style="font-weight: 500;">${o.odjel}</td>
                                <td class="right green">${o.sjeca.toFixed(2)}</td>
                                <td class="right blue">${o.otprema.toFixed(2)}</td>
                                <td class="right">${o.sumaPanj.toFixed(2)}</td>
                                <td>${o.radiliste || '-'}</td>
                                <td>${o.izvođač || '-'}</td>
                                <td>${o.datumZadnjeSjece || '-'}</td>
                                <td class="right ${realizacijaColor}">${o.realizacija > 0 ? o.realizacija.toFixed(1) + '%' : '-'}</td>
                            </tr>
                        `;
                    }).join('');
                    document.getElementById('odjeli-table-body').innerHTML = odjeliHTML;
                } else {
                    document.getElementById('odjeli-table-body').innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b7280;">Nema podataka o odjelima</td></tr>';
                }

                // Load pending count for badge (admin only)
                loadPendingCount();

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('dashboard-content').classList.remove('hidden');

            } catch (error) {
                console.error('Dashboard error:', error);
                showError('Greška', 'Greška pri učitavanju dashboard podataka: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }

        // ========================================
        // POSLOVOĐA FUNCTIONS
        // ========================================

        // Helper: Get radilišta for current poslovodja
        function getPoslovodjaRadilista() {
            if (!currentUser || currentUser.type !== 'POSLOVOĐA') {
                return [];
            }
            const fullName = currentUser.fullName.toUpperCase().trim();
            return POSLOVODJA_RADILISTA[fullName] || [];
        }

        // Load STANJE ODJELA za poslovođu
        async function loadPoslovodjaStanje() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('poslovodja-stanje-content').classList.add('hidden');

            try {
                const radilista = getPoslovodjaRadilista();
                console.log('Poslovođa radilišta:', radilista);

                // Display radilišta
                document.getElementById('poslovodja-radilista-list').textContent = radilista.join(', ');

                // Load STANJE ODJELA data
                const url = `${API_URL}?path=odjeli&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_odjeli_stanje');

                console.log('Odjeli data:', data);

                if (data.error || !data.odjeli) {
                    throw new Error(data.error || 'Nema podataka o odjelima');
                }

                // Filter odjeli by radilišta
                const filteredOdjeli = data.odjeli.filter(odjel => {
                    const odjelRadiliste = (odjel.radiliste || '').toUpperCase().trim();
                    return radilista.some(r => odjelRadiliste.includes(r.toUpperCase()));
                });

                console.log('Filtered odjeli:', filteredOdjeli);

                // Render stanje odjela table
                renderPoslovodjaStanjeTable(filteredOdjeli);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-stanje-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa stanje:', error);
                showError('Greška', 'Greška pri učitavanju stanja odjela: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Render Stanje Odjela table for poslovođa
        function renderPoslovodjaStanjeTable(odjeli) {
            const headerElem = document.getElementById('poslovodja-stanje-header');
            const bodyElem = document.getElementById('poslovodja-stanje-body');

            if (odjeli.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema odjela na vašim radilištima</td></tr>';
                return;
            }

            // Build header
            let headerHtml = `
                <tr>
                    <th>Odjel</th>
                    <th>Radilište</th>
                    <th>Izvođač</th>
                    <th>Projekat (m³)</th>
                    <th>Sječa (m³)</th>
                    <th>Otprema (m³)</th>
                    <th>Realizacija (%)</th>
                    <th>Zadnji Unos</th>
                </tr>
            `;
            headerElem.innerHTML = headerHtml;

            // Build body
            let bodyHtml = '';
            odjeli.forEach((odjel, index) => {
                const rowBg = index % 2 === 0 ? '#f9fafb' : 'white';
                const projekat = odjel.projekat || 0;
                const sjeca = odjel.sjeca || 0;
                const procenat = projekat > 0 ? ((sjeca / projekat) * 100).toFixed(1) : '0.0';

                let percentClass = '';
                if (procenat < 50) percentClass = 'style="color: #dc2626; font-weight: 700;"';
                else if (procenat >= 100) percentClass = 'style="color: #059669; font-weight: 700;"';
                else percentClass = 'style="color: #d97706; font-weight: 600;"';

                bodyHtml += `
                    <tr style="background: ${rowBg};">
                        <td style="font-weight: 600;">${odjel.odjel || ''}</td>
                        <td>${odjel.radiliste || '-'}</td>
                        <td>${odjel.izvođač || '-'}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace;">${projekat.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 600;">${sjeca.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace;">${(odjel.otprema || 0).toFixed(2)}</td>
                        <td ${percentClass} style="text-align: right; font-family: 'Courier New', monospace;">${procenat}%</td>
                        <td>${odjel.datumZadnjeSjece || '-'}</td>
                    </tr>
                `;
            });

            bodyElem.innerHTML = bodyHtml;
        }

        // Load ODJELI U REALIZACIJI za poslovođu
        async function loadPoslovodjaRealizacija() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('poslovodja-realizacija-content').classList.add('hidden');

            try {
                const radilista = getPoslovodjaRadilista();
                console.log('Poslovođa radilišta:', radilista);

                // Display radilišta
                document.getElementById('poslovodja-radilista-list-2').textContent = radilista.join(', ');

                // Load STANJE ODJELA data (koristimo iste podatke kao za stanje)
                const url = `${API_URL}?path=odjeli&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_odjeli_realizacija');

                console.log('Odjeli data:', data);

                if (data.error || !data.odjeli) {
                    throw new Error(data.error || 'Nema podataka o odjelima');
                }

                // Filter odjeli by radilišta - prikazujemo samo odjele koji su u realizaciji (imaju sječu)
                const filteredOdjeli = data.odjeli.filter(odjel => {
                    const odjelRadiliste = (odjel.radiliste || '').toUpperCase().trim();
                    const hasRadiliste = radilista.some(r => odjelRadiliste.includes(r.toUpperCase()));
                    const uRealizaciji = (odjel.sjeca || 0) > 0; // Samo odjeli koji imaju sječu
                    return hasRadiliste && uRealizaciji;
                });

                console.log('Filtered odjeli u realizaciji:', filteredOdjeli);

                // Render realizacija table (isti format kao stanje)
                renderPoslovodjaRealizacijaTable(filteredOdjeli);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-realizacija-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa realizacija:', error);
                showError('Greška', 'Greška pri učitavanju odjela u realizaciji: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Render Odjeli u Realizaciji table for poslovođa
        function renderPoslovodjaRealizacijaTable(odjeli) {
            const headerElem = document.getElementById('poslovodja-realizacija-header');
            const bodyElem = document.getElementById('poslovodja-realizacija-body');

            if (odjeli.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Trenutno nema odjela u realizaciji na vašim radilištima</td></tr>';
                return;
            }

            // Build header (isti kao stanje odjela)
            let headerHtml = `
                <tr>
                    <th>Odjel</th>
                    <th>Radilište</th>
                    <th>Izvođač</th>
                    <th>Projekat (m³)</th>
                    <th>Sječa (m³)</th>
                    <th>Otprema (m³)</th>
                    <th>Realizacija (%)</th>
                    <th>Zadnji Unos</th>
                </tr>
            `;
            headerElem.innerHTML = headerHtml;

            // Build body
            let bodyHtml = '';
            odjeli.forEach((odjel, index) => {
                const rowBg = index % 2 === 0 ? '#f9fafb' : 'white';
                const projekat = odjel.projekat || 0;
                const sjeca = odjel.sjeca || 0;
                const procenat = projekat > 0 ? ((sjeca / projekat) * 100).toFixed(1) : '0.0';

                let percentClass = '';
                if (procenat < 50) percentClass = 'style="color: #dc2626; font-weight: 700;"';
                else if (procenat >= 100) percentClass = 'style="color: #059669; font-weight: 700;"';
                else percentClass = 'style="color: #d97706; font-weight: 600;"';

                bodyHtml += `
                    <tr style="background: ${rowBg};">
                        <td style="font-weight: 600;">${odjel.odjel || ''}</td>
                        <td>${odjel.radiliste || '-'}</td>
                        <td>${odjel.izvođač || '-'}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace;">${projekat.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 600;">${sjeca.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace;">${(odjel.otprema || 0).toFixed(2)}</td>
                        <td ${percentClass} style="text-align: right; font-family: 'Courier New', monospace;">${procenat}%</td>
                        <td>${odjel.datumZadnjeSjece || '-'}</td>
                    </tr>
                `;
            });

            bodyElem.innerHTML = bodyHtml;
        }

        // Load ZADNJIH 5 DANA (Primka i Otprema) za poslovođu
        async function loadPoslovodjaZadnjih5() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('poslovodja-zadnjih5-content').classList.add('hidden');

            try {
                const radilista = getPoslovodjaRadilista();
                console.log('Poslovođa radilišta:', radilista);

                // Display radilišta
                document.getElementById('poslovodja-radilista-list-3').textContent = radilista.join(', ');

                // Izračunaj datum prije 5 dana
                const today = new Date();
                const fiveDaysAgo = new Date(today);
                fiveDaysAgo.setDate(today.getDate() - 5);

                // Load primke i otpreme
                const primkeUrl = `${API_URL}?path=primke&username=${currentUser.username}&password=${currentPassword}`;
                const otpremeUrl = `${API_URL}?path=otpreme&username=${currentUser.username}&password=${currentPassword}`;

                const [primkeData, otpremeData] = await Promise.all([
                    fetchWithCache(primkeUrl, 'cache_primke_zadnjih5'),
                    fetchWithCache(otpremeUrl, 'cache_otpreme_zadnjih5')
                ]);

                console.log('Primke data:', primkeData);
                console.log('Otpreme data:', otpremeData);

                if (primkeData.error) {
                    throw new Error('Greška pri učitavanju primki: ' + primkeData.error);
                }
                if (otpremeData.error) {
                    throw new Error('Greška pri učitavanju otprema: ' + otpremeData.error);
                }

                // Filter primke by radilišta i datum (zadnjih 5 dana)
                const filteredPrimke = (primkeData.primke || []).filter(primka => {
                    const primkaRadiliste = (primka.radiliste || '').toUpperCase().trim();
                    const hasRadiliste = radilista.some(r => primkaRadiliste.includes(r.toUpperCase()));

                    // Parse datum
                    const primkaDatum = new Date(primka.datum);
                    const withinLast5Days = primkaDatum >= fiveDaysAgo;

                    return hasRadiliste && withinLast5Days;
                });

                // Filter otpreme by radilišta i datum (zadnjih 5 dana)
                const filteredOtpreme = (otpremeData.otpreme || []).filter(otprema => {
                    const otpremaRadiliste = (otprema.radiliste || '').toUpperCase().trim();
                    const hasRadiliste = radilista.some(r => otpremaRadiliste.includes(r.toUpperCase()));

                    // Parse datum
                    const otpremaDatum = new Date(otprema.datum);
                    const withinLast5Days = otpremaDatum >= fiveDaysAgo;

                    return hasRadiliste && withinLast5Days;
                });

                // Sortiraj po datumu (najnoviji prvi)
                filteredPrimke.sort((a, b) => new Date(b.datum) - new Date(a.datum));
                filteredOtpreme.sort((a, b) => new Date(b.datum) - new Date(a.datum));

                console.log('Filtered primke (zadnjih 5 dana):', filteredPrimke);
                console.log('Filtered otpreme (zadnjih 5 dana):', filteredOtpreme);

                // Render tables
                renderPoslovodjaPrimkaTable(filteredPrimke);
                renderPoslovodjaOtpremaTable(filteredOtpreme);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-zadnjih5-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa zadnjih 5:', error);
                showError('Greška', 'Greška pri učitavanju zadnjih 5 dana: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Render Primka table (zadnjih 5 dana)
        function renderPoslovodjaPrimkaTable(primke) {
            const headerElem = document.getElementById('poslovodja-primka-header');
            const bodyElem = document.getElementById('poslovodja-primka-body');

            if (primke.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema primki u zadnjih 5 dana</td></tr>';
                return;
            }

            // Build header - redosled: Radnik (Primac), Odjel, Datum, Sortiment, Količina
            let headerHtml = `
                <tr style="background: #059669;">
                    <th style="color: white; font-weight: 700;">Primac</th>
                    <th style="color: white; font-weight: 700;">Odjel</th>
                    <th style="color: white; font-weight: 700;">Datum</th>
                    <th style="color: white; font-weight: 700;">Sortiment</th>
                    <th style="color: white; font-weight: 700;">Količina (m³)</th>
                </tr>
            `;
            headerElem.innerHTML = headerHtml;

            // Build body
            let bodyHtml = '';
            primke.forEach((primka, index) => {
                const rowBg = index % 2 === 0 ? '#f0fdf4' : 'white';
                bodyHtml += `
                    <tr style="background: ${rowBg};">
                        <td style="font-weight: 600;">${primka.primac || '-'}</td>
                        <td>${primka.odjel || '-'}</td>
                        <td style="font-weight: 500;">${primka.datum || '-'}</td>
                        <td>${primka.sortiment || '-'}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #059669;">${(primka.kolicina || 0).toFixed(2)}</td>
                    </tr>
                `;
            });

            bodyElem.innerHTML = bodyHtml;
        }

        // Render Otprema table (zadnjih 5 dana)
        function renderPoslovodjaOtpremaTable(otpreme) {
            const headerElem = document.getElementById('poslovodja-otprema-header');
            const bodyElem = document.getElementById('poslovodja-otprema-body');

            if (otpreme.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema otprema u zadnjih 5 dana</td></tr>';
                return;
            }

            // Build header - redosled: Radnik (Otpremac), Odjel, Datum, Sortiment, Količina
            let headerHtml = `
                <tr style="background: #dc2626;">
                    <th style="color: white; font-weight: 700;">Otpremac</th>
                    <th style="color: white; font-weight: 700;">Odjel</th>
                    <th style="color: white; font-weight: 700;">Datum</th>
                    <th style="color: white; font-weight: 700;">Sortiment</th>
                    <th style="color: white; font-weight: 700;">Količina (m³)</th>
                </tr>
            `;
            headerElem.innerHTML = headerHtml;

            // Build body
            let bodyHtml = '';
            otpreme.forEach((otprema, index) => {
                const rowBg = index % 2 === 0 ? '#fef2f2' : 'white';
                bodyHtml += `
                    <tr style="background: ${rowBg};">
                        <td style="font-weight: 600;">${otprema.otpremac || '-'}</td>
                        <td>${otprema.odjel || '-'}</td>
                        <td style="font-weight: 500;">${otprema.datum || '-'}</td>
                        <td>${otprema.sortiment || '-'}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #dc2626;">${(otprema.kolicina || 0).toFixed(2)}</td>
                    </tr>
                `;
            });

            bodyElem.innerHTML = bodyHtml;
        }

        // Load SUMA MJESECA za poslovođu
        async function loadPoslovodjaSuma() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('poslovodja-suma-content').classList.add('hidden');

            try {
                const radilista = getPoslovodjaRadilista();
                console.log('Poslovođa radilišta:', radilista);

                // Display radilišta
                document.getElementById('poslovodja-radilista-list-4').textContent = radilista.join(', ');

                // Get current month/year
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth(); // 0-11

                // Load primke i otpreme
                const primkeUrl = `${API_URL}?path=primke&username=${currentUser.username}&password=${currentPassword}`;
                const otpremeUrl = `${API_URL}?path=otpreme&username=${currentUser.username}&password=${currentPassword}`;

                const [primkeData, otpremeData] = await Promise.all([
                    fetchWithCache(primkeUrl, 'cache_primke_suma'),
                    fetchWithCache(otpremeUrl, 'cache_otpreme_suma')
                ]);

                console.log('Primke data:', primkeData);
                console.log('Otpreme data:', otpremeData);

                if (primkeData.error) {
                    throw new Error('Greška pri učitavanju primki: ' + primkeData.error);
                }
                if (otpremeData.error) {
                    throw new Error('Greška pri učitavanju otprema: ' + otpremeData.error);
                }

                // Filter by radilišta i tekući mjesec
                const filteredPrimke = (primkeData.primke || []).filter(primka => {
                    const primkaRadiliste = (primka.radiliste || '').toUpperCase().trim();
                    const hasRadiliste = radilista.some(r => primkaRadiliste.includes(r.toUpperCase()));

                    // Parse datum
                    const primkaDatum = new Date(primka.datum);
                    const sameMonth = primkaDatum.getMonth() === currentMonth && primkaDatum.getFullYear() === currentYear;

                    return hasRadiliste && sameMonth;
                });

                const filteredOtpreme = (otpremeData.otpreme || []).filter(otprema => {
                    const otpremaRadiliste = (otprema.radiliste || '').toUpperCase().trim();
                    const hasRadiliste = radilista.some(r => otpremaRadiliste.includes(r.toUpperCase()));

                    // Parse datum
                    const otpremaDatum = new Date(otprema.datum);
                    const sameMonth = otpremaDatum.getMonth() === currentMonth && otpremaDatum.getFullYear() === currentYear;

                    return hasRadiliste && sameMonth;
                });

                console.log('Filtered primke (trenutni mjesec):', filteredPrimke);
                console.log('Filtered otpreme (trenutni mjesec):', filteredOtpreme);

                // Sumiranje po odjelima
                const sumePoOdjelima = {};

                filteredPrimke.forEach(primka => {
                    const odjel = primka.odjel || 'Nepoznato';
                    const radiliste = primka.radiliste || 'Nepoznato';
                    if (!sumePoOdjelima[odjel]) {
                        sumePoOdjelima[odjel] = {
                            odjel: odjel,
                            radiliste: radiliste,
                            primka: 0,
                            otprema: 0
                        };
                    }
                    sumePoOdjelima[odjel].primka += (primka.kolicina || 0);
                });

                filteredOtpreme.forEach(otprema => {
                    const odjel = otprema.odjel || 'Nepoznato';
                    const radiliste = otprema.radiliste || 'Nepoznato';
                    if (!sumePoOdjelima[odjel]) {
                        sumePoOdjelima[odjel] = {
                            odjel: odjel,
                            radiliste: radiliste,
                            primka: 0,
                            otprema: 0
                        };
                    }
                    sumePoOdjelima[odjel].otprema += (otprema.kolicina || 0);
                });

                // Sumiranje po radilištima
                const sumePoRadilistima = {};

                filteredPrimke.forEach(primka => {
                    const radiliste = primka.radiliste || 'Nepoznato';
                    if (!sumePoRadilistima[radiliste]) {
                        sumePoRadilistima[radiliste] = {
                            radiliste: radiliste,
                            primka: 0,
                            otprema: 0
                        };
                    }
                    sumePoRadilistima[radiliste].primka += (primka.kolicina || 0);
                });

                filteredOtpreme.forEach(otprema => {
                    const radiliste = otprema.radiliste || 'Nepoznato';
                    if (!sumePoRadilistima[radiliste]) {
                        sumePoRadilistima[radiliste] = {
                            radiliste: radiliste,
                            primka: 0,
                            otprema: 0
                        };
                    }
                    sumePoRadilistima[radiliste].otprema += (otprema.kolicina || 0);
                });

                // Convert to arrays
                const odjeliArray = Object.values(sumePoOdjelima);
                const radilistaArray = Object.values(sumePoRadilistima);

                console.log('Sume po odjelima:', odjeliArray);
                console.log('Sume po radilištima:', radilistaArray);

                // Render tables
                renderPoslovodjaSumaOdjeliTable(odjeliArray);
                renderPoslovodjaSumaRadilisteTable(radilistaArray);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('poslovodja-suma-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading poslovođa suma:', error);
                showError('Greška', 'Greška pri učitavanju mjesečnih suma: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Render Suma Mjeseca po Odjelima
        function renderPoslovodjaSumaOdjeliTable(odjeli) {
            const headerElem = document.getElementById('poslovodja-suma-odjeli-header');
            const bodyElem = document.getElementById('poslovodja-suma-odjeli-body');

            if (odjeli.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za trenutni mjesec</td></tr>';
                return;
            }

            // Build header
            let headerHtml = `
                <tr>
                    <th>Odjel</th>
                    <th>Radilište</th>
                    <th>Primka (m³)</th>
                    <th>Otprema (m³)</th>
                    <th>Razlika (m³)</th>
                </tr>
            `;
            headerElem.innerHTML = headerHtml;

            // Calculate totals
            let totalPrimka = 0;
            let totalOtprema = 0;

            // Build body
            let bodyHtml = '';
            odjeli.forEach((odjel, index) => {
                const rowBg = index % 2 === 0 ? '#f9fafb' : 'white';
                const razlika = odjel.primka - odjel.otprema;

                totalPrimka += odjel.primka;
                totalOtprema += odjel.otprema;

                let razlikaColor = '#6b7280';
                if (razlika > 0) razlikaColor = '#059669';
                else if (razlika < 0) razlikaColor = '#dc2626';

                bodyHtml += `
                    <tr style="background: ${rowBg};">
                        <td style="font-weight: 600;">${odjel.odjel}</td>
                        <td>${odjel.radiliste}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; color: #059669; font-weight: 600;">${odjel.primka.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; color: #dc2626; font-weight: 600;">${odjel.otprema.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; color: ${razlikaColor}; font-weight: 700;">${razlika.toFixed(2)}</td>
                    </tr>
                `;
            });

            // Add totals row
            const totalRazlika = totalPrimka - totalOtprema;
            let totalRazlikaColor = '#6b7280';
            if (totalRazlika > 0) totalRazlikaColor = '#059669';
            else if (totalRazlika < 0) totalRazlikaColor = '#dc2626';

            bodyHtml += `
                <tr style="background: #f3f4f6; border-top: 2px solid #1e40af;">
                    <td colspan="2" style="font-weight: 700; text-align: right;">UKUPNO:</td>
                    <td style="text-align: right; font-family: 'Courier New', monospace; color: #059669; font-weight: 700;">${totalPrimka.toFixed(2)}</td>
                    <td style="text-align: right; font-family: 'Courier New', monospace; color: #dc2626; font-weight: 700;">${totalOtprema.toFixed(2)}</td>
                    <td style="text-align: right; font-family: 'Courier New', monospace; color: ${totalRazlikaColor}; font-weight: 700;">${totalRazlika.toFixed(2)}</td>
                </tr>
            `;

            bodyElem.innerHTML = bodyHtml;
        }

        // Render Suma Mjeseca po Radilištima
        function renderPoslovodjaSumaRadilisteTable(radilista) {
            const headerElem = document.getElementById('poslovodja-suma-radiliste-header');
            const bodyElem = document.getElementById('poslovodja-suma-radiliste-body');

            if (radilista.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za trenutni mjesec</td></tr>';
                return;
            }

            // Build header
            let headerHtml = `
                <tr>
                    <th>Radilište</th>
                    <th>Primka (m³)</th>
                    <th>Otprema (m³)</th>
                    <th>Razlika (m³)</th>
                </tr>
            `;
            headerElem.innerHTML = headerHtml;

            // Calculate totals
            let totalPrimka = 0;
            let totalOtprema = 0;

            // Build body
            let bodyHtml = '';
            radilista.forEach((radiliste, index) => {
                const rowBg = index % 2 === 0 ? '#f9fafb' : 'white';
                const razlika = radiliste.primka - radiliste.otprema;

                totalPrimka += radiliste.primka;
                totalOtprema += radiliste.otprema;

                let razlikaColor = '#6b7280';
                if (razlika > 0) razlikaColor = '#059669';
                else if (razlika < 0) razlikaColor = '#dc2626';

                bodyHtml += `
                    <tr style="background: ${rowBg};">
                        <td style="font-weight: 600;">${radiliste.radiliste}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; color: #059669; font-weight: 600;">${radiliste.primka.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; color: #dc2626; font-weight: 600;">${radiliste.otprema.toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'Courier New', monospace; color: ${razlikaColor}; font-weight: 700;">${razlika.toFixed(2)}</td>
                    </tr>
                `;
            });

            // Add totals row
            const totalRazlika = totalPrimka - totalOtprema;
            let totalRazlikaColor = '#6b7280';
            if (totalRazlika > 0) totalRazlikaColor = '#059669';
            else if (totalRazlika < 0) totalRazlikaColor = '#dc2626';

            bodyHtml += `
                <tr style="background: #f3f4f6; border-top: 2px solid #1e40af;">
                    <td style="font-weight: 700; text-align: right;">UKUPNO:</td>
                    <td style="text-align: right; font-family: 'Courier New', monospace; color: #059669; font-weight: 700;">${totalPrimka.toFixed(2)}</td>
                    <td style="text-align: right; font-family: 'Courier New', monospace; color: #dc2626; font-weight: 700;">${totalOtprema.toFixed(2)}</td>
                    <td style="text-align: right; font-family: 'Courier New', monospace; color: ${totalRazlikaColor}; font-weight: 700;">${totalRazlika.toFixed(2)}</td>
                </tr>
            `;

            bodyElem.innerHTML = bodyHtml;
        }

        // Load primaci data
        async function loadPrimaci() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('primaci-content').classList.add('hidden');

            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=primaci&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_primaci_' + year);

                // Calculate totals per month
                const monthTotals = new Array(12).fill(0);
                let grandTotal = 0;

                data.primaci.forEach(p => {
                    p.mjeseci.forEach((val, idx) => {
                        monthTotals[idx] += val;
                    });
                    grandTotal += p.ukupno;
                });

                // Create header with sticky styling
                const headerHTML = `
                    <tr>
                        <th style="position: sticky; left: 0; background: #059669; z-index: 20; border-right: 3px solid #047857; min-width: 150px;">
                            👷 Primač
                        </th>
                        ${data.mjeseci.map((m, idx) => `
                            <th class="right" style="min-width: 80px; background: #059669; color: white; font-weight: 700; border: 1px solid #047857;">
                                ${m}
                            </th>
                        `).join('')}
                        <th class="right" style="min-width: 100px; background: #047857; color: white; font-weight: 900; border: 2px solid #065f46;">
                            📊 UKUPNO
                        </th>
                    </tr>
                `;
                document.getElementById('primaci-header').innerHTML = headerHTML;

                // Create body with enhanced styling
                const bodyHTML = data.primaci.map((p, idx) => {
                    const rowBg = idx % 2 === 0 ? '#f0fdf4' : 'white';
                    const hoverBg = idx % 2 === 0 ? '#dcfce7' : '#f0fdf4';

                    return `
                        <tr style="background: ${rowBg}; transition: all 0.2s;" onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${rowBg}'">
                            <td style="font-weight: 600; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #059669; padding: 10px; font-size: 11px;">
                                ${p.primac}
                            </td>
                            ${p.mjeseci.map((v, mIdx) => {
                                const displayVal = v > 0 ? v.toFixed(2) : '-';
                                const fontWeight = v > 0 ? 'font-weight: 500;' : 'color: #9ca3af;';
                                return `<td class="right" style="${fontWeight} border: 1px solid #d1fae5; padding: 8px; font-size: 10px; font-family: 'Courier New', monospace;">${displayVal}</td>`;
                            }).join('')}
                            <td class="right" style="font-weight: 700; background: linear-gradient(to right, #d1fae5, #a7f3d0); border: 2px solid #059669; padding: 10px; font-size: 11px; color: #065f46;">
                                ${p.ukupno.toFixed(2)} m³
                            </td>
                        </tr>
                    `;
                }).join('');

                // Add totals row with softer colors
                const totalsRow = `
                    <tr style="background: linear-gradient(to bottom, #d1fae5, #a7f3d0); color: #065f46; font-weight: 700; border-top: 3px solid #34d399;">
                        <td style="position: sticky; left: 0; background: #d1fae5; z-index: 10; border-right: 3px solid #34d399; padding: 12px; font-size: 12px;">
                            📈 UKUPNO
                        </td>
                        ${monthTotals.map(total => `
                            <td class="right" style="border: 1px solid #6ee7b7; padding: 10px; font-size: 11px;">
                                ${total > 0 ? total.toFixed(2) : '-'}
                            </td>
                        `).join('')}
                        <td class="right" style="background: #a7f3d0; border: 2px solid #34d399; padding: 12px; font-size: 13px; font-weight: 900;">
                            ${grandTotal.toFixed(2)} m³
                        </td>
                    </tr>
                `;

                document.getElementById('primaci-body').innerHTML = bodyHTML + totalsRow;

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('primaci-content').classList.remove('hidden');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju primača: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }

        // Load otpremaci data
        async function loadOtpremaci() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('otpremaci-content').classList.add('hidden');

            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=otpremaci&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_otpremaci_' + year);

                // Calculate totals per month
                const monthTotals = new Array(12).fill(0);
                let grandTotal = 0;

                data.otpremaci.forEach(o => {
                    o.mjeseci.forEach((val, idx) => {
                        monthTotals[idx] += val;
                    });
                    grandTotal += o.ukupno;
                });

                // Create header with sticky styling (blue theme)
                const headerHTML = `
                    <tr>
                        <th style="position: sticky; left: 0; background: #2563eb; z-index: 20; border-right: 3px solid #1e40af; min-width: 150px;">
                            🚛 Otpremač
                        </th>
                        ${data.mjeseci.map((m, idx) => `
                            <th class="right" style="min-width: 80px; background: #2563eb; color: white; font-weight: 700; border: 1px solid #1e40af;">
                                ${m}
                            </th>
                        `).join('')}
                        <th class="right" style="min-width: 100px; background: #1e40af; color: white; font-weight: 900; border: 2px solid #1e3a8a;">
                            📊 UKUPNO
                        </th>
                    </tr>
                `;
                document.getElementById('otpremaci-header').innerHTML = headerHTML;

                // Create body with enhanced styling (blue theme)
                const bodyHTML = data.otpremaci.map((o, idx) => {
                    const rowBg = idx % 2 === 0 ? '#eff6ff' : 'white';
                    const hoverBg = idx % 2 === 0 ? '#dbeafe' : '#eff6ff';

                    return `
                        <tr style="background: ${rowBg}; transition: all 0.2s;" onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${rowBg}'">
                            <td style="font-weight: 600; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #2563eb; padding: 10px; font-size: 11px;">
                                ${o.otpremac}
                            </td>
                            ${o.mjeseci.map((v, mIdx) => {
                                const displayVal = v > 0 ? v.toFixed(2) : '-';
                                const fontWeight = v > 0 ? 'font-weight: 500;' : 'color: #9ca3af;';
                                return `<td class="right" style="${fontWeight} border: 1px solid #dbeafe; padding: 8px; font-size: 10px; font-family: 'Courier New', monospace;">${displayVal}</td>`;
                            }).join('')}
                            <td class="right" style="font-weight: 700; background: linear-gradient(to right, #dbeafe, #bfdbfe); border: 2px solid #2563eb; padding: 10px; font-size: 11px; color: #1e40af;">
                                ${o.ukupno.toFixed(2)} m³
                            </td>
                        </tr>
                    `;
                }).join('');

                // Add totals row with softer colors
                const totalsRow = `
                    <tr style="background: linear-gradient(to bottom, #dbeafe, #bfdbfe); color: #1e40af; font-weight: 700; border-top: 3px solid #60a5fa;">
                        <td style="position: sticky; left: 0; background: #dbeafe; z-index: 10; border-right: 3px solid #60a5fa; padding: 12px; font-size: 12px;">
                            📈 UKUPNO
                        </td>
                        ${monthTotals.map(total => `
                            <td class="right" style="border: 1px solid #93c5fd; padding: 10px; font-size: 11px;">
                                ${total > 0 ? total.toFixed(2) : '-'}
                            </td>
                        `).join('')}
                        <td class="right" style="background: #bfdbfe; border: 2px solid #60a5fa; padding: 12px; font-size: 13px; font-weight: 900;">
                            ${grandTotal.toFixed(2)} m³
                        </td>
                    </tr>
                `;

                document.getElementById('otpremaci-body').innerHTML = bodyHTML + totalsRow;

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('otpremaci-content').classList.remove('hidden');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju otpremača: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }

        // Helper function to get month name
        function getMonthName(monthIndex) {
            const months = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
                           'Juli', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
            return months[monthIndex];
        }

        // Load primaci daily data (for selected month)
        async function loadPrimaciDaily(selectedMonth) {
            try {
                const now = new Date();
                const year = now.getFullYear();
                const month = selectedMonth !== undefined ? parseInt(selectedMonth) : now.getMonth(); // 0-11

                // Set the selected month in the dropdown
                const monthSelect = document.getElementById('primaci-month-select');
                if (monthSelect) {
                    monthSelect.value = month;
                }

                const url = `${API_URL}?path=primaci-daily&year=${year}&month=${month}&username=${currentUser.username}&password=${currentPassword}`;
                console.log('Loading primaci daily from:', url);
                const data = await fetchWithCache(url, `cache_primaci_daily_${year}_${month}`);

                console.log('Primaci daily data received:', data);

                if (data.error) {
                    console.error('Error loading primaci daily:', data.error);
                    document.getElementById('primaci-daily-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.data || data.data.length === 0) {
                    console.log('No data available for current month');
                    document.getElementById('primaci-daily-header').innerHTML = `
                        <tr>
                            <th style="background: #ea580c; color: white; padding: 12px;">
                                📅 Sječa po danima - ${getMonthName(month)} ${year}
                            </th>
                        </tr>
                    `;
                    document.getElementById('primaci-daily-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka za tekući mjesec
                        </td></tr>
                    `;
                    return;
                }

                // ✅ NOVO: Header bez kolone Datum
                const headerHTML = `
                    <tr>
                        <th style="position: sticky; top: 0; left: 0; background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); z-index: 30; border-right: 3px solid #7c2d12; min-width: 70px; box-shadow: 2px 0 5px rgba(0,0,0,0.1); font-size: 10px; padding: 8px 6px; font-weight: 800; color: white; text-transform: uppercase; letter-spacing: 0.5px;">
                            🏢 Odjel
                        </th>
                        <th style="position: sticky; top: 0; min-width: 110px; background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); color: white; font-weight: 800; border: 1px solid #7c2d12; font-size: 10px; padding: 8px 6px; z-index: 20; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 0.5px;">
                            👷 Primač
                        </th>
                        ${data.sortimentiNazivi.map(s => `
                            <th style="position: sticky; top: 0; min-width: 52px; background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); color: white; font-weight: 700; border: 1px solid #7c2d12; font-size: 8.5px; padding: 8px 3px; z-index: 20; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; line-height: 1.1;">
                                ${s}
                            </th>
                        `).join('')}
                    </tr>
                `;
                document.getElementById('primaci-daily-header').innerHTML = headerHTML;

                // ✅ NOVO: Grupiši podatke po datumu
                const groupedByDate = {};
                data.data.forEach(row => {
                    if (!groupedByDate[row.datum]) {
                        groupedByDate[row.datum] = [];
                    }
                    groupedByDate[row.datum].push(row);
                });

                // ✅ NOVO: Helper funkcija za dan u sedmici
                function getDayName(dateStr) {
                    const parts = dateStr.split('.');
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const yearPart = parts[2] ? parseInt(parts[2]) : year;
                    const date = new Date(yearPart, month, day);
                    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
                    return days[date.getDay()];
                }

                // ✅ NOVO: Build body sa grupisanjem po datumu
                let bodyHTML = '';
                const dates = Object.keys(groupedByDate).sort((a, b) => {
                    const [dayA, monthA] = a.split('.').map(Number);
                    const [dayB, monthB] = b.split('.').map(Number);
                    return monthA !== monthB ? monthB - monthA : dayB - dayA;  // Obrnut redosled - od najnovijeg ka najstarijem
                });

                dates.forEach(datum => {
                    const rows = groupedByDate[datum];
                    const dayName = getDayName(datum);

                    // ✅ Zaglavlje datuma
                    const numSortimenti = data.sortimentiNazivi.length;
                    bodyHTML += `
                        <tr style="background: linear-gradient(135deg, #c2410c 0%, #9a3412 50%, #7c2d12 100%); box-shadow: 0 2px 8px rgba(124, 45, 18, 0.4);">
                            <td colspan="${2 + numSortimenti}" style="font-weight: 800; font-size: 14px; padding: 10px 12px; text-align: center; border-top: 3px solid #451a03; color: white; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                                📅 ${datum} - ${dayName}
                            </td>
                        </tr>
                    `;

                    // ✅ Kalkuliši totale za ovaj dan
                    const dailyTotals = {};
                    data.sortimentiNazivi.forEach(s => dailyTotals[s] = 0);
                    rows.forEach(row => {
                        data.sortimentiNazivi.forEach(s => {
                            dailyTotals[s] += row.sortimenti[s] || 0;
                        });
                    });

                    // 🎨 EXPERT: Data rows sa hover animations
                    rows.forEach((row, idx) => {
                        const rowBg = idx % 2 === 0 ? '#fff7ed' : '#ffffff';
                        const hoverBg = '#ffedd5';

                        const sortimentiCells = data.sortimentiNazivi.map(sortiment => {
                            const val = row.sortimenti[sortiment] || 0;
                            const displayVal = val > 0 ? val.toFixed(2) : '-';
                            const fontWeight = val > 0 ? 'font-weight: 600; color: #7c2d12;' : 'color: #d1d5db;';
                            return `<td style="${fontWeight} border: 1px solid #fed7aa; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 6px 3px; transition: all 0.15s;">${displayVal}</td>`;
                        }).join('');

                        bodyHTML += `
                            <tr style="background: ${rowBg}; transition: all 0.15s ease;" onmouseover="this.style.background='${hoverBg}'; this.style.transform='scale(1.005)'; this.style.boxShadow='0 2px 8px rgba(234,88,12,0.15)';" onmouseout="this.style.background='${rowBg}'; this.style.transform='scale(1)'; this.style.boxShadow='none';">
                                <td style="font-weight: 700; font-size: 10px; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #ea580c; padding: 6px 5px; border: 1px solid #fed7aa; color: #7c2d12; box-shadow: 2px 0 3px rgba(0,0,0,0.05);">
                                    ${row.odjel}
                                </td>
                                <td style="font-weight: 600; font-size: 10px; border: 1px solid #fed7aa; padding: 6px 5px; color: #9a3412;">${row.primac}</td>
                                ${sortimentiCells}
                            </tr>
                        `;
                    });

                    // 🎨 EXPERT: Daily recap sa gradient i shadow
                    const dailyTotalsCells = data.sortimentiNazivi.map(s => {
                        const val = dailyTotals[s];
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        return `<td style="border: 1px solid #fb923c; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 7px 3px; font-weight: 800; background: #fed7aa; color: #7c2d12;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: linear-gradient(to bottom, #fed7aa 0%, #fdba74 100%); box-shadow: 0 1px 4px rgba(251,146,60,0.3);">
                            <td style="position: sticky; left: 0; background: linear-gradient(to right, #fed7aa 0%, #fdba74 100%); z-index: 10; border-right: 2px solid #ea580c; padding: 8px 5px; font-size: 11px; font-weight: 800; color: #7c2d12; box-shadow: 2px 0 4px rgba(0,0,0,0.1);">
                                📊 UKUPNO ${datum}
                            </td>
                            <td style="background: transparent;"></td>
                            ${dailyTotalsCells}
                        </tr>
                    `;
                });

                // ✅ Grand total za cijeli mjesec (na kraju)
                const grandTotals = {};
                data.sortimentiNazivi.forEach(s => grandTotals[s] = 0);
                data.data.forEach(row => {
                    data.sortimentiNazivi.forEach(s => {
                        grandTotals[s] += row.sortimenti[s] || 0;
                    });
                });

                const grandTotalsCells = data.sortimentiNazivi.map(s => {
                    const val = grandTotals[s];
                    const displayVal = val > 0 ? val.toFixed(2) : '-';
                    return `<td style="border: 2px solid #7c2d12; font-family: 'Courier New', monospace; text-align: right; padding: 9px 3px; font-weight: 800; font-size: 11px; background: #dcfce7; color: #065f46;">${displayVal}</td>`;
                }).join('');

                bodyHTML += `
                    <tr style="background: linear-gradient(135deg, #16a34a 0%, #059669 50%, #047857 100%); color: white; font-weight: 800; border-top: 4px solid #065f46; box-shadow: 0 -2px 8px rgba(22,163,74,0.3);">
                        <td colspan="2" style="padding: 12px; font-size: 13px; text-align: center; font-weight: 900; letter-spacing: 1.5px; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">
                            📈 UKUPNO ${getMonthName(month).toUpperCase()}
                        </td>
                        ${grandTotalsCells}
                    </tr>
                `;

                document.getElementById('primaci-daily-body').innerHTML = bodyHTML;

                console.log('Primaci daily table rendered with', data.data.length, 'rows');

            } catch (error) {
                console.error('Error in loadPrimaciDaily:', error);
                document.getElementById('primaci-daily-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }

        // Load otpremaci daily data (for selected month)
        async function loadOtremaciDaily(selectedMonth) {
            try {
                const now = new Date();
                const year = now.getFullYear();
                const month = selectedMonth !== undefined ? parseInt(selectedMonth) : now.getMonth(); // 0-11

                // Set the selected month in the dropdown
                const monthSelect = document.getElementById('otpremaci-month-select');
                if (monthSelect) {
                    monthSelect.value = month;
                }

                const url = `${API_URL}?path=otpremaci-daily&year=${year}&month=${month}&username=${currentUser.username}&password=${currentPassword}`;
                console.log('Loading otpremaci daily from:', url);
                const data = await fetchWithCache(url, `cache_otpremaci_daily_${year}_${month}`);

                console.log('Otpremaci daily data received:', data);

                if (data.error) {
                    console.error('Error loading otpremaci daily:', data.error);
                    document.getElementById('otpremaci-daily-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.data || data.data.length === 0) {
                    console.log('No data available for current month');
                    document.getElementById('otpremaci-daily-header').innerHTML = `
                        <tr>
                            <th style="background: #0891b2; color: white; padding: 12px;">
                                📅 Otprema po danima - ${getMonthName(month)} ${year}
                            </th>
                        </tr>
                    `;
                    document.getElementById('otpremaci-daily-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka za tekući mjesec
                        </td></tr>
                    `;
                    return;
                }

                // ✅ NOVO: Header bez kolone Datum
                const headerHTML = `
                    <tr>
                        <th style="position: sticky; top: 0; left: 0; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); z-index: 30; border-right: 3px solid #164e63; min-width: 70px; box-shadow: 2px 0 5px rgba(0,0,0,0.1); font-size: 10px; padding: 8px 6px; font-weight: 800; color: white; text-transform: uppercase; letter-spacing: 0.5px;">
                            🏢 Odjel
                        </th>
                        <th style="position: sticky; top: 0; min-width: 105px; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; font-weight: 800; border: 1px solid #164e63; font-size: 9px; padding: 8px 6px; z-index: 20; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 0.5px;">
                            🚛 Otpremač
                        </th>
                        <th style="position: sticky; top: 0; min-width: 105px; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; font-weight: 800; border: 1px solid #164e63; font-size: 9px; padding: 8px 6px; z-index: 20; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 0.5px;">
                            👤 Kupac
                        </th>
                        ${data.sortimentiNazivi.map(s => `
                            <th style="position: sticky; top: 0; min-width: 52px; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; font-weight: 700; border: 1px solid #164e63; font-size: 8.5px; padding: 8px 3px; z-index: 20; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; line-height: 1.1;">
                                ${s}
                            </th>
                        `).join('')}
                    </tr>
                `;
                document.getElementById('otpremaci-daily-header').innerHTML = headerHTML;

                // ✅ NOVO: Grupiši podatke po datumu
                const groupedByDate = {};
                data.data.forEach(row => {
                    if (!groupedByDate[row.datum]) {
                        groupedByDate[row.datum] = [];
                    }
                    groupedByDate[row.datum].push(row);
                });

                // ✅ NOVO: Helper funkcija za dan u sedmici
                function getDayName(dateStr) {
                    const parts = dateStr.split('.');
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const yearPart = parts[2] ? parseInt(parts[2]) : year;
                    const date = new Date(yearPart, month, day);
                    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
                    return days[date.getDay()];
                }

                // ✅ NOVO: Build body sa grupisanjem po datumu
                let bodyHTML = '';
                const dates = Object.keys(groupedByDate).sort((a, b) => {
                    const [dayA, monthA] = a.split('.').map(Number);
                    const [dayB, monthB] = b.split('.').map(Number);
                    return monthA !== monthB ? monthB - monthA : dayB - dayA;  // Obrnut redosled - od najnovijeg ka najstarijem
                });

                dates.forEach(datum => {
                    const rows = groupedByDate[datum];
                    const dayName = getDayName(datum);

                    // ✅ Zaglavlje datuma
                    const numSortimenti = data.sortimentiNazivi.length;
                    bodyHTML += `
                        <tr style="background: linear-gradient(135deg, #0e7490 0%, #155e75 50%, #164e63 100%); box-shadow: 0 2px 8px rgba(22, 78, 99, 0.4);">
                            <td colspan="${3 + numSortimenti}" style="font-weight: 800; font-size: 14px; padding: 10px 12px; text-align: center; border-top: 3px solid #083344; color: white; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                                📅 ${datum} - ${dayName}
                            </td>
                        </tr>
                    `;

                    // ✅ Kalkuliši totale za ovaj dan
                    const dailyTotals = {};
                    data.sortimentiNazivi.forEach(s => dailyTotals[s] = 0);
                    rows.forEach(row => {
                        data.sortimentiNazivi.forEach(s => {
                            dailyTotals[s] += row.sortimenti[s] || 0;
                        });
                    });

                    // ✅ Redovi za ovaj dan (bez kolone Datum)
                    rows.forEach((row, idx) => {
                        const rowBg = idx % 2 === 0 ? '#ecfeff' : '#ffffff';
                        const hoverBg = '#cffafe';

                        const sortimentiCells = data.sortimentiNazivi.map(sortiment => {
                            const val = row.sortimenti[sortiment] || 0;
                            const displayVal = val > 0 ? val.toFixed(2) : '-';
                            const fontWeight = val > 0 ? 'font-weight: 600; color: #164e63;' : 'color: #d1d5db;';
                            return `<td style="${fontWeight} border: 1px solid #a5f3fc; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 6px 3px; transition: all 0.15s;">${displayVal}</td>`;
                        }).join('');

                        bodyHTML += `
                            <tr style="background: ${rowBg}; transition: all 0.15s ease;" onmouseover="this.style.background='${hoverBg}'; this.style.transform='scale(1.005)'; this.style.boxShadow='0 2px 8px rgba(8,145,178,0.15)';" onmouseout="this.style.background='${rowBg}'; this.style.transform='scale(1)'; this.style.boxShadow='none';">
                                <td style="font-weight: 700; font-size: 10px; position: sticky; left: 0; background: ${rowBg}; z-index: 10; border-right: 2px solid #0891b2; padding: 6px 5px; border: 1px solid #a5f3fc; color: #164e63; box-shadow: 2px 0 3px rgba(0,0,0,0.05);">
                                    ${row.odjel}
                                </td>
                                <td style="font-weight: 600; font-size: 10px; border: 1px solid #a5f3fc; padding: 6px 5px; color: #0e7490;">${row.otpremac}</td>
                                <td style="border: 1px solid #a5f3fc; color: #155e75; font-weight: 600; font-size: 10px; padding: 6px 5px;">${row.kupac || '-'}</td>
                                ${sortimentiCells}
                            </tr>
                        `;
                    });

                    // ✅ Rekapitulacija za ovaj dan
                    const dailyTotalsCells = data.sortimentiNazivi.map(s => {
                        const val = dailyTotals[s];
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        return `<td style="border: 1px solid #22d3ee; font-family: 'Courier New', monospace; text-align: right; padding: 7px 3px; font-size: 10px; font-weight: 800; color: #164e63; background: #a5f3fc;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: linear-gradient(to bottom, #a5f3fc, #67e8f9); color: #0e7490; font-weight: 700;">
                            <td style="position: sticky; left: 0; background: #a5f3fc; z-index: 10; border-right: 2px solid #0891b2; padding: 10px; font-size: 13px;">
                                📊 UKUPNO ${datum}
                            </td>
                            <td style="background: transparent;"></td>
                            <td style="background: #a5f3fc;"></td>
                            ${dailyTotalsCells}
                        </tr>
                    `;
                });

                // ✅ Grand total za cijeli mjesec (na kraju)
                const grandTotals = {};
                data.sortimentiNazivi.forEach(s => grandTotals[s] = 0);
                data.data.forEach(row => {
                    data.sortimentiNazivi.forEach(s => {
                        grandTotals[s] += row.sortimenti[s] || 0;
                    });
                });

                const grandTotalsCells = data.sortimentiNazivi.map(s => {
                    const val = grandTotals[s];
                    const displayVal = val > 0 ? val.toFixed(2) : '-';
                    return `<td style="border: 2px solid #164e63; font-family: 'Courier New', monospace; text-align: right; padding: 9px 3px; font-weight: 800; font-size: 11px; background: #bfdbfe; color: #1e3a8a;">${displayVal}</td>`;
                }).join('');

                bodyHTML += `
                    <tr style="background: linear-gradient(135deg, #0e7490, #0891b2); color: white; font-weight: 700; border-top: 4px solid #164e63;">
                        <td colspan="3" style="padding: 12px; font-size: 13px; font-weight: 900; letter-spacing: 1.5px; text-shadow: 0 1px 3px rgba(0,0,0,0.4); text-align: center;">
                            📈 UKUPNO ${getMonthName(month).toUpperCase()}
                        </td>
                        ${grandTotalsCells}
                    </tr>
                `;

                document.getElementById('otpremaci-daily-body').innerHTML = bodyHTML;

                console.log('Otpremaci daily table rendered with', data.data.length, 'rows');

            } catch (error) {
                console.error('Error in loadOtremaciDaily:', error);
                document.getElementById('otpremaci-daily-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }

        // ========================================
        // PRIKAZI PO RADILIŠTIMA I IZVOĐAČIMA
        // ========================================

        // Load primaci by radiliste
        async function loadPrimaciByRadiliste() {
            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=primaci-by-radiliste&year=${year}&username=${currentUser.username}&password=${currentPassword}`;

                const data = await fetchWithCache(url, `cache_primaci_radiliste_${year}`);

                console.log('Primaci by radiliste data received:', data);

                if (data.error) {
                    console.error('Error loading primaci by radiliste:', data.error);
                    document.getElementById('primaci-radilista-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.radilista || data.radilista.length === 0) {
                    document.getElementById('primaci-radilista-header').innerHTML = `
                        <tr><th style="background: #ea580c; color: white; padding: 12px;">
                            🏗️ Prikaz po radilištima - ${year}
                        </th></tr>
                    `;
                    document.getElementById('primaci-radilista-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka o radilištima
                        </td></tr>
                    `;
                    return;
                }

                // Render mjesečnu tabelu
                const mjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

                let headerHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            🏗️ Radilište
                        </th>
                `;
                mjeseci.forEach(mj => {
                    headerHTML += `<th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 12px;">${mj}</th>`;
                });
                headerHTML += `
                    <th style="background: linear-gradient(135deg, #7c2d12, #451a03); color: white; padding: 12px; font-weight: 900; position: sticky; top: 0; z-index: 20;">
                        UKUPNO
                    </th>
                </tr>
                `;
                document.getElementById('primaci-radilista-header').innerHTML = headerHTML;

                let bodyHTML = '';
                data.radilista.forEach((radiliste, idx) => {
                    const rowBg = idx % 2 === 0 ? '#fff7ed' : '#ffffff';
                    const hoverBg = '#ffedd5';

                    const mjeseciCells = radiliste.mjeseci.map(val => {
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #7c2d12;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #fed7aa; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: ${rowBg}; transition: all 0.15s ease;" onmouseover="this.style.background='${hoverBg}';" onmouseout="this.style.background='${rowBg}';">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #fed7aa; padding: 10px; color: #7c2d12;">
                                ${radiliste.naziv}
                            </td>
                            ${mjeseciCells}
                            <td style="background: #fef3c7; border: 2px solid #f59e0b; font-family: 'Courier New', monospace; text-align: right; padding: 10px; font-weight: 900; font-size: 13px; color: #92400e;">
                                ${radiliste.ukupno.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });
                document.getElementById('primaci-radilista-body').innerHTML = bodyHTML;

                // Render godišnju rekapitulaciju po sortimentima
                let recapHeaderHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            🏗️ Radilište
                        </th>
                `;
                data.sortimentiNazivi.forEach(s => {
                    recapHeaderHTML += `<th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 10px;">${s}</th>`;
                });
                recapHeaderHTML += `</tr>`;
                document.getElementById('primaci-radilista-recap-header').innerHTML = recapHeaderHTML;

                let recapBodyHTML = '';
                data.radilista.forEach((radiliste, idx) => {
                    const rowBg = idx % 2 === 0 ? '#fff7ed' : '#ffffff';

                    const sortimentiCells = data.sortimentiNazivi.map(s => {
                        const val = radiliste.sortimentiUkupno[s] || 0;
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #7c2d12;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #fed7aa; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    recapBodyHTML += `
                        <tr style="background: ${rowBg};">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #fed7aa; padding: 10px; color: #7c2d12;">
                                ${radiliste.naziv}
                            </td>
                            ${sortimentiCells}
                        </tr>
                    `;
                });
                document.getElementById('primaci-radilista-recap-body').innerHTML = recapBodyHTML;

                console.log('Primaci by radiliste rendered');

            } catch (error) {
                console.error('Error in loadPrimaciByRadiliste:', error);
                document.getElementById('primaci-radilista-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }

        // Load primaci by izvodjac
        async function loadPrimaciByIzvodjac() {
            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=primaci-by-izvodjac&year=${year}&username=${currentUser.username}&password=${currentPassword}`;

                const data = await fetchWithCache(url, `cache_primaci_izvodjac_${year}`);

                console.log('Primaci by izvodjac data received:', data);

                if (data.error) {
                    console.error('Error loading primaci by izvodjac:', data.error);
                    document.getElementById('primaci-izvodjaci-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.izvodjaci || data.izvodjaci.length === 0) {
                    document.getElementById('primaci-izvodjaci-header').innerHTML = `
                        <tr><th style="background: #ea580c; color: white; padding: 12px;">
                            👷 Prikaz po izvođačima - ${year}
                        </th></tr>
                    `;
                    document.getElementById('primaci-izvodjaci-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka o izvođačima
                        </td></tr>
                    `;
                    return;
                }

                // Render mjesečnu tabelu
                const mjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

                let headerHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            👷 Izvođač radova
                        </th>
                `;
                mjeseci.forEach(mj => {
                    headerHTML += `<th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 12px;">${mj}</th>`;
                });
                headerHTML += `
                    <th style="background: linear-gradient(135deg, #7c2d12, #451a03); color: white; padding: 12px; font-weight: 900; position: sticky; top: 0; z-index: 20;">
                        UKUPNO
                    </th>
                </tr>
                `;
                document.getElementById('primaci-izvodjaci-header').innerHTML = headerHTML;

                let bodyHTML = '';
                data.izvodjaci.forEach((izvodjac, idx) => {
                    const rowBg = idx % 2 === 0 ? '#fff7ed' : '#ffffff';
                    const hoverBg = '#ffedd5';

                    const mjeseciCells = izvodjac.mjeseci.map(val => {
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #7c2d12;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #fed7aa; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: ${rowBg}; transition: all 0.15s ease;" onmouseover="this.style.background='${hoverBg}';" onmouseout="this.style.background='${rowBg}';">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #fed7aa; padding: 10px; color: #7c2d12;">
                                ${izvodjac.naziv}
                            </td>
                            ${mjeseciCells}
                            <td style="background: #fef3c7; border: 2px solid #f59e0b; font-family: 'Courier New', monospace; text-align: right; padding: 10px; font-weight: 900; font-size: 13px; color: #92400e;">
                                ${izvodjac.ukupno.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });
                document.getElementById('primaci-izvodjaci-body').innerHTML = bodyHTML;

                // Render godišnju rekapitulaciju po sortimentima
                let recapHeaderHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            👷 Izvođač radova
                        </th>
                `;
                data.sortimentiNazivi.forEach(s => {
                    recapHeaderHTML += `<th style="background: linear-gradient(135deg, #ea580c, #dc2626); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 10px;">${s}</th>`;
                });
                recapHeaderHTML += `</tr>`;
                document.getElementById('primaci-izvodjaci-recap-header').innerHTML = recapHeaderHTML;

                let recapBodyHTML = '';
                data.izvodjaci.forEach((izvodjac, idx) => {
                    const rowBg = idx % 2 === 0 ? '#fff7ed' : '#ffffff';

                    const sortimentiCells = data.sortimentiNazivi.map(s => {
                        const val = izvodjac.sortimentiUkupno[s] || 0;
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #7c2d12;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #fed7aa; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    recapBodyHTML += `
                        <tr style="background: ${rowBg};">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #fed7aa; padding: 10px; color: #7c2d12;">
                                ${izvodjac.naziv}
                            </td>
                            ${sortimentiCells}
                        </tr>
                    `;
                });
                document.getElementById('primaci-izvodjaci-recap-body').innerHTML = recapBodyHTML;

                console.log('Primaci by izvodjac rendered');

            } catch (error) {
                console.error('Error in loadPrimaciByIzvodjac:', error);
                document.getElementById('primaci-izvodjaci-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }

        // Load otpremaci by radiliste
        async function loadOtremaciByRadiliste() {
            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=otpremaci-by-radiliste&year=${year}&username=${currentUser.username}&password=${currentPassword}`;

                const data = await fetchWithCache(url, `cache_otpremaci_radiliste_${year}`);

                console.log('Otpremaci by radiliste data received:', data);

                if (data.error) {
                    console.error('Error loading otpremaci by radiliste:', data.error);
                    document.getElementById('otpremaci-radilista-body').innerHTML = `
                        <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                            Greška: ${data.error}
                        </td></tr>
                    `;
                    return;
                }

                if (!data.radilista || data.radilista.length === 0) {
                    document.getElementById('otpremaci-radilista-header').innerHTML = `
                        <tr><th style="background: #0891b2; color: white; padding: 12px;">
                            🏗️ Prikaz po radilištima - ${year}
                        </th></tr>
                    `;
                    document.getElementById('otpremaci-radilista-body').innerHTML = `
                        <tr><td style="text-align: center; padding: 40px; color: #6b7280;">
                            Nema podataka o radilištima
                        </td></tr>
                    `;
                    return;
                }

                // Render mjesečnu tabelu
                const mjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

                let headerHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #0891b2, #0e7490); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            🏗️ Radilište
                        </th>
                `;
                mjeseci.forEach(mj => {
                    headerHTML += `<th style="background: linear-gradient(135deg, #0891b2, #0e7490); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 12px;">${mj}</th>`;
                });
                headerHTML += `
                    <th style="background: linear-gradient(135deg, #155e75, #164e63); color: white; padding: 12px; font-weight: 900; position: sticky; top: 0; z-index: 20;">
                        UKUPNO
                    </th>
                </tr>
                `;
                document.getElementById('otpremaci-radilista-header').innerHTML = headerHTML;

                let bodyHTML = '';
                data.radilista.forEach((radiliste, idx) => {
                    const rowBg = idx % 2 === 0 ? '#cffafe' : '#ffffff';
                    const hoverBg = '#a5f3fc';

                    const mjeseciCells = radiliste.mjeseci.map(val => {
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #155e75;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #a5f3fc; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    bodyHTML += `
                        <tr style="background: ${rowBg}; transition: all 0.15s ease;" onmouseover="this.style.background='${hoverBg}';" onmouseout="this.style.background='${rowBg}';">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #a5f3fc; padding: 10px; color: #155e75;">
                                ${radiliste.naziv}
                            </td>
                            ${mjeseciCells}
                            <td style="background: #bfdbfe; border: 2px solid #3b82f6; font-family: 'Courier New', monospace; text-align: right; padding: 10px; font-weight: 900; font-size: 13px; color: #1e3a8a;">
                                ${radiliste.ukupno.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });
                document.getElementById('otpremaci-radilista-body').innerHTML = bodyHTML;

                // Render godišnju rekapitulaciju po sortimentima
                let recapHeaderHTML = `
                    <tr>
                        <th style="background: linear-gradient(135deg, #0891b2, #0e7490); color: white; padding: 12px; position: sticky; top: 0; z-index: 20;">
                            🏗️ Radilište
                        </th>
                `;
                data.sortimentiNazivi.forEach(s => {
                    recapHeaderHTML += `<th style="background: linear-gradient(135deg, #0891b2, #0e7490); color: white; padding: 12px; position: sticky; top: 0; z-index: 20; font-size: 10px;">${s}</th>`;
                });
                recapHeaderHTML += `</tr>`;
                document.getElementById('otpremaci-radilista-recap-header').innerHTML = recapHeaderHTML;

                let recapBodyHTML = '';
                data.radilista.forEach((radiliste, idx) => {
                    const rowBg = idx % 2 === 0 ? '#cffafe' : '#ffffff';

                    const sortimentiCells = data.sortimentiNazivi.map(s => {
                        const val = radiliste.sortimentiUkupno[s] || 0;
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const fontWeight = val > 0 ? 'font-weight: 700; color: #155e75;' : 'color: #d1d5db;';
                        return `<td style="${fontWeight} border: 1px solid #a5f3fc; font-family: 'Courier New', monospace; font-size: 10px; text-align: right; padding: 8px;">${displayVal}</td>`;
                    }).join('');

                    recapBodyHTML += `
                        <tr style="background: ${rowBg};">
                            <td style="font-weight: 700; font-size: 12px; border: 1px solid #a5f3fc; padding: 10px; color: #155e75;">
                                ${radiliste.naziv}
                            </td>
                            ${sortimentiCells}
                        </tr>
                    `;
                });
                document.getElementById('otpremaci-radilista-recap-body').innerHTML = recapBodyHTML;

                console.log('Otpremaci by radiliste rendered');

            } catch (error) {
                console.error('Error in loadOtremaciByRadiliste:', error);
                document.getElementById('otpremaci-radilista-body').innerHTML = `
                    <tr><td colspan="100" style="text-align: center; padding: 40px; color: #dc2626;">
                        Greška pri učitavanju: ${error.message}
                    </td></tr>
                `;
            }
        }


        // Load kupci data
        async function loadKupci() {
            console.log('Loading Kupci screen...');
            document.getElementById('kupci-content').classList.remove('hidden');
            document.getElementById('loading-screen').classList.add('hidden');

            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=kupci&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_kupci_' + year);

                console.log('Kupci data:', data);

                if (data.error || !data.godisnji || !data.sortimentiNazivi) {
                    throw new Error(data.error || 'Nema podataka');
                }

                // Renderuj godišnju tabelu po kupcima i sortimentima
                renderKupciGodisnjiTable(data.godisnji, data.sortimentiNazivi);

                // Renderuj mjesečnu tabelu za trenutni mjesec
                renderKupciMjesecniTable(data.mjesecni, data.sortimentiNazivi);

            } catch (error) {
                console.error('Error loading kupci:', error);
                document.getElementById('kupci-godisnji-body').innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #dc2626;">Greška pri učitavanju: ' + error.message + '</td></tr>';
                document.getElementById('kupci-mjesecni-body').innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #dc2626;">Greška pri učitavanju: ' + error.message + '</td></tr>';
            }
        }

        // Renderuj godišnju tabelu po kupcima i sortimentima
        function renderKupciGodisnjiTable(godisnji, sortimentiNazivi) {
            const headerElem = document.getElementById('kupci-godisnji-header');
            const bodyElem = document.getElementById('kupci-godisnji-body');

            if (!godisnji || godisnji.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za godišnji prikaz</td></tr>';
                return;
            }

            // Header sa svim sortimentima
            let headerHtml = '<tr style="background: #047857;"><th style="color: white; font-weight: 700; position: sticky; left: 0; background: #047857; z-index: 10;">Kupac</th>';
            sortimentiNazivi.forEach(sortiment => {
                if (sortiment !== 'SVEUKUPNO') {
                    headerHtml += `<th style="color: white; font-weight: 700; text-align: right;">${sortiment}</th>`;
                }
            });
            headerHtml += '<th style="color: white; font-weight: 700; text-align: right; background: #065f46;">UKUPNO (m³)</th></tr>';
            headerElem.innerHTML = headerHtml;

            // Body redovi
            let bodyHtml = '';
            godisnji.forEach((kupac, index) => {
                const rowBg = index % 2 === 0 ? '#f0fdf4' : 'white';
                bodyHtml += `<tr style="background: ${rowBg};" data-kupac="${(kupac.kupac || '').toLowerCase()}">`;
                bodyHtml += `<td style="font-weight: 600; position: sticky; left: 0; background: ${rowBg}; z-index: 5;">${kupac.kupac || '-'}</td>`;

                sortimentiNazivi.forEach(sortiment => {
                    if (sortiment !== 'SVEUKUPNO') {
                        const kolicina = kupac.sortimenti[sortiment] || 0;
                        const display = kolicina > 0 ? kolicina.toFixed(2) : '-';
                        const color = kolicina > 0 ? '#047857' : '#9ca3af';
                        bodyHtml += `<td style="text-align: right; font-family: 'Courier New', monospace; color: ${color};">${display}</td>`;
                    }
                });

                bodyHtml += `<td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #047857; background: #d1fae5;">${(kupac.ukupno || 0).toFixed(2)}</td>`;
                bodyHtml += '</tr>';
            });
            bodyElem.innerHTML = bodyHtml;
        }

        // Renderuj mjesečnu tabelu za trenutni mjesec
        function renderKupciMjesecniTable(mjesecni, sortimentiNazivi) {
            const headerElem = document.getElementById('kupci-mjesecni-header');
            const bodyElem = document.getElementById('kupci-mjesecni-body');

            // Filtruj samo trenutni mjesec
            const currentDate = new Date();
            const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
            const currentMjesec = mjeseci[currentDate.getMonth()];

            const filteredData = mjesecni.filter(red => red.mjesec === currentMjesec);

            if (!filteredData || filteredData.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za tekući mjesec (' + currentMjesec + ')</td></tr>';
                return;
            }

            // Header sa svim sortimentima
            let headerHtml = '<tr style="background: #0369a1;"><th style="color: white; font-weight: 700; position: sticky; left: 0; background: #0369a1; z-index: 10;">Kupac</th>';
            sortimentiNazivi.forEach(sortiment => {
                if (sortiment !== 'SVEUKUPNO') {
                    headerHtml += `<th style="color: white; font-weight: 700; text-align: right;">${sortiment}</th>`;
                }
            });
            headerHtml += '<th style="color: white; font-weight: 700; text-align: right; background: #075985;">UKUPNO (m³)</th></tr>';
            headerElem.innerHTML = headerHtml;

            // Body redovi
            let bodyHtml = '';
            filteredData.forEach((red, index) => {
                const rowBg = index % 2 === 0 ? '#e0f2fe' : 'white';
                bodyHtml += `<tr style="background: ${rowBg};" data-kupac="${(red.kupac || '').toLowerCase()}">`;
                bodyHtml += `<td style="font-weight: 600; position: sticky; left: 0; background: ${rowBg}; z-index: 5;">${red.kupac || '-'}</td>`;

                sortimentiNazivi.forEach(sortiment => {
                    if (sortiment !== 'SVEUKUPNO') {
                        const kolicina = red.sortimenti[sortiment] || 0;
                        const display = kolicina > 0 ? kolicina.toFixed(2) : '-';
                        const color = kolicina > 0 ? '#0369a1' : '#9ca3af';
                        bodyHtml += `<td style="text-align: right; font-family: 'Courier New', monospace; color: ${color};">${display}</td>`;
                    }
                });

                bodyHtml += `<td style="text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #0369a1; background: #bae6fd;">${(red.ukupno || 0).toFixed(2)}</td>`;
                bodyHtml += '</tr>';
            });
            bodyElem.innerHTML = bodyHtml;
        }

        // Filter funkcije za kupce
        function filterKupciGodisnjiTable() {
            const searchInput = document.getElementById('kupci-godisnji-search').value.toLowerCase();
            const rows = document.querySelectorAll('#kupci-godisnji-body tr');

            rows.forEach(row => {
                const kupac = row.getAttribute('data-kupac') || '';
                if (kupac.includes(searchInput)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        function filterKupciMjesecniTable() {
            const searchInput = document.getElementById('kupci-mjesecni-search').value.toLowerCase();
            const rows = document.querySelectorAll('#kupci-mjesecni-body tr');

            rows.forEach(row => {
                const kupac = row.getAttribute('data-kupac') || '';
                if (kupac.includes(searchInput)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        // Load otpreme po kupcima u tekućem mjesecu
        async function loadOtremaciPoKupcima() {
            console.log('Loading Otpremaci po kupcima...');

            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=kupci&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_kupci_' + year);

                console.log('Kupci data for otpreme:', data);

                if (data.error || !data.mjesecni || !data.sortimentiNazivi) {
                    throw new Error(data.error || 'Nema podataka');
                }

                // Update dynamic month name in tab and title
                const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
                const currentMjesec = mjeseci[new Date().getMonth()];
                document.getElementById('current-month-name').textContent = currentMjesec;
                document.getElementById('otpremaci-po-kupcima-month-title').textContent = currentMjesec + ' ' + year;

                // Renderuj expert tabelu
                renderOtremaciPoKupcimaExpertTable(data.mjesecni, data.sortimentiNazivi);

            } catch (error) {
                console.error('Error loading otpremaci po kupcima:', error);
                document.getElementById('otpremaci-po-kupcima-body').innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #dc2626;">Greška pri učitavanju: ' + error.message + '</td></tr>';
            }
        }

        // Renderuj expert tabelu sa sortiranjem i rekapitulacijom
        function renderOtremaciPoKupcimaExpertTable(mjesecni, sortimentiNazivi) {
            const headerElem = document.getElementById('otpremaci-po-kupcima-header');
            const bodyElem = document.getElementById('otpremaci-po-kupcima-body');
            const footerElem = document.getElementById('otpremaci-po-kupcima-footer');

            console.log('renderOtremaciPoKupcimaExpertTable called');
            console.log('Total mjesecni records:', mjesecni.length);

            // Filtruj samo trenutni mjesec
            const currentDate = new Date();
            const mjeseci = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
            const currentMjesec = mjeseci[currentDate.getMonth()];

            console.log('Current month:', currentMjesec);
            console.log('Available months in data:', [...new Set(mjesecni.map(r => r.mjesec))]);

            let filteredData = mjesecni.filter(red => red.mjesec === currentMjesec);

            console.log('Filtered data count:', filteredData.length);

            if (!filteredData || filteredData.length === 0) {
                // DEBUG: Show which months are available
                const availableMonths = [...new Set(mjesecni.map(r => r.mjesec))].join(', ');
                headerElem.innerHTML = '';
                bodyElem.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">
                    <p>Nema podataka za tekući mjesec: <strong>${currentMjesec}</strong></p>
                    <p style="margin-top: 10px; font-size: 14px;">Dostupni mjeseci u bazi: ${availableMonths || 'Nema podataka'}</p>
                </td></tr>`;
                footerElem.innerHTML = '';
                return;
            }

            // SORTIRANJE: Od najvećeg ka najmanjem po ukupnoj količini
            filteredData.sort((a, b) => (b.ukupno || 0) - (a.ukupno || 0));

            // HEADER sa svim sortimentima
            let headerHtml = '<tr><th>Kupac</th>';
            sortimentiNazivi.forEach(sortiment => {
                if (sortiment !== 'SVEUKUPNO') {
                    headerHtml += `<th style="text-align: right;">${sortiment}</th>`;
                }
            });
            headerHtml += '<th style="text-align: right;">UKUPNO (m³)</th></tr>';
            headerElem.innerHTML = headerHtml;

            // BODY redovi + računanje rekapitulacije
            let bodyHtml = '';
            const totals = {};
            let grandTotal = 0;

            // Inicijalizuj sve sortimente na 0
            sortimentiNazivi.forEach(sortiment => {
                totals[sortiment] = 0;
            });

            filteredData.forEach((red, index) => {
                bodyHtml += `<tr data-kupac="${(red.kupac || '').toLowerCase()}">`;
                bodyHtml += `<td>${red.kupac || '-'}</td>`;

                sortimentiNazivi.forEach(sortiment => {
                    if (sortiment !== 'SVEUKUPNO') {
                        const kolicina = red.sortimenti[sortiment] || 0;
                        totals[sortiment] += kolicina;
                        const display = kolicina > 0 ? kolicina.toFixed(2) : '-';
                        bodyHtml += `<td class="sortiment-value">${display}</td>`;
                    }
                });

                const ukupno = red.ukupno || 0;
                grandTotal += ukupno;
                bodyHtml += `<td>${ukupno.toFixed(2)}</td>`;
                bodyHtml += '</tr>';
            });
            bodyElem.innerHTML = bodyHtml;

            // FOOTER - Rekapitulacija mjeseca
            let footerHtml = '<tr><td>📊 REKAPITULACIJA ' + currentMjesec.toUpperCase() + '</td>';
            sortimentiNazivi.forEach(sortiment => {
                if (sortiment !== 'SVEUKUPNO') {
                    const total = totals[sortiment] || 0;
                    const display = total > 0 ? total.toFixed(2) : '-';
                    footerHtml += `<td style="text-align: right;">${display}</td>`;
                }
            });
            footerHtml += `<td>${grandTotal.toFixed(2)}</td>`;
            footerHtml += '</tr>';
            footerElem.innerHTML = footerHtml;
        }

        // Filter funkcija za otpreme po kupcima
        function filterOtremaciPoKupcimaTable() {
            const searchInput = document.getElementById('otpremaci-po-kupcima-search').value.toLowerCase();
            const rows = document.querySelectorAll('#otpremaci-po-kupcima-body tr');

            rows.forEach(row => {
                const kupac = row.getAttribute('data-kupac') || '';
                if (kupac.includes(searchInput)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        // Render Top 5 Kupaca po sortimentima
        function renderKupciTop5BySortimenti(data) {
            console.log('renderKupciTop5BySortimenti called');

            // Define sortimenti categories and their indices
            const sortimentiCategories = {
                'TRUPCI Č': ['TRUPCI Č'],
                'CEL.DUGA': ['CEL.DUGA'],
                'CEL.CIJEPANA': ['CEL.CIJEPANA'],
                'TRUPCI': ['TRUPCI'],
                'OGR. DUGI': ['OGR. DUGI', 'OGR.DUGI'],
                'OGR. CIJEPANI': ['OGR. CIJEPANI', 'OGR.CIJEPANI']
            };

            const divIds = {
                'TRUPCI Č': 'kupci-trupci-cetinara',
                'CEL.DUGA': 'kupci-celuloza-duga',
                'CEL.CIJEPANA': 'kupci-celuloza-cijepana',
                'TRUPCI': 'kupci-trupci-liscara',
                'OGR. DUGI': 'kupci-ogrijev-dugi',
                'OGR. CIJEPANI': 'kupci-ogrijev-cijepani'
            };

            Object.entries(sortimentiCategories).forEach(([category, sortimenti]) => {
                const kupciMap = {};

                data.godisnji.forEach(kupac => {
                    let total = 0;
                    sortimenti.forEach(sortiment => {
                        total += (kupac.sortimenti[sortiment] || 0);
                    });
                    if (total > 0) {
                        kupciMap[kupac.kupac] = total;
                    }
                });

                const sorted = Object.entries(kupciMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                const html = sorted.length > 0
                    ? sorted.map(([kupac, volume], index) => {
                        const rankClass = index < 3 ? 'top' : '';
                        return `
                            <div class="ranking-item">
                                <div class="ranking-number ${rankClass}">${index + 1}</div>
                                <div class="ranking-info">
                                    <div class="ranking-name">${kupac}</div>
                                    <div class="ranking-value">${volume.toFixed(2)} m³</div>
                                </div>
                            </div>
                        `;
                    }).join('')
                    : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka</p>';

                const divId = divIds[category];
                if (divId) {
                    document.getElementById(divId).innerHTML = html;
                }
            });
        }

        // Render Top 10 Kupaca - Total Otprema
        function renderKupciTop10(godisnjiData) {
            console.log('renderKupciTop10 called');

            const sorted = godisnjiData
                .sort((a, b) => (b.ukupno || 0) - (a.ukupno || 0))
                .slice(0, 10);

            const html = sorted.length > 0
                ? sorted.map((kupac, index) => {
                    const rankClass = index < 3 ? 'top' : '';
                    return `
                        <div class="ranking-item">
                            <div class="ranking-number ${rankClass}">${index + 1}</div>
                            <div class="ranking-info">
                                <div class="ranking-name">${kupac.kupac || 'Nepoznat'}</div>
                                <div class="ranking-value">${(kupac.ukupno || 0).toFixed(2)} m³</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka</p>';

            document.getElementById('kupci-top-10-list').innerHTML = html;
        }

        // ========================================
        // WORKER MONTHLY CHART
        // ========================================

        let primacChart = null;
        let otpremacChart = null;

        function createWorkerMonthlyChart(canvasId, unosi, colorPrimary, colorSecondary) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            // Destroy existing chart if exists
            if (canvasId === 'primac-chart' && primacChart) {
                primacChart.destroy();
            }
            if (canvasId === 'otpremac-chart' && otpremacChart) {
                otpremacChart.destroy();
            }

            // Group by month
            const monthlyData = {};
            const mjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

            // Initialize all months to 0
            for (let i = 1; i <= 12; i++) {
                monthlyData[i] = 0;
            }

            // Sum up by month
            unosi.forEach(u => {
                const dateParts = u.datum.split('.');
                if (dateParts.length >= 2) {
                    const mjesec = parseInt(dateParts[1]);
                    monthlyData[mjesec] += u.ukupno || 0;
                }
            });

            // Prepare data for chart
            const labels = mjeseci;
            const values = mjeseci.map((_, idx) => monthlyData[idx + 1]);

            // Create gradient
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, colorPrimary);
            gradient.addColorStop(1, colorSecondary);

            // Create chart
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Količina (m³)',
                        data: values,
                        backgroundColor: gradient,
                        borderColor: colorPrimary,
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2.5,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: {
                                size: 14,
                                weight: 'bold'
                            },
                            bodyFont: {
                                size: 13
                            },
                            callbacks: {
                                label: function(context) {
                                    return 'Ukupno: ' + context.parsed.y.toFixed(2) + ' m³';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                font: {
                                    size: 11,
                                    weight: '600'
                                },
                                color: '#6b7280',
                                callback: function(value) {
                                    return value.toFixed(0) + ' m³';
                                }
                            },
                            grid: {
                                color: '#f3f4f6',
                                drawBorder: false
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    size: 12,
                                    weight: '700'
                                },
                                color: '#374151'
                            },
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });

            // Store chart reference
            if (canvasId === 'primac-chart') {
                primacChart = chart;
            } else if (canvasId === 'otpremac-chart') {
                otpremacChart = chart;
            }
        }

        // Switch between Primac Personal tabs
        function switchPrimacPersonalTab(tab) {
            // Update tab buttons
            const tabs = document.querySelectorAll('#primac-personal-content .submenu-tab');
            tabs.forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');

            // Hide all content
            document.getElementById('primac-personal-detalji').classList.add('hidden');
            document.getElementById('primac-personal-godisnji').classList.add('hidden');

            // Show selected content
            if (tab === 'detalji') {
                document.getElementById('primac-personal-detalji').classList.remove('hidden');
            } else if (tab === 'godisnji') {
                document.getElementById('primac-personal-godisnji').classList.remove('hidden');
                loadPrimacGodisnji();
            }
        }

        // Load Primac Godišnji Prikaz
        async function loadPrimacGodisnji() {
            try {
                const yearSelect = document.getElementById('primac-godisnji-year-select');
                const year = yearSelect ? yearSelect.value : new Date().getFullYear();
                const url = `${API_URL}?path=primac-detail&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_primac_godisnji_' + year);

                if (data.error) {
                    throw new Error(data.error);
                }

                // Group data by month
                const monthlyData = {};
                const mjeseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

                // Initialize all months
                for (let i = 1; i <= 12; i++) {
                    monthlyData[i] = {
                        mjesec: mjeseci[i-1],
                        sortimenti: {},
                        ukupno: 0
                    };
                    data.sortimentiNazivi.forEach(s => monthlyData[i].sortimenti[s] = 0);
                }

                // Sum by month
                data.unosi.forEach(u => {
                    const dateParts = u.datum.split('.');
                    if (dateParts.length >= 2) {
                        const mjesec = parseInt(dateParts[1]);
                        monthlyData[mjesec].ukupno += u.ukupno || 0;
                        data.sortimentiNazivi.forEach(s => {
                            monthlyData[mjesec].sortimenti[s] += (u.sortimenti[s] || 0);
                        });
                    }
                });

                // Create header
                const headerHTML = `
                    <tr>
                        <th>Mjesec</th>
                        ${data.sortimentiNazivi.map(s => `<th class="sortiment-col">${s}</th>`).join('')}
                    </tr>
                `;
                document.getElementById('primac-godisnji-main-header').innerHTML = headerHTML;

                // Create body
                let totalSortimenti = {};
                data.sortimentiNazivi.forEach(s => totalSortimenti[s] = 0);
                let totalUkupno = 0;

                const bodyHTML = mjeseci.map((mjesec, idx) => {
                    const mjesecNum = idx + 1;
                    const monthData = monthlyData[mjesecNum];

                    // Add to totals
                    totalUkupno += monthData.ukupno;
                    data.sortimentiNazivi.forEach(s => {
                        totalSortimenti[s] += monthData.sortimenti[s];
                    });

                    const sortimentiCells = data.sortimentiNazivi.map(s => {
                        const val = monthData.sortimenti[s];
                        return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                    }).join('');

                    return `
                        <tr class="mjesec-${mjesecNum}">
                            <td style="font-weight: 700;">${mjesec}</td>
                            ${sortimentiCells}
                        </tr>
                    `;
                }).join('');

                // Add totals row
                const totalsCells = data.sortimentiNazivi.map(s => {
                    const val = totalSortimenti[s];
                    return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                }).join('');

                const bodyWithTotals = bodyHTML + `
                    <tr class="totals-row">
                        <td style="text-align: left;">GODIŠNJE UKUPNO</td>
                        ${totalsCells}
                    </tr>
                `;

                document.getElementById('primac-godisnji-main-body').innerHTML = bodyWithTotals;
                document.getElementById('primac-godisnji-year-badge').textContent = year;

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju godišnjeg prikaza: ' + error.message);
            }
        }

        // Load primac personal data
        async function loadPrimacPersonal() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('primac-personal-content').classList.add('hidden');

            try {
                const yearSelect = document.getElementById('primac-personal-year-select');
                const year = yearSelect ? yearSelect.value : new Date().getFullYear();
                const url = `${API_URL}?path=primac-detail&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_primac_detail_' + year);

                console.log('Primac personal data:', data);

                if (data.error) {
                    throw new Error(data.error);
                }

                // Create header
                const headerHTML = `
                    <tr>
                        <th onclick="sortTable(0, 'primac-personal-table')">Datum ⇅</th>
                        <th onclick="sortTable(1, 'primac-personal-table')">Odjel ⇅</th>
                        ${data.sortimentiNazivi.map((s, i) => `<th class="sortiment-col" onclick="sortTable(${i+2}, 'primac-personal-table')">${s} ⇅</th>`).join('')}
                        <th class="ukupno-col" onclick="sortTable(${data.sortimentiNazivi.length + 2}, 'primac-personal-table')">Ukupno ⇅</th>
                    </tr>
                `;
                document.getElementById('primac-personal-header').innerHTML = headerHTML;

                // Create body with totals
                let totals = { sortimenti: {}, ukupno: 0 };
                data.sortimentiNazivi.forEach(s => totals.sortimenti[s] = 0);

                const bodyHTML = data.unosi.map(u => {
                    // Add to totals
                    data.sortimentiNazivi.forEach(s => {
                        totals.sortimenti[s] += (u.sortimenti[s] || 0);
                    });
                    totals.ukupno += u.ukupno;

                    const sortimentiCells = data.sortimentiNazivi.map(sortiment => {
                        const val = u.sortimenti[sortiment] || 0;
                        return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                    }).join('');

                    // Extract month from date (format: DD.MM.YYYY)
                    const dateParts = u.datum.split('.');
                    const mjesec = dateParts.length >= 2 ? parseInt(dateParts[1]) : 1;

                    return `
                        <tr class="mjesec-${mjesec}">
                            <td style="font-weight: 500;">${u.datum}</td>
                            <td>${u.odjel}</td>
                            ${sortimentiCells}
                            <td class="ukupno-col">${u.ukupno.toFixed(2)}</td>
                        </tr>
                    `;
                }).join('');

                // Add totals row
                const totalsCells = data.sortimentiNazivi.map(s => {
                    const val = totals.sortimenti[s];
                    return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                }).join('');

                const bodyWithTotals = bodyHTML + `
                    <tr class="totals-row">
                        <td colspan="2" style="text-align: left;">UKUPNO</td>
                        ${totalsCells}
                        <td class="ukupno-col">${totals.ukupno.toFixed(2)}</td>
                    </tr>
                `;

                document.getElementById('primac-personal-body').innerHTML = bodyWithTotals;

                // Create monthly chart
                createWorkerMonthlyChart('primac-chart', data.unosi, '#047857', '#10b981');

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('primac-personal-content').classList.remove('hidden');

                // Load godišnji prikaz by default (it's the first tab)
                loadPrimacGodisnji();

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju podataka: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }

        // Load otpremac personal data
        async function loadOtpremacPersonal() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('otpremac-personal-content').classList.add('hidden');

            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=otpremac-detail&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_otpremac_detail_' + year);

                console.log('Otpremac personal data:', data);

                if (data.error) {
                    throw new Error(data.error);
                }

                // Create header
                const headerHTML = `
                    <tr>
                        <th onclick="sortTable(0, 'otpremac-personal-table')">Datum ⇅</th>
                        <th onclick="sortTable(1, 'otpremac-personal-table')">Odjel ⇅</th>
                        <th onclick="sortTable(2, 'otpremac-personal-table')">Kupac ⇅</th>
                        ${data.sortimentiNazivi.map((s, i) => `<th class="sortiment-col" onclick="sortTable(${i+3}, 'otpremac-personal-table')">${s} ⇅</th>`).join('')}
                        <th class="ukupno-col" onclick="sortTable(${data.sortimentiNazivi.length + 3}, 'otpremac-personal-table')">Ukupno ⇅</th>
                    </tr>
                `;
                document.getElementById('otpremac-personal-header').innerHTML = headerHTML;

                // Create body with totals
                let totals = { sortimenti: {}, ukupno: 0 };
                data.sortimentiNazivi.forEach(s => totals.sortimenti[s] = 0);

                const bodyHTML = data.unosi.map(u => {
                    // Add to totals
                    data.sortimentiNazivi.forEach(s => {
                        totals.sortimenti[s] += (u.sortimenti[s] || 0);
                    });
                    totals.ukupno += u.ukupno;

                    const sortimentiCells = data.sortimentiNazivi.map(sortiment => {
                        const val = u.sortimenti[sortiment] || 0;
                        return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                    }).join('');

                    // Extract month from date (format: DD.MM.YYYY)
                    const dateParts = u.datum.split('.');
                    const mjesec = dateParts.length >= 2 ? parseInt(dateParts[1]) : 1;

                    return `
                        <tr class="mjesec-${mjesec}">
                            <td style="font-weight: 500;">${u.datum}</td>
                            <td>${u.odjel}</td>
                            <td>${u.kupac || '-'}</td>
                            ${sortimentiCells}
                            <td class="ukupno-col">${u.ukupno.toFixed(2)}</td>
                        </tr>
                    `;
                }).join('');

                // Add totals row
                const totalsCells = data.sortimentiNazivi.map(s => {
                    const val = totals.sortimenti[s];
                    return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                }).join('');

                const bodyWithTotals = bodyHTML + `
                    <tr class="totals-row">
                        <td colspan="3" style="text-align: left;">UKUPNO</td>
                        ${totalsCells}
                        <td class="ukupno-col">${totals.ukupno.toFixed(2)}</td>
                    </tr>
                `;

                document.getElementById('otpremac-personal-body').innerHTML = bodyWithTotals;

                // Create monthly chart
                createWorkerMonthlyChart('otpremac-chart', data.unosi, '#1e40af', '#3b82f6');

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('otpremac-personal-content').classList.remove('hidden');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju podataka: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }

        // ========================================
        // ODJELI VIEW (BY DEPARTMENT) - WITH PAGINATION
        // ========================================

        let primacOdjeliData = null;
        let primacOdjeliCurrentPage = 0;
        const primacOdjeliPageSize = 5;

        let otpremacOdjeliData = null;
        let otpremacOdjeliCurrentPage = 0;
        const otpremacOdjeliPageSize = 5;

        // Load primac odjeli data
        async function loadPrimacOdjeli() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('primac-odjeli-content').classList.add('hidden');

            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=primac-odjeli&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_primac_odjeli_' + year);

                console.log('Primac odjeli data:', data);

                if (data.error) {
                    throw new Error(data.error);
                }

                primacOdjeliData = data;
                primacOdjeliCurrentPage = 0;
                renderPrimacOdjeliPage();

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('primac-odjeli-content').classList.remove('hidden');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju podataka: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }

        function renderPrimacOdjeliPage() {
            if (!primacOdjeliData) return;

            const start = primacOdjeliCurrentPage * primacOdjeliPageSize;
            const end = Math.min(start + primacOdjeliPageSize, primacOdjeliData.odjeli.length);
            const pageOdjeli = primacOdjeliData.odjeli.slice(start, end);

            let html = '';

            pageOdjeli.forEach(odjel => {
                // Kreiraj HTML za odjel sa dve tabele
                html += `
                    <div style="margin-bottom: 40px; border: 2px solid #10b981; border-radius: 12px; padding: 20px; background: #f0fdf4;">
                        <h3 style="color: #047857; margin-bottom: 16px;">📁 ${odjel.odjel}</h3>
                        <p style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">Zadnji unos: ${odjel.zadnjiDatum || 'N/A'}</p>

                        <!-- Apsolutne vrijednosti -->
                        <h4 style="font-size: 15px; margin-bottom: 8px; color: #059669;">Apsolutne vrijednosti (m³)</h4>
                        <div class="kupci-table-wrapper" style="margin-bottom: 20px;">
                            <table class="kupci-table">
                                <thead>
                                    <tr>
                                        ${primacOdjeliData.sortimentiNazivi.map(s => `<th class="sortiment-col">${s}</th>`).join('')}
                                        <th class="ukupno-col">Ukupno</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        ${primacOdjeliData.sortimentiNazivi.map(s => {
                                            const val = odjel.sortimenti[s] || 0;
                                            return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                                        }).join('')}
                                        <td class="ukupno-col">${odjel.ukupno.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Procentualne vrijednosti -->
                        <h4 style="font-size: 15px; margin-bottom: 8px; color: #059669;">Procentualni udio (%)</h4>
                        <div class="kupci-table-wrapper">
                            <table class="kupci-table">
                                <thead>
                                    <tr>
                                        ${primacOdjeliData.sortimentiNazivi.map(s => `<th class="sortiment-col">${s}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        ${primacOdjeliData.sortimentiNazivi.map(s => {
                                            const val = odjel.sortimenti[s] || 0;
                                            const percent = odjel.ukupno > 0 ? (val / odjel.ukupno) * 100 : 0;
                                            return `<td class="sortiment-col">${percent > 0 ? percent.toFixed(1) + '%' : '-'}</td>`;
                                        }).join('')}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });

            document.getElementById('primac-odjeli-container').innerHTML = html;

            // Update pagination controls
            const totalPages = Math.ceil(primacOdjeliData.odjeli.length / primacOdjeliPageSize);
            document.getElementById('primac-odjeli-page-info').textContent = `Stranica ${primacOdjeliCurrentPage + 1} od ${totalPages}`;
            document.getElementById('primac-odjeli-prev').disabled = primacOdjeliCurrentPage === 0;
            document.getElementById('primac-odjeli-next').disabled = primacOdjeliCurrentPage >= totalPages - 1;
        }

        function prevPagePrimacOdjeli() {
            if (primacOdjeliCurrentPage > 0) {
                primacOdjeliCurrentPage--;
                renderPrimacOdjeliPage();
            }
        }

        function nextPagePrimacOdjeli() {
            const totalPages = Math.ceil(primacOdjeliData.odjeli.length / primacOdjeliPageSize);
            if (primacOdjeliCurrentPage < totalPages - 1) {
                primacOdjeliCurrentPage++;
                renderPrimacOdjeliPage();
            }
        }

        // Load otpremac odjeli data
        async function loadOtpremacOdjeli() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('otpremac-odjeli-content').classList.add('hidden');

            try {
                const year = new Date().getFullYear();
                const url = `${API_URL}?path=otpremac-odjeli&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const data = await fetchWithCache(url, 'cache_otpremac_odjeli_' + year);

                console.log('Otpremac odjeli data:', data);

                if (data.error) {
                    throw new Error(data.error);
                }

                otpremacOdjeliData = data;
                otpremacOdjeliCurrentPage = 0;
                renderOtpremacOdjeliPage();

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('otpremac-odjeli-content').classList.remove('hidden');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju podataka: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }

        function renderOtpremacOdjeliPage() {
            if (!otpremacOdjeliData) return;

            const start = otpremacOdjeliCurrentPage * otpremacOdjeliPageSize;
            const end = Math.min(start + otpremacOdjeliPageSize, otpremacOdjeliData.odjeli.length);
            const pageOdjeli = otpremacOdjeliData.odjeli.slice(start, end);

            let html = '';

            pageOdjeli.forEach(odjel => {
                // Kreiraj HTML za odjel sa dve tabele
                html += `
                    <div style="margin-bottom: 40px; border: 2px solid #2563eb; border-radius: 12px; padding: 20px; background: #eff6ff;">
                        <h3 style="color: #1e40af; margin-bottom: 16px;">📁 ${odjel.odjel}</h3>
                        <p style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">Zadnji unos: ${odjel.zadnjiDatum || 'N/A'}</p>

                        <!-- Apsolutne vrijednosti -->
                        <h4 style="font-size: 15px; margin-bottom: 8px; color: #2563eb;">Apsolutne vrijednosti (m³)</h4>
                        <div class="kupci-table-wrapper" style="margin-bottom: 20px;">
                            <table class="kupci-table">
                                <thead>
                                    <tr>
                                        ${otpremacOdjeliData.sortimentiNazivi.map(s => `<th class="sortiment-col">${s}</th>`).join('')}
                                        <th class="ukupno-col">Ukupno</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        ${otpremacOdjeliData.sortimentiNazivi.map(s => {
                                            const val = odjel.sortimenti[s] || 0;
                                            return `<td class="sortiment-col">${val > 0 ? val.toFixed(2) : '-'}</td>`;
                                        }).join('')}
                                        <td class="ukupno-col">${odjel.ukupno.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Procentualne vrijednosti -->
                        <h4 style="font-size: 15px; margin-bottom: 8px; color: #2563eb;">Procentualni udio (%)</h4>
                        <div class="kupci-table-wrapper">
                            <table class="kupci-table">
                                <thead>
                                    <tr>
                                        ${otpremacOdjeliData.sortimentiNazivi.map(s => `<th class="sortiment-col">${s}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        ${otpremacOdjeliData.sortimentiNazivi.map(s => {
                                            const val = odjel.sortimenti[s] || 0;
                                            const percent = odjel.ukupno > 0 ? (val / odjel.ukupno) * 100 : 0;
                                            return `<td class="sortiment-col">${percent > 0 ? percent.toFixed(1) + '%' : '-'}</td>`;
                                        }).join('')}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });

            document.getElementById('otpremac-odjeli-container').innerHTML = html;

            // Update pagination controls
            const totalPages = Math.ceil(otpremacOdjeliData.odjeli.length / otpremacOdjeliPageSize);
            document.getElementById('otpremac-odjeli-page-info').textContent = `Stranica ${otpremacOdjeliCurrentPage + 1} od ${totalPages}`;
            document.getElementById('otpremac-odjeli-prev').disabled = otpremacOdjeliCurrentPage === 0;
            document.getElementById('otpremac-odjeli-next').disabled = otpremacOdjeliCurrentPage >= totalPages - 1;
        }

        function prevPageOtpremacOdjeli() {
            if (otpremacOdjeliCurrentPage > 0) {
                otpremacOdjeliCurrentPage--;
                renderOtpremacOdjeliPage();
            }
        }

        function nextPageOtpremacOdjeli() {
            const totalPages = Math.ceil(otpremacOdjeliData.odjeli.length / otpremacOdjeliPageSize);
            if (otpremacOdjeliCurrentPage < totalPages - 1) {
                otpremacOdjeliCurrentPage++;
                renderOtpremacOdjeliPage();
            }
        }

        // ========================================
        // UTILITY FUNCTIONS
        // ========================================

        // Dark mode toggle
        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('dark-mode', isDark ? 'enabled' : 'disabled');
        }

        // Load dark mode preference
        window.addEventListener('DOMContentLoaded', () => {
            const darkMode = localStorage.getItem('dark-mode');
            if (darkMode === 'enabled') {
                document.body.classList.add('dark-mode');
            }
        });

        // Filter dashboard table
        function filterDashboardTable() {
            const input = document.getElementById('dashboard-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('dashboard-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length; i++) {
                const td = tr[i].getElementsByTagName('td')[0];
                if (td) {
                    const txtValue = td.textContent || td.innerText;
                    tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
                }
            }
        }

        // Filter odjeli table
        function filterOdjeliTable() {
            const input = document.getElementById('odjeli-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('odjeli-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length; i++) {
                const td = tr[i].getElementsByTagName('td')[0];
                if (td) {
                    const txtValue = td.textContent || td.innerText;
                    tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
                }
            }
        }

        // Filter primaci table
        function filterPrimaciTable() {
            const input = document.getElementById('primaci-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('primaci-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length; i++) {
                const td = tr[i].getElementsByTagName('td')[0];
                if (td) {
                    const txtValue = td.textContent || td.innerText;
                    tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
                }
            }
        }

        // Filter otpremaci table
        function filterOtremaciTable() {
            const input = document.getElementById('otpremaci-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('otpremaci-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length; i++) {
                const td = tr[i].getElementsByTagName('td')[0];
                if (td) {
                    const txtValue = td.textContent || td.innerText;
                    tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
                }
            }
        }

        // Filter primaci daily table
        function filterPrimaciDailyTable() {
            const input = document.getElementById('primaci-daily-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('primaci-daily-table');
            const tbody = table.getElementsByTagName('tbody')[0];
            if (!tbody) return;
            const tr = tbody.getElementsByTagName('tr');

            for (let i = 0; i < tr.length - 1; i++) { // -1 to exclude UKUPNO row
                const tds = tr[i].getElementsByTagName('td');
                let found = false;
                // Search in datum, odjel, and primac columns
                for (let j = 0; j < 3 && j < tds.length; j++) {
                    const txtValue = tds[j].textContent || tds[j].innerText;
                    if (txtValue.toUpperCase().indexOf(filter) > -1) {
                        found = true;
                        break;
                    }
                }
                tr[i].style.display = found ? '' : 'none';
            }
        }

        // Filter otpremaci daily table
        function filterOtremaciDailyTable() {
            const input = document.getElementById('otpremaci-daily-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('otpremaci-daily-table');
            const tbody = table.getElementsByTagName('tbody')[0];
            if (!tbody) return;
            const tr = tbody.getElementsByTagName('tr');

            for (let i = 0; i < tr.length - 1; i++) { // -1 to exclude UKUPNO row
                const tds = tr[i].getElementsByTagName('td');
                let found = false;
                // Search in datum, odjel, otpremac, and kupac columns
                for (let j = 0; j < 4 && j < tds.length; j++) {
                    const txtValue = tds[j].textContent || tds[j].innerText;
                    if (txtValue.toUpperCase().indexOf(filter) > -1) {
                        found = true;
                        break;
                    }
                }
                tr[i].style.display = found ? '' : 'none';
            }
        }

        // Filter kupci godisnji table
        function filterKupciGodisnjiTable() {
            const input = document.getElementById('kupci-godisnji-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('kupci-godisnji-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length; i++) {
                const td = tr[i].getElementsByTagName('td')[0];
                if (td) {
                    const txtValue = td.textContent || td.innerText;
                    tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
                }
            }
        }

        // Filter kupci mjesecni table
        function filterKupciMjesecniTable() {
            const input = document.getElementById('kupci-mjesecni-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('kupci-mjesecni-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length; i++) {
                const td = tr[i].getElementsByTagName('td')[0];
                if (td) {
                    const txtValue = td.textContent || td.innerText;
                    tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
                }
            }
        }

        // Filter primac personal table
        function filterPrimacPersonalTable() {
            const input = document.getElementById('primac-personal-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('primac-personal-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length; i++) {
                // Search in both datum and odjel columns (0 and 1)
                const td0 = tr[i].getElementsByTagName('td')[0];
                const td1 = tr[i].getElementsByTagName('td')[1];
                if (td0 || td1) {
                    const txtValue = (td0 ? (td0.textContent || td0.innerText) : '') + ' ' +
                                     (td1 ? (td1.textContent || td1.innerText) : '');
                    tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
                }
            }
        }

        // Filter otpremac personal table
        function filterOtpremacPersonalTable() {
            const input = document.getElementById('otpremac-personal-search');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('otpremac-personal-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length; i++) {
                // Search in datum, odjel, and kupac columns (0, 1, and 2)
                const td0 = tr[i].getElementsByTagName('td')[0];
                const td1 = tr[i].getElementsByTagName('td')[1];
                const td2 = tr[i].getElementsByTagName('td')[2];
                if (td0 || td1 || td2) {
                    const txtValue = (td0 ? (td0.textContent || td0.innerText) : '') + ' ' +
                                     (td1 ? (td1.textContent || td1.innerText) : '') + ' ' +
                                     (td2 ? (td2.textContent || td2.innerText) : '');
                    tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
                }
            }
        }

        // Export table to CSV
        function exportTableToCSV(tableType) {
            let table, filename;

            if (tableType === 'dashboard') {
                table = document.getElementById('dashboard-table');
                filename = 'dashboard_pregled.csv';
            } else if (tableType === 'odjeli') {
                table = document.getElementById('odjeli-table');
                filename = 'odjeli_pregled.csv';
            } else if (tableType === 'primaci') {
                table = document.getElementById('primaci-table');
                filename = 'primaci_pregled.csv';
            } else if (tableType === 'otpremaci') {
                table = document.getElementById('otpremaci-table');
                filename = 'otpremaci_pregled.csv';
            } else if (tableType === 'kupci-godisnji') {
                table = document.getElementById('kupci-godisnji-table');
                filename = 'kupci_godisnji_pregled.csv';
            } else if (tableType === 'kupci-mjesecni') {
                table = document.getElementById('kupci-mjesecni-table');
                filename = 'kupci_mjesecni_pregled.csv';
            } else if (tableType === 'primac-personal') {
                table = document.getElementById('primac-personal-table');
                filename = 'moja_sjeca_' + new Date().getFullYear() + '.csv';
            } else if (tableType === 'otpremac-personal') {
                table = document.getElementById('otpremac-personal-table');
                filename = 'moja_otprema_' + new Date().getFullYear() + '.csv';
            }

            const rows = table.querySelectorAll('tr');
            const csv = [];

            for (let i = 0; i < rows.length; i++) {
                const row = [], cols = rows[i].querySelectorAll('td, th');

                for (let j = 0; j < cols.length; j++) {
                    let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/"/g, '""');
                    row.push('"' + data + '"');
                }

                csv.push(row.join(','));
            }

            const csvString = csv.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Sort table
        function sortTable(columnIndex, tableId) {
            const table = document.getElementById(tableId);
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));

            const sortedRows = rows.sort((a, b) => {
                const aValue = a.querySelectorAll('td')[columnIndex].innerText;
                const bValue = b.querySelectorAll('td')[columnIndex].innerText;

                // Try to parse as number
                const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ''));
                const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ''));

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return aNum - bNum;
                } else {
                    return aValue.localeCompare(bValue, 'bs');
                }
            });

            // Toggle sort direction
            if (table.dataset.lastSort === columnIndex.toString()) {
                sortedRows.reverse();
                table.dataset.lastSort = '';
            } else {
                table.dataset.lastSort = columnIndex.toString();
            }

            // Re-append sorted rows
            sortedRows.forEach(row => tbody.appendChild(row));
        }

        // ========== DODANI UNOSI VIEW ==========

        // Load Dodani Unosi (Pending entries)
        // Helper to determine column group
        function getColumnGroup(sortiment) {
            const cetinariCols = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'CEL.DUGA', 'CEL.CIJEPANA', 'TRUPCI Č', 'ČETINARI'];
            const liscariCols = ['F/L L', 'I L', 'II L', 'III L', 'OGR.DUGI', 'OGR.CIJEPANI', 'TRUPCI L', 'LIŠĆARI'];

            if (cetinariCols.includes(sortiment)) return 'col-group-cetinari';
            if (liscariCols.includes(sortiment)) return 'col-group-liscari';
            return '';
        }

        // Render pending table with filters
        function renderPendingTable(data) {
            let html = '';

            if (!data || data.length === 0) {
                html = '<p style="text-align: center; padding: 40px; color: #6b7280;">Nema dodanih unosa</p>';
            } else {
                // Get sortimenti names from first item
                const sortimentiNazivi = data[0] && data[0].sortimenti ? Object.keys(data[0].sortimenti) : [];

                html = '<div class="kupci-table-wrapper"><table class="kupci-table"><thead><tr>';
                html += '<th style="min-width: 80px;">Tip</th>';
                html += '<th style="min-width: 100px;">Datum</th>';
                html += '<th style="min-width: 80px;">Odjel</th>';
                html += '<th style="min-width: 150px;">Radnik</th>';
                html += '<th style="min-width: 120px;">Kupac</th>';
                html += '<th style="min-width: 120px;">Br. otpremnice</th>';

                // Sortimenti headers with grouping
                for (let i = 0; i < sortimentiNazivi.length; i++) {
                    const colClass = getColumnGroup(sortimentiNazivi[i]);
                    html += '<th class="sortiment-col ' + colClass + '">' + sortimentiNazivi[i] + '</th>';
                }

                html += '<th style="min-width: 130px;">Poslano</th>';
                html += '<th style="min-width: 80px;"></th>'; // Actions column
                html += '</tr></thead><tbody>';

                // Render rows
                for (let i = 0; i < data.length; i++) {
                    const unos = data[i];
                    const tipColor = unos.tip === 'SJEČA' ? '#059669' : '#2563eb';

                    html += '<tr>';
                    html += '<td><span style="font-weight: 600; color: ' + tipColor + '">' + unos.tip + '</span></td>';
                    html += '<td>' + unos.datum + '</td>';
                    html += '<td style="font-weight: 600;">' + unos.odjel + '</td>';
                    html += '<td>' + unos.radnik + '</td>';
                    html += '<td>' + (unos.kupac || '-') + '</td>';
                    html += '<td>' + (unos.brojOtpremnice || '-') + '</td>';

                    // Sortimenti values with grouping
                    for (let j = 0; j < sortimentiNazivi.length; j++) {
                        const sortiment = sortimentiNazivi[j];
                        // Use calculated ukupno for SVEUKUPNO instead of saved value
                        const val = sortiment === 'SVEUKUPNO' ? unos.ukupno : (unos.sortimenti[sortiment] || 0);
                        const displayVal = val > 0 ? val.toFixed(2) : '-';
                        const colClass = getColumnGroup(sortiment);
                        html += '<td class="sortiment-col right ' + colClass + '">' + displayVal + '</td>';
                    }

                    html += '<td style="font-size: 11px; color: #6b7280;">' + unos.timestamp + '</td>';

                    // Row actions dropdown
                    html += '<td>';
                    html += '<div class="row-actions">';
                    html += '<button class="row-actions-btn" onclick="toggleRowActions(' + unos.id + ')">⋮</button>';
                    html += '<div class="row-actions-dropdown" id="row-actions-' + unos.id + '">';
                    html += '<div class="row-actions-item" onclick="editPendingUnos(' + unos.id + ', \'' + unos.tip + '\')">✏️ Uredi</div>';
                    html += '<div class="row-actions-item danger" onclick="deletePendingUnos(' + unos.id + ', \'' + unos.tip + '\')">🗑️ Obriši</div>';
                    html += '</div>';
                    html += '</div>';
                    html += '</td>';

                    html += '</tr>';
                }

                html += '</tbody></table></div>';

                // Add summary
                html += '<div style="margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 8px;">';
                html += '<strong>Ukupno dodanih unosa:</strong> ' + data.length;

                let sjecaCount = 0;
                let otpremaCount = 0;
                for (let i = 0; i < data.length; i++) {
                    if (data[i].tip === 'SJEČA') sjecaCount++;
                    else if (data[i].tip === 'OTPREMA') otpremaCount++;
                }

                html += ' (Sječa: ' + sjecaCount + ', Otprema: ' + otpremaCount + ')';
                html += '</div>';
            }

            document.getElementById('pending-unosi-container').innerHTML = html;
        }

        async function loadPendingUnosi() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('pending-unosi-content').classList.add('hidden');

            try {
                const year = new Date().getFullYear();
                const url = API_URL + '?path=pending-unosi&year=' + year + '&username=' + currentUser.username + '&password=' + currentPassword;

                // Don't cache pending entries - always fetch fresh
                const response = await fetch(url);
                const data = await response.json();

                console.log('Dodani unosi data:', data);

                if (data.error) {
                    throw new Error(data.error);
                }

                // Store unfiltered data for filtering
                unfilteredPendingData = data.unosi || [];

                // Update badge count
                updatePendingBadge(unfilteredPendingData.length);

                // Render table
                renderPendingTable(unfilteredPendingData);

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('pending-unosi-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading dodani unosi:', error);
                document.getElementById('pending-unosi-container').innerHTML =
                    '<p style="color: #dc2626; text-align: center; padding: 40px;">Greška: ' + error.message + '</p>';
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('pending-unosi-content').classList.remove('hidden');
            }
        }

        // Load monthly sortimenti
        async function loadMjesecniSortimenti() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('mjesecni-sortimenti-content').classList.add('hidden');

            try {
                const year = new Date().getFullYear();
                const url = API_URL + '?path=mjesecni-sortimenti&year=' + year + '&username=' + currentUser.username + '&password=' + currentPassword;

                console.log('Fetching mjesečni sortimenti for year:', year);
                const data = await fetchWithCache(url, `cache_mjesecni_sortimenti_${year}`);

                console.log('Mjesečni sortimenti response:', data);

                if (data.error) {
                    throw new Error(data.error);
                }

                if (!data.sjeca || !data.otprema) {
                    throw new Error('Invalid data format received from server');
                }

                console.log('Rendering SJEČA table...');
                // Render SJEČA table
                renderMjesecnaTabela(data.sjeca, 'mjesecna-sjeca');

                console.log('Rendering OTPREMA table...');
                // Render OTPREMA table
                renderMjesecnaTabela(data.otprema, 'mjesecna-otprema');

                console.log('Tables rendered successfully');
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('mjesecni-sortimenti-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading mjesečni sortimenti:', error);
                showError('Greška', 'Greška pri učitavanju mjesečnih podataka: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('mjesecni-sortimenti-content').classList.remove('hidden');
            }
        }

        // Render monthly table (SJEČA or OTPREMA)
        function renderMjesecnaTabela(data, tableId) {
            console.log('renderMjesecnaTabela called with tableId:', tableId, 'data:', data);

            const headerElem = document.getElementById(tableId + '-header');
            const bodyElem = document.getElementById(tableId + '-body');

            if (!headerElem || !bodyElem) {
                console.error('Table elements not found for tableId:', tableId);
                return;
            }

            if (!data || !data.sortimenti || data.sortimenti.length === 0) {
                console.log('No data available for table:', tableId);
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka</td></tr>';
                return;
            }

            if (!data.mjeseci || !Array.isArray(data.mjeseci) || data.mjeseci.length !== 12) {
                console.error('Invalid mjeseci data for table:', tableId, data.mjeseci);
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #dc2626;">Greška u formatu podataka</td></tr>';
                return;
            }

            const sortimenti = data.sortimenti.filter(s => s && s.trim() !== ''); // Filter out empty sortiment names
            const mjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

            console.log('Original sortimenti:', data.sortimenti);
            console.log('Filtered sortimenti:', sortimenti);
            console.log('Rendering table with', sortimenti.length, 'sortimenti and', data.mjeseci.length, 'months');

            // Build header with optimized styling
            let headerHtml = '<tr>';
            headerHtml += '<th style="min-width: 80px; max-width: 90px; position: sticky; left: 0; background: #1e40af !important; color: white; z-index: 20; font-size: 12px; font-weight: 700; padding: 12px 8px; text-align: center; border-right: 3px solid #1e3a8a;">MJESEC</th>';

            for (let i = 0; i < sortimenti.length; i++) {
                const colClass = getColumnGroup(sortimenti[i]);
                let extraClass = '';
                let bgColor = '#3b82f6'; // Default blue
                let borderColor = '#2563eb';

                if (sortimenti[i] === 'ČETINARI') {
                    extraClass = ' col-cetinari';
                    bgColor = '#059669'; // Green for četinari aggregate
                    borderColor = '#047857';
                } else if (sortimenti[i] === 'LIŠĆARI') {
                    extraClass = ' col-liscari';
                    bgColor = '#d97706'; // Orange for lišćari aggregate
                    borderColor = '#b45309';
                } else if (sortimenti[i] === 'SVEUKUPNO') {
                    extraClass = ' col-sveukupno';
                    bgColor = '#dc2626'; // Red for total
                    borderColor = '#b91c1c';
                }

                headerHtml += '<th class="sortiment-col ' + colClass + extraClass + '" style="background: ' + bgColor + ' !important; color: white !important; border: 1px solid ' + borderColor + '; min-width: 85px; max-width: 110px; padding: 12px 8px; font-size: 12px; font-weight: 700; text-align: center; white-space: normal !important; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.3; height: auto; overflow: visible; vertical-align: middle;">' + sortimenti[i] + '</th>';
            }
            headerHtml += '</tr>';
            headerElem.innerHTML = headerHtml;

            // Build body - 12 months + UKUPNO + %UDIO
            let bodyHtml = '';
            const totals = {}; // Total per sortiment

            // Month rows with improved styling
            for (let m = 0; m < 12; m++) {
                const rowBg = m % 2 === 0 ? '#f9fafb' : 'white';
                const rowHoverBg = m % 2 === 0 ? '#f3f4f6' : '#f9fafb';
                bodyHtml += '<tr style="background: ' + rowBg + ';" onmouseover="this.style.background=\'' + rowHoverBg + '\'" onmouseout="this.style.background=\'' + rowBg + '\'">';
                bodyHtml += '<td style="font-weight: 700; font-size: 13px; min-width: 80px; max-width: 90px; position: sticky; left: 0; background: ' + rowBg + '; z-index: 9; border-right: 3px solid #1e40af; text-align: center; padding: 10px 8px;">' + mjeseci[m] + '</td>';

                for (let s = 0; s < sortimenti.length; s++) {
                    const sortiment = sortimenti[s];
                    const value = data.mjeseci[m][sortiment] || 0;
                    const displayVal = value > 0 ? value.toFixed(2) : '-';
                    const colClass = getColumnGroup(sortiment);
                    let extraClass = '';
                    let fontWeight = value > 0 ? 'font-weight: 600;' : 'font-weight: 400; color: #9ca3af;';
                    let cellBg = 'transparent';

                    if (sortiment === 'ČETINARI') {
                        extraClass = ' col-cetinari';
                        cellBg = value > 0 ? '#d1fae5' : 'transparent';
                    } else if (sortiment === 'LIŠĆARI') {
                        extraClass = ' col-liscari';
                        cellBg = value > 0 ? '#fed7aa' : 'transparent';
                    } else if (sortiment === 'SVEUKUPNO') {
                        extraClass = ' col-sveukupno';
                        fontWeight = value > 0 ? 'font-weight: 700;' : 'font-weight: 400; color: #9ca3af;';
                        cellBg = value > 0 ? '#fecaca' : 'transparent';
                    }

                    bodyHtml += '<td class="sortiment-col right ' + colClass + extraClass + '" style="' + fontWeight + ' padding: 8px 10px; font-size: 12px; min-width: 85px; max-width: 110px; text-align: right; border: 1px solid #e5e7eb; background: ' + cellBg + ';">' + displayVal + '</td>';

                    // Add to totals
                    if (!totals[sortiment]) totals[sortiment] = 0;
                    totals[sortiment] += value;
                }

                bodyHtml += '</tr>';
            }

            // UKUPNO row with improved styling
            bodyHtml += '<tr style="background: linear-gradient(to bottom, #e5e7eb, #d1d5db); font-weight: 700; border-top: 3px solid #374151; border-bottom: 2px solid #374151;">';
            bodyHtml += '<td style="min-width: 80px; max-width: 90px; position: sticky; left: 0; background: #e5e7eb; z-index: 9; border-right: 3px solid #1e40af; text-align: center; font-size: 13px; padding: 12px 8px; color: #1f2937;">📊 UKUPNO</td>';
            for (let s = 0; s < sortimenti.length; s++) {
                const sortiment = sortimenti[s];
                const total = totals[sortiment] || 0;
                const colClass = getColumnGroup(sortiment);
                let extraClass = '';
                let cellBg = '#e5e7eb';

                if (sortiment === 'ČETINARI') {
                    extraClass = ' col-cetinari';
                    cellBg = '#d1fae5';
                } else if (sortiment === 'LIŠĆARI') {
                    extraClass = ' col-liscari';
                    cellBg = '#fed7aa';
                } else if (sortiment === 'SVEUKUPNO') {
                    extraClass = ' col-sveukupno';
                    cellBg = '#fecaca';
                }

                bodyHtml += '<td class="sortiment-col right ' + colClass + extraClass + '" style="font-weight: 800; font-size: 13px; padding: 12px 10px; background: ' + cellBg + '; min-width: 85px; max-width: 110px; text-align: right; border: 1px solid #9ca3af;">' + total.toFixed(2) + '</td>';
            }
            bodyHtml += '</tr>';

            // Calculate grand total from SVEUKUPNO
            const grandTotal = totals['SVEUKUPNO'] || 0;

            // %UDIO row with improved styling
            bodyHtml += '<tr style="background: #f3f4f6; font-style: italic; color: #374151; border-bottom: 3px solid #374151;">';
            bodyHtml += '<td style="min-width: 80px; max-width: 90px; position: sticky; left: 0; background: #f3f4f6; z-index: 9; border-right: 3px solid #1e40af; text-align: center; font-size: 12px; padding: 10px 8px; font-weight: 600;">% UDIO</td>';
            for (let s = 0; s < sortimenti.length; s++) {
                const sortiment = sortimenti[s];
                const total = totals[sortiment] || 0;
                const percentage = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : '0.0';
                const colClass = getColumnGroup(sortiment);
                let extraClass = '';
                let cellBg = '#f3f4f6';

                if (sortiment === 'ČETINARI') {
                    extraClass = ' col-cetinari';
                    cellBg = '#ecfdf5';
                } else if (sortiment === 'LIŠĆARI') {
                    extraClass = ' col-liscari';
                    cellBg = '#fff7ed';
                } else if (sortiment === 'SVEUKUPNO') {
                    extraClass = ' col-sveukupno';
                    cellBg = '#fef2f2';
                }

                bodyHtml += '<td class="sortiment-col right ' + colClass + extraClass + '" style="font-weight: 700; font-size: 12px; padding: 10px; background: ' + cellBg + '; min-width: 85px; max-width: 110px; text-align: right; border: 1px solid #d1d5db; font-style: italic;">' + percentage + '%</td>';
            }
            bodyHtml += '</tr>';

            bodyElem.innerHTML = bodyHtml;
        }

        // ========================================
        // IZVJEŠTAJI - Mjesečni prikaz po odjelima sa sortimentima
        // ========================================

        async function loadIzvjestaji() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('izvjestaji-content').classList.add('hidden');

            try {
                const year = document.getElementById('izvjestaji-year-select').value;
                const month = document.getElementById('izvjestaji-month-select').value;

                const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

                // Update titles
                document.getElementById('izvjestaji-primka-title').textContent = mjeseciNazivi[month] + ' ' + year;
                document.getElementById('izvjestaji-otprema-title').textContent = mjeseciNazivi[month] + ' ' + year;

                // Load PRIMKA (sječa) data
                const primkaUrl = API_URL + '?path=primaci-daily&year=' + year + '&month=' + month + '&username=' + currentUser.username + '&password=' + currentPassword;
                const primkaData = await fetchWithCache(primkaUrl, `cache_izvjestaji_primka_${year}_${month}`);

                // Load OTPREMA data
                const otpremaUrl = API_URL + '?path=otpremaci-daily&year=' + year + '&month=' + month + '&username=' + currentUser.username + '&password=' + currentPassword;
                const otpremaData = await fetchWithCache(otpremaUrl, `cache_izvjestaji_otprema_${year}_${month}`);

                if (primkaData.error) throw new Error('Primka: ' + primkaData.error);
                if (otpremaData.error) throw new Error('Otprema: ' + otpremaData.error);

                // Aggregate data by odjel
                const primkaByOdjel = aggregateByOdjel(primkaData.data, primkaData.sortimentiNazivi);
                const otpremaByOdjel = aggregateByOdjel(otpremaData.data, otpremaData.sortimentiNazivi);

                // Render tables
                renderIzvjestajiTable(primkaByOdjel, primkaData.sortimentiNazivi, 'primka');
                renderIzvjestajiTable(otpremaByOdjel, otpremaData.sortimentiNazivi, 'otprema');

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('izvjestaji-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading izvjestaji:', error);
                showError('Greška', 'Greška pri učitavanju izvještaja: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('izvjestaji-content').classList.remove('hidden');
            }
        }

        // Aggregate data by odjel (sum sortimenti per odjel)
        function aggregateByOdjel(data, sortimentiNazivi) {
            const odjeliMap = {};

            data.forEach(row => {
                const odjel = row.odjel;
                if (!odjeliMap[odjel]) {
                    odjeliMap[odjel] = {};
                    sortimentiNazivi.forEach(s => odjeliMap[odjel][s] = 0);
                }

                sortimentiNazivi.forEach(sortiment => {
                    const value = parseFloat(row.sortimenti[sortiment]) || 0;
                    odjeliMap[odjel][sortiment] += value;
                });
            });

            // Convert to array
            const result = [];
            for (const odjel in odjeliMap) {
                result.push({
                    odjel: odjel,
                    sortimenti: odjeliMap[odjel]
                });
            }

            // Sort by odjel name
            result.sort((a, b) => a.odjel.localeCompare(b.odjel));

            return result;
        }

        // Render izvjestaji table (primka or otprema)
        function renderIzvjestajiTable(data, sortimentiNazivi, tip) {
            const headerElem = document.getElementById('izvjestaji-' + tip + '-header');
            const bodyElem = document.getElementById('izvjestaji-' + tip + '-body');

            if (data.length === 0) {
                headerElem.innerHTML = '';
                bodyElem.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za odabrani mjesec</td></tr>';
                return;
            }

            // Build header
            let headerHtml = '<tr><th style="position: sticky; left: 0; background: #f9fafb; z-index: 20; min-width: 200px;">Odjel</th>';
            sortimentiNazivi.forEach(sortiment => {
                const colClass = getColumnGroup(sortiment);
                let extraClass = '';
                if (sortiment === 'ČETINARI') extraClass = ' col-cetinari';
                else if (sortiment === 'LIŠĆARI') extraClass = ' col-liscari';
                else if (sortiment === 'SVEUKUPNO') extraClass = ' col-sveukupno';

                headerHtml += '<th class="sortiment-col right ' + colClass + extraClass + '">' + sortiment + '</th>';
            });
            headerHtml += '</tr>';
            headerElem.innerHTML = headerHtml;

            // Build body
            let bodyHtml = '';
            const totals = {};
            sortimentiNazivi.forEach(s => totals[s] = 0);

            data.forEach((row, index) => {
                const rowStyle = index % 2 === 0 ? 'background: #f9fafb;' : '';
                bodyHtml += '<tr style="' + rowStyle + '">';
                bodyHtml += '<td style="font-weight: 600; position: sticky; left: 0; background: ' + (index % 2 === 0 ? '#f9fafb' : 'white') + '; z-index: 9;">' + row.odjel + '</td>';

                sortimentiNazivi.forEach(sortiment => {
                    const value = row.sortimenti[sortiment] || 0;
                    totals[sortiment] += value;

                    const colClass = getColumnGroup(sortiment);
                    let extraClass = '';
                    if (sortiment === 'ČETINARI') extraClass = ' col-cetinari';
                    else if (sortiment === 'LIŠĆARI') extraClass = ' col-liscari';
                    else if (sortiment === 'SVEUKUPNO') extraClass = ' col-sveukupno';

                    const displayValue = value === 0 ? '' : value.toFixed(2);
                    bodyHtml += '<td class="sortiment-col right ' + colClass + extraClass + '">' + displayValue + '</td>';
                });

                bodyHtml += '</tr>';
            });

            // Add UKUPNO row
            bodyHtml += '<tr style="background: #f9fafb; border-top: 3px solid #1f2937; font-weight: 700;">';
            bodyHtml += '<td style="position: sticky; left: 0; background: #f9fafb; z-index: 9; font-size: 15px; padding: 14px;">📊 UKUPNO</td>';

            sortimentiNazivi.forEach(sortiment => {
                const colClass = getColumnGroup(sortiment);
                let extraClass = '';
                if (sortiment === 'ČETINARI') extraClass = ' col-cetinari';
                else if (sortiment === 'LIŠĆARI') extraClass = ' col-liscari';
                else if (sortiment === 'SVEUKUPNO') extraClass = ' col-sveukupno';

                bodyHtml += '<td class="sortiment-col right ' + colClass + extraClass + '" style="font-weight: 700;">' + totals[sortiment].toFixed(2) + '</td>';
            });

            bodyHtml += '</tr>';

            bodyElem.innerHTML = bodyHtml;
        }

        // Filter funkcija za Primka tabelu
        function filterIzvjestajiPrimkaTable() {
            const input = document.getElementById('izvjestaji-primka-search');
            const filter = input.value.toLowerCase();
            const table = document.getElementById('izvjestaji-primka-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length - 1; i++) { // Skip header (0) and total row (last)
                const td = tr[i].getElementsByTagName('td')[0]; // First column (Odjel)
                if (td) {
                    const txtValue = td.textContent || td.innerText;
                    if (txtValue.toLowerCase().indexOf(filter) > -1) {
                        tr[i].style.display = '';
                    } else {
                        tr[i].style.display = 'none';
                    }
                }
            }
        }

        // Filter funkcija za Otprema tabelu
        function filterIzvjestajiOtpremaTable() {
            const input = document.getElementById('izvjestaji-otprema-search');
            const filter = input.value.toLowerCase();
            const table = document.getElementById('izvjestaji-otprema-table');
            const tr = table.getElementsByTagName('tr');

            for (let i = 1; i < tr.length - 1; i++) { // Skip header (0) and total row (last)
                const td = tr[i].getElementsByTagName('td')[0]; // First column (Odjel)
                if (td) {
                    const txtValue = td.textContent || td.innerText;
                    if (txtValue.toLowerCase().indexOf(filter) > -1) {
                        tr[i].style.display = '';
                    } else {
                        tr[i].style.display = 'none';
                    }
                }
            }
        }

        // ========================================
        // IZVJEŠTAJI - Sub-tab switching
        // ========================================

        function switchIzvjestajiSubTab(subTab) {
            // Remove active class from all sub-tabs
            const subTabs = document.querySelectorAll('.sub-tab');
            subTabs.forEach(tab => tab.classList.remove('active'));

            // Hide all sub-contents
            document.getElementById('mjesecni-izvjestaj').classList.add('hidden');
            document.getElementById('sedmicni-sjeca-izvjestaj').classList.add('hidden');
            document.getElementById('sedmicni-otprema-izvjestaj').classList.add('hidden');
            document.getElementById('stanje-odjela-izvjestaj').classList.add('hidden');

            // Show selected sub-content and activate tab
            if (subTab === 'mjesecni') {
                document.querySelector('.sub-tab[onclick*="mjesecni"]').classList.add('active');
                document.getElementById('mjesecni-izvjestaj').classList.remove('hidden');
                loadIzvjestaji();
            } else if (subTab === 'sedmicni-sjeca') {
                document.querySelector('.sub-tab[onclick*="sedmicni-sjeca"]').classList.add('active');
                document.getElementById('sedmicni-sjeca-izvjestaj').classList.remove('hidden');
                loadSedmicniIzvjestajSjeca();
            } else if (subTab === 'sedmicni-otprema') {
                document.querySelector('.sub-tab[onclick*="sedmicni-otprema"]').classList.add('active');
                document.getElementById('sedmicni-otprema-izvjestaj').classList.remove('hidden');
                loadSedmicniIzvjestajOtprema();
            } else if (subTab === 'stanje-odjela') {
                document.querySelector('.sub-tab[onclick*="stanje-odjela"]').classList.add('active');
                document.getElementById('stanje-odjela-izvjestaj').classList.remove('hidden');
                loadStanjeOdjela();
            }
        }

        // ========================================
        // SEDMIČNI IZVJEŠTAJI - Functions
        // ========================================

        async function loadSedmicniIzvjestajSjeca() {
            document.getElementById('loading-screen').classList.remove('hidden');

            try {
                const year = document.getElementById('sedmicni-sjeca-year-select').value;
                const month = document.getElementById('sedmicni-sjeca-month-select').value;

                // Load PRIMKA (sječa) data
                const primkaUrl = API_URL + '?path=primaci-daily&year=' + year + '&month=' + month + '&username=' + currentUser.username + '&password=' + currentPassword;
                const primkaData = await fetchWithCache(primkaUrl, `cache_sedmicni_sjeca_${year}_${month}`);

                if (primkaData.error) throw new Error('Primka: ' + primkaData.error);

                // Group by weeks (within month boundaries)
                const weeklyData = groupDataByWeeks(primkaData.data, year, month, primkaData.sortimentiNazivi);

                // Render
                renderSedmicniIzvjestaj(weeklyData, primkaData.sortimentiNazivi, 'sedmicni-sjeca-container', year, month);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading sedmični izvještaj sječe:', error);
                showError('Greška', 'Greška pri učitavanju sedmičnog izvještaja: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        async function loadSedmicniIzvjestajOtprema() {
            document.getElementById('loading-screen').classList.remove('hidden');

            try {
                const year = document.getElementById('sedmicni-otprema-year-select').value;
                const month = document.getElementById('sedmicni-otprema-month-select').value;

                // Load OTPREMA data
                const otpremaUrl = API_URL + '?path=otpremaci-daily&year=' + year + '&month=' + month + '&username=' + currentUser.username + '&password=' + currentPassword;
                const otpremaData = await fetchWithCache(otpremaUrl, `cache_sedmicni_otprema_${year}_${month}`);

                if (otpremaData.error) throw new Error('Otprema: ' + otpremaData.error);

                // Group by weeks (within month boundaries)
                const weeklyData = groupDataByWeeks(otpremaData.data, year, month, otpremaData.sortimentiNazivi);

                // Render
                renderSedmicniIzvjestaj(weeklyData, otpremaData.sortimentiNazivi, 'sedmicni-otprema-container', year, month);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading sedmični izvještaj otpreme:', error);
                showError('Greška', 'Greška pri učitavanju sedmičnog izvještaja: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        // Group data by weeks (sedmice se ne prelaze preko granica mjeseca)
        function groupDataByWeeks(data, year, month, sortimentiNazivi) {
            const weeks = [];
            const weeksMap = new Map();

            // Parse year and month
            const y = parseInt(year);
            const m = parseInt(month);

            data.forEach(row => {
                // Parse datum (expecting DD/MM/YYYY format)
                const datumStr = row.datum;
                const dateParts = datumStr.split(/[\/\.\-]/);
                const day = parseInt(dateParts[0]);
                const recordMonth = parseInt(dateParts[1]) - 1;
                const recordYear = parseInt(dateParts[2]);

                // Skip if not in selected month
                if (recordYear !== y || recordMonth !== m) return;

                const datum = new Date(recordYear, recordMonth, day);

                // Get week number within the month
                const weekInfo = getWeekWithinMonth(datum, y, m);
                const weekKey = weekInfo.weekNumber;

                if (!weeksMap.has(weekKey)) {
                    weeksMap.set(weekKey, {
                        weekNumber: weekKey,
                        weekStart: weekInfo.weekStart,
                        weekEnd: weekInfo.weekEnd,
                        odjeliMap: {}
                    });
                }

                const week = weeksMap.get(weekKey);
                const odjel = row.odjel;

                if (!week.odjeliMap[odjel]) {
                    week.odjeliMap[odjel] = {};
                    sortimentiNazivi.forEach(s => week.odjeliMap[odjel][s] = 0);
                }

                sortimentiNazivi.forEach(sortiment => {
                    const value = parseFloat(row.sortimenti[sortiment]) || 0;
                    week.odjeliMap[odjel][sortiment] += value;
                });
            });

            // Convert Map to Array and sort by week number
            weeksMap.forEach(week => weeks.push(week));
            weeks.sort((a, b) => a.weekNumber - b.weekNumber);

            return weeks;
        }

        // Get week number within month (sedmica počinje u ponedjeljak)
        function getWeekWithinMonth(date, year, month) {
            // Clone date to avoid mutation
            const d = new Date(date.getTime());

            // Get first day of month
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            // Find first Monday of the month (or first day if it's not Monday)
            let weekStart = new Date(firstDay);
            const firstDayOfWeek = firstDay.getDay(); // 0=Sunday, 1=Monday, ...

            // If first day is not Monday, find next Monday (or use first day if it's after Monday)
            if (firstDayOfWeek === 0) { // Sunday
                weekStart.setDate(firstDay.getDate() + 1); // Move to Monday
            } else if (firstDayOfWeek > 1) { // Tuesday-Saturday
                weekStart.setDate(firstDay.getDate() + (8 - firstDayOfWeek)); // Move to next Monday
            }
            // If firstDayOfWeek === 1 (Monday), weekStart is already correct

            // Calculate week number
            let weekNumber = 1;
            let currentWeekStart = new Date(firstDay);

            while (currentWeekStart <= d) {
                let currentWeekEnd = new Date(currentWeekStart);
                currentWeekEnd.setDate(currentWeekEnd.getDate() + 6); // Sunday

                // Ensure week doesn't go beyond month
                if (currentWeekEnd > lastDay) {
                    currentWeekEnd = new Date(lastDay);
                }

                // Check if date falls in this week
                if (d >= currentWeekStart && d <= currentWeekEnd) {
                    return {
                        weekNumber: weekNumber,
                        weekStart: formatDateDDMMYYYY(currentWeekStart),
                        weekEnd: formatDateDDMMYYYY(currentWeekEnd)
                    };
                }

                // Move to next week (always Monday)
                currentWeekStart.setDate(currentWeekStart.getDate() + 7);

                // If next week is in next month, stop
                if (currentWeekStart.getMonth() !== month) {
                    break;
                }

                weekNumber++;
            }

            // Fallback: return week 1
            return {
                weekNumber: 1,
                weekStart: formatDateDDMMYYYY(firstDay),
                weekEnd: formatDateDDMMYYYY(lastDay)
            };
        }

        // Format date as DD/MM/YYYY
        function formatDateDDMMYYYY(date) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return day + '/' + month + '/' + year;
        }

        // Render sedmični izvještaj (multiple tables, one per week)
        function renderSedmicniIzvjestaj(weeks, sortimentiNazivi, containerId, year, month) {
            const container = document.getElementById(containerId);
            const mjeseciNazivi = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

            if (weeks.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka za odabrani mjesec</div>';
                return;
            }

            let html = '';

            // Show all weeks in the month, sorted from newest to oldest (reverse chronological)
            const visibleWeeks = weeks.slice().reverse();

            visibleWeeks.forEach(week => {
                // Convert odjeliMap to array
                const odjeliArray = [];
                for (const odjel in week.odjeliMap) {
                    odjeliArray.push({
                        odjel: odjel,
                        sortimenti: week.odjeliMap[odjel]
                    });
                }
                odjeliArray.sort((a, b) => a.odjel.localeCompare(b.odjel));

                html += '<div class="section" style="margin-bottom: 40px;">';
                html += '<h3 style="margin-bottom: 16px; color: #047857;">📅 Sedmica ' + week.weekNumber + ': ' + week.weekStart + ' - ' + week.weekEnd + '</h3>';

                if (odjeliArray.length === 0) {
                    html += '<p style="color: #6b7280; padding: 20px;">Nema podataka za ovu sedmicu</p>';
                } else {
                    html += '<div style="overflow-x: auto;"><table class="table">';

                    // Header
                    html += '<thead><tr><th style="position: sticky; left: 0; background: #f9fafb; z-index: 20; min-width: 200px;">Odjel</th>';
                    sortimentiNazivi.forEach(sortiment => {
                        const colClass = getColumnGroup(sortiment);
                        let extraClass = '';
                        if (sortiment === 'ČETINARI') extraClass = ' col-cetinari';
                        else if (sortiment === 'LIŠĆARI') extraClass = ' col-liscari';
                        else if (sortiment === 'SVEUKUPNO') extraClass = ' col-sveukupno';

                        html += '<th class="sortiment-col right ' + colClass + extraClass + '">' + sortiment + '</th>';
                    });
                    html += '</tr></thead>';

                    // Body
                    html += '<tbody>';
                    const totals = {};
                    sortimentiNazivi.forEach(s => totals[s] = 0);

                    odjeliArray.forEach((row, index) => {
                        const rowStyle = index % 2 === 0 ? 'background: #f9fafb;' : '';
                        html += '<tr style="' + rowStyle + '">';
                        html += '<td style="font-weight: 600; position: sticky; left: 0; background: ' + (index % 2 === 0 ? '#f9fafb' : 'white') + '; z-index: 9;">' + row.odjel + '</td>';

                        sortimentiNazivi.forEach(sortiment => {
                            const value = row.sortimenti[sortiment] || 0;
                            totals[sortiment] += value;

                            const colClass = getColumnGroup(sortiment);
                            let extraClass = '';
                            if (sortiment === 'ČETINARI') extraClass = ' col-cetinari';
                            else if (sortiment === 'LIŠĆARI') extraClass = ' col-liscari';
                            else if (sortiment === 'SVEUKUPNO') extraClass = ' col-sveukupno';

                            const displayValue = value === 0 ? '' : value.toFixed(2);
                            html += '<td class="sortiment-col right ' + colClass + extraClass + '">' + displayValue + '</td>';
                        });

                        html += '</tr>';
                    });

                    // UKUPNO row
                    html += '<tr style="background: #f9fafb; border-top: 3px solid #1f2937; font-weight: 700;">';
                    html += '<td style="position: sticky; left: 0; background: #f9fafb; z-index: 9; font-size: 15px; padding: 14px;">📊 UKUPNO</td>';

                    sortimentiNazivi.forEach(sortiment => {
                        const colClass = getColumnGroup(sortiment);
                        let extraClass = '';
                        if (sortiment === 'ČETINARI') extraClass = ' col-cetinari';
                        else if (sortiment === 'LIŠĆARI') extraClass = ' col-liscari';
                        else if (sortiment === 'SVEUKUPNO') extraClass = ' col-sveukupno';

                        html += '<td class="sortiment-col right ' + colClass + extraClass + '" style="font-weight: 700;">' + totals[sortiment].toFixed(2) + '</td>';
                    });

                    html += '</tr>';
                    html += '</tbody></table></div>';
                }

                html += '</div>';
            });

            container.innerHTML = html;
        }

        // ========================================
        // STANJE ODJELA - Trenutno stanje iz fajla ODJELI
        // ========================================

        // Globalne varijable za stanje odjela
        let stanjeOdjelaData = [];
        let stanjeOdjelaSortimenti = [];

        async function loadStanjeOdjela() {
            document.getElementById('loading-screen').classList.remove('hidden');

            try {
                // Load data from backend
                const url = API_URL + '?path=stanje-odjela&username=' + currentUser.username + '&password=' + currentPassword;
                const data = await fetchWithCache(url, `cache_stanje_odjela`);

                if (data.error) throw new Error(data.error);

                // Sačuvaj podatke globalno
                stanjeOdjelaData = data.data;
                stanjeOdjelaSortimenti = data.sortimentiNazivi;

                // Populiši dropdown sa radilištima
                populateStanjeOdjelaDropdown(data.data);

                // Render sections
                renderStanjeOdjelaSections(data.data, data.sortimentiNazivi);

                document.getElementById('loading-screen').classList.add('hidden');

            } catch (error) {
                console.error('Error loading stanje odjela:', error);
                showError('Greška', 'Greška pri učitavanju stanja odjela: ' + error.message);
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }

        function populateStanjeOdjelaDropdown(data) {
            const select = document.getElementById('stanje-odjela-select');

            // Očisti postojeće opcije osim "Sva radilišta"
            select.innerHTML = '<option value="">Sva radilišta</option>';

            // Izvuci unique radilišta
            const radilistaSet = new Set();
            data.forEach(odjel => {
                if (odjel.radiliste) {
                    radilistaSet.add(odjel.radiliste);
                }
            });

            // Sortiraj i dodaj u dropdown
            const radilista = Array.from(radilistaSet).sort();
            radilista.forEach(radiliste => {
                const option = document.createElement('option');
                option.value = radiliste;
                option.textContent = radiliste;
                select.appendChild(option);
            });
        }

        function filterStanjeOdjela() {
            const selectedRadiliste = document.getElementById('stanje-odjela-select').value;

            if (selectedRadiliste === '') {
                // Prikaži sve
                renderStanjeOdjelaSections(stanjeOdjelaData, stanjeOdjelaSortimenti);
            } else {
                // Filtriraj samo izabrano radilište
                const filteredData = stanjeOdjelaData.filter(odjel => odjel.radiliste === selectedRadiliste);
                renderStanjeOdjelaSections(filteredData, stanjeOdjelaSortimenti);
            }
        }

        function renderStanjeOdjelaSections(data, sortimentiNazivi) {
            const container = document.getElementById('stanje-odjela-container');

            if (data.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">Nema podataka</div>';
                return;
            }

            let html = '';

            // Za svaki odjel kreiraj zasebnu sekciju
            data.forEach((odjelData, odjelIndex) => {
                const radiliste = odjelData.radiliste || odjelData.odjelNaziv;
                const odjelNaziv = odjelData.odjelNaziv;
                const redovi = odjelData.redovi;

                // Sekcija za svaki odjel
                html += '<div class="section" style="margin-bottom: 40px; border: 2px solid #d1d5db; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">';

                // Header radilišta
                html += '<div style="background: linear-gradient(135deg, #047857 0%, #059669 100%); padding: 16px 24px; border-bottom: 3px solid #10b981;">';
                html += '<h3 style="margin: 0; color: white; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 12px;">';
                html += '<span style="font-size: 24px;">🏭</span>';
                html += '<div>';
                html += '<div>' + radiliste + '</div>';
                html += '<div style="font-size: 12px; font-weight: 400; opacity: 0.9; margin-top: 4px;">(' + odjelNaziv + ')</div>';
                html += '</div>';
                html += '</h3>';
                html += '</div>';

                // Tabela sa sortimentnim zaglavljem
                html += '<div style="overflow-x: auto;">';
                html += '<table style="width: 100%; border-collapse: collapse; background: white;">';

                // Sortimentno zaglavlje
                html += '<thead>';
                html += '<tr style="background: #f0fdf4; border-bottom: 2px solid #10b981;">';
                html += '<th style="padding: 14px 16px; text-align: left; font-weight: 700; color: #047857; border-right: 1px solid #d1d5db; min-width: 180px; position: sticky; left: 0; background: #f0fdf4; z-index: 10;">Vrsta</th>';

                sortimentiNazivi.forEach((sortiment, index) => {
                    const colClass = getColumnGroup(sortiment);
                    let bgColor = '#f0fdf4';
                    let textColor = '#047857';

                    if (sortiment === 'ČETINARI') {
                        bgColor = '#dbeafe';
                        textColor = '#1e40af';
                    } else if (sortiment === 'LIŠĆARI') {
                        bgColor = '#fef3c7';
                        textColor = '#92400e';
                    } else if (sortiment === 'SVEUKUPNO') {
                        bgColor = '#ede9fe';
                        textColor = '#5b21b6';
                    }

                    const borderRight = index < sortimentiNazivi.length - 1 ? 'border-right: 1px solid #d1d5db;' : '';
                    html += '<th style="padding: 14px 12px; text-align: right; font-weight: 700; font-size: 13px; color: ' + textColor + '; background: ' + bgColor + '; ' + borderRight + ' white-space: nowrap;">' + sortiment + '</th>';
                });

                html += '</tr>';
                html += '</thead>';

                // Body sa 4 reda
                html += '<tbody>';

                const vrste = [
                    { naziv: 'PROJEKAT', data: redovi.projekat, icon: '📋', bg: '#fef3c7', color: '#92400e', borderColor: '#fbbf24' },
                    { naziv: 'SJEČA', data: redovi.sjeca, icon: '🌲', bg: '#d1fae5', color: '#065f46', borderColor: '#10b981' },
                    { naziv: 'OTPREMA', data: redovi.otprema, icon: '🚛', bg: '#dbeafe', color: '#1e40af', borderColor: '#3b82f6' },
                    { naziv: 'ŠUMA-LAGER', data: redovi.sumaLager, icon: '📦', bg: '#e9d5ff', color: '#6b21a8', borderColor: '#a855f7' }
                ];

                vrste.forEach((vrsta, vrstaIndex) => {
                    const borderBottom = vrstaIndex < vrste.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : '';

                    html += '<tr style="' + borderBottom + '">';
                    html += '<td style="padding: 12px 16px; font-weight: 700; color: ' + vrsta.color + '; background: ' + vrsta.bg + '; border-right: 3px solid ' + vrsta.borderColor + '; position: sticky; left: 0; z-index: 5;">';
                    html += '<span style="display: inline-flex; align-items: center; gap: 8px;">';
                    html += '<span style="font-size: 20px;">' + vrsta.icon + '</span>';
                    html += '<span>' + vrsta.naziv + '</span>';
                    html += '</span>';
                    html += '</td>';

                    vrsta.data.forEach((value, index) => {
                        const sortiment = sortimentiNazivi[index];
                        let bgColor = 'white';

                        if (sortiment === 'ČETINARI') bgColor = '#eff6ff';
                        else if (sortiment === 'LIŠĆARI') bgColor = '#fffbeb';
                        else if (sortiment === 'SVEUKUPNO') bgColor = '#faf5ff';

                        const borderRight = index < sortimentiNazivi.length - 1 ? 'border-right: 1px solid #e5e7eb;' : '';
                        const displayValue = value === 0 ? '-' : value.toFixed(2);
                        const fontWeight = sortiment === 'SVEUKUPNO' ? 'font-weight: 700;' : '';

                        html += '<td style="padding: 12px; text-align: right; background: ' + bgColor + '; ' + borderRight + ' ' + fontWeight + ' color: #374151;">' + displayValue + '</td>';
                    });

                    html += '</tr>';
                });

                html += '</tbody>';
                html += '</table>';
                html += '</div>';
                html += '</div>';
            });

            container.innerHTML = html;
        }

        // Load pending count (for badge only)
        async function loadPendingCount() {
            try {
                const year = new Date().getFullYear();
                const url = API_URL + '?path=pending-unosi&year=' + year + '&username=' + currentUser.username + '&password=' + currentPassword;
                const response = await fetch(url);
                const data = await response.json();

                if (data.success && data.unosi) {
                    updatePendingBadge(data.unosi.length);
                }
            } catch (error) {
                console.error('Error loading pending count:', error);
            }
        }

        // Update pending badge count
        function updatePendingBadge(count) {
            const badge = document.getElementById('pending-count-badge');
            if (badge) {
                if (count > 0) {
                    badge.textContent = count;
                    badge.classList.add('show');
                } else {
                    badge.classList.remove('show');
                }
            }
        }

        // Edit pending unos (placeholder for future implementation)
        function editPendingUnos(id, tip) {
            showInfo('U razvoju', 'Uređivanje unosa #' + id + ' (Tip: ' + tip + ') - Ova funkcionalnost će biti dodana uskoro.');
            // Close dropdown
            const dropdown = document.getElementById('row-actions-' + id);
            if (dropdown) dropdown.classList.remove('show');
        }

        // Delete pending unos with modal confirmation
        function deletePendingUnos(id, tip) {
            // Close dropdown first
            const dropdown = document.getElementById('row-actions-' + id);
            if (dropdown) dropdown.classList.remove('show');

            // Show confirmation modal
            showConfirmModal(
                'Potvrda brisanja',
                'Da li ste sigurni da želite obrisati ovaj unos? (ID: ' + id + ', Tip: ' + tip + ')',
                async function() {
                    try {
                        const formData = new URLSearchParams();
                        formData.append('path', 'delete-pending');
                        formData.append('rowIndex', id);
                        // Convert tip to lowercase: SJEČA -> sjeca, OTPREMA -> otprema
                        const tipLower = tip === 'SJEČA' ? 'sjeca' : 'otprema';
                        formData.append('tip', tipLower);
                        formData.append('username', currentUser.username);
                        formData.append('password', currentPassword);

                        const url = API_URL + '?' + formData.toString();
                        const response = await fetch(url);
                        const result = await response.json();

                        if (result.success) {
                            showSuccess('Uspjeh', result.message);
                            loadPendingUnosi();
                        } else {
                            throw new Error(result.error || 'Unknown error');
                        }
                    } catch (error) {
                        showError('Greška', error.message);
                    }
                }
            );
        }

        // Calculate Sjeca totals automatically
        function calculateSjeca() {
            // Get all četinar values
            var flC = parseFloat(document.getElementById('sjeca-FL-C').value) || 0;
            var iC = parseFloat(document.getElementById('sjeca-I-C').value) || 0;
            var iiC = parseFloat(document.getElementById('sjeca-II-C').value) || 0;
            var iiiC = parseFloat(document.getElementById('sjeca-III-C').value) || 0;
            var rudno = parseFloat(document.getElementById('sjeca-RUDNO').value) || 0;
            var celDuga = parseFloat(document.getElementById('sjeca-CEL-DUGA').value) || 0;
            var celCijepana = parseFloat(document.getElementById('sjeca-CEL-CIJEPANA').value) || 0;

            // Calculate TRUPCI Č = F/L Č + I Č + II Č + III Č + RUDNO
            var trupciC = flC + iC + iiC + iiiC + rudno;
            document.getElementById('sjeca-TRUPCI-C').value = trupciC.toFixed(2);

            // Calculate ČETINARI = CEL.DUGA + CEL.CIJEPANA + TRUPCI Č
            var cetinari = celDuga + celCijepana + trupciC;
            document.getElementById('sjeca-CETINARI').value = cetinari.toFixed(2);

            // Get all lišćar values
            var flL = parseFloat(document.getElementById('sjeca-FL-L').value) || 0;
            var iL = parseFloat(document.getElementById('sjeca-I-L').value) || 0;
            var iiL = parseFloat(document.getElementById('sjeca-II-L').value) || 0;
            var iiiL = parseFloat(document.getElementById('sjeca-III-L').value) || 0;
            var ogrDugi = parseFloat(document.getElementById('sjeca-OGR-DUGI').value) || 0;
            var ogrCijepani = parseFloat(document.getElementById('sjeca-OGR-CIJEPANI').value) || 0;

            // Calculate TRUPCI L = F/L L + I L + II L + III L
            var trupciL = flL + iL + iiL + iiiL;
            document.getElementById('sjeca-TRUPCI').value = trupciL.toFixed(2);

            // Calculate LIŠĆARI = OGR.DUGI + OGR.CIJEPANI + TRUPCI L
            var liscari = ogrDugi + ogrCijepani + trupciL;
            document.getElementById('sjeca-LISCARI').value = liscari.toFixed(2);

            // Calculate SVEUKUPNO = ČETINARI + LIŠĆARI
            var sveukupno = cetinari + liscari;
            document.getElementById('sjeca-SVEUKUPNO').value = sveukupno.toFixed(2);
        }

        // Calculate Otprema totals automatically
        function calculateOtprema() {
            // Get all četinar values
            var flC = parseFloat(document.getElementById('otprema-FL-C').value) || 0;
            var iC = parseFloat(document.getElementById('otprema-I-C').value) || 0;
            var iiC = parseFloat(document.getElementById('otprema-II-C').value) || 0;
            var iiiC = parseFloat(document.getElementById('otprema-III-C').value) || 0;
            var rudno = parseFloat(document.getElementById('otprema-RUDNO').value) || 0;
            var celDuga = parseFloat(document.getElementById('otprema-CEL-DUGA').value) || 0;
            var celCijepana = parseFloat(document.getElementById('otprema-CEL-CIJEPANA').value) || 0;

            // Calculate TRUPCI Č = F/L Č + I Č + II Č + III Č + RUDNO
            var trupciC = flC + iC + iiC + iiiC + rudno;
            document.getElementById('otprema-TRUPCI-C').value = trupciC.toFixed(2);

            // Calculate ČETINARI = CEL.DUGA + CEL.CIJEPANA + TRUPCI Č
            var cetinari = celDuga + celCijepana + trupciC;
            document.getElementById('otprema-CETINARI').value = cetinari.toFixed(2);

            // Get all lišćar values
            var flL = parseFloat(document.getElementById('otprema-FL-L').value) || 0;
            var iL = parseFloat(document.getElementById('otprema-I-L').value) || 0;
            var iiL = parseFloat(document.getElementById('otprema-II-L').value) || 0;
            var iiiL = parseFloat(document.getElementById('otprema-III-L').value) || 0;
            var ogrDugi = parseFloat(document.getElementById('otprema-OGR-DUGI').value) || 0;
            var ogrCijepani = parseFloat(document.getElementById('otprema-OGR-CIJEPANI').value) || 0;

            // Calculate TRUPCI L = F/L L + I L + II L + III L
            var trupciL = flL + iL + iiL + iiiL;
            document.getElementById('otprema-TRUPCI').value = trupciL.toFixed(2);

            // Calculate LIŠĆARI = OGR.DUGI + OGR.CIJEPANI + TRUPCI L
            var liscari = ogrDugi + ogrCijepani + trupciL;
            document.getElementById('otprema-LISCARI').value = liscari.toFixed(2);

            // Calculate SVEUKUPNO = ČETINARI + LIŠĆARI
            var sveukupno = cetinari + liscari;
            document.getElementById('otprema-SVEUKUPNO').value = sveukupno.toFixed(2);
        }

        // Show Add Sjeca Form
        function showAddSjecaForm() {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('add-sjeca-content').classList.remove('hidden');

            // Set today's date as default
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('sjeca-datum').value = today;

            // Add event listeners to all sortimenti inputs for automatic calculation
            const sjecaInputIds = ['sjeca-FL-C', 'sjeca-I-C', 'sjeca-II-C', 'sjeca-III-C', 'sjeca-RUDNO',
                                   'sjeca-CEL-DUGA', 'sjeca-CEL-CIJEPANA',
                                   'sjeca-FL-L', 'sjeca-I-L', 'sjeca-II-L', 'sjeca-III-L',
                                   'sjeca-OGR-DUGI', 'sjeca-OGR-CIJEPANI'];

            sjecaInputIds.forEach(function(inputId) {
                const element = document.getElementById(inputId);
                if (element && !element.hasAttribute('data-listener-added')) {
                    element.addEventListener('input', calculateSjeca);
                    element.setAttribute('data-listener-added', 'true');
                }
            });

            // Initial calculation
            calculateSjeca();
        }

        // Show Add Otprema Form
        function showAddOtpremaForm() {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('add-otprema-content').classList.remove('hidden');

            // Set today's date as default
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('otprema-datum').value = today;

            // Add event listeners to all sortimenti inputs for automatic calculation
            const otpremaInputIds = ['otprema-FL-C', 'otprema-I-C', 'otprema-II-C', 'otprema-III-C', 'otprema-RUDNO',
                                     'otprema-CEL-DUGA', 'otprema-CEL-CIJEPANA',
                                     'otprema-FL-L', 'otprema-I-L', 'otprema-II-L', 'otprema-III-L',
                                     'otprema-OGR-DUGI', 'otprema-OGR-CIJEPANI'];

            otpremaInputIds.forEach(function(inputId) {
                const element = document.getElementById(inputId);
                if (element && !element.hasAttribute('data-listener-added')) {
                    element.addEventListener('input', calculateOtprema);
                    element.setAttribute('data-listener-added', 'true');
                }
            });

            // Initial calculation
            calculateOtprema();
        }

        // Submit Sjeca Form
        async function submitSjeca(event) {
            event.preventDefault();

            const submitBtn = document.getElementById('submit-sjeca-btn');
            const messageDiv = document.getElementById('sjeca-message');

            submitBtn.disabled = true;
            submitBtn.textContent = 'Dodavanje...';
            messageDiv.classList.add('hidden');

            try {
                // Collect form data
                const formData = new URLSearchParams();
                formData.append('path', 'add-sjeca');
                formData.append('username', currentUser.username);
                formData.append('password', currentPassword);
                formData.append('datum', document.getElementById('sjeca-datum').value);
                formData.append('odjel', document.getElementById('sjeca-odjel').value);
                formData.append('F/L Č', document.getElementById('sjeca-FL-C').value);
                formData.append('I Č', document.getElementById('sjeca-I-C').value);
                formData.append('II Č', document.getElementById('sjeca-II-C').value);
                formData.append('III Č', document.getElementById('sjeca-III-C').value);
                formData.append('RUDNO', document.getElementById('sjeca-RUDNO').value);
                formData.append('TRUPCI Č', document.getElementById('sjeca-TRUPCI-C').value);
                formData.append('CEL.DUGA', document.getElementById('sjeca-CEL-DUGA').value);
                formData.append('CEL.CIJEPANA', document.getElementById('sjeca-CEL-CIJEPANA').value);
                formData.append('ČETINARI', document.getElementById('sjeca-CETINARI').value);
                formData.append('F/L L', document.getElementById('sjeca-FL-L').value);
                formData.append('I L', document.getElementById('sjeca-I-L').value);
                formData.append('II L', document.getElementById('sjeca-II-L').value);
                formData.append('III L', document.getElementById('sjeca-III-L').value);
                formData.append('TRUPCI', document.getElementById('sjeca-TRUPCI').value);
                formData.append('OGR.DUGI', document.getElementById('sjeca-OGR-DUGI').value);
                formData.append('OGR.CIJEPANI', document.getElementById('sjeca-OGR-CIJEPANI').value);
                formData.append('LIŠĆARI', document.getElementById('sjeca-LISCARI').value);

                // Send request (don't cache this)
                const url = `${API_URL}?${formData.toString()}`;
                const response = await fetch(url);
                const result = await response.json();

                if (result.success) {
                    messageDiv.innerHTML = `✅ ${result.message}<br>Ukupno: ${result.ukupno.toFixed(2)} m³`;
                    messageDiv.style.background = '#d1fae5';
                    messageDiv.style.color = '#047857';
                    messageDiv.classList.remove('hidden');

                    // Reset form
                    setTimeout(() => {
                        resetSjecaForm();
                        messageDiv.classList.add('hidden');
                    }, 3000);

                    // Clear all sječa-related cache entries so new data shows up
                    clearCacheByPattern('primac');
                    clearCacheByPattern('primaci');
                    clearCacheByPattern('dashboard');
                    clearCacheByPattern('izvjestaji');
                    clearCacheByPattern('sedmicni_sjeca');
                    clearCacheByPattern('stanje_odjela');
                    clearCacheByPattern('my_sjece');
                } else {
                    throw new Error(result.error || 'Unknown error');
                }

            } catch (error) {
                messageDiv.innerHTML = `❌ Greška: ${error.message}`;
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Dodaj sječu';
            }
        }

        // Submit Otprema Form
        async function submitOtprema(event) {
            event.preventDefault();

            const submitBtn = document.getElementById('submit-otprema-btn');
            const messageDiv = document.getElementById('otprema-message');

            submitBtn.disabled = true;
            submitBtn.textContent = 'Dodavanje...';
            messageDiv.classList.add('hidden');

            try {
                // Collect form data
                const formData = new URLSearchParams();
                formData.append('path', 'add-otprema');
                formData.append('username', currentUser.username);
                formData.append('password', currentPassword);
                formData.append('datum', document.getElementById('otprema-datum').value);
                formData.append('odjel', document.getElementById('otprema-odjel').value);
                formData.append('kupac', document.getElementById('otprema-kupac').value);
                formData.append('brojOtpremnice', document.getElementById('otprema-broj-otpremnice').value);
                formData.append('F/L Č', document.getElementById('otprema-FL-C').value);
                formData.append('I Č', document.getElementById('otprema-I-C').value);
                formData.append('II Č', document.getElementById('otprema-II-C').value);
                formData.append('III Č', document.getElementById('otprema-III-C').value);
                formData.append('RUDNO', document.getElementById('otprema-RUDNO').value);
                formData.append('TRUPCI Č', document.getElementById('otprema-TRUPCI-C').value);
                formData.append('CEL.DUGA', document.getElementById('otprema-CEL-DUGA').value);
                formData.append('CEL.CIJEPANA', document.getElementById('otprema-CEL-CIJEPANA').value);
                formData.append('ČETINARI', document.getElementById('otprema-CETINARI').value);
                formData.append('F/L L', document.getElementById('otprema-FL-L').value);
                formData.append('I L', document.getElementById('otprema-I-L').value);
                formData.append('II L', document.getElementById('otprema-II-L').value);
                formData.append('III L', document.getElementById('otprema-III-L').value);
                formData.append('TRUPCI', document.getElementById('otprema-TRUPCI').value);
                formData.append('OGR.DUGI', document.getElementById('otprema-OGR-DUGI').value);
                formData.append('OGR.CIJEPANI', document.getElementById('otprema-OGR-CIJEPANI').value);
                formData.append('LIŠĆARI', document.getElementById('otprema-LISCARI').value);

                // Send request (don't cache this)
                const url = `${API_URL}?${formData.toString()}`;
                const response = await fetch(url);
                const result = await response.json();

                if (result.success) {
                    messageDiv.innerHTML = `✅ ${result.message}<br>Ukupno: ${result.ukupno.toFixed(2)} m³`;
                    messageDiv.style.background = '#dbeafe';
                    messageDiv.style.color = '#1e40af';
                    messageDiv.classList.remove('hidden');

                    // Reset form
                    setTimeout(() => {
                        resetOtpremaForm();
                        messageDiv.classList.add('hidden');
                    }, 3000);

                    // Clear all otprema-related cache entries so new data shows up
                    clearCacheByPattern('otpremac');
                    clearCacheByPattern('otpremaci');
                    clearCacheByPattern('dashboard');
                    clearCacheByPattern('kupci');
                    clearCacheByPattern('izvjestaji');
                    clearCacheByPattern('sedmicni_otprema');
                    clearCacheByPattern('stanje_odjela');
                    clearCacheByPattern('my_otpreme');
                } else {
                    throw new Error(result.error || 'Unknown error');
                }

            } catch (error) {
                messageDiv.innerHTML = `❌ Greška: ${error.message}`;
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Dodaj otpremu';
            }
        }

        // Reset Sjeca Form
        function resetSjecaForm() {
            document.getElementById('add-sjeca-form').reset();
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('sjeca-datum').value = today;

            // Reset all sortimenti to 0
            document.querySelectorAll('#add-sjeca-form input[type="number"]').forEach(input => {
                input.value = 0;
            });

            // Recalculate totals
            calculateSjeca();
        }

        // Reset Otprema Form
        function resetOtpremaForm() {
            document.getElementById('add-otprema-form').reset();
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('otprema-datum').value = today;

            // Reset all sortimenti to 0
            document.querySelectorAll('#add-otprema-form input[type="number"]').forEach(input => {
                input.value = 0;
            });

            // Recalculate totals
            calculateOtprema();
        }

        // ==================== MY PENDING ENTRIES FUNCTIONS ====================

        // Load My Sjece (last 10 pending entries for current user)
        async function loadMySjece() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('my-sjece-content').classList.add('hidden');

            try {
                const url = API_URL + '?path=my-pending&username=' + currentUser.username + '&password=' + currentPassword + '&tip=sjeca';
                const data = await fetchWithCache(url, `cache_my_sjece_${currentUser.username}`);

                if (data.error) {
                    throw new Error(data.error);
                }

                var html = '<div style="overflow-x: auto;">';

                if (data.unosi && data.unosi.length > 0) {
                    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
                    html += '<thead><tr style="background: #047857; color: white;">';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Datum</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Odjel</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">ČETINARI</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">LIŠĆARI</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Ukupno</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Vrijeme unosa</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Akcije</th>';
                    html += '</tr></thead><tbody>';

                    for (var i = 0; i < data.unosi.length; i++) {
                        var unos = data.unosi[i];
                        var cetinari = parseFloat(unos.sortimenti['ČETINARI'] || 0);
                        var liscari = parseFloat(unos.sortimenti['LIŠĆARI'] || 0);
                        var ukupno = cetinari + liscari;

                        html += '<tr style="' + (i % 2 === 0 ? 'background: #f9fafb;' : '') + '">';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + unos.datum + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + unos.odjel + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + cetinari.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + liscari.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">' + ukupno.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + new Date(unos.timestamp).toLocaleString('hr-HR') + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">';
                        html += '<button class="btn btn-primary" style="margin-right: 8px;" onclick=\'editMySjeca(' + JSON.stringify(unos).replace(/'/g, "\\'") + ')\'><✏️ Uredi</button>';
                        html += '<button class="btn btn-secondary" onclick="deleteMySjeca(' + unos.rowIndex + ')">🗑️ Obriši</button>';
                        html += '</td>';
                        html += '</tr>';
                    }

                    html += '</tbody></table>';
                } else {
                    html += '<p style="text-align: center; color: #6b7280; padding: 40px;">Nemate pending unosa.</p>';
                }

                html += '</div>';

                document.getElementById('my-sjece-container').innerHTML = html;
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('my-sjece-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading my sjece:', error);
                document.getElementById('my-sjece-container').innerHTML = '<p style="color: #dc2626; text-align: center; padding: 40px;">Greška: ' + error.message + '</p>';
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('my-sjece-content').classList.remove('hidden');
            }
        }

        // Load My Otpreme (last 10 pending entries for current user)
        async function loadMyOtpreme() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('my-otpreme-content').classList.add('hidden');

            try {
                const url = API_URL + '?path=my-pending&username=' + currentUser.username + '&password=' + currentPassword + '&tip=otprema';
                const data = await fetchWithCache(url, `cache_my_otpreme_${currentUser.username}`);

                if (data.error) {
                    throw new Error(data.error);
                }

                var html = '<div style="overflow-x: auto;">';

                if (data.unosi && data.unosi.length > 0) {
                    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
                    html += '<thead><tr style="background: #2563eb; color: white;">';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Datum</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Odjel</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Kupac</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Br. otpremnice</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">ČETINARI</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">LIŠĆARI</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Ukupno</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Vrijeme unosa</th>';
                    html += '<th style="padding: 12px; border: 1px solid #ddd;">Akcije</th>';
                    html += '</tr></thead><tbody>';

                    for (var i = 0; i < data.unosi.length; i++) {
                        var unos = data.unosi[i];
                        var cetinari = parseFloat(unos.sortimenti['ČETINARI'] || 0);
                        var liscari = parseFloat(unos.sortimenti['LIŠĆARI'] || 0);
                        var ukupno = cetinari + liscari;

                        html += '<tr style="' + (i % 2 === 0 ? 'background: #f9fafb;' : '') + '">';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + unos.datum + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + unos.odjel + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + (unos.kupac || '-') + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + (unos.brojOtpremnice || '-') + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + cetinari.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + liscari.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">' + ukupno.toFixed(2) + ' m³</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd;">' + new Date(unos.timestamp).toLocaleString('hr-HR') + '</td>';
                        html += '<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">';
                        html += '<button class="btn btn-primary" style="margin-right: 8px;" onclick=\'editMyOtprema(' + JSON.stringify(unos).replace(/'/g, "\\'") + ')\'>✏️ Uredi</button>';
                        html += '<button class="btn btn-secondary" onclick="deleteMyOtprema(' + unos.rowIndex + ')">🗑️ Obriši</button>';
                        html += '</td>';
                        html += '</tr>';
                    }

                    html += '</tbody></table>';
                } else {
                    html += '<p style="text-align: center; color: #6b7280; padding: 40px;">Nemate pending unosa.</p>';
                }

                html += '</div>';

                document.getElementById('my-otpreme-container').innerHTML = html;
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('my-otpreme-content').classList.remove('hidden');

            } catch (error) {
                console.error('Error loading my otpreme:', error);
                document.getElementById('my-otpreme-container').innerHTML = '<p style="color: #dc2626; text-align: center; padding: 40px;">Greška: ' + error.message + '</p>';
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('my-otpreme-content').classList.remove('hidden');
            }
        }

        // Edit My Sjeca - show edit form
        function editMySjeca(unos) {
            document.getElementById('loading-screen').classList.add('hidden');

            // Hide other content
            document.getElementById('my-sjece-content').classList.add('hidden');

            // Show edit form
            document.getElementById('edit-sjeca-content').classList.remove('hidden');

            // Populate form with existing data
            document.getElementById('edit-sjeca-rowIndex').value = unos.rowIndex;
            document.getElementById('edit-sjeca-datum').value = unos.datum;
            document.getElementById('edit-sjeca-odjel').value = unos.odjel;

            // Build sortimenti fields dynamically
            var sortimentiHtml = '';
            var sortimentiKeys = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'TRUPCI Č', 'CEL.DUGA', 'CEL.CIJEPANA', 'ČETINARI',
                                 'F/L L', 'I L', 'II L', 'III L', 'TRUPCI', 'OGR.DUGI', 'OGR.CIJEPANI', 'LIŠĆARI'];

            sortimentiKeys.forEach(function(key) {
                var fieldId = 'edit-sjeca-' + key.replace(/\//g, '').replace(/ /g, '-');
                var value = unos.sortimenti[key] || 0;
                var isCalculated = ['TRUPCI Č', 'ČETINARI', 'TRUPCI', 'LIŠĆARI'].indexOf(key) !== -1;
                var readonlyAttr = isCalculated ? 'readonly' : '';
                var styleExtra = isCalculated ? 'background: #f3f4f6; color: #374151; font-weight: 600;' : '';

                sortimentiHtml += '<div class="form-group">';
                sortimentiHtml += '<label>' + key + (isCalculated ? ': <span style="color: #6b7280; font-size: 0.85em;">(auto)</span>' : ':') + '</label>';
                sortimentiHtml += '<input type="number" step="0.01" id="' + fieldId + '" value="' + value + '" min="0" ' + readonlyAttr + ' class="edit-sjeca-input" style="padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; ' + styleExtra + '">';
                sortimentiHtml += '</div>';
            });

            document.getElementById('edit-sjeca-sortimenti').innerHTML = sortimentiHtml;

            // Add event listeners for auto-calculation
            var inputIds = ['edit-sjeca-FL-Č', 'edit-sjeca-I-Č', 'edit-sjeca-II-Č', 'edit-sjeca-III-Č', 'edit-sjeca-RUDNO',
                           'edit-sjeca-CEL.DUGA', 'edit-sjeca-CEL.CIJEPANA',
                           'edit-sjeca-FL-L', 'edit-sjeca-I-L', 'edit-sjeca-II-L', 'edit-sjeca-III-L',
                           'edit-sjeca-OGR.DUGI', 'edit-sjeca-OGR.CIJEPANI'];

            inputIds.forEach(function(inputId) {
                var element = document.getElementById(inputId);
                if (element) {
                    element.addEventListener('input', calculateEditSjeca);
                }
            });

            // Calculate initial totals
            calculateEditSjeca();
        }

        // Calculate Edit Sjeca totals
        function calculateEditSjeca() {
            var flC = parseFloat(document.getElementById('edit-sjeca-FL-Č').value) || 0;
            var iC = parseFloat(document.getElementById('edit-sjeca-I-Č').value) || 0;
            var iiC = parseFloat(document.getElementById('edit-sjeca-II-Č').value) || 0;
            var iiiC = parseFloat(document.getElementById('edit-sjeca-III-Č').value) || 0;
            var rudno = parseFloat(document.getElementById('edit-sjeca-RUDNO').value) || 0;
            var celDuga = parseFloat(document.getElementById('edit-sjeca-CEL.DUGA').value) || 0;
            var celCijepana = parseFloat(document.getElementById('edit-sjeca-CEL.CIJEPANA').value) || 0;

            var trupciC = flC + iC + iiC + iiiC + rudno;
            document.getElementById('edit-sjeca-TRUPCI-Č').value = trupciC.toFixed(2);

            var cetinari = celDuga + celCijepana + trupciC;
            document.getElementById('edit-sjeca-ČETINARI').value = cetinari.toFixed(2);

            var flL = parseFloat(document.getElementById('edit-sjeca-FL-L').value) || 0;
            var iL = parseFloat(document.getElementById('edit-sjeca-I-L').value) || 0;
            var iiL = parseFloat(document.getElementById('edit-sjeca-II-L').value) || 0;
            var iiiL = parseFloat(document.getElementById('edit-sjeca-III-L').value) || 0;
            var ogrDugi = parseFloat(document.getElementById('edit-sjeca-OGR.DUGI').value) || 0;
            var ogrCijepani = parseFloat(document.getElementById('edit-sjeca-OGR.CIJEPANI').value) || 0;

            var trupciL = flL + iL + iiL + iiiL;
            document.getElementById('edit-sjeca-TRUPCI').value = trupciL.toFixed(2);

            var liscari = ogrDugi + ogrCijepani + trupciL;
            document.getElementById('edit-sjeca-LIŠĆARI').value = liscari.toFixed(2);

            var sveukupno = cetinari + liscari;
            document.getElementById('edit-sjeca-SVEUKUPNO').value = sveukupno.toFixed(2);
        }

        // Submit Edit Sjeca Form
        async function submitEditSjeca(event) {
            event.preventDefault();

            var submitBtn = document.getElementById('submit-edit-sjeca-btn');
            var messageDiv = document.getElementById('edit-sjeca-message');

            submitBtn.disabled = true;
            submitBtn.textContent = 'Ažuriranje...';
            messageDiv.classList.add('hidden');

            try {
                var formData = new URLSearchParams();
                formData.append('path', 'update-pending');
                formData.append('username', currentUser.username);
                formData.append('password', currentPassword);
                formData.append('tip', 'sjeca');
                formData.append('rowIndex', document.getElementById('edit-sjeca-rowIndex').value);
                formData.append('datum', document.getElementById('edit-sjeca-datum').value);
                formData.append('odjel', document.getElementById('edit-sjeca-odjel').value);

                // Add all sortimenti
                var sortimentiKeys = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'TRUPCI Č', 'CEL.DUGA', 'CEL.CIJEPANA', 'ČETINARI',
                                     'F/L L', 'I L', 'II L', 'III L', 'TRUPCI', 'OGR.DUGI', 'OGR.CIJEPANI', 'LIŠĆARI'];

                sortimentiKeys.forEach(function(key) {
                    var fieldId = 'edit-sjeca-' + key.replace(/\//g, '').replace(/ /g, '-');
                    var value = document.getElementById(fieldId).value;
                    formData.append(key, value);
                });

                var url = API_URL + '?' + formData.toString();
                var response = await fetch(url);
                var result = await response.json();

                if (result.success) {
                    messageDiv.innerHTML = '✅ ' + result.message + '<br>Ukupno: ' + result.ukupno.toFixed(2) + ' m³';
                    messageDiv.style.background = '#d1fae5';
                    messageDiv.style.color = '#047857';
                    messageDiv.classList.remove('hidden');

                    setTimeout(function() {
                        switchTab('my-sjece');
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Unknown error');
                }

            } catch (error) {
                messageDiv.innerHTML = '❌ Greška: ' + error.message;
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sačuvaj izmjene';
            }
        }

        // Cancel Edit Sjeca
        function cancelEditSjeca() {
            switchTab('my-sjece');
        }

        // Similar functions for Edit Otprema (abbreviated for space)
        function editMyOtprema(unos) {
            // Similar to editMySjeca but for otprema
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('my-otpreme-content').classList.add('hidden');
            document.getElementById('edit-otprema-content').classList.remove('hidden');

            document.getElementById('edit-otprema-rowIndex').value = unos.rowIndex;
            document.getElementById('edit-otprema-datum').value = unos.datum;
            document.getElementById('edit-otprema-odjel').value = unos.odjel;
            document.getElementById('edit-otprema-kupac').value = unos.kupac || '';
            document.getElementById('edit-otprema-broj-otpremnice').value = unos.brojOtpremnice || '';

            var sortimentiHtml = '';
            var sortimentiKeys = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'TRUPCI Č', 'CEL.DUGA', 'CEL.CIJEPANA', 'ČETINARI',
                                 'F/L L', 'I L', 'II L', 'III L', 'TRUPCI', 'OGR.DUGI', 'OGR.CIJEPANI', 'LIŠĆARI'];

            sortimentiKeys.forEach(function(key) {
                var fieldId = 'edit-otprema-' + key.replace(/\//g, '').replace(/ /g, '-');
                var value = unos.sortimenti[key] || 0;
                var isCalculated = ['TRUPCI Č', 'ČETINARI', 'TRUPCI', 'LIŠĆARI'].indexOf(key) !== -1;
                var readonlyAttr = isCalculated ? 'readonly' : '';
                var styleExtra = isCalculated ? 'background: #f3f4f6; color: #374151; font-weight: 600;' : '';

                sortimentiHtml += '<div class="form-group">';
                sortimentiHtml += '<label>' + key + (isCalculated ? ': <span style="color: #6b7280; font-size: 0.85em;">(auto)</span>' : ':') + '</label>';
                sortimentiHtml += '<input type="number" step="0.01" id="' + fieldId + '" value="' + value + '" min="0" ' + readonlyAttr + ' style="padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; ' + styleExtra + '">';
                sortimentiHtml += '</div>';
            });

            document.getElementById('edit-otprema-sortimenti').innerHTML = sortimentiHtml;

            var inputIds = ['edit-otprema-FL-Č', 'edit-otprema-I-Č', 'edit-otprema-II-Č', 'edit-otprema-III-Č', 'edit-otprema-RUDNO',
                           'edit-otprema-CEL.DUGA', 'edit-otprema-CEL.CIJEPANA',
                           'edit-otprema-FL-L', 'edit-otprema-I-L', 'edit-otprema-II-L', 'edit-otprema-III-L',
                           'edit-otprema-OGR.DUGI', 'edit-otprema-OGR.CIJEPANI'];

            inputIds.forEach(function(inputId) {
                var element = document.getElementById(inputId);
                if (element) {
                    element.addEventListener('input', calculateEditOtprema);
                }
            });

            calculateEditOtprema();
        }

        function calculateEditOtprema() {
            var flC = parseFloat(document.getElementById('edit-otprema-FL-Č').value) || 0;
            var iC = parseFloat(document.getElementById('edit-otprema-I-Č').value) || 0;
            var iiC = parseFloat(document.getElementById('edit-otprema-II-Č').value) || 0;
            var iiiC = parseFloat(document.getElementById('edit-otprema-III-Č').value) || 0;
            var rudno = parseFloat(document.getElementById('edit-otprema-RUDNO').value) || 0;
            var celDuga = parseFloat(document.getElementById('edit-otprema-CEL.DUGA').value) || 0;
            var celCijepana = parseFloat(document.getElementById('edit-otprema-CEL.CIJEPANA').value) || 0;

            var trupciC = flC + iC + iiC + iiiC + rudno;
            document.getElementById('edit-otprema-TRUPCI-Č').value = trupciC.toFixed(2);

            var cetinari = celDuga + celCijepana + trupciC;
            document.getElementById('edit-otprema-ČETINARI').value = cetinari.toFixed(2);

            var flL = parseFloat(document.getElementById('edit-otprema-FL-L').value) || 0;
            var iL = parseFloat(document.getElementById('edit-otprema-I-L').value) || 0;
            var iiL = parseFloat(document.getElementById('edit-otprema-II-L').value) || 0;
            var iiiL = parseFloat(document.getElementById('edit-otprema-III-L').value) || 0;
            var ogrDugi = parseFloat(document.getElementById('edit-otprema-OGR.DUGI').value) || 0;
            var ogrCijepani = parseFloat(document.getElementById('edit-otprema-OGR.CIJEPANI').value) || 0;

            var trupciL = flL + iL + iiL + iiiL;
            document.getElementById('edit-otprema-TRUPCI').value = trupciL.toFixed(2);

            var liscari = ogrDugi + ogrCijepani + trupciL;
            document.getElementById('edit-otprema-LIŠĆARI').value = liscari.toFixed(2);

            var sveukupno = cetinari + liscari;
            document.getElementById('edit-otprema-SVEUKUPNO').value = sveukupno.toFixed(2);
        }

        async function submitEditOtprema(event) {
            event.preventDefault();

            var submitBtn = document.getElementById('submit-edit-otprema-btn');
            var messageDiv = document.getElementById('edit-otprema-message');

            submitBtn.disabled = true;
            submitBtn.textContent = 'Ažuriranje...';
            messageDiv.classList.add('hidden');

            try {
                var formData = new URLSearchParams();
                formData.append('path', 'update-pending');
                formData.append('username', currentUser.username);
                formData.append('password', currentPassword);
                formData.append('tip', 'otprema');
                formData.append('rowIndex', document.getElementById('edit-otprema-rowIndex').value);
                formData.append('datum', document.getElementById('edit-otprema-datum').value);
                formData.append('odjel', document.getElementById('edit-otprema-odjel').value);
                formData.append('kupac', document.getElementById('edit-otprema-kupac').value);
                formData.append('brojOtpremnice', document.getElementById('edit-otprema-broj-otpremnice').value);

                var sortimentiKeys = ['F/L Č', 'I Č', 'II Č', 'III Č', 'RUDNO', 'TRUPCI Č', 'CEL.DUGA', 'CEL.CIJEPANA', 'ČETINARI',
                                     'F/L L', 'I L', 'II L', 'III L', 'TRUPCI', 'OGR.DUGI', 'OGR.CIJEPANI', 'LIŠĆARI'];

                sortimentiKeys.forEach(function(key) {
                    var fieldId = 'edit-otprema-' + key.replace(/\//g, '').replace(/ /g, '-');
                    var value = document.getElementById(fieldId).value;
                    formData.append(key, value);
                });

                var url = API_URL + '?' + formData.toString();
                var response = await fetch(url);
                var result = await response.json();

                if (result.success) {
                    messageDiv.innerHTML = '✅ ' + result.message + '<br>Ukupno: ' + result.ukupno.toFixed(2) + ' m³';
                    messageDiv.style.background = '#dbeafe';
                    messageDiv.style.color = '#1e40af';
                    messageDiv.classList.remove('hidden');

                    setTimeout(function() {
                        switchTab('my-otpreme');
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Unknown error');
                }

            } catch (error) {
                messageDiv.innerHTML = '❌ Greška: ' + error.message;
                messageDiv.style.background = '#fee2e2';
                messageDiv.style.color = '#991b1b';
                messageDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sačuvaj izmjene';
            }
        }

        function cancelEditOtprema() {
            switchTab('my-otpreme');
        }

        // Delete functions
        async function deleteMySjeca(rowIndex) {
            showConfirmModal(
                'Potvrda brisanja',
                'Da li ste sigurni da želite obrisati ovaj unos sječe?',
                async function() {
                    try {
                        var formData = new URLSearchParams();
                        formData.append('path', 'delete-pending');
                        formData.append('username', currentUser.username);
                        formData.append('password', currentPassword);
                        formData.append('tip', 'sjeca');
                        formData.append('rowIndex', rowIndex);

                        var url = API_URL + '?' + formData.toString();
                        var response = await fetch(url);
                        var result = await response.json();

                        if (result.success) {
                            showSuccess('Uspjeh', result.message);
                            loadMySjece();
                        } else {
                            throw new Error(result.error || 'Unknown error');
                        }
                    } catch (error) {
                        showError('Greška', error.message);
                    }
                }
            );
        }

        async function deleteMyOtprema(rowIndex) {
            showConfirmModal(
                'Potvrda brisanja',
                'Da li ste sigurni da želite obrisati ovaj unos otpreme?',
                async function() {
                    try {
                        var formData = new URLSearchParams();
                        formData.append('path', 'delete-pending');
                        formData.append('username', currentUser.username);
                        formData.append('password', currentPassword);
                        formData.append('tip', 'otprema');
                        formData.append('rowIndex', rowIndex);

                        var url = API_URL + '?' + formData.toString();
                        var response = await fetch(url);
                        var result = await response.json();

                        if (result.success) {
                            showSuccess('Uspjeh', result.message);
                            loadMyOtpreme();
                        } else {
                            throw new Error(result.error || 'Unknown error');
                        }
                    } catch (error) {
                        showError('Greška', error.message);
                    }
                }
            );
        }

        // ============================================
        // MODAL FUNCTIONS
        // ============================================

        let confirmCallback = null;

        function showConfirmModal(title, message, onConfirm) {
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-body').textContent = message;
            confirmCallback = onConfirm;
            document.getElementById('confirm-modal').classList.add('show');

            document.getElementById('modal-confirm-btn').onclick = function() {
                if (confirmCallback) confirmCallback();
                closeConfirmModal();
            };
        }

        function closeConfirmModal() {
            document.getElementById('confirm-modal').classList.remove('show');
            confirmCallback = null;
        }

        // Close modal on overlay click
        document.getElementById('confirm-modal').addEventListener('click', function(e) {
            if (e.target.id === 'confirm-modal') {
                closeConfirmModal();
            }
        });

        // ============================================
        // FILTER FUNCTIONS
        // ============================================

        let unfilteredPendingData = [];

        function applyFilters() {
            const datumOd = document.getElementById('filter-datum-od')?.value;
            const datumDo = document.getElementById('filter-datum-do')?.value;
            const tip = document.getElementById('filter-tip')?.value;
            const search = document.getElementById('filter-search')?.value.toLowerCase();

            let filtered = [...unfilteredPendingData];

            // Filter by date range
            if (datumOd) {
                filtered = filtered.filter(item => {
                    const itemDate = new Date(item.timestampObj);
                    return itemDate >= new Date(datumOd);
                });
            }
            if (datumDo) {
                filtered = filtered.filter(item => {
                    const itemDate = new Date(item.timestampObj);
                    return itemDate <= new Date(datumDo + 'T23:59:59');
                });
            }

            // Filter by type
            if (tip) {
                filtered = filtered.filter(item => item.tip === tip);
            }

            // Filter by search text
            if (search) {
                filtered = filtered.filter(item => {
                    const searchText = (
                        (item.odjel || '') + ' ' +
                        (item.radnik || '') + ' ' +
                        (item.kupac || '')
                    ).toLowerCase();
                    return searchText.includes(search);
                });
            }

            // Re-render table with filtered data
            renderPendingTable(filtered);
        }

        function clearFilters() {
            const filterDatumOd = document.getElementById('filter-datum-od');
            const filterDatumDo = document.getElementById('filter-datum-do');
            const filterTip = document.getElementById('filter-tip');
            const filterSearch = document.getElementById('filter-search');

            if (filterDatumOd) filterDatumOd.value = '';
            if (filterDatumDo) filterDatumDo.value = '';
            if (filterTip) filterTip.value = '';
            if (filterSearch) filterSearch.value = '';

            renderPendingTable(unfilteredPendingData);
        }

        // ============================================
        // ROW ACTIONS DROPDOWN
        // ============================================

        function toggleRowActions(id) {
            const dropdown = document.getElementById('row-actions-' + id);
            const allDropdowns = document.querySelectorAll('.row-actions-dropdown');

            // Close all other dropdowns
            allDropdowns.forEach(d => {
                if (d.id !== 'row-actions-' + id) {
                    d.classList.remove('show');
                }
            });

            // Toggle this dropdown
            dropdown.classList.toggle('show');
        }

        // Close row actions when clicking outside
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.row-actions')) {
                const allDropdowns = document.querySelectorAll('.row-actions-dropdown');
                allDropdowns.forEach(d => d.classList.remove('show'));
            }
        });

        // ============================================
        // OPERATIVA & ANALYTICS FUNCTIONS
        // ============================================

        // Load OPERATIVA screen and populate analytics
        function loadOperativa() {
            console.log('Loading Operativa screen...');
            document.getElementById('operativa-content').classList.remove('hidden');
            document.getElementById('loading-screen').classList.add('hidden');

            // Load stats data for current year
            const year = new Date().getFullYear();
            loadStatsForOperativa(year);
        }

        // Load and transform data for OPERATIVA screen
        async function loadStatsForOperativa(year) {
            try {
                // Fetch dashboard data
                const dashboardUrl = `${API_URL}?path=dashboard&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const dashboardData = await fetchWithCache(dashboardUrl, 'cache_dashboard_' + year);

                // Fetch odjeli data
                const odjeliUrl = `${API_URL}?path=odjeli&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const odjeliResponse = await fetchWithCache(odjeliUrl, 'cache_odjeli_' + year);

                // **NOVO: Fetch STANJE ODJELA data (sa PROJEKAT podacima iz Excel redova 10-13)**
                const stanjeOdjelaUrl = `${API_URL}?path=stanje-odjela&username=${currentUser.username}&password=${currentPassword}`;
                const stanjeOdjelaData = await fetchWithCache(stanjeOdjelaUrl, 'cache_stanje_odjela');

                console.log('Dashboard data for OPERATIVA:', dashboardData);
                console.log('Odjeli data for OPERATIVA:', odjeliResponse);
                console.log('STANJE ODJELA data for OPERATIVA (PROJEKAT source):', stanjeOdjelaData);

                // DEBUG: Log odjeli count and total from API
                if (odjeliResponse && odjeliResponse.odjeli) {
                    const odjeliCount = odjeliResponse.odjeli.length;
                    const totalFromAPI = odjeliResponse.odjeli.reduce((sum, o) => sum + (o.sjeca || 0), 0);
                    console.log(`=== ODJELI API SUMMARY ===`);
                    console.log(`Total odjela in API: ${odjeliCount}`);
                    console.log(`Total sječa from API (direct): ${totalFromAPI.toFixed(2)} m³`);
                    console.log(`Expected total: ~68171 m³`);
                    if (Math.abs(totalFromAPI - 68171) > 1000) {
                        console.warn(`⚠️ SUMA DISCREPANCY: ${(totalFromAPI - 68171).toFixed(2)} m³ difference!`);
                    }
                }

                if (dashboardData.error || odjeliResponse.error) {
                    console.error('Error loading OPERATIVA data');
                    return;
                }

                // Transform dashboard data to OPERATIVA format
                const totalPrimka = dashboardData.mjesecnaStatistika.reduce((sum, m) => sum + (m.sjeca || 0), 0);
                const totalOtprema = dashboardData.mjesecnaStatistika.reduce((sum, m) => sum + (m.otprema || 0), 0);

                // Transform monthly stats: mjesecnaStatistika -> monthlyStats
                const monthlyStats = dashboardData.mjesecnaStatistika.map(m => ({
                    mjesec: m.mjesec,
                    sječa: m.sjeca || 0,
                    otprema: m.otprema || 0,
                    stanje: m.stanje || 0,
                    dinamika: m.dinamika || 0
                }));

                // **IMPROVED: Enrich odjeli data with PROJEKAT from STANJE ODJELA (red 10 Excel)**
                const odjeliStats = {};
                if (odjeliResponse.odjeli && odjeliResponse.odjeli.length > 0) {
                    odjeliResponse.odjeli.forEach(odjel => {
                        // Find matching odjel in STANJE ODJELA data
                        let projekatTotal = 0;
                        let radilisteNaziv = '';
                        let zadnjiDatum = null;

                        if (stanjeOdjelaData && stanjeOdjelaData.data) {
                            const stanjeMatch = stanjeOdjelaData.data.find(s =>
                                s.odjelNaziv.toLowerCase().includes(odjel.odjel.toLowerCase()) ||
                                odjel.odjel.toLowerCase().includes(s.odjelNaziv.replace('.xlsx', '').toLowerCase())
                            );

                            if (stanjeMatch && stanjeMatch.redovi && stanjeMatch.redovi.projekat) {
                                // Sum all sortimenti from projekat row (red 10 iz Excel-a)
                                projekatTotal = stanjeMatch.redovi.projekat.reduce((sum, val) => sum + (val || 0), 0);
                                radilisteNaziv = stanjeMatch.radiliste || '';
                                zadnjiDatum = stanjeMatch.zadnjiDatum;

                                // DEBUG: Log projekat sources za GRMEČ JASENICA 39
                                if (odjel.odjel.includes('JASENICA 39') || odjel.odjel.includes('GRMEČ')) {
                                    console.log('=== DEBUG GRMEČ JASENICA 39 ===');
                                    console.log('Odjel name:', odjel.odjel);
                                    console.log('odjel.projekat (U11 from handleOdjeli):', odjel.projekat);
                                    console.log('projekatTotal (STANJE ODJELA red 10):', projekatTotal);
                                    console.log('stanjeMatch.odjelNaziv:', stanjeMatch.odjelNaziv);
                                    console.log('stanjeMatch.redovi.projekat:', stanjeMatch.redovi.projekat);
                                }
                            }
                        }

                        // DEBUG: Check for duplicate odjeli
                        if (odjeliStats[odjel.odjel]) {
                            console.warn('DUPLICATE ODJEL DETECTED:', odjel.odjel, 'Previous:', odjeliStats[odjel.odjel], 'New:', odjel);
                        }

                        odjeliStats[odjel.odjel] = {
                            sječa: odjel.sjeca || 0,
                            otprema: odjel.otprema || 0,
                            projekat: (odjel.projekat && odjel.projekat > 0) ? odjel.projekat : projekatTotal, // Use odjel.projekat (U11) as primary source
                            ukupnoPosjeklo: odjel.sjeca || 0,
                            zadnjaSjeca: odjel.zadnjaSjeca || 0,
                            datumZadnjeSjece: odjel.datumZadnjeSjece || '',
                            radiliste: radilisteNaziv || odjel.radiliste || '',
                            izvođač: (odjel.izvođač || '').trim(), // Trim whitespace to prevent duplicates
                            zadnjiDatumUnosa: odjel.datumZadnjeSjece || '' // Use formatted date from odjel, not stanjeMatch
                        };
                    });
                }

                // Create transformed data object
                const transformedData = {
                    totalPrimka,
                    totalOtprema,
                    monthlyStats,
                    odjeliStats,
                    stanjeOdjelaRaw: stanjeOdjelaData // Pass raw data for additional features
                };

                console.log('Transformed data for OPERATIVA (enriched with PROJEKAT):', transformedData);

                // Load OPERATIVA with transformed data
                loadOperativaData(transformedData);

            } catch (error) {
                console.error('Error in loadStatsForOperativa:', error);
            }
        }

        // Main data processing for Operativa screen
        function loadOperativaData(data) {
            console.log('Processing Operativa data:', data);

            // Calculate KPIs
            const totalPrimka = data.totalPrimka || 0;
            const totalOtprema = data.totalOtprema || 0;
            const ratio = totalOtprema > 0 ? (totalPrimka / totalOtprema).toFixed(2) : '0.00';

            // Count odjeli
            const odjeliCount = Object.keys(data.odjeliStats || {}).length;

            // Calculate average projekat completion
            let totalProjekat = 0;
            let totalOstvareno = 0;
            Object.values(data.odjeliStats || {}).forEach(stats => {
                totalProjekat += stats.projekat || 0;
                totalOstvareno += stats.ukupnoPosjeklo || stats.sječa || 0;
            });
            const procenatOstvarenja = totalProjekat > 0
                ? ((totalOstvareno / totalProjekat) * 100).toFixed(0)
                : '0';

            // Calculate monthly averages
            const monthlyStats = data.monthlyStats || [];
            const avgMonthlySjeca = monthlyStats.length > 0
                ? (monthlyStats.reduce((sum, m) => sum + (m.sječa || 0), 0) / monthlyStats.length).toFixed(2)
                : '0.00';
            const avgMonthlyOtprema = monthlyStats.length > 0
                ? (monthlyStats.reduce((sum, m) => sum + (m.otprema || 0), 0) / monthlyStats.length).toFixed(2)
                : '0.00';

            // Update KPI cards
            document.getElementById('kpi-ratio').textContent = ratio;
            document.getElementById('kpi-procenat').textContent = procenatOstvarenja + '%';
            document.getElementById('kpi-odjela').textContent = odjeliCount;
            document.getElementById('kpi-avg-sjeca').textContent = odjeliCount > 0
                ? (totalPrimka / odjeliCount).toFixed(0) + ' m³'
                : '0 m³';

            // Update monthly averages
            document.getElementById('avg-monthly-sjeca').textContent = avgMonthlySjeca + ' m³';
            document.getElementById('avg-monthly-otprema').textContent = avgMonthlyOtprema + ' m³';

            // Render components
            renderTopOdjeli(data.odjeliStats || {});
            renderProjekatOstvareno(data.odjeliStats || {});
            renderAnalyticsChart(monthlyStats);
            renderAnalyticsOdjeliTable(data.odjeliStats || {});

            // Render new features
            renderPerformanceAlerts(data.odjeliStats || {});
            renderIzvodjaciPerformance(data.odjeliStats || {});
            renderTimelineUnosi(data.odjeliStats || {});

            // Render additional analytics features
            renderSeasonalAnalysis(monthlyStats);
        }

        // Render Top 5 Odjela by Sječa
        function renderTopOdjeli(odjeliStats) {
            const sorted = Object.entries(odjeliStats)
                .sort((a, b) => (b[1].sječa || 0) - (a[1].sječa || 0))
                .slice(0, 5);

            const html = sorted.length > 0
                ? sorted.map((entry, index) => {
                    const [odjel, stats] = entry;
                    const rankClass = index < 3 ? 'top' : '';
                    return `
                        <div class="ranking-item">
                            <div class="ranking-number ${rankClass}">${index + 1}</div>
                            <div class="ranking-info">
                                <div class="ranking-name">${odjel}</div>
                                <div class="ranking-value">${(stats.sječa || 0).toFixed(2)} m³</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka</p>';

            document.getElementById('top-odjeli-list').innerHTML = html;
        }

        // Render Projekat vs Ostvareno progress bars
        function renderProjekatOstvareno(odjeliStats) {
            const sorted = Object.entries(odjeliStats)
                .filter(([_, stats]) => (stats.projekat || 0) > 0)
                .map(([odjel, stats]) => ({
                    odjel,
                    projekat: stats.projekat || 0,
                    ostvareno: stats.ukupnoPosjeklo || stats.sječa || 0,
                    procenat: (stats.projekat || 0) > 0
                        ? (((stats.ukupnoPosjeklo || stats.sječa || 0) / stats.projekat) * 100)
                        : 0
                }))
                .sort((a, b) => b.procenat - a.procenat)
                .slice(0, 5);

            const html = sorted.length > 0
                ? sorted.map(item => {
                    const barWidth = Math.min(item.procenat, 100);
                    const colorClass = item.procenat >= 90 ? 'green'
                                     : item.procenat >= 70 ? 'blue'
                                     : 'red';
                    const barColor = item.procenat >= 90 ? '#059669'
                                   : item.procenat >= 70 ? '#2563eb'
                                   : '#dc2626';

                    return `
                        <div style="margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span style="font-weight: 600; color: #1f2937;">${item.odjel}</span>
                                <span style="font-weight: 700; color: #059669;">${item.procenat.toFixed(1)}%</span>
                            </div>
                            <div class="progress-bar-container" style="height: 12px;">
                                <div class="progress-bar-fill ${colorClass}" style="width: ${barWidth}%; background: ${barColor};"></div>
                            </div>
                            <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                                ${item.ostvareno.toFixed(0)} / ${item.projekat.toFixed(0)} m³
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka o projektu</p>';

            document.getElementById('projekat-ostvareno-list').innerHTML = html;
        }

        // Render SVG Analytics Chart (Monthly Trend)
        function renderAnalyticsChart(monthlyStats) {
            const svg = document.getElementById('analytics-chart');
            if (!svg) return;

            const padding = { top: 20, right: 40, bottom: 40, left: 60 };
            const width = svg.clientWidth || 1000;
            const height = 300;
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;

            svg.innerHTML = '';
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

            // Empty state
            if (!monthlyStats || monthlyStats.length === 0) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', width / 2);
                text.setAttribute('y', height / 2);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '14');
                text.setAttribute('fill', '#6b7280');
                text.textContent = 'Nema podataka za prikaz';
                svg.appendChild(text);
                return;
            }

            // Calculate scales
            const maxValue = Math.max(
                ...monthlyStats.map(m => Math.max(m.sječa || 0, m.otprema || 0)),
                1
            );
            const yScale = chartHeight / (maxValue * 1.1);
            const xStep = chartWidth / (monthlyStats.length - 1);

            // Smooth path function
            function createSmoothPath(data, getValue) {
                const points = data.map((d, i) => ({
                    x: padding.left + i * xStep,
                    y: padding.top + chartHeight - getValue(d) * yScale
                }));

                if (points.length === 0) return '';

                let path = `M ${points[0].x} ${points[0].y}`;

                for (let i = 0; i < points.length - 1; i++) {
                    const current = points[i];
                    const next = points[i + 1];
                    const controlX = (current.x + next.x) / 2;
                    path += ` Q ${controlX} ${current.y}, ${controlX} ${(current.y + next.y) / 2}`;
                    path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
                }

                return path;
            }

            // Draw grid lines
            const gridLines = 5;
            for (let i = 0; i <= gridLines; i++) {
                const y = padding.top + (chartHeight / gridLines) * i;

                // Grid line
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', padding.left);
                line.setAttribute('y1', y);
                line.setAttribute('x2', width - padding.right);
                line.setAttribute('y2', y);
                line.setAttribute('stroke', '#e5e7eb');
                line.setAttribute('stroke-width', '1');
                svg.appendChild(line);

                // Y-axis label
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                const value = (maxValue * 1.1) * (1 - i / gridLines);
                label.setAttribute('x', padding.left - 10);
                label.setAttribute('y', y + 5);
                label.setAttribute('text-anchor', 'end');
                label.setAttribute('font-size', '12');
                label.setAttribute('fill', '#6b7280');
                label.textContent = value.toFixed(0);
                svg.appendChild(label);
            }

            // Draw Sječa line (green)
            const sjecaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            sjecaPath.setAttribute('d', createSmoothPath(monthlyStats, m => m.sječa || 0));
            sjecaPath.setAttribute('fill', 'none');
            sjecaPath.setAttribute('stroke', '#059669');
            sjecaPath.setAttribute('stroke-width', '3');
            sjecaPath.setAttribute('stroke-linecap', 'round');
            svg.appendChild(sjecaPath);

            // Draw Otprema line (blue)
            const otpremaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            otpremaPath.setAttribute('d', createSmoothPath(monthlyStats, m => m.otprema || 0));
            otpremaPath.setAttribute('fill', 'none');
            otpremaPath.setAttribute('stroke', '#2563eb');
            otpremaPath.setAttribute('stroke-width', '3');
            otpremaPath.setAttribute('stroke-linecap', 'round');
            svg.appendChild(otpremaPath);

            // Draw data points
            monthlyStats.forEach((m, i) => {
                const x = padding.left + i * xStep;

                // Sječa point
                const sjecaY = padding.top + chartHeight - (m.sječa || 0) * yScale;
                const sjecaCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                sjecaCircle.setAttribute('cx', x);
                sjecaCircle.setAttribute('cy', sjecaY);
                sjecaCircle.setAttribute('r', '4');
                sjecaCircle.setAttribute('fill', '#059669');
                sjecaCircle.setAttribute('stroke', 'white');
                sjecaCircle.setAttribute('stroke-width', '2');
                svg.appendChild(sjecaCircle);

                // Otprema point
                const otpremaY = padding.top + chartHeight - (m.otprema || 0) * yScale;
                const otpremaCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                otpremaCircle.setAttribute('cx', x);
                otpremaCircle.setAttribute('cy', otpremaY);
                otpremaCircle.setAttribute('r', '4');
                otpremaCircle.setAttribute('fill', '#2563eb');
                otpremaCircle.setAttribute('stroke', 'white');
                otpremaCircle.setAttribute('stroke-width', '2');
                svg.appendChild(otpremaCircle);

                // Month label
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', x);
                label.setAttribute('y', height - padding.bottom + 20);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('font-size', '11');
                label.setAttribute('fill', '#6b7280');
                label.textContent = (m.mjesec || '').substring(0, 3);
                svg.appendChild(label);
            });
        }

        // Render detailed analytics odjeli table
        function renderAnalyticsOdjeliTable(odjeliStats) {
            const html = Object.entries(odjeliStats).map(([odjel, stats]) => {
                const projekat = stats.projekat || 0;
                const ostvareno = stats.ukupnoPosjeklo || stats.sječa || 0;
                const procenat = projekat > 0 ? ((ostvareno / projekat) * 100).toFixed(1) : '0.0';
                const diff = (stats.sječa || 0) - (stats.otprema || 0);

                const procenatClass = procenat >= 90 ? 'green' : procenat >= 70 ? 'blue' : 'red';
                const diffClass = diff >= 0 ? 'green' : 'red';

                return `
                    <tr>
                        <td style="font-weight: 500;">${odjel}</td>
                        <td class="right green">${(stats.sječa || 0).toFixed(2)}</td>
                        <td class="right blue">${(stats.otprema || 0).toFixed(2)}</td>
                        <td class="right">${projekat.toFixed(2)}</td>
                        <td class="right ${procenatClass}">${procenat}%</td>
                        <td class="right ${diffClass}">${(diff >= 0 ? '+' : '') + diff.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');

            document.getElementById('analytics-odjeli-table').innerHTML = html || '<tr><td colspan="6" style="text-align: center; color: #6b7280;">Nema podataka</td></tr>';
        }

        // Render Performance Alerts Banner
        function renderPerformanceAlerts(odjeliStats) {
            console.log('renderPerformanceAlerts called with:', odjeliStats);
            const criticalAlerts = []; // 🔴 Kritično: > 5 dana bez unosa + projekat >> posječeno
            const warningAlerts = [];  // ⚠️ Upozorenje: posječena masa > 110% projekta (blizu 115% limite)

            const today = new Date();

            Object.entries(odjeliStats).forEach(([odjel, stats]) => {
                const projekat = stats.projekat || 0;
                const ostvareno = stats.sječa || 0;
                const zadnjiDatum = stats.zadnjiDatumUnosa || '';
                const procenat = projekat > 0 ? ((ostvareno / projekat) * 100) : 0;

                // FILTER: Ne prikazuj alerte za odjele gdje je zadnji unos stariji od 30 dana
                if (zadnjiDatum) {
                    const dateParts = zadnjiDatum.split('.');
                    if (dateParts.length === 3) {
                        const lastEntry = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
                        const daysSinceEntry = Math.floor((today - lastEntry) / (1000 * 60 * 60 * 24));

                        if (daysSinceEntry > 30) {
                            console.log(`Skipping alert for ${odjel} - zadnji unos prije ${daysSinceEntry} dana (> 30 dana)`);
                            return; // Skip ovaj odjel kompletno
                        }

                        // Kriterijum 1: KRITIČNO - Nije bilo unosa > 5 dana + projekat daleko veći od posječenog
                        if (projekat > 0 && daysSinceEntry > 5 && procenat < 50) {
                            criticalAlerts.push({
                                odjel,
                                reason: `${daysSinceEntry} dana bez unosa, ${procenat.toFixed(0)}% plana`,
                                days: daysSinceEntry,
                                procenat: procenat.toFixed(0)
                            });
                        }
                    }
                }

                // Kriterijum 2: UPOZORENJE - Posječena masa > 110% projekta (blizu 115% limite za aneks)
                // Samo ako nije preskočen zbog 30-day filtera
                if (projekat > 0 && procenat > 110) {
                    warningAlerts.push({
                        odjel,
                        reason: `${procenat.toFixed(0)}% projekta - blizu limite za aneks (115%)`,
                        procenat: procenat.toFixed(0)
                    });
                }
            });

            console.log('Critical alerts:', criticalAlerts);
            console.log('Warning alerts:', warningAlerts);

            const banner = document.getElementById('performance-alerts-banner');

            // Prikaži kritične alert-e ako postoje, inače upozorenja
            if (criticalAlerts.length > 0) {
                banner.className = 'alert-banner danger';
                banner.style.display = 'flex';
                banner.innerHTML = `
                    <span style="font-size: 24px;">🔴</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">KRITIČNO - Nema Unosa + Niska Realizacija</div>
                        <div style="font-size: 13px;">
                            ${criticalAlerts.length} odjel${criticalAlerts.length > 1 ? 'a' : ''}:
                            ${criticalAlerts.map(a => `${a.odjel} (${a.reason})`).join(', ')}
                        </div>
                    </div>
                `;
            } else if (warningAlerts.length > 0) {
                banner.className = 'alert-banner warning';
                banner.style.display = 'flex';
                banner.innerHTML = `
                    <span style="font-size: 24px;">⚠️</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">UPOZORENJE - Premašena Projektovana Masa</div>
                        <div style="font-size: 13px;">
                            ${warningAlerts.length} odjel${warningAlerts.length > 1 ? 'a' : ''} iznad 110% projekta:
                            ${warningAlerts.map(a => `${a.odjel} (${a.procenat}%)`).join(', ')}
                        </div>
                    </div>
                `;
            } else {
                // Sve je dobro - možda prikaži success banner?
                banner.className = 'alert-banner success';
                banner.style.display = 'flex';
                banner.innerHTML = `
                    <span style="font-size: 24px;">✅</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">SVE U REDU</div>
                        <div style="font-size: 13px;">
                            Nema kritičnih odjela - svi odjeli su unutar dozvoljenih parametara
                        </div>
                    </div>
                `;
            }
        }

        // Render Top Izvođači Performance
        function renderIzvodjaciPerformance(odjeliStats) {
            console.log('renderIzvodjaciPerformance called with:', odjeliStats);
            const izvodjaciMap = {};
            const izvodjaciOriginalNames = {}; // Track original names for display

            // Group by izvođač (normalized to prevent duplicates)
            Object.entries(odjeliStats).forEach(([odjel, stats]) => {
                let izvodjac = stats.izvođač || stats.izvodjac || '';
                izvodjac = izvodjac.trim(); // Remove whitespace

                if (!izvodjac || izvodjac === '') {
                    console.log('Skipping odjel with empty izvođač:', odjel, stats);
                    return; // Skip empty izvođači
                }

                // Normalize for grouping (uppercase, trim)
                const normalizedName = izvodjac.toUpperCase();
                const sjeca = stats.sječa || 0;

                console.log(`Adding odjel ${odjel} to izvođač ${normalizedName}: ${sjeca} m³`);

                if (!izvodjaciMap[normalizedName]) {
                    izvodjaciMap[normalizedName] = 0;
                    izvodjaciOriginalNames[normalizedName] = izvodjac; // Store first encountered name
                }
                izvodjaciMap[normalizedName] += sjeca;
            });

            console.log('Izvođači grouped (normalized):', izvodjaciMap);

            // Calculate and log total suma
            const totalSuma = Object.values(izvodjaciMap).reduce((sum, val) => sum + val, 0);
            console.log('TOTAL SUMA SVIH IZVOĐAČA:', totalSuma.toFixed(2), 'm³');

            // Sort by volume and use original names for display
            const sorted = Object.entries(izvodjaciMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([normalizedName, volume]) => [izvodjaciOriginalNames[normalizedName], volume]);

            console.log('Top izvođači sorted:', sorted);

            const html = sorted.length > 0
                ? sorted.map(([izvodjac, volume], index) => {
                    const rankClass = index < 3 ? 'top' : '';
                    return `
                        <div class="ranking-item">
                            <div class="ranking-number ${rankClass}">${index + 1}</div>
                            <div class="ranking-info">
                                <div class="ranking-name">${izvodjac}</div>
                                <div class="ranking-value">${volume.toFixed(2)} m³</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka o izvođačima</p>';

            document.getElementById('izvodjaci-performance-list').innerHTML = html;
        }

        // Render Timeline - Zadnji Unosi
        function renderTimelineUnosi(odjeliStats) {
            console.log('renderTimelineUnosi called with:', odjeliStats);
            const timeline = [];

            Object.entries(odjeliStats).forEach(([odjel, stats]) => {
                const zadnjiDatum = stats.zadnjiDatumUnosa || stats.zadnjiUnos || '';
                if (zadnjiDatum) {
                    timeline.push({ odjel, datum: zadnjiDatum });
                }
            });

            console.log('Timeline entries:', timeline);

            // Sort by date (most recent first)
            timeline.sort((a, b) => {
                const dateA = new Date(a.datum.split('.').reverse().join('-'));
                const dateB = new Date(b.datum.split('.').reverse().join('-'));
                return dateB - dateA;
            });

            const html = timeline.length > 0
                ? timeline.slice(0, 10).map(item => {
                    // Calculate days since entry
                    const dateParts = item.datum.split('.');
                    const entryDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
                    const today = new Date();
                    const daysDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));

                    let statusClass = 'fresh';
                    let statusText = 'Svježe';
                    if (daysDiff > 30) {
                        statusClass = 'old';
                        statusText = `${daysDiff} dana`;
                    } else if (daysDiff > 7) {
                        statusClass = 'warning';
                        statusText = `${daysDiff} dana`;
                    } else if (daysDiff > 0) {
                        statusText = `prije ${daysDiff}d`;
                    }

                    return `
                        <div class="timeline-item">
                            <div class="timeline-date">${item.datum}</div>
                            <div class="timeline-content">
                                <div class="timeline-odjel">${item.odjel}</div>
                                <div class="timeline-status ${statusClass}">${statusText}</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nema podataka o unosima</p>';

            document.getElementById('timeline-unosi-list').innerHTML = html;
        }

        // Render Seasonal Analysis (Q1-Q4)
        function renderSeasonalAnalysis(monthlyStats) {
            console.log('renderSeasonalAnalysis called with:', monthlyStats);

            // Define quarters
            const quarters = [
                { name: 'Q1', label: 'Jan-Mar', months: [0, 1, 2], icon: '❄️', color: '#3b82f6' },
                { name: 'Q2', label: 'Apr-Jun', months: [3, 4, 5], icon: '🌸', color: '#10b981' },
                { name: 'Q3', label: 'Jul-Sep', months: [6, 7, 8], icon: '☀️', color: '#f59e0b' },
                { name: 'Q4', label: 'Okt-Dec', months: [9, 10, 11], icon: '🍂', color: '#dc2626' }
            ];

            const html = quarters.map(q => {
                const quarterSjeca = q.months.reduce((sum, monthIdx) => {
                    return sum + (monthlyStats[monthIdx]?.sječa || 0);
                }, 0);

                const quarterOtprema = q.months.reduce((sum, monthIdx) => {
                    return sum + (monthlyStats[monthIdx]?.otprema || 0);
                }, 0);

                return `
                    <div class="kpi-card-small" style="background: linear-gradient(135deg, ${q.color}15 0%, ${q.color}25 100%); border-left-color: ${q.color};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span style="font-size: 28px;">${q.icon}</span>
                            <div style="text-align: right;">
                                <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase;">${q.name}</div>
                                <div style="font-size: 12px; color: #9ca3af;">${q.label}</div>
                            </div>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">Sječa</div>
                            <div style="font-size: 18px; font-weight: 700; color: #059669;">${quarterSjeca.toFixed(0)} m³</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">Otprema</div>
                            <div style="font-size: 18px; font-weight: 700; color: #2563eb;">${quarterOtprema.toFixed(0)} m³</div>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('seasonal-analysis').innerHTML = html;
        }

        // Render Mjesečni Trend Kupaca
        async function renderKupciMjesecniTrend() {
            console.log('renderKupciMjesecniTrend called - fetching data...');

            try {
                const year = new Date().getFullYear();
                const kupciUrl = `${API_URL}?path=otpremaci&year=${year}&username=${currentUser.username}&password=${currentPassword}`;
                const kupciData = await fetchWithCache(kupciUrl, 'cache_kupci_' + year);

                console.log('Kupci mjesecni data:', kupciData);

                if (!kupciData || !kupciData.mjesecni) {
                    document.getElementById('kupci-mjesecni-tbody').innerHTML = '<tr><td colspan="14" style="text-align: center; color: #6b7280;">Nema podataka</td></tr>';
                    return;
                }

                // Group mjesecni by kupac
                const kupciMap = {};
                kupciData.mjesecni.forEach(entry => {
                    const kupac = entry.kupac || 'Nepoznat';
                    const mjesec = entry.mjesec; // 0-11
                    const ukupno = entry.ukupno || 0;

                    if (!kupciMap[kupac]) {
                        kupciMap[kupac] = new Array(12).fill(0);
                    }
                    kupciMap[kupac][mjesec] = ukupno;
                });

                // Calculate total per kupac and sort
                const kupciArray = Object.entries(kupciMap).map(([kupac, mjeseci]) => {
                    const total = mjeseci.reduce((sum, val) => sum + val, 0);
                    return { kupac, mjeseci, total };
                }).sort((a, b) => b.total - a.total).slice(0, 15); // Top 15 kupaca

                console.log('Top 15 kupaca mjesečno:', kupciArray);

                const html = kupciArray.map(k => {
                    return `
                        <tr>
                            <td style="font-weight: 500;">${k.kupac}</td>
                            ${k.mjeseci.map(val => {
                                const display = val > 0 ? val.toFixed(0) : '-';
                                const color = val > 1000 ? 'color: #059669; font-weight: 600;' : '';
                                return `<td class="right" style="${color}">${display}</td>`;
                            }).join('')}
                            <td class="right" style="font-weight: 700; color: #1f2937;">${k.total.toFixed(0)}</td>
                        </tr>
                    `;
                }).join('');

                document.getElementById('kupci-mjesecni-tbody').innerHTML = html || '<tr><td colspan="14" style="text-align: center; color: #6b7280;">Nema podataka</td></tr>';
            } catch (error) {
                console.error('Error loading kupci mjesecni trend:', error);
                document.getElementById('kupci-mjesecni-tbody').innerHTML = '<tr><td colspan="14" style="text-align: center; color: #dc2626;">Greška pri učitavanju</td></tr>';
            }
        }

        // Filter analytics table by search
        function filterAnalyticsTable() {
            const searchValue = document.getElementById('analytics-search').value.toLowerCase();
            const table = document.getElementById('analytics-odjeli-main-table');
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
                const odjelName = row.cells[0].textContent.toLowerCase();
                if (odjelName.includes(searchValue)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

