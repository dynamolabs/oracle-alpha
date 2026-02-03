import { RawSignal } from '../types';

// Whale Accumulation Tracker
// Detects large wallet accumulation patterns

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d079301-97d2-4ae9-81fd-e56f00a891f4';

interface WhaleTransaction {
  signature: string;
  timestamp: number;
  token: string;
  amount: number;
  amountUsd: number;
  wallet: string;
  type: 'BUY' | 'SELL';
}

// Whale thresholds
const WHALE_MIN_USD = 5000; // $5K+ = whale
const MEGA_WHALE_USD = 25000; // $25K+ = mega whale

// Track recent whale buys to detect accumulation
const recentWhaleBuys = new Map<string, { count: number; totalUsd: number; wallets: Set<string>; firstSeen: number }>();

async function fetchLargeTransactions(): Promise<WhaleTransaction[]> {
  try {
    // Use DexScreener's token profiles for tokens with high volume
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    const data = await response.json();
    
    const transactions: WhaleTransaction[] = [];
    
    // Get top Solana tokens
    const solanaTokens = data
      .filter((t: any) => t.chainId === 'solana')
      .slice(0, 15);
    
    for (const token of solanaTokens) {
      // Fetch recent trades
      try {
        const tradesRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.tokenAddress}`);
        const tradesData = await tradesRes.json();
        const pair = tradesData.pairs?.[0];
        
        if (!pair) continue;
        
        // Estimate whale activity from volume and tx count
        const vol5m = pair.volume?.m5 || 0;
        const txCount = (pair.txns?.m5?.buys || 0) + (pair.txns?.m5?.sells || 0);
        const avgTxSize = txCount > 0 ? vol5m / txCount : 0;
        
        // If average transaction size is large, likely whale activity
        if (avgTxSize >= WHALE_MIN_USD) {
          transactions.push({
            signature: 'estimated',
            timestamp: Date.now(),
            token: token.tokenAddress,
            amount: 0,
            amountUsd: avgTxSize,
            wallet: 'whale-aggregate',
            type: 'BUY'
          });
        }
      } catch {
        continue;
      }
    }
    
    return transactions;
  } catch (error) {
    console.error('[WHALE] Error fetching transactions:', error);
    return [];
  }
}

// Detect accumulation patterns (multiple whales buying same token)
function detectAccumulation(token: string, amountUsd: number, wallet: string): boolean {
  const now = Date.now();
  const WINDOW = 30 * 60 * 1000; // 30 minute window
  
  let tracking = recentWhaleBuys.get(token);
  
  if (!tracking) {
    tracking = { count: 1, totalUsd: amountUsd, wallets: new Set([wallet]), firstSeen: now };
    recentWhaleBuys.set(token, tracking);
    return false;
  }
  
  // Check if within window
  if (now - tracking.firstSeen > WINDOW) {
    // Reset tracking
    tracking.count = 1;
    tracking.totalUsd = amountUsd;
    tracking.wallets = new Set([wallet]);
    tracking.firstSeen = now;
    return false;
  }
  
  // Add to tracking
  tracking.count++;
  tracking.totalUsd += amountUsd;
  tracking.wallets.add(wallet);
  
  // Accumulation signal: 2+ whales or $50K+ total
  return tracking.wallets.size >= 2 || tracking.totalUsd >= 50000;
}

async function getTokenInfo(address: string): Promise<{ symbol: string; name: string; mcap: number }> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    
    return {
      symbol: pair?.baseToken?.symbol || 'UNKNOWN',
      name: pair?.baseToken?.name || 'Unknown',
      mcap: pair?.fdv || pair?.marketCap || 0
    };
  } catch {
    return { symbol: 'UNKNOWN', name: 'Unknown', mcap: 0 };
  }
}

export async function scanWhaleActivity(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[WHALE] Scanning for whale accumulation...');

  const transactions = await fetchLargeTransactions();
  console.log(`[WHALE] Found ${transactions.length} potential whale transactions`);

  for (const tx of transactions) {
    if (tx.type !== 'BUY') continue;
    
    const isAccumulation = detectAccumulation(tx.token, tx.amountUsd, tx.wallet);
    const isMegaWhale = tx.amountUsd >= MEGA_WHALE_USD;
    
    // Only signal if accumulation pattern or mega whale
    if (!isAccumulation && !isMegaWhale) continue;
    
    const tokenInfo = await getTokenInfo(tx.token);
    
    // Skip if mcap too high (less upside)
    if (tokenInfo.mcap > 5000000) continue;
    
    const confidence = isMegaWhale ? 75 : (isAccumulation ? 65 : 55);
    
    signals.push({
      source: 'smart-wallet-sniper', // Use existing source type
      timestamp: now,
      token: tx.token,
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      action: 'BUY',
      confidence,
      metadata: {
        whaleAmount: tx.amountUsd,
        isMegaWhale,
        isAccumulation,
        tracking: recentWhaleBuys.get(tx.token),
        mcap: tokenInfo.mcap
      }
    });
  }

  console.log(`[WHALE] Found ${signals.length} whale signals`);
  return signals;
}

// Cleanup old tracking data
export function cleanupWhaleTracking(): void {
  const now = Date.now();
  const CLEANUP_AGE = 60 * 60 * 1000; // 1 hour
  
  for (const [token, tracking] of recentWhaleBuys.entries()) {
    if (now - tracking.firstSeen > CLEANUP_AGE) {
      recentWhaleBuys.delete(token);
    }
  }
}
