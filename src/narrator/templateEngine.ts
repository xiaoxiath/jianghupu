/**
 * @file Template Engine
 * @description 负责加载和渲染叙事模板，作为 L0 叙事层。
 */
import * as nunjucks from 'nunjucks';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { singleton } from 'tsyringe';
import type { BardOutput } from './aiBard';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, 'templates');

@singleton()
export class TemplateEngine {
  private env: nunjucks.Environment;

  constructor() {
    this.env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(TEMPLATES_DIR, {
        watch: process.env.NODE_ENV === 'development', // 开发模式下监视文件变化
      })
    );
  }

  /**
   * 渲染一个叙事模板。
   * @param templateName - The name of the template file (e.g., 'item_pickup.njk').
   * @param context - The data to pass to the template.
   * @returns A promise that resolves to the structured BardOutput, or null if rendering fails.
   */
  public async render(templateName: string, context: object): Promise<BardOutput | null> {
    try {
      const renderedString = this.env.render(templateName, context);
      // 我们期望模板输出一个有效的 JSON 字符串
      const output = JSON.parse(renderedString);

      // 验证输出是否符合 BardOutput 结构
      if (typeof output.narration !== 'string' || !Array.isArray(output.options)) {
        throw new Error('Template output is not a valid BardOutput structure.');
      }

      return output as BardOutput;
    } catch (error) {
      console.error(`[TemplateEngine] Error rendering or parsing template "${templateName}":`, error);
      return null;
    }
  }
}