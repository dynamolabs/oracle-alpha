/**
 * AI Price Predictor Module
 * Uses technical indicators + social signals for short-term price prediction
 * 
 * Features:
 * - Simple Moving Averages (SMA)
 * - RSI (Relative Strength Index)
 * - MACD-like momentum signals
 * - Volume trend analysis
 * - Social momentum scoring
 * - Holder growth analysis
 */

import { AggregatedSignal } from '../types';
import { fetchTokenData } from '../sources/dexscreener';

// ============= TYPES =============

export type PredictionDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type TimeHorizon = '1h' | '4h' | '24h';

export interface PricePrediction {
  token: string;
  symbol: string;
  timestamp: number;
  
  // Current state
  currentPrice: number;
  currentMcap: number;
  
  // Predictions for each timeframe
  predictions: {
    [key in TimeHorizon]: {
      direction: PredictionDirection;
      confidence: number; // 0-100
      targetRange: {
        low: number;
        high: number;
      };
      factors: PredictionFactor[];
    };
  };
  
  // Overall recommendation
  overall: {
    direction: PredictionDirection;
    confidence: number;
    summary: string;
    emoji: string;
  };
  
  // Technical indicators
  technicals: TechnicalIndicators;
  
  // Social momentum
  socialMomentum: SocialMomentum;
  
  // Historical accuracy (if tracked)
  accuracy?: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
  };
}

export interface PredictionFactor {
  name: string;
  value: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  weight: number; // 1-10
  emoji: string;
}

export interface TechnicalIndicators {
  rsi: number; // 0-100
  rsiSignal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  
  macdSignal: 'BUY' | 'SELL' | 'NEUTRAL';
  macdStrength: number; // 0-100
  
  volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  volumeScore: number; // 0-100
  
  buyPressure: number; // 0-100
  sellPressure: number; // 0-100
  
  priceVelocity: number; // % change per hour
  priceAcceleration: number; // change in velocity
  
  supportLevel?: number;
  resistanceLevel?: number;
}

export interface SocialMomentum {
  score: number; // 0-100
  trend: 'HOT' | 'GROWING' | 'STABLE' | 'COOLING' | 'COLD';
  
  kolMentions: number;
  smartWalletActivity: number;
  volumeAnomalyScore: number;
  
  viralPotential: number; // 0-100
}

// ============= PRICE HISTORY CACHE =============

interface PricePoint {
  price: number;
  volume: number;
  timestamp: number;
  buys: number;
  sells: number;
}

const priceHistory: Map<string, PricePoint[]> = new Map();
const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_HISTORY_POINTS = 288; // 5-min intervals for 24h

// Prediction history for accuracy tracking
interface PredictionRecord {
  token: string;
  timestamp: number;
  predictedDirection: PredictionDirection;
  predictedConfidence: number;
  priceAtPrediction: number;
  horizon: TimeHorizon;
  resolved?: boolean;
  actualDirection?: PredictionDirection;
  priceAtResolution?: number;
  wasCorrect?: boolean;
}

const predictionHistory: PredictionRecord[] = [];

// ============= TECHNICAL ANALYSIS =============

/**
 * Calculate RSI (Relative Strength Index)
 */
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    // Not enough data, estimate from price change
    const firstPrice = prices[0] || 1;
    const lastPrice = prices[prices.length - 1] || firstPrice;
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;
    return Math.min(100, Math.max(0, 50 + change * 2));
  }
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[prices.length - i] - prices[prices.length - i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate MACD-like signal
 */
function calculateMACD(prices: number[]): { signal: 'BUY' | 'SELL' | 'NEUTRAL'; strength: number } {
  if (prices.length < 12) {
    // Not enough data, use simple momentum
    const firstPrice = prices[0] || 1;
    const lastPrice = prices[prices.length - 1] || firstPrice;
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    if (change > 5) return { signal: 'BUY', strength: Math.min(80, 50 + change * 3) };
    if (change < -5) return { signal: 'SELL', strength: Math.min(80, 50 + Math.abs(change) * 3) };
    return { signal: 'NEUTRAL', strength: 50 };
  }
  
  // Calculate EMAs
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macdLine = ema12 - ema26;
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const macdPercent = (macdLine / avgPrice) * 100;
  
  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let strength = 50;
  
  if (macdPercent > 0.5) {
    signal = 'BUY';
    strength = Math.min(100, 50 + macdPercent * 20);
  } else if (macdPercent < -0.5) {
    signal = 'SELL';
    strength = Math.min(100, 50 + Math.abs(macdPercent) * 20);
  }
  
  return { signal, strength };
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length === 1) return prices[0];
  
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * Calculate volume trend
 */
function calculateVolumeTrend(volumes: number[]): { trend: 'INCREASING' | 'DECREASING' | 'STABLE'; score: number } {
  if (volumes.length < 3) {
    return { trend: 'STABLE', score: 50 };
  }
  
  // Compare recent volume to earlier volume
  const recentVol = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const earlierVol = volumes.slice(0, -3).reduce((a, b) => a + b, 0) / (volumes.length - 3);
  
  if (earlierVol === 0) return { trend: 'STABLE', score: 50 };
  
  const change = ((recentVol - earlierVol) / earlierVol) * 100;
  
  let trend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
  let score = 50;
  
  if (change > 20) {
    trend = 'INCREASING';
    score = Math.min(100, 50 + change);
  } else if (change < -20) {
    trend = 'DECREASING';
    score = Math.max(0, 50 + change);
  }
  
  return { trend, score };
}

/**
 * Calculate buy/sell pressure from transaction data
 */
function calculatePressure(history: PricePoint[]): { buyPressure: number; sellPressure: number } {
  if (history.length === 0) return { buyPressure: 50, sellPressure: 50 };
  
  const recentHistory = history.slice(-12); // Last hour (5-min intervals)
  let totalBuys = 0;
  let totalSells = 0;
  
  for (const point of recentHistory) {
    totalBuys += point.buys;
    totalSells += point.sells;
  }
  
  const total = totalBuys + totalSells;
  if (total === 0) return { buyPressure: 50, sellPressure: 50 };
  
  const buyPressure = (totalBuys / total) * 100;
  const sellPressure = (totalSells / total) * 100;
  
  return { buyPressure, sellPressure };
}

/**
 * Calculate price velocity and acceleration
 */
function calculateVelocity(prices: number[]): { velocity: number; acceleration: number } {
  if (prices.length < 3) {
    return { velocity: 0, acceleration: 0 };
  }
  
  // Calculate hourly velocity
  const hourAgo = prices.length >= 12 ? prices[prices.length - 12] : prices[0];
  const current = prices[prices.length - 1];
  const velocity = ((current - hourAgo) / hourAgo) * 100;
  
  // Calculate acceleration (change in velocity)
  if (prices.length < 24) {
    return { velocity, acceleration: 0 };
  }
  
  const twoHoursAgo = prices[prices.length - 24];
  const previousVelocity = ((hourAgo - twoHoursAgo) / twoHoursAgo) * 100;
  const acceleration = velocity - previousVelocity;
  
  return { velocity, acceleration };
}

// ============= SOCIAL MOMENTUM =============

/**
 * Calculate social momentum from signal data
 */
function calculateSocialMomentum(signal?: AggregatedSignal): SocialMomentum {
  if (!signal) {
    return {
      score: 50,
      trend: 'STABLE',
      kolMentions: 0,
      smartWalletActivity: 0,
      volumeAnomalyScore: 0,
      viralPotential: 30
    };
  }
  
  let score = 50;
  let kolMentions = 0;
  let smartWalletActivity = 0;
  let volumeAnomalyScore = 0;
  
  // Analyze sources
  for (const source of signal.sources) {
    if (source.source === 'kol-tracker' || source.source === 'kol-social') {
      kolMentions++;
      score += 10;
    }
    if (source.source.includes('smart-wallet')) {
      smartWalletActivity++;
      score += 15;
    }
    if (source.source === 'volume-spike' || source.source === 'dex-volume-anomaly') {
      volumeAnomalyScore += source.rawScore;
      score += 8;
    }
    if (source.source === 'whale-tracker') {
      score += 12;
    }
  }
  
  // Confluence bonus
  if (signal.confluence && signal.confluence.uniqueSources >= 3) {
    score += signal.confluence.confluenceBoost;
  }
  
  // Cap the score
  score = Math.min(100, Math.max(0, score));
  
  // Determine trend
  let trend: 'HOT' | 'GROWING' | 'STABLE' | 'COOLING' | 'COLD' = 'STABLE';
  if (score >= 80) trend = 'HOT';
  else if (score >= 65) trend = 'GROWING';
  else if (score >= 40) trend = 'STABLE';
  else if (score >= 20) trend = 'COOLING';
  else trend = 'COLD';
  
  // Viral potential based on narratives and score
  let viralPotential = score * 0.7;
  if (signal.analysis?.narrative?.some(n => 
    n.toLowerCase().includes('ai') || 
    n.toLowerCase().includes('meme') || 
    n.toLowerCase().includes('celebrity')
  )) {
    viralPotential += 15;
  }
  
  return {
    score,
    trend,
    kolMentions,
    smartWalletActivity,
    volumeAnomalyScore: Math.min(100, volumeAnomalyScore),
    viralPotential: Math.min(100, viralPotential)
  };
}

// ============= MAIN PREDICTION ENGINE =============

/**
 * Record a price point for a token
 */
export function recordPrice(token: string, data: {
  price: number;
  volume: number;
  buys: number;
  sells: number;
}) {
  const history = priceHistory.get(token) || [];
  
  history.push({
    ...data,
    timestamp: Date.now()
  });
  
  // Trim old data
  const cutoff = Date.now() - HISTORY_RETENTION_MS;
  const trimmed = history.filter(p => p.timestamp > cutoff).slice(-MAX_HISTORY_POINTS);
  
  priceHistory.set(token, trimmed);
}

/**
 * Get or fetch price history for a token
 */
async function ensurePriceHistory(token: string): Promise<PricePoint[]> {
  let history = priceHistory.get(token) || [];
  
  // If we don't have history, try to get current data from DexScreener
  if (history.length === 0) {
    const tokenData = await fetchTokenData(token);
    if (tokenData) {
      const point: PricePoint = {
        price: parseFloat(tokenData.priceUsd || '0'),
        volume: tokenData.volume?.m5 || 0,
        timestamp: Date.now(),
        buys: tokenData.txns?.m5?.buys || 0,
        sells: tokenData.txns?.m5?.sells || 0
      };
      history.push(point);
      priceHistory.set(token, history);
    }
  }
  
  return history;
}

/**
 * Generate price prediction for a token
 */
export async function predictPrice(
  token: string,
  signal?: AggregatedSignal
): Promise<PricePrediction | null> {
  // Fetch current data
  const tokenData = await fetchTokenData(token);
  if (!tokenData) {
    console.log(`[PREDICT] No data for token ${token}`);
    return null;
  }
  
  const currentPrice = parseFloat(tokenData.priceUsd || '0');
  if (currentPrice === 0) return null;
  
  // Get price history
  const history = await ensurePriceHistory(token);
  
  // Record current point
  recordPrice(token, {
    price: currentPrice,
    volume: tokenData.volume?.m5 || 0,
    buys: tokenData.txns?.m5?.buys || 0,
    sells: tokenData.txns?.m5?.sells || 0
  });
  
  // Calculate technical indicators
  const prices = history.map(h => h.price);
  const volumes = history.map(h => h.volume);
  
  const rsi = calculateRSI(prices);
  const macd = calculateMACD(prices);
  const volumeTrend = calculateVolumeTrend(volumes);
  const pressure = calculatePressure(history);
  const velocity = calculateVelocity(prices);
  
  const technicals: TechnicalIndicators = {
    rsi,
    rsiSignal: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL',
    macdSignal: macd.signal,
    macdStrength: macd.strength,
    volumeTrend: volumeTrend.trend,
    volumeScore: volumeTrend.score,
    buyPressure: pressure.buyPressure,
    sellPressure: pressure.sellPressure,
    priceVelocity: velocity.velocity,
    priceAcceleration: velocity.acceleration
  };
  
  // Calculate social momentum
  const socialMomentum = calculateSocialMomentum(signal);
  
  // Generate predictions for each timeframe
  const predictions = {
    '1h': generateTimeframePrediction('1h', technicals, socialMomentum, currentPrice, tokenData),
    '4h': generateTimeframePrediction('4h', technicals, socialMomentum, currentPrice, tokenData),
    '24h': generateTimeframePrediction('24h', technicals, socialMomentum, currentPrice, tokenData)
  };
  
  // Calculate overall prediction
  const overall = calculateOverallPrediction(predictions);
  
  // Get accuracy stats
  const accuracy = getAccuracyStats(token);
  
  return {
    token,
    symbol: tokenData.baseToken.symbol,
    timestamp: Date.now(),
    currentPrice,
    currentMcap: tokenData.fdv || 0,
    predictions,
    overall,
    technicals,
    socialMomentum,
    accuracy
  };
}

/**
 * Generate prediction for a specific timeframe
 */
function generateTimeframePrediction(
  horizon: TimeHorizon,
  technicals: TechnicalIndicators,
  social: SocialMomentum,
  currentPrice: number,
  tokenData: any
): { direction: PredictionDirection; confidence: number; targetRange: { low: number; high: number }; factors: PredictionFactor[] } {
  const factors: PredictionFactor[] = [];
  let bullishScore = 0;
  let bearishScore = 0;
  
  // Time decay factor (longer horizons = less confidence)
  const timeDecay = horizon === '1h' ? 1.0 : horizon === '4h' ? 0.85 : 0.7;
  
  // === TECHNICAL FACTORS ===
  
  // RSI Analysis
  if (technicals.rsiSignal === 'OVERSOLD') {
    bullishScore += 15;
    factors.push({
      name: 'RSI Oversold',
      value: `RSI: ${technicals.rsi.toFixed(1)}`,
      impact: 'POSITIVE',
      weight: 7,
      emoji: '📈'
    });
  } else if (technicals.rsiSignal === 'OVERBOUGHT') {
    bearishScore += 15;
    factors.push({
      name: 'RSI Overbought',
      value: `RSI: ${technicals.rsi.toFixed(1)}`,
      impact: 'NEGATIVE',
      weight: 7,
      emoji: '📉'
    });
  }
  
  // MACD Signal
  if (technicals.macdSignal === 'BUY') {
    bullishScore += technicals.macdStrength * 0.2;
    factors.push({
      name: 'MACD Bullish',
      value: `Strength: ${technicals.macdStrength.toFixed(0)}%`,
      impact: 'POSITIVE',
      weight: 8,
      emoji: '🚀'
    });
  } else if (technicals.macdSignal === 'SELL') {
    bearishScore += technicals.macdStrength * 0.2;
    factors.push({
      name: 'MACD Bearish',
      value: `Strength: ${technicals.macdStrength.toFixed(0)}%`,
      impact: 'NEGATIVE',
      weight: 8,
      emoji: '⬇️'
    });
  }
  
  // Volume Trend
  if (technicals.volumeTrend === 'INCREASING') {
    bullishScore += 10;
    factors.push({
      name: 'Volume Surge',
      value: `Score: ${technicals.volumeScore.toFixed(0)}`,
      impact: 'POSITIVE',
      weight: 6,
      emoji: '📊'
    });
  } else if (technicals.volumeTrend === 'DECREASING') {
    bearishScore += 5;
    factors.push({
      name: 'Volume Decline',
      value: `Score: ${technicals.volumeScore.toFixed(0)}`,
      impact: 'NEGATIVE',
      weight: 4,
      emoji: '📉'
    });
  }
  
  // Buy/Sell Pressure
  const pressureDiff = technicals.buyPressure - technicals.sellPressure;
  if (pressureDiff > 20) {
    bullishScore += 15;
    factors.push({
      name: 'Strong Buy Pressure',
      value: `${technicals.buyPressure.toFixed(0)}% buys`,
      impact: 'POSITIVE',
      weight: 9,
      emoji: '💪'
    });
  } else if (pressureDiff < -20) {
    bearishScore += 15;
    factors.push({
      name: 'Strong Sell Pressure',
      value: `${technicals.sellPressure.toFixed(0)}% sells`,
      impact: 'NEGATIVE',
      weight: 9,
      emoji: '🔻'
    });
  }
  
  // Price Velocity
  if (technicals.priceVelocity > 10) {
    // For short term, momentum continues; for longer, mean reversion
    if (horizon === '1h') {
      bullishScore += 10;
    } else if (horizon === '24h') {
      bearishScore += 5; // Mean reversion for longer term
    }
    factors.push({
      name: 'Price Momentum',
      value: `+${technicals.priceVelocity.toFixed(1)}%/h`,
      impact: horizon === '1h' ? 'POSITIVE' : 'NEUTRAL',
      weight: 5,
      emoji: '⚡'
    });
  } else if (technicals.priceVelocity < -10) {
    if (horizon === '1h') {
      bearishScore += 10;
    } else if (horizon === '24h') {
      bullishScore += 5; // Bounce potential
    }
    factors.push({
      name: 'Price Decline',
      value: `${technicals.priceVelocity.toFixed(1)}%/h`,
      impact: horizon === '1h' ? 'NEGATIVE' : 'NEUTRAL',
      weight: 5,
      emoji: '📉'
    });
  }
  
  // === SOCIAL FACTORS ===
  
  if (social.score >= 70) {
    bullishScore += 20;
    factors.push({
      name: 'Hot Social Momentum',
      value: `Score: ${social.score}`,
      impact: 'POSITIVE',
      weight: 10,
      emoji: '🔥'
    });
  } else if (social.score >= 50) {
    bullishScore += 10;
    factors.push({
      name: 'Growing Interest',
      value: `Score: ${social.score}`,
      impact: 'POSITIVE',
      weight: 6,
      emoji: '📈'
    });
  } else if (social.score < 30) {
    bearishScore += 10;
    factors.push({
      name: 'Low Social Activity',
      value: `Score: ${social.score}`,
      impact: 'NEGATIVE',
      weight: 5,
      emoji: '😴'
    });
  }
  
  if (social.smartWalletActivity > 0) {
    bullishScore += social.smartWalletActivity * 8;
    factors.push({
      name: 'Smart Money Activity',
      value: `${social.smartWalletActivity} wallet(s)`,
      impact: 'POSITIVE',
      weight: 9,
      emoji: '🧠'
    });
  }
  
  if (social.kolMentions > 0) {
    bullishScore += social.kolMentions * 5;
    factors.push({
      name: 'KOL Mentions',
      value: `${social.kolMentions} mention(s)`,
      impact: 'POSITIVE',
      weight: 7,
      emoji: '👤'
    });
  }
  
  if (social.viralPotential >= 70) {
    bullishScore += 10;
    factors.push({
      name: 'Viral Potential',
      value: `${social.viralPotential.toFixed(0)}%`,
      impact: 'POSITIVE',
      weight: 6,
      emoji: '🌟'
    });
  }
  
  // === MARKET DATA FACTORS ===
  
  const priceChange5m = tokenData.priceChange?.m5 || 0;
  const priceChange1h = tokenData.priceChange?.h1 || 0;
  
  if (priceChange5m > 20) {
    if (horizon === '1h') {
      bullishScore += 8;
    } else {
      bearishScore += 5; // Likely to retrace
    }
    factors.push({
      name: 'Recent Pump',
      value: `+${priceChange5m.toFixed(1)}% (5m)`,
      impact: horizon === '1h' ? 'POSITIVE' : 'NEUTRAL',
      weight: 5,
      emoji: '🚀'
    });
  }
  
  // Liquidity factor
  const liquidity = tokenData.liquidity?.usd || 0;
  if (liquidity < 5000) {
    factors.push({
      name: 'Low Liquidity Risk',
      value: `$${(liquidity / 1000).toFixed(1)}K`,
      impact: 'NEGATIVE',
      weight: 4,
      emoji: '⚠️'
    });
    bearishScore += 5;
  } else if (liquidity > 50000) {
    factors.push({
      name: 'Strong Liquidity',
      value: `$${(liquidity / 1000).toFixed(1)}K`,
      impact: 'POSITIVE',
      weight: 3,
      emoji: '💧'
    });
    bullishScore += 3;
  }
  
  // === CALCULATE FINAL DIRECTION & CONFIDENCE ===
  
  const netScore = (bullishScore - bearishScore) * timeDecay;
  let direction: PredictionDirection;
  let rawConfidence: number;
  
  if (netScore > 15) {
    direction = 'BULLISH';
    rawConfidence = Math.min(95, 50 + netScore);
  } else if (netScore < -15) {
    direction = 'BEARISH';
    rawConfidence = Math.min(95, 50 + Math.abs(netScore));
  } else {
    direction = 'NEUTRAL';
    rawConfidence = Math.max(30, 50 - Math.abs(netScore));
  }
  
  // Confidence adjustments
  const confidence = Math.round(rawConfidence * timeDecay);
  
  // Calculate target range
  const volatilityFactor = horizon === '1h' ? 0.1 : horizon === '4h' ? 0.2 : 0.4;
  const baseMove = direction === 'BULLISH' ? 1 + (confidence / 500) : 
                   direction === 'BEARISH' ? 1 - (confidence / 500) : 1;
  
  const targetRange = {
    low: currentPrice * (baseMove - volatilityFactor),
    high: currentPrice * (baseMove + volatilityFactor)
  };
  
  return {
    direction,
    confidence,
    targetRange,
    factors: factors.sort((a, b) => b.weight - a.weight).slice(0, 6)
  };
}

/**
 * Calculate overall prediction from timeframe predictions
 */
function calculateOverallPrediction(predictions: {
  [key in TimeHorizon]: { direction: PredictionDirection; confidence: number; factors: PredictionFactor[] };
}): { direction: PredictionDirection; confidence: number; summary: string; emoji: string } {
  // Weight short-term more heavily
  const weights = { '1h': 0.5, '4h': 0.3, '24h': 0.2 };
  
  let bullishWeight = 0;
  let bearishWeight = 0;
  let totalConfidence = 0;
  
  for (const [horizon, prediction] of Object.entries(predictions)) {
    const weight = weights[horizon as TimeHorizon];
    if (prediction.direction === 'BULLISH') {
      bullishWeight += weight * prediction.confidence;
    } else if (prediction.direction === 'BEARISH') {
      bearishWeight += weight * prediction.confidence;
    }
    totalConfidence += weight * prediction.confidence;
  }
  
  let direction: PredictionDirection;
  let confidence: number;
  let emoji: string;
  let summary: string;
  
  if (bullishWeight > bearishWeight + 10) {
    direction = 'BULLISH';
    confidence = Math.round(bullishWeight);
    emoji = confidence >= 70 ? '🚀' : '📈';
    summary = confidence >= 70 
      ? 'Strong bullish signals across timeframes!'
      : 'Moderately bullish with some positive indicators.';
  } else if (bearishWeight > bullishWeight + 10) {
    direction = 'BEARISH';
    confidence = Math.round(bearishWeight);
    emoji = confidence >= 70 ? '🔻' : '📉';
    summary = confidence >= 70 
      ? 'Strong bearish signals - consider caution!'
      : 'Moderately bearish, potential downside risk.';
  } else {
    direction = 'NEUTRAL';
    confidence = Math.round(50);
    emoji = '➖';
    summary = 'Mixed signals, no clear direction. Wait for confirmation.';
  }
  
  return { direction, confidence, emoji, summary };
}

/**
 * Get accuracy statistics for predictions
 */
function getAccuracyStats(token: string): { totalPredictions: number; correctPredictions: number; accuracy: number } | undefined {
  const resolved = predictionHistory.filter(p => p.token === token && p.resolved);
  if (resolved.length < 3) return undefined;
  
  const correct = resolved.filter(p => p.wasCorrect).length;
  return {
    totalPredictions: resolved.length,
    correctPredictions: correct,
    accuracy: Math.round((correct / resolved.length) * 100)
  };
}

/**
 * Record a prediction for later accuracy tracking
 */
export function recordPrediction(prediction: PricePrediction, horizon: TimeHorizon) {
  predictionHistory.push({
    token: prediction.token,
    timestamp: Date.now(),
    predictedDirection: prediction.predictions[horizon].direction,
    predictedConfidence: prediction.predictions[horizon].confidence,
    priceAtPrediction: prediction.currentPrice,
    horizon
  });
  
  // Keep only last 1000 predictions
  while (predictionHistory.length > 1000) {
    predictionHistory.shift();
  }
}

/**
 * Resolve pending predictions (check if they were correct)
 */
export async function resolvePendictions() {
  const now = Date.now();
  const horizonMs = {
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000
  };
  
  for (const record of predictionHistory) {
    if (record.resolved) continue;
    
    const elapsed = now - record.timestamp;
    const targetMs = horizonMs[record.horizon];
    
    // Check if enough time has passed
    if (elapsed >= targetMs) {
      // Fetch current price
      const tokenData = await fetchTokenData(record.token);
      if (!tokenData) continue;
      
      const currentPrice = parseFloat(tokenData.priceUsd || '0');
      if (currentPrice === 0) continue;
      
      const priceChange = ((currentPrice - record.priceAtPrediction) / record.priceAtPrediction) * 100;
      
      let actualDirection: PredictionDirection;
      if (priceChange > 5) actualDirection = 'BULLISH';
      else if (priceChange < -5) actualDirection = 'BEARISH';
      else actualDirection = 'NEUTRAL';
      
      record.resolved = true;
      record.priceAtResolution = currentPrice;
      record.actualDirection = actualDirection;
      record.wasCorrect = record.predictedDirection === actualDirection ||
        (record.predictedDirection === 'NEUTRAL' && Math.abs(priceChange) < 10);
    }
  }
}

/**
 * Get global prediction accuracy stats
 */
export function getGlobalAccuracy(): {
  total: number;
  correct: number;
  accuracy: number;
  byHorizon: { [key in TimeHorizon]: { total: number; correct: number; accuracy: number } };
} {
  const resolved = predictionHistory.filter(p => p.resolved);
  const correct = resolved.filter(p => p.wasCorrect).length;
  
  const byHorizon: any = {};
  for (const horizon of ['1h', '4h', '24h'] as TimeHorizon[]) {
    const horizonResolved = resolved.filter(p => p.horizon === horizon);
    const horizonCorrect = horizonResolved.filter(p => p.wasCorrect).length;
    byHorizon[horizon] = {
      total: horizonResolved.length,
      correct: horizonCorrect,
      accuracy: horizonResolved.length > 0 ? Math.round((horizonCorrect / horizonResolved.length) * 100) : 0
    };
  }
  
  return {
    total: resolved.length,
    correct,
    accuracy: resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : 0,
    byHorizon
  };
}

/**
 * Format prediction for display
 */
export function formatPrediction(prediction: PricePrediction): string {
  const { overall, predictions, technicals, socialMomentum } = prediction;
  
  let text = `🔮 AI Prediction: $${prediction.symbol}\n`;
  text += '━'.repeat(30) + '\n\n';
  
  // Overall
  text += `${overall.emoji} Overall: ${overall.direction} (${overall.confidence}%)\n`;
  text += `${overall.summary}\n\n`;
  
  // Timeframe predictions
  text += '📊 By Timeframe:\n';
  for (const [horizon, pred] of Object.entries(predictions)) {
    const emoji = pred.direction === 'BULLISH' ? '🟢' : pred.direction === 'BEARISH' ? '🔴' : '⚪';
    text += `  ${emoji} ${horizon}: ${pred.direction} (${pred.confidence}%)\n`;
  }
  text += '\n';
  
  // Key factors
  const allFactors = [...predictions['1h'].factors];
  const topFactors = allFactors.slice(0, 4);
  text += '💡 Key Factors:\n';
  for (const factor of topFactors) {
    const impactEmoji = factor.impact === 'POSITIVE' ? '🟢' : factor.impact === 'NEGATIVE' ? '🔴' : '⚪';
    text += `  ${factor.emoji} ${factor.name}: ${factor.value} ${impactEmoji}\n`;
  }
  text += '\n';
  
  // Technicals summary
  text += '📈 Technicals:\n';
  text += `  RSI: ${technicals.rsi.toFixed(1)} (${technicals.rsiSignal})\n`;
  text += `  MACD: ${technicals.macdSignal} (${technicals.macdStrength.toFixed(0)}%)\n`;
  text += `  Volume: ${technicals.volumeTrend}\n`;
  text += `  Buy/Sell: ${technicals.buyPressure.toFixed(0)}% / ${technicals.sellPressure.toFixed(0)}%\n`;
  text += '\n';
  
  // Social momentum
  text += `🔥 Social: ${socialMomentum.trend} (${socialMomentum.score})\n`;
  if (socialMomentum.smartWalletActivity > 0) {
    text += `  💎 ${socialMomentum.smartWalletActivity} smart wallet(s) active\n`;
  }
  if (socialMomentum.kolMentions > 0) {
    text += `  👤 ${socialMomentum.kolMentions} KOL mention(s)\n`;
  }
  
  return text;
}

/**
 * Get prediction badge for UI
 */
export function getPredictionBadge(prediction: PricePrediction): {
  text: string;
  emoji: string;
  color: string;
  confidence: number;
} {
  const { overall } = prediction;
  
  const colors = {
    BULLISH: '#22c55e',
    BEARISH: '#ef4444',
    NEUTRAL: '#888888'
  };
  
  return {
    text: `AI says: ${overall.emoji} ${overall.direction} (${overall.confidence}%)`,
    emoji: overall.emoji,
    color: colors[overall.direction],
    confidence: overall.confidence
  };
}

// Export types
