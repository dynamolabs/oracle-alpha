import React, { useEffect, useState, useCallback } from 'react';
import { Signal } from '../types';
import { SignalCard } from './SignalCard';

interface SignalListProps {
  onSignalClick: (signal: Signal) => void;
  filter: 'all' | 'high' | 'ultra';
}

export const SignalList: React.FC<SignalListProps> = ({ onSignalClick, filter }) => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSignals = useCallback(async () => {
    try {
      let url = '/api/signals?limit=50';
      
      if (filter === 'high') {
        url += '&minScore=70';
      } else if (filter === 'ultra') {
        url += '&convictionLevel=ULTRA';
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch signals');
      
      const data = await response.json();
      setSignals(data.signals || []);
      setError(null);
    } catch (err) {
      setError('Failed to load signals');
      console.error('Error fetching signals:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchSignals();

    // Set up WebSocket for real-time updates
    let ws: WebSocket | null = null;
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'signal') {
            setSignals(prev => [data.signal, ...prev].slice(0, 50));
            
            // Haptic feedback for new signal
            if (window.Telegram?.WebApp?.HapticFeedback) {
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };
    } catch (e) {
      console.log('WebSocket not available');
    }

    // Poll every 30 seconds as fallback
    const pollInterval = setInterval(fetchSignals, 30000);

    return () => {
      if (ws) ws.close();
      clearInterval(pollInterval);
    };
  }, [fetchSignals]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    await fetchSignals();
  };

  if (loading) {
    return (
      <div className="feed">
        <div className="feed-loading">
          <div className="feed-loading-spinner" />
          <span className="text-hint">Loading signals...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feed">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Connection Error</div>
          <div className="empty-state-text">{error}</div>
          <button className="action-btn primary mt-md" onClick={handleRefresh}>
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="feed">
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">No Signals Yet</div>
          <div className="empty-state-text">
            {filter === 'ultra' 
              ? 'No ULTRA conviction signals detected yet. These are rare!'
              : filter === 'high'
              ? 'No high-scoring signals detected recently.'
              : 'Waiting for new signals to be detected...'}
          </div>
          <button className="action-btn secondary mt-md" onClick={handleRefresh}>
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feed">
      <div className="feed-header">
        <span className="feed-title">
          {filter === 'ultra' ? '🔥 Ultra Signals' : filter === 'high' ? '⚡ High Score' : '📊 Signal Feed'}
        </span>
        <span className="feed-count" onClick={handleRefresh}>
          {refreshing ? '...' : signals.length} signals
        </span>
      </div>

      {signals.map(signal => (
        <SignalCard 
          key={signal.id} 
          signal={signal} 
          onClick={onSignalClick}
        />
      ))}
    </div>
  );
};

export default SignalList;
