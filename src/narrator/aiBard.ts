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
  legacySummary?: string; // 关于前代角色的故事
  tone: '宿命' | '诙谐' | '哲理' | '疯癫';
}

/**
 * 说书人模型返回的结构。
 */
export interface BardOutput {
  narration: string;
  options: string[];
}

// --- Prompt Engineering ---

/**
 * 根据设计文档构建发送给 LLM 的完整 Prompt 文本。
 * @see docs/ai-narrator-design.md#31-通用-prompt-结构
 */
function buildPromptText(prompt: BardPrompt): string {
  const { playerState, worldContext, sceneSummary, legacySummary, tone } = prompt;

  // 简化玩家状态以减少 token 消耗
  const playerStatus = `姓名: ${playerState.name}, 境界: ${playerState.realm}, 气血: ${playerState.stats.hp}/${playerState.stats.maxHp}, 内力: ${playerState.stats.mp}/${playerState.stats.maxMp}, 心境: ${playerState.mood || '平静'}, 最近事件: ${playerState.last_action_result || '无'}`;
  
  const legacyContext = legacySummary ? `- 历史传承: ${legacySummary}` : '';

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
- 世界时间: ${worldContext.time}
- 当前地点: ${worldContext.location.name}。${worldContext.location.description}
- 玩家状态: ${playerStatus}
- 世界摘要: ${worldContext.summary || '江湖暂无大事。'}
- 当前场景: ${sceneSummary}

# Task:
1.  **生动叙事**: 基于以上情境，用不超过 100 字的篇幅，描绘一幅富有画面感的场景。请加入细节，如光影、声音、气味、氛围等，并巧妙地融入你【${tone}】的语言风格。
2.  **提供选项**: 提供 3-4 个供玩家选择的行动选项。选项不仅是行动，更应体现出不同的态度、语气或策略。选项应简洁且充满想象空间，并以数字列表格式呈现。
3.  **风格一致**: 确保你的叙述和选项都完全符合你【${tone}】的性格。

# Output Format:
严格按照以下 JSON 格式输出，不要包含任何额外的解释或标记。
{
  "narration": "你的叙事文本...",
  "options": [
    "1. 第一个选项",
    "2. 第二个选项",
    "3. 第三个选项"
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
    const content: BardOutput = JSON.parse(result.response);
    
    // 校验返回的结构
    if (typeof content.narration !== 'string' || !Array.isArray(content.options)) {
      throw new Error('Invalid JSON structure from LLM. Received: ' + JSON.stringify(content));
    }

    return content;

  } catch (error) {
    console.error('Error calling Ollama API:', error);
    // 在开发或 API 失败时返回一个备用响应
    return {
      narration: '（AI说书人暂时走神了，一股神秘的力量让你看到了世界的真实面貌。）',
      options: [
        '1. [调试] 检查 Ollama 服务是否运行',
        '2. [调试] 查看控制台错误日志',
        '3. [调试] 尝试使用不同的模型',
      ],
    };
  }
}