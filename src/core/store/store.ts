import { singleton, inject } from 'tsyringe';
import { produce, type Draft } from 'immer';
import { EventEmitter } from 'events';
import type { EventResult, GameEvent } from '../events/types.js';
import { type GameState, initialState, type SerializableGameState } from '../state.js';
import { updateNpcEngine } from '../npcEngine.js';
import { evolveFactions } from '../../systems/sect.js';
import { AIBard } from '../../narrator/aiBard.js';
import { TimeSystem } from '../../systems/timeSystem.js';

type Action =
  | { type: 'SET_PLAYER_NAME', payload: { name: string } }
  | { type: 'APPLY_EVENT_RESULT', payload: { result: EventResult } }
  | { type: 'ADD_EVENT_TO_QUEUE', payload: { event: GameEvent } }
  | { type: 'ADD_TRIGGERED_ONCE_EVENT', payload: { eventId: string } }
  | { type: 'ADVANCE_TIME' }
  | { type: 'SET_STATE', payload: { state: GameState } }
  | { type: 'UPDATE_INVENTORY', payload: { inventory: any[] } }
  | { type: 'SHIFT_EVENT_FROM_QUEUE' }
  | { type: 'UPDATE_NPCS', payload: { npcs: any[] } }
  | { type: 'UPDATE_SCENE_NPCS', payload: { npcs: any[] } }
  | { type: 'WORLD_UPDATE' };

@singleton()
export class GameStore extends EventEmitter {
  private _state: GameState;

  constructor(
    @inject(AIBard) private bard: AIBard,
    @inject(TimeSystem) private timeSystem: TimeSystem
  ) {
    super();
    this._state = initialState;
  }

  get state(): GameState {
    return this._state;
  }

  // A simple reducer-like dispatch function
  public async dispatch(action: Action | Function): Promise<void> {
    if (typeof action === 'function') {
      await action(this.dispatch.bind(this), this.state);
      return;
    }

    const nextState = produce(this._state, (draft: Draft<GameState>) => {
      switch (action.type) {
        case 'SET_PLAYER_NAME':
          draft.player.name = action.payload.name;
          break;
        case 'APPLY_EVENT_RESULT':
          const { result } = action.payload;
          if (result.player_stats) {
            draft.player.stats.hp = Math.max(0, (draft.player.stats.hp ?? 0) + (result.player_stats.hp ?? 0));
            draft.player.stats.mp = Math.max(0, (draft.player.stats.mp ?? 0) + (result.player_stats.mp ?? 0));
          }
          if (result.player_attributes) {
            draft.player.attributes.strength += result.player_attributes.strength ?? 0;
            draft.player.attributes.constitution += result.player_attributes.constitution ?? 0;
            draft.player.attributes.intelligence += result.player_attributes.intelligence ?? 0;
            draft.player.attributes.agility += result.player_attributes.agility ?? 0;
          }
          if (result.player_mood) {
            draft.player.mood = result.player_mood;
          }
          break;
        case 'ADD_EVENT_TO_QUEUE':
          draft.eventQueue.push(action.payload.event);
          break;
        case 'ADD_TRIGGERED_ONCE_EVENT':
          // Assuming triggeredOnceEvents is a Set in the state
          draft.triggeredOnceEvents.add(action.payload.eventId);
          break;
        case 'ADVANCE_TIME':
          draft.time.day += 1;
          // more logic here
          break;
        case 'SET_STATE':
          return action.payload.state;
        case 'UPDATE_INVENTORY':
          draft.player.inventory = action.payload.inventory;
          break;
        case 'SHIFT_EVENT_FROM_QUEUE':
          draft.eventQueue.shift();
          break;
        case 'UPDATE_NPCS':
          draft.world.npcs = action.payload.npcs;
          break;
        case 'UPDATE_SCENE_NPCS':
          draft.sceneNpcs = action.payload.npcs;
          break;
        case 'WORLD_UPDATE':
          // This is a placeholder, the actual logic is in the async action creator
          break;
        default:
          break;
      }
    });

    if (this._state !== nextState) {
      this._state = nextState;
      this.emit('change', this._state);
    }
  }

  public updateWorld() {
    return async (dispatch: (action: Action) => void) => {
      await updateNpcEngine(this, this.bard);
      await evolveFactions(this.timeSystem);
      dispatch({ type: 'WORLD_UPDATE' });
    };
  }
}