// Web Audio / DOM の最小モック(Node でアプリのコードを動かすため)

let sourceNodes = 0;
export const audioStats = { reset() { sourceNodes = 0; }, get sourceNodes() { return sourceNodes; } };

function assertFinite(...xs) {
  for (const x of xs) if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error(`non-finite audio param: ${x}`);
}

class Param {
  constructor(v = 0) { this.value = v; }
  setValueAtTime(v, t) { assertFinite(v, t); return this; }
  linearRampToValueAtTime(v, t) { assertFinite(v, t); return this; }
  exponentialRampToValueAtTime(v, t) {
    assertFinite(v, t);
    if (v <= 0) throw new Error(`exponentialRamp to <= 0: ${v}`);
    return this;
  }
  cancelScheduledValues() { return this; }
  setTargetAtTime(v, t) { assertFinite(v, t); return this; }
}
class AudioNodeMock { connect(n) { return n; } }
class Osc extends AudioNodeMock {
  constructor() { super(); this.frequency = new Param(440); this.detune = new Param(0); }
  start(t) { assertFinite(t); }
  stop(t) { assertFinite(t); }
}
class GainMock extends AudioNodeMock { constructor() { super(); this.gain = new Param(1); } }
class FilterMock extends AudioNodeMock { constructor() { super(); this.frequency = new Param(350); this.Q = new Param(1); } }
class SrcMock extends AudioNodeMock { start(t) { assertFinite(t); } stop(t) { assertFinite(t); } }
class PanMock extends AudioNodeMock { constructor() { super(); this.pan = new Param(0); } }
class CompMock extends AudioNodeMock { constructor() { super(); this.threshold = new Param(); this.ratio = new Param(); } }

class BaseCtx {
  constructor() { this.sampleRate = 44100; this.destination = new AudioNodeMock(); this.currentTime = 0; }
  createOscillator() { sourceNodes++; return new Osc(); }
  createGain() { return new GainMock(); }
  createBiquadFilter() { return new FilterMock(); }
  createBufferSource() { sourceNodes++; return new SrcMock(); }
  createStereoPanner() { return new PanMock(); }
  createDynamicsCompressor() { return new CompMock(); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  resume() { return Promise.resolve(); }
}
class OfflineCtx extends BaseCtx {
  constructor(ch, len, rate) { super(); this.sampleRate = rate; this.length = len; }
  startRendering() { return Promise.resolve({ duration: this.length / this.sampleRate }); }
}

export function installAudioMocks() {
  globalThis.OfflineAudioContext = OfflineCtx;
  globalThis.window = {
    ...(globalThis.window || {}),
    AudioContext: BaseCtx,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    devicePixelRatio: 1,
  };
}

// --- DOM ---
function makeEl(name = '') {
  const listeners = {};
  const cls = new Set();
  let html = '';
  const el = {
    name, style: { setProperty() {} }, dataset: {}, children: [], hidden: false, textContent: '', title: '',
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    querySelector() { return makeEl(`${name}>q`); },
    querySelectorAll() { return []; },
    addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
    removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, right: 600, bottom: 160, width: 600, height: 160 }; },
    closest() { return null; },
    contains() { return false; },
    getContext() { return new Proxy({}, { get: () => () => {} }); },
    async fire(type) {
      for (const fn of listeners[type] || []) {
        await fn({ target: makeEl('t'), preventDefault() {}, clientX: 0, clientY: 0, button: 0 });
      }
    },
    classList: {
      add: (...c) => c.forEach((x) => cls.add(x)),
      remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, f) => ((f === undefined ? !cls.has(c) : f) ? cls.add(c) : cls.delete(c)),
      contains: (c) => cls.has(c),
    },
  };
  Object.defineProperty(el, 'innerHTML', { get: () => html, set: (v) => { html = v; el.children = []; } });
  Object.defineProperty(el, 'offsetWidth', { get: () => 100 });
  return el;
}

export function installDomMocks() {
  const bySelector = new Map();
  const getEl = (sel) => {
    if (!bySelector.has(sel)) bySelector.set(sel, makeEl(sel));
    return bySelector.get(sel);
  };
  globalThis.document = {
    querySelector: getEl,
    querySelectorAll: () => [],
    createElement: (tag) => makeEl(tag),
    addEventListener() {},
    elementFromPoint: () => null,
    documentElement: makeEl('html'),
  };
  globalThis.requestAnimationFrame = () => 0;
  installMemoryStorage();
  return { getEl };
}

export function installMemoryStorage() {
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  return store;
}
