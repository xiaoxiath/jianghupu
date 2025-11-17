# ⚙️ 《江湖残卷》技术方案（TypeScript 实现）

---

## AI 服务配置

为了与大语言模型（LLM）进行交互，项目设计了一个灵活的 AI 核心系统。所有与 LLM 相关的配置都集中在 `src/config/ai.ts` 文件中，并通过环境变量进行设置。

支持以下环境变量：

- `LLM_PROVIDER`: 指定要使用的 LLM 服务。支持 `'ollama'` 和 `'openai'`（待实现）。默认为 `'ollama'`。
- `LLM_BASE_URL`: LLM 服务的 API 地址。默认为 Ollama 的 `http://localhost:11434`。
- `LLM_MODEL`: 要使用的具体模型名称。默认为 `'deepseek-r1:7b'`。
- `LLM_API_KEY`: 用于访问受保护的 LLM 服务（例如 OpenAI）的 API 密钥。

### 配置示例

- **使用本地 Ollama (默认)**:
    无需设置环境变量，系统将自动使用默认配置。

- **切换 Ollama 模型**:

    ```bash
    export LLM_MODEL=another-ollama-model
    ```

- **连接 OpenAI 服务 (待实现)**:
    在实现了 `OpenAIProvider` 后，可以这样配置：

    ```bash
    export LLM_PROVIDER=openai
    export LLM_API_KEY=your_openai_api_key
    export LLM_MODEL=gpt-4


## 一、总体架构

### 技术栈

| 模块    | 技术                                        |
| ----- | ----------------------------------------- |
| 运行环境  | Node.js (v20+)                            |
| 语言    | TypeScript                                |
| CLI框架 | Inquirer / Commander                      |
| 文本渲染  | Chalk / Ora / Boxen                       |
| 数据存储  | SQLite（通过 Prisma ORM）+ JSON 缓存            |
| 随机生成  | seedrandom / Chance.js                    |
| 状态管理  | Zustand（或自定义状态容器）                         |
| AI叙事  | 本地 LLM 接口（Ollama / LM Studio）或 OpenAI API |
| 模块管理  | ES Modules + pnpm 工作区结构                   |
| 测试框架  | Vitest                                    |
| 打包发布  | esbuild + pkg（生成跨平台可执行文件）                 |

---

## 二、项目目录结构

```
jianghu-chronicle/
├── src/
│   ├── core/
│   │   ├── world.ts           # 世界生成与演化引擎
│   │   ├── state.ts           # 全局状态容器与初始化流程
│   │   ├── eventEngine.ts     # 动态事件系统 (负责探索与奇遇)
│   │   ├── npcEngine.ts       # NPC 行为模拟
│   │   ├── modLoader.ts       # Mod扫描、加载与合并
│   │   ├── archive.ts         # 世界状态的数据库归档与加载
│   │   ├── db.ts              # Prisma 数据库实例
│   │   ├── player.ts          # 玩家状态定义
│   │   └── rng.ts             # 随机数与种子生成
│   │
│   ├── systems/
│   │   ├── combat.ts          # 战斗系统
│   │   ├── cultivation.ts     # 修炼/突破逻辑
│   │   ├── sect.ts            # 门派与势力演化
│   │   └── legacy.ts          # 传承系统
│   │
│   ├── narrator/
│   │   ├── aiBard.ts          # AI说书人接口
│   │   ├── templates/         # 不同性格说书人模板
│   │   └── sceneManager.ts    # 叙事状态机
│   │
│   ├── data/
│   │   ├── events.json        # 基础事件模板
│   │   ├── items.json         # 基础物品
│   │   └── martialArts.json   # 基础武学
│   │
│   ├── ui/
│   │   ├── cli.ts             # 主输入循环
│   │   ├── renderer.ts        # 文本渲染样式
│   │   └── commands.ts        # 命令解析与绑定
│   │
│   ├── utils/
│   │   └── logger.ts          # 调试与日志工具
│   │
│   ├── index.ts               # 程序入口
│   └── mainLoop.ts            # 游戏主循环
│
├── prisma/
│   └── schema.prisma          # 数据库结构定义
│
├── mods/
│   └── ...                  # Mod 目录
├── tests/
│   └── *.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 三、游戏启动流程 (Initialization Sequence)

项目的启动遵循一个明确的顺序，以确保所有模块和数据都已正确加载。该流程在 `src/core/state.ts` 的 `initializeGameState` 函数中定义。

1.  **扫描并加载 Mods (`modLoader.scanAndLoadMods`)**:
    *   程序首先扫描 `mods/` 目录，读取每个 Mod 的 `manifest.json` 文件。
    *   有效的 Mods 被加载到内存中，并根据 `loadPriority` 进行排序。

2.  **初始化事件引擎 (`initializeEventEngine`)**:
    *   事件引擎调用 `modLoader.getMergedData('events.json')`，将主数据 (`src/data/events.json`) 与所有 Mods 提供的事件数据合并。
    *   将事件的 `trigger` 字符串编译成可执行函数。

3.  **运行 Mod Seeders (`modLoader.runModSeeders`)**:
    *   程序遍历所有已加载的 Mods，并执行它们根目录下的 `seed.js` 脚本（如果存在）。
    *   每个 `seed` 函数都会接收到一个 **Prisma 数据库客户端实例**，允许 Mod 在游戏启动时对数据库进行任意操作（如添加新门派、NPC 等）。

4.  **创建/加载游戏状态 (`createInitialGameState`)**:
    *   此步骤在所有 Mods 和数据加载完毕后执行。
    *   它会调用 `loadWorldFromArchive`，尝试从 SQLite 数据库中恢复世界的长期状态（如 NPC 数据）。
    *   如果数据库为空，则会生成一个新的世界，并立即将其归档到数据库中。

```mermaid
graph TD
    A[开始] --> B[扫描并加载 Mods];
    B --> C[初始化事件引擎 (合并数据)];
    C --> D[运行 Mod Seeders (操作数据库)];
    D --> E{加载世界归档 (DB)};
    E -- DB不为空 --> F[恢复世界状态];
    E -- DB为空 --> G[创建新世界];
    G --> H[归档新世界 (DB)];
    H --> F;
    F --> I[游戏主循环开始];
    style D fill:#cde,stroke:#333,stroke-width:2px
    style E fill:#f9f,stroke:#333,stroke-width:2px
```

---

## 四、核心模块设计

### 1️⃣ 世界生成引擎（`world.ts`）

**职责**：构建初始江湖世界
**算法**：

* 使用 `seedrandom` 生成确定性随机种子；
* 随机生成区域 → 门派 → NPC → 资源点；
* 建立关系网（门派联盟/仇杀矩阵）；
* 输出世界状态树。

---

### 2️⃣ NPC 演化系统（`npcEngine.ts`）

**逻辑循环：**

```ts
// 在主循环的每个 Tick 中被调用
for (const npc of npcs) {
  npc.updateMood();
  npc.train();
  npc.move();
  if (npc.encounterEnemy()) npc.fight();
  if (npc.dead) createRumor(npc);
}
```

* 每旬更新：修炼成长、交互、死亡、传功。
* 支持自创武学、门派叛离、组建小派系。

---

### 3️⃣ 战斗系统（`combat.ts`）

**机制：**

* 回合制战斗。
* 技能冷却、气机流转、内力管理。
* 武学组合技：

  ```ts
  if (player.uses('轻功') && player.uses('剑法')) triggerCombo('剑随身走');
  ```

* 战斗结果返回 `CombatResult`（经验、掉落、心境变化）。

---

### 4️⃣ AI 说书人模块（`aiBard.ts`）

**结构：**

```ts
interface BardPrompt {
  sceneSummary: string;
  playerState: PlayerState;
  worldContext: WorldSummary;
  tone: '宿命' | '诙谐' | '哲理' | '疯癫';
}

interface BardOutput {
  narration: string;
  options: string[];
}
```

**实现方案：**

* 支持两种生成模式：

  1. 调用 OpenAI API（GPT-4/5）；
  2. 调用本地模型（Ollama + mistral/phi3）。
* 缓存生成的场景（JSON 文件）。

---

### 5️⃣ 门派系统（`sect.ts`）

* 关系矩阵（联盟/仇杀/中立）存储于数据库。
* 掌门与弟子树结构。
* `evolveFactions` 函数由主循环定期调用，触发：

  * 关系波动
  * 门派战爆发
  * 掌门更替
  * 传功/叛变事件

---

### 6️⃣ 探索与事件系统（`eventEngine.ts`）

**机制：**

* 在 `eventEngine.ts` 中实现，取代了原设计中的 `exploration.ts`。
* 随机事件模板 (`events.json`) + 游戏状态 → 实例化场景。
* 通过 `triggerRandomEvent` 函数在主循环中被调用。
* 事件的 `trigger` 条件是一个可执行的函数，它能访问完整的游戏状态 `state` 和辅助函数 `helpers`。
* 事件结果（如进入战斗、改变场景摘要）会直接影响主循环的走向。

**事件类型：**

* 战斗 encounter
* 机缘 fate
* 社交 social
* 陷阱 trap
* 幻境 dream

---

### 7️⃣ 传承系统（`legacy.ts`）

* 记录血脉谱系与功法继承。
* 角色死亡后，`handleLegacy` 函数被调用。
* 它会记录一条 `LEGACY` 类型的事件到数据库的 `EventLog` 表中，包含前代角色的故事。

  ```ts
  // src/mainLoop.ts
  if (combatResult === 'lose') {
    await handleLegacy();
    lastPlayerChoice = '你在死亡的边缘重生，开始了新的轮回。';
    continue; // 开始新的轮回
  }
  ```

* AI说书人会在新游戏开始时读取这些历史，并融入到开场白中。

---

## 五、持久化与存档系统 (Persistence & Save System)

本系统采用**混合存储策略**，以区分**长期世界演化**和**即时游戏进度**，确保数据安全与高性能。

### 1. 设计原则

*   **数据分离**: 将长期演化的世界历史（NPC生平、门派关系）与玩家的当前会话状态（位置、属性、背包）分开处理。
*   **性能优先**: 快速存/读档（会话状态）不应有明显的延迟。
*   **持久归档**: 世界历史应被持久化，即使玩家开启新的轮回，这些历史依然存在。

### 2. 存储策略

1.  **世界归档 (World Archive) - `archive.ts` & `Prisma`**:
    *   **用途**: 存储整个世界的长期演化数据，形成“历史残卷”。
    *   **内容**: 所有 NPC 的核心数据、门派的兴衰、已发生的重大全局事件 (`EventLog`) 等。
    *   **技术**: 使用 **SQLite** 数据库文件 (`prisma/dev.db`)，通过 **Prisma ORM** 进行访问。
    *   **触发时机**: `archiveWorldState` 在世界初始化时（如果需要）被调用。`loadWorldFromArchive` 在游戏启动时加载历史数据。

2.  **快速存/读档 (Quick Save/Load) - `state.ts` & 文件操作**:
    *   **用途**: 保存当前游戏会话的核心状态，用于快速读档。
    *   **内容**: 玩家所有属性、物品、功法、当前位置、任务进度等。
    *   **技术**: 通过 `serializeGameState` 将 `gameState` 转换为可序列化的 JSON 对象，然后通过文件工具写入本地文件（如 `saves/slot_1.sav`）。读档时则逆向执行。
    *   **触发时机**: 由玩家输入 `save` 或 `load` 指令触发。

### 3. Prisma Schema 核心模型

SQLite 数据库的结构在 `prisma/schema.prisma` 中定义，是世界演化的基石。

```prisma
// schema.prisma

// 记录NPC的核心数据，会随游戏进程更新
model NPC {
  id         Int     @id @default(autoincrement())
  name       String  @unique
  // ... 其他长期属性
}

// 记录世界的重大事件，形成历史
model EventLog {
  id        Int      @id @default(autoincrement())
  type      String // 事件类型，如 WAR_START, NPC_DEATH, LEGACY
  details   String // 事件详情的 JSON 字符串
}

// 门派/势力
model Faction {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  // ...
  relationshipsAsSource   FactionRelationship[] @relation("SourceFaction")
  relationshipsAsTarget   FactionRelationship[] @relation("TargetFaction")
}

// 门派关系
model FactionRelationship {
  id        Int      @id @default(autoincrement())
  sourceId  Int
  targetId  Int
  status    String // ALLIED, HOSTILE, NEUTRAL
  // ...
  source    Faction @relation("SourceFaction", fields: [sourceId], references: [id])
  target    Faction @relation("TargetFaction", fields: [targetId], references: [id])
}
```

---

## 六、游戏主循环设计（`mainLoop.ts`）

游戏的主循环是一个持续运行的 `while` 循环，它驱动着整个世界的演化和玩家的互动。

```ts
// src/mainLoop.ts (Simplified)
while (true) {
  // 1. 活态世界演化 (Living World Tick)
  updateNpcEngine();
  evolveFactions();

  // 2. 检查并触发随机事件
  const event = await triggerRandomEvent();
  if (event) {
    nextSceneSummary = event.description;
    if (event.type === '战斗') {
      const combatResult = await startCombat(...);
      // 处理战斗结果，如果死亡则进入传承
      if (combatResult === 'lose') {
        await handleLegacy();
        continue; // 开始新的轮回
      }
    }
  } else {
    nextSceneSummary = lastPlayerChoice;
  }

  // 3. 调用 AI 说书人生成叙事
  const { narration, options } = await sceneManager.narrateNextScene(...);

  // 4. 渲染UI并获取玩家输入
  renderer.narrator(narration);
  const selection = await cli.prompt('你的选择是？', options);

  // 5. 处理玩家选择
  if (selection === '输入指令') {
    await handleCommand(...);
  } else {
    lastPlayerChoice = selection;
  }
}
```

*   **状态机流转**: 循环本身就是一个状态机，根据事件和玩家选择在 `探索`、`战斗`、`叙事` 等状态间切换。
    ```
    Exploration -> Event Check -> (Combat) -> Narration -> Exploration
    ```

---

## 七、AI 集成层

| 模式   | 模型接口                              | 用途      |
| ---- | --------------------------------- | ------- |
| 本地模式 | Ollama (`http://localhost:11434`) | 离线叙事生成  |
| 云端模式 | OpenAI GPT-4/5                    | 复杂剧情、对话 |
| 混合模式 | 低频API + 高频本地缓存                    | 控制成本与性能 |

AI接口封装：

```ts
async function generateNarration(prompt: BardPrompt): Promise<BardOutput> {
  const model = useLocalLLM ? localBard : openAIClient;
  return model.generate(prompt);
}
```

---

## 八、CLI 界面与交互

* `inquirer` 提供选择式交互；
* `chalk` 提供色彩化文本；
* `ora` 显示加载动画；
* `boxen` 渲染“章节标题”；
* 示例输出：

  ```
  📜 说书人：江湖风起，少年踏月行。
  1️⃣ 拔剑迎风
  2️⃣ 转身归隐
  3️⃣ 纵马出关
  ```

---

## 九、测试与持续集成

| 工具                | 用途                  |
| ----------------- | ------------------- |
| Vitest            | 单元测试（combat、AI输出校验） |
| ESLint + Prettier | 代码规范                |
| GitHub Actions    | 自动构建 + 版本打包         |
| Coverage          | 覆盖率报告（>85%）         |

---

## 十、性能与扩展

| 优化项  | 方案                    |
| ---- | --------------------- |
| 数据规模 | 仅加载当前区域 NPC 与事件       |
| 存档大小 | 定期快照合并历史              |
| 并发任务 | Worker Threads 处理AI生成 |
| 可扩展性 | 支持MOD目录加载剧情/武学/门派     |

---

## 十一、开发阶段计划

| 阶段   | 模块            | 技术重点               |
| ---- | ------------- | ------------------ |
| V0.1 | CLI + 战斗 + 地图 | CLI循环 / 状态管理       |
| V0.3 | AI说书人 / 事件系统  | LLM集成 / 状态机        |
| V0.5 | 开放世界引擎        | NPC仿真 / 势力关系       |
| V0.8 | 传承与历史系统       | 数据持久化 / 快照机制       |
| V1.0 | 优化与打包         | 性能 / mod扩展 / 跨平台打包 |

---

> “代码之下，亦有江湖。每一个循环，皆是命运的呼吸。”

## AI 服务配置

为了与大语言模型（LLM）进行交互，项目设计了一个灵活的 AI 核心系统。所有与 LLM 相关的配置都集中在 `src/config/ai.ts` 文件中，并通过环境变量进行设置。

支持以下环境变量：

-   `LLM_PROVIDER`: 指定要使用的 LLM 服务。支持 `'ollama'` 和 `'openai'`（待实现）。默认为 `'ollama'`。
-   `LLM_BASE_URL`: LLM 服务的 API 地址。默认为 Ollama 的 `http://localhost:11434`。
-   `LLM_MODEL`: 要使用的具体模型名称。默认为 `'deepseek-r1:7b'`。
-   `LLM_API_KEY`: 用于访问受保护的 LLM 服务（例如 OpenAI）的 API 密钥。

### 配置示例

-   **使用本地 Ollama (默认)**:
    无需设置环境变量，系统将自动使用默认配置。

-   **切换 Ollama 模型**:
    ```bash
    export LLM_MODEL=another-ollama-model
    ```

-   **连接 OpenAI 服务 (待实现)**:
    在实现了 `OpenAIProvider` 后，可以这样配置：
    ```bash
    export LLM_PROVIDER=openai
    export LLM_API_KEY=your_openai_api_key
    export LLM_MODEL=gpt-4
