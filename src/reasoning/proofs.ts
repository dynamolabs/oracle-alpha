/**
 * Reasoning Proofs System
 *
 * Cryptographic commitment scheme for AI reasoning:
 * 1. Generate reasoning analysis BEFORE seeing outcome
 * 2. Hash the reasoning (commitment)
 * 3. Publish hash on-chain with signal
 * 4. After price moves, reveal reasoning to prove it was pre-committed
 *
 * This proves the AI "knew" its reasoning before the outcome,
 * making the oracle verifiable and trustless.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AggregatedSignal } from '../types';

// Storage for reasoning proofs (before reveal)
const PROOFS_DIR = path.join(__dirname, '../../data/reasoning-proofs');

export interface ReasoningProof {
  signalId: string;
  token: string;
  symbol: string;
  timestamp: number;

  // The commitment (published on-chain)
  reasoningHash: string;

  // The actual reasoning (kept secret until reveal)
  reasoning: {
    summary: string;
    bullishFactors: string[];
    bearishFactors: string[];
    priceTargets: {
      upside: string;
      downside: string;
      confidence: number;
    };
    keyRisks: string[];
    timeframe: string;
    conviction: 'HIGH' | 'MEDIUM' | 'LOW';
  };

  // Salt for hash uniqueness
  salt: string;

  // Metadata
  marketDataAtSignal: {
    price?: number;
    mcap: number;
    liquidity: number;
    volume5m: number;
  };

  // Reveal status
  revealed: boolean;
  revealedAt?: number;
  priceAtReveal?: number;
}

export interface CommitmentResult {
  hash: string;
  proof: ReasoningProof;
}

/**
 * Generate a cryptographic commitment to reasoning
 * Uses SHA-256(reasoning + salt) for collision resistance
 */
function generateHash(reasoning: ReasoningProof['reasoning'], salt: string): string {
  const data = JSON.stringify({
    reasoning,
    salt
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate random salt for hash uniqueness
 */
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate reasoning analysis for a signal
 * This is the "pre-commitment" - generated BEFORE knowing the outcome
 */
function generateReasoning(signal: AggregatedSignal): ReasoningProof['reasoning'] {
  const { sources, marketData, analysis, score, riskLevel } = signal;

  // Build comprehensive reasoning
  const bullishFactors: string[] = [];
  const bearishFactors: string[] = [];
  const keyRisks: string[] = [];

  // Analyze sources
  const hasEliteWallet = sources.some(s => s.source === 'smart-wallet-elite');
  const hasSniperWallet = sources.some(s => s.source === 'smart-wallet-sniper');
  const hasVolumeSpike = sources.some(s => s.source === 'volume-spike');
  const hasKOL = sources.some(s => s.source.includes('kol'));
  const hasPumpKOTH = sources.some(s => s.source === 'pump-koth');
  const hasWhale = sources.some(s => s.source === 'whale-tracker');

  if (hasEliteWallet) {
    bullishFactors.push('Elite smart wallet (70%+ historical WR) accumulating - strongest signal');
  }
  if (hasSniperWallet) {
    bullishFactors.push('Sniper wallet detected early entry - typically front-runs pumps');
  }
  if (hasVolumeSpike) {
    bullishFactors.push(
      `Volume spike detected - ${marketData.volume5m > 20000 ? 'significant' : 'moderate'} buying pressure`
    );
  }
  if (hasKOL) {
    bullishFactors.push('KOL/influencer activity detected - may drive retail FOMO');
  }
  if (hasPumpKOTH) {
    bullishFactors.push('Reached King of the Hill on pump.fun - high visibility');
  }
  if (hasWhale) {
    bullishFactors.push('Whale accumulation pattern identified');
  }
  if (sources.length >= 3) {
    bullishFactors.push(`Strong confluence: ${sources.length} independent signal sources`);
  }

  // Market data analysis
  if (marketData.mcap < 100000) {
    bullishFactors.push(
      `Low mcap ($${(marketData.mcap / 1000).toFixed(1)}K) - high upside potential`
    );
    keyRisks.push('Very low mcap = high volatility and rug risk');
  } else if (marketData.mcap < 300000) {
    bullishFactors.push('Ideal entry mcap range for growth plays');
  } else {
    bearishFactors.push(`Higher mcap ($${(marketData.mcap / 1000).toFixed(1)}K) may limit upside`);
  }

  if (marketData.liquidity < 10000) {
    bearishFactors.push(
      `Low liquidity ($${(marketData.liquidity / 1000).toFixed(1)}K) - slippage risk`
    );
    keyRisks.push('May be difficult to exit at desired price');
  }

  if (marketData.age && marketData.age < 15) {
    bullishFactors.push('Fresh token - early entry opportunity');
    keyRisks.push('New tokens have higher rug risk');
  } else if (marketData.age && marketData.age > 60) {
    bearishFactors.push('Token age suggests initial pump may be over');
  }

  // Single source warning
  if (sources.length === 1) {
    bearishFactors.push('Single signal source - no confluence confirmation');
    keyRisks.push('Single source signals have lower reliability');
  }

  // Generate price targets based on mcap and signals
  const currentMcap = marketData.mcap;
  let upsideMultiple = 2;
  let downsidePercent = 30;

  if (hasEliteWallet && score >= 80) {
    upsideMultiple = 5;
    downsidePercent = 20;
  } else if (score >= 70) {
    upsideMultiple = 3;
    downsidePercent = 25;
  } else if (score >= 60) {
    upsideMultiple = 2;
    downsidePercent = 35;
  } else {
    upsideMultiple = 1.5;
    downsidePercent = 50;
  }

  const upsideTarget = currentMcap * upsideMultiple;
  const downsideTarget = currentMcap * (1 - downsidePercent / 100);

  // Determine conviction
  let conviction: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (score >= 80 && riskLevel !== 'EXTREME') {
    conviction = 'HIGH';
  } else if (score >= 65) {
    conviction = 'MEDIUM';
  }

  // Generate summary
  const sourceNames = sources.map(s => s.source).join(', ');
  const summary =
    `Signal detected for $${signal.symbol} at $${(currentMcap / 1000).toFixed(1)}K mcap. ` +
    `Score: ${score}/100, Risk: ${riskLevel}. ` +
    `Sources: ${sourceNames}. ` +
    (hasEliteWallet ? 'Elite wallet participation is the strongest bullish indicator. ' : '') +
    (sources.length >= 3 ? 'Multiple signal confluence increases confidence. ' : '') +
    `Primary thesis: ${analysis.recommendation}`;

  return {
    summary,
    bullishFactors,
    bearishFactors,
    priceTargets: {
      upside: `$${(upsideTarget / 1000).toFixed(1)}K mcap (${upsideMultiple}x)`,
      downside: `$${(downsideTarget / 1000).toFixed(1)}K mcap (-${downsidePercent}%)`,
      confidence: score
    },
    keyRisks,
    timeframe: marketData.age && marketData.age < 30 ? '1-4 hours' : '4-24 hours',
    conviction
  };
}

/**
 * Create a reasoning commitment for a signal
 * Returns hash (for on-chain) and full proof (stored locally)
 */
export function createCommitment(signal: AggregatedSignal): CommitmentResult {
  // Generate the reasoning BEFORE knowing outcome
  const reasoning = generateReasoning(signal);

  // Generate random salt
  const salt = generateSalt();

  // Create hash commitment
  const hash = generateHash(reasoning, salt);

  // Create full proof
  const proof: ReasoningProof = {
    signalId: signal.id,
    token: signal.token,
    symbol: signal.symbol,
    timestamp: signal.timestamp,
    reasoningHash: hash,
    reasoning,
    salt,
    marketDataAtSignal: {
      price: signal.marketData.price,
      mcap: signal.marketData.mcap,
      liquidity: signal.marketData.liquidity,
      volume5m: signal.marketData.volume5m
    },
    revealed: false
  };

  return { hash, proof };
}

/**
 * Store a reasoning proof locally (before reveal)
 */
export async function storeProof(proof: ReasoningProof): Promise<void> {
  // Ensure directory exists
  if (!fs.existsSync(PROOFS_DIR)) {
    fs.mkdirSync(PROOFS_DIR, { recursive: true });
  }

  const filePath = path.join(PROOFS_DIR, `${proof.signalId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(proof, null, 2));
}

/**
 * Load a reasoning proof
 */
export function loadProof(signalId: string): ReasoningProof | null {
  const filePath = path.join(PROOFS_DIR, `${signalId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * List all proofs
 */
export function listProofs(): ReasoningProof[] {
  if (!fs.existsSync(PROOFS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(PROOFS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(PROOFS_DIR, f), 'utf-8')));
}

/**
 * Verify a revealed proof matches its hash
 * Anyone can verify by hashing reasoning+salt and comparing to on-chain hash
 */
export function verifyProof(proof: ReasoningProof): boolean {
  const computedHash = generateHash(proof.reasoning, proof.salt);
  return computedHash === proof.reasoningHash;
}

/**
 * Reveal a proof (after price movement)
 */
export async function revealProof(
  signalId: string,
  currentPrice?: number
): Promise<ReasoningProof | null> {
  const proof = loadProof(signalId);
  if (!proof) {
    return null;
  }

  proof.revealed = true;
  proof.revealedAt = Date.now();
  if (currentPrice !== undefined) {
    proof.priceAtReveal = currentPrice;
  }

  await storeProof(proof);
  return proof;
}

/**
 * Get unrevealed proofs older than specified minutes
 */
export function getProofsReadyForReveal(minAgeMinutes: number = 60): ReasoningProof[] {
  const proofs = listProofs();
  const now = Date.now();
  const minAgeMs = minAgeMinutes * 60 * 1000;

  return proofs.filter(p => !p.revealed && now - p.timestamp > minAgeMs);
}

/**
 * Format proof for display
 */
export function formatProofForDisplay(proof: ReasoningProof, includeHash: boolean = true): string {
  const lines: string[] = [];

  lines.push(`🧠 REASONING PROOF: $${proof.symbol}`);
  lines.push('═'.repeat(40));

  if (includeHash) {
    lines.push(`\n🔐 Commitment Hash: ${proof.reasoningHash.slice(0, 16)}...`);
    lines.push(`📅 Committed: ${new Date(proof.timestamp).toISOString()}`);
    lines.push(`✅ Verified: ${verifyProof(proof) ? 'VALID' : 'INVALID'}`);
  }

  lines.push('\n📊 ANALYSIS AT SIGNAL TIME:');
  lines.push(proof.reasoning.summary);

  lines.push('\n✅ BULLISH FACTORS:');
  proof.reasoning.bullishFactors.forEach(f => lines.push(`  • ${f}`));

  if (proof.reasoning.bearishFactors.length > 0) {
    lines.push('\n⚠️ BEARISH FACTORS:');
    proof.reasoning.bearishFactors.forEach(f => lines.push(`  • ${f}`));
  }

  lines.push('\n🎯 PRICE TARGETS:');
  lines.push(`  Upside: ${proof.reasoning.priceTargets.upside}`);
  lines.push(`  Downside: ${proof.reasoning.priceTargets.downside}`);

  lines.push(`\n⚡ Conviction: ${proof.reasoning.conviction}`);
  lines.push(`⏱️ Timeframe: ${proof.reasoning.timeframe}`);

  if (proof.revealed && proof.priceAtReveal !== undefined) {
    const entryMcap = proof.marketDataAtSignal.mcap;
    const roi = (((proof.priceAtReveal - entryMcap) / entryMcap) * 100).toFixed(1);
    lines.push(`\n📈 OUTCOME: ${roi}% ROI at reveal`);
  }

  return lines.join('\n');
}

/**
 * Convert hash to bytes array for on-chain storage (32 bytes)
 */
export function hashToBytes(hash: string): number[] {
  const buffer = Buffer.from(hash, 'hex');
  return Array.from(buffer);
}

/**
 * Convert bytes array back to hex hash
 */
export function bytesToHash(bytes: number[]): string {
  return Buffer.from(bytes).toString('hex');
}
