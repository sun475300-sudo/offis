import express, { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';

const app = express();

// --- Security: CORS whitelist ---
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true,
}));

// --- Security: Headers ---
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

app.use(express.json({ limit: '1mb' }));

// --- Security: Simple rate limiter ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    next();
    return;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests. Try again later.' });
    return;
  }

  next();
}

app.use(rateLimit);

// --- Security: API key middleware (optional, set OFFIS_API_KEY env var) ---
const API_KEY = process.env.OFFIS_API_KEY;

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    // No key configured — allow all (dev mode)
    next();
    return;
  }
  const provided = req.headers['x-api-key'] as string;
  if (provided === API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Provide valid x-api-key header.' });
  }
}

app.use('/api', authMiddleware);

// --- Input validation helpers ---
function validateString(value: unknown, maxLen: number = 10000): string {
  if (typeof value !== 'string') return '';
  return value.substring(0, maxLen);
}

function validateInt(value: unknown, min: number = 0, max: number = 1_000_000): number {
  const num = typeof value === 'number' ? value : parseInt(String(value));
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

// --- Database ---
const db = new Database('office_history.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    project_name TEXT NOT NULL,
    prompt TEXT,
    code TEXT,
    review_report TEXT,
    debate_log TEXT,
    test_results TEXT,
    total_score INTEGER,
    status TEXT DEFAULT 'completed'
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT,
    role TEXT,
    status TEXT DEFAULT 'idle',
    current_task TEXT,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS runners (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    status TEXT DEFAULT 'idle',
    specs TEXT,
    last_heartbeat INTEGER
  );

  CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    token_usage INTEGER DEFAULT 0,
    active_agents INTEGER DEFAULT 0,
    active_runners INTEGER DEFAULT 0,
    running_tasks INTEGER DEFAULT 0
  );
`);

// --- Routes ---

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// History
app.post('/api/history', (req: Request, res: Response) => {
  const projectName = validateString(req.body.projectName, 200);
  if (!projectName) {
    res.status(400).json({ error: 'projectName is required (string, max 200 chars)' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO history (timestamp, project_name, prompt, code, review_report, debate_log, test_results, total_score, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    Date.now(),
    projectName,
    validateString(req.body.prompt, 5000),
    validateString(req.body.code, 50000),
    validateString(typeof req.body.reviewReport === 'object' ? JSON.stringify(req.body.reviewReport) : req.body.reviewReport, 50000),
    validateString(typeof req.body.debateLog === 'object' ? JSON.stringify(req.body.debateLog) : req.body.debateLog, 50000),
    validateString(typeof req.body.testResults === 'object' ? JSON.stringify(req.body.testResults) : req.body.testResults, 50000),
    validateInt(req.body.totalScore, 0, 100),
    validateString(req.body.status, 50) || 'completed'
  );

  res.json({ id: result.lastInsertRowid, success: true });
});

app.get('/api/history', (req: Request, res: Response) => {
  const limit = validateInt(req.query.limit, 1, 100);
  const stmt = db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT ?');
  const rows = stmt.all(limit);
  res.json(rows);
});

app.get('/api/history/:id', (req: Request, res: Response) => {
  const id = validateInt(req.params.id, 1);
  const stmt = db.prepare('SELECT * FROM history WHERE id = ?');
  const row = stmt.get(id);
  if (row) {
    res.json(row);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.delete('/api/history/:id', (req: Request, res: Response) => {
  const id = validateInt(req.params.id, 1);
  const stmt = db.prepare('DELETE FROM history WHERE id = ?');
  const result = stmt.run(id);
  res.json({ deleted: result.changes > 0 });
});

// Agents
app.post('/api/agents', (req: Request, res: Response) => {
  const id = validateString(req.body.id, 100);
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO agents (id, name, role, status, current_task, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    validateString(req.body.name, 100),
    validateString(req.body.role, 50),
    validateString(req.body.status, 20) || 'idle',
    validateString(req.body.currentTask, 500),
    Date.now()
  );
  res.json({ success: true });
});

app.get('/api/agents', (req: Request, res: Response) => {
  const stmt = db.prepare('SELECT * FROM agents ORDER BY name');
  const rows = stmt.all();
  res.json(rows);
});

// Metrics
app.post('/api/metrics', (req: Request, res: Response) => {
  const stmt = db.prepare(`
    INSERT INTO system_metrics (timestamp, token_usage, active_agents, active_runners, running_tasks)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    Date.now(),
    validateInt(req.body.tokenUsage, 0),
    validateInt(req.body.activeAgents, 0, 1000),
    validateInt(req.body.activeRunners, 0, 1000),
    validateInt(req.body.runningTasks, 0, 10000)
  );
  res.json({ success: true });
});

app.get('/api/metrics/latest', (req: Request, res: Response) => {
  const stmt = db.prepare('SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT 1');
  const row = stmt.get();
  res.json(row || { token_usage: 0, active_agents: 0, active_runners: 0, running_tasks: 0 });
});

// --- Error handler ---
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

export default app;
