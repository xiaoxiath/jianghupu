/**
 * @file LLM Provider Factory
 * @description Creates an instance of an LLM provider based on the configuration.
 */

import aiConfig, { LLMProviderType } from '../../config/ai';
import type { ILLMProvider } from './providers/ILLMProvider';
import { OllamaProvider } from './providers/OllamaProvider';
// Import other providers here as they are created, e.g.:
// import { OpenAIProvider } from './providers/OpenAIProvider';

/**
 * A factory function that returns an LLM provider instance based on configuration.
 * @returns An instance of a class that implements the ILLMProvider interface.
 */
export function createLlmProvider(): ILLMProvider {
  switch (aiConfig.provider) {
    case 'ollama':
      return new OllamaProvider();
    case 'openai':
      // return new OpenAIProvider(); // Uncomment when OpenAIProvider is implemented
      throw new Error('OpenAI provider is not yet implemented.');
    default:
      throw new Error(`Unknown LLM provider type: ${aiConfig.provider}`);
  }
}