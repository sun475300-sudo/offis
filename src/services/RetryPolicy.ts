export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: string[];
}

export interface RetryAttempt {
  attempt: number;
  delay: number;
  timestamp: number;
  error?: string;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  attempts: RetryAttempt[];
  totalTime: number;
  error?: string;
}

export class RetryPolicy {
  private static instance: RetryPolicy;
  private configs: Map<string, RetryConfig> = new Map();
  private defaultConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true
  };

  private constructor() {}

  static getInstance(): RetryPolicy {
    if (!RetryPolicy.instance) {
      RetryPolicy.instance = new RetryPolicy();
    }
    return RetryPolicy.instance;
  }

  registerPolicy(policyId: string, config: Partial<RetryConfig>): void {
    this.configs.set(policyId, { ...this.defaultConfig, ...config });
  }

  removePolicy(policyId: string): boolean {
    return this.configs.delete(policyId);
  }

  async execute<T>(
    fn: () => Promise<T>,
    policyId?: string,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<RetryResult<T>> {
    const config = policyId ? this.configs.get(policyId) || this.defaultConfig : this.defaultConfig;
    const attempts: RetryAttempt[] = [];
    const startTime = Date.now();

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      const attemptStart = Date.now();

      try {
        const result = await fn();
        return {
          success: true,
          result,
          attempts: [...attempts, { attempt, delay: Date.now() - attemptStart, timestamp: Date.now() }],
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        const err = error as Error;
        const attemptInfo: RetryAttempt = {
          attempt,
          delay: Date.now() - attemptStart,
          timestamp: Date.now(),
          error: err.message
        };
        attempts.push(attemptInfo);

        if (attempt >= config.maxAttempts) {
          return {
            success: false,
            attempts,
            totalTime: Date.now() - startTime,
            error: err.message
          };
        }

        if (onRetry) {
          onRetry(attempt, err);
        }

        const delay = this.calculateDelay(attempt, config);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      attempts,
      totalTime: Date.now() - startTime,
      error: 'Max attempts exceeded'
    };
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = Math.min(
      config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelay
    );

    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>,
    policyId?: string
  ): Promise<RetryResult<T>> {
    const result = await this.execute(fn, policyId);
    if (!result.success) {
      try {
        const fallbackResult = await fallback();
        return { ...result, success: true, result: fallbackResult };
      } catch (fallbackError) {
        return { ...result, error: (fallbackError as Error).message };
      }
    }
    return result;
  }

  getConfig(policyId: string): RetryConfig | undefined {
    return this.configs.get(policyId);
  }

  getAllPolicies(): string[] {
    return Array.from(this.configs.keys());
  }

  setDefaultConfig(config: Partial<RetryConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  getDefaultConfig(): RetryConfig {
    return { ...this.defaultConfig };
  }
}

export const retryPolicy = RetryPolicy.getInstance();