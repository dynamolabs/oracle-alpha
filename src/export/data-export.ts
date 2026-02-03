/**
 * Data Export Functionality
 * Export signals and performance data in various formats
 */

import { AggregatedSignal } from '../types';

// Export format options
type ExportFormat = 'json' | 'csv' | 'markdown';

// Export configuration
interface ExportConfig {
  format: ExportFormat;
  includePerformance: boolean;
  includeMetadata: boolean;
  dateRange?: {
    start: number;
    end: number;
  };
  minScore?: number;
  maxSignals?: number;
}

// Default export config
const DEFAULT_CONFIG: ExportConfig = {
  format: 'json',
  includePerformance: true,
  includeMetadata: true,
  maxSignals: 1000
};

// Export signals to JSON
function exportToJson(signals: AggregatedSignal[], config: ExportConfig): string {
  const filtered = filterSignals(signals, config);

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalSignals: filtered.length,
    config: {
      includePerformance: config.includePerformance,
      dateRange: config.dateRange,
      minScore: config.minScore
    },
    signals: filtered.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      date: new Date(s.timestamp).toISOString(),
      token: s.token,
      symbol: s.symbol,
      name: s.name,
      score: s.score,
      confidence: s.confidence,
      riskLevel: s.riskLevel,
      sources: s.sources.map(src => src.source),
      narratives: s.analysis?.narrative,
      recommendation: s.analysis?.recommendation,
      ...(config.includeMetadata && {
        marketData: s.marketData,
        strengths: s.analysis?.strengths,
        weaknesses: s.analysis?.weaknesses
      }),
      ...(config.includePerformance &&
        s.performance && {
          performance: {
            ath: s.performance.ath,
            athTimestamp: s.performance.athTimestamp,
            current: s.performance.current,
            roi: s.performance.roi,
            status: s.performance.status
          }
        })
    }))
  };

  return JSON.stringify(exportData, null, 2);
}

// Export signals to CSV
function exportToCsv(signals: AggregatedSignal[], config: ExportConfig): string {
  const filtered = filterSignals(signals, config);

  // CSV headers
  const headers = [
    'id',
    'timestamp',
    'date',
    'token',
    'symbol',
    'name',
    'score',
    'confidence',
    'risk_level',
    'sources',
    'narratives',
    'recommendation'
  ];

  if (config.includeMetadata) {
    headers.push('mcap', 'liquidity', 'volume_5m', 'age_minutes');
  }

  if (config.includePerformance) {
    headers.push('ath', 'ath_roi', 'current_price', 'roi', 'status');
  }

  // Build CSV rows
  const rows = filtered.map(s => {
    const row = [
      s.id,
      s.timestamp,
      new Date(s.timestamp).toISOString(),
      s.token,
      s.symbol,
      `"${s.name.replace(/"/g, '""')}"`,
      s.score,
      s.confidence,
      s.riskLevel,
      `"${s.sources.map(src => src.source).join(',')}"`,
      `"${(s.analysis?.narrative || []).join(',')}"`,
      `"${(s.analysis?.recommendation || '').replace(/"/g, '""')}"`
    ];

    if (config.includeMetadata) {
      row.push(
        s.marketData?.mcap || 0,
        s.marketData?.liquidity || 0,
        s.marketData?.volume5m || 0,
        s.marketData?.age || 0
      );
    }

    if (config.includePerformance) {
      row.push(
        s.performance?.ath || '',
        s.performance?.ath
          ? (
              ((s.performance.ath - (s.marketData?.mcap || 0)) / (s.marketData?.mcap || 1)) *
              100
            ).toFixed(2)
          : '',
        s.performance?.current || '',
        s.performance?.roi?.toFixed(2) || '',
        s.performance?.status || ''
      );
    }

    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// Export signals to Markdown
function exportToMarkdown(signals: AggregatedSignal[], config: ExportConfig): string {
  const filtered = filterSignals(signals, config);

  let md = '# ORACLE Alpha Signal Export\n\n';
  md += `**Exported:** ${new Date().toISOString()}\n`;
  md += `**Total Signals:** ${filtered.length}\n\n`;

  md += '## Summary\n\n';

  const avgScore = filtered.reduce((sum, s) => sum + s.score, 0) / filtered.length || 0;
  const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, EXTREME: 0 };
  for (const s of filtered) riskCounts[s.riskLevel]++;

  md += '| Metric | Value |\n';
  md += '|--------|-------|\n';
  md += `| Total Signals | ${filtered.length} |\n`;
  md += `| Average Score | ${avgScore.toFixed(1)} |\n`;
  md += `| Low Risk | ${riskCounts.LOW} |\n`;
  md += `| Medium Risk | ${riskCounts.MEDIUM} |\n`;
  md += `| High Risk | ${riskCounts.HIGH} |\n`;
  md += `| Extreme Risk | ${riskCounts.EXTREME} |\n\n`;

  md += '## Signals\n\n';
  md += '| Symbol | Score | Risk | Sources | Time |\n';
  md += '|--------|-------|------|---------|------|\n';

  for (const s of filtered.slice(0, 100)) {
    const time = new Date(s.timestamp).toLocaleString();
    const sources = s.sources.map(src => src.source).join(', ');
    md += `| ${s.symbol} | ${s.score} | ${s.riskLevel} | ${sources} | ${time} |\n`;
  }

  if (filtered.length > 100) {
    md += `\n*...and ${filtered.length - 100} more signals*\n`;
  }

  return md;
}

// Filter signals based on config
function filterSignals(signals: AggregatedSignal[], config: ExportConfig): AggregatedSignal[] {
  let filtered = [...signals];

  // Date range filter
  if (config.dateRange) {
    filtered = filtered.filter(
      s => s.timestamp >= config.dateRange!.start && s.timestamp <= config.dateRange!.end
    );
  }

  // Min score filter
  if (config.minScore !== undefined) {
    filtered = filtered.filter(s => s.score >= config.minScore!);
  }

  // Sort by timestamp descending
  filtered.sort((a, b) => b.timestamp - a.timestamp);

  // Max signals limit
  if (config.maxSignals) {
    filtered = filtered.slice(0, config.maxSignals);
  }

  return filtered;
}

// Main export function
export function exportSignals(
  signals: AggregatedSignal[],
  config: Partial<ExportConfig> = {}
): { data: string; filename: string; contentType: string } {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  let data: string;
  let filename: string;
  let contentType: string;

  const timestamp = new Date().toISOString().slice(0, 10);

  switch (fullConfig.format) {
    case 'csv':
      data = exportToCsv(signals, fullConfig);
      filename = `oracle-alpha-signals-${timestamp}.csv`;
      contentType = 'text/csv';
      break;

    case 'markdown':
      data = exportToMarkdown(signals, fullConfig);
      filename = `oracle-alpha-signals-${timestamp}.md`;
      contentType = 'text/markdown';
      break;

    case 'json':
    default:
      data = exportToJson(signals, fullConfig);
      filename = `oracle-alpha-signals-${timestamp}.json`;
      contentType = 'application/json';
      break;
  }

  return { data, filename, contentType };
}

// Export performance report
export function exportPerformanceReport(signals: AggregatedSignal[]): string {
  const withPerformance = signals.filter(s => s.performance);
  const wins = withPerformance.filter(s => s.performance?.status === 'WIN');
  const losses = withPerformance.filter(s => s.performance?.status === 'LOSS');

  const winRate =
    withPerformance.length > 0 ? ((wins.length / withPerformance.length) * 100).toFixed(1) : '0';

  const avgRoi =
    withPerformance.length > 0
      ? (
          withPerformance.reduce((sum, s) => sum + (s.performance?.roi || 0), 0) /
          withPerformance.length
        ).toFixed(1)
      : '0';

  const topWinners = wins
    .sort((a, b) => (b.performance?.roi || 0) - (a.performance?.roi || 0))
    .slice(0, 10);

  let report = '# ORACLE Alpha Performance Report\n\n';
  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  report += '## Overall Performance\n\n';
  report += '| Metric | Value |\n';
  report += '|--------|-------|\n';
  report += `| Total Signals | ${signals.length} |\n`;
  report += `| With Performance Data | ${withPerformance.length} |\n`;
  report += `| Wins | ${wins.length} |\n`;
  report += `| Losses | ${losses.length} |\n`;
  report += `| Win Rate | ${winRate}% |\n`;
  report += `| Average ROI | ${avgRoi}% |\n\n`;

  report += '## Top Winners\n\n';
  report += '| Symbol | Score | ROI | ATH ROI |\n';
  report += '|--------|-------|-----|--------|\n';

  for (const s of topWinners) {
    const athRoi = s.performance?.ath
      ? (
          ((s.performance.ath - (s.marketData?.mcap || 0)) / (s.marketData?.mcap || 1)) *
          100
        ).toFixed(1)
      : 'N/A';
    report += `| ${s.symbol} | ${s.score} | +${s.performance?.roi?.toFixed(1)}% | +${athRoi}% |\n`;
  }

  return report;
}

// Export for API
export { ExportFormat, ExportConfig, DEFAULT_CONFIG };
