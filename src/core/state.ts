import { type PlayerState, createInitialPlayer } from './player.js';
import { type World, generateWorld, type Location } from './world.js';
import { archiveWorldState, loadWorldFromArchive } from './archive.js';
import { logger } from '../utils/logger.js';
import type { Npc } from './npc.js';
import { modLoader } from './modLoader.js';
import { initializeEventEngine, type GameEvent } from './eventEngine.js';

/**
 * 全局游戏状态
 */
export interface GameState {
  player: PlayerState;
  world: World;
  eventQueue: GameEvent[];
  triggeredOnceEvents: Set<string>;
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
    triggeredOnceEvents: string[];
}

/**
 * 创建一个初始游戏状态
 * @returns 初始游戏状态
 */
async function createInitialGameState(): Promise<GameState> {
  // TODO: 将来允许玩家输入姓名
  const player = createInitialPlayer('无名氏');
  const world = generateWorld('jianghu-seed'); // 使用一个固定的种子

  const initialState: GameState = {
    player,
    world,
    eventQueue: [],
    triggeredOnceEvents: new Set(),
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
export let gameState: GameState;

export async function initializeGameState(): Promise<void> {
  // 1. 加载所有 Mods
  await modLoader.scanAndLoadMods();

  // 2. 初始化事件引擎，它会使用 ModLoader 加载合并后的事件
  await initializeEventEngine();

  // 3. 运行 Mod 的 seeder，这必须在主数据库和表结构准备好之后
  // 注意：这假设 `prisma db push` 或 migrate 已经运行
  await modLoader.runModSeeders();
  
  // 4. 创建游戏世界状态。这会从数据库加载数据，包括由 Mods 添加的数据。
  gameState = await createInitialGameState();
}

/**
 * 将当前游戏状态序列化为一个可安全保存的对象。
 * @returns {SerializableGameState} 可序列化的游戏状态
 */
export function serializeGameState(): SerializableGameState {
  return {
    player: gameState.player,
    world: {
      ...gameState.world,
      locations: Array.from(gameState.world.locations.entries()),
      npcs: gameState.world.npcs,
    },
    triggeredOnceEvents: Array.from(gameState.triggeredOnceEvents),
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
  
  // 将 location 数组转换回 Map
  const locationsMap = new Map<number, Location>(loadedState.world.locations);

  gameState = {
    player: loadedState.player,
    world: {
      ...loadedState.world,
      locations: locationsMap,
      npcs: loadedState.world.npcs,
    },
    eventQueue: [],
    triggeredOnceEvents: new Set(loadedState.triggeredOnceEvents || []),
  };
}