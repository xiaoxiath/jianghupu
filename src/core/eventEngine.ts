import type { GameState } from './state';
import { getRandomInt } from './rng';
import { prisma as db } from './db';
import { modLoader } from './modLoader';
import { AICoreService } from './ai/AICoreService';
import { buildContext } from './ai/contextBuilder';
import { singleton, container } from 'tsyringe';
import { GameStore } from './store/store.js';
import { getTrigger } from './events/triggers.js';

export type GameEventType = '战斗' | '机缘' | '社交' | '交易' | '陷阱' | '幻境';

export type EventResult = {
  description: string;
  player_stats?: { hp?: number; mp?: number; };
  player_attributes?: { strength?: number; constitution?: number; intelligence?: number; agility?: number; };
  player_mood?: string;
 data?: any; // For carrying extra payload, e.g., trade details
};

export interface EventChoice {
 text: string;
  action: string;
  result?: EventResult;
}

export interface GameEvent {
  id: string;
  type: GameEventType;
  title: string;
  description: string;
  trigger: ((state: GameState, helpers: any) => boolean | Promise<boolean>);
  choices?: EventChoice[];
  once?: boolean;
}

export class EventEngine {
  private eventPool: GameEvent[] = [];
  private triggerHelpers = {
    getRandomInt,
    async isFactionWarHappening() {
      const warEvent = await db.eventLog.findFirst({
        where: { type: 'WAR_START' },
        orderBy: { createdAt: 'desc' },
      });
      return !!warEvent;
    },
  };

  constructor(private aiService: AICoreService) {}

  public async initialize(): Promise<void> {
    const eventData = await modLoader.getMergedData<{ id: string; type: GameEventType; title: string; description: string; trigger: string | { id: string, args?: any[] }; choices?: EventChoice[], once?: boolean }>('events.json');
    
    this.eventPool = eventData.map(data => {
      let triggerFn: (state: GameState, helpers: any) => boolean | Promise<boolean>;
      const triggerConfig = typeof data.trigger === 'string' ? { id: data.trigger } : data.trigger;
      
      const trigger = getTrigger(triggerConfig.id);

      if (!trigger) {
        console.warn(`[EventEngine] Trigger function "${triggerConfig.id}" not found for event "${data.title}". Event will never trigger.`);
        triggerFn = () => false;
      } else {
        // Pass the whole trigger config object to the trigger function
        triggerFn = (state, helpers) => trigger(state, triggerConfig);
      }

      return {
        ...data,
        trigger: triggerFn,
      };
    });
  }

  public async triggerRandomEvent(state: GameState): Promise<GameEvent | null> {
    if (!state || !state.player) return null;
    const possibleEvents = [];
    for (const event of this.eventPool) {
      if (event.once && state.triggeredOnceEvents.has(event.id)) {
        continue;
      }
      try {
        if (await Promise.resolve(event.trigger(state, this.triggerHelpers))) {
          possibleEvents.push(event);
        }
      } catch (error) {
        console.error(`Error triggering event ${event.id}:`, error);
      }
    }

    if (possibleEvents.length > 0) {
      const eventToTrigger = possibleEvents[getRandomInt(0, possibleEvents.length - 1)]!;
      console.log(`[Event Engine] Triggered event: ${eventToTrigger.title}`);
      if (eventToTrigger.once) {
        const store = container.resolve(GameStore);
        store.dispatch({ type: 'ADD_TRIGGERED_ONCE_EVENT', payload: { eventId: eventToTrigger.id } });
      }
      return eventToTrigger;
    }
    return null;
  }

  public async triggerDynamicEvent(state: GameState): Promise<void> {
    const context = buildContext(state);
    const instruction = "基于以上背景，生成一个符合当前情景的、可能发生的江湖传闻或小事件。事件应简短、有趣，并与玩家的当前状态和位置有一定关联。";
    const prompt = `${context}\n\n**任务指令**\n${instruction}`;
    const response = await this.aiService.generate({ prompt });

    if (response.success && response.content) {
      const newEvent: GameEvent = {
        id: `dyn-event-${Date.now()}`,
        type: '机缘',
        title: '奇遇',
        description: response.content,
        trigger: () => false,
      };
      const store = container.resolve(GameStore);
      store.dispatch({ type: 'ADD_EVENT_TO_QUEUE', payload: { event: newEvent } });
      console.log(`[Event Engine] Triggered dynamic AI event: ${newEvent.title}`);
    } else {
      console.error("[Event Engine] Failed to generate dynamic event from AI.");
    }
  }

  public applyEventResult(result: EventResult): void {
    const store = container.resolve(GameStore);
    store.dispatch({ type: 'APPLY_EVENT_RESULT', payload: { result } });
  }
}

// --- Legacy Exports for Backward Compatibility ---
async function legacyInitializeEventEngine(): Promise<void> {
  const eventEngine = container.resolve(EventEngine);
  await eventEngine.initialize();
}

async function legacyTriggerRandomEvent(): Promise<GameEvent | null> {
  const store = container.resolve(GameStore);
  const eventEngine = container.resolve(EventEngine);
  return eventEngine.triggerRandomEvent(store.getState());
}

async function legacyTriggerDynamicEvent(): Promise<void> {
  const store = container.resolve(GameStore);
  const eventEngine = container.resolve(EventEngine);
  return eventEngine.triggerDynamicEvent(store.getState());
}

function legacyApplyEventResult(result: EventResult): void {
  const eventEngine = container.resolve(EventEngine);
  eventEngine.applyEventResult(result);
}

export {
  legacyInitializeEventEngine as initializeEventEngine,
  legacyTriggerRandomEvent as triggerRandomEvent,
  legacyTriggerDynamicEvent as triggerDynamicEvent,
  legacyApplyEventResult as applyEventResult,
};