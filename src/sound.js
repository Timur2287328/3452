import { DIALOG, T } from './timeline.js';

// Звуковая партитура. Время — время ролика (t), не сцены.
// Хук (0–3 с) проигрывает сцену 38.7→40.6, поэтому сирена, пресс и удар звучат там дважды.
const HOOK = 38.7;

// Реплики: public/voice/NN_ty.wav, NN_claude.wav. Чтобы заменить голос Ты своим — положи файл с тем же именем.
export const voiceFile = i => `voice/${String(i + 1).padStart(2, '0')}_${DIALOG[i][0]}.wav`;
export const voiceCues = () => DIALOG.map(([who, a], i) => ({ src: voiceFile(i), at: a, vol: 1, who }));

const IMPACT = { idea: 'thud_box', laptop: 'clank', bulb: 'glass', duck: 'squeak', weight: 'heavy' };

export function sfxCues(impacts) {
  const c = [];
  const at = (src, t, vol = 1) => c.push({ src: `sfx/${src}.wav`, at: t, vol });
  // Хук.
  at('siren', 0, 0.45);
  at('hydraulic', T.press.drop - HOOK, 0.8);
  at('bam', T.press.hit - HOOK, 1);
  at('rewind', 2.2, 0.8);
  // Удары предметов — из физики.
  let k = 0;
  for (const m of impacts) {
    const vol = Math.min(1, Math.max(0.3, m.v / 6));
    if (m.kind === 'ok') at(`pop${(k++ % 4) + 1}`, m.t, vol * 0.7);
    else at(IMPACT[m.kind], m.t, vol);
  }
  at('door_creak', T.doorOpen, 0.6); at('door_close', T.doorClose + 0.35, 0.7);
  at('boom', T.hourglass, 0.6);
  at('whoosh', T.dodge[0], 0.5);
  T.doorsGrow.forEach(t => at('wood_rise', t, 0.6));
  at('door_creak', T.portal[0], 0.5); at('door_slam', T.portal[1] - 0.15, 0.9);
  at('whoosh', T.puff, 0.35);
  at('siren', T.alarm, 0.45);
  at('hydraulic', T.press.drop, 0.8);
  at('bam', T.press.hit, 1);
  at('hydraulic', T.press.lift, 0.5);
  at('sparkle', 44.3, 0.35);
  at('rustle', T.lift[0], 0.5);
  at('whoosh', T.spin[0], 0.5);
  at('rustle', T.pocket[0], 0.5);
  at('squeak_big', T.squeeze, 1);
  at('sparkle', T.flash, 0.6);
  at('crack', T.crack[0], 0.8);
  at('slowmo', T.burst, 0.9);
  at('marker', T.write[0], 0.7);
  at('whoosh', T.desk - 0.3, 0.3);
  at('squeak', 71.3, 0.8);
  return c;
}

// Музыка: лоу-фай на фоне спокойных частей. [начало, конец, громкость]
export const MUSIC = [[3, T.alarm, 0.22], [T.write[0] - 0.1, T.black + 0.4, 0.22]];
