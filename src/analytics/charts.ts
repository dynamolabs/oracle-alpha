/**
 * Chart Data Generation
 * Prepares data for dashboard visualizations
 */

import { AggregatedSignal, SignalSource } from '../types';

// Time series data point
interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  label?: string;
}

// Distribution data
interface DistributionPoint {
  label: string;
  value: number;
  color?: string;
}

// Chart configuration
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  title: string;
  data: any[];
  xAxis?: string;
  yAxis?: string;
  colors?: string[];
}

// Colors for different risk levels and sources
const COLORS = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  EXTREME: '#ef4444',
  primary: '#7c3aed',
  secondary: '#06b6d4',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444'
};

// Generate signals over time chart data
export function getSignalsOverTime(
  signals: AggregatedSignal[],
  periodMs: number = 3600000 // 1 hour default
): ChartConfig {
  const buckets = new Map<number, number>();

  for (const signal of signals) {
    const bucket = Math.floor(signal.timestamp / periodMs) * periodMs;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }

  const data: TimeSeriesPoint[] = Array.from(buckets.entries())
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    type: 'area',
    title: 'Signals Over Time',
    data,
    xAxis: 'Time',
    yAxis: 'Signal Count'
  };
}

// Generate score distribution chart
export function getScoreDistribution(signals: AggregatedSignal[]): ChartConfig {
  const ranges = [
    { min: 90, max: 100, label: '90-100' },
    { min: 80, max: 89, label: '80-89' },
    { min: 70, max: 79, label: '70-79' },
    { min: 60, max: 69, label: '60-69' },
    { min: 50, max: 59, label: '50-59' },
    { min: 0, max: 49, label: '<50' }
  ];

  const data: DistributionPoint[] = ranges.map(range => ({
    label: range.label,
    value: signals.filter(s => s.score >= range.min && s.score <= range.max).length,
    color: range.min >= 80 ? COLORS.success : range.min >= 60 ? COLORS.warning : COLORS.error
  }));

  return {
    type: 'bar',
    title: 'Score Distribution',
    data,
    xAxis: 'Score Range',
    yAxis: 'Count',
    colors: data.map(d => d.color || COLORS.primary)
  };
}

// Generate risk level distribution
export function getRiskDistribution(signals: AggregatedSignal[]): ChartConfig {
  const counts = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    EXTREME: 0
  };

  for (const signal of signals) {
    counts[signal.riskLevel]++;
  }

  const data: DistributionPoint[] = Object.entries(counts).map(([label, value]) => ({
    label,
    value,
    color: COLORS[label as keyof typeof COLORS]
  }));

  return {
    type: 'pie',
    title: 'Risk Level Distribution',
    data,
    colors: data.map(d => d.color || COLORS.primary)
  };
}

// Generate source breakdown chart
export function getSourceBreakdown(signals: AggregatedSignal[]): ChartConfig {
  const sourceCounts = new Map<SignalSource, number>();

  for (const signal of signals) {
    for (const source of signal.sources) {
      sourceCounts.set(source.source, (sourceCounts.get(source.source) || 0) + 1);
    }
  }

  const data: DistributionPoint[] = Array.from(sourceCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    type: 'bar',
    title: 'Signals by Source',
    data,
    xAxis: 'Source',
    yAxis: 'Signal Count'
  };
}

// Generate narrative breakdown
export function getNarrativeBreakdown(signals: AggregatedSignal[]): ChartConfig {
  const narrativeCounts = new Map<string, number>();

  for (const signal of signals) {
    const narratives = signal.analysis?.narrative || [];
    for (const narrative of narratives) {
      narrativeCounts.set(narrative, (narrativeCounts.get(narrative) || 0) + 1);
    }
  }

  const data: DistributionPoint[] = Array.from(narrativeCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    type: 'pie',
    title: 'Narrative Distribution',
    data
  };
}

// Generate win rate over time
export function getWinRateOverTime(
  signals: AggregatedSignal[],
  periodMs: number = 86400000 // 1 day default
): ChartConfig {
  const buckets = new Map<number, { wins: number; total: number }>();

  for (const signal of signals) {
    if (!signal.performance) continue;

    const bucket = Math.floor(signal.timestamp / periodMs) * periodMs;
    const current = buckets.get(bucket) || { wins: 0, total: 0 };

    current.total++;
    if (signal.performance.status === 'WIN') current.wins++;

    buckets.set(bucket, current);
  }

  const data: TimeSeriesPoint[] = Array.from(buckets.entries())
    .map(([timestamp, { wins, total }]) => ({
      timestamp,
      value: total > 0 ? (wins / total) * 100 : 0
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    type: 'line',
    title: 'Win Rate Over Time',
    data,
    xAxis: 'Date',
    yAxis: 'Win Rate (%)'
  };
}

// Generate ROI distribution
export function getRoiDistribution(signals: AggregatedSignal[]): ChartConfig {
  const ranges = [
    { min: 100, max: Infinity, label: '>100%' },
    { min: 50, max: 100, label: '50-100%' },
    { min: 20, max: 50, label: '20-50%' },
    { min: 0, max: 20, label: '0-20%' },
    { min: -20, max: 0, label: '-20-0%' },
    { min: -50, max: -20, label: '-50--20%' },
    { min: -Infinity, max: -50, label: '<-50%' }
  ];

  const signalsWithRoi = signals.filter(s => s.performance?.roi !== undefined);

  const data: DistributionPoint[] = ranges.map(range => ({
    label: range.label,
    value: signalsWithRoi.filter(s => {
      const roi = s.performance!.roi;
      return roi >= range.min && roi < range.max;
    }).length,
    color: range.min >= 0 ? COLORS.success : COLORS.error
  }));

  return {
    type: 'bar',
    title: 'ROI Distribution',
    data,
    xAxis: 'ROI Range',
    yAxis: 'Count'
  };
}

// Generate hourly activity heatmap data
export function getHourlyActivity(signals: AggregatedSignal[]): ChartConfig {
  const hourCounts = new Array(24).fill(0);

  for (const signal of signals) {
    const hour = new Date(signal.timestamp).getHours();
    hourCounts[hour]++;
  }

  const data = hourCounts.map((count, hour) => ({
    label: `${hour.toString().padStart(2, '0')}:00`,
    value: count
  }));

  return {
    type: 'bar',
    title: 'Signals by Hour (UTC)',
    data,
    xAxis: 'Hour',
    yAxis: 'Signal Count'
  };
}

// Generate dashboard data bundle
export function getDashboardCharts(signals: AggregatedSignal[]): {
  signalsOverTime: ChartConfig;
  scoreDistribution: ChartConfig;
  riskDistribution: ChartConfig;
  sourceBreakdown: ChartConfig;
  narrativeBreakdown: ChartConfig;
  hourlyActivity: ChartConfig;
  winRateOverTime: ChartConfig;
  roiDistribution: ChartConfig;
} {
  return {
    signalsOverTime: getSignalsOverTime(signals),
    scoreDistribution: getScoreDistribution(signals),
    riskDistribution: getRiskDistribution(signals),
    sourceBreakdown: getSourceBreakdown(signals),
    narrativeBreakdown: getNarrativeBreakdown(signals),
    hourlyActivity: getHourlyActivity(signals),
    winRateOverTime: getWinRateOverTime(signals),
    roiDistribution: getRoiDistribution(signals)
  };
}

// Generate summary stats for dashboard
export function getDashboardStats(signals: AggregatedSignal[]): {
  totalSignals: number;
  avgScore: number;
  highScoreCount: number;
  lowRiskCount: number;
  topNarrative: string;
  topSource: string;
  recentTrend: 'up' | 'down' | 'stable';
} {
  const totalSignals = signals.length;
  const avgScore =
    totalSignals > 0 ? signals.reduce((sum, s) => sum + s.score, 0) / totalSignals : 0;
  const highScoreCount = signals.filter(s => s.score >= 80).length;
  const lowRiskCount = signals.filter(s => s.riskLevel === 'LOW').length;

  // Find top narrative
  const narrativeCounts = new Map<string, number>();
  for (const s of signals) {
    for (const n of s.analysis?.narrative || []) {
      narrativeCounts.set(n, (narrativeCounts.get(n) || 0) + 1);
    }
  }
  const topNarrative =
    Array.from(narrativeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';

  // Find top source
  const sourceCounts = new Map<string, number>();
  for (const s of signals) {
    for (const src of s.sources) {
      sourceCounts.set(src.source, (sourceCounts.get(src.source) || 0) + 1);
    }
  }
  const topSource =
    Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  // Calculate trend (last hour vs previous hour)
  const oneHourAgo = Date.now() - 3600000;
  const twoHoursAgo = Date.now() - 7200000;
  const recentCount = signals.filter(s => s.timestamp >= oneHourAgo).length;
  const previousCount = signals.filter(
    s => s.timestamp >= twoHoursAgo && s.timestamp < oneHourAgo
  ).length;

  let recentTrend: 'up' | 'down' | 'stable' = 'stable';
  if (recentCount > previousCount * 1.2) recentTrend = 'up';
  else if (recentCount < previousCount * 0.8) recentTrend = 'down';

  return {
    totalSignals,
    avgScore,
    highScoreCount,
    lowRiskCount,
    topNarrative,
    topSource,
    recentTrend
  };
}

export { COLORS };
