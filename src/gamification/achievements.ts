/**
 * Achievement & Gamification System
 * Track user progress, award badges, and manage XP/levels
 */

// === TYPES ===

export type AchievementCategory = 'TRADING' | 'DISCOVERY' | 'SOCIAL' | 'SKILL' | 'SPECIAL';
export type AchievementTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'LEGENDARY';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
  xpReward: number;
  requirement: AchievementRequirement;
  secret?: boolean; // Hidden until unlocked
}

export interface AchievementRequirement {
  type: RequirementType;
  threshold: number;
  conditions?: Record<string, any>;
}

export type RequirementType =
  | 'trade_count'
  | 'win_count'
  | 'win_streak'
  | 'hold_duration_days'
  | 'profit_within_hours'
  | 'early_signal_rank'
  | 'consecutive_winners'
  | 'whale_follow_multiplier'
  | 'shares_count'
  | 'share_views'
  | 'max_loss_percentage'
  | 'unique_tokens_traded'
  | 'trade_at_hour'
  | 'total_roi'
  | 'single_trade_roi'
  | 'signals_viewed'
  | 'portfolio_value'
  | 'daily_login_streak'
  | 'signals_shared_monthly'
  | 'high_conviction_trades'
  | 'perfect_day'
  | 'comeback_king';

export interface UserAchievement {
  achievementId: string;
  unlockedAt: number;
  progress: number;
  notified: boolean;
}

export interface UserProgress {
  id: string;
  wallet?: string;
  // XP & Leveling
  xp: number;
  level: number;
  xpToNextLevel: number;
  
  // Achievements
  achievements: UserAchievement[];
  totalAchievements: number;
  
  // Tracking stats for achievement progress
  stats: UserStats;
  
  // Daily challenges
  dailyChallenges: DailyChallenge[];
  weeklyChallenges: WeeklyChallenge[];
  
  // Timestamps
  createdAt: number;
  lastActive: number;
  lastDailyReset: number;
  lastWeeklyReset: number;
}

export interface UserStats {
  // Trading
  totalTrades: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
  maxWinStreak: number;
  
  // ROI tracking
  totalRoi: number;
  bestSingleTradeRoi: number;
  worstSingleTradeRoi: number;
  
  // Time-based
  longestHoldDays: number;
  quickestProfitHours: number;
  tradesAt3am: number;
  
  // Discovery
  earlySignalCount: number; // Signals caught before 10 others
  consecutiveWinners: number;
  whaleFollowMultipliers: number[]; // Track whale follow results
  
  // Social
  sharesCount: number;
  totalShareViews: number;
  
  // Skill
  uniqueTokensTraded: Set<string>;
  maxLossPercentage: number;
  
  // Engagement
  signalsViewed: number;
  dailyLoginStreak: number;
  lastLoginDate: string;
  highConvictionTrades: number;
  perfectDays: number; // Days with 100% win rate
  comebacks: number; // Recovered from -50% to profit
  
  // Challenges completed
  dailyChallengesCompleted: number;
  weeklyChallengesCompleted: number;
}

export interface DailyChallenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: ChallengeRequirement;
  xpReward: number;
  progress: number;
  completed: boolean;
  expiresAt: number;
}

export interface WeeklyChallenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: ChallengeRequirement;
  xpReward: number;
  progress: number;
  completed: boolean;
  expiresAt: number;
}

export interface ChallengeRequirement {
  type: RequirementType;
  threshold: number;
}

export interface AchievementUnlock {
  achievement: Achievement;
  user: UserProgress;
  timestamp: number;
  isNew: boolean;
  levelUp?: {
    oldLevel: number;
    newLevel: number;
    rewards: string[];
  };
}

// === ACHIEVEMENTS DEFINITIONS ===

export const ACHIEVEMENTS: Achievement[] = [
  // === TRADING ACHIEVEMENTS ===
  {
    id: 'first_trade',
    name: 'First Steps',
    description: 'Complete your first trade',
    category: 'TRADING',
    tier: 'BRONZE',
    icon: '🎯',
    xpReward: 50,
    requirement: { type: 'trade_count', threshold: 1 }
  },
  {
    id: 'ten_trades',
    name: 'Getting Started',
    description: 'Complete 10 trades',
    category: 'TRADING',
    tier: 'BRONZE',
    icon: '📈',
    xpReward: 100,
    requirement: { type: 'trade_count', threshold: 10 }
  },
  {
    id: 'hundred_trades',
    name: 'Seasoned Trader',
    description: 'Complete 100 trades',
    category: 'TRADING',
    tier: 'SILVER',
    icon: '💹',
    xpReward: 500,
    requirement: { type: 'trade_count', threshold: 100 }
  },
  {
    id: 'thousand_trades',
    name: 'Trading Machine',
    description: 'Complete 1,000 trades',
    category: 'TRADING',
    tier: 'GOLD',
    icon: '🤖',
    xpReward: 2000,
    requirement: { type: 'trade_count', threshold: 1000 }
  },
  {
    id: 'first_win',
    name: 'Winner!',
    description: 'Win your first trade',
    category: 'TRADING',
    tier: 'BRONZE',
    icon: '🏆',
    xpReward: 75,
    requirement: { type: 'win_count', threshold: 1 }
  },
  {
    id: 'ten_wins',
    name: '10x Winner',
    description: 'Win 10 trades',
    category: 'TRADING',
    tier: 'BRONZE',
    icon: '🎖️',
    xpReward: 200,
    requirement: { type: 'win_count', threshold: 10 }
  },
  {
    id: 'hundred_wins',
    name: '100x Champion',
    description: 'Win 100 trades',
    category: 'TRADING',
    tier: 'SILVER',
    icon: '👑',
    xpReward: 1000,
    requirement: { type: 'win_count', threshold: 100 }
  },
  {
    id: 'diamond_hands',
    name: 'Diamond Hands',
    description: 'Hold a position for 7 days',
    category: 'TRADING',
    tier: 'SILVER',
    icon: '💎',
    xpReward: 300,
    requirement: { type: 'hold_duration_days', threshold: 7 }
  },
  {
    id: 'diamond_hands_30',
    name: 'Ultimate Diamond Hands',
    description: 'Hold a position for 30 days',
    category: 'TRADING',
    tier: 'GOLD',
    icon: '💎💎',
    xpReward: 1000,
    requirement: { type: 'hold_duration_days', threshold: 30 }
  },
  {
    id: 'quick_flip',
    name: 'Quick Flip',
    description: 'Make a profit in under 1 hour',
    category: 'TRADING',
    tier: 'BRONZE',
    icon: '⚡',
    xpReward: 150,
    requirement: { type: 'profit_within_hours', threshold: 1 }
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Make a profit in under 15 minutes',
    category: 'TRADING',
    tier: 'SILVER',
    icon: '🏎️',
    xpReward: 400,
    requirement: { type: 'profit_within_hours', threshold: 0.25 }
  },
  {
    id: 'hot_streak_3',
    name: 'Hot Streak',
    description: 'Win 3 trades in a row',
    category: 'TRADING',
    tier: 'BRONZE',
    icon: '🔥',
    xpReward: 200,
    requirement: { type: 'win_streak', threshold: 3 }
  },
  {
    id: 'hot_streak_5',
    name: 'On Fire',
    description: 'Win 5 trades in a row',
    category: 'TRADING',
    tier: 'SILVER',
    icon: '🔥🔥',
    xpReward: 500,
    requirement: { type: 'win_streak', threshold: 5 }
  },
  {
    id: 'hot_streak_10',
    name: 'Unstoppable',
    description: 'Win 10 trades in a row',
    category: 'TRADING',
    tier: 'GOLD',
    icon: '🌟',
    xpReward: 1500,
    requirement: { type: 'win_streak', threshold: 10 }
  },

  // === DISCOVERY ACHIEVEMENTS ===
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Act on a signal before 10 others',
    category: 'DISCOVERY',
    tier: 'BRONZE',
    icon: '🐦',
    xpReward: 200,
    requirement: { type: 'early_signal_rank', threshold: 10 }
  },
  {
    id: 'alpha_hunter',
    name: 'Alpha Hunter',
    description: 'Act on a signal first (before anyone else)',
    category: 'DISCOVERY',
    tier: 'GOLD',
    icon: '🦅',
    xpReward: 750,
    requirement: { type: 'early_signal_rank', threshold: 1 }
  },
  {
    id: 'trend_spotter',
    name: 'Trend Spotter',
    description: 'Pick 3 winners in a row',
    category: 'DISCOVERY',
    tier: 'SILVER',
    icon: '🔮',
    xpReward: 400,
    requirement: { type: 'consecutive_winners', threshold: 3 }
  },
  {
    id: 'oracle_vision',
    name: 'Oracle Vision',
    description: 'Pick 5 winners in a row',
    category: 'DISCOVERY',
    tier: 'GOLD',
    icon: '👁️',
    xpReward: 1000,
    requirement: { type: 'consecutive_winners', threshold: 5 }
  },
  {
    id: 'whale_watcher',
    name: 'Whale Watcher',
    description: 'Follow a whale signal to 5x gains',
    category: 'DISCOVERY',
    tier: 'SILVER',
    icon: '🐋',
    xpReward: 500,
    requirement: { type: 'whale_follow_multiplier', threshold: 5 }
  },
  {
    id: 'whale_rider',
    name: 'Whale Rider',
    description: 'Follow a whale signal to 10x gains',
    category: 'DISCOVERY',
    tier: 'GOLD',
    icon: '🐋👑',
    xpReward: 1200,
    requirement: { type: 'whale_follow_multiplier', threshold: 10 }
  },
  {
    id: 'signal_scout',
    name: 'Signal Scout',
    description: 'View 100 signals',
    category: 'DISCOVERY',
    tier: 'BRONZE',
    icon: '🔍',
    xpReward: 100,
    requirement: { type: 'signals_viewed', threshold: 100 }
  },
  {
    id: 'signal_master',
    name: 'Signal Master',
    description: 'View 1,000 signals',
    category: 'DISCOVERY',
    tier: 'SILVER',
    icon: '📡',
    xpReward: 400,
    requirement: { type: 'signals_viewed', threshold: 1000 }
  },

  // === SOCIAL ACHIEVEMENTS ===
  {
    id: 'sharer',
    name: 'Sharer',
    description: 'Share 5 signals',
    category: 'SOCIAL',
    tier: 'BRONZE',
    icon: '📤',
    xpReward: 100,
    requirement: { type: 'shares_count', threshold: 5 }
  },
  {
    id: 'broadcaster',
    name: 'Broadcaster',
    description: 'Share 25 signals',
    category: 'SOCIAL',
    tier: 'SILVER',
    icon: '📢',
    xpReward: 300,
    requirement: { type: 'shares_count', threshold: 25 }
  },
  {
    id: 'influencer',
    name: 'Influencer',
    description: 'Get 100 views on shared signals',
    category: 'SOCIAL',
    tier: 'SILVER',
    icon: '⭐',
    xpReward: 400,
    requirement: { type: 'share_views', threshold: 100 }
  },
  {
    id: 'viral_trader',
    name: 'Viral Trader',
    description: 'Get 1,000 views on shared signals',
    category: 'SOCIAL',
    tier: 'GOLD',
    icon: '🌐',
    xpReward: 1000,
    requirement: { type: 'share_views', threshold: 1000 }
  },
  {
    id: 'community_hero',
    name: 'Community Hero',
    description: 'Share 100 signals in a month',
    category: 'SOCIAL',
    tier: 'GOLD',
    icon: '🦸',
    xpReward: 800,
    requirement: { type: 'signals_shared_monthly', threshold: 100 }
  },

  // === SKILL ACHIEVEMENTS ===
  {
    id: 'risk_manager',
    name: 'Risk Manager',
    description: 'Never lose more than 10% on any trade',
    category: 'SKILL',
    tier: 'SILVER',
    icon: '🛡️',
    xpReward: 500,
    requirement: { type: 'max_loss_percentage', threshold: -10, conditions: { minTrades: 20 } }
  },
  {
    id: 'iron_hands',
    name: 'Iron Hands',
    description: 'Never lose more than 5% on any trade',
    category: 'SKILL',
    tier: 'GOLD',
    icon: '🦾',
    xpReward: 1000,
    requirement: { type: 'max_loss_percentage', threshold: -5, conditions: { minTrades: 50 } }
  },
  {
    id: 'diversified',
    name: 'Diversified',
    description: 'Trade 10 different tokens',
    category: 'SKILL',
    tier: 'BRONZE',
    icon: '🎨',
    xpReward: 150,
    requirement: { type: 'unique_tokens_traded', threshold: 10 }
  },
  {
    id: 'portfolio_builder',
    name: 'Portfolio Builder',
    description: 'Trade 50 different tokens',
    category: 'SKILL',
    tier: 'SILVER',
    icon: '📊',
    xpReward: 500,
    requirement: { type: 'unique_tokens_traded', threshold: 50 }
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a trade at 3 AM',
    category: 'SKILL',
    tier: 'BRONZE',
    icon: '🦉',
    xpReward: 100,
    requirement: { type: 'trade_at_hour', threshold: 3 }
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Achieve 500% total ROI',
    category: 'SKILL',
    tier: 'GOLD',
    icon: '🎰',
    xpReward: 1500,
    requirement: { type: 'total_roi', threshold: 500 }
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    description: 'Make 1000% on a single trade',
    category: 'SKILL',
    tier: 'DIAMOND',
    icon: '🌙',
    xpReward: 2500,
    requirement: { type: 'single_trade_roi', threshold: 1000 }
  },
  {
    id: 'high_conviction_trader',
    name: 'High Conviction Trader',
    description: 'Trade 10 HIGH_CONVICTION signals',
    category: 'SKILL',
    tier: 'SILVER',
    icon: '💪',
    xpReward: 400,
    requirement: { type: 'high_conviction_trades', threshold: 10 }
  },
  {
    id: 'perfect_day',
    name: 'Perfect Day',
    description: 'Have a day with 100% win rate (3+ trades)',
    category: 'SKILL',
    tier: 'SILVER',
    icon: '✨',
    xpReward: 350,
    requirement: { type: 'perfect_day', threshold: 1 }
  },
  {
    id: 'comeback_king',
    name: 'Comeback King',
    description: 'Recover from -50% to profit in a single position',
    category: 'SKILL',
    tier: 'GOLD',
    icon: '👑',
    xpReward: 800,
    requirement: { type: 'comeback_king', threshold: 1 }
  },

  // === SPECIAL ACHIEVEMENTS ===
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Join ORACLE during beta',
    category: 'SPECIAL',
    tier: 'LEGENDARY',
    icon: '🚀',
    xpReward: 1000,
    requirement: { type: 'trade_count', threshold: 1 },
    secret: true
  },
  {
    id: 'daily_warrior_7',
    name: 'Daily Warrior',
    description: 'Log in 7 days in a row',
    category: 'SPECIAL',
    tier: 'BRONZE',
    icon: '📅',
    xpReward: 200,
    requirement: { type: 'daily_login_streak', threshold: 7 }
  },
  {
    id: 'daily_warrior_30',
    name: 'Monthly Legend',
    description: 'Log in 30 days in a row',
    category: 'SPECIAL',
    tier: 'SILVER',
    icon: '🗓️',
    xpReward: 750,
    requirement: { type: 'daily_login_streak', threshold: 30 }
  },
  {
    id: 'challenge_master',
    name: 'Challenge Master',
    description: 'Complete 50 daily challenges',
    category: 'SPECIAL',
    tier: 'GOLD',
    icon: '🏅',
    xpReward: 1000,
    requirement: { type: 'trade_count', threshold: 1 } // Special tracking
  }
];

// === LEVEL SYSTEM ===

export interface LevelInfo {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  perks: string[];
  badge: string;
}

export const LEVELS: LevelInfo[] = [
  { level: 1, title: 'Novice Trader', minXp: 0, maxXp: 100, perks: ['Basic dashboard access'], badge: '🌱' },
  { level: 2, title: 'Apprentice', minXp: 100, maxXp: 250, perks: ['Signal alerts'], badge: '📊' },
  { level: 3, title: 'Junior Trader', minXp: 250, maxXp: 500, perks: ['Price alerts'], badge: '📈' },
  { level: 4, title: 'Trader', minXp: 500, maxXp: 850, perks: ['Advanced filters'], badge: '💼' },
  { level: 5, title: 'Senior Trader', minXp: 850, maxXp: 1300, perks: ['Portfolio tracking'], badge: '🎯' },
  { level: 6, title: 'Expert Trader', minXp: 1300, maxXp: 1900, perks: ['Priority signals'], badge: '⭐' },
  { level: 7, title: 'Master Trader', minXp: 1900, maxXp: 2700, perks: ['Custom alerts'], badge: '🏆' },
  { level: 8, title: 'Elite Trader', minXp: 2700, maxXp: 3800, perks: ['Early access'], badge: '💎' },
  { level: 9, title: 'Grandmaster', minXp: 3800, maxXp: 5200, perks: ['Beta features'], badge: '👑' },
  { level: 10, title: 'Legend', minXp: 5200, maxXp: 7000, perks: ['Exclusive badge'], badge: '🌟' },
  { level: 11, title: 'Oracle Acolyte', minXp: 7000, maxXp: 9500, perks: ['Community recognition'], badge: '🔮' },
  { level: 12, title: 'Oracle Master', minXp: 9500, maxXp: 12500, perks: ['Leaderboard feature'], badge: '⚡' },
  { level: 13, title: 'Oracle Champion', minXp: 12500, maxXp: 16500, perks: ['Exclusive channels'], badge: '🦅' },
  { level: 14, title: 'Oracle Elder', minXp: 16500, maxXp: 21500, perks: ['Governance voting'], badge: '🐲' },
  { level: 15, title: 'Oracle Sovereign', minXp: 21500, maxXp: Infinity, perks: ['Ultimate status'], badge: '👁️‍🗨️' }
];

// === DATA STORE ===

const userProgress = new Map<string, UserProgress>();

// === HELPER FUNCTIONS ===

function createDefaultProgress(userId: string): UserProgress {
  const now = Date.now();
  return {
    id: userId,
    xp: 0,
    level: 1,
    xpToNextLevel: 100,
    achievements: [],
    totalAchievements: 0,
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      currentWinStreak: 0,
      maxWinStreak: 0,
      totalRoi: 0,
      bestSingleTradeRoi: 0,
      worstSingleTradeRoi: 0,
      longestHoldDays: 0,
      quickestProfitHours: Infinity,
      tradesAt3am: 0,
      earlySignalCount: 0,
      consecutiveWinners: 0,
      whaleFollowMultipliers: [],
      sharesCount: 0,
      totalShareViews: 0,
      uniqueTokensTraded: new Set(),
      maxLossPercentage: 0,
      signalsViewed: 0,
      dailyLoginStreak: 0,
      lastLoginDate: '',
      highConvictionTrades: 0,
      perfectDays: 0,
      comebacks: 0,
      dailyChallengesCompleted: 0,
      weeklyChallengesCompleted: 0
    },
    dailyChallenges: [],
    weeklyChallenges: [],
    createdAt: now,
    lastActive: now,
    lastDailyReset: now,
    lastWeeklyReset: now
  };
}

function calculateLevel(xp: number): { level: number; xpToNext: number; info: LevelInfo } {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) {
      const current = LEVELS[i];
      const xpToNext = current.maxXp === Infinity ? 0 : current.maxXp - xp;
      return { level: current.level, xpToNext, info: current };
    }
  }
  return { level: 1, xpToNext: 100, info: LEVELS[0] };
}

function getAchievementTierColor(tier: AchievementTier): string {
  const colors = {
    BRONZE: '#CD7F32',
    SILVER: '#C0C0C0',
    GOLD: '#FFD700',
    DIAMOND: '#B9F2FF',
    LEGENDARY: '#FF6B6B'
  };
  return colors[tier];
}

// === CHALLENGE GENERATION ===

const DAILY_CHALLENGE_TEMPLATES: Omit<DailyChallenge, 'id' | 'progress' | 'completed' | 'expiresAt'>[] = [
  { name: 'Active Trader', description: 'Complete 3 trades today', icon: '📈', requirement: { type: 'trade_count', threshold: 3 }, xpReward: 50 },
  { name: 'Winner', description: 'Win 2 trades today', icon: '🏆', requirement: { type: 'win_count', threshold: 2 }, xpReward: 75 },
  { name: 'Explorer', description: 'View 20 signals', icon: '🔍', requirement: { type: 'signals_viewed', threshold: 20 }, xpReward: 30 },
  { name: 'Sharer', description: 'Share 2 signals', icon: '📤', requirement: { type: 'shares_count', threshold: 2 }, xpReward: 40 },
  { name: 'Diversify', description: 'Trade 3 different tokens', icon: '🎨', requirement: { type: 'unique_tokens_traded', threshold: 3 }, xpReward: 60 },
  { name: 'Hot Streak', description: 'Win 2 trades in a row', icon: '🔥', requirement: { type: 'win_streak', threshold: 2 }, xpReward: 100 },
  { name: 'High Conviction', description: 'Trade a HIGH_CONVICTION signal', icon: '💪', requirement: { type: 'high_conviction_trades', threshold: 1 }, xpReward: 50 },
  { name: 'Quick Profit', description: 'Make profit within 2 hours', icon: '⚡', requirement: { type: 'profit_within_hours', threshold: 2 }, xpReward: 80 }
];

const WEEKLY_CHALLENGE_TEMPLATES: Omit<WeeklyChallenge, 'id' | 'progress' | 'completed' | 'expiresAt'>[] = [
  { name: 'Weekly Warrior', description: 'Complete 15 trades this week', icon: '⚔️', requirement: { type: 'trade_count', threshold: 15 }, xpReward: 200 },
  { name: 'Consistent Winner', description: 'Win 10 trades this week', icon: '🏅', requirement: { type: 'win_count', threshold: 10 }, xpReward: 300 },
  { name: 'Social Butterfly', description: 'Share 10 signals this week', icon: '🦋', requirement: { type: 'shares_count', threshold: 10 }, xpReward: 150 },
  { name: 'Portfolio Expander', description: 'Trade 10 unique tokens', icon: '📊', requirement: { type: 'unique_tokens_traded', threshold: 10 }, xpReward: 250 },
  { name: 'Streak Master', description: 'Achieve a 5-win streak', icon: '🔥', requirement: { type: 'win_streak', threshold: 5 }, xpReward: 400 },
  { name: 'Signal Analyst', description: 'View 100 signals', icon: '📡', requirement: { type: 'signals_viewed', threshold: 100 }, xpReward: 175 }
];

function generateDailyChallenges(): DailyChallenge[] {
  const now = Date.now();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  // Pick 3 random challenges
  const shuffled = [...DAILY_CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);
  
  return selected.map((template, idx) => ({
    ...template,
    id: `daily-${now}-${idx}`,
    progress: 0,
    completed: false,
    expiresAt: endOfDay.getTime()
  }));
}

function generateWeeklyChallenges(): WeeklyChallenge[] {
  const now = Date.now();
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  
  // Pick 2 random challenges
  const shuffled = [...WEEKLY_CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 2);
  
  return selected.map((template, idx) => ({
    ...template,
    id: `weekly-${now}-${idx}`,
    progress: 0,
    completed: false,
    expiresAt: endOfWeek.getTime()
  }));
}

// === CORE FUNCTIONS ===

/**
 * Get or create user progress
 */
export function getUserProgress(userId: string): UserProgress {
  let progress = userProgress.get(userId);
  
  if (!progress) {
    progress = createDefaultProgress(userId);
    userProgress.set(userId, progress);
  }
  
  // Check if daily/weekly challenges need reset
  const now = Date.now();
  const today = new Date().toDateString();
  
  // Reset daily challenges
  if (new Date(progress.lastDailyReset).toDateString() !== today) {
    progress.dailyChallenges = generateDailyChallenges();
    progress.lastDailyReset = now;
    
    // Update login streak
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (progress.stats.lastLoginDate === yesterday) {
      progress.stats.dailyLoginStreak++;
    } else if (progress.stats.lastLoginDate !== today) {
      progress.stats.dailyLoginStreak = 1;
    }
    progress.stats.lastLoginDate = today;
  }
  
  // Reset weekly challenges (Sunday)
  const lastResetWeek = getWeekNumber(new Date(progress.lastWeeklyReset));
  const currentWeek = getWeekNumber(new Date());
  if (lastResetWeek !== currentWeek) {
    progress.weeklyChallenges = generateWeeklyChallenges();
    progress.lastWeeklyReset = now;
  }
  
  // Initialize challenges if empty
  if (progress.dailyChallenges.length === 0) {
    progress.dailyChallenges = generateDailyChallenges();
  }
  if (progress.weeklyChallenges.length === 0) {
    progress.weeklyChallenges = generateWeeklyChallenges();
  }
  
  progress.lastActive = now;
  return progress;
}

function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

/**
 * Get all achievements with user's progress
 */
export function getAllAchievements(userId: string): Array<Achievement & { 
  unlocked: boolean; 
  progress: number; 
  unlockedAt?: number;
  progressPercent: number;
}> {
  const progress = getUserProgress(userId);
  const unlockedMap = new Map(progress.achievements.map(a => [a.achievementId, a]));
  
  return ACHIEVEMENTS.filter(a => !a.secret || unlockedMap.has(a.id)).map(achievement => {
    const userAchievement = unlockedMap.get(achievement.id);
    const currentProgress = userAchievement?.progress || 0;
    const progressPercent = Math.min(100, (currentProgress / achievement.requirement.threshold) * 100);
    
    return {
      ...achievement,
      unlocked: !!userAchievement,
      progress: currentProgress,
      unlockedAt: userAchievement?.unlockedAt,
      progressPercent
    };
  });
}

/**
 * Check and award achievements based on current stats
 */
export function checkAchievements(userId: string): AchievementUnlock[] {
  const progress = getUserProgress(userId);
  const unlocks: AchievementUnlock[] = [];
  
  for (const achievement of ACHIEVEMENTS) {
    // Skip if already unlocked
    if (progress.achievements.find(a => a.achievementId === achievement.id)) {
      continue;
    }
    
    const currentValue = getStatForRequirement(progress.stats, achievement.requirement);
    const meetsRequirement = checkRequirement(currentValue, achievement.requirement);
    
    if (meetsRequirement) {
      // Award achievement
      const userAchievement: UserAchievement = {
        achievementId: achievement.id,
        unlockedAt: Date.now(),
        progress: currentValue,
        notified: false
      };
      
      progress.achievements.push(userAchievement);
      progress.totalAchievements++;
      
      // Award XP
      const oldLevel = progress.level;
      progress.xp += achievement.xpReward;
      const levelInfo = calculateLevel(progress.xp);
      progress.level = levelInfo.level;
      progress.xpToNextLevel = levelInfo.xpToNext;
      
      const unlock: AchievementUnlock = {
        achievement,
        user: progress,
        timestamp: Date.now(),
        isNew: true
      };
      
      // Check for level up
      if (levelInfo.level > oldLevel) {
        unlock.levelUp = {
          oldLevel,
          newLevel: levelInfo.level,
          rewards: levelInfo.info.perks
        };
      }
      
      unlocks.push(unlock);
    } else {
      // Update progress tracking
      const existing = progress.achievements.find(a => a.achievementId === achievement.id);
      if (!existing) {
        // Track progress even if not unlocked
        updateAchievementProgress(progress, achievement.id, currentValue);
      }
    }
  }
  
  return unlocks;
}

function getStatForRequirement(stats: UserStats, requirement: AchievementRequirement): number {
  switch (requirement.type) {
    case 'trade_count': return stats.totalTrades;
    case 'win_count': return stats.wins;
    case 'win_streak': return stats.maxWinStreak;
    case 'hold_duration_days': return stats.longestHoldDays;
    case 'profit_within_hours': return stats.quickestProfitHours;
    case 'early_signal_rank': return stats.earlySignalCount;
    case 'consecutive_winners': return stats.consecutiveWinners;
    case 'whale_follow_multiplier': return Math.max(...(stats.whaleFollowMultipliers.length ? stats.whaleFollowMultipliers : [0]));
    case 'shares_count': return stats.sharesCount;
    case 'share_views': return stats.totalShareViews;
    case 'max_loss_percentage': return stats.maxLossPercentage;
    case 'unique_tokens_traded': return stats.uniqueTokensTraded.size;
    case 'trade_at_hour': return stats.tradesAt3am;
    case 'total_roi': return stats.totalRoi;
    case 'single_trade_roi': return stats.bestSingleTradeRoi;
    case 'signals_viewed': return stats.signalsViewed;
    case 'daily_login_streak': return stats.dailyLoginStreak;
    case 'high_conviction_trades': return stats.highConvictionTrades;
    case 'perfect_day': return stats.perfectDays;
    case 'comeback_king': return stats.comebacks;
    default: return 0;
  }
}

function checkRequirement(value: number, requirement: AchievementRequirement): boolean {
  switch (requirement.type) {
    case 'max_loss_percentage':
      // For max loss, the value should be LESS negative than threshold
      return requirement.conditions?.minTrades 
        ? value >= requirement.threshold
        : value >= requirement.threshold;
    case 'profit_within_hours':
      // For quickest profit, lower is better
      return value <= requirement.threshold && value > 0;
    default:
      return value >= requirement.threshold;
  }
}

function updateAchievementProgress(progress: UserProgress, achievementId: string, value: number): void {
  // This would be used for UI to show partial progress
  // In production, this could be stored separately for efficiency
}

// === STAT UPDATE FUNCTIONS ===

export interface TradeEvent {
  userId: string;
  token: string;
  symbol: string;
  entryPrice: number;
  exitPrice?: number;
  roi?: number;
  holdDurationMs?: number;
  isWin?: boolean;
  isWhaleSignal?: boolean;
  isHighConviction?: boolean;
  timestamp: number;
}

export interface SignalViewEvent {
  userId: string;
  signalId: string;
  viewRank?: number; // How early they viewed (1 = first)
}

export interface ShareEvent {
  userId: string;
  signalId: string;
  views?: number;
}

/**
 * Record a trade and update stats
 */
export function recordTrade(event: TradeEvent): AchievementUnlock[] {
  const progress = getUserProgress(event.userId);
  const stats = progress.stats;
  
  // Update trade count
  stats.totalTrades++;
  
  // Track unique tokens
  stats.uniqueTokensTraded.add(event.token);
  
  // Track trade time (for Night Owl)
  const tradeHour = new Date(event.timestamp).getHours();
  if (tradeHour === 3) {
    stats.tradesAt3am++;
  }
  
  // If trade is completed with outcome
  if (event.roi !== undefined) {
    stats.totalRoi += event.roi;
    
    if (event.roi > stats.bestSingleTradeRoi) {
      stats.bestSingleTradeRoi = event.roi;
    }
    if (event.roi < stats.worstSingleTradeRoi) {
      stats.worstSingleTradeRoi = event.roi;
      if (event.roi < stats.maxLossPercentage) {
        stats.maxLossPercentage = event.roi;
      }
    }
    
    if (event.isWin) {
      stats.wins++;
      stats.currentWinStreak++;
      stats.consecutiveWinners++;
      if (stats.currentWinStreak > stats.maxWinStreak) {
        stats.maxWinStreak = stats.currentWinStreak;
      }
    } else {
      stats.losses++;
      stats.currentWinStreak = 0;
      stats.consecutiveWinners = 0;
    }
    
    // Track whale follow multiplier
    if (event.isWhaleSignal && event.roi > 0) {
      const multiplier = 1 + (event.roi / 100);
      stats.whaleFollowMultipliers.push(multiplier);
    }
  }
  
  // Track hold duration
  if (event.holdDurationMs !== undefined) {
    const holdDays = event.holdDurationMs / (1000 * 60 * 60 * 24);
    if (holdDays > stats.longestHoldDays) {
      stats.longestHoldDays = holdDays;
    }
    
    // Track quickest profit
    if (event.roi && event.roi > 0) {
      const holdHours = event.holdDurationMs / (1000 * 60 * 60);
      if (holdHours < stats.quickestProfitHours) {
        stats.quickestProfitHours = holdHours;
      }
    }
  }
  
  // Track high conviction
  if (event.isHighConviction) {
    stats.highConvictionTrades++;
  }
  
  // Update challenges progress
  updateChallengesProgress(progress, 'trade_count', 1);
  if (event.isWin) {
    updateChallengesProgress(progress, 'win_count', 1);
    updateChallengesProgress(progress, 'win_streak', stats.currentWinStreak);
  }
  
  return checkAchievements(event.userId);
}

/**
 * Record a signal view
 */
export function recordSignalView(event: SignalViewEvent): AchievementUnlock[] {
  const progress = getUserProgress(event.userId);
  
  progress.stats.signalsViewed++;
  
  if (event.viewRank && event.viewRank <= 10) {
    progress.stats.earlySignalCount++;
  }
  
  updateChallengesProgress(progress, 'signals_viewed', 1);
  
  return checkAchievements(event.userId);
}

/**
 * Record a share
 */
export function recordShare(event: ShareEvent): AchievementUnlock[] {
  const progress = getUserProgress(event.userId);
  
  progress.stats.sharesCount++;
  if (event.views) {
    progress.stats.totalShareViews += event.views;
  }
  
  updateChallengesProgress(progress, 'shares_count', 1);
  
  return checkAchievements(event.userId);
}

/**
 * Update challenges progress
 */
function updateChallengesProgress(progress: UserProgress, type: RequirementType, increment: number): void {
  // Update daily challenges
  for (const challenge of progress.dailyChallenges) {
    if (challenge.requirement.type === type && !challenge.completed) {
      challenge.progress += increment;
      if (challenge.progress >= challenge.requirement.threshold) {
        challenge.completed = true;
        progress.xp += challenge.xpReward;
        progress.stats.dailyChallengesCompleted++;
        
        // Update level
        const levelInfo = calculateLevel(progress.xp);
        progress.level = levelInfo.level;
        progress.xpToNextLevel = levelInfo.xpToNext;
      }
    }
  }
  
  // Update weekly challenges
  for (const challenge of progress.weeklyChallenges) {
    if (challenge.requirement.type === type && !challenge.completed) {
      challenge.progress += increment;
      if (challenge.progress >= challenge.requirement.threshold) {
        challenge.completed = true;
        progress.xp += challenge.xpReward;
        progress.stats.weeklyChallengesCompleted++;
        
        // Update level
        const levelInfo = calculateLevel(progress.xp);
        progress.level = levelInfo.level;
        progress.xpToNextLevel = levelInfo.xpToNext;
      }
    }
  }
}

// === API-FRIENDLY FUNCTIONS ===

/**
 * Get user's achievements summary
 */
export function getAchievementsSummary(userId: string): {
  totalUnlocked: number;
  totalAvailable: number;
  recentUnlocks: UserAchievement[];
  byCategory: Record<AchievementCategory, { unlocked: number; total: number }>;
  byTier: Record<AchievementTier, { unlocked: number; total: number }>;
  xpFromAchievements: number;
} {
  const progress = getUserProgress(userId);
  const unlocked = new Set(progress.achievements.map(a => a.achievementId));
  
  const byCategory: Record<AchievementCategory, { unlocked: number; total: number }> = {
    TRADING: { unlocked: 0, total: 0 },
    DISCOVERY: { unlocked: 0, total: 0 },
    SOCIAL: { unlocked: 0, total: 0 },
    SKILL: { unlocked: 0, total: 0 },
    SPECIAL: { unlocked: 0, total: 0 }
  };
  
  const byTier: Record<AchievementTier, { unlocked: number; total: number }> = {
    BRONZE: { unlocked: 0, total: 0 },
    SILVER: { unlocked: 0, total: 0 },
    GOLD: { unlocked: 0, total: 0 },
    DIAMOND: { unlocked: 0, total: 0 },
    LEGENDARY: { unlocked: 0, total: 0 }
  };
  
  let xpFromAchievements = 0;
  
  for (const achievement of ACHIEVEMENTS) {
    byCategory[achievement.category].total++;
    byTier[achievement.tier].total++;
    
    if (unlocked.has(achievement.id)) {
      byCategory[achievement.category].unlocked++;
      byTier[achievement.tier].unlocked++;
      xpFromAchievements += achievement.xpReward;
    }
  }
  
  return {
    totalUnlocked: progress.achievements.length,
    totalAvailable: ACHIEVEMENTS.filter(a => !a.secret).length,
    recentUnlocks: progress.achievements
      .sort((a, b) => b.unlockedAt - a.unlockedAt)
      .slice(0, 5),
    byCategory,
    byTier,
    xpFromAchievements
  };
}

/**
 * Get daily challenges for user
 */
export function getDailyChallenges(userId: string): DailyChallenge[] {
  const progress = getUserProgress(userId);
  return progress.dailyChallenges;
}

/**
 * Get weekly challenges for user
 */
export function getWeeklyChallenges(userId: string): WeeklyChallenge[] {
  const progress = getUserProgress(userId);
  return progress.weeklyChallenges;
}

/**
 * Get level info for user
 */
export function getUserLevel(userId: string): {
  level: number;
  title: string;
  badge: string;
  xp: number;
  xpToNextLevel: number;
  xpProgress: number;
  perks: string[];
  nextLevelTitle?: string;
} {
  const progress = getUserProgress(userId);
  const levelInfo = LEVELS[progress.level - 1] || LEVELS[0];
  const nextLevel = LEVELS[progress.level] || null;
  
  const xpInLevel = progress.xp - levelInfo.minXp;
  const xpForLevel = levelInfo.maxXp - levelInfo.minXp;
  const xpProgress = levelInfo.maxXp === Infinity ? 100 : Math.min(100, (xpInLevel / xpForLevel) * 100);
  
  return {
    level: progress.level,
    title: levelInfo.title,
    badge: levelInfo.badge,
    xp: progress.xp,
    xpToNextLevel: progress.xpToNextLevel,
    xpProgress,
    perks: levelInfo.perks,
    nextLevelTitle: nextLevel?.title
  };
}

/**
 * Get shareable achievement card data
 */
export function getShareableAchievement(userId: string, achievementId: string): {
  achievement: Achievement;
  user: { level: number; title: string; badge: string };
  unlockedAt: number;
  shareText: string;
  shareUrl: string;
} | null {
  const progress = getUserProgress(userId);
  const userAchievement = progress.achievements.find(a => a.achievementId === achievementId);
  
  if (!userAchievement) return null;
  
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return null;
  
  const levelInfo = getUserLevel(userId);
  
  return {
    achievement,
    user: {
      level: levelInfo.level,
      title: levelInfo.title,
      badge: levelInfo.badge
    },
    unlockedAt: userAchievement.unlockedAt,
    shareText: `🏆 I just unlocked "${achievement.name}" on ORACLE Alpha! ${achievement.icon}\n\n${achievement.description}\n\n🔮 Track verifiable on-chain signals`,
    shareUrl: `https://oracle.alpha/achievement/${achievementId}?u=${userId}`
  };
}

/**
 * Mark achievement as notified
 */
export function markAchievementNotified(userId: string, achievementId: string): void {
  const progress = getUserProgress(userId);
  const achievement = progress.achievements.find(a => a.achievementId === achievementId);
  if (achievement) {
    achievement.notified = true;
  }
}

/**
 * Get unnotified achievements
 */
export function getUnnotifiedAchievements(userId: string): AchievementUnlock[] {
  const progress = getUserProgress(userId);
  const unnotified = progress.achievements.filter(a => !a.notified);
  
  return unnotified.map(ua => {
    const achievement = ACHIEVEMENTS.find(a => a.id === ua.achievementId)!;
    return {
      achievement,
      user: progress,
      timestamp: ua.unlockedAt,
      isNew: true
    };
  });
}

// === DEMO DATA ===

/**
 * Generate demo user with progress
 */
export function generateDemoUser(userId: string = 'demo-user'): UserProgress {
  const progress = createDefaultProgress(userId);
  
  // Set some stats
  progress.stats.totalTrades = 47;
  progress.stats.wins = 32;
  progress.stats.losses = 15;
  progress.stats.currentWinStreak = 4;
  progress.stats.maxWinStreak = 7;
  progress.stats.totalRoi = 245.5;
  progress.stats.bestSingleTradeRoi = 342.5;
  progress.stats.worstSingleTradeRoi = -35.2;
  progress.stats.longestHoldDays = 5;
  progress.stats.quickestProfitHours = 0.5;
  progress.stats.sharesCount = 12;
  progress.stats.signalsViewed = 234;
  progress.stats.dailyLoginStreak = 8;
  progress.stats.uniqueTokensTraded = new Set(['PEPE', 'WIF', 'BONK', 'POPCAT', 'MOG', 'BRETT', 'TURBO', 'ANDY']);
  
  // Award some achievements
  const achievementsToAward = [
    'first_trade', 'ten_trades', 'first_win', 'ten_wins',
    'quick_flip', 'hot_streak_3', 'diversified', 'sharer',
    'signal_scout', 'daily_warrior_7'
  ];
  
  for (const id of achievementsToAward) {
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
      progress.achievements.push({
        achievementId: id,
        unlockedAt: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
        progress: achievement.requirement.threshold,
        notified: true
      });
      progress.xp += achievement.xpReward;
    }
  }
  
  progress.totalAchievements = progress.achievements.length;
  
  // Calculate level
  const levelInfo = calculateLevel(progress.xp);
  progress.level = levelInfo.level;
  progress.xpToNextLevel = levelInfo.xpToNext;
  
  userProgress.set(userId, progress);
  return progress;
}

// === EXPORTS ===

export {
  ACHIEVEMENTS as achievements,
  LEVELS as levels,
  getAchievementTierColor
};
