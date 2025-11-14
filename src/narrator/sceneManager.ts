/**
 * @file 叙事场景管理器
 * @description 负责管理游戏的叙事流程，作为 AI 说书人的状态机。
 * @see docs/technical_design.md#4-ai-说书人模块aibardts
 */

import { gameState } from '../core/state';
import { generateNarration, type BardPrompt, type BardOutput } from './aiBard';
import type { Location } from '../core/world';

type NarrativeTone = '宿命' | '诙谐' | '哲理' | '疯癫';

/**
 * 场景管理器，负责驱动 AI 叙事流程
 */
export class SceneManager {
  private currentTone: NarrativeTone = '宿命';

  /**
   * 根据当前游戏状态，生成并返回下一个叙事场景。
   * @param sceneSummary 对当前情况的简要描述，例如“玩家进入了一个新的地点”或“战斗结束了”。
   * @returns AI 生成的叙事和选项。
   */
  public async narrateNextScene(sceneSummary: string, legacySummary?: string): Promise<BardOutput> {
    const { player, world } = gameState;

    // 1. 获取当前地点信息
    const currentLocation = world.locations.get(world.currentLocationId);
    if (!currentLocation) {
      throw new Error(`Invalid currentLocationId: ${world.currentLocationId}`);
    }

    // 2. 准备 Prompt 所需的数据
    const promptData: BardPrompt = {
      playerState: {
        ...player,
        mood: '平静', // TODO: 从玩家状态中获取真实心境
        last_action_result: '无', // TODO: 记录并传入上一个行动的结果
      },
      worldContext: {
        time: '甲子年冬月初三', // TODO: 从时间系统中获取真实时间
        location: currentLocation,
        summary: '魔教最近攻陷了华山。', // TODO: 从世界事件引擎中获取摘要
      },
      sceneSummary,
      legacySummary,
      tone: this.currentTone,
    };

    // 3. 调用 AI 说书人
    const output = await generateNarration(promptData);

    // 4. (可选) 在此可以添加一些逻辑，比如根据返回的选项更新游戏状态

    return output;
  }

  /**
   * 切换说书人的叙事风格。
   * @param tone 新的叙事风格
   */
  public setTone(tone: NarrativeTone): void {
    this.currentTone = tone;
    console.log(`说书人风格已切换为: ${tone}`);
  }
}

// 创建一个单例的 SceneManager
export const sceneManager = new SceneManager();