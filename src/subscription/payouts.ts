/**
 * Payouts System
 * Handles revenue distribution from subscriptions
 *
 * Revenue Split:
 * - 70% to signal providers (based on performance)
 * - 20% to treasury (development)
 * - 10% to stakers (future)
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

// Revenue distribution percentages
export const REVENUE_SPLIT = {
  providers: 0.7, // 70% to signal providers
  treasury: 0.2, // 20% to treasury
  stakers: 0.1 // 10% to stakers
};

// Treasury wallet
const TREASURY_WALLET = process.env.TREASURY_WALLET || '11111111111111111111111111111111';

// Payout record
export interface PayoutRecord {
  id: string;
  recipient: string;
  amount: number; // in lamports or token units
  currency: 'SOL' | 'USDC';
  reason: string;
  timestamp: number;
  txSignature?: string;
  status: 'pending' | 'completed' | 'failed';
}

// Provider performance for payout calculation
export interface ProviderPerformance {
  wallet: string;
  signalsProvided: number;
  totalScore: number;
  wins: number;
  losses: number;
  winRate: number;
  revenue: number;
}

// In-memory payout history
const payoutHistory: PayoutRecord[] = [];

// Calculate provider payouts based on performance
export function calculateProviderPayouts(
  totalRevenue: number,
  providers: ProviderPerformance[]
): Map<string, number> {
  const payouts = new Map<string, number>();
  const providerPool = totalRevenue * REVENUE_SPLIT.providers;

  // Calculate total weighted score
  let totalWeight = 0;
  for (const provider of providers) {
    // Weight = signals * winRate * avgScore
    const avgScore =
      provider.signalsProvided > 0 ? provider.totalScore / provider.signalsProvided : 0;
    const weight = provider.signalsProvided * provider.winRate * (avgScore / 100);
    totalWeight += weight;
  }

  if (totalWeight === 0) return payouts;

  // Distribute based on weight
  for (const provider of providers) {
    const avgScore =
      provider.signalsProvided > 0 ? provider.totalScore / provider.signalsProvided : 0;
    const weight = provider.signalsProvided * provider.winRate * (avgScore / 100);
    const share = (weight / totalWeight) * providerPool;

    if (share > 0) {
      payouts.set(provider.wallet, share);
    }
  }

  return payouts;
}

// Calculate full revenue distribution
export function calculateDistribution(
  totalRevenue: number,
  providers: ProviderPerformance[]
): {
  treasury: number;
  stakers: number;
  providers: Map<string, number>;
  total: number;
} {
  const treasury = totalRevenue * REVENUE_SPLIT.treasury;
  const stakers = totalRevenue * REVENUE_SPLIT.stakers;
  const providerPayouts = calculateProviderPayouts(totalRevenue, providers);

  return {
    treasury,
    stakers,
    providers: providerPayouts,
    total: totalRevenue
  };
}

// Create payout transaction (SOL)
export async function createSolPayoutTx(
  connection: Connection,
  fromWallet: PublicKey,
  toWallet: PublicKey,
  amountSol: number
): Promise<Transaction> {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromWallet,
      toPubkey: toWallet,
      lamports: Math.floor(amountSol * LAMPORTS_PER_SOL)
    })
  );

  transaction.feePayer = fromWallet;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  return transaction;
}

// Record a payout
export function recordPayout(payout: Omit<PayoutRecord, 'id' | 'timestamp'>): PayoutRecord {
  const record: PayoutRecord = {
    ...payout,
    id: `payout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now()
  };

  payoutHistory.push(record);
  return record;
}

// Get payout history
export function getPayoutHistory(wallet?: string): PayoutRecord[] {
  if (wallet) {
    return payoutHistory.filter(p => p.recipient === wallet);
  }
  return [...payoutHistory];
}

// Get pending payouts
export function getPendingPayouts(): PayoutRecord[] {
  return payoutHistory.filter(p => p.status === 'pending');
}

// Update payout status
export function updatePayoutStatus(
  payoutId: string,
  status: PayoutRecord['status'],
  txSignature?: string
): boolean {
  const payout = payoutHistory.find(p => p.id === payoutId);
  if (!payout) return false;

  payout.status = status;
  if (txSignature) payout.txSignature = txSignature;

  return true;
}

// Get total payouts by status
export function getPayoutStats(): {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  totalAmountSol: number;
  totalAmountUsdc: number;
} {
  const stats = {
    total: payoutHistory.length,
    completed: 0,
    pending: 0,
    failed: 0,
    totalAmountSol: 0,
    totalAmountUsdc: 0
  };

  for (const payout of payoutHistory) {
    if (payout.status === 'completed') {
      stats.completed++;
      if (payout.currency === 'SOL') {
        stats.totalAmountSol += payout.amount;
      } else {
        stats.totalAmountUsdc += payout.amount;
      }
    } else if (payout.status === 'pending') {
      stats.pending++;
    } else {
      stats.failed++;
    }
  }

  return stats;
}

// Export for API
export { TREASURY_WALLET };
