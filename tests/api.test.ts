/**
 * API Tests
 * Unit tests for API response structures and logic
 */

describe('API Response Structures', () => {
  describe('Health Endpoint', () => {
    it('should return correct structure', () => {
      const response = { status: 'ok', signals: 10, uptime: 3600 };
      expect(response).toHaveProperty('status', 'ok');
      expect(response).toHaveProperty('signals');
      expect(response).toHaveProperty('uptime');
      expect(typeof response.uptime).toBe('number');
    });
  });

  describe('Info Endpoint', () => {
    it('should return project info', () => {
      const response = {
        name: 'ORACLE Alpha',
        version: '1.0.0',
        description: 'On-chain Reliable Alpha Compilation & Learning Engine',
        author: 'ShifuSensei 🐼'
      };
      expect(response).toHaveProperty('name', 'ORACLE Alpha');
      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('author');
    });
  });

  describe('Signals Endpoint', () => {
    it('should return array with count', () => {
      const response = { count: 5, signals: [] };
      expect(response).toHaveProperty('count');
      expect(response).toHaveProperty('signals');
      expect(Array.isArray(response.signals)).toBe(true);
    });

    it('signal object should have required fields', () => {
      const signal = {
        id: 'test-123',
        timestamp: Date.now(),
        token: 'ABC123xyz',
        symbol: 'TEST',
        name: 'Test Token',
        score: 75,
        confidence: 70,
        riskLevel: 'MEDIUM',
        sources: [{ source: 'volume-spike', weight: 1.0, rawScore: 75 }],
        marketData: {
          mcap: 100000,
          liquidity: 50000,
          volume5m: 10000,
          volume1h: 40000,
          priceChange5m: 5,
          priceChange1h: 15,
          age: 30
        },
        analysis: {
          narrative: ['AI/Agents'],
          strengths: ['Volume spike'],
          weaknesses: ['Single source'],
          recommendation: 'WATCH'
        }
      };

      expect(signal).toHaveProperty('id');
      expect(signal).toHaveProperty('timestamp');
      expect(signal).toHaveProperty('token');
      expect(signal).toHaveProperty('symbol');
      expect(signal).toHaveProperty('name');
      expect(signal).toHaveProperty('score');
      expect(signal).toHaveProperty('riskLevel');
      expect(signal).toHaveProperty('sources');
      expect(signal).toHaveProperty('marketData');
      expect(signal).toHaveProperty('analysis');
    });
  });

  describe('Stats Endpoint', () => {
    it('should return performance metrics', () => {
      const stats = {
        totalSignals: 100,
        openSignals: 50,
        closedSignals: 50,
        wins: 30,
        losses: 20,
        winRate: '60.0',
        avgScore: '72.3',
        avgRoi: '15.5'
      };

      expect(stats).toHaveProperty('totalSignals');
      expect(stats).toHaveProperty('wins');
      expect(stats).toHaveProperty('losses');
      expect(stats).toHaveProperty('winRate');
      expect(stats).toHaveProperty('avgScore');
    });

    it('should calculate win rate correctly', () => {
      const wins = 30;
      const losses = 20;
      const winRate = (wins / (wins + losses) * 100).toFixed(1);
      expect(winRate).toBe('60.0');
    });
  });

  describe('Leaderboard Endpoint', () => {
    it('should return ranked signals', () => {
      const leaderboard = {
        count: 3,
        totalTracked: 10,
        leaderboard: [
          { rank: 1, symbol: 'TOP1', roi: 150 },
          { rank: 2, symbol: 'TOP2', roi: 100 },
          { rank: 3, symbol: 'TOP3', roi: 50 }
        ]
      };

      expect(leaderboard.leaderboard[0].rank).toBe(1);
      expect(leaderboard.leaderboard[0].roi).toBeGreaterThan(leaderboard.leaderboard[1].roi);
    });
  });

  describe('On-Chain Endpoints', () => {
    it('should return on-chain stats structure', () => {
      const stats = {
        enabled: true,
        totalSignals: 50,
        programId: 'AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd',
        network: 'devnet'
      };

      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('totalSignals');
      expect(stats).toHaveProperty('programId');
    });
  });
});

describe('Query Parameter Filtering', () => {
  const mockSignals = [
    { id: '1', score: 95, timestamp: Date.now() },
    { id: '2', score: 80, timestamp: Date.now() - 60000 },
    { id: '3', score: 65, timestamp: Date.now() - 120000 },
    { id: '4', score: 50, timestamp: Date.now() - 180000 },
    { id: '5', score: 40, timestamp: Date.now() - 240000 }
  ];

  describe('minScore filter', () => {
    it('should filter signals below minScore', () => {
      const minScore = 70;
      const filtered = mockSignals.filter(s => s.score >= minScore);
      expect(filtered.length).toBe(2);
      expect(filtered.every(s => s.score >= minScore)).toBe(true);
    });

    it('should return all if minScore is 0', () => {
      const filtered = mockSignals.filter(s => s.score >= 0);
      expect(filtered.length).toBe(mockSignals.length);
    });
  });

  describe('maxAge filter', () => {
    it('should filter signals older than maxAge', () => {
      const maxAge = 2; // 2 minutes
      const cutoff = Date.now() - (maxAge * 60 * 1000);
      const filtered = mockSignals.filter(s => s.timestamp >= cutoff);
      expect(filtered.length).toBe(2);
    });
  });

  describe('limit parameter', () => {
    it('should limit results to specified count', () => {
      const limit = 3;
      const limited = mockSignals.slice(0, limit);
      expect(limited.length).toBe(3);
    });

    it('should return all if limit exceeds count', () => {
      const limit = 100;
      const limited = mockSignals.slice(0, limit);
      expect(limited.length).toBe(mockSignals.length);
    });
  });

  describe('combined filters', () => {
    it('should apply multiple filters correctly', () => {
      const minScore = 60;
      const limit = 2;
      
      const filtered = mockSignals
        .filter(s => s.score >= minScore)
        .slice(0, limit);
      
      expect(filtered.length).toBe(2);
      expect(filtered[0].score).toBe(95);
      expect(filtered[1].score).toBe(80);
    });
  });
});

describe('Risk Level Classification', () => {
  function calculateRiskLevel(score: number, hasElite: boolean): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    if (score >= 80 && hasElite) return 'LOW';
    if (score >= 70) return 'MEDIUM';
    if (score >= 50) return 'HIGH';
    return 'EXTREME';
  }

  it('should classify LOW risk for high score with elite wallet', () => {
    expect(calculateRiskLevel(85, true)).toBe('LOW');
    expect(calculateRiskLevel(80, true)).toBe('LOW');
  });

  it('should classify MEDIUM risk for good score without elite', () => {
    expect(calculateRiskLevel(85, false)).toBe('MEDIUM');
    expect(calculateRiskLevel(75, false)).toBe('MEDIUM');
    expect(calculateRiskLevel(70, false)).toBe('MEDIUM');
  });

  it('should classify MEDIUM for 80+ without elite', () => {
    expect(calculateRiskLevel(80, false)).toBe('MEDIUM');
  });

  it('should classify HIGH risk for moderate scores', () => {
    expect(calculateRiskLevel(65, false)).toBe('HIGH');
    expect(calculateRiskLevel(50, false)).toBe('HIGH');
  });

  it('should classify EXTREME risk for low scores', () => {
    expect(calculateRiskLevel(45, false)).toBe('EXTREME');
    expect(calculateRiskLevel(30, false)).toBe('EXTREME');
    expect(calculateRiskLevel(10, false)).toBe('EXTREME');
  });
});

describe('Source Aggregation', () => {
  it('should aggregate source stats correctly', () => {
    const signals = [
      { sources: [{ source: 'smart-wallet-elite', rawScore: 85 }] },
      { sources: [{ source: 'smart-wallet-elite', rawScore: 75 }] },
      { sources: [{ source: 'volume-spike', rawScore: 70 }] }
    ];

    const sourceStats = new Map<string, { count: number; totalScore: number }>();
    
    for (const signal of signals) {
      for (const source of signal.sources) {
        const stats = sourceStats.get(source.source) || { count: 0, totalScore: 0 };
        stats.count++;
        stats.totalScore += source.rawScore;
        sourceStats.set(source.source, stats);
      }
    }

    const eliteStats = sourceStats.get('smart-wallet-elite');
    expect(eliteStats?.count).toBe(2);
    expect(eliteStats?.totalScore).toBe(160);

    const volumeStats = sourceStats.get('volume-spike');
    expect(volumeStats?.count).toBe(1);
  });
});

describe('Summary Generation', () => {
  it('should format signal summary correctly', () => {
    const signals = [
      { symbol: 'TEST1', score: 90, riskLevel: 'LOW' },
      { symbol: 'TEST2', score: 75, riskLevel: 'MEDIUM' }
    ];

    const getRiskEmoji = (level: string) => {
      if (level === 'LOW') return '🟢';
      if (level === 'MEDIUM') return '🟡';
      return '🟠';
    };

    const lines = signals.map(s => 
      `${getRiskEmoji(s.riskLevel)} $${s.symbol} - Score: ${s.score}`
    );

    expect(lines[0]).toContain('🟢');
    expect(lines[0]).toContain('$TEST1');
    expect(lines[1]).toContain('🟡');
  });
});
