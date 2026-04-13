export interface GitHubRepo {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  downloadUrl?: string;
  content?: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface RepoAnalysis {
  repo: GitHubRepo;
  fileCount: number;
  totalSize: number;
  languages: Record<string, number>;
  recentCommits: GitHubCommit[];
  structure: GitHubFile[];
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  createdAt: string;
  headBranch: string;
  baseBranch: string;
  changedFiles: number;
  additions: number;
  deletions: number;
}

export interface GitHubPRFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
  contentsUrl: string;
}

export class GitHubService {
  private token: string = '';
  private baseUrl: string = 'https://api.github.com';

  constructor() {
    // Auto-detect GitHub token from Vite environment
    const envToken = (import.meta as any).env?.VITE_GITHUB_TOKEN;
    if (envToken) {
      this.token = envToken;
      console.log('[GitHubService] 🟢 Auto-detected GITHUB_TOKEN — real API enabled');
    } else {
      console.log('[GitHubService] ⚪ No VITE_GITHUB_TOKEN found — API calls will be unauthenticated (rate limited)');
    }
  }

  setToken(token: string): void {
    this.token = token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private getHeaders(acceptDiff = false): HeadersInit {
    const headers: HeadersInit = {
      'Accept': acceptDiff ? 'application/vnd.github.v3.diff' : 'application/vnd.github.v3+json',
    };
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }
    return headers;
  }

  /** Fetch open pull requests for a repo */
  async getPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequest[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls?state=${state}&per_page=10`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) throw new Error(`GitHub PR API error: ${response.status}`);
      const data = await response.json();
      return data.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: pr.state,
        author: pr.user?.login || 'unknown',
        createdAt: pr.created_at,
        headBranch: pr.head?.ref || '',
        baseBranch: pr.base?.ref || 'main',
        changedFiles: pr.changed_files || 0,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
      }));
    } catch (e) {
      console.warn('[GitHubService] getPullRequests failed:', e);
      return [];
    }
  }

  /** Fetch the raw unified diff for a specific PR */
  async getPRDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
    try {
      const response = await fetch(url, { headers: this.getHeaders(true) });
      if (!response.ok) throw new Error(`GitHub Diff API error: ${response.status}`);
      return await response.text();
    } catch (e) {
      console.warn('[GitHubService] getPRDiff failed:', e);
      return '';
    }
  }



  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      description: data.description || '',
      defaultBranch: data.default_branch,
      language: data.language || 'Unknown',
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getContents(owner: string, repo: string, path: string = ''): Promise<GitHubFile[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : [data];

    return items.map((item: any) => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size || 0,
      downloadUrl: item.download_url,
    }));
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.content) {
      return atob(data.content);
    }
    return '';
  }

  async getCommits(owner: string, repo: string, limit: number = 10): Promise<GitHubCommit[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/commits?per_page=${limit}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return data.map((commit: any) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author.name,
      date: commit.commit.author.date,
    }));
  }

  async getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/languages`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return await response.json();
  }

  async analyzeRepo(owner: string, repo: string): Promise<RepoAnalysis> {
    const [repoInfo, contents, commits, languages] = await Promise.all([
      this.getRepo(owner, repo),
      this.getContents(owner, repo),
      this.getCommits(owner, repo, 5),
      this.getLanguages(owner, repo),
    ]);

    let fileCount = 0;
    let totalSize = 0;

    for (const item of contents) {
      if (item.type === 'file') {
        fileCount++;
        totalSize += item.size;
      }
    }

    return {
      repo: repoInfo,
      fileCount,
      totalSize,
      languages,
      recentCommits: commits,
      structure: contents,
    };
  }

  parseRepoUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
    return null;
  }

  parsePRUrl(url: string): { owner: string; repo: string; prNumber: number } | null {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        prNumber: parseInt(match[3]),
      };
    }
    return null;
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitHubPullRequest> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state,
      author: data.user.login,
      createdAt: data.created_at,
      headBranch: data.head?.ref || '',
      baseBranch: data.base?.ref || '',
      changedFiles: data.changed_files,
      additions: data.additions,
      deletions: data.deletions,
    };
  }

  async getPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<GitHubPRFile[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return data.map((file: any) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
      contentsUrl: file.contents_url,
    }));
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
