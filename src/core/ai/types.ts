/**
 * @file 定义与 AI 核心服务交互的通用类型。
 */

/**
 * 向 LLM 发送的请求结构。
 */
export interface LLMRequest {
  prompt: string;
  // `context` 用于传递额外的情境信息，例如玩家状态、NPC 信息等。
  context?: Record<string, any>;
}

/**
 * 从 LLM 返回的响应结构。
 */
export interface LLMResponse {
  // `success` 标志着请求是否成功处理。
  success: boolean;
  // `content` 包含由 LLM 生成的核心内容。
  content: string;
  // `error` 用于在请求失败时提供错误信息。
  error?: string;
}