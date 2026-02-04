/**
 * ORACLE Alpha - Live Smart Wallet Monitor
 * Real-time monitoring and auto-trading
 */

import autoTrader from './auto-trader';

const HELIUS_API_KEY = '6a47f8ad-5e41-4c1b-ac2b-e34b8079299e';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Elite smart wallets to monitor (proven winners)
const ELITE_WALLETS = [
  'Ai4zqY7gDmUqB1GWVh6F9UYm1QrXRwpNvkXkLPQYAyWS', // Top trader 1
  'DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm', // Top trader 2
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2', // Top trader 3
  '7rhxnLV8C8cx3PrR7E5RhPz8xVwmYB1yoKmPpfJe6GUr', // Top trader 4
  'FUMBPDuDsdM5G8cccwRBH6T1bLVHH9JHTCgtsXFvrVvE', // Top trader 5
];

// Known profitable snipers
const SNIPER_WALLETS = [
  'BQ72nSv9f3PRyRKCBnHLVrerrv37CYTHm5h3s9VSGQDV', // Sniper 1
  '2Ywh9Xe8CDnwEvR2F4QEwbLpjYJSLHpAZn9gMAjcWgvr', // Sniper 2
  'orcACRJYTFjTeo2pV8TfYRTpmqfoYgbVi9GeANXTCc8',  // Sniper 3
];

interface WalletTx {
  signature: string;
  timestamp: number;
  wallet: string;
  walletType: 'elite' | 'sniper';
  action: 'BUY' | 'SELL';
  token: string;
  tokenSymbol?: string;
  amount: number;
  solAmount: number;
  price?: number;
  mcap?: number;
}

interface MonitorState {
  isRunning: boolean;
  lastCheck: number;
  processedTxs: Set<string>;
  recentBuys: WalletTx[];
  signalsGenerated: number;
  tradesExecuted: number;
}

const state: MonitorState = {
  isRunning: false,
  lastCheck: 0,
  processedTxs: new Set(),
  recentBuys: [],
  signalsGenerated: 0,
  tradesExecuted: 0
};

let monitorInterval: NodeJS.Timeout | null = null;

// Fetch recent transactions for a wallet
async function getWalletTransactions(wallet: string, limit: number = 10): Promise<any[]> {
  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [wallet, { limit }]
      })
    });
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error(`[MONITOR] Error fetching txs for ${wallet}:`, error);
    return [];
  }
}

// Parse transaction to detect swaps
async function parseTransaction(signature: string): Promise<any | null> {
  try {
    const response = await fetch(`https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: [signature] })
    });
    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error(`[MONITOR] Error parsing tx ${signature}:`, error);
    return null;
  }
}

// Detect if transaction is a token buy
function detectBuy(parsedTx: any, wallet: string): WalletTx | null {
  if (!parsedTx || parsedTx.type !== 'SWAP') return null;
  
  const events = parsedTx.events?.swap;
  if (!events) return null;

  // Check if SOL was spent (buy)
  const nativeInput = events.nativeInput;
  const tokenOutputs = events.tokenOutputs || [];
  
  if (nativeInput && nativeInput.account === wallet && tokenOutputs.length > 0) {
    const output = tokenOutputs[0];
    return {
      signature: parsedTx.signature,
      timestamp: parsedTx.timestamp * 1000,
      wallet,
      walletType: ELITE_WALLETS.includes(wallet) ? 'elite' : 'sniper',
      action: 'BUY',
      token: output.mint,
      tokenSymbol: output.tokenStandard?.symbol || 'UNKNOWN',
      amount: output.rawTokenAmount?.tokenAmount || 0,
      solAmount: (nativeInput.amount || 0) / 1e9,
    };
  }

  return null;
}

// Get token info from DexScreener
async function getTokenInfo(mint: string): Promise<any> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const data = await res.json();
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      return {
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
        name: pair.baseToken?.name || 'Unknown',
        price: parseFloat(pair.priceUsd) || 0,
        mcap: pair.marketCap || pair.fdv || 0,
        liquidity: pair.liquidity?.usd || 0,
        volume24h: pair.volume?.h24 || 0,
        priceChange24h: pair.priceChange?.h24 || 0,
        txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
        pairAddress: pair.pairAddress
      };
    }
    return null;
  } catch (error) {
    console.error(`[MONITOR] Error fetching token info for ${mint}:`, error);
    return null;
  }
}

// Check for confluence (multiple wallets buying same token)
function checkConfluence(token: string, recentMinutes: number = 30): { count: number; wallets: string[] } {
  const cutoff = Date.now() - (recentMinutes * 60 * 1000);
  const recentBuysForToken = state.recentBuys.filter(
    b => b.token === token && b.timestamp > cutoff
  );
  
  const uniqueWallets = [...new Set(recentBuysForToken.map(b => b.wallet))];
  return { count: uniqueWallets.length, wallets: uniqueWallets };
}

// Generate signal from wallet activity
async function generateSignal(buy: WalletTx): Promise<any | null> {
  const tokenInfo = await getTokenInfo(buy.token);
  if (!tokenInfo) return null;

  // Skip if mcap too high (>$10M) or too low (<$10K)
  if (tokenInfo.mcap > 10_000_000 || tokenInfo.mcap < 10_000) {
    console.log(`[MONITOR] Skipping ${tokenInfo.symbol} - mcap ${tokenInfo.mcap}`);
    return null;
  }

  // Skip if liquidity too low
  if (tokenInfo.liquidity < 5000) {
    console.log(`[MONITOR] Skipping ${tokenInfo.symbol} - low liquidity ${tokenInfo.liquidity}`);
    return null;
  }

  // Check confluence
  const confluence = checkConfluence(buy.token);
  
  // Calculate score
  let score = 50; // Base score

  // Wallet type bonus
  if (buy.walletType === 'elite') score += 20;
  if (buy.walletType === 'sniper') score += 15;

  // Size bonus (bigger buy = more confident)
  if (buy.solAmount >= 1) score += 15;
  else if (buy.solAmount >= 0.5) score += 10;
  else if (buy.solAmount >= 0.2) score += 5;

  // Confluence bonus
  score += confluence.count * 10;

  // Liquidity bonus
  if (tokenInfo.liquidity >= 50000) score += 10;
  else if (tokenInfo.liquidity >= 20000) score += 5;

  // Volume bonus
  if (tokenInfo.volume24h >= 100000) score += 5;

  // Cap at 100
  score = Math.min(score, 100);

  // Determine risk level
  let riskLevel = 'HIGH';
  if (tokenInfo.liquidity >= 50000 && tokenInfo.mcap >= 100000) riskLevel = 'LOW';
  else if (tokenInfo.liquidity >= 20000 && tokenInfo.mcap >= 50000) riskLevel = 'MEDIUM';

  const signal = {
    id: `live_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    token: buy.token,
    symbol: tokenInfo.symbol,
    name: tokenInfo.name,
    price: tokenInfo.price,
    mcap: tokenInfo.mcap,
    liquidity: tokenInfo.liquidity,
    volume24h: tokenInfo.volume24h,
    score,
    riskLevel,
    sources: [
      {
        type: buy.walletType === 'elite' ? 'smart-wallet-elite' : 'smart-wallet-sniper',
        wallet: buy.wallet.slice(0, 8) + '...',
        amount: buy.solAmount,
        timestamp: buy.timestamp
      }
    ],
    confluence: confluence.count,
    reason: `${buy.walletType.toUpperCase()} wallet bought ${buy.solAmount.toFixed(2)} SOL. ${confluence.count > 1 ? `${confluence.count} wallets bought recently!` : ''}`,
    safetyData: {
      honeypotRisk: { isHoneypot: false },
      bundleScore: 0,
      washScore: 0
    }
  };

  // Add more sources if confluence
  if (confluence.count > 1) {
    confluence.wallets.slice(0, 3).forEach((w, i) => {
      if (w !== buy.wallet) {
        signal.sources.push({
          type: 'smart-wallet-confluence',
          wallet: w.slice(0, 8) + '...',
          amount: 0,
          timestamp: Date.now()
        });
      }
    });
  }

  return signal;
}

// Main monitoring loop
async function monitorLoop(): Promise<void> {
  if (!state.isRunning) return;

  console.log(`[MONITOR] Checking wallets... (${new Date().toISOString()})`);

  const allWallets = [...ELITE_WALLETS, ...SNIPER_WALLETS];
  
  for (const wallet of allWallets) {
    try {
      const txs = await getWalletTransactions(wallet, 5);
      
      for (const tx of txs) {
        // Skip if already processed
        if (state.processedTxs.has(tx.signature)) continue;
        state.processedTxs.add(tx.signature);

        // Skip old transactions (>10 min)
        const txAge = Date.now() - (tx.blockTime * 1000);
        if (txAge > 10 * 60 * 1000) continue;

        // Parse transaction
        const parsed = await parseTransaction(tx.signature);
        if (!parsed) continue;

        // Detect buy
        const buy = detectBuy(parsed, wallet);
        if (!buy) continue;

        console.log(`[MONITOR] 🔔 ${buy.walletType.toUpperCase()} buy detected: ${buy.solAmount.toFixed(2)} SOL -> ${buy.token.slice(0, 8)}...`);

        // Add to recent buys
        state.recentBuys.push(buy);
        // Keep only last 100
        if (state.recentBuys.length > 100) {
          state.recentBuys = state.recentBuys.slice(-100);
        }

        // Generate signal
        const signal = await generateSignal(buy);
        if (!signal) continue;

        state.signalsGenerated++;
        console.log(`[MONITOR] 📊 Signal generated: ${signal.symbol} | Score: ${signal.score} | Risk: ${signal.riskLevel}`);

        // Check if tradeable
        const traderStatus = autoTrader.getTradingStatus();
        if (!traderStatus.isRunning) {
          console.log(`[MONITOR] Auto-trader not running, skipping execution`);
          continue;
        }

        const checkResult = autoTrader.isSignalTradeable(signal);
        if (!checkResult.tradeable) {
          console.log(`[MONITOR] Signal not tradeable: ${checkResult.reason}`);
          continue;
        }

        // Calculate position and execute
        const positionSize = await autoTrader.calculatePositionSize(signal);
        if (positionSize <= 0) {
          console.log(`[MONITOR] Position size too small`);
          continue;
        }

        console.log(`[MONITOR] 🚀 EXECUTING TRADE: ${positionSize} SOL -> ${signal.symbol}`);
        const trade = await autoTrader.executeBuy(signal, positionSize);
        
        if (trade?.status === 'executed') {
          state.tradesExecuted++;
          console.log(`[MONITOR] ✅ Trade executed: ${trade.txSignature}`);
        } else {
          console.log(`[MONITOR] ❌ Trade failed: ${trade?.reason || 'Unknown'}`);
        }

        // Small delay between trades
        await new Promise(r => setTimeout(r, 2000));
      }

      // Rate limit - small delay between wallets
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      console.error(`[MONITOR] Error processing wallet ${wallet}:`, error);
    }
  }

  // Check existing positions
  await autoTrader.checkPositions();

  state.lastCheck = Date.now();
}

// Start monitoring
export function startLiveMonitor(intervalMs: number = 30000): void {
  if (state.isRunning) {
    console.log('[MONITOR] Already running');
    return;
  }

  state.isRunning = true;
  console.log(`[MONITOR] 🟢 Starting live monitor (interval: ${intervalMs/1000}s)`);
  console.log(`[MONITOR] Watching ${ELITE_WALLETS.length} elite + ${SNIPER_WALLETS.length} sniper wallets`);

  // Initial run
  monitorLoop();

  // Set interval
  monitorInterval = setInterval(monitorLoop, intervalMs);
}

// Stop monitoring
export function stopLiveMonitor(): void {
  state.isRunning = false;
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  console.log('[MONITOR] 🔴 Stopped live monitor');
}

// Get monitor status
export function getMonitorStatus(): MonitorState & { eliteWallets: number; sniperWallets: number } {
  return {
    ...state,
    processedTxs: new Set(), // Don't expose full set
    eliteWallets: ELITE_WALLETS.length,
    sniperWallets: SNIPER_WALLETS.length
  };
}

// Add wallet to monitor
export function addWalletToMonitor(wallet: string, type: 'elite' | 'sniper'): void {
  if (type === 'elite' && !ELITE_WALLETS.includes(wallet)) {
    ELITE_WALLETS.push(wallet);
  } else if (type === 'sniper' && !SNIPER_WALLETS.includes(wallet)) {
    SNIPER_WALLETS.push(wallet);
  }
}

// Get recent buys
export function getRecentBuys(limit: number = 20): WalletTx[] {
  return state.recentBuys.slice(-limit);
}

export default {
  startLiveMonitor,
  stopLiveMonitor,
  getMonitorStatus,
  addWalletToMonitor,
  getRecentBuys
};
