/**
 * Oracle Alpha Learning System
 * Integrates with Panda Alpha results to improve scoring through feedback
 */

import * as fs from 'fs';
import * as path from 'path';

// ===== TYPES =====

export interface TradeResult {
  signalId: string;
  ca: string;
  source: string;
  entryMcap: number;
  resultMcap: number;
  resultMultiple: number;
  status: 'hit' | 'miss' | 'open';
  timestamp: number;
  resultTimestamp?: number;
}

export interface SourcePerformance {
  source: string;
  totalSignals: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  avgMultiple: number;
  recentWinRate: number; // EMA of recent performance
  baseWeight: number;
  adjustedWeight: number;
  trend: 'improving' | 'declining' | 'stable';
  lastUpdated: number;
}

export interface LearningState {
  sources: Record<string, SourcePerformance>;
  lastSync: number;
  totalResults: number;
  version: number;
}

// ===== CONSTANTS =====

const PANDA_DATA_PATH = '/root/clawd/panda-alpha/data/calls.json';
const LEARNING_STATE_PATH = '/root/clawd/oracle-alpha/data/learning-state.json';
const MIN_SIGNALS_FOR_ADJUSTMENT = 10;
const EMA_ALPHA = 0.2; // Weight for recent results in EMA (higher = more recent bias)
const WEIGHT_BOOST_THRESHOLD = 0.70; // >70% WR = boost
const WEIGHT_REDUCE_THRESHOLD = 0.50; // <50% WR = reduce
const MAX_WEIGHT_ADJUSTMENT = 0.5; // Max +/- 50% from base weight

// Default base weights (from aggregator config)
const DEFAULT_BASE_WEIGHTS: Record<string, number> = {
  'smart-wallet-elite': 1.6,
  'pump-koth': 1.4,
  'smart-wallet-sniper': 1.25,
  'narrative-momentum': 1.3,
  'whale-tracker': 1.2,
  'kol-tracker': 1.15,
  'dexscreener': 1.15,
  'volume-spike': 1.1,
  'narrative-new': 1.0,
  'kol-social': 0.95,
  'new-launch': 0.9,
  'news-scraper': 0.85,
  'cto-bot': 1.0,
  'manual': 1.0,
  'panda_alpha': 1.0,
};

// ===== STATE MANAGEMENT =====

let learningState: LearningState = {
  sources: {},
  lastSync: 0,
  totalResults: 0,
  version: 1,
};

/**
 * Load learning state from disk
 */
export function loadLearningState(): LearningState {
  try {
    if (fs.existsSync(LEARNING_STATE_PATH)) {
      const data = JSON.parse(fs.readFileSync(LEARNING_STATE_PATH, 'utf-8'));
      learningState = data;
      console.log(`[LEARN] Loaded state: ${Object.keys(learningState.sources).length} sources, ${learningState.totalResults} results`);
    }
  } catch (error) {
    console.error('[LEARN] Failed to load state:', error);
  }
  return learningState;
}

/**
 * Save learning state to disk
 */
export function saveLearningState(): void {
  try {
    const dir = path.dirname(LEARNING_STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LEARNING_STATE_PATH, JSON.stringify(learningState, null, 2));
    console.log(`[LEARN] Saved state: ${learningState.totalResults} total results`);
  } catch (error) {
    console.error('[LEARN] Failed to save state:', error);
  }
}

// ===== PANDA ALPHA INTEGRATION =====

/**
 * Read and parse Panda Alpha call results
 */
export function readPandaAlphaResults(): TradeResult[] {
  try {
    if (!fs.existsSync(PANDA_DATA_PATH)) {
      console.log('[LEARN] Panda Alpha data not found');
      return [];
    }

    const data = JSON.parse(fs.readFileSync(PANDA_DATA_PATH, 'utf-8'));
    const results: TradeResult[] = [];

    for (const call of data) {
      // Skip calls without results
      if (!call.status || call.status === 'open') continue;
      
      const source = normalizeSource(call.source);
      
      results.push({
        signalId: call.id || call.messageId?.toString() || 'unknown',
        ca: call.ca,
        source,
        entryMcap: call.entryMcap || 0,
        resultMcap: call.resultMcap || 0,
        resultMultiple: call.resultMultiple || 0,
        status: call.status,
        timestamp: typeof call.timestamp === 'string' ? new Date(call.timestamp).getTime() : call.timestamp,
        resultTimestamp: call.resultTimestamp,
      });
    }

    console.log(`[LEARN] Loaded ${results.length} results from Panda Alpha`);
    return results;
  } catch (error) {
    console.error('[LEARN] Failed to read Panda Alpha data:', error);
    return [];
  }
}

/**
 * Normalize source names to match our config
 */
function normalizeSource(source: string): string {
  if (!source) return 'unknown';
  
  const normalized = source.toLowerCase().replace(/[_-]/g, '-');
  
  // Map common variations
  const sourceMap: Record<string, string> = {
    'volume': 'volume-spike',
    'volumespike': 'volume-spike',
    'cto': 'cto-bot',
    'ctobot': 'cto-bot',
    'smartwallet': 'smart-wallet-elite',
    'whale': 'whale-tracker',
    'kol': 'kol-tracker',
    'narrative': 'narrative-momentum',
    'panda': 'panda_alpha',
  };

  return sourceMap[normalized] || source;
}

// ===== LEARNING ALGORITHMS =====

/**
 * Calculate Exponential Moving Average for win rate
 */
function calculateEMA(oldValue: number, newValue: number, alpha: number = EMA_ALPHA): number {
  return alpha * newValue + (1 - alpha) * oldValue;
}

/**
 * Determine trend based on recent vs overall performance
 */
function calculateTrend(overallWR: number, recentWR: number): 'improving' | 'declining' | 'stable' {
  const diff = recentWR - overallWR;
  if (diff > 0.05) return 'improving';
  if (diff < -0.05) return 'declining';
  return 'stable';
}

/**
 * Calculate adjusted weight based on performance
 */
function calculateAdjustedWeight(baseWeight: number, winRate: number, totalSignals: number): number {
  // Don't adjust if not enough data
  if (totalSignals < MIN_SIGNALS_FOR_ADJUSTMENT) {
    return baseWeight;
  }

  let adjustment = 0;

  if (winRate >= WEIGHT_BOOST_THRESHOLD) {
    // Boost weight for high performers (up to +50%)
    const boostFactor = (winRate - WEIGHT_BOOST_THRESHOLD) / (1 - WEIGHT_BOOST_THRESHOLD);
    adjustment = MAX_WEIGHT_ADJUSTMENT * boostFactor;
  } else if (winRate < WEIGHT_REDUCE_THRESHOLD) {
    // Reduce weight for low performers (up to -50%)
    const reduceFactor = (WEIGHT_REDUCE_THRESHOLD - winRate) / WEIGHT_REDUCE_THRESHOLD;
    adjustment = -MAX_WEIGHT_ADJUSTMENT * reduceFactor;
  }

  const adjusted = baseWeight * (1 + adjustment);
  
  // Clamp to reasonable bounds
  return Math.max(0.3, Math.min(2.5, adjusted));
}

/**
 * Process a single trade result and update source stats
 */
export function processResult(result: TradeResult): void {
  const { source, status, resultMultiple } = result;
  
  // Initialize source if not exists
  if (!learningState.sources[source]) {
    learningState.sources[source] = {
      source,
      totalSignals: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      winRate: 0.5, // Start neutral
      avgMultiple: 1.0,
      recentWinRate: 0.5,
      baseWeight: DEFAULT_BASE_WEIGHTS[source] || 1.0,
      adjustedWeight: DEFAULT_BASE_WEIGHTS[source] || 1.0,
      trend: 'stable',
      lastUpdated: Date.now(),
    };
  }

  const perf = learningState.sources[source];
  
  // Update counts
  perf.totalSignals++;
  
  if (status === 'hit') {
    perf.wins++;
  } else if (status === 'miss') {
    perf.losses++;
  } else {
    perf.pending++;
  }

  // Calculate win rate (only from resolved signals)
  const resolved = perf.wins + perf.losses;
  if (resolved > 0) {
    const newWinRate = perf.wins / resolved;
    
    // Update EMA for recent performance
    perf.recentWinRate = calculateEMA(perf.recentWinRate, status === 'hit' ? 1 : 0);
    perf.winRate = newWinRate;
    
    // Update trend
    perf.trend = calculateTrend(perf.winRate, perf.recentWinRate);
    
    // Recalculate adjusted weight
    perf.adjustedWeight = calculateAdjustedWeight(perf.baseWeight, perf.winRate, resolved);
  }

  // Update average multiple
  if (resultMultiple > 0) {
    perf.avgMultiple = (perf.avgMultiple * (perf.totalSignals - 1) + resultMultiple) / perf.totalSignals;
  }

  perf.lastUpdated = Date.now();
  learningState.totalResults++;
}

/**
 * Sync learning state with Panda Alpha data
 */
export function syncWithPandaAlpha(): { processed: number; newResults: number } {
  const results = readPandaAlphaResults();
  
  // Track which signals we've already processed
  const processedSignals = new Set<string>();
  for (const source of Object.values(learningState.sources)) {
    // We don't track individual signals yet, so we'll reprocess all
  }

  // Reset state and reprocess all results
  const oldTotal = learningState.totalResults;
  learningState.sources = {};
  learningState.totalResults = 0;

  for (const result of results) {
    processResult(result);
  }

  learningState.lastSync = Date.now();
  saveLearningState();

  return {
    processed: results.length,
    newResults: learningState.totalResults - oldTotal,
  };
}

// ===== API FUNCTIONS =====

/**
 * Get performance stats for all sources
 */
export function getSourcePerformance(): SourcePerformance[] {
  return Object.values(learningState.sources)
    .sort((a, b) => b.winRate - a.winRate);
}

/**
 * Get performance for a specific source
 */
export function getSourceStats(source: string): SourcePerformance | null {
  return learningState.sources[normalizeSource(source)] || null;
}

/**
 * Get adjusted weight for a source
 */
export function getAdjustedWeight(source: string): number {
  const normalized = normalizeSource(source);
  const perf = learningState.sources[normalized];
  
  if (perf) {
    return perf.adjustedWeight;
  }
  
  return DEFAULT_BASE_WEIGHTS[normalized] || 1.0;
}

/**
 * Get all adjusted weights as a map
 */
export function getAdjustedWeights(): Record<string, number> {
  const weights: Record<string, number> = { ...DEFAULT_BASE_WEIGHTS };
  
  for (const [source, perf] of Object.entries(learningState.sources)) {
    weights[source] = perf.adjustedWeight;
  }
  
  return weights;
}

/**
 * Manually submit a trade result
 */
export function submitResult(
  signalId: string,
  ca: string,
  source: string,
  status: 'hit' | 'miss',
  entryMcap: number,
  resultMcap: number
): { success: boolean; sourceStats: SourcePerformance | null } {
  const result: TradeResult = {
    signalId,
    ca,
    source: normalizeSource(source),
    entryMcap,
    resultMcap,
    resultMultiple: resultMcap / entryMcap,
    status,
    timestamp: Date.now(),
    resultTimestamp: Date.now(),
  };

  processResult(result);
  saveLearningState();

  return {
    success: true,
    sourceStats: learningState.sources[result.source] || null,
  };
}

/**
 * Get learning state summary
 */
export function getLearningSummary(): {
  totalSources: number;
  totalResults: number;
  lastSync: number;
  topPerformers: SourcePerformance[];
  underperformers: SourcePerformance[];
  improving: SourcePerformance[];
  declining: SourcePerformance[];
} {
  const sources = Object.values(learningState.sources);
  const withEnoughData = sources.filter(s => (s.wins + s.losses) >= MIN_SIGNALS_FOR_ADJUSTMENT);

  return {
    totalSources: sources.length,
    totalResults: learningState.totalResults,
    lastSync: learningState.lastSync,
    topPerformers: withEnoughData
      .filter(s => s.winRate >= WEIGHT_BOOST_THRESHOLD)
      .sort((a, b) => b.winRate - a.winRate),
    underperformers: withEnoughData
      .filter(s => s.winRate < WEIGHT_REDUCE_THRESHOLD)
      .sort((a, b) => a.winRate - b.winRate),
    improving: sources.filter(s => s.trend === 'improving'),
    declining: sources.filter(s => s.trend === 'declining'),
  };
}

/**
 * Get performance dashboard data
 */
export function getPerformanceDashboard(): {
  overview: {
    totalSignals: number;
    totalWins: number;
    totalLosses: number;
    overallWinRate: number;
    avgMultiple: number;
  };
  bySource: SourcePerformance[];
  weightChanges: { source: string; base: number; adjusted: number; change: number }[];
  trends: { improving: string[]; declining: string[]; stable: string[] };
} {
  const sources = Object.values(learningState.sources);
  
  const totalWins = sources.reduce((sum, s) => sum + s.wins, 0);
  const totalLosses = sources.reduce((sum, s) => sum + s.losses, 0);
  const totalSignals = totalWins + totalLosses;
  
  return {
    overview: {
      totalSignals,
      totalWins,
      totalLosses,
      overallWinRate: totalSignals > 0 ? totalWins / totalSignals : 0,
      avgMultiple: sources.length > 0 
        ? sources.reduce((sum, s) => sum + s.avgMultiple, 0) / sources.length 
        : 1,
    },
    bySource: sources.sort((a, b) => b.winRate - a.winRate),
    weightChanges: sources.map(s => ({
      source: s.source,
      base: s.baseWeight,
      adjusted: s.adjustedWeight,
      change: ((s.adjustedWeight - s.baseWeight) / s.baseWeight) * 100,
    })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)),
    trends: {
      improving: sources.filter(s => s.trend === 'improving').map(s => s.source),
      declining: sources.filter(s => s.trend === 'declining').map(s => s.source),
      stable: sources.filter(s => s.trend === 'stable').map(s => s.source),
    },
  };
}

// Initialize on load
loadLearningState();
