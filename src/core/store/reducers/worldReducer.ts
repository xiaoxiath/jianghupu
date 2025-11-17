import type { Draft } from 'immer';
import type { GameState } from '../../state';
import type { Npc } from '../../npc';

type WorldAction =
  | { type: 'UPDATE_NPCS', payload: { npcs: Npc[] } }
  | { type: 'UPDATE_SCENE_NPCS', payload: { npcs: Npc[] } };

export function worldReducer(draft: Draft<GameState>, action: any): void {
  switch (action.type) {
    case 'UPDATE_NPCS':
      draft.world.npcs = action.payload.npcs;
      break;
    case 'UPDATE_SCENE_NPCS':
      draft.sceneNpcs = action.payload.npcs;
      break;
    default:
      break;
  }
}