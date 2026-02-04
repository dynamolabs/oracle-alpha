/**
 * Market Condition Filter
 * Analyzes BTC/SOL prices and market conditions to adjust signal scoring
 */

// ============= TYPES =============

export type MarketTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type VolatilityLevel = 'HIGH' | 'NORMAL' | 'LOW';
export type LiquidityPeriod = 'OPTIMAL' | 'LOW' | 'WEEKEND';

export interface MarketCondition {
  btc: {
    price: number;
    change24h: number;
    trend: MarketTrend;
  };
  sol: {
    price: number;
    change24h: number;
    trend: MarketTrend;
  };
  overall: {
    trend: MarketTrend;
    volatility: VolatilityLevel;
    liquidityPeriod: LiquidityPeriod;
    isOptimalTrading: boolean;
  };
  scoring: {
    trendModifier: number;      // +5 bullish, -10 bearish, 0 neutral
    volatilityModifier: number; // +3 high volatility, 0 normal
    liquidityModifier: number;  // -5 low liquidity hours
    totalModifier: number;
  };
  timestamp: number;
  cached: boolean;
  cacheExpiresAt: number;
}

export interface PriceData {
  bitcoin?: {
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
  };
  solana?: {
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
  };
}

// ============= CACHE =============

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedCondition: MarketCondition | null = null;
let lastFetchTime = 0;

// ============= COINGECKO API =============

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

async function fetchPriceData(): Promise<PriceData | null> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=bitcoin,solana&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ORACLE-Alpha/1.0'
        }
      }
    );

    if (!response.ok) {
      console.error(`[MARKET] CoinGecko API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MARKET] Failed to fetch price data:', error);
    return null;
  }
}

// ============= TREND DETECTION =============

function detectTrend(change24h: number): MarketTrend {
  if (change24h > 2) return 'BULLISH';
  if (change24h < -2) return 'BEARISH';
  return 'NEUTRAL';
}

function detectVolatility(btcChange: number, solChange: number): VolatilityLevel {
  const maxSwing = Math.max(Math.abs(btcChange), Math.abs(solChange));
  
  if (maxSwing > 5) return 'HIGH';
  if (maxSwing < 1) return 'LOW';
  return 'NORMAL';
}

// ============= TRADING HOURS =============

/**
 * Determine optimal trading period based on UTC time
 * Avoid 00:00-06:00 UTC (low Asian/European overlap, low liquidity)
 * Weekend = lower volume
 */
function detectLiquidityPeriod(): LiquidityPeriod {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  
  // Weekend detection
  if (utcDay === 0 || utcDay === 6) {
    return 'WEEKEND';
  }
  
  // Low liquidity hours: 00:00-06:00 UTC
  if (utcHour >= 0 && utcHour < 6) {
    return 'LOW';
  }
  
  return 'OPTIMAL';
}

function isOptimalTradingTime(liquidityPeriod: LiquidityPeriod, trend: MarketTrend): boolean {
  // Not optimal during low liquidity or bearish markets
  if (liquidityPeriod === 'LOW') return false;
  if (trend === 'BEARISH') return false;
  
  // Weekend is suboptimal but not terrible
  if (liquidityPeriod === 'WEEKEND' && trend === 'NEUTRAL') return false;
  
  return true;
}

// ============= SCORING MODIFIERS =============

function calculateScoringModifiers(
  trend: MarketTrend,
  volatility: VolatilityLevel,
  liquidityPeriod: LiquidityPeriod
): MarketCondition['scoring'] {
  let trendModifier = 0;
  let volatilityModifier = 0;
  let liquidityModifier = 0;
  
  // Trend-based scoring
  switch (trend) {
    case 'BULLISH':
      trendModifier = 5;  // +5 points in bull market
      break;
    case 'BEARISH':
      trendModifier = -10; // -10 points in bear market (harder to profit)
      break;
    case 'NEUTRAL':
      trendModifier = 0;
      break;
  }
  
  // Volatility-based scoring
  switch (volatility) {
    case 'HIGH':
      volatilityModifier = 3; // +3 points (more opportunity)
      break;
    case 'NORMAL':
      volatilityModifier = 0;
      break;
    case 'LOW':
      volatilityModifier = -2; // -2 points (less movement)
      break;
  }
  
  // Liquidity period scoring
  switch (liquidityPeriod) {
    case 'OPTIMAL':
      liquidityModifier = 0;
      break;
    case 'LOW':
      liquidityModifier = -5; // -5 points during low liquidity hours
      break;
    case 'WEEKEND':
      liquidityModifier = -2; // -2 points on weekends
      break;
  }
  
  return {
    trendModifier,
    volatilityModifier,
    liquidityModifier,
    totalModifier: trendModifier + volatilityModifier + liquidityModifier
  };
}

// ============= MAIN FUNCTIONS =============

/**
 * Get current market condition (uses 5-minute cache)
 */
export async function getMarketCondition(): Promise<MarketCondition> {
  const now = Date.now();
  
  // Return cached if valid
  if (cachedCondition && (now - lastFetchTime) < CACHE_TTL_MS) {
    return {
      ...cachedCondition,
      cached: true,
      cacheExpiresAt: lastFetchTime + CACHE_TTL_MS
    };
  }
  
  // Fetch fresh data
  const priceData = await fetchPriceData();
  
  // Fallback values if API fails
  const btcPrice = priceData?.bitcoin?.usd || 95000;
  const btcChange = priceData?.bitcoin?.usd_24h_change || 0;
  const solPrice = priceData?.solana?.usd || 180;
  const solChange = priceData?.solana?.usd_24h_change || 0;
  
  // Detect trends
  const btcTrend = detectTrend(btcChange);
  const solTrend = detectTrend(solChange);
  
  // Overall trend (weighted: BTC 60%, SOL 40% since we trade SOL memes)
  const avgChange = btcChange * 0.6 + solChange * 0.4;
  const overallTrend = detectTrend(avgChange);
  
  // Volatility
  const volatility = detectVolatility(btcChange, solChange);
  
  // Liquidity period
  const liquidityPeriod = detectLiquidityPeriod();
  
  // Is it optimal to trade?
  const isOptimalTrading = isOptimalTradingTime(liquidityPeriod, overallTrend);
  
  // Calculate scoring modifiers
  const scoring = calculateScoringModifiers(overallTrend, volatility, liquidityPeriod);
  
  // Build condition object
  const condition: MarketCondition = {
    btc: {
      price: btcPrice,
      change24h: Math.round(btcChange * 100) / 100,
      trend: btcTrend
    },
    sol: {
      price: solPrice,
      change24h: Math.round(solChange * 100) / 100,
      trend: solTrend
    },
    overall: {
      trend: overallTrend,
      volatility,
      liquidityPeriod,
      isOptimalTrading
    },
    scoring,
    timestamp: now,
    cached: false,
    cacheExpiresAt: now + CACHE_TTL_MS
  };
  
  // Update cache
  cachedCondition = condition;
  lastFetchTime = now;
  
  console.log(`[MARKET] Condition updated: ${overallTrend} market, ${volatility} volatility, ${liquidityPeriod} liquidity. Score modifier: ${scoring.totalModifier >= 0 ? '+' : ''}${scoring.totalModifier}`);
  
  return condition;
}

/**
 * Apply market condition modifier to a signal score
 */
export function applyMarketModifier(baseScore: number, condition?: MarketCondition): number {
  if (!condition) {
    // Use last cached condition if available
    if (cachedCondition) {
      condition = cachedCondition;
    } else {
      return baseScore; // No modification without condition data
    }
  }
  
  const modified = baseScore + condition.scoring.totalModifier;
  
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, modified));
}

/**
 * Get a human-readable summary of market conditions
 */
export function formatMarketCondition(condition: MarketCondition): string {
  const trendEmoji = {
    'BULLISH': '🟢',
    'BEARISH': '🔴',
    'NEUTRAL': '🟡'
  };
  
  const volatilityEmoji = {
    'HIGH': '📈',
    'NORMAL': '📊',
    'LOW': '📉'
  };
  
  const liquidityEmoji = {
    'OPTIMAL': '✅',
    'LOW': '⚠️',
    'WEEKEND': '🌙'
  };
  
  const lines = [
    `${trendEmoji[condition.overall.trend]} Market: ${condition.overall.trend}`,
    `${volatilityEmoji[condition.overall.volatility]} Volatility: ${condition.overall.volatility}`,
    `${liquidityEmoji[condition.overall.liquidityPeriod]} Liquidity: ${condition.overall.liquidityPeriod}`,
    '',
    `BTC: $${condition.btc.price.toLocaleString()} (${condition.btc.change24h >= 0 ? '+' : ''}${condition.btc.change24h}%)`,
    `SOL: $${condition.sol.price.toLocaleString()} (${condition.sol.change24h >= 0 ? '+' : ''}${condition.sol.change24h}%)`,
    '',
    `Score modifier: ${condition.scoring.totalModifier >= 0 ? '+' : ''}${condition.scoring.totalModifier}`,
    condition.overall.isOptimalTrading ? '✅ Optimal trading time' : '⚠️ Suboptimal conditions'
  ];
  
  return lines.join('\n');
}

/**
 * Get emoji indicator for dashboard
 */
export function getMarketIndicator(condition: MarketCondition): {
  emoji: string;
  color: string;
  label: string;
} {
  const { trend, volatility, isOptimalTrading } = condition.overall;
  
  if (trend === 'BULLISH' && isOptimalTrading) {
    return { emoji: '🟢', color: '#22c55e', label: 'Excellent' };
  }
  
  if (trend === 'BEARISH') {
    return { emoji: '🔴', color: '#ef4444', label: 'Caution' };
  }
  
  if (!isOptimalTrading) {
    return { emoji: '🟡', color: '#eab308', label: 'Suboptimal' };
  }
  
  if (volatility === 'HIGH') {
    return { emoji: '🟢', color: '#22c55e', label: 'Good (Volatile)' };
  }
  
  return { emoji: '🟡', color: '#eab308', label: 'Neutral' };
}

/**
 * Clear cache (for testing or forced refresh)
 */
export function clearMarketCache(): void {
  cachedCondition = null;
  lastFetchTime = 0;
}

/**
 * Get cache status
 */
export function getCacheStatus(): { cached: boolean; ageMs: number; expiresInMs: number } {
  const now = Date.now();
  return {
    cached: cachedCondition !== null,
    ageMs: cachedCondition ? now - lastFetchTime : 0,
    expiresInMs: cachedCondition ? Math.max(0, (lastFetchTime + CACHE_TTL_MS) - now) : 0
  };
}

// Export types for other modules
export type { MarketCondition };
