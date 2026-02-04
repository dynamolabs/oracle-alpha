/**
 * Wash Trading Detection Module
 * 
 * Detects fake volume through:
 * - Self-trading patterns (same wallet buy/sell cycles)
 * - Circular transactions between wallet clusters
 * - Suspiciously regular trading intervals
 * - Volume spikes without price movement
 * - Low holder count + high volume anomalies
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d079301-97d2-4ae9-81fd-e56f00a891f4';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// ============= TYPES =============

export interface SelfTrade {
  wallet: string;
  buyTx: string;
  sellTx: string;
  buyAmount: number;
  sellAmount: number;
  timeBetweenMs: number;
  suspicionScore: number;
}

export interface CircularPattern {
  wallets: string[];
  transactions: string[];
  totalVolume: number;
  cycleTimeMs: number;
  confidence: number; // 0-100, how confident we are this is circular
}

export interface IntervalAnomaly {
  averageIntervalMs: number;
  stdDeviation: number;
  regularityScore: number; // 0-100, higher = more suspiciously regular
  transactionCount: number;
}

export interface VolumeAnomalyData {
  reportedVolume: number;
  priceChange: number;
  volumeToPriceRatio: number;  // High ratio with low price change = suspicious
  holderCount: number;
  volumePerHolder: number;
  anomalyScore: number; // 0-100
}

export interface WashTradingWarning {
  code: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dataPoints?: Record<string, any>;
}

export interface WashTradingAnalysis {
  token: string;
  symbol?: string;
  
  // Core metrics
  washScore: number;           // 0-100, higher = more wash trading
  riskLevel: 'EXTREME' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
  
  // Volume analysis
  reportedVolume24h: number;   // What DexScreener shows
  estimatedRealVolume: number; // Our estimate of real volume
  washVolumePercent: number;   // Percentage that's fake
  realVolumePercent: number;   // Percentage that's real
  
  // Detection results
  selfTrades: SelfTrade[];
  selfTradeCount: number;
  selfTradeVolume: number;
  
  circularPatterns: CircularPattern[];
  circularPatternCount: number;
  circularVolume: number;
  
  intervalAnalysis: IntervalAnomaly | null;
  volumeAnomaly: VolumeAnomalyData | null;
  
  // Cluster analysis
  suspiciousWalletCount: number;
  uniqueTraders: number;
  traderToVolumeRatio: number;  // Low ratio = sus (few wallets, high volume)
  
  // Red flags
  warnings: WashTradingWarning[];
  
  // Metadata
  analyzedAt: number;
  transactionsAnalyzed: number;
  cached: boolean;
}

// ============= CACHE =============

const washCache = new Map<string, { data: WashTradingAnalysis; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============= HELPERS =============

/**
 * Get recent transactions for a token
 */
async function getTokenTransactions(mintAddress: string, limit = 200): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=${limit}`
    );
    
    if (!response.ok) {
      console.error('[WASH] Helius API error:', response.status);
      return [];
    }
    
    return await response.json() || [];
  } catch (error) {
    console.error('[WASH] Failed to get transactions:', error);
    return [];
  }
}

/**
 * Get token metadata from DexScreener
 */
async function getTokenData(mintAddress: string): Promise<{
  symbol: string;
  volume24h: number;
  priceChange24h: number;
  holders?: number;
  price?: number;
  mcap?: number;
}> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    
    if (!pair) {
      return {
        symbol: 'UNKNOWN',
        volume24h: 0,
        priceChange24h: 0
      };
    }
    
    return {
      symbol: pair.baseToken?.symbol || 'UNKNOWN',
      volume24h: pair.volume?.h24 || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      price: parseFloat(pair.priceUsd || '0'),
      mcap: pair.marketCap || 0
    };
  } catch (error) {
    return {
      symbol: 'UNKNOWN',
      volume24h: 0,
      priceChange24h: 0
    };
  }
}

/**
 * Get holder count for a token
 */
async function getHolderCount(mintAddress: string): Promise<number> {
  try {
    // Use Helius DAS API for accurate holder count
    const response = await fetch(`https://api.helius.xyz/v0/tokens/${mintAddress}/holders?api-key=${HELIUS_API_KEY}&limit=1`);
    
    if (!response.ok) return 0;
    
    const data = await response.json();
    return data.total || 0;
  } catch (error) {
    // Fallback: estimate from largest accounts
    try {
      const response = await fetch(HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'holders',
          method: 'getTokenLargestAccounts',
          params: [mintAddress]
        })
      });
      
      const data = await response.json();
      // Rough estimate: multiply top 20 by 5
      return (data.result?.value?.length || 0) * 5;
    } catch {
      return 0;
    }
  }
}

// ============= DETECTION ALGORITHMS =============

/**
 * Detect self-trading patterns (same wallet buy/sell cycles)
 */
function detectSelfTrades(transactions: any[], mintAddress: string): SelfTrade[] {
  const selfTrades: SelfTrade[] = [];
  const walletTxs = new Map<string, any[]>();
  
  // Group transactions by wallet
  for (const tx of transactions) {
    if (!tx.tokenTransfers) continue;
    
    for (const transfer of tx.tokenTransfers) {
      if (transfer.mint !== mintAddress) continue;
      
      const wallet = transfer.fromUserAccount || transfer.toUserAccount;
      if (!wallet) continue;
      
      const txs = walletTxs.get(wallet) || [];
      txs.push({
        ...tx,
        isBuy: transfer.toUserAccount === wallet,
        amount: transfer.tokenAmount || 0,
        timestamp: (tx.timestamp || 0) * 1000
      });
      walletTxs.set(wallet, txs);
    }
  }
  
  // Find wallets with both buy and sell within short timeframes
  for (const [wallet, txs] of Array.from(walletTxs.entries())) {
    const buys = txs.filter(t => t.isBuy).sort((a, b) => a.timestamp - b.timestamp);
    const sells = txs.filter(t => !t.isBuy).sort((a, b) => a.timestamp - b.timestamp);
    
    // Look for quick buy/sell cycles (within 5 minutes)
    for (const buy of buys) {
      for (const sell of sells) {
        const timeBetween = Math.abs(sell.timestamp - buy.timestamp);
        
        // Quick cycle = suspicious
        if (timeBetween < 5 * 60 * 1000 && timeBetween > 0) {
          const suspicionScore = Math.min(100, Math.round(100 - (timeBetween / (5 * 60 * 1000)) * 50));
          
          selfTrades.push({
            wallet,
            buyTx: buy.signature,
            sellTx: sell.signature,
            buyAmount: buy.amount,
            sellAmount: sell.amount,
            timeBetweenMs: timeBetween,
            suspicionScore
          });
        }
      }
    }
  }
  
  return selfTrades;
}

/**
 * Detect circular transaction patterns between wallet clusters
 */
function detectCircularPatterns(transactions: any[], mintAddress: string): CircularPattern[] {
  const patterns: CircularPattern[] = [];
  const edges = new Map<string, Set<string>>(); // from -> to wallets
  const txMap = new Map<string, any[]>(); // edge -> transactions
  
  // Build transaction graph
  for (const tx of transactions) {
    if (!tx.tokenTransfers) continue;
    
    for (const transfer of tx.tokenTransfers) {
      if (transfer.mint !== mintAddress) continue;
      
      const from = transfer.fromUserAccount;
      const to = transfer.toUserAccount;
      
      if (!from || !to || from === to) continue;
      
      // Track edge
      const fromSet = edges.get(from) || new Set();
      fromSet.add(to);
      edges.set(from, fromSet);
      
      // Track transaction for this edge
      const key = `${from}->${to}`;
      const txList = txMap.get(key) || [];
      txList.push(tx);
      txMap.set(key, txList);
    }
  }
  
  // Find cycles using DFS (look for 2-4 wallet cycles)
  const visited = new Set<string>();
  
  function findCycles(start: string, current: string, path: string[], depth: number): string[][] {
    const cycles: string[][] = [];
    
    if (depth > 4) return cycles;
    
    const neighbors = edges.get(current);
    if (!neighbors) return cycles;
    
    for (const next of Array.from(neighbors)) {
      if (next === start && path.length >= 2) {
        // Found a cycle
        cycles.push([...path, next]);
      } else if (!path.includes(next)) {
        cycles.push(...findCycles(start, next, [...path, next], depth + 1));
      }
    }
    
    return cycles;
  }
  
  // Start DFS from each node
  for (const start of Array.from(edges.keys())) {
    if (visited.has(start)) continue;
    
    const cycles = findCycles(start, start, [start], 1);
    
    for (const cycle of cycles) {
      // Calculate volume in this cycle
      let totalVolume = 0;
      const txs: string[] = [];
      let minTime = Infinity;
      let maxTime = 0;
      
      for (let i = 0; i < cycle.length - 1; i++) {
        const key = `${cycle[i]}->${cycle[i + 1]}`;
        const edgeTxs = txMap.get(key) || [];
        
        for (const tx of edgeTxs) {
          totalVolume += tx.tokenTransfers?.reduce((sum: number, t: any) => 
            sum + (t.mint === mintAddress ? (t.tokenAmount || 0) : 0), 0) || 0;
          txs.push(tx.signature);
          
          const ts = (tx.timestamp || 0) * 1000;
          minTime = Math.min(minTime, ts);
          maxTime = Math.max(maxTime, ts);
        }
      }
      
      if (totalVolume > 0 && cycle.length >= 3) {
        // Confidence based on cycle length and speed
        const cycleTime = maxTime - minTime;
        const confidence = Math.min(100, 
          50 + // Base for finding a cycle
          (cycle.length <= 3 ? 20 : 10) + // Shorter cycles more suspicious
          (cycleTime < 10 * 60 * 1000 ? 30 : 10) // Fast cycles more suspicious
        );
        
        patterns.push({
          wallets: cycle.slice(0, -1), // Remove duplicate start
          transactions: txs,
          totalVolume,
          cycleTimeMs: cycleTime,
          confidence
        });
      }
    }
    
    // Mark all wallets in found cycles as visited
    for (const cycle of cycles) {
      cycle.forEach(w => visited.add(w));
    }
  }
  
  // Deduplicate and sort by confidence
  const seen = new Set<string>();
  return patterns
    .filter(p => {
      const key = p.wallets.sort().join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // Top 20 patterns
}

/**
 * Analyze trading intervals for suspicious regularity
 */
function analyzeIntervals(transactions: any[]): IntervalAnomaly | null {
  if (transactions.length < 10) return null;
  
  // Get timestamps sorted
  const timestamps = transactions
    .map(tx => (tx.timestamp || 0) * 1000)
    .filter(ts => ts > 0)
    .sort((a, b) => a - b);
  
  if (timestamps.length < 10) return null;
  
  // Calculate intervals
  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }
  
  // Calculate mean and std deviation
  const mean = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
  const variance = intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (lower = more regular)
  const cv = mean > 0 ? stdDev / mean : 1;
  
  // Convert to regularity score (0-100, higher = more suspicious regularity)
  // Natural trading has CV around 1-2, bot trading < 0.5
  const regularityScore = Math.min(100, Math.max(0, Math.round((1 - cv) * 100 + 50)));
  
  return {
    averageIntervalMs: mean,
    stdDeviation: stdDev,
    regularityScore,
    transactionCount: transactions.length
  };
}

/**
 * Analyze volume anomalies (high volume, low price movement)
 */
function analyzeVolumeAnomaly(
  volume24h: number,
  priceChange24h: number,
  holderCount: number
): VolumeAnomalyData {
  // Volume to price change ratio
  // Healthy tokens: volume correlates with price movement
  // Wash trading: high volume, minimal price change
  const absPriceChange = Math.abs(priceChange24h) || 0.01;
  const volumeToPriceRatio = volume24h / (absPriceChange * 1000);
  
  // Volume per holder
  // Healthy: distributed volume across many holders
  // Wash trading: concentrated volume, few holders
  const volumePerHolder = holderCount > 0 ? volume24h / holderCount : volume24h;
  
  let anomalyScore = 0;
  
  // High volume to price ratio = suspicious
  if (volumeToPriceRatio > 10000) anomalyScore += 40;
  else if (volumeToPriceRatio > 5000) anomalyScore += 25;
  else if (volumeToPriceRatio > 1000) anomalyScore += 10;
  
  // Very high volume per holder = suspicious
  if (volumePerHolder > 50000) anomalyScore += 35;
  else if (volumePerHolder > 10000) anomalyScore += 20;
  else if (volumePerHolder > 5000) anomalyScore += 10;
  
  // Low holder count with high volume = suspicious
  if (holderCount < 100 && volume24h > 100000) anomalyScore += 25;
  else if (holderCount < 500 && volume24h > 500000) anomalyScore += 15;
  
  return {
    reportedVolume: volume24h,
    priceChange: priceChange24h,
    volumeToPriceRatio,
    holderCount,
    volumePerHolder,
    anomalyScore: Math.min(100, anomalyScore)
  };
}

/**
 * Calculate overall wash score
 */
function calculateWashScore(
  selfTrades: SelfTrade[],
  circularPatterns: CircularPattern[],
  intervalAnalysis: IntervalAnomaly | null,
  volumeAnomaly: VolumeAnomalyData | null,
  uniqueTraders: number,
  totalVolume: number
): { washScore: number; warnings: WashTradingWarning[] } {
  let score = 0;
  const warnings: WashTradingWarning[] = [];
  
  // Self-trading contribution (max 30)
  if (selfTrades.length > 0) {
    const selfTradeScore = Math.min(30, selfTrades.length * 3);
    score += selfTradeScore;
    
    const severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 
      selfTrades.length >= 10 ? 'CRITICAL' : 
      selfTrades.length >= 5 ? 'HIGH' : 'MEDIUM';
    
    warnings.push({
      code: 'SELF_TRADING',
      message: `${selfTrades.length} self-trading cycles detected`,
      severity,
      dataPoints: { count: selfTrades.length }
    });
  }
  
  // Circular patterns contribution (max 30)
  if (circularPatterns.length > 0) {
    const avgConfidence = circularPatterns.reduce((s, p) => s + p.confidence, 0) / circularPatterns.length;
    const circularScore = Math.min(30, (circularPatterns.length * 5) + (avgConfidence / 5));
    score += circularScore;
    
    const severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 
      circularPatterns.length >= 5 ? 'CRITICAL' : 
      circularPatterns.length >= 2 ? 'HIGH' : 'MEDIUM';
    
    warnings.push({
      code: 'CIRCULAR_TRADING',
      message: `${circularPatterns.length} circular trading patterns found`,
      severity,
      dataPoints: { 
        count: circularPatterns.length,
        avgConfidence: Math.round(avgConfidence)
      }
    });
  }
  
  // Interval regularity contribution (max 20)
  if (intervalAnalysis && intervalAnalysis.regularityScore > 60) {
    const intervalScore = Math.min(20, (intervalAnalysis.regularityScore - 60) / 2);
    score += intervalScore;
    
    if (intervalAnalysis.regularityScore > 80) {
      warnings.push({
        code: 'BOT_INTERVALS',
        message: 'Suspiciously regular trading intervals detected (likely bot)',
        severity: 'HIGH',
        dataPoints: {
          regularityScore: intervalAnalysis.regularityScore,
          avgIntervalSec: Math.round(intervalAnalysis.averageIntervalMs / 1000)
        }
      });
    }
  }
  
  // Volume anomaly contribution (max 20)
  if (volumeAnomaly && volumeAnomaly.anomalyScore > 30) {
    const anomalyContrib = Math.min(20, volumeAnomaly.anomalyScore / 3);
    score += anomalyContrib;
    
    if (volumeAnomaly.anomalyScore > 50) {
      warnings.push({
        code: 'VOLUME_ANOMALY',
        message: 'High volume with minimal price impact (fake volume indicator)',
        severity: volumeAnomaly.anomalyScore > 70 ? 'CRITICAL' : 'HIGH',
        dataPoints: {
          volume: volumeAnomaly.reportedVolume,
          priceChange: volumeAnomaly.priceChange,
          holders: volumeAnomaly.holderCount
        }
      });
    }
  }
  
  // Low trader count relative to volume (max 10)
  if (uniqueTraders > 0 && totalVolume > 0) {
    const traderRatio = uniqueTraders / (totalVolume / 10000); // Traders per $10k volume
    if (traderRatio < 0.1) {
      score += 10;
      warnings.push({
        code: 'LOW_TRADERS',
        message: `Only ${uniqueTraders} unique traders for this volume`,
        severity: 'HIGH',
        dataPoints: { traders: uniqueTraders, volume: totalVolume }
      });
    } else if (traderRatio < 0.5) {
      score += 5;
      warnings.push({
        code: 'FEW_TRADERS',
        message: `Low number of unique traders relative to volume`,
        severity: 'MEDIUM',
        dataPoints: { traders: uniqueTraders, volume: totalVolume }
      });
    }
  }
  
  return {
    washScore: Math.min(100, Math.round(score)),
    warnings
  };
}

/**
 * Determine risk level from score
 */
function getWashRiskLevel(score: number): WashTradingAnalysis['riskLevel'] {
  if (score >= 80) return 'EXTREME';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'MINIMAL';
}

/**
 * Estimate real volume
 */
function estimateRealVolume(
  reportedVolume: number,
  washScore: number,
  selfTradeVolume: number,
  circularVolume: number
): number {
  // Start with reported volume
  let realVolume = reportedVolume;
  
  // Subtract detected wash volume directly
  realVolume -= selfTradeVolume;
  realVolume -= circularVolume * 0.8; // 80% of circular is wash
  
  // Apply additional discount based on wash score
  const discountFactor = 1 - (washScore / 200); // 50% score = 25% discount
  realVolume *= Math.max(0.1, discountFactor);
  
  return Math.max(0, realVolume);
}

// ============= MAIN ANALYSIS FUNCTION =============

/**
 * Analyze a token for wash trading
 */
export async function analyzeWashTrading(mintAddress: string): Promise<WashTradingAnalysis> {
  // Check cache
  const cached = washCache.get(mintAddress);
  if (cached && cached.expires > Date.now()) {
    return { ...cached.data, cached: true };
  }
  
  console.log(`[WASH] Analyzing ${mintAddress}...`);
  
  // Fetch data in parallel
  const [transactions, tokenData, holderCount] = await Promise.all([
    getTokenTransactions(mintAddress, 200),
    getTokenData(mintAddress),
    getHolderCount(mintAddress)
  ]);
  
  if (transactions.length === 0) {
    const emptyResult: WashTradingAnalysis = {
      token: mintAddress,
      symbol: tokenData.symbol,
      washScore: 0,
      riskLevel: 'MINIMAL',
      reportedVolume24h: tokenData.volume24h,
      estimatedRealVolume: tokenData.volume24h,
      washVolumePercent: 0,
      realVolumePercent: 100,
      selfTrades: [],
      selfTradeCount: 0,
      selfTradeVolume: 0,
      circularPatterns: [],
      circularPatternCount: 0,
      circularVolume: 0,
      intervalAnalysis: null,
      volumeAnomaly: null,
      suspiciousWalletCount: 0,
      uniqueTraders: 0,
      traderToVolumeRatio: 0,
      warnings: [{ 
        code: 'NO_DATA', 
        message: 'Insufficient transaction data for analysis',
        severity: 'LOW'
      }],
      analyzedAt: Date.now(),
      transactionsAnalyzed: 0,
      cached: false
    };
    washCache.set(mintAddress, { data: emptyResult, expires: Date.now() + CACHE_TTL });
    return emptyResult;
  }
  
  // Run detection algorithms
  const selfTrades = detectSelfTrades(transactions, mintAddress);
  const circularPatterns = detectCircularPatterns(transactions, mintAddress);
  const intervalAnalysis = analyzeIntervals(transactions);
  const volumeAnomaly = analyzeVolumeAnomaly(
    tokenData.volume24h,
    tokenData.priceChange24h,
    holderCount
  );
  
  // Count unique traders
  const uniqueWallets = new Set<string>();
  for (const tx of transactions) {
    if (tx.tokenTransfers) {
      for (const t of tx.tokenTransfers) {
        if (t.mint === mintAddress) {
          if (t.fromUserAccount) uniqueWallets.add(t.fromUserAccount);
          if (t.toUserAccount) uniqueWallets.add(t.toUserAccount);
        }
      }
    }
  }
  const uniqueTraders = uniqueWallets.size;
  
  // Calculate self-trade volume
  const selfTradeVolume = selfTrades.reduce((sum, st) => sum + st.buyAmount, 0);
  
  // Calculate circular volume
  const circularVolume = circularPatterns.reduce((sum, cp) => sum + cp.totalVolume, 0);
  
  // Calculate wash score
  const { washScore, warnings } = calculateWashScore(
    selfTrades,
    circularPatterns,
    intervalAnalysis,
    volumeAnomaly,
    uniqueTraders,
    tokenData.volume24h
  );
  
  // Get risk level
  const riskLevel = getWashRiskLevel(washScore);
  
  // Estimate real volume
  const estimatedRealVolume = estimateRealVolume(
    tokenData.volume24h,
    washScore,
    selfTradeVolume,
    circularVolume
  );
  
  // Calculate percentages
  const washVolumePercent = tokenData.volume24h > 0 
    ? Math.round((1 - estimatedRealVolume / tokenData.volume24h) * 100)
    : 0;
  const realVolumePercent = 100 - washVolumePercent;
  
  // Count suspicious wallets
  const suspiciousWallets = new Set<string>();
  selfTrades.forEach(st => suspiciousWallets.add(st.wallet));
  circularPatterns.forEach(cp => cp.wallets.forEach(w => suspiciousWallets.add(w)));
  
  // Trader to volume ratio
  const traderToVolumeRatio = tokenData.volume24h > 0 
    ? uniqueTraders / (tokenData.volume24h / 1000)
    : 0;
  
  const analysis: WashTradingAnalysis = {
    token: mintAddress,
    symbol: tokenData.symbol,
    washScore,
    riskLevel,
    reportedVolume24h: tokenData.volume24h,
    estimatedRealVolume,
    washVolumePercent,
    realVolumePercent,
    selfTrades: selfTrades.slice(0, 10), // Top 10
    selfTradeCount: selfTrades.length,
    selfTradeVolume,
    circularPatterns: circularPatterns.slice(0, 10), // Top 10
    circularPatternCount: circularPatterns.length,
    circularVolume,
    intervalAnalysis,
    volumeAnomaly,
    suspiciousWalletCount: suspiciousWallets.size,
    uniqueTraders,
    traderToVolumeRatio,
    warnings,
    analyzedAt: Date.now(),
    transactionsAnalyzed: transactions.length,
    cached: false
  };
  
  // Cache result
  washCache.set(mintAddress, { data: analysis, expires: Date.now() + CACHE_TTL });
  
  console.log(`[WASH] ${mintAddress}: Score=${washScore}, Real=${realVolumePercent}%, Traders=${uniqueTraders}`);
  
  return analysis;
}

/**
 * Quick wash score check (cached only)
 */
export function getQuickWashScore(mintAddress: string): number | null {
  const cached = washCache.get(mintAddress);
  return cached ? cached.data.washScore : null;
}

/**
 * Get cached wash analysis
 */
export function getCachedWashAnalysis(mintAddress: string): WashTradingAnalysis | null {
  const cached = washCache.get(mintAddress);
  return cached ? { ...cached.data, cached: true } : null;
}

/**
 * Clear wash trading cache
 */
export function clearWashCache(): void {
  washCache.clear();
}

/**
 * Get wash trading risk emoji
 */
export function getWashEmoji(analysis: WashTradingAnalysis): string {
  switch (analysis.riskLevel) {
    case 'EXTREME': return '🚿🚨';
    case 'HIGH': return '🚿⚠️';
    case 'MEDIUM': return '🚿';
    case 'LOW': return '💧';
    case 'MINIMAL': return '✅';
    default: return '❓';
  }
}

/**
 * Format wash trading analysis for display
 */
export function formatWashAnalysis(analysis: WashTradingAnalysis): string {
  const emoji = getWashEmoji(analysis);
  const volumeK = (analysis.reportedVolume24h / 1000).toFixed(0);
  const realVolumeK = (analysis.estimatedRealVolume / 1000).toFixed(0);
  
  let output = `${emoji} WASH TRADING ANALYSIS: ${analysis.symbol || 'Token'}\n`;
  output += '━'.repeat(35) + '\n\n';
  
  output += `📊 Reported Volume: $${volumeK}K\n`;
  output += `✨ Estimated Real: $${realVolumeK}K (${analysis.realVolumePercent}%)\n`;
  output += `🚿 Wash Score: ${analysis.washScore}/100 (${analysis.riskLevel})\n\n`;
  
  if (analysis.selfTradeCount > 0) {
    output += `🔄 Self-trades: ${analysis.selfTradeCount}\n`;
  }
  if (analysis.circularPatternCount > 0) {
    output += `🔁 Circular patterns: ${analysis.circularPatternCount}\n`;
  }
  if (analysis.uniqueTraders > 0) {
    output += `👥 Unique traders: ${analysis.uniqueTraders}\n`;
  }
  
  if (analysis.warnings.length > 0) {
    output += '\n🚩 Warnings:\n';
    for (const warning of analysis.warnings.slice(0, 5)) {
      const severityEmoji = warning.severity === 'CRITICAL' ? '🔴' :
                           warning.severity === 'HIGH' ? '🟠' :
                           warning.severity === 'MEDIUM' ? '🟡' : '🟢';
      output += `${severityEmoji} ${warning.message}\n`;
    }
  }
  
  // Status line
  if (analysis.washScore >= 70) {
    output += '\n⚠️ Status: FAKE VOLUME DETECTED';
  } else if (analysis.washScore >= 40) {
    output += '\n⚡ Status: SUSPICIOUS ACTIVITY';
  } else {
    output += '\n✅ Status: VOLUME APPEARS ORGANIC';
  }
  
  return output;
}

/**
 * Get wash warning for signal display
 */
export function getWashWarning(analysis: WashTradingAnalysis): string | null {
  if (analysis.riskLevel === 'MINIMAL' || analysis.riskLevel === 'LOW') {
    return null;
  }
  
  const emoji = analysis.riskLevel === 'EXTREME' ? '🚨' : '⚠️';
  
  let warning = `${emoji} WASH TRADING DETECTED\n`;
  warning += `• Wash Score: ${analysis.washScore} (${analysis.riskLevel})\n`;
  warning += `• Real Volume: ~${analysis.realVolumePercent}%\n`;
  
  if (analysis.selfTradeCount > 0) {
    warning += `• Self-trades: ${analysis.selfTradeCount}\n`;
  }
  if (analysis.circularPatternCount > 0) {
    warning += `• Circular patterns: ${analysis.circularPatternCount}`;
  }
  
  return warning;
}
