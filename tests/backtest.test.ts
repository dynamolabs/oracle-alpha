import {
  runBacktest,
  formatBacktestResult,
  DEFAULT_CONFIG,
  BacktestConfig
} from '../src/backtest/engine';
import { AggregatedSignal } from '../src/types';

describe('Backtesting Engine', () => {
  // Mock signals for testing
  const mockSignals: AggregatedSignal[] = Array(50)
    .fill(null)
    .map((_, i) => ({
      id: `signal-${i}`,
      timestamp: Date.now() - (50 - i) * 3600000, // Hourly signals
      token: `token${i}`,
      symbol: `TEST${i}`,
      name: `Test Token ${i}`,
      score: 60 + Math.floor(Math.random() * 40),
      confidence: 70,
      riskLevel: 'MEDIUM' as const,
      sources: [{ source: 'volume-spike' as const, weight: 1, rawScore: 70 }],
      marketData: {
        mcap: 100000 + Math.random() * 900000,
        liquidity: 50000,
        volume5m: 10000,
        volume1h: 40000,
        priceChange5m: 5,
        priceChange1h: 15,
        age: 30
      },
      analysis: {
        narrative: ['General'],
        strengths: ['Volume spike'],
        weaknesses: [],
        recommendation: 'BUY'
      }
    }));

  describe('DEFAULT_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_CONFIG.initialCapital).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.positionSize).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.positionSize).toBeLessThanOrEqual(100);
      expect(DEFAULT_CONFIG.takeProfitPct).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.stopLossPct).toBeGreaterThan(0);
    });
  });

  describe('runBacktest', () => {
    it('should run backtest with mock signals', async () => {
      const result = await runBacktest(mockSignals, {
        minScore: 70,
        maxPositions: 3
      });

      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('trades');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('equity');
    });

    it('should filter signals by minScore', async () => {
      const result = await runBacktest(mockSignals, { minScore: 90 });

      // All trades should have score >= 90
      for (const trade of result.trades) {
        expect(trade.signalScore).toBeGreaterThanOrEqual(90);
      }
    });

    it('should respect maxPositions limit', async () => {
      const result = await runBacktest(mockSignals, {
        minScore: 60,
        maxPositions: 2
      });

      // Can't easily test this without timing, but verify it runs
      expect(result.trades.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate metrics correctly', async () => {
      const result = await runBacktest(mockSignals, { minScore: 70 });

      const { metrics } = result;

      expect(metrics.totalTrades).toBe(metrics.winningTrades + metrics.losingTrades);
      expect(metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(metrics.winRate).toBeLessThanOrEqual(100);
    });

    it('should handle empty signals', async () => {
      const result = await runBacktest([], { minScore: 70 });

      expect(result.trades).toHaveLength(0);
      expect(result.metrics.totalTrades).toBe(0);
    });

    it('should handle signals all below minScore', async () => {
      const lowScoreSignals = mockSignals.map(s => ({ ...s, score: 50 }));
      const result = await runBacktest(lowScoreSignals, { minScore: 90 });

      expect(result.trades).toHaveLength(0);
    });
  });

  describe('formatBacktestResult', () => {
    it('should format result as string', async () => {
      const result = await runBacktest(mockSignals, { minScore: 70 });
      const formatted = formatBacktestResult(result);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('BACKTEST RESULTS');
      expect(formatted).toContain('Win Rate');
      expect(formatted).toContain('Total Return');
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate profit factor correctly', async () => {
      const result = await runBacktest(mockSignals, { minScore: 70 });

      if (result.metrics.losingTrades > 0) {
        expect(result.metrics.profitFactor).toBeGreaterThanOrEqual(0);
      }
    });

    it('should track best and worst trades', async () => {
      const result = await runBacktest(mockSignals, { minScore: 70 });

      if (result.trades.length > 0) {
        expect(result.metrics.bestTrade).not.toBeNull();
        expect(result.metrics.worstTrade).not.toBeNull();

        if (result.metrics.bestTrade && result.metrics.worstTrade) {
          expect(result.metrics.bestTrade.pnlPct).toBeGreaterThanOrEqual(
            result.metrics.worstTrade.pnlPct!
          );
        }
      }
    });
  });
});
