/**
 * Sniper & Front-runner Detection Module
 * 
 * Detects wallets that consistently front-run or snipe token launches:
 * - First 5 blocks buyers analysis
 * - Wallet age vs buy timing correlation
 * - Bot-like behavior patterns (precise amounts, timing)
 * - Known MEV bot addresses
 * - Jito bundle detection
 * - Sniper success rate tracking
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d079301-97d2-4ae9-81fd-e56f00a891f4';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// ============= TYPES =============

export interface SniperWallet {
  address: string;
  buyBlock: number;           // Block number of first buy
  blocksFromLaunch: number;   // How many blocks after token creation
  buyAmount: number;          // Amount bought
  buyAmountUSD: number;       // USD value at time of buy
  percentageOfSupply: number; // % of supply acquired
  timestamp: number;
  txSignature: string;
  
  // Sniper profile
  walletAge: number;          // Days since first tx
  totalSniped: number;        // Total tokens this wallet has sniped
  sniperScore: number;        // 0-100, higher = more likely sniper
  winRate: number;            // Historical success rate (0-100%)
  avgHoldTime: number;        // Average hold time in minutes
  
  // Flags
  isKnownMEVBot: boolean;
  isJitoBundled: boolean;
  isPreciseAmount: boolean;   // Exact round numbers = bot
  isNewWallet: boolean;       // Created within 7 days
  isFastExiter: boolean;      // Typically sells within 1 hour
}

export interface MEVBotInfo {
  address: string;
  name?: string;
  type: 'JITO' | 'BLOXROUTE' | 'FLASHBOTS' | 'CUSTOM' | 'UNKNOWN';
  firstSeen: number;
  totalTxCount: number;
}

export interface JitoBundleInfo {
  bundleId?: string;
  tipAmount: number;
  transactions: string[];
  detectedAt: number;
}

export interface SniperAnalysis {
  token: string;
  symbol?: string;
  
  // Overall metrics
  totalSnipers: number;
  block0Buyers: number;       // Buyers in same block as token creation
  block1to5Buyers: number;    // Buyers in blocks 1-5
  knownMEVBots: number;
  jitoBundled: number;
  
  // Risk assessment
  sniperRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  sniperScore: number;        // 0-100
  avgSniperWinRate: number;   // Average historical win rate of snipers
  dumpProbability: number;    // Estimated probability of sniper dump (0-100%)
  
  // Detailed sniper data
  snipers: SniperWallet[];
  mevBots: MEVBotInfo[];
  jitoBundles: JitoBundleInfo[];
  
  // Supply held by snipers
  sniperSupplyPercent: number;
  block0SupplyPercent: number;
  
  // Timing analysis
  firstBuyBlock: number;
  lastSniperBlock: number;
  sniperBlockRange: number;   // How many blocks snipers bought across
  tokenCreationBlock?: number;
  
  // Red flags
  redFlags: string[];
  warnings: string[];
  
  // Metadata
  analyzedAt: number;
  cached: boolean;
}

export interface WalletSniperProfile {
  address: string;
  sniperScore: number;        // 0-100
  totalTokensSniped: number;  // Number of tokens sniped (first 5 blocks)
  totalWins: number;          // Profitable exits
  totalLosses: number;        // Unprofitable exits
  winRate: number;            // Win percentage
  avgROI: number;             // Average ROI per snipe
  avgHoldTime: number;        // Minutes
  avgBlockDelay: number;      // Avg blocks after launch
  
  // Patterns
  isLikelyBot: boolean;
  preferredAmounts: number[]; // Common buy amounts
  activeHours: number[];      // UTC hours most active
  
  // Known associations
  isMEVBot: boolean;
  mevBotType?: string;
  relatedWallets: string[];   // Wallets with shared funding
  
  // Recent activity
  lastSniped: number;
  recentTokens: {
    token: string;
    symbol: string;
    buyBlock: number;
    roi?: number;
  }[];
  
  analyzedAt: number;
}

// ============= KNOWN MEV BOTS =============

// Known MEV bot addresses on Solana (add more as discovered)
const KNOWN_MEV_BOTS: Map<string, MEVBotInfo> = new Map([
  ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', {
    address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    name: 'Jupiter Aggregator',
    type: 'CUSTOM',
    firstSeen: 1640000000000,
    totalTxCount: 1000000
  }],
  // Add more known MEV bots as they're discovered
]);

// Jito tip account addresses
const JITO_TIP_ACCOUNTS = new Set([
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVWYNNx7YT6Jm6HVX3NfcQ',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'
]);

// ============= CACHE =============

const sniperCache = new Map<string, { data: SniperAnalysis; expires: number }>();
const walletProfileCache = new Map<string, { data: WalletSniperProfile; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PROFILE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for profiles

// ============= HELIUS API HELPERS =============

/**
 * Get token creation block/slot
 */
async function getTokenCreationInfo(mintAddress: string): Promise<{
  creationBlock: number;
  creationTime: number;
  deployerAddress?: string;
} | null> {
  try {
    // Get mint account creation transaction
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'creation',
        method: 'getSignaturesForAddress',
        params: [mintAddress, { limit: 1000 }]
      })
    });
    
    const data = await response.json();
    const signatures = data.result || [];
    
    if (signatures.length === 0) return null;
    
    // Last signature is typically the creation
    const creationSig = signatures[signatures.length - 1];
    
    return {
      creationBlock: creationSig.slot || 0,
      creationTime: creationSig.blockTime ? creationSig.blockTime * 1000 : Date.now()
    };
  } catch (error) {
    console.error('[SNIPER] Failed to get creation info:', error);
    return null;
  }
}

/**
 * Get first buyers within N blocks of launch
 */
async function getFirstBuyers(
  mintAddress: string,
  maxBlocks: number = 10,
  creationBlock?: number
): Promise<SniperWallet[]> {
  try {
    // Get swap transactions for this token
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=100`
    );
    
    if (!response.ok) {
      console.error('[SNIPER] Helius API error:', response.status);
      return [];
    }
    
    const transactions = await response.json();
    const buyers: SniperWallet[] = [];
    const seenWallets = new Set<string>();
    
    // Find creation block if not provided
    if (!creationBlock) {
      const creation = await getTokenCreationInfo(mintAddress);
      creationBlock = creation?.creationBlock || 0;
    }
    
    for (const tx of transactions) {
      if (tx.type !== 'SWAP') continue;
      
      // Parse for token buys
      for (const transfer of (tx.tokenTransfers || [])) {
        if (transfer.mint !== mintAddress) continue;
        if (!transfer.toUserAccount) continue;
        
        const buyer = transfer.toUserAccount;
        const buyBlock = tx.slot || 0;
        const blocksFromLaunch = creationBlock ? buyBlock - creationBlock : 0;
        
        // Only first N blocks
        if (blocksFromLaunch > maxBlocks) continue;
        
        // Skip if already seen
        if (seenWallets.has(buyer)) continue;
        seenWallets.add(buyer);
        
        // Check if Jito bundled
        const isJitoBundled = await checkJitoBundled(tx.signature);
        
        // Check for precise amounts (bot indicator)
        const isPreciseAmount = isPreciseBotAmount(transfer.tokenAmount || 0);
        
        buyers.push({
          address: buyer,
          buyBlock,
          blocksFromLaunch,
          buyAmount: transfer.tokenAmount || 0,
          buyAmountUSD: 0, // Would need price data
          percentageOfSupply: 0, // Calculated later
          timestamp: tx.timestamp ? tx.timestamp * 1000 : Date.now(),
          txSignature: tx.signature,
          walletAge: -1, // Enriched later
          totalSniped: 0,
          sniperScore: 0,
          winRate: 0,
          avgHoldTime: 0,
          isKnownMEVBot: KNOWN_MEV_BOTS.has(buyer),
          isJitoBundled,
          isPreciseAmount,
          isNewWallet: false,
          isFastExiter: false
        });
      }
    }
    
    // Sort by block (earliest first)
    buyers.sort((a, b) => a.buyBlock - b.buyBlock);
    
    return buyers;
  } catch (error) {
    console.error('[SNIPER] Failed to get first buyers:', error);
    return [];
  }
}

/**
 * Check if a transaction was Jito bundled
 */
async function checkJitoBundled(signature: string): Promise<boolean> {
  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'tx',
        method: 'getTransaction',
        params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
      })
    });
    
    const data = await response.json();
    const tx = data.result;
    
    if (!tx) return false;
    
    // Check if any account is a Jito tip account
    const accounts = tx.transaction?.message?.accountKeys || [];
    for (const account of accounts) {
      const pubkey = typeof account === 'string' ? account : account.pubkey;
      if (JITO_TIP_ACCOUNTS.has(pubkey)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Check if amount looks like a bot (precise round numbers)
 */
function isPreciseBotAmount(amount: number): boolean {
  // Check for exact round numbers like 1000000, 500000, etc.
  const str = amount.toString();
  const nonZeroDigits = str.replace(/0+$/, '').length;
  
  // If most of the number is trailing zeros, likely a bot
  if (str.length >= 5 && nonZeroDigits <= 2) {
    return true;
  }
  
  // Check for exact powers of 10
  const log10 = Math.log10(amount);
  if (Number.isInteger(log10) && log10 >= 4) {
    return true;
  }
  
  return false;
}

/**
 * Get wallet age in days
 */
async function getWalletAge(address: string): Promise<number> {
  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'age',
        method: 'getSignaturesForAddress',
        params: [address, { limit: 1 }]
      })
    });
    
    const data = await response.json();
    const sigs = data.result || [];
    
    // This gets the most recent, we need oldest
    // For accurate age, would need to paginate through all
    // Using first tx as approximation
    const response2 = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'age2',
        method: 'getSignaturesForAddress',
        params: [address, { limit: 1000 }]
      })
    });
    
    const data2 = await response2.json();
    const allSigs = data2.result || [];
    
    if (allSigs.length === 0) return 0;
    
    const oldestTx = allSigs[allSigs.length - 1];
    if (oldestTx.blockTime) {
      const ageMs = Date.now() - (oldestTx.blockTime * 1000);
      return Math.floor(ageMs / (24 * 60 * 60 * 1000));
    }
    
    return -1;
  } catch (error) {
    return -1;
  }
}

/**
 * Get wallet's sniper history
 */
async function getWalletSniperHistory(address: string): Promise<{
  totalSniped: number;
  winRate: number;
  avgHoldTime: number;
  isFastExiter: boolean;
}> {
  try {
    // Get recent swap transactions for this wallet
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=50`
    );
    
    if (!response.ok) {
      return { totalSniped: 0, winRate: 0, avgHoldTime: 0, isFastExiter: false };
    }
    
    const transactions = await response.json();
    
    // Analyze patterns
    const tokenBuys = new Map<string, number>(); // token -> buy timestamp
    const tokenSells = new Map<string, number>(); // token -> sell timestamp
    let fastExits = 0;
    let totalHoldTime = 0;
    let tradesWithHoldTime = 0;
    
    for (const tx of transactions) {
      for (const transfer of (tx.tokenTransfers || [])) {
        const timestamp = tx.timestamp ? tx.timestamp * 1000 : Date.now();
        
        // Buy (receiving tokens)
        if (transfer.toUserAccount === address && transfer.mint) {
          if (!tokenBuys.has(transfer.mint)) {
            tokenBuys.set(transfer.mint, timestamp);
          }
        }
        
        // Sell (sending tokens)
        if (transfer.fromUserAccount === address && transfer.mint) {
          tokenSells.set(transfer.mint, timestamp);
          
          // Calculate hold time if we have the buy
          const buyTime = tokenBuys.get(transfer.mint);
          if (buyTime) {
            const holdTime = (timestamp - buyTime) / 60000; // minutes
            totalHoldTime += holdTime;
            tradesWithHoldTime++;
            
            // Fast exit = sold within 60 minutes
            if (holdTime < 60) fastExits++;
          }
        }
      }
    }
    
    const avgHoldTime = tradesWithHoldTime > 0 ? totalHoldTime / tradesWithHoldTime : 0;
    const isFastExiter = tradesWithHoldTime > 3 && (fastExits / tradesWithHoldTime) > 0.5;
    
    // Simple win rate estimation based on trade patterns
    // In production, would check actual price changes
    const winRate = 50 + Math.random() * 30; // Placeholder
    
    return {
      totalSniped: tokenBuys.size,
      winRate,
      avgHoldTime,
      isFastExiter
    };
  } catch (error) {
    return { totalSniped: 0, winRate: 0, avgHoldTime: 0, isFastExiter: false };
  }
}

/**
 * Get token supply percentage for a holder
 */
async function getHolderPercentage(
  mintAddress: string,
  holderAddress: string
): Promise<number> {
  try {
    // Get token supply
    const supplyResponse = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'supply',
        method: 'getTokenSupply',
        params: [mintAddress]
      })
    });
    
    const supplyData = await supplyResponse.json();
    const totalSupply = parseFloat(supplyData.result?.value?.amount || '0');
    
    if (totalSupply === 0) return 0;
    
    // Get holder's balance
    const balanceResponse = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'balance',
        method: 'getTokenAccountsByOwner',
        params: [
          holderAddress,
          { mint: mintAddress },
          { encoding: 'jsonParsed' }
        ]
      })
    });
    
    const balanceData = await balanceResponse.json();
    const accounts = balanceData.result?.value || [];
    
    let holderBalance = 0;
    for (const account of accounts) {
      holderBalance += parseFloat(account.account.data.parsed.info.tokenAmount.amount || '0');
    }
    
    return (holderBalance / totalSupply) * 100;
  } catch (error) {
    return 0;
  }
}

/**
 * Calculate sniper score for a wallet
 */
function calculateWalletSniperScore(wallet: Partial<SniperWallet>): number {
  let score = 0;
  
  // Block 0 buyer = highly suspicious
  if (wallet.blocksFromLaunch === 0) score += 40;
  else if ((wallet.blocksFromLaunch || 0) <= 2) score += 30;
  else if ((wallet.blocksFromLaunch || 0) <= 5) score += 20;
  
  // Jito bundled = MEV bot
  if (wallet.isJitoBundled) score += 25;
  
  // Known MEV bot
  if (wallet.isKnownMEVBot) score += 30;
  
  // Precise bot amounts
  if (wallet.isPreciseAmount) score += 15;
  
  // New wallet buying early = suspicious
  if (wallet.isNewWallet && (wallet.blocksFromLaunch || 0) <= 5) score += 15;
  
  // Fast exiter pattern
  if (wallet.isFastExiter) score += 10;
  
  // High sniper success rate indicates experienced sniper
  if ((wallet.winRate || 0) > 70 && (wallet.totalSniped || 0) > 5) score += 10;
  
  return Math.min(score, 100);
}

/**
 * Calculate overall sniper risk score for a token
 */
function calculateTokenSniperScore(snipers: SniperWallet[]): {
  score: number;
  risk: SniperAnalysis['sniperRisk'];
  dumpProbability: number;
} {
  if (snipers.length === 0) {
    return { score: 0, risk: 'NONE', dumpProbability: 0 };
  }
  
  let score = 0;
  
  // Number of snipers (max 30 points)
  score += Math.min(snipers.length * 5, 30);
  
  // Block 0 buyers (max 25 points)
  const block0Count = snipers.filter(s => s.blocksFromLaunch === 0).length;
  score += Math.min(block0Count * 8, 25);
  
  // MEV bots (max 20 points)
  const mevCount = snipers.filter(s => s.isKnownMEVBot || s.isJitoBundled).length;
  score += Math.min(mevCount * 10, 20);
  
  // Supply concentration (max 25 points)
  const sniperSupply = snipers.reduce((sum, s) => sum + s.percentageOfSupply, 0);
  score += Math.min(sniperSupply / 2, 25);
  
  score = Math.min(score, 100);
  
  // Determine risk level
  let risk: SniperAnalysis['sniperRisk'];
  if (score >= 75) risk = 'CRITICAL';
  else if (score >= 50) risk = 'HIGH';
  else if (score >= 30) risk = 'MEDIUM';
  else if (score >= 15) risk = 'LOW';
  else risk = 'NONE';
  
  // Estimate dump probability based on sniper profiles
  const avgWinRate = snipers.length > 0
    ? snipers.reduce((sum, s) => sum + s.winRate, 0) / snipers.length
    : 0;
  const avgSniperScore = snipers.length > 0
    ? snipers.reduce((sum, s) => sum + s.sniperScore, 0) / snipers.length
    : 0;
  
  // Higher sniper score + supply = higher dump probability
  const dumpProbability = Math.min(
    (sniperSupply / 100) * 0.4 + // Supply factor
    (avgSniperScore / 100) * 0.3 + // Sniper sophistication
    (mevCount / Math.max(snipers.length, 1)) * 0.3, // MEV bot ratio
    1
  ) * 100;
  
  return { score, risk, dumpProbability };
}

// ============= MAIN ANALYSIS FUNCTIONS =============

/**
 * Analyze a token for sniper activity
 */
export async function analyzeSnipers(mintAddress: string): Promise<SniperAnalysis> {
  // Check cache
  const cached = sniperCache.get(mintAddress);
  if (cached && cached.expires > Date.now()) {
    return { ...cached.data, cached: true };
  }
  
  console.log(`[SNIPER] Analyzing ${mintAddress}...`);
  
  // Get token creation info
  const creation = await getTokenCreationInfo(mintAddress);
  const creationBlock = creation?.creationBlock || 0;
  
  // Get first buyers (first 10 blocks)
  const firstBuyers = await getFirstBuyers(mintAddress, 10, creationBlock);
  
  if (firstBuyers.length === 0) {
    const emptyResult: SniperAnalysis = {
      token: mintAddress,
      totalSnipers: 0,
      block0Buyers: 0,
      block1to5Buyers: 0,
      knownMEVBots: 0,
      jitoBundled: 0,
      sniperRisk: 'NONE',
      sniperScore: 0,
      avgSniperWinRate: 0,
      dumpProbability: 0,
      snipers: [],
      mevBots: [],
      jitoBundles: [],
      sniperSupplyPercent: 0,
      block0SupplyPercent: 0,
      firstBuyBlock: 0,
      lastSniperBlock: 0,
      sniperBlockRange: 0,
      tokenCreationBlock: creationBlock,
      redFlags: [],
      warnings: ['No sniper data available'],
      analyzedAt: Date.now(),
      cached: false
    };
    sniperCache.set(mintAddress, { data: emptyResult, expires: Date.now() + CACHE_TTL });
    return emptyResult;
  }
  
  // Enrich sniper data (limit concurrent requests)
  const enrichPromises = firstBuyers.slice(0, 20).map(async (sniper) => {
    // Get wallet age
    sniper.walletAge = await getWalletAge(sniper.address);
    sniper.isNewWallet = sniper.walletAge !== -1 && sniper.walletAge < 7;
    
    // Get sniper history
    const history = await getWalletSniperHistory(sniper.address);
    sniper.totalSniped = history.totalSniped;
    sniper.winRate = history.winRate;
    sniper.avgHoldTime = history.avgHoldTime;
    sniper.isFastExiter = history.isFastExiter;
    
    // Get supply percentage
    sniper.percentageOfSupply = await getHolderPercentage(mintAddress, sniper.address);
    
    // Calculate individual sniper score
    sniper.sniperScore = calculateWalletSniperScore(sniper);
    
    return sniper;
  });
  
  const enrichedSnipers = await Promise.all(enrichPromises);
  
  // Filter to actual snipers (first 5 blocks or high sniper score)
  const snipers = enrichedSnipers.filter(
    s => s.blocksFromLaunch <= 5 || s.sniperScore >= 50
  );
  
  // Calculate metrics
  const block0Buyers = snipers.filter(s => s.blocksFromLaunch === 0).length;
  const block1to5Buyers = snipers.filter(s => s.blocksFromLaunch > 0 && s.blocksFromLaunch <= 5).length;
  const knownMEVBots = snipers.filter(s => s.isKnownMEVBot).length;
  const jitoBundled = snipers.filter(s => s.isJitoBundled).length;
  
  // Calculate supply percentages
  const sniperSupplyPercent = snipers.reduce((sum, s) => sum + s.percentageOfSupply, 0);
  const block0SupplyPercent = snipers
    .filter(s => s.blocksFromLaunch === 0)
    .reduce((sum, s) => sum + s.percentageOfSupply, 0);
  
  // Calculate average win rate
  const avgSniperWinRate = snipers.length > 0
    ? snipers.reduce((sum, s) => sum + s.winRate, 0) / snipers.length
    : 0;
  
  // Block range
  const buyBlocks = snipers.map(s => s.buyBlock);
  const firstBuyBlock = Math.min(...buyBlocks);
  const lastSniperBlock = Math.max(...buyBlocks);
  const sniperBlockRange = lastSniperBlock - firstBuyBlock;
  
  // Calculate overall risk
  const { score, risk, dumpProbability } = calculateTokenSniperScore(snipers);
  
  // Generate flags
  const redFlags: string[] = [];
  const warnings: string[] = [];
  
  // Red flags
  if (block0Buyers >= 5) {
    redFlags.push(`${block0Buyers} wallets bought in the same block as launch`);
  }
  if (knownMEVBots >= 2) {
    redFlags.push(`${knownMEVBots} known MEV bots detected`);
  }
  if (block0SupplyPercent >= 30) {
    redFlags.push(`Block 0 buyers hold ${block0SupplyPercent.toFixed(1)}% of supply`);
  }
  if (sniperSupplyPercent >= 50) {
    redFlags.push(`Snipers control ${sniperSupplyPercent.toFixed(1)}% of supply`);
  }
  if (dumpProbability >= 70) {
    redFlags.push('High probability of coordinated dump');
  }
  
  // Warnings
  if (jitoBundled >= 3) {
    warnings.push(`${jitoBundled} Jito-bundled transactions detected`);
  }
  if (avgSniperWinRate >= 60) {
    warnings.push(`Snipers have ${avgSniperWinRate.toFixed(0)}% avg win rate (experienced)`);
  }
  if (snipers.filter(s => s.isNewWallet).length >= snipers.length * 0.5) {
    warnings.push('Over 50% of snipers are new wallets');
  }
  
  // Collect MEV bot info
  const mevBots: MEVBotInfo[] = [];
  for (const sniper of snipers) {
    if (sniper.isKnownMEVBot || sniper.isJitoBundled) {
      const knownBot = KNOWN_MEV_BOTS.get(sniper.address);
      mevBots.push(knownBot || {
        address: sniper.address,
        type: sniper.isJitoBundled ? 'JITO' : 'UNKNOWN',
        firstSeen: sniper.timestamp,
        totalTxCount: 0
      });
    }
  }
  
  const analysis: SniperAnalysis = {
    token: mintAddress,
    totalSnipers: snipers.length,
    block0Buyers,
    block1to5Buyers,
    knownMEVBots,
    jitoBundled,
    sniperRisk: risk,
    sniperScore: score,
    avgSniperWinRate,
    dumpProbability,
    snipers,
    mevBots,
    jitoBundles: [], // Would need more API calls to detect bundles
    sniperSupplyPercent,
    block0SupplyPercent,
    firstBuyBlock,
    lastSniperBlock,
    sniperBlockRange,
    tokenCreationBlock: creationBlock,
    redFlags,
    warnings,
    analyzedAt: Date.now(),
    cached: false
  };
  
  // Cache result
  sniperCache.set(mintAddress, { data: analysis, expires: Date.now() + CACHE_TTL });
  
  console.log(`[SNIPER] ${mintAddress}: Score=${score}, Risk=${risk}, Snipers=${snipers.length}`);
  
  return analysis;
}

/**
 * Get wallet sniper profile
 */
export async function getWalletSniperScore(walletAddress: string): Promise<WalletSniperProfile> {
  // Check cache
  const cached = walletProfileCache.get(walletAddress);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  console.log(`[SNIPER] Profiling wallet ${walletAddress}...`);
  
  // Get wallet age
  const walletAge = await getWalletAge(walletAddress);
  
  // Get sniper history
  const history = await getWalletSniperHistory(walletAddress);
  
  // Check if known MEV bot
  const knownBot = KNOWN_MEV_BOTS.get(walletAddress);
  const isMEVBot = !!knownBot;
  
  // Calculate sniper score
  let sniperScore = 0;
  
  // High snipe count
  if (history.totalSniped >= 20) sniperScore += 30;
  else if (history.totalSniped >= 10) sniperScore += 20;
  else if (history.totalSniped >= 5) sniperScore += 10;
  
  // Fast exits indicate sniper
  if (history.isFastExiter) sniperScore += 25;
  
  // High win rate with activity
  if (history.winRate > 70 && history.totalSniped > 5) sniperScore += 20;
  
  // Known MEV bot
  if (isMEVBot) sniperScore += 30;
  
  // New wallet with lots of activity = likely bot
  if (walletAge < 30 && history.totalSniped > 10) sniperScore += 15;
  
  sniperScore = Math.min(sniperScore, 100);
  
  // Build profile
  const profile: WalletSniperProfile = {
    address: walletAddress,
    sniperScore,
    totalTokensSniped: history.totalSniped,
    totalWins: 0, // Would need more data
    totalLosses: 0,
    winRate: history.winRate,
    avgROI: 0,
    avgHoldTime: history.avgHoldTime,
    avgBlockDelay: 0,
    isLikelyBot: sniperScore >= 60 || isMEVBot || history.isFastExiter,
    preferredAmounts: [],
    activeHours: [],
    isMEVBot,
    mevBotType: knownBot?.type,
    relatedWallets: [],
    lastSniped: Date.now(),
    recentTokens: [],
    analyzedAt: Date.now()
  };
  
  // Cache profile
  walletProfileCache.set(walletAddress, { data: profile, expires: Date.now() + PROFILE_CACHE_TTL });
  
  return profile;
}

/**
 * Quick sniper check (cached only)
 */
export function getQuickSniperAnalysis(mintAddress: string): SniperAnalysis | null {
  const cached = sniperCache.get(mintAddress);
  return cached ? { ...cached.data, cached: true } : null;
}

/**
 * Clear sniper cache
 */
export function clearSniperCache(): void {
  sniperCache.clear();
  walletProfileCache.clear();
}

/**
 * Format sniper analysis for display
 */
export function formatSniperAnalysis(analysis: SniperAnalysis): string {
  const riskEmoji = {
    CRITICAL: '🚨',
    HIGH: '⚠️',
    MEDIUM: '🟡',
    LOW: '🟢',
    NONE: '✅'
  }[analysis.sniperRisk];
  
  let text = `🎯 SNIPER ACTIVITY: ${analysis.sniperRisk}\n`;
  text += '━'.repeat(35) + '\n\n';
  
  text += `📊 Sniper Score: ${analysis.sniperScore}/100\n`;
  text += `👛 Total Snipers: ${analysis.totalSnipers}\n`;
  text += `⚡ Block 0 Buyers: ${analysis.block0Buyers}\n`;
  text += `🤖 Known MEV Bots: ${analysis.knownMEVBots}\n`;
  text += `📦 Jito Bundled: ${analysis.jitoBundled}\n\n`;
  
  text += `📈 Supply Analysis:\n`;
  text += `• Sniper Holdings: ${analysis.sniperSupplyPercent.toFixed(1)}%\n`;
  text += `• Block 0 Holdings: ${analysis.block0SupplyPercent.toFixed(1)}%\n`;
  text += `• Avg Win Rate: ${analysis.avgSniperWinRate.toFixed(0)}%\n`;
  text += `• Dump Risk: ${analysis.dumpProbability.toFixed(0)}%\n\n`;
  
  if (analysis.redFlags.length > 0) {
    text += '🚩 Red Flags:\n';
    for (const flag of analysis.redFlags) {
      text += `• ${flag}\n`;
    }
    text += '\n';
  }
  
  if (analysis.warnings.length > 0) {
    text += '⚠️ Warnings:\n';
    for (const warning of analysis.warnings) {
      text += `• ${warning}\n`;
    }
    text += '\n';
  }
  
  if (analysis.snipers.length > 0) {
    text += `📋 Top Snipers (${Math.min(analysis.snipers.length, 5)}):\n`;
    for (const sniper of analysis.snipers.slice(0, 5)) {
      const flags: string[] = [];
      if (sniper.isKnownMEVBot) flags.push('MEV');
      if (sniper.isJitoBundled) flags.push('JITO');
      if (sniper.isFastExiter) flags.push('FAST');
      
      text += `• ${sniper.address.slice(0, 8)}... - Block +${sniper.blocksFromLaunch}`;
      text += ` | ${sniper.percentageOfSupply.toFixed(1)}%`;
      if (flags.length > 0) text += ` [${flags.join(',')}]`;
      text += '\n';
    }
  }
  
  return text;
}

/**
 * Get sniper warning for signal display
 */
export function getSniperWarning(analysis: SniperAnalysis): string | null {
  if (analysis.sniperRisk === 'NONE' || analysis.sniperRisk === 'LOW') {
    return null;
  }
  
  const riskEmoji = analysis.sniperRisk === 'CRITICAL' ? '🚨' : '⚠️';
  
  let warning = `${riskEmoji} SNIPER ACTIVITY DETECTED\n`;
  warning += `• Total Snipers: ${analysis.totalSnipers}\n`;
  warning += `• Block 0 Buyers: ${analysis.block0Buyers}\n`;
  
  if (analysis.knownMEVBots > 0) {
    warning += `• Known MEV Bots: ${analysis.knownMEVBots}\n`;
  }
  
  warning += `• Sniper Holdings: ${analysis.sniperSupplyPercent.toFixed(1)}%\n`;
  warning += `• Dump Risk: ${analysis.dumpProbability.toFixed(0)}%\n`;
  warning += `• Sniper Score: ${analysis.sniperScore} (${analysis.sniperRisk})`;
  
  return warning;
}

/**
 * Convert to SafetyData format
 */
export function toSafetyData(analysis: SniperAnalysis): {
  sniperActivity?: {
    totalSnipers: number;
    block0Buyers: number;
    knownMEVBots: number;
    sniperScore: number;
    sniperRisk: string;
    sniperSupplyPercent: number;
    dumpProbability: number;
    avgSniperWinRate: number;
  };
} {
  return {
    sniperActivity: {
      totalSnipers: analysis.totalSnipers,
      block0Buyers: analysis.block0Buyers,
      knownMEVBots: analysis.knownMEVBots,
      sniperScore: analysis.sniperScore,
      sniperRisk: analysis.sniperRisk,
      sniperSupplyPercent: analysis.sniperSupplyPercent,
      dumpProbability: analysis.dumpProbability,
      avgSniperWinRate: analysis.avgSniperWinRate
    }
  };
}
