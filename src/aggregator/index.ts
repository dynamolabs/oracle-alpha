import { RawSignal, AggregatedSignal, SignalSource, SourceConfig } from '../types';
import { scanSmartWallets } from '../sources/smart-wallet';
import { scanVolumeSpikes } from '../sources/volume-spike';
import { v4 as uuidv4 } from 'uuid';

// Source weights (adjusted by historical performance)
const SOURCE_CONFIGS: SourceConfig[] = [
  {
    source: 'smart-wallet-elite',
    enabled: true,
    weight: 1.5,
    historicalWinRate: 0.70,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'smart-wallet-sniper',
    enabled: true,
    weight: 1.2,
    historicalWinRate: 0.41,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'volume-spike',
    enabled: true,
    weight: 1.0,
    historicalWinRate: 0.35,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'kol-buy',
    enabled: false, // TODO: Implement
    weight: 0.8,
    historicalWinRate: 0.30,
    totalSignals: 0,
    lastUpdated: Date.now()
  },
  {
    source: 'narrative-trend',
    enabled: false, // TODO: Implement
    weight: 0.7,
    historicalWinRate: 0.25,
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
function calculateRiskLevel(score: number, signals: RawSignal[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  const hasElite = signals.some(s => s.source === 'smart-wallet-elite');
  
  if (score >= 80 && hasElite) return 'LOW';
  if (score >= 70) return 'MEDIUM';
  if (score >= 50) return 'HIGH';
  return 'EXTREME';
}

// Detect narratives from token name/symbol
function detectNarratives(name: string, symbol: string): string[] {
  const narratives: string[] = [];
  const text = `${name} ${symbol}`.toLowerCase();
  
  const NARRATIVE_KEYWORDS = {
    'AI/Agents': ['ai', 'agent', 'gpt', 'claude', 'neural', 'deep', 'auto'],
    'Political': ['trump', 'biden', 'maga', 'vote', 'election', 'president'],
    'Animals': ['dog', 'cat', 'pepe', 'frog', 'doge', 'shib', 'inu', 'wif'],
    'DeFi': ['swap', 'yield', 'stake', 'lend', 'borrow', 'vault'],
    'Gaming': ['game', 'play', 'nft', 'meta', 'verse'],
    'Meme': ['meme', 'moon', 'rocket', 'lambo', 'wagmi', 'gm']
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
  
  // Collect raw signals from all sources
  const rawSignals: RawSignal[] = [];
  
  // Smart wallet signals
  const smartWalletSignals = await scanSmartWallets();
  rawSignals.push(...smartWalletSignals);
  console.log(`[ORACLE] Smart wallet signals: ${smartWalletSignals.length}`);
  
  // Volume spike signals
  const volumeSignals = await scanVolumeSpikes();
  rawSignals.push(...volumeSignals);
  console.log(`[ORACLE] Volume spike signals: ${volumeSignals.length}`);
  
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
  
  for (const [token, signals] of signalsByToken) {
    const result = aggregateSignalsForToken(signals);
    if (result) {
      aggregated.push(result);
    }
  }
  
  // Sort by score descending
  aggregated.sort((a, b) => b.score - a.score);
  
  console.log(`[ORACLE] Aggregated signals: ${aggregated.length}`);
  
  return aggregated;
}

// Export for testing
export { SOURCE_CONFIGS, calculateCompositeScore, detectNarratives };
