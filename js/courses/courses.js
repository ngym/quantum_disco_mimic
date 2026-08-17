// コース管理: レッスン/トライ/フリーの切替、進行状態、パネル描画、達成判定。
import { LESSON_STEPS, LESSON_DONE_TEXT } from './lessons.js';
import { CHALLENGES, TRY_DONE_TEXT } from './challenges.js';

const STORAGE_KEY = 'qdisco-cleared';

export function createCourses(panelEl, { onAllowedChange }) {
  let mode = 'lesson';
  let lessonStep = 0;
  let stepDone = false;
  let lessonComplete = false;
  let challengeIdx = 0;
  let showHint = false;
  let cleared;
  try {
    cleared = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    cleared = new Set();
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...cleared])); } catch { /* プライベートモード等 */ }
  }

  function getAllowedGates() {
    if (mode === 'free') return ['X', 'Y', 'Z', 'H', 'R', 'CNOT', 'CCNOT'];
    if (mode === 'try') return CHALLENGES[challengeIdx].allowed;
    if (lessonComplete) return ['X', 'H', 'R'];
    return LESSON_STEPS[lessonStep].allowed;
  }

  function render() {
    if (mode === 'free') {
      panelEl.innerHTML = `
        <span class="panel-badge">フリー</span>
        <div class="panel-text">自由に量子プログラミング!すべてのゲート(X・Y・Z・H・R・CNOT・CCNOT)と15ステップが使える。お気に入りのミックスを作って <code>M</code> でフロアに落とそう。グローバー探索(課題8のヒント参照)を組んでみるのもおすすめ。</div>`;
      return;
    }

    if (mode === 'lesson') {
      if (lessonComplete) {
        panelEl.innerHTML = `
          <span class="panel-badge ok">レッスン修了</span>
          <div class="panel-text">${LESSON_DONE_TEXT}</div>
          <div class="panel-actions"><button class="panel-btn primary" data-act="goto-try">トライへ →</button></div>`;
        bind();
        return;
      }
      const step = LESSON_STEPS[lessonStep];
      const successHtml = stepDone && !step.needNext
        ? '<br><span class="success-msg">✨ できた!</span>' : '';
      const nextBtn = (step.needNext || stepDone)
        ? '<button class="panel-btn primary" data-act="next-step">次へ →</button>' : '';
      panelEl.innerHTML = `
        <span class="panel-badge">レッスン ${lessonStep + 1}/${LESSON_STEPS.length}</span>
        <div class="panel-text">${step.text}${successHtml}</div>
        <div class="panel-actions">${nextBtn}</div>`;
      bind();
      return;
    }

    // トライ
    const ch = CHALLENGES[challengeIdx];
    const isCleared = cleared.has(challengeIdx);
    const allCleared = cleared.size >= CHALLENGES.length;
    const dots = CHALLENGES.map((c, i) => {
      const cls = ['challenge-dot'];
      if (i === challengeIdx) cls.push('current');
      if (cleared.has(i)) cls.push('cleared');
      return `<button class="${cls.join(' ')}" data-act="goto-challenge" data-i="${i}" title="${c.title}">${cleared.has(i) ? '✓' : i + 1}</button>`;
    }).join('');
    const status = isCleared
      ? '<span class="panel-badge ok">✓ クリア!</span>'
      : `<span class="panel-badge">${ch.title}</span>`;
    const nextBtn = isCleared && challengeIdx < CHALLENGES.length - 1
      ? '<button class="panel-btn primary" data-act="next-challenge">次の課題 →</button>' : '';
    const doneMsg = allCleared ? `<br><span class="success-msg">${TRY_DONE_TEXT}</span>` : '';
    panelEl.innerHTML = `
      ${status}
      <div class="challenge-list">${dots}</div>
      <div class="panel-text">${ch.text}${doneMsg}</div>
      <div class="panel-actions">
        ${nextBtn}
        <button class="panel-btn ghost" data-act="toggle-hint">${showHint ? 'ヒントを隠す' : 'ヒント'}</button>
      </div>
      ${showHint ? `<div class="hint-text">💡 ${ch.hint}</div>` : ''}`;
    bind();
  }

  function bind() {
    for (const btn of panelEl.querySelectorAll('[data-act]')) {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'next-step') {
          lessonStep++;
          stepDone = false;
          if (lessonStep >= LESSON_STEPS.length) lessonComplete = true;
        } else if (act === 'goto-try') {
          mode = 'try';
        } else if (act === 'next-challenge') {
          challengeIdx++;
          showHint = false;
        } else if (act === 'goto-challenge') {
          challengeIdx = +btn.dataset.i;
          showHint = false;
        } else if (act === 'toggle-hint') {
          showHint = !showHint;
        }
        render();
        onAllowedChange();
      });
    }
  }

  return {
    getAllowedGates,
    getMode: () => mode,
    setMode(m) {
      mode = m;
      showHint = false;
      render();
      onAllowedChange();
    },
    // 回路変更・観測のたびに呼ばれる。達成判定を行い必要ならパネルを更新。
    update(ctx) {
      if (mode === 'lesson' && !lessonComplete) {
        const step = LESSON_STEPS[lessonStep];
        if (!stepDone && step.check && step.check(ctx)) {
          stepDone = true;
          render();
        }
      } else if (mode === 'try') {
        if (!cleared.has(challengeIdx) && CHALLENGES[challengeIdx].judge(ctx)) {
          cleared.add(challengeIdx);
          persist();
          render();
        }
      }
    },
    render,
  };
}
