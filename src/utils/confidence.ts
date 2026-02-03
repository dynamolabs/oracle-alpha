// Confidence calculation utilities
// Provides more sophisticated scoring based on signal confluence

interface ConfluenceFactors {
  sourceCount: number;
  hasEliteWallet: boolean;
  hasSniperWallet: boolean;
  hasVolumeSpike: boolean;
  hasKOL: boolean;
  hasNarrative: boolean;
  narrativeStrength: number;
  marketCapUsd: number;
  ageMinutes: number;
  buyRatio: number;
}

// Calculate confluence bonus
export function calculateConfluenceBonus(factors: ConfluenceFactors): number {
  let bonus = 0;
  
  // Multi-source bonus (exponential)
  if (factors.sourceCount >= 3) bonus += 15;
  else if (factors.sourceCount >= 2) bonus += 8;
  
  // Elite wallet is huge signal
  if (factors.hasEliteWallet) bonus += 20;
  
  // Elite + Volume spike = strong confluence
  if (factors.hasEliteWallet && factors.hasVolumeSpike) bonus += 10;
  
  // Sniper + KOL = social + smart money
  if (factors.hasSniperWallet && factors.hasKOL) bonus += 8;
  
  // Hot narrative bonus
  if (factors.narrativeStrength > 0.8) bonus += 10;
  else if (factors.narrativeStrength > 0.6) bonus += 5;
  
  // Early stage bonus (more upside)
  if (factors.marketCapUsd < 50000) bonus += 10;
  else if (factors.marketCapUsd < 100000) bonus += 5;
  
  // Fresh token bonus
  if (factors.ageMinutes < 10) bonus += 10;
  else if (factors.ageMinutes < 30) bonus += 5;
  
  // Strong buy pressure bonus
  if (factors.buyRatio >= 80) bonus += 10;
  else if (factors.buyRatio >= 70) bonus += 5;
  
  return bonus;
}

// Calculate confluence penalty
export function calculateConfluencePenalty(factors: ConfluenceFactors): number {
  let penalty = 0;
  
  // Single source is weak
  if (factors.sourceCount === 1) penalty += 10;
  
  // Old token penalty
  if (factors.ageMinutes > 120) penalty += 10;
  else if (factors.ageMinutes > 60) penalty += 5;
  
  // Large mcap penalty (less upside)
  if (factors.marketCapUsd > 1000000) penalty += 15;
  else if (factors.marketCapUsd > 500000) penalty += 10;
  
  // Weak buy pressure
  if (factors.buyRatio < 50) penalty += 15;
  else if (factors.buyRatio < 60) penalty += 5;
  
  return penalty;
}

// Get final adjusted score
export function calculateAdjustedScore(baseScore: number, factors: ConfluenceFactors): number {
  const bonus = calculateConfluenceBonus(factors);
  const penalty = calculateConfluencePenalty(factors);
  
  const adjusted = baseScore + bonus - penalty;
  
  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}

// Determine confidence level text
export function getConfidenceLevel(score: number): string {
  if (score >= 85) return 'VERY HIGH';
  if (score >= 70) return 'HIGH';
  if (score >= 55) return 'MODERATE';
  if (score >= 40) return 'LOW';
  return 'VERY LOW';
}

// Get recommended action based on score
export function getRecommendedAction(score: number, riskLevel: string): string {
  if (score >= 85) {
    return '🔥 STRONG BUY - Multiple high-quality signals, low risk';
  }
  if (score >= 75) {
    if (riskLevel === 'LOW' || riskLevel === 'MEDIUM') {
      return '⚡ BUY - Good confluence, acceptable risk';
    }
    return '⚡ SPECULATIVE BUY - Good signal but higher risk';
  }
  if (score >= 65) {
    return '✨ WATCH CLOSELY - Moderate confidence, wait for confirmation';
  }
  if (score >= 50) {
    return '👀 MONITOR - Needs more signal confluence';
  }
  return '⏸️ PASS - Insufficient confidence';
}
