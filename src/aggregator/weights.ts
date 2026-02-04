/**
 * Dynamic Weight Management for Oracle Alpha
 * Adjusts source weights based on actual performance from learning system
 */

import { SignalSource, SourceConfig } from '../types';
import { getAdjustedWeight, getAdjustedWeights, getSourceStats, SourcePerformance } from '../learning';

// ===== DEFAULT WEIGHTS =====
// These are the baseline weights before any learning adjustment

const DEFAULT_SOURCE_CONFIGS: SourceConfig[] = [
  // === HIGH PRIORITY SOURCES (proven alpha) ===
  {
    source: 'smart-wallet-elite',
    enabled: true,
    weight: 1.6,
    historicalWinRate: 0.72,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'pump-koth',
    enabled: true,
    weight: 1.4,
    historicalWinRate: 0.58,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'smart-wallet-sniper',
    enabled: true,
    weight: 1.25,
    historicalWinRate: 0.45,
    totalSignals: 0,
    lastUpdated: Date.now()
  },

  // === MEDIUM PRIORITY SOURCES ===
  {
    source: 'narrative-momentum',
    enabled: true,
    weight: 1.3,
    historicalWinRate: 0.52,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'whale-tracker',
    enabled: true,
    weight: 1.2,
    historicalWinRate: 0.48,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'kol-tracker',
    enabled: true,
    weight: 1.15,
    historicalWinRate: 0.46,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'dexscreener',
    enabled: true,
    weight: 1.15,
    historicalWinRate: 0.44,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'volume-spike',
    enabled: true,
    weight: 1.1,
    historicalWinRate: 0.40,
    totalSignals: 0,
    lastUpdated: Date.now()
  },

  // === SUPPORTING SOURCES ===
  {
    source: 'narrative-new',
    enabled: true,
    weight: 1.0,
    historicalWinRate: 0.38,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'kol-social',
    enabled: true,
    weight: 0.95,
    historicalWinRate: 0.36,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'new-launch',
    enabled: true,
    weight: 0.9,
    historicalWinRate: 0.32,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'news-scraper',
    enabled: true,
    weight: 0.85,
    historicalWinRate: 0.30,
    totalSignals: 0,
    lastUpdated: Date.now()
  },

  // === ADDITIONAL SOURCES ===
  {
    source: 'panda_alpha',
    enabled: true,
    weight: 1.0,
    historicalWinRate: 0.40,
    totalSignals: 0,
    lastUpdated: Date.now()
  }
];

// Cache for learned configs
let cachedConfigs: SourceConfig[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get source configs with learning-adjusted weights
 */
export function getLearnedSourceConfigs(): SourceConfig[] {
  const now = Date.now();
  
  // Return cached if still valid
  if (cachedConfigs && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfigs;
  }

  // Get learned weights
  const learnedWeights = getAdjustedWeights();
  
  // Apply learned weights to configs
  const configs: SourceConfig[] = DEFAULT_SOURCE_CONFIGS.map(config => {
    const stats = getSourceStats(config.source);
    const learnedWeight = learnedWeights[config.source] || config.weight;
    
    return {
      ...config,
      weight: learnedWeight,
      historicalWinRate: stats?.winRate ?? config.historicalWinRate,
      totalSignals: stats?.totalSignals ?? config.totalSignals,
      lastUpdated: stats?.lastUpdated ?? config.lastUpdated,
    };
  });

  // Cache the result
  cachedConfigs = configs;
  cacheTimestamp = now;

  return configs;
}

/**
 * Get the learned weight for a specific source
 */
export function getSourceWeight(source: SignalSource | string): number {
  return getAdjustedWeight(source);
}

/**
 * Get source config by name
 */
export function getSourceConfig(source: SignalSource | string): SourceConfig | undefined {
  const configs = getLearnedSourceConfigs();
  return configs.find(c => c.source === source);
}

/**
 * Get performance summary for a source
 */
export function getSourcePerformanceSummary(source: SignalSource | string): {
  weight: number;
  baseWeight: number;
  winRate: number;
  totalSignals: number;
  adjustment: string;
  trend: string;
} | null {
  const config = DEFAULT_SOURCE_CONFIGS.find(c => c.source === source);
  const stats = getSourceStats(source);
  
  if (!config) return null;

  const learnedWeight = getAdjustedWeight(source);
  const adjustment = ((learnedWeight - config.weight) / config.weight) * 100;

  return {
    weight: learnedWeight,
    baseWeight: config.weight,
    winRate: stats?.winRate ?? config.historicalWinRate,
    totalSignals: stats?.totalSignals ?? 0,
    adjustment: adjustment > 0 ? `+${adjustment.toFixed(1)}%` : `${adjustment.toFixed(1)}%`,
    trend: stats?.trend ?? 'stable',
  };
}

/**
 * Calculate composite score using learned weights
 */
export function calculateLearnedCompositeScore(
  signals: { source: string; confidence: number }[]
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const signal of signals) {
    const config = getSourceConfig(signal.source);
    if (!config) continue;

    // Weight is product of learned weight and win rate
    const stats = getSourceStats(signal.source);
    const winRate = stats?.winRate ?? config.historicalWinRate;
    const weight = config.weight * winRate;
    
    weightedSum += signal.confidence * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Get all source weights summary
 */
export function getWeightsSummary(): {
  source: string;
  base: number;
  learned: number;
  change: number;
  winRate: number;
  signals: number;
  trend: string;
}[] {
  const learnedWeights = getAdjustedWeights();
  
  return DEFAULT_SOURCE_CONFIGS.map(config => {
    const stats = getSourceStats(config.source);
    const learned = learnedWeights[config.source] || config.weight;
    
    return {
      source: config.source,
      base: config.weight,
      learned,
      change: ((learned - config.weight) / config.weight) * 100,
      winRate: stats?.winRate ?? config.historicalWinRate,
      signals: stats?.totalSignals ?? 0,
      trend: stats?.trend ?? 'unknown',
    };
  }).sort((a, b) => b.learned - a.learned);
}

/**
 * Invalidate the cache (call after learning update)
 */
export function invalidateWeightsCache(): void {
  cachedConfigs = null;
  cacheTimestamp = 0;
}

// Export default configs for reference
export { DEFAULT_SOURCE_CONFIGS };
