import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet, Idl } from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Load IDL
const idlPath = path.join(__dirname, '../target/idl/oracle.json');
const idl: Idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

const PROGRAM_ID = new PublicKey('AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd');

async function main() {
  // Setup connection
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load wallet
  const walletPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );
  
  console.log('Wallet:', walletKeypair.publicKey.toBase58());
  console.log('Program:', PROGRAM_ID.toBase58());
  
  // Setup Anchor provider
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);
  
  // Create program interface - new API in 0.30+
  const program = new Program(idl, provider) as any;
  
  // Derive PDAs
  const [oracleStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('oracle_state')],
    PROGRAM_ID
  );
  console.log('Oracle State PDA:', oracleStatePda.toBase58());
  
  // Check if already initialized
  let state: any;
  try {
    state = await program.account.oracleState.fetch(oracleStatePda);
    console.log('\n✅ Oracle already initialized!');
    console.log('  Total signals:', state.totalSignals.toString());
    console.log('  Total wins:', state.totalWins.toString());
    console.log('  Total losses:', state.totalLosses.toString());
  } catch (e) {
    // Not initialized yet, initialize it
    console.log('\n🔧 Initializing Oracle...');
    
    try {
      const tx = await program.methods
        .initialize()
        .accounts({
          oracleState: oracleStatePda,
          authority: walletKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log('✅ Oracle initialized! Tx:', tx);
      state = await program.account.oracleState.fetch(oracleStatePda);
    } catch (initError: any) {
      console.error('❌ Initialize failed:', initError.message);
      return;
    }
  }
  
  // Publish a test signal
  console.log('\n📊 Publishing test signal...');
  
  const testToken = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC for test
  
  // Signal PDA uses total_signals as u64 little-endian bytes
  const totalSignals = state.totalSignals.toNumber();
  const signalIdBuffer = Buffer.alloc(8);
  signalIdBuffer.writeBigUInt64LE(BigInt(totalSignals));
  
  const [signalPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('signal'),
      signalIdBuffer,
    ],
    PROGRAM_ID
  );
  
  console.log('Signal PDA:', signalPda.toBase58());
  
  try {
    const tx = await program.methods
      .publishSignal(
        testToken,           // token
        'TEST',              // symbol
        85,                  // score
        1,                   // risk_level (0=low, 1=med, 2=high)
        0b00000111,          // sources_bitmap (smart_wallet + volume + kol)
        new anchor.BN(1000000), // mcap
        new anchor.BN(100),     // entry_price (in smallest units)
      )
      .accounts({
        signal: signalPda,
        oracleState: oracleStatePda,
        authority: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('✅ Signal published! Tx:', tx);
    
    // Fetch and display the signal
    const signal: any = await program.account.signal.fetch(signalPda);
    console.log('\n📡 Signal data:');
    console.log('  ID:', signal.id.toString());
    console.log('  Token:', signal.token.toBase58());
    console.log('  Symbol:', signal.symbol);
    console.log('  Score:', signal.score);
    console.log('  Risk Level:', signal.riskLevel);
    console.log('  MCap:', signal.mcapAtSignal.toString());
    console.log('  Entry Price:', signal.entryPrice.toString());
    console.log('  Timestamp:', new Date(signal.timestamp.toNumber() * 1000).toISOString());
    
  } catch (pubError: any) {
    if (pubError.message?.includes('already in use')) {
      console.log('ℹ️  Signal already exists for this token, fetching...');
      const signal: any = await program.account.signal.fetch(signalPda);
      console.log('  ID:', signal.id.toString());
      console.log('  Symbol:', signal.symbol);
      console.log('  Score:', signal.score);
    } else {
      console.error('❌ Publish failed:', pubError.message || pubError);
      console.error(pubError.logs || '');
    }
  }
  
  // Final state
  const finalState: any = await program.account.oracleState.fetch(oracleStatePda);
  console.log('\n📈 Final Oracle State:');
  console.log('  Total signals:', finalState.totalSignals.toString());
  
  // Publish a second signal (real token: BONK)
  console.log('\n📊 Publishing second signal (BONK)...');
  
  const bonkToken = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'); // BONK
  const totalSignals2 = finalState.totalSignals.toNumber();
  const signalIdBuffer2 = Buffer.alloc(8);
  signalIdBuffer2.writeBigUInt64LE(BigInt(totalSignals2));
  
  const [signalPda2] = PublicKey.findProgramAddressSync(
    [Buffer.from('signal'), signalIdBuffer2],
    PROGRAM_ID
  );
  
  try {
    const tx2 = await program.methods
      .publishSignal(
        bonkToken,
        'BONK',
        72,                    // score
        2,                     // risk_level (HIGH)
        0b00001001,            // sources_bitmap (smart_wallet + narrative)
        new anchor.BN(500000000), // mcap $500M
        new anchor.BN(2500),      // entry price
      )
      .accounts({
        signal: signalPda2,
        oracleState: oracleStatePda,
        authority: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('✅ BONK signal published! Tx:', tx2);
    
    const signal2: any = await program.account.signal.fetch(signalPda2);
    console.log('  ID:', signal2.id.toString());
    console.log('  Symbol:', signal2.symbol);
    console.log('  Score:', signal2.score);
  } catch (e: any) {
    console.log('Second signal error:', e.message);
  }
  
  // Final count
  const finalState2: any = await program.account.oracleState.fetch(oracleStatePda);
  console.log('\n📈 FINAL Oracle State:');
  console.log('  Total signals:', finalState2.totalSignals.toString());
  console.log('  Wins:', finalState2.totalWins.toString());
  console.log('  Losses:', finalState2.totalLosses.toString());
}

main().catch(console.error);
