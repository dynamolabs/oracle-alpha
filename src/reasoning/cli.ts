#!/usr/bin/env npx ts-node

/**
 * Reasoning Proofs CLI
 *
 * Usage:
 *   npx ts-node src/reasoning/cli.ts list           - List all proofs
 *   npx ts-node src/reasoning/cli.ts verify <id>    - Verify a proof
 *   npx ts-node src/reasoning/cli.ts reveal <id>    - Reveal reasoning
 *   npx ts-node src/reasoning/cli.ts show <id>      - Show full proof
 *   npx ts-node src/reasoning/cli.ts pending        - Show proofs ready for reveal
 */

import {
  loadProof,
  listProofs,
  verifyProof,
  revealProof,
  formatProofForDisplay,
  getProofsReadyForReveal
} from './proofs';

async function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'list': {
      const proofs = listProofs();
      console.log(`\n📚 REASONING PROOFS (${proofs.length} total)\n`);
      console.log('ID\t\tSymbol\tRevealed\tVerified\tAge');
      console.log('─'.repeat(70));

      for (const proof of proofs) {
        const age = Math.floor((Date.now() - proof.timestamp) / 60000);
        console.log(
          `${proof.signalId.slice(0, 8)}...\t` +
            `$${proof.symbol}\t` +
            `${proof.revealed ? '✅' : '⏳'}\t\t` +
            `${verifyProof(proof) ? '✅' : '❌'}\t\t` +
            `${age}m`
        );
      }
      break;
    }

    case 'verify': {
      const signalId = args[0];
      if (!signalId) {
        console.error('Usage: verify <signalId>');
        process.exit(1);
      }

      const proof = loadProof(signalId);
      if (!proof) {
        console.error(`Proof not found: ${signalId}`);
        process.exit(1);
      }

      const isValid = verifyProof(proof);
      console.log('\n🔍 VERIFICATION RESULT\n');
      console.log(`Signal: ${proof.signalId}`);
      console.log(`Symbol: $${proof.symbol}`);
      console.log(`Hash: ${proof.reasoningHash}`);
      console.log(`Status: ${isValid ? '✅ VALID' : '❌ INVALID'}`);

      if (isValid) {
        console.log('\nThe reasoning was cryptographically committed BEFORE the outcome.');
        console.log('Anyone can verify: hash(reasoning + salt) == on-chain hash');
      }
      break;
    }

    case 'reveal': {
      const signalId = args[0];
      if (!signalId) {
        console.error('Usage: reveal <signalId>');
        process.exit(1);
      }

      const proof = await revealProof(signalId);
      if (!proof) {
        console.error(`Proof not found: ${signalId}`);
        process.exit(1);
      }

      console.log('\n✅ REASONING REVEALED\n');
      console.log(formatProofForDisplay(proof));
      break;
    }

    case 'show': {
      const signalId = args[0];
      if (!signalId) {
        console.error('Usage: show <signalId>');
        process.exit(1);
      }

      const proof = loadProof(signalId);
      if (!proof) {
        console.error(`Proof not found: ${signalId}`);
        process.exit(1);
      }

      if (!proof.revealed) {
        console.log('\n🔐 PROOF NOT YET REVEALED\n');
        console.log(`Signal: ${proof.signalId}`);
        console.log(`Symbol: $${proof.symbol}`);
        console.log(`Hash: ${proof.reasoningHash}`);
        console.log(`Committed: ${new Date(proof.timestamp).toISOString()}`);
        console.log('\nUse "reveal" command to reveal the reasoning.');
      } else {
        console.log(formatProofForDisplay(proof));
      }
      break;
    }

    case 'pending': {
      const minAge = parseInt(args[0]) || 60;
      const pending = getProofsReadyForReveal(minAge);

      console.log(`\n⏳ PROOFS READY FOR REVEAL (>${minAge}m old)\n`);

      if (pending.length === 0) {
        console.log('No proofs ready for reveal.');
        break;
      }

      for (const proof of pending) {
        const age = Math.floor((Date.now() - proof.timestamp) / 60000);
        console.log(`${proof.signalId}: $${proof.symbol} (${age}m old)`);
      }
      break;
    }

    default:
      console.log(`
🔮 ORACLE Alpha - Reasoning Proofs CLI

Usage:
  list              - List all proofs
  verify <id>       - Verify a proof hash
  reveal <id>       - Reveal reasoning (after price movement)
  show <id>         - Show full proof details
  pending [minutes] - Show proofs ready for reveal (default: 60m)

Examples:
  npx ts-node src/reasoning/cli.ts list
  npx ts-node src/reasoning/cli.ts verify abc123
  npx ts-node src/reasoning/cli.ts reveal abc123
      `);
  }
}

main().catch(console.error);
