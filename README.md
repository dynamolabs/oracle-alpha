# 🔮 ORACLE Alpha

**On-chain Reliable Alpha Compilation & Learning Engine**

AI-powered trading signal aggregator for Solana with verifiable on-chain performance tracking.

> Built for Colosseum Agent Hackathon 2026 by ShifuSensei 🐼

## Features

### 🎯 Multi-Source Signal Aggregation
- **Smart Wallet Tracking** - Elite (70% WR) and Sniper (41% WR) wallets
- **Volume Spike Detection** - Real-time volume anomaly detection
- **KOL Activity** - Track influential accounts and social mentions
- **Narrative Detection** - AI, Meme, Political, Gaming meta tracking
- **New Launch Scanner** - Fresh pump.fun token monitoring

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

### 📡 Real-Time API
- REST API for querying signals
- WebSocket for live updates
- Dashboard for visual monitoring
- Telegram alerts (optional)

## Quick Start

```bash
# Install dependencies
npm install

# Run the scanner CLI
npx ts-node src/cli.ts scan

# Start the API server
npx ts-node src/api/server.ts

# Or use PM2 for production
pm2 start "npx ts-node --transpile-only src/api/server.ts" --name oracle-alpha
```

## API Endpoints

### REST API (Port 3900)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/signals` | GET | Get aggregated signals |
| `/api/signals/:id` | GET | Get single signal |
| `/api/stats` | GET | Get performance stats |
| `/api/sources` | GET | Get source statistics |
| `/api/scan` | POST | Trigger manual scan |
| `/health` | GET | Health check |

### WebSocket

Connect to `ws://localhost:3900/ws` for real-time updates.

Messages:
- `history` - Initial signal history on connect
- `signal` - New signal detected

## CLI Commands

```bash
npx ts-node src/cli.ts scan      # Full aggregation
npx ts-node src/cli.ts wallets   # Smart wallet scan only
npx ts-node src/cli.ts volume    # Volume spike scan only
npx ts-node src/cli.ts kol       # KOL activity scan only
npx ts-node src/cli.ts narrative # Narrative scan only
npx ts-node src/cli.ts new       # New launch scan only
```

## Configuration

Environment variables:

```env
PORT=3900                    # API server port
HELIUS_API_KEY=xxx          # Helius RPC API key
BIRDEYE_API_KEY=xxx         # Birdeye API key (optional)
TELEGRAM_BOT_TOKEN=xxx      # Telegram bot token (optional)
TELEGRAM_CHAT_ID=xxx        # Telegram chat ID (optional)
```

## Signal Sources

### Smart Wallet Tracking
Monitors 8+ proven wallets with historical win rates:
- Elite Tier: 70%+ win rate wallets
- Sniper Tier: 40-60% win rate pump.fun snipers
- Tracker Tier: Early buyers for confluence detection

### Volume Spike Detection
Real-time monitoring for:
- 2x+ volume spikes
- 55%+ buy ratio
- $10K+ market cap, $3K+ liquidity
- Tokens under 2 hours old

### KOL & Narrative
- S/A/B tier KOL tracking
- Social mention aggregation
- Trending narrative detection (AI, Meme, Political, etc.)
- Multi-narrative crossover bonus

## Architecture

```
oracle-alpha/
├── src/
│   ├── aggregator/      # Signal aggregation engine
│   ├── sources/         # Signal source scanners
│   │   ├── smart-wallet.ts
│   │   ├── volume-spike.ts
│   │   ├── kol-tracker.ts
│   │   ├── narrative-detector.ts
│   │   └── new-launches.ts
│   ├── api/             # REST + WebSocket server
│   ├── utils/           # Token metadata, helpers
│   ├── notifications/   # Telegram integration
│   └── types/           # TypeScript types
├── programs/oracle/     # Anchor Solana program
└── app/                 # Dashboard frontend
```

## On-Chain Program (Anchor)

Instructions:
- `initialize` - Setup oracle with authority
- `publish_signal` - Record new signal on-chain
- `update_ath` - Update all-time-high for signal
- `close_signal` - Mark signal as win/loss with ROI

Signal PDA stores:
- Token address, symbol, score
- Entry price, ATH, exit price
- ROI in basis points
- Source bitmap, timestamps

## Performance Tracking

The oracle tracks:
- Total signals published
- Wins (50%+ gain) vs Losses
- Win rate over time
- Average ROI
- Best/worst trades

All metrics are verifiable on-chain.

## Dashboard

Access at `http://localhost:3900` when server is running.

Features:
- Live signal feed
- Stats overview
- Score visualization
- Risk level indicators
- Source breakdown

## License

MIT

---

Built with 💜 by ShifuSensei for Colosseum Agent Hackathon 2026
