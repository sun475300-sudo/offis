# Skill: release-notes-generator

## 트리거 키워드
`/skill release-notes`, "릴리즈 노트 만들어줘", "배포 노트 써줘", "release notes", "GitHub Release 작성해줘"

## 목적
CHANGELOG, PR 목록, git log를 종합하여 사용자 친화적인 릴리즈 노트를 생성합니다. GitHub Releases 또는 블로그 포스팅 형식으로 출력합니다.

## 파이프라인

```
operator(데이터 수집: git log + CHANGELOG + PR 제목)
    ↓
analyst(사용자 영향도 분류 + 하이라이트 선정)
    ↓
writer(릴리즈 노트 2종: GitHub용 + 블로그/SNS용)
    ↓
operator(파일 저장: RELEASE_NOTES_[버전].md)
```

## 실행 방법

```bash
/skill release-notes --version v1.1.0
/skill release-notes --version v1.1.0 --format github
/skill release-notes --version v1.1.0 --format blog
/skill release-notes --compare v1.0.0..v1.1.0
```

## Operator 단계: 데이터 수집

```bash
# 태그 간 커밋
git log v1.0.0..v1.1.0 --pretty=format:"%s" --no-merges

# 변경 규모
git diff v1.0.0..v1.1.0 --shortstat

# CHANGELOG 해당 섹션
grep -A 50 "\[v1.1.0\]" CHANGELOG.md | head -60
```

## Analyst 단계: 사용자 영향도 분류

```
🚀 사용자가 바로 느끼는 변화 (feat, UX 개선)
🔧 안정성/성능 개선 (fix, perf)
⚙️ 개발자 영향 (CI, 테스트, API 변경)
⛔ 업그레이드 주의사항 (breaking change, migration 필요)
```

하이라이트 선정 기준:
- 사용자 가시적 기능 → 반드시 포함
- 주요 버그 수정 → 반드시 포함
- 내부 리팩터링 → 요약만 (상세 CHANGELOG 참조 링크)

## Writer 단계: 출력 형식

### GitHub Releases 형식
```markdown
## 🎉 PIXEL OFFICE v1.1.0

> AI 에이전트 시스템 대규모 업그레이드 + 자동화 테스트 인프라 구축

### ✨ 새로운 기능
- **9 AI 에이전트 체계** — 비서·리서처·분석가·작성자·운영자·디자이너·코더·테스터·리뷰어
- **6 재사용 스킬** — 영상 에세서, 제안서, 랜딩페이지, SNS, 체인지로그, 릴리즈노트
- **GitHub Actions CI** — push 시 자동 테스트 + 타입체크

### 🐛 수정된 버그
- TypeScript strict 모드 컴파일 오류 전면 해결 (23개 → 0개)

### 📈 성능/품질
- 단위 테스트 38개 (100% pass) — EventBus·TaskService·Tilemap·Pathfinder 커버
- Tilemap 커버리지 66% → 85%+

### ⬆️ 업그레이드 방법
\`\`\`bash
git pull origin main
npm install
npm test  # 38 tests should pass
\`\`\`

### 📋 전체 변경사항
[CHANGELOG.md](./CHANGELOG.md) 참조

**Full diff**: v1.0.0...v1.1.0
```

### 블로그/SNS 형식
```markdown
# PIXEL OFFICE v1.1.0 출시 🚀

이번 업데이트에서 AI 에이전트 시스템을 9명 체계로 확장하고,
자동화 테스트 인프라를 처음으로 구축했습니다.

**주요 변화 3가지:**
1. 비서·리서처·분석가·작성자·운영자·디자이너·코더·테스터·리뷰어 — 9 AI 직원 체계 완성
2. GitHub Actions로 push마다 자동 테스트 실행
3. TypeScript 타입 오류 전면 수정으로 빌드 안정성 확보

자세한 내용: [GitHub Releases](링크)
```

## Operator 단계: 저장

```bash
cat > RELEASE_NOTES_v1.1.0.md << 'CONTENT'
[생성된 GitHub 형식 릴리즈 노트]
CONTENT
echo "릴리즈 노트 저장 완료: RELEASE_NOTES_v1.1.0.md"
```

## 출력물
- `RELEASE_NOTES_[버전].md`
- GitHub Releases 붙여넣기용 마크다운
- SNS 공유용 요약 (3-5줄)
