/**
 * KOL (Key Opinion Leader) Reliability Scoring System
 * Tracks influencer mentions → outcomes to calculate reliability scores
 */

import { AggregatedSignal, SignalSource } from '../types';

// ===== TYPES =====

export interface KOLCall {
  id: string;
  kolHandle: string;
  kolLabel: string;
  kolTier: 'S' | 'A' | 'B' | 'UNKNOWN';
  token: string;
  symbol: string;
  timestamp: number;
  
  // Price data at mention
  priceAtMention: number;
  mcapAtMention: number;
  
  // Price tracking
  athPrice: number;
  athTimestamp: number;
  price24h: number;
  price7d: number;
  currentPrice: number;
  lastPriceUpdate: number;
  
  // Calculated metrics
  roiCurrent: number;
  roiAth: number;
  roi24h: number;
  roi7d: number;
  
  // Outcome
  status: 'OPEN' | 'WIN' | 'LOSS' | 'EXPIRED';
  profitableEntry: boolean;
  
  // Source context
  tweetId?: string;
  tweetText?: string;
  signalId?: string;
}

export interface KOLStats {
  handle: string;
  label: string;
  tier: 'S' | 'A' | 'B' | 'UNKNOWN';
  
  // Call statistics
  totalCalls: number;
  wins: number;
  losses: number;
  pending: number;
  
  // Performance metrics
  winRate: number;           // 0-100%
  avgRoi: number;            // Average ROI of closed calls
  avgAthRoi: number;         // Average ATH ROI (best possible)
  totalRoi: number;          // Sum of all ROIs
  avgRoi24h: number;         // Average 24h ROI
  avgRoi7d: number;          // Average 7d ROI
  
  // Reliability score (0-100)
  reliabilityScore: number;
  reliabilityTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  
  // Risk indicators
  pumpAndDumpScore: number;  // 0-100, higher = more suspicious
  isPumpAndDump: boolean;    // Flagged as pump and dump
  avgHoldTime: number;       // Average time to peak in minutes
  
  // Best/Worst
  bestCall: {
    symbol: string;
    token: string;
    roi: number;
    timestamp: number;
  } | null;
  worstCall: {
    symbol: string;
    token: string;
    roi: number;
    timestamp: number;
  } | null;
  
  // Metadata
  firstSeen: number;
  lastSeen: number;
  badges: KOLBadge[];
}

export type KOLBadge = 
  | '👑 Top Caller'      // Top 5 by win rate
  | '🎯 Accurate'        // Win rate > 60%
  | '💎 Diamond Hands'   // Avg hold time > 4 hours
  | '🚀 Moon Maker'      // Avg ATH ROI > 100%
  | '📉 Declining'       // Win rate declining
  | '⚠️ Unreliable'      // Win rate < 40%
  | '🗑️ Pump & Dump'     // High pump and dump score
  | '🔥 Hot Streak'      // Last 5 calls all wins
  | '❄️ Cold Streak'     // Last 5 calls all losses
  | '🌟 Rising Star'     // New but good performance
  | '🎖️ Veteran';        // 50+ calls

export interface KOLLeaderboard {
  topReliable: KOLStats[];
  unreliable: KOLStats[];
  risingStars: KOLStats[];
  mostActive: KOLStats[];
  pumpAndDump: KOLStats[];
}

// ===== IN-MEMORY STORAGE =====

const kolCalls = new Map<string, KOLCall>();  // callId -> KOLCall
const kolIndex = new Map<string, Set<string>>();  // handle -> Set<callId>

// Demo mode
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// ===== CORE FUNCTIONS =====

/**
 * Record a new KOL mention/call
 */
export function recordKOLCall(
  signal: AggregatedSignal,
  kolHandle: string,
  kolLabel: string,
  kolTier: 'S' | 'A' | 'B' | 'UNKNOWN' = 'UNKNOWN',
  tweetId?: string,
  tweetText?: string
): KOLCall {
  const callId = `${kolHandle}-${signal.token}-${signal.timestamp}`;
  
  const price = signal.marketData?.price || 0;
  const mcap = signal.marketData?.mcap || 0;
  
  const call: KOLCall = {
    id: callId,
    kolHandle: kolHandle.toLowerCase(),
    kolLabel,
    kolTier,
    token: signal.token,
    symbol: signal.symbol,
    timestamp: signal.timestamp,
    priceAtMention: price,
    mcapAtMention: mcap,
    athPrice: price,
    athTimestamp: signal.timestamp,
    price24h: 0,
    price7d: 0,
    currentPrice: price,
    lastPriceUpdate: signal.timestamp,
    roiCurrent: 0,
    roiAth: 0,
    roi24h: 0,
    roi7d: 0,
    status: 'OPEN',
    profitableEntry: false,
    tweetId,
    tweetText: tweetText?.slice(0, 500),
    signalId: signal.id
  };
  
  // Store the call
  kolCalls.set(callId, call);
  
  // Index by KOL handle
  if (!kolIndex.has(call.kolHandle)) {
    kolIndex.set(call.kolHandle, new Set());
  }
  kolIndex.get(call.kolHandle)!.add(callId);
  
  console.log(`[KOL-RELIABILITY] Recorded call: ${kolLabel} → ${signal.symbol}`);
  
  return call;
}

/**
 * Extract KOL info from signal metadata and record call
 */
export function recordKOLCallFromSignal(signal: AggregatedSignal): KOLCall | null {
  // Check if signal has KOL metadata
  const kolSource = signal.sources.find(
    s => s.source === 'kol-tracker' || s.source === 'kol-social'
  );
  
  if (!kolSource) return null;
  
  // Find metadata from the signal
  const metadata = signal.analysis || {};
  
  // Try to extract KOL info from various places
  let kolHandle = '';
  let kolLabel = '';
  let kolTier: 'S' | 'A' | 'B' | 'UNKNOWN' = 'UNKNOWN';
  let tweetId: string | undefined;
  let tweetText: string | undefined;
  
  // Check if there's KOL info in signal metadata
  // (This would be populated by the kol-tracker source)
  const rawMeta = (signal as any).rawMetadata || {};
  if (rawMeta.kol) {
    kolHandle = rawMeta.kol;
    kolLabel = rawMeta.kolLabel || kolHandle;
    kolTier = rawMeta.kolTier || 'UNKNOWN';
    tweetId = rawMeta.tweetId;
    tweetText = rawMeta.tweetText;
  }
  
  // If we still don't have a handle, try to find it in narratives
  if (!kolHandle && signal.analysis?.narrative) {
    const kolNarrative = signal.analysis.narrative.find(n => 
      n.toLowerCase().includes('kol') || n.toLowerCase().includes('influencer')
    );
    if (kolNarrative) {
      // Extract handle from narrative if possible
      const handleMatch = kolNarrative.match(/@(\w+)/);
      if (handleMatch) {
        kolHandle = handleMatch[1];
        kolLabel = handleMatch[1];
      }
    }
  }
  
  // If no KOL handle found, use the source as identifier
  if (!kolHandle) {
    kolHandle = kolSource.source;
    kolLabel = kolSource.source;
  }
  
  return recordKOLCall(signal, kolHandle, kolLabel, kolTier, tweetId, tweetText);
}

/**
 * Update price for a KOL call
 */
export function updateKOLCallPrice(
  callId: string,
  currentPrice: number,
  is24hUpdate: boolean = false,
  is7dUpdate: boolean = false
): void {
  const call = kolCalls.get(callId);
  if (!call) return;
  
  const now = Date.now();
  call.currentPrice = currentPrice;
  call.lastPriceUpdate = now;
  
  // Calculate ROI
  if (call.priceAtMention > 0) {
    call.roiCurrent = ((currentPrice - call.priceAtMention) / call.priceAtMention) * 100;
  }
  
  // Update ATH
  if (currentPrice > call.athPrice) {
    call.athPrice = currentPrice;
    call.athTimestamp = now;
    call.roiAth = call.roiCurrent;
  }
  
  // Update 24h/7d snapshots
  if (is24hUpdate) {
    call.price24h = currentPrice;
    call.roi24h = call.roiCurrent;
  }
  if (is7dUpdate) {
    call.price7d = currentPrice;
    call.roi7d = call.roiCurrent;
  }
  
  // Determine profitability
  call.profitableEntry = call.roiAth >= 20; // Consider profitable if ATH was +20%
  
  // Update status
  const ageHours = (now - call.timestamp) / (1000 * 60 * 60);
  
  if (ageHours >= 168) { // 7 days
    call.status = 'EXPIRED';
  } else if (call.roiCurrent >= 100) {
    call.status = 'WIN';  // 2x = clear win
  } else if (call.roiCurrent <= -50) {
    call.status = 'LOSS'; // -50% = clear loss
  } else if (ageHours >= 24 && call.roiCurrent >= 20) {
    call.status = 'WIN';  // +20% after 24h = win
  } else if (ageHours >= 24 && call.roiCurrent <= -30) {
    call.status = 'LOSS'; // -30% after 24h = loss
  }
}

/**
 * Update all KOL calls with current prices
 */
export async function updateAllKOLCallPrices(): Promise<void> {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * oneDay;
  
  for (const [callId, call] of kolCalls.entries()) {
    // Skip if too old or recently updated
    if (call.status === 'EXPIRED') continue;
    if (now - call.lastPriceUpdate < 30000) continue; // Updated < 30s ago
    
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${call.token}`
      );
      const data = await response.json();
      const pair = data.pairs?.[0];
      
      if (pair && pair.priceUsd) {
        const price = parseFloat(pair.priceUsd);
        const callAge = now - call.timestamp;
        
        updateKOLCallPrice(
          callId,
          price,
          callAge >= oneDay && call.price24h === 0,
          callAge >= sevenDays && call.price7d === 0
        );
      }
    } catch (error) {
      // Ignore price fetch errors
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Calculate reliability score for a KOL
 */
function calculateReliabilityScore(stats: Partial<KOLStats>): number {
  // Components:
  // - Win rate (40%)
  // - Avg ROI positive (20%)
  // - Consistency/sample size (15%)
  // - Recent trend (15%)
  // - Pump & dump penalty (10%)
  
  let score = 0;
  
  // Win rate contribution (0-40 points)
  const winRateScore = Math.min((stats.winRate || 0) * 0.4, 40);
  score += winRateScore;
  
  // Avg ROI contribution (0-20 points)
  const avgRoi = stats.avgRoi || 0;
  const roiScore = avgRoi > 0 
    ? Math.min(avgRoi / 5, 20)  // Cap at 100% avg ROI = 20 points
    : Math.max(avgRoi / 10, -10); // Penalty for negative
  score += roiScore;
  
  // Sample size contribution (0-15 points)
  const sampleSize = stats.totalCalls || 0;
  const sampleScore = Math.min(Math.sqrt(sampleSize) * 3, 15);
  score += sampleScore;
  
  // Trend contribution (0-15 points)
  const trendScore = stats.reliabilityTrend === 'IMPROVING' ? 15 
    : stats.reliabilityTrend === 'STABLE' ? 10 
    : 0;
  score += trendScore;
  
  // Pump & dump penalty (0 to -10 points)
  const pumpDumpPenalty = ((stats.pumpAndDumpScore || 0) / 100) * 10;
  score -= pumpDumpPenalty;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate pump & dump score
 * High score = suspicious pattern of quick pumps then dumps
 */
function calculatePumpAndDumpScore(calls: KOLCall[]): number {
  if (calls.length < 5) return 0;
  
  let suspiciousCount = 0;
  
  for (const call of calls) {
    // Pattern: ATH reached quickly, then crashed
    const timeToAth = call.athTimestamp - call.timestamp;
    const hoursToAth = timeToAth / (1000 * 60 * 60);
    
    // If ATH was < 2 hours and current price is way below ATH
    if (hoursToAth < 2 && call.roiAth > 50 && call.roiCurrent < 0) {
      suspiciousCount++;
    }
    
    // Or if the difference between ATH and current is huge
    if (call.roiAth - call.roiCurrent > 80) {
      suspiciousCount++;
    }
  }
  
  return Math.min(100, (suspiciousCount / calls.length) * 100);
}

/**
 * Determine badges for a KOL
 */
function determineBadges(stats: KOLStats, calls: KOLCall[]): KOLBadge[] {
  const badges: KOLBadge[] = [];
  
  // Veteran (50+ calls)
  if (stats.totalCalls >= 50) {
    badges.push('🎖️ Veteran');
  }
  
  // Top Caller (this is set externally based on leaderboard position)
  
  // Accurate (win rate > 60%)
  if (stats.winRate >= 60 && stats.totalCalls >= 10) {
    badges.push('🎯 Accurate');
  }
  
  // Unreliable (win rate < 40%)
  if (stats.winRate < 40 && stats.totalCalls >= 10) {
    badges.push('⚠️ Unreliable');
  }
  
  // Pump & Dump
  if (stats.isPumpAndDump) {
    badges.push('🗑️ Pump & Dump');
  }
  
  // Moon Maker (avg ATH ROI > 100%)
  if (stats.avgAthRoi >= 100 && stats.totalCalls >= 5) {
    badges.push('🚀 Moon Maker');
  }
  
  // Diamond Hands (avg hold time > 4 hours to ATH)
  if (stats.avgHoldTime > 240) {
    badges.push('💎 Diamond Hands');
  }
  
  // Declining
  if (stats.reliabilityTrend === 'DECLINING') {
    badges.push('📉 Declining');
  }
  
  // Rising Star (new but good, < 20 calls, > 50% win rate)
  if (stats.totalCalls < 20 && stats.totalCalls >= 5 && stats.winRate > 50) {
    badges.push('🌟 Rising Star');
  }
  
  // Hot/Cold Streak - check last 5 calls
  const recentCalls = calls
    .filter(c => c.status !== 'OPEN')
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
  
  if (recentCalls.length >= 5) {
    const allWins = recentCalls.every(c => c.status === 'WIN');
    const allLosses = recentCalls.every(c => c.status === 'LOSS');
    
    if (allWins) badges.push('🔥 Hot Streak');
    if (allLosses) badges.push('❄️ Cold Streak');
  }
  
  return badges;
}

/**
 * Get stats for a specific KOL
 */
export function getKOLStats(handle: string): KOLStats | null {
  const normalizedHandle = handle.toLowerCase();
  const callIds = kolIndex.get(normalizedHandle);
  
  if (!callIds || callIds.size === 0) return null;
  
  const calls: KOLCall[] = [];
  for (const callId of callIds) {
    const call = kolCalls.get(callId);
    if (call) calls.push(call);
  }
  
  if (calls.length === 0) return null;
  
  // Sort by timestamp
  calls.sort((a, b) => a.timestamp - b.timestamp);
  
  // Calculate stats
  const closedCalls = calls.filter(c => c.status === 'WIN' || c.status === 'LOSS');
  const wins = calls.filter(c => c.status === 'WIN');
  const losses = calls.filter(c => c.status === 'LOSS');
  const pending = calls.filter(c => c.status === 'OPEN');
  
  const winRate = closedCalls.length > 0 
    ? (wins.length / closedCalls.length) * 100 
    : 0;
  
  const avgRoi = closedCalls.length > 0
    ? closedCalls.reduce((sum, c) => sum + c.roiCurrent, 0) / closedCalls.length
    : 0;
  
  const avgAthRoi = calls.length > 0
    ? calls.reduce((sum, c) => sum + c.roiAth, 0) / calls.length
    : 0;
  
  const totalRoi = closedCalls.reduce((sum, c) => sum + c.roiCurrent, 0);
  
  const avgRoi24h = calls.filter(c => c.roi24h !== 0).length > 0
    ? calls.filter(c => c.roi24h !== 0).reduce((sum, c) => sum + c.roi24h, 0) / 
      calls.filter(c => c.roi24h !== 0).length
    : 0;
  
  const avgRoi7d = calls.filter(c => c.roi7d !== 0).length > 0
    ? calls.filter(c => c.roi7d !== 0).reduce((sum, c) => sum + c.roi7d, 0) /
      calls.filter(c => c.roi7d !== 0).length
    : 0;
  
  // Average time to ATH in minutes
  const avgHoldTime = calls.length > 0
    ? calls.reduce((sum, c) => sum + (c.athTimestamp - c.timestamp), 0) / 
      calls.length / (1000 * 60)
    : 0;
  
  // Calculate trend from recent vs older calls
  const recentCalls = calls.slice(-10);
  const olderCalls = calls.slice(-20, -10);
  
  let reliabilityTrend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
  if (recentCalls.length >= 5 && olderCalls.length >= 5) {
    const recentWinRate = recentCalls.filter(c => c.status === 'WIN').length / 
      recentCalls.filter(c => c.status !== 'OPEN').length || 0;
    const olderWinRate = olderCalls.filter(c => c.status === 'WIN').length /
      olderCalls.filter(c => c.status !== 'OPEN').length || 0;
    
    if (recentWinRate - olderWinRate > 0.1) reliabilityTrend = 'IMPROVING';
    else if (olderWinRate - recentWinRate > 0.1) reliabilityTrend = 'DECLINING';
  }
  
  // Find best/worst
  let bestCall: KOLStats['bestCall'] = null;
  let worstCall: KOLStats['worstCall'] = null;
  
  for (const call of closedCalls) {
    if (!bestCall || call.roiAth > bestCall.roi) {
      bestCall = {
        symbol: call.symbol,
        token: call.token,
        roi: call.roiAth,
        timestamp: call.timestamp
      };
    }
    if (!worstCall || call.roiCurrent < worstCall.roi) {
      worstCall = {
        symbol: call.symbol,
        token: call.token,
        roi: call.roiCurrent,
        timestamp: call.timestamp
      };
    }
  }
  
  // Calculate pump & dump score
  const pumpAndDumpScore = calculatePumpAndDumpScore(calls);
  const isPumpAndDump = pumpAndDumpScore >= 60;
  
  // Get first call info for tier/label
  const firstCall = calls[0];
  
  const stats: KOLStats = {
    handle: normalizedHandle,
    label: firstCall.kolLabel,
    tier: firstCall.kolTier,
    totalCalls: calls.length,
    wins: wins.length,
    losses: losses.length,
    pending: pending.length,
    winRate,
    avgRoi,
    avgAthRoi,
    totalRoi,
    avgRoi24h,
    avgRoi7d,
    reliabilityScore: 0, // Calculated below
    reliabilityTrend,
    pumpAndDumpScore,
    isPumpAndDump,
    avgHoldTime,
    bestCall,
    worstCall,
    firstSeen: firstCall.timestamp,
    lastSeen: calls[calls.length - 1].timestamp,
    badges: []
  };
  
  // Calculate reliability score
  stats.reliabilityScore = calculateReliabilityScore(stats);
  
  // Determine badges
  stats.badges = determineBadges(stats, calls);
  
  return stats;
}

/**
 * Get call history for a KOL
 */
export function getKOLHistory(handle: string, limit: number = 50): KOLCall[] {
  const normalizedHandle = handle.toLowerCase();
  const callIds = kolIndex.get(normalizedHandle);
  
  if (!callIds) return [];
  
  const calls: KOLCall[] = [];
  for (const callId of callIds) {
    const call = kolCalls.get(callId);
    if (call) calls.push(call);
  }
  
  // Sort by timestamp descending (newest first)
  return calls.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

/**
 * Get all KOL handles
 */
export function getAllKOLHandles(): string[] {
  return Array.from(kolIndex.keys());
}

/**
 * Get KOL leaderboard
 */
export function getKOLLeaderboard(limit: number = 20): KOLLeaderboard {
  const allHandles = getAllKOLHandles();
  const allStats: KOLStats[] = [];
  
  for (const handle of allHandles) {
    const stats = getKOLStats(handle);
    if (stats && stats.totalCalls >= 3) {
      allStats.push(stats);
    }
  }
  
  // Top reliable (by reliability score)
  const topReliable = [...allStats]
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore)
    .slice(0, limit);
  
  // Mark top 5 with badge
  topReliable.slice(0, 5).forEach(s => {
    if (!s.badges.includes('👑 Top Caller')) {
      s.badges.unshift('👑 Top Caller');
    }
  });
  
  // Unreliable (low reliability, min 10 calls)
  const unreliable = [...allStats]
    .filter(s => s.totalCalls >= 10 && s.reliabilityScore < 40)
    .sort((a, b) => a.reliabilityScore - b.reliabilityScore)
    .slice(0, limit);
  
  // Rising stars (new but promising)
  const risingStars = [...allStats]
    .filter(s => s.totalCalls < 20 && s.totalCalls >= 5 && s.winRate > 50)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, limit);
  
  // Most active
  const mostActive = [...allStats]
    .sort((a, b) => b.totalCalls - a.totalCalls)
    .slice(0, limit);
  
  // Pump & dump KOLs
  const pumpAndDump = [...allStats]
    .filter(s => s.pumpAndDumpScore >= 50)
    .sort((a, b) => b.pumpAndDumpScore - a.pumpAndDumpScore)
    .slice(0, limit);
  
  return {
    topReliable,
    unreliable,
    risingStars,
    mostActive,
    pumpAndDump
  };
}

/**
 * Get reliability score for a KOL (for signal weighting)
 */
export function getKOLReliabilityScore(handle: string): number {
  const stats = getKOLStats(handle.toLowerCase());
  return stats?.reliabilityScore ?? 50; // Default to 50 if unknown
}

/**
 * Get signal weight modifier based on KOL reliability
 * Returns a multiplier (0.5 to 1.5)
 */
export function getKOLSignalWeight(handle: string): number {
  const score = getKOLReliabilityScore(handle);
  
  // Convert 0-100 score to 0.5-1.5 multiplier
  // Score 50 = 1.0 (neutral)
  // Score 100 = 1.5 (boost)
  // Score 0 = 0.5 (reduce)
  return 0.5 + (score / 100);
}

/**
 * Check if KOL should be ignored (pump & dump or very unreliable)
 */
export function shouldIgnoreKOL(handle: string): boolean {
  const stats = getKOLStats(handle.toLowerCase());
  if (!stats) return false;
  
  // Ignore if flagged as pump & dump with enough calls
  if (stats.isPumpAndDump && stats.totalCalls >= 10) return true;
  
  // Ignore if very unreliable with enough sample size
  if (stats.reliabilityScore < 20 && stats.totalCalls >= 20) return true;
  
  return false;
}

// ===== DEMO DATA =====

/**
 * Generate demo KOL data for testing
 */
export function generateDemoKOLData(): void {
  const demoKOLs = [
    { handle: 'ansem', label: 'Ansem', tier: 'S' as const, winRate: 68, avgRoi: 145 },
    { handle: 'blknoiz06', label: 'BLKNOIZ', tier: 'S' as const, winRate: 65, avgRoi: 120 },
    { handle: 'degenspartan', label: 'DegenSpartan', tier: 'S' as const, winRate: 62, avgRoi: 98 },
    { handle: 'muststopmurad', label: 'Murad', tier: 'S' as const, winRate: 64, avgRoi: 135 },
    { handle: 'loomdart', label: 'Loomdart', tier: 'S' as const, winRate: 60, avgRoi: 88 },
    { handle: 'cryptokaleo', label: 'Kaleo', tier: 'A' as const, winRate: 55, avgRoi: 65 },
    { handle: 'soltrader', label: 'SOL Trader', tier: 'A' as const, winRate: 54, avgRoi: 58 },
    { handle: 'jupiterexchange', label: 'Jupiter', tier: 'A' as const, winRate: 56, avgRoi: 72 },
    { handle: 'hsakatrades', label: 'Hsaka', tier: 'B' as const, winRate: 45, avgRoi: 32 },
    { handle: 'crypto_bitlord', label: 'BitLord', tier: 'B' as const, winRate: 42, avgRoi: 18 },
    { handle: 'pumpdumper99', label: 'PumpDumper', tier: 'UNKNOWN' as const, winRate: 35, avgRoi: -15 },
    { handle: 'shadycaller', label: 'ShadyCaller', tier: 'UNKNOWN' as const, winRate: 28, avgRoi: -25 },
  ];
  
  const demoTokens = [
    { token: 'Demo1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'TRUMP' },
    { token: 'Demo2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'GROK' },
    { token: 'Demo3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'BONKAI' },
    { token: 'Demo4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'NEURAL' },
    { token: 'Demo5xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'AGENTX' },
    { token: 'Demo6xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'MOONBOT' },
    { token: 'Demo7xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'CATGPT' },
    { token: 'Demo8xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'SOLAI' },
  ];
  
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (const kol of demoKOLs) {
    // Generate 15-40 calls per KOL over the last 30 days
    const numCalls = 15 + Math.floor(Math.random() * 25);
    
    for (let i = 0; i < numCalls; i++) {
      const token = demoTokens[Math.floor(Math.random() * demoTokens.length)];
      const timestamp = now - Math.floor(Math.random() * 30 * dayMs);
      const callId = `${kol.handle}-${token.token}-${timestamp}`;
      
      // Determine outcome based on KOL's win rate
      const isWin = Math.random() * 100 < kol.winRate;
      const isPumpDump = kol.handle.includes('pump') || kol.handle.includes('shady');
      
      const priceAtMention = 0.0001 + Math.random() * 0.01;
      let athPrice: number;
      let currentPrice: number;
      let status: 'OPEN' | 'WIN' | 'LOSS' | 'EXPIRED';
      
      if (isWin) {
        athPrice = priceAtMention * (1.5 + Math.random() * 3);
        currentPrice = isPumpDump 
          ? priceAtMention * (0.3 + Math.random() * 0.4) // Crashed after pump
          : priceAtMention * (1 + Math.random() * 2);
        status = 'WIN';
      } else {
        athPrice = priceAtMention * (1 + Math.random() * 0.5);
        currentPrice = priceAtMention * (0.3 + Math.random() * 0.4);
        status = 'LOSS';
      }
      
      // Some recent calls are still open
      if (timestamp > now - 2 * dayMs && Math.random() < 0.3) {
        status = 'OPEN';
        currentPrice = priceAtMention * (0.8 + Math.random() * 0.6);
      }
      
      const call: KOLCall = {
        id: callId,
        kolHandle: kol.handle,
        kolLabel: kol.label,
        kolTier: kol.tier,
        token: token.token,
        symbol: token.symbol,
        timestamp,
        priceAtMention,
        mcapAtMention: priceAtMention * 1e9,
        athPrice,
        athTimestamp: timestamp + (isPumpDump ? 30 * 60 * 1000 : 4 * 60 * 60 * 1000),
        price24h: currentPrice,
        price7d: currentPrice,
        currentPrice,
        lastPriceUpdate: now,
        roiCurrent: ((currentPrice - priceAtMention) / priceAtMention) * 100,
        roiAth: ((athPrice - priceAtMention) / priceAtMention) * 100,
        roi24h: ((currentPrice - priceAtMention) / priceAtMention) * 100,
        roi7d: ((currentPrice - priceAtMention) / priceAtMention) * 100,
        status,
        profitableEntry: athPrice > priceAtMention * 1.2,
        tweetId: `tweet_${callId}`,
        tweetText: `Just aped into $${token.symbol} 🚀 This looks like a gem!`
      };
      
      kolCalls.set(callId, call);
      
      if (!kolIndex.has(kol.handle)) {
        kolIndex.set(kol.handle, new Set());
      }
      kolIndex.get(kol.handle)!.add(callId);
    }
  }
  
  console.log(`[KOL-RELIABILITY] Generated demo data for ${demoKOLs.length} KOLs`);
}

// Initialize demo data if in demo mode
if (DEMO_MODE) {
  generateDemoKOLData();
}

// ===== EXPORTS =====

export {
  kolCalls,
  kolIndex
};
