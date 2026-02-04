/**
 * Social Copy Trading System
 * Follow top signal sources from the leaderboard and auto-copy their signals
 * 
 * Features:
 * - Follow/unfollow signal sources (not wallets)
 * - Auto-copy signals from followed sources
 * - Configurable copy settings (min score, position size, etc.)
 * - Performance tracking for copied trades
 * - Follower counts per source
 */

import crypto from 'crypto';
import { SignalSource, AggregatedSignal, RiskLevel } from '../types';
import { executePaperTrade, getPaperPortfolio, initPaperPortfolio } from '../trading/jupiter';
import { SourceLeaderboardEntry } from '../analytics/leaderboard';

// === TYPES ===

export interface FollowedSource {
  id: string;
  source: SignalSource;
  displayName: string;
  followedAt: number;
  enabled: boolean;
  notes?: string;
  // Settings overrides (optional, uses global if not set)
  customSettings?: Partial<SourceCopySettings>;
  // Performance tracking for this source
  stats: {
    signalsCopied: number;
    signalsSkipped: number;
    wins: number;
    losses: number;
    pending: number;
    totalPnL: number;
    avgRoi: number;
    bestTrade: {
      symbol: string;
      roi: number;
      timestamp: number;
    } | null;
  };
}

export interface SourceCopySettings {
  enabled: boolean;
  minScoreToCopy: number;           // Minimum signal score to copy (default: 70)
  maxRiskLevel: RiskLevel;          // Maximum risk level to copy (default: MEDIUM)
  positionSizePercent: number;      // Position size as % of portfolio (1-100)
  maxPositionUSD: number;           // Maximum position size in USD
  maxConcurrentPositions: number;   // Max number of open positions
  maxDailyTrades: number;           // Max trades per day
  cooldownMinutes: number;          // Cooldown between trades on same token
  
  // Auto-sell triggers
  autoSell: boolean;
  takeProfitPercent: number;        // Take profit at X% gain
  stopLossPercent: number;          // Stop loss at X% loss
  trailingStopPercent: number;      // Trailing stop (0 = disabled)
  maxHoldingHours: number;          // Max time to hold (0 = unlimited)
  
  // Filters
  requireMultipleSources: boolean;  // Only copy if signal has multiple sources
  minSourcesRequired: number;       // Minimum sources for confluence
  requireSafetyCheck: boolean;      // Require safety score check
  minSafetyScore: number;           // Minimum safety score
  excludeTokens: string[];          // Tokens to never copy (blacklist)
  onlyTokens: string[];             // Only copy these tokens (whitelist, empty = all)
  
  // Notifications
  notifyOnCopy: boolean;
  notifyOnSkip: boolean;
  notifyOnClose: boolean;
}

export interface CopiedTrade {
  id: string;
  signalId: string;
  sourceId: string;           // Reference to FollowedSource
  source: SignalSource;
  token: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  athPrice: number;
  athTimestamp: number;
  positionSize: number;       // USD value
  positionTokens: number;     // Token amount
  roi: number;
  athRoi: number;
  status: 'OPEN' | 'WIN' | 'LOSS' | 'STOPPED';
  closeReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'TIME_LIMIT' | 'MANUAL';
  openedAt: number;
  closedAt?: number;
  signalScore: number;
  signalRiskLevel: RiskLevel;
  paperTradeId?: string;      // Reference to paper trade
}

export interface CopyDecision {
  shouldCopy: boolean;
  reasons: string[];
  skipReasons?: string[];
}

export interface CopyPerformanceStats {
  totalCopied: number;
  totalWins: number;
  totalLosses: number;
  totalPending: number;
  overallWinRate: number;
  totalPnL: number;
  avgRoi: number;
  bestTrade: CopiedTrade | null;
  worstTrade: CopiedTrade | null;
  sourceBreakdown: Array<{
    source: SignalSource;
    displayName: string;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    pnl: number;
  }>;
  dailyStats: Array<{
    date: string;
    trades: number;
    wins: number;
    losses: number;
    pnl: number;
  }>;
}

export interface SourceFollowerCount {
  source: SignalSource;
  displayName: string;
  followerCount: number;
  followersToday: number;
  trend: 'up' | 'down' | 'stable';
}

// === CONSTANTS ===

const SOURCE_DISPLAY_NAMES: Record<SignalSource, string> = {
  'smart-wallet-elite': 'Smart Wallet Elite',
  'smart-wallet-sniper': 'Smart Wallet Sniper',
  'volume-spike': 'Volume Spike',
  'kol-tracker': 'KOL Tracker',
  'kol-social': 'KOL Social',
  'narrative-new': 'New Narrative',
  'narrative-momentum': 'Narrative Momentum',
  'new-listing': 'New Listing',
  'new-launch': 'New Launch',
  'whale-accumulation': 'Whale Accumulation',
  'whale-tracker': 'Whale Tracker',
  'news-scraper': 'News Scraper',
  'pump-koth': 'Pump KOTH',
  'dexscreener': 'DexScreener',
  'panda_alpha': 'Panda Alpha',
  'dex-volume-anomaly': 'DEX Volume Anomaly',
  'twitter-sentiment': 'Twitter Sentiment'
};

const RISK_PRIORITY: Record<RiskLevel, number> = {
  'LOW': 1,
  'MEDIUM': 2,
  'HIGH': 3,
  'EXTREME': 4
};

// === DEFAULT SETTINGS ===

const DEFAULT_COPY_SETTINGS: SourceCopySettings = {
  enabled: false,
  minScoreToCopy: 70,
  maxRiskLevel: 'MEDIUM',
  positionSizePercent: 5,
  maxPositionUSD: 100,
  maxConcurrentPositions: 5,
  maxDailyTrades: 10,
  cooldownMinutes: 30,
  
  autoSell: true,
  takeProfitPercent: 50,
  stopLossPercent: 20,
  trailingStopPercent: 0,
  maxHoldingHours: 0,
  
  requireMultipleSources: false,
  minSourcesRequired: 2,
  requireSafetyCheck: true,
  minSafetyScore: 50,
  excludeTokens: [],
  onlyTokens: [],
  
  notifyOnCopy: true,
  notifyOnSkip: false,
  notifyOnClose: true
};

// === STATE ===

let copySettings: SourceCopySettings = { ...DEFAULT_COPY_SETTINGS };
const followedSources: Map<string, FollowedSource> = new Map();
const copiedTrades: CopiedTrade[] = [];
const tokenCooldowns: Map<string, number> = new Map();
let dailyTradeCount = 0;
let lastDayReset = new Date().setHours(0, 0, 0, 0);

// Simulated follower counts (would be DB in production)
const sourceFollowerCounts: Map<SignalSource, { count: number; todayNew: number; lastUpdate: number }> = new Map();

// Event callbacks
type CopyEventCallback = (event: {
  type: 'COPIED' | 'SKIPPED' | 'CLOSED';
  trade?: CopiedTrade;
  signal?: AggregatedSignal;
  reason?: string;
}) => void;
const eventCallbacks: CopyEventCallback[] = [];

// === INITIALIZATION ===

/**
 * Initialize the social copy trading system
 */
export function initSocialCopyTrading(): void {
  // Ensure paper portfolio exists
  if (!getPaperPortfolio()) {
    initPaperPortfolio(1000);
  }
  
  // Initialize follower counts with realistic demo data
  initDemoFollowerCounts();
  
  console.log('[SOCIAL-COPY] System initialized');
}

function initDemoFollowerCounts(): void {
  const demoData: Array<[SignalSource, number, number]> = [
    ['smart-wallet-elite', 847, 23],
    ['smart-wallet-sniper', 623, 18],
    ['whale-tracker', 512, 15],
    ['kol-tracker', 489, 12],
    ['volume-spike', 378, 9],
    ['narrative-new', 334, 11],
    ['dexscreener', 289, 7],
    ['whale-accumulation', 256, 8],
    ['kol-social', 234, 6],
    ['pump-koth', 198, 5],
    ['narrative-momentum', 167, 4],
    ['new-listing', 145, 3],
    ['new-launch', 123, 4],
    ['news-scraper', 98, 2],
    ['panda_alpha', 87, 3],
    ['dex-volume-anomaly', 76, 2],
    ['twitter-sentiment', 65, 1]
  ];
  
  for (const [source, count, todayNew] of demoData) {
    sourceFollowerCounts.set(source, {
      count,
      todayNew,
      lastUpdate: Date.now()
    });
  }
}

// === SETTINGS MANAGEMENT ===

/**
 * Get current copy settings
 */
export function getSourceCopySettings(): SourceCopySettings {
  return { ...copySettings };
}

/**
 * Update copy settings
 */
export function updateSourceCopySettings(updates: Partial<SourceCopySettings>): SourceCopySettings {
  copySettings = {
    ...copySettings,
    ...updates
  };
  console.log('[SOCIAL-COPY] Settings updated');
  return { ...copySettings };
}

/**
 * Reset settings to defaults
 */
export function resetSourceCopySettings(): SourceCopySettings {
  copySettings = { ...DEFAULT_COPY_SETTINGS };
  return { ...copySettings };
}

// === SOURCE FOLLOWING ===

/**
 * Get display name for a source
 */
export function getSourceDisplayName(source: SignalSource): string {
  return SOURCE_DISPLAY_NAMES[source] || source;
}

/**
 * Follow a signal source
 */
export function followSource(
  source: SignalSource,
  options?: {
    notes?: string;
    enabled?: boolean;
    customSettings?: Partial<SourceCopySettings>;
  }
): FollowedSource {
  // Check if already following
  const existing = Array.from(followedSources.values()).find(f => f.source === source);
  if (existing) {
    throw new Error(`Already following ${getSourceDisplayName(source)}`);
  }
  
  const id = `src_${crypto.randomBytes(8).toString('hex')}`;
  
  const followed: FollowedSource = {
    id,
    source,
    displayName: getSourceDisplayName(source),
    followedAt: Date.now(),
    enabled: options?.enabled ?? true,
    notes: options?.notes,
    customSettings: options?.customSettings,
    stats: {
      signalsCopied: 0,
      signalsSkipped: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      totalPnL: 0,
      avgRoi: 0,
      bestTrade: null
    }
  };
  
  followedSources.set(id, followed);
  
  // Update follower count
  const counts = sourceFollowerCounts.get(source) || { count: 0, todayNew: 0, lastUpdate: Date.now() };
  counts.count++;
  counts.todayNew++;
  counts.lastUpdate = Date.now();
  sourceFollowerCounts.set(source, counts);
  
  console.log(`[SOCIAL-COPY] Now following: ${followed.displayName}`);
  return followed;
}

/**
 * Unfollow a signal source
 */
export function unfollowSource(idOrSource: string): boolean {
  // Try by ID first
  if (followedSources.has(idOrSource)) {
    const followed = followedSources.get(idOrSource)!;
    followedSources.delete(idOrSource);
    
    // Update follower count
    const counts = sourceFollowerCounts.get(followed.source);
    if (counts && counts.count > 0) {
      counts.count--;
      counts.lastUpdate = Date.now();
    }
    
    console.log(`[SOCIAL-COPY] Unfollowed: ${followed.displayName}`);
    return true;
  }
  
  // Try by source name
  for (const [id, followed] of followedSources) {
    if (followed.source === idOrSource) {
      followedSources.delete(id);
      
      const counts = sourceFollowerCounts.get(followed.source);
      if (counts && counts.count > 0) {
        counts.count--;
        counts.lastUpdate = Date.now();
      }
      
      console.log(`[SOCIAL-COPY] Unfollowed: ${followed.displayName}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Get all followed sources
 */
export function getFollowedSources(): FollowedSource[] {
  return Array.from(followedSources.values());
}

/**
 * Get a specific followed source
 */
export function getFollowedSource(idOrSource: string): FollowedSource | undefined {
  // Try by ID
  if (followedSources.has(idOrSource)) {
    return followedSources.get(idOrSource);
  }
  
  // Try by source name
  return Array.from(followedSources.values()).find(f => f.source === idOrSource);
}

/**
 * Update a followed source
 */
export function updateFollowedSource(
  idOrSource: string,
  updates: Partial<Pick<FollowedSource, 'enabled' | 'notes' | 'customSettings'>>
): FollowedSource | undefined {
  const followed = getFollowedSource(idOrSource);
  if (!followed) return undefined;
  
  if (updates.enabled !== undefined) followed.enabled = updates.enabled;
  if (updates.notes !== undefined) followed.notes = updates.notes;
  if (updates.customSettings !== undefined) {
    followed.customSettings = {
      ...followed.customSettings,
      ...updates.customSettings
    };
  }
  
  return followed;
}

/**
 * Toggle source enabled status
 */
export function toggleSourceEnabled(idOrSource: string): boolean | undefined {
  const followed = getFollowedSource(idOrSource);
  if (!followed) return undefined;
  
  followed.enabled = !followed.enabled;
  return followed.enabled;
}

/**
 * Check if following a source
 */
export function isFollowingSource(source: SignalSource): boolean {
  return Array.from(followedSources.values()).some(f => f.source === source);
}

/**
 * Get follower count for a source
 */
export function getSourceFollowerCount(source: SignalSource): SourceFollowerCount {
  const counts = sourceFollowerCounts.get(source) || { count: 0, todayNew: 0, lastUpdate: Date.now() };
  
  // Calculate trend
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (counts.todayNew >= 5) trend = 'up';
  else if (counts.todayNew < 0) trend = 'down';
  
  return {
    source,
    displayName: getSourceDisplayName(source),
    followerCount: counts.count,
    followersToday: counts.todayNew,
    trend
  };
}

/**
 * Get follower counts for all sources
 */
export function getAllSourceFollowerCounts(): SourceFollowerCount[] {
  const allSources: SignalSource[] = Object.keys(SOURCE_DISPLAY_NAMES) as SignalSource[];
  
  return allSources.map(source => getSourceFollowerCount(source))
    .sort((a, b) => b.followerCount - a.followerCount);
}

// === COPY TRADING LOGIC ===

/**
 * Check if a signal should be copied
 */
export function shouldCopySignal(signal: AggregatedSignal): CopyDecision {
  const reasons: string[] = [];
  const skipReasons: string[] = [];
  
  // Check if copy trading is enabled
  if (!copySettings.enabled) {
    return {
      shouldCopy: false,
      reasons,
      skipReasons: ['Copy trading is disabled']
    };
  }
  
  // Check if we're following any of the signal's sources
  const signalSources = signal.sources.map(s => s.source);
  const followedForSignal = getFollowedSources().filter(
    f => f.enabled && signalSources.includes(f.source)
  );
  
  if (followedForSignal.length === 0) {
    return {
      shouldCopy: false,
      reasons,
      skipReasons: ['Not following any source for this signal']
    };
  }
  
  reasons.push(`Following sources: ${followedForSignal.map(f => f.displayName).join(', ')}`);
  
  // Get effective settings (could use custom settings from followed source)
  const effectiveSettings = copySettings;
  
  // Check minimum score
  if (signal.score < effectiveSettings.minScoreToCopy) {
    skipReasons.push(`Score ${signal.score} < min ${effectiveSettings.minScoreToCopy}`);
  } else {
    reasons.push(`Score ${signal.score} >= min ${effectiveSettings.minScoreToCopy}`);
  }
  
  // Check risk level
  if (RISK_PRIORITY[signal.riskLevel] > RISK_PRIORITY[effectiveSettings.maxRiskLevel]) {
    skipReasons.push(`Risk ${signal.riskLevel} exceeds max ${effectiveSettings.maxRiskLevel}`);
  } else {
    reasons.push(`Risk ${signal.riskLevel} <= max ${effectiveSettings.maxRiskLevel}`);
  }
  
  // Check confluence requirement
  if (effectiveSettings.requireMultipleSources) {
    const uniqueSources = signal.confluence?.uniqueSources || signal.sources.length;
    if (uniqueSources < effectiveSettings.minSourcesRequired) {
      skipReasons.push(`Only ${uniqueSources} sources, need ${effectiveSettings.minSourcesRequired}`);
    } else {
      reasons.push(`${uniqueSources} sources (${effectiveSettings.minSourcesRequired} required)`);
    }
  }
  
  // Check safety score
  if (effectiveSettings.requireSafetyCheck && signal.safety) {
    if (signal.safety.safetyScore < effectiveSettings.minSafetyScore) {
      skipReasons.push(`Safety score ${signal.safety.safetyScore} < min ${effectiveSettings.minSafetyScore}`);
    } else {
      reasons.push(`Safety score ${signal.safety.safetyScore} >= min ${effectiveSettings.minSafetyScore}`);
    }
  }
  
  // Check token blacklist/whitelist
  if (effectiveSettings.excludeTokens.includes(signal.token)) {
    skipReasons.push('Token is blacklisted');
  }
  
  if (effectiveSettings.onlyTokens.length > 0 && !effectiveSettings.onlyTokens.includes(signal.token)) {
    skipReasons.push('Token not in whitelist');
  }
  
  // Check daily trade limit
  resetDailyCounterIfNeeded();
  if (dailyTradeCount >= effectiveSettings.maxDailyTrades) {
    skipReasons.push(`Daily trade limit reached (${effectiveSettings.maxDailyTrades})`);
  }
  
  // Check concurrent positions limit
  const openPositions = copiedTrades.filter(t => t.status === 'OPEN').length;
  if (openPositions >= effectiveSettings.maxConcurrentPositions) {
    skipReasons.push(`Max concurrent positions reached (${effectiveSettings.maxConcurrentPositions})`);
  }
  
  // Check token cooldown
  const lastTradeTime = tokenCooldowns.get(signal.token);
  if (lastTradeTime) {
    const cooldownMs = effectiveSettings.cooldownMinutes * 60 * 1000;
    if (Date.now() - lastTradeTime < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (Date.now() - lastTradeTime)) / 60000);
      skipReasons.push(`Token on cooldown (${remaining}m remaining)`);
    }
  }
  
  // Check if we already have a position in this token
  const existingPosition = copiedTrades.find(t => t.token === signal.token && t.status === 'OPEN');
  if (existingPosition) {
    skipReasons.push('Already have open position in this token');
  }
  
  return {
    shouldCopy: skipReasons.length === 0,
    reasons,
    skipReasons
  };
}

/**
 * Process a signal for copy trading
 */
export async function processSignalForCopy(signal: AggregatedSignal): Promise<CopiedTrade | null> {
  const decision = shouldCopySignal(signal);
  
  if (!decision.shouldCopy) {
    // Update stats for followed sources
    const signalSources = signal.sources.map(s => s.source);
    for (const followed of followedSources.values()) {
      if (signalSources.includes(followed.source)) {
        followed.stats.signalsSkipped++;
      }
    }
    
    // Notify if enabled
    if (copySettings.notifyOnSkip) {
      emitEvent({
        type: 'SKIPPED',
        signal,
        reason: decision.skipReasons?.join('; ')
      });
    }
    
    return null;
  }
  
  // Calculate position size
  const portfolio = getPaperPortfolio();
  if (!portfolio) {
    console.error('[SOCIAL-COPY] No paper portfolio initialized');
    return null;
  }
  
  const positionValue = Math.min(
    portfolio.currentBalance * (copySettings.positionSizePercent / 100),
    copySettings.maxPositionUSD
  );
  
  if (positionValue < 1) {
    console.log('[SOCIAL-COPY] Position size too small, skipping');
    return null;
  }
  
  // Execute paper trade
  const entryPrice = signal.marketData.price || 0.0001; // Use signal price or estimate
  const positionTokens = positionValue / entryPrice;
  
  // Create copied trade record
  const tradeId = `copy_${crypto.randomBytes(8).toString('hex')}`;
  
  // Find which followed source triggered this
  const signalSources = signal.sources.map(s => s.source);
  const triggeredSource = Array.from(followedSources.values()).find(
    f => f.enabled && signalSources.includes(f.source)
  );
  
  const copiedTrade: CopiedTrade = {
    id: tradeId,
    signalId: signal.id,
    sourceId: triggeredSource?.id || 'unknown',
    source: triggeredSource?.source || signalSources[0],
    token: signal.token,
    symbol: signal.symbol,
    entryPrice,
    currentPrice: entryPrice,
    athPrice: entryPrice,
    athTimestamp: Date.now(),
    positionSize: positionValue,
    positionTokens,
    roi: 0,
    athRoi: 0,
    status: 'OPEN',
    openedAt: Date.now(),
    signalScore: signal.score,
    signalRiskLevel: signal.riskLevel
  };
  
  // Execute paper trade
  try {
    const paperTrade = await executePaperTrade(
      signal.token,
      positionValue,
      true, // isBuy
      100, signal.id)
    ;
    
    if (paperTrade) {
      copiedTrade.paperTradeId = paperTrade.id;
    }
  } catch (error) {
    console.error('[SOCIAL-COPY] Paper trade execution error:', error);
  }
  
  copiedTrades.push(copiedTrade);
  
  // Update counters
  dailyTradeCount++;
  tokenCooldowns.set(signal.token, Date.now());
  
  // Update followed source stats
  if (triggeredSource) {
    triggeredSource.stats.signalsCopied++;
    triggeredSource.stats.pending++;
  }
  
  // Emit event
  if (copySettings.notifyOnCopy) {
    emitEvent({
      type: 'COPIED',
      trade: copiedTrade,
      signal
    });
  }
  
  console.log(`[SOCIAL-COPY] Copied trade: ${signal.symbol} from ${triggeredSource?.displayName || 'unknown'}`);
  
  return copiedTrade;
}

/**
 * Update price for a copied trade
 */
export function updateCopiedTradePrice(tradeId: string, currentPrice: number): void {
  const trade = copiedTrades.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'OPEN') return;
  
  trade.currentPrice = currentPrice;
  trade.roi = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
  
  // Update ATH
  if (currentPrice > trade.athPrice) {
    trade.athPrice = currentPrice;
    trade.athTimestamp = Date.now();
    trade.athRoi = trade.roi;
  }
  
  // Check auto-sell triggers
  if (copySettings.autoSell) {
    checkAutoSellTriggers(trade);
  }
}

/**
 * Update prices for all open trades
 */
export function updateAllCopiedTradePrices(priceMap: Map<string, number>): void {
  for (const trade of copiedTrades) {
    if (trade.status === 'OPEN') {
      const price = priceMap.get(trade.token);
      if (price) {
        updateCopiedTradePrice(trade.id, price);
      }
    }
  }
}

/**
 * Check and execute auto-sell triggers
 */
function checkAutoSellTriggers(trade: CopiedTrade): void {
  if (trade.status !== 'OPEN') return;
  
  // Take profit
  if (trade.roi >= copySettings.takeProfitPercent) {
    closeCopiedTrade(trade.id, 'TAKE_PROFIT');
    return;
  }
  
  // Stop loss
  if (trade.roi <= -copySettings.stopLossPercent) {
    closeCopiedTrade(trade.id, 'STOP_LOSS');
    return;
  }
  
  // Trailing stop
  if (copySettings.trailingStopPercent > 0 && trade.athRoi > copySettings.trailingStopPercent) {
    const dropFromAth = trade.athRoi - trade.roi;
    if (dropFromAth >= copySettings.trailingStopPercent) {
      closeCopiedTrade(trade.id, 'TRAILING_STOP');
      return;
    }
  }
  
  // Time limit
  if (copySettings.maxHoldingHours > 0) {
    const holdingMs = Date.now() - trade.openedAt;
    const maxMs = copySettings.maxHoldingHours * 60 * 60 * 1000;
    if (holdingMs >= maxMs) {
      closeCopiedTrade(trade.id, 'TIME_LIMIT');
      return;
    }
  }
}

/**
 * Close a copied trade
 */
export function closeCopiedTrade(
  tradeId: string,
  reason: CopiedTrade['closeReason']
): CopiedTrade | undefined {
  const trade = copiedTrades.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'OPEN') return undefined;
  
  // Determine win/loss
  trade.status = trade.roi >= 0 ? 'WIN' : 'LOSS';
  trade.closeReason = reason;
  trade.closedAt = Date.now();
  
  // Update followed source stats
  const followed = followedSources.get(trade.sourceId);
  if (followed) {
    followed.stats.pending--;
    if (trade.status === 'WIN') {
      followed.stats.wins++;
    } else {
      followed.stats.losses++;
    }
    followed.stats.totalPnL += trade.roi * trade.positionSize / 100;
    
    // Update avg ROI
    const closedCount = followed.stats.wins + followed.stats.losses;
    if (closedCount > 0) {
      followed.stats.avgRoi = followed.stats.totalPnL / closedCount;
    }
    
    // Update best trade
    if (!followed.stats.bestTrade || trade.roi > followed.stats.bestTrade.roi) {
      followed.stats.bestTrade = {
        symbol: trade.symbol,
        roi: trade.roi,
        timestamp: trade.openedAt
      };
    }
  }
  
  // Emit event
  if (copySettings.notifyOnClose) {
    emitEvent({
      type: 'CLOSED',
      trade,
      reason: reason
    });
  }
  
  console.log(`[SOCIAL-COPY] Closed trade: ${trade.symbol} - ${trade.status} (${reason}) - ROI: ${trade.roi.toFixed(2)}%`);
  
  return trade;
}

/**
 * Manually close a trade
 */
export function manualCloseTrade(tradeId: string): CopiedTrade | undefined {
  return closeCopiedTrade(tradeId, 'MANUAL');
}

// === PERFORMANCE TRACKING ===

/**
 * Get all copied trades
 */
export function getCopiedTrades(options?: {
  status?: CopiedTrade['status'];
  source?: SignalSource;
  limit?: number;
}): CopiedTrade[] {
  let trades = [...copiedTrades];
  
  if (options?.status) {
    trades = trades.filter(t => t.status === options.status);
  }
  
  if (options?.source) {
    trades = trades.filter(t => t.source === options.source);
  }
  
  // Sort by most recent
  trades.sort((a, b) => b.openedAt - a.openedAt);
  
  if (options?.limit) {
    trades = trades.slice(0, options.limit);
  }
  
  return trades;
}

/**
 * Get copy trading performance stats
 */
export function getCopyPerformanceStats(): CopyPerformanceStats {
  const wins = copiedTrades.filter(t => t.status === 'WIN');
  const losses = copiedTrades.filter(t => t.status === 'LOSS');
  const pending = copiedTrades.filter(t => t.status === 'OPEN');
  
  const closed = [...wins, ...losses];
  const totalPnL = closed.reduce((sum, t) => sum + (t.roi * t.positionSize / 100), 0);
  const avgRoi = closed.length > 0 
    ? closed.reduce((sum, t) => sum + t.roi, 0) / closed.length 
    : 0;
  
  // Source breakdown
  const sourceMap = new Map<SignalSource, {
    trades: number;
    wins: number;
    losses: number;
    pnl: number;
  }>();
  
  for (const trade of copiedTrades) {
    const data = sourceMap.get(trade.source) || { trades: 0, wins: 0, losses: 0, pnl: 0 };
    data.trades++;
    if (trade.status === 'WIN') data.wins++;
    if (trade.status === 'LOSS') data.losses++;
    if (trade.status !== 'OPEN') {
      data.pnl += trade.roi * trade.positionSize / 100;
    }
    sourceMap.set(trade.source, data);
  }
  
  const sourceBreakdown = Array.from(sourceMap.entries()).map(([source, data]) => ({
    source,
    displayName: getSourceDisplayName(source),
    trades: data.trades,
    wins: data.wins,
    losses: data.losses,
    winRate: data.wins + data.losses > 0 
      ? Math.round((data.wins / (data.wins + data.losses)) * 100) 
      : 0,
    pnl: Math.round(data.pnl * 100) / 100
  })).sort((a, b) => b.winRate - a.winRate);
  
  // Daily stats (last 7 days)
  const dailyMap = new Map<string, { trades: number; wins: number; losses: number; pnl: number }>();
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    dailyMap.set(dateStr, { trades: 0, wins: 0, losses: 0, pnl: 0 });
  }
  
  for (const trade of copiedTrades) {
    const dateStr = new Date(trade.openedAt).toISOString().split('T')[0];
    if (dailyMap.has(dateStr)) {
      const data = dailyMap.get(dateStr)!;
      data.trades++;
      if (trade.status === 'WIN') data.wins++;
      if (trade.status === 'LOSS') data.losses++;
      if (trade.status !== 'OPEN') {
        data.pnl += trade.roi * trade.positionSize / 100;
      }
    }
  }
  
  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      ...data,
      pnl: Math.round(data.pnl * 100) / 100
    }))
    .reverse();
  
  // Find best/worst trades
  const sortedByRoi = [...closed].sort((a, b) => b.roi - a.roi);
  
  return {
    totalCopied: copiedTrades.length,
    totalWins: wins.length,
    totalLosses: losses.length,
    totalPending: pending.length,
    overallWinRate: closed.length > 0 
      ? Math.round((wins.length / closed.length) * 100) 
      : 0,
    totalPnL: Math.round(totalPnL * 100) / 100,
    avgRoi: Math.round(avgRoi * 100) / 100,
    bestTrade: sortedByRoi[0] || null,
    worstTrade: sortedByRoi[sortedByRoi.length - 1] || null,
    sourceBreakdown,
    dailyStats
  };
}

/**
 * Get summary for dashboard
 */
export function getCopySummary(): {
  settings: SourceCopySettings;
  following: FollowedSource[];
  stats: CopyPerformanceStats;
  recentTrades: CopiedTrade[];
  openPositions: CopiedTrade[];
} {
  return {
    settings: getSourceCopySettings(),
    following: getFollowedSources(),
    stats: getCopyPerformanceStats(),
    recentTrades: getCopiedTrades({ limit: 10 }),
    openPositions: getCopiedTrades({ status: 'OPEN' })
  };
}

// === UTILITY FUNCTIONS ===

function resetDailyCounterIfNeeded(): void {
  const today = new Date().setHours(0, 0, 0, 0);
  if (today > lastDayReset) {
    dailyTradeCount = 0;
    lastDayReset = today;
    
    // Also reset todayNew for follower counts
    for (const counts of sourceFollowerCounts.values()) {
      counts.todayNew = 0;
    }
  }
}

function emitEvent(event: Parameters<CopyEventCallback>[0]): void {
  for (const callback of eventCallbacks) {
    try {
      callback(event);
    } catch (error) {
      console.error('[SOCIAL-COPY] Event callback error:', error);
    }
  }
}

/**
 * Register event callback
 */
export function onCopyEvent(callback: CopyEventCallback): void {
  eventCallbacks.push(callback);
}

// === DEMO DATA GENERATION ===

/**
 * Generate demo copy trading data
 */
export function generateDemoCopyData(): void {
  // Follow some sources
  const sourcesToFollow: SignalSource[] = [
    'smart-wallet-elite',
    'whale-tracker',
    'kol-tracker'
  ];
  
  for (const source of sourcesToFollow) {
    try {
      followSource(source, { enabled: true });
    } catch (e) {
      // Already following, ignore
    }
  }
  
  // Generate some demo trades
  const demoTrades: Array<{
    symbol: string;
    source: SignalSource;
    roi: number;
    status: CopiedTrade['status'];
    daysAgo: number;
  }> = [
    { symbol: 'PEPE', source: 'smart-wallet-elite', roi: 127.5, status: 'WIN', daysAgo: 1 },
    { symbol: 'WIF', source: 'whale-tracker', roi: 85.3, status: 'WIN', daysAgo: 2 },
    { symbol: 'BONK', source: 'kol-tracker', roi: -18.5, status: 'LOSS', daysAgo: 2 },
    { symbol: 'POPCAT', source: 'smart-wallet-elite', roi: 45.2, status: 'OPEN', daysAgo: 0 },
    { symbol: 'MOG', source: 'whale-tracker', roi: 234.8, status: 'WIN', daysAgo: 3 },
    { symbol: 'BRETT', source: 'smart-wallet-elite', roi: 12.4, status: 'OPEN', daysAgo: 0 }
  ];
  
  for (const demo of demoTrades) {
    const followed = Array.from(followedSources.values()).find(f => f.source === demo.source);
    if (!followed) continue;
    
    const tradeId = `demo_${crypto.randomBytes(6).toString('hex')}`;
    const entryPrice = 0.0001;
    const currentPrice = entryPrice * (1 + demo.roi / 100);
    
    const trade: CopiedTrade = {
      id: tradeId,
      signalId: `sig_${tradeId}`,
      sourceId: followed.id,
      source: demo.source,
      token: `${demo.symbol}...demo`,
      symbol: demo.symbol,
      entryPrice,
      currentPrice,
      athPrice: demo.status === 'WIN' ? currentPrice * 1.1 : currentPrice,
      athTimestamp: Date.now() - (demo.daysAgo - 0.5) * 24 * 60 * 60 * 1000,
      positionSize: 50,
      positionTokens: 50 / entryPrice,
      roi: demo.roi,
      athRoi: demo.status === 'WIN' ? demo.roi * 1.1 : demo.roi,
      status: demo.status,
      closeReason: demo.status === 'WIN' ? 'TAKE_PROFIT' : demo.status === 'LOSS' ? 'STOP_LOSS' : undefined,
      openedAt: Date.now() - demo.daysAgo * 24 * 60 * 60 * 1000,
      closedAt: demo.status !== 'OPEN' ? Date.now() - (demo.daysAgo - 0.5) * 24 * 60 * 60 * 1000 : undefined,
      signalScore: 75 + Math.floor(Math.random() * 15),
      signalRiskLevel: 'MEDIUM'
    };
    
    copiedTrades.push(trade);
    
    // Update source stats
    followed.stats.signalsCopied++;
    if (demo.status === 'WIN') followed.stats.wins++;
    else if (demo.status === 'LOSS') followed.stats.losses++;
    else followed.stats.pending++;
    followed.stats.totalPnL += demo.roi * trade.positionSize / 100;
  }
  
  // Enable copy trading
  copySettings.enabled = true;
  
  console.log('[SOCIAL-COPY] Demo data generated');
}

// Export types and default settings
export { DEFAULT_COPY_SETTINGS, SOURCE_DISPLAY_NAMES };
