import { singleton } from 'tsyringe';
import type { GameState } from '../state';
import type { GameAction } from './actions';
import { gameReducer } from './reducer';

type Subscriber = (state: GameState) => void;

@singleton()
export class GameStore {
  private state: GameState;
  private subscribers: Subscriber[] = [];

  constructor() {
    // The store is initialized with a placeholder state.
    // The actual initial state will be set by dispatching INIT_GAME_STATE.
    this.state = {} as GameState;
  }

  public getState(): GameState {
    return this.state;
  }

  public dispatch(action: GameAction): void {
    this.state = gameReducer(this.state, action);
    this.notifySubscribers();
  }

  public subscribe(subscriber: Subscriber): () => void {
    this.subscribers.push(subscriber);
    // Return an unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== subscriber);
    };
  }

  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.state);
    }
  }
}