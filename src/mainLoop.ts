import { renderer } from './ui/renderer.js';
import { cli } from './ui/cli.js';
import type { GameState } from './core/state.js';
import { handleCommand, sceneNeedsUpdate } from './ui/commands.js';
import { SceneManager } from './narrator/sceneManager.js';
import { GameStore } from './core/store/store.js';
import { EventEngine } from './core/eventEngine.js';
import type { EventChoice } from './core/events/types.js';
import { TimeSystem } from './systems/timeSystem.js';
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
export async function mainLoop(
  sceneManager: SceneManager,
  eventEngine: EventEngine,
  store: GameStore,
  timeSystem: TimeSystem,
) {
  renderer.system('游戏开始...');
  
  // 检查是否有历史传承
  const legacyEvents = await db.eventLog.findMany({
    where: { type: 'LEGACY' },
    orderBy: { createdAt: 'desc' },
  });
  const legacySummary = legacyEvents.map((e: { details: string; }) => JSON.parse(e.details).story).join(' ');

  let nextSceneSummary = '游戏开始，你发现自己站在一个未知的江湖世界中。';
  let lastPlayerChoice = '';

  let loopCount = 0;
  while (true) {
    loopCount++;
    console.log('\n' + '---'.repeat(20));

    let gameState = store.state;

    // 1. 活态世界演化
    // TODO: 这些应该成为 action
    updateNpcEngine(store);
    const factionContext = await evolveFactions(timeSystem);

    // 2. 检查事件队列或触发随机事件
    let event = null;
    if (gameState.eventQueue.length > 0) {
      event = gameState.eventQueue[0];
      store.dispatch({ type: 'SHIFT_EVENT_FROM_QUEUE' });
    } else {
      event = await eventEngine.triggerRandomEvent(gameState);
    }
    
    let narration: string;
    let options: EventChoice[];

    if (event) {
      renderer.event(`[事件] ${event.title}`);

      // 如果是战斗事件，则直接进入战斗
      if (event.type === '战斗') {
        const enemy = createBandit();
        const combatResult = await startCombat(enemy, store);
        if (combatResult === 'lose') {
          await handleLegacy(store, timeSystem);
          lastPlayerChoice = '你在死亡的边缘重生，开始了新的轮回。';
          continue;
        }
        // 战斗胜利后，继续正常的叙事流程
        lastPlayerChoice = `你刚刚经历了一场激战，击败了 ${enemy.name}。`;
        continue;
      }
      
      ({ narration, options } = await sceneManager.processEvent(event, gameState));
    } else {
        // 如果没有事件，则使用玩家上一步的选择作为场景摘要
        nextSceneSummary = lastPlayerChoice;
        
        // 如果没有事件，也没有玩家输入，给一个默认的场景
        if (!nextSceneSummary) {
            nextSceneSummary = '你静静地站着，观察着周围的一切。';
        }

        // 2. 调用 AI 说书人生成叙事
        ({ narration, options } = await sceneManager.narrateNextScene(nextSceneSummary, legacySummary, factionContext, gameState));
    }
    
    // 3. 渲染场景和玩家状态
    const { player } = gameState;
    renderer.system(`你: ${player.name} | 境界: ${player.realm} | 气血: ${player.stats.hp}/${player.stats.maxHp} | 内力: ${player.stats.mp}/${player.stats.maxMp}`);
    renderer.narrator(narration);

    // 4. 提供选项并获取玩家输入
    const finalOptions = [...options, INPUT_COMMAND_CHOICE];
    let selection = await cli.prompt('你的选择是？', finalOptions);

    // 5. 处理玩家选择
    if (selection === INPUT_COMMAND_CHOICE) {
      const command = await cli.input('> ');
      await handleCommand(command, store, eventEngine);
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
      // 处理 EventChoice 对象
      if (typeof selection === 'object') {
        const choice = selection as EventChoice;
        
        const actionResult = await sceneManager.handlePlayerAction(choice, gameState);

        if (actionResult) {
          // 特殊事件（如交易）返回了完整的场景，直接渲染
          narration = actionResult.narration;
          options = actionResult.options;
          // 直接进入下一次循环的渲染阶段
          continue;
        } else {
          // 标准动作，应用结果并让下一次循环生成新场景
          if (choice.result) {
            store.dispatch({ type: 'APPLY_EVENT_RESULT', payload: { result: choice.result } });
            lastPlayerChoice = choice.result.description;
          } else {
            lastPlayerChoice = choice.text;
          }
        }
      } else {
        // 兜底处理
        lastPlayerChoice = selection;
      }
    }
  }
}