/**
 * Real Trading Module
 * Builds swap transactions using Jupiter API v6
 * 
 * Flow:
 * 1. Get quote from Jupiter
 * 2. Build swap transaction
 * 3. Simulate transaction
 * 4. Return serialized transaction for client signing
 * 5. Client signs and submits
 * 6. Confirm transaction
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import crypto from 'crypto';
import {
  SwapParams,
  SwapQuote,
  SwapTransaction,
  SwapResult,
  SafetyCheck,
  TransactionRecord,
  SimulationResult,
  PRIORITY_FEE_PRESETS,
  SLIPPAGE_PRESETS,
  SOL_MINT,
  USDC_MINT,
  LAMPORTS_PER_SOL,
} from './types';
import { getConnection, fetchTokenPrice, getTokenMetadata, recordTransaction } from './connect';
import { detectHoneypot, getQuickHoneypotStatus } from '../detection/honeypot';

// Jupiter API endpoints
const JUPITER_API = 'https://quote-api.jup.ag/v6';
const JUPITER_PRICE_API = 'https://price.jup.ag/v6';

// Quote cache (short TTL)
const quoteCache = new Map<string, { quote: any; timestamp: number }>();
const QUOTE_CACHE_TTL = 10000; // 10 seconds

/**
 * Get swap quote from Jupiter
 */
export async function getSwapQuote(params: SwapParams): Promise<SwapQuote | null> {
  const { inputMint, outputMint, amount, slippageBps } = params;
  
  // Get token metadata
  const inputMeta = await getTokenMetadata(inputMint);
  const outputMeta = await getTokenMetadata(outputMint);
  
  // Convert amount to smallest units
  const amountInSmallest = Math.floor(amount * Math.pow(10, inputMeta.decimals)).toString();
  
  try {
    // Build quote request
    const queryParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amountInSmallest,
      slippageBps: slippageBps.toString(),
      swapMode: 'ExactIn',
    });
    
    console.log(`[TRADE] Getting quote: ${inputMeta.symbol} -> ${outputMeta.symbol}, amount: ${amount}`);
    
    const response = await fetch(`${JUPITER_API}/quote?${queryParams.toString()}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TRADE] Quote error: ${response.status} - ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    
    // Calculate minimum received
    const outputAmount = BigInt(data.outAmount);
    const minReceived = (outputAmount * BigInt(10000 - slippageBps)) / BigInt(10000);
    
    // Parse route info
    const routes: SwapQuote['route'] = (data.routePlan || []).map((r: any) => ({
      label: r.swapInfo?.label || 'Unknown',
      inputMint: r.swapInfo?.inputMint || inputMint,
      outputMint: r.swapInfo?.outputMint || outputMint,
      percent: r.percent || 100,
    }));
    
    // Generate quote ID
    const quoteId = `quote_${crypto.randomBytes(8).toString('hex')}`;
    
    // Cache the raw quote for later use in building transaction
    quoteCache.set(quoteId, { quote: data, timestamp: Date.now() });
    
    const quote: SwapQuote = {
      inputMint,
      outputMint,
      inputAmount: amountInSmallest,
      outputAmount: data.outAmount,
      inputSymbol: inputMeta.symbol,
      outputSymbol: outputMeta.symbol,
      inputDecimals: inputMeta.decimals,
      outputDecimals: outputMeta.decimals,
      priceImpactPct: parseFloat(data.priceImpactPct || '0'),
      slippageBps,
      minimumReceived: minReceived.toString(),
      route: routes,
      estimatedFeesSol: 0.000005 + (params.priorityFee ? getPriorityFeeAmount(params.priorityFee) : 0),
      expiresAt: Date.now() + 30000, // 30 second validity
      quoteId,
    };
    
    console.log(`[TRADE] Quote: ${amount} ${inputMeta.symbol} -> ${parseFloat(data.outAmount) / Math.pow(10, outputMeta.decimals)} ${outputMeta.symbol} (impact: ${quote.priceImpactPct}%)`);
    
    return quote;
  } catch (error) {
    console.error('[TRADE] Failed to get quote:', error);
    return null;
  }
}

/**
 * Build swap transaction from quote
 */
export async function buildSwapTransaction(
  quoteId: string,
  userPublicKey: string,
  priorityFee?: 'low' | 'medium' | 'high' | 'turbo' | number
): Promise<SwapTransaction | null> {
  const cached = quoteCache.get(quoteId);
  if (!cached) {
    console.error('[TRADE] Quote not found or expired');
    return null;
  }
  
  // Check if quote is still valid
  if (Date.now() - cached.timestamp > 30000) {
    quoteCache.delete(quoteId);
    console.error('[TRADE] Quote expired');
    return null;
  }
  
  const quoteResponse = cached.quote;
  
  try {
    // Calculate priority fee
    let computeUnitPriceMicroLamports: number = PRIORITY_FEE_PRESETS.medium;
    if (typeof priorityFee === 'number') {
      computeUnitPriceMicroLamports = priorityFee;
    } else if (priorityFee && priorityFee in PRIORITY_FEE_PRESETS) {
      computeUnitPriceMicroLamports = PRIORITY_FEE_PRESETS[priorityFee as keyof typeof PRIORITY_FEE_PRESETS];
    }
    
    // Build swap transaction
    const swapRequest = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      dynamicComputeUnitLimit: true,
      skipUserAccountsRpcCalls: false,
      prioritizationFeeLamports: computeUnitPriceMicroLamports * 200000 / 1000000, // Approx for 200k CUs
    };
    
    console.log(`[TRADE] Building swap transaction for ${userPublicKey.substring(0, 8)}...`);
    
    const response = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(swapRequest),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TRADE] Swap build error: ${response.status} - ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.swapTransaction) {
      console.error('[TRADE] No swap transaction in response');
      return null;
    }
    
    // Get latest blockhash
    const conn = getConnection();
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('finalized');
    
    // Simulate transaction
    const simulation = await simulateTransaction(data.swapTransaction, conn);
    
    const swapTx: SwapTransaction = {
      serializedTransaction: data.swapTransaction,
      blockhash,
      lastValidBlockHeight,
      quoteId,
      simulation,
    };
    
    console.log(`[TRADE] Transaction built successfully (simulation: ${simulation.success ? 'OK' : 'FAILED'})`);
    
    return swapTx;
  } catch (error) {
    console.error('[TRADE] Failed to build swap transaction:', error);
    return null;
  }
}

/**
 * Simulate a transaction
 */
async function simulateTransaction(base64Transaction: string, connection: Connection): Promise<SimulationResult> {
  try {
    const txBuffer = Buffer.from(base64Transaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuffer);
    
    const simulation = await connection.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      commitment: 'processed',
    });
    
    if (simulation.value.err) {
      return {
        success: false,
        logs: simulation.value.logs || [],
        error: JSON.stringify(simulation.value.err),
      };
    }
    
    return {
      success: true,
      logs: simulation.value.logs || [],
      unitsConsumed: simulation.value.unitsConsumed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Simulation failed',
    };
  }
}

/**
 * Confirm a submitted transaction
 */
export async function confirmTransaction(
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
  userPublicKey: string,
  quote: SwapQuote
): Promise<SwapResult> {
  const conn = getConnection();
  
  try {
    console.log(`[TRADE] Confirming transaction: ${signature.substring(0, 16)}...`);
    
    const confirmation = await conn.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      'confirmed'
    );
    
    if (confirmation.value.err) {
      // Record failed transaction
      const txRecord: TransactionRecord = {
        id: `tx_${crypto.randomBytes(8).toString('hex')}`,
        signature,
        type: 'swap',
        status: 'failed',
        timestamp: Date.now(),
        inputMint: quote.inputMint,
        outputMint: quote.outputMint,
        inputAmount: parseFloat(quote.inputAmount) / Math.pow(10, quote.inputDecimals),
        outputAmount: 0,
        inputSymbol: quote.inputSymbol,
        outputSymbol: quote.outputSymbol,
        error: JSON.stringify(confirmation.value.err),
      };
      recordTransaction(userPublicKey, txRecord);
      
      return {
        success: false,
        error: 'Transaction failed on-chain',
        inputAmount: parseFloat(quote.inputAmount) / Math.pow(10, quote.inputDecimals),
        outputAmount: 0,
        inputSymbol: quote.inputSymbol,
        outputSymbol: quote.outputSymbol,
        priceImpact: quote.priceImpactPct,
      };
    }
    
    // Transaction confirmed
    const inputAmount = parseFloat(quote.inputAmount) / Math.pow(10, quote.inputDecimals);
    const outputAmount = parseFloat(quote.outputAmount) / Math.pow(10, quote.outputDecimals);
    
    // Record successful transaction
    const txRecord: TransactionRecord = {
      id: `tx_${crypto.randomBytes(8).toString('hex')}`,
      signature,
      type: 'swap',
      status: 'confirmed',
      timestamp: Date.now(),
      confirmedAt: Date.now(),
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inputAmount,
      outputAmount,
      inputSymbol: quote.inputSymbol,
      outputSymbol: quote.outputSymbol,
      fee: quote.estimatedFeesSol,
    };
    recordTransaction(userPublicKey, txRecord);
    
    console.log(`[TRADE] ✅ Swap confirmed: ${inputAmount} ${quote.inputSymbol} -> ${outputAmount} ${quote.outputSymbol}`);
    
    return {
      success: true,
      signature,
      inputAmount,
      outputAmount,
      inputSymbol: quote.inputSymbol,
      outputSymbol: quote.outputSymbol,
      priceImpact: quote.priceImpactPct,
      explorerUrl: `https://solscan.io/tx/${signature}`,
      confirmedAt: Date.now(),
    };
  } catch (error) {
    console.error('[TRADE] Confirmation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm transaction',
      inputAmount: parseFloat(quote.inputAmount) / Math.pow(10, quote.inputDecimals),
      outputAmount: 0,
      inputSymbol: quote.inputSymbol,
      outputSymbol: quote.outputSymbol,
      priceImpact: quote.priceImpactPct,
    };
  }
}

/**
 * Perform safety checks before trading
 */
export async function performSafetyChecks(
  tokenMint: string,
  inputAmount: number,
  slippageBps: number
): Promise<SafetyCheck> {
  const checks: SafetyCheck['checks'] = {
    honeypot: { passed: true },
    liquidity: { passed: true },
    concentration: { passed: true },
    priceImpact: { passed: true },
    slippageWarning: { passed: true },
    largeAmountWarning: { passed: true },
  };
  const warnings: string[] = [];
  
  try {
    // 1. Honeypot check
    const honeypotStatus = getQuickHoneypotStatus(tokenMint);
    if (honeypotStatus) {
      if (honeypotStatus.isHoneypot) {
        checks.honeypot = { passed: false, warning: '⚠️ Potential honeypot detected!' };
        warnings.push('Token may be a honeypot - trading restricted');
      } else if (honeypotStatus.riskLevel === 'HIGH_RISK' || honeypotStatus.riskLevel === 'HONEYPOT') {
        checks.honeypot = { passed: true, warning: `⚠️ High risk token (${honeypotStatus.riskLevel})` };
        warnings.push(`Token has ${honeypotStatus.riskLevel} risk level`);
      }
    }
    
    // 2. Liquidity check (via DexScreener)
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const liquidity = data.pairs[0].liquidity?.usd || 0;
          checks.liquidity.value = liquidity;
          
          if (liquidity < 1000) {
            checks.liquidity = { passed: false, value: liquidity, warning: '⚠️ Very low liquidity (< $1K)' };
            warnings.push('Extremely low liquidity - high slippage expected');
          } else if (liquidity < 10000) {
            checks.liquidity = { passed: true, value: liquidity, warning: '⚠️ Low liquidity (< $10K)' };
            warnings.push('Low liquidity - proceed with caution');
          }
          
          // Check if trade amount is >1% of liquidity
          const solPrice = await fetchTokenPrice(SOL_MINT);
          const tradeValueUsd = inputAmount * solPrice;
          if (liquidity > 0 && tradeValueUsd / liquidity > 0.01) {
            warnings.push(`Trade is ${((tradeValueUsd / liquidity) * 100).toFixed(1)}% of liquidity`);
          }
        }
      }
    } catch (e) {
      // Ignore liquidity check errors
    }
    
    // 3. Slippage warning
    if (slippageBps > SLIPPAGE_PRESETS.high) {
      checks.slippageWarning = { passed: true, warning: `High slippage setting: ${slippageBps / 100}%` };
      warnings.push(`Using high slippage: ${slippageBps / 100}%`);
    }
    
    // 4. Large amount warning (> 1 SOL)
    if (inputAmount > 1) {
      checks.largeAmountWarning = { passed: true, warning: `Large trade: ${inputAmount} SOL` };
      warnings.push(`Large trade amount: ${inputAmount} SOL`);
    }
    if (inputAmount > 10) {
      checks.largeAmountWarning = { passed: true, warning: `⚠️ Very large trade: ${inputAmount} SOL` };
      warnings.push(`Very large trade - double-check before proceeding`);
    }
    
  } catch (error) {
    console.error('[TRADE] Safety check error:', error);
  }
  
  // Determine overall risk
  const failedChecks = Object.values(checks).filter(c => !c.passed).length;
  let overallRisk: SafetyCheck['overallRisk'] = 'low';
  let canProceed = true;
  
  if (failedChecks >= 2 || !checks.honeypot.passed) {
    overallRisk = 'extreme';
    canProceed = false;
  } else if (failedChecks === 1 || !checks.liquidity.passed) {
    overallRisk = 'high';
  } else if (warnings.length >= 3) {
    overallRisk = 'medium';
  }
  
  return {
    passed: failedChecks === 0,
    checks,
    overallRisk,
    canProceed,
    warnings,
  };
}

/**
 * Get priority fee amount in SOL
 */
function getPriorityFeeAmount(priorityFee: 'low' | 'medium' | 'high' | 'turbo' | number): number {
  const microLamports = typeof priorityFee === 'number' 
    ? priorityFee 
    : PRIORITY_FEE_PRESETS[priorityFee];
  // Assuming ~200k compute units
  return (microLamports * 200000) / 1e6 / LAMPORTS_PER_SOL;
}

/**
 * Quick quote for UI display
 */
export async function getQuickQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 100
): Promise<{ outputAmount: number; priceImpact: number; minReceived: number } | null> {
  const quote = await getSwapQuote({
    inputMint,
    outputMint,
    amount,
    slippageBps,
  });
  
  if (!quote) return null;
  
  return {
    outputAmount: parseFloat(quote.outputAmount) / Math.pow(10, quote.outputDecimals),
    priceImpact: quote.priceImpactPct,
    minReceived: parseFloat(quote.minimumReceived) / Math.pow(10, quote.outputDecimals),
  };
}

/**
 * Get stored quote by ID
 */
export function getStoredQuote(quoteId: string): SwapQuote | null {
  const cached = quoteCache.get(quoteId);
  if (!cached) return null;
  
  // We need to reconstruct the SwapQuote from raw data
  // For now, return null - the frontend should refetch if needed
  return null;
}

/**
 * Clean up expired quotes
 */
export function cleanupExpiredQuotes(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [id, cached] of quoteCache) {
    if (now - cached.timestamp > QUOTE_CACHE_TTL) {
      quoteCache.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}

// Clean up quotes every minute
setInterval(cleanupExpiredQuotes, 60000);

// Export presets for API
export { PRIORITY_FEE_PRESETS, SLIPPAGE_PRESETS };
