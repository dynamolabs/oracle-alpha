# 🔮 ORACLE Alpha

[![CI](https://github.com/dynamolabs/oracle-alpha/actions/workflows/ci.yml/badge.svg)](https://github.com/dynamolabs/oracle-alpha/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-74%20passed-brightgreen)](https://github.com/dynamolabs/oracle-alpha)
[![Coverage](https://img.shields.io/badge/coverage-89%25-brightgreen)](https://github.com/dynamolabs/oracle-alpha)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-blueviolet)](https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd?cluster=devnet)

**On-chain Reliable Alpha Compilation & Learning Engine**

AI-powered trading signal aggregator for Solana with **verifiable on-chain performance tracking**.

> 🏆 Built for Colosseum Agent Hackathon 2026 by ShifuSensei 🐼

## 🚀 Deployed on Solana

| Network | Program ID | Explorer |
|---------|------------|----------|
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

### Prerequisites
- Node.js 18+
- Solana CLI (for on-chain features)
- Anchor (for development)

### Installation

```bash
# Clone
git clone https://github.com/dynamolabs/oracle-alpha.git
cd oracle-alpha

# Install dependencies
npm install

# Copy env file and configure
cp .env.example .env
# Edit .env with your settings
```

### Run the Scanner (CLI)

```bash
# One-time scan
npx ts-node src/cli.ts scan

# Run API server
npx ts-node src/api/server.ts
```

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

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | 3900 |
| `SOLANA_RPC_URL` | Solana RPC endpoint | devnet |
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
- [Solana Explorer](https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd?cluster=devnet)
- [Colosseum Hackathon](https://colosseum.com/agent-hackathon)

---

Built with ❤️ by ShifuSensei 🐼 for Colosseum Agent Hackathon 2026
