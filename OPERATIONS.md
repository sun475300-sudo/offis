# PIXEL OFFICE — AI 에이전트 운영 가이드

> **Manus Skills 기반 9 에이전트 + 6 스킬 자동화 시스템**
> 영상 [AI 직원 5명 채용했습니다](https://youtu.be/kAwsc5oc2Og) 기반 구현 + 확장

---

## 📋 9 에이전트 매트릭스

| # | 에이전트 | 파일 | 핵심 역할 | 주요 도구 |
|---|---------|------|----------|----------|
| 1 | **비서 (Secretary)** | `secretary.md` | 태스크 분해·위임·조율 | 모든 에이전트 오케스트레이션 |
| 2 | **리서처 (Researcher)** | `researcher.md` | 시장조사·기술리서치·PR분석 | WebSearch, WebFetch |
| 3 | **분석가 (Analyst)** | `analyst.md` | 인사이트·KPI·SWOT·데이터분석 | Read, Write |
| 4 | **작성자 (Writer)** | `writer.md` | 블로그·SNS·랜딩페이지·제안서 | Write |
| 5 | **운영자 (Operator)** | `operator.md` | 자동화·스킬패키징·배포·GitHub | Bash (전체) |
| 6 | **디자이너 (Designer)** | `designer.md` | 디자인토큰·컴포넌트스펙·레이아웃 | Read, Write, WebFetch |
| 7 | **코더 (Coder)** | `coder.md` | TypeScript·PIXI.js·타입수정·리팩터링 | Read, Edit, Bash |
| 8 | **테스터 (Tester)** | `tester.md` | 테스트케이스 생성·커버리지 보강 | Read, Write, Bash |
| 9 | **리뷰어 (Reviewer)** | `reviewer.md` | 코드리뷰·보안감사·성능분석 | Read, Bash |

---

## 🛠️ 6 재사용 스킬 라이브러리

| # | 스킬 | 파일 | 파이프라인 | 출력물 |
|---|------|------|-----------|-------|
| 1 | **video-content-essencer** | `skills/video-content-essencer.md` | 운영자→분석가→작성자 | Shorts스크립트·블로그·LinkedIn·SNS·SEO |
| 2 | **proposal-generator** | `skills/proposal-generator.md` | 리서처→분석가→작성자 | 8섹션 사업제안서 |
| 3 | **landing-page-generator** | `skills/landing-page-generator.md` | 분석가→작성자→운영자 | 즉시배포 HTML |
| 4 | **sns-content-generator** | `skills/sns-content-generator.md` | 분석가→작성자→운영자 | 6플랫폼 최적화 포스팅 |
| 5 | **changelog-generator** | `skills/changelog-generator.md` | 운영자→분석가→작성자→운영자 | CHANGELOG.md |
| 6 | **release-notes-generator** | `skills/release-notes-generator.md` | 운영자→분석가→작성자→운영자 | 릴리즈노트 (GitHub+SNS) |

---

## 🔑 Manus Skill 원칙

```
"한 번 잘 하면 → 스킬로 패키징 → 언제든 재사용"

일반 AI 사용법: 매번 처음부터 프롬프트 작성
Manus Skills:   /skill [이름] → 즉시 전문가 워크플로 실행
```

**스킬 vs 에이전트 차이:**
- **에이전트** = 전문 역할을 가진 AI 직원 (항상 대기)
- **스킬** = 여러 에이전트가 순서대로 실행하는 표준 워크플로 (재사용 패키지)

---

## 🚀 5가지 자동화 워크플로 시나리오

### 시나리오 1: 신규 제품 런칭 캠페인
```
트리거: "새 AI 기능 런칭 마케팅 해줘"

비서 → 작업 분해:
  ├─ 리서처: 경쟁사 3곳 포지셔닝 조사
  ├─ 분석가: SWOT + 타겟 페르소나 정의
  ├─ 작성자: /skill landing-page-generator (랜딩페이지)
  ├─ 작성자: /skill sns-content-generator (6플랫폼 포스팅)
  └─ 운영자: 파일 패키징 + git push

소요: ~20분 | 산출물: 랜딩페이지 HTML + SNS 6종 + 포지셔닝 분석
```

### 시나리오 2: 주간 콘텐츠 보고서
```
트리거: "이번 주 유튜브 영상 콘텐츠로 만들어줘" (URL 제공)

운영자 → yt-dlp로 자막 추출
분석가 → 핵심 인사이트 5개 추출
작성자 → Shorts 3개 + 블로그 1500자 + LinkedIn + SNS 5종
운영자 → /skill changelog-generator (콘텐츠 변경 기록)

소요: ~15분 | 산출물: 5종 콘텐츠 패키지
```

### 시나리오 3: 경쟁사 모니터링
```
트리거: "경쟁사 A, B, C 이번 달 동향 분석해줘"

비서 → 3개 병렬 서브태스크 생성
  ├─ 리서처: 각 경쟁사 최신 블로그/PR/채용공고 수집
  ├─ 분석가: 기능 비교 매트릭스 + 시장 트렌드 추출
  └─ 작성자: /skill proposal-generator (대응 전략 제안서)

소요: ~25분 | 산출물: 경쟁 분석 보고서 + 대응 전략
```

### 시나리오 4: 코드 릴리즈 자동화
```
트리거: "v1.2.0 릴리즈 준비해줘"

코더 → tsc --noEmit 타입 검증
테스터 → npm test (38+ 테스트 통과 확인)
리뷰어 → git diff main..release 코드 리뷰
운영자 → /skill changelog-generator
운영자 → /skill release-notes-generator --version v1.2.0
운영자 → git tag v1.2.0 && git push origin v1.2.0

소요: ~10분 | 산출물: 검증된 릴리즈 + CHANGELOG + 릴리즈노트
```

### 시나리오 5: 장애 대응 + 사후 분석
```
트리거: "빌드가 깨졌어, 빠르게 분석해줘"

코더 → git log --oneline -5 (최근 변경 확인)
코더 → tsc --noEmit (타입 오류 목록)
테스터 → npm test (실패 케이스 격리)
리뷰어 → 원인 코드 분석 + 수정안 제시
운영자 → 핫픽스 커밋 + 태그

소요: ~5분 | 산출물: 버그 수정 + 원인 분석 리포트
```

---

## ⚡ 에이전트 빠른 참조

```bash
# 비서에게 큰 작업 위임
"비서야, [복잡한 목표] 달성해줘. 필요한 에이전트 조율해줘"

# 특정 에이전트 직접 호출
"리서처야, [주제] 최신 동향 조사해줘"
"분석가야, 이 데이터에서 인사이트 뽑아줘"
"작성자야, 이 내용으로 블로그 1500자 써줘"
"운영자야, 이 작업을 스킬로 패키징해줘"
"디자이너야, AgentCard 컴포넌트 스펙 잡아줘"
"코더야, 이 TypeScript 타입 오류 고쳐줘"
"테스터야, TaskService 테스트 케이스 만들어줘"
"리뷰어야, 이 PR diff 리뷰해줘"

# 스킬 직접 실행
/skill video-essencer --url "https://youtu.be/..."
/skill proposal-generator
/skill landing-page-generator
/skill sns-content-generator
/skill changelog-generator --from v1.0.0
/skill release-notes --version v1.1.0
```

---

## 🤝 에이전트 간 협업 메시지 형식

```markdown
**FROM**: [에이전트명]
**TO**: [에이전트명]
**TASK**: [구체적 작업 지시]
**INPUT**: [전달 데이터/파일 경로]
**OUTPUT**: [기대 산출물 형식]
**DEADLINE**: [우선순위: 즉시/오늘/이번주]
**DEPENDS_ON**: [선행 조건]
```

---

## 📁 디렉토리 구조

```
.claude/
├── agents/
│   ├── secretary.md          # 비서 (오케스트레이터)
│   ├── researcher.md         # 리서처
│   ├── analyst.md            # 분석가
│   ├── writer.md             # 작성자
│   ├── operator.md           # 운영자
│   ├── designer.md           # 디자이너
│   ├── coder.md              # 코더
│   ├── tester.md             # 테스터 (NEW)
│   ├── reviewer.md           # 리뷰어 (NEW)
│   ├── COLLABORATION_TEMPLATES.md
│   ├── TEST_SCENARIOS.md
│   └── skills/
│       ├── video-content-essencer.md
│       ├── proposal-generator.md
│       ├── landing-page-generator.md
│       ├── sns-content-generator.md
│       ├── changelog-generator.md      # NEW
│       └── release-notes-generator.md  # NEW
manus_skills/                 # Manus 플랫폼 YAML 변환본
├── README.md
├── video-content-essencer.yaml
├── proposal-generator.yaml
├── landing-page-generator.yaml
└── sns-content-generator.yaml
```

---

*PIXEL OFFICE Multi-Agent System — 9 에이전트, 6 스킬, 무한 확장 가능*
