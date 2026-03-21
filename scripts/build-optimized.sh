#!/bin/bash

# Build optimized index.html

# Ekstraktuj dijelove iz originalnog index.html
sed -n '1,11p' /home/user/sumarija/index.html > /tmp/header.html
sed -n '2049,4323p' /home/user/sumarija/index.html > /tmp/body.html
echo '</html>' > /tmp/footer.html

# Kreiraj optimizovan HTML
cat > /home/user/sumarija/index-optimized.html << 'HTMLSTART'
<!DOCTYPE html>
<html lang="bs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Agresivno keširanje -->
    <meta http-equiv="Cache-Control" content="public, max-age=31536000, immutable">
    <title>Šumarija - Preglednik</title>

    <!-- Preload kritičnih resursa -->
    <link rel="preload" href="css/main.css" as="style">
    <link rel="preload" href="js/app.js" as="script">

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" type="image/png" href="favicon.png">

    <!-- Main CSS -->
    <link rel="stylesheet" href="css/main.css">

    <!-- Lazy load Chart.js -->
    <link rel="preconnect" href="https://cdn.jsdelivr.net">

    <!-- Instant Offline-First Modules -->
    <script src="idb-helper.js" defer></script>
    <script src="data-sync.js" defer></script>

    <!-- Main app JavaScript -->
    <script src="js/app.js" defer></script>

    <!-- Inline critical script -->
    <script>
        let chartJsLoaded = false;
        window.loadChartJs = function() {
            return new Promise((resolve, reject) => {
                if (chartJsLoaded || window.Chart) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
                script.onload = () => {
                    chartJsLoaded = true;
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        };

        // Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .catch(err => console.warn('[SW] Failed:', err));
            });
        }
    </script>
</head>
HTMLSTART

# Dodaj body iz originalnog HTML-a
cat /tmp/body.html >> /home/user/sumarija/index-optimized.html

# Zatvori HTML
echo '</html>' >> /home/user/sumarija/index-optimized.html

echo "✅ index-optimized.html kreiran!"
wc -l /home/user/sumarija/index-optimized.html
ls -lh /home/user/sumarija/index-optimized.html
