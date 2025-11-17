import { produce } from 'immer';
import { getExpForNextLevel, levelUp } from '../../systems/cultivation';
import type { GameState } from '../state';
import type { Location } from '../world';
import type { GameAction } from './actions';

export const gameReducer = produce((draft: GameState, action: GameAction): GameState | void => {
  switch (action.type) {
    case 'INIT_GAME_STATE':
      // Immer can't work with an uninitialized state, so we must return the new state directly.
      return action.payload.initialState;

    case 'APPLY_EVENT_RESULT': {
      const { result } = action.payload;
      const player = draft.player;

      if (result.player_stats) {
        if (result.player_stats.hp) {
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + result.player_stats.hp);
        }
        if (result.player_stats.mp) {
          player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + result.player_stats.mp);
        }
      }

      if (result.player_attributes) {
        if (result.player_attributes.strength) player.attributes.strength += result.player_attributes.strength;
        if (result.player_attributes.constitution) player.attributes.constitution += result.player_attributes.constitution;
        if (result.player_attributes.intelligence) player.attributes.intelligence += result.player_attributes.intelligence;
        if (result.player_attributes.agility) player.attributes.agility += result.player_attributes.agility;
      }

      if (result.player_mood) {
        player.mood = result.player_mood;
      }
      break;
    }

    case 'DESERIALIZE': {
      const loadedState = action.payload.state;
      const locationsMap = new Map<number, Location>(loadedState.world.locations);
      
      draft.player = loadedState.player;
      draft.world = {
        ...loadedState.world,
        locations: locationsMap,
      };
      draft.time = loadedState.time;
      draft.triggeredOnceEvents = new Set(loadedState.triggeredOnceEvents || []);
      break;
    }

    case 'SET_PLAYER':
      draft.player = action.payload.player;
      break;

    case 'ADD_EXP': {
      draft.player.xp += action.payload.exp;
      
      const requiredExp = getExpForNextLevel(draft.player.level);
      if (draft.player.xp >= requiredExp) {
        levelUp(draft.player);
      }
      break;
    }

    case 'LEVEL_UP':
      levelUp(draft.player);
      break;

    case 'ADD_TRIGGERED_ONCE_EVENT':
      draft.triggeredOnceEvents.add(action.payload.eventId);
      break;

    case 'ADD_EVENT_TO_QUEUE':
      draft.eventQueue.push(action.payload.event);
      break;

    case 'SHIFT_EVENT_FROM_QUEUE':
      draft.eventQueue.shift();
      break;

    case 'UPDATE_NPCS':
      draft.world.npcs = action.payload.npcs;
      break;

    case 'UPDATE_INVENTORY':
      draft.player.inventory = action.payload.inventory;
      break;

    default:
      // For unhandled actions, we do nothing. Immer will return the original state.
      break;
  }
});