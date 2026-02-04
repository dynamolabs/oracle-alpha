import { RawSignal } from '../types';

// Enhanced Whale Accumulation Tracker
// Detects large wallet accumulation patterns with advanced logic

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

// Whale thresholds (USD)
const WHALE_MIN_USD = 5000; // $5K+ = whale
const MEGA_WHALE_USD = 25000; // $25K+ = mega whale
const SUPER_WHALE_USD = 100000; // $100K+ = super whale

// Pattern thresholds
const ACCUMULATION_WINDOW = 30 * 60 * 1000; // 30 minutes
const ACCUMULATION_MIN_WALLETS = 2; // Min unique wallets for accumulation
const ACCUMULATION_MIN_TOTAL = 50000; // $50K total for strong accumulation

interface WhaleTransaction {
  signature: string;
  timestamp: number;
  token: string;
  symbol?: string;
  amount: number;
  amountUsd: number;
  wallet: string;
  type: 'BUY' | 'SELL';
  txCount?: number;
}

interface AccumulationPattern {
  token: string;
  count: number;
  totalUsd: number;
  wallets: Set<string>;
  firstSeen: number;
  lastSeen: number;
  avgSize: number;
  pattern: 'GRADUAL' | 'AGGRESSIVE' | 'SPLIT' | 'UNKNOWN';
  buyPressure: number; // Buy vs sell ratio
}

// Track recent whale activity
const accumulationTracking = new Map<string, AccumulationPattern>();

// Analyze accumulation pattern type
function analyzeAccumulationPattern(pattern: AccumulationPattern): 'GRADUAL' | 'AGGRESSIVE' | 'SPLIT' | 'UNKNOWN' {
  const timeSpan = pattern.lastSeen - pattern.firstSeen;
  const avgTimeBetween = timeSpan / (pattern.count || 1);
  
  // Aggressive: Fast buys, high amounts
  if (avgTimeBetween < 60000 && pattern.avgSize > MEGA_WHALE_USD) {
    return 'AGGRESSIVE';
  }
  
  // Split: Multiple wallets, similar sizes
  if (pattern.wallets.size >= 3) {
    return 'SPLIT';
  }
  
  // Gradual: Spread out over time
  if (timeSpan > 10 * 60 * 1000 && pattern.count >= 3) {
    return 'GRADUAL';
  }
  
  return 'UNKNOWN';
}

// Fetch whale transactions from multiple sources
async function fetchLargeTransactions(): Promise<WhaleTransaction[]> {
  const transactions: WhaleTransaction[] = [];

  try {
    // Source 1: DexScreener boosted tokens (high activity = whale interest)
    const boostResponse = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    const boostData = await boostResponse.json();
    
    const solanaTokens = boostData
      .filter((t: any) => t.chainId === 'solana')
      .slice(0, 20);
    
    for (const token of solanaTokens) {
      try {
        const tradesRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.tokenAddress}`);
        const tradesData = await tradesRes.json();
        const pair = tradesData.pairs?.[0];
        
        if (!pair) continue;
        
        // Analyze transaction patterns
        const vol5m = pair.volume?.m5 || 0;
        const vol1h = pair.volume?.h1 || 0;
        const buys5m = pair.txns?.m5?.buys || 0;
        const sells5m = pair.txns?.m5?.sells || 0;
        const buys1h = pair.txns?.h1?.buys || 0;
        const sells1h = pair.txns?.h1?.sells || 0;
        
        const txCount5m = buys5m + sells5m;
        const avgTxSize5m = txCount5m > 0 ? vol5m / txCount5m : 0;
        
        // Whale detection heuristics
        const hasWhaleActivity = avgTxSize5m >= WHALE_MIN_USD;
        const hasBuyPressure = buys5m > sells5m * 1.5 || buys1h > sells1h * 1.3;
        const hasVolumeSpike = vol5m > 0 && vol1h > 0 && (vol5m * 12 > vol1h); // 5m volume suggests acceleration
        
        if (hasWhaleActivity || (hasBuyPressure && vol5m > 10000)) {
          const estimatedWhaleAmount = hasWhaleActivity ? avgTxSize5m : vol5m / Math.max(1, buys5m);
          
          transactions.push({
            signature: `estimated-${token.tokenAddress.slice(0, 8)}`,
            timestamp: Date.now(),
            token: token.tokenAddress,
            symbol: pair.baseToken?.symbol,
            amount: 0,
            amountUsd: estimatedWhaleAmount,
            wallet: 'whale-aggregate',
            type: 'BUY',
            txCount: buys5m
          });
          
          // Track accumulation patterns
          updateAccumulationTracking(
            token.tokenAddress,
            estimatedWhaleAmount,
            'whale-aggregate',
            buys5m / (sells5m + 1)
          );
        }
        
        // Also check for selling pressure (early warning)
        if (sells5m > buys5m * 2 && avgTxSize5m >= WHALE_MIN_USD) {
          transactions.push({
            signature: `sell-pressure-${token.tokenAddress.slice(0, 8)}`,
            timestamp: Date.now(),
            token: token.tokenAddress,
            symbol: pair.baseToken?.symbol,
            amount: 0,
            amountUsd: avgTxSize5m,
            wallet: 'whale-aggregate-sell',
            type: 'SELL'
          });
        }
      } catch {
        continue;
      }
    }
    
    // Source 2: Use Helius for actual whale tracking if API key available
    if (HELIUS_API_KEY) {
      const heliusWhales = await fetchHeliusWhaleActivity();
      transactions.push(...heliusWhales);
    }
    
  } catch (error) {
    console.error('[WHALE] Error fetching transactions:', error);
  }

  return transactions;
}

// Fetch whale activity from Helius (if API key available)
async function fetchHeliusWhaleActivity(): Promise<WhaleTransaction[]> {
  if (!HELIUS_API_KEY) return [];
  
  try {
    // Monitor known whale wallets
    const KNOWN_WHALES = [
      // These would be populated with known whale addresses
      // For now, return empty since we need real addresses
    ];
    
    // Could use Helius enhanced transactions API here
    return [];
  } catch (error) {
    console.error('[WHALE] Helius API error:', error);
    return [];
  }
}

// Update accumulation tracking
function updateAccumulationTracking(
  token: string,
  amountUsd: number,
  wallet: string,
  buyPressure: number
): void {
  const now = Date.now();
  let tracking = accumulationTracking.get(token);
  
  if (!tracking || now - tracking.lastSeen > ACCUMULATION_WINDOW) {
    // Start new tracking period
    tracking = {
      token,
      count: 1,
      totalUsd: amountUsd,
      wallets: new Set([wallet]),
      firstSeen: now,
      lastSeen: now,
      avgSize: amountUsd,
      pattern: 'UNKNOWN',
      buyPressure
    };
  } else {
    // Update existing tracking
    tracking.count++;
    tracking.totalUsd += amountUsd;
    tracking.wallets.add(wallet);
    tracking.lastSeen = now;
    tracking.avgSize = tracking.totalUsd / tracking.count;
    tracking.buyPressure = (tracking.buyPressure + buyPressure) / 2;
  }
  
  // Analyze pattern
  tracking.pattern = analyzeAccumulationPattern(tracking);
  
  accumulationTracking.set(token, tracking);
}

// Check if accumulation signal is strong enough
function isStrongAccumulation(tracking: AccumulationPattern): boolean {
  // Multiple conditions for strong accumulation
  const hasMultipleWallets = tracking.wallets.size >= ACCUMULATION_MIN_WALLETS;
  const hasHighTotal = tracking.totalUsd >= ACCUMULATION_MIN_TOTAL;
  const hasHighBuyPressure = tracking.buyPressure > 1.5;
  const hasGoodPattern = tracking.pattern === 'GRADUAL' || tracking.pattern === 'SPLIT';
  
  // Need at least 2 conditions met
  const conditionsMet = [hasMultipleWallets, hasHighTotal, hasHighBuyPressure, hasGoodPattern]
    .filter(Boolean).length;
    
  return conditionsMet >= 2;
}

async function getTokenInfo(address: string): Promise<{ symbol: string; name: string; mcap: number; liquidity: number }> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    
    return {
      symbol: pair?.baseToken?.symbol || 'UNKNOWN',
      name: pair?.baseToken?.name || 'Unknown',
      mcap: pair?.fdv || pair?.marketCap || 0,
      liquidity: pair?.liquidity?.usd || 0
    };
  } catch {
    return { symbol: 'UNKNOWN', name: 'Unknown', mcap: 0, liquidity: 0 };
  }
}

export async function scanWhaleActivity(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[WHALE] Scanning for whale accumulation...');

  const transactions = await fetchLargeTransactions();
  console.log(`[WHALE] Found ${transactions.length} potential whale transactions`);

  // Process transactions and generate signals
  const processedTokens = new Set<string>();
  
  for (const tx of transactions) {
    // Skip sells for now (could generate warning signals)
    if (tx.type !== 'BUY') continue;
    
    // Skip already processed
    if (processedTokens.has(tx.token)) continue;
    processedTokens.add(tx.token);
    
    const tracking = accumulationTracking.get(tx.token);
    const isAccumulation = tracking ? isStrongAccumulation(tracking) : false;
    const isMegaWhale = tx.amountUsd >= MEGA_WHALE_USD;
    const isSuperWhale = tx.amountUsd >= SUPER_WHALE_USD;
    
    // Only signal if accumulation pattern or mega whale
    if (!isAccumulation && !isMegaWhale) continue;
    
    const tokenInfo = await getTokenInfo(tx.token);
    
    // Skip if mcap too high (less upside potential)
    if (tokenInfo.mcap > 10000000) continue; // $10M cap
    
    // Skip if liquidity too low (manipulation risk)
    if (tokenInfo.liquidity < 10000) continue; // $10K min liquidity
    
    // Calculate confidence based on multiple factors
    let confidence = 50; // Base
    
    // Whale size bonus
    if (isSuperWhale) confidence += 25;
    else if (isMegaWhale) confidence += 15;
    else confidence += 5;
    
    // Accumulation pattern bonus
    if (isAccumulation) {
      confidence += 15;
      if (tracking?.pattern === 'GRADUAL') confidence += 5;
      if (tracking?.pattern === 'SPLIT') confidence += 10;
    }
    
    // Buy pressure bonus
    if (tracking && tracking.buyPressure > 2) confidence += 10;
    else if (tracking && tracking.buyPressure > 1.5) confidence += 5;
    
    // Liquidity safety bonus
    const liqToMcapRatio = tokenInfo.liquidity / (tokenInfo.mcap || 1);
    if (liqToMcapRatio > 0.1) confidence += 5; // Good liquidity
    
    confidence = Math.min(100, confidence);
    
    signals.push({
      source: 'whale-tracker',
      timestamp: now,
      token: tx.token,
      symbol: tx.symbol || tokenInfo.symbol,
      name: tokenInfo.name,
      action: 'BUY',
      confidence,
      metadata: {
        whaleAmount: tx.amountUsd,
        isMegaWhale,
        isSuperWhale,
        isAccumulation,
        accumulationPattern: tracking?.pattern,
        accumulationTotal: tracking?.totalUsd,
        accumulationCount: tracking?.count,
        uniqueWallets: tracking?.wallets.size,
        buyPressure: tracking?.buyPressure,
        mcap: tokenInfo.mcap,
        liquidity: tokenInfo.liquidity,
        liqToMcapRatio: liqToMcapRatio.toFixed(4)
      }
    });
  }

  console.log(`[WHALE] Found ${signals.length} whale signals`);
  return signals;
}

// Cleanup old tracking data
export function cleanupWhaleTracking(): void {
  const now = Date.now();
  const CLEANUP_AGE = 2 * 60 * 60 * 1000; // 2 hours
  
  for (const [token, tracking] of accumulationTracking.entries()) {
    if (now - tracking.lastSeen > CLEANUP_AGE) {
      accumulationTracking.delete(token);
    }
  }
}

// Export for testing
export { 
  accumulationTracking, 
  analyzeAccumulationPattern, 
  isStrongAccumulation,
  WHALE_MIN_USD,
  MEGA_WHALE_USD,
  SUPER_WHALE_USD
};
