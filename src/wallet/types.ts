/**
 * Wallet Types
 * Type definitions for wallet connection and trading
 */

// Wallet connection state
export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  walletName: string | null;
  connectedAt: number | null;
}

// Supported wallet types
export type WalletType = 'phantom' | 'solflare' | 'backpack' | 'unknown';

// Connection request/response
export interface ConnectRequest {
  walletType: WalletType;
  publicKey: string;
  signature?: string; // Optional signature to verify ownership
}

export interface ConnectResponse {
  success: boolean;
  message: string;
  sessionId?: string;
  walletState?: WalletState;
}

// Token balance
export interface TokenBalance {
  mint: string;
  symbol: string;
  name?: string;
  balance: number;
  decimals: number;
  usdValue?: number;
  logoUri?: string;
}

export interface WalletBalances {
  sol: number;
  solUsdValue: number;
  tokens: TokenBalance[];
  totalUsdValue: number;
  lastUpdated: number;
}

// Swap parameters
export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number; // In human-readable units (e.g., 0.1 SOL, not lamports)
  slippageBps: number; // e.g., 50 for 0.5%, 100 for 1%
  priorityFee?: 'low' | 'medium' | 'high' | 'turbo' | number; // In microlamports or preset
}

// Swap quote from Jupiter
export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  inputSymbol: string;
  outputSymbol: string;
  inputDecimals: number;
  outputDecimals: number;
  priceImpactPct: number;
  slippageBps: number;
  minimumReceived: string;
  route: RouteInfo[];
  estimatedFeesSol: number;
  expiresAt: number;
  quoteId: string;
}

export interface RouteInfo {
  label: string;
  inputMint: string;
  outputMint: string;
  percent: number;
}

// Transaction building result
export interface SwapTransaction {
  serializedTransaction: string; // Base64 encoded transaction
  blockhash: string;
  lastValidBlockHeight: number;
  quoteId: string;
  simulation?: SimulationResult;
}

export interface SimulationResult {
  success: boolean;
  logs?: string[];
  unitsConsumed?: number;
  error?: string;
}

// Swap execution result
export interface SwapResult {
  success: boolean;
  signature?: string;
  inputAmount: number;
  outputAmount: number;
  inputSymbol: string;
  outputSymbol: string;
  priceImpact: number;
  error?: string;
  explorerUrl?: string;
  confirmedAt?: number;
}

// Transaction record
export interface TransactionRecord {
  id: string;
  signature: string;
  type: 'swap' | 'transfer' | 'other';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  confirmedAt?: number;
  inputMint?: string;
  outputMint?: string;
  inputAmount?: number;
  outputAmount?: number;
  inputSymbol?: string;
  outputSymbol?: string;
  fee?: number;
  error?: string;
  signalId?: string;
}

// Safety check results
export interface SafetyCheck {
  passed: boolean;
  checks: {
    honeypot: { passed: boolean; warning?: string };
    liquidity: { passed: boolean; value?: number; warning?: string };
    concentration: { passed: boolean; topHolderPct?: number; warning?: string };
    priceImpact: { passed: boolean; impact?: number; warning?: string };
    slippageWarning: { passed: boolean; warning?: string };
    largeAmountWarning: { passed: boolean; warning?: string };
  };
  overallRisk: 'low' | 'medium' | 'high' | 'extreme';
  canProceed: boolean;
  warnings: string[];
}

// Priority fee presets (in microlamports per compute unit)
export const PRIORITY_FEE_PRESETS = {
  low: 1000,      // ~0.000001 SOL for 200k CUs
  medium: 10000,  // ~0.00001 SOL  
  high: 100000,   // ~0.0001 SOL
  turbo: 500000,  // ~0.0005 SOL (for high-priority)
} as const;

// Slippage presets
export const SLIPPAGE_PRESETS = {
  low: 50,    // 0.5%
  normal: 100, // 1%
  high: 300,  // 3%
  turbo: 500, // 5% (for volatile tokens)
} as const;

// Constants
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const WSOL_MINT = SOL_MINT; // Wrapped SOL uses same mint

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const USDC_DECIMALS = 6;
export const SOL_DECIMALS = 9;
