# PIXEL OFFICE - Multi-Agent System Dashboard

> Enterprise 2D Pixel Office with AI Agent Orchestration & CEO Pipeline

A browser-based, real-time multi-agent system (MAS) dashboard that visualizes AI agents working in a virtual pixel-art office. Agents autonomously receive tasks, navigate the office, collaborate, and complete work — all orchestrated by an LLM-powered task decomposition engine.

---

## Architecture Overview

```
                          +-------------------+
                          |     main.ts       |  Entry Point
                          |  (App Bootstrap)  |
                          +--------+----------+
                                   |
                    +--------------+--------------+
                    |                             |
           +--------v--------+          +---------v---------+
           |      core/      |          |    rendering/     |
           |  Orchestrator   |          |  AgentRenderer    |
           |  GameLoop       |          |  TilemapRenderer  |
           |  EventBus       |          |  ParticleSystem   |
           |  ChatSystem     |          |  CameraController |
           |  CLIEngine      |          |  MinimapRenderer  |
           |  ToastManager   |          |  StatsChartRender |
           |  SoundManager   |          |  SpeechBubble     |
           +--------+--------+          |  MeetingRoom      |
                    |                   |  ChartRenderer    |
         +----------+----------+        |  TaskProgress     |
         |          |          |        |  AgentSelection   |
  +------v--+ +----v-----+ +--v------+ |  PerformanceOvly  |
  | agent/  | | services/| |pipeline/| +-------------------+
  | Agent   | | LLMSvc   | |Pipeline |
  | Manager | | TaskSvc  | |System   |
  | Behavior| | ReviewSvc| +---------+
  | Collab  | | GitHubSvc|
  +---------+ +----------+
         |
  +------v------+     +----------+
  |  spatial/   |     | debate/  |
  |  Tilemap    |     | Debate   |
  |  Pathfinder |     | Runner   |
  |  SpatialHash|     +----------+
  |  LocalAvoid |
  +-------------+
```

---

## CEO Pipeline System (NEW)

PaperClip-inspired multi-agent delegation workflow:

```
  User Command
       |
       v
  +---------+     +-----------+     +-------+     +----------+
  |   CEO   | --> | Architect | --> | Coder | --> | Reviewer |
  | Director|     |  Archie   |     | Cody  |     |   Rex    |
  +---------+     +-----------+     +-------+     +----------+
       |               |               |               |
  Goal Analysis   Solution Design  Implementation  Quality Check
  Team Planning   Interface Def.   Code Writing    Bug Detection
  Task Breakdown  Dependency Map   Unit Tests      Performance
       |               |               |               |
       v               v               v               v
  [ Planning ]   [ Architecture ]  [ Coding ]     [ Review ]
       |               |               |               |
       +-------+-------+-------+-------+               |
               |                                        |
               v                                        v
        Stage Output Forwarding                Pipeline Report
        (each stage feeds next)                 (final summary)
```

### Pipeline Trigger Keywords

Commands containing these keywords automatically activate the CEO pipeline:

| Korean | English | Context |
|--------|---------|---------|
| 파이프라인 | pipeline | Direct activation |
| 팀 구성 | - | Team composition |
| 프로젝트 | project | Project-level work |
| 최적화 | optimize | Optimization tasks |
| 자동화 | automate | Automation requests |
| 설계부터 | - | End-to-end design |
| 알고리즘 개선 | - | Algorithm improvement |
| 풀스택 | fullstack | Full-stack work |

---

## Module Map

```
src/
 |- main.ts                    # App bootstrap, UI wiring (1520 lines)
 |
 |- types/
 |   '- index.ts               # All type definitions, enums, interfaces
 |
 |- core/                      # System-level orchestration
 |   |- Orchestrator.ts        # Command -> Task decomposition -> Dispatch
 |   |- GameLoop.ts            # Fixed-timestep game loop (60 FPS)
 |   |- EventBus.ts            # Pub/sub event system
 |   |- ChatSystem.ts          # Inter-agent messaging
 |   |- CLIEngine.ts           # CLI command parser
 |   |- ToastManager.ts        # Notification toasts
 |   '- SoundManager.ts        # Audio feedback (Web Audio API)
 |
 |- pipeline/                  # CEO delegation pipeline (NEW)
 |   '- PipelineSystem.ts      # CEO -> Architect -> Coder -> Reviewer
 |
 |- agent/                     # Agent intelligence layer
 |   |- Agent.ts               # Individual agent (FSM + behavior tree)
 |   |- AgentManager.ts        # Agent lifecycle & spatial queries
 |   |- AgentBehaviors.ts      # Behavior tree action/condition nodes
 |   |- BehaviorTree.ts        # BT engine (Sequence, Selector, Action)
 |   '- CollaborationSystem.ts # Meetings & pair programming
 |
 |- spatial/                   # World simulation
 |   |- Tilemap.ts             # Grid-based office map (TILE_SIZE=32)
 |   |- Pathfinder.ts          # A* pathfinding
 |   |- SpatialHash.ts         # O(1) neighbor queries
 |   '- LocalAvoidance.ts      # Collision avoidance steering
 |
 |- rendering/                 # PIXI.js visualization
 |   |- AgentRenderer.ts       # Pixel-art agent sprites
 |   |- TilemapRenderer.ts     # Office floor/wall/desk tiles
 |   |- ParticleSystem.ts      # Visual effects
 |   |- CameraController.ts    # Pan/zoom (WASD + mouse)
 |   |- MinimapRenderer.ts     # Overview minimap
 |   |- SpeechBubbleRenderer.ts# Agent speech bubbles
 |   |- MeetingRoomRenderer.ts # Meeting room visuals
 |   |- ChartRenderer.ts       # Dynamic HTML charts
 |   |- StatsChartRenderer.ts  # PIXI-based statistics
 |   |- TaskProgressRenderer.ts# Task progress bars
 |   |- AgentSelectionSystem.ts# Click-to-select agents
 |   '- PerformanceOverlay.ts  # FPS / memory overlay
 |
 |- services/                  # External integrations
 |   |- LLMService.ts          # Claude / Minimax / Mock LLM
 |   |- TaskService.ts         # Task lifecycle management
 |   |- ReviewService.ts       # Multi-aspect code review
 |   '- GitHubService.ts       # GitHub API integration
 |
 |- debate/                    # Multi-agent debate system
 |   |- DebateManager.ts       # Structured argumentation
 |   '- RunnerManager.ts       # Feedback loop execution
 |
 '- backend/                   # Optional Express server
     '- server.ts              # REST API + SQLite history
```

---

## Data Flow

```
User Input (CLI / Chat)
       |
       v
 +------------+    keyword     +-----------------+
 |Orchestrator |--- match? --->| PipelineSystem  |
 |             |    yes        | CEO -> Arch ->  |
 |             |               | Coder -> Review |
 +------+------+               +--------+--------+
        | no                            |
        v                              v
 +------------+               +-----------------+
 | LLMService |               | Stage-by-stage  |
 | decompose  |               | task assignment |
 +------+------+               +--------+--------+
        |                              |
        v                              v
 +------------+               +-----------------+
 | TaskService|               | Agent.assignTask|
 | create     |               | (walk -> work   |
 +------+------+               |  -> return)    |
        |                     +--------+--------+
        v                              |
 +------------------+                  v
 |AgentManager      |         +-----------------+
 |findBestAgent     |         | EventBus emit   |
 |assignTask        |         | TaskCompleted   |
 +------------------+         | -> next stage   |
                              +-----------------+
```

---

## Agent Roles

```
 +--------------------------------------------------+
 |              Standard Team (12 agents)            |
 +--------------------------------------------------+
 | Frontend (3)  |  Alice, Bob, Carol    | #4FC3F7   |
 | Backend  (3)  |  Dave, Eve, Frank     | #81C784   |
 | Designer (2)  |  Grace, Hank          | #FFB74D   |
 | PM       (1)  |  Iris                 | #E57373   |
 | QA       (2)  |  Jack, Kate           | #BA68C8   |
 | DevOps   (1)  |  Leo                  | #90A4AE   |
 +--------------------------------------------------+

 +--------------------------------------------------+
 |            Pipeline Team (4 agents)               |
 +--------------------------------------------------+
 | CEO      (1)  |  Director             | #FFD700   |
 | Architect(1)  |  Archie               | #FF6B6B   |
 | Coder    (1)  |  Cody                 | #51CF66   |
 | Reviewer (1)  |  Rex                  | #845EF7   |
 +--------------------------------------------------+
```

---

## Agent State Machine

```
              assignTask()
   +-------+  ---------> +--------+
   | Idle  |             | Moving |---+
   +---^---+             +----+---+   | pathBlocked
       |                      |       | recompute
       |    onArrived()       v       |
       |              +-------+---+<--+
       |              | Working   |
       |              | (progress)|
       |              +-----+-----+
       |                    |
       |   onWorkCompleted()|
       |              +-----v-----+
       |              | Returning |
       +<-------------+-----------+

   Special states:
   [Waiting]        - blocked / no path
   [Collaborating]  - in meeting or pair session
```

---

## Event System

```
 CommandReceived -----> TasksParsed -----> TaskAssigned
                                               |
                                               v
 AgentStateChanged <-- AgentStartedWork <-- AgentArrived
       |
       v
 AgentFinishedWork --> TaskCompleted --> (dispatch next)
                            |
                            v
                       TaskFailed --> (retry on next cycle)

 Pipeline Events:
 PipelineCreated -> PipelineStageStarted -> PipelineStageCompleted
                                                    |
                         +----<----<----<----<------+
                         |  (loop through stages)
                         v
                   PipelineCompleted / PipelineFailed
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | TypeScript 5.4+ |
| Rendering | PIXI.js 7.3 (WebGL/Canvas) |
| Build | Vite 5.4 |
| Spatial | Custom A* Pathfinder, SpatialHash |
| AI | Claude API, Minimax API, Mock fallback |
| Backend (opt.) | Express + better-sqlite3 |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

The app opens at `http://localhost:3000` with the full pixel office dashboard.

---

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | 38 |
| Total lines | ~8,150 |
| Modules | 10 directories |
| Agent roles | 12 (9 standard + 3 pipeline) |
| Event types | 17 |
| Bundle size | 588 KB (179 KB gzipped) |

---

## License

MIT
