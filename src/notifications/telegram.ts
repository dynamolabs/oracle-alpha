// Telegram Alert Integration
// Sends high-quality signals to Telegram channel/chat

import { AggregatedSignal } from '../types';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
}

export async function sendTelegramAlert(signal: AggregatedSignal): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[TG] Telegram not configured, skipping alert');
    return false;
  }

  const riskEmoji = {
    LOW: '🟢',
    MEDIUM: '🟡',
    HIGH: '🟠',
    EXTREME: '🔴'
  };

  const scoreEmoji =
    signal.score >= 80 ? '🔥' : signal.score >= 70 ? '⚡' : signal.score >= 60 ? '✨' : '📊';

  // Format sources
  const sources = signal.sources
    .map(s => {
      const emoji = s.source.includes('elite')
        ? '👑'
        : s.source.includes('sniper')
          ? '🎯'
          : s.source.includes('kol')
            ? '📢'
            : s.source.includes('volume')
              ? '📈'
              : s.source.includes('narrative')
                ? '📰'
                : '•';
      return `${emoji} ${s.source}`;
    })
    .join('\n');

  // Format narratives
  const narratives = signal.analysis?.narrative?.join(', ') || 'General';

  const message = `
${scoreEmoji} <b>ORACLE ALPHA SIGNAL</b> ${scoreEmoji}

<b>$${signal.symbol}</b> - ${signal.name}

📊 <b>Score:</b> ${signal.score}/100 ${riskEmoji[signal.riskLevel]} ${signal.riskLevel}
💰 <b>MCap:</b> $${(signal.marketData.mcap / 1000).toFixed(1)}K
💧 <b>Liquidity:</b> $${(signal.marketData.liquidity / 1000).toFixed(1)}K
📈 <b>Vol 5m:</b> $${(signal.marketData.volume5m / 1000).toFixed(1)}K
⏱ <b>Age:</b> ${signal.marketData.age}m

🎯 <b>Sources:</b>
${sources}

📰 <b>Narrative:</b> ${narratives}

💡 <b>Analysis:</b> ${signal.analysis?.recommendation || 'N/A'}

<code>${signal.token}</code>

<a href="https://dexscreener.com/solana/${signal.token}">DexScreener</a> | <a href="https://birdeye.so/token/${signal.token}?chain=solana">Birdeye</a> | <a href="https://pump.fun/${signal.token}">Pump.fun</a>

🔮 <i>ORACLE Alpha - Verifiable Alpha</i>
`.trim();

  // Inline keyboard with quick action buttons
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '📊 DexScreener', url: `https://dexscreener.com/solana/${signal.token}` },
        { text: '🦅 Birdeye', url: `https://birdeye.so/token/${signal.token}?chain=solana` }
      ],
      [
        { text: '🎰 Pump.fun', url: `https://pump.fun/${signal.token}` },
        { text: '⛓️ Solscan', url: `https://solscan.io/token/${signal.token}` }
      ]
    ]
  };

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: inlineKeyboard
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`[TG] Alert sent for ${signal.symbol}`);
      return true;
    } else {
      console.error('[TG] Failed to send alert:', result.description);
      return false;
    }
  } catch (error) {
    console.error('[TG] Error sending alert:', error);
    return false;
  }
}

// Filter for high-quality signals worth alerting
export function shouldAlert(signal: AggregatedSignal): boolean {
  // Only alert for score >= 65
  if (signal.score < 65) return false;

  // Skip if no sources
  if (signal.sources.length === 0) return false;

  // Prefer signals with elite/sniper wallets
  const hasSmartWallet = signal.sources.some(s => s.source.includes('smart-wallet'));

  // Lower threshold for smart wallet signals
  if (hasSmartWallet) return signal.score >= 60;

  // Higher threshold for other signals
  return signal.score >= 70;
}

export async function sendBatchSummary(signals: AggregatedSignal[]): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  if (signals.length === 0) return;

  const topSignals = signals.slice(0, 5);

  const message = `
📊 <b>ORACLE Alpha - Signal Summary</b>

Found ${signals.length} signals this scan

<b>Top 5:</b>
${topSignals
  .map((s, i) => `${i + 1}. <b>$${s.symbol}</b> - Score: ${s.score} (${s.riskLevel})`)
  .join('\n')}

🔮 <i>Live at dashboard</i>
`.trim();

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
  } catch (error) {
    console.error('[TG] Error sending summary:', error);
  }
}
