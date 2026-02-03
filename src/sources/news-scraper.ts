import { RawSignal } from '../types';

/**
 * News Scraper - Aggregates crypto news and extracts token mentions
 * Sources: CoinTelegraph, Decrypt, TheBlock, Twitter Trends
 */

interface NewsItem {
  title: string;
  url: string;
  source: string;
  timestamp: number;
  sentiment: number; // -1 to 1
  tokens: string[];
}

// Keywords that indicate bullish news
const BULLISH_KEYWORDS = [
  'partnership',
  'launch',
  'listing',
  'integration',
  'adoption',
  'milestone',
  'record',
  'surge',
  'rally',
  'breakout',
  'pump',
  'bullish',
  'moon',
  'ath',
  'all-time high',
  'mainstream',
  'institutional',
  'whale',
  'accumulation',
  'buy'
];

// Keywords that indicate bearish/risky news
const BEARISH_KEYWORDS = [
  'hack',
  'exploit',
  'rug',
  'scam',
  'crash',
  'dump',
  'sell',
  'lawsuit',
  'sec',
  'regulation',
  'ban',
  'warning',
  'fraud',
  'ponzi',
  'rugpull',
  'honeypot'
];

// Token mention patterns
const TOKEN_PATTERNS = {
  solana: /\$([A-Z]{2,10})/g, // $TOKEN format
  cashtag: /#([A-Z]{2,10})/g, // #TOKEN format
  address: /([1-9A-HJ-NP-Za-km-z]{32,44}pump)/g // pump.fun addresses
};

// Calculate sentiment score from text
function calculateSentiment(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;

  for (const keyword of BULLISH_KEYWORDS) {
    if (lowerText.includes(keyword)) score += 0.1;
  }

  for (const keyword of BEARISH_KEYWORDS) {
    if (lowerText.includes(keyword)) score -= 0.15;
  }

  // Clamp to -1 to 1
  return Math.max(-1, Math.min(1, score));
}

// Extract token mentions from text
function extractTokens(text: string): string[] {
  const tokens: string[] = [];

  // Extract $TOKEN mentions
  const cashtagMatches = text.match(TOKEN_PATTERNS.solana) || [];
  for (const match of cashtagMatches) {
    const symbol = match.replace('$', '');
    if (symbol.length >= 2 && symbol.length <= 10) {
      tokens.push(symbol);
    }
  }

  // Extract pump.fun addresses
  const addressMatches = text.match(TOKEN_PATTERNS.address) || [];
  tokens.push(...addressMatches);

  return [...new Set(tokens)]; // Dedupe
}

// Fetch news from RSS feeds (simulated - would use actual RSS in production)
async function fetchCryptoNews(): Promise<NewsItem[]> {
  const news: NewsItem[] = [];

  // In production, this would fetch from:
  // - CoinTelegraph RSS
  // - Decrypt RSS
  // - TheBlock RSS
  // - Twitter API / Nitter scraper

  // For now, fetch from DexScreener trending as a proxy for "news"
  try {
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    const data = await response.json();

    const solanaTokens = data.filter((t: any) => t.chainId === 'solana').slice(0, 20);

    for (const token of solanaTokens) {
      // Create pseudo-news items from trending tokens
      const sentiment = token.priceChange?.h24 > 0 ? 0.3 : -0.1;

      news.push({
        title: `${token.name || 'Unknown'} (${token.symbol || 'UNKNOWN'}) trending on DexScreener`,
        url: token.url || '',
        source: 'dexscreener-trending',
        timestamp: Date.now(),
        sentiment: sentiment,
        tokens: token.tokenAddress ? [token.tokenAddress] : []
      });
    }
  } catch (error) {
    console.error('[NEWS] Error fetching DexScreener:', error);
  }

  // Fetch from pump.fun king of the hill
  try {
    const response = await fetch(
      'https://frontend-api.pump.fun/coins/king-of-the-hill?includeNsfw=false'
    );
    const data = await response.json();

    if (data?.mint) {
      news.push({
        title: `${data.name} ($${data.symbol}) is King of the Hill on pump.fun`,
        url: `https://pump.fun/${data.mint}`,
        source: 'pump-koth',
        timestamp: Date.now(),
        sentiment: 0.5, // KOTH is bullish signal
        tokens: [data.mint]
      });
    }
  } catch (error) {
    console.error('[NEWS] Error fetching pump.fun KOTH:', error);
  }

  return news;
}

// Fetch Twitter/X trends (placeholder - would use Twitter API)
async function fetchTwitterTrends(): Promise<NewsItem[]> {
  // TODO: Integrate with Twitter API or Nitter scraper
  // This would track:
  // - Crypto Twitter trending topics
  // - Viral tweets about tokens
  // - Influencer mentions

  return [];
}

// Main news scanner
export async function scanNews(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[NEWS] Scanning news sources...');

  // Fetch from all sources
  const [cryptoNews, twitterTrends] = await Promise.all([fetchCryptoNews(), fetchTwitterTrends()]);

  const allNews = [...cryptoNews, ...twitterTrends];

  for (const item of allNews) {
    // Only process bullish news with token mentions
    if (item.sentiment > 0 && item.tokens.length > 0) {
      for (const token of item.tokens) {
        // Calculate confidence based on sentiment and source
        let confidence = Math.round(50 + item.sentiment * 30);

        // Boost for certain sources
        if (item.source === 'pump-koth') confidence += 15;
        if (item.source === 'twitter-viral') confidence += 10;

        signals.push({
          source: 'narrative-new', // Use existing source type
          timestamp: item.timestamp,
          token: token,
          symbol: extractSymbolFromToken(token, item.title),
          name: item.title.split(' ')[0] || 'Unknown',
          action: 'BUY',
          confidence: Math.min(100, confidence),
          metadata: {
            newsTitle: item.title,
            newsSource: item.source,
            newsUrl: item.url,
            sentiment: item.sentiment,
            type: 'news-mention'
          }
        });
      }
    }
  }

  console.log(`[NEWS] Found ${signals.length} news signals`);
  return signals;
}

// Helper to extract symbol from token address or title
function extractSymbolFromToken(token: string, title: string): string {
  // If token is address, try to extract from title
  if (token.length > 20) {
    const match = title.match(/\$([A-Z]{2,10})/);
    if (match) return match[1];

    const parenMatch = title.match(/\(([A-Z]{2,10})\)/);
    if (parenMatch) return parenMatch[1];

    return 'UNKNOWN';
  }
  return token;
}

export { fetchCryptoNews, calculateSentiment, extractTokens };
