@echo off
REM Double-click this file or run from cmd.exe
cd /d "%~dp0"
echo ========================================================
echo        Starting CaptionStudio Pro (Antigravity Engine)
echo ========================================================
echo.

if not exist .venv (
  echo Creating Python virtual environment...
  python -m venv .venv
)

call .venv\Scripts\activate.bat
echo Installing Python dependencies...
pip install -r requirements.txt

if exist remotion_pack\package.json (
  if not exist remotion_pack\node_modules (
    echo Installing Remotion npm packages...
    pushd remotion_pack
    call npm install
    popd
  )
)

echo.
echo ========================================================
echo  Website ready!
echo  Open http://localhost:5000 in your browser.
echo  Keep this Command Prompt window open while working.
echo ========================================================
echo.
python app.py
pause
