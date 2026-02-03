# ORACLE Alpha - Deployment Guide

## Prerequisites

### 1. Install Solana CLI
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
```

### 2. Install Anchor CLI
```bash
# Requires Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli
anchor --version
```

### 3. Configure Wallet
```bash
# Generate new wallet (or use existing)
solana-keygen new -o ~/.config/solana/id.json

# Check address
solana address

# Fund wallet (mainnet requires ~2 SOL for deployment)
```

## Deployment

### Devnet (Testing)
```bash
# Set cluster
solana config set --url devnet

# Airdrop test SOL
solana airdrop 2

# Deploy
anchor build
anchor deploy --provider.cluster devnet
```

### Mainnet (Production)
```bash
# Set cluster
solana config set --url mainnet-beta

# Check balance (need ~2 SOL)
solana balance

# Deploy
./scripts/deploy-mainnet.sh
```

## Post-Deployment

### 1. Update Anchor.toml
```toml
[programs.mainnet]
oracle = "YOUR_MAINNET_PROGRAM_ID"

[provider]
cluster = "mainnet"
```

### 2. Update Environment
```bash
# .env
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### 3. Initialize State
```bash
npm run init:mainnet
```

## Verification

### Check Program
```bash
# View program info
solana program show <PROGRAM_ID>

# View program accounts
solana account <PROGRAM_ID>
```

### Test API
```bash
curl http://localhost:3900/health
curl http://localhost:3900/api/onchain/stats
```

## Costs

| Action | Estimated Cost |
|--------|---------------|
| Initial Deploy | ~1.5-2 SOL |
| Upgrade | ~0.01 SOL |
| Publish Signal | ~0.00001 SOL |
| Update ATH | ~0.00001 SOL |

## Troubleshooting

### "Insufficient funds"
```bash
# Check balance
solana balance

# Devnet: airdrop more
solana airdrop 2
```

### "Program deploy failed"
```bash
# Retry with more compute
anchor deploy --provider.cluster mainnet -- --max-len 300000
```

### "Account already exists"
```bash
# The program is already deployed - upgrade instead
anchor upgrade target/deploy/oracle.so --program-id <PROGRAM_ID>
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 ORACLE Alpha Program                 │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   State     │  │   Signal    │  │    ATH      │ │
│  │  Account    │  │  Account    │  │   Tracker   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────┤
│  Instructions:                                       │
│  • initialize()    - Set up state                   │
│  • publish_signal() - Record signal on-chain        │
│  • update_ath()    - Track all-time high            │
│  • close_signal()  - Finalize win/loss              │
└─────────────────────────────────────────────────────┘
```
