import { RawSignal } from '../types';

const DEXSCREENER_API = 'https://api.dexscreener.com';

interface DexScreenerToken {
  chainId: string;
  tokenAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  volume: {
    m5: number;
    h1: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
  };
  liquidity: {
    usd: number;
  };
  fdv: number;
  pairCreatedAt: number;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
  };
}

// Volume spike detection thresholds
const THRESHOLDS = {
  minVol5m: 10000,      // $10K minimum 5m volume
  minVolSpike: 3,       // 3x normal volume
  minBuyRatio: 0.6,     // 60% buys
  minMcap: 15000,       // $15K minimum mcap
  maxMcap: 500000,      // $500K maximum mcap
  maxAge: 60,           // 60 minutes max age
  minLiquidity: 5000,   // $5K minimum liquidity
};

async function fetchTrendingTokens(): Promise<DexScreenerToken[]> {
  try {
    // Fetch from token boosts (trending)
    const response = await fetch(`${DEXSCREENER_API}/token-boosts/latest/v1`);
    const boosts = await response.json();
    
    // Fetch details for each token
    const tokens: DexScreenerToken[] = [];
    
    for (const boost of boosts.slice(0, 30)) { // Limit to 30
      if (!boost.tokenAddress?.endsWith('pump')) continue;
      
      try {
        const detailRes = await fetch(`${DEXSCREENER_API}/latest/dex/tokens/${boost.tokenAddress}`);
        const detailData = await detailRes.json();
        const pair = detailData.pairs?.[0];
        
        if (pair && pair.chainId === 'solana') {
          tokens.push(pair);
        }
      } catch {
        continue;
      }
    }
    
    return tokens;
  } catch (error) {
    console.error('Error fetching trending tokens:', error);
    return [];
  }
}

function calculateVolumeScore(token: DexScreenerToken): number {
  let score = 50; // Base score
  
  const vol5m = token.volume?.m5 || 0;
  const vol1h = token.volume?.h1 || 0;
  const avgVol5m = vol1h / 12; // Average 5m volume in last hour
  
  // Volume spike detection
  if (avgVol5m > 0) {
    const spikeRatio = vol5m / avgVol5m;
    if (spikeRatio >= 5) score += 25;
    else if (spikeRatio >= 3) score += 15;
    else if (spikeRatio >= 2) score += 10;
  }
  
  // Buy pressure
  const buys = token.txns?.m5?.buys || 0;
  const sells = token.txns?.m5?.sells || 0;
  const total = buys + sells;
  const buyRatio = total > 0 ? buys / total : 0;
  
  if (buyRatio >= 0.75) score += 15;
  else if (buyRatio >= 0.65) score += 10;
  else if (buyRatio < 0.5) score -= 10;
  
  // Price momentum
  const priceChange = token.priceChange?.m5 || 0;
  if (priceChange >= 50) score += 10;
  else if (priceChange >= 20) score += 5;
  else if (priceChange < -20) score -= 10;
  
  // Liquidity ratio
  const mcap = token.fdv || 0;
  const liq = token.liquidity?.usd || 0;
  const liqRatio = mcap > 0 ? liq / mcap : 0;
  
  if (liqRatio >= 0.2) score += 10;
  else if (liqRatio < 0.05) score -= 15;
  
  return Math.max(0, Math.min(100, score));
}

export async function scanVolumeSpikes(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const tokens = await fetchTrendingTokens();
  const now = Date.now();
  
  for (const token of tokens) {
    const mcap = token.fdv || 0;
    const vol5m = token.volume?.m5 || 0;
    const liq = token.liquidity?.usd || 0;
    const age = Math.floor((now - (token.pairCreatedAt || now)) / 60000);
    
    // Apply filters
    if (mcap < THRESHOLDS.minMcap || mcap > THRESHOLDS.maxMcap) continue;
    if (vol5m < THRESHOLDS.minVol5m) continue;
    if (liq < THRESHOLDS.minLiquidity) continue;
    if (age > THRESHOLDS.maxAge || age < 0) continue;
    
    const buys = token.txns?.m5?.buys || 0;
    const sells = token.txns?.m5?.sells || 0;
    const buyRatio = (buys + sells) > 0 ? buys / (buys + sells) : 0;
    if (buyRatio < THRESHOLDS.minBuyRatio) continue;
    
    const score = calculateVolumeScore(token);
    
    if (score >= 60) { // Only emit signals with score >= 60
      signals.push({
        source: 'volume-spike',
        timestamp: now,
        token: token.baseToken.address,
        symbol: token.baseToken.symbol,
        name: token.baseToken.name,
        action: 'BUY',
        confidence: score,
        metadata: {
          mcap,
          volume5m: vol5m,
          volume1h: token.volume?.h1 || 0,
          liquidity: liq,
          buyRatio: Math.round(buyRatio * 100),
          priceChange5m: token.priceChange?.m5 || 0,
          age
        }
      });
    }
  }
  
  return signals;
}
