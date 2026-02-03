import { RawSignal } from '../types';

// New Launch Scanner
// Monitors brand new pump.fun token launches

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d079301-97d2-4ae9-81fd-e56f00a891f4';

interface PumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  uri?: string;
  creator?: string;
  created_timestamp: number;
  usd_market_cap?: number;
  reply_count?: number;
  king_of_the_hill_timestamp?: number;
  is_currently_live?: boolean;
}

// Track recently seen tokens to avoid duplicates
const seenTokens = new Set<string>();
const MAX_SEEN = 1000;

// Keywords that indicate potentially interesting tokens
const BULLISH_KEYWORDS = [
  'ai', 'agent', 'gpt', 'claude', 'neural', 'auto', // AI
  'trump', 'maga', 'elon', 'musk', // Political/Celebrity
  'pepe', 'doge', 'shib', 'wif', 'cat', 'dog', 'frog', // Meme
  'sol', 'solana', 'pump', 'moon', 'gem', // Crypto
  '100x', '1000x', 'send', // Hype
];

// Negative keywords to filter out
const BEARISH_KEYWORDS = [
  'rug', 'scam', 'honeypot', 'fake',
];

function analyzeTokenName(name: string, symbol: string, description?: string): { score: number; narratives: string[] } {
  const text = `${name} ${symbol} ${description || ''}`.toLowerCase();
  let score = 50;
  const narratives: string[] = [];

  // Check for bullish keywords
  let keywordMatches = 0;
  for (const kw of BULLISH_KEYWORDS) {
    if (text.includes(kw)) {
      keywordMatches++;
      if (['ai', 'agent', 'gpt', 'claude'].includes(kw)) narratives.push('AI');
      if (['trump', 'maga', 'elon', 'musk'].includes(kw)) narratives.push('Celebrity');
      if (['pepe', 'doge', 'shib', 'wif', 'cat', 'dog', 'frog'].includes(kw)) narratives.push('Meme');
    }
  }
  score += keywordMatches * 5;

  // Check for bearish keywords
  for (const kw of BEARISH_KEYWORDS) {
    if (text.includes(kw)) {
      score -= 20;
    }
  }

  // Bonus for unique narratives
  if (narratives.length > 1) {
    score += 10; // Multi-narrative bonus
  }

  // Dedupe narratives
  const uniqueNarratives = [...new Set(narratives)];
  if (uniqueNarratives.length === 0) {
    uniqueNarratives.push('General');
  }

  return { score: Math.max(0, Math.min(100, score)), narratives: uniqueNarratives };
}

async function fetchNewPumpFunTokens(): Promise<PumpFunToken[]> {
  try {
    // Try DexScreener latest pairs for Solana
    const response = await fetch('https://api.dexscreener.com/token-boosts/latest/v1');
    const data = await response.json();
    
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    // Filter to very new pump.fun tokens
    return data
      .filter((t: any) => {
        if (t.chainId !== 'solana') return false;
        if (!t.tokenAddress?.endsWith('pump')) return false;
        // Check if recently created (boosted recently = likely new)
        return true;
      })
      .slice(0, 20)
      .map((t: any) => ({
        mint: t.tokenAddress,
        name: t.description || t.symbol || 'Unknown',
        symbol: t.symbol || 'UNKNOWN',
        description: t.description,
        created_timestamp: Date.now(), // Approximate
        usd_market_cap: t.marketCap
      }));
  } catch (error) {
    console.error('[NEW-LAUNCH] Error fetching tokens:', error);
    return [];
  }
}

async function getTokenDetails(mint: string): Promise<{ mcap: number; holders: number; volume: number } | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    
    if (!pair) return null;
    
    return {
      mcap: pair.fdv || pair.marketCap || 0,
      holders: 0, // Would need another API
      volume: pair.volume?.m5 || 0
    };
  } catch {
    return null;
  }
}

export async function scanNewLaunches(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[NEW-LAUNCH] Scanning for new pump.fun launches...');

  const tokens = await fetchNewPumpFunTokens();
  console.log(`[NEW-LAUNCH] Found ${tokens.length} recent tokens`);

  for (const token of tokens) {
    // Skip if we've seen this token
    if (seenTokens.has(token.mint)) continue;
    
    // Mark as seen
    seenTokens.add(token.mint);
    if (seenTokens.size > MAX_SEEN) {
      // Remove oldest entries
      const entries = [...seenTokens];
      entries.slice(0, 100).forEach(e => seenTokens.delete(e));
    }

    // Analyze token
    const analysis = analyzeTokenName(token.name, token.symbol, token.description);
    
    // Get market details
    const details = await getTokenDetails(token.mint);
    
    // Early stage filter (want low mcap for new launches)
    if (details && details.mcap > 100000) continue; // Skip if > $100k mcap
    
    // Only signal if interesting
    if (analysis.score >= 55) {
      signals.push({
        source: 'narrative-new', // Use existing source type
        timestamp: now,
        token: token.mint,
        symbol: token.symbol,
        name: token.name,
        action: 'BUY',
        confidence: analysis.score,
        metadata: {
          narratives: analysis.narratives,
          description: token.description?.slice(0, 200),
          mcap: details?.mcap || token.usd_market_cap || 0,
          volume5m: details?.volume || 0,
          isNewLaunch: true
        }
      });
    }
  }

  console.log(`[NEW-LAUNCH] Found ${signals.length} new launch signals`);
  return signals;
}

export { analyzeTokenName };
