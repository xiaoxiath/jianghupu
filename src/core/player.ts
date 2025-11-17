import type { Item } from './item';

/**
 * 玩家的基础属性
 */
export interface PlayerAttributes {
  strength: number; // 力量
  constitution: number; // 根骨
  intelligence: number; // 悟性
  agility: number; // 身法
}

/**
 * 玩家的战斗/状态属性
 */
export interface PlayerStats {
  hp: number; // 当前气血
  maxHp: number; // 最大气血
  mp: number; // 当前内力
  maxMp: number; // 最大内力
}

/**
 * 玩家的境界
 */
export type PlayerRealm = '凡人' | '练气' | '真气' | '先天' | '宗师';

/**
 * 玩家的完整状态
 */
export interface PlayerState {
  name: string;
  level: number; // 等级
  xp: number; // 当前经验
  attributes: PlayerAttributes;
  stats: PlayerStats;
  realm: PlayerRealm;
  alignment: '正' | '邪' | '中立';
  mood: string; // 心境
  triggeredOnceEvents: string[]; // 已经触发过的 once 事件 ID
  inventory: Item[]; // 物品栏
}

/**
 * 创建一个初始玩家状态
 * @param name 玩家姓名
 * @returns 初始玩家状态
 */
export function createInitialPlayer(name: string): PlayerState {
  return {
    name,
    level: 1,
    xp: 0,
    attributes: {
      strength: 10,
      constitution: 10,
      intelligence: 10,
      agility: 10,
    },
    stats: {
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
    },
    realm: '凡人',
    alignment: '中立',
    mood: '平静',
    triggeredOnceEvents: [],
    inventory: [{ name: '金创药' }, { name: '生锈的铁剑' }],
  };
}