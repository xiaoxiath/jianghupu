import { GameStore } from './store/store.js';
import { renderer } from '../ui/renderer.js';
import { AIBard } from '../narrator/aiBard.js';

/**
 * 更新所有 NPC 的状态
 * 这是活态世界引擎的核心部分
 */
export async function updateNpcEngine(store: GameStore, bard: AIBard) {
  const npcs = store.state.world.npcs;

  const updatedNpcs = await Promise.all(npcs.map(async (npc) => {
    if (npc.alive) {
      const oldStrength = npc.attributes.strength;
      const newNpc = {
        ...npc,
        attributes: {
          ...npc.attributes,
          strength: npc.attributes.strength + 1,
        },
      };
      // const narrative = await bard.generateNpcGrowthNarrative(npc, oldStrength, newNpc.attributes.strength);
      // if (narrative) {
      //   renderer.system(`[江湖演化] ${narrative}`);
      // } else {
      //   renderer.system(`[江湖演化] ${npc.name} 似乎有所精进 (力量: ${oldStrength} -> ${newNpc.attributes.strength})。`);
      // }
      return newNpc;
    }
    return npc;
  }));

  store.dispatch({ type: 'UPDATE_NPCS', payload: { npcs: updatedNpcs } });
}