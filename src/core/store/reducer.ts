import { getExpForNextLevel, levelUp } from '../../systems/cultivation';
import type { GameState } from '../state';
import type { Location } from '../world';
import type { GameAction } from './actions';
/**
 * 游戏状态的 Reducer 函数。
 * 接收当前状态和 Action，返回一个新的状态。
 * @param state - 当前游戏状态
 * @param action - 要处理的 Action
 * @returns 新的游戏状态
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'INIT_GAME_STATE':
      return action.payload.initialState;

    case 'APPLY_EVENT_RESULT':
      const { result } = action.payload;
      const newPlayerState = { ...state.player };

      if (result.player_stats) {
        newPlayerState.stats = { ...newPlayerState.stats };
        if (result.player_stats.hp) {
          newPlayerState.stats.hp = Math.min(newPlayerState.stats.maxHp, newPlayerState.stats.hp + result.player_stats.hp);
        }
        if (result.player_stats.mp) {
          newPlayerState.stats.mp = Math.min(newPlayerState.stats.maxMp, newPlayerState.stats.mp + result.player_stats.mp);
        }
      }

      if (result.player_attributes) {
        newPlayerState.attributes = { ...newPlayerState.attributes };
        if (result.player_attributes.strength) newPlayerState.attributes.strength += result.player_attributes.strength;
        if (result.player_attributes.constitution) newPlayerState.attributes.constitution += result.player_attributes.constitution;
        if (result.player_attributes.intelligence) newPlayerState.attributes.intelligence += result.player_attributes.intelligence;
        if (result.player_attributes.agility) newPlayerState.attributes.agility += result.player_attributes.agility;
      }

      if (result.player_mood) {
        newPlayerState.mood = result.player_mood;
      }

      return {
        ...state,
        player: newPlayerState,
      };

    case 'DESERIALIZE':
      const loadedState = action.payload.state;
      const locationsMap = new Map<number, Location>(loadedState.world.locations);
      return {
        ...state,
        player: loadedState.player,
        world: {
          ...loadedState.world,
          locations: locationsMap,
        },
        time: loadedState.time,
        triggeredOnceEvents: new Set(loadedState.triggeredOnceEvents || []),
      };

    case 'SET_PLAYER':
      return {
        ...state,
        player: action.payload.player,
      };

    case 'ADD_EXP': {
      const newPlayer = { ...state.player };
      newPlayer.xp += action.payload.exp;
      
      const requiredExp = getExpForNextLevel(newPlayer.level);
      if (newPlayer.xp >= requiredExp) {
        return levelUp(state);
      }

      return { ...state, player: newPlayer };
    }

    case 'LEVEL_UP': {
      return levelUp(state);
    }

    case 'ADD_TRIGGERED_ONCE_EVENT':
      return {
        ...state,
        triggeredOnceEvents: new Set(state.triggeredOnceEvents).add(action.payload.eventId),
      };

    case 'ADD_EVENT_TO_QUEUE':
      return {
        ...state,
        eventQueue: [...state.eventQueue, action.payload.event],
      };

    case 'UPDATE_NPCS':
      return {
        ...state,
        world: {
          ...state.world,
          npcs: action.payload.npcs,
        },
      };

    case 'UPDATE_INVENTORY':
      return {
        ...state,
        player: {
          ...state.player,
          inventory: action.payload.inventory,
        },
      };

    default:
      return state;
  }
}