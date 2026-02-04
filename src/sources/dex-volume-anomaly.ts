import { RawSignal } from '../types';

// DEX Volume Anomaly Detector
// Detects unusual volume patterns that may indicate smart money accumulation

interface VolumeData {
  token: string;
  symbol: string;
  name: string;
  volume5m: number;
  volume1h: number;
  volume6h: number;
  volume24h: number;
  buys5m: number;
  sells5m: number;
  buys1h: number;
  sells1h: number;
  mcap: number;
  liquidity: number;
  priceChange5m: number;
  priceChange1h: number;
  age: number; // minutes
}

interface VolumeAnomaly {
  type: 'SPIKE' | 'ACCELERATION' | 'ABSORPTION' | 'STEALTH';
  strength: number; // 0-1
  description: string;
}

// Thresholds for anomaly detection
const VOLUME_SPIKE_MULTIPLIER = 3; // 3x normal = spike
const ACCELERATION_THRESHOLD = 2; // 5m vol 2x what 1h pace suggests
const ABSORPTION_BUY_RATIO = 0.75; // 75%+ buys while price flat/up
const STEALTH_VOLUME_MCAP_RATIO = 0.1; // 10%+ volume/mcap in 1h

// Detect volume anomalies
function detectAnomalies(data: VolumeData): VolumeAnomaly[] {
  const anomalies: VolumeAnomaly[] = [];
  
  // 1. Volume Spike: Recent volume much higher than average
  if (data.volume1h > 0 && data.volume24h > 0) {
    const avgHourlyVol = data.volume24h / 24;
    const spikeMultiplier = data.volume1h / avgHourlyVol;
    
    if (spikeMultiplier >= VOLUME_SPIKE_MULTIPLIER) {
      anomalies.push({
        type: 'SPIKE',
        strength: Math.min(1, spikeMultiplier / 10),
        description: `${spikeMultiplier.toFixed(1)}x normal hourly volume`
      });
    }
  }
  
  // 2. Volume Acceleration: 5m volume suggests acceleration
  if (data.volume5m > 0 && data.volume1h > 0) {
    const expected5mVol = data.volume1h / 12; // 5 min is 1/12 of hour
    const acceleration = data.volume5m / expected5mVol;
    
    if (acceleration >= ACCELERATION_THRESHOLD) {
      anomalies.push({
        type: 'ACCELERATION',
        strength: Math.min(1, acceleration / 5),
        description: `Volume accelerating ${acceleration.toFixed(1)}x`
      });
    }
  }
  
  // 3. Absorption: Heavy buying with minimal price impact (big player accumulating)
  const totalTx5m = data.buys5m + data.sells5m;
  if (totalTx5m >= 5) {
    const buyRatio = data.buys5m / totalTx5m;
    
    // Strong buy pressure with contained price
    if (buyRatio >= ABSORPTION_BUY_RATIO && data.priceChange5m < 15) {
      anomalies.push({
        type: 'ABSORPTION',
        strength: buyRatio,
        description: `${Math.round(buyRatio * 100)}% buy pressure, price contained`
      });
    }
  }
  
  // 4. Stealth Accumulation: High volume relative to mcap
  if (data.volume1h > 0 && data.mcap > 0) {
    const volToMcap = data.volume1h / data.mcap;
    
    if (volToMcap >= STEALTH_VOLUME_MCAP_RATIO) {
      anomalies.push({
        type: 'STEALTH',
        strength: Math.min(1, volToMcap / 0.5),
        description: `${Math.round(volToMcap * 100)}% of mcap traded in 1h`
      });
    }
  }
  
  return anomalies;
}

// Calculate confidence from anomalies
function calculateAnomalyConfidence(anomalies: VolumeAnomaly[], data: VolumeData): number {
  if (anomalies.length === 0) return 0;
  
  let score = 0;
  
  // Base score from anomalies
  for (const anomaly of anomalies) {
    switch (anomaly.type) {
      case 'SPIKE':
        score += anomaly.strength * 25;
        break;
      case 'ACCELERATION':
        score += anomaly.strength * 30;
        break;
      case 'ABSORPTION':
        score += anomaly.strength * 35;
        break;
      case 'STEALTH':
        score += anomaly.strength * 25;
        break;
    }
  }
  
  // Multiple anomaly bonus
  if (anomalies.length >= 2) {
    score += 15;
  }
  if (anomalies.length >= 3) {
    score += 10;
  }
  
  // Buy pressure bonus
  const totalTx = data.buys5m + data.sells5m;
  if (totalTx > 0) {
    const buyRatio = data.buys5m / totalTx;
    if (buyRatio > 0.7) score += 10;
  }
  
  // Liquidity safety (can actually exit)
  if (data.liquidity >= 50000) score += 5;
  else if (data.liquidity < 10000) score -= 10;
  
  // Fresh token bonus
  if (data.age < 60) score += 10;
  else if (data.age < 360) score += 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Fetch volume data from DexScreener
async function fetchVolumeData(): Promise<VolumeData[]> {
  const volumeData: VolumeData[] = [];
  
  try {
    // Get trending/boosted tokens
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    const data = await response.json();
    
    const solanaTokens = data
      .filter((t: any) => t.chainId === 'solana')
      .slice(0, 30);
    
    for (const token of solanaTokens) {
      try {
        const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.tokenAddress}`);
        const pairData = await pairRes.json();
        const pair = pairData.pairs?.[0];
        
        if (!pair) continue;
        
        volumeData.push({
          token: token.tokenAddress,
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          name: pair.baseToken?.name || 'Unknown',
          volume5m: pair.volume?.m5 || 0,
          volume1h: pair.volume?.h1 || 0,
          volume6h: pair.volume?.h6 || 0,
          volume24h: pair.volume?.h24 || 0,
          buys5m: pair.txns?.m5?.buys || 0,
          sells5m: pair.txns?.m5?.sells || 0,
          buys1h: pair.txns?.h1?.buys || 0,
          sells1h: pair.txns?.h1?.sells || 0,
          mcap: pair.fdv || pair.marketCap || 0,
          liquidity: pair.liquidity?.usd || 0,
          priceChange5m: pair.priceChange?.m5 || 0,
          priceChange1h: pair.priceChange?.h1 || 0,
          age: pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 60000) : 999
        });
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error('[DEX-ANOMALY] Error fetching volume data:', error);
  }
  
  return volumeData;
}

// Main scan function
export async function scanDexVolumeAnomalies(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const now = Date.now();

  console.log('[DEX-ANOMALY] Scanning for volume anomalies...');

  const volumeData = await fetchVolumeData();
  console.log(`[DEX-ANOMALY] Analyzing ${volumeData.length} tokens...`);

  for (const data of volumeData) {
    // Skip low liquidity (manipulation risk)
    if (data.liquidity < 5000) continue;
    
    // Skip very high mcap (less upside)
    if (data.mcap > 10000000) continue;
    
    const anomalies = detectAnomalies(data);
    
    if (anomalies.length === 0) continue;
    
    const confidence = calculateAnomalyConfidence(anomalies, data);
    
    // Only signal if confident enough
    if (confidence < 50) continue;
    
    signals.push({
      source: 'volume-spike', // Use existing source type
      timestamp: now,
      token: data.token,
      symbol: data.symbol,
      name: data.name,
      action: 'BUY',
      confidence,
      metadata: {
        anomalies: anomalies.map(a => ({ type: a.type, strength: a.strength.toFixed(2), desc: a.description })),
        primaryAnomaly: anomalies[0].type,
        volume5m: data.volume5m,
        volume1h: data.volume1h,
        volume24h: data.volume24h,
        buyRatio: data.buys5m + data.sells5m > 0 
          ? Math.round((data.buys5m / (data.buys5m + data.sells5m)) * 100) 
          : 0,
        mcap: data.mcap,
        liquidity: data.liquidity,
        age: data.age,
        priceChange5m: data.priceChange5m,
        source: 'dex-volume-anomaly'
      }
    });
  }

  console.log(`[DEX-ANOMALY] Found ${signals.length} volume anomaly signals`);
  return signals;
}

// Export for testing
export { detectAnomalies, calculateAnomalyConfidence, VolumeAnomaly };
