/**
 * AgentHarness — 역할 특화 에이전트 하네스 시스템
 *
 * 영상 참조:
 *  - Sub-agent 역할분화 (https://youtu.be/Qr3pyVpd8CY)
 *  - Harness Engineering: 컨텍스트·툴·프롬프트 최적 결합
 *    (https://www.youtube.com/watch?v=5buNm0pA1mg)
 *
 * 핵심 원칙:
 *  "모델 성능보다 하네스(환경) 설계가 결과를 결정한다"
 *  → 각 에이전트는 자신의 역할에 최적화된
 *    시스템 프롬프트 + 툴셋 + 컨텍스트 전략을 가진다.
 */

import { AgentRole } from '../types';
import { statePersistence } from './StatePersistence';

/** 에이전트 하네스는 에이전트가 실행되는 환경 그 자체 */
export interface AgentHarnessConfig {
  role: AgentRole;
  /** 에이전트 페르소나 — LLM에 주입되는 시스템 프롬프트 */
  systemPrompt: string;
  /** 이 역할이 사용할 수 있는 툴 목록 */
  availableTools: AgentTool[];
  /** 컨텍스트 전략: recent=최신우선, summary=요약우선, full=전체 */
  contextStrategy: 'recent' | 'summary' | 'full';
  /** 최대 컨텍스트 토큰 수 */
  maxContextTokens: number;
  /** 온도 (창의성): 0.0~1.0 */
  temperature: number;
  /** 격언 — UI 말풍선에 표시 */
  motto: string;
}

export interface AgentTool {
  name: string;
  description: string;
  emoji: string;
}

// ─── 역할별 전용 툴 정의 ─────────────────────────────────────────────────────

const FRONTEND_TOOLS: AgentTool[] = [
  { name: 'write_component', description: 'React/Vue 컴포넌트 생성', emoji: '⚛️' },
  { name: 'run_storybook',   description: 'Storybook 프리뷰 실행',   emoji: '📖' },
  { name: 'lint_css',        description: 'CSS/SCSS 린트 검사',       emoji: '🎨' },
  { name: 'check_a11y',      description: '접근성(A11y) 점검',        emoji: '♿' },
];

const BACKEND_TOOLS: AgentTool[] = [
  { name: 'write_api',       description: 'REST/GraphQL API 작성',    emoji: '🔌' },
  { name: 'run_migration',   description: 'DB 마이그레이션 실행',     emoji: '🗄️' },
  { name: 'load_test',       description: 'k6 부하 테스트 실행',      emoji: '⚡' },
  { name: 'check_security',  description: '보안 취약점 스캔',         emoji: '🔒' },
];

const DESIGNER_TOOLS: AgentTool[] = [
  { name: 'generate_mockup', description: 'Figma 목업 생성',          emoji: '🎭' },
  { name: 'design_token',    description: '디자인 토큰 추출',         emoji: '💎' },
  { name: 'check_contrast',  description: 'WCAG 색상 대비 검사',      emoji: '🌈' },
];

const PM_TOOLS: AgentTool[] = [
  { name: 'write_prd',       description: 'PRD 문서 자동 작성',       emoji: '📋' },
  { name: 'prioritize',      description: 'MoSCoW 우선순위 분류',     emoji: '🎯' },
  { name: 'create_sprint',   description: '스프린트 계획 생성',       emoji: '🏃' },
  { name: 'stakeholder_map', description: '이해관계자 맵 생성',       emoji: '🗺️' },
];

const QA_TOOLS: AgentTool[] = [
  { name: 'write_test',      description: '테스트 케이스 작성',       emoji: '🧪' },
  { name: 'run_e2e',         description: 'Playwright E2E 실행',      emoji: '🎭' },
  { name: 'coverage_report', description: '커버리지 리포트 생성',     emoji: '📊' },
  { name: 'regression_scan', description: '회귀 테스트 스캔',         emoji: '🔍' },
];

const DEVOPS_TOOLS: AgentTool[] = [
  { name: 'deploy_staging',  description: '스테이징 배포',            emoji: '🚀' },
  { name: 'monitor_infra',   description: '인프라 모니터링',          emoji: '📡' },
  { name: 'setup_ci',        description: 'CI/CD 파이프라인 설정',    emoji: '⚙️' },
  { name: 'scale_pods',      description: 'k8s 파드 스케일링',        emoji: '☸️' },
];

const ARCHITECT_TOOLS: AgentTool[] = [
  { name: 'draw_diagram',    description: 'C4/UML 다이어그램 생성',   emoji: '📐' },
  { name: 'review_pr',       description: 'PR 아키텍처 리뷰',         emoji: '🔎' },
  { name: 'tech_spike',      description: '기술 검증 스파이크',       emoji: '🧠' },
  { name: 'adr_write',       description: 'ADR(설계결정 기록) 작성',  emoji: '📝' },
];

// ─── 역할별 하네스 맵 ────────────────────────────────────────────────────────

export const AGENT_HARNESSES: Record<AgentRole, AgentHarnessConfig> = {
  [AgentRole.Frontend]: {
    role: AgentRole.Frontend,
    systemPrompt: `당신은 숙련된 프론트엔드 개발자입니다.
React, TypeScript, CSS-in-JS 전문가입니다.
사용자 경험을 최우선으로 생각하며, 접근성과 성능을 항상 고려합니다.
코드를 작성할 때 컴포넌트 재사용성, 타입 안전성, 테스트 가능성을 중시합니다.
답변은 구체적이고 실행 가능한 코드 예시를 포함하세요.`,
    availableTools: FRONTEND_TOOLS,
    contextStrategy: 'recent',
    maxContextTokens: 4096,
    temperature: 0.3,
    motto: '사용자가 느끼는 0.1초 차이가 전부입니다',
  },

  [AgentRole.Backend]: {
    role: AgentRole.Backend,
    systemPrompt: `당신은 경험 많은 백엔드 엔지니어입니다.
Node.js, PostgreSQL, Redis, 마이크로서비스 아키텍처 전문가입니다.
확장성, 가용성, 보안을 최우선으로 설계합니다.
API 설계 시 RESTful 원칙과 OpenAPI 스펙 준수를 중시합니다.
성능 병목을 먼저 측정하고 최적화합니다.`,
    availableTools: BACKEND_TOOLS,
    contextStrategy: 'full',
    maxContextTokens: 8192,
    temperature: 0.2,
    motto: '측정하지 않은 것은 최적화할 수 없습니다',
  },

  [AgentRole.Designer]: {
    role: AgentRole.Designer,
    systemPrompt: `당신은 제품 & UI/UX 디자이너입니다.
Figma, 디자인 시스템, 사용자 리서치 전문가입니다.
시각적 계층구조, 공백, 타이포그래피를 통해 명확한 커뮤니케이션을 추구합니다.
디자인 결정 시 항상 사용자 데이터와 WCAG 가이드라인을 기반으로 합니다.`,
    availableTools: DESIGNER_TOOLS,
    contextStrategy: 'summary',
    maxContextTokens: 2048,
    temperature: 0.7,
    motto: '좋은 디자인은 보이지 않습니다',
  },

  [AgentRole.PM]: {
    role: AgentRole.PM,
    systemPrompt: `당신은 제품 관리자(PM)입니다.
사용자 스토리, PRD 작성, 로드맵 관리 전문가입니다.
비즈니스 목표와 기술 실현 가능성 사이에서 최적의 균형을 찾습니다.
의사결정 시 데이터 기반 접근법을 사용하고, 모든 트레이드오프를 명확히 문서화합니다.
MoSCoW 방법론으로 우선순위를 관리합니다.`,
    availableTools: PM_TOOLS,
    contextStrategy: 'summary',
    maxContextTokens: 4096,
    temperature: 0.4,
    motto: '출시되지 않은 완벽한 제품보다 출시된 좋은 제품이 낫습니다',
  },

  [AgentRole.QA]: {
    role: AgentRole.QA,
    systemPrompt: `당신은 QA 엔지니어입니다.
테스트 자동화, 버그 추적, 품질 보증 전문가입니다.
엣지 케이스를 항상 먼저 생각하고, 부정 테스트를 소홀히 하지 않습니다.
테스트 피라미드(단위→통합→E2E)를 준수하며 커버리지 80% 이상을 목표로 합니다.`,
    availableTools: QA_TOOLS,
    contextStrategy: 'full',
    maxContextTokens: 4096,
    temperature: 0.1,
    motto: '버그는 개발 중 발견할수록 저렴합니다',
  },

  [AgentRole.DevOps]: {
    role: AgentRole.DevOps,
    systemPrompt: `당신은 DevOps/SRE 엔지니어입니다.
Kubernetes, Terraform, CI/CD 파이프라인 전문가입니다.
인프라를 코드로 관리하고(IaC), 변경의 영향 범위를 항상 최소화합니다.
SLO/SLI 기반으로 신뢰성을 정의하고 측정합니다.`,
    availableTools: DEVOPS_TOOLS,
    contextStrategy: 'recent',
    maxContextTokens: 4096,
    temperature: 0.1,
    motto: 'You build it, you run it',
  },

  [AgentRole.Architect]: {
    role: AgentRole.Architect,
    systemPrompt: `당신은 수석 소프트웨어 아키텍트입니다.
시스템 설계, 기술 전략, 아키텍처 의사결정 전문가입니다.
모든 설계 결정에 ADR을 작성하고, 장기적 유지보수성을 최우선으로 고려합니다.
새로운 기술 도입 시 즉각적인 비용 대비 장기적 편익을 분석합니다.`,
    availableTools: ARCHITECT_TOOLS,
    contextStrategy: 'full',
    maxContextTokens: 16384,
    temperature: 0.3,
    motto: '아키텍처는 되돌리기 어려운 결정들의 집합입니다',
  },

  [AgentRole.SecurityEngineer]: {
    role: AgentRole.SecurityEngineer,
    systemPrompt: `당신은 보안 엔지니어입니다.
OWASP Top 10, 침투 테스트, 취약점 분석 전문가입니다.
코드를 검토할 때 항상 "공격자라면 어떻게 악용할까?"를 먼저 생각합니다.
보안과 개발자 경험(DX) 사이의 균형을 중시합니다.`,
    availableTools: [...BACKEND_TOOLS, { name: 'pentest', description: '침투 테스트 실행', emoji: '🔓' }],
    contextStrategy: 'full',
    maxContextTokens: 8192,
    temperature: 0.1,
    motto: '보안은 기능이 아니라 속성입니다',
  },

  [AgentRole.PerformanceEngineer]: {
    role: AgentRole.PerformanceEngineer,
    systemPrompt: `당신은 성능 엔지니어입니다.
프로파일링, 캐싱 전략, 데이터베이스 최적화 전문가입니다.
모든 성능 개선은 측정 → 분석 → 최적화 → 재측정 사이클로 진행합니다.
"추측하지 말고 측정하라"를 철칙으로 삼습니다.`,
    availableTools: [...BACKEND_TOOLS, { name: 'flame_graph', description: '플레임 그래프 생성', emoji: '🔥' }],
    contextStrategy: 'full',
    maxContextTokens: 8192,
    temperature: 0.0,
    motto: '빠른 코드보다 올바른 코드가 먼저입니다',
  },
};

/**
 * 에이전트의 하네스 설정을 조회합니다.
 * 설정이 없으면 Backend 기본값을 반환합니다.
 */
export function getHarness(role: AgentRole): AgentHarnessConfig {
  return AGENT_HARNESSES[role] ?? AGENT_HARNESSES[AgentRole.Backend];
}

/**
 * 에이전트 역할에 따라 LLM 시스템 프롬프트를 생성합니다.
 * context: 현재 수행 중인 작업 정보
 */
export function buildSystemPrompt(role: AgentRole, context?: string): string {
  const harness = getHarness(role);
  const toolList = harness.availableTools.map(t => `  ${t.emoji} ${t.name}: ${t.description}`).join('\n');

  return `${harness.systemPrompt}

## 현재 환경 (Harness)
- 컨텍스트 전략: ${harness.contextStrategy}
- 최대 컨텍스트: ${harness.maxContextTokens} 토큰
- 창의성 수준: ${harness.temperature}

## 사용 가능한 툴
${toolList}

## 격언
"${harness.motto}"

${context ? `## 현재 작업 컨텍스트\n${context}` : ''}`;
}

/**
 * 에이전트 역할별 말풍선 메시지 풀
 */
export const AGENT_SPEECH_POOL: Record<AgentRole, string[]> = {
  [AgentRole.Frontend]: [
    '컴포넌트 설계 중...',
    'CSS 픽셀 단위 맞추는 중 🎨',
    'React 상태 최적화 분석',
    '접근성 검토 완료 ✓',
    'Storybook에서 확인 중',
  ],
  [AgentRole.Backend]: [
    'API 엔드포인트 설계 중',
    'DB 쿼리 최적화 분석 🔍',
    '인덱스 추가 가능성 검토',
    '캐셔 히트율: 94% ✓',
    '마이그레이션 스크립트 작성',
  ],
  [AgentRole.Designer]: [
    '와이어프레임 작성 중 ✏️',
    '색상 대비비 검사: AA 통과',
    'Figma 컴포넌트 정리',
    '사용자 플로우 재검토',
    '디자인 토큰 추출 완료',
  ],
  [AgentRole.PM]: [
    'PRD 초안 작성 중 📋',
    '우선순위 재조정 필요',
    '스프린트 계획 검토',
    '이해관계자 피드백 수집',
    'OKR 진행률: 73% 📊',
  ],
  [AgentRole.QA]: [
    '테스트 케이스 작성 중 🧪',
    '엣지 케이스 발견! 🐛',
    'E2E 테스트 실행 중',
    '커버리지 82% 달성 ✓',
    '회귀 테스트 통과',
  ],
  [AgentRole.DevOps]: [
    'CI 파이프라인 점검 중 ⚙️',
    'k8s 파드 스케일링',
    '배포 준비 완료 🚀',
    'SLO 99.9% 유지 중 ✓',
    'Terraform apply 완료',
  ],
  [AgentRole.Architect]: [
    '아키텍처 다이어그램 업데이트',
    '기술 부채 분석 중 🧠',
    'ADR 작성: 마이크로서비스 전환',
    '의존성 그래프 검토',
    '설계 트레이드오프 문서화',
  ],
  [AgentRole.SecurityEngineer]: [
    'OWASP 취약점 스캔 🔒',
    'SQL 인젝션 패턴 검사',
    '인증 플로우 리뷰 중',
    '취약점 없음 — 패스 ✓',
    '침투 테스트 시나리오 작성',
  ],
  [AgentRole.PerformanceEngineer]: [
    'CPU 플레임 그래프 분석 🔥',
    'N+1 쿼리 패턴 발견!',
    '캐싱 레이어 최적화',
    '응답시간 210ms → 48ms ⚡',
    '메모리 누수 패치 완료',
  ],
};

/**
 * 에이전트 역할에 맞는 랜덤 발화 메시지를 반환합니다.
 */
export function getRandomSpeech(role: AgentRole): string {
  const pool = AGENT_SPEECH_POOL[role] ?? ['작업 중...'];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 하네스 현황 요약 텍스트 (CLI /harness 명령용)
 */
export function getHarnessSummary(): string {
  const rows = Object.values(AGENT_HARNESSES).map(h => {
    const toolNames = h.availableTools.map(t => t.emoji).join('');
    return `  ${h.role.padEnd(22)} T:${String(h.temperature).padEnd(4)} ctx:${h.contextStrategy.padEnd(8)} tools:${toolNames}`;
  });
  return [
    '╔══════════════════════════════════════════════════╗',
    '║  🔧  에이전트 하네스 현황                         ║',
    '╚══════════════════════════════════════════════════╝',
    '',
    ...rows,
    '',
    '→ /harness <role> 로 특정 역할 상세 조회',
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
//  MANAGED AGENT SESSIONS
//  출처: Anthropic Managed Agents 개념
//  (https://youtu.be/IAEV_fUAdWk — 코드팩토리 "하네싱. Managed Agents!")
//
//  핵심: 에이전트는 매 태스크마다 처음부터 시작하지 않는다.
//  세션(Session)은 에이전트의 기억과 컨텍스트를 유지하는 단위이다.
//  → Quickstart: 빠른 1회성 작업
//  → Agent: 역할별 설정 (Harness)
//  → Session: 에이전트 × 작업 × 상태의 조합
// ═══════════════════════════════════════════════════════════════════════════

export type SessionState = 'idle' | 'active' | 'paused' | 'completed' | 'error';

export interface ToolCallRecord {
  toolName: string;
  input: unknown;
  output: string;
  timestamp: number;
  durationMs: number;
}

export interface ManagedAgentSession {
  /** 세션 고유 ID */
  id: string;
  /** 담당 에이전트 ID */
  agentId: string;
  /** 담당 에이전트 역할 */
  role: AgentRole;
  /** 세션 상태: idle → active → paused / completed / error */
  state: SessionState;
  /** 세션 생성 시각 */
  createdAt: number;
  /** 마지막 활동 시각 */
  lastActiveAt: number;
  /** 누적 컨텍스트 (메모리) */
  contextMemory: string[];
  /** 도구 호출 이력 */
  toolCallLog: ToolCallRecord[];
  /** 완료된 태스크 수 */
  tasksCompleted: number;
  /** 총 토큰 사용량 추정치 */
  estimatedTokensUsed: number;
  /** 현재 수행 중인 태스크 설명 */
  currentTask?: string;
}

/**
 * Managed Agent Session Manager
 * — 에이전트별 세션을 생성·추적·재개합니다.
 */
export class ManagedAgentSessionManager {
  private static instance: ManagedAgentSessionManager;
  private sessions: Map<string, ManagedAgentSession> = new Map();
  private sessionCounter = 0;
  private readonly maxSessions = 200;

  static getInstance(): ManagedAgentSessionManager {
    if (!this.instance) {
      this.instance = new ManagedAgentSessionManager();
      this.instance.loadFromPersistence();
    }
    return this.instance;
  }

  /** 에이전트에 대한 새 세션을 시작하거나 기존 세션을 재개합니다 */
  startSession(agentId: string, role: AgentRole, task?: string): ManagedAgentSession {
    const existing = this.getActiveSession(agentId);
    if (existing) {
      existing.state = 'active';
      existing.lastActiveAt = Date.now();
      if (task) existing.currentTask = task;
      return existing;
    }

    const session: ManagedAgentSession = {
      id: `session-${++this.sessionCounter}-${agentId}`,
      agentId,
      role,
      state: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      contextMemory: [],
      toolCallLog: [],
      tasksCompleted: 0,
      estimatedTokensUsed: 0,
      currentTask: task,
    };

    this.sessions.set(session.id, session);
    // Evict the oldest completed/error sessions first; as a last resort
    // drop by insertion order. Keeps active and paused sessions alive.
    if (this.sessions.size > this.maxSessions) {
      const toDrop = this.sessions.size - this.maxSessions;
      const candidates: string[] = [];
      for (const [id, s] of this.sessions) {
        if (s.state === 'completed' || s.state === 'error') candidates.push(id);
      }
      for (let i = 0; i < toDrop; i++) {
        const id = candidates[i] ?? this.sessions.keys().next().value;
        if (id === undefined) break;
        this.sessions.delete(id);
      }
    }
    this.saveToPersistence();
    return session;
  }

  private saveToPersistence(): void {
    const data = Array.from(this.sessions.values());
    statePersistence.save('session', 'managed-agents-all', { sessions: data });
  }

  private loadFromPersistence(): void {
    const persisted = statePersistence.load('session', 'managed-agents-all');
    if (persisted && persisted.data && Array.isArray(persisted.data.sessions)) {
      const loadedSessions = persisted.data.sessions as ManagedAgentSession[];
      for (const s of loadedSessions) {
        this.sessions.set(s.id, s);
        // Update counter to avoid ID collision
        const num = parseInt(s.id.split('-')[1]);
        if (!isNaN(num)) this.sessionCounter = Math.max(this.sessionCounter, num);
      }
      console.log(`[ManagedAgentSessionManager] 💾 Restored ${this.sessions.size} sessions from persistence`);
    }
  }

  /** 에이전트의 활성 세션을 반환합니다 */
  getActiveSession(agentId: string): ManagedAgentSession | undefined {
    for (const s of this.sessions.values()) {
      if (s.agentId === agentId && (s.state === 'active' || s.state === 'paused')) {
        return s;
      }
    }
    return undefined;
  }

  /** 세션에 컨텍스트 메모리를 추가합니다 */
  addMemory(sessionId: string, memory: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.contextMemory.push(`[${new Date(Date.now()).toLocaleTimeString()}] ${memory}`);
    s.estimatedTokensUsed += Math.ceil(memory.length / 4);
    s.lastActiveAt = Date.now();
    // 최대 50개 메모리 유지
    if (s.contextMemory.length > 50) s.contextMemory.shift();
    this.saveToPersistence();
  }

  /** 도구 호출을 기록합니다 */
  logToolCall(sessionId: string, record: Omit<ToolCallRecord, 'timestamp'>): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.toolCallLog.push({ ...record, timestamp: Date.now() });
    // 최대 20개 도구 호출 유지
    if (s.toolCallLog.length > 20) s.toolCallLog.shift();
    this.saveToPersistence();
  }

  /** 세션을 완료 처리합니다 */
  completeSession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.state = 'completed';
    s.tasksCompleted++;
    s.lastActiveAt = Date.now();
    this.saveToPersistence();
  }

  /** 세션을 일시 중지합니다 */
  pauseSession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.state = 'paused';
    s.lastActiveAt = Date.now();
    this.saveToPersistence();
  }

  /** 모든 세션 목록을 반환합니다 */
  getAllSessions(): ManagedAgentSession[] {
    return Array.from(this.sessions.values());
  }

  /** 세션 현황 요약 텍스트 (CLI /session 명령용) */
  getSummary(): string {
    const all = this.getAllSessions();
    if (all.length === 0) {
      return [
        '╔══════════════════════════════════════════════════╗',
        '║  📋  Managed Agent Sessions                       ║',
        '╚══════════════════════════════════════════════════╝',
        '',
        '  활성 세션 없음. 에이전트에게 작업을 배정하면 세션이 시작됩니다.',
        '',
        '  Anthropic Managed Agents 구조:',
        '  [Quickstart] → 빠른 1회성 실행',
        '  [Agent]      → 역할별 하네스(시스템 프롬프트+툴) 설정',
        '  [Session]    → 에이전트 × 작업 × 메모리 상태 유지',
      ].join('\n');
    }

    const stateIcon: Record<SessionState, string> = {
      idle: '⚪', active: '🟢', paused: '🟡', completed: '✅', error: '🔴',
    };

    const rows = all.slice(-10).map(s => {
      const age = Math.round((Date.now() - s.createdAt) / 1000);
      const mem = s.contextMemory.length;
      const tools = s.toolCallLog.length;
      return `  ${stateIcon[s.state]} ${s.id.padEnd(28)} mem:${mem} tools:${tools} ${age}s`;
    });

    return [
      '╔══════════════════════════════════════════════════════════════╗',
      '║  📋  Managed Agent Sessions (최근 10개)                      ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      `  전체: ${all.length}개 | 활성: ${all.filter(s => s.state === 'active').length}개 | 완료: ${all.filter(s => s.state === 'completed').length}개`,
      '',
      ...rows,
      '',
      '  /session <id> 로 특정 세션 메모리 조회',
    ].join('\n');
  }

  /** 특정 세션 상세 정보 */
  getSessionDetail(sessionId: string): string {
    const s = this.sessions.get(sessionId);
    if (!s) return `❌ 세션을 찾을 수 없습니다: ${sessionId}`;

    const memLines = s.contextMemory.slice(-5).map(m => `  │ ${m}`).join('\n');
    const toolLines = s.toolCallLog.slice(-3).map(t =>
      `  │ ${t.toolName} (${t.durationMs}ms): ${t.output.substring(0, 50)}`
    ).join('\n');

    return [
      `🔍 세션 상세: ${s.id}`,
      `  에이전트: ${s.agentId} (${s.role})`,
      `  상태: ${s.state}`,
      `  현재 태스크: ${s.currentTask ?? '없음'}`,
      `  토큰 사용량: ~${s.estimatedTokensUsed}`,
      `  완료 태스크: ${s.tasksCompleted}`,
      ``,
      `  📝 최근 메모리 (${s.contextMemory.length}개 중 최근 5개):`,
      memLines || '  │ (없음)',
      ``,
      `  🛠️ 최근 도구 호출 (${s.toolCallLog.length}개 중 최근 3개):`,
      toolLines || '  │ (없음)',
    ].join('\n');
  }
}

/** 글로벌 세션 매니저 싱글톤 */
export const sessionManager = ManagedAgentSessionManager.getInstance();

