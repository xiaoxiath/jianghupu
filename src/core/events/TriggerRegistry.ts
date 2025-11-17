import { singleton } from 'tsyringe';
import type { GameState } from '../state';

export type TriggerFunction = (state: GameState, helpers: any) => boolean | Promise<boolean>;

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

  private isPlayerInLocation(state: GameState, trigger: { id: string, args: [number] }): boolean {
    const [locationId] = trigger.args;
    return state.world.currentLocationId === locationId;
  }

  private isPlayerStrong(state: GameState, trigger: { id: string, args: [number] }): boolean {
    const [threshold] = trigger.args;
    return state.player.attributes.strength >= threshold;
  }

  private always(): boolean {
    return true;
  }
}