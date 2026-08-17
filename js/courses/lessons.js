// レッスンコース: X → 観測 → H(重ね合わせ) → R(位相) → 干渉 の順に学ぶ8ステップ。
// check(ctx) の ctx = { probs, phases, counts, measured }

const near = (a, b, eps = 0.02) => Math.abs(a - b) < eps;

export const LESSON_STEPS = [
  {
    text: 'ようこそ、量子ディスコへ!3つの量子ビットがDJブースのレコードだ。いまはぜんぶ <code>0</code>、つまり曲 <code>000</code>「ディスコ」だけが流れている。まずはこの状態を聴いてみよう。',
    allowed: [],
    needNext: true,
  },
  {
    text: '<code>X</code> ゲートはビットを反転するゲート。いちばん下の行(q2)に X を置いてみよう。<span class="goal">目標: 曲 001「ファンク」だけを流す</span>',
    allowed: ['X'],
    check: (c) => near(c.probs[1], 1),
  },
  {
    text: 'X を組み合わせれば8曲から好きな曲を選べる。<span class="goal">目標: 曲 101「エレクトロポップ」だけを流す</span>(ヒント: q0 と q2 を反転)',
    allowed: ['X'],
    check: (c) => near(c.probs[5], 1),
  },
  {
    text: 'そのまま金色の <code>M</code> ボタン(観測)を押してみよう。確定した状態なら、何度観測しても必ず同じ曲がフロアに流れる。',
    allowed: ['X'],
    check: (c) => c.measured === 5,
  },
  {
    text: 'リセットして、こんどは <code>H</code> ゲートをどれか1行に置いてみよう。H は「重ね合わせ」を作るゲート。2曲が同時に聴こえてくる…!<span class="goal">目標: 2曲が50%ずつのミックスを作る</span>',
    allowed: ['X', 'H'],
    check: (c) => {
      const nz = [...c.probs].filter((p) => p > 0.01);
      return nz.length === 2 && nz.every((p) => near(p, 0.5));
    },
  },
  {
    text: '3行ぜんぶに H を置くと、8曲すべての重ね合わせになる。均等ミックス(各12.5%)ができたら <code>M</code> で観測!どの曲に決まるかは完全にランダムだ。',
    allowed: ['X', 'H'],
    check: (c) => [...c.probs].every((p) => near(p, 0.125, 0.01)) && c.measured !== null,
  },
  {
    text: '<code>R</code> ゲートは「位相」を回すゲート。H のうしろ(右隣)に R を置いても、音=確率はまったく変わらない。でもメーター右下の色ダイヤル(位相)だけが回る。この見えない性質が量子計算のカギ。',
    allowed: ['X', 'H', 'R'],
    check: (c) => c.counts.R >= 1 && c.counts.H >= 1 && [...c.phases].some((ph) => Math.abs(ph) > 0.1),
  },
  {
    text: '位相は「干渉」で威力を発揮する。リセットして q0 の行に <code>H → R(π) → H</code> と並べてみよう。2回目の H で波が打ち消し合い、X を使っていないのに曲が切り替わる!<span class="goal">目標: X を使わずに曲 100「チルアウト」を100%に</span>',
    allowed: ['X', 'H', 'R'],
    check: (c) => near(c.probs[4], 1) && c.counts.X === 0,
  },
];

export const LESSON_DONE_TEXT =
  '🎓 レッスン完了!「重ね合わせ」で全曲を同時に鳴らし、「位相と干渉」で確率を操り、「観測」で答えを取り出す——これが量子コンピュータの計算の基本イメージだ。次は「トライ」コースで腕試ししよう!';
