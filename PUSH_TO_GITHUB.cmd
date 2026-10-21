@echo off
setlocal
set "PATH=%LOCALAPPDATA%\MinGit\cmd;%PATH%"
cd /d "%~dp0"
echo ===================================================
echo     HLO CAPTIONS - AUTO PUSH TO GITHUB
echo ===================================================
git add .
set /p msg="Enter update message (or press Enter for Auto-Update): "
if "%msg%"=="" set msg=Update website
git commit -m "%msg%"
git push origin main
echo ===================================================
echo Done! If you pushed changes, Render will auto-update in ~30s.
pause
