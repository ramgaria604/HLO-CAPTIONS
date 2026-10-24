/* CaptionStudio Preset Maker - live editor, share codes, import/export, community gallery. No build step. */
import {fxBackground} from './fx.js';
import {LIBRARY, PALETTES, PAIRS} from './library.js';
const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ---------------------------------------------------------------- schema + safety */
const MODES = ['highlight','emphasis','single'], LAYOUTS = ['inline','stack'], ANIMS = ['pop','bounce','fade','rise','flip','none'];
const BLENDS = ['normal','overlay','soft-light','hard-light','screen','multiply','difference','color-dodge'];
const FILLS = ['solid','gradient','liquid','grunge','flow','chrome','holo'];
const HEX = /^#[0-9a-fA-F]{6}$/, FONT = /^[A-Za-z0-9 \-]{1,40}$/;
const num = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
const col = (v, d) => (typeof v === 'string' && HEX.test(v) ? v : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
function cleanRole(r = {}) {
  const f = r.fill || {}; const type = oneOf(f.type, FILLS, 'solid');
  let colors = Array.isArray(f.colors) ? f.colors.map((c) => col(c, null)).filter(Boolean).slice(0, 7) : [];
  const color = col(r.color, '#ffffff'); if (type !== 'holo' && !colors.length) colors = [color];
  const weight = Math.round(num(r.weight, r.bold ? 800 : 500, 300, 900) / 100) * 100;
  return {font: FONT.test(r.font || '') ? r.font : 'Poppins', size: num(r.size, 70, 20, 320), weight, bold: weight >= 700, italic: !!r.italic, color: colors[0] || color,
    outline: num(r.outline, 0, 0, 30), outlineColor: col(r.outlineColor, '#000000'), shadow: num(r.shadow, 0, 0, 30), shadowColor: col(r.shadowColor, '#000000'),
    glow: num(r.glow, 0, 0, 60), glowColor: col(r.glowColor, '#ffffff'), track: num(r.track, 0, -0.1, 0.3), upper: !!r.upper,
    layer: oneOf(r.layer, ['front', 'behind'], 'front'), enter: oneOf(r.enter, ['none', 'slide-left', 'slide-right', 'slide-up', 'slide-down'], 'none'), dx: num(r.dx, 0, -50, 50), dy: num(r.dy, 0, -50, 50), rotate: num(r.rotate, 0, -45, 45), opacity: num(r.opacity, 1, 0.1, 1),
    fill: {type, colors, angle: num(f.angle, 90, 0, 360), hi: col(f.hi, '#ffffff'), lo: col(f.lo, '#000000'), speed: num(f.speed, 1, 0, 3)}};
}
export function sanitize(p = {}) {
  const roles = p.roles || {};
  return {id: 'u' + Date.now().toString(36), name: String(p.name || 'My preset').replace(/[<>&"]/g, '').slice(0, 40) || 'My preset',
    mode: oneOf(p.mode, MODES, 'highlight'), layout: oneOf(p.layout, LAYOUTS, 'inline'), anim: oneOf(p.anim, ANIMS, 'pop'), blend: oneOf(p.blend, BLENDS, 'normal'),
    behindRule: oneOf(p.behindRule, ['all', 'first', 'alternate'], 'all'), overGraphics: !!p.overGraphics,
    wordsPerPage: Math.round(num(p.wordsPerPage, 3, 1, 8)), uppercase: !!p.uppercase, removePunct: !!p.removePunct,
    posX: num(p.posX, .5, .05, .95), posY: num(p.posY, .7, .05, .95), lineGap: num(p.lineGap, 1.05, .6, 1.8), autoMin: Math.round(num(p.autoMin, 4, 3, 9)),
    keyRule: oneOf(p.keyRule, ['auto', 'last'], 'auto'),
    inkGap: num(p.inkGap, .03, -.2, .4),
    posCycle: Array.isArray(p.posCycle) ? p.posCycle.slice(0, 4).map((v) => num(v, .5, .05, .95)) : [],
    roles: {base: cleanRole(roles.base), active: cleanRole(roles.active), accent: cleanRole(roles.accent), ...(roles.accent2 ? {accent2: cleanRole(roles.accent2)} : {})}};
}

/* ---------------------------------------------------------------- state */
let P = sanitize(LIBRARY[0]); P.name = 'My preset';
let roleTab = 'accent', frame = 0, demoIdx = 0, pageNo = 0, installed = [], loadedFonts = new Set();
const SAMPLE = {text: 'this is truly a gorgeous home'};
const STOP = new Set('a an and are as at be but by for from had has have he her his i if in is it its me my no not of on or our she so that the their them they this to us was we were what when who will with you your just very can'.split(' '));
const GFONTS = ['Poppins','Montserrat','Inter','Anton','Bebas Neue','Bungee','Permanent Marker','Caveat','Great Vibes','Playfair Display','Lobster','Pacifico','Oswald','Archivo Black','Righteous','Rubik','Bangers','Luckiest Guy','Press Start 2P','Space Mono','Abril Fatface','Monoton','Special Elite','Dancing Script','Satisfy','Sacramento','Allura','Pinyon Script','Cinzel','Raleway','Lato','Nunito','Outfit','Syne','Bowlby One','Shrikhand','Fredoka','Staatliches','Teko','Kanit','Russo One','Black Ops One','Rock Salt','Yellowtail','DM Serif Display','Cormorant Garamond'];
function loadGoogleFont(name) {
  if (loadedFonts.has(name) || installed.includes(name) || !GFONTS.includes(name)) return; loadedFonts.add(name);
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:ital,wght@0,300;0,400;0,500;0,700;0,800;0,900;1,300;1,400;1,700&display=swap`; document.head.appendChild(l);
}
async function loadInstalledFonts() {
  try { const f = (await (await fetch('/api/fonts')).json()).fonts || [];
    for (const x of f) { installed.push(x.family); const ff = new FontFace(x.family, `url(/fonts/${encodeURIComponent(x.file)})`, {weight: x.bold ? '700' : '400', style: x.italic ? 'italic' : 'normal'}); ff.load().then((y) => document.fonts.add(y)).catch(() => {}); }
    installed = [...new Set(installed)]; } catch (e) {}
}

/* ---------------------------------------------------------------- rendering */
const isK = (w) => (w.key !== undefined ? w.key : autoEmph(w.t));
const autoEmph = (t) => { const w = t.replace(/[^\p{L}']/gu, '').toLowerCase(); return w.length >= P.autoMin && !STOP.has(w); };
function fxOf(r) { const f = r.fill; if (!f || ['solid', 'gradient'].includes(f.type)) return null; return {kind: f.type, stops: f.colors.length ? f.colors : [r.color], hi: f.hi, lo: f.lo, speed: f.speed}; }
export function roleCss(r, sc, fr = 30) {
  const c = {fontFamily: `"${r.font}", sans-serif`, fontSize: r.size * sc + 'px', fontWeight: r.weight, fontStyle: r.italic ? 'italic' : 'normal', letterSpacing: r.track + 'em', lineHeight: '1', display: 'inline-block', whiteSpace: 'pre'};
  const f = r.fill, fx = fxOf(r);
  if (fx) { let s = fx.stops.slice(); if (fx.kind === 'chrome') while (s.length < 4) s.push(s[s.length - 1]); Object.assign(c, fxBackground({...fx, stops: s}, fr)); }
  else if (f && f.type === 'gradient' && f.colors.length > 1) Object.assign(c, {backgroundImage: `linear-gradient(${f.angle}deg,${f.colors.join(',')})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent'});
  else c.color = r.color;
  const sh = []; if (r.glow > 0) sh.push(`drop-shadow(0 0 ${r.glow * sc * .8}px ${r.glowColor})`, `drop-shadow(0 0 ${r.glow * sc * 1.8}px ${r.glowColor})`);
  if (r.shadow > 0) sh.push(`drop-shadow(0 ${r.shadow * sc}px 0 ${r.shadowColor})`);
  if (r.outline > 0) { const o = r.outline * sc; for (const [x, y] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) sh.push(`drop-shadow(${x * o}px ${y * o}px 0 ${r.outlineColor})`); }
  if (sh.length) c.filter = sh.join(' ');
  return c;
}
const words = () => SAMPLE.text.trim().split(/\s+/).filter(Boolean).map((t) => ({t}));
const mctx = document.createElement('canvas').getContext('2d');
const measure = (txt, r) => { mctx.font = `${r.italic ? 'italic ' : ''}${r.weight} ${r.size}px "${r.font}"`; return mctx.measureText(txt).width + r.track * r.size * txt.length; };
function fits(ws) {   // every line of the caption must fit in 90% of the frame width (frame = 1080 units wide)
  ws.forEach((w, i) => { w.key = P.keyRule === 'last' ? i === ws.length - 1 : autoEmph(w.t); });
  return lineGroups(ws).every((idxs) => idxs.reduce((a, j) => { const w = ws[j], r1 = roleFor(w, false), r2 = roleFor(w, true); return a + Math.max(measure(disp(w, r1) + ' ', r1), measure(disp(w, r2) + ' ', r2)); }, 0) <= 1080 * 0.9);
}
function pages() {
  const w = words(), n = P.mode === 'single' ? 1 : P.wordsPerPage, out = []; let cur = [];
  for (const x of w) { if (cur.length && (cur.length >= n || !fits([...cur, x]))) { out.push(cur); cur = []; } cur.push(x); }
  if (cur.length) out.push(cur);
  out.forEach((pg) => pg.forEach((w, i) => { w.key = P.keyRule === 'last' ? i === pg.length - 1 : autoEmph(w.t); })); return out;
}
function lineGroups(ws) {
  if (P.mode === 'single') return ws.map((_, i) => [i]);
  if (P.mode === 'emphasis' && P.layout === 'stack') { const g = []; ws.forEach((w, i) => { const e = isK(w); if (g.length && isK(ws[g[g.length - 1].slice(-1)[0]]) === e) g[g.length - 1].push(i); else g.push([i]); }); return g; }
  return [ws.map((_, i) => i)];
}
const roleFor = (w, active) => P.mode === 'emphasis' ? P.roles[isK(w) ? (P.roles.accent2 && pageNo % 2 ? 'accent2' : 'accent') : 'base'] : P.mode === 'highlight' ? P.roles[active ? 'active' : 'base'] : P.roles.active;
const disp = (w, r) => { let t = w.t; if (P.removePunct) t = t.replace(/[.,!?;:"“”]/g, ''); return (P.uppercase || r.upper) ? t.toUpperCase() : t; };
let stage, layer, layerB, bgVideo;
function layerOf(pg, j) {   // which layer a word lives in: 'behind' (behind the person) or 'front'
  const r = roleFor(pg[j], false); if (r.layer !== 'behind') return 'front';
  const cands = pg.map((_, i) => i).filter((i) => roleFor(pg[i], false).layer === 'behind'), k = cands.indexOf(j);
  if (P.behindRule === 'first') return k === 0 ? 'behind' : 'front'; if (P.behindRule === 'alternate') return k % 2 === 0 ? 'behind' : 'front'; return 'behind';
}
function build(structural = true) {
  const sc = Math.min(stage.clientWidth, stage.clientHeight) / 1080, pg = pages()[pageNo % pages().length] || [], idx = Math.min(demoIdx, pg.length - 1);
  if (structural) {
    layer.innerHTML = ''; layerB.innerHTML = '';
    for (const which of ['behind', 'front']) {
      const blk = document.createElement('div'); blk.className = 'cap-block'; blk.style.left = P.posX * 100 + '%'; blk.style.top = (P.posCycle && P.posCycle.length ? P.posCycle[pageNo % P.posCycle.length] : P.posY) * 100 + '%'; blk.style.mixBlendMode = P.blend;
      lineGroups(pg).forEach((idxs) => {
        const line = document.createElement('div'); line.className = 'cap-line'; let mx = 0;
        idxs.forEach((j) => { const r = P.mode === 'highlight' ? P.roles.base : roleFor(pg[j], false); mx = Math.max(mx, r.size, P.mode === 'highlight' ? P.roles.active.size : 0); });
        line.style.height = line.style.lineHeight = mx * sc * P.lineGap + 'px';
        if (P.mode === 'emphasis' && Math.min(...idxs) > idx) line.style.visibility = 'hidden';
        idxs.forEach((j, k) => {
          const sp = document.createElement('span'); sp.dataset.j = j; sp.textContent = disp(pg[j], roleFor(pg[j], j === idx)) + (k < idxs.length - 1 ? ' ' : '');
          const mine = layerOf(pg, j) === which; if ((P.mode === 'emphasis' && j > idx) || !mine) sp.style.visibility = 'hidden';
          if (j === idx && mine) { const en = roleFor(pg[j], true).enter; if (en && en !== 'none') sp.classList.add('e-' + en); else if (P.anim !== 'none') sp.classList.add('a-' + P.anim); } line.appendChild(sp);
        }); blk.appendChild(line);
      }); (which === 'behind' ? layerB : layer).appendChild(blk);
    }
  }
  document.querySelectorAll('.cap-layer span[data-j]').forEach((sp) => {
    const j = +sp.dataset.j, r = roleFor(pg[j], j === idx), st = roleCss(r, sc, frame); for (const k in st) sp.style[k] = st[k];
    sp.style.translate = `${r.dx * stage.clientWidth / 100}px ${r.dy * stage.clientHeight / 100}px`; sp.style.rotate = r.rotate + 'deg'; sp.style.opacity = r.opacity;
  });
}
const animated = () => Object.values(P.roles).some((r) => r.fill && ['liquid', 'grunge', 'flow', 'holo', 'chrome'].includes(r.fill.type));
function tick() {
  frame++; const pg = pages()[pageNo % pages().length] || [];
  if (frame % 18 === 0) { demoIdx++; if (demoIdx >= pg.length + 1) { demoIdx = 0; pageNo++; } build(true); } else if (animated() && frame % 2 === 0) build(false);
  requestAnimationFrame(tick);
}
const redraw = () => { clearTimeout(redraw.t); redraw.t = setTimeout(() => build(true), 10); };

/* ---------------------------------------------------------------- controls */
const getp = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setp(o, p, v) { const k = p.split('.'); const last = k.pop(); const t = k.reduce((a, x) => a[x], o); t[last] = v; }
const rolesFor = () => P.mode === 'highlight' ? ['base', 'active'] : P.mode === 'emphasis' ? (P.roles.accent2 ? ['base', 'accent', 'accent2'] : ['base', 'accent']) : ['active'];
const ROLE_NAME = {base: 'Normal words', active: 'Spoken word', accent: 'Big key words', accent2: 'Big words (2nd caption)'};
const rng = (l, p, mn, mx, st = 1) => `<label>${l} <output>${getp(P, p)}</output><input type="range" data-b="${p}" min="${mn}" max="${mx}" step="${st}" value="${getp(P, p)}"></label>`;
const clr = (l, p) => `<label>${l}<input type="color" data-b="${p}" value="${getp(P, p)}"></label>`;
const sel = (l, p, opts) => `<label>${l}<select data-b="${p}">${opts.map((o) => `<option ${getp(P, p) === o[0] ? 'selected' : ''} value="${o[0]}">${o[1]}</option>`).join('')}</select></label>`;
const chk = (l, p) => `<label class="chk"><input type="checkbox" data-b="${p}" ${getp(P, p) ? 'checked' : ''}> ${l}</label>`;
function fontSel(p) {
  const cur = getp(P, p), g = GFONTS.filter((f) => !installed.includes(f));
  return `<label>Font<select data-b="${p}" data-font="1">${installed.length ? `<optgroup label="Installed (works in export)">${installed.map((f) => `<option ${f === cur ? 'selected' : ''}>${esc(f)}</option>`).join('')}</optgroup>` : ''}<optgroup label="Google Fonts (preview online)">${g.map((f) => `<option ${f === cur ? 'selected' : ''}>${f}</option>`).join('')}</optgroup></select></label>`;
}
function layerMap() {
  const rl = rolesFor(), inL = (l) => rl.filter((k) => P.roles[k].layer === l).map((k) => `<i class="chip r-${k}">${ROLE_NAME[k]}</i>`).join('') || '<em>nothing</em>';
  const rows = P.overGraphics ? [['Front text', inL('front'), 'f'], ['Motion graphics / B-roll', 'drawn by the Graphics tab', 'g'], ['Person (cut-out)', 'the speaker', 'p'], ['Behind text', inL('behind') + (P.behindRule !== 'all' ? ` <small>(${P.behindRule})</small>` : ''), 'b'], ['Your video', '', 'v']]
    : [['Motion graphics / B-roll', 'drawn by the Graphics tab', 'g'], ['Front text', inL('front'), 'f'], ['Person (cut-out)', 'the speaker', 'p'], ['Behind text', inL('behind') + (P.behindRule !== 'all' ? ` <small>(${P.behindRule})</small>` : ''), 'b'], ['Your video', '', 'v']];
  return `<div class="lmap">${rows.map((r) => `<div class="ly ly-${r[2]}"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}<small class="muted">Top = drawn last (on top). “Behind text” is hidden wherever the person is.</small></div>`;
}
function buildDesign() {
  const rp = `roles.${roleTab}`, r = P.roles[roleTab], f = r.fill, needs = f.type !== 'solid';
  const colorsHtml = f.type === 'solid' ? clr('Colour', `${rp}.color`) : `<div class="stops">${f.colors.map((c, i) => `<span class="stop"><input type="color" data-stop="${i}" value="${c}">${f.colors.length > 1 ? `<b data-rm="${i}">×</b>` : ''}</span>`).join('')}${f.colors.length < 7 ? '<button class="btn tiny" id="addStop">+ colour</button>' : ''}</div>`;
  $('designPane').innerHTML = `
  <h3>Layout & motion</h3>
  <div class="two">${sel('Mode', 'mode', [['highlight', 'Highlight spoken word'], ['emphasis', 'Big key words'], ['single', 'One word at a time']])}${sel('Animation', 'anim', ANIMS.map((a) => [a, a]))}</div>
  <div class="two">${sel('Layout', 'layout', [['inline', 'One line'], ['stack', 'Stacked lines']])}${sel('Blend with video', 'blend', BLENDS.map((a) => [a, a]))}</div>
  ${rng('Words per line', 'wordsPerPage', 1, 8)}${rng('Vertical position', 'posY', .05, .95, .01)}
  <label class="chk"><input type="checkbox" id="altPos" ${P.posCycle && P.posCycle.length ? 'checked' : ''}> Alternate height each caption (1st high, 2nd lower…)</label>${P.posCycle && P.posCycle.length ? P.posCycle.map((v, i) => rng('Caption ' + (i + 1) + ' height', 'posCycle.' + i, .05, .95, .01)).join('') : ''}${rng('Horizontal position', 'posX', .05, .95, .01)}${rng('Line spacing', 'lineGap', .6, 1.8, .01)}${rng('Gap between lines (real letters)', 'inkGap', -.2, .4, .005)}${sel('Which words are big', 'keyRule', [['auto', 'Auto (long, important words)'], ['last', 'The last word of every caption']])}${rng('Auto big-word min letters', 'autoMin', 3, 9)}
  <div class="two">${chk('UPPERCASE', 'uppercase')}${chk('Remove punctuation', 'removePunct')}</div>
  <h3>Layers (what is in front / behind)</h3>${layerMap()}
  ${sel('If several words are behind', 'behindRule', [['all', 'All of them behind'], ['first', 'Only the first one behind'], ['alternate', 'Alternate: behind, front, behind…']])}${chk('Captions above motion graphics', 'overGraphics')}
  <h3>Text style</h3>
  <div class="seg">${rolesFor().map((k) => `<button data-role="${k}" class="${k === roleTab ? 'on' : ''}">${ROLE_NAME[k]}</button>`).join('')}</div>
  ${fontSel(`${rp}.font`)}
  <div class="two">${rng('Size', `${rp}.size`, 20, 320)}${rng('Weight', `${rp}.weight`, 300, 900, 100)}</div>
  <div class="two">${chk('Italic', `${rp}.italic`)}${chk('UPPER (this role)', `${rp}.upper`)}</div>${rng('Letter spacing', `${rp}.track`, -.1, .3, .005)}
  <h4>Fill</h4>${sel('Fill type', `${rp}.fill.type`, [['solid', 'Solid colour'], ['gradient', 'Gradient'], ['liquid', 'Liquid texture'], ['grunge', 'Grunge texture'], ['flow', 'Moving colour flow'], ['chrome', 'Chrome / metal'], ['holo', 'Holographic']])}
  ${colorsHtml}${f.type === 'gradient' ? rng('Gradient angle', `${rp}.fill.angle`, 0, 360) : ''}
  ${needs && f.type !== 'gradient' ? `<div class="two">${clr('Light streak colour', `${rp}.fill.hi`)}${f.type === 'liquid' || f.type === 'grunge' ? clr('Dark patch colour', `${rp}.fill.lo`) : '<span></span>'}</div>${rng('Texture speed', `${rp}.fill.speed`, 0, 3, .1)}` : ''}
  <h4>Entrance (this text style)</h4>
  ${sel('How it comes in', `${rp}.enter`, [['none', 'Use the preset animation'], ['slide-left', 'Slide in from the left'], ['slide-right', 'Slide in from the right'], ['slide-up', 'Slide up from below'], ['slide-down', 'Slide down from above']])}
  <h4>Layer & position (this text style)</h4>
  ${sel('Layer', `${rp}.layer`, [['front', 'In front of the person'], ['behind', 'Behind the person (head/body hides it)']])}
  <div class="two">${rng('Move left / right %', `${rp}.dx`, -50, 50, .5)}${rng('Move up / down %', `${rp}.dy`, -50, 50, .5)}</div><div class="two">${rng('Tilt °', `${rp}.rotate`, -45, 45)}${rng('Opacity', `${rp}.opacity`, .1, 1, .05)}</div>
  <h4>Edges & glow</h4><div class="two">${rng('Outline', `${rp}.outline`, 0, 30)}${clr('Outline colour', `${rp}.outlineColor`)}</div>
  <div class="two">${rng('Shadow depth', `${rp}.shadow`, 0, 30)}${clr('Shadow colour', `${rp}.shadowColor`)}</div><div class="two">${rng('Glow', `${rp}.glow`, 0, 60)}${clr('Glow colour', `${rp}.glowColor`)}</div>`;
  const pane = $('designPane');
  pane.querySelectorAll('[data-b]').forEach((el) => {
    const run = () => { let v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value; const p = el.dataset.b; setp(P, p, v);
      if (el.type === 'range') el.parentElement.querySelector('output').textContent = v; if (p.endsWith('.weight')) P.roles[roleTab].bold = v >= 700;
      if (p.endsWith('.color') || p.endsWith('fill.type')) { const rr = P.roles[roleTab]; if (rr.fill.type === 'solid') rr.fill.colors = [rr.color]; else if (!rr.fill.colors.length && rr.fill.type !== 'holo') rr.fill.colors = [rr.color, '#ffffff']; }
      if (el.dataset.font) loadGoogleFont(v); redraw(); if (['mode', 'fill.type', 'layer', 'behindRule', 'overGraphics', 'keyRule'].some((s) => p === s || p.endsWith(s))) buildDesign(); };
    el.addEventListener('input', run); if (el.tagName === 'SELECT') el.addEventListener('change', run);
  });
  const ap = $('altPos'); if (ap) ap.onchange = () => { P.posCycle = ap.checked ? [P.posY, Math.min(.95, P.posY + .34)] : []; buildDesign(); redraw(); };
  pane.querySelectorAll('[data-role]').forEach((b) => b.onclick = () => { roleTab = b.dataset.role; buildDesign(); });
  pane.querySelectorAll('[data-stop]').forEach((el) => el.addEventListener('input', () => { r.fill.colors[+el.dataset.stop] = el.value; r.color = r.fill.colors[0]; redraw(); }));
  pane.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { r.fill.colors.splice(+b.dataset.rm, 1); r.color = r.fill.colors[0]; buildDesign(); redraw(); });
  const add = $('addStop'); if (add) add.onclick = () => { r.fill.colors.push(r.fill.colors[r.fill.colors.length - 1] || '#ffffff'); buildDesign(); redraw(); };
}
function refresh() { if (!rolesFor().includes(roleTab)) roleTab = rolesFor().slice(-1)[0]; $('pname').value = P.name; buildDesign(); loadGoogleFont(P.roles.accent.font); loadGoogleFont(P.roles.base.font); loadGoogleFont(P.roles.active.font); demoIdx = 0; pageNo = 0; build(true); }
function setPreset(p, keepName) { const n = P.name; P = sanitize(p); if (keepName) P.name = n; refresh(); }
$('pname').oninput = () => { P.name = $('pname').value.slice(0, 40); };

/* ---------------------------------------------------------------- randomize / remix */
function randomize() {
  const [bigF, smallF] = pick(PAIRS), pal = pick(PALETTES), mode = pick(['highlight', 'emphasis', 'emphasis', 'single']), type = pick(['gradient', 'liquid', 'grunge', 'flow', 'chrome', 'holo', 'solid']);
  const big = {font: bigF, size: mode === 'emphasis' ? 130 + Math.random() * 60 : 70 + Math.random() * 40, weight: pick([700, 800, 900]), italic: Math.random() < .12, color: pal[0], outline: Math.random() < .3 ? 6 + Math.random() * 6 : 0, outlineColor: '#000000',
    shadow: Math.random() < .6 ? 3 + Math.random() * 6 : 0, shadowColor: '#000000', glow: Math.random() < .4 ? 8 + Math.random() * 14 : 0, glowColor: pal[pal.length - 1], track: -0.03 + Math.random() * .04, upper: Math.random() < .3,
    fill: {type, colors: type === 'holo' ? [] : pal.slice(), angle: pick([90, 100, 120, 180]), hi: '#ffffff', lo: '#000000', speed: 1}};
  if (type === 'liquid' || type === 'grunge') { big.fill.lo = '#000000'; big.fill.colors = pal.length < 3 ? [...pal, ...pal] : pal; }
  const small = {...big, font: smallF, size: mode === 'emphasis' ? 52 + Math.random() * 20 : big.size, weight: pick([300, 500, 600]), color: '#ffffff', fill: {type: 'solid', colors: ['#ffffff'], angle: 90, hi: '#fff', lo: '#000', speed: 1}, outline: 0, shadow: 2, glow: 0, upper: false, italic: Math.random() < .4};
  const q = {name: 'Surprise ' + Math.floor(Math.random() * 900 + 100), mode, layout: mode === 'emphasis' ? 'stack' : 'inline', anim: pick(['pop', 'bounce', 'rise', 'flip', 'fade']), blend: Math.random() < .15 ? pick(['overlay', 'soft-light', 'screen']) : 'normal', wordsPerPage: mode === 'single' ? 1 : pick([2, 3, 3, 4]), uppercase: Math.random() < .25, removePunct: true, posX: .5, posY: pick([.5, .6, .7, .78]), lineGap: .98, autoMin: 4,
    roles: {base: mode === 'highlight' ? {...big, fill: {...big.fill}} : small, active: mode === 'highlight' ? {...big, color: pick(['#FFE600', '#27FF8A', '#FF5E9C', '#00E0FF']), fill: {type: 'solid', colors: ['#FFE600'], angle: 90, hi: '#fff', lo: '#000', speed: 1}} : big, accent: big}};
  if (mode === 'highlight') { q.roles.active.fill.colors = [q.roles.active.color]; }
  setPreset(q);
}
function remix() { const q = clone(P); const m = (r) => { r.size = clamp(r.size * (0.9 + Math.random() * .2), 20, 320); if (Math.random() < .5) { const pal = pick(PALETTES); if (r.fill.type !== 'solid') r.fill.colors = pal.slice(); r.color = pal[0]; r.glowColor = pal[pal.length - 1]; } r.fill.angle = pick([90, 100, 120, 180]); }; Object.values(q.roles).forEach(m); q.anim = pick(ANIMS); q.name = P.name; setPreset(q, true); }
$('btnRandom').onclick = randomize; $('btnRemix').onclick = remix;

/* ---------------------------------------------------------------- save / share */
const myList = () => { try { return JSON.parse(localStorage.getItem('cs_presets') || '[]'); } catch (e) { return []; } };
function renderMine() {
  const box = $('mine'); box.innerHTML = ''; const l = myList(); if (!l.length) box.innerHTML = '<p class="muted">Nothing saved yet. Design something and press “Save to my presets”.</p>';
  l.forEach((p) => box.appendChild(card(p, [['Edit', () => { setPreset(p); tab('design'); toast('Loaded to editor'); }], ['Delete', () => { localStorage.setItem('cs_presets', JSON.stringify(myList().filter((x) => x.id !== p.id))); renderMine(); }]])));
}
function save() { const p = sanitize(P); p.name = P.name || 'My preset'; const l = myList().filter((x) => x.name !== p.name); l.push(p); localStorage.setItem('cs_presets', JSON.stringify(l)); renderMine(); toast('Saved. It now appears in the Style tab of CaptionStudio ✓'); }
$('btnSave').onclick = save;
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function encode(p) {
  const raw = new TextEncoder().encode(JSON.stringify(sanitize(p)));
  if (window.CompressionStream) { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(raw); w.close(); return 'CSP1.' + b64u(new Uint8Array(await new Response(cs.readable).arrayBuffer())); }
  return 'CSP0.' + b64u(raw);
}
async function decode(code) {
  code = code.trim(); const m = code.match(/CSP([01])\.([\w-]+)/); if (!m) throw new Error('This is not a preset code.'); const u8 = unb64u(m[2]);
  if (m[1] === '1') { const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(u8); w.close(); return JSON.parse(new TextDecoder().decode(await new Response(ds.readable).arrayBuffer())); }
  return JSON.parse(new TextDecoder().decode(u8));
}
const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copied ✓'); } catch (e) { prompt('Copy this:', t); } };
$('btnCode').onclick = async () => copy(await encode(P));
$('btnLink').onclick = async () => copy(location.origin + location.pathname + '#p=' + await encode(P));
$('btnFile').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(sanitize(P), null, 2)], {type: 'application/json'})); a.download = (P.name || 'preset').replace(/\W+/g, '_') + '.preset.json'; a.click(); };
$('btnImportCode').onclick = async () => { try { const raw = $('codeIn').value.trim(); if (!raw) return toast('Paste a code or link first'); const p = raw.includes('{') ? JSON.parse(raw) : await decode(raw.split('#p=').pop()); setPreset(p); tab('design'); toast('Imported ✓'); } catch (e) { toast(e.message || 'Bad code'); } };
$('fileIn').onchange = async (e) => { try { const t = JSON.parse(await e.target.files[0].text()); (Array.isArray(t) ? t : [t]).slice(0, 50).forEach((p) => { const s = sanitize(p); const l = myList(); l.push(s); localStorage.setItem('cs_presets', JSON.stringify(l)); }); renderMine(); toast('Imported to My presets ✓'); } catch (er) { toast('That file is not a preset file.'); } };
$('btnRem').onclick = async () => { const p = sanitize(P); const o = (r) => ({font: r.font, weight: r.weight, italic: r.italic, size: +(r.size / 1080).toFixed(4), track: r.track, upper: r.upper || undefined,
  fill: {colors: r.fill.colors.length ? r.fill.colors : [r.color], angle: r.fill.angle}, fx: fxOf(r) || undefined, shadow: r.shadow ? {dy: +(r.shadow / 1080).toFixed(4), color: r.shadowColor} : undefined, glow: r.glow ? {color: r.glowColor, blur: +(r.glow / 1080).toFixed(4)} : undefined});
  const big = p.mode === 'emphasis' ? p.roles.accent : p.roles.active, small = p.roles.base;
  copy(JSON.stringify({id: 'p_' + p.name.replace(/\W+/g, '_').toLowerCase(), name: p.name, layout: p.layout === 'stack' ? 'stack' : 'line', anim: p.anim, reveal: p.mode === 'emphasis' ? 'cumulative' : 'all', pos: p.posY, wordsPerCaption: p.wordsPerPage, keyWords: p.mode === 'emphasis' ? 2 : 0, blend: p.blend, behind: big.layer === 'behind' ? (p.behindRule === 'all' ? 'all' : 'first') : 'none', overGraphics: p.overGraphics, behindRule: p.behindRule, big: {...o(big), layer: big.layer, dx: big.dx, dy: big.dy, rotate: big.rotate, opacity: big.opacity}, small: {...o(small), layer: small.layer, dx: small.dx, dy: small.dy, rotate: small.rotate, opacity: small.opacity}}, null, 2)); };

/* ---------------------------------------------------------------- cards (library / mine / community) */
function card(p, actions = [], extra = '') {
  const s = sanitize(p), c = document.createElement('div'); c.className = 'pcard';
  const stg = document.createElement('div'); stg.className = 'pstage'; const sc = 0.16, cur = P; const mk = (txt, r) => { const e = document.createElement('span'); e.textContent = txt; const st = roleCss(r, sc, 30); for (const k in st) e.style[k] = st[k]; return e; };
  const up = (t) => (s.uppercase ? t.toUpperCase() : t); const holder = document.createElement('div'); holder.style.cssText = 'display:flex;flex-direction:column;align-items:center;mix-blend-mode:' + s.blend;
  [s.roles.base, s.roles.accent, s.roles.active].forEach((r) => { loadGoogleFont(r.font); });
  if (s.mode === 'emphasis') { const a = document.createElement('div'), b = document.createElement('div'); a.appendChild(mk(up('this'), s.roles.base)); b.appendChild(mk(up('Gorgeous'), s.roles.accent)); holder.append(a, b); }
  else if (s.mode === 'highlight') { const a = document.createElement('div'); a.appendChild(mk(up('Make '), s.roles.base)); a.appendChild(mk(up('it pop'), s.roles.active)); holder.appendChild(a); }
  else { const a = document.createElement('div'); a.appendChild(mk(up('Wow'), s.roles.active)); holder.appendChild(a); }
  stg.appendChild(holder); c.appendChild(stg);
  c.insertAdjacentHTML('beforeend', `<div class="pn">${esc(s.name)}</div>${extra}`);
  const row = document.createElement('div'); row.className = 'prow'; actions.forEach(([l, fn]) => { const b = document.createElement('button'); b.className = 'btn tiny'; b.textContent = l; b.onclick = fn; row.appendChild(b); }); c.appendChild(row); void cur; return c;
}
function renderLibrary() { const box = $('lib'); box.innerHTML = ''; LIBRARY.forEach((p) => box.appendChild(card(p, [['Use & edit', () => { setPreset(p); P.name = p.name + ' (mine)'; $('pname').value = P.name; tab('design'); }]]))); }

/* ---------------------------------------------------------------- community */
async function loadCommunity() {
  const box = $('comm'); box.innerHTML = '<p class="muted">Loading…</p>';
  try { const r = await (await fetch(`/api/community?sort=${$('cSort').value}&q=${encodeURIComponent($('cQ').value)}`)).json(); box.innerHTML = ''; if (!r.items.length) box.innerHTML = '<p class="muted">No community presets yet. Be the first - design one and press “Publish”.</p>';
    r.items.forEach((it) => box.appendChild(card(it.preset, [['Use & edit', () => { setPreset(it.preset); P.name = it.preset.name; $('pname').value = P.name; tab('design'); }], [`♥ ${it.likes}`, async (e) => { const x = await (await fetch(`/api/community/${it.id}/like`, {method: 'POST'})).json(); e.target.textContent = '♥ ' + x.likes; }]], `<div class="muted small">by ${esc(it.author)}</div>`))); }
  catch (e) { box.innerHTML = '<p class="muted">Community needs the CaptionStudio server (open this page from the website).</p>'; }
}
$('btnPub').onclick = async () => { const author = $('author').value.trim() || 'Anonymous'; localStorage.setItem('cs_author', author);
  try { const r = await fetch('/api/community', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({preset: sanitize(P), author})}); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed'); toast('Published to the community ✓'); } catch (e) { toast(e.message); } };
$('cSort').onchange = loadCommunity; $('cQ').oninput = () => { clearTimeout(loadCommunity.t); loadCommunity.t = setTimeout(loadCommunity, 300); };

/* ---------------------------------------------------------------- stage, tabs, boot */
function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
function tab(n) { document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === n)); document.querySelectorAll('.pane').forEach((p) => p.hidden = p.id !== 'pane-' + n); if (n === 'comm') loadCommunity(); if (n === 'mine') renderMine(); }
document.querySelectorAll('#tabs button').forEach((b) => b.onclick = () => tab(b.dataset.t));
const BGS = {warm: 'radial-gradient(circle at 30% 25%,#ffcf8a 0,transparent 45%),radial-gradient(circle at 75% 70%,#4a8dff 0,transparent 50%),linear-gradient(160deg,#6b4a3a,#243a52)', dusk: 'linear-gradient(180deg,#2b1055,#7597de 60%,#f6a56b)', green: 'linear-gradient(160deg,#2f6b3a,#9ed39a 55%,#d8e8c8)', dark: '#101216', light: '#e9e6df', roomy: 'linear-gradient(120deg,#e8e2d8,#bdb3a3 50%,#6f6657)'};
$('bgSel').onchange = () => { const v = $('bgSel').value; bgVideo.hidden = true; stage.style.background = BGS[v] || BGS.warm; };
$('bgFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const u = URL.createObjectURL(f); bgVideo.hidden = false; if (f.type.startsWith('video')) { bgVideo.src = u; bgVideo.play(); } else { bgVideo.hidden = true; stage.style.background = `center/cover url(${u})`; } };
$('showPerson').onchange = () => { $('person').hidden = !$('showPerson').checked; };
$('sampleTxt').oninput = () => { SAMPLE.text = $('sampleTxt').value || 'your text here'; demoIdx = 0; pageNo = 0; build(true); };
addEventListener('resize', () => build(true));
(async function boot() {
  stage = $('stage'); layer = $('capLayer'); layerB = $('capBehind'); bgVideo = $('bgVideo'); stage.style.background = BGS.warm; $('author').value = localStorage.getItem('cs_author') || '';
  await loadInstalledFonts(); renderLibrary(); renderMine();
  if (location.hash.startsWith('#p=')) { try { setPreset(await decode(location.hash.slice(3))); toast('Shared preset loaded ✓'); } catch (e) { refresh(); } } else refresh();
  requestAnimationFrame(tick);
})();
