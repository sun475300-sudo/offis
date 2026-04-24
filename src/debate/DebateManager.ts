import { AgentRole, ReviewResult, ReviewFinding } from '../types';

export interface DebateTurn {
  turn: number;
  speakerId: string;
  speakerRole: AgentRole;
  message: string;
  findings: ReviewFinding[];
  agreement: boolean;
  timestamp: number;
}

export interface DebateSession {
  id: string;
  code: string;
  projectName: string;
  turns: DebateTurn[];
  currentTurn: number;
  maxTurns: number;
  status: 'active' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  finalConclusion?: string;
}

export interface DebateParticipant {
  id: string;
  name: string;
  role: AgentRole;
  perspective: string;
  focus: string[];
}

const DEBATE_PARTICIPANTS: DebateParticipant[] = [
  {
    id: 'review-architect',
    name: '수석 아키텍트',
    role: AgentRole.Architect,
    perspective: '구조적 건강성과 확장성',
    focus: ['의존성 관리', '모듈 분리', '디자인 패턴', '코드 가독성'],
  },
  {
    id: 'review-security',
    name: '보안/QA 엔지니어',
    role: AgentRole.SecurityEngineer,
    perspective: '보안 취약점과 버그 가능성',
    focus: ['입력 검증', '에러 처리', '엣지 케이스', '권한 관리'],
  },
  {
    id: 'review-performance',
    name: '성능 전문가',
    role: AgentRole.PerformanceEngineer,
    perspective: '실행 효율성과 리소스 사용',
    focus: ['알고리즘 복잡도', '메모리 사용', 'I/O 최적화', '캐싱'],
  },
];

export class DebateManager {
  private sessions: Map<string, DebateSession> = new Map();
  private tokenUsage: number = 0;
  private debateDelay: number = 300;

  async startDebate(code: string, projectName: string): Promise<DebateSession> {
    const sessionId = `debate-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const session: DebateSession = {
      id: sessionId,
      code,
      projectName,
      turns: [],
      currentTurn: 0,
      maxTurns: 3,
      status: 'active',
      startedAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async runDebate(sessionId: string): Promise<DebateSession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    for (let turn = 0; turn < session.maxTurns; turn++) {
      for (const participant of DEBATE_PARTICIPANTS) {
        await this.delay(this.debateDelay);

        const previousTurns = session.turns.slice(-3);
        const response = await this.generateResponse(participant, session.code, previousTurns);

        session.turns.push({
          turn: turn + 1,
          speakerId: participant.id,
          speakerRole: participant.role,
          message: response.message,
          findings: response.findings,
          agreement: response.agreement,
          timestamp: Date.now(),
        });

        this.tokenUsage += Math.floor(response.message.length / 4);
      }

      session.currentTurn = turn + 1;

      const allAgreed = session.turns.slice(-3).every(t => t.agreement);
      if (allAgreed && turn >= 1) {
        break;
      }
    }

    session.status = 'completed';
    session.completedAt = Date.now();
    session.finalConclusion = this.generateConclusion(session);

    return session;
  }

  private async generateResponse(
    participant: DebateParticipant,
    code: string,
    previousTurns: DebateTurn[]
  ): Promise<{ message: string; findings: ReviewFinding[]; agreement: boolean }> {
    await this.delay(this.debateDelay);

    const findings: ReviewFinding[] = [];
    let agreement = true;
    let message = '';

    switch (participant.role) {
      case AgentRole.Architect:
        if (code.includes('any')) {
          findings.push({
            severity: 'medium',
            category: 'Type Safety',
            description: 'TypeScript any 타입 사용 발견',
            suggestion: '제네릭이나 구체적 타입을 사용하세요',
          });
          agreement = false;
        }
        message = `[${participant.name}] 코드 구조를 검토했습니다. ${findings.length > 0 ? '의존성 관리와 타입 안전성에 개선이 필요합니다.' : '전반적으로 양호한 구조입니다.'}`;
        break;

      case AgentRole.SecurityEngineer:
        if (code.includes('eval(') || code.includes('innerHTML')) {
          findings.push({
            severity: 'high',
            category: 'Security',
            description: '잠재적 XSS 취약점 발견',
            suggestion: '안전한 API를 사용하세요',
          });
          agreement = false;
        }
        if (code.includes('catch {}')) {
          findings.push({
            severity: 'medium',
            category: 'Error Handling',
            description: '빈 catch 블록으로 에러 무시 가능',
            suggestion: '에러를 로깅하거나 적절히 처리하세요',
          });
          agreement = false;
        }
        message = `[${participant.name}] 보안 측면에서 ${findings.length}개의 문제점을 발견했습니다. ${findings.length > 0 ? '아키텍트의 의견에 추가로 보안 강화가 필요합니다.' : '보안 측면에서 양호합니다.'}`;
        break;

      case AgentRole.PerformanceEngineer:
        if (code.includes('for (') && code.length > 500) {
          findings.push({
            severity: 'low',
            category: 'Performance',
            description: '반복문 최적화 검토 필요',
            suggestion: '함수형 메서드 사용을 고려하세요',
          });
        }
        if (previousTurns.length > 0 && previousTurns.some(t => !t.agreement)) {
          agreement = false;
          message = `[${participant.name}] 동료들의 의견을 검토했습니다. ${findings.length > 0 ? '성능 최적화도 함께 진행해야 합니다.' : '성능 측면에서는 큰 문제가 없으나, 보안 이슈를 먼저 해결하는 것을 권장합니다.'}`;
        } else {
          agreement = findings.length === 0;
          message = `[${participant.name}] 성능 분석을 완료했습니다. ${findings.length > 0 ? '최적화 포인트가 발견되었습니다.' : '성능이 양호합니다.'}`;
        }
        break;
    }

    return { message, findings, agreement };
  }

  private generateConclusion(session: DebateSession): string {
    const allFindings = session.turns.flatMap(t => t.findings);
    const critical = allFindings.filter(f => f.severity === 'critical').length;
    const high = allFindings.filter(f => f.severity === 'high').length;
    const medium = allFindings.filter(f => f.severity === 'medium').length;

    if (critical > 0) return '치명적인 문제가 발견되어 즉시 수정이 필요합니다.';
    if (high > 0) return '높은 우선순위의 문제가 있습니다. 수정을 권장합니다.';
    if (medium > 0) return '중간 우선순위의 개선 사항이 있습니다.';
    return '전반적으로 양호한 코드입니다. 사소한 개선만 권장합니다.';
  }

  getSession(id: string): DebateSession | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): DebateSession[] {
    return Array.from(this.sessions.values());
  }

  getTokenUsage(): number {
    return this.tokenUsage;
  }

  getParticipants(): DebateParticipant[] {
    return DEBATE_PARTICIPANTS;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
