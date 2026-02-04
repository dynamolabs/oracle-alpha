/**
 * Bundle & Insider Detection Module
 * 
 * Detects coordinated buying patterns that indicate potential rug pulls:
 * - Multiple wallets buying in same block/transaction
 * - Same funding source (bundled wallets)
 * - Coordinated timing patterns
 * - Insider wallet clusters
 * - New wallet red flags
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d079301-97d2-4ae9-81fd-e56f00a891f4';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// ============= TYPES =============

export interface BundleWallet {
  address: string;
  buyAmount: number;        // Amount bought in lamports/tokens
  buyBlock: number;         // Block number of buy
  buyTimestamp: number;     // Timestamp of buy
  percentageOfSupply: number;
  fundingSource?: string;   // SOL funding source wallet
  walletAge?: number;       // Wallet age in days
  isNew?: boolean;          // Created within 7 days
  txSignature?: string;
}

export interface BundleCluster {
  wallets: BundleWallet[];
  fundingSource: string;    // Common funding source
  totalBought: number;      // Total amount bought
  percentageOfSupply: number;
  blockRange: [number, number];
  suspicionLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

export interface InsiderWallet {
  address: string;
  flags: string[];
  suspicionScore: number;   // 0-100
  firstBuyBlock: number;
  percentageHeld: number;
  fundingSource?: string;
  walletAge?: number;
  isLikelyDev: boolean;
  buyWithinBlocks: number;  // How many blocks after token creation
}

export interface BundleAnalysis {
  token: string;
  bundleScore: number;      // 0-100, higher = more suspicious
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  
  // Detection results
  totalBundledWallets: number;
  bundledPercentage: number;  // % of supply held by bundles
  clusters: BundleCluster[];
  insiders: InsiderWallet[];
  
  // Specific flags
  sameBlockBuys: number;      // Buys in same block
  sameFundingSource: number;  // Wallets with same funding
  newWalletBuys: number;      // Buys from wallets < 7 days old
  coordBlockRange: number;    // Block range of coordinated buys
  
  // Summary
  redFlags: string[];
  warnings: string[];
  
  // Metadata
  analyzedAt: number;
  firstBuyers: number;        // Number of first N buyers analyzed
  cached: boolean;
}

// ============= CACHE =============

const bundleCache = new Map<string, { data: BundleAnalysis; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ============= HELIUS API HELPERS =============

/**
 * Get token transfers for a token from Helius
 */
async function getTokenTransfers(mintAddress: string, limit = 100): Promise<any[]> {
  try {
    const response = await fetch(`https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}&type=TRANSFER&limit=${limit}`);
    
    if (!response.ok) {
      console.error('[BUNDLE] Helius API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('[BUNDLE] Failed to get token transfers:', error);
    return [];
  }
}

/**
 * Get parsed transactions using Helius Enhanced API
 */
async function getParsedTransactions(signatures: string[]): Promise<any[]> {
  try {
    const response = await fetch(`https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: signatures })
    });
    
    if (!response.ok) return [];
    return await response.json() || [];
  } catch (error) {
    console.error('[BUNDLE] Failed to parse transactions:', error);
    return [];
  }
}

/**
 * Get wallet's first transaction (to determine age)
 */
async function getWalletAge(address: string): Promise<number> {
  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'wallet-age',
        method: 'getSignaturesForAddress',
        params: [address, { limit: 1 }]
      })
    });
    
    const data = await response.json();
    const firstTx = data.result?.[data.result.length - 1];
    
    if (firstTx?.blockTime) {
      const ageMs = Date.now() - (firstTx.blockTime * 1000);
      return Math.floor(ageMs / (24 * 60 * 60 * 1000)); // Days
    }
    return -1; // Unknown
  } catch (error) {
    return -1;
  }
}

/**
 * Get SOL transfer history to find funding source
 */
async function getFundingSource(address: string): Promise<string | null> {
  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'funding',
        method: 'getSignaturesForAddress',
        params: [address, { limit: 10 }]
      })
    });
    
    const data = await response.json();
    const signatures = data.result?.map((s: any) => s.signature) || [];
    
    if (signatures.length === 0) return null;
    
    // Get parsed transactions
    const txs = await getParsedTransactions(signatures.slice(0, 5));
    
    // Find first SOL transfer TO this wallet
    for (const tx of txs) {
      if (tx.type === 'TRANSFER' && tx.nativeTransfers) {
        for (const transfer of tx.nativeTransfers) {
          if (transfer.toUserAccount === address && transfer.fromUserAccount) {
            return transfer.fromUserAccount;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get first buyers of a token
 */
async function getFirstBuyers(mintAddress: string, count = 50): Promise<BundleWallet[]> {
  try {
    // Use DAS API to get token holders with transaction history
    const response = await fetch(`https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=${count}`);
    
    if (!response.ok) {
      console.error('[BUNDLE] Failed to get swaps:', response.status);
      return [];
    }
    
    const transactions = await response.json();
    const buyerMap = new Map<string, BundleWallet>();
    
    for (const tx of transactions) {
      // Parse swap transactions
      if (tx.type === 'SWAP' && tx.tokenTransfers) {
        for (const transfer of tx.tokenTransfers) {
          // Token coming TO a wallet = buy
          if (transfer.mint === mintAddress && transfer.toUserAccount) {
            const buyer = transfer.toUserAccount;
            
            if (!buyerMap.has(buyer)) {
              buyerMap.set(buyer, {
                address: buyer,
                buyAmount: transfer.tokenAmount || 0,
                buyBlock: tx.slot || 0,
                buyTimestamp: tx.timestamp ? tx.timestamp * 1000 : Date.now(),
                percentageOfSupply: 0, // Will be calculated later
                txSignature: tx.signature
              });
            } else {
              // Add to existing buy amount
              const existing = buyerMap.get(buyer)!;
              existing.buyAmount += transfer.tokenAmount || 0;
            }
          }
        }
      }
    }
    
    // Sort by block number (earliest first)
    const buyers = Array.from(buyerMap.values())
      .sort((a, b) => a.buyBlock - b.buyBlock)
      .slice(0, count);
    
    return buyers;
  } catch (error) {
    console.error('[BUNDLE] Failed to get first buyers:', error);
    return [];
  }
}

/**
 * Get top token holders with percentage
 */
async function getTopHolders(mintAddress: string): Promise<Map<string, number>> {
  const holders = new Map<string, number>();
  
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
    const accounts = data.result?.value || [];
    
    // Get total supply
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
    const totalSupply = parseFloat(supplyData.result?.value?.uiAmount || '1');
    
    for (const account of accounts) {
      const amount = parseFloat(account.uiAmount || '0');
      const percentage = (amount / totalSupply) * 100;
      holders.set(account.address, percentage);
    }
  } catch (error) {
    console.error('[BUNDLE] Failed to get holders:', error);
  }
  
  return holders;
}

// ============= DETECTION LOGIC =============

/**
 * Detect wallets with same funding source (bundled wallets)
 */
function detectBundleClusters(buyers: BundleWallet[]): BundleCluster[] {
  const fundingGroups = new Map<string, BundleWallet[]>();
  
  // Group by funding source
  for (const buyer of buyers) {
    if (buyer.fundingSource) {
      const group = fundingGroups.get(buyer.fundingSource) || [];
      group.push(buyer);
      fundingGroups.set(buyer.fundingSource, group);
    }
  }
  
  const clusters: BundleCluster[] = [];
  
  for (const [fundingSource, wallets] of Array.from(fundingGroups.entries())) {
    if (wallets.length >= 2) {
      const blocks = wallets.map(w => w.buyBlock);
      const totalBought = wallets.reduce((sum, w) => sum + w.buyAmount, 0);
      const totalPercent = wallets.reduce((sum, w) => sum + w.percentageOfSupply, 0);
      const blockRange: [number, number] = [Math.min(...blocks), Math.max(...blocks)];
      
      // Determine suspicion level
      let suspicionLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let reason = '';
      
      if (wallets.length >= 5) {
        suspicionLevel = 'HIGH';
        reason = `${wallets.length} wallets funded by same source`;
      } else if (blockRange[1] - blockRange[0] <= 3) {
        suspicionLevel = 'HIGH';
        reason = `Coordinated buys within ${blockRange[1] - blockRange[0]} blocks`;
      } else if (wallets.length >= 3) {
        suspicionLevel = 'MEDIUM';
        reason = `${wallets.length} wallets from same funding source`;
      } else {
        suspicionLevel = 'LOW';
        reason = 'Potential bundle detected';
      }
      
      clusters.push({
        wallets,
        fundingSource,
        totalBought,
        percentageOfSupply: totalPercent,
        blockRange,
        suspicionLevel,
        reason
      });
    }
  }
  
  // Sort by suspicion level and size
  clusters.sort((a, b) => {
    const levelOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const levelDiff = levelOrder[a.suspicionLevel] - levelOrder[b.suspicionLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.wallets.length - a.wallets.length;
  });
  
  return clusters;
}

/**
 * Detect same-block buying patterns
 */
function detectSameBlockBuys(buyers: BundleWallet[]): { count: number; blocks: Map<number, BundleWallet[]> } {
  const blockGroups = new Map<number, BundleWallet[]>();
  
  for (const buyer of buyers) {
    const group = blockGroups.get(buyer.buyBlock) || [];
    group.push(buyer);
    blockGroups.set(buyer.buyBlock, group);
  }
  
  // Filter to blocks with multiple buyers
  const suspiciousBlocks = new Map<number, BundleWallet[]>();
  let totalSameBlock = 0;
  
  for (const [block, wallets] of Array.from(blockGroups.entries())) {
    if (wallets.length >= 2) {
      suspiciousBlocks.set(block, wallets);
      totalSameBlock += wallets.length;
    }
  }
  
  return { count: totalSameBlock, blocks: suspiciousBlocks };
}

/**
 * Detect insider wallets
 */
function detectInsiders(
  buyers: BundleWallet[],
  clusters: BundleCluster[],
  tokenCreationBlock?: number
): InsiderWallet[] {
  const insiders: InsiderWallet[] = [];
  const clusterWallets = new Set(clusters.flatMap(c => c.wallets.map(w => w.address)));
  
  for (const buyer of buyers) {
    const flags: string[] = [];
    let suspicionScore = 0;
    let isLikelyDev = false;
    
    // Check if in a bundle cluster
    if (clusterWallets.has(buyer.address)) {
      flags.push('BUNDLED');
      suspicionScore += 25;
    }
    
    // Check wallet age
    if (buyer.isNew) {
      flags.push('NEW_WALLET');
      suspicionScore += 20;
    }
    
    // Check if bought in first few blocks
    const blocksAfterCreation = tokenCreationBlock 
      ? buyer.buyBlock - tokenCreationBlock 
      : 0;
    
    if (blocksAfterCreation <= 5) {
      flags.push('EARLY_BUYER');
      suspicionScore += 30;
      if (blocksAfterCreation <= 2) {
        flags.push('FIRST_BLOCK');
        suspicionScore += 20;
        isLikelyDev = true;
      }
    }
    
    // Check percentage held
    if (buyer.percentageOfSupply >= 5) {
      flags.push('LARGE_HOLDER');
      suspicionScore += 15;
      if (buyer.percentageOfSupply >= 10) {
        suspicionScore += 15;
        isLikelyDev = true;
      }
    }
    
    // Only include if suspicious
    if (flags.length >= 2 || suspicionScore >= 40) {
      insiders.push({
        address: buyer.address,
        flags,
        suspicionScore: Math.min(suspicionScore, 100),
        firstBuyBlock: buyer.buyBlock,
        percentageHeld: buyer.percentageOfSupply,
        fundingSource: buyer.fundingSource,
        walletAge: buyer.walletAge,
        isLikelyDev,
        buyWithinBlocks: blocksAfterCreation
      });
    }
  }
  
  // Sort by suspicion score
  insiders.sort((a, b) => b.suspicionScore - a.suspicionScore);
  
  return insiders;
}

/**
 * Calculate overall bundle score
 */
function calculateBundleScore(
  buyers: BundleWallet[],
  clusters: BundleCluster[],
  sameBlockCount: number,
  newWalletCount: number
): number {
  let score = 0;
  
  // Same block buys (max 30 points)
  const sameBlockRatio = sameBlockCount / Math.max(buyers.length, 1);
  score += Math.min(sameBlockRatio * 100, 30);
  
  // Bundle clusters (max 30 points)
  const bundledWallets = clusters.reduce((sum, c) => sum + c.wallets.length, 0);
  const bundleRatio = bundledWallets / Math.max(buyers.length, 1);
  score += Math.min(bundleRatio * 100, 30);
  
  // High suspicion clusters (max 20 points)
  const highSuspicionClusters = clusters.filter(c => c.suspicionLevel === 'HIGH').length;
  score += Math.min(highSuspicionClusters * 10, 20);
  
  // New wallet percentage (max 20 points)
  const newWalletRatio = newWalletCount / Math.max(buyers.length, 1);
  score += Math.min(newWalletRatio * 50, 20);
  
  return Math.min(Math.round(score), 100);
}

// ============= MAIN ANALYSIS FUNCTION =============

/**
 * Analyze a token for bundle/insider activity
 */
export async function analyzeBundles(mintAddress: string): Promise<BundleAnalysis> {
  // Check cache
  const cached = bundleCache.get(mintAddress);
  if (cached && cached.expires > Date.now()) {
    return { ...cached.data, cached: true };
  }
  
  console.log(`[BUNDLE] Analyzing ${mintAddress}...`);
  
  // Get first buyers
  const buyers = await getFirstBuyers(mintAddress, 50);
  
  if (buyers.length === 0) {
    const emptyResult: BundleAnalysis = {
      token: mintAddress,
      bundleScore: 0,
      riskLevel: 'NONE',
      totalBundledWallets: 0,
      bundledPercentage: 0,
      clusters: [],
      insiders: [],
      sameBlockBuys: 0,
      sameFundingSource: 0,
      newWalletBuys: 0,
      coordBlockRange: 0,
      redFlags: [],
      warnings: ['No buyer data available'],
      analyzedAt: Date.now(),
      firstBuyers: 0,
      cached: false
    };
    bundleCache.set(mintAddress, { data: emptyResult, expires: Date.now() + CACHE_TTL });
    return emptyResult;
  }
  
  // Get holder percentages
  const holderPercentages = await getTopHolders(mintAddress);
  
  // Enrich buyer data with wallet info (limit concurrent requests)
  const enrichPromises = buyers.slice(0, 20).map(async (buyer) => {
    // Get funding source
    buyer.fundingSource = await getFundingSource(buyer.address) || undefined;
    
    // Get wallet age
    buyer.walletAge = await getWalletAge(buyer.address);
    buyer.isNew = buyer.walletAge !== -1 && buyer.walletAge < 7;
    
    // Get current holdings percentage
    buyer.percentageOfSupply = holderPercentages.get(buyer.address) || 0;
    
    return buyer;
  });
  
  await Promise.all(enrichPromises);
  
  // Detect patterns
  const clusters = detectBundleClusters(buyers);
  const { count: sameBlockCount, blocks: sameBlockGroups } = detectSameBlockBuys(buyers);
  
  // Find token creation block (first buyer's block as proxy)
  const tokenCreationBlock = buyers.length > 0 ? buyers[0].buyBlock : undefined;
  
  // Detect insiders
  const insiders = detectInsiders(buyers, clusters, tokenCreationBlock);
  
  // Count metrics
  const newWalletCount = buyers.filter(b => b.isNew).length;
  const sameFundingCount = clusters.reduce((sum, c) => sum + c.wallets.length, 0);
  
  // Calculate block range of coordinated buys
  const allBlocks = buyers.map(b => b.buyBlock).filter(b => b > 0);
  const coordBlockRange = allBlocks.length > 0 
    ? Math.max(...allBlocks) - Math.min(...allBlocks)
    : 0;
  
  // Calculate bundle score
  const bundleScore = calculateBundleScore(buyers, clusters, sameBlockCount, newWalletCount);
  
  // Determine risk level
  let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  if (bundleScore >= 80) riskLevel = 'CRITICAL';
  else if (bundleScore >= 60) riskLevel = 'HIGH';
  else if (bundleScore >= 40) riskLevel = 'MEDIUM';
  else if (bundleScore >= 20) riskLevel = 'LOW';
  else riskLevel = 'NONE';
  
  // Generate flags
  const redFlags: string[] = [];
  const warnings: string[] = [];
  
  // Red flags (serious issues)
  if (clusters.some(c => c.suspicionLevel === 'HIGH')) {
    redFlags.push(`High suspicion bundle cluster detected`);
  }
  if (sameBlockCount >= 5) {
    redFlags.push(`${sameBlockCount} wallets bought in same block`);
  }
  if (clusters.length > 0) {
    const largestCluster = clusters[0];
    if (largestCluster.percentageOfSupply >= 30) {
      redFlags.push(`Bundle controls ${largestCluster.percentageOfSupply.toFixed(1)}% of supply`);
    }
  }
  if (insiders.filter(i => i.isLikelyDev).length >= 2) {
    redFlags.push('Multiple likely dev wallets detected');
  }
  
  // Warnings (concerning but not critical)
  if (newWalletCount >= buyers.length * 0.5) {
    warnings.push(`${Math.round(newWalletCount / buyers.length * 100)}% of buyers are new wallets`);
  }
  if (coordBlockRange <= 10 && buyers.length >= 10) {
    warnings.push(`All buys occurred within ${coordBlockRange} blocks`);
  }
  if (sameFundingCount >= 3) {
    warnings.push(`${sameFundingCount} wallets share funding source`);
  }
  
  // Calculate bundled percentage
  const bundledPercentage = clusters.reduce((sum, c) => sum + c.percentageOfSupply, 0);
  
  const analysis: BundleAnalysis = {
    token: mintAddress,
    bundleScore,
    riskLevel,
    totalBundledWallets: sameFundingCount,
    bundledPercentage,
    clusters,
    insiders,
    sameBlockBuys: sameBlockCount,
    sameFundingSource: sameFundingCount,
    newWalletBuys: newWalletCount,
    coordBlockRange,
    redFlags,
    warnings,
    analyzedAt: Date.now(),
    firstBuyers: buyers.length,
    cached: false
  };
  
  // Cache result
  bundleCache.set(mintAddress, { data: analysis, expires: Date.now() + CACHE_TTL });
  
  console.log(`[BUNDLE] ${mintAddress}: Score=${bundleScore}, Risk=${riskLevel}, Bundles=${clusters.length}`);
  
  return analysis;
}

/**
 * Quick check for bundle score (cached only)
 */
export function getQuickBundleScore(mintAddress: string): number | null {
  const cached = bundleCache.get(mintAddress);
  return cached ? cached.data.bundleScore : null;
}

/**
 * Get cached bundle analysis (no API calls)
 */
export function getCachedBundleAnalysis(mintAddress: string): BundleAnalysis | null {
  const cached = bundleCache.get(mintAddress);
  return cached ? { ...cached.data, cached: true } : null;
}

/**
 * Clear bundle cache
 */
export function clearBundleCache(): void {
  bundleCache.clear();
}

/**
 * Format bundle analysis for display
 */
export function formatBundleAnalysis(analysis: BundleAnalysis): string {
  const riskEmoji = {
    CRITICAL: '🚨',
    HIGH: '⚠️',
    MEDIUM: '🟡',
    LOW: '🟢',
    NONE: '✅'
  }[analysis.riskLevel];
  
  let text = `${riskEmoji} BUNDLE DETECTION: ${analysis.riskLevel}\n`;
  text += '━'.repeat(35) + '\n\n';
  
  text += `📊 Bundle Score: ${analysis.bundleScore}/100\n`;
  text += `👛 Bundled Wallets: ${analysis.totalBundledWallets}\n`;
  text += `📈 Bundled Supply: ${analysis.bundledPercentage.toFixed(1)}%\n\n`;
  
  if (analysis.sameBlockBuys > 0) {
    text += `⚡ Same Block Buys: ${analysis.sameBlockBuys}\n`;
  }
  if (analysis.newWalletBuys > 0) {
    text += `🆕 New Wallet Buys: ${analysis.newWalletBuys}\n`;
  }
  if (analysis.coordBlockRange > 0) {
    text += `🔗 Coordination Range: ${analysis.coordBlockRange} blocks\n`;
  }
  
  if (analysis.redFlags.length > 0) {
    text += '\n🚩 Red Flags:\n';
    for (const flag of analysis.redFlags) {
      text += `• ${flag}\n`;
    }
  }
  
  if (analysis.warnings.length > 0) {
    text += '\n⚠️ Warnings:\n';
    for (const warning of analysis.warnings) {
      text += `• ${warning}\n`;
    }
  }
  
  if (analysis.clusters.length > 0) {
    text += `\n📦 Bundle Clusters: ${analysis.clusters.length}\n`;
    for (const cluster of analysis.clusters.slice(0, 3)) {
      text += `• ${cluster.wallets.length} wallets, ${cluster.percentageOfSupply.toFixed(1)}% supply (${cluster.suspicionLevel})\n`;
    }
  }
  
  if (analysis.insiders.length > 0) {
    text += `\n👤 Suspected Insiders: ${analysis.insiders.length}\n`;
    for (const insider of analysis.insiders.slice(0, 3)) {
      text += `• ${insider.address.slice(0, 8)}... - ${insider.flags.join(', ')}\n`;
    }
  }
  
  return text;
}

/**
 * Get bundle warning for signal display
 */
export function getBundleWarning(analysis: BundleAnalysis): string | null {
  if (analysis.riskLevel === 'NONE' || analysis.riskLevel === 'LOW') {
    return null;
  }
  
  const riskEmoji = analysis.riskLevel === 'CRITICAL' ? '🚨' : '⚠️';
  
  let warning = `${riskEmoji} BUNDLE DETECTED\n`;
  
  if (analysis.sameBlockBuys >= 3) {
    warning += `• ${analysis.sameBlockBuys} wallets bought in same block\n`;
  }
  
  if (analysis.clusters.length > 0) {
    const mainCluster = analysis.clusters[0];
    warning += `• Funding source: ${mainCluster.fundingSource.slice(0, 8)}...\n`;
    warning += `• Total bought: ${analysis.bundledPercentage.toFixed(1)}% of supply\n`;
  }
  
  warning += `• Bundle Score: ${analysis.bundleScore} (${analysis.riskLevel})`;
  
  return warning;
}
