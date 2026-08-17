// ゲートパレット: 使用可能なゲートのトークンを表示し、選択状態を管理する。
import { GATES } from '../quantum/gates.js';

export function createPalette(el) {
  let allowed = ['X', 'H', 'R'];
  let selected = null;

  function render() {
    el.innerHTML = '';
    for (const id of allowed) {
      const g = GATES[id];
      const tok = document.createElement('div');
      tok.className = 'gate-token palette-token';
      tok.dataset.gate = id;
      tok.style.background = g.color;
      tok.textContent = g.label;
      tok.title = g.name;
      if (id === selected) tok.classList.add('selected');
      el.appendChild(tok);
    }
  }

  render();

  return {
    el,
    setAllowed(gateIds) {
      allowed = gateIds;
      if (selected && !allowed.includes(selected)) selected = null;
      render();
    },
    getSelected: () => selected,
    toggleSelect(gateId) {
      selected = selected === gateId ? null : gateId;
      render();
    },
    clearSelect() {
      if (selected !== null) { selected = null; render(); }
    },
  };
}
