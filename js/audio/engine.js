// オーディオエンジン: 8曲の同期ループ再生と、振幅→音量のミキシング。
// 事前レンダリングした AudioBuffer 8本を同一時刻に開始し、
// per-song GainNode で |振幅| を音量に反映する(等パワー: Σgain² = 1 で総音圧一定)。

import { renderAllSongs, BPM, LOOP_SECONDS, SONG_META } from './songs.js';

const NUM_SONGS = SONG_META.length;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = null;
    this.gains = [];
    this.masterGain = null;
    this.masterFilter = null;
    this.startTime = 0;
    this.running = false;
    this.muted = false;
    this.currentMags = new Float64Array(NUM_SONGS);
    this.currentMags[0] = 1;
  }

  get ready() {
    return this.running;
  }

  // ユーザー操作(クリック)ハンドラ内から呼ぶこと(自動再生制限対策)
  async init(onProgress = () => {}) {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx.resume(); // iOS: クリックハンドラ内で同期的に呼ぶ
    this.buffers = await renderAllSongs(this.ctx.sampleRate, onProgress);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    this.masterGain.connect(this.masterFilter).connect(comp).connect(this.ctx.destination);
  }

  start() {
    if (this.running || !this.buffers) return;
    const t0 = this.ctx.currentTime + 0.1;
    this.startTime = t0;
    for (let i = 0; i < NUM_SONGS; i++) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[i];
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = this.currentMags[i];
      src.connect(g).connect(this.masterGain);
      src.start(t0);
      this.gains.push(g);
    }
    this.running = true;
  }

  // mags[i] = |a_i|(√確率)。約80msの時定数で滑らかに追従。
  setMix(mags) {
    this.currentMags = Float64Array.from(mags);
    if (!this.running) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < NUM_SONGS; i++) {
      this.gains[i].gain.setTargetAtTime(mags[i], now, 0.08);
    }
  }

  // 観測演出: ルーレット中はフィルタを絞り+ライザー、確定で当選曲ソロへ。
  async playMeasureFx(winner, spinMs = 2200) {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    const spinSec = spinMs / 1000;

    // フィルタを絞って「タメ」を作る
    this.masterFilter.frequency.cancelScheduledValues(now);
    this.masterFilter.frequency.setValueAtTime(20000, now);
    this.masterFilter.frequency.exponentialRampToValueAtTime(500, now + spinSec * 0.75);
    this.masterFilter.frequency.exponentialRampToValueAtTime(20000, now + spinSec + 0.05);

    // ノイズライザー
    const riser = this.ctx.createOscillator();
    riser.type = 'sawtooth';
    riser.frequency.setValueAtTime(80, now);
    riser.frequency.exponentialRampToValueAtTime(1200, now + spinSec);
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.0001, now);
    rg.gain.exponentialRampToValueAtTime(0.06, now + spinSec * 0.9);
    rg.gain.exponentialRampToValueAtTime(0.0001, now + spinSec + 0.1);
    riser.connect(rg).connect(this.masterGain);
    riser.start(now);
    riser.stop(now + spinSec + 0.15);

    // 確定の瞬間: 当選曲のみへクロスフェード
    const tHit = now + spinSec;
    for (let i = 0; i < NUM_SONGS; i++) {
      this.gains[i].gain.cancelScheduledValues(now);
      this.gains[i].gain.setValueAtTime(this.gains[i].gain.value, now);
      this.gains[i].gain.setTargetAtTime(i === winner ? 1 : 0, tHit, 0.05);
    }
    await new Promise((r) => setTimeout(r, spinMs + 150));
  }

  // 収縮状態から回路編集へ復帰: 現在のミックスに戻す
  releaseMeasurement() {
    this.setMix(this.currentMags);
  }

  // 拍情報(フロアの脈動同期用)
  getBeatInfo() {
    if (!this.running) return { bar: 0, beat: 0, phase: 0, loopPhase: 0 };
    const t = Math.max(0, this.ctx.currentTime - this.startTime);
    const beatLen = 60 / BPM;
    const totalBeats = t / beatLen;
    return {
      bar: Math.floor(totalBeats / 4) % 4,
      beat: Math.floor(totalBeats) % 4,
      phase: totalBeats % 1,          // 拍内位相 0..1
      loopPhase: (t % LOOP_SECONDS) / LOOP_SECONDS,
    };
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }
}
