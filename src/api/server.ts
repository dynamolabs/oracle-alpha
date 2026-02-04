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
import { exportSignals, exportPerformanceReport } from '../export/data-export';
import { explainSignal, formatExplanation } from '../analysis/explainer';
import {
  loadProof,
  listProofs,
  verifyProof,
  revealProof,
  formatProofForDisplay,
  getProofsReadyForReveal,
  ReasoningProof
} from '../reasoning/proofs';
import { publishSignalWithProof, revealReasoningOnChain } from '../onchain/publisher';

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

// Redirect root to landing page
app.get('/', (req, res) => {
  res.redirect('/landing.html');
});

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
    programId: ORACLE_PROGRAM_ID,
    network: SOLANA_NETWORK,
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
      explorer: getExplorerUrl(ORACLE_PROGRAM_ID)
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

  text += `\n⛓️ Verifiable on Solana ${SOLANA_NETWORK}`;

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

// === SIGNAL ANALYSIS ===

// Get AI-style explanation for a signal
app.get('/api/explain/:id', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }

  const explanation = explainSignal(signal);
  res.json({
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      score: signal.score,
      riskLevel: signal.riskLevel
    },
    explanation
  });
});

// Get formatted text explanation
app.get('/api/explain/:id/text', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }

  const text = formatExplanation(signal);
  res.type('text/plain').send(text);
});

// === REASONING PROOFS API ===
// Verifiable AI reasoning - proves analysis was committed BEFORE outcome

// List all reasoning proofs
app.get('/api/proofs', (req, res) => {
  const includeRevealed = req.query.revealed !== 'false';
  let proofs = listProofs();

  if (!includeRevealed) {
    proofs = proofs.filter(p => !p.revealed);
  }

  res.json({
    count: proofs.length,
    proofs: proofs.map(p => ({
      signalId: p.signalId,
      symbol: p.symbol,
      token: p.token,
      timestamp: p.timestamp,
      reasoningHash: p.reasoningHash,
      revealed: p.revealed,
      revealedAt: p.revealedAt,
      conviction: p.reasoning.conviction,
      verified: verifyProof(p)
    }))
  });
});

// Get a specific proof
app.get('/api/proofs/:signalId', (req, res) => {
  const proof = loadProof(req.params.signalId);

  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }

  // If not revealed, only show the hash (not the reasoning)
  if (!proof.revealed) {
    return res.json({
      signalId: proof.signalId,
      symbol: proof.symbol,
      token: proof.token,
      timestamp: proof.timestamp,
      reasoningHash: proof.reasoningHash,
      revealed: false,
      marketDataAtSignal: proof.marketDataAtSignal,
      message: 'Reasoning not yet revealed. Hash is committed on-chain.'
    });
  }

  // Full proof if revealed
  res.json({
    signalId: proof.signalId,
    symbol: proof.symbol,
    token: proof.token,
    timestamp: proof.timestamp,
    reasoningHash: proof.reasoningHash,
    revealed: true,
    revealedAt: proof.revealedAt,
    priceAtReveal: proof.priceAtReveal,
    reasoning: proof.reasoning,
    marketDataAtSignal: proof.marketDataAtSignal,
    verified: verifyProof(proof)
  });
});

// Verify a proof (anyone can verify)
app.get('/api/proofs/:signalId/verify', (req, res) => {
  const proof = loadProof(req.params.signalId);

  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }

  const isValid = verifyProof(proof);

  res.json({
    signalId: proof.signalId,
    symbol: proof.symbol,
    reasoningHash: proof.reasoningHash,
    verified: isValid,
    message: isValid
      ? 'Proof is valid - hash(reasoning + salt) matches committed hash'
      : 'INVALID PROOF - hash does not match!'
  });
});

// Reveal a proof (after price movement)
app.post('/api/proofs/:signalId/reveal', async (req, res) => {
  const { signalId } = req.params;
  const { currentPrice } = req.body;

  const proof = await revealProof(signalId, currentPrice);

  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }

  // Also mark as revealed on-chain if possible
  try {
    const signalIdNum = parseInt(signalId);
    if (!isNaN(signalIdNum)) {
      await revealReasoningOnChain(signalIdNum);
    }
  } catch (e) {
    console.error('[PROOFS] Failed to reveal on-chain:', e);
  }

  res.json({
    signalId: proof.signalId,
    symbol: proof.symbol,
    revealed: true,
    revealedAt: proof.revealedAt,
    priceAtReveal: proof.priceAtReveal,
    reasoning: proof.reasoning,
    verified: verifyProof(proof)
  });
});

// Get formatted proof text (human readable)
app.get('/api/proofs/:signalId/text', (req, res) => {
  const proof = loadProof(req.params.signalId);

  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }

  if (!proof.revealed) {
    return res
      .type('text/plain')
      .send(
        `🔐 REASONING PROOF: $${proof.symbol}\n` +
          `${'═'.repeat(40)}\n\n` +
          '⏳ Status: NOT YET REVEALED\n' +
          `📅 Committed: ${new Date(proof.timestamp).toISOString()}\n` +
          `🔑 Hash: ${proof.reasoningHash}\n\n` +
          'The AI reasoning was committed before the outcome.\n' +
          'Once revealed, anyone can verify the hash matches.'
      );
  }

  res.type('text/plain').send(formatProofForDisplay(proof));
});

// Get proofs ready for reveal (older than threshold)
app.get('/api/proofs/pending/reveal', (req, res) => {
  const minAgeMinutes = req.query.minAge ? parseInt(req.query.minAge as string) : 60;
  const pending = getProofsReadyForReveal(minAgeMinutes);

  res.json({
    minAgeMinutes,
    count: pending.length,
    proofs: pending.map(p => ({
      signalId: p.signalId,
      symbol: p.symbol,
      token: p.token,
      timestamp: p.timestamp,
      reasoningHash: p.reasoningHash,
      ageMinutes: Math.floor((Date.now() - p.timestamp) / 60000)
    }))
  });
});

// Agent-optimized proof verification
app.get('/api/agent/proofs/:signalId', (req, res) => {
  const proof = loadProof(req.params.signalId);

  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }

  res.json({
    signalId: proof.signalId,
    token: proof.token,
    symbol: proof.symbol,
    timestamp: proof.timestamp,
    reasoningHash: proof.reasoningHash,
    revealed: proof.revealed,
    verified: verifyProof(proof),
    // Only include reasoning if revealed
    ...(proof.revealed
      ? {
          reasoning: {
            conviction: proof.reasoning.conviction,
            priceTargets: proof.reasoning.priceTargets,
            bullishCount: proof.reasoning.bullishFactors.length,
            bearishCount: proof.reasoning.bearishFactors.length,
            timeframe: proof.reasoning.timeframe
          },
          outcome: proof.priceAtReveal
            ? {
                priceAtSignal: proof.marketDataAtSignal.mcap,
                priceAtReveal: proof.priceAtReveal,
                roi: (
                  ((proof.priceAtReveal - proof.marketDataAtSignal.mcap) /
                    proof.marketDataAtSignal.mcap) *
                  100
                ).toFixed(2)
              }
            : null
        }
      : {})
  });
});

// === DATA EXPORT ===

// Export signals in various formats
app.get('/api/export/signals', (req, res) => {
  const format = (req.query.format as string) || 'json';
  const minScore = req.query.minScore ? parseInt(req.query.minScore as string) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

  const config = {
    format: format as 'json' | 'csv' | 'markdown',
    includePerformance: req.query.performance !== 'false',
    includeMetadata: req.query.metadata !== 'false',
    minScore,
    maxSignals: limit
  };

  const data = exportSignals(signalStore, config);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=oracle-signals.csv');
  } else if (format === 'markdown') {
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename=oracle-signals.md');
  } else {
    res.setHeader('Content-Type', 'application/json');
  }

  res.send(data);
});

// Export performance report
app.get('/api/export/performance', (req, res) => {
  const report = exportPerformanceReport(signalStore);
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', 'attachment; filename=oracle-performance.md');
  res.send(report);
});

// === AGENT COMPOSABILITY API ===
// Endpoints optimized for agent consumption (Colosseum skill.json compatible)

// Serve skill.json for agent discovery
app.get('/skill.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../../app/skill.json'));
});

// Network config
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const ORACLE_PROGRAM_ID =
  process.env.ORACLE_PROGRAM_ID || 'AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd';
const getExplorerUrl = (address: string) => {
  const cluster = SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${SOLANA_NETWORK}`;
  return `https://explorer.solana.com/address/${address}${cluster}`;
};

// Agent-optimized real-time signals
app.get('/api/agent/signals', (req, res) => {
  const minScore = req.query.minScore ? parseInt(req.query.minScore as string) : 60;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const riskLevel = req.query.riskLevel as string | undefined;

  let signals = signalStore.filter(s => s.score >= minScore);

  if (riskLevel) {
    signals = signals.filter(s => s.riskLevel === riskLevel.toUpperCase());
  }

  const agentSignals = signals.slice(0, limit).map(s => ({
    id: s.id,
    token: s.token,
    symbol: s.symbol,
    name: s.name,
    score: s.score,
    confidence: s.confidence,
    riskLevel: s.riskLevel,
    sources: s.sources.map(src => ({
      type: src.source,
      score: src.rawScore,
      weight: src.weight
    })),
    marketData: {
      price: s.marketData?.price || null,
      mcap: s.marketData?.mcap || null,
      volume1h: s.marketData?.volume1h || null,
      priceChange1h: s.marketData?.priceChange1h || null
    },
    narratives: s.analysis?.narrative || [],
    timestamp: s.timestamp,
    age_minutes: Math.floor((Date.now() - s.timestamp) / 60000),
    onchain_published: s.published || false,
    performance: s.performance || null
  }));

  res.json({
    count: agentSignals.length,
    timestamp: Date.now(),
    signals: agentSignals
  });
});

// Get latest best signal for quick decisions
app.get('/api/agent/signals/latest', (req, res) => {
  const minScore = 65;
  const maxAge = 30 * 60 * 1000; // 30 minutes
  const cutoff = Date.now() - maxAge;

  const candidates = signalStore
    .filter(s => s.score >= minScore && s.timestamp >= cutoff)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return res.json({ signal: null, message: 'No qualifying signals in the last 30 minutes' });
  }

  const best = candidates[0];
  res.json({
    signal: {
      id: best.id,
      token: best.token,
      symbol: best.symbol,
      score: best.score,
      riskLevel: best.riskLevel,
      sources: best.sources.map(src => src.source),
      price: best.marketData?.price || null,
      mcap: best.marketData?.mcap || null,
      timestamp: best.timestamp,
      action:
        best.riskLevel === 'LOW' ? 'STRONG_BUY' : best.riskLevel === 'MEDIUM' ? 'BUY' : 'WATCH'
    }
  });
});

// Get signal by token address
app.get('/api/agent/signals/token/:address', (req, res) => {
  const { address } = req.params;
  const signal = signalStore.find(s => s.token === address);

  if (!signal) {
    return res.status(404).json({ error: 'No signal found for this token' });
  }

  res.json({
    id: signal.id,
    token: signal.token,
    symbol: signal.symbol,
    score: signal.score,
    riskLevel: signal.riskLevel,
    sources: signal.sources,
    marketData: signal.marketData,
    timestamp: signal.timestamp,
    performance: signal.performance
  });
});

// Agent performance endpoint
app.get('/api/agent/performance', (req, res) => {
  const summary = getPerformanceSummary();
  const tracked = getTrackedSignals();

  const wins = tracked.filter(t => t.status === 'WIN').length;
  const losses = tracked.filter(t => t.status === 'LOSS').length;
  const open = tracked.filter(t => t.status === 'OPEN').length;

  res.json({
    totalSignals: summary.total,
    openSignals: open,
    closedSignals: wins + losses,
    wins,
    losses,
    winRate: summary.winRate,
    avgRoi: summary.avgRoi,
    bestRoi: summary.bestTrade?.roi || 0,
    worstRoi: summary.worstTrade?.roi || 0,
    timestamp: Date.now()
  });
});

// Historical performance for agents
app.get('/api/agent/performance/history', (req, res) => {
  const days = req.query.days ? parseInt(req.query.days as string) : 7;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const historical = signalStore
    .filter(s => s.performance && s.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map(s => ({
      id: s.id,
      token: s.token,
      symbol: s.symbol,
      score: s.score,
      entryPrice: s.performance?.entryPrice,
      exitPrice: s.performance?.currentPrice,
      athPrice: s.performance?.athPrice,
      roi: s.performance?.roi,
      athRoi: s.performance?.athRoi,
      status: s.performance?.status,
      timestamp: s.timestamp
    }));

  res.json({
    days,
    count: historical.length,
    history: historical
  });
});

// Agent leaderboard
app.get('/api/agent/leaderboard', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const tracked = getTrackedSignals();

  const sorted = tracked
    .filter(t => t.currentPrice > 0)
    .sort((a, b) => (b.roi || 0) - (a.roi || 0))
    .slice(0, limit);

  res.json({
    count: sorted.length,
    leaderboard: sorted.map((t, idx) => ({
      rank: idx + 1,
      symbol: t.symbol,
      token: t.token,
      entryPrice: t.entryPrice,
      currentPrice: t.currentPrice,
      athPrice: t.athPrice,
      roi: t.roi,
      athRoi: t.athRoi,
      status: t.status
    }))
  });
});

// Agent sources breakdown
app.get('/api/agent/sources', (req, res) => {
  const sourceStats = new Map<
    string,
    { count: number; avgScore: number; winRate: number; wins: number; total: number }
  >();

  for (const signal of signalStore) {
    for (const source of signal.sources) {
      const stats = sourceStats.get(source.source) || {
        count: 0,
        avgScore: 0,
        winRate: 0,
        wins: 0,
        total: 0
      };
      stats.count++;
      stats.avgScore = (stats.avgScore * (stats.count - 1) + source.rawScore) / stats.count;
      if (signal.performance) {
        stats.total++;
        if (signal.performance.status === 'WIN') stats.wins++;
        stats.winRate = (stats.wins / stats.total) * 100;
      }
      sourceStats.set(source.source, stats);
    }
  }

  const sources = Array.from(sourceStats.entries()).map(([name, stats]) => ({
    source: name,
    signalCount: stats.count,
    avgScore: Math.round(stats.avgScore * 10) / 10,
    winRate: Math.round(stats.winRate * 10) / 10,
    reliability:
      stats.total >= 10
        ? stats.winRate >= 60
          ? 'HIGH'
          : stats.winRate >= 45
            ? 'MEDIUM'
            : 'LOW'
        : 'INSUFFICIENT_DATA'
  }));

  res.json({ sources });
});

// On-chain verified signals for agents
app.get('/api/agent/onchain/verified', async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const signals = await fetchOnChainSignals(limit);

  res.json({
    count: signals.length,
    network: SOLANA_NETWORK,
    programId: ORACLE_PROGRAM_ID,
    signals: signals.map(s => ({
      ...s,
      explorer: getExplorerUrl(s.publicKey)
    }))
  });
});

// On-chain stats for agents
app.get('/api/agent/onchain/stats', async (req, res) => {
  const stats = await getOnChainStats();
  res.json({
    enabled: !!stats,
    network: SOLANA_NETWORK,
    programId: ORACLE_PROGRAM_ID,
    ...(stats || {})
  });
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

// === WEBHOOK SUBSCRIPTIONS ===

interface WebhookSubscription {
  id: string;
  webhookUrl: string;
  minScore: number;
  risks: string[];
  createdAt: number;
  active: boolean;
}

const webhookSubscriptions: Map<string, WebhookSubscription> = new Map();

// Subscribe to signals via webhook
app.post('/api/subscribe', (req, res) => {
  const { webhookUrl, minScore = 50, risks = ['LOW', 'MEDIUM', 'HIGH'] } = req.body;

  if (!webhookUrl) {
    return res.status(400).json({ error: 'webhookUrl is required' });
  }

  try {
    new URL(webhookUrl); // Validate URL
  } catch {
    return res.status(400).json({ error: 'Invalid webhookUrl' });
  }

  const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const subscription: WebhookSubscription = {
    id,
    webhookUrl,
    minScore: Math.max(0, Math.min(100, minScore)),
    risks: risks.map((r: string) => r.toUpperCase()),
    createdAt: Date.now(),
    active: true
  };

  webhookSubscriptions.set(id, subscription);
  console.log(`[Webhook] New subscription: ${id} -> ${webhookUrl}`);

  res.json({
    subscriptionId: id,
    status: 'active',
    minScore: subscription.minScore,
    risks: subscription.risks
  });
});

// Unsubscribe
app.delete('/api/subscribe/:id', (req, res) => {
  const { id } = req.params;
  if (webhookSubscriptions.has(id)) {
    webhookSubscriptions.delete(id);
    res.json({ status: 'unsubscribed' });
  } else {
    res.status(404).json({ error: 'Subscription not found' });
  }
});

// List subscriptions (for debugging)
app.get('/api/subscriptions', (req, res) => {
  const subs = Array.from(webhookSubscriptions.values());
  res.json({ count: subs.length, subscriptions: subs });
});

// Function to notify webhooks (call this when new signal is created)
async function notifyWebhooks(signal: any) {
  for (const sub of webhookSubscriptions.values()) {
    if (!sub.active) continue;
    if (signal.score < sub.minScore) continue;
    if (!sub.risks.includes(signal.riskLevel)) continue;

    try {
      await fetch(sub.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_signal',
          signal: {
            id: signal.id,
            token: signal.token,
            symbol: signal.symbol,
            score: signal.score,
            riskLevel: signal.riskLevel,
            price: signal.marketData?.price,
            timestamp: signal.timestamp
          }
        })
      });
      console.log(`[Webhook] Notified ${sub.id}`);
    } catch (err) {
      console.error(`[Webhook] Failed to notify ${sub.id}:`, err);
    }
  }
}

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

// Auto-publish high-confidence signals WITH reasoning proofs
async function autoPublishSignal(signal: AggregatedSignal) {
  if (!onChainEnabled) return;

  // Only publish high-quality signals we haven't published before
  if (signal.score >= 70 && !publishedTokens.has(signal.token)) {
    // Use proof-enabled publishing for verifiable AI reasoning
    const { tx, proof } = await publishSignalWithProof(signal);
    if (tx) {
      publishedTokens.add(signal.token);
      console.log(
        `[ONCHAIN] Published ${signal.symbol} with reasoning proof (Score: ${signal.score})`
      );
      if (proof) {
        console.log(`[PROOFS] Commitment hash: ${proof.reasoningHash.slice(0, 16)}...`);
      }
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
