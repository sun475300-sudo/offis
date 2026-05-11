# offis branch merge plan (2026-05-03)

## main 기준 ahead/behind
- local main vs origin/main: 0/0 (sync 상태에서 시작)
- 이번 작업 후 main이 origin/main보다 1 commit ahead 예정 (Pathfinder fix)

## 분류

### 1) Merged into local main (정리 가능)
- `wip/crlf-backup-20260419` — 이미 main에 머지됨, 안전하게 삭제 가능

### 2) Local main에 없는 origin 브랜치 (검토 필요)
- `origin/claude/code-review-bug-fixes-BrPXu`
- `origin/claude/install-codex-plugin-nrEDv`
- `origin/dependabot/npm_and_yarn/npm_and_yarn-12b7e8a87d`

위 3개는 자동 fast-forward 머지가 안전하지 않을 수 있어 (claude PR + dependabot)
**사용자 검토 후 GitHub에서 PR로 머지**하는 것을 권장. .bat 자동 머지 대상 아님.

## 자동 머지 대상 (fast-forward, no conflict)
없음 — 안전한 자동 머지 대상이 없으므로 MERGE_ALL_BRANCHES_TO_MAIN.bat 은
이 레포에서는 분류만 출력하고 실제 머지는 수행하지 않습니다.
