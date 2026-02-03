import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet, Idl } from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { AggregatedSignal } from '../types';

const PROGRAM_ID = new PublicKey('AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd');

let program: any = null;
let wallet: Keypair | null = null;
let oracleStatePda: PublicKey | null = null;

// Risk level mapping
const RISK_LEVELS: Record<string, number> = {
  'LOW': 0,
  'MEDIUM': 1,
  'HIGH': 2,
  'EXTREME': 3
};

// Source bitmap mapping
const SOURCE_BITS: Record<string, number> = {
  'smart-wallet': 1,
  'volume-spike': 2,
  'kol-tracker': 4,
  'kol-social': 4,
  'narrative-new': 8,
  'narrative-momentum': 8,
  'new-launch': 16,
  'whale-tracker': 32
};

export async function initPublisher(): Promise<boolean> {
  try {
    // Load IDL
    const idlPath = path.join(__dirname, '../../target/idl/oracle.json');
    if (!fs.existsSync(idlPath)) {
      console.log('[PUBLISHER] IDL not found, skipping on-chain publishing');
      return false;
    }
    const idl: Idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
    
    // Load wallet
    const walletPath = path.join(process.env.HOME!, '.config/solana/id.json');
    if (!fs.existsSync(walletPath)) {
      console.log('[PUBLISHER] Wallet not found, skipping on-chain publishing');
      return false;
    }
    wallet = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
    );
    
    // Setup connection
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Setup provider
    const anchorWallet = new Wallet(wallet);
    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: 'confirmed',
    });
    anchor.setProvider(provider);
    
    // Create program
    program = new Program(idl, provider) as any;
    
    // Derive Oracle State PDA
    [oracleStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('oracle_state')],
      PROGRAM_ID
    );
    
    // Check if initialized
    try {
      const state = await program.account.oracleState.fetch(oracleStatePda);
      console.log(`[PUBLISHER] Connected! Oracle has ${state.totalSignals} signals on-chain`);
      return true;
    } catch (e) {
      console.log('[PUBLISHER] Oracle not initialized on-chain');
      return false;
    }
  } catch (error) {
    console.error('[PUBLISHER] Init failed:', error);
    return false;
  }
}

export async function publishSignalOnChain(signal: AggregatedSignal): Promise<string | null> {
  if (!program || !wallet || !oracleStatePda) {
    return null;
  }
  
  try {
    // Get current state for signal ID
    const state: any = await program.account.oracleState.fetch(oracleStatePda);
    const signalId = state.totalSignals.toNumber();
    
    // Derive signal PDA
    const signalIdBuffer = Buffer.alloc(8);
    signalIdBuffer.writeBigUInt64LE(BigInt(signalId));
    const [signalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('signal'), signalIdBuffer],
      PROGRAM_ID
    );
    
    // Parse token address
    let tokenPubkey: PublicKey;
    try {
      tokenPubkey = new PublicKey(signal.token);
    } catch {
      console.log(`[PUBLISHER] Invalid token address: ${signal.token}`);
      return null;
    }
    
    // Calculate sources bitmap
    let sourcesBitmap = 0;
    for (const src of signal.sources) {
      sourcesBitmap |= SOURCE_BITS[src.source] || 0;
    }
    
    // Get risk level
    const riskLevel = RISK_LEVELS[signal.riskLevel] || 2;
    
    // Get market data
    const mcap = signal.marketData?.mcap || 0;
    const entryPrice = Math.floor((signal.marketData?.priceChange5m || 0) * 1e6); // Use price change as proxy
    
    // Truncate symbol to 10 chars
    const symbol = signal.symbol.slice(0, 10);
    
    // Publish
    const tx = await program.methods
      .publishSignal(
        tokenPubkey,
        symbol,
        signal.score,
        riskLevel,
        sourcesBitmap,
        new anchor.BN(mcap),
        new anchor.BN(entryPrice),
      )
      .accounts({
        signal: signalPda,
        oracleState: oracleStatePda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`[PUBLISHER] Signal #${signalId} published: ${symbol} (Score: ${signal.score}) - Tx: ${tx.slice(0, 20)}...`);
    return tx;
  } catch (error: any) {
    if (error.message?.includes('already in use')) {
      // Signal already exists, skip
      return null;
    }
    console.error(`[PUBLISHER] Failed to publish ${signal.symbol}:`, error.message);
    return null;
  }
}

export async function getOnChainStats(): Promise<{
  totalSignals: number;
  totalWins: number;
  totalLosses: number;
  winRate: string;
} | null> {
  if (!program || !oracleStatePda) {
    return null;
  }
  
  try {
    const state: any = await program.account.oracleState.fetch(oracleStatePda);
    const total = state.totalSignals.toNumber();
    const wins = state.totalWins.toNumber();
    const losses = state.totalLosses.toNumber();
    const closed = wins + losses;
    
    return {
      totalSignals: total,
      totalWins: wins,
      totalLosses: losses,
      winRate: closed > 0 ? ((wins / closed) * 100).toFixed(1) + '%' : 'N/A'
    };
  } catch (error) {
    return null;
  }
}

export async function fetchOnChainSignals(limit: number = 10): Promise<any[]> {
  if (!program) {
    return [];
  }
  
  try {
    const signals = await program.account.signal.all();
    return signals
      .sort((a: any, b: any) => b.account.timestamp.toNumber() - a.account.timestamp.toNumber())
      .slice(0, limit)
      .map((s: any) => ({
        id: s.account.id.toNumber(),
        token: s.account.token.toBase58(),
        symbol: s.account.symbol,
        score: s.account.score,
        riskLevel: s.account.riskLevel,
        mcap: s.account.mcapAtSignal.toNumber(),
        entryPrice: s.account.entryPrice.toNumber(),
        athPrice: s.account.athPrice.toNumber(),
        timestamp: s.account.timestamp.toNumber(),
        status: Object.keys(s.account.status)[0],
        roiBps: s.account.roiBps,
      }));
  } catch (error) {
    console.error('[PUBLISHER] Failed to fetch signals:', error);
    return [];
  }
}
