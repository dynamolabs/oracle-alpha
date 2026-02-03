#!/usr/bin/env npx ts-node --transpile-only
// ORACLE Alpha CLI
// Usage: npx ts-node src/cli.ts [command]

import { aggregate } from './aggregator';
import { scanSmartWallets } from './sources/smart-wallet';
import { scanVolumeSpikes } from './sources/volume-spike';
import { scanKOLActivity } from './sources/kol-tracker';
import { scanNarratives } from './sources/narrative-detector';
import { scanNewLaunches } from './sources/new-launches';

// Colors
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  orange: '\x1b[38;5;208m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

const command = process.argv[2] || 'scan';

function printBanner() {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════════╗
║  ${colors.bold}🔮 ORACLE Alpha${colors.reset}${colors.cyan}                                          ║
║  ${colors.dim}On-chain Reliable Alpha Compilation & Learning Engine${colors.reset}${colors.cyan}   ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);
}

function createBar(score: number, width: number = 20): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = score >= 80 ? colors.green : score >= 60 ? colors.yellow : colors.orange;
  return `${color}${'█'.repeat(filled)}${colors.dim}${'░'.repeat(empty)}${colors.reset}`;
}

async function runFullScan() {
  printBanner();
  console.log(`${colors.cyan}⏳ Scanning 8 signal sources...${colors.reset}\n`);

  const startTime = Date.now();
  const signals = await aggregate();
  const duration = Date.now() - startTime;

  console.log(`
${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.bold}📊 SCAN COMPLETE${colors.reset} - ${signals.length} signals found in ${(duration / 1000).toFixed(1)}s
${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);

  for (const signal of signals.slice(0, 15)) {
    printSignal(signal);
  }

  if (signals.length > 15) {
    console.log(`${colors.dim}... and ${signals.length - 15} more signals${colors.reset}\n`);
  }
}

async function runWalletScan() {
  console.log('Scanning smart wallets...\n');
  const signals = await scanSmartWallets();
  console.log(`Found ${signals.length} wallet signals\n`);

  for (const signal of signals.slice(0, 10)) {
    console.log(
      `• ${signal.symbol || 'UNKNOWN'} - ${signal.metadata?.walletLabel || 'Unknown wallet'}`
    );
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
    LOW: colors.green,
    MEDIUM: colors.yellow,
    HIGH: colors.orange,
    EXTREME: colors.red
  };
  const riskEmoji: Record<string, string> = {
    LOW: '🟢',
    MEDIUM: '🟡',
    HIGH: '🟠',
    EXTREME: '🔴'
  };

  const bar = createBar(signal.score);
  const mcap = (signal.marketData?.mcap || 0) / 1000;
  const vol = (signal.marketData?.volume5m || 0) / 1000;

  console.log(`${colors.bold}🪙 $${signal.symbol}${colors.reset} - ${signal.name}`);
  console.log(`   ${bar} ${signal.score}/100`);
  console.log(
    `   ${riskEmoji[signal.riskLevel]} Risk: ${riskColors[signal.riskLevel]}${signal.riskLevel}${colors.reset} | MCap: ${colors.cyan}$${mcap.toFixed(1)}K${colors.reset} | Vol: ${colors.cyan}$${vol.toFixed(1)}K${colors.reset} | Age: ${signal.marketData?.age || 0}m`
  );
  console.log(
    `   ${colors.dim}Sources:${colors.reset} ${signal.sources.map((s: any) => s.source).join(', ')}`
  );
  if (signal.analysis?.narrative?.length) {
    console.log(
      `   ${colors.dim}Narratives:${colors.reset} ${signal.analysis.narrative.join(', ')}`
    );
  }
  console.log(`   ${colors.dim}CA:${colors.reset} ${signal.token.slice(0, 44)}...`);

  const recColor =
    signal.score >= 80 ? colors.green : signal.score >= 70 ? colors.yellow : colors.dim;
  console.log(
    `   ${recColor}→ ${signal.analysis?.recommendation || 'No recommendation'}${colors.reset}`
  );
  console.log('');
}

async function runStatusCheck() {
  console.log('Checking API status...\n');

  const apiUrl = process.env.API_URL || 'http://localhost:3900';

  try {
    // Health check
    const healthRes = await fetch(`${apiUrl}/health`);
    const health = await healthRes.json();
    console.log(
      `✅ API: ${health.status} (${health.signals} signals, uptime: ${Math.floor(health.uptime)}s)`
    );

    // Stats
    const statsRes = await fetch(`${apiUrl}/api/stats`);
    const stats = await statsRes.json();
    console.log(
      `📊 Total: ${stats.totalSignals} | Open: ${stats.openSignals} | Win Rate: ${stats.winRate}%`
    );

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
      console.log(
        `${entry.rank}. $${entry.symbol.padEnd(10)} ${roiColor}${roiStr.padStart(10)}\x1b[0m | ATH: +${entry.athRoi?.toFixed(1) || 0}% | Age: ${entry.age}m`
      );
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
  npx ts-node src/cli.ts demo
  `);
}

// Demo info command
async function showDemoInfo(): Promise<void> {
  printBanner();
  console.log(`${colors.bold}🎬 DEMO MODE${colors.reset}\n`);
  console.log('Start the server in demo mode for presentations:\n');
  console.log(`  ${colors.cyan}npm run demo${colors.reset}`);
  console.log('');
  console.log('Or with environment variables:\n');
  console.log(`  ${colors.cyan}DEMO_MODE=true npm start${colors.reset}`);
  console.log('');
  console.log('Demo mode features:');
  console.log(`  ${colors.green}✓${colors.reset} Auto-generates 4 signals per minute`);
  console.log(`  ${colors.green}✓${colors.reset} Seeds 30 historical signals on startup`);
  console.log(`  ${colors.green}✓${colors.reset} Realistic signal data for presentations`);
  console.log(`  ${colors.green}✓${colors.reset} Dashboard at http://localhost:3900`);
  console.log('');
  console.log('API endpoints:\n');
  console.log('  POST /api/demo/start   - Start signal generator');
  console.log('  POST /api/demo/stop    - Stop signal generator');
  console.log('  POST /api/demo/seed    - Seed historical data');
  console.log('  GET  /api/demo/status  - Check demo status');
  console.log('');
}

// Add new commands to switch
const additionalCommands: Record<string, () => Promise<void>> = {
  status: runStatusCheck,
  leaderboard: runLeaderboard,
  demo: showDemoInfo
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
