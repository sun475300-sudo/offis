export type FailureMode = 'fail_fast' | 'fail_safe' | 'graceful_degradation' | 'circuit_breaker';
export type ProtectionLevel = 'none' | 'low' | 'medium' | 'high';

export interface FaultToleranceConfig {
  mode: FailureMode;
  protectionLevel: ProtectionLevel;
  timeout: number;
  fallbackEnabled: boolean;
  isolationEnabled: boolean;
}

export interface ProtectedOperation<T> {
  id: string;
  name: string;
  fn: () => Promise<T>;
  fallback?: () => Promise<T>;
  timeout?: number;
}

export interface FaultEvent {
  id: string;
  operationId: string;
  operationName: string;
  timestamp: number;
  error: string;
  handled: boolean;
  recoveryTime?: number;
}

export interface OperationResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  fallbackUsed: boolean;
  executionTime: number;
}

export class FaultTolerance {
  private static instance: FaultTolerance;
  private config: FaultToleranceConfig = {
    mode: 'graceful_degradation',
    protectionLevel: 'medium',
    timeout: 30000,
    fallbackEnabled: true,
    isolationEnabled: true
  };
  private operations: Map<string, ProtectedOperation<unknown>> = new Map();
  private faultEvents: FaultEvent[] = [];
  private errorCounts: Map<string, number> = new Map();
  private listeners: Set<(event: FaultEvent) => void> = new Set();
  private maxEvents = 200;

  private constructor() {}

  static getInstance(): FaultTolerance {
    if (!FaultTolerance.instance) {
      FaultTolerance.instance = new FaultTolerance();
    }
    return FaultTolerance.instance;
  }

  configure(config: Partial<FaultToleranceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  registerOperation<T>(id: string, name: string, fn: () => Promise<T>, fallback?: () => Promise<T>): void {
    this.operations.set(id, { id, name, fn, fallback });
  }

  unregisterOperation(id: string): boolean {
    this.errorCounts.delete(id);
    return this.operations.delete(id);
  }

  async execute<T>(operationId: string): Promise<OperationResult<T>> {
    const startTime = Date.now();
    const operation = this.operations.get(operationId) as ProtectedOperation<T>;

    if (!operation) {
      return {
        success: false,
        error: 'Operation not found',
        fallbackUsed: false,
        executionTime: Date.now() - startTime
      };
    }

    // Honor fail_fast mode: once an operation has exceeded its error
    // budget, short-circuit immediately instead of attempting fn()
    // again. Previously shouldFailFast existed but execute() never
    // consulted it, so configure({ mode: 'fail_fast' }) did nothing.
    if (this.shouldFailFast(operationId)) {
      return {
        success: false,
        error: 'Fail-fast threshold exceeded',
        fallbackUsed: false,
        executionTime: Date.now() - startTime
      };
    }

    try {
      const timeout = operation.timeout || this.config.timeout;
      const result = await this.executeWithTimeout(operation.fn, timeout);
      this.errorCounts.set(operationId, 0);

      return {
        success: true,
        result,
        fallbackUsed: false,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      const err = error as Error;
      this.recordFault(operationId, operation.name, err.message);

      if (this.config.fallbackEnabled && operation.fallback) {
        try {
          const fallbackResult = await operation.fallback();
          return {
            success: true,
            result: fallbackResult,
            fallbackUsed: true,
            executionTime: Date.now() - startTime
          };
        } catch (fallbackError) {
          return {
            success: false,
            error: `Fallback also failed: ${fallbackError}`,
            fallbackUsed: true,
            executionTime: Date.now() - startTime
          };
        }
      }

      return {
        success: false,
        error: err.message,
        fallbackUsed: false,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timerId = setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
        }),
      ]);
    } finally {
      // Cancel the timeout once the race settles so a flood of short,
      // successful operations doesn't leave pending timers behind.
      if (timerId !== undefined) clearTimeout(timerId);
    }
  }

  private recordFault(operationId: string, operationName: string, error: string): void {
    const count = this.errorCounts.get(operationId) || 0;
    this.errorCounts.set(operationId, count + 1);

    const operation = this.operations.get(operationId);
    // Only mark as handled when a fallback is both enabled *and*
    // actually exists for this operation. Previously the flag mirrored
    // config.fallbackEnabled blindly, making recoveryRate look healthy
    // even when no fallback could run.
    const handled = !!(this.config.fallbackEnabled && operation?.fallback);

    const event: FaultEvent = {
      id: `fault-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      operationId,
      operationName,
      timestamp: Date.now(),
      error,
      handled,
    };

    this.faultEvents.push(event);
    if (this.faultEvents.length > this.maxEvents) this.faultEvents.shift();
    this.notifyListeners(event);
  }

  getErrorCount(operationId: string): number {
    return this.errorCounts.get(operationId) || 0;
  }

  resetErrorCount(operationId: string): void {
    this.errorCounts.set(operationId, 0);
  }

  shouldFailFast(operationId: string): boolean {
    if (this.config.mode !== 'fail_fast') return false;
    const count = this.errorCounts.get(operationId) || 0;
    return count >= 5;
  }

  subscribe(listener: (event: FaultEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: FaultEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  getFaultEvents(operationId?: string, limit = 50): FaultEvent[] {
    let events = this.faultEvents;
    if (operationId) {
      events = events.filter(e => e.operationId === operationId);
    }
    return events.slice(-limit);
  }

  getStats(): {
    totalOperations: number;
    totalFaults: number;
    recoveryRate: number;
    errorRates: Record<string, number>;
  } {
    const handledCount = this.faultEvents.filter(e => e.handled).length;
    return {
      totalOperations: this.operations.size,
      totalFaults: this.faultEvents.length,
      recoveryRate: this.faultEvents.length > 0 ? handledCount / this.faultEvents.length : 1,
      errorRates: Object.fromEntries(this.errorCounts)
    };
  }

  clear(): void {
    this.faultEvents = [];
    this.errorCounts.clear();
  }

  export(): string {
    return JSON.stringify({
      config: this.config,
      stats: this.getStats(),
      events: this.faultEvents.slice(-50)
    }, null, 2);
  }
}

export const faultTolerance = FaultTolerance.getInstance();