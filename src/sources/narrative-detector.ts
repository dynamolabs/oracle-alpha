import { RawSignal } from '../types';

// Narrative Detection Engine
// Identifies trending narratives and tokens associated with them

interface Narrative {
  id: string;
  name: string;
  keywords: string[];
  strength: number; // 0-1, how hot is this narrative
  startDate?: number;
  peakMultiplier?: number;
}

// Current meta narratives (update periodically)
const ACTIVE_NARRATIVES: Narrative[] = [
  {
    id: 'ai-agents',
    name: 'AI Agents',
    keywords: ['ai', 'agent', 'gpt', 'llm', 'claude', 'autonomous', 'swarm', 'neural'],
    strength: 0.95,
    peakMultiplier: 100
  },
  {
    id: 'depin',
    name: 'DePIN',
    keywords: ['depin', 'iot', 'sensor', 'network', 'infrastructure', 'node', 'compute'],
    strength: 0.75,
    peakMultiplier: 50
  },
  {
    id: 'memes',
    name: 'Memecoin Meta',
    keywords: ['doge', 'pepe', 'shib', 'meme', 'wojak', 'chad', 'frog', 'cat', 'dog'],
    strength: 0.90,
    peakMultiplier: 1000
  },
  {
    id: 'rwa',
    name: 'Real World Assets',
    keywords: ['rwa', 'real world', 'tokenized', 'treasury', 'bond', 'estate'],
    strength: 0.60,
    peakMultiplier: 20
  },
  {
    id: 'gaming',
    name: 'Gaming/GameFi',
    keywords: ['game', 'gaming', 'play', 'nft', 'metaverse', 'p2e', 'gamefi'],
    strength: 0.55,
    peakMultiplier: 30
  },
  {
    id: 'l2-scaling',
    name: 'L2/Scaling',
    keywords: ['l2', 'layer2', 'rollup', 'zk', 'optimistic', 'scaling', 'base'],
    strength: 0.65,
    peakMultiplier: 25
  },
  {
    id: 'trump',
    name: 'Trump/Political',
    keywords: ['trump', 'maga', 'political', 'election', 'president', 'america'],
    strength: 0.85,
    peakMultiplier: 500
  },
  {
    id: 'anime',
    name: 'Anime/Weeb',
    keywords: ['anime', 'waifu', 'manga', 'otaku', 'kawaii', 'senpai', 'chan'],
    strength: 0.70,
    peakMultiplier: 200
  },
];

interface TokenData {
  address: string;
  symbol: string;
  name: string;
  description?: string;
  marketCap?: number;
  volume24h?: number;
  priceChange24h?: number;
  createdAt?: number;
}

// Detect which narratives a token fits into
function detectNarratives(token: TokenData): Narrative[] {
  const matches: Narrative[] = [];
  const searchText = `${token.name} ${token.symbol} ${token.description || ''}`.toLowerCase();

  for (const narrative of ACTIVE_NARRATIVES) {
    const matchCount = narrative.keywords.filter(kw => searchText.includes(kw)).length;
    if (matchCount >= 1) {
      matches.push({
        ...narrative,
        strength: narrative.strength * (matchCount / narrative.keywords.length + 0.5)
      });
    }
  }

  return matches.sort((a, b) => b.strength - a.strength);
}

// Calculate narrative score for a token
function calculateNarrativeScore(token: TokenData, narratives: Narrative[]): number {
  if (narratives.length === 0) return 0;

  // Base score from strongest narrative match
  let score = narratives[0].strength * 50;

  // Bonus for multiple narrative matches (crossover potential)
  if (narratives.length > 1) {
    score += narratives.length * 10;
  }

  // Bonus for early stage (low mcap = more upside)
  if (token.marketCap && token.marketCap < 100000) {
    score += 20; // Very early
  } else if (token.marketCap && token.marketCap < 1000000) {
    score += 10; // Early
  }

  // Bonus for momentum
  if (token.priceChange24h && token.priceChange24h > 50) {
    score += 15;
  }

  return Math.min(100, Math.round(score));
}

// Fetch new tokens and analyze narratives
async function fetchNewTokens(): Promise<TokenData[]> {
  try {
    // Use DexScreener's new pairs endpoint instead of pump.fun
    const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/solana?order=createdAt');
    
    if (!response.ok) {
      // Fallback: use boosted tokens
      const fallback = await fetch('https://api.dexscreener.com/token-boosts/latest/v1');
      const data = await fallback.json();
      return data
        .filter((t: any) => t.chainId === 'solana')
        .slice(0, 50)
        .map((t: any) => ({
          address: t.tokenAddress,
          symbol: t.symbol || 'UNKNOWN',
          name: t.description || t.symbol || 'Unknown',
          marketCap: t.marketCap || 0
        }));
    }
    
    const data = await response.json();
    return (data.pairs || [])
      .filter((p: any) => p.chainId === 'solana')
      .slice(0, 50)
      .map((p: any) => ({
        address: p.baseToken?.address,
        symbol: p.baseToken?.symbol || 'UNKNOWN',
        name: p.baseToken?.name || 'Unknown',
        marketCap: p.marketCap || 0,
        volume24h: p.volume?.h24,
        priceChange24h: p.priceChange?.h24
      }));
  } catch (error) {
    console.error('[NARRATIVE] Error fetching new tokens:', error);
    return [];
  }
}

// Fetch trending tokens to analyze
async function fetchTrendingForNarrative(): Promise<TokenData[]> {
  try {
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    const data = await response.json();
    
    return data
      .filter((t: any) => t.chainId === 'solana')
      .slice(0, 30)
      .map((t: any) => ({
        address: t.tokenAddress,
        symbol: t.symbol || 'UNKNOWN',
        name: t.description || t.symbol || 'Unknown',
        marketCap: t.marketCap,
        volume24h: t.volume?.h24,
        priceChange24h: t.priceChange?.h24
      }));
  } catch (error) {
    console.error('[NARRATIVE] Error fetching trending:', error);
    return [];
  }
}

// Main scan function
export async function scanNarratives(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[NARRATIVE] Scanning for narrative plays...');

  // Scan new tokens
  const newTokens = await fetchNewTokens();
  console.log(`[NARRATIVE] Analyzing ${newTokens.length} new tokens...`);

  for (const token of newTokens) {
    const narratives = detectNarratives(token);
    
    if (narratives.length > 0) {
      const score = calculateNarrativeScore(token, narratives);
      
      // Only signal if strong narrative match
      if (score >= 50) {
        signals.push({
          source: 'narrative-new',
          timestamp: now,
          token: token.address,
          symbol: token.symbol,
          name: token.name,
          action: 'BUY',
          confidence: score,
          metadata: {
            narratives: narratives.map(n => n.name),
            primaryNarrative: narratives[0].name,
            narrativeStrength: narratives[0].strength,
            marketCap: token.marketCap,
            description: token.description?.slice(0, 200)
          }
        });
      }
    }
  }

  // Scan trending tokens for narrative momentum
  const trendingTokens = await fetchTrendingForNarrative();
  console.log(`[NARRATIVE] Analyzing ${trendingTokens.length} trending tokens...`);

  for (const token of trendingTokens) {
    const narratives = detectNarratives(token);
    
    if (narratives.length > 0 && narratives[0].strength > 0.7) {
      const score = calculateNarrativeScore(token, narratives);
      
      // Trending + strong narrative = momentum play
      if (score >= 40 && token.priceChange24h && token.priceChange24h > 20) {
        signals.push({
          source: 'narrative-momentum',
          timestamp: now,
          token: token.address,
          symbol: token.symbol,
          name: token.name,
          action: 'BUY',
          confidence: Math.min(100, score + 10), // Bonus for momentum
          metadata: {
            narratives: narratives.map(n => n.name),
            primaryNarrative: narratives[0].name,
            priceChange24h: token.priceChange24h,
            volume24h: token.volume24h,
            marketCap: token.marketCap
          }
        });
      }
    }
  }

  console.log(`[NARRATIVE] Found ${signals.length} narrative signals`);
  return signals;
}

// Utility: Get current hot narratives
export function getHotNarratives(): Narrative[] {
  return ACTIVE_NARRATIVES
    .filter(n => n.strength >= 0.7)
    .sort((a, b) => b.strength - a.strength);
}

export { ACTIVE_NARRATIVES, detectNarratives, calculateNarrativeScore };
