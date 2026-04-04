# 2D Pixel Office Dashboard - Multi-Agent System (MAS)

Enterprise-grade multi-agent dashboard with pixel art office environment, real-time agent management, code review pipeline, CI/CD feedback loops, and GitHub integration.

## 🏢 Project Overview

A 2D pixel art office environment where dozens of AI agents collaborate to handle code reviews, debates, and CI/CD workflows. Built with TypeScript + PixiJS.

## 🚀 Features

### Core Systems
- **EventBus** - Pub/Sub pattern for agent communication
- **GameLoop** - Delta-time based rendering loop
- **Orchestrator** - Task management and agent assignment
- **ChatSystem** - Inter-agent messaging
- **ToastManager** - Real-time notifications

### Agent Systems
- **Agent & AgentManager** - FSM-based agent behavior
- **BehaviorTree** - Hierarchical task execution
- **CollaborationSystem** - Meeting room coordination
- **ReviewService** - Multi-perspective code analysis

### Rendering (10+ Renderers)
- AgentRenderer, TilemapRenderer, SpeechBubbleRenderer
- TaskProgressRenderer, ChartRenderer, MeetingRoomRenderer
- MinimapRenderer, ParticleSystem, PerformanceOverlay
- AgentSelectionSystem

### Debate & CI/CD
- **DebateManager** - 3-turn code review debates
- **RunnerManager** - CI/CD feedback loops with test runners

### GitHub Integration
- Repository analysis
- PR review with diff parsing
- Code file fetching

## 🧪 Test Suite

### Available Commands

```
테스트 실행:
  /test [에이전트] [동시] [시간]         # 부하 테스트
  /loadtest [개수] [속도]               # 부하 생성 테스트
  /debate-test [인원]                   # 토론 테스트
  /cicd-test [반복]                     # CI/CD 테스트
  /meeting-test [인원] [라운드]         # 회의 협업 테스트
  /latency [ms]                        # 네트워크 지연 설정
  /scenario [quick|standard|heavy|stress]  # 커스텀 시나리오

스케줄 & 히스토리:
  /schedule add <이름> <분>            # 스케줄 추가
  /schedule list                       # 스케줄 목록
  /history [개수]                      # 테스트 히스토리
  /clear-history                       # 히스토리 초기화

분석 & 내보내기:
  /export [csv|json]                  # 결과 내보내기
  /notify list                         # 알림 설정
  /agent-perf                          # 에이전트 성능
  /compare                             # 결과 비교
  /template save <이름> <config>       # 템플릿 저장
  /template list                       # 템플릿 목록
  /webhook add <url> <events>          # 웹훅 추가
```

### Test Types

| Type | Description | Metrics |
|------|-------------|---------|
| Stress | Agent concurrent tasks | tasks, failed, duration |
| Load | Mass agent spawning | spawn time, memory, FPS drop |
| Debate | Multi-party debates | turns, errors |
| CI/CD | Feedback loops | success, failed, avg time |
| Meeting | Team collaboration | messages, conflicts |
| Agent Type | Per-type performance | tasks, avgTime, errors |

### Test Results Comparison

Use `/compare` to compare current test result with previous:
```
=== 테스트 결과 비교 ===
tasks: 150 → 180 (↑ 20.0%)
time: 500ms → 450ms (↓ 10.0%)
```

### Export Formats

- **CSV**: `/export csv` - Downloads `test-results-{timestamp}.csv`
- **JSON**: `/export json` - Downloads `test-results-{timestamp}.json`

### Notifications

Configure alerts for:
- `failure` - Task failure threshold
- `slow` - Execution time threshold
- `memory` - Memory usage threshold
- `rate-limit` - GitHub API rate limit hits

### Webhooks

Send test results to external endpoints:
```
/webhook add https://your-server.com/webhook test.complete,cicd.complete
/webhook list
/webhook test
```

### Templates

Save and reuse test configurations:
```
/template save mytest {"agentCount":20,"concurrentTasks":5,"duration":10}
/template run template-1234567890
```

## 📊 Test Dashboard

The UI includes a test dashboard panel with:
- Test statistics (count, success rate, avg time)
- Visual charts (bar, line, pie)
- Scheduled tests
- Quick scenario buttons

## 🏗️ Architecture

```
src/
├── main.ts              # Main application (3000+ lines)
├── types/index.ts       # TypeScript interfaces
├── core/
│   ├── EventBus.ts      # Pub/Sub event system
│   ├── GameLoop.ts      # Render loop
│   ├── Orchestrator.ts  # Task decomposition
│   ├── CLIEngine.ts     # Command handler
│   ├── SoundManager.ts  # Audio feedback
│   ├── ChatSystem.ts    # Agent chat
│   └── ToastManager.ts  # Notifications
├── agent/
│   ├── Agent.ts         # Agent entity
│   ├── AgentManager.ts  # Agent pool
│   ├── BehaviorTree.ts  # Task execution
│   └── CollaborationSystem.ts
├── rendering/           # 10+ PixiJS renderers
├── debate/
│   ├── DebateManager.ts # Code debates
│   └── RunnerManager.ts # CI/CD runners
├── services/
│   ├── TestSuite.ts     # Test runner
│   ├── ReviewService.ts # Code analysis
│   ├── GitHubService.ts # GitHub API
│   └── LLMService.ts    # Task decomposition
└── ui/styles.css        # 1700+ lines
```

## 🎮 Running

```bash
npm install
npm run dev     # Development server at http://localhost:3000
npm run build   # Production build
```

## 📈 Performance

- 60 FPS with 50+ agents
- < 100ms response time for commands
- Supports 100+ concurrent tasks

## 🔗 GitHub Integration

Paste GitHub URLs to trigger:
- Repository analysis (`github.com/user/repo`)
- PR review (`github.com/user/repo/pull/123`)

## 🤖 Agents

- **Architect** - Code structure analysis
- **Security Engineer** - Bug and vulnerability detection
- **Performance Engineer** - Optimization suggestions
- **Developer** - Implementation tasks
- **Reviewer** - Code quality checks

## 📝 License

MIT License

## 👤 Author

sun475300-sudo