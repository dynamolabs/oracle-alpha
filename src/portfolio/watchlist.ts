/**
 * Token Watchlist & PnL Calculator
 * Track positions and calculate profit/loss
 */

import {
  WatchlistAlert,
  AlertType,
  createAlert,
  getAlertsForToken,
  deleteAlertsForToken,
  updateAlert as updateWatchlistAlert,
  deleteAlert as deleteWatchlistAlert,
  toggleAlert as toggleWatchlistAlertEnabled
} from './watchlist-alerts';

// Re-export alert types for convenience
export type { WatchlistAlert, AlertType };
export {
  createAlert,
  getAlertsForToken,
  deleteAlertsForToken,
  updateWatchlistAlert,
  deleteWatchlistAlert,
  toggleWatchlistAlertEnabled
};

// Watchlist entry
export interface WatchlistEntry {
  id: string;
  token: string;
  symbol: string;
  name: string;
  addedAt: number;
  signalId?: string;
  signalScore?: number;
  notes?: string;
  alertCount?: number; // Number of active alerts
  alerts: {
    priceAbove?: number;
    priceBelow?: number;
    mcapAbove?: number;
    mcapBelow?: number;
  };
}

// Position tracking
export interface Position {
  id: string;
  token: string;
  symbol: string;
  entryPrice: number;
  entryTime: number;
  quantity: number;
  investedAmount: number;
  currentPrice?: number;
  currentValue?: number;
  pnl?: number;
  pnlPct?: number;
  athPrice?: number;
  athPnlPct?: number;
  status: 'open' | 'closed';
  closedAt?: number;
  closedPrice?: number;
  realizedPnl?: number;
  signalId?: string;
  notes?: string;
}

// Portfolio summary
export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPct: number;
  openPositions: number;
  closedPositions: number;
  winningPositions: number;
  losingPositions: number;
  winRate: number;
  bestPosition: Position | null;
  worstPosition: Position | null;
}

// In-memory stores
const watchlist = new Map<string, WatchlistEntry>();
const positions = new Map<string, Position>();

// === Watchlist Functions ===

// Add to watchlist
export function addToWatchlist(entry: Omit<WatchlistEntry, 'id' | 'addedAt'>): WatchlistEntry {
  const watchlistEntry: WatchlistEntry = {
    ...entry,
    id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    addedAt: Date.now()
  };

  watchlist.set(watchlistEntry.id, watchlistEntry);
  return watchlistEntry;
}

// Remove from watchlist
export function removeFromWatchlist(id: string): boolean {
  return watchlist.delete(id);
}

// Get watchlist
export function getWatchlist(): WatchlistEntry[] {
  return Array.from(watchlist.values()).sort((a, b) => b.addedAt - a.addedAt);
}

// Update watchlist alerts
export function updateWatchlistAlerts(id: string, alerts: WatchlistEntry['alerts']): boolean {
  const entry = watchlist.get(id);
  if (!entry) return false;

  entry.alerts = { ...entry.alerts, ...alerts };
  return true;
}

// Check watchlist alerts
export function checkWatchlistAlerts(
  priceData: Map<string, { price: number; mcap: number }>
): WatchlistEntry[] {
  const triggered: WatchlistEntry[] = [];

  for (const entry of watchlist.values()) {
    const data = priceData.get(entry.token);
    if (!data) continue;

    const { price, mcap } = data;
    const { alerts } = entry;

    if (
      (alerts.priceAbove && price >= alerts.priceAbove) ||
      (alerts.priceBelow && price <= alerts.priceBelow) ||
      (alerts.mcapAbove && mcap >= alerts.mcapAbove) ||
      (alerts.mcapBelow && mcap <= alerts.mcapBelow)
    ) {
      triggered.push(entry);
    }
  }

  return triggered;
}

// === Position Functions ===

// Open position
export function openPosition(
  token: string,
  symbol: string,
  entryPrice: number,
  quantity: number,
  signalId?: string,
  notes?: string
): Position {
  const position: Position = {
    id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    token,
    symbol,
    entryPrice,
    entryTime: Date.now(),
    quantity,
    investedAmount: entryPrice * quantity,
    status: 'open',
    signalId,
    notes
  };

  positions.set(position.id, position);
  return position;
}

// Update position prices
export function updatePositionPrices(priceData: Map<string, number>): void {
  for (const position of positions.values()) {
    if (position.status !== 'open') continue;

    const currentPrice = priceData.get(position.token);
    if (!currentPrice) continue;

    position.currentPrice = currentPrice;
    position.currentValue = currentPrice * position.quantity;
    position.pnl = position.currentValue - position.investedAmount;
    position.pnlPct = (position.pnl / position.investedAmount) * 100;

    // Track ATH
    if (!position.athPrice || currentPrice > position.athPrice) {
      position.athPrice = currentPrice;
      position.athPnlPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    }
  }
}

// Close position
export function closePosition(id: string, exitPrice: number): Position | null {
  const position = positions.get(id);
  if (!position || position.status !== 'open') return null;

  position.status = 'closed';
  position.closedAt = Date.now();
  position.closedPrice = exitPrice;
  position.realizedPnl = exitPrice * position.quantity - position.investedAmount;

  return position;
}

// Get open positions
export function getOpenPositions(): Position[] {
  return Array.from(positions.values())
    .filter(p => p.status === 'open')
    .sort((a, b) => b.entryTime - a.entryTime);
}

// Get closed positions
export function getClosedPositions(): Position[] {
  return Array.from(positions.values())
    .filter(p => p.status === 'closed')
    .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
}

// Get all positions
export function getAllPositions(): Position[] {
  return Array.from(positions.values()).sort((a, b) => b.entryTime - a.entryTime);
}

// Get position by ID
export function getPosition(id: string): Position | undefined {
  return positions.get(id);
}

// Calculate portfolio summary
export function getPortfolioSummary(): PortfolioSummary {
  const allPositions = Array.from(positions.values());
  const openPositions = allPositions.filter(p => p.status === 'open');
  const closedPositions = allPositions.filter(p => p.status === 'closed');

  let totalInvested = 0;
  let currentValue = 0;
  let realizedPnl = 0;
  let winningCount = 0;
  let losingCount = 0;
  let bestPosition: Position | null = null;
  let worstPosition: Position | null = null;

  for (const pos of openPositions) {
    totalInvested += pos.investedAmount;
    currentValue += pos.currentValue || pos.investedAmount;
  }

  for (const pos of closedPositions) {
    realizedPnl += pos.realizedPnl || 0;

    if ((pos.realizedPnl || 0) > 0) {
      winningCount++;
      if (!bestPosition || (pos.realizedPnl || 0) > (bestPosition.realizedPnl || 0)) {
        bestPosition = pos;
      }
    } else {
      losingCount++;
      if (!worstPosition || (pos.realizedPnl || 0) < (worstPosition.realizedPnl || 0)) {
        worstPosition = pos;
      }
    }
  }

  const unrealizedPnl = currentValue - totalInvested;
  const totalPnl = realizedPnl + unrealizedPnl;

  return {
    totalInvested,
    currentValue,
    totalPnl,
    totalPnlPct: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
    openPositions: openPositions.length,
    closedPositions: closedPositions.length,
    winningPositions: winningCount,
    losingPositions: losingCount,
    winRate: closedPositions.length > 0 ? (winningCount / closedPositions.length) * 100 : 0,
    bestPosition,
    worstPosition
  };
}

// Calculate PnL for specific position
export function calculatePnL(
  position: Position,
  currentPrice: number
): {
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  fromAth: number;
} {
  const currentValue = currentPrice * position.quantity;
  const unrealizedPnl = currentValue - position.investedAmount;
  const unrealizedPnlPct = (unrealizedPnl / position.investedAmount) * 100;

  const athPrice = position.athPrice || currentPrice;
  const athValue = athPrice * position.quantity;
  const fromAth = ((currentValue - athValue) / athValue) * 100;

  return { unrealizedPnl, unrealizedPnlPct, fromAth };
}

// Format portfolio for display
export function formatPortfolioSummary(): string {
  const summary = getPortfolioSummary();
  const openPos = getOpenPositions();

  let output = `
💼 PORTFOLIO SUMMARY
═══════════════════════════════════════

💰 Total Invested: $${summary.totalInvested.toFixed(2)}
📊 Current Value: $${summary.currentValue.toFixed(2)}
${summary.totalPnl >= 0 ? '📈' : '📉'} Total P&L: ${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl.toFixed(2)} (${summary.totalPnlPct >= 0 ? '+' : ''}${summary.totalPnlPct.toFixed(2)}%)

📍 Open Positions: ${summary.openPositions}
✅ Closed Positions: ${summary.closedPositions}
🎯 Win Rate: ${summary.winRate.toFixed(1)}%

`;

  if (openPos.length > 0) {
    output += '\n📍 OPEN POSITIONS:\n';
    for (const pos of openPos.slice(0, 5)) {
      const pnlStr =
        pos.pnlPct !== undefined ? `${pos.pnlPct >= 0 ? '+' : ''}${pos.pnlPct.toFixed(1)}%` : 'N/A';
      output += `• ${pos.symbol}: $${pos.investedAmount.toFixed(2)} → ${pnlStr}\n`;
    }
  }

  if (summary.bestPosition) {
    const best = summary.bestPosition;
    output += `\n🏆 Best Trade: ${best.symbol} +$${(best.realizedPnl || 0).toFixed(2)}`;
  }

  return output.trim();
}
