// エントリポイント: 全モジュールの結線とアプリの状態遷移。
import { probabilities, phases as getPhases, measure } from './quantum/state.js';
import { createCircuit, evaluate, clearCircuit, usedGateCounts } from './quantum/circuit.js';
import { AudioEngine } from './audio/engine.js';
import { SONG_META } from './audio/songs.js';
import { createPalette } from './ui/palette.js';
import { createBoard } from './ui/board.js';
import { createFloor, createMeter } from './ui/floor.js';
import { setPartyFromProbs, setParty, strobe, showAnnounce, hideAnnounce } from './ui/fx.js';
import { createCourses } from './courses/courses.js';

const $ = (sel) => document.querySelector(sel);

const circuit = createCircuit();
const engine = new AudioEngine();

let currentState = evaluate(circuit);
let currentProbs = probabilities(currentState);
let currentPhases = getPhases(currentState);
let measured = null; // 観測で確定した曲 index(未観測なら null)
let busy = false;    // ルーレット演出中

const boothEl = $('#booth');
const floorAreaEl = $('#floor-area');
const announceEl = $('#announce');
const measureBtn = $('#measure-btn');
const releaseBtn = $('#release-btn');

const palette = createPalette($('#palette'));
const meter = createMeter($('#meter'));
const floor = createFloor($('#floor-canvas'), () => engine.getBeatInfo());

const courses = createCourses($('#course-panel'), {
  onAllowedChange() {
    palette.setAllowed(courses.getAllowedGates());
    syncTabs();
    pruneDisallowedGates();
  },
});

const board = createBoard($('#board'), palette, $('#drag-ghost'), circuit, {
  onChange: onCircuitChange,
  isLocked: () => busy || measured !== null,
});

function buildCtx() {
  return { probs: currentProbs, phases: currentPhases, counts: usedGateCounts(circuit), measured };
}

function recompute() {
  currentState = evaluate(circuit);
  currentProbs = probabilities(currentState);
  currentPhases = getPhases(currentState);
  floor.setProbs(currentProbs);
  meter.update(currentProbs, currentPhases);
  setPartyFromProbs(currentProbs);
  engine.setMix(currentProbs.map(Math.sqrt));
  courses.update(buildCtx());
}

function onCircuitChange() {
  palette.clearSelect();
  recompute();
}

// コース切替などで使用不可になったゲートを盤面から取り除く
function pruneDisallowedGates() {
  const allowed = new Set(courses.getAllowedGates());
  let removedAny = false;
  for (const rowCells of circuit) {
    for (let c = 0; c < rowCells.length; c++) {
      if (rowCells[c] && !allowed.has(rowCells[c].gateId)) {
        rowCells[c] = null;
        removedAny = true;
      }
    }
  }
  if (removedAny) {
    board.render();
    recompute();
  }
}

// ---- 観測 ----

async function runRoulette(winner, durMs, onIndex) {
  // 8タイルを周回するハイライトが減速しながら winner で止まる
  const seq = [];
  for (let k = 0; k < 24; k++) seq.push(k % 8);
  let next = seq[seq.length - 1];
  do { next = (next + 1) % 8; seq.push(next); } while (next !== winner);
  const ratio = 1.09;
  const weights = seq.map((_, k) => ratio ** k);
  const total = weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < seq.length; k++) {
    onIndex(seq[k]);
    await new Promise((r) => setTimeout(r, (weights[k] / total) * durMs));
  }
}

async function onMeasure() {
  if (busy || measured !== null) return;
  busy = true;
  boothEl.classList.add('locked');
  measureBtn.disabled = true;

  const { outcome } = measure(currentState);
  const spinMs = 2200;
  await Promise.all([
    runRoulette(outcome, spinMs, (i) => {
      floor.setRoulette(i);
      meter.setRoulette(i);
    }),
    engine.playMeasureFx(outcome, spinMs),
  ]);

  floor.setRoulette(null);
  meter.setRoulette(null);
  floor.setWinner(outcome);
  meter.setWinner(outcome);
  strobe(floorAreaEl);
  showAnnounce(announceEl, outcome);
  setParty(1);

  measured = outcome;
  busy = false;
  releaseBtn.hidden = false;
  measureBtn.disabled = true;
  courses.update(buildCtx());
}

function releaseMeasurement() {
  measured = null;
  releaseBtn.hidden = true;
  measureBtn.disabled = false;
  boothEl.classList.remove('locked');
  hideAnnounce(announceEl);
  floor.setWinner(null);
  meter.setWinner(null);
  engine.releaseMeasurement();
  recompute();
}

// ---- コントロール ----

measureBtn.addEventListener('click', onMeasure);
releaseBtn.addEventListener('click', releaseMeasurement);

$('#reset-btn').addEventListener('click', () => {
  if (busy) return;
  clearCircuit(circuit);
  board.render();
  if (measured !== null) releaseMeasurement();
  else recompute();
});

for (const tab of document.querySelectorAll('#course-tabs .tab')) {
  tab.addEventListener('click', () => {
    if (busy) return;
    if (measured !== null) releaseMeasurement();
    clearCircuit(circuit);
    board.render();
    courses.setMode(tab.dataset.mode);
    recompute();
  });
}

function syncTabs() {
  const mode = courses.getMode();
  for (const tab of document.querySelectorAll('#course-tabs .tab')) {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  }
}

const muteBtn = $('#mute-btn');
muteBtn.addEventListener('click', () => {
  engine.setMuted(!engine.muted);
  muteBtn.textContent = engine.muted ? '🔇' : '🔊';
});

// ---- スタートオーバーレイ ----

const overlay = $('#start-overlay');
const enterBtn = $('#enter-btn');
const progressEl = $('#render-progress');
const progressFill = progressEl.querySelector('.fill');
const progressLabel = progressEl.querySelector('.progress-label');

enterBtn.addEventListener('click', async () => {
  enterBtn.disabled = true;
  progressEl.hidden = false;
  try {
    await engine.init((done, totalCount) => {
      progressFill.style.width = `${(done / totalCount) * 100}%`;
      progressLabel.textContent = done < totalCount
        ? `音楽を合成中… ${SONG_META[done].name}` : '準備完了!';
    });
    engine.start();
    engine.setMix(currentProbs.map(Math.sqrt));
  } catch (err) {
    progressLabel.textContent = '音声の初期化に失敗しました: ' + err.message;
    console.error(err);
    return;
  }
  overlay.classList.add('hidden');
});

// ---- 初期化 ----
courses.setMode('lesson');
recompute();
