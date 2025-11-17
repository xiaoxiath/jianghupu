/**
 * @file AI 说书人接口
 * @description 负责与大语言模型（LLM）交互，生成游戏叙事和选项。
 * @see docs/ai-narrator-design.md
 * @see docs/technical_design.md#4-ai-说书人模块aibardts
 */

import type { PlayerState } from '../core/player';
import type { World, Location } from '../core/world';
import { AICoreService } from '../core/ai/AICoreService';
import { singleton, inject } from 'tsyringe';
import { PromptManager } from './promptManager.js';

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
interface RawLLMOption {
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

const STYLE_INSTRUCTIONS = {
  '宿命': '你的语言风格苍凉、厚重，多用“终将”、“劫数”、“天意如此”等词语，强调因果循环和命运的不可抗拒。',
  '诙谐': '你的语言风格轻松、幽默，略带调侃，常用“不料”、“偏生”、“竟”等词语，善于发现情境中有趣或矛盾的一面。',
  '哲理': '你的语言风格引人深思，喜欢探讨人心、善恶、侠之定义，常用“何为...”、“道与魔”、“一念之间”等句式。',
  '疯癫': '你的语言风格混乱、无序，充满呓语和不连贯的片段，常常夹杂着“嘿嘿”、“血”、“杀”等词语，令人不寒而栗。'
};

// --- API Interaction ---
@singleton()
export class AIBard {
  constructor(
    @inject(AICoreService) private aiService: AICoreService,
    @inject(PromptManager) private promptManager: PromptManager
  ) {}

  /**
   * 调用本地 Ollama LLM 生成叙事。
   * @param promptData - The structured prompt data.
   * @returns The generated narration and options.
   */
  public async generateRaw(prompt: string): Promise<{ success: boolean; content: string | null; error?: string }> {
    const response = await this.aiService.generate({
      prompt: prompt,
      format: 'json',
    });
    if (!response.success || !response.content) {
      return { success: false, content: null, error: response.error };
    }
    return { success: true, content: response.content };
  }

  public buildStoryEnginePrompt(data: Record<string, any>): string {
    return this.promptManager.buildPrompt('story_engine', data);
  }

  public async generateTradeScene(playerState: any, worldContext: any): Promise<TradeInfo | null> {
    const templateData = {
      player: playerState,
      location_name: worldContext.location.name,
    };
    const fullPrompt = this.promptManager.buildPrompt('trader', templateData);
    const response = await this.generateRaw(fullPrompt);

    if (!response.success || !response.content) {
      console.error('Trader AI failed to respond.');
      return null;
    }

    try {
      const jsonString = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonString) as TradeInfo;
    } catch (error) {
      console.error('Failed to parse Trader AI response:', error);
      return null;
    }
  }

  public async generateSkillMasterScene(playerState: any): Promise<SkillMasterInfo | null> {
    const templateData = { player: playerState };
    const fullPrompt = this.promptManager.buildPrompt('skill_master', templateData);
    const response = await this.generateRaw(fullPrompt);

    if (!response.success || !response.content) {
      console.error('Skill Master AI failed to respond.');
      return null;
    }

    try {
      const jsonString = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonString) as SkillMasterInfo;
    } catch (error) {
      console.error('Failed to parse Skill Master AI response:', error);
      return null;
    }
  }

  public async identifyItem(item: any): Promise<ItemIdentificationInfo | null> {
    const templateData = { item_to_identify: item };
    const fullPrompt = this.promptManager.buildPrompt('item_master', templateData);
    const response = await this.generateRaw(fullPrompt);

    if (!response.success || !response.content) {
      console.error('Item Master AI failed to respond.');
      return null;
    }

    try {
      const jsonString = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonString) as ItemIdentificationInfo;
    } catch (error) {
      console.error('Failed to parse Item Master AI response:', error);
      return null;
    }
  }

  public async generateNpcGrowthNarrative(npc: any, oldStrength: number, newStrength: number): Promise<string | null> {
    const templateData = {
      npc,
      old_strength: oldStrength,
      new_strength: newStrength,
    };
    const fullPrompt = this.promptManager.buildPrompt('npc_growth', templateData);
    const response = await this.aiService.generate({
      prompt: fullPrompt,
    });

    if (!response.success || !response.content) {
      console.error('NPC Growth AI failed to respond.');
      return null;
    }

    return response.content;
  }

  public async generateNarration(promptData: BardPrompt): Promise<BardOutput> {
    const templateData = {
      ...promptData.playerState,
      ...promptData.worldContext,
      ...promptData,
      location_name: promptData.worldContext.location.name,
      location_description: promptData.worldContext.location.description,
      world_summary: promptData.worldContext.summary,
      legacy_summary: promptData.legacySummary || '无',
      faction_context: promptData.factionContext || '无',
      style_instruction: STYLE_INSTRUCTIONS[promptData.tone] || '',
    };
    
    const fullPrompt = this.promptManager.buildPrompt('narrator', templateData);
    console.log('🤖 AI Bard is thinking... Style: ' + promptData.tone);

    const response = await this.aiService.generate({
      prompt: fullPrompt,
      format: 'json',
    });

    if (!response.success || !response.content) {
      console.error('Error calling AI Core Service:', response.error);
      // 在开发或 API 失败时返回一个备用响应
      return {
        narration: '（AI说书人暂时走神了，一股神秘的力量让你看到了世界的真实面貌。）',
        options: [
          { text: '1. [调试] 检查 Ollama 服务是否运行', action: 'debug' },
          { text: '2. [调试] 查看控制台错误日志', action: 'debug' },
          { text: '3. [调试] 尝试使用不同的模型', action: 'debug' },
        ],
      };
    }

    try {
      // 解析 LLM 返回的 JSON 字符串
      // console.log('[Debug] AI Core Service raw response string:', response.content);
      
      let parsedContent: { narration: string; options: RawLLMOption[] };
      try {
        // LLM 有时会返回被包裹在 ```json ... ``` 中的代码块，或者其他非JSON字符
        const jsonString = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedContent = JSON.parse(jsonString);
      } catch (e) {
        console.error("Failed to parse LLM JSON response:", e, "Raw response:", response.content);
        throw new Error(`Invalid JSON from LLM: ${response.content}`);
      }

      // 确保 narration 存在
      if (!parsedContent || typeof parsedContent.narration !== 'string') {
        throw new Error(`LLM response is missing narration: ${JSON.stringify(parsedContent)}`);
      }

      let finalOptions: EventChoice[];

      // 检查 options 是否存在且为有效数组
      if (Array.isArray(parsedContent.options) && parsedContent.options.length > 0) {
        finalOptions = parsedContent.options
          .map(opt => ({
            text: (typeof opt.text === 'string' ? opt.text.replace(/^\d+\.\s*/, '').trim() : ''),
            action: 'narrate', // 默认为叙事动作
            result: opt.result, // 直接传递 result 对象
          }))
          .filter(opt => opt.text.length > 1 && opt.result); // 确保选项文本和结果都存在
      } else {
        finalOptions = [];
      }

      // 如果清理后没有有效选项，则提供一个默认选项以继续游戏
      if (finalOptions.length === 0) {
        console.warn(`LLM returned empty or invalid options. Providing a default option. Raw options: ${JSON.stringify(parsedContent.options)}`);
        finalOptions = [{
          text: '继续...',
          action: 'narrate',
          result: { description: '你决定继续前行。' }
        }];
      }

      const finalOutput: BardOutput = {
          narration: parsedContent.narration,
          options: finalOptions,
      };

      return finalOutput;

    } catch (error) {
      console.error('Error processing AI response in aiBard:', error);
      // 在解析或处理成功返回的 AI 内容时出错
      return {
        narration: '（AI说书人言语错乱，似乎看到了无法理解的景象。）',
        options: [
          { text: '1. [调试] 检查返回的 JSON 结构是否正确', action: 'debug' },
          { text: '2. [调试] 查看 aiBard.ts 中的解析逻辑', action: 'debug' },
        ],
      };
    }
  }
}
