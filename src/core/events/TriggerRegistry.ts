import { singleton, inject } from 'tsyringe';
import type { GameState } from '../state';
import jexl from 'jexl';
import { getRandomInt } from '../../utils/math';
import { FactionSystem } from '../../systems/factionSystem';

export type TriggerFunction = (state: GameState, config: any, helpers: any) => boolean | Promise<boolean>;

@singleton()
export class TriggerRegistry {
  private readonly registry = new Map<string, TriggerFunction>();
  private jexl: typeof jexl;

  constructor(@inject(FactionSystem) private factionSystem: FactionSystem) {
    this.jexl = jexl;
    // Add custom functions
    this.jexl.addFunction('getRandomInt', getRandomInt);
    this.jexl.addFunction('isFactionWarHappening', this.factionSystem.isFactionWarHappening.bind(this.factionSystem));

    // Add support for Map.get()
    this.jexl.addTransform('get', (val, key) => val.get(key));

    // Add support for String.includes()
    this.jexl.addTransform('includes', (val, searchString) => val.includes(searchString));

    this.registerCoreTriggers();
  }

  private registerCoreTriggers(): void {
    this.register('isPlayerInLocation', this.isPlayerInLocation);
    this.register('isPlayerStrong', this.isPlayerStrong);
    this.register('always', this.always);
    this.register('expression', this.evaluateExpression.bind(this));
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

  private async evaluateExpression(state: GameState, config: { expression: string }, helpers: any): Promise<boolean> {
    const { expression } = config;
    if (!expression) {
      return false;
    }

    try {
      // Jexl 2.3.0 does not support '===' or '?.', and transforms require pipe syntax.
      const sanitizedExpression = expression
        .replace(/===/g, '==')
        .replace(/\?\.(\w+)/g, '.$1') // More generic optional chaining removal
        .replace(/\.get\(/g, '|get(')
        .replace(/\.includes\(/g, '|includes(');


      const context = {
        state,
        ...helpers,
      };
      const result = await this.jexl.eval(sanitizedExpression, context);
      return !!result;
    } catch (error) {
      console.error(`[TriggerRegistry] Error evaluating expression "${expression}":`, error);
      return false;
    }
  }
}