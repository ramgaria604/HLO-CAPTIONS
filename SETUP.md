# CaptionStudio Pro: setup (Windows)

1. Delete your old `C:\CaptionStudio` folder contents (keep `.venv` if you have it) and copy everything from this zip into it.
2. Open PowerShell in that folder and run:
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
3. Fonts (for the reference caption looks), run once:
   .\.venv\Scripts\python.exe get_fonts.py
4. B-roll (optional): get a free key at https://www.pexels.com/api/ . Paste it in the app: B-roll tab.
5. Start:
   .\.venv\Scripts\python.exe app.py
   Open http://127.0.0.1:5000

Use: 1 Video > Generate captions > 3 Style > 4 Auto-cut > 5 B-roll > 6 Export.
Test with a 15-30 second video first. Delete the `work` folder now and then.
