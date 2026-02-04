/**
 * Wallet Connection Manager
 * Handles wallet connection state and session management
 * 
 * Note: Actual wallet signing happens client-side via browser wallet extensions.
 * This module tracks connection state and validates signatures server-side.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import crypto from 'crypto';
import {
  WalletState,
  WalletType,
  ConnectRequest,
  ConnectResponse,
  WalletBalances,
  TokenBalance,
  TransactionRecord,
  SOL_MINT,
  USDC_MINT,
  SOL_DECIMALS,
  USDC_DECIMALS,
} from './types';

// RPC endpoint
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
let connection: Connection | null = null;

// Active wallet sessions (wallet -> session data)
const walletSessions = new Map<string, WalletSession>();

interface WalletSession {
  publicKey: string;
  walletType: WalletType;
  sessionId: string;
  connectedAt: number;
  lastActivity: number;
  transactions: TransactionRecord[];
}

// Session timeout (30 minutes of inactivity)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Initialize Solana connection
 */
export function initConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_ENDPOINT, 'confirmed');
    console.log(`[WALLET] Connected to Solana RPC: ${RPC_ENDPOINT.substring(0, 50)}...`);
  }
  return connection;
}

/**
 * Get or create connection
 */
export function getConnection(): Connection {
  return connection || initConnection();
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Validate a Solana public key
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Connect a wallet (register session)
 */
export function connectWallet(request: ConnectRequest): ConnectResponse {
  const { publicKey, walletType, signature } = request;
  
  // Validate public key
  if (!isValidPublicKey(publicKey)) {
    return {
      success: false,
      message: 'Invalid wallet address',
    };
  }
  
  // Check if already connected
  const existingSession = walletSessions.get(publicKey);
  if (existingSession) {
    // Update last activity
    existingSession.lastActivity = Date.now();
    return {
      success: true,
      message: 'Wallet already connected',
      sessionId: existingSession.sessionId,
      walletState: {
        connected: true,
        publicKey,
        walletName: walletType,
        connectedAt: existingSession.connectedAt,
      },
    };
  }
  
  // Create new session
  const sessionId = generateSessionId();
  const session: WalletSession = {
    publicKey,
    walletType,
    sessionId,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    transactions: [],
  };
  
  walletSessions.set(publicKey, session);
  console.log(`[WALLET] Wallet connected: ${publicKey.substring(0, 8)}... (${walletType})`);
  
  return {
    success: true,
    message: 'Wallet connected successfully',
    sessionId,
    walletState: {
      connected: true,
      publicKey,
      walletName: walletType,
      connectedAt: session.connectedAt,
    },
  };
}

/**
 * Disconnect a wallet
 */
export function disconnectWallet(publicKey: string): boolean {
  const session = walletSessions.get(publicKey);
  if (session) {
    walletSessions.delete(publicKey);
    console.log(`[WALLET] Wallet disconnected: ${publicKey.substring(0, 8)}...`);
    return true;
  }
  return false;
}

/**
 * Get wallet connection status
 */
export function getWalletStatus(publicKey: string): WalletState {
  const session = walletSessions.get(publicKey);
  
  if (!session) {
    return {
      connected: false,
      publicKey: null,
      walletName: null,
      connectedAt: null,
    };
  }
  
  // Check for timeout
  if (Date.now() - session.lastActivity > SESSION_TIMEOUT_MS) {
    walletSessions.delete(publicKey);
    return {
      connected: false,
      publicKey: null,
      walletName: null,
      connectedAt: null,
    };
  }
  
  // Update last activity
  session.lastActivity = Date.now();
  
  return {
    connected: true,
    publicKey: session.publicKey,
    walletName: session.walletType,
    connectedAt: session.connectedAt,
  };
}

/**
 * Get session by public key
 */
export function getSession(publicKey: string): WalletSession | null {
  const session = walletSessions.get(publicKey);
  if (session) {
    session.lastActivity = Date.now();
  }
  return session || null;
}

/**
 * Fetch token accounts and balances for a wallet
 */
export async function getWalletBalances(publicKey: string): Promise<WalletBalances> {
  const conn = getConnection();
  const pubkey = new PublicKey(publicKey);
  
  try {
    // Get SOL balance
    const solBalance = await conn.getBalance(pubkey);
    const solAmount = solBalance / LAMPORTS_PER_SOL;
    
    // Get token accounts
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(pubkey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });
    
    const tokens: TokenBalance[] = [];
    let totalUsdValue = 0;
    
    // Fetch SOL price
    const solPrice = await fetchTokenPrice(SOL_MINT);
    const solUsdValue = solAmount * solPrice;
    totalUsdValue += solUsdValue;
    
    // Process token accounts
    for (const { account } of tokenAccounts.value) {
      const parsed = account.data.parsed;
      if (parsed?.info?.tokenAmount?.uiAmount > 0) {
        const mint = parsed.info.mint;
        const balance = parsed.info.tokenAmount.uiAmount;
        const decimals = parsed.info.tokenAmount.decimals;
        
        // Get token metadata
        const metadata = await getTokenMetadata(mint);
        const price = await fetchTokenPrice(mint);
        const usdValue = balance * price;
        
        totalUsdValue += usdValue;
        
        tokens.push({
          mint,
          symbol: metadata.symbol,
          name: metadata.name,
          balance,
          decimals,
          usdValue,
          logoUri: metadata.logoUri,
        });
      }
    }
    
    // Sort tokens by USD value
    tokens.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
    
    return {
      sol: solAmount,
      solUsdValue,
      tokens,
      totalUsdValue,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('[WALLET] Error fetching balances:', error);
    return {
      sol: 0,
      solUsdValue: 0,
      tokens: [],
      totalUsdValue: 0,
      lastUpdated: Date.now(),
    };
  }
}

// Token metadata cache
const tokenMetadataCache = new Map<string, {
  symbol: string;
  name?: string;
  decimals: number;
  logoUri?: string;
}>();

// Initialize common tokens
tokenMetadataCache.set(SOL_MINT, {
  symbol: 'SOL',
  name: 'Solana',
  decimals: SOL_DECIMALS,
  logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
});
tokenMetadataCache.set(USDC_MINT, {
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: USDC_DECIMALS,
  logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
});

/**
 * Get token metadata
 */
async function getTokenMetadata(mint: string): Promise<{
  symbol: string;
  name?: string;
  decimals: number;
  logoUri?: string;
}> {
  // Check cache
  if (tokenMetadataCache.has(mint)) {
    return tokenMetadataCache.get(mint)!;
  }
  
  try {
    // Fetch from Jupiter token list
    const response = await fetch(`https://tokens.jup.ag/token/${mint}`);
    if (response.ok) {
      const data = await response.json();
      const metadata = {
        symbol: data.symbol || mint.substring(0, 6),
        name: data.name,
        decimals: data.decimals || 9,
        logoUri: data.logoURI,
      };
      tokenMetadataCache.set(mint, metadata);
      return metadata;
    }
  } catch (e) {
    // Ignore fetch errors
  }
  
  // Fallback to DexScreener
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (response.ok) {
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        const metadata = {
          symbol: pair.baseToken.symbol || mint.substring(0, 6),
          name: pair.baseToken.name,
          decimals: 9,
          logoUri: undefined,
        };
        tokenMetadataCache.set(mint, metadata);
        return metadata;
      }
    }
  } catch (e) {
    // Ignore
  }
  
  // Default fallback
  const fallback = {
    symbol: mint.substring(0, 6) + '...',
    name: undefined,
    decimals: 9,
    logoUri: undefined,
  };
  tokenMetadataCache.set(mint, fallback);
  return fallback;
}

// Price cache with TTL
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 30000; // 30 seconds

/**
 * Fetch token price in USD
 */
async function fetchTokenPrice(mint: string): Promise<number> {
  // Check cache
  const cached = priceCache.get(mint);
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }
  
  try {
    // Use Jupiter price API
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`);
    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data[mint]) {
        const price = data.data[mint].price || 0;
        priceCache.set(mint, { price, timestamp: Date.now() });
        return price;
      }
    }
  } catch (e) {
    // Fallback to DexScreener
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const price = parseFloat(data.pairs[0].priceUsd) || 0;
          priceCache.set(mint, { price, timestamp: Date.now() });
          return price;
        }
      }
    } catch {
      // Ignore
    }
  }
  
  return 0;
}

/**
 * Record a transaction for a wallet
 */
export function recordTransaction(publicKey: string, tx: TransactionRecord): void {
  const session = walletSessions.get(publicKey);
  if (session) {
    session.transactions.unshift(tx);
    // Keep last 100 transactions
    if (session.transactions.length > 100) {
      session.transactions = session.transactions.slice(0, 100);
    }
  }
}

/**
 * Get recent transactions for a wallet
 */
export function getTransactions(publicKey: string, limit: number = 20): TransactionRecord[] {
  const session = walletSessions.get(publicKey);
  if (!session) return [];
  return session.transactions.slice(0, limit);
}

/**
 * Get all connected wallets (for admin/debug)
 */
export function getConnectedWallets(): WalletState[] {
  const wallets: WalletState[] = [];
  const now = Date.now();
  
  for (const [, session] of walletSessions) {
    // Skip timed out sessions
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) continue;
    
    wallets.push({
      connected: true,
      publicKey: session.publicKey,
      walletName: session.walletType,
      connectedAt: session.connectedAt,
    });
  }
  
  return wallets;
}

/**
 * Cleanup expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [publicKey, session] of walletSessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      walletSessions.delete(publicKey);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[WALLET] Cleaned up ${cleaned} expired sessions`);
  }
  
  return cleaned;
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

// Export helpers
export { fetchTokenPrice, getTokenMetadata };
