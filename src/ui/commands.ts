import { serializeGameState, deserializeGameState, gameState } from '../core/state.js';
import { writeSaveGame, readSaveGame, saveFileExists } from '../utils/fileStore.js';
import { archiveWorldState } from '../core/archive.js';
import { renderer } from './renderer.js';

// 假设有一个全局的方式来控制游戏循环，比如一个事件发射器或回调
// 这里我们用一个简单的标志来示意是否需要重新渲染场景
export let sceneNeedsUpdate = false;

type MessageType = 'info' | 'success' | 'warning' | 'error';

/**
 * 内部渲染函数，用于适配 renderer
 */
function renderMessage(message: string, type: MessageType = 'info') {
    switch (type) {
        case 'success':
        case 'info':
        case 'warning':
            renderer.system(message);
            break;
        case 'error':
            renderer.error(message);
            break;
    }
}


/**
 * 处理玩家输入的命令。
 * @param command - 玩家输入的完整命令字符串。
 * @returns Promise<void>
 */
export async function handleCommand(command: string): Promise<void> {
  // 重置场景更新标志
  sceneNeedsUpdate = false;
  const [action, ...args] = command.toLowerCase().split(' ');

  switch (action) {
    case 'save':
      await handleSaveCommand(args);
      break;
    case 'load':
      await handleLoadCommand(args);
      break;
    // 在这里可以添加更多的命令，如 'look', 'go', 'attack'
    default:
      renderMessage(`未知指令: "${command}"`, 'error');
      break;
  }
}

/**
 * 处理 "save" 命令。
 * @param args - 命令参数，期望第一个参数是存档槽位。
 */
async function handleSaveCommand(args: string[]): Promise<void> {
  if (!args[0]) {
    renderMessage('需要指定存档槽位。请输入 "save [槽位号]"，例如: "save 1"', 'warning');
    return;
  }
  const slot = parseInt(args[0], 10);
  if (isNaN(slot) || slot < 1) {
    renderMessage('无效的存档槽位。请输入一个大于0的数字。', 'warning');
    return;
  }

  try {
    renderMessage(`正在保存至槽位 ${slot}...`, 'info');
    const state = serializeGameState();
    await writeSaveGame(slot, state);
    renderMessage(`游戏快照已成功保存至槽位 ${slot}。`, 'success');

    // 现在，归档世界状态到数据库
    await archiveWorldState(gameState);
    renderMessage('世界历史已成功归档。', 'success');

  } catch (error) {
    renderMessage(`保存或归档失败: ${(error as Error).message}`, 'error');
  }
}

/**
 * 处理 "load" 命令。
 * @param args - 命令参数，期望第一个参数是存档槽位。
 */
async function handleLoadCommand(args: string[]): Promise<void> {
  if (!args[0]) {
    renderMessage('需要指定存档槽位。请输入 "load [槽位号]"，例如: "load 1"', 'warning');
    return;
  }
  const slot = parseInt(args[0], 10);
  if (isNaN(slot) || slot < 1) {
    renderMessage('无效的存档槽位。请输入一个大于0的数字。', 'warning');
    return;
  }

  if (!saveFileExists(slot)) {
    renderMessage(`存档槽位 ${slot} 不存在。`, 'warning');
    return;
  }

  try {
    renderMessage(`正在从槽位 ${slot} 加载...`, 'info');
    const state = await readSaveGame(slot);
    deserializeGameState(state);
    renderMessage(`游戏已成功从槽位 ${slot} 加载。`, 'success');
    
    // 设置标志，通知主循环需要重新渲染整个场景
    sceneNeedsUpdate = true;
  } catch (error) {
    renderMessage(`加载失败: ${(error as Error).message}`, 'error');
  }
}