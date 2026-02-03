#!/bin/bash
# Start ORACLE Alpha in Demo Mode
# Use this for presentations and recordings

echo "🎬 Starting ORACLE Alpha in Demo Mode..."
echo ""
echo "Features enabled:"
echo "  ✅ Demo signal generator (4 signals/min)"
echo "  ✅ Historical data seeding (30 signals)"
echo "  ✅ KOL mock mentions"
echo "  ✅ Real DexScreener data"
echo ""
echo "Dashboard will be available at: http://localhost:3900"
echo "Press Ctrl+C to stop"
echo ""

export DEMO_MODE=true
export DEMO_SIGNALS_PER_MINUTE=4
export NODE_ENV=development

cd "$(dirname "$0")/.." || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the server
npx ts-node --transpile-only src/api/server.ts
