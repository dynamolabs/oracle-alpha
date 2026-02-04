/**
 * Historical Data Fetcher
 * Fetches price history from DexScreener and Birdeye
 */

// Historical candle data
export interface Candle {
  timestamp: number;      // Unix timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Price history with metadata
export interface PriceHistory {
  token: string;
  symbol: string;
  name: string;
  candles: Candle[];
  interval: CandleInterval;
  startTime: number;
  endTime: number;
  dataSource: 'dexscreener' | 'birdeye' | 'simulated';
  pairAddress?: string;
  quoteCurrency?: string;
  currentPrice?: number;
  marketCap?: number;
  liquidity?: number;
  createdAt?: number;      // Token creation timestamp
}

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

// Token info from DexScreener
interface DexScreenerTokenInfo {
  pairs: Array<{
    chainId: string;
    dexId: string;
    pairAddress: string;
    baseToken: { address: string; symbol: string; name: string };
    quoteToken: { address: string; symbol: string; name: string };
    priceUsd: string;
    priceNative: string;
    liquidity: { usd: number };
    fdv: number;
    pairCreatedAt: number;
    volume: { h24: number; h6: number; h1: number; m5: number };
    priceChange: { h24: number; h6: number; h1: number; m5: number };
  }>;
}

// Birdeye historical price data
interface BirdeyeOHLCV {
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
  unixTime: number;
}

const DEXSCREENER_API = 'https://api.dexscreener.com/latest';
const BIRDEYE_API = 'https://public-api.birdeye.so';

// Cache for historical data (token -> history)
const historyCache = new Map<string, { history: PriceHistory; fetchedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch token info from DexScreener
 */
export async function fetchTokenInfo(token: string): Promise<DexScreenerTokenInfo['pairs'][0] | null> {
  try {
    const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${token}`);
    
    if (!response.ok) {
      console.error(`[HISTORICAL] DexScreener returned ${response.status}`);
      return null;
    }
    
    const data: DexScreenerTokenInfo = await response.json();
    
    // Find the best Solana pair (highest liquidity)
    const solanaPairs = (data.pairs || [])
      .filter(p => p.chainId === 'solana')
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    
    return solanaPairs[0] || null;
  } catch (error) {
    console.error('[HISTORICAL] Error fetching token info:', error);
    return null;
  }
}

/**
 * Fetch historical OHLCV from Birdeye
 */
async function fetchBirdeyeHistory(
  token: string,
  interval: CandleInterval,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  
  if (!apiKey) {
    console.log('[HISTORICAL] Birdeye API key not configured');
    return [];
  }
  
  // Map interval to Birdeye format
  const typeMap: Record<CandleInterval, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1H',
    '4h': '4H',
    '1d': '1D'
  };
  
  try {
    const url = new URL(`${BIRDEYE_API}/defi/ohlcv`);
    url.searchParams.set('address', token);
    url.searchParams.set('type', typeMap[interval]);
    url.searchParams.set('time_from', Math.floor(startTime / 1000).toString());
    url.searchParams.set('time_to', Math.floor(endTime / 1000).toString());
    
    const response = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': apiKey,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`[HISTORICAL] Birdeye returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.data?.items) {
      return [];
    }
    
    return data.data.items.map((item: BirdeyeOHLCV) => ({
      timestamp: item.unixTime * 1000,
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v
    }));
  } catch (error) {
    console.error('[HISTORICAL] Error fetching Birdeye history:', error);
    return [];
  }
}

/**
 * Simulate historical data when real data unavailable
 * Uses realistic price dynamics
 */
function simulateHistory(
  startTime: number,
  endTime: number,
  interval: CandleInterval,
  startPrice: number = 0.00001,
  volatility: number = 0.15
): Candle[] {
  const candles: Candle[] = [];
  
  const intervalMs: Record<CandleInterval, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  };
  
  const step = intervalMs[interval];
  let price = startPrice;
  
  // Meme coin dynamics: sharp pumps, slow bleeds, occasional recovery
  let trend = 1; // 1 = bullish, -1 = bearish
  let trendDuration = 0;
  const trendLength = Math.floor(Math.random() * 20) + 5;
  
  for (let t = startTime; t < endTime; t += step) {
    // Change trend periodically
    trendDuration++;
    if (trendDuration > trendLength) {
      trend = Math.random() > 0.55 ? 1 : -1; // Slight bullish bias
      trendDuration = 0;
    }
    
    // Calculate price movement
    const baseMove = (Math.random() - 0.5) * volatility;
    const trendBias = trend * volatility * 0.3;
    const change = baseMove + trendBias;
    
    const open = price;
    const maxMove = price * volatility;
    const close = Math.max(0.0000001, price * (1 + change));
    const high = Math.max(open, close) * (1 + Math.random() * 0.05);
    const low = Math.min(open, close) * (1 - Math.random() * 0.05);
    const volume = Math.random() * 500000 * (1 + Math.abs(change) * 10);
    
    candles.push({
      timestamp: t,
      open,
      high,
      low,
      close,
      volume
    });
    
    price = close;
  }
  
  return candles;
}

/**
 * Fetch complete price history for a token
 */
export async function fetchPriceHistory(
  token: string,
  interval: CandleInterval = '1h',
  daysBack: number = 30
): Promise<PriceHistory> {
  // Check cache first
  const cacheKey = `${token}-${interval}-${daysBack}`;
  const cached = historyCache.get(cacheKey);
  
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.history;
  }
  
  const endTime = Date.now();
  const startTime = endTime - (daysBack * 24 * 60 * 60 * 1000);
  
  // Get token info from DexScreener
  const tokenInfo = await fetchTokenInfo(token);
  
  // Try Birdeye first for historical data
  let candles = await fetchBirdeyeHistory(token, interval, startTime, endTime);
  let dataSource: PriceHistory['dataSource'] = 'birdeye';
  
  // If Birdeye fails, simulate data
  if (candles.length === 0) {
    const startPrice = tokenInfo ? parseFloat(tokenInfo.priceUsd) / 10 : 0.00001;
    candles = simulateHistory(startTime, endTime, interval, startPrice);
    dataSource = 'simulated';
    console.log(`[HISTORICAL] Using simulated data for ${token}`);
  }
  
  const history: PriceHistory = {
    token,
    symbol: tokenInfo?.baseToken.symbol || 'UNKNOWN',
    name: tokenInfo?.baseToken.name || 'Unknown Token',
    candles,
    interval,
    startTime,
    endTime,
    dataSource,
    pairAddress: tokenInfo?.pairAddress,
    quoteCurrency: tokenInfo?.quoteToken.symbol || 'SOL',
    currentPrice: tokenInfo ? parseFloat(tokenInfo.priceUsd) : candles[candles.length - 1]?.close,
    marketCap: tokenInfo?.fdv,
    liquidity: tokenInfo?.liquidity?.usd,
    createdAt: tokenInfo?.pairCreatedAt
  };
  
  // Cache the result
  historyCache.set(cacheKey, { history, fetchedAt: Date.now() });
  
  return history;
}

/**
 * Get price at a specific timestamp (interpolated if needed)
 */
export function getPriceAtTime(history: PriceHistory, timestamp: number): number | null {
  if (history.candles.length === 0) return null;
  
  // Find closest candle
  let closest = history.candles[0];
  let minDiff = Math.abs(closest.timestamp - timestamp);
  
  for (const candle of history.candles) {
    const diff = Math.abs(candle.timestamp - timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candle;
    }
  }
  
  return closest.close;
}

/**
 * Get all-time high from history
 */
export function getATH(history: PriceHistory): { price: number; timestamp: number } | null {
  if (history.candles.length === 0) return null;
  
  let ath = history.candles[0];
  
  for (const candle of history.candles) {
    if (candle.high > ath.high) {
      ath = candle;
    }
  }
  
  return { price: ath.high, timestamp: ath.timestamp };
}

/**
 * Get all-time low from history
 */
export function getATL(history: PriceHistory): { price: number; timestamp: number } | null {
  if (history.candles.length === 0) return null;
  
  let atl = history.candles[0];
  
  for (const candle of history.candles) {
    if (candle.low < atl.low) {
      atl = candle;
    }
  }
  
  return { price: atl.low, timestamp: atl.timestamp };
}

/**
 * Clear history cache
 */
export function clearHistoryCache(): void {
  historyCache.clear();
}

/**
 * Get cache stats
 */
export function getHistoryCacheStats(): { entries: number; tokens: string[] } {
  const tokens = new Set<string>();
  
  for (const key of historyCache.keys()) {
    const token = key.split('-')[0];
    tokens.add(token);
  }
  
  return {
    entries: historyCache.size,
    tokens: Array.from(tokens)
  };
}
