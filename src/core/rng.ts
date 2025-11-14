import seedrandom from 'seedrandom';

let rng: seedrandom.PRNG;

/**
 * 初始化随机数生成器
 * @param seed 随机种子
 */
export function initializeRNG(seed: string) {
  rng = seedrandom(seed);
}

/**
 * 获取一个 0 到 1 之间的随机浮点数
 * @returns 随机数
 */
export function getRandom(): number {
  if (!rng) {
    // 如果没有初始化，使用一个默认种子
    initializeRNG('default-seed');
  }
  return rng();
}

/**
 * 获取一个范围内的随机整数
 * @param min 最小值 (含)
 * @param max 最大值 (含)
 * @returns 随机整数
 */
export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(getRandom() * (max - min + 1)) + min;
}