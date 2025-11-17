import type { ILLMProvider } from './ILLMProvider';
import type { LLMRequest, LLMResponse } from '../types';

const OLLAMA_CONFIG = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'deepseek-r1:7b',
};

/**
 * 与本地 Ollama 服务交互的 LLM 提供方。
 */
export class OllamaProvider implements ILLMProvider {
  public async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_CONFIG.model,
          prompt: request.prompt,
          format: request.format, // 传递 format 参数
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API request failed with status ${response.status}: ${errorText}`);
      }

      const result = (await response.json()) as { response: string };

      return {
        success: true,
        content: result.response,
      };
    } catch (error) {
      console.error('[OllamaProvider] Error:', error);
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error in OllamaProvider',
      };
    }
  }
}