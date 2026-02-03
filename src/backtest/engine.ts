/**
 * Backtesting Engine
 * Simulates historical performance of signal strategies
 */

import { AggregatedSignal } from '../types';

// Historical price data point
interface PricePoint {
  timestamp: number;
  price: number;
  mcap: number;
  volume: number;
}

// Backtest configuration
export interface BacktestConfig {
  startDate: number;
  endDate: number;
  initialCapital: number;
  positionSize: number; // % of capital per trade
  minScore: number;
  maxPositions: number;
  takeProfitPct: number;
  stopLossPct: number;
  maxHoldingTime: number; // minutes
}

// Trade record
export interface Trade {
  id: string;
  token: string;
  symbol: string;
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  size: number;
  pnl?: number;
  pnlPct?: number;
  exitReason?: 'take_profit' | 'stop_loss' | 'time_limit' | 'manual';
  signalScore: number;
  signalSources: string[];
}

// Backtest result
export interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  metrics: BacktestMetrics;
  equity: EquityPoint[];
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgHoldingTime: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalReturn: number;
  totalReturnPct: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
}

interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

// Default config
const DEFAULT_CONFIG: BacktestConfig = {
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
  endDate: Date.now(),
  initialCapital: 10000,
  positionSize: 5, // 5% per trade
  minScore: 70,
  maxPositions: 5,
  takeProfitPct: 50, // 50% take profit
  stopLossPct: 20, // 20% stop loss
  maxHoldingTime: 60 // 60 minutes
};

// Simulated price fetcher (would use actual historical data in production)
async function fetchHistoricalPrices(
  token: string,
  startTime: number,
  endTime: number
): Promise<PricePoint[]> {
  // TODO: Integrate with Birdeye/DexScreener historical API
  // For now, return simulated data
  const points: PricePoint[] = [];
  let price = Math.random() * 0.001;

  for (let t = startTime; t <= endTime; t += 60000) {
    // 1 minute intervals
    // Random walk with slight upward bias
    const change = (Math.random() - 0.48) * 0.1;
    price = Math.max(0.0000001, price * (1 + change));

    points.push({
      timestamp: t,
      price,
      mcap: price * 1000000000, // Assume 1B supply
      volume: Math.random() * 100000
    });
  }

  return points;
}

// Run backtest
export async function runBacktest(
  signals: AggregatedSignal[],
  config: Partial<BacktestConfig> = {}
): Promise<BacktestResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Filter signals by date range and min score
  const filteredSignals = signals
    .filter(
      s => s.timestamp >= cfg.startDate && s.timestamp <= cfg.endDate && s.score >= cfg.minScore
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  let capital = cfg.initialCapital;
  let peakEquity = capital;
  let maxDrawdown = 0;
  const openPositions: Map<string, Trade> = new Map();

  // Process each signal
  for (const signal of filteredSignals) {
    // Check if we can open new position
    if (openPositions.size < cfg.maxPositions) {
      const positionValue = capital * (cfg.positionSize / 100);

      // Open position
      const trade: Trade = {
        id: `bt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        token: signal.token,
        symbol: signal.symbol,
        entryTime: signal.timestamp,
        entryPrice: signal.marketData.mcap / 1000000000, // Simulated price
        size: positionValue,
        signalScore: signal.score,
        signalSources: signal.sources.map(s => s.source)
      };

      openPositions.set(signal.token, trade);
    }

    // Check existing positions for exit conditions
    for (const [token, trade] of openPositions) {
      const holdingTime = (signal.timestamp - trade.entryTime) / 60000;

      // Simulate price movement based on signal quality
      const priceMultiplier = 1 + (Math.random() - 0.3) * (trade.signalScore / 100);
      const currentPrice = trade.entryPrice * priceMultiplier;
      const pnlPct = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;

      let shouldExit = false;
      let exitReason: Trade['exitReason'];

      if (pnlPct >= cfg.takeProfitPct) {
        shouldExit = true;
        exitReason = 'take_profit';
      } else if (pnlPct <= -cfg.stopLossPct) {
        shouldExit = true;
        exitReason = 'stop_loss';
      } else if (holdingTime >= cfg.maxHoldingTime) {
        shouldExit = true;
        exitReason = 'time_limit';
      }

      if (shouldExit) {
        trade.exitTime = signal.timestamp;
        trade.exitPrice = currentPrice;
        trade.pnlPct = pnlPct;
        trade.pnl = trade.size * (pnlPct / 100);
        trade.exitReason = exitReason;

        capital += trade.pnl;
        trades.push(trade);
        openPositions.delete(token);

        // Track equity
        equity.push({
          timestamp: signal.timestamp,
          equity: capital,
          drawdown: ((peakEquity - capital) / peakEquity) * 100
        });

        if (capital > peakEquity) peakEquity = capital;
        const currentDrawdown = ((peakEquity - capital) / peakEquity) * 100;
        if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;
      }
    }
  }

  // Close remaining positions at end
  for (const [_, trade] of openPositions) {
    const pnlPct = (Math.random() - 0.4) * 50; // Random close
    trade.exitTime = cfg.endDate;
    trade.exitPrice = trade.entryPrice * (1 + pnlPct / 100);
    trade.pnlPct = pnlPct;
    trade.pnl = trade.size * (pnlPct / 100);
    trade.exitReason = 'time_limit';
    capital += trade.pnl;
    trades.push(trade);
  }

  // Calculate metrics
  const metrics = calculateMetrics(trades, cfg.initialCapital, capital, maxDrawdown);

  return {
    config: cfg,
    trades,
    metrics,
    equity
  };
}

// Calculate backtest metrics
function calculateMetrics(
  trades: Trade[],
  initialCapital: number,
  finalCapital: number,
  maxDrawdown: number
): BacktestMetrics {
  const winners = trades.filter(t => (t.pnl || 0) > 0);
  const losers = trades.filter(t => (t.pnl || 0) < 0);

  const totalWins = winners.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalLosses = Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0));

  const avgHoldingTime =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + ((t.exitTime || 0) - t.entryTime), 0) /
        trades.length /
        60000
      : 0;

  // Find best and worst trades
  let bestTrade: Trade | null = null;
  let worstTrade: Trade | null = null;

  for (const trade of trades) {
    if (!bestTrade || (trade.pnlPct || 0) > (bestTrade.pnlPct || 0)) {
      bestTrade = trade;
    }
    if (!worstTrade || (trade.pnlPct || 0) < (worstTrade.pnlPct || 0)) {
      worstTrade = trade;
    }
  }

  return {
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: trades.length > 0 ? (winners.length / trades.length) * 100 : 0,
    avgWin: winners.length > 0 ? totalWins / winners.length : 0,
    avgLoss: losers.length > 0 ? totalLosses / losers.length : 0,
    avgHoldingTime,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    maxDrawdown,
    sharpeRatio: calculateSharpeRatio(trades),
    totalReturn: finalCapital - initialCapital,
    totalReturnPct: ((finalCapital - initialCapital) / initialCapital) * 100,
    bestTrade,
    worstTrade
  };
}

// Calculate Sharpe Ratio
function calculateSharpeRatio(trades: Trade[]): number {
  if (trades.length < 2) return 0;

  const returns = trades.map(t => t.pnlPct || 0);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualized (assuming 365 days of trading)
  return (avgReturn * Math.sqrt(365)) / stdDev;
}

// Format backtest result for display
export function formatBacktestResult(result: BacktestResult): string {
  const { metrics, config } = result;

  return `
📊 BACKTEST RESULTS
════════════════════════════════════════

Configuration:
  • Period: ${new Date(config.startDate).toLocaleDateString()} - ${new Date(config.endDate).toLocaleDateString()}
  • Initial Capital: $${config.initialCapital.toLocaleString()}
  • Min Score: ${config.minScore}
  • Position Size: ${config.positionSize}%
  • TP/SL: +${config.takeProfitPct}% / -${config.stopLossPct}%

Performance:
  • Total Return: ${metrics.totalReturnPct >= 0 ? '+' : ''}${metrics.totalReturnPct.toFixed(2)}% ($${metrics.totalReturn.toFixed(2)})
  • Win Rate: ${metrics.winRate.toFixed(1)}%
  • Profit Factor: ${metrics.profitFactor.toFixed(2)}
  • Max Drawdown: ${metrics.maxDrawdown.toFixed(2)}%
  • Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}

Trades:
  • Total: ${metrics.totalTrades}
  • Winners: ${metrics.winningTrades}
  • Losers: ${metrics.losingTrades}
  • Avg Win: $${metrics.avgWin.toFixed(2)}
  • Avg Loss: $${metrics.avgLoss.toFixed(2)}
  • Avg Hold: ${metrics.avgHoldingTime.toFixed(1)} min

${metrics.bestTrade ? `Best Trade: $${metrics.bestTrade.symbol} +${metrics.bestTrade.pnlPct?.toFixed(1)}%` : ''}
${metrics.worstTrade ? `Worst Trade: $${metrics.worstTrade.symbol} ${metrics.worstTrade.pnlPct?.toFixed(1)}%` : ''}
  `.trim();
}

export { DEFAULT_CONFIG };
