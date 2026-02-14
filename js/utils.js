        // ========== SORTIMENTI ORDER - BUSINESS LOGIC ==========
        // Fixed order for sortimenti as per business requirements (20 sortimenta)
        const SORTIMENTI_ORDER = [
            "F/L Č", "I Č", "II Č", "III Č", "RD", "TRUPCI Č",
            "CEL.DUGA", "CEL.CIJEPANA", "ŠKART", "Σ ČETINARI",
            "F/L L", "I L", "II L", "III L", "TRUPCI L",
            "OGR.DUGI", "OGR.CIJEPANI", "GULE", "LIŠĆARI", "UKUPNO Č+L"
        ];

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
