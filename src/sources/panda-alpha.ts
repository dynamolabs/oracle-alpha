/**
 * Panda Alpha Signal Source Integration
 * Consumes signals from our Panda Alpha memecoin caller
 */

import { readFileSync, existsSync } from 'fs';
import { SignalSource, RawSignal } from '../types';

const PANDA_SCORING_LOG = '/root/clawd/panda-alpha/data/scoring-log.json';
const SOURCE_NAME = 'panda_alpha';

interface PandaSignal {
  timestamp: number;
  token: string;
  ca: string;
  mcap: number;
  liquidity: number;
  age: number;
  vol5m: number;
  buyRatio: number;
  change5m: number;
  score: number;
  baseScore: number;
  signalBoost: number;
  passed: boolean;
  called: boolean;
  reasons: string[];
}

export async function scanPandaAlpha(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  if (!existsSync(PANDA_SCORING_LOG)) {
    console.log('[PandaAlpha] Scoring log not found');
    return signals;
  }

  try {
    const data = readFileSync(PANDA_SCORING_LOG, 'utf-8');
    const pandaSignals: PandaSignal[] = JSON.parse(data);

    // Get signals from last hour that were called
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentCalls = pandaSignals.filter(s => s.timestamp > oneHourAgo && s.called);

    for (const panda of recentCalls) {
      // Convert Panda score (0-200) to Oracle score (0-100)
      const normalizedScore = Math.min(100, Math.round(panda.score / 2));

      signals.push({
        source: SOURCE_NAME,
        token: panda.ca,
        symbol: panda.token,
        rawScore: normalizedScore,
        confidence: panda.buyRatio,
        metadata: {
          pandaScore: panda.score,
          baseScore: panda.baseScore,
          signalBoost: panda.signalBoost,
          mcap: panda.mcap,
          vol5m: panda.vol5m,
          age: panda.age,
          reasons: panda.reasons
        },
        timestamp: panda.timestamp
      });
    }

    console.log(`[PandaAlpha] Found ${signals.length} recent called signals`);
  } catch (err) {
    console.error('[PandaAlpha] Error reading scoring log:', err);
  }

  return signals;
}

export const pandaAlphaSource: SignalSource = {
  name: SOURCE_NAME,
  displayName: 'Panda Alpha',
  description: 'AI-powered memecoin signal aggregator',
  weight: 0.15, // 15% weight in final score
  enabled: true,
  scan: scanPandaAlpha
};

export default pandaAlphaSource;
