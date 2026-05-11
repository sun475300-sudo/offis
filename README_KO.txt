offis 레포 배치 파일 안내 (Cowork Claude 자동 생성, 2026-05-03)

[발견된 버그]
- src/spatial/Pathfinder.ts: findPath()가 시작 셀이 unwalkable일 때
  검증 없이 진행하여 벽/책상 위에서 시작하는 경로가 반환될 수 있었음.
- 추가로 dead code (obstacleSet.has(goal) 체크) 정리.

[수정 내용]
- Pathfinder에 unwalkable start 가드 추가 (nearestWalkable 재배치).
- 회귀 테스트 2건 신규: src/__tests__/Pathfinder.test.ts.
- vitest 결과: 4 files / 47 tests 통과 (이전 45 → 47).

[배치 파일]
1. PUSH_FIX_TO_MAIN.bat
   - .git/index.lock 자동 제거
   - npx vitest run 통과 시에만 main 커밋 + origin push
   - 실패 시 중단

2. MERGE_ALL_BRANCHES_TO_MAIN.bat
   - 브랜치 분류만 출력 (자동 머지 없음)
   - 자세한 내용은 reports/branch_merge_plan.md 참조

[실행 방법]
cmd 창에서:
  cd /d E:\GitHub\offis
  PUSH_FIX_TO_MAIN.bat

또는 통합 실행:
  E:\PUSH_ALL_REPOS_TO_MAIN.bat

[제약 사항]
- 모든 .bat은 영어 echo + ASCII + CRLF + pause (cp949 cmd 안전)
- main force push 금지
- .git/index.lock은 IDE/Git Desktop이 살아 있으면 다시 생김 → 닫고 재실행
