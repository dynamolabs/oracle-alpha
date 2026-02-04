import { RawSignal, AggregatedSignal, SignalSource, SourceConfig } from '../types';
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
  if (signals.length === 1) weaknesses.push('Single signal source');

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

// Aggregate signals for a token
function aggregateSignalsForToken(signals: RawSignal[]): AggregatedSignal | null {
  if (signals.length === 0) return null;

  const firstSignal = signals[0];
  const score = calculateCompositeScore(signals);

  if (score < 50) return null; // Filter low-quality signals

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
export async function aggregate(): Promise<AggregatedSignal[]> {
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
    const result = aggregateSignalsForToken(signals);
    if (result) {
      aggregated.push(result);
    }
  }

  // Sort by score descending
  aggregated.sort((a, b) => b.score - a.score);

  // Enrich with token metadata
  if (aggregated.length > 0) {
    console.log(`[ORACLE] Enriching ${aggregated.length} signals with metadata...`);
    const addresses = aggregated.map(s => s.token);
    const metadata = await batchGetMetadata(addresses);

    for (const signal of aggregated) {
      const meta = metadata.get(signal.token);
      if (meta && meta.symbol !== 'UNKNOWN') {
        signal.symbol = meta.symbol;
        signal.name = meta.name;
        // Re-detect narratives with actual name
        signal.analysis.narrative = detectNarratives(meta.name, meta.symbol);
      }
    }
  }

  console.log(`[ORACLE] Aggregated signals: ${aggregated.length}`);

  return aggregated;
}

// Export for testing
export { SOURCE_CONFIGS, calculateCompositeScore, detectNarratives };
