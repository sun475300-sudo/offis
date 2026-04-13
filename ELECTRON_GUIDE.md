# 🖥️ PIXEL OFFICE — 로컬 데스크탑 앱 실행 가이드

## 빠른 시작

### 1단계: 패키지 설치

```bash
npm install
```

### 2단계: 로컬 데스크탑 앱 실행 (개발 모드)

```bash
npm run electron:dev
```

> Vite dev 서버(포트 3000) + Electron 창이 동시에 실행됩니다.

---

## 명령어 전체 목록

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 브라우저용 웹 서버 실행 (localhost:3000) |
| `npm run electron:dev` | **로컬 데스크탑 앱 실행 (개발 모드)** ⭐ |
| `npm run electron:build` | 배포용 설치 파일 생성 (.exe / .dmg / .AppImage) |
| `npm run build` | Vite 빌드만 실행 |

---

## 환경 변수 설정 (선택)

`.env.example`을 `.env`로 복사한 뒤 API 키를 추가합니다:

```bash
cp .env.example .env
```

```env
VITE_ANTHROPIC_API_KEY=sk-ant-xxx
VITE_OPENAI_API_KEY=sk-xxx
VITE_GITHUB_TOKEN=github_pat_xxx
```

---

## 단축키

| 키 | 동작 |
|----|------|
| `F5` | 새로고침 |
| `F11` | 전체화면 전환 |
| `F12` | 개발자 도구 |
| `Ctrl+0` | 기본 크기 복원 |
| `Ctrl+=/−` | 확대/축소 |

---

## CLI 명령어 (앱 내 하단 입력창)

| 명령어 | 설명 |
|--------|------|
| `/test 20 40` | 에이전트 20명, 태스크 40개 부하 테스트 |
| `/meeting standup` | 스탠드업 회의 소집 |
| `/blueprint <이름>` | 시스템 설계 문서 생성 |
| `/deep-dive <기능>` | 상세 스펙 인터뷰 |
| `/autoresearch 5` | 5라운드 성능 자동 평가 |
| `/reflect` | 세션 회고 |
| `/harness` | 에이전트 하네스 현황 (영상 2 개념) |
| `/session demo` | Managed Agent 세션 데모 생성 (영상 3 개념) |
| `/persona Frontend` | 프론트엔드 에이전트 시스템 프롬프트 조회 |
