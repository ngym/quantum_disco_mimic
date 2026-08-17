// ゲート定義。展示と同じ記号(X / H / R)+ フリー・上級課題用の CNOT。

const S = Math.SQRT1_2;

// Rゲートのθ巡回値(クリックで順に切替)
export const THETAS = [
  0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI,
  (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4,
];

export function thetaLabel(theta) {
  const n = Math.round(theta / (Math.PI / 4)); // π/4 の倍数
  const table = { 0: '0', 1: 'π/4', 2: 'π/2', 3: '3π/4', 4: 'π', 5: '5π/4', 6: '3π/2', 7: '7π/4' };
  return table[n] || `${(theta / Math.PI).toFixed(2)}π`;
}

// 位相ゲート R(θ) = diag(1, e^{iθ})
export function rMatrix(theta) {
  return [
    [[1, 0], [0, 0]],
    [[0, 0], [Math.cos(theta), Math.sin(theta)]],
  ];
}

export const GATES = {
  X: {
    id: 'X', label: 'X', name: 'Xゲート(ビット反転)', color: '#ff4d9d',
    matrix: [
      [[0, 0], [1, 0]],
      [[1, 0], [0, 0]],
    ],
  },
  H: {
    id: 'H', label: 'H', name: 'Hゲート(重ね合わせ)', color: '#38c6ff',
    matrix: [
      [[S, 0], [S, 0]],
      [[S, 0], [-S, 0]],
    ],
  },
  R: {
    id: 'R', label: 'R', name: 'Rゲート(位相回転)', color: '#ffc53d',
    isPhase: true,
  },
  CNOT: {
    id: 'CNOT', label: '●', name: 'CNOTゲート(もつれ)', color: '#7dff6a',
    isCnot: true,
  },
};
