/**
 * Leaderboard System
 * Track and rank signal performance over time
 * Supports multiple timeframes and ranking criteria
 */

import { AggregatedSignal, SignalSource } from '../types';

// === TYPES ===

export type Timeframe = '24h' | '7d' | '30d' | 'all';

export interface SignalLeaderboardEntry {
  rank: number;
  signalId: string;
  symbol: string;
  token: string;
  name: string;
  score: number;
  entryPrice: number;
  currentPrice: number;
  athPrice: number;
  roi: number;
  athRoi: number;
  status: 'OPEN' | 'WIN' | 'LOSS';
  riskLevel: string;
  sources: string[];
  timestamp: number;
  age: string;
  badges: Badge[];
  isHotStreak?: boolean;
  isTopPick?: boolean;
}

export interface SourceLeaderboardEntry {
  rank: number;
  source: SignalSource;
  displayName: string;
  totalSignals: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  avgRoi: number;
  totalRoi: number;
  avgScore: number;
  bestSignal: {
    symbol: string;
    roi: number;
    timestamp: number;
  } | null;
  streak: number;
  trend: 'up' | 'down' | 'stable';
  badges: Badge[];
}

export interface Badge {
  type: BadgeType;
  label: string;
  icon: string;
  description: string;
  earnedAt?: number;
}

export type BadgeType = 
  | 'top_performer'      // 🏆 Top 3 by ROI
  | 'hot_streak'         // 🔥 3+ consecutive wins
  | 'ultra_streak'       // 💎 5+ consecutive wins
  | 'safe_bet'           // 🛡️ High win rate, low risk
  | 'moon_shot'          // 🌙 100%+ ROI
  | 'rocket'             // 🚀 200%+ ROI
  | 'diamond_hands'      // 💎 500%+ ROI
  | 'first_pick'         // ⭐ Highest score of the day
  | 'reliable'           // ✅ 10+ wins, 60%+ win rate
  | 'volume_king'        // 👑 Most signals
  | 'accuracy_king'      // 🎯 Highest win rate
  | 'roi_king';          // 💰 Highest average ROI

export interface StreakRecord {
  source: SignalSource;
  currentStreak: number;
  maxStreak: number;
  lastWin: boolean;
  streakSignals: string[];
}

export interface LeaderboardStats {
  totalSignals: number;
  totalTracked: number;
  totalWins: number;
  totalLosses: number;
  overallWinRate: number;
  avgRoi: number;
  bestSignal: SignalLeaderboardEntry | null;
  worstSignal: SignalLeaderboardEntry | null;
  hotStreaks: number;
  topPerformers: number;
  timeframe: Timeframe;
  generatedAt: number;
}

export interface RiskRewardEntry {
  rank: number;
  signalId: string;
  symbol: string;
  token: string;
  score: number;
  riskLevel: string;
  roi: number;
  athRoi: number;
  riskRewardRatio: number;
  safetyScore?: number;
  status: 'OPEN' | 'WIN' | 'LOSS';
  timestamp: number;
}

// === DATA STORES ===

// In-memory storage for performance tracking (would be DB in production)
interface TrackedPerformance {
  signalId: string;
  symbol: string;
  token: string;
  name: string;
  score: number;
  riskLevel: string;
  sources: SignalSource[];
  safetyScore?: number;
  entryPrice: number;
  currentPrice: number;
  athPrice: number;
  athTimestamp: number;
  roi: number;
  athRoi: number;
  status: 'OPEN' | 'WIN' | 'LOSS';
  timestamp: number;
  lastUpdate: number;
}

const performanceData = new Map<string, TrackedPerformance>();
const sourceStreaks = new Map<SignalSource, StreakRecord>();

// === HELPER FUNCTIONS ===

function getSourceDisplayName(source: SignalSource): string {
  const names: Record<SignalSource, string> = {
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
  return names[source] || source;
}

function formatAge(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getTimeframeCutoff(timeframe: Timeframe): number {
  const now = Date.now();
  switch (timeframe) {
    case '24h': return now - 24 * 60 * 60 * 1000;
    case '7d': return now - 7 * 24 * 60 * 60 * 1000;
    case '30d': return now - 30 * 24 * 60 * 60 * 1000;
    case 'all': return 0;
  }
}

function calculateBadges(entry: TrackedPerformance, rank: number, isStreak: boolean): Badge[] {
  const badges: Badge[] = [];
  
  // Ranking badges
  if (rank === 1) {
    badges.push({
      type: 'top_performer',
      label: '#1',
      icon: '🏆',
      description: 'Top performer by ROI'
    });
  } else if (rank === 2) {
    badges.push({
      type: 'top_performer',
      label: '#2',
      icon: '🥈',
      description: 'Second best performer'
    });
  } else if (rank === 3) {
    badges.push({
      type: 'top_performer',
      label: '#3',
      icon: '🥉',
      description: 'Third best performer'
    });
  }
  
  // ROI badges
  if (entry.roi >= 500 || entry.athRoi >= 500) {
    badges.push({
      type: 'diamond_hands',
      label: '5x+',
      icon: '💎',
      description: '500%+ ROI - Diamond hands territory'
    });
  } else if (entry.roi >= 200 || entry.athRoi >= 200) {
    badges.push({
      type: 'rocket',
      label: '3x+',
      icon: '🚀',
      description: '200%+ ROI - Rocket launch'
    });
  } else if (entry.roi >= 100 || entry.athRoi >= 100) {
    badges.push({
      type: 'moon_shot',
      label: '2x+',
      icon: '🌙',
      description: '100%+ ROI - Moon shot'
    });
  }
  
  // Streak badges
  if (isStreak) {
    badges.push({
      type: 'hot_streak',
      label: 'Streak',
      icon: '🔥',
      description: 'Part of a winning streak'
    });
  }
  
  // Safe bet badge
  if (entry.riskLevel === 'LOW' && entry.roi > 0 && entry.score >= 75) {
    badges.push({
      type: 'safe_bet',
      label: 'Safe',
      icon: '🛡️',
      description: 'Low risk, high score, positive return'
    });
  }
  
  return badges;
}

function calculateSourceBadges(entry: {
  winRate: number;
  totalSignals: number;
  wins: number;
  avgRoi: number;
  streak: number;
}, allSources: SourceLeaderboardEntry[]): Badge[] {
  const badges: Badge[] = [];
  
  // Volume king
  const maxSignals = Math.max(...allSources.map(s => s.totalSignals));
  if (entry.totalSignals === maxSignals && entry.totalSignals > 0) {
    badges.push({
      type: 'volume_king',
      label: 'Most Signals',
      icon: '👑',
      description: 'Most signals generated'
    });
  }
  
  // Accuracy king
  const maxWinRate = Math.max(...allSources.filter(s => s.wins + s.losses >= 5).map(s => s.winRate));
  if (entry.winRate === maxWinRate && entry.winRate > 0 && entry.wins >= 5) {
    badges.push({
      type: 'accuracy_king',
      label: 'Best Accuracy',
      icon: '🎯',
      description: 'Highest win rate'
    });
  }
  
  // ROI king
  const maxAvgRoi = Math.max(...allSources.filter(s => s.wins + s.losses >= 5).map(s => s.avgRoi));
  if (entry.avgRoi === maxAvgRoi && entry.avgRoi > 0 && entry.wins >= 5) {
    badges.push({
      type: 'roi_king',
      label: 'Best ROI',
      icon: '💰',
      description: 'Highest average ROI'
    });
  }
  
  // Reliable badge
  if (entry.wins >= 10 && entry.winRate >= 60) {
    badges.push({
      type: 'reliable',
      label: 'Reliable',
      icon: '✅',
      description: '10+ wins with 60%+ win rate'
    });
  }
  
  // Streak badges
  if (entry.streak >= 5) {
    badges.push({
      type: 'ultra_streak',
      label: `${entry.streak}🔥`,
      icon: '💎',
      description: `${entry.streak} consecutive wins - Ultra streak!`
    });
  } else if (entry.streak >= 3) {
    badges.push({
      type: 'hot_streak',
      label: `${entry.streak}🔥`,
      icon: '🔥',
      description: `${entry.streak} consecutive wins - Hot streak!`
    });
  }
  
  return badges;
}

// === TRACKING FUNCTIONS ===

/**
 * Track a signal for leaderboard
 */
export function trackForLeaderboard(signal: AggregatedSignal, priceData: {
  entryPrice: number;
  currentPrice?: number;
}): void {
  const tracked: TrackedPerformance = {
    signalId: signal.id,
    symbol: signal.symbol,
    token: signal.token,
    name: signal.name,
    score: signal.score,
    riskLevel: signal.riskLevel,
    sources: signal.sources.map(s => s.source),
    safetyScore: signal.safety?.safetyScore,
    entryPrice: priceData.entryPrice,
    currentPrice: priceData.currentPrice || priceData.entryPrice,
    athPrice: priceData.currentPrice || priceData.entryPrice,
    athTimestamp: Date.now(),
    roi: 0,
    athRoi: 0,
    status: 'OPEN',
    timestamp: signal.timestamp,
    lastUpdate: Date.now()
  };
  
  performanceData.set(signal.id, tracked);
}

/**
 * Update price for a tracked signal
 */
export function updateLeaderboardPrice(signalId: string, currentPrice: number): void {
  const tracked = performanceData.get(signalId);
  if (!tracked || tracked.entryPrice <= 0) return;
  
  tracked.currentPrice = currentPrice;
  tracked.lastUpdate = Date.now();
  
  // Calculate ROI
  tracked.roi = ((currentPrice - tracked.entryPrice) / tracked.entryPrice) * 100;
  
  // Update ATH
  if (currentPrice > tracked.athPrice) {
    tracked.athPrice = currentPrice;
    tracked.athTimestamp = Date.now();
    tracked.athRoi = tracked.roi;
  }
  
  // Update status
  if (tracked.roi >= 100) {
    tracked.status = 'WIN';
    updateSourceStreak(tracked.sources, true, signalId);
  } else if (tracked.roi <= -50) {
    tracked.status = 'LOSS';
    updateSourceStreak(tracked.sources, false, signalId);
  }
}

/**
 * Update streak tracking for sources
 */
function updateSourceStreak(sources: SignalSource[], isWin: boolean, signalId: string): void {
  for (const source of sources) {
    let streak = sourceStreaks.get(source);
    
    if (!streak) {
      streak = {
        source,
        currentStreak: 0,
        maxStreak: 0,
        lastWin: false,
        streakSignals: []
      };
    }
    
    if (isWin) {
      if (streak.lastWin) {
        streak.currentStreak++;
        streak.streakSignals.push(signalId);
      } else {
        streak.currentStreak = 1;
        streak.streakSignals = [signalId];
      }
      streak.lastWin = true;
      
      if (streak.currentStreak > streak.maxStreak) {
        streak.maxStreak = streak.currentStreak;
      }
    } else {
      streak.currentStreak = 0;
      streak.lastWin = false;
      streak.streakSignals = [];
    }
    
    sourceStreaks.set(source, streak);
  }
}

/**
 * Sync leaderboard with existing tracked signals
 */
export function syncFromTrackedSignals(trackedSignals: Array<{
  id: string;
  token: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  athPrice: number;
  athTimestamp: number;
  roi: number;
  athRoi: number;
  status: string;
  entryTimestamp: number;
}>, signalStore: AggregatedSignal[]): void {
  for (const tracked of trackedSignals) {
    const signal = signalStore.find(s => s.id === tracked.id);
    if (!signal) continue;
    
    const perf: TrackedPerformance = {
      signalId: tracked.id,
      symbol: tracked.symbol,
      token: tracked.token,
      name: signal.name,
      score: signal.score,
      riskLevel: signal.riskLevel,
      sources: signal.sources.map(s => s.source),
      safetyScore: signal.safety?.safetyScore,
      entryPrice: tracked.entryPrice,
      currentPrice: tracked.currentPrice,
      athPrice: tracked.athPrice,
      athTimestamp: tracked.athTimestamp,
      roi: tracked.roi,
      athRoi: tracked.athRoi,
      status: tracked.status as 'OPEN' | 'WIN' | 'LOSS',
      timestamp: tracked.entryTimestamp,
      lastUpdate: Date.now()
    };
    
    performanceData.set(tracked.id, perf);
  }
}

// === LEADERBOARD GENERATION ===

/**
 * Get top signals leaderboard
 */
export function getSignalsLeaderboard(
  timeframe: Timeframe = '24h',
  limit: number = 10,
  sortBy: 'roi' | 'athRoi' | 'score' = 'roi'
): SignalLeaderboardEntry[] {
  const cutoff = getTimeframeCutoff(timeframe);
  
  // Filter by timeframe
  const filtered = Array.from(performanceData.values())
    .filter(p => p.timestamp >= cutoff && p.currentPrice > 0);
  
  // Sort
  const sorted = filtered.sort((a, b) => {
    switch (sortBy) {
      case 'roi': return b.roi - a.roi;
      case 'athRoi': return b.athRoi - a.athRoi;
      case 'score': return b.score - a.score;
      default: return b.roi - a.roi;
    }
  });
  
  // Get streak signal IDs for badge calculation
  const streakSignalIds = new Set<string>();
  sourceStreaks.forEach(streak => {
    streak.streakSignals.forEach(id => streakSignalIds.add(id));
  });
  
  // Map to leaderboard entries
  return sorted.slice(0, limit).map((p, idx) => ({
    rank: idx + 1,
    signalId: p.signalId,
    symbol: p.symbol,
    token: p.token,
    name: p.name,
    score: p.score,
    entryPrice: p.entryPrice,
    currentPrice: p.currentPrice,
    athPrice: p.athPrice,
    roi: Math.round(p.roi * 100) / 100,
    athRoi: Math.round(p.athRoi * 100) / 100,
    status: p.status,
    riskLevel: p.riskLevel,
    sources: p.sources,
    timestamp: p.timestamp,
    age: formatAge(p.timestamp),
    badges: calculateBadges(p, idx + 1, streakSignalIds.has(p.signalId)),
    isHotStreak: streakSignalIds.has(p.signalId),
    isTopPick: p.score >= 80 && idx < 3
  }));
}

/**
 * Get source performance leaderboard
 */
export function getSourcesLeaderboard(
  timeframe: Timeframe = '7d',
  sortBy: 'winRate' | 'avgRoi' | 'totalSignals' = 'winRate'
): SourceLeaderboardEntry[] {
  const cutoff = getTimeframeCutoff(timeframe);
  
  // Aggregate by source
  const sourceData = new Map<SignalSource, {
    signals: TrackedPerformance[];
    wins: number;
    losses: number;
    totalRoi: number;
    totalScore: number;
    bestSignal: { symbol: string; roi: number; timestamp: number } | null;
  }>();
  
  for (const p of performanceData.values()) {
    if (p.timestamp < cutoff) continue;
    
    for (const source of p.sources) {
      let data = sourceData.get(source);
      if (!data) {
        data = {
          signals: [],
          wins: 0,
          losses: 0,
          totalRoi: 0,
          totalScore: 0,
          bestSignal: null
        };
      }
      
      data.signals.push(p);
      data.totalScore += p.score;
      
      if (p.status === 'WIN') {
        data.wins++;
        data.totalRoi += p.roi;
      } else if (p.status === 'LOSS') {
        data.losses++;
        data.totalRoi += p.roi;
      }
      
      if (!data.bestSignal || p.athRoi > data.bestSignal.roi) {
        data.bestSignal = {
          symbol: p.symbol,
          roi: p.athRoi,
          timestamp: p.timestamp
        };
      }
      
      sourceData.set(source, data);
    }
  }
  
  // Convert to entries
  const entries: SourceLeaderboardEntry[] = Array.from(sourceData.entries()).map(([source, data]) => {
    const closed = data.wins + data.losses;
    const pending = data.signals.length - closed;
    const winRate = closed > 0 ? (data.wins / closed) * 100 : 0;
    const avgRoi = closed > 0 ? data.totalRoi / closed : 0;
    const avgScore = data.signals.length > 0 ? data.totalScore / data.signals.length : 0;
    
    // Get streak
    const streak = sourceStreaks.get(source);
    const currentStreak = streak?.currentStreak || 0;
    
    // Calculate trend
    const recentSignals = data.signals
      .filter(s => s.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000);
    const olderSignals = data.signals
      .filter(s => s.timestamp <= Date.now() - 7 * 24 * 60 * 60 * 1000 &&
                   s.timestamp > Date.now() - 14 * 24 * 60 * 60 * 1000);
    
    const recentWinRate = recentSignals.filter(s => s.status === 'WIN').length / 
      (recentSignals.filter(s => s.status !== 'OPEN').length || 1);
    const olderWinRate = olderSignals.filter(s => s.status === 'WIN').length /
      (olderSignals.filter(s => s.status !== 'OPEN').length || 1);
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (recentWinRate - olderWinRate > 0.1) trend = 'up';
    else if (olderWinRate - recentWinRate > 0.1) trend = 'down';
    
    return {
      rank: 0, // Will be set after sorting
      source,
      displayName: getSourceDisplayName(source),
      totalSignals: data.signals.length,
      wins: data.wins,
      losses: data.losses,
      pending,
      winRate: Math.round(winRate * 10) / 10,
      avgRoi: Math.round(avgRoi * 10) / 10,
      totalRoi: Math.round(data.totalRoi * 10) / 10,
      avgScore: Math.round(avgScore * 10) / 10,
      bestSignal: data.bestSignal,
      streak: currentStreak,
      trend,
      badges: [] // Will be calculated after sorting
    };
  });
  
  // Sort
  entries.sort((a, b) => {
    switch (sortBy) {
      case 'winRate': 
        // Require minimum samples for win rate sorting
        const aValid = a.wins + a.losses >= 5;
        const bValid = b.wins + b.losses >= 5;
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        return b.winRate - a.winRate;
      case 'avgRoi': return b.avgRoi - a.avgRoi;
      case 'totalSignals': return b.totalSignals - a.totalSignals;
      default: return b.winRate - a.winRate;
    }
  });
  
  // Assign ranks and badges
  return entries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
    badges: calculateSourceBadges(entry, entries)
  }));
}

/**
 * Get risk/reward leaderboard (best risk-adjusted returns)
 */
export function getRiskRewardLeaderboard(
  timeframe: Timeframe = '7d',
  limit: number = 10
): RiskRewardEntry[] {
  const cutoff = getTimeframeCutoff(timeframe);
  
  const filtered = Array.from(performanceData.values())
    .filter(p => p.timestamp >= cutoff && p.currentPrice > 0);
  
  // Calculate risk/reward ratio
  // Higher score = lower risk, higher roi = higher reward
  const withRatio = filtered.map(p => {
    const riskFactor = p.riskLevel === 'LOW' ? 1 : 
                       p.riskLevel === 'MEDIUM' ? 0.7 : 
                       p.riskLevel === 'HIGH' ? 0.4 : 0.2;
    const safetyFactor = p.safetyScore ? p.safetyScore / 100 : 0.5;
    const scoreFactor = p.score / 100;
    
    // Risk/reward = (ROI * safety * score) / risk
    const riskRewardRatio = p.roi > 0 
      ? (p.roi * safetyFactor * scoreFactor) / (1 - riskFactor + 0.1)
      : p.roi * (2 - riskFactor); // Penalize losses more for high risk
    
    return { ...p, riskRewardRatio };
  });
  
  // Sort by risk/reward ratio
  const sorted = withRatio.sort((a, b) => b.riskRewardRatio - a.riskRewardRatio);
  
  return sorted.slice(0, limit).map((p, idx) => ({
    rank: idx + 1,
    signalId: p.signalId,
    symbol: p.symbol,
    token: p.token,
    score: p.score,
    riskLevel: p.riskLevel,
    roi: Math.round(p.roi * 100) / 100,
    athRoi: Math.round(p.athRoi * 100) / 100,
    riskRewardRatio: Math.round(p.riskRewardRatio * 100) / 100,
    safetyScore: p.safetyScore,
    status: p.status,
    timestamp: p.timestamp
  }));
}

/**
 * Get streak leaders
 */
export function getStreakLeaders(limit: number = 10): Array<{
  rank: number;
  source: SignalSource;
  displayName: string;
  currentStreak: number;
  maxStreak: number;
  isActive: boolean;
  recentSignals: string[];
}> {
  const entries = Array.from(sourceStreaks.entries())
    .filter(([, streak]) => streak.maxStreak >= 2)
    .sort((a, b) => b[1].currentStreak - a[1].currentStreak || b[1].maxStreak - a[1].maxStreak)
    .slice(0, limit);
  
  return entries.map(([source, streak], idx) => ({
    rank: idx + 1,
    source,
    displayName: getSourceDisplayName(source),
    currentStreak: streak.currentStreak,
    maxStreak: streak.maxStreak,
    isActive: streak.currentStreak > 0,
    recentSignals: streak.streakSignals.slice(-5)
  }));
}

/**
 * Get leaderboard statistics
 */
export function getLeaderboardStats(timeframe: Timeframe = '7d'): LeaderboardStats {
  const cutoff = getTimeframeCutoff(timeframe);
  
  const filtered = Array.from(performanceData.values())
    .filter(p => p.timestamp >= cutoff);
  
  const wins = filtered.filter(p => p.status === 'WIN');
  const losses = filtered.filter(p => p.status === 'LOSS');
  const closed = [...wins, ...losses];
  
  const totalRoi = closed.reduce((sum, p) => sum + p.roi, 0);
  const avgRoi = closed.length > 0 ? totalRoi / closed.length : 0;
  
  const sorted = filtered.sort((a, b) => b.roi - a.roi);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  
  // Count hot streaks
  let hotStreaks = 0;
  sourceStreaks.forEach(streak => {
    if (streak.currentStreak >= 3) hotStreaks++;
  });
  
  // Count top performers (ROI > 100%)
  const topPerformers = filtered.filter(p => p.roi >= 100 || p.athRoi >= 100).length;
  
  return {
    totalSignals: filtered.length,
    totalTracked: performanceData.size,
    totalWins: wins.length,
    totalLosses: losses.length,
    overallWinRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 1000) / 10 : 0,
    avgRoi: Math.round(avgRoi * 100) / 100,
    bestSignal: best ? {
      rank: 1,
      signalId: best.signalId,
      symbol: best.symbol,
      token: best.token,
      name: best.name,
      score: best.score,
      entryPrice: best.entryPrice,
      currentPrice: best.currentPrice,
      athPrice: best.athPrice,
      roi: Math.round(best.roi * 100) / 100,
      athRoi: Math.round(best.athRoi * 100) / 100,
      status: best.status,
      riskLevel: best.riskLevel,
      sources: best.sources,
      timestamp: best.timestamp,
      age: formatAge(best.timestamp),
      badges: calculateBadges(best, 1, false)
    } : null,
    worstSignal: worst && worst.roi < 0 ? {
      rank: filtered.length,
      signalId: worst.signalId,
      symbol: worst.symbol,
      token: worst.token,
      name: worst.name,
      score: worst.score,
      entryPrice: worst.entryPrice,
      currentPrice: worst.currentPrice,
      athPrice: worst.athPrice,
      roi: Math.round(worst.roi * 100) / 100,
      athRoi: Math.round(worst.athRoi * 100) / 100,
      status: worst.status,
      riskLevel: worst.riskLevel,
      sources: worst.sources,
      timestamp: worst.timestamp,
      age: formatAge(worst.timestamp),
      badges: []
    } : null,
    hotStreaks,
    topPerformers,
    timeframe,
    generatedAt: Date.now()
  };
}

/**
 * Get all tracked performance data (for syncing)
 */
export function getPerformanceData(): TrackedPerformance[] {
  return Array.from(performanceData.values());
}

/**
 * Clear leaderboard data
 */
export function clearLeaderboard(): void {
  performanceData.clear();
  sourceStreaks.clear();
}

// === DEMO DATA GENERATION ===

/**
 * Generate demo leaderboard data for testing
 */
export function generateDemoLeaderboard(): void {
  const demoSignals = [
    { symbol: 'PEPE', roi: 342.5, score: 85, risk: 'MEDIUM' },
    { symbol: 'WIF', roi: 215.3, score: 82, risk: 'MEDIUM' },
    { symbol: 'BONK', roi: 156.7, score: 78, risk: 'LOW' },
    { symbol: 'POPCAT', roi: 128.4, score: 76, risk: 'MEDIUM' },
    { symbol: 'MOG', roi: 98.2, score: 74, risk: 'HIGH' },
    { symbol: 'BRETT', roi: 87.1, score: 72, risk: 'MEDIUM' },
    { symbol: 'ANDY', roi: 65.3, score: 70, risk: 'LOW' },
    { symbol: 'TURBO', roi: 45.8, score: 68, risk: 'MEDIUM' },
    { symbol: 'DOGE2', roi: -15.2, score: 62, risk: 'HIGH' },
    { symbol: 'SHIB2', roi: -32.5, score: 58, risk: 'EXTREME' }
  ];
  
  const sources: SignalSource[] = [
    'smart-wallet-elite',
    'volume-spike', 
    'kol-tracker',
    'whale-tracker',
    'narrative-new'
  ];
  
  demoSignals.forEach((s, idx) => {
    const id = `demo-${idx}-${Date.now()}`;
    const timestamp = Date.now() - (idx * 2 * 60 * 60 * 1000); // Spread over time
    const basePrice = Math.random() * 0.001 + 0.0001;
    
    const tracked: TrackedPerformance = {
      signalId: id,
      symbol: s.symbol,
      token: `${s.symbol}...demo`,
      name: `${s.symbol} Token`,
      score: s.score,
      riskLevel: s.risk,
      sources: sources.slice(0, Math.floor(Math.random() * 3) + 1),
      safetyScore: s.risk === 'LOW' ? 80 : s.risk === 'MEDIUM' ? 60 : 40,
      entryPrice: basePrice,
      currentPrice: basePrice * (1 + s.roi / 100),
      athPrice: basePrice * (1 + Math.max(s.roi, s.roi * 1.2) / 100),
      athTimestamp: timestamp + 3600000,
      roi: s.roi,
      athRoi: Math.max(s.roi, s.roi * 1.2),
      status: s.roi >= 100 ? 'WIN' : s.roi <= -50 ? 'LOSS' : 'OPEN',
      timestamp,
      lastUpdate: Date.now()
    };
    
    performanceData.set(id, tracked);
    
    // Update streaks for demo
    if (tracked.status === 'WIN') {
      updateSourceStreak(tracked.sources, true, id);
    }
  });
}
