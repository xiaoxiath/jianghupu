import { type PlayerState, createInitialPlayer } from './player.js';
export type { PlayerState } from './player.js';
import { type World, generateWorld, type Location } from './world.js';
export type { Location } from './world.js';
import { archiveWorldState, loadWorldFromArchive } from './archive.js';
import { logger } from '../utils/logger.js';
import type { Npc } from './npc.js';
import { type GameEvent } from './events/types.js';
import { type TimeState } from '../systems/timeSystem.js';

/**
 * 全局游戏状态
 */
export interface GameState {
  player: PlayerState;
  world: World;
  time: TimeState;
  eventQueue: GameEvent[];
  triggeredOnceEvents: Set<string>;
  sceneNpcs: Npc[]; // 当前场景中临时出现的 NPC
}

export const initialState: GameState = {
  player: createInitialPlayer('无名氏'),
  world: {
    locations: new Map(),
    npcs: [],
    currentLocationId: 0,
  },
  time: {
    year: 1,
    month: 1,
    day: 1,
    hour: 6,
    tick: 0,
  },
  eventQueue: [],
  triggeredOnceEvents: new Set(),
  sceneNpcs: [],
};

/**
* 可被 JSON 安全序列化的游戏世界状态
 */
export interface SerializableWorld {
    locations: [number, Location][];
    npcs: Npc[];
    currentLocationId: number;
}

/**
 * 可被 JSON 安全序列化的顶层游戏状态
 */
export interface SerializableGameState {
    player: PlayerState;
    world: SerializableWorld;
    time: TimeState;
    triggeredOnceEvents: string[];
}