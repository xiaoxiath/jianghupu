import Prisma from '@prisma/client';
const { PrismaClient } = Prisma;
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_PATH, 'world.db');

// 在初始化 Prisma Client 之前，确保存放数据库文件的目录存在
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

/**
 * Prisma Client 单例实例。
 *
 * 在整个应用程序中，我们应该只使用这一个实例，以避免创建过多的数据库连接。
 * 这种模式有助于提高性能和资源管理效率。
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management#prismaclient-in-long-running-applications
 */
export const prisma = new PrismaClient();