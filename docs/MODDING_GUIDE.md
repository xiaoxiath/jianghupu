# 《江湖残卷》Mod 开发指南

欢迎你，江湖的创造者！

本指南将帮助你理解《江湖残卷》的 Mod 系统，并创建你自己的内容扩展。

## 1. Mod 系统入门

### Mod 的能力

《江湖残卷》的 Mod 系统非常强大，它允许你：

- **添加新内容**: 创建全新的武学、物品、丹药、装备等。
- **创造新事件**: 设计新的随机事件、奇遇和小型任务。
- **建立新势力**: 通过脚本在世界中创建新的宗派、家族或神秘组织。
- **填充世界**: 添加独特的 NPC，让他们在你的江湖中留下自己的故事。

### 基本原则

Mod 的核心理念是 **数据驱动** 和 **脚本注入**，而不是直接修改核心游戏代码。这保证了 Mod 之间的兼容性，也使得核心游戏更新时，你的 Mod 不容易损坏。

- **数据驱动**: 你通过提供 `.json` 文件来添加新的内容。
- **脚本注入**: 你通过提供一个 `seed.js` 文件，在游戏启动时执行数据库操作。

## 2. 创建你的第一个 Mod

1. **创建目录**: 在游戏根目录下的 `mods/` 文件夹中，创建一个新文件夹。文件夹名称建议使用全小写和短横线，例如 `my-cool-mod`。
2. **创建清单文件**: 在你的 Mod 文件夹 (`my-cool-mod/`) 中，创建一个名为 `manifest.json` 的文本文件。
3. **编写清单**: 填入你 Mod 的基本信息。一个最基础的 `manifest.json` 如下：

    ```json
    {
      "id": "my-cool-mod",
      "name": "My Cool Mod",
      "author": "Your Name",
      "version": "1.0.0"
    }
    ```

    现在，重启游戏，你应该能在启动日志中看到 "Loaded mod: My Cool Mod" 的信息，证明你的 Mod 已经被成功识别了！

## 3. `manifest.json` 详解

`manifest.json` 是你 Mod 的“身份证”。

- `id` (string, **必需**): 你的 Mod 的唯一标识符，只能包含小写字母、数字和短横线。**请确保它在所有 Mod 中是独一无二的。**
- `name` (string, **必需**): 显示在日志和其他地方的、人类可读的 Mod 名称。
- `author` (string, **必需**): 你的大名或昵称。
- `version` (string, **必需**): Mod 的版本号。强烈建议遵循 [语义化版本](https://semver.org/lang/zh-CN/) (例如 `1.0.0`, `1.1.0-beta`)。
- `description` (string, *可选*): 一段简要的文字，描述你的 Mod 做了什么。
- `loadPriority` (number, *可选*): 加载优先级。数字越小，越早被加载。默认为 `0`。如果你想覆盖其他 Mod 的数据（不推荐），或者你的 Mod 依赖于另一个 Mod，你可能需要调整这个值。

## 4. 数据驱动：添加新内容

这是最常用、最安全的 Mod 开发方式。你只需要在你的 Mod 文件夹里创建一个 `data/` 目录，然后在里面放置相应名称的 `.json` 文件即可。

### 示例：添加一个新事件

1. 在 `my-cool-mod/` 中创建 `data/` 目录。
2. 在 `data/` 目录中创建 `events.json` 文件。
3. 在 `events.json` 中添加一个或多个事件对象组成的数组：

    ```json
    [
      {
        "id": "my-cool-mod.mysterious-cave",
        "type": "机缘",
        "title": "神秘的山洞",
        "description": "你在山壁上发现了一个不起眼的洞口，似乎深不见底。",
        "trigger": "state.player.level >= 3 && helpers.getRandomInt(1, 100) <= 5"
      }
    ]
    ```

#### `trigger` 详解

`trigger` 字段是事件能否触发的关键。它是一个**返回布尔值的 JavaScript 表达式字符串**。

在每个游戏 tick，游戏会遍历所有事件，并执行这个表达式。如果返回 `true`，该事件就可能被触发。

在表达式中，你可以使用两个预设的变量：

- `state`: 包含了完整的当前游戏状态，你可以访问 `state.player` 的所有属性。
- `helpers`: 提供了一些方便的辅助函数：
  - `helpers.getRandomInt(min, max)`: 获取一个 `min` 到 `max` 之间的随机整数。
  - `helpers.isFactionWarHappening()`: **[异步]** 检查当前是否有宗派正在发生战争。

**触发器示例**:

- `"state.player.alignment === '邪'"`: 当玩家是邪派时触发。
- `"state.player.attributes.intelligence > 15"`: 当玩家悟性高于 15 时触发。
- `"helpers.getRandomInt(1, 10) === 1"`: 10% 的几率触发。
- `"await helpers.isFactionWarHappening()"`: 当世界上有战争正在发生时触发。**注意 `await` 关键字**。

### 支持的数据文件

你可以通过同样的方式添加更多内容。文件名应与 `prisma/schema.prisma` 中的模型名（小写并用下划线连接）对应：

- `events.json`: 添加事件。
- `items.json`: 添加物品。
- `martial_arts.json`: 添加武学。
- `factions.json`: 添加门派 (不推荐，建议使用 `seed.js`)。
- ...以及未来支持的更多类型。

## 5. 脚本注入：使用 `seed.js`

当你需要执行更复杂的操作，尤其是**需要与数据库进行精细交互**时，就需要用到 `seed.js`。这是 Mod 开发最强大的部分。

**使用场景**:

- 创建一个全新的、拥有复杂关系的宗派。
- 在世界中预设一个独特的、拥有特定属性的 NPC。
- 修改游戏中已有的数据（例如，增强某个基础武学）。
- 在游戏启动时执行任何你需要的数据库逻辑。

### 如何使用

1. 在你的 Mod 根目录 (例如 `my-cool-mod/`) 创建一个 `seed.js` 文件。
2. 在该文件中，导出一个名为 `seed` 的异步函数。

**示例代码**:

```javascript
// my-cool-mod/seed.js

/**
 * Mod Seeder - 在游戏启动时执行的脚本
 * @param {import('@prisma/client').PrismaClient} db - Prisma Client 实例。
 * 借助 JSDoc，你的代码编辑器（如 VSCode）可以提供完整的类型提示和自动补全。
 */
export async function seed(db) {
  console.log('Seeding data for My Cool Mod...');

  // 使用 upsert 确保数据不会重复创建
  // 如果名为“听雪楼”的宗派不存在，则创建它；如果存在，则什么也不做。
  await db.faction.upsert({
    where: { name: '听雪楼' },
    update: {},
    create: {
      name: '听雪楼',
      alignment: '中立',
      reputation: 100,
      description: '一个由 Mod 添加的、专门收集情报的神秘组织。'
    }
  });

  console.log('Finished seeding for My Cool Mod.');
}
```

**重要提示**:

- Seeder 在**游戏每次启动时**都会运行。为了避免重复创建数据导致错误，请务必使用 `upsert` 或在创建前进行存在性检查。
- 传递给 `seed` 函数的 `db` 对象就是 **`PrismaClient` 的实例**，你可以使用它执行任何数据库操作。它的能力非常强大，请参考 [Prisma 官方文档](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference) 了解其完整用法。

## 6. 调试你的 Mod

- **日志是你的好朋友**: 游戏启动时的控制台输出会提供大量关于 Mod 加载过程的信息。
- **Mod 加载器会报告**:
  - `manifest.json` 无效或缺失。
  - `data/` 目录下的 `.json` 文件格式错误。
  - `seed.js` 脚本执行失败，并打印详细的错误信息。

祝你创造顺利，期待在江湖中看到你的杰作！
