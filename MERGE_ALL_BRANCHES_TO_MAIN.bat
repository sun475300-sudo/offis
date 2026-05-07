@echo off
setlocal EnableExtensions EnableDelayedExpansion
title offis - MERGE ALL BRANCHES TO MAIN (analysis only)

echo ====================================================
echo  offis - MERGE ALL BRANCHES TO MAIN (analysis)
echo ====================================================
echo Repo: %~dp0
echo.

cd /d "%~dp0"
if errorlevel 1 (
    echo [FAIL] Cannot cd to repo dir.
    pause
    exit /b 1
)

if exist ".git\index.lock" (
    del /F /Q ".git\index.lock"
)

echo [1/4] Fetch origin...
git fetch --prune origin
echo.

echo [2/4] Local branches MERGED into main (safe to delete):
git branch --merged main
echo.

echo [3/4] Local branches NOT MERGED into main:
git branch --no-merged main
echo.

echo [4/4] Remote branches NOT merged into origin/main:
git branch -r --no-merged origin/main
echo.

echo ----------------------------------------------------
echo  See reports\branch_merge_plan.md for detailed plan.
echo  This script does NOT auto-merge for offis because
echo  the only candidate (wip/crlf-backup) is already
echo  merged. Open remaining branches as PRs on GitHub.
echo ----------------------------------------------------
pause
exit /b 0
