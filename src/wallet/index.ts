/**
 * Wallet Module Exports
 * Provides wallet connection and real trading functionality
 */

// Types
export * from './types';

// Connection management
export {
  initConnection,
  getConnection,
  connectWallet,
  disconnectWallet,
  getWalletStatus,
  getWalletBalances,
  getSession,
  recordTransaction,
  getTransactions,
  getConnectedWallets,
  cleanupExpiredSessions,
  isValidPublicKey,
  fetchTokenPrice,
  getTokenMetadata,
} from './connect';

// Trading
export {
  getSwapQuote,
  buildSwapTransaction,
  confirmTransaction,
  performSafetyChecks,
  getQuickQuote,
  cleanupExpiredQuotes,
  PRIORITY_FEE_PRESETS,
  SLIPPAGE_PRESETS,
} from './trade';
