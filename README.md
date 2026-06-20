# 2D Pixel Office — Multi-Agent System Dashboard

> Enterprise-grade 2D pixel office where dozens of AI agents collaborate in real-time, rendered with PixiJS WebGL.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![PixiJS](https://img.shields.io/badge/PixiJS-7.3-e72264?logo=webgl)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)
![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron)
![Vitest](https://img.shields.io/badge/Vitest-4.1-3fb950?logo=vitest)
![Tests](https://img.shields.io/badge/tests-72%20passing-3fb950)
![Security](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-3fb950)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Scripts](#scripts)
- [CLI Commands](#cli-commands)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tech Stack](#tech-stack)
- [Build Output](#build-output)
- [Agent Roles](#agent-roles)
- [Testing](#testing)
- [Quality & Hardening History](#quality--hardening-history)
- [Electron Packaging](#electron-packaging)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Offis (Pixel Office)** is a real-time 2D visualization dashboard that simulates an autonomous multi-agent software-development office. 32 AI agents — each with a distinct role (Frontend, Backend, Designer, QA, DevOps, PM, Architect, Security, Performance) — navigate a tiled office, receive task assignments, collaborate on code reviews, run structured debates, and execute CI/CD feedback loops. Everything renders at 60 FPS in the browser via PixiJS WebGL, and can also run as a desktop app via Electron.

The codebase is intentionally service-oriented: 40+ standalone TypeScript services (caching, rate limiting, circuit breakers, consensus, telemetry, etc.) sit behind a single event bus, so the simulation doubles as a sandbox for distributed-systems primitives.

---

## Key Features

### Agent Intelligence
- **Behavior Tree AI** — Selector / Sequence / Action / Condition nodes drive autonomous decision-making
- **Idle Diversification** — Agents wander (40%), take coffee breaks (20%), or wait (40%) when idle
- **A\* Pathfinding** — 8-directional movement with octile heuristic and unwalkable-start relocation
- **Local Avoidance** — Simplified RVO with proper head-on detection (dot-product of intended next-step vectors)
- **Spatial Hashing** — O(1) neighbour queries for efficient proximity detection

### Rendering
- **PixiJS 7.3 WebGL** — Hardware-accelerated 2D rendering with PIXI.Graphics pixel art
- **Direction-aware Animation** — 4-frame walk cycle, typing, idle breathing, collaboration wave
- **Role Accessories** — Headsets, berets, glasses distinguish agent roles visually
- **Speech Bubbles** — Real-time chat visualization during debates
- **Particle System** — Visual effects for events (task completion, collaboration)
- **Minimap** — Bird's-eye view with agent-position tracking
- **Camera System** — WASD/Arrow pan, scroll zoom, agent follow-cam, smooth interpolation

### Collaboration Systems
- **Debate Engine** — Multi-turn structured debates with real-time chat streaming
- **Code Review Pipeline** — Parallel Architecture + Security + Performance review
- **Meeting Room Visualization** — Agents physically gather for collaborative sessions; per-room auto-deactivate timer is properly cancelled when a new meeting starts
- **Pair Programming** — Two-agent collaboration mode; sessions are cleaned up when an agent is removed mid-session

### Infrastructure (40+ services)
- **Event Bus** — Typed pub/sub with snapshot-during-emit and per-handler isolation
- **Task Scheduler** — Priority-based queue with capped history and FIFO eviction
- **Test Runner** — CI/CD feedback loops that recover from errored runners
- **GitHub Integration** — Browse repos, read files (UTF-8 safe base64 decode), set tokens (paste-safe trim)
- **IndexedDB + localStorage** — Persisted client-side state with debounced writes + JSON-shape validation on load
- **Resilience primitives** — CircuitBreaker (proper `half_open → open` reset), RateLimiter (window-reset counts the first call), FaultTolerance (`fail_fast` mode honored, fallback success resets the error budget), RetryPolicy (honors `retryableErrors` allow-list), ResourcePool (partial allocation up to capacity), LoadBalancer (deterministic round-robin)
- **Observability** — DistributedTracing (capped per-span logs), Telemetry (debounced flush with caught rejection), AuditTrail (copy-before-sort to avoid in-place mutation), HealthMonitor (per-agent uptime, dedup'd transition alerts)

### Dashboard & UI
- **CLI Interface** — 18 commands for driving the whole simulation (`/status`, `/assign`, `/review`, `/debate`, `/runner`, …)
- **Agent Context Menu** — Right-click agents for follow, info, assign, recall, meeting, pair
- **Keyboard Shortcuts** — `+/-` zoom, `Tab` cycle agents, `/` focus CLI, `?` help overlay
- **5 Overlay Panels** — Agent status, history, monitoring, test dashboard, chat
- **Dark / Light Theme** — Toggle with persistent localStorage preference
- **Responsive Layout** — 3 CSS breakpoints for different screen sizes
- **Toasts** — Built with `createElement` + `textContent` (no `innerHTML` interpolation, so title/message can't inject markup)

---

## Architecture

```
src/
├── main.ts                    # Application entry point & UI wiring
├── types/index.ts             # All TypeScript interfaces & enums
│
├── agent/                     # Agent intelligence
│   ├── Agent.ts               # Agent entity with state machine + workRate guards
│   ├── AgentManager.ts        # Lifecycle, spawning, task dispatch
│   ├── AgentBehaviors.ts      # Behavior tree action/condition nodes + idle-timer cleanup
│   ├── BehaviorTree.ts        # BT framework (Selector, Sequence, Action, Condition)
│   ├── AgentData.ts           # INITIAL_AGENTS + REVIEW_AGENTS (32 total)
│   └── CollaborationSystem.ts # Meetings, pair sessions, dead-agent cleanup
│
├── core/                      # Engine systems
│   ├── GameLoop.ts            # requestAnimationFrame loop with delta clamping
│   ├── EventBus.ts            # Typed pub/sub, snapshot iteration
│   ├── CLIEngine.ts           # Command parser + alias-collision warnings
│   ├── CLICommandRegistry.ts  # Registers the 18 CLI commands
│   ├── AppEventHandlers.ts    # Bus → HUD/sound/toast/chat wiring
│   ├── ChatSystem.ts          # Real-time agent chat with unsubscribe support
│   ├── Orchestrator.ts        # Task dispatch loop + stale-task watchdog + destroy()
│   ├── WorkflowEngine.ts      # Multi-step workflow with real pause polling
│   ├── PluginSystem.ts        # Plugin enable/disable with cycle protection
│   ├── CacheManager.ts        # True LRU (reinsert-on-get) + FIFO + LFU policies
│   ├── Logger.ts              # Structured logging with bounded history
│   ├── MetricsCollector.ts    # Single-pass aggregation (no spread blowup)
│   ├── NotificationCenter.ts  # Notifications with id-spoof protection
│   ├── SoundManager.ts        # Web Audio with destroy() teardown
│   └── ToastManager.ts        # Toasts built via createElement (no XSS)
│
├── rendering/                 # PixiJS rendering layer
│   ├── TilemapRenderer.ts     # Office floor, walls, desks, room zones
│   ├── AgentRenderer.ts       # Animated pixel art sprites + destroy on removal
│   ├── AgentSelectionSystem.ts# Click/hover selection with ring highlight
│   ├── CameraController.ts    # Pan, zoom, follow-cam with bound listener cleanup
│   ├── MinimapRenderer.ts     # Bird's-eye minimap overlay
│   ├── SpeechBubbleRenderer.ts# Chat bubble rendering above agents
│   ├── ParticleSystem.ts      # Visual effect particles
│   ├── MeetingRoomRenderer.ts # Meeting room visualization (update-loop fades)
│   ├── TaskProgressRenderer.ts# Work progress bars
│   ├── StatsChartRenderer.ts  # Real-time statistics charts
│   └── PerformanceOverlay.ts  # FPS, memory, draw call stats
│
├── spatial/                   # Spatial systems
│   ├── Tilemap.ts             # Grid data structure with runtime editing
│   ├── Pathfinder.ts          # A* with 8-directional movement + start-cell guard
│   ├── SpatialHash.ts         # O(1) spatial partitioning
│   └── LocalAvoidance.ts      # RVO-style avoidance with real dot-product check
│
├── services/                  # 40+ business-logic services
│   │   …                      # caching, scheduling, search, security,
│   │   …                      # consensus, negotiation, capability registry,
│   │   …                      # persistence, telemetry, fault tolerance …
│   └── (see source tree)
│
├── debate/                    # Debate & testing systems
│   ├── DebateManager.ts       # Multi-turn structured debates (capped sessions)
│   └── RunnerManager.ts       # Test runner with CI/CD loops that recover errored runners
│
├── ui/
│   └── HUDManager.ts          # DOM panels with HTML-escaped interpolation
│
└── __tests__/                 # Vitest unit + regression tests
    ├── CacheManager.test.ts
    ├── CapabilityRegistry.test.ts
    ├── CircuitBreaker.test.ts
    ├── EventBus.test.ts
    ├── Pathfinder.test.ts
    ├── RateLimiter.test.ts
    ├── ResourcePool.test.ts
    ├── SpatialHash.test.ts
    ├── TaskService.test.ts
    ├── Tilemap.test.ts
    └── WorkQueue.test.ts
```

`src/` total: **~80 TypeScript files** (services + core + agent + rendering + spatial + ui + tests).

---

## Quick Start

```bash
# Clone
git clone https://github.com/sun475300-sudo/offis.git
cd offis

# Install
npm install

# Dev server (hot reload). Vite is configured to serve on port 3000
# so the Electron dev workflow can pick it up without conflict.
npm run dev

# Production build
npm run build
npm run preview
```

Open **`http://localhost:3000`** (dev) or **`http://localhost:4173`** (preview default).

---

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite dev server at `http://localhost:3000` (HMR) |
| `npm run build` | `tsc && vite build` — produces `dist/` |
| `npm run preview` | Preview the production build at `http://localhost:4173` |
| `npm test` | Run the Vitest suite once (CI-friendly) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Run with `@vitest/coverage-v8` |
| `npm run electron:dev` | `npm run dev` + Electron (via `concurrently`) |
| `npm run electron:build` | Production build + electron-builder packaging |
| `npm run electron:preview` | Run the built app under Electron |

---

## CLI Commands

The on-screen CLI accepts 18 commands (registered in `src/core/CLICommandRegistry.ts`):

| Command | Description |
|---------|-------------|
| `/help` | List all available commands |
| `/status` | Show agent count, tasks, FPS |
| `/agents` | List agents and their current state |
| `/follow <agentId>` | Camera follows the given agent |
| `/unfollow` | Stop following |
| `/meeting <type> <agents…>` | Start a meeting; previous auto-deactivate timer is cancelled |
| `/pair <a> <b>` | Start a pair-programming session between two agents |
| `/test` | Run an internal test scenario (`/test [agentTarget] [taskCount]`; `0` is accepted) |
| `/runner [loop]` | Run the test runner; `loop` starts a CI/CD feedback loop |
| `/system` | System overview |
| `/blueprint` | Architecture blueprint |
| `/deep-dive` | Per-subsystem deep dive |
| `/reflect` | Reflective summary |
| `/autoresearch` | Auto-research mode |
| `/harness` | Agent harness diagnostics |
| `/persona` | Agent persona controls |
| `/session` | Session inspection |
| `/github` | GitHub integration commands |

Aliases (e.g. `/h` for `/help`) are checked for collision at register time; conflicts are reported to the console so they don't silently shadow each other.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` / `-` | Zoom in / out |
| `0` | Reset zoom |
| `Home` | Reset camera position |
| `Tab` | Cycle to next agent |
| `Esc` | Deselect / stop following |
| `S` | Toggle stats panel |
| `P` | Toggle performance overlay |
| `/` | Focus CLI input |
| `?` | Show shortcuts overlay |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Rendering | PixiJS 7.3 (WebGL 2D) |
| Language | TypeScript 5.9 (strict mode) |
| Build | Vite 8.0 (rolldown bundler) with `manualChunks` function-form splitting |
| Desktop | Electron 39 + electron-builder 26 (Win/Mac/Linux targets) |
| Tests | Vitest 4.1 (`@vitest/coverage-v8` 4.1 for coverage) |
| Persistence | IndexedDB + localStorage (debounced writes, JSON-shape validation on load) |
| Styling | Pure CSS (no framework) |

---

## Build Output

Sample artifact sizes from `npm run build`:

```
dist/index.html                    18.54 kB (gzip:  4.11 kB)
dist/assets/index-*.css            27.37 kB (gzip:  5.43 kB)
dist/assets/rolldown-runtime-*.js   0.56 kB (gzip:  0.36 kB)
dist/assets/index-*.js            152.15 kB (gzip: 47.79 kB)
dist/assets/pixi-*.js             464.34 kB (gzip:138.96 kB)
```

Total gzip: **~197 kB** — loads in under 1 second on broadband.

The `pixi` chunk is split out so the application code can be cached independently of the renderer library. Under Vite 8 + rolldown this requires the function form of `manualChunks`:

```ts
// vite.config.ts
rollupOptions: {
  output: {
    manualChunks(id: string) {
      if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi/')) {
        return 'pixi';
      }
    },
  },
},
```

---

## Agent Roles

| Role | Specialization |
|------|---------------|
| Frontend | UI/UX implementation |
| Backend | API & server logic |
| Designer | Visual design & assets |
| PM | Project management |
| QA | Testing & quality |
| DevOps | Infrastructure & CI/CD |
| Architect | System design |
| Security Engineer | Security analysis |
| Performance Engineer | Performance optimization |

`src/agent/AgentData.ts` ships **32 agents** across `INITIAL_AGENTS` and `REVIEW_AGENTS`.

---

## Testing

```bash
npm test                   # one-shot run (72 tests)
npm run test:watch         # watch mode
npm run test:coverage      # coverage with @vitest/coverage-v8
```

Test files live under `src/__tests__/`:

| File | Tests |
|------|-------|
| `CacheManager.test.ts` | LRU eviction, update-doesn't-evict, TTL, hit/miss, FIFO |
| `CapabilityRegistry.test.ts` | `minConfidence: 0` not silently disabled, unlink both ways |
| `CircuitBreaker.test.ts` | open after threshold, `half_open → open` resets `nextAttempt`, close after success |
| `EventBus.test.ts` | emit / on / off semantics, ordering |
| `Pathfinder.test.ts` | adjacent + diagonal paths, dynamic obstacles, blocked goal, unwalkable-start relocation, real `Tilemap` round-trip |
| `RateLimiter.test.ts` | first-call-in-window counted, `consume(N)` exact, block + unblock across window |
| `ResourcePool.test.ts` | partial allocation, reopen on release, reject `amount ≤ 0`, no double-queue on `processPendingRequests` |
| `SpatialHash.test.ts` | bucket lookup, multi-bucket radius, rebuild clears state |
| `TaskService.test.ts` | task creation, lifecycle transitions |
| `Tilemap.test.ts` | grid generation, walkability, nearest-walkable BFS |
| `WorkQueue.test.ts` | priority peek, `requeue` no array drift, remove |

Total: **72 / 72 passing**.

---

## Quality & Hardening History

This codebase has been through a multi-round code-review / bug-sweep pass: **~100 targeted fix commits** across two large PRs (#2 and #9) plus follow-ups. Highlights of the patterns addressed:

- **Memory caps** on every previously-unbounded `Map`/array (sessions, decisions, plans, negotiations, alerts, span logs, scheduler tasks, A2A tasks, workflows, …) with terminal-state-first eviction.
- **Listener fan-out safety** in 17 services + 4 keyed-listener services: every `notifyListeners` iterates a **snapshot** so re-entrant `on/off` during dispatch can't shift the cursor, and each callback is wrapped in `try/catch` so a throwing subscriber can't abort the fan-out.
- **State-machine watchdogs**: `Orchestrator` stale-task check respects agent state; `Agent.assignTask` falls back to `Idle` on pathfinding failure; `CollaborationSystem.update` releases pair sessions for removed agents.
- **Algorithm correctness**: real LRU (reinsert-on-get), unanimous consensus (was inverted), real round-robin in LoadBalancer (was random), KnowledgeGraph BFS includes the end node, blocked TaskDecomposer tasks are re-evaluated, FaultTolerance honors `fail_fast` and resets the error budget on fallback success.
- **Race & resource fixes**: `setInterval`/`setTimeout` cleanup on reconfigure; `beforeunload` cancels pending debounce; `Telemetry.flush` snapshots exporters; `CLICommandRegistry /meeting` cancels the prior auto-deactivate timer; PIXI children are `destroy({children:true})`d on removal; `CameraController` listeners are bound fields with a matching cleanup.
- **API / auth robustness**: LLM keys and GitHub tokens are `trim()`med and stripped of surrounding quotes (so a `.env` paste with a trailing newline doesn't silently 401); non-2xx HTTP responses are logged instead of degrading silently to mock.
- **Data integrity**: every `import()`-style entrypoint (`SharedMemory`, `StatePersistence`, `KnowledgeGraph`, `AgentLearning`, `TestSuite.load*`, `ConfigManager.importConfig`) validates JSON shape before mutating live state. Snapshots in `StatePersistence` are now deep-cloned so future writes don't retroactively mutate them.
- **Security**: removed an `eval()` RCE in `WorkflowEngine`, replaced `innerHTML` interpolation in `ToastManager` / `HUDManager` with `createElement` + `textContent` (no XSS surface from titles or messages), restored proper base64 / UTF-8 decode in `GitHubService.getFileContent`.

Current state:

- ✅ `npx tsc --noEmit` — clean
- ✅ `npx vitest run` — **72 / 72** passing
- ✅ `npm audit` — **0 vulnerabilities** (5 advisories resolved: 1 high, 4 moderate)
- ✅ `npm run build` — Vite 8 build succeeds (~197 kB gzip)
- ✅ `npx electron-builder --linux --dir` — produces a working ELF executable

---

## Electron Packaging

Verified end-to-end on Linux:

```bash
npm run build
npx electron-builder --linux --dir
# → release/linux-unpacked/offis-mas-dashboard  (working ELF executable, ~304 MB unpacked)
```

For Windows (`nsis`) and macOS (`dmg`) installers, drop the platform icons in:

```
electron/assets/icon.ico   # Windows installer + window icon
electron/assets/icon.icns  # macOS installer
electron/assets/icon.png   # Linux + window fallback
```

If the PNG is missing, `electron/main.js` falls back to Electron's default window icon (via `fs.existsSync`) so the dev / preview workflow doesn't warn.

---

## Contributing

The repository follows a continuous bug-sweep workflow. Practical conventions:

1. **Branch naming.** Feature work on `feat/<short-name>`, fixes on `fix/<area>`, sweeps on `claude/<scope>`.
2. **Commit style.** Conventional-commits prefix (`fix:`, `chore:`, `perf:`, `test:`, `feat:`), with the rationale (the *why*) inline in the body.
3. **PR checklist.**
   - [ ] `npx tsc --noEmit` clean
   - [ ] `npx vitest run` passes
   - [ ] `npm run build` succeeds
   - [ ] `npm audit` reports **0 vulnerabilities**
   - [ ] Memory-bounded data structures stay capped
   - [ ] New listener / subscriber registrations return an unsubscribe and isolate throws
4. **Regression tests.** If a bug fix touches a service with no existing test file, add one under `src/__tests__/` that captures the buggy behaviour as a failing test, then the fix.

---

## License

MIT © sun475300-sudo
