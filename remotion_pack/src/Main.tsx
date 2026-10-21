import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {PRESETS, PremiumCaptions, Word, recolor} from './CaptionPresets';
import {UniqueCaptions, isUnique} from './UniqueCaptions';
import {GEvent, GraphicsLayer, Palette, zoomScale} from './Graphics';

export type MainProps = {
  videoSrc: string; personSrc?: string; words: Word[]; presetId: string; graphics: GEvent[];
  palette: Palette; autoColor: boolean; durationSec: number; width: number; height: number; fps: number;
};

export const Main: React.FC<MainProps> = ({videoSrc, personSrc, words, presetId, graphics, palette, autoColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const isUni = isUnique(presetId);
  const base = PRESETS[presetId] ?? PRESETS.neon_duo;
  const preset = autoColor ? recolor(base, palette.c1, palette.c2) : base;
  const useBehind = !isUni && !!personSrc && (preset.behind === 'first' || preset.behind === 'all');
  const z = zoomScale(graphics, frame, fps);
  const fill: React.CSSProperties = {position: 'absolute', inset: 0, transform: `scale(${z})`};
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <div style={fill}><OffthreadVideo src={staticFile(videoSrc)} style={{width: '100%', height: '100%', objectFit: 'contain'}} /></div>
      {useBehind ? <PremiumCaptions words={words} preset={preset} layer="behind" /> : null}
      {useBehind ? <div style={fill}><OffthreadVideo src={staticFile(personSrc as string)} transparent muted style={{width: '100%', height: '100%', objectFit: 'contain'}} /></div> : null}
      {isUni ? (
        <UniqueCaptions words={words} styleId={presetId} />
      ) : (
        <PremiumCaptions words={words} preset={preset} layer={useBehind ? 'front' : 'all'} />
      )}
      <GraphicsLayer events={graphics} pal={palette} />
    </AbsoluteFill>
  );
};
