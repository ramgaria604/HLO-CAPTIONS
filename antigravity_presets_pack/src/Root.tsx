import React from 'react';
import {Composition} from 'remotion';
import {Main, MainProps} from './Main';

const defaults: MainProps = {
  videoSrc: 'input.mp4', personSrc: undefined, words: [], presetId: 'neon_duo', graphics: [],
  palette: {c1: '#FF5A00', c2: '#D81E0A', text: '#FFFFFF'}, autoColor: false,
  durationSec: 10, width: 1080, height: 1920, fps: 30,
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Captioned" component={Main as any} width={1080} height={1920} fps={30} durationInFrames={300}
    defaultProps={defaults}
    calculateMetadata={({props}: any) => ({
      durationInFrames: Math.max(1, Math.ceil(props.durationSec * props.fps)),
      width: props.width, height: props.height, fps: props.fps,
    })}
  />
);
