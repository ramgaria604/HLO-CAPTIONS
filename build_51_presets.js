const fs = require('fs');
const path = require('path');

const white = { colors: ['#FFFFFF'] };
const { EXTRA } = require('./new_pack/antigravity_presets_pack/lab/js/PresetsExtra.js');

const BASE_16 = {
  teal_gloss: {
    id: 'teal_gloss', name: 'Teal Liquid (Reference 🌊)', layout: 'stack', anim: 'pop', reveal: 'cumulative', pos: 0.40, wordsPerCaption: 3, keyWords: 1, behind: 'all', gap: 0.04,
    category: 'reference', fx: 'teal', highlightColor: '#22D3C8',
    big: { font: 'Montserrat', weight: 800, size: 0.16, track: -0.02, fill: { colors: ['#22D3C8', '#0B5E6B'], angle: 90 }, shadow: { dy: 0.028, color: '#04323D' } },
    small: { font: 'Inter', weight: 300, italic: true, size: 0.06, fill: white, lower: true }
  },
  neon_duo: {
    id: 'neon_duo', name: 'Neon Duo (Reference 🪩)', layout: 'stack', anim: 'pop', reveal: 'cumulative', pos: 0.58, wordsPerCaption: 4, keyWords: 2, gap: 0.03, behind: 'none',
    category: 'reference', highlightColor: '#FF6EC7',
    big: { font: 'Montserrat', weight: 800, size: 0.098, track: -0.04, fill: { colors: ['#C21E9E', '#7A1FB0'], angle: 90 }, glow: { color: '#FF6EC7', blur: 0.07 } },
    small: { font: 'Great Vibes', weight: 400, size: 0.15, fill: { colors: ['#FFFFFF', '#FFD3F3'], angle: 90 }, glow: { color: '#FF9BE0', blur: 0.06 } }
  },
  orange_pop: {
    id: 'orange_pop', name: 'Orange Grunge (Reference 🍊)', layout: 'scatter', anim: 'pop', reveal: 'cumulative', pos: 0.50, wordsPerCaption: 3, keyWords: 2, behind: 'first', gap: 0.05,
    category: 'reference', fx: 'orange', highlightColor: '#FF6A00',
    big: { font: 'Montserrat', weight: 800, size: 0.17, track: -0.02, fill: { colors: ['#FF6A00', '#CC240A'], angle: 90 }, shadow: { dy: 0.03, color: '#7A0A0A' } },
    small: { font: 'Poppins', weight: 500, size: 0.058, fill: white, lower: true }
  },
  mono_echo: {
    id: 'mono_echo', name: 'Mono Echo 🖤', layout: 'echo', anim: 'pop', reveal: 'cumulative', pos: 0.30, wordsPerCaption: 2, keyWords: 1, echoOffsetEm: -0.9,
    category: 'classic', highlightColor: '#FFFFFF',
    big: { font: 'Inter', weight: 900, italic: true, size: 0.13, fill: { colors: ['#0A0A0A'] } },
    small: { font: 'Inter', weight: 300, size: 0.09, fill: white, shadow: { dy: 0.03, blur: 0.08, color: 'rgba(0,0,0,.35)' } }
  },
  wipe_italic: {
    id: 'wipe_italic', name: 'Wipe Italic ⚡', layout: 'line', anim: 'fade', reveal: 'all', pos: 0.80, wordsPerCaption: 2, keyWords: 0,
    category: 'classic', highlightColor: '#4DA3FF',
    highlight: { mode: 'wipe', color: '#4DA3FF', wipe: ['#FFFFFF', '#4DA3FF'] },
    big: { font: 'Inter', weight: 900, italic: true, size: 0.085, fill: { colors: ['#111111'] } },
    small: { font: 'Inter', weight: 900, italic: true, size: 0.085, fill: { colors: ['#111111'] } }
  },
  hype_yellow: {
    id: 'hype_yellow', name: 'Hype Yellow ⚡', layout: 'line', anim: 'pop', reveal: 'all', pos: 0.68, wordsPerCaption: 3, keyWords: 0,
    category: 'classic', highlightColor: '#FFE600',
    highlight: { mode: 'color', color: '#FFE600' },
    big: { font: 'Anton', weight: 400, size: 0.10, fill: white, upper: true, stroke: { w: 0.08, color: '#000000' } },
    small: { font: 'Anton', weight: 400, size: 0.10, fill: white, upper: true, stroke: { w: 0.08, color: '#000000' } }
  },
  box_pop: {
    id: 'box_pop', name: 'Box Pop ⭐', layout: 'line', anim: 'pop', reveal: 'all', pos: 0.70, wordsPerCaption: 3, keyWords: 0,
    category: 'classic', highlightColor: '#FFE600', badge: '#FFE600', badgeTextColor: '#111111',
    highlight: { mode: 'box', color: '#FFE600', textColor: '#111111' },
    big: { font: 'Poppins', weight: 800, size: 0.075, fill: white, upper: true, shadow: { dy: 0.04, blur: 0.08, color: 'rgba(0,0,0,.55)' } },
    small: { font: 'Poppins', weight: 800, size: 0.075, fill: white, upper: true, shadow: { dy: 0.04, blur: 0.08, color: 'rgba(0,0,0,.55)' } }
  },
  clean_cyan: {
    id: 'clean_cyan', name: 'Clean Cyan 💎', layout: 'line', anim: 'fade', reveal: 'all', pos: 0.72, wordsPerCaption: 3, keyWords: 0,
    category: 'classic', highlightColor: '#19E3FF',
    highlight: { mode: 'color', color: '#19E3FF' },
    big: { font: 'Poppins', weight: 800, size: 0.07, fill: white, shadow: { dy: 0.04, blur: 0.1, color: 'rgba(0,0,0,.6)' } },
    small: { font: 'Poppins', weight: 800, size: 0.07, fill: white, shadow: { dy: 0.04, blur: 0.1, color: 'rgba(0,0,0,.6)' } }
  },
  gold_luxury: {
    id: 'gold_luxury', name: 'Gold Luxury 👑', layout: 'stack', anim: 'slide', reveal: 'cumulative', pos: 0.62, wordsPerCaption: 3, keyWords: 1,
    category: 'classic', highlightColor: '#D4A62A',
    big: { font: 'Playfair Display', weight: 700, italic: true, size: 0.12, fill: { colors: ['#F9EBA8', '#D4A62A', '#8A6A12'], angle: 100 }, shadow: { dy: 0.03, blur: 0.06, color: 'rgba(0,0,0,.5)' } },
    small: { font: 'Inter', weight: 500, size: 0.035, fill: white, upper: true, track: 0.3, shadow: { dy: 0.05, blur: 0.1, color: 'rgba(0,0,0,.6)' } }
  },
  fire_gradient: {
    id: 'fire_gradient', name: 'Fire 🔥', layout: 'stack', anim: 'bounce', reveal: 'cumulative', pos: 0.55, wordsPerCaption: 3, keyWords: 1,
    category: 'colourful', highlightColor: '#FF7A18',
    big: { font: 'Bebas Neue', weight: 400, size: 0.19, fill: { colors: ['#FFE259', '#FF7A18', '#E01E1E'], angle: 90 }, upper: true, glow: { color: '#FF5A00', blur: 0.04 }, shadow: { dy: 0.03, color: '#3A0A0A' } },
    small: { font: 'Bebas Neue', weight: 400, size: 0.07, fill: white, upper: true, track: 0.1, shadow: { dy: 0.05, blur: 0.08, color: 'rgba(0,0,0,.7)' } }
  },
  ice_blue: {
    id: 'ice_blue', name: 'Ice Blue ❄️', layout: 'line', anim: 'fade', reveal: 'all', pos: 0.66, wordsPerCaption: 3, keyWords: 0,
    category: 'colourful', highlightColor: '#7DE3FF',
    highlight: { mode: 'color', color: '#7DE3FF' },
    big: { font: 'Montserrat', weight: 800, size: 0.075, fill: { colors: ['#FFFFFF', '#BFE9FF'], angle: 90 }, glow: { color: '#38BDF8', blur: 0.05 } },
    small: { font: 'Montserrat', weight: 800, size: 0.075, fill: { colors: ['#FFFFFF', '#BFE9FF'], angle: 90 }, glow: { color: '#38BDF8', blur: 0.05 } }
  },
  retro_sunset: {
    id: 'retro_sunset', name: 'Retro Sunset 🌅', layout: 'stack', anim: 'bounce', reveal: 'cumulative', pos: 0.55, wordsPerCaption: 3, keyWords: 1,
    category: 'colourful', highlightColor: '#FF4FA3',
    big: { font: 'Bungee', weight: 400, size: 0.12, fill: { colors: ['#FF4FA3', '#FF9A3C'], angle: 90 }, extrude: { n: 6, dx: 0.012, dy: 0.016, color: '#4B1FA8' } },
    small: { font: 'Bungee', weight: 400, size: 0.05, fill: white, shadow: { dy: 0.06, color: '#4B1FA8' } }
  },
  comic_pow: {
    id: 'comic_pow', name: 'Comic Pow 💥', layout: 'stack', anim: 'bounce', reveal: 'cumulative', pos: 0.55, wordsPerCaption: 3, keyWords: 1, tilt: 3,
    category: 'classic', highlightColor: '#FFD400',
    big: { font: 'Bangers', weight: 400, size: 0.15, fill: { colors: ['#FFD400'] }, stroke: { w: 0.09, color: '#000000' }, shadow: { dy: 0.04, color: '#000000' } },
    small: { font: 'Bangers', weight: 400, size: 0.07, fill: white, stroke: { w: 0.08, color: '#000000' } }
  },
  marker_highlight: {
    id: 'marker_highlight', name: 'Marker 🖊️', layout: 'line', anim: 'pop', reveal: 'all', pos: 0.70, wordsPerCaption: 3, keyWords: 0,
    category: 'classic', highlightColor: '#FFE600',
    highlight: { mode: 'underline', color: '#FFE600' },
    big: { font: 'Permanent Marker', weight: 400, size: 0.075, fill: white, shadow: { dy: 0.05, blur: 0.1, color: 'rgba(0,0,0,.7)' } },
    small: { font: 'Permanent Marker', weight: 400, size: 0.075, fill: white, shadow: { dy: 0.05, blur: 0.1, color: 'rgba(0,0,0,.7)' } }
  },
  terminal_type: {
    id: 'terminal_type', name: 'Terminal 💻', layout: 'line', anim: 'type', reveal: 'cumulative', pos: 0.78, wordsPerCaption: 4, keyWords: 0, pill: 'rgba(0,0,0,.7)',
    category: 'classic', highlightColor: '#3CFF7A',
    big: { font: 'Space Mono', weight: 700, size: 0.05, fill: { colors: ['#3CFF7A'] } },
    small: { font: 'Space Mono', weight: 700, size: 0.05, fill: { colors: ['#3CFF7A'] } }
  },
  glitch_rgb: {
    id: 'glitch_rgb', name: 'Glitch RGB 👾', layout: 'line', anim: 'glitch', reveal: 'all', pos: 0.68, wordsPerCaption: 3, keyWords: 0,
    category: 'classic', highlightColor: '#FF2D55',
    highlight: { mode: 'color', color: '#FF2D55' },
    big: { font: 'Anton', weight: 400, size: 0.10, fill: white, upper: true, chroma: true },
    small: { font: 'Anton', weight: 400, size: 0.10, fill: white, upper: true, chroma: true }
  }
};

// Helper to adjust position downward, scale down oversized fonts, and add subtle transparency
function tunePreset(p) {
  const tuned = { ...p };
  // Shift all captions downward to lower-third (78% from top)
  tuned.pos = 0.78;

  // Cap font sizes so captions never cover all spaces
  if (tuned.big) {
    const b = { ...tuned.big };
    if (b.size > 0.092) {
      b.size = Math.min(0.090, +(b.size * 0.60).toFixed(3));
    } else if (b.size > 0.085) {
      b.size = 0.085;
    }
    tuned.big = b;
  }
  if (tuned.small) {
    const s = { ...tuned.small };
    if (s.size > 0.055) {
      s.size = Math.min(0.050, +(s.size * 0.58).toFixed(3));
    }
    tuned.small = s;
  }

  // Slight transparency so video shows through nicely
  tuned.opacity = 0.90;
  return tuned;
}

const ALL_51 = {};
const BLEND_IDS = new Set([
  'forest_mist', 'overlay_white', 'difference_invert', 'hardlight_duo',
  'screen_glow', 'multiply_ink', 'glass_frost', 'twilight_blend'
]);

for (const [id, p] of Object.entries(BASE_16)) {
  ALL_51[id] = tunePreset(p);
}

for (const [id, p] of Object.entries(EXTRA)) {
  const cat = BLEND_IDS.has(id) || p.blend ? 'blend' : 'colourful';
  ALL_51[id] = tunePreset({
    ...p,
    category: cat,
    highlightColor: p.highlight?.color || p.big?.fill?.colors?.[0] || '#FFE600'
  });
}

console.log('Total presets compiled:', Object.keys(ALL_51).length);

// Write to static/presets51.json
fs.writeFileSync('./static/presets51.json', JSON.stringify(ALL_51, null, 2), 'utf-8');
console.log('Wrote ./static/presets51.json successfully with downward lower positioning and balanced font sizes!');
