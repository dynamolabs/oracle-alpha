#!/usr/bin/env npx ts-node --transpile-only
// ORACLE Alpha CLI
// Usage: npx ts-node src/cli.ts [command]

import { aggregate } from './aggregator';
import { scanSmartWallets } from './sources/smart-wallet';
import { scanVolumeSpikes } from './sources/volume-spike';
import { scanKOLActivity } from './sources/kol-tracker';
import { scanNarratives } from './sources/narrative-detector';
import { scanNewLaunches } from './sources/new-launches';

const command = process.argv[2] || 'scan';

async function runFullScan() {
  console.log('Running full signal aggregation...\n');
  const signals = await aggregate();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 SCAN COMPLETE - ${signals.length} aggregated signals`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const signal of signals.slice(0, 15)) {
    printSignal(signal);
  }
}

async function runWalletScan() {
  console.log('Scanning smart wallets...\n');
  const signals = await scanSmartWallets();
  console.log(`Found ${signals.length} wallet signals\n`);
  
  for (const signal of signals.slice(0, 10)) {
    console.log(`• ${signal.symbol || 'UNKNOWN'} - ${signal.metadata?.walletLabel || 'Unknown wallet'}`);
    console.log(`  CA: ${signal.token.slice(0, 30)}...`);
    console.log(`  Confidence: ${signal.confidence}%\n`);
  }
}

async function runVolumeScan() {
  console.log('Scanning volume spikes...\n');
  const signals = await scanVolumeSpikes();
  console.log(`Found ${signals.length} volume signals\n`);
  
  for (const signal of signals.slice(0, 10)) {
    console.log(`• ${signal.symbol} - Score: ${signal.confidence}`);
    console.log(`  MCap: $${(signal.metadata.mcap / 1000).toFixed(1)}K`);
    console.log(`  Vol 5m: $${(signal.metadata.volume5m / 1000).toFixed(1)}K`);
    console.log(`  Buy Ratio: ${signal.metadata.buyRatio}%\n`);
  }
}

async function runKOLScan() {
  console.log('Scanning KOL activity...\n');
  const signals = await scanKOLActivity();
  console.log(`Found ${signals.length} KOL signals\n`);
  
  for (const signal of signals.slice(0, 10)) {
    console.log(`• ${signal.symbol} - Score: ${signal.confidence}`);
    if (signal.metadata?.kol) console.log(`  KOL: ${signal.metadata.kol}`);
    console.log(`  CA: ${signal.token.slice(0, 30)}...\n`);
  }
}

async function runNarrativeScan() {
  console.log('Scanning narratives...\n');
  const signals = await scanNarratives();
  console.log(`Found ${signals.length} narrative signals\n`);
  
  for (const signal of signals.slice(0, 10)) {
    console.log(`• ${signal.symbol} - ${signal.name}`);
    if (signal.metadata?.narratives) {
      console.log(`  Narratives: ${signal.metadata.narratives.join(', ')}`);
    }
    console.log(`  Score: ${signal.confidence}\n`);
  }
}

async function runNewLaunchScan() {
  console.log('Scanning new launches...\n');
  const signals = await scanNewLaunches();
  console.log(`Found ${signals.length} new launch signals\n`);
  
  for (const signal of signals.slice(0, 10)) {
    console.log(`• ${signal.symbol} - ${signal.name}`);
    if (signal.metadata?.narratives) {
      console.log(`  Narratives: ${signal.metadata.narratives.join(', ')}`);
    }
    console.log(`  MCap: $${((signal.metadata?.mcap || 0) / 1000).toFixed(1)}K`);
    console.log(`  Score: ${signal.confidence}\n`);
  }
}

function printSignal(signal: any) {
  const riskColors: Record<string, string> = {
    LOW: '\x1b[32m',     // Green
    MEDIUM: '\x1b[33m',  // Yellow
    HIGH: '\x1b[38;5;208m', // Orange
    EXTREME: '\x1b[31m', // Red
  };
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  
  console.log(`${bold}🪙 $${signal.symbol}${reset} - ${signal.name}`);
  console.log(`   Score: ${signal.score} | Risk: ${riskColors[signal.riskLevel]}${signal.riskLevel}${reset}`);
  console.log(`   MCap: $${(signal.marketData.mcap / 1000).toFixed(1)}K | Vol: $${(signal.marketData.volume5m / 1000).toFixed(1)}K | Age: ${signal.marketData.age}m`);
  console.log(`   Sources: ${signal.sources.map((s: any) => s.source).join(', ')}`);
  if (signal.analysis?.narrative?.length) {
    console.log(`   Narratives: ${signal.analysis.narrative.join(', ')}`);
  }
  console.log(`   CA: ${signal.token.slice(0, 40)}...`);
  console.log(`   ${signal.analysis?.recommendation || ''}`);
  console.log('');
}

async function runStatusCheck() {
  console.log('Checking API status...\n');
  
  const apiUrl = process.env.API_URL || 'http://localhost:3900';
  
  try {
    // Health check
    const healthRes = await fetch(`${apiUrl}/health`);
    const health = await healthRes.json();
    console.log(`✅ API: ${health.status} (${health.signals} signals, uptime: ${Math.floor(health.uptime)}s)`);
    
    // Stats
    const statsRes = await fetch(`${apiUrl}/api/stats`);
    const stats = await statsRes.json();
    console.log(`📊 Total: ${stats.totalSignals} | Open: ${stats.openSignals} | Win Rate: ${stats.winRate}%`);
    
    // On-chain
    const onchainRes = await fetch(`${apiUrl}/api/onchain/stats`);
    const onchain = await onchainRes.json();
    if (onchain.enabled) {
      console.log(`⛓️  On-chain: ${onchain.totalSignals} signals | Win Rate: ${onchain.winRate}`);
    } else {
      console.log('⛓️  On-chain: Not enabled');
    }
    
    // Top signals
    console.log('\n📈 Top Signals:');
    const signalsRes = await fetch(`${apiUrl}/api/signals?limit=5`);
    const signals = await signalsRes.json();
    for (const s of signals.signals) {
      console.log(`   • $${s.symbol} - Score: ${s.score} (${s.riskLevel})`);
    }
  } catch (error) {
    console.log('❌ API not reachable. Is the server running?');
  }
}

async function runLeaderboard() {
  console.log('Fetching leaderboard...\n');
  
  const apiUrl = process.env.API_URL || 'http://localhost:3900';
  
  try {
    const res = await fetch(`${apiUrl}/api/leaderboard`);
    const data = await res.json();
    
    console.log(`📊 Tracking ${data.totalTracked} signals\n`);
    console.log('🏆 TOP PERFORMERS:');
    console.log('─'.repeat(60));
    
    for (const entry of data.leaderboard) {
      const roiStr = entry.roi >= 0 ? `+${entry.roi.toFixed(1)}%` : `${entry.roi.toFixed(1)}%`;
      const roiColor = entry.roi >= 0 ? '\x1b[32m' : '\x1b[31m';
      console.log(`${entry.rank}. $${entry.symbol.padEnd(10)} ${roiColor}${roiStr.padStart(10)}\x1b[0m | ATH: +${entry.athRoi?.toFixed(1) || 0}% | Age: ${entry.age}m`);
    }
  } catch (error) {
    console.log('❌ API not reachable. Is the server running?');
  }
}

function showHelp() {
  console.log(`
Commands:
  scan        - Run full aggregation (default)
  wallets     - Scan smart wallets only
  volume      - Scan volume spikes only
  kol         - Scan KOL activity only
  narrative   - Scan narratives only
  new         - Scan new launches only
  status      - Check API & on-chain status
  leaderboard - Show top performing signals
  help        - Show this help

Examples:
  npx ts-node src/cli.ts scan
  npx ts-node src/cli.ts status
  npx ts-node src/cli.ts leaderboard
  `);
}

// Add new commands to switch
const additionalCommands: Record<string, () => Promise<void>> = {
  status: runStatusCheck,
  leaderboard: runLeaderboard,
};

// Extend main() with additional commands
async function main() {
  console.log('🔮 ORACLE Alpha CLI\n');

  if (additionalCommands[command]) {
    await additionalCommands[command]();
    return;
  }

  switch (command) {
    case 'scan':
      await runFullScan();
      break;
    case 'wallets':
      await runWalletScan();
      break;
    case 'volume':
      await runVolumeScan();
      break;
    case 'kol':
      await runKOLScan();
      break;
    case 'narrative':
      await runNarrativeScan();
      break;
    case 'new':
      await runNewLaunchScan();
      break;
    case 'help':
    default:
      showHelp();
  }
}

main().catch(console.error);
