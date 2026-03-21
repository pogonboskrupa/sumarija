        // ========== UI MODULE ==========
        // Navigation (switchTab, sub-menus), filters, sorting, toggles

        // Prati kada je svaki tab zadnji put renderovan
        window._tabRenderTime = window._tabRenderTime || {};
        function markTabRendered(tab) {
            window._tabRenderTime[tab] = Date.now();
        }

        // Switch between tabs
        function switchTab(tab) {
            // Prati aktivni tab za sprečavanje bleeding-a kod async operacija
            window.currentTab = tab;

            // Update tab buttons - set active on all matching tabs (sidebar + mobile)
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

            // Find and activate tabs that switch to this tab (works for both sidebar and mobile)
            document.querySelectorAll(`.tab[onclick*="'${tab}'"]`).forEach(t => t.classList.add('active'));

            // Provjeri može li se tab prikazati iz prethodno renderovanog DOM-a
            // (preskoči fetch/render ako su podaci još svježi)
            const tabContentMap = {
                'dashboard': 'dashboard-content',
                'operativa': 'operativa-content',
                'primaci': 'primaci-content',
                'otpremaci': 'otpremaci-content',
                'kupci': 'kupci-content',
                'primac-personal': 'primac-personal-content',
                'primac-godisnji': 'primac-godisnji-content',
                'otpremac-personal': 'otpremac-personal-content',
                'otpremac-godisnji': 'otpremac-godisnji-content',
                'primac-odjeli': 'primac-odjeli-content',
                'otpremac-odjeli': 'otpremac-odjeli-content',
                'my-sjece': 'my-sjece-content',
                'my-otpreme': 'my-otpreme-content',
                'pending-unosi': 'pending-unosi-content',
                'mjesecni-sortimenti': 'mjesecni-sortimenti-content',
                'dinamika': 'dinamika-content',
                'poslovodja-stanje': 'poslovodja-stanje-content',
                'poslovodja-sjeca': 'poslovodja-sjeca-content',
                'poslovodja-otprema': 'poslovodja-otprema-content',
                'poslovodja-pregled': 'poslovodja-pregled-content',
                'poslovodja-unosi': 'poslovodja-unosi-content',
                'stanje-zaliha': 'stanje-zaliha-content',
                'primaci-admin': 'primaci-admin-content',
                'izvjestaji': 'izvjestaji-content',
                'izvjestaji-primac': 'izvjestaji-primac-content',
                'izvjestaji-otpremac': 'izvjestaji-otpremac-content',
                'kubikator': 'kubikator-content',
                'ostalo': 'ostalo-content',
            };
            const ttl = (typeof getSmartCacheTTL === 'function') ? getSmartCacheTTL() : 60000;
            const lastRender = window._tabRenderTime[tab];
            const contentId = tabContentMap[tab];
            if (contentId) {
                const el = document.getElementById(contentId);
                if (el && el.children.length > 0) {
                    // INSTANT: Uvijek prikaži postojeći DOM odmah (bez loading screen-a)
                    document.querySelectorAll('[id$="-content"]').forEach(c => c.classList.add('hidden'));
                    el.classList.remove('hidden');
                    document.getElementById('loading-screen').classList.add('hidden');
                    // Ako je cache još svjež, ne treba ponovo učitavati
                    if (lastRender && (Date.now() - lastRender) < ttl) {
                        return;
                    }
                    // Cache je star - osvježi u pozadini bez loading screen-a
                    // (korisnik već vidi podatke, refresh će ažurirati tiho)
                }
            }

            // Hide all content sections
            document.querySelectorAll('[id$="-content"]').forEach(c => c.classList.add('hidden'));

            // Load appropriate content
            if (tab === 'dashboard') {
                loadDashboard();
            } else if (tab === 'operativa') {
                loadOperativa();
            } else if (tab === 'primaci') {
                loadPrimaci();
                loadPrimaciDaily();
            } else if (tab === 'otpremaci') {
                loadOtpremaci();
                loadOtremaciDaily();
            } else if (tab === 'kupci') {
                loadKupci();
            } else if (tab === 'primac-personal') {
                loadPrimacPersonal();
            } else if (tab === 'primac-godisnji') {
                loadPrimacGodisnji();
                document.getElementById('primac-godisnji-content').classList.remove('hidden');
            } else if (tab === 'otpremac-personal') {
                loadOtpremacPersonal();
            } else if (tab === 'otpremac-godisnji') {
                loadOtpremacGodisnji();
                document.getElementById('otpremac-godisnji-content').classList.remove('hidden');
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
            } else if (tab === 'dinamika') {
                loadDinamika();
            } else if (tab === 'poslovodja-stanje') {
                loadPoslovodjaStanje();
            } else if (tab === 'poslovodja-sjeca') {
                loadPoslovodjaSjeca();
            } else if (tab === 'poslovodja-otprema') {
                loadPoslovodjaOtprema();
            } else if (tab === 'poslovodja-pregled') {
                loadPoslovodjaPregled();
            } else if (tab === 'poslovodja-unosi') {
                loadPoslovodjaUnosi();
            } else if (tab === 'izvjestaji') {
                // IZVJEŠTAJI - Sedmični i Mjesečni prikaz po odjelima
                document.getElementById('izvjestaji-content').classList.remove('hidden');
                switchIzvjestajiSubTab('sedmicni'); // Default: Sedmični izvještaj
            } else if (tab === 'izvjestaji-primac') {
                // Set default to current month/year
                const currentDate = new Date();
                document.getElementById('primac-sedmicni-year').value = currentDate.getFullYear();
                document.getElementById('primac-sedmicni-month').value = currentDate.getMonth();
                document.getElementById('primac-mjesecni-year').value = currentDate.getFullYear();
                document.getElementById('primac-mjesecni-month').value = currentDate.getMonth();

                document.getElementById('izvjestaji-primac-content').classList.remove('hidden');
                switchPrimacIzvjestajiSubTab('sedmicni');
            } else if (tab === 'izvjestaji-otpremac') {
                // Set default to current month/year
                const currentDate = new Date();
                document.getElementById('otpremac-sedmicni-year').value = currentDate.getFullYear();
                document.getElementById('otpremac-sedmicni-month').value = currentDate.getMonth();
                document.getElementById('otpremac-mjesecni-year').value = currentDate.getFullYear();
                document.getElementById('otpremac-mjesecni-month').value = currentDate.getMonth();

                document.getElementById('izvjestaji-otpremac-content').classList.remove('hidden');
                switchOtpremacIzvjestajiSubTab('sedmicni');
            } else if (tab === 'kubikator') {
                document.getElementById('kubikator-content').classList.remove('hidden');
            } else if (tab === 'ostalo') {
                document.getElementById('ostalo-content').classList.remove('hidden');
                // Load kubikator by default (najbitniji podmeni)
                switchOstaloTab('kubikator');
            } else if (tab === 'stanje-zaliha') {
                loadStanjeZaliha();
            } else if (tab === 'primaci-admin') {
                loadPrimaciAdminTab();
            }
        }

        // Switch between Ostalo tabs - samo Kubikator
        function switchOstaloTab(view) {
            // Kubikator je jedini view
            document.getElementById('ostalo-kubikator-view').classList.remove('hidden');
        }

        // Switch between Stanje Odjela tabs (Pregled Stanja / Šuma Lager)
        function switchStanjeOdjelaTab(view) {
            // Update submenu buttons
            const tabs = document.querySelectorAll('#stanje-odjela-admin-content .tabs-submenu .tab-sub');
            tabs.forEach(t => t.classList.remove('active'));
            if (event && event.target) {
                event.target.classList.add('active');
            } else {
                // If called programmatically, set the active tab based on view
                tabs.forEach(t => {
                    if ((view === 'pregled' && t.textContent.includes('Pregled')) ||
                        (view === 'suma-lager' && t.textContent.includes('Lager'))) {
                        t.classList.add('active');
                    }
                });
            }

            // Hide all stanje views
            document.getElementById('stanje-pregled-view').classList.add('hidden');
            document.getElementById('stanje-suma-lager-view').classList.add('hidden');

            // Show selected view and load data
            if (view === 'pregled') {
                document.getElementById('stanje-pregled-view').classList.remove('hidden');
                loadAdminStanjeOdjela();
            } else if (view === 'suma-lager') {
                document.getElementById('stanje-suma-lager-view').classList.remove('hidden');
                loadSumaLager();
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
            document.getElementById('primaci-sortimenti-primac-view').classList.add('hidden');

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
            } else if (view === 'sortimenti-by-primac') {
                document.getElementById('primaci-sortimenti-primac-view').classList.remove('hidden');
                // Load on first open with current month as default
                const container = document.getElementById('primaci-sortimenti-primac-container');
                if (!container.innerHTML) {
                    const currentMonth = new Date().getMonth();
                    document.getElementById('primaci-sortimenti-month-select').value = currentMonth;
                    loadPrimaciSortimentiByPrimac(currentMonth);
                }
            }
        }

        // Switch between primaci-admin submenus (Admin: Primači na šuma panju)
        function switchPrimaciAdminSubmenu(view) {
            // Update submenu buttons
            var submenuTabs = document.querySelectorAll('#primaci-admin-content .submenu-tab');
            submenuTabs.forEach(function(tab) { tab.classList.remove('active'); });
            if (event && event.target) event.target.classList.add('active');

            // Hide all submenu content
            document.getElementById('primaci-admin-pregled-view').classList.add('hidden');
            document.getElementById('primaci-admin-godisnji-view').classList.add('hidden');
            document.getElementById('primaci-admin-odjeli-view').classList.add('hidden');

            var primacName = document.getElementById('primaci-admin-select').value;
            if (!primacName) return;

            if (view === 'pregled') {
                document.getElementById('primaci-admin-pregled-view').classList.remove('hidden');
                // Data already loaded from initial select
            } else if (view === 'godisnji') {
                document.getElementById('primaci-admin-godisnji-view').classList.remove('hidden');
                // Load only if not already rendered
                if (!document.getElementById('primaci-admin-godisnji-header').innerHTML) {
                    loadPrimaciAdminGodisnji();
                }
            } else if (view === 'odjeli') {
                document.getElementById('primaci-admin-odjeli-view').classList.remove('hidden');
                // Load only if not already rendered
                if (!document.getElementById('primaci-admin-odjeli-container').innerHTML) {
                    loadPrimaciAdminOdjeli();
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
            document.getElementById('otpremaci-sortimenti-otpremac-view').classList.add('hidden');

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
            } else if (view === 'sortimenti-by-otpremac') {
                document.getElementById('otpremaci-sortimenti-otpremac-view').classList.remove('hidden');
                const container = document.getElementById('otpremaci-sortimenti-otpremac-container');
                if (!container.innerHTML) {
                    const currentMonth = new Date().getMonth();
                    document.getElementById('otpremaci-sortimenti-month-select').value = currentMonth;
                    loadOtremaciSortimentiByOtpremac(currentMonth);
                }
            }
        }

        // Switch between kupci submenus
        function switchKupciSubmenu(view) {
            // Update submenu buttons
            const submenuTabs = document.querySelectorAll('#kupci-content .submenu-tab');
            submenuTabs.forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');

            // Hide all submenu content
            document.getElementById('kupci-godisnji-view').classList.add('hidden');
            document.getElementById('kupci-mjesecni-view').classList.add('hidden');
            document.getElementById('kupci-kvartalni-view').classList.add('hidden');

            // Show selected view
            if (view === 'godisnji') {
                document.getElementById('kupci-godisnji-view').classList.remove('hidden');
            } else if (view === 'mjesecni') {
                document.getElementById('kupci-mjesecni-view').classList.remove('hidden');
            } else if (view === 'kvartalni') {
                document.getElementById('kupci-kvartalni-view').classList.remove('hidden');
                // Auto-select current quarter
                const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
                document.getElementById('kupci-kvartalni-select').value = currentQuarter;
                renderKupciKvartalniTable();
            }
        }

        // UTILITY FUNCTIONS
        // ========================================


        // Desktop view toggle
        function toggleDesktopView() {
            // Turn off Android view if active
            if (document.body.classList.contains('force-android-view')) {
                document.body.classList.remove('force-android-view');
                localStorage.setItem('android-view', 'disabled');
                var aBtn = document.getElementById('android-view-btn');
                if (aBtn) { aBtn.classList.remove('active'); aBtn.title = 'Prebaci na Android prikaz'; }
            }

            document.body.classList.toggle('force-desktop-view');
            var isDesktopView = document.body.classList.contains('force-desktop-view');
            localStorage.setItem('desktop-view', isDesktopView ? 'enabled' : 'disabled');

            var btn = document.getElementById('desktop-view-btn');
            if (btn) {
                if (isDesktopView) {
                    btn.classList.add('active');
                    btn.title = 'Prebaci na mobilni prikaz';
                } else {
                    btn.classList.remove('active');
                    btn.title = 'Prebaci na desktop prikaz';
                }
            }

            var viewport = document.querySelector('meta[name=viewport]');
            if (isDesktopView) {
                viewport.setAttribute('content', 'width=1200, initial-scale=0.5, user-scalable=yes');
            } else {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
            }

            window.scrollTo(0, 0);
        }

        function toggleAndroidView() {
            // Turn off Desktop view if active
            if (document.body.classList.contains('force-desktop-view')) {
                document.body.classList.remove('force-desktop-view');
                localStorage.setItem('desktop-view', 'disabled');
                var dBtn = document.getElementById('desktop-view-btn');
                if (dBtn) { dBtn.classList.remove('active'); dBtn.title = 'Prebaci na desktop prikaz'; }
            }

            document.body.classList.toggle('force-android-view');
            var isAndroid = document.body.classList.contains('force-android-view');
            localStorage.setItem('android-view', isAndroid ? 'enabled' : 'disabled');

            var btn = document.getElementById('android-view-btn');
            if (btn) {
                if (isAndroid) {
                    btn.classList.add('active');
                    btn.title = 'Isključi Android prikaz';
                } else {
                    btn.classList.remove('active');
                    btn.title = 'Prebaci na Android prikaz';
                }
            }

            var viewport = document.querySelector('meta[name=viewport]');
            if (isAndroid) {
                viewport.setAttribute('content', 'width=1200, initial-scale=0.5, user-scalable=yes');
            } else {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
            }

            window.scrollTo(0, 0);
        }

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

        // Filter Primaci Admin table by odjel
        function filterPrimaciAdminTable() {
            var input = document.getElementById('primaci-admin-search');
            var filter = input.value.toUpperCase();
            var table = document.getElementById('primaci-admin-table');
            var tr = table.getElementsByTagName('tr');
            for (var i = 1; i < tr.length; i++) {
                var td = tr[i].getElementsByTagName('td')[1]; // Odjel kolona
                if (td) {
                    var txtValue = td.textContent || td.innerText;
                    tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
                }
            }
        }


