/**
 * Backtest Module
 * Token analysis and historical simulation tools
 */

// Token analyzer exports (primary backtest API)
export {
  analyzeToken,
  simulateEntry,
  testStrategy,
  compareTokens,
  formatBacktestResult,
  getChartData,
  fetchPriceHistory,
  fetchTokenInfo,
  EntryPoint,
  StrategyConfig,
  TradeResult,
  BacktestResult,
  ComparisonResult,
  CandleInterval
} from './token-analyzer';

// Historical data exports
export {
  PriceHistory,
  Candle,
  getPriceAtTime,
  getATH,
  getATL,
  clearHistoryCache,
  getHistoryCacheStats
} from './historical-data';

// Portfolio backtest engine (re-exported with aliases to avoid conflicts)
export {
  runBacktest as runPortfolioBacktest,
  formatBacktestResult as formatPortfolioBacktestResult,
  BacktestConfig as PortfolioBacktestConfig,
  BacktestMetrics as PortfolioBacktestMetrics,
  Trade as PortfolioTrade,
  BacktestResult as PortfolioBacktestResult
} from './engine';
