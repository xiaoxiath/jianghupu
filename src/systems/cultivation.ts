import type { PlayerState } from '../core/player.js';
import { GameStore } from '../core/store/store.js';
import { renderer } from '../ui/renderer.js';

/**
 * 计算到达下一级所需的经验值
 * @param level 当前等级
 * @returns 所需的总经验值
 */
export function getExpForNextLevel(level: number): number {
  // 每级所需经验递增，例如：100, 200, 300...
  return level * 100;
}

/**
 * 玩家升级逻辑
 */
export function levelUp(player: PlayerState) {
  player.level++;
  player.xp = 0; // 经验值清零或保留超出部分，这里简化为清零

  // 升级奖励：属性点增加
  player.attributes.strength += 1;
  player.attributes.constitution += 1;
  player.attributes.intelligence += 1;
  player.attributes.agility += 1;

  // 升级奖励：完全恢复气血和内力
  player.stats.hp = player.stats.maxHp;
  player.stats.mp = player.stats.maxMp;

  renderer.player(`恭喜你，成功突破到 ${player.level} 级！`);
  renderer.player(`你的各项属性得到了提升，气血和内力已完全恢复。`);
}

/**
 * 为玩家增加经验值，并处理升级
 * @param exp 获得的经验值
 */
export function addExp(exp: number, store: GameStore) {
  store.dispatch({ type: 'ADD_EXP', payload: { exp } });
  renderer.system(`你获得了 ${exp} 点经验。`);

  const player = store.state.player;
  const requiredExp = getExpForNextLevel(player.level);
  if (player.xp < requiredExp) {
    renderer.system(`当前经验: ${player.xp}/${requiredExp}`);
  }
}