/**
 * Token Backtest Analyzer
 * Analyze any token's historical performance with simulated entries
 */

import {
  fetchPriceHistory,
  fetchTokenInfo,
  getPriceAtTime,
  getATH,
  getATL,
  PriceHistory,
  Candle,
  CandleInterval
} from './historical-data';

// Entry point configuration
export interface EntryPoint {
  type: 'price' | 'date' | 'candle_index';
  price?: number;           // Entry at specific price
  date?: number | string;   // Entry at specific date (timestamp or ISO string)
  candleIndex?: number;     // Entry at specific candle index
}

// Strategy configuration for backtesting
export interface StrategyConfig {
  takeProfitPct?: number;   // Take profit percentage (e.g., 100 = 2x)
  stopLossPct?: number;     // Stop loss percentage (e.g., 20 = -20%)
  trailingStopPct?: number; // Trailing stop percentage
  holdDays?: number;        // Max hold duration in days
  dcaLevels?: number[];     // DCA buy levels (-10%, -20%, etc.)
}

// Single trade result
export interface TradeResult {
  entryPrice: number;
  entryTime: number;
  exitPrice: number;
  exitTime: number;
  exitReason: 'take_profit' | 'stop_loss' | 'trailing_stop' | 'time_limit' | 'current' | 'dca_avg';
  roi: number;              // Return on investment as decimal (0.5 = 50%)
  roiPercent: string;       // ROI as percentage string (e.g., "+50.00%")
  holdDurationMs: number;
  holdDurationHuman: string;
}

// Comprehensive backtest result
export interface BacktestResult {
  token: string;
  symbol: string;
  name: string;
  
  // Entry info
  entry: {
    price: number;
    timestamp: number;
    dateString: string;
  };
  
  // Current state
  current: {
    price: number;
    timestamp: number;
    dateString: string;
  };
  
  // ROI calculations
  roi: {
    total: number;          // Total ROI as percentage
    toATH: number;          // ROI if sold at ATH
    maxGain: number;        // Maximum gain during period
    maxLoss: number;        // Maximum loss (drawdown) during period
  };
  
  // ATH info
  ath: {
    price: number;
    timestamp: number;
    dateString: string;
    fromEntry: number;      // % gain from entry to ATH
  };
  
  // ATL info (lowest point after entry)
  atl: {
    price: number;
    timestamp: number;
    dateString: string;
    fromEntry: number;      // % loss from entry to ATL
  };
  
  // Drawdown analysis
  drawdown: {
    maxDrawdownPct: number;
    maxDrawdownFromPeak: number;
    currentDrawdownFromATH: number;
    drawdownPeriods: Array<{
      start: number;
      end: number;
      depth: number;
    }>;
  };
  
  // Volatility metrics
  volatility: {
    dailyAvg: number;       // Average daily move %
    maxDailyMove: number;   // Largest single day move
    volatilityScore: number; // 0-100 volatility rating
  };
  
  // Strategy simulations
  strategies: {
    hold: TradeResult;
    takeProfitAt: Record<string, TradeResult | null>; // "50%", "100%", "200%", etc.
    stopLossAt: Record<string, TradeResult | null>;   // "10%", "20%", "30%", etc.
  };
  
  // Optimal exit
  optimalExit: {
    price: number;
    timestamp: number;
    dateString: string;
    roi: number;
  };
  
  // Data quality
  dataSource: 'dexscreener' | 'birdeye' | 'simulated';
  candleCount: number;
  
  // Token metadata
  metadata: {
    marketCap?: number;
    liquidity?: number;
    createdAt?: number;
    tokenAge?: string;
  };
}

// Comparison result for multiple tokens
export interface ComparisonResult {
  tokens: Array<{
    token: string;
    symbol: string;
    roi: number;
    athRoi: number;
    maxDrawdown: number;
    volatility: number;
    rank: number;
  }>;
  bestPerformer: string;
  worstPerformer: string;
  avgRoi: number;
  correlations?: Record<string, Record<string, number>>;
}

/**
 * Format duration in human readable form
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().split('T')[0];
}

/**
 * Calculate ROI percentage
 */
function calcROI(entry: number, exit: number): number {
  if (entry === 0) return 0;
  return ((exit - entry) / entry) * 100;
}

/**
 * Find entry candle based on entry point config
 */
function findEntryCandle(history: PriceHistory, entry: EntryPoint): Candle | null {
  if (history.candles.length === 0) return null;
  
  if (entry.type === 'candle_index' && entry.candleIndex !== undefined) {
    const idx = Math.max(0, Math.min(entry.candleIndex, history.candles.length - 1));
    return history.candles[idx];
  }
  
  if (entry.type === 'date' && entry.date !== undefined) {
    const targetTime = typeof entry.date === 'string' 
      ? new Date(entry.date).getTime() 
      : entry.date;
    
    // Find closest candle to target time
    let closest = history.candles[0];
    let minDiff = Math.abs(closest.timestamp - targetTime);
    
    for (const candle of history.candles) {
      const diff = Math.abs(candle.timestamp - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = candle;
      }
    }
    
    return closest;
  }
  
  if (entry.type === 'price' && entry.price !== undefined) {
    // Find first candle where price crosses the entry price
    for (const candle of history.candles) {
      if (candle.low <= entry.price && candle.high >= entry.price) {
        return candle;
      }
    }
    
    // If exact price not found, find closest
    let closest = history.candles[0];
    let minDiff = Math.abs(closest.close - entry.price);
    
    for (const candle of history.candles) {
      const diff = Math.abs(candle.close - entry.price);
      if (diff < minDiff) {
        minDiff = diff;
        closest = candle;
      }
    }
    
    return closest;
  }
  
  // Default: first candle
  return history.candles[0];
}

/**
 * Simulate a strategy on price history
 */
function simulateStrategy(
  candles: Candle[],
  entryIndex: number,
  entryPrice: number,
  config: StrategyConfig
): TradeResult {
  const entryCandle = candles[entryIndex];
  let exitPrice = candles[candles.length - 1].close;
  let exitTime = candles[candles.length - 1].timestamp;
  let exitReason: TradeResult['exitReason'] = 'current';
  let peak = entryPrice;
  
  // Simulate through remaining candles
  for (let i = entryIndex + 1; i < candles.length; i++) {
    const candle = candles[i];
    const holdDays = (candle.timestamp - entryCandle.timestamp) / (24 * 60 * 60 * 1000);
    
    // Update peak for trailing stop
    if (candle.high > peak) {
      peak = candle.high;
    }
    
    // Check time limit
    if (config.holdDays && holdDays >= config.holdDays) {
      exitPrice = candle.close;
      exitTime = candle.timestamp;
      exitReason = 'time_limit';
      break;
    }
    
    // Check take profit
    if (config.takeProfitPct) {
      const tpPrice = entryPrice * (1 + config.takeProfitPct / 100);
      if (candle.high >= tpPrice) {
        exitPrice = tpPrice;
        exitTime = candle.timestamp;
        exitReason = 'take_profit';
        break;
      }
    }
    
    // Check trailing stop
    if (config.trailingStopPct) {
      const trailPrice = peak * (1 - config.trailingStopPct / 100);
      if (candle.low <= trailPrice) {
        exitPrice = trailPrice;
        exitTime = candle.timestamp;
        exitReason = 'trailing_stop';
        break;
      }
    }
    
    // Check stop loss
    if (config.stopLossPct) {
      const slPrice = entryPrice * (1 - config.stopLossPct / 100);
      if (candle.low <= slPrice) {
        exitPrice = slPrice;
        exitTime = candle.timestamp;
        exitReason = 'stop_loss';
        break;
      }
    }
  }
  
  const roi = calcROI(entryPrice, exitPrice);
  const holdDurationMs = exitTime - entryCandle.timestamp;
  
  return {
    entryPrice,
    entryTime: entryCandle.timestamp,
    exitPrice,
    exitTime,
    exitReason,
    roi: roi / 100,
    roiPercent: `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`,
    holdDurationMs,
    holdDurationHuman: formatDuration(holdDurationMs)
  };
}

/**
 * Calculate max drawdown from candles
 */
function calcMaxDrawdown(candles: Candle[], entryIndex: number): {
  maxDrawdownPct: number;
  maxDrawdownFromPeak: number;
  currentDrawdownFromATH: number;
  drawdownPeriods: Array<{ start: number; end: number; depth: number }>;
} {
  if (candles.length <= entryIndex) {
    return { maxDrawdownPct: 0, maxDrawdownFromPeak: 0, currentDrawdownFromATH: 0, drawdownPeriods: [] };
  }
  
  const relevantCandles = candles.slice(entryIndex);
  let peak = relevantCandles[0].high;
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  const periods: Array<{ start: number; end: number; depth: number }> = [];
  let inDrawdown = false;
  let drawdownStart = 0;
  
  for (const candle of relevantCandles) {
    if (candle.high > peak) {
      // New peak
      if (inDrawdown && currentDrawdown > 5) {
        periods.push({
          start: drawdownStart,
          end: candle.timestamp,
          depth: currentDrawdown
        });
      }
      peak = candle.high;
      inDrawdown = false;
      currentDrawdown = 0;
    }
    
    const drawdown = ((peak - candle.low) / peak) * 100;
    if (drawdown > currentDrawdown) {
      currentDrawdown = drawdown;
      if (!inDrawdown) {
        drawdownStart = candle.timestamp;
        inDrawdown = true;
      }
    }
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  // Current drawdown from ATH
  const lastCandle = relevantCandles[relevantCandles.length - 1];
  const currentFromPeak = ((peak - lastCandle.close) / peak) * 100;
  
  return {
    maxDrawdownPct: maxDrawdown,
    maxDrawdownFromPeak: maxDrawdown,
    currentDrawdownFromATH: currentFromPeak,
    drawdownPeriods: periods.slice(0, 5) // Top 5 drawdown periods
  };
}

/**
 * Calculate volatility metrics
 */
function calcVolatility(candles: Candle[]): {
  dailyAvg: number;
  maxDailyMove: number;
  volatilityScore: number;
} {
  if (candles.length < 2) {
    return { dailyAvg: 0, maxDailyMove: 0, volatilityScore: 50 };
  }
  
  const dailyMoves: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const curr = candles[i].close;
    const move = Math.abs((curr - prev) / prev) * 100;
    dailyMoves.push(move);
  }
  
  const avgMove = dailyMoves.reduce((a, b) => a + b, 0) / dailyMoves.length;
  const maxMove = Math.max(...dailyMoves);
  
  // Score: 0-100 where higher = more volatile
  // Typical meme coins: 5-20% daily moves
  const score = Math.min(100, Math.max(0, avgMove * 5));
  
  return {
    dailyAvg: avgMove,
    maxDailyMove: maxMove,
    volatilityScore: score
  };
}

/**
 * Analyze a token with a simulated entry point
 */
export async function analyzeToken(
  token: string,
  entry?: EntryPoint,
  interval: CandleInterval = '1h',
  daysBack: number = 30
): Promise<BacktestResult> {
  // Fetch historical data
  const history = await fetchPriceHistory(token, interval, daysBack);
  
  if (history.candles.length === 0) {
    throw new Error(`No price history available for ${token}`);
  }
  
  // Determine entry point
  const entryPoint = entry || { type: 'candle_index', candleIndex: 0 };
  const entryCandle = findEntryCandle(history, entryPoint);
  
  if (!entryCandle) {
    throw new Error('Could not determine entry point');
  }
  
  // Find entry index
  const entryIndex = history.candles.findIndex(c => c.timestamp === entryCandle.timestamp);
  const entryPrice = entryCandle.close;
  
  // Current state
  const currentCandle = history.candles[history.candles.length - 1];
  const currentPrice = currentCandle.close;
  
  // Get ATH and ATL after entry
  const afterEntry = history.candles.slice(entryIndex);
  const athCandle = afterEntry.reduce((max, c) => c.high > max.high ? c : max, afterEntry[0]);
  const atlCandle = afterEntry.reduce((min, c) => c.low < min.low ? c : min, afterEntry[0]);
  
  // Calculate ROI metrics
  const totalRoi = calcROI(entryPrice, currentPrice);
  const athRoi = calcROI(entryPrice, athCandle.high);
  const atlRoi = calcROI(entryPrice, atlCandle.low);
  
  // Drawdown analysis
  const drawdown = calcMaxDrawdown(history.candles, entryIndex);
  
  // Volatility
  const volatility = calcVolatility(afterEntry);
  
  // Strategy simulations
  const holdResult = simulateStrategy(history.candles, entryIndex, entryPrice, {});
  
  const takeProfitLevels = [50, 100, 200, 500, 1000];
  const stopLossLevels = [10, 20, 30, 50];
  
  const tpResults: Record<string, TradeResult | null> = {};
  const slResults: Record<string, TradeResult | null> = {};
  
  for (const tp of takeProfitLevels) {
    const result = simulateStrategy(history.candles, entryIndex, entryPrice, { takeProfitPct: tp });
    tpResults[`${tp}%`] = result.exitReason === 'take_profit' ? result : null;
  }
  
  for (const sl of stopLossLevels) {
    const result = simulateStrategy(history.candles, entryIndex, entryPrice, { stopLossPct: sl });
    slResults[`${sl}%`] = result.exitReason === 'stop_loss' ? result : null;
  }
  
  // Calculate token age
  const tokenAgeMs = history.createdAt ? Date.now() - history.createdAt : 0;
  const tokenAge = tokenAgeMs > 0 ? formatDuration(tokenAgeMs) : 'Unknown';
  
  return {
    token,
    symbol: history.symbol,
    name: history.name,
    
    entry: {
      price: entryPrice,
      timestamp: entryCandle.timestamp,
      dateString: formatDate(entryCandle.timestamp)
    },
    
    current: {
      price: currentPrice,
      timestamp: currentCandle.timestamp,
      dateString: formatDate(currentCandle.timestamp)
    },
    
    roi: {
      total: totalRoi,
      toATH: athRoi,
      maxGain: athRoi,
      maxLoss: atlRoi
    },
    
    ath: {
      price: athCandle.high,
      timestamp: athCandle.timestamp,
      dateString: formatDate(athCandle.timestamp),
      fromEntry: athRoi
    },
    
    atl: {
      price: atlCandle.low,
      timestamp: atlCandle.timestamp,
      dateString: formatDate(atlCandle.timestamp),
      fromEntry: atlRoi
    },
    
    drawdown,
    volatility,
    
    strategies: {
      hold: holdResult,
      takeProfitAt: tpResults,
      stopLossAt: slResults
    },
    
    optimalExit: {
      price: athCandle.high,
      timestamp: athCandle.timestamp,
      dateString: formatDate(athCandle.timestamp),
      roi: athRoi
    },
    
    dataSource: history.dataSource,
    candleCount: history.candles.length,
    
    metadata: {
      marketCap: history.marketCap,
      liquidity: history.liquidity,
      createdAt: history.createdAt,
      tokenAge
    }
  };
}

/**
 * Simulate entry at a specific price
 */
export async function simulateEntry(
  token: string,
  entryPrice: number,
  entryDate?: string | number,
  interval: CandleInterval = '1h',
  daysBack: number = 30
): Promise<BacktestResult> {
  const entry: EntryPoint = entryDate
    ? { type: 'date', date: entryDate }
    : { type: 'price', price: entryPrice };
  
  return analyzeToken(token, entry, interval, daysBack);
}

/**
 * Test multiple strategies on a token
 */
export async function testStrategy(
  token: string,
  strategy: StrategyConfig,
  entry?: EntryPoint,
  interval: CandleInterval = '1h',
  daysBack: number = 30
): Promise<{
  result: TradeResult;
  comparison: {
    vsHold: number;       // % difference vs just holding
    vsOptimal: number;    // % difference vs optimal exit
  };
}> {
  const history = await fetchPriceHistory(token, interval, daysBack);
  
  if (history.candles.length === 0) {
    throw new Error(`No price history available for ${token}`);
  }
  
  const entryPoint = entry || { type: 'candle_index', candleIndex: 0 };
  const entryCandle = findEntryCandle(history, entryPoint);
  
  if (!entryCandle) {
    throw new Error('Could not determine entry point');
  }
  
  const entryIndex = history.candles.findIndex(c => c.timestamp === entryCandle.timestamp);
  const entryPrice = entryCandle.close;
  
  // Run strategy
  const result = simulateStrategy(history.candles, entryIndex, entryPrice, strategy);
  
  // Compare to hold
  const holdResult = simulateStrategy(history.candles, entryIndex, entryPrice, {});
  
  // Get ATH for optimal comparison
  const afterEntry = history.candles.slice(entryIndex);
  const athCandle = afterEntry.reduce((max, c) => c.high > max.high ? c : max, afterEntry[0]);
  const optimalRoi = calcROI(entryPrice, athCandle.high);
  
  return {
    result,
    comparison: {
      vsHold: result.roi * 100 - holdResult.roi * 100,
      vsOptimal: result.roi * 100 - optimalRoi
    }
  };
}

/**
 * Compare multiple tokens over the same period
 */
export async function compareTokens(
  tokens: string[],
  entry?: EntryPoint,
  interval: CandleInterval = '1h',
  daysBack: number = 30
): Promise<ComparisonResult> {
  const results: ComparisonResult['tokens'] = [];
  
  for (const token of tokens) {
    try {
      const analysis = await analyzeToken(token, entry, interval, daysBack);
      results.push({
        token,
        symbol: analysis.symbol,
        roi: analysis.roi.total,
        athRoi: analysis.roi.toATH,
        maxDrawdown: analysis.drawdown.maxDrawdownPct,
        volatility: analysis.volatility.volatilityScore,
        rank: 0
      });
    } catch (error) {
      console.error(`[BACKTEST] Error analyzing ${token}:`, error);
    }
  }
  
  // Rank by ROI
  results.sort((a, b) => b.roi - a.roi);
  results.forEach((r, i) => r.rank = i + 1);
  
  const avgRoi = results.length > 0
    ? results.reduce((sum, r) => sum + r.roi, 0) / results.length
    : 0;
  
  return {
    tokens: results,
    bestPerformer: results[0]?.symbol || 'N/A',
    worstPerformer: results[results.length - 1]?.symbol || 'N/A',
    avgRoi
  };
}

/**
 * Format backtest result for display
 */
export function formatBacktestResult(result: BacktestResult): string {
  const roiEmoji = result.roi.total >= 0 ? '📈' : '📉';
  const roiSign = result.roi.total >= 0 ? '+' : '';
  
  return `
🔍 BACKTEST: $${result.symbol}
═══════════════════════════════════════

📊 ENTRY
   Price: $${result.entry.price.toFixed(10)}
   Date: ${result.entry.dateString}

📊 CURRENT
   Price: $${result.current.price.toFixed(10)}
   Date: ${result.current.dateString}

${roiEmoji} ROI: ${roiSign}${result.roi.total.toFixed(2)}%

🏆 ATH: $${result.ath.price.toFixed(10)} (${result.ath.dateString})
   From Entry: +${result.ath.fromEntry.toFixed(2)}%

📉 Max Drawdown: -${result.drawdown.maxDrawdownPct.toFixed(2)}%
   Current from ATH: -${result.drawdown.currentDrawdownFromATH.toFixed(2)}%

💎 OPTIMAL EXIT
   Price: $${result.optimalExit.price.toFixed(10)}
   Date: ${result.optimalExit.dateString}
   ROI: +${result.optimalExit.roi.toFixed(2)}%

📈 STRATEGY RESULTS
   Hold: ${result.strategies.hold.roiPercent} (${result.strategies.hold.holdDurationHuman})
   TP 100%: ${result.strategies.takeProfitAt['100%']?.roiPercent || 'Not hit'}
   TP 200%: ${result.strategies.takeProfitAt['200%']?.roiPercent || 'Not hit'}
   SL 20%: ${result.strategies.stopLossAt['20%']?.roiPercent || 'Not hit'}

📊 VOLATILITY
   Daily Avg: ${result.volatility.dailyAvg.toFixed(2)}%
   Max Move: ${result.volatility.maxDailyMove.toFixed(2)}%
   Score: ${result.volatility.volatilityScore.toFixed(0)}/100

📡 Data: ${result.dataSource} (${result.candleCount} candles)
${result.metadata.marketCap ? `💰 MCap: $${(result.metadata.marketCap / 1000000).toFixed(2)}M` : ''}
${result.metadata.tokenAge ? `⏰ Age: ${result.metadata.tokenAge}` : ''}
`.trim();
}

/**
 * Get price history for charting
 */
export async function getChartData(
  token: string,
  interval: CandleInterval = '1h',
  daysBack: number = 30,
  entryTimestamp?: number
): Promise<{
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  entryMarker?: { time: number; price: number };
  athMarker?: { time: number; price: number };
  atlMarker?: { time: number; price: number };
}> {
  const history = await fetchPriceHistory(token, interval, daysBack);
  
  let entryMarker;
  let athMarker;
  let atlMarker;
  
  if (entryTimestamp && history.candles.length > 0) {
    const entryCandle = findEntryCandle(history, { type: 'date', date: entryTimestamp });
    if (entryCandle) {
      entryMarker = { time: entryCandle.timestamp, price: entryCandle.close };
      
      // Find ATH/ATL after entry
      const entryIdx = history.candles.findIndex(c => c.timestamp === entryCandle.timestamp);
      const afterEntry = history.candles.slice(entryIdx);
      
      const ath = afterEntry.reduce((max, c) => c.high > max.high ? c : max, afterEntry[0]);
      const atl = afterEntry.reduce((min, c) => c.low < min.low ? c : min, afterEntry[0]);
      
      athMarker = { time: ath.timestamp, price: ath.high };
      atlMarker = { time: atl.timestamp, price: atl.low };
    }
  }
  
  return {
    candles: history.candles.map(c => ({
      time: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    })),
    entryMarker,
    athMarker,
    atlMarker
  };
}

export {
  fetchPriceHistory,
  fetchTokenInfo,
  CandleInterval
};
