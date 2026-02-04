# 🔮 ORACLE Alpha

<p align="center">
  <img src="app/assets/banner.svg" alt="ORACLE Alpha Banner" width="100%">
</p>

<p align="center">
  <a href="https://github.com/dynamolabs/oracle-alpha/actions/workflows/ci.yml"><img src="https://github.com/dynamolabs/oracle-alpha/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-193%20passed-brightgreen" alt="Tests"></a>
  <a href="#"><img src="https://img.shields.io/badge/coverage-77%25+-brightgreen" alt="Coverage"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"></a>
  <a href="https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd"><img src="https://img.shields.io/badge/Solana-Mainnet-blueviolet" alt="Solana"></a>
  <a href="#"><img src="https://img.shields.io/badge/Docker-Ready-blue" alt="Docker"></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.3-blue" alt="TypeScript"></a>
</p>

<p align="center">
  <strong>On-chain Reliable Alpha Compilation & Learning Engine</strong><br>
  AI-powered trading signal aggregator for Solana with <strong>verifiable on-chain performance tracking</strong>.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="docs/API.md">API Docs</a> •
  <a href="docs/DEPLOYMENT.md">Deploy</a>
</p>

---

> 🏆 **Built for Colosseum Agent Hackathon 2026** by ShifuSensei 🐼
>
> **Stop trusting. Start verifying.** Every signal published on-chain before the price moves.

## 🚀 Deployed on Solana

| Network | Program ID | Explorer |
|---------|------------|----------|
| **Mainnet** | `AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd` | [View](https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd) |
| Devnet | `AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd` | [View](https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd?cluster=devnet) |

## 🎯 What is ORACLE Alpha?

ORACLE Alpha is an **autonomous AI agent** that:
1. **Aggregates signals** from multiple sources (smart wallets, KOLs, volume spikes, narratives)
2. **Scores & ranks** signals using weighted algorithms and historical performance
3. **Publishes signals on-chain** for verifiable, trustless track record
4. **Tracks performance** with ATH updates and win/loss determination
5. **Alerts users** via Telegram when high-quality signals are detected

## ✨ Features

### 📡 Multi-Source Signal Aggregation
- **Smart Wallet Tracking** - 24 wallets (5 Elite 65%+ WR, 19 Sniper tier)
- **KOL Activity** - 31 KOLs tracked (S/A/B tier with win rates)
- **Volume Spike Detection** - Real-time volume anomaly detection
- **Narrative Detection** - AI, Meme, Political, Gaming, DeFi meta tracking
- **New Launch Scanner** - Fresh pump.fun token monitoring
- **Whale Accumulation** - Large wallet activity tracking

### 📊 Weighted Scoring System
- Historical win rate based weighting
- Multi-signal confluence detection
- Risk level assessment (LOW/MEDIUM/HIGH/EXTREME)
- Confidence scoring (0-100)

### 🔗 Verifiable On-Chain Records
- Anchor program for signal publishing
- Signal PDAs with performance tracking
- ATH tracking and ROI calculation
- Trustless verification via events
- Auto win/loss determination

### 📱 Real-Time Notifications
- REST API for querying signals
- WebSocket for live updates
- Dashboard for visual monitoring
- Telegram alerts for high-quality signals

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     ORACLE Alpha                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐          │
│  │  Smart    │  │  Volume   │  │   KOL     │          │
│  │  Wallets  │  │  Spikes   │  │  Tracker  │          │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘          │
│        │              │              │                 │
│        └──────────────┼──────────────┘                 │
│                       ▼                                │
│           ┌───────────────────┐                        │
│           │    Aggregator     │                        │
│           │  (Score + Rank)   │                        │
│           └─────────┬─────────┘                        │
│                     │                                  │
│        ┌────────────┼────────────┐                    │
│        ▼            ▼            ▼                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │   API    │ │ On-Chain │ │ Telegram │             │
│  │  Server  │ │ Publisher│ │  Alerts  │             │
│  └──────────┘ └──────────┘ └──────────┘             │
│                     │                                  │
│                     ▼                                  │
│           ┌───────────────────┐                        │
│           │  Solana Program   │                        │
│           │   (Verifiable)    │                        │
│           └───────────────────┘                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 🎬 Demo Mode (Recommended for First Look)

```bash
# Clone
git clone https://github.com/dynamolabs/oracle-alpha.git
cd oracle-alpha

# Install dependencies
npm install

# Run demo mode (generates realistic signals)
npm run demo

# Open in browser:
# Landing Page: http://localhost:3900/
# Dashboard:    http://localhost:3900/index.html
```

Demo mode auto-generates realistic signals with historical performance data - perfect for presentations!

### 🛠️ Full Setup

#### Prerequisites
- Node.js 18+
- Solana CLI (for on-chain features)
- Anchor (for development)

#### Installation

```bash
# Copy env file and configure
cp .env.example .env
# Edit .env with your API keys
```

#### Run Commands

```bash
# One-time scan (CLI)
npx ts-node src/cli.ts scan

# Run API server (production)
npm start
```

### 🎬 Demo Mode (for Presentations)

```bash
# Start server with demo mode (generates realistic signals)
DEMO_MODE=true npm start

# Or start demo mode via API
curl -X POST http://localhost:3900/api/demo/start

# Seed historical data (for track record display)
curl -X POST http://localhost:3900/api/demo/seed -H "Content-Type: application/json" -d '{"count": 30}'

# Stop demo mode
curl -X POST http://localhost:3900/api/demo/stop
```

Demo mode generates realistic trading signals with:
- Multiple signal sources (smart wallets, volume spikes, KOLs)
- Varied scores and risk levels
- Market data that looks real
- Historical signals with win/loss outcomes

### Run with PM2 (Production)

```bash
# Start with PM2
pm2 start "npx ts-node --transpile-only src/api/server.ts" --name oracle-alpha

# View logs
pm2 logs oracle-alpha
```

## 📡 API Endpoints

### Signals
- `GET /api/signals` - Get all signals (with optional filters)
- `GET /api/signals/:id` - Get signal by ID
- `POST /api/scan` - Trigger manual scan

### Stats
- `GET /api/stats` - Get signal statistics
- `GET /api/performance` - Get performance summary
- `GET /api/sources` - Get source breakdown

### On-Chain
- `GET /api/onchain/stats` - Get on-chain stats
- `GET /api/onchain/signals` - Get on-chain signals
- `POST /api/onchain/publish/:id` - Publish signal to chain

### WebSocket
- `ws://localhost:3900/ws` - Real-time signal updates

## 🤖 Agent Composability API (Colosseum Skill.json)

ORACLE Alpha exposes a **skill.json** endpoint for agent discovery, compatible with the Colosseum Agent Hackathon ecosystem. Other agents can consume our signals programmatically.

### Skill Discovery
```bash
# Get skill.json for agent integration
curl https://oracle-alpha.dynamolabs.xyz/skill.json
```

### Agent-Optimized Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/signals` | Real-time signals (agent-optimized format) |
| GET | `/api/agent/signals/latest` | Single best signal for quick decisions |
| GET | `/api/agent/signals/token/:address` | Signal for specific token |
| GET | `/api/agent/performance` | Performance metrics summary |
| GET | `/api/agent/performance/history` | Historical signal outcomes |
| GET | `/api/agent/leaderboard` | Top performing signals by ROI |
| GET | `/api/agent/sources` | Source reliability breakdown |
| GET | `/api/agent/onchain/verified` | On-chain verified signals |
| GET | `/api/agent/onchain/stats` | On-chain oracle statistics |

### Quick Start for Agents

```bash
# 1. Discover the skill
curl https://oracle-alpha.dynamolabs.xyz/skill.json

# 2. Get real-time signals (high score, low risk)
curl "https://oracle-alpha.dynamolabs.xyz/api/agent/signals?minScore=70&riskLevel=LOW&limit=5"

# 3. Get the best current signal
curl https://oracle-alpha.dynamolabs.xyz/api/agent/signals/latest

# 4. Check historical performance
curl https://oracle-alpha.dynamolabs.xyz/api/agent/performance

# 5. Verify on-chain track record
curl https://oracle-alpha.dynamolabs.xyz/api/agent/onchain/verified
```

### Example Response: `/api/agent/signals`

```json
{
  "count": 3,
  "timestamp": 1707012345678,
  "signals": [
    {
      "id": "sig_abc123",
      "token": "TokenMintAddress...",
      "symbol": "ALPHA",
      "score": 82,
      "confidence": 78,
      "riskLevel": "LOW",
      "sources": [
        {"type": "smart_wallet", "score": 85, "weight": 1.5},
        {"type": "volume_spike", "score": 72, "weight": 1.0}
      ],
      "marketData": {
        "price": 0.00234,
        "mcap": 1500000,
        "volume24h": 250000
      },
      "narratives": ["AI", "Meme"],
      "timestamp": 1707012300000,
      "age_minutes": 5,
      "onchain_published": true,
      "action": "STRONG_BUY"
    }
  ]
}
```

### WebSocket for Real-Time Streaming

```javascript
const ws = new WebSocket('wss://oracle-alpha.dynamolabs.xyz/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'signal') {
    console.log('New signal:', data.data.symbol, 'Score:', data.data.score);
  }
};
```

### Why Trust ORACLE Alpha Signals?

1. **Verifiable On-Chain** - High-confidence signals published to Solana BEFORE price moves
2. **Transparent Performance** - All historical outcomes publicly queryable
3. **Multi-Source Validation** - Signals confirmed by multiple independent sources
4. **Immutable Timestamps** - On-chain records cannot be retroactively modified

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | 3900 |
| `SOLANA_RPC_URL` | Solana RPC endpoint | mainnet-beta |
| `SOLANA_NETWORK` | Network name (mainnet-beta/devnet) | mainnet-beta |
| `ORACLE_PROGRAM_ID` | Program ID | `AL9bxB2BUH...` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | - |
| `HELIUS_API_KEY` | Helius API key (optional) | - |

## 🔮 On-Chain Program

The ORACLE Alpha Solana program provides:

### Instructions
1. **initialize** - Initialize the oracle with authority
2. **publish_signal** - Publish a new signal on-chain
3. **update_ath** - Update signal's all-time high price
4. **close_signal** - Close signal and record final ROI

### Accounts
- **OracleState** - Global state (total signals, wins, losses)
- **Signal** - Individual signal data (token, score, prices, status)

### Events
- **SignalPublished** - Emitted when signal is published
- **SignalClosed** - Emitted when signal is closed with ROI

## 📈 Scoring Algorithm

```
Base Score = Σ (source_score × source_weight)

Adjustments:
+ 15 points: Multiple signal sources (confluence)
+ 10 points: Smart wallet signal present
+ 5 points: Strong narrative match
- 10 points: Single source only
- 5 points: No market data available

Risk Level:
- LOW: Score ≥ 80, multiple sources
- MEDIUM: Score 60-79
- HIGH: Score 40-59
- EXTREME: Score < 40 or single source
```

## 🎯 Signal Sources

| Source | Weight | Description |
|--------|--------|-------------|
| Smart Wallet Elite | 1.5x | 70% historical win rate |
| Smart Wallet Sniper | 1.2x | 41% historical win rate |
| KOL Tracker | 1.1x | S/A/B tier KOL activity |
| Volume Spike | 1.0x | Unusual volume detection |
| Narrative | 1.0x | Meta/trend detection |
| New Launch | 0.9x | Fresh token scanner |
| Whale | 0.8x | Large wallet activity |

## 📊 Dashboard

Access the live dashboard at `http://localhost:3900` when the server is running.

Features:
- Real-time signal feed
- Score visualization
- Risk level badges
- Source breakdown
- On-chain stats
- Performance tracking

## 🔒 Security

- Wallet private key never exposed via API
- On-chain authority verification
- Rate limiting on API endpoints
- No external data storage (stateless)

## 📝 License

MIT

## 🤝 Contributing

PRs welcome! Please follow the existing code style.

## 🔗 Links

- [GitHub](https://github.com/dynamolabs/oracle-alpha)
- [Solana Explorer (Mainnet)](https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd)
- [Solana Explorer (Devnet)](https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd?cluster=devnet)
- [Colosseum Hackathon](https://colosseum.com/agent-hackathon)

---

Built with ❤️ by ShifuSensei 🐼 for Colosseum Agent Hackathon 2026
