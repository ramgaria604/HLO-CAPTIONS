/**
 * UniqueCaptions.tsx - 26 completely different caption styles for Remotion (SVG + CSS, no images needed).
 * Each style is its own idea: different layout, motion and look (not just colours).
 * Use:  <UniqueCaptions words={words} styleId="u_ransom_cutout" />   (words = [{t, s, e, key?}], times in seconds)
 */
import React, {useMemo} from 'react';
import {AbsoluteFill, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as fCaveat} from '@remotion/google-fonts/Caveat';
import {loadFont as fBungee} from '@remotion/google-fonts/Bungee';
import {loadFont as fAnton} from '@remotion/google-fonts/Anton';
import {loadFont as fBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as fMonoton} from '@remotion/google-fonts/Monoton';
import {loadFont as fBangers} from '@remotion/google-fonts/Bangers';
import {loadFont as fSpaceMono} from '@remotion/google-fonts/SpaceMono';
import {loadFont as fPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as fLuckiest} from '@remotion/google-fonts/LuckiestGuy';
import {loadFont as fPress} from '@remotion/google-fonts/PressStart2P';
import {loadFont as fMontserrat} from '@remotion/google-fonts/Montserrat';
import {loadFont as fMarker} from '@remotion/google-fonts/PermanentMarker';
import {loadFont as fAbril} from '@remotion/google-fonts/AbrilFatface';
import {loadFont as fPoppins} from '@remotion/google-fonts/Poppins';
import {loadFont as fInter} from '@remotion/google-fonts/Inter';
import {loadFont as fSpecial} from '@remotion/google-fonts/SpecialElite';
fCaveat('normal', {weights: ['700'], subsets: ['latin']}); fBungee('normal', {subsets: ['latin']}); fAnton('normal', {subsets: ['latin']});
fBebas('normal', {subsets: ['latin']}); fMonoton('normal', {subsets: ['latin']}); fBangers('normal', {subsets: ['latin']});
fSpaceMono('normal', {weights: ['700'], subsets: ['latin']}); fPlayfair('italic', {weights: ['600'], subsets: ['latin']}); fLuckiest('normal', {subsets: ['latin']});
fPress('normal', {subsets: ['latin']}); fMontserrat('normal', {weights: ['800', '900'], subsets: ['latin']}); fMarker('normal', {subsets: ['latin']});
fAbril('normal', {subsets: ['latin']}); fPoppins('normal', {weights: ['700', '800'], subsets: ['latin']}); fInter('normal', {weights: ['700'], subsets: ['latin']}); fSpecial('normal', {subsets: ['latin']});

export type UWord = {t: string; s: number; e: number; key?: boolean};

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const STOP = new Set('a an and are as at be but by for from had has have he her his i if in is it its me my no not of on or our she so that the their them they this to us was we were what when who will with you your just very can get got'.split(' '));
export const isKey = (w: UWord) => w.key ?? (w.t.replace(/[^\p{L}]/gu, '').length >= 5 && !STOP.has(w.t.toLowerCase().replace(/[^\p{L}']/gu, '')));
const ring = (c: string, px: number) => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([x, y]) => `${x * px}px ${y * px}px 0 ${c}`).join(',');
const PAL = ['#FF4D6D', '#FFD23B', '#3BD6FF', '#7CFF6B', '#B28BFF'];

type Ctx = {
  page: UWord[]; idx: number; t: number; frame: number; fps: number; W: number; H: number; u: number;
  age: (i: number) => number;                 // frames since word i started
  sp: (i: number, damping?: number, stiffness?: number) => number;   // spring (0 -> 1, overshoots) since word i started
  pageAge: number; pageProg: number;
};
type Def = {id: string; name: string; tagline: string; wpp: number; render: (c: Ctx) => React.ReactNode};

const Center: React.FC<{y: number; children: React.ReactNode; style?: React.CSSProperties}> = ({y, children, style}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top: `${y * 100}%`, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)', ...style}}>{children}</div>
);
const Defs: React.FC = () => (
  <svg width="0" height="0" style={{position: 'absolute'}}>
    <filter id="u-chalk"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="4" /></filter>
    <filter id="u-rough"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="9" /></filter>
    <filter id="u-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b" /><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" /></filter>
  </svg>
);
const EMOJI: Record<string, string> = {love: '❤️', money: '💰', cash: '💵', price: '🏷️', fire: '🔥', hot: '🔥', home: '🏠', house: '🏠', kitchen: '🍳', happy: '😊', great: '👍', best: '🏆', win: '🏆', idea: '💡', time: '⏰', fast: '⚡', free: '🎁', new: '✨', star: '⭐', call: '📞', phone: '📱', video: '🎬', camera: '📸', music: '🎵', food: '🍕', coffee: '☕', car: '🚗', travel: '✈️', beach: '🏖️', sun: '☀️', night: '🌙', work: '💼', business: '💼', growth: '📈', sale: '🏷️', secret: '🤫', wow: '🤯', crazy: '🤪', shock: '😱', magic: '🪄', gift: '🎁', key: '🔑', keys: '🔑', pool: '🏊', garden: '🌿', family: '👨‍👩‍👧', dream: '💭', luxury: '💎', diamond: '💎', gold: '🥇', health: '💪', strong: '💪', smart: '🧠', brain: '🧠', heart: '❤️', laugh: '😂', party: '🎉', celebrate: '🎉', warning: '⚠️', stop: '🛑', check: '✅', yes: '✅', problem: '🚨', learn: '📚', book: '📖', question: '❓', eyes: '👀', look: '👀', watch: '👀', top: '🔝'};
const emojiFor = (w: string) => EMOJI[w.toLowerCase().replace(/[^a-z]/g, '')];
const star = (n: number, ro: number, ri: number) => Array.from({length: n * 2}, (_, i) => { const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? ri : ro; return `${(260 + Math.cos(a) * r).toFixed(1)},${(260 + Math.sin(a) * r).toFixed(1)}`; }).join(' ');

const DEFS: Def[] = [
  {id: 'u_ink_scribble', name: 'Ink & Scribble', tagline: 'handwriting wipes in, key words get a hand-drawn underline', wpp: 3, render: (c) => (
    <Center y={0.72}><div style={{display: 'flex', gap: 22 * c.u, fontFamily: 'Caveat', fontWeight: 700, fontSize: 130 * c.u, color: '#fff', textShadow: `0 ${4 * c.u}px ${14 * c.u}px rgba(0,0,0,.55)`}}>
      {c.page.map((w, i) => { const a = i > c.idx ? 0 : clamp(c.age(i) / 9); const p = clamp((c.age(i) - 6) / 14);
        return (<span key={i} style={{position: 'relative', opacity: i > c.idx ? 0 : 1, clipPath: `inset(-30% ${(1 - a) * 100}% -30% 0)`}}>{w.t}
          {isKey(w) && <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{position: 'absolute', left: 0, right: 0, bottom: -4 * c.u, width: '100%', height: 26 * c.u, overflow: 'visible'}}><path d="M2 12 Q 22 0 42 11 T 98 8" pathLength={1} fill="none" stroke="#FFD23B" strokeWidth={5 * c.u} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - p} /></svg>}</span>); })}
    </div></Center>)},
  {id: 'u_letter_wave', name: 'Rainbow Wave', tagline: 'every letter bobs on a wave and cycles through colours', wpp: 3, render: (c) => (
    <Center y={0.7}><div style={{display: 'flex', gap: 30 * c.u, fontFamily: 'Bungee', fontSize: 100 * c.u}}>
      {c.page.map((w, wi) => (<span key={wi} style={{display: 'inline-flex', opacity: wi > c.idx ? 0.3 : 1, transform: `scale(${wi === c.idx ? 1 + 0.12 * Math.min(1, c.sp(wi)) : 1})`}}>
        {w.t.split('').map((ch, li) => (<span key={li} style={{color: `hsl(${(li * 32 + wi * 60 + c.frame * 5) % 360} 95% 62%)`, transform: `translateY(${Math.sin(c.frame * 0.26 + li * 0.7 + wi) * 16 * c.u}px)`, textShadow: `0 ${6 * c.u}px 0 rgba(0,0,0,.35)`}}>{ch}</span>))}</span>))}
    </div></Center>)},
  {id: 'u_ransom_cutout', name: 'Ransom Cut-outs', tagline: 'every word is a paper cut-out tile with its own font, colour and tilt', wpp: 3, render: (c) => {
    const fonts = ['Playfair Display', 'Space Mono', 'Anton', 'Bangers', 'Abril Fatface', 'Special Elite'], bgs = ['#FFFFFF', '#FFE14D', '#FF6B9A', '#59D6FF', '#B6FF6B'];
    return (<Center y={0.68}><div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14 * c.u, maxWidth: '90%'}}>
      {c.page.map((w, i) => { if (i > c.idx) return null; const r = random(`rs${w.t}${w.s}`), s = Math.min(1, c.sp(i, 11, 200)); const rot = (r * 12 - 6) + (1 - s) * 25;
        return <span key={i} style={{fontFamily: fonts[Math.floor(r * 99) % fonts.length], background: bgs[Math.floor(r * 77) % bgs.length], color: '#111', fontSize: (70 + r * 30) * c.u, padding: `${6 * c.u}px ${18 * c.u}px`, transform: `rotate(${rot}deg) scale(${0.4 + 0.6 * s})`, boxShadow: `${5 * c.u}px ${7 * c.u}px 0 rgba(0,0,0,.45)`, lineHeight: 1.1}}>{w.t}</span>; })}
    </div></Center>); }},
  {id: 'u_news_bar', name: 'Breaking News Bar', tagline: 'TV news lower-third with a red LIVE tag that slides in', wpp: 6, render: (c) => {
    const s = Math.min(1, spring({frame: Math.max(0, c.pageAge), fps: c.fps, config: {damping: 16, stiffness: 120}}));
    return (<div style={{position: 'absolute', left: '5%', right: '5%', top: '82%', display: 'flex', alignItems: 'stretch', transform: `translateX(${(1 - s) * -110}%)`, boxShadow: `0 ${10 * c.u}px ${30 * c.u}px rgba(0,0,0,.5)`}}>
      <div style={{background: '#D90429', color: '#fff', fontFamily: 'Anton', fontSize: 46 * c.u, padding: `${10 * c.u}px ${26 * c.u}px`, letterSpacing: 2 * c.u, display: 'flex', alignItems: 'center', gap: 10 * c.u}}><span style={{width: 16 * c.u, height: 16 * c.u, borderRadius: 99, background: '#fff', opacity: 0.4 + 0.6 * (c.frame % 20 < 10 ? 1 : 0)}} />LIVE</div>
      <div style={{flex: 1, background: '#fff', color: '#111', fontFamily: 'Bebas Neue', fontSize: 62 * c.u, padding: `${6 * c.u}px ${24 * c.u}px`, textTransform: 'uppercase', display: 'flex', alignItems: 'center', letterSpacing: 1 * c.u}}>{c.page.slice(0, c.idx + 1).map((w) => w.t).join(' ')}</div>
    </div>); }},
  {id: 'u_neon_sign', name: 'Flickering Neon Sign', tagline: 'glowing sign in a dark box that flickers like real neon', wpp: 3, render: (c) => {
    const fl = random(`fl${Math.floor(c.frame / 3)}`) > 0.94 ? 0.5 : 1;
    return (<Center y={0.72}><div style={{opacity: fl, padding: `${22 * c.u}px ${50 * c.u}px`, background: 'rgba(8,4,20,.72)', borderRadius: 26 * c.u, border: `${4 * c.u}px solid #ff63d8`, boxShadow: `0 0 ${24 * c.u}px #ff2bd6, inset 0 0 ${24 * c.u}px #ff2bd6`}}>
      <span style={{fontFamily: 'Monoton', fontSize: 90 * c.u, color: '#fff', textShadow: `0 0 ${6 * c.u}px #fff, 0 0 ${22 * c.u}px #ff2bd6, 0 0 ${48 * c.u}px #ff2bd6, 0 0 ${90 * c.u}px #7a2bff`}}>{c.page.slice(0, c.idx + 1).map((w) => w.t).join(' ')}</span></div></Center>); }},
  {id: 'u_glitch_rgb', name: 'RGB Glitch', tagline: 'one huge word with red/cyan split that tears when it appears', wpp: 1, render: (c) => {
    const g = c.age(c.idx) < 7 || random(`g${Math.floor(c.frame / 2)}`) > 0.93, o = (g ? 14 : 4) * c.u, w = c.page[c.idx]; const base: React.CSSProperties = {position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', fontFamily: 'Anton', fontSize: 200 * c.u, textTransform: 'uppercase', whiteSpace: 'nowrap'};
    return (<Center y={0.5}><div style={{position: 'relative'}}><div style={{...base, position: 'relative', opacity: 0, inset: undefined}}>{w.t}</div>
      <div style={{...base, color: '#ff0a45', transform: `translateX(${-o}px)`, clipPath: g ? `inset(${random(`a${c.frame}`) * 50}% 0 ${random(`b${c.frame}`) * 40}% 0)` : undefined, mixBlendMode: 'screen'}}>{w.t}</div>
      <div style={{...base, color: '#00f0ff', transform: `translateX(${o}px)`, clipPath: g ? `inset(${random(`c${c.frame}`) * 40}% 0 ${random(`d${c.frame}`) * 50}% 0)` : undefined, mixBlendMode: 'screen'}}>{w.t}</div>
      <div style={{...base, color: '#fff', textShadow: `0 0 ${20 * c.u}px rgba(0,0,0,.6)`}}>{w.t}</div></div></Center>); }},
  {id: 'u_comic_burst', name: 'Comic Burst', tagline: 'each word explodes inside a pop-art starburst with halftone dots', wpp: 1, render: (c) => {
    const s = Math.min(1.4, c.sp(c.idx, 8, 220)), w = c.page[c.idx], size = 560 * c.u;
    return (<Center y={0.5}><div style={{position: 'relative', width: size, height: size, transform: `rotate(-7deg) scale(${0.2 + 0.8 * s})`}}>
      <svg viewBox="0 0 520 520" width={size} height={size}><defs><pattern id="u-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="5" fill="#FF9F1C" /></pattern></defs>
        <polygon points={star(16, 250, 190)} fill="#000" transform="translate(12 14)" /><polygon points={star(16, 250, 190)} fill="#FFE14D" stroke="#111" strokeWidth="10" strokeLinejoin="round" /><polygon points={star(16, 250, 190)} fill="url(#u-dots)" opacity=".7" /></svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bangers', fontSize: (w.t.length > 7 ? 92 : 130) * c.u, color: '#E4002B', textShadow: ring('#111', 5 * c.u), letterSpacing: 2 * c.u, textTransform: 'uppercase'}}>{w.t}</div></div></Center>); }},
  {id: 'u_typewriter', name: 'Terminal Typewriter', tagline: 'dark terminal bar, text types letter by letter with a blinking cursor', wpp: 5, render: (c) => {
    const done = c.page.slice(0, c.idx).map((w) => w.t).join(' '), cur = c.page[c.idx].t, n = Math.min(cur.length, Math.floor(c.age(c.idx) * 1.3) + 1);
    return (<Center y={0.8}><div style={{background: 'rgba(8,10,14,.88)', borderRadius: 18 * c.u, padding: `${20 * c.u}px ${34 * c.u}px`, fontFamily: 'Space Mono', fontWeight: 700, fontSize: 52 * c.u, color: '#7CFFB2', boxShadow: `0 0 0 ${3 * c.u}px #1f2a33, 0 ${14 * c.u}px ${40 * c.u}px rgba(0,0,0,.5)`}}>
      <span style={{color: '#FF5EA8'}}>{'> '}</span>{done} {cur.slice(0, n)}<span style={{display: 'inline-block', width: 26 * c.u, height: 52 * c.u, background: '#7CFFB2', marginLeft: 6 * c.u, verticalAlign: 'middle', opacity: Math.floor(c.frame / 8) % 2 ? 0 : 1}} /></div></Center>); }},
  {id: 'u_karaoke_fill', name: 'Karaoke Sweep', tagline: 'colour sweeps across each word as it is spoken, music note + progress bar', wpp: 5, render: (c) => (
    <Center y={0.76}><div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 * c.u}}>
      <div style={{display: 'flex', gap: 22 * c.u, alignItems: 'center', fontFamily: 'Poppins', fontWeight: 800, fontSize: 72 * c.u}}>
        <span style={{fontSize: 56 * c.u, transform: `translateY(${Math.sin(c.frame * 0.3) * 8 * c.u}px)`}}>🎵</span>
        {c.page.map((w, i) => { const p = i < c.idx ? 1 : i === c.idx ? clamp((c.t - w.s) / Math.max(0.2, w.e - w.s)) : 0;
          return (<span key={i} style={{position: 'relative', display: 'inline-block', color: 'rgba(255,255,255,.5)', textShadow: `0 ${4 * c.u}px ${12 * c.u}px rgba(0,0,0,.6)`}}>{w.t}
            <span style={{position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', background: 'linear-gradient(90deg,#FF5E9C,#FFB84D)', WebkitBackgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`}}>{w.t}</span></span>); })}</div>
      <div style={{width: 560 * c.u, height: 8 * c.u, borderRadius: 9, background: 'rgba(255,255,255,.25)', overflow: 'hidden'}}><div style={{width: `${c.pageProg * 100}%`, height: '100%', background: 'linear-gradient(90deg,#FF5E9C,#FFB84D)'}} /></div></div></Center>)},
  {id: 'u_highlighter_box', name: 'Pop Highlight Box', tagline: 'the spoken word jumps into a bright rounded box', wpp: 4, render: (c) => (
    <Center y={0.74}><div style={{display: 'flex', gap: 14 * c.u, fontFamily: 'Montserrat', fontWeight: 800, fontSize: 76 * c.u}}>
      {c.page.map((w, i) => { const a = i === c.idx, s = a ? Math.min(1.2, c.sp(i, 9, 240)) : 1;
        return <span key={i} style={{padding: `${4 * c.u}px ${20 * c.u}px`, borderRadius: 22 * c.u, background: a ? '#FFE14D' : 'transparent', color: a ? '#111' : '#fff', transform: `scale(${a ? 0.8 + 0.2 * s + 0.08 : 1}) rotate(${a ? -2 : 0}deg)`, textShadow: a ? 'none' : `0 ${4 * c.u}px ${14 * c.u}px rgba(0,0,0,.7)`, opacity: i > c.idx ? 0.55 : 1}}>{w.t}</span>; })}</div></Center>)},
  {id: 'u_rubber_squash', name: 'Rubber Squash', tagline: 'one word at a time that squashes and stretches like rubber', wpp: 1, render: (c) => {
    const s = c.sp(c.idx, 6, 170), sx = 1 + (1 - s) * 0.9, sy = 0.4 + 0.6 * s;
    return (<Center y={0.55}><span style={{display: 'inline-block', fontFamily: 'Anton', fontSize: 210 * c.u, textTransform: 'uppercase', color: '#FFE600', textShadow: ring('#111', 9 * c.u) + `, 0 ${12 * c.u}px 0 #111`, transform: `scale(${sx}, ${sy}) skewX(${(1 - s) * -10}deg)`, transformOrigin: '50% 100%'}}>{c.page[c.idx].t}</span></Center>); }},
  {id: 'u_film_serif', name: 'Cinema Serif', tagline: 'letterbox bars, italic serif that fades from blur to sharp', wpp: 6, render: (c) => {
    const bar = Math.min(1, c.pageAge / 8) * 11;
    return (<><div style={{position: 'absolute', left: 0, right: 0, top: 0, height: `${bar}%`, background: '#000'}} /><div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${bar}%`, background: '#000'}} />
      <Center y={0.86}><div style={{display: 'flex', gap: 16 * c.u, fontFamily: 'Playfair Display', fontStyle: 'italic', fontWeight: 600, fontSize: 62 * c.u, color: '#F3E9DC'}}>
        {c.page.map((w, i) => { const a = i > c.idx ? 0 : clamp(c.age(i) / 12); return <span key={i} style={{opacity: a, filter: `blur(${(1 - a) * 9 * c.u}px)`, letterSpacing: `${(1 - a) * 0.2}em`, textShadow: `0 ${3 * c.u}px ${12 * c.u}px rgba(0,0,0,.8)`}}>{w.t}</span>; })}</div></Center></>); }},
  {id: 'u_sticker_peel', name: 'Sticker Words', tagline: 'thick white sticker outlines, random tilt, slap-on entrance', wpp: 3, render: (c) => (
    <Center y={0.68}><div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16 * c.u, maxWidth: '92%', fontFamily: 'Luckiest Guy', fontSize: 112 * c.u}}>
      {c.page.map((w, i) => { if (i > c.idx) return null; const s = Math.min(1, c.sp(i, 10, 210)), r = random(`st${w.t}${w.s}`) * 10 - 5;
        return <span key={i} style={{color: PAL[i % PAL.length], textShadow: ring('#fff', 7 * c.u) + `, 0 ${12 * c.u}px ${16 * c.u}px rgba(0,0,0,.5)`, transform: `translateY(${(1 - s) * 70 * c.u}px) rotate(${r - (1 - s) * 14}deg) scale(${0.6 + 0.4 * s})`}}>{w.t}</span>; })}</div></Center>)},
  {id: 'u_chalkboard', name: 'Chalkboard', tagline: 'wooden-frame blackboard, rough chalk letters, yellow chalk key words', wpp: 4, render: (c) => (
    <Center y={0.78}><div style={{background: '#1f3a2e', border: `${12 * c.u}px solid #8b5a2b`, borderRadius: 14 * c.u, padding: `${22 * c.u}px ${44 * c.u}px`, boxShadow: `inset 0 0 ${60 * c.u}px rgba(0,0,0,.55), 0 ${14 * c.u}px ${30 * c.u}px rgba(0,0,0,.5)`}}>
      <div style={{display: 'flex', gap: 20 * c.u, fontFamily: 'Caveat', fontWeight: 700, fontSize: 92 * c.u, filter: 'url(#u-chalk)'}}>
        {c.page.map((w, i) => (<span key={i} style={{opacity: i > c.idx ? 0 : 1, color: isKey(w) ? '#FFE27A' : '#F4F7F2', textDecoration: isKey(w) ? 'underline wavy' : 'none', textDecorationThickness: 4 * c.u}}>{w.t}</span>))}</div></div></Center>)},
  {id: 'u_arcade', name: 'Retro Arcade', tagline: 'pixel font, stepped 8-bit shadow, letters appear in chunky steps', wpp: 3, render: (c) => {
    const shown = c.page.map((w, i) => (i < c.idx ? w.t : i === c.idx ? w.t.slice(0, Math.min(w.t.length, Math.floor(c.age(i) / 1.5) + 1)) : '')).filter(Boolean).join(' ');
    return (<Center y={0.74}><div style={{background: 'rgba(10,0,30,.82)', padding: `${24 * c.u}px ${40 * c.u}px`, border: `${6 * c.u}px solid #FF2E88`, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 3px, transparent 3px 7px)'}}>
      <span style={{fontFamily: 'Press Start 2P', fontSize: 52 * c.u, color: '#FFE600', textTransform: 'uppercase', textShadow: `${4 * c.u}px ${4 * c.u}px 0 #FF2E88, ${8 * c.u}px ${8 * c.u}px 0 #5A1E96`}}>{shown}</span></div></Center>); }},
  {id: 'u_mirror_floor', name: 'Mirror Floor', tagline: 'big word rises and reflects on a glossy floor', wpp: 2, render: (c) => {
    const s = Math.min(1, c.sp(c.idx, 14, 120)), t = c.page.slice(0, c.idx + 1).map((w) => w.t).join(' ');
    const st: React.CSSProperties = {fontFamily: 'Montserrat', fontWeight: 900, fontSize: 150 * c.u, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1};
    return (<Center y={0.56}><div style={{transform: `translateY(${(1 - s) * 50 * c.u}px)`, opacity: s}}>
      <div style={{...st, background: 'linear-gradient(180deg,#fff 0%,#cfd6e6 55%,#8e98b4 100%)', WebkitBackgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent'}}>{t}</div>
      <div style={{...st, transform: 'scaleY(-1)', marginTop: 6 * c.u, opacity: 0.4, color: '#cfd6e6', WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,.7), transparent 55%)', maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.7), transparent 55%)'}}>{t}</div></div></Center>); }},
  {id: 'u_liquid_goo', name: 'Gooey Liquid', tagline: 'letters rise like blobs of liquid and melt together', wpp: 3, render: (c) => (
    <Center y={0.7}><div style={{filter: 'url(#u-goo)', display: 'flex', gap: 34 * c.u, fontFamily: 'Poppins', fontWeight: 800, fontSize: 130 * c.u, color: '#FF3D81'}}>
      {c.page.map((w, wi) => (<span key={wi} style={{display: 'inline-flex', opacity: wi > c.idx ? 0 : 1}}>
        {w.t.split('').map((ch, li) => { const s = spring({frame: Math.max(0, c.age(wi) - li * 1.5), fps: c.fps, config: {damping: 9, stiffness: 110}}); return <span key={li} style={{transform: `translateY(${(1 - s) * 120 * c.u}px) scale(${0.5 + 0.5 * Math.min(s, 1.15)})`}}>{ch}</span>; })}</span>))}</div></Center>)},
  {id: 'u_spotlight', name: 'Spotlight', tagline: 'the video darkens and a spotlight reveals the words', wpp: 3, render: (c) => {
    const r = 300 * c.u + Math.sin(c.frame * 0.08) * 24 * c.u;
    return (<><div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 62%, rgba(0,0,0,0) ${r}px, rgba(0,0,0,.72) ${r + 340 * c.u}px)`}} />
      <Center y={0.62}><div style={{display: 'flex', gap: 24 * c.u, fontFamily: 'Abril Fatface', fontSize: 124 * c.u, color: '#FFF6DC', textShadow: `0 0 ${30 * c.u}px rgba(255,236,170,.65)`}}>{c.page.map((w, i) => (<span key={i} style={{opacity: i > c.idx ? 0 : clamp(c.age(i) / 7), transform: `scale(${0.9 + 0.1 * clamp(c.age(i) / 7)})`}}>{w.t}</span>))}</div></Center></>); }},
  {id: 'u_marker_swipe', name: 'Highlighter Swipe', tagline: 'a rough yellow marker swipes behind the key words', wpp: 4, render: (c) => (
    <Center y={0.72}><div style={{display: 'flex', gap: 22 * c.u, fontFamily: 'Permanent Marker', fontSize: 86 * c.u}}>
      {c.page.map((w, i) => { const k = isKey(w), p = i > c.idx ? 0 : clamp((c.age(i) - 2) / 8);
        return (<span key={i} style={{position: 'relative', opacity: i > c.idx ? 0 : 1, padding: `0 ${10 * c.u}px`}}>
          {k && <span style={{position: 'absolute', left: 0, top: '14%', bottom: '4%', width: `${p * 100}%`, background: '#FFE14D', transform: 'rotate(-1.5deg)', filter: 'url(#u-rough)', zIndex: 0}} />}
          <span style={{position: 'relative', zIndex: 1, color: k ? '#111' : '#fff', textShadow: k ? 'none' : ring('#111', 4 * c.u)}}>{w.t}</span></span>); })}</div></Center>)},
  {id: 'u_chat_bubble', name: 'Chat Bubble', tagline: 'typing dots, then the words appear inside a message bubble', wpp: 5, render: (c) => {
    const s = Math.min(1, spring({frame: Math.max(0, c.pageAge), fps: c.fps, config: {damping: 13, stiffness: 160}})), typing = c.pageAge < 7;
    return (<Center y={0.78}><div style={{position: 'relative', background: '#0A84FF', borderRadius: 44 * c.u, padding: `${22 * c.u}px ${40 * c.u}px`, transform: `translateY(${(1 - s) * 60 * c.u}px) scale(${0.7 + 0.3 * s})`, transformOrigin: '0% 100%', boxShadow: `0 ${10 * c.u}px ${30 * c.u}px rgba(0,0,0,.4)`, minWidth: 150 * c.u}}>
      <div style={{position: 'absolute', left: 10 * c.u, bottom: -12 * c.u, width: 40 * c.u, height: 40 * c.u, background: '#0A84FF', transform: 'rotate(45deg)', borderRadius: 6 * c.u, zIndex: -1}} />
      {typing ? <div style={{display: 'flex', gap: 10 * c.u, height: 60 * c.u, alignItems: 'center'}}>{[0, 1, 2].map((d) => <span key={d} style={{width: 18 * c.u, height: 18 * c.u, borderRadius: 99, background: '#cfe6ff', transform: `translateY(${Math.sin(c.frame * 0.5 + d) * 8 * c.u}px)`}} />)}</div>
        : <span style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 56 * c.u, color: '#fff'}}>{c.page.slice(0, c.idx + 1).map((w) => w.t).join(' ')}</span>}</div></Center>); }},
  {id: 'u_fill_up', name: 'Fill-Up Outline', tagline: 'outlined word that fills with colour from the bottom as it is spoken', wpp: 2, render: (c) => {
    const w = c.page[c.idx], p = clamp((c.t - w.s) / Math.max(0.25, w.e - w.s)); const st: React.CSSProperties = {fontFamily: 'Anton', fontSize: 190 * c.u, textTransform: 'uppercase', whiteSpace: 'nowrap', gridArea: '1 / 1', lineHeight: 1.05};
    return (<Center y={0.55}><div style={{display: 'grid'}}>
      <div style={{...st, color: 'transparent', WebkitTextStroke: `${4 * c.u}px #fff`, filter: `drop-shadow(0 ${6 * c.u}px ${12 * c.u}px rgba(0,0,0,.5))`}}>{w.t}</div>
      <div style={{...st, background: 'linear-gradient(0deg,#00E0FF,#7A5CFF)', WebkitBackgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', clipPath: `inset(${(1 - p) * 100}% 0 0 0)`}}>{w.t}</div></div></Center>); }},
  {id: 'u_anaglyph_3d', name: '3D Anaglyph', tagline: 'red/cyan 3D glasses effect with a slow perspective swing', wpp: 2, render: (c) => {
    const t = c.page.slice(0, c.idx + 1).map((w) => w.t).join(' '); const st: React.CSSProperties = {fontFamily: 'Montserrat', fontWeight: 900, fontSize: 130 * c.u, textTransform: 'uppercase', whiteSpace: 'nowrap', position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', mixBlendMode: 'screen'};
    return (<Center y={0.6}><div style={{position: 'relative', padding: `${30 * c.u}px ${60 * c.u}px`, background: 'rgba(0,0,0,.6)', borderRadius: 20 * c.u, transform: `perspective(${900 * c.u}px) rotateY(${Math.sin(c.frame * 0.05) * 14}deg)`}}>
      <span style={{...st, position: 'relative', opacity: 0}}>{t}</span><span style={{...st, color: '#ff2a2a', transform: `translateX(${-7 * c.u}px)`}}>{t}</span><span style={{...st, color: '#2af0ff', transform: `translateX(${7 * c.u}px)`}}>{t}</span><span style={{...st, color: '#fff', opacity: 0.85}}>{t}</span></div></Center>); }},
  {id: 'u_ribbon', name: 'Unfurling Ribbon', tagline: 'a red banner unrolls and the words appear in gold', wpp: 3, render: (c) => {
    const s = Math.min(1, spring({frame: Math.max(0, c.pageAge), fps: c.fps, config: {damping: 13, stiffness: 100}}));
    return (<Center y={0.78}><div style={{position: 'relative', transform: `scaleX(${0.15 + 0.85 * s})`, opacity: Math.min(1, s * 3)}}>
      <div style={{position: 'absolute', left: -30 * c.u, right: -30 * c.u, top: 14 * c.u, bottom: -14 * c.u, background: '#7d0f20', clipPath: 'polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%)'}} />
      <div style={{position: 'relative', background: 'linear-gradient(180deg,#E63950,#B3122B)', padding: `${14 * c.u}px ${70 * c.u}px`, boxShadow: `0 ${8 * c.u}px ${20 * c.u}px rgba(0,0,0,.45)`}}>
        <span style={{fontFamily: 'Abril Fatface', fontSize: 78 * c.u, color: '#FFE9A8', textShadow: `0 ${3 * c.u}px 0 #6a0a18`, transform: `scaleX(${1 / (0.15 + 0.85 * s)})`, display: 'inline-block'}}>{c.page.slice(0, c.idx + 1).map((w) => w.t).join(' ')}</span></div></div></Center>); }},
  {id: 'u_emoji_pop', name: 'Emoji Reactor', tagline: 'understands key words (money, home, fire…) and pops a matching emoji', wpp: 4, render: (c) => {
    let em = ''; let ei = 0; c.page.forEach((w, i) => { if (i <= c.idx && emojiFor(w.t)) { em = emojiFor(w.t)!; ei = i; } });
    const s = em ? Math.min(1.3, c.sp(ei, 7, 200)) : 0;
    return (<><Center y={0.58}><div style={{fontSize: 190 * c.u, transform: `translateY(${Math.sin(c.frame * 0.15) * 10 * c.u}px) scale(${s}) rotate(${(1 - Math.min(1, s)) * -25}deg)`, filter: `drop-shadow(0 ${10 * c.u}px ${20 * c.u}px rgba(0,0,0,.5))`}}>{em}</div></Center>
      <Center y={0.8}><div style={{display: 'flex', gap: 18 * c.u, fontFamily: 'Poppins', fontWeight: 800, fontSize: 70 * c.u, color: '#fff', textShadow: ring('#111', 4 * c.u)}}>{c.page.map((w, i) => <span key={i} style={{opacity: i > c.idx ? 0 : 1}}>{w.t}</span>)}</div></Center></>); }},
  {id: 'u_poster_cascade', name: 'Poster Cascade', tagline: 'words stack like a poster, each line a different colour sized to fill the width', wpp: 3, render: (c) => (
    <div style={{position: 'absolute', left: '6%', right: '6%', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', lineHeight: 0.92}}>
      {c.page.map((w, i) => { if (i > c.idx) return null; const s = Math.min(1, c.sp(i, 14, 140)), size = clamp(1760 / Math.max(3, w.t.length), 110, 270) * c.u;
        return <div key={i} style={{fontFamily: 'Anton', textTransform: 'uppercase', fontSize: size, color: PAL[i % PAL.length], transform: `translateX(${(1 - s) * -120}%)`, textShadow: `${6 * c.u}px ${6 * c.u}px 0 rgba(0,0,0,.55)`, whiteSpace: 'nowrap'}}>{w.t}</div>; })}</div>)},
  {id: 'u_glass_aurora', name: 'Aurora Glass Pill', tagline: 'frosted-glass pill with a rotating rainbow border', wpp: 4, render: (c) => (
    <Center y={0.8}><div style={{padding: 5 * c.u, borderRadius: 999, background: `conic-gradient(from ${c.frame * 4}deg,#ff5ea8,#ffd24d,#4dffb0,#4dc8ff,#b65eff,#ff5ea8)`, boxShadow: `0 0 ${40 * c.u}px rgba(182,94,255,.55)`}}>
      <div style={{borderRadius: 999, padding: `${20 * c.u}px ${48 * c.u}px`, background: 'rgba(20,16,30,.62)', backdropFilter: `blur(${14 * c.u}px)`}}>
        <span style={{fontFamily: 'Poppins', fontWeight: 700, fontSize: 58 * c.u, color: '#fff'}}>{c.page.slice(0, c.idx + 1).map((w) => w.t).join(' ')}</span></div></div></Center>)},
];

export const UNIQUE_STYLES = DEFS.map(({id, name, tagline, wpp}) => ({id, name, tagline, wpp}));
export const isUnique = (id?: string) => !!id && DEFS.some((d) => d.id === id);

const chunk = (words: UWord[], wpp: number): UWord[][] => {
  const out: UWord[][] = []; let cur: UWord[] = [];
  for (const w of words) {
    const last = cur[cur.length - 1];
    if (last && (cur.length >= wpp || w.s - last.e > 0.7 || (/[.!?]$/.test(last.t) && cur.length >= 2))) { out.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
};

export const UniqueCaptions: React.FC<{words: UWord[]; styleId: string}> = ({words, styleId}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const def = DEFS.find((d) => d.id === styleId) ?? DEFS[0];
  const pages = useMemo(() => chunk(words, def.wpp), [words, def.wpp]);
  const t = frame / fps;
  let page: UWord[] | null = null;
  for (const p of pages) if (t >= p[0].s - 0.02 && t < p[p.length - 1].e + 0.3) page = p;
  if (!page) return null;
  let idx = 0; page.forEach((w, i) => { if (w.s <= t + 0.001) idx = i; });
  const first = page[0].s, last = page[page.length - 1].e;
  const ctx: Ctx = {
    page, idx, t, frame, fps, W, H, u: Math.min(W, H) / 1080,
    age: (i) => (t - page![i].s) * fps,
    sp: (i, damping = 12, stiffness = 180) => spring({frame: Math.max(0, (t - page![i].s) * fps), fps, config: {damping, stiffness}}),
    pageAge: (t - first) * fps, pageProg: clamp((t - first) / Math.max(0.3, last - first)),
  };
  return (<AbsoluteFill style={{pointerEvents: 'none'}}><Defs />{def.render(ctx)}</AbsoluteFill>);
};
