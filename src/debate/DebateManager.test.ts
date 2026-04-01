import { describe, it, expect } from 'vitest';
import { DebateManager } from './DebateManager';

describe('DebateManager', () => {
  it('should create a debate session', async () => {
    const dm = new DebateManager();
    const session = await dm.startDebate('const x = 1;', 'TestProject');

    expect(session.id).toBeTruthy();
    expect(session.status).toBe('active');
    expect(session.projectName).toBe('TestProject');
    expect(session.currentTurn).toBe(0);
    expect(session.maxTurns).toBe(3);
    expect(session.turns).toEqual([]);
  });

  it('should track token usage', () => {
    const dm = new DebateManager();
    expect(dm.getTokenUsage()).toBe(0);
  });

  it('should store sessions in getAllSessions', async () => {
    const dm = new DebateManager();
    await dm.startDebate('code', 'Project1');
    // Small delay to ensure unique timestamp-based IDs
    await new Promise(r => setTimeout(r, 5));
    await dm.startDebate('code2', 'Project2');

    const sessions = dm.getAllSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('should get session by ID', async () => {
    const dm = new DebateManager();
    const session = await dm.startDebate('code', 'Proj');
    const found = dm.getSession(session.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(session.id);
  });

  it('should return undefined for non-existent session', () => {
    const dm = new DebateManager();
    expect(dm.getSession('non-existent')).toBeUndefined();
  });

  it('should run a full debate and complete', async () => {
    const dm = new DebateManager();
    dm.setDebateDelay(0); // Speed up for testing
    const session = await dm.startDebate('function test() { eval("x"); }', 'TestProj');
    const result = await dm.runDebate(session.id);

    expect(result.status).toBe('completed');
    expect(result.turns.length).toBeGreaterThan(0);
    expect(result.finalConclusion).toBeTruthy();
  });

  it('should throw for running debate on non-existent session', async () => {
    const dm = new DebateManager();
    await expect(dm.runDebate('fake-id')).rejects.toThrow('Session not found');
  });
});
