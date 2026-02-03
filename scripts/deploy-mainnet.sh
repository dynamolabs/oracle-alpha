#!/bin/bash

# ORACLE Alpha - Mainnet Deployment Script
# Prerequisites:
# 1. Solana CLI installed (sh -c "$(curl -sSfL https://release.solana.com/stable/install)")
# 2. Anchor CLI installed (cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli)
# 3. Wallet with ~2 SOL for deployment (solana balance)
# 4. Update Anchor.toml with mainnet config

set -e

echo "🔮 ORACLE Alpha - Mainnet Deployment"
echo "====================================="

# Check if solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Install with:"
    echo "   sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
    exit 1
fi

# Check if anchor CLI is installed
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found. Install with:"
    echo "   cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli"
    exit 1
fi

# Check wallet balance
BALANCE=$(solana balance --url mainnet-beta 2>&1 | grep -oP '[\d.]+' | head -1)
echo "💰 Wallet balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "⚠️  Warning: Low balance. Deployment requires ~2 SOL"
    echo "   Fund your wallet: $(solana address)"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build program
echo "🔨 Building program..."
anchor build

# Get program keypair
PROGRAM_KEYPAIR="target/deploy/oracle-keypair.json"
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "❌ Program keypair not found at $PROGRAM_KEYPAIR"
    exit 1
fi

# Deploy to mainnet
echo "🚀 Deploying to mainnet-beta..."
anchor deploy --provider.cluster mainnet

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/oracle-keypair.json)
echo ""
echo "✅ Deployment successful!"
echo "====================================="
echo "Program ID: $PROGRAM_ID"
echo "Explorer: https://explorer.solana.com/address/$PROGRAM_ID"
echo ""
echo "📝 Next steps:"
echo "1. Update Anchor.toml with mainnet program ID"
echo "2. Update .env with SOLANA_CLUSTER=mainnet-beta"
echo "3. Update README.md with mainnet explorer link"
