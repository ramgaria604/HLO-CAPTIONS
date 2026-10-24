"""
Preset Maker + Community gallery for CaptionStudio (Flask Blueprint).
Install: put this file next to app.py, then in app.py add:
    from preset_maker_routes import bp as preset_maker_bp
    app.register_blueprint(preset_maker_bp)
Pages:  /preset-maker      API: GET/POST /api/community , POST /api/community/<id>/like
Shared presets are strictly sanitised (colours, numbers, fonts, enums) - nothing else is ever stored or sent to browsers.
"""
import hashlib, json, re, threading, time, uuid
from pathlib import Path
from flask import Blueprint, jsonify, render_template, request

bp = Blueprint('preset_maker', __name__)
FILE = Path(__file__).resolve().parent / 'community_presets.json'
LOCK = threading.Lock()
POSTS = {}          # ip hash -> [timestamps]
MAX_ITEMS, MAX_PER_HOUR = 3000, 8

HEX = re.compile(r'^#[0-9a-fA-F]{6}$')
FONT = re.compile(r'^[A-Za-z0-9 \-]{1,40}$')
MODES = {'highlight', 'emphasis', 'single'}
LAYOUTS = {'inline', 'stack'}
ANIMS = {'pop', 'bounce', 'fade', 'rise', 'flip', 'none'}
BLENDS = {'normal', 'overlay', 'soft-light', 'hard-light', 'screen', 'multiply', 'difference', 'color-dodge'}
FILLS = {'solid', 'gradient', 'liquid', 'grunge', 'flow', 'chrome', 'holo'}


def num(v, d, lo, hi):
    try:
        v = float(v)
        return d if v != v else max(lo, min(hi, v))
    except (TypeError, ValueError):
        return d


def col(v, d):
    return v if isinstance(v, str) and HEX.match(v) else d


def clean_role(r):
    r = r if isinstance(r, dict) else {}
    f = r.get('fill') if isinstance(r.get('fill'), dict) else {}
    ftype = f.get('type') if f.get('type') in FILLS else 'solid'
    colors = [c for c in (f.get('colors') or []) if isinstance(c, str) and HEX.match(c)][:7] if isinstance(f.get('colors'), list) else []
    color = col(r.get('color'), '#ffffff')
    if ftype != 'holo' and not colors:
        colors = [color]
    weight = int(round(num(r.get('weight'), 500, 300, 900) / 100) * 100)
    font = r.get('font') if isinstance(r.get('font'), str) and FONT.match(r.get('font')) else 'Poppins'
    return {'font': font, 'size': num(r.get('size'), 70, 20, 320), 'weight': weight, 'bold': weight >= 700, 'italic': bool(r.get('italic')),
            'color': colors[0] if colors else color, 'outline': num(r.get('outline'), 0, 0, 30), 'outlineColor': col(r.get('outlineColor'), '#000000'),
            'shadow': num(r.get('shadow'), 0, 0, 30), 'shadowColor': col(r.get('shadowColor'), '#000000'), 'glow': num(r.get('glow'), 0, 0, 60),
            'glowColor': col(r.get('glowColor'), '#ffffff'), 'track': num(r.get('track'), 0, -0.1, 0.3), 'upper': bool(r.get('upper')),
            'layer': r.get('layer') if r.get('layer') in ('front', 'behind') else 'front', 'enter': r.get('enter') if r.get('enter') in ('none', 'slide-left', 'slide-right', 'slide-up', 'slide-down') else 'none', 'dx': num(r.get('dx'), 0, -50, 50), 'dy': num(r.get('dy'), 0, -50, 50),
            'rotate': num(r.get('rotate'), 0, -45, 45), 'opacity': num(r.get('opacity'), 1, 0.1, 1),
            'fill': {'type': ftype, 'colors': colors, 'angle': num(f.get('angle'), 90, 0, 360), 'hi': col(f.get('hi'), '#ffffff'),
                     'lo': col(f.get('lo'), '#000000'), 'speed': num(f.get('speed'), 1, 0, 3)}}


def clean_preset(p):
    if not isinstance(p, dict):
        raise ValueError('Bad preset')
    roles = p.get('roles') if isinstance(p.get('roles'), dict) else {}
    name = re.sub(r'[<>&"]', '', str(p.get('name') or 'Preset'))[:40].strip() or 'Preset'
    return {'id': 'c' + uuid.uuid4().hex[:8], 'name': name,
            'mode': p.get('mode') if p.get('mode') in MODES else 'highlight', 'layout': p.get('layout') if p.get('layout') in LAYOUTS else 'inline',
            'anim': p.get('anim') if p.get('anim') in ANIMS else 'pop', 'blend': p.get('blend') if p.get('blend') in BLENDS else 'normal',
            'behindRule': p.get('behindRule') if p.get('behindRule') in ('all', 'first', 'alternate') else 'all', 'overGraphics': bool(p.get('overGraphics')),
            'wordsPerPage': int(num(p.get('wordsPerPage'), 3, 1, 8)), 'uppercase': bool(p.get('uppercase')), 'removePunct': bool(p.get('removePunct')),
            'posX': num(p.get('posX'), .5, .05, .95), 'posY': num(p.get('posY'), .7, .05, .95), 'lineGap': num(p.get('lineGap'), 1.05, .6, 1.8),
            'autoMin': int(num(p.get('autoMin'), 4, 3, 9)),
            'keyRule': p.get('keyRule') if p.get('keyRule') in ('auto', 'last') else 'auto',
            'inkGap': num(p.get('inkGap'), .03, -.2, .4),
            'posCycle': [num(v, .5, .05, .95) for v in (p.get('posCycle') or [])[:4]] if isinstance(p.get('posCycle'), list) else [],
            'roles': {k: clean_role(roles.get(k)) for k in ('base', 'active', 'accent') + (('accent2',) if isinstance(roles.get('accent2'), dict) else ())}}


def load():
    try:
        return json.loads(FILE.read_text(encoding='utf-8'))
    except Exception:
        return []


def save(items):
    FILE.write_text(json.dumps(items), encoding='utf-8')


def ip_hash():
    return hashlib.sha1((request.remote_addr or 'x').encode()).hexdigest()[:12]


@bp.get('/preset-maker')
def page():
    return render_template('preset_maker.html')


@bp.get('/api/community')
def community_list():
    q = (request.args.get('q') or '').lower().strip()[:40]
    with LOCK:
        items = load()
    if q:
        items = [i for i in items if q in i['preset']['name'].lower() or q in i['author'].lower()]
    items.sort(key=(lambda i: -i['likes']) if request.args.get('sort') == 'top' else (lambda i: -i['created']))
    return jsonify(items=[{k: v for k, v in i.items() if k != 'liked_by'} for i in items[:200]])


@bp.post('/api/community')
def community_post():
    data = request.get_json(silent=True) or {}
    h, now = ip_hash(), time.time()
    POSTS[h] = [t for t in POSTS.get(h, []) if now - t < 3600]
    if len(POSTS[h]) >= MAX_PER_HOUR:
        return jsonify(error='Too many posts. Try again later.'), 429
    try:
        preset = clean_preset(data.get('preset'))
    except ValueError as e:
        return jsonify(error=str(e)), 400
    author = re.sub(r'[<>&"]', '', str(data.get('author') or 'Anonymous'))[:30].strip() or 'Anonymous'
    item = {'id': preset['id'], 'author': author, 'created': now, 'likes': 0, 'liked_by': [], 'preset': preset}
    with LOCK:
        items = load()
        items.append(item)
        save(items[-MAX_ITEMS:])
    POSTS[h].append(now)
    return jsonify(ok=True, id=item['id'])


@bp.post('/api/community/<pid>/like')
def community_like(pid):
    h = ip_hash()
    with LOCK:
        items = load()
        for i in items:
            if i['id'] == pid:
                if h not in i['liked_by']:
                    i['liked_by'].append(h)
                    i['likes'] += 1
                save(items)
                return jsonify(likes=i['likes'])
    return jsonify(error='Not found'), 404
