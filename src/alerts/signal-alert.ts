// Signal Alert System
// Generates formatted alerts for different platforms

import { AggregatedSignal } from '../types';

export interface AlertConfig {
  minScore: number;
  requireSmartWallet: boolean;
  maxMcap: number;
  platforms: ('telegram' | 'discord' | 'console')[];
}

const DEFAULT_CONFIG: AlertConfig = {
  minScore: 65,
  requireSmartWallet: false,
  maxMcap: 1000000,
  platforms: ['console']
};

// Risk emoji mapping
const RISK_EMOJI: Record<string, string> = {
  'LOW': '🟢',
  'MEDIUM': '🟡',
  'HIGH': '🟠',
  'EXTREME': '🔴'
};

// Source emoji mapping
const SOURCE_EMOJI: Record<string, string> = {
  'smart-wallet-elite': '👑',
  'smart-wallet-sniper': '🎯',
  'volume-spike': '📈',
  'kol-tracker': '📢',
  'kol-social': '💬',
  'narrative-new': '📰',
  'narrative-momentum': '🔥',
  'whale-tracker': '🐋',
};

// Format signal for Telegram
export function formatTelegramAlert(signal: AggregatedSignal): string {
  const riskEmoji = RISK_EMOJI[signal.riskLevel] || '⚪';
  const scoreEmoji = signal.score >= 80 ? '🔥' : signal.score >= 70 ? '⚡' : '✨';
  
  const sources = signal.sources
    .map(s => `${SOURCE_EMOJI[s.source] || '•'} ${s.source}`)
    .join('\n');
  
  const narratives = signal.analysis?.narrative?.join(', ') || 'General';
  
  return `
${scoreEmoji} <b>ORACLE SIGNAL</b> ${scoreEmoji}

<b>$${signal.symbol}</b> - ${signal.name}

📊 Score: <b>${signal.score}</b>/100 ${riskEmoji} ${signal.riskLevel}
💰 MCap: $${formatNumber(signal.marketData.mcap)}
💧 Liq: $${formatNumber(signal.marketData.liquidity)}
📈 Vol 5m: $${formatNumber(signal.marketData.volume5m)}
⏱ Age: ${signal.marketData.age}m

🎯 <b>Sources:</b>
${sources}

📰 Narrative: ${narratives}
💡 ${signal.analysis?.recommendation || 'Monitor closely'}

<code>${signal.token}</code>

<a href="https://dexscreener.com/solana/${signal.token}">DEX</a> | <a href="https://birdeye.so/token/${signal.token}?chain=solana">Birdeye</a> | <a href="https://pump.fun/${signal.token}">Pump</a>
`.trim();
}

// Format signal for Discord
export function formatDiscordAlert(signal: AggregatedSignal): string {
  const riskEmoji = RISK_EMOJI[signal.riskLevel] || '⚪';
  
  const sources = signal.sources
    .map(s => `${SOURCE_EMOJI[s.source] || '•'} ${s.source}`)
    .join(' | ');
  
  return `
**🔮 ORACLE SIGNAL**

**$${signal.symbol}** - ${signal.name}

📊 Score: **${signal.score}**/100 ${riskEmoji} ${signal.riskLevel}
💰 MCap: $${formatNumber(signal.marketData.mcap)}
📈 Vol 5m: $${formatNumber(signal.marketData.volume5m)}

🎯 Sources: ${sources}

\`${signal.token}\`

[DexScreener](https://dexscreener.com/solana/${signal.token}) | [Birdeye](https://birdeye.so/token/${signal.token}?chain=solana)
`.trim();
}

// Format signal for console/CLI
export function formatConsoleAlert(signal: AggregatedSignal): string {
  const sources = signal.sources.map(s => s.source).join(', ');
  
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔮 ORACLE SIGNAL: $${signal.symbol}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: ${signal.score} | Risk: ${signal.riskLevel}
MCap: $${formatNumber(signal.marketData.mcap)} | Vol: $${formatNumber(signal.marketData.volume5m)}
Sources: ${sources}
CA: ${signal.token}
${signal.analysis?.recommendation || ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

// Check if signal should trigger alert
export function shouldAlert(signal: AggregatedSignal, config: AlertConfig = DEFAULT_CONFIG): boolean {
  if (signal.score < config.minScore) return false;
  if (signal.marketData.mcap > config.maxMcap) return false;
  
  if (config.requireSmartWallet) {
    const hasSmartWallet = signal.sources.some(s => 
      s.source.includes('smart-wallet')
    );
    if (!hasSmartWallet) return false;
  }
  
  return true;
}

// Number formatter
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

// Batch alert formatter
export function formatBatchSummary(signals: AggregatedSignal[]): string {
  const topSignals = signals.slice(0, 5);
  
  return `
📊 <b>ORACLE Alpha - ${signals.length} New Signals</b>

${topSignals.map((s, i) => 
  `${i + 1}. <b>$${s.symbol}</b> - Score: ${s.score} (${s.riskLevel})`
).join('\n')}

${signals.length > 5 ? `\n+${signals.length - 5} more...` : ''}
`.trim();
}
