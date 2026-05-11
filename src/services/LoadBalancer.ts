export type BalancingStrategy = 'round_robin' | 'least_connections' | 'least_response_time' | 'weighted' | 'ip_hash';

export interface LoadBalancerConfig {
  strategy: BalancingStrategy;
  healthCheckInterval: number;
  maxFailures: number;
}

export interface AgentEndpoint {
  agentId: string;
  url: string;
  weight: number;
  activeConnections: number;
  totalRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  lastCheck: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
}

export class LoadBalancer {
  private static instance: LoadBalancer;
  private endpoints: Map<string, AgentEndpoint> = new Map();
  private config: LoadBalancerConfig = {
    strategy: 'least_connections',
    healthCheckInterval: 30000,
    maxFailures: 3
  };
  private healthCheckInterval: number | null = null;
  private listeners: Set<(endpoint: AgentEndpoint) => void> = new Set();
  // Rotating cursor for round-robin selection. Indexed by sorted id to
  // stay stable even as endpoints come and go.
  private roundRobinCursor = 0;

  private constructor() {}

  static getInstance(): LoadBalancer {
    if (!LoadBalancer.instance) {
      LoadBalancer.instance = new LoadBalancer();
    }
    return LoadBalancer.instance;
  }

  configure(config: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  registerEndpoint(agentId: string, url: string, weight = 1): void {
    this.endpoints.set(agentId, {
      agentId,
      url,
      weight,
      activeConnections: 0,
      totalRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      lastCheck: Date.now(),
      status: 'healthy'
    });
  }

  unregisterEndpoint(agentId: string): boolean {
    return this.endpoints.delete(agentId);
  }

  selectEndpoint(): AgentEndpoint | null {
    const healthy = Array.from(this.endpoints.values())
      .filter(e => e.status !== 'unhealthy');

    if (healthy.length === 0) return null;

    switch (this.config.strategy) {
      case 'round_robin':
        return this.roundRobin(healthy);
      case 'least_connections':
        return this.leastConnections(healthy);
      case 'least_response_time':
        return this.leastResponseTime(healthy);
      case 'weighted':
        return this.weighted(healthy);
      case 'ip_hash':
        return healthy[0];
      default:
        return healthy[0];
    }
  }

  private roundRobin(endpoints: AgentEndpoint[]): AgentEndpoint {
    // Previously this called Math.random — i.e. random selection, not
    // round-robin. Sort so add/remove of other endpoints doesn't cause
    // the cursor to jump unpredictably, then advance it.
    const sorted = [...endpoints].sort((a, b) => a.agentId.localeCompare(b.agentId));
    const idx = this.roundRobinCursor % sorted.length;
    this.roundRobinCursor = (this.roundRobinCursor + 1) % Number.MAX_SAFE_INTEGER;
    return sorted[idx];
  }

  private leastConnections(endpoints: AgentEndpoint[]): AgentEndpoint {
    return endpoints.reduce((min, e) => e.activeConnections < min.activeConnections ? e : min);
  }

  private leastResponseTime(endpoints: AgentEndpoint[]): AgentEndpoint {
    return endpoints.reduce((min, e) => e.avgResponseTime < min.avgResponseTime ? e : min);
  }

  private weighted(endpoints: AgentEndpoint[]): AgentEndpoint {
    const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) return endpoint;
    }
    return endpoints[0];
  }

  recordRequest(agentId: string): void {
    const endpoint = this.endpoints.get(agentId);
    if (endpoint) {
      endpoint.activeConnections++;
      endpoint.totalRequests++;
    }
  }

  recordResponse(agentId: string, responseTime: number, success: boolean): void {
    const endpoint = this.endpoints.get(agentId);
    if (!endpoint) return;

    endpoint.activeConnections = Math.max(0, endpoint.activeConnections - 1);

    if (!success) {
      endpoint.failedRequests++;
      if (endpoint.failedRequests >= this.config.maxFailures) {
        endpoint.status = 'unhealthy';
      }
    } else {
      endpoint.avgResponseTime = (endpoint.avgResponseTime * 0.9) + (responseTime * 0.1);
      // Decay failure count on success so endpoints can recover instead of
      // being marked unhealthy forever.
      endpoint.failedRequests = Math.max(0, endpoint.failedRequests - 1);
      if (endpoint.status === 'degraded' && endpoint.failedRequests < this.config.maxFailures) {
        endpoint.status = 'healthy';
      }
    }
  }

  getEndpoint(agentId: string): AgentEndpoint | undefined {
    return this.endpoints.get(agentId);
  }

  getAllEndpoints(): AgentEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  getHealthyEndpoints(): AgentEndpoint[] {
    return Array.from(this.endpoints.values()).filter(e => e.status !== 'unhealthy');
  }

  startHealthCheck(checkFn: (endpoint: AgentEndpoint) => Promise<boolean>): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = window.setInterval(async () => {
      for (const endpoint of this.endpoints.values()) {
        try {
          const isHealthy = await checkFn(endpoint);
          endpoint.lastCheck = Date.now();
          if (isHealthy) {
            // Decay the failure counter on each healthy probe so an
            // endpoint that had transient failures can recover. Previously
            // status stayed 'degraded' forever as long as failedRequests
            // was ever > 0.
            endpoint.failedRequests = Math.max(0, endpoint.failedRequests - 1);
            endpoint.status = endpoint.failedRequests > 0 ? 'degraded' : 'healthy';
          } else {
            endpoint.failedRequests++;
            if (endpoint.failedRequests >= this.config.maxFailures) {
              endpoint.status = 'unhealthy';
            }
          }
          this.notifyListeners(endpoint);
        } catch {
          // Match the !isHealthy branch — increment failure counter so
          // transient throws accumulate toward the unhealthy threshold
          // instead of flipping straight to unhealthy from a single
          // hiccup.
          endpoint.failedRequests++;
          if (endpoint.failedRequests >= this.config.maxFailures) {
            endpoint.status = 'unhealthy';
          }
          endpoint.lastCheck = Date.now();
          this.notifyListeners(endpoint);
        }
      }
    }, this.config.healthCheckInterval);
  }

  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  subscribe(listener: (endpoint: AgentEndpoint) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(endpoint: AgentEndpoint): void {
    for (const listener of this.listeners) {
      listener(endpoint);
    }
  }

  getStats(): { total: number; healthy: number; degraded: number; unhealthy: number; totalRequests: number } {
    const stats = { total: this.endpoints.size, healthy: 0, degraded: 0, unhealthy: 0, totalRequests: 0 };
    for (const endpoint of this.endpoints.values()) {
      stats[endpoint.status]++;
      stats.totalRequests += endpoint.totalRequests;
    }
    return stats;
  }
}

export const loadBalancer = LoadBalancer.getInstance();