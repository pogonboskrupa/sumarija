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

# Build index.html sa optimizovanim login screen-om

echo "🎨 Building optimized index.html with beautiful login screen..."

cat > /home/user/sumarija/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="bs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="public, max-age=31536000, immutable">
    <title>Šumarija - Preglednik</title>

    <!-- Preload -->
    <link rel="preload" href="css/main.css" as="style">
    <link rel="preload" href="css/login-optimized.css" as="style">
    <link rel="preload" href="js/cache-helper.js" as="script">
    <link rel="preload" href="js/api-optimized.js" as="script">

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" type="image/png" href="favicon.png">

    <!-- CSS -->
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/login-optimized.css">

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
        // Lazy load Chart.js
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
                navigator.serviceWorker.register('/service-worker.js').catch(() => {});
            });
        }

        // Add login-active class to body when on login screen
        document.addEventListener('DOMContentLoaded', () => {
            const loginScreen = document.getElementById('login-screen');
            if (loginScreen && !loginScreen.classList.contains('hidden')) {
                document.body.classList.add('login-active');
            }
        });
    </script>
</head>
<body class="login-active">
HTMLEOF

# Add login screen sa optimizovanom strukturom
cat >> /home/user/sumarija/index.html << 'LOGINEOF'
    <!-- Toast Notification Container -->
    <div id="toast-container" class="toast-container"></div>

    <!-- LOGIN SCREEN -->
    <div id="login-screen" class="login-container">
        <div class="login-box">
            <!-- Logo Container -->
            <div class="logo-container">
                <img src="logo-zuti.png" alt="ŠPD Unsko-Sanske Šume Logo">
                <h3 class="text-outline-firma">ŠPD "UNSKO-SANSKE ŠUME"</h3>
                <h4 class="company-subtitle">BOSANSKA KRUPA</h4>
            </div>

            <h2>Šumarija</h2>
            <p>Evidencija sječe i otpreme</p>

            <form id="login-form">
                <div id="error-msg" class="error hidden"></div>
                
                <div class="form-group">
                    <label>Korisničko ime</label>
                    <input type="text" id="username" placeholder="Email ili username" required autocomplete="username">
                </div>
                
                <div class="form-group">
                    <label>Šifra</label>
                    <input type="password" id="password" placeholder="••••••••" required autocomplete="current-password">
                </div>
                
                <button type="submit" class="btn" id="login-btn">Prijavi se</button>
            </form>
        </div>
    </div>

LOGINEOF

# Add ostatak HTML-a (app-screen)
sed -n '2092,4323p' /home/user/sumarija/index-fast.html >> /home/user/sumarija/index.html

# Close HTML
echo '</html>' >> /home/user/sumarija/index.html

echo "✅ index.html created with optimized login screen!"
wc -l /home/user/sumarija/index.html
ls -lh /home/user/sumarija/index.html

echo ""
echo "📊 CSS Files:"
ls -lh /home/user/sumarija/css/*.css
