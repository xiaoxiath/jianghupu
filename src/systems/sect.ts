import { prisma as db } from '../core/db';
import { logger } from '../utils/logger';

export const FactionAlignments = ['正道', '邪宗', '中立'] as const;
export type FactionAlignment = typeof FactionAlignments[number];

export const RelationshipStatuses = ['ALLIED', 'HOSTILE', 'NEUTRAL'] as const;
export type RelationshipStatus = typeof RelationshipStatuses[number];

/**
 * 演化所有门派和它们之间的关系。
 * 这个函数应该由时间系统定期调用（例如，每“旬”或每“月”）。
 */
export async function evolveFactions() {
  logger.info('开始演化门派势力...');

  const factions = await db.faction.findMany();

  for (const faction of factions) {
    // 1. 更新门派声望（基于其成员的行为、事件等）
    await updateFactionReputation(faction.id);

    // 2. 检查并更新与其他门派的关系
    await updateFactionRelationships(faction.id);
  }

  // 3. 检查是否触发门派间的重大事件（如战争）
  await checkForMajorFactionEvents();

  logger.info('门派势力演化完成。');
}

/**
 * 更新单个门派的声望。
 * @param factionId 门派ID
 */
async function updateFactionReputation(factionId: number) {
  const faction = await db.faction.findUnique({ where: { id: factionId } });
  if (!faction) return;

  // 简单的声望变化逻辑：正道缓慢增加，邪宗缓慢减少
  let reputationChange = 0;
  if (faction.alignment === '正道') {
    reputationChange = Math.floor(Math.random() * 5); // 0-4
  } else if (faction.alignment === '邪宗') {
    reputationChange = -Math.floor(Math.random() * 5); // -4-0
  }

  await db.faction.update({
    where: { id: factionId },
    data: { reputation: { increment: reputationChange } },
  });
}

/**
 * 更新一个门派与其他所有门派的关系。
 * @param factionId 门派ID
 */
async function updateFactionRelationships(factionId: number) {
    const relationships = await db.factionRelationship.findMany({
        where: { sourceId: factionId },
    });

    for (const rel of relationships) {
        let intensityChange = 0;
        // 关系会基于当前状态和随机性发生小幅波动
        if (rel.status === 'HOSTILE') {
            intensityChange = Math.floor(Math.random() * 3); // 敌对度增加 0-2
        } else if (rel.status === 'ALLIED') {
            intensityChange = Math.floor(Math.random() * 2); // 友好度增加 0-1
        } else {
            intensityChange = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        }

        await db.factionRelationship.update({
            where: { id: rel.id },
            data: { intensity: { increment: intensityChange } },
        });
    }
}


/**
 * 检查是否触发了门派间的重大事件，如战争、结盟等。
 */
async function checkForMajorFactionEvents() {
    const hostileThreshold = 100; // 敌对度达到100则宣战
    const relationships = await db.factionRelationship.findMany({
        where: {
            status: 'HOSTILE',
            intensity: { gte: hostileThreshold },
        },
        include: { source: true, target: true },
    });

    for (const rel of relationships) {
        // 检查是否已经记录过这场战争
        const existingEvent = await db.eventLog.findFirst({
            where: {
                type: 'WAR_START',
                details: { contains: `"${rel.source.name}"` },
                AND: { details: { contains: `"${rel.target.name}"` } },
            },
        });

        if (!existingEvent) {
            const details = {
                faction1: rel.source.name,
                faction2: rel.target.name,
                reason: `双方敌对关系达到顶点，${rel.source.name} 对 ${rel.target.name} 宣战！`,
            };
            await db.eventLog.create({
                data: {
                    type: 'WAR_START',
                    timestamp: '当前', // TODO: 应该从时间系统获取
                    details: JSON.stringify(details),
                },
            });
            logger.info(`[重大事件] ${rel.source.name} 对 ${rel.target.name} 宣战！`);
        }
    }
}