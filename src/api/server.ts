import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { aggregate } from '../aggregator';
import { AggregatedSignal, SignalQuery } from '../types';
import {
  trackSignal,
  updateTrackedSignals,
  getTrackedSignals,
  getPerformanceSummary,
  getTrackedSignal
} from '../tracker/performance';
import { getOracleStatus, formatStatusMessage } from './status';
import {
  initPublisher,
  publishSignalOnChain,
  getOnChainStats,
  fetchOnChainSignals
} from '../onchain/publisher';
import { sendTelegramAlert, shouldAlert } from '../notifications/telegram';
import { initAthUpdater, startAthUpdater } from '../onchain/ath-updater';
import {
  getPrometheusMetrics,
  getMetricsJson,
  incrementRequests,
  incrementErrors
} from './metrics';
import {
  getAllTiers,
  getSubscription,
  getTier,
  filterSignalsForTier
} from '../subscription/manager';
import { DemoRunner, generateDemoSignal, generateHistoricalSignals } from '../demo/generator';
import { generateTextCard, generateHtmlCard, generateSvgCard } from './share-card';

// Demo mode configuration
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const DEMO_SIGNALS_PER_MINUTE = parseInt(process.env.DEMO_SIGNALS_PER_MINUTE || '4');
let demoRunner: DemoRunner | null = null;

// On-chain publishing state
let onChainEnabled = false;
const publishedTokens = new Set<string>(); // Track which tokens we've published

const PORT = process.env.PORT || 3900;

// In-memory signal store (would be replaced with DB in production)
const signalStore: AggregatedSignal[] = [];
const MAX_SIGNALS = 1000;

// WebSocket clients
const wsClients = new Set<WebSocket>();

// Express app
const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for dashboard
    crossOriginEmbedderPolicy: false
  })
);

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 requests per minute for expensive endpoints
  message: { error: 'Rate limit exceeded for this endpoint' }
});

app.use('/api/', limiter);
app.use('/api/scan', strictLimiter);
app.use('/api/onchain/publish', strictLimiter);

app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../../app')));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging and metrics
app.use((req, res, next) => {
  incrementRequests();
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      incrementErrors();
    }
    if (duration > 1000) {
      // Log slow requests
      console.log(`[API] ${req.method} ${req.path} - ${duration}ms (slow)`);
    }
  });
  next();
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[API] Error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// === REST ENDPOINTS ===

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    signals: signalStore.length,
    uptime: process.uptime()
  });
});

// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
  res.type('text/plain').send(getPrometheusMetrics());
});

// JSON metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json(getMetricsJson());
});

// Project info
app.get('/api/info', async (req, res) => {
  const onchain = await getOnChainStats();
  res.json({
    name: 'ORACLE Alpha',
    version: '1.0.0',
    description: 'On-chain Reliable Alpha Compilation & Learning Engine',
    author: 'ShifuSensei 🐼',
    hackathon: 'Colosseum Agent Hackathon 2026',
    programId: 'AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd',
    network: 'devnet',
    features: [
      '8 signal sources (smart wallets, KOLs, volume, narratives, etc.)',
      'Weighted scoring algorithm',
      'On-chain signal publishing',
      'ATH tracking & performance verification',
      'Real-time WebSocket updates',
      'Telegram alerts'
    ],
    onChain: onchain || { enabled: false },
    links: {
      github: 'https://github.com/dynamolabs/oracle-alpha',
      explorer:
        'https://explorer.solana.com/address/AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd?cluster=devnet'
    }
  });
});

// Full status endpoint
app.get('/api/status', (req, res) => {
  res.json(getOracleStatus());
});

// Text status (for CLI/agents)
app.get('/api/status/text', (req, res) => {
  res.type('text/plain').send(formatStatusMessage());
});

// === SUBSCRIPTION ENDPOINTS ===

// Get all subscription tiers
app.get('/api/subscription/tiers', (req, res) => {
  res.json({
    tiers: getAllTiers(),
    tokenMint: process.env.SUBSCRIPTION_TOKEN_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  });
});

// Check subscription status for a wallet
app.get('/api/subscription/:wallet', async (req, res) => {
  const { wallet } = req.params;

  // Validate wallet format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const subscription = await getSubscription(wallet);
  const tier = getTier(subscription?.tier || 'free');

  res.json({
    wallet,
    tier: subscription?.tier || 'free',
    tierDetails: tier,
    tokenBalance: subscription?.tokenBalance || 0,
    expiresAt: subscription?.expiresAt
  });
});

// Get signals for subscription tier
app.get('/api/subscription/:wallet/signals', async (req, res) => {
  const { wallet } = req.params;
  const limit = parseInt(req.query.limit as string) || 20;

  const subscription = await getSubscription(wallet);
  const tier = getTier(subscription?.tier || 'free');

  if (!tier) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  // Filter signals based on tier
  const filteredSignals = filterSignalsForTier(signalStore, tier);

  res.json({
    tier: tier.id,
    tierName: tier.name,
    count: Math.min(filteredSignals.length, limit),
    signals: filteredSignals.slice(0, limit)
  });
});

// Get signals with filtering
app.get('/api/signals', (req, res) => {
  const query: SignalQuery = {
    minScore: req.query.minScore ? parseInt(req.query.minScore as string) : undefined,
    maxAge: req.query.maxAge ? parseInt(req.query.maxAge as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    includePerformance: req.query.includePerformance === 'true'
  };

  let signals = [...signalStore];

  // Filter by minScore
  if (query.minScore) {
    signals = signals.filter(s => s.score >= query.minScore!);
  }

  // Filter by maxAge (minutes)
  if (query.maxAge) {
    const cutoff = Date.now() - query.maxAge * 60 * 1000;
    signals = signals.filter(s => s.timestamp >= cutoff);
  }

  // Limit results
  signals = signals.slice(0, query.limit);

  res.json({
    count: signals.length,
    signals
  });
});

// Get single signal by ID
app.get('/api/signals/:id', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);

  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }

  res.json(signal);
});

// Get performance stats
app.get('/api/stats', (req, res) => {
  const total = signalStore.length;
  const withPerformance = signalStore.filter(s => s.performance);
  const wins = withPerformance.filter(s => s.performance?.status === 'WIN').length;
  const losses = withPerformance.filter(s => s.performance?.status === 'LOSS').length;
  const open = signalStore.filter(s => !s.performance || s.performance.status === 'OPEN').length;

  const avgScore = total > 0 ? signalStore.reduce((sum, s) => sum + s.score, 0) / total : 0;

  const avgRoi =
    withPerformance.length > 0
      ? withPerformance.reduce((sum, s) => sum + (s.performance?.roi || 0), 0) /
        withPerformance.length
      : 0;

  res.json({
    totalSignals: total,
    openSignals: open,
    closedSignals: wins + losses,
    wins,
    losses,
    winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0',
    avgScore: avgScore.toFixed(1),
    avgRoi: avgRoi.toFixed(2),
    lastSignalAt: signalStore[0]?.timestamp || null
  });
});

// === ON-CHAIN ENDPOINTS ===

// Get on-chain stats
app.get('/api/onchain/stats', async (req, res) => {
  const stats = await getOnChainStats();
  if (!stats) {
    return res.json({ enabled: false, message: 'On-chain publishing not available' });
  }
  res.json({ enabled: true, ...stats });
});

// Get on-chain signals
app.get('/api/onchain/signals', async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const signals = await fetchOnChainSignals(limit);
  res.json({ count: signals.length, signals });
});

// Manually publish a signal
app.post('/api/onchain/publish/:id', async (req, res) => {
  if (!onChainEnabled) {
    return res.status(503).json({ error: 'On-chain publishing not enabled' });
  }

  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }

  const tx = await publishSignalOnChain(signal);
  if (tx) {
    publishedTokens.add(signal.token);
    res.json({ success: true, tx });
  } else {
    res.status(500).json({ error: 'Failed to publish' });
  }
});

// Get signals by source
app.get('/api/sources', (req, res) => {
  const sourceStats = new Map<string, { count: number; avgScore: number; wins: number }>();

  for (const signal of signalStore) {
    for (const source of signal.sources) {
      const stats = sourceStats.get(source.source) || { count: 0, avgScore: 0, wins: 0 };
      stats.count++;
      stats.avgScore = (stats.avgScore * (stats.count - 1) + source.rawScore) / stats.count;
      if (signal.performance?.status === 'WIN') stats.wins++;
      sourceStats.set(source.source, stats);
    }
  }

  res.json(Object.fromEntries(sourceStats));
});

// Leaderboard - top performing tokens
app.get('/api/leaderboard', (req, res) => {
  const tracked = getTrackedSignals();

  // Sort by current ROI
  const sorted = tracked
    .filter(t => t.currentPrice > 0)
    .sort((a, b) => (b.roi || 0) - (a.roi || 0));

  const leaderboard = sorted.slice(0, 20).map((t, idx) => ({
    rank: idx + 1,
    symbol: t.symbol,
    token: t.token,
    entryPrice: t.entryPrice,
    currentPrice: t.currentPrice,
    athPrice: t.athPrice,
    roi: t.roi,
    athRoi: t.athRoi,
    status: t.status,
    age: Math.floor((Date.now() - t.entryTimestamp) / 60000)
  }));

  res.json({
    count: leaderboard.length,
    totalTracked: tracked.length,
    leaderboard
  });
});

// Generate shareable summary text
app.get('/api/summary', (req, res) => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recent = signalStore.filter(s => s.timestamp >= oneHourAgo);
  const topSignals = recent.sort((a, b) => b.score - a.score).slice(0, 5);

  if (topSignals.length === 0) {
    return res.json({ text: 'No signals in the last hour.' });
  }

  let text = '🔮 ORACLE Alpha - Signal Summary\n\n';
  text += `Found ${recent.length} signals in the last hour\n\n`;
  text += '📊 Top Picks:\n';

  for (const s of topSignals) {
    const riskEmoji = s.riskLevel === 'LOW' ? '🟢' : s.riskLevel === 'MEDIUM' ? '🟡' : '🟠';
    text += `${riskEmoji} $${s.symbol} - Score: ${s.score}\n`;
  }

  text += '\n⛓️ Verifiable on Solana devnet';

  res.json({
    text,
    signalCount: recent.length,
    topSignals: topSignals.map(s => ({
      symbol: s.symbol,
      score: s.score,
      token: s.token
    }))
  });
});

// Top gainers in last hour
app.get('/api/gainers', (req, res) => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recent = signalStore.filter(s => s.timestamp >= oneHourAgo);

  // Get top 10 by score
  const gainers = recent
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(s => ({
      symbol: s.symbol,
      name: s.name,
      token: s.token,
      score: s.score,
      riskLevel: s.riskLevel,
      sources: s.sources.map(src => src.source),
      narratives: s.analysis?.narrative || [],
      mcap: s.marketData?.mcap || 0,
      minutesAgo: Math.floor((Date.now() - s.timestamp) / 60000)
    }));

  res.json({ count: gainers.length, gainers });
});

// === SHARE CARD ENDPOINTS ===

// Get text share card for a signal
app.get('/api/share/:id/text', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  const text = generateTextCard(signal);
  res.type('text/plain').send(text);
});

// Get HTML share card for a signal
app.get('/api/share/:id/html', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  const html = generateHtmlCard(signal);
  res.type('text/html').send(html);
});

// Get SVG share card for a signal (can be converted to PNG)
app.get('/api/share/:id/svg', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  const svg = generateSvgCard(signal);
  res.type('image/svg+xml').send(svg);
});

// Generate OG image for social sharing (SVG-based)
app.get('/api/og', (req, res) => {
  const { symbol, score, risk } = req.query;

  // Create a simple OG image SVG
  const scoreNum = parseInt(score as string) || 75;
  const scoreColor = scoreNum >= 70 ? '#22c55e' : scoreNum >= 50 ? '#eab308' : '#ef4444';

  const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a1a"/>
      <stop offset="100%" style="stop-color:#1a1a3a"/>
    </linearGradient>
    <linearGradient id="logo" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00d9ff"/>
      <stop offset="100%" style="stop-color:#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="600" y="200" font-family="monospace" font-size="48" fill="url(#logo)" text-anchor="middle">🔮 ORACLE Alpha Signal</text>
  <text x="600" y="320" font-family="monospace" font-size="96" fill="#fff" text-anchor="middle" font-weight="bold">$${symbol || 'TOKEN'}</text>
  <circle cx="600" cy="450" r="60" fill="${scoreColor}"/>
  <text x="600" y="470" font-family="monospace" font-size="40" fill="#000" text-anchor="middle" font-weight="bold">${scoreNum}</text>
  <text x="600" y="560" font-family="monospace" font-size="24" fill="#888" text-anchor="middle">Verifiable on-chain signals on Solana</text>
</svg>`.trim();

  res.type('image/svg+xml').send(svg);
});

// === PERFORMANCE TRACKING ===

// Get performance summary
app.get('/api/performance', (req, res) => {
  const summary = getPerformanceSummary();
  res.json(summary);
});

// Get all tracked signals with live prices
app.get('/api/tracked', (req, res) => {
  const tracked = getTrackedSignals();
  res.json({
    count: tracked.length,
    signals: tracked.sort((a, b) => b.entryTimestamp - a.entryTimestamp)
  });
});

// Get single tracked signal
app.get('/api/tracked/:id', (req, res) => {
  const tracked = getTrackedSignal(req.params.id);
  if (!tracked) {
    return res.status(404).json({ error: 'Signal not tracked' });
  }
  res.json(tracked);
});

// Manually trigger price update
app.post('/api/performance/update', async (req, res) => {
  await updateTrackedSignals();
  res.json({ status: 'updated', tracked: getTrackedSignals().length });
});

// Manual trigger scan (for testing)
app.post('/api/scan', async (req, res) => {
  try {
    const signals = await aggregate();

    // Add to store
    for (const signal of signals) {
      // Check if we already have this signal (by token + similar timestamp)
      const exists = signalStore.some(
        s => s.token === signal.token && Math.abs(s.timestamp - signal.timestamp) < 60000
      );

      if (!exists) {
        signalStore.unshift(signal);

        // Broadcast to WebSocket clients
        broadcastSignal(signal);

        // Auto-track high-quality signals (score >= 65)
        if (signal.score >= 65) {
          trackSignal(signal).catch(e => console.error('[TRACKER] Failed to track:', e));
        }
      }
    }

    // Trim store
    if (signalStore.length > MAX_SIGNALS) {
      signalStore.length = MAX_SIGNALS;
    }

    res.json({
      newSignals: signals.length,
      totalStored: signalStore.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Scan failed', details: String(error) });
  }
});

// === WebSocket ===

function broadcastSignal(signal: AggregatedSignal) {
  const message = JSON.stringify({
    type: 'signal',
    data: signal
  });

  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// === Server Setup ===

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', ws => {
  console.log('WebSocket client connected');
  wsClients.add(ws);

  // Send recent signals on connect
  ws.send(
    JSON.stringify({
      type: 'history',
      data: signalStore.slice(0, 10)
    })
  );

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('WebSocket client disconnected');
  });

  ws.on('message', message => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // Ignore invalid messages
    }
  });
});

// Initialize on-chain publisher
async function initOnChain() {
  onChainEnabled = await initPublisher();
  if (onChainEnabled) {
    console.log('[SERVER] On-chain publishing ENABLED');
  } else {
    console.log('[SERVER] On-chain publishing disabled (no wallet or not deployed)');
  }
}

// Auto-publish high-confidence signals
async function autoPublishSignal(signal: AggregatedSignal) {
  if (!onChainEnabled) return;

  // Only publish high-quality signals we haven't published before
  if (signal.score >= 70 && !publishedTokens.has(signal.token)) {
    const tx = await publishSignalOnChain(signal);
    if (tx) {
      publishedTokens.add(signal.token);
      console.log(`[ONCHAIN] Published ${signal.symbol} (Score: ${signal.score})`);
    }
  }
}

// === DEMO MODE ENDPOINTS ===

// Toggle demo mode
app.post('/api/demo/start', (req, res) => {
  if (demoRunner) {
    return res.json({ status: 'already_running', message: 'Demo mode is already active' });
  }

  const signalsPerMinute = req.body?.signalsPerMinute || DEMO_SIGNALS_PER_MINUTE;

  demoRunner = new DemoRunner(signal => {
    signalStore.unshift(signal);
    broadcastSignal(signal);

    // Auto-track in demo mode
    if (signal.score >= 65) {
      trackSignal(signal).catch(() => {});
    }

    // Trim store
    if (signalStore.length > MAX_SIGNALS) {
      signalStore.length = MAX_SIGNALS;
    }
  }, signalsPerMinute);

  demoRunner.start();
  console.log(`[DEMO] Demo mode STARTED (${signalsPerMinute} signals/min)`);

  res.json({
    status: 'started',
    signalsPerMinute,
    message: `Demo mode started - generating ${signalsPerMinute} signals per minute`
  });
});

app.post('/api/demo/stop', (req, res) => {
  if (!demoRunner) {
    return res.json({ status: 'not_running', message: 'Demo mode is not active' });
  }

  demoRunner.stop();
  demoRunner = null;
  console.log('[DEMO] Demo mode STOPPED');

  res.json({ status: 'stopped', message: 'Demo mode stopped' });
});

app.get('/api/demo/status', (req, res) => {
  res.json({
    active: !!demoRunner,
    signalsPerMinute: DEMO_SIGNALS_PER_MINUTE,
    signalsGenerated: signalStore.filter(s => s.id.includes('-')).length // UUIDs from demo
  });
});

// Seed historical data for demo
app.post('/api/demo/seed', (req, res) => {
  const count = req.body?.count || 30;
  const historical = generateHistoricalSignals(count);

  // Add to signal store with performance data
  for (const h of historical) {
    const signal: AggregatedSignal = {
      id: h.id,
      token: h.token,
      symbol: h.symbol,
      name: h.name,
      sources: h.sources,
      score: h.score,
      confidence: h.confidence,
      riskLevel: h.riskLevel,
      marketData: h.marketData,
      analysis: h.analysis,
      timestamp: h.timestamp,
      published: h.published,
      performance: h.closed
        ? {
            entryPrice: h.marketData.price || h.marketData.mcap / 1000000000,
            currentPrice: h.exitPrice || 0,
            athPrice: h.athPrice || 0,
            roi: h.roi || 0,
            athRoi:
              ((h.athPrice || 0) / (h.marketData.price || h.marketData.mcap / 1000000000) - 1) *
              100,
            status: h.result || 'OPEN'
          }
        : undefined
    };
    signalStore.push(signal);
  }

  // Sort by timestamp descending
  signalStore.sort((a, b) => b.timestamp - a.timestamp);

  // Trim if needed
  if (signalStore.length > MAX_SIGNALS) {
    signalStore.length = MAX_SIGNALS;
  }

  const wins = historical.filter(h => h.result === 'WIN').length;
  const avgRoi = historical.reduce((sum, h) => sum + (h.roi || 0), 0) / historical.length;

  console.log(
    `[DEMO] Seeded ${count} historical signals (WR: ${((wins / count) * 100).toFixed(1)}%, Avg ROI: ${avgRoi.toFixed(1)}%)`
  );

  res.json({
    status: 'seeded',
    count,
    winRate: ((wins / count) * 100).toFixed(1) + '%',
    avgRoi: avgRoi.toFixed(1) + '%',
    message: `Seeded ${count} historical signals with realistic performance data`
  });
});

// Generate a single demo signal on demand
app.post('/api/demo/signal', (req, res) => {
  const signal = generateDemoSignal();
  signalStore.unshift(signal);
  broadcastSignal(signal);

  res.json({
    status: 'generated',
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      score: signal.score,
      riskLevel: signal.riskLevel
    }
  });
});

// Start server
server.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  🔮 ORACLE Alpha API Server                    ║
╠═══════════════════════════════════════════════╣
║  REST API: http://localhost:${PORT}/api        ║
║  WebSocket: ws://localhost:${PORT}/ws          ║
${DEMO_MODE ? '║  🎬 DEMO MODE: ENABLED                         ║\n' : ''}╚═══════════════════════════════════════════════╝
  `);

  // Initialize on-chain connection
  await initOnChain();

  // Initialize ATH updater
  const athEnabled = await initAthUpdater();
  if (athEnabled) {
    startAthUpdater();
    console.log('[SERVER] ATH tracking ENABLED');
  }

  // Auto-start demo mode if enabled
  if (DEMO_MODE) {
    // Seed some historical data first
    const historical = generateHistoricalSignals(30);
    for (const h of historical) {
      const signal: AggregatedSignal = {
        id: h.id,
        token: h.token,
        symbol: h.symbol,
        name: h.name,
        sources: h.sources,
        score: h.score,
        confidence: h.confidence,
        riskLevel: h.riskLevel,
        marketData: h.marketData,
        analysis: h.analysis,
        timestamp: h.timestamp,
        published: h.published,
        performance: h.closed
          ? {
              entryPrice: h.marketData.price || h.marketData.mcap / 1000000000,
              currentPrice: h.exitPrice || 0,
              athPrice: h.athPrice || 0,
              roi: h.roi || 0,
              athRoi:
                ((h.athPrice || 0) / (h.marketData.price || h.marketData.mcap / 1000000000) - 1) *
                100,
              status: h.result || 'OPEN'
            }
          : undefined
      };
      signalStore.push(signal);
    }
    signalStore.sort((a, b) => b.timestamp - a.timestamp);
    console.log('[DEMO] Seeded 30 historical signals');

    // Start demo runner
    demoRunner = new DemoRunner(signal => {
      signalStore.unshift(signal);
      broadcastSignal(signal);
      if (signal.score >= 65) {
        trackSignal(signal).catch(() => {});
      }
      if (signalStore.length > MAX_SIGNALS) {
        signalStore.length = MAX_SIGNALS;
      }
    }, DEMO_SIGNALS_PER_MINUTE);
    demoRunner.start();
    console.log(`[DEMO] Auto-started demo mode (${DEMO_SIGNALS_PER_MINUTE} signals/min)`);
  }
});

// Auto-scan every 30 seconds
setInterval(async () => {
  try {
    const signals = await aggregate();
    for (const signal of signals) {
      const exists = signalStore.some(
        s => s.token === signal.token && Math.abs(s.timestamp - signal.timestamp) < 60000
      );

      if (!exists) {
        signalStore.unshift(signal);
        broadcastSignal(signal);
        console.log(
          `[${new Date().toLocaleTimeString()}] New signal: ${signal.symbol} (Score: ${signal.score})`
        );

        // Auto-track high-quality signals
        if (signal.score >= 65) {
          trackSignal(signal).catch(e => console.error('[TRACKER] Failed:', e));
        }

        // Auto-publish to on-chain (score >= 70)
        autoPublishSignal(signal).catch(e => console.error('[ONCHAIN] Failed:', e));

        // Send Telegram alert for high-quality signals
        if (shouldAlert(signal)) {
          sendTelegramAlert(signal).catch(e => console.error('[TELEGRAM] Failed:', e));
        }
      }
    }

    if (signalStore.length > MAX_SIGNALS) {
      signalStore.length = MAX_SIGNALS;
    }
  } catch (error) {
    console.error('Auto-scan error:', error);
  }
}, 30000);

// Update tracked signal prices every 60 seconds
setInterval(async () => {
  try {
    await updateTrackedSignals();
    const summary = getPerformanceSummary();
    if (summary.total > 0) {
      console.log(
        `[${new Date().toLocaleTimeString()}] Tracking ${summary.total} signals | Win rate: ${summary.winRate.toFixed(1)}% | Avg ROI: ${summary.avgRoi.toFixed(1)}%`
      );
    }
  } catch (error) {
    console.error('Price update error:', error);
  }
}, 60000);

export { app, server };
