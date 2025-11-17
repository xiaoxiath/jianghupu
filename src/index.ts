import "reflect-metadata";
import { container } from "tsyringe";
import { enableMapSet } from 'immer';
import { OllamaProvider } from "./core/ai/providers/OllamaProvider.js";
import { mainLoop } from './mainLoop.js';
import { initializeGameState } from './core/initialization.js';
import { logger } from './utils/logger.js';
import { cli } from './ui/cli.js';

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
  // --- Dependency Injection Setup ---
  // Core services
  container.registerSingleton(AICoreService);
  container.registerSingleton(TriggerRegistry);
  container.registerSingleton(ModLoader);
  container.registerSingleton(AIBard);
  container.registerSingleton(PromptManager);

  // Systems
  container.registerSingleton(TimeSystem);
  container.registerSingleton(BattleSystem);

  // GameStore must be registered before other classes that depend on it.
  container.registerSingleton(GameStore);

  // Classes that depend on GameStore
  container.registerSingleton(EventEngine);
  container.registerSingleton(SceneManager);


  // --- Instance Resolution ---
  // Create the single GameStore instance first.
  const store = container.resolve(GameStore);

  // Now resolve other instances that might depend on GameStore.
  const eventEngine = container.resolve(EventEngine);
  const modLoader = container.resolve(ModLoader);
  const timeSystem = container.resolve(TimeSystem);
  const sceneManager = container.resolve(SceneManager);

  // Ask user if they want to load mods
  const loadMods = await cli.prompt('是否加载 Mods？', ['是', '否']);

  if (loadMods === '是') {
    await modLoader.scanAndLoadMods();
  }

  logger.info('Initializing game state...');
  await initializeGameState(
    eventEngine,
    timeSystem,
    store,
    modLoader
  );

  if (loadMods === '是') {
    await modLoader.runModSeeders();
  }

  logger.info('Game state initialized. Starting main loop.');
  mainLoop(
    sceneManager,
    eventEngine,
    store,
    timeSystem,
  );
}

start();