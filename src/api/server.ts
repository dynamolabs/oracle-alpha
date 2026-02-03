import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { aggregate } from '../aggregator';
import { AggregatedSignal, SignalQuery } from '../types';
import { trackSignal, updateTrackedSignals, getTrackedSignals, getPerformanceSummary, getTrackedSignal } from '../tracker/performance';
import { getOracleStatus, formatStatusMessage } from './status';
import { initPublisher, publishSignalOnChain, getOnChainStats, fetchOnChainSignals } from '../onchain/publisher';
import { sendTelegramAlert, shouldAlert } from '../notifications/telegram';
import { initAthUpdater, startAthUpdater } from '../onchain/ath-updater';

// On-chain publishing state
let onChainEnabled = false;
const publishedTokens = new Set<string>(); // Track which tokens we've published

const PORT = process.env.PORT || 3900;

// In-memory signal store (would be replaced with DB in production)
const signalStore: AggregatedSignal[] = [];
const MAX_SIGNALS = 1000;

// WebSocket clients
const wsClients = new Set<WebSocket>();

import path from 'path';

// Express app
const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../../app')));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
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

// Full status endpoint
app.get('/api/status', (req, res) => {
  res.json(getOracleStatus());
});

// Text status (for CLI/agents)
app.get('/api/status/text', (req, res) => {
  res.type('text/plain').send(formatStatusMessage());
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
    const cutoff = Date.now() - (query.maxAge * 60 * 1000);
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
  
  const avgScore = total > 0 
    ? signalStore.reduce((sum, s) => sum + s.score, 0) / total 
    : 0;
  
  const avgRoi = withPerformance.length > 0
    ? withPerformance.reduce((sum, s) => sum + (s.performance?.roi || 0), 0) / withPerformance.length
    : 0;
  
  res.json({
    totalSignals: total,
    openSignals: open,
    closedSignals: wins + losses,
    wins,
    losses,
    winRate: (wins + losses) > 0 ? (wins / (wins + losses) * 100).toFixed(1) : '0',
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
      stats.avgScore = ((stats.avgScore * (stats.count - 1)) + source.rawScore) / stats.count;
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
      const exists = signalStore.some(s => 
        s.token === signal.token && 
        Math.abs(s.timestamp - signal.timestamp) < 60000
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

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  wsClients.add(ws);
  
  // Send recent signals on connect
  ws.send(JSON.stringify({
    type: 'history',
    data: signalStore.slice(0, 10)
  }));
  
  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('WebSocket client disconnected');
  });
  
  ws.on('message', (message) => {
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

// Start server
server.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  🔮 ORACLE Alpha API Server                    ║
╠═══════════════════════════════════════════════╣
║  REST API: http://localhost:${PORT}/api        ║
║  WebSocket: ws://localhost:${PORT}/ws          ║
╚═══════════════════════════════════════════════╝
  `);
  
  // Initialize on-chain connection
  await initOnChain();
  
  // Initialize ATH updater
  const athEnabled = await initAthUpdater();
  if (athEnabled) {
    startAthUpdater();
    console.log('[SERVER] ATH tracking ENABLED');
  }
});

// Auto-scan every 30 seconds
setInterval(async () => {
  try {
    const signals = await aggregate();
    for (const signal of signals) {
      const exists = signalStore.some(s => 
        s.token === signal.token && 
        Math.abs(s.timestamp - signal.timestamp) < 60000
      );
      
      if (!exists) {
        signalStore.unshift(signal);
        broadcastSignal(signal);
        console.log(`[${new Date().toLocaleTimeString()}] New signal: ${signal.symbol} (Score: ${signal.score})`);
        
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
      console.log(`[${new Date().toLocaleTimeString()}] Tracking ${summary.total} signals | Win rate: ${summary.winRate.toFixed(1)}% | Avg ROI: ${summary.avgRoi.toFixed(1)}%`);
    }
  } catch (error) {
    console.error('Price update error:', error);
  }
}, 60000);

export { app, server };
