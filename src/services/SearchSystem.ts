export interface SearchResult {
  id: string;
  type: 'agent' | 'task' | 'meeting' | 'notification' | 'log' | 'command';
  title: string;
  subtitle?: string;
  score: number;
  data: unknown;
}

export interface SearchOptions {
  types?: string[];
  limit?: number;
  fuzzy?: boolean;
  since?: number;
}

export class SearchSystem {
  private static instance: SearchSystem;
  private history: { query: string; timestamp: number; results: number }[] = [];
  private maxHistory = 100;

  private constructor() {}

  static getInstance(): SearchSystem {
    if (!SearchSystem.instance) {
      SearchSystem.instance = new SearchSystem();
    }
    return SearchSystem.instance;
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const results: SearchResult[] = [];
    const limit = options.limit || 20;
    const queryLower = query.toLowerCase();

    this.recordQuery(query);

    if (!options.types || options.types.includes('agent')) {
      results.push(...this.searchAgents(queryLower, options));
    }
    if (!options.types || options.types.includes('task')) {
      results.push(...this.searchTasks(queryLower, options));
    }
    if (!options.types || options.types.includes('command')) {
      results.push(...this.searchCommands(query, options));
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private searchAgents(query: string, options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    return results;
  }

  private searchTasks(query: string, options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    return results;
  }

  private searchCommands(query: string, options: SearchOptions): SearchResult[] {
    const commands = [
      { id: '/test', title: '테스트 실행', subtitle: 'Run tests' },
      { id: '/debate', title: '토론 시작', subtitle: 'Start debate' },
      { id: '/meeting', title: '미팅 시작', subtitle: 'Start meeting' },
      { id: '/stats', title: '통계 표시', subtitle: 'Show stats' },
      { id: '/help', title: '도움말', subtitle: 'Show help' }
    ];

    // Normalize once so title matching is case-insensitive and the exact
    // match scoring actually fires when the user types the id in any case.
    const q = query.toLowerCase();
    return commands
      .filter(c => c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
      .map(c => ({
        id: c.id,
        type: 'command' as const,
        title: c.title,
        subtitle: c.subtitle,
        score: q === c.id.toLowerCase() ? 1 : 0.5,
        data: c
      }));
  }

  private recordQuery(query: string): void {
    this.history.unshift({ query, timestamp: Date.now(), results: 0 });
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
  }

  getHistory(): { query: string; timestamp: number }[] {
    return this.history.map(h => ({ query: h.query, timestamp: h.timestamp }));
  }

  clearHistory(): void {
    this.history = [];
  }

  getRecentSearches(count = 10): string[] {
    return this.history.slice(0, count).map(h => h.query);
  }
}

export const searchSystem = SearchSystem.getInstance();