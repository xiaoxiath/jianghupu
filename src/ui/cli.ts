import inquirer from 'inquirer';
import type { EventChoice } from '../core/events/types';

/**
 * CLI 输入处理器
 */
export const cli = {
  /**
   * 向玩家展示选项并获取选择
   * @param message 提示信息
   * @param choices 选项列表
   * @returns 玩家选择的完整 EventChoice 对象
   */
  prompt: async (message: string, choices: (EventChoice | string)[]): Promise<EventChoice | string> => {
    const inquirerChoices = choices.map(choice => {
        if (typeof choice === 'string') {
            return { name: choice, value: choice };
        }
        return { name: choice.text, value: choice };
    });

    const { selection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message,
        choices: inquirerChoices,
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