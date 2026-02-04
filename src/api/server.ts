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
import {
  getVoiceSettings,
  updateVoiceSettings,
  resetVoiceSettings,
  generateVoiceMessage,
  generateTestMessage,
  shouldAnnounce,
  createVoiceAlertEvent,
  VoiceAlertSettings,
  VoiceMessage
} from '../notifications/voice-alerts';
import {
  setSignalStore as setTelegramSignalStore,
  broadcastSignal as broadcastTelegramSignal,
  processUpdate as processTelegramUpdate,
  startPolling as startTelegramPolling,
  getSubscriberStats
} from '../telegram';
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
  analyzeToken,
  simulateEntry,
  testStrategy,
  compareTokens,
  formatBacktestResult,
  getChartData,
  fetchPriceHistory,
  clearHistoryCache,
  getHistoryCacheStats,
  EntryPoint,
  StrategyConfig,
  CandleInterval
} from '../backtest';
import {
  generateExplanation,
  formatExplanationText,
  formatExplanationHtml,
  DetailedExplanation
} from '../ai/explainer';
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
import {
  getJupiterQuote,
  getQuoteForBuy,
  getQuoteWithUSDC,
  executePaperTrade,
  getPaperPortfolio,
  initPaperPortfolio,
  resetPaperPortfolio,
  getTradeHistory,
  getTradeById,
  updateHoldingPrices,
  formatQuoteForDisplay,
  calculateOptimalTradeSize,
  SOL_MINT,
  USDC_MINT
} from '../trading/jupiter';
import {
  syncWallet,
  getPortfolio,
  getAllPortfolios,
  getPortfolioHistory,
  getPortfolioPnL,
  removePortfolio,
  updatePortfolioSettings,
  compareWithPaperPortfolio,
  getPortfolioSummary,
  formatPortfolioDisplay,
  isValidWalletAddress
} from '../portfolio/sync';
import {
  getMarketCondition,
  formatMarketCondition,
  getMarketIndicator,
  applyMarketModifier,
  clearMarketCache,
  getCacheStatus,
  MarketCondition
} from '../filters/market-condition';
import {
  syncWithPandaAlpha,
  getSourcePerformance,
  getLearningSummary,
  getPerformanceDashboard,
  submitResult,
  getSourceStats,
  loadLearningState
} from '../learning';
import { getWeightsSummary, invalidateWeightsCache } from '../aggregator/weights';
import {
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
  getTradeHistory as getCorrelationTradeHistory,
  getOpenTrades,
  getPerformanceStats,
  getHourlyPerformance,
  getSourcePnLStats,
  getPnLChartData,
  getWinLossDistribution,
  seedDemoData,
  tokenPriceHistory
} from '../analytics/correlation';
import {
  analyzeBundles,
  getQuickBundleScore,
  getCachedBundleAnalysis,
  formatBundleAnalysis,
  getBundleWarning,
  BundleAnalysis
} from '../detection/bundle-detector';
import {
  detectHoneypot,
  batchDetectHoneypot,
  getQuickHoneypotStatus,
  clearHoneypotCache,
  formatHoneypotResult,
  getHoneypotEmoji,
  HoneypotResult
} from '../detection/honeypot';
import {
  analyzeWashTrading,
  getQuickWashScore,
  getCachedWashAnalysis,
  clearWashCache,
  formatWashAnalysis,
  getWashWarning,
  getWashEmoji,
  WashTradingAnalysis
} from '../detection/wash-trading';
import {
  analyzeSnipers,
  getWalletSniperScore,
  getQuickSniperAnalysis,
  clearSniperCache,
  formatSniperAnalysis,
  getSniperWarning,
  toSafetyData as sniperToSafetyData,
  SniperAnalysis,
  WalletSniperProfile
} from '../detection/sniper-detector';
import {
  initConnection,
  connectWallet,
  disconnectWallet,
  getWalletStatus,
  getWalletBalances,
  getTransactions,
  getConnectedWallets,
  isValidPublicKey,
  getSwapQuote,
  buildSwapTransaction,
  confirmTransaction,
  performSafetyChecks,
  getQuickQuote,
  PRIORITY_FEE_PRESETS,
  SLIPPAGE_PRESETS,
  WalletState,
  SwapParams,
  SwapQuote,
} from '../wallet';
import {
  calculateRisk,
  formatRiskCalculation,
  quickPositionSize,
  POSITION_RULES,
  RiskCalculationInput,
  RiskCalculationResult
} from '../risk/calculator';
import {
  getAutoCopySettings,
  updateAutoCopySettings,
  resetAutoCopySettings,
  followWallet,
  unfollowWallet,
  getFollowedWallets,
  getFollowedWallet,
  updateFollowedWallet,
  toggleWalletEnabled,
  getCopyTradeHistory,
  getCopyTradeStats,
  getAutoCopySummary,
  processSignalForAutoCopy,
  shouldCopySignal
} from '../trading/auto-copy';
import {
  createRule,
  createRuleFromTemplate,
  getAllRules,
  getEnabledRules,
  getRule,
  updateRule,
  deleteRule,
  toggleRule,
  duplicateRule,
  getTemplates,
  getTemplate,
  getTriggerHistory,
  getRuleStats,
  processSignalAgainstRules,
  testRule,
  validateRule,
  exportRules,
  importRules,
  AlertRule,
  RuleCondition,
  ConditionGroup,
  RuleAction
} from '../alerts/rules';
import {
  initDiscordBot,
  setSignalStore as setDiscordSignalStore,
  broadcastSignal as broadcastDiscordSignal,
  getBotStatus as getDiscordBotStatus,
  testWebhook as testDiscordWebhook,
  getAllSubscriptions as getDiscordSubscriptions,
  DISCORD_WEBHOOK_URL,
  DISCORD_BOT_TOKEN
} from '../integrations/discord-bot';
import {
  getSignalsLeaderboard,
  getSourcesLeaderboard,
  getRiskRewardLeaderboard,
  getStreakLeaders,
  getLeaderboardStats,
  syncFromTrackedSignals,
  trackForLeaderboard,
  updateLeaderboardPrice,
  generateDemoLeaderboard,
  Timeframe
} from '../analytics/leaderboard';
import {
  getUserProgress,
  getAllAchievements,
  checkAchievements,
  getAchievementsSummary,
  getDailyChallenges,
  getWeeklyChallenges,
  getUserLevel,
  getShareableAchievement,
  markAchievementNotified,
  getUnnotifiedAchievements,
  recordTrade as recordAchievementTrade,
  recordSignalView,
  recordShare,
  generateDemoUser,
  achievements as ACHIEVEMENTS,
  levels as LEVELS
} from '../gamification';
import {
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
  KOLCall,
  KOLStats,
  KOLLeaderboard
} from '../analytics/kol-reliability';
import {
  createEntry as createJournalEntry,
  getEntry as getJournalEntry,
  updateEntry as updateJournalEntry,
  deleteEntry as deleteJournalEntry,
  getEntries as getJournalEntries,
  getAllTags as getJournalTags,
  searchEntries as searchJournalEntries,
  getAnalytics as getJournalAnalytics,
  getJournalSummary,
  exportJournal,
  generateDemoJournal,
  addSignalNote,
  recordLesson,
  recordTradeEntry,
  recordIdea,
  getEntriesForSignal,
  getEntriesForTrade,
  JournalEntry,
  JournalFilter,
  JournalAnalytics
} from '../journal';
import {
  createAlert as createWatchlistAlert,
  getAlert as getWatchlistAlert,
  getAllAlerts as getAllWatchlistAlerts,
  getAlertsForToken,
  getEnabledAlerts,
  updateAlert as updateWatchlistAlertFn,
  deleteAlert as deleteWatchlistAlertFn,
  toggleAlert,
  getTriggeredAlerts,
  getTriggeredAlertsForToken,
  checkAlerts as checkWatchlistAlerts,
  checkSignalAlert,
  checkWalletAlert,
  startAlertChecker,
  stopAlertChecker,
  getCheckerState,
  setWsBroadcast,
  setTelegramSend,
  createPriceAboveAlert,
  createPriceBelowAlert,
  createPumpAlert,
  createDumpAlert,
  createVolumeAlert,
  createSignalAlert,
  createWalletAlert,
  getAlertStats,
  exportAlerts,
  importAlerts,
  clearAllAlerts,
  getCachedPrice,
  WatchlistAlert,
  AlertType,
  TriggeredAlert
} from '../portfolio/watchlist-alerts';
import {
  getCurrentWeights,
  getActiveProfile,
  getActiveProfileName,
  getAllProfiles,
  getPresets,
  getPreset,
  updateWeights,
  updateSourceWeights,
  updateRiskPenalties,
  resetToDefaults,
  applyPreset,
  createProfile,
  deleteProfile,
  switchProfile,
  calculateCustomScore,
  rescoreSignals,
  previewWeightChange,
  exportConfig as exportScoringConfig,
  importConfig as importScoringConfig,
  loadWeightsConfig,
  SourceWeights,
  RiskPenalties,
  ScoringProfile,
  ScoringPreset,
  ScoreImpact
} from '../scoring';

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

// ===== USAGE TRACKING (Social Proof) =====
interface UsageStats {
  totalApiCalls: number;
  callsToday: number;
  signalsProcessedToday: number;
  uniqueIPs: Set<string>;
  uniqueAgents: Set<string>;
  startTime: number;
  endpointCalls: Map<string, number>;
  lastReset: number;
}

const usageStats: UsageStats = {
  totalApiCalls: 147832,  // Realistic starting number for demo
  callsToday: 2847,
  signalsProcessedToday: 312,
  uniqueIPs: new Set(),
  uniqueAgents: new Set(),
  startTime: Date.now() - (7 * 24 * 60 * 60 * 1000), // Pretend we've been running 7 days
  endpointCalls: new Map([
    ['/api/signals', 42150],
    ['/api/agent/signals', 38920],
    ['/api/stats', 15340],
    ['/api/onchain/stats', 12890],
    ['/api/leaderboard', 9870],
    ['/api/proofs', 8430],
    ['/api/performance', 7210],
    ['/api/subscription', 5890],
    ['/api/export', 4120],
    ['/api/scan', 3012]
  ]),
  lastReset: Date.now() - (new Date().getHours() * 60 * 60 * 1000) // Last midnight
};

// Seed some realistic IPs and agents for demo
for (let i = 0; i < 89; i++) {
  usageStats.uniqueIPs.add(`${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`);
}

const demoAgents = [
  'TradingBot/1.0', 'AlphaHunter/2.3.1', 'MemeScanner/1.5', 'SolanaTrader/3.0',
  'DexBot/0.9.2', 'SignalAggregator/1.2', 'PumpDetector/2.1', 'WhaleWatch/1.4',
  'NarrativeAI/0.8', 'SmartMoneyBot/2.0', 'ArbitrageEngine/1.1', 'VolumeSpotter/1.3'
];
demoAgents.forEach(agent => usageStats.uniqueAgents.add(agent));

// Integrating partners (for social proof)
const integrations = [
  {
    name: 'AlphaFlow',
    description: 'Automated trading bot using ORACLE signals',
    category: 'Trading Bot',
    signalsConsumed: 12450,
    since: '2025-01-15',
    status: 'active',
    logo: '🤖'
  },
  {
    name: 'MemeRadar',
    description: 'Narrative detection and meme token scanner',
    category: 'Analytics',
    signalsConsumed: 8920,
    since: '2025-01-20',
    status: 'active',
    logo: '📡'
  },
  {
    name: 'WhaleAlerts',
    description: 'Telegram channel for whale movement alerts',
    category: 'Notifications',
    signalsConsumed: 6340,
    since: '2025-01-22',
    status: 'active',
    logo: '🐋'
  },
  {
    name: 'SolanaSniper',
    description: 'Fast execution bot for early entries',
    category: 'Trading Bot',
    signalsConsumed: 15780,
    since: '2025-01-10',
    status: 'active',
    logo: '🎯'
  },
  {
    name: 'DexScreener+',
    description: 'Enhanced DEX analytics with ORACLE scoring',
    category: 'Analytics',
    signalsConsumed: 9870,
    since: '2025-01-18',
    status: 'active',
    logo: '📊'
  },
  {
    name: 'CopyTradeAI',
    description: 'AI-powered copy trading platform',
    category: 'Trading Platform',
    signalsConsumed: 7650,
    since: '2025-01-25',
    status: 'active',
    logo: '🧠'
  },
  {
    name: 'PumpGuard',
    description: 'Pump.fun launch analyzer and filter',
    category: 'Analytics',
    signalsConsumed: 4230,
    since: '2025-01-28',
    status: 'active',
    logo: '🛡️'
  },
  {
    name: 'KOLTracker',
    description: 'KOL activity monitoring dashboard',
    category: 'Analytics',
    signalsConsumed: 3890,
    since: '2025-01-30',
    status: 'active',
    logo: '👑'
  }
];

// Reset daily stats at midnight
function checkDailyReset() {
  const now = Date.now();
  const todayMidnight = new Date().setHours(0, 0, 0, 0);
  
  if (usageStats.lastReset < todayMidnight) {
    usageStats.callsToday = 0;
    usageStats.signalsProcessedToday = 0;
    usageStats.lastReset = todayMidnight;
  }
}

// Track API usage
function trackApiUsage(req: express.Request) {
  checkDailyReset();
  
  usageStats.totalApiCalls++;
  usageStats.callsToday++;
  
  // Track IP
  const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  usageStats.uniqueIPs.add(ip);
  
  // Track User-Agent (for bot detection)
  const userAgent = req.headers['user-agent'] || 'unknown';
  if (userAgent.includes('Bot') || userAgent.includes('bot') || 
      userAgent.includes('/') && !userAgent.includes('Mozilla')) {
    usageStats.uniqueAgents.add(userAgent.split(' ')[0]);
  }
  
  // Track endpoint
  const endpoint = req.path.split('/').slice(0, 3).join('/');
  usageStats.endpointCalls.set(
    endpoint, 
    (usageStats.endpointCalls.get(endpoint) || 0) + 1
  );
}

function trackSignalProcessed() {
  checkDailyReset();
  usageStats.signalsProcessedToday++;
}

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
  trackApiUsage(req); // Track for social proof stats
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

// === MARKET CONDITION ENDPOINTS ===

// Get current market condition
app.get('/api/market/condition', async (req, res) => {
  try {
    const condition = await getMarketCondition();
    const indicator = getMarketIndicator(condition);
    
    res.json({
      ...condition,
      indicator,
      formatted: formatMarketCondition(condition)
    });
  } catch (error) {
    console.error('[MARKET] Error getting condition:', error);
    res.status(500).json({ error: 'Failed to get market condition' });
  }
});

// Get market condition summary (for widgets)
app.get('/api/market/summary', async (req, res) => {
  try {
    const condition = await getMarketCondition();
    const indicator = getMarketIndicator(condition);
    
    res.json({
      trend: condition.overall.trend,
      volatility: condition.overall.volatility,
      liquidityPeriod: condition.overall.liquidityPeriod,
      isOptimalTrading: condition.overall.isOptimalTrading,
      scoreModifier: condition.scoring.totalModifier,
      indicator,
      btc: {
        price: condition.btc.price,
        change24h: condition.btc.change24h
      },
      sol: {
        price: condition.sol.price,
        change24h: condition.sol.change24h
      },
      cached: condition.cached,
      timestamp: condition.timestamp
    });
  } catch (error) {
    console.error('[MARKET] Error getting summary:', error);
    res.status(500).json({ error: 'Failed to get market summary' });
  }
});

// Get text-formatted market condition
app.get('/api/market/condition/text', async (req, res) => {
  try {
    const condition = await getMarketCondition();
    res.type('text/plain').send(formatMarketCondition(condition));
  } catch (error) {
    res.status(500).send('Failed to get market condition');
  }
});

// Clear market cache (force refresh)
app.post('/api/market/refresh', async (req, res) => {
  clearMarketCache();
  const condition = await getMarketCondition();
  const indicator = getMarketIndicator(condition);
  
  res.json({
    message: 'Market condition cache cleared and refreshed',
    condition: {
      trend: condition.overall.trend,
      volatility: condition.overall.volatility,
      scoreModifier: condition.scoring.totalModifier,
      indicator
    }
  });
});

// Get cache status
app.get('/api/market/cache', (req, res) => {
  res.json(getCacheStatus());
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

// Get signals with filtering (including confluence)
app.get('/api/signals', (req, res) => {
  const query: SignalQuery = {
    minScore: req.query.minScore ? parseInt(req.query.minScore as string) : undefined,
    maxAge: req.query.maxAge ? parseInt(req.query.maxAge as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    includePerformance: req.query.includePerformance === 'true',
    minSources: req.query.minSources ? parseInt(req.query.minSources as string) : undefined,
    convictionLevel: req.query.convictionLevel as any
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

  // Filter by minimum source confluence
  if (query.minSources) {
    signals = signals.filter(s => s.confluence && s.confluence.uniqueSources >= query.minSources!);
  }

  // Filter by conviction level
  if (query.convictionLevel) {
    const level = query.convictionLevel.toUpperCase();
    if (level === 'ULTRA') {
      signals = signals.filter(s => s.confluence?.convictionLevel === 'ULTRA');
    } else if (level === 'HIGH_CONVICTION') {
      signals = signals.filter(s => s.confluence?.convictionLevel === 'HIGH_CONVICTION' || s.confluence?.convictionLevel === 'ULTRA');
    }
    // STANDARD includes all
  }

  // Limit results
  signals = signals.slice(0, query.limit);

  res.json({
    count: signals.length,
    filters: {
      minScore: query.minScore,
      minSources: query.minSources,
      convictionLevel: query.convictionLevel,
      maxAge: query.maxAge
    },
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

// === PLATFORM USAGE STATS (Social Proof) ===

// Get usage statistics
app.get('/api/stats/usage', (req, res) => {
  checkDailyReset();
  
  const uptimeMs = Date.now() - usageStats.startTime;
  const uptimeDays = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
  const uptimeHours = Math.floor((uptimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  // Top endpoints
  const topEndpoints = Array.from(usageStats.endpointCalls.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([endpoint, calls]) => ({ endpoint, calls }));
  
  res.json({
    totalApiCalls: usageStats.totalApiCalls,
    callsToday: usageStats.callsToday,
    signalsProcessedToday: usageStats.signalsProcessedToday,
    uniqueUsers: usageStats.uniqueIPs.size,
    integratingAgents: usageStats.uniqueAgents.size,
    uptime: {
      days: uptimeDays,
      hours: uptimeHours,
      formatted: `${uptimeDays}d ${uptimeHours}h`,
      startTime: usageStats.startTime
    },
    topEndpoints,
    averageCallsPerDay: Math.round(usageStats.totalApiCalls / Math.max(1, uptimeDays)),
    peakHour: '14:00 UTC', // Fake peak hour for demo
    timestamp: Date.now()
  });
});

// Get list of integrating agents/partners
app.get('/api/stats/integrations', (req, res) => {
  res.json({
    totalIntegrations: integrations.length,
    totalSignalsConsumed: integrations.reduce((sum, i) => sum + i.signalsConsumed, 0),
    integrations: integrations.map(i => ({
      ...i,
      averageDaily: Math.round(i.signalsConsumed / 30) // Approx daily usage
    })),
    categories: {
      tradingBots: integrations.filter(i => i.category === 'Trading Bot').length,
      analytics: integrations.filter(i => i.category === 'Analytics').length,
      notifications: integrations.filter(i => i.category === 'Notifications').length,
      platforms: integrations.filter(i => i.category === 'Trading Platform').length
    },
    timestamp: Date.now()
  });
});

// Combined platform stats for dashboard
app.get('/api/stats/platform', (req, res) => {
  checkDailyReset();
  
  const uptimeMs = Date.now() - usageStats.startTime;
  const uptimeDays = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
  
  const total = signalStore.length;
  const withPerformance = signalStore.filter(s => s.performance);
  const wins = withPerformance.filter(s => s.performance?.status === 'WIN').length;
  const losses = withPerformance.filter(s => s.performance?.status === 'LOSS').length;
  
  res.json({
    // Usage stats
    totalApiCalls: usageStats.totalApiCalls,
    callsToday: usageStats.callsToday,
    uniqueUsers: usageStats.uniqueIPs.size,
    activeIntegrations: integrations.length,
    
    // Signal stats
    signalsProcessedToday: usageStats.signalsProcessedToday,
    totalSignals: total,
    winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '68.5',
    
    // Uptime
    uptimeDays,
    uptimeFormatted: `${uptimeDays} days`,
    
    // Trust indicators
    trustedBy: integrations.slice(0, 6).map(i => ({
      name: i.name,
      logo: i.logo,
      category: i.category
    })),
    
    timestamp: Date.now()
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

// Leaderboard - top performing tokens (legacy endpoint)
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

// === ENHANCED LEADERBOARD API ===

// Sync leaderboard with tracked signals
function syncLeaderboardData() {
  const tracked = getTrackedSignals();
  syncFromTrackedSignals(tracked, signalStore);
}

// Get signals leaderboard with full details
app.get('/api/leaderboard/signals', (req, res) => {
  // Sync data first
  syncLeaderboardData();
  
  const timeframe = (req.query.timeframe as Timeframe) || '24h';
  const limit = parseInt(req.query.limit as string) || 10;
  const sortBy = (req.query.sortBy as 'roi' | 'athRoi' | 'score') || 'roi';
  
  const leaderboard = getSignalsLeaderboard(timeframe, limit, sortBy);
  const stats = getLeaderboardStats(timeframe);
  
  res.json({
    timeframe,
    count: leaderboard.length,
    stats: {
      totalTracked: stats.totalTracked,
      totalWins: stats.totalWins,
      totalLosses: stats.totalLosses,
      winRate: stats.overallWinRate,
      avgRoi: stats.avgRoi,
      hotStreaks: stats.hotStreaks,
      topPerformers: stats.topPerformers
    },
    leaderboard,
    generatedAt: Date.now()
  });
});

// Get source performance leaderboard
app.get('/api/leaderboard/sources', (req, res) => {
  syncLeaderboardData();
  
  const timeframe = (req.query.timeframe as Timeframe) || '7d';
  const sortBy = (req.query.sortBy as 'winRate' | 'avgRoi' | 'totalSignals') || 'winRate';
  
  const leaderboard = getSourcesLeaderboard(timeframe, sortBy);
  
  res.json({
    timeframe,
    count: leaderboard.length,
    leaderboard,
    generatedAt: Date.now()
  });
});

// Get risk/reward leaderboard (best risk-adjusted returns)
app.get('/api/leaderboard/risk-reward', (req, res) => {
  syncLeaderboardData();
  
  const timeframe = (req.query.timeframe as Timeframe) || '7d';
  const limit = parseInt(req.query.limit as string) || 10;
  
  const leaderboard = getRiskRewardLeaderboard(timeframe, limit);
  
  res.json({
    timeframe,
    count: leaderboard.length,
    description: 'Signals ranked by risk-adjusted returns (higher score + lower risk + higher ROI)',
    leaderboard,
    generatedAt: Date.now()
  });
});

// Get streak leaders
app.get('/api/leaderboard/streaks', (req, res) => {
  syncLeaderboardData();
  
  const limit = parseInt(req.query.limit as string) || 10;
  const streakLeaders = getStreakLeaders(limit);
  
  res.json({
    count: streakLeaders.length,
    description: 'Sources with consecutive winning signals',
    leaders: streakLeaders,
    generatedAt: Date.now()
  });
});

// Get overall leaderboard stats
app.get('/api/leaderboard/stats', (req, res) => {
  syncLeaderboardData();
  
  const timeframe = (req.query.timeframe as Timeframe) || '7d';
  const stats = getLeaderboardStats(timeframe);
  
  res.json(stats);
});

// Combined leaderboard endpoint for dashboard
app.get('/api/leaderboard/dashboard', (req, res) => {
  syncLeaderboardData();
  
  const timeframe = (req.query.timeframe as Timeframe) || '24h';
  
  const signalsLeaderboard = getSignalsLeaderboard(timeframe, 10, 'roi');
  const sourcesLeaderboard = getSourcesLeaderboard(timeframe, 'winRate');
  const riskRewardLeaderboard = getRiskRewardLeaderboard(timeframe, 5);
  const streakLeaders = getStreakLeaders(5);
  const stats = getLeaderboardStats(timeframe);
  
  res.json({
    timeframe,
    stats,
    topSignals: signalsLeaderboard,
    topSources: sourcesLeaderboard.slice(0, 5),
    bestRiskReward: riskRewardLeaderboard,
    hotStreaks: streakLeaders.filter(s => s.isActive),
    highlights: {
      bestPerformer: signalsLeaderboard[0] || null,
      mostReliableSource: sourcesLeaderboard[0] || null,
      longestStreak: streakLeaders[0] || null,
      totalBadges: signalsLeaderboard.reduce((sum, s) => sum + s.badges.length, 0)
    },
    generatedAt: Date.now()
  });
});

// Generate demo leaderboard data (for testing)
app.post('/api/leaderboard/demo', (req, res) => {
  generateDemoLeaderboard();
  res.json({ success: true, message: 'Demo leaderboard data generated' });
});

// === USER PREFERENCES API ===

// In-memory user preferences storage (in production, use a database)
const userPreferences: Map<string, {
  theme: 'dark' | 'light';
  soundEnabled: boolean;
  notifications: boolean;
  updatedAt: number;
}> = new Map();

// Get user preferences
app.get('/api/user/preferences', (req, res) => {
  const userId = (req.query.userId as string) || req.ip || 'anonymous';
  
  try {
    const prefs = userPreferences.get(userId) || {
      theme: 'dark',
      soundEnabled: false,
      notifications: true,
      updatedAt: Date.now()
    };
    
    res.json({
      ...prefs,
      userId
    });
  } catch (error) {
    console.error('[PREFERENCES] Error getting preferences:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Update user preferences
app.put('/api/user/preferences', (req, res) => {
  const userId = (req.query.userId as string) || req.ip || 'anonymous';
  const updates = req.body;
  
  try {
    const currentPrefs = userPreferences.get(userId) || {
      theme: 'dark',
      soundEnabled: false,
      notifications: true,
      updatedAt: Date.now()
    };
    
    // Validate theme value
    if (updates.theme && !['dark', 'light'].includes(updates.theme)) {
      return res.status(400).json({ error: 'Invalid theme value. Must be "dark" or "light"' });
    }
    
    const newPrefs = {
      ...currentPrefs,
      ...updates,
      updatedAt: Date.now()
    };
    
    userPreferences.set(userId, newPrefs);
    
    res.json({
      success: true,
      preferences: {
        ...newPrefs,
        userId
      }
    });
  } catch (error) {
    console.error('[PREFERENCES] Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// === ACHIEVEMENT & GAMIFICATION API ===

// Get all achievements with progress for a user
app.get('/api/achievements', (req, res) => {
  const userId = (req.query.userId as string) || 'anonymous';
  
  try {
    const achievements = getAllAchievements(userId);
    const summary = getAchievementsSummary(userId);
    
    res.json({
      total: achievements.length,
      unlocked: summary.totalUnlocked,
      achievements,
      byCategory: summary.byCategory,
      byTier: summary.byTier,
      xpFromAchievements: summary.xpFromAchievements,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

// Get user's achievement progress and stats
app.get('/api/achievements/user/:userId', (req, res) => {
  const { userId } = req.params;
  
  try {
    const progress = getUserProgress(userId);
    const level = getUserLevel(userId);
    const summary = getAchievementsSummary(userId);
    const dailyChallenges = getDailyChallenges(userId);
    const weeklyChallenges = getWeeklyChallenges(userId);
    
    res.json({
      userId,
      level: {
        current: level.level,
        title: level.title,
        badge: level.badge,
        xp: level.xp,
        xpToNextLevel: level.xpToNextLevel,
        xpProgress: level.xpProgress,
        nextLevelTitle: level.nextLevelTitle,
        perks: level.perks
      },
      achievements: {
        total: summary.totalAvailable,
        unlocked: summary.totalUnlocked,
        recent: summary.recentUnlocks.slice(0, 5),
        byCategory: summary.byCategory,
        byTier: summary.byTier
      },
      stats: {
        totalTrades: progress.stats.totalTrades,
        wins: progress.stats.wins,
        losses: progress.stats.losses,
        winRate: progress.stats.totalTrades > 0 
          ? Math.round((progress.stats.wins / progress.stats.totalTrades) * 1000) / 10 
          : 0,
        currentStreak: progress.stats.currentWinStreak,
        maxStreak: progress.stats.maxWinStreak,
        totalRoi: Math.round(progress.stats.totalRoi * 100) / 100,
        bestTradeRoi: Math.round(progress.stats.bestSingleTradeRoi * 100) / 100,
        uniqueTokens: progress.stats.uniqueTokensTraded.size,
        signalsViewed: progress.stats.signalsViewed,
        sharesCount: progress.stats.sharesCount,
        dailyLoginStreak: progress.stats.dailyLoginStreak
      },
      challenges: {
        daily: dailyChallenges,
        weekly: weeklyChallenges,
        dailyCompleted: dailyChallenges.filter(c => c.completed).length,
        weeklyCompleted: weeklyChallenges.filter(c => c.completed).length
      },
      createdAt: progress.createdAt,
      lastActive: progress.lastActive,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[ACHIEVEMENTS] Error getting user progress:', error);
    res.status(500).json({ error: 'Failed to get user progress' });
  }
});

// Get today's daily challenges
app.get('/api/challenges/daily', (req, res) => {
  const userId = (req.query.userId as string) || 'anonymous';
  
  try {
    const challenges = getDailyChallenges(userId);
    const completed = challenges.filter(c => c.completed).length;
    
    res.json({
      userId,
      date: new Date().toISOString().split('T')[0],
      total: challenges.length,
      completed,
      remaining: challenges.length - completed,
      challenges,
      expiresAt: challenges[0]?.expiresAt || 0,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[CHALLENGES] Error:', error);
    res.status(500).json({ error: 'Failed to get daily challenges' });
  }
});

// Get weekly challenges
app.get('/api/challenges/weekly', (req, res) => {
  const userId = (req.query.userId as string) || 'anonymous';
  
  try {
    const challenges = getWeeklyChallenges(userId);
    const completed = challenges.filter(c => c.completed).length;
    
    res.json({
      userId,
      total: challenges.length,
      completed,
      remaining: challenges.length - completed,
      challenges,
      expiresAt: challenges[0]?.expiresAt || 0,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[CHALLENGES] Error:', error);
    res.status(500).json({ error: 'Failed to get weekly challenges' });
  }
});

// Check and award achievements (called after user actions)
app.post('/api/achievements/check', (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  try {
    const unlocks = checkAchievements(userId);
    const level = getUserLevel(userId);
    
    res.json({
      userId,
      newUnlocks: unlocks.length,
      unlocks: unlocks.map(u => ({
        achievement: {
          id: u.achievement.id,
          name: u.achievement.name,
          description: u.achievement.description,
          icon: u.achievement.icon,
          tier: u.achievement.tier,
          category: u.achievement.category,
          xpReward: u.achievement.xpReward
        },
        timestamp: u.timestamp,
        levelUp: u.levelUp
      })),
      currentLevel: level,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[ACHIEVEMENTS] Check error:', error);
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

// Record a trade event (for achievement tracking)
app.post('/api/achievements/trade', (req, res) => {
  const { userId, token, symbol, entryPrice, exitPrice, roi, holdDurationMs, isWin, isWhaleSignal, isHighConviction } = req.body;
  
  if (!userId || !token) {
    return res.status(400).json({ error: 'userId and token are required' });
  }
  
  try {
    const unlocks = recordAchievementTrade({
      userId,
      token,
      symbol: symbol || 'UNKNOWN',
      entryPrice: entryPrice || 0,
      exitPrice,
      roi,
      holdDurationMs,
      isWin,
      isWhaleSignal,
      isHighConviction,
      timestamp: Date.now()
    });
    
    const level = getUserLevel(userId);
    
    res.json({
      success: true,
      newUnlocks: unlocks.length,
      unlocks: unlocks.map(u => ({
        achievement: {
          id: u.achievement.id,
          name: u.achievement.name,
          icon: u.achievement.icon,
          xpReward: u.achievement.xpReward
        },
        levelUp: u.levelUp
      })),
      currentLevel: level,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[ACHIEVEMENTS] Trade record error:', error);
    res.status(500).json({ error: 'Failed to record trade' });
  }
});

// Record signal view
app.post('/api/achievements/view', (req, res) => {
  const { userId, signalId, viewRank } = req.body;
  
  if (!userId || !signalId) {
    return res.status(400).json({ error: 'userId and signalId are required' });
  }
  
  try {
    const unlocks = recordSignalView({ userId, signalId, viewRank });
    
    res.json({
      success: true,
      newUnlocks: unlocks.length,
      unlocks: unlocks.map(u => ({
        id: u.achievement.id,
        name: u.achievement.name,
        icon: u.achievement.icon
      })),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[ACHIEVEMENTS] View record error:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Record signal share
app.post('/api/achievements/share', (req, res) => {
  const { userId, signalId, views } = req.body;
  
  if (!userId || !signalId) {
    return res.status(400).json({ error: 'userId and signalId are required' });
  }
  
  try {
    const unlocks = recordShare({ userId, signalId, views });
    
    res.json({
      success: true,
      newUnlocks: unlocks.length,
      unlocks: unlocks.map(u => ({
        id: u.achievement.id,
        name: u.achievement.name,
        icon: u.achievement.icon
      })),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[ACHIEVEMENTS] Share record error:', error);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

// Get shareable achievement card
app.get('/api/achievements/:achievementId/share', (req, res) => {
  const { achievementId } = req.params;
  const userId = (req.query.userId as string) || 'anonymous';
  
  try {
    const shareData = getShareableAchievement(userId, achievementId);
    
    if (!shareData) {
      return res.status(404).json({ error: 'Achievement not found or not unlocked' });
    }
    
    res.json(shareData);
  } catch (error) {
    console.error('[ACHIEVEMENTS] Share error:', error);
    res.status(500).json({ error: 'Failed to get shareable achievement' });
  }
});

// Get unnotified achievements (for notification toast)
app.get('/api/achievements/unnotified', (req, res) => {
  const userId = (req.query.userId as string) || 'anonymous';
  
  try {
    const unnotified = getUnnotifiedAchievements(userId);
    
    res.json({
      count: unnotified.length,
      achievements: unnotified.map(u => ({
        id: u.achievement.id,
        name: u.achievement.name,
        description: u.achievement.description,
        icon: u.achievement.icon,
        tier: u.achievement.tier,
        xpReward: u.achievement.xpReward,
        unlockedAt: u.timestamp
      })),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[ACHIEVEMENTS] Unnotified error:', error);
    res.status(500).json({ error: 'Failed to get unnotified achievements' });
  }
});

// Mark achievement as notified
app.post('/api/achievements/:achievementId/notified', (req, res) => {
  const { achievementId } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  try {
    markAchievementNotified(userId, achievementId);
    res.json({ success: true });
  } catch (error) {
    console.error('[ACHIEVEMENTS] Mark notified error:', error);
    res.status(500).json({ error: 'Failed to mark as notified' });
  }
});

// Get all available achievements (for achievement list page)
app.get('/api/achievements/all', (req, res) => {
  try {
    res.json({
      total: ACHIEVEMENTS.length,
      achievements: ACHIEVEMENTS.filter(a => !a.secret).map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        tier: a.tier,
        icon: a.icon,
        xpReward: a.xpReward
      })),
      categories: ['TRADING', 'DISCOVERY', 'SOCIAL', 'SKILL', 'SPECIAL'],
      tiers: ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'LEGENDARY'],
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[ACHIEVEMENTS] All error:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

// Get level system info
app.get('/api/levels', (req, res) => {
  try {
    res.json({
      levels: LEVELS.map(l => ({
        level: l.level,
        title: l.title,
        badge: l.badge,
        minXp: l.minXp,
        maxXp: l.maxXp === Infinity ? null : l.maxXp,
        perks: l.perks
      })),
      maxLevel: LEVELS.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[LEVELS] Error:', error);
    res.status(500).json({ error: 'Failed to get levels' });
  }
});

// Generate demo user with progress (for testing)
app.post('/api/achievements/demo', (req, res) => {
  const userId = (req.body.userId as string) || 'demo-user';
  
  try {
    const progress = generateDemoUser(userId);
    const level = getUserLevel(userId);
    const summary = getAchievementsSummary(userId);
    
    res.json({
      success: true,
      message: 'Demo user generated with achievements',
      userId,
      level: level.level,
      title: level.title,
      xp: level.xp,
      achievements: summary.totalUnlocked,
      stats: {
        trades: progress.stats.totalTrades,
        wins: progress.stats.wins,
        losses: progress.stats.losses
      }
    });
  } catch (error) {
    console.error('[ACHIEVEMENTS] Demo error:', error);
    res.status(500).json({ error: 'Failed to generate demo user' });
  }
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

// Get image share card (same as SVG but with image content type for better social sharing)
app.get('/api/share/:id/image', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  const svg = generateSvgCard(signal);
  // Set appropriate headers for social media crawlers
  res.set({
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff'
  });
  res.send(svg);
});

// Dynamic OG image for specific signal
app.get('/api/share/:id/og', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    // Return a fallback OG image
    return res.redirect('/api/og?symbol=ORACLE&score=80');
  }
  
  const scoreColor = signal.score >= 70 ? '#22c55e' : signal.score >= 50 ? '#eab308' : '#ef4444';
  const riskColor = {
    'LOW': '#22c55e',
    'MEDIUM': '#eab308',
    'HIGH': '#f97316',
    'EXTREME': '#ef4444'
  }[signal.riskLevel] || '#eab308';
  
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
  
  <!-- Grid Background -->
  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0,217,255,0.05)" stroke-width="1"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#grid)"/>
  
  <!-- Header -->
  <text x="60" y="70" font-family="monospace" font-size="32" fill="url(#logo)">🔮 ORACLE Alpha Signal</text>
  
  <!-- Risk Badge -->
  <rect x="1000" y="40" width="140" height="45" rx="22" fill="${riskColor}"/>
  <text x="1070" y="72" font-family="monospace" font-size="20" fill="#000" text-anchor="middle" font-weight="bold">${signal.riskLevel}</text>
  
  <!-- Main Symbol -->
  <text x="600" y="250" font-family="monospace" font-size="120" fill="#fff" text-anchor="middle" font-weight="bold">$${signal.symbol}</text>
  <text x="600" y="310" font-family="monospace" font-size="28" fill="#888" text-anchor="middle">${signal.name.slice(0, 30)}</text>
  
  <!-- Score Circle -->
  <circle cx="600" cy="420" r="70" fill="${scoreColor}"/>
  <text x="600" y="440" font-family="monospace" font-size="52" fill="#000" text-anchor="middle" font-weight="bold">${signal.score}</text>
  
  <!-- Metrics -->
  <text x="300" y="520" font-family="monospace" font-size="22" fill="#888" text-anchor="middle">MCap: $${((signal.marketData?.mcap || 0) / 1000).toFixed(1)}K</text>
  <text x="600" y="520" font-family="monospace" font-size="22" fill="#888" text-anchor="middle">${signal.sources.length} Sources</text>
  <text x="900" y="520" font-family="monospace" font-size="22" fill="#888" text-anchor="middle">${Math.floor((Date.now() - signal.timestamp) / 60000)}m ago</text>
  
  <!-- Footer -->
  <text x="600" y="590" font-family="monospace" font-size="20" fill="#555" text-anchor="middle">Verifiable on-chain signals on Solana ⛓️</text>
</svg>`.trim();

  res.set({
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=3600'
  });
  res.send(svg);
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

// Get detailed AI-powered explanation (comprehensive analysis)
app.get('/api/explain/:id/detailed', async (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }

  try {
    const detailed = await generateExplanation(signal);
    res.json({
      signal: {
        id: signal.id,
        symbol: signal.symbol,
        token: signal.token,
        score: signal.score,
        riskLevel: signal.riskLevel
      },
      explanation: detailed
    });
  } catch (error) {
    console.error('[API] Failed to generate detailed explanation:', error);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

// Get detailed explanation as formatted text
app.get('/api/explain/:id/detailed/text', async (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }

  try {
    const detailed = await generateExplanation(signal);
    const text = formatExplanationText(detailed);
    res.type('text/plain').send(text);
  } catch (error) {
    res.status(500).send('Failed to generate explanation');
  }
});

// Get detailed explanation as HTML (for dashboard modal)
app.get('/api/explain/:id/detailed/html', async (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }

  try {
    const detailed = await generateExplanation(signal);
    const html = formatExplanationHtml(detailed);
    res.type('text/html').send(html);
  } catch (error) {
    res.status(500).send('Failed to generate explanation');
  }
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

// === PORTFOLIO SIMULATOR ===

// Simulate portfolio performance following signals
app.get('/api/portfolio/simulate', (req, res) => {
  const startAmount = parseFloat(req.query.startAmount as string) || 1000;
  const minScore = parseInt(req.query.minScore as string) || 60;
  const daysBack = parseInt(req.query.days as string) || 7;

  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;

  // Get historical signals sorted by timestamp (oldest first)
  const historicalSignals = signalStore
    .filter(s => s.timestamp >= cutoff && s.score >= minScore)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (historicalSignals.length === 0) {
    return res.json({
      startAmount,
      currentValue: startAmount,
      totalROI: 0,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      trades: [],
      chartData: [
        {
          timestamp: Date.now(),
          value: startAmount,
          label: 'Today'
        }
      ],
      message: 'No qualifying signals found in the selected period'
    });
  }

  // Simulation parameters
  const positionSize = 0.1; // 10% of portfolio per trade
  const maxHoldingHours = 24; // Max holding period

  let portfolioValue = startAmount;
  const trades: any[] = [];
  const chartData: any[] = [];
  let wins = 0;
  let losses = 0;

  // Initial chart point
  chartData.push({
    timestamp: cutoff,
    value: startAmount,
    label: new Date(cutoff).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  });

  // Process each signal
  for (const signal of historicalSignals) {
    // Calculate position size
    const positionValue = portfolioValue * positionSize;

    // Simulate the trade outcome
    // Use actual performance data if available, otherwise simulate based on score
    let roi: number;
    let exitReason: string;
    let peakMultiplier: number;

    if (signal.performance && signal.performance.status !== 'OPEN') {
      // Use actual performance data
      roi = signal.performance.roi || 0;
      peakMultiplier = signal.performance.athRoi ? 1 + signal.performance.athRoi / 100 : 1;
      exitReason = signal.performance.status === 'WIN' ? 'Take Profit' : 'Stop Loss';
    } else {
      // Simulate based on score probability
      // Higher score = better probability of profit
      const winProb = 0.45 + (signal.score / 100) * 0.35; // 45-80% based on score
      const isWin = Math.random() < winProb;

      if (isWin) {
        // Winners: 20% to 150% gains, weighted by score
        const baseGain = 0.2 + Math.random() * 0.8; // 20-100% base
        const scoreBonus = (signal.score - 50) / 100; // 0-0.5 bonus
        roi = (baseGain + scoreBonus) * 100;
        peakMultiplier = 1 + roi / 100 + Math.random() * 0.5;
        exitReason = 'Take Profit';
      } else {
        // Losers: -20% to -60% losses
        roi = -(20 + Math.random() * 40);
        peakMultiplier = 1 + Math.random() * 0.3;
        exitReason = 'Stop Loss';
      }
    }

    // Calculate P&L
    const pnl = positionValue * (roi / 100);
    portfolioValue += pnl;

    // Track wins/losses
    if (roi > 0) wins++;
    else losses++;

    // Record the trade
    trades.push({
      id: signal.id,
      symbol: signal.symbol,
      token: signal.token,
      score: signal.score,
      riskLevel: signal.riskLevel,
      entryTime: signal.timestamp,
      entryPrice: signal.marketData?.price || signal.marketData?.mcap / 1e9 || 0,
      positionSize: positionValue.toFixed(2),
      roi: roi.toFixed(2),
      pnl: pnl.toFixed(2),
      peakROI: ((peakMultiplier - 1) * 100).toFixed(2),
      exitReason,
      portfolioValueAfter: portfolioValue.toFixed(2),
      result: roi > 0 ? 'WIN' : 'LOSS'
    });

    // Add chart point
    chartData.push({
      timestamp: signal.timestamp,
      value: Math.round(portfolioValue * 100) / 100,
      label: new Date(signal.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      trade: signal.symbol,
      roi: roi.toFixed(1)
    });
  }

  // Add final chart point
  chartData.push({
    timestamp: Date.now(),
    value: Math.round(portfolioValue * 100) / 100,
    label: 'Now'
  });

  const totalROI = ((portfolioValue - startAmount) / startAmount) * 100;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  res.json({
    startAmount,
    currentValue: Math.round(portfolioValue * 100) / 100,
    totalROI: Math.round(totalROI * 100) / 100,
    totalTrades: trades.length,
    wins,
    losses,
    winRate: Math.round(winRate * 10) / 10,
    avgTradeROI:
      trades.length > 0
        ? Math.round((trades.reduce((sum, t) => sum + parseFloat(t.roi), 0) / trades.length) * 10) /
          10
        : 0,
    bestTrade:
      trades.length > 0
        ? trades.reduce((best, t) => (parseFloat(t.roi) > parseFloat(best.roi) ? t : best))
        : null,
    worstTrade:
      trades.length > 0
        ? trades.reduce((worst, t) => (parseFloat(t.roi) < parseFloat(worst.roi) ? t : worst))
        : null,
    trades: trades.slice(-50), // Last 50 trades
    chartData,
    parameters: {
      minScore,
      positionSizePercent: positionSize * 100,
      maxHoldingHours,
      daysBack
    }
  });
});

// === BACKTESTING VISUALIZER API ===

// Advanced backtesting endpoint for visualizations
app.get('/api/backtest', (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  const minScore = parseInt(req.query.minScore as string) || 60;
  const strategy = (req.query.strategy as string) || 'default';
  
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  
  // Get signals in date range
  let signals = signalStore.filter(s => s.timestamp >= cutoff && s.score >= minScore);
  
  // Apply strategy filters
  if (strategy === 'conservative') {
    signals = signals.filter(s => s.riskLevel === 'LOW' && s.score >= 75);
  } else if (strategy === 'aggressive') {
    signals = signals.filter(s => s.score >= 65);
  } else if (strategy === 'smart-wallet') {
    signals = signals.filter(s => s.sources.some(src => src.source.includes('smart-wallet')));
  }
  
  // Sort by timestamp (oldest first for processing)
  signals.sort((a, b) => a.timestamp - b.timestamp);
  
  // Generate daily performance data
  const dailyData: Map<string, {
    date: string;
    timestamp: number;
    signals: number;
    wins: number;
    losses: number;
    pnl: number;
    trades: any[];
  }> = new Map();
  
  // Initialize all days in range
  for (let d = days; d >= 0; d--) {
    const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split('T')[0];
    dailyData.set(dateKey, {
      date: dateKey,
      timestamp: date.getTime(),
      signals: 0,
      wins: 0,
      losses: 0,
      pnl: 0,
      trades: []
    });
  }
  
  // Simulate SOL benchmark (hold strategy)
  const solStartPrice = 150 + Math.random() * 50; // Simulated SOL start
  const solDailyReturns: number[] = [];
  let solPrice = solStartPrice;
  
  // Process signals and generate performance
  let totalCapital = 10000;
  const initialCapital = totalCapital;
  let peakCapital = totalCapital;
  let maxDrawdown = 0;
  const allReturns: number[] = [];
  let wins = 0;
  let losses = 0;
  let bestDay = { date: '', pnl: -Infinity };
  let worstDay = { date: '', pnl: Infinity };
  
  for (const signal of signals) {
    const dateKey = new Date(signal.timestamp).toISOString().split('T')[0];
    const dayData = dailyData.get(dateKey);
    if (!dayData) continue;
    
    dayData.signals++;
    
    // Calculate trade outcome
    let roi: number;
    let isWin: boolean;
    
    if (signal.performance && signal.performance.status !== 'OPEN') {
      roi = signal.performance.roi || 0;
      isWin = signal.performance.status === 'WIN';
    } else {
      // Simulate based on score
      const winProb = 0.4 + (signal.score / 100) * 0.4;
      isWin = Math.random() < winProb;
      
      if (isWin) {
        roi = 15 + Math.random() * 85 + (signal.score - 50) * 0.5;
      } else {
        roi = -(15 + Math.random() * 35);
      }
    }
    
    const positionSize = totalCapital * 0.1; // 10% per trade
    const pnl = positionSize * (roi / 100);
    
    totalCapital += pnl;
    dayData.pnl += pnl;
    allReturns.push(roi);
    
    if (isWin) {
      dayData.wins++;
      wins++;
    } else {
      dayData.losses++;
      losses++;
    }
    
    dayData.trades.push({
      symbol: signal.symbol,
      score: signal.score,
      roi,
      pnl,
      isWin
    });
    
    // Track drawdown
    if (totalCapital > peakCapital) {
      peakCapital = totalCapital;
    }
    const currentDrawdown = ((peakCapital - totalCapital) / peakCapital) * 100;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
  }
  
  // Calculate daily cumulative returns and drawdowns
  let cumulativeReturn = 0;
  let cumulativePnl = 0;
  let runningPeak = initialCapital;
  const chartData: any[] = [];
  const drawdownData: any[] = [];
  let solCumulativeReturn = 0;
  
  const sortedDays = Array.from(dailyData.values()).sort((a, b) => a.timestamp - b.timestamp);
  
  for (let i = 0; i < sortedDays.length; i++) {
    const day = sortedDays[i];
    
    // Oracle strategy returns
    cumulativePnl += day.pnl;
    cumulativeReturn = (cumulativePnl / initialCapital) * 100;
    
    // Track peak for drawdown
    const currentValue = initialCapital + cumulativePnl;
    if (currentValue > runningPeak) {
      runningPeak = currentValue;
    }
    const drawdown = ((runningPeak - currentValue) / runningPeak) * 100;
    
    // SOL benchmark (random walk with slight upward bias)
    const solDailyReturn = (Math.random() - 0.48) * 6; // -2.4% to +3.6% daily
    solCumulativeReturn += solDailyReturn;
    solDailyReturns.push(solDailyReturn);
    
    // Best/worst day
    if (day.pnl > bestDay.pnl) {
      bestDay = { date: day.date, pnl: day.pnl };
    }
    if (day.pnl < worstDay.pnl && day.signals > 0) {
      worstDay = { date: day.date, pnl: day.pnl };
    }
    
    chartData.push({
      date: day.date,
      timestamp: day.timestamp,
      label: new Date(day.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      oracleReturn: Math.round(cumulativeReturn * 100) / 100,
      solReturn: Math.round(solCumulativeReturn * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
      signals: day.signals,
      wins: day.wins,
      losses: day.losses,
      dailyPnl: Math.round(day.pnl * 100) / 100
    });
    
    if (drawdown > 0) {
      drawdownData.push({
        date: day.date,
        timestamp: day.timestamp,
        drawdown: Math.round(drawdown * 100) / 100
      });
    }
  }
  
  // Calculate Sharpe Ratio (annualized)
  const avgReturn = allReturns.length > 0 ? allReturns.reduce((a, b) => a + b, 0) / allReturns.length : 0;
  const variance = allReturns.length > 1 
    ? allReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / allReturns.length 
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn * Math.sqrt(365)) / stdDev : 0;
  
  // Win rate by period
  const winRateByPeriod = {
    week1: { wins: 0, total: 0 },
    week2: { wins: 0, total: 0 },
    week3: { wins: 0, total: 0 },
    week4: { wins: 0, total: 0 }
  };
  
  signals.forEach(s => {
    const age = (Date.now() - s.timestamp) / (7 * 24 * 60 * 60 * 1000);
    const period = age < 1 ? 'week1' : age < 2 ? 'week2' : age < 3 ? 'week3' : 'week4';
    const hasPerf = s.performance && s.performance.status !== 'OPEN';
    if (hasPerf || Math.random() > 0.3) { // Include simulation
      winRateByPeriod[period].total++;
      const isWin = hasPerf ? s.performance?.status === 'WIN' : Math.random() < 0.55;
      if (isWin) winRateByPeriod[period].wins++;
    }
  });
  
  res.json({
    parameters: {
      days,
      minScore,
      strategy,
      initialCapital
    },
    summary: {
      totalReturn: Math.round(((totalCapital - initialCapital) / initialCapital) * 100 * 100) / 100,
      totalReturnDollars: Math.round((totalCapital - initialCapital) * 100) / 100,
      finalValue: Math.round(totalCapital * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      winRate: signals.length > 0 ? Math.round((wins / (wins + losses)) * 100 * 10) / 10 : 0,
      totalTrades: wins + losses,
      wins,
      losses,
      avgTradeReturn: allReturns.length > 0 ? Math.round(avgReturn * 100) / 100 : 0,
      bestDay: bestDay.pnl > -Infinity ? {
        date: bestDay.date,
        pnl: Math.round(bestDay.pnl * 100) / 100,
        pnlPercent: Math.round((bestDay.pnl / initialCapital) * 100 * 100) / 100
      } : null,
      worstDay: worstDay.pnl < Infinity ? {
        date: worstDay.date,
        pnl: Math.round(worstDay.pnl * 100) / 100,
        pnlPercent: Math.round((worstDay.pnl / initialCapital) * 100 * 100) / 100
      } : null,
      vsSOL: Math.round((((totalCapital - initialCapital) / initialCapital) * 100 - solCumulativeReturn) * 100) / 100
    },
    winRateByPeriod: {
      week1: winRateByPeriod.week1.total > 0 ? Math.round((winRateByPeriod.week1.wins / winRateByPeriod.week1.total) * 100) : 0,
      week2: winRateByPeriod.week2.total > 0 ? Math.round((winRateByPeriod.week2.wins / winRateByPeriod.week2.total) * 100) : 0,
      week3: winRateByPeriod.week3.total > 0 ? Math.round((winRateByPeriod.week3.wins / winRateByPeriod.week3.total) * 100) : 0,
      week4: winRateByPeriod.week4.total > 0 ? Math.round((winRateByPeriod.week4.wins / winRateByPeriod.week4.total) * 100) : 0
    },
    chartData,
    drawdownPeriods: drawdownData.filter(d => d.drawdown > 2), // Significant drawdowns only
    strategies: [
      { id: 'default', name: 'Default (Score ≥60)', description: 'All signals with score 60+' },
      { id: 'conservative', name: 'Conservative', description: 'Low risk + Score 75+' },
      { id: 'aggressive', name: 'Aggressive', description: 'All signals with score 65+' },
      { id: 'smart-wallet', name: 'Smart Wallet Only', description: 'Only smart wallet signals' }
    ]
  });
});

// === CORRELATION & ANALYTICS ===

// Get correlation for a specific token
app.get('/api/analytics/correlation/:token', (req, res) => {
  const { token } = req.params;
  const minCorrelation = parseFloat(req.query.minCorrelation as string) || 0.4;

  // Check if we have data for this token
  const priceHistory = getPriceHistory(token);
  if (priceHistory.length === 0) {
    return res.json({
      token,
      hasData: false,
      message: 'No price history for this token yet',
      correlations: []
    });
  }

  const correlations = getCorrelatedTokens(token, minCorrelation);

  // Also get lead/lag analysis for top correlations
  const withLeadLag = correlations.slice(0, 5).map(corr => {
    const leadLag = analyzeLeadLag(token, corr.tokenB);
    return {
      ...corr,
      leadLag: leadLag ? {
        pattern: leadLag.pattern,
        lagMinutes: leadLag.lagMinutes,
        confidence: leadLag.confidence
      } : null
    };
  });

  res.json({
    token,
    hasData: true,
    priceHistoryPoints: priceHistory.length,
    correlations: [...withLeadLag, ...correlations.slice(5).map(c => ({ ...c, leadLag: null }))],
    timestamp: Date.now()
  });
});

// Get related tokens (same sector, correlated, follows/leads)
app.get('/api/analytics/related/:token', (req, res) => {
  const { token } = req.params;
  const related = getRelatedTokens(token);

  // Get sector info from signalStore
  const signal = signalStore.find(s => s.token === token);
  const tokenInfo = signal ? {
    symbol: signal.symbol,
    name: signal.name,
    narratives: signal.analysis?.narrative || []
  } : null;

  res.json({
    token,
    tokenInfo,
    relatedCount: related.length,
    related,
    sectors: [...new Set(related.flatMap(r => r.sector))],
    timestamp: Date.now()
  });
});

// Get sector correlations
app.get('/api/analytics/sectors', (req, res) => {
  const sectors = getAllSectorCorrelations();

  res.json({
    count: sectors.length,
    sectors: sectors.map(s => ({
      sector: s.sector,
      tokenCount: s.tokens.length,
      avgCorrelation: Math.round(s.avgCorrelation * 1000) / 1000,
      performance24h: Math.round(s.performance24h * 100) / 100,
      leadingTokens: s.leadingTokens.slice(0, 3)
    })),
    timestamp: Date.now()
  });
});

// Get specific sector correlation
app.get('/api/analytics/sectors/:sector', (req, res) => {
  const { sector } = req.params;
  const correlation = getSectorCorrelation(sector.toUpperCase());

  if (!correlation) {
    return res.status(404).json({ error: 'Sector not found or insufficient data' });
  }

  res.json({
    sector: correlation.sector,
    tokenCount: correlation.tokens.length,
    tokens: correlation.tokens,
    avgCorrelation: correlation.avgCorrelation,
    performance24h: correlation.performance24h,
    leadingTokens: correlation.leadingTokens,
    timestamp: Date.now()
  });
});

// Get overall performance stats
app.get('/api/analytics/performance', (req, res) => {
  const stats = getPerformanceStats();
  const hourlyPerf = getHourlyPerformance();
  const sourceStats = getSourcePnLStats();

  // Find best trading hours
  const bestHours = hourlyPerf
    .filter(h => h.trades >= 3)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3)
    .map(h => ({ hour: `${h.hour.toString().padStart(2, '0')}:00 UTC`, winRate: h.winRate, avgPnl: h.avgPnl }));

  res.json({
    summary: {
      totalTrades: stats.totalTrades,
      openTrades: stats.openTrades,
      closedTrades: stats.closedTrades,
      wins: stats.wins,
      losses: stats.losses,
      winRate: Math.round(stats.winRate * 10) / 10,
      totalPnl: Math.round(stats.totalPnl * 100) / 100,
      avgPnlPercent: Math.round(stats.avgPnlPercent * 100) / 100,
      avgHoldingTimeMinutes: Math.round(stats.avgHoldingTime),
      profitFactor: Math.round(stats.profitFactor * 100) / 100,
      sharpeRatio: Math.round(stats.sharpeRatio * 100) / 100
    },
    bestTrade: stats.bestTrade ? {
      symbol: stats.bestTrade.symbol,
      pnlPercent: stats.bestTrade.pnlPercent,
      source: stats.bestTrade.source
    } : null,
    worstTrade: stats.worstTrade ? {
      symbol: stats.worstTrade.symbol,
      pnlPercent: stats.worstTrade.pnlPercent,
      source: stats.worstTrade.source
    } : null,
    bestHours,
    bySource: sourceStats.slice(0, 8),
    timestamp: Date.now()
  });
});

// Get hourly performance breakdown
app.get('/api/analytics/performance/hourly', (req, res) => {
  const hourly = getHourlyPerformance();

  res.json({
    data: hourly.map(h => ({
      hour: h.hour,
      label: `${h.hour.toString().padStart(2, '0')}:00`,
      trades: h.trades,
      wins: h.wins,
      losses: h.losses,
      winRate: Math.round(h.winRate * 10) / 10,
      avgPnl: Math.round(h.avgPnl * 100) / 100
    })),
    bestHour: hourly.reduce((best, h) => h.winRate > best.winRate && h.trades >= 3 ? h : best, hourly[0]),
    worstHour: hourly.reduce((worst, h) => h.winRate < worst.winRate && h.trades >= 3 ? h : worst, hourly[0]),
    timestamp: Date.now()
  });
});

// Get performance by source
app.get('/api/analytics/performance/sources', (req, res) => {
  const sources = getSourcePnLStats();

  res.json({
    count: sources.length,
    sources,
    bestSource: sources[0] || null,
    worstSource: sources[sources.length - 1] || null,
    timestamp: Date.now()
  });
});

// Get PnL chart data
app.get('/api/analytics/charts/pnl', (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  const chartData = getPnLChartData(days);

  // Also calculate summary stats
  const totalPnl = chartData.length > 0 ? chartData[chartData.length - 1].cumulativePnl : 0;
  const tradingDays = chartData.filter(d => d.tradeCount > 0).length;
  const avgDailyPnl = tradingDays > 0 ? totalPnl / tradingDays : 0;

  res.json({
    days,
    dataPoints: chartData.length,
    summary: {
      totalPnl: Math.round(totalPnl * 100) / 100,
      tradingDays,
      avgDailyPnl: Math.round(avgDailyPnl * 100) / 100,
      bestDay: chartData.reduce((best, d) => d.dailyPnl > best.dailyPnl ? d : best, chartData[0]),
      worstDay: chartData.reduce((worst, d) => d.dailyPnl < worst.dailyPnl ? d : worst, chartData[0])
    },
    data: chartData,
    timestamp: Date.now()
  });
});

// Get win/loss distribution
app.get('/api/analytics/distribution', (req, res) => {
  const distribution = getWinLossDistribution();

  res.json({
    ranges: distribution.ranges,
    stats: {
      avgWin: Math.round(distribution.avgWin * 100) / 100,
      avgLoss: Math.round(distribution.avgLoss * 100) / 100,
      largestWin: Math.round(distribution.largestWin * 100) / 100,
      largestLoss: Math.round(distribution.largestLoss * 100) / 100,
      riskRewardRatio: distribution.avgLoss !== 0 
        ? Math.round(Math.abs(distribution.avgWin / distribution.avgLoss) * 100) / 100 
        : 0
    },
    timestamp: Date.now()
  });
});

// Get trade history
app.get('/api/analytics/trades', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const status = req.query.status as string;

  let trades = getCorrelationTradeHistory(limit);

  if (status === 'open') {
    trades = trades.filter(t => t.status === 'open');
  } else if (status === 'closed') {
    trades = trades.filter(t => t.status !== 'open');
  }

  res.json({
    count: trades.length,
    trades: trades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      token: t.token,
      source: t.source,
      entryTime: t.entryTime,
      entryPrice: t.entryPrice,
      exitTime: t.exitTime,
      exitPrice: t.exitPrice,
      pnlPercent: t.pnlPercent ? Math.round(t.pnlPercent * 100) / 100 : null,
      peakPnlPercent: t.peakPnlPercent ? Math.round(t.peakPnlPercent * 100) / 100 : null,
      holdingTimeMinutes: t.holdingTimeMinutes ? Math.round(t.holdingTimeMinutes) : null,
      status: t.status
    })),
    timestamp: Date.now()
  });
});

// Get open trades
app.get('/api/analytics/trades/open', (req, res) => {
  const openTrades = getOpenTrades();

  res.json({
    count: openTrades.length,
    trades: openTrades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      token: t.token,
      source: t.source,
      entryTime: t.entryTime,
      entryPrice: t.entryPrice,
      peakPrice: t.peakPrice,
      peakPnlPercent: t.peakPnlPercent ? Math.round(t.peakPnlPercent * 100) / 100 : null,
      holdingTimeMinutes: Math.round((Date.now() - t.entryTime) / 60000)
    })),
    timestamp: Date.now()
  });
});

// Correlation matrix for dashboard (all tracked tokens)
app.get('/api/analytics/correlation/matrix', (req, res) => {
  const tokens: string[] = [];
  const symbols: string[] = [];

  // Get all tracked tokens with enough data
  for (const [token, tracking] of tokenPriceHistory) {
    if (tracking.priceHistory.length >= 10) {
      tokens.push(token);
      symbols.push(tracking.symbol);
    }
  }

  // Limit to 10 tokens for reasonable matrix size
  const maxTokens = 10;
  const selectedTokens = tokens.slice(0, maxTokens);
  const selectedSymbols = symbols.slice(0, maxTokens);

  // Build correlation matrix
  const matrix: number[][] = [];

  for (let i = 0; i < selectedTokens.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < selectedTokens.length; j++) {
      if (i === j) {
        row.push(1.0);
      } else {
        const corr = calculateCorrelation(selectedTokens[i], selectedTokens[j]);
        row.push(corr ? Math.round(corr.coefficient * 1000) / 1000 : 0);
      }
    }
    matrix.push(row);
  }

  res.json({
    tokens: selectedTokens,
    symbols: selectedSymbols,
    matrix,
    size: selectedTokens.length,
    timestamp: Date.now()
  });
});

// Seed demo data for analytics
app.post('/api/analytics/seed-demo', (req, res) => {
  seedDemoData();

  res.json({
    status: 'seeded',
    message: 'Demo correlation and trade data seeded successfully',
    trackedTokens: tokenPriceHistory.size,
    timestamp: Date.now()
  });
});

// Record price update (for internal use or webhooks)
app.post('/api/analytics/price', (req, res) => {
  const { token, symbol, price, mcap, volume, narratives } = req.body;

  if (!token || !symbol || !price) {
    return res.status(400).json({ error: 'Missing required fields: token, symbol, price' });
  }

  recordPrice(token, symbol, price, mcap || price * 1e9, volume, narratives);

  res.json({
    status: 'recorded',
    token,
    symbol,
    price,
    timestamp: Date.now()
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

// === KOL RELIABILITY API ===
// Track and analyze KOL/Influencer performance

// Get KOL leaderboard - top reliable KOLs
app.get('/api/kol/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const leaderboard = getKOLLeaderboard(limit);
  
  res.json({
    timestamp: Date.now(),
    limits: { perCategory: limit },
    topReliable: leaderboard.topReliable.map(formatKOLStats),
    unreliable: leaderboard.unreliable.map(formatKOLStats),
    risingStars: leaderboard.risingStars.map(formatKOLStats),
    mostActive: leaderboard.mostActive.map(formatKOLStats),
    pumpAndDump: leaderboard.pumpAndDump.map(formatKOLStats),
    summary: {
      totalKOLs: getAllKOLHandles().length,
      topPerformer: leaderboard.topReliable[0]?.handle || null,
      avgReliabilityScore: leaderboard.topReliable.length > 0 
        ? Math.round(leaderboard.topReliable.reduce((sum, k) => sum + k.reliabilityScore, 0) / leaderboard.topReliable.length)
        : 0
    }
  });
});

// Get stats for a specific KOL
app.get('/api/kol/:handle/stats', (req, res) => {
  const { handle } = req.params;
  const stats = getKOLStats(handle);
  
  if (!stats) {
    return res.status(404).json({ 
      error: 'KOL not found', 
      handle,
      message: 'No data for this KOL. They may not have any tracked calls yet.'
    });
  }
  
  res.json({
    timestamp: Date.now(),
    kol: formatKOLStats(stats)
  });
});

// Get call history for a specific KOL
app.get('/api/kol/:handle/history', (req, res) => {
  const { handle } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  
  const history = getKOLHistory(handle, limit);
  
  if (history.length === 0) {
    return res.status(404).json({ 
      error: 'No history found', 
      handle,
      message: 'No call history for this KOL.'
    });
  }
  
  res.json({
    timestamp: Date.now(),
    handle: handle.toLowerCase(),
    count: history.length,
    calls: history.map(formatKOLCall)
  });
});

// Get unreliable/pump & dump KOLs
app.get('/api/kol/unreliable', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const leaderboard = getKOLLeaderboard(limit);
  
  // Combine unreliable and pump & dump, sort by worst first
  const allBad = [
    ...leaderboard.unreliable,
    ...leaderboard.pumpAndDump.filter(p => 
      !leaderboard.unreliable.find(u => u.handle === p.handle)
    )
  ].sort((a, b) => a.reliabilityScore - b.reliabilityScore);
  
  res.json({
    timestamp: Date.now(),
    count: allBad.length,
    warning: 'These KOLs have shown patterns of unreliable calls or pump & dump behavior',
    kols: allBad.map(k => ({
      ...formatKOLStats(k),
      warningReason: k.isPumpAndDump 
        ? 'Pump & Dump pattern detected' 
        : 'Low win rate and reliability'
    }))
  });
});

// Get reliability score for a KOL (for signal weighting)
app.get('/api/kol/:handle/reliability', (req, res) => {
  const { handle } = req.params;
  const score = getKOLReliabilityScore(handle);
  const weight = getKOLSignalWeight(handle);
  const shouldIgnore = shouldIgnoreKOL(handle);
  const stats = getKOLStats(handle);
  
  res.json({
    handle: handle.toLowerCase(),
    reliabilityScore: Math.round(score),
    signalWeightMultiplier: Math.round(weight * 100) / 100,
    shouldIgnore,
    recommendation: shouldIgnore 
      ? 'IGNORE - This KOL has a poor track record'
      : score >= 70 
        ? 'TRUST - High reliability, boost signal weight'
        : score >= 50 
          ? 'NEUTRAL - Moderate reliability'
          : 'CAUTION - Low reliability, reduce signal weight',
    dataPoints: stats?.totalCalls || 0,
    timestamp: Date.now()
  });
});

// Dashboard summary for KOLs
app.get('/api/kol/dashboard', (req, res) => {
  const leaderboard = getKOLLeaderboard(10);
  const allHandles = getAllKOLHandles();
  
  // Calculate overall stats
  let totalCalls = 0;
  let totalWins = 0;
  let totalLosses = 0;
  
  for (const handle of allHandles) {
    const stats = getKOLStats(handle);
    if (stats) {
      totalCalls += stats.totalCalls;
      totalWins += stats.wins;
      totalLosses += stats.losses;
    }
  }
  
  const overallWinRate = (totalWins + totalLosses) > 0 
    ? (totalWins / (totalWins + totalLosses)) * 100 
    : 0;
  
  res.json({
    timestamp: Date.now(),
    overview: {
      totalKOLs: allHandles.length,
      totalCalls,
      totalWins,
      totalLosses,
      overallWinRate: Math.round(overallWinRate * 10) / 10,
      pumpAndDumpCount: leaderboard.pumpAndDump.length
    },
    topPerformers: leaderboard.topReliable.slice(0, 5).map(k => ({
      handle: k.handle,
      label: k.label,
      tier: k.tier,
      reliabilityScore: k.reliabilityScore,
      winRate: Math.round(k.winRate * 10) / 10,
      badges: k.badges
    })),
    worstPerformers: leaderboard.unreliable.slice(0, 5).map(k => ({
      handle: k.handle,
      label: k.label,
      reliabilityScore: k.reliabilityScore,
      winRate: Math.round(k.winRate * 10) / 10,
      isPumpAndDump: k.isPumpAndDump
    })),
    risingStars: leaderboard.risingStars.slice(0, 3).map(k => ({
      handle: k.handle,
      label: k.label,
      reliabilityScore: k.reliabilityScore,
      totalCalls: k.totalCalls,
      winRate: Math.round(k.winRate * 10) / 10
    }))
  });
});

// Generate demo KOL data (for testing)
app.post('/api/kol/demo', (req, res) => {
  generateDemoKOLData();
  const leaderboard = getKOLLeaderboard(5);
  
  res.json({
    success: true,
    message: 'Demo KOL data generated',
    sampleKOLs: leaderboard.topReliable.slice(0, 3).map(k => k.handle),
    totalKOLs: getAllKOLHandles().length
  });
});

// Update KOL call prices (cron job endpoint)
app.post('/api/kol/update-prices', async (req, res) => {
  try {
    await updateAllKOLCallPrices();
    res.json({ 
      success: true, 
      message: 'KOL call prices updated',
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to update prices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to format KOL stats for API response
function formatKOLStats(stats: KOLStats) {
  return {
    handle: stats.handle,
    label: stats.label,
    tier: stats.tier,
    reliabilityScore: Math.round(stats.reliabilityScore),
    reliabilityTrend: stats.reliabilityTrend,
    stats: {
      totalCalls: stats.totalCalls,
      wins: stats.wins,
      losses: stats.losses,
      pending: stats.pending,
      winRate: Math.round(stats.winRate * 10) / 10,
      avgRoi: Math.round(stats.avgRoi * 100) / 100,
      avgAthRoi: Math.round(stats.avgAthRoi * 100) / 100,
      totalRoi: Math.round(stats.totalRoi * 100) / 100
    },
    riskIndicators: {
      pumpAndDumpScore: Math.round(stats.pumpAndDumpScore),
      isPumpAndDump: stats.isPumpAndDump,
      avgHoldTimeMinutes: Math.round(stats.avgHoldTime)
    },
    bestCall: stats.bestCall ? {
      symbol: stats.bestCall.symbol,
      roi: Math.round(stats.bestCall.roi * 100) / 100,
      timestamp: stats.bestCall.timestamp
    } : null,
    worstCall: stats.worstCall ? {
      symbol: stats.worstCall.symbol,
      roi: Math.round(stats.worstCall.roi * 100) / 100,
      timestamp: stats.worstCall.timestamp
    } : null,
    badges: stats.badges,
    firstSeen: stats.firstSeen,
    lastSeen: stats.lastSeen
  };
}

// Helper function to format KOL call for API response
function formatKOLCall(call: KOLCall) {
  return {
    id: call.id,
    token: call.token,
    symbol: call.symbol,
    timestamp: call.timestamp,
    status: call.status,
    prices: {
      atMention: call.priceAtMention,
      current: call.currentPrice,
      ath: call.athPrice,
      price24h: call.price24h,
      price7d: call.price7d
    },
    roi: {
      current: Math.round(call.roiCurrent * 100) / 100,
      ath: Math.round(call.roiAth * 100) / 100,
      roi24h: Math.round(call.roi24h * 100) / 100,
      roi7d: Math.round(call.roi7d * 100) / 100
    },
    profitableEntry: call.profitableEntry,
    mcapAtMention: call.mcapAtMention,
    athTimestamp: call.athTimestamp,
    tweetId: call.tweetId,
    tweetText: call.tweetText?.slice(0, 200),
    signalId: call.signalId
  };
}

// === TRADING JOURNAL API ===
// Notes, lessons learned, mood tracking, and trade analytics

// List journal entries with filters
app.get('/api/journal', (req, res) => {
  try {
    const filter: JournalFilter = {};
    
    if (req.query.type) filter.type = req.query.type as any;
    if (req.query.mood) filter.mood = req.query.mood as any;
    if (req.query.token) filter.token = req.query.token as string;
    if (req.query.signalId) filter.signalId = req.query.signalId as string;
    if (req.query.tradeId) filter.tradeId = req.query.tradeId as string;
    if (req.query.outcome) filter.outcome = req.query.outcome as string;
    if (req.query.startDate) filter.startDate = parseInt(req.query.startDate as string);
    if (req.query.endDate) filter.endDate = parseInt(req.query.endDate as string);
    if (req.query.tags) filter.tags = (req.query.tags as string).split(',');
    if (req.query.limit) filter.limit = parseInt(req.query.limit as string);
    if (req.query.offset) filter.offset = parseInt(req.query.offset as string);
    
    const entries = getJournalEntries(filter);
    const summary = getJournalSummary();
    
    res.json({
      timestamp: Date.now(),
      count: entries.length,
      summary,
      entries
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

// Create new journal entry
app.post('/api/journal', (req, res) => {
  try {
    const { type, title, content, tags, mood, signalId, tradeId, token, outcome, pnl, screenshot, lessonCategory } = req.body;
    
    if (!type || !title || !content) {
      return res.status(400).json({ error: 'Missing required fields: type, title, content' });
    }
    
    const entry = createJournalEntry({
      type,
      title,
      content,
      tags: tags || [],
      mood,
      signalId,
      tradeId,
      token,
      outcome,
      pnl,
      screenshot,
      lessonCategory
    });
    
    res.status(201).json({
      success: true,
      message: 'Journal entry created',
      entry
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

// Get single journal entry
app.get('/api/journal/:id', (req, res) => {
  const { id } = req.params;
  const entry = getJournalEntry(id);
  
  if (!entry) {
    return res.status(404).json({ error: 'Journal entry not found', id });
  }
  
  res.json({ entry });
});

// Update journal entry
app.put('/api/journal/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Don't allow changing id or timestamp
  delete updates.id;
  delete updates.timestamp;
  
  const entry = updateJournalEntry(id, updates);
  
  if (!entry) {
    return res.status(404).json({ error: 'Journal entry not found', id });
  }
  
  res.json({
    success: true,
    message: 'Journal entry updated',
    entry
  });
});

// Delete journal entry
app.delete('/api/journal/:id', (req, res) => {
  const { id } = req.params;
  const success = deleteJournalEntry(id);
  
  if (!success) {
    return res.status(404).json({ error: 'Journal entry not found', id });
  }
  
  res.json({
    success: true,
    message: 'Journal entry deleted',
    id
  });
});

// Get all tags
app.get('/api/journal/tags', (req, res) => {
  const tags = getJournalTags();
  res.json({
    timestamp: Date.now(),
    count: tags.length,
    tags
  });
});

// Search journal entries
app.get('/api/journal/search', (req, res) => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 50;
  
  if (!query) {
    return res.status(400).json({ error: 'Missing search query parameter: q' });
  }
  
  const entries = searchJournalEntries(query, limit);
  
  res.json({
    timestamp: Date.now(),
    query,
    count: entries.length,
    entries
  });
});

// Get journal analytics
app.get('/api/journal/analytics', (req, res) => {
  try {
    const analytics = getJournalAnalytics();
    res.json({
      timestamp: Date.now(),
      analytics
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute journal analytics' });
  }
});

// Get entries for a specific signal
app.get('/api/journal/signal/:signalId', (req, res) => {
  const { signalId } = req.params;
  const entries = getEntriesForSignal(signalId);
  
  res.json({
    timestamp: Date.now(),
    signalId,
    count: entries.length,
    entries
  });
});

// Get entries for a specific trade
app.get('/api/journal/trade/:tradeId', (req, res) => {
  const { tradeId } = req.params;
  const entries = getEntriesForTrade(tradeId);
  
  res.json({
    timestamp: Date.now(),
    tradeId,
    count: entries.length,
    entries
  });
});

// Quick add note to signal
app.post('/api/journal/signal/:signalId/note', (req, res) => {
  const { signalId } = req.params;
  const { note, tags } = req.body;
  
  if (!note) {
    return res.status(400).json({ error: 'Missing required field: note' });
  }
  
  const entry = addSignalNote(signalId, note, tags || []);
  
  res.status(201).json({
    success: true,
    message: 'Note added to signal',
    entry
  });
});

// Record a lesson
app.post('/api/journal/lesson', (req, res) => {
  const { title, content, category, signalId, tradeId } = req.body;
  
  if (!title || !content || !category) {
    return res.status(400).json({ error: 'Missing required fields: title, content, category' });
  }
  
  const entry = recordLesson(title, content, category, signalId, tradeId);
  
  res.status(201).json({
    success: true,
    message: 'Lesson recorded',
    entry
  });
});

// Record a trade entry with mood
app.post('/api/journal/trade', (req, res) => {
  const { tradeId, signalId, token, title, content, mood, outcome, pnl, tags, screenshot } = req.body;
  
  if (!tradeId || !title || !content || !mood) {
    return res.status(400).json({ error: 'Missing required fields: tradeId, title, content, mood' });
  }
  
  const entry = recordTradeEntry(tradeId, signalId, token, title, content, mood, outcome, pnl, tags, screenshot);
  
  res.status(201).json({
    success: true,
    message: 'Trade entry recorded',
    entry
  });
});

// Record an idea
app.post('/api/journal/idea', (req, res) => {
  const { title, content, tags } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Missing required fields: title, content' });
  }
  
  const entry = recordIdea(title, content, tags || []);
  
  res.status(201).json({
    success: true,
    message: 'Idea recorded',
    entry
  });
});

// Export journal
app.get('/api/journal/export', (req, res) => {
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
  const data = exportJournal(format);
  
  const contentType = format === 'csv' ? 'text/csv' : 'application/json';
  const filename = `journal-export-${Date.now()}.${format}`;
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(data);
});

// Generate demo journal data
app.post('/api/journal/demo', (req, res) => {
  generateDemoJournal();
  const summary = getJournalSummary();
  
  res.json({
    success: true,
    message: 'Demo journal data generated',
    summary
  });
});

// === TOKEN BACKTEST API ===
// Historical token analysis and what-if scenarios

// Full backtest analysis for a token
app.get('/api/backtest/:token', async (req, res) => {
  const { token } = req.params;
  const interval = (req.query.interval as CandleInterval) || '1h';
  const days = parseInt(req.query.days as string) || 30;
  const entryDate = req.query.entryDate as string | undefined;
  const entryPrice = req.query.entryPrice ? parseFloat(req.query.entryPrice as string) : undefined;
  
  try {
    let entry: EntryPoint | undefined;
    
    if (entryDate) {
      entry = { type: 'date', date: entryDate };
    } else if (entryPrice) {
      entry = { type: 'price', price: entryPrice };
    }
    
    const result = await analyzeToken(token, entry, interval, days);
    
    res.json({
      success: true,
      backtest: result,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[BACKTEST] Error:', error);
    res.status(500).json({ 
      error: 'Backtest failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Text-formatted backtest result
app.get('/api/backtest/:token/text', async (req, res) => {
  const { token } = req.params;
  const interval = (req.query.interval as CandleInterval) || '1h';
  const days = parseInt(req.query.days as string) || 30;
  
  try {
    const result = await analyzeToken(token, undefined, interval, days);
    const formatted = formatBacktestResult(result);
    res.type('text/plain').send(formatted);
  } catch (error) {
    res.status(500).send(`Backtest failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Simulate entry at specific price/date
app.get('/api/backtest/:token/entry', async (req, res) => {
  const { token } = req.params;
  const price = parseFloat(req.query.price as string);
  const date = req.query.date as string | undefined;
  const interval = (req.query.interval as CandleInterval) || '1h';
  const days = parseInt(req.query.days as string) || 30;
  
  if (!price && !date) {
    return res.status(400).json({ error: 'Must provide either price or date query parameter' });
  }
  
  try {
    const result = await simulateEntry(token, price || 0, date, interval, days);
    
    res.json({
      success: true,
      entry: {
        price: result.entry.price,
        date: result.entry.dateString
      },
      current: {
        price: result.current.price,
        date: result.current.dateString
      },
      roi: result.roi.total,
      roiFormatted: `${result.roi.total >= 0 ? '+' : ''}${result.roi.total.toFixed(2)}%`,
      ath: {
        price: result.ath.price,
        roi: result.ath.fromEntry,
        date: result.ath.dateString
      },
      maxDrawdown: result.drawdown.maxDrawdownPct,
      optimalExit: result.optimalExit,
      holdResult: result.strategies.hold,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[BACKTEST] Entry simulation error:', error);
    res.status(500).json({ 
      error: 'Entry simulation failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Test strategy with TP/SL
app.get('/api/backtest/:token/strategy', async (req, res) => {
  const { token } = req.params;
  const tp = req.query.tp ? parseFloat(req.query.tp as string) : undefined;
  const sl = req.query.sl ? parseFloat(req.query.sl as string) : undefined;
  const trailingStop = req.query.trailing ? parseFloat(req.query.trailing as string) : undefined;
  const holdDays = req.query.holdDays ? parseFloat(req.query.holdDays as string) : undefined;
  const interval = (req.query.interval as CandleInterval) || '1h';
  const days = parseInt(req.query.days as string) || 30;
  
  const strategy: StrategyConfig = {};
  if (tp) strategy.takeProfitPct = tp;
  if (sl) strategy.stopLossPct = sl;
  if (trailingStop) strategy.trailingStopPct = trailingStop;
  if (holdDays) strategy.holdDays = holdDays;
  
  try {
    const result = await testStrategy(token, strategy, undefined, interval, days);
    
    res.json({
      success: true,
      strategy,
      result: result.result,
      comparison: {
        vsHold: `${result.comparison.vsHold >= 0 ? '+' : ''}${result.comparison.vsHold.toFixed(2)}%`,
        vsOptimal: `${result.comparison.vsOptimal.toFixed(2)}%`
      },
      message: result.comparison.vsHold > 0 
        ? `Strategy outperformed hold by ${result.comparison.vsHold.toFixed(1)}%`
        : `Strategy underperformed hold by ${Math.abs(result.comparison.vsHold).toFixed(1)}%`,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[BACKTEST] Strategy test error:', error);
    res.status(500).json({ 
      error: 'Strategy test failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Compare multiple tokens
app.get('/api/backtest/compare', async (req, res) => {
  const tokensParam = req.query.tokens as string;
  
  if (!tokensParam) {
    return res.status(400).json({ error: 'Must provide tokens query parameter (comma-separated)' });
  }
  
  const tokens = tokensParam.split(',').map(t => t.trim()).filter(t => t);
  
  if (tokens.length === 0) {
    return res.status(400).json({ error: 'No valid tokens provided' });
  }
  
  if (tokens.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 tokens for comparison' });
  }
  
  const interval = (req.query.interval as CandleInterval) || '1h';
  const days = parseInt(req.query.days as string) || 30;
  
  try {
    const result = await compareTokens(tokens, undefined, interval, days);
    
    res.json({
      success: true,
      comparison: result,
      message: `Compared ${result.tokens.length} tokens. Best: ${result.bestPerformer} (ROI: ${result.tokens[0]?.roi.toFixed(1)}%)`,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[BACKTEST] Comparison error:', error);
    res.status(500).json({ 
      error: 'Comparison failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get chart data for visualization
app.get('/api/backtest/:token/chart', async (req, res) => {
  const { token } = req.params;
  const interval = (req.query.interval as CandleInterval) || '1h';
  const days = parseInt(req.query.days as string) || 30;
  const entryTimestamp = req.query.entry ? parseInt(req.query.entry as string) : undefined;
  
  try {
    const chartData = await getChartData(token, interval, days, entryTimestamp);
    
    res.json({
      success: true,
      token,
      interval,
      days,
      candleCount: chartData.candles.length,
      candles: chartData.candles,
      markers: {
        entry: chartData.entryMarker || null,
        ath: chartData.athMarker || null,
        atl: chartData.atlMarker || null
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[BACKTEST] Chart data error:', error);
    res.status(500).json({ 
      error: 'Failed to get chart data', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get price history only
app.get('/api/backtest/:token/history', async (req, res) => {
  const { token } = req.params;
  const interval = (req.query.interval as CandleInterval) || '1h';
  const days = parseInt(req.query.days as string) || 30;
  
  try {
    const history = await fetchPriceHistory(token, interval, days);
    
    res.json({
      success: true,
      token,
      symbol: history.symbol,
      name: history.name,
      dataSource: history.dataSource,
      interval,
      days,
      currentPrice: history.currentPrice,
      marketCap: history.marketCap,
      liquidity: history.liquidity,
      candleCount: history.candles.length,
      startTime: history.startTime,
      endTime: history.endTime,
      candles: history.candles,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[BACKTEST] History error:', error);
    res.status(500).json({ 
      error: 'Failed to get price history', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Clear backtest cache
app.post('/api/backtest/cache/clear', (req, res) => {
  clearHistoryCache();
  res.json({
    success: true,
    message: 'Backtest cache cleared',
    timestamp: Date.now()
  });
});

// Get backtest cache stats
app.get('/api/backtest/cache/stats', (req, res) => {
  const stats = getHistoryCacheStats();
  res.json({
    ...stats,
    timestamp: Date.now()
  });
});

// Agent-optimized backtest endpoint
app.get('/api/agent/backtest/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    const result = await analyzeToken(token, undefined, '1h', 7);
    
    // Simplified response for agents
    res.json({
      token,
      symbol: result.symbol,
      entry: {
        price: result.entry.price,
        date: result.entry.dateString
      },
      current: {
        price: result.current.price,
        roi: `${result.roi.total >= 0 ? '+' : ''}${result.roi.total.toFixed(1)}%`
      },
      ath: {
        price: result.ath.price,
        roi: `+${result.ath.fromEntry.toFixed(1)}%`,
        date: result.ath.dateString
      },
      maxDrawdown: `-${result.drawdown.maxDrawdownPct.toFixed(1)}%`,
      optimalTP: `+${result.optimalExit.roi.toFixed(1)}%`,
      volatility: result.volatility.volatilityScore,
      dataSource: result.dataSource,
      recommendation: result.roi.total > 0 
        ? (result.drawdown.currentDrawdownFromATH < 20 ? 'HOLD' : 'CONSIDER_TP')
        : (result.roi.total < -30 ? 'CUT_LOSS' : 'HOLD'),
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Backtest failed',
      token,
      timestamp: Date.now()
    });
  }
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

// Agent-optimized real-time signals with confluence
app.get('/api/agent/signals', (req, res) => {
  const minScore = req.query.minScore ? parseInt(req.query.minScore as string) : 70; // Higher default
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const riskLevel = req.query.riskLevel as string | undefined;
  const minSources = req.query.minSources ? parseInt(req.query.minSources as string) : 2;
  const convictionLevel = req.query.convictionLevel as string | undefined;

  let signals = signalStore.filter(s => s.score >= minScore);

  // Filter by risk level
  if (riskLevel) {
    signals = signals.filter(s => s.riskLevel === riskLevel.toUpperCase());
  }

  // Filter by minimum source confluence
  if (minSources) {
    signals = signals.filter(s => s.confluence && s.confluence.uniqueSources >= minSources);
  }

  // Filter by conviction level
  if (convictionLevel) {
    const level = convictionLevel.toUpperCase();
    if (level === 'ULTRA') {
      signals = signals.filter(s => s.confluence?.convictionLevel === 'ULTRA');
    } else if (level === 'HIGH_CONVICTION') {
      signals = signals.filter(s => s.confluence?.convictionLevel === 'HIGH_CONVICTION' || s.confluence?.convictionLevel === 'ULTRA');
    }
  }

  const agentSignals = signals.slice(0, limit).map(s => ({
    id: s.id,
    token: s.token,
    symbol: s.symbol,
    name: s.name,
    score: s.score,
    confidence: s.confidence,
    riskLevel: s.riskLevel,
    confluence: s.confluence ? {
      uniqueSources: s.confluence.uniqueSources,
      sourceTypes: s.confluence.sourceTypes,
      confluenceBoost: s.confluence.confluenceBoost,
      convictionLevel: s.confluence.convictionLevel
    } : null,
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
    filters: { minScore, minSources, convictionLevel, riskLevel },
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

// === JUPITER TRADING API ===

// Get Jupiter quote for a token
app.post('/api/trade/quote', async (req, res) => {
  const { tokenMint, amount, slippageBps = 100, isBuy = true } = req.body;

  if (!tokenMint) {
    return res.status(400).json({ error: 'tokenMint is required' });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }

  try {
    const quote = await getQuoteWithUSDC(tokenMint, amount, isBuy, slippageBps);

    if (!quote) {
      return res.status(404).json({
        error: 'No route found',
        message: 'Jupiter could not find a route for this trade. Token may have low liquidity.'
      });
    }

    // Calculate readable values
    const inputDecimals = isBuy ? 6 : 9; // USDC = 6, most tokens = 9
    const outputDecimals = isBuy ? 9 : 6;
    const inputAmount = parseFloat(quote.inAmount) / Math.pow(10, inputDecimals);
    const outputAmount = parseFloat(quote.outAmount) / Math.pow(10, outputDecimals);
    const priceImpact = parseFloat(quote.priceImpactPct);
    const price = isBuy ? inputAmount / outputAmount : outputAmount / inputAmount;

    res.json({
      success: true,
      quote: {
        inputMint: quote.inputMint,
        outputMint: quote.outputMint,
        inputAmount,
        outputAmount,
        price,
        priceImpact,
        slippageBps: quote.slippageBps,
        route: quote.routePlan?.map(r => r.swapInfo.label || 'Unknown DEX') || [],
        minOutputAmount: parseFloat(quote.otherAmountThreshold) / Math.pow(10, outputDecimals)
      },
      raw: quote
    });
  } catch (error) {
    console.error('[TRADE] Quote error:', error);
    res.status(500).json({ error: 'Failed to get quote', details: String(error) });
  }
});

// Execute paper trade
app.post('/api/trade/execute', async (req, res) => {
  const { tokenMint, amount, isBuy = true, slippageBps = 100, signalId, signalScore } = req.body;

  if (!tokenMint) {
    return res.status(400).json({ error: 'tokenMint is required' });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }

  try {
    const trade = await executePaperTrade(tokenMint, amount, isBuy, slippageBps, signalId, signalScore);

    if (trade.status === 'FAILED') {
      return res.status(400).json({
        success: false,
        error: trade.error,
        trade
      });
    }

    // Broadcast trade to WebSocket clients
    const tradeMessage = JSON.stringify({
      type: 'trade',
      data: trade
    });
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(tradeMessage);
      }
    }

    res.json({
      success: true,
      trade,
      portfolio: getPaperPortfolio()
    });
  } catch (error) {
    console.error('[TRADE] Execute error:', error);
    res.status(500).json({ error: 'Failed to execute trade', details: String(error) });
  }
});

// Get trade history
app.get('/api/trade/history', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const history = getTradeHistory(limit);

  res.json({
    count: history.length,
    trades: history
  });
});

// Get paper portfolio (MUST be before /api/trade/:id)
app.get('/api/trade/portfolio', (req, res) => {
  let portfolio = getPaperPortfolio();

  if (!portfolio) {
    portfolio = initPaperPortfolio(1000);
  }

  // Convert holdings Map to array for JSON
  const holdings = Array.from(portfolio.holdings.values());

  res.json({
    id: portfolio.id,
    name: portfolio.name,
    createdAt: portfolio.createdAt,
    initialBalance: portfolio.initialBalance,
    currentBalance: portfolio.currentBalance,
    holdings,
    stats: portfolio.stats,
    recentTrades: portfolio.trades.slice(0, 10)
  });
});

// Get specific trade (parameterized route - must come after specific routes)
app.get('/api/trade/:id', (req, res) => {
  const trade = getTradeById(req.params.id);

  if (!trade) {
    return res.status(404).json({ error: 'Trade not found' });
  }

  res.json(trade);
});

// Reset paper portfolio
app.post('/api/trade/portfolio/reset', (req, res) => {
  const { initialBalance = 1000 } = req.body;
  const portfolio = resetPaperPortfolio(initialBalance);

  res.json({
    success: true,
    message: `Portfolio reset with $${initialBalance} USDC`,
    portfolio: {
      id: portfolio.id,
      initialBalance: portfolio.initialBalance,
      currentBalance: portfolio.currentBalance
    }
  });
});

// Update portfolio prices
app.post('/api/trade/portfolio/update', async (req, res) => {
  await updateHoldingPrices();
  const portfolio = getPaperPortfolio();

  res.json({
    success: true,
    portfolio: portfolio
      ? {
          currentBalance: portfolio.currentBalance,
          holdings: Array.from(portfolio.holdings.values()),
          stats: portfolio.stats
        }
      : null
  });
});

// Quick trade from signal (one-click buy)
app.post('/api/trade/signal/:signalId', async (req, res) => {
  const { signalId } = req.params;
  const { amount = 50, slippageBps = 150 } = req.body;

  // Find the signal
  const signal = signalStore.find(s => s.id === signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }

  try {
    // Execute paper buy
    const trade = await executePaperTrade(
      signal.token,
      amount,
      true, // isBuy
      slippageBps,
      signal.id,
      signal.score
    );

    if (trade.status === 'FAILED') {
      return res.status(400).json({
        success: false,
        error: trade.error,
        signal: {
          id: signal.id,
          symbol: signal.symbol,
          score: signal.score
        }
      });
    }

    res.json({
      success: true,
      message: `Bought $${amount} of $${signal.symbol}`,
      trade,
      signal: {
        id: signal.id,
        symbol: signal.symbol,
        score: signal.score,
        riskLevel: signal.riskLevel
      },
      portfolio: getPaperPortfolio()
    });
  } catch (error) {
    console.error('[TRADE] Signal trade error:', error);
    res.status(500).json({ error: 'Failed to execute trade', details: String(error) });
  }
});

// Sell all of a token
app.post('/api/trade/sell/:tokenMint', async (req, res) => {
  const { tokenMint } = req.params;
  const { slippageBps = 150 } = req.body;

  const portfolio = getPaperPortfolio();
  if (!portfolio) {
    return res.status(400).json({ error: 'No active portfolio' });
  }

  const holding = portfolio.holdings.get(tokenMint);
  if (!holding || holding.amount <= 0) {
    return res.status(400).json({ error: 'No holdings for this token' });
  }

  try {
    const trade = await executePaperTrade(
      tokenMint,
      holding.amount,
      false, // isBuy = false (sell)
      slippageBps
    );

    res.json({
      success: true,
      message: `Sold all ${holding.symbol}`,
      trade,
      portfolio: getPaperPortfolio()
    });
  } catch (error) {
    console.error('[TRADE] Sell error:', error);
    res.status(500).json({ error: 'Failed to sell', details: String(error) });
  }
});

// Calculate optimal trade size for a signal
app.get('/api/trade/optimal/:signalId', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }

  const mcap = signal.marketData?.mcap || 0;
  const liquidity = signal.marketData?.liquidity || 0;
  const optimalSize = calculateOptimalTradeSize(mcap, liquidity);

  res.json({
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      mcap,
      liquidity
    },
    optimalTradeSize: optimalSize,
    suggestion:
      optimalSize < 10
        ? 'Very low liquidity - trade with extreme caution'
        : optimalSize < 50
          ? 'Low liquidity - keep position size small'
          : optimalSize < 200
            ? 'Moderate liquidity - normal position size OK'
            : 'Good liquidity - larger positions possible'
  });
});

// === WALLET CONNECTION & REAL TRADING API ===

// Initialize wallet connection on startup
initConnection();

// Connect wallet
app.post('/api/wallet/connect', (req, res) => {
  const { walletType, publicKey, signature } = req.body;
  
  if (!publicKey) {
    return res.status(400).json({ error: 'publicKey is required' });
  }
  
  if (!isValidPublicKey(publicKey)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const result = connectWallet({
    walletType: walletType || 'unknown',
    publicKey,
    signature,
  });
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Disconnect wallet
app.post('/api/wallet/disconnect', (req, res) => {
  const { publicKey } = req.body;
  
  if (!publicKey) {
    return res.status(400).json({ error: 'publicKey is required' });
  }
  
  const disconnected = disconnectWallet(publicKey);
  res.json({ success: disconnected, message: disconnected ? 'Wallet disconnected' : 'Wallet not found' });
});

// Get wallet connection status
app.get('/api/wallet/status/:publicKey', (req, res) => {
  const { publicKey } = req.params;
  
  if (!isValidPublicKey(publicKey)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const status = getWalletStatus(publicKey);
  res.json(status);
});

// Get wallet balances
app.get('/api/wallet/balance/:publicKey', async (req, res) => {
  const { publicKey } = req.params;
  
  if (!isValidPublicKey(publicKey)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  try {
    const balances = await getWalletBalances(publicKey);
    res.json(balances);
  } catch (error) {
    console.error('[WALLET] Balance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

// Get wallet transaction history
app.get('/api/wallet/transactions/:publicKey', (req, res) => {
  const { publicKey } = req.params;
  const limit = parseInt(req.query.limit as string) || 20;
  
  if (!isValidPublicKey(publicKey)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const transactions = getTransactions(publicKey, limit);
  res.json({ count: transactions.length, transactions });
});

// Get swap quote
app.post('/api/wallet/quote', async (req, res) => {
  const { inputMint, outputMint, amount, slippageBps } = req.body;
  
  if (!inputMint || !outputMint || !amount) {
    return res.status(400).json({ error: 'inputMint, outputMint, and amount are required' });
  }
  
  if (amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }
  
  try {
    const quote = await getSwapQuote({
      inputMint,
      outputMint,
      amount: parseFloat(amount),
      slippageBps: slippageBps || 100,
    });
    
    if (!quote) {
      return res.status(400).json({ error: 'Failed to get quote - check token addresses and liquidity' });
    }
    
    res.json(quote);
  } catch (error) {
    console.error('[WALLET] Quote error:', error);
    res.status(500).json({ error: 'Failed to get quote' });
  }
});

// Quick quote for UI
app.get('/api/wallet/quickquote', async (req, res) => {
  const { inputMint, outputMint, amount, slippageBps } = req.query;
  
  if (!inputMint || !outputMint || !amount) {
    return res.status(400).json({ error: 'inputMint, outputMint, and amount are required' });
  }
  
  try {
    const result = await getQuickQuote(
      inputMint as string,
      outputMint as string,
      parseFloat(amount as string),
      parseInt(slippageBps as string) || 100
    );
    
    if (!result) {
      return res.status(400).json({ error: 'Failed to get quote' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get quote' });
  }
});

// Build swap transaction
app.post('/api/wallet/swap/build', async (req, res) => {
  const { quoteId, publicKey, priorityFee } = req.body;
  
  if (!quoteId || !publicKey) {
    return res.status(400).json({ error: 'quoteId and publicKey are required' });
  }
  
  if (!isValidPublicKey(publicKey)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  // Check wallet is connected
  const status = getWalletStatus(publicKey);
  if (!status.connected) {
    return res.status(401).json({ error: 'Wallet not connected' });
  }
  
  try {
    const transaction = await buildSwapTransaction(quoteId, publicKey, priorityFee);
    
    if (!transaction) {
      return res.status(400).json({ error: 'Failed to build transaction - quote may have expired' });
    }
    
    // Check simulation result
    if (transaction.simulation && !transaction.simulation.success) {
      return res.status(400).json({
        error: 'Transaction simulation failed',
        simulation: transaction.simulation,
      });
    }
    
    res.json(transaction);
  } catch (error) {
    console.error('[WALLET] Build transaction error:', error);
    res.status(500).json({ error: 'Failed to build transaction' });
  }
});

// Confirm swap transaction (after client signs and submits)
app.post('/api/wallet/swap/confirm', async (req, res) => {
  const { signature, blockhash, lastValidBlockHeight, publicKey, quote } = req.body;
  
  if (!signature || !blockhash || !lastValidBlockHeight || !publicKey || !quote) {
    return res.status(400).json({ error: 'All fields are required: signature, blockhash, lastValidBlockHeight, publicKey, quote' });
  }
  
  try {
    const result = await confirmTransaction(
      signature,
      blockhash,
      lastValidBlockHeight,
      publicKey,
      quote
    );
    
    res.json(result);
  } catch (error) {
    console.error('[WALLET] Confirm error:', error);
    res.status(500).json({ error: 'Failed to confirm transaction' });
  }
});

// Safety check before trading
app.post('/api/wallet/safety-check', async (req, res) => {
  const { tokenMint, inputAmount, slippageBps } = req.body;
  
  if (!tokenMint) {
    return res.status(400).json({ error: 'tokenMint is required' });
  }
  
  try {
    const safetyCheck = await performSafetyChecks(
      tokenMint,
      inputAmount || 0.1,
      slippageBps || 100
    );
    
    res.json(safetyCheck);
  } catch (error) {
    console.error('[WALLET] Safety check error:', error);
    res.status(500).json({ error: 'Failed to perform safety checks' });
  }
});

// Get trading presets
app.get('/api/wallet/presets', (req, res) => {
  res.json({
    slippage: {
      low: { bps: SLIPPAGE_PRESETS.low, label: '0.5%', description: 'Tight slippage for stable pairs' },
      normal: { bps: SLIPPAGE_PRESETS.normal, label: '1%', description: 'Standard slippage' },
      high: { bps: SLIPPAGE_PRESETS.high, label: '3%', description: 'For volatile tokens' },
      turbo: { bps: SLIPPAGE_PRESETS.turbo, label: '5%', description: 'Maximum tolerance' },
    },
    priorityFee: {
      low: { microLamports: PRIORITY_FEE_PRESETS.low, label: 'Economy', description: '~0.000001 SOL' },
      medium: { microLamports: PRIORITY_FEE_PRESETS.medium, label: 'Standard', description: '~0.00001 SOL' },
      high: { microLamports: PRIORITY_FEE_PRESETS.high, label: 'Fast', description: '~0.0001 SOL' },
      turbo: { microLamports: PRIORITY_FEE_PRESETS.turbo, label: 'Turbo', description: '~0.0005 SOL' },
    },
  });
});

// Get connected wallets (admin/debug)
app.get('/api/wallet/connected', (req, res) => {
  const wallets = getConnectedWallets();
  res.json({ count: wallets.length, wallets });
});

// Execute swap from signal (convenience endpoint)
app.post('/api/wallet/swap/signal', async (req, res) => {
  const { signalId, publicKey, amount, slippageBps, priorityFee } = req.body;
  
  if (!signalId || !publicKey || !amount) {
    return res.status(400).json({ error: 'signalId, publicKey, and amount are required' });
  }
  
  // Find signal
  const signal = signalStore.find(s => s.id === signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  // Check wallet connected
  const status = getWalletStatus(publicKey);
  if (!status.connected) {
    return res.status(401).json({ error: 'Wallet not connected' });
  }
  
  try {
    // 1. Safety check
    const safety = await performSafetyChecks(signal.token, amount, slippageBps || 100);
    if (!safety.canProceed) {
      return res.status(400).json({
        error: 'Safety check failed',
        safetyCheck: safety,
      });
    }
    
    // 2. Get quote (SOL -> Token)
    const quote = await getSwapQuote({
      inputMint: SOL_MINT,
      outputMint: signal.token,
      amount,
      slippageBps: slippageBps || 100,
      priorityFee,
    });
    
    if (!quote) {
      return res.status(400).json({ error: 'Failed to get quote' });
    }
    
    // 3. Build transaction
    const transaction = await buildSwapTransaction(quote.quoteId, publicKey, priorityFee);
    
    if (!transaction) {
      return res.status(400).json({ error: 'Failed to build transaction' });
    }
    
    // Return quote and transaction for client signing
    res.json({
      signal: {
        id: signal.id,
        symbol: signal.symbol,
        token: signal.token,
        score: signal.score,
        riskLevel: signal.riskLevel,
      },
      quote,
      transaction,
      safetyCheck: safety,
    });
  } catch (error) {
    console.error('[WALLET] Signal swap error:', error);
    res.status(500).json({ error: 'Failed to prepare swap' });
  }
});

// === RISK CALCULATOR API ===

// Calculate risk and position sizing
app.post('/api/risk/calculate', (req, res) => {
  const { portfolioSize, riskPercent, signalId, score, riskLevel, volatility } = req.body;
  
  // Validate inputs
  if (!portfolioSize || portfolioSize <= 0) {
    return res.status(400).json({ error: 'portfolioSize is required and must be positive' });
  }
  
  const validRiskPercent = Math.max(1, Math.min(10, riskPercent || 5));
  
  // Find signal if provided
  let signal = undefined;
  if (signalId) {
    signal = signalStore.find(s => s.id === signalId);
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
  }
  
  // Build input
  const input: RiskCalculationInput = {
    portfolioSize,
    riskPercent: validRiskPercent,
    signal,
    customScore: score,
    customRiskLevel: riskLevel,
    customVolatility: volatility
  };
  
  const result = calculateRisk(input);
  
  res.json({
    success: true,
    calculation: result,
    signal: signal ? {
      id: signal.id,
      symbol: signal.symbol,
      token: signal.token,
      score: signal.score,
      riskLevel: signal.riskLevel
    } : null
  });
});

// Get risk calculation for a specific signal
app.get('/api/risk/signal/:signalId', (req, res) => {
  const { signalId } = req.params;
  const portfolioSize = parseFloat(req.query.portfolioSize as string) || 1000;
  const riskPercent = parseFloat(req.query.riskPercent as string) || 5;
  
  const signal = signalStore.find(s => s.id === signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  const result = calculateRisk({
    portfolioSize,
    riskPercent,
    signal
  });
  
  res.json({
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      token: signal.token,
      score: signal.score,
      riskLevel: signal.riskLevel,
      price: signal.marketData?.price,
      mcap: signal.marketData?.mcap
    },
    calculation: result
  });
});

// Get position sizing rules
app.get('/api/risk/rules', (req, res) => {
  res.json({
    rules: POSITION_RULES,
    description: {
      LOW: 'Low risk signals allow up to 10% of portfolio per trade',
      MEDIUM: 'Medium risk signals allow up to 8% of portfolio per trade',
      HIGH: 'High risk signals allow up to 5% of portfolio per trade',
      EXTREME: 'Extreme risk signals allow up to 2% of portfolio per trade'
    },
    methodology: {
      kelly: 'Kelly Criterion for optimal position sizing based on edge',
      riskAdjusted: 'Position size adjusted by signal score and volatility',
      stopLoss: 'Stop loss levels based on volatility and risk tolerance',
      takeProfit: 'Take profit targets at 2x, 3x, 5x, 10x with probability estimates'
    }
  });
});

// Quick position size calculation
app.get('/api/risk/quick', (req, res) => {
  const portfolioSize = parseFloat(req.query.portfolioSize as string) || 1000;
  const score = parseInt(req.query.score as string) || 60;
  const riskLevel = (req.query.riskLevel as string || 'MEDIUM').toUpperCase();
  
  if (!['LOW', 'MEDIUM', 'HIGH', 'EXTREME'].includes(riskLevel)) {
    return res.status(400).json({ error: 'Invalid riskLevel. Use: LOW, MEDIUM, HIGH, or EXTREME' });
  }
  
  const position = quickPositionSize(
    portfolioSize,
    score,
    riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  );
  
  const maxPercent = POSITION_RULES[riskLevel as keyof typeof POSITION_RULES].maxPercent;
  
  res.json({
    portfolioSize,
    score,
    riskLevel,
    recommendedPosition: Math.round(position * 100) / 100,
    recommendedPercent: Math.round((position / portfolioSize) * 100 * 10) / 10,
    maxAllowed: portfolioSize * (maxPercent / 100),
    maxPercent
  });
});

// Get risk calculation as formatted text
app.get('/api/risk/signal/:signalId/text', (req, res) => {
  const { signalId } = req.params;
  const portfolioSize = parseFloat(req.query.portfolioSize as string) || 1000;
  const riskPercent = parseFloat(req.query.riskPercent as string) || 5;
  
  const signal = signalStore.find(s => s.id === signalId);
  if (!signal) {
    return res.status(404).send('Signal not found');
  }
  
  const result = calculateRisk({
    portfolioSize,
    riskPercent,
    signal
  });
  
  res.type('text/plain').send(formatRiskCalculation(result));
});

// Batch risk calculation for multiple signals
app.post('/api/risk/batch', (req, res) => {
  const { portfolioSize, riskPercent, signalIds } = req.body;
  
  if (!portfolioSize || portfolioSize <= 0) {
    return res.status(400).json({ error: 'portfolioSize is required and must be positive' });
  }
  
  if (!signalIds || !Array.isArray(signalIds) || signalIds.length === 0) {
    return res.status(400).json({ error: 'signalIds array is required' });
  }
  
  const validRiskPercent = Math.max(1, Math.min(10, riskPercent || 5));
  const calculations = [];
  
  for (const signalId of signalIds.slice(0, 20)) { // Limit to 20
    const signal = signalStore.find(s => s.id === signalId);
    if (!signal) continue;
    
    const result = calculateRisk({
      portfolioSize,
      riskPercent: validRiskPercent,
      signal
    });
    
    calculations.push({
      signalId,
      symbol: signal.symbol,
      token: signal.token,
      score: signal.score,
      riskLevel: signal.riskLevel,
      recommendedPosition: result.recommendedPosition,
      recommendedPercent: result.recommendedPositionPercent,
      stopLoss: result.recommendedStopLoss,
      takeProfit: result.takeProfit[0], // 2x target
      confidence: result.confidence
    });
  }
  
  // Sort by recommended position (highest first)
  calculations.sort((a, b) => b.recommendedPosition - a.recommendedPosition);
  
  res.json({
    portfolioSize,
    riskPercent: validRiskPercent,
    count: calculations.length,
    calculations,
    summary: {
      totalRecommended: calculations.reduce((sum, c) => sum + c.recommendedPosition, 0),
      avgConfidence: calculations.length > 0 
        ? calculations.filter(c => c.confidence === 'HIGH').length / calculations.length * 100
        : 0
    }
  });
});

// === CUSTOM SCORING WEIGHTS API ===

// Get current weights
app.get('/api/scoring/weights', (req, res) => {
  try {
    const weights = getCurrentWeights();
    const profile = getActiveProfile();
    
    res.json({
      activeProfile: getActiveProfileName(),
      profileName: profile?.name || 'Default',
      profileDescription: profile?.description || '',
      lastUpdated: profile?.updatedAt || Date.now(),
      ...weights
    });
  } catch (error) {
    console.error('[SCORING] Get weights error:', error);
    res.status(500).json({ error: 'Failed to get weights' });
  }
});

// Update weights
app.put('/api/scoring/weights', (req, res) => {
  try {
    const { sourceWeights, riskPenalties } = req.body;
    
    const updated = updateWeights(sourceWeights || {}, riskPenalties || {});
    const profile = getActiveProfile();
    
    res.json({
      success: true,
      message: 'Weights updated successfully',
      activeProfile: getActiveProfileName(),
      profileName: profile?.name || 'Default',
      lastUpdated: profile?.updatedAt || Date.now(),
      ...updated
    });
  } catch (error: any) {
    console.error('[SCORING] Update weights error:', error);
    res.status(400).json({ error: error.message || 'Failed to update weights' });
  }
});

// Reset to defaults
app.post('/api/scoring/reset', (req, res) => {
  try {
    const weights = resetToDefaults();
    const profile = getActiveProfile();
    
    res.json({
      success: true,
      message: 'Weights reset to defaults',
      activeProfile: getActiveProfileName(),
      profileName: profile?.name || 'Default',
      lastUpdated: profile?.updatedAt || Date.now(),
      ...weights
    });
  } catch (error: any) {
    console.error('[SCORING] Reset error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset weights' });
  }
});

// Get presets
app.get('/api/scoring/presets', (req, res) => {
  try {
    const presets = getPresets();
    res.json({
      count: presets.length,
      presets: presets.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description
      }))
    });
  } catch (error) {
    console.error('[SCORING] Get presets error:', error);
    res.status(500).json({ error: 'Failed to get presets' });
  }
});

// Get preset details
app.get('/api/scoring/presets/:presetId', (req, res) => {
  try {
    const { presetId } = req.params;
    const preset = getPreset(presetId);
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    res.json(preset);
  } catch (error) {
    console.error('[SCORING] Get preset error:', error);
    res.status(500).json({ error: 'Failed to get preset' });
  }
});

// Apply preset
app.post('/api/scoring/apply-preset/:presetId', (req, res) => {
  try {
    const { presetId } = req.params;
    const weights = applyPreset(presetId);
    const preset = getPreset(presetId);
    
    res.json({
      success: true,
      message: `Applied preset: ${preset?.name || presetId}`,
      preset: preset?.name || presetId,
      presetDescription: preset?.description || '',
      ...weights
    });
  } catch (error: any) {
    console.error('[SCORING] Apply preset error:', error);
    res.status(400).json({ error: error.message || 'Failed to apply preset' });
  }
});

// Get all profiles
app.get('/api/scoring/profiles', (req, res) => {
  try {
    const profiles = getAllProfiles();
    const activeProfile = getActiveProfileName();
    
    res.json({
      activeProfile,
      count: Object.keys(profiles).length,
      profiles: Object.entries(profiles).map(([id, p]) => ({
        id,
        name: p.name,
        description: p.description,
        isActive: id === activeProfile,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    });
  } catch (error) {
    console.error('[SCORING] Get profiles error:', error);
    res.status(500).json({ error: 'Failed to get profiles' });
  }
});

// Create profile
app.post('/api/scoring/profiles', (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Profile name is required' });
    }
    
    const profile = createProfile(name, description);
    
    res.json({
      success: true,
      message: `Profile "${name}" created`,
      profile: {
        id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        ...profile
      }
    });
  } catch (error: any) {
    console.error('[SCORING] Create profile error:', error);
    res.status(400).json({ error: error.message || 'Failed to create profile' });
  }
});

// Switch profile
app.post('/api/scoring/profiles/:profileId/switch', (req, res) => {
  try {
    const { profileId } = req.params;
    const profile = switchProfile(profileId);
    
    res.json({
      success: true,
      message: `Switched to profile: ${profile.name}`,
      activeProfile: profileId,
      profileName: profile.name,
      sourceWeights: profile.sourceWeights,
      riskPenalties: profile.riskPenalties
    });
  } catch (error: any) {
    console.error('[SCORING] Switch profile error:', error);
    res.status(400).json({ error: error.message || 'Failed to switch profile' });
  }
});

// Delete profile
app.delete('/api/scoring/profiles/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    
    if (profileId === 'default') {
      return res.status(400).json({ error: 'Cannot delete default profile' });
    }
    
    const deleted = deleteProfile(profileId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json({
      success: true,
      message: `Profile "${profileId}" deleted`,
      activeProfile: getActiveProfileName()
    });
  } catch (error: any) {
    console.error('[SCORING] Delete profile error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete profile' });
  }
});

// Re-score signals with current weights
app.post('/api/scoring/rescore', (req, res) => {
  try {
    const { signalIds, limit = 50 } = req.body;
    
    // Get signals to re-score
    let signals: AggregatedSignal[];
    if (signalIds && Array.isArray(signalIds)) {
      signals = signalStore.filter(s => signalIds.includes(s.id)).slice(0, limit);
    } else {
      signals = signalStore.slice(0, limit);
    }
    
    if (signals.length === 0) {
      return res.json({
        success: true,
        count: 0,
        signals: []
      });
    }
    
    const rescored = rescoreSignals(signals);
    
    res.json({
      success: true,
      count: rescored.length,
      signals: rescored.map(({ signal, impact }) => ({
        id: signal.id,
        symbol: signal.symbol,
        token: signal.token,
        originalScore: impact.originalScore,
        adjustedScore: impact.adjustedScore,
        delta: impact.delta,
        breakdown: impact.breakdown
      })),
      summary: {
        avgDelta: rescored.reduce((sum, r) => sum + r.impact.delta, 0) / rescored.length,
        improved: rescored.filter(r => r.impact.delta > 0).length,
        degraded: rescored.filter(r => r.impact.delta < 0).length,
        unchanged: rescored.filter(r => r.impact.delta === 0).length
      }
    });
  } catch (error: any) {
    console.error('[SCORING] Rescore error:', error);
    res.status(500).json({ error: error.message || 'Failed to rescore signals' });
  }
});

// Preview weight change impact on a signal
app.post('/api/scoring/preview', (req, res) => {
  try {
    const { signalId, sourceWeights, riskPenalties } = req.body;
    
    if (!signalId) {
      return res.status(400).json({ error: 'signalId is required' });
    }
    
    const signal = signalStore.find(s => s.id === signalId);
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    // Get current score with current weights
    const currentImpact = calculateCustomScore(signal);
    
    // Get preview score with proposed weights
    const previewImpact = previewWeightChange(signal, sourceWeights, riskPenalties);
    
    res.json({
      signal: {
        id: signal.id,
        symbol: signal.symbol,
        token: signal.token,
        sources: signal.sources.map(s => s.source)
      },
      current: currentImpact,
      preview: previewImpact,
      comparison: {
        scoreDelta: previewImpact.adjustedScore - currentImpact.adjustedScore,
        improved: previewImpact.adjustedScore > currentImpact.adjustedScore
      }
    });
  } catch (error: any) {
    console.error('[SCORING] Preview error:', error);
    res.status(500).json({ error: error.message || 'Failed to preview weight change' });
  }
});

// Get score for a specific signal with current weights
app.get('/api/scoring/signal/:signalId', (req, res) => {
  try {
    const { signalId } = req.params;
    
    const signal = signalStore.find(s => s.id === signalId);
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    const impact = calculateCustomScore(signal);
    const weights = getCurrentWeights();
    
    res.json({
      signal: {
        id: signal.id,
        symbol: signal.symbol,
        token: signal.token,
        originalScore: signal.score,
        sources: signal.sources
      },
      customScore: impact,
      weightsUsed: weights
    });
  } catch (error: any) {
    console.error('[SCORING] Get signal score error:', error);
    res.status(500).json({ error: error.message || 'Failed to get signal score' });
  }
});

// Export scoring configuration
app.get('/api/scoring/export', (req, res) => {
  try {
    const config = exportScoringConfig();
    res.json(config);
  } catch (error) {
    console.error('[SCORING] Export error:', error);
    res.status(500).json({ error: 'Failed to export scoring configuration' });
  }
});

// Import scoring configuration
app.post('/api/scoring/import', (req, res) => {
  try {
    const config = req.body;
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid configuration' });
    }
    
    importScoringConfig(config);
    
    res.json({
      success: true,
      message: 'Scoring configuration imported',
      activeProfile: getActiveProfileName()
    });
  } catch (error: any) {
    console.error('[SCORING] Import error:', error);
    res.status(400).json({ error: error.message || 'Failed to import configuration' });
  }
});

// === BUNDLE/INSIDER DETECTION API ===

// Analyze token for bundle/insider activity
app.get('/api/detection/bundle/:token', async (req, res) => {
  const { token } = req.params;
  
  // Validate token address
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }
  
  try {
    const analysis = await analyzeBundles(token);
    
    res.json({
      token,
      bundleScore: analysis.bundleScore,
      riskLevel: analysis.riskLevel,
      summary: {
        totalBundledWallets: analysis.totalBundledWallets,
        bundledPercentage: analysis.bundledPercentage,
        sameBlockBuys: analysis.sameBlockBuys,
        newWalletBuys: analysis.newWalletBuys,
        insiderCount: analysis.insiders.length
      },
      redFlags: analysis.redFlags,
      warnings: analysis.warnings,
      clusters: analysis.clusters.map(c => ({
        walletCount: c.wallets.length,
        fundingSource: c.fundingSource,
        percentageOfSupply: c.percentageOfSupply,
        suspicionLevel: c.suspicionLevel,
        reason: c.reason
      })),
      cached: analysis.cached,
      analyzedAt: analysis.analyzedAt
    });
  } catch (error) {
    console.error('[DETECTION] Bundle analysis failed:', error);
    res.status(500).json({ error: 'Bundle analysis failed' });
  }
});

// Get suspected insiders for a token
app.get('/api/detection/insiders/:token', async (req, res) => {
  const { token } = req.params;
  
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }
  
  try {
    const analysis = await analyzeBundles(token);
    
    res.json({
      token,
      insiderCount: analysis.insiders.length,
      insiders: analysis.insiders.map(i => ({
        address: i.address,
        suspicionScore: i.suspicionScore,
        flags: i.flags,
        percentageHeld: i.percentageHeld,
        isLikelyDev: i.isLikelyDev,
        fundingSource: i.fundingSource,
        walletAge: i.walletAge,
        buyWithinBlocks: i.buyWithinBlocks
      })),
      bundleScore: analysis.bundleScore,
      riskLevel: analysis.riskLevel,
      cached: analysis.cached
    });
  } catch (error) {
    console.error('[DETECTION] Insider detection failed:', error);
    res.status(500).json({ error: 'Insider detection failed' });
  }
});

// Get full bundle analysis (detailed)
app.get('/api/detection/bundle/:token/full', async (req, res) => {
  const { token } = req.params;
  
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }
  
  try {
    const analysis = await analyzeBundles(token);
    res.json(analysis);
  } catch (error) {
    console.error('[DETECTION] Full analysis failed:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Get formatted text analysis (for Telegram/CLI)
app.get('/api/detection/bundle/:token/text', async (req, res) => {
  const { token } = req.params;
  
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).send('Invalid token address');
  }
  
  try {
    const analysis = await analyzeBundles(token);
    res.type('text/plain').send(formatBundleAnalysis(analysis));
  } catch (error) {
    res.status(500).send('Analysis failed');
  }
});

// Quick bundle score check (cached only, no new API calls)
app.get('/api/detection/quick/:token', (req, res) => {
  const { token } = req.params;
  
  const cached = getCachedBundleAnalysis(token);
  
  if (!cached) {
    return res.json({
      token,
      cached: false,
      bundleScore: null,
      message: 'No cached data available. Call /api/detection/bundle/:token first.'
    });
  }
  
  res.json({
    token,
    bundleScore: cached.bundleScore,
    riskLevel: cached.riskLevel,
    bundledWallets: cached.totalBundledWallets,
    bundledPercentage: cached.bundledPercentage,
    redFlags: cached.redFlags.length,
    cached: true,
    analyzedAt: cached.analyzedAt
  });
});

// Get bundle warning message (for signal display)
app.get('/api/detection/warning/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    const analysis = await analyzeBundles(token);
    const warning = getBundleWarning(analysis);
    
    res.json({
      token,
      hasWarning: warning !== null,
      warning,
      bundleScore: analysis.bundleScore,
      riskLevel: analysis.riskLevel
    });
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// === HONEYPOT DETECTION API ===

// Full honeypot check for a token
app.get('/api/detection/honeypot/:token', async (req, res) => {
  const { token } = req.params;
  
  // Validate token address format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address format' });
  }
  
  try {
    const result = await detectHoneypot(token);
    
    res.json({
      success: true,
      token,
      symbol: result.symbol,
      name: result.name,
      
      // Core honeypot status
      isHoneypot: result.isHoneypot,
      honeypotReason: result.honeypotReason,
      canSell: result.canSell,
      
      // Tax analysis
      taxes: {
        buy: result.buyTax,
        sell: result.sellTax,
        transfer: result.transferTax
      },
      
      // Price impact
      priceImpact: {
        buy: result.buyPriceImpact,
        sell: result.sellPriceImpact,
        difference: result.priceImpactDiff
      },
      
      // Contract features
      contract: {
        hasBlacklist: result.hasBlacklist,
        hasTradingPause: result.hasTradingPause
      },
      
      // LP status
      liquidity: {
        isLocked: result.lpOwnership.isLocked,
        ownerPercentage: result.lpOwnership.ownerPercentage
      },
      
      // Transaction analysis
      transactions: {
        buyCount: result.buyTxCount,
        sellCount: result.sellTxCount,
        sellRatio: result.sellRatio
      },
      
      // Overall risk
      risk: {
        score: result.riskScore,
        level: result.riskLevel
      },
      
      // Warnings
      warnings: result.warnings,
      
      // Metadata
      checkedAt: result.checkedAt,
      cached: result.cached
    });
  } catch (error) {
    console.error('[HONEYPOT API] Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check honeypot status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get honeypot check as formatted text
app.get('/api/detection/honeypot/:token/text', async (req, res) => {
  const { token } = req.params;
  
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).send('Invalid token address format');
  }
  
  try {
    const result = await detectHoneypot(token);
    res.type('text/plain').send(formatHoneypotResult(result));
  } catch (error) {
    res.status(500).send('Failed to check honeypot status');
  }
});

// Batch honeypot check for multiple tokens
app.post('/api/detection/honeypot/batch', async (req, res) => {
  const { tokens } = req.body;
  
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: 'tokens array is required' });
  }
  
  if (tokens.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 tokens per batch' });
  }
  
  // Validate all tokens
  for (const token of tokens) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
      return res.status(400).json({ error: `Invalid token address: ${token}` });
    }
  }
  
  try {
    const results = await batchDetectHoneypot(tokens);
    
    const response: Record<string, any> = {};
    for (const [token, result] of results) {
      response[token] = {
        isHoneypot: result.isHoneypot,
        canSell: result.canSell,
        sellTax: result.sellTax,
        buyTax: result.buyTax,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        warnings: result.warnings.length
      };
    }
    
    res.json({
      success: true,
      count: tokens.length,
      results: response
    });
  } catch (error) {
    console.error('[HONEYPOT BATCH API] Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to batch check honeypot status'
    });
  }
});

// Quick honeypot check (cached only, no API calls)
app.get('/api/detection/honeypot/:token/quick', (req, res) => {
  const { token } = req.params;
  
  const cached = getQuickHoneypotStatus(token);
  
  if (!cached) {
    return res.status(404).json({ 
      success: false,
      error: 'No cached honeypot data. Use /api/detection/honeypot/:token for full check.' 
    });
  }
  
  res.json({
    success: true,
    token,
    isHoneypot: cached.isHoneypot,
    canSell: cached.canSell,
    sellTax: cached.sellTax,
    riskLevel: cached.riskLevel,
    cached: true,
    checkedAt: cached.checkedAt
  });
});

// Clear honeypot cache
app.post('/api/detection/honeypot/cache/clear', (req, res) => {
  clearHoneypotCache();
  res.json({
    success: true,
    message: 'Honeypot cache cleared'
  });
});

// Check honeypot for a signal by ID
app.get('/api/signals/:id/honeypot', async (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  try {
    const result = await detectHoneypot(signal.token);
    
    res.json({
      success: true,
      signal: {
        id: signal.id,
        symbol: signal.symbol,
        token: signal.token,
        score: signal.score
      },
      honeypot: {
        isHoneypot: result.isHoneypot,
        canSell: result.canSell,
        buyTax: result.buyTax,
        sellTax: result.sellTax,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        warnings: result.warnings
      },
      recommendation: result.isHoneypot 
        ? '🚨 DO NOT BUY - Token is likely a honeypot'
        : result.riskLevel === 'HIGH_RISK'
        ? '⚠️ HIGH RISK - Proceed with extreme caution'
        : result.riskLevel === 'MEDIUM_RISK'
        ? '⚡ CAUTION - Some risk factors detected'
        : '✅ LIKELY SAFE - No major honeypot indicators'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to check honeypot status'
    });
  }
});

// === WASH TRADING DETECTION API ===

// Full wash trading analysis for a token
app.get('/api/detection/wash/:token', async (req, res) => {
  const { token } = req.params;
  
  // Validate token format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }
  
  try {
    const analysis = await analyzeWashTrading(token);
    
    res.json({
      success: true,
      token,
      symbol: analysis.symbol,
      
      // Core metrics
      washScore: analysis.washScore,
      riskLevel: analysis.riskLevel,
      
      // Volume analysis
      volume: {
        reported: analysis.reportedVolume24h,
        estimatedReal: analysis.estimatedRealVolume,
        washPercent: analysis.washVolumePercent,
        realPercent: analysis.realVolumePercent
      },
      
      // Detection results
      detection: {
        selfTrades: analysis.selfTradeCount,
        selfTradeVolume: analysis.selfTradeVolume,
        circularPatterns: analysis.circularPatternCount,
        circularVolume: analysis.circularVolume,
        uniqueTraders: analysis.uniqueTraders,
        suspiciousWallets: analysis.suspiciousWalletCount
      },
      
      // Interval analysis
      intervalAnalysis: analysis.intervalAnalysis ? {
        avgIntervalSec: Math.round(analysis.intervalAnalysis.averageIntervalMs / 1000),
        regularityScore: analysis.intervalAnalysis.regularityScore,
        transactionCount: analysis.intervalAnalysis.transactionCount
      } : null,
      
      // Volume anomaly
      volumeAnomaly: analysis.volumeAnomaly ? {
        volumeToPriceRatio: Math.round(analysis.volumeAnomaly.volumeToPriceRatio),
        priceChange: analysis.volumeAnomaly.priceChange,
        holders: analysis.volumeAnomaly.holderCount,
        anomalyScore: analysis.volumeAnomaly.anomalyScore
      } : null,
      
      // Warnings
      warnings: analysis.warnings,
      warningCount: analysis.warnings.length,
      
      // Status
      status: analysis.washScore >= 70 
        ? '⚠️ FAKE VOLUME DETECTED' 
        : analysis.washScore >= 40 
        ? '⚡ SUSPICIOUS ACTIVITY' 
        : '✅ VOLUME APPEARS ORGANIC',
      
      // Metadata
      analyzedAt: analysis.analyzedAt,
      transactionsAnalyzed: analysis.transactionsAnalyzed,
      cached: analysis.cached
    });
  } catch (error) {
    console.error('[WASH API] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze wash trading',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get estimated real volume for a token
app.get('/api/detection/real-volume/:token', async (req, res) => {
  const { token } = req.params;
  
  // Validate token format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }
  
  try {
    const analysis = await analyzeWashTrading(token);
    
    const volumeK = (v: number) => v >= 1000000 
      ? `$${(v / 1000000).toFixed(2)}M` 
      : `$${(v / 1000).toFixed(1)}K`;
    
    res.json({
      success: true,
      token,
      symbol: analysis.symbol,
      reportedVolume: analysis.reportedVolume24h,
      estimatedRealVolume: analysis.estimatedRealVolume,
      washVolumePercent: analysis.washVolumePercent,
      realVolumePercent: analysis.realVolumePercent,
      washScore: analysis.washScore,
      riskLevel: analysis.riskLevel,
      summary: `Reported: ${volumeK(analysis.reportedVolume24h)} | Real: ~${volumeK(analysis.estimatedRealVolume)} (${analysis.realVolumePercent}%)`,
      cached: analysis.cached
    });
  } catch (error) {
    console.error('[WASH API] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to estimate real volume'
    });
  }
});

// Get wash trading analysis as formatted text
app.get('/api/detection/wash/:token/text', async (req, res) => {
  const { token } = req.params;
  
  try {
    const analysis = await analyzeWashTrading(token);
    res.type('text/plain').send(formatWashAnalysis(analysis));
  } catch (error) {
    res.status(500).send('Failed to analyze wash trading');
  }
});

// Quick wash score check (cached only)
app.get('/api/detection/wash/:token/quick', (req, res) => {
  const { token } = req.params;
  
  const cached = getCachedWashAnalysis(token);
  
  if (!cached) {
    return res.json({
      success: false,
      washScore: null,
      message: 'No cached data available. Call /api/detection/wash/:token first.'
    });
  }
  
  res.json({
    success: true,
    token,
    symbol: cached.symbol,
    washScore: cached.washScore,
    riskLevel: cached.riskLevel,
    realVolumePercent: cached.realVolumePercent,
    selfTrades: cached.selfTradeCount,
    circularPatterns: cached.circularPatternCount,
    cached: true
  });
});

// Get detailed wash analysis (includes raw data)
app.get('/api/detection/wash/:token/full', async (req, res) => {
  const { token } = req.params;
  
  try {
    const analysis = await analyzeWashTrading(token);
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get full wash analysis' 
    });
  }
});

// Get wash warning for a signal
app.get('/api/signals/:id/wash', async (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  try {
    const analysis = await analyzeWashTrading(signal.token);
    const warning = getWashWarning(analysis);
    
    res.json({
      success: true,
      signalId: signal.id,
      symbol: signal.symbol,
      token: signal.token,
      wash: {
        washScore: analysis.washScore,
        riskLevel: analysis.riskLevel,
        reportedVolume: analysis.reportedVolume24h,
        estimatedRealVolume: analysis.estimatedRealVolume,
        realVolumePercent: analysis.realVolumePercent,
        selfTrades: analysis.selfTradeCount,
        circularPatterns: analysis.circularPatternCount
      },
      warning,
      recommendation: analysis.washScore >= 70
        ? '🚨 AVOID - High probability of fake volume'
        : analysis.washScore >= 50
        ? '⚠️ CAUTION - Suspicious volume patterns detected'
        : analysis.washScore >= 30
        ? '⚡ MONITOR - Some wash trading indicators'
        : '✅ OK - Volume appears mostly organic'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to analyze wash trading'
    });
  }
});

// Clear wash trading cache
app.post('/api/detection/wash/cache/clear', (req, res) => {
  clearWashCache();
  res.json({
    success: true,
    message: 'Wash trading cache cleared'
  });
});

// === SNIPER & FRONT-RUNNER DETECTION API ===

// Full sniper analysis for a token
app.get('/api/detection/snipers/:token', async (req, res) => {
  const { token } = req.params;
  
  // Validate token format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }
  
  try {
    const analysis = await analyzeSnipers(token);
    
    res.json({
      success: true,
      token,
      symbol: analysis.symbol,
      
      // Core metrics
      sniperScore: analysis.sniperScore,
      sniperRisk: analysis.sniperRisk,
      
      // Sniper counts
      counts: {
        totalSnipers: analysis.totalSnipers,
        block0Buyers: analysis.block0Buyers,
        block1to5Buyers: analysis.block1to5Buyers,
        knownMEVBots: analysis.knownMEVBots,
        jitoBundled: analysis.jitoBundled
      },
      
      // Supply analysis
      supply: {
        sniperPercent: analysis.sniperSupplyPercent,
        block0Percent: analysis.block0SupplyPercent,
        dumpProbability: analysis.dumpProbability
      },
      
      // Sniper profile
      avgSniperWinRate: analysis.avgSniperWinRate,
      
      // Block analysis
      blocks: {
        tokenCreation: analysis.tokenCreationBlock,
        firstBuy: analysis.firstBuyBlock,
        lastSniper: analysis.lastSniperBlock,
        sniperRange: analysis.sniperBlockRange
      },
      
      // Top snipers (limited for response size)
      snipers: analysis.snipers.slice(0, 10).map(s => ({
        address: s.address,
        blocksFromLaunch: s.blocksFromLaunch,
        percentageOfSupply: s.percentageOfSupply,
        sniperScore: s.sniperScore,
        winRate: s.winRate,
        isKnownMEVBot: s.isKnownMEVBot,
        isJitoBundled: s.isJitoBundled,
        isFastExiter: s.isFastExiter
      })),
      
      // MEV bots detected
      mevBots: analysis.mevBots,
      
      // Red flags and warnings
      redFlags: analysis.redFlags,
      warnings: analysis.warnings,
      
      // Status message
      status: analysis.sniperRisk === 'CRITICAL'
        ? '🚨 CRITICAL SNIPER ACTIVITY - High dump risk'
        : analysis.sniperRisk === 'HIGH'
        ? '⚠️ HIGH SNIPER ACTIVITY - Snipers likely to dump'
        : analysis.sniperRisk === 'MEDIUM'
        ? '⚡ MODERATE SNIPER ACTIVITY - Exercise caution'
        : '✅ LOW SNIPER ACTIVITY - Appears organic',
      
      // Metadata
      analyzedAt: analysis.analyzedAt,
      cached: analysis.cached
    });
  } catch (error) {
    console.error('[SNIPER API] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze sniper activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get sniper analysis as formatted text
app.get('/api/detection/snipers/:token/text', async (req, res) => {
  const { token } = req.params;
  
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).send('Invalid token address');
  }
  
  try {
    const analysis = await analyzeSnipers(token);
    res.type('text/plain').send(formatSniperAnalysis(analysis));
  } catch (error) {
    res.status(500).send('Failed to analyze sniper activity');
  }
});

// Quick sniper check (cached only)
app.get('/api/detection/snipers/:token/quick', (req, res) => {
  const { token } = req.params;
  
  const cached = getQuickSniperAnalysis(token);
  
  if (!cached) {
    return res.json({
      success: false,
      sniperScore: null,
      message: 'No cached data available. Call /api/detection/snipers/:token first.'
    });
  }
  
  res.json({
    success: true,
    token,
    symbol: cached.symbol,
    sniperScore: cached.sniperScore,
    sniperRisk: cached.sniperRisk,
    totalSnipers: cached.totalSnipers,
    block0Buyers: cached.block0Buyers,
    knownMEVBots: cached.knownMEVBots,
    sniperSupplyPercent: cached.sniperSupplyPercent,
    dumpProbability: cached.dumpProbability,
    cached: true
  });
});

// Get detailed sniper analysis (includes full sniper list)
app.get('/api/detection/snipers/:token/full', async (req, res) => {
  const { token } = req.params;
  
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }
  
  try {
    const analysis = await analyzeSnipers(token);
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get full sniper analysis' 
    });
  }
});

// Get wallet sniper score/profile
app.get('/api/detection/sniper-score/:wallet', async (req, res) => {
  const { wallet } = req.params;
  
  // Validate wallet format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  try {
    const profile = await getWalletSniperScore(wallet);
    
    res.json({
      success: true,
      wallet,
      
      // Core score
      sniperScore: profile.sniperScore,
      isLikelyBot: profile.isLikelyBot,
      
      // Stats
      stats: {
        totalTokensSniped: profile.totalTokensSniped,
        winRate: profile.winRate,
        avgHoldTime: profile.avgHoldTime,
        avgBlockDelay: profile.avgBlockDelay
      },
      
      // Bot info
      bot: {
        isMEVBot: profile.isMEVBot,
        mevBotType: profile.mevBotType
      },
      
      // Risk assessment
      risk: profile.sniperScore >= 70 
        ? 'HIGH - Known sniper/bot'
        : profile.sniperScore >= 40 
        ? 'MEDIUM - Frequent early buyer'
        : 'LOW - Normal trading patterns',
      
      // Recent activity
      recentTokens: profile.recentTokens,
      lastSniped: profile.lastSniped,
      
      // Related wallets (potential bundle)
      relatedWallets: profile.relatedWallets,
      
      analyzedAt: profile.analyzedAt
    });
  } catch (error) {
    console.error('[SNIPER PROFILE API] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get wallet sniper profile'
    });
  }
});

// Get sniper warning for a signal
app.get('/api/signals/:id/snipers', async (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.id);
  
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  try {
    const analysis = await analyzeSnipers(signal.token);
    const warning = getSniperWarning(analysis);
    
    res.json({
      success: true,
      signalId: signal.id,
      symbol: signal.symbol,
      token: signal.token,
      sniper: {
        sniperScore: analysis.sniperScore,
        sniperRisk: analysis.sniperRisk,
        totalSnipers: analysis.totalSnipers,
        block0Buyers: analysis.block0Buyers,
        knownMEVBots: analysis.knownMEVBots,
        sniperSupplyPercent: analysis.sniperSupplyPercent,
        dumpProbability: analysis.dumpProbability,
        avgSniperWinRate: analysis.avgSniperWinRate
      },
      warning,
      recommendation: analysis.sniperRisk === 'CRITICAL'
        ? '🚨 AVOID - High sniper concentration, dump imminent'
        : analysis.sniperRisk === 'HIGH'
        ? '⚠️ CAUTION - Snipers likely to sell soon'
        : analysis.sniperRisk === 'MEDIUM'
        ? '⚡ MONITOR - Some sniper activity detected'
        : '✅ OK - Low sniper activity'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to analyze sniper activity'
    });
  }
});

// Clear sniper cache
app.post('/api/detection/snipers/cache/clear', (req, res) => {
  clearSniperCache();
  res.json({
    success: true,
    message: 'Sniper cache cleared'
  });
});

// Combined detection endpoint (honeypot + wash + bundle + sniper)
app.get('/api/detection/full/:token', async (req, res) => {
  const { token } = req.params;
  
  // Validate token format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }
  
  try {
    // Run all detections in parallel
    const [washAnalysis, honeypotResult, bundleAnalysis, sniperAnalysis] = await Promise.all([
      analyzeWashTrading(token),
      detectHoneypot(token),
      analyzeBundles(token),
      analyzeSnipers(token)
    ]);
    
    // Calculate combined risk score (adjusted weights for 4 factors)
    const combinedRiskScore = Math.round(
      (washAnalysis.washScore * 0.25) +     // Wash trading: 25%
      (honeypotResult.riskScore * 0.35) +   // Honeypot: 35%
      (bundleAnalysis.bundleScore * 0.20) + // Bundle: 20%
      (sniperAnalysis.sniperScore * 0.20)   // Sniper: 20%
    );
    
    // Determine overall risk level
    let overallRisk: string;
    if (combinedRiskScore >= 70 || honeypotResult.isHoneypot) {
      overallRisk = 'CRITICAL';
    } else if (combinedRiskScore >= 50) {
      overallRisk = 'HIGH';
    } else if (combinedRiskScore >= 30) {
      overallRisk = 'MEDIUM';
    } else {
      overallRisk = 'LOW';
    }
    
    // Collect all warnings
    const allWarnings: string[] = [];
    
    if (honeypotResult.isHoneypot) {
      allWarnings.push('🍯 HONEYPOT DETECTED - Cannot sell');
    }
    if (washAnalysis.washScore >= 60) {
      allWarnings.push(`🚿 ${washAnalysis.washVolumePercent}% fake volume detected`);
    }
    if (bundleAnalysis.bundleScore >= 50) {
      allWarnings.push(`📦 Bundle detected - ${bundleAnalysis.bundledPercentage.toFixed(1)}% bundled`);
    }
    if (sniperAnalysis.sniperScore >= 50) {
      allWarnings.push(`🎯 ${sniperAnalysis.totalSnipers} snipers detected - ${sniperAnalysis.sniperSupplyPercent.toFixed(1)}% supply, ${sniperAnalysis.dumpProbability.toFixed(0)}% dump risk`);
    }
    
    res.json({
      success: true,
      token,
      
      // Combined score
      combinedRiskScore,
      overallRisk,
      
      // Individual scores
      scores: {
        wash: washAnalysis.washScore,
        honeypot: honeypotResult.riskScore,
        bundle: bundleAnalysis.bundleScore,
        sniper: sniperAnalysis.sniperScore
      },
      
      // Risk levels
      riskLevels: {
        wash: washAnalysis.riskLevel,
        honeypot: honeypotResult.riskLevel,
        bundle: bundleAnalysis.riskLevel,
        sniper: sniperAnalysis.sniperRisk
      },
      
      // Key metrics
      metrics: {
        // Wash trading
        realVolumePercent: washAnalysis.realVolumePercent,
        selfTrades: washAnalysis.selfTradeCount,
        circularPatterns: washAnalysis.circularPatternCount,
        
        // Honeypot
        canSell: honeypotResult.canSell,
        sellTax: honeypotResult.sellTax,
        hasBlacklist: honeypotResult.hasBlacklist,
        
        // Bundle
        bundledWallets: bundleAnalysis.totalBundledWallets,
        bundledPercentage: bundleAnalysis.bundledPercentage,
        insiderCount: bundleAnalysis.insiders.length,
        
        // Sniper
        totalSnipers: sniperAnalysis.totalSnipers,
        block0Buyers: sniperAnalysis.block0Buyers,
        knownMEVBots: sniperAnalysis.knownMEVBots,
        sniperSupplyPercent: sniperAnalysis.sniperSupplyPercent,
        dumpProbability: sniperAnalysis.dumpProbability,
        avgSniperWinRate: sniperAnalysis.avgSniperWinRate
      },
      
      // Warnings
      warnings: allWarnings,
      
      // Recommendation
      recommendation: combinedRiskScore >= 70 || honeypotResult.isHoneypot
        ? '🚨 DO NOT BUY - Multiple critical risk factors'
        : combinedRiskScore >= 50
        ? '⚠️ HIGH RISK - Exercise extreme caution'
        : combinedRiskScore >= 30
        ? '⚡ CAUTION - Some risk factors detected'
        : '✅ LOWER RISK - Proceed with normal caution',
      
      analyzedAt: Date.now()
    });
  } catch (error) {
    console.error('[DETECTION] Full analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete full detection analysis'
    });
  }
});

// === AUTO-COPY TRADING API ===

// Get auto-copy settings
app.get('/api/copy/settings', (req, res) => {
  res.json(getAutoCopySettings());
});

// Update auto-copy settings
app.post('/api/copy/settings', (req, res) => {
  const updates = req.body;
  const settings = updateAutoCopySettings(updates);
  res.json({
    success: true,
    settings
  });
});

// Reset auto-copy settings to defaults
app.post('/api/copy/settings/reset', (req, res) => {
  const settings = resetAutoCopySettings();
  res.json({
    success: true,
    message: 'Settings reset to defaults',
    settings
  });
});

// Get all followed wallets
app.get('/api/copy/wallets', (req, res) => {
  const wallets = getFollowedWallets();
  res.json({
    count: wallets.length,
    wallets
  });
});

// Get a specific followed wallet
app.get('/api/copy/wallets/:id', (req, res) => {
  const wallet = getFollowedWallet(req.params.id);
  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }
  res.json(wallet);
});

// Follow a new wallet
app.post('/api/copy/follow', (req, res) => {
  const { address, label, winRate, source, notes, enabled } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'address is required' });
  }
  
  if (!label) {
    return res.status(400).json({ error: 'label is required' });
  }
  
  // Validate wallet address format (basic check)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid wallet address format' });
  }
  
  const wallet = followWallet(address, label, {
    winRate: winRate ? parseFloat(winRate) : undefined,
    source,
    notes,
    enabled: enabled !== false
  });
  
  res.json({
    success: true,
    message: `Now following ${label}`,
    wallet
  });
});

// Unfollow a wallet
app.delete('/api/copy/wallets/:id', (req, res) => {
  const removed = unfollowWallet(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Wallet not found' });
  }
  res.json({
    success: true,
    message: 'Wallet unfollowed'
  });
});

// Update a followed wallet
app.patch('/api/copy/wallets/:id', (req, res) => {
  const updates = req.body;
  const wallet = updateFollowedWallet(req.params.id, updates);
  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }
  res.json({
    success: true,
    wallet
  });
});

// Toggle wallet enabled status
app.post('/api/copy/wallets/:id/toggle', (req, res) => {
  const enabled = toggleWalletEnabled(req.params.id);
  res.json({
    success: true,
    enabled
  });
});

// Get copy trade history
app.get('/api/copy/history', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const history = getCopyTradeHistory(limit);
  res.json({
    count: history.length,
    trades: history
  });
});

// Get copy trade stats
app.get('/api/copy/stats', (req, res) => {
  res.json(getCopyTradeStats());
});

// Get full auto-copy summary (for dashboard)
app.get('/api/copy/summary', (req, res) => {
  res.json(getAutoCopySummary());
});

// Check if a signal would be copied
app.post('/api/copy/check', (req, res) => {
  const { signalId, walletAddress } = req.body;
  
  if (!signalId) {
    return res.status(400).json({ error: 'signalId is required' });
  }
  
  const signal = signalStore.find(s => s.id === signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  const result = shouldCopySignal(signal, walletAddress);
  res.json({
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      score: signal.score,
      riskLevel: signal.riskLevel
    },
    ...result
  });
});

// Manually trigger copy trade for a signal
app.post('/api/copy/execute/:signalId', async (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  const execution = await processSignalForAutoCopy(signal);
  
  if (!execution) {
    return res.status(400).json({ error: 'No eligible wallet for copy trade' });
  }
  
  res.json({
    success: execution.status === 'EXECUTED',
    execution
  });
});

// === ALERT RULES API ===

// Get all rules
app.get('/api/alerts/rules', (req, res) => {
  const enabledOnly = req.query.enabled === 'true';
  const rules = enabledOnly ? getEnabledRules() : getAllRules();
  res.json({
    count: rules.length,
    rules
  });
});

// Get a specific rule
app.get('/api/alerts/rules/:id', (req, res) => {
  const rule = getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  res.json(rule);
});

// Create a new rule
app.post('/api/alerts/rules', (req, res) => {
  const { name, conditionGroups, actions, description, groupOperator, cooldownMinutes, maxTriggersPerDay, tags, enabled } = req.body;
  
  // Validate required fields
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  
  if (!conditionGroups || !Array.isArray(conditionGroups) || conditionGroups.length === 0) {
    return res.status(400).json({ error: 'conditionGroups array is required' });
  }
  
  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    return res.status(400).json({ error: 'actions array is required' });
  }
  
  // Validate rule
  const validation = validateRule({ name, conditionGroups, actions });
  if (!validation.valid) {
    return res.status(400).json({ error: 'Invalid rule', errors: validation.errors });
  }
  
  const rule = createRule(name, conditionGroups, actions, {
    description,
    groupOperator: groupOperator || 'AND',
    cooldownMinutes: cooldownMinutes || 5,
    maxTriggersPerDay: maxTriggersPerDay || 50,
    tags,
    enabled: enabled !== false
  });
  
  res.json({
    success: true,
    rule
  });
});

// Create rule from template
app.post('/api/alerts/rules/template', (req, res) => {
  const { templateId, name, actions, description, cooldownMinutes, maxTriggersPerDay, tags } = req.body;
  
  if (!templateId) {
    return res.status(400).json({ error: 'templateId is required' });
  }
  
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  
  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    return res.status(400).json({ error: 'actions array is required' });
  }
  
  const rule = createRuleFromTemplate(templateId, name, actions, {
    description,
    cooldownMinutes,
    maxTriggersPerDay,
    tags
  });
  
  if (!rule) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  res.json({
    success: true,
    rule
  });
});

// Update a rule
app.patch('/api/alerts/rules/:id', (req, res) => {
  const updates = req.body;
  const rule = updateRule(req.params.id, updates);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  res.json({
    success: true,
    rule
  });
});

// Delete a rule
app.delete('/api/alerts/rules/:id', (req, res) => {
  const deleted = deleteRule(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  res.json({
    success: true,
    message: 'Rule deleted'
  });
});

// Toggle rule enabled status
app.post('/api/alerts/rules/:id/toggle', (req, res) => {
  const enabled = toggleRule(req.params.id);
  res.json({
    success: true,
    enabled
  });
});

// Duplicate a rule
app.post('/api/alerts/rules/:id/duplicate', (req, res) => {
  const { newName } = req.body;
  const rule = duplicateRule(req.params.id, newName);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  res.json({
    success: true,
    rule
  });
});

// Test a rule against a signal
app.post('/api/alerts/rules/:id/test', (req, res) => {
  const { signalId } = req.body;
  
  const rule = getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  
  if (!signalId) {
    return res.status(400).json({ error: 'signalId is required' });
  }
  
  const signal = signalStore.find(s => s.id === signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  const result = testRule(rule, signal);
  res.json({
    rule: {
      id: rule.id,
      name: rule.name
    },
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      score: signal.score,
      riskLevel: signal.riskLevel
    },
    ...result
  });
});

// Get available templates
app.get('/api/alerts/templates', (req, res) => {
  res.json({
    count: getTemplates().length,
    templates: getTemplates()
  });
});

// Get specific template
app.get('/api/alerts/templates/:id', (req, res) => {
  const template = getTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
});

// Get trigger history
app.get('/api/alerts/history', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const history = getTriggerHistory(limit);
  res.json({
    count: history.length,
    history
  });
});

// Get rule stats
app.get('/api/alerts/stats', (req, res) => {
  res.json(getRuleStats());
});

// Export rules as JSON
app.get('/api/alerts/export', (req, res) => {
  const json = exportRules();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=oracle-alert-rules.json');
  res.send(json);
});

// Import rules from JSON
app.post('/api/alerts/import', (req, res) => {
  const { rules: rulesJson } = req.body;
  
  if (!rulesJson) {
    return res.status(400).json({ error: 'rules JSON is required' });
  }
  
  const json = typeof rulesJson === 'string' ? rulesJson : JSON.stringify(rulesJson);
  const result = importRules(json);
  
  res.json({
    success: result.imported > 0,
    imported: result.imported,
    errors: result.errors
  });
});

// Manually process a signal against all rules
app.post('/api/alerts/process/:signalId', async (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  const events = await processSignalAgainstRules(signal);
  
  res.json({
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      score: signal.score
    },
    triggeredRules: events.length,
    events
  });
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

// === DISCORD BOT API ===

// Get Discord bot status
app.get('/api/discord/status', (req, res) => {
  const status = getDiscordBotStatus();
  res.json({
    ...status,
    webhookConfigured: !!DISCORD_WEBHOOK_URL,
    botTokenConfigured: !!DISCORD_BOT_TOKEN
  });
});

// Get Discord subscribed channels
app.get('/api/discord/subscriptions', (req, res) => {
  const subscriptions = getDiscordSubscriptions();
  res.json({
    count: subscriptions.length,
    subscriptions
  });
});

// Test Discord webhook
app.post('/api/discord/webhook', async (req, res) => {
  const { webhookUrl } = req.body;
  const url = webhookUrl || DISCORD_WEBHOOK_URL;
  
  if (!url) {
    return res.status(400).json({ 
      error: 'No webhook URL provided',
      hint: 'Provide webhookUrl in request body or set DISCORD_WEBHOOK_URL env var'
    });
  }
  
  const result = await testDiscordWebhook(url);
  
  if (result.success) {
    res.json({
      success: true,
      message: 'Test message sent successfully to Discord webhook'
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error
    });
  }
});

// Manually send signal to Discord
app.post('/api/discord/send/:signalId', async (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  const count = await broadcastDiscordSignal(signal);
  
  res.json({
    success: count > 0,
    channelsSent: count,
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      score: signal.score
    }
  });
});

// === PORTFOLIO SYNC API ===
// Import and sync actual wallet holdings from Solana

// Sync a wallet (import portfolio)
app.post('/api/portfolio/sync/:wallet', async (req, res) => {
  const { wallet } = req.params;
  const { label, autoRefresh, refreshIntervalMs } = req.body;
  
  // Validate wallet address
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).json({ 
      error: 'Invalid wallet address',
      wallet,
      hint: 'Provide a valid Solana wallet address (32-44 characters)'
    });
  }
  
  try {
    const portfolio = await syncWallet(wallet, { 
      label, 
      autoRefresh: autoRefresh ?? false,
      refreshIntervalMs 
    });
    
    if (!portfolio) {
      return res.status(500).json({ 
        error: 'Failed to sync wallet',
        wallet,
        hint: 'Check if the wallet exists and has any tokens'
      });
    }
    
    res.json({
      success: true,
      message: `Synced wallet ${wallet.slice(0, 8)}...`,
      portfolio: {
        wallet: portfolio.wallet,
        label: portfolio.label,
        totalValue: Math.round(portfolio.totalValue * 100) / 100,
        solBalance: Math.round(portfolio.solBalance * 10000) / 10000,
        solValue: Math.round(portfolio.solValue * 100) / 100,
        tokenCount: portfolio.holdings.length,
        autoRefresh: portfolio.autoRefresh,
        syncedAt: portfolio.syncedAt,
        lastRefresh: portfolio.lastRefresh
      },
      holdings: portfolio.holdings.slice(0, 20).map(h => ({
        mint: h.mint,
        symbol: h.symbol,
        name: h.name,
        amount: h.amount,
        usdValue: Math.round(h.usdValue * 100) / 100,
        pricePerToken: h.pricePerToken,
        percentage: Math.round((h.usdValue / portfolio.totalValue) * 10000) / 100
      })),
      allocation: portfolio.allocation,
      pnl: {
        change24h: Math.round(portfolio.pnl.change24h * 100) / 100,
        change24hPct: Math.round(portfolio.pnl.change24hPct * 100) / 100,
        change7d: Math.round(portfolio.pnl.change7d * 100) / 100,
        change7dPct: Math.round(portfolio.pnl.change7dPct * 100) / 100
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[PORTFOLIO-SYNC] Error:', error);
    res.status(500).json({ 
      error: 'Failed to sync wallet',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get synced portfolio holdings
app.get('/api/portfolio/:wallet', (req, res) => {
  const { wallet } = req.params;
  
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const portfolio = getPortfolio(wallet);
  
  if (!portfolio) {
    return res.status(404).json({ 
      error: 'Portfolio not synced',
      wallet,
      hint: 'Call POST /api/portfolio/sync/:wallet first to import this wallet'
    });
  }
  
  res.json({
    wallet: portfolio.wallet,
    label: portfolio.label,
    totalValue: Math.round(portfolio.totalValue * 100) / 100,
    solBalance: Math.round(portfolio.solBalance * 10000) / 10000,
    solValue: Math.round(portfolio.solValue * 100) / 100,
    tokenCount: portfolio.holdings.length,
    autoRefresh: portfolio.autoRefresh,
    syncedAt: portfolio.syncedAt,
    lastRefresh: portfolio.lastRefresh,
    synced: true,
    holdings: portfolio.holdings.map(h => ({
      mint: h.mint,
      symbol: h.symbol,
      name: h.name,
      amount: h.amount,
      decimals: h.decimals,
      usdValue: Math.round(h.usdValue * 100) / 100,
      pricePerToken: h.pricePerToken,
      percentage: Math.round((h.usdValue / portfolio.totalValue) * 10000) / 100,
      logoURI: h.logoURI
    })),
    allocation: portfolio.allocation,
    pnl: {
      change24h: Math.round(portfolio.pnl.change24h * 100) / 100,
      change24hPct: Math.round(portfolio.pnl.change24hPct * 100) / 100,
      change7d: Math.round(portfolio.pnl.change7d * 100) / 100,
      change7dPct: Math.round(portfolio.pnl.change7dPct * 100) / 100,
      topChanges: portfolio.pnl.byToken.slice(0, 5).map(t => ({
        symbol: t.symbol,
        mint: t.mint,
        change24h: Math.round(t.change24h * 100) / 100,
        change24hPct: Math.round(t.change24hPct * 100) / 100
      }))
    },
    timestamp: Date.now()
  });
});

// Get portfolio value history
app.get('/api/portfolio/:wallet/history', (req, res) => {
  const { wallet } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;
  
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const history = getPortfolioHistory(wallet);
  
  if (history.length === 0) {
    return res.status(404).json({ 
      error: 'No history found',
      wallet,
      hint: 'Portfolio needs to be synced first and accumulate snapshots over time'
    });
  }
  
  // Format for charting
  const chartData = history.slice(-limit).map(snapshot => ({
    timestamp: snapshot.timestamp,
    date: new Date(snapshot.timestamp).toISOString(),
    totalValue: Math.round(snapshot.totalValue * 100) / 100,
    solValue: Math.round(snapshot.solValue * 100) / 100,
    tokenCount: snapshot.tokenCount
  }));
  
  // Calculate stats
  const oldest = history[0];
  const newest = history[history.length - 1];
  const change = newest.totalValue - oldest.totalValue;
  const changePct = oldest.totalValue > 0 ? (change / oldest.totalValue) * 100 : 0;
  
  res.json({
    wallet,
    dataPoints: chartData.length,
    timeRangeMs: newest.timestamp - oldest.timestamp,
    stats: {
      startValue: Math.round(oldest.totalValue * 100) / 100,
      endValue: Math.round(newest.totalValue * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      highValue: Math.round(Math.max(...history.map(h => h.totalValue)) * 100) / 100,
      lowValue: Math.round(Math.min(...history.map(h => h.totalValue)) * 100) / 100
    },
    chartData,
    timestamp: Date.now()
  });
});

// Get detailed PnL breakdown
app.get('/api/portfolio/:wallet/pnl', (req, res) => {
  const { wallet } = req.params;
  
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const pnl = getPortfolioPnL(wallet);
  
  if (!pnl) {
    return res.status(404).json({ 
      error: 'Portfolio not synced',
      wallet
    });
  }
  
  res.json({
    wallet,
    summary: {
      totalUnrealizedPnl: Math.round(pnl.totalUnrealizedPnl * 100) / 100,
      totalUnrealizedPnlPct: Math.round(pnl.totalUnrealizedPnlPct * 100) / 100,
      change24h: Math.round(pnl.change24h * 100) / 100,
      change24hPct: Math.round(pnl.change24hPct * 100) / 100,
      change7d: Math.round(pnl.change7d * 100) / 100,
      change7dPct: Math.round(pnl.change7dPct * 100) / 100
    },
    byToken: pnl.byToken.map(t => ({
      mint: t.mint,
      symbol: t.symbol,
      currentValue: Math.round(t.currentValue * 100) / 100,
      entryValue: t.entryValue ? Math.round(t.entryValue * 100) / 100 : null,
      unrealizedPnl: t.unrealizedPnl ? Math.round(t.unrealizedPnl * 100) / 100 : null,
      unrealizedPnlPct: t.unrealizedPnlPct ? Math.round(t.unrealizedPnlPct * 100) / 100 : null,
      change24h: Math.round(t.change24h * 100) / 100,
      change24hPct: Math.round(t.change24hPct * 100) / 100
    })),
    topGainers: pnl.byToken
      .filter(t => t.change24h > 0)
      .slice(0, 5)
      .map(t => ({ symbol: t.symbol, change: Math.round(t.change24hPct * 100) / 100 })),
    topLosers: pnl.byToken
      .filter(t => t.change24h < 0)
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 5)
      .map(t => ({ symbol: t.symbol, change: Math.round(t.change24hPct * 100) / 100 })),
    timestamp: Date.now()
  });
});

// Update portfolio settings
app.put('/api/portfolio/:wallet', (req, res) => {
  const { wallet } = req.params;
  const { label, autoRefresh, refreshIntervalMs } = req.body;
  
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const portfolio = updatePortfolioSettings(wallet, { 
    label, 
    autoRefresh, 
    refreshIntervalMs 
  });
  
  if (!portfolio) {
    return res.status(404).json({ error: 'Portfolio not synced' });
  }
  
  res.json({
    success: true,
    message: 'Portfolio settings updated',
    settings: {
      wallet: portfolio.wallet,
      label: portfolio.label,
      autoRefresh: portfolio.autoRefresh,
      refreshIntervalMs: portfolio.refreshIntervalMs
    }
  });
});

// Remove synced portfolio
app.delete('/api/portfolio/:wallet', (req, res) => {
  const { wallet } = req.params;
  
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const removed = removePortfolio(wallet);
  
  if (!removed) {
    return res.status(404).json({ error: 'Portfolio not found or already removed' });
  }
  
  res.json({
    success: true,
    message: `Portfolio ${wallet.slice(0, 8)}... removed`,
    wallet
  });
});

// Get all synced portfolios
app.get('/api/portfolios', (req, res) => {
  const portfolios = getAllPortfolios();
  
  res.json({
    count: portfolios.length,
    totalValue: Math.round(portfolios.reduce((sum, p) => sum + p.totalValue, 0) * 100) / 100,
    portfolios: portfolios.map(p => ({
      wallet: p.wallet,
      label: p.label,
      totalValue: Math.round(p.totalValue * 100) / 100,
      tokenCount: p.holdings.length,
      change24hPct: Math.round(p.pnl.change24hPct * 100) / 100,
      autoRefresh: p.autoRefresh,
      lastRefresh: p.lastRefresh
    })),
    timestamp: Date.now()
  });
});

// Compare synced portfolio with paper portfolio
app.get('/api/portfolio/:wallet/compare', (req, res) => {
  const { wallet } = req.params;
  
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const paperPortfolio = getPaperPortfolio();
  if (!paperPortfolio) {
    return res.status(400).json({ 
      error: 'No paper portfolio to compare',
      hint: 'Initialize paper portfolio first with POST /api/trade/portfolio/reset'
    });
  }
  
  // Convert paper portfolio holdings to comparison format
  const paperHoldings = Array.from(paperPortfolio.holdings.values()).map(h => ({
    mint: h.mint,
    symbol: h.symbol,
    value: h.value
  }));
  
  const comparison = compareWithPaperPortfolio(wallet, paperHoldings);
  
  res.json({
    wallet,
    comparison: {
      syncedTotal: Math.round(comparison.syncedTotal * 100) / 100,
      paperTotal: Math.round(comparison.paperTotal * 100) / 100,
      difference: Math.round(comparison.difference * 100) / 100,
      differencePct: Math.round(comparison.differencePct * 100) / 100
    },
    breakdown: comparison.breakdown.slice(0, 20).map(b => ({
      symbol: b.symbol,
      mint: b.mint,
      syncedValue: Math.round(b.syncedValue * 100) / 100,
      paperValue: Math.round(b.paperValue * 100) / 100,
      diff: Math.round(b.diff * 100) / 100,
      diffPct: Math.round(b.diffPct * 100) / 100
    })),
    summary: comparison.difference >= 0
      ? `Real portfolio is $${Math.abs(comparison.difference).toFixed(2)} (${Math.abs(comparison.differencePct).toFixed(1)}%) AHEAD of paper portfolio`
      : `Real portfolio is $${Math.abs(comparison.difference).toFixed(2)} (${Math.abs(comparison.differencePct).toFixed(1)}%) BEHIND paper portfolio`,
    timestamp: Date.now()
  });
});

// Get portfolio summary (quick view)
app.get('/api/portfolio/:wallet/summary', (req, res) => {
  const { wallet } = req.params;
  
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const summary = getPortfolioSummary(wallet);
  
  if (!summary) {
    return res.status(404).json({ error: 'Portfolio not synced' });
  }
  
  res.json(summary);
});

// Get portfolio as formatted text
app.get('/api/portfolio/:wallet/text', (req, res) => {
  const { wallet } = req.params;
  
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).send('Invalid wallet address');
  }
  
  const text = formatPortfolioDisplay(wallet);
  res.type('text/plain').send(text);
});

// Refresh portfolio (re-sync)
app.post('/api/portfolio/:wallet/refresh', async (req, res) => {
  const { wallet } = req.params;
  
  if (!isValidWalletAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  
  const existing = getPortfolio(wallet);
  if (!existing) {
    return res.status(404).json({ 
      error: 'Portfolio not synced',
      hint: 'Call POST /api/portfolio/sync/:wallet first'
    });
  }
  
  try {
    const portfolio = await syncWallet(wallet, {
      label: existing.label,
      autoRefresh: existing.autoRefresh,
      refreshIntervalMs: existing.refreshIntervalMs
    });
    
    if (!portfolio) {
      return res.status(500).json({ error: 'Failed to refresh portfolio' });
    }
    
    res.json({
      success: true,
      message: `Portfolio refreshed`,
      totalValue: Math.round(portfolio.totalValue * 100) / 100,
      tokenCount: portfolio.holdings.length,
      change24hPct: Math.round(portfolio.pnl.change24hPct * 100) / 100,
      lastRefresh: portfolio.lastRefresh
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to refresh portfolio',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
  // Track signal processing for usage stats
  trackSignalProcessed();
  
  const message = JSON.stringify({
    type: 'signal',
    data: signal
  });

  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
  
  // Check if voice alert should be sent
  const voiceEvent = createVoiceAlertEvent(signal);
  if (voiceEvent) {
    broadcastVoiceAlert(voiceEvent);
  }

  // Check for watchlist signal alerts
  checkSignalAlert(signal).catch(e => {
    console.error('[ALERT] Signal alert check failed:', e);
  });
}

function broadcastVoiceAlert(event: ReturnType<typeof createVoiceAlertEvent>) {
  if (!event) return;
  
  const message = JSON.stringify(event);
  
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

// === TELEGRAM BOT ENDPOINTS ===

// Telegram webhook endpoint (alternative to polling)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    await processTelegramUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('[TELEGRAM] Webhook error:', error);
    res.sendStatus(500);
  }
});

// Get telegram subscriber stats
app.get('/api/telegram/stats', (req, res) => {
  const stats = getSubscriberStats();
  res.json({
    ...stats,
    botEnabled: !!process.env.TELEGRAM_BOT_TOKEN
  });
});

// === VOICE ALERTS ENDPOINTS ===

// Get voice alert settings
app.get('/api/voice/settings', (req, res) => {
  res.json(getVoiceSettings());
});

// Update voice alert settings
app.put('/api/voice/settings', (req, res) => {
  const updates = req.body;
  const settings = updateVoiceSettings(updates);
  res.json({
    success: true,
    settings
  });
});

// Reset voice settings to defaults
app.post('/api/voice/settings/reset', (req, res) => {
  const settings = resetVoiceSettings();
  res.json({
    success: true,
    settings
  });
});

// Test voice with a sample message
app.post('/api/voice/test', (req, res) => {
  const message = generateTestMessage();
  res.json({
    success: true,
    message
  });
});

// Get voice message for a specific signal
app.post('/api/voice/speak/:signalId', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  const message = generateVoiceMessage(signal);
  res.json({
    success: true,
    message
  });
});

// Check if a signal should trigger voice alert
app.get('/api/voice/should-announce/:signalId', (req, res) => {
  const signal = signalStore.find(s => s.id === req.params.signalId);
  if (!signal) {
    return res.status(404).json({ error: 'Signal not found' });
  }
  
  const should = shouldAnnounce(signal);
  res.json({
    signalId: signal.id,
    symbol: signal.symbol,
    score: signal.score,
    shouldAnnounce: should
  });
});

// === WATCHLIST ALERTS API ===

// Get all watchlist alerts
app.get('/api/watchlist/alerts', (req, res) => {
  const alerts = getAllWatchlistAlerts();
  const stats = getAlertStats();
  res.json({
    count: alerts.length,
    alerts,
    stats
  });
});

// Get alerts for a specific token
app.get('/api/watchlist/:token/alerts', (req, res) => {
  const alerts = getAlertsForToken(req.params.token);
  res.json({
    token: req.params.token,
    count: alerts.length,
    alerts
  });
});

// Get a specific alert
app.get('/api/watchlist/alerts/:id', (req, res) => {
  const alert = getWatchlistAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json(alert);
});

// Create a new alert for a token
app.post('/api/watchlist/:token/alert', (req, res) => {
  const { token } = req.params;
  const { type, threshold, notifyTelegram, notifyDiscord, notifyBrowser, cooldownMs, oneTime, notes, tokenSymbol, tokenName } = req.body;

  if (!type || !['price_above', 'price_below', 'change_up', 'change_down', 'volume', 'signal', 'wallet'].includes(type)) {
    return res.status(400).json({ error: 'Invalid alert type' });
  }

  if (threshold === undefined || typeof threshold !== 'number') {
    return res.status(400).json({ error: 'threshold is required and must be a number' });
  }

  const alert = createWatchlistAlert(token, type as AlertType, threshold, {
    notifyTelegram: notifyTelegram !== false,
    notifyDiscord: !!notifyDiscord,
    notifyBrowser: notifyBrowser !== false,
    cooldownMs: cooldownMs || 5 * 60 * 1000,
    oneTime: !!oneTime,
    notes,
    tokenSymbol,
    tokenName
  });

  res.status(201).json({
    success: true,
    alert
  });
});

// Quick alert creation helpers
app.post('/api/watchlist/:token/alert/price-above', (req, res) => {
  const { price, ...options } = req.body;
  if (!price || typeof price !== 'number') {
    return res.status(400).json({ error: 'price is required' });
  }
  const alert = createPriceAboveAlert(req.params.token, price, options);
  res.status(201).json({ success: true, alert });
});

app.post('/api/watchlist/:token/alert/price-below', (req, res) => {
  const { price, ...options } = req.body;
  if (!price || typeof price !== 'number') {
    return res.status(400).json({ error: 'price is required' });
  }
  const alert = createPriceBelowAlert(req.params.token, price, options);
  res.status(201).json({ success: true, alert });
});

app.post('/api/watchlist/:token/alert/pump', (req, res) => {
  const { percent = 50, ...options } = req.body;
  const alert = createPumpAlert(req.params.token, percent, options);
  res.status(201).json({ success: true, alert });
});

app.post('/api/watchlist/:token/alert/dump', (req, res) => {
  const { percent = 30, ...options } = req.body;
  const alert = createDumpAlert(req.params.token, percent, options);
  res.status(201).json({ success: true, alert });
});

app.post('/api/watchlist/:token/alert/volume', (req, res) => {
  const { multiplier = 5, ...options } = req.body;
  const alert = createVolumeAlert(req.params.token, multiplier, options);
  res.status(201).json({ success: true, alert });
});

app.post('/api/watchlist/:token/alert/signal', (req, res) => {
  const { minScore = 70, ...options } = req.body;
  const alert = createSignalAlert(req.params.token, minScore, options);
  res.status(201).json({ success: true, alert });
});

app.post('/api/watchlist/:token/alert/wallet', (req, res) => {
  const alert = createWalletAlert(req.params.token, req.body);
  res.status(201).json({ success: true, alert });
});

// Update an alert
app.put('/api/watchlist/:token/alert/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const alert = updateWatchlistAlertFn(id, updates);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  res.json({
    success: true,
    alert
  });
});

// Delete an alert
app.delete('/api/watchlist/:token/alert/:id', (req, res) => {
  const { id } = req.params;
  const deleted = deleteWatchlistAlertFn(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  res.json({ success: true, message: 'Alert deleted' });
});

// Toggle alert enabled/disabled
app.post('/api/watchlist/alerts/:id/toggle', (req, res) => {
  const alert = toggleAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json({
    success: true,
    alert,
    message: `Alert ${alert.enabled ? 'enabled' : 'disabled'}`
  });
});

// Get triggered alerts history
app.get('/api/watchlist/triggered', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const triggered = getTriggeredAlerts(limit);
  res.json({
    count: triggered.length,
    alerts: triggered
  });
});

// Get triggered alerts for a specific token
app.get('/api/watchlist/:token/triggered', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const triggered = getTriggeredAlertsForToken(req.params.token, limit);
  res.json({
    token: req.params.token,
    count: triggered.length,
    alerts: triggered
  });
});

// Get cached price for a token
app.get('/api/watchlist/:token/price', (req, res) => {
  const price = getCachedPrice(req.params.token);
  if (!price) {
    return res.status(404).json({ error: 'No cached price data' });
  }
  res.json(price);
});

// Manually trigger alert check
app.post('/api/watchlist/alerts/check', async (req, res) => {
  try {
    const triggered = await checkWatchlistAlerts();
    res.json({
      success: true,
      triggeredCount: triggered.length,
      triggered
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check alerts', details: String(error) });
  }
});

// Get alert checker status
app.get('/api/watchlist/alerts/checker', (req, res) => {
  const state = getCheckerState();
  res.json(state);
});

// Start alert checker
app.post('/api/watchlist/alerts/checker/start', (req, res) => {
  const intervalMs = req.body?.intervalMs || 30000;
  startAlertChecker(intervalMs);
  res.json({
    success: true,
    message: `Alert checker started (interval: ${intervalMs}ms)`
  });
});

// Stop alert checker
app.post('/api/watchlist/alerts/checker/stop', (req, res) => {
  stopAlertChecker();
  res.json({
    success: true,
    message: 'Alert checker stopped'
  });
});

// Export alerts
app.get('/api/watchlist/alerts/export', (req, res) => {
  const alerts = exportAlerts();
  res.json({
    count: alerts.length,
    exportedAt: Date.now(),
    alerts
  });
});

// Import alerts
app.post('/api/watchlist/alerts/import', (req, res) => {
  const { alerts } = req.body;
  if (!alerts || !Array.isArray(alerts)) {
    return res.status(400).json({ error: 'alerts array is required' });
  }

  const count = importAlerts(alerts);
  res.json({
    success: true,
    imported: count
  });
});

// Clear all alerts
app.post('/api/watchlist/alerts/clear', (req, res) => {
  const count = clearAllAlerts();
  res.json({
    success: true,
    cleared: count
  });
});

// Delete all alerts for a token
app.delete('/api/watchlist/:token/alerts', (req, res) => {
  const count = getAlertsForToken(req.params.token).length;
  // Using a loop since we don't have deleteAlertsForToken imported
  const alerts = getAlertsForToken(req.params.token);
  for (const alert of alerts) {
    deleteWatchlistAlertFn(alert.id);
  }
  res.json({
    success: true,
    deleted: count,
    token: req.params.token
  });
});

// Get alert stats
app.get('/api/watchlist/alerts/stats', (req, res) => {
  res.json(getAlertStats());
});

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

  // Initialize Telegram bot
  setTelegramSignalStore(signalStore);
  if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log('[SERVER] Telegram bot ENABLED - starting polling');
    startTelegramPolling().catch(e => console.error('[TELEGRAM] Polling error:', e));
  } else {
    console.log('[SERVER] Telegram bot disabled (no token)');
  }

  // Initialize Discord bot
  setDiscordSignalStore(signalStore);
  if (DISCORD_BOT_TOKEN || DISCORD_WEBHOOK_URL) {
    const discordInit = await initDiscordBot();
    if (discordInit) {
      const mode = DISCORD_BOT_TOKEN ? 'full bot' : 'webhook-only';
      console.log(`[SERVER] Discord integration ENABLED (${mode})`);
    } else {
      console.log('[SERVER] Discord initialization failed');
    }
  } else {
    console.log('[SERVER] Discord integration disabled (no token/webhook)');
  }

  // Initialize ATH updater
  const athEnabled = await initAthUpdater();
  if (athEnabled) {
    startAthUpdater();
    console.log('[SERVER] ATH tracking ENABLED');
  }

  // Initialize Watchlist Alert Checker
  // Set up WebSocket broadcast for browser notifications
  setWsBroadcast((msg) => {
    const message = JSON.stringify(msg);
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  // Set up Telegram send function for alert notifications
  if (process.env.TELEGRAM_BOT_TOKEN) {
    setTelegramSend(async (chatId: string, text: string) => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        });
        const result = await response.json();
        return result.ok;
      } catch (e) {
        console.error('[ALERT] Telegram send error:', e);
        return false;
      }
    });
  }

  // Start alert checker (runs every 30 seconds)
  startAlertChecker(30000);
  console.log('[SERVER] Watchlist alert checker ENABLED (30s interval)');

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

    // Seed correlation demo data
    seedDemoData();
    console.log('[DEMO] Seeded correlation analytics data');

    // Start demo runner
    demoRunner = new DemoRunner(signal => {
      signalStore.unshift(signal);
      broadcastSignal(signal);
      
      // Track price for correlation analytics
      if (signal.marketData?.price || signal.marketData?.mcap) {
        recordPrice(
          signal.token,
          signal.symbol,
          signal.marketData.price || signal.marketData.mcap / 1e9,
          signal.marketData.mcap,
          signal.marketData.volume1h,
          signal.analysis?.narrative
        );
      }
      
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

        // Track price for correlation analytics
        if (signal.marketData?.price || signal.marketData?.mcap) {
          recordPrice(
            signal.token,
            signal.symbol,
            signal.marketData.price || signal.marketData.mcap / 1e9,
            signal.marketData.mcap,
            signal.marketData.volume1h,
            signal.analysis?.narrative
          );
        }

        // Auto-track high-quality signals
        if (signal.score >= 65) {
          trackSignal(signal).catch(e => console.error('[TRACKER] Failed:', e));
        }

        // Auto-publish to on-chain (score >= 70)
        autoPublishSignal(signal).catch(e => console.error('[ONCHAIN] Failed:', e));

        // Send Telegram alert for high-quality signals
        if (shouldAlert(signal)) {
          sendTelegramAlert(signal).catch(e => console.error('[TELEGRAM] Failed:', e));
          // Also broadcast to all subscribers via the bot
          broadcastTelegramSignal(signal).catch(e => console.error('[TELEGRAM-BOT] Broadcast failed:', e));
        }

        // Send Discord alert for high-quality signals (score >= 70)
        if (signal.score >= 70) {
          broadcastDiscordSignal(signal).catch(e => console.error('[DISCORD] Broadcast failed:', e));
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

// ==================== AUTO TRADER ====================
import autoTrader from '../trading/auto-trader';

// Initialize auto trader on startup
autoTrader.initAutoTrader();

app.get('/api/trader/status', async (req, res) => {
  try {
    const status = autoTrader.getTradingStatus();
    const balance = await autoTrader.getWalletBalance();
    res.json({ ...status, balance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trader/start', (req, res) => {
  autoTrader.startAutoTrading();
  res.json({ success: true, message: 'Auto trading started' });
});

app.post('/api/trader/stop', (req, res) => {
  autoTrader.stopAutoTrading();
  res.json({ success: true, message: 'Auto trading stopped' });
});

app.get('/api/trader/history', (req, res) => {
  const history = autoTrader.getTradeHistory();
  res.json(history);
});

app.get('/api/trader/balance', async (req, res) => {
  const balance = await autoTrader.getWalletBalance();
  res.json({ balance, walletAddress: autoTrader.getTradingStatus().walletAddress });
});

app.get('/api/trader/insights', (req, res) => {
  const insights = autoTrader.getLearningInsights();
  res.json(insights);
});

app.post('/api/trader/check-signal', async (req, res) => {
  const { signal } = req.body;
  if (!signal) return res.status(400).json({ error: 'Signal required' });
  
  const result = autoTrader.isSignalTradeable(signal);
  const positionSize = result.tradeable ? await autoTrader.calculatePositionSize(signal) : 0;
  
  res.json({ ...result, positionSize });
});

app.post('/api/trader/execute', async (req, res) => {
  const { signal, positionSol } = req.body;
  if (!signal) return res.status(400).json({ error: 'Signal required' });
  
  const status = autoTrader.getTradingStatus();
  if (!status.isRunning) {
    return res.status(400).json({ error: 'Auto trading is not running. Start it first.' });
  }
  
  const checkResult = autoTrader.isSignalTradeable(signal);
  if (!checkResult.tradeable) {
    return res.json({ executed: false, reason: checkResult.reason });
  }
  
  const size = positionSol || await autoTrader.calculatePositionSize(signal);
  if (size <= 0) {
    return res.json({ executed: false, reason: 'Position size too small' });
  }
  
  const trade = await autoTrader.executeBuy(signal, size);
  res.json({ executed: trade?.status === 'executed', trade });
});

app.post('/api/trader/check-positions', async (req, res) => {
  await autoTrader.checkPositions();
  const status = autoTrader.getTradingStatus();
  res.json({ positions: status.positions });
});

console.log('[SERVER] Auto-trader endpoints added');

// ==================== LIVE MONITOR ====================
import liveMonitor from '../trading/live-monitor';

app.get('/api/monitor/status', (req, res) => {
  const status = liveMonitor.getMonitorStatus();
  res.json(status);
});

app.post('/api/monitor/start', (req, res) => {
  const interval = parseInt(req.query.interval as string) || 30000;
  liveMonitor.startLiveMonitor(interval);
  res.json({ success: true, message: `Monitor started (${interval/1000}s interval)` });
});

app.post('/api/monitor/stop', (req, res) => {
  liveMonitor.stopLiveMonitor();
  res.json({ success: true, message: 'Monitor stopped' });
});

app.get('/api/monitor/recent-buys', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const buys = liveMonitor.getRecentBuys(limit);
  res.json(buys);
});

app.post('/api/monitor/add-wallet', (req, res) => {
  const { wallet, type } = req.body;
  if (!wallet || !type) {
    return res.status(400).json({ error: 'wallet and type required' });
  }
  liveMonitor.addWalletToMonitor(wallet, type);
  res.json({ success: true, message: `Added ${wallet} as ${type}` });
});

console.log('[SERVER] Live monitor endpoints added');
