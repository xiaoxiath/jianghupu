/**
 * @file 动态事件系统
 * @description 负责管理和触发游戏中的随机事件与奇遇。
 * @see docs/technical_design.md#6-探索与事件系统explorationts
 */

import { gameState } from './state';
import { getRandomInt } from './rng';
import { prisma as db } from './db';
import { modLoader } from './modLoader';

/**
 * 事件的类型
 * @see docs/gdd.md#41-事件模板
 */
export type GameEventType = '战斗' | '机缘' | '社交' | '交易' | '陷阱' | '幻境';

/**
 * 游戏事件的基础结构
 */
export interface GameEvent {
  id: string;
  type: GameEventType;
  title: string;
  description: string; // 用于生成场景摘要的文本
  trigger: (state: any, helpers: any) => boolean; // 触发条件函数
}

// --- 触发器辅助函数 ---
const triggerHelpers = {
  getRandomInt,
  async isFactionWarHappening() {
    const warEvent = await db.eventLog.findFirst({
      where: { type: 'WAR_START' },
      orderBy: { createdAt: 'desc' },
    });
    // 假设战争持续一段时间
    if (warEvent) {
      // 在此可以添加更复杂的逻辑，比如检查战争是否已结束
      return true;
    }
    return false;
  },
};

// --- 事件加载 ---
let eventPool: GameEvent[] = [];

/**
 * 从主数据和所有 Mod 中加载和解析事件。
 */
export async function initializeEventEngine(): Promise<void> {
  const eventData = await modLoader.getMergedData<{ id: string; type: GameEventType; title: string; description: string; trigger: string }>('events.json');

  eventPool = eventData.map(data => ({
    ...data,
    trigger: new Function('state', 'helpers', `
      const { getRandomInt, isFactionWarHappening } = helpers;
      return ${data.trigger};
    `) as (state: any, helpers: any) => boolean,
  }));
}


/**
 * 尝试触发一个随机事件。
 * @returns 如果触发了事件，则返回事件描述；否则返回 null。
 */
export async function triggerRandomEvent(): Promise<GameEvent | null> {
  const state = gameState;
  if (!state) return null;

  const possibleEvents = [];
  for (const event of eventPool) {
    try {
      // 注意：对于异步触发器，我们需要 await
      const shouldTrigger = await Promise.resolve(event.trigger(state, triggerHelpers));
      if (shouldTrigger) {
        possibleEvents.push(event);
      }
    } catch (error) {
      console.error(`Error triggering event ${event.id}:`, error);
    }
  }

  if (possibleEvents.length > 0) {
    // 如果有多个事件可以触发，随机选择一个
    const eventToTrigger = possibleEvents[getRandomInt(0, possibleEvents.length - 1)]!;
    console.log(`[Event Engine] Triggered event: ${eventToTrigger.title}`);
    return eventToTrigger;
  }

  return null;
}