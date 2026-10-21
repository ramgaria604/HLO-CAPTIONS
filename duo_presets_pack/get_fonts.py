"""
Downloads every Google Font used by the Duo presets into the website's fonts/ folder (needed for the FFmpeg/ASS export; the preview and Remotion export load fonts online).
Run in CMD from your captionstudio folder:    python get_fonts.py
Needs internet. Already-downloaded fonts are skipped. (Not tested in the sandbox where this pack was made - if one font fails it tells you which.)
"""
import json, re, sys, urllib.parse, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
JSON = next((p for p in [HERE / 'static/duo_presets/duo_presets.json', HERE / 'duo_presets.json'] if p.exists()), None)
OUT = Path('fonts'); OUT.mkdir(exist_ok=True)
if not JSON: sys.exit('duo_presets.json not found')
presets = json.loads(JSON.read_text(encoding='utf-8'))
need = {}   # family -> set of (weight, italic)
for p in presets:
    for r in p['roles'].values():
        need.setdefault(r['font'], set()).add((int(r['weight']), bool(r['italic'])))
UA = 'Mozilla/5.0 (Windows NT 6.1; rv:30.0) Gecko/20100101 Firefox/30.0'   # old browser => Google returns .ttf files
for fam, wl in sorted(need.items()):
    for weight, ital in sorted(wl):
        name = f"{fam.replace(' ', '')}-{weight}{'-italic' if ital else ''}.ttf"
        dest = OUT / name
        if dest.exists(): continue
        for w, it in ((weight, ital), (400, ital), (400, False)):   # fall back if that exact weight does not exist
            spec = f"{fam.replace(' ', '+')}:{'ital,' if it else ''}wght@{'1,' if it else ''}{w}" if True else ''
            url = 'https://fonts.googleapis.com/css2?family=' + spec
            try:
                css = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read().decode()
                m = re.search(r'url\((https://[^)]+\.ttf)\)', css)
                if not m: continue
                dest.write_bytes(urllib.request.urlopen(m.group(1), timeout=60).read())
                print('OK  ', name); break
            except Exception as e:
                last = e
        else:
            print('FAIL', name)
print('Done. Fonts are in', OUT.resolve())
