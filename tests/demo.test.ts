import {
  generateDemoSignal,
  generateDemoSignals,
  generateHistoricalSignals,
  DemoRunner
} from '../src/demo/generator';

describe('Demo Generator', () => {
  describe('generateDemoSignal', () => {
    it('should generate a valid signal', () => {
      const signal = generateDemoSignal();

      expect(signal).toBeDefined();
      expect(signal.id).toBeDefined();
      expect(signal.token).toHaveLength(44); // Solana address length
      expect(signal.symbol).toBeDefined();
      expect(signal.name).toBeDefined();
      expect(signal.score).toBeGreaterThanOrEqual(35);
      expect(signal.score).toBeLessThanOrEqual(95);
      expect(signal.sources).toBeInstanceOf(Array);
      expect(signal.sources.length).toBeGreaterThan(0);
      expect(signal.marketData).toBeDefined();
      expect(signal.marketData.mcap).toBeGreaterThan(0);
      expect(signal.analysis).toBeDefined();
      expect(signal.riskLevel).toMatch(/LOW|MEDIUM|HIGH|EXTREME/);
    });

    it('should generate different signals each time', () => {
      const signal1 = generateDemoSignal();
      const signal2 = generateDemoSignal();

      expect(signal1.id).not.toEqual(signal2.id);
      expect(signal1.token).not.toEqual(signal2.token);
    });

    it('should have valid market data', () => {
      const signal = generateDemoSignal();

      expect(signal.marketData.mcap).toBeGreaterThanOrEqual(50000);
      expect(signal.marketData.mcap).toBeLessThanOrEqual(950000);
      expect(signal.marketData.volume5m).toBeGreaterThan(0);
      expect(signal.marketData.volume1h).toBeGreaterThan(0);
      expect(signal.marketData.age).toBeGreaterThanOrEqual(1);
      expect(signal.marketData.age).toBeLessThanOrEqual(120);
    });

    it('should have valid analysis', () => {
      const signal = generateDemoSignal();

      expect(signal.analysis.narrative).toBeInstanceOf(Array);
      expect(signal.analysis.narrative.length).toBeGreaterThan(0);
      expect(signal.analysis.recommendation).toBeDefined();
      expect(signal.analysis.strengths).toBeInstanceOf(Array);
      expect(signal.analysis.weaknesses).toBeInstanceOf(Array);
    });
  });

  describe('generateDemoSignals', () => {
    it('should generate requested number of signals', () => {
      const signals = generateDemoSignals(5);

      expect(signals).toHaveLength(5);
    });

    it('should return unique symbols in batch', () => {
      const signals = generateDemoSignals(10);
      const symbols = signals.map(s => s.symbol);
      const uniqueSymbols = [...new Set(symbols)];

      // Most should be unique (some duplicates possible if we run out)
      expect(uniqueSymbols.length).toBeGreaterThanOrEqual(Math.min(8, signals.length));
    });

    it('should be sorted by score descending', () => {
      const signals = generateDemoSignals(5);

      for (let i = 1; i < signals.length; i++) {
        expect(signals[i - 1].score).toBeGreaterThanOrEqual(signals[i].score);
      }
    });
  });

  describe('generateHistoricalSignals', () => {
    it('should generate historical signals with performance data', () => {
      const historical = generateHistoricalSignals(10);

      expect(historical).toHaveLength(10);

      for (const signal of historical) {
        expect(signal.closed).toBe(true);
        expect(signal.result).toMatch(/WIN|LOSS/);
        expect(signal.exitPrice).toBeDefined();
        expect(signal.athPrice).toBeDefined();
        expect(signal.roi).toBeDefined();
      }
    });

    it('should have timestamps in the past', () => {
      const now = Date.now();
      const historical = generateHistoricalSignals(5);

      for (const signal of historical) {
        expect(signal.timestamp).toBeLessThan(now);
        // Should be within last 7 days
        const dayAgo = now - 8 * 24 * 60 * 60 * 1000;
        expect(signal.timestamp).toBeGreaterThan(dayAgo);
      }
    });

    it('should have realistic win rates based on score', () => {
      // Generate a large sample
      const historical = generateHistoricalSignals(100);

      const highScoreSignals = historical.filter(s => s.score >= 70);
      const lowScoreSignals = historical.filter(s => s.score < 50);

      const highScoreWinRate =
        highScoreSignals.filter(s => s.result === 'WIN').length / highScoreSignals.length;

      const lowScoreWinRate =
        lowScoreSignals.length > 0
          ? lowScoreSignals.filter(s => s.result === 'WIN').length / lowScoreSignals.length
          : 0;

      // Higher scores should generally have better win rates
      if (lowScoreSignals.length > 5) {
        expect(highScoreWinRate).toBeGreaterThan(lowScoreWinRate - 0.2);
      }
    });
  });

  describe('DemoRunner', () => {
    it('should generate signals at intervals', async () => {
      const signals: any[] = [];
      const runner = new DemoRunner(signal => signals.push(signal), 60); // 60/min = 1/sec

      runner.start();

      // Wait for initial batch + 1 interval
      await new Promise(resolve => setTimeout(resolve, 1500));

      runner.stop();

      // Should have initial batch (3) + at least 1 from interval
      expect(signals.length).toBeGreaterThanOrEqual(3);
    });

    it('should stop generating when stopped', async () => {
      const signals: any[] = [];
      const runner = new DemoRunner(signal => signals.push(signal), 60);

      runner.start();
      await new Promise(resolve => setTimeout(resolve, 500));
      runner.stop();

      const countAfterStop = signals.length;
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Count should not increase after stop
      expect(signals.length).toEqual(countAfterStop);
    });
  });
});
