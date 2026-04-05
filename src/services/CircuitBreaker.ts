export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface CircuitEvent {
  id: string;
  circuitId: string;
  state: CircuitState;
  timestamp: number;
  reason?: string;
}

export class CircuitBreaker {
  private static instance: CircuitBreaker;
  private circuits: Map<string, { state: CircuitState; failures: number; successes: number; lastFailure: number; nextAttempt: number }> = new Map();
  private config: Record<string, CircuitConfig> = {};
  private listeners: Map<string, Set<(event: CircuitEvent) => void>> = new Map();
  private events: CircuitEvent[] = [];
  private maxEvents = 200;

  private constructor() {
    this.config = {
      default: { failureThreshold: 5, successThreshold: 2, timeout: 60000, resetTimeout: 30000 }
    } as Record<string, CircuitConfig>;
  }

  static getInstance(): CircuitBreaker {
    if (!CircuitBreaker.instance) {
      CircuitBreaker.instance = new CircuitBreaker();
    }
    return CircuitBreaker.instance;
  }

  registerCircuit(circuitId: string, config?: Partial<CircuitConfig>): void {
    this.circuits.set(circuitId, {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailure: 0,
      nextAttempt: 0
    });
    if (config) {
      this.config[circuitId] = { ...this.config.default, ...config };
    } else {
      this.config[circuitId] = { ...this.config.default };
    }
  }

  unregisterCircuit(circuitId: string): boolean {
    delete this.config[circuitId];
    return this.circuits.delete(circuitId);
  }

  canExecute(circuitId: string): boolean {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) return true;

    const now = Date.now();
    if (circuit.state === 'open') {
      if (now >= circuit.nextAttempt) {
        this.transitionState(circuitId, 'half_open');
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(circuitId: string): void {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) return;

    const cfg = this.config[circuitId] || this.config.default;

    if (circuit.state === 'half_open') {
      circuit.successes++;
      if (circuit.successes >= cfg.successThreshold) {
        this.transitionState(circuitId, 'closed');
      }
    } else {
      circuit.failures = 0;
    }
  }

  recordFailure(circuitId: string, error?: string): void {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) return;

    const cfg = this.config[circuitId] || this.config.default;
    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.state === 'half_open') {
      this.transitionState(circuitId, 'open');
    } else if (circuit.failures >= cfg.failureThreshold) {
      this.transitionState(circuitId, 'open');
      circuit.nextAttempt = Date.now() + cfg.resetTimeout;
    }
  }

  private transitionState(circuitId: string, newState: CircuitState): void {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) return;

    const oldState = circuit.state;
    circuit.state = newState;

    if (newState === 'closed') {
      circuit.failures = 0;
      circuit.successes = 0;
    } else if (newState === 'open') {
      circuit.successes = 0;
    }

    const event: CircuitEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      circuitId,
      state: newState,
      timestamp: Date.now(),
      reason: `Transition from ${oldState} to ${newState}`
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.shift();
    this.notifyListeners(circuitId, event);
  }

  async execute<T>(circuitId: string, fn: () => Promise<T>): Promise<T> {
    if (!this.circuits.has(circuitId)) {
      this.registerCircuit(circuitId);
    }

    if (!this.canExecute(circuitId)) {
      throw new Error(`Circuit ${circuitId} is open`);
    }

    try {
      const result = await fn();
      this.recordSuccess(circuitId);
      return result;
    } catch (error) {
      this.recordFailure(circuitId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  getState(circuitId: string): CircuitState | null {
    return this.circuits.get(circuitId)?.state || null;
  }

  subscribe(circuitId: string, listener: (event: CircuitEvent) => void): () => void {
    if (!this.listeners.has(circuitId)) {
      this.listeners.set(circuitId, new Set());
    }
    this.listeners.get(circuitId)!.add(listener);
    return () => this.listeners.get(circuitId)?.delete(listener);
  }

  private notifyListeners(circuitId: string, event: CircuitEvent): void {
    const listeners = this.listeners.get(circuitId);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  getEvents(circuitId?: string, limit = 50): CircuitEvent[] {
    let events = this.events;
    if (circuitId) {
      events = events.filter(e => e.circuitId === circuitId);
    }
    return events.slice(-limit);
  }

  getStats(): { total: number; closed: number; open: number; half_open: number } {
    const stats = { total: this.circuits.size, closed: 0, open: 0, half_open: 0 };
    for (const circuit of this.circuits.values()) {
      stats[circuit.state]++;
    }
    return stats;
  }

  reset(circuitId?: string): void {
    if (circuitId) {
      const circuit = this.circuits.get(circuitId);
      if (circuit) {
        circuit.state = 'closed';
        circuit.failures = 0;
        circuit.successes = 0;
      }
    } else {
      for (const circuit of this.circuits.values()) {
        circuit.state = 'closed';
        circuit.failures = 0;
        circuit.successes = 0;
      }
    }
  }
}

export const circuitBreaker = CircuitBreaker.getInstance();