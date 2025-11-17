import { container } from 'tsyringe';
import { GameStore } from './store/store.js';
import { renderer } from '../ui/renderer.js';

/**
 * 更新所有 NPC 的状态
 * 这是活态世界引擎的核心部分
 */
export function updateNpcEngine() {
  const store = container.resolve(GameStore);
  const npcs = store.getState().world.npcs;

  const updatedNpcs = npcs.map(npc => {
    if (npc.alive) {
      const oldStrength = npc.attributes.strength;
      const newNpc = {
        ...npc,
        attributes: {
          ...npc.attributes,
          strength: npc.attributes.strength + 1,
        },
      };
      renderer.system(`[江湖演化] ${npc.name} 似乎有所精进 (力量: ${oldStrength} -> ${newNpc.attributes.strength})。`);
      return newNpc;
    }
    return npc;
  });

  store.dispatch({ type: 'UPDATE_NPCS', payload: { npcs: updatedNpcs } });
}