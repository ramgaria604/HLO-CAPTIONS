/**
 * CaptionPresets.tsx  -  16 premium caption presets for Remotion (ONE FILE, copy-paste ready)
 *
 * INSTALL (in your /remotion folder):   npm i @remotion/google-fonts
 * PUT THIS FILE AT:                     remotion/src/CaptionPresets.tsx
 *
 * USE in remotion/src/Root.tsx:
 *   import {Composition} from 'remotion';
 *   import {CaptionedVideo, PRESET_LIST} from './CaptionPresets';
 *   export const RemotionRoot = () => (
 *     <Composition id="Captioned" component={CaptionedVideo} width={1080} height={1920} fps={30}
 *       durationInFrames={900}   // set from your video length: seconds * 30
 *       defaultProps={{videoSrc: 'video.mp4', words: [], presetId: 'neon_duo'}} />
 *   );
 *
 * words = [{t:'So', s:0.30, e:0.55}, ...]   (seconds, from Whisper word timestamps)
 * Optional per word: key:true  -> force this word to be a BIG word.
 * Render:  npx remotion render Captioned out.mp4 --props=props.json
 */
import React, {useMemo} from 'react';
import {AbsoluteFill, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as fPoppins} from '@remotion/google-fonts/Poppins';
import {loadFont as fInter} from '@remotion/google-fonts/Inter';
import {loadFont as fGreat} from '@remotion/google-fonts/GreatVibes';
import {loadFont as fAnton} from '@remotion/google-fonts/Anton';
import {loadFont as fPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as fBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as fBungee} from '@remotion/google-fonts/Bungee';
import {loadFont as fBangers} from '@remotion/google-fonts/Bangers';
import {loadFont as fMarker} from '@remotion/google-fonts/PermanentMarker';
import {loadFont as fMono} from '@remotion/google-fonts/SpaceMono';
import {loadFont as fMontserrat} from '@remotion/google-fonts/Montserrat';
import {Fx, FX, fxBackground} from './fx';
import {EXTRA} from './PresetsExtra';
import {loadFont as fPacifico} from '@remotion/google-fonts/Pacifico';
import {loadFont as fLobster} from '@remotion/google-fonts/Lobster';
import {loadFont as fOswald} from '@remotion/google-fonts/Oswald';
import {loadFont as fArchivo} from '@remotion/google-fonts/ArchivoBlack';
import {loadFont as fRighteous} from '@remotion/google-fonts/Righteous';
import {loadFont as fCaveat} from '@remotion/google-fonts/Caveat';
import {loadFont as fRubik} from '@remotion/google-fonts/Rubik';
fPacifico('normal', {subsets: ['latin']}); fLobster('normal', {subsets: ['latin']}); fOswald('normal', {weights: ['700'], subsets: ['latin']});
fArchivo('normal', {subsets: ['latin']}); fRighteous('normal', {subsets: ['latin']}); fCaveat('normal', {weights: ['700'], subsets: ['latin']}); fRubik('normal', {weights: ['800', '900'], subsets: ['latin']});

fPoppins('normal', {weights: ['500', '700', '800', '900'], subsets: ['latin']});
fInter('normal', {weights: ['300', '500', '900'], subsets: ['latin']});
fInter('italic', {weights: ['300', '900'], subsets: ['latin']});
fGreat('normal', {subsets: ['latin']});
fAnton('normal', {subsets: ['latin']});
fPlayfair('italic', {weights: ['700'], subsets: ['latin']});
fBebas('normal', {subsets: ['latin']});
fBungee('normal', {subsets: ['latin']});
fBangers('normal', {subsets: ['latin']});
fMarker('normal', {subsets: ['latin']});
fMono('normal', {weights: ['700'], subsets: ['latin']});
fMontserrat('normal', {weights: ['500', '600', '700', '800', '900'], subsets: ['latin']});

// ---------------------------------------------------------------- types
export type Word = {t: string; s: number; e: number; key?: boolean};
export type Role = {
  font: string; weight: number; italic?: boolean; size: number;           // size = fraction of min(width,height)
  fill: {colors: string[]; angle?: number};
  glow?: {color: string; blur: number}; shadow?: {dx?: number; dy: number; blur?: number; color: string};
  extrude?: {n: number; dx: number; dy: number; color: string};
  stroke?: {w: number; color: string};                                    // use only with ONE solid colour
  texture?: boolean; gloss?: boolean; chroma?: boolean;
  fx?: Fx;                                                                // SVG+CSS liquid / grunge texture (see fx.ts)
  upper?: boolean; lower?: boolean; track?: number;
};
type Anim = 'pop' | 'bounce' | 'slide' | 'slideRightSoft' | 'fade' | 'glitch' | 'type' | 'rise' | 'flip';
type Highlight = {mode: 'color' | 'box' | 'underline' | 'wipe'; color: string; textColor?: string; wipe?: [string, string]};
export type Preset = {
  id: string; name: string;
  layout: 'stack' | 'line' | 'scatter' | 'echo';
  anim: Anim; reveal: 'cumulative' | 'all';
  pos: number; wordsPerCaption: number; keyWords: number;
  big: Role; small: Role;
  highlight?: Highlight; echoOffsetEm?: number; tilt?: number;
  pill?: string;                 // background colour behind the whole caption
  behind?: 'none' | 'first' | 'all';  // which BIG words go behind the speaker (needs personSrc): first = only the first big word (like the orange reference)
  behindPerson?: boolean;        // legacy flag
  smallDx?: number[];            // x-offsets of the small-word runs in 'scatter' layout (fraction of width, negative = left)
  keyLast?: boolean;             // use only the final spoken word as the large headline
  gap?: number;                  // space between words in em (default 0.12; neon uses 0.02)
  blend?: string;                // CSS mix-blend-mode so the captions melt into the video: overlay | soft-light | hard-light | screen | multiply | difference | color-dodge
};

// ---------------------------------------------------------------- the 16 presets
const white = {colors: ['#FFFFFF']};
export const PRESETS: Record<string, Preset> = {
  // ----- from your 4 references
  neon_duo: {id: 'neon_duo', name: 'Neon Duo', layout: 'stack', anim: 'pop', reveal: 'cumulative', pos: 0.78, wordsPerCaption: 4, keyWords: 2, gap: 0.03, behind: 'none',
    big: {font: 'Montserrat', weight: 800, size: 0.088, track: -0.045, fill: {colors: ['#B3229F', '#6E22AE'], angle: 90}, glow: {color: '#FFB0E4', blur: 0.08}},
    small: {font: 'Great Vibes', weight: 400, size: 0.055, fill: {colors: ['#FFFFFF', '#FBE3F6'], angle: 90}, glow: {color: '#FFC2EC', blur: 0.07}}},
  orange_pop: {id: 'orange_pop', name: 'Orange Grunge (behind person)', layout: 'scatter', anim: 'pop', reveal: 'cumulative', pos: 0.78, wordsPerCaption: 3, keyWords: 2, behind: 'first', gap: 0.05, smallDx: [-0.2, 0.12],
    big: {font: 'Montserrat', weight: 900, size: 0.090, track: -0.02, fill: {colors: ['#FF5A00', '#D6300A'], angle: 90}, fx: FX.orange, shadow: {dy: 0.008, color: '#9A1408'}},
    small: {font: 'Montserrat', weight: 600, size: 0.050, fill: white, lower: true}},
  teal_gloss: {id: 'teal_gloss', name: 'Teal Liquid (behind person)', layout: 'scatter', anim: 'pop', reveal: 'cumulative', pos: 0.78, wordsPerCaption: 3, keyWords: 1, behind: 'all', gap: 0.04, smallDx: [-0.36],
    big: {font: 'Montserrat', weight: 900, size: 0.090, track: -0.02, fill: {colors: ['#2BD0C8', '#085A6C'], angle: 90}, fx: FX.teal, shadow: {dy: 0.004, color: '#04323D'}},
    small: {font: 'Inter', weight: 300, italic: true, size: 0.048, fill: white, lower: true}},
  mono_echo: {id: 'mono_echo', name: 'Mono Echo', layout: 'echo', anim: 'pop', reveal: 'cumulative', pos: 0.78, wordsPerCaption: 2, keyWords: 1, echoOffsetEm: -0.9,
    big: {font: 'Inter', weight: 900, italic: true, size: 0.088, fill: {colors: ['#0A0A0A']}},
    small: {font: 'Inter', weight: 300, size: 0.050, fill: white, shadow: {dy: 0.03, blur: 0.08, color: 'rgba(0,0,0,.35)'}}},
  wipe_italic: {id: 'wipe_italic', name: 'Wipe Italic (light videos)', layout: 'line', anim: 'fade', reveal: 'all', pos: 0.80, wordsPerCaption: 2, keyWords: 0,
    highlight: {mode: 'wipe', color: '#4DA3FF', wipe: ['#FFFFFF', '#4DA3FF']},
    big: {font: 'Inter', weight: 900, italic: true, size: 0.085, fill: {colors: ['#111111']}},
    small: {font: 'Inter', weight: 900, italic: true, size: 0.085, fill: {colors: ['#111111']}}},
  // ----- 12 more
  hype_yellow: {id: 'hype_yellow', name: 'Hype Yellow', layout: 'line', anim: 'pop', reveal: 'all', pos: 0.68, wordsPerCaption: 3, keyWords: 0,
    highlight: {mode: 'color', color: '#FFE600'},
    big: {font: 'Anton', weight: 400, size: 0.10, fill: white, upper: true, stroke: {w: 0.08, color: '#000000'}},
    small: {font: 'Anton', weight: 400, size: 0.10, fill: white, upper: true, stroke: {w: 0.08, color: '#000000'}}},
  box_pop: {id: 'box_pop', name: 'Box Pop', layout: 'line', anim: 'pop', reveal: 'all', pos: 0.70, wordsPerCaption: 3, keyWords: 0,
    highlight: {mode: 'box', color: '#FFE600', textColor: '#111111'},
    big: {font: 'Poppins', weight: 800, size: 0.075, fill: white, upper: true, shadow: {dy: 0.04, blur: 0.08, color: 'rgba(0,0,0,.55)'}},
    small: {font: 'Poppins', weight: 800, size: 0.075, fill: white, upper: true, shadow: {dy: 0.04, blur: 0.08, color: 'rgba(0,0,0,.55)'}}},
  clean_cyan: {id: 'clean_cyan', name: 'Clean Cyan', layout: 'line', anim: 'fade', reveal: 'all', pos: 0.72, wordsPerCaption: 3, keyWords: 0,
    highlight: {mode: 'color', color: '#19E3FF'},
    big: {font: 'Poppins', weight: 800, size: 0.07, fill: white, shadow: {dy: 0.04, blur: 0.1, color: 'rgba(0,0,0,.6)'}},
    small: {font: 'Poppins', weight: 800, size: 0.07, fill: white, shadow: {dy: 0.04, blur: 0.1, color: 'rgba(0,0,0,.6)'}}},
  gold_luxury: {id: 'gold_luxury', name: 'Gold Luxury', layout: 'stack', anim: 'slide', reveal: 'cumulative', pos: 0.62, wordsPerCaption: 3, keyWords: 1,
    big: {font: 'Playfair Display', weight: 700, italic: true, size: 0.12, fill: {colors: ['#F9EBA8', '#D4A62A', '#8A6A12'], angle: 100}, shadow: {dy: 0.03, blur: 0.06, color: 'rgba(0,0,0,.5)'}},
    small: {font: 'Inter', weight: 500, size: 0.035, fill: white, upper: true, track: 0.3, shadow: {dy: 0.05, blur: 0.1, color: 'rgba(0,0,0,.6)'}}},
  fire_gradient: {id: 'fire_gradient', name: 'Fire', layout: 'stack', anim: 'bounce', reveal: 'cumulative', pos: 0.55, wordsPerCaption: 3, keyWords: 1,
    big: {font: 'Bebas Neue', weight: 400, size: 0.19, fill: {colors: ['#FFE259', '#FF7A18', '#E01E1E'], angle: 90}, upper: true, glow: {color: '#FF5A00', blur: 0.04}, shadow: {dy: 0.03, color: '#3A0A0A'}},
    small: {font: 'Bebas Neue', weight: 400, size: 0.07, fill: white, upper: true, track: 0.1, shadow: {dy: 0.05, blur: 0.08, color: 'rgba(0,0,0,.7)'}}},
  ice_blue: {id: 'ice_blue', name: 'Ice Blue', layout: 'line', anim: 'fade', reveal: 'all', pos: 0.66, wordsPerCaption: 3, keyWords: 0,
    highlight: {mode: 'color', color: '#7DE3FF'},
    big: {font: 'Montserrat', weight: 800, size: 0.075, fill: {colors: ['#FFFFFF', '#BFE9FF'], angle: 90}, glow: {color: '#38BDF8', blur: 0.05}},
    small: {font: 'Montserrat', weight: 800, size: 0.075, fill: {colors: ['#FFFFFF', '#BFE9FF'], angle: 90}, glow: {color: '#38BDF8', blur: 0.05}}},
  retro_sunset: {id: 'retro_sunset', name: 'Retro Sunset', layout: 'stack', anim: 'bounce', reveal: 'cumulative', pos: 0.55, wordsPerCaption: 3, keyWords: 1,
    big: {font: 'Bungee', weight: 400, size: 0.12, fill: {colors: ['#FF4FA3', '#FF9A3C'], angle: 90}, extrude: {n: 6, dx: 0.012, dy: 0.016, color: '#4B1FA8'}},
    small: {font: 'Bungee', weight: 400, size: 0.05, fill: white, shadow: {dy: 0.06, color: '#4B1FA8'}}},
  comic_pow: {id: 'comic_pow', name: 'Comic Pow', layout: 'stack', anim: 'bounce', reveal: 'cumulative', pos: 0.55, wordsPerCaption: 3, keyWords: 1, tilt: 3,
    big: {font: 'Bangers', weight: 400, size: 0.15, fill: {colors: ['#FFD400']}, stroke: {w: 0.09, color: '#000000'}, shadow: {dy: 0.04, color: '#000000'}},
    small: {font: 'Bangers', weight: 400, size: 0.07, fill: white, stroke: {w: 0.08, color: '#000000'}}},
  marker_highlight: {id: 'marker_highlight', name: 'Marker', layout: 'line', anim: 'pop', reveal: 'all', pos: 0.70, wordsPerCaption: 3, keyWords: 0,
    highlight: {mode: 'underline', color: '#FFE600'},
    big: {font: 'Permanent Marker', weight: 400, size: 0.075, fill: white, shadow: {dy: 0.05, blur: 0.1, color: 'rgba(0,0,0,.7)'}},
    small: {font: 'Permanent Marker', weight: 400, size: 0.075, fill: white, shadow: {dy: 0.05, blur: 0.1, color: 'rgba(0,0,0,.7)'}}},
  terminal_type: {id: 'terminal_type', name: 'Terminal', layout: 'line', anim: 'type', reveal: 'cumulative', pos: 0.78, wordsPerCaption: 4, keyWords: 0, pill: 'rgba(0,0,0,.7)',
    big: {font: 'Space Mono', weight: 700, size: 0.05, fill: {colors: ['#3CFF7A']}},
    small: {font: 'Space Mono', weight: 700, size: 0.05, fill: {colors: ['#3CFF7A']}}},
  glitch_rgb: {id: 'glitch_rgb', name: 'Glitch RGB', layout: 'line', anim: 'glitch', reveal: 'all', pos: 0.68, wordsPerCaption: 3, keyWords: 0,
    highlight: {mode: 'color', color: '#FF2D55'},
    big: {font: 'Anton', weight: 400, size: 0.10, fill: white, upper: true, chroma: true},
    small: {font: 'Anton', weight: 400, size: 0.10, fill: white, upper: true, chroma: true}},
};
Object.assign(PRESETS, EXTRA);
export const PRESET_LIST = Object.values(PRESETS).map((p) => ({id: p.id, name: p.name}));

/** Auto-match a preset to the video's colours (Phase 3): pass two colours from the video palette. */
export const recolor = (p: Preset, c1: string, c2: string): Preset => ({
  ...p, big: {...p.big, fill: {...p.big.fill, colors: [c1, c2]}},
  highlight: p.highlight ? {...p.highlight, color: c1} : undefined,
});

// ---------------------------------------------------------------- helpers
const STOP = new Set('a an the and or but if so to of in on at for from by with as is are was were be been am i you he she it we they me my your his her its our their this that these those there here do does did have has had will would can could should just very really also than then too not no yes oh um uh like get got gonna wanna about into over out up down off more most some any all each both other such only same what which who when where why how im ive dont cant wont thats lets'.split(' '));
const score = (w: string) => {
  const c = w.replace(/[^\p{L}\p{N}']/gu, '');
  if (!c || STOP.has(c.toLowerCase())) return 0;
  return c.length + (/\d/.test(c) ? 4 : 0);
};
type Chunk = {start: number; end: number; words: Word[]};
function makeChunks(words: Word[], per: number, nKeys: number, keyLast = false): Chunk[] {
  const out: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    const keys = cur.map((w, i) => [score(w.t), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1])
      .filter((x) => x[0] >= 4).slice(0, nKeys).map((x) => x[1]);
    const ws = cur.map((w, i) => ({...w, key: keyLast ? i === cur.length - 1 : w.key ?? (keys.includes(i) || i === cur.length - 1)}));
    out.push({start: ws[0].s, end: ws[ws.length - 1].e, words: ws});
    cur = [];
  };
  for (const w of words) {
    if (cur.length && (cur.length >= per || w.s - cur[cur.length - 1].e > 0.7)) flush();
    cur.push(w);
    if (/[.!?]$/.test(w.t)) flush();
  }
  flush();
  out.forEach((c, i) => {
    const next = out[i + 1];
    c.end = next && next.start - c.end < 0.35 ? next.start : c.end + 0.25;
  });
  return out;
}
const NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.3 -0.35'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

function roleStyle(r: Role, em: number, solidOverride?: string, frame = 0): React.CSSProperties {
  const solid = r.fill.colors.length === 1 && !r.gloss && !r.texture && !r.fx;
  const css: any = {
    display: 'inline-block', whiteSpace: 'nowrap', lineHeight: 1.05, fontSize: em,
    fontFamily: `"${r.font}", sans-serif`, fontWeight: r.weight, fontStyle: r.italic ? 'italic' : 'normal',
    letterSpacing: `${r.track ?? 0}em`, textTransform: r.upper ? 'uppercase' : r.lower ? 'lowercase' : 'none',
  };
  if (solid || solidOverride) css.color = solidOverride ?? r.fill.colors[0];
  else if (r.fx) Object.assign(css, fxBackground(r.fx, frame));
  else {
    const layers: string[] = [], blends: string[] = [];
    if (r.gloss) { layers.push('linear-gradient(180deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,0) 48%)'); blends.push('normal'); }
    if (r.texture) { layers.push(NOISE); blends.push('multiply'); }
    layers.push(r.fill.colors.length > 1 ? `linear-gradient(${r.fill.angle ?? 90}deg,${r.fill.colors.join(',')})` : `linear-gradient(${r.fill.colors[0]},${r.fill.colors[0]})`);
    blends.push('normal');
    css.backgroundImage = layers.join(',');
    css.backgroundBlendMode = blends.join(',');
    css.WebkitBackgroundClip = 'text'; css.backgroundClip = 'text';
    css.color = 'transparent'; css.WebkitTextFillColor = 'transparent';
  }
  if (r.stroke) { css.WebkitTextStroke = `${r.stroke.w * em * 2}px ${r.stroke.color}`; css.paintOrder = 'stroke fill'; }
  if (r.chroma) css.textShadow = `${-0.035 * em}px 0 0 #FF2D55, ${0.035 * em}px 0 0 #00E5FF`;
  const f: string[] = [];
  if (r.glow) f.push(`drop-shadow(0 0 ${r.glow.blur * em}px ${r.glow.color})`, `drop-shadow(0 0 ${r.glow.blur * em * 2}px ${r.glow.color})`);
  if (r.shadow) f.push(`drop-shadow(${(r.shadow.dx ?? 0) * em}px ${r.shadow.dy * em}px ${(r.shadow.blur ?? 0) * em}px ${r.shadow.color})`);
  if (r.extrude) for (let i = 0; i < r.extrude.n; i++) f.push(`drop-shadow(${r.extrude.dx * em / r.extrude.n * 2}px ${r.extrude.dy * em / r.extrude.n * 2}px 0 ${r.extrude.color})`);
  if (f.length) css.filter = f.join(' ');
  return css;
}

function animStyle(anim: Anim, age: number, fps: number, em: number): React.CSSProperties {
  if (age < 0) return {opacity: 0};
  if (anim === 'pop') { const s = spring({frame: age, fps, config: {damping: 11, stiffness: 170}}); return {opacity: Math.min(1, age / 2), transform: `scale(${0.55 + 0.45 * s})`}; }
  if (anim === 'bounce') { const s = spring({frame: age, fps, config: {damping: 6, stiffness: 200, mass: 0.6}}); const settle = interpolate(age, [0, 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); return {opacity: Math.min(1, age / 2), transform: `scale(${0.3 + 0.7 * s}) translateY(${(1 - settle) * -0.25 * em}px)`}; }
  if (anim === 'slide') { const p = interpolate(age, [0, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); const eased = 1 - Math.pow(1 - p, 3); return {opacity: eased, transform: `translateY(${(1 - eased) * 0.4 * em}px)`}; }
  if (anim === 'slideRightSoft') { const p = interpolate(age, [0, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); const eased = 1 - Math.pow(1 - p, 3); return {opacity: 0.15 + 0.85 * eased, transform: `translateX(${(1 - eased) * -0.10 * em}px)`}; }
  if (anim === 'glitch') { const j = age < 8 ? (age % 2 ? 1 : -1) * 0.06 * em : 0; return {opacity: age < 8 && age % 3 === 0 ? 0.4 : 1, transform: `translateX(${j}px)`}; }
  if (anim === 'rise') { const p = interpolate(age, [0, 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); const eased = 1 - Math.pow(1 - p, 3); return {opacity: eased, transform: `translateY(${(1 - eased) * 0.6 * em}px)`}; }
  if (anim === 'flip') { const s = spring({frame: age, fps, config: {damping: 12, stiffness: 120}}); return {opacity: Math.min(1, age / 3), transform: `perspective(${em * 8}px) rotateX(${(1 - s) * 85}deg)`}; }
  if (anim === 'fade') return {opacity: interpolate(age, [0, 6], [0, 1], {extrapolateRight: 'clamp'})};
  return {opacity: 1};
}

// ---------------------------------------------------------------- one word
const WordView: React.FC<{w: Word; p: Preset; role: Role; em: number; anchor: number; hidden?: boolean}> = ({w, p, role, em, anchor, hidden}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const sf = (p.reveal === 'all' ? anchor : w.s) * fps;
  const age = frame - sf;
  const active = t >= w.s && t < w.e;
  const hl = p.highlight;
  let text = w.t;
  if (p.anim === 'type' && age >= 0) text = w.t.slice(0, Math.max(1, Math.floor(age / (fps * 0.04))));
  const base = animStyle(p.anim, age, fps, em);
  const margin = {margin: `0 ${(p.gap ?? 0.12) * em}px`};
  const vis: React.CSSProperties = hidden ? {visibility: 'hidden'} : {};

  if (hl?.mode === 'wipe') {
    const prog = interpolate(t, [w.s, w.e], [0, w.t.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return (
      <span style={{...base, ...margin, ...vis, display: 'inline-block'}}>
        {w.t.split('').map((ch, i) => {
          const done = active && i < prog;
          const r: Role = done ? {...role, fill: {colors: hl.wipe ?? [hl.color], angle: 90}} : role;
          return <span key={i} style={roleStyle(r, em, undefined, frame)}>{ch}</span>;
        })}
      </span>
    );
  }
  let style: React.CSSProperties = {
    ...roleStyle(role, em, active && hl?.mode === 'color' ? hl.color : undefined, frame),
    opacity: active ? 0.98 : 0.90,
  };
  let wrap: React.CSSProperties = {...base, ...margin, ...vis, display: 'inline-block'};
  if (hl?.mode === 'box') {
    wrap = {...wrap, background: active ? hl.color : 'transparent', borderRadius: 0.18 * em, padding: `0 ${0.22 * em}px`};
    if (active) style = {...style, ...roleStyle({...role, shadow: undefined}, em, hl.textColor ?? '#111'), opacity: 0.98};
  }
  if (hl?.mode === 'underline' && active) wrap = {...wrap, backgroundImage: `linear-gradient(transparent 52%, ${hl.color} 52%, ${hl.color} 92%, transparent 92%)`};
  return <span style={wrap}><span style={style}>{text}</span></span>;
};

// ---------------------------------------------------------------- the caption block
export const PremiumCaptions: React.FC<{words: Word[]; presetId?: string; preset?: Preset; layer?: 'all' | 'behind' | 'front'}> = ({words, presetId = 'neon_duo', preset, layer = 'all'}) => {
  const p = preset ?? PRESETS[presetId];
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const base = Math.min(width, height);
  const chunks = useMemo(() => makeChunks(words, p.wordsPerCaption, p.keyWords, p.keyLast), [words, p]);
  const ci = chunks.findIndex((c) => t >= c.start - 0.02 && t < c.end);
  if (ci < 0) return null;
  const chunk = chunks[ci];

  const emOf = (r: Role, line: Word[]) => {
    let est = 0;
    for (const w of line) {
      const wordRole = roleOf(w);
      est += w.t.length * wordRole.size * base * (wordRole.upper ? 0.68 : 0.58) + wordRole.size * base * 0.25;
      est += wordRole.size * base * (p.gap ?? 0.12) * 2;
    }
    return r.size * base * Math.max(0.45, Math.min(1, (0.92 * width) / (est || 1)));
  };
  const roleOf = (w: Word) => (w.key ? p.big : p.small);
  const firstKey = chunk.words.find((w) => w.key);
  const isBehind = (w: Word) => !!w.key && (p.behind === 'all' || (p.behind === 'first' && w === firstKey));
  const hiddenIn = (w: Word) => (layer === 'all' ? false : layer === 'behind' ? !isBehind(w) : isBehind(w));
  const Line: React.FC<{line: Word[]; dx?: number; mt?: number}> = ({line, dx = 0, mt = 0}) => {
    const r0 = roleOf(line[0]);
    const em = emOf(r0, line);
    return (
      <div style={{textAlign: 'center', whiteSpace: 'nowrap', transform: `translateX(${dx * width}px)`, marginTop: mt}}>
        {line.map((w, i) => <WordView key={i} w={w} p={p} hidden={hiddenIn(w)} role={roleOf(w)} em={roleOf(w).size * base * (em / (r0.size * base))} anchor={chunk.start} />)}
      </div>
    );
  };
  const runs: Word[][] = [];
  for (const w of chunk.words) { const l = runs[runs.length - 1]; if (l && !!l[0].key === !!w.key) l.push(w); else runs.push([w]); }

  let body: React.ReactNode;
  if (p.layout === 'line') body = <Line line={chunk.words} />;
  else if (p.layout === 'echo') {
    const keys = chunk.words.filter((w) => w.key);
    const small = chunk.words.map((w) => ({...w, key: false}));
    body = (<>
      <Line line={small} />
      {keys.length > 0 && <Line line={keys} mt={(p.echoOffsetEm ?? -0.8) * p.big.size * base} />}
    </>);
  } else if (p.layout === 'scatter') {
    const dxs = [-0.14, 0.12, -0.04, 0.1];
    body = runs.map((l, i) => <Line key={i} line={l} dx={l[0].key ? 0 : (p.smallDx ? p.smallDx[i % p.smallDx.length] : dxs[i % dxs.length])} mt={i ? -0.2 * roleOf(l[0]).size * base : 0} />);
  } else body = runs.map((l, i) => <Line key={i} line={l} mt={i ? -0.12 * roleOf(l[0]).size * base : 0} />);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{mixBlendMode: p.blend as any, position: 'absolute', left: 0, right: 0, top: `${(p.pos ?? 0.78) * 100}%`, opacity: 0.92, transform: `translateY(-50%) rotate(${p.tilt ? (ci % 2 ? -p.tilt : p.tilt) : 0}deg)`}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4%'}}>
          <div style={p.pill ? {background: p.pill, borderRadius: 0.4 * p.small.size * base, padding: `${0.3 * p.small.size * base}px ${0.5 * p.small.size * base}px`} : undefined}>{body}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- full composition
/** videoSrc = original video. personSrc (optional) = same video with ONLY the person visible on a transparent
 *  background (WebM with alpha). It is drawn on top of the captions so big words sit BEHIND the speaker. */
export const CaptionedVideo: React.FC<{videoSrc: string; personSrc?: string; words: Word[]; presetId?: string}> = ({videoSrc, personSrc, words, presetId = 'neon_duo'}) => {
  const p = PRESETS[presetId];
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <OffthreadVideo src={videoSrc} />
      <PremiumCaptions words={words} presetId={presetId} />
      {p.behindPerson && personSrc ? <OffthreadVideo src={personSrc} transparent muted style={{position: 'absolute', inset: 0}} /> : null}
    </AbsoluteFill>
  );
};
