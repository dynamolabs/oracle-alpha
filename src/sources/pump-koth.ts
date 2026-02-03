/**
 * Pump.fun King of the Hill (KOTH) Scanner
 *
 * Monitors tokens that reach the "King of the Hill" status on pump.fun
 * KOTH tokens have high activity and often see significant price action
 */

import { RawSignal } from '../types';

const PUMP_FUN_API = 'https://frontend-api.pump.fun';

interface KOTHToken {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_uri?: string;
  creator: string;
  created_timestamp: number;
  king_of_the_hill_timestamp: number | null;
  usd_market_cap: number;
  reply_count: number;
  is_currently_live?: boolean;
  complete: boolean;
  raydium_pool?: string;
  virtual_sol_reserves?: number;
  virtual_token_reserves?: number;
}

// Track seen KOTH tokens to avoid duplicates
const seenKOTH = new Map<string, number>(); // mint -> timestamp
const KOTH_COOLDOWN = 30 * 60 * 1000; // 30 minutes cooldown per token

/**
 * Fetch current King of the Hill tokens from pump.fun
 */
async function fetchKOTHTokens(): Promise<KOTHToken[]> {
  const endpoints = [
    `${PUMP_FUN_API}/coins/featured`,
    `${PUMP_FUN_API}/coins/king-of-the-hill?limit=20&includeNsfw=false`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(
            `[PUMP-KOTH] Fetched ${data.length} tokens from ${endpoint.split('/').pop()}`
          );
          return data;
        }
      }
    } catch {
      continue;
    }
  }

  console.log('[PUMP-KOTH] No KOTH data available from API');
  return [];
}

/**
 * Fetch currently trending/live tokens on pump.fun
 */
async function fetchTrendingTokens(): Promise<KOTHToken[]> {
  try {
    const response = await fetch(
      `${PUMP_FUN_API}/coins?offset=0&limit=30&sort=last_trade_timestamp&order=DESC&includeNsfw=false`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      console.log(`[PUMP-KOTH] Trending API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[PUMP-KOTH] Error fetching trending:', error);
    return [];
  }
}

/**
 * Score a KOTH token based on various factors
 */
function scoreKOTHToken(token: KOTHToken): { score: number; factors: string[] } {
  let score = 60; // Base score for reaching KOTH
  const factors: string[] = [];

  // Market cap scoring
  const mcap = token.usd_market_cap || 0;
  if (mcap >= 50000 && mcap <= 200000) {
    score += 15;
    factors.push('Ideal mcap range ($50K-$200K)');
  } else if (mcap < 50000) {
    score += 5;
    factors.push('Very early stage');
  } else if (mcap > 500000) {
    score -= 10;
    factors.push('Higher mcap (less upside)');
  }

  // Reply count (engagement)
  if (token.reply_count > 50) {
    score += 10;
    factors.push(`High engagement (${token.reply_count} replies)`);
  } else if (token.reply_count > 20) {
    score += 5;
    factors.push('Good engagement');
  }

  // Fresh KOTH (just reached)
  if (token.king_of_the_hill_timestamp) {
    const kothAge = Date.now() - token.king_of_the_hill_timestamp;
    if (kothAge < 5 * 60 * 1000) {
      // Within 5 minutes
      score += 15;
      factors.push('Fresh KOTH (< 5 min)');
    } else if (kothAge < 15 * 60 * 1000) {
      // Within 15 minutes
      score += 8;
      factors.push('Recent KOTH (< 15 min)');
    }
  }

  // Bonding curve progress (if not complete, there's still upside)
  if (!token.complete) {
    score += 5;
    factors.push('Bonding curve active');
  } else if (token.raydium_pool) {
    score += 3;
    factors.push('Graduated to Raydium');
  }

  // Narrative detection from name/description
  const text = `${token.name} ${token.symbol} ${token.description || ''}`.toLowerCase();
  const narratives = [];

  if (/ai|agent|gpt|claude|neural/.test(text)) {
    score += 8;
    narratives.push('AI');
    factors.push('AI narrative');
  }
  if (/trump|maga|biden|political/.test(text)) {
    score += 5;
    narratives.push('Political');
    factors.push('Political narrative');
  }
  if (/elon|musk|doge/.test(text)) {
    score += 5;
    narratives.push('Celebrity');
    factors.push('Celebrity narrative');
  }
  if (/pepe|wojak|meme|frog/.test(text)) {
    score += 3;
    narratives.push('Meme');
  }

  return { score: Math.min(95, Math.max(40, score)), factors };
}

/**
 * Main scan function - returns signals for KOTH tokens
 */
export async function scanPumpKOTH(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[PUMP-KOTH] Scanning for King of the Hill tokens...');

  // Fetch KOTH tokens
  const kothTokens = await fetchKOTHTokens();
  console.log(`[PUMP-KOTH] Found ${kothTokens.length} KOTH tokens`);

  // Also check trending for tokens about to reach KOTH
  const trending = await fetchTrendingTokens();
  const highActivity = trending
    .filter(t => t.usd_market_cap >= 30000 && t.reply_count >= 10 && !t.complete)
    .slice(0, 10);

  // Combine and dedupe
  const allTokens = [...kothTokens];
  for (const t of highActivity) {
    if (!allTokens.find(k => k.mint === t.mint)) {
      allTokens.push(t);
    }
  }

  for (const token of allTokens) {
    // Check cooldown
    const lastSeen = seenKOTH.get(token.mint);
    if (lastSeen && now - lastSeen < KOTH_COOLDOWN) {
      continue;
    }

    // Score the token
    const { score, factors } = scoreKOTHToken(token);

    // Only signal if score is good enough
    if (score >= 60) {
      seenKOTH.set(token.mint, now);

      // Determine if this is actual KOTH or just high activity
      const isKOTH = kothTokens.some(k => k.mint === token.mint);

      signals.push({
        source: 'pump-koth',
        timestamp: now,
        token: token.mint,
        symbol: token.symbol,
        name: token.name,
        action: 'BUY',
        confidence: score,
        metadata: {
          mcap: token.usd_market_cap,
          replyCount: token.reply_count,
          isKOTH,
          kothTimestamp: token.king_of_the_hill_timestamp,
          complete: token.complete,
          raydiumPool: token.raydium_pool,
          factors,
          description: token.description?.slice(0, 200)
        }
      });

      console.log(
        `[PUMP-KOTH] Signal: $${token.symbol} | Score: ${score} | MCap: $${(token.usd_market_cap / 1000).toFixed(1)}K | ${isKOTH ? 'KOTH' : 'High Activity'}`
      );
    }
  }

  // Cleanup old entries
  const cutoff = now - 2 * 60 * 60 * 1000; // 2 hours
  for (const [mint, ts] of seenKOTH) {
    if (ts < cutoff) seenKOTH.delete(mint);
  }

  console.log(`[PUMP-KOTH] Generated ${signals.length} signals`);
  return signals;
}

// Test function
if (require.main === module) {
  scanPumpKOTH().then(signals => {
    console.log('\nKOTH Scan Results:');
    for (const s of signals) {
      console.log(`  $${s.symbol} - Score: ${s.confidence} - ${s.metadata?.factors?.join(', ')}`);
    }
  });
}
