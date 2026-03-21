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
              tests/security-audit.test.js

echo ""
echo "=============================================="
echo "  TESTOVI ZAVRSENI"
echo "=============================================="
echo ""
