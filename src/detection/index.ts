/**
 * Detection Module
 * Exports all detection utilities for token safety analysis
 */

export {
  detectHoneypot,
  batchDetectHoneypot,
  getQuickHoneypotStatus,
  clearHoneypotCache,
  getHoneypotEmoji,
  formatHoneypotResult,
  THRESHOLDS,
  type HoneypotResult,
  type HoneypotWarning
} from './honeypot';

export {
  analyzeSnipers,
  getWalletSniperScore,
  getQuickSniperAnalysis,
  clearSniperCache,
  formatSniperAnalysis,
  getSniperWarning,
  toSafetyData,
  type SniperAnalysis,
  type SniperWallet,
  type WalletSniperProfile,
  type MEVBotInfo,
  type JitoBundleInfo
} from './sniper-detector';

export {
  analyzeWashTrading,
  getQuickWashScore,
  getCachedWashAnalysis,
  clearWashCache,
  getWashEmoji,
  formatWashAnalysis,
  getWashWarning,
  type WashTradingAnalysis,
  type WashTradingWarning,
  type SelfTrade,
  type CircularPattern,
  type IntervalAnomaly,
  type VolumeAnomalyData
} from './wash-trading';
