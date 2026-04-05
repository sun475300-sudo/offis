export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  maxFileSize: number;
  maxFiles: number;
  format: 'json' | 'text';
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private logQueue: LogEntry[] = [];
  private flushInterval: number | null = null;
  private sources: Set<string> = new Set();

  private constructor() {
    this.config = {
      minLevel: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      maxFileSize: 5 * 1024 * 1024,
      maxFiles: 5,
      format: 'text'
    };
    this.startFlushLoop();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.minLevel;
  }

  private formatEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }
    const levelStr = LogLevel[entry.level];
    const time = entry.timestamp.toISOString();
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `[${time}] [${levelStr}] [${entry.source}] ${entry.message}${dataStr}`;
  }

  private log(entry: LogEntry): void {
    this.logs.push(entry);
    this.logQueue.push(entry);

    if (this.config.enableConsole) {
      const formatted = this.formatEntry(entry);
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(formatted);
          break;
        case LogLevel.INFO:
          console.info(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(formatted);
          break;
      }
    }

    this.sources.add(entry.source);
  }

  debug(source: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log({
        timestamp: new Date(),
        level: LogLevel.DEBUG,
        source,
        message,
        data
      });
    }
  }

  info(source: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log({
        timestamp: new Date(),
        level: LogLevel.INFO,
        source,
        message,
        data
      });
    }
  }

  warn(source: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log({
        timestamp: new Date(),
        level: LogLevel.WARN,
        source,
        message,
        data
      });
    }
  }

  error(source: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log({
        timestamp: new Date(),
        level: LogLevel.ERROR,
        source,
        message,
        data
      });
    }
  }

  fatal(source: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      this.log({
        timestamp: new Date(),
        level: LogLevel.FATAL,
        source,
        message,
        data
      });
    }
  }

  private startFlushLoop(): void {
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, 5000);
  }

  flush(): void {
    if (this.logQueue.length > 0) {
      this.logQueue = [];
    }
  }

  getLogs(level?: LogLevel, source?: string): LogEntry[] {
    let filtered = this.logs;
    if (level !== undefined) {
      filtered = filtered.filter(e => e.level === level);
    }
    if (source) {
      filtered = filtered.filter(e => e.source === source);
    }
    return filtered;
  }

  getSources(): string[] {
    return Array.from(this.sources);
  }

  clear(): void {
    this.logs = [];
    this.logQueue = [];
  }

  exportLogs(): string {
    return this.logs.map(e => this.formatEntry(e)).join('\n');
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

export const logger = Logger.getInstance();