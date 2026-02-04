/**
 * Analytics Module Exports
 */

// Source Performance
export {
  initSourceTracking,
  trackSignalSource,
  recordOutcome,
  getSourcePerformance,
  getAllSourcePerformances,
  getTimeBasedPerformance,
  compareSourcePerformance,
  formatPerformanceReport
} from './source-performance';

// KOL Reliability Tracking
export {
  recordKOLCall,
  recordKOLCallFromSignal,
  updateKOLCallPrice,
  updateAllKOLCallPrices,
  getKOLStats,
  getKOLHistory,
  getAllKOLHandles,
  getKOLLeaderboard,
  getKOLReliabilityScore,
  getKOLSignalWeight,
  shouldIgnoreKOL,
  generateDemoKOLData,
  kolCalls,
  kolIndex
} from './kol-reliability';

export type {
  KOLCall,
  KOLStats,
  KOLBadge,
  KOLLeaderboard
} from './kol-reliability';

// Charts
export {
  getSignalsOverTime,
  getScoreDistribution,
  getRiskDistribution,
  getSourceBreakdown,
  getNarrativeBreakdown,
  getWinRateOverTime,
  getRoiDistribution,
  getHourlyActivity,
  getDashboardCharts,
  getDashboardStats,
  COLORS
} from './charts';

// Correlation & Advanced Analytics
export {
  recordPrice,
  getPriceHistory,
  calculateCorrelation,
  getCorrelatedTokens,
  analyzeLeadLag,
  getSectorCorrelation,
  getAllSectorCorrelations,
  getRelatedTokens,
  recordTrade,
  closeTrade,
  updateTradePeak,
  getTradeHistory,
  getOpenTrades,
  getPerformanceStats,
  getHourlyPerformance,
  getSourcePnLStats,
  getPnLChartData,
  getWinLossDistribution,
  seedDemoData,
  tokenPriceHistory,
  tradeHistory,
  SECTORS,
  NARRATIVES
} from './correlation';

// Types
export type {
  PricePoint,
  TokenTracking,
  CorrelationResult,
  SectorCorrelation,
  LeadLagResult,
  RelatedToken,
  TradeRecord,
  PerformanceStats,
  HourlyPerformance,
  SourcePnLStats,
  PnLChartData
} from './correlation';
