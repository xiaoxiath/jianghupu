import { type PlayerState, createInitialPlayer } from './player.js';
import { type World, generateWorld, type Location } from './world.js';
export type { Location } from './world.js';
import { archiveWorldState, loadWorldFromArchive } from './archive.js';
import { logger } from '../utils/logger.js';
import type { Npc } from './npc.js';
import { modLoader } from './modLoader.js';
import { container } from 'tsyringe';
import { EventEngine, type GameEvent } from './eventEngine.js';
import { TimeSystem, type TimeState } from '../systems/timeSystem.js';
import { GameStore } from './store/store.js';

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

/**
* 可被 JSON 安全序列化的游戏世界状态
 */
interface SerializableWorld {
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

/**
 * 创建一个初始游戏状态
 * @returns 初始游戏状态
 */
async function createInitialGameState(timeSystem: TimeSystem): Promise<GameState> {
  const player = createInitialPlayer('无名氏');
  const world = generateWorld('jianghu-seed'); // 使用一个固定的种子

  const initialState: GameState = {
    player,
    world,
    time: timeSystem.getTimeState(),
    eventQueue: [],
    triggeredOnceEvents: new Set(),
    sceneNpcs: [],
  };

  try {
    await loadWorldFromArchive(initialState);
    if (initialState.world.npcs.length === 0) {
      logger.warn('No NPCs loaded from archive, creating and archiving a new set.');
      // 如果数据库为空，则生成新的 NPC 并立即归档
      const newWorld = generateWorld('jianghu-seed');
      initialState.world.npcs = newWorld.npcs;
      await archiveWorldState(initialState);
    }
  } catch (error) {
    logger.error('Failed to initialize game state from archive, starting fresh.', error);
    // 如果从数据库加载失败，则回退到纯粹的新世界
    const newWorld = generateWorld('jianghu-seed');
    initialState.world = newWorld;
  }

  return initialState;
}

/**
 * 全局状态容器
 */
/**
 * 全局状态容器
 */
export async function initializeGameState(): Promise<void> {
  // 1. 加载所有 Mods
  await modLoader.scanAndLoadMods();

  // 2. 初始化事件引擎
  const eventEngine = container.resolve(EventEngine);
  await eventEngine.initialize();

  // 3. 运行 Mod 的 seeder
  await modLoader.runModSeeders();
  
  // 4. 创建初始游戏状态
  const timeSystem = container.resolve(TimeSystem);
  const initialState = await createInitialGameState(timeSystem);

  // 5. 将初始状态分发到 Store
  const store = container.resolve(GameStore);
  store.dispatch({ type: 'INIT_GAME_STATE', payload: { initialState } });
}

/**
 * 将当前游戏状态序列化为一个可安全保存的对象。
 * @returns {SerializableGameState} 可序列化的游戏状态
 */
export function serializeGameState(state: GameState): SerializableGameState {
  return {
    player: state.player,
    world: {
      ...state.world,
      locations: Array.from(state.world.locations.entries()),
      npcs: state.world.npcs,
    },
    time: state.time,
    triggeredOnceEvents: Array.from(state.triggeredOnceEvents),
  };
}

/**
 * 从一个可序列化的对象反序列化，恢复游戏状态。
 * @param {SerializableGameState} loadedState - 从存档文件中加载的状态对象。
 */
export function deserializeGameState(loadedState: SerializableGameState): void {
  if (!loadedState || !loadedState.player || !loadedState.world) {
    throw new Error('Invalid or corrupted save data.');
  }
  
  const store = container.resolve(GameStore);
  store.dispatch({ type: 'DESERIALIZE', payload: { state: loadedState } });
}