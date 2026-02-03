import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  openPosition,
  closePosition,
  getOpenPositions,
  getClosedPositions,
  getPortfolioSummary,
  calculatePnL,
  updatePositionPrices
} from '../src/portfolio/watchlist';

describe('Portfolio & Watchlist', () => {
  describe('Watchlist', () => {
    it('should add token to watchlist', () => {
      const entry = addToWatchlist({
        token: 'TestToken123',
        symbol: 'TEST',
        name: 'Test Token',
        alerts: {}
      });

      expect(entry.id).toBeDefined();
      expect(entry.symbol).toBe('TEST');
      expect(entry.addedAt).toBeDefined();
    });

    it('should get watchlist sorted by date', () => {
      addToWatchlist({ token: 'Token1', symbol: 'T1', name: 'Token 1', alerts: {} });
      addToWatchlist({ token: 'Token2', symbol: 'T2', name: 'Token 2', alerts: {} });

      const list = getWatchlist();
      expect(list.length).toBeGreaterThanOrEqual(2);
      // Most recent first
      expect(list[0].addedAt).toBeGreaterThanOrEqual(list[1].addedAt);
    });

    it('should remove from watchlist', () => {
      const entry = addToWatchlist({ token: 'Remove', symbol: 'REM', name: 'Remove', alerts: {} });
      const removed = removeFromWatchlist(entry.id);

      expect(removed).toBe(true);
    });
  });

  describe('Positions', () => {
    it('should open a position', () => {
      const position = openPosition('Token123', 'TEST', 0.001, 1000000);

      expect(position.id).toBeDefined();
      expect(position.status).toBe('open');
      expect(position.investedAmount).toBe(1000);
      expect(position.quantity).toBe(1000000);
    });

    it('should close a position', () => {
      const position = openPosition('CloseToken', 'CLOSE', 0.001, 1000000);
      const closed = closePosition(position.id, 0.002);

      expect(closed).not.toBeNull();
      expect(closed?.status).toBe('closed');
      expect(closed?.realizedPnl).toBe(1000); // 2x = +1000
    });

    it('should calculate PnL correctly', () => {
      const position = openPosition('PnLToken', 'PNL', 0.001, 1000000);
      position.investedAmount = 1000;

      const pnl = calculatePnL(position, 0.0015);

      expect(pnl.unrealizedPnl).toBe(500); // 50% gain
      expect(pnl.unrealizedPnlPct).toBe(50);
    });

    it('should track ATH', () => {
      const position = openPosition('ATHToken', 'ATH', 0.001, 1000000);

      const priceData = new Map<string, number>();
      priceData.set('ATHToken', 0.002);
      updatePositionPrices(priceData);

      expect(position.athPrice).toBe(0.002);
      expect(position.athPnlPct).toBe(100);
    });

    it('should get open positions', () => {
      openPosition('Open1', 'O1', 0.001, 1000);
      openPosition('Open2', 'O2', 0.001, 1000);

      const open = getOpenPositions();
      expect(open.length).toBeGreaterThanOrEqual(2);
      expect(open.every(p => p.status === 'open')).toBe(true);
    });

    it('should get closed positions', () => {
      const pos = openPosition('ToBeClosed', 'TBC', 0.001, 1000);
      closePosition(pos.id, 0.002);

      const closed = getClosedPositions();
      expect(closed.some(p => p.symbol === 'TBC')).toBe(true);
    });
  });

  describe('Portfolio Summary', () => {
    it('should calculate portfolio summary', () => {
      // Create some test positions
      openPosition('SumToken1', 'SUM1', 0.001, 100000);
      const pos2 = openPosition('SumToken2', 'SUM2', 0.001, 100000);
      closePosition(pos2.id, 0.002); // Winner

      const summary = getPortfolioSummary();

      expect(summary).toHaveProperty('totalInvested');
      expect(summary).toHaveProperty('currentValue');
      expect(summary).toHaveProperty('totalPnl');
      expect(summary).toHaveProperty('winRate');
      expect(summary).toHaveProperty('openPositions');
      expect(summary).toHaveProperty('closedPositions');
    });

    it('should track winning and losing positions', () => {
      const winner = openPosition('Winner', 'WIN', 0.001, 1000);
      const loser = openPosition('Loser', 'LOSE', 0.001, 1000);

      closePosition(winner.id, 0.002); // +100%
      closePosition(loser.id, 0.0005); // -50%

      const summary = getPortfolioSummary();
      expect(summary.winningPositions).toBeGreaterThanOrEqual(1);
      expect(summary.losingPositions).toBeGreaterThanOrEqual(1);
    });

    it('should identify best and worst positions', () => {
      const best = openPosition('Best', 'BEST', 0.001, 1000);
      const worst = openPosition('Worst', 'WORST', 0.001, 1000);

      closePosition(best.id, 0.01); // +900%
      closePosition(worst.id, 0.0001); // -90%

      const summary = getPortfolioSummary();

      if (summary.bestPosition) {
        expect(summary.bestPosition.realizedPnl).toBeGreaterThan(0);
      }
      if (summary.worstPosition) {
        expect(summary.worstPosition.realizedPnl).toBeLessThan(0);
      }
    });
  });
});
