import type { ILLMProvider } from "./providers/ILLMProvider";
import { OllamaProvider } from "./providers/OllamaProvider";
import type { LLMRequest, LLMResponse } from "./types";

/**
 * AI 核心服务，作为与大型语言模型（LLM）交互的统一入口。
 *
 * 这是一个单例类，确保在整个应用程序中只有一个实例。
 * 它负责管理 LLM 提供方（如 Ollama, OpenAI 等），并向它们分发请求。
 */
export class AICoreService {
  private static instance: AICoreService;
  private provider: ILLMProvider;

  /**
   * 私有构造函数，用于初始化服务并设置默认的 LLM 提供方。
   * @private
   */
  private constructor() {
    // 默认使用 OllamaProvider，后续可以根据配置进行扩展
    this.provider = new OllamaProvider();
  }

  /**
   * 获取 AICoreService 的单例实例。
   * @returns {AICoreService} 服务的唯一实例。
   */
  public static getInstance(): AICoreService {
    if (!AICoreService.instance) {
      AICoreService.instance = new AICoreService();
    }
    return AICoreService.instance;
  }

  /**
   * 注册一个新的 LLM 提供方，替换当前使用的提供方。
   * @param {ILLMProvider} provider - 要注册的 LLM 提供方实例。
   */
  public registerProvider(provider: ILLMProvider): void {
    this.provider = provider;
  }

  /**
   * 向当前注册的 LLM 提供方发送请求以生成内容。
   * 这是与 AI 进行交互的主要方法。
   *
   * @param {string} prompt - 要发送给 LLM 的主提示。
   * @param {Record<string, any>} [context] - 可选的上下文对象，包含额外信息。
   * @returns {Promise<LLMResponse>} 一个包含 LLM 响应的 Promise。
   */
  public async generate(prompt: string, context?: Record<string, any>): Promise<LLMResponse> {
    const request: LLMRequest = { prompt, context };
    try {
      return await this.provider.generate(request);
    } catch (error) {
      console.error("[AICoreService] Error during LLM generation:", error);
      return {
        success: false,
        content: "",
        error: error instanceof Error ? error.message : "An unknown error occurred",
      };
    }
  }
}