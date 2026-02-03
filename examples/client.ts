/**
 * ORACLE Alpha Client Example
 * Demonstrates how to interact with the API
 */

/* eslint-disable no-undef */

const API_URL = process.env.ORACLE_API_URL || 'http://localhost:3900';

// Types
interface Signal {
  id: string;
  symbol: string;
  name: string;
  token: string;
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  timestamp: number;
  analysis: {
    recommendation: string;
    narrative: string[];
    strengths: string[];
    weaknesses: string[];
  };
}

interface SignalResponse {
  count: number;
  signals: Signal[];
}

// ORACLE Alpha Client
class OracleClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = API_URL, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, { headers });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Get top signals
  async getSignals(options: { minScore?: number; limit?: number } = {}): Promise<SignalResponse> {
    const params = new URLSearchParams();
    if (options.minScore) params.append('minScore', options.minScore.toString());
    if (options.limit) params.append('limit', options.limit.toString());

    const query = params.toString() ? `?${params}` : '';
    return this.fetch<SignalResponse>(`/api/signals${query}`);
  }

  // Get single signal
  async getSignal(id: string): Promise<Signal> {
    return this.fetch<Signal>(`/api/signals/${id}`);
  }

  // Get performance stats
  async getStats(): Promise<any> {
    return this.fetch('/api/stats');
  }

  // Get leaderboard
  async getLeaderboard(): Promise<any> {
    return this.fetch('/api/leaderboard');
  }

  // Get subscription tiers
  async getTiers(): Promise<any> {
    return this.fetch('/api/subscription/tiers');
  }

  // Check subscription status
  async checkSubscription(wallet: string): Promise<any> {
    return this.fetch(`/api/subscription/${wallet}`);
  }

  // Health check
  async healthCheck(): Promise<any> {
    return this.fetch('/health');
  }

  // Demo mode controls
  async getDemoStatus(): Promise<any> {
    return this.fetch('/api/demo/status');
  }

  async startDemo(signalsPerMinute: number = 4): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/demo/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalsPerMinute })
    });
    return response.json();
  }

  async stopDemo(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/demo/stop`, {
      method: 'POST'
    });
    return response.json();
  }

  async seedHistorical(count: number = 30): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/demo/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count })
    });
    return response.json();
  }
}

// WebSocket Client for real-time signals
class OracleWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onSignal: (signal: Signal) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(
    url: string = API_URL.replace('http', 'ws') + '/ws',
    onSignal: (signal: Signal) => void
  ) {
    this.url = url;
    this.onSignal = onSignal;
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'signal') {
          this.onSignal(data.data);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };

    this.ws.onerror = error => {
      console.error('WebSocket error:', error);
    };
  }

  private reconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Example usage
async function main() {
  const client = new OracleClient();

  console.log('🔮 ORACLE Alpha Client Example\n');

  // 1. Health check
  console.log('1. Checking health...');
  const health = await client.healthCheck();
  console.log(`   Status: ${health.status}`);
  console.log(`   Signals: ${health.signals}`);
  console.log(`   Uptime: ${Math.floor(health.uptime)}s\n`);

  // 2. Get top signals
  console.log('2. Getting top signals (score >= 70)...');
  const signals = await client.getSignals({ minScore: 70, limit: 5 });
  console.log(`   Found ${signals.count} signals:`);
  for (const signal of signals.signals) {
    console.log(`   • $${signal.symbol} - Score: ${signal.score} (${signal.riskLevel})`);
  }
  console.log('');

  // 3. Get stats
  console.log('3. Getting performance stats...');
  const stats = await client.getStats();
  console.log(`   Total signals: ${stats.totalSignals}`);
  console.log(`   Win rate: ${stats.winRate}%`);
  console.log(`   Avg score: ${stats.avgScore}\n`);

  // 4. Get tiers
  console.log('4. Getting subscription tiers...');
  const tiers = await client.getTiers();
  for (const tier of tiers.tiers) {
    console.log(`   • ${tier.name}: $${tier.price}/mo - Score ${tier.minScore}+`);
  }
  console.log('');

  // 5. WebSocket example (commented out for CLI)
  console.log('5. WebSocket example:');
  console.log('   const ws = new OracleWebSocket(url, (signal) => {');
  console.log('     console.log("New signal:", signal.symbol, signal.score);');
  console.log('   });');
  console.log('   ws.connect();');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { OracleClient, OracleWebSocket };
