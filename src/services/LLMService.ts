import { AgentRole, LLMResponse, LLMTaskDecomposition, TaskPriority } from '../types';

/**
 * LLM Service Layer — Mock + Real API interface.
 * Supports Function Calling (Tool Use) pattern for task decomposition.
 *
 * Swap the implementation to connect to real APIs:
 * - Claude API (Anthropic)
 * - Minimax API
 * - OpenAI-compatible endpoints
 */

// --- Function Calling Tool Definitions ---
export const TASK_DECOMPOSITION_TOOLS = [
  {
    name: 'decompose_tasks',
    description: 'Break down a user command into individual agent tasks with role assignments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tasks: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              agent: {
                type: 'string' as const,
                enum: Object.values(AgentRole),
                description: 'The role of the agent to assign this task to',
              },
              task: {
                type: 'string' as const,
                description: 'Description of the task to be performed',
              },
              priority: {
                type: 'number' as const,
                enum: [0, 1, 2, 3],
                description: 'Task priority: 0=Low, 1=Normal, 2=High, 3=Critical',
              },
              dependencies: {
                type: 'array' as const,
                items: { type: 'string' as const },
                description: 'IDs of tasks that must complete before this one',
              },
            },
            required: ['agent', 'task'],
          },
        },
      },
      required: ['tasks'],
    },
  },
];

export interface LLMServiceConfig {
  provider: 'mock' | 'claude' | 'minimax' | 'openai';
  apiKey?: string;
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class LLMService {
  private config: LLMServiceConfig;
  private decisionHistory: { prompt: string; decision: string; timestamp: number }[] = [];

  constructor(config: LLMServiceConfig = { provider: 'mock' }) {
    this.config = config;
  }

  /**
   * Real-time decision making for agents
   */
  async makeDecision(context: string, options: string[]): Promise<string> {
    const decision = await this.callLLM(`Context: ${context}\nOptions: ${options.join(', ')}\nChoose the best option and explain why.`);
    
    this.decisionHistory.push({
      prompt: context,
      decision,
      timestamp: Date.now(),
    });
    
    if (this.decisionHistory.length > 100) {
      this.decisionHistory = this.decisionHistory.slice(-100);
    }
    
    return decision;
  }

  /**
   * Analyze code and provide suggestions
   */
  async analyzeCode(code: string, language: string): Promise<string> {
    return await this.callLLM(`Analyze this ${language} code and provide improvement suggestions:\n\n${code.slice(0, 2000)}`);
  }

  /**
   * Generate agent response based on personality
   */
  generateAgentResponse(agentId: string, message: string, personality: string): string {
    const templates = {
      'architect': [`분석 완료. 구조적으로 개선이 필요합니다.`, `시스템 설계 관점에서 검토结果表明...`],
      'security': [`보안 취약점을 발견했습니다.`, `코드审计结果: 위험 요소 감지`],
      'performance': [`성능 최적화가 필요합니다.`, `프로파일링 결과: 병목 구간 확인`],
      'developer': [`작업 진행중입니다.`, `구현 완료 phases...`],
    };
    
    const type = agentId.split('-')[0] as keyof typeof templates;
    const responses = templates[type] || ['처리중입니다.', '확인했습니다.'];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Get decision history
   */
  getDecisionHistory(): typeof this.decisionHistory {
    return this.decisionHistory;
  }

  private async callLLM(prompt: string): Promise<string> {
    switch (this.config.provider) {
      case 'claude':
        return await this.callClaudeSimple(prompt);
      case 'openai':
        return await this.callOpenAI(prompt);
      case 'minimax':
        return await this.callMinimaxSimple(prompt);
      default:
        return this.mockResponse(prompt);
    }
  }

  private async callClaudeSimple(prompt: string): Promise<string> {
    if (!this.config.apiKey) return this.mockResponse(prompt);
    
    try {
      const response = await fetch(this.config.endpoint || 'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-sonnet-4-20250514',
          max_tokens: this.config.maxTokens || 512,
          temperature: this.config.temperature || 0.7,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      
      const data = await response.json();
      return data.content?.[0]?.text || this.mockResponse(prompt);
    } catch {
      return this.mockResponse(prompt);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.config.apiKey) return this.mockResponse(prompt);
    
    try {
      const response = await fetch(this.config.endpoint || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: this.config.temperature || 0.7,
        }),
      });
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content || this.mockResponse(prompt);
    } catch {
      return this.mockResponse(prompt);
    }
  }

  private async callMinimaxSimple(prompt: string): Promise<string> {
    if (!this.config.apiKey) return this.mockResponse(prompt);
    
    try {
      const response = await fetch(this.config.endpoint || 'https://api.minimax.chat/v1/text/chatcompletion_pro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'abab6.5s-chat',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content || this.mockResponse(prompt);
    } catch {
      return this.mockResponse(prompt);
    }
  }

  private mockResponse(prompt: string): string {
    const responses = [
      '분석 완료. 작업을 진행하겠습니다.',
      '컨텍스트를 이해했습니다. 다음 단계로 이동합니다.',
      '검토 결과 문제없음. 처리를 계속합니다.',
      '결정 완료. 실행을 시작합니다.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Parse a natural language command into structured tasks.
   * Uses Function Calling pattern for deterministic output.
   */
  async decomposeTasks(userPrompt: string): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'claude':
        return this.callClaudeAPI(userPrompt);
      case 'minimax':
        return this.callMinimaxAPI(userPrompt);
      case 'mock':
      default:
        return this.mockDecomposition(userPrompt);
    }
  }

  // =============================================================
  // Claude API Integration (Function Calling / Tool Use)
  // =============================================================
  private async callClaudeAPI(userPrompt: string): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      console.warn('[LLMService] No API key configured, falling back to mock');
      return this.mockDecomposition(userPrompt);
    }

    const endpoint = this.config.endpoint || 'https://api.anthropic.com/v1/messages';
    const model = this.config.model || 'claude-sonnet-4-20250514';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: `You are a task decomposition agent. Given a user command, break it down into individual tasks and assign each to the appropriate agent role. Available roles: ${Object.values(AgentRole).join(', ')}. Use the decompose_tasks tool to return structured results.`,
          tools: TASK_DECOMPOSITION_TOOLS,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      const data = await response.json();
      return this.parseClaudeResponse(data);
    } catch (err) {
      console.error('[LLMService] Claude API error:', err);
      return this.mockDecomposition(userPrompt);
    }
  }

  private parseClaudeResponse(data: any): LLMResponse {
    try {
      const toolUseBlock = data.content?.find((b: any) => b.type === 'tool_use');
      if (toolUseBlock?.input?.tasks) {
        return {
          tasks: toolUseBlock.input.tasks as LLMTaskDecomposition[],
          reasoning: data.content?.find((b: any) => b.type === 'text')?.text || '',
          confidence: 0.9,
        };
      }
    } catch {
      // fall through
    }
    return { tasks: [], reasoning: 'Failed to parse response', confidence: 0 };
  }

  // =============================================================
  // Minimax API Integration (placeholder)
  // =============================================================
  private async callMinimaxAPI(userPrompt: string): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      return this.mockDecomposition(userPrompt);
    }

    const endpoint = this.config.endpoint || 'https://api.minimax.chat/v1/text/chatcompletion_v2';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'abab6.5-chat',
          messages: [
            {
              role: 'system',
              content: `Break down user commands into JSON task arrays. Each task: {"agent":"role","task":"description","priority":0-3}. Roles: ${Object.values(AgentRole).join(', ')}`,
            },
            { role: 'user', content: userPrompt },
          ],
          tools: TASK_DECOMPOSITION_TOOLS,
        }),
      });

      const data = await response.json();
      return this.parseMinimaxResponse(data);
    } catch (err) {
      console.error('[LLMService] Minimax API error:', err);
      return this.mockDecomposition(userPrompt);
    }
  }

  private parseMinimaxResponse(data: any): LLMResponse {
    try {
      const message = data.choices?.[0]?.message;
      if (message?.tool_calls?.[0]?.function?.arguments) {
        const args = JSON.parse(message.tool_calls[0].function.arguments);
        return { tasks: args.tasks, reasoning: '', confidence: 0.85 };
      }
    } catch {
      // fall through
    }
    return { tasks: [], reasoning: 'Failed to parse Minimax response', confidence: 0 };
  }

  // =============================================================
  // Smart Mock — keyword-based task decomposition for offline dev
  // =============================================================
  private async mockDecomposition(userPrompt: string): Promise<LLMResponse> {
    const prompt = userPrompt.toLowerCase();
    const tasks: LLMTaskDecomposition[] = [];

    // Frontend keywords
    if (this.matchAny(prompt, ['웹사이트', 'ui', '프론트엔드', 'frontend', '페이지', '컴포넌트', 'react', 'css', '레이아웃'])) {
      tasks.push({ agent: AgentRole.Frontend, task: this.extractTask(prompt, 'frontend'), priority: TaskPriority.Normal });
    }

    // Backend keywords
    if (this.matchAny(prompt, ['서버', 'api', '백엔드', 'backend', '데이터베이스', 'db', '인증', '로직'])) {
      tasks.push({ agent: AgentRole.Backend, task: this.extractTask(prompt, 'backend'), priority: TaskPriority.Normal });
    }

    // Design keywords
    if (this.matchAny(prompt, ['디자인', '이미지', '배너', '로고', '아이콘', '일러스트', 'design', 'banner'])) {
      tasks.push({ agent: AgentRole.Designer, task: this.extractTask(prompt, 'design'), priority: TaskPriority.Normal });
    }

    // PM keywords
    if (this.matchAny(prompt, ['기획', '문서', '스펙', '요구사항', '일정', 'pm', 'planning'])) {
      tasks.push({ agent: AgentRole.PM, task: this.extractTask(prompt, 'pm'), priority: TaskPriority.High });
    }

    // QA keywords
    if (this.matchAny(prompt, ['테스트', 'qa', '검증', 'test', '버그', 'quality'])) {
      tasks.push({ agent: AgentRole.QA, task: this.extractTask(prompt, 'qa'), priority: TaskPriority.Normal });
    }

    // DevOps keywords
    if (this.matchAny(prompt, ['배포', 'deploy', 'ci/cd', '인프라', 'docker', 'devops', '서버 설정'])) {
      tasks.push({ agent: AgentRole.DevOps, task: this.extractTask(prompt, 'devops'), priority: TaskPriority.Normal });
    }

    // Fallback: if nothing matched, assign to PM for analysis
    if (tasks.length === 0) {
      tasks.push({ agent: AgentRole.PM, task: `분석 필요: ${userPrompt}`, priority: TaskPriority.Normal });
    }

    return {
      tasks,
      reasoning: `[Mock] Decomposed "${userPrompt}" into ${tasks.length} task(s) by keyword matching`,
      confidence: 0.7,
    };
  }

  private matchAny(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw));
  }

  private extractTask(prompt: string, domain: string): string {
    // Simple: return the full prompt tagged with domain context
    const domainLabels: Record<string, string> = {
      frontend: 'Frontend 작업',
      backend: 'Backend 작업',
      design: '디자인 작업',
      pm: '기획/관리 작업',
      qa: 'QA/테스트 작업',
      devops: 'DevOps 작업',
    };
    return `${domainLabels[domain] || domain}: ${prompt}`;
  }
}
