/**
 * Reasoning Proofs Module
 *
 * Provides cryptographic commitment-reveal scheme for AI reasoning:
 *
 * 1. COMMITMENT PHASE (before price movement):
 *    - AI generates reasoning analysis for signal
 *    - Hash the reasoning with random salt: hash = SHA256(reasoning + salt)
 *    - Store hash on-chain alongside signal
 *    - Keep reasoning+salt secret locally
 *
 * 2. REVEAL PHASE (after price movement):
 *    - Publish the full reasoning + salt
 *    - Anyone can verify: hash(reasoning + salt) == on-chain hash
 *    - This proves AI had this reasoning BEFORE the outcome
 *
 * WHY THIS MATTERS:
 * - Prevents "hindsight bias" - AI can't claim it predicted things after the fact
 * - Creates verifiable track record of AI reasoning quality
 * - Builds trust through cryptographic proof, not just claims
 * - Makes the oracle truly trustless and auditable
 *
 * USAGE:
 * ```typescript
 * import { createCommitment, storeProof, revealProof, verifyProof } from './reasoning';
 *
 * // When publishing signal
 * const { hash, proof } = createCommitment(signal);
 * await storeProof(proof);
 * // Store `hash` on-chain with the signal
 *
 * // After price movement
 * const revealed = await revealProof(signalId, currentPrice);
 * const isValid = verifyProof(revealed); // true
 * ```
 */

export {
  // Core functions
  createCommitment,
  storeProof,
  loadProof,
  listProofs,
  verifyProof,
  revealProof,

  // Utilities
  hashToBytes,
  bytesToHash,
  formatProofForDisplay,
  getProofsReadyForReveal,

  // Types
  ReasoningProof,
  CommitmentResult
} from './proofs';
