/**
 * ORACLE Alpha Telegram Subscriber Management
 * Stores subscriber preferences in JSON file
 */

import fs from 'fs';
import path from 'path';
import { RiskLevel } from '../types';

// Storage path
const DATA_DIR = path.join(__dirname, '../../data');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');

// Subscriber preference types
export interface SubscriberPrefs {
  minScore: number; // Minimum signal score (50-100)
  riskLevels: RiskLevel[]; // Which risk levels to receive
  quietHoursStart?: number; // Hour (0-23) when quiet hours begin
  quietHoursEnd?: number; // Hour (0-23) when quiet hours end
  sources?: string[]; // Filter by specific sources (optional)
}

export interface Subscriber {
  userId: string;
  chatId: string;
  prefs: SubscriberPrefs;
  createdAt: number;
  lastAlertAt?: number;
  mutedUntil?: number;
  alertCount: number;
}

export interface SubscribersData {
  version: number;
  subscribers: Record<string, Subscriber>;
  stats: {
    totalAlertsSent: number;
    lastBroadcastAt?: number;
  };
}

// Default preferences
const DEFAULT_PREFS: SubscriberPrefs = {
  minScore: 70,
  riskLevels: ['LOW', 'MEDIUM', 'HIGH']
};

// In-memory cache
let subscribersCache: SubscribersData | null = null;

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load subscribers from JSON file
 */
export function loadSubscribers(): Record<string, Subscriber> {
  if (subscribersCache) {
    return subscribersCache.subscribers;
  }

  ensureDataDir();

  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
      subscribersCache = JSON.parse(data);
      return subscribersCache!.subscribers;
    }
  } catch (error) {
    console.error('[SUBSCRIBERS] Error loading subscribers:', error);
  }

  // Initialize empty data
  subscribersCache = {
    version: 1,
    subscribers: {},
    stats: {
      totalAlertsSent: 0
    }
  };

  return subscribersCache.subscribers;
}

/**
 * Save subscribers to JSON file
 */
export function saveSubscribers(): void {
  if (!subscribersCache) {
    loadSubscribers();
  }

  ensureDataDir();

  try {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribersCache, null, 2));
  } catch (error) {
    console.error('[SUBSCRIBERS] Error saving subscribers:', error);
  }
}

/**
 * Get a specific subscriber
 */
export function getSubscriber(userId: string): Subscriber | null {
  const subscribers = loadSubscribers();
  return subscribers[userId] || null;
}

/**
 * Add a new subscriber
 */
export function addSubscriber(
  userId: string,
  chatId: string,
  prefs?: Partial<SubscriberPrefs>
): Subscriber {
  const subscribers = loadSubscribers();

  const subscriber: Subscriber = {
    userId,
    chatId,
    prefs: {
      ...DEFAULT_PREFS,
      ...prefs
    },
    createdAt: Date.now(),
    alertCount: 0
  };

  subscribers[userId] = subscriber;
  saveSubscribers();

  console.log(`[SUBSCRIBERS] Added subscriber: ${userId}`);
  return subscriber;
}

/**
 * Remove a subscriber
 */
export function removeSubscriber(userId: string): boolean {
  const subscribers = loadSubscribers();

  if (subscribers[userId]) {
    delete subscribers[userId];
    saveSubscribers();
    console.log(`[SUBSCRIBERS] Removed subscriber: ${userId}`);
    return true;
  }

  return false;
}

/**
 * Update subscriber preferences
 */
export function updateSubscriber(userId: string, prefs: Partial<SubscriberPrefs>): Subscriber | null {
  const subscribers = loadSubscribers();
  const subscriber = subscribers[userId];

  if (!subscriber) {
    return null;
  }

  subscriber.prefs = {
    ...subscriber.prefs,
    ...prefs
  };

  saveSubscribers();
  console.log(`[SUBSCRIBERS] Updated subscriber: ${userId}`);
  return subscriber;
}

/**
 * Set subscriber muted until timestamp
 */
export function muteSubscriber(userId: string, until: number): void {
  const subscribers = loadSubscribers();
  const subscriber = subscribers[userId];

  if (subscriber) {
    subscriber.mutedUntil = until;
    saveSubscribers();
  }
}

/**
 * Record that an alert was sent to a subscriber
 */
export function recordAlert(userId: string): void {
  const subscribers = loadSubscribers();
  const subscriber = subscribers[userId];

  if (subscriber) {
    subscriber.lastAlertAt = Date.now();
    subscriber.alertCount++;
  }

  if (subscribersCache) {
    subscribersCache.stats.totalAlertsSent++;
    subscribersCache.stats.lastBroadcastAt = Date.now();
  }

  saveSubscribers();
}

/**
 * Get subscribers eligible for a specific signal
 */
export function getEligibleSubscribers(
  score: number,
  riskLevel: RiskLevel
): Subscriber[] {
  const subscribers = loadSubscribers();
  const now = Date.now();

  return Object.values(subscribers).filter(sub => {
    // Check if muted
    if (sub.mutedUntil && sub.mutedUntil > now) {
      return false;
    }

    // Check min score
    if (score < sub.prefs.minScore) {
      return false;
    }

    // Check risk level
    if (!sub.prefs.riskLevels.includes(riskLevel)) {
      return false;
    }

    // Check quiet hours
    if (sub.prefs.quietHoursStart !== undefined && sub.prefs.quietHoursEnd !== undefined) {
      const hour = new Date().getHours();
      const start = sub.prefs.quietHoursStart;
      const end = sub.prefs.quietHoursEnd;

      // Handle overnight quiet hours (e.g., 23:00 - 08:00)
      if (start > end) {
        if (hour >= start || hour < end) {
          return false;
        }
      } else {
        if (hour >= start && hour < end) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Get subscriber statistics
 */
export function getSubscriberStats(): {
  totalSubscribers: number;
  activeToday: number;
  totalAlertsSent: number;
  avgMinScore: number;
} {
  const subscribers = loadSubscribers();
  const values = Object.values(subscribers);
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const activeToday = values.filter(
    s => s.lastAlertAt && s.lastAlertAt >= oneDayAgo
  ).length;

  const avgMinScore = values.length > 0
    ? values.reduce((sum, s) => sum + s.prefs.minScore, 0) / values.length
    : 70;

  return {
    totalSubscribers: values.length,
    activeToday,
    totalAlertsSent: subscribersCache?.stats.totalAlertsSent || 0,
    avgMinScore: Math.round(avgMinScore)
  };
}

/**
 * Get all subscribers (for admin purposes)
 */
export function getAllSubscribers(): Subscriber[] {
  return Object.values(loadSubscribers());
}

/**
 * Clear all subscribers (for testing)
 */
export function clearAllSubscribers(): void {
  subscribersCache = {
    version: 1,
    subscribers: {},
    stats: {
      totalAlertsSent: 0
    }
  };
  saveSubscribers();
}

/**
 * Export subscribers data
 */
export function exportSubscribersData(): SubscribersData | null {
  loadSubscribers();
  return subscribersCache;
}

/**
 * Import subscribers data
 */
export function importSubscribersData(data: SubscribersData): void {
  subscribersCache = data;
  saveSubscribers();
}
