/**
 * Prometheus-compatible metrics endpoint
 * Exposes key metrics in Prometheus format for monitoring
 */

interface Metrics {
  signalsTotal: number;
  signalsPublished: number;
  signalsWin: number;
  signalsLoss: number;
  signalsOpen: number;
  avgScore: number;
  avgRoi: number;
  apiRequestsTotal: number;
  apiRequestsErrors: number;
  lastScanTimestamp: number;
  scanDurationMs: number;
  websocketClients: number;
}

// In-memory metrics
const metrics: Metrics = {
  signalsTotal: 0,
  signalsPublished: 0,
  signalsWin: 0,
  signalsLoss: 0,
  signalsOpen: 0,
  avgScore: 0,
  avgRoi: 0,
  apiRequestsTotal: 0,
  apiRequestsErrors: 0,
  lastScanTimestamp: 0,
  scanDurationMs: 0,
  websocketClients: 0
};

// Update metrics
export function updateMetrics(updates: Partial<Metrics>): void {
  Object.assign(metrics, updates);
}

export function incrementRequests(): void {
  metrics.apiRequestsTotal++;
}

export function incrementErrors(): void {
  metrics.apiRequestsErrors++;
}

export function setWebsocketClients(count: number): void {
  metrics.websocketClients = count;
}

export function recordScan(signalCount: number, durationMs: number): void {
  metrics.lastScanTimestamp = Date.now();
  metrics.scanDurationMs = durationMs;
  metrics.signalsTotal += signalCount;
}

// Get metrics as Prometheus format
export function getPrometheusMetrics(): string {
  const lines: string[] = [];
  
  // Helper to add metric
  const addMetric = (name: string, help: string, type: string, value: number) => {
    lines.push(`# HELP oracle_${name} ${help}`);
    lines.push(`# TYPE oracle_${name} ${type}`);
    lines.push(`oracle_${name} ${value}`);
  };
  
  addMetric('signals_total', 'Total number of signals processed', 'counter', metrics.signalsTotal);
  addMetric('signals_published', 'Signals published on-chain', 'counter', metrics.signalsPublished);
  addMetric('signals_win', 'Signals that resulted in wins', 'counter', metrics.signalsWin);
  addMetric('signals_loss', 'Signals that resulted in losses', 'counter', metrics.signalsLoss);
  addMetric('signals_open', 'Currently open signals', 'gauge', metrics.signalsOpen);
  addMetric('avg_score', 'Average signal score', 'gauge', metrics.avgScore);
  addMetric('avg_roi', 'Average ROI percentage', 'gauge', metrics.avgRoi);
  addMetric('api_requests_total', 'Total API requests', 'counter', metrics.apiRequestsTotal);
  addMetric('api_requests_errors', 'API request errors', 'counter', metrics.apiRequestsErrors);
  addMetric('last_scan_timestamp', 'Timestamp of last scan', 'gauge', metrics.lastScanTimestamp);
  addMetric('scan_duration_ms', 'Duration of last scan in ms', 'gauge', metrics.scanDurationMs);
  addMetric('websocket_clients', 'Connected WebSocket clients', 'gauge', metrics.websocketClients);
  
  // Win rate calculated
  const totalClosed = metrics.signalsWin + metrics.signalsLoss;
  const winRate = totalClosed > 0 ? (metrics.signalsWin / totalClosed) * 100 : 0;
  addMetric('win_rate', 'Win rate percentage', 'gauge', winRate);
  
  return lines.join('\n');
}

// Get metrics as JSON
export function getMetricsJson(): Metrics & { winRate: number } {
  const totalClosed = metrics.signalsWin + metrics.signalsLoss;
  const winRate = totalClosed > 0 ? (metrics.signalsWin / totalClosed) * 100 : 0;
  
  return {
    ...metrics,
    winRate
  };
}
