import {
  getHealthStatus,
  isHealthy,
  isReady,
  isLive,
  updateComponentHealth,
  trackRequest,
  setActiveConnections,
  initiateShutdown,
  isShutdownInitiated
} from '../src/api/health';

describe('Health Check System', () => {
  describe('getHealthStatus', () => {
    it('should return complete health status', () => {
      const status = getHealthStatus();

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('timestamp');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('checks');
      expect(status).toHaveProperty('metrics');
    });

    it('should have all component checks', () => {
      const status = getHealthStatus();

      expect(status.checks).toHaveProperty('api');
      expect(status.checks).toHaveProperty('database');
      expect(status.checks).toHaveProperty('onchain');
      expect(status.checks).toHaveProperty('external');
    });

    it('should have metrics', () => {
      const status = getHealthStatus();

      expect(status.metrics).toHaveProperty('requestsPerMinute');
      expect(status.metrics).toHaveProperty('errorRate');
      expect(status.metrics).toHaveProperty('avgResponseTime');
      expect(status.metrics).toHaveProperty('activeConnections');
    });
  });

  describe('isHealthy', () => {
    it('should return boolean', () => {
      const result = isHealthy();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isReady', () => {
    it('should return true when API is up', () => {
      updateComponentHealth('api', 'up');
      expect(isReady()).toBe(true);
    });
  });

  describe('isLive', () => {
    it('should return true when process is running', () => {
      expect(isLive()).toBe(true);
    });
  });

  describe('updateComponentHealth', () => {
    it('should update component status', () => {
      updateComponentHealth('onchain', 'up', 50, 'Connected');
      const status = getHealthStatus();

      expect(status.checks.onchain.status).toBe('up');
      expect(status.checks.onchain.latency).toBe(50);
      expect(status.checks.onchain.message).toBe('Connected');
    });

    it('should update lastCheck timestamp', () => {
      const before = Date.now();
      updateComponentHealth('external', 'up');
      const status = getHealthStatus();

      expect(status.checks.external.lastCheck).toBeGreaterThanOrEqual(before);
    });
  });

  describe('trackRequest', () => {
    it('should track requests without error', () => {
      expect(() => trackRequest(100, false)).not.toThrow();
      expect(() => trackRequest(200, true)).not.toThrow();
    });
  });

  describe('setActiveConnections', () => {
    it('should update active connections', () => {
      setActiveConnections(5);
      const status = getHealthStatus();
      expect(status.metrics.activeConnections).toBe(5);
    });
  });

  describe('Shutdown', () => {
    it('should track shutdown state', () => {
      expect(isShutdownInitiated()).toBe(false);
      initiateShutdown();
      expect(isShutdownInitiated()).toBe(true);
    });
  });
});
