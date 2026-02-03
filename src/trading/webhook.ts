/**
 * Trading Bot Webhook Integration
 * Sends signals to external trading bots via webhooks
 *
 * Supports:
 * - 3Commas
 * - Alertatron
 * - TradingView
 * - Custom webhooks
 */

import { AggregatedSignal } from '../types';
import crypto from 'crypto';

// Webhook configuration
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  type: 'custom' | '3commas' | 'alertatron' | 'tradingview';
  secret?: string;
  headers?: Record<string, string>;
  minScore: number;
  enabled: boolean;
  createdAt: number;
  lastTriggered?: number;
  successCount: number;
  failureCount: number;
}

// Webhook payload formats
interface CustomPayload {
  signal: {
    id: string;
    token: string;
    symbol: string;
    score: number;
    risk: string;
    action: 'BUY';
    timestamp: number;
  };
  metadata: {
    sources: string[];
    narratives: string[];
    mcap: number;
    recommendation: string;
  };
  signature?: string;
}

interface ThreeCommasPayload {
  message_type: 'bot';
  bot_id: string;
  email_token: string;
  delay_seconds: number;
  pair: string;
}

interface AlertatronPayload {
  alert: string;
  ticker: string;
  price: string;
  exchange: string;
}

// Webhook store
const webhooks = new Map<string, WebhookConfig>();

// Register a webhook
export function registerWebhook(
  config: Omit<WebhookConfig, 'id' | 'createdAt' | 'successCount' | 'failureCount'>
): WebhookConfig {
  const webhook: WebhookConfig = {
    ...config,
    id: `wh_${crypto.randomBytes(8).toString('hex')}`,
    createdAt: Date.now(),
    successCount: 0,
    failureCount: 0
  };

  webhooks.set(webhook.id, webhook);
  return webhook;
}

// Get webhook by ID
export function getWebhook(id: string): WebhookConfig | undefined {
  return webhooks.get(id);
}

// List all webhooks
export function listWebhooks(): WebhookConfig[] {
  return Array.from(webhooks.values());
}

// Update webhook
export function updateWebhook(id: string, updates: Partial<WebhookConfig>): boolean {
  const webhook = webhooks.get(id);
  if (!webhook) return false;

  Object.assign(webhook, updates);
  return true;
}

// Delete webhook
export function deleteWebhook(id: string): boolean {
  return webhooks.delete(id);
}

// Format payload based on webhook type
function formatPayload(signal: AggregatedSignal, webhook: WebhookConfig): any {
  switch (webhook.type) {
    case '3commas':
      return format3CommasPayload(signal, webhook);
    case 'alertatron':
      return formatAlertratronPayload(signal);
    case 'tradingview':
      return formatTradingViewPayload(signal);
    default:
      return formatCustomPayload(signal, webhook);
  }
}

// Custom webhook payload
function formatCustomPayload(signal: AggregatedSignal, webhook: WebhookConfig): CustomPayload {
  const payload: CustomPayload = {
    signal: {
      id: signal.id,
      token: signal.token,
      symbol: signal.symbol,
      score: signal.score,
      risk: signal.riskLevel,
      action: 'BUY',
      timestamp: signal.timestamp
    },
    metadata: {
      sources: signal.sources.map(s => s.source),
      narratives: signal.analysis?.narrative || [],
      mcap: signal.marketData?.mcap || 0,
      recommendation: signal.analysis?.recommendation || ''
    }
  };

  // Add HMAC signature if secret is configured
  if (webhook.secret) {
    const hmac = crypto.createHmac('sha256', webhook.secret);
    hmac.update(JSON.stringify(payload));
    payload.signature = hmac.digest('hex');
  }

  return payload;
}

// 3Commas payload format
function format3CommasPayload(
  signal: AggregatedSignal,
  webhook: WebhookConfig
): ThreeCommasPayload {
  return {
    message_type: 'bot',
    bot_id: webhook.headers?.bot_id || '',
    email_token: webhook.headers?.email_token || '',
    delay_seconds: 0,
    pair: `USDT_${signal.symbol}`
  };
}

// Alertatron payload format
function formatAlertratronPayload(signal: AggregatedSignal): AlertatronPayload {
  return {
    alert: `ORACLE Alpha: BUY ${signal.symbol}`,
    ticker: signal.symbol,
    price: '0',
    exchange: 'raydium'
  };
}

// TradingView payload format (webhook alert)
function formatTradingViewPayload(signal: AggregatedSignal): any {
  return {
    strategy: 'ORACLE_ALPHA',
    action: 'buy',
    contracts: '{{strategy.order.contracts}}',
    ticker: signal.symbol,
    position_size: '{{strategy.position_size}}',
    price: '{{close}}',
    comment: `Score: ${signal.score}, Risk: ${signal.riskLevel}`
  };
}

// Send webhook
export async function triggerWebhook(
  webhook: WebhookConfig,
  signal: AggregatedSignal
): Promise<boolean> {
  if (!webhook.enabled) return false;
  if (signal.score < webhook.minScore) return false;

  const payload = formatPayload(signal, webhook);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...webhook.headers
    };

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    webhook.lastTriggered = Date.now();

    if (response.ok) {
      webhook.successCount++;
      console.log(`[WEBHOOK] ${webhook.name} triggered for ${signal.symbol}`);
      return true;
    } else {
      webhook.failureCount++;
      console.error(`[WEBHOOK] ${webhook.name} failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    webhook.failureCount++;
    console.error(`[WEBHOOK] ${webhook.name} error:`, error);
    return false;
  }
}

// Trigger all matching webhooks for a signal
export async function triggerAllWebhooks(signal: AggregatedSignal): Promise<{
  triggered: number;
  success: number;
  failed: number;
}> {
  const results = { triggered: 0, success: 0, failed: 0 };

  for (const webhook of webhooks.values()) {
    if (webhook.enabled && signal.score >= webhook.minScore) {
      results.triggered++;
      const success = await triggerWebhook(webhook, signal);
      if (success) results.success++;
      else results.failed++;
    }
  }

  return results;
}

// Get webhook stats
export function getWebhookStats(): {
  total: number;
  enabled: number;
  totalSuccess: number;
  totalFailure: number;
} {
  let enabled = 0;
  let totalSuccess = 0;
  let totalFailure = 0;

  for (const webhook of webhooks.values()) {
    if (webhook.enabled) enabled++;
    totalSuccess += webhook.successCount;
    totalFailure += webhook.failureCount;
  }

  return {
    total: webhooks.size,
    enabled,
    totalSuccess,
    totalFailure
  };
}

// Test webhook with dummy signal
export async function testWebhook(webhookId: string): Promise<boolean> {
  const webhook = webhooks.get(webhookId);
  if (!webhook) return false;

  const testSignal: AggregatedSignal = {
    id: 'test-signal',
    timestamp: Date.now(),
    token: 'TestToken123',
    symbol: 'TEST',
    name: 'Test Token',
    score: 85,
    confidence: 80,
    riskLevel: 'LOW',
    sources: [{ source: 'volume-spike', weight: 1, rawScore: 85 }],
    marketData: {
      mcap: 100000,
      liquidity: 50000,
      volume5m: 10000,
      volume1h: 40000,
      priceChange5m: 5,
      priceChange1h: 15,
      age: 10
    },
    analysis: {
      narrative: ['Test'],
      strengths: ['Test signal'],
      weaknesses: [],
      recommendation: 'TEST - Webhook validation'
    }
  };

  return await triggerWebhook(webhook, testSignal);
}
