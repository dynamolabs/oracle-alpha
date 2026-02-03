/**
 * DexScreener Data Source
 *
 * Fetches token data from DexScreener's public API
 * More reliable than direct pump.fun API
 */

import { RawSignal } from '../types';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest';

interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    m5: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  pairCreatedAt: number;
}

// Track seen tokens to avoid duplicates
const seenTokens = new Map<string, number>();
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown

// Popular Solana tokens to check for pairs
const SOLANA_BASE_TOKENS = [
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
];

/**
 * Fetch trending Solana tokens from DexScreener
 */
export async function fetchDexScreenerTrending(): Promise<DexPair[]> {
  const allPairs: DexPair[] = [];

  for (const baseToken of SOLANA_BASE_TOKENS) {
    try {
      const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${baseToken}`, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`[DEXSCREENER] Token API returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const pairs: DexPair[] = data.pairs || [];

      // Filter for Solana pairs with good activity
      const solanaPairs = pairs.filter(
        p =>
          p.chainId === 'solana' &&
          p.fdv > 0 &&
          p.fdv < 10000000 && // Under $10M mcap
          (p.volume?.h1 || 0) > 1000 // At least $1K volume in last hour
      );

      allPairs.push(...solanaPairs);
    } catch (error) {
      console.error('[DEXSCREENER] Error fetching token pairs:', error);
    }
  }

  // Dedupe by base token address
  const seen = new Set<string>();
  const uniquePairs = allPairs.filter(p => {
    if (seen.has(p.baseToken.address)) return false;
    seen.add(p.baseToken.address);
    return true;
  });

  // Sort by volume
  return uniquePairs.sort((a, b) => (b.volume?.h1 || 0) - (a.volume?.h1 || 0)).slice(0, 50);
}

/**
 * Fetch specific token by CA
 */
export async function fetchTokenData(tokenAddress: string): Promise<DexPair | null> {
  try {
    const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${tokenAddress}`, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const pairs: DexPair[] = data.pairs || [];

    // Return the main Solana pair
    return pairs.find(p => p.chainId === 'solana') || null;
  } catch {
    return null;
  }
}

/**
 * Score a token based on DexScreener data
 */
function scoreToken(pair: DexPair): { score: number; factors: string[] } {
  let score = 50;
  const factors: string[] = [];

  // Market cap scoring
  const mcap = pair.fdv || 0;
  if (mcap >= 50000 && mcap <= 300000) {
    score += 15;
    factors.push('Ideal mcap range');
  } else if (mcap < 50000) {
    score += 5;
    factors.push('Very low mcap');
  } else if (mcap > 1000000) {
    score -= 10;
    factors.push('High mcap');
  }

  // Volume scoring
  const vol5m = pair.volume?.m5 || 0;
  const vol1h = pair.volume?.h1 || 0;

  if (vol5m > 10000) {
    score += 15;
    factors.push(`Strong 5m volume ($${(vol5m / 1000).toFixed(1)}K)`);
  } else if (vol5m > 5000) {
    score += 8;
    factors.push('Good 5m volume');
  }

  // Buy/sell ratio
  const buys5m = pair.txns?.m5?.buys || 0;
  const sells5m = pair.txns?.m5?.sells || 0;
  const total5m = buys5m + sells5m;
  if (total5m > 0) {
    const buyRatio = (buys5m / total5m) * 100;
    if (buyRatio > 70) {
      score += 12;
      factors.push(`Strong buy pressure (${buyRatio.toFixed(0)}%)`);
    } else if (buyRatio > 55) {
      score += 5;
      factors.push('Positive buy ratio');
    } else if (buyRatio < 40) {
      score -= 10;
      factors.push('Sell pressure');
    }
  }

  // Price change scoring
  const priceChange5m = pair.priceChange?.m5 || 0;
  const priceChange1h = pair.priceChange?.h1 || 0;

  if (priceChange5m > 20) {
    score += 10;
    factors.push(`Pumping (+${priceChange5m.toFixed(0)}% 5m)`);
  } else if (priceChange5m > 5) {
    score += 5;
    factors.push('Positive momentum');
  } else if (priceChange5m < -15) {
    score -= 8;
    factors.push('Dumping');
  }

  // Age scoring (prefer fresh tokens)
  const ageMs = Date.now() - pair.pairCreatedAt;
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 1) {
    score += 10;
    factors.push('Fresh launch (< 1h)');
  } else if (ageHours < 6) {
    score += 5;
    factors.push('New token (< 6h)');
  } else if (ageHours > 24) {
    score -= 5;
    factors.push('Older token');
  }

  // Liquidity scoring
  const liq = pair.liquidity?.usd || 0;
  if (liq >= 10000 && liq <= 100000) {
    score += 5;
    factors.push('Good liquidity');
  } else if (liq < 5000) {
    score -= 10;
    factors.push('Low liquidity risk');
  }

  return { score: Math.min(95, Math.max(30, score)), factors };
}

/**
 * Detect narratives from token name
 */
function detectNarratives(name: string, symbol: string): string[] {
  const text = `${name} ${symbol}`.toLowerCase();
  const narratives: string[] = [];

  if (/ai|agent|gpt|claude|neural|auto/.test(text)) narratives.push('AI');
  if (/trump|maga|biden|political|vote/.test(text)) narratives.push('Political');
  if (/elon|musk|doge/.test(text)) narratives.push('Celebrity');
  if (/pepe|wojak|meme|frog|cat|dog/.test(text)) narratives.push('Meme');
  if (/sol|solana/.test(text)) narratives.push('Solana');

  return narratives.length > 0 ? narratives : ['General'];
}

/**
 * Main scan function - returns signals from DexScreener data
 */
export async function scanDexScreener(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[DEXSCREENER] Scanning for trending tokens...');

  const pairs = await fetchDexScreenerTrending();
  console.log(`[DEXSCREENER] Found ${pairs.length} Solana pairs`);

  // Filter and score
  for (const pair of pairs.slice(0, 50)) {
    const tokenAddress = pair.baseToken.address;

    // Check cooldown
    const lastSeen = seenTokens.get(tokenAddress);
    if (lastSeen && now - lastSeen < COOLDOWN_MS) {
      continue;
    }

    // Score the token
    const { score, factors } = scoreToken(pair);

    // Only signal if score is good enough
    if (score >= 55) {
      seenTokens.set(tokenAddress, now);

      const narratives = detectNarratives(pair.baseToken.name, pair.baseToken.symbol);

      signals.push({
        source: 'dexscreener',
        timestamp: now,
        token: tokenAddress,
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        action: 'BUY',
        confidence: score,
        metadata: {
          mcap: pair.fdv || 0,
          liquidity: pair.liquidity?.usd || 0,
          volume5m: pair.volume?.m5 || 0,
          volume1h: pair.volume?.h1 || 0,
          priceChange5m: pair.priceChange?.m5 || 0,
          priceChange1h: pair.priceChange?.h1 || 0,
          buys5m: pair.txns?.m5?.buys || 0,
          sells5m: pair.txns?.m5?.sells || 0,
          age: Math.floor((now - pair.pairCreatedAt) / 60000),
          dex: pair.dexId,
          pairUrl: pair.url,
          factors,
          narratives,
          fromDexScreener: true
        }
      });

      console.log(
        `[DEXSCREENER] Signal: $${pair.baseToken.symbol} | Score: ${score} | MCap: $${(pair.fdv / 1000).toFixed(1)}K | Vol5m: $${((pair.volume?.m5 || 0) / 1000).toFixed(1)}K`
      );
    }
  }

  // Cleanup old entries
  const cutoff = now - 2 * 60 * 60 * 1000;
  for (const [mint, ts] of seenTokens) {
    if (ts < cutoff) seenTokens.delete(mint);
  }

  console.log(`[DEXSCREENER] Generated ${signals.length} signals`);
  return signals;
}

// Test function
if (require.main === module) {
  scanDexScreener().then(signals => {
    console.log('\nDexScreener Scan Results:');
    for (const s of signals.slice(0, 10)) {
      console.log(
        `  $${s.symbol} - Score: ${s.confidence} - MCap: $${(s.metadata?.mcap / 1000).toFixed(1)}K`
      );
    }
  });
}
