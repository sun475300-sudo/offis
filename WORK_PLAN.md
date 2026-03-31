# WORK PLAN - Offis Multi-Agent System

> Comprehensive test results and prioritized action plan based on large-scale analysis.

---

## Test Results Summary

### Build Status

| Test | Result | Details |
|------|--------|---------|
| TypeScript Compile | PASS | 0 errors (excluding pre-existing pixi.js type stubs) |
| Vite Production Build | PASS | 588 KB bundle (179 KB gzip) |
| Circular Dependencies | PASS | 0 cycles detected |
| Cross-layer Violations | PASS | Clean layered architecture |
| Missing Imports | PASS | All imports resolve correctly |

### Issue Breakdown

```
 Critical  [||||||||]                          8
 High      [||||||||||||||||]                 14
 Medium    [||||||||||||||||||||||||]          22
 Low       [|||||||||||||||]                  13
                                         --------
                                   Total:    57
```

### Issues by Category

```
 Security (XSS/CORS/Keys)     [||||||||||||||||||]  16
 Memory Leaks                  [|||||||||||||]       11
 Logic Errors / Bugs           [||||||||||]           9
 Dead Code / Unused            [|||||||||||||]       11
 Performance                   [|||||]                4
 Type Safety                   [||||||]               6
```

---

## Phase 1: Security Fixes (CRITICAL)

> Priority: IMMEDIATE | Estimated scope: 7 files

### 1.1 XSS Vulnerabilities (8 locations)

```
File                              Line     Attack Vector
-------------------------------------------------------
src/main.ts                       1099     innerHTML (user CLI input)
src/main.ts                       1431     innerHTML (chat messages)
src/main.ts                       1042     innerHTML (agent names)
src/main.ts                       1200     innerHTML (project names)
src/core/ToastManager.ts          86-93    innerHTML (toast content)
src/rendering/ChartRenderer.ts    50       innerHTML (chart labels)
src/rendering/ChartRenderer.ts    90       innerHTML (chart data)
src/rendering/ChartRenderer.ts    148      innerHTML (pie chart)
```

**Action:** Create a shared `escapeHtml()` utility and apply to all innerHTML insertions. Alternatively, switch to `textContent` where possible.

### 1.2 API Key Exposure (2 locations)

```
File                              Line     Issue
-------------------------------------------------------
src/services/LLMService.ts       98-104   Claude API key in client fetch
src/services/LLMService.ts       149-153  Minimax key in client fetch
```

**Action:** Proxy API calls through the backend server (`src/backend/server.ts`). Never send API keys from the browser.

### 1.3 Backend Security (2 issues)

```
File                              Line     Issue
-------------------------------------------------------
src/backend/server.ts             6        CORS wide open (any origin)
src/backend/server.ts             81       No auth, unbounded query limit
```

**Action:** Configure CORS with allowed origins. Add rate limiting. Validate query params.

---

## Phase 2: Memory Leak Fixes (HIGH)

> Priority: HIGH | Estimated scope: 8 files

### 2.1 Event Listener Accumulation

```
File                              Line     Issue
-------------------------------------------------------
src/main.ts                       1024     click listener added every frame
src/main.ts                       1231     click listener added on each call
src/main.ts                       904      setInterval never cleared
```

**Action:** Add listener once using a flag check, or move to `addEventListener` with `{ once: true }`.

### 2.2 PIXI Object Leaks

```
File                                   Line     Missing .destroy()
--------------------------------------------------------------
src/rendering/AgentRenderer.ts         63-68    Agent visuals
src/rendering/StatsChartRenderer.ts    57       removeChildren no destroy
src/rendering/TilemapRenderer.ts       27       renderMap children
src/rendering/MeetingRoomRenderer.ts   98-112   PIXI.Text objects
```

**Action:** Call `.destroy({ children: true })` on all removed PIXI containers.

### 2.3 Missing Cleanup Methods

```
File                                   Line     No destroy/dispose
--------------------------------------------------------------
src/rendering/CameraController.ts      94-128   6 window listeners
src/core/ChatSystem.ts                 18       No offMessage method
```

**Action:** Add `destroy()` methods that remove all registered listeners.

---

## Phase 3: Logic & Correctness Fixes (MEDIUM)

> Priority: MEDIUM | Estimated scope: 6 files

### 3.1 Behavior Tree Disconnect

```
File                              Line     Issue
-------------------------------------------------------
src/agent/AgentBehaviors.ts       64       Snapshot path mutation is no-op
src/agent/AgentBehaviors.ts       68-88    moveAlongPath reads stale data
src/agent/Agent.ts                249      getOccupiedCells always empty
```

**Action:** Either pass mutable agent reference to behavior tree (not snapshot), or apply snapshot changes back to agent after BT tick.

### 3.2 Encoding & Data Issues

```
File                              Line     Issue
-------------------------------------------------------
src/main.ts                       831      atob() fails on UTF-8
src/services/GitHubService.ts     117      Same atob issue
src/main.ts                       198,214  Corrupted agent names
```

**Action:** Use `TextDecoder` + `Uint8Array` for base64 decoding. Fix corrupted name strings.

### 3.3 Event Misuse

```
File                                   Line     Issue
--------------------------------------------------------------
src/agent/CollaborationSystem.ts       117      Wrong event type for meetings
src/agent/CollaborationSystem.ts       72       No idle check before meeting
src/rendering/ParticleSystem.ts        104      Alpha decays exponentially
```

**Action:** Emit correct event types. Filter idle agents only. Fix alpha formula.

---

## Phase 4: Performance Optimization (MEDIUM)

> Priority: MEDIUM | Estimated scope: 2 files

### 4.1 Pathfinder

```
File                              Line     Issue
-------------------------------------------------------
src/spatial/Pathfinder.ts         60       Array sort instead of binary heap
src/spatial/Pathfinder.ts         109-119  Duplicate nodes in open list
```

**Action:** Replace `openList.sort()` with a proper min-heap (priority queue). Track visited nodes to prevent duplicates.

### 4.2 Bundle Size

```
Current: 588 KB (179 KB gzip) - exceeds 500 KB warning

Opportunity                     Est. Savings
---------------------------------------------
Dynamic import for rendering/    ~150 KB
Dynamic import for services/     ~50 KB
Dynamic import for debate/       ~30 KB
```

**Action:** Use Vite's dynamic `import()` for non-critical modules. Configure `manualChunks` in rollup options.

---

## Phase 5: Code Quality Cleanup (LOW)

> Priority: LOW | Estimated scope: 12 files

### 5.1 Dead Code Removal

```
File                                   Item
--------------------------------------------------------------
src/main.ts:294                        Unused variable cameraPos
src/main.ts:246                        Unused variable dynamicObstacles
src/rendering/AgentRenderer.ts:241     Unused tint parameter
src/rendering/MinimapRenderer.ts:30    Dead field scale
src/rendering/TilemapRenderer.ts:17    Unused gridOverlay
src/rendering/StatsChartRenderer.ts:13 Dead taskCompletionHistory
src/services/ReviewService.ts:12       Dead currentTask field
src/rendering/SpeechBubbleRenderer.ts:46 Unused lineHeight
```

### 5.2 Unused Imports

```
File                                   Unused Import
--------------------------------------------------------------
src/agent/Agent.ts                     BTNodeStatus
src/agent/CollaborationSystem.ts       AgentState
src/rendering/MeetingRoomRenderer.ts   Vec2
src/services/ReviewService.ts          AgentRole, AgentSnapshot
```

### 5.3 Shared Constants Extraction

```
Duplicated Constant                    Files
--------------------------------------------------------------
STATE_COLORS                           AgentRenderer, MinimapRenderer,
                                       AgentSelectionSystem (3x)
TILE_COLORS                            TilemapRenderer, MinimapRenderer (2x)
```

**Action:** Extract to `src/rendering/constants.ts`.

### 5.4 Missing Role Mappings

```
File                                   Missing Roles
--------------------------------------------------------------
src/rendering/AgentRenderer.ts:28      ROLE_ICONS: CEO, Architect, Coder, Reviewer
src/rendering/AgentRenderer.ts:258     roleColors: CEO, Architect, Coder, Reviewer
src/services/TaskService.ts:21         roleDeskMap: SecurityEngineer, PerformanceEngineer
```

### 5.5 Map Mutation During Iteration (5 locations)

```
src/core/ToastManager.ts:119           clearAll
src/rendering/SpeechBubbleRenderer.ts:117  clearAll
src/rendering/ChartRenderer.ts:193     clearAll
src/rendering/TaskProgressRenderer.ts:124  clearAll
src/rendering/MeetingRoomRenderer.ts   update loop
```

**Action:** Collect keys into array first, then iterate and delete.

### 5.6 Missing Backend Dependencies

```
package.json is missing:
- express
- better-sqlite3
- cors
- @types/express (devDep)
- @types/better-sqlite3 (devDep)
- @types/cors (devDep)
```

---

## Phase 6: Testing Infrastructure (NEW)

> Priority: MEDIUM | Currently: No tests exist

### 6.1 Setup

```bash
npm install -D vitest @testing-library/dom jsdom
```

Add to `vite.config.ts`:
```ts
test: {
  environment: 'jsdom',
  include: ['src/**/*.test.ts'],
}
```

### 6.2 Priority Test Targets

```
Priority  Module                    Reason
--------------------------------------------------------------
1         spatial/Pathfinder.ts     Core algorithm, performance critical
2         pipeline/PipelineSystem   New feature, needs validation
3         core/EventBus.ts          Foundation of all communication
4         agent/BehaviorTree.ts     Complex state machine logic
5         services/TaskService.ts   Task lifecycle management
6         core/Orchestrator.ts      Pipeline routing logic
```

---

## Execution Timeline

```
Phase 1 (Security)      [##########]  Immediate
Phase 2 (Memory Leaks)  [########--]  After Phase 1
Phase 3 (Logic Fixes)   [######----]  After Phase 2
Phase 4 (Performance)   [#####-----]  Parallel with Phase 3
Phase 5 (Cleanup)       [###-------]  Ongoing
Phase 6 (Testing)       [####------]  Start ASAP, run parallel

Dependency graph:
  Phase 1 --> Phase 2 --> Phase 3
                    \
                     +--> Phase 4
  Phase 5 (independent, can start anytime)
  Phase 6 (independent, can start anytime)
```

---

## Metrics Target

| Metric | Current | Target |
|--------|---------|--------|
| Critical issues | 8 | 0 |
| High issues | 14 | 0 |
| Bundle size | 588 KB | < 400 KB |
| Test coverage | 0% | > 60% |
| XSS vectors | 8 | 0 |
| Memory leaks | 11 | 0 |
