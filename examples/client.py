#!/usr/bin/env python3
"""
ORACLE Alpha Python Client Example
Demonstrates how to interact with the API
"""

import os
import json
import asyncio
import websockets
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_URL = os.environ.get('ORACLE_API_URL', 'http://localhost:3900')


@dataclass
class Signal:
    id: str
    symbol: str
    name: str
    token: str
    score: int
    risk_level: str
    timestamp: int
    recommendation: str


class OracleClient:
    """ORACLE Alpha REST API Client"""
    
    def __init__(self, base_url: str = API_URL, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
    
    def _request(self, endpoint: str) -> Dict[str, Any]:
        """Make HTTP request to API"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        
        req = Request(url, headers=headers)
        
        try:
            with urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode())
        except HTTPError as e:
            raise Exception(f"API error: {e.code} {e.reason}")
    
    def health_check(self) -> Dict[str, Any]:
        """Check API health"""
        return self._request('/health')
    
    def get_signals(
        self, 
        min_score: Optional[int] = None, 
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get trading signals"""
        params = []
        if min_score:
            params.append(f"minScore={min_score}")
        params.append(f"limit={limit}")
        
        query = '?' + '&'.join(params) if params else ''
        return self._request(f'/api/signals{query}')
    
    def get_signal(self, signal_id: str) -> Dict[str, Any]:
        """Get single signal by ID"""
        return self._request(f'/api/signals/{signal_id}')
    
    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        return self._request('/api/stats')
    
    def get_leaderboard(self) -> Dict[str, Any]:
        """Get top performing signals"""
        return self._request('/api/leaderboard')
    
    def get_tiers(self) -> Dict[str, Any]:
        """Get subscription tiers"""
        return self._request('/api/subscription/tiers')
    
    def check_subscription(self, wallet: str) -> Dict[str, Any]:
        """Check subscription status for wallet"""
        return self._request(f'/api/subscription/{wallet}')
    
    def get_gainers(self) -> Dict[str, Any]:
        """Get recent top gainers"""
        return self._request('/api/gainers')
    
    def get_demo_status(self) -> Dict[str, Any]:
        """Get demo mode status"""
        return self._request('/api/demo/status')
    
    def _post(self, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make POST request to API"""
        from urllib.request import Request, urlopen
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        body = json.dumps(data).encode() if data else None
        req = Request(url, data=body, headers=headers, method='POST')
        with urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    
    def start_demo(self, signals_per_minute: int = 4) -> Dict[str, Any]:
        """Start demo mode signal generator"""
        return self._post('/api/demo/start', {'signalsPerMinute': signals_per_minute})
    
    def stop_demo(self) -> Dict[str, Any]:
        """Stop demo mode"""
        return self._post('/api/demo/stop')
    
    def seed_historical(self, count: int = 30) -> Dict[str, Any]:
        """Seed historical signals for demo"""
        return self._post('/api/demo/seed', {'count': count})


class OracleWebSocket:
    """ORACLE Alpha WebSocket Client for real-time signals"""
    
    def __init__(
        self, 
        url: str = API_URL.replace('http', 'ws') + '/ws',
        on_signal: Optional[Callable[[Dict], None]] = None
    ):
        self.url = url
        self.on_signal = on_signal or self._default_handler
        self.running = False
    
    def _default_handler(self, signal: Dict) -> None:
        print(f"New signal: ${signal.get('symbol')} - Score: {signal.get('score')}")
    
    async def connect(self):
        """Connect to WebSocket and listen for signals"""
        self.running = True
        
        while self.running:
            try:
                async with websockets.connect(self.url) as ws:
                    print(f"Connected to {self.url}")
                    
                    async for message in ws:
                        data = json.loads(message)
                        if data.get('type') == 'signal':
                            self.on_signal(data.get('data', {}))
                        elif data.get('type') == 'history':
                            print(f"Received {len(data.get('data', []))} historical signals")
            
            except websockets.ConnectionClosed:
                print("Connection closed, reconnecting...")
                await asyncio.sleep(2)
            except Exception as e:
                print(f"Error: {e}")
                await asyncio.sleep(5)
    
    def disconnect(self):
        """Stop the WebSocket connection"""
        self.running = False


def main():
    """Example usage"""
    client = OracleClient()
    
    print("🔮 ORACLE Alpha Python Client Example\n")
    
    # 1. Health check
    print("1. Checking health...")
    health = client.health_check()
    print(f"   Status: {health['status']}")
    print(f"   Signals: {health['signals']}")
    print(f"   Uptime: {int(health['uptime'])}s\n")
    
    # 2. Get top signals
    print("2. Getting top signals (score >= 70)...")
    response = client.get_signals(min_score=70, limit=5)
    print(f"   Found {response['count']} signals:")
    for signal in response['signals']:
        print(f"   • ${signal['symbol']} - Score: {signal['score']} ({signal['riskLevel']})")
    print()
    
    # 3. Get stats
    print("3. Getting performance stats...")
    stats = client.get_stats()
    print(f"   Total signals: {stats['totalSignals']}")
    print(f"   Win rate: {stats['winRate']}%")
    print(f"   Avg score: {stats['avgScore']}\n")
    
    # 4. Get tiers
    print("4. Getting subscription tiers...")
    tiers = client.get_tiers()
    for tier in tiers['tiers']:
        print(f"   • {tier['name']}: ${tier['price']}/mo - Score {tier['minScore']}+")
    print()
    
    print("5. WebSocket example:")
    print("   async def on_signal(signal):")
    print("       print(f'New: ${signal[\"symbol\"]} - {signal[\"score\"]}')")
    print("   ws = OracleWebSocket(on_signal=on_signal)")
    print("   asyncio.run(ws.connect())")


if __name__ == '__main__':
    main()
