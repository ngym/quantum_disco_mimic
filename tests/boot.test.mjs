// main.js の起動と「フロアに入る」クリックまでの煙テスト
import { installAudioMocks, installDomMocks } from './mocks.mjs';
import { check, finish } from './helpers.mjs';

installAudioMocks();
const { getEl } = installDomMocks();

try {
  await import('../js/main.js');
  check('main.js がエラーなく読み込める', true);
} catch (e) {
  check('main.js がエラーなく読み込める', false, e.stack);
  finish();
}

await getEl('#enter-btn').fire('click');
await new Promise((r) => setTimeout(r, 50));
check('「フロアに入る」でオーバーレイが消える', getEl('#start-overlay').classList.contains('hidden'),
  getEl('#render-progress').textContent);
finish();
