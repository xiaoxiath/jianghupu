import type { ILLMProvider } from './ILLMProvider';
import type { LLMRequest, LLMResponse } from '../types';
import aiConfig from '../../../config/ai';

/**
 * 与本地 Ollama 服务交互的 LLM 提供方。
 */
export class OllamaProvider implements ILLMProvider {
  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const { baseUrl, model: defaultModel } = aiConfig.config;
    const model = request.model || defaultModel;

    if (!baseUrl) {
      throw new Error('Ollama baseUrl is not configured.');
    }

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: request.prompt,
          format: request.format, // 传递 format 参数
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API request failed with status ${response.status}: ${errorText}`);
      }

      const result = (await response.json()) as {
        response: string;
        prompt_eval_count: number;
        eval_count: number;
        total_duration: number;
      };

      return {
        success: true,
        content: result.response,
        metadata: {
          promptTokens: result.prompt_eval_count,
          completionTokens: result.eval_count,
          totalTokens: result.prompt_eval_count + result.eval_count,
          durationSeconds: result.total_duration / 1e9, // 纳秒转秒
        },
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