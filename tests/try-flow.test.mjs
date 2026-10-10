// トライの「回路で正解 → M で観測してクリア」フローの検証
import { installMemoryStorage } from './mocks.mjs';
import { check as baseCheck, finish } from './helpers.mjs';

const store = installMemoryStorage();

const { probabilities, phases } = await import('../js/quantum/state.js');
const { createCircuit, placeGate, evaluate, usedGateCounts } = await import('../js/quantum/circuit.js');
const { createCourses } = await import('../js/courses/courses.js');

// innerHTML から data-act ボタンを拾ってクリックできる最小モック
const panel = {
  _html: '',
  _btns: [],
  get innerHTML() { return this._html; },
  set innerHTML(v) {
    this._html = v;
    this._btns = [...v.matchAll(/data-act="([\w-]+)"(?: data-i="(\d+)")?/g)].map((m) => ({
      dataset: { act: m[1], i: m[2] },
      addEventListener(t, fn) { this.fn = fn; },
    }));
  },
  querySelectorAll() { return this._btns; },
  click(act, i) {
    const b = this._btns.find((x) => x.dataset.act === act && (i === undefined || x.dataset.i === String(i)));
    if (!b) throw new Error(`button not found: ${act} ${i ?? ''}`);
    b.fn();
  },
};

const courses = createCourses(panel, { onAllowedChange() {} });

function ctxOf(circ, measured = null) {
  const s = evaluate(circ);
  return { probs: probabilities(s), phases: phases(s), counts: usedGateCounts(circ), measured, sig: JSON.stringify(circ) };
}

const check = (name, cond) => baseCheck(name, cond, `panel: ${panel.innerHTML.replace(/\s+/g, ' ').slice(0, 400)}`);
const has = (t) => panel.innerHTML.includes(t);
const isCleared = (i) => JSON.parse(store['qdisco-cleared'] || '[]').includes(i);

courses.setMode('try');

// --- 課題1: 曲101を100%に ---
const empty = createCircuit();
courses.update(ctxOf(empty));
check('c1: 初期状態はルール案内', has('回路で条件を満たしたら'));

courses.update(ctxOf(empty, 0));
check('c1: 条件未達で観測 → 未クリア+案内', has('観測はできたけど') && !isCleared(0));
courses.update(ctxOf(empty)); // もう一度ミックス

const sol1 = createCircuit();
placeGate(sol1, 0, 0, 'X'); placeGate(sol1, 2, 0, 'X');
courses.update(ctxOf(sol1));
check('c1: 回路が正解 → 観測を促す(まだ未クリア)', has('回路は正解') && !isCleared(0) && !has('panel-badge ok'));

courses.update(ctxOf(sol1, 5));
check('c1: 観測でクリア', isCleared(0) && has('panel-badge ok') && has('🎉 クリア'));
check('c1: 確定状態のメッセージ', has('確率100%なので必ずこの曲') && has('エレクトロポップ'));

courses.update(ctxOf(sol1)); // もう一度ミックス(回路は同じ)
check('c1: 同じ回路のあいだは結果表示が残る', has('🎉 クリア'));

const changed = createCircuit();
placeGate(changed, 0, 0, 'X');
courses.update(ctxOf(changed));
check('c1: 回路を変えると結果表示は消える(クリア記録は残る)', !has('🎉 クリア') && isCleared(0) && has('panel-badge ok'));

// --- 課題2: 000/100 を 50/50 ---
panel.click('next-challenge');
const sol2 = createCircuit();
placeGate(sol2, 0, 0, 'H');
courses.update(ctxOf(sol2));
check('c2: 回路が正解 → 観測を促す', has('回路は正解') && !isCleared(1));
courses.update(ctxOf(sol2, 4));
check('c2: 確率50%の曲が出てクリア', isCleared(1) && has('この曲が出る確率は50%') && !has('低い方'));

// --- 課題5: 曲110を80%以上100%未満(低確率側が出るケース)---
panel.click('goto-challenge', 4);
const sol5 = createCircuit();
placeGate(sol5, 0, 0, 'X');
placeGate(sol5, 1, 0, 'H'); placeGate(sol5, 1, 1, 'R'); sol5[1][1].theta = 3 * Math.PI / 4; placeGate(sol5, 1, 2, 'H');
courses.update(ctxOf(sol5));
check('c5: 課題移動後、同じ ctx でも新しい課題で再判定', has('回路は正解') && !isCleared(4));
courses.update(ctxOf(sol5, 4)); // 確率約15%の 100 が出た
check('c5: 狙いと違う曲が出てもクリア', isCleared(4));
check('c5: 低確率側が出たことを表示', has('この曲が出る確率は15%') && has('低い方が出た'));

// --- 課題切替で前の課題の結果を持ち越さない ---
panel.click('goto-challenge', 0);
courses.update(ctxOf(sol5));
check('c1へ戻る: 別課題の結果表示は出ない', !has('🎉 クリア') && has('panel-badge ok'));

// --- 英語表示 ---
globalThis.document = { documentElement: {} }; // setLanguage が lang 属性を書くだけ
const { setLanguage } = await import('../js/i18n.js');
panel.click('goto-challenge', 4);
courses.update(ctxOf(sol5));
courses.update(ctxOf(sol5, 6));
setLanguage('en');
courses.render();
check('英語: クリア結果が英語で出る(曲名も英語)', has('Cleared!') && has('Hip-hop') && has('85% chance') && !has('クリア'));
courses.update(ctxOf(empty));
check('英語: ルール案内も英語', has('press <code>M</code> to measure and clear'));
setLanguage('ja');

finish();
