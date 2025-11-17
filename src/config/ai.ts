/**
 * @file LLM Service Configuration
 * @description Centralized configuration for different LLM providers.
 */

// Supported LLM provider types
export type LLMProviderType = 'ollama' | 'openai';

// Defines the structure for LLM provider configuration
export interface LLMConfig {
  provider: LLMProviderType;
  config: {
    baseUrl?: string;
    model: string;
    apiKey?: string;
  };
}

// Default configuration using environment variables or fallback values
const aiConfig: LLMConfig = {
  provider: (process.env.LLM_PROVIDER as LLMProviderType) || 'ollama',
  config: {
    baseUrl: process.env.LLM_BASE_URL || 'http://localhost:11434',
    model: process.env.LLM_MODEL || 'deepseek-r1:7b',
    apiKey: process.env.LLM_API_KEY,
  },
};

export default aiConfig;