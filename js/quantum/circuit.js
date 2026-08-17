// 回路グリッド(3行 × 最大15列)のモデルと逐次評価。
// セル: null | { gateId, theta?, target? }
//   R    → theta を保持
//   CNOT → 制御セルに置かれ target(対象行)を保持。対象セルは占有扱い。

import { GATES, THETAS, rMatrix } from './gates.js';
import { createState, applySingle, applyCNOT, applyCCNOT, NUM_QUBITS } from './state.js';

export const ROWS = NUM_QUBITS;
export const MAX_COLS = 15;

export function createCircuit(cols = MAX_COLS) {
  return Array.from({ length: ROWS }, () => Array(cols).fill(null));
}

export function numCols(circuit) {
  return circuit[0].length;
}

// CNOT の対象(⊕)側として占有されているか
export function cnotTargetAt(circuit, row, col) {
  for (let r = 0; r < ROWS; r++) {
    const cell = circuit[r][col];
    if (cell && cell.gateId === 'CNOT' && cell.target === row) return r;
  }
  return -1;
}

// CCNOT は列全体(制御2+対象1)を占有する
function ccnotInColumn(circuit, col) {
  for (let r = 0; r < ROWS; r++) {
    const cell = circuit[r][col];
    if (cell && cell.gateId === 'CCNOT') return r;
  }
  return -1;
}

export function cellOccupied(circuit, row, col) {
  return circuit[row][col] !== null
    || cnotTargetAt(circuit, row, col) >= 0
    || ccnotInColumn(circuit, col) >= 0;
}

// 空セルに描くマーカー(CNOT/CCNOTの⊕や2つ目の●)。なければ null。
export function markerAt(circuit, row, col) {
  if (circuit[row][col]) return null;
  for (let r = 0; r < ROWS; r++) {
    const cell = circuit[r][col];
    if (!cell || r === row) continue;
    if (cell.gateId === 'CNOT' && cell.target === row) return { kind: 'target', ctrlRow: r };
    if (cell.gateId === 'CCNOT') return { kind: cell.target === row ? 'target' : 'control', ctrlRow: r };
  }
  return null;
}

export function placeGate(circuit, row, col, gateId) {
  if (row < 0 || row >= ROWS || col < 0 || col >= numCols(circuit)) return false;
  if (cellOccupied(circuit, row, col)) return false;
  if (gateId === 'CNOT') {
    const target = pickCnotTarget(circuit, row, col);
    if (target < 0) return false;
    circuit[row][col] = { gateId, target };
  } else if (gateId === 'CCNOT') {
    for (let r = 0; r < ROWS; r++) {
      if (r !== row && cellOccupied(circuit, r, col)) return false;
    }
    circuit[row][col] = { gateId, target: (row + 1) % ROWS };
  } else if (gateId === 'R') {
    // 初期値は0以外のランダムな角度 — 「なんで斜めなの?」と興味を引く仕掛け
    const theta = THETAS[1 + Math.floor(Math.random() * (THETAS.length - 1))];
    circuit[row][col] = { gateId, theta };
  } else {
    circuit[row][col] = { gateId };
  }
  return true;
}

function pickCnotTarget(circuit, row, col, after = -1) {
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

export function cycleCnotTarget(circuit, row, col) {
  const cell = circuit[row][col];
  if (!cell) return;
  if (cell.gateId === 'CCNOT') {
    const others = [...Array(ROWS).keys()].filter((r) => r !== row);
    cell.target = others[(others.indexOf(cell.target) + 1) % others.length];
  } else if (cell.gateId === 'CNOT') {
    const next = pickCnotTarget(circuit, row, col, cell.target);
    if (next >= 0) cell.target = next;
  }
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
        applyCNOT(state, row, cell.target);
      } else if (cell.gateId === 'CCNOT') {
        applyCCNOT(state, cell.target);
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
  const counts = { X: 0, Y: 0, Z: 0, H: 0, R: 0, CNOT: 0, CCNOT: 0 };
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
