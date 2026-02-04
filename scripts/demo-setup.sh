#!/bin/bash
# ORACLE Alpha - Demo Setup Script
# Run this to prepare for a hackathon presentation

set -e

echo "╔═══════════════════════════════════════════════╗"
echo "║  🔮 ORACLE Alpha - Demo Setup                 ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Run this script from the oracle-alpha root directory"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${CYAN}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if server is already running
if lsof -Pi :3900 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Server already running on port 3900${NC}"
else
    echo -e "${CYAN}🚀 Starting demo server...${NC}"
    DEMO_MODE=true DEMO_SIGNALS_PER_MINUTE=4 npx ts-node --transpile-only src/api/server.ts &
    sleep 3
fi

# Seed historical data
echo -e "${CYAN}📊 Seeding historical data...${NC}"
curl -s -X POST http://localhost:3900/api/demo/seed -H "Content-Type: application/json" -d '{"count": 30}' > /dev/null 2>&1 || true

# Start demo signal generation
echo -e "${CYAN}🎬 Starting signal generation...${NC}"
curl -s -X POST http://localhost:3900/api/demo/start > /dev/null 2>&1 || true

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  ✅ Demo Ready!                               ║"
echo "╠═══════════════════════════════════════════════╣"
echo "║  🌐 Landing:  http://localhost:3900/          ║"
echo "║  📊 Dashboard: http://localhost:3900/index.html"
echo "║  🎯 Showcase: http://localhost:3900/showcase.html"
echo "║  📡 API:      http://localhost:3900/api/info  ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Press Ctrl+C to stop the demo server${NC}"

# Keep script running
wait
