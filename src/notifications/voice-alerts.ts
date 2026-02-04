// Voice Alerts Module
// Text-to-speech notifications for high score signals
// Uses Web Speech API on the frontend - backend handles settings and message generation

import { AggregatedSignal } from '../types';

// Voice alert settings
export interface VoiceAlertSettings {
  enabled: boolean;
  minScore: number; // Minimum score to trigger voice alert (default 70)
  voice: string; // Browser voice name (selected on frontend)
  rate: number; // Speech rate 0.5-2 (default 1)
  volume: number; // Volume 0-1 (default 0.8)
  pitch: number; // Pitch 0-2 (default 1)
  announceRiskWarnings: boolean; // Include risk warnings in speech
  cooldownSeconds: number; // Minimum time between announcements
  priorityOnly: boolean; // Only announce HIGH_CONVICTION or ULTRA signals
}

// Default settings
const DEFAULT_SETTINGS: VoiceAlertSettings = {
  enabled: false,
  minScore: 70,
  voice: 'default',
  rate: 1.0,
  volume: 0.8,
  pitch: 1.0,
  announceRiskWarnings: true,
  cooldownSeconds: 10,
  priorityOnly: false
};

// In-memory settings store (per-session, can be persisted if needed)
let currentSettings: VoiceAlertSettings = { ...DEFAULT_SETTINGS };

// Track last announcement time for cooldown
let lastAnnouncementTime = 0;

/**
 * Get current voice alert settings
 */
export function getVoiceSettings(): VoiceAlertSettings {
  return { ...currentSettings };
}

/**
 * Update voice alert settings
 */
export function updateVoiceSettings(updates: Partial<VoiceAlertSettings>): VoiceAlertSettings {
  currentSettings = {
    ...currentSettings,
    ...updates
  };
  
  // Clamp values to valid ranges
  currentSettings.rate = Math.max(0.5, Math.min(2, currentSettings.rate));
  currentSettings.volume = Math.max(0, Math.min(1, currentSettings.volume));
  currentSettings.pitch = Math.max(0, Math.min(2, currentSettings.pitch));
  currentSettings.minScore = Math.max(0, Math.min(100, currentSettings.minScore));
  currentSettings.cooldownSeconds = Math.max(0, Math.min(300, currentSettings.cooldownSeconds));
  
  return { ...currentSettings };
}

/**
 * Reset settings to defaults
 */
export function resetVoiceSettings(): VoiceAlertSettings {
  currentSettings = { ...DEFAULT_SETTINGS };
  return { ...currentSettings };
}

/**
 * Check if a signal should trigger a voice alert
 */
export function shouldAnnounce(signal: AggregatedSignal): boolean {
  if (!currentSettings.enabled) return false;
  if (signal.score < currentSettings.minScore) return false;
  
  // Check conviction level if priority only
  if (currentSettings.priorityOnly) {
    const conviction = signal.confluence?.convictionLevel;
    if (conviction !== 'HIGH_CONVICTION' && conviction !== 'ULTRA') {
      return false;
    }
  }
  
  // Check cooldown
  const now = Date.now();
  if (now - lastAnnouncementTime < currentSettings.cooldownSeconds * 1000) {
    return false;
  }
  
  return true;
}

/**
 * Mark that an announcement was made (for cooldown tracking)
 */
export function markAnnounced(): void {
  lastAnnouncementTime = Date.now();
}

/**
 * Get the tone/emphasis based on risk level and score
 */
function getTone(riskLevel: string, score: number): 'excited' | 'normal' | 'cautious' {
  if (score >= 80 && (riskLevel === 'LOW' || riskLevel === 'MEDIUM')) {
    return 'excited';
  }
  if (riskLevel === 'HIGH' || riskLevel === 'EXTREME') {
    return 'cautious';
  }
  return 'normal';
}

/**
 * Generate voice message for a signal
 */
export function generateVoiceMessage(signal: AggregatedSignal): VoiceMessage {
  const tone = getTone(signal.riskLevel, signal.score);
  
  // Build the message
  let message = '';
  
  // Opening based on tone
  if (tone === 'excited') {
    message = `New high score signal! `;
  } else if (tone === 'cautious') {
    message = `Caution. New signal. `;
  } else {
    message = `New signal. `;
  }
  
  // Token info
  message += `${signal.symbol}. Score ${signal.score}. `;
  
  // Risk level
  message += `Risk level ${signal.riskLevel.toLowerCase()}. `;
  
  // Market cap
  if (signal.marketData.mcap) {
    const mcapK = Math.round(signal.marketData.mcap / 1000);
    if (mcapK >= 1000) {
      message += `Market cap ${(mcapK / 1000).toFixed(1)} million. `;
    } else {
      message += `Market cap ${mcapK}K. `;
    }
  }
  
  // Conviction level
  if (signal.confluence?.convictionLevel) {
    if (signal.confluence.convictionLevel === 'ULTRA') {
      message += `Ultra conviction! `;
    } else if (signal.confluence.convictionLevel === 'HIGH_CONVICTION') {
      message += `High conviction. `;
    }
  }
  
  // Risk warnings if enabled
  if (currentSettings.announceRiskWarnings && signal.safety) {
    const warnings: string[] = [];
    
    if (signal.safety.bundleRiskLevel === 'CRITICAL' || signal.safety.bundleRiskLevel === 'HIGH') {
      warnings.push('bundle risk detected');
    }
    if (signal.safety.honeypotRisk?.riskLevel === 'HIGH_RISK' || signal.safety.honeypotRisk?.isHoneypot) {
      warnings.push('possible honeypot');
    }
    if (signal.safety.washRiskLevel === 'HIGH' || signal.safety.washRiskLevel === 'EXTREME') {
      warnings.push('wash trading suspected');
    }
    if (signal.safety.sniperActivity?.sniperRisk === 'CRITICAL' || signal.safety.sniperActivity?.sniperRisk === 'HIGH') {
      warnings.push('heavy sniper activity');
    }
    
    if (warnings.length > 0) {
      message += `Warning: ${warnings.join(', ')}. `;
    }
  }
  
  // Sources summary
  const sourceCount = signal.sources.length;
  if (sourceCount > 1) {
    message += `${sourceCount} sources confirmed. `;
  }
  
  return {
    text: message.trim(),
    tone,
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      score: signal.score,
      riskLevel: signal.riskLevel
    },
    settings: {
      rate: tone === 'excited' ? currentSettings.rate * 1.1 : 
            tone === 'cautious' ? currentSettings.rate * 0.9 : 
            currentSettings.rate,
      pitch: tone === 'excited' ? currentSettings.pitch * 1.05 : 
             tone === 'cautious' ? currentSettings.pitch * 0.95 : 
             currentSettings.pitch,
      volume: currentSettings.volume
    }
  };
}

/**
 * Generate a test message
 */
export function generateTestMessage(): VoiceMessage {
  return {
    text: 'Voice alerts are working. New signal! Test token. Score 85. Risk level low. Market cap 500K. High conviction. 3 sources confirmed.',
    tone: 'excited',
    signal: {
      id: 'test',
      symbol: 'TEST',
      score: 85,
      riskLevel: 'LOW'
    },
    settings: {
      rate: currentSettings.rate * 1.1,
      pitch: currentSettings.pitch * 1.05,
      volume: currentSettings.volume
    }
  };
}

/**
 * Voice message structure (sent to frontend for TTS)
 */
export interface VoiceMessage {
  text: string;
  tone: 'excited' | 'normal' | 'cautious';
  signal: {
    id: string;
    symbol: string;
    score: number;
    riskLevel: string;
  };
  settings: {
    rate: number;
    pitch: number;
    volume: number;
  };
}

/**
 * Get voice message for a specific signal by ID
 */
export function getVoiceMessageForSignal(signal: AggregatedSignal | undefined): VoiceMessage | null {
  if (!signal) return null;
  return generateVoiceMessage(signal);
}

/**
 * Get available voices hint (actual voices are on frontend)
 */
export function getVoiceHint(): string {
  return 'Voice selection is handled by the browser. Common voices: Google US English, Microsoft David, Alex (macOS), etc.';
}

// Export for WebSocket broadcasting
export interface VoiceAlertEvent {
  type: 'voice_alert';
  message: VoiceMessage;
  timestamp: number;
}

/**
 * Create a voice alert event for WebSocket broadcast
 */
export function createVoiceAlertEvent(signal: AggregatedSignal): VoiceAlertEvent | null {
  if (!shouldAnnounce(signal)) return null;
  
  markAnnounced();
  
  return {
    type: 'voice_alert',
    message: generateVoiceMessage(signal),
    timestamp: Date.now()
  };
}
