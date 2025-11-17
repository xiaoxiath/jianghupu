// TODO: 解决 Prisma 类型导入问题。暂时使用 'any' 类型。
// 在正常情况下，应该能够从 '@prisma/client' 导入 Faction 和 FactionRelationship 类型。
import { singleton } from 'tsyringe';
import { prisma as db } from '../core/db';

@singleton()
export class FactionRepository {
  public async findAll(): Promise<any[]> {
    return db.faction.findMany();
  }

  public async findById(id: number): Promise<any | null> {
    return db.faction.findUnique({ where: { id } });
  }

  public async updateReputation(id: number, increment: number): Promise<any> {
    return db.faction.update({
      where: { id },
      data: { reputation: { increment } },
    });
  }

  public async findRelationshipsBySourceId(sourceId: number): Promise<any[]> {
    return db.factionRelationship.findMany({
      where: { sourceId },
    });
  }

  public async updateRelationshipIntensity(id: number, increment: number): Promise<any> {
    return db.factionRelationship.update({
      where: { id },
      data: { intensity: { increment } },
    });
  }

  public async findHostileRelationshipsAboveThreshold(threshold: number): Promise<any[]> {
    return db.factionRelationship.findMany({
      where: {
        status: 'HOSTILE',
        intensity: { gte: threshold },
      },
      include: { source: true, target: true },
    });
  }

  public async findWarEvent(faction1Name: string, faction2Name: string): Promise<any | null> {
    return db.eventLog.findFirst({
      where: {
        type: 'WAR_START',
        details: { contains: `"${faction1Name}"` },
        AND: { details: { contains: `"${faction2Name}"` } },
      },
    });
  }

  public async createWarEvent(timestamp: string, details: object): Promise<void> {
    await db.eventLog.create({
      data: {
        type: 'WAR_START',
        timestamp,
        details: JSON.stringify(details),
      },
    });
  }

  public async findActiveWarEvent(): Promise<any | null> {
    // For now, any 'WAR_START' event is considered active.
    // In the future, we might add an 'endedAt' field to the event log.
    return db.eventLog.findFirst({
      where: {
        type: 'WAR_START',
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }
}