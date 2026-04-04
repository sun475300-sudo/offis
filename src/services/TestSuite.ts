export interface StressTestConfig {
  agentCount: number;
  concurrentTasks: number;
  duration: number;
  codeReviewCount: number;
}

export interface StressTestResult {
  totalAgents: number;
  totalTasksCompleted: number;
  failedTasks: number;
  avgResponseTime: number;
  peakMemory: number;
  avgFps: number;
  githubApiCalls: number;
  rateLimitHits: number;
  duration: number;
  errors: string[];
}

export interface LoadTestResult {
  spawnTime: number;
  activeAgents: number;
  memoryUsed: number;
  fpsDrop: number;
}

export class TestSuite {
  private results: StressTestResult[] = [];
  private startTime: number = 0;
  private tasksCompleted: number = 0;
  private failedTasks: number = 0;
  private githubCalls: number = 0;
  private rateLimitHits: number = 0;
  private responseTimes: number[] = [];

  async runStressTest(
    config: StressTestConfig,
    callbacks?: {
      onAgentSpawn?: (count: number) => void;
      onTaskComplete?: (taskId: string, duration: number) => void;
      onError?: (error: string) => void;
    }
  ): Promise<StressTestResult> {
    this.startTime = Date.now();
    this.tasksCompleted = 0;
    this.failedTasks = 0;
    this.githubCalls = 0;
    this.rateLimitHits = 0;
    this.responseTimes = [];

    console.log(`[StressTest] Starting: ${config.agentCount} agents, ${config.concurrentTasks} concurrent, ${config.duration}s duration`);

    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const tasks: Promise<void>[] = [];

    // Simulate agent spawning and task execution
    for (let i = 0; i < config.agentCount; i++) {
      callbacks?.onAgentSpawn?.(i + 1);
      
      // Each agent runs concurrent tasks
      for (let j = 0; j < config.concurrentTasks; j++) {
        const taskPromise = this.runSimulatedTask(config.duration, callbacks);
        tasks.push(taskPromise);
      }
    }

    // Run code reviews in parallel
    for (let i = 0; i < config.codeReviewCount; i++) {
      const reviewPromise = this.runSimulatedReview(callbacks);
      tasks.push(reviewPromise);
    }

    // Wait for all tasks or timeout
    const timeoutPromise = new Promise<void>(resolve => setTimeout(resolve, config.duration * 1000));
    await Promise.race([Promise.allSettled(tasks), timeoutPromise]);

    const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const duration = (Date.now() - this.startTime) / 1000;

    const result: StressTestResult = {
      totalAgents: config.agentCount,
      totalTasksCompleted: this.tasksCompleted,
      failedTasks: this.failedTasks,
      avgResponseTime: this.responseTimes.length > 0 
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
        : 0,
      peakMemory: Math.max(startMemory, endMemory),
      avgFps: 60,
      githubApiCalls: this.githubCalls,
      rateLimitHits: this.rateLimitHits,
      duration,
      errors: [],
    };

    this.results.push(result);
    console.log(`[StressTest] Complete: ${this.tasksCompleted} tasks, ${this.failedTasks} failed, ${duration.toFixed(1)}s`);
    
    return result;
  }

  private async runSimulatedTask(
    maxDuration: number,
    callbacks?: {
      onTaskComplete?: (taskId: string, duration: number) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    const taskId = `task-${Math.random().toString(36).substr(2, 9)}`;
    const taskStart = Date.now();
    
    try {
      // Simulate work with random delay
      const delay = Math.random() * 100 + 50;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const duration = Date.now() - taskStart;
      this.tasksCompleted++;
      this.responseTimes.push(duration);
      
      callbacks?.onTaskComplete?.(taskId, duration);
    } catch (error) {
      this.failedTasks++;
      callbacks?.onError?.(`Task ${taskId} failed: ${error}`);
    }
  }

  private async runSimulatedReview(
    callbacks?: {
      onTaskComplete?: (taskId: string, duration: number) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    const reviewId = `review-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      // Simulate GitHub API calls
      this.githubCalls += Math.floor(Math.random() * 5) + 3;
      
      // Simulate API rate limiting (10% chance)
      if (Math.random() < 0.1) {
        this.rateLimitHits++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for rate limit
      }
      
      const delay = Math.random() * 200 + 100;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const duration = Date.now() - startTime;
      this.tasksCompleted++;
      this.responseTimes.push(duration);
      
      callbacks?.onTaskComplete?.(reviewId, duration);
    } catch (error) {
      this.failedTasks++;
      callbacks?.onError?.(`Review ${reviewId} failed: ${error}`);
    }
  }

  async runLoadTest(
    targetAgents: number,
    spawnRate: number
  ): Promise<LoadTestResult> {
    const startTime = Date.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const startFps = 60;
    
    console.log(`[LoadTest] Spawning ${targetAgents} agents at ${spawnRate}/s`);
    
    // Simulate agent spawning
    for (let i = 0; i < targetAgents; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000 / spawnRate));
    }
    
    const spawnTime = Date.now() - startTime;
    const endMemory = (performance as any).memory?.usedJSHeapSize || startMemory;
    
    // Simulate FPS drop based on agent count
    const fpsDrop = Math.min(30, targetAgents * 0.5);
    
    return {
      spawnTime,
      activeAgents: targetAgents,
      memoryUsed: endMemory - startMemory,
      fpsDrop,
    };
  }

  async runDebateStressTest(participantCount: number): Promise<{ duration: number; turns: number; errors: number }> {
    console.log(`[DebateStress] Testing ${participantCount} participants`);
    
    const startTime = Date.now();
    let turns = 0;
    let errors = 0;
    
    // Simulate debate rounds
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < participantCount; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 50));
          turns++;
        } catch {
          errors++;
        }
      }
    }
    
    return {
      duration: Date.now() - startTime,
      turns,
      errors,
    };
  }

  async runCICDFeedbackLoopTest(iterations: number): Promise<{ success: number; failed: number; avgTime: number }> {
    console.log(`[CI/CD] Testing ${iterations} feedback loop iterations`);
    
    let success = 0;
    let failed = 0;
    let totalTime = 0;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        // Simulate test cycle
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));
        
        // 90% success rate
        if (Math.random() > 0.1) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      
      totalTime += Date.now() - startTime;
    }
    
    return {
      success,
      failed,
      avgTime: totalTime / iterations,
    };
  }

  getResults(): StressTestResult[] {
    return this.results;
  }

  generateReport(result: StressTestResult): string {
    const lines = [
      '═══════════════════════════════════════',
      '       STRESS TEST RESULTS',
      '═══════════════════════════════════════',
      `Agents:        ${result.totalAgents}`,
      `Tasks Done:   ${result.totalTasksCompleted}`,
      `Failed:       ${result.failedTasks}`,
      `Duration:     ${result.duration.toFixed(1)}s`,
      `Avg Response: ${result.avgResponseTime.toFixed(0)}ms`,
      `Memory:       ${(result.peakMemory / 1024 / 1024).toFixed(1)} MB`,
      `GitHub Calls: ${result.githubApiCalls}`,
      `Rate Limits:  ${result.rateLimitHits}`,
      '═══════════════════════════════════════',
    ];
    return lines.join('\n');
  }
}

export const testSuite = new TestSuite();