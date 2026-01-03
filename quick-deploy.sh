#!/bin/bash

echo "======================================"
echo "🚀 BACKEND DEPLOYMENT QUICK GUIDE"
echo "======================================"
echo ""
echo "1. Open Google Apps Script:"
echo "   https://script.google.com/home"
echo ""
echo "2. Copy apps-script-code.gs to clipboard:"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    cat apps-script-code.gs | pbcopy
    echo "   ✅ Code copied to clipboard (MacOS)"
elif command -v xclip &> /dev/null; then
    cat apps-script-code.gs | xclip -selection clipboard
    echo "   ✅ Code copied to clipboard (Linux)"
else
    echo "   ⚠️  Manual copy needed:"
    echo "      Open apps-script-code.gs and copy all (Ctrl+A, Ctrl+C)"
fi

echo ""
echo "3. In Google Apps Script editor:"
echo "   - Select All (Ctrl+A)"
echo "   - Delete (Del)"
echo "   - Paste (Ctrl+V)"
echo "   - Save (Ctrl+S)"
echo ""
echo "4. Deploy new version:"
echo "   - Deploy > Manage deployments"
echo "   - Edit (pencil icon)"
echo "   - Version: New version"
echo "   - Description: 'Fix: odjel.includes error'"
echo "   - Deploy"
echo ""
echo "5. Clear browser cache:"
echo "   - Open browser console (F12)"
echo "   - Type: localStorage.clear()"
echo "   - Refresh page (Ctrl+Shift+R)"
echo ""
echo "======================================"
