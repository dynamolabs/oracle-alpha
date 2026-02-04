import { RawSignal } from '../types';

// Enhanced Narrative Detection Engine
// Identifies trending narratives with improved keyword matching

interface Narrative {
  id: string;
  name: string;
  keywords: string[];
  antiKeywords?: string[]; // Words that disqualify
  strength: number; // 0-1, how hot is this narrative
  category: 'tech' | 'meme' | 'defi' | 'culture' | 'utility';
  peakMultiplier?: number;
  trending?: boolean; // Currently trending
}

// Comprehensive meta narratives (regularly update based on market)
const ACTIVE_NARRATIVES: Narrative[] = [
  // === TECH NARRATIVES ===
  {
    id: 'ai-agents',
    name: 'AI Agents',
    keywords: ['ai', 'agent', 'gpt', 'llm', 'claude', 'autonomous', 'swarm', 'neural', 'agi', 'sentient', 'brain', 'cognitive', 'eliza', 'virtuals', 'ai16z'],
    strength: 0.95,
    category: 'tech',
    peakMultiplier: 100,
    trending: true
  },
  {
    id: 'depin',
    name: 'DePIN',
    keywords: ['depin', 'iot', 'sensor', 'network', 'infrastructure', 'node', 'compute', 'render', 'helium', 'hivemapper', 'bandwidth'],
    strength: 0.75,
    category: 'tech',
    peakMultiplier: 50
  },
  {
    id: 'rwa',
    name: 'Real World Assets',
    keywords: ['rwa', 'real world', 'tokenized', 'treasury', 'bond', 'estate', 'property', 'commodity', 'gold', 'backed'],
    strength: 0.68,
    category: 'tech',
    peakMultiplier: 30
  },
  {
    id: 'data-ai',
    name: 'AI Data/Training',
    keywords: ['data', 'training', 'dataset', 'label', 'annotation', 'scrape', 'index', 'knowledge'],
    antiKeywords: ['trading data'],
    strength: 0.72,
    category: 'tech',
    peakMultiplier: 40
  },
  {
    id: 'zk-privacy',
    name: 'ZK/Privacy',
    keywords: ['zk', 'zero knowledge', 'privacy', 'private', 'anonymous', 'mixer', 'stealth', 'confidential'],
    strength: 0.55,
    category: 'tech',
    peakMultiplier: 25
  },
  
  // === MEME NARRATIVES ===
  {
    id: 'memes',
    name: 'Memecoin Meta',
    keywords: ['doge', 'pepe', 'shib', 'meme', 'wojak', 'chad', 'frog', 'cat', 'dog', 'inu', 'wif', 'bonk', 'popcat', 'mog'],
    strength: 0.92,
    category: 'meme',
    peakMultiplier: 1000,
    trending: true
  },
  {
    id: 'trump',
    name: 'Trump/Political',
    keywords: ['trump', 'maga', 'political', 'election', 'president', 'america', 'potus', 'donald', 'melania', 'barron'],
    strength: 0.88,
    category: 'culture',
    peakMultiplier: 500,
    trending: true
  },
  {
    id: 'anime',
    name: 'Anime/Weeb',
    keywords: ['anime', 'waifu', 'manga', 'otaku', 'kawaii', 'senpai', 'chan', 'kun', 'sama', 'neko', 'uwu'],
    strength: 0.70,
    category: 'meme',
    peakMultiplier: 200
  },
  {
    id: 'celebrity',
    name: 'Celebrity',
    keywords: ['elon', 'musk', 'drake', 'kanye', 'celebrity', 'famous', 'rapper', 'artist', 'influencer'],
    strength: 0.75,
    category: 'culture',
    peakMultiplier: 300
  },
  {
    id: 'food',
    name: 'Food Memes',
    keywords: ['pizza', 'burger', 'sushi', 'taco', 'food', 'hungry', 'cook', 'chef', 'eat', 'delicious'],
    strength: 0.50,
    category: 'meme',
    peakMultiplier: 100
  },
  
  // === GAMING NARRATIVES ===
  {
    id: 'gaming',
    name: 'Gaming/GameFi',
    keywords: ['game', 'gaming', 'play', 'nft', 'metaverse', 'p2e', 'gamefi', 'esports', 'guild', 'rpg', 'mmorpg'],
    strength: 0.62,
    category: 'utility',
    peakMultiplier: 40
  },
  {
    id: 'virtual-worlds',
    name: 'Virtual Worlds',
    keywords: ['metaverse', 'virtual', 'world', 'sandbox', 'land', 'avatar', '3d', 'vr', 'ar'],
    strength: 0.45,
    category: 'utility',
    peakMultiplier: 25
  },
  
  // === DEFI NARRATIVES ===
  {
    id: 'yield',
    name: 'Yield/Staking',
    keywords: ['yield', 'stake', 'staking', 'apy', 'apr', 'earn', 'vault', 'farm', 'compound', 'restake'],
    strength: 0.58,
    category: 'defi',
    peakMultiplier: 20
  },
  {
    id: 'perps-dex',
    name: 'Perps/DEX',
    keywords: ['perp', 'perpetual', 'leverage', 'dex', 'swap', 'exchange', 'orderbook', 'clob', 'amm'],
    strength: 0.65,
    category: 'defi',
    peakMultiplier: 30
  },
  {
    id: 'lending',
    name: 'Lending/Borrowing',
    keywords: ['lend', 'borrow', 'loan', 'collateral', 'cdp', 'liquidation', 'margin'],
    strength: 0.52,
    category: 'defi',
    peakMultiplier: 15
  },
  {
    id: 'liquid-staking',
    name: 'Liquid Staking',
    keywords: ['liquid staking', 'lst', 'msol', 'jitosol', 'bsol', 'marinade', 'lido'],
    strength: 0.60,
    category: 'defi',
    peakMultiplier: 25
  },
  
  // === CULTURE NARRATIVES ===
  {
    id: 'solana-ecosystem',
    name: 'Solana Ecosystem',
    keywords: ['solana', 'sol', 'phantom', 'jupiter', 'raydium', 'marinade', 'jito', 'drift', 'pyth'],
    strength: 0.70,
    category: 'utility',
    peakMultiplier: 30
  },
  {
    id: 'base-ecosystem',
    name: 'Base Ecosystem',
    keywords: ['base', 'coinbase', 'onchain summer', 'based', 'friend.tech'],
    strength: 0.65,
    category: 'utility',
    peakMultiplier: 25
  },
  {
    id: 'viral-social',
    name: 'Viral/Social',
    keywords: ['viral', 'tiktok', 'twitter', 'trend', 'meme', 'social', 'community', 'ct', 'crypto twitter'],
    strength: 0.72,
    category: 'culture',
    peakMultiplier: 200
  },
  {
    id: 'ordinals-brc20',
    name: 'Ordinals/BRC-20',
    keywords: ['ordinal', 'brc20', 'inscription', 'rune', 'bitcoin nft'],
    strength: 0.48,
    category: 'tech',
    peakMultiplier: 20
  },
  
  // === SPECIAL EVENTS ===
  {
    id: 'airdrop',
    name: 'Airdrop Plays',
    keywords: ['airdrop', 'drop', 'claim', 'points', 'farming', 'testnet', 'early adopter'],
    strength: 0.78,
    category: 'utility',
    peakMultiplier: 50
  },
  {
    id: 'launchpad',
    name: 'Launchpad/IDO',
    keywords: ['launchpad', 'ido', 'presale', 'sale', 'launch', 'fair launch', 'stealth'],
    strength: 0.68,
    category: 'utility',
    peakMultiplier: 40
  }
];

interface TokenData {
  address: string;
  symbol: string;
  name: string;
  description?: string;
  marketCap?: number;
  volume24h?: number;
  priceChange24h?: number;
  priceChange5m?: number;
  createdAt?: number;
  holders?: number;
  website?: string;
  twitter?: string;
}

// Improved narrative detection with scoring
function detectNarratives(token: TokenData): { narrative: Narrative; matchScore: number }[] {
  const matches: { narrative: Narrative; matchScore: number }[] = [];
  const searchText = `${token.name} ${token.symbol} ${token.description || ''} ${token.website || ''} ${token.twitter || ''}`.toLowerCase();

  for (const narrative of ACTIVE_NARRATIVES) {
    // Check anti-keywords first
    if (narrative.antiKeywords?.some(kw => searchText.includes(kw))) {
      continue;
    }
    
    // Count keyword matches with weighting
    let matchScore = 0;
    let matchedKeywords = 0;
    
    for (const kw of narrative.keywords) {
      if (searchText.includes(kw)) {
        matchedKeywords++;
        // Weight longer/more specific keywords higher
        matchScore += kw.length > 4 ? 2 : 1;
      }
    }
    
    if (matchedKeywords >= 1) {
      // Normalize score
      const normalizedScore = matchScore / (narrative.keywords.length * 1.5);
      const finalScore = Math.min(1, normalizedScore) * narrative.strength;
      
      // Boost trending narratives
      const trendingBoost = narrative.trending ? 1.15 : 1;
      
      matches.push({
        narrative: { ...narrative, strength: narrative.strength * trendingBoost },
        matchScore: finalScore * trendingBoost
      });
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

// Enhanced scoring with more factors
function calculateNarrativeScore(token: TokenData, matches: { narrative: Narrative; matchScore: number }[]): number {
  if (matches.length === 0) return 0;

  // Base score from best match
  let score = matches[0].matchScore * 55;

  // Multiple narrative bonus (crossover potential)
  if (matches.length > 1) {
    score += Math.min(20, matches.length * 7);
  }

  // Category bonuses
  const primaryCategory = matches[0].narrative.category;
  if (primaryCategory === 'meme' && token.priceChange5m && token.priceChange5m > 10) {
    score += 10; // Meme momentum
  }
  if (primaryCategory === 'tech' && matches[0].narrative.trending) {
    score += 8; // Trending tech
  }

  // Market cap tiers
  if (token.marketCap) {
    if (token.marketCap < 50000) score += 25; // Micro cap
    else if (token.marketCap < 100000) score += 20; // Very early
    else if (token.marketCap < 500000) score += 15; // Early
    else if (token.marketCap < 1000000) score += 10; // Growing
    else if (token.marketCap < 5000000) score += 5; // Established low
  }

  // Momentum bonuses
  if (token.priceChange24h && token.priceChange24h > 100) {
    score += 15; // Strong momentum
  } else if (token.priceChange24h && token.priceChange24h > 50) {
    score += 10;
  } else if (token.priceChange24h && token.priceChange24h > 20) {
    score += 5;
  }

  // Volume bonus
  if (token.volume24h && token.marketCap) {
    const volumeToMcap = token.volume24h / token.marketCap;
    if (volumeToMcap > 1) score += 10; // Very high volume
    else if (volumeToMcap > 0.5) score += 5;
  }

  // Freshness bonus
  if (token.createdAt) {
    const ageHours = (Date.now() - token.createdAt) / (1000 * 60 * 60);
    if (ageHours < 1) score += 15; // Very fresh
    else if (ageHours < 6) score += 10;
    else if (ageHours < 24) score += 5;
  }

  return Math.min(100, Math.round(score));
}

// Fetch new tokens with metadata
async function fetchNewTokens(): Promise<TokenData[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    // Try multiple sources
    const tokens: TokenData[] = [];
    
    // Source 1: DexScreener boosted
    try {
      const response = await fetch('https://api.dexscreener.com/token-boosts/latest/v1', {
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        tokens.push(...data
          .filter((t: any) => t.chainId === 'solana')
          .slice(0, 30)
          .map((t: any) => ({
            address: t.tokenAddress,
            symbol: t.symbol || 'UNKNOWN',
            name: t.description || t.symbol || 'Unknown',
            description: t.description,
            marketCap: t.marketCap || 0,
            website: t.links?.find((l: any) => l.type === 'website')?.url,
            twitter: t.links?.find((l: any) => l.type === 'twitter')?.url
          })));
      }
    } catch (e) {
      // Fallback
    }
    
    // Source 2: Top boosted for comparison
    try {
      const topResponse = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
      if (topResponse.ok) {
        const topData = await topResponse.json();
        
        // Add tokens not already in list
        for (const t of topData.filter((t: any) => t.chainId === 'solana').slice(0, 20)) {
          if (!tokens.find(existing => existing.address === t.tokenAddress)) {
            tokens.push({
              address: t.tokenAddress,
              symbol: t.symbol || 'UNKNOWN',
              name: t.description || t.symbol || 'Unknown',
              description: t.description,
              marketCap: t.marketCap || 0
            });
          }
        }
      }
    } catch (e) {
      // Continue
    }
    
    return tokens;
  } catch (error) {
    console.error('[NARRATIVE] Error fetching tokens:', error);
    return [];
  }
}

// Fetch trending tokens with more detail
async function fetchTrendingForNarrative(): Promise<TokenData[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await response.json();
    
    const tokens: TokenData[] = [];
    const solanaTokens = data.filter((t: any) => t.chainId === 'solana').slice(0, 25);
    
    // Enrich with pair data
    for (const t of solanaTokens) {
      try {
        const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`);
        const pairData = await pairRes.json();
        const pair = pairData.pairs?.[0];
        
        tokens.push({
          address: t.tokenAddress,
          symbol: pair?.baseToken?.symbol || t.symbol || 'UNKNOWN',
          name: pair?.baseToken?.name || t.description || 'Unknown',
          description: t.description,
          marketCap: pair?.fdv || pair?.marketCap || 0,
          volume24h: pair?.volume?.h24,
          priceChange24h: pair?.priceChange?.h24,
          priceChange5m: pair?.priceChange?.m5,
          createdAt: pair?.pairCreatedAt
        });
      } catch {
        tokens.push({
          address: t.tokenAddress,
          symbol: t.symbol || 'UNKNOWN',
          name: t.description || 'Unknown',
          marketCap: t.marketCap
        });
      }
    }
    
    return tokens;
  } catch (error) {
    console.error('[NARRATIVE] Error fetching trending:', error);
    return [];
  }
}

// Main scan function
export async function scanNarratives(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();
  const seenTokens = new Set<string>();

  console.log('[NARRATIVE] Scanning for narrative plays...');

  // Scan new tokens
  const newTokens = await fetchNewTokens();
  console.log(`[NARRATIVE] Analyzing ${newTokens.length} new tokens...`);

  for (const token of newTokens) {
    if (seenTokens.has(token.address)) continue;
    seenTokens.add(token.address);
    
    const matches = detectNarratives(token);
    
    if (matches.length > 0) {
      const score = calculateNarrativeScore(token, matches);
      
      // Signal if good narrative match
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
            narratives: matches.map(m => m.narrative.name),
            primaryNarrative: matches[0].narrative.name,
            narrativeStrength: matches[0].matchScore.toFixed(2),
            category: matches[0].narrative.category,
            trending: matches[0].narrative.trending || false,
            marketCap: token.marketCap,
            description: token.description?.slice(0, 200),
            matchCount: matches.length
          }
        });
      }
    }
  }

  // Scan trending tokens for momentum plays
  const trendingTokens = await fetchTrendingForNarrative();
  console.log(`[NARRATIVE] Analyzing ${trendingTokens.length} trending tokens...`);

  for (const token of trendingTokens) {
    if (seenTokens.has(token.address)) continue;
    seenTokens.add(token.address);
    
    const matches = detectNarratives(token);
    
    if (matches.length > 0 && matches[0].matchScore > 0.5) {
      const score = calculateNarrativeScore(token, matches);
      
      // Momentum play: trending + strong narrative + price action
      const hasGoodMomentum = token.priceChange24h && token.priceChange24h > 15;
      const hasGoodScore = score >= 45;
      
      if (hasGoodMomentum && hasGoodScore) {
        signals.push({
          source: 'narrative-momentum',
          timestamp: now,
          token: token.address,
          symbol: token.symbol,
          name: token.name,
          action: 'BUY',
          confidence: Math.min(100, score + 10), // Momentum bonus
          metadata: {
            narratives: matches.map(m => m.narrative.name),
            primaryNarrative: matches[0].narrative.name,
            category: matches[0].narrative.category,
            priceChange24h: token.priceChange24h,
            priceChange5m: token.priceChange5m,
            volume24h: token.volume24h,
            marketCap: token.marketCap,
            matchCount: matches.length
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
    .filter(n => n.strength >= 0.65 || n.trending)
    .sort((a, b) => {
      // Trending first, then by strength
      if (a.trending && !b.trending) return -1;
      if (!a.trending && b.trending) return 1;
      return b.strength - a.strength;
    });
}

// Get narratives by category
export function getNarrativesByCategory(category: Narrative['category']): Narrative[] {
  return ACTIVE_NARRATIVES.filter(n => n.category === category);
}

export { ACTIVE_NARRATIVES, detectNarratives, calculateNarrativeScore };
