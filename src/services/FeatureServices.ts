import { testSuite } from './TestSuite';

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  personality: string;
  traits: string[];
  communicationStyle: 'formal' | 'casual' | 'humorous' | 'direct';
  expertise: string[];
}

export interface TaskQueueItem {
  id: string;
  name: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedTo?: string;
  createdAt: number;
  estimatedDuration: number;
}

export interface CodeSnippet {
  id: string;
  name: string;
  language: string;
  code: string;
  tags: string[];
  createdAt: number;
  usageCount: number;
}

export interface ThemeConfig {
  name: string;
  colors: Record<string, string>;
  isDark: boolean;
}

export interface SystemConfig {
  testSuite: any;
  schedules: any[];
  templates: any[];
  webhooks: any[];
  notifications: any[];
  themes: ThemeConfig[];
}

export class AgentPersonaSystem {
  private personas: AgentPersona[] = [
    { id: 'architect', name: '아키텍트', role: 'Architect', personality: '체계적이고 분석적', traits: ['논리적', '신중함', '비전적'], communicationStyle: 'formal', expertise: ['시스템 설계', '코드 리뷰', '최적화'] },
    { id: 'security', name: '보안 전문가', role: 'SecurityEngineer', personality: '警惕적이고 철저함', traits: ['분석적', '철저함', '실용적'], communicationStyle: 'direct', expertise: ['보안 감사', '취약점 분석', '침투 테스트'] },
    { id: 'performance', name: '성능 전문가', role: 'PerformanceEngineer', personality: '결과导向적이고 효율적', traits: ['효율적', '데이터 중심', '문제 해결사'], communicationStyle: 'casual', expertise: ['프로파일링', '최적화', '벤치마킹'] },
    { id: 'developer', name: '개발자', role: 'Developer', personality: '창의적이고 실용적', traits: ['유연함', '协作적', '문제 해결'], communicationStyle: 'casual', expertise: ['프론트엔드', '백엔드', '풀스택'] },
  ];

  getPersona(agentId: string): AgentPersona | undefined {
    const type = agentId.split('-')[0];
    return this.personas.find(p => p.id === type);
  }

  getAllPersonas(): AgentPersona[] {
    return this.personas;
  }

  addPersona(persona: Omit<AgentPersona, 'id'>): string {
    const id = `persona-${Date.now()}`;
    this.personas.push({ ...persona, id });
    return id;
  }

  getPersonaDescription(agentId: string): string {
    const persona = this.getPersona(agentId);
    if (!persona) return '';
    
    return `[${persona.name}]
성격: ${persona.personality}
특징: ${persona.traits.join(', ')}
스타일: ${persona.communicationStyle}
전문가: ${persona.expertise.join(', ')}`;
  }
}

export class TaskQueueManager {
  private queue: TaskQueueItem[] = [];
  private maxSize = 100;

  addTask(name: string, priority: number, estimatedDuration: number): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.queue.push({
      id, name, priority, status: 'pending', createdAt: Date.now(), estimatedDuration,
    });
    this.queue.sort((a, b) => b.priority - a.priority);
    
    if (this.queue.length > this.maxSize) {
      this.queue = this.queue.slice(-this.maxSize);
    }
    
    return id;
  }

  getQueue(): TaskQueueItem[] {
    return [...this.queue];
  }

  updateStatus(taskId: string, status: TaskQueueItem['status']): void {
    const task = this.queue.find(t => t.id === taskId);
    if (task) task.status = status;
  }

  assignTask(taskId: string, agentId: string): void {
    const task = this.queue.find(t => t.id === taskId);
    if (task) task.assignedTo = agentId;
  }

  getStats(): { pending: number; running: number; completed: number; failed: number } {
    return {
      pending: this.queue.filter(t => t.status === 'pending').length,
      running: this.queue.filter(t => t.status === 'running').length,
      completed: this.queue.filter(t => t.status === 'completed').length,
      failed: this.queue.filter(t => t.status === 'failed').length,
    };
  }

  clear(): void {
    this.queue = [];
  }
}

export class CodeSnippetManager {
  private snippets: CodeSnippet[] = [];
  private maxSnippets = 200;

  add(name: string, language: string, code: string, tags: string[] = []): string {
    const id = `snippet-${Date.now()}`;
    this.snippets.push({ id, name, language, code, tags, createdAt: Date.now(), usageCount: 0 });
    
    if (this.snippets.length > this.maxSnippets) {
      this.snippets = this.snippets.slice(-this.maxSnippets);
    }
    
    return id;
  }

  getAll(): CodeSnippet[] {
    return [...this.snippets];
  }

  search(query: string): CodeSnippet[] {
    const q = query.toLowerCase();
    return this.snippets.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.tags.some(t => t.toLowerCase().includes(q)) ||
      s.language.toLowerCase().includes(q)
    );
  }

  incrementUsage(id: string): void {
    const snippet = this.snippets.find(s => s.id === id);
    if (snippet) snippet.usageCount++;
  }

  delete(id: string): void {
    this.snippets = this.snippets.filter(s => s.id !== id);
  }
}

export class ThemeManager {
  private themes: ThemeConfig[] = [
    { name: 'Dark', colors: { bg: '#1a1f26', primary: '#00bcd4', secondary: '#9c27b0' }, isDark: true },
    { name: 'Light', colors: { bg: '#f5f5f5', primary: '#2196f3', secondary: '#ff9800' }, isDark: false },
    { name: 'Matrix', colors: { bg: '#0d0d0d', primary: '#00ff00', secondary: '#003300' }, isDark: true },
    { name: 'Ocean', colors: { bg: '#0a1929', primary: '#64ffda', secondary: '#1e3a5f' }, isDark: true },
    { name: 'Sunset', colors: { bg: '#1a0a0a', primary: '#ff6b6b', secondary: '#feca57' }, isDark: true },
  ];
  private currentTheme = 0;

  getThemes(): ThemeConfig[] {
    return this.themes;
  }

  getCurrentTheme(): ThemeConfig {
    return this.themes[this.currentTheme];
  }

  setTheme(index: number): void {
    if (index >= 0 && index < this.themes.length) {
      this.currentTheme = index;
      this.applyTheme(this.themes[index]);
    }
  }

  private applyTheme(theme: ThemeConfig): void {
    document.documentElement.style.setProperty('--bg-primary', theme.colors.bg);
    document.documentElement.style.setProperty('--accent-cyan', theme.colors.primary);
    document.documentElement.style.setProperty('--accent-purple', theme.colors.secondary);
  }

  addCustomTheme(name: string, colors: Record<string, string>): string {
    const id = `theme-${Date.now()}`;
    this.themes.push({ name, colors, isDark: true });
    return id;
  }
}

export class ConfigManager {
  exportConfig(): string {
    const config: SystemConfig = {
      testSuite: { schedules: testSuite.getSchedules(), templates: testSuite.getTemplates(), webhooks: testSuite.getWebhooks() },
      schedules: testSuite.getSchedules(),
      templates: testSuite.getTemplates(),
      webhooks: testSuite.getWebhooks(),
      notifications: testSuite.getNotifications(),
      themes: themeManager.getThemes(),
    };
    return JSON.stringify(config, null, 2);
  }

  importConfig(json: string): boolean {
    try {
      const config = JSON.parse(json);
      if (config.schedules) config.schedules.forEach((s: any) => testSuite.addSchedule(s.name, s.interval / 60000));
      if (config.webhooks) config.webhooks.forEach((w: any) => testSuite.addWebhook(w.url, w.events));
      return true;
    } catch {
      return false;
    }
  }

  downloadConfig(): void {
    const json = this.exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixel-office-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export class ResourceMonitor {
  getMetrics(): { memory: number; fps: number; agents: number; tasks: number } {
    const mem = (performance as any).memory;
    return {
      memory: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : 0,
      fps: 60,
      agents: 32,
      tasks: taskQueue.getStats().pending,
    };
  }

  getReport(): string {
    const m = this.getMetrics();
    return `
=== 리소스 모니터 ===
메모리: ${m.memory}MB
FPS: ${m.fps}
에이전트: ${m.agents}개
대기 작업: ${m.tasks}개
`;
  }
}

export class CollaborationHub {
  private activeSessions: Map<string, { participants: string[]; startedAt: number; type: string }> = new Map();

  createSession(type: string, participants: string[]): string {
    const id = `session-${Date.now()}`;
    this.activeSessions.set(id, { participants, startedAt: Date.now(), type });
    return id;
  }

  getSessions(): { id: string; type: string; participants: number; duration: number }[] {
    const now = Date.now();
    return Array.from(this.activeSessions.entries()).map(([id, s]) => ({
      id, type: s.type, participants: s.participants.length, duration: Math.round((now - s.startedAt) / 1000),
    }));
  }

  endSession(id: string): void {
    this.activeSessions.delete(id);
  }

  getSessionCount(): number {
    return this.activeSessions.size;
  }
}

export const agentPersona = new AgentPersonaSystem();
export const taskQueue = new TaskQueueManager();
export const snippetManager = new CodeSnippetManager();
export const themeManager = new ThemeManager();
export const configManager = new ConfigManager();
export const resourceMonitor = new ResourceMonitor();
export const collaborationHub = new CollaborationHub();