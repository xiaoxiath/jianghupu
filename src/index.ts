import { mainLoop } from './mainLoop.js';
import { initializeGameState } from './core/state.js';
import { logger } from './utils/logger.js';

async function start() {
  logger.info('Initializing game state...');
  await initializeGameState();
  logger.info('Game state initialized. Starting main loop.');
  mainLoop();
}

start();