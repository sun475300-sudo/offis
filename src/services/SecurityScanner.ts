export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: VulnerabilitySeverity;
  file?: string;
  line?: number;
  code?: string;
  recommendation: string;
  cwe?: string;
}

export interface ScanResult {
  timestamp: number;
  vulnerabilities: Vulnerability[];
  scannedFiles: number;
  scanDuration: number;
}

export interface SecurityRule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: VulnerabilitySeverity;
  message: string;
  cwe?: string;
}

export class SecurityScanner {
  private static instance: SecurityScanner;
  private rules: SecurityRule[] = [];
  private lastScan: ScanResult | null = null;

  private constructor() {
    this.registerDefaultRules();
  }

  static getInstance(): SecurityScanner {
    if (!SecurityScanner.instance) {
      SecurityScanner.instance = new SecurityScanner();
    }
    return SecurityScanner.instance;
  }

  private registerDefaultRules(): void {
    this.addRule({
      id: 'hardcoded-secret',
      name: 'Hardcoded Secret',
      pattern: /(apiKey|apikey|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      severity: 'critical',
      message: '하드코딩된 시크릿이 발견되었습니다.',
      cwe: 'CWE-798'
    });

    this.addRule({
      id: 'eval-usage',
      name: 'Eval Usage',
      pattern: /\beval\s*\(/g,
      severity: 'high',
      message: 'eval() 사용은 보안 위험이 될 수 있습니다.',
      cwe: 'CWE-95'
    });

    this.addRule({
      id: 'innerHTML',
      name: 'InnerHTML Usage',
      pattern: /\.innerHTML\s*=/g,
      severity: 'medium',
      message: 'innerHTML 사용은 XSS 취약점을 유발할 수 있습니다.',
      cwe: 'CWE-79'
    });

    this.addRule({
      id: 'console-log-sensitive',
      name: 'Console Log Sensitive',
      pattern: /console\.(log|info|warn)\([^)]*(password|secret|token|key)[^)]*\)/gi,
      severity: 'medium',
      message: '민감한 정보를 console.log로 출력하고 있습니다.',
      cwe: 'CWE-489'
    });

    this.addRule({
      id: 'sql-injection',
      name: 'Potential SQL Injection',
      pattern: /(query|sql|select|insert|update|delete).*\+.*[\'"`](?!\s*\$)/gi,
      severity: 'high',
      message: 'SQL 인젝션 가능성이 있는 동적 쿼리가 발견되었습니다.',
      cwe: 'CWE-89'
    });

    this.addRule({
      id: 'weak-random',
      name: 'Weak Random',
      pattern: /Math\.random\(\)/g,
      severity: 'low',
      message: '보안이 필요한 경우 Math.random() 대신 crypto.getRandomValues()를 사용하세요.',
      cwe: 'CWE-338'
    });
  }

  addRule(rule: SecurityRule): void {
    this.rules.push(rule);
  }

  removeRule(id: string): boolean {
    const index = this.rules.findIndex(r => r.id === id);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  scan(code: string, filename = 'unknown'): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    for (const rule of this.rules) {
      const matches = code.matchAll(rule.pattern);
      for (const match of matches) {
        const lineNumber = code.substring(0, match.index).split('\n').length;
        vulnerabilities.push({
          id: `${rule.id}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          title: rule.name,
          description: rule.message,
          severity: rule.severity,
          file: filename,
          line: lineNumber,
          code: match[0],
          recommendation: this.getRecommendation(rule),
          cwe: rule.cwe
        });
      }
    }

    return vulnerabilities;
  }

  scanMultiple(files: { name: string; content: string }[]): ScanResult {
    const startTime = Date.now();
    const allVulnerabilities: Vulnerability[] = [];

    for (const file of files) {
      const vulns = this.scan(file.content, file.name);
      allVulnerabilities.push(...vulns);
    }

    const result: ScanResult = {
      timestamp: Date.now(),
      vulnerabilities: allVulnerabilities,
      scannedFiles: files.length,
      scanDuration: Date.now() - startTime
    };

    this.lastScan = result;
    return result;
  }

  private getRecommendation(rule: SecurityRule): string {
    switch (rule.id) {
      case 'hardcoded-secret':
        return '환경 변수 또는 시크릿 관리자를 사용하세요.';
      case 'eval-usage':
        return 'eval() 대신 JSON.parse() 또는 함수를 사용하세요.';
      case 'innerHTML':
        return 'textContent 또는 DOMPurify를 사용하세요.';
      case 'console-log-sensitive':
        return '민감한 정보는 로깅하지 마세요.';
      case 'sql-injection':
        return '파라미터화된 쿼리를 사용하세요.';
      case 'weak-random':
        return 'crypto.getRandomValues()를 사용하세요.';
      default:
        return '코드를 검토하고 수정하세요.';
    }
  }

  getLastScan(): ScanResult | null {
    return this.lastScan;
  }

  getVulnerabilityCountBySeverity(): Record<VulnerabilitySeverity, number> {
    if (!this.lastScan) return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    
    const counts: Record<VulnerabilitySeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const v of this.lastScan.vulnerabilities) {
      counts[v.severity]++;
    }
    return counts;
  }
}

export const securityScanner = SecurityScanner.getInstance();