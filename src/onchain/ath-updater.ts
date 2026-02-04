// ATH Updater - Updates on-chain signals with new ATH prices
// Runs periodically to track signal performance

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet, Idl } from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey(
  process.env.ORACLE_PROGRAM_ID || 'AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd'
);

let program: any = null;
let wallet: Keypair | null = null;
let oracleStatePda: PublicKey | null = null;

interface TokenPrice {
  price: number;
  priceChange24h: number;
}

// Fetch current price from DexScreener
async function fetchTokenPrice(tokenAddress: string): Promise<TokenPrice | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();

    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      return {
        price: parseFloat(pair.priceUsd) || 0,
        priceChange24h: pair.priceChange?.h24 || 0
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function initAthUpdater(): Promise<boolean> {
  try {
    const idlPath = path.join(__dirname, '../../target/idl/oracle.json');
    if (!fs.existsSync(idlPath)) return false;

    const idl: Idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

    const walletPath = path.join(process.env.HOME!, '.config/solana/id.json');
    if (!fs.existsSync(walletPath)) return false;

    wallet = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
    );

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const anchorWallet = new Wallet(wallet);
    const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' });
    anchor.setProvider(provider);

    program = new Program(idl, provider) as any;

    [oracleStatePda] = PublicKey.findProgramAddressSync([Buffer.from('oracle_state')], PROGRAM_ID);

    console.log('[ATH] Updater initialized');
    return true;
  } catch (error) {
    console.error('[ATH] Init failed:', error);
    return false;
  }
}

export async function updateAllSignalATHs(): Promise<number> {
  if (!program || !wallet || !oracleStatePda) return 0;

  let updatedCount = 0;

  try {
    // Fetch all signals
    const signals = await program.account.signal.all();

    for (const signalAccount of signals) {
      const signal = signalAccount.account;

      // Skip closed signals
      if (Object.keys(signal.status)[0] !== 'open') continue;

      // Fetch current price
      const tokenAddress = signal.token.toBase58();
      const priceData = await fetchTokenPrice(tokenAddress);

      if (!priceData) continue;

      // Convert price to same units as entry price
      const currentPrice = Math.floor(priceData.price * 1e6);

      // Check if new ATH
      if (currentPrice > signal.athPrice.toNumber()) {
        try {
          // Update ATH on-chain
          await program.methods
            .updateAth(new anchor.BN(currentPrice))
            .accounts({
              signal: signalAccount.publicKey,
              oracleState: oracleStatePda,
              authority: wallet.publicKey
            })
            .rpc();

          updatedCount++;
          console.log(
            `[ATH] Updated ${signal.symbol}: ${signal.athPrice.toNumber()} -> ${currentPrice}`
          );
        } catch (e: any) {
          // Ignore errors (might be closed or other issue)
        }
      }

      // Check if should close (price dropped significantly from ATH or entry)
      const entryPrice = signal.entryPrice.toNumber();
      const athPrice = signal.athPrice.toNumber();

      // Close if down 50% from ATH or 30% from entry
      const drawdownFromAth = athPrice > 0 ? (athPrice - currentPrice) / athPrice : 0;
      const drawdownFromEntry = entryPrice > 0 ? (entryPrice - currentPrice) / entryPrice : 0;

      if (drawdownFromAth > 0.5 || drawdownFromEntry > 0.3) {
        // Signal should be closed - calculate final ROI
        const roiBps =
          entryPrice > 0 ? Math.floor(((currentPrice - entryPrice) / entryPrice) * 10000) : 0;

        try {
          await program.methods
            .closeSignal(new anchor.BN(currentPrice))
            .accounts({
              signal: signalAccount.publicKey,
              oracleState: oracleStatePda,
              authority: wallet.publicKey
            })
            .rpc();

          console.log(`[ATH] Closed ${signal.symbol} with ROI: ${roiBps / 100}%`);
        } catch (e: any) {
          // Ignore errors
        }
      }
    }
  } catch (error) {
    console.error('[ATH] Update error:', error);
  }

  return updatedCount;
}

// Run ATH updates every 5 minutes
export function startAthUpdater(): void {
  console.log('[ATH] Starting periodic ATH updates (every 5 min)');

  setInterval(
    async () => {
      const updated = await updateAllSignalATHs();
      if (updated > 0) {
        console.log(`[ATH] Updated ${updated} signals`);
      }
    },
    5 * 60 * 1000
  );
}
