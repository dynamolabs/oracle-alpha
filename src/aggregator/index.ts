import { RawSignal, AggregatedSignal, SignalSource, SourceConfig, ConvictionLevel, SafetyData } from '../types';
import { scanSmartWallets } from '../sources/smart-wallet';
import { scanVolumeSpikes } from '../sources/volume-spike';
import { scanKOLActivity } from '../sources/kol-tracker';
import { scanNarratives } from '../sources/narrative-detector';
import { scanNewLaunches } from '../sources/new-launches';
import { scanWhaleActivity } from '../sources/whale-tracker';
import { scanNews } from '../sources/news-scraper';
import { scanPumpKOTH } from '../sources/pump-koth';
import { scanDexScreener } from '../sources/dexscreener';
import { scanTwitterSentiment } from '../sources/twitter-sentiment';
import { scanDexVolumeAnomalies } from '../sources/dex-volume-anomaly';
import { batchGetMetadata } from '../utils/token-metadata';
import { batchAnalyzeSafety, SafetyAnalysis } from '../filters/dev-check';
import { v4 as uuidv4 } from 'uuid';

// Note: dedup and confidence utils available if needed
// import { isDuplicate, cleanupSeenSignals } from '../utils/dedup';
// import { calculateAdjustedScore, getRecommendedAction } from '../utils/confidence';

// Optimized source weights based on signal quality and reliability
// Higher weight = more influence on composite score
// historicalWinRate should be updated based on actual performance data
const SOURCE_CONFIGS: SourceConfig[] = [
  // === HIGH PRIORITY SOURCES (proven alpha) ===
  {
    source: 'smart-wallet-elite',
    enabled: true,
    weight: 1.6,  // Highest weight - best signal quality
    historicalWinRate: 0.72,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'pump-koth',
    enabled: true,
    weight: 1.4,  // Pump KOTH = strong signal, tokens already validated
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
  
  // === MEDIUM PRIORITY SOURCES (good confluence) ===
  {
    source: 'narrative-momentum',
    enabled: true,
    weight: 1.3,  // Trending narrative + momentum = strong
    historicalWinRate: 0.52,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'whale-tracker',
    enabled: true,
    weight: 1.2,  // Whale accumulation is strong signal
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
    weight: 1.1,  // Volume anomalies good for early detection
    historicalWinRate: 0.40,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  
  // === SUPPORTING SOURCES (validation/confluence) ===
  {
    source: 'narrative-new',
    enabled: true,
    weight: 1.0,  // New narratives = speculative
    historicalWinRate: 0.38,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'kol-social',
    enabled: true,
    weight: 0.95,  // Social sentiment useful but noisy
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
    weight: 0.85,  // News often lagging
    historicalWinRate: 0.30,
    totalSignals: 0,
    lastUpdated: Date.now()
  }
];

// Confluence configuration
const CONFLUENCE_CONFIG = {
  minSources: 2, // Default: require 2+ unique source types
  minScoreThreshold: 70, // Higher default threshold (was 60)
  boosts: {
    twoSources: 5,
    threeSources: 10,
    fourPlusSources: 15
  },
  convictionThresholds: {
    highConviction: 85, // Score >= 85 = HIGH_CONVICTION
    ultra: 95 // Score >= 95 with 3+ sources = ULTRA
  }
};

// Get source type category (to ensure different source types, not same wallet twice)
function getSourceCategory(source: SignalSource): string {
  // Group related sources into categories
  if (source.includes('smart-wallet')) return 'smart-wallet';
  if (source.includes('whale')) return 'whale';
  if (source.includes('kol')) return 'kol';
  if (source.includes('narrative')) return 'narrative';
  if (source.includes('volume') || source === 'dex-volume-anomaly') return 'volume';
  if (source.includes('pump') || source === 'pump-koth') return 'pump';
  if (source.includes('dex') || source === 'dexscreener') return 'dex';
  if (source.includes('news')) return 'news';
  if (source.includes('launch') || source.includes('listing')) return 'launch';
  return source; // Use source name as its own category
}

// Calculate confluence boost based on unique source count
function calculateConfluenceBoost(uniqueSourceCount: number): number {
  if (uniqueSourceCount >= 4) return CONFLUENCE_CONFIG.boosts.fourPlusSources;
  if (uniqueSourceCount >= 3) return CONFLUENCE_CONFIG.boosts.threeSources;
  if (uniqueSourceCount >= 2) return CONFLUENCE_CONFIG.boosts.twoSources;
  return 0;
}

// Determine conviction level based on score and source count
function determineConvictionLevel(score: number, uniqueSourceCount: number): ConvictionLevel {
  if (score >= CONFLUENCE_CONFIG.convictionThresholds.ultra && uniqueSourceCount >= 3) {
    return 'ULTRA';
  }
  if (score >= CONFLUENCE_CONFIG.convictionThresholds.highConviction) {
    return 'HIGH_CONVICTION';
  }
  return 'STANDARD';
}

// Known signals cache (to avoid duplicates)
const knownSignals = new Set<string>();

// Get source config
function getSourceConfig(source: SignalSource): SourceConfig | undefined {
  return SOURCE_CONFIGS.find(c => c.source === source);
}

// Calculate weighted score from multiple signals for same token
function calculateCompositeScore(signals: RawSignal[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const signal of signals) {
    const config = getSourceConfig(signal.source);
    if (!config) continue;

    const weight = config.weight * config.historicalWinRate;
    weightedSum += signal.confidence * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// Determine risk level
function calculateRiskLevel(
  score: number,
  signals: RawSignal[]
): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  const hasElite = signals.some(s => s.source === 'smart-wallet-elite');

  if (score >= 80 && hasElite) return 'LOW';
  if (score >= 70) return 'MEDIUM';
  if (score >= 50) return 'HIGH';
  return 'EXTREME';
}

// Detect narratives from token name/symbol (comprehensive)
function detectNarratives(name: string, symbol: string): string[] {
  const narratives: string[] = [];
  const text = `${name} ${symbol}`.toLowerCase();

  // Comprehensive narrative keywords (sync with narrative-detector.ts)
  const NARRATIVE_KEYWORDS: Record<string, string[]> = {
    // Tech
    'AI/Agents': ['ai', 'agent', 'gpt', 'llm', 'claude', 'neural', 'auto', 'swarm', 'agi', 'sentient', 'brain', 'cognitive', 'eliza', 'virtuals'],
    'DePIN': ['depin', 'iot', 'sensor', 'infrastructure', 'node', 'compute', 'render', 'bandwidth'],
    'RWA': ['rwa', 'real world', 'tokenized', 'treasury', 'bond', 'estate', 'property', 'backed'],
    'ZK/Privacy': ['zk', 'zero knowledge', 'privacy', 'private', 'stealth', 'anonymous'],
    
    // Meme/Culture
    'Meme': ['doge', 'pepe', 'shib', 'meme', 'wojak', 'chad', 'frog', 'cat', 'dog', 'inu', 'wif', 'bonk', 'popcat', 'mog'],
    'Political': ['trump', 'biden', 'maga', 'election', 'president', 'political', 'america', 'melania'],
    'Anime': ['anime', 'waifu', 'manga', 'otaku', 'kawaii', 'senpai', 'chan', 'neko', 'uwu'],
    'Celebrity': ['elon', 'musk', 'drake', 'kanye', 'celebrity', 'famous', 'rapper'],
    
    // DeFi/Utility
    'DeFi': ['swap', 'yield', 'stake', 'lend', 'borrow', 'vault', 'perp', 'dex', 'amm'],
    'Gaming': ['game', 'gaming', 'play', 'metaverse', 'p2e', 'gamefi', 'rpg', 'guild'],
    'Liquid Staking': ['liquid staking', 'lst', 'msol', 'jitosol', 'marinade'],
    'Launchpad': ['launch', 'launchpad', 'ido', 'presale', 'fair launch']
  };

  for (const [narrative, keywords] of Object.entries(NARRATIVE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      narratives.push(narrative);
    }
  }

  return narratives.length > 0 ? narratives : ['General'];
}

// Generate analysis
function generateAnalysis(signals: RawSignal[], score: number): AggregatedSignal['analysis'] {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Check signal sources
  const hasElite = signals.some(s => s.source === 'smart-wallet-elite');
  const hasSniper = signals.some(s => s.source === 'smart-wallet-sniper');
  const hasVolume = signals.some(s => s.source === 'volume-spike');

  if (hasElite) strengths.push('Elite wallet accumulating (70% WR)');
  if (hasSniper) strengths.push('Sniper wallet detected');
  if (hasVolume) strengths.push('Volume spike detected');
  if (signals.length >= 2) strengths.push('Multiple signal sources');

  if (!hasElite && !hasSniper) weaknesses.push('No smart wallet signal');
  
  // Count unique source categories
  const categories = new Set(signals.map(s => getSourceCategory(s.source)));
  if (categories.size === 1) weaknesses.push('Single source type');
  if (categories.size >= 3) strengths.push(`Strong confluence (${categories.size}x sources)`);

  // Get market data from metadata
  const volumeSignal = signals.find(s => s.source === 'volume-spike');
  if (volumeSignal?.metadata) {
    const meta = volumeSignal.metadata;
    if (meta.buyRatio >= 70) strengths.push(`Strong buy pressure (${meta.buyRatio}%)`);
    if (meta.buyRatio < 50) weaknesses.push(`Weak buy pressure (${meta.buyRatio}%)`);
    if (meta.age <= 10) strengths.push('Fresh token');
    if (meta.age > 30) weaknesses.push('Getting old');
  }

  // Get narratives
  const firstSignal = signals[0];
  const narratives = detectNarratives(firstSignal.name || '', firstSignal.symbol || '');

  // Generate recommendation
  let recommendation = '';
  if (score >= 80) recommendation = 'STRONG BUY - Multiple high-quality signals';
  else if (score >= 70) recommendation = 'BUY - Good signal confluence';
  else if (score >= 60) recommendation = 'SPECULATIVE - Moderate confidence';
  else recommendation = 'WATCH - Needs more confirmation';

  return { narrative: narratives, strengths, weaknesses, recommendation };
}

// Aggregate signals for a token with confluence filtering
function aggregateSignalsForToken(signals: RawSignal[], minSources: number = CONFLUENCE_CONFIG.minSources): AggregatedSignal | null {
  if (signals.length === 0) return null;

  const firstSignal = signals[0];
  
  // Calculate unique source categories (not just source names)
  const sourceCategories = new Set<string>();
  for (const signal of signals) {
    sourceCategories.add(getSourceCategory(signal.source));
  }
  const uniqueSourceCount = sourceCategories.size;
  const sourceTypes = Array.from(sourceCategories);
  
  // Apply confluence filter: require minimum unique source types
  if (uniqueSourceCount < minSources) {
    return null; // Not enough different sources agree
  }
  
  // Calculate base score
  let score = calculateCompositeScore(signals);
  
  // Apply confluence boost
  const confluenceBoost = calculateConfluenceBoost(uniqueSourceCount);
  score = Math.min(100, score + confluenceBoost); // Cap at 100
  
  // Higher minimum threshold (70 instead of 60)
  if (score < CONFLUENCE_CONFIG.minScoreThreshold) return null;

  // Determine conviction level
  const convictionLevel = determineConvictionLevel(score, uniqueSourceCount);

  // Get market data from volume spike signal or use defaults
  const volumeSignal = signals.find(s => s.source === 'volume-spike');
  const marketData = volumeSignal?.metadata || {};

  return {
    id: uuidv4(),
    timestamp: Math.max(...signals.map(s => s.timestamp)),
    token: firstSignal.token,
    symbol: firstSignal.symbol || 'UNKNOWN',
    name: firstSignal.name || 'Unknown',
    score,
    confidence: Math.round(signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length),
    riskLevel: calculateRiskLevel(score, signals),
    confluence: {
      uniqueSources: uniqueSourceCount,
      sourceTypes,
      confluenceBoost,
      convictionLevel
    },
    sources: signals.map(s => ({
      source: s.source,
      weight: getSourceConfig(s.source)?.weight || 1,
      rawScore: s.confidence
    })),
    marketData: {
      mcap: marketData.mcap || 0,
      liquidity: marketData.liquidity || 0,
      volume5m: marketData.volume5m || 0,
      volume1h: marketData.volume1h || 0,
      priceChange5m: marketData.priceChange5m || 0,
      priceChange1h: 0,
      age: marketData.age || 0
    },
    analysis: generateAnalysis(signals, score)
  };
}

// Main aggregation function
export async function aggregate(options?: { minSources?: number }): Promise<AggregatedSignal[]> {
  const minSources = options?.minSources ?? CONFLUENCE_CONFIG.minSources;
  console.log('[ORACLE] Starting signal aggregation...');

  // Collect raw signals from all sources (run in parallel batches for speed)
  const rawSignals: RawSignal[] = [];

  // Batch 1: Primary sources (most reliable)
  console.log('[ORACLE] Scanning primary sources...');
  const [smartWalletSignals, pumpKothSignals, whaleSignals] = await Promise.all([
    scanSmartWallets(),
    scanPumpKOTH(),
    scanWhaleActivity()
  ]);
  rawSignals.push(...smartWalletSignals, ...pumpKothSignals, ...whaleSignals);
  console.log(`[ORACLE] Primary: Smart wallet=${smartWalletSignals.length}, Pump KOTH=${pumpKothSignals.length}, Whale=${whaleSignals.length}`);

  // Batch 2: Market data sources
  console.log('[ORACLE] Scanning market data sources...');
  const [volumeSignals, dexScreenerSignals, volumeAnomalySignals] = await Promise.all([
    scanVolumeSpikes(),
    scanDexScreener(),
    scanDexVolumeAnomalies()
  ]);
  rawSignals.push(...volumeSignals, ...dexScreenerSignals, ...volumeAnomalySignals);
  console.log(`[ORACLE] Market: Volume spike=${volumeSignals.length}, DexScreener=${dexScreenerSignals.length}, Volume anomaly=${volumeAnomalySignals.length}`);

  // Batch 3: Social/narrative sources
  console.log('[ORACLE] Scanning social/narrative sources...');
  const [kolSignals, narrativeSignals, twitterSentimentSignals] = await Promise.all([
    scanKOLActivity(),
    scanNarratives(),
    scanTwitterSentiment()
  ]);
  rawSignals.push(...kolSignals, ...narrativeSignals, ...twitterSentimentSignals);
  console.log(`[ORACLE] Social: KOL=${kolSignals.length}, Narrative=${narrativeSignals.length}, Twitter sentiment=${twitterSentimentSignals.length}`);

  // Batch 4: Supporting sources
  console.log('[ORACLE] Scanning supporting sources...');
  const [newLaunchSignals, newsSignals] = await Promise.all([
    scanNewLaunches(),
    scanNews()
  ]);
  rawSignals.push(...newLaunchSignals, ...newsSignals);
  console.log(`[ORACLE] Supporting: New launches=${newLaunchSignals.length}, News=${newsSignals.length}`);

  // Group signals by token
  const signalsByToken = new Map<string, RawSignal[]>();

  for (const signal of rawSignals) {
    // Skip if we've already seen this exact signal
    const signalKey = `${signal.source}:${signal.token}:${signal.timestamp}`;
    if (knownSignals.has(signalKey)) continue;
    knownSignals.add(signalKey);

    const existing = signalsByToken.get(signal.token) || [];
    existing.push(signal);
    signalsByToken.set(signal.token, existing);
  }

  // Aggregate signals for each token
  const aggregated: AggregatedSignal[] = [];

  for (const [_token, signals] of signalsByToken) {
    const result = aggregateSignalsForToken(signals, minSources);
    if (result) {
      aggregated.push(result);
    }
  }

  // Sort by score descending
  aggregated.sort((a, b) => b.score - a.score);

  // Enrich with token metadata and safety analysis
  if (aggregated.length > 0) {
    console.log(`[ORACLE] Enriching ${aggregated.length} signals with metadata...`);
    const addresses = aggregated.map(s => s.token);
    
    // Fetch metadata and safety in parallel
    const [metadata, safetyResults] = await Promise.all([
      batchGetMetadata(addresses),
      batchAnalyzeSafety(addresses)
    ]);

    for (const signal of aggregated) {
      // Apply metadata
      const meta = metadata.get(signal.token);
      if (meta && meta.symbol !== 'UNKNOWN') {
        signal.symbol = meta.symbol;
        signal.name = meta.name;
        // Re-detect narratives with actual name
        signal.analysis.narrative = detectNarratives(meta.name, meta.symbol);
      }
      
      // Apply safety analysis
      const safety = safetyResults.get(signal.token);
      if (safety) {
        signal.safety = {
          safetyScore: safety.safetyScore,
          riskCategory: safety.riskCategory,
          redFlags: safety.redFlags,
          devHoldings: safety.devHoldings,
          topHolderPercentage: safety.topHolderPercentage,
          liquidityLocked: safety.liquidityLocked,
          mintAuthorityEnabled: safety.mintAuthorityEnabled,
          freezeAuthorityEnabled: safety.freezeAuthorityEnabled,
          tokenAge: safety.tokenAge,
          bundledWallets: safety.bundledWallets
        };
        
        // Add safety-based weaknesses to analysis
        if (safety.redFlags.length > 0) {
          const criticalFlags = safety.redFlags.filter(f => f.severity === 'CRITICAL');
          const highFlags = safety.redFlags.filter(f => f.severity === 'HIGH');
          
          if (criticalFlags.length > 0) {
            signal.analysis.weaknesses.push(`🚨 ${criticalFlags.length} critical safety flag(s)`);
          }
          if (highFlags.length > 0) {
            signal.analysis.weaknesses.push(`⚠️ ${highFlags.length} high-risk flag(s)`);
          }
        }
        
        // Add safety strengths
        if (safety.safetyScore >= 70) {
          signal.analysis.strengths.push('🛡️ High safety score');
        }
        if (!safety.mintAuthorityEnabled && !safety.freezeAuthorityEnabled) {
          signal.analysis.strengths.push('✅ Authorities revoked');
        }
      }
    }
  }

  console.log(`[ORACLE] Aggregated signals: ${aggregated.length}`);

  return aggregated;
}

// Export for testing and external use
export { 
  SOURCE_CONFIGS, 
  calculateCompositeScore, 
  detectNarratives,
  CONFLUENCE_CONFIG,
  getSourceCategory,
  calculateConfluenceBoost,
  determineConvictionLevel
};
