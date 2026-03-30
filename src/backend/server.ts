import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/api/history', (req, res) => {
  const { projectName, prompt, code, reviewReport, debateLog, testResults, totalScore, status } = req.body;

  const stmt = db.prepare(`
    INSERT INTO history (timestamp, project_name, prompt, code, review_report, debate_log, test_results, total_score, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    Date.now(),
    projectName,
    prompt,
    code,
    JSON.stringify(reviewReport),
    JSON.stringify(debateLog),
    JSON.stringify(testResults),
    totalScore,
    status || 'completed'
  );

  res.json({ id: result.lastInsertRowid, success: true });
});

app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const stmt = db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT ?');
  const rows = stmt.all(limit);
  res.json(rows);
});

app.get('/api/history/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM history WHERE id = ?');
  const row = stmt.get(req.params.id);
  if (row) {
    res.json(row);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.delete('/api/history/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM history WHERE id = ?');
  const result = stmt.run(req.params.id);
  res.json({ deleted: result.changes > 0 });
});

app.post('/api/agents', (req, res) => {
  const { id, name, role, status, currentTask } = req.body;
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO agents (id, name, role, status, current_task, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, role, status, currentTask, Date.now());
  res.json({ success: true });
});

app.get('/api/agents', (req, res) => {
  const stmt = db.prepare('SELECT * FROM agents ORDER BY name');
  const rows = stmt.all();
  res.json(rows);
});

app.post('/api/metrics', (req, res) => {
  const { tokenUsage, activeAgents, activeRunners, runningTasks } = req.body;
  const stmt = db.prepare(`
    INSERT INTO system_metrics (timestamp, token_usage, active_agents, active_runners, running_tasks)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(Date.now(), tokenUsage || 0, activeAgents || 0, activeRunners || 0, runningTasks || 0);
  res.json({ success: true });
});

app.get('/api/metrics/latest', (req, res) => {
  const stmt = db.prepare('SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT 1');
  const row = stmt.get();
  res.json(row || { token_usage: 0, active_agents: 0, active_runners: 0, running_tasks: 0 });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

export default app;
