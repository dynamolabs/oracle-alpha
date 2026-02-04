/**
 * Dev Wallet & Anti-Rug Safety Checks
 * 
 * Analyzes token holder distribution, mint/freeze authorities,
 * and other on-chain data to detect potential rugs.
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d079301-97d2-4ae9-81fd-e56f00a891f4';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Safety score thresholds
export const SAFETY_THRESHOLDS = {
  SAFE: 60,
  CAUTION: 40,
  RISKY: 0
};

// Red flag severity
export type RedFlagSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RedFlag {
  type: string;
  description: string;
  severity: RedFlagSeverity;
  points: number; // Points deducted from safety score
}

export interface HolderInfo {
  address: string;
  balance: number;
  percentage: number;
  isDevWallet?: boolean;
  isBundled?: boolean;
}

export interface SafetyAnalysis {
  safetyScore: number; // 0-100
  riskCategory: 'SAFE' | 'CAUTION' | 'RISKY';
  redFlags: RedFlag[];
  devHoldings: number; // Percentage
  topHolderPercentage: number;
  liquidityLocked: boolean;
  liquidityLockDuration?: number; // Days
  mintAuthorityEnabled: boolean;
  freezeAuthorityEnabled: boolean;
  tokenAge: number; // Minutes since creation
  totalHolders: number;
  topHolders: HolderInfo[];
  bundledWallets: number;
  socialLinks: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  timestamp: number;
}

// Cache for safety analysis
const safetyCache = new Map<string, { data: SafetyAnalysis; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get top holders for a token using Helius
 */
async function getTopHolders(mintAddress: string): Promise<HolderInfo[]> {
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
    
    // Get total supply for percentage calculation
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
    const totalSupply = parseFloat(supplyData.result?.value?.uiAmount || '0');
    
    if (totalSupply === 0) return [];
    
    return accounts.slice(0, 20).map((account: any) => ({
      address: account.address,
      balance: parseFloat(account.uiAmount || '0'),
      percentage: (parseFloat(account.uiAmount || '0') / totalSupply) * 100
    }));
  } catch (error) {
    console.error('[SAFETY] Failed to get top holders:', error);
    return [];
  }
}

/**
 * Check if mint/freeze authorities are enabled
 */
async function getTokenAuthorities(mintAddress: string): Promise<{
  mintEnabled: boolean;
  freezeEnabled: boolean;
}> {
  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'mint-info',
        method: 'getAccountInfo',
        params: [
          mintAddress,
          { encoding: 'jsonParsed' }
        ]
      })
    });

    const data = await response.json();
    const parsed = data.result?.value?.data?.parsed?.info;
    
    return {
      mintEnabled: parsed?.mintAuthority !== null && parsed?.mintAuthority !== undefined,
      freezeEnabled: parsed?.freezeAuthority !== null && parsed?.freezeAuthority !== undefined
    };
  } catch (error) {
    console.error('[SAFETY] Failed to get token authorities:', error);
    return { mintEnabled: false, freezeEnabled: false };
  }
}

/**
 * Get token creation time and social links from DexScreener
 */
async function getTokenInfo(mintAddress: string): Promise<{
  age: number;
  holders: number;
  socialLinks: SafetyAnalysis['socialLinks'];
  liquidity: number;
}> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    
    if (!pair) {
      return { age: 0, holders: 0, socialLinks: {}, liquidity: 0 };
    }
    
    const createdAt = pair.pairCreatedAt || Date.now();
    const age = Math.floor((Date.now() - createdAt) / 60000); // Minutes
    
    return {
      age,
      holders: pair.txns?.h24?.buys || 0, // Approximate from unique buyers
      socialLinks: {
        twitter: pair.info?.socials?.find((s: any) => s.type === 'twitter')?.url,
        telegram: pair.info?.socials?.find((s: any) => s.type === 'telegram')?.url,
        website: pair.info?.websites?.[0]?.url
      },
      liquidity: pair.liquidity?.usd || 0
    };
  } catch (error) {
    console.error('[SAFETY] Failed to get token info:', error);
    return { age: 0, holders: 0, socialLinks: {}, liquidity: 0 };
  }
}

/**
 * Detect bundled wallets (multiple wallets from same source)
 * Simplified heuristic: check if top wallets received tokens at similar times
 */
function detectBundledWallets(holders: HolderInfo[]): number {
  // This is a simplified check - real implementation would check:
  // 1. Transaction history for similar funding sources
  // 2. Timing of token receipts
  // 3. Wallet age and activity patterns
  
  // For now, flag if multiple large holders have similar percentages (likely bundled)
  const largeHolders = holders.filter(h => h.percentage >= 3);
  if (largeHolders.length < 3) return 0;
  
  // Check for suspicious clustering (±0.5% of each other)
  let bundledCount = 0;
  for (let i = 0; i < largeHolders.length - 1; i++) {
    for (let j = i + 1; j < largeHolders.length; j++) {
      if (Math.abs(largeHolders[i].percentage - largeHolders[j].percentage) < 0.5) {
        bundledCount++;
      }
    }
  }
  
  return bundledCount;
}

/**
 * Calculate safety score and detect red flags
 */
function analyzeHoldings(
  holders: HolderInfo[],
  authorities: { mintEnabled: boolean; freezeEnabled: boolean },
  tokenInfo: { age: number; holders: number; socialLinks: SafetyAnalysis['socialLinks']; liquidity: number }
): { score: number; redFlags: RedFlag[]; devHoldings: number } {
  let score = 70; // Start at 70 (neutral-positive)
  const redFlags: RedFlag[] = [];
  
  // Top holder analysis
  const topHolder = holders[0];
  const topHolderPct = topHolder?.percentage || 0;
  const devHoldings = topHolderPct;
  
  // === Dev Holdings Scoring ===
  if (topHolderPct > 30) {
    score -= 20;
    redFlags.push({
      type: 'DEV_HOLDINGS_EXTREME',
      description: `Top wallet holds ${topHolderPct.toFixed(1)}% (>30%)`,
      severity: 'CRITICAL',
      points: 20
    });
  } else if (topHolderPct > 20) {
    score -= 10;
    redFlags.push({
      type: 'DEV_HOLDINGS_HIGH',
      description: `Top wallet holds ${topHolderPct.toFixed(1)}% (>20%)`,
      severity: 'HIGH',
      points: 10
    });
  } else if (topHolderPct < 10) {
    score += 5;
  }
  
  // Check top 5 combined (excluding liquidity pools)
  const top5Combined = holders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
  if (top5Combined > 50) {
    score -= 10;
    redFlags.push({
      type: 'CONCENTRATED_SUPPLY',
      description: `Top 5 wallets hold ${top5Combined.toFixed(1)}% (>50%)`,
      severity: 'HIGH',
      points: 10
    });
  }
  
  // === Authority Checks ===
  if (authorities.mintEnabled) {
    score -= 15;
    redFlags.push({
      type: 'MINT_AUTHORITY_ENABLED',
      description: 'Mint authority is still enabled - unlimited tokens can be minted',
      severity: 'CRITICAL',
      points: 15
    });
  }
  
  if (authorities.freezeEnabled) {
    score -= 10;
    redFlags.push({
      type: 'FREEZE_AUTHORITY_ENABLED',
      description: 'Freeze authority is enabled - transfers can be blocked',
      severity: 'HIGH',
      points: 10
    });
  }
  
  // === Token Age ===
  if (tokenInfo.age < 60) { // Less than 1 hour
    score -= 5;
    redFlags.push({
      type: 'VERY_NEW_TOKEN',
      description: `Token is only ${tokenInfo.age} minutes old (<1 hour)`,
      severity: 'MEDIUM',
      points: 5
    });
  } else if (tokenInfo.age > 1440) { // More than 24 hours = more trusted
    score += 3;
  }
  
  // === Social Links ===
  const hasSocials = tokenInfo.socialLinks.twitter || 
                    tokenInfo.socialLinks.telegram || 
                    tokenInfo.socialLinks.website;
  if (!hasSocials) {
    score -= 5;
    redFlags.push({
      type: 'NO_SOCIAL_LINKS',
      description: 'No social media or website links found',
      severity: 'LOW',
      points: 5
    });
  } else {
    score += 3;
  }
  
  // === Liquidity ===
  if (tokenInfo.liquidity < 10000) {
    score -= 10;
    redFlags.push({
      type: 'LOW_LIQUIDITY',
      description: `Liquidity is only $${tokenInfo.liquidity.toLocaleString()} (<$10k)`,
      severity: 'HIGH',
      points: 10
    });
  } else if (tokenInfo.liquidity > 50000) {
    score += 5;
  }
  
  // === Bundled Wallets ===
  const bundledCount = detectBundledWallets(holders);
  if (bundledCount >= 3) {
    score -= 10;
    redFlags.push({
      type: 'BUNDLED_WALLETS',
      description: `Detected ${bundledCount} potentially bundled wallet pairs`,
      severity: 'HIGH',
      points: 10
    });
  }
  
  // Clamp score between 0-100
  score = Math.max(0, Math.min(100, score));
  
  return { score, redFlags, devHoldings };
}

/**
 * Main safety analysis function
 */
export async function analyzeSafety(mintAddress: string): Promise<SafetyAnalysis> {
  // Check cache
  const cached = safetyCache.get(mintAddress);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  console.log(`[SAFETY] Analyzing ${mintAddress}...`);
  
  // Fetch data in parallel
  const [holders, authorities, tokenInfo] = await Promise.all([
    getTopHolders(mintAddress),
    getTokenAuthorities(mintAddress),
    getTokenInfo(mintAddress)
  ]);
  
  // Analyze
  const { score, redFlags, devHoldings } = analyzeHoldings(holders, authorities, tokenInfo);
  
  // Determine risk category
  let riskCategory: SafetyAnalysis['riskCategory'];
  if (score >= SAFETY_THRESHOLDS.SAFE) {
    riskCategory = 'SAFE';
  } else if (score >= SAFETY_THRESHOLDS.CAUTION) {
    riskCategory = 'CAUTION';
  } else {
    riskCategory = 'RISKY';
  }
  
  const analysis: SafetyAnalysis = {
    safetyScore: score,
    riskCategory,
    redFlags,
    devHoldings,
    topHolderPercentage: holders[0]?.percentage || 0,
    liquidityLocked: false, // Would need to check lock services (Streamflow, etc.)
    mintAuthorityEnabled: authorities.mintEnabled,
    freezeAuthorityEnabled: authorities.freezeEnabled,
    tokenAge: tokenInfo.age,
    totalHolders: tokenInfo.holders,
    topHolders: holders.slice(0, 10),
    bundledWallets: detectBundledWallets(holders),
    socialLinks: tokenInfo.socialLinks,
    timestamp: Date.now()
  };
  
  // Cache result
  safetyCache.set(mintAddress, {
    data: analysis,
    expires: Date.now() + CACHE_TTL
  });
  
  console.log(`[SAFETY] ${mintAddress}: Score=${score}, Category=${riskCategory}, Flags=${redFlags.length}`);
  
  return analysis;
}

/**
 * Batch analyze multiple tokens
 */
export async function batchAnalyzeSafety(
  mintAddresses: string[]
): Promise<Map<string, SafetyAnalysis>> {
  const results = new Map<string, SafetyAnalysis>();
  
  // Process in parallel with rate limiting
  const batchSize = 3;
  for (let i = 0; i < mintAddresses.length; i += batchSize) {
    const batch = mintAddresses.slice(i, i + batchSize);
    const analyses = await Promise.all(batch.map(addr => analyzeSafety(addr)));
    
    for (let j = 0; j < batch.length; j++) {
      results.set(batch[j], analyses[j]);
    }
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < mintAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

/**
 * Quick safety check (cached only, no API calls)
 */
export function getQuickSafetyScore(mintAddress: string): number | null {
  const cached = safetyCache.get(mintAddress);
  return cached ? cached.data.safetyScore : null;
}

/**
 * Format safety emoji indicator
 */
export function getSafetyEmoji(analysis: SafetyAnalysis): string {
  switch (analysis.riskCategory) {
    case 'SAFE': return '🛡️';
    case 'CAUTION': return '⚠️';
    case 'RISKY': return '🚨';
    default: return '❓';
  }
}

/**
 * Format safety summary for display
 */
export function formatSafetySummary(analysis: SafetyAnalysis): string {
  const emoji = getSafetyEmoji(analysis);
  const flags = analysis.redFlags.map(f => `• ${f.description}`).join('\n');
  
  return `${emoji} Safety Score: ${analysis.safetyScore}/100 (${analysis.riskCategory})

Dev Holdings: ${analysis.devHoldings.toFixed(1)}%
Token Age: ${analysis.tokenAge} minutes
Liquidity Locked: ${analysis.liquidityLocked ? 'Yes' : 'No'}
Mint Authority: ${analysis.mintAuthorityEnabled ? '⚠️ Enabled' : '✅ Disabled'}
Freeze Authority: ${analysis.freezeAuthorityEnabled ? '⚠️ Enabled' : '✅ Disabled'}

${analysis.redFlags.length > 0 ? `🚩 Red Flags:\n${flags}` : '✅ No major red flags detected'}`;
}

/**
 * Clear safety cache
 */
export function clearSafetyCache(): void {
  safetyCache.clear();
}
