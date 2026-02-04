/**
 * AI Signal Explainer
 * Generates comprehensive human-readable explanations for trading signals
 * Uses template-based generation (no external AI API needed)
 */

import { AggregatedSignal, SignalSource } from '../types';
import { getMarketCondition, MarketCondition } from '../filters/market-condition';

// ============= TYPES =============

export interface DetailedExplanation {
  symbol: string;
  token: string;
  score: number;
  timestamp: number;
  
  // Main sections
  summary: string;
  sources: SourceExplanation[];
  marketContext: MarketContextExplanation;
  riskFactors: RiskFactor[];
  conclusion: string;
  
  // Metadata
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  totalConfirmations: number;
  generatedAt: number;
}

export interface SourceExplanation {
  source: string;
  icon: string;
  description: string;
  detail: string;
  weight: number;
  rawScore: number;
  impact: 'STRONG' | 'MODERATE' | 'WEAK';
}

export interface MarketContextExplanation {
  overall: string;
  trend: string;
  trendImpact: number;
  volatility: string;
  volatilityImpact: number;
  netImpact: number;
  isOptimal: boolean;
  btcContext?: string;
  solContext?: string;
}

export interface RiskFactor {
  factor: string;
  value: string;
  status: 'SAFE' | 'CAUTION' | 'RISKY' | 'OK';
  icon: string;
}

// ============= SOURCE TEMPLATES =============

interface SourceTemplate {
  icon: string;
  name: string;
  descriptionTemplate: string;
  detailTemplates: ((metadata: Record<string, any>, marketData: any) => string)[];
}

const SOURCE_TEMPLATES: Record<string, SourceTemplate> = {
  'smart-wallet-elite': {
    icon: '👑',
    name: 'Smart Wallet Elite',
    descriptionTemplate: 'Elite wallet with 70%+ win rate detected activity',
    detailTemplates: [
      (m) => m.buyAmount ? `Whale bought $${formatNumber(m.buyAmount)} at $${formatPrice(m.entryPrice || m.price)}` : 'Large position detected',
      (m) => m.walletLabel ? `Tracked wallet "${m.walletLabel}" entered position` : 'High-performance wallet accumulated',
      (m) => m.winRate ? `Wallet has ${m.winRate}% historical win rate` : 'Top-tier smart money activity'
    ]
  },
  'smart-wallet-sniper': {
    icon: '🎯',
    name: 'Smart Wallet Sniper',
    descriptionTemplate: 'Sniper wallet with fast entry patterns detected',
    detailTemplates: [
      (m) => m.buyAmount ? `Sniped $${formatNumber(m.buyAmount)} within first ${m.blockDelay || '5'} blocks` : 'Early snipe detected',
      (m) => `Fast entry pattern - wallet known for quick profits`,
      (m) => m.avgHoldTime ? `Avg hold time: ${m.avgHoldTime} minutes` : 'Aggressive trading strategy'
    ]
  },
  'volume-spike': {
    icon: '📈',
    name: 'Volume Spike',
    descriptionTemplate: 'Unusual volume activity detected',
    detailTemplates: [
      (m, md) => md?.volume5m ? `${Math.round(((md.volume5m / (md.volume1h / 12)) - 1) * 100)}% increase in last 5 minutes` : 'Significant volume surge',
      (m) => m.spikePercent ? `${m.spikePercent}% spike vs 30-min average` : 'Volume anomaly detected',
      (m, md) => md?.volume1h ? `1h volume: $${formatNumber(md.volume1h)}` : 'High buying pressure'
    ]
  },
  'kol-tracker': {
    icon: '👤',
    name: 'KOL Tracker',
    descriptionTemplate: 'Key Opinion Leader activity detected',
    detailTemplates: [
      (m) => m.kolName ? `${m.kolName} mentioned this token` : 'Tracked influencer mentioned token',
      (m) => m.followers ? `KOL has ${formatNumber(m.followers)} followers` : 'Influencer with significant reach',
      (m) => m.sentiment ? `Sentiment: ${m.sentiment.toUpperCase()}` : 'Social catalyst detected'
    ]
  },
  'kol-social': {
    icon: '📣',
    name: 'Social Sentiment',
    descriptionTemplate: 'Positive social sentiment from crypto influencers',
    detailTemplates: [
      (m) => m.mentions ? `${m.mentions} mentions in last hour` : 'Trending on social media',
      (m) => m.sentimentScore ? `Sentiment score: ${m.sentimentScore}/100` : 'Positive community sentiment',
      (m) => 'Growing social buzz across platforms'
    ]
  },
  'narrative-new': {
    icon: '📖',
    name: 'Narrative Match',
    descriptionTemplate: 'Token fits a trending market narrative',
    detailTemplates: [
      (m) => m.narrative ? `Matches "${m.narrative}" narrative` : 'Fits current market theme',
      (m) => m.narrativeStrength ? `Narrative strength: ${m.narrativeStrength}/10` : 'Strong thematic alignment',
      (m) => 'Market attention on this sector'
    ]
  },
  'narrative-momentum': {
    icon: '🚀',
    name: 'Narrative Momentum',
    descriptionTemplate: 'Strong momentum in narrative sector',
    detailTemplates: [
      (m) => m.sectorGrowth ? `Sector up ${m.sectorGrowth}% in 24h` : 'Narrative gaining traction',
      (m) => m.trendingRank ? `#${m.trendingRank} in trending narratives` : 'High momentum sector',
      (m) => 'Strong narrative tailwinds'
    ]
  },
  'whale-tracker': {
    icon: '🐋',
    name: 'Whale Tracker',
    descriptionTemplate: 'Large wallet accumulation detected',
    detailTemplates: [
      (m) => m.amount ? `Whale accumulated $${formatNumber(m.amount)}` : 'Whale activity detected',
      (m) => m.walletSize ? `Wallet holds $${formatNumber(m.walletSize)} in portfolio` : 'Large holder entering',
      (m) => 'Institutional-level buying pressure'
    ]
  },
  'pump-koth': {
    icon: '🏆',
    name: 'King of the Hill',
    descriptionTemplate: 'Reached top position on pump.fun',
    detailTemplates: [
      (m) => m.rank ? `Rank #${m.rank} on pump.fun` : 'King of the Hill status achieved',
      (m) => m.holdTime ? `Held KOTH for ${m.holdTime} minutes` : 'Dominant position on platform',
      (m) => 'Maximum visibility achieved'
    ]
  },
  'dexscreener': {
    icon: '📊',
    name: 'DexScreener Trending',
    descriptionTemplate: 'Trending on DexScreener',
    detailTemplates: [
      (m) => m.rank ? `#${m.rank} on DexScreener trending` : 'Trending on DEX aggregator',
      (m) => m.views ? `${formatNumber(m.views)} views in last hour` : 'High trader interest',
      (m) => 'Increased DEX visibility'
    ]
  },
  'new-launch': {
    icon: '✨',
    name: 'Fresh Launch',
    descriptionTemplate: 'Newly launched token with early signals',
    detailTemplates: [
      (m, md) => md?.age ? `Token is ${md.age} minutes old` : 'Recently deployed',
      (m) => m.deployerHistory ? `Deployer has ${m.deployerHistory} successful launches` : 'Early entry opportunity',
      (m) => 'First-mover advantage potential'
    ]
  },
  'panda_alpha': {
    icon: '🐼',
    name: 'Panda Alpha',
    descriptionTemplate: 'Panda Alpha signal source detection',
    detailTemplates: [
      (m) => m.confidence ? `Confidence: ${m.confidence}%` : 'Cross-referenced with Panda Alpha',
      (m) => m.reason || 'Multiple indicators aligned',
      (m) => 'Verified by Panda Alpha engine'
    ]
  }
};

// ============= UTILITY FUNCTIONS =============

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

function formatPrice(price: number): string {
  if (price < 0.00001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
}

function getImpactLevel(weight: number, score: number): 'STRONG' | 'MODERATE' | 'WEAK' {
  const impact = weight * score;
  if (impact >= 15) return 'STRONG';
  if (impact >= 8) return 'MODERATE';
  return 'WEAK';
}

// ============= MAIN EXPLAINER =============

/**
 * Generate a detailed explanation for a signal
 */
export async function generateExplanation(signal: AggregatedSignal): Promise<DetailedExplanation> {
  // Get current market condition
  let marketCondition: MarketCondition | null = null;
  try {
    marketCondition = await getMarketCondition();
  } catch (e) {
    console.error('[EXPLAINER] Failed to get market condition:', e);
  }
  
  // Generate source explanations
  const sources = generateSourceExplanations(signal);
  
  // Generate market context
  const marketContext = generateMarketContext(signal, marketCondition);
  
  // Generate risk factors
  const riskFactors = generateRiskFactors(signal);
  
  // Generate summary
  const summary = generateSummary(signal, sources, marketContext);
  
  // Generate conclusion
  const conclusion = generateConclusion(signal, sources, marketContext, riskFactors);
  
  // Determine confidence level
  const confidenceLevel = signal.score >= 75 ? 'HIGH' : signal.score >= 55 ? 'MEDIUM' : 'LOW';
  
  return {
    symbol: signal.symbol,
    token: signal.token,
    score: signal.score,
    timestamp: signal.timestamp,
    summary,
    sources,
    marketContext,
    riskFactors,
    conclusion,
    confidenceLevel,
    totalConfirmations: signal.sources.length,
    generatedAt: Date.now()
  };
}

/**
 * Generate explanations for each signal source
 */
function generateSourceExplanations(signal: AggregatedSignal): SourceExplanation[] {
  return signal.sources.map(source => {
    const template = SOURCE_TEMPLATES[source.source] || {
      icon: '🔮',
      name: source.source,
      descriptionTemplate: 'Signal detected from ' + source.source,
      detailTemplates: [(m: any) => 'Contributing signal source']
    };
    
    // Get metadata for this source (if available)
    const metadata = (signal as any).sourceMetadata?.[source.source] || {};
    
    // Pick a detail template (randomize or use most specific)
    const detailFn = template.detailTemplates[0];
    const detail = detailFn(metadata, signal.marketData);
    
    return {
      source: source.source,
      icon: template.icon,
      description: template.name,
      detail,
      weight: source.weight,
      rawScore: source.rawScore,
      impact: getImpactLevel(source.weight, source.rawScore)
    };
  });
}

/**
 * Generate market context explanation
 */
function generateMarketContext(signal: AggregatedSignal, market: MarketCondition | null): MarketContextExplanation {
  if (!market) {
    return {
      overall: 'Market data unavailable',
      trend: 'UNKNOWN',
      trendImpact: 0,
      volatility: 'UNKNOWN',
      volatilityImpact: 0,
      netImpact: 0,
      isOptimal: false
    };
  }
  
  const trendEmoji = market.overall.trend === 'BULLISH' ? '🟢' : 
                     market.overall.trend === 'BEARISH' ? '🔴' : '⚪';
  
  const volEmoji = market.overall.volatility === 'HIGH' ? '🌊' :
                   market.overall.volatility === 'LOW' ? '😴' : '〰️';
  
  let overall = `${trendEmoji} ${market.overall.trend}`;
  if (market.scoring.trendModifier !== 0) {
    overall += ` (${market.scoring.trendModifier > 0 ? '+' : ''}${market.scoring.trendModifier} pts)`;
  }
  
  // BTC context
  let btcContext: string | undefined;
  if (market.btc.price > 0) {
    const btcDir = market.btc.change24h >= 0 ? '↑' : '↓';
    btcContext = `BTC: $${formatNumber(market.btc.price)} ${btcDir}${Math.abs(market.btc.change24h).toFixed(1)}%`;
  }
  
  // SOL context
  let solContext: string | undefined;
  if (market.sol.price > 0) {
    const solDir = market.sol.change24h >= 0 ? '↑' : '↓';
    solContext = `SOL: $${market.sol.price.toFixed(2)} ${solDir}${Math.abs(market.sol.change24h).toFixed(1)}%`;
  }
  
  return {
    overall,
    trend: market.overall.trend,
    trendImpact: market.scoring.trendModifier,
    volatility: `${volEmoji} ${market.overall.volatility}`,
    volatilityImpact: market.scoring.volatilityModifier,
    netImpact: market.scoring.totalModifier,
    isOptimal: market.overall.isOptimalTrading,
    btcContext,
    solContext
  };
}

/**
 * Generate risk factor explanations
 */
function generateRiskFactors(signal: AggregatedSignal): RiskFactor[] {
  const factors: RiskFactor[] = [];
  
  // Dev holdings check
  if (signal.safety?.devHoldings !== undefined) {
    const devPct = signal.safety.devHoldings;
    let status: 'SAFE' | 'CAUTION' | 'RISKY' = 'SAFE';
    if (devPct > 15) status = 'RISKY';
    else if (devPct > 10) status = 'CAUTION';
    
    factors.push({
      factor: 'Dev Holdings',
      value: `${devPct.toFixed(1)}%`,
      status,
      icon: status === 'SAFE' ? '✅' : status === 'CAUTION' ? '⚠️' : '🚨'
    });
  }
  
  // Liquidity check
  const liquidity = signal.marketData?.liquidity || 0;
  if (liquidity > 0) {
    let status: 'SAFE' | 'CAUTION' | 'RISKY' | 'OK' = 'OK';
    if (liquidity >= 50000) status = 'SAFE';
    else if (liquidity >= 10000) status = 'OK';
    else if (liquidity >= 5000) status = 'CAUTION';
    else status = 'RISKY';
    
    factors.push({
      factor: 'Liquidity',
      value: `$${formatNumber(liquidity)}`,
      status,
      icon: status === 'SAFE' ? '✅' : status === 'OK' ? '👌' : status === 'CAUTION' ? '⚠️' : '🚨'
    });
  }
  
  // Token age check
  const age = signal.marketData?.age || 0;
  if (age > 0) {
    let status: 'SAFE' | 'CAUTION' | 'RISKY' | 'OK' = 'OK';
    let display = `${age} min`;
    
    if (age >= 60) {
      display = `${Math.floor(age / 60)}h ${age % 60}m`;
    }
    if (age >= 1440) {
      display = `${Math.floor(age / 1440)} days`;
    }
    
    if (age < 10) status = 'RISKY';
    else if (age < 30) status = 'CAUTION';
    else if (age < 120) status = 'OK';
    else status = 'SAFE';
    
    factors.push({
      factor: 'Token Age',
      value: display,
      status,
      icon: status === 'SAFE' ? '✅' : status === 'OK' ? '👌' : status === 'CAUTION' ? '⚠️' : '🚨'
    });
  }
  
  // Top holder concentration
  if (signal.safety?.topHolderPercentage !== undefined) {
    const topPct = signal.safety.topHolderPercentage;
    let status: 'SAFE' | 'CAUTION' | 'RISKY' = 'SAFE';
    if (topPct > 50) status = 'RISKY';
    else if (topPct > 30) status = 'CAUTION';
    
    factors.push({
      factor: 'Top Holder',
      value: `${topPct.toFixed(1)}%`,
      status,
      icon: status === 'SAFE' ? '✅' : status === 'CAUTION' ? '⚠️' : '🚨'
    });
  }
  
  // Mint authority
  if (signal.safety?.mintAuthorityEnabled !== undefined) {
    factors.push({
      factor: 'Mint Authority',
      value: signal.safety.mintAuthorityEnabled ? 'ENABLED' : 'Disabled',
      status: signal.safety.mintAuthorityEnabled ? 'RISKY' : 'SAFE',
      icon: signal.safety.mintAuthorityEnabled ? '🚨' : '✅'
    });
  }
  
  // Freeze authority
  if (signal.safety?.freezeAuthorityEnabled !== undefined) {
    factors.push({
      factor: 'Freeze Authority',
      value: signal.safety.freezeAuthorityEnabled ? 'ENABLED' : 'Disabled',
      status: signal.safety.freezeAuthorityEnabled ? 'CAUTION' : 'SAFE',
      icon: signal.safety.freezeAuthorityEnabled ? '⚠️' : '✅'
    });
  }
  
  // Bundle detection
  if (signal.safety?.bundleScore !== undefined) {
    let status: 'SAFE' | 'CAUTION' | 'RISKY' | 'OK' = 'OK';
    const bundleScore = signal.safety.bundleScore;
    
    if (bundleScore >= 60) status = 'RISKY';
    else if (bundleScore >= 40) status = 'CAUTION';
    else if (bundleScore >= 20) status = 'OK';
    else status = 'SAFE';
    
    const riskLabel = signal.safety.bundleRiskLevel || 
      (bundleScore >= 80 ? 'CRITICAL' : bundleScore >= 60 ? 'HIGH' : bundleScore >= 40 ? 'MEDIUM' : 'LOW');
    
    factors.push({
      factor: 'Bundle Score',
      value: `${bundleScore} (${riskLabel})`,
      status,
      icon: status === 'SAFE' ? '✅' : status === 'OK' ? '👌' : status === 'CAUTION' ? '⚠️' : '🚨'
    });
  }
  
  // Insider wallets
  if (signal.safety?.insiderCount !== undefined && signal.safety.insiderCount > 0) {
    factors.push({
      factor: 'Suspected Insiders',
      value: `${signal.safety.insiderCount} wallet${signal.safety.insiderCount > 1 ? 's' : ''}`,
      status: signal.safety.insiderCount >= 3 ? 'RISKY' : 'CAUTION',
      icon: signal.safety.insiderCount >= 3 ? '🚨' : '⚠️'
    });
  }
  
  // Confluence/sources check
  const sourceCount = signal.sources.length;
  factors.push({
    factor: 'Confirmations',
    value: `${sourceCount} source${sourceCount !== 1 ? 's' : ''}`,
    status: sourceCount >= 3 ? 'SAFE' : sourceCount >= 2 ? 'OK' : 'CAUTION',
    icon: sourceCount >= 3 ? '✅' : sourceCount >= 2 ? '👌' : '⚠️'
  });
  
  // Honeypot detection
  if (signal.safety?.honeypotRisk) {
    const hp = signal.safety.honeypotRisk;
    
    // Main honeypot status
    if (hp.isHoneypot) {
      factors.push({
        factor: '🍯 HONEYPOT',
        value: 'DETECTED!',
        status: 'RISKY',
        icon: '🚨'
      });
    } else {
      let hpStatus: 'SAFE' | 'CAUTION' | 'RISKY' | 'OK' = 'SAFE';
      if (hp.riskLevel === 'HIGH_RISK') hpStatus = 'CAUTION';
      else if (hp.riskLevel === 'MEDIUM_RISK') hpStatus = 'OK';
      
      factors.push({
        factor: 'Honeypot Risk',
        value: hp.riskLevel.replace(/_/g, ' '),
        status: hpStatus,
        icon: hpStatus === 'SAFE' ? '✅' : hpStatus === 'OK' ? '👌' : '⚠️'
      });
    }
    
    // Can sell check
    factors.push({
      factor: 'Can Sell',
      value: hp.canSell ? 'YES' : 'NO',
      status: hp.canSell ? 'SAFE' : 'RISKY',
      icon: hp.canSell ? '✅' : '🚨'
    });
    
    // Sell tax
    if (hp.sellTax > 0) {
      let taxStatus: 'SAFE' | 'CAUTION' | 'RISKY' | 'OK' = 'OK';
      if (hp.sellTax >= 50) taxStatus = 'RISKY';
      else if (hp.sellTax >= 10) taxStatus = 'CAUTION';
      else if (hp.sellTax >= 5) taxStatus = 'OK';
      else taxStatus = 'SAFE';
      
      factors.push({
        factor: 'Sell Tax',
        value: `${hp.sellTax.toFixed(1)}%`,
        status: taxStatus,
        icon: taxStatus === 'SAFE' ? '✅' : taxStatus === 'OK' ? '👌' : taxStatus === 'CAUTION' ? '⚠️' : '🚨'
      });
    }
    
    // Blacklist
    if (hp.hasBlacklist) {
      factors.push({
        factor: 'Blacklist',
        value: 'ACTIVE',
        status: 'CAUTION',
        icon: '⚠️'
      });
    }
    
    // LP Lock
    factors.push({
      factor: 'LP Locked',
      value: hp.lpLocked ? 'Yes' : 'No',
      status: hp.lpLocked ? 'SAFE' : 'CAUTION',
      icon: hp.lpLocked ? '🔒' : '⚠️'
    });
  }
  
  // Wash trading detection
  if (signal.safety?.washScore !== undefined) {
    const washScore = signal.safety.washScore;
    let status: 'SAFE' | 'CAUTION' | 'RISKY' | 'OK' = 'SAFE';
    
    if (washScore >= 70) status = 'RISKY';
    else if (washScore >= 50) status = 'CAUTION';
    else if (washScore >= 30) status = 'OK';
    else status = 'SAFE';
    
    const riskLabel = signal.safety.washRiskLevel || 
      (washScore >= 80 ? 'EXTREME' : washScore >= 60 ? 'HIGH' : washScore >= 40 ? 'MEDIUM' : 'LOW');
    
    factors.push({
      factor: '🚿 Wash Score',
      value: `${washScore} (${riskLabel})`,
      status,
      icon: status === 'SAFE' ? '✅' : status === 'OK' ? '👌' : status === 'CAUTION' ? '⚠️' : '🚨'
    });
    
    // Real volume percentage
    if (signal.safety.washVolumePercent !== undefined && washScore >= 30) {
      const realPercent = 100 - signal.safety.washVolumePercent;
      factors.push({
        factor: 'Real Volume',
        value: `~${realPercent}%`,
        status: realPercent >= 80 ? 'SAFE' : realPercent >= 50 ? 'OK' : realPercent >= 30 ? 'CAUTION' : 'RISKY',
        icon: realPercent >= 80 ? '✅' : realPercent >= 50 ? '👌' : realPercent >= 30 ? '⚠️' : '🚨'
      });
    }
    
    // Self-trading detected
    if (signal.safety.selfTradeCount !== undefined && signal.safety.selfTradeCount > 0) {
      factors.push({
        factor: 'Self-Trades',
        value: `${signal.safety.selfTradeCount} cycle${signal.safety.selfTradeCount > 1 ? 's' : ''}`,
        status: signal.safety.selfTradeCount >= 10 ? 'RISKY' : signal.safety.selfTradeCount >= 5 ? 'CAUTION' : 'OK',
        icon: signal.safety.selfTradeCount >= 10 ? '🚨' : signal.safety.selfTradeCount >= 5 ? '⚠️' : '👀'
      });
    }
    
    // Circular patterns
    if (signal.safety.circularPatternCount !== undefined && signal.safety.circularPatternCount > 0) {
      factors.push({
        factor: 'Circular Trades',
        value: `${signal.safety.circularPatternCount} pattern${signal.safety.circularPatternCount > 1 ? 's' : ''}`,
        status: signal.safety.circularPatternCount >= 5 ? 'RISKY' : signal.safety.circularPatternCount >= 2 ? 'CAUTION' : 'OK',
        icon: signal.safety.circularPatternCount >= 5 ? '🚨' : signal.safety.circularPatternCount >= 2 ? '⚠️' : '🔁'
      });
    }
  }
  
  // Sniper/Front-runner detection
  if (signal.safety?.sniperActivity) {
    const sniper = signal.safety.sniperActivity;
    
    // Sniper score
    let sniperStatus: 'SAFE' | 'CAUTION' | 'RISKY' | 'OK' = 'SAFE';
    if (sniper.sniperScore >= 60) sniperStatus = 'RISKY';
    else if (sniper.sniperScore >= 40) sniperStatus = 'CAUTION';
    else if (sniper.sniperScore >= 20) sniperStatus = 'OK';
    
    factors.push({
      factor: '🎯 Sniper Score',
      value: `${sniper.sniperScore} (${sniper.sniperRisk})`,
      status: sniperStatus,
      icon: sniperStatus === 'SAFE' ? '✅' : sniperStatus === 'OK' ? '👌' : sniperStatus === 'CAUTION' ? '⚠️' : '🚨'
    });
    
    // Total snipers
    if (sniper.totalSnipers > 0) {
      factors.push({
        factor: 'Total Snipers',
        value: `${sniper.totalSnipers} wallet${sniper.totalSnipers > 1 ? 's' : ''}`,
        status: sniper.totalSnipers >= 10 ? 'RISKY' : sniper.totalSnipers >= 5 ? 'CAUTION' : 'OK',
        icon: sniper.totalSnipers >= 10 ? '🚨' : sniper.totalSnipers >= 5 ? '⚠️' : '🎯'
      });
    }
    
    // Block 0 buyers (same block as launch = highly suspicious)
    if (sniper.block0Buyers > 0) {
      factors.push({
        factor: 'Block 0 Buyers',
        value: `${sniper.block0Buyers} sniper${sniper.block0Buyers > 1 ? 's' : ''}`,
        status: sniper.block0Buyers >= 5 ? 'RISKY' : sniper.block0Buyers >= 2 ? 'CAUTION' : 'OK',
        icon: sniper.block0Buyers >= 5 ? '🚨' : '⚡'
      });
    }
    
    // Known MEV bots
    if (sniper.knownMEVBots > 0) {
      factors.push({
        factor: 'MEV Bots',
        value: `${sniper.knownMEVBots} detected`,
        status: 'RISKY',
        icon: '🤖'
      });
    }
    
    // Sniper supply percentage
    if (sniper.sniperSupplyPercent >= 10) {
      factors.push({
        factor: 'Sniper Holdings',
        value: `${sniper.sniperSupplyPercent.toFixed(1)}%`,
        status: sniper.sniperSupplyPercent >= 40 ? 'RISKY' : sniper.sniperSupplyPercent >= 20 ? 'CAUTION' : 'OK',
        icon: sniper.sniperSupplyPercent >= 40 ? '🚨' : sniper.sniperSupplyPercent >= 20 ? '⚠️' : '📊'
      });
    }
    
    // Dump probability
    if (sniper.dumpProbability >= 30) {
      factors.push({
        factor: 'Dump Risk',
        value: `${sniper.dumpProbability.toFixed(0)}%`,
        status: sniper.dumpProbability >= 70 ? 'RISKY' : sniper.dumpProbability >= 50 ? 'CAUTION' : 'OK',
        icon: sniper.dumpProbability >= 70 ? '🚨' : sniper.dumpProbability >= 50 ? '⚠️' : '📉'
      });
    }
  }
  
  return factors;
}

/**
 * Generate summary text
 */
function generateSummary(
  signal: AggregatedSignal,
  sources: SourceExplanation[],
  market: MarketContextExplanation
): string {
  const sourceNames = sources.map(s => s.description).slice(0, 2).join(' and ');
  
  let summary = `This ${signal.score >= 70 ? 'strong' : signal.score >= 50 ? 'moderate' : 'weak'} `;
  summary += `signal for $${signal.symbol} was triggered because ${sourceNames} `;
  summary += sources.length > 2 ? `and ${sources.length - 2} other source(s) ` : '';
  summary += `detected activity on this token.`;
  
  if (market.netImpact !== 0) {
    summary += ` Market conditions are currently ${market.trend.toLowerCase()}, `;
    summary += `${market.netImpact > 0 ? 'boosting' : 'reducing'} the signal score by ${Math.abs(market.netImpact)} points.`;
  }
  
  return summary;
}

/**
 * Generate conclusion text
 */
function generateConclusion(
  signal: AggregatedSignal,
  sources: SourceExplanation[],
  market: MarketContextExplanation,
  risks: RiskFactor[]
): string {
  const strongSources = sources.filter(s => s.impact === 'STRONG').length;
  const hasSmartWallet = sources.some(s => s.source.includes('smart-wallet'));
  const riskyFactors = risks.filter(r => r.status === 'RISKY').length;
  const safeFactors = risks.filter(r => r.status === 'SAFE' || r.status === 'OK').length;
  
  let conclusion = '';
  
  // Strength assessment
  if (signal.score >= 75 && strongSources >= 1) {
    conclusion = 'Strong signal with high-quality source confirmation. ';
  } else if (signal.score >= 60 && sources.length >= 2) {
    conclusion = 'Decent signal with multiple source validation. ';
  } else {
    conclusion = 'Weaker signal requiring additional validation. ';
  }
  
  // Smart wallet emphasis
  if (hasSmartWallet) {
    conclusion += 'Smart wallet activity adds significant credibility. ';
  }
  
  // Market context
  if (market.trend === 'BEARISH' && signal.score >= 65) {
    conclusion += 'Signal remains strong despite bearish market conditions. ';
  } else if (market.trend === 'BULLISH') {
    conclusion += 'Bullish market provides favorable tailwinds. ';
  }
  
  // Risk summary
  if (riskyFactors > 0) {
    conclusion += `⚠️ ${riskyFactors} risk factor${riskyFactors > 1 ? 's' : ''} detected - exercise caution.`;
  } else if (safeFactors >= 3) {
    conclusion += 'Risk profile appears acceptable for the signal strength.';
  }
  
  // Honeypot warning - CRITICAL
  if (signal.safety?.honeypotRisk?.isHoneypot) {
    conclusion = `🍯🚨 HONEYPOT DETECTED! This token cannot be sold. DO NOT BUY under any circumstances. ` + conclusion;
  } else if (signal.safety?.honeypotRisk?.riskLevel === 'HIGH_RISK') {
    conclusion += ` 🍯⚠️ HIGH HONEYPOT RISK - possible sell restrictions or high taxes. Proceed with extreme caution!`;
  } else if (!signal.safety?.honeypotRisk?.canSell) {
    conclusion += ` 🍯⚠️ Cannot confirm sellability - potential honeypot.`;
  } else if (signal.safety?.honeypotRisk?.sellTax !== undefined && signal.safety.honeypotRisk.sellTax >= 10) {
    conclusion += ` 💰 High sell tax (${signal.safety.honeypotRisk.sellTax.toFixed(1)}%) will significantly impact profits.`;
  }
  
  // Bundle warning
  if (signal.safety?.bundleScore !== undefined && signal.safety.bundleScore >= 60) {
    conclusion += ` 🚨 HIGH BUNDLE SCORE (${signal.safety.bundleScore}) - potential coordinated buying detected!`;
  } else if (signal.safety?.bundleScore !== undefined && signal.safety.bundleScore >= 40) {
    conclusion += ` ⚠️ Moderate bundle activity detected (score: ${signal.safety.bundleScore}).`;
  }
  
  // Wash trading warning
  if (signal.safety?.washScore !== undefined && signal.safety.washScore >= 70) {
    const realPct = signal.safety.washVolumePercent !== undefined ? (100 - signal.safety.washVolumePercent) : null;
    const realVolStr = realPct !== null ? ` Only ~${realPct}% of volume is real.` : '';
    conclusion += ` 🚿🚨 EXTREME WASH TRADING (${signal.safety.washScore}) - most volume is fake!${realVolStr}`;
  } else if (signal.safety?.washScore !== undefined && signal.safety.washScore >= 50) {
    conclusion += ` 🚿⚠️ High wash trading indicators (score: ${signal.safety.washScore}) - verify volume authenticity!`;
  } else if (signal.safety?.washScore !== undefined && signal.safety.washScore >= 30) {
    conclusion += ` 🚿 Some wash trading patterns detected (score: ${signal.safety.washScore}).`;
  }
  
  // Sniper activity warning
  if (signal.safety?.sniperActivity) {
    const sniper = signal.safety.sniperActivity;
    if (sniper.sniperRisk === 'CRITICAL') {
      conclusion += ` 🎯🚨 CRITICAL SNIPER ACTIVITY (${sniper.sniperScore}) - ${sniper.totalSnipers} snipers control ${sniper.sniperSupplyPercent.toFixed(1)}% of supply! ${sniper.dumpProbability.toFixed(0)}% dump probability!`;
    } else if (sniper.sniperRisk === 'HIGH') {
      conclusion += ` 🎯⚠️ HIGH SNIPER ACTIVITY - ${sniper.totalSnipers} snipers detected with ${sniper.dumpProbability.toFixed(0)}% dump risk. Consider waiting for snipers to exit.`;
    } else if (sniper.sniperRisk === 'MEDIUM' && sniper.knownMEVBots > 0) {
      conclusion += ` 🎯 MEV bots detected (${sniper.knownMEVBots}) - automated front-running possible.`;
    } else if (sniper.block0Buyers >= 3) {
      conclusion += ` 🎯 ${sniper.block0Buyers} wallets bought in block 0 - possible coordinated launch sniping.`;
    }
  }
  
  // Confluence
  if (sources.length >= 3) {
    conclusion += ` Confluence of ${sources.length} sources increases confidence.`;
  }
  
  return conclusion.trim();
}

/**
 * Format explanation as text (for Telegram/CLI)
 */
export function formatExplanationText(exp: DetailedExplanation): string {
  let text = `🎯 Signal Explanation: $${exp.symbol}\n`;
  text += '━'.repeat(35) + '\n\n';
  
  // Sources section
  text += `📊 Sources (${exp.totalConfirmations} confirmation${exp.totalConfirmations !== 1 ? 's' : ''}):\n`;
  for (const source of exp.sources) {
    text += `${source.icon} ${source.description}: ${source.detail}\n`;
  }
  text += '\n';
  
  // Market context
  text += '🌡️ Market Context:\n';
  text += `• Overall: ${exp.marketContext.overall}\n`;
  text += `• Volatility: ${exp.marketContext.volatility}`;
  if (exp.marketContext.volatilityImpact !== 0) {
    text += ` (${exp.marketContext.volatilityImpact > 0 ? '+' : ''}${exp.marketContext.volatilityImpact} pts)`;
  }
  text += '\n';
  text += `• Net impact: ${exp.marketContext.netImpact > 0 ? '+' : ''}${exp.marketContext.netImpact} pts\n`;
  if (exp.marketContext.btcContext) text += `• ${exp.marketContext.btcContext}\n`;
  if (exp.marketContext.solContext) text += `• ${exp.marketContext.solContext}\n`;
  text += '\n';
  
  // Risk factors
  text += '⚠️ Risk Factors:\n';
  for (const risk of exp.riskFactors) {
    text += `• ${risk.factor}: ${risk.value} ${risk.icon}\n`;
  }
  text += '\n';
  
  // Conclusion
  text += '💡 Conclusion:\n';
  text += exp.conclusion + '\n\n';
  
  // Score
  text += `📈 Score: ${exp.score}/100 | Confidence: ${exp.confidenceLevel}`;
  
  return text;
}

/**
 * Format explanation as HTML (for dashboard modal)
 */
export function formatExplanationHtml(exp: DetailedExplanation): string {
  const impactColors = {
    STRONG: '#22c55e',
    MODERATE: '#eab308',
    WEAK: '#888'
  };
  
  const statusColors = {
    SAFE: '#22c55e',
    OK: '#00d9ff',
    CAUTION: '#f97316',
    RISKY: '#ef4444'
  };
  
  let html = `
    <div class="exp-header">
      <div class="exp-symbol">$${exp.symbol}</div>
      <div class="exp-score exp-score-${exp.confidenceLevel.toLowerCase()}">${exp.score}</div>
    </div>
    
    <div class="exp-summary">${exp.summary}</div>
    
    <div class="exp-section">
      <div class="exp-section-title">📊 Sources (${exp.totalConfirmations} confirmation${exp.totalConfirmations !== 1 ? 's' : ''})</div>
      <div class="exp-sources">
        ${exp.sources.map(s => `
          <div class="exp-source">
            <span class="exp-source-icon">${s.icon}</span>
            <div class="exp-source-content">
              <div class="exp-source-name">${s.description}</div>
              <div class="exp-source-detail">${s.detail}</div>
            </div>
            <span class="exp-source-impact" style="color: ${impactColors[s.impact]}">${s.impact}</span>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="exp-section">
      <div class="exp-section-title">🌡️ Market Context</div>
      <div class="exp-market">
        <div class="exp-market-row">
          <span>Overall</span>
          <span>${exp.marketContext.overall}</span>
        </div>
        <div class="exp-market-row">
          <span>Volatility</span>
          <span>${exp.marketContext.volatility}${exp.marketContext.volatilityImpact !== 0 ? ` (${exp.marketContext.volatilityImpact > 0 ? '+' : ''}${exp.marketContext.volatilityImpact} pts)` : ''}</span>
        </div>
        <div class="exp-market-row exp-market-net">
          <span>Net Impact</span>
          <span style="color: ${exp.marketContext.netImpact >= 0 ? '#22c55e' : '#ef4444'}">${exp.marketContext.netImpact > 0 ? '+' : ''}${exp.marketContext.netImpact} pts</span>
        </div>
        ${exp.marketContext.btcContext ? `<div class="exp-market-row"><span>Bitcoin</span><span>${exp.marketContext.btcContext}</span></div>` : ''}
        ${exp.marketContext.solContext ? `<div class="exp-market-row"><span>Solana</span><span>${exp.marketContext.solContext}</span></div>` : ''}
      </div>
    </div>
    
    <div class="exp-section">
      <div class="exp-section-title">⚠️ Risk Factors</div>
      <div class="exp-risks">
        ${exp.riskFactors.map(r => `
          <div class="exp-risk">
            <span class="exp-risk-factor">${r.factor}</span>
            <span class="exp-risk-value">${r.value}</span>
            <span class="exp-risk-status" style="color: ${statusColors[r.status]}">${r.icon}</span>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="exp-conclusion">
      <div class="exp-section-title">💡 Conclusion</div>
      <p>${exp.conclusion}</p>
    </div>
  `;
  
  return html;
}

export { DetailedExplanation as Explanation };
