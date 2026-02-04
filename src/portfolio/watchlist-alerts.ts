/**
 * Watchlist Alert System
 * Price, volume, signal, and wallet activity alerts for watchlist tokens
 */

import { sendDiscordAlert } from '../notifications/discord';
import { AggregatedSignal } from '../types';

// Alert types
export type AlertType =
  | 'price_above'
  | 'price_below'
  | 'change_up'
  | 'change_down'
  | 'volume'
  | 'signal'
  | 'wallet';

// Alert configuration
export interface WatchlistAlert {
  id: string;
  tokenMint: string;
  tokenSymbol?: string;
  tokenName?: string;
  type: AlertType;
  threshold: number; // price for price alerts, % for change alerts, multiplier for volume
  enabled: boolean;
  notifyTelegram: boolean;
  notifyDiscord: boolean;
  notifyBrowser: boolean;
  createdAt: number;
  updatedAt: number;
  lastTriggered?: number;
  triggerCount: number;
  cooldownMs: number; // minimum time between triggers (default 5 min)
  oneTime: boolean; // disable after first trigger
  notes?: string;
}

// Triggered alert record
export interface TriggeredAlert {
  id: string;
  alertId: string;
  tokenMint: string;
  tokenSymbol?: string;
  type: AlertType;
  threshold: number;
  actualValue: number;
  triggeredAt: number;
  notificationsSent: {
    telegram: boolean;
    discord: boolean;
    browser: boolean;
  };
  message: string;
}

// Price data for alert checking
export interface TokenPriceData {
  mint: string;
  symbol?: string;
  name?: string;
  price: number;
  priceUsd: number;
  mcap: number;
  volume24h: number;
  volume5m: number;
  priceChange1h: number;
  priceChange24h: number;
  liquidity: number;
  lastUpdated: number;
}

// Alert checker state
interface AlertCheckerState {
  running: boolean;
  lastCheck: number;
  checksPerformed: number;
  alertsTriggered: number;
  errors: number;
}

// In-memory stores
const alerts = new Map<string, WatchlistAlert>();
const triggeredAlerts: TriggeredAlert[] = [];
const priceCache = new Map<string, TokenPriceData>();
const MAX_TRIGGERED_HISTORY = 500;

// Checker state
let checkerState: AlertCheckerState = {
  running: false,
  lastCheck: 0,
  checksPerformed: 0,
  alertsTriggered: 0,
  errors: 0
};

// Checker interval handle
let checkerInterval: ReturnType<typeof setInterval> | null = null;

// WebSocket broadcast function (set by server)
let wsBroadcast: ((message: object) => void) | null = null;

// Telegram send function (set by server)
let telegramSend: ((chatId: string, message: string) => Promise<boolean>) | null = null;

// Telegram chat ID for alerts
const TELEGRAM_ALERT_CHAT_ID = process.env.TELEGRAM_ALERT_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

// ==================== Alert CRUD ====================

// Generate unique alert ID
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Create new alert
export function createAlert(
  tokenMint: string,
  type: AlertType,
  threshold: number,
  options: Partial<Omit<WatchlistAlert, 'id' | 'tokenMint' | 'type' | 'threshold' | 'createdAt' | 'updatedAt' | 'triggerCount'>> = {}
): WatchlistAlert {
  const alert: WatchlistAlert = {
    id: generateAlertId(),
    tokenMint,
    type,
    threshold,
    enabled: true,
    notifyTelegram: true,
    notifyDiscord: false,
    notifyBrowser: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    triggerCount: 0,
    cooldownMs: 5 * 60 * 1000, // 5 minutes default
    oneTime: false,
    ...options
  };

  alerts.set(alert.id, alert);
  console.log(`[ALERT] Created ${type} alert for ${tokenMint}: threshold=${threshold}`);
  return alert;
}

// Get alert by ID
export function getAlert(id: string): WatchlistAlert | undefined {
  return alerts.get(id);
}

// Get all alerts
export function getAllAlerts(): WatchlistAlert[] {
  return Array.from(alerts.values()).sort((a, b) => b.createdAt - a.createdAt);
}

// Get alerts for token
export function getAlertsForToken(tokenMint: string): WatchlistAlert[] {
  return Array.from(alerts.values())
    .filter(a => a.tokenMint === tokenMint)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Get enabled alerts
export function getEnabledAlerts(): WatchlistAlert[] {
  return Array.from(alerts.values()).filter(a => a.enabled);
}

// Update alert
export function updateAlert(
  id: string,
  updates: Partial<Omit<WatchlistAlert, 'id' | 'createdAt'>>
): WatchlistAlert | null {
  const alert = alerts.get(id);
  if (!alert) return null;

  const updated = {
    ...alert,
    ...updates,
    updatedAt: Date.now()
  };

  alerts.set(id, updated);
  console.log(`[ALERT] Updated alert ${id}`);
  return updated;
}

// Delete alert
export function deleteAlert(id: string): boolean {
  const deleted = alerts.delete(id);
  if (deleted) {
    console.log(`[ALERT] Deleted alert ${id}`);
  }
  return deleted;
}

// Delete all alerts for token
export function deleteAlertsForToken(tokenMint: string): number {
  let count = 0;
  for (const [id, alert] of alerts) {
    if (alert.tokenMint === tokenMint) {
      alerts.delete(id);
      count++;
    }
  }
  console.log(`[ALERT] Deleted ${count} alerts for ${tokenMint}`);
  return count;
}

// Toggle alert enabled/disabled
export function toggleAlert(id: string): WatchlistAlert | null {
  const alert = alerts.get(id);
  if (!alert) return null;

  alert.enabled = !alert.enabled;
  alert.updatedAt = Date.now();
  console.log(`[ALERT] ${alert.enabled ? 'Enabled' : 'Disabled'} alert ${id}`);
  return alert;
}

// ==================== Triggered Alerts ====================

// Get triggered alerts history
export function getTriggeredAlerts(limit: number = 50): TriggeredAlert[] {
  return triggeredAlerts.slice(0, limit);
}

// Get triggered alerts for token
export function getTriggeredAlertsForToken(tokenMint: string, limit: number = 20): TriggeredAlert[] {
  return triggeredAlerts
    .filter(t => t.tokenMint === tokenMint)
    .slice(0, limit);
}

// Record triggered alert
function recordTriggeredAlert(
  alert: WatchlistAlert,
  actualValue: number,
  message: string,
  notifications: { telegram: boolean; discord: boolean; browser: boolean }
): TriggeredAlert {
  const triggered: TriggeredAlert = {
    id: `trig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    alertId: alert.id,
    tokenMint: alert.tokenMint,
    tokenSymbol: alert.tokenSymbol,
    type: alert.type,
    threshold: alert.threshold,
    actualValue,
    triggeredAt: Date.now(),
    notificationsSent: notifications,
    message
  };

  triggeredAlerts.unshift(triggered);

  // Trim history
  if (triggeredAlerts.length > MAX_TRIGGERED_HISTORY) {
    triggeredAlerts.length = MAX_TRIGGERED_HISTORY;
  }

  // Update alert stats
  alert.lastTriggered = Date.now();
  alert.triggerCount++;

  // Disable if one-time
  if (alert.oneTime) {
    alert.enabled = false;
    console.log(`[ALERT] One-time alert ${alert.id} disabled after trigger`);
  }

  checkerState.alertsTriggered++;
  return triggered;
}

// ==================== Price Fetching ====================

// Fetch price from DexScreener
async function fetchTokenPrice(tokenMint: string): Promise<TokenPriceData | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.pairs || data.pairs.length === 0) return null;

    // Use first/best pair
    const pair = data.pairs[0];

    const priceData: TokenPriceData = {
      mint: tokenMint,
      symbol: pair.baseToken?.symbol,
      name: pair.baseToken?.name,
      price: parseFloat(pair.priceNative) || 0,
      priceUsd: parseFloat(pair.priceUsd) || 0,
      mcap: pair.marketCap || pair.fdv || 0,
      volume24h: pair.volume?.h24 || 0,
      volume5m: pair.volume?.m5 || 0,
      priceChange1h: pair.priceChange?.h1 || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      lastUpdated: Date.now()
    };

    // Cache price
    priceCache.set(tokenMint, priceData);
    return priceData;
  } catch (error) {
    console.error(`[ALERT] Failed to fetch price for ${tokenMint}:`, error);
    return null;
  }
}

// Batch fetch prices
async function fetchPrices(tokenMints: string[]): Promise<Map<string, TokenPriceData>> {
  const results = new Map<string, TokenPriceData>();
  
  // Fetch in parallel with rate limiting
  const batchSize = 5;
  for (let i = 0; i < tokenMints.length; i += batchSize) {
    const batch = tokenMints.slice(i, i + batchSize);
    const promises = batch.map(mint => fetchTokenPrice(mint));
    const batchResults = await Promise.all(promises);
    
    for (let j = 0; j < batch.length; j++) {
      if (batchResults[j]) {
        results.set(batch[j], batchResults[j]!);
      }
    }

    // Small delay between batches
    if (i + batchSize < tokenMints.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

// Get cached price
export function getCachedPrice(tokenMint: string): TokenPriceData | undefined {
  return priceCache.get(tokenMint);
}

// ==================== Alert Checking ====================

// Format alert message
function formatAlertMessage(alert: WatchlistAlert, priceData: TokenPriceData, actualValue: number): string {
  const symbol = priceData.symbol || alert.tokenSymbol || alert.tokenMint.slice(0, 8);
  const price = priceData.priceUsd.toFixed(8);
  const mcap = (priceData.mcap / 1000).toFixed(1);

  switch (alert.type) {
    case 'price_above':
      return `🔔 <b>$${symbol}</b> PRICE ALERT\n\n` +
        `Price broke above $${alert.threshold.toFixed(8)}\n` +
        `Current: <b>$${price}</b>\n` +
        `MCap: $${mcap}K`;

    case 'price_below':
      return `🔔 <b>$${symbol}</b> PRICE ALERT\n\n` +
        `Price dropped below $${alert.threshold.toFixed(8)}\n` +
        `Current: <b>$${price}</b>\n` +
        `MCap: $${mcap}K`;

    case 'change_up':
      return `📈 <b>$${symbol}</b> PUMP ALERT\n\n` +
        `Price up <b>${actualValue.toFixed(1)}%</b> (threshold: ${alert.threshold}%)\n` +
        `Current: $${price}\n` +
        `MCap: $${mcap}K`;

    case 'change_down':
      return `📉 <b>$${symbol}</b> DUMP ALERT\n\n` +
        `Price down <b>${Math.abs(actualValue).toFixed(1)}%</b> (threshold: ${alert.threshold}%)\n` +
        `Current: $${price}\n` +
        `MCap: $${mcap}K`;

    case 'volume':
      return `📊 <b>$${symbol}</b> VOLUME SPIKE\n\n` +
        `Volume at <b>${actualValue.toFixed(1)}x</b> average (threshold: ${alert.threshold}x)\n` +
        `24h Vol: $${(priceData.volume24h / 1000).toFixed(1)}K\n` +
        `Price: $${price}`;

    case 'signal':
      return `🔮 <b>$${symbol}</b> SIGNAL ALERT\n\n` +
        `New ORACLE signal generated!\n` +
        `Score: <b>${actualValue}</b>\n` +
        `Price: $${price}`;

    case 'wallet':
      return `👛 <b>$${symbol}</b> WALLET ALERT\n\n` +
        `Smart wallet activity detected!\n` +
        `Price: $${price}\n` +
        `MCap: $${mcap}K`;

    default:
      return `🔔 <b>$${symbol}</b> ALERT\n\nThreshold reached: ${actualValue}`;
  }
}

// Check if alert should trigger
function shouldTriggerAlert(alert: WatchlistAlert, priceData: TokenPriceData): { trigger: boolean; value: number } {
  // Check cooldown
  if (alert.lastTriggered && Date.now() - alert.lastTriggered < alert.cooldownMs) {
    return { trigger: false, value: 0 };
  }

  switch (alert.type) {
    case 'price_above':
      return {
        trigger: priceData.priceUsd >= alert.threshold,
        value: priceData.priceUsd
      };

    case 'price_below':
      return {
        trigger: priceData.priceUsd <= alert.threshold,
        value: priceData.priceUsd
      };

    case 'change_up':
      return {
        trigger: priceData.priceChange1h >= alert.threshold,
        value: priceData.priceChange1h
      };

    case 'change_down':
      return {
        trigger: priceData.priceChange1h <= -alert.threshold,
        value: priceData.priceChange1h
      };

    case 'volume': {
      // Volume spike: check if current volume is N times higher than average
      // Use 5m volume compared to expected rate
      const expectedVol5m = priceData.volume24h / 288; // 288 5-min periods in 24h
      const volumeMultiplier = expectedVol5m > 0 ? priceData.volume5m / expectedVol5m : 0;
      return {
        trigger: volumeMultiplier >= alert.threshold,
        value: volumeMultiplier
      };
    }

    default:
      return { trigger: false, value: 0 };
  }
}

// Send alert notifications
async function sendAlertNotifications(
  alert: WatchlistAlert,
  message: string
): Promise<{ telegram: boolean; discord: boolean; browser: boolean }> {
  const results = { telegram: false, discord: false, browser: false };

  // Telegram notification
  if (alert.notifyTelegram && telegramSend && TELEGRAM_ALERT_CHAT_ID) {
    try {
      results.telegram = await telegramSend(TELEGRAM_ALERT_CHAT_ID, message);
    } catch (e) {
      console.error('[ALERT] Telegram send failed:', e);
    }
  }

  // Discord notification
  if (alert.notifyDiscord) {
    try {
      // Create a mock signal for Discord notification
      const priceData = priceCache.get(alert.tokenMint);
      if (priceData) {
        const mockSignal: AggregatedSignal = {
          id: `alert_${alert.id}`,
          token: alert.tokenMint,
          symbol: priceData.symbol || 'UNKNOWN',
          name: priceData.name || 'Unknown Token',
          sources: [{ source: 'watchlist-alert' as any, weight: 1, rawScore: 50 }],
          score: 50,
          confidence: 0.5,
          riskLevel: 'MEDIUM',
          marketData: {
            mcap: priceData.mcap,
            liquidity: priceData.liquidity,
            volume5m: priceData.volume5m,
            volume1h: priceData.volume24h / 24,
            priceChange5m: 0,
            priceChange1h: priceData.priceChange1h,
            age: 0
          },
          analysis: {
            recommendation: message.replace(/<[^>]*>/g, '').slice(0, 200),
            narrative: ['Alert Triggered'],
            strengths: ['Watchlist alert triggered'],
            weaknesses: []
          },
          timestamp: Date.now()
        };
        results.discord = await sendDiscordAlert(mockSignal);
      }
    } catch (e) {
      console.error('[ALERT] Discord send failed:', e);
    }
  }

  // Browser notification via WebSocket
  if (alert.notifyBrowser && wsBroadcast) {
    try {
      wsBroadcast({
        type: 'watchlist_alert',
        data: {
          alertId: alert.id,
          tokenMint: alert.tokenMint,
          tokenSymbol: alert.tokenSymbol,
          alertType: alert.type,
          message: message.replace(/<[^>]*>/g, ''),
          timestamp: Date.now()
        }
      });
      results.browser = true;
    } catch (e) {
      console.error('[ALERT] WebSocket broadcast failed:', e);
    }
  }

  return results;
}

// Main alert check function
export async function checkAlerts(): Promise<TriggeredAlert[]> {
  const enabled = getEnabledAlerts();
  if (enabled.length === 0) return [];

  // Get unique tokens to check
  const tokenMints = [...new Set(enabled.map(a => a.tokenMint))];
  
  // Fetch prices
  const prices = await fetchPrices(tokenMints);
  
  const triggered: TriggeredAlert[] = [];

  for (const alert of enabled) {
    const priceData = prices.get(alert.tokenMint);
    if (!priceData) continue;

    // Update token info on alert
    if (!alert.tokenSymbol && priceData.symbol) {
      alert.tokenSymbol = priceData.symbol;
    }
    if (!alert.tokenName && priceData.name) {
      alert.tokenName = priceData.name;
    }

    const { trigger, value } = shouldTriggerAlert(alert, priceData);
    if (trigger) {
      const message = formatAlertMessage(alert, priceData, value);
      const notifications = await sendAlertNotifications(alert, message);
      const record = recordTriggeredAlert(alert, value, message, notifications);
      triggered.push(record);
      console.log(`[ALERT] Triggered: ${alert.type} for ${alert.tokenSymbol || alert.tokenMint}`);
    }
  }

  checkerState.lastCheck = Date.now();
  checkerState.checksPerformed++;

  return triggered;
}

// Check for signal alerts (called when new signal arrives)
export async function checkSignalAlert(signal: AggregatedSignal): Promise<TriggeredAlert | null> {
  const signalAlerts = Array.from(alerts.values()).filter(
    a => a.type === 'signal' && a.tokenMint === signal.token && a.enabled
  );

  for (const alert of signalAlerts) {
    // Check cooldown
    if (alert.lastTriggered && Date.now() - alert.lastTriggered < alert.cooldownMs) {
      continue;
    }

    // Check score threshold
    if (signal.score >= alert.threshold) {
      const priceData = priceCache.get(signal.token) || {
        mint: signal.token,
        symbol: signal.symbol,
        name: signal.name,
        price: 0,
        priceUsd: signal.marketData?.mcap ? signal.marketData.mcap / 1e9 : 0,
        mcap: signal.marketData?.mcap || 0,
        volume24h: signal.marketData?.volume1h ? signal.marketData.volume1h * 24 : 0,
        volume5m: signal.marketData?.volume5m || 0,
        priceChange1h: 0,
        priceChange24h: 0,
        liquidity: signal.marketData?.liquidity || 0,
        lastUpdated: Date.now()
      };

      const message = formatAlertMessage(alert, priceData as TokenPriceData, signal.score);
      const notifications = await sendAlertNotifications(alert, message);
      return recordTriggeredAlert(alert, signal.score, message, notifications);
    }
  }

  return null;
}

// Check for wallet alerts (called when wallet activity detected)
export async function checkWalletAlert(tokenMint: string, walletInfo: string): Promise<TriggeredAlert | null> {
  const walletAlerts = Array.from(alerts.values()).filter(
    a => a.type === 'wallet' && a.tokenMint === tokenMint && a.enabled
  );

  for (const alert of walletAlerts) {
    // Check cooldown
    if (alert.lastTriggered && Date.now() - alert.lastTriggered < alert.cooldownMs) {
      continue;
    }

    const priceData = await fetchTokenPrice(tokenMint);
    if (!priceData) continue;

    const message = formatAlertMessage(alert, priceData, 1) + `\n\nWallet: ${walletInfo}`;
    const notifications = await sendAlertNotifications(alert, message);
    return recordTriggeredAlert(alert, 1, message, notifications);
  }

  return null;
}

// ==================== Alert Checker Service ====================

// Start the alert checker
export function startAlertChecker(intervalMs: number = 30000): void {
  if (checkerInterval) {
    console.log('[ALERT] Checker already running');
    return;
  }

  checkerState.running = true;
  console.log(`[ALERT] Starting alert checker (interval: ${intervalMs}ms)`);

  // Run immediately
  checkAlerts().catch(e => {
    console.error('[ALERT] Checker error:', e);
    checkerState.errors++;
  });

  // Then run on interval
  checkerInterval = setInterval(() => {
    checkAlerts().catch(e => {
      console.error('[ALERT] Checker error:', e);
      checkerState.errors++;
    });
  }, intervalMs);
}

// Stop the alert checker
export function stopAlertChecker(): void {
  if (checkerInterval) {
    clearInterval(checkerInterval);
    checkerInterval = null;
    checkerState.running = false;
    console.log('[ALERT] Alert checker stopped');
  }
}

// Get checker state
export function getCheckerState(): AlertCheckerState {
  return { ...checkerState };
}

// Set WebSocket broadcast function
export function setWsBroadcast(fn: (message: object) => void): void {
  wsBroadcast = fn;
}

// Set Telegram send function
export function setTelegramSend(fn: (chatId: string, message: string) => Promise<boolean>): void {
  telegramSend = fn;
}

// ==================== Alert Templates ====================

// Quick alert creation helpers
export function createPriceAboveAlert(tokenMint: string, price: number, options?: Partial<WatchlistAlert>) {
  return createAlert(tokenMint, 'price_above', price, options);
}

export function createPriceBelowAlert(tokenMint: string, price: number, options?: Partial<WatchlistAlert>) {
  return createAlert(tokenMint, 'price_below', price, options);
}

export function createPumpAlert(tokenMint: string, percentChange: number = 50, options?: Partial<WatchlistAlert>) {
  return createAlert(tokenMint, 'change_up', percentChange, options);
}

export function createDumpAlert(tokenMint: string, percentChange: number = 30, options?: Partial<WatchlistAlert>) {
  return createAlert(tokenMint, 'change_down', percentChange, options);
}

export function createVolumeAlert(tokenMint: string, multiplier: number = 5, options?: Partial<WatchlistAlert>) {
  return createAlert(tokenMint, 'volume', multiplier, options);
}

export function createSignalAlert(tokenMint: string, minScore: number = 70, options?: Partial<WatchlistAlert>) {
  return createAlert(tokenMint, 'signal', minScore, options);
}

export function createWalletAlert(tokenMint: string, options?: Partial<WatchlistAlert>) {
  return createAlert(tokenMint, 'wallet', 1, options);
}

// ==================== Stats & Summary ====================

export function getAlertStats() {
  const all = getAllAlerts();
  const enabled = all.filter(a => a.enabled);
  const byType: Record<AlertType, number> = {
    price_above: 0,
    price_below: 0,
    change_up: 0,
    change_down: 0,
    volume: 0,
    signal: 0,
    wallet: 0
  };

  for (const alert of all) {
    byType[alert.type]++;
  }

  return {
    total: all.length,
    enabled: enabled.length,
    disabled: all.length - enabled.length,
    byType,
    triggered: {
      total: checkerState.alertsTriggered,
      recentCount: triggeredAlerts.length
    },
    checker: getCheckerState()
  };
}

// Export for serialization/persistence
export function exportAlerts(): WatchlistAlert[] {
  return getAllAlerts();
}

// Import from serialized data
export function importAlerts(data: WatchlistAlert[]): number {
  let count = 0;
  for (const alert of data) {
    alerts.set(alert.id, alert);
    count++;
  }
  console.log(`[ALERT] Imported ${count} alerts`);
  return count;
}

// Clear all alerts
export function clearAllAlerts(): number {
  const count = alerts.size;
  alerts.clear();
  console.log(`[ALERT] Cleared ${count} alerts`);
  return count;
}
