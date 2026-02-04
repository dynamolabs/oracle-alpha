import React, { useState } from 'react';
import { Signal } from '../types';

interface SignalDetailProps {
  signal: Signal;
  onBack: () => void;
  onTrade: (signal: Signal) => void;
}

const RISK_EMOJI: Record<string, string> = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🟠',
  EXTREME: '🔴'
};

const SOURCE_EMOJI: Record<string, string> = {
  'smart-wallet-elite': '👑',
  'smart-wallet-sniper': '🎯',
  'kol-tracker': '📢',
  'kol-social': '🐦',
  'volume-spike': '📈',
  'narrative-new': '📰',
  'narrative-momentum': '🚀',
  'pump-koth': '🎰',
  'whale-tracker': '🐋',
  'news-scraper': '📰',
  'dexscreener': '🦎',
  'panda_alpha': '🐼'
};

const formatMcap = (mcap: number): string => {
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`;
  if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(1)}K`;
  return `$${mcap.toFixed(0)}`;
};

const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(2);
};

export const SignalDetail: React.FC<SignalDetailProps> = ({ signal, onBack, onTrade }) => {
  const [copied, setCopied] = useState(false);

  const scoreClass = signal.score >= 70 ? 'high' : signal.score >= 50 ? 'medium' : 'low';

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(signal.token);
      setCopied(true);
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const openChart = () => {
    const url = `https://dexscreener.com/solana/${signal.token}`;
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const openBirdeye = () => {
    const url = `https://birdeye.so/token/${signal.token}?chain=solana`;
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="signal-detail">
      {copied && (
        <div className="copy-feedback">
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div>Address Copied!</div>
        </div>
      )}

      <div className="signal-detail-header">
        <div className="signal-detail-symbol">${signal.symbol}</div>
        <div className="signal-detail-name">{signal.name}</div>
        
        <div className={`signal-detail-score ${scoreClass}`}>
          {signal.score}
        </div>

        <div className="signal-detail-badges">
          <span className={`signal-card-badge risk-${signal.riskLevel.toLowerCase()}`}>
            {RISK_EMOJI[signal.riskLevel]} {signal.riskLevel} Risk
          </span>
          {signal.confluence?.convictionLevel && signal.confluence.convictionLevel !== 'STANDARD' && (
            <span className={`signal-card-badge ${signal.confluence.convictionLevel === 'ULTRA' ? 'conviction-ultra' : 'conviction-high'}`}>
              {signal.confluence.convictionLevel === 'ULTRA' ? '🔥 ULTRA' : '⚡ HIGH CONVICTION'}
            </span>
          )}
          {signal.safety && (
            <span className={`signal-card-badge ${signal.safety.riskCategory === 'SAFE' ? 'risk-low' : signal.safety.riskCategory === 'CAUTION' ? 'risk-medium' : 'risk-high'}`}>
              🛡️ Safety: {signal.safety.safetyScore}
            </span>
          )}
        </div>
      </div>

      {/* Market Data */}
      <div className="signal-detail-section">
        <div className="signal-detail-section-title">📊 Market Data</div>
        <div className="signal-detail-grid">
          <div className="signal-detail-item">
            <div className="signal-detail-item-label">Market Cap</div>
            <div className="signal-detail-item-value">{formatMcap(signal.marketData?.mcap || 0)}</div>
          </div>
          <div className="signal-detail-item">
            <div className="signal-detail-item-label">Liquidity</div>
            <div className="signal-detail-item-value">${formatNumber(signal.marketData?.liquidity || 0)}</div>
          </div>
          <div className="signal-detail-item">
            <div className="signal-detail-item-label">Volume 5m</div>
            <div className="signal-detail-item-value">${formatNumber(signal.marketData?.volume5m || 0)}</div>
          </div>
          <div className="signal-detail-item">
            <div className="signal-detail-item-label">Volume 1h</div>
            <div className="signal-detail-item-value">${formatNumber(signal.marketData?.volume1h || 0)}</div>
          </div>
          <div className="signal-detail-item">
            <div className="signal-detail-item-label">Price Δ 5m</div>
            <div className={`signal-detail-item-value ${(signal.marketData?.priceChange5m || 0) >= 0 ? 'text-green' : 'text-red'}`}>
              {(signal.marketData?.priceChange5m || 0) >= 0 ? '+' : ''}{(signal.marketData?.priceChange5m || 0).toFixed(1)}%
            </div>
          </div>
          <div className="signal-detail-item">
            <div className="signal-detail-item-label">Age</div>
            <div className="signal-detail-item-value">{signal.marketData?.age || 0}m</div>
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="signal-detail-section">
        <div className="signal-detail-section-title">🎯 Signal Sources ({signal.sources.length})</div>
        <div className="signal-detail-sources">
          {signal.sources.map((src, i) => (
            <div key={i} className="signal-detail-source">
              {SOURCE_EMOJI[src.source] || '•'} {src.source.replace(/-/g, ' ')}
            </div>
          ))}
        </div>
      </div>

      {/* Analysis */}
      {signal.analysis && (
        <div className="signal-detail-section">
          <div className="signal-detail-section-title">💡 AI Analysis</div>
          <div className="signal-detail-analysis">
            <p>{signal.analysis.recommendation}</p>
            {signal.analysis.narrative && signal.analysis.narrative.length > 0 && (
              <div className="signal-detail-narratives">
                {signal.analysis.narrative.map((n, i) => (
                  <span key={i} className="signal-detail-narrative">{n}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance (if tracked) */}
      {signal.performance && (
        <div className="signal-detail-section">
          <div className="signal-detail-section-title">📈 Performance</div>
          <div className="signal-detail-grid">
            <div className="signal-detail-item">
              <div className="signal-detail-item-label">Entry Price</div>
              <div className="signal-detail-item-value">${signal.performance.entryPrice.toFixed(8)}</div>
            </div>
            <div className="signal-detail-item">
              <div className="signal-detail-item-label">Current Price</div>
              <div className="signal-detail-item-value">${signal.performance.currentPrice.toFixed(8)}</div>
            </div>
            <div className="signal-detail-item">
              <div className="signal-detail-item-label">ROI</div>
              <div className={`signal-detail-item-value ${signal.performance.roi >= 0 ? 'text-green' : 'text-red'}`}>
                {signal.performance.roi >= 0 ? '+' : ''}{signal.performance.roi.toFixed(1)}%
              </div>
            </div>
            <div className="signal-detail-item">
              <div className="signal-detail-item-label">ATH ROI</div>
              <div className="signal-detail-item-value text-cyan">
                +{signal.performance.athRoi.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contract Address */}
      <div className="signal-detail-section">
        <div className="signal-detail-section-title">📝 Contract Address</div>
        <div 
          className="signal-detail-analysis" 
          onClick={copyAddress}
          style={{ cursor: 'pointer', fontSize: 11, wordBreak: 'break-all' }}
        >
          <code>{signal.token}</code>
          <div className="text-hint mt-md" style={{ fontSize: 10 }}>
            Tap to copy
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="signal-detail-actions">
        <button className="action-btn secondary" onClick={openChart}>
          📊 Chart
        </button>
        <button className="action-btn secondary" onClick={openBirdeye}>
          🦅 Birdeye
        </button>
        <button className="action-btn secondary" onClick={copyAddress}>
          📋 Copy CA
        </button>
        <button className="action-btn primary" onClick={() => onTrade(signal)}>
          📝 Paper Trade
        </button>
      </div>
    </div>
  );
};

export default SignalDetail;
