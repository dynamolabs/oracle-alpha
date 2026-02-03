import 'dotenv/config';
import { aggregate } from './aggregator';
import { AggregatedSignal } from './types';

const SCAN_INTERVAL = 30000; // 30 seconds

async function formatSignal(signal: AggregatedSignal): Promise<string> {
  const riskEmoji = {
    LOW: '🟢',
    MEDIUM: '🟡',
    HIGH: '🟠',
    EXTREME: '🔴'
  }[signal.riskLevel];
  
  const sourceList = signal.sources.map(s => s.source.replace('smart-wallet-', '').toUpperCase()).join(', ');
  
  return `
🔮 ORACLE SIGNAL #${signal.id.slice(0, 8)}
━━━━━━━━━━━━━━━━━━━━━

💎 ${signal.symbol} (${signal.name})
📊 Score: ${signal.score}/100
${riskEmoji} Risk: ${signal.riskLevel}

📈 Market Data:
• MCap: $${(signal.marketData.mcap / 1000).toFixed(1)}K
• Vol 5m: $${(signal.marketData.volume5m / 1000).toFixed(1)}K
• Liq: $${(signal.marketData.liquidity / 1000).toFixed(1)}K
• Age: ${signal.marketData.age}min

🎯 Sources: ${sourceList}
📚 Narrative: ${signal.analysis.narrative.join(', ')}

✅ Strengths:
${signal.analysis.strengths.map(s => `  • ${s}`).join('\n')}

⚠️ Weaknesses:
${signal.analysis.weaknesses.map(w => `  • ${w}`).join('\n')}

📝 ${signal.analysis.recommendation}

🔗 CA: ${signal.token}
━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  🔮 ORACLE Alpha - Signal Aggregator          ║');
  console.log('║  On-chain Reliable Alpha Compilation Engine   ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log('║  Sources: Smart Wallets, Volume Spikes        ║');
  console.log('║  Scan Interval: 30s                           ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');
  
  // Initial scan
  await runScan();
  
  // Continuous scanning
  setInterval(runScan, SCAN_INTERVAL);
}

async function runScan() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Scanning...`);
    
    const signals = await aggregate();
    
    if (signals.length === 0) {
      console.log(`[${new Date().toLocaleTimeString()}] No signals found`);
      return;
    }
    
    // Display top signals
    for (const signal of signals.slice(0, 3)) {
      const formatted = await formatSignal(signal);
      console.log(formatted);
    }
    
  } catch (error) {
    console.error('Scan error:', error);
  }
}

main().catch(console.error);
