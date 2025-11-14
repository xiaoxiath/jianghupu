/**
 * @file AI 说书人接口
 * @description 负责与大语言模型（LLM）交互，生成游戏叙事和选项。
 * @see docs/ai-narrator-design.md
 * @see docs/technical_design.md#4-ai-说书人模块aibardts
 */

import type { PlayerState } from '../core/player';
import type { World, Location } from '../core/world';

// --- Configuration ---

const OLLAMA_CONFIG = {
  // 确保你的本地 Ollama 服务正在运行
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  // 使用一个适合生成 JSON 的模型, e.g., phi3, llama3
  model: process.env.OLLAMA_MODEL || 'deepseek-r1:7b',
};

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
import type { EventChoice } from '../core/eventEngine';

export interface BardOutput {
  narration: string;
  options: EventChoice[];
}

// --- Prompt Engineering ---

/**
 * 根据设计文档构建发送给 LLM 的完整 Prompt 文本。
 * @see docs/ai-narrator-design.md#31-通用-prompt-结构
 */
function buildPromptText(prompt: BardPrompt): string {
  const { playerState, worldContext, sceneSummary, factionContext, legacySummary, tone } = prompt;

  // 简化玩家状态以减少 token 消耗
  const playerStatus = `姓名: ${playerState.name}, 境界: ${playerState.realm}, 气血: ${playerState.stats.hp}/${playerState.stats.maxHp}, 内力: ${playerState.stats.mp}/${playerState.stats.maxMp}, 心境: ${playerState.mood || '平静'}, 最近事件: ${playerState.last_action_result || '无'}`;
  
  const legacyContext = legacySummary ? `- 历史传承: ${legacySummary}` : '';
  const factionInfo = factionContext ? `- 最近江湖动态: ${factionContext}` : '';

  // 根据不同风格，定义更具体的指令
  const styleInstructions = {
    '宿命': '你的语言风格苍凉、厚重，多用“终将”、“劫数”、“天意如此”等词语，强调因果循环和命运的不可抗拒。',
    '诙谐': '你的语言风格轻松、幽默，略带调侃，常用“不料”、“偏生”、“竟”等词语，善于发现情境中有趣或矛盾的一面。',
    '哲理': '你的语言风格引人深思，喜欢探讨人心、善恶、侠之定义，常用“何为...”、“道与魔”、“一念之间”等句式。',
    '疯癫': '你的语言风格混乱、无序，充满呓语和不连贯的片段，常常夹杂着“嘿嘿”、“血”、“杀”等词语，令人不寒而栗。'
  };

  return `
# Role: 你是一位《江湖残卷》的说书人。
# Style: 你的核心风格是【${tone}】。${styleInstructions[tone] || ''}

# Context:
${legacyContext}
${factionInfo}
- 世界时间: ${worldContext.time}
- 当前地点: ${worldContext.location.name}。${worldContext.location.description}
- 玩家状态: ${playerStatus}
- 世界摘要: ${worldContext.summary || '江湖暂无大事。'}
- 当前场景: ${sceneSummary}

# Task:
1.  **生动叙事**: 基于以上情境，用不超过 100 字的篇幅，描绘一幅富有画面感的场景。请加入细节，如光影、声音、气味、氛围等，并巧妙地融入你【${tone}】的语言风格。
2.  **提供选项**: 提供 3-4 个供玩家选择的行动选项。每个选项都必须是描述具体行动的短语或句子，例如“拔剑环顾四周”或“默不作声，静观其变”。选项应简洁且充满想象空间，绝不能是空的或只有数字。
3.  **风格一致**: 确保你的叙述和选项都完全符合你【${tone}】的性格。

# Output Format:
严格按照以下 JSON 格式输出，不要包含任何额外的解释或标记。
{
  "narration": "你的叙事文本...",
  "options": [
    "1. (例子：一个具体的、与场景相关的行动选项),
    "2. (例子：另一个具体行动选项)",
    "3. (例子：充满想象空间的行动)"
  ]
}
`;
}

// --- API Interaction ---

/**
 * 调用本地 Ollama LLM 生成叙事。
 * @param promptData - The structured prompt data.
 * @returns The generated narration and options.
 */
export async function generateNarration(promptData: BardPrompt): Promise<BardOutput> {
  const fullPrompt = buildPromptText(promptData);
  console.log('🤖 AI Bard is thinking... Style: ' + promptData.tone);
  // console.debug('Full prompt:', fullPrompt); // 取消注释以调试

  try {
    const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_CONFIG.model,
        prompt: fullPrompt,
        format: 'json', // 请求 Ollama 直接输出 JSON
        stream: false, // 我们需要完整的 JSON 对象
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API request failed with status ${response.status}: ${await response.text()}`);
    }

    // 为 Ollama 的响应定义一个类型
    const result = (await response.json()) as { response: string };
    
    // 解析 Ollama 返回的 JSON 字符串
    console.log('[Debug] Ollama raw response string:', result.response);
    
    let parsedContent: { narration: string; options: string[] };
    try {
      // Ollama 有时会返回被包裹在 ```json ... ``` 中的代码块，或者其他非JSON字符
      const jsonString = result.response.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedContent = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse LLM JSON response:", e, "Raw response:", result.response);
      throw new Error(`Invalid JSON from LLM: ${result.response}`);
    }

    // 确保 narration 存在
    if (!parsedContent || typeof parsedContent.narration !== 'string') {
      throw new Error(`LLM response is missing narration: ${JSON.stringify(parsedContent)}`);
    }

    let cleanedOptions: string[];

    // 检查 options 是否存在且为有效数组
    if (Array.isArray(parsedContent.options) && parsedContent.options.length > 0) {
      cleanedOptions = parsedContent.options
        .map(opt => (typeof opt === 'string' ? opt.replace(/^\d+\.\s*/, '').trim() : ''))
        .filter(opt => opt.length > 1);
    } else {
      // 如果 options 缺失或无效，则不进行任何操作，后续逻辑会处理
      cleanedOptions = [];
    }

    // 如果清理后没有有效选项，则提供一个默认选项以继续游戏
    if (cleanedOptions.length === 0) {
      console.warn(`LLM returned empty or invalid options. Providing a default option. Raw options: ${JSON.stringify(parsedContent.options)}`);
      cleanedOptions = ['继续...'];
    }

    // 将 string[] 转换为 EventChoice[]
    const finalOutput: BardOutput = {
        narration: parsedContent.narration,
        options: cleanedOptions.map(opt => ({ text: opt, action: 'narrate' }))
    };

    return finalOutput;

  } catch (error) {
    console.error('Error calling Ollama API:', error);
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
}