#!/bin/bash

# ORACLE Alpha Integration Test Script
# Tests all API endpoints and basic functionality

set -e

BASE_URL="${API_URL:-http://localhost:3900}"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔮 ORACLE Alpha Integration Tests"
echo "=================================="
echo "Base URL: $BASE_URL"
echo ""

# Test function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local check_field="$5"
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" 2>/dev/null)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        if [ -n "$check_field" ]; then
            if echo "$body" | grep -q "$check_field"; then
                echo -e "${GREEN}✓ PASSED${NC}"
                ((PASSED++))
            else
                echo -e "${RED}✗ FAILED${NC} (missing field: $check_field)"
                ((FAILED++))
            fi
        else
            echo -e "${GREEN}✓ PASSED${NC}"
            ((PASSED++))
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (expected $expected_status, got $status_code)"
        ((FAILED++))
    fi
}

# Wait for server
echo "Checking server availability..."
for i in {1..10}; do
    if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}Server is up!${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}Server not available at $BASE_URL${NC}"
        exit 1
    fi
    sleep 1
done

echo ""
echo "=== Health & Status ==="
test_endpoint "Health check" "GET" "/health" "200" "status"
test_endpoint "Metrics (Prometheus)" "GET" "/metrics" "200" "oracle_"
test_endpoint "Metrics (JSON)" "GET" "/api/metrics" "200" "signalsTotal"

echo ""
echo "=== Info & Status ==="
test_endpoint "Project info" "GET" "/api/info" "200" "ORACLE Alpha"
test_endpoint "API status" "GET" "/api/status" "200" ""
test_endpoint "Status (text)" "GET" "/api/status/text" "200" ""

echo ""
echo "=== Signals ==="
test_endpoint "Get signals" "GET" "/api/signals" "200" "signals"
test_endpoint "Get signals (filtered)" "GET" "/api/signals?minScore=70&limit=5" "200" "count"
test_endpoint "Get gainers" "GET" "/api/gainers" "200" "gainers"

echo ""
echo "=== Stats ==="
test_endpoint "Get stats" "GET" "/api/stats" "200" "totalSignals"
test_endpoint "Get leaderboard" "GET" "/api/leaderboard" "200" "leaderboard"
test_endpoint "Get sources" "GET" "/api/sources" "200" ""
test_endpoint "Get performance" "GET" "/api/performance" "200" ""

echo ""
echo "=== On-Chain ==="
test_endpoint "On-chain stats" "GET" "/api/onchain/stats" "200" ""
test_endpoint "On-chain signals" "GET" "/api/onchain/signals" "200" "signals"

echo ""
echo "=== Subscription ==="
test_endpoint "Get tiers" "GET" "/api/subscription/tiers" "200" "tiers"
test_endpoint "Invalid wallet" "GET" "/api/subscription/invalid" "400" "error"

echo ""
echo "=== Summary ==="
test_endpoint "Get summary" "GET" "/api/summary" "200" ""

echo ""
echo "=================================="
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
