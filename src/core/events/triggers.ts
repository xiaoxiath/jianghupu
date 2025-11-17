import type { GameState } from '../state';

type TriggerFunction = (state: GameState, helpers: any) => boolean | Promise<boolean>;

const triggerRegistry = new Map<string, TriggerFunction>();

// --- Example Trigger ---
// The trigger function now receives the trigger object itself as the second argument
function isPlayerInLocation(state: GameState, trigger: { id: string, args: [number] }): boolean {
  const [locationId] = trigger.args;
  return state.world.currentLocationId === locationId;
}

// --- Register Triggers ---
triggerRegistry.set('isPlayerInLocation', isPlayerInLocation);

function isPlayerStrong(state: GameState, threshold: number): boolean {
  return state.player.attributes.strength >= threshold;
}
triggerRegistry.set('isPlayerStrong', isPlayerStrong);

export function getTrigger(id: string): TriggerFunction | undefined {
  return triggerRegistry.get(id);
}