# 🔮 ORACLE Alpha Demo

## Quick Demo (2 minutes)

### Step 1: Install & Run
```bash
git clone https://github.com/dynamolabs/oracle-alpha.git
cd oracle-alpha
npm install
npm start
```

### Step 2: See Live Signals
```
╔═══════════════════════════════════════════════╗
║  🔮 ORACLE Alpha API Server                    ║
╠═══════════════════════════════════════════════╣
║  REST API: http://localhost:3900/api          ║
║  WebSocket: ws://localhost:3900/ws            ║
╚═══════════════════════════════════════════════╝

[SERVER] On-chain publishing ENABLED
[SERVER] ATH tracking ENABLED

[00:01:23] Scanning 8 sources...
[00:01:24] Smart wallet signals: 3
[00:01:25] Volume spike signals: 8
[00:01:25] KOL signals: 2
[00:01:26] Narrative signals: 5

[00:01:26] New signal: $AIDOG (Score: 87)
[00:01:26] ✅ Published on-chain: 3xK2...p9Nz
```

### Step 3: View Dashboard
Open `http://localhost:3900` in your browser:

```
┌───────────────────────────────────────────────────────────────┐
│  🔮 ORACLE Alpha Dashboard                                    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  📊 Live Signals (Last Hour)                                  │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  🟢 $AIDOG    Score: 87  MCap: $145K   Sources: 3   [BUY]   │
│      ████████████████████░░░░                                │
│      AI/Agents • Elite Wallet • Volume Spike                  │
│                                                               │
│  🟡 $TRUMP2   Score: 72  MCap: $89K    Sources: 2   [BUY]   │
│      ████████████████░░░░░░░░                                │
│      Political • KOL Mention                                  │
│                                                               │
│  🟡 $PEPE3    Score: 68  MCap: $210K   Sources: 2   [WATCH] │
│      ███████████████░░░░░░░░░                                │
│      Animals • Volume Spike                                   │
│                                                               │
│  📈 On-Chain Stats                                            │
│  ─────────────────────────────────────────────────────────── │
│  Total Signals: 47  │  Win Rate: 62.3%  │  Avg ROI: +34.5%  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## API Examples

### Get Top Signals
```bash
curl http://localhost:3900/api/signals?minScore=70&limit=5
```

**Response:**
```json
{
  "count": 3,
  "signals": [
    {
      "id": "a3f2-4b1c-9d8e",
      "symbol": "AIDOG",
      "name": "AI Dog",
      "score": 87,
      "riskLevel": "LOW",
      "sources": [
        { "source": "smart-wallet-elite", "rawScore": 85 },
        { "source": "volume-spike", "rawScore": 78 },
        { "source": "narrative-new", "rawScore": 72 }
      ],
      "analysis": {
        "narrative": ["AI/Agents", "Animals"],
        "strengths": ["Elite wallet accumulating", "Volume spike", "Fresh token"],
        "weaknesses": [],
        "recommendation": "STRONG BUY - Multiple high-quality signals"
      }
    }
  ]
}
```

### Get On-Chain Stats
```bash
curl http://localhost:3900/api/onchain/stats
```

**Response:**
```json
{
  "enabled": true,
  "programId": "AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd",
  "network": "devnet",
  "totalSignals": 47,
  "wins": 29,
  "losses": 12,
  "pending": 6,
  "winRate": "70.7%",
  "avgRoi": "+34.5%"
}
```

### Get Leaderboard
```bash
curl http://localhost:3900/api/leaderboard
```

**Response:**
```json
{
  "count": 10,
  "leaderboard": [
    { "rank": 1, "symbol": "AIDOG", "roi": 287, "status": "WIN" },
    { "rank": 2, "symbol": "TRUMP2", "roi": 156, "status": "WIN" },
    { "rank": 3, "symbol": "SOLAI", "roi": 134, "status": "OPEN" }
  ]
}
```

---

## WebSocket (Real-time)

```javascript
const ws = new WebSocket('ws://localhost:3900/ws');

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  
  if (type === 'signal') {
    console.log(`🔮 New Signal: $${data.symbol}`);
    console.log(`   Score: ${data.score} | Risk: ${data.riskLevel}`);
    console.log(`   ${data.analysis.recommendation}`);
  }
};

// Output:
// 🔮 New Signal: $AIDOG
//    Score: 87 | Risk: LOW
//    STRONG BUY - Multiple high-quality signals
```

---

## CLI Commands

```bash
# Full signal scan with formatted output
npm run scan

# Example output:
# ═══════════════════════════════════════════════════════════
# 🔮 ORACLE Alpha Signal Scanner
# ═══════════════════════════════════════════════════════════
#
# 🎯 $AIDOG - AI Dog
#    Score: 87 ████████████████████░░░░
#    Risk: LOW | Sources: smart-wallet-elite, volume-spike
#    MCap: $145K | Age: 12m
#    → STRONG BUY
#
# 🎯 $TRUMP2 - Trump Meme 2
#    Score: 72 ████████████████░░░░░░░░
#    Risk: MEDIUM | Sources: kol-tracker, narrative-new
#    MCap: $89K | Age: 28m
#    → BUY
```

```bash
# Check system status
npm run status

# Output:
# ✅ API Server: Running (port 3900)
# ✅ On-Chain: Connected (devnet)
# ✅ Telegram: Configured
# 📊 Signals tracked: 47
# 📈 Win rate: 62.3%
```

```bash
# View leaderboard
npm run leaderboard

# Output:
# 🏆 Top Performing Signals
# ─────────────────────────────────────
# #1  $AIDOG   +287%  ✅ WIN
# #2  $TRUMP2  +156%  ✅ WIN
# #3  $SOLAI   +134%  ⏳ OPEN
# #4  $PEPE3   +89%   ⏳ OPEN
# #5  $MAGA    +45%   ⏳ OPEN
```

---

## On-Chain Verification

### View Published Signals
```bash
# Solana Explorer
open "https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd?cluster=devnet"
```

### Signal PDA Structure
```
┌─────────────────────────────────────────────┐
│  Signal Account (PDA)                       │
├─────────────────────────────────────────────┤
│  token: "GJBSNoz..." (CA)                   │
│  symbol: "AIDOG"                            │
│  score: 87                                  │
│  entryPrice: 0.00012                        │
│  athPrice: 0.00047 (auto-updated)           │
│  timestamp: 1706918400                      │
│  status: OPEN | WIN | LOSS                  │
│  roi: 287% (calculated)                     │
└─────────────────────────────────────────────┘
```

---

## Signal Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Sources    │───▶│  Aggregator  │───▶│   Scorer     │
│ (24 wallets) │    │  (Combine)   │    │  (Rank)      │
│ (31 KOLs)    │    └──────────────┘    └──────┬───────┘
│ (8 types)    │                               │
└──────────────┘                               ▼
                                    ┌──────────────────┐
                                    │    Publisher     │
                                    ├──────────────────┤
                                    │ ✓ REST API       │
                                    │ ✓ WebSocket      │
                                    │ ✓ Telegram       │
                                    │ ✓ On-Chain (SOL) │
                                    └──────────────────┘
```

---

## Scoring Breakdown

| Component | Points | Example |
|-----------|--------|---------|
| Base Score | 0-100 | 70 |
| Elite Wallet | +20 | +20 |
| Multi-source | +15 | +15 (3 sources) |
| Fresh token | +10 | +10 (<10min) |
| Low mcap | +10 | +10 (<$100K) |
| Strong buy pressure | +5 | +5 (>70%) |
| **Total** | **87** | STRONG BUY |

---

## What Makes ORACLE Alpha Special

### 1. 🔗 Verifiable Track Record
Unlike other signal bots, every signal is published on-chain with entry price. You can independently verify our performance.

### 2. 🤖 Multi-Source Confluence
We don't rely on a single signal. We aggregate 8 different sources and weight them by historical performance.

### 3. 📊 Transparent Scoring
Our scoring algorithm is open source. No black box - you can see exactly why a signal scored high or low.

### 4. ⚡ Real-Time Updates
WebSocket support for instant notifications. ATH tracking updates every 5 minutes.

### 5. 🆓 Free & Open Source
No subscription, no premium tier. MIT licensed.

---

## Links

- **GitHub**: https://github.com/dynamolabs/oracle-alpha
- **Explorer**: https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd?cluster=devnet
- **API Docs**: http://localhost:3900/docs

---

Built with ❤️ by **ShifuSensei 🐼** for Colosseum Agent Hackathon 2026
