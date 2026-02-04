/**
 * Referral System
 * Generate referral codes, track referrals, reward system
 */

// === TYPES ===

export interface ReferralCode {
  code: string;
  userId: string;
  isVanity: boolean;
  createdAt: number;
  active: boolean;
}

export interface Referral {
  id: string;
  referrerId: string;      // Who referred
  referredId: string;      // Who was referred
  referralCode: string;
  status: ReferralStatus;
  source?: string;         // UTM source
  medium?: string;         // UTM medium
  campaign?: string;       // UTM campaign
  createdAt: number;       // When clicked/applied
  convertedAt?: number;    // When completed signup/action
  rewardedAt?: number;     // When reward was given
  rewardTier: number;      // Which tier reward was given (1, 2, 3...)
}

export type ReferralStatus = 'clicked' | 'applied' | 'converted' | 'rewarded';

export interface ReferralStats {
  userId: string;
  totalReferrals: number;
  convertedReferrals: number;
  pendingReferrals: number;
  totalClicks: number;
  conversionRate: number;
  totalXpEarned: number;
  totalPremiumDaysEarned: number;
  currentTier: ReferrerTier;
  nextTierProgress: number;
  referralChain: ChainNode[];  // Multi-level tracking
}

export interface ChainNode {
  userId: string;
  level: number;  // 1 = direct, 2 = indirect, etc.
  convertedAt: number;
}

export interface ReferrerTier {
  id: string;
  name: string;
  icon: string;
  minReferrals: number;
  xpPerReferral: number;
  premiumDaysPerReferral: number;
  canHaveVanityCode: boolean;
  revenueSharePercent: number;  // Future
  perks: string[];
}

export interface ReferralReward {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'xp' | 'premium_days' | 'achievement' | 'feature' | 'badge';
  value: number | string;
  requiredReferrals: number;
  claimed: boolean;
  claimedAt?: number;
}

export interface ReferralLeaderboardEntry {
  rank: number;
  userId: string;
  displayName?: string;
  wallet?: string;
  totalReferrals: number;
  convertedReferrals: number;
  tier: ReferrerTier;
  badge?: string;
}

export interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

export interface ConversionFunnel {
  clicks: number;
  codeApplied: number;
  signupStarted: number;
  signupCompleted: number;
  firstTrade: number;
  active7Days: number;
}

// === TIER DEFINITIONS ===

export const REFERRER_TIERS: ReferrerTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    icon: '🌱',
    minReferrals: 0,
    xpPerReferral: 100,
    premiumDaysPerReferral: 0,
    canHaveVanityCode: false,
    revenueSharePercent: 0,
    perks: ['Basic referral link', '100 XP per referral']
  },
  {
    id: 'recruiter',
    name: 'Recruiter',
    icon: '🎯',
    minReferrals: 5,
    xpPerReferral: 150,
    premiumDaysPerReferral: 1,
    canHaveVanityCode: false,
    revenueSharePercent: 0,
    perks: ['150 XP per referral', '1 premium day per referral', 'Recruiter badge']
  },
  {
    id: 'influencer',
    name: 'Influencer',
    icon: '⭐',
    minReferrals: 25,
    xpPerReferral: 200,
    premiumDaysPerReferral: 2,
    canHaveVanityCode: true,
    revenueSharePercent: 5,
    perks: ['Custom vanity code', '200 XP per referral', '2 premium days per referral', 'Influencer badge', '5% revenue share (coming soon)']
  },
  {
    id: 'ambassador',
    name: 'Ambassador',
    icon: '👑',
    minReferrals: 100,
    xpPerReferral: 300,
    premiumDaysPerReferral: 3,
    canHaveVanityCode: true,
    revenueSharePercent: 10,
    perks: ['Premium vanity codes', '300 XP per referral', '3 premium days per referral', 'Ambassador badge', '10% revenue share (coming soon)', 'Direct support channel']
  },
  {
    id: 'legend',
    name: 'Legend',
    icon: '🏆',
    minReferrals: 500,
    xpPerReferral: 500,
    premiumDaysPerReferral: 5,
    canHaveVanityCode: true,
    revenueSharePercent: 15,
    perks: ['Unlimited vanity codes', '500 XP per referral', '5 premium days per referral', 'Legend badge', '15% revenue share (coming soon)', 'Featured on leaderboard', 'Exclusive Legend perks']
  }
];

// === ACHIEVEMENT REWARDS ===

export const REFERRAL_ACHIEVEMENTS: ReferralReward[] = [
  {
    id: 'first_referral',
    name: 'First Recruit',
    description: 'Get your first successful referral',
    icon: '🎉',
    type: 'achievement',
    value: 'first_referral',
    requiredReferrals: 1,
    claimed: false
  },
  {
    id: 'five_referrals',
    name: 'Recruiter',
    description: 'Successfully refer 5 users',
    icon: '🎯',
    type: 'achievement',
    value: 'recruiter',
    requiredReferrals: 5,
    claimed: false
  },
  {
    id: 'ten_referrals_bonus',
    name: '10 Referral Bonus',
    description: 'Bonus 500 XP for 10 referrals',
    icon: '💎',
    type: 'xp',
    value: 500,
    requiredReferrals: 10,
    claimed: false
  },
  {
    id: 'twenty_five_referrals',
    name: 'Influencer',
    description: 'Successfully refer 25 users',
    icon: '⭐',
    type: 'achievement',
    value: 'influencer',
    requiredReferrals: 25,
    claimed: false
  },
  {
    id: 'premium_week',
    name: 'Premium Week',
    description: '7 days of premium access',
    icon: '👑',
    type: 'premium_days',
    value: 7,
    requiredReferrals: 15,
    claimed: false
  },
  {
    id: 'fifty_referrals_bonus',
    name: '50 Referral Milestone',
    description: 'Bonus 2000 XP for 50 referrals',
    icon: '🌟',
    type: 'xp',
    value: 2000,
    requiredReferrals: 50,
    claimed: false
  },
  {
    id: 'hundred_referrals',
    name: 'Ambassador',
    description: 'Successfully refer 100 users - Ambassador status',
    icon: '👑',
    type: 'achievement',
    value: 'ambassador',
    requiredReferrals: 100,
    claimed: false
  },
  {
    id: 'premium_month',
    name: 'Premium Month',
    description: '30 days of premium access',
    icon: '💜',
    type: 'premium_days',
    value: 30,
    requiredReferrals: 50,
    claimed: false
  },
  {
    id: 'five_hundred_referrals',
    name: 'Legend',
    description: 'Successfully refer 500 users - Legend status',
    icon: '🏆',
    type: 'achievement',
    value: 'legend',
    requiredReferrals: 500,
    claimed: false
  }
];

// === IN-MEMORY STORAGE ===

// Referral codes by code string
const referralCodes = new Map<string, ReferralCode>();

// User ID -> their referral code
const userReferralCodes = new Map<string, string>();

// All referrals
const referrals = new Map<string, Referral>();

// User ID -> referrals they made (as referrer)
const userReferrals = new Map<string, Set<string>>();

// User ID -> who referred them
const referredBy = new Map<string, string>();

// Click tracking (code -> count)
const codeClicks = new Map<string, number>();

// User rewards claimed
const userRewardsClaimed = new Map<string, Set<string>>();

// UTM tracking
const utmStats = new Map<string, { clicks: number; conversions: number }>();

// Vanity code requests (for approval)
const vanityRequests = new Map<string, { userId: string; requestedCode: string; requestedAt: number; status: 'pending' | 'approved' | 'rejected' }>();

// === HELPER FUNCTIONS ===

/**
 * Generate a unique referral code
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0/O, 1/I/L)
  let code = 'ORACLE-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a unique referral ID
 */
function generateReferralId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Validate vanity code format
 */
function isValidVanityCode(code: string): { valid: boolean; reason?: string } {
  // Must be alphanumeric with optional hyphens
  if (!/^[A-Z0-9-]+$/i.test(code)) {
    return { valid: false, reason: 'Code can only contain letters, numbers, and hyphens' };
  }
  
  // Length check
  if (code.length < 3 || code.length > 20) {
    return { valid: false, reason: 'Code must be between 3 and 20 characters' };
  }
  
  // No offensive words (basic check)
  const banned = ['FUCK', 'SHIT', 'ASS', 'BITCH', 'SCAM', 'HACK', 'PORN', 'XXX'];
  const upperCode = code.toUpperCase();
  for (const word of banned) {
    if (upperCode.includes(word)) {
      return { valid: false, reason: 'Code contains inappropriate content' };
    }
  }
  
  // Check if already taken
  if (referralCodes.has(code.toUpperCase())) {
    return { valid: false, reason: 'This code is already taken' };
  }
  
  return { valid: true };
}

/**
 * Get tier for a user based on their referral count
 */
function getTierForReferralCount(count: number): ReferrerTier {
  for (let i = REFERRER_TIERS.length - 1; i >= 0; i--) {
    if (count >= REFERRER_TIERS[i].minReferrals) {
      return REFERRER_TIERS[i];
    }
  }
  return REFERRER_TIERS[0];
}

/**
 * Get next tier
 */
function getNextTier(currentTier: ReferrerTier): ReferrerTier | null {
  const idx = REFERRER_TIERS.findIndex(t => t.id === currentTier.id);
  if (idx < REFERRER_TIERS.length - 1) {
    return REFERRER_TIERS[idx + 1];
  }
  return null;
}

// === CORE FUNCTIONS ===

/**
 * Get or create a referral code for a user
 */
export function getReferralCode(userId: string): ReferralCode {
  // Check if user already has a code
  const existingCode = userReferralCodes.get(userId);
  if (existingCode && referralCodes.has(existingCode)) {
    return referralCodes.get(existingCode)!;
  }
  
  // Generate new code
  let code: string;
  do {
    code = generateReferralCode();
  } while (referralCodes.has(code));
  
  const referralCode: ReferralCode = {
    code,
    userId,
    isVanity: false,
    createdAt: Date.now(),
    active: true
  };
  
  referralCodes.set(code, referralCode);
  userReferralCodes.set(userId, code);
  codeClicks.set(code, 0);
  
  return referralCode;
}

/**
 * Request a custom vanity code
 */
export function requestVanityCode(userId: string, requestedCode: string): { success: boolean; code?: ReferralCode; error?: string } {
  // Check if user can have vanity codes
  const stats = getReferralStats(userId);
  if (!stats.currentTier.canHaveVanityCode) {
    return { success: false, error: `You need to be ${REFERRER_TIERS.find(t => t.canHaveVanityCode)?.name || 'Influencer'} tier or higher to request custom codes` };
  }
  
  // Validate code
  const validation = isValidVanityCode(requestedCode);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }
  
  const normalizedCode = requestedCode.toUpperCase();
  
  // Get user's current code (if any) and deactivate it
  const currentCode = userReferralCodes.get(userId);
  if (currentCode) {
    const existing = referralCodes.get(currentCode);
    if (existing) {
      existing.active = false;
    }
  }
  
  // Create vanity code
  const vanityCode: ReferralCode = {
    code: normalizedCode,
    userId,
    isVanity: true,
    createdAt: Date.now(),
    active: true
  };
  
  referralCodes.set(normalizedCode, vanityCode);
  userReferralCodes.set(userId, normalizedCode);
  
  // Transfer click count if exists
  if (currentCode) {
    const clicks = codeClicks.get(currentCode) || 0;
    codeClicks.set(normalizedCode, clicks);
  } else {
    codeClicks.set(normalizedCode, 0);
  }
  
  return { success: true, code: vanityCode };
}

/**
 * Track a click on a referral link
 */
export function trackReferralClick(code: string, utm?: UTMParams): boolean {
  const normalizedCode = code.toUpperCase();
  const referralCode = referralCodes.get(normalizedCode);
  
  if (!referralCode || !referralCode.active) {
    return false;
  }
  
  // Increment click count
  codeClicks.set(normalizedCode, (codeClicks.get(normalizedCode) || 0) + 1);
  
  // Track UTM if provided
  if (utm?.source) {
    const key = `${utm.source}|${utm.medium || 'direct'}|${utm.campaign || 'none'}`;
    const current = utmStats.get(key) || { clicks: 0, conversions: 0 };
    current.clicks++;
    utmStats.set(key, current);
  }
  
  return true;
}

/**
 * Apply a referral code to a new user
 */
export function applyReferralCode(
  newUserId: string, 
  code: string,
  utm?: UTMParams
): { success: boolean; referral?: Referral; error?: string } {
  const normalizedCode = code.toUpperCase();
  const referralCode = referralCodes.get(normalizedCode);
  
  if (!referralCode || !referralCode.active) {
    return { success: false, error: 'Invalid or inactive referral code' };
  }
  
  // Can't refer yourself
  if (referralCode.userId === newUserId) {
    return { success: false, error: 'You cannot use your own referral code' };
  }
  
  // Check if already referred
  if (referredBy.has(newUserId)) {
    return { success: false, error: 'You have already been referred' };
  }
  
  // Create referral
  const referralId = generateReferralId();
  const referral: Referral = {
    id: referralId,
    referrerId: referralCode.userId,
    referredId: newUserId,
    referralCode: normalizedCode,
    status: 'applied',
    source: utm?.source,
    medium: utm?.medium,
    campaign: utm?.campaign,
    createdAt: Date.now(),
    rewardTier: 0
  };
  
  referrals.set(referralId, referral);
  referredBy.set(newUserId, referralCode.userId);
  
  // Track for referrer
  if (!userReferrals.has(referralCode.userId)) {
    userReferrals.set(referralCode.userId, new Set());
  }
  userReferrals.get(referralCode.userId)!.add(referralId);
  
  return { success: true, referral };
}

/**
 * Convert a referral (mark as successful signup/first trade)
 */
export function convertReferral(referredUserId: string): { success: boolean; rewards?: ReferralConversionResult; error?: string } {
  const referrerId = referredBy.get(referredUserId);
  if (!referrerId) {
    return { success: false, error: 'User was not referred' };
  }
  
  // Find the referral
  const referrerReferrals = userReferrals.get(referrerId);
  if (!referrerReferrals) {
    return { success: false, error: 'Referral record not found' };
  }
  
  let referral: Referral | undefined;
  for (const refId of referrerReferrals) {
    const ref = referrals.get(refId);
    if (ref && ref.referredId === referredUserId) {
      referral = ref;
      break;
    }
  }
  
  if (!referral) {
    return { success: false, error: 'Referral not found' };
  }
  
  if (referral.status === 'converted' || referral.status === 'rewarded') {
    return { success: false, error: 'Referral already converted' };
  }
  
  // Update referral status
  referral.status = 'converted';
  referral.convertedAt = Date.now();
  
  // Track UTM conversion
  if (referral.source) {
    const key = `${referral.source}|${referral.medium || 'direct'}|${referral.campaign || 'none'}`;
    const current = utmStats.get(key) || { clicks: 0, conversions: 0 };
    current.conversions++;
    utmStats.set(key, current);
  }
  
  // Calculate and apply rewards
  const stats = getReferralStats(referrerId);
  const tier = stats.currentTier;
  
  const rewards: ReferralConversionResult = {
    referrerId,
    referredId: referredUserId,
    xpAwarded: tier.xpPerReferral,
    premiumDaysAwarded: tier.premiumDaysPerReferral,
    newAchievements: [],
    tierChange: null
  };
  
  // Check for tier change
  const newTier = getTierForReferralCount(stats.convertedReferrals + 1);
  if (newTier.id !== tier.id) {
    rewards.tierChange = {
      from: tier,
      to: newTier
    };
  }
  
  // Check for achievement unlocks
  const totalConverted = stats.convertedReferrals + 1;
  for (const reward of REFERRAL_ACHIEVEMENTS) {
    if (reward.type === 'achievement' && 
        reward.requiredReferrals === totalConverted &&
        !hasClaimedReward(referrerId, reward.id)) {
      rewards.newAchievements.push(reward.value as string);
    }
  }
  
  // Mark referral as rewarded
  referral.status = 'rewarded';
  referral.rewardedAt = Date.now();
  referral.rewardTier = REFERRER_TIERS.indexOf(tier);
  
  return { success: true, rewards };
}

export interface ReferralConversionResult {
  referrerId: string;
  referredId: string;
  xpAwarded: number;
  premiumDaysAwarded: number;
  newAchievements: string[];
  tierChange: { from: ReferrerTier; to: ReferrerTier } | null;
}

/**
 * Get referral stats for a user
 */
export function getReferralStats(userId: string): ReferralStats {
  const code = userReferralCodes.get(userId);
  const userRefs = userReferrals.get(userId) || new Set();
  
  let converted = 0;
  let pending = 0;
  const chain: ChainNode[] = [];
  
  for (const refId of userRefs) {
    const ref = referrals.get(refId);
    if (ref) {
      if (ref.status === 'converted' || ref.status === 'rewarded') {
        converted++;
        chain.push({
          userId: ref.referredId,
          level: 1,
          convertedAt: ref.convertedAt || ref.createdAt
        });
      } else {
        pending++;
      }
    }
  }
  
  // Calculate multi-level chain (who did your referrals refer)
  for (const node of [...chain]) {
    const theirRefs = userReferrals.get(node.userId);
    if (theirRefs) {
      for (const refId of theirRefs) {
        const ref = referrals.get(refId);
        if (ref && (ref.status === 'converted' || ref.status === 'rewarded')) {
          chain.push({
            userId: ref.referredId,
            level: 2,
            convertedAt: ref.convertedAt || ref.createdAt
          });
        }
      }
    }
  }
  
  const tier = getTierForReferralCount(converted);
  const nextTier = getNextTier(tier);
  const nextTierProgress = nextTier 
    ? Math.min(100, (converted / nextTier.minReferrals) * 100)
    : 100;
  
  // Calculate total rewards earned
  let totalXp = 0;
  let totalPremiumDays = 0;
  for (const refId of userRefs) {
    const ref = referrals.get(refId);
    if (ref && ref.status === 'rewarded') {
      const refTier = REFERRER_TIERS[ref.rewardTier] || REFERRER_TIERS[0];
      totalXp += refTier.xpPerReferral;
      totalPremiumDays += refTier.premiumDaysPerReferral;
    }
  }
  
  return {
    userId,
    totalReferrals: userRefs.size,
    convertedReferrals: converted,
    pendingReferrals: pending,
    totalClicks: code ? (codeClicks.get(code) || 0) : 0,
    conversionRate: userRefs.size > 0 ? (converted / userRefs.size) * 100 : 0,
    totalXpEarned: totalXp,
    totalPremiumDaysEarned: totalPremiumDays,
    currentTier: tier,
    nextTierProgress,
    referralChain: chain.sort((a, b) => b.convertedAt - a.convertedAt)
  };
}

/**
 * Get available rewards for a user
 */
export function getAvailableRewards(userId: string): ReferralReward[] {
  const stats = getReferralStats(userId);
  const claimed = userRewardsClaimed.get(userId) || new Set();
  
  return REFERRAL_ACHIEVEMENTS.map(reward => ({
    ...reward,
    claimed: claimed.has(reward.id),
    claimedAt: claimed.has(reward.id) ? Date.now() : undefined // Would need proper tracking in production
  })).filter(r => stats.convertedReferrals >= r.requiredReferrals || r.claimed);
}

/**
 * Claim a referral reward
 */
export function claimReward(userId: string, rewardId: string): { success: boolean; reward?: ReferralReward; error?: string } {
  const stats = getReferralStats(userId);
  const reward = REFERRAL_ACHIEVEMENTS.find(r => r.id === rewardId);
  
  if (!reward) {
    return { success: false, error: 'Reward not found' };
  }
  
  if (stats.convertedReferrals < reward.requiredReferrals) {
    return { success: false, error: `You need ${reward.requiredReferrals} referrals to claim this reward` };
  }
  
  if (hasClaimedReward(userId, rewardId)) {
    return { success: false, error: 'Reward already claimed' };
  }
  
  // Mark as claimed
  if (!userRewardsClaimed.has(userId)) {
    userRewardsClaimed.set(userId, new Set());
  }
  userRewardsClaimed.get(userId)!.add(rewardId);
  
  return { 
    success: true, 
    reward: { ...reward, claimed: true, claimedAt: Date.now() } 
  };
}

/**
 * Check if user has claimed a reward
 */
export function hasClaimedReward(userId: string, rewardId: string): boolean {
  return userRewardsClaimed.get(userId)?.has(rewardId) || false;
}

/**
 * Get referral leaderboard
 */
export function getReferralLeaderboard(limit: number = 20): ReferralLeaderboardEntry[] {
  const entries: ReferralLeaderboardEntry[] = [];
  
  for (const [userId, refIds] of userReferrals) {
    let converted = 0;
    for (const refId of refIds) {
      const ref = referrals.get(refId);
      if (ref && (ref.status === 'converted' || ref.status === 'rewarded')) {
        converted++;
      }
    }
    
    if (converted > 0) {
      entries.push({
        rank: 0,
        userId,
        totalReferrals: refIds.size,
        convertedReferrals: converted,
        tier: getTierForReferralCount(converted)
      });
    }
  }
  
  // Sort by converted referrals
  entries.sort((a, b) => b.convertedReferrals - a.convertedReferrals);
  
  // Assign ranks
  return entries.slice(0, limit).map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
    badge: idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : undefined
  }));
}

/**
 * Get who referred a user
 */
export function getReferrer(userId: string): string | null {
  return referredBy.get(userId) || null;
}

/**
 * Get conversion funnel stats
 */
export function getConversionFunnel(): ConversionFunnel {
  let clicks = 0;
  let codeApplied = 0;
  let converted = 0;
  
  for (const count of codeClicks.values()) {
    clicks += count;
  }
  
  for (const ref of referrals.values()) {
    codeApplied++;
    if (ref.status === 'converted' || ref.status === 'rewarded') {
      converted++;
    }
  }
  
  return {
    clicks,
    codeApplied,
    signupStarted: codeApplied, // Would track separately in production
    signupCompleted: converted,
    firstTrade: Math.floor(converted * 0.7), // Placeholder
    active7Days: Math.floor(converted * 0.5) // Placeholder
  };
}

/**
 * Get UTM analytics
 */
export function getUTMAnalytics(): Array<{
  source: string;
  medium: string;
  campaign: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
}> {
  const results = [];
  
  for (const [key, stats] of utmStats) {
    const [source, medium, campaign] = key.split('|');
    results.push({
      source,
      medium,
      campaign,
      clicks: stats.clicks,
      conversions: stats.conversions,
      conversionRate: stats.clicks > 0 ? (stats.conversions / stats.clicks) * 100 : 0
    });
  }
  
  return results.sort((a, b) => b.conversions - a.conversions);
}

/**
 * Generate share links
 */
export function getShareLinks(code: string, baseUrl: string = 'https://oracle.alpha'): {
  direct: string;
  twitter: string;
  telegram: string;
  copy: string;
} {
  const referralUrl = `${baseUrl}/?ref=${code}`;
  const text = encodeURIComponent(`🔮 Join Oracle Alpha - The smartest memecoin signal aggregator! Use my code ${code} for exclusive perks 🚀`);
  
  return {
    direct: referralUrl,
    twitter: `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(referralUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${text}`,
    copy: referralUrl
  };
}

/**
 * Get referral code details by code
 */
export function getCodeByCode(code: string): ReferralCode | null {
  return referralCodes.get(code.toUpperCase()) || null;
}

/**
 * Get all referrals for a user (detailed)
 */
export function getUserReferralsDetailed(userId: string): Referral[] {
  const refIds = userReferrals.get(userId);
  if (!refIds) return [];
  
  const results: Referral[] = [];
  for (const refId of refIds) {
    const ref = referrals.get(refId);
    if (ref) results.push(ref);
  }
  
  return results.sort((a, b) => b.createdAt - a.createdAt);
}

// === DEMO DATA ===

/**
 * Generate demo referral data
 */
export function generateDemoReferralData(): void {
  // Create some demo users with referral codes
  const demoUsers = [
    'whale_hunter_69',
    'solana_maxi',
    'degen_trader',
    'alpha_seeker',
    'pump_master',
    'moon_boy_420',
    'crypto_king',
    'signal_sniper'
  ];
  
  // Create codes for demo users
  for (const userId of demoUsers) {
    getReferralCode(userId);
  }
  
  // Create some vanity codes for top users
  requestVanityCode('whale_hunter_69', 'WHALE');
  requestVanityCode('solana_maxi', 'SOLANA');
  requestVanityCode('alpha_seeker', 'ALPHA');
  
  // Wait - we need to give them enough referrals first for vanity codes
  // Let's create referrals to boost their stats
  
  // Create referrals for whale_hunter_69 (make them a legend)
  for (let i = 0; i < 150; i++) {
    const newUserId = `referred_user_${i}`;
    const result = applyReferralCode(newUserId, 'ORACLE-' + userReferralCodes.get('whale_hunter_69')?.slice(7) || '', {
      source: ['twitter', 'telegram', 'discord'][Math.floor(Math.random() * 3)],
      medium: 'social',
      campaign: 'launch'
    });
    if (result.success && Math.random() > 0.3) {
      convertReferral(newUserId);
    }
  }
  
  // Now try vanity codes again
  const code1 = getReferralCode('whale_hunter_69');
  if (code1) {
    requestVanityCode('whale_hunter_69', 'WHALE');
  }
  
  // Create referrals for other users
  const referralCounts = {
    'solana_maxi': 75,
    'degen_trader': 45,
    'alpha_seeker': 30,
    'pump_master': 15,
    'moon_boy_420': 8,
    'crypto_king': 3,
    'signal_sniper': 1
  };
  
  let userIdx = 200;
  for (const [userId, count] of Object.entries(referralCounts)) {
    const code = getReferralCode(userId);
    for (let i = 0; i < count; i++) {
      const newUserId = `user_${userIdx++}`;
      const result = applyReferralCode(newUserId, code.code, {
        source: ['twitter', 'telegram', 'discord', 'youtube'][Math.floor(Math.random() * 4)],
        medium: ['social', 'organic', 'paid'][Math.floor(Math.random() * 3)],
        campaign: ['launch', 'promo', 'contest'][Math.floor(Math.random() * 3)]
      });
      if (result.success && Math.random() > 0.25) {
        convertReferral(newUserId);
      }
    }
  }
  
  // Now assign vanity codes to those who qualify
  requestVanityCode('solana_maxi', 'SOLANA');
  requestVanityCode('alpha_seeker', 'ALPHA');
  requestVanityCode('degen_trader', 'DEGEN');
  
  // Add some clicks
  for (const [code] of referralCodes) {
    const extraClicks = Math.floor(Math.random() * 500);
    for (let i = 0; i < extraClicks; i++) {
      trackReferralClick(code, {
        source: ['twitter', 'telegram', 'google'][Math.floor(Math.random() * 3)]
      });
    }
  }
}

// === EXPORTS ===

export {
  REFERRER_TIERS as tiers,
  REFERRAL_ACHIEVEMENTS as achievements,
  generateDemoReferralData as generateDemo
};
