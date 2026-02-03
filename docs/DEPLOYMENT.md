# 🚀 ORACLE Alpha Deployment Guide

## Quick Deploy Options

### Option 1: Railway (Recommended for Demo)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
cd oracle-alpha
railway init

# 4. Add environment variables
railway variables set SOLANA_CLUSTER=devnet
railway variables set PORT=3900
# Add other vars as needed

# 5. Deploy
railway up

# Get your URL
railway domain
```

**Pros:** Free tier, auto HTTPS, easy  
**Cons:** Sleep after 30min inactivity on free

---

### Option 2: Render

```bash
# Create render.yaml
cat > render.yaml << 'EOF'
services:
  - type: web
    name: oracle-alpha
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3900
      - key: SOLANA_CLUSTER
        value: devnet
EOF

# Push to GitHub, connect Render to repo
```

**Pros:** Free tier, auto HTTPS, no sleep  
**Cons:** Slower cold starts

---

### Option 3: Fly.io

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Launch
fly launch --name oracle-alpha

# 4. Set secrets
fly secrets set SOLANA_CLUSTER=devnet
fly secrets set HELIUS_API_KEY=xxx

# 5. Deploy
fly deploy
```

**Pros:** Fast, global edge, generous free tier  
**Cons:** Slightly more complex

---

### Option 4: Docker on VPS

```bash
# On your VPS (e.g., Vultr, DigitalOcean)

# 1. Clone repo
git clone https://github.com/dynamolabs/oracle-alpha.git
cd oracle-alpha

# 2. Create .env
cp .env.example .env
nano .env  # Add your keys

# 3. Run with docker-compose
docker-compose up -d

# 4. Check logs
docker-compose logs -f

# 5. Setup nginx reverse proxy (optional)
# For HTTPS with Let's Encrypt
```

---

### Option 5: Vercel (API Only)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Create vercel.json
cat > vercel.json << 'EOF'
{
  "version": 2,
  "builds": [
    {
      "src": "src/api/server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/api/server.ts"
    }
  ]
}
EOF

# 3. Deploy
vercel --prod
```

**Pros:** Great for API, auto scaling  
**Cons:** No WebSocket on free tier

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API port (default: 3900) |
| `NODE_ENV` | No | Environment (production/development) |
| `SOLANA_CLUSTER` | No | mainnet/devnet (default: devnet) |
| `SOLANA_RPC_URL` | No | Custom RPC URL |
| `HELIUS_API_KEY` | No | For enhanced RPC |
| `TELEGRAM_BOT_TOKEN` | No | Telegram alerts |
| `TELEGRAM_CHAT_ID` | No | Telegram channel |
| `DISCORD_WEBHOOK_URL` | No | Discord alerts |

---

## Recommended for Hackathon Demo

**Railway** - fastest to deploy, good enough for demo, free

```bash
# One-liner deploy
railway login && railway init && railway up && railway domain
```

Your demo URL will be something like:  
`https://oracle-alpha-production.up.railway.app`

---

## Health Check Endpoints

After deployment, verify:

```bash
# Health check
curl https://your-app.railway.app/health

# API test
curl https://your-app.railway.app/api/signals

# Stats
curl https://your-app.railway.app/api/stats
```

---

## Post-Deploy Checklist

- [ ] Health endpoint responding
- [ ] API returning data
- [ ] WebSocket connecting (if supported)
- [ ] Telegram alerts working
- [ ] On-chain publishing working
- [ ] Dashboard accessible

---

*Deploy guide by ShifuSensei 🐼*
