@echo off
setlocal EnableExtensions EnableDelayedExpansion
title offis - PUSH FIX TO MAIN

echo ====================================================
echo  offis - PUSH FIX TO MAIN (Pathfinder bug fix)
echo ====================================================
echo Repo: %~dp0
echo.

cd /d "%~dp0"
if errorlevel 1 (
    echo [FAIL] Cannot cd to repo dir.
    pause
    exit /b 1
)

echo [1/6] Removing stale .git/index.lock if any...
if exist ".git\index.lock" (
    del /F /Q ".git\index.lock"
    if errorlevel 1 (
        echo [FAIL] Could not remove .git\index.lock. Close git/IDE and retry.
        pause
        exit /b 1
    )
    echo [OK]  Removed stale lock.
) else (
    echo [OK]  No stale lock.
)
echo.

echo [2/6] git status...
git status -s
echo.

echo [3/6] Running regression tests (npx vitest run)...
call npx vitest run
if errorlevel 1 (
    echo.
    echo [FAIL] Tests failed. Aborting push.
    pause
    exit /b 1
)
echo [OK]  All tests passed.
echo.

echo [4/6] Stage and commit Pathfinder fix...
git add src/spatial/Pathfinder.ts src/__tests__/Pathfinder.test.ts reports/branch_merge_plan.md
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "fix(pathfinder): unwalkable start cell guard + 2 regression tests" -m "" -m "- Pathfinder.findPath now relocates an unwalkable start to nearest walkable. Previously the path could begin on a wall/desk if an agent was placed inside furniture." -m "- Removed dead obstacleSet.has(goal) check that always evaluated false." -m "- Updated misleading docstring claim of binary heap." -m "- Added 2 regression tests."
    if errorlevel 1 (
        echo [FAIL] Commit failed.
        pause
        exit /b 1
    )
    echo [OK]  Committed.
) else (
    echo [SKIP] Nothing to commit.
)
echo.

echo [5/6] git pull --rebase origin main (safety)...
git pull --rebase origin main
if errorlevel 1 (
    echo.
    echo [FAIL] Rebase failed. Resolve conflicts manually then re-run.
    pause
    exit /b 1
)
echo.

echo [6/6] git push origin main...
git push origin main
if errorlevel 1 (
    echo.
    echo [FAIL] Push failed. Check auth (gh auth login) and retry.
    pause
    exit /b 1
)
echo.
echo ====================================================
echo  DONE - offis main pushed to origin
echo ====================================================
pause
exit /b 0
