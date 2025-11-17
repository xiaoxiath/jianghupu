/**
 * @file Mod Loader
 * @description Scans, loads, and merges mods into the game.
 * @see docs/technical_design.md#E16-实现-MOD-加载机制
 */
import { logger } from '../utils/logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { prisma as db } from './db.js';
import { singleton, container } from 'tsyringe';
import { TriggerRegistry, type TriggerFunction } from './events/TriggerRegistry.js';

const MODS_DIR = path.join(process.cwd(), 'mods');

interface ModManifest {
  id: string;
  name: string;
  author: string;
  version: string;
  description?: string;
  loadPriority?: number;
  entry?: string; // e.g., "index.js"
}

interface Mod {
  manifest: ModManifest;
  path: string;
}

@singleton()
export class ModLoader {
  private mods: Mod[] = [];

  constructor() {}

  /**
   * Scans the mods directory and loads valid mods.
   */
  public async scanAndLoadMods(): Promise<void> {
    logger.info('Scanning for mods...');
    try {
      const modFolders = await fs.readdir(MODS_DIR, { withFileTypes: true });
      for (const dirent of modFolders) {
        if (dirent.isDirectory()) {
          const modPath = path.join(MODS_DIR, dirent.name);
          const manifestPath = path.join(modPath, 'manifest.json');
          try {
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent) as ModManifest;
            this.mods.push({ manifest, path: modPath });
            logger.info(`Loaded mod: ${manifest.name} (v${manifest.version})`);

            await this.loadModAssets(modPath, manifest);

          } catch (error) {
            logger.warn(`Could not load mod in ${dirent.name}. Invalid or missing manifest.json.`);
          }
        }
      }
      this.sortMods();
      logger.info(`Found and loaded ${this.mods.length} mods.`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.info('No mods directory found. Skipping mod loading.');
      } else {
        logger.error('Error scanning for mods:', error);
      }
    }
  }

  private async loadModAssets(modPath: string, manifest: ModManifest): Promise<void> {
    const entryFile = manifest.entry || 'index.js';
    const entryPath = path.join(modPath, entryFile);

    try {
      await fs.access(entryPath);
      const modModule = await import(entryPath);

      // Load triggers
      if (modModule.triggers && typeof modModule.triggers === 'object') {
        for (const [id, func] of Object.entries(modModule.triggers)) {
          if (typeof func === 'function') {
            container.resolve(TriggerRegistry).register(id, func as TriggerFunction);
            logger.info(`Registered trigger "${id}" from mod "${manifest.name}".`);
          }
        }
      }

      // Future: Load other assets like custom actions, components, etc.

    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error(`Error loading assets from entry file for mod ${manifest.name}:`, error);
      }
    }
  }

  /**
   * Sorts mods based on their loadPriority.
   */
  private sortMods(): void {
    this.mods.sort((a, b) => {
      const priorityA = a.manifest.loadPriority ?? 0;
      const priorityB = b.manifest.loadPriority ?? 0;
      return priorityA - priorityB;
    });
  }

  /**
   * Merges data from the base game and all mods for a given file.
   * @param fileName The name of the data file (e.g., 'events.json').
   * @returns A merged array of data objects.
   */
  public async getMergedData<T>(fileName: string): Promise<T[]> {
    let mergedData: T[] = [];
    const baseDataPath = path.join(process.cwd(), 'src', 'data', fileName);

    try {
      const baseContent = await fs.readFile(baseDataPath, 'utf-8');
      mergedData = JSON.parse(baseContent);
    } catch (error) {
      logger.warn(`Could not read base data file: ${fileName}.`);
    }

    for (const mod of this.mods) {
      const modDataPath = path.join(mod.path, 'data', fileName);
      try {
        const modContent = await fs.readFile(modDataPath, 'utf-8');
        const modData = JSON.parse(modContent) as T[];
        // Simple concatenation, mods can add new items.
        // For more complex merging, a deep merge strategy would be needed.
        mergedData = mergedData.concat(modData);
        logger.info(`Merged data from ${mod.manifest.id}/${fileName}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          logger.warn(`Could not read data file from mod ${mod.manifest.id}: ${fileName}`);
        }
      }
    }

    return mergedData;
  }

  /**
   * Executes the seed script for each loaded mod.
   */
  public async runModSeeders(): Promise<void> {
    logger.info('Running mod seeders...');
    for (const mod of this.mods) {
      const seederPath = path.join(mod.path, 'seed.js'); // Note: we'll import the compiled .js file
      try {
        // Check if the seeder file exists before trying to import it
        await fs.access(seederPath);
        logger.info(`Executing seeder for mod: ${mod.manifest.name}...`);
        
        // Dynamically import the mod's seeder module
        const seederModule = await import(seederPath);
        
        if (typeof seederModule.seed === 'function') {
          // Pass the prisma client instance to the seeder
          await seederModule.seed(db);
        } else {
          logger.warn(`Mod ${mod.manifest.name} has a seed.js file, but it does not export a 'seed' function.`);
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // It's okay if a mod doesn't have a seeder
          continue;
        }
        logger.error(`Error executing seeder for mod ${mod.manifest.name}:`, error);
      }
    }
    logger.info('All mod seeders executed.');
  }
}
