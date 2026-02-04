/**
 * Custom Score Weights Module
 * 
 * Allows users to customize signal scoring weights for personalized trading strategies.
 * Includes source weights, risk penalties, and pre-built presets.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SignalSource, AggregatedSignal } from '../types';

// ===== TYPES =====

export interface SourceWeights {
  'smart-wallet-elite': number;   // 0-100, default 30
  'smart-wallet-sniper': number;  // 0-100, default 25
  'volume-spike': number;         // 0-100, default 15
  'kol-tracker': number;          // 0-100, default 15
  'narrative': number;            // 0-100, default 10 (covers narrative-new, narrative-momentum)
  'whale': number;                // 0-100, default 10 (covers whale-tracker, whale-accumulation)
  'news': number;                 // 0-100, default 5  (covers news-scraper)
  // Additional sources
  'pump-koth'?: number;           // 0-100, default 20
  'dexscreener'?: number;         // 0-100, default 10
  'kol-social'?: number;          // 0-100, default 8
  'new-launch'?: number;          // 0-100, default 5
  'twitter-sentiment'?: number;   // 0-100, default 5
  'dex-volume-anomaly'?: number;  // 0-100, default 10
}

export interface RiskPenalties {
  honeypotPenalty: number;  // 0-100, default 50 - penalty for honeypot risk
  bundlePenalty: number;    // 0-100, default 30 - penalty for bundle detection
  sniperPenalty: number;    // 0-100, default 20 - penalty for sniper activity
  washPenalty: number;      // 0-100, default 25 - penalty for wash trading
}

export interface ScoringProfile {
  name: string;
  description: string;
  sourceWeights: SourceWeights;
  riskPenalties: RiskPenalties;
  createdAt: number;
  updatedAt: number;
}

export interface ScoringPreset {
  id: string;
  name: string;
  description: string;
  sourceWeights: SourceWeights;
  riskPenalties: RiskPenalties;
}

export interface CustomWeightsConfig {
  activeProfile: string;
  profiles: Record<string, ScoringProfile>;
  presetHistory: string[];  // Track which presets were applied
}

export interface ScoreImpact {
  originalScore: number;
  adjustedScore: number;
  delta: number;
  breakdown: {
    sourceContributions: Record<string, number>;
    riskPenaltiesApplied: Record<string, number>;
    totalPenalty: number;
  };
}

// ===== DEFAULT VALUES =====

export const DEFAULT_SOURCE_WEIGHTS: SourceWeights = {
  'smart-wallet-elite': 30,
  'smart-wallet-sniper': 25,
  'volume-spike': 15,
  'kol-tracker': 15,
  'narrative': 10,
  'whale': 10,
  'news': 5,
  'pump-koth': 20,
  'dexscreener': 10,
  'kol-social': 8,
  'new-launch': 5,
  'twitter-sentiment': 5,
  'dex-volume-anomaly': 10,
};

export const DEFAULT_RISK_PENALTIES: RiskPenalties = {
  honeypotPenalty: 50,
  bundlePenalty: 30,
  sniperPenalty: 20,
  washPenalty: 25,
};

// ===== PRESETS =====

export const SCORING_PRESETS: ScoringPreset[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'High safety weights, lower source weights. Prioritizes avoiding rugs over catching pumps.',
    sourceWeights: {
      'smart-wallet-elite': 35,
      'smart-wallet-sniper': 15,
      'volume-spike': 10,
      'kol-tracker': 10,
      'narrative': 5,
      'whale': 10,
      'news': 5,
      'pump-koth': 10,
      'dexscreener': 10,
      'kol-social': 5,
      'new-launch': 3,
      'twitter-sentiment': 3,
      'dex-volume-anomaly': 8,
    },
    riskPenalties: {
      honeypotPenalty: 80,  // Very high - avoid honeypots at all costs
      bundlePenalty: 60,    // High - bundle detection is important
      sniperPenalty: 40,    // Medium-high
      washPenalty: 50,      // High - fake volume is a red flag
    },
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'High source weights, lower safety penalties. For experienced traders who can handle volatility.',
    sourceWeights: {
      'smart-wallet-elite': 35,
      'smart-wallet-sniper': 30,
      'volume-spike': 25,
      'kol-tracker': 20,
      'narrative': 15,
      'whale': 15,
      'news': 8,
      'pump-koth': 25,
      'dexscreener': 12,
      'kol-social': 12,
      'new-launch': 10,
      'twitter-sentiment': 10,
      'dex-volume-anomaly': 15,
    },
    riskPenalties: {
      honeypotPenalty: 30,  // Lower - take more risks
      bundlePenalty: 15,    // Lower - accept some coordination
      sniperPenalty: 10,    // Low - snipers can indicate opportunity
      washPenalty: 15,      // Low - some wash trading accepted
    },
  },
  {
    id: 'kol-focused',
    name: 'KOL Focused',
    description: 'Boost KOL and social signals. Follow the influencers.',
    sourceWeights: {
      'smart-wallet-elite': 20,
      'smart-wallet-sniper': 15,
      'volume-spike': 15,
      'kol-tracker': 40,    // High KOL weight
      'narrative': 20,      // Narrative matters for KOL plays
      'whale': 10,
      'news': 10,
      'pump-koth': 15,
      'dexscreener': 10,
      'kol-social': 35,     // High social weight
      'new-launch': 8,
      'twitter-sentiment': 25,  // High twitter weight
      'dex-volume-anomaly': 10,
    },
    riskPenalties: {
      honeypotPenalty: 45,
      bundlePenalty: 25,
      sniperPenalty: 20,
      washPenalty: 20,
    },
  },
  {
    id: 'smart-money',
    name: 'Smart Money',
    description: 'Boost wallet tracking signals. Follow the whales and elite wallets.',
    sourceWeights: {
      'smart-wallet-elite': 50,   // Maximum weight on elite wallets
      'smart-wallet-sniper': 40,  // High sniper weight
      'volume-spike': 10,
      'kol-tracker': 10,
      'narrative': 5,
      'whale': 35,                // High whale weight
      'news': 3,
      'pump-koth': 15,
      'dexscreener': 8,
      'kol-social': 5,
      'new-launch': 5,
      'twitter-sentiment': 5,
      'dex-volume-anomaly': 12,
    },
    riskPenalties: {
      honeypotPenalty: 55,
      bundlePenalty: 35,
      sniperPenalty: 25,
      washPenalty: 30,
    },
  },
  {
    id: 'degen',
    name: 'Full Degen',
    description: '🎰 YOLO mode. Maximum source weights, minimal safety. Not financial advice!',
    sourceWeights: {
      'smart-wallet-elite': 25,
      'smart-wallet-sniper': 35,
      'volume-spike': 30,
      'kol-tracker': 25,
      'narrative': 25,
      'whale': 20,
      'news': 15,
      'pump-koth': 35,
      'dexscreener': 20,
      'kol-social': 20,
      'new-launch': 25,
      'twitter-sentiment': 20,
      'dex-volume-anomaly': 25,
    },
    riskPenalties: {
      honeypotPenalty: 20,  // Living dangerously
      bundlePenalty: 10,
      sniperPenalty: 5,
      washPenalty: 10,
    },
  },
  {
    id: 'volume-hunter',
    name: 'Volume Hunter',
    description: 'Focus on volume spikes and market activity. Early detection of pumps.',
    sourceWeights: {
      'smart-wallet-elite': 20,
      'smart-wallet-sniper': 25,
      'volume-spike': 45,         // Maximum volume weight
      'kol-tracker': 10,
      'narrative': 10,
      'whale': 15,
      'news': 5,
      'pump-koth': 30,
      'dexscreener': 30,          // High DEX weight
      'kol-social': 8,
      'new-launch': 15,
      'twitter-sentiment': 10,
      'dex-volume-anomaly': 40,   // High anomaly detection
    },
    riskPenalties: {
      honeypotPenalty: 45,
      bundlePenalty: 25,
      sniperPenalty: 20,
      washPenalty: 40,  // Higher - volume hunters need to watch for wash
    },
  },
];

// ===== STORAGE =====

const CONFIG_FILE = path.join(process.cwd(), 'data', 'scoring-weights.json');

// In-memory state
let currentConfig: CustomWeightsConfig = {
  activeProfile: 'default',
  profiles: {
    default: {
      name: 'Default',
      description: 'Balanced default weights',
      sourceWeights: { ...DEFAULT_SOURCE_WEIGHTS },
      riskPenalties: { ...DEFAULT_RISK_PENALTIES },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  },
  presetHistory: [],
};

// ===== PERSISTENCE =====

function ensureDataDir(): void {
  const dataDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function loadWeightsConfig(): CustomWeightsConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      currentConfig = JSON.parse(data);
      console.log('[WEIGHTS] Loaded custom weights config');
    }
  } catch (err) {
    console.error('[WEIGHTS] Error loading config:', err);
  }
  return currentConfig;
}

export function saveWeightsConfig(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2));
    console.log('[WEIGHTS] Saved custom weights config');
  } catch (err) {
    console.error('[WEIGHTS] Error saving config:', err);
  }
}

// ===== GETTERS =====

export function getCurrentWeights(): { sourceWeights: SourceWeights; riskPenalties: RiskPenalties } {
  const profile = currentConfig.profiles[currentConfig.activeProfile];
  if (!profile) {
    return {
      sourceWeights: { ...DEFAULT_SOURCE_WEIGHTS },
      riskPenalties: { ...DEFAULT_RISK_PENALTIES },
    };
  }
  return {
    sourceWeights: profile.sourceWeights,
    riskPenalties: profile.riskPenalties,
  };
}

export function getActiveProfile(): ScoringProfile | null {
  return currentConfig.profiles[currentConfig.activeProfile] || null;
}

export function getActiveProfileName(): string {
  return currentConfig.activeProfile;
}

export function getAllProfiles(): Record<string, ScoringProfile> {
  return currentConfig.profiles;
}

export function getPresets(): ScoringPreset[] {
  return SCORING_PRESETS;
}

export function getPreset(id: string): ScoringPreset | undefined {
  return SCORING_PRESETS.find(p => p.id === id);
}

// ===== SETTERS =====

export function updateSourceWeights(weights: Partial<SourceWeights>): SourceWeights {
  const profile = currentConfig.profiles[currentConfig.activeProfile];
  if (!profile) {
    throw new Error(`Profile ${currentConfig.activeProfile} not found`);
  }

  // Validate weights are 0-100
  for (const [key, value] of Object.entries(weights)) {
    if (typeof value === 'number') {
      if (value < 0 || value > 100) {
        throw new Error(`Weight for ${key} must be between 0 and 100`);
      }
    }
  }

  profile.sourceWeights = {
    ...profile.sourceWeights,
    ...weights,
  };
  profile.updatedAt = Date.now();
  
  saveWeightsConfig();
  return profile.sourceWeights;
}

export function updateRiskPenalties(penalties: Partial<RiskPenalties>): RiskPenalties {
  const profile = currentConfig.profiles[currentConfig.activeProfile];
  if (!profile) {
    throw new Error(`Profile ${currentConfig.activeProfile} not found`);
  }

  // Validate penalties are 0-100
  for (const [key, value] of Object.entries(penalties)) {
    if (typeof value === 'number') {
      if (value < 0 || value > 100) {
        throw new Error(`Penalty for ${key} must be between 0 and 100`);
      }
    }
  }

  profile.riskPenalties = {
    ...profile.riskPenalties,
    ...penalties,
  };
  profile.updatedAt = Date.now();
  
  saveWeightsConfig();
  return profile.riskPenalties;
}

export function updateWeights(
  sourceWeights: Partial<SourceWeights>,
  riskPenalties: Partial<RiskPenalties>
): { sourceWeights: SourceWeights; riskPenalties: RiskPenalties } {
  const profile = currentConfig.profiles[currentConfig.activeProfile];
  if (!profile) {
    throw new Error(`Profile ${currentConfig.activeProfile} not found`);
  }

  // Validate and update source weights
  if (sourceWeights && Object.keys(sourceWeights).length > 0) {
    for (const [key, value] of Object.entries(sourceWeights)) {
      if (typeof value === 'number' && (value < 0 || value > 100)) {
        throw new Error(`Weight for ${key} must be between 0 and 100`);
      }
    }
    profile.sourceWeights = { ...profile.sourceWeights, ...sourceWeights };
  }

  // Validate and update risk penalties
  if (riskPenalties && Object.keys(riskPenalties).length > 0) {
    for (const [key, value] of Object.entries(riskPenalties)) {
      if (typeof value === 'number' && (value < 0 || value > 100)) {
        throw new Error(`Penalty for ${key} must be between 0 and 100`);
      }
    }
    profile.riskPenalties = { ...profile.riskPenalties, ...riskPenalties };
  }

  profile.updatedAt = Date.now();
  saveWeightsConfig();

  return {
    sourceWeights: profile.sourceWeights,
    riskPenalties: profile.riskPenalties,
  };
}

export function resetToDefaults(): { sourceWeights: SourceWeights; riskPenalties: RiskPenalties } {
  const profile = currentConfig.profiles[currentConfig.activeProfile];
  if (!profile) {
    throw new Error(`Profile ${currentConfig.activeProfile} not found`);
  }

  profile.sourceWeights = { ...DEFAULT_SOURCE_WEIGHTS };
  profile.riskPenalties = { ...DEFAULT_RISK_PENALTIES };
  profile.updatedAt = Date.now();
  
  saveWeightsConfig();
  
  return {
    sourceWeights: profile.sourceWeights,
    riskPenalties: profile.riskPenalties,
  };
}

export function applyPreset(presetId: string): { sourceWeights: SourceWeights; riskPenalties: RiskPenalties } {
  const preset = SCORING_PRESETS.find(p => p.id === presetId);
  if (!preset) {
    throw new Error(`Preset ${presetId} not found`);
  }

  const profile = currentConfig.profiles[currentConfig.activeProfile];
  if (!profile) {
    throw new Error(`Profile ${currentConfig.activeProfile} not found`);
  }

  profile.sourceWeights = { ...preset.sourceWeights };
  profile.riskPenalties = { ...preset.riskPenalties };
  profile.updatedAt = Date.now();
  
  // Track preset history
  currentConfig.presetHistory.push(presetId);
  if (currentConfig.presetHistory.length > 20) {
    currentConfig.presetHistory = currentConfig.presetHistory.slice(-20);
  }
  
  saveWeightsConfig();
  
  return {
    sourceWeights: profile.sourceWeights,
    riskPenalties: profile.riskPenalties,
  };
}

// ===== PROFILE MANAGEMENT =====

export function createProfile(name: string, description?: string): ScoringProfile {
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  if (currentConfig.profiles[id]) {
    throw new Error(`Profile ${id} already exists`);
  }

  const profile: ScoringProfile = {
    name,
    description: description || `Custom profile: ${name}`,
    sourceWeights: { ...DEFAULT_SOURCE_WEIGHTS },
    riskPenalties: { ...DEFAULT_RISK_PENALTIES },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  currentConfig.profiles[id] = profile;
  saveWeightsConfig();
  
  return profile;
}

export function deleteProfile(profileId: string): boolean {
  if (profileId === 'default') {
    throw new Error('Cannot delete default profile');
  }
  
  if (!currentConfig.profiles[profileId]) {
    return false;
  }

  // Switch to default if deleting active profile
  if (currentConfig.activeProfile === profileId) {
    currentConfig.activeProfile = 'default';
  }

  delete currentConfig.profiles[profileId];
  saveWeightsConfig();
  
  return true;
}

export function switchProfile(profileId: string): ScoringProfile {
  if (!currentConfig.profiles[profileId]) {
    throw new Error(`Profile ${profileId} not found`);
  }

  currentConfig.activeProfile = profileId;
  saveWeightsConfig();
  
  return currentConfig.profiles[profileId];
}

// ===== SCORE CALCULATION =====

// Map raw source names to weight categories
function mapSourceToWeightKey(source: string): keyof SourceWeights | null {
  // Direct mappings
  if (source === 'smart-wallet-elite') return 'smart-wallet-elite';
  if (source === 'smart-wallet-sniper') return 'smart-wallet-sniper';
  if (source === 'volume-spike') return 'volume-spike';
  if (source === 'kol-tracker') return 'kol-tracker';
  if (source === 'pump-koth') return 'pump-koth';
  if (source === 'dexscreener') return 'dexscreener';
  if (source === 'kol-social') return 'kol-social';
  if (source === 'new-launch' || source === 'new-listing') return 'new-launch';
  if (source === 'twitter-sentiment') return 'twitter-sentiment';
  if (source === 'dex-volume-anomaly') return 'dex-volume-anomaly';
  
  // Category mappings
  if (source.includes('narrative')) return 'narrative';
  if (source.includes('whale')) return 'whale';
  if (source.includes('news')) return 'news';
  
  return null;
}

// Calculate custom score for a signal
export function calculateCustomScore(signal: AggregatedSignal): ScoreImpact {
  const { sourceWeights, riskPenalties } = getCurrentWeights();
  
  // Calculate weighted source contributions
  let weightedSum = 0;
  let totalWeight = 0;
  const sourceContributions: Record<string, number> = {};
  
  for (const src of signal.sources) {
    const weightKey = mapSourceToWeightKey(src.source);
    if (!weightKey) continue;
    
    const weight = sourceWeights[weightKey] ?? 10;
    const contribution = (src.rawScore * weight) / 100;
    
    weightedSum += contribution;
    totalWeight += weight / 100;
    sourceContributions[src.source] = Math.round(contribution * 10) / 10;
  }
  
  // Normalize to 0-100
  let adjustedScore = totalWeight > 0 
    ? Math.round(weightedSum / totalWeight)
    : signal.score;
  
  // Apply risk penalties
  const riskPenaltiesApplied: Record<string, number> = {};
  let totalPenalty = 0;
  
  // Honeypot penalty
  if (signal.safety?.honeypotRisk) {
    const honeypotRisk = signal.safety.honeypotRisk.riskScore || 0;
    const penalty = (honeypotRisk * riskPenalties.honeypotPenalty) / 100;
    if (penalty > 0) {
      riskPenaltiesApplied['honeypot'] = Math.round(penalty * 10) / 10;
      totalPenalty += penalty;
    }
  }
  
  // Bundle penalty
  if (signal.safety?.bundleScore) {
    const bundleScore = signal.safety.bundleScore;
    const penalty = (bundleScore * riskPenalties.bundlePenalty) / 100;
    if (penalty > 0) {
      riskPenaltiesApplied['bundle'] = Math.round(penalty * 10) / 10;
      totalPenalty += penalty;
    }
  }
  
  // Sniper penalty
  if (signal.safety?.sniperActivity) {
    const sniperScore = signal.safety.sniperActivity.sniperScore;
    const penalty = (sniperScore * riskPenalties.sniperPenalty) / 100;
    if (penalty > 0) {
      riskPenaltiesApplied['sniper'] = Math.round(penalty * 10) / 10;
      totalPenalty += penalty;
    }
  }
  
  // Wash trading penalty
  if (signal.safety?.washScore) {
    const washScore = signal.safety.washScore;
    const penalty = (washScore * riskPenalties.washPenalty) / 100;
    if (penalty > 0) {
      riskPenaltiesApplied['wash'] = Math.round(penalty * 10) / 10;
      totalPenalty += penalty;
    }
  }
  
  // Apply penalty (capped at 50% reduction)
  const penaltyMultiplier = Math.max(0.5, 1 - (totalPenalty / 100));
  adjustedScore = Math.round(adjustedScore * penaltyMultiplier);
  
  // Clamp to 0-100
  adjustedScore = Math.max(0, Math.min(100, adjustedScore));
  
  return {
    originalScore: signal.score,
    adjustedScore,
    delta: adjustedScore - signal.score,
    breakdown: {
      sourceContributions,
      riskPenaltiesApplied,
      totalPenalty: Math.round(totalPenalty * 10) / 10,
    },
  };
}

// Re-score multiple signals with current weights
export function rescoreSignals(signals: AggregatedSignal[]): Array<{
  signal: AggregatedSignal;
  impact: ScoreImpact;
}> {
  return signals.map(signal => ({
    signal,
    impact: calculateCustomScore(signal),
  }));
}

// Preview impact of weight changes without applying them
export function previewWeightChange(
  signal: AggregatedSignal,
  newSourceWeights?: Partial<SourceWeights>,
  newRiskPenalties?: Partial<RiskPenalties>
): ScoreImpact {
  const { sourceWeights: currentSourceWeights, riskPenalties: currentRiskPenalties } = getCurrentWeights();
  
  // Merge with proposed changes
  const testWeights: SourceWeights = {
    ...currentSourceWeights,
    ...newSourceWeights,
  };
  const testPenalties: RiskPenalties = {
    ...currentRiskPenalties,
    ...newRiskPenalties,
  };
  
  // Temporarily use test weights
  const originalProfile = currentConfig.profiles[currentConfig.activeProfile];
  const tempProfile: ScoringProfile = {
    ...originalProfile,
    sourceWeights: testWeights,
    riskPenalties: testPenalties,
  };
  
  // Calculate with temp weights
  currentConfig.profiles['__preview__'] = tempProfile;
  const prevActive = currentConfig.activeProfile;
  currentConfig.activeProfile = '__preview__';
  
  const impact = calculateCustomScore(signal);
  
  // Restore
  currentConfig.activeProfile = prevActive;
  delete currentConfig.profiles['__preview__'];
  
  return impact;
}

// ===== EXPORT =====

export function exportConfig(): CustomWeightsConfig {
  return JSON.parse(JSON.stringify(currentConfig));
}

export function importConfig(config: Partial<CustomWeightsConfig>): void {
  if (config.activeProfile) {
    currentConfig.activeProfile = config.activeProfile;
  }
  if (config.profiles) {
    currentConfig.profiles = {
      ...currentConfig.profiles,
      ...config.profiles,
    };
  }
  if (config.presetHistory) {
    currentConfig.presetHistory = config.presetHistory;
  }
  saveWeightsConfig();
}

// ===== INITIALIZATION =====

// Load config on module initialization
loadWeightsConfig();
