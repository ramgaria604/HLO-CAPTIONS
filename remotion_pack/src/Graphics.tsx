import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export type GEvent = {start: number; end: number; type: string; text?: string; keyword?: string; position?: 'top' | 'center' | 'bottom'; src?: string};
export type Palette = {c1: string; c2: string; text: string};
const top = (p?: string) => (p === 'top' ? '18%' : p === 'bottom' ? '80%' : '45%');
const grad = (pal: Palette) => `linear-gradient(90deg,${pal.c1},${pal.c2})`;
const useOut = (e: GEvent) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig(); const n = (e.end - e.start) * fps;
  return interpolate(f, [n - 6, n], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
};

const Kinetic: React.FC<{e: GEvent; pal: Palette}> = ({e, pal}) => {
  const f = useCurrentFrame(); const {fps, width} = useVideoConfig(); const o = useOut(e);
  const s = spring({frame: f, fps, config: {damping: 10, stiffness: 150}});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: top(e.position), textAlign: 'center', opacity: o, transform: `translateY(-50%) scale(${0.5 + 0.5 * s})`}}>
      <span style={{fontFamily: '"Poppins",sans-serif', fontWeight: 900, fontSize: width * 0.12, textTransform: 'uppercase', backgroundImage: grad(pal), WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 6px 0 rgba(0,0,0,.45))'}}>{e.text || e.keyword}</span>
    </div>
  );
};
const LowerThird: React.FC<{e: GEvent; pal: Palette}> = ({e, pal}) => {
  const f = useCurrentFrame(); const {fps, width} = useVideoConfig(); const o = useOut(e);
  const s = spring({frame: f, fps, config: {damping: 16, stiffness: 120}});
  return (
    <div style={{position: 'absolute', left: 0, top: top(e.position === 'top' ? 'top' : 'bottom'), opacity: o, transform: `translateX(${(1 - s) * -100}%)`}}>
      <div style={{background: grad(pal), padding: `${width * 0.02}px ${width * 0.05}px`, borderRadius: '0 999px 999px 0', boxShadow: '0 10px 30px rgba(0,0,0,.35)'}}>
        <span style={{fontFamily: '"Poppins",sans-serif', fontWeight: 800, fontSize: width * 0.05, color: pal.text}}>{e.text || e.keyword}</span>
      </div>
    </div>
  );
};
const Counter: React.FC<{e: GEvent; pal: Palette}> = ({e, pal}) => {
  const f = useCurrentFrame(); const {fps, width} = useVideoConfig(); const o = useOut(e);
  const txt = e.text || e.keyword || '';
  const m = txt.match(/\d[\d,.]*/);
  const target = m ? parseFloat(m[0].replace(/,/g, '')) : 0;
  const s = spring({frame: f, fps, config: {damping: 24, stiffness: 70}});
  const [pre, post] = m ? txt.split(m[0]) : [txt, ''];
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: top(e.position), textAlign: 'center', opacity: o, transform: 'translateY(-50%)'}}>
      <span style={{fontFamily: '"Poppins",sans-serif', fontWeight: 900, fontSize: width * 0.16, backgroundImage: grad(pal), WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 6px 0 rgba(0,0,0,.4))'}}>
        {pre}{Math.round(target * s).toLocaleString()}{post}
      </span>
    </div>
  );
};
const Arrow: React.FC<{e: GEvent; pal: Palette}> = ({e, pal}) => {
  const f = useCurrentFrame(); const {fps, width} = useVideoConfig(); const o = useOut(e);
  const p = interpolate(f, [0, 0.6 * fps], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <svg viewBox="0 0 320 160" style={{position: 'absolute', left: '50%', top: top(e.position), width: width * 0.45, transform: 'translate(-50%,-50%)', opacity: o}}>
      <path d="M 20 130 C 90 10, 210 10, 290 90" fill="none" stroke={pal.c1} strokeWidth="12" strokeLinecap="round" strokeDasharray="420" strokeDashoffset={(1 - p) * 420} />
      {p > 0.9 && <polygon points="270,60 308,96 258,112" fill={pal.c1} />}
    </svg>
  );
};
const EMOJI: Record<string, string> = {money: '💰', cash: '💰', fire: '🔥', hot: '🔥', love: '❤️', home: '🏡', house: '🏡', idea: '💡', time: '⏰', growth: '📈', success: '🏆', win: '🏆', star: '⭐', phone: '📱', warning: '⚠️', check: '✅'};
const Sticker: React.FC<{e: GEvent}> = ({e}) => {
  const f = useCurrentFrame(); const {fps, width} = useVideoConfig(); const o = useOut(e);
  const s = spring({frame: f, fps, config: {damping: 7, stiffness: 180, mass: 0.6}});
  const k = (e.keyword || e.text || '').toLowerCase();
  const em = Object.keys(EMOJI).find((x) => k.includes(x));
  return (
    <div style={{position: 'absolute', left: '50%', top: top(e.position), opacity: o, fontSize: width * 0.2, transform: `translate(-50%,-50%) scale(${s}) rotate(${Math.sin(f / 5) * 6}deg)`}}>{em ? EMOJI[em] : '⭐'}</div>
  );
};
const Broll: React.FC<{e: GEvent}> = ({e}) => {
  const o = useOut(e); const f = useCurrentFrame();
  if (!e.src) return null;
  return <OffthreadVideo src={staticFile(e.src)} muted style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: Math.min(o, Math.min(1, f / 5))}} />;
};

export const GraphicsLayer: React.FC<{events: GEvent[]; pal: Palette}> = ({events, pal}) => {
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {events.filter((e) => e.type !== 'zoom_punch').map((e, i) => (
        <Sequence key={i} from={Math.round(e.start * fps)} durationInFrames={Math.max(1, Math.round((e.end - e.start) * fps))}>
          {e.type === 'kinetic_text' && <Kinetic e={e} pal={pal} />}
          {e.type === 'lower_third' && <LowerThird e={e} pal={pal} />}
          {e.type === 'counter' && <Counter e={e} pal={pal} />}
          {e.type === 'arrow' && <Arrow e={e} pal={pal} />}
          {e.type === 'icon' && <Sticker e={e} />}
          {e.type === 'sticker' && <Sticker e={e} />}
          {e.type === 'broll' && <Broll e={e} />}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** Scale for the video during zoom_punch events (1 = no zoom). */
export const zoomScale = (events: GEvent[], frame: number, fps: number) => {
  let z = 1;
  for (const e of events) {
    if (e.type !== 'zoom_punch') continue;
    const a = e.start * fps, b = e.end * fps;
    if (frame < a || frame > b) continue;
    const mid = (a + b) / 2;
    z = Math.max(z, interpolate(frame, [a, mid, b], [1, 1.14, 1.08], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  }
  return z;
};
