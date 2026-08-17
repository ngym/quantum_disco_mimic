// 8曲の定義とオフラインレンダリング。
// 全曲 120BPM・4小節 = ちょうど8.000秒・Aマイナーペンタトニック(A C D E G)基調。
// どの重ね合わせミックスでも拍と和声が破綻しないように音域と音色を配分している。

import {
  makeNoiseBuffer, kick, snare, hat, rim, tone, chordStab, pad, noteFreq as N,
} from './synth.js';

export const BPM = 120;
export const LOOP_SECONDS = 8; // 4小節
const STEP = 60 / BPM / 4;     // 16分音符 = 0.125s
const BAR = STEP * 16;         // 2s

export const SONG_META = [
  { index: 0, bits: '000', name: 'ディスコ',        color: '#ff4d9d' },
  { index: 1, bits: '001', name: 'ファンク',        color: '#ff9d38' },
  { index: 2, bits: '010', name: 'テクノ',          color: '#ffe14d' },
  { index: 3, bits: '011', name: 'ハウス',          color: '#7dff6a' },
  { index: 4, bits: '100', name: 'チルアウト',      color: '#38ffd0' },
  { index: 5, bits: '101', name: 'エレクトロポップ', color: '#38c6ff' },
  { index: 6, bits: '110', name: 'ヒップホップ',    color: '#9d6aff' },
  { index: 7, bits: '111', name: 'ドラムンベース',  color: '#ff6af0' },
];

// pattern: 16文字/小節。'.' 以外の文字でコールバック(文字はアクセント等に使える)
function steps(pattern, cb) {
  for (let bar = 0; bar < 4; bar++) {
    const pat = Array.isArray(pattern) ? pattern[bar % pattern.length] : pattern;
    for (let i = 0; i < 16; i++) {
      const ch = pat[i];
      if (ch && ch !== '.') cb(bar * BAR + i * STEP, ch, bar, i);
    }
  }
}

function panned(ctx, dest, panValue) {
  const p = ctx.createStereoPanner();
  p.pan.value = panValue;
  p.connect(dest);
  return p;
}

// 小節ごとのコード進行(ルート+構成音はすべてペンタトニック内)
const PROG = [
  { root: 'A2', chord: ['A3', 'C4', 'E4'] },
  { root: 'A2', chord: ['A3', 'C4', 'E4'] },
  { root: 'C3', chord: ['C4', 'E4', 'G4'] },
  { root: 'G2', chord: ['G3', 'D4', 'G4'] },
];

const SONG_BUILDERS = [
  // 000 ディスコ
  (ctx, out, noise) => {
    const hatBus = panned(ctx, out, 0.25);
    steps('x...x...x...x...', (t) => kick(ctx, out, t, { gain: 0.9 }));
    steps('..o...o...o...o.', (t) => hat(ctx, hatBus, t, noise, { open: true, gain: 0.22 }));
    steps('....x.......x...', (t) => snare(ctx, out, t, noise, { gain: 0.5 }));
    steps('x.x.x.x.x.x.x.x.', (t, ch, bar, i) => {
      const root = N(PROG[bar].root);
      tone(ctx, out, t, { freq: i % 4 === 2 ? root * 2 : root, dur: 0.22, type: 'sawtooth', gain: 0.22, filterFreq: 900 });
    });
    for (let bar = 0; bar < 4; bar++) {
      pad(ctx, panned(ctx, out, -0.2), bar * BAR, PROG[bar].chord.map(N), { dur: BAR, gain: 0.045 });
    }
  },

  // 001 ファンク
  (ctx, out, noise) => {
    steps('x..x..x...x.....', (t) => kick(ctx, out, t, { gain: 0.85, pitch: 130 }));
    steps('....x.......x..s', (t, ch) => snare(ctx, out, t, noise, { gain: ch === 's' ? 0.25 : 0.55 }));
    steps('xxxxxxxxxxxxxxxx', (t, ch, bar, i) => hat(ctx, panned(ctx, out, 0.2), t, noise, { gain: i % 2 ? 0.1 : 0.16 }));
    const bassLine = [[0, 'A2'], [3, 'A2'], [6, 'G2'], [8, 'A2'], [11, 'C3'], [14, 'D3']];
    for (let bar = 0; bar < 4; bar++) {
      for (const [i, note] of bassLine) {
        tone(ctx, out, bar * BAR + i * STEP, { freq: N(note), dur: 0.2, type: 'square', gain: 0.16, filterFreq: 700 });
      }
    }
    steps('..x.......x.....', (t) => chordStab(ctx, panned(ctx, out, -0.25), t, [N('A3'), N('D4'), N('G4')], { dur: 0.12, gain: 0.1, type: 'sawtooth' }));
  },

  // 010 テクノ
  (ctx, out, noise) => {
    steps('x...x...x...x...', (t) => kick(ctx, out, t, { gain: 0.95, pitch: 160 }));
    steps('....x.......x...', (t) => snare(ctx, out, t, noise, { gain: 0.35, tone: 240 }));
    steps('xxxxxxxxxxxxxxxx', (t, ch, bar, i) => hat(ctx, panned(ctx, out, -0.2), t, noise, { gain: i % 2 ? 0.14 : 0.07 }));
    const seq = ['A2', 'A2', 'C3', 'A2', 'E3', 'A2', 'G3', 'A3', 'A2', 'C3', 'A2', 'E3', 'G2', 'A2', 'C3', 'E3'];
    steps('xxxxxxxxxxxxxxxx', (t, ch, bar, i) => {
      // ループ全体でフィルタが開いて閉じる acid 風スイープ
      const sweep = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / LOOP_SECONDS);
      tone(ctx, out, t, {
        freq: N(seq[i]), dur: 0.12, type: 'sawtooth', gain: 0.17,
        filterFreq: 250 + 2600 * sweep, filterQ: 8,
      });
    });
  },

  // 011 ハウス
  (ctx, out, noise) => {
    steps('x...x...x...x...', (t) => kick(ctx, out, t, { gain: 0.9, pitch: 140 }));
    steps('..o...o...o...o.', (t) => hat(ctx, panned(ctx, out, 0.3), t, noise, { open: true, gain: 0.18 }));
    steps('x.xx.x..x.xx.x..', (t) => hat(ctx, panned(ctx, out, 0.1), t, noise, { gain: 0.09 }));
    steps('..x...x....x....', (t, ch, bar) => {
      const chord = bar % 2 ? ['C4', 'E4', 'G4', 'A4'] : ['A3', 'C4', 'E4', 'G4'];
      chordStab(ctx, panned(ctx, out, -0.2), t, chord.map(N), { dur: 0.18, gain: 0.09, type: 'triangle' });
    });
    steps('..x...x...x...x.', (t, ch, bar) => {
      tone(ctx, out, t, { freq: N(PROG[bar].root), dur: 0.2, type: 'sine', gain: 0.3 });
    });
  },

  // 100 チルアウト
  (ctx, out, noise) => {
    steps('x.......x.......', (t) => kick(ctx, out, t, { gain: 0.4, pitch: 100, dur: 0.4 }));
    steps('....x.......x...', (t) => rim(ctx, panned(ctx, out, 0.3), t, { gain: 0.12 }));
    for (let bar = 0; bar < 4; bar++) {
      const chord = bar === 2 ? ['C4', 'E4', 'G4'] : ['A3', 'C4', 'E4', 'G4'];
      pad(ctx, out, bar * BAR, chord.map(N), { dur: BAR, gain: 0.05 });
    }
    const arp = ['A4', 'C5', 'E5', 'G5', 'E5', 'C5', 'A4', 'G4'];
    steps('x.x.x.x.x.x.x.x.', (t, ch, bar, i) => {
      tone(ctx, panned(ctx, out, Math.sin(t) * 0.4), t, { freq: N(arp[(i / 2) % 8]), dur: 0.5, type: 'sine', gain: 0.09, attack: 0.02, release: 0.3 });
    });
  },

  // 101 エレクトロポップ
  (ctx, out, noise) => {
    steps('x...x...x...x...', (t) => kick(ctx, out, t, { gain: 0.8 }));
    steps('....x.......x...', (t) => snare(ctx, out, t, noise, { gain: 0.5, tone: 210 }));
    steps('..x...x...x...x.', (t) => hat(ctx, panned(ctx, out, 0.25), t, noise, { gain: 0.15 }));
    const melody = [
      ['A4', 'C5', 'E5', 'C5', 'A4', 'G4', 'A4', null],
      ['A4', 'C5', 'E5', 'C5', 'D5', 'C5', 'A4', null],
      ['C5', 'D5', 'E5', 'G5', 'E5', 'D5', 'C5', null],
      ['G4', 'A4', 'C5', 'D5', 'C5', 'A4', 'G4', 'A4'],
    ];
    steps('x.x.x.x.x.x.x.x.', (t, ch, bar, i) => {
      const note = melody[bar][i / 2];
      if (note) tone(ctx, panned(ctx, out, -0.15), t, { freq: N(note), dur: 0.2, type: 'square', gain: 0.08, filterFreq: 3500 });
    });
    steps('x...x...x...x...', (t, ch, bar) => {
      tone(ctx, out, t, { freq: N(PROG[bar].root), dur: 0.4, type: 'triangle', gain: 0.22 });
    });
  },

  // 110 ヒップホップ(ハーフタイム)
  (ctx, out, noise) => {
    steps('x.....x...x.....', (t) => kick(ctx, out, t, { gain: 1.0, pitch: 120, dur: 0.35 }));
    steps('........x.......', (t) => snare(ctx, out, t, noise, { gain: 0.65, tone: 170 }));
    steps('x.x.x.x.x.x.x.xx', (t, ch, bar, i) => {
      const swing = i % 4 === 2 ? 0.03 : 0; // 軽いスウィング
      hat(ctx, panned(ctx, out, -0.25), t + swing, noise, { gain: 0.13 });
    });
    const subs = [[0, 'A1', 1.4], [12, 'G1', 0.5], [16, 'A1', 1.4], [28, 'C2', 0.5], [32, 'A1', 1.4], [44, 'G1', 0.5], [48, 'A1', 0.9], [56, 'D2', 0.9]];
    for (const [i, note, dur] of subs) {
      tone(ctx, out, i * STEP, { freq: N(note), dur, type: 'sine', gain: 0.4, attack: 0.01, release: 0.2 });
    }
  },

  // 111 ドラムンベース
  (ctx, out, noise) => {
    steps('x....x....x..x..', (t) => kick(ctx, out, t, { gain: 0.85, pitch: 170, dur: 0.2 }));
    steps('....x..s....x..s', (t, ch) => snare(ctx, out, t, noise, { gain: ch === 's' ? 0.2 : 0.6, tone: 220 }));
    steps('xxxxxxxxxxxxxxxx', (t, ch, bar, i) => hat(ctx, panned(ctx, out, 0.2), t, noise, { gain: i % 4 === 0 ? 0.18 : 0.09 }));
    const bassSeq = [[0, 'A1'], [6, 'A1'], [10, 'C2'], [14, 'G1']];
    for (let bar = 0; bar < 4; bar++) {
      for (const [i, note] of bassSeq) {
        tone(ctx, out, bar * BAR + i * STEP, { freq: N(note), dur: 0.45, type: 'sine', gain: 0.38, attack: 0.008, release: 0.15 });
        tone(ctx, out, bar * BAR + i * STEP, { freq: N(note) * 2, dur: 0.3, type: 'sawtooth', gain: 0.07, filterFreq: 500 });
      }
    }
  },
];

// 1曲をオフラインレンダリングして AudioBuffer を返す
export async function renderSong(index, sampleRate = 44100) {
  const ctx = new OfflineAudioContext(2, Math.floor(sampleRate * LOOP_SECONDS), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  const noise = makeNoiseBuffer(ctx, 1);
  SONG_BUILDERS[index](ctx, master, noise);
  return ctx.startRendering();
}

export async function renderAllSongs(sampleRate = 44100, onProgress = () => {}) {
  const buffers = [];
  for (let i = 0; i < SONG_BUILDERS.length; i++) {
    onProgress(i, SONG_BUILDERS.length);
    // 逐次レンダリング(低スペック端末でUIを固めないため+進捗表示)
    buffers.push(await renderSong(i, sampleRate));
    await new Promise((r) => setTimeout(r, 0));
  }
  onProgress(SONG_BUILDERS.length, SONG_BUILDERS.length);
  return buffers;
}
