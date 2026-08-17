// 音源部品。OfflineAudioContext / AudioContext のどちらでも使える純関数群。
// すべて時刻 t (秒) にワンショットのイベントを書き込む。

export function makeNoiseBuffer(ctx, seconds = 1) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function kick(ctx, dest, t, { gain = 1, pitch = 150, dur = 0.28 } = {}) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur);
}

export function snare(ctx, dest, t, noiseBuf, { gain = 0.8, tone = 190 } = {}) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const nf = ctx.createBiquadFilter();
  nf.type = 'highpass';
  nf.frequency.value = 1200;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(gain, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  noise.connect(nf).connect(ng).connect(dest);
  noise.start(t);
  noise.stop(t + 0.2);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(tone, t);
  const og = ctx.createGain();
  og.gain.setValueAtTime(gain * 0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(og).connect(dest);
  osc.start(t);
  osc.stop(t + 0.12);
}

export function hat(ctx, dest, t, noiseBuf, { open = false, gain = 0.3 } = {}) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  const dur = open ? 0.3 : 0.05;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(f).connect(g).connect(dest);
  noise.start(t);
  noise.stop(t + dur + 0.02);
}

export function rim(ctx, dest, t, { gain = 0.35 } = {}) {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 820;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.05);
}

// 単音。filterFreq を渡すとローパスをかける(acid風など)。
export function tone(ctx, dest, t, {
  freq, dur = 0.25, type = 'sawtooth', gain = 0.3,
  attack = 0.005, release = 0.05, filterFreq = 0, filterQ = 1, detune = 0,
} = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, t + dur);
  let node = osc;
  if (filterFreq > 0) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    f.Q.value = filterQ;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function chordStab(ctx, dest, t, freqs, { dur = 0.3, gain = 0.16, type = 'triangle' } = {}) {
  for (const f of freqs) tone(ctx, dest, t, { freq: f, dur, gain, type, attack: 0.003, release: dur * 0.6 });
}

export function pad(ctx, dest, t, freqs, { dur = 4, gain = 0.06, type = 'sawtooth' } = {}) {
  for (const f of freqs) {
    tone(ctx, dest, t, { freq: f, dur, gain, type, attack: dur * 0.25, release: dur * 0.35, filterFreq: 1600, detune: 4 });
    tone(ctx, dest, t, { freq: f, dur, gain, type, attack: dur * 0.25, release: dur * 0.35, filterFreq: 1600, detune: -4 });
  }
}

// 音名 → 周波数
const NOTE_BASE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
export function noteFreq(name) {
  // 例: 'A2', 'C#3'
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) throw new Error('bad note: ' + name);
  const semis = NOTE_BASE[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, semis / 12);
}
