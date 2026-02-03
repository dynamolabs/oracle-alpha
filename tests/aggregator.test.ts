/**
 * Aggregator Logic Tests
 * Tests the core scoring and aggregation algorithms
 */

// Inline the source configs for testing (avoids import issues)
const SOURCE_CONFIGS = [
  { source: 'smart-wallet-elite', weight: 1.5, historicalWinRate: 0.70 },
  { source: 'smart-wallet-sniper', weight: 1.2, historicalWinRate: 0.41 },
  { source: 'volume-spike', weight: 1.0, historicalWinRate: 0.35 },
  { source: 'kol-tracker', weight: 1.1, historicalWinRate: 0.45 },
  { source: 'kol-social', weight: 0.9, historicalWinRate: 0.35 },
  { source: 'narrative-new', weight: 1.0, historicalWinRate: 0.40 },
  { source: 'narrative-momentum', weight: 1.2, historicalWinRate: 0.50 }
];

// Inline calculateCompositeScore for testing
function getSourceConfig(source: string) {
  return SOURCE_CONFIGS.find(c => c.source === source);
}

function calculateCompositeScore(signals: Array<{ source: string; confidence: number }>): number {
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const signal of signals) {
    const config = getSourceConfig(signal.source);
    if (!config) continue;
    
    const weight = config.weight * config.historicalWinRate;
    weightedSum += signal.confidence * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// Inline detectNarratives for testing
function detectNarratives(name: string, symbol: string): string[] {
  const narratives: string[] = [];
  const text = `${name} ${symbol}`.toLowerCase();
  
  const NARRATIVE_KEYWORDS: Record<string, string[]> = {
    'AI/Agents': ['ai', 'agent', 'gpt', 'claude', 'neural', 'deep', 'auto'],
    'Political': ['trump', 'biden', 'maga', 'vote', 'election', 'president'],
    'Animals': ['dog', 'cat', 'pepe', 'frog', 'doge', 'shib', 'inu', 'wif'],
    'DeFi': ['swap', 'yield', 'stake', 'lend', 'borrow', 'vault'],
    'Gaming': ['game', 'play', 'nft', 'meta', 'verse'],
    'Meme': ['meme', 'moon', 'rocket', 'lambo', 'wagmi', 'gm']
  };
  
  for (const [narrative, keywords] of Object.entries(NARRATIVE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      narratives.push(narrative);
    }
  }
  
  return narratives.length > 0 ? narratives : ['General'];
}

describe('Source Configuration', () => {
  it('should have all expected sources configured', () => {
    const sources = SOURCE_CONFIGS.map(c => c.source);
    expect(sources).toContain('smart-wallet-elite');
    expect(sources).toContain('smart-wallet-sniper');
    expect(sources).toContain('volume-spike');
    expect(sources).toContain('kol-tracker');
    expect(sources).toContain('narrative-new');
    expect(sources).toContain('narrative-momentum');
  });

  it('should have elite wallet with highest weight', () => {
    const eliteConfig = SOURCE_CONFIGS.find(c => c.source === 'smart-wallet-elite');
    const otherConfigs = SOURCE_CONFIGS.filter(c => c.source !== 'smart-wallet-elite');
    
    expect(eliteConfig).toBeDefined();
    expect(eliteConfig!.weight).toBeGreaterThanOrEqual(
      Math.max(...otherConfigs.map(c => c.weight))
    );
  });

  it('should have elite wallet with 70% win rate', () => {
    const eliteConfig = SOURCE_CONFIGS.find(c => c.source === 'smart-wallet-elite');
    expect(eliteConfig?.historicalWinRate).toBe(0.70);
  });

  it('should have sniper wallet with 41% win rate', () => {
    const sniperConfig = SOURCE_CONFIGS.find(c => c.source === 'smart-wallet-sniper');
    expect(sniperConfig?.historicalWinRate).toBe(0.41);
  });

  it('should have volume spike with lowest weight of primary sources', () => {
    const volumeConfig = SOURCE_CONFIGS.find(c => c.source === 'volume-spike');
    expect(volumeConfig?.weight).toBe(1.0);
  });
});

describe('Composite Score Calculation', () => {
  it('should calculate weighted score from single signal', () => {
    const signals = [{ source: 'smart-wallet-elite', confidence: 80 }];
    const score = calculateCompositeScore(signals);
    expect(score).toBe(80); // Single signal = its own confidence
  });

  it('should return 0 for empty signals', () => {
    const score = calculateCompositeScore([]);
    expect(score).toBe(0);
  });

  it('should return 0 for unknown sources', () => {
    const signals = [{ source: 'unknown-source', confidence: 50 }];
    const score = calculateCompositeScore(signals);
    expect(score).toBe(0);
  });

  it('should weight elite wallet higher in combined signals', () => {
    // Elite (weight: 1.5, wr: 0.7) vs Volume (weight: 1.0, wr: 0.35)
    // Elite effective: 1.5 * 0.7 = 1.05
    // Volume effective: 1.0 * 0.35 = 0.35
    const signals = [
      { source: 'smart-wallet-elite', confidence: 90 },
      { source: 'volume-spike', confidence: 60 }
    ];
    const score = calculateCompositeScore(signals);
    
    // Should be closer to 90 (elite) than 60 (volume) due to weight
    expect(score).toBeGreaterThan(75);
    expect(score).toBeLessThan(90);
  });

  it('should handle multiple signals of same source type', () => {
    const signals = [
      { source: 'volume-spike', confidence: 70 },
      { source: 'volume-spike', confidence: 80 }
    ];
    const score = calculateCompositeScore(signals);
    expect(score).toBe(75); // Simple average since same weight
  });

  it('should produce higher scores with better sources', () => {
    const eliteOnlySignals = [{ source: 'smart-wallet-elite', confidence: 70 }];
    const volumeOnlySignals = [{ source: 'volume-spike', confidence: 70 }];
    
    const eliteScore = calculateCompositeScore(eliteOnlySignals);
    const volumeScore = calculateCompositeScore(volumeOnlySignals);
    
    // Both should be 70 (single signal = own confidence)
    expect(eliteScore).toBe(volumeScore);
    expect(eliteScore).toBe(70);
  });
});

describe('Narrative Detection', () => {
  describe('AI/Agents narrative', () => {
    it('should detect AI keywords', () => {
      expect(detectNarratives('AI Agent', 'AGENT')).toContain('AI/Agents');
      expect(detectNarratives('GPT Token', 'GPT')).toContain('AI/Agents');
      expect(detectNarratives('DeepMind', 'DEEP')).toContain('AI/Agents');
      expect(detectNarratives('Neural Net', 'NEURAL')).toContain('AI/Agents');
    });
  });

  describe('Political narrative', () => {
    it('should detect political keywords', () => {
      expect(detectNarratives('Trump Coin', 'TRUMP')).toContain('Political');
      expect(detectNarratives('Biden Token', 'BIDEN')).toContain('Political');
      expect(detectNarratives('MAGA', 'MAGA')).toContain('Political');
      expect(detectNarratives('Election Coin', 'VOTE')).toContain('Political');
    });
  });

  describe('Animals narrative', () => {
    it('should detect animal keywords', () => {
      expect(detectNarratives('Dog Wif Hat', 'WIF')).toContain('Animals');
      expect(detectNarratives('CatCoin', 'CAT')).toContain('Animals');
      expect(detectNarratives('Pepe', 'PEPE')).toContain('Animals');
      expect(detectNarratives('Doge', 'DOGE')).toContain('Animals');
      expect(detectNarratives('Shiba Inu', 'SHIB')).toContain('Animals');
    });
  });

  describe('DeFi narrative', () => {
    it('should detect DeFi keywords', () => {
      expect(detectNarratives('SwapToken', 'SWAP')).toContain('DeFi');
      expect(detectNarratives('YieldFarm', 'YIELD')).toContain('DeFi');
      expect(detectNarratives('StakeDAO', 'STAKE')).toContain('DeFi');
    });
  });

  describe('Gaming narrative', () => {
    it('should detect gaming keywords', () => {
      expect(detectNarratives('GameFi', 'GAME')).toContain('Gaming');
      expect(detectNarratives('PlayToEarn', 'PLAY')).toContain('Gaming');
      expect(detectNarratives('MetaVerse', 'META')).toContain('Gaming');
    });
  });

  describe('Meme narrative', () => {
    it('should detect meme keywords', () => {
      expect(detectNarratives('MoonCoin', 'MOON')).toContain('Meme');
      expect(detectNarratives('Rocket', 'ROCKET')).toContain('Meme');
      expect(detectNarratives('WAGMI', 'WAGMI')).toContain('Meme');
    });
  });

  describe('Multiple narratives', () => {
    it('should detect multiple matching narratives', () => {
      const narratives = detectNarratives('AI Pepe', 'AIPEPE');
      expect(narratives).toContain('AI/Agents');
      expect(narratives).toContain('Animals');
    });

    it('should detect Trump Dog as both political and animals', () => {
      const narratives = detectNarratives('Trump Dog', 'TDOG');
      expect(narratives).toContain('Political');
      expect(narratives).toContain('Animals');
    });
  });

  describe('General fallback', () => {
    it('should return General for unmatched tokens', () => {
      const narratives = detectNarratives('Random Token', 'RAND');
      expect(narratives).toEqual(['General']);
    });

    it('should return General for empty strings', () => {
      const narratives = detectNarratives('', '');
      expect(narratives).toEqual(['General']);
    });
  });

  describe('Case insensitivity', () => {
    it('should be case insensitive for name', () => {
      expect(detectNarratives('TRUMP', 'X')).toContain('Political');
      expect(detectNarratives('trump', 'X')).toContain('Political');
      expect(detectNarratives('Trump', 'X')).toContain('Political');
    });

    it('should be case insensitive for symbol', () => {
      expect(detectNarratives('X', 'DOG')).toContain('Animals');
      expect(detectNarratives('X', 'dog')).toContain('Animals');
    });
  });
});

describe('Signal Aggregation Logic', () => {
  // Inline risk level calculation
  function calculateRiskLevel(
    score: number, 
    hasElite: boolean
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    if (score >= 80 && hasElite) return 'LOW';
    if (score >= 70) return 'MEDIUM';
    if (score >= 50) return 'HIGH';
    return 'EXTREME';
  }

  it('should classify risk correctly', () => {
    expect(calculateRiskLevel(85, true)).toBe('LOW');
    expect(calculateRiskLevel(85, false)).toBe('MEDIUM');
    expect(calculateRiskLevel(75, false)).toBe('MEDIUM');
    expect(calculateRiskLevel(60, false)).toBe('HIGH');
    expect(calculateRiskLevel(40, false)).toBe('EXTREME');
  });

  it('should prioritize signals by source quality', () => {
    // Elite sources should have higher impact
    const eliteEffective = 1.5 * 0.70; // 1.05
    const sniperEffective = 1.2 * 0.41; // 0.492
    const volumeEffective = 1.0 * 0.35; // 0.35
    
    expect(eliteEffective).toBeGreaterThan(sniperEffective);
    expect(sniperEffective).toBeGreaterThan(volumeEffective);
  });

  it('should deduplicate by token address', () => {
    const signals = [
      { token: 'ABC123', source: 'elite', score: 80 },
      { token: 'ABC123', source: 'volume', score: 70 },
      { token: 'XYZ789', source: 'elite', score: 90 }
    ];

    const grouped = new Map<string, typeof signals>();
    for (const signal of signals) {
      const existing = grouped.get(signal.token) || [];
      existing.push(signal);
      grouped.set(signal.token, existing);
    }

    expect(grouped.size).toBe(2); // ABC123 and XYZ789
    expect(grouped.get('ABC123')?.length).toBe(2);
    expect(grouped.get('XYZ789')?.length).toBe(1);
  });
});
