# SKILL_COMPOSITION.md — 스킬 조합 가이드

## 개요

Offis MAS의 스킬은 독립 실행도 가능하지만, **조합(composition)** 시 더 강력한 워크플로우를 만든다.
각 스킬은 입력→처리→출력 인터페이스를 가지며, 한 스킬의 출력이 다음 스킬의 입력이 된다.

---

## 스킬 카탈로그

| 스킬 | 입력 | 출력 | 주 에이전트 |
|------|------|------|------------|
| changelog-generator | git log / commit 목록 | CHANGELOG.md | 작성자 |
| release-notes-generator | CHANGELOG.md + 버전 | GitHub Release + SNS 포스트 | 작성자 |
| email-template-generator | 목적 + 수신자 + 내용 | 이메일 3종(간결/표준/상세) | 작성자 |
| meeting-summary-generator | 회의록/트랜스크립트 | 구조화된 회의록 + 액션아이템 + Slack 포맷 | 비서 |
| code-review-checklist | PR diff | 체크리스트 + 개선 제안 | 리뷰어 |
| performance-profiler | FPS 데이터 + 코드 | 병목 분석 + 최적화 제안 | 옵티마이저 |
| i18n-translator | 텍스트 + 언어쌍 | 번역본 + 용어집 항목 | 번역가 |
| test-generator | 소스 코드 + 요구사항 | Vitest 테스트 파일 | 테스터 |

---

## 조합 패턴 8가지

### 1. 개발→릴리즈 파이프라인 (가장 자주 사용)

```
git log (코더 커밋)
  → changelog-generator         # CHANGELOG.md 생성
  → release-notes-generator     # GitHub Release 문서 생성
  → email-template-generator    # 릴리즈 공지 이메일 작성
  → i18n-translator             # KO/EN 버전 생성
```

**입력**: `git log --oneline v1.0.0..HEAD`  
**최종 출력**: 버전별 릴리즈 노트 + 이메일 KO/EN + SNS 포스트  
**담당 에이전트 체인**: 코더 → 작성자 → 번역가

---

### 2. PR 검증 루프

```
PR diff (코더 제출)
  → code-review-checklist       # Critical/Warning/Suggestion 분류
  → test-generator              # 누락 테스트 보완
  → performance-profiler        # 성능 영향 분석
  → (리뷰어 최종 승인)
```

**입력**: `gh pr diff <PR번호>`  
**최종 출력**: 리뷰 완료된 PR + 보완 테스트 + 성능 리포트  
**담당 에이전트 체인**: 코더 → 리뷰어 → 테스터 → 옵티마이저 → 리뷰어

---

### 3. 회의→업무 전파 파이프라인

```
회의 트랜스크립트 (비서 수집)
  → meeting-summary-generator   # 구조화된 회의록 + 액션아이템
  → email-template-generator    # 참석자 공유 이메일
  → i18n-translator             # 다국어 팀 배포용
```

**입력**: 회의 녹취 텍스트  
**최종 출력**: 회의록 + 공유 이메일 KO/EN  
**담당 에이전트 체인**: 비서 → 작성자 → 번역가

---

### 4. 테스트→커버리지→문서화

```
소스 코드 (코더 작성)
  → test-generator              # Vitest 테스트 파일 생성
  → (vitest run --coverage)     # 커버리지 측정
  → changelog-generator         # 테스트 추가 항목 변경이력 반영
```

**입력**: `src/core/*.ts` 신규 파일  
**최종 출력**: 테스트 파일 + 커버리지 리포트 + CHANGELOG 업데이트  
**담당 에이전트 체인**: 코더 → 테스터 → 작성자

---

### 5. 성능 최적화 사이클

```
성능 이슈 보고 (운영자 감지)
  → performance-profiler        # 병목 분석 (FPS, 번들 크기)
  → code-review-checklist       # 최적화 전/후 코드 리뷰
  → test-generator              # 회귀 방지 테스트
  → changelog-generator         # 최적화 내역 기록
```

**입력**: FPS 드롭 리포트 / 번들 크기 경고  
**최종 출력**: 최적화된 코드 + 회귀 테스트 + 변경이력  
**담당 에이전트 체인**: 운영자 → 옵티마이저 → 리뷰어 → 테스터 → 작성자

---

### 6. 글로벌 배포 파이프라인

```
릴리즈 노트 (작성자 생성)
  → i18n-translator             # 10개 언어 번역
  → email-template-generator    # 각 언어별 공지 이메일
  → (배포 자동화)
```

**입력**: 완성된 릴리즈 노트 (KO)  
**최종 출력**: KO/EN/JA/ZH... 다국어 릴리즈 노트 + 이메일  
**담당 에이전트 체인**: 작성자 → 번역가

---

### 7. 비상 대응 스킬 체인

```
장애 발생 (운영자 감지)
  → meeting-summary-generator   # 장애 대응 회의 즉시 요약
  → email-template-generator    # 이해관계자 긴급 통보 이메일
  → changelog-generator         # 인시던트 변경이력 기록
  → performance-profiler        # 근본원인 성능 분석
```

**입력**: 장애 증상 + 대응 로그  
**최종 출력**: 인시던트 리포트 + 이해관계자 이메일 + 포스트모템  
**담당 에이전트 체인**: 운영자 → 비서 → 작성자 → 옵티마이저

---

### 8. 온보딩 문서 자동화

```
새 기능 코드 (코더 작성)
  → code-review-checklist       # 코드 품질 확인
  → test-generator              # 기능 테스트
  → changelog-generator         # 기능 추가 기록
  → release-notes-generator     # 개발자용 마이그레이션 가이드
  → i18n-translator             # 다국어 문서화
```

**입력**: 새 API / 컴포넌트 코드  
**최종 출력**: 테스트 + 변경이력 + 마이그레이션 가이드 KO/EN  
**담당 에이전트 체인**: 코더 → 테스터 → 작성자 → 번역가

---

## 스킬 조합 원칙

### DO
- ✅ 한 스킬의 **출력 포맷**을 다음 스킬의 **입력 포맷**에 맞춤
- ✅ 조합 전 각 스킬 단독 테스트 후 체인 구성
- ✅ 중간 결과물을 `docs/`, `.claude/` 에 저장해 재사용
- ✅ 병렬 실행 가능한 스킬은 동시 호출 (번역 여러 언어 등)

### DON'T
- ❌ 스킬 간 직접 코드 의존성 (각 스킬은 독립 실행 가능해야 함)
- ❌ 한 스킬에 너무 많은 책임 부여 (단일 책임 원칙)
- ❌ 중간 결과물 없이 7단계 이상 체인 (디버깅 불가)

---

## 빠른 참조: 상황별 추천 스킬 조합

| 상황 | 추천 조합 |
|------|----------|
| PR 제출 전 | test-generator → code-review-checklist |
| 버전 릴리즈 | changelog-generator → release-notes-generator → email-template-generator |
| 스프린트 종료 | meeting-summary-generator → changelog-generator |
| 글로벌 배포 | release-notes-generator → i18n-translator |
| 장애 대응 | meeting-summary-generator → email-template-generator |
| 신규 기능 | test-generator → changelog-generator → release-notes-generator |
