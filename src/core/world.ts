import { initializeRNG, getRandomInt } from './rng.js';
import type { Npc } from './npc.js';

export type LocationType = '城镇' | '山野' | '河流' | '门派';

export interface Location {
  id: number;
  name: string;
  type: LocationType;
  description: string;
  exits: { [direction: string]: number }; // e.g., { '东': 2, '西': 3 }
}

export interface World {
  locations: Map<number, Location>;
  npcs: Npc[];
  currentLocationId: number;
}

const locationNames: { [key in LocationType]: string[] } = {
  城镇: ['洛阳', '长安', '开封', '杭州'],
  山野: ['黑风山', '无名山谷', '乱石坡', '密林'],
  河流: ['黄河', '长江', '淮河', '渭水'],
  门派: ['华山派', '丐帮', '魔教', '少林寺'],
};

/**
 * 基于种子生成一个静态世界
 * @param seed 随机种子
 * @returns World 对象
 */
export function generateWorld(seed: string): World {
  initializeRNG(seed);

  const locations = new Map<number, Location>();
  const worldSize = 10; // 生成 10 个地点

  for (let i = 1; i <= worldSize; i++) {
    const typeValues = Object.keys(locationNames) as LocationType[];
    const type = typeValues[getRandomInt(0, typeValues.length - 1)]!;
    const nameList = locationNames[type];
    const name = nameList[getRandomInt(0, nameList.length - 1)]!;

    locations.set(i, {
      id: i,
      name: `${name} (${i})`, // 添加 ID 以区分同名地点
      type: type,
      description: `这里是${name}，一片未知的区域。`,
      exits: {},
    });
  }

  // 随机连接地点
  for (const location of locations.values()) {
    const numExits = getRandomInt(1, 3);
    for (let j = 0; j < numExits; j++) {
      const exitLocationId = getRandomInt(1, worldSize);
      if (exitLocationId !== location.id) {
        const directions = ['东', '南', '西', '北'] as const;
        const dir = directions[getRandomInt(0, 3)]!;
        if (!location.exits[dir]) {
          location.exits[dir] = exitLocationId;
          // 创建双向连接
          const exitLocation = locations.get(exitLocationId);
          if (exitLocation) {
            const oppositeDirMap = { '东': '西', '西': '东', '南': '北', '北': '南' } as const;
            const oppositeDir = oppositeDirMap[dir];
            if (oppositeDir && !exitLocation.exits[oppositeDir]) {
              exitLocation.exits[oppositeDir] = location.id;
            }
          }
        }
      }
    }
  }

  const npcs: Npc[] = [];
  const npcNames = ['李寻欢', '扫地僧', '东方不败', '令狐冲', '黄蓉'];
  for (let i = 0; i < 5; i++) {
    const locationId = getRandomInt(1, worldSize);
    npcs.push({
      id: i + 1,
      name: npcNames[i]!,
      realm: '凡人',
      alive: true,
      locationId: locationId,
      reputation: 0,
      stats: { hp: 100, maxHp: 100, mp: 50, maxMp: 50 },
      attributes: { strength: 10, constitution: 10 },
    });
  }

  return {
    locations,
    npcs,
    currentLocationId: 1,
  };
}