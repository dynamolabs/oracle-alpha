---
name: oracle-alpha
version: 1.0.0
description: AI-powered trading signal aggregator for Solana with 8 signal sources and real-time performance tracking.
author: ShifuSensei
homepage: https://github.com/dynamolabs/oracle-alpha
---

# ORACLE Alpha

On-chain Reliable Alpha Compilation & Learning Engine.

AI-powered trading signal aggregator that combines multiple data sources into weighted confidence scores for Solana tokens.

## Quick Start

```bash
# Get current signals
curl https://oracle-alpha.example.com/api/signals

# Get high-confidence signals only
curl https://oracle-alpha.example.com/api/signals?minScore=70

# Get performance stats
curl https://oracle-alpha.example.com/api/performance

# Get system status
curl https://oracle-alpha.example.com/api/status
```

## Signal Sources

ORACLE Alpha aggregates 8 independent signal sources:

| Source | Description | Weight |
|--------|-------------|--------|
| `smart-wallet-elite` | Elite wallets with 70% historical win rate | 1.5x |
| `smart-wallet-sniper` | Pump.fun snipers with 40%+ win rate | 1.2x |
| `volume-spike` | Volume anomaly detection | 1.0x |
| `kol-tracker` | Direct KOL mentions | 1.1x |
| `kol-social` | Social mention aggregation | 0.9x |
| `narrative-new` | New tokens in hot narratives | 1.0x |
| `narrative-momentum` | Trending narrative plays | 1.2x |
| `whale-tracker` | Whale accumulation patterns | 1.0x |

## API Reference

### GET /api/signals

Returns aggregated signals sorted by score.

**Query Parameters:**
- `minScore` (number): Minimum score filter (0-100)
- `maxAge` (number): Maximum age in minutes
- `limit` (number): Max results (default: 20)

**Response:**
```json
{
  "count": 5,
  "signals": [
    {
      "id": "uuid",
      "token": "CA...",
      "symbol": "TOKEN",
      "name": "Token Name",
      "score": 78,
      "riskLevel": "MEDIUM",
      "sources": [
        { "source": "smart-wallet-elite", "weight": 1.5, "rawScore": 70 }
      ],
      "marketData": {
        "mcap": 50000,
        "liquidity": 10000,
        "volume5m": 5000,
        "age": 15
      },
      "analysis": {
        "narrative": ["AI", "Meme"],
        "recommendation": "BUY - Good signal confluence"
      }
    }
  ]
}
```

### GET /api/performance

Returns tracking performance metrics.

**Response:**
```json
{
  "total": 25,
  "open": 20,
  "wins": 3,
  "losses": 2,
  "winRate": 60.0,
  "avgRoi": 45.5,
  "avgAthRoi": 120.3,
  "bestTrade": { "symbol": "BEST", "athRoi": 500.0 },
  "worstTrade": { "symbol": "WORST", "athRoi": -50.0 }
}
```

### GET /api/tracked

Returns all tracked signals with live prices.

**Response:**
```json
{
  "count": 20,
  "signals": [
    {
      "id": "uuid",
      "token": "CA...",
      "symbol": "TOKEN",
      "entryPrice": 0.001,
      "currentPrice": 0.0015,
      "athPrice": 0.002,
      "roi": 50.0,
      "athRoi": 100.0,
      "status": "OPEN"
    }
  ]
}
```

### GET /api/status

Returns system health and configuration.

### POST /api/scan

Triggers a manual signal scan. Returns new signals found.

### WebSocket /ws

Real-time signal updates.

**Messages:**
- `{ "type": "history", "data": [...] }` - Initial history on connect
- `{ "type": "signal", "data": {...} }` - New signal detected

## Integration Example

```javascript
// Fetch high-confidence signals
const response = await fetch('https://oracle-alpha.example.com/api/signals?minScore=70');
const { signals } = await response.json();

// Process signals
for (const signal of signals) {
  if (signal.score >= 80 && signal.riskLevel !== 'EXTREME') {
    console.log(`High confidence: ${signal.symbol} (${signal.score})`);
    // Execute your trading logic
  }
}
```

## Risk Levels

- **LOW**: Multiple high-quality sources, elite wallet involved
- **MEDIUM**: Good confluence, acceptable risk
- **HIGH**: Single source or moderate confidence
- **EXTREME**: Very early/risky, needs confirmation

## Score Interpretation

- **80-100**: Strong buy signal, multiple sources agree
- **70-79**: Good signal, worth considering
- **60-69**: Moderate signal, needs more confirmation
- **50-59**: Weak signal, high risk
- **<50**: Not recommended

## Notes

- Signals are refreshed every 30 seconds
- Performance tracking updates every 60 seconds
- High-score signals (65+) are auto-tracked for ROI calculation
- All data is for informational purposes - DYOR

## Contact

Built by ShifuSensei for Colosseum Agent Hackathon 2026.
GitHub: https://github.com/dynamolabs/oracle-alpha
