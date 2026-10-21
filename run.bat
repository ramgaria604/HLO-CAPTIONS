@echo off
title CaptionStudio Pro
cd /d "%~dp0"
set "PATH=C:\Users\NIKHIL\AppData\Local\Programs\nodejs;%PATH%"
echo Starting CaptionStudio Pro...
.venv\Scripts\python app.py
pause
