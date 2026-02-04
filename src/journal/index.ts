// Trading Journal Module
// Notes, lessons learned, screenshots, and mood tracking per trade

import * as fs from 'fs';
import * as path from 'path';

// ===== TYPES =====

export type JournalEntryType = 'trade' | 'note' | 'lesson' | 'idea';
export type MoodType = 'confident' | 'uncertain' | 'fomo' | 'fear';

export interface JournalEntry {
  id: string;
  tradeId?: string;       // Link to paper trade
  signalId?: string;      // Link to signal
  token?: string;         // Token CA
  timestamp: number;
  type: JournalEntryType;
  title: string;
  content: string;
  tags: string[];
  mood?: MoodType;
  screenshot?: string;    // URL to screenshot
  outcome?: 'win' | 'loss' | 'breakeven' | 'pending';
  pnl?: number;           // Profit/Loss in %
  lessonCategory?: string; // For lessons: "risk", "timing", "fomo", "patience", etc.
}

export interface JournalFilter {
  type?: JournalEntryType;
  tags?: string[];
  mood?: MoodType;
  token?: string;
  signalId?: string;
  tradeId?: string;
  startDate?: number;
  endDate?: number;
  outcome?: string;
  search?: string;
  limit?: number;
  offset?: number;
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

// ===== STORAGE =====

const DATA_DIR = path.join(__dirname, '../../data');
const JOURNAL_FILE = path.join(DATA_DIR, 'journal.json');

// In-memory store
let journalEntries: JournalEntry[] = [];

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load journal from file
export function loadJournal(): void {
  ensureDataDir();
  try {
    if (fs.existsSync(JOURNAL_FILE)) {
      const data = fs.readFileSync(JOURNAL_FILE, 'utf-8');
      journalEntries = JSON.parse(data);
      console.log(`[JOURNAL] Loaded ${journalEntries.length} entries`);
    }
  } catch (error) {
    console.error('[JOURNAL] Error loading:', error);
    journalEntries = [];
  }
}

// Save journal to file
function saveJournal(): void {
  ensureDataDir();
  try {
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(journalEntries, null, 2));
  } catch (error) {
    console.error('[JOURNAL] Error saving:', error);
  }
}

// Initialize on import
loadJournal();

// ===== CRUD OPERATIONS =====

// Generate unique ID
function generateId(): string {
  return `j_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create new entry
export function createEntry(entry: Omit<JournalEntry, 'id' | 'timestamp'>): JournalEntry {
  const newEntry: JournalEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
    tags: entry.tags || [],
  };
  
  journalEntries.unshift(newEntry); // Add to beginning (newest first)
  saveJournal();
  console.log(`[JOURNAL] Created entry: ${newEntry.title} (${newEntry.type})`);
  
  return newEntry;
}

// Get entry by ID
export function getEntry(id: string): JournalEntry | undefined {
  return journalEntries.find(e => e.id === id);
}

// Update entry
export function updateEntry(id: string, updates: Partial<Omit<JournalEntry, 'id' | 'timestamp'>>): JournalEntry | null {
  const index = journalEntries.findIndex(e => e.id === id);
  if (index === -1) return null;
  
  journalEntries[index] = {
    ...journalEntries[index],
    ...updates,
  };
  
  saveJournal();
  console.log(`[JOURNAL] Updated entry: ${id}`);
  
  return journalEntries[index];
}

// Delete entry
export function deleteEntry(id: string): boolean {
  const index = journalEntries.findIndex(e => e.id === id);
  if (index === -1) return false;
  
  journalEntries.splice(index, 1);
  saveJournal();
  console.log(`[JOURNAL] Deleted entry: ${id}`);
  
  return true;
}

// ===== QUERY & FILTER =====

// Get all entries with optional filter
export function getEntries(filter?: JournalFilter): JournalEntry[] {
  let results = [...journalEntries];
  
  if (!filter) return results;
  
  // Filter by type
  if (filter.type) {
    results = results.filter(e => e.type === filter.type);
  }
  
  // Filter by mood
  if (filter.mood) {
    results = results.filter(e => e.mood === filter.mood);
  }
  
  // Filter by token
  if (filter.token) {
    results = results.filter(e => e.token === filter.token);
  }
  
  // Filter by signal ID
  if (filter.signalId) {
    results = results.filter(e => e.signalId === filter.signalId);
  }
  
  // Filter by trade ID
  if (filter.tradeId) {
    results = results.filter(e => e.tradeId === filter.tradeId);
  }
  
  // Filter by outcome
  if (filter.outcome) {
    results = results.filter(e => e.outcome === filter.outcome);
  }
  
  // Filter by date range
  if (filter.startDate) {
    results = results.filter(e => e.timestamp >= filter.startDate!);
  }
  if (filter.endDate) {
    results = results.filter(e => e.timestamp <= filter.endDate!);
  }
  
  // Filter by tags (any match)
  if (filter.tags && filter.tags.length > 0) {
    results = results.filter(e => 
      e.tags.some(t => filter.tags!.includes(t))
    );
  }
  
  // Text search
  if (filter.search) {
    const searchLower = filter.search.toLowerCase();
    results = results.filter(e => 
      e.title.toLowerCase().includes(searchLower) ||
      e.content.toLowerCase().includes(searchLower) ||
      e.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }
  
  // Pagination
  const offset = filter.offset || 0;
  const limit = filter.limit || 50;
  
  return results.slice(offset, offset + limit);
}

// Get all unique tags
export function getAllTags(): Array<{ tag: string; count: number }> {
  const tagCounts = new Map<string, number>();
  
  for (const entry of journalEntries) {
    for (const tag of entry.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// Search entries
export function searchEntries(query: string, limit = 50): JournalEntry[] {
  return getEntries({ search: query, limit });
}

// Get entries for a specific signal
export function getEntriesForSignal(signalId: string): JournalEntry[] {
  return journalEntries.filter(e => e.signalId === signalId);
}

// Get entries for a specific trade
export function getEntriesForTrade(tradeId: string): JournalEntry[] {
  return journalEntries.filter(e => e.tradeId === tradeId);
}

// ===== ANALYTICS =====

export function getAnalytics(): JournalAnalytics {
  const entriesByType: Record<JournalEntryType, number> = {
    trade: 0,
    note: 0,
    lesson: 0,
    idea: 0,
  };
  
  const entriesByMood: Record<MoodType, number> = {
    confident: 0,
    uncertain: 0,
    fomo: 0,
    fear: 0,
  };
  
  // Count by type and mood
  for (const entry of journalEntries) {
    entriesByType[entry.type]++;
    if (entry.mood) {
      entriesByMood[entry.mood]++;
    }
  }
  
  // Mood vs Outcome analysis
  const moodOutcomes = new Map<MoodType, { wins: number; losses: number; pnlSum: number; count: number }>();
  
  for (const entry of journalEntries) {
    if (entry.mood && entry.outcome) {
      const data = moodOutcomes.get(entry.mood) || { wins: 0, losses: 0, pnlSum: 0, count: 0 };
      
      if (entry.outcome === 'win') data.wins++;
      if (entry.outcome === 'loss') data.losses++;
      if (entry.pnl) data.pnlSum += entry.pnl;
      data.count++;
      
      moodOutcomes.set(entry.mood, data);
    }
  }
  
  const moodVsOutcome = Array.from(moodOutcomes.entries()).map(([mood, data]) => ({
    mood,
    wins: data.wins,
    losses: data.losses,
    winRate: data.count > 0 ? (data.wins / (data.wins + data.losses)) * 100 : 0,
    avgPnl: data.count > 0 ? data.pnlSum / data.count : 0,
  }));
  
  // Tag performance (for strategy analysis)
  const tagPerformance = new Map<string, { wins: number; losses: number; pnlSum: number; count: number }>();
  
  for (const entry of journalEntries) {
    if (entry.type === 'trade' && entry.outcome) {
      for (const tag of entry.tags) {
        const data = tagPerformance.get(tag) || { wins: 0, losses: 0, pnlSum: 0, count: 0 };
        
        if (entry.outcome === 'win') data.wins++;
        if (entry.outcome === 'loss') data.losses++;
        if (entry.pnl) data.pnlSum += entry.pnl;
        data.count++;
        
        tagPerformance.set(tag, data);
      }
    }
  }
  
  const bestStrategies = Array.from(tagPerformance.entries())
    .filter(([_, data]) => data.count >= 3) // Minimum 3 trades
    .map(([tag, data]) => ({
      tag,
      winRate: (data.wins / (data.wins + data.losses)) * 100,
      avgPnl: data.pnlSum / data.count,
      trades: data.count,
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10);
  
  // Common mistakes (lessons)
  const lessons = journalEntries.filter(e => e.type === 'lesson');
  const mistakeCounts = new Map<string, { count: number; category?: string }>();
  
  for (const lesson of lessons) {
    // Use title as the mistake identifier
    const key = lesson.title.toLowerCase();
    const data = mistakeCounts.get(key) || { count: 0, category: lesson.lessonCategory };
    data.count++;
    mistakeCounts.set(key, data);
  }
  
  const commonMistakes = Array.from(mistakeCounts.entries())
    .map(([lesson, data]) => ({ lesson, count: data.count, category: data.category }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Calculate streaks
  const tradeEntries = journalEntries
    .filter(e => e.type === 'trade' && (e.outcome === 'win' || e.outcome === 'loss'))
    .sort((a, b) => a.timestamp - b.timestamp);
  
  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;
  
  for (const trade of tradeEntries) {
    if (trade.outcome === 'win') {
      tempWinStreak++;
      tempLossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
    } else if (trade.outcome === 'loss') {
      tempLossStreak++;
      tempWinStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, tempLossStreak);
    }
  }
  
  // Get current streak from most recent trades
  for (let i = tradeEntries.length - 1; i >= 0; i--) {
    const trade = tradeEntries[i];
    if (i === tradeEntries.length - 1) {
      if (trade.outcome === 'win') currentWinStreak = 1;
      else currentLossStreak = 1;
    } else {
      if (trade.outcome === 'win' && currentWinStreak > 0) currentWinStreak++;
      else if (trade.outcome === 'loss' && currentLossStreak > 0) currentLossStreak++;
      else break;
    }
  }
  
  // Recent lessons
  const recentLessons = journalEntries
    .filter(e => e.type === 'lesson')
    .slice(0, 5);
  
  return {
    totalEntries: journalEntries.length,
    entriesByType,
    entriesByMood,
    moodVsOutcome,
    topTags: getAllTags().slice(0, 15),
    commonMistakes,
    bestStrategies,
    recentLessons,
    streaks: {
      currentWinStreak,
      maxWinStreak,
      currentLossStreak,
      maxLossStreak,
    },
  };
}

// ===== QUICK ACTIONS =====

// Quick note on a signal
export function addSignalNote(signalId: string, note: string, tags: string[] = []): JournalEntry {
  return createEntry({
    type: 'note',
    signalId,
    title: `Note on signal`,
    content: note,
    tags: ['signal-note', ...tags],
  });
}

// Record a lesson learned
export function recordLesson(
  title: string,
  content: string,
  category: string,
  relatedSignalId?: string,
  relatedTradeId?: string
): JournalEntry {
  return createEntry({
    type: 'lesson',
    signalId: relatedSignalId,
    tradeId: relatedTradeId,
    title,
    content,
    tags: ['lesson', category],
    lessonCategory: category,
  });
}

// Record a trade with mood
export function recordTradeEntry(
  tradeId: string,
  signalId: string | undefined,
  token: string,
  title: string,
  content: string,
  mood: MoodType,
  outcome?: 'win' | 'loss' | 'breakeven' | 'pending',
  pnl?: number,
  tags: string[] = [],
  screenshot?: string
): JournalEntry {
  return createEntry({
    type: 'trade',
    tradeId,
    signalId,
    token,
    title,
    content,
    mood,
    outcome,
    pnl,
    tags: ['trade', ...tags],
    screenshot,
  });
}

// Record an idea
export function recordIdea(title: string, content: string, tags: string[] = []): JournalEntry {
  return createEntry({
    type: 'idea',
    title,
    content,
    tags: ['idea', ...tags],
  });
}

// ===== EXPORT =====

export function exportJournal(format: 'json' | 'csv' = 'json'): string {
  if (format === 'json') {
    return JSON.stringify(journalEntries, null, 2);
  }
  
  // CSV format
  const headers = ['id', 'timestamp', 'type', 'title', 'content', 'tags', 'mood', 'outcome', 'pnl', 'signalId', 'tradeId', 'token'];
  const rows = journalEntries.map(e => [
    e.id,
    new Date(e.timestamp).toISOString(),
    e.type,
    `"${e.title.replace(/"/g, '""')}"`,
    `"${e.content.replace(/"/g, '""')}"`,
    `"${e.tags.join(', ')}"`,
    e.mood || '',
    e.outcome || '',
    e.pnl?.toString() || '',
    e.signalId || '',
    e.tradeId || '',
    e.token || '',
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// ===== DEMO DATA =====

export function generateDemoJournal(): void {
  // Clear existing
  journalEntries = [];
  
  const demoEntries: Array<Omit<JournalEntry, 'id' | 'timestamp'>> = [
    {
      type: 'trade',
      title: 'FOMO entry on $PEPE pump',
      content: 'Saw huge green candles and jumped in without waiting for a pullback. Entry was at local top. Classic mistake.',
      tags: ['fomo', 'entry-timing', 'memecoin'],
      mood: 'fomo',
      outcome: 'loss',
      pnl: -45,
      token: 'PEPEsomething123',
    },
    {
      type: 'lesson',
      title: 'Wait for pullback on pumps',
      content: 'After a 50%+ pump, there is almost always a pullback. Wait for consolidation or at least 15-20% retrace before entering.',
      tags: ['entry-timing', 'patience'],
      lessonCategory: 'timing',
    },
    {
      type: 'trade',
      title: 'Patient entry on $BONK dip',
      content: 'Waited for the signal score to reach 85+, then waited for a 20% dip from the initial pump. Entered with confidence.',
      tags: ['patience', 'dip-buy', 'memecoin'],
      mood: 'confident',
      outcome: 'win',
      pnl: 120,
      token: 'BONKsomething456',
    },
    {
      type: 'idea',
      title: 'Track KOL reliability',
      content: 'Notice some KOLs have way better hit rates. Should track which ones to follow vs ignore.',
      tags: ['kol', 'strategy', 'improvement'],
    },
    {
      type: 'lesson',
      title: 'Dont ignore safety score',
      content: 'Took a trade on a token with 40 safety score because the chart looked good. Got rugged. Never again.',
      tags: ['safety', 'risk-management'],
      lessonCategory: 'risk',
    },
    {
      type: 'trade',
      title: 'Fear sold $WIF too early',
      content: 'Got scared by a 15% dip and sold. Token went on to 5x. Need to set proper stop losses and targets, not emotional exits.',
      tags: ['fear', 'exit-timing', 'emotional-trading'],
      mood: 'fear',
      outcome: 'loss',
      pnl: -5,
      token: 'WIFsomething789',
    },
    {
      type: 'note',
      title: 'Market feels toppy',
      content: 'BTC at resistance, alts pumping hard. Might be time to take some profits and reduce position sizes.',
      tags: ['market-analysis', 'risk-management'],
      mood: 'uncertain',
    },
    {
      type: 'lesson',
      title: 'Size positions by conviction',
      content: 'High conviction (90+ score, multiple sources) = larger size. Lower conviction = smaller size. Simple but effective.',
      tags: ['position-sizing', 'risk-management'],
      lessonCategory: 'risk',
    },
    {
      type: 'trade',
      title: 'Perfect execution on narrative play',
      content: 'AI narrative was hot. Found early signal, good safety score, waited for dip, sized appropriately. Let winners run.',
      tags: ['narrative', 'ai', 'perfect-trade'],
      mood: 'confident',
      outcome: 'win',
      pnl: 250,
    },
    {
      type: 'idea',
      title: 'Create watchlist for dip buys',
      content: 'Keep a list of tokens with good fundamentals that I want to buy on dips. Check daily for opportunities.',
      tags: ['strategy', 'watchlist', 'organization'],
    },
  ];
  
  // Add entries with staggered timestamps
  const now = Date.now();
  demoEntries.forEach((entry, i) => {
    const newEntry: JournalEntry = {
      ...entry,
      id: generateId(),
      timestamp: now - (i * 3600000 * 24), // Each entry 1 day apart
      tags: entry.tags || [],
    };
    journalEntries.push(newEntry);
  });
  
  saveJournal();
  console.log(`[JOURNAL] Generated ${demoEntries.length} demo entries`);
}

// Get journal stats summary
export function getJournalSummary(): {
  totalEntries: number;
  thisWeek: number;
  lessonsLearned: number;
  avgMood: string;
  winRate: number;
} {
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const thisWeek = journalEntries.filter(e => e.timestamp >= oneWeekAgo).length;
  const lessons = journalEntries.filter(e => e.type === 'lesson').length;
  
  // Calculate average mood
  const moodCounts: Record<string, number> = { confident: 0, uncertain: 0, fomo: 0, fear: 0 };
  let moodTotal = 0;
  for (const entry of journalEntries) {
    if (entry.mood) {
      moodCounts[entry.mood]++;
      moodTotal++;
    }
  }
  
  const topMood = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])[0];
  const avgMood = topMood && topMood[1] > 0 ? topMood[0] : 'neutral';
  
  // Win rate
  const trades = journalEntries.filter(e => e.type === 'trade' && e.outcome);
  const wins = trades.filter(e => e.outcome === 'win').length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  
  return {
    totalEntries: journalEntries.length,
    thisWeek,
    lessonsLearned: lessons,
    avgMood,
    winRate,
  };
}
