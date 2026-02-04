/**
 * Token Correlation & Analytics Module
 * Tracks price movements, calculates correlations, and identifies patterns
 */

import { AggregatedSignal, SignalSource } from '../types';

// ============ TYPES ============

// Price history point
export interface PricePoint {
  timestamp: number;
  price: number;
  mcap: number;
  volume?: number;
}

// Token price tracking
export interface TokenTracking {
  token: string;
  symbol: string;
  priceHistory: PricePoint[];
  sector?: string[];
  narrative?: string[];
  firstSeen: number;
  lastUpdate: number;
}

// Correlation result between two tokens
export interface CorrelationResult {
  tokenA: string;
  tokenB: string;
  symbolA: string;
  symbolB: string;
  coefficient: number; // -1 to 1
  strength: 'strong-positive' | 'moderate-positive' | 'weak' | 'moderate-negative' | 'strong-negative';
  sampleSize: number;
  lagMinutes?: number; // If A leads B by X minutes
  confidence: number;
}

// Sector correlation
export interface SectorCorrelation {
  sector: string;
  tokens: string[];
  avgCorrelation: number;
  leadingTokens: { token: string; symbol: string; leadScore: number }[];
  performance24h: number;
}

// Lead/Lag analysis result
export interface LeadLagResult {
  leader: { token: string; symbol: string };
  follower: { token: string; symbol: string };
  lagMinutes: number;
  correlation: number;
  confidence: number;
  pattern: string;
}

// Related token suggestion
export interface RelatedToken {
  token: string;
  symbol: string;
  correlation: number;
  sector: string[];
  narrative: string[];
  relationship: 'same-sector' | 'correlated' | 'follows' | 'leads';
  confidence: number;
}

// Trade record for PnL tracking
export interface TradeRecord {
  id: string;
  signalId: string;
  token: string;
  symbol: string;
  source: SignalSource;
  entryTime: number;
  entryPrice: number;
  entryMcap: number;
  exitTime?: number;
  exitPrice?: number;
  exitMcap?: number;
  pnl?: number;
  pnlPercent?: number;
  status: 'open' | 'win' | 'loss';
  peakPrice?: number;
  peakPnlPercent?: number;
  holdingTimeMinutes?: number;
}

// Performance stats
export interface PerformanceStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnlPercent: number;
  bestTrade: TradeRecord | null;
  worstTrade: TradeRecord | null;
  avgHoldingTime: number;
  profitFactor: number;
  sharpeRatio: number;
}

// Hourly performance
export interface HourlyPerformance {
  hour: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
}

// Source performance breakdown
export interface SourcePnLStats {
  source: SignalSource;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  bestTrade: number;
  worstTrade: number;
}

// PnL chart data
export interface PnLChartData {
  timestamp: number;
  date: string;
  cumulativePnl: number;
  dailyPnl: number;
  tradeCount: number;
  winRate: number;
}

// ============ IN-MEMORY STORES ============

// Token price tracking
const tokenPriceHistory = new Map<string, TokenTracking>();

// Trade history
const tradeHistory: TradeRecord[] = [];

// Sector definitions
const SECTORS: Record<string, string[]> = {
  'AI': ['GPT', 'NEURAL', 'BRAIN', 'COGN', 'DEEP', 'LEARN', 'CHAT', 'BOT', 'AGENT', 'LLM'],
  'MEME': ['DOGE', 'PEPE', 'WOJAK', 'CHAD', 'BASED', 'MOON', 'APE', 'BONK', 'WIF', 'CAT'],
  'DEFI': ['SWAP', 'YIELD', 'STAKE', 'LEND', 'BORROW', 'FARM', 'VAULT', 'POOL', 'DEX'],
  'GAMING': ['GAME', 'PLAY', 'NFT', 'GUILD', 'META', 'PIXEL', 'ARCADE', 'QUEST'],
  'INFRA': ['SOL', 'CHAIN', 'BRIDGE', 'ORACLE', 'NODE', 'LAYER', 'SCALE', 'GAS'],
  'SOCIAL': ['SOCIAL', 'FREN', 'FRIEND', 'COMMUNITY', 'DAO', 'VOTE', 'GOVERNANCE']
};

// Narrative keywords
const NARRATIVES: Record<string, string[]> = {
  'pump.fun': ['pump', 'fun', 'bonding'],
  'new-meta': ['meta', 'trend', 'viral', 'trending'],
  'kol-mentioned': ['kol', 'influencer', 'shill'],
  'whale-activity': ['whale', 'accumulation', 'smart-money'],
  'volume-surge': ['volume', 'spike', 'pump'],
  'dex-listing': ['raydium', 'orca', 'jupiter', 'listing']
};

// ============ PRICE TRACKING ============

/**
 * Record a price point for a token
 */
export function recordPrice(
  token: string,
  symbol: string,
  price: number,
  mcap: number,
  volume?: number,
  narratives?: string[]
): void {
  const existing = tokenPriceHistory.get(token);
  const now = Date.now();

  const point: PricePoint = {
    timestamp: now,
    price,
    mcap,
    volume
  };

  // Detect sector from symbol
  const detectedSectors = detectSector(symbol);
  const detectedNarratives = narratives || [];

  if (existing) {
    existing.priceHistory.push(point);
    existing.lastUpdate = now;
    
    // Keep only last 24 hours of data
    const cutoff = now - 24 * 60 * 60 * 1000;
    existing.priceHistory = existing.priceHistory.filter(p => p.timestamp >= cutoff);
    
    // Merge narratives
    for (const n of detectedNarratives) {
      if (!existing.narrative?.includes(n)) {
        existing.narrative = existing.narrative || [];
        existing.narrative.push(n);
      }
    }
  } else {
    tokenPriceHistory.set(token, {
      token,
      symbol,
      priceHistory: [point],
      sector: detectedSectors,
      narrative: detectedNarratives,
      firstSeen: now,
      lastUpdate: now
    });
  }
}

/**
 * Auto-detect sector from symbol name
 */
function detectSector(symbol: string): string[] {
  const upper = symbol.toUpperCase();
  const detected: string[] = [];

  for (const [sector, keywords] of Object.entries(SECTORS)) {
    for (const keyword of keywords) {
      if (upper.includes(keyword)) {
        if (!detected.includes(sector)) {
          detected.push(sector);
        }
        break;
      }
    }
  }

  return detected.length > 0 ? detected : ['OTHER'];
}

/**
 * Get price history for a token
 */
export function getPriceHistory(token: string): PricePoint[] {
  return tokenPriceHistory.get(token)?.priceHistory || [];
}

// ============ CORRELATION CALCULATION ============

/**
 * Calculate Pearson correlation coefficient between two price series
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;

  const xSlice = x.slice(-n);
  const ySlice = y.slice(-n);

  const meanX = xSlice.reduce((a, b) => a + b, 0) / n;
  const meanY = ySlice.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX;
    const dy = ySlice[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Get correlation strength label
 */
function getCorrelationStrength(
  coef: number
): 'strong-positive' | 'moderate-positive' | 'weak' | 'moderate-negative' | 'strong-negative' {
  if (coef >= 0.7) return 'strong-positive';
  if (coef >= 0.4) return 'moderate-positive';
  if (coef <= -0.7) return 'strong-negative';
  if (coef <= -0.4) return 'moderate-negative';
  return 'weak';
}

/**
 * Calculate correlation between two tokens
 */
export function calculateCorrelation(tokenA: string, tokenB: string): CorrelationResult | null {
  const historyA = tokenPriceHistory.get(tokenA);
  const historyB = tokenPriceHistory.get(tokenB);

  if (!historyA || !historyB) return null;
  if (historyA.priceHistory.length < 5 || historyB.priceHistory.length < 5) return null;

  // Align timestamps (resample to 5-minute intervals)
  const interval = 5 * 60 * 1000; // 5 minutes
  const alignedA: number[] = [];
  const alignedB: number[] = [];

  const startTime = Math.max(
    historyA.priceHistory[0].timestamp,
    historyB.priceHistory[0].timestamp
  );
  const endTime = Math.min(
    historyA.priceHistory[historyA.priceHistory.length - 1].timestamp,
    historyB.priceHistory[historyB.priceHistory.length - 1].timestamp
  );

  for (let t = startTime; t <= endTime; t += interval) {
    const pointA = findClosestPrice(historyA.priceHistory, t);
    const pointB = findClosestPrice(historyB.priceHistory, t);

    if (pointA !== null && pointB !== null) {
      alignedA.push(pointA);
      alignedB.push(pointB);
    }
  }

  if (alignedA.length < 5) return null;

  const coefficient = pearsonCorrelation(alignedA, alignedB);

  return {
    tokenA,
    tokenB,
    symbolA: historyA.symbol,
    symbolB: historyB.symbol,
    coefficient,
    strength: getCorrelationStrength(coefficient),
    sampleSize: alignedA.length,
    confidence: Math.min(100, alignedA.length * 2)
  };
}

/**
 * Find closest price to a timestamp
 */
function findClosestPrice(history: PricePoint[], timestamp: number): number | null {
  let closest: PricePoint | null = null;
  let minDiff = Infinity;

  for (const point of history) {
    const diff = Math.abs(point.timestamp - timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  // Only use if within 10 minutes
  if (closest && minDiff <= 10 * 60 * 1000) {
    return closest.price;
  }
  return null;
}

/**
 * Get all correlated tokens for a given token
 */
export function getCorrelatedTokens(token: string, minCorrelation = 0.4): CorrelationResult[] {
  const results: CorrelationResult[] = [];
  const sourceHistory = tokenPriceHistory.get(token);

  if (!sourceHistory) return results;

  for (const [otherToken] of tokenPriceHistory) {
    if (otherToken === token) continue;

    const correlation = calculateCorrelation(token, otherToken);
    if (correlation && Math.abs(correlation.coefficient) >= minCorrelation) {
      results.push(correlation);
    }
  }

  // Sort by correlation strength
  return results.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
}

// ============ LEAD/LAG ANALYSIS ============

/**
 * Analyze lead/lag relationship between two tokens
 */
export function analyzeLeadLag(tokenA: string, tokenB: string, maxLagMinutes = 60): LeadLagResult | null {
  const historyA = tokenPriceHistory.get(tokenA);
  const historyB = tokenPriceHistory.get(tokenB);

  if (!historyA || !historyB) return null;
  if (historyA.priceHistory.length < 10 || historyB.priceHistory.length < 10) return null;

  // Calculate returns (price changes)
  const returnsA = calculateReturns(historyA.priceHistory);
  const returnsB = calculateReturns(historyB.priceHistory);

  if (returnsA.length < 5 || returnsB.length < 5) return null;

  // Test different lag values
  let bestLag = 0;
  let bestCorrelation = pearsonCorrelation(returnsA, returnsB);

  const lagSteps = [5, 10, 15, 30, 45, 60]; // Minutes

  for (const lag of lagSteps) {
    if (lag > maxLagMinutes) break;

    // A leads B (shift B forward)
    const shiftedReturnsB = shiftReturns(returnsB, lag);
    const corrALeads = pearsonCorrelation(returnsA, shiftedReturnsB);

    if (corrALeads > bestCorrelation) {
      bestCorrelation = corrALeads;
      bestLag = lag;
    }

    // B leads A (shift A forward)
    const shiftedReturnsA = shiftReturns(returnsA, lag);
    const corrBLeads = pearsonCorrelation(shiftedReturnsA, returnsB);

    if (corrBLeads > bestCorrelation) {
      bestCorrelation = corrBLeads;
      bestLag = -lag;
    }
  }

  if (Math.abs(bestCorrelation) < 0.3) return null;

  const isALeader = bestLag > 0;

  return {
    leader: isALeader
      ? { token: tokenA, symbol: historyA.symbol }
      : { token: tokenB, symbol: historyB.symbol },
    follower: isALeader
      ? { token: tokenB, symbol: historyB.symbol }
      : { token: tokenA, symbol: historyA.symbol },
    lagMinutes: Math.abs(bestLag),
    correlation: bestCorrelation,
    confidence: Math.min(100, returnsA.length * 3),
    pattern: `${isALeader ? historyA.symbol : historyB.symbol} moves first, ${isALeader ? historyB.symbol : historyA.symbol} follows ~${Math.abs(bestLag)}min later`
  };
}

/**
 * Calculate price returns (percentage changes)
 */
function calculateReturns(history: PricePoint[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1].price > 0) {
      returns.push((history[i].price - history[i - 1].price) / history[i - 1].price);
    }
  }
  return returns;
}

/**
 * Shift returns array by N periods
 */
function shiftReturns(returns: number[], periods: number): number[] {
  if (periods === 0) return returns;
  return returns.slice(periods);
}

// ============ SECTOR ANALYSIS ============

/**
 * Get correlation matrix for a sector
 */
export function getSectorCorrelation(sector: string): SectorCorrelation | null {
  const tokensInSector: string[] = [];

  for (const [token, tracking] of tokenPriceHistory) {
    if (tracking.sector?.includes(sector)) {
      tokensInSector.push(token);
    }
  }

  if (tokensInSector.length < 2) return null;

  // Calculate average correlation
  let totalCorrelation = 0;
  let correlationCount = 0;

  for (let i = 0; i < tokensInSector.length; i++) {
    for (let j = i + 1; j < tokensInSector.length; j++) {
      const corr = calculateCorrelation(tokensInSector[i], tokensInSector[j]);
      if (corr) {
        totalCorrelation += corr.coefficient;
        correlationCount++;
      }
    }
  }

  const avgCorrelation = correlationCount > 0 ? totalCorrelation / correlationCount : 0;

  // Find leading tokens (those that move first)
  const leadScores: { token: string; symbol: string; leadScore: number }[] = [];

  for (const token of tokensInSector) {
    let leadScore = 0;
    let comparisons = 0;

    for (const otherToken of tokensInSector) {
      if (token === otherToken) continue;

      const leadLag = analyzeLeadLag(token, otherToken);
      if (leadLag && leadLag.leader.token === token) {
        leadScore += leadLag.correlation;
        comparisons++;
      }
    }

    const tracking = tokenPriceHistory.get(token);
    if (tracking) {
      leadScores.push({
        token,
        symbol: tracking.symbol,
        leadScore: comparisons > 0 ? leadScore / comparisons : 0
      });
    }
  }

  leadScores.sort((a, b) => b.leadScore - a.leadScore);

  // Calculate 24h performance
  let totalPerformance = 0;
  let performanceCount = 0;

  for (const token of tokensInSector) {
    const history = tokenPriceHistory.get(token);
    if (history && history.priceHistory.length >= 2) {
      const first = history.priceHistory[0];
      const last = history.priceHistory[history.priceHistory.length - 1];
      if (first.price > 0) {
        totalPerformance += (last.price - first.price) / first.price * 100;
        performanceCount++;
      }
    }
  }

  return {
    sector,
    tokens: tokensInSector,
    avgCorrelation,
    leadingTokens: leadScores.slice(0, 5),
    performance24h: performanceCount > 0 ? totalPerformance / performanceCount : 0
  };
}

/**
 * Get all sector correlations
 */
export function getAllSectorCorrelations(): SectorCorrelation[] {
  const results: SectorCorrelation[] = [];

  for (const sector of Object.keys(SECTORS)) {
    const correlation = getSectorCorrelation(sector);
    if (correlation && correlation.tokens.length >= 2) {
      results.push(correlation);
    }
  }

  return results.sort((a, b) => b.avgCorrelation - a.avgCorrelation);
}

// ============ RELATED TOKENS ============

/**
 * Get related tokens for a given token
 */
export function getRelatedTokens(token: string): RelatedToken[] {
  const results: RelatedToken[] = [];
  const sourceTracking = tokenPriceHistory.get(token);

  if (!sourceTracking) return results;

  const sourceSectors = sourceTracking.sector || [];
  const sourceNarratives = sourceTracking.narrative || [];

  for (const [otherToken, tracking] of tokenPriceHistory) {
    if (otherToken === token) continue;

    // Check for same sector
    const sharedSectors = sourceSectors.filter(s => tracking.sector?.includes(s));
    const isSameSector = sharedSectors.length > 0;

    // Check correlation
    const correlation = calculateCorrelation(token, otherToken);
    const isCorrelated = correlation && Math.abs(correlation.coefficient) >= 0.4;

    // Check lead/lag
    const leadLag = analyzeLeadLag(token, otherToken);
    const follows = leadLag && leadLag.follower.token === otherToken;
    const leads = leadLag && leadLag.leader.token === otherToken;

    if (isSameSector || isCorrelated || follows || leads) {
      let relationship: RelatedToken['relationship'] = 'same-sector';
      if (leads) relationship = 'leads';
      else if (follows) relationship = 'follows';
      else if (isCorrelated) relationship = 'correlated';

      results.push({
        token: otherToken,
        symbol: tracking.symbol,
        correlation: correlation?.coefficient || 0,
        sector: tracking.sector || [],
        narrative: tracking.narrative || [],
        relationship,
        confidence: correlation?.confidence || (isSameSector ? 70 : 50)
      });
    }
  }

  // Sort by confidence
  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

// ============ TRADE TRACKING ============

/**
 * Record a trade from a signal
 */
export function recordTrade(
  signal: AggregatedSignal,
  entryPrice: number,
  entryMcap: number
): TradeRecord {
  const trade: TradeRecord = {
    id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    signalId: signal.id,
    token: signal.token,
    symbol: signal.symbol,
    source: signal.sources[0]?.source || 'smart-wallet-elite',
    entryTime: Date.now(),
    entryPrice,
    entryMcap,
    status: 'open'
  };

  tradeHistory.push(trade);

  // Also record price
  recordPrice(signal.token, signal.symbol, entryPrice, entryMcap, undefined, signal.analysis?.narrative);

  return trade;
}

/**
 * Close a trade
 */
export function closeTrade(
  tradeId: string,
  exitPrice: number,
  exitMcap: number
): TradeRecord | null {
  const trade = tradeHistory.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'open') return null;

  trade.exitTime = Date.now();
  trade.exitPrice = exitPrice;
  trade.exitMcap = exitMcap;
  trade.holdingTimeMinutes = (trade.exitTime - trade.entryTime) / 60000;

  // Calculate PnL
  if (trade.entryPrice > 0) {
    trade.pnlPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
    trade.pnl = trade.pnlPercent; // Assuming 1 unit position
  }

  trade.status = (trade.pnlPercent || 0) >= 0 ? 'win' : 'loss';

  return trade;
}

/**
 * Update peak price for open trades
 */
export function updateTradePeak(token: string, currentPrice: number): void {
  for (const trade of tradeHistory) {
    if (trade.token === token && trade.status === 'open') {
      if (!trade.peakPrice || currentPrice > trade.peakPrice) {
        trade.peakPrice = currentPrice;
        if (trade.entryPrice > 0) {
          trade.peakPnlPercent = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
        }
      }
    }
  }
}

/**
 * Get trade history
 */
export function getTradeHistory(limit = 100): TradeRecord[] {
  return [...tradeHistory]
    .sort((a, b) => b.entryTime - a.entryTime)
    .slice(0, limit);
}

/**
 * Get open trades
 */
export function getOpenTrades(): TradeRecord[] {
  return tradeHistory.filter(t => t.status === 'open');
}

// ============ PERFORMANCE ANALYTICS ============

/**
 * Get overall performance stats
 */
export function getPerformanceStats(): PerformanceStats {
  const trades = tradeHistory;
  const closedTrades = trades.filter(t => t.status !== 'open');
  const wins = closedTrades.filter(t => t.status === 'win');
  const losses = closedTrades.filter(t => t.status === 'loss');

  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnlPercent || 0), 0);
  const avgPnlPercent = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

  const avgHoldingTime = closedTrades.length > 0
    ? closedTrades.reduce((sum, t) => sum + (t.holdingTimeMinutes || 0), 0) / closedTrades.length
    : 0;

  // Profit factor = gross profit / gross loss
  const grossProfit = wins.reduce((sum, t) => sum + (t.pnlPercent || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnlPercent || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Simplified Sharpe ratio
  const returns = closedTrades.map(t => t.pnlPercent || 0);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 0
    ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // Best/worst trades
  const sortedByPnl = [...closedTrades].sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0));
  const bestTrade = sortedByPnl[0] || null;
  const worstTrade = sortedByPnl[sortedByPnl.length - 1] || null;

  return {
    totalTrades: trades.length,
    openTrades: trades.filter(t => t.status === 'open').length,
    closedTrades: closedTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
    totalPnl,
    avgPnlPercent,
    bestTrade,
    worstTrade,
    avgHoldingTime,
    profitFactor,
    sharpeRatio
  };
}

/**
 * Get performance by hour of day
 */
export function getHourlyPerformance(): HourlyPerformance[] {
  const hourlyData: Map<number, { trades: number; wins: number; losses: number; pnl: number }> = new Map();

  // Initialize all hours
  for (let h = 0; h < 24; h++) {
    hourlyData.set(h, { trades: 0, wins: 0, losses: 0, pnl: 0 });
  }

  for (const trade of tradeHistory) {
    if (trade.status === 'open') continue;

    const hour = new Date(trade.entryTime).getUTCHours();
    const data = hourlyData.get(hour)!;

    data.trades++;
    data.pnl += trade.pnlPercent || 0;

    if (trade.status === 'win') data.wins++;
    else data.losses++;
  }

  const results: HourlyPerformance[] = [];

  for (const [hour, data] of hourlyData) {
    results.push({
      hour,
      trades: data.trades,
      wins: data.wins,
      losses: data.losses,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      avgPnl: data.trades > 0 ? data.pnl / data.trades : 0
    });
  }

  return results;
}

/**
 * Get performance by source
 */
export function getSourcePnLStats(): SourcePnLStats[] {
  const sourceData: Map<SignalSource, TradeRecord[]> = new Map();

  for (const trade of tradeHistory) {
    const existing = sourceData.get(trade.source) || [];
    existing.push(trade);
    sourceData.set(trade.source, existing);
  }

  const results: SourcePnLStats[] = [];

  for (const [source, trades] of sourceData) {
    const closedTrades = trades.filter(t => t.status !== 'open');
    const wins = closedTrades.filter(t => t.status === 'win');
    const losses = closedTrades.filter(t => t.status === 'loss');

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnlPercent || 0), 0);
    const pnlValues = closedTrades.map(t => t.pnlPercent || 0);

    results.push({
      source,
      trades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
      totalPnl,
      avgPnl: closedTrades.length > 0 ? totalPnl / closedTrades.length : 0,
      bestTrade: pnlValues.length > 0 ? Math.max(...pnlValues) : 0,
      worstTrade: pnlValues.length > 0 ? Math.min(...pnlValues) : 0
    });
  }

  return results.sort((a, b) => b.winRate - a.winRate);
}

/**
 * Get PnL chart data (cumulative over time)
 */
export function getPnLChartData(days = 30): PnLChartData[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  // Group trades by day
  const dailyData: Map<string, { pnl: number; trades: number; wins: number }> = new Map();

  // Initialize all days
  for (let d = days; d >= 0; d--) {
    const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split('T')[0];
    dailyData.set(dateKey, { pnl: 0, trades: 0, wins: 0 });
  }

  // Fill in trade data
  for (const trade of tradeHistory) {
    if (trade.entryTime < cutoff || trade.status === 'open') continue;

    const dateKey = new Date(trade.entryTime).toISOString().split('T')[0];
    const data = dailyData.get(dateKey);
    if (data) {
      data.trades++;
      data.pnl += trade.pnlPercent || 0;
      if (trade.status === 'win') data.wins++;
    }
  }

  // Convert to chart data with cumulative PnL
  const results: PnLChartData[] = [];
  let cumulativePnl = 0;

  const sortedDays = Array.from(dailyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [date, data] of sortedDays) {
    cumulativePnl += data.pnl;
    results.push({
      timestamp: new Date(date).getTime(),
      date,
      cumulativePnl,
      dailyPnl: data.pnl,
      tradeCount: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0
    });
  }

  return results;
}

/**
 * Get win/loss distribution
 */
export function getWinLossDistribution(): {
  ranges: { label: string; wins: number; losses: number }[];
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
} {
  const closedTrades = tradeHistory.filter(t => t.status !== 'open');
  const wins = closedTrades.filter(t => t.status === 'win');
  const losses = closedTrades.filter(t => t.status === 'loss');

  const ranges = [
    { min: 100, max: Infinity, label: '>100%', wins: 0, losses: 0 },
    { min: 50, max: 100, label: '50-100%', wins: 0, losses: 0 },
    { min: 20, max: 50, label: '20-50%', wins: 0, losses: 0 },
    { min: 0, max: 20, label: '0-20%', wins: 0, losses: 0 },
    { min: -20, max: 0, label: '-20-0%', wins: 0, losses: 0 },
    { min: -50, max: -20, label: '-50--20%', wins: 0, losses: 0 },
    { min: -Infinity, max: -50, label: '<-50%', wins: 0, losses: 0 }
  ];

  for (const trade of closedTrades) {
    const pnl = trade.pnlPercent || 0;
    for (const range of ranges) {
      if (pnl >= range.min && pnl < range.max) {
        if (trade.status === 'win') range.wins++;
        else range.losses++;
        break;
      }
    }
  }

  const avgWin = wins.length > 0
    ? wins.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / wins.length
    : 0;

  const avgLoss = losses.length > 0
    ? losses.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / losses.length
    : 0;

  const pnlValues = closedTrades.map(t => t.pnlPercent || 0);
  const largestWin = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
  const largestLoss = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

  return {
    ranges: ranges.map(r => ({ label: r.label, wins: r.wins, losses: r.losses })),
    avgWin,
    avgLoss,
    largestWin,
    largestLoss
  };
}

// ============ DATA SEEDING (for demo) ============

/**
 * Seed demo data for correlation analysis
 */
export function seedDemoData(): void {
  const now = Date.now();
  const demoTokens = [
    { token: 'demo-ai-1', symbol: 'NEURAL', sector: ['AI'], basePrice: 0.001 },
    { token: 'demo-ai-2', symbol: 'CHATAI', sector: ['AI'], basePrice: 0.002 },
    { token: 'demo-meme-1', symbol: 'PEPECAT', sector: ['MEME'], basePrice: 0.0001 },
    { token: 'demo-meme-2', symbol: 'DOGWIF', sector: ['MEME'], basePrice: 0.00015 },
    { token: 'demo-defi-1', symbol: 'YIELDMAX', sector: ['DEFI'], basePrice: 0.5 },
    { token: 'demo-gaming-1', symbol: 'QUESTOR', sector: ['GAMING'], basePrice: 0.02 }
  ];

  // Generate 24 hours of price history
  for (const demo of demoTokens) {
    let price = demo.basePrice;
    const history: PricePoint[] = [];

    for (let i = 288; i >= 0; i--) { // 5-minute intervals for 24h
      const timestamp = now - i * 5 * 60 * 1000;

      // Random walk with sector correlation
      const change = (Math.random() - 0.48) * 0.05; // Slight upward bias
      price = price * (1 + change);

      // Add correlated movement for same-sector tokens
      const sectorBonus = demo.sector.includes('AI') ? Math.sin(i / 30) * 0.01 : 0;
      price = price * (1 + sectorBonus);

      history.push({
        timestamp,
        price: Math.max(0.0000001, price),
        mcap: price * 1e9
      });
    }

    tokenPriceHistory.set(demo.token, {
      token: demo.token,
      symbol: demo.symbol,
      priceHistory: history,
      sector: demo.sector,
      narrative: [],
      firstSeen: now - 24 * 60 * 60 * 1000,
      lastUpdate: now
    });
  }

  // Generate demo trade history
  const demoSources: SignalSource[] = ['smart-wallet-elite', 'kol-tracker', 'volume-spike', 'narrative-new'];

  for (let i = 0; i < 50; i++) {
    const token = demoTokens[Math.floor(Math.random() * demoTokens.length)];
    const source = demoSources[Math.floor(Math.random() * demoSources.length)];
    const entryPrice = token.basePrice * (0.8 + Math.random() * 0.4);
    const isWin = Math.random() > 0.35;
    const pnlPercent = isWin
      ? 10 + Math.random() * 150
      : -(10 + Math.random() * 40);
    const exitPrice = entryPrice * (1 + pnlPercent / 100);
    const holdingMinutes = 30 + Math.random() * 480;

    const trade: TradeRecord = {
      id: `demo-trade-${i}`,
      signalId: `demo-signal-${i}`,
      token: token.token,
      symbol: token.symbol,
      source,
      entryTime: now - (30 - i) * 24 * 60 * 60 * 1000 + Math.random() * 86400000,
      entryPrice,
      entryMcap: entryPrice * 1e9,
      exitTime: now - (30 - i) * 24 * 60 * 60 * 1000 + holdingMinutes * 60 * 1000,
      exitPrice,
      exitMcap: exitPrice * 1e9,
      pnl: pnlPercent,
      pnlPercent,
      status: isWin ? 'win' : 'loss',
      peakPrice: isWin ? exitPrice * (1 + Math.random() * 0.2) : entryPrice * (1 + Math.random() * 0.1),
      holdingTimeMinutes: holdingMinutes
    };

    tradeHistory.push(trade);
  }

  console.log('[CORRELATION] Demo data seeded:', demoTokens.length, 'tokens,', tradeHistory.length, 'trades');
}

// ============ EXPORTS ============

export {
  tokenPriceHistory,
  tradeHistory,
  SECTORS,
  NARRATIVES
};
