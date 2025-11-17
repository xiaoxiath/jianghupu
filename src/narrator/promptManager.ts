import { singleton } from 'tsyringe';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// A simple template engine
function renderTemplate(template: string, data: Record<string, any>): string {
  // Enhance to handle nested objects, e.g., {{ player.name }}
  return template.replace(/\{\{([\w\s.-]+)\}\}/g, (match, key) => {
    const keys = key.trim().split('.');
    let value = data;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return match; // Keep original if path is invalid
      }
    }
    // Handle special case for JSON objects
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return value !== undefined ? String(value) : match;
  });
}

export type PromptRole = 'narrator' | 'story_engine' | 'trader' | 'skill_master' | 'item_master';

interface PromptTemplateConfig {
  systemRole: string;
  worldContext: string;
  playerContext: string;
  taskInstruction: string;
  outputFormat: string;
}

@singleton()
export class PromptManager {
  private templates: Record<string, string> = {};
  private promptConfig: Record<PromptRole, PromptTemplateConfig> = {
    narrator: {
      systemRole: 'system_role',
      worldContext: 'context_world',
      playerContext: 'context_player',
      taskInstruction: 'task_instruction',
      outputFormat: 'output_format',
    },
    story_engine: {
      systemRole: 'story_engine_system_role',
      worldContext: 'context_world',
      playerContext: 'context_player',
      taskInstruction: 'story_engine_task_instruction',
      outputFormat: 'story_engine_output_format',
    },
    trader: {
      systemRole: 'trader_system_role',
      worldContext: 'context_world',
      playerContext: 'context_player',
      taskInstruction: 'trader_task_instruction',
      outputFormat: 'trader_output_format',
    },
    skill_master: {
      systemRole: 'skill_master_system_role',
      worldContext: 'context_world',
      playerContext: 'context_player',
      taskInstruction: 'skill_master_task_instruction',
      outputFormat: 'skill_master_output_format',
    },
    item_master: {
      systemRole: 'item_master_system_role',
      worldContext: 'context_world',
      playerContext: 'context_player',
      taskInstruction: 'item_master_task_instruction',
      outputFormat: 'item_master_output_format',
    },
  };

  constructor() {
    this.loadTemplates();
  }

  private async loadTemplates(): Promise<void> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const templateDir = path.join(__dirname, 'templates');
    try {
      const files = await fs.readdir(templateDir);
      for (const file of files) {
        const templateName = path.basename(file, path.extname(file));
        const content = await fs.readFile(path.join(templateDir, file), 'utf-8');
        this.templates[templateName] = content;
      }
    } catch (error) {
      console.error('Failed to load prompt templates:', error);
    }
  }

  public buildPrompt(role: PromptRole, data: Record<string, any>): string {
    const config = this.promptConfig[role];
    if (!config) {
      throw new Error(`Invalid prompt role: ${role}`);
    }

    const systemRole = renderTemplate(this.templates[config.systemRole] || '', data);
    const worldContext = renderTemplate(this.templates[config.worldContext] || '', data);
    const playerContext = renderTemplate(this.templates[config.playerContext] || '', data);
    const taskInstruction = renderTemplate(this.templates[config.taskInstruction] || '', data);
    const outputFormat = this.templates[config.outputFormat] || '';

    return `
${systemRole}

# Context:
${worldContext}
${playerContext}

${taskInstruction}

# Output Format:
严格按照以下 JSON 格式输出，不要包含任何额外的解释或标记。
${outputFormat}
    `.trim();
  }
}