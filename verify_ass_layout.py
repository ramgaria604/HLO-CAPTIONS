"""
Checks the FFmpeg/ASS export: renders a 2-line caption with the real subtitle engine and measures the letters in the picture.
Run in your captionstudio folder (needs ffmpeg + 2 fonts in fonts/, and:  pip install fonttools pillow numpy):
    python verify_ass_layout.py
PASS = the real gap between the lines is within 4 px of what the layout promised, for several font pairs and gaps.
"""
import itertools, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from fontTools.ttLib import TTFont
from ink_layout import layout_stack

fonts = sorted(Path('fonts').glob('*.ttf'))[:4]
if len(fonts) < 2:
    sys.exit('Put at least 2 .ttf fonts in the fonts/ folder first.')
tmp = Path(tempfile.mkdtemp()); fails = 0
for (f1, f2), gap in itertools.product(itertools.permutations(fonts[:3], 2), (0.0, 0.03, 0.15)):
    res = layout_stack([{'text': 'Some homes get', 'font_file': str(f1), 'size': 62, 'track': -.02}, {'text': 'seen', 'font_file': str(f2), 'size': 200, 'track': -.035}], 1080, 1920, .5, .3, gap)
    ev = ''
    for i, o in enumerate(res):
        tt = TTFont(o['font_file']); ratio = (tt['OS/2'].usWinAscent + tt['OS/2'].usWinDescent) / tt['head'].unitsPerEm
        ev += f"Dialogue: {i},0:00:00.00,0:00:02.00,Default,,0,0,0,,{{\\an2\\pos({o['x']:.1f},{o['ass_y']:.1f})\\fn{tt['name'].getDebugName(1)}\\fs{o['size'] * ratio:.1f}\\fsp{o['track'] * o['size']:.2f}\\b0\\c&HFFFFFF&}}{o['text']}\n"
    (tmp / 't.ass').write_text("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,10,10,10,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n" + ev, encoding='utf-8')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:d=1', '-vf', f"ass='{(tmp / 't.ass').as_posix().replace(':', r'\:')}':fontsdir='{Path('fonts').resolve().as_posix().replace(':', r'\:')}'", '-frames:v', '1', str(tmp / 't.png')], check=True)
    a = np.array(Image.open(tmp / 't.png').convert('L')) > 100; rows = np.where(a.any(axis=1))[0]
    bands = []; st = pr = rows[0]
    for r in rows[1:]:
        if r - pr > 1: bands.append((st, pr + 1)); st = r
        pr = r
    bands.append((st, pr + 1))
    want = res[1]['ink_top'] - res[0]['ink_bottom']; real = bands[-1][0] - bands[0][1] if len(bands) > 1 else 0   # one band = the lines touch (gap 0 asked for)
    ok = abs(real - want) <= 4; fails += (not ok)
    print(('PASS' if ok else 'FAIL'), f1.name, '+', f2.name, 'gap', gap, '-> wanted', round(want), 'px, real', real, 'px')
print('ALL PASSED' if not fails else f'{fails} FAILED')
