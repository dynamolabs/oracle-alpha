import React, { useState, useEffect, useCallback } from 'react';

// Journal types
interface JournalEntry {
  id: string;
  tradeId?: string;
  signalId?: string;
  token?: string;
  timestamp: number;
  type: 'trade' | 'note' | 'lesson' | 'idea';
  title: string;
  content: string;
  tags: string[];
  mood?: 'confident' | 'uncertain' | 'fomo' | 'fear';
  screenshot?: string;
  outcome?: 'win' | 'loss' | 'breakeven' | 'pending';
  pnl?: number;
  lessonCategory?: string;
}

interface JournalListProps {
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  signalId?: string;
}

const TYPE_EMOJI: Record<string, string> = {
  trade: '📈',
  note: '📝',
  lesson: '💡',
  idea: '🎯'
};

const MOOD_EMOJI: Record<string, string> = {
  confident: '😎',
  uncertain: '🤔',
  fomo: '🚀',
  fear: '😰'
};

const OUTCOME_EMOJI: Record<string, string> = {
  win: '✅',
  loss: '❌',
  breakeven: '➖',
  pending: '⏳'
};

const formatTimeAgo = (timestamp: number): string => {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

export const JournalList: React.FC<JournalListProps> = ({ onSelectEntry, onNewEntry, signalId }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState<any>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/journal?limit=50';
      if (signalId) {
        url = `/api/journal/signal/${signalId}`;
      } else if (filter !== 'all') {
        url += `&type=${filter}`;
      }
      if (searchQuery) {
        url = `/api/journal/search?q=${encodeURIComponent(searchQuery)}&limit=50`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setEntries(data.entries || []);
      if (data.summary) setSummary(data.summary);
    } catch (error) {
      console.error('Failed to fetch journal entries:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery, signalId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleHaptic = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  };

  return (
    <div className="journal-list">
      {/* Header */}
      <div className="journal-header">
        <h2>📔 Trading Journal</h2>
        <button className="journal-add-btn" onClick={() => { handleHaptic(); onNewEntry(); }}>
          + New Entry
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="journal-summary">
          <div className="summary-stat">
            <span className="stat-value">{summary.totalEntries}</span>
            <span className="stat-label">Entries</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">{summary.thisWeek}</span>
            <span className="stat-label">This Week</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">{summary.lessonsLearned}</span>
            <span className="stat-label">Lessons</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">{summary.winRate.toFixed(0)}%</span>
            <span className="stat-label">Win Rate</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="journal-search">
        <input
          type="text"
          placeholder="🔍 Search entries..."
          value={searchQuery}
          onChange={handleSearch}
          className="journal-search-input"
        />
      </div>

      {/* Filter Tabs */}
      <div className="journal-filters">
        {['all', 'trade', 'note', 'lesson', 'idea'].map(type => (
          <button
            key={type}
            className={`journal-filter-btn ${filter === type ? 'active' : ''}`}
            onClick={() => { handleHaptic(); setFilter(type); }}
          >
            {type === 'all' ? '📚 All' : `${TYPE_EMOJI[type]} ${type.charAt(0).toUpperCase() + type.slice(1)}s`}
          </button>
        ))}
      </div>

      {/* Entry List */}
      <div className="journal-entries">
        {loading ? (
          <div className="journal-loading">
            <div className="loading-spinner"></div>
            <span>Loading journal...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="journal-empty">
            <span className="empty-icon">📔</span>
            <p>No entries yet</p>
            <p className="empty-hint">Start recording your trades, lessons, and ideas!</p>
            <button className="journal-add-btn-large" onClick={onNewEntry}>
              Create First Entry
            </button>
          </div>
        ) : (
          entries.map(entry => (
            <div 
              key={entry.id} 
              className="journal-entry-card"
              onClick={() => { handleHaptic(); onSelectEntry(entry); }}
            >
              <div className="entry-card-header">
                <span className="entry-type-badge">
                  {TYPE_EMOJI[entry.type]} {entry.type}
                </span>
                <span className="entry-time">{formatTimeAgo(entry.timestamp)}</span>
              </div>
              
              <div className="entry-card-title">{entry.title}</div>
              
              <div className="entry-card-content">
                {entry.content.slice(0, 100)}{entry.content.length > 100 ? '...' : ''}
              </div>
              
              <div className="entry-card-meta">
                {entry.mood && (
                  <span className="meta-badge mood">
                    {MOOD_EMOJI[entry.mood]} {entry.mood}
                  </span>
                )}
                {entry.outcome && (
                  <span className={`meta-badge outcome ${entry.outcome}`}>
                    {OUTCOME_EMOJI[entry.outcome]} {entry.outcome}
                    {entry.pnl !== undefined && ` (${entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(0)}%)`}
                  </span>
                )}
                {entry.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="meta-badge tag">#{tag}</span>
                ))}
                {entry.tags.length > 2 && (
                  <span className="meta-badge tag">+{entry.tags.length - 2}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default JournalList;
