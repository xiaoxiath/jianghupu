import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import type { SerializableGameState } from '../core/state.js';

const SAVE_DIR = process.env.SAVE_DIR || path.join(process.cwd(), 'saves');
const TEMP_SUFFIX = '.tmp';

/**
 * 确保存档目录存在。
 */
function ensureSaveDirExists(): void {
  if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
  }
}

/**
 * 将游戏状态写入指定的存档槽。
 * 该操作是原子的：先写入临时文件，成功后再重命名，防止生成不完整的存档。
 *
 * @param slot - 存档槽位编号 (e.g., 1, 2, 3)。
 * @param state - 要保存的游戏状态对象。
 * @returns Promise<void>
 */
export async function writeSaveGame(slot: number, state: SerializableGameState): Promise<void> {
  ensureSaveDirExists();

  const savePath = path.join(SAVE_DIR, `slot_${slot}.sav`);
  const tempPath = savePath + TEMP_SUFFIX;

  return new Promise((resolve, reject) => {
    try {
      const jsonState = JSON.stringify(state);
      zlib.deflate(jsonState, (err, buffer) => {
        if (err) {
          return reject(new Error(`Failed to compress save data: ${err.message}`));
        }

        fs.writeFile(tempPath, buffer, (writeErr) => {
          if (writeErr) {
            return reject(new Error(`Failed to write temporary save file: ${writeErr.message}`));
          }
          // 写入成功后，重命名临时文件，完成原子写入
          fs.rename(tempPath, savePath, (renameErr) => {
            if (renameErr) {
              return reject(new Error(`Failed to rename temporary save file: ${renameErr.message}`));
            }
            resolve();
          });
        });
      });
    } catch (error) {
      reject(new Error(`An unexpected error occurred during save: ${(error as Error).message}`));
    }
  });
}

/**
 * 从指定的存档槽读取游戏状态。
 *
 * @param slot - 存档槽位编号 (e.g., 1, 2, 3)。
 * @returns Promise<GameState> 解析后的游戏状态对象。
 */
export async function readSaveGame(slot: number): Promise<SerializableGameState> {
  const savePath = path.join(SAVE_DIR, `slot_${slot}.sav`);

  return new Promise((resolve, reject) => {
    fs.readFile(savePath, (readErr, buffer) => {
      if (readErr) {
        if (readErr.code === 'ENOENT') {
          return reject(new Error(`Save file for slot ${slot} not found.`));
        }
        return reject(new Error(`Failed to read save file: ${readErr.message}`));
      }

      zlib.unzip(buffer, (unzipErr, unzippedBuffer) => {
        if (unzipErr) {
          return reject(new Error(`Failed to decompress save data, it may be corrupted: ${unzipErr.message}`));
        }

        try {
          const jsonState = unzippedBuffer.toString();
          const state = JSON.parse(jsonState) as SerializableGameState;
          resolve(state);
        } catch (parseErr) {
          reject(new Error(`Failed to parse save data, it may be corrupted: ${(parseErr as Error).message}`));
        }
      });
    });
  });
}

/**
 * 检查存档文件是否存在。
 * @param slot - 存档槽位编号。
 * @returns boolean
 */
export function saveFileExists(slot: number): boolean {
    const savePath = path.join(SAVE_DIR, `slot_${slot}.sav`);
    return fs.existsSync(savePath);
}