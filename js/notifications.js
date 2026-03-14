        // ========== BROWSER NOTIFICATIONS MODULE ==========
        // Koristi Notification API za obavijesti o novim podacima
        // Integrira se sa data-sync.js putem window.onDataSyncUpdate hook-a

        const NotificationManager = (function() {
            const STORAGE_KEY = 'notification_prefs';
            const COOLDOWN_KEY = 'notification_last_sent';
            const COOLDOWN_MS = 5 * 60 * 1000; // Min 5 min između notifikacija

            // Default preferences
            const defaultPrefs = {
                enabled: false,
                novaPrimka: true,
                novaOtprema: true,
                sound: false
            };

            function getPrefs() {
                try {
                    const saved = localStorage.getItem(STORAGE_KEY);
                    return saved ? { ...defaultPrefs, ...JSON.parse(saved) } : { ...defaultPrefs };
                } catch (e) {
                    return { ...defaultPrefs };
                }
            }

            function savePrefs(prefs) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
            }

            function isSupported() {
                return 'Notification' in window;
            }

            function getPermission() {
                if (!isSupported()) return 'unsupported';
                return Notification.permission; // 'granted', 'denied', 'default'
            }

            async function requestPermission() {
                if (!isSupported()) return 'unsupported';
                const result = await Notification.requestPermission();
                return result;
            }

            function isInCooldown() {
                const last = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
                return (Date.now() - last) < COOLDOWN_MS;
            }

            function markSent() {
                localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
            }

            async function sendNotification(title, body, tag) {
                const prefs = getPrefs();
                if (!prefs.enabled) return;
                if (getPermission() !== 'granted') return;
                if (isInCooldown()) {
                    console.log('[NOTIF] Cooldown active, skipping');
                    return;
                }

                try {
                    // Try service worker notification (works in background tabs)
                    const reg = await navigator.serviceWorker.getRegistration();
                    if (reg) {
                        await reg.showNotification(title, {
                            body: body,
                            icon: '/icon-192.png',
                            badge: '/favicon.png',
                            tag: tag || 'sumarija-update',
                            renotify: true,
                            data: { url: '/' }
                        });
                    } else {
                        // Fallback to basic Notification
                        new Notification(title, {
                            body: body,
                            icon: '/icon-192.png',
                            tag: tag || 'sumarija-update'
                        });
                    }
                    markSent();
                    console.log(`[NOTIF] Sent: ${title}`);
                } catch (e) {
                    console.error('[NOTIF] Failed to send:', e);
                }
            }

            // Handle data sync update - called from data-sync.js
            function handleSyncUpdate(result) {
                if (!result || !result.updated) return;

                const prefs = getPrefs();
                if (!prefs.enabled) return;

                const parts = [];
                if (result.updatedPrimka && prefs.novaPrimka) {
                    parts.push('nova sječa');
                }
                if (result.updatedOtprema && prefs.novaOtprema) {
                    parts.push('nova otprema');
                }

                if (parts.length === 0) return;

                const rows = result.newRowsCount || 0;
                const title = 'Novi podaci';
                const body = `Uneseno ${rows} ${rows === 1 ? 'novi zapis' : 'novih zapisa'} (${parts.join(', ')})`;

                sendNotification(title, body, 'sync-update');
            }

            // Enable/disable notifications with permission request
            async function toggle(enable) {
                const prefs = getPrefs();

                if (enable) {
                    const permission = await requestPermission();
                    if (permission === 'granted') {
                        prefs.enabled = true;
                        savePrefs(prefs);
                        showSuccess('Notifikacije', 'Obavijesti su uključene');
                        return true;
                    } else if (permission === 'denied') {
                        prefs.enabled = false;
                        savePrefs(prefs);
                        showWarning('Notifikacije blokirane', 'Dozvolite notifikacije u postavkama browsera');
                        return false;
                    } else {
                        return false;
                    }
                } else {
                    prefs.enabled = false;
                    savePrefs(prefs);
                    showInfo('Notifikacije', 'Obavijesti su isključene');
                    return false;
                }
            }

            function updatePref(key, value) {
                const prefs = getPrefs();
                prefs[key] = value;
                savePrefs(prefs);
            }

            // Update UI toggle state
            function syncUI() {
                const prefs = getPrefs();
                const toggle = document.getElementById('notif-toggle');
                const panel = document.getElementById('notif-options-panel');
                const primkaCheck = document.getElementById('notif-primka');
                const otpremaCheck = document.getElementById('notif-otprema');

                if (toggle) toggle.checked = prefs.enabled;
                if (panel) panel.style.display = prefs.enabled ? 'block' : 'none';
                if (primkaCheck) primkaCheck.checked = prefs.novaPrimka;
                if (otpremaCheck) otpremaCheck.checked = prefs.novaOtprema;
            }

            return {
                getPrefs,
                isSupported,
                getPermission,
                toggle,
                updatePref,
                handleSyncUpdate,
                sendNotification,
                syncUI
            };
        })();

        // Wire up to data-sync hook
        window.onDataSyncUpdate = function(result) {
            NotificationManager.handleSyncUpdate(result);
        };

        // ========== UI GLUE FUNCTIONS ==========

        function toggleNotifPanel() {
            closeUserMenu();
            var overlay = document.getElementById('notif-settings-overlay');
            if (overlay) {
                overlay.style.display = 'flex';
                NotificationManager.syncUI();
                // Show denied message if blocked
                var deniedMsg = document.getElementById('notif-denied-msg');
                if (deniedMsg) {
                    deniedMsg.style.display = NotificationManager.getPermission() === 'denied' ? 'block' : 'none';
                }
            }
        }

        function closeNotifPanel() {
            var overlay = document.getElementById('notif-settings-overlay');
            if (overlay) overlay.style.display = 'none';
        }

        async function handleNotifToggle(checked) {
            var enabled = await NotificationManager.toggle(checked);
            // Update toggle visual
            var toggle = document.getElementById('notif-toggle');
            var knob = document.getElementById('notif-toggle-knob');
            var panel = document.getElementById('notif-options-panel');
            if (toggle) toggle.checked = enabled;
            if (knob) {
                knob.style.left = enabled ? '23px' : '3px';
                knob.parentElement.previousElementSibling.nextElementSibling.style.background = enabled ? '#059669' : '#ccc';
            }
            if (panel) panel.style.display = enabled ? 'block' : 'none';
            updateNotifBadge(enabled);
            // Show denied message
            var deniedMsg = document.getElementById('notif-denied-msg');
            if (deniedMsg) {
                deniedMsg.style.display = NotificationManager.getPermission() === 'denied' ? 'block' : 'none';
            }
        }

        function updateNotifBadge(enabled) {
            var badge = document.getElementById('notif-status-badge');
            if (badge) {
                badge.textContent = enabled ? 'ON' : 'OFF';
                badge.style.background = enabled ? '#d1fae5' : '#e5e7eb';
                badge.style.color = enabled ? '#059669' : '#6b7280';
            }
        }

        // Initialize notification UI after login
        function initNotificationUI() {
            if (!NotificationManager.isSupported()) return;
            var menuItem = document.getElementById('notif-menu-item');
            if (menuItem) menuItem.style.display = '';
            var prefs = NotificationManager.getPrefs();
            updateNotifBadge(prefs.enabled);
        }

        console.log('[NOTIF] Notifications module loaded');
