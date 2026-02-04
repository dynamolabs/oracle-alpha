/**
 * Token Similarity Search Module
 * 
 * Find tokens similar to a given token based on multiple factors:
 * - Market cap range
 * - Token age
 * - Holder count
 * - Volume profile
 * - Sector/narrative match
 * - Price pattern similarity
 * - Dev wallet behavior
 */

import { AggregatedSignal, SignalSource, SafetyData } from '../types';
import {
  tokenPriceHistory,
  TokenTracking,
  PricePoint,
  getRelatedTokens,
  calculateCorrelation,
  CorrelationResult
} from '../analytics/correlation';

// ============ TYPES ============

// Similarity factor weights (total should = 100)
export interface SimilarityWeights {
  mcapRange: number;      // 20
  tokenAge: number;       // 10
  holderCount: number;    // 15
  volumeProfile: number;  // 15
  sectorMatch: number;    // 15
  pricePattern: number;   // 15
  devBehavior: number;    // 10
}

// Default weights
export const DEFAULT_WEIGHTS: SimilarityWeights = {
  mcapRange: 20,
  tokenAge: 10,
  holderCount: 15,
  volumeProfile: 15,
  sectorMatch: 15,
  pricePattern: 15,
  devBehavior: 10
};

// Individual factor score
export interface SimilarityFactor {
  factor: keyof SimilarityWeights;
  name: string;
  score: number;          // 0-100
  weightedScore: number;  // score * weight / 100
  details: string;
  comparison: {
    source: string | number;
    target: string | number;
    match: string;        // e.g., "±25%" or "exact" or "similar"
  };
}

// Token profile for comparison
export interface TokenProfile {
  token: string;
  symbol: string;
  name?: string;
  mcap: number;
  age: number;            // minutes since launch
  holders?: number;
  volume5m?: number;
  volume1h?: number;
  volume24h?: number;
  priceChange1h?: number;
  priceChange24h?: number;
  sectors: string[];
  narratives: string[];
  devHoldings?: number;
  topHolderPercent?: number;
  mintEnabled?: boolean;
  freezeEnabled?: boolean;
  safetyScore?: number;
  priceHistory?: PricePoint[];
  performance?: {
    roi?: number;
    athRoi?: number;
    status?: string;
  };
  signalScore?: number;
  sources?: SignalSource[];
}

// Similar token result
export interface SimilarToken {
  token: string;
  symbol: string;
  name?: string;
  overallSimilarity: number;  // 0-100
  factors: SimilarityFactor[];
  profile: TokenProfile;
  highlights: string[];       // Key similarities highlighted
  relationship: 'very-similar' | 'similar' | 'somewhat-similar';
}

// Similar tokens search result
export interface SimilaritySearchResult {
  sourceToken: string;
  sourceSymbol: string;
  sourceProfile: TokenProfile;
  similarTokens: SimilarToken[];
  totalCandidates: number;
  searchTimestamp: number;
  filters?: {
    minSimilarity?: number;
    maxResults?: number;
    sectors?: string[];
    minMcap?: number;
    maxMcap?: number;
  };
}

// Trending similar groups
export interface TrendingGroup {
  id: string;
  name: string;
  description: string;
  tokens: {
    token: string;
    symbol: string;
    similarity: number;
    mcap: number;
    change24h?: number;
  }[];
  avgSimilarity: number;
  avgChange24h: number;
  commonFactors: string[];
  momentum: 'rising' | 'stable' | 'falling';
  timestamp: number;
}

// Narrative group
export interface NarrativeGroup {
  narrative: string;
  displayName: string;
  icon: string;
  tokens: TokenProfile[];
  avgMcap: number;
  avgChange24h: number;
  topPerformer?: TokenProfile;
  momentum: 'hot' | 'warm' | 'cold';
  tokenCount: number;
}

// ============ STORAGE ============

// Token profiles cache
const tokenProfiles = new Map<string, { profile: TokenProfile; expires: number }>();
const PROFILE_TTL = 5 * 60 * 1000; // 5 minutes

// Similar tokens cache
const similarityCache = new Map<string, { result: SimilaritySearchResult; expires: number }>();
const SIMILARITY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Narrative definitions
export const NARRATIVES: Record<string, { displayName: string; icon: string; keywords: string[] }> = {
  'AI': { displayName: 'AI & Agents', icon: '🤖', keywords: ['AI', 'GPT', 'AGENT', 'BOT', 'NEURAL', 'BRAIN', 'CHAT', 'LLM', 'COGN', 'DEEP'] },
  'MEME': { displayName: 'Meme Coins', icon: '🐸', keywords: ['PEPE', 'DOGE', 'WOJAK', 'CHAD', 'BONK', 'WIF', 'CAT', 'DOG', 'FROG', 'APE'] },
  'GAMING': { displayName: 'Gaming', icon: '🎮', keywords: ['GAME', 'PLAY', 'NFT', 'PIXEL', 'QUEST', 'META', 'ARCADE', 'GUILD'] },
  'DEFI': { displayName: 'DeFi', icon: '💱', keywords: ['SWAP', 'YIELD', 'STAKE', 'LEND', 'FARM', 'VAULT', 'DEX', 'POOL'] },
  'INFRA': { displayName: 'Infrastructure', icon: '🔧', keywords: ['CHAIN', 'BRIDGE', 'ORACLE', 'NODE', 'LAYER', 'GAS', 'RPC'] },
  'SOCIAL': { displayName: 'Social', icon: '👥', keywords: ['SOCIAL', 'FREN', 'DAO', 'VOTE', 'COMMUNITY', 'FRIEND'] },
  'POLITICS': { displayName: 'Political', icon: '🏛️', keywords: ['TRUMP', 'BIDEN', 'MAGA', 'USA', 'FREEDOM', 'VOTE'] },
  'CELEBRITY': { displayName: 'Celebrity', icon: '⭐', keywords: ['ELON', 'KANYE', 'CELEB'] },
  'ANIMAL': { displayName: 'Animal', icon: '🐕', keywords: ['DOG', 'CAT', 'BIRD', 'FISH', 'BEAR', 'BULL', 'WHALE'] }
};

// ============ PROFILE BUILDING ============

/**
 * Build a token profile from signal data
 */
export function buildProfileFromSignal(signal: AggregatedSignal): TokenProfile {
  const priceHistory = tokenPriceHistory.get(signal.token);
  
  // Detect sectors and narratives from symbol/name
  const detectedSectors = detectSectors(signal.symbol, signal.name || '');
  const detectedNarratives = detectNarratives(signal.symbol, signal.name || '');
  
  return {
    token: signal.token,
    symbol: signal.symbol,
    name: signal.name,
    mcap: signal.marketData?.mcap || 0,
    age: signal.marketData?.age || 0,
    holders: signal.marketData?.holders,
    volume5m: signal.marketData?.volume5m,
    volume1h: signal.marketData?.volume1h,
    priceChange1h: signal.marketData?.priceChange1h,
    sectors: detectedSectors,
    narratives: [
      ...detectedNarratives,
      ...(signal.analysis?.narrative || [])
    ],
    devHoldings: signal.safety?.devHoldings,
    topHolderPercent: signal.safety?.topHolderPercentage,
    mintEnabled: signal.safety?.mintAuthorityEnabled,
    freezeEnabled: signal.safety?.freezeAuthorityEnabled,
    safetyScore: signal.safety?.safetyScore,
    priceHistory: priceHistory?.priceHistory,
    performance: signal.performance ? {
      roi: signal.performance.roi,
      athRoi: signal.performance.athRoi,
      status: signal.performance.status
    } : undefined,
    signalScore: signal.score,
    sources: signal.sources.map(s => s.source)
  };
}

/**
 * Detect sectors from token name/symbol
 */
function detectSectors(symbol: string, name: string): string[] {
  const text = `${symbol} ${name}`.toUpperCase();
  const detected: string[] = [];
  
  for (const [sector, config] of Object.entries(NARRATIVES)) {
    for (const keyword of config.keywords) {
      if (text.includes(keyword)) {
        if (!detected.includes(sector)) {
          detected.push(sector);
        }
        break;
      }
    }
  }
  
  return detected.length > 0 ? detected : ['OTHER'];
}

/**
 * Detect narratives from token name/symbol
 */
function detectNarratives(symbol: string, name: string): string[] {
  const text = `${symbol} ${name}`.toUpperCase();
  const narratives: string[] = [];
  
  // Common narrative patterns
  const patterns: Record<string, string[]> = {
    'pump-meta': ['PUMP', 'MOON', '100X', 'GEM'],
    'new-launch': ['FAIR', 'LAUNCH', 'STEALTH'],
    'celebrity-mention': ['ELON', 'TRUMP', 'VIRAL'],
    'ai-hype': ['GPT', 'AI', 'AGENT', 'LLM'],
    'animal-meta': ['DOG', 'CAT', 'FROG', 'PEPE'],
    'political': ['TRUMP', 'MAGA', 'FREEDOM']
  };
  
  for (const [narrative, keywords] of Object.entries(patterns)) {
    if (keywords.some(k => text.includes(k))) {
      narratives.push(narrative);
    }
  }
  
  return narratives;
}

/**
 * Get or build token profile
 */
export function getTokenProfile(token: string, signals: AggregatedSignal[]): TokenProfile | null {
  // Check cache
  const cached = tokenProfiles.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached.profile;
  }
  
  // Find signal for this token
  const signal = signals.find(s => s.token === token);
  if (!signal) return null;
  
  const profile = buildProfileFromSignal(signal);
  
  // Cache it
  tokenProfiles.set(token, {
    profile,
    expires: Date.now() + PROFILE_TTL
  });
  
  return profile;
}

// ============ SIMILARITY CALCULATION ============

/**
 * Calculate similarity score between two token profiles
 */
export function calculateSimilarity(
  source: TokenProfile,
  target: TokenProfile,
  weights: SimilarityWeights = DEFAULT_WEIGHTS
): { score: number; factors: SimilarityFactor[] } {
  const factors: SimilarityFactor[] = [];
  
  // 1. Market Cap Range (within 2x)
  const mcapFactor = calculateMcapSimilarity(source, target, weights.mcapRange);
  factors.push(mcapFactor);
  
  // 2. Token Age
  const ageFactor = calculateAgeSimilarity(source, target, weights.tokenAge);
  factors.push(ageFactor);
  
  // 3. Holder Count
  const holderFactor = calculateHolderSimilarity(source, target, weights.holderCount);
  factors.push(holderFactor);
  
  // 4. Volume Profile
  const volumeFactor = calculateVolumeSimilarity(source, target, weights.volumeProfile);
  factors.push(volumeFactor);
  
  // 5. Sector Match
  const sectorFactor = calculateSectorSimilarity(source, target, weights.sectorMatch);
  factors.push(sectorFactor);
  
  // 6. Price Pattern
  const patternFactor = calculatePatternSimilarity(source, target, weights.pricePattern);
  factors.push(patternFactor);
  
  // 7. Dev Behavior
  const devFactor = calculateDevSimilarity(source, target, weights.devBehavior);
  factors.push(devFactor);
  
  // Calculate total weighted score
  const totalScore = factors.reduce((sum, f) => sum + f.weightedScore, 0);
  
  return {
    score: Math.round(totalScore),
    factors
  };
}

/**
 * Market cap similarity (within 2x range gets high score)
 */
function calculateMcapSimilarity(source: TokenProfile, target: TokenProfile, weight: number): SimilarityFactor {
  const sourceMcap = source.mcap || 1;
  const targetMcap = target.mcap || 1;
  
  const ratio = Math.max(sourceMcap, targetMcap) / Math.min(sourceMcap, targetMcap);
  
  let score: number;
  let match: string;
  
  if (ratio <= 1.5) {
    score = 100;
    match = 'very close (±50%)';
  } else if (ratio <= 2) {
    score = 85;
    match = 'close (±2x)';
  } else if (ratio <= 3) {
    score = 60;
    match = 'similar range (±3x)';
  } else if (ratio <= 5) {
    score = 30;
    match = 'different range (±5x)';
  } else {
    score = 10;
    match = 'very different';
  }
  
  return {
    factor: 'mcapRange',
    name: 'Market Cap Range',
    score,
    weightedScore: (score * weight) / 100,
    details: `Source $${formatMcap(sourceMcap)} vs Target $${formatMcap(targetMcap)}`,
    comparison: {
      source: formatMcap(sourceMcap),
      target: formatMcap(targetMcap),
      match
    }
  };
}

/**
 * Token age similarity
 */
function calculateAgeSimilarity(source: TokenProfile, target: TokenProfile, weight: number): SimilarityFactor {
  const sourceAge = source.age || 0;
  const targetAge = target.age || 0;
  
  // Both new tokens?
  const bothNew = sourceAge < 60 && targetAge < 60;
  const bothMedium = sourceAge >= 60 && sourceAge < 1440 && targetAge >= 60 && targetAge < 1440;
  const bothOld = sourceAge >= 1440 && targetAge >= 1440;
  
  let score: number;
  let match: string;
  
  if (bothNew) {
    score = 100;
    match = 'both new (<1h)';
  } else if (bothMedium) {
    score = 90;
    match = 'both medium age (1-24h)';
  } else if (bothOld) {
    score = 80;
    match = 'both established (>24h)';
  } else {
    // Calculate ratio
    const diff = Math.abs(sourceAge - targetAge);
    const maxAge = Math.max(sourceAge, targetAge);
    const diffRatio = maxAge > 0 ? diff / maxAge : 0;
    
    if (diffRatio < 0.3) {
      score = 70;
      match = 'similar age';
    } else if (diffRatio < 0.5) {
      score = 50;
      match = 'somewhat different';
    } else {
      score = 20;
      match = 'very different ages';
    }
  }
  
  return {
    factor: 'tokenAge',
    name: 'Token Age',
    score,
    weightedScore: (score * weight) / 100,
    details: `Source ${formatAge(sourceAge)} vs Target ${formatAge(targetAge)}`,
    comparison: {
      source: formatAge(sourceAge),
      target: formatAge(targetAge),
      match
    }
  };
}

/**
 * Holder count similarity
 */
function calculateHolderSimilarity(source: TokenProfile, target: TokenProfile, weight: number): SimilarityFactor {
  const sourceHolders = source.holders || 0;
  const targetHolders = target.holders || 0;
  
  // No holder data
  if (!sourceHolders || !targetHolders) {
    return {
      factor: 'holderCount',
      name: 'Holder Count',
      score: 50, // Neutral
      weightedScore: (50 * weight) / 100,
      details: 'Holder data unavailable',
      comparison: {
        source: sourceHolders || 'N/A',
        target: targetHolders || 'N/A',
        match: 'unknown'
      }
    };
  }
  
  const ratio = Math.max(sourceHolders, targetHolders) / Math.min(sourceHolders, targetHolders);
  
  let score: number;
  let match: string;
  
  if (ratio <= 1.5) {
    score = 100;
    match = 'very similar';
  } else if (ratio <= 2) {
    score = 80;
    match = 'similar';
  } else if (ratio <= 3) {
    score = 50;
    match = 'somewhat different';
  } else {
    score = 20;
    match = 'very different';
  }
  
  return {
    factor: 'holderCount',
    name: 'Holder Count',
    score,
    weightedScore: (score * weight) / 100,
    details: `Source ${sourceHolders.toLocaleString()} vs Target ${targetHolders.toLocaleString()}`,
    comparison: {
      source: sourceHolders.toLocaleString(),
      target: targetHolders.toLocaleString(),
      match
    }
  };
}

/**
 * Volume profile similarity
 */
function calculateVolumeSimilarity(source: TokenProfile, target: TokenProfile, weight: number): SimilarityFactor {
  // Compare volume relative to mcap (volume/mcap ratio)
  const sourceRatio = source.mcap > 0 ? ((source.volume1h || 0) / source.mcap) * 100 : 0;
  const targetRatio = target.mcap > 0 ? ((target.volume1h || 0) / target.mcap) * 100 : 0;
  
  // Both high volume?
  const sourceHighVol = sourceRatio > 10;
  const targetHighVol = targetRatio > 10;
  
  let score: number;
  let match: string;
  
  if (sourceHighVol && targetHighVol) {
    score = 100;
    match = 'both high volume';
  } else if (!sourceHighVol && !targetHighVol) {
    score = 85;
    match = 'both normal volume';
  } else {
    // Compare the ratios
    const diff = Math.abs(sourceRatio - targetRatio);
    if (diff < 5) {
      score = 70;
      match = 'similar volume profile';
    } else if (diff < 15) {
      score = 40;
      match = 'different volume';
    } else {
      score = 15;
      match = 'very different volume';
    }
  }
  
  return {
    factor: 'volumeProfile',
    name: 'Volume Profile',
    score,
    weightedScore: (score * weight) / 100,
    details: `Source ${sourceRatio.toFixed(1)}% vol/mcap vs Target ${targetRatio.toFixed(1)}%`,
    comparison: {
      source: `${sourceRatio.toFixed(1)}%`,
      target: `${targetRatio.toFixed(1)}%`,
      match
    }
  };
}

/**
 * Sector/narrative similarity
 */
function calculateSectorSimilarity(source: TokenProfile, target: TokenProfile, weight: number): SimilarityFactor {
  const sourceSectors = new Set([...source.sectors, ...source.narratives]);
  const targetSectors = new Set([...target.sectors, ...target.narratives]);
  
  // Find common sectors
  const common = [...sourceSectors].filter(s => targetSectors.has(s));
  const total = new Set([...sourceSectors, ...targetSectors]).size;
  
  const overlap = total > 0 ? (common.length / total) * 100 : 0;
  
  let score: number;
  let match: string;
  
  if (overlap >= 80) {
    score = 100;
    match = 'same narrative';
  } else if (overlap >= 50) {
    score = 80;
    match = 'similar narrative';
  } else if (common.length > 0) {
    score = 50;
    match = 'some overlap';
  } else {
    score = 10;
    match = 'different narrative';
  }
  
  return {
    factor: 'sectorMatch',
    name: 'Sector/Narrative',
    score,
    weightedScore: (score * weight) / 100,
    details: common.length > 0 ? `Common: ${common.join(', ')}` : 'No common sectors',
    comparison: {
      source: [...sourceSectors].join(', ') || 'None',
      target: [...targetSectors].join(', ') || 'None',
      match
    }
  };
}

/**
 * Price pattern similarity (requires price history)
 */
function calculatePatternSimilarity(source: TokenProfile, target: TokenProfile, weight: number): SimilarityFactor {
  // Use price correlation if available
  const correlation = calculateCorrelation(source.token, target.token);
  
  if (correlation && correlation.sampleSize >= 5) {
    const coef = correlation.coefficient;
    
    let score: number;
    let match: string;
    
    if (coef >= 0.7) {
      score = 100;
      match = 'highly correlated';
    } else if (coef >= 0.5) {
      score = 80;
      match = 'moderately correlated';
    } else if (coef >= 0.3) {
      score = 60;
      match = 'weakly correlated';
    } else if (coef >= -0.3) {
      score = 40;
      match = 'no correlation';
    } else {
      score = 20;
      match = 'inversely correlated';
    }
    
    return {
      factor: 'pricePattern',
      name: 'Price Pattern',
      score,
      weightedScore: (score * weight) / 100,
      details: `Correlation: ${(coef * 100).toFixed(1)}% (${correlation.sampleSize} samples)`,
      comparison: {
        source: source.symbol,
        target: target.symbol,
        match
      }
    };
  }
  
  // Fallback: compare price changes
  const sourceChange = source.priceChange1h || 0;
  const targetChange = target.priceChange1h || 0;
  
  // Both pumping or both dumping?
  const sameDirection = (sourceChange > 0 && targetChange > 0) || (sourceChange < 0 && targetChange < 0);
  const diff = Math.abs(sourceChange - targetChange);
  
  let score: number;
  let match: string;
  
  if (sameDirection && diff < 10) {
    score = 80;
    match = 'similar movement';
  } else if (sameDirection) {
    score = 60;
    match = 'same direction';
  } else {
    score = 30;
    match = 'different direction';
  }
  
  return {
    factor: 'pricePattern',
    name: 'Price Pattern',
    score,
    weightedScore: (score * weight) / 100,
    details: `Source ${sourceChange > 0 ? '+' : ''}${sourceChange.toFixed(1)}% vs Target ${targetChange > 0 ? '+' : ''}${targetChange.toFixed(1)}%`,
    comparison: {
      source: `${sourceChange > 0 ? '+' : ''}${sourceChange.toFixed(1)}%`,
      target: `${targetChange > 0 ? '+' : ''}${targetChange.toFixed(1)}%`,
      match
    }
  };
}

/**
 * Dev wallet behavior similarity
 */
function calculateDevSimilarity(source: TokenProfile, target: TokenProfile, weight: number): SimilarityFactor {
  const sourceDevHoldings = source.devHoldings || 0;
  const targetDevHoldings = target.devHoldings || 0;
  const sourceSafety = source.safetyScore || 50;
  const targetSafety = target.safetyScore || 50;
  
  // Compare dev holdings
  const devDiff = Math.abs(sourceDevHoldings - targetDevHoldings);
  
  // Compare safety scores
  const safetyDiff = Math.abs(sourceSafety - targetSafety);
  
  // Compare authority flags
  const sameAuthorities = (source.mintEnabled === target.mintEnabled) && 
                          (source.freezeEnabled === target.freezeEnabled);
  
  let score = 50; // Base score
  let reasons: string[] = [];
  
  // Dev holdings similarity
  if (devDiff < 5) {
    score += 20;
    reasons.push('similar dev holdings');
  } else if (devDiff < 15) {
    score += 10;
  }
  
  // Safety score similarity
  if (safetyDiff < 10) {
    score += 20;
    reasons.push('similar safety');
  } else if (safetyDiff < 25) {
    score += 10;
  }
  
  // Authority flags match
  if (sameAuthorities) {
    score += 10;
    reasons.push('same authority status');
  }
  
  const match = reasons.length > 0 ? reasons.join(', ') : 'somewhat similar';
  
  return {
    factor: 'devBehavior',
    name: 'Dev Behavior',
    score: Math.min(100, score),
    weightedScore: (Math.min(100, score) * weight) / 100,
    details: `Dev: ${sourceDevHoldings.toFixed(1)}% vs ${targetDevHoldings.toFixed(1)}%, Safety: ${sourceSafety} vs ${targetSafety}`,
    comparison: {
      source: `${sourceDevHoldings.toFixed(1)}% dev, ${sourceSafety} safety`,
      target: `${targetDevHoldings.toFixed(1)}% dev, ${targetSafety} safety`,
      match
    }
  };
}

// ============ MAIN SEARCH FUNCTIONS ============

/**
 * Find tokens similar to a given token
 */
export function findSimilarTokens(
  sourceToken: string,
  signals: AggregatedSignal[],
  options: {
    minSimilarity?: number;
    maxResults?: number;
    sectors?: string[];
    minMcap?: number;
    maxMcap?: number;
    weights?: SimilarityWeights;
  } = {}
): SimilaritySearchResult {
  const {
    minSimilarity = 40,
    maxResults = 10,
    sectors,
    minMcap,
    maxMcap,
    weights = DEFAULT_WEIGHTS
  } = options;
  
  // Check cache
  const cacheKey = `${sourceToken}-${minSimilarity}-${maxResults}`;
  const cached = similarityCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }
  
  // Get source profile
  const sourceSignal = signals.find(s => s.token === sourceToken);
  if (!sourceSignal) {
    throw new Error(`Source token ${sourceToken} not found`);
  }
  
  const sourceProfile = buildProfileFromSignal(sourceSignal);
  
  // Build candidates list
  let candidates = signals.filter(s => s.token !== sourceToken);
  
  // Apply filters
  if (sectors && sectors.length > 0) {
    candidates = candidates.filter(s => {
      const profile = buildProfileFromSignal(s);
      return profile.sectors.some(sec => sectors.includes(sec));
    });
  }
  
  if (minMcap !== undefined) {
    candidates = candidates.filter(s => (s.marketData?.mcap || 0) >= minMcap);
  }
  
  if (maxMcap !== undefined) {
    candidates = candidates.filter(s => (s.marketData?.mcap || 0) <= maxMcap);
  }
  
  // Calculate similarity for each candidate
  const similarTokens: SimilarToken[] = [];
  
  for (const candidate of candidates) {
    const targetProfile = buildProfileFromSignal(candidate);
    const { score, factors } = calculateSimilarity(sourceProfile, targetProfile, weights);
    
    if (score >= minSimilarity) {
      // Generate highlights (top 3 matching factors)
      const highlights = factors
        .filter(f => f.score >= 70)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(f => `${f.name}: ${f.comparison.match}`);
      
      // Determine relationship
      let relationship: SimilarToken['relationship'];
      if (score >= 80) {
        relationship = 'very-similar';
      } else if (score >= 60) {
        relationship = 'similar';
      } else {
        relationship = 'somewhat-similar';
      }
      
      similarTokens.push({
        token: candidate.token,
        symbol: candidate.symbol,
        name: candidate.name,
        overallSimilarity: score,
        factors,
        profile: targetProfile,
        highlights,
        relationship
      });
    }
  }
  
  // Sort by similarity and limit
  similarTokens.sort((a, b) => b.overallSimilarity - a.overallSimilarity);
  const limited = similarTokens.slice(0, maxResults);
  
  const result: SimilaritySearchResult = {
    sourceToken,
    sourceSymbol: sourceProfile.symbol,
    sourceProfile,
    similarTokens: limited,
    totalCandidates: candidates.length,
    searchTimestamp: Date.now(),
    filters: { minSimilarity, maxResults, sectors, minMcap, maxMcap }
  };
  
  // Cache result
  similarityCache.set(cacheKey, {
    result,
    expires: Date.now() + SIMILARITY_CACHE_TTL
  });
  
  return result;
}

/**
 * Get detailed similarity factors between two tokens
 */
export function getSimilarityFactors(
  sourceToken: string,
  targetToken: string,
  signals: AggregatedSignal[],
  weights: SimilarityWeights = DEFAULT_WEIGHTS
): { similarity: number; factors: SimilarityFactor[] } | null {
  const sourceSignal = signals.find(s => s.token === sourceToken);
  const targetSignal = signals.find(s => s.token === targetToken);
  
  if (!sourceSignal || !targetSignal) {
    return null;
  }
  
  const sourceProfile = buildProfileFromSignal(sourceSignal);
  const targetProfile = buildProfileFromSignal(targetSignal);
  
  const { score, factors } = calculateSimilarity(sourceProfile, targetProfile, weights);
  
  return {
    similarity: score,
    factors
  };
}

/**
 * Get trending similar groups (tokens that moved together)
 */
export function getTrendingSimilarGroups(
  signals: AggregatedSignal[],
  limit: number = 5
): TrendingGroup[] {
  const groups: TrendingGroup[] = [];
  const processedTokens = new Set<string>();
  
  // Sort signals by recent activity
  const recentSignals = [...signals]
    .filter(s => Date.now() - s.timestamp < 24 * 60 * 60 * 1000) // Last 24h
    .sort((a, b) => b.score - a.score);
  
  for (const signal of recentSignals) {
    if (processedTokens.has(signal.token)) continue;
    
    // Find similar tokens
    try {
      const result = findSimilarTokens(signal.token, signals, {
        minSimilarity: 60,
        maxResults: 5
      });
      
      if (result.similarTokens.length >= 2) {
        const groupTokens = [
          {
            token: signal.token,
            symbol: signal.symbol,
            similarity: 100,
            mcap: signal.marketData?.mcap || 0,
            change24h: signal.marketData?.priceChange1h
          },
          ...result.similarTokens.map(st => ({
            token: st.token,
            symbol: st.symbol,
            similarity: st.overallSimilarity,
            mcap: st.profile.mcap,
            change24h: st.profile.priceChange1h
          }))
        ];
        
        // Mark all as processed
        groupTokens.forEach(t => processedTokens.add(t.token));
        
        // Calculate group stats
        const avgSimilarity = groupTokens.reduce((sum, t) => sum + t.similarity, 0) / groupTokens.length;
        const avgChange = groupTokens.reduce((sum, t) => sum + (t.change24h || 0), 0) / groupTokens.length;
        
        // Find common factors
        const commonFactors = findCommonFactors(result.sourceProfile, result.similarTokens);
        
        groups.push({
          id: `group-${signal.token.slice(0, 8)}`,
          name: `${signal.symbol} Group`,
          description: `Tokens similar to ${signal.symbol}`,
          tokens: groupTokens,
          avgSimilarity,
          avgChange24h: avgChange,
          commonFactors,
          momentum: avgChange > 10 ? 'rising' : avgChange < -10 ? 'falling' : 'stable',
          timestamp: Date.now()
        });
      }
    } catch (e) {
      // Skip if error
    }
    
    if (groups.length >= limit) break;
  }
  
  return groups.sort((a, b) => b.avgSimilarity - a.avgSimilarity);
}

/**
 * Group tokens by narrative
 */
export function getTokensByNarrative(signals: AggregatedSignal[]): NarrativeGroup[] {
  const narrativeGroups = new Map<string, TokenProfile[]>();
  
  // Initialize all narratives
  for (const narrative of Object.keys(NARRATIVES)) {
    narrativeGroups.set(narrative, []);
  }
  narrativeGroups.set('OTHER', []);
  
  // Categorize tokens
  for (const signal of signals) {
    const profile = buildProfileFromSignal(signal);
    
    if (profile.sectors.length === 0 || (profile.sectors.length === 1 && profile.sectors[0] === 'OTHER')) {
      narrativeGroups.get('OTHER')!.push(profile);
    } else {
      for (const sector of profile.sectors) {
        if (narrativeGroups.has(sector)) {
          narrativeGroups.get(sector)!.push(profile);
        }
      }
    }
  }
  
  // Build narrative group results
  const results: NarrativeGroup[] = [];
  
  for (const [narrative, tokens] of narrativeGroups) {
    if (tokens.length === 0) continue;
    
    const config = NARRATIVES[narrative] || { displayName: 'Other', icon: '❓', keywords: [] };
    
    const avgMcap = tokens.reduce((sum, t) => sum + t.mcap, 0) / tokens.length;
    const avgChange = tokens.reduce((sum, t) => sum + (t.priceChange1h || 0), 0) / tokens.length;
    
    // Find top performer
    const topPerformer = tokens
      .filter(t => t.performance?.roi !== undefined)
      .sort((a, b) => (b.performance?.roi || 0) - (a.performance?.roi || 0))[0];
    
    // Determine momentum
    let momentum: NarrativeGroup['momentum'];
    if (avgChange > 20) {
      momentum = 'hot';
    } else if (avgChange > 0) {
      momentum = 'warm';
    } else {
      momentum = 'cold';
    }
    
    results.push({
      narrative,
      displayName: config.displayName,
      icon: config.icon,
      tokens,
      avgMcap,
      avgChange24h: avgChange,
      topPerformer,
      momentum,
      tokenCount: tokens.length
    });
  }
  
  return results.sort((a, b) => b.tokenCount - a.tokenCount);
}

// ============ HELPER FUNCTIONS ============

/**
 * Find common factors between source and similar tokens
 */
function findCommonFactors(source: TokenProfile, similarTokens: SimilarToken[]): string[] {
  const factors: string[] = [];
  
  // Check sectors
  const commonSectors = source.sectors.filter(s => 
    similarTokens.every(st => st.profile.sectors.includes(s))
  );
  if (commonSectors.length > 0) {
    factors.push(`Same sector: ${commonSectors.join(', ')}`);
  }
  
  // Check mcap range
  const mcaps = [source.mcap, ...similarTokens.map(st => st.profile.mcap)];
  const minMcap = Math.min(...mcaps);
  const maxMcap = Math.max(...mcaps);
  if (maxMcap / minMcap <= 3) {
    factors.push(`Similar mcap range: $${formatMcap(minMcap)}-$${formatMcap(maxMcap)}`);
  }
  
  // Check age
  const ages = [source.age, ...similarTokens.map(st => st.profile.age)];
  const allNew = ages.every(a => a < 60);
  if (allNew) {
    factors.push('All new launches (<1h)');
  }
  
  return factors;
}

/**
 * Format market cap for display
 */
function formatMcap(mcap: number): string {
  if (mcap >= 1e9) {
    return `${(mcap / 1e9).toFixed(2)}B`;
  } else if (mcap >= 1e6) {
    return `${(mcap / 1e6).toFixed(2)}M`;
  } else if (mcap >= 1e3) {
    return `${(mcap / 1e3).toFixed(1)}K`;
  }
  return mcap.toFixed(0);
}

/**
 * Format age for display
 */
function formatAge(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  } else if (minutes < 1440) {
    return `${Math.floor(minutes / 60)}h`;
  } else {
    return `${Math.floor(minutes / 1440)}d`;
  }
}

// ============ CACHE MANAGEMENT ============

/**
 * Clear similarity cache
 */
export function clearSimilarityCache(): void {
  similarityCache.clear();
  tokenProfiles.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): { profiles: number; searches: number } {
  return {
    profiles: tokenProfiles.size,
    searches: similarityCache.size
  };
}

// ============ EXPORTS ============

export {
  tokenProfiles,
  similarityCache
};
