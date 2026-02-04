/**
 * ORACLE Alpha - OpenAPI/Swagger Documentation
 * Professional API documentation with Swagger UI
 */

import express, { Router, Request, Response } from 'express';
import path from 'path';

// ==========================================
// OpenAPI 3.0 Specification
// ==========================================

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ORACLE Alpha API',
    version: '1.0.0',
    description: `
# 🔮 ORACLE Alpha - On-chain Reliable Alpha Compilation & Learning Engine

**The most comprehensive Solana signal aggregation and analysis API.**

## Overview
ORACLE Alpha aggregates signals from 8+ sources including smart wallets, KOL trackers, volume spikes, and narrative detection. It provides real-time scoring, risk assessment, and verifiable on-chain publishing.

## Features
- **Multi-Source Aggregation**: 8+ signal sources with weighted scoring
- **AI Analysis**: Detailed explanations and reasoning proofs
- **Detection Suite**: Honeypot, wash trading, bundle, sniper detection
- **Trading Integration**: Jupiter DEX quotes and paper trading
- **Gamification**: Achievements, leaderboards, and challenges
- **On-Chain Verification**: Verifiable signals on Solana

## Authentication
Most endpoints are public. Premium features require subscription verification via wallet address.

## Rate Limits
- General endpoints: 100 requests/minute
- Expensive endpoints (scan, publish): 10 requests/minute

## WebSocket
Real-time signals available at \`ws://host:port/ws\`
    `,
    contact: {
      name: 'ShifuSensei',
      url: 'https://github.com/dynamolabs/oracle-alpha'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3900',
      description: 'Local Development'
    },
    {
      url: 'https://oracle-alpha.onrender.com',
      description: 'Production'
    }
  ],
  tags: [
    { name: 'Signals', description: 'Signal discovery and retrieval' },
    { name: 'Detection', description: 'Scam detection (honeypot, wash trading, bundles, snipers)' },
    { name: 'Analytics', description: 'Performance analytics, leaderboards, and correlations' },
    { name: 'Trading', description: 'Paper trading and Jupiter DEX integration' },
    { name: 'Wallet', description: 'Real wallet connection and trading' },
    { name: 'Social', description: 'KOL tracking and reliability scores' },
    { name: 'Gamification', description: 'Achievements, challenges, and levels' },
    { name: 'On-Chain', description: 'Solana on-chain publishing and verification' },
    { name: 'Subscription', description: 'Subscription tiers and access control' },
    { name: 'System', description: 'Health, metrics, and system status' },
    { name: 'Export', description: 'Data export and reporting' },
    { name: 'Alerts', description: 'Custom alert rules and notifications' },
    { name: 'Demo', description: 'Demo mode controls and data seeding' }
  ],
  paths: {
    // ========================================
    // SYSTEM ENDPOINTS
    // ========================================
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Returns server health status and basic metrics',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: { status: 'ok', signals: 150, uptime: 3600.5 }
              }
            }
          }
        }
      }
    },
    '/api/info': {
      get: {
        tags: ['System'],
        summary: 'Project information',
        description: 'Get detailed information about the ORACLE Alpha project',
        operationId: 'getInfo',
        responses: {
          '200': {
            description: 'Project info',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ProjectInfo' } } }
          }
        }
      }
    },
    '/api/status': {
      get: {
        tags: ['System'],
        summary: 'Full system status',
        description: 'Get comprehensive system status including all subsystems',
        operationId: 'getStatus',
        responses: {
          '200': {
            description: 'System status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SystemStatus' } } }
          }
        }
      }
    },
    '/metrics': {
      get: {
        tags: ['System'],
        summary: 'Prometheus metrics',
        description: 'Prometheus-formatted metrics for monitoring',
        operationId: 'getPrometheusMetrics',
        responses: {
          '200': {
            description: 'Metrics in Prometheus format',
            content: { 'text/plain': { schema: { type: 'string' } } }
          }
        }
      }
    },
    '/api/metrics': {
      get: {
        tags: ['System'],
        summary: 'JSON metrics',
        description: 'Metrics in JSON format',
        operationId: 'getJsonMetrics',
        responses: {
          '200': {
            description: 'JSON metrics',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/JsonMetrics' } } }
          }
        }
      }
    },
    '/api/stats/platform': {
      get: {
        tags: ['System'],
        summary: 'Platform statistics',
        description: 'Get combined platform usage and signal statistics',
        operationId: 'getPlatformStats',
        responses: {
          '200': {
            description: 'Platform stats for dashboard',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformStats' } } }
          }
        }
      }
    },

    // ========================================
    // SIGNALS ENDPOINTS
    // ========================================
    '/api/signals': {
      get: {
        tags: ['Signals'],
        summary: 'List signals',
        description: 'Get filtered list of trading signals with optional filters',
        operationId: 'listSignals',
        parameters: [
          { name: 'minScore', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 100 }, description: 'Minimum signal score' },
          { name: 'maxAge', in: 'query', schema: { type: 'integer' }, description: 'Maximum age in minutes' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Number of results' },
          { name: 'minSources', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Minimum unique sources' },
          { name: 'convictionLevel', in: 'query', schema: { type: 'string', enum: ['STANDARD', 'HIGH_CONVICTION', 'ULTRA'] }, description: 'Filter by conviction level' },
          { name: 'includePerformance', in: 'query', schema: { type: 'boolean' }, description: 'Include performance data' }
        ],
        responses: {
          '200': {
            description: 'List of signals',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SignalListResponse' } } }
          }
        }
      }
    },
    '/api/signals/{id}': {
      get: {
        tags: ['Signals'],
        summary: 'Get signal by ID',
        description: 'Get detailed information about a specific signal',
        operationId: 'getSignal',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Signal ID' }
        ],
        responses: {
          '200': {
            description: 'Signal details',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Signal' } } }
          },
          '404': { description: 'Signal not found' }
        }
      }
    },
    '/api/agent/signals': {
      get: {
        tags: ['Signals'],
        summary: 'Agent-optimized signals',
        description: 'Get signals optimized for AI agent consumption with confluence data',
        operationId: 'getAgentSignals',
        parameters: [
          { name: 'minScore', in: 'query', schema: { type: 'integer', default: 70 }, description: 'Minimum score (default higher for agents)' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 }, description: 'Number of results' },
          { name: 'riskLevel', in: 'query', schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] }, description: 'Filter by risk level' },
          { name: 'minSources', in: 'query', schema: { type: 'integer', default: 2 }, description: 'Minimum source confluence' },
          { name: 'convictionLevel', in: 'query', schema: { type: 'string', enum: ['STANDARD', 'HIGH_CONVICTION', 'ULTRA'] } }
        ],
        responses: {
          '200': {
            description: 'Agent-optimized signals',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentSignalResponse' } } }
          }
        }
      }
    },
    '/api/agent/signals/latest': {
      get: {
        tags: ['Signals'],
        summary: 'Latest best signal',
        description: 'Get the single best signal from the last 30 minutes for quick decisions',
        operationId: 'getLatestBestSignal',
        responses: {
          '200': {
            description: 'Latest best signal or null',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LatestSignalResponse' } } }
          }
        }
      }
    },
    '/api/gainers': {
      get: {
        tags: ['Signals'],
        summary: 'Top gainers',
        description: 'Get top 10 signals from the last hour sorted by score',
        operationId: 'getGainers',
        responses: {
          '200': {
            description: 'Top gainers list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GainersResponse' } } }
          }
        }
      }
    },
    '/api/explain/{id}': {
      get: {
        tags: ['Signals'],
        summary: 'Signal explanation',
        description: 'Get AI-generated explanation for why a signal was created',
        operationId: 'getSignalExplanation',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Signal explanation',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SignalExplanation' } } }
          },
          '404': { description: 'Signal not found' }
        }
      }
    },
    '/api/explain/{id}/detailed': {
      get: {
        tags: ['Signals'],
        summary: 'Detailed AI explanation',
        description: 'Get comprehensive AI-powered analysis with bull/bear factors',
        operationId: 'getDetailedExplanation',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Detailed explanation' },
          '404': { description: 'Signal not found' }
        }
      }
    },

    // ========================================
    // DETECTION ENDPOINTS
    // ========================================
    '/api/detection/honeypot/{token}': {
      get: {
        tags: ['Detection'],
        summary: 'Honeypot detection',
        description: 'Check if a token is a honeypot (cannot sell)',
        operationId: 'detectHoneypot',
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' }, description: 'Token mint address' }
        ],
        responses: {
          '200': {
            description: 'Honeypot analysis result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HoneypotResult' } } }
          },
          '400': { description: 'Invalid token address' }
        }
      }
    },
    '/api/detection/bundle/{token}': {
      get: {
        tags: ['Detection'],
        summary: 'Bundle/Insider detection',
        description: 'Detect bundled wallets and insider activity',
        operationId: 'detectBundle',
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Bundle analysis result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BundleAnalysis' } } }
          },
          '400': { description: 'Invalid token address' }
        }
      }
    },
    '/api/detection/wash/{token}': {
      get: {
        tags: ['Detection'],
        summary: 'Wash trading detection',
        description: 'Analyze token for fake volume and wash trading patterns',
        operationId: 'detectWashTrading',
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Wash trading analysis',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/WashAnalysis' } } }
          },
          '400': { description: 'Invalid token address' }
        }
      }
    },
    '/api/detection/snipers/{token}': {
      get: {
        tags: ['Detection'],
        summary: 'Sniper detection',
        description: 'Detect sniper bots and front-runner activity',
        operationId: 'detectSnipers',
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Sniper analysis result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SniperAnalysis' } } }
          },
          '400': { description: 'Invalid token address' }
        }
      }
    },
    '/api/detection/full/{token}': {
      get: {
        tags: ['Detection'],
        summary: 'Full detection suite',
        description: 'Run all detection checks (honeypot + wash + bundle + sniper) in parallel',
        operationId: 'fullDetection',
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Combined detection results',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/FullDetectionResult' } } }
          }
        }
      }
    },
    '/api/detection/real-volume/{token}': {
      get: {
        tags: ['Detection'],
        summary: 'Estimated real volume',
        description: 'Get estimated organic volume vs reported volume',
        operationId: 'getRealVolume',
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Volume analysis' }
        }
      }
    },

    // ========================================
    // ANALYTICS ENDPOINTS
    // ========================================
    '/api/leaderboard/signals': {
      get: {
        tags: ['Analytics'],
        summary: 'Signals leaderboard',
        description: 'Get top performing signals ranked by ROI',
        operationId: 'getSignalsLeaderboard',
        parameters: [
          { name: 'timeframe', in: 'query', schema: { type: 'string', enum: ['24h', '7d', '30d', 'all'], default: '24h' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['roi', 'athRoi', 'score'], default: 'roi' } }
        ],
        responses: {
          '200': {
            description: 'Signals leaderboard',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LeaderboardResponse' } } }
          }
        }
      }
    },
    '/api/leaderboard/sources': {
      get: {
        tags: ['Analytics'],
        summary: 'Sources leaderboard',
        description: 'Get performance rankings for signal sources',
        operationId: 'getSourcesLeaderboard',
        parameters: [
          { name: 'timeframe', in: 'query', schema: { type: 'string', default: '7d' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['winRate', 'avgRoi', 'totalSignals'], default: 'winRate' } }
        ],
        responses: {
          '200': { description: 'Sources leaderboard' }
        }
      }
    },
    '/api/leaderboard/dashboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Dashboard leaderboard',
        description: 'Combined leaderboard data for dashboard display',
        operationId: 'getDashboardLeaderboard',
        parameters: [
          { name: 'timeframe', in: 'query', schema: { type: 'string', default: '24h' } }
        ],
        responses: {
          '200': { description: 'Combined leaderboard data' }
        }
      }
    },
    '/api/analytics/performance': {
      get: {
        tags: ['Analytics'],
        summary: 'Performance overview',
        description: 'Get overall trading performance statistics',
        operationId: 'getPerformance',
        responses: {
          '200': {
            description: 'Performance statistics',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PerformanceStats' } } }
          }
        }
      }
    },
    '/api/analytics/correlation/{token}': {
      get: {
        tags: ['Analytics'],
        summary: 'Token correlation',
        description: 'Get correlated tokens and lead/lag analysis',
        operationId: 'getCorrelation',
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'minCorrelation', in: 'query', schema: { type: 'number', default: 0.4 } }
        ],
        responses: {
          '200': { description: 'Correlation analysis' }
        }
      }
    },
    '/api/analytics/charts/pnl': {
      get: {
        tags: ['Analytics'],
        summary: 'PnL chart data',
        description: 'Get daily PnL data for charting',
        operationId: 'getPnLChart',
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }
        ],
        responses: {
          '200': { description: 'PnL chart data' }
        }
      }
    },
    '/api/backtest': {
      get: {
        tags: ['Analytics'],
        summary: 'Backtest simulation',
        description: 'Run backtest simulation with different strategies',
        operationId: 'runBacktest',
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
          { name: 'minScore', in: 'query', schema: { type: 'integer', default: 60 } },
          { name: 'strategy', in: 'query', schema: { type: 'string', enum: ['default', 'conservative', 'aggressive', 'smart-wallet'], default: 'default' } }
        ],
        responses: {
          '200': {
            description: 'Backtest results',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BacktestResult' } } }
          }
        }
      }
    },

    // ========================================
    // TRADING ENDPOINTS
    // ========================================
    '/api/trade/quote': {
      post: {
        tags: ['Trading'],
        summary: 'Get trade quote',
        description: 'Get Jupiter DEX quote for a token trade',
        operationId: 'getTradeQuote',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/QuoteRequest' },
              example: { tokenMint: 'So11111111111111111111111111111111111111112', amount: 0.1, slippageBps: 100, isBuy: true }
            }
          }
        },
        responses: {
          '200': {
            description: 'Trade quote',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/QuoteResponse' } } }
          },
          '400': { description: 'Invalid request' },
          '404': { description: 'No route found' }
        }
      }
    },
    '/api/trade/execute': {
      post: {
        tags: ['Trading'],
        summary: 'Execute paper trade',
        description: 'Execute a paper trade for simulation',
        operationId: 'executePaperTrade',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TradeRequest' }
            }
          }
        },
        responses: {
          '200': { description: 'Trade executed' },
          '400': { description: 'Trade failed' }
        }
      }
    },
    '/api/trade/portfolio': {
      get: {
        tags: ['Trading'],
        summary: 'Get paper portfolio',
        description: 'Get current paper trading portfolio',
        operationId: 'getPaperPortfolio',
        responses: {
          '200': {
            description: 'Portfolio details',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Portfolio' } } }
          }
        }
      }
    },
    '/api/trade/portfolio/reset': {
      post: {
        tags: ['Trading'],
        summary: 'Reset portfolio',
        description: 'Reset paper portfolio with new balance',
        operationId: 'resetPortfolio',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  initialBalance: { type: 'number', default: 1000 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Portfolio reset' }
        }
      }
    },
    '/api/trade/history': {
      get: {
        tags: ['Trading'],
        summary: 'Trade history',
        description: 'Get paper trade history',
        operationId: 'getTradeHistory',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
        ],
        responses: {
          '200': { description: 'Trade history list' }
        }
      }
    },

    // ========================================
    // WALLET ENDPOINTS
    // ========================================
    '/api/wallet/connect': {
      post: {
        tags: ['Wallet'],
        summary: 'Connect wallet',
        description: 'Connect a Solana wallet for real trading',
        operationId: 'connectWallet',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WalletConnectRequest' }
            }
          }
        },
        responses: {
          '200': { description: 'Wallet connected' },
          '400': { description: 'Invalid wallet' }
        }
      }
    },
    '/api/wallet/balance/{publicKey}': {
      get: {
        tags: ['Wallet'],
        summary: 'Get wallet balance',
        description: 'Get SOL and token balances for a wallet',
        operationId: 'getWalletBalance',
        parameters: [
          { name: 'publicKey', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Wallet balances' },
          '400': { description: 'Invalid wallet' }
        }
      }
    },
    '/api/wallet/quote': {
      post: {
        tags: ['Wallet'],
        summary: 'Get swap quote',
        description: 'Get Jupiter swap quote for real trading',
        operationId: 'getSwapQuote',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SwapQuoteRequest' }
            }
          }
        },
        responses: {
          '200': { description: 'Swap quote' },
          '400': { description: 'Quote failed' }
        }
      }
    },
    '/api/wallet/safety-check': {
      post: {
        tags: ['Wallet'],
        summary: 'Safety check',
        description: 'Perform safety checks before trading',
        operationId: 'safetyCheck',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tokenMint'],
                properties: {
                  tokenMint: { type: 'string' },
                  inputAmount: { type: 'number', default: 0.1 },
                  slippageBps: { type: 'integer', default: 100 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Safety check results' }
        }
      }
    },
    '/api/wallet/presets': {
      get: {
        tags: ['Wallet'],
        summary: 'Trading presets',
        description: 'Get slippage and priority fee presets',
        operationId: 'getTradingPresets',
        responses: {
          '200': { description: 'Trading presets' }
        }
      }
    },

    // ========================================
    // SOCIAL/KOL ENDPOINTS
    // ========================================
    '/api/kol/leaderboard': {
      get: {
        tags: ['Social'],
        summary: 'KOL leaderboard',
        description: 'Get KOL reliability rankings',
        operationId: 'getKOLLeaderboard',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': {
            description: 'KOL leaderboard',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/KOLLeaderboard' } } }
          }
        }
      }
    },
    '/api/kol/{handle}/stats': {
      get: {
        tags: ['Social'],
        summary: 'KOL stats',
        description: 'Get detailed stats for a specific KOL',
        operationId: 'getKOLStats',
        parameters: [
          { name: 'handle', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'KOL statistics' },
          '404': { description: 'KOL not found' }
        }
      }
    },
    '/api/kol/{handle}/reliability': {
      get: {
        tags: ['Social'],
        summary: 'KOL reliability',
        description: 'Get reliability score and trading recommendation',
        operationId: 'getKOLReliability',
        parameters: [
          { name: 'handle', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Reliability assessment' }
        }
      }
    },
    '/api/kol/unreliable': {
      get: {
        tags: ['Social'],
        summary: 'Unreliable KOLs',
        description: 'List KOLs with poor track records or pump & dump patterns',
        operationId: 'getUnreliableKOLs',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': { description: 'Unreliable KOL list' }
        }
      }
    },
    '/api/kol/dashboard': {
      get: {
        tags: ['Social'],
        summary: 'KOL dashboard',
        description: 'Get KOL overview for dashboard display',
        operationId: 'getKOLDashboard',
        responses: {
          '200': { description: 'KOL dashboard data' }
        }
      }
    },

    // ========================================
    // GAMIFICATION ENDPOINTS
    // ========================================
    '/api/achievements': {
      get: {
        tags: ['Gamification'],
        summary: 'List achievements',
        description: 'Get all achievements with user progress',
        operationId: 'listAchievements',
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'string', default: 'anonymous' } }
        ],
        responses: {
          '200': {
            description: 'Achievements list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AchievementsResponse' } } }
          }
        }
      }
    },
    '/api/achievements/user/{userId}': {
      get: {
        tags: ['Gamification'],
        summary: 'User progress',
        description: 'Get user achievement progress, level, and stats',
        operationId: 'getUserProgress',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'User progress' }
        }
      }
    },
    '/api/challenges/daily': {
      get: {
        tags: ['Gamification'],
        summary: 'Daily challenges',
        description: 'Get today\'s daily challenges',
        operationId: 'getDailyChallenges',
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Daily challenges' }
        }
      }
    },
    '/api/challenges/weekly': {
      get: {
        tags: ['Gamification'],
        summary: 'Weekly challenges',
        description: 'Get this week\'s challenges',
        operationId: 'getWeeklyChallenges',
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Weekly challenges' }
        }
      }
    },
    '/api/levels': {
      get: {
        tags: ['Gamification'],
        summary: 'Level system',
        description: 'Get all levels and XP requirements',
        operationId: 'getLevels',
        responses: {
          '200': { description: 'Level system info' }
        }
      }
    },

    // ========================================
    // ON-CHAIN ENDPOINTS
    // ========================================
    '/api/onchain/stats': {
      get: {
        tags: ['On-Chain'],
        summary: 'On-chain stats',
        description: 'Get on-chain publishing statistics',
        operationId: 'getOnChainStats',
        responses: {
          '200': { description: 'On-chain stats' }
        }
      }
    },
    '/api/onchain/signals': {
      get: {
        tags: ['On-Chain'],
        summary: 'On-chain signals',
        description: 'Get signals published on Solana',
        operationId: 'getOnChainSignals',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': { description: 'On-chain signals' }
        }
      }
    },
    '/api/proofs': {
      get: {
        tags: ['On-Chain'],
        summary: 'Reasoning proofs',
        description: 'List all AI reasoning proofs (commit-reveal scheme)',
        operationId: 'listProofs',
        parameters: [
          { name: 'revealed', in: 'query', schema: { type: 'boolean', default: true } }
        ],
        responses: {
          '200': {
            description: 'Proofs list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ProofsListResponse' } } }
          }
        }
      }
    },
    '/api/proofs/{signalId}': {
      get: {
        tags: ['On-Chain'],
        summary: 'Get proof',
        description: 'Get specific reasoning proof',
        operationId: 'getProof',
        parameters: [
          { name: 'signalId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Proof details' },
          '404': { description: 'Proof not found' }
        }
      }
    },
    '/api/proofs/{signalId}/verify': {
      get: {
        tags: ['On-Chain'],
        summary: 'Verify proof',
        description: 'Verify that reasoning hash matches commitment',
        operationId: 'verifyProof',
        parameters: [
          { name: 'signalId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Verification result' }
        }
      }
    },

    // ========================================
    // SUBSCRIPTION ENDPOINTS
    // ========================================
    '/api/subscription/tiers': {
      get: {
        tags: ['Subscription'],
        summary: 'Subscription tiers',
        description: 'Get all available subscription tiers',
        operationId: 'getSubscriptionTiers',
        responses: {
          '200': {
            description: 'Subscription tiers',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SubscriptionTiers' } } }
          }
        }
      }
    },
    '/api/subscription/{wallet}': {
      get: {
        tags: ['Subscription'],
        summary: 'Check subscription',
        description: 'Check subscription status for a wallet',
        operationId: 'checkSubscription',
        parameters: [
          { name: 'wallet', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Subscription status' },
          '400': { description: 'Invalid wallet' }
        }
      }
    },

    // ========================================
    // RISK CALCULATOR
    // ========================================
    '/api/risk/calculate': {
      post: {
        tags: ['Trading'],
        summary: 'Calculate risk',
        description: 'Calculate position size and risk parameters',
        operationId: 'calculateRisk',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RiskCalculationRequest' },
              example: { portfolioSize: 1000, riskPercent: 5, signalId: 'signal-123' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Risk calculation',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RiskCalculationResponse' } } }
          }
        }
      }
    },
    '/api/risk/quick': {
      get: {
        tags: ['Trading'],
        summary: 'Quick position size',
        description: 'Quick position size calculation',
        operationId: 'quickPositionSize',
        parameters: [
          { name: 'portfolioSize', in: 'query', schema: { type: 'number', default: 1000 } },
          { name: 'score', in: 'query', schema: { type: 'integer', default: 60 } },
          { name: 'riskLevel', in: 'query', schema: { type: 'string', default: 'MEDIUM' } }
        ],
        responses: {
          '200': { description: 'Position size' }
        }
      }
    },
    '/api/risk/rules': {
      get: {
        tags: ['Trading'],
        summary: 'Position sizing rules',
        description: 'Get position sizing rules by risk level',
        operationId: 'getRiskRules',
        responses: {
          '200': { description: 'Risk rules' }
        }
      }
    },

    // ========================================
    // ALERT RULES
    // ========================================
    '/api/alerts/rules': {
      get: {
        tags: ['Alerts'],
        summary: 'List alert rules',
        description: 'Get all configured alert rules',
        operationId: 'listAlertRules',
        parameters: [
          { name: 'enabled', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: {
          '200': { description: 'Alert rules list' }
        }
      },
      post: {
        tags: ['Alerts'],
        summary: 'Create alert rule',
        description: 'Create a new alert rule',
        operationId: 'createAlertRule',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AlertRuleRequest' }
            }
          }
        },
        responses: {
          '200': { description: 'Rule created' },
          '400': { description: 'Invalid rule' }
        }
      }
    },
    '/api/alerts/templates': {
      get: {
        tags: ['Alerts'],
        summary: 'Alert templates',
        description: 'Get available alert rule templates',
        operationId: 'listAlertTemplates',
        responses: {
          '200': { description: 'Templates list' }
        }
      }
    },

    // ========================================
    // COPY TRADING
    // ========================================
    '/api/copy/settings': {
      get: {
        tags: ['Trading'],
        summary: 'Copy trading settings',
        description: 'Get auto-copy trading settings',
        operationId: 'getCopySettings',
        responses: {
          '200': { description: 'Copy settings' }
        }
      },
      post: {
        tags: ['Trading'],
        summary: 'Update copy settings',
        description: 'Update auto-copy trading settings',
        operationId: 'updateCopySettings',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CopySettings' }
            }
          }
        },
        responses: {
          '200': { description: 'Settings updated' }
        }
      }
    },
    '/api/copy/wallets': {
      get: {
        tags: ['Trading'],
        summary: 'Followed wallets',
        description: 'Get all wallets being followed for copy trading',
        operationId: 'getFollowedWallets',
        responses: {
          '200': { description: 'Followed wallets list' }
        }
      }
    },
    '/api/copy/follow': {
      post: {
        tags: ['Trading'],
        summary: 'Follow wallet',
        description: 'Start following a wallet for copy trading',
        operationId: 'followWallet',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['address', 'label'],
                properties: {
                  address: { type: 'string' },
                  label: { type: 'string' },
                  winRate: { type: 'number' },
                  source: { type: 'string' },
                  notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Wallet followed' },
          '400': { description: 'Invalid request' }
        }
      }
    },

    // ========================================
    // EXPORT ENDPOINTS
    // ========================================
    '/api/export/signals': {
      get: {
        tags: ['Export'],
        summary: 'Export signals',
        description: 'Export signals in JSON, CSV, or Markdown format',
        operationId: 'exportSignals',
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv', 'markdown'], default: 'json' } },
          { name: 'minScore', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
          { name: 'performance', in: 'query', schema: { type: 'boolean', default: true } }
        ],
        responses: {
          '200': {
            description: 'Exported data',
            content: {
              'application/json': { schema: { type: 'string' } },
              'text/csv': { schema: { type: 'string' } },
              'text/markdown': { schema: { type: 'string' } }
            }
          }
        }
      }
    },
    '/api/export/performance': {
      get: {
        tags: ['Export'],
        summary: 'Export performance report',
        description: 'Export performance report in Markdown',
        operationId: 'exportPerformance',
        responses: {
          '200': {
            description: 'Performance report',
            content: { 'text/markdown': { schema: { type: 'string' } } }
          }
        }
      }
    },

    // ========================================
    // SHARE CARDS
    // ========================================
    '/api/share/{id}/text': {
      get: {
        tags: ['Export'],
        summary: 'Text share card',
        description: 'Get shareable text representation of signal',
        operationId: 'getTextShareCard',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { content: { 'text/plain': { schema: { type: 'string' } } } }
        }
      }
    },
    '/api/share/{id}/svg': {
      get: {
        tags: ['Export'],
        summary: 'SVG share card',
        description: 'Get SVG image share card',
        operationId: 'getSvgShareCard',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { content: { 'image/svg+xml': { schema: { type: 'string' } } } }
        }
      }
    },

    // ========================================
    // MARKET CONDITION
    // ========================================
    '/api/market/condition': {
      get: {
        tags: ['Analytics'],
        summary: 'Market condition',
        description: 'Get current market condition and trend analysis',
        operationId: 'getMarketCondition',
        responses: {
          '200': {
            description: 'Market condition',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/MarketCondition' } } }
          }
        }
      }
    },
    '/api/market/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Market summary',
        description: 'Get market summary for widgets',
        operationId: 'getMarketSummary',
        responses: {
          '200': { description: 'Market summary' }
        }
      }
    },

    // ========================================
    // DEMO ENDPOINTS
    // ========================================
    '/api/demo/start': {
      post: {
        tags: ['Demo'],
        summary: 'Start demo mode',
        description: 'Start generating demo signals',
        operationId: 'startDemo',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  signalsPerMinute: { type: 'integer', default: 4 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Demo started' }
        }
      }
    },
    '/api/demo/stop': {
      post: {
        tags: ['Demo'],
        summary: 'Stop demo mode',
        operationId: 'stopDemo',
        responses: {
          '200': { description: 'Demo stopped' }
        }
      }
    },
    '/api/demo/seed': {
      post: {
        tags: ['Demo'],
        summary: 'Seed demo data',
        description: 'Seed historical signals for testing',
        operationId: 'seedDemoData',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  count: { type: 'integer', default: 30 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Demo data seeded' }
        }
      }
    },

    // ========================================
    // DOCS ENDPOINTS (self-referential)
    // ========================================
    '/api/docs/openapi.json': {
      get: {
        tags: ['System'],
        summary: 'OpenAPI spec (JSON)',
        description: 'Get OpenAPI specification in JSON format',
        operationId: 'getOpenApiJson',
        responses: {
          '200': {
            description: 'OpenAPI specification',
            content: { 'application/json': {} }
          }
        }
      }
    },
    '/api/docs/openapi.yaml': {
      get: {
        tags: ['System'],
        summary: 'OpenAPI spec (YAML)',
        description: 'Get OpenAPI specification in YAML format',
        operationId: 'getOpenApiYaml',
        responses: {
          '200': {
            description: 'OpenAPI specification',
            content: { 'text/yaml': {} }
          }
        }
      }
    }
  },

  // ==========================================
  // COMPONENTS / SCHEMAS
  // ==========================================
  components: {
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
          signals: { type: 'integer' },
          uptime: { type: 'number' }
        }
      },
      ProjectInfo: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          description: { type: 'string' },
          author: { type: 'string' },
          programId: { type: 'string' },
          network: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } }
        }
      },
      SystemStatus: {
        type: 'object',
        properties: {
          uptime: { type: 'number' },
          signalsStored: { type: 'integer' },
          onChainEnabled: { type: 'boolean' },
          demoMode: { type: 'boolean' }
        }
      },
      JsonMetrics: {
        type: 'object',
        properties: {
          requests: { type: 'integer' },
          errors: { type: 'integer' },
          signalsProcessed: { type: 'integer' }
        }
      },
      PlatformStats: {
        type: 'object',
        properties: {
          totalApiCalls: { type: 'integer' },
          callsToday: { type: 'integer' },
          uniqueUsers: { type: 'integer' },
          activeIntegrations: { type: 'integer' },
          signalsProcessedToday: { type: 'integer' },
          totalSignals: { type: 'integer' },
          winRate: { type: 'string' },
          uptimeDays: { type: 'integer' }
        }
      },
      Signal: {
        type: 'object',
        required: ['id', 'token', 'symbol', 'score', 'timestamp'],
        properties: {
          id: { type: 'string' },
          token: { type: 'string', description: 'Token mint address' },
          symbol: { type: 'string' },
          name: { type: 'string' },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] },
          confluence: { $ref: '#/components/schemas/Confluence' },
          sources: { type: 'array', items: { $ref: '#/components/schemas/SignalSource' } },
          marketData: { $ref: '#/components/schemas/MarketData' },
          analysis: { $ref: '#/components/schemas/Analysis' },
          safety: { $ref: '#/components/schemas/SafetyData' },
          performance: { $ref: '#/components/schemas/Performance' },
          timestamp: { type: 'integer' },
          published: { type: 'boolean' }
        }
      },
      Confluence: {
        type: 'object',
        properties: {
          uniqueSources: { type: 'integer' },
          sourceTypes: { type: 'array', items: { type: 'string' } },
          confluenceBoost: { type: 'integer' },
          convictionLevel: { type: 'string', enum: ['STANDARD', 'HIGH_CONVICTION', 'ULTRA'] }
        }
      },
      SignalSource: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          weight: { type: 'number' },
          rawScore: { type: 'number' }
        }
      },
      MarketData: {
        type: 'object',
        properties: {
          price: { type: 'number' },
          mcap: { type: 'number' },
          liquidity: { type: 'number' },
          volume5m: { type: 'number' },
          volume1h: { type: 'number' },
          priceChange5m: { type: 'number' },
          priceChange1h: { type: 'number' },
          holders: { type: 'integer' },
          age: { type: 'integer', description: 'Token age in minutes' }
        }
      },
      Analysis: {
        type: 'object',
        properties: {
          narrative: { type: 'array', items: { type: 'string' } },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          recommendation: { type: 'string' }
        }
      },
      SafetyData: {
        type: 'object',
        properties: {
          safetyScore: { type: 'integer', minimum: 0, maximum: 100 },
          riskCategory: { type: 'string', enum: ['SAFE', 'CAUTION', 'RISKY'] },
          redFlags: { type: 'array', items: { $ref: '#/components/schemas/RedFlag' } },
          devHoldings: { type: 'number' },
          topHolderPercentage: { type: 'number' },
          liquidityLocked: { type: 'boolean' },
          mintAuthorityEnabled: { type: 'boolean' },
          freezeAuthorityEnabled: { type: 'boolean' }
        }
      },
      RedFlag: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          points: { type: 'integer' }
        }
      },
      Performance: {
        type: 'object',
        properties: {
          entryPrice: { type: 'number' },
          currentPrice: { type: 'number' },
          athPrice: { type: 'number' },
          roi: { type: 'number' },
          athRoi: { type: 'number' },
          status: { type: 'string', enum: ['OPEN', 'WIN', 'LOSS'] }
        }
      },
      SignalListResponse: {
        type: 'object',
        properties: {
          count: { type: 'integer' },
          filters: { type: 'object' },
          signals: { type: 'array', items: { $ref: '#/components/schemas/Signal' } }
        }
      },
      AgentSignalResponse: {
        type: 'object',
        properties: {
          count: { type: 'integer' },
          timestamp: { type: 'integer' },
          filters: { type: 'object' },
          signals: { type: 'array', items: { $ref: '#/components/schemas/Signal' } }
        }
      },
      LatestSignalResponse: {
        type: 'object',
        properties: {
          signal: { $ref: '#/components/schemas/Signal' },
          message: { type: 'string' }
        }
      },
      GainersResponse: {
        type: 'object',
        properties: {
          count: { type: 'integer' },
          gainers: { type: 'array', items: { $ref: '#/components/schemas/Signal' } }
        }
      },
      SignalExplanation: {
        type: 'object',
        properties: {
          signal: { type: 'object' },
          explanation: { type: 'object' }
        }
      },
      HoneypotResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          token: { type: 'string' },
          symbol: { type: 'string' },
          isHoneypot: { type: 'boolean' },
          honeypotReason: { type: 'string' },
          canSell: { type: 'boolean' },
          taxes: {
            type: 'object',
            properties: {
              buy: { type: 'number' },
              sell: { type: 'number' },
              transfer: { type: 'number' }
            }
          },
          risk: {
            type: 'object',
            properties: {
              score: { type: 'integer' },
              level: { type: 'string', enum: ['SAFE', 'LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK', 'HONEYPOT'] }
            }
          },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      BundleAnalysis: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          bundleScore: { type: 'integer' },
          riskLevel: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] },
          summary: { type: 'object' },
          redFlags: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
          clusters: { type: 'array', items: { type: 'object' } }
        }
      },
      WashAnalysis: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          token: { type: 'string' },
          symbol: { type: 'string' },
          washScore: { type: 'integer' },
          riskLevel: { type: 'string', enum: ['EXTREME', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL'] },
          volume: {
            type: 'object',
            properties: {
              reported: { type: 'number' },
              estimatedReal: { type: 'number' },
              washPercent: { type: 'number' },
              realPercent: { type: 'number' }
            }
          },
          detection: {
            type: 'object',
            properties: {
              selfTrades: { type: 'integer' },
              circularPatterns: { type: 'integer' },
              uniqueTraders: { type: 'integer' }
            }
          },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      SniperAnalysis: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          token: { type: 'string' },
          symbol: { type: 'string' },
          sniperScore: { type: 'integer' },
          sniperRisk: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] },
          counts: {
            type: 'object',
            properties: {
              totalSnipers: { type: 'integer' },
              block0Buyers: { type: 'integer' },
              knownMEVBots: { type: 'integer' }
            }
          },
          supply: {
            type: 'object',
            properties: {
              sniperPercent: { type: 'number' },
              dumpProbability: { type: 'number' }
            }
          },
          snipers: { type: 'array', items: { type: 'object' } }
        }
      },
      FullDetectionResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          token: { type: 'string' },
          combinedRiskScore: { type: 'integer' },
          overallRisk: { type: 'string' },
          scores: {
            type: 'object',
            properties: {
              wash: { type: 'integer' },
              honeypot: { type: 'integer' },
              bundle: { type: 'integer' },
              sniper: { type: 'integer' }
            }
          },
          riskLevels: { type: 'object' },
          metrics: { type: 'object' },
          warnings: { type: 'array', items: { type: 'string' } },
          recommendation: { type: 'string' }
        }
      },
      LeaderboardResponse: {
        type: 'object',
        properties: {
          timeframe: { type: 'string' },
          count: { type: 'integer' },
          stats: { type: 'object' },
          leaderboard: { type: 'array', items: { type: 'object' } }
        }
      },
      PerformanceStats: {
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            properties: {
              totalTrades: { type: 'integer' },
              openTrades: { type: 'integer' },
              closedTrades: { type: 'integer' },
              wins: { type: 'integer' },
              losses: { type: 'integer' },
              winRate: { type: 'number' },
              totalPnl: { type: 'number' },
              profitFactor: { type: 'number' },
              sharpeRatio: { type: 'number' }
            }
          },
          bestTrade: { type: 'object' },
          worstTrade: { type: 'object' },
          bestHours: { type: 'array', items: { type: 'object' } }
        }
      },
      BacktestResult: {
        type: 'object',
        properties: {
          parameters: { type: 'object' },
          summary: {
            type: 'object',
            properties: {
              totalReturn: { type: 'number' },
              totalReturnDollars: { type: 'number' },
              finalValue: { type: 'number' },
              maxDrawdown: { type: 'number' },
              sharpeRatio: { type: 'number' },
              winRate: { type: 'number' },
              totalTrades: { type: 'integer' },
              vsSOL: { type: 'number' }
            }
          },
          chartData: { type: 'array', items: { type: 'object' } }
        }
      },
      QuoteRequest: {
        type: 'object',
        required: ['tokenMint', 'amount'],
        properties: {
          tokenMint: { type: 'string' },
          amount: { type: 'number' },
          slippageBps: { type: 'integer', default: 100 },
          isBuy: { type: 'boolean', default: true }
        }
      },
      QuoteResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          quote: {
            type: 'object',
            properties: {
              inputMint: { type: 'string' },
              outputMint: { type: 'string' },
              inputAmount: { type: 'number' },
              outputAmount: { type: 'number' },
              price: { type: 'number' },
              priceImpact: { type: 'number' },
              slippageBps: { type: 'integer' },
              route: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      },
      TradeRequest: {
        type: 'object',
        required: ['tokenMint', 'amount'],
        properties: {
          tokenMint: { type: 'string' },
          amount: { type: 'number' },
          isBuy: { type: 'boolean', default: true },
          slippageBps: { type: 'integer', default: 100 },
          signalId: { type: 'string' },
          signalScore: { type: 'integer' }
        }
      },
      Portfolio: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          createdAt: { type: 'integer' },
          initialBalance: { type: 'number' },
          currentBalance: { type: 'number' },
          holdings: { type: 'array', items: { type: 'object' } },
          stats: { type: 'object' },
          recentTrades: { type: 'array', items: { type: 'object' } }
        }
      },
      WalletConnectRequest: {
        type: 'object',
        required: ['publicKey'],
        properties: {
          walletType: { type: 'string' },
          publicKey: { type: 'string' },
          signature: { type: 'string' }
        }
      },
      SwapQuoteRequest: {
        type: 'object',
        required: ['inputMint', 'outputMint', 'amount'],
        properties: {
          inputMint: { type: 'string' },
          outputMint: { type: 'string' },
          amount: { type: 'number' },
          slippageBps: { type: 'integer' }
        }
      },
      KOLLeaderboard: {
        type: 'object',
        properties: {
          timestamp: { type: 'integer' },
          topReliable: { type: 'array', items: { $ref: '#/components/schemas/KOLStats' } },
          unreliable: { type: 'array', items: { $ref: '#/components/schemas/KOLStats' } },
          risingStars: { type: 'array', items: { $ref: '#/components/schemas/KOLStats' } },
          mostActive: { type: 'array', items: { $ref: '#/components/schemas/KOLStats' } }
        }
      },
      KOLStats: {
        type: 'object',
        properties: {
          handle: { type: 'string' },
          label: { type: 'string' },
          tier: { type: 'string' },
          reliabilityScore: { type: 'integer' },
          reliabilityTrend: { type: 'string' },
          totalCalls: { type: 'integer' },
          wins: { type: 'integer' },
          losses: { type: 'integer' },
          winRate: { type: 'number' },
          avgRoi: { type: 'number' },
          isPumpAndDump: { type: 'boolean' },
          badges: { type: 'array', items: { type: 'string' } }
        }
      },
      AchievementsResponse: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          unlocked: { type: 'integer' },
          achievements: { type: 'array', items: { $ref: '#/components/schemas/Achievement' } },
          byCategory: { type: 'object' },
          byTier: { type: 'object' }
        }
      },
      Achievement: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          icon: { type: 'string' },
          tier: { type: 'string', enum: ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'LEGENDARY'] },
          category: { type: 'string' },
          xpReward: { type: 'integer' },
          unlocked: { type: 'boolean' },
          progress: { type: 'number' }
        }
      },
      ProofsListResponse: {
        type: 'object',
        properties: {
          count: { type: 'integer' },
          proofs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                signalId: { type: 'string' },
                symbol: { type: 'string' },
                token: { type: 'string' },
                timestamp: { type: 'integer' },
                reasoningHash: { type: 'string' },
                revealed: { type: 'boolean' },
                verified: { type: 'boolean' }
              }
            }
          }
        }
      },
      SubscriptionTiers: {
        type: 'object',
        properties: {
          tiers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'number' },
                features: { type: 'array', items: { type: 'string' } },
                minScore: { type: 'integer' },
                delaySeconds: { type: 'integer' }
              }
            }
          },
          tokenMint: { type: 'string' }
        }
      },
      RiskCalculationRequest: {
        type: 'object',
        required: ['portfolioSize'],
        properties: {
          portfolioSize: { type: 'number' },
          riskPercent: { type: 'number', default: 5 },
          signalId: { type: 'string' },
          score: { type: 'integer' },
          riskLevel: { type: 'string' },
          volatility: { type: 'number' }
        }
      },
      RiskCalculationResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          calculation: {
            type: 'object',
            properties: {
              recommendedPosition: { type: 'number' },
              recommendedPositionPercent: { type: 'number' },
              maxPosition: { type: 'number' },
              kellyPosition: { type: 'number' },
              recommendedStopLoss: { type: 'number' },
              takeProfit: { type: 'array', items: { type: 'object' } },
              confidence: { type: 'string' }
            }
          },
          signal: { type: 'object' }
        }
      },
      AlertRuleRequest: {
        type: 'object',
        required: ['name', 'conditionGroups', 'actions'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          conditionGroups: { type: 'array', items: { type: 'object' } },
          actions: { type: 'array', items: { type: 'object' } },
          groupOperator: { type: 'string', enum: ['AND', 'OR'], default: 'AND' },
          cooldownMinutes: { type: 'integer', default: 5 },
          maxTriggersPerDay: { type: 'integer', default: 50 },
          tags: { type: 'array', items: { type: 'string' } },
          enabled: { type: 'boolean', default: true }
        }
      },
      CopySettings: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          maxPositionSize: { type: 'number' },
          minScore: { type: 'integer' },
          allowedRiskLevels: { type: 'array', items: { type: 'string' } },
          slippageBps: { type: 'integer' },
          cooldownMinutes: { type: 'integer' }
        }
      },
      MarketCondition: {
        type: 'object',
        properties: {
          overall: {
            type: 'object',
            properties: {
              trend: { type: 'string', enum: ['BULL', 'BEAR', 'SIDEWAYS'] },
              volatility: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] },
              liquidityPeriod: { type: 'string' },
              isOptimalTrading: { type: 'boolean' }
            }
          },
          btc: {
            type: 'object',
            properties: {
              price: { type: 'number' },
              change24h: { type: 'number' }
            }
          },
          sol: {
            type: 'object',
            properties: {
              price: { type: 'number' },
              change24h: { type: 'number' }
            }
          },
          scoring: {
            type: 'object',
            properties: {
              totalModifier: { type: 'number' }
            }
          },
          timestamp: { type: 'integer' },
          cached: { type: 'boolean' }
        }
      }
    },
    securitySchemes: {
      WalletAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Wallet-Address',
        description: 'Solana wallet address for subscription verification'
      }
    }
  }
};

// ==========================================
// Swagger UI HTML Template (Dark Theme)
// ==========================================

const swaggerUiHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ORACLE Alpha API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔮</text></svg>">
  <style>
    /* Dark theme overrides */
    :root {
      --bg-primary: #0a0a1a;
      --bg-secondary: #12122a;
      --bg-tertiary: #1a1a3a;
      --text-primary: #e0e0e0;
      --text-secondary: #a0a0a0;
      --accent-cyan: #00d9ff;
      --accent-purple: #a855f7;
      --accent-green: #22c55e;
      --accent-yellow: #eab308;
      --accent-red: #ef4444;
      --accent-orange: #f97316;
    }
    
    body {
      background: var(--bg-primary);
      margin: 0;
      padding: 0;
    }
    
    .swagger-ui {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    /* Top bar */
    .swagger-ui .topbar {
      background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
      padding: 15px 0;
      border-bottom: 1px solid rgba(0, 217, 255, 0.2);
    }
    
    .swagger-ui .topbar .download-url-wrapper {
      display: flex;
      align-items: center;
    }
    
    .swagger-ui .topbar .download-url-wrapper input[type=text] {
      background: var(--bg-primary);
      border: 1px solid rgba(0, 217, 255, 0.3);
      color: var(--text-primary);
      border-radius: 6px;
    }
    
    .swagger-ui .topbar .download-url-wrapper .download-url-button {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      border: none;
      border-radius: 6px;
    }
    
    /* Info section */
    .swagger-ui .info {
      background: var(--bg-secondary);
      padding: 30px;
      border-radius: 12px;
      margin: 20px;
      border: 1px solid rgba(0, 217, 255, 0.1);
    }
    
    .swagger-ui .info .title {
      color: var(--text-primary);
      font-size: 2.5rem;
    }
    
    .swagger-ui .info .title small {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .swagger-ui .info .description {
      color: var(--text-secondary);
    }
    
    .swagger-ui .info .description p {
      color: var(--text-secondary);
    }
    
    .swagger-ui .info .description h1,
    .swagger-ui .info .description h2 {
      color: var(--text-primary);
      border-bottom: 1px solid rgba(0, 217, 255, 0.2);
      padding-bottom: 10px;
    }
    
    .swagger-ui .info .description code {
      background: var(--bg-tertiary);
      color: var(--accent-cyan);
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    /* Wrapper */
    .swagger-ui .wrapper {
      background: var(--bg-primary);
      padding: 0 20px;
    }
    
    /* Operation tags */
    .swagger-ui .opblock-tag {
      background: var(--bg-secondary);
      border: 1px solid rgba(0, 217, 255, 0.1);
      border-radius: 8px;
      margin: 10px 0;
      color: var(--text-primary);
    }
    
    .swagger-ui .opblock-tag:hover {
      background: var(--bg-tertiary);
    }
    
    .swagger-ui .opblock-tag small {
      color: var(--text-secondary);
    }
    
    /* Operations */
    .swagger-ui .opblock {
      background: var(--bg-secondary);
      border: 1px solid rgba(0, 217, 255, 0.1);
      border-radius: 8px;
      margin: 8px 0;
    }
    
    .swagger-ui .opblock .opblock-summary {
      border: none;
    }
    
    .swagger-ui .opblock .opblock-summary-method {
      border-radius: 6px;
      font-weight: 600;
      min-width: 80px;
    }
    
    .swagger-ui .opblock.opblock-get .opblock-summary-method {
      background: var(--accent-cyan);
    }
    
    .swagger-ui .opblock.opblock-post .opblock-summary-method {
      background: var(--accent-green);
    }
    
    .swagger-ui .opblock.opblock-put .opblock-summary-method {
      background: var(--accent-yellow);
    }
    
    .swagger-ui .opblock.opblock-delete .opblock-summary-method {
      background: var(--accent-red);
    }
    
    .swagger-ui .opblock.opblock-patch .opblock-summary-method {
      background: var(--accent-orange);
    }
    
    .swagger-ui .opblock .opblock-summary-path {
      color: var(--text-primary);
    }
    
    .swagger-ui .opblock .opblock-summary-description {
      color: var(--text-secondary);
    }
    
    .swagger-ui .opblock.opblock-get {
      border-color: rgba(0, 217, 255, 0.3);
      background: linear-gradient(135deg, rgba(0, 217, 255, 0.05) 0%, var(--bg-secondary) 100%);
    }
    
    .swagger-ui .opblock.opblock-post {
      border-color: rgba(34, 197, 94, 0.3);
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, var(--bg-secondary) 100%);
    }
    
    .swagger-ui .opblock.opblock-delete {
      border-color: rgba(239, 68, 68, 0.3);
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, var(--bg-secondary) 100%);
    }
    
    /* Expanded operation */
    .swagger-ui .opblock-body {
      background: var(--bg-tertiary);
    }
    
    .swagger-ui .opblock-body pre {
      background: var(--bg-primary);
      color: var(--text-primary);
      border-radius: 6px;
    }
    
    .swagger-ui .opblock-section-header {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    
    .swagger-ui .opblock-section-header h4 {
      color: var(--text-primary);
    }
    
    /* Parameters */
    .swagger-ui .parameters-col_name {
      color: var(--text-primary);
    }
    
    .swagger-ui .parameters-col_description {
      color: var(--text-secondary);
    }
    
    .swagger-ui .parameter__name {
      color: var(--accent-cyan);
    }
    
    .swagger-ui .parameter__type {
      color: var(--text-secondary);
    }
    
    .swagger-ui .parameter__in {
      color: var(--text-secondary);
    }
    
    /* Table */
    .swagger-ui table tbody tr td {
      color: var(--text-primary);
      border-color: rgba(0, 217, 255, 0.1);
    }
    
    .swagger-ui table thead tr th {
      color: var(--text-secondary);
      border-color: rgba(0, 217, 255, 0.1);
    }
    
    /* Buttons */
    .swagger-ui .btn {
      border-radius: 6px;
    }
    
    .swagger-ui .btn.execute {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      border: none;
      color: white;
    }
    
    .swagger-ui .btn.execute:hover {
      background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
    }
    
    .swagger-ui .btn.cancel {
      border-color: var(--accent-red);
      color: var(--accent-red);
    }
    
    /* Models */
    .swagger-ui .model-box {
      background: var(--bg-secondary);
      border-radius: 8px;
    }
    
    .swagger-ui .model {
      color: var(--text-primary);
    }
    
    .swagger-ui .model-title {
      color: var(--text-primary);
    }
    
    .swagger-ui .prop-type {
      color: var(--accent-cyan);
    }
    
    .swagger-ui .prop-format {
      color: var(--text-secondary);
    }
    
    /* Response */
    .swagger-ui .responses-inner {
      background: var(--bg-tertiary);
      border-radius: 6px;
    }
    
    .swagger-ui .response-col_status {
      color: var(--text-primary);
    }
    
    .swagger-ui .response-col_description {
      color: var(--text-secondary);
    }
    
    /* Input fields */
    .swagger-ui input[type=text],
    .swagger-ui textarea {
      background: var(--bg-primary);
      border: 1px solid rgba(0, 217, 255, 0.3);
      color: var(--text-primary);
      border-radius: 6px;
    }
    
    .swagger-ui select {
      background: var(--bg-primary);
      border: 1px solid rgba(0, 217, 255, 0.3);
      color: var(--text-primary);
      border-radius: 6px;
    }
    
    /* Scheme container */
    .swagger-ui .scheme-container {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 15px;
      margin: 20px;
    }
    
    /* Servers dropdown */
    .swagger-ui .servers-title {
      color: var(--text-primary);
    }
    
    .swagger-ui .servers>label {
      color: var(--text-secondary);
    }
    
    /* Tab header */
    .swagger-ui .tab li {
      color: var(--text-secondary);
    }
    
    .swagger-ui .tab li.active {
      color: var(--accent-cyan);
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }
    
    ::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 217, 255, 0.3);
    }
    
    /* Custom header */
    .custom-header {
      background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
      padding: 20px 40px;
      border-bottom: 1px solid rgba(0, 217, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .custom-header .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .custom-header .logo-icon {
      font-size: 2.5rem;
    }
    
    .custom-header .logo-text {
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .custom-header .links {
      display: flex;
      gap: 20px;
    }
    
    .custom-header .links a {
      color: var(--text-secondary);
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    
    .custom-header .links a:hover {
      color: var(--accent-cyan);
      background: rgba(0, 217, 255, 0.1);
    }
  </style>
</head>
<body>
  <div class="custom-header">
    <div class="logo">
      <span class="logo-icon">🔮</span>
      <span class="logo-text">ORACLE Alpha API</span>
    </div>
    <div class="links">
      <a href="/">Dashboard</a>
      <a href="/api/docs/openapi.json">OpenAPI JSON</a>
      <a href="/api/docs/openapi.yaml">OpenAPI YAML</a>
      <a href="https://github.com/dynamolabs/oracle-alpha" target="_blank">GitHub</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: 'StandaloneLayout',
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 3,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        persistAuthorization: true,
        displayRequestDuration: true
      });
    };
  </script>
</body>
</html>
`;

// ==========================================
// YAML Converter (simple implementation)
// ==========================================

function jsonToYaml(obj: any, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        yaml += `${spaces}-\n${jsonToYaml(item, indent + 1)}`;
      } else {
        yaml += `${spaces}- ${formatYamlValue(item)}\n`;
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) {
        yaml += `${spaces}${key}: null\n`;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          yaml += `${spaces}${key}: []\n`;
        } else {
          yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
        }
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
      } else {
        yaml += `${spaces}${key}: ${formatYamlValue(value)}\n`;
      }
    }
  }

  return yaml;
}

function formatYamlValue(value: any): string {
  if (typeof value === 'string') {
    if (value.includes('\n') || value.includes(':') || value.includes('#') || value.includes("'") || value.includes('"')) {
      return `|\n    ${value.split('\n').join('\n    ')}`;
    }
    if (value === '' || value === 'true' || value === 'false' || !isNaN(Number(value))) {
      return `'${value}'`;
    }
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return String(value);
}

// ==========================================
// Express Router for Swagger
// ==========================================

export function createSwaggerRouter(): Router {
  const router = Router();

  // Serve Swagger UI
  router.get('/', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(swaggerUiHtml);
  });

  // Serve OpenAPI spec as JSON
  router.get('/openapi.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(openApiSpec);
  });

  // Serve OpenAPI spec as YAML
  router.get('/openapi.yaml', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Disposition', 'attachment; filename=openapi.yaml');
    res.send(jsonToYaml(openApiSpec));
  });

  return router;
}

// ==========================================
// Export everything
// ==========================================

export default {
  openApiSpec,
  createSwaggerRouter,
  swaggerUiHtml
};
