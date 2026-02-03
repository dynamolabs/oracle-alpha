/**
 * Health Check System
 * Provides detailed health status for monitoring
 */

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version: string;
  checks: {
    api: ComponentHealth;
    database: ComponentHealth;
    onchain: ComponentHealth;
    external: ComponentHealth;
  };
  metrics: {
    requestsPerMinute: number;
    errorRate: number;
    avgResponseTime: number;
    activeConnections: number;
  };
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
  lastCheck: number;
}

// Health state
let healthState: HealthStatus = {
  status: 'healthy',
  timestamp: Date.now(),
  uptime: 0,
  version: '1.0.0',
  checks: {
    api: { status: 'up', lastCheck: Date.now() },
    database: { status: 'up', lastCheck: Date.now(), message: 'In-memory store' },
    onchain: { status: 'down', lastCheck: Date.now(), message: 'Not initialized' },
    external: { status: 'up', lastCheck: Date.now() }
  },
  metrics: {
    requestsPerMinute: 0,
    errorRate: 0,
    avgResponseTime: 0,
    activeConnections: 0
  }
};

// Request tracking
let requestCount = 0;
let errorCount = 0;
let totalResponseTime = 0;
let lastMinuteReset = Date.now();

// Update request metrics
export function trackRequest(responseTime: number, isError: boolean): void {
  requestCount++;
  totalResponseTime += responseTime;
  if (isError) errorCount++;

  // Reset every minute
  if (Date.now() - lastMinuteReset > 60000) {
    healthState.metrics.requestsPerMinute = requestCount;
    healthState.metrics.errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
    healthState.metrics.avgResponseTime = requestCount > 0 ? totalResponseTime / requestCount : 0;

    requestCount = 0;
    errorCount = 0;
    totalResponseTime = 0;
    lastMinuteReset = Date.now();
  }
}

// Update component health
export function updateComponentHealth(
  component: keyof HealthStatus['checks'],
  status: ComponentHealth['status'],
  latency?: number,
  message?: string
): void {
  healthState.checks[component] = {
    status,
    latency,
    message,
    lastCheck: Date.now()
  };

  // Update overall status
  updateOverallStatus();
}

// Update active connections
export function setActiveConnections(count: number): void {
  healthState.metrics.activeConnections = count;
}

// Update overall health status
function updateOverallStatus(): void {
  const checks = Object.values(healthState.checks);
  const downCount = checks.filter(c => c.status === 'down').length;
  const degradedCount = checks.filter(c => c.status === 'degraded').length;

  if (downCount >= 2) {
    healthState.status = 'unhealthy';
  } else if (downCount > 0 || degradedCount > 0) {
    healthState.status = 'degraded';
  } else {
    healthState.status = 'healthy';
  }

  healthState.timestamp = Date.now();
  healthState.uptime = process.uptime();
}

// Get full health status
export function getHealthStatus(): HealthStatus {
  healthState.uptime = process.uptime();
  healthState.timestamp = Date.now();
  return { ...healthState };
}

// Simple health check (for load balancers)
export function isHealthy(): boolean {
  return healthState.status !== 'unhealthy';
}

// Readiness check (for k8s)
export function isReady(): boolean {
  return healthState.checks.api.status === 'up';
}

// Liveness check (for k8s)
export function isLive(): boolean {
  return process.uptime() > 0;
}

// Check external dependencies
export async function checkExternalServices(): Promise<void> {
  // Check Helius API
  try {
    const start = Date.now();
    const response = await fetch('https://api.helius.xyz/v0/addresses?api-key=test', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    const latency = Date.now() - start;
    updateComponentHealth('external', response.ok ? 'up' : 'degraded', latency);
  } catch {
    updateComponentHealth('external', 'degraded', undefined, 'Helius API unreachable');
  }
}

// Graceful shutdown handler
let isShuttingDown = false;

export function initiateShutdown(): void {
  isShuttingDown = true;
  healthState.status = 'unhealthy';
  updateComponentHealth('api', 'down', undefined, 'Shutting down');
}

export function isShutdownInitiated(): boolean {
  return isShuttingDown;
}
