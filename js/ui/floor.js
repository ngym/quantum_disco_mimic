// ダンスフロア(Canvas)と確率メーターの描画。
import { SONG_META } from '../audio/songs.js';

const NUM = SONG_META.length;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---- ダンスフロア ----
export function createFloor(canvas, getBeatInfo) {
  const ctx = canvas.getContext('2d');
  const colors = SONG_META.map((m) => hexToRgb(m.color));
  let probs = new Float64Array(NUM);
  probs[0] = 1;
  let rouletteIdx = null;
  let winner = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function draw() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const beat = getBeatInfo();
    // 拍頭で明るく光り、拍の間に減衰する
    const pulse = REDUCED_MOTION ? 0.85 : 1 - 0.35 * Math.min(1, beat.phase * 2.2);

    const rows = 4;
    const gap = Math.max(2, W * 0.004);
    const tileW = (W - gap * (NUM + 1)) / NUM;
    const floorTop = H * 0.42; // 上部はミラーボール・ビーム用の空間
    const tileH = (H - floorTop - gap * (rows + 1)) / rows;

    for (let i = 0; i < NUM; i++) {
      const [r, g, b] = colors[i];
      let alpha = 0.10 + 0.9 * probs[i] * pulse;
      if (winner !== null) alpha = i === winner ? 0.35 + 0.65 * pulse : 0.06;
      for (let row = 0; row < rows; row++) {
        const x = gap + i * (tileW + gap);
        const y = floorTop + gap + row * (tileH + gap);
        // 市松模様の明暗
        const checker = (i + row) % 2 === 0 ? 1 : 0.72;
        ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * checker).toFixed(3)})`;
        ctx.beginPath();
        ctx.roundRect(x, y, tileW, tileH, 4);
        ctx.fill();
      }
      if (rouletteIdx === i || winner === i) {
        ctx.fillStyle = rouletteIdx === i ? 'rgba(255,255,255,0.5)' : `rgba(255,255,255,${0.18 * pulse})`;
        ctx.beginPath();
        ctx.roundRect(gap + i * (tileW + gap), floorTop + gap, tileW, rows * (tileH + gap) - gap, 6);
        ctx.fill();
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  return {
    setProbs(p) { probs = p; },
    setRoulette(i) { rouletteIdx = i; },
    setWinner(i) { winner = i; },
  };
}

// ---- 確率メーター ----
export function createMeter(el) {
  el.innerHTML = '';
  const cols = SONG_META.map((meta) => {
    const col = document.createElement('div');
    col.className = 'meter-col';
    col.innerHTML = `
      <div class="meter-bar-wrap">
        <div class="meter-pct">0%</div>
        <div class="meter-bar" style="background:${meta.color};color:${meta.color}"></div>
        <div class="phase-dial" hidden></div>
      </div>
      <div class="meter-bits">${meta.bits}</div>
      <div class="meter-name">${meta.name}</div>`;
    el.appendChild(col);
    return {
      col,
      bar: col.querySelector('.meter-bar'),
      pct: col.querySelector('.meter-pct'),
      dial: col.querySelector('.phase-dial'),
    };
  });

  return {
    update(probs, phases) {
      for (let i = 0; i < NUM; i++) {
        const p = probs[i];
        cols[i].bar.style.height = `${(p * 100).toFixed(1)}%`;
        cols[i].pct.textContent = `${Math.round(p * 100)}%`;
        const show = p > 1e-4;
        cols[i].dial.hidden = !show;
        if (show) {
          const deg = (phases[i] * 180) / Math.PI;
          const hue = ((phases[i] / (2 * Math.PI)) * 360 + 360) % 360;
          cols[i].dial.style.transform = `rotate(${deg}deg)`;
          cols[i].dial.style.borderColor = `hsl(${hue}, 90%, 65%)`;
          cols[i].dial.style.color = `hsl(${hue}, 90%, 65%)`;
        }
      }
    },
    setRoulette(idx) {
      cols.forEach((c, i) => c.col.classList.toggle('hot', i === idx));
    },
    setWinner(idx) {
      cols.forEach((c, i) => c.col.classList.toggle('winner', i === idx));
    },
  };
}
