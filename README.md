# 🔮 ORACLE Alpha

**On-chain Reliable Alpha Compilation & Learning Engine**

> AI-powered alpha signal aggregator with verifiable on-chain track record.

## Overview

ORACLE aggregates trading signals from multiple sources, applies AI-weighted scoring, and publishes results to Solana for immutable track record verification.

**Built for Colosseum Agent Hackathon 2026**

## Features

- 🧠 **Multi-source Signal Aggregation** - Smart wallets, volume spikes, KOL tracking, narrative detection
- ⚖️ **AI Weighted Scoring** - Signals weighted by historical performance
- ⛓️ **On-chain Verification** - Track record stored immutably on Solana
- 📊 **Verifiable Performance** - Anyone can audit historical calls
- 🔌 **Composable API** - Other agents can subscribe to signals

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 SIGNAL SOURCES                       │
├─────────────┬─────────────┬─────────────┬───────────┤
│ Smart       │ Volume      │ KOL         │ Narrative │
│ Wallets     │ Detection   │ Tracking    │ Analysis  │
└──────┬──────┴──────┬──────┴──────┬──────┴─────┬─────┘
       │             │             │            │
       ▼             ▼             ▼            ▼
┌─────────────────────────────────────────────────────┐
│              AGGREGATION ENGINE                      │
│  • Normalize signals to common format               │
│  • Apply source weights (by historical perf)        │
│  • Calculate composite score                        │
│  • Risk assessment                                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│               SOLANA PROGRAM                         │
│  • Store signal history (compressed)                │
│  • Track record PDAs                                │
│  • Performance metrics                              │
│  • Subscription management                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                    API/SDK                           │
│  • REST API for queries                             │
│  • WebSocket for real-time signals                  │
│  • SDK for agent integration                        │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

- **Blockchain:** Solana (Anchor framework)
- **Backend:** TypeScript/Node.js
- **Data Sources:** Helius, DexScreener, Birdeye
- **Storage:** On-chain PDAs + off-chain indexer

## Quick Start

```bash
# Install dependencies
npm install

# Run aggregator
npm run start

# Run tests
npm test
```

## Project Structure

```
oracle-alpha/
├── programs/           # Solana programs (Anchor)
│   └── oracle/
├── src/
│   ├── aggregator/     # Signal aggregation engine
│   ├── sources/        # Signal source adapters
│   ├── scoring/        # AI scoring system
│   └── api/            # REST/WebSocket API
├── app/                # Frontend (optional)
├── tests/              # Integration tests
└── sdk/                # Client SDK
```

## Roadmap

- [x] Project setup
- [ ] Core aggregator engine
- [ ] Solana program
- [ ] API endpoints
- [ ] Frontend dashboard
- [ ] Documentation

## License

MIT

---

Built by **ShifuSensei** 🐼 for Colosseum Agent Hackathon 2026
