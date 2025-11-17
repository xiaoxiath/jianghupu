import { singleton } from 'tsyringe';
import type { GameState } from '../state';

export type TriggerFunction = (state: GameState, config: any, helpers: any) => boolean | Promise<boolean>;

@singleton()
export class TriggerRegistry {
  private readonly registry = new Map<string, TriggerFunction>();

  constructor() {
    this.registerCoreTriggers();
  }

  private registerCoreTriggers(): void {
    this.register('isPlayerInLocation', this.isPlayerInLocation);
    this.register('isPlayerStrong', this.isPlayerStrong);
    this.register('always', this.always);
    this.register('expression', this.evaluateExpression);
  }

  public register(id: string, func: TriggerFunction): void {
    if (this.registry.has(id)) {
      console.warn(`[TriggerRegistry] Trigger with id "${id}" is already registered and will be overwritten.`);
    }
    this.registry.set(id, func);
  }

  public get(id: string): TriggerFunction | undefined {
    return this.registry.get(id);
  }

  // --- Core Trigger Implementations ---

  private isPlayerInLocation(state: GameState, config: { args: [number] }, _helpers: any): boolean {
    const [locationId] = config.args;
    return state.world.currentLocationId === locationId;
  }

  private isPlayerStrong(state: GameState, config: { args: [number] }, _helpers: any): boolean {
    const [threshold] = config.args;
    return state.player.attributes.strength >= threshold;
  }

  private always(_state: GameState, _config: any, _helpers: any): boolean {
    return true;
  }

  private evaluateExpression(state: GameState, config: { expression: string }, helpers: any): boolean {
    const { expression } = config;
    if (!expression) {
      return false;
    }
    try {
      const context = {
        state,
        ...helpers,
      };
      const keys = Object.keys(context);
      const values = Object.values(context);
      const func = new Function(...keys, `return ${expression}`);
      return !!func(...values);
    } catch (error) {
      console.error(`[TriggerRegistry] Error evaluating expression "${expression}":`, error);
      return false;
    }
  }
}