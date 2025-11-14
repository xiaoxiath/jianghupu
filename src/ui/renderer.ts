import chalk from 'chalk';

/**
 * 文本渲染器，用于输出带样式的文本
 */
export const renderer = {
  /**
   * 渲染说书人叙事
   * @param text 要渲染的文本
   */
  narrator: (text: string) => {
    console.log(chalk.italic.cyan(`📜 ${text}`));
  },

  /**
   * 渲染玩家选项
   * @param options 选项数组
   */
  options: (options: string[]) => {
    options.forEach((option) => {
      console.log(chalk.green(option));
    });
  },

  /**
   * 渲染系统信息
   * @param text 要渲染的文本
   */
  system: (text: string) => {
    console.log(chalk.gray(`⚙️ ${text}`));
  },

  /**
   * 渲染事件信息
   * @param text 要渲染的文本
   */
  event: (text: string) => {
    console.log(chalk.yellow.bold(`✨ ${text}`));
  },

  /**
   * 渲染错误信息
   * @param text 要渲染的文本
   */
  error: (text: string) => {
    console.log(chalk.red.bold(`❌ ${text}`));
  },

  /**
   * 渲染玩家信息
   * @param text 要渲染的文本
   */
  player: (text: string) => {
    console.log(chalk.blue.bold(`👤 ${text}`));
  },
};