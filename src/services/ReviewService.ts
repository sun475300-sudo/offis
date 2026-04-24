import {
  AgentRole,
  ReviewType,
  ReviewTask,
  ReviewResult,
  ReviewFinding,
  AggregatedReviewReport,
  AgentSnapshot,
} from '../types';

export class ReviewService {
  private currentTask: ReviewTask | null = null;

  async startReview(code: string, language: string = 'typescript'): Promise<ReviewTask[]> {
    const tasks: ReviewTask[] = [
      {
        id: 'review-architecture',
        code,
        language,
        reviewType: ReviewType.Architecture,
        status: 'pending',
      },
      {
        id: 'review-bugs',
        code,
        language,
        reviewType: ReviewType.BugsAndSecurity,
        status: 'pending',
      },
      {
        id: 'review-performance',
        code,
        language,
        reviewType: ReviewType.Performance,
        status: 'pending',
      },
    ];

    this.currentTask = tasks[0];
    return tasks;
  }

  async runParallelReview(code: string, language: string = 'typescript'): Promise<AggregatedReviewReport> {
    const [architectureResult, bugsResult, performanceResult] = await Promise.all([
      this.analyzeArchitecture(code, language),
      this.findBugsAndSecurity(code, language),
      this.optimizeCode(code, language),
    ]);

    const totalScore = Math.round(
      (architectureResult.score + bugsResult.score + performanceResult.score) / 3
    );

    const allFindings = [
      ...architectureResult.findings,
      ...bugsResult.findings,
      ...performanceResult.findings,
    ];

    const allRecommendations = [
      ...architectureResult.recommendations,
      ...bugsResult.recommendations,
      ...performanceResult.recommendations,
    ];

    return {
      totalScore,
      architectureScore: architectureResult.score,
      bugsScore: bugsResult.score,
      performanceScore: performanceResult.score,
      findings: allFindings.sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity)),
      summary: this.generateSummary(architectureResult, bugsResult, performanceResult),
      recommendations: allRecommendations,
      reviewedBy: {
        architect: '수석 아키텍트',
        securityEngineer: '보안/QA 엔지니어',
        performanceEngineer: '성능 최적화 전문가',
      },
      timestamp: Date.now(),
    };
  }

  private async analyzeArchitecture(code: string, language: string): Promise<ReviewResult> {
    await this.delay(300);

    const findings: ReviewFinding[] = [];
    let score = 85;

    if (code.includes('any') && language.includes('typescript')) {
      findings.push({
        severity: 'medium',
        category: 'Type Safety',
        description: '`any` 타입 사용으로 타입 안전성이 저하됩니다.',
        suggestion: '적절한 타입을 정의하거나 generic을 사용하세요.',
      });
      score -= 5;
    }

    if (!code.includes('interface') && !code.includes('type ') && code.length > 500) {
      findings.push({
        severity: 'medium',
        category: 'Code Organization',
        description: '인터페이스나 타입 정의를 찾아볼 수 없습니다.',
        suggestion: '코드 재사용을 위해 타입을 분리하세요.',
      });
      score -= 5;
    }

    if (code.includes('import * as') && language.includes('typescript')) {
      findings.push({
        severity: 'low',
        category: 'Import Optimization',
        description: '전체 모듈 import가 있습니다.',
        suggestion: '필요한 항목만 명시적으로 import하세요.',
      });
      score -= 3;
    }

    if (!code.includes('export') && code.length > 200) {
      findings.push({
        severity: 'info',
        category: 'Module Design',
        description: 'export된 멤버가 없습니다. 모듈화를 확인하세요.',
      });
      score -= 2;
    }

    return {
      type: ReviewType.Architecture,
      score: Math.max(0, score),
      findings,
      summary: '전체적인 아키텍처 구조는 양호합니다. 타입 안전성과 모듈화 측면에서 개선이 필요합니다.',
      recommendations: [
        'any 타입 사용을 금지하고 strict 모드 활성화',
        '공통 타입을 별도 파일로 분리',
        ' barrel pattern (index.ts) 활용하여 import 경로 단순화',
      ],
    };
  }

  private async findBugsAndSecurity(code: string, language: string): Promise<ReviewResult> {
    await this.delay(2500);

    const findings: ReviewFinding[] = [];
    let score = 90;

    if (code.includes('catch {}') || code.includes('catch(e){}')) {
      findings.push({
        severity: 'critical',
        category: 'Error Handling',
        description: '빈 catch 블록으로 에러가 무시됩니다.',
        suggestion: '에러를 로깅하거나 적절히 처리하세요.',
      });
      score -= 15;
    }

    if (code.includes('eval(')) {
      findings.push({
        severity: 'critical',
        category: 'Security',
        description: 'eval() 사용은 보안 취약점을 야기할 수 있습니다.',
        suggestion: 'eval 사용을 피하고 안전한 대안을 사용하세요.',
      });
      score -= 20;
    }

    if (code.includes('password') && !code.includes('encrypt') && !code.includes('hash')) {
      findings.push({
        severity: 'high',
        category: 'Security',
        description: '비밀번호가 평문으로 저장되거나 전송될 수 있습니다.',
        suggestion: '해싱이나 암호화를 적용하세요.',
      });
      score -= 10;
    }

    if (code.includes('TODO') || code.includes('FIXME')) {
      findings.push({
        severity: 'low',
        category: 'Code Quality',
        description: 'TODO/FIXME 주석이 있습니다. 미완성 코드입니다.',
        suggestion: '완료 후 주석을 제거하거나 Jira 티켓을 연결하세요.',
      });
      score -= 3;
    }

    if (!code.includes('null') && !code.includes('undefined') && code.includes('==')) {
      findings.push({
        severity: 'medium',
        category: 'Comparison',
        description: '느슨한 비교(==)를 사용합니다.',
        suggestion: '=== 를 사용하여厳密한 비교를 하세요.',
      });
      score -= 5;
    }

    if (code.includes('console.log') && code.length > 1000) {
      findings.push({
        severity: 'info',
        category: 'Debug Code',
        description: '콘솔 로그가 다수 포함되어 있습니다.',
        suggestion: '프로덕션 환경에서는 제거하세요.',
      });
      score -= 2;
    }

    return {
      type: ReviewType.BugsAndSecurity,
      score: Math.max(0, score),
      findings,
      summary: '보안 및 버그 측면에서 일부 문제가 발견되었습니다. критические 문제는 우선 수정하세요.',
      recommendations: [
        '에러 처리 로직 보강',
        '보안 취약점 검토 (입력값 검증, 암호화)',
        'console.log 제거 또는 로깅 라이브러리로 교체',
      ],
    };
  }

  private async optimizeCode(code: string, language: string): Promise<ReviewResult> {
    await this.delay(350);

    const findings: ReviewFinding[] = [];
    let score = 88;

    if (code.includes('for (') && code.includes('forEach')) {
      findings.push({
        severity: 'medium',
        category: 'Performance',
        description: '중첩된 반복문이 있습니다. 성능 병목이 될 수 있습니다.',
        suggestion: 'map, filter, reduce 등의 함수형 메서드 사용을 고려하세요.',
      });
      score -= 8;
    }

    if (code.includes('document.querySelectorAll') || code.includes('getElementsBy')) {
      findings.push({
        severity: 'medium',
        category: 'DOM Performance',
        description: 'DOM 쿼리가 반복적으로 호출될 수 있습니다.',
        suggestion: '변수에 캐시하거나 useMemo를 사용하세요.',
      });
      score -= 5;
    }

    if (code.includes('JSON.parse') && code.includes('JSON.stringify')) {
      findings.push({
        severity: 'low',
        category: 'Serialization',
        description: '빈번한 JSON 직렬화/역직렬화가 있습니다.',
        suggestion: '불필요한 변환을 줄이세요.',
      });
      score -= 3;
    }

    if (code.includes('setInterval') || code.includes('setTimeout')) {
      findings.push({
        severity: 'info',
        category: 'Async',
        description: '타이머 함수가 사용되었습니다.',
        suggestion: '메모리 누수를 방지하기 위해 clearTimeout/clearInterval을 확인하세요.',
      });
      score -= 2;
    }

    const lineCount = code.split(/\r?\n/).length;
    if (lineCount > 500) {
      findings.push({
        severity: 'low',
        category: 'Code Size',
        description: `파일이 ${lineCount}줄입니다 (500줄 초과).`,
        suggestion: '코드 스플리팅을 고려하세요.',
      });
      score -= 3;
    }

    return {
      type: ReviewType.Performance,
      score: Math.max(0, score),
      findings,
      summary: '대체로 성능이 양호합니다. 반복문 최적화와 DOM 접근 방식을 개선하면 더 나은 성능을 기대할 수 있습니다.',
      recommendations: [
        '반복문 내부의 expensive 연산 최소화',
        'React에서는 useMemo, useCallback 활용',
        '불필요한 리-렌더링 방지',
      ],
    };
  }

  private generateSummary(
    architecture: ReviewResult,
    bugs: ReviewResult,
    performance: ReviewResult
  ): string {
    const scores = [architecture.score, bugs.score, performance.score];
    const avg = scores.reduce((a, b) => a + b, 0) / 3;

    if (avg >= 90) {
      return '전반적인 코드 품질이 우수합니다. 몇 가지 개선 사항이 있으나 즉시 수정할 필요는 없습니다.';
    } else if (avg >= 75) {
      return '코드 품질이 양호합니다. 권장 사항들을 반영하여 점진적으로 개선하세요.';
    } else if (avg >= 60) {
      return '코드 개선이 필요합니다. 특히 중요한 문제부터 수정하기를 권장합니다.';
    } else {
      return '코드 품질 관리가 시급합니다. 심각한 문제들을 우선적으로 수정하세요.';
    }
  }

  private getSeverityWeight(severity: string): number {
    const weights: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
      info: 0,
    };
    return weights[severity] || 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  formatReviewReport(report: AggregatedReviewReport): string {
    const severityEmoji: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
      info: '🔵',
    };

    let md = `# 📋 코드 리뷰 종합 리포트\n\n`;
    md += `## 🎯 Overall Score: **${report.totalScore}/100**\n\n`;
    md += `| 구분 | 점수 |\n`;
    md += `|------|------|\n`;
    md += `| 🏗️ 아키텍처 | ${report.architectureScore}/100 |\n`;
    md += `| 🐛 보안/버그 | ${report.bugsScore}/100 |\n`;
    md += `| ⚡ 성능 | ${report.performanceScore}/100 |\n\n`;
    md += `---\n\n`;
    md += `## 📝 요약\n\n${report.summary}\n\n`;
    md += `---\n\n`;
    md += `## 🔍 발견된 문제들 (${report.findings.length}건)\n\n`;

    for (const finding of report.findings.slice(0, 10)) {
      md += `### ${severityEmoji[finding.severity]} [${finding.severity.toUpperCase()}] ${finding.category}\n`;
      md += `> ${finding.description}\n`;
      if (finding.suggestion) {
        md += `**해결 방안:** ${finding.suggestion}\n`;
      }
      if (finding.line) {
        md += `**위치:** Line ${finding.line}\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
    md += `## 💡 권장 사항\n\n`;
    for (const rec of report.recommendations) {
      md += `- ${rec}\n`;
    }

    md += `\n---\n\n`;
    md += `## 👥 리뷰어\n\n`;
    md += `- 🏗️ ${report.reviewedBy.architect}\n`;
    md += `- 🛡️ ${report.reviewedBy.securityEngineer}\n`;
    md += `- ⚡ ${report.reviewedBy.performanceEngineer}\n\n`;
    md += `*生成 시간: ${new Date(report.timestamp).toLocaleString('ko-KR')}*`;

    return md;
  }
}
