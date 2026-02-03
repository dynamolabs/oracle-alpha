import {
  getAllTiers,
  getTier,
  filterSignalsForTier,
  hasAccess,
  TIERS
} from '../src/subscription/manager';

describe('Subscription Manager', () => {
  describe('getAllTiers', () => {
    it('should return all subscription tiers', () => {
      const tiers = getAllTiers();
      expect(tiers).toHaveLength(4);
      expect(tiers.map(t => t.id)).toEqual(['free', 'basic', 'pro', 'whale']);
    });

    it('should have increasing prices', () => {
      const tiers = getAllTiers();
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].price).toBeGreaterThan(tiers[i - 1].price);
      }
    });
  });

  describe('getTier', () => {
    it('should return correct tier by id', () => {
      const freeTier = getTier('free');
      expect(freeTier).toBeDefined();
      expect(freeTier?.name).toBe('Free');
      expect(freeTier?.price).toBe(0);

      const proTier = getTier('pro');
      expect(proTier).toBeDefined();
      expect(proTier?.name).toBe('Pro');
      expect(proTier?.price).toBe(99);
    });

    it('should return undefined for invalid tier', () => {
      const tier = getTier('invalid');
      expect(tier).toBeUndefined();
    });
  });

  describe('Tier Properties', () => {
    it('free tier should have highest minScore and delay', () => {
      const free = getTier('free')!;
      expect(free.minScore).toBe(80);
      expect(free.delaySeconds).toBe(900); // 15 minutes
      expect(free.webhooksEnabled).toBe(false);
    });

    it('whale tier should have no restrictions', () => {
      const whale = getTier('whale')!;
      expect(whale.minScore).toBe(0);
      expect(whale.delaySeconds).toBe(0);
      expect(whale.webhooksEnabled).toBe(true);
      expect(whale.apiRateLimit).toBe(1000);
    });

    it('pro tier should have real-time access', () => {
      const pro = getTier('pro')!;
      expect(pro.delaySeconds).toBe(0);
      expect(pro.onChainAlerts).toBe(true);
    });
  });

  describe('filterSignalsForTier', () => {
    const mockSignals = [
      { score: 90, timestamp: Date.now() - 1000000 }, // Old, high score
      { score: 75, timestamp: Date.now() - 1000000 }, // Old, medium score
      { score: 60, timestamp: Date.now() - 1000000 }, // Old, low score
      { score: 85, timestamp: Date.now() - 60000 }, // 1 min ago, high score
      { score: 50, timestamp: Date.now() - 60000 } // 1 min ago, very low score
    ];

    it('should filter for free tier (score >= 80, 15 min delay)', () => {
      const freeTier = getTier('free')!;
      const filtered = filterSignalsForTier(mockSignals, freeTier);

      // Only old signals with score >= 80
      expect(filtered.length).toBe(1);
      expect(filtered[0].score).toBe(90);
    });

    it('should filter for basic tier (score >= 70, 5 min delay)', () => {
      const basicTier = getTier('basic')!;
      const filtered = filterSignalsForTier(mockSignals, basicTier);

      // Old signals with score >= 70
      expect(filtered.length).toBe(2);
    });

    it('should allow all for whale tier', () => {
      const whaleTier = getTier('whale')!;
      const filtered = filterSignalsForTier(mockSignals, whaleTier);

      expect(filtered.length).toBe(mockSignals.length);
    });
  });

  describe('hasAccess', () => {
    it('should deny access for low score on free tier', () => {
      const subscription = {
        wallet: 'test',
        tier: 'free',
        expiresAt: Date.now() + 1000,
        createdAt: Date.now(),
        tokenBalance: 0
      };
      expect(hasAccess(subscription, 70, 1000000)).toBe(false); // Score too low
    });

    it('should allow access for high score and old signal on free tier', () => {
      const subscription = {
        wallet: 'test',
        tier: 'free',
        expiresAt: Date.now() + 1000,
        createdAt: Date.now(),
        tokenBalance: 0
      };
      expect(hasAccess(subscription, 85, 1000000)).toBe(true); // Score high, signal old
    });

    it('should deny access for fresh signal on free tier', () => {
      const subscription = {
        wallet: 'test',
        tier: 'free',
        expiresAt: Date.now() + 1000,
        createdAt: Date.now(),
        tokenBalance: 0
      };
      expect(hasAccess(subscription, 90, 60000)).toBe(false); // Signal too fresh (1 min)
    });

    it('should allow fresh signals for pro tier', () => {
      const subscription = {
        wallet: 'test',
        tier: 'pro',
        expiresAt: Date.now() + 1000,
        createdAt: Date.now(),
        tokenBalance: 500
      };
      expect(hasAccess(subscription, 60, 0)).toBe(true); // Real-time access
    });

    it('should handle null subscription as free tier', () => {
      expect(hasAccess(null, 90, 1000000)).toBe(true); // High score, old signal
      expect(hasAccess(null, 70, 1000000)).toBe(false); // Score too low for free
    });
  });
});
