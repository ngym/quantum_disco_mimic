// コース管理: レッスン/トライ/フリーの切替、進行状態、パネル描画、達成判定。
import { LESSON_STEPS, LESSON_DONE_TEXT, LESSON_DONE_TEXT_EN } from './lessons.js';
import { CHALLENGES, TRY_DONE_TEXT, TRY_DONE_TEXT_EN } from './challenges.js';
import { getLanguage, localized, t } from '../i18n.js';

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
    if (mode === 'free') return ['X', 'Y', 'Z', 'H', 'R', 'CNOT', 'CCNOT', 'G'];
    if (mode === 'try') return CHALLENGES[challengeIdx].allowed;
    if (lessonComplete) return ['X', 'H', 'R'];
    return LESSON_STEPS[lessonStep].allowed;
  }

  function render() {
    if (mode === 'free') {
      panelEl.innerHTML = `
        <span class="panel-badge">${t('free')}</span>
        <div class="panel-text">${t('freeDescription')}</div>`;
      return;
    }

    if (mode === 'lesson') {
      if (lessonComplete) {
        panelEl.innerHTML = `
          <span class="panel-badge ok">${t('lessonComplete')}</span>
          <div class="panel-text">${getLanguage() === 'en' ? LESSON_DONE_TEXT_EN : LESSON_DONE_TEXT}</div>
          <div class="panel-actions"><button class="panel-btn primary" data-act="goto-try">${t('goToChallenges')}</button></div>`;
        bind();
        return;
      }
      const step = LESSON_STEPS[lessonStep];
      const successHtml = stepDone && !step.needNext
        ? `<br><span class="success-msg">${t('done')}</span>` : '';
      const nextBtn = (step.needNext || stepDone)
        ? `<button class="panel-btn primary" data-act="next-step">${t('next')}</button>` : '';
      panelEl.innerHTML = `
        <span class="panel-badge">${t('lesson')} ${lessonStep + 1}/${LESSON_STEPS.length}</span>
        <div class="panel-text">${localized(step, 'text')}${successHtml}</div>
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
      return `<button class="${cls.join(' ')}" data-act="goto-challenge" data-i="${i}" title="${localized(c, 'title')}">${cleared.has(i) ? '✓' : i + 1}</button>`;
    }).join('');
    const status = isCleared
      ? `<span class="panel-badge ok">${t('cleared')}</span>`
      : `<span class="panel-badge">${localized(ch, 'title')}</span>`;
    const nextBtn = isCleared && challengeIdx < CHALLENGES.length - 1
      ? `<button class="panel-btn primary" data-act="next-challenge">${t('nextChallenge')}</button>` : '';
    const doneMsg = allCleared ? `<br><span class="success-msg">${getLanguage() === 'en' ? TRY_DONE_TEXT_EN : TRY_DONE_TEXT}</span>` : '';
    panelEl.innerHTML = `
      ${status}
      <div class="challenge-list">${dots}</div>
      <div class="panel-text">${localized(ch, 'text')}${doneMsg}</div>
      <div class="panel-actions">
        ${nextBtn}
        <button class="panel-btn ghost" data-act="toggle-hint">${t(showHint ? 'hideHint' : 'hint')}</button>
      </div>
      ${showHint ? `<div class="hint-text">💡 ${localized(ch, 'hint')}</div>` : ''}`;
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
