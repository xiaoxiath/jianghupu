/**
 * @file Cost Monitor Service
 * @description 负责记录和监控 AI 调用的成本。
 */
import { singleton } from 'tsyringe';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '..', '..', '..', 'logs', 'ai_cost.log');

export interface AICallRecord {
  timestamp: string;
  layer: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationSeconds?: number;
}

@singleton()
export class CostMonitorService {
  constructor() {
    // 确保日志目录存在
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  public recordCall(record: Omit<AICallRecord, 'timestamp'>): void {
    const fullRecord: AICallRecord = {
      timestamp: new Date().toISOString(),
      ...record,
    };

    const logLine = JSON.stringify(fullRecord) + '\n';

    // 以追加模式写入日志文件
    fs.appendFile(LOG_FILE, logLine, (err) => {
      if (err) {
        console.error('[CostMonitorService] Failed to write to log file:', err);
      }
    });
  }
}