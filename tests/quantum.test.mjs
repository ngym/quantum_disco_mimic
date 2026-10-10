// 量子シミュレータ(状態ベクトル・ゲート・回路モデル)の検証
import {
  createState, applySingle, applyCNOT, applyCCNOT, applyDiffusion, probabilities, phases, measure,
} from '../js/quantum/state.js';
import { GATES, rMatrix, THETAS } from '../js/quantum/gates.js';
import {
  createCircuit, placeGate, evaluate, cycleTheta, cycleCnotControl, cellOccupied, markerAt, usedGateCounts,
} from '../js/quantum/circuit.js';
import { check, near, finish } from './helpers.mjs';

// --- 1量子ビットゲート ---
let s = createState();
applySingle(s, 0, GATES.H.matrix);
let p = probabilities(s);
check('H on q0 → 000/100 が50/50', near(p[0], 0.5) && near(p[4], 0.5));

s = createState();
applySingle(s, 0, GATES.H.matrix);
applySingle(s, 0, rMatrix(Math.PI));
applySingle(s, 0, GATES.H.matrix);
check('H R(π) H = X', near(probabilities(s)[4], 1));

s = createState();
applySingle(s, 2, GATES.X.matrix);
check('X on q2 → 001', near(probabilities(s)[1], 1));

s = createState();
applySingle(s, 2, GATES.Y.matrix);
check('Y はビット反転+位相 i', near(probabilities(s)[1], 1) && near(phases(s)[1], Math.PI / 2));

s = createState();
applySingle(s, 0, GATES.H.matrix);
applySingle(s, 0, GATES.Z.matrix);
check('Z は確率を変えず位相 π', near(probabilities(s)[4], 0.5) && near(Math.abs(phases(s)[4]), Math.PI));

s = createState();
applySingle(s, 1, GATES.H.matrix);
applySingle(s, 1, rMatrix((3 * Math.PI) / 4));
applySingle(s, 1, GATES.H.matrix);
check('H R(3π/4) H → p[010] = sin²(3π/8)', near(probabilities(s)[2], Math.sin((3 * Math.PI) / 8) ** 2));

s = createState();
applySingle(s, 0, GATES.H.matrix);
const before = probabilities(s);
applySingle(s, 0, rMatrix(Math.PI / 2));
check('R は確率を変えない', near(before[4], probabilities(s)[4]));
check('R は |1⟩ 成分の位相を回す', near(phases(s)[4], Math.PI / 2));

// --- 多量子ビットゲート ---
s = createState();
applySingle(s, 0, GATES.H.matrix);
applyCNOT(s, 0, 1);
p = probabilities(s);
check('H + CNOT → Bell 状態 000/110', near(p[0], 0.5) && near(p[6], 0.5));

s = createState();
applySingle(s, 0, GATES.X.matrix);
applySingle(s, 1, GATES.X.matrix);
applyCCNOT(s, 2);
check('CCNOT: |110⟩ → |111⟩', near(probabilities(s)[7], 1));

s = createState();
applySingle(s, 0, GATES.X.matrix);
applyCCNOT(s, 2);
check('CCNOT: |100⟩ は不変', near(probabilities(s)[4], 1));

s = createState();
for (let q = 0; q < 3; q++) applySingle(s, q, GATES.H.matrix);
s.re[7] *= -1; // 111 に位相の印
applyDiffusion(s);
p = probabilities(s);
check('拡散1回 → p[111] = sin²(3·arcsin(1/√8))', near(p[7], Math.sin(3 * Math.asin(1 / Math.sqrt(8))) ** 2));
check('拡散はノルムを保つ', near(p.reduce((a, b) => a + b, 0), 1));

// --- 観測 ---
s = createState();
applySingle(s, 0, GATES.H.matrix);
let hits = 0;
const N = 100000;
for (let i = 0; i < N; i++) if (measure(s).outcome === 4) hits++;
check(`観測の統計 ≈ 50% (${(hits / N).toFixed(3)})`, Math.abs(hits / N - 0.5) < 0.01);
const { outcome, state: collapsed } = measure(s);
check('観測で純粋状態に収縮', near(probabilities(collapsed)[outcome], 1));

// --- ランダム回路でもノルム保存 ---
s = createState();
for (let i = 0; i < 50; i++) {
  const q = Math.floor(Math.random() * 3);
  const m = [GATES.H.matrix, GATES.X.matrix, GATES.Y.matrix, rMatrix(Math.random() * 2 * Math.PI)][i % 4];
  applySingle(s, q, m);
  if (i % 7 === 0) applyCCNOT(s, q);
  if (i % 11 === 0) applyDiffusion(s);
}
check('ランダム回路でノルム保存', near(probabilities(s).reduce((a, b) => a + b, 0), 1, 1e-9));

// --- 回路モデル ---
let c = createCircuit();
for (let r = 0; r < 3; r++) placeGate(c, r, 0, 'H');
check('H×3 → 全曲 1/8', probabilities(evaluate(c)).every((x) => near(x, 0.125)));

placeGate(c, 1, 2, 'R');
check('R の初期角度は 0 以外のランダム', c[1][2].theta > 1e-9 && THETAS.some((t) => near(t, c[1][2].theta)));
const t0 = c[1][2].theta;
cycleTheta(c, 1, 2);
check('R のタップで +45°', near(c[1][2].theta, THETAS[(THETAS.findIndex((t) => near(t, t0)) + 1) % THETAS.length]));

// CX: 置いた行が X(対象)、control が C
c = createCircuit();
placeGate(c, 0, 0, 'CNOT');
check('CX の既定の制御は次の行', c[0][0].control === 1);
check('CX の制御セルは占有', cellOccupied(c, 1, 0) && placeGate(c, 1, 0, 'X') === false);
check('CX の制御セルに C マーカー', markerAt(c, 1, 0)?.kind === 'control');
cycleCnotControl(c, 0, 0);
check('CX の制御を切替', c[0][0].control === 2);
c = createCircuit();
placeGate(c, 1, 0, 'X');
placeGate(c, 0, 1, 'CNOT'); // X=q0, C=q1
check('回路上の CX: q1=1 なら q0 反転', near(probabilities(evaluate(c))[6], 1));

// CCX: 置いた行が X、残り2行が C、列全体を占有
c = createCircuit();
placeGate(c, 0, 0, 'X');
placeGate(c, 1, 0, 'X');
check('CCX を置く', placeGate(c, 2, 1, 'CCNOT'));
check('CCX は列全体を占有', cellOccupied(c, 0, 1) && cellOccupied(c, 1, 1));
check('CCX の他の行は C マーカー', markerAt(c, 0, 1)?.kind === 'control' && markerAt(c, 1, 1)?.kind === 'control');
check('回路上の CCX: q0=q1=1 なら q2 反転', near(probabilities(evaluate(c))[7], 1));

// G: 列全体を占有する対称ゲート
c = createCircuit();
check('G を置く', placeGate(c, 1, 0, 'G'));
check('G は列全体を占有', cellOccupied(c, 0, 0) && cellOccupied(c, 2, 0));
check('G の他の行は span マーカー', markerAt(c, 0, 0)?.kind === 'span' && markerAt(c, 2, 0)?.kind === 'span');

const counts = usedGateCounts(c);
check('使用ゲート数の集計', counts.G === 1 && counts.X === 0);

finish();
