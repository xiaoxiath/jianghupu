import type { LLMRequest, LLMResponse } from '../types';

/**
 * 定义了所有大型语言模型（LLM）提供方必须实现的接口。
 *
 * 这个接口确保了无论底层是 Ollama, OpenAI, 还是其他任何服务，
 * AICoreService 都能以统一的方式与它们交互。
 */
export interface ILLMProvider {
  /**
   * 向 LLM 发送请求以生成内容。
   * @param {LLMRequest} request - 包含 prompt 和其他上下文的请求对象。
   * @returns {Promise<LLMResponse>} 一个包含 LLM 响应的 Promise。
   */
  generate(request: LLMRequest): Promise<LLMResponse>;
}