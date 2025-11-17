import { TimeSystem } from './timeSystem.js';
import { GameStore } from '../core/store/store.js';
import { renderer } from '../ui/renderer.js';
import { createInitialPlayer } from '../core/player.js';
import { prisma as db } from '../core/db.js';

/**
 * 处理角色死亡和传承
 */
export async function handleLegacy(store: GameStore, timeSystem: TimeSystem) {
  const oldPlayer = store.getState().player;
  renderer.system(`${oldPlayer.name} 的一生结束了。`);

  // 1. 记录关于旧玩家的传说
  const legacyEvent = {
    type: 'LEGACY',
    details: JSON.stringify({
      name: oldPlayer.name,
      realm: oldPlayer.realm,
      story: `一位名为 ${oldPlayer.name} 的侠客在江湖中陨落，其境界已达 ${oldPlayer.realm}。`,
    }),
    timestamp: timeSystem.getFormattedTime(),
  };
  await db.eventLog.create({ data: legacyEvent });

  // 2. 简单的传承：新角色继承旧角色的姓氏
  const newName = `无名氏 (继承自 ${oldPlayer.name})`;
  const newPlayer = createInitialPlayer(newName);

  // 3. 在这里可以添加更复杂的继承逻辑...

  store.dispatch({ type: 'SET_PLAYER', payload: { player: newPlayer } });

  renderer.player(`一个新的生命开始了。你现在是 ${newName}。`);
  renderer.player('你继承了前人的遗志，踏上了新的江湖之路。');
}