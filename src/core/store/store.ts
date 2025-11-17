import { singleton, inject } from 'tsyringe';
import { produce, type Draft } from 'immer';
import { EventEmitter } from 'events';
import type { EventResult, GameEvent } from '../events/types.js';
import { type GameState, initialState, type SerializableGameState } from '../state.js';
import { updateNpcEngine } from '../npcEngine.js';
import { playerReducer } from './reducers/playerReducer.js';
import { eventReducer } from './reducers/eventReducer.js';
import { worldReducer } from './reducers/worldReducer.js';
import { AIBard } from '../../narrator/aiBard.js';
import { TimeSystem } from '../../systems/timeSystem.js';
import { FactionSystem } from '../../systems/factionSystem.js';

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

// Combines all slice reducers into a single root reducer.
function rootReducer(draft: Draft<GameState>, action: any): GameState | void {
  playerReducer(draft.player, action);
  eventReducer(draft, action);
  worldReducer(draft, action);

  // Handle actions that are not part of a slice reducer
  switch (action.type) {
    case 'SET_STATE':
      return action.payload.state;
    case 'ADVANCE_TIME':
      draft.time.day += 1;
      // more logic here
      break;
    case 'WORLD_UPDATE':
      // This is a placeholder, the actual logic is in the async action creator
      break;
  }
}

@singleton()
export class GameStore extends EventEmitter {
  private _state: GameState;

  constructor(
    @inject(AIBard) private bard: AIBard,
    @inject(TimeSystem) private timeSystem: TimeSystem,
    @inject(FactionSystem) private factionSystem: FactionSystem
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

    const nextState = produce(this._state, (draft) => rootReducer(draft, action));

    if (this._state !== nextState) {
      this._state = nextState;
      this.emit('change', this._state);
    }
  }

  public updateWorld() {
    return async (dispatch: (action: Action) => void) => {
      await updateNpcEngine(this, this.bard);
      await this.factionSystem.evolveFactions();
      dispatch({ type: 'WORLD_UPDATE' });
    };
  }
}