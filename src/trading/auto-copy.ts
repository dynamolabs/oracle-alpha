/**
 * Auto-Copy Trading System
 * Follow specific smart wallets and auto-execute paper trades when they buy
 * 
 * Features:
 * - Follow/unfollow specific wallets
 * - Configurable settings (minScore, maxRisk, positionSize)
 * - Auto-execute paper trades on wallet activity
 * - Real-time tracking of followed wallet performance
 */

import crypto from 'crypto';
import { RawSignal, SignalSource, RiskLevel, AggregatedSignal } from '../types';
import { executePaperTrade, getPaperPortfolio, initPaperPortfolio } from './jupiter';

// Types
export interface FollowedWallet {
  id: string;
  address: string;
  label: string;
  addedAt: number;
  enabled: boolean;
  winRate?: number;
  source?: SignalSource;
  notes?: string;
  // Performance tracking
  stats: {
    signalsReceived: number;
    tradesExecuted: number;
    wins: number;
    losses: number;
    totalPnL: number;
  };
}

export interface AutoCopySettings {
  enabled: boolean;
  minScore: number;           // Minimum signal score to copy (0-100)
  maxRisk: RiskLevel;         // Maximum risk level to copy
  positionSizePercent: number; // Position size as % of portfolio (1-100)
  maxPositionUSD: number;     // Maximum position size in USD
  maxDailyTrades: number;     // Maximum trades per day
  cooldownMinutes: number;    // Cooldown between trades on same token
  requireConfluence: boolean; // Require multiple sources
  minConfluenceSources: number; // Minimum sources for confluence
  slippageBps: number;        // Slippage tolerance in basis points
  autoSell: boolean;          // Auto-sell at take profit / stop loss
  takeProfitPercent: number;  // Take profit target (%)
  stopLossPercent: number;    // Stop loss target (%)
}

export interface CopyTradeExecution {
  id: string;
  timestamp: number;
  walletId: string;
  walletAddress: string;
  walletLabel: string;
  signalId?: string;
  token: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price?: number;
  status: 'PENDING' | 'EXECUTED' | 'SKIPPED' | 'FAILED';
  skipReason?: string;
  tradeId?: string; // Reference to paper trade
  pnl?: number;
}

// Default settings
const DEFAULT_SETTINGS: AutoCopySettings = {
  enabled: false,
  minScore: 70,
  maxRisk: 'MEDIUM',
  positionSizePercent: 5,
  maxPositionUSD: 100,
  maxDailyTrades: 10,
  cooldownMinutes: 30,
  requireConfluence: false,
  minConfluenceSources: 2,
  slippageBps: 100,
  autoSell: true,
  takeProfitPercent: 50,
  stopLossPercent: 20
};

// Risk level priority for comparison
const RISK_PRIORITY: Record<RiskLevel, number> = {
  'LOW': 1,
  'MEDIUM': 2,
  'HIGH': 3,
  'EXTREME': 4
};

// State
let settings: AutoCopySettings = { ...DEFAULT_SETTINGS };
const followedWallets: Map<string, FollowedWallet> = new Map();
const copyTradeHistory: CopyTradeExecution[] = [];
const tokenCooldowns: Map<string, number> = new Map(); // token -> last trade timestamp
let dailyTradeCount = 0;
let lastDayReset = new Date().setHours(0, 0, 0, 0);

// Event callbacks
type CopyTradeCallback = (execution: CopyTradeExecution) => void;
const copyTradeCallbacks: CopyTradeCallback[] = [];

/**
 * Initialize auto-copy system
 */
export function initAutoCopy(): void {
  // Ensure paper portfolio exists
  if (!getPaperPortfolio()) {
    initPaperPortfolio(1000);
  }
  
  console.log('[AUTO-COPY] System initialized');
}

/**
 * Get current settings
 */
export function getAutoCopySettings(): AutoCopySettings {
  return { ...settings };
}

/**
 * Update settings
 */
export function updateAutoCopySettings(newSettings: Partial<AutoCopySettings>): AutoCopySettings {
  settings = {
    ...settings,
    ...newSettings
  };
  
  console.log('[AUTO-COPY] Settings updated:', settings);
  return { ...settings };
}

/**
 * Reset settings to defaults
 */
export function resetAutoCopySettings(): AutoCopySettings {
  settings = { ...DEFAULT_SETTINGS };
  return { ...settings };
}

/**
 * Follow a new wallet
 */
export function followWallet(
  address: string, 
  label: string, 
  options?: {
    winRate?: number;
    source?: SignalSource;
    notes?: string;
    enabled?: boolean;
  }
): FollowedWallet {
  const id = `wallet_${crypto.randomBytes(8).toString('hex')}`;
  
  const wallet: FollowedWallet = {
    id,
    address: address.trim(),
    label: label.trim(),
    addedAt: Date.now(),
    enabled: options?.enabled ?? true,
    winRate: options?.winRate,
    source: options?.source,
    notes: options?.notes,
    stats: {
      signalsReceived: 0,
      tradesExecuted: 0,
      wins: 0,
      losses: 0,
      totalPnL: 0
    }
  };
  
  followedWallets.set(id, wallet);
  console.log(`[AUTO-COPY] Now following wallet: ${label} (${address})`);
  
  return wallet;
}

/**
 * Unfollow a wallet
 */
export function unfollowWallet(idOrAddress: string): boolean {
  // Try by ID first
  if (followedWallets.has(idOrAddress)) {
    followedWallets.delete(idOrAddress);
    console.log(`[AUTO-COPY] Unfollowed wallet: ${idOrAddress}`);
    return true;
  }
  
  // Try by address
  for (const [id, wallet] of followedWallets) {
    if (wallet.address.toLowerCase() === idOrAddress.toLowerCase()) {
      followedWallets.delete(id);
      console.log(`[AUTO-COPY] Unfollowed wallet: ${wallet.label}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Get all followed wallets
 */
export function getFollowedWallets(): FollowedWallet[] {
  return Array.from(followedWallets.values());
}

/**
 * Get a specific followed wallet
 */
export function getFollowedWallet(idOrAddress: string): FollowedWallet | undefined {
  if (followedWallets.has(idOrAddress)) {
    return followedWallets.get(idOrAddress);
  }
  
  for (const wallet of followedWallets.values()) {
    if (wallet.address.toLowerCase() === idOrAddress.toLowerCase()) {
      return wallet;
    }
  }
  
  return undefined;
}

/**
 * Update a followed wallet
 */
export function updateFollowedWallet(
  idOrAddress: string, 
  updates: Partial<Omit<FollowedWallet, 'id' | 'address' | 'addedAt' | 'stats'>>
): FollowedWallet | null {
  const wallet = getFollowedWallet(idOrAddress);
  if (!wallet) return null;
  
  Object.assign(wallet, updates);
  return wallet;
}

/**
 * Toggle wallet enabled status
 */
export function toggleWalletEnabled(idOrAddress: string): boolean {
  const wallet = getFollowedWallet(idOrAddress);
  if (!wallet) return false;
  
  wallet.enabled = !wallet.enabled;
  return wallet.enabled;
}

/**
 * Check if a wallet is being followed
 */
export function isWalletFollowed(address: string): boolean {
  for (const wallet of followedWallets.values()) {
    if (wallet.address.toLowerCase() === address.toLowerCase()) {
      return true;
    }
  }
  return false;
}

/**
 * Check daily trade limit
 */
function checkDailyLimit(): boolean {
  const today = new Date().setHours(0, 0, 0, 0);
  
  // Reset counter if new day
  if (today > lastDayReset) {
    dailyTradeCount = 0;
    lastDayReset = today;
  }
  
  return dailyTradeCount < settings.maxDailyTrades;
}

/**
 * Check cooldown for a token
 */
function checkTokenCooldown(token: string): boolean {
  const lastTrade = tokenCooldowns.get(token);
  if (!lastTrade) return true;
  
  const cooldownMs = settings.cooldownMinutes * 60 * 1000;
  return Date.now() - lastTrade >= cooldownMs;
}

/**
 * Check if a signal passes copy filters
 */
export function shouldCopySignal(
  signal: AggregatedSignal,
  walletAddress?: string
): { shouldCopy: boolean; reason?: string } {
  // Check if auto-copy is enabled
  if (!settings.enabled) {
    return { shouldCopy: false, reason: 'Auto-copy is disabled' };
  }
  
  // Check if wallet is followed (if provided)
  if (walletAddress) {
    const wallet = getFollowedWallet(walletAddress);
    if (!wallet) {
      return { shouldCopy: false, reason: 'Wallet not followed' };
    }
    if (!wallet.enabled) {
      return { shouldCopy: false, reason: 'Wallet is disabled' };
    }
  }
  
  // Check minimum score
  if (signal.score < settings.minScore) {
    return { shouldCopy: false, reason: `Score ${signal.score} below minimum ${settings.minScore}` };
  }
  
  // Check risk level
  const signalRiskPriority = RISK_PRIORITY[signal.riskLevel] || 4;
  const maxRiskPriority = RISK_PRIORITY[settings.maxRisk] || 2;
  if (signalRiskPriority > maxRiskPriority) {
    return { shouldCopy: false, reason: `Risk ${signal.riskLevel} exceeds max ${settings.maxRisk}` };
  }
  
  // Check confluence
  if (settings.requireConfluence) {
    const sources = signal.confluence?.uniqueSources || signal.sources.length;
    if (sources < settings.minConfluenceSources) {
      return { shouldCopy: false, reason: `Only ${sources} sources, need ${settings.minConfluenceSources}` };
    }
  }
  
  // Check daily limit
  if (!checkDailyLimit()) {
    return { shouldCopy: false, reason: `Daily trade limit (${settings.maxDailyTrades}) reached` };
  }
  
  // Check token cooldown
  if (!checkTokenCooldown(signal.token)) {
    return { shouldCopy: false, reason: `Token on cooldown (${settings.cooldownMinutes} min)` };
  }
  
  return { shouldCopy: true };
}

/**
 * Calculate position size for a trade
 */
export function calculatePositionSize(): number {
  const portfolio = getPaperPortfolio();
  if (!portfolio) return 0;
  
  const percentSize = portfolio.currentBalance * (settings.positionSizePercent / 100);
  return Math.min(percentSize, settings.maxPositionUSD);
}

/**
 * Execute an auto-copy trade
 */
export async function executeCopyTrade(
  signal: AggregatedSignal,
  walletAddress: string,
  walletLabel: string
): Promise<CopyTradeExecution> {
  const executionId = `copy_${crypto.randomBytes(8).toString('hex')}`;
  
  // Check if we should copy
  const { shouldCopy, reason } = shouldCopySignal(signal, walletAddress);
  
  if (!shouldCopy) {
    const skipped: CopyTradeExecution = {
      id: executionId,
      timestamp: Date.now(),
      walletId: getFollowedWallet(walletAddress)?.id || '',
      walletAddress,
      walletLabel,
      signalId: signal.id,
      token: signal.token,
      symbol: signal.symbol,
      action: 'BUY',
      amount: 0,
      status: 'SKIPPED',
      skipReason: reason
    };
    
    copyTradeHistory.unshift(skipped);
    
    // Update wallet stats
    const wallet = getFollowedWallet(walletAddress);
    if (wallet) {
      wallet.stats.signalsReceived++;
    }
    
    return skipped;
  }
  
  // Calculate position size
  const positionSize = calculatePositionSize();
  
  if (positionSize <= 0) {
    const failed: CopyTradeExecution = {
      id: executionId,
      timestamp: Date.now(),
      walletId: getFollowedWallet(walletAddress)?.id || '',
      walletAddress,
      walletLabel,
      signalId: signal.id,
      token: signal.token,
      symbol: signal.symbol,
      action: 'BUY',
      amount: 0,
      status: 'FAILED',
      skipReason: 'Insufficient portfolio balance'
    };
    
    copyTradeHistory.unshift(failed);
    return failed;
  }
  
  // Execute paper trade
  try {
    const trade = await executePaperTrade(
      signal.token,
      positionSize,
      true, // isBuy
      settings.slippageBps,
      signal.id,
      signal.score
    );
    
    if (trade.status === 'EXECUTED') {
      // Update cooldown
      tokenCooldowns.set(signal.token, Date.now());
      dailyTradeCount++;
      
      // Update wallet stats
      const wallet = getFollowedWallet(walletAddress);
      if (wallet) {
        wallet.stats.signalsReceived++;
        wallet.stats.tradesExecuted++;
      }
      
      const executed: CopyTradeExecution = {
        id: executionId,
        timestamp: Date.now(),
        walletId: getFollowedWallet(walletAddress)?.id || '',
        walletAddress,
        walletLabel,
        signalId: signal.id,
        token: signal.token,
        symbol: signal.symbol,
        action: 'BUY',
        amount: positionSize,
        price: trade.price,
        status: 'EXECUTED',
        tradeId: trade.id
      };
      
      copyTradeHistory.unshift(executed);
      
      // Notify callbacks
      copyTradeCallbacks.forEach(cb => cb(executed));
      
      console.log(`[AUTO-COPY] Executed: BUY $${signal.symbol} for $${positionSize.toFixed(2)} (Score: ${signal.score})`);
      
      return executed;
    } else {
      const failed: CopyTradeExecution = {
        id: executionId,
        timestamp: Date.now(),
        walletId: getFollowedWallet(walletAddress)?.id || '',
        walletAddress,
        walletLabel,
        signalId: signal.id,
        token: signal.token,
        symbol: signal.symbol,
        action: 'BUY',
        amount: positionSize,
        status: 'FAILED',
        skipReason: trade.error || 'Trade execution failed'
      };
      
      copyTradeHistory.unshift(failed);
      return failed;
    }
  } catch (error) {
    const failed: CopyTradeExecution = {
      id: executionId,
      timestamp: Date.now(),
      walletId: getFollowedWallet(walletAddress)?.id || '',
      walletAddress,
      walletLabel,
      signalId: signal.id,
      token: signal.token,
      symbol: signal.symbol,
      action: 'BUY',
      amount: positionSize,
      status: 'FAILED',
      skipReason: error instanceof Error ? error.message : 'Unknown error'
    };
    
    copyTradeHistory.unshift(failed);
    return failed;
  }
}

/**
 * Process a new signal for auto-copy
 * Called when a new signal is detected from a followed wallet
 */
export async function processSignalForAutoCopy(
  signal: AggregatedSignal,
  sourceWallet?: string
): Promise<CopyTradeExecution | null> {
  // Check if this signal came from a followed wallet
  let walletAddress = sourceWallet;
  let walletLabel = 'Unknown';
  
  // Try to find wallet from signal metadata
  if (!walletAddress) {
    const walletMeta = signal.sources.find(s => 
      s.source.includes('smart-wallet') && 
      (s as any).metadata?.wallet
    );
    if (walletMeta) {
      walletAddress = (walletMeta as any).metadata.wallet;
      walletLabel = (walletMeta as any).metadata.walletLabel || walletAddress;
    }
  }
  
  // If we still don't have a wallet, check if any followed wallet matches sources
  if (!walletAddress) {
    for (const wallet of followedWallets.values()) {
      if (wallet.enabled) {
        walletAddress = wallet.address;
        walletLabel = wallet.label;
        break;
      }
    }
  }
  
  if (!walletAddress) {
    return null;
  }
  
  const followedWallet = getFollowedWallet(walletAddress);
  if (followedWallet) {
    walletLabel = followedWallet.label;
  }
  
  return executeCopyTrade(signal, walletAddress, walletLabel);
}

/**
 * Get copy trade history
 */
export function getCopyTradeHistory(limit = 50): CopyTradeExecution[] {
  return copyTradeHistory.slice(0, limit);
}

/**
 * Get copy trade stats
 */
export function getCopyTradeStats(): {
  totalTrades: number;
  executed: number;
  skipped: number;
  failed: number;
  totalPnL: number;
  winRate: number;
  todayTrades: number;
} {
  const today = new Date().setHours(0, 0, 0, 0);
  
  const stats = {
    totalTrades: copyTradeHistory.length,
    executed: 0,
    skipped: 0,
    failed: 0,
    totalPnL: 0,
    winRate: 0,
    todayTrades: 0
  };
  
  let wins = 0;
  let completed = 0;
  
  for (const trade of copyTradeHistory) {
    if (trade.status === 'EXECUTED') stats.executed++;
    else if (trade.status === 'SKIPPED') stats.skipped++;
    else if (trade.status === 'FAILED') stats.failed++;
    
    if (trade.timestamp >= today) stats.todayTrades++;
    
    if (trade.pnl !== undefined) {
      stats.totalPnL += trade.pnl;
      completed++;
      if (trade.pnl > 0) wins++;
    }
  }
  
  stats.winRate = completed > 0 ? (wins / completed) * 100 : 0;
  
  return stats;
}

/**
 * Register callback for copy trade events
 */
export function onCopyTrade(callback: CopyTradeCallback): void {
  copyTradeCallbacks.push(callback);
}

/**
 * Get summary for dashboard
 */
export function getAutoCopySummary(): {
  settings: AutoCopySettings;
  wallets: FollowedWallet[];
  stats: ReturnType<typeof getCopyTradeStats>;
  recentTrades: CopyTradeExecution[];
} {
  return {
    settings: getAutoCopySettings(),
    wallets: getFollowedWallets(),
    stats: getCopyTradeStats(),
    recentTrades: getCopyTradeHistory(10)
  };
}

// Initialize on module load
initAutoCopy();
