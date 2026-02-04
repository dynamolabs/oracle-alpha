/**
 * Portfolio Sync Module
 * Import and sync actual wallet holdings from Solana via Helius
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Types
export interface TokenHolding {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  usdValue: number;
  pricePerToken: number;
  change24h?: number;
  logoURI?: string;
}

export interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
  solBalance: number;
  solValue: number;
  tokenCount: number;
  holdings: TokenHolding[];
}

export interface SyncedPortfolio {
  wallet: string;
  label?: string;
  syncedAt: number;
  lastRefresh: number;
  autoRefresh: boolean;
  refreshIntervalMs: number;
  totalValue: number;
  solBalance: number;
  solValue: number;
  holdings: TokenHolding[];
  allocation: AllocationData[];
  history: PortfolioSnapshot[];
  pnl: PnLData;
}

export interface AllocationData {
  symbol: string;
  mint: string;
  value: number;
  percentage: number;
  color: string;
}

export interface PnLData {
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPct: number;
  change24h: number;
  change24hPct: number;
  change7d: number;
  change7dPct: number;
  byToken: TokenPnL[];
}

export interface TokenPnL {
  mint: string;
  symbol: string;
  currentValue: number;
  entryValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPct?: number;
  change24h: number;
  change24hPct: number;
}

// Helius API configuration
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC_URL = HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Constants
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// Price cache for efficiency
const priceCache: Map<string, { price: number; timestamp: number }> = new Map();
const PRICE_CACHE_TTL = 60_000; // 1 minute

// Store synced portfolios
const syncedPortfolios: Map<string, SyncedPortfolio> = new Map();

// Auto-refresh timers
const refreshTimers: Map<string, NodeJS.Timeout> = new Map();

// Colors for allocation chart
const CHART_COLORS = [
  '#00d9ff', '#a855f7', '#22c55e', '#eab308', '#ef4444',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f43f5e', '#6366f1', '#10b981'
];

/**
 * Validate Solana wallet address
 */
export function isValidWalletAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  } catch {
    return false;
  }
}

/**
 * Fetch SOL price from Jupiter or fallback
 */
async function fetchSolPrice(): Promise<number> {
  const cached = priceCache.get(SOL_MINT);
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }

  try {
    // Try Jupiter Price API
    const response = await fetch(
      `https://api.jup.ag/price/v2?ids=${SOL_MINT}`
    );
    if (response.ok) {
      const data = await response.json();
      const price = data?.data?.[SOL_MINT]?.price || 150;
      priceCache.set(SOL_MINT, { price, timestamp: Date.now() });
      return price;
    }
  } catch (error) {
    console.error('[PORTFOLIO-SYNC] Failed to fetch SOL price:', error);
  }

  // Fallback price
  return 150;
}

/**
 * Fetch token prices in batch from Jupiter
 */
async function fetchTokenPrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  if (mints.length === 0) return prices;

  // Check cache first
  const uncachedMints: string[] = [];
  for (const mint of mints) {
    const cached = priceCache.get(mint);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
      prices.set(mint, cached.price);
    } else {
      uncachedMints.push(mint);
    }
  }

  if (uncachedMints.length === 0) return prices;

  try {
    // Batch fetch from Jupiter (max 100 per request)
    const batchSize = 100;
    for (let i = 0; i < uncachedMints.length; i += batchSize) {
      const batch = uncachedMints.slice(i, i + batchSize);
      const ids = batch.join(',');
      
      const response = await fetch(`https://api.jup.ag/price/v2?ids=${ids}`);
      if (response.ok) {
        const data = await response.json();
        for (const mint of batch) {
          const price = data?.data?.[mint]?.price || 0;
          prices.set(mint, price);
          priceCache.set(mint, { price, timestamp: Date.now() });
        }
      }
    }
  } catch (error) {
    console.error('[PORTFOLIO-SYNC] Failed to fetch token prices:', error);
  }

  return prices;
}

/**
 * Fetch token metadata from Helius DAS API
 */
async function fetchTokenMetadata(mints: string[]): Promise<Map<string, { symbol: string; name: string; logoURI?: string }>> {
  const metadata = new Map<string, { symbol: string; name: string; logoURI?: string }>();
  
  if (!HELIUS_API_KEY || mints.length === 0) {
    // Return empty symbols if no API key
    for (const mint of mints) {
      metadata.set(mint, { symbol: mint.slice(0, 4) + '...', name: 'Unknown Token' });
    }
    return metadata;
  }

  try {
    const response = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mintAccounts: mints })
    });

    if (response.ok) {
      const data = await response.json();
      for (const item of data) {
        if (item.account) {
          metadata.set(item.account, {
            symbol: item.onChainMetadata?.metadata?.data?.symbol || item.legacyMetadata?.symbol || item.account.slice(0, 4) + '...',
            name: item.onChainMetadata?.metadata?.data?.name || item.legacyMetadata?.name || 'Unknown Token',
            logoURI: item.legacyMetadata?.logoURI
          });
        }
      }
    }
  } catch (error) {
    console.error('[PORTFOLIO-SYNC] Failed to fetch token metadata:', error);
  }

  // Fill in missing metadata
  for (const mint of mints) {
    if (!metadata.has(mint)) {
      metadata.set(mint, { symbol: mint.slice(0, 4) + '...', name: 'Unknown Token' });
    }
  }

  return metadata;
}

/**
 * Fetch wallet token holdings via Helius DAS API
 */
async function fetchWalletHoldings(walletAddress: string): Promise<{
  solBalance: number;
  tokens: Array<{ mint: string; amount: number; decimals: number }>;
}> {
  const connection = new Connection(HELIUS_RPC_URL, 'confirmed');
  
  // Fetch SOL balance
  let solBalance = 0;
  try {
    const pubkey = new PublicKey(walletAddress);
    solBalance = await connection.getBalance(pubkey) / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('[PORTFOLIO-SYNC] Failed to fetch SOL balance:', error);
  }

  // Fetch token accounts
  const tokens: Array<{ mint: string; amount: number; decimals: number }> = [];

  if (HELIUS_API_KEY) {
    // Use Helius DAS API for better token data
    try {
      const response = await fetch(`https://api.helius.xyz/v0/addresses/${walletAddress}/balances?api-key=${HELIUS_API_KEY}`);
      if (response.ok) {
        const data = await response.json();
        
        // Process native SOL
        if (data.nativeBalance) {
          solBalance = data.nativeBalance / LAMPORTS_PER_SOL;
        }

        // Process tokens
        for (const token of data.tokens || []) {
          if (token.amount > 0) {
            tokens.push({
              mint: token.mint,
              amount: token.amount / Math.pow(10, token.decimals || 0),
              decimals: token.decimals || 0
            });
          }
        }
      }
    } catch (error) {
      console.error('[PORTFOLIO-SYNC] Helius API error:', error);
    }
  } else {
    // Fallback to standard RPC
    try {
      const pubkey = new PublicKey(walletAddress);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      });

      for (const { account } of tokenAccounts.value) {
        const info = account.data.parsed?.info;
        if (info && info.tokenAmount?.uiAmount > 0) {
          tokens.push({
            mint: info.mint,
            amount: info.tokenAmount.uiAmount,
            decimals: info.tokenAmount.decimals
          });
        }
      }
    } catch (error) {
      console.error('[PORTFOLIO-SYNC] RPC error fetching tokens:', error);
    }
  }

  return { solBalance, tokens };
}

/**
 * Sync a wallet's portfolio
 */
export async function syncWallet(
  walletAddress: string,
  options: {
    label?: string;
    autoRefresh?: boolean;
    refreshIntervalMs?: number;
  } = {}
): Promise<SyncedPortfolio | null> {
  if (!isValidWalletAddress(walletAddress)) {
    console.error('[PORTFOLIO-SYNC] Invalid wallet address:', walletAddress);
    return null;
  }

  console.log(`[PORTFOLIO-SYNC] Syncing wallet: ${walletAddress.slice(0, 8)}...`);

  try {
    // Fetch wallet holdings
    const { solBalance, tokens } = await fetchWalletHoldings(walletAddress);

    // Get all mints for price/metadata fetch
    const mints = tokens.map(t => t.mint);
    
    // Fetch prices and metadata in parallel
    const [solPrice, tokenPrices, metadata] = await Promise.all([
      fetchSolPrice(),
      fetchTokenPrices(mints),
      fetchTokenMetadata(mints)
    ]);

    // Build holdings list
    const holdings: TokenHolding[] = [];
    let totalTokenValue = 0;

    for (const token of tokens) {
      const price = tokenPrices.get(token.mint) || 0;
      const value = token.amount * price;
      const meta = metadata.get(token.mint);

      // Skip dust (< $0.01)
      if (value < 0.01) continue;

      totalTokenValue += value;

      holdings.push({
        mint: token.mint,
        symbol: meta?.symbol || token.mint.slice(0, 4) + '...',
        name: meta?.name || 'Unknown Token',
        amount: token.amount,
        decimals: token.decimals,
        usdValue: value,
        pricePerToken: price,
        logoURI: meta?.logoURI
      });
    }

    // Sort by value (highest first)
    holdings.sort((a, b) => b.usdValue - a.usdValue);

    // Calculate totals
    const solValue = solBalance * solPrice;
    const totalValue = solValue + totalTokenValue;

    // Build allocation data
    const allocation: AllocationData[] = [];
    
    // Add SOL allocation
    if (solValue > 0) {
      allocation.push({
        symbol: 'SOL',
        mint: SOL_MINT,
        value: solValue,
        percentage: (solValue / totalValue) * 100,
        color: CHART_COLORS[0]
      });
    }

    // Add token allocations (top 14, others grouped)
    let otherValue = 0;
    holdings.forEach((holding, idx) => {
      if (idx < 14) {
        allocation.push({
          symbol: holding.symbol,
          mint: holding.mint,
          value: holding.usdValue,
          percentage: (holding.usdValue / totalValue) * 100,
          color: CHART_COLORS[(idx + 1) % CHART_COLORS.length]
        });
      } else {
        otherValue += holding.usdValue;
      }
    });

    if (otherValue > 0) {
      allocation.push({
        symbol: 'Other',
        mint: 'other',
        value: otherValue,
        percentage: (otherValue / totalValue) * 100,
        color: '#666666'
      });
    }

    // Get existing portfolio or create new
    const existing = syncedPortfolios.get(walletAddress);
    const now = Date.now();

    // Create snapshot
    const snapshot: PortfolioSnapshot = {
      timestamp: now,
      totalValue,
      solBalance,
      solValue,
      tokenCount: holdings.length,
      holdings: holdings.map(h => ({ ...h })) // Clone
    };

    // Calculate PnL
    const pnl = calculatePnL(existing?.history || [], snapshot, holdings);

    // Build portfolio object
    const portfolio: SyncedPortfolio = {
      wallet: walletAddress,
      label: options.label || existing?.label,
      syncedAt: existing?.syncedAt || now,
      lastRefresh: now,
      autoRefresh: options.autoRefresh ?? existing?.autoRefresh ?? false,
      refreshIntervalMs: options.refreshIntervalMs ?? existing?.refreshIntervalMs ?? 5 * 60 * 1000, // 5 min default
      totalValue,
      solBalance,
      solValue,
      holdings,
      allocation,
      history: [...(existing?.history || []).slice(-287), snapshot], // Keep last 24h of 5-min snapshots
      pnl
    };

    // Store portfolio
    syncedPortfolios.set(walletAddress, portfolio);

    // Setup auto-refresh if enabled
    if (portfolio.autoRefresh) {
      setupAutoRefresh(walletAddress, portfolio.refreshIntervalMs);
    }

    console.log(`[PORTFOLIO-SYNC] Synced ${walletAddress.slice(0, 8)}... - Total: $${totalValue.toFixed(2)} (${holdings.length} tokens)`);

    return portfolio;
  } catch (error) {
    console.error('[PORTFOLIO-SYNC] Sync failed:', error);
    return null;
  }
}

/**
 * Calculate PnL from history and current state
 */
function calculatePnL(
  history: PortfolioSnapshot[],
  current: PortfolioSnapshot,
  holdings: TokenHolding[]
): PnLData {
  const now = Date.now();
  
  // Find snapshots for comparison
  const snapshot24hAgo = history.find(s => now - s.timestamp >= 24 * 60 * 60 * 1000) || history[0];
  const snapshot7dAgo = history.find(s => now - s.timestamp >= 7 * 24 * 60 * 60 * 1000) || history[0];

  // Calculate changes
  const change24h = snapshot24hAgo 
    ? current.totalValue - snapshot24hAgo.totalValue
    : 0;
  const change24hPct = snapshot24hAgo && snapshot24hAgo.totalValue > 0
    ? (change24h / snapshot24hAgo.totalValue) * 100
    : 0;

  const change7d = snapshot7dAgo
    ? current.totalValue - snapshot7dAgo.totalValue
    : 0;
  const change7dPct = snapshot7dAgo && snapshot7dAgo.totalValue > 0
    ? (change7d / snapshot7dAgo.totalValue) * 100
    : 0;

  // Calculate per-token PnL
  const byToken: TokenPnL[] = holdings.map(holding => {
    // Find token in 24h ago snapshot
    const oldHolding = snapshot24hAgo?.holdings.find(h => h.mint === holding.mint);
    
    const tokenChange24h = oldHolding
      ? holding.usdValue - oldHolding.usdValue
      : 0;
    const tokenChange24hPct = oldHolding && oldHolding.usdValue > 0
      ? (tokenChange24h / oldHolding.usdValue) * 100
      : 0;

    return {
      mint: holding.mint,
      symbol: holding.symbol,
      currentValue: holding.usdValue,
      change24h: tokenChange24h,
      change24hPct: tokenChange24hPct
    };
  });

  // Sort by absolute change
  byToken.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));

  return {
    totalUnrealizedPnl: change24h, // Use 24h as unrealized baseline
    totalUnrealizedPnlPct: change24hPct,
    change24h,
    change24hPct,
    change7d,
    change7dPct,
    byToken
  };
}

/**
 * Setup auto-refresh for a portfolio
 */
function setupAutoRefresh(wallet: string, intervalMs: number): void {
  // Clear existing timer
  const existing = refreshTimers.get(wallet);
  if (existing) {
    clearInterval(existing);
  }

  // Set new timer
  const timer = setInterval(async () => {
    const portfolio = syncedPortfolios.get(wallet);
    if (portfolio?.autoRefresh) {
      await syncWallet(wallet);
    } else {
      // Auto-refresh disabled, clear timer
      clearInterval(timer);
      refreshTimers.delete(wallet);
    }
  }, intervalMs);

  refreshTimers.set(wallet, timer);
}

/**
 * Get a synced portfolio
 */
export function getPortfolio(wallet: string): SyncedPortfolio | undefined {
  return syncedPortfolios.get(wallet);
}

/**
 * Get all synced portfolios
 */
export function getAllPortfolios(): SyncedPortfolio[] {
  return Array.from(syncedPortfolios.values());
}

/**
 * Get portfolio history (value over time)
 */
export function getPortfolioHistory(wallet: string): PortfolioSnapshot[] {
  const portfolio = syncedPortfolios.get(wallet);
  return portfolio?.history || [];
}

/**
 * Get detailed PnL breakdown
 */
export function getPortfolioPnL(wallet: string): PnLData | null {
  const portfolio = syncedPortfolios.get(wallet);
  return portfolio?.pnl || null;
}

/**
 * Remove a synced portfolio
 */
export function removePortfolio(wallet: string): boolean {
  // Clear auto-refresh timer
  const timer = refreshTimers.get(wallet);
  if (timer) {
    clearInterval(timer);
    refreshTimers.delete(wallet);
  }

  return syncedPortfolios.delete(wallet);
}

/**
 * Update portfolio settings
 */
export function updatePortfolioSettings(
  wallet: string,
  settings: {
    label?: string;
    autoRefresh?: boolean;
    refreshIntervalMs?: number;
  }
): SyncedPortfolio | null {
  const portfolio = syncedPortfolios.get(wallet);
  if (!portfolio) return null;

  if (settings.label !== undefined) {
    portfolio.label = settings.label;
  }

  if (settings.autoRefresh !== undefined) {
    portfolio.autoRefresh = settings.autoRefresh;
    if (settings.autoRefresh) {
      setupAutoRefresh(wallet, portfolio.refreshIntervalMs);
    } else {
      const timer = refreshTimers.get(wallet);
      if (timer) {
        clearInterval(timer);
        refreshTimers.delete(wallet);
      }
    }
  }

  if (settings.refreshIntervalMs !== undefined) {
    portfolio.refreshIntervalMs = settings.refreshIntervalMs;
    if (portfolio.autoRefresh) {
      setupAutoRefresh(wallet, settings.refreshIntervalMs);
    }
  }

  return portfolio;
}

/**
 * Compare synced portfolio with paper portfolio
 */
export function compareWithPaperPortfolio(
  wallet: string,
  paperHoldings: Array<{ mint: string; symbol: string; value: number }>
): {
  syncedTotal: number;
  paperTotal: number;
  difference: number;
  differencePct: number;
  breakdown: Array<{
    symbol: string;
    mint: string;
    syncedValue: number;
    paperValue: number;
    diff: number;
    diffPct: number;
  }>;
} {
  const portfolio = syncedPortfolios.get(wallet);
  
  const syncedTotal = portfolio?.totalValue || 0;
  const paperTotal = paperHoldings.reduce((sum, h) => sum + h.value, 0);
  const difference = syncedTotal - paperTotal;
  const differencePct = paperTotal > 0 ? (difference / paperTotal) * 100 : 0;

  // Build breakdown by token
  const allMints = new Set([
    ...(portfolio?.holdings.map(h => h.mint) || []),
    ...paperHoldings.map(h => h.mint)
  ]);

  const breakdown: Array<{
    symbol: string;
    mint: string;
    syncedValue: number;
    paperValue: number;
    diff: number;
    diffPct: number;
  }> = [];

  for (const mint of allMints) {
    const syncedHolding = portfolio?.holdings.find(h => h.mint === mint);
    const paperHolding = paperHoldings.find(h => h.mint === mint);

    const syncedValue = syncedHolding?.usdValue || 0;
    const paperValue = paperHolding?.value || 0;
    const diff = syncedValue - paperValue;
    const diffPct = paperValue > 0 ? (diff / paperValue) * 100 : syncedValue > 0 ? 100 : 0;

    breakdown.push({
      symbol: syncedHolding?.symbol || paperHolding?.symbol || mint.slice(0, 4) + '...',
      mint,
      syncedValue,
      paperValue,
      diff,
      diffPct
    });
  }

  // Sort by absolute difference
  breakdown.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    syncedTotal,
    paperTotal,
    difference,
    differencePct,
    breakdown
  };
}

/**
 * Get portfolio summary for display
 */
export function getPortfolioSummary(wallet: string): {
  wallet: string;
  label?: string;
  totalValue: number;
  solBalance: number;
  tokenCount: number;
  topHoldings: Array<{ symbol: string; value: number; percentage: number }>;
  change24h: number;
  change24hPct: number;
  lastRefresh: number;
  synced: boolean;
} | null {
  const portfolio = syncedPortfolios.get(wallet);
  if (!portfolio) return null;

  return {
    wallet: portfolio.wallet,
    label: portfolio.label,
    totalValue: portfolio.totalValue,
    solBalance: portfolio.solBalance,
    tokenCount: portfolio.holdings.length,
    topHoldings: portfolio.allocation.slice(0, 5).map(a => ({
      symbol: a.symbol,
      value: a.value,
      percentage: a.percentage
    })),
    change24h: portfolio.pnl.change24h,
    change24hPct: portfolio.pnl.change24hPct,
    lastRefresh: portfolio.lastRefresh,
    synced: true
  };
}

/**
 * Format portfolio for display
 */
export function formatPortfolioDisplay(wallet: string): string {
  const portfolio = syncedPortfolios.get(wallet);
  if (!portfolio) {
    return `❌ Portfolio not synced: ${wallet.slice(0, 8)}...`;
  }

  const pnlEmoji = portfolio.pnl.change24h >= 0 ? '📈' : '📉';
  const pnlSign = portfolio.pnl.change24h >= 0 ? '+' : '';

  let output = `
💼 SYNCED PORTFOLIO
═══════════════════════════════════════
🔗 Wallet: ${portfolio.wallet.slice(0, 8)}...${portfolio.wallet.slice(-4)}
${portfolio.label ? `📝 Label: ${portfolio.label}` : ''}

💰 Total Value: $${portfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
◎ SOL Balance: ${portfolio.solBalance.toFixed(4)} SOL ($${portfolio.solValue.toFixed(2)})
🪙 Tokens: ${portfolio.holdings.length}

${pnlEmoji} 24h Change: ${pnlSign}$${portfolio.pnl.change24h.toFixed(2)} (${pnlSign}${portfolio.pnl.change24hPct.toFixed(2)}%)
📊 7d Change: ${portfolio.pnl.change7d >= 0 ? '+' : ''}$${portfolio.pnl.change7d.toFixed(2)} (${portfolio.pnl.change7dPct >= 0 ? '+' : ''}${portfolio.pnl.change7dPct.toFixed(2)}%)

🏆 TOP HOLDINGS:
`;

  for (const holding of portfolio.holdings.slice(0, 5)) {
    const pct = ((holding.usdValue / portfolio.totalValue) * 100).toFixed(1);
    output += `• ${holding.symbol}: $${holding.usdValue.toFixed(2)} (${pct}%)\n`;
  }

  output += `
⏰ Last Refresh: ${new Date(portfolio.lastRefresh).toLocaleString()}
🔄 Auto-Refresh: ${portfolio.autoRefresh ? 'ON' : 'OFF'}
`.trim();

  return output;
}

// Export for use elsewhere
export {
  HELIUS_API_KEY,
  SOL_MINT,
  USDC_MINT,
  USDT_MINT
};
