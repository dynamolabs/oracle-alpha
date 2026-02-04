/**
 * ORACLE Alpha Discord Bot Integration
 * Full-featured Discord bot with slash commands, embeds, and channel subscriptions
 */

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ColorResolvable,
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';
import { AggregatedSignal, RiskLevel } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

// Paths for data persistence
const DATA_DIR = path.join(__dirname, '../../data');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'discord-subscriptions.json');

// Discord embed colors
const COLORS: Record<RiskLevel, ColorResolvable> = {
  LOW: 0x22c55e, // Green
  MEDIUM: 0xeab308, // Yellow
  HIGH: 0xf97316, // Orange
  EXTREME: 0xef4444 // Red
};

const SCORE_COLORS: Record<string, ColorResolvable> = {
  excellent: 0x22c55e, // 85+
  good: 0x3b82f6, // 70-84
  moderate: 0xeab308, // 50-69
  low: 0x6b7280 // <50
};

// Risk level emojis
const RISK_EMOJI: Record<RiskLevel, string> = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🟠',
  EXTREME: '🔴'
};

// Score emojis
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

// Channel subscription settings
interface ChannelSubscription {
  channelId: string;
  guildId: string;
  guildName: string;
  channelName: string;
  minScore: number;
  riskLevels: RiskLevel[];
  autoPost: boolean;
  webhookUrl?: string;
  createdAt: number;
  updatedAt: number;
}

// Subscriptions storage
interface SubscriptionsStore {
  channels: Record<string, ChannelSubscription>;
}

// In-memory signal store reference
let signalStoreRef: AggregatedSignal[] = [];

// Discord client instance
let client: Client | null = null;
let isReady = false;

// Load subscriptions from file
function loadSubscriptions(): SubscriptionsStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('[DISCORD] Error loading subscriptions:', error);
  }
  return { channels: {} };
}

// Save subscriptions to file
function saveSubscriptions(store: SubscriptionsStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error('[DISCORD] Error saving subscriptions:', error);
  }
}

// Get subscription for a channel
function getSubscription(channelId: string): ChannelSubscription | null {
  const store = loadSubscriptions();
  return store.channels[channelId] || null;
}

// Add or update subscription
function setSubscription(sub: ChannelSubscription): void {
  const store = loadSubscriptions();
  store.channels[sub.channelId] = sub;
  saveSubscriptions(store);
}

// Remove subscription
function removeSubscription(channelId: string): boolean {
  const store = loadSubscriptions();
  if (store.channels[channelId]) {
    delete store.channels[channelId];
    saveSubscriptions(store);
    return true;
  }
  return false;
}

// Get all subscriptions
function getAllSubscriptions(): ChannelSubscription[] {
  const store = loadSubscriptions();
  return Object.values(store.channels);
}

// Set signal store reference
export function setSignalStore(store: AggregatedSignal[]): void {
  signalStoreRef = store;
}

// Get score color
function getScoreColor(score: number): ColorResolvable {
  if (score >= 85) return SCORE_COLORS.excellent;
  if (score >= 70) return SCORE_COLORS.good;
  if (score >= 50) return SCORE_COLORS.moderate;
  return SCORE_COLORS.low;
}

// Format market cap
function formatMcap(mcap: number): string {
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`;
  if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(1)}K`;
  return `$${mcap.toFixed(0)}`;
}

// Create signal embed
function createSignalEmbed(signal: AggregatedSignal): EmbedBuilder {
  const riskEmoji = RISK_EMOJI[signal.riskLevel];
  const scoreEmoji = SCORE_EMOJI(signal.score);
  
  // Format sources with emojis
  const sourcesText = signal.sources
    .map(s => {
      const emoji = SOURCE_EMOJI[s.source] || '📡';
      return `${emoji} ${s.source.replace(/-/g, ' ')}`;
    })
    .slice(0, 4)
    .join('\n');

  // Create progress bar for score
  const filled = Math.floor(signal.score / 10);
  const scoreBar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  const embed = new EmbedBuilder()
    .setTitle(`🔮 ORACLE Signal: $${signal.symbol}`)
    .setDescription(`━━━━━━━━━━━━━━━━━━━━`)
    .setColor(COLORS[signal.riskLevel])
    .addFields(
      {
        name: '📊 Score',
        value: `\`${scoreBar}\` **${signal.score}/100** ${scoreEmoji}`,
        inline: false
      },
      {
        name: `${riskEmoji} Risk`,
        value: `**${signal.riskLevel}**`,
        inline: true
      },
      {
        name: '💰 MCap',
        value: formatMcap(signal.marketData?.mcap || 0),
        inline: true
      },
      {
        name: '💧 Liquidity',
        value: formatMcap(signal.marketData?.liquidity || 0),
        inline: true
      },
      {
        name: '📈 Sources',
        value: sourcesText || 'Multiple sources',
        inline: false
      }
    );

  // Add analysis if available
  if (signal.analysis?.recommendation) {
    embed.addFields({
      name: '🧠 Why',
      value: signal.analysis.recommendation.slice(0, 200) + (signal.analysis.recommendation.length > 200 ? '...' : ''),
      inline: false
    });
  }

  // Add narratives if available
  if (signal.analysis?.narrative && signal.analysis.narrative.length > 0) {
    embed.addFields({
      name: '📰 Narrative',
      value: signal.analysis.narrative.slice(0, 3).join(', '),
      inline: false
    });
  }

  // Add contract address (truncated)
  embed.addFields({
    name: '📋 Contract',
    value: `\`${signal.token.slice(0, 20)}...${signal.token.slice(-8)}\``,
    inline: false
  });

  embed.setFooter({
    text: `ORACLE Alpha • ${new Date(signal.timestamp).toLocaleString()}`
  });

  embed.setTimestamp(signal.timestamp);

  return embed;
}

// Create action buttons for signal
function createSignalButtons(signal: AggregatedSignal): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setLabel('View Dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://oracle-alpha.io/signal/${signal.id}`)
        .setEmoji('🔮'),
      new ButtonBuilder()
        .setLabel('DexScreener')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://dexscreener.com/solana/${signal.token}`)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setLabel('Trade Now')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://jup.ag/swap/SOL-${signal.token}`)
        .setEmoji('💱')
    );

  return row;
}

// Slash command definitions
const commands = [
  new SlashCommandBuilder()
    .setName('signals')
    .setDescription('List latest ORACLE signals')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of signals to show (1-10)')
        .setMinValue(1)
        .setMaxValue(10)
    )
    .addIntegerOption(option =>
      option
        .setName('minscore')
        .setDescription('Minimum score filter (0-100)')
        .setMinValue(0)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName('signal')
    .setDescription('Get details for a specific signal')
    .addStringOption(option =>
      option
        .setName('id')
        .setDescription('Signal ID or token symbol')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe this channel to ORACLE signal alerts')
    .addIntegerOption(option =>
      option
        .setName('minscore')
        .setDescription('Minimum score for alerts (default: 70)')
        .setMinValue(50)
        .setMaxValue(100)
    )
    .addBooleanOption(option =>
      option
        .setName('autopost')
        .setDescription('Automatically post high score signals (default: true)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('unsubscribe')
    .setDescription('Unsubscribe this channel from signal alerts')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View or configure channel alert settings')
    .addIntegerOption(option =>
      option
        .setName('minscore')
        .setDescription('Set minimum score (50-100)')
        .setMinValue(50)
        .setMaxValue(100)
    )
    .addStringOption(option =>
      option
        .setName('risk')
        .setDescription('Risk levels to include')
        .addChoices(
          { name: 'All Risks', value: 'all' },
          { name: 'Low & Medium only', value: 'safe' },
          { name: 'Low only', value: 'low' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('performance')
    .setDescription('View ORACLE signal performance stats'),

  new SlashCommandBuilder()
    .setName('top')
    .setDescription('Show top performing signals today')
].map(cmd => cmd.toJSON());

// Register slash commands
async function registerCommands(): Promise<boolean> {
  if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
    console.log('[DISCORD] Missing bot token or client ID for command registration');
    return false;
  }

  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

  try {
    console.log('[DISCORD] Registering slash commands...');
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
    console.log('[DISCORD] Slash commands registered successfully');
    return true;
  } catch (error) {
    console.error('[DISCORD] Error registering commands:', error);
    return false;
  }
}

// Handle /signals command
async function handleSignalsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const limit = interaction.options.getInteger('limit') || 5;
  const minScore = interaction.options.getInteger('minscore') || 0;

  // Get latest signals
  let signals = [...signalStoreRef]
    .filter(s => s.score >= minScore)
    .slice(0, limit);

  if (signals.length === 0) {
    await interaction.reply({
      content: '📭 No signals found matching your criteria.',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🔮 Latest ORACLE Signals')
    .setColor(0x7c3aed)
    .setDescription(`Showing ${signals.length} signal${signals.length > 1 ? 's' : ''}${minScore > 0 ? ` (score ≥${minScore})` : ''}`);

  for (const signal of signals) {
    const riskEmoji = RISK_EMOJI[signal.riskLevel];
    const scoreEmoji = SCORE_EMOJI(signal.score);
    const age = Math.floor((Date.now() - signal.timestamp) / 60000);

    embed.addFields({
      name: `${scoreEmoji} $${signal.symbol} - Score: ${signal.score}`,
      value: `${riskEmoji} ${signal.riskLevel} | MCap: ${formatMcap(signal.marketData?.mcap || 0)} | ${age}m ago\n\`${signal.token.slice(0, 16)}...\``,
      inline: false
    });
  }

  embed.setFooter({ text: 'Use /signal <id> for details' });
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Handle /signal command
async function handleSignalCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString('id', true);

  // Find signal by ID or symbol
  const signal = signalStoreRef.find(
    s => s.id === query || 
         s.id.startsWith(query) || 
         s.symbol.toLowerCase() === query.toLowerCase() ||
         s.token === query
  );

  if (!signal) {
    await interaction.reply({
      content: `❌ Signal not found: \`${query}\``,
      ephemeral: true
    });
    return;
  }

  const embed = createSignalEmbed(signal);
  const buttons = createSignalButtons(signal);

  await interaction.reply({
    embeds: [embed],
    components: [buttons]
  });
}

// Handle /subscribe command
async function handleSubscribeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const minScore = interaction.options.getInteger('minscore') || 70;
  const autoPost = interaction.options.getBoolean('autopost') ?? true;

  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: '❌ This command can only be used in text channels.',
      ephemeral: true
    });
    return;
  }

  const sub: ChannelSubscription = {
    channelId: channel.id,
    guildId: interaction.guildId!,
    guildName: interaction.guild?.name || 'Unknown',
    channelName: channel.name,
    minScore,
    riskLevels: ['LOW', 'MEDIUM', 'HIGH'],
    autoPost,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  setSubscription(sub);

  const embed = new EmbedBuilder()
    .setTitle('🔔 Channel Subscribed!')
    .setColor(0x22c55e)
    .setDescription('This channel will now receive ORACLE signal alerts.')
    .addFields(
      { name: 'Min Score', value: `${minScore}`, inline: true },
      { name: 'Auto Post', value: autoPost ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Risk Levels', value: 'LOW, MEDIUM, HIGH', inline: true }
    )
    .setFooter({ text: 'Use /settings to customize' });

  await interaction.reply({ embeds: [embed] });
}

// Handle /unsubscribe command
async function handleUnsubscribeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;
  
  if (removeSubscription(channelId)) {
    await interaction.reply({
      content: '🔕 Channel unsubscribed from signal alerts.',
      ephemeral: false
    });
  } else {
    await interaction.reply({
      content: '❌ This channel is not subscribed.',
      ephemeral: true
    });
  }
}

// Handle /settings command
async function handleSettingsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;
  let sub = getSubscription(channelId);

  const newMinScore = interaction.options.getInteger('minscore');
  const riskOption = interaction.options.getString('risk');

  // If options provided, update settings
  if (sub && (newMinScore !== null || riskOption !== null)) {
    if (newMinScore !== null) {
      sub.minScore = newMinScore;
    }
    if (riskOption !== null) {
      switch (riskOption) {
        case 'all':
          sub.riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'];
          break;
        case 'safe':
          sub.riskLevels = ['LOW', 'MEDIUM'];
          break;
        case 'low':
          sub.riskLevels = ['LOW'];
          break;
      }
    }
    sub.updatedAt = Date.now();
    setSubscription(sub);
  }

  // Show current settings
  if (!sub) {
    await interaction.reply({
      content: '❌ This channel is not subscribed. Use `/subscribe` first.',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Channel Settings')
    .setColor(0x3b82f6)
    .addFields(
      { name: '📊 Min Score', value: `${sub.minScore}`, inline: true },
      { name: '🔔 Auto Post', value: sub.autoPost ? 'Enabled' : 'Disabled', inline: true },
      { name: `${RISK_EMOJI.LOW} Risk Levels`, value: sub.riskLevels.join(', '), inline: true }
    )
    .setFooter({ text: `Updated: ${new Date(sub.updatedAt).toLocaleString()}` });

  await interaction.reply({ embeds: [embed] });
}

// Handle /performance command
async function handlePerformanceCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  // Calculate performance from signals
  const total = signalStoreRef.length;
  const withPerf = signalStoreRef.filter(s => s.performance);
  const wins = withPerf.filter(s => s.performance?.status === 'WIN').length;
  const losses = withPerf.filter(s => s.performance?.status === 'LOSS').length;
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
  const avgRoi = withPerf.length > 0 
    ? withPerf.reduce((sum, s) => sum + (s.performance?.roi || 0), 0) / withPerf.length 
    : 0;

  const embed = new EmbedBuilder()
    .setTitle('📈 ORACLE Performance')
    .setColor(winRate >= 60 ? 0x22c55e : winRate >= 40 ? 0xeab308 : 0xef4444)
    .addFields(
      { name: '📊 Total Signals', value: `${total}`, inline: true },
      { name: '✅ Wins', value: `${wins}`, inline: true },
      { name: '❌ Losses', value: `${losses}`, inline: true },
      { name: '🎯 Win Rate', value: `${winRate.toFixed(1)}%`, inline: true },
      { name: '💰 Avg ROI', value: `${avgRoi >= 0 ? '+' : ''}${avgRoi.toFixed(1)}%`, inline: true },
      { name: '📊 Open', value: `${total - wins - losses}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Handle /top command
async function handleTopCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const todaySignals = signalStoreRef
    .filter(s => s.timestamp >= oneDayAgo)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (todaySignals.length === 0) {
    await interaction.reply({
      content: '📭 No signals in the last 24 hours.',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 Top Signals Today')
    .setColor(0xfbbf24)
    .setDescription('Highest scoring signals in the last 24 hours');

  todaySignals.forEach((signal, i) => {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const riskEmoji = RISK_EMOJI[signal.riskLevel];
    const age = Math.floor((Date.now() - signal.timestamp) / 60000);

    embed.addFields({
      name: `${medals[i]} $${signal.symbol} - Score: ${signal.score}`,
      value: `${riskEmoji} ${signal.riskLevel} | MCap: ${formatMcap(signal.marketData?.mcap || 0)} | ${age}m ago`,
      inline: false
    });
  });

  embed.setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Handle interaction
async function handleInteraction(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    switch (commandName) {
      case 'signals':
        await handleSignalsCommand(interaction);
        break;
      case 'signal':
        await handleSignalCommand(interaction);
        break;
      case 'subscribe':
        await handleSubscribeCommand(interaction);
        break;
      case 'unsubscribe':
        await handleUnsubscribeCommand(interaction);
        break;
      case 'settings':
        await handleSettingsCommand(interaction);
        break;
      case 'performance':
        await handlePerformanceCommand(interaction);
        break;
      case 'top':
        await handleTopCommand(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown command', ephemeral: true });
    }
  }
}

// Send signal alert to subscribed channels
export async function broadcastSignal(signal: AggregatedSignal): Promise<number> {
  if (!client || !isReady) {
    // Fall back to webhook if bot not available
    if (DISCORD_WEBHOOK_URL) {
      const sent = await sendWebhookAlert(signal);
      return sent ? 1 : 0;
    }
    return 0;
  }

  const subscriptions = getAllSubscriptions();
  let sentCount = 0;

  for (const sub of subscriptions) {
    // Check filters
    if (signal.score < sub.minScore) continue;
    if (!sub.riskLevels.includes(signal.riskLevel)) continue;
    if (!sub.autoPost) continue;

    try {
      const channel = await client.channels.fetch(sub.channelId);
      if (!channel || !(channel instanceof TextChannel)) continue;

      const embed = createSignalEmbed(signal);
      const buttons = createSignalButtons(signal);

      await channel.send({
        embeds: [embed],
        components: [buttons]
      });

      sentCount++;
      console.log(`[DISCORD] Sent signal ${signal.symbol} to ${sub.channelName}`);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[DISCORD] Failed to send to ${sub.channelId}:`, error);
    }
  }

  return sentCount;
}

// Send webhook alert (fallback for webhook-only mode)
export async function sendWebhookAlert(signal: AggregatedSignal): Promise<boolean> {
  if (!DISCORD_WEBHOOK_URL) return false;

  try {
    const embed = {
      title: `🔮 ORACLE Signal: $${signal.symbol}`,
      description: '━━━━━━━━━━━━━━━━━━━━',
      color: COLORS[signal.riskLevel],
      fields: [
        {
          name: '📊 Score',
          value: `**${signal.score}/100**`,
          inline: true
        },
        {
          name: `${RISK_EMOJI[signal.riskLevel]} Risk`,
          value: `**${signal.riskLevel}**`,
          inline: true
        },
        {
          name: '💰 MCap',
          value: formatMcap(signal.marketData?.mcap || 0),
          inline: true
        },
        {
          name: '📈 Sources',
          value: signal.sources.map(s => `${SOURCE_EMOJI[s.source] || '📡'} ${s.source}`).slice(0, 3).join(', '),
          inline: false
        },
        {
          name: '🧠 Why',
          value: signal.analysis?.recommendation?.slice(0, 150) || 'High confluence signal detected',
          inline: false
        },
        {
          name: '📋 Contract',
          value: `\`${signal.token}\``,
          inline: false
        }
      ],
      footer: {
        text: 'ORACLE Alpha • Verifiable On-Chain Signals'
      },
      timestamp: new Date(signal.timestamp).toISOString()
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ORACLE Alpha',
        embeds: [embed]
      })
    });

    if (!response.ok) {
      console.error('[DISCORD] Webhook failed:', response.status);
      return false;
    }

    console.log(`[DISCORD] Webhook alert sent for ${signal.symbol}`);
    return true;
  } catch (error) {
    console.error('[DISCORD] Webhook error:', error);
    return false;
  }
}

// Test webhook endpoint
export async function testWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const testEmbed = {
      title: '🔮 ORACLE Alpha - Webhook Test',
      description: 'This is a test message from ORACLE Alpha.',
      color: 0x7c3aed,
      fields: [
        { name: 'Status', value: '✅ Webhook connected successfully!', inline: false }
      ],
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ORACLE Alpha',
        embeds: [testEmbed]
      })
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get bot status
export function getBotStatus(): {
  connected: boolean;
  ready: boolean;
  mode: 'bot' | 'webhook' | 'none';
  guilds: number;
  subscriptions: number;
} {
  const subscriptions = getAllSubscriptions();
  
  if (client && isReady) {
    return {
      connected: true,
      ready: true,
      mode: 'bot',
      guilds: client.guilds.cache.size,
      subscriptions: subscriptions.length
    };
  }

  if (DISCORD_WEBHOOK_URL) {
    return {
      connected: true,
      ready: true,
      mode: 'webhook',
      guilds: 0,
      subscriptions: 1 // Webhook counts as 1
    };
  }

  return {
    connected: false,
    ready: false,
    mode: 'none',
    guilds: 0,
    subscriptions: 0
  };
}

// Initialize Discord bot
export async function initDiscordBot(): Promise<boolean> {
  // Check for webhook-only mode
  if (!DISCORD_BOT_TOKEN && DISCORD_WEBHOOK_URL) {
    console.log('[DISCORD] Running in webhook-only mode');
    return true;
  }

  if (!DISCORD_BOT_TOKEN) {
    console.log('[DISCORD] No bot token configured, Discord integration disabled');
    return false;
  }

  try {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
      ]
    });

    // Event handlers
    client.once('ready', async () => {
      console.log(`[DISCORD] Bot logged in as ${client?.user?.tag}`);
      isReady = true;

      // Register commands
      await registerCommands();
    });

    client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand() || interaction.isButton()) {
        try {
          await handleInteraction(interaction as ChatInputCommandInteraction | ButtonInteraction);
        } catch (error) {
          console.error('[DISCORD] Interaction error:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ An error occurred processing this command.',
              ephemeral: true
            }).catch(() => {});
          }
        }
      }
    });

    client.on('error', (error) => {
      console.error('[DISCORD] Client error:', error);
    });

    // Login
    await client.login(DISCORD_BOT_TOKEN);
    console.log('[DISCORD] Bot initializing...');
    return true;
  } catch (error) {
    console.error('[DISCORD] Failed to initialize bot:', error);
    return false;
  }
}

// Shutdown bot
export async function shutdownDiscordBot(): Promise<void> {
  if (client) {
    client.destroy();
    client = null;
    isReady = false;
    console.log('[DISCORD] Bot disconnected');
  }
}

// Export for API endpoints
export {
  getSubscription,
  getAllSubscriptions,
  DISCORD_WEBHOOK_URL,
  DISCORD_BOT_TOKEN
};
