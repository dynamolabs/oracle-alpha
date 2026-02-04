/**
 * Scoring Settings Component
 * 
 * Dashboard UI for customizing signal scoring weights.
 * Includes sliders, preset selector, and live preview.
 */

import React, { useState, useEffect, useCallback } from 'react';

// Types
interface SourceWeights {
  'smart-wallet-elite': number;
  'smart-wallet-sniper': number;
  'volume-spike': number;
  'kol-tracker': number;
  'narrative': number;
  'whale': number;
  'news': number;
  'pump-koth'?: number;
  'dexscreener'?: number;
  'kol-social'?: number;
  'new-launch'?: number;
  'twitter-sentiment'?: number;
  'dex-volume-anomaly'?: number;
}

interface RiskPenalties {
  honeypotPenalty: number;
  bundlePenalty: number;
  sniperPenalty: number;
  washPenalty: number;
}

interface Preset {
  id: string;
  name: string;
  description: string;
}

interface ScoringSettingsProps {
  onClose?: () => void;
  onWeightsChange?: (weights: { sourceWeights: SourceWeights; riskPenalties: RiskPenalties }) => void;
}

// Weight Slider Component
const WeightSlider: React.FC<{
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  icon?: string;
  color?: string;
}> = ({ label, description, value, onChange, icon = '⚖️', color = '#3b82f6' }) => {
  return (
    <div className="weight-slider">
      <div className="weight-header">
        <span className="weight-icon">{icon}</span>
        <span className="weight-label">{label}</span>
        <span className="weight-value" style={{ color }}>{value}</span>
      </div>
      <div className="weight-description">{description}</div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="slider"
        style={{ 
          '--slider-color': color,
          '--slider-fill': `${value}%`
        } as React.CSSProperties}
      />
    </div>
  );
};

// Main Component
export const ScoringSettings: React.FC<ScoringSettingsProps> = ({ onClose, onWeightsChange }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'sources' | 'risks' | 'presets'>('sources');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activeProfile, setActiveProfile] = useState('default');
  const [hasChanges, setHasChanges] = useState(false);
  
  const [sourceWeights, setSourceWeights] = useState<SourceWeights>({
    'smart-wallet-elite': 30,
    'smart-wallet-sniper': 25,
    'volume-spike': 15,
    'kol-tracker': 15,
    'narrative': 10,
    'whale': 10,
    'news': 5,
    'pump-koth': 20,
    'dexscreener': 10,
    'kol-social': 8,
    'new-launch': 5,
    'twitter-sentiment': 5,
    'dex-volume-anomaly': 10,
  });
  
  const [riskPenalties, setRiskPenalties] = useState<RiskPenalties>({
    honeypotPenalty: 50,
    bundlePenalty: 30,
    sniperPenalty: 20,
    washPenalty: 25,
  });

  // Fetch current weights
  const fetchWeights = useCallback(async () => {
    try {
      const response = await fetch('/api/scoring/weights');
      const data = await response.json();
      
      if (data.sourceWeights) {
        setSourceWeights(data.sourceWeights);
      }
      if (data.riskPenalties) {
        setRiskPenalties(data.riskPenalties);
      }
      if (data.activeProfile) {
        setActiveProfile(data.activeProfile);
      }
    } catch (error) {
      console.error('Failed to fetch weights:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch presets
  const fetchPresets = useCallback(async () => {
    try {
      const response = await fetch('/api/scoring/presets');
      const data = await response.json();
      setPresets(data.presets || []);
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    }
  }, []);

  useEffect(() => {
    fetchWeights();
    fetchPresets();
  }, [fetchWeights, fetchPresets]);

  // Update source weight
  const updateSourceWeight = (key: keyof SourceWeights, value: number) => {
    setSourceWeights(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Update risk penalty
  const updateRiskPenalty = (key: keyof RiskPenalties, value: number) => {
    setRiskPenalties(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Save weights
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/scoring/weights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceWeights, riskPenalties }),
      });
      
      if (response.ok) {
        setHasChanges(false);
        if (onWeightsChange) {
          onWeightsChange({ sourceWeights, riskPenalties });
        }
        // Show success feedback
        alert('✅ Weights saved successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to save weights:', error);
      alert('❌ Failed to save weights');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = async () => {
    if (!confirm('Reset all weights to default values?')) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/scoring/reset', {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSourceWeights(data.sourceWeights);
        setRiskPenalties(data.riskPenalties);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to reset weights:', error);
    } finally {
      setSaving(false);
    }
  };

  // Apply preset
  const handleApplyPreset = async (presetId: string) => {
    if (!confirm(`Apply "${presets.find(p => p.id === presetId)?.name}" preset? This will overwrite current weights.`)) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/scoring/apply-preset/${presetId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSourceWeights(data.sourceWeights);
        setRiskPenalties(data.riskPenalties);
        setHasChanges(false);
        alert(`✅ Applied "${data.preset}" preset!`);
      }
    } catch (error) {
      console.error('Failed to apply preset:', error);
    } finally {
      setSaving(false);
    }
  };

  // Re-score signals
  const handleRescore = async () => {
    try {
      const response = await fetch('/api/scoring/rescore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`✅ Re-scored ${data.count} signals\n\n📈 Improved: ${data.summary.improved}\n📉 Degraded: ${data.summary.degraded}\n➖ Unchanged: ${data.summary.unchanged}`);
      }
    } catch (error) {
      console.error('Failed to re-score:', error);
    }
  };

  if (loading) {
    return (
      <div className="scoring-settings loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="scoring-settings">
      <div className="settings-header">
        <h2>⚙️ Scoring Settings</h2>
        <p className="profile-indicator">Profile: <strong>{activeProfile}</strong></p>
        {onClose && (
          <button className="close-btn" onClick={onClose}>×</button>
        )}
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        <button 
          className={`tab ${activeTab === 'sources' ? 'active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          📊 Source Weights
        </button>
        <button 
          className={`tab ${activeTab === 'risks' ? 'active' : ''}`}
          onClick={() => setActiveTab('risks')}
        >
          ⚠️ Risk Penalties
        </button>
        <button 
          className={`tab ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          🎨 Presets
        </button>
      </div>

      <div className="settings-content">
        {/* Source Weights Tab */}
        {activeTab === 'sources' && (
          <div className="weights-section">
            <h3>📊 Signal Source Weights</h3>
            <p className="section-description">
              Adjust how much each signal source contributes to the final score.
              Higher weight = more influence on score.
            </p>
            
            <div className="weights-grid">
              <WeightSlider
                label="Smart Wallet Elite"
                description="Elite wallets with 70%+ win rate"
                icon="👑"
                color="#fbbf24"
                value={sourceWeights['smart-wallet-elite']}
                onChange={(v) => updateSourceWeight('smart-wallet-elite', v)}
              />
              
              <WeightSlider
                label="Smart Wallet Sniper"
                description="Fast-acting smart wallets"
                icon="🎯"
                color="#f97316"
                value={sourceWeights['smart-wallet-sniper']}
                onChange={(v) => updateSourceWeight('smart-wallet-sniper', v)}
              />
              
              <WeightSlider
                label="Volume Spike"
                description="Unusual volume activity"
                icon="📈"
                color="#22c55e"
                value={sourceWeights['volume-spike']}
                onChange={(v) => updateSourceWeight('volume-spike', v)}
              />
              
              <WeightSlider
                label="KOL Tracker"
                description="Key opinion leader signals"
                icon="📣"
                color="#8b5cf6"
                value={sourceWeights['kol-tracker']}
                onChange={(v) => updateSourceWeight('kol-tracker', v)}
              />
              
              <WeightSlider
                label="Narrative"
                description="Trending narratives & themes"
                icon="📖"
                color="#ec4899"
                value={sourceWeights['narrative']}
                onChange={(v) => updateSourceWeight('narrative', v)}
              />
              
              <WeightSlider
                label="Whale Tracker"
                description="Large wallet movements"
                icon="🐋"
                color="#06b6d4"
                value={sourceWeights['whale']}
                onChange={(v) => updateSourceWeight('whale', v)}
              />
              
              <WeightSlider
                label="News"
                description="News and announcements"
                icon="📰"
                color="#6b7280"
                value={sourceWeights['news']}
                onChange={(v) => updateSourceWeight('news', v)}
              />

              <WeightSlider
                label="Pump KOTH"
                description="King of the Hill signals"
                icon="🏆"
                color="#eab308"
                value={sourceWeights['pump-koth'] || 20}
                onChange={(v) => updateSourceWeight('pump-koth', v)}
              />

              <WeightSlider
                label="DexScreener"
                description="DEX listing signals"
                icon="📊"
                color="#14b8a6"
                value={sourceWeights['dexscreener'] || 10}
                onChange={(v) => updateSourceWeight('dexscreener', v)}
              />

              <WeightSlider
                label="Twitter Sentiment"
                description="Social media buzz"
                icon="🐦"
                color="#1d9bf0"
                value={sourceWeights['twitter-sentiment'] || 5}
                onChange={(v) => updateSourceWeight('twitter-sentiment', v)}
              />
            </div>
          </div>
        )}

        {/* Risk Penalties Tab */}
        {activeTab === 'risks' && (
          <div className="risks-section">
            <h3>⚠️ Risk Penalty Settings</h3>
            <p className="section-description">
              Configure how much detected risks reduce the signal score.
              Higher penalty = more score reduction when risk is detected.
            </p>
            
            <div className="weights-grid">
              <WeightSlider
                label="Honeypot Penalty"
                description="Penalty for honeypot risk detection"
                icon="🍯"
                color="#ef4444"
                value={riskPenalties.honeypotPenalty}
                onChange={(v) => updateRiskPenalty('honeypotPenalty', v)}
              />
              
              <WeightSlider
                label="Bundle Penalty"
                description="Penalty for coordinated buying"
                icon="📦"
                color="#f97316"
                value={riskPenalties.bundlePenalty}
                onChange={(v) => updateRiskPenalty('bundlePenalty', v)}
              />
              
              <WeightSlider
                label="Sniper Penalty"
                description="Penalty for sniper/bot activity"
                icon="🎯"
                color="#eab308"
                value={riskPenalties.sniperPenalty}
                onChange={(v) => updateRiskPenalty('sniperPenalty', v)}
              />
              
              <WeightSlider
                label="Wash Trading Penalty"
                description="Penalty for fake volume"
                icon="🚿"
                color="#8b5cf6"
                value={riskPenalties.washPenalty}
                onChange={(v) => updateRiskPenalty('washPenalty', v)}
              />
            </div>
          </div>
        )}

        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <div className="presets-section">
            <h3>🎨 Scoring Presets</h3>
            <p className="section-description">
              Quick-apply pre-configured weight profiles for different trading styles.
            </p>
            
            <div className="presets-grid">
              {presets.map(preset => (
                <div key={preset.id} className="preset-card">
                  <div className="preset-icon">
                    {preset.id === 'conservative' && '🛡️'}
                    {preset.id === 'aggressive' && '🔥'}
                    {preset.id === 'kol-focused' && '📣'}
                    {preset.id === 'smart-money' && '💎'}
                    {preset.id === 'degen' && '🎰'}
                    {preset.id === 'volume-hunter' && '📈'}
                    {!['conservative', 'aggressive', 'kol-focused', 'smart-money', 'degen', 'volume-hunter'].includes(preset.id) && '⚙️'}
                  </div>
                  <div className="preset-info">
                    <h4>{preset.name}</h4>
                    <p>{preset.description}</p>
                  </div>
                  <button 
                    className="apply-btn"
                    onClick={() => handleApplyPreset(preset.id)}
                    disabled={saving}
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="settings-actions">
        <button 
          className="action-btn secondary"
          onClick={handleReset}
          disabled={saving}
        >
          🔄 Reset to Defaults
        </button>
        
        <button 
          className="action-btn secondary"
          onClick={handleRescore}
          disabled={saving}
        >
          📊 Re-score Signals
        </button>
        
        <button 
          className={`action-btn primary ${hasChanges ? 'has-changes' : ''}`}
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? '⏳ Saving...' : hasChanges ? '💾 Save Changes' : '✓ Saved'}
        </button>
      </div>

      <style>{`
        .scoring-settings {
          background: var(--tg-theme-bg-color, #1a1a2e);
          border-radius: 16px;
          padding: 20px;
          max-width: 600px;
          margin: 0 auto;
        }

        .settings-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .settings-header h2 {
          margin: 0;
          flex: 1;
          font-size: 20px;
          color: var(--tg-theme-text-color, #fff);
        }

        .profile-indicator {
          font-size: 12px;
          color: var(--tg-theme-hint-color, #888);
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--tg-theme-hint-color, #888);
          font-size: 24px;
          cursor: pointer;
          padding: 0 5px;
        }

        .settings-tabs {
          display: flex;
          gap: 5px;
          margin-bottom: 20px;
          overflow-x: auto;
        }

        .tab {
          flex: 1;
          padding: 12px 16px;
          border: none;
          background: rgba(255,255,255,0.05);
          color: var(--tg-theme-hint-color, #888);
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .tab:hover {
          background: rgba(255,255,255,0.1);
        }

        .tab.active {
          background: var(--tg-theme-button-color, #3b82f6);
          color: var(--tg-theme-button-text-color, #fff);
        }

        .settings-content {
          min-height: 400px;
        }

        .section-description {
          color: var(--tg-theme-hint-color, #888);
          font-size: 13px;
          margin-bottom: 20px;
        }

        h3 {
          color: var(--tg-theme-text-color, #fff);
          font-size: 16px;
          margin: 0 0 10px 0;
        }

        .weights-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .weight-slider {
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          padding: 15px;
        }

        .weight-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 5px;
        }

        .weight-icon {
          font-size: 18px;
        }

        .weight-label {
          flex: 1;
          font-weight: 500;
          color: var(--tg-theme-text-color, #fff);
        }

        .weight-value {
          font-weight: 600;
          font-size: 16px;
          min-width: 30px;
          text-align: right;
        }

        .weight-description {
          font-size: 12px;
          color: var(--tg-theme-hint-color, #888);
          margin-bottom: 10px;
        }

        .slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: rgba(255,255,255,0.1);
          outline: none;
          -webkit-appearance: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--slider-color, #3b82f6);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        .presets-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .preset-card {
          display: flex;
          align-items: center;
          gap: 15px;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          padding: 15px;
        }

        .preset-icon {
          font-size: 32px;
        }

        .preset-info {
          flex: 1;
        }

        .preset-info h4 {
          margin: 0 0 5px 0;
          color: var(--tg-theme-text-color, #fff);
          font-size: 14px;
        }

        .preset-info p {
          margin: 0;
          font-size: 12px;
          color: var(--tg-theme-hint-color, #888);
        }

        .apply-btn {
          padding: 8px 16px;
          border: none;
          background: var(--tg-theme-button-color, #3b82f6);
          color: var(--tg-theme-button-text-color, #fff);
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          transition: opacity 0.2s;
        }

        .apply-btn:hover {
          opacity: 0.9;
        }

        .apply-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .settings-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid rgba(255,255,255,0.1);
          flex-wrap: wrap;
        }

        .action-btn {
          flex: 1;
          min-width: 120px;
          padding: 12px 20px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .action-btn.primary {
          background: var(--tg-theme-button-color, #3b82f6);
          color: var(--tg-theme-button-text-color, #fff);
        }

        .action-btn.primary.has-changes {
          background: #22c55e;
          animation: pulse 2s infinite;
        }

        .action-btn.secondary {
          background: rgba(255,255,255,0.1);
          color: var(--tg-theme-text-color, #fff);
        }

        .action-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 300px;
        }

        .loading-spinner {
          color: var(--tg-theme-hint-color, #888);
        }
      `}</style>
    </div>
  );
};

export default ScoringSettings;
