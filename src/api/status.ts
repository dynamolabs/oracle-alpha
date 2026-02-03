// ORACLE Alpha Status & Health

import { getTrackedSignals, getPerformanceSummary } from '../tracker/performance';

export interface OracleStatus {
  name: string;
  version: string;
  uptime: number;
  status: 'healthy' | 'degraded' | 'error';
  
  signals: {
    total: number;
    tracking: number;
    wins: number;
    losses: number;
    winRate: number;
    avgRoi: number;
  };
  
  sources: {
    name: string;
    enabled: boolean;
    description: string;
  }[];
  
  endpoints: {
    path: string;
    method: string;
    description: string;
  }[];
}

const SIGNAL_SOURCES = [
  { name: 'smart-wallet-elite', enabled: true, description: 'Elite wallets (70% WR)' },
  { name: 'smart-wallet-sniper', enabled: true, description: 'Pump.fun snipers (40%+ WR)' },
  { name: 'volume-spike', enabled: true, description: 'Volume anomaly detection' },
  { name: 'kol-tracker', enabled: true, description: 'KOL direct mentions' },
  { name: 'kol-social', enabled: true, description: 'Social mention aggregation' },
  { name: 'narrative-new', enabled: true, description: 'New tokens in hot narratives' },
  { name: 'narrative-momentum', enabled: true, description: 'Trending narrative plays' },
  { name: 'whale-tracker', enabled: true, description: 'Whale accumulation patterns' },
];

const API_ENDPOINTS = [
  { path: '/api/signals', method: 'GET', description: 'Get aggregated signals' },
  { path: '/api/signals/:id', method: 'GET', description: 'Get single signal' },
  { path: '/api/stats', method: 'GET', description: 'Get signal statistics' },
  { path: '/api/sources', method: 'GET', description: 'Get source performance' },
  { path: '/api/scan', method: 'POST', description: 'Trigger manual scan' },
  { path: '/api/performance', method: 'GET', description: 'Get performance metrics' },
  { path: '/api/tracked', method: 'GET', description: 'Get tracked signals' },
  { path: '/api/tracked/:id', method: 'GET', description: 'Get tracked signal by ID' },
  { path: '/ws', method: 'WS', description: 'WebSocket for real-time updates' },
];

const startTime = Date.now();

export function getOracleStatus(): OracleStatus {
  const perf = getPerformanceSummary();
  const tracked = getTrackedSignals();
  
  return {
    name: 'ORACLE Alpha',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    status: 'healthy',
    
    signals: {
      total: tracked.length,
      tracking: perf.total,
      wins: perf.wins,
      losses: perf.losses,
      winRate: perf.winRate,
      avgRoi: perf.avgRoi,
    },
    
    sources: SIGNAL_SOURCES,
    endpoints: API_ENDPOINTS,
  };
}

export function formatStatusMessage(): string {
  const status = getOracleStatus();
  
  return `
🔮 ORACLE Alpha v${status.version}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Status: ${status.status.toUpperCase()}
⏱️ Uptime: ${Math.floor(status.uptime / 60)}m ${status.uptime % 60}s

📡 Signals:
   Total: ${status.signals.total}
   Tracking: ${status.signals.tracking}
   Win Rate: ${status.signals.winRate.toFixed(1)}%
   Avg ROI: ${status.signals.avgRoi.toFixed(1)}%

🔌 Sources: ${status.sources.filter(s => s.enabled).length} active
${status.sources.map(s => `   ${s.enabled ? '✅' : '❌'} ${s.name}`).join('\n')}
`.trim();
}
