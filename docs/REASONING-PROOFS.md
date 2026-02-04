# 🔮 ORACLE Alpha - Verifiable AI Reasoning Proofs

## Overview

The Reasoning Proofs system provides **cryptographic proof** that the AI's analysis was committed **BEFORE** the price outcome was known. This makes ORACLE Alpha's predictions verifiable and trustless.

## How It Works

### The Problem
Without proof, anyone could claim their AI "predicted" something after seeing the outcome. This is called **hindsight bias** - it's easy to explain why something happened after the fact.

### The Solution: Commit-Reveal Scheme

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMITMENT PHASE                              │
│                    (Before Outcome)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. AI generates reasoning analysis                              │
│     ┌──────────────────────────────────────┐                    │
│     │ "Elite wallet buying, low mcap,      │                    │
│     │  strong narrative - HIGH conviction"  │                    │
│     └──────────────────────────────────────┘                    │
│                         │                                        │
│  2. Add random salt     │                                        │
│     salt = "a7f3c8..."  │                                        │
│                         │                                        │
│  3. Create hash         ▼                                        │
│     hash = SHA256(reasoning + salt)                             │
│          = "e9d4f2a1..."                                        │
│                         │                                        │
│  4. Publish ONLY hash   │                                        │
│     on-chain ──────────►│◄─── Hash is immutable!                │
│                         │                                        │
│  5. Store reasoning     │                                        │
│     locally (secret) ───┘                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Price moves...
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REVEAL PHASE                                │
│                    (After Outcome)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Publish reasoning + salt                                     │
│                                                                  │
│  2. ANYONE can verify:                                           │
│     SHA256(reasoning + salt) == on-chain hash                   │
│                                                                  │
│  3. If match → Reasoning was TRULY pre-committed                │
│     If no match → FRAUD (impossible to fake)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Matters

### 1. **Prevents Fraud**
The AI cannot modify its reasoning after seeing the outcome. The hash was committed on-chain BEFORE the price moved.

### 2. **Builds Trust**
Instead of "trust me, I predicted this", we have "here's cryptographic proof I committed this reasoning before the outcome."

### 3. **Creates Auditable Track Record**
Anyone can audit the historical reasoning to see:
- How accurate were the predictions?
- What reasoning led to wins vs losses?
- Is the AI improving over time?

### 4. **Decentralized Verification**
No need to trust a central authority. The blockchain stores the hash, and the math is verifiable by anyone.

## API Endpoints

### List All Proofs
```bash
GET /api/proofs

Response:
{
  "count": 42,
  "proofs": [
    {
      "signalId": "abc123",
      "symbol": "TRUMP",
      "reasoningHash": "e9d4f2a1...",
      "revealed": false,
      "verified": true
    }
  ]
}
```

### Get Proof Details
```bash
GET /api/proofs/:signalId

# If not revealed - only hash shown
Response:
{
  "signalId": "abc123",
  "symbol": "TRUMP",
  "reasoningHash": "e9d4f2a1...",
  "revealed": false,
  "message": "Reasoning not yet revealed. Hash is committed on-chain."
}

# If revealed - full reasoning shown
Response:
{
  "signalId": "abc123",
  "symbol": "TRUMP",
  "reasoningHash": "e9d4f2a1...",
  "revealed": true,
  "reasoning": {
    "summary": "Signal detected for $TRUMP...",
    "bullishFactors": ["Elite wallet accumulating..."],
    "bearishFactors": [],
    "priceTargets": { "upside": "$500K mcap", "downside": "$50K mcap" },
    "conviction": "HIGH"
  },
  "verified": true
}
```

### Verify a Proof
```bash
GET /api/proofs/:signalId/verify

Response:
{
  "signalId": "abc123",
  "reasoningHash": "e9d4f2a1...",
  "verified": true,
  "message": "Proof is valid - hash(reasoning + salt) matches committed hash"
}
```

### Reveal Reasoning
```bash
POST /api/proofs/:signalId/reveal
Body: { "currentPrice": 150000 }

Response:
{
  "signalId": "abc123",
  "symbol": "TRUMP",
  "revealed": true,
  "reasoning": { ... },
  "verified": true
}
```

## On-Chain Structure

Each signal on Solana now includes:

```rust
pub struct Signal {
    // ... existing fields ...
    
    /// SHA256 hash of AI reasoning committed BEFORE outcome
    pub reasoning_hash: [u8; 32],
    
    /// Whether the reasoning has been revealed publicly
    pub reasoning_revealed: bool,
}
```

The hash is stored as 32 bytes (256 bits) on-chain, making it:
- **Immutable** - Cannot be changed after publishing
- **Permanent** - Lives forever on Solana
- **Verifiable** - Anyone can check the hash

## CLI Tool

```bash
# List all proofs
npx ts-node src/reasoning/cli.ts list

# Verify a proof
npx ts-node src/reasoning/cli.ts verify abc123

# Reveal reasoning (after price movement)
npx ts-node src/reasoning/cli.ts reveal abc123

# Show full proof details
npx ts-node src/reasoning/cli.ts show abc123

# Show proofs ready for reveal (>60min old)
npx ts-node src/reasoning/cli.ts pending
```

## Example Workflow

1. **New Signal Detected**
   ```typescript
   const signal = await aggregate(); // Score: 85, $TRUMP
   ```

2. **Create Commitment**
   ```typescript
   const { hash, proof } = createCommitment(signal);
   // hash = "e9d4f2a1..."
   // proof contains: reasoning, salt, hash
   ```

3. **Store Locally**
   ```typescript
   await storeProof(proof);
   // Saved to data/reasoning-proofs/abc123.json
   ```

4. **Publish On-Chain**
   ```typescript
   await publishSignalWithProof(signal);
   // Signal + hash now immutably on Solana
   ```

5. **Time Passes... Price Moves +300%**

6. **Reveal Reasoning**
   ```typescript
   const revealed = await revealProof('abc123', 450000);
   // Now everyone can see the AI's reasoning
   ```

7. **Anyone Verifies**
   ```typescript
   const isValid = verifyProof(revealed);
   // true - proves reasoning was committed before outcome!
   ```

## Security Considerations

### Why Salt is Important
Without the random salt, someone could potentially:
1. See the hash on-chain
2. Guess common reasoning phrases
3. Brute-force match the hash

The salt adds randomness that makes this computationally infeasible.

### Hash Collision Resistance
SHA-256 is used because:
- No known collisions
- 2^256 possible outputs
- Quantum-resistant for current technology

### Local Storage Security
The unrevealed reasoning is stored locally in `data/reasoning-proofs/`. This should be:
- Backed up securely
- Not exposed publicly until reveal time
- Protected from unauthorized access

## Future Improvements

1. **IPFS Storage** - Store revealed proofs on IPFS for permanence
2. **Zero-Knowledge Proofs** - Prove properties about reasoning without revealing all details
3. **Multi-Party Commitments** - Multiple oracles commit, then reveal together
4. **Automated Reveal** - Auto-reveal after configurable time/price thresholds

---

*The Reasoning Proofs system makes ORACLE Alpha the first verifiably honest AI oracle. Don't trust - verify!* 🔮
