#!/bin/bash
# 🚀 Apps Script Deployment Script
# Automatski push i deploy Apps Script-a

set -e

echo "🔧 Step 1: Autentifikacija sa clasp..."
echo "UPOZORENJE: Otvorićce se browser prozor za Google autentifikaciju"
echo "Klikni ALLOW, pa kopiraj URL iz browsera i pastuj ovdje."
echo ""

clasp login

echo ""
echo "✅ Autentifikacija uspješna!"
echo ""
echo "📤 Step 2: Push-ovanje koda na Google Apps Script..."

clasp push

echo ""
echo "✅ Kod push-ovan!"
echo ""
echo "🚀 Step 3: Kreiranje novog deployment-a..."

# Deploy kao Web App
DEPLOY_OUTPUT=$(clasp deploy --description "CORS fix deployment $(date +%Y-%m-%d)" 2>&1)

echo "$DEPLOY_OUTPUT"

# Izvuci deployment ID iz output-a
DEPLOYMENT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP '@\K[0-9]+' | head -1)

if [ -z "$DEPLOYMENT_ID" ]; then
  echo ""
  echo "❌ GREŠKA: Nisam mogao izvući deployment ID"
  echo "Pokušaj ručno: clasp deploy"
  exit 1
fi

# Dobij web app URL
echo ""
echo "🔗 Dobijanje Web App URL-a..."

DEPLOYMENTS=$(clasp deployments 2>&1)
echo "$DEPLOYMENTS"

WEB_APP_URL=$(echo "$DEPLOYMENTS" | grep -oP 'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec' | head -1)

if [ -z "$WEB_APP_URL" ]; then
  echo ""
  echo "⚠️  Nisam mogao automatski izvući URL. Pokreni ručno:"
  echo "   clasp deployments"
  echo "Pa kopiraj Web App URL i ažuriraj js/api-optimized.js"
  exit 1
fi

echo ""
echo "=================================="
echo "✅ DEPLOYMENT USPJEŠAN!"
echo "=================================="
echo ""
echo "NOVI WEB APP URL:"
echo "$WEB_APP_URL"
echo ""
echo "🔧 Step 4: Ažuriranje frontend-a sa novim URL-om..."

# Zamijeni stari URL sa novim u api-optimized.js
sed -i "s|const API_BASE_URL = 'https://script\.google\.com/macros/s/[A-Za-z0-9_-]*/exec';|const API_BASE_URL = '$WEB_APP_URL';|" js/api-optimized.js

echo "✅ js/api-optimized.js ažuriran sa novim URL-om!"

# Zamijeni stari URL sa novim u app.js
sed -i "s|const API_URL = 'https://script\.google\.com/macros/s/[A-Za-z0-9_-]*/exec';|const API_URL = '$WEB_APP_URL';|" js/app.js

echo "✅ js/app.js ažuriran sa novim URL-om!"
echo ""
echo "=================================="
echo "🎉 SVE GOTOVO!"
echo "=================================="
echo ""
echo "SLIJEDEĆI KORACI:"
echo "1. Commit promjene: git add . && git commit -m '🚀 DEPLOY: Apps Script CORS fix'"
echo "2. Push na GitHub: git push -u origin claude/find-last-branch-AKhOE"
echo "3. Testiraj na GitHub Pages"
echo ""
