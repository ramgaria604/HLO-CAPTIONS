/* layout.js - place caption lines by the REAL shape of the letters (ink), in the browser / Remotion.
   Same algorithm as ink_layout.py (FFmpeg export). Fixes: too much gap between lines, and words/lines touching or overlapping.

   const lay = layoutStack([{text:'Some homes get', font:'Poppins', size:62, weight:700, italic:false, track:-.02},
                            {text:'seen', font:'Poppins', size:200, weight:900, italic:false, track:-.035}],
                           {W:1080, H:1920, posX:.5, posY:.3, inkGap:.03});
   renderLines(lay, hostDiv, (line,i)=>({color:'#fff'}))   // hostDiv = a position:relative box of size W x H
   checkLayout(lay, {W:1080})                               // -> [] when OK, else a list of problems (overlap / too wide / bad gap)           */
const cv = document.createElement('canvas').getContext('2d');
const fontStr = (l, size) => `${l.italic ? 'italic ' : ''}${l.weight} ${size}px "${l.font}"`;
export function measureInk(l, size = l.size) {
  cv.font = fontStr(l, size); const t = l.text, m = cv.measureText(t), n = Math.max(0, t.length - 1);
  return {width: m.width + (l.track || 0) * size * n, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent, fA: m.fontBoundingBoxAscent, fD: m.fontBoundingBoxDescent};
}
export function layoutStack(lines, {W = 1080, H = 1920, posX = .5, posY = .5, inkGap = .03, maxWidth = .9} = {}) {
  const out = lines.map((l) => { const e = measureInk(l), s = e.width ? Math.min(1, maxWidth * W / e.width) : 1; return {...l, size: l.size * s, scale: s, width: e.width * s, asc: e.asc * s, desc: e.desc * s, fA: e.fA * s, fD: e.fD * s}; });
  const gaps = out.slice(1).map((o, i) => Math.max(-.2, inkGap) * Math.max(out[i].size, o.size));
  const total = out.reduce((a, o) => a + o.asc + o.desc, 0) + gaps.reduce((a, g) => a + g, 0); let y = posY * H - total / 2;
  out.forEach((o, i) => { if (i) y += gaps[i - 1]; o.inkTop = y; o.baseline = y + o.asc; o.inkBottom = o.baseline + o.desc; y = o.inkBottom; o.x = posX * W; o.gapAbove = i ? gaps[i - 1] : 0; });
  return out;
}
/* draws each line so its BASELINE lands exactly on lay[i].baseline (works for any font) */
export function renderLines(lay, host, styleFor = () => ({})) {
  host.innerHTML = '';
  lay.forEach((o, i) => {
    const LH = Math.ceil(o.size * 1.6), offset = LH / 2 + (o.fA - o.fD) / 2, d = document.createElement('div');
    Object.assign(d.style, {position: 'absolute', left: o.x + 'px', top: (o.baseline - offset) + 'px', transform: 'translateX(-50%)', whiteSpace: 'nowrap', lineHeight: LH + 'px', height: LH + 'px', fontFamily: `"${o.font}",sans-serif`, fontSize: o.size + 'px', fontWeight: o.weight, fontStyle: o.italic ? 'italic' : 'normal', letterSpacing: (o.track || 0) * o.size + 'px'});
    const s = document.createElement('span'); s.textContent = o.text; s.style.display = 'inline-block'; Object.assign(s.style, styleFor(o, i)); d.appendChild(s);
    const mk = document.createElement('i'); mk.className = 'baseline-marker'; Object.assign(mk.style, {display: 'inline-block', width: '0', height: '0'}); d.appendChild(mk); host.appendChild(d);
  });
}
export function checkLayout(lay, {W = 1080, maxWidth = .9, minGap = -0.001} = {}) {
  const bad = [];
  lay.forEach((o, i) => {
    if (o.width > maxWidth * W + 1) bad.push(`line ${i + 1} is wider than ${Math.round(maxWidth * 100)}% of the frame`);
    if (i) { const g = o.inkTop - lay[i - 1].inkBottom, want = o.gapAbove; if (Math.abs(g - want) > 1.5) bad.push(`gap between line ${i} and ${i + 1} is ${g.toFixed(1)}px, wanted ${want.toFixed(1)}px`); if (g < minGap * 1000) bad.push(`lines ${i} and ${i + 1} overlap by ${(-g).toFixed(1)}px`); }
  });
  return bad;
}

if (typeof window !== 'undefined') {
  window.layoutStack = layoutStack;
  window.renderLines = renderLines;
  window.measureInk = measureInk;
  window.checkLayout = checkLayout;
}

