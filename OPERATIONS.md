# Offis AI 에이전트 운영 가이드

> **기반**: [AI 직원 5명 채용했습니다… 인건비 0원 실화입니다 (Manus Skills 자동화 세팅 공개)](https://youtu.be/kAwsc5oc2Og)  
> **핵심 개념**: 반복 작업을 한 번만 수행하고 → AI 스킬로 패키징 → 무한 재사용

---

## 🏢 Offis AI 직원 소개

Offis 시스템에는 5명의 AI 에이전트(직원)가 상주합니다. 각 에이전트는 전문 역할을 맡아 픽셀 오피스 내 자신의 자리에서 대기하며, 태스크가 배정되면 즉시 작업을 시작합니다.

| 에이전트 | 역할 | 전문 분야 | 오피스 위치 |
|---------|------|---------|-----------|
| 🗂️ **비서** (Secretary) | 조율 & 위임 | 태스크 분해, 일정 관리, 보고 | PM 데스크 (17,15) |
| 🔍 **리서처** (Researcher) | 정보 수집 | 시장 조사, 경쟁사 분석, GitHub 리서치 | QA 데스크 (3,11) |
| 📊 **분석가** (Analyst) | 데이터 분석 | 인사이트 도출, KPI, SWOT | Backend 데스크 (9,15) |
| ✍️ **작성자** (Writer) | 콘텐츠 생성 | 블로그, SNS, 랜딩 페이지, 제안서 | Frontend 데스크 (3,15) |
| ⚙️ **운영자** (Operator) | 자동화 & 배포 | 스크립트, 스킬 패키징, GitHub 운영 | DevOps 데스크 (9,11) |
| 🎨 **디자이너** (Designer) | UI/UX 설계 | 디자인 토큰, 컴포넌트 스펙, 랜딩 레이아웃 | Designer 데스크 (17,9) |
| 💻 **코더** (Coder) | 코드 구현 & 리뷰 | TypeScript, PIXI.js, PR 리뷰, 리팩토링 | Frontend 데스크 (5,15) |

---

## 🎯 Manus Skills 핵심 원리

영상에서 소개한 핵심 철학:

```
기존 방식:  요청 → AI → 결과 → (다음에 또 처음부터)
                                         ↑ 비효율!

Manus 방식: 요청 → AI → 결과
                    ↓
              [스킬로 저장]
                    ↓
              다음에: 스킬 호출 → 즉시 결과 (재설명 불필요)
```

**적용 기준**: 같은 작업을 3번 이상 반복하면 스킬로 패키징할 가치가 있다.

---

## 📦 내장 스킬 (Manus Skills → Offis 구현)

영상에서 시연된 4개 스킬을 Offis에 이식했습니다:

### 스킬 1: 비디오 콘텐츠 에센서
**위치**: `.claude/agents/skills/video-content-essencer.md`  
**기능**: YouTube 영상 1개 → 블로그 + Shorts 대본 + LinkedIn + SNS 캡션 + SEO 태그 동시 생성  
**CLI**: `/skill video-essencer --url "https://youtu.be/..."`

### 스킬 2: 프로포잘 제너레이터
**위치**: `.claude/agents/skills/proposal-generator.md`  
**기능**: 주제 입력 → 시장 분석 + 경쟁사 비교 + 포지셔닝 + KPI + 가격 정책 포함 완성형 제안서  
**CLI**: `/skill proposal --topic "제품명" --audience "목표 고객"`

### 스킬 3: 랜딩 페이지 제너레이터
**위치**: `.claude/agents/skills/landing-page-generator.md`  
**기능**: 주제만 입력 → 즉시 배포 가능한 완성형 HTML 랜딩 페이지 (반응형, 애니메이션 포함)  
**CLI**: `/skill landing --topic "제품명" --theme dark`

### 스킬 4: SNS 콘텐츠 제너레이터
**위치**: `.claude/agents/skills/sns-content-generator.md`  
**기능**: 콘텐츠/URL 입력 → 6개 플랫폼 최적화 콘텐츠 일괄 생성  
**CLI**: `/skill sns --source "URL 또는 주제"`

---

## 🚀 Offis 시작하기

### 1. 개발 환경 실행
```bash
cd E:\GitHub\offis
npm install
npm run dev
```

### 2. CLI 기본 명령어

| 명령어 | 설명 |
|--------|------|
| `help` | 전체 명령어 목록 |
| `/agents` | 현재 에이전트 상태 조회 |
| `/tasks` | 태스크 큐 확인 |
| `/github <owner>/<repo> <PR번호>` | GitHub PR 워크플로 시작 |
| `/debate <세션ID>` | 기술 토론 세션 실행 |
| `/skill <스킬명> [옵션]` | 스킬 직접 실행 |

### 3. 자연어 명령 (CLI 없이)
입력창에 자유롭게 입력하면 Orchestrator가 자동으로 적합한 에이전트에게 분배합니다:
```
"신규 SaaS 제품 마케팅 콘텐츠 패키지 만들어줘"
→ 비서가 받아서 리서처 → 분석가 → 작성자 순으로 자동 위임
```

---

## 🔄 워크플로 예시

### 예시 1: 신제품 콘텐츠 마케팅 전체 파이프라인
```
1. 사용자 입력:
   "AI 캘린더 앱 출시를 위한 전체 마케팅 자료 준비해줘"

2. 비서 → 태스크 분해:
   ├── [리서처] AI 캘린더 앱 시장 조사
   ├── [분석가] 경쟁사 포지셔닝 분석
   ├── [작성자] 랜딩 페이지 생성
   ├── [작성자] SNS 콘텐츠 패키지 생성
   └── [작성자] 투자자용 제안서 작성

3. 에이전트들이 픽셀 오피스에서 순차 실행

4. 비서 → 완료 보고 + 파일 목록 안내
```

### 예시 2: GitHub PR 자동 리뷰 워크플로
```
1. CLI 입력:
   /github sun475300-sudo/offis 42

2. Orchestrator 자동 처리:
   ├── [리서처]  PR #42 변경사항 및 관련 이슈 파악
   ├── [분석가]  코드 영향 범위 및 리스크 분석
   ├── [운영자]  타입 체크 + 린트 실행
   └── [작성자]  리뷰 코멘트 초안 작성

3. DebateManager → 기술 토론 세션 자동 개시
   (Frontend, Backend, QA 에이전트가 회의실로 이동)
```

### 예시 3: 새 워크플로를 스킬로 패키징
```
작업을 처음 완료한 후:

1. 운영자에게 요청:
   "방금 한 SNS 콘텐츠 작업을 스킬로 저장해줘"

2. 운영자 수행:
   - 작업 단계 역추적
   - 입력/출력 인터페이스 정의
   - .claude/agents/skills/[스킬명].md 생성

3. 다음부터:
   /skill [스킬명] --input "..."
   → 즉시 동일 품질로 재실행
```

---

## 📁 디렉토리 구조

```
offis/
├── .claude/
│   └── agents/                     ← AI 에이전트 정의
│       ├── secretary.md            ← 비서
│       ├── researcher.md           ← 리서처
│       ├── analyst.md              ← 분석가
│       ├── writer.md               ← 작성자
│       ├── operator.md             ← 운영자
│       └── skills/                 ← 재사용 스킬 라이브러리
│           ├── video-content-essencer.md
│           ├── proposal-generator.md
│           ├── landing-page-generator.md
│           └── sns-content-generator.md
├── src/
│   ├── agent/                      ← AgentManager, CollaborationSystem
│   ├── core/                       ← Orchestrator, EventBus, CLIEngine
│   ├── services/                   ← TaskService, LLMService, GitHubService
│   ├── debate/                     ← DebateManager, RunnerManager
│   └── rendering/                  ← PIXI.js 렌더러
├── OPERATIONS.md                   ← 이 파일
└── package.json
```

---

## 🛠️ 새 에이전트 추가하기

1. `.claude/agents/새에이전트.md` 파일 생성
2. 필수 섹션 포함:
   - `## Role` — 한 줄 역할 설명
   - `## System Prompt` — AI 지시사항
   - `## Tool Restrictions` — 허용된 도구 목록
   - `## Use Cases` — 사용 케이스 3개 (입력/출력 예시 포함)
3. `src/agent/AgentData.ts`에 에이전트 등록
4. `src/services/TaskService.ts`의 `roleDeskMap`에 위치 추가

---

## 💡 스킬 제작 팁 (영상 핵심 노하우)

1. **SOP 먼저**: 스크립트 작성 전에 단계별 절차를 한국어로 먼저 정리
2. **입출력 명확화**: 스킬의 입력과 출력을 YAML로 명시
3. **에이전트 체인**: 단일 에이전트보다 여러 전문 에이전트를 순서대로 연결
4. **버전 관리**: 스킬 파일도 git으로 관리 → 스킬 히스토리 추적 가능
5. **테스트 케이스**: 각 스킬에 실제 사용 예시 3개 이상 포함

---

## ⚡ 빠른 참조

```bash
# 개발 서버 시작
npm run dev

# 타입 체크 (에러 없어야 함)
npx tsc --noEmit

# 빌드
npm run build

# Electron 앱 실행
npm run electron
```

---

*Offis — 당신의 픽셀 오피스에 AI 직원을 채용하세요. 인건비 0원.*
