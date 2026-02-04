// Telegram Mini App Types

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: number;
    hash?: string;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  close: () => void;
  expand: () => void;
  ready: () => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text?: string;
    }>;
  }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// Signal types (matching backend)
export interface Signal {
  id: string;
  timestamp: number;
  token: string;
  symbol: string;
  name: string;
  score: number;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  confluence?: {
    uniqueSources: number;
    sourceTypes: string[];
    confluenceBoost: number;
    convictionLevel: 'STANDARD' | 'HIGH_CONVICTION' | 'ULTRA';
  };
  safety?: {
    safetyScore: number;
    riskCategory: 'SAFE' | 'CAUTION' | 'RISKY';
    redFlags: Array<{
      type: string;
      description: string;
      severity: string;
      points: number;
    }>;
  };
  sources: Array<{
    source: string;
    weight: number;
    rawScore: number;
  }>;
  marketData: {
    price?: number;
    mcap: number;
    liquidity: number;
    volume5m: number;
    volume1h: number;
    priceChange5m: number;
    priceChange1h: number;
    holders?: number;
    age: number;
  };
  analysis: {
    narrative: string[];
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
  };
  performance?: {
    entryPrice: number;
    currentPrice: number;
    athPrice: number;
    roi: number;
    athRoi: number;
    status: 'OPEN' | 'WIN' | 'LOSS';
  };
}

// User stats
export interface UserStats {
  telegramId: number;
  username?: string;
  level: number;
  xp: number;
  title: string;
  badge: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalRoi: number;
  currentStreak: number;
  maxStreak: number;
  achievements: Array<{
    id: string;
    name: string;
    icon: string;
    unlockedAt: number;
  }>;
  paperPortfolio?: {
    balance: number;
    holdings: Array<{
      token: string;
      symbol: string;
      amount: number;
      entryPrice: number;
      currentPrice: number;
      pnl: number;
    }>;
  };
}

// Paper trade
export interface PaperTrade {
  id: string;
  userId: number;
  token: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  timestamp: number;
  signalId?: string;
}

// Navigation
export type View = 'feed' | 'signal' | 'stats' | 'trade' | 'journal' | 'journal-entry' | 'journal-form' | 'journal-analytics';

// Journal types
export type JournalEntryType = 'trade' | 'note' | 'lesson' | 'idea';
export type MoodType = 'confident' | 'uncertain' | 'fomo' | 'fear';

export interface JournalEntry {
  id: string;
  tradeId?: string;
  signalId?: string;
  token?: string;
  timestamp: number;
  type: JournalEntryType;
  title: string;
  content: string;
  tags: string[];
  mood?: MoodType;
  screenshot?: string;
  outcome?: 'win' | 'loss' | 'breakeven' | 'pending';
  pnl?: number;
  lessonCategory?: string;
}

export interface JournalSummary {
  totalEntries: number;
  thisWeek: number;
  lessonsLearned: number;
  avgMood: string;
  winRate: number;
}

export interface JournalAnalytics {
  totalEntries: number;
  entriesByType: Record<JournalEntryType, number>;
  entriesByMood: Record<MoodType, number>;
  moodVsOutcome: Array<{
    mood: MoodType;
    wins: number;
    losses: number;
    winRate: number;
    avgPnl: number;
  }>;
  topTags: Array<{ tag: string; count: number }>;
  commonMistakes: Array<{ lesson: string; count: number; category?: string }>;
  bestStrategies: Array<{ tag: string; winRate: number; avgPnl: number; trades: number }>;
  recentLessons: JournalEntry[];
  streaks: {
    currentWinStreak: number;
    maxWinStreak: number;
    currentLossStreak: number;
    maxLossStreak: number;
  };
}
