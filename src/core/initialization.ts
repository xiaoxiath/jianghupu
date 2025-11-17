import { type GameState } from './state.js';
import { generateWorld, type Location } from './world.js';
import { archiveWorldState, loadWorldFromArchive } from './archive.js';
import { logger } from '../utils/logger.js';
import { type ModLoader } from './modLoader.js';
import { EventEngine } from './eventEngine.js';
import { TimeSystem } from '../systems/timeSystem.js';
import { GameStore } from './store/store.js';
import { createInitialPlayer } from './player.js';

/**
 * 创建一个初始游戏状态
 * @returns 初始游戏状态
 */
async function createInitialGameState(timeSystem: TimeSystem): Promise<GameState> {
  const player = createInitialPlayer('无名氏');
  const world = generateWorld('jianghu-seed'); // 使用一个固定的种子

  const freshState: GameState = {
    player,
    world,
    time: timeSystem.getTimeState(),
    eventQueue: [],
    triggeredOnceEvents: new Set(),
    sceneNpcs: [],
  };

  try {
    await loadWorldFromArchive(freshState);
    if (freshState.world.npcs.length === 0) {
      logger.warn('No NPCs loaded from archive, creating and archiving a new set.');
      // 如果数据库为空，则生成新的 NPC 并立即归档
      const newWorld = generateWorld('jianghu-seed');
      freshState.world.npcs = newWorld.npcs;
      await archiveWorldState(freshState);
    }
  } catch (error) {
    logger.error('Failed to initialize game state from archive, starting fresh.', error);
    // 如果从数据库加载失败，则回退到纯粹的新世界
    const newWorld = generateWorld('jianghu-seed');
    freshState.world = newWorld;
  }

  return freshState;
}

/**
 * 全局状态容器
 */
export async function initializeGameState(
  eventEngine: EventEngine,
  timeSystem: TimeSystem,
  store: GameStore,
  modLoader: ModLoader
): Promise<void> {
  // 1. 加载所有 Mods
  await modLoader.scanAndLoadMods();

  // 2. 初始化事件引擎
  await eventEngine.initialize();

  // 3. 运行 Mod 的 seeder
  await modLoader.runModSeeders();
  
  // 4. 创建初始游戏状态
  const state = await createInitialGameState(timeSystem);

  // 5. 将初始状态分发到 Store
  store.dispatch({ type: 'SET_STATE', payload: { state } });
}

/**
 * 将当前游戏状态序列化为一个可安全保存的对象。
 * @returns {SerializableGameState} 可序列化的游戏状态
 */
export function serializeGameState(state: GameState): any {
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
export function deserializeGameState(loadedState: any, store: GameStore): void {
  if (!loadedState || !loadedState.player || !loadedState.world) {
    throw new Error('Invalid or corrupted save data.');
  }
  
  const state: GameState = {
    player: loadedState.player,
    world: {
      ...loadedState.world,
      locations: new Map(loadedState.world.locations),
    },
    time: loadedState.time,
    triggeredOnceEvents: new Set(loadedState.triggeredOnceEvents),
    sceneNpcs: [], // sceneNpcs are transient and not saved
    eventQueue: [], // eventQueue is transient
  };
  
  store.dispatch({ type: 'SET_STATE', payload: { state } });
}