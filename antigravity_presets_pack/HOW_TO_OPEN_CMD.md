# Use CMD (Command Prompt), NOT PowerShell
1. Open your project folder in File Explorer (the folder that contains `app.py`).
2. Click the address bar at the top, type `cmd` and press Enter. A black window opens already in that folder.
3. Type `START_WEBSITE.cmd` and press Enter. First time takes a few minutes.
4. Open http://127.0.0.1:5000 in Chrome. To stop: click the black window, press Ctrl+C.

Manual way (same thing):
    .venv\Scripts\activate.bat
    python app.py

Remotion test (inside antigravity_presets_pack):
    npm install
    npx remotion studio src/index.ts
