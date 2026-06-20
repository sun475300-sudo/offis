# 2D Pixel Office — Multi-Agent System Dashboard

> Enterprise-grade 2D pixel office where dozens of AI agents collaborate in real-time, rendered with PixiJS WebGL.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![PixiJS](https://img.shields.io/badge/PixiJS-7.3-e72264?logo=webgl)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)
![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron)
![Tests](https://img.shields.io/badge/tests-72%20passing-3fb950)
![Security](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-3fb950)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

Pixel Office is a real-time 2D visualization dashboard that simulates an autonomous multi-agent software development office. 32 AI agents — each with distinct roles (Frontend, Backend, Designer, QA, DevOps, PM, Architect, Security, Performance) — navigate a tiled office, receive task assignments, collaborate on code reviews, run debates, and execute CI/CD feedback loops, all rendered at 60 FPS in the browser.

## Key Features

### Agent Intelligence
- **Behavior Tree AI** — Selector/Sequence/Action/Condition nodes drive autonomous decision-making
- **Idle Diversification** — Agents wander (40%), take coffee breaks (20%), or wait (40%) when idle
- **A\* Pathfinding** — 8-directional movement with octile distance heuristic
- **Local Avoidance** — Simplified RVO prevents agent-agent collisions
- **Spatial Hashing** — O(1) neighbor queries for efficient proximity detection

### Rendering
- **PixiJS 7.3 WebGL** — Hardware-accelerated 2D rendering with PIXI.Graphics pixel art
- **Direction-aware Animation** — Walk cycle (4-frame), typing, idle breathing, collaboration wave
- **Role Accessories** — Headsets, berets, glasses distinguish agent roles visually
- **Speech Bubbles** — Real-time chat visualization during debates
- **Particle System** — Visual effects for events (task completion, collaboration)
- **Minimap** — Bird's-eye view with agent position tracking
- **Camera System** — WASD/Arrow pan, scroll zoom, agent follow-cam, smooth interpolation

### Collaboration Systems
- **Debate Engine** — Multi-turn structured debates with real-time chat streaming
- **Code Review Pipeline** — Parallel Architecture + Security + Performance review
- **Meeting Room Visualization** — Agents physically gather for collaborative sessions
- **Pair Programming** — Two-agent collaboration mode

### Infrastructure
- **Event Bus** — Pub/Sub decoupled communication across all subsystems
- **Task Scheduler** — Priority-based task queue with work delegation
- **Test Runner** — CI/CD feedback loops with live dashboard metrics
- **GitHub Integration** — Attach repos, browse files, save changes via GitHub API
- **IndexedDB Persistence** — Client-side state persistence across sessions

### Dashboard & UI
- **CLI Interface** — Command-driven control (`/assign`, `/review`, `/debate`, `/runner`, `/status`)
- **Agent Context Menu** — Right-click agents for follow, info, assign, recall, meeting, pair
- **Keyboard Shortcuts** — +/- zoom, Tab cycle agents, / focus CLI, ? help overlay
- **5 Overlay Panels** — Agent status, history, monitoring, test dashboard, chat
- **Dark/Light Theme** — Toggle with persistent localStorage preference
- **Responsive Layout** — 3 CSS breakpoints for different screen sizes

## Architecture

```
src/
├── main.ts                    # Application entry point & UI wiring
├── types/index.ts             # All TypeScript interfaces & enums
│
├── agent/                     # Agent intelligence
│   ├── Agent.ts               # Agent entity with state machine
│   ├── AgentManager.ts        # Lifecycle, spawning, task dispatch
│   ├── AgentBehaviors.ts      # Behavior tree action/condition nodes
│   ├── BehaviorTree.ts        # BT framework (Selector, Sequence, Action, Condition)
│   └── CollaborationSystem.ts # Multi-agent collaboration protocols
│
├── core/                      # Engine systems
│   ├── GameLoop.ts            # RequestAnimationFrame with delta clamping
│   ├── EventBus.ts            # Typed pub/sub event system
│   ├── CLIEngine.ts           # Command parser and executor
│   ├── ChatSystem.ts          # Real-time agent chat
│   ├── Orchestrator.ts        # High-level system coordinator
│   ├── WorkflowEngine.ts      # Multi-step workflow execution
│   ├── PluginSystem.ts        # Extensible plugin architecture
│   ├── CacheManager.ts        # LRU caching layer
│   ├── Logger.ts              # Structured logging
│   ├── MetricsCollector.ts    # Performance metrics aggregation
│   ├── NotificationCenter.ts  # Cross-system notifications
│   ├── SoundManager.ts        # Audio feedback system
│   └── ToastManager.ts        # Toast notification UI
│
├── rendering/                 # PixiJS rendering layer
│   ├── TilemapRenderer.ts     # Office floor, walls, desks, room zones
│   ├── AgentRenderer.ts       # Animated pixel art agent sprites
│   ├── AgentSelectionSystem.ts# Click/hover selection with ring highlight
│   ├── CameraController.ts    # Pan, zoom, follow-cam, minimap viewport
│   ├── MinimapRenderer.ts     # Bird's-eye minimap overlay
│   ├── SpeechBubbleRenderer.ts# Chat bubble rendering above agents
│   ├── ParticleSystem.ts      # Visual effect particles
│   ├── MeetingRoomRenderer.ts # Meeting room visualization
│   ├── TaskProgressRenderer.ts# Work progress bars
│   ├── StatsChartRenderer.ts  # Real-time statistics charts
│   └── PerformanceOverlay.ts  # FPS, memory, draw call stats
│
├── spatial/                   # Spatial systems
│   ├── Tilemap.ts             # Grid data structure with runtime editing
│   ├── Pathfinder.ts          # A* with 8-directional movement
│   ├── SpatialHash.ts         # O(1) spatial partitioning
│   └── LocalAvoidance.ts      # RVO-based collision avoidance
│
├── services/                  # Business logic & integrations
│   ├── GitHubService.ts       # GitHub API (repo browse, file CRUD)
│   ├── LLMService.ts          # LLM API integration
│   ├── ReviewService.ts       # Parallel code review pipeline
│   ├── TaskService.ts         # Task creation and management
│   ├── TaskScheduler.ts       # Priority scheduling
│   ├── TaskDecomposer.ts      # Complex task breakdown
│   ├── TaskDelegation.ts      # Role-based task routing
│   ├── SearchSystem.ts        # Full-text search across entities
│   ├── ExportEngine.ts        # Data export (JSON, CSV)
│   ├── SecurityScanner.ts     # Code security analysis
│   ├── TestSuite.ts           # Automated test scenarios
│   ├── KnowledgeGraph.ts      # Entity relationship graph
│   ├── SharedMemory.ts        # Cross-agent shared state
│   ├── ContextSharing.ts      # Context propagation
│   ├── AgentLearning.ts       # Adaptive agent behavior
│   ├── AdaptationEngine.ts    # System self-tuning
│   ├── CircuitBreaker.ts      # Fault isolation
│   ├── FaultTolerance.ts      # Graceful degradation
│   ├── SelfHealing.ts         # Auto-recovery
│   ├── RetryPolicy.ts         # Exponential backoff retry
│   ├── LoadBalancer.ts        # Work distribution
│   ├── WorkQueue.ts           # Durable work queue
│   ├── RateLimiter.ts         # Request throttling
│   ├── DistributedTracing.ts  # Request tracing across agents
│   ├── Telemetry.ts           # System telemetry collection
│   ├── EventSourcing.ts       # Event log with replay
│   ├── AnalyticsEngine.ts     # Usage analytics
│   ├── HealthMonitor.ts       # System health checks
│   ├── PerformanceProfiler.ts # Runtime profiling
│   ├── AuditTrail.ts          # Action audit logging
│   ├── StatePersistence.ts    # IndexedDB state store
│   ├── ConsensusMechanism.ts  # Multi-agent consensus
│   ├── ResourcePool.ts        # Resource management
│   ├── RoleManager.ts         # Dynamic role assignment
│   ├── CapabilityRegistry.ts  # Agent capability tracking
│   ├── MessageRouter.ts       # Inter-agent messaging
│   ├── AgentNegotiation.ts    # Task negotiation protocol
│   ├── A2AProtocol.ts         # Agent-to-Agent communication
│   └── FeatureServices.ts     # Feature flag management
│
├── debate/                    # Debate & testing systems
│   ├── DebateManager.ts       # Multi-turn structured debates
│   └── RunnerManager.ts       # Test runner with CI/CD loops
│
└── ui/
    └── styles.css             # Full UI stylesheet (panels, themes, responsive)
```

## Quick Start

```bash
# Clone
git clone https://github.com/sun475300-sudo/offis.git
cd offis

# Install
npm install

# Dev server (hot reload)
npm run dev

# Production build
npm run build
npm run preview
```

Open `http://localhost:5173` (dev) or `http://localhost:4173` (preview).

## CLI Commands

| Command | Description |
|---------|-------------|
| `/status` | Show agent count, tasks, FPS |
| `/assign <role> <task>` | Assign work to an agent by role |
| `/review` | Start parallel code review on attached repo |
| `/fullreview` | Review + multi-agent debate pipeline |
| `/debate <topic>` | Start a structured multi-agent debate |
| `/runner` | Run test suite |
| `/runner loop` | Start CI/CD feedback loop |
| `/runners` | Show runner status |
| `/help` | List all available commands |

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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Rendering | PixiJS 7.3 (WebGL 2D) |
| Language | TypeScript 5.9 (strict mode) |
| Build | Vite 8 (rolldown bundler) with manual chunk splitting |
| Desktop | Electron 39 + electron-builder 26 (Win/Mac/Linux) |
| Tests | Vitest 4.1 (72 unit tests, regression coverage for bug-sweep fixes) |
| Persistence | IndexedDB + localStorage |
| Styling | Pure CSS (no framework) |

## Build Output

```
dist/index.html                    18.54 kB (gzip:  4.11 kB)
dist/assets/index-*.css            27.37 kB (gzip:  5.43 kB)
dist/assets/rolldown-runtime-*.js   0.56 kB (gzip:  0.36 kB)
dist/assets/index-*.js            152.15 kB (gzip: 47.79 kB)
dist/assets/pixi-*.js             464.34 kB (gzip:138.96 kB)
```

Total gzip: **~197 kB** — loads in under 1 second on broadband.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite dev server at http://localhost:3000 |
| `npm run build` | `tsc && vite build` — produces `dist/` |
| `npm run preview` | Preview the production build |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Run with @vitest/coverage-v8 |
| `npm run electron:dev` | Vite dev server + Electron (concurrently) |
| `npm run electron:build` | Production build + electron-builder packaging |
| `npm run electron:preview` | Run the built app under Electron |

## Quality

This repository has been through a multi-round code-review / bug-sweep pass.

- **Tests:** 72 / 72 passing (`npx vitest run`).
- **TypeScript:** strict, `tsc --noEmit` clean.
- **Security:** `npm audit` reports **0 vulnerabilities**.
- **Build:** Vite 8 + rolldown bundler. The `manualChunks` config uses
  the new function form required by rolldown.
- **Electron packaging:** verified end-to-end with
  `npx electron-builder --linux --dir`, producing a working
  `release/linux-unpacked/offis-mas-dashboard` ELF executable.
- **Bug-fix history:** see commit log for ~150 targeted fixes covering
  memory caps, listener-fan-out isolation, snapshot-during-iteration,
  state-machine watchdogs, validation of persisted JSON, race fixes
  for setTimeout/setInterval cleanup, and regression tests for the
  bug patterns above.

## Agent Roles

| Role | Color | Specialization |
|------|-------|---------------|
| Frontend | `#42A5F5` | UI/UX implementation |
| Backend | `#66BB6A` | API & server logic |
| Designer | `#AB47BC` | Visual design & assets |
| PM | `#FFA726` | Project management |
| QA | `#EF5350` | Testing & quality |
| DevOps | `#78909C` | Infrastructure & CI/CD |
| Architect | `#7E57C2` | System design |
| Security | `#EF5350` | Security analysis |
| Performance | `#26A69A` | Performance optimization |

## Author

**sun475300-sudo**

## License

MIT
