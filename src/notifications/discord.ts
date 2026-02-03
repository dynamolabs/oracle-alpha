/**
 * Discord Webhook Integration
 * Sends signal alerts to Discord channels
 */

import { AggregatedSignal } from '../types';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

// Discord embed colors
const COLORS = {
  LOW: 0x00ff00, // Green
  MEDIUM: 0xffff00, // Yellow
  HIGH: 0xff9900, // Orange
  EXTREME: 0xff0000 // Red
};

// Discord embed structure
interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
  thumbnail?: { url: string };
}

// Discord webhook payload
interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

// Format signal as Discord embed
function formatSignalEmbed(signal: AggregatedSignal): DiscordEmbed {
  const scoreBar =
    '█'.repeat(Math.floor(signal.score / 10)) + '░'.repeat(10 - Math.floor(signal.score / 10));

  const riskEmoji = {
    LOW: '🟢',
    MEDIUM: '🟡',
    HIGH: '🟠',
    EXTREME: '🔴'
  }[signal.riskLevel];

  return {
    title: `🔮 ${signal.symbol} - ${signal.name}`,
    description: signal.analysis?.recommendation || 'Signal detected',
    color: COLORS[signal.riskLevel],
    fields: [
      {
        name: '📊 Score',
        value: `\`${scoreBar}\` **${signal.score}/100**`,
        inline: false
      },
      {
        name: `${riskEmoji} Risk Level`,
        value: signal.riskLevel,
        inline: true
      },
      {
        name: '💰 Market Cap',
        value: `$${((signal.marketData?.mcap || 0) / 1000).toFixed(1)}K`,
        inline: true
      },
      {
        name: '📈 Volume (5m)',
        value: `$${((signal.marketData?.volume5m || 0) / 1000).toFixed(1)}K`,
        inline: true
      },
      {
        name: '⏱️ Age',
        value: `${signal.marketData?.age || 0} min`,
        inline: true
      },
      {
        name: '📡 Sources',
        value: signal.sources.map(s => `\`${s.source}\``).join(', '),
        inline: false
      },
      {
        name: '🏷️ Narratives',
        value: signal.analysis?.narrative?.join(', ') || 'General',
        inline: false
      },
      {
        name: '📋 Contract',
        value: `\`${signal.token}\``,
        inline: false
      }
    ],
    footer: {
      text: 'ORACLE Alpha • Verifiable On-Chain Signals',
      icon_url: 'https://raw.githubusercontent.com/dynamolabs/oracle-alpha/main/app/favicon.ico'
    },
    timestamp: new Date(signal.timestamp).toISOString()
  };
}

// Send signal to Discord
export async function sendDiscordAlert(signal: AggregatedSignal): Promise<boolean> {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('[DISCORD] Webhook URL not configured');
    return false;
  }

  try {
    const payload: DiscordWebhookPayload = {
      username: 'ORACLE Alpha',
      avatar_url: 'https://raw.githubusercontent.com/dynamolabs/oracle-alpha/main/app/favicon.ico',
      embeds: [formatSignalEmbed(signal)]
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('[DISCORD] Webhook failed:', response.status, response.statusText);
      return false;
    }

    console.log(`[DISCORD] Alert sent for ${signal.symbol}`);
    return true;
  } catch (error) {
    console.error('[DISCORD] Error sending alert:', error);
    return false;
  }
}

// Send daily summary
export async function sendDailySummary(
  signals: AggregatedSignal[],
  stats: { wins: number; losses: number; winRate: number; avgRoi: number }
): Promise<boolean> {
  if (!DISCORD_WEBHOOK_URL) return false;

  const topSignals = signals.sort((a, b) => b.score - a.score).slice(0, 5);

  const embed: DiscordEmbed = {
    title: '📊 ORACLE Alpha Daily Summary',
    description: `Performance report for ${new Date().toLocaleDateString()}`,
    color: 0x7289da,
    fields: [
      {
        name: '📈 Signals Today',
        value: signals.length.toString(),
        inline: true
      },
      {
        name: '✅ Win Rate',
        value: `${stats.winRate.toFixed(1)}%`,
        inline: true
      },
      {
        name: '💰 Avg ROI',
        value: `${stats.avgRoi >= 0 ? '+' : ''}${stats.avgRoi.toFixed(1)}%`,
        inline: true
      },
      {
        name: '🏆 Top Signals',
        value:
          topSignals.map(s => `• **$${s.symbol}** - Score: ${s.score}`).join('\n') ||
          'No signals today',
        inline: false
      }
    ],
    footer: {
      text: 'ORACLE Alpha • Daily Report'
    },
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ORACLE Alpha',
        embeds: [embed]
      })
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Send error alert
export async function sendErrorAlert(error: string, details?: string): Promise<boolean> {
  if (!DISCORD_WEBHOOK_URL) return false;

  const embed: DiscordEmbed = {
    title: '⚠️ ORACLE Alpha Error',
    description: error,
    color: 0xff0000,
    fields: details ? [{ name: 'Details', value: `\`\`\`${details}\`\`\`` }] : [],
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ORACLE Alpha',
        embeds: [embed]
      })
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Check if signal should be sent to Discord
export function shouldSendDiscordAlert(signal: AggregatedSignal): boolean {
  // Only send score >= 70
  if (signal.score < 70) return false;

  // Don't spam - implement cooldown per token if needed
  return true;
}

export { DISCORD_WEBHOOK_URL };
