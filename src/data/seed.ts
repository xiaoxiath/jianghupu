import { prisma as db } from '../core/db';
import { logger } from '../utils/logger';

async function main() {
  logger.info('开始填充种子数据...');

  // 创建门派
  const factions = [
    { name: '武当派', alignment: '正道', reputation: 1000, description: '天下武功出少林，其次武当。' },
    { name: '丐帮', alignment: '正道', reputation: 800, description: '天下第一大帮，弟子遍布五湖四海。' },
    { name: '魔教', alignment: '邪宗', reputation: -1000, description: '行事诡秘，心狠手辣，为武林正道所不容。' },
    { name: '铸剑山庄', alignment: '中立', reputation: 500, description: '以铸造神兵利器闻名天下。' },
    { name: '五毒教', alignment: '邪宗', reputation: -700, description: '擅长用毒，教众行事乖张。' },
  ];

  for (const factionData of factions) {
    await db.faction.upsert({
      where: { name: factionData.name },
      update: {},
      create: factionData,
    });
  }

  logger.info('门派数据填充完毕。');

  // 初始化门派关系
  const allFactions = await db.faction.findMany();
  for (const source of allFactions) {
    for (const target of allFactions) {
      if (source.id === target.id) continue;

      let status: 'ALLIED' | 'HOSTILE' | 'NEUTRAL' = 'NEUTRAL';
      if (source.alignment === target.alignment) {
        status = 'ALLIED';
      } else if (source.alignment === '正道' && target.alignment === '邪宗' || source.alignment === '邪宗' && target.alignment === '正道') {
        status = 'HOSTILE';
      }

      await db.factionRelationship.upsert({
        where: { sourceId_targetId: { sourceId: source.id, targetId: target.id } },
        update: {},
        create: {
          sourceId: source.id,
          targetId: target.id,
          status: status,
          intensity: status === 'HOSTILE' ? 50 : (status === 'ALLIED' ? 20 : 0),
        },
      });
    }
  }
  logger.info('门派关系初始化完毕。');

  // 创建武学
  const martialArts = [
    { name: '太祖长拳', type: '外功', description: '江湖基础拳法，没什么威力。', power: 5, requirement: 'strength > 5' },
    { name: '梯云纵', type: '轻功', description: '武当派闻名天下的轻功，能让你身轻如燕。', power: 0, requirement: 'agility > 20' },
    { name: '九阳神功', type: '内功', description: '至刚至阳的无上内功心法，据说能百毒不侵。', power: 50, requirement: 'constitution > 80' },
    { name: '夺命十三剑', type: '外功', description: '一十三式，一式比一式毒辣，招招致命。', power: 40, requirement: 'agility > 50' },
  ];

  for (const maData of martialArts) {
    await db.martialArt.upsert({
      where: { name: maData.name },
      update: {},
      create: maData,
    });
  }

  logger.info('武学数据填充完毕。');

  // 创建物品
  const items = [
    { name: '金疮药', type: '丹药', description: '行走江湖必备的疗伤药。', effect: 'hp +50' },
    { name: '大还丹', type: '丹药', description: '能起死回生的灵丹妙药。', effect: 'hp +200' },
    { name: '铁剑', type: '装备', description: '一柄平平无奇的铁剑。', effect: 'strength +5' },
    { name: '布衣', type: '装备', description: '一件普通的布衣。', effect: 'constitution +2' },
  ];

  for (const itemData of items) {
    await db.item.upsert({
      where: { name: itemData.name },
      update: {},
      create: itemData,
    });
  }

  logger.info('物品数据填充完毕。');

  logger.info('种子数据填充完成。');
}

async function seed() {
    await main()
      .catch((e) => {
        console.error(e);
        process.exit(1);
      })
      .finally(async () => {
        await db.$disconnect();
      });
}

seed();
