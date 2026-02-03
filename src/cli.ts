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

async function main() {
  console.log('🔮 ORACLE Alpha CLI\n');

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

function showHelp() {
  console.log(`
Commands:
  scan      - Run full aggregation (default)
  wallets   - Scan smart wallets only
  volume    - Scan volume spikes only
  kol       - Scan KOL activity only
  narrative - Scan narratives only
  new       - Scan new launches only
  help      - Show this help

Examples:
  npx ts-node src/cli.ts scan
  npx ts-node src/cli.ts wallets
  `);
}

main().catch(console.error);
