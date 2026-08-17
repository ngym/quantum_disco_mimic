// 回路グリッドのDOM描画と操作(クリック配置 + Pointer Eventsによるドラッグ&ドロップ)。
import { GATES, thetaLabel } from '../quantum/gates.js';
import {
  ROWS, numCols, placeGate, removeGate, cycleTheta, cycleCnotControl, markerAt, cellOccupied,
} from '../quantum/circuit.js';

const DRAG_THRESHOLD = 6;

export function createBoard(boardEl, paletteApi, ghostEl, circuit, callbacks) {
  // callbacks: { onChange(), isLocked() }
  let drag = null;
  let selection = new Set(); // 範囲選択中のセル "r,c"(まとめて移動用)
  const keyOf = (r, c) => `${r},${c}`;

  function render() {
    // 消えたゲートを選択から外す
    for (const key of [...selection]) {
      const [r, c] = key.split(',').map(Number);
      if (!circuit[r][c]) selection.delete(key);
    }
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
            // 置いた行が X(反転される側)。縦線の先に C マーカーが並ぶ
            tok.querySelector('.glyph').textContent = 'X';
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
          if (selection.has(keyOf(r, c))) tok.classList.add('multi-selected');
          cellEl.appendChild(tok);
        } else {
          const marker = markerAt(circuit, r, c);
          if (marker) {
            const m = document.createElement('div');
            m.className = 'cnot-ctrl';
            m.dataset.gateRow = marker.gateRow;
            m.textContent = 'C';
            m.title = '制御: この行が1のときだけ X が反転(CXはタップで行を切替)';
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
        const [rowA, rowB] = cell.gateId === 'CCNOT' ? [0, ROWS - 1] : [r, cell.control];
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
    const direct = el ? el.closest('.cell') : null;
    if (direct && boardEl.contains(direct)) return direct;
    // セル間の隙間や境界線上に落ちた場合は、近くのセルにスナップする
    const TOLERANCE = 14;
    let best = null;
    let bestDist = Infinity;
    for (const cellEl of boardEl.querySelectorAll('.cell')) {
      const rect = cellEl.getBoundingClientRect();
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const d = Math.hypot(dx, dy);
      if (d < bestDist) { bestDist = d; best = cellEl; }
    }
    return bestDist <= TOLERANCE ? best : null;
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
      const ctrl = e.target.closest('.cnot-ctrl');
      if (tok) {
        const source = selection.has(keyOf(row, col)) ? 'group' : 'board';
        drag = { source, gateId: tok.dataset.gate, row, col, startX: e.clientX, startY: e.clientY, moved: false, srcEl: tok };
        e.preventDefault();
      } else if (ctrl) {
        drag = { source: 'marker', gateRow: +ctrl.dataset.gateRow, col, startX: e.clientX, startY: e.clientY, moved: false };
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
      if (drag.source === 'marker') { drag = null; return; }
      drag.moved = true;
      if (drag.source === 'cell') {
        // 空きマスからのドラッグ = 範囲選択
        drag.source = 'rubber';
        drag.boxEl = document.createElement('div');
        drag.boxEl.className = 'select-box';
        boardEl.appendChild(drag.boxEl);
      } else if (drag.source === 'group') {
        showGroupGhost(drag);
        for (const key of selection) {
          const [r, c] = key.split(',').map(Number);
          cellAt(r, c)?.querySelector('.placed-token')?.classList.add('dragging');
        }
      } else {
        showGhost(drag.gateId);
        if (drag.srcEl) drag.srcEl.classList.add('dragging');
      }
    }
    if (drag.moved) {
      if (drag.source === 'rubber') {
        const rect = boardEl.getBoundingClientRect();
        drag.boxEl.style.left = `${Math.min(drag.startX, e.clientX) - rect.left}px`;
        drag.boxEl.style.top = `${Math.min(drag.startY, e.clientY) - rect.top}px`;
        drag.boxEl.style.width = `${Math.abs(e.clientX - drag.startX)}px`;
        drag.boxEl.style.height = `${Math.abs(e.clientY - drag.startY)}px`;
        e.preventDefault();
        return;
      }
      ghostEl.style.left = `${e.clientX}px`;
      ghostEl.style.top = `${e.clientY}px`;
      clearDropHints();
      const cellEl = cellFromPoint(e.clientX, e.clientY);
      if (cellEl) {
        if (drag.source === 'group') {
          // 移動先の全セルをハイライト
          const dr = +cellEl.dataset.row - drag.row;
          const dc = +cellEl.dataset.col - drag.col;
          for (const key of selection) {
            const [r, c] = key.split(',').map(Number);
            cellAt(r + dr, c + dc)?.classList.add('drop-hint');
          }
        } else {
          cellEl.classList.add('drop-hint');
        }
      }
      e.preventDefault();
    }
  }

  function onPointerUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    hideGhost();
    clearDropHints();
    if (d.boxEl) d.boxEl.remove();
    if (d.srcEl) d.srcEl.classList.remove('dragging');
    for (const el of boardEl.querySelectorAll('.placed-token.dragging')) el.classList.remove('dragging');
    if (callbacks.isLocked()) return;

    let changed = false;
    let rerender = true;
    if (!d.moved) {
      // クリック(タップ)操作
      if (d.source === 'palette') {
        paletteApi.toggleSelect(d.gateId);
      } else if (d.source === 'board' || d.source === 'group') {
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
        else if (d.gateId === 'CNOT') { cycleCnotControl(circuit, d.row, d.col); changed = true; }
        else { removeGate(circuit, d.row, d.col); changed = true; } // CCXは残り2行が常にCなので切替なし
      } else if (d.source === 'marker') {
        cycleCnotControl(circuit, d.gateRow, d.col);
        changed = true;
      } else if (d.source === 'cell') {
        if (selection.size) { selection.clear(); changed = true; } // 空きマスタップで選択解除
        const sel = paletteApi.getSelected();
        if (sel) changed = placeGate(circuit, d.row, d.col, sel) || changed;
      }
    } else if (d.source === 'rubber') {
      // 範囲内のゲートを選択
      const x1 = Math.min(d.startX, e.clientX);
      const x2 = Math.max(d.startX, e.clientX);
      const y1 = Math.min(d.startY, e.clientY);
      const y2 = Math.max(d.startY, e.clientY);
      selection = new Set();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < numCols(circuit); c++) {
          if (!circuit[r][c]) continue;
          const rect = cellAt(r, c).getBoundingClientRect();
          if (rect.left < x2 && rect.right > x1 && rect.top < y2 && rect.bottom > y1) {
            selection.add(keyOf(r, c));
          }
        }
      }
      render();
      return;
    } else if (d.source === 'group') {
      const cellEl = cellFromPoint(e.clientX, e.clientY);
      if (cellEl) {
        changed = tryGroupMove(+cellEl.dataset.row - d.row, +cellEl.dataset.col - d.col);
      }
      // 盤外や置けない場所へのドロップはキャンセル(まとめて削除はしない)
    } else {
      // 単体ドラッグ操作
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
        removeGate(circuit, marker.gateRow, col);
        render();
        callbacks.onChange();
      }
    }
  }

  // 選択中のゲート一式を (dr, dc) だけ平行移動する。全部置ける場合のみ実行して true。
  function tryGroupMove(dr, dc) {
    if (dr === 0 && dc === 0) return false;
    const moves = [];
    for (const key of selection) {
      const [r, c] = key.split(',').map(Number);
      if (circuit[r][c]) moves.push({ r, c, cell: circuit[r][c] });
    }
    if (!moves.length) return false;
    // 移動後の占有セル(本体 + CX の C マーカー + CCX の列全体)を集めて相互衝突を検査
    const occ = new Set();
    for (const m of moves) {
      const nr = m.r + dr;
      const nc = m.c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= numCols(circuit)) return false;
      const gateCells = new Set([keyOf(nr, nc)]);
      if (m.cell.gateId === 'CNOT') {
        const ncr = m.cell.control + dr;
        if (ncr < 0 || ncr >= ROWS) return false;
        gateCells.add(keyOf(ncr, nc));
      } else if (m.cell.gateId === 'CCNOT') {
        for (let r2 = 0; r2 < ROWS; r2++) gateCells.add(keyOf(r2, nc));
      }
      for (const k of gateCells) {
        if (occ.has(k)) return false;
        occ.add(k);
      }
    }
    // 動かないゲートとの衝突を検査(選択分をいったん外して判定)
    for (const m of moves) circuit[m.r][m.c] = null;
    for (const k of occ) {
      const [r, c] = k.split(',').map(Number);
      if (cellOccupied(circuit, r, c)) {
        for (const m of moves) circuit[m.r][m.c] = m.cell; // 元に戻す
        return false;
      }
    }
    for (const m of moves) {
      const cell = { ...m.cell };
      if (cell.gateId === 'CNOT') cell.control += dr;
      circuit[m.r + dr][m.c + dc] = cell;
    }
    selection = new Set(moves.map((m) => keyOf(m.r + dr, m.c + dc)));
    return true;
  }

  function showGhost(gateId) {
    ghostEl.innerHTML = '';
    const tok = makeToken(gateId);
    tok.classList.remove('placed-token');
    ghostEl.appendChild(tok);
    ghostEl.hidden = false;
  }

  // 選択中の全トークンを、盤面上の相対位置のままゴーストとして表示する。
  // 掴んだトークンがポインタの真下に来るように配置する。
  function showGroupGhost(d) {
    ghostEl.innerHTML = '';
    const grabbed = cellAt(d.row, d.col);
    const rect = grabbed ? grabbed.getBoundingClientRect() : { width: 42, height: 52 };
    const pitchX = rect.width + 4;  // セル幅 + グリッドgap
    const pitchY = rect.height + 4;
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    for (const key of selection) {
      const [r, c] = key.split(',').map(Number);
      const cell = circuit[r][c];
      if (!cell) continue;
      const tok = makeToken(cell.gateId);
      tok.classList.remove('placed-token');
      if (cell.gateId === 'CNOT' || cell.gateId === 'CCNOT') {
        tok.querySelector('.glyph').textContent = 'X';
      } else if (cell.gateId === 'R') {
        tok.querySelector('.glyph').style.transform = `rotate(${(cell.theta * 180) / Math.PI}deg)`;
      }
      tok.style.position = 'absolute';
      tok.style.left = `${(c - d.col) * pitchX}px`;
      tok.style.top = `${(r - d.row) * pitchY}px`;
      tok.style.transform = 'translate(-50%, -50%)';
      wrap.appendChild(tok);
    }
    ghostEl.appendChild(wrap);
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
