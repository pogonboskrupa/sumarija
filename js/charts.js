        // ========== CHARTS MODULE ==========
        // Dashboard daily chart, worker monthly charts

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
            } else if (canvasId === 'otpremac-chart' && otpremacChart) {
                otpremacChart.destroy();
            } else {
                var existingChart = Chart.getChart(canvas);
                if (existingChart) existingChart.destroy();
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
            } else if (canvasId === 'otpremac-daily-chart' && otpremacDailyChart) {
                otpremacDailyChart.destroy();
            } else {
                var existingChart = Chart.getChart(canvas);
                if (existingChart) existingChart.destroy();
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
            } else if (canvasId === 'otpremac-yearly-chart' && otpremacYearlyChart) {
                otpremacYearlyChart.destroy();
            } else {
                var existingChart = Chart.getChart(canvas);
                if (existingChart) existingChart.destroy();
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
            if (window.currentTab && window.currentTab !== 'primac-godisnji') return;
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

        // Load otpremac godisnji prikaz (yearly view)
        async function loadOtpremacGodisnji() {
            if (window.currentTab && window.currentTab !== 'otpremac-godisnji') return;
            try {
                var yearSelector = document.getElementById('otpremac-godisnji-year-select');
                var year = yearSelector ? yearSelector.value : new Date().getFullYear();

                var badge = document.getElementById('otpremac-godisnji-year-badge');
                if (badge) badge.textContent = year;

                var url = buildApiUrl('otpremac-detail', { year: year });
                var data = await fetchWithCache(url, 'cache_otpremac_godisnji_' + year);

                if (data.error) {
                    throw new Error(data.error);
                }

                // Group data by month
                var monthlyData = {};
                var mjeseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

                for (var i = 1; i <= 12; i++) {
                    monthlyData[i] = { mjesec: mjeseci[i-1], sortimenti: {}, ukupno: 0 };
                    data.sortimentiNazivi.forEach(function(s) { monthlyData[i].sortimenti[s] = 0; });
                }

                // Sum by month
                data.unosi.forEach(function(u) {
                    var dateParts = u.datum.split('.');
                    if (dateParts.length >= 2) {
                        var mjesec = parseInt(dateParts[1]);
                        monthlyData[mjesec].ukupno += u.ukupno || 0;
                        data.sortimentiNazivi.forEach(function(s) {
                            monthlyData[mjesec].sortimenti[s] += (u.sortimenti[s] || 0);
                        });
                    }
                });

                // Create header
                var headerHTML = '<tr><th>Mjesec</th>' +
                    data.sortimentiNazivi.map(function(s) { return '<th class="sortiment-col">' + s + '</th>'; }).join('') +
                    '</tr>';
                document.getElementById('otpremac-godisnji-main-header').innerHTML = headerHTML;

                // Create body
                var totalSortimenti = {};
                data.sortimentiNazivi.forEach(function(s) { totalSortimenti[s] = 0; });
                var totalUkupno = 0;

                var bodyHTML = mjeseci.map(function(mjesec, idx) {
                    var mjesecNum = idx + 1;
                    var md = monthlyData[mjesecNum];

                    totalUkupno += md.ukupno;
                    data.sortimentiNazivi.forEach(function(s) {
                        totalSortimenti[s] += md.sortimenti[s];
                    });

                    var sortimentiCells = data.sortimentiNazivi.map(function(s) {
                        var val = md.sortimenti[s];
                        return '<td class="sortiment-col">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                    }).join('');

                    return '<tr class="mjesec-' + mjesecNum + '">' +
                        '<td style="font-weight: 700;">' + mjesec + '</td>' +
                        sortimentiCells + '</tr>';
                }).join('');

                // Totals row
                var totalsCells = data.sortimentiNazivi.map(function(s) {
                    var val = totalSortimenti[s];
                    return '<td class="sortiment-col">' + (val > 0 ? val.toFixed(2) : '-') + '</td>';
                }).join('');

                bodyHTML += '<tr class="totals-row"><td style="text-align: left;">GODIŠNJE UKUPNO</td>' + totalsCells + '</tr>';

                document.getElementById('otpremac-godisnji-main-body').innerHTML = bodyHTML;

                // Create yearly chart
                await createWorkerYearlyChart('otpremac-yearly-chart', data.unosi, '#1e40af', '#3b82f6');

            } catch (error) {
                showError('Greška', 'Greška pri učitavanju godišnjeg prikaza otpreme: ' + error.message);
            }
        }

        // Load primac personal data
        async function loadPrimacPersonal() {
            if (window.currentTab && window.currentTab !== 'primac-personal') return;
            var ppYear = (document.getElementById('primac-personal-year-select') || {}).value || new Date().getFullYear();
            var ppCacheKey = 'cache_primac_detail_' + ppYear;
            // Turbo: skip loading screen if cache exists
            if (!localStorage.getItem(ppCacheKey)) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('primac-personal-content').classList.add('hidden');
            } else {
                document.getElementById('primac-personal-content').classList.remove('hidden');
            }

            try {
                const yearSelector = document.getElementById('primac-personal-year-select');
                const year = yearSelector ? yearSelector.value : new Date().getFullYear();

                const url = buildApiUrl('primac-detail', { year });
                const data = await fetchWithCache(url, ppCacheKey);


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
            if (window.currentTab && window.currentTab !== 'otpremac-personal') return;
            var opYear = (document.getElementById('otpremac-personal-year-select') || {}).value || new Date().getFullYear();
            var opCacheKey = 'cache_otpremac_detail_' + opYear;
            // Turbo: skip loading screen if cache exists
            if (!localStorage.getItem(opCacheKey)) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('otpremac-personal-content').classList.add('hidden');
            } else {
                document.getElementById('otpremac-personal-content').classList.remove('hidden');
            }

            try {
                const yearSelector = document.getElementById('otpremac-personal-year-select');
                const year = yearSelector ? yearSelector.value : new Date().getFullYear();

                const url = buildApiUrl('otpremac-detail', { year });
                const data = await fetchWithCache(url, opCacheKey);


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


