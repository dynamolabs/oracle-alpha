/**
 * Jupiter DEX Integration
 * Provides quote fetching and swap simulation for demo/paper trading
 * 
 * Jupiter API v6: https://quote-api.jup.ag/v6
 */

import crypto from 'crypto';

// Constants
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Types
export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RoutePlan[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface RoutePlan {
  swapInfo: {
    ammKey: string;
    label?: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
}

export interface TradeExecution {
  id: string;
  timestamp: number;
  type: 'BUY' | 'SELL';
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  inputSymbol: string;
  outputSymbol: string;
  price: number;
  priceImpact: number;
  slippage: number;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  mode: 'PAPER' | 'LIVE';
  quote?: JupiterQuote;
  txSignature?: string;
  error?: string;
  signalId?: string;
  signalScore?: number;
}

export interface PaperPortfolio {
  id: string;
  name: string;
  createdAt: number;
  initialBalance: number;
  currentBalance: number;
  holdings: Map<string, Holding>;
  trades: TradeExecution[];
  stats: PortfolioStats;
}

export interface Holding {
  mint: string;
  symbol: string;
  amount: number;
  avgEntryPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

export interface PortfolioStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  bestTrade: { symbol: string; pnl: number } | null;
  worstTrade: { symbol: string; pnl: number } | null;
}

// Paper trading state
let paperPortfolio: PaperPortfolio | null = null;
const tradeHistory: TradeExecution[] = [];

// Token metadata cache (simple in-memory)
const tokenMetadataCache = new Map<string, { symbol: string; decimals: number; name?: string }>();

// Initialize common tokens
tokenMetadataCache.set(SOL_MINT, { symbol: 'SOL', decimals: 9, name: 'Solana' });
tokenMetadataCache.set(USDC_MINT, { symbol: 'USDC', decimals: 6, name: 'USD Coin' });

/**
 * Initialize paper trading portfolio
 */
export function initPaperPortfolio(initialBalance: number = 1000): PaperPortfolio {
  paperPortfolio = {
    id: `portfolio_${Date.now()}`,
    name: 'Paper Trading',
    createdAt: Date.now(),
    initialBalance,
    currentBalance: initialBalance,
    holdings: new Map(),
    trades: [],
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      bestTrade: null,
      worstTrade: null
    }
  };
  
  // Add USDC as base currency
  paperPortfolio.holdings.set(USDC_MINT, {
    mint: USDC_MINT,
    symbol: 'USDC',
    amount: initialBalance,
    avgEntryPrice: 1,
    currentPrice: 1,
    value: initialBalance,
    pnl: 0,
    pnlPercent: 0
  });
  
  console.log(`[JUPITER] Paper portfolio initialized with $${initialBalance} USDC`);
  return paperPortfolio;
}

/**
 * Get current paper portfolio
 */
export function getPaperPortfolio(): PaperPortfolio | null {
  return paperPortfolio;
}

/**
 * Reset paper portfolio
 */
export function resetPaperPortfolio(initialBalance: number = 1000): PaperPortfolio {
  return initPaperPortfolio(initialBalance);
}

/**
 * Fetch token metadata from DexScreener or cache
 */
export async function getTokenMetadata(mint: string): Promise<{ symbol: string; decimals: number; name?: string }> {
  // Check cache first
  if (tokenMetadataCache.has(mint)) {
    return tokenMetadataCache.get(mint)!;
  }
  
  try {
    // Try DexScreener API
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (response.ok) {
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        const metadata = {
          symbol: pair.baseToken.symbol || 'UNKNOWN',
          decimals: 9, // Default for most Solana tokens
          name: pair.baseToken.name
        };
        tokenMetadataCache.set(mint, metadata);
        return metadata;
      }
    }
  } catch (e) {
    console.error(`[JUPITER] Failed to fetch metadata for ${mint}:`, e);
  }
  
  // Fallback
  const fallback = { symbol: mint.slice(0, 6) + '...', decimals: 9 };
  tokenMetadataCache.set(mint, fallback);
  return fallback;
}

/**
 * Get quote from Jupiter API
 */
export async function getJupiterQuote(request: QuoteRequest): Promise<JupiterQuote | null> {
  try {
    const params = new URLSearchParams({
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.amount,
      slippageBps: (request.slippageBps || 50).toString(),
      swapMode: request.swapMode || 'ExactIn'
    });
    
    if (request.onlyDirectRoutes) {
      params.append('onlyDirectRoutes', 'true');
    }
    
    const url = `${JUPITER_QUOTE_API}/quote?${params.toString()}`;
    console.log(`[JUPITER] Fetching quote: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[JUPITER] Quote API error: ${response.status} - ${errorText}`);
      return null;
    }
    
    const quote = await response.json() as JupiterQuote;
    console.log(`[JUPITER] Quote received: ${quote.inAmount} -> ${quote.outAmount}`);
    return quote;
  } catch (error) {
    console.error('[JUPITER] Failed to get quote:', error);
    return null;
  }
}

/**
 * Get quote for buying a token with SOL
 */
export async function getQuoteForBuy(
  tokenMint: string,
  solAmount: number,
  slippageBps: number = 100
): Promise<JupiterQuote | null> {
  // Convert SOL to lamports
  const lamports = Math.floor(solAmount * 1e9).toString();
  
  return getJupiterQuote({
    inputMint: SOL_MINT,
    outputMint: tokenMint,
    amount: lamports,
    slippageBps
  });
}

/**
 * Get quote for selling a token for SOL
 */
export async function getQuoteForSell(
  tokenMint: string,
  tokenAmount: number,
  decimals: number = 9,
  slippageBps: number = 100
): Promise<JupiterQuote | null> {
  const amount = Math.floor(tokenAmount * Math.pow(10, decimals)).toString();
  
  return getJupiterQuote({
    inputMint: tokenMint,
    outputMint: SOL_MINT,
    amount,
    slippageBps
  });
}

/**
 * Get quote with USDC as input/output (for paper trading)
 */
export async function getQuoteWithUSDC(
  tokenMint: string,
  usdcAmount: number,
  isBuy: boolean = true,
  slippageBps: number = 100
): Promise<JupiterQuote | null> {
  const amount = Math.floor(usdcAmount * 1e6).toString(); // USDC has 6 decimals
  
  return getJupiterQuote({
    inputMint: isBuy ? USDC_MINT : tokenMint,
    outputMint: isBuy ? tokenMint : USDC_MINT,
    amount,
    slippageBps
  });
}

/**
 * Execute paper trade (simulation)
 */
export async function executePaperTrade(
  tokenMint: string,
  amount: number,
  isBuy: boolean,
  slippageBps: number = 100,
  signalId?: string,
  signalScore?: number
): Promise<TradeExecution> {
  // Initialize portfolio if needed
  if (!paperPortfolio) {
    initPaperPortfolio();
  }
  
  const tradeId = `trade_${crypto.randomBytes(8).toString('hex')}`;
  const timestamp = Date.now();
  
  // Get token metadata
  const tokenMetadata = await getTokenMetadata(tokenMint);
  
  // Get real quote from Jupiter
  let quote: JupiterQuote | null = null;
  let outputAmount: number;
  let priceImpact: number;
  let price: number;
  
  if (isBuy) {
    // Buying token with USDC
    quote = await getQuoteWithUSDC(tokenMint, amount, true, slippageBps);
    
    if (quote) {
      outputAmount = parseFloat(quote.outAmount) / Math.pow(10, tokenMetadata.decimals);
      priceImpact = parseFloat(quote.priceImpactPct);
      price = amount / outputAmount; // Price per token in USDC
    } else {
      // Simulate if quote fails
      console.log('[JUPITER] Quote failed, simulating...');
      outputAmount = amount / (Math.random() * 0.001 + 0.0001); // Random price
      priceImpact = Math.random() * 2;
      price = amount / outputAmount;
    }
    
    // Check if we have enough USDC
    const usdcHolding = paperPortfolio!.holdings.get(USDC_MINT);
    if (!usdcHolding || usdcHolding.amount < amount) {
      return {
        id: tradeId,
        timestamp,
        type: 'BUY',
        inputMint: USDC_MINT,
        outputMint: tokenMint,
        inputAmount: amount,
        outputAmount: 0,
        inputSymbol: 'USDC',
        outputSymbol: tokenMetadata.symbol,
        price: 0,
        priceImpact: 0,
        slippage: slippageBps / 100,
        status: 'FAILED',
        mode: 'PAPER',
        error: 'Insufficient USDC balance',
        signalId,
        signalScore
      };
    }
    
    // Execute the buy
    usdcHolding.amount -= amount;
    usdcHolding.value = usdcHolding.amount;
    
    // Add or update token holding
    const existingHolding = paperPortfolio!.holdings.get(tokenMint);
    if (existingHolding) {
      const totalAmount = existingHolding.amount + outputAmount;
      const totalCost = (existingHolding.amount * existingHolding.avgEntryPrice) + amount;
      existingHolding.amount = totalAmount;
      existingHolding.avgEntryPrice = totalCost / totalAmount;
      existingHolding.currentPrice = price;
      existingHolding.value = totalAmount * price;
      existingHolding.pnl = existingHolding.value - totalCost;
      existingHolding.pnlPercent = (existingHolding.pnl / totalCost) * 100;
    } else {
      paperPortfolio!.holdings.set(tokenMint, {
        mint: tokenMint,
        symbol: tokenMetadata.symbol,
        amount: outputAmount,
        avgEntryPrice: price,
        currentPrice: price,
        value: amount, // Initially equal to input
        pnl: 0,
        pnlPercent: 0
      });
    }
    
  } else {
    // Selling token for USDC
    const holding = paperPortfolio!.holdings.get(tokenMint);
    if (!holding || holding.amount < amount) {
      return {
        id: tradeId,
        timestamp,
        type: 'SELL',
        inputMint: tokenMint,
        outputMint: USDC_MINT,
        inputAmount: amount,
        outputAmount: 0,
        inputSymbol: tokenMetadata.symbol,
        outputSymbol: 'USDC',
        price: 0,
        priceImpact: 0,
        slippage: slippageBps / 100,
        status: 'FAILED',
        mode: 'PAPER',
        error: 'Insufficient token balance',
        signalId,
        signalScore
      };
    }
    
    quote = await getQuoteForSell(tokenMint, amount, tokenMetadata.decimals, slippageBps);
    
    if (quote) {
      outputAmount = parseFloat(quote.outAmount) / 1e6; // USDC decimals
      priceImpact = parseFloat(quote.priceImpactPct);
      price = outputAmount / amount; // Price per token in USDC
    } else {
      // Simulate if quote fails
      console.log('[JUPITER] Quote failed, simulating...');
      outputAmount = amount * holding.currentPrice * (1 - Math.random() * 0.05);
      priceImpact = Math.random() * 2;
      price = outputAmount / amount;
    }
    
    // Calculate P&L for this trade
    const costBasis = amount * holding.avgEntryPrice;
    const proceeds = outputAmount;
    const tradePnL = proceeds - costBasis;
    const tradePnLPercent = (tradePnL / costBasis) * 100;
    
    // Execute the sell
    holding.amount -= amount;
    if (holding.amount <= 0.0001) {
      // Remove holding if depleted
      paperPortfolio!.holdings.delete(tokenMint);
    } else {
      holding.value = holding.amount * holding.currentPrice;
    }
    
    // Add USDC back
    const usdcHolding = paperPortfolio!.holdings.get(USDC_MINT)!;
    usdcHolding.amount += outputAmount;
    usdcHolding.value = usdcHolding.amount;
    
    // Update stats
    paperPortfolio!.stats.totalTrades++;
    if (tradePnL > 0) {
      paperPortfolio!.stats.wins++;
      if (!paperPortfolio!.stats.bestTrade || tradePnL > paperPortfolio!.stats.bestTrade.pnl) {
        paperPortfolio!.stats.bestTrade = { symbol: tokenMetadata.symbol, pnl: tradePnL };
      }
    } else {
      paperPortfolio!.stats.losses++;
      if (!paperPortfolio!.stats.worstTrade || tradePnL < paperPortfolio!.stats.worstTrade.pnl) {
        paperPortfolio!.stats.worstTrade = { symbol: tokenMetadata.symbol, pnl: tradePnL };
      }
    }
    paperPortfolio!.stats.winRate = (paperPortfolio!.stats.wins / paperPortfolio!.stats.totalTrades) * 100;
  }
  
  // Create trade record
  const trade: TradeExecution = {
    id: tradeId,
    timestamp,
    type: isBuy ? 'BUY' : 'SELL',
    inputMint: isBuy ? USDC_MINT : tokenMint,
    outputMint: isBuy ? tokenMint : USDC_MINT,
    inputAmount: amount,
    outputAmount: outputAmount!,
    inputSymbol: isBuy ? 'USDC' : tokenMetadata.symbol,
    outputSymbol: isBuy ? tokenMetadata.symbol : 'USDC',
    price: price!,
    priceImpact: priceImpact!,
    slippage: slippageBps / 100,
    status: 'EXECUTED',
    mode: 'PAPER',
    quote: quote || undefined,
    signalId,
    signalScore
  };
  
  // Add to history
  tradeHistory.unshift(trade);
  paperPortfolio!.trades.unshift(trade);
  
  // Update portfolio stats
  updatePortfolioStats();
  
  console.log(`[JUPITER] Paper ${isBuy ? 'BUY' : 'SELL'}: ${amount} ${isBuy ? 'USDC' : tokenMetadata.symbol} -> ${outputAmount!.toFixed(6)} ${isBuy ? tokenMetadata.symbol : 'USDC'}`);
  
  return trade;
}

/**
 * Update portfolio statistics
 */
function updatePortfolioStats(): void {
  if (!paperPortfolio) return;
  
  // Calculate total value
  let totalValue = 0;
  for (const holding of paperPortfolio.holdings.values()) {
    totalValue += holding.value;
  }
  
  paperPortfolio.currentBalance = totalValue;
  paperPortfolio.stats.totalPnL = totalValue - paperPortfolio.initialBalance;
  paperPortfolio.stats.totalPnLPercent = (paperPortfolio.stats.totalPnL / paperPortfolio.initialBalance) * 100;
}

/**
 * Update prices for all holdings
 */
export async function updateHoldingPrices(): Promise<void> {
  if (!paperPortfolio) return;
  
  for (const [mint, holding] of paperPortfolio.holdings.entries()) {
    if (mint === USDC_MINT) continue; // USDC is always $1
    
    try {
      // Get current price from DexScreener
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const price = parseFloat(data.pairs[0].priceUsd) || holding.currentPrice;
          holding.currentPrice = price;
          holding.value = holding.amount * price;
          const costBasis = holding.amount * holding.avgEntryPrice;
          holding.pnl = holding.value - costBasis;
          holding.pnlPercent = (holding.pnl / costBasis) * 100;
        }
      }
    } catch (e) {
      console.error(`[JUPITER] Failed to update price for ${holding.symbol}:`, e);
    }
  }
  
  updatePortfolioStats();
}

/**
 * Get trade history
 */
export function getTradeHistory(limit: number = 50): TradeExecution[] {
  return tradeHistory.slice(0, limit);
}

/**
 * Get trade by ID
 */
export function getTradeById(id: string): TradeExecution | undefined {
  return tradeHistory.find(t => t.id === id);
}

/**
 * Format quote for display
 */
export function formatQuoteForDisplay(quote: JupiterQuote, inputSymbol: string, outputSymbol: string): string {
  const inAmount = parseFloat(quote.inAmount);
  const outAmount = parseFloat(quote.outAmount);
  const priceImpact = parseFloat(quote.priceImpactPct);
  
  let text = '💱 Jupiter Quote\n';
  text += '━━━━━━━━━━━━━━━━━━\n';
  text += `📥 Input: ${(inAmount / 1e9).toFixed(6)} ${inputSymbol}\n`;
  text += `📤 Output: ${(outAmount / 1e9).toFixed(6)} ${outputSymbol}\n`;
  text += `📊 Price Impact: ${priceImpact.toFixed(2)}%\n`;
  text += `🔀 Slippage: ${quote.slippageBps / 100}%\n`;
  
  if (quote.routePlan && quote.routePlan.length > 0) {
    text += `🛤️ Route: ${quote.routePlan.map(r => r.swapInfo.label || 'Unknown').join(' → ')}\n`;
  }
  
  return text;
}

/**
 * Calculate optimal trade size based on liquidity
 */
export function calculateOptimalTradeSize(
  mcap: number,
  liquidity: number,
  maxImpact: number = 2
): number {
  // Rule of thumb: don't trade more than 1% of liquidity to keep impact low
  const maxFromLiquidity = liquidity * 0.01;
  
  // Also limit based on mcap (don't be more than 0.1% of mcap)
  const maxFromMcap = mcap * 0.001;
  
  return Math.min(maxFromLiquidity, maxFromMcap);
}

/**
 * Export types and constants
 */
export { SOL_MINT, USDC_MINT, JUPITER_QUOTE_API };
