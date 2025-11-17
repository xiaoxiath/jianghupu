import { type Combatant } from '../core/npc.js';
import { renderer } from '../ui/renderer.js';
import { container } from 'tsyringe';
import { GameStore } from '../core/store/store.js';
import { addExp } from './cultivation.js';

export type CombatResult = 'win' | 'lose' | 'flee';

/**
 * 计算伤害
 * @param attacker 攻击者
 * @param defender 防御者
 * @returns 造成的伤害值
 */
function calculateDamage(attacker: Combatant, defender: Combatant): number {
  const damage = Math.max(1, attacker.attributes.strength - defender.attributes.constitution);
  return damage;
}

/**
 * 运行一个完整的回合制战斗
 * @param enemy 敌人
 * @returns 战斗结果
 */
export async function startCombat(enemy: Combatant): Promise<CombatResult> {
  renderer.system(`你遭遇了 ${enemy.name}！`);

  const store = container.resolve(GameStore);
  const player = store.getState().player;

  while (player.stats.hp > 0 && enemy.stats.hp > 0) {
    // 玩家回合
    renderer.narrator(`你的回合。`);
    const playerDamage = calculateDamage(player, enemy);
    enemy.stats.hp -= playerDamage;
    renderer.system(`你对 ${enemy.name} 造成了 ${playerDamage} 点伤害。${enemy.name} 剩余气血: ${enemy.stats.hp}`);

    if (enemy.stats.hp <= 0) {
      renderer.system(`你击败了 ${enemy.name}！`);
      addExp(50); // 战斗胜利，获得 50 经验
      return 'win';
    }

    // 敌人回合
    renderer.narrator(`${enemy.name} 的回合。`);
    const enemyDamage = calculateDamage(enemy, player);
    player.stats.hp -= enemyDamage;
    renderer.error(`${enemy.name} 对你造成了 ${enemyDamage} 点伤害。你剩余气血: ${player.stats.hp}`);

    if (player.stats.hp <= 0) {
      renderer.error('你被击败了...');
      return 'lose';
    }
  }

  // 理论上不会执行到这里，但在 TS 严格模式下需要一个返回值
  return player.stats.hp > 0 ? 'win' : 'lose';
}