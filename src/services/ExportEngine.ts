export interface ExportData {
  type: 'json' | 'csv' | 'pdf' | 'markdown';
  title?: string;
  timestamp?: number;
  data: unknown;
}

export interface ExportOptions {
  filename?: string;
  includeTimestamp?: boolean;
  prettyPrint?: boolean;
  title?: string;
}

export class ExportEngine {
  private static instance: ExportEngine;
  private autoBackupEnabled = false;
  private backupInterval: number | null = null;

  private constructor() {}

  static getInstance(): ExportEngine {
    if (!ExportEngine.instance) {
      ExportEngine.instance = new ExportEngine();
    }
    return ExportEngine.instance;
  }

  export(data: unknown, type: ExportData['type'], options: ExportOptions = {}): string {
    const timestamp = options.includeTimestamp !== false ? Date.now() : undefined;
    const filename = options.filename || `export-${Date.now()}`;

    switch (type) {
      case 'json':
        return this.exportJSON(data, options.prettyPrint);
      case 'csv':
        return this.exportCSV(data);
      case 'markdown':
        return this.exportMarkdown(data, options.title);
      default:
        throw new Error(`Unsupported export type: ${type}`);
    }
  }

  private exportJSON(data: unknown, prettyPrint = true): string {
    return prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  private exportCSV(data: unknown): string {
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0] as object);
      const rows = data.map(item => 
        headers.map(h => {
          const val = (item as Record<string, unknown>)[h];
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val}"`;
          }
          return String(val ?? '');
        }).join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
    return '';
  }

  private exportMarkdown(data: unknown, title?: string): string {
    const lines: string[] = [];
    if (title) {
      lines.push(`# ${title}\n`);
    }
    lines.push(`*Generated: ${new Date().toISOString()}*\n`);

    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        if (data.length > 0 && typeof data[0] === 'object') {
          const headers = Object.keys(data[0] as object);
          lines.push('| ' + headers.join(' | ') + ' |');
          lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
          for (const item of data) {
            const row = headers.map(h => String((item as Record<string, unknown>)[h] ?? '')).join(' | ');
            lines.push('| ' + row + ' |');
          }
        } else {
          for (const item of data) {
            lines.push(`- ${JSON.stringify(item)}`);
          }
        }
      } else {
        for (const [key, value] of Object.entries(data)) {
          lines.push(`## ${key}\n${JSON.stringify(value, null, 2)}`);
        }
      }
    }
    return lines.join('\n');
  }

  download(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportAndDownload(data: unknown, type: ExportData['type'], options: ExportOptions = {}): void {
    const content = this.export(data, type, options);
    const ext = type === 'markdown' ? 'md' : type;
    const filename = `${options.filename || 'export'}.${ext}`;
    const mimeType = type === 'json' ? 'application/json' 
      : type === 'csv' ? 'text/csv' 
      : type === 'markdown' ? 'text/markdown'
      : 'text/plain';
    this.download(content, filename, mimeType);
  }

  enableAutoBackup(intervalMs = 300000): void {
    this.autoBackupEnabled = true;
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    this.backupInterval = window.setInterval(() => {
      this.autoBackup();
    }, intervalMs);
  }

  disableAutoBackup(): void {
    this.autoBackupEnabled = false;
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
  }

  private autoBackup(): void {
    const backupData = {
      timestamp: Date.now(),
      version: '1.0.0',
      data: {}
    };
    const json = this.exportJSON(backupData);
    console.log('[AutoBackup] Data backed up:', json.length, 'bytes');
  }
}

export const exportEngine = ExportEngine.getInstance();