#!/bin/bash
# ORACLE Alpha - Mainnet Deployment Script
# Requires ~2.5 SOL in wallet for rent exemption

set -e

PROGRAM_ID="AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd"
WALLET_PATH="$HOME/.config/solana/id.json"
RPC_URL="https://api.mainnet-beta.solana.com"

echo "🔮 ORACLE Alpha - Mainnet Deployment"
echo "======================================"

# Check wallet balance
BALANCE=$(solana balance --url mainnet-beta)
echo "Wallet balance: $BALANCE"

# Check if we have enough SOL (need ~2.5 SOL)
BALANCE_NUM=$(echo $BALANCE | grep -oP '[\d.]+')
MIN_BALANCE=2.5

if (( $(echo "$BALANCE_NUM < $MIN_BALANCE" | bc -l) )); then
    echo "❌ Insufficient balance! Need at least 2.5 SOL for deployment"
    echo "   Wallet address: $(solana address)"
    echo "   Please fund the wallet and try again."
    exit 1
fi

echo "✅ Sufficient balance for deployment"

# Configure for mainnet
echo "📝 Configuring for mainnet..."
solana config set --url mainnet-beta

# Build program
echo "🔨 Building program..."
cd "$(dirname "$0")/.."
anchor build

# Deploy to mainnet
echo "🚀 Deploying to mainnet..."
anchor deploy --provider.cluster mainnet

echo "✅ Deployment complete!"
echo ""
echo "Program ID: $PROGRAM_ID"
echo "Explorer: https://explorer.solana.com/address/$PROGRAM_ID"
echo ""
echo "Next steps:"
echo "1. Initialize the Oracle: solana-keygen pubkey $WALLET_PATH"
echo "2. Update .env with mainnet RPC"
echo "3. Restart the API server"
