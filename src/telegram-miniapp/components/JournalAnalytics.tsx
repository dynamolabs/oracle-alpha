import React, { useState, useEffect } from 'react';

interface MoodVsOutcome {
  mood: string;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
}

interface StrategyPerformance {
  tag: string;
  winRate: number;
  avgPnl: number;
  trades: number;
}

interface CommonMistake {
  lesson: string;
  count: number;
  category?: string;
}

interface JournalAnalyticsData {
  totalEntries: number;
  entriesByType: Record<string, number>;
  entriesByMood: Record<string, number>;
  moodVsOutcome: MoodVsOutcome[];
  topTags: Array<{ tag: string; count: number }>;
  commonMistakes: CommonMistake[];
  bestStrategies: StrategyPerformance[];
  recentLessons: any[];
  streaks: {
    currentWinStreak: number;
    maxWinStreak: number;
    currentLossStreak: number;
    maxLossStreak: number;
  };
}

interface JournalAnalyticsProps {
  onBack: () => void;
}

const MOOD_EMOJI: Record<string, string> = {
  confident: '😎',
  uncertain: '🤔',
  fomo: '🚀',
  fear: '😰'
};

const TYPE_EMOJI: Record<string, string> = {
  trade: '📈',
  note: '📝',
  lesson: '💡',
  idea: '🎯'
};

export const JournalAnalytics: React.FC<JournalAnalyticsProps> = ({ onBack }) => {
  const [analytics, setAnalytics] = useState<JournalAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/journal/analytics');
        const data = await response.json();
        setAnalytics(data.analytics);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const handleHaptic = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  };

  if (loading) {
    return (
      <div className="journal-analytics loading">
        <div className="loading-spinner"></div>
        <span>Loading analytics...</span>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="journal-analytics error">
        <p>Failed to load analytics</p>
        <button onClick={onBack}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="journal-analytics">
      {/* Header */}
      <div className="analytics-header">
        <button className="back-btn" onClick={() => { handleHaptic(); onBack(); }}>
          ← Back
        </button>
        <h2>📊 Journal Analytics</h2>
      </div>

      <div className="analytics-content">
        {/* Overview Cards */}
        <div className="analytics-section">
          <h3>Overview</h3>
          <div className="overview-grid">
            <div className="overview-card">
              <span className="card-value">{analytics.totalEntries}</span>
              <span className="card-label">Total Entries</span>
            </div>
            <div className="overview-card">
              <span className="card-value">{analytics.entriesByType.trade || 0}</span>
              <span className="card-label">Trades Logged</span>
            </div>
            <div className="overview-card">
              <span className="card-value">{analytics.entriesByType.lesson || 0}</span>
              <span className="card-label">Lessons Learned</span>
            </div>
            <div className="overview-card streak">
              <span className="card-value">🔥 {analytics.streaks.currentWinStreak}</span>
              <span className="card-label">Win Streak</span>
            </div>
          </div>
        </div>

        {/* Streaks */}
        <div className="analytics-section">
          <h3>Streaks</h3>
          <div className="streaks-grid">
            <div className="streak-item win">
              <span className="streak-label">Current Win Streak</span>
              <span className="streak-value">{analytics.streaks.currentWinStreak}</span>
            </div>
            <div className="streak-item win">
              <span className="streak-label">Max Win Streak</span>
              <span className="streak-value">{analytics.streaks.maxWinStreak}</span>
            </div>
            <div className="streak-item loss">
              <span className="streak-label">Current Loss Streak</span>
              <span className="streak-value">{analytics.streaks.currentLossStreak}</span>
            </div>
            <div className="streak-item loss">
              <span className="streak-label">Max Loss Streak</span>
              <span className="streak-value">{analytics.streaks.maxLossStreak}</span>
            </div>
          </div>
        </div>

        {/* Mood vs Outcome - Key Insight */}
        {analytics.moodVsOutcome.length > 0 && (
          <div className="analytics-section insight">
            <h3>🧠 Mood vs Outcome</h3>
            <p className="section-hint">How your emotional state correlates with trade results</p>
            <div className="mood-outcome-table">
              {analytics.moodVsOutcome.map(item => (
                <div key={item.mood} className="mood-outcome-row">
                  <div className="mood-info">
                    <span className="mood-emoji">{MOOD_EMOJI[item.mood]}</span>
                    <span className="mood-name">{item.mood}</span>
                  </div>
                  <div className="outcome-stats">
                    <div className="stat">
                      <span className="stat-value win">{item.wins}</span>
                      <span className="stat-label">Wins</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value loss">{item.losses}</span>
                      <span className="stat-label">Losses</span>
                    </div>
                    <div className="stat">
                      <span className={`stat-value ${item.winRate >= 50 ? 'good' : 'bad'}`}>
                        {item.winRate.toFixed(0)}%
                      </span>
                      <span className="stat-label">Win Rate</span>
                    </div>
                    <div className="stat">
                      <span className={`stat-value ${item.avgPnl >= 0 ? 'good' : 'bad'}`}>
                        {item.avgPnl >= 0 ? '+' : ''}{item.avgPnl.toFixed(0)}%
                      </span>
                      <span className="stat-label">Avg PnL</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Insight Card */}
            {analytics.moodVsOutcome.length >= 2 && (
              <div className="insight-card">
                {(() => {
                  const sorted = [...analytics.moodVsOutcome].sort((a, b) => b.winRate - a.winRate);
                  const best = sorted[0];
                  const worst = sorted[sorted.length - 1];
                  
                  if (best.winRate > worst.winRate + 10) {
                    return (
                      <>
                        <span className="insight-icon">💡</span>
                        <span className="insight-text">
                          You perform best when feeling <strong>{best.mood}</strong> ({best.winRate.toFixed(0)}% win rate) 
                          and worst when feeling <strong>{worst.mood}</strong> ({worst.winRate.toFixed(0)}% win rate).
                          Consider avoiding trades when you feel {worst.mood}.
                        </span>
                      </>
                    );
                  }
                  return (
                    <>
                      <span className="insight-icon">📊</span>
                      <span className="insight-text">
                        Keep logging more trades to discover patterns between your mood and trading performance.
                      </span>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Best Strategies */}
        {analytics.bestStrategies.length > 0 && (
          <div className="analytics-section">
            <h3>🏆 Best Performing Strategies</h3>
            <div className="strategies-list">
              {analytics.bestStrategies.slice(0, 5).map((strategy, idx) => (
                <div key={strategy.tag} className="strategy-item">
                  <div className="strategy-rank">#{idx + 1}</div>
                  <div className="strategy-info">
                    <span className="strategy-tag">#{strategy.tag}</span>
                    <span className="strategy-trades">{strategy.trades} trades</span>
                  </div>
                  <div className="strategy-stats">
                    <span className={`win-rate ${strategy.winRate >= 60 ? 'excellent' : strategy.winRate >= 50 ? 'good' : 'bad'}`}>
                      {strategy.winRate.toFixed(0)}% WR
                    </span>
                    <span className={`avg-pnl ${strategy.avgPnl >= 0 ? 'positive' : 'negative'}`}>
                      {strategy.avgPnl >= 0 ? '+' : ''}{strategy.avgPnl.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common Mistakes */}
        {analytics.commonMistakes.length > 0 && (
          <div className="analytics-section">
            <h3>⚠️ Common Mistakes</h3>
            <p className="section-hint">Lessons you've recorded multiple times - these need focus!</p>
            <div className="mistakes-list">
              {analytics.commonMistakes.slice(0, 5).map((mistake, idx) => (
                <div key={idx} className="mistake-item">
                  <span className="mistake-count">×{mistake.count}</span>
                  <span className="mistake-text">{mistake.lesson}</span>
                  {mistake.category && (
                    <span className="mistake-category">{mistake.category}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Tags */}
        {analytics.topTags.length > 0 && (
          <div className="analytics-section">
            <h3>🏷️ Most Used Tags</h3>
            <div className="tags-cloud">
              {analytics.topTags.slice(0, 12).map(({ tag, count }) => (
                <span 
                  key={tag} 
                  className="tag-item"
                  style={{ fontSize: `${Math.min(1.5, 0.8 + count * 0.1)}rem` }}
                >
                  #{tag} <small>({count})</small>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Entry Distribution */}
        <div className="analytics-section">
          <h3>📊 Entry Distribution</h3>
          <div className="distribution-bars">
            {Object.entries(analytics.entriesByType).map(([type, count]) => (
              <div key={type} className="distribution-bar">
                <div className="bar-label">
                  <span>{TYPE_EMOJI[type] || '📋'} {type}</span>
                  <span>{count}</span>
                </div>
                <div className="bar-track">
                  <div 
                    className={`bar-fill ${type}`}
                    style={{ width: `${Math.max(5, (count / analytics.totalEntries) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Lessons */}
        {analytics.recentLessons.length > 0 && (
          <div className="analytics-section">
            <h3>📚 Recent Lessons</h3>
            <div className="recent-lessons">
              {analytics.recentLessons.map(lesson => (
                <div key={lesson.id} className="lesson-item">
                  <span className="lesson-icon">💡</span>
                  <div className="lesson-content">
                    <span className="lesson-title">{lesson.title}</span>
                    <span className="lesson-preview">{lesson.content.slice(0, 80)}...</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalAnalytics;
