# How to Start CaptionStudio Pro (Command Prompt)

### 1-Click Fast Start:
1. Open this folder in File Explorer (`CaptionStudio_Pro\captionstudio`).
2. Double-click **`START_WEBSITE.cmd`**.
   *(Or click the address bar at the top, type `cmd`, press Enter, and type `START_WEBSITE.cmd`)*
3. A black Command Prompt window opens. Keep it open.
4. Open **http://127.0.0.1:5000** in your browser.

### Manual Start (Optional):
```cmd
.venv\Scripts\activate.bat
python app.py
```

### Remotion Studio (Optional - To tweak presets visually in Remotion Studio):
```cmd
cd remotion_pack
npx remotion studio src/index.ts
```
