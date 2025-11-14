import chalk from 'chalk';

/**
 * 一个简单的日志记录器，用于在控制台输出不同级别的消息。
 */
export const logger = {
  /**
   * 记录普通信息。
   * @param {...any[]} args - 要记录的消息。
   */
  info: (...args: any[]) => {
    console.log(chalk.blue('[INFO]'), ...args);
  },

  /**
   * 记录警告信息。
   * @param {...any[]} args - 要记录的消息。
   */
  warn: (...args: any[]) => {
    console.warn(chalk.yellow('[WARN]'), ...args);
  },

  /**
   * 记录错误信息。
   * @param {...any[]} args - 要记录的消息。
   */
  error: (...args: any[]) => {
    console.error(chalk.red('[ERROR]'), ...args);
  },
};