/**
 * Signal Share Card Generator
 * Creates shareable text/HTML cards for signals
 */

import { AggregatedSignal } from '../types';

// Generate ASCII art share card (for Twitter/Telegram)
export function generateTextCard(signal: AggregatedSignal): string {
  const riskEmoji = {
    LOW: '🟢',
    MEDIUM: '🟡',
    HIGH: '🟠',
    EXTREME: '🔴'
  }[signal.riskLevel];

  const scoreBar =
    '█'.repeat(Math.floor(signal.score / 10)) + '░'.repeat(10 - Math.floor(signal.score / 10));

  const sources = signal.sources
    .map(s => {
      if (s.source.includes('elite')) return '👑';
      if (s.source.includes('sniper')) return '🎯';
      if (s.source.includes('volume')) return '📈';
      if (s.source.includes('kol')) return '📢';
      if (s.source.includes('dexscreener')) return '📊';
      return '•';
    })
    .join('');

  const narratives = signal.analysis?.narrative?.join(' | ') || 'General';

  return `
🔮 ORACLE ALPHA SIGNAL
━━━━━━━━━━━━━━━━━━━━━

$${signal.symbol} - ${signal.name}

📊 Score: [${scoreBar}] ${signal.score}/100
${riskEmoji} Risk: ${signal.riskLevel}
💰 MCap: $${((signal.marketData?.mcap || 0) / 1000).toFixed(1)}K
📈 Vol 5m: $${((signal.marketData?.volume5m || 0) / 1000).toFixed(1)}K

🎯 Sources: ${sources}
📰 Narrative: ${narratives}

CA: ${signal.token}

🔗 dexscreener.com/solana/${signal.token.slice(0, 8)}...

#ORACLE #Solana #Alpha
`.trim();
}

// Generate HTML share card (for embedding)
export function generateHtmlCard(signal: AggregatedSignal): string {
  const riskColor = {
    LOW: '#22c55e',
    MEDIUM: '#eab308',
    HIGH: '#f97316',
    EXTREME: '#ef4444'
  }[signal.riskLevel];

  const scoreColor = signal.score >= 70 ? '#22c55e' : signal.score >= 50 ? '#eab308' : '#ef4444';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta property="og:title" content="🔮 ORACLE Signal: $${signal.symbol} - Score ${signal.score}">
  <meta property="og:description" content="${signal.analysis?.recommendation || 'Trading signal detected'}">
  <meta property="og:image" content="https://oracle-alpha.vercel.app/api/og?symbol=${signal.symbol}&score=${signal.score}">
  <meta name="twitter:card" content="summary_large_image">
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: 'SF Mono', monospace;
      background: linear-gradient(135deg, #0a0a1a, #1a1a3a);
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .card {
      background: rgba(0,0,0,0.5);
      border: 2px solid #333;
      border-radius: 20px;
      padding: 30px;
      max-width: 500px;
      width: 100%;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .logo {
      font-size: 1.5em;
      background: linear-gradient(90deg, #00d9ff, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .risk {
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: bold;
      background: ${riskColor};
      color: #000;
    }
    .symbol {
      font-size: 2.5em;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .name { color: #888; margin-bottom: 20px; }
    .score-section {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 20px;
    }
    .score-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${scoreColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8em;
      font-weight: bold;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .metric {
      background: rgba(255,255,255,0.05);
      padding: 15px;
      border-radius: 10px;
      text-align: center;
    }
    .metric-value { font-size: 1.3em; font-weight: bold; }
    .metric-label { color: #666; font-size: 0.8em; }
    .ca {
      font-size: 0.7em;
      color: #555;
      word-break: break-all;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #333;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #666;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="logo">🔮 ORACLE Alpha</span>
      <span class="risk">${signal.riskLevel}</span>
    </div>
    <div class="symbol">$${signal.symbol}</div>
    <div class="name">${signal.name}</div>
    <div class="score-section">
      <div class="score-circle">${signal.score}</div>
      <div>
        <div style="font-size: 0.9em; color: #888;">Confidence Score</div>
        <div style="font-size: 1.2em;">${signal.score >= 70 ? '🔥 High Quality' : signal.score >= 50 ? '⚡ Moderate' : '⚠️ Speculative'}</div>
      </div>
    </div>
    <div class="metrics">
      <div class="metric">
        <div class="metric-value">$${((signal.marketData?.mcap || 0) / 1000).toFixed(1)}K</div>
        <div class="metric-label">Market Cap</div>
      </div>
      <div class="metric">
        <div class="metric-value">$${((signal.marketData?.volume5m || 0) / 1000).toFixed(1)}K</div>
        <div class="metric-label">Volume (5m)</div>
      </div>
      <div class="metric">
        <div class="metric-value">${signal.marketData?.age || 0}m</div>
        <div class="metric-label">Age</div>
      </div>
      <div class="metric">
        <div class="metric-value">${signal.sources.length}</div>
        <div class="metric-label">Sources</div>
      </div>
    </div>
    <div class="ca">CA: ${signal.token}</div>
    <div class="footer">Verifiable on-chain signals • oracle-alpha.com</div>
  </div>
</body>
</html>
`.trim();
}

// Generate SVG card (for image generation)
export function generateSvgCard(signal: AggregatedSignal): string {
  const scoreColor = signal.score >= 70 ? '#22c55e' : signal.score >= 50 ? '#eab308' : '#ef4444';
  const riskColor = {
    LOW: '#22c55e',
    MEDIUM: '#eab308',
    HIGH: '#f97316',
    EXTREME: '#ef4444'
  }[signal.riskLevel];

  return `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a1a"/>
      <stop offset="100%" style="stop-color:#1a1a3a"/>
    </linearGradient>
    <linearGradient id="logo" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00d9ff"/>
      <stop offset="100%" style="stop-color:#a855f7"/>
    </linearGradient>
  </defs>
  
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Header -->
  <text x="60" y="70" font-family="monospace" font-size="32" fill="url(#logo)">🔮 ORACLE Alpha</text>
  
  <!-- Risk Badge -->
  <rect x="1000" y="40" width="140" height="45" rx="22" fill="${riskColor}"/>
  <text x="1070" y="72" font-family="monospace" font-size="20" fill="#000" text-anchor="middle" font-weight="bold">${signal.riskLevel}</text>
  
  <!-- Symbol -->
  <text x="60" y="180" font-family="monospace" font-size="72" fill="#fff" font-weight="bold">$${signal.symbol}</text>
  <text x="60" y="220" font-family="monospace" font-size="24" fill="#888">${signal.name}</text>
  
  <!-- Score Circle -->
  <circle cx="150" cy="350" r="80" fill="${scoreColor}"/>
  <text x="150" y="370" font-family="monospace" font-size="56" fill="#000" text-anchor="middle" font-weight="bold">${signal.score}</text>
  
  <!-- Score Label -->
  <text x="280" y="330" font-family="monospace" font-size="20" fill="#888">Confidence Score</text>
  <text x="280" y="370" font-family="monospace" font-size="28" fill="#fff">${signal.score >= 70 ? '🔥 High Quality Signal' : signal.score >= 50 ? '⚡ Moderate Signal' : '⚠️ Speculative'}</text>
  
  <!-- Metrics -->
  <rect x="60" y="450" width="250" height="100" rx="15" fill="rgba(255,255,255,0.05)"/>
  <text x="185" y="490" font-family="monospace" font-size="32" fill="#fff" text-anchor="middle" font-weight="bold">$${((signal.marketData?.mcap || 0) / 1000).toFixed(1)}K</text>
  <text x="185" y="530" font-family="monospace" font-size="16" fill="#666" text-anchor="middle">Market Cap</text>
  
  <rect x="330" y="450" width="250" height="100" rx="15" fill="rgba(255,255,255,0.05)"/>
  <text x="455" y="490" font-family="monospace" font-size="32" fill="#fff" text-anchor="middle" font-weight="bold">$${((signal.marketData?.volume5m || 0) / 1000).toFixed(1)}K</text>
  <text x="455" y="530" font-family="monospace" font-size="16" fill="#666" text-anchor="middle">Volume (5m)</text>
  
  <rect x="600" y="450" width="250" height="100" rx="15" fill="rgba(255,255,255,0.05)"/>
  <text x="725" y="490" font-family="monospace" font-size="32" fill="#fff" text-anchor="middle" font-weight="bold">${signal.marketData?.age || 0}m</text>
  <text x="725" y="530" font-family="monospace" font-size="16" fill="#666" text-anchor="middle">Age</text>
  
  <rect x="870" y="450" width="270" height="100" rx="15" fill="rgba(255,255,255,0.05)"/>
  <text x="1005" y="490" font-family="monospace" font-size="32" fill="#fff" text-anchor="middle" font-weight="bold">${signal.sources.length} Sources</text>
  <text x="1005" y="530" font-family="monospace" font-size="16" fill="#666" text-anchor="middle">Confluence</text>
  
  <!-- Footer -->
  <text x="60" y="600" font-family="monospace" font-size="14" fill="#555">CA: ${signal.token.slice(0, 30)}...</text>
  <text x="1140" y="600" font-family="monospace" font-size="14" fill="#666" text-anchor="end">Verifiable on Solana ⛓️</text>
</svg>
`.trim();
}

export { generateTextCard, generateHtmlCard, generateSvgCard };
