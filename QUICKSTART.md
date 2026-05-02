# Offis — 1분 시작 가이드

> AI 직원 5명이 기다리고 있습니다. 지금 바로 채용하세요.

---

## ⚡ 30초 설치

```bash
git clone https://github.com/sun475300-sudo/offis.git
cd offis
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 열기 (또는 Electron 앱 자동 실행)

---

## 🎮 첫 명령 (30초)

입력창에 아무 자연어나 입력하세요:

```
신규 AI 카메라 앱 출시를 위한 마케팅 콘텐츠 패키지 만들어줘
```

화면에서:
- 픽셀 오피스의 에이전트들이 각자 자리에서 움직이기 시작
- 우측 패널에 작업 진행 상황 실시간 표시
- 완료 시 결과 파일 목록 안내

---

## 🛠️ 핵심 CLI 명령어 5개

| 명령 | 설명 |
|------|------|
| `/agents` | 현재 AI 직원 상태 확인 |
| `/tasks` | 진행 중인 태스크 목록 |
| `/github owner/repo 42` | PR #42 자동 리뷰 시작 |
| `/skill sns --source "URL"` | SNS 콘텐츠 일괄 생성 |
| `/skill landing --topic "제품명"` | 랜딩 페이지 즉시 생성 |

---

## 🤖 AI 직원 명단

```
비서    → 모든 요청의 첫 수신자. 작업 분배 담당
리서처  → 시장 조사, 경쟁사 분석
분석가  → 데이터 해석, 인사이트 도출
작성자  → 블로그·SNS·제안서·HTML 생성
운영자  → 자동화·배포·스킬 패키징
```

---

## 📦 내장 스킬 4개

```bash
/skill video-essencer --url "https://youtu.be/..."   # 영상 → 5종 콘텐츠
/skill proposal --topic "아이디어"                    # 완성형 제안서
/skill landing --topic "제품명"                       # HTML 랜딩 페이지
/skill sns --source "URL 또는 주제"                   # SNS 6개 플랫폼 포스팅
```

---

## 🔑 LLM 연동 (선택)

실제 AI 응답을 받으려면 `.env` 파일 생성:

```env
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...          # GitHub 워크플로 사용 시
```

설정 없이도 Mock 모드로 시뮬레이션 동작합니다.

---

더 자세한 내용은 [OPERATIONS.md](./OPERATIONS.md) 참조.
