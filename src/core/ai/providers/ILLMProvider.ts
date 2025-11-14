import type { LLMRequest, LLMResponse } from "../types";

/**
 * 定义了所有大型语言模型（LLM）提供方必须实现的接口。
 * 这确保了系统可以轻松地在不同的 LLM 服务之间切换，例如本地的 Ollama 或云端的 OpenAI。
 */
export interface ILLMProvider {
  /**
   * 向 LLM 发送请求以生成内容。
   *
   * @param request 包含 prompt 和可选上下文的请求对象。
   * @returns 一个解析为 LLMResponse 的 Promise，其中包含生成的内容或错误信息。
   */
  generate(request: LLMRequest): Promise<LLMResponse>;
}