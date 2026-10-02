const STORAGE_KEY = 'enjoy-quantum-language';

const TEXT = {
  title: ['量子コンピュータ・ディスコ', 'Quantum Computer Disco'],
  subtitle: ['非公式リメイク', 'Unofficial remake'],
  lesson: ['レッスン', 'Lessons'],
  try: ['トライ', 'Challenges'],
  free: ['フリー', 'Free'],
  mute: ['ミュート', 'Mute'],
  unmute: ['ミュート解除', 'Unmute'],
  observationResult: ['🎉 観測結果 🎉', '🎉 Measured song 🎉'],
  meterLabel: ['各曲の出現確率', 'Probability of each song'],
  circuitLabel: ['DJブース(量子回路)', 'DJ booth (quantum circuit)'],
  gateLabel: ['ゲート', 'Gates'],
  boardHelp: [
    '<strong>CX・CCX</strong> は<strong>置いた場所が <span class="sym-target">X</span>(反転される行)</strong>。縦線の先の <span class="sym-ctrl">C</span> = 制御で、その行が 1 のときだけ X が反転する(CX は C 1つ、CCX は C 2つ)。<br>トークン: ドラッグで配置/移動、盤外へドラッグか右クリックで削除。R はタップで角度切替、CX はトークンか C マーカーをタップで制御の行を切替、その他はタップで削除。<br>空きマスからドラッグすると<strong>範囲選択</strong>でき、選択したゲート(白い点線枠)はまとめてドラッグで移動できる。空きマスをタップで選択解除。',
    '<strong>CX and CCX:</strong> Place <span class="sym-target">X</span> on the row to flip. A <span class="sym-ctrl">C</span> at the end of a vertical line controls the flip when its row is 1 (one C for CX, two for CCX).<br>Drag tokens to place or move them. Drag off the board or right-click to remove. Tap R to change its angle; tap CX or its C marker to change the control row. Tap other placed gates to remove them.<br>Drag from an empty cell to <strong>select a range</strong>, then move selected gates together. Tap an empty cell to clear the selection.',
  ],
  measureTitle: ['観測する', 'Measure'],
  measure: ['観測', 'Measure'],
  release: ['もう一度<br>ミックス', 'Mix<br>again'],
  reset: ['リセット', 'Reset'],
  credit: ['日本科学未来館の常設展示「量子コンピュータ・ディスコ」に着想を得た非公式ファンリメイクです。展示の素材・楽曲は一切使用していません(音楽はすべてWeb Audio APIで合成)。', 'An unofficial fan remake inspired by the Miraikan exhibit “Quantum Computer Disco”. No exhibit assets or songs are used; all music is synthesized with the Web Audio API.'],
  overlayDescription: ['3つの量子ビットが8曲のレコードになる。<br>ゲートを置いて曲を重ね合わせ、観測(M)でフロアに1曲を落とそう。', 'Three qubits become eight songs. Place gates to create a superposition of songs, then press M to measure and play one outcome.'],
  enter: ['▶ フロアに入る', '▶ Enter the dance floor'],
  preparing: ['音楽を合成中…', 'Synthesizing music…'],
  ready: ['準備完了!', 'Ready!'],
  audioError: ['音声の初期化に失敗しました: ', 'Could not initialize audio: '],
  soundNotice: ['🔊 音が出ます', '🔊 Sound will play'],
  freeDescription: ['自由に量子プログラミング!すべてのゲート(X・Y・Z・H・R・CX・CCX・G)と15ステップが使える。お気に入りのミックスを作って <code>M</code> でフロアに落とそう。グローバー探索(課題8のヒント参照)を組んでみるのもおすすめ。', 'Build your own quantum circuit with all gates (X, Y, Z, H, R, CX, CCX, G) and 15 columns. Make your favorite mix, then press <code>M</code> to play one outcome. You can also try Grover search (see the hint for Challenge 8).'],
  lessonComplete: ['レッスン修了', 'Lessons complete'],
  goToChallenges: ['トライへ →', 'Go to challenges →'],
  done: ['✨ できた!', '✨ Well done!'],
  next: ['次へ →', 'Next →'],
  cleared: ['✓ クリア!', '✓ Cleared!'],
  nextChallenge: ['次の課題 →', 'Next challenge →'],
  hideHint: ['ヒントを隠す', 'Hide hint'],
  hint: ['ヒント', 'Hint'],
  controlTitle: ['制御: この行が1のときだけ X が反転(CXはタップで行を切替)', 'Control: X flips only when this row is 1 (tap CX to change the control row)'],
};

let language;
try { language = localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ja'; }
catch { language = 'ja'; }

export function getLanguage() { return language; }
export function setLanguage(next) {
  language = next === 'en' ? 'en' : 'ja';
  try { localStorage.setItem(STORAGE_KEY, language); } catch { /* storage may be unavailable */ }
  document.documentElement.lang = language;
}
export function t(key) { return TEXT[key]?.[language === 'en' ? 1 : 0] ?? key; }
export function localized(item, field) { return language === 'en' ? item[`${field}En`] : item[field]; }
export function applyStaticTranslations() {
  document.documentElement.lang = language;
  document.title = getLanguage() === 'en' ? 'Quantum Computer Disco (Unofficial remake)' : '量子コンピュータ・ディスコ(非公式リメイク)';
  document.querySelector('meta[name="description"]').content = language === 'en'
    ? 'Explore quantum computing through a DJ experience. An unofficial fan remake inspired by Miraikan.'
    : 'DJ体験で量子コンピュータの原理を学ぶ。日本科学未来館の展示に着想を得た非公式ファンリメイク。';
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const select of document.querySelectorAll('#language-select, .language-select')) select.value = language;
}
