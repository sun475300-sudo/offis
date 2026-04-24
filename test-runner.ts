/**
 * Pixel Office Test Suite - Automated Testing
 */

import { testSuite } from './src/services/TestSuite';
import { agentPersona } from './src/services/FeatureServices';

// ============================================
// Test Runner
// ============================================

interface TestCase {
  name: string;
  fn: () => Promise<boolean> | boolean;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class TestRunner {
  private results: TestResult[] = [];

  async runAll(tests: TestCase[]): Promise<TestResult[]> {
    console.log('═══ 테스트 시작 ═══');
    
    for (const test of tests) {
      const start = Date.now();
      try {
        const passed = await test.fn();
        this.results.push({ name: test.name, passed, duration: Date.now() - start });
        console.log(`${passed ? '✅' : '❌'} ${test.name} (${Date.now() - start}ms)`);
      } catch (err) {
        this.results.push({ name: test.name, passed: false, error: String(err), duration: Date.now() - start });
        console.log(`❌ ${test.name}: ${err}`);
      }
    }

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    console.log(`═══ 결과: ${passed}/${total} 통과 ═══`);
    
    return this.results;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  generateReport(): string {
    const lines = ['═══ 테스트 리포트 ═══', ''];
    
    for (const r of this.results) {
      const status = r.passed ? '✅' : '❌';
      lines.push(`${status} ${r.name} - ${r.duration}ms`);
      if (r.error) lines.push(`   오류: ${r.error}`);
    }
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const rate = ((passed / total) * 100).toFixed(1);
    
    lines.push('', `통과율: ${rate}% (${passed}/${total})`);
    return lines.join('\n');
  }
}

// ============================================
// Unit Tests
// ============================================

const unitTests: TestCase[] = [
  {
    name: 'LLMService 생성',
    fn: () => {
      const { LLMService } = require('./src/services/LLMService');
      const service = new LLMService({ provider: 'mock' });
      return service !== null;
    }
  },
  {
    name: 'TestSuite 부하 테스트',
    fn: async () => {
      const result = await testSuite.runStressTest({
        agentCount: 5,
        concurrentTasks: 2,
        duration: 2,
        codeReviewCount: 1,
      });
      return result.totalTasksCompleted > 0;
    }
  },
  {
    name: '테스트 히스토리 저장',
    fn: async () => {
      const before = testSuite.getHistory().length;
      await testSuite.runStressTest({ agentCount: 3, concurrentTasks: 1, duration: 1, codeReviewCount: 1 });
      const after = testSuite.getHistory().length;
      return after > before;
    }
  },
  {
    name: '에이전트 페르소나 조회',
    fn: () => {
      const personas = agentPersona.getAllPersonas();
      return personas.length > 0;
    }
  },
  {
    name: '부하 생성 테스트',
    fn: async () => {
      const result = await testSuite.runLoadTest(10, 5);
      return result.activeAgents === 10;
    }
  },
  {
    name: '토론 테스트',
    fn: async () => {
      const result = await testSuite.runDebateStressTest(3);
      return result.turns > 0;
    }
  },
  {
    name: 'CI/CD 피드백 루프',
    fn: async () => {
      const result = await testSuite.runCICDFeedbackLoopTest(5);
      return result.success + result.failed === 5;
    }
  },
  {
    name: '회의 협업 테스트',
    fn: async () => {
      const result = await testSuite.runMeetingCollaborationTest(4, 3);
      return result.messages > 0;
    }
  },
];

// ============================================
// Integration Tests
// ============================================

const integrationTests: TestCase[] = [
  {
    name: '전체 부하 테스트 시뮬레이션',
    fn: async () => {
      // Simulate full workflow
      await testSuite.runStressTest({ agentCount: 10, concurrentTasks: 3, duration: 3, codeReviewCount: 3 });
      const history = testSuite.getHistory();
      return history.length > 0;
    }
  },
  {
    name: '스케줄 추가 및 조회',
    fn: () => {
      const id = testSuite.addSchedule('test-schedule', 60);
      const schedules = testSuite.getSchedules();
      testSuite.removeSchedule(id);
      return schedules.length >= 1;
    }
  },
  {
    name: '템플릿 저장 및 실행',
    fn: async () => {
      testSuite.saveTemplate('test-template', { agentCount: 5, concurrentTasks: 2, duration: 2, codeReviewCount: 1 }, 'test');
      const templates = testSuite.getTemplates();
      return templates.length > 0;
    }
  },
];

// ============================================
// E2E Tests
// ============================================

const e2eTests: TestCase[] = [
  {
    name: '전체 테스트 워크플로우',
    fn: async () => {
      // 1. Run stress test
      await testSuite.runStressTest({ agentCount: 8, concurrentTasks: 3, duration: 3, codeReviewCount: 2 });
      
      // 2. Run load test
      await testSuite.runLoadTest(15, 3);
      
      // 3. Verify history
      const history = testSuite.getHistory();
      return history.length >= 2;
    }
  },
  {
    name: '。会议协作流程',
    fn: async () => {
      const result = await testSuite.runMeetingCollaborationTest(6, 4);
      return result.conflicts < result.messages;
    }
  },
];

// ============================================
// Run All Tests
// ============================================

async function runAllTests() {
  const runner = new TestRunner();
  
  console.log('═══ 단위 테스트 ═══');
  await runner.runAll(unitTests);
  
  console.log('═══ 통합 테스트 ═══');
  await runner.runAll(integrationTests);
  
  console.log('═══ E2E 테스트 ═══');
  await runner.runAll(e2eTests);
  
  // Generate final report
  console.log('\n' + runner.generateReport());
  
  // Export results
  const results = runner.getResults();
  const json = JSON.stringify(results, null, 2);
  const fs = require('fs');
  fs.writeFileSync('test-results.json', json);
  
  return results;
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { TestRunner, TestCase, TestResult, runAllTests };