import {
  generateApiKey,
  validateApiKey,
  checkRateLimit,
  revokeApiKey,
  updateApiKeyTier,
  getApiKeyStats,
  listApiKeys
} from '../src/api/auth';

describe('API Key Authentication', () => {
  let testKey: string;
  let testKeyHash: string;

  beforeAll(() => {
    const result = generateApiKey('Test Key', 'basic', 'testWallet123');
    testKey = result.key;
    // Hash the key to get keyHash for other operations
    const crypto = require('crypto');
    testKeyHash = crypto.createHash('sha256').update(testKey).digest('hex');
  });

  describe('generateApiKey', () => {
    it('should generate unique API keys', () => {
      const key1 = generateApiKey('Key 1', 'free');
      const key2 = generateApiKey('Key 2', 'free');

      expect(key1.key).not.toBe(key2.key);
    });

    it('should set correct tier properties', () => {
      const proKey = generateApiKey('Pro Key', 'pro');

      expect(proKey.record.tier).toBe('pro');
      expect(proKey.record.rateLimit).toBe(100);
    });

    it('should mask key in record', () => {
      const result = generateApiKey('Test', 'free');

      expect(result.record.key).toContain('...');
      expect(result.record.key).not.toBe(result.key);
    });

    it('should initialize stats correctly', () => {
      const result = generateApiKey('Test', 'free');

      expect(result.record.requestCount).toBe(0);
      expect(result.record.lastUsed).toBe(0);
      expect(result.record.enabled).toBe(true);
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API key', () => {
      const record = validateApiKey(testKey);

      expect(record).not.toBeNull();
      expect(record?.tier).toBe('basic');
    });

    it('should return null for invalid key', () => {
      const record = validateApiKey('invalid_key');

      expect(record).toBeNull();
    });

    it('should return null for empty key', () => {
      const record = validateApiKey('');

      expect(record).toBeNull();
    });

    it('should update usage stats on validation', () => {
      const before = validateApiKey(testKey);
      const requestCount = before?.requestCount || 0;

      validateApiKey(testKey);
      const after = validateApiKey(testKey);

      expect(after?.requestCount).toBeGreaterThan(requestCount);
      expect(after?.lastUsed).toBeGreaterThan(0);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const result = checkRateLimit('test-key-hash', 100);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(100);
    });

    it('should track request count', () => {
      const key = 'rate-limit-test-' + Date.now();

      const first = checkRateLimit(key, 10);
      const second = checkRateLimit(key, 10);

      expect(second.remaining).toBeLessThan(first.remaining);
    });

    it('should deny when limit exceeded', () => {
      const key = 'exceed-test-' + Date.now();

      // Make 11 requests with limit of 10
      for (let i = 0; i < 11; i++) {
        checkRateLimit(key, 10);
      }

      const result = checkRateLimit(key, 10);
      expect(result.allowed).toBe(false);
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke existing key', () => {
      const { key } = generateApiKey('Revoke Test', 'free');
      const crypto = require('crypto');
      const keyHash = crypto.createHash('sha256').update(key).digest('hex');

      const result = revokeApiKey(keyHash);
      expect(result).toBe(true);

      // Key should no longer validate
      const validation = validateApiKey(key);
      expect(validation).toBeNull();
    });

    it('should return false for non-existent key', () => {
      const result = revokeApiKey('non-existent-hash');
      expect(result).toBe(false);
    });
  });

  describe('updateApiKeyTier', () => {
    it('should update tier', () => {
      const { key } = generateApiKey('Tier Test', 'free');
      const crypto = require('crypto');
      const keyHash = crypto.createHash('sha256').update(key).digest('hex');

      updateApiKeyTier(keyHash, 'whale');

      const record = validateApiKey(key);
      expect(record?.tier).toBe('whale');
      expect(record?.rateLimit).toBe(1000);
    });
  });

  describe('getApiKeyStats', () => {
    it('should return stats for valid key', () => {
      const stats = getApiKeyStats(testKeyHash);

      expect(stats).not.toBeNull();
      expect(stats).toHaveProperty('requestCount');
      expect(stats).toHaveProperty('tier');
      expect(stats).toHaveProperty('rateLimit');
    });

    it('should return null for invalid key', () => {
      const stats = getApiKeyStats('invalid-hash');

      expect(stats).toBeNull();
    });
  });

  describe('listApiKeys', () => {
    it('should return list of keys', () => {
      const keys = listApiKeys();

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should not include key hash in list', () => {
      const keys = listApiKeys();

      for (const key of keys) {
        expect(key).not.toHaveProperty('keyHash');
      }
    });
  });
});
