import { singleton } from 'tsyringe';
/**
 * @file 战斗系统
 * @description 负责处理游戏中的所有战斗逻辑。
 */

import type { PlayerState } from '../core/player';
import type { Npc } from '../core/npc';

/**
 * 战斗参与者的基础接口
 */
export interface IBattler {
  name: string;
  stats: {
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
  };
  attributes: {
    strength: number;
    agility: number;
    // ... 其他战斗相关属性
  };
  isAlive: () => boolean;
}

/**
 * 战斗系统的接口，定义了战斗流程的各个阶段。
 */
export interface IBattleSystem {
  startBattle(player: IBattler, enemy: IBattler): void;
  processTurn(): BattleTurnResult;
  endBattle(): BattleResult;
  isBattleActive(): boolean;
}

/**
 * 一回合战斗的结果
 */
export interface BattleTurnResult {
  narration: string; // 回合战斗描述
  playerHpChange: number;
  enemyHpChange: number;
}

/**
 * 整场战斗的结果
 */
export interface BattleResult {
  winner: IBattler;
  loser: IBattler;
  narration: string; // 战斗结束描述
}

/**
 * 一个简单的、基于回合制的战斗系统实现。
 * (当前为占位符实现)
 */
export class BattleSystem implements IBattleSystem {
  private player: IBattler | null = null;
  private enemy: IBattler | null = null;
  private active: boolean = false;

  public startBattle(player: IBattler, enemy: IBattler): void {
    this.player = player;
    this.enemy = enemy;
    this.active = true;
    console.log(`[BattleSystem] 战斗开始！${player.name} vs ${enemy.name}`);
  }

  public processTurn(): BattleTurnResult {
    if (!this.player || !this.enemy || !this.active) {
      throw new Error("战斗未激活，无法处理回合。");
    }

    // 简单的回合制逻辑：双方互砍一刀
    const playerDamage = this.player.attributes.strength;
    const enemyDamage = this.enemy.attributes.strength;

    this.enemy.stats.hp -= playerDamage;
    this.player.stats.hp -= enemyDamage;

    const narration = `${this.player.name}对${this.enemy.name}造成了${playerDamage}点伤害。${this.enemy.name}对${this.player.name}造成了${enemyDamage}点伤害。`;
    
    if (!this.player.isAlive() || !this.enemy.isAlive()) {
      this.endBattle();
    }
    
    return {
      narration,
      playerHpChange: -enemyDamage,
      enemyHpChange: -playerDamage,
    };
  }

  public endBattle(): BattleResult {
    if (!this.player || !this.enemy) {
      throw new Error("战斗状态异常。");
    }
    
    const winner = this.player.isAlive() ? this.player : this.enemy;
    const loser = this.player.isAlive() ? this.enemy : this.player;
    
    const narration = `战斗结束, ${winner.name} 取得了胜利。`;
    
    this.active = false;
    this.player = null;
    this.enemy = null;

    return { winner, loser, narration };
  }

  public isBattleActive(): boolean {
    return this.active;
  }
}

// 需要一个适配器将 PlayerState 和 Npc 转换为 IBattler
export function createBattlerFromPlayer(player: PlayerState): IBattler {
    return {
        ...player,
        isAlive: () => player.stats.hp > 0,
    };
}

export function createBattlerFromNpc(npc: Npc): IBattler {
    return {
        ...npc,
        attributes: {
            ...npc.attributes,
            agility: 10, // 假设 NPC 都有 10 点敏捷
        },
        isAlive: () => npc.alive && npc.stats.hp > 0,
    };
}