import React, { useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
// @ts-ignore — модули сцены на чистом JS
import { createFilm } from '../src/film.js';
// @ts-ignore
import { DIALOG, T, lineAt, sceneTime, span, clamp01 } from '../src/timeline.js';
// @ts-ignore
import { sfxCues, voiceCues, MUSIC } from '../src/sound.js';

const FONT = 'system-ui, "Segoe UI", sans-serif';
const COLOR: Record<string, string> = { ty: '#BFE3FF', claude: '#FFC29E' };
const NAME: Record<string, string> = { ty: 'Ты', claude: 'Claude' };

// Хук показывает сцену 38.7→40.6: реплики оттуда звучат и в первые секунды.
const HOOK_FROM = 38.7, HOOK_TO = 40.6;

const Subtitle: React.FC<{ t: number }> = ({ t }) => {
  const st = t < 1.9 ? sceneTime(t) : t;
  const l = t >= 1.9 && t < 3 ? null : lineAt(st);
  if (!l) return null;
  const [who, a, b, text] = l;
  const k = clamp01((st - a) / 0.12), out = clamp01((b - st) / 0.1);
  // Сверху, под шапкой соцсетей: внизу под субтитрами пол, куча предметов и кубик-сжатие.
  // В хуке вверху горит табло тревоги — там субтитры остаются внизу.
  const pos = t < 1.9 ? { bottom: 250 } : { top: 150 };
  return (
    <div style={{ position: 'absolute', left: 50, right: 50, ...pos, display: 'flex', justifyContent: 'center',
      opacity: Math.min(k, out), transform: `translateY(${(1 - k) * -18}px) scale(${0.94 + 0.06 * k})` }}>
      <div style={{ background: 'rgba(20,18,24,0.72)', borderRadius: 26, padding: '16px 30px', maxWidth: 980, textAlign: 'center',
        font: `800 50px/1.16 ${FONT}`, color: '#fff' }}>
        <span style={{ color: COLOR[who] }}>{NAME[who]}: </span>{text}
      </div>
    </div>
  );
};

const Card: React.FC<{ t: number; from: number; to: number; children: React.ReactNode; top?: number }> = ({ t, from, to, children, top = 300 }) => {
  if (t < from || t > to) return null;
  const k = Math.min(clamp01((t - from) / 0.3), clamp01((to - t) / 0.3));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: k,
      transform: `translateY(${(1 - k) * -20}px)` }}>{children}</div>
  );
};

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const canvas = useRef<HTMLCanvasElement>(null);
  const filmRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Строю сцену и считаю физику'));

  useLayoutEffect(() => {
    if (!filmRef.current) filmRef.current = createFilm(canvas.current, { width, height, pixelRatio: 1 });
    setReady(true);
  }, []);
  useLayoutEffect(() => {
    if (!ready) return;
    filmRef.current.render(t);
    continueRender(handle);
  }, [ready, frame]);

  const film = filmRef.current;
  // Перемотка в хуке: полосы, сдвиг, «◀◀».
  const rew = t >= 2.2 && t < 3 ? 1 - Math.abs((t - 2.6) / 0.4) ** 3 : 0;
  const hookFlash = t >= 1.9 && t < 2.6 ? Math.exp(-(t - 1.9) * 7) : 0;
  const pressFlash = t >= T.press.hit && t < T.press.hit + 0.5 ? 0.5 * Math.exp(-(t - T.press.hit) * 8) : 0;
  const eyeFlash = t >= T.flash && t < T.flash + 0.8 ? 0.85 * Math.exp(-(t - T.flash) * 6) : 0;
  const black = clamp01((t - T.black) / 0.45);

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <canvas ref={canvas} width={width} height={height}
        style={{ width, height, filter: rew ? `saturate(${1 - rew * 0.5}) contrast(${1 + rew * 0.25}) hue-rotate(${rew * -12}deg)` : undefined,
          transform: rew ? `translateX(${Math.sin(t * 90) * 10 * rew}px)` : undefined }} />
      {rew > 0 && (
        <AbsoluteFill style={{ opacity: rew,
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 3px, rgba(255,255,255,0.05) 3px 7px)' }}>
          <div style={{ position: 'absolute', top: 110, left: 80, font: `800 64px ${FONT}`, color: '#fff', textShadow: '0 0 12px #000' }}>◀◀ 40:00</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: `${((t * 1.7) % 1) * 100}%`, height: 40, background: 'rgba(255,255,255,0.18)' }} />
        </AbsoluteFill>
      )}
      <Card t={t} from={3.0} to={4.9}>
        <div style={{ font: `800 64px ${FONT}`, color: '#2B211C', background: '#FFF8EE', padding: '18px 40px', borderRadius: 24,
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>40 минут назад</div>
      </Card>
      <Subtitle t={t} />
      <AbsoluteFill style={{ background: '#fff', opacity: Math.max(hookFlash, pressFlash, eyeFlash) }} />
      <AbsoluteFill style={{ background: '#000', opacity: black }} />
      <Card t={t} from={T.black + 0.5} to={99} top={760}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: `800 92px ${FONT}`, color: '#fff' }}>Контекстное окно</div>
          <div style={{ font: `600 44px ${FONT}`, color: '#D97757', marginTop: 28 }}>Сделано вместе с Claude</div>
        </div>
      </Card>

      {film && <Sounds impacts={film.impacts} fps={fps} />}
    </AbsoluteFill>
  );
};

const Sounds: React.FC<{ impacts: any[]; fps: number }> = React.memo(({ impacts, fps }) => {
  const f = (s: number) => Math.round(s * fps);
  const voices = voiceCues();
  // Реплики, попавшие в хук, звучат ещё раз в начале.
  const hook = voices.filter((v: any) => v.at >= HOOK_FROM && v.at < HOOK_TO).map((v: any) => ({ ...v, at: v.at - HOOK_FROM }));
  const cues = [...sfxCues(impacts), ...voices, ...hook];
  return (
    <>
      {cues.map((c: any, i: number) => (
        <Sequence key={i} from={f(c.at)} layout="none">
          <Audio src={staticFile(c.src)} volume={c.vol} />
        </Sequence>
      ))}
      {MUSIC.map(([a, b, vol]: number[], i: number) => (
        <Sequence key={'m' + i} from={f(a)} durationInFrames={f(b - a)} layout="none">
          <Audio src={staticFile('music.wav')} loop
            volume={(fr: number) => vol * Math.min(1, fr / (fps * 1.0), (f(b - a) - fr) / (fps * 1.2))} />
        </Sequence>
      ))}
    </>
  );
});
