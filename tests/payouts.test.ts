import {
  calculateProviderPayouts,
  calculateDistribution,
  recordPayout,
  getPayoutHistory,
  getPendingPayouts,
  updatePayoutStatus,
  getPayoutStats,
  REVENUE_SPLIT
} from '../src/subscription/payouts';

describe('Payouts System', () => {
  describe('REVENUE_SPLIT', () => {
    it('should sum to 100%', () => {
      const total = REVENUE_SPLIT.providers + REVENUE_SPLIT.treasury + REVENUE_SPLIT.stakers;
      expect(total).toBeCloseTo(1, 10);
    });

    it('should have correct percentages', () => {
      expect(REVENUE_SPLIT.providers).toBe(0.7);
      expect(REVENUE_SPLIT.treasury).toBe(0.2);
      expect(REVENUE_SPLIT.stakers).toBe(0.1);
    });
  });

  describe('calculateProviderPayouts', () => {
    const mockProviders = [
      {
        wallet: 'provider1',
        signalsProvided: 10,
        totalScore: 800,
        wins: 7,
        losses: 3,
        winRate: 0.7,
        revenue: 0
      },
      {
        wallet: 'provider2',
        signalsProvided: 5,
        totalScore: 350,
        wins: 3,
        losses: 2,
        winRate: 0.6,
        revenue: 0
      },
      {
        wallet: 'provider3',
        signalsProvided: 0,
        totalScore: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        revenue: 0
      }
    ];

    it('should distribute based on performance', () => {
      const totalRevenue = 1000;
      const payouts = calculateProviderPayouts(totalRevenue, mockProviders);

      // Provider1 should get more than Provider2 (better stats)
      expect(payouts.get('provider1')).toBeGreaterThan(payouts.get('provider2') || 0);
    });

    it('should not pay providers with no signals', () => {
      const payouts = calculateProviderPayouts(1000, mockProviders);
      expect(payouts.has('provider3')).toBe(false);
    });

    it('should handle empty providers', () => {
      const payouts = calculateProviderPayouts(1000, []);
      expect(payouts.size).toBe(0);
    });

    it('should handle zero revenue', () => {
      const payouts = calculateProviderPayouts(0, mockProviders);

      for (const [_, amount] of payouts) {
        expect(amount).toBe(0);
      }
    });
  });

  describe('calculateDistribution', () => {
    it('should calculate full distribution', () => {
      const providers = [
        {
          wallet: 'provider1',
          signalsProvided: 10,
          totalScore: 800,
          wins: 7,
          losses: 3,
          winRate: 0.7,
          revenue: 0
        }
      ];

      const dist = calculateDistribution(1000, providers);

      expect(dist.treasury).toBe(200); // 20%
      expect(dist.stakers).toBe(100); // 10%
      expect(dist.total).toBe(1000);
    });
  });

  describe('recordPayout', () => {
    it('should create payout record', () => {
      const payout = recordPayout({
        recipient: 'wallet123',
        amount: 1000000,
        currency: 'SOL',
        reason: 'Provider payout',
        status: 'pending'
      });

      expect(payout.id).toBeDefined();
      expect(payout.timestamp).toBeDefined();
      expect(payout.recipient).toBe('wallet123');
      expect(payout.status).toBe('pending');
    });
  });

  describe('getPayoutHistory', () => {
    beforeAll(() => {
      // Add some test payouts
      recordPayout({
        recipient: 'walletA',
        amount: 100,
        currency: 'SOL',
        reason: 'test',
        status: 'completed'
      });
      recordPayout({
        recipient: 'walletA',
        amount: 200,
        currency: 'USDC',
        reason: 'test',
        status: 'pending'
      });
      recordPayout({
        recipient: 'walletB',
        amount: 300,
        currency: 'SOL',
        reason: 'test',
        status: 'completed'
      });
    });

    it('should return all payouts', () => {
      const history = getPayoutHistory();
      expect(history.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by wallet', () => {
      const history = getPayoutHistory('walletA');
      expect(history.every(p => p.recipient === 'walletA')).toBe(true);
    });
  });

  describe('getPendingPayouts', () => {
    it('should return only pending payouts', () => {
      const pending = getPendingPayouts();
      expect(pending.every(p => p.status === 'pending')).toBe(true);
    });
  });

  describe('updatePayoutStatus', () => {
    it('should update payout status', () => {
      const payout = recordPayout({
        recipient: 'testWallet',
        amount: 500,
        currency: 'SOL',
        reason: 'test update',
        status: 'pending'
      });

      const updated = updatePayoutStatus(payout.id, 'completed', 'tx123abc');
      expect(updated).toBe(true);

      const history = getPayoutHistory('testWallet');
      const found = history.find(p => p.id === payout.id);
      expect(found?.status).toBe('completed');
      expect(found?.txSignature).toBe('tx123abc');
    });

    it('should return false for invalid payout id', () => {
      const updated = updatePayoutStatus('invalid-id', 'completed');
      expect(updated).toBe(false);
    });
  });

  describe('getPayoutStats', () => {
    it('should return aggregated stats', () => {
      const stats = getPayoutStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('totalAmountSol');
      expect(stats).toHaveProperty('totalAmountUsdc');

      expect(stats.total).toBe(stats.completed + stats.pending + stats.failed);
    });
  });
});
