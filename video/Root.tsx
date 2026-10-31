import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
// @ts-ignore — модули сцены на чистом JS
import { FPS, DURATION } from '../src/timeline.js';

export const Root: React.FC = () => (
  <Composition id="Film" component={Film} durationInFrames={DURATION * FPS} fps={FPS} width={1080} height={1920} />
);
