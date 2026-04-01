import { describe, it, expect } from 'vitest';
import { ReviewService } from './ReviewService';
import { ReviewType } from '../types';

describe('ReviewService', () => {
  const service = new ReviewService();

  it('should create 3 review tasks for startReview', async () => {
    const tasks = await service.startReview('const x = 1;');
    expect(tasks.length).toBe(3);
    expect(tasks.map(t => t.reviewType)).toEqual([
      ReviewType.Architecture,
      ReviewType.BugsAndSecurity,
      ReviewType.Performance,
    ]);
  });

  it('should set all tasks to pending status', async () => {
    const tasks = await service.startReview('const x = 1;');
    for (const task of tasks) {
      expect(task.status).toBe('pending');
    }
  });

  it('should run parallel review and return aggregated report', async () => {
    const report = await service.runParallelReview('function test() { return 1; }');

    expect(report.totalScore).toBeGreaterThan(0);
    expect(report.totalScore).toBeLessThanOrEqual(100);
    expect(report.architectureScore).toBeDefined();
    expect(report.bugsScore).toBeDefined();
    expect(report.performanceScore).toBeDefined();
  });

  it('should include findings sorted by severity', async () => {
    // Code with known issues to trigger findings
    const badCode = `
      function test(): any {
        eval('dangerous');
        for (let i=0; i < arr.length; i++) { process(arr[i]); }
        const data = innerHTML;
      }
    `;
    const report = await service.runParallelReview(badCode);

    expect(report.findings.length).toBeGreaterThan(0);
    // Verify sorted by severity (critical > high > medium > low)
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    for (let i = 1; i < report.findings.length; i++) {
      const prev = severityOrder.indexOf(report.findings[i - 1].severity);
      const curr = severityOrder.indexOf(report.findings[i].severity);
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  it('should include reviewedBy information', async () => {
    const report = await service.runParallelReview('const x = 1;');
    expect(report.reviewedBy.architect).toBeTruthy();
    expect(report.reviewedBy.securityEngineer).toBeTruthy();
    expect(report.reviewedBy.performanceEngineer).toBeTruthy();
  });

  it('should include timestamp', async () => {
    const before = Date.now();
    const report = await service.runParallelReview('const x = 1;');
    expect(report.timestamp).toBeGreaterThanOrEqual(before);
  });

  it('should include recommendations', async () => {
    const report = await service.runParallelReview('const x = 1;');
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('should include summary string', async () => {
    const report = await service.runParallelReview('const x = 1;');
    expect(typeof report.summary).toBe('string');
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it('should detect eval usage as security issue', async () => {
    const report = await service.runParallelReview("eval('code')");
    const evalFinding = report.findings.find(f =>
      f.description.toLowerCase().includes('eval')
    );
    expect(evalFinding).toBeDefined();
  });
});
