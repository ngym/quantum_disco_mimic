// 3量子ビットの状態ベクトル。
// 基底インデックス i = q0<<2 | q1<<1 | q2 (q0 = 盤面の最上段 = 最上位ビット)。
// 曲番号(2進数表示)とそのまま対応する。

export const NUM_QUBITS = 3;
export const DIM = 1 << NUM_QUBITS; // 8

export function createState() {
  const s = { re: new Float64Array(DIM), im: new Float64Array(DIM) };
  s.re[0] = 1; // |000⟩
  return s;
}

export function clone(s) {
  return { re: Float64Array.from(s.re), im: Float64Array.from(s.im) };
}

const maskForQubit = (qubit) => 1 << (NUM_QUBITS - 1 - qubit);

// 2x2ユニタリ行列 m = [[m00, m01], [m10, m11]](各要素は [re, im])を
// 指定量子ビットに作用させる(in-place)。
export function applySingle(s, qubit, m) {
  const mask = maskForQubit(qubit);
  const [[a, b], [c, d]] = m;
  for (let i = 0; i < DIM; i++) {
    if (i & mask) continue;
    const j = i | mask;
    const x0r = s.re[i], x0i = s.im[i];
    const x1r = s.re[j], x1i = s.im[j];
    s.re[i] = a[0] * x0r - a[1] * x0i + b[0] * x1r - b[1] * x1i;
    s.im[i] = a[0] * x0i + a[1] * x0r + b[0] * x1i + b[1] * x1r;
    s.re[j] = c[0] * x0r - c[1] * x0i + d[0] * x1r - d[1] * x1i;
    s.im[j] = c[0] * x0i + c[1] * x0r + d[0] * x1i + d[1] * x1r;
  }
}

// CNOT: control が |1⟩ のとき target を反転(in-place)。
export function applyCNOT(s, control, target) {
  const cMask = maskForQubit(control);
  const tMask = maskForQubit(target);
  for (let i = 0; i < DIM; i++) {
    if ((i & cMask) && !(i & tMask)) {
      const j = i | tMask;
      let tmp = s.re[i]; s.re[i] = s.re[j]; s.re[j] = tmp;
      tmp = s.im[i]; s.im[i] = s.im[j]; s.im[j] = tmp;
    }
  }
}

// CCNOT(トフォリ): target 以外の2ビットが両方 |1⟩ のとき target を反転(in-place)。
export function applyCCNOT(s, target) {
  const tMask = maskForQubit(target);
  const cMask = (DIM - 1) ^ tMask; // 残り2ビットが制御
  for (let i = 0; i < DIM; i++) {
    if ((i & cMask) === cMask && !(i & tMask)) {
      const j = i | tMask;
      let tmp = s.re[i]; s.re[i] = s.re[j]; s.re[j] = tmp;
      tmp = s.im[i]; s.im[i] = s.im[j]; s.im[j] = tmp;
    }
  }
}

export function probabilities(s) {
  const p = new Float64Array(DIM);
  for (let i = 0; i < DIM; i++) p[i] = s.re[i] * s.re[i] + s.im[i] * s.im[i];
  return p;
}

// 各基底の位相角(振幅がほぼ0なら0)。UIの色相表示用。
export function phases(s) {
  const ph = new Float64Array(DIM);
  for (let i = 0; i < DIM; i++) {
    const mag = s.re[i] * s.re[i] + s.im[i] * s.im[i];
    ph[i] = mag < 1e-12 ? 0 : Math.atan2(s.im[i], s.re[i]);
  }
  return ph;
}

// 観測: 確率に基づき1つの基底をサンプリングし、収縮後の状態を返す。
export function measure(s, rand = Math.random) {
  const p = probabilities(s);
  const r = rand();
  let acc = 0;
  let outcome = DIM - 1;
  for (let i = 0; i < DIM; i++) {
    acc += p[i];
    if (r < acc) { outcome = i; break; }
  }
  const collapsed = { re: new Float64Array(DIM), im: new Float64Array(DIM) };
  collapsed.re[outcome] = 1;
  return { outcome, state: collapsed };
}
