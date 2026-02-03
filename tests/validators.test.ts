import {
  signalQuerySchema,
  paginationSchema,
  tokenAddressSchema,
  webhookSchema,
  alertConfigSchema
} from '../src/api/validators';

describe('Validators', () => {
  describe('signalQuerySchema', () => {
    it('should validate correct query params', () => {
      const result = signalQuerySchema.parse({
        minScore: '70',
        maxAge: '30',
        limit: '10'
      });
      
      expect(result.minScore).toBe(70);
      expect(result.maxAge).toBe(30);
      expect(result.limit).toBe(10);
    });

    it('should use default limit', () => {
      const result = signalQuerySchema.parse({});
      expect(result.limit).toBe(20);
    });

    it('should reject invalid minScore', () => {
      expect(() => signalQuerySchema.parse({ minScore: '150' }))
        .toThrow();
    });

    it('should reject negative minScore', () => {
      expect(() => signalQuerySchema.parse({ minScore: '-10' }))
        .toThrow();
    });

    it('should coerce string to number', () => {
      const result = signalQuerySchema.parse({ minScore: '75' });
      expect(typeof result.minScore).toBe('number');
    });
  });

  describe('paginationSchema', () => {
    it('should validate pagination params', () => {
      const result = paginationSchema.parse({ page: '2', limit: '50' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should use defaults', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should reject limit over 100', () => {
      expect(() => paginationSchema.parse({ limit: '200' }))
        .toThrow();
    });
  });

  describe('tokenAddressSchema', () => {
    it('should accept valid Solana address', () => {
      const address = 'GJBSNozHsCVhrLtgRHPkPR2M2hMsua68bWizU8X2pump';
      expect(tokenAddressSchema.parse(address)).toBe(address);
    });

    it('should reject invalid address', () => {
      expect(() => tokenAddressSchema.parse('invalid'))
        .toThrow('Invalid Solana address format');
    });

    it('should reject address with invalid characters', () => {
      expect(() => tokenAddressSchema.parse('0OIl11111111111111111111111111111'))
        .toThrow();
    });
  });

  describe('webhookSchema', () => {
    it('should validate correct webhook config', () => {
      const result = webhookSchema.parse({
        url: 'https://example.com/webhook',
        events: ['signal.new', 'signal.win'],
        minScore: 75
      });
      
      expect(result.url).toBe('https://example.com/webhook');
      expect(result.events).toContain('signal.new');
    });

    it('should reject invalid URL', () => {
      expect(() => webhookSchema.parse({
        url: 'not-a-url',
        events: ['signal.new']
      })).toThrow();
    });

    it('should reject invalid events', () => {
      expect(() => webhookSchema.parse({
        url: 'https://example.com',
        events: ['invalid.event']
      })).toThrow();
    });

    it('should validate secret length', () => {
      expect(() => webhookSchema.parse({
        url: 'https://example.com',
        events: ['signal.new'],
        secret: 'short'
      })).toThrow();
    });
  });

  describe('alertConfigSchema', () => {
    it('should validate alert config with defaults', () => {
      const result = alertConfigSchema.parse({});
      
      expect(result.minScore).toBe(70);
      expect(result.maxAge).toBe(30);
      expect(result.enabled).toBe(true);
    });

    it('should accept custom values', () => {
      const result = alertConfigSchema.parse({
        minScore: 80,
        sources: ['smart-wallet-elite'],
        narratives: ['AI/Agents'],
        enabled: false
      });
      
      expect(result.minScore).toBe(80);
      expect(result.sources).toContain('smart-wallet-elite');
      expect(result.enabled).toBe(false);
    });
  });
});
