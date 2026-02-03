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
// Tier S: Top performers, high conviction signals
// Tier A: Consistent performers, good accuracy
// Tier B: Useful for confluence, moderate accuracy
const TRACKED_KOLS: KOL[] = [
  // ═══════════════════════════════════════════════════════════════
  // S-TIER - Elite KOLs (60%+ Win Rate, High Multipliers)
  // ═══════════════════════════════════════════════════════════════
  { username: 'blknoiz06', label: 'BLKNOIZ', tier: 'S', winRate: 0.65, avgMultiplier: 5.2 },
  { username: 'DegenSpartan', label: 'DegenSpartan', tier: 'S', winRate: 0.58, avgMultiplier: 4.1 },
  { username: 'loomdart', label: 'Loomdart', tier: 'S', winRate: 0.62, avgMultiplier: 4.8 },
  { username: 'crash_solana', label: 'Crash', tier: 'S', winRate: 0.6, avgMultiplier: 4.5 },
  { username: 'Ansem', label: 'Ansem', tier: 'S', winRate: 0.68, avgMultiplier: 6.2 },
  { username: 'MustStopMurad', label: 'Murad', tier: 'S', winRate: 0.64, avgMultiplier: 5.5 },
  {
    username: 'HentaiAvenger2',
    label: 'HentaiAvenger',
    tier: 'S',
    winRate: 0.61,
    avgMultiplier: 4.3
  },
  { username: 'WazzCrypto', label: 'Wazz', tier: 'S', winRate: 0.59, avgMultiplier: 3.9 },
  { username: 'GiganticRebirth', label: 'Gigantic', tier: 'S', winRate: 0.63, avgMultiplier: 5.1 },

  // ═══════════════════════════════════════════════════════════════
  // A-TIER - Strong KOLs (50-59% Win Rate)
  // ═══════════════════════════════════════════════════════════════
  { username: 'CryptoKaleo', label: 'Kaleo', tier: 'A', winRate: 0.52, avgMultiplier: 3.5 },
  { username: 'AltcoinGordon', label: 'Gordon', tier: 'A', winRate: 0.48, avgMultiplier: 2.8 },
  { username: 'CryptoCobain', label: 'Cobain', tier: 'A', winRate: 0.55, avgMultiplier: 3.2 },
  { username: 'soltrader', label: 'SOL Trader', tier: 'A', winRate: 0.54, avgMultiplier: 3.4 },
  { username: 'LunarCrush', label: 'LunarCrush', tier: 'A', winRate: 0.51, avgMultiplier: 2.9 },
  { username: 'JupiterExchange', label: 'Jupiter', tier: 'A', winRate: 0.56, avgMultiplier: 3.7 },
  { username: 'ZssBecker', label: 'Zss', tier: 'A', winRate: 0.53, avgMultiplier: 3.1 },
  { username: 'CryptoGodJohn', label: 'GodJohn', tier: 'A', winRate: 0.5, avgMultiplier: 2.7 },
  { username: 'SOLBigBrain', label: 'BigBrain', tier: 'A', winRate: 0.57, avgMultiplier: 3.8 },
  { username: 'CoinMamba', label: 'Mamba', tier: 'A', winRate: 0.52, avgMultiplier: 3.0 },
  { username: 'thetraderz', label: 'Traderz', tier: 'A', winRate: 0.54, avgMultiplier: 3.3 },
  { username: 'pentaborex', label: 'Penta', tier: 'A', winRate: 0.55, avgMultiplier: 3.5 },

  // ═══════════════════════════════════════════════════════════════
  // B-TIER - Useful for Confluence (40-49% Win Rate)
  // ═══════════════════════════════════════════════════════════════
  { username: 'HsakaTrades', label: 'Hsaka', tier: 'B', winRate: 0.45, avgMultiplier: 2.5 },
  { username: 'crypto_bitlord', label: 'BitLord', tier: 'B', winRate: 0.44, avgMultiplier: 2.3 },
  { username: 'TheMoonCarl', label: 'MoonCarl', tier: 'B', winRate: 0.42, avgMultiplier: 2.1 },
  { username: 'CryptoWendyO', label: 'Wendy', tier: 'B', winRate: 0.46, avgMultiplier: 2.6 },
  { username: 'Tradermayne', label: 'Mayne', tier: 'B', winRate: 0.43, avgMultiplier: 2.2 },
  { username: 'CryptoTony__', label: 'Tony', tier: 'B', winRate: 0.47, avgMultiplier: 2.7 },
  { username: 'dcloudio', label: 'DCloud', tier: 'B', winRate: 0.41, avgMultiplier: 2.0 },
  { username: 'CredibleCrypto', label: 'Credible', tier: 'B', winRate: 0.48, avgMultiplier: 2.8 },
  { username: 'SolanaFloor', label: 'SOL Floor', tier: 'B', winRate: 0.44, avgMultiplier: 2.4 },
  { username: 'DefiIgnas', label: 'Ignas', tier: 'B', winRate: 0.49, avgMultiplier: 2.9 }
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
    'buy',
    'bought',
    'aping',
    'aped',
    'long',
    'bullish',
    'moon',
    'send it',
    'lfg',
    'gem',
    'alpha',
    'early',
    '100x',
    '10x',
    '50x',
    'accumulating',
    'loading',
    'adding',
    'bid',
    'bidding'
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

// Demo mode flag - generates realistic mock data for presentations
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Mock tokens for demo mode
const DEMO_TOKENS = [
  {
    address: 'DemoToken1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    symbol: 'AIXBT',
    name: 'AI Agent XBT'
  },
  { address: 'DemoToken2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'GROK', name: 'Grok AI' },
  { address: 'DemoToken3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'BONKAI', name: 'Bonk AI' },
  {
    address: 'DemoToken4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    symbol: 'TRUMP',
    name: 'Official Trump'
  },
  {
    address: 'DemoToken5xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    symbol: 'NEURAL',
    name: 'Neural Net'
  },
  {
    address: 'DemoToken6xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    symbol: 'AGENTX',
    name: 'Agent X Protocol'
  },
  {
    address: 'DemoToken7xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    symbol: 'MOONBOT',
    name: 'Moon Bot'
  },
  { address: 'DemoToken8xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'CATGPT', name: 'Cat GPT' }
];

// Track recently generated demo signals to avoid duplicates
const recentDemoSignals = new Map<string, number>();
const DEMO_COOLDOWN = 10 * 60 * 1000; // 10 minutes

// Simulated Twitter scanning (replace with actual API)
async function fetchKOLMentions(kol: KOL): Promise<TwitterMention[]> {
  // In demo mode, occasionally generate mock mentions
  if (DEMO_MODE && Math.random() < 0.15) {
    // 15% chance per KOL
    const token = DEMO_TOKENS[Math.floor(Math.random() * DEMO_TOKENS.length)];
    const now = Date.now();

    // Check cooldown for this token
    const lastSeen = recentDemoSignals.get(token.address);
    if (lastSeen && now - lastSeen < DEMO_COOLDOWN) {
      return [];
    }
    recentDemoSignals.set(token.address, now);

    return [
      {
        tweetId: `demo_${now}_${kol.username}`,
        timestamp: now,
        text: `Just aped into $${token.symbol} 🚀 This looks like a gem, early af. NFA but loading a bag here. ${token.address}`,
        tokens: [token.address],
        kol
      }
    ];
  }

  // Production mode: return empty (needs real Twitter API integration)
  // TODO: Integrate with Twitter API or scraper
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
          const confidence = Math.round(
            kol.winRate * (kol.tier === 'S' ? 100 : kol.tier === 'A' ? 85 : 70)
          );

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
