import { describe, it, expect } from 'vitest';
import { LLMService } from './LLMService';
import { AgentRole, TaskPriority } from '../types';

describe('LLMService (mock provider)', () => {
  const service = new LLMService({ provider: 'mock' });

  it('should decompose frontend keywords into Frontend tasks', async () => {
    const result = await service.decomposeTasks('프론트엔드 UI 페이지 만들어');
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.tasks[0].agent).toBe(AgentRole.Frontend);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should decompose backend keywords into Backend tasks', async () => {
    const result = await service.decomposeTasks('서버 API 구축');
    expect(result.tasks.some(t => t.agent === AgentRole.Backend)).toBe(true);
  });

  it('should decompose design keywords into Designer tasks', async () => {
    const result = await service.decomposeTasks('배너 디자인 제작');
    expect(result.tasks.some(t => t.agent === AgentRole.Designer)).toBe(true);
  });

  it('should decompose QA keywords into QA tasks', async () => {
    const result = await service.decomposeTasks('테스트 코드 작성하고 버그 검증');
    expect(result.tasks.some(t => t.agent === AgentRole.QA)).toBe(true);
  });

  it('should decompose architecture keywords into Architect tasks', async () => {
    const result = await service.decomposeTasks('시스템 아키텍처 설계');
    expect(result.tasks.some(t => t.agent === AgentRole.Architect)).toBe(true);
  });

  it('should decompose coding keywords into Coder tasks', async () => {
    const result = await service.decomposeTasks('스크립트 구현 작성');
    expect(result.tasks.some(t => t.agent === AgentRole.Coder)).toBe(true);
  });

  it('should decompose review keywords into Reviewer tasks', async () => {
    const result = await service.decomposeTasks('코드 리뷰 검토해줘');
    expect(result.tasks.some(t => t.agent === AgentRole.Reviewer)).toBe(true);
  });

  it('should fall back to PM for unknown commands', async () => {
    const result = await service.decomposeTasks('무슨 말인지 모르겠는 명령');
    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0].agent).toBe(AgentRole.PM);
  });

  it('should produce multiple tasks for multi-domain commands', async () => {
    const result = await service.decomposeTasks('프론트엔드 UI 만들고 서버 API 구축하고 테스트');
    expect(result.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it('should include reasoning in response', async () => {
    const result = await service.decomposeTasks('배포 준비');
    expect(result.reasoning).toBeTruthy();
    expect(typeof result.reasoning).toBe('string');
  });

  it('should fallback to mock when claude provider has no API key', async () => {
    const claudeService = new LLMService({ provider: 'claude' });
    const result = await claudeService.decomposeTasks('프론트엔드 작업');
    // Should fallback to mock and still return results
    expect(result.tasks.length).toBeGreaterThan(0);
  });
});
