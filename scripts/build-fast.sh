#!/bin/bash

# ⛔ MRTVA I DESTRUKTIVNA SKRIPTA — NE POKRETATI.
#
# Ova skripta prepisuje index.html ("cat > index.html") iz heredoc-a koji je
# zaostao iz ranije faze projekta. Njen sadržaj je zastario: postavlja
# viewport na width=device-width (aplikacija koristi 1280 — vidi
# setAppViewport u index.html) i učitava js/cache-helper.js i
# js/api-optimized.js, a NIJEDAN od ta dva fajla više ne postoji. Pokretanje
# uništava aplikaciju.
#
# index.html se uređuje direktno. Zadržano samo kao historijski trag.
echo "⛔ Ova build skripta je mrtva i destruktivna — prepisala bi index.html. Prekidam." >&2
exit 1

# Build ULTRA FAST index.html

cat > /home/user/sumarija/index-fast.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="bs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="public, max-age=31536000, immutable">
    <title>Šumarija - Preglednik</title>

    <!-- Preload -->
    <link rel="preload" href="css/main.css" as="style">
    <link rel="preload" href="js/cache-helper.js" as="script">
    <link rel="preload" href="js/api-optimized.js" as="script">

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="favicon.svg">

    <!-- Main CSS -->
    <link rel="stylesheet" href="css/main.css">

    <!-- Preconnect -->
    <link rel="preconnect" href="https://cdn.jsdelivr.net">

    <!-- Performance Modules -->
    <script src="js/cache-helper.js" defer></script>
    <script src="js/api-optimized.js" defer></script>

    <!-- Offline-First -->
    <script src="idb-helper.js" defer></script>
    <script src="data-sync.js" defer></script>

    <!-- Main App -->
    <script src="js/app.js" defer></script>

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

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js').catch(() => {});
            });
        }
    </script>
</head>
HTMLEOF

# Add body
sed -n '2049,4323p' /home/user/sumarija/index.html >> /home/user/sumarija/index-fast.html
echo '</html>' >> /home/user/sumarija/index-fast.html

echo "✅ index-fast.html created!"
ls -lh /home/user/sumarija/index-fast.html
