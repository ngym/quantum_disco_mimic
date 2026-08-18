// 回路グリッド(3行 × 最大15列)のモデルと逐次評価。
// セル: null | { gateId, theta?, target? }
//   R    → theta を保持
//   CNOT → 制御セルに置かれ target(対象行)を保持。対象セルは占有扱い。

import { GATES, THETAS, rMatrix } from './gates.js';
import { createState, applySingle, applyCNOT, applyCCNOT, applyDiffusion, NUM_QUBITS } from './state.js';

export const ROWS = NUM_QUBITS;
export const MAX_COLS = 15;

export function createCircuit(cols = MAX_COLS) {
  return Array.from({ length: ROWS }, () => Array(cols).fill(null));
}

export function numCols(circuit) {
  return circuit[0].length;
}

// この行を制御(C)にしている CNOT のトークン行(=X の行)を返す
export function cnotControlAt(circuit, row, col) {
  for (let r = 0; r < ROWS; r++) {
    const cell = circuit[r][col];
    if (cell && cell.gateId === 'CNOT' && cell.control === row) return r;
  }
  return -1;
}

// 列全体を占有するゲート(CCNOT: 制御2+対象1、G: 3行全体に作用)
export const SPAN_GATES = new Set(['CCNOT', 'G']);

function spanGateInColumn(circuit, col) {
  for (let r = 0; r < ROWS; r++) {
    const cell = circuit[r][col];
    if (cell && SPAN_GATES.has(cell.gateId)) return r;
  }
  return -1;
}

export function cellOccupied(circuit, row, col) {
  return circuit[row][col] !== null
    || cnotControlAt(circuit, row, col) >= 0
    || spanGateInColumn(circuit, col) >= 0;
}

// 空セルに描くマーカー(C = 制御、span = 列全体ゲートの一部)。gateRow はトークンの行。
export function markerAt(circuit, row, col) {
  if (circuit[row][col]) return null;
  for (let r = 0; r < ROWS; r++) {
    const cell = circuit[r][col];
    if (!cell || r === row) continue;
    if (cell.gateId === 'CNOT' && cell.control === row) return { kind: 'control', gateRow: r };
    if (cell.gateId === 'CCNOT') return { kind: 'control', gateRow: r };
    if (cell.gateId === 'G') return { kind: 'span', gateRow: r, label: 'G' };
  }
  return null;
}

export function placeGate(circuit, row, col, gateId) {
  if (row < 0 || row >= ROWS || col < 0 || col >= numCols(circuit)) return false;
  if (cellOccupied(circuit, row, col)) return false;
  if (gateId === 'CNOT') {
    // 置いた行が X(反転される側)、control の行が C
    const control = pickFreeRow(circuit, row, col);
    if (control < 0) return false;
    circuit[row][col] = { gateId, control };
  } else if (gateId === 'CCNOT' || gateId === 'G') {
    // 列全体を占有(CCNOT: 置いた行が X で残りが C、G: 3行まとめて作用)
    for (let r = 0; r < ROWS; r++) {
      if (r !== row && cellOccupied(circuit, r, col)) return false;
    }
    circuit[row][col] = { gateId };
  } else if (gateId === 'R') {
    // 初期値は0以外のランダムな角度 — 「なんで斜めなの?」と興味を引く仕掛け
    const theta = THETAS[1 + Math.floor(Math.random() * (THETAS.length - 1))];
    circuit[row][col] = { gateId, theta };
  } else {
    circuit[row][col] = { gateId };
  }
  return true;
}

function pickFreeRow(circuit, row, col, after = -1) {
  // row 以外の空き行を after より後から巡回で探す
  for (let k = 1; k <= ROWS; k++) {
    const r = (((after < 0 ? row : after) + k) % ROWS);
    if (r === row) continue;
    if (!cellOccupied(circuit, r, col)) return r;
  }
  return -1;
}

export function removeGate(circuit, row, col) {
  circuit[row][col] = null;
}

export function cycleTheta(circuit, row, col) {
  const cell = circuit[row][col];
  if (!cell || cell.gateId !== 'R') return;
  const idx = THETAS.findIndex((t) => Math.abs(t - cell.theta) < 1e-9);
  cell.theta = THETAS[(idx + 1) % THETAS.length];
}

// CNOT の制御(C)の行を切り替える(CCNOT は残り2行が常に制御なので対象外)
export function cycleCnotControl(circuit, row, col) {
  const cell = circuit[row][col];
  if (!cell || cell.gateId !== 'CNOT') return;
  const next = pickFreeRow(circuit, row, col, cell.control);
  if (next >= 0) cell.control = next;
}

// |000⟩ から列順に逐次適用して状態ベクトルを返す。
export function evaluate(circuit, upToCol = Infinity) {
  const state = createState();
  const cols = Math.min(numCols(circuit), upToCol);
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < ROWS; row++) {
      const cell = circuit[row][col];
      if (!cell) continue;
      if (cell.gateId === 'CNOT') {
        applyCNOT(state, cell.control, row);
      } else if (cell.gateId === 'CCNOT') {
        applyCCNOT(state, row);
      } else if (cell.gateId === 'G') {
        applyDiffusion(state);
      } else if (cell.gateId === 'R') {
        applySingle(state, row, rMatrix(cell.theta));
      } else {
        applySingle(state, row, GATES[cell.gateId].matrix);
      }
    }
  }
  return state;
}

// 課題の制約判定用(「X禁止」など)
export function usedGateCounts(circuit) {
  const counts = { X: 0, Y: 0, Z: 0, H: 0, R: 0, CNOT: 0, CCNOT: 0, G: 0 };
  for (const rowCells of circuit) {
    for (const cell of rowCells) {
      if (cell) counts[cell.gateId]++;
    }
  }
  return counts;
}

export function clearCircuit(circuit) {
  for (let r = 0; r < ROWS; r++) circuit[r].fill(null);
}
