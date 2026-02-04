import React, { useState, useEffect } from 'react';

interface JournalEntryData {
  id?: string;
  tradeId?: string;
  signalId?: string;
  token?: string;
  timestamp?: number;
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

interface JournalFormProps {
  entry?: JournalEntryData | null;
  signalId?: string;
  tradeId?: string;
  onSave: (entry: JournalEntryData) => void;
  onCancel: () => void;
}

const ENTRY_TYPES = [
  { value: 'trade', label: 'Trade Entry', emoji: '📈' },
  { value: 'note', label: 'Quick Note', emoji: '📝' },
  { value: 'lesson', label: 'Lesson Learned', emoji: '💡' },
  { value: 'idea', label: 'Trade Idea', emoji: '🎯' }
];

const MOODS = [
  { value: 'confident', label: 'Confident', emoji: '😎' },
  { value: 'uncertain', label: 'Uncertain', emoji: '🤔' },
  { value: 'fomo', label: 'FOMO', emoji: '🚀' },
  { value: 'fear', label: 'Fear', emoji: '😰' }
];

const OUTCOMES = [
  { value: 'pending', label: 'Pending', emoji: '⏳' },
  { value: 'win', label: 'Win', emoji: '✅' },
  { value: 'loss', label: 'Loss', emoji: '❌' },
  { value: 'breakeven', label: 'Breakeven', emoji: '➖' }
];

const LESSON_CATEGORIES = [
  'timing', 'risk', 'fomo', 'patience', 'research', 
  'exit-strategy', 'position-sizing', 'emotional', 'technical'
];

const SUGGESTED_TAGS = [
  'memecoin', 'narrative', 'dip-buy', 'breakout', 'scalp',
  'swing', 'hold', 'ai', 'gaming', 'defi', 'nft'
];

export const JournalForm: React.FC<JournalFormProps> = ({
  entry,
  signalId,
  tradeId,
  onSave,
  onCancel
}) => {
  const isEdit = !!entry?.id;
  
  const [type, setType] = useState<JournalEntryData['type']>(entry?.type || 'note');
  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [mood, setMood] = useState<JournalEntryData['mood']>(entry?.mood);
  const [outcome, setOutcome] = useState<JournalEntryData['outcome']>(entry?.outcome);
  const [pnl, setPnl] = useState<string>(entry?.pnl?.toString() || '');
  const [screenshot, setScreenshot] = useState(entry?.screenshot || '');
  const [lessonCategory, setLessonCategory] = useState(entry?.lessonCategory || '');
  const [token, setToken] = useState(entry?.token || '');
  const [saving, setSaving] = useState(false);

  // Auto-populate signalId/tradeId
  const [linkedSignalId] = useState(signalId || entry?.signalId);
  const [linkedTradeId] = useState(tradeId || entry?.tradeId);

  const handleHaptic = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  };

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (normalized && !tags.includes(normalized)) {
      setTags([...tags, normalized]);
      handleHaptic();
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
    handleHaptic();
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Please fill in title and content');
      }
      return;
    }

    setSaving(true);
    handleHaptic();

    const entryData: JournalEntryData = {
      ...(entry?.id ? { id: entry.id } : {}),
      type,
      title: title.trim(),
      content: content.trim(),
      tags,
      mood: type === 'trade' ? mood : undefined,
      outcome: type === 'trade' ? outcome : undefined,
      pnl: type === 'trade' && pnl ? parseFloat(pnl) : undefined,
      screenshot: screenshot || undefined,
      lessonCategory: type === 'lesson' ? lessonCategory : undefined,
      token: token || undefined,
      signalId: linkedSignalId,
      tradeId: linkedTradeId
    };

    try {
      const url = isEdit ? `/api/journal/${entry.id}` : '/api/journal';
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data.entry);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save entry:', error);
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Failed to save entry. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="journal-form">
      {/* Header */}
      <div className="form-header">
        <button className="back-btn" onClick={onCancel}>← Cancel</button>
        <h2>{isEdit ? 'Edit Entry' : 'New Entry'}</h2>
        <button 
          className={`save-btn ${saving ? 'saving' : ''}`} 
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? '...' : '✓ Save'}
        </button>
      </div>

      <div className="form-content">
        {/* Entry Type Selector */}
        <div className="form-section">
          <label>Entry Type</label>
          <div className="type-selector">
            {ENTRY_TYPES.map(t => (
              <button
                key={t.value}
                className={`type-btn ${type === t.value ? 'active' : ''}`}
                onClick={() => { handleHaptic(); setType(t.value as any); }}
              >
                <span className="type-emoji">{t.emoji}</span>
                <span className="type-label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="form-section">
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={
              type === 'trade' ? 'e.g., FOMO entry on $PEPE pump' :
              type === 'lesson' ? 'e.g., Wait for pullback on pumps' :
              type === 'idea' ? 'e.g., Watch AI narrative tokens' :
              'e.g., Quick market observation'
            }
            className="form-input"
          />
        </div>

        {/* Content */}
        <div className="form-section">
          <label>Content *</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your thoughts, analysis, or lesson..."
            className="form-textarea"
            rows={6}
          />
        </div>

        {/* Trade-specific fields */}
        {type === 'trade' && (
          <>
            {/* Mood Selector */}
            <div className="form-section">
              <label>How did you feel? (Mood)</label>
              <div className="mood-selector">
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    className={`mood-btn ${mood === m.value ? 'active' : ''}`}
                    onClick={() => { handleHaptic(); setMood(m.value as any); }}
                  >
                    <span className="mood-emoji">{m.emoji}</span>
                    <span className="mood-label">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Outcome */}
            <div className="form-section">
              <label>Outcome</label>
              <div className="outcome-selector">
                {OUTCOMES.map(o => (
                  <button
                    key={o.value}
                    className={`outcome-btn ${outcome === o.value ? 'active' : ''} ${o.value}`}
                    onClick={() => { handleHaptic(); setOutcome(o.value as any); }}
                  >
                    <span>{o.emoji}</span>
                    <span>{o.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* PnL */}
            {outcome && outcome !== 'pending' && (
              <div className="form-section">
                <label>PnL (%)</label>
                <input
                  type="number"
                  value={pnl}
                  onChange={e => setPnl(e.target.value)}
                  placeholder="e.g., 50 or -25"
                  className="form-input small"
                />
              </div>
            )}

            {/* Token CA */}
            <div className="form-section">
              <label>Token Address (optional)</label>
              <input
                type="text"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste token contract address..."
                className="form-input mono"
              />
            </div>
          </>
        )}

        {/* Lesson-specific fields */}
        {type === 'lesson' && (
          <div className="form-section">
            <label>Lesson Category</label>
            <div className="category-selector">
              {LESSON_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`category-btn ${lessonCategory === cat ? 'active' : ''}`}
                  onClick={() => { handleHaptic(); setLessonCategory(cat); }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="form-section">
          <label>Tags</label>
          <div className="tags-input-container">
            <div className="tags-list">
              {tags.map(tag => (
                <span key={tag} className="tag" onClick={() => removeTag(tag)}>
                  #{tag} ×
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Add tag..."
              className="tag-input"
            />
          </div>
          <div className="suggested-tags">
            {SUGGESTED_TAGS.filter(t => !tags.includes(t)).slice(0, 6).map(tag => (
              <button
                key={tag}
                className="suggested-tag"
                onClick={() => addTag(tag)}
              >
                +{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Screenshot URL */}
        <div className="form-section">
          <label>Screenshot URL (optional)</label>
          <input
            type="url"
            value={screenshot}
            onChange={e => setScreenshot(e.target.value)}
            placeholder="https://..."
            className="form-input"
          />
          {screenshot && (
            <div className="screenshot-preview">
              <img src={screenshot} alt="Preview" />
            </div>
          )}
        </div>

        {/* Linked Signal/Trade Info */}
        {(linkedSignalId || linkedTradeId) && (
          <div className="form-section linked-info">
            {linkedSignalId && (
              <div className="linked-badge">
                🔮 Linked to Signal: {linkedSignalId.slice(0, 8)}...
              </div>
            )}
            {linkedTradeId && (
              <div className="linked-badge">
                💰 Linked to Trade: {linkedTradeId.slice(0, 8)}...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalForm;
