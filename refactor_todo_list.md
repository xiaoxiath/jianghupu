# 《江湖谱》- 详细重构 TODO List

本文档基于《详细技术方案文档》的分析，旨在提供一份清晰、可执行的重构任务清单，以全面提升项目的代码质量、可维护性和扩展性。

---

## 第一优先级：架构一致性与解耦

**目标**: 解决核心模块设计不统一和业务逻辑与数据访问耦合的问题，为后续重构打下坚实基础。

*   **[ ] 任务 1.1: 重构门派系统 (`sect.ts`) 为面向对象的 `FactionSystem` 类**
    *   **描述**: 当前 `sect.ts` 是一个函数式模块，与 `TimeSystem` 等面向对象的系统风格不一致。
    *   **步骤**:
        1.  在 `src/systems/` 目录下创建一个新的 `factionSystem.ts` 文件。
        2.  定义一个 `FactionSystem` 类，并使用 `@singleton()` 装饰器。
        3.  将 `evolveFactions`, `updateFactionReputation` 等函数迁移为 `FactionSystem` 类的方法。
        4.  在 `src/index.ts` 中，将 `FactionSystem` 注册为单例。
        5.  在 `GameStore` 的 `updateWorld` 方法中，注入并调用 `FactionSystem` 的实例，而不是直接调用 `evolveFactions` 函数。
        6.  删除旧的 `src/systems/sect.ts` 文件。

*   **[ ] 任务 1.2: 引入仓储模式 (Repository Pattern) 解耦门派系统与数据库**
    *   **描述**: `FactionSystem` (原 `sect.ts`) 直接依赖 Prisma 进行数据操作，耦合度高。
    *   **步骤**:
        1.  创建一个新的目录 `src/repositories/`。
        2.  在 `src/repositories/` 下创建 `factionRepository.ts` 文件。
        3.  定义一个 `FactionRepository` 类 (同样注册为单例)，封装所有与 `Faction` 和 `FactionRelationship` 相关的 Prisma 查询。例如：
            *   `findMany()`: 查找所有门派。
            *   `incrementReputation(id, amount)`: 增加声望。
            *   `findHostileRelationsshipsAboveThreshold(threshold)`: 查找敌对度超过阈值的关系。
        4.  在 `FactionSystem` 中，注入 `FactionRepository`。
        5.  重构 `FactionSystem` 的方法，使其调用 `FactionRepository` 的接口，而不是直接调用 `db.faction.findMany` 等 Prisma 函数。

---

## 第二优先级：提升核心服务的健壮性与可维护性

**目标**: 优化 `GameStore` 和 `TriggerRegistry` 的设计，使其更符合开闭原则和安全编码规范。

*   **[ ] 任务 2.1: 拆分 `GameStore` 的 Reducer**
    *   **描述**: `GameStore` 中的 `switch` 语句会随着项目发展而变得异常臃肿。
    *   **步骤**:
        1.  在 `src/core/store/` 目录下创建一个 `reducers` 子目录。
        2.  根据状态切片，创建不同的 reducer 文件，如 `playerReducer.ts`, `worldReducer.ts`, `eventReducer.ts`。
        3.  每个 reducer 文件导出一个函数，该函数接收对应的状态部分和 action，返回新的状态部分。
        4.  在 `GameStore` 的 `dispatch` 方法中，创建一个“根 reducer”，它按顺序调用所有子 reducer，并将它们的结果合并成新的 `GameState`。
        5.  例如：`draft.player = playerReducer(draft.player, action);`

*   **[ ] 任务 2.2: 替换 `TriggerRegistry` 中危险的表达式评估**
    *   **描述**: 使用 `new Function()` 存在安全风险且难以调试。
    *   **方案**: 引入一个安全的、轻量级的表达式解析库（如 `jexl`），或者实现一个非常简单的自定义解析器。
    *   **步骤 (以引入 `jexl` 为例)**:
        1.  `pnpm add jexl`
        2.  在 `TriggerRegistry.ts` 中，导入 `jexl`。
        3.  修改 `evaluateExpression` 方法，使用 `jexl.eval(expression, context)` 来替代 `new Function()`。
        4.  更新 `events.json` 中的相关表达式，确保其与 `jexl` 语法兼容（大部分 JS 语法都兼容）。

---

## 第三优先级：消除硬编码与魔法数字

**目标**: 将散落在代码中的配置和规则提取出来，实现数据驱动和易于配置。

*   **[ ] 任务 3.1: 重构 `SceneManager` 中的 NPC 交互逻辑**
    *   **描述**: 当前 `SceneManager` 根据 NPC 的硬编码名字来添加交互选项。
    *   **步骤**:
        1.  在 NPC 的类型定义（`src/core/npc.ts`）中，增加一个 `capabilities` 字段，类型为 `string[]`。例如：`['trade', 'skill_learn']`。
        2.  在 `createNpc` 函数中，为不同类型的 NPC 设置对应的 `capabilities`。
        3.  创建一个 `InteractionRegistry` 或类似的模块，将能力名称（如 `'trade'`）映射到具体的交互逻辑（如生成交易选项）。
        4.  在 `SceneManager.narrateNextScene` 方法中，遍历 `gameState.sceneNpcs`，检查每个 NPC 的 `capabilities` 数组，并从 `InteractionRegistry` 中查找对应的逻辑来动态生成选项，而不是使用 `if (npc.name === '...')`。

*   **[ ] 任务 3.2: 提取游戏规则和配置为常量或配置文件**
    *   **描述**: 将代码中的魔法数字（如 `hostileThreshold = 100`）集中管理。
    *   **步骤**:
        1.  创建一个 `src/config/` 目录。
        2.  在 `src/config/` 下创建 `gameRules.ts` 文件。
        3.  将类似 `hostileThreshold`、战斗伤害计算公式、NPC 基础属性等常量或简单函数导出。
        4.  在 `FactionSystem`, `BattleSystem` 等模块中，导入并使用这些配置，而不是直接使用魔法数字。

---

## 第四优先级：代码整洁与可读性优化

**目标**: 解决入口文件职责过重、代码重复等问题，提升代码整体质量。

*   **[ ] 任务 4.1: 封装应用启动逻辑**
    *   **描述**: `src/index.ts` 文件过于臃肿。
    *   **步骤**:
        1.  创建一个 `src/application.ts` 文件。
        2.  定义一个 `Application` 类。
        3.  将 `src/index.ts` 中的 DI 注册、实例解析、Mod 加载、游戏初始化和主循环启动等逻辑全部移入 `Application` 类的一个 `start()` 方法中。
        4.  `src/index.ts` 文件将只保留一行核心代码：`new Application().start();`
        5.  **深入思考**: 在执行此任务时，再次审视 `GameStore` 的手动解析问题。封装到 `Application` 类后，能否通过调整 DI 注册的生命周期（如 `container.registerType`）来让容器自动处理依赖顺序。

*   **[ ] 任务 4.2: 提取 `AIBard` 中的重复 JSON 解析逻辑**
    *   **描述**: `AIBard` 中的 `generateTradeScene`, `generateSkillMasterScene` 等方法有重复的 JSON 解析代码。
    *   **步骤**:
        1.  在 `AIBard` 类中创建一个私有辅助方法 `_parseJsonResponse<T>(response: { content: string | null }): T | null`。
        2.  将通用的 JSON 清理、`try...catch` 解析逻辑放入这个新方法中。
        3.  在 `generateTradeScene` 等方法中，调用 `this._parseJsonResponse<TradeInfo>(response)` 来获取结果。