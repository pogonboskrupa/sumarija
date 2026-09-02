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

# Svi testovi iz tests/ — NAMJERNO preko obrasca, ne nabrajanjem fajlova.
# Ranije je spisak bio hardkodiran, pa je svaki NOVI test fajl tiho
# preskakan: suite bi i dalje javljao "sve prolazi" a da taj test nikad
# nije pokrenut. Provjereno: obrazac hvata isti skup fajlova kao raniji
# spisak (nijedan nije bio namjerno izostavljen).
node --test tests/*.test.js

echo ""
echo "=============================================="
echo "  TESTOVI ZAVRSENI"
echo "=============================================="
echo ""
