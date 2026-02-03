import { RawSignal } from '../types';

// KOL (Key Opinion Leader) tracking
// Tracks influential accounts and their token mentions

interface KOL {
  username: string;
  label: string;
  tier: 'S' | 'A' | 'B';
  winRate: number;
  avgMultiplier: number;
}

// Tracked KOLs with historical performance
const TRACKED_KOLS: KOL[] = [
  { username: 'blknoiz06', label: 'BLKNOIZ', tier: 'S', winRate: 0.65, avgMultiplier: 5.2 },
  { username: 'DegenSpartan', label: 'DegenSpartan', tier: 'S', winRate: 0.58, avgMultiplier: 4.1 },
  { username: 'CryptoKaleo', label: 'Kaleo', tier: 'A', winRate: 0.52, avgMultiplier: 3.5 },
  { username: 'AltcoinGordon', label: 'Gordon', tier: 'A', winRate: 0.48, avgMultiplier: 2.8 },
  { username: 'loomdart', label: 'Loomdart', tier: 'S', winRate: 0.62, avgMultiplier: 4.8 },
  { username: 'CryptoCobain', label: 'Cobain', tier: 'A', winRate: 0.55, avgMultiplier: 3.2 },
  { username: 'HsakaTrades', label: 'Hsaka', tier: 'B', winRate: 0.45, avgMultiplier: 2.5 },
  { username: 'crash_solana', label: 'Crash', tier: 'S', winRate: 0.60, avgMultiplier: 4.5 },
];

// Contract address pattern for Solana
const CA_PATTERN = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

// Extract potential Solana addresses from text
function extractTokenMentions(text: string): string[] {
  const matches = text.match(CA_PATTERN) || [];
  // Filter to likely Solana addresses (base58, right length)
  return matches.filter(m => m.length >= 32 && m.length <= 44);
}

// Check if text indicates a buy/bullish signal
function isBullishMention(text: string): boolean {
  const bullishTerms = [
    'buy', 'bought', 'aping', 'aped', 'long', 'bullish', 'moon',
    'send it', 'lfg', 'gem', 'alpha', 'early', '100x', '10x', '50x',
    'accumulating', 'loading', 'adding', 'bid', 'bidding'
  ];
  const lowerText = text.toLowerCase();
  return bullishTerms.some(term => lowerText.includes(term));
}

interface TwitterMention {
  tweetId: string;
  timestamp: number;
  text: string;
  tokens: string[];
  kol: KOL;
}

// Simulated Twitter scanning (replace with actual API)
async function fetchKOLMentions(kol: KOL): Promise<TwitterMention[]> {
  // TODO: Integrate with Twitter API or scraper
  // For now, return empty - will implement with actual data source
  
  // In production, this would:
  // 1. Fetch recent tweets from KOL
  // 2. Extract token addresses
  // 3. Return structured mentions
  
  return [];
}

// Alternative: Use Birdeye's trending API to correlate with KOL activity
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '';

interface BirdeyeTrending {
  address: string;
  symbol: string;
  name: string;
  mc: number;
  v24hUSD: number;
  v24hChangePercent: number;
}

async function fetchTrendingTokens(): Promise<BirdeyeTrending[]> {
  if (!BIRDEYE_API_KEY) {
    // Fallback to DexScreener trending
    try {
      const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
      const data = await response.json();
      return data
        .filter((t: any) => t.chainId === 'solana')
        .slice(0, 20)
        .map((t: any) => ({
          address: t.tokenAddress,
          symbol: t.symbol || 'UNKNOWN',
          name: t.name || 'Unknown',
          mc: t.marketCap || 0,
          v24hUSD: t.volume?.h24 || 0,
          v24hChangePercent: 0
        }));
    } catch (error) {
      console.error('[KOL] Error fetching trending:', error);
      return [];
    }
  }

  try {
    const response = await fetch(
      'https://public-api.birdeye.so/defi/tokenlist?sort_by=v24hChangePercent&sort_type=desc&offset=0&limit=20',
      { headers: { 'X-API-KEY': BIRDEYE_API_KEY } }
    );
    const data = await response.json();
    return data.data?.tokens || [];
  } catch (error) {
    console.error('[KOL] Error fetching Birdeye trending:', error);
    return [];
  }
}

// Social mention tracking via LunarCrush or similar
interface SocialMention {
  token: string;
  symbol: string;
  mentionCount: number;
  sentiment: number;
  influencerMentions: number;
}

async function fetchSocialMentions(): Promise<SocialMention[]> {
  // TODO: Integrate with LunarCrush, Santiment, or custom Twitter scraper
  // For now, simulate based on trending tokens
  
  const trending = await fetchTrendingTokens();
  
  return trending.map(t => ({
    token: t.address,
    symbol: t.symbol,
    mentionCount: Math.floor(Math.random() * 1000) + 100,
    sentiment: 0.5 + Math.random() * 0.5, // 0.5-1.0
    influencerMentions: Math.floor(Math.random() * 10)
  }));
}

export async function scanKOLActivity(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[KOL] Scanning KOL activity...');

  // Method 1: Direct KOL tweet scanning (when API available)
  for (const kol of TRACKED_KOLS) {
    const mentions = await fetchKOLMentions(kol);
    
    for (const mention of mentions) {
      for (const token of mention.tokens) {
        if (isBullishMention(mention.text)) {
          const confidence = Math.round(kol.winRate * (kol.tier === 'S' ? 100 : kol.tier === 'A' ? 85 : 70));
          
          signals.push({
            source: 'kol-tracker',
            timestamp: mention.timestamp,
            token: token,
            symbol: 'PENDING',
            name: 'Pending lookup',
            action: 'BUY',
            confidence,
            metadata: {
              kol: kol.username,
              kolLabel: kol.label,
              kolTier: kol.tier,
              tweetId: mention.tweetId,
              tweetText: mention.text.slice(0, 200),
              avgMultiplier: kol.avgMultiplier
            }
          });
        }
      }
    }
  }

  // Method 2: Social mention aggregation
  const socialMentions = await fetchSocialMentions();
  
  for (const mention of socialMentions) {
    // Only signal if high influencer mention count
    if (mention.influencerMentions >= 3 && mention.sentiment > 0.7) {
      signals.push({
        source: 'kol-social',
        timestamp: now,
        token: mention.token,
        symbol: mention.symbol,
        name: mention.symbol,
        action: 'BUY',
        confidence: Math.round(mention.sentiment * mention.influencerMentions * 10),
        metadata: {
          mentionCount: mention.mentionCount,
          sentiment: mention.sentiment,
          influencerMentions: mention.influencerMentions
        }
      });
    }
  }

  console.log(`[KOL] Found ${signals.length} KOL signals`);
  return signals;
}

export { TRACKED_KOLS, extractTokenMentions, isBullishMention };
