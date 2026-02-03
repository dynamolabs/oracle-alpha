#!/bin/bash
# Quick deploy script for ORACLE Alpha

set -e

echo "🔮 ORACLE Alpha Quick Deploy"
echo "============================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway..."
    railway login
fi

# Initialize if not already
if [ ! -f "railway.json" ] && [ ! -f ".railway" ]; then
    echo "🚀 Initializing Railway project..."
    railway init
fi

# Set environment variables
echo "⚙️  Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3900
railway variables set SOLANA_CLUSTER=devnet

# Deploy
echo "🚀 Deploying to Railway..."
railway up

# Get the domain
echo ""
echo "✅ Deployment complete!"
echo ""
echo "Getting your URL..."
railway domain || echo "Run 'railway domain' to generate a public URL"

echo ""
echo "🎉 Done! Your ORACLE Alpha instance should be live soon."
