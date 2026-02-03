/**
 * Demo Signal Generator
 * Generates realistic trading signals for demo/presentation purposes
 *
 * Usage:
 *   DEMO_MODE=true npm start
 *   or
 *   npx ts-node src/demo/generator.ts
 */

import { AggregatedSignal, SignalSource, RiskLevel } from '../types';

// Simple UUID generator (avoids ESM issues with uuid package in tests)
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Realistic token names for demo
const DEMO_TOKENS = [
  { symbol: 'AIXBT', name: 'AI Agent XBT', narratives: ['AI', 'Agent'] },
  { symbol: 'GROK', name: 'Grok AI', narratives: ['AI', 'Meme'] },
  { symbol: 'TRUMP', name: 'Official Trump', narratives: ['Political', 'Celebrity'] },
  { symbol: 'PEPE2', name: 'Pepe 2.0', narratives: ['Meme'] },
  { symbol: 'DOGE420', name: 'Doge 420', narratives: ['Meme', 'Cannabis'] },
  { symbol: 'SOLAI', name: 'Solana AI', narratives: ['AI', 'Solana'] },
  { symbol: 'WOJAK', name: 'Wojak Coin', narratives: ['Meme'] },
  { symbol: 'ELON', name: 'Elon Mars', narratives: ['Celebrity', 'Space'] },
  { symbol: 'CATGPT', name: 'Cat GPT', narratives: ['AI', 'Meme', 'Cat'] },
  { symbol: 'BONKAI', name: 'Bonk AI', narratives: ['AI', 'Meme'] },
  { symbol: 'PUMPKING', name: 'Pump King', narratives: ['Meme', 'Meta'] },
  { symbol: 'AGENTX', name: 'Agent X Protocol', narratives: ['AI', 'Agent', 'DeFi'] },
  { symbol: 'MAGA24', name: 'MAGA 2024', narratives: ['Political'] },
  { symbol: 'WIF2', name: 'Dogwifhat 2', narratives: ['Meme', 'Dog'] },
  { symbol: 'GMGN', name: 'GM GN Token', narratives: ['Meme', 'Culture'] },
  { symbol: 'ALPHA', name: 'Alpha Finder', narratives: ['Meta', 'Trading'] },
  { symbol: 'NEURAL', name: 'Neural Network', narratives: ['AI', 'Tech'] },
  { symbol: 'FROGAI', name: 'Frog AI', narratives: ['AI', 'Meme'] },
  { symbol: 'BULLRUN', name: 'Bull Run 2026', narratives: ['Meta', 'Bullish'] },
  { symbol: 'MOONBOT', name: 'Moon Bot', narratives: ['AI', 'Trading'] }
];

// Source combinations for realistic signals
const SOURCE_COMBOS: { sources: SignalSource[]; weight: number }[] = [
  { sources: ['smart-wallet-elite'], weight: 1.5 },
  { sources: ['smart-wallet-elite', 'volume-spike'], weight: 2.0 },
  { sources: ['smart-wallet-sniper', 'kol-tracker'], weight: 1.6 },
  { sources: ['volume-spike', 'narrative-momentum'], weight: 1.3 },
  { sources: ['smart-wallet-elite', 'kol-tracker', 'volume-spike'], weight: 2.5 },
  { sources: ['new-launch', 'narrative-new'], weight: 1.0 },
  { sources: ['whale-tracker', 'volume-spike'], weight: 1.4 },
  { sources: ['kol-tracker', 'kol-social'], weight: 1.2 },
  { sources: ['smart-wallet-sniper'], weight: 1.2 },
  { sources: ['pump-koth', 'volume-spike'], weight: 1.8 }
];

// Generate random Solana address
function randomAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate realistic market data
function generateMarketData(): AggregatedSignal['marketData'] {
  const mcap = Math.floor(Math.random() * 900000) + 50000; // 50K - 950K
  const volume5m = Math.floor(mcap * (Math.random() * 0.3 + 0.05)); // 5-35% of mcap
  const volume1h = volume5m * (Math.random() * 8 + 4); // 4-12x 5m volume
  const holders = Math.floor(Math.random() * 800) + 50;
  const age = Math.floor(Math.random() * 120) + 1; // 1-120 minutes
  const priceChange5m = Math.floor(Math.random() * 40) - 10; // -10% to +30%
  const priceChange1h = Math.floor(Math.random() * 80) - 20; // -20% to +60%

  return {
    price: mcap / 1000000000, // Assuming 1B supply
    mcap,
    volume5m,
    volume1h,
    holders,
    age,
    liquidity: mcap * (Math.random() * 0.2 + 0.1),
    priceChange5m,
    priceChange1h
  };
}

// Calculate score based on sources
function calculateScore(sources: SignalSource[]): number {
  let baseScore = 45 + Math.floor(Math.random() * 25); // 45-70 base

  // Boost for elite wallet
  if (sources.includes('smart-wallet-elite')) baseScore += 15;
  if (sources.includes('smart-wallet-sniper')) baseScore += 8;

  // Boost for confluence
  if (sources.length >= 3) baseScore += 12;
  else if (sources.length >= 2) baseScore += 6;

  // Boost for volume spike
  if (sources.includes('volume-spike')) baseScore += 5;

  // Boost for KOL
  if (sources.includes('kol-tracker')) baseScore += 5;

  // Cap at 95
  return Math.min(95, Math.max(35, baseScore));
}

// Determine risk level from score
function getRiskLevel(score: number, sourceCount: number): RiskLevel {
  if (score >= 80 && sourceCount >= 2) return 'LOW';
  if (score >= 65) return 'MEDIUM';
  if (score >= 50) return 'HIGH';
  return 'EXTREME';
}

// Generate a single demo signal
export function generateDemoSignal(): AggregatedSignal {
  const token = DEMO_TOKENS[Math.floor(Math.random() * DEMO_TOKENS.length)];
  const sourceCombo = SOURCE_COMBOS[Math.floor(Math.random() * SOURCE_COMBOS.length)];
  const marketData = generateMarketData();
  const score = calculateScore(sourceCombo.sources);
  const riskLevel = getRiskLevel(score, sourceCombo.sources.length);

  const signal: AggregatedSignal = {
    id: generateId(),
    token: randomAddress(),
    symbol: token.symbol,
    name: token.name,
    sources: sourceCombo.sources.map(source => ({
      source,
      weight: source.includes('elite') ? 1.5 : source.includes('sniper') ? 1.2 : 1.0,
      rawScore: 50 + Math.floor(Math.random() * 40)
    })),
    score,
    confidence: score + Math.floor(Math.random() * 10) - 5,
    riskLevel,
    marketData,
    analysis: {
      narrative: token.narratives,
      recommendation:
        score > 80
          ? 'Strong confluence detected. Consider entry with tight stop loss.'
          : score > 65
            ? 'Moderate signal strength. DYOR before entry.'
            : 'Weak signal. High risk, proceed with caution.',
      strengths: [
        sourceCombo.sources.includes('smart-wallet-elite')
          ? 'Elite wallet (70% WR) detected buying'
          : null,
        sourceCombo.sources.includes('volume-spike')
          ? 'Volume spike: ' + Math.floor(marketData.volume5m / 1000) + 'K in 5m'
          : null,
        sourceCombo.sources.includes('kol-tracker') ? 'KOL mention detected' : null,
        sourceCombo.sources.length >= 2 ? 'Multiple source confluence' : null,
        marketData.mcap < 200000 ? 'Low mcap entry opportunity' : null
      ].filter(Boolean) as string[],
      weaknesses: [
        sourceCombo.sources.length === 1 ? 'Single source signal' : null,
        marketData.mcap > 500000 ? 'Higher mcap, less upside' : null
      ].filter(Boolean) as string[]
    },
    timestamp: Date.now(),
    published: false
  };

  return signal;
}

// Generate batch of signals
export function generateDemoSignals(count: number = 5): AggregatedSignal[] {
  const signals: AggregatedSignal[] = [];
  const usedSymbols = new Set<string>();

  for (let i = 0; i < count; i++) {
    let signal = generateDemoSignal();
    // Avoid duplicate symbols in same batch
    let attempts = 0;
    while (usedSymbols.has(signal.symbol) && attempts < 10) {
      signal = generateDemoSignal();
      attempts++;
    }
    usedSymbols.add(signal.symbol);
    signals.push(signal);
  }

  // Sort by score descending
  return signals.sort((a, b) => b.score - a.score);
}

// Demo mode runner - generates signals at interval
export class DemoRunner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private onSignal: (signal: AggregatedSignal) => void;
  private signalsPerMinute: number;

  constructor(onSignal: (signal: AggregatedSignal) => void, signalsPerMinute: number = 3) {
    this.onSignal = onSignal;
    this.signalsPerMinute = signalsPerMinute;
  }

  start(): void {
    console.log(`[DEMO] Starting demo mode - ${this.signalsPerMinute} signals/minute`);

    // Generate initial batch
    const initial = generateDemoSignals(3);
    initial.forEach(s => this.onSignal(s));

    // Generate at interval
    const intervalMs = (60 / this.signalsPerMinute) * 1000;
    this.interval = setInterval(() => {
      const signal = generateDemoSignal();
      console.log(`[DEMO] Generated signal: $${signal.symbol} (score: ${signal.score})`);
      this.onSignal(signal);
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[DEMO] Demo mode stopped');
    }
  }
}

// Historical signals generator (for track record)
export function generateHistoricalSignals(count: number = 50): (AggregatedSignal & {
  closed: boolean;
  exitPrice?: number;
  athPrice?: number;
  roi?: number;
  result?: 'WIN' | 'LOSS';
})[] {
  const signals = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const signal = generateDemoSignal();
    const age = Math.floor(Math.random() * 7) + 1; // 1-7 days ago
    signal.timestamp = now - age * dayMs - Math.floor(Math.random() * dayMs);

    // Simulate outcome based on score (higher score = more likely to win)
    const winProbability = (signal.score / 100) * 0.8; // Max 80% win rate
    const isWin = Math.random() < winProbability;

    const entryPrice = signal.marketData.price || signal.marketData.mcap / 1000000000;
    let athMultiplier: number;
    let exitMultiplier: number;

    if (isWin) {
      athMultiplier = 1.5 + Math.random() * 3.5; // 1.5x - 5x
      exitMultiplier = 1.2 + Math.random() * (athMultiplier - 1.2); // Exit between 1.2x and ATH
    } else {
      athMultiplier = 1 + Math.random() * 0.8; // 1x - 1.8x
      exitMultiplier = 0.3 + Math.random() * 0.4; // Exit at 30-70% loss
    }

    signals.push({
      ...signal,
      closed: true,
      exitPrice: entryPrice * exitMultiplier,
      athPrice: entryPrice * athMultiplier,
      roi: (exitMultiplier - 1) * 100,
      result: isWin ? ('WIN' as const) : ('LOSS' as const),
      published: true
    });
  }

  return signals.sort((a, b) => b.timestamp - a.timestamp);
}

// CLI runner
if (require.main === module) {
  console.log('🎬 Demo Signal Generator\n');

  console.log('Sample signals:');
  const samples = generateDemoSignals(5);
  samples.forEach(s => {
    console.log(
      `  $${s.symbol.padEnd(10)} Score: ${s.score} | Risk: ${s.riskLevel.padEnd(7)} | MCap: $${(s.marketData.mcap / 1000).toFixed(0)}K | Sources: ${s.sources.map(x => x.source).join(', ')}`
    );
  });

  console.log('\nHistorical performance (last 50 signals):');
  const historical = generateHistoricalSignals(50);
  const wins = historical.filter(s => s.result === 'WIN').length;
  const avgRoi = historical.reduce((sum, s) => sum + (s.roi || 0), 0) / historical.length;
  console.log(`  Win Rate: ${((wins / historical.length) * 100).toFixed(1)}%`);
  console.log(`  Avg ROI: ${avgRoi > 0 ? '+' : ''}${avgRoi.toFixed(1)}%`);
}
