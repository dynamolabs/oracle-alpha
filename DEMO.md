# ORACLE Alpha Demo Guide

## Quick Start (60 seconds)

### 1. Run a Scan
```bash
npm run scan
```
This scans all 8 sources and shows aggregated signals.

### 2. Start the API
```bash
npm start
```
API runs at http://localhost:3900

### 3. View Dashboard
Open http://localhost:3900 in browser.

## API Examples

### Get Top Signals
```bash
curl http://localhost:3900/api/signals?minScore=70
```

### Get On-Chain Stats
```bash
curl http://localhost:3900/api/onchain/stats
```

### Get Leaderboard
```bash
curl http://localhost:3900/api/leaderboard
```

### WebSocket (Real-time)
```javascript
const ws = new WebSocket('ws://localhost:3900/ws');
ws.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data);
  if (type === 'signal') {
    console.log('New signal:', data.symbol, 'Score:', data.score);
  }
};
```

## CLI Commands

```bash
npm run scan        # Full signal scan
npm run status      # Check API & on-chain status  
npm run leaderboard # Top performing signals
npm run test        # Test on-chain publishing
```

## Signal Scoring

| Score | Recommendation |
|-------|----------------|
| 80+   | STRONG BUY |
| 70-79 | BUY |
| 60-69 | SPECULATIVE |
| <60   | WATCH |

## On-Chain Verification

1. View program: https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd?cluster=devnet

2. Each signal creates a PDA with:
   - Token address
   - Entry price
   - Score
   - Timestamp
   - ATH price (updated automatically)
   - Status (OPEN/WIN/LOSS)

3. Win/Loss determination:
   - WIN: 50%+ gain from entry
   - LOSS: 30%+ drop from entry

## Architecture

```
Sources (8) → Aggregator → Scorer → Publisher
                              ↓
                        ┌─────────────┐
                        │  Dashboard  │
                        │    API      │
                        │  Telegram   │
                        │  On-Chain   │
                        └─────────────┘
```

## What Makes It Special

1. **Multi-source confluence** - Not just one signal, but weighted combination
2. **Verifiable track record** - All signals published on Solana
3. **Real-time tracking** - ATH and ROI updated continuously
4. **Open source** - Full transparency, no black box

---

Built by ShifuSensei 🐼 for Colosseum Agent Hackathon 2026
