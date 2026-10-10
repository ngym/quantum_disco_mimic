// レッスン各ステップとトライ各課題の想定解が判定を通ることの検証
import { probabilities, phases } from '../js/quantum/state.js';
import { createCircuit, placeGate, evaluate, usedGateCounts } from '../js/quantum/circuit.js';
import { CHALLENGES } from '../js/courses/challenges.js';
import { LESSON_STEPS } from '../js/courses/lessons.js';
import { check, finish } from './helpers.mjs';

function ctxOf(circ, measured = null) {
  const s = evaluate(circ);
  return { probs: probabilities(s), phases: phases(s), counts: usedGateCounts(circ), measured, sig: JSON.stringify(circ) };
}

function placeR(circ, row, col, theta) {
  placeGate(circ, row, col, 'R');
  circ[row][col].theta = theta;
}

function placeCX(circ, xRow, col, controlRow) {
  placeGate(circ, xRow, col, 'CNOT');
  circ[xRow][col].control = controlRow;
}

// q2 を H で挟んだ CCX(X=q2) = CCZ: 111 だけ位相反転(オラクル)
function placeCCZ(circ, col) {
  placeGate(circ, 2, col, 'H');
  placeGate(circ, 2, col + 1, 'CCNOT');
  placeGate(circ, 2, col + 2, 'H');
}

// --- トライ ---
const solutions = [
  (c) => { placeGate(c, 0, 0, 'X'); placeGate(c, 2, 0, 'X'); },
  (c) => { placeGate(c, 0, 0, 'H'); },
  (c) => { for (let r = 0; r < 3; r++) placeGate(c, r, 0, 'H'); },
  (c) => { for (const r of [1, 2]) { placeGate(c, r, 0, 'H'); placeR(c, r, 1, Math.PI); placeGate(c, r, 2, 'H'); } },
  (c) => { placeGate(c, 0, 0, 'X'); placeGate(c, 1, 0, 'H'); placeR(c, 1, 1, (3 * Math.PI) / 4); placeGate(c, 1, 2, 'H'); },
  (c) => { placeGate(c, 1, 0, 'X'); placeGate(c, 0, 0, 'H'); placeCX(c, 2, 1, 0); },
  (c) => { placeGate(c, 0, 0, 'H'); placeGate(c, 1, 0, 'H'); placeCX(c, 2, 1, 0); placeCX(c, 2, 2, 1); },
  (c) => {
    for (let r = 0; r < 3; r++) placeGate(c, r, 0, 'H');
    placeCCZ(c, 1); placeGate(c, 0, 4, 'G');
    placeCCZ(c, 5); placeGate(c, 0, 8, 'G');
  },
];
check('想定解の数 = 課題数', solutions.length === CHALLENGES.length);
solutions.forEach((build, i) => {
  const c = createCircuit();
  build(c);
  const ctx = ctxOf(c);
  check(`課題${i + 1} の想定解が通る`, CHALLENGES[i].judge(ctx), `probs=${[...ctx.probs].map((x) => x.toFixed(3))}`);
  check(`課題${i + 1} の想定解は許可ゲートだけで組める`,
    Object.entries(ctx.counts).every(([g, n]) => n === 0 || CHALLENGES[i].allowed.includes(g)));
});

// 誤答は通らない
{
  const c = createCircuit();
  for (const r of [0, 1, 2]) placeGate(c, r, 0, 'X');
  check('課題8: X×3 で 111 を 100% にしても不可', !CHALLENGES[7].judge(ctxOf(c)));
  const c4 = createCircuit();
  placeGate(c4, 1, 0, 'X'); placeGate(c4, 2, 0, 'X');
  check('課題4: X を使った解は不可', !CHALLENGES[3].judge(ctxOf(c4)));
}

// --- レッスン ---
const lessonCases = [
  [1, (c) => placeGate(c, 2, 0, 'X'), null],
  [2, (c) => { placeGate(c, 0, 0, 'X'); placeGate(c, 2, 0, 'X'); }, null],
  [3, (c) => { placeGate(c, 0, 0, 'X'); placeGate(c, 2, 0, 'X'); }, 5],
  [4, (c) => placeGate(c, 1, 0, 'H'), null],
  [5, (c) => { for (let r = 0; r < 3; r++) placeGate(c, r, 0, 'H'); }, 3],
  [6, (c) => { placeGate(c, 0, 0, 'H'); placeR(c, 0, 1, Math.PI / 2); }, null],
  [7, (c) => { placeGate(c, 0, 0, 'H'); placeR(c, 0, 1, Math.PI); placeGate(c, 0, 2, 'H'); }, null],
];
for (const [idx, build, measured] of lessonCases) {
  const c = createCircuit();
  build(c);
  check(`レッスン${idx + 1} の想定解が通る`, LESSON_STEPS[idx].check(ctxOf(c, measured)));
}
{
  const c = createCircuit();
  for (let r = 0; r < 3; r++) placeGate(c, r, 0, 'H');
  check('レッスン6: 観測しないと進まない', !LESSON_STEPS[5].check(ctxOf(c, null)));
}

finish();
