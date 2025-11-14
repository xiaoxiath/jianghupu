import { gameState } from './state.js';
import { renderer } from '../ui/renderer.js';

/**
 * 更新所有 NPC 的状态
 * 这是活态世界引擎的核心部分
 */
export function updateNpcEngine() {
  const npcs = gameState.world.npcs;

  // 简单的 NPC 演化：所有 NPC 都在修炼
  for (const npc of npcs) {
    if (npc.alive) {
      const oldStrength = npc.attributes.strength;
      npc.attributes.strength += 1; // 随时间缓慢变强
      // 可以添加更多逻辑，例如：
      // - NPC 移动
      // - NPC 之间的交互
      // - NPC 死亡/复活
      renderer.system(`[江湖演化] ${npc.name} 似乎有所精进 (力量: ${oldStrength} -> ${npc.attributes.strength})。`);
    }
  }
}