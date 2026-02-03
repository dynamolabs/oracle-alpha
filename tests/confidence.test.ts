import {
  calculateConfluenceBonus,
  calculateConfluencePenalty,
  calculateAdjustedScore,
  getConfidenceLevel,
  getRecommendedAction
} from '../src/utils/confidence';

describe('Confidence Utilities', () => {
  describe('calculateConfluenceBonus', () => {
    it('should give bonus for multiple sources', () => {
      const factors = {
        sourceCount: 3,
        hasEliteWallet: false,
        hasSniperWallet: false,
        hasVolumeSpike: false,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 200000,
        ageMinutes: 60,
        buyRatio: 60
      };
      expect(calculateConfluenceBonus(factors)).toBe(15);
    });

    it('should give large bonus for elite wallet', () => {
      const factors = {
        sourceCount: 1,
        hasEliteWallet: true,
        hasSniperWallet: false,
        hasVolumeSpike: false,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 200000,
        ageMinutes: 60,
        buyRatio: 60
      };
      expect(calculateConfluenceBonus(factors)).toBe(20);
    });

    it('should give compound bonus for elite + volume spike', () => {
      const factors = {
        sourceCount: 2,
        hasEliteWallet: true,
        hasSniperWallet: false,
        hasVolumeSpike: true,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 200000,
        ageMinutes: 60,
        buyRatio: 60
      };
      // 8 (2 sources) + 20 (elite) + 10 (elite+volume) = 38
      expect(calculateConfluenceBonus(factors)).toBe(38);
    });

    it('should give bonus for fresh low-cap tokens', () => {
      const factors = {
        sourceCount: 1,
        hasEliteWallet: false,
        hasSniperWallet: false,
        hasVolumeSpike: false,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 30000,
        ageMinutes: 5,
        buyRatio: 85
      };
      // 10 (low mcap) + 10 (fresh) + 10 (strong buy) = 30
      expect(calculateConfluenceBonus(factors)).toBe(30);
    });

    it('should give bonus for hot narrative', () => {
      const factors = {
        sourceCount: 1,
        hasEliteWallet: false,
        hasSniperWallet: false,
        hasVolumeSpike: false,
        hasKOL: false,
        hasNarrative: true,
        narrativeStrength: 0.9,
        marketCapUsd: 200000,
        ageMinutes: 60,
        buyRatio: 60
      };
      expect(calculateConfluenceBonus(factors)).toBe(10);
    });
  });

  describe('calculateConfluencePenalty', () => {
    it('should penalize single source', () => {
      const factors = {
        sourceCount: 1,
        hasEliteWallet: false,
        hasSniperWallet: false,
        hasVolumeSpike: false,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 200000,
        ageMinutes: 30,
        buyRatio: 60
      };
      expect(calculateConfluencePenalty(factors)).toBe(10);
    });

    it('should penalize old tokens', () => {
      const factors = {
        sourceCount: 2,
        hasEliteWallet: false,
        hasSniperWallet: false,
        hasVolumeSpike: false,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 200000,
        ageMinutes: 180,
        buyRatio: 60
      };
      expect(calculateConfluencePenalty(factors)).toBe(10);
    });

    it('should penalize large mcap tokens', () => {
      const factors = {
        sourceCount: 2,
        hasEliteWallet: false,
        hasSniperWallet: false,
        hasVolumeSpike: false,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 2000000,
        ageMinutes: 30,
        buyRatio: 60
      };
      expect(calculateConfluencePenalty(factors)).toBe(15);
    });

    it('should penalize weak buy pressure', () => {
      const factors = {
        sourceCount: 2,
        hasEliteWallet: false,
        hasSniperWallet: false,
        hasVolumeSpike: false,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 200000,
        ageMinutes: 30,
        buyRatio: 40
      };
      expect(calculateConfluencePenalty(factors)).toBe(15);
    });
  });

  describe('calculateAdjustedScore', () => {
    it('should adjust score with bonus and penalty', () => {
      const factors = {
        sourceCount: 3,
        hasEliteWallet: true,
        hasSniperWallet: false,
        hasVolumeSpike: true,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 30000,
        ageMinutes: 5,
        buyRatio: 85
      };
      const baseScore = 50;
      const adjusted = calculateAdjustedScore(baseScore, factors);
      // Should be boosted significantly
      expect(adjusted).toBeGreaterThan(baseScore + 30);
    });

    it('should clamp score to 0-100', () => {
      const maxFactors = {
        sourceCount: 5,
        hasEliteWallet: true,
        hasSniperWallet: true,
        hasVolumeSpike: true,
        hasKOL: true,
        hasNarrative: true,
        narrativeStrength: 1,
        marketCapUsd: 10000,
        ageMinutes: 1,
        buyRatio: 95
      };
      expect(calculateAdjustedScore(90, maxFactors)).toBeLessThanOrEqual(100);

      const minFactors = {
        sourceCount: 1,
        hasEliteWallet: false,
        hasSniperWallet: false,
        hasVolumeSpike: false,
        hasKOL: false,
        hasNarrative: false,
        narrativeStrength: 0,
        marketCapUsd: 5000000,
        ageMinutes: 500,
        buyRatio: 20
      };
      expect(calculateAdjustedScore(10, minFactors)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getConfidenceLevel', () => {
    it('should return correct confidence levels', () => {
      expect(getConfidenceLevel(90)).toBe('VERY HIGH');
      expect(getConfidenceLevel(75)).toBe('HIGH');
      expect(getConfidenceLevel(60)).toBe('MODERATE');
      expect(getConfidenceLevel(45)).toBe('LOW');
      expect(getConfidenceLevel(30)).toBe('VERY LOW');
    });
  });

  describe('getRecommendedAction', () => {
    it('should return STRONG BUY for high scores', () => {
      const action = getRecommendedAction(90, 'LOW');
      expect(action).toContain('STRONG BUY');
    });

    it('should return BUY for good scores with acceptable risk', () => {
      const action = getRecommendedAction(78, 'MEDIUM');
      expect(action).toContain('BUY');
    });

    it('should return SPECULATIVE for good scores with high risk', () => {
      const action = getRecommendedAction(78, 'HIGH');
      expect(action).toContain('SPECULATIVE');
    });

    it('should return WATCH for moderate scores', () => {
      const action = getRecommendedAction(68, 'MEDIUM');
      expect(action).toContain('WATCH');
    });

    it('should return MONITOR for low scores', () => {
      const action = getRecommendedAction(55, 'HIGH');
      expect(action).toContain('MONITOR');
    });

    it('should return PASS for very low scores', () => {
      const action = getRecommendedAction(40, 'EXTREME');
      expect(action).toContain('PASS');
    });
  });
});
