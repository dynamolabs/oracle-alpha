/**
 * ORACLE Alpha - Autonomous Trading System
 * Live trading with learning and risk management
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
const bs58 = require('bs58');
import fs from 'fs';
import path from 'path';

// Types
interface TradeConfig {
  maxPositionSol: number;
  maxPortfolioPercent: number;
  minSignalScore: number;
  stopLossPercent: number;
  takeProfitLevels: number[];
  minConfluence: number;
  allowedRiskLevels: string[];
}

interface TradeRecord {
  id: string;
  timestamp: number;
  token: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  solSpent?: number;
  solReceived?: number;
  signalId: string;
  signalScore: number;
  reason: string;
  txSignature?: string;
  status: 'pending' | 'executed' | 'failed' | 'closed';
  pnl?: number;
  pnlPercent?: number;
  exitReason?: string;
}

interface Position {
  token: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  solInvested: number;
  entryTime: number;
  signalId: string;
  stopLoss: number;
  takeProfits: number[];
  tpHit: number[];
}

interface TradingState {
  isRunning: boolean;
  startedAt: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnlSol: number;
  positions: Position[];
  tradeHistory: TradeRecord[];
  learningData: LearningData;
}

interface LearningData {
  sourcePerformance: Record<string, { wins: number; losses: number; avgPnl: number }>;
  scoreThresholdPerformance: Record<string, { wins: number; losses: number }>;
  timeOfDayPerformance: Record<string, { wins: number; losses: number }>;
  adjustedWeights: Record<string, number>;
}

// Default config
const DEFAULT_CONFIG: TradeConfig = {
  maxPositionSol: 0.2,
  maxPortfolioPercent: 10,
  minSignalScore: 75,
  stopLossPercent: 20,
  takeProfitLevels: [50, 100, 200],
  minConfluence: 2,
  allowedRiskLevels: ['LOW', 'MEDIUM']
};

// State
let tradingState: TradingState = {
  isRunning: false,
  startedAt: 0,
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  totalPnlSol: 0,
  positions: [],
  tradeHistory: [],
  learningData: {
    sourcePerformance: {},
    scoreThresholdPerformance: {},
    timeOfDayPerformance: {},
    adjustedWeights: {}
  }
};

let config: TradeConfig = { ...DEFAULT_CONFIG };
let connection: Connection;
let wallet: Keypair;
let walletPublicKey: string;

const DATA_DIR = path.join(__dirname, '../../data/trading');
const STATE_FILE = path.join(DATA_DIR, 'trading-state.json');
const TRADES_FILE = path.join(DATA_DIR, 'trade-history.json');

// Initialize
export function initAutoTrader(): boolean {
  try {
    // Load env
    const envPath = path.join(__dirname, '../../.env.trading');
    if (!fs.existsSync(envPath)) {
      console.error('[AUTO-TRADER] .env.trading not found');
      return false;
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#')) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });

    // Setup connection
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
    connection = new Connection(rpcUrl, 'confirmed');

    // Setup wallet
    const privateKey = env.TRADING_WALLET_PRIVATE_KEY;
    const secretKey = bs58.decode(privateKey);
    wallet = Keypair.fromSecretKey(secretKey);
    walletPublicKey = wallet.publicKey.toBase58();

    // Load config
    if (env.MAX_POSITION_SOL) config.maxPositionSol = parseFloat(env.MAX_POSITION_SOL);
    if (env.MAX_PORTFOLIO_PERCENT) config.maxPortfolioPercent = parseFloat(env.MAX_PORTFOLIO_PERCENT);
    if (env.MIN_SIGNAL_SCORE) config.minSignalScore = parseInt(env.MIN_SIGNAL_SCORE);
    if (env.STOP_LOSS_PERCENT) config.stopLossPercent = parseFloat(env.STOP_LOSS_PERCENT);
    if (env.MIN_CONFLUENCE) config.minConfluence = parseInt(env.MIN_CONFLUENCE);
    if (env.ALLOWED_RISK_LEVELS) config.allowedRiskLevels = env.ALLOWED_RISK_LEVELS.split(',');

    // Create data dir
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Load state
    loadState();

    console.log('[AUTO-TRADER] Initialized');
    console.log(`[AUTO-TRADER] Wallet: ${walletPublicKey}`);
    console.log(`[AUTO-TRADER] Config: ${JSON.stringify(config)}`);

    return true;
  } catch (error) {
    console.error('[AUTO-TRADER] Init error:', error);
    return false;
  }
}

// Load/Save state
function loadState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      tradingState = JSON.parse(data);
    }
  } catch (error) {
    console.error('[AUTO-TRADER] Load state error:', error);
  }
}

function saveState(): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(tradingState, null, 2));
  } catch (error) {
    console.error('[AUTO-TRADER] Save state error:', error);
  }
}

// Get wallet balance
export async function getWalletBalance(): Promise<number> {
  try {
    const balance = await connection.getBalance(wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('[AUTO-TRADER] Balance error:', error);
    return 0;
  }
}

// Check if signal is tradeable
export function isSignalTradeable(signal: any): { tradeable: boolean; reason: string } {
  // Score check
  if (signal.score < config.minSignalScore) {
    return { tradeable: false, reason: `Score ${signal.score} < min ${config.minSignalScore}` };
  }

  // Risk level check
  if (!config.allowedRiskLevels.includes(signal.riskLevel)) {
    return { tradeable: false, reason: `Risk ${signal.riskLevel} not in allowed list` };
  }

  // Confluence check
  const sourceCount = signal.sources?.length || 1;
  if (sourceCount < config.minConfluence) {
    return { tradeable: false, reason: `Confluence ${sourceCount} < min ${config.minConfluence}` };
  }

  // Safety checks
  if (signal.safetyData?.honeypotRisk?.isHoneypot) {
    return { tradeable: false, reason: 'Honeypot detected' };
  }

  if (signal.safetyData?.bundleScore > 70) {
    return { tradeable: false, reason: `Bundle score ${signal.safetyData.bundleScore} too high` };
  }

  if (signal.safetyData?.washScore > 80) {
    return { tradeable: false, reason: `Wash score ${signal.safetyData.washScore} too high` };
  }

  return { tradeable: true, reason: 'Signal meets all criteria' };
}

// Calculate position size
export async function calculatePositionSize(signal: any): Promise<number> {
  const balance = await getWalletBalance();
  
  // Reserve for fees
  const availableBalance = balance - 0.01;
  if (availableBalance <= 0) return 0;

  // Max based on portfolio percent
  const maxByPercent = availableBalance * (config.maxPortfolioPercent / 100);
  
  // Max absolute
  const maxAbsolute = config.maxPositionSol;

  // Adjust by score (higher score = larger position)
  const scoreMultiplier = signal.score >= 85 ? 1.0 : signal.score >= 75 ? 0.7 : 0.5;

  // Adjust by risk (lower risk = larger position)
  const riskMultiplier = signal.riskLevel === 'LOW' ? 1.0 : signal.riskLevel === 'MEDIUM' ? 0.7 : 0.5;

  let positionSize = Math.min(maxByPercent, maxAbsolute) * scoreMultiplier * riskMultiplier;

  // Round to 2 decimals
  positionSize = Math.round(positionSize * 100) / 100;

  // Minimum viable trade
  if (positionSize < 0.01) return 0;

  return positionSize;
}

// Execute buy
export async function executeBuy(signal: any, positionSol: number): Promise<TradeRecord | null> {
  const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const record: TradeRecord = {
    id: tradeId,
    timestamp: Date.now(),
    token: signal.token,
    symbol: signal.symbol || 'UNKNOWN',
    action: 'BUY',
    amount: 0,
    price: signal.price || 0,
    solSpent: positionSol,
    signalId: signal.id,
    signalScore: signal.score,
    reason: `Signal score ${signal.score}, ${signal.sources?.length || 1} sources`,
    status: 'pending'
  };

  try {
    console.log(`[AUTO-TRADER] Executing BUY: ${positionSol} SOL -> ${signal.symbol}`);

    // Get Jupiter quote
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${signal.token}&amount=${Math.floor(positionSol * LAMPORTS_PER_SOL)}&slippageBps=100`;
    
    const quoteRes = await fetch(quoteUrl);
    const quote = await quoteRes.json();

    if (!quote || quote.error) {
      record.status = 'failed';
      record.reason = `Quote failed: ${quote?.error || 'No quote'}`;
      tradingState.tradeHistory.push(record);
      saveState();
      return record;
    }

    // Get swap transaction
    const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: walletPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      })
    });

    const swapData = await swapRes.json();

    if (!swapData.swapTransaction) {
      record.status = 'failed';
      record.reason = 'Failed to build swap tx';
      tradingState.tradeHistory.push(record);
      saveState();
      return record;
    }

    // Sign and send
    const txBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const tx = require('@solana/web3.js').VersionedTransaction.deserialize(txBuf);
    tx.sign([wallet]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });

    // Confirm
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      record.status = 'failed';
      record.reason = `Tx failed: ${JSON.stringify(confirmation.value.err)}`;
    } else {
      record.status = 'executed';
      record.txSignature = signature;
      record.amount = parseInt(quote.outAmount) / Math.pow(10, quote.outputMint?.decimals || 9);
      
      // Create position
      const position: Position = {
        token: signal.token,
        symbol: signal.symbol || 'UNKNOWN',
        entryPrice: signal.price || (positionSol / record.amount),
        currentPrice: signal.price || 0,
        amount: record.amount,
        solInvested: positionSol,
        entryTime: Date.now(),
        signalId: signal.id,
        stopLoss: (signal.price || 0) * (1 - config.stopLossPercent / 100),
        takeProfits: config.takeProfitLevels.map(tp => (signal.price || 0) * (1 + tp / 100)),
        tpHit: []
      };

      tradingState.positions.push(position);
      tradingState.totalTrades++;

      console.log(`[AUTO-TRADER] ✅ BUY executed: ${signature}`);
    }

    tradingState.tradeHistory.push(record);
    saveState();
    return record;

  } catch (error: any) {
    record.status = 'failed';
    record.reason = `Error: ${error.message}`;
    tradingState.tradeHistory.push(record);
    saveState();
    console.error('[AUTO-TRADER] Buy error:', error);
    return record;
  }
}

// Check positions for exit conditions
export async function checkPositions(): Promise<void> {
  for (const position of tradingState.positions) {
    try {
      // Get current price from DexScreener
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${position.token}`);
      const data = await res.json();
      
      if (!data.pairs || data.pairs.length === 0) continue;

      const currentPrice = parseFloat(data.pairs[0].priceUsd) || 0;
      position.currentPrice = currentPrice;

      const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

      // Check stop loss
      if (pnlPercent <= -config.stopLossPercent) {
        console.log(`[AUTO-TRADER] 🛑 Stop loss hit for ${position.symbol}: ${pnlPercent.toFixed(2)}%`);
        await executeSell(position, 100, 'STOP_LOSS');
        continue;
      }

      // Check take profits
      for (let i = 0; i < config.takeProfitLevels.length; i++) {
        const tp = config.takeProfitLevels[i];
        if (pnlPercent >= tp && !position.tpHit.includes(tp)) {
          console.log(`[AUTO-TRADER] 🎯 TP${i+1} hit for ${position.symbol}: ${pnlPercent.toFixed(2)}%`);
          position.tpHit.push(tp);
          
          // Sell portion (33% at each TP)
          const sellPercent = i === config.takeProfitLevels.length - 1 ? 100 : 33;
          await executeSell(position, sellPercent, `TP_${tp}`);
        }
      }

    } catch (error) {
      console.error(`[AUTO-TRADER] Position check error for ${position.symbol}:`, error);
    }
  }

  saveState();
}

// Execute sell
export async function executeSell(position: Position, percentToSell: number, reason: string): Promise<TradeRecord | null> {
  const amountToSell = position.amount * (percentToSell / 100);
  
  const record: TradeRecord = {
    id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    token: position.token,
    symbol: position.symbol,
    action: 'SELL',
    amount: amountToSell,
    price: position.currentPrice,
    signalId: position.signalId,
    signalScore: 0,
    reason,
    status: 'pending'
  };

  try {
    console.log(`[AUTO-TRADER] Executing SELL: ${amountToSell} ${position.symbol} (${reason})`);

    // Get token decimals
    const tokenInfo = await connection.getParsedAccountInfo(new PublicKey(position.token));
    const decimals = (tokenInfo.value?.data as any)?.parsed?.info?.decimals || 9;

    // Get Jupiter quote
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${position.token}&outputMint=So11111111111111111111111111111111111111112&amount=${Math.floor(amountToSell * Math.pow(10, decimals))}&slippageBps=100`;
    
    const quoteRes = await fetch(quoteUrl);
    const quote = await quoteRes.json();

    if (!quote || quote.error) {
      record.status = 'failed';
      record.reason = `Quote failed: ${quote?.error || 'No quote'}`;
      tradingState.tradeHistory.push(record);
      saveState();
      return record;
    }

    // Get swap transaction
    const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: walletPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      })
    });

    const swapData = await swapRes.json();

    if (!swapData.swapTransaction) {
      record.status = 'failed';
      record.reason = 'Failed to build swap tx';
      tradingState.tradeHistory.push(record);
      saveState();
      return record;
    }

    // Sign and send
    const txBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const tx = require('@solana/web3.js').VersionedTransaction.deserialize(txBuf);
    tx.sign([wallet]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });

    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      record.status = 'failed';
      record.reason = `Tx failed: ${JSON.stringify(confirmation.value.err)}`;
    } else {
      record.status = 'executed';
      record.txSignature = signature;
      record.solReceived = parseInt(quote.outAmount) / LAMPORTS_PER_SOL;

      // Calculate PnL
      const solInvested = position.solInvested * (percentToSell / 100);
      record.pnl = record.solReceived - solInvested;
      record.pnlPercent = (record.pnl / solInvested) * 100;

      // Update stats
      tradingState.totalPnlSol += record.pnl;
      if (record.pnl > 0) {
        tradingState.winningTrades++;
      } else {
        tradingState.losingTrades++;
      }

      // Update position
      position.amount -= amountToSell;
      position.solInvested -= solInvested;

      // Remove position if fully sold
      if (position.amount <= 0 || percentToSell === 100) {
        tradingState.positions = tradingState.positions.filter(p => p.token !== position.token);
      }

      // Update learning data
      updateLearningData(position, record);

      console.log(`[AUTO-TRADER] ✅ SELL executed: ${signature} | PnL: ${record.pnl.toFixed(4)} SOL (${record.pnlPercent.toFixed(2)}%)`);
    }

    tradingState.tradeHistory.push(record);
    saveState();
    return record;

  } catch (error: any) {
    record.status = 'failed';
    record.reason = `Error: ${error.message}`;
    tradingState.tradeHistory.push(record);
    saveState();
    console.error('[AUTO-TRADER] Sell error:', error);
    return record;
  }
}

// Update learning data
function updateLearningData(position: Position, trade: TradeRecord): void {
  const isWin = (trade.pnl || 0) > 0;
  
  // Source performance would need signal source info
  // Score threshold performance
  const scoreRange = trade.signalScore >= 85 ? '85+' : trade.signalScore >= 75 ? '75-84' : '60-74';
  if (!tradingState.learningData.scoreThresholdPerformance[scoreRange]) {
    tradingState.learningData.scoreThresholdPerformance[scoreRange] = { wins: 0, losses: 0 };
  }
  if (isWin) {
    tradingState.learningData.scoreThresholdPerformance[scoreRange].wins++;
  } else {
    tradingState.learningData.scoreThresholdPerformance[scoreRange].losses++;
  }

  // Time of day performance
  const hour = new Date(position.entryTime).getHours();
  const timeRange = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  if (!tradingState.learningData.timeOfDayPerformance[timeRange]) {
    tradingState.learningData.timeOfDayPerformance[timeRange] = { wins: 0, losses: 0 };
  }
  if (isWin) {
    tradingState.learningData.timeOfDayPerformance[timeRange].wins++;
  } else {
    tradingState.learningData.timeOfDayPerformance[timeRange].losses++;
  }
}

// Start auto trading
export function startAutoTrading(): void {
  if (tradingState.isRunning) {
    console.log('[AUTO-TRADER] Already running');
    return;
  }

  tradingState.isRunning = true;
  tradingState.startedAt = Date.now();
  saveState();

  console.log('[AUTO-TRADER] 🚀 Auto trading started');
}

// Stop auto trading
export function stopAutoTrading(): void {
  tradingState.isRunning = false;
  saveState();
  console.log('[AUTO-TRADER] ⏹️ Auto trading stopped');
}

// Get status
export function getTradingStatus(): TradingState & { balance?: number; walletAddress?: string; config?: TradeConfig } {
  return {
    ...tradingState,
    walletAddress: walletPublicKey,
    config
  };
}

// Get trade history
export function getTradeHistory(): TradeRecord[] {
  return tradingState.tradeHistory;
}

// Get learning insights
export function getLearningInsights(): any {
  const { learningData } = tradingState;
  
  const insights: any = {
    scoreThreshold: Object.entries(learningData.scoreThresholdPerformance).map(([range, data]) => ({
      range,
      winRate: data.wins + data.losses > 0 ? (data.wins / (data.wins + data.losses) * 100).toFixed(1) : 'N/A',
      ...data
    })),
    timeOfDay: Object.entries(learningData.timeOfDayPerformance).map(([time, data]) => ({
      time,
      winRate: data.wins + data.losses > 0 ? (data.wins / (data.wins + data.losses) * 100).toFixed(1) : 'N/A',
      ...data
    })),
    recommendations: []
  };

  // Generate recommendations based on data
  for (const [range, data] of Object.entries(learningData.scoreThresholdPerformance)) {
    const total = data.wins + data.losses;
    if (total >= 5) {
      const winRate = data.wins / total;
      if (winRate < 0.5 && range !== '85+') {
        insights.recommendations.push(`Consider increasing min score - ${range} has ${(winRate*100).toFixed(0)}% win rate`);
      }
    }
  }

  return insights;
}

export default {
  initAutoTrader,
  startAutoTrading,
  stopAutoTrading,
  getWalletBalance,
  isSignalTradeable,
  calculatePositionSize,
  executeBuy,
  executeSell,
  checkPositions,
  getTradingStatus,
  getTradeHistory,
  getLearningInsights
};
