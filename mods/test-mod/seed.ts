// This is a seeder for the test-mod.
// It needs to be compiled to JavaScript to be loaded by the mod loader.
// The compiled file should be at mods/test-mod/seed.js

// We will receive the prisma client instance from the mod loader.
import type { PrismaClient } from '@prisma/client';

async function seed(db: PrismaClient) {
  console.log('Running seeder for test-mod...');
  
  await db.faction.upsert({
    where: { name: '逍遥派' },
    update: {},
    create: {
      name: '逍遥派',
      alignment: '中立',
      reputation: 900,
      description: '遗世独立，飘然出尘。派内武学讲究轻灵飘逸，非有缘者不得而入。'
    },
  });

  console.log('test-mod seeder finished.');
}

export { seed };