// Signal Types
export interface RawSignal {
  source: SignalSource;
  timestamp: number;
  token: string; // CA
  symbol?: string;
  name?: string;
  action: 'BUY' | 'SELL' | 'ALERT';
  confidence: number; // 0-100
  metadata: Record<string, any>;
}

export type SignalSource = 
  | 'smart-wallet-elite'
  | 'smart-wallet-sniper'
  | 'volume-spike'
  | 'kol-buy'
  | 'narrative-trend'
  | 'new-listing'
  | 'whale-accumulation';

// Aggregated Signal
export interface AggregatedSignal {
  id: string;
  timestamp: number;
  token: string;
  symbol: string;
  name: string;
  
  // Composite scoring
  score: number; // 0-100
  confidence: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  
  // Sources that contributed
  sources: {
    source: SignalSource;
    weight: number;
    rawScore: number;
  }[];
  
  // Market data at time of signal
  marketData: {
    mcap: number;
    liquidity: number;
    volume5m: number;
    volume1h: number;
    priceChange5m: number;
    priceChange1h: number;
    holders?: number;
    age: number; // minutes
  };
  
  // AI analysis
  analysis: {
    narrative: string[];
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
  };
  
  // On-chain tracking
  onChain?: {
    txSignature: string;
    slot: number;
    published: boolean;
  };
  
  // Performance tracking (filled later)
  performance?: {
    ath: number;
    athTimestamp: number;
    current: number;
    roi: number;
    status: 'OPEN' | 'WIN' | 'LOSS';
  };
}

// Source Configuration
export interface SourceConfig {
  source: SignalSource;
  enabled: boolean;
  weight: number; // Base weight, adjusted by performance
  historicalWinRate: number;
  totalSignals: number;
  lastUpdated: number;
}

// Performance Record (for on-chain)
export interface PerformanceRecord {
  totalSignals: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  avgRoi: number;
  bestTrade: {
    token: string;
    roi: number;
    timestamp: number;
  };
  worstTrade: {
    token: string;
    roi: number;
    timestamp: number;
  };
}

// API Types
export interface SignalQuery {
  minScore?: number;
  maxAge?: number; // minutes
  sources?: SignalSource[];
  limit?: number;
  includePerformance?: boolean;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number; // USDC
  features: string[];
  minScore: number;
  delaySeconds: number; // 0 for instant
}
