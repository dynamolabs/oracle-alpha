/**
 * Risk Calculator & Position Sizing
 * 
 * Provides smart position sizing based on:
 * - Kelly Criterion for optimal bet sizing
 * - Risk-adjusted position sizing
 * - Stop loss calculation based on volatility
 * - Take profit targets (2x, 3x, 5x)
 */

import { AggregatedSignal, RiskLevel } from '../types';

// Position sizing rules by risk level
export const POSITION_RULES: Record<RiskLevel, { maxPercent: number; label: string; color: string }> = {
  LOW: { maxPercent: 10, label: 'Conservative', color: '#22c55e' },
  MEDIUM: { maxPercent: 8, label: 'Moderate', color: '#eab308' },
  HIGH: { maxPercent: 5, label: 'Aggressive', color: '#f97316' },
  EXTREME: { maxPercent: 2, label: 'High Risk', color: '#ef4444' }
};

export interface RiskCalculationInput {
  portfolioSize: number;          // Total portfolio value in USD
  riskPercent: number;            // Risk tolerance (1-10%)
  signal?: AggregatedSignal;      // Optional signal for context
  signalId?: string;              // Signal ID to fetch
  customScore?: number;           // Override score
  customRiskLevel?: RiskLevel;    // Override risk level
  customVolatility?: number;      // Override volatility (0-100)
}

export interface StopLossLevel {
  percent: number;
  price: number;
  label: string;
  type: 'tight' | 'normal' | 'wide';
}

export interface TakeProfitLevel {
  multiplier: number;
  percent: number;
  price: number;
  label: string;
  probability: number;  // Estimated probability of hitting
}

export interface RiskCalculationResult {
  // Input summary
  portfolioSize: number;
  riskPercent: number;
  signalScore: number;
  riskLevel: RiskLevel;
  
  // Position sizing
  recommendedPosition: number;         // Recommended position size in USD
  recommendedPositionPercent: number;  // As percentage of portfolio
  maxPosition: number;                 // Maximum allowed based on rules
  maxPositionPercent: number;          // Max as percentage
  kellyPosition: number;               // Kelly Criterion optimal
  kellyPositionPercent: number;        // Kelly as percentage
  
  // Risk metrics
  riskAmount: number;                  // Amount at risk (based on stop loss)
  rewardRisk: number;                  // Reward/Risk ratio (using 2x target)
  expectedValue: number;               // Expected value of trade
  
  // Stop loss levels
  stopLoss: StopLossLevel[];
  recommendedStopLoss: StopLossLevel;
  
  // Take profit targets
  takeProfit: TakeProfitLevel[];
  
  // Position sizing breakdown
  breakdown: {
    basePosition: number;
    scoreMultiplier: number;
    riskAdjustment: number;
    volatilityAdjustment: number;
    finalPosition: number;
  };
  
  // Warnings and recommendations
  warnings: string[];
  recommendations: string[];
  
  // Confidence
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Metadata
  calculatedAt: number;
  version: string;
}

/**
 * Calculate Kelly Criterion position size
 * Kelly % = (bp - q) / b
 * where:
 *   b = odds received on the bet (win/loss ratio)
 *   p = probability of winning
 *   q = probability of losing (1-p)
 */
function calculateKellyCriterion(
  winProbability: number,
  winAmount: number,
  lossAmount: number
): number {
  const p = winProbability;
  const q = 1 - p;
  const b = winAmount / lossAmount;
  
  const kelly = (b * p - q) / b;
  
  // Return 0 if kelly is negative (don't bet)
  // Cap at 25% for safety (half-Kelly is common)
  return Math.max(0, Math.min(kelly * 0.5, 0.25));
}

/**
 * Estimate win probability based on signal score
 * Higher scores = higher probability
 */
function estimateWinProbability(score: number): number {
  // Base probability of 40%, scales up to 75% for perfect score
  const base = 0.4;
  const bonus = (score / 100) * 0.35;
  return Math.min(base + bonus, 0.75);
}

/**
 * Calculate volatility-adjusted stop loss
 */
function calculateStopLossLevels(
  currentPrice: number,
  volatility: number,
  riskLevel: RiskLevel
): StopLossLevel[] {
  // Base stop loss percentages adjusted by volatility
  const baseStops = {
    tight: 0.05,   // 5%
    normal: 0.10,  // 10%
    wide: 0.20     // 20%
  };
  
  // Volatility multiplier (higher volatility = wider stops)
  const volMultiplier = 1 + (volatility / 100) * 0.5;
  
  // Risk level adjustment
  const riskMultiplier = {
    LOW: 0.8,
    MEDIUM: 1.0,
    HIGH: 1.2,
    EXTREME: 1.5
  }[riskLevel];
  
  return [
    {
      type: 'tight' as const,
      percent: baseStops.tight * volMultiplier * riskMultiplier * 100,
      price: currentPrice * (1 - baseStops.tight * volMultiplier * riskMultiplier),
      label: 'Tight (Scalp)'
    },
    {
      type: 'normal' as const,
      percent: baseStops.normal * volMultiplier * riskMultiplier * 100,
      price: currentPrice * (1 - baseStops.normal * volMultiplier * riskMultiplier),
      label: 'Normal (Swing)'
    },
    {
      type: 'wide' as const,
      percent: baseStops.wide * volMultiplier * riskMultiplier * 100,
      price: currentPrice * (1 - baseStops.wide * volMultiplier * riskMultiplier),
      label: 'Wide (Position)'
    }
  ];
}

/**
 * Calculate take profit levels
 */
function calculateTakeProfitLevels(
  currentPrice: number,
  score: number,
  riskLevel: RiskLevel
): TakeProfitLevel[] {
  const targets = [
    { multiplier: 2, base_prob: 0.45 },
    { multiplier: 3, base_prob: 0.30 },
    { multiplier: 5, base_prob: 0.15 },
    { multiplier: 10, base_prob: 0.05 }
  ];
  
  // Score bonus for probability
  const scoreBonus = (score - 50) / 100 * 0.15;
  
  return targets.map(t => {
    const probability = Math.min(t.base_prob + scoreBonus, 0.6);
    return {
      multiplier: t.multiplier,
      percent: (t.multiplier - 1) * 100,
      price: currentPrice * t.multiplier,
      label: `${t.multiplier}x Target`,
      probability: Math.round(probability * 100)
    };
  });
}

/**
 * Main risk calculation function
 */
export function calculateRisk(input: RiskCalculationInput): RiskCalculationResult {
  const {
    portfolioSize,
    riskPercent,
    signal,
    customScore,
    customRiskLevel,
    customVolatility
  } = input;
  
  // Extract signal data or use defaults
  const score = customScore ?? signal?.score ?? 60;
  const riskLevel = customRiskLevel ?? signal?.riskLevel ?? 'MEDIUM';
  const currentPrice = signal?.marketData?.price ?? 0.001;
  const volatility = customVolatility ?? 
    Math.abs(signal?.marketData?.priceChange1h ?? 20);
  
  // Get max position based on risk level rules
  const maxPercent = POSITION_RULES[riskLevel].maxPercent;
  const maxPosition = portfolioSize * (maxPercent / 100);
  
  // Calculate win probability based on score
  const winProbability = estimateWinProbability(score);
  
  // Assume 2x win, 50% loss for Kelly calculation
  const avgWin = 1.0; // 100% gain (2x)
  const avgLoss = 0.5; // 50% loss
  
  // Kelly Criterion position
  const kellyPercent = calculateKellyCriterion(winProbability, avgWin, avgLoss);
  const kellyPosition = portfolioSize * kellyPercent;
  
  // Score multiplier (higher score = more confident sizing)
  const scoreMultiplier = 0.5 + (score / 100) * 0.5; // 0.5 to 1.0
  
  // Risk adjustment based on user risk tolerance
  const riskAdjustment = riskPercent / 5; // Normalize to ~1.0 at 5%
  
  // Volatility adjustment (higher vol = smaller position)
  const volatilityAdjustment = 1 - (volatility / 200);
  
  // Calculate base position from user risk
  const basePosition = portfolioSize * (riskPercent / 100);
  
  // Final position with all adjustments
  let finalPosition = basePosition * scoreMultiplier * Math.max(volatilityAdjustment, 0.5);
  
  // Cap at max allowed for risk level
  finalPosition = Math.min(finalPosition, maxPosition);
  
  // Also cap at Kelly (don't over-bet)
  if (kellyPosition > 0) {
    finalPosition = Math.min(finalPosition, kellyPosition * 1.5); // Allow 1.5x Kelly max
  }
  
  // Calculate stop loss and take profit levels
  const stopLossLevels = calculateStopLossLevels(currentPrice, volatility, riskLevel);
  const takeProfitLevels = calculateTakeProfitLevels(currentPrice, score, riskLevel);
  
  // Use normal stop loss as default
  const recommendedStopLoss = stopLossLevels[1]; // normal
  
  // Calculate risk amount (position * stop loss %)
  const riskAmount = finalPosition * (recommendedStopLoss.percent / 100);
  
  // Reward/Risk ratio (using 2x target)
  const rewardRisk = takeProfitLevels[0].percent / recommendedStopLoss.percent;
  
  // Expected value
  const expectedValue = (winProbability * avgWin * finalPosition) - 
    ((1 - winProbability) * avgLoss * finalPosition);
  
  // Generate warnings
  const warnings: string[] = [];
  if (finalPosition > portfolioSize * 0.15) {
    warnings.push('Position exceeds 15% of portfolio - consider reducing');
  }
  if (riskLevel === 'EXTREME') {
    warnings.push('EXTREME risk level - only trade with money you can lose');
  }
  if (volatility > 50) {
    warnings.push('High volatility detected - consider tighter stops');
  }
  if (score < 50) {
    warnings.push('Low signal score - proceed with extra caution');
  }
  
  // Bundle/insider detection warnings
  const bundleScore = signal?.safety?.bundleScore;
  if (bundleScore !== undefined) {
    if (bundleScore >= 80) {
      warnings.push('🚨 CRITICAL BUNDLE SCORE - likely coordinated rug pull!');
      // Reduce position significantly
      finalPosition = finalPosition * 0.25;
    } else if (bundleScore >= 60) {
      warnings.push('⚠️ HIGH BUNDLE SCORE - potential insider coordination');
      finalPosition = finalPosition * 0.5;
    } else if (bundleScore >= 40) {
      warnings.push('Bundle activity detected - exercise caution');
      finalPosition = finalPosition * 0.75;
    }
  }
  
  if (signal?.safety?.insiderCount && signal.safety.insiderCount >= 3) {
    warnings.push(`${signal.safety.insiderCount} suspected insider wallets detected`);
  }
  
  // Sniper activity warnings
  const sniperActivity = signal?.safety?.sniperActivity;
  if (sniperActivity) {
    if (sniperActivity.sniperScore >= 75) {
      warnings.push(`🎯🚨 CRITICAL SNIPER ACTIVITY - ${sniperActivity.totalSnipers} snipers, ${sniperActivity.dumpProbability.toFixed(0)}% dump risk!`);
      // Reduce position significantly
      finalPosition = finalPosition * 0.25;
    } else if (sniperActivity.sniperScore >= 50) {
      warnings.push(`🎯⚠️ HIGH SNIPER ACTIVITY - ${sniperActivity.totalSnipers} snipers detected`);
      finalPosition = finalPosition * 0.5;
    } else if (sniperActivity.sniperScore >= 30) {
      warnings.push(`🎯 Moderate sniper activity (${sniperActivity.totalSnipers} snipers)`);
      finalPosition = finalPosition * 0.75;
    }
    
    if (sniperActivity.knownMEVBots >= 2) {
      warnings.push(`🤖 ${sniperActivity.knownMEVBots} known MEV bots detected - expect front-running`);
    }
    
    if (sniperActivity.block0Buyers >= 5) {
      warnings.push(`⚡ ${sniperActivity.block0Buyers} wallets bought in block 0 - coordinated launch`);
    }
    
    if (sniperActivity.sniperSupplyPercent >= 40) {
      warnings.push(`📊 Snipers control ${sniperActivity.sniperSupplyPercent.toFixed(1)}% of supply`);
    }
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (score >= 75) {
    recommendations.push('Strong signal - consider scaling in with multiple entries');
  }
  if (riskLevel === 'LOW') {
    recommendations.push('Low risk setup - suitable for larger position');
  }
  if (kellyPercent > 0.15) {
    recommendations.push('Kelly suggests high edge - confidence is warranted');
  }
  if (rewardRisk >= 3) {
    recommendations.push('Excellent R:R ratio - favorable setup');
  }
  
  // Bundle-related recommendations
  if (bundleScore !== undefined && bundleScore < 20) {
    recommendations.push('✅ Low bundle score - no coordinated buying detected');
  }
  if (bundleScore !== undefined && bundleScore >= 60) {
    recommendations.push('Consider waiting for bundle wallets to exit before entering');
  }
  
  // Sniper-related recommendations
  if (sniperActivity) {
    if (sniperActivity.sniperScore < 20) {
      recommendations.push('✅ Low sniper activity - organic entry patterns');
    }
    if (sniperActivity.sniperScore >= 50 && sniperActivity.avgSniperWinRate >= 60) {
      recommendations.push('🎯 Experienced snipers detected - they often exit quickly for profit');
    }
    if (sniperActivity.dumpProbability >= 60) {
      recommendations.push('⏳ Consider waiting 30-60 min for snipers to dump before entering');
    }
    if (sniperActivity.knownMEVBots > 0) {
      recommendations.push('🤖 MEV bots present - use higher slippage or private RPC');
    }
  }
  
  // Determine confidence level
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (score >= 70 && riskLevel !== 'EXTREME' && kellyPercent > 0.05) {
    confidence = 'HIGH';
  } else if (score < 50 || riskLevel === 'EXTREME' || kellyPercent <= 0) {
    confidence = 'LOW';
  }
  
  // Reduce confidence if high bundle score
  if (bundleScore !== undefined && bundleScore >= 60) {
    confidence = 'LOW';
  } else if (bundleScore !== undefined && bundleScore >= 40 && confidence === 'HIGH') {
    confidence = 'MEDIUM';
  }
  
  // Reduce confidence if high sniper activity
  if (sniperActivity && sniperActivity.sniperScore >= 60) {
    confidence = 'LOW';
  } else if (sniperActivity && sniperActivity.sniperScore >= 40 && confidence === 'HIGH') {
    confidence = 'MEDIUM';
  }
  
  return {
    portfolioSize,
    riskPercent,
    signalScore: score,
    riskLevel,
    
    recommendedPosition: Math.round(finalPosition * 100) / 100,
    recommendedPositionPercent: Math.round((finalPosition / portfolioSize) * 100 * 10) / 10,
    maxPosition: Math.round(maxPosition * 100) / 100,
    maxPositionPercent: maxPercent,
    kellyPosition: Math.round(kellyPosition * 100) / 100,
    kellyPositionPercent: Math.round(kellyPercent * 100 * 10) / 10,
    
    riskAmount: Math.round(riskAmount * 100) / 100,
    rewardRisk: Math.round(rewardRisk * 10) / 10,
    expectedValue: Math.round(expectedValue * 100) / 100,
    
    stopLoss: stopLossLevels,
    recommendedStopLoss,
    
    takeProfit: takeProfitLevels,
    
    breakdown: {
      basePosition: Math.round(basePosition * 100) / 100,
      scoreMultiplier: Math.round(scoreMultiplier * 100) / 100,
      riskAdjustment: Math.round(riskAdjustment * 100) / 100,
      volatilityAdjustment: Math.round(volatilityAdjustment * 100) / 100,
      finalPosition: Math.round(finalPosition * 100) / 100
    },
    
    warnings,
    recommendations,
    confidence,
    
    calculatedAt: Date.now(),
    version: '1.0.0'
  };
}

/**
 * Format risk calculation for display
 */
export function formatRiskCalculation(result: RiskCalculationResult): string {
  const lines: string[] = [];
  
  lines.push('📊 RISK CALCULATION');
  lines.push('═'.repeat(40));
  lines.push('');
  
  // Position sizing
  lines.push('💰 Position Sizing');
  lines.push(`   Recommended: $${result.recommendedPosition.toFixed(2)} (${result.recommendedPositionPercent}%)`);
  lines.push(`   Maximum:     $${result.maxPosition.toFixed(2)} (${result.maxPositionPercent}%)`);
  lines.push(`   Kelly:       $${result.kellyPosition.toFixed(2)} (${result.kellyPositionPercent}%)`);
  lines.push('');
  
  // Risk metrics
  lines.push('⚠️ Risk Metrics');
  lines.push(`   Risk Amount: $${result.riskAmount.toFixed(2)}`);
  lines.push(`   R:R Ratio:   ${result.rewardRisk}:1`);
  lines.push(`   Expected:    $${result.expectedValue.toFixed(2)}`);
  lines.push('');
  
  // Stop loss
  lines.push('🛑 Stop Loss Levels');
  for (const sl of result.stopLoss) {
    const marker = sl.type === 'normal' ? '→' : ' ';
    lines.push(`   ${marker} ${sl.label}: -${sl.percent.toFixed(1)}% ($${sl.price.toFixed(6)})`);
  }
  lines.push('');
  
  // Take profit
  lines.push('🎯 Take Profit Targets');
  for (const tp of result.takeProfit) {
    lines.push(`     ${tp.label}: +${tp.percent}% ($${tp.price.toFixed(6)}) [${tp.probability}% prob]`);
  }
  lines.push('');
  
  // Confidence
  const confEmoji = result.confidence === 'HIGH' ? '🟢' : result.confidence === 'MEDIUM' ? '🟡' : '🔴';
  lines.push(`${confEmoji} Confidence: ${result.confidence}`);
  lines.push('');
  
  // Warnings
  if (result.warnings.length > 0) {
    lines.push('⚠️ Warnings:');
    for (const w of result.warnings) {
      lines.push(`   • ${w}`);
    }
    lines.push('');
  }
  
  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('💡 Recommendations:');
    for (const r of result.recommendations) {
      lines.push(`   • ${r}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Quick position size calculation (simplified)
 */
export function quickPositionSize(
  portfolioSize: number,
  score: number,
  riskLevel: RiskLevel
): number {
  const maxPercent = POSITION_RULES[riskLevel].maxPercent;
  const scoreMultiplier = 0.5 + (score / 100) * 0.5;
  
  // Base 5% of portfolio, adjusted by score and capped by risk level
  const position = portfolioSize * 0.05 * scoreMultiplier;
  const maxPosition = portfolioSize * (maxPercent / 100);
  
  return Math.min(position, maxPosition);
}

export { calculateKellyCriterion, estimateWinProbability };
