# Skill: changelog-generator

## 트리거 키워드
`/skill changelog`, "CHANGELOG 만들어줘", "릴리즈 노트 써줘", "변경사항 정리해줘", "git log → changelog"

## 목적
`git log`를 분석하여 Conventional Commits 형식에 맞는 `CHANGELOG.md`를 자동 생성합니다.

## 파이프라인

```
operator(git log 수집)
    ↓
analyst(커밋 분류 및 중요도 평가)
    ↓
writer(CHANGELOG.md 작성)
    ↓
operator(파일 저장 + git add)
```

## 실행 방법

```bash
/skill changelog                         # HEAD~20 기준 최근 변경사항
/skill changelog --from v1.0.0           # 특정 태그 이후
/skill changelog --from HEAD~50 --to HEAD
```

## Operator 단계: 데이터 수집

```bash
# 커밋 로그 수집 (타입·스코프·제목·SHA)
git log --pretty=format:"%H|%s|%an|%ad" --date=short [FROM]..[TO]

# 변경 파일 통계
git diff --stat [FROM]..[TO]

# 기존 CHANGELOG.md 확인
cat CHANGELOG.md 2>/dev/null | head -50
```

## Analyst 단계: 커밋 분류

| Conventional Prefix | CHANGELOG 섹션 |
|---------------------|---------------|
| `feat:` / `feat(*):`  | ✨ Features |
| `fix:` / `fix(*):` | 🐛 Bug Fixes |
| `perf:` | ⚡ Performance |
| `refactor:` | ♻️ Refactoring |
| `test:` | 🧪 Tests |
| `ci:` | 🔧 CI/CD |
| `docs:` | 📚 Documentation |
| `chore:` | 🔩 Chores |
| `BREAKING CHANGE` | 💥 Breaking Changes (최상단 강조) |

중요도 평가:
- Breaking Change → 항상 포함
- feat/fix → 항상 포함
- 나머지 → 5개 이상 시 요약, 이하 시 개별 나열

## Writer 단계: 출력 형식

```markdown
# Changelog

All notable changes to PIXEL OFFICE will be documented here.
Format: [Semantic Versioning](https://semver.org)

---

## [Unreleased] — 2026-05-03

### 💥 Breaking Changes
- **AgentManager**: 에이전트 초기화 API 변경 (`init()` → `bootstrap()`)

### ✨ Features
- Manus Skills 기반 5 에이전트 시스템 추가 (`feccc49`)
- Designer · Coder 에이전트 추가 (`99084ca`)
- GitHub Actions CI 자동화 (`aadbe12`)

### 🐛 Bug Fixes
- TypeScript strict 모드 컴파일 오류 전면 수정 (`f11eb83`)

### 🧪 Tests
- Vitest 단위 테스트 38개 추가 — EventBus·TaskService·Tilemap·Pathfinder (`32b1acb`)

### 📚 Documentation
- OPERATIONS.md 한국어 운영 가이드 작성
- QUICKSTART.md 30초 시작 가이드

---

## [1.0.0] — 2026-04-15
...
```

## Operator 단계: 저장

```bash
# 기존 파일이 있으면 새 섹션을 맨 위에 삽입
# 없으면 새로 생성
cat > CHANGELOG.md << 'CONTENT'
[생성된 내용]
CONTENT

git add CHANGELOG.md
echo "CHANGELOG.md 업데이트 완료"
```

## 출력물
- `CHANGELOG.md` (루트 디렉토리)
- 커밋 분류 요약 (총 N개 커밋, N개 feat, N개 fix...)
