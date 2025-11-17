/**
 * @file AI 说书人接口
 * @description 负责与大语言模型（LLM）交互，生成游戏叙事和选项。
 * @see docs/ai-narrator-design.md
 * @see docs/technical_design.md#4-ai-说书人模块aibardts
 */

import type { PlayerState } from '../core/player';
import type { Location } from '../core/world';
import { singleton, inject } from 'tsyringe';
import { PromptManager } from './promptManager.js';
import { NarrativeDispatcher } from './narrativeDispatcher.js';

// --- Type Definitions ---

/**
 * 扩展基础 PlayerState 以包含叙事所需的瞬时状态。
 * 这些字段在核心 PlayerState 中不存在，但在 API 规范中是必需的。
 * @see docs/api-specification.md#31-ai-叙事生成
 */
type NarrativePlayerState = PlayerState & {
  mood?: string; // 心境
  last_action_result?: string; // 最近事件
};

/**
 * AI 叙事所需的特定世界上下文。
 */
interface NarrativeWorldContext {
  time: string; // 游戏内时间
  location: Location; // 当前地点
  summary: string; // 世界事件摘要
}

/**
 * 发送给说书人模型的 Prompt 结构。
 */
export interface BardPrompt {
  playerState: NarrativePlayerState;
  worldContext: NarrativeWorldContext;
  sceneSummary: string;
  factionContext?: string; // 新增：关于门派势力的动态信息
  legacySummary?: string; // 关于前代角色的故事
  tone: '宿命' | '诙谐' | '哲理' | '疯癫';
}

/**
 * 说书人模型返回的结构。
 */
import type { EventChoice, EventResult } from '../core/events/types.js';

export interface BardOutput {
  narration: string;
  options: EventChoice[];
}

/**
 * LLM 返回的原始选项结构
 */
export interface RawLLMOption {
  text: string;
  result: EventResult;
}

export interface TradeInfo {
  dialogue: string;
  goods: { name: string; description: string; buy_price: number }[];
  acquisitions: { name: string; sell_price: number }[];
}

export interface SkillMasterInfo {
  dialogue: string;
  opportunities: {
    type: 'learn_skill' | 'improve_skill' | 'improve_attribute';
    text: string;
    skill?: { name: string; description: string; effect: any };
    skill_name?: string;
    improvement?: any;
  }[];
}

export interface ItemIdentificationInfo {
  dialogue: string;
  identification: {
    original_name: string;
    true_name: string;
    story: string;
    revealed_effects: any[];
  };
}


// --- API Interaction ---
@singleton()
export class AIBard {
  constructor(
    @inject(PromptManager) private promptManager: PromptManager,
    @inject(NarrativeDispatcher) private dispatcher: NarrativeDispatcher
  ) {}

  /**
   * 调用本地 Ollama LLM 生成叙事。
   * @param promptData - The structured prompt data.
   * @returns The generated narration and options.
   */
  public async generateRaw(prompt: string): Promise<{ success: boolean; content: string | null; error?: string }> {
    return this.dispatcher.generateRaw(prompt);
  }

  public buildStoryEnginePrompt(data: Record<string, any>): string {
    return this.promptManager.buildPrompt('story_engine', data);
  }

  public async generateTradeScene(playerState: any, worldContext: any): Promise<TradeInfo | null> {
    return this.dispatcher.generateTradeScene(playerState, worldContext);
  }

  public async generateSkillMasterScene(playerState: any): Promise<SkillMasterInfo | null> {
    return this.dispatcher.generateSkillMasterScene(playerState);
  }

  public async identifyItem(item: any): Promise<ItemIdentificationInfo | null> {
    return this.dispatcher.identifyItem(item);
  }

  public async generateNpcGrowthNarrative(npc: any, oldStrength: number, newStrength: number): Promise<string | null> {
    return this.dispatcher.generateNpcGrowthNarrative(npc, oldStrength, newStrength);
  }

  public async generateNarration(promptData: BardPrompt): Promise<BardOutput> {
    // 将请求委托给分发器
    return this.dispatcher.dispatch(promptData);
  }
}
