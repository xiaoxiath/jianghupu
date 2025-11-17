/**
 * @file AI 服务相关的类型定义
 */

/**
 * 发送给 LLM 提供方的请求结构。
 */
export interface LLMRequest {
  prompt: string;
  context?: Record<string, any>;
  // 指定返回格式，以便在 provider 中进行特殊处理
  format?: 'json' | 'text';
}

/**
 * 从 LLM 提供方返回的响应结构。
 */
export interface LLMResponse {
  success: boolean;
  content: string;
  error?: string;
}