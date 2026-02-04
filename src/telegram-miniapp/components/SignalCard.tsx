import React from 'react';
import { Signal } from '../types';

interface SignalCardProps {
  signal: Signal;
  onClick: (signal: Signal) => void;
}

const RISK_EMOJI: Record<string, string> = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🟠',
  EXTREME: '🔴'
};

const formatMcap = (mcap: number): string => {
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(1)}M`;
  if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(0)}K`;
  return `$${mcap.toFixed(0)}`;
};

const formatVolume = (vol: number): string => {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toFixed(0);
};

const formatTimeAgo = (timestamp: number): string => {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onClick }) => {
  const scoreClass = signal.score >= 70 ? 'high' : signal.score >= 50 ? 'medium' : 'low';
  const riskClass = `risk-${signal.riskLevel.toLowerCase()}`;
  
  const convictionLevel = signal.confluence?.convictionLevel;
  const convictionClass = convictionLevel === 'ULTRA' ? 'conviction-ultra' : 
                          convictionLevel === 'HIGH_CONVICTION' ? 'conviction-high' : '';

  const handleClick = () => {
    // Haptic feedback if available
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    onClick(signal);
  };

  return (
    <div className="signal-card" onClick={handleClick}>
      <div className="signal-card-header">
        <div className="signal-card-token">
          <div>
            <div className="signal-card-symbol">${signal.symbol}</div>
            <div className="signal-card-name">{signal.name}</div>
          </div>
        </div>
        <div className={`signal-card-score ${scoreClass}`}>
          {signal.score}
        </div>
      </div>

      <div className="signal-card-meta">
        <span className={`signal-card-badge ${riskClass}`}>
          {RISK_EMOJI[signal.riskLevel]} {signal.riskLevel}
        </span>
        {convictionLevel && convictionLevel !== 'STANDARD' && (
          <span className={`signal-card-badge ${convictionClass}`}>
            {convictionLevel === 'ULTRA' ? '🔥 ULTRA' : '⚡ HIGH CONVICTION'}
          </span>
        )}
        {signal.confluence && signal.confluence.uniqueSources > 2 && (
          <span className="signal-card-badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' }}>
            {signal.confluence.uniqueSources} Sources
          </span>
        )}
      </div>

      <div className="signal-card-stats">
        <div className="signal-card-stat">
          <div className="signal-card-stat-label">MCap</div>
          <div className="signal-card-stat-value">
            {formatMcap(signal.marketData?.mcap || 0)}
          </div>
        </div>
        <div className="signal-card-stat">
          <div className="signal-card-stat-label">Vol 5m</div>
          <div className="signal-card-stat-value">
            ${formatVolume(signal.marketData?.volume5m || 0)}
          </div>
        </div>
        <div className="signal-card-stat">
          <div className="signal-card-stat-label">5m Δ</div>
          <div className={`signal-card-stat-value ${(signal.marketData?.priceChange5m || 0) >= 0 ? 'positive' : 'negative'}`}>
            {(signal.marketData?.priceChange5m || 0) >= 0 ? '+' : ''}{(signal.marketData?.priceChange5m || 0).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="signal-card-time">
        {formatTimeAgo(signal.timestamp)}
      </div>
    </div>
  );
};

export default SignalCard;
