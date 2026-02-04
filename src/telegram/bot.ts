/**
 * ORACLE Alpha Telegram Bot
 * Full-featured bot with commands, inline keyboards, and subscriber management
 */

import { AggregatedSignal, SignalSource, RiskLevel } from '../types';
import {
  loadSubscribers,
  saveSubscribers,
  getSubscriber,
  addSubscriber,
  removeSubscriber,
  updateSubscriber,
  Subscriber,
  SubscriberPrefs
} from './subscribers';
import { getTrackedSignals, getPerformanceSummary } from '../tracker/performance';
import { SOURCE_CONFIGS } from '../aggregator';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Risk level emojis and colors
const RISK_EMOJI: Record<RiskLevel, string> = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🟠',
  EXTREME: '🔴'
};

const SCORE_EMOJI = (score: number): string => {
  if (score >= 85) return '🔥🔥';
  if (score >= 80) return '🔥';
  if (score >= 70) return '⚡';
  if (score >= 60) return '✨';
  return '📊';
};

// Source emojis
const SOURCE_EMOJI: Record<string, string> = {
  'smart-wallet-elite': '👑',
  'smart-wallet-sniper': '🎯',
  'kol-tracker': '📢',
  'kol-social': '🐦',
  'volume-spike': '📈',
  'narrative-new': '📰',
  'narrative-momentum': '🚀',
  'pump-koth': '🎰',
  'whale-tracker': '🐋',
  'news-scraper': '📰',
  dexscreener: '🦎'
};

// In-memory signal store reference (will be set from server)
let signalStoreRef: AggregatedSignal[] = [];

export function setSignalStore(store: AggregatedSignal[]) {
  signalStoreRef = store;
}

// Telegram API helper
async function sendTelegramRequest(method: string, body: any): Promise<any> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('[TG-BOT] No bot token configured');
    return null;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    console.error(`[TG-BOT] API error (${method}):`, error);
    return null;
  }
}

// Send message with optional inline keyboard
export async function sendMessage(
  chatId: string | number,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disablePreview?: boolean;
    replyMarkup?: any;
  }
): Promise<boolean> {
  const result = await sendTelegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode || 'HTML',
    disable_web_page_preview: options?.disablePreview ?? true,
    reply_markup: options?.replyMarkup
  });

  return result?.ok || false;
}

// Answer callback query
export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await sendTelegramRequest('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text
  });
}

// Edit message
export async function editMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: any
): Promise<boolean> {
  const result = await sendTelegramRequest('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: replyMarkup
  });

  return result?.ok || false;
}

// =============== COMMANDS ===============

/**
 * /start - Welcome message with quick actions
 */
export async function handleStart(chatId: string | number): Promise<void> {
  const text = `
🔮 <b>Welcome to ORACLE Alpha Bot!</b>

I detect high-quality Solana token signals using:
• 👑 Smart Wallet Tracking
• 📢 KOL Activity Monitoring  
• 📈 Volume Spike Detection
• 🎰 Pump.fun KOTH Analysis
• And 4 more signal sources!

<b>Quick Start:</b>
/subscribe - Get real-time alerts
/top - View today's top signals
/performance - See win rate & ROI

<i>Verifiable on-chain signals powered by AI</i>
`.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔔 Subscribe', callback_data: 'cmd_subscribe' },
        { text: '📊 Top Signals', callback_data: 'cmd_top' }
      ],
      [
        { text: '📈 Performance', callback_data: 'cmd_performance' },
        { text: '🎯 Sources', callback_data: 'cmd_sources' }
      ],
      [{ text: '💰 Portfolio Sim', callback_data: 'cmd_portfolio_1000' }]
    ]
  };

  await sendMessage(chatId, text, { replyMarkup: keyboard });
}

/**
 * /help - Command list
 */
export async function handleHelp(chatId: string | number): Promise<void> {
  const text = `
🔮 <b>ORACLE Alpha Commands</b>

<b>Alerts:</b>
/subscribe [score] - Subscribe to alerts (default: 70)
/unsubscribe - Stop receiving alerts
/settings - View your alert preferences

<b>Signals:</b>
/top - Top 5 signals today
/latest - Most recent signal
/token [CA] - Check specific token

<b>Analytics:</b>
/performance - Win rate & ROI stats
/sources - Active signal sources
/portfolio [amount] - Portfolio simulation

<b>Example:</b>
<code>/subscribe 75</code> - Only alerts ≥75 score
<code>/portfolio 5000</code> - Simulate $5000 portfolio
`.trim();

  await sendMessage(chatId, text);
}

/**
 * /subscribe [minScore] - Subscribe to alerts
 */
export async function handleSubscribe(
  chatId: string | number,
  args: string[],
  userId?: string
): Promise<void> {
  const minScore = args[0] ? Math.min(100, Math.max(50, parseInt(args[0]) || 70)) : 70;
  const userIdStr = userId || String(chatId);

  const subscriber = getSubscriber(userIdStr);

  if (subscriber) {
    // Update existing subscription
    updateSubscriber(userIdStr, { minScore });

    const text = `
✅ <b>Subscription Updated!</b>

Min Score: <b>${minScore}</b>
Risk Filter: <b>${subscriber.prefs.riskLevels.join(', ')}</b>

You'll receive alerts for signals scoring ≥${minScore}.

<i>Use /settings to customize further</i>
`.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '⬆️ Score 80', callback_data: 'set_score_80' },
          { text: '⬇️ Score 60', callback_data: 'set_score_60' }
        ],
        [{ text: '⚙️ More Settings', callback_data: 'cmd_settings' }]
      ]
    };

    await sendMessage(chatId, text, { replyMarkup: keyboard });
  } else {
    // New subscription
    addSubscriber(userIdStr, String(chatId), { minScore });

    const text = `
🔔 <b>Subscribed to ORACLE Alpha!</b>

Min Score: <b>${minScore}</b>
Risk Levels: <b>LOW, MEDIUM, HIGH</b>

You'll receive real-time alerts when high-quality signals are detected.

<i>Tip: Higher scores = better quality signals</i>
<i>70+ is recommended, 80+ for premium signals</i>
`.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '⬆️ Set 80+', callback_data: 'set_score_80' },
          { text: '🔕 Unsubscribe', callback_data: 'cmd_unsubscribe' }
        ]
      ]
    };

    await sendMessage(chatId, text, { replyMarkup: keyboard });
  }
}

/**
 * /unsubscribe - Stop alerts
 */
export async function handleUnsubscribe(chatId: string | number, userId?: string): Promise<void> {
  const userIdStr = userId || String(chatId);
  const subscriber = getSubscriber(userIdStr);

  if (subscriber) {
    removeSubscriber(userIdStr);

    const text = `
🔕 <b>Unsubscribed</b>

You will no longer receive signal alerts.

<i>You can resubscribe anytime with /subscribe</i>
`.trim();

    const keyboard = {
      inline_keyboard: [[{ text: '🔔 Resubscribe', callback_data: 'cmd_subscribe' }]]
    };

    await sendMessage(chatId, text, { replyMarkup: keyboard });
  } else {
    await sendMessage(chatId, "You're not subscribed. Use /subscribe to start receiving alerts.");
  }
}

/**
 * /settings - View and modify preferences
 */
export async function handleSettings(chatId: string | number, userId?: string): Promise<void> {
  const userIdStr = userId || String(chatId);
  const subscriber = getSubscriber(userIdStr);

  if (!subscriber) {
    await sendMessage(chatId, "You're not subscribed yet. Use /subscribe to start.");
    return;
  }

  const { prefs } = subscriber;

  const text = `
⚙️ <b>Your Alert Settings</b>

📊 Min Score: <b>${prefs.minScore}</b>
${RISK_EMOJI.LOW} Risk Levels: <b>${prefs.riskLevels.join(', ')}</b>
🔇 Quiet Hours: <b>${prefs.quietHoursStart || 'Off'}</b> - <b>${prefs.quietHoursEnd || 'Off'}</b>

<i>Tap buttons below to adjust:</i>
`.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: `Score: ${prefs.minScore}`, callback_data: 'noop' },
        { text: '➖', callback_data: 'score_down' },
        { text: '➕', callback_data: 'score_up' }
      ],
      [
        {
          text: prefs.riskLevels.includes('LOW') ? '🟢 LOW ✓' : '🟢 LOW',
          callback_data: 'toggle_risk_LOW'
        },
        {
          text: prefs.riskLevels.includes('MEDIUM') ? '🟡 MED ✓' : '🟡 MED',
          callback_data: 'toggle_risk_MEDIUM'
        },
        {
          text: prefs.riskLevels.includes('HIGH') ? '🟠 HIGH ✓' : '🟠 HIGH',
          callback_data: 'toggle_risk_HIGH'
        }
      ],
      [{ text: '🔕 Unsubscribe', callback_data: 'cmd_unsubscribe' }]
    ]
  };

  await sendMessage(chatId, text, { replyMarkup: keyboard });
}

/**
 * /performance - Show win rate and ROI stats
 */
export async function handlePerformance(chatId: string | number): Promise<void> {
  const summary = getPerformanceSummary();
  const tracked = getTrackedSignals();

  // Calculate additional stats
  const recentWins = tracked
    .filter(t => t.status === 'WIN')
    .sort((a, b) => b.entryTimestamp - a.entryTimestamp)
    .slice(0, 3);

  const avgHoldTime =
    tracked.length > 0
      ? tracked.reduce((sum, t) => sum + (t.lastUpdate - t.entryTimestamp), 0) /
        tracked.length /
        60000
      : 0;

  const text = `
📈 <b>ORACLE Alpha Performance</b>

<b>Overview:</b>
• Total Signals: <b>${summary.total}</b>
• Open: <b>${summary.open}</b> | Closed: <b>${summary.wins + summary.losses}</b>

<b>Win Rate:</b>
• Wins: <b>${summary.wins}</b> ✅
• Losses: <b>${summary.losses}</b> ❌
• Win Rate: <b>${summary.winRate.toFixed(1)}%</b>

<b>ROI:</b>
• Average ROI: <b>${summary.avgRoi >= 0 ? '+' : ''}${summary.avgRoi.toFixed(1)}%</b>
• Avg Peak ROI: <b>${summary.avgAthRoi >= 0 ? '+' : ''}${summary.avgAthRoi.toFixed(1)}%</b>

${
  summary.bestTrade
    ? `<b>Best Trade:</b>
• $${summary.bestTrade.symbol}: <b>+${summary.bestTrade.athRoi.toFixed(1)}%</b> 🏆`
    : ''
}

${
  recentWins.length > 0
    ? `<b>Recent Wins:</b>
${recentWins.map(w => `• $${w.symbol}: +${w.roi.toFixed(1)}%`).join('\n')}`
    : ''
}

<i>Avg Hold Time: ${avgHoldTime.toFixed(0)} minutes</i>
`.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📊 Top Signals', callback_data: 'cmd_top' },
        { text: '💰 Portfolio Sim', callback_data: 'cmd_portfolio_1000' }
      ],
      [{ text: '🔄 Refresh', callback_data: 'cmd_performance' }]
    ]
  };

  await sendMessage(chatId, text, { replyMarkup: keyboard });
}

/**
 * /sources - List active signal sources
 */
export async function handleSources(chatId: string | number): Promise<void> {
  const sources = SOURCE_CONFIGS.filter(s => s.enabled);

  const sourceLines = sources.map(s => {
    const emoji = SOURCE_EMOJI[s.source] || '•';
    const wrStr = s.historicalWinRate ? `${(s.historicalWinRate * 100).toFixed(0)}%` : 'N/A';
    return `${emoji} <b>${s.source}</b>
   Weight: ${s.weight.toFixed(1)}x | WR: ${wrStr}`;
  });

  const text = `
🎯 <b>Active Signal Sources</b>

${sourceLines.join('\n\n')}

<b>How It Works:</b>
Signals from multiple sources are combined using weighted scoring. Higher weight = more impact on final score.

<i>Sources with higher historical win rates get priority</i>
`.trim();

  const keyboard = {
    inline_keyboard: [[{ text: '📊 Top Signals', callback_data: 'cmd_top' }]]
  };

  await sendMessage(chatId, text, { replyMarkup: keyboard });
}

/**
 * /top - Show top 5 signals today
 */
export async function handleTop(chatId: string | number): Promise<void> {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const todaySignals = signalStoreRef
    .filter(s => s.timestamp >= oneDayAgo)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (todaySignals.length === 0) {
    await sendMessage(chatId, '📭 No signals detected in the last 24 hours.\n\nCheck back soon!');
    return;
  }

  const signalLines = todaySignals.map((s, i) => {
    const emoji = SCORE_EMOJI(s.score);
    const risk = RISK_EMOJI[s.riskLevel];
    const mcap = s.marketData?.mcap ? `$${(s.marketData.mcap / 1000).toFixed(0)}K` : 'N/A';
    const age = Math.floor((Date.now() - s.timestamp) / 60000);

    return `${i + 1}. ${emoji} <b>$${s.symbol}</b>
   Score: <b>${s.score}</b> ${risk} ${s.riskLevel}
   MCap: ${mcap} | Age: ${age}m
   <code>${s.token.slice(0, 20)}...</code>`;
  });

  const text = `
🏆 <b>Top Signals (24h)</b>

${signalLines.join('\n\n')}

<i>Tap a token to view details</i>
`.trim();

  // Create buttons for each signal
  const keyboard = {
    inline_keyboard: [
      ...todaySignals.slice(0, 3).map(s => [
        { text: `📊 $${s.symbol}`, callback_data: `signal_${s.id.slice(0, 20)}` },
        { text: '🦎 DEX', url: `https://dexscreener.com/solana/${s.token}` }
      ]),
      [{ text: '🔄 Refresh', callback_data: 'cmd_top' }]
    ]
  };

  await sendMessage(chatId, text, { replyMarkup: keyboard });
}

/**
 * /portfolio [amount] - Run portfolio simulation
 */
export async function handlePortfolio(chatId: string | number, args: string[]): Promise<void> {
  const startAmount = args[0] ? Math.max(100, parseInt(args[0]) || 1000) : 1000;
  const minScore = 65;
  const daysBack = 7;

  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const historicalSignals = signalStoreRef
    .filter(s => s.timestamp >= cutoff && s.score >= minScore)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (historicalSignals.length === 0) {
    await sendMessage(
      chatId,
      `📭 No signals with score ≥${minScore} in the last ${daysBack} days.\n\nTry running in demo mode first.`
    );
    return;
  }

  // Simulate portfolio
  const positionSize = 0.1; // 10% per trade
  let portfolioValue = startAmount;
  let wins = 0;
  let losses = 0;
  const trades: { symbol: string; roi: number }[] = [];

  for (const signal of historicalSignals) {
    const positionValue = portfolioValue * positionSize;

    let roi: number;
    if (signal.performance && signal.performance.status !== 'OPEN') {
      roi = signal.performance.roi || 0;
    } else {
      // Simulate based on score
      const winProb = 0.45 + (signal.score / 100) * 0.35;
      const isWin = Math.random() < winProb;
      roi = isWin ? 20 + Math.random() * 80 : -(20 + Math.random() * 40);
    }

    const pnl = positionValue * (roi / 100);
    portfolioValue += pnl;

    if (roi > 0) wins++;
    else losses++;

    trades.push({ symbol: signal.symbol, roi });
  }

  const totalROI = ((portfolioValue - startAmount) / startAmount) * 100;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  // Find best/worst trades
  const sortedTrades = [...trades].sort((a, b) => b.roi - a.roi);
  const bestTrade = sortedTrades[0];
  const worstTrade = sortedTrades[sortedTrades.length - 1];

  const text = `
💰 <b>Portfolio Simulation</b>

<b>Parameters:</b>
• Starting: <b>$${startAmount.toLocaleString()}</b>
• Position Size: <b>10%</b>
• Min Score: <b>${minScore}</b>
• Period: <b>${daysBack} days</b>

<b>Results:</b>
• Final Value: <b>$${portfolioValue.toFixed(2)}</b>
• Total ROI: <b>${totalROI >= 0 ? '+' : ''}${totalROI.toFixed(1)}%</b>
• Trades: <b>${trades.length}</b>
• Win Rate: <b>${winRate.toFixed(1)}%</b> (${wins}W / ${losses}L)

${bestTrade ? `🏆 Best: $${bestTrade.symbol} +${bestTrade.roi.toFixed(1)}%` : ''}
${worstTrade ? `📉 Worst: $${worstTrade.symbol} ${worstTrade.roi.toFixed(1)}%` : ''}

<i>⚠️ Simulated results - not financial advice</i>
`.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '💵 $500', callback_data: 'cmd_portfolio_500' },
        { text: '💰 $5000', callback_data: 'cmd_portfolio_5000' },
        { text: '🤑 $10000', callback_data: 'cmd_portfolio_10000' }
      ],
      [{ text: '📈 Performance', callback_data: 'cmd_performance' }]
    ]
  };

  await sendMessage(chatId, text, { replyMarkup: keyboard });
}

/**
 * /latest - Most recent signal
 */
export async function handleLatest(chatId: string | number): Promise<void> {
  const latest = signalStoreRef[0];

  if (!latest) {
    await sendMessage(chatId, '📭 No signals available yet.\n\nCheck back soon!');
    return;
  }

  await sendSignalAlert(latest, String(chatId));
}

// =============== SIGNAL ALERTS ===============

/**
 * Send a rich signal alert to a chat
 */
export async function sendSignalAlert(
  signal: AggregatedSignal,
  chatId: string | number
): Promise<boolean> {
  const emoji = SCORE_EMOJI(signal.score);
  const risk = RISK_EMOJI[signal.riskLevel];

  // Format sources
  const sources = signal.sources
    .map(s => {
      const sourceEmoji = SOURCE_EMOJI[s.source] || '•';
      return `${sourceEmoji} ${s.source.replace(/-/g, ' ')}`;
    })
    .join('\n');

  // Format narratives
  const narratives = signal.analysis?.narrative?.join(', ') || 'General';

  const text = `
${emoji} <b>ORACLE ALPHA SIGNAL</b> ${emoji}

<b>$${signal.symbol}</b> - ${signal.name}

📊 <b>Score:</b> ${signal.score}/100 ${risk} ${signal.riskLevel}
💰 <b>MCap:</b> $${((signal.marketData?.mcap || 0) / 1000).toFixed(1)}K
💧 <b>Liquidity:</b> $${((signal.marketData?.liquidity || 0) / 1000).toFixed(1)}K
📈 <b>Vol 5m:</b> $${((signal.marketData?.volume5m || 0) / 1000).toFixed(1)}K
⏱ <b>Age:</b> ${signal.marketData?.age || 0}m

🎯 <b>Sources:</b>
${sources}

📰 <b>Narrative:</b> ${narratives}

💡 <b>Analysis:</b> ${signal.analysis?.recommendation || 'N/A'}

<code>${signal.token}</code>

🔮 <i>ORACLE Alpha - Verifiable AI Signals</i>
`.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📊 DexScreener', url: `https://dexscreener.com/solana/${signal.token}` },
        { text: '🦅 Birdeye', url: `https://birdeye.so/token/${signal.token}?chain=solana` }
      ],
      [
        { text: '🎰 Pump.fun', url: `https://pump.fun/${signal.token}` },
        { text: '⛓️ Solscan', url: `https://solscan.io/token/${signal.token}` }
      ],
      [{ text: '🔕 Mute for 1h', callback_data: 'mute_1h' }]
    ]
  };

  return await sendMessage(chatId, text, { replyMarkup: keyboard });
}

/**
 * Broadcast signal to all eligible subscribers
 */
export async function broadcastSignal(signal: AggregatedSignal): Promise<number> {
  const subscribers = loadSubscribers();
  let sentCount = 0;

  for (const [userId, subscriber] of Object.entries(subscribers)) {
    const { prefs, chatId, mutedUntil } = subscriber;

    // Skip if muted
    if (mutedUntil && mutedUntil > Date.now()) continue;

    // Check min score
    if (signal.score < prefs.minScore) continue;

    // Check risk level
    if (!prefs.riskLevels.includes(signal.riskLevel)) continue;

    // Check quiet hours
    if (prefs.quietHoursStart && prefs.quietHoursEnd) {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= prefs.quietHoursStart || hour < prefs.quietHoursEnd) continue;
    }

    // Send alert
    const sent = await sendSignalAlert(signal, chatId);
    if (sent) sentCount++;

    // Rate limit: small delay between sends
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`[TG-BOT] Broadcast signal ${signal.symbol} to ${sentCount} subscribers`);
  return sentCount;
}

// =============== CALLBACK HANDLERS ===============

/**
 * Handle inline keyboard callbacks
 */
export async function handleCallback(
  callbackQueryId: string,
  chatId: string | number,
  messageId: number,
  data: string,
  userId: string
): Promise<void> {
  // Parse callback data
  const parts = data.split('_');
  const action = parts[0];

  switch (action) {
    case 'cmd':
      // Command shortcuts
      const cmd = parts[1];
      switch (cmd) {
        case 'subscribe':
          await handleSubscribe(chatId, [], userId);
          break;
        case 'unsubscribe':
          await handleUnsubscribe(chatId, userId);
          break;
        case 'performance':
          await handlePerformance(chatId);
          break;
        case 'sources':
          await handleSources(chatId);
          break;
        case 'top':
          await handleTop(chatId);
          break;
        case 'settings':
          await handleSettings(chatId, userId);
          break;
        case 'portfolio':
          const amount = parts[2] || '1000';
          await handlePortfolio(chatId, [amount]);
          break;
      }
      break;

    case 'set':
      // Set specific value
      if (parts[1] === 'score') {
        const score = parseInt(parts[2]) || 70;
        updateSubscriber(userId, { minScore: score });
        await answerCallback(callbackQueryId, `Min score set to ${score}`);
        await handleSettings(chatId, userId);
      }
      break;

    case 'score':
      // Increment/decrement score
      const subscriber = getSubscriber(userId);
      if (subscriber) {
        const currentScore = subscriber.prefs.minScore;
        const delta = parts[1] === 'up' ? 5 : -5;
        const newScore = Math.min(100, Math.max(50, currentScore + delta));
        updateSubscriber(userId, { minScore: newScore });
        await answerCallback(callbackQueryId, `Min score: ${newScore}`);
        await handleSettings(chatId, userId);
      }
      break;

    case 'toggle':
      // Toggle risk level
      if (parts[1] === 'risk') {
        const risk = parts[2] as RiskLevel;
        const sub = getSubscriber(userId);
        if (sub) {
          const current = sub.prefs.riskLevels;
          const newLevels = current.includes(risk)
            ? current.filter(r => r !== risk)
            : [...current, risk];

          // Ensure at least one level is selected
          if (newLevels.length > 0) {
            updateSubscriber(userId, { riskLevels: newLevels });
            await answerCallback(callbackQueryId, `${risk} ${newLevels.includes(risk) ? 'enabled' : 'disabled'}`);
            await handleSettings(chatId, userId);
          } else {
            await answerCallback(callbackQueryId, 'Must have at least one risk level!');
          }
        }
      }
      break;

    case 'mute':
      // Mute alerts
      const duration = parts[1];
      const muteMs = duration === '1h' ? 3600000 : duration === '4h' ? 14400000 : 28800000;
      const sub = getSubscriber(userId);
      if (sub) {
        sub.mutedUntil = Date.now() + muteMs;
        saveSubscribers();
        await answerCallback(callbackQueryId, `Muted for ${duration}`);
      }
      break;

    case 'signal':
      // Show signal details
      const signalId = parts.slice(1).join('_');
      const signal = signalStoreRef.find(s => s.id.startsWith(signalId));
      if (signal) {
        await sendSignalAlert(signal, chatId);
      }
      break;

    case 'noop':
      // Do nothing (for display-only buttons)
      await answerCallback(callbackQueryId);
      break;

    default:
      await answerCallback(callbackQueryId, 'Unknown action');
  }
}

// =============== WEBHOOK HANDLER ===============

/**
 * Process incoming Telegram update
 */
export async function processUpdate(update: any): Promise<void> {
  // Handle messages
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = String(msg.from?.id || chatId);
    const text = msg.text || '';

    // Parse command
    if (text.startsWith('/')) {
      const parts = text.split(' ');
      const command = parts[0].toLowerCase().replace('@oracle_alpha_bot', '');
      const args = parts.slice(1);

      switch (command) {
        case '/start':
          await handleStart(chatId);
          break;
        case '/help':
          await handleHelp(chatId);
          break;
        case '/subscribe':
          await handleSubscribe(chatId, args, userId);
          break;
        case '/unsubscribe':
          await handleUnsubscribe(chatId, userId);
          break;
        case '/settings':
          await handleSettings(chatId, userId);
          break;
        case '/performance':
          await handlePerformance(chatId);
          break;
        case '/sources':
          await handleSources(chatId);
          break;
        case '/top':
          await handleTop(chatId);
          break;
        case '/portfolio':
          await handlePortfolio(chatId, args);
          break;
        case '/latest':
          await handleLatest(chatId);
          break;
        default:
          await sendMessage(chatId, 'Unknown command. Use /help to see available commands.');
      }
    }
  }

  // Handle callback queries (inline keyboard)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const userId = String(cb.from?.id);
    const data = cb.data;

    if (chatId && data) {
      await handleCallback(cb.id, chatId, messageId, data, userId);
    } else {
      await answerCallback(cb.id);
    }
  }
}

// =============== WEBHOOK SETUP ===============

/**
 * Set up Telegram webhook
 */
export async function setupWebhook(webhookUrl: string): Promise<boolean> {
  const result = await sendTelegramRequest('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query']
  });

  if (result?.ok) {
    console.log(`[TG-BOT] Webhook set to ${webhookUrl}`);
    return true;
  } else {
    console.error('[TG-BOT] Failed to set webhook:', result?.description);
    return false;
  }
}

/**
 * Remove Telegram webhook (for polling mode)
 */
export async function removeWebhook(): Promise<boolean> {
  const result = await sendTelegramRequest('deleteWebhook', {});
  return result?.ok || false;
}

/**
 * Get webhook info
 */
export async function getWebhookInfo(): Promise<any> {
  return await sendTelegramRequest('getWebhookInfo', {});
}

// =============== POLLING MODE ===============

let pollingActive = false;
let lastUpdateId = 0;

/**
 * Start polling for updates (alternative to webhook)
 */
export async function startPolling(): Promise<void> {
  if (pollingActive) return;
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('[TG-BOT] No bot token, skipping polling');
    return;
  }

  // Remove webhook first
  await removeWebhook();

  pollingActive = true;
  console.log('[TG-BOT] Started polling for updates');

  while (pollingActive) {
    try {
      const result = await sendTelegramRequest('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 30
      });

      if (result?.ok && result.result?.length > 0) {
        for (const update of result.result) {
          lastUpdateId = update.update_id;
          await processUpdate(update);
        }
      }
    } catch (error) {
      console.error('[TG-BOT] Polling error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Stop polling
 */
export function stopPolling(): void {
  pollingActive = false;
  console.log('[TG-BOT] Stopped polling');
}

export { RISK_EMOJI, SCORE_EMOJI, SOURCE_EMOJI };
