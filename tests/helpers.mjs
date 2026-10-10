// テスト共通の最小ヘルパ
let failures = 0;

export function check(name, cond, detail = '') {
  if (cond) {
    console.log('ok  :', name);
  } else {
    failures++;
    console.error('FAIL:', name, detail ? `\n  ${detail}` : '');
  }
}

export const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

export function finish() {
  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
  process.exit(failures ? 1 : 0);
}
