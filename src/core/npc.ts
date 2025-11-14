/**
 * 定义一个战斗参与者的基本状态
 * 玩家和 NPC 都将实现此接口
 */
export interface Combatant {
  name: string;
  stats: {
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
  };
  attributes: {
    strength: number; // 力量，影响攻击力
    constitution: number; // 根骨，影响防御力
  };
}

/**
 * NPC 的完整数据结构，继承自战斗单元并包含长期演化属性
 */
export interface Npc extends Combatant {
  id: number;
  realm: string; // 境界
  sect?: string; // 门派
  alive: boolean;
  locationId: number; // 所在地点 ID
  reputation: number; // 声望
}


/**
 * 创建一个简单的敌人用于测试
 * @returns 一个 Combatant 对象
 */
export function createBandit(): Combatant {
  return {
    name: '山贼',
    stats: {
      hp: 50,
      maxHp: 50,
      mp: 0,
      maxMp: 0,
    },
    attributes: {
      strength: 12,
      constitution: 8,
    },
  };
}