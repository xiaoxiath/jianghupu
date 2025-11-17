import { prisma } from './db';
import type { NPC as PrismaNpc } from '@prisma/client';
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

  const npcPromises = gameState.world.npcs.map(npc => {
    const location = gameState.world.locations.get(npc.locationId);
    if (!location) {
      logger.warn(`NPC "${npc.name}" has an invalid location ID: ${npc.locationId}. Skipping.`);
      return Promise.resolve(); // 跳过无效数据
    }

    return prisma.nPC.upsert({
      where: { name: npc.name }, // 使用 unique 字段来查找
      update: {
        sect: npc.sect,
        realm: npc.realm,
        alive: npc.alive,
        location: location.name, // 存储地点名称
        reputation: npc.reputation,
      },
      create: {
        name: npc.name,
        sect: npc.sect,
        realm: npc.realm,
        alive: npc.alive,
        location: location.name,
        reputation: npc.reputation,
      },
    });
  });

  try {
    await Promise.all(npcPromises);
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

    if (dbNPCs.length === 0) {
      logger.warn('No NPCs found in the database. World state might be fresh.');
      return;
    }

    // 将数据库模型转换为游戏内的 Npc 对象
    const npcs: Npc[] = dbNPCs.map((dbNpc: PrismaNpc): Npc => {
      const location = Array.from(gameState.world.locations.values()).find(loc => loc.name === dbNpc.location);
      return {
        id: dbNpc.id,
        name: dbNpc.name,
        sect: dbNpc.sect ?? undefined,
        realm: dbNpc.realm,
        alive: dbNpc.alive,
        locationId: location ? location.id : -1, // 如果找不到地点，给一个无效ID
        reputation: dbNpc.reputation,
        // 补全战斗属性的默认值
        stats: { hp: 100, maxHp: 100, mp: 50, maxMp: 50 },
        attributes: { strength: 10, constitution: 10 },
      };
    });

    // 过滤掉那些地点无效的 NPC
    gameState.world.npcs = npcs.filter((npc: Npc) => {
      if (npc.locationId === -1) {
        logger.warn(`Could not find location "${npc.name}" for NPC, removing from world.`);
        return false;
      }
      return true;
    });

    logger.info(`Successfully loaded ${gameState.world.npcs.length} NPCs from the database.`);
  } catch (error) {
    logger.error('Failed to load world state from database:', error);
    throw new Error('Database operation failed during world state loading.');
  }
}