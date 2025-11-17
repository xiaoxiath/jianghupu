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

export type NpcType = 'bandit' | 'merchant' | 'quest_giver' | 'skill_master' | 'item_master';

/**
 * NPC 工厂，用于创建不同类型的 NPC
 * @param type NPC 类型
 * @param locationId 所在地点
 * @returns 一个 Npc 对象
 */
export function createNpc(type: NpcType, locationId: number): Npc {
  const baseNpc = {
    id: Date.now() + Math.floor(Math.random() * 1000), // 临时唯一 ID
    realm: '凡人',
    sect: '无',
    alive: true,
    locationId,
    reputation: 0,
    stats: { hp: 100, maxHp: 100, mp: 50, maxMp: 50 },
    attributes: { strength: 10, constitution: 10 },
  };

  switch (type) {
    case 'merchant':
      return {
        ...baseNpc,
        name: '行脚商人',
        // 可在此处为商人添加特定属性，如商品列表
      };
    case 'quest_giver':
      return {
        ...baseNpc,
        name: '忧心忡忡的村民',
        // 可在此处为任务发布者添加特定属性，如任务 ID
      };
    case 'skill_master':
      return {
        ...baseNpc,
        name: '扫地僧',
        realm: '宗师',
      };
    case 'item_master':
      return {
        ...baseNpc,
        name: '多宝先生',
        realm: '大宗师',
      };
    case 'bandit':
    default:
      const bandit = createBandit();
      return {
        ...baseNpc,
        ...bandit,
      };
  }
}