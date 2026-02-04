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
  | 'kol-tracker'
  | 'kol-social'
  | 'narrative-new'
  | 'narrative-momentum'
  | 'new-listing'
  | 'new-launch'
  | 'whale-accumulation'
  | 'whale-tracker'
  | 'news-scraper'
  | 'pump-koth'
  | 'dexscreener'
  | 'panda_alpha';

// Conviction level based on score and confluence
export type ConvictionLevel = 'STANDARD' | 'HIGH_CONVICTION' | 'ULTRA';

// Safety red flag
export interface RedFlag {
  type: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  points: number;
}

// Safety analysis data
export interface SafetyData {
  safetyScore: number; // 0-100
  riskCategory: 'SAFE' | 'CAUTION' | 'RISKY';
  redFlags: RedFlag[];
  devHoldings: number; // Percentage
  topHolderPercentage: number;
  liquidityLocked: boolean;
  mintAuthorityEnabled: boolean;
  freezeAuthorityEnabled: boolean;
  tokenAge: number;
  bundledWallets: number;
}

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

  // Confluence data
  confluence: {
    uniqueSources: number; // Number of unique source types
    sourceTypes: string[]; // List of unique source types that contributed
    confluenceBoost: number; // Points added for confluence (5/10/15)
    convictionLevel: ConvictionLevel; // STANDARD, HIGH_CONVICTION, ULTRA
  };

  // Safety analysis (anti-rug checks)
  safety?: SafetyData;

  // Sources that contributed
  sources: {
    source: SignalSource;
    weight: number;
    rawScore: number;
  }[];

  // Market data at time of signal
  marketData: {
    price?: number;
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
    entryPrice: number;
    currentPrice: number;
    current?: number; // alias for currentPrice
    athPrice: number;
    ath?: number; // alias for athPrice
    athTimestamp?: number;
    roi: number;
    athRoi: number;
    status: 'OPEN' | 'WIN' | 'LOSS';
  };

  // Publishing status
  published?: boolean;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

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
  minSources?: number; // Minimum unique source types for confluence filter (default: 2)
  convictionLevel?: ConvictionLevel; // Filter by conviction level
  safeOnly?: boolean; // Filter to safetyScore >= 60
  minSafetyScore?: number; // Custom safety score threshold
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number; // USDC
  features: string[];
  minScore: number;
  delaySeconds: number; // 0 for instant
}
