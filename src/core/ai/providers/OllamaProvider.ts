import type { ILLMProvider } from "./ILLMProvider";
import type { LLMRequest, LLMResponse } from "../types";

interface OllamaResponse {
  response: string;
  // 根据需要可以添加更多字段
}

/**
 * ILLMProvider 的一个具体实现，用于与本地运行的 Ollama 服务进行交互。
 */
export class OllamaProvider implements ILLMProvider {
  /**
   * 向 Ollama 服务发送生成请求。
   *
   * @param request 包含 prompt 和上下文的请求对象。
   * @returns 一个解析为 LLMResponse 的 Promise。
   */
  public async generate(request: LLMRequest): Promise<LLMResponse> {
    console.log(`[OllamaProvider] Sending prompt to Ollama: ${request.prompt}`);
    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama2", // 或者您希望使用的任何模型
          prompt: request.prompt,
          stream: false, // 为了简化，我们先不处理流式响应
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[OllamaProvider] Ollama API responded with status ${response.status}: ${errorBody}`);
        throw new Error(`Ollama API responded with status ${response.status}`);
      }

      const data = (await response.json()) as OllamaResponse;

      if (typeof data.response !== "string") {
        throw new Error("Invalid response format from Ollama API");
      }

      return {
        success: true,
        content: data.response,
      };
    } catch (error) {
      console.error("[OllamaProvider] Error calling Ollama API:", error);
      return {
        success: false,
        content: "Error generating content from Ollama.", // 提供一个非空的错误消息
      };
    }
  }
}