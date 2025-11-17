import type { GameState } from './state';
import { getRandomInt } from './rng';
import { prisma as db } from './db';
import { ModLoader } from './modLoader';
import { AICoreService } from './ai/AICoreService';
import { singleton, inject } from 'tsyringe';
import { buildContext } from './ai/contextBuilder';
import { GameStore } from './store/store.js';
import { TriggerRegistry } from './events/TriggerRegistry.js';
import type { GameEventType, EventResult, EventChoice, GameEvent } from './events/types.js';

@singleton()
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

  constructor(
    @inject(AICoreService) private aiService: AICoreService,
    @inject(GameStore) private store: GameStore,
    @inject(TriggerRegistry) private triggerRegistry: TriggerRegistry,
    @inject(ModLoader) private modLoader: ModLoader,
  ) {}

  public async initialize(): Promise<void> {
    const eventData = await this.modLoader.getMergedData<{ id: string; type: GameEventType; title: string; description: string; trigger: string | { id: string, args?: any[] }; choices?: EventChoice[], once?: boolean }>('events.json');
    
    this.eventPool = eventData.map(data => {
      let triggerFn: (state: GameState, helpers: any) => boolean | Promise<boolean>;
      let triggerConfig = typeof data.trigger === 'string' ? { id: data.trigger } : data.trigger;

      if (triggerConfig.id === 'true') {
        triggerConfig.id = 'always';
      }
      
      const trigger = this.triggerRegistry.get(triggerConfig.id);

      if (trigger) {
        // Pass the whole trigger config object to the trigger function
        triggerFn = (state, helpers) => trigger(state, triggerConfig, helpers);
      } else {
        // If trigger not found by ID, assume the ID is an expression and use the expression trigger
        const expressionTrigger = this.triggerRegistry.get('expression');
        if (expressionTrigger) {
          // The config for the expression trigger is an object with the expression string
          const expressionConfig = { expression: triggerConfig.id };
          triggerFn = (state, helpers) => expressionTrigger(state, expressionConfig, helpers);
        } else {
          console.warn(`[EventEngine] Trigger function "${triggerConfig.id}" not found for event "${data.title}", and expression trigger is not registered. Event will never trigger.`);
          triggerFn = () => false;
        }
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
        await this.store.dispatch({ type: 'ADD_TRIGGERED_ONCE_EVENT', payload: { eventId: eventToTrigger.id } });
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
      this.store.dispatch({ type: 'ADD_EVENT_TO_QUEUE', payload: { event: newEvent } });
      console.log(`[Event Engine] Triggered dynamic AI event: ${newEvent.title}`);
    } else {
      console.error("[Event Engine] Failed to generate dynamic event from AI.");
    }
  }

  public applyEventResult(result: EventResult): void {
    this.store.dispatch({ type: 'APPLY_EVENT_RESULT', payload: { result } });
  }
}
