        // ========== CHARTS MODULE ==========
        // Dashboard daily chart, worker monthly charts, uporedba godina

        // ========================================
        // DASHBOARD DAILY CHART - Dnevni pregled sječe i otpreme
        // ========================================
        let dashboardDailyChart = null;

        async function loadDashboardDailyChart() {
            const monthSelect = document.getElementById('dashboard-daily-month-select');
            const selectedMonth = parseInt(monthSelect.value);
            const year = new Date().getFullYear();
            const canvas = document.getElementById('dashboardDailyChart');

            if (!canvas) return;

            try {
                // Show loading state on canvas
                const ctx = canvas.getContext('2d');
                if (dashboardDailyChart) {
                    dashboardDailyChart.destroy();
                }

                // Ensure Chart.js is loaded
                await window.loadChartJs();

                // Fetch pre-aggregated daily data from new endpoint
                const response = await fetch(buildApiUrl('daily-chart', { year, month: selectedMonth }));
                const chartData = await response.json();

                if (chartData.error) {
                    console.error('Daily chart API error:', chartData.error);
                    return;
                }

                // Extract data from response
                const dailyData = chartData.data || [];

                // Create labels and data arrays
                const labels = [];
                const sjecaValues = [];
                const otpremaValues = [];

                dailyData.forEach(entry => {
                    labels.push(entry.day);
                    sjecaValues.push(entry.sjeca || 0);
                    otpremaValues.push(entry.otprema || 0);
                });

                // Month names for title
                const monthNames = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
                                   'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

                // Create smooth line chart
                dashboardDailyChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Sječa (m³)',
                            data: sjecaValues,
                            borderColor: '#059669',
                            backgroundColor: 'rgba(5, 150, 105, 0.15)',
                            borderWidth: 3,
                            tension: 0.4, // Smooth curve
                            fill: true,
                            pointRadius: 4,
                            pointBackgroundColor: '#059669',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointHoverRadius: 6
                        }, {
                            label: 'Otprema (m³)',
                            data: otpremaValues,
                            borderColor: '#dc2626',
                            backgroundColor: 'rgba(220, 38, 38, 0.15)',
                            borderWidth: 3,
                            tension: 0.4, // Smooth curve
                            fill: true,
                            pointRadius: 4,
                            pointBackgroundColor: '#dc2626',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    font: {
                                        family: "'Inter', sans-serif",
                                        size: 13,
                                        weight: '600'
                                    },
                                    padding: 20,
                                    usePointStyle: true,
                                    pointStyle: 'circle'
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                titleFont: {
                                    family: "'Inter', sans-serif",
                                    size: 14,
                                    weight: '700'
                                },
                                bodyFont: {
                                    family: "'Inter', sans-serif",
                                    size: 13,
                                    weight: '600'
                                },
                                padding: 12,
                                cornerRadius: 8,
                                callbacks: {
                                    title: function(tooltipItems) {
                                        const day = tooltipItems[0].label;
                                        const dayStr = day.toString().padStart(2, '0');
                                        const monthStr = (selectedMonth + 1).toString().padStart(2, '0');
                                        return dayStr + '.' + monthStr + '.' + year;
                                    },
                                    label: function(context) {
                                        return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + ' m³';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'Dan u mjesecu',
                                    font: {
                                        family: "'Inter', sans-serif",
                                        size: 12,
                                        weight: '600'
                                    }
                                },
                                ticks: {
                                    font: {
                                        family: "'Inter', sans-serif",
                                        size: 11,
                                        weight: '600'
                                    }
                                },
                                grid: {
                                    display: false
                                }
                            },
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'm³',
                                    font: {
                                        family: "'Inter', sans-serif",
                                        size: 12,
                                        weight: '600'
                                    }
                                },
                                ticks: {
                                    font: {
                                        family: "'Inter', sans-serif",
                                        size: 11,
                                        weight: '700'
                                    },
                                    callback: function(value) {
                                        return value.toFixed(0);
                                    }
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.05)'
                                }
                            }
                        }
                    }
                });

            } catch (error) {
                console.error('Error loading daily chart:', error);
            }
        }


        // ========================================
        // WORKER MONTHLY CHART
        // ========================================

        let primacChart = null;
        let otpremacChart = null;
        let primacDailyChart = null;
        let otpremacDailyChart = null;
        let primacYearlyChart = null;
        let otpremacYearlyChart = null;

        async function createWorkerMonthlyChart(canvasId, unosi, colorPrimary, colorSecondary) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            // 🚀 KRITIČNO: Učitaj Chart.js PRE korištenja
            await window.loadChartJs();

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

        // Create daily chart (shows total quantity per day for selected month)
        async function createWorkerDailyChart(canvasId, unosi, month, year, colorPrimary, colorSecondary) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            // 🚀 KRITIČNO: Učitaj Chart.js PRE korištenja
            await window.loadChartJs();

            // Destroy existing chart if exists
            if (canvasId === 'primac-daily-chart' && primacDailyChart) {
                primacDailyChart.destroy();
            }
            if (canvasId === 'otpremac-daily-chart' && otpremacDailyChart) {
                otpremacDailyChart.destroy();
            }

            // Filter by selected month
            const filteredUnosi = unosi.filter(u => {
                const dateParts = u.datum.split('.');
                if (dateParts.length >= 2) {
                    const recordMonth = parseInt(dateParts[1]);
                    return recordMonth === parseInt(month);
                }
                return false;
            });

            // Group by day
            const dailyData = {};
            filteredUnosi.forEach(u => {
                const dateParts = u.datum.split('.');
                if (dateParts.length >= 3) {
                    const day = parseInt(dateParts[0]);
                    if (!dailyData[day]) {
                        dailyData[day] = 0;
                    }
                    dailyData[day] += u.ukupno || 0;
                }
            });

            // Get days in month
            const daysInMonth = new Date(year, month, 0).getDate();

            // Prepare data for chart - only days with data
            const labels = [];
            const values = [];

            for (let day = 1; day <= daysInMonth; day++) {
                if (dailyData[day] && dailyData[day] > 0) {
                    labels.push(day + '.');
                    values.push(dailyData[day]);
                }
            }

            // If no data, show message
            if (values.length === 0) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '16px sans-serif';
                ctx.fillStyle = '#6b7280';
                ctx.textAlign = 'center';
                ctx.fillText('Nema podataka za izabrani mjesec', canvas.width / 2, canvas.height / 2);
                return;
            }

            // Create gradient for fill
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, colorPrimary + '33'); // 20% opacity
            gradient.addColorStop(1, colorSecondary + '11'); // 7% opacity

            // Create smooth line chart
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Količina (m³)',
                        data: values,
                        backgroundColor: gradient,
                        borderColor: colorPrimary,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointBackgroundColor: colorPrimary,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: colorPrimary,
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 3,
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
                                    size: 11,
                                    weight: '600'
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
            if (canvasId === 'primac-daily-chart') {
                primacDailyChart = chart;
            } else if (canvasId === 'otpremac-daily-chart') {
                otpremacDailyChart = chart;
            }
        }

        // Create yearly chart (shows total quantity per month)
        async function createWorkerYearlyChart(canvasId, unosi, colorPrimary, colorSecondary) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            // 🚀 KRITIČNO: Učitaj Chart.js PRE korištenja
            await window.loadChartJs();

            // Destroy existing chart if exists
            if (canvasId === 'primac-yearly-chart' && primacYearlyChart) {
                primacYearlyChart.destroy();
            }
            if (canvasId === 'otpremac-yearly-chart' && otpremacYearlyChart) {
                otpremacYearlyChart.destroy();
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
            if (canvasId === 'primac-yearly-chart') {
                primacYearlyChart = chart;
            } else if (canvasId === 'otpremac-yearly-chart') {
                otpremacYearlyChart = chart;
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
                // Get year from selector, default to current year
                const yearSelector = document.getElementById('primac-godisnji-year-select');
                const year = yearSelector ? yearSelector.value : new Date().getFullYear();

                // Update badge
                const badge = document.getElementById('primac-godisnji-year-badge');
                if (badge) badge.textContent = year;

                const url = buildApiUrl('primac-detail', { year });
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

                // Create yearly chart
                await createWorkerYearlyChart('primac-yearly-chart', data.unosi, '#047857', '#10b981');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju godišnjeg prikaza: ' + error.message);
            }
        }

        // Load primac personal data
        async function loadPrimacPersonal() {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('primac-personal-content').classList.add('hidden');

            try {
                // ✅ Čitaj godinu iz selectora umjesto hardkodovane trenutne godine
                const yearSelector = document.getElementById('primac-personal-year-select');
                const year = yearSelector ? yearSelector.value : new Date().getFullYear();

                const url = buildApiUrl('primac-detail', { year });
                const data = await fetchWithCache(url, 'cache_primac_detail_' + year);


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
                await createWorkerMonthlyChart('primac-chart', data.unosi, '#047857', '#10b981');

                // Create daily chart - read month from selector, default to current month
                const monthSelector = document.getElementById('primac-daily-month-select');
                const currentMonth = new Date().getMonth() + 1;

                // Set default value to current month if not already set
                if (monthSelector && !monthSelector.value) {
                    monthSelector.value = currentMonth;
                }

                const selectedMonth = monthSelector ? monthSelector.value : currentMonth;
                await createWorkerDailyChart('primac-daily-chart', data.unosi, selectedMonth, year, '#047857', '#10b981');

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
                // ✅ Čitaj godinu iz selectora umjesto hardkodovane trenutne godine
                const yearSelector = document.getElementById('otpremac-personal-year-select');
                const year = yearSelector ? yearSelector.value : new Date().getFullYear();

                const url = buildApiUrl('otpremac-detail', { year });
                const data = await fetchWithCache(url, 'cache_otpremac_detail_' + year);


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
                await createWorkerMonthlyChart('otpremac-chart', data.unosi, '#1e40af', '#3b82f6');

                // Create daily chart - read month from selector, default to current month
                const monthSelector = document.getElementById('otpremac-daily-month-select');
                const currentMonth = new Date().getMonth() + 1;

                // Set default value to current month if not already set
                if (monthSelector && !monthSelector.value) {
                    monthSelector.value = currentMonth;
                }

                const selectedMonth = monthSelector ? monthSelector.value : currentMonth;
                await createWorkerDailyChart('otpremac-daily-chart', data.unosi, selectedMonth, year, '#1e40af', '#3b82f6');

                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('otpremac-personal-content').classList.remove('hidden');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju podataka: ' + error.message);
                document.getElementById('loading-screen').innerHTML = '<div class="loading-icon">❌</div><div class="loading-text">Greška pri učitavanju</div><div class="loading-sub">' + error.message + '</div>';
            }
        }


        // ============================================
        // UPOREDBA GODINA FUNKCIJE
        // ============================================

        // Load uporedba godina
        async function loadUporedbaGodina() {

            const year1 = parseInt(document.getElementById('uporedba-year1').value);
            const year2 = parseInt(document.getElementById('uporedba-year2').value);


            try {
                showInfo('🔄 Učitavanje...', 'Učitavam podatke za usporedbu...');

                // Fetch dashboard data za obje godine (paralelno, 60s timeout for heavy endpoints)
                const url1 = buildApiUrl('dashboard', { year: year1 });
                const url2 = buildApiUrl('dashboard', { year: year2 });

                const [data1, data2] = await Promise.all([
                    fetchWithCache(url1, 'cache_dashboard_' + year1, false, 60000),
                    fetchWithCache(url2, 'cache_dashboard_' + year2, false, 60000)
                ]);


                if (data1.error || data2.error) {
                    throw new Error(data1.error || data2.error);
                }

                // Renderuj graf
                const mjeseci = data1.mjesecnaStatistika || [];
                const labels = mjeseci.map(m => m.mjesec);
                const sjeca1 = mjeseci.map(m => m.sjeca);
                const otprema1 = mjeseci.map(m => m.otprema);

                const mjeseci2 = data2.mjesecnaStatistika || [];
                const sjeca2 = mjeseci2.map(m => m.sjeca);
                const otprema2 = mjeseci2.map(m => m.otprema);

                const ctx = document.getElementById('uporedba-chart');
                if (window.uporedbaChart) {
                    window.uporedbaChart.destroy();
                }
                window.uporedbaChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: `Sječa ${year1}`,
                            data: sjeca1,
                            backgroundColor: 'rgba(5, 150, 105, 0.5)',
                            borderColor: '#059669',
                            borderWidth: 2
                        }, {
                            label: `Sječa ${year2}`,
                            data: sjeca2,
                            backgroundColor: 'rgba(5, 150, 105, 0.2)',
                            borderColor: '#047857',
                            borderWidth: 2,
                            borderDash: [5, 5]
                        }, {
                            label: `Otprema ${year1}`,
                            data: otprema1,
                            backgroundColor: 'rgba(37, 99, 235, 0.5)',
                            borderColor: '#2563eb',
                            borderWidth: 2
                        }, {
                            label: `Otprema ${year2}`,
                            data: otprema2,
                            backgroundColor: 'rgba(37, 99, 235, 0.2)',
                            borderColor: '#1d4ed8',
                            borderWidth: 2,
                            borderDash: [5, 5]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                callbacks: {
                                    label: function(context) {
                                        return context.dataset.label + ': ' + context.parsed.y.toFixed(0) + ' m³';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return value + ' m³';
                                    }
                                }
                            }
                        }
                    }
                });

                hideInfo();

            } catch (error) {
                console.error('Error loading uporedba:', error);
                showError('Greška', 'Greška pri učitavanju usporedbe: ' + error.message);
            }
        }

        // Render mjesečna usporedba
        function renderMjesecnaUporedba(data1, data2, year1, year2) {
            const headerElem = document.getElementById('uporedba-mjesecna-header');
            const bodyElem = document.getElementById('uporedba-mjesecna-body');
            const footerElem = document.getElementById('uporedba-mjesecna-footer');

            const mjeseci1 = data1.mjesecniPregled || [];
            const mjeseci2 = data2.mjesecniPregled || [];

            // Header
            headerElem.innerHTML = `
                <tr>
                    <th rowspan="2">Mjesec</th>
                    <th colspan="3" style="text-align: center; background: #047857; color: white;">${year1}</th>
                    <th colspan="3" style="text-align: center; background: #2563eb; color: white;">${year2}</th>
                    <th colspan="2" style="text-align: center; background: #7c3aed; color: white;">Razlika</th>
                </tr>
                <tr>
                    <th style="text-align: right;">Sječa</th>
                    <th style="text-align: right;">Otprema</th>
                    <th style="text-align: right;">Zaliha</th>
                    <th style="text-align: right;">Sječa</th>
                    <th style="text-align: right;">Otprema</th>
                    <th style="text-align: right;">Zaliha</th>
                    <th style="text-align: right;">Δ Sječa</th>
                    <th style="text-align: right;">Δ Otprema</th>
                </tr>
            `;

            // Body
            let bodyHtml = '';
            let totalSjeca1 = 0, totalOtprema1 = 0;
            let totalSjeca2 = 0, totalOtprema2 = 0;

            for (let i = 0; i < 12; i++) {
                const m1 = mjeseci1[i] || { mjesec: '', ukupnoPrimka: 0, ukupnoOtprema: 0, zaliha: 0 };
                const m2 = mjeseci2[i] || { mjesec: '', ukupnoPrimka: 0, ukupnoOtprema: 0, zaliha: 0 };

                const sjeca1 = parseFloat(m1.ukupnoPrimka) || 0;
                const otprema1 = parseFloat(m1.ukupnoOtprema) || 0;
                const zaliha1 = parseFloat(m1.zaliha) || 0;

                const sjeca2 = parseFloat(m2.ukupnoPrimka) || 0;
                const otprema2 = parseFloat(m2.ukupnoOtprema) || 0;
                const zaliha2 = parseFloat(m2.zaliha) || 0;

                const deltaSjeca = sjeca2 - sjeca1;
                const deltaOtprema = otprema2 - otprema1;

                totalSjeca1 += sjeca1;
                totalOtprema1 += otprema1;
                totalSjeca2 += sjeca2;
                totalOtprema2 += otprema2;

                const deltaClass1 = deltaSjeca >= 0 ? 'positive-diff' : 'negative-diff';
                const deltaClass2 = deltaOtprema >= 0 ? 'positive-diff' : 'negative-diff';

                bodyHtml += `
                    <tr>
                        <td style="font-weight: 600;">${m1.mjesec || m2.mjesec || '-'}</td>
                        <td class="sortiment-value">${sjeca1.toFixed(2)}</td>
                        <td class="sortiment-value">${otprema1.toFixed(2)}</td>
                        <td class="sortiment-value">${zaliha1.toFixed(2)}</td>
                        <td class="sortiment-value">${sjeca2.toFixed(2)}</td>
                        <td class="sortiment-value">${otprema2.toFixed(2)}</td>
                        <td class="sortiment-value">${zaliha2.toFixed(2)}</td>
                        <td class="${deltaClass1}" style="text-align: right; font-weight: 600;">${deltaSjeca >= 0 ? '+' : ''}${deltaSjeca.toFixed(2)}</td>
                        <td class="${deltaClass2}" style="text-align: right; font-weight: 600;">${deltaOtprema >= 0 ? '+' : ''}${deltaOtprema.toFixed(2)}</td>
                    </tr>
                `;
            }
            bodyElem.innerHTML = bodyHtml;

            // Footer
            const totalDeltaSjeca = totalSjeca2 - totalSjeca1;
            const totalDeltaOtprema = totalOtprema2 - totalOtprema1;
            const deltaClass1 = totalDeltaSjeca >= 0 ? 'positive-diff' : 'negative-diff';
            const deltaClass2 = totalDeltaOtprema >= 0 ? 'positive-diff' : 'negative-diff';

            footerElem.innerHTML = `
                <tr style="font-weight: bold; font-size: 16px;">
                    <td>UKUPNO</td>
                    <td class="sortiment-value">${totalSjeca1.toFixed(2)}</td>
                    <td class="sortiment-value">${totalOtprema1.toFixed(2)}</td>
                    <td></td>
                    <td class="sortiment-value">${totalSjeca2.toFixed(2)}</td>
                    <td class="sortiment-value">${totalOtprema2.toFixed(2)}</td>
                    <td></td>
                    <td class="${deltaClass1}" style="text-align: right;">${totalDeltaSjeca >= 0 ? '+' : ''}${totalDeltaSjeca.toFixed(2)}</td>
                    <td class="${deltaClass2}" style="text-align: right;">${totalDeltaOtprema >= 0 ? '+' : ''}${totalDeltaOtprema.toFixed(2)}</td>
                </tr>
            `;
        }

        // Render godišnju usporedbu
        function renderGodisnjuUporedbu(data1, data2, year1, year2) {
            const headerElem = document.getElementById('uporedba-ukupno-header');
            const bodyElem = document.getElementById('uporedba-ukupno-body');

            const mjeseci1 = data1.mjesecniPregled || [];
            const mjeseci2 = data2.mjesecniPregled || [];

            let totalSjeca1 = 0, totalOtprema1 = 0, totalDinamika1 = 0;
            let totalSjeca2 = 0, totalOtprema2 = 0, totalDinamika2 = 0;

            mjeseci1.forEach(m => {
                totalSjeca1 += parseFloat(m.ukupnoPrimka) || 0;
                totalOtprema1 += parseFloat(m.ukupnoOtprema) || 0;
                totalDinamika1 += parseFloat(m.dinamika) || 0;
            });

            mjeseci2.forEach(m => {
                totalSjeca2 += parseFloat(m.ukupnoPrimka) || 0;
                totalOtprema2 += parseFloat(m.ukupnoOtprema) || 0;
                totalDinamika2 += parseFloat(m.dinamika) || 0;
            });

            const realizacijaSjeca1 = totalDinamika1 > 0 ? (totalSjeca1 / totalDinamika1 * 100) : 0;
            const realizacijaSjeca2 = totalDinamika2 > 0 ? (totalSjeca2 / totalDinamika2 * 100) : 0;

            const deltaSjeca = totalSjeca2 - totalSjeca1;
            const deltaOtprema = totalOtprema2 - totalOtprema1;
            const deltaRealizacija = realizacijaSjeca2 - realizacijaSjeca1;

            // Header
            headerElem.innerHTML = `
                <tr>
                    <th>Pokazatelj</th>
                    <th style="text-align: right; background: #047857; color: white;">${year1}</th>
                    <th style="text-align: right; background: #2563eb; color: white;">${year2}</th>
                    <th style="text-align: right; background: #7c3aed; color: white;">Razlika</th>
                    <th style="text-align: right; background: #7c3aed; color: white;">% Promjene</th>
                </tr>
            `;

            // Body
            const percentChangeSjeca = totalSjeca1 > 0 ? ((deltaSjeca / totalSjeca1) * 100) : 0;
            const percentChangeOtprema = totalOtprema1 > 0 ? ((deltaOtprema / totalOtprema1) * 100) : 0;

            bodyElem.innerHTML = `
                <tr>
                    <td style="font-weight: 600;">Sječa (m³)</td>
                    <td class="sortiment-value">${totalSjeca1.toFixed(2)}</td>
                    <td class="sortiment-value">${totalSjeca2.toFixed(2)}</td>
                    <td class="${deltaSjeca >= 0 ? 'positive-diff' : 'negative-diff'}" style="text-align: right; font-weight: 600;">${deltaSjeca >= 0 ? '+' : ''}${deltaSjeca.toFixed(2)}</td>
                    <td class="${percentChangeSjeca >= 0 ? 'positive-diff' : 'negative-diff'}" style="text-align: right; font-weight: 600;">${percentChangeSjeca >= 0 ? '+' : ''}${percentChangeSjeca.toFixed(1)}%</td>
                </tr>
                <tr>
                    <td style="font-weight: 600;">Otprema (m³)</td>
                    <td class="sortiment-value">${totalOtprema1.toFixed(2)}</td>
                    <td class="sortiment-value">${totalOtprema2.toFixed(2)}</td>
                    <td class="${deltaOtprema >= 0 ? 'positive-diff' : 'negative-diff'}" style="text-align: right; font-weight: 600;">${deltaOtprema >= 0 ? '+' : ''}${deltaOtprema.toFixed(2)}</td>
                    <td class="${percentChangeOtprema >= 0 ? 'positive-diff' : 'negative-diff'}" style="text-align: right; font-weight: 600;">${percentChangeOtprema >= 0 ? '+' : ''}${percentChangeOtprema.toFixed(1)}%</td>
                </tr>
                <tr>
                    <td style="font-weight: 600;">Planirana Dinamika (m³)</td>
                    <td class="sortiment-value">${totalDinamika1.toFixed(2)}</td>
                    <td class="sortiment-value">${totalDinamika2.toFixed(2)}</td>
                    <td style="text-align: right;">-</td>
                    <td style="text-align: right;">-</td>
                </tr>
                <tr style="background: linear-gradient(135deg, #047857 0%, #065f46 100%); color: white;">
                    <td style="font-weight: 700;">Realizacija Sječe (%)</td>
                    <td style="text-align: right; font-weight: 700;">${realizacijaSjeca1.toFixed(1)}%</td>
                    <td style="text-align: right; font-weight: 700;">${realizacijaSjeca2.toFixed(1)}%</td>
                    <td style="text-align: right; font-weight: 700;">${deltaRealizacija >= 0 ? '+' : ''}${deltaRealizacija.toFixed(1)}%</td>
                    <td style="text-align: right;">-</td>
                </tr>
            `;
        }

        // Render Top 10 odjela
        function renderTop10Odjela(data1, data2, year1, year2) {
            const body1 = document.getElementById('uporedba-top10-year1-body');
            const body2 = document.getElementById('uporedba-top10-year2-body');

            document.getElementById('uporedba-top10-year1-title').textContent = `Godina ${year1}`;
            document.getElementById('uporedba-top10-year2-title').textContent = `Godina ${year2}`;

            const odjeli1 = data1.odjeli || [];
            const odjeli2 = data2.odjeli || [];

            // Sort by primka descending
            const top10_1 = odjeli1.sort((a, b) => (parseFloat(b.primka) || 0) - (parseFloat(a.primka) || 0)).slice(0, 10);
            const top10_2 = odjeli2.sort((a, b) => (parseFloat(b.primka) || 0) - (parseFloat(a.primka) || 0)).slice(0, 10);

            // Render Year 1
            let html1 = '';
            top10_1.forEach((odjel, idx) => {
                const primka = parseFloat(odjel.primka) || 0;
                const medalEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                html1 += `
                    <tr>
                        <td style="text-align: center;">${medalEmoji} ${idx + 1}</td>
                        <td style="font-weight: 600;">${odjel.odjel || '-'}</td>
                        <td class="sortiment-value">${primka.toFixed(2)}</td>
                    </tr>
                `;
            });
            body1.innerHTML = html1;

            // Render Year 2
            let html2 = '';
            top10_2.forEach((odjel, idx) => {
                const primka = parseFloat(odjel.primka) || 0;
                const medalEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                html2 += `
                    <tr>
                        <td style="text-align: center;">${medalEmoji} ${idx + 1}</td>
                        <td style="font-weight: 600;">${odjel.odjel || '-'}</td>
                        <td class="sortiment-value">${primka.toFixed(2)}</td>
                    </tr>
                `;
            });
            body2.innerHTML = html2;
        }


