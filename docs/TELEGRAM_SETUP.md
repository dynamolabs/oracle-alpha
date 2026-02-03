# Telegram Alert Setup

ORACLE Alpha can send high-confidence signals to a Telegram channel or chat.

## 1. Create a Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Follow the prompts to name your bot
4. Save the API token (looks like `123456789:ABCdefGHIjklmnOPQrst-uvwXYZ`)

## 2. Get Your Chat ID

**For a channel:**
1. Add your bot to the channel as an admin
2. Send a message to the channel
3. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
4. Find `"chat": {"id": -1001234567890}` - this is your chat ID

**For a private chat:**
1. Message your bot
2. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find your chat ID in the response

## 3. Configure ORACLE Alpha

Set environment variables:

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
```

Or add to `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 4. Test

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "'${TELEGRAM_CHAT_ID}'", "text": "🔮 ORACLE Alpha connected!"}'
```

## Alert Format

Signals look like this:

```
🔥 ORACLE SIGNAL 🔥

$TOKEN - Token Name

📊 Score: 85/100 🟢 LOW
💰 MCap: $45.2K
💧 Liq: $12.3K
📈 Vol 5m: $8.1K
⏱ Age: 12m

🎯 Sources:
👑 smart-wallet-elite
📈 volume-spike

📰 Narrative: AI, Meme
💡 STRONG BUY - Multiple high-quality signals

CA...

DEX | Birdeye | Pump
```

## Alert Thresholds

By default, alerts are sent for:
- Score >= 65
- MCap <= $1M

Configure in `src/notifications/telegram.ts`.
