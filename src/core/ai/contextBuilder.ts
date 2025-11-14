import type { GameState } from '../state';
import type { Location } from '../world';

/**
 * 根据当前游戏状态构建上下文文本，供 AI 使用。
 * @param gameState - 当前的游戏状态
 * @returns 描述游戏状态的自然语言文本
 */
export function buildContext(gameState: GameState): string {
  const { player, world } = gameState;

  const currentLocation: Location | undefined = world.locations.get(world.currentLocationId);

  // 提取关键信息
  const playerName = player.name;
  const playerLevel = player.level;
  const playerRealm = player.realm;
  const locationName = currentLocation?.name ?? '未知之地';
  const locationDescription = currentLocation?.description ?? '一片迷雾笼罩的区域';

  // 最近发生的事件 (简单示例，取事件队列的最后一个)
  const lastEvent = gameState.eventQueue.length > 0 ? gameState.eventQueue[gameState.eventQueue.length - 1] : null;
  const recentEventDescription = lastEvent ? `最近江湖上流传着一则消息：${lastEvent.title} - ${lastEvent.description}` : "最近江湖上风平浪静。";

  // 格式化为自然语言
  const context = `
---
**游戏世界背景**

你是一位名叫 **${playerName}** 的江湖人士。
*   **境界**: ${playerRealm} (等级 ${playerLevel})
*   **当前位置**: 你身处 ${locationName}，这里是${locationDescription}。
*   **近期传闻**: ${recentEventDescription}
---
`;

  return context.trim();
}