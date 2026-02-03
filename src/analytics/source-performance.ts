/**
 * Source Performance Analytics
 * Tracks and analyzes performance by signal source
 */

import { AggregatedSignal, SignalSource } from '../types';

// Source performance record
export interface SourcePerformance {
  source: SignalSource;
  totalSignals: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  avgScore: number;
  avgRoi: number;
  totalRoi: number;
  bestSignal: {
    symbol: string;
    roi: number;
    timestamp: number;
  } | null;
  worstSignal: {
    symbol: string;
    roi: number;
    timestamp: number;
  } | null;
  recentTrend: 'improving' | 'declining' | 'stable';
  confidence: number; // Statistical confidence based on sample size
}

// Time-based performance
export interface TimePerformance {
  period: string;
  signals: number;
  winRate: number;
  avgRoi: number;
}

// In-memory analytics store
const sourceStats = new Map<
  SignalSource,
  {
    signals: AggregatedSignal[];
    outcomes: Map<string, { roi: number; status: 'win' | 'loss' }>;
  }
>();

// Initialize source tracking
export function initSourceTracking(): void {
  const sources: SignalSource[] = [
    'smart-wallet-elite',
    'smart-wallet-sniper',
    'volume-spike',
    'kol-tracker',
    'kol-social',
    'narrative-new',
    'narrative-momentum',
    'new-listing',
    'whale-accumulation'
  ];

  for (const source of sources) {
    sourceStats.set(source, { signals: [], outcomes: new Map() });
  }
}

// Track a signal
export function trackSignalSource(signal: AggregatedSignal): void {
  for (const source of signal.sources) {
    const stats = sourceStats.get(source.source);
    if (stats) {
      stats.signals.push(signal);
    }
  }
}

// Record outcome for a signal
export function recordOutcome(
  signalId: string,
  sources: SignalSource[],
  roi: number,
  status: 'win' | 'loss'
): void {
  for (const source of sources) {
    const stats = sourceStats.get(source);
    if (stats) {
      stats.outcomes.set(signalId, { roi, status });
    }
  }
}

// Calculate performance for a source
export function getSourcePerformance(source: SignalSource): SourcePerformance {
  const stats = sourceStats.get(source);

  if (!stats || stats.signals.length === 0) {
    return {
      source,
      totalSignals: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      winRate: 0,
      avgScore: 0,
      avgRoi: 0,
      totalRoi: 0,
      bestSignal: null,
      worstSignal: null,
      recentTrend: 'stable',
      confidence: 0
    };
  }

  const { signals, outcomes } = stats;

  let wins = 0;
  let losses = 0;
  let totalRoi = 0;
  let totalScore = 0;
  let bestSignal: SourcePerformance['bestSignal'] = null;
  let worstSignal: SourcePerformance['worstSignal'] = null;

  for (const signal of signals) {
    totalScore += signal.score;

    const outcome = outcomes.get(signal.id);
    if (outcome) {
      if (outcome.status === 'win') wins++;
      else losses++;
      totalRoi += outcome.roi;

      if (!bestSignal || outcome.roi > bestSignal.roi) {
        bestSignal = { symbol: signal.symbol, roi: outcome.roi, timestamp: signal.timestamp };
      }
      if (!worstSignal || outcome.roi < worstSignal.roi) {
        worstSignal = { symbol: signal.symbol, roi: outcome.roi, timestamp: signal.timestamp };
      }
    }
  }

  const closedSignals = wins + losses;
  const pending = signals.length - closedSignals;

  // Calculate recent trend (last 20 vs previous 20)
  const recentSignals = signals.slice(-20);
  const previousSignals = signals.slice(-40, -20);

  let recentWinRate = 0;
  let previousWinRate = 0;

  if (recentSignals.length > 0) {
    const recentWins = recentSignals.filter(s => outcomes.get(s.id)?.status === 'win').length;
    const recentClosed = recentSignals.filter(s => outcomes.has(s.id)).length;
    recentWinRate = recentClosed > 0 ? recentWins / recentClosed : 0;
  }

  if (previousSignals.length > 0) {
    const prevWins = previousSignals.filter(s => outcomes.get(s.id)?.status === 'win').length;
    const prevClosed = previousSignals.filter(s => outcomes.has(s.id)).length;
    previousWinRate = prevClosed > 0 ? prevWins / prevClosed : 0;
  }

  let recentTrend: SourcePerformance['recentTrend'] = 'stable';
  if (recentWinRate - previousWinRate > 0.1) recentTrend = 'improving';
  else if (previousWinRate - recentWinRate > 0.1) recentTrend = 'declining';

  // Statistical confidence (based on sample size)
  const confidence = Math.min(100, Math.sqrt(closedSignals) * 10);

  return {
    source,
    totalSignals: signals.length,
    wins,
    losses,
    pending,
    winRate: closedSignals > 0 ? (wins / closedSignals) * 100 : 0,
    avgScore: signals.length > 0 ? totalScore / signals.length : 0,
    avgRoi: closedSignals > 0 ? totalRoi / closedSignals : 0,
    totalRoi,
    bestSignal,
    worstSignal,
    recentTrend,
    confidence
  };
}

// Get all source performances
export function getAllSourcePerformances(): SourcePerformance[] {
  const performances: SourcePerformance[] = [];

  for (const source of sourceStats.keys()) {
    performances.push(getSourcePerformance(source));
  }

  // Sort by win rate (descending)
  return performances.sort((a, b) => b.winRate - a.winRate);
}

// Get performance by time period
export function getTimeBasedPerformance(
  source: SignalSource,
  periodMs: number = 24 * 60 * 60 * 1000 // Default: 24 hours
): TimePerformance[] {
  const stats = sourceStats.get(source);
  if (!stats) return [];

  const { signals, outcomes } = stats;
  const periods = new Map<
    number,
    { signals: number; wins: number; totalRoi: number; closed: number }
  >();

  for (const signal of signals) {
    const periodStart = Math.floor(signal.timestamp / periodMs) * periodMs;

    const period = periods.get(periodStart) || { signals: 0, wins: 0, totalRoi: 0, closed: 0 };
    period.signals++;

    const outcome = outcomes.get(signal.id);
    if (outcome) {
      period.closed++;
      period.totalRoi += outcome.roi;
      if (outcome.status === 'win') period.wins++;
    }

    periods.set(periodStart, period);
  }

  const result: TimePerformance[] = [];

  for (const [timestamp, data] of periods) {
    result.push({
      period: new Date(timestamp).toISOString().split('T')[0],
      signals: data.signals,
      winRate: data.closed > 0 ? (data.wins / data.closed) * 100 : 0,
      avgRoi: data.closed > 0 ? data.totalRoi / data.closed : 0
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}

// Get source comparison
export function compareSourcePerformance(): {
  best: { source: SignalSource; winRate: number };
  worst: { source: SignalSource; winRate: number };
  mostSignals: { source: SignalSource; count: number };
  highestAvgScore: { source: SignalSource; score: number };
} {
  const performances = getAllSourcePerformances();

  const withData = performances.filter(p => p.totalSignals > 0);
  const withOutcomes = performances.filter(p => p.wins + p.losses > 0);

  return {
    best:
      withOutcomes.length > 0
        ? { source: withOutcomes[0].source, winRate: withOutcomes[0].winRate }
        : { source: 'smart-wallet-elite', winRate: 0 },
    worst:
      withOutcomes.length > 0
        ? {
            source: withOutcomes[withOutcomes.length - 1].source,
            winRate: withOutcomes[withOutcomes.length - 1].winRate
          }
        : { source: 'volume-spike', winRate: 0 },
    mostSignals:
      withData.length > 0
        ? {
            source: withData.reduce((a, b) => (a.totalSignals > b.totalSignals ? a : b)).source,
            count: withData.reduce((a, b) => (a.totalSignals > b.totalSignals ? a : b)).totalSignals
          }
        : { source: 'volume-spike', count: 0 },
    highestAvgScore:
      withData.length > 0
        ? {
            source: withData.reduce((a, b) => (a.avgScore > b.avgScore ? a : b)).source,
            score: withData.reduce((a, b) => (a.avgScore > b.avgScore ? a : b)).avgScore
          }
        : { source: 'smart-wallet-elite', score: 0 }
  };
}

// Format performance report
export function formatPerformanceReport(): string {
  const performances = getAllSourcePerformances();
  const comparison = compareSourcePerformance();

  let report = `
📊 SOURCE PERFORMANCE REPORT
════════════════════════════════════════

🏆 Best Performer: ${comparison.best.source} (${comparison.best.winRate.toFixed(1)}% WR)
📉 Worst Performer: ${comparison.worst.source} (${comparison.worst.winRate.toFixed(1)}% WR)
📈 Most Active: ${comparison.mostSignals.source} (${comparison.mostSignals.count} signals)

Detailed Breakdown:
`;

  for (const perf of performances) {
    const trendEmoji =
      perf.recentTrend === 'improving' ? '📈' : perf.recentTrend === 'declining' ? '📉' : '➡️';
    report += `
${perf.source}
  Signals: ${perf.totalSignals} (W: ${perf.wins} / L: ${perf.losses} / P: ${perf.pending})
  Win Rate: ${perf.winRate.toFixed(1)}% ${trendEmoji}
  Avg Score: ${perf.avgScore.toFixed(1)}
  Avg ROI: ${perf.avgRoi >= 0 ? '+' : ''}${perf.avgRoi.toFixed(1)}%
  Confidence: ${perf.confidence.toFixed(0)}%
`;
  }

  return report.trim();
}

// Initialize on module load
initSourceTracking();
