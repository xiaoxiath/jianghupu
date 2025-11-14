import inquirer from 'inquirer';

/**
 * CLI 输入处理器
 */
export const cli = {
  /**
   * 向玩家展示选项并获取选择
   * @param message 提示信息
   * @param choices 选项列表
   * @returns 玩家选择的字符串
   */
  prompt: async (message: string, choices: string[]): Promise<string> => {
    const { selection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message,
        choices,
      },
    ]);
    return selection;
  },

  /**
   * 获取玩家的自由文本输入
   * @param message 提示信息
   * @returns 玩家输入的字符串
   */
  input: async (message: string): Promise<string> => {
    const { command } = await inquirer.prompt([
        {
            type: 'input',
            name: 'command',
            message,
        }
    ]);
    return command;
  }
};