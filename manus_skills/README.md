# Manus Skills 변환 가이드

> Offis `.claude/agents/skills/` 파일을 실제 Manus에 임포트하는 방법

---

## Manus Skills 구조 (영상 분석 기반)

Manus에서 스킬은 다음 3요소로 구성됩니다:

```
1. 트리거 조건  — 언제 이 스킬을 쓸지 (키워드 or 상황)
2. 지시사항     — AI에게 보내는 system prompt (SOP 형태)
3. 출력 형식    — 결과물 구조 명세
```

---

## 변환 절차 (Offis → Manus)

### Step 1: Manus 앱 열기
- Manus 웹/앱 접속
- 좌측 메뉴 → **My Skills** 클릭

### Step 2: 새 스킬 생성
- **+ New Skill** 또는 **/** 입력 → **Skill Creator** 선택
- 스킬 이름 입력 (예: `video-content-essencer`)

### Step 3: 아래 YAML을 Manus 프롬프트 필드에 붙여넣기

각 스킬별 변환 파일이 이 디렉토리에 있습니다:
- `video-content-essencer.yaml`
- `proposal-generator.yaml`
- `landing-page-generator.yaml`
- `sns-content-generator.yaml`

### Step 4: 테스트 실행
- **Test** 버튼으로 샘플 입력 테스트
- 출력 형식 확인 후 저장

### Step 5: 스킬 체이닝
여러 스킬을 연결하려면 한 스킬의 출력을 다음 스킬의 입력으로 지정:
```
video-essencer 출력(blog-post.md) → sns-generator 입력(source)
```

---

## Claude Code → Manus 변환 대응표

| Claude Code 개념 | Manus 대응 |
|----------------|-----------|
| `.claude/agents/secretary.md` | My Skills > Orchestrator |
| `## System Prompt` | Skill Instructions 필드 |
| `## Tool Restrictions` | Tool Access 설정 |
| `## Use Cases` | Example Prompts |
| `/skill {name} --input` | Skills 패널에서 클릭 |
| `COLLABORATION_TEMPLATES.md` | Multi-skill Workflow |
