/**
 * Test the Reasoning Proofs System
 */

import { AggregatedSignal } from '../types';
import {
  createCommitment,
  storeProof,
  loadProof,
  verifyProof,
  revealProof,
  formatProofForDisplay
} from './proofs';

// Mock signal for testing
const mockSignal: AggregatedSignal = {
  id: 'test-signal-001',
  timestamp: Date.now(),
  token: 'So11111111111111111111111111111111111111112',
  symbol: 'TEST',
  name: 'Test Token',
  score: 85,
  confidence: 80,
  riskLevel: 'LOW',
  sources: [
    { source: 'smart-wallet-elite', weight: 1.5, rawScore: 90 },
    { source: 'volume-spike', weight: 1.0, rawScore: 75 }
  ],
  marketData: {
    mcap: 150000,
    liquidity: 25000,
    volume5m: 35000,
    volume1h: 120000,
    priceChange5m: 15,
    priceChange1h: 45,
    age: 12
  },
  analysis: {
    narrative: ['AI/Agents', 'Meme'],
    strengths: ['Elite wallet accumulating', 'Strong volume'],
    weaknesses: [],
    recommendation: 'STRONG BUY'
  }
};

async function runTests() {
  console.log('🧪 REASONING PROOFS TEST SUITE\n');
  console.log('='.repeat(50));

  // Test 1: Create commitment
  console.log('\n✅ Test 1: Create Commitment');
  const { hash, proof } = createCommitment(mockSignal);
  console.log(`   Hash: ${hash.slice(0, 32)}...`);
  console.log(`   Signal: $${proof.symbol}`);
  console.log(`   Conviction: ${proof.reasoning.conviction}`);
  console.log(`   Bullish factors: ${proof.reasoning.bullishFactors.length}`);

  // Test 2: Verify proof (before reveal)
  console.log('\n✅ Test 2: Verify Proof');
  const isValid = verifyProof(proof);
  console.log(`   Valid: ${isValid ? '✓' : '✗'}`);
  if (!isValid) {
    console.error('   ERROR: Proof should be valid!');
    process.exit(1);
  }

  // Test 3: Store proof
  console.log('\n✅ Test 3: Store Proof');
  await storeProof(proof);
  console.log(`   Stored: data/reasoning-proofs/${proof.signalId}.json`);

  // Test 4: Load proof
  console.log('\n✅ Test 4: Load Proof');
  const loaded = loadProof(proof.signalId);
  if (!loaded) {
    console.error('   ERROR: Could not load proof!');
    process.exit(1);
  }
  console.log(`   Loaded: ${loaded.signalId}`);
  console.log(`   Hash matches: ${loaded.reasoningHash === hash ? '✓' : '✗'}`);

  // Test 5: Verify loaded proof
  console.log('\n✅ Test 5: Verify Loaded Proof');
  const loadedValid = verifyProof(loaded);
  console.log(`   Valid: ${loadedValid ? '✓' : '✗'}`);

  // Test 6: Reveal proof
  console.log('\n✅ Test 6: Reveal Proof');
  const revealed = await revealProof(proof.signalId, 300000); // Price doubled
  if (!revealed) {
    console.error('   ERROR: Could not reveal proof!');
    process.exit(1);
  }
  console.log(`   Revealed: ${revealed.revealed ? '✓' : '✗'}`);
  console.log(`   Price at reveal: $${revealed.priceAtReveal}`);

  // Test 7: Format for display
  console.log('\n✅ Test 7: Format Proof');
  console.log('\n' + '-'.repeat(50));
  console.log(formatProofForDisplay(revealed));
  console.log('-'.repeat(50));

  // Test 8: Tamper detection
  console.log('\n✅ Test 8: Tamper Detection');
  const tampered = { ...revealed };
  tampered.reasoning = { ...tampered.reasoning, conviction: 'LOW' };
  const tamperedValid = verifyProof(tampered);
  console.log(`   Tampered proof valid: ${tamperedValid ? '✗ FAIL' : '✓ Correctly rejected'}`);

  if (tamperedValid) {
    console.error('   ERROR: Tampered proof should be invalid!');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 ALL TESTS PASSED!\n');

  console.log('System Flow Summary:');
  console.log('1. AI generates reasoning → Hash committed on-chain');
  console.log('2. Price moves...');
  console.log('3. Reveal reasoning → Anyone can verify hash matches');
  console.log('4. Proves AI reasoning was committed BEFORE outcome! 🔮\n');
}

runTests().catch(console.error);
