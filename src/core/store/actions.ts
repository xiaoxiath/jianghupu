import type { GameState, SerializableGameState } from '../state';
import type { Npc } from '../npc';
import type { EventResult } from '../events/types';
import type { PlayerState as Player } from '../player';
import type { Item } from '../item';
import { GameEvent } from '../events/types';

/**
 * Action 基类
 */
export interface Action {
  type: string;
}

/**
 * 初始化游戏状态
 */
export interface InitGameStateAction extends Action {
  type: 'INIT_GAME_STATE';
  payload: {
    initialState: GameState;
  };
}

/**
 * 应用事件结果
 */
export interface ApplyEventResultAction extends Action {
  type: 'APPLY_EVENT_RESULT';
  payload: {
    result: EventResult;
  };
}

/**
 * 存档反序列化
 */
export interface DeserializeAction extends Action {
  type: 'DESERIALIZE';
  payload: {
    state: SerializableGameState;
  };
}

export interface SetPlayerAction extends Action {
  type: 'SET_PLAYER';
  payload: {
    player: Player;
  };
}

export interface LevelUpAction extends Action {
  type: 'LEVEL_UP';
}

export interface AddExpAction extends Action {
  type: 'ADD_EXP';
  payload: {
    exp: number;
  };
}

/**
 * 所有 Action 的联合类型
 */
export interface AddTriggeredOnceEventAction extends Action {
  type: 'ADD_TRIGGERED_ONCE_EVENT';
  payload: {
    eventId: string;
  };
}

export interface AddEventToQueueAction extends Action {
  type: 'ADD_EVENT_TO_QUEUE';
  payload: {
    event: GameEvent;
  };
}

export interface UpdateNpcsAction extends Action {
  type: 'UPDATE_NPCS';
  payload: {
    npcs: Npc[];
  };
}

export interface ShiftEventFromQueueAction extends Action {
  type: 'SHIFT_EVENT_FROM_QUEUE';
}

export type GameAction =
  | InitGameStateAction
  | ApplyEventResultAction
  | DeserializeAction
  | SetPlayerAction
  | LevelUpAction
  | AddExpAction
  | AddTriggeredOnceEventAction
  | AddEventToQueueAction
  | UpdateNpcsAction
  | UpdateInventoryAction
  | ShiftEventFromQueueAction;

export interface UpdateInventoryAction extends Action {
  type: 'UPDATE_INVENTORY';
  payload: {
    inventory: Item[];
  };
}
