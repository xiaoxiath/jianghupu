/**
 * @file 叙事场景管理器
 * @description 负责管理游戏的叙事流程，作为 AI 说书人的状态机。
 * @see docs/technical_design.md#4-ai-说书人模块aibardts
 */

import type { GameState } from '../core/state';
import { AIBard, type BardPrompt, type BardOutput } from './aiBard';
import type { Location } from '../core/world';
import type { GameEvent, EventChoice } from '../core/eventEngine';
import { renderChoices } from '../ui/renderer';
import { TimeSystem } from '../systems/timeSystem';
import { createNpc, type NpcType } from '../core/npc';
import { container } from 'tsyringe';
import { GameStore } from '../core/store/store.js';

type NarrativeTone = '宿命' | '诙谐' | '哲理' | '疯癫';

/**
 * 场景管理器，负责驱动 AI 叙事流程
 */
export class SceneManager {
  private currentTone: NarrativeTone = '宿命';

  constructor(
    private bard: AIBard,
    private timeSystem: TimeSystem,
  ) {}

  /**
   * 根据当前游戏状态，生成并返回下一个叙事场景。
   * @param sceneSummary 对当前情况的简要描述，例如“玩家进入了一个新的地点”或“战斗结束了”。
   * @returns AI 生成的叙事和选项。
   */
  public async narrateNextScene(sceneSummary: string, legacySummary: string | undefined, factionContext: string | undefined, gameState: GameState): Promise<BardOutput> {
    const { player, world } = gameState;
    
    // 0. 清理上一场景的临时 NPC
    gameState.sceneNpcs = [];

    // 1. 调用天机老人，看是否触发事件
    const eventDescription = await this.triggerStoryEngine(gameState);
    let finalSceneSummary = sceneSummary;
    if (eventDescription) {
      finalSceneSummary = `${eventDescription} ${sceneSummary}`;
    }

    // 2. 检查并描述场景中的 NPC
    if (gameState.sceneNpcs.length > 0) {
      const npcNames = gameState.sceneNpcs.map(npc => npc.name).join('、');
      finalSceneSummary += ` 你在这里遇到了${npcNames}。`;
    }

    // 3. 获取当前地点信息
    const currentLocation = world.locations.get(world.currentLocationId);
    if (!currentLocation) {
      throw new Error(`Invalid currentLocationId: ${world.currentLocationId}`);
    }

    // 2. 准备 Prompt 所需的数据
    const promptData: BardPrompt = {
      playerState: {
        ...player,
        mood: player.mood, // 从玩家状态中获取真实心境
        last_action_result: finalSceneSummary, // 使用场景摘要作为上一个行动的结果
      },
      worldContext: {
        time: this.timeSystem.getFormattedTime(), // 从时间系统中获取真实时间
        location: currentLocation,
        summary: factionContext || '江湖暂-无大事。', // 使用派系动态作为世界摘要
      },
      sceneSummary: finalSceneSummary,
      legacySummary,
      factionContext, // 新增：传入派系动态
      tone: this.currentTone,
    };

    // 3. 调用 AI 说书人
    const output = await this.bard.generateNarration(promptData);

    // 4. 根据场景中的 NPC 添加互动选项
    if (gameState.sceneNpcs.some(npc => npc.name === '行脚商人')) {
      output.options.push({
        text: '与商人交易',
        action: 'trade',
        result: { description: '你走上前去，想看看他卖些什么。' }
      });
    }
    if (gameState.sceneNpcs.some(npc => npc.name === '扫地僧')) {
      output.options.push({
        text: '向扫地僧请教',
        action: 'learn_skill',
        result: { description: '你恭敬地向扫地僧行了一礼。' }
      });
    }
    if (gameState.sceneNpcs.some(npc => npc.name === '多宝先生')) {
      output.options.push({
        text: '请多宝先生鉴定物品',
        action: 'identify_item',
        result: { description: '你将身上的物品拿出来，请多宝先生过目。' }
      });
    }

    return output;
  }

  /**
   * 调用天机老人，决定是否触发一个动态事件。
   * @param gameState 当前游戏状态
   * @returns 返回一个事件描述字符串，如果没有事件则返回 null。
   */
  private async triggerStoryEngine(gameState: GameState): Promise<string | null> {
    console.log('Consulting the Story Engine...');
    const { player, world } = gameState;

    const currentLocation = world.locations.get(world.currentLocationId);
    if (!currentLocation) return null;

    // 天机老人不需要知道所有细节，只传递关键信息
    const promptData = {
      player: {
        mood: player.mood,
        last_action_result: '...', // 简化输入
      },
      world: {
        time: this.timeSystem.getFormattedTime(),
        location_name: currentLocation.name,
      },
      // factionContext and legacySummary can be added if needed
    };

    const fullPrompt = this.bard.buildStoryEnginePrompt(promptData);
    const response = await this.bard.generateRaw(fullPrompt);

    if (!response.success || !response.content) {
      console.error('Story Engine failed to respond.');
      return null;
    }

    try {
      const jsonString = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonString);

      if (result.trigger_event && result.event?.description) {
        console.log(`Story Engine triggered event: ${result.event.type} - ${result.event.description}`);
        
        // 如果事件是 NPC 类型，则创建并添加 NPC 到场景中
        if (result.event.type === 'npc' && result.event.data?.npc_type) {
          const npcType = result.event.data.npc_type as NpcType;
          const newNpc = createNpc(npcType, gameState.world.currentLocationId);
          gameState.sceneNpcs.push(newNpc);
          console.log(`Created and added scene NPC: ${newNpc.name}`);
        }

        return result.event.description;
      }
      console.log('Story Engine decided not to trigger an event.');
      return null;
    } catch (error) {
      console.error('Failed to parse Story Engine response:', error);
      return null;
    }
  }

  /**
   * 处理交易事件，调用商人 AI 并呈现交易界面。
   */
  public async processTradeEvent(gameState: GameState): Promise<BardOutput> {
    const tradeInfo = await this.bard.generateTradeScene(gameState.player, { location: gameState.world.locations.get(gameState.world.currentLocationId) });

    if (!tradeInfo) {
      return {
        narration: '商人似乎没什么兴趣，摆了摆手让你离开。',
        options: [{ text: '继续...', action: 'narrate', result: { description: '你耸了耸肩，决定继续前行。' } }]
      };
    }

    const tradeOptions: EventChoice[] = [];
    tradeInfo.goods.forEach(item => {
      tradeOptions.push({
        text: `[购买] ${item.name} (${item.buy_price}金)`,
        action: 'buy',
        result: { description: `你买下了${item.name}。`, data: { itemId: item.name, cost: item.buy_price } }
      });
    });
    tradeInfo.acquisitions.forEach(item => {
      tradeOptions.push({
        text: `[出售] ${item.name} (${item.sell_price}金)`,
        action: 'sell',
        result: { description: `你卖掉了${item.name}。`, data: { itemId: item.name, gain: item.sell_price } }
      });
    });
    tradeOptions.push({ text: '离开', action: 'narrate', result: { description: '你结束了和商人的交谈。' } });

    return {
      narration: tradeInfo.dialogue,
      options: tradeOptions
    };
  }

  /**
   * 处理玩家的动作选择。
   * @param choice 玩家选择的选项
   */
  public async handlePlayerAction(choice: EventChoice, gameState: GameState): Promise<BardOutput | null> {
    if (choice.action === 'trade') {
      return this.processTradeEvent(gameState);
    }
    if (choice.action === 'learn_skill') {
      // Placeholder for skill learning logic
      // For now, we can just return a simple narration and let the next loop generate a new scene
      return null;
    }
    if (choice.action === 'identify_item') {
      return this.processIdentifyItemEvent(gameState);
    }
    
    // For standard actions, we return null to indicate that the main loop
    // should handle the result and narrate the next scene.
    return null;
  }

  /**
   * 处理鉴定物品的事件。
   */
  public async processIdentifyItemEvent(gameState: GameState): Promise<BardOutput> {
    // For simplicity, we'll just try to identify the first item in inventory.
    // A real implementation would ask the player which item to identify.
    const itemToIdentify = gameState.player.inventory[0];

    if (!itemToIdentify) {
      return {
        narration: '你身上空空如也，没什么值得鉴定的东西。',
        options: [{ text: '离开', action: 'narrate', result: { description: '你尴尬地笑了笑。' } }]
      };
    }

    const identificationInfo = await this.bard.identifyItem(itemToIdentify);

    if (!identificationInfo) {
      return {
        narration: '“此乃凡物。”多宝先生瞥了一眼，便不再多言。',
        options: [{ text: '离开', action: 'narrate', result: { description: '看来这东西确实不值一提。' } }]
      };
    }
    
    const store = container.resolve(GameStore);
    const player = store.getState().player;
    const newInventory = player.inventory.map((item: any) => { // TODO: Use a proper item type
      if (item.name === itemToIdentify.name) {
        return { ...item, ...identificationInfo.identification };
      }
      return item;
    });
    store.dispatch({ type: 'UPDATE_INVENTORY', payload: { inventory: newInventory } });

    return {
      narration: identificationInfo.dialogue,
      options: [{ text: '多谢先生指点', action: 'narrate', result: { description: `你对 ${identificationInfo.identification.original_name} 有了新的认识。` } }]
    };
  }

  /**
   * 处理一个由事件引擎触发的完整游戏事件。
   * @param event 要处理的事件
   */
  public async processEvent(event: GameEvent, gameState: GameState): Promise<BardOutput> {
    // 如果事件带有预设选项，则直接使用它们
    if (event.choices && event.choices.length > 0) {
      console.log(`[Event] Using preset choices for event: "${event.title}"`);
      return { narration: event.description, options: event.choices };
    } else {
      // 否则，让 AI 根据事件描述生成场景
      console.log(`[Event] No preset choices for event: "${event.title}". Generating with AI.`);
      return await this.narrateNextScene(event.description, undefined, undefined, gameState);
    }
  }

  /**
   * 切换说书人的叙事风格。
   * @param tone 新的叙事风格
   */
  public setTone(tone: NarrativeTone): void {
    this.currentTone = tone;
    console.log(`说书人风格已切换为: ${tone}`);
  }

  /**
   * 处理玩家的选择，并应用其结果。
   * @param choice 玩家选择的选项
   */
  public handleChoice(choice: EventChoice): void {
    if (choice.result) {
      console.log(`[SceneManager] Applying result for choice: "${choice.text}"`);
      // 在未来的游戏循环中，这里会是核心逻辑
      // applyEventResult(choice.result);
      // renderer.system(choice.result.description);
    } else {
      console.log(`[SceneManager] Choice "${choice.text}" has no result to apply.`);
    }

    this.timeSystem.advanceTime(10);
    // this.narrateNextScene("在方才的抉择之后...");
  }
}