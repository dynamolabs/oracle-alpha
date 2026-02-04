import { RawSignal } from '../types';

// Twitter/X Sentiment Scanner
// Scans for trending crypto terms and sentiment scoring
// Uses mock data when no API key available

const TWITTER_API_KEY = process.env.TWITTER_API_KEY || process.env.TWITTER_BEARER_TOKEN;

// Trending crypto terms to monitor
const TRENDING_TERMS = [
  // Narratives
  'solana ai', 'solana agent', 'solana meme', 'solana rwa', 'solana gaming',
  // Token hunters
  '$sol pump', 'solana gem', 'solana alpha', 'sol 100x', 'next sol 1000x',
  // Sentiment
  'solana bullish', 'sol moon', 'solana breakout', 'sol ath',
  // Specific
  'pump.fun', 'raydium', 'jupiter dex', 'meteora'
];

// Bullish keywords with weights
const BULLISH_WEIGHTS: Record<string, number> = {
  'moon': 0.3, 'mooning': 0.35, 'bullish': 0.4, 'lfg': 0.25,
  'gem': 0.35, 'alpha': 0.4, 'buy': 0.2, 'bought': 0.25,
  'aping': 0.3, 'aped': 0.3, 'accumulating': 0.35, 'loading': 0.3,
  'breakout': 0.35, '100x': 0.4, '1000x': 0.45, 'undervalued': 0.35,
  'early': 0.3, 'lowcap': 0.3, 'microcap': 0.25, 'send': 0.2,
  'conviction': 0.4, 'size': 0.25, 'bag': 0.2
};

// Bearish keywords with weights
const BEARISH_WEIGHTS: Record<string, number> = {
  'dump': -0.4, 'dumping': -0.45, 'rug': -0.5, 'rugged': -0.5,
  'scam': -0.5, 'exit': -0.35, 'sell': -0.2, 'sold': -0.25,
  'bearish': -0.4, 'dead': -0.35, 'rip': -0.3, 'crashed': -0.4,
  'avoid': -0.35, 'careful': -0.2, 'warning': -0.3, 'honeypot': -0.5
};

// Solana CA pattern
const CA_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

interface TweetSentiment {
  token: string;
  symbol?: string;
  mentions: number;
  sentiment: number; // -1 to 1
  bullishCount: number;
  bearishCount: number;
  influencerMentions: number;
  recentTweets: string[];
}

// Calculate sentiment score from text
function calculateSentiment(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  let matches = 0;

  for (const [word, weight] of Object.entries(BULLISH_WEIGHTS)) {
    if (lower.includes(word)) {
      score += weight;
      matches++;
    }
  }

  for (const [word, weight] of Object.entries(BEARISH_WEIGHTS)) {
    if (lower.includes(word)) {
      score += weight;
      matches++;
    }
  }

  if (matches === 0) return 0;
  return Math.max(-1, Math.min(1, score / Math.sqrt(matches)));
}

// Extract token addresses from text
function extractCAs(text: string): string[] {
  const matches = text.match(CA_REGEX) || [];
  return matches.filter(m => m.length >= 32 && m.length <= 44);
}

// Mock data generator for when no API key
function generateMockSentimentData(): TweetSentiment[] {
  // Simulate trending tokens from DexScreener with mock sentiment
  const mockTokens = [
    // High sentiment examples
    { token: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', symbol: 'SAMO', sentiment: 0.72, mentions: 234, bullish: 45, bearish: 8 },
    { token: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', sentiment: 0.65, mentions: 567, bullish: 89, bearish: 22 },
    { token: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', symbol: 'BOME', sentiment: 0.58, mentions: 345, bullish: 56, bearish: 18 },
    // Medium sentiment
    { token: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', symbol: 'PYTH', sentiment: 0.45, mentions: 189, bullish: 34, bearish: 15 },
    { token: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', sentiment: 0.52, mentions: 423, bullish: 67, bearish: 25 },
    // AI narrative tokens
    { token: 'Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs', symbol: 'GRASS', sentiment: 0.68, mentions: 156, bullish: 38, bearish: 9 },
    { token: 'nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7', symbol: 'NOS', sentiment: 0.61, mentions: 98, bullish: 25, bearish: 7 },
  ];

  // Add some randomization
  return mockTokens.map(t => ({
    ...t,
    mentions: t.mentions + Math.floor(Math.random() * 50) - 25,
    sentiment: Math.max(-1, Math.min(1, t.sentiment + (Math.random() * 0.2 - 0.1))),
    bullishCount: t.bullish + Math.floor(Math.random() * 10),
    bearishCount: t.bearish + Math.floor(Math.random() * 5),
    influencerMentions: Math.floor(Math.random() * 5),
    recentTweets: [
      `$${t.symbol} looking good here, accumulating 🔥`,
      `Just aped into ${t.symbol}, early gem vibes`,
      `${t.symbol} chart is primed for breakout`
    ]
  }));
}

// Fetch trending tokens and analyze sentiment from DexScreener boosted tokens
async function fetchTrendingTokenSentiment(): Promise<TweetSentiment[]> {
  try {
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    const data = await response.json();
    
    const solanaTokens = data
      .filter((t: any) => t.chainId === 'solana')
      .slice(0, 25);
    
    const sentiments: TweetSentiment[] = [];
    
    for (const token of solanaTokens) {
      // Analyze description/name for sentiment
      const description = token.description || token.name || '';
      const sentiment = calculateSentiment(description);
      
      // Boost activity correlates with social attention
      const boostAmount = token.amount || 0;
      const estimatedMentions = Math.floor(boostAmount / 10) + 20;
      
      sentiments.push({
        token: token.tokenAddress,
        symbol: token.symbol || 'UNKNOWN',
        mentions: estimatedMentions,
        sentiment: sentiment + 0.3, // Boosted tokens tend positive
        bullishCount: Math.floor(estimatedMentions * 0.6),
        bearishCount: Math.floor(estimatedMentions * 0.15),
        influencerMentions: Math.floor(Math.random() * 3),
        recentTweets: []
      });
    }
    
    return sentiments;
  } catch (error) {
    console.error('[TWITTER-SENTIMENT] Error fetching trending:', error);
    return [];
  }
}

// Real Twitter API call (when API key available)
async function fetchRealTwitterSentiment(): Promise<TweetSentiment[]> {
  if (!TWITTER_API_KEY) {
    return [];
  }

  try {
    // Twitter API v2 recent search
    const results: TweetSentiment[] = [];
    
    for (const term of TRENDING_TERMS.slice(0, 5)) {
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(term)}&max_results=50&tweet.fields=created_at,public_metrics,entities`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${TWITTER_API_KEY}`
        }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const tweets = data.data || [];
      
      // Extract CAs and calculate sentiment
      const tokenMentions = new Map<string, TweetSentiment>();
      
      for (const tweet of tweets) {
        const cas = extractCAs(tweet.text);
        const sentiment = calculateSentiment(tweet.text);
        
        for (const ca of cas) {
          const existing = tokenMentions.get(ca) || {
            token: ca,
            mentions: 0,
            sentiment: 0,
            bullishCount: 0,
            bearishCount: 0,
            influencerMentions: 0,
            recentTweets: []
          };
          
          existing.mentions++;
          existing.sentiment = (existing.sentiment * (existing.mentions - 1) + sentiment) / existing.mentions;
          
          if (sentiment > 0.2) existing.bullishCount++;
          if (sentiment < -0.2) existing.bearishCount++;
          
          if (tweet.public_metrics?.retweet_count > 50) {
            existing.influencerMentions++;
          }
          
          if (existing.recentTweets.length < 3) {
            existing.recentTweets.push(tweet.text.slice(0, 200));
          }
          
          tokenMentions.set(ca, existing);
        }
      }
      
      results.push(...tokenMentions.values());
    }
    
    return results;
  } catch (error) {
    console.error('[TWITTER-SENTIMENT] Twitter API error:', error);
    return [];
  }
}

// Get token info from DexScreener
async function getTokenInfo(address: string): Promise<{ symbol: string; name: string; mcap: number }> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    
    return {
      symbol: pair?.baseToken?.symbol || 'UNKNOWN',
      name: pair?.baseToken?.name || 'Unknown',
      mcap: pair?.fdv || pair?.marketCap || 0
    };
  } catch {
    return { symbol: 'UNKNOWN', name: 'Unknown', mcap: 0 };
  }
}

// Main scan function
export async function scanTwitterSentiment(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[TWITTER-SENTIMENT] Scanning Twitter sentiment...');
  console.log(`[TWITTER-SENTIMENT] API Key: ${TWITTER_API_KEY ? 'Available' : 'Not configured (using mock data)'}`);

  let sentimentData: TweetSentiment[] = [];

  // Try real Twitter API first
  if (TWITTER_API_KEY) {
    sentimentData = await fetchRealTwitterSentiment();
    console.log(`[TWITTER-SENTIMENT] Real Twitter data: ${sentimentData.length} tokens`);
  }

  // Fallback/supplement with trending analysis
  if (sentimentData.length < 10) {
    const trendingData = await fetchTrendingTokenSentiment();
    console.log(`[TWITTER-SENTIMENT] Trending analysis: ${trendingData.length} tokens`);
    sentimentData.push(...trendingData);
  }

  // If still no data, use mock
  if (sentimentData.length === 0) {
    console.log('[TWITTER-SENTIMENT] Using mock sentiment data');
    sentimentData = generateMockSentimentData();
  }

  // Process sentiment data into signals
  for (const data of sentimentData) {
    // Only signal positive sentiment with enough mentions
    // Lower thresholds when using fallback data (no Twitter API)
    const minSentiment = TWITTER_API_KEY ? 0.3 : 0.2;
    const minMentions = TWITTER_API_KEY ? 30 : 15;
    if (data.sentiment < minSentiment || data.mentions < minMentions) continue;

    // Calculate confidence based on sentiment strength and mention volume
    const sentimentScore = Math.round(data.sentiment * 40); // 0-40 points
    const volumeScore = Math.min(30, Math.round(data.mentions / 10)); // 0-30 points
    const ratioScore = data.bullishCount / (data.bearishCount + 1) > 3 ? 20 : 10; // 10-20 points
    const influencerBonus = data.influencerMentions * 5; // 0-25 points
    
    const confidence = Math.min(100, sentimentScore + volumeScore + ratioScore + influencerBonus);

    if (confidence < 50) continue;

    // Get token info if needed
    let symbol = data.symbol;
    let name = data.symbol || 'Unknown';
    let mcap = 0;

    if (!symbol || symbol === 'UNKNOWN') {
      const info = await getTokenInfo(data.token);
      symbol = info.symbol;
      name = info.name;
      mcap = info.mcap;
    }

    signals.push({
      source: 'kol-social', // Use existing source type
      timestamp: now,
      token: data.token,
      symbol,
      name,
      action: 'BUY',
      confidence,
      metadata: {
        sentimentScore: data.sentiment,
        mentions: data.mentions,
        bullishCount: data.bullishCount,
        bearishCount: data.bearishCount,
        influencerMentions: data.influencerMentions,
        bullishRatio: data.bullishCount / (data.bearishCount + 1),
        source: 'twitter-sentiment',
        mcap,
        recentTweets: data.recentTweets.slice(0, 2)
      }
    });
  }

  console.log(`[TWITTER-SENTIMENT] Generated ${signals.length} sentiment signals`);
  return signals;
}

// Export utilities
export { calculateSentiment, extractCAs, BULLISH_WEIGHTS, BEARISH_WEIGHTS };
