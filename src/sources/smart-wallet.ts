import { RawSignal, SignalSource } from '../types';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d079301-97d2-4ae9-81fd-e56f00a891f4';

// Tracked wallets with their win rates
const TRACKED_WALLETS: { address: string; label: string; winRate: number; source: SignalSource }[] = [
  // ELITE TIER - 70%+ Win Rate
  {
    address: '2VjYBeVsFhN4AmmHBWyorn6jAYMtvAUytsAEBnECgcuW',
    label: 'ELITE SNIPER (70% WR)',
    winRate: 0.70,
    source: 'smart-wallet-elite'
  },
  {
    address: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    label: 'ELITE WALLET',
    winRate: 0.70,
    source: 'smart-wallet-elite'
  },
  // SNIPER TIER - 40-60% Win Rate
  {
    address: '7Swrq9DbxXJDVavHYA7zSqchA97gRRSbBjfafbCayCHt',
    label: 'PUMP SNIPER (41% WR)',
    winRate: 0.41,
    source: 'smart-wallet-sniper'
  },
  {
    address: 'FqtJiuwr1d4XqMAtjBYquFgg9mKkVnJFzsiH6JNUCycr',
    label: 'FIRST BUYER (+1s)',
    winRate: 0.45,
    source: 'smart-wallet-sniper'
  },
  {
    address: 'ARu4n5mFdZogZAravu7CcizaojWnS6oqka37gdLT5SZn',
    label: 'OKX DEX SNIPER',
    winRate: 0.40,
    source: 'smart-wallet-sniper'
  },
  {
    address: 'EvErUDffH6fdYAB8zZjRxcr8obD4sNko9udQMYo2pfrn',
    label: 'EARLY BUYER +1s',
    winRate: 0.38,
    source: 'smart-wallet-sniper'
  },
  // TRACKER TIER - Useful for confluence
  {
    address: 'BndkmUnVgesmZBBpZZTBbmwQtHkPsQhQStqh5wg5nH7B',
    label: 'EARLY +8s',
    winRate: 0.35,
    source: 'smart-wallet-sniper'
  },
  {
    address: '6PZFxEGNrqCoUEuZMbFE37Ma2F7gCQFBmCfsu7XUxyh7',
    label: 'EARLY +9s',
    winRate: 0.35,
    source: 'smart-wallet-sniper'
  }
];

interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  tokenTransfers?: {
    mint: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
  }[];
}

async function fetchWalletTransactions(wallet: string, limit = 20): Promise<HeliusTransaction[]> {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`
    );
    return await response.json();
  } catch (error) {
    console.error(`Error fetching transactions for ${wallet}:`, error);
    return [];
  }
}

async function getTokenMetadata(mint: string): Promise<{ name: string; symbol: string }> {
  try {
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'metadata',
        method: 'getAsset',
        params: { id: mint }
      })
    });
    const data = await response.json();
    const meta = data.result?.content?.metadata;
    return {
      name: meta?.name || 'Unknown',
      symbol: meta?.symbol || 'UNKNOWN'
    };
  } catch {
    return { name: 'Unknown', symbol: 'UNKNOWN' };
  }
}

function isPumpToken(mint: string): boolean {
  return mint.endsWith('pump');
}

export async function scanSmartWallets(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();
  const cutoffTime = now - (30 * 60 * 1000); // Last 30 minutes
  
  for (const wallet of TRACKED_WALLETS) {
    const transactions = await fetchWalletTransactions(wallet.address);
    
    for (const tx of transactions) {
      // Skip old transactions
      if (tx.timestamp * 1000 < cutoffTime) continue;
      
      // Look for token buys
      const buys = tx.tokenTransfers?.filter(t => 
        t.toUserAccount === wallet.address && 
        isPumpToken(t.mint)
      ) || [];
      
      for (const buy of buys) {
        const metadata = await getTokenMetadata(buy.mint);
        
        signals.push({
          source: wallet.source,
          timestamp: tx.timestamp * 1000,
          token: buy.mint,
          symbol: metadata.symbol,
          name: metadata.name,
          action: 'BUY',
          confidence: Math.round(wallet.winRate * 100),
          metadata: {
            wallet: wallet.address,
            walletLabel: wallet.label,
            txSignature: tx.signature,
            amount: buy.tokenAmount
          }
        });
      }
    }
  }
  
  return signals;
}

export { TRACKED_WALLETS };
