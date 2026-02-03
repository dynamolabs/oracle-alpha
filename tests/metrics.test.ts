import {
  updateMetrics,
  incrementRequests,
  incrementErrors,
  setWebsocketClients,
  recordScan,
  getPrometheusMetrics,
  getMetricsJson
} from '../src/api/metrics';

describe('Metrics Module', () => {
  describe('getPrometheusMetrics', () => {
    it('should return Prometheus-formatted metrics', () => {
      const metrics = getPrometheusMetrics();
      
      expect(metrics).toContain('# HELP oracle_signals_total');
      expect(metrics).toContain('# TYPE oracle_signals_total counter');
      expect(metrics).toContain('oracle_signals_total');
      expect(metrics).toContain('oracle_api_requests_total');
      expect(metrics).toContain('oracle_win_rate');
    });

    it('should include all required metrics', () => {
      const metrics = getPrometheusMetrics();
      const requiredMetrics = [
        'signals_total',
        'signals_published',
        'signals_win',
        'signals_loss',
        'signals_open',
        'avg_score',
        'avg_roi',
        'api_requests_total',
        'api_requests_errors',
        'websocket_clients',
        'win_rate'
      ];

      for (const metric of requiredMetrics) {
        expect(metrics).toContain(`oracle_${metric}`);
      }
    });
  });

  describe('getMetricsJson', () => {
    it('should return JSON object with all metrics', () => {
      const metrics = getMetricsJson();
      
      expect(metrics).toHaveProperty('signalsTotal');
      expect(metrics).toHaveProperty('signalsPublished');
      expect(metrics).toHaveProperty('signalsWin');
      expect(metrics).toHaveProperty('signalsLoss');
      expect(metrics).toHaveProperty('apiRequestsTotal');
      expect(metrics).toHaveProperty('winRate');
    });

    it('should calculate win rate correctly', () => {
      // Reset metrics by updating with known values
      updateMetrics({
        signalsWin: 7,
        signalsLoss: 3
      });
      
      const metrics = getMetricsJson();
      expect(metrics.winRate).toBe(70); // 7/10 = 70%
    });

    it('should handle zero division for win rate', () => {
      updateMetrics({
        signalsWin: 0,
        signalsLoss: 0
      });
      
      const metrics = getMetricsJson();
      expect(metrics.winRate).toBe(0);
    });
  });

  describe('incrementRequests', () => {
    it('should increment request counter', () => {
      const before = getMetricsJson().apiRequestsTotal;
      incrementRequests();
      incrementRequests();
      incrementRequests();
      const after = getMetricsJson().apiRequestsTotal;
      
      expect(after).toBe(before + 3);
    });
  });

  describe('incrementErrors', () => {
    it('should increment error counter', () => {
      const before = getMetricsJson().apiRequestsErrors;
      incrementErrors();
      const after = getMetricsJson().apiRequestsErrors;
      
      expect(after).toBe(before + 1);
    });
  });

  describe('setWebsocketClients', () => {
    it('should set websocket client count', () => {
      setWebsocketClients(5);
      expect(getMetricsJson().websocketClients).toBe(5);
      
      setWebsocketClients(10);
      expect(getMetricsJson().websocketClients).toBe(10);
    });
  });

  describe('recordScan', () => {
    it('should record scan metrics', () => {
      const beforeTimestamp = Date.now();
      recordScan(15, 250);
      const metrics = getMetricsJson();
      
      expect(metrics.scanDurationMs).toBe(250);
      expect(metrics.lastScanTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    });
  });

  describe('updateMetrics', () => {
    it('should update multiple metrics at once', () => {
      updateMetrics({
        avgScore: 75.5,
        avgRoi: 34.2,
        signalsOpen: 12
      });
      
      const metrics = getMetricsJson();
      expect(metrics.avgScore).toBe(75.5);
      expect(metrics.avgRoi).toBe(34.2);
      expect(metrics.signalsOpen).toBe(12);
    });
  });
});
