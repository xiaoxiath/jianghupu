import { renderer } from './ui/renderer.js';
import { cli } from './ui/cli.js';
import { gameState } from './core/state.js';
import { handleCommand, sceneNeedsUpdate } from './ui/commands.js';
import { sceneManager } from './narrator/sceneManager.js';
import { triggerRandomEvent } from './core/eventEngine.js';
import { startCombat } from './systems/combat.js';
import { createBandit } from './core/npc.js';
import { handleLegacy } from './systems/legacy.js';
import { updateNpcEngine } from './core/npcEngine.js';
import { evolveFactions } from './systems/sect.js';
import { prisma as db } from './core/db.js';

const INPUT_COMMAND_CHOICE = '输入指令 (save/load/exit)';

/**
 * 游戏主循环 - 由 AI 说书人驱动
 */
export async function mainLoop() {
  renderer.system('游戏开始...');
  
  // 检查是否有历史传承
  const legacyEvents = await db.eventLog.findMany({
    where: { type: 'LEGACY' },
    orderBy: { createdAt: 'desc' },
  });
  const legacySummary = legacyEvents.map(e => JSON.parse(e.details).story).join(' ');

  let nextSceneSummary = '游戏开始，你发现自己站在一个未知的江湖世界中。';
  let lastPlayerChoice = '';

  while (true) {
    console.log('\n' + '---'.repeat(20));

    // 1. 活态世界演化
    updateNpcEngine();
    evolveFactions();

    // 2. 检查是否触发随机事件
    const event = await triggerRandomEvent();
    if (event) {
      nextSceneSummary = event.description;
      renderer.event(`[事件] ${event.title}`);

      // 如果是战斗事件，则直接进入战斗
      if (event.type === '战斗') {
        const enemy = createBandit();
        const combatResult = await startCombat(enemy);
        if (combatResult === 'lose') {
          await handleLegacy();
          lastPlayerChoice = '你在死亡的边缘重生，开始了新的轮回。';
          continue;
        }
        // 战斗胜利后，继续正常的叙事流程
        lastPlayerChoice = `你刚刚经历了一场激战，击败了 ${enemy.name}。`;
        continue;
      }
    } else {
        // 如果没有事件，则使用玩家上一步的选择作为场景摘要
        nextSceneSummary = lastPlayerChoice;
    }
    
    // 如果没有事件，也没有玩家输入，给一个默认的场景
    if (!nextSceneSummary) {
        nextSceneSummary = '你静静地站着，观察着周围的一切。';
    }

    // 2. 调用 AI 说书人生成叙事
    const { narration, options } = await sceneManager.narrateNextScene(nextSceneSummary, legacySummary);
    
    // 3. 渲染场景和玩家状态
    const { player } = gameState;
    renderer.system(`你: ${player.name} | 境界: ${player.realm} | 气血: ${player.stats.hp}/${player.stats.maxHp} | 内力: ${player.stats.mp}/${player.stats.maxMp}`);
    renderer.narrator(narration);

    // 4. 提供选项并获取玩家输入
    const finalOptions = [...options, INPUT_COMMAND_CHOICE];
    const selection = await cli.prompt('你的选择是？', finalOptions);

    // 5. 处理玩家选择
    if (selection === INPUT_COMMAND_CHOICE) {
      const command = await cli.input('> ');
      await handleCommand(command);
      if (command.trim().toLowerCase() === 'exit') {
          renderer.system('江湖再见！');
          return;
      }
      if (sceneNeedsUpdate) {
        renderer.system('场景已更新...');
        lastPlayerChoice = '你读取了过去的记忆，眼前的一切都发生了变化。';
      } else {
        lastPlayerChoice = '你执行了一个神秘的指令。';
      }
    } else {
      // 将玩家的选择作为下一次场景生成的输入
      lastPlayerChoice = selection;
      // TODO: 在这里可以根据玩家的选择，实际地改变游戏状态
      // 例如，如果选项是 "1. 拔剑攻击"，则应进入战斗状态。
      // 目前，我们只是简单地将选择反馈给 AI。
    }
  }
}