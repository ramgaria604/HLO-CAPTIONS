@echo off
REM Double-click this file (or run it from Command Prompt / cmd). NOT PowerShell.
REM 1) Put this file inside your captionstudio folder (the one that has app.py), or edit the next line.
cd /d "%~dp0"
if not exist .venv (
  echo Creating Python environment first time...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -r requirements.txt
if exist antigravity_presets_pack\package.json (
  if not exist antigravity_presets_pack\node_modules (
    echo Installing Remotion first time...
    pushd antigravity_presets_pack
    call npm install
    popd
  )
)
echo.
echo Open  http://127.0.0.1:5000  in your browser. Keep this black window open.
python app.py
pause
