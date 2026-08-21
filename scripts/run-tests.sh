#!/usr/bin/env bash
# =============================================================
# Sumarija - Pre-production test runner
# Grana: claude/test-before-production-XaKuV
# =============================================================

set -e

echo ""
echo "=============================================="
echo "  SUMARIJA - PRE-PRODUCTION TEST SUITE"
echo "=============================================="
echo ""

# Provjeri Node.js
if ! command -v node &>/dev/null; then
    echo "GRESKA: Node.js nije instaliran!"
    exit 1
fi

NODE_VER=$(node --version)
echo "Node.js: $NODE_VER"
echo "Direktorij: $(pwd)"
echo ""

# Pokreni testove
echo "----------------------------------------------"
echo "Pokretanje testova..."
echo "----------------------------------------------"
echo ""

node --test tests/name-matching.test.js \
              tests/validation.test.js \
              tests/utils.test.js \
              tests/retry-logic.test.js \
              tests/security-audit.test.js \
              tests/sjekacke-linije.test.js \
              tests/kubikator-rounding.test.js \
              tests/karta-odjela-kategorije.test.js \
              tests/karta-odjela-projektovana-masa.test.js \
              tests/karta-odjela-klopke-po-vrsti.test.js \
              tests/karta-odjela-pad-bounds.test.js \
              tests/karta-odjela-zavrsena-realizacija.test.js \
              tests/karta-odjela-neaktivnost-zavrseno.test.js \
              tests/offline-red-cekanja.test.js \
              tests/slaba-veza.test.js \
              tests/karta-gps-pracenje.test.js \
              tests/offline-karta-preuzimanje.test.js \
              tests/priprema-za-teren.test.js \
              tests/trend-period-od-do.test.js

echo ""
echo "=============================================="
echo "  TESTOVI ZAVRSENI"
echo "=============================================="
echo ""
