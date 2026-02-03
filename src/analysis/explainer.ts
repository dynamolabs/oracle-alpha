/**
 * Signal Explainer
 * Generates human-readable explanations for why signals scored high/low
 */

import { AggregatedSignal } from '../types';

interface Explanation {
  summary: string;
  bullishFactors: string[];
  bearishFactors: string[];
  riskWarnings: string[];
  actionableInsight: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Source descriptions
const SOURCE_DESCRIPTIONS: Record<string, string> = {
  'smart-wallet-elite': 'An elite smart wallet (70%+ historical win rate) bought this token',
  'smart-wallet-sniper': 'A sniper wallet with good track record entered a position',
  'volume-spike': 'Unusual volume spike detected - significant buying pressure',
  'kol-tracker': 'A tracked KOL (Key Opinion Leader) mentioned this token',
  'kol-social': 'Social sentiment from crypto influencers is positive',
  'narrative-new': 'This token fits a trending narrative (AI, Meme, Political, etc.)',
  'narrative-momentum': 'Strong narrative momentum detected across social channels',
  dexscreener: 'Trending on DexScreener with high activity',
  'pump-koth': 'Reached King of the Hill status on pump.fun',
  'whale-tracker': 'Whale wallet accumulation detected',
  'new-launch': 'Fresh launch with early momentum signals'
};

// Risk level explanations
const RISK_EXPLANATIONS: Record<string, string> = {
  LOW: 'Multiple high-quality signals with strong confluence. Lower risk entry.',
  MEDIUM: 'Decent signal quality but some uncertainty. Standard caution advised.',
  HIGH: 'Limited signal confluence or concerning factors. Higher risk play.',
  EXTREME: 'Very speculative. Single source or weak signals. Extreme caution.'
};

// Generate bullish factors based on signal data
function getBullishFactors(signal: AggregatedSignal): string[] {
  const factors: string[] = [];

  // Check sources
  for (const source of signal.sources) {
    if (SOURCE_DESCRIPTIONS[source.source]) {
      factors.push(SOURCE_DESCRIPTIONS[source.source]);
    }
  }

  // Market data factors
  const mcap = signal.marketData?.mcap || 0;
  const volume = signal.marketData?.volume5m || 0;
  const age = signal.marketData?.age || 0;

  if (mcap > 0 && mcap < 100000) {
    factors.push(`Very low market cap ($${(mcap / 1000).toFixed(1)}K) - high upside potential`);
  } else if (mcap >= 100000 && mcap < 300000) {
    factors.push(`Ideal market cap range ($${(mcap / 1000).toFixed(1)}K) for growth`);
  }

  if (volume > 10000) {
    factors.push(
      `Strong 5-minute volume ($${(volume / 1000).toFixed(1)}K) indicates active interest`
    );
  }

  if (age > 0 && age < 30) {
    factors.push(`Fresh token (${age} minutes old) - early entry opportunity`);
  }

  // Confluence bonus
  if (signal.sources.length >= 3) {
    factors.push(`Strong confluence: ${signal.sources.length} independent signals detected`);
  } else if (signal.sources.length >= 2) {
    factors.push('Multiple signal sources provide confirmation');
  }

  // Score-based
  if (signal.score >= 80) {
    factors.push('Exceptionally high confidence score from our algorithm');
  }

  // Narrative
  if (signal.analysis?.narrative && signal.analysis.narrative.length > 0) {
    const narratives = signal.analysis.narrative.join(', ');
    factors.push(`Fits trending narratives: ${narratives}`);
  }

  return factors;
}

// Generate bearish/risk factors
function getBearishFactors(signal: AggregatedSignal): string[] {
  const factors: string[] = [];

  const mcap = signal.marketData?.mcap || 0;
  const liquidity = signal.marketData?.liquidity || 0;
  const age = signal.marketData?.age || 0;

  // Single source warning
  if (signal.sources.length === 1) {
    factors.push('Single signal source only - no confluence confirmation');
  }

  // High mcap
  if (mcap > 500000) {
    factors.push(`Higher market cap ($${(mcap / 1000).toFixed(1)}K) may limit upside`);
  }

  // Low liquidity
  if (liquidity > 0 && liquidity < 10000) {
    factors.push(`Low liquidity ($${(liquidity / 1000).toFixed(1)}K) - slippage risk`);
  }

  // Old token
  if (age > 60) {
    factors.push(`Token is ${age} minutes old - may have already pumped`);
  }

  // Low score
  if (signal.score < 60) {
    factors.push('Below-average confidence score from our algorithm');
  }

  // No smart wallet
  const hasSmartWallet = signal.sources.some(s => s.source.includes('smart-wallet'));
  if (!hasSmartWallet) {
    factors.push('No smart wallet signal detected');
  }

  return factors;
}

// Generate risk warnings
function getRiskWarnings(signal: AggregatedSignal): string[] {
  const warnings: string[] = [];

  // Always include general warnings
  warnings.push('Memecoins are extremely volatile - only invest what you can lose');

  if (signal.riskLevel === 'HIGH' || signal.riskLevel === 'EXTREME') {
    warnings.push('This is a high-risk play with limited signal confirmation');
  }

  const liquidity = signal.marketData?.liquidity || 0;
  if (liquidity < 5000) {
    warnings.push('Very low liquidity - may be difficult to exit position');
  }

  const age = signal.marketData?.age || 0;
  if (age < 10) {
    warnings.push('Very new token - higher rug pull risk');
  }

  return warnings;
}

// Generate actionable insight
function getActionableInsight(signal: AggregatedSignal): string {
  if (signal.score >= 80 && signal.riskLevel === 'LOW') {
    return '💎 Strong signal with good risk/reward. Consider a position with tight stop loss at -20%.';
  }

  if (signal.score >= 70) {
    return '⚡ Decent opportunity. Consider small position size. Set alerts for price action.';
  }

  if (signal.score >= 60) {
    return '👀 Speculative play. If entering, use very small size. Quick in-and-out strategy.';
  }

  return '⚠️ Weak signal. Watch only or skip. Wait for better opportunities.';
}

// Main explanation generator
export function explainSignal(signal: AggregatedSignal): Explanation {
  const bullishFactors = getBullishFactors(signal);
  const bearishFactors = getBearishFactors(signal);
  const riskWarnings = getRiskWarnings(signal);
  const actionableInsight = getActionableInsight(signal);

  // Generate summary
  let summary = '';

  if (signal.score >= 80) {
    summary = `$${signal.symbol} shows exceptional signal quality with a score of ${signal.score}/100. `;
    summary += `${signal.sources.length} independent sources detected this token, suggesting strong market interest. `;
  } else if (signal.score >= 65) {
    summary = `$${signal.symbol} has moderate signal strength with a score of ${signal.score}/100. `;
    summary += `The signal comes from ${signal.sources.length} source(s), providing reasonable confidence. `;
  } else {
    summary = `$${signal.symbol} shows weak signal quality with a score of ${signal.score}/100. `;
    summary += 'Limited sources and/or concerning factors suggest caution. ';
  }

  summary += RISK_EXPLANATIONS[signal.riskLevel];

  const confidence = signal.score >= 75 ? 'HIGH' : signal.score >= 55 ? 'MEDIUM' : 'LOW';

  return {
    summary,
    bullishFactors,
    bearishFactors,
    riskWarnings,
    actionableInsight,
    confidence
  };
}

// Generate formatted text explanation
export function formatExplanation(signal: AggregatedSignal): string {
  const exp = explainSignal(signal);

  let text = `🧠 SIGNAL ANALYSIS: $${signal.symbol}\n`;
  text += `${'━'.repeat(40)}\n\n`;

  text += `📊 Summary:\n${exp.summary}\n\n`;

  text += '✅ Bullish Factors:\n';
  for (const factor of exp.bullishFactors.slice(0, 5)) {
    text += `  • ${factor}\n`;
  }
  text += '\n';

  if (exp.bearishFactors.length > 0) {
    text += '⚠️ Risk Factors:\n';
    for (const factor of exp.bearishFactors.slice(0, 3)) {
      text += `  • ${factor}\n`;
    }
    text += '\n';
  }

  text += `💡 Action: ${exp.actionableInsight}\n\n`;

  text += `⚡ Confidence: ${exp.confidence}\n`;
  text += `📈 Score: ${signal.score}/100 | Risk: ${signal.riskLevel}`;

  return text;
}

export { Explanation };
