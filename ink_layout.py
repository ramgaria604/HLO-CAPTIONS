"""
ink_layout.py - place caption lines by the REAL shape of the letters (not by font size guesses).
Fixes: too much gap between lines (fonts with big hidden space) and words/lines touching or overlapping (fonts with tight space).
Needs:  pip install fonttools      Works for FFmpeg/ASS export. (Browser/Remotion uses layout.js - same algorithm.)

lines = [ {'text': 'Some homes get', 'font_file': 'fonts/Poppins-700.ttf', 'size': 62, 'track': -0.02},
          {'text': 'seen',          'font_file': 'fonts/Poppins-900.ttf', 'size': 200, 'track': -0.035} ]
res = layout_stack(lines, W=1080, H=1920, pos_x=.5, pos_y=.3, ink_gap=.03)
For every line: res[i]['baseline'] (y px), ['size'] (px, shrunk if too wide), ['width'], ['ink_top'], ['ink_bottom'], ['ass_y'] (use with \\an2\\pos(x, ass_y)).
"""
from functools import lru_cache
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont


@lru_cache(maxsize=64)
def load_font(path):
    tt = TTFont(path, lazy=True)
    return tt, tt.getGlyphSet(), tt.getBestCmap(), tt['head'].unitsPerEm, tt['OS/2'].usWinDescent


def ink_extents(font_file, text, size, track=0.0):
    """Real ink box of a text line, in px: width, ascent (above baseline), descent (below baseline)."""
    tt, gs, cmap, upem, _ = load_font(str(font_file))
    k = size / upem
    x = asc = desc = 0.0
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None:
            x += 0.5 * size
            continue
        bp = BoundsPen(gs)
        gs[g].draw(bp)
        if bp.bounds and ch != ' ':
            asc = max(asc, bp.bounds[3] * k)
            desc = max(desc, -bp.bounds[1] * k)
        x += gs[g].width * k + track * size
    return {'width': x - track * size, 'asc': asc, 'desc': desc}


def layout_stack(lines, W, H, pos_x=.5, pos_y=.5, ink_gap=.03, max_width=.9):
    """Stack lines top to bottom. ink_gap = empty space between the BOTTOM of the letters of one line and the TOP of the letters of the next,
    as a fraction of the bigger font size of the two lines (0.03 = tight, 0 = touching, negative = tucked, 0.2 = airy).
    Lines wider than max_width*W are shrunk to fit."""
    out = []
    for ln in lines:
        e = ink_extents(ln['font_file'], ln['text'], ln['size'], ln.get('track', 0))
        s = min(1.0, max_width * W / e['width']) if e['width'] else 1.0
        out.append({**ln, 'size': ln['size'] * s, 'scale': s, 'width': e['width'] * s, 'asc': e['asc'] * s, 'desc': e['desc'] * s})
    gaps = [max(-.2, ink_gap) * max(out[i - 1]['size'], out[i]['size']) for i in range(1, len(out))]
    total = sum(o['asc'] + o['desc'] for o in out) + sum(gaps)
    y = pos_y * H - total / 2
    for i, o in enumerate(out):
        if i:
            y += gaps[i - 1]
        o['ink_top'] = y
        o['baseline'] = y + o['asc']
        o['ink_bottom'] = o['baseline'] + o['desc']
        y = o['ink_bottom']
        o['x'] = pos_x * W
        o['ass_y'] = o['baseline'] + load_font(str(o['font_file']))[4] / load_font(str(o['font_file']))[3] * o['size']   # libass: \an2 bottom = baseline + font descent
    return out
