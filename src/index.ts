import "reflect-metadata";
import { container } from "tsyringe";
import { OllamaProvider } from "./core/ai/providers/OllamaProvider.js";
import { mainLoop } from './mainLoop.js';
import { initializeGameState } from './core/state.js';
import { logger } from './utils/logger.js';

import { TimeSystem } from './systems/timeSystem.js';
import { BattleSystem } from './systems/battleSystem.js';
import { SceneManager } from './narrator/sceneManager.js';
import { AIBard } from './narrator/aiBard.js';
import { AICoreService } from './core/ai/AICoreService.js';
import { EventEngine } from './core/eventEngine.js';
import { GameStore } from './core/store/store.js';
import { PromptManager } from './narrator/promptManager.js';

async function start() {
  // --- Dependency Injection Setup ---
  container.register("ILLMProvider", { useClass: OllamaProvider });
  
  // Register services that have dependencies resolved by the container
  container.registerSingleton(AICoreService);
  container.registerSingleton(GameStore);

  // Manually create and register instances for classes without the @singleton decorator
  const timeSystem = new TimeSystem();
  const battleSystem = new BattleSystem();
  const aiService = container.resolve(AICoreService);
  const eventEngine = new EventEngine(aiService);
  const promptManager = new PromptManager();
  const bard = new AIBard(aiService, promptManager);
  const sceneManager = new SceneManager(bard, timeSystem);

  container.registerInstance(TimeSystem, timeSystem);
  container.registerInstance(BattleSystem, battleSystem);
  container.registerInstance(EventEngine, eventEngine);
  container.registerInstance(PromptManager, promptManager);
  container.registerInstance(AIBard, bard);
  container.registerInstance(SceneManager, sceneManager);

  logger.info('Initializing game state...');
  await initializeGameState();
  logger.info('Game state initialized. Starting main loop.');
  mainLoop();
}

start();