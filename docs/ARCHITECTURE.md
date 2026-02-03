# 🏗️ ORACLE Alpha Architecture

## High-Level Overview

```mermaid
flowchart TB
    subgraph Sources["📡 Signal Sources"]
        SW[Smart Wallets<br/>24 wallets]
        VS[Volume Spikes]
        KOL[KOL Tracker<br/>31 KOLs]
        ND[Narrative Detection]
        NL[New Launch Scanner]
        WA[Whale Accumulation]
        NS[News Scraper]
        TW[Twitter KOL]
        PF[Pump.fun KOTH]
    end

    subgraph Core["🧠 Core Engine"]
        AGG[Signal Aggregator]
        SCR[Scoring Engine<br/>Weighted Algorithm]
        RANK[Signal Ranker]
        RISK[Risk Assessor]
    end

    subgraph OnChain["⛓️ On-Chain Layer"]
        PUB[Signal Publisher]
        SOL[Solana Program<br/>Anchor]
        ATH[ATH Tracker]
        WL[Win/Loss<br/>Determination]
    end

    subgraph Output["📤 Output Layer"]
        API[REST API<br/>:3900]
        WS[WebSocket<br/>Live Feed]
        TG[Telegram Bot]
        DC[Discord Bot]
        WH[Webhooks<br/>3Commas/Alertatron]
    end

    subgraph Analytics["📊 Analytics"]
        BT[Backtesting Engine]
        PERF[Performance Tracker]
        EXP[Data Export<br/>JSON/CSV/MD]
        DASH[Dashboard]
    end

    subgraph Business["💰 Business Layer"]
        SUB[Subscription Tiers<br/>Free/Basic/Pro/Elite]
        TG8[Token Gating]
        PAY[Payouts<br/>70/20/10]
        APIKEY[API Key Auth]
    end

    Sources --> AGG
    AGG --> SCR
    SCR --> RANK
    RANK --> RISK
    
    RISK --> PUB
    PUB --> SOL
    SOL --> ATH
    ATH --> WL
    
    RISK --> API
    RISK --> WS
    RISK --> TG
    RISK --> DC
    RISK --> WH
    
    SOL --> Analytics
    API --> Analytics
    
    SUB --> API
    TG8 --> SUB
    PAY --> Business
    APIKEY --> API
```

## Data Flow

```mermaid
sequenceDiagram
    participant S as Signal Sources
    participant A as Aggregator
    participant SC as Scoring Engine
    participant BC as Blockchain
    participant U as Users

    loop Every Scan Interval
        S->>A: Raw signals
        A->>SC: Aggregated data
        SC->>SC: Calculate scores
        SC->>BC: Publish signal (with timestamp)
        BC-->>BC: Store in PDA
        SC->>U: Notify (Telegram/Discord/API)
    end

    loop Price Tracking
        BC->>BC: Monitor ATH
        BC->>BC: Update ROI
        alt Price drops 50% from ATH
            BC->>BC: Mark as LOSS
        else Price > 2x entry
            BC->>BC: Mark as WIN
        end
    end
```

## Scoring Algorithm Flow

```mermaid
flowchart LR
    subgraph Input
        SRC1[Source 1<br/>Score: 85]
        SRC2[Source 2<br/>Score: 72]
        SRC3[Source 3<br/>Score: 68]
    end

    subgraph Weights
        W1[Elite Wallet: 1.5x]
        W2[KOL: 1.1x]
        W3[Volume: 1.0x]
    end

    subgraph Adjustments
        ADJ1["+15 Confluence"]
        ADJ2["+10 Smart Wallet"]
        ADJ3["-10 Single Source"]
    end

    subgraph Output
        FINAL[Final Score<br/>0-100]
        RISK2[Risk Level<br/>LOW/MED/HIGH/EXTREME]
        CONF[Confidence<br/>%]
    end

    SRC1 --> W1 --> ADJ1 --> FINAL
    SRC2 --> W2 --> ADJ2 --> FINAL
    SRC3 --> W3 --> ADJ3 --> FINAL
    FINAL --> RISK2
    FINAL --> CONF
```

## On-Chain Data Structure

```mermaid
erDiagram
    OracleState ||--o{ Signal : contains
    
    OracleState {
        pubkey authority
        u64 total_signals
        u64 total_wins
        u64 total_losses
        u64 created_at
    }
    
    Signal {
        pubkey oracle
        string token_address
        string token_symbol
        u8 score
        u8 risk_level
        u64 entry_price
        u64 ath_price
        i64 roi_bps
        u8 status
        u64 published_at
        u64 closed_at
    }
```

## Infrastructure

```mermaid
flowchart TB
    subgraph Cloud["☁️ Deployment"]
        DOCKER[Docker Container]
        PM2[PM2 Process Manager]
    end

    subgraph Monitoring["📈 Monitoring"]
        PROM[Prometheus Metrics]
        HEALTH[Health Checks]
        LOGS[JSON Logging]
    end

    subgraph External["🌐 External Services"]
        HELIUS[Helius RPC]
        SOLRPC[Solana RPC]
        TGAPI[Telegram API]
        DCAPI[Discord API]
    end

    DOCKER --> PM2
    PM2 --> Monitoring
    Cloud --> External
```

## Subscription Tiers

| Tier | Price | Features | Rate Limit |
|------|-------|----------|------------|
| Free | $0 | Public signals, delayed 15min | 10 req/hour |
| Basic | $29/mo | Real-time, API access | 100 req/hour |
| Pro | $99/mo | Webhooks, backtesting | 1000 req/hour |
| Elite | $299/mo | Custom sources, priority | Unlimited |

## Payout Structure

```
Signal Provider Payouts (70/20/10):
├── 70% → Signal Source Provider
├── 20% → ORACLE Platform
└── 10% → Stakers/Token Holders
```

---

*Architecture designed for scalability, verifiability, and trustless operation.*
