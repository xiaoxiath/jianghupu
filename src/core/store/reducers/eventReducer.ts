import type { Draft } from 'immer';
import type { GameState } from '../../state';
import type { GameEvent } from '../../events/types';

type EventAction =
  | { type: 'ADD_EVENT_TO_QUEUE', payload: { event: GameEvent } }
  | { type: 'SHIFT_EVENT_FROM_QUEUE' }
  | { type: 'ADD_TRIGGERED_ONCE_EVENT', payload: { eventId: string } };

export function eventReducer(draft: Draft<GameState>, action: any): void {
  switch (action.type) {
    case 'ADD_EVENT_TO_QUEUE':
      draft.eventQueue.push(action.payload.event);
      break;
    case 'SHIFT_EVENT_FROM_QUEUE':
      draft.eventQueue.shift();
      break;
    case 'ADD_TRIGGERED_ONCE_EVENT':
      draft.triggeredOnceEvents.add(action.payload.eventId);
      break;
    default:
      break;
  }
}