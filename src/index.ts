import "reflect-metadata";
import { container } from "tsyringe";
import { enableMapSet } from 'immer';
import { OllamaProvider } from "./core/ai/providers/OllamaProvider.js";
import { mainLoop } from './mainLoop.js';
import { initializeGameState } from './core/initialization.js';
import { logger } from './utils/logger.js';

import { TimeSystem } from './systems/timeSystem.js';
import { BattleSystem } from './systems/battleSystem.js';
import { SceneManager } from './narrator/sceneManager.js';
import { AIBard } from './narrator/aiBard.js';
import { AICoreService } from './core/ai/AICoreService.js';
import { EventEngine } from './core/eventEngine.js';
import { GameStore } from './core/store/store.js';
import { PromptManager } from './narrator/promptManager.js';
import { TriggerRegistry } from './core/events/TriggerRegistry.js';
import { ModLoader } from './core/modLoader.js';

async function start() {
  // --- Immer Setup ---
  enableMapSet();

  // --- Dependency Injection Setup ---
  container.register("ILLMProvider", { useClass: OllamaProvider });
  
  // Register all singletons
  container.registerSingleton(AICoreService);
  container.registerSingleton(TriggerRegistry);
  container.registerSingleton(ModLoader);
  container.registerSingleton(EventEngine);
  container.registerSingleton(GameStore);
  container.registerSingleton(AIBard);
  container.registerSingleton(SceneManager);
  container.registerSingleton(PromptManager);
  container.registerSingleton(TimeSystem);
  container.registerSingleton(BattleSystem);

  // Resolve all necessary instances from the container
  const eventEngine = container.resolve(EventEngine);
  const modLoader = container.resolve(ModLoader);
  const store = container.resolve(GameStore);
  const timeSystem = container.resolve(TimeSystem);
  const sceneManager = container.resolve(SceneManager);

  logger.info('Initializing game state...');
  await initializeGameState(
    eventEngine,
    timeSystem,
    store,
    modLoader
  );
  logger.info('Game state initialized. Starting main loop.');
  mainLoop(
    sceneManager,
    eventEngine,
    store,
    timeSystem,
  );
}

start();