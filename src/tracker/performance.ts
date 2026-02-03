// Performance Tracker
// Monitors signal prices and calculates real-time ROI

import { AggregatedSignal } from '../types';

interface TrackedSignal {
  id: string;
  token: string;
  symbol: string;
  entryPrice: number;
  entryMcap: number;
  entryTimestamp: number;
  currentPrice: number;
  currentMcap: number;
  athPrice: number;
  athMcap: number;
  athTimestamp: number;
  lastUpdate: number;
  roi: number;
  athRoi: number;
  status: 'OPEN' | 'WIN' | 'LOSS' | 'EXPIRED';
}

// In-memory tracking (would be DB in production)
const trackedSignals = new Map<string, TrackedSignal>();

// DexScreener price fetch
async function fetchTokenPrice(token: string): Promise<{ price: number; mcap: number } | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    
    if (!pair) return null;
    
    return {
      price: parseFloat(pair.priceUsd) || 0,
      mcap: pair.fdv || pair.marketCap || 0
    };
  } catch {
    return null;
  }
}

// Start tracking a new signal
export async function trackSignal(signal: AggregatedSignal): Promise<TrackedSignal | null> {
  const priceData = await fetchTokenPrice(signal.token);
  if (!priceData) return null;

  const tracked: TrackedSignal = {
    id: signal.id,
    token: signal.token,
    symbol: signal.symbol,
    entryPrice: priceData.price,
    entryMcap: priceData.mcap,
    entryTimestamp: Date.now(),
    currentPrice: priceData.price,
    currentMcap: priceData.mcap,
    athPrice: priceData.price,
    athMcap: priceData.mcap,
    athTimestamp: Date.now(),
    lastUpdate: Date.now(),
    roi: 0,
    athRoi: 0,
    status: 'OPEN'
  };

  trackedSignals.set(signal.id, tracked);
  console.log(`[TRACKER] Now tracking ${signal.symbol} at $${priceData.price.toFixed(8)}`);
  
  return tracked;
}

// Update prices for all tracked signals
export async function updateTrackedSignals(): Promise<void> {
  const now = Date.now();
  const expireTime = 24 * 60 * 60 * 1000; // 24 hours

  for (const [id, tracked] of trackedSignals.entries()) {
    // Skip if recently updated (< 30s)
    if (now - tracked.lastUpdate < 30000) continue;

    // Check expiration
    if (now - tracked.entryTimestamp > expireTime) {
      tracked.status = 'EXPIRED';
      continue;
    }

    const priceData = await fetchTokenPrice(tracked.token);
    if (!priceData) continue;

    tracked.currentPrice = priceData.price;
    tracked.currentMcap = priceData.mcap;
    tracked.lastUpdate = now;

    // Calculate ROI
    if (tracked.entryPrice > 0) {
      tracked.roi = ((priceData.price - tracked.entryPrice) / tracked.entryPrice) * 100;
    }

    // Update ATH
    if (priceData.price > tracked.athPrice) {
      tracked.athPrice = priceData.price;
      tracked.athMcap = priceData.mcap;
      tracked.athTimestamp = now;
      tracked.athRoi = tracked.roi;
      console.log(`[TRACKER] ${tracked.symbol} NEW ATH: $${priceData.price.toFixed(8)} (+${tracked.roi.toFixed(1)}%)`);
    }

    // Determine win/loss
    if (tracked.roi >= 100) {
      tracked.status = 'WIN'; // 2x = win
    } else if (tracked.roi <= -50) {
      tracked.status = 'LOSS'; // -50% = loss
    }
  }
}

// Get all tracked signals
export function getTrackedSignals(): TrackedSignal[] {
  return Array.from(trackedSignals.values());
}

// Get performance summary
export function getPerformanceSummary(): {
  total: number;
  open: number;
  wins: number;
  losses: number;
  expired: number;
  winRate: number;
  avgRoi: number;
  avgAthRoi: number;
  bestTrade: TrackedSignal | null;
  worstTrade: TrackedSignal | null;
} {
  const signals = getTrackedSignals();
  const closed = signals.filter(s => s.status === 'WIN' || s.status === 'LOSS');
  const open = signals.filter(s => s.status === 'OPEN');
  const wins = signals.filter(s => s.status === 'WIN');
  const losses = signals.filter(s => s.status === 'LOSS');
  const expired = signals.filter(s => s.status === 'EXPIRED');

  const avgRoi = signals.length > 0 
    ? signals.reduce((sum, s) => sum + s.roi, 0) / signals.length 
    : 0;

  const avgAthRoi = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.athRoi, 0) / signals.length
    : 0;

  const sortedByRoi = [...signals].sort((a, b) => b.athRoi - a.athRoi);
  const bestTrade = sortedByRoi[0] || null;
  const worstTrade = sortedByRoi[sortedByRoi.length - 1] || null;

  return {
    total: signals.length,
    open: open.length,
    wins: wins.length,
    losses: losses.length,
    expired: expired.length,
    winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
    avgRoi,
    avgAthRoi,
    bestTrade,
    worstTrade
  };
}

// Get signal by ID
export function getTrackedSignal(id: string): TrackedSignal | undefined {
  return trackedSignals.get(id);
}

// Export for testing
export { trackedSignals };
