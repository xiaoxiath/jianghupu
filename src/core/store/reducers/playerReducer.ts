import type { Draft } from 'immer';
import type { PlayerState } from '../../state';
import type { EventResult } from '../../events/types';

// Define a more specific action type for this reducer
type PlayerAction =
  | { type: 'SET_PLAYER_NAME', payload: { name: string } }
  | { type: 'APPLY_EVENT_RESULT', payload: { result: EventResult } }
  | { type: 'UPDATE_INVENTORY', payload: { inventory: any[] } }
  | { type: 'ADD_EXP', payload: { exp: number } };

export function playerReducer(draft: Draft<PlayerState>, action: any): void {
  switch (action.type) {
    case 'SET_PLAYER_NAME':
      draft.name = action.payload.name;
      break;
    case 'APPLY_EVENT_RESULT':
      const { result } = action.payload;
      if (result.player_stats) {
        draft.stats.hp = Math.max(0, (draft.stats.hp ?? 0) + (result.player_stats.hp ?? 0));
        draft.stats.mp = Math.max(0, (draft.stats.mp ?? 0) + (result.player_stats.mp ?? 0));
      }
      if (result.player_attributes) {
        draft.attributes.strength += result.player_attributes.strength ?? 0;
        draft.attributes.constitution += result.player_attributes.constitution ?? 0;
        draft.attributes.intelligence += result.player_attributes.intelligence ?? 0;
        draft.attributes.agility += result.player_attributes.agility ?? 0;
      }
      if (result.player_mood) {
        draft.mood = result.player_mood;
      }
      break;
    case 'UPDATE_INVENTORY':
      draft.inventory = action.payload.inventory;
      break;
    case 'ADD_EXP':
      draft.xp += action.payload.exp;
      break;
    default:
      break;
  }
}