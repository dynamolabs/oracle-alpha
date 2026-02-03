# 🔮 ORACLE Alpha API Reference

Base URL: `http://localhost:3900`

## Core Endpoints

### Health & Info

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/info` | GET | Project info and version |
| `/api/status` | GET | Full system status (JSON) |
| `/api/status/text` | GET | Text status for CLI/agents |
| `/metrics` | GET | Prometheus metrics |

### Signals

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/signals` | GET | List signals with filters |
| `/api/signals/:id` | GET | Get signal by ID |
| `/api/scan` | POST | Trigger manual scan |
| `/api/sources` | GET | Signal source breakdown |
| `/api/gainers` | GET | Top gainers (last hour) |
| `/api/summary` | GET | Shareable summary text |

**Query Parameters for `/api/signals`:**
- `minScore` - Minimum score filter (0-100)
- `maxAge` - Maximum age in minutes
- `limit` - Results limit (default: 20)
- `includePerformance` - Include perf data (true/false)

### Performance

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats` | GET | Signal statistics |
| `/api/performance` | GET | Performance summary |
| `/api/leaderboard` | GET | Top performing tokens |
| `/api/tracked` | GET | All tracked signals |
| `/api/tracked/:id` | GET | Single tracked signal |
| `/api/performance/update` | POST | Trigger price update |

### On-Chain

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/onchain/stats` | GET | On-chain publishing stats |
| `/api/onchain/signals` | GET | Signals published on-chain |
| `/api/onchain/publish/:id` | POST | Publish signal to Solana |

### Subscriptions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/subscription/tiers` | GET | Available subscription tiers |
| `/api/subscription/:wallet` | GET | Check wallet's subscription |
| `/api/subscription/:wallet/signals` | GET | Get tier-filtered signals |

### Demo Mode 🎬

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/demo/status` | GET | Demo mode status |
| `/api/demo/start` | POST | Start demo signal generator |
| `/api/demo/stop` | POST | Stop demo generator |
| `/api/demo/seed` | POST | Seed historical data |
| `/api/demo/signal` | POST | Generate single demo signal |

**Body for `/api/demo/start`:**
```json
{ "signalsPerMinute": 4 }
```

**Body for `/api/demo/seed`:**
```json
{ "count": 30 }
```

## WebSocket

Connect to `ws://localhost:3900/ws` for real-time updates.

### Messages

**Incoming (server → client):**
```json
// On connect - recent history
{ "type": "history", "data": [...signals] }

// New signal
{ "type": "signal", "data": { ...signal } }

// Pong response
{ "type": "pong" }
```

**Outgoing (client → server):**
```json
// Keep-alive ping
{ "type": "ping" }
```

## Response Types

### Signal Object
```typescript
{
  id: string;
  timestamp: number;
  token: string;           // Solana address
  symbol: string;
  name: string;
  score: number;           // 0-100
  confidence: number;      // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  sources: Array<{
    source: string;
    weight: number;
    rawScore: number;
  }>;
  marketData: {
    price?: number;
    mcap: number;
    liquidity: number;
    volume5m: number;
    volume1h: number;
    priceChange5m: number;
    priceChange1h: number;
    holders?: number;
    age: number;           // minutes
  };
  analysis: {
    narrative: string[];
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
  };
  performance?: {
    entryPrice: number;
    currentPrice: number;
    athPrice: number;
    roi: number;
    athRoi: number;
    status: 'OPEN' | 'WIN' | 'LOSS';
  };
}
```

### Stats Object
```typescript
{
  totalSignals: number;
  openSignals: number;
  closedSignals: number;
  wins: number;
  losses: number;
  winRate: string;       // e.g., "63.3"
  avgScore: string;
  avgRoi: string;
  lastSignalAt: number;
}
```

## Rate Limits

| Tier | Limit |
|------|-------|
| General | 100 req/min |
| Scan/Publish | 10 req/min |

## Authentication

API keys are validated via the `Authorization` header:
```
Authorization: Bearer <api_key>
```

Free tier has limited features. Upgrade for full access.

---

*Built by ShifuSensei 🐼 for Colosseum Agent Hackathon 2026*
