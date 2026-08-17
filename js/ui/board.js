// 回路グリッドのDOM描画と操作(クリック配置 + Pointer Eventsによるドラッグ&ドロップ)。
import { GATES, thetaLabel } from '../quantum/gates.js';
import {
  ROWS, numCols, placeGate, removeGate, cycleTheta, cycleCnotTarget, markerAt,
} from '../quantum/circuit.js';

const DRAG_THRESHOLD = 6;

export function createBoard(boardEl, paletteApi, ghostEl, circuit, callbacks) {
  // callbacks: { onChange(), isLocked() }
  let drag = null;

  function render() {
    boardEl.innerHTML = '';
    const cols = numCols(circuit);
    for (let r = 0; r < ROWS; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'board-row';
      rowEl.style.setProperty('--cols', cols);
      const label = document.createElement('div');
      label.className = 'row-label';
      label.textContent = `q${r}`;
      rowEl.appendChild(label);
      for (let c = 0; c < cols; c++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.dataset.row = r;
        cellEl.dataset.col = c;
        const cell = circuit[r][c];
        if (cell) {
          const tok = makeToken(cell.gateId);
          if (cell.gateId === 'CNOT' || cell.gateId === 'CCNOT') {
            // 盤面では C-(C)-X が縦に並ぶ表示: 置いたトークンは制御「C」
            tok.querySelector('.glyph').textContent = 'C';
          } else if (cell.gateId === 'R') {
            const th = document.createElement('span');
            th.className = 'theta';
            th.textContent = thetaLabel(cell.theta);
            tok.appendChild(th);
            // 選択中のθに合わせて「R」の文字を回転
            const deg = (cell.theta * 180) / Math.PI;
            const glyph = tok.querySelector('.glyph');
            glyph.dataset.rot = deg;
            glyph.style.transform = `rotate(${deg}deg)`;
          }
          cellEl.appendChild(tok);
        } else {
          const marker = markerAt(circuit, r, c);
          if (marker && marker.kind === 'target') {
            const m = document.createElement('div');
            m.className = 'cnot-plus';
            m.dataset.ctrlRow = marker.ctrlRow;
            m.textContent = 'X';
            m.title = '反転される行(タップで切替)';
            cellEl.appendChild(m);
          } else if (marker && marker.kind === 'control') {
            const m = document.createElement('div');
            m.className = 'cnot-ctrl';
            m.dataset.ctrlRow = marker.ctrlRow;
            m.textContent = 'C';
            m.title = 'CCXの2つ目の制御(この行が1のときだけ作動)';
            cellEl.appendChild(m);
          }
        }
        rowEl.appendChild(cellEl);
      }
      boardEl.appendChild(rowEl);
    }
    drawCnotLinks();
  }

  function makeToken(gateId) {
    const g = GATES[gateId];
    const tok = document.createElement('div');
    tok.className = 'gate-token placed-token';
    tok.dataset.gate = gateId;
    tok.style.background = g.color;
    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.textContent = g.label;
    tok.appendChild(glyph);
    tok.title = g.name;
    return tok;
  }

  // CNOTの制御(●)と対象(⊕)を結ぶ縦線
  function drawCnotLinks() {
    const boardRect = boardEl.getBoundingClientRect();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < numCols(circuit); c++) {
        const cell = circuit[r][c];
        if (!cell || (cell.gateId !== 'CNOT' && cell.gateId !== 'CCNOT')) continue;
        // CCNOT は3行すべてを使うので列全体を結ぶ
        const [rowA, rowB] = cell.gateId === 'CCNOT' ? [0, ROWS - 1] : [r, cell.target];
        const ctrlEl = cellAt(rowA, c);
        const tgtEl = cellAt(rowB, c);
        if (!ctrlEl || !tgtEl) continue;
        const a = ctrlEl.getBoundingClientRect();
        const b = tgtEl.getBoundingClientRect();
        const link = document.createElement('div');
        link.className = 'cnot-link';
        const x = a.left + a.width / 2 - boardRect.left - 1.25;
        const top = Math.min(a.top + a.height / 2, b.top + b.height / 2) - boardRect.top;
        const bottom = Math.max(a.top + a.height / 2, b.top + b.height / 2) - boardRect.top;
        link.style.left = `${x}px`;
        link.style.top = `${top}px`;
        link.style.height = `${bottom - top}px`;
        boardEl.appendChild(link);
      }
    }
  }

  function cellAt(row, col) {
    return boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  }

  function cellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.cell') : null;
  }

  function clearDropHints() {
    for (const el of boardEl.querySelectorAll('.drop-hint')) el.classList.remove('drop-hint');
  }

  // ---- Pointer Events ----

  function onPointerDown(e) {
    if (callbacks.isLocked() || e.button === 2) return;
    const palTok = e.target.closest('.palette-token');
    if (palTok) {
      drag = { source: 'palette', gateId: palTok.dataset.gate, startX: e.clientX, startY: e.clientY, moved: false, srcEl: palTok };
      e.preventDefault();
      return;
    }
    const cellEl = e.target.closest('.cell');
    if (cellEl && boardEl.contains(cellEl)) {
      const row = +cellEl.dataset.row;
      const col = +cellEl.dataset.col;
      const tok = e.target.closest('.placed-token');
      const plus = e.target.closest('.cnot-plus, .cnot-ctrl');
      if (tok) {
        drag = { source: 'board', gateId: tok.dataset.gate, row, col, startX: e.clientX, startY: e.clientY, moved: false, srcEl: tok };
        e.preventDefault();
      } else if (plus) {
        drag = { source: 'cnot-plus', ctrlRow: +plus.dataset.ctrlRow, col, startX: e.clientX, startY: e.clientY, moved: false };
        e.preventDefault();
      } else {
        drag = { source: 'cell', row, col, startX: e.clientX, startY: e.clientY, moved: false };
      }
    }
  }

  function onPointerMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      if (drag.source === 'cell' || drag.source === 'cnot-plus') { drag = null; return; }
      drag.moved = true;
      showGhost(drag.gateId);
      if (drag.srcEl) drag.srcEl.classList.add('dragging');
    }
    if (drag.moved) {
      ghostEl.style.left = `${e.clientX}px`;
      ghostEl.style.top = `${e.clientY}px`;
      clearDropHints();
      const cellEl = cellFromPoint(e.clientX, e.clientY);
      if (cellEl) cellEl.classList.add('drop-hint');
      e.preventDefault();
    }
  }

  function onPointerUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    hideGhost();
    clearDropHints();
    if (d.srcEl) d.srcEl.classList.remove('dragging');
    if (callbacks.isLocked()) return;

    let changed = false;
    let rerender = true;
    if (!d.moved) {
      // クリック(タップ)操作
      if (d.source === 'palette') {
        paletteApi.toggleSelect(d.gateId);
      } else if (d.source === 'board') {
        if (d.gateId === 'R') {
          // θを巡回し、再描画せずにその場で「R」を回転(常に前向きに45°ずつ回す)
          cycleTheta(circuit, d.row, d.col);
          const cell = circuit[d.row][d.col];
          const glyph = d.srcEl.querySelector('.glyph');
          const rot = parseFloat(glyph.dataset.rot || '0') + 45;
          glyph.dataset.rot = rot;
          glyph.style.transform = `rotate(${rot}deg)`;
          d.srcEl.querySelector('.theta').textContent = thetaLabel(cell.theta);
          changed = true;
          rerender = false;
        }
        else if (d.gateId === 'CNOT' || d.gateId === 'CCNOT') { cycleCnotTarget(circuit, d.row, d.col); changed = true; }
        else { removeGate(circuit, d.row, d.col); changed = true; }
      } else if (d.source === 'cnot-plus') {
        cycleCnotTarget(circuit, d.ctrlRow, d.col);
        changed = true;
      } else if (d.source === 'cell') {
        const sel = paletteApi.getSelected();
        if (sel) changed = placeGate(circuit, d.row, d.col, sel);
      }
    } else {
      // ドラッグ操作
      const cellEl = cellFromPoint(e.clientX, e.clientY);
      if (d.source === 'palette') {
        if (cellEl) changed = placeGate(circuit, +cellEl.dataset.row, +cellEl.dataset.col, d.gateId);
      } else if (d.source === 'board') {
        const original = circuit[d.row][d.col];
        removeGate(circuit, d.row, d.col);
        if (cellEl) {
          const nr = +cellEl.dataset.row;
          const nc = +cellEl.dataset.col;
          if (!placeGate(circuit, nr, nc, d.gateId)) {
            circuit[d.row][d.col] = original; // 置けなければ元に戻す
          } else if (original.gateId === 'R') {
            circuit[nr][nc].theta = original.theta; // θを引き継ぐ
          }
        }
        changed = true; // 盤外ドロップは削除
      }
    }
    if (changed) {
      if (rerender) render();
      callbacks.onChange();
    }
  }

  function onContextMenu(e) {
    const cellEl = e.target.closest('.cell');
    if (!cellEl || !boardEl.contains(cellEl) || callbacks.isLocked()) return;
    e.preventDefault();
    const row = +cellEl.dataset.row;
    const col = +cellEl.dataset.col;
    if (circuit[row][col]) {
      removeGate(circuit, row, col);
      render();
      callbacks.onChange();
    } else {
      const marker = markerAt(circuit, row, col);
      if (marker) {
        removeGate(circuit, marker.ctrlRow, col);
        render();
        callbacks.onChange();
      }
    }
  }

  function showGhost(gateId) {
    ghostEl.innerHTML = '';
    const tok = makeToken(gateId);
    tok.classList.remove('placed-token');
    ghostEl.appendChild(tok);
    ghostEl.hidden = false;
  }

  function hideGhost() {
    ghostEl.hidden = true;
  }

  paletteApi.el.addEventListener('pointerdown', onPointerDown);
  boardEl.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  boardEl.addEventListener('contextmenu', onContextMenu);

  render();
  return { render };
}
