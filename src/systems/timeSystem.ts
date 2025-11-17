import { singleton } from 'tsyringe';

/**
 * @file 游戏时间系统
 * @description 负责管理游戏世界的内部时间。
 */

const TICKS_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

// 使用天干地支纪年
const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];


/**
 * 游戏世界的时间状态
 */
export interface TimeState {
  year: number;
  month: number;
  day: number;
  hour: number;
  tick: number; // 一小时内的分钟或“刻”
}

/**
 * 时间系统类，负责管理游戏时间的流逝和格式化。
 */
@singleton()
export class TimeSystem {
  private time: TimeState;

  constructor() {
    this.time = {
      year: 1, // 从第一年开始
      month: 1,
      day: 1,
      hour: 6, // 辰时
      tick: 0,
    };
  }

  /**
   * 推进游戏时间
   * @param ticks 要推进的刻数
   */
  public advanceTime(ticks: number): void {
    this.time.tick += ticks;

    while (this.time.tick >= TICKS_PER_HOUR) {
      this.time.tick -= TICKS_PER_HOUR;
      this.time.hour++;
    }

    while (this.time.hour >= HOURS_PER_DAY) {
      this.time.hour -= HOURS_PER_DAY;
      this.time.day++;
    }

    // 假设每个月都是30天
    while (this.time.day > 30) {
      this.time.day -= 30;
      this.time.month++;
    }

    while (this.time.month > 12) {
      this.time.month -= 12;
      this.time.year++;
    }
  }

  /**
   * 获取当前时间的格式化字符串
   * @returns 例如 "甲子年冬月初三"
   */
  public getFormattedTime(): string {
    const yearIndex = (this.time.year - 1) % 60;
    const heavenlyStem = HEAVENLY_STEMS[yearIndex % 10];
    const earthlyBranch = EARTHLY_BRANCHES[yearIndex % 12];
    const month = MONTH_NAMES[this.time.month - 1];
    const day = DAY_NAMES[this.time.day - 1];

    return `${heavenlyStem}${earthlyBranch}年${month}月${day}`;
  }

  /**
   * 获取当前时间状态
   */
  public getTimeState(): TimeState {
    return { ...this.time };
  }
}