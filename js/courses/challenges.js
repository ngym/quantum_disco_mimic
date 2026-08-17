// トライコース: 課題クリア型。judge(ctx) の ctx = { probs, phases, counts, measured }

const inRange = (x, lo, hi) => x >= lo && x <= hi;
const isSmall = (x) => x < 0.01;

export const CHALLENGES = [
  {
    title: '課題1',
    text: '曲 <code>101</code>「エレクトロポップ」を確実(100%)に再生せよ。',
    allowed: ['X', 'H', 'R'],
    judge: (c) => c.probs[5] >= 0.99,
    hint: 'q0 と q2 に X を置く。',
  },
  {
    title: '課題2',
    text: '曲 <code>000</code> と <code>100</code> をちょうど 50% ずつミックスせよ。',
    allowed: ['X', 'H', 'R'],
    judge: (c) =>
      inRange(c.probs[0], 0.45, 0.55) && inRange(c.probs[4], 0.45, 0.55) &&
      c.probs.every((p, i) => i === 0 || i === 4 || isSmall(p)),
    hint: '違いは q0 のビットだけ。q0 に H を1つ。',
  },
  {
    title: '課題3',
    text: '8曲すべてを均等(12.5% ずつ)にミックスせよ。',
    allowed: ['X', 'H', 'R'],
    judge: (c) => c.probs.every((p) => inRange(p, 0.115, 0.135)),
    hint: '全部の行に H。',
  },
  {
    title: '課題4',
    text: '<strong>X を使わずに</strong>曲 <code>011</code>「ハウス」を 100% にせよ。',
    allowed: ['X', 'H', 'R'],
    judge: (c) => c.probs[3] >= 0.99 && c.counts.X === 0,
    hint: 'H → R(π) → H は X と同じ働き(干渉)。q1 と q2 の両方に。',
  },
  {
    title: '課題5',
    text: '曲 <code>110</code>「ヒップホップ」の確率を 80% 以上にせよ(ただし 100% 未満)。',
    allowed: ['X', 'H', 'R'],
    judge: (c) => inRange(c.probs[6], 0.8, 0.99),
    hint: 'H → R(3π/4) → H で約85%の「傾いた」状態が作れる。もう1行は X で確実に反転。',
  },
  {
    title: '課題6',
    text: '曲 <code>010</code> と <code>111</code> <strong>だけ</strong>を 50% ずつにせよ。',
    allowed: ['X', 'H', 'R', 'CNOT'],
    judge: (c) =>
      inRange(c.probs[2], 0.45, 0.55) && inRange(c.probs[7], 0.45, 0.55) &&
      c.probs.every((p, i) => i === 2 || i === 7 || isSmall(p)),
    hint: 'q0 と q2 が連動して変わる=「もつれ」が必要。q1 に X、q0 に H、そして CX を q2 に置き、C マーカーを q0 に。',
  },
  {
    title: '課題7',
    text: '曲 <code>000</code>・<code>011</code>・<code>101</code>・<code>110</code> を 25% ずつにせよ。',
    allowed: ['X', 'H', 'R', 'CNOT'],
    judge: (c) => {
      const targets = [0, 3, 5, 6];
      return c.probs.every((p, i) => (targets.includes(i) ? inRange(p, 0.22, 0.28) : isSmall(p)));
    },
    hint: '4曲はどれも「1の数が偶数」。q0 と q1 に H、そして CX を q2 に2列分置き、C をそれぞれ q0 と q1 に(パリティの書き込み)。',
  },
  {
    title: '課題8',
    text: '<strong>グローバー探索</strong>: 「振幅増幅」を使って、曲 <code>111</code>「ドラムンベース」の確率を 75% 以上にせよ(ただし 100% 未満。CCX を2回以上使うこと)。これは本物の量子コンピュータの有名アルゴリズムだ!',
    allowed: ['X', 'H', 'R', 'CNOT', 'CCNOT'],
    judge: (c) => inRange(c.probs[7], 0.75, 0.99) && c.counts.CCNOT >= 2,
    hint: '① 全行に H(8曲を均等ミックス) ② オラクル: q2 を H → CCX → H で挟むと「111 だけ位相反転」(CCZ)。音は変わらないが 111 に印がつく ③ 拡散: 全行 H → 全行 X → ②と同じ CCZ → 全行 X → 全行 H。印をつけた 111 の振幅だけが増幅されて約78%になる(全11列)。',
  },
];

export const TRY_DONE_TEXT =
  '🏆 全課題クリア!キミはもう量子DJだ。「フリー」コースで最大15ステップの自由なプログラミングを楽しもう。ここで学んだ X・Y・Z・H・R・CX・CCX は、本物の量子コンピュータのプログラミングでもそのまま使われている記号だ。';
