/**
 * API Key Authentication System
 * Manages API keys and access control
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// API Key record
export interface ApiKey {
  key: string;
  keyHash: string;
  name: string;
  tier: 'free' | 'basic' | 'pro' | 'whale';
  wallet?: string;
  createdAt: number;
  lastUsed: number;
  requestCount: number;
  rateLimit: number;
  enabled: boolean;
}

// Rate limit window
interface RateLimitWindow {
  count: number;
  resetAt: number;
}

// In-memory stores
const apiKeys = new Map<string, ApiKey>();
const rateLimitWindows = new Map<string, RateLimitWindow>();

// Rate limits by tier (requests per minute)
const TIER_RATE_LIMITS: Record<string, number> = {
  free: 10,
  basic: 30,
  pro: 100,
  whale: 1000
};

// Generate API key
export function generateApiKey(
  name: string,
  tier: ApiKey['tier'] = 'free',
  wallet?: string
): { key: string; record: ApiKey } {
  const key = `oak_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = hashKey(key);

  const record: ApiKey = {
    key: key.slice(0, 8) + '...' + key.slice(-4), // Masked for display
    keyHash,
    name,
    tier,
    wallet,
    createdAt: Date.now(),
    lastUsed: 0,
    requestCount: 0,
    rateLimit: TIER_RATE_LIMITS[tier],
    enabled: true
  };

  apiKeys.set(keyHash, record);

  return { key, record };
}

// Hash API key for storage
function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Validate API key
export function validateApiKey(key: string): ApiKey | null {
  if (!key) return null;

  const keyHash = hashKey(key);
  const record = apiKeys.get(keyHash);

  if (!record || !record.enabled) return null;

  // Update usage stats
  record.lastUsed = Date.now();
  record.requestCount++;

  return record;
}

// Check rate limit
export function checkRateLimit(
  keyHash: string,
  limit: number
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const windowMs = 60000; // 1 minute

  let window = rateLimitWindows.get(keyHash);

  if (!window || now >= window.resetAt) {
    window = {
      count: 0,
      resetAt: now + windowMs
    };
    rateLimitWindows.set(keyHash, window);
  }

  window.count++;

  return {
    allowed: window.count <= limit,
    remaining: Math.max(0, limit - window.count),
    resetAt: window.resetAt
  };
}

// Express middleware for API key auth
export function apiKeyAuth(required: boolean = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query.api_key as string);

    if (!apiKey) {
      if (required) {
        return res.status(401).json({
          error: 'API key required',
          message: 'Provide API key via Authorization header or api_key query param'
        });
      }
      // Continue with default (free) tier
      (req as any).apiTier = 'free';
      (req as any).rateLimit = TIER_RATE_LIMITS.free;
      return next();
    }

    const record = validateApiKey(apiKey);

    if (!record) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or disabled'
      });
    }

    // Check rate limit
    const rateCheck = checkRateLimit(record.keyHash, record.rateLimit);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': record.rateLimit.toString(),
      'X-RateLimit-Remaining': rateCheck.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateCheck.resetAt / 1000).toString()
    });

    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Limit: ${record.rateLimit} requests per minute`,
        resetAt: rateCheck.resetAt
      });
    }

    // Attach to request
    (req as any).apiKey = record;
    (req as any).apiTier = record.tier;
    (req as any).rateLimit = record.rateLimit;

    next();
  };
}

// Get API key info (for management)
export function getApiKeyInfo(keyHash: string): Omit<ApiKey, 'keyHash'> | null {
  const record = apiKeys.get(keyHash);
  if (!record) return null;

  const { keyHash: _, ...info } = record;
  return info;
}

// List all API keys (admin)
export function listApiKeys(): Omit<ApiKey, 'keyHash'>[] {
  const keys: Omit<ApiKey, 'keyHash'>[] = [];

  for (const record of apiKeys.values()) {
    const { keyHash, ...info } = record;
    keys.push(info);
  }

  return keys;
}

// Revoke API key
export function revokeApiKey(keyHash: string): boolean {
  const record = apiKeys.get(keyHash);
  if (!record) return false;

  record.enabled = false;
  return true;
}

// Update API key tier
export function updateApiKeyTier(keyHash: string, tier: ApiKey['tier']): boolean {
  const record = apiKeys.get(keyHash);
  if (!record) return false;

  record.tier = tier;
  record.rateLimit = TIER_RATE_LIMITS[tier];
  return true;
}

// Get usage stats
export function getApiKeyStats(keyHash: string): {
  requestCount: number;
  lastUsed: number;
  tier: string;
  rateLimit: number;
} | null {
  const record = apiKeys.get(keyHash);
  if (!record) return null;

  return {
    requestCount: record.requestCount,
    lastUsed: record.lastUsed,
    tier: record.tier,
    rateLimit: record.rateLimit
  };
}

// Create default API keys for testing
export function createDefaultKeys(): void {
  // Demo key for testing
  const demo = generateApiKey('Demo Key', 'basic');
  console.log(`[AUTH] Demo API key created: ${demo.key}`);
}
