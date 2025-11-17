import { prisma } from './db';
import type { GameState } from './state';
import type { Npc } from './npc.js';
import { logger } from '../utils/logger';

/**
 * 将当前游戏世界的长期状态（如 NPC 数据）归档到数据库中。
 * 
 * 这个函数会遍历游戏状态中的所有 NPC，并使用 `upsert` 操作
 * 将它们的数据存入数据库。如果 NPC 已存在，则更新；如果不存在，则创建。
 *
 * @param gameState - 当前的游戏状态对象。
 */
export async function archiveWorldState(gameState: GameState): Promise<void> {
  logger.info('Archiving world state to database...');

  // 归档 NPC 数据
  const npcPromises = gameState.world.npcs.map(npc => {
    const location = gameState.world.locations.get(npc.locationId);
    if (!location) {
      logger.warn(`NPC "${npc.name}" has an invalid location ID: ${npc.locationId}. Skipping.`);
      return Promise.resolve();
    }
    return prisma.nPC.upsert({
      where: { name: npc.name },
      update: { sect: npc.sect, realm: npc.realm, alive: npc.alive, location: location.name, reputation: npc.reputation },
      create: { name: npc.name, sect: npc.sect, realm: npc.realm, alive: npc.alive, location: location.name, reputation: npc.reputation },
    });
  });

  // 归档 triggeredOnceEvents
  const triggeredOnceEventsPromise = prisma.gameMeta.upsert({
    where: { key: 'triggeredOnceEvents' },
    update: { value: JSON.stringify(Array.from(gameState.triggeredOnceEvents)) },
    create: { key: 'triggeredOnceEvents', value: JSON.stringify(Array.from(gameState.triggeredOnceEvents)) },
  });

  try {
    await Promise.all([...npcPromises, triggeredOnceEventsPromise]);
    logger.info('World state successfully archived.');
  } catch (error) {
    logger.error('Failed to archive world state:', error);
    // 在实际应用中，这里可能需要更复杂的错误处理逻辑
    throw new Error('Database operation failed during world state archival.');
  }
}

/**
 * 从数据库加载世界历史状态，并将其应用到游戏状态中。
 * 目前主要加载 NPC 数据。
 * @param gameState - 要更新的游戏状态对象。
 */
export async function loadWorldFromArchive(gameState: GameState): Promise<void> {
  logger.info('Loading world state from database...');
  try {
    const dbNPCs = await prisma.nPC.findMany();
    const triggeredOnceEventsMeta = await prisma.gameMeta.findUnique({
      where: { key: 'triggeredOnceEvents' },
    });

    // 加载 NPCs
    if (dbNPCs.length > 0) {
      const npcs: Npc[] = dbNPCs.map((dbNpc: any): Npc => {
        const location = Array.from(gameState.world.locations.values()).find(loc => loc.name === dbNpc.location);
        return {
          id: dbNpc.id,
          name: dbNpc.name,
          sect: dbNpc.sect ?? undefined,
          realm: dbNpc.realm,
          alive: dbNpc.alive,
          locationId: location ? location.id : -1,
          reputation: dbNpc.reputation,
          stats: { hp: 100, maxHp: 100, mp: 50, maxMp: 50 },
          attributes: { strength: 10, constitution: 10 },
        };
      });
      gameState.world.npcs = npcs.filter(npc => npc.locationId !== -1);
      logger.info(`Successfully loaded ${gameState.world.npcs.length} NPCs from the database.`);
    } else {
      logger.warn('No NPCs found in the database.');
    }

    // 加载 triggeredOnceEvents
    if (triggeredOnceEventsMeta) {
      const eventIds = JSON.parse(triggeredOnceEventsMeta.value);
      gameState.triggeredOnceEvents = new Set(eventIds);
      logger.info(`Successfully loaded ${gameState.triggeredOnceEvents.size} once-triggered events.`);
    } else {
      logger.warn('No triggeredOnceEvents found in the database.');
    }
  } catch (error) {
    logger.error('Failed to load world state from database:', error);
    throw new Error('Database operation failed during world state loading.');
  }
}
