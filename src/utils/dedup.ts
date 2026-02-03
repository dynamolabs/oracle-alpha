// Signal deduplication utilities
// Prevents spam and duplicate alerts

interface SeenSignal {
  token: string;
  firstSeen: number;
  count: number;
  lastScore: number;
}

const seenSignals = new Map<string, SeenSignal>();
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// Check if this is a duplicate or spam signal
export function isDuplicate(token: string, score: number): boolean {
  const now = Date.now();
  const seen = seenSignals.get(token);
  
  if (!seen) {
    // First time seeing this token
    seenSignals.set(token, {
      token,
      firstSeen: now,
      count: 1,
      lastScore: score
    });
    return false;
  }
  
  // Check if within dedup window
  if (now - seen.firstSeen < DEDUP_WINDOW_MS) {
    seen.count++;
    seen.lastScore = score;
    
    // Allow if score improved significantly (10+ points)
    if (score - seen.lastScore >= 10) {
      return false;
    }
    
    return true; // Duplicate
  }
  
  // Outside dedup window, reset
  seenSignals.set(token, {
    token,
    firstSeen: now,
    count: 1,
    lastScore: score
  });
  return false;
}

// Clean old entries periodically
export function cleanupSeenSignals(): void {
  const now = Date.now();
  for (const [token, seen] of seenSignals.entries()) {
    if (now - seen.firstSeen > DEDUP_WINDOW_MS * 2) {
      seenSignals.delete(token);
    }
  }
}

// Get signal frequency (for scoring boost/penalty)
export function getSignalFrequency(token: string): number {
  const seen = seenSignals.get(token);
  return seen?.count || 0;
}

// Reset for testing
export function resetDedup(): void {
  seenSignals.clear();
}
