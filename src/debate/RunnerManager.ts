export interface TestRunner {
  id: string;
  name: string;
  type: 'windows' | 'linux' | 'macos' | 'steamdeck' | 'custom';
  status: 'idle' | 'running' | 'error' | 'offline';
  currentTask?: string;
  lastHeartbeat: number;
  specs: {
    cpu: string;
    gpu: string;
    ram: string;
  };
}

export interface TestResult {
  id: string;
  runnerId: string;
  status: 'success' | 'failure' | 'timeout';
  startTime: number;
  endTime: number;
  logs: string[];
  metrics: {
    fps?: number;
    frameDropRate?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  errors: TestError[];
}

export interface TestError {
  type: string;
  message: string;
  line?: number;
  file?: string;
  stackTrace?: string;
}

export enum FeedbackLoopState {
  Idle = 'idle',
  SubmitCode = 'submit_code',
  RunningTest = 'running_test',
  AnalyzingResults = 'analyzing_results',
  FixingCode = 'fixing_code',
  Retesting = 'retesting',
  Complete = 'complete',
  Failed = 'failed',
}

export interface FeedbackLoop {
  id: string;
  state: FeedbackLoopState;
  projectName: string;
  code: string;
  iteration: number;
  maxIterations: number;
  targetMetrics: {
    minFps?: number;
    maxFrameDrop?: number;
    maxMemory?: number;
  };
  testResults: TestResult[];
  fixAttempts: number;
  startedAt: number;
  completedAt?: number;
}

export class RunnerManager {
  private runners: Map<string, TestRunner> = new Map();
  private testResults: Map<string, TestResult> = new Map();
  private feedbackLoops: Map<string, FeedbackLoop> = new Map();
  private readonly maxTestResults = 500;
  private readonly maxFeedbackLoops = 100;

  constructor() {
    this.initDefaultRunners();
  }

  private initDefaultRunners(): void {
    const defaultRunners: TestRunner[] = [
      {
        id: 'runner-01',
        name: 'Windows Gaming PC',
        type: 'windows',
        status: 'idle',
        lastHeartbeat: Date.now(),
        specs: { cpu: 'i5-12400', gpu: 'RTX 3060', ram: '16GB' },
      },
      {
        id: 'runner-02',
        name: 'Low-Spec Laptop',
        type: 'windows',
        status: 'idle',
        lastHeartbeat: Date.now(),
        specs: { cpu: 'i3-1115G4', gpu: 'Intel UHD', ram: '8GB' },
      },
      {
        id: 'runner-03',
        name: 'Steam Deck',
        type: 'steamdeck',
        status: 'idle',
        lastHeartbeat: Date.now(),
        specs: { cpu: 'AMD APU', gpu: 'RDNA 2', ram: '16GB' },
      },
      {
        id: 'runner-04',
        name: 'Linux Server',
        type: 'linux',
        status: 'idle',
        lastHeartbeat: Date.now(),
        specs: { cpu: 'AMD Ryzen 5', gpu: 'None', ram: '32GB' },
      },
    ];

    for (const runner of defaultRunners) {
      this.runners.set(runner.id, runner);
    }
  }

  registerRunner(runner: TestRunner): void {
    this.runners.set(runner.id, runner);
  }

  getRunner(id: string): TestRunner | undefined {
    return this.runners.get(id);
  }

  getAllRunners(): TestRunner[] {
    return Array.from(this.runners.values());
  }

  getActiveRunners(): TestRunner[] {
    return this.getAllRunners().filter(r => r.status !== 'offline');
  }

  async submitTest(runnerId: string, code: string): Promise<TestResult> {
    const runner = this.runners.get(runnerId);
    if (!runner) throw new Error('Runner not found');

    runner.status = 'running';
    runner.currentTask = '테스트 실행 중';

    await this.delay(500);

    const hasError = Math.random() > 0.7;
    const result: TestResult = {
      id: `result-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      runnerId,
      status: hasError ? 'failure' : 'success',
      startTime: Date.now(),
      endTime: Date.now() + 3000,
      logs: [
        `[${new Date().toISOString()}] 테스트 시작`,
        `[${new Date().toISOString()}] 빌드 중...`,
        hasError
          ? `[${new Date().toISOString()}] 에러 발생: ${this.generateRandomError()}`
          : `[${new Date().toISOString()}] 모든 테스트 통과`,
      ],
      metrics: {
        fps: hasError ? 45 + Math.random() * 20 : 58 + Math.random() * 2,
        frameDropRate: hasError ? 0.05 + Math.random() * 0.1 : Math.random() * 0.01,
        memoryUsage: 500 + Math.random() * 200,
        cpuUsage: 30 + Math.random() * 40,
      },
      errors: hasError
        ? [
            {
              type: 'RuntimeError',
              message: this.generateRandomError(),
              line: Math.floor(Math.random() * 100) + 1,
              file: 'main.ts',
            },
          ]
        : [],
    };

    this.testResults.set(result.id, result);
    // Evict oldest by insertion order so the history doesn't grow without bound.
    if (this.testResults.size > this.maxTestResults) {
      const toDrop = this.testResults.size - this.maxTestResults;
      const iter = this.testResults.keys();
      for (let i = 0; i < toDrop; i++) {
        const key = iter.next().value;
        if (key === undefined) break;
        this.testResults.delete(key);
      }
    }
    runner.status = hasError ? 'error' : 'idle';
    runner.currentTask = undefined;

    return result;
  }

  async startFeedbackLoop(
    projectName: string,
    code: string,
    runnerId: string,
    targetMetrics: { minFps?: number; maxFrameDrop?: number; maxMemory?: number }
  ): Promise<FeedbackLoop> {
    const loopId = `loop-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const loop: FeedbackLoop = {
      id: loopId,
      state: FeedbackLoopState.Idle,
      projectName,
      code,
      iteration: 0,
      maxIterations: 5,
      targetMetrics,
      testResults: [],
      fixAttempts: 0,
      startedAt: Date.now(),
    };

    this.feedbackLoops.set(loopId, loop);
    if (this.feedbackLoops.size > this.maxFeedbackLoops) {
      const toDrop = this.feedbackLoops.size - this.maxFeedbackLoops;
      const iter = this.feedbackLoops.keys();
      for (let i = 0; i < toDrop; i++) {
        const key = iter.next().value;
        if (key === undefined) break;
        this.feedbackLoops.delete(key);
      }
    }
    return loop;
  }

  async runFeedbackCycle(loopId: string): Promise<FeedbackLoop> {
    const loop = this.feedbackLoops.get(loopId);
    if (!loop) throw new Error('Loop not found');

    loop.state = FeedbackLoopState.SubmitCode;

    for (let i = 0; i < loop.maxIterations; i++) {
      loop.iteration = i + 1;
      loop.state = FeedbackLoopState.RunningTest;

      const availableRunner = this.getAllRunners().find(r => r.status === 'idle');
      if (!availableRunner) {
        loop.state = FeedbackLoopState.Failed;
        break;
      }

      const result = await this.submitTest(availableRunner.id, loop.code);
      loop.testResults.push(result);

      if (result.status === 'success') {
        loop.state = FeedbackLoopState.Complete;
        loop.completedAt = Date.now();
        break;
      }

      loop.state = FeedbackLoopState.AnalyzingResults;
      await this.delay(200);

      loop.state = FeedbackLoopState.FixingCode;
      loop.fixAttempts++;
      loop.code = this.mockCodeFix(loop.code, result.errors);
      await this.delay(300);

      loop.state = FeedbackLoopState.Retesting;
    }

    if (loop.state !== FeedbackLoopState.Complete) {
      loop.state = FeedbackLoopState.Failed;
    }

    return loop;
  }

  private mockCodeFix(code: string, errors: TestError[]): string {
    const fixedCode = code + `\n// Fixed: ${errors.map(e => e.message).join(', ')}`;
    return fixedCode;
  }

  private generateRandomError(): string {
    const errors = [
      'NullReferenceException: Cannot read property of undefined',
      'TypeError: Cannot read properties of null',
      'RangeError: Maximum call stack size exceeded',
      'SyntaxError: Unexpected token',
      'NetworkError: Failed to fetch',
      'OutOfMemoryError: Heap limit exceeded',
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  }

  getLoop(id: string): FeedbackLoop | undefined {
    return this.feedbackLoops.get(id);
  }

  getAllLoops(): FeedbackLoop[] {
    return Array.from(this.feedbackLoops.values());
  }

  getStats() {
    return {
      totalRunners: this.runners.size,
      activeRunners: this.getActiveRunners().length,
      totalTests: this.testResults.size,
      runningLoops: this.getAllLoops().filter(l => l.state !== FeedbackLoopState.Complete && l.state !== FeedbackLoopState.Failed).length,
      completedLoops: this.getAllLoops().filter(l => l.state === FeedbackLoopState.Complete).length,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
