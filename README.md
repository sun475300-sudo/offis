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
- **AgentPersona** - Agent personality/persona system
- **TaskQueue** - Priority-based task queue management
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

### Commands

```
테스트 실행:
  /test [에이전트] [동시] [시간]         # 부하 테스트
  /loadtest [개수] [속도]               # 부하 생성 테스트
  /debate-test [인원]                   # 토론 테스트
  /cicd-test [반복]                     # CI/CD 테스트
  /meeting-test [인원] [라운드]         # 회의 협업 테스트
  /stress-full                          # 전체 시스템 부하 테스트

분석 & 관리:
  /agent-perf, /detailed-perf          # 에이전트 성능
  /compare                              # 결과 비교
  /report [save]                        # 시스템 리포트
  /resource                             # 리소스 모니터링
  /queue [add|list|clear]               # 태스크 큐

템플릿 & 설정:
  /template save <name> <config>       # 템플릿 저장
  /scenario [quick|standard|heavy|stress]  # 시나리오
  /config export                        # 설정 내보내기
  /theme [list|set]                    # 테마 관리

코드 & 협업:
  /snippet add <name> <code>          # 코드 스니펫 저장
  /snippet search <query>              # 스니펫 검색
  /collab create <type>                # 협업 세션 생성
  /persona [agent-id]                   # 에이전트 페르소나
```

## 🎮 Running

```bash
npm install
npm run dev     # Development server at http://localhost:3000
npm run build   # Production build
```

## 📊 Architecture

```
src/
├── main.ts              # Main application (3100+ lines)
├── types/index.ts       # TypeScript interfaces
├── core/                # Core systems (EventBus, GameLoop, CLI, etc.)
├── agent/               # Agent systems (Manager, BehaviorTree, Collaboration)
├── rendering/           # 10+ PixiJS renderers
├── debate/              # Debate & CI/CD (DebateManager, RunnerManager)
├── services/
│   ├── TestSuite.ts     # Test runner & analysis
│   ├── FeatureServices.ts # Persona, Queue, Snippets, Theme, Config, Resource
│   ├── ReviewService.ts # Code analysis
│   ├── GitHubService.ts # GitHub API
│   └── LLMService.ts    # Task decomposition
└── ui/styles.css        # 1700+ lines
```

## 📈 Performance

- 60 FPS with 50+ agents
- < 100ms response time for commands
- Supports 100+ concurrent tasks
- Full stress test capability

## 🔗 GitHub Integration

Paste GitHub URLs to trigger:
- Repository analysis (`github.com/user/repo`)
- PR review (`github.com/user/repo/pull/123`)

## 🤖 Agents

- **Architect** - Code structure analysis (체계적, 논리적)
- **Security Engineer** - Bug detection (분석적, 철저함)
- **Performance Engineer** - Optimization (데이터 중심)
- **Developer** - Implementation (창의적, 실용적)

## 📝 License

MIT License

## 👤 Author

sun475300-sudo