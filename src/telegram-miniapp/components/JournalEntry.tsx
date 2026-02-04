import React, { useState } from 'react';

interface JournalEntryData {
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

interface JournalEntryProps {
  entry: JournalEntryData;
  onBack: () => void;
  onEdit: (entry: JournalEntryData) => void;
  onDelete: (id: string) => void;
  onViewSignal?: (signalId: string) => void;
}

const TYPE_EMOJI: Record<string, string> = {
  trade: '📈',
  note: '📝',
  lesson: '💡',
  idea: '🎯'
};

const MOOD_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  confident: { emoji: '😎', color: '#10b981', label: 'Confident' },
  uncertain: { emoji: '🤔', color: '#f59e0b', label: 'Uncertain' },
  fomo: { emoji: '🚀', color: '#ef4444', label: 'FOMO' },
  fear: { emoji: '😰', color: '#8b5cf6', label: 'Fear' }
};

const OUTCOME_CONFIG: Record<string, { emoji: string; color: string }> = {
  win: { emoji: '✅', color: '#10b981' },
  loss: { emoji: '❌', color: '#ef4444' },
  breakeven: { emoji: '➖', color: '#6b7280' },
  pending: { emoji: '⏳', color: '#f59e0b' }
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const JournalEntry: React.FC<JournalEntryProps> = ({ 
  entry, 
  onBack, 
  onEdit, 
  onDelete,
  onViewSignal 
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
  };

  const handleDelete = async () => {
    handleHaptic('heavy');
    try {
      const response = await fetch(`/api/journal/${entry.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        onDelete(entry.id);
        onBack();
      }
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  };

  const moodConfig = entry.mood ? MOOD_CONFIG[entry.mood] : null;
  const outcomeConfig = entry.outcome ? OUTCOME_CONFIG[entry.outcome] : null;

  return (
    <div className="journal-entry-detail">
      {/* Header */}
      <div className="entry-detail-header">
        <button className="back-btn" onClick={() => { handleHaptic(); onBack(); }}>
          ← Back
        </button>
        <div className="entry-actions">
          <button className="action-btn edit" onClick={() => { handleHaptic(); onEdit(entry); }}>
            ✏️ Edit
          </button>
          <button 
            className="action-btn delete" 
            onClick={() => { handleHaptic('medium'); setShowDeleteConfirm(true); }}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Entry?</h3>
            <p>This action cannot be undone.</p>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel" 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button className="modal-btn confirm-delete" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Content */}
      <div className="entry-detail-content">
        {/* Type Badge */}
        <div className="entry-type-header">
          <span className={`type-badge ${entry.type}`}>
            {TYPE_EMOJI[entry.type]} {entry.type.toUpperCase()}
          </span>
          <span className="entry-date">{formatDate(entry.timestamp)}</span>
        </div>

        {/* Title */}
        <h1 className="entry-title">{entry.title}</h1>

        {/* Mood and Outcome Row */}
        {(moodConfig || outcomeConfig) && (
          <div className="entry-status-row">
            {moodConfig && (
              <div className="status-badge mood" style={{ borderColor: moodConfig.color }}>
                <span className="status-emoji">{moodConfig.emoji}</span>
                <span className="status-label" style={{ color: moodConfig.color }}>
                  {moodConfig.label}
                </span>
              </div>
            )}
            {outcomeConfig && (
              <div className="status-badge outcome" style={{ borderColor: outcomeConfig.color }}>
                <span className="status-emoji">{outcomeConfig.emoji}</span>
                <span className="status-label" style={{ color: outcomeConfig.color }}>
                  {entry.outcome?.toUpperCase()}
                  {entry.pnl !== undefined && (
                    <span className="pnl"> ({entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(1)}%)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="entry-body">
          {entry.content.split('\n').map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        {/* Screenshot */}
        {entry.screenshot && (
          <div className="entry-screenshot">
            <img src={entry.screenshot} alt="Trade screenshot" />
          </div>
        )}

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="entry-tags">
            {entry.tags.map(tag => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        )}

        {/* Links */}
        <div className="entry-links">
          {entry.signalId && onViewSignal && (
            <button 
              className="link-btn signal" 
              onClick={() => { handleHaptic(); onViewSignal(entry.signalId!); }}
            >
              🔮 View Related Signal
            </button>
          )}
          {entry.tradeId && (
            <button className="link-btn trade">
              💰 View Trade Details
            </button>
          )}
          {entry.token && (
            <a 
              href={`https://dexscreener.com/solana/${entry.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-btn chart"
            >
              📊 View Chart
            </a>
          )}
        </div>

        {/* Lesson Category */}
        {entry.lessonCategory && (
          <div className="lesson-category">
            <span className="category-label">Category:</span>
            <span className="category-value">{entry.lessonCategory}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalEntry;
