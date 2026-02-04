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
