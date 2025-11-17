/**
 * @file Narrative Dispatcher
 * @description 根据上下文和规则，将叙事生成请求分发到不同的层级（模板、轻量模型、重量级模型）。
 */
import { singleton, inject } from 'tsyringe';
import { AICoreService } from '../core/ai/AICoreService';
import { PromptManager } from './promptManager';
import { TemplateEngine } from './templateEngine';
import { CostMonitorService } from '../core/monitoring/costMonitorService';
import aiConfig from '../config/ai';
import * as fs from 'fs';
import * as path from 'path';
import type { BardPrompt, BardOutput, RawLLMOption, TradeInfo, SkillMasterInfo, ItemIdentificationInfo } from './aiBard';
import type { EventChoice } from '../core/events/types';

// 定义叙事层级
export enum NarrativeLayer {
  L0_Template = 'L0_Template', // 模板层，用于高频、简单事件
  L1_LightLLM = 'L1_LightLLM', // 轻量级模型，用于中等复杂度的叙事
  L2_HeavyLLM = 'L2_HeavyLLM', // 重量级模型，用于关键剧情和复杂场景
}

// 定义分发上下文
export interface DispatchContext extends BardPrompt {
  // 未来可以扩展更多用于决策的字段，如 eventType, importance 等
  eventType?: string;
  importance?: number;
}

interface NarrativeRule {
  comment?: string;
  conditions: Partial<DispatchContext>;
  layer: NarrativeLayer;
  model?: string;
}

const STYLE_INSTRUCTIONS = {
  '宿命': '你的语言风格苍凉、厚重，多用“终将”、“劫数”、“天意如此”等词语，强调因果循环和命运的不可抗拒。',
  '诙谐': '你的语言风格轻松、幽默，略带调侃，常用“不料”、“偏生”、“竟”等词语，善于发现情境中有趣或矛盾的一面。',
  '哲理': '你的语言风格引人深思，喜欢探讨人心、善恶、侠之定义，常用“何为...”、“道与魔”、“一念之间”等句式。',
  '疯癫': '你的语言风格混乱、无序，充满呓语和不连贯的片段，常常夹杂着“嘿嘿”、“血”、“杀”等词语，令人不寒而栗。'
};

@singleton()
export class NarrativeDispatcher {
  private rules: NarrativeRule[] = [];

  constructor(
    @inject(AICoreService) private aiService: AICoreService,
    @inject(PromptManager) private promptManager: PromptManager,
    @inject(TemplateEngine) private templateEngine: TemplateEngine,
    @inject(CostMonitorService) private costMonitor: CostMonitorService
  ) {
    this.loadRules();
  }

  private loadRules() {
    try {
      // Correctly resolve path from the project root
      const rulesPath = path.resolve(process.cwd(), 'src', 'config', 'narrative_rules.json');
      const rulesFile = fs.readFileSync(rulesPath, 'utf-8');
      this.rules = JSON.parse(rulesFile).rules;
      console.log(`[NarrativeDispatcher] Loaded ${this.rules.length} narrative rules.`);
    } catch (error) {
      console.error('[NarrativeDispatcher] Failed to load narrative rules:', error);
      // 在没有规则的情况下，系统将回退到默认行为
      this.rules = [];
    }
  }

  /**
   * 根据上下文决定使用哪个叙事层级。
   * @param context - The dispatch context.
   * @returns The determined narrative layer.
   */
  private determineLayer(context: DispatchContext): { layer: NarrativeLayer; model?: string } {
    for (const rule of this.rules) {
      const conditions = rule.conditions;
      const isMatch = (Object.keys(conditions) as Array<keyof typeof conditions>).every(key => {
        return conditions[key] === context[key];
      });

      if (isMatch) {
        console.log(`[NarrativeDispatcher] Matched rule: ${rule.comment || 'Untitled Rule'}`);
        return { layer: rule.layer, model: rule.model };
      }
    }

    // 默认返回重量级模型层
    return { layer: NarrativeLayer.L2_HeavyLLM };
  }

  /**
   * 将叙事请求分发到适当的层级。
   * @param context - The full context for generating a narrative.
   * @returns A promise that resolves to the generated BardOutput.
   */
  public async dispatch(context: DispatchContext): Promise<BardOutput> {
    const { layer, model } = this.determineLayer(context);

    switch (layer) {
      case NarrativeLayer.L0_Template:
        console.log('Dispatching to L0 Template Engine...');
        const templateOutput = await this.templateEngine.render(`${context.eventType}.njk`, context);
        if (templateOutput) {
          return templateOutput;
        }
        console.warn(`Template rendering failed for "${context.eventType}". Falling back to L2.`);
        return this.generateWithHeavyLLM(context);
      case NarrativeLayer.L1_LightLLM:
        console.log(`Dispatching to L1 Light LLM (Model: ${model})...`);
        if (!model) {
          console.error('L1 LightLLM rule is missing a "model" definition. Falling back to L2.');
          return this.generateWithHeavyLLM(context);
        }
        return this.generateWithLightLLM(context, model);
      case NarrativeLayer.L2_HeavyLLM:
        console.log('Dispatching to L2 Heavy LLM...');
        return this.generateWithHeavyLLM(context);
      default:
        throw new Error(`Unknown narrative layer: ${layer}`);
    }
  }

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

  public async generateTradeScene(playerState: any, worldContext: any): Promise<TradeInfo | null> {
    const templateData = {
      player: playerState,
      location_name: worldContext.location.name,
    };
    const fullPrompt = this.promptManager.buildPrompt('trader', templateData);
    const response = await this.generateRaw(fullPrompt);
    return this._parseJsonResponse<TradeInfo>(response, 'Trader AI');
  }

  public async generateSkillMasterScene(playerState: any): Promise<SkillMasterInfo | null> {
    const templateData = { player: playerState };
    const fullPrompt = this.promptManager.buildPrompt('skill_master', templateData);
    const response = await this.generateRaw(fullPrompt);
    return this._parseJsonResponse<SkillMasterInfo>(response, 'Skill Master AI');
  }

  public async identifyItem(item: any): Promise<ItemIdentificationInfo | null> {
    const templateData = { item_to_identify: item };
    const fullPrompt = this.promptManager.buildPrompt('item_master', templateData);
    const response = await this.generateRaw(fullPrompt);
    return this._parseJsonResponse<ItemIdentificationInfo>(response, 'Item Master AI');
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

  private async generateWithLightLLM(promptData: DispatchContext, model: string): Promise<BardOutput> {
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
    console.log(`🤖 AI Bard (Light) is thinking... Model: ${model}, Style: ${promptData.tone}`);

    const response = await this.aiService.generate({
      prompt: fullPrompt,
      format: 'json',
      model: model, // 传递模型名称
    });

    this.costMonitor.recordCall({
      layer: NarrativeLayer.L1_LightLLM,
      model,
      ...response.metadata,
    });

    return this._parseAndProcessLLMResponse(response);
  }

  private async generateWithHeavyLLM(promptData: DispatchContext): Promise<BardOutput> {
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
    console.log('🤖 AI Bard (Heavy) is thinking... Style: ' + promptData.tone);

    const response = await this.aiService.generate({
      prompt: fullPrompt,
      format: 'json',
      // No model specified, so it will use the default heavy model from config
    });

    this.costMonitor.recordCall({
      layer: NarrativeLayer.L2_HeavyLLM,
      model: aiConfig.config.model, // 从配置中获取默认的重量级模型名称
      ...response.metadata,
    });

    return this._parseAndProcessLLMResponse(response);
  }

  private _parseAndProcessLLMResponse(response: { success: boolean; content: string | null; error?: string }): BardOutput {
    if (!response.success || !response.content) {
      console.error('Error calling AI Core Service:', response.error);
      return {
        narration: '（AI说书人暂时走神了，一股神秘的力量让你看到了世界的真实面貌。）',
        options: [
          { text: '1. [调试] 检查 Ollama 服务是否运行', action: 'debug' },
          { text: '2. [调试] 查看控制台错误日志', action: 'debug' },
          { text: '3. [调试] 尝试使用不同的模型', action: 'debug' },
        ],
      };
    }

    const parsedContent = this._parseJsonResponse<{ narration: string; options: RawLLMOption[] }>(response, 'Narrator AI');

    if (!parsedContent) {
      return {
        narration: '（AI说书人言语错乱，似乎看到了无法理解的景象。）',
        options: [
          { text: '1. [调试] 检查返回的 JSON 结构是否正确', action: 'debug' },
          { text: '2. [调试] 查看 narrativeDispatcher.ts 中的解析逻辑', action: 'debug' },
        ],
      };
    }

    try {
      if (typeof parsedContent.narration !== 'string') {
        throw new Error(`LLM response is missing narration: ${JSON.stringify(parsedContent)}`);
      }

      let finalOptions: EventChoice[];

      if (Array.isArray(parsedContent.options) && parsedContent.options.length > 0) {
        finalOptions = parsedContent.options
          .map((opt: RawLLMOption) => ({
            text: (typeof opt.text === 'string' ? opt.text.replace(/^\d+\.\s*/, '').trim() : ''),
            action: 'narrate',
            result: opt.result || { description: `你选择了"${opt.text}"` },
          }))
          .filter(opt => opt.text.length > 0);
      } else {
        finalOptions = [];
      }

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
      console.error('Error processing AI response in dispatcher:', error);
      return {
        narration: '（AI说书人言语错乱，似乎看到了无法理解的景象。）',
        options: [
          { text: '1. [调试] 检查返回的 JSON 结构是否正确', action: 'debug' },
          { text: '2. [调试] 查看 narrativeDispatcher.ts 中的解析逻辑', action: 'debug' },
        ],
      };
    }
  }

  private _parseJsonResponse<T>(
    response: { success: boolean; content: string | null; error?: string },
    aiName: string = 'AI'
  ): T | null {
    if (!response.success || !response.content) {
      console.error(`${aiName} failed to respond:`, response.error);
      return null;
    }

    try {
      let jsonString = response.content;
      const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
      const potentialJson = jsonMatch ? jsonMatch[1] || jsonMatch[2] : null;

      if (potentialJson) {
        jsonString = potentialJson;
      } else {
        const startIndex = jsonString.indexOf('{');
        const endIndex = jsonString.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          jsonString = jsonString.substring(startIndex, endIndex + 1);
        } else {
          throw new Error(`Could not find a valid JSON object in the response: ${response.content}`);
        }
      }
      
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error(`Failed to parse ${aiName} response:`, error, "Raw response:", response.content);
      return null;
    }
  }
}