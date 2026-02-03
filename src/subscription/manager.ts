/**
 * Subscription Manager
 * Handles token-gated access to premium signals
 *
 * Tiers:
 * - FREE: Delayed signals (15 min), score >= 80 only
 * - BASIC: Delayed signals (5 min), score >= 70
 * - PRO: Real-time signals, all scores, on-chain alerts
 * - WHALE: Everything + priority API + webhooks
 */

import { Connection, PublicKey } from '@solana/web3.js';

// Subscription tiers
export interface SubscriptionTier {
  id: string;
  name: string;
  price: number; // Monthly USDC
  features: string[];
  minScore: number;
  delaySeconds: number;
  apiRateLimit: number; // requests per minute
  webhooksEnabled: boolean;
  onChainAlerts: boolean;
}

export const TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['Score 80+ signals only', '15 minute delay', 'Basic API access', '10 requests/min'],
    minScore: 80,
    delaySeconds: 900,
    apiRateLimit: 10,
    webhooksEnabled: false,
    onChainAlerts: false
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 29,
    features: [
      'Score 70+ signals',
      '5 minute delay',
      'API access',
      '30 requests/min',
      'Telegram alerts'
    ],
    minScore: 70,
    delaySeconds: 300,
    apiRateLimit: 30,
    webhooksEnabled: false,
    onChainAlerts: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    features: [
      'All signals (score 50+)',
      'Real-time access',
      'Priority API',
      '100 requests/min',
      'Telegram + Discord alerts',
      'On-chain notifications'
    ],
    minScore: 50,
    delaySeconds: 0,
    apiRateLimit: 100,
    webhooksEnabled: true,
    onChainAlerts: true
  },
  {
    id: 'whale',
    name: 'Whale',
    price: 299,
    features: [
      'Everything in Pro',
      'Unlimited API',
      'Custom webhooks',
      'Priority support',
      'Raw signal data',
      'Historical exports'
    ],
    minScore: 0,
    delaySeconds: 0,
    apiRateLimit: 1000,
    webhooksEnabled: true,
    onChainAlerts: true
  }
];

// SPL Token for subscription (would be ORACLE token or USDC)
const SUBSCRIPTION_TOKEN =
  process.env.SUBSCRIPTION_TOKEN_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC

// Minimum token holdings for each tier
const TIER_TOKEN_REQUIREMENTS: Record<string, number> = {
  free: 0,
  basic: 100, // 100 USDC worth
  pro: 500, // 500 USDC worth
  whale: 2000 // 2000 USDC worth
};

interface Subscription {
  wallet: string;
  tier: string;
  expiresAt: number;
  createdAt: number;
  tokenBalance: number;
}

// In-memory subscription cache (would be on-chain in production)
const subscriptions = new Map<string, Subscription>();

// Check subscription status for a wallet
export async function getSubscription(
  wallet: string,
  connection?: Connection
): Promise<Subscription | null> {
  // Check cache first
  const cached = subscriptions.get(wallet);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  // If no connection, return free tier
  if (!connection) {
    return {
      wallet,
      tier: 'free',
      expiresAt: Date.now() + 86400000, // 24 hours
      createdAt: Date.now(),
      tokenBalance: 0
    };
  }

  // Check on-chain token balance
  try {
    const walletPubkey = new PublicKey(wallet);
    const tokenMint = new PublicKey(SUBSCRIPTION_TOKEN);

    // Get associated token account
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPubkey, {
      mint: tokenMint
    });

    let balance = 0;
    if (tokenAccounts.value.length > 0) {
      balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
    }

    // Determine tier based on balance
    let tier = 'free';
    if (balance >= TIER_TOKEN_REQUIREMENTS.whale) tier = 'whale';
    else if (balance >= TIER_TOKEN_REQUIREMENTS.pro) tier = 'pro';
    else if (balance >= TIER_TOKEN_REQUIREMENTS.basic) tier = 'basic';

    const subscription: Subscription = {
      wallet,
      tier,
      expiresAt: Date.now() + 3600000, // Cache for 1 hour
      createdAt: Date.now(),
      tokenBalance: balance
    };

    // Cache it
    subscriptions.set(wallet, subscription);

    return subscription;
  } catch (error) {
    console.error('[SUBSCRIPTION] Error checking balance:', error);
    return {
      wallet,
      tier: 'free',
      expiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
      tokenBalance: 0
    };
  }
}

// Get tier details
export function getTier(tierId: string): SubscriptionTier | undefined {
  return TIERS.find(t => t.id === tierId);
}

// Check if wallet has access to a signal
export function hasAccess(
  subscription: Subscription | null,
  signalScore: number,
  signalAge: number
): boolean {
  const tier = getTier(subscription?.tier || 'free');
  if (!tier) return false;

  // Check score requirement
  if (signalScore < tier.minScore) return false;

  // Check delay requirement
  if (signalAge < tier.delaySeconds * 1000) return false;

  return true;
}

// Apply tier filters to signals
export function filterSignalsForTier(signals: any[], tier: SubscriptionTier): any[] {
  const now = Date.now();

  return signals.filter(signal => {
    // Score filter
    if (signal.score < tier.minScore) return false;

    // Delay filter
    const signalAge = now - signal.timestamp;
    if (signalAge < tier.delaySeconds * 1000) return false;

    return true;
  });
}

// Get all tiers for API
export function getAllTiers(): SubscriptionTier[] {
  return TIERS;
}

// Validate API access
export function validateApiAccess(apiKey: string | undefined): SubscriptionTier {
  // TODO: Implement API key validation
  // For now, return free tier
  return TIERS[0];
}

export { SUBSCRIPTION_TOKEN, TIER_TOKEN_REQUIREMENTS };
