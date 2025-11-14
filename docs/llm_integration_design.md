# 大型语言模型（LLM）集成技术方案

> 本文档旨在为《江湖残卷》项目设计一个全面的大型语言模型（LLM）集成方案，以增强游戏世界的动态性、随机性和叙事深度。

## 目录
1.  [高层架构](#1-高层架构)
2.  [影响范围](#2-影响范围)
3.  [数据流](#3-数据流)
4.  [LLM 选型](#4-llm-选型)
5.  [风险与挑战](#5-风险与挑战)

---

## 1. 高层架构

为了将 LLM 更深入地集成到游戏逻辑中，我们建议在现有 `aiBard.ts` 的基础上，构建一个统一的、可扩展的 **“AI 核心服务（AI Core Service）”**。此服务将作为游戏引擎与 LLM 之间的中央协调器，而不是让各个子系统直接调用 LLM。

**核心设计理念:**
*   **统一接口**: 所有需要 AI 生成内容的游戏系统（事件、NPC、叙事等）都通过 AI 核心服务提交请求。
*   **情境感知**: 服务负责从 `GameState` 中提取和格式化相关上下文，为 LLM 提供“情境（Context）”。
*   **可插拔模型**: 架构上支持轻松切换不同的 LLM（本地 Ollama、云端 API 等），便于成本和性能优化。
*   **任务特化**: 针对不同任务（如生成事件、NPC 对话、世界传闻），使用不同的 Prompt 模板和解析器。

**架构图:**

```mermaid
graph TD
    subgraph GameEngine
        EventEngine["事件引擎 (EventEngine)"]
        NpcEngine["NPC 引擎 (NpcEngine)"]
        SceneManager["场景管理器 (SceneManager)"]
        OtherSystems["其他系统 (战斗, 门派等)"]
    end

    subgraph AICoreService [AI 核心服务]
        direction LR
        RequestRouter["请求路由器"]
        ContextBuilder["情境构建器"]
        PromptTemplating["Prompt 模板"]
        LLM_Adapter["LLM 适配器"]
        ResponseParser["响应解析器"]
    end
    
    subgraph LLM_Providers [LLM 提供方]
        Ollama["本地 Ollama (e.g., Llama3, Phi-3)"]
        CloudAPI["云服务 API (e.g., GPT, Claude)"]
    end

    GameEngine -->|1. 生成请求 (e.g., '生成一个奇遇')| RequestRouter
    RequestRouter -->|2. 路由到特定任务| ContextBuilder
    ContextBuilder -->|3. 从 GameState 提取数据| GameEngine
    ContextBuilder -->|4. 构建情境| PromptTemplating
    PromptTemplating -->|5. 生成完整 Prompt| LLM_Adapter
    LLM_Adapter -->|6. 调用 LLM| LLM_Providers
    LLM_Providers -->|7. 返回原始文本/JSON| LLM_Adapter
    LLM_Adapter -->|8. 格式化响应| ResponseParser
    ResponseParser -->|9. 解析为结构化数据| RequestRouter
    RequestRouter -->|10. 返回结果 (e.g., GameEvent 对象)| GameEngine
```

此架构将 LLM 的复杂性与核心游戏逻辑解耦，提高了系统的模块化和可维护性。

---

## 2. 影响范围

集成 AI 核心服务将对以下核心游戏系统产生影响，旨在用动态生成的内容替换或增强现有的静态逻辑。

| 系统模块 | 文件路径 | 拟议的 LLM 集成点 | 影响级别 |
| :--- | :--- | :--- | :--- |
| **事件引擎** | `src/core/eventEngine.ts` | - **动态事件生成**: 在 `triggerRandomEvent` 中，当没有静态事件触发时，调用 AI 服务生成一个全新的、与当前世界状态相关的随机事件。<br>- **事件效果生成**: 为生成的事件动态创建效果描述和玩家选项。 | **高** |
| **NPC 引擎** | `src/core/npcEngine.ts` | - **自主行为决策**: 在 `updateNpcEngine` 中，为每个 NPC 调用 AI 服务，根据其性格、目标和当前环境生成下一步行动（如修炼、寻仇、探索、社交）。<br>- **动态对话**: 当玩家与 NPC 交互时，调用 AI 服务生成符合其身份和情境的对话。 | **高** |
| **叙事/场景** | `src/narrator/sceneManager.ts` & `aiBard.ts` | - **丰富场景描述**: 扩展 `aiBard`，使其能根据更丰富的游戏状态（如天气、地点特殊状态、NPC 间的关系）生成更具沉浸感的叙事。<br>- **动态世界传闻**: 定期调用 AI 服务，根据最近发生的大事件（如门派战争、玩家突破）生成江湖传闻。 | **中** |
| **战斗系统** | `src/systems/combat.ts` | - **过程描述生成**: 在战斗的每个回合，调用 AI 服务生成生动的攻击、防御和技能施放描述，取代单调的文本。 | **低** |
| **门派系统** | `src/systems/sect.ts` | - **动态外交事件**: 在 `evolveFactions` 中，调用 AI 服务生成门派间的“软”事件，如谣言、背叛、秘密结盟等，影响关系变化。 | **中** |
| **传承系统** | `src/systems/legacy.ts` | - **生成个性化墓志铭/传说**: 在 `handleLegacy` 中，调用 AI 服务，根据逝去角色的生平事迹（重要战斗、成就、人际关系）生成一段独特的传承故事。 | **低** |


---

## 3. 数据流

为了确保 LLM 能够生成高质量、符合情境的内容，必须设计一个清晰、高效的数据流。

### 3.1. 输入端：从游戏状态到 Prompt

**目标**: 将庞大、复杂的游戏状态（`GameState`）压缩成简洁、高效、对 LLM 友好的文本或 JSON 摘要。

**执行者**: `AI 核心服务`中的`情境构建器（ContextBuilder）`。

**流程**:
1.  **接收请求**: `ContextBuilder` 接收来自游戏系统的请求，例如 `generate_npc_action`，并附带目标 NPC 的 ID。
2.  **提取核心数据**:
    *   **玩家状态**: 简化为关键指标，如 `姓名, 等级, 境界, 门派, 声望, 最近的大事件`。
    *   **目标 NPC 状态**: `姓名, 性格, 目标, 与玩家的关系, 当前位置, 持有物品`。
    *   **世界上下文**: `游戏时间, 当前地点描述, 最近发生的世界级事件（如战争、天灾）, 周围的其他 NPC 列表`。
3.  **格式化为摘要**: 将提取的数据格式化为结构化的文本片段。

**示例：为 NPC 生成行动决策的上下文**
```json
{
  "task": "generate_npc_action",
  "npc_context": {
    "name": "林玄",
    "personality": "孤僻, 记仇",
    "goal": "为师门复仇",
    "location": "破败的寺庙",
    "relationship_with_player": "HOSTILE",
    "recent_memory": "曾在集市被玩家击败"
  },
  "world_context": {
    "time": "黄昏",
    "location_description": "一座荒废的古寺，乌鸦在盘旋。",
    "recent_world_event": "青城派与魔教爆发了战争。"
  },
  "player_summary": {
    "name": "无名氏",
    "realm": "筑基",
    "sect": "魔教"
  }
}
```

### 3.2. 输出端：从 LLM 响应到游戏行为

**目标**: 将 LLM 返回的（可能不稳定的）文本或 JSON，安全地解析为游戏可以执行的结构化数据。

**执行者**: `AI 核心服务`中的`响应解析器（ResponseParser）`。

**流程**:
1.  **接收 LLM 输出**: 接收来自 `LLM 适配器` 的原始响应。
2.  **格式校验**: 检查响应是否为有效的 JSON。如果不是，则尝试进行修复（例如，补全缺失的括号）或回退到默认行为。
3.  **结构校验**: 使用预定义的 Schema（如 Zod 或 TypeBox）验证 JSON 对象的结构是否符合预期。例如，一个 `npc_action` 响应必须包含 `action_type` 和 `target` 字段。
4.  **内容清洗**: 对文本内容进行过滤，去除不当词汇或可能破坏游戏逻辑的指令。
5.  **转换为游戏对象**: 将验证后的数据转换为游戏引擎可以理解的格式，例如一个新的 `GameEvent` 对象，或是一个包含 `action` 和 `parameters` 的 NPC 行为指令。

**示例：解析 NPC 行动决策的响应**

*   **LLM 原始输出 (JSON 字符串)**:
    ```json
    {
      "reasoning": "玩家是魔教中人，而我的目标是复仇。此地僻静，是偷袭的好机会。",
      "action": "AMBUSH_PLAYER",
      "target": "无名氏",
      "dialogue_on_encounter": "魔崽子，纳命来！"
    }
    ```
*   **ResponseParser 解析后的输出 (JS 对象)**:
    ```javascript
    {
      actionType: 'AMBUSH',
      targetId: 'player_1', // 转换为内部 ID
      payload: {
        dialogue: '魔崽子，纳命来！'
      }
    }
    ```
这个结构化的对象随后可以被 `NpcEngine` 直接用于执行具体的游戏逻辑。


---

## 4. LLM 选型

选择合适的 LLM 是平衡成本、性能、速度和内容质量的关键。考虑到项目的实验性质，我们建议采用一种混合的、可配置的策略。

**核心建议**: **设计一个可插拔的 `LLM 适配器（LLM Adapter）`**，而不是硬编码任何一个特定的模型。

### 4.1. 开发与测试阶段：本地模型优先

在开发和快速迭代阶段，强烈建议使用本地运行的模型。

*   **工具**: **Ollama**
*   **推荐模型**:
    *   **Phi-3-mini**: 速度极快，资源消耗低，非常适合用于功能测试和快速验证 Prompt 结构。
    *   **Llama-3-8B**: 综合性能更强，能更好地理解复杂指令和生成高质量的 JSON，作为本地开发的主要模型。
    *   **deepseek-coder** 或类似模型：在生成与代码相关的逻辑（如动态效果脚本）时可能表现更佳。
*   **优势**:
    *   **零成本**: 无需支付 API 调用费用。
    *   **高速度**: 本地调用延迟极低。
    *   **数据隐私**: 所有游戏数据保留在本地。
*   **劣势**:
    *   **性能限制**: 不及顶尖的商业模型。
    *   **硬件依赖**: 需要一定的本地计算资源。

### 4.2. 生产或发布阶段：云端模型备选

当游戏需要对外发布或追求更高质量的叙事体验时，可以无缝切换到云端 API。

*   **推荐服务**:
    *   **OpenAI (GPT-4o, GPT-3.5-turbo)**: 行业标杆，综合能力强，JSON 模式支持良好。
    *   **Anthropic (Claude 3 Sonnet, Claude 3 Haiku)**: 强大的文本生成和推理能力，Haiku 模型在成本和速度上极具竞争力。
    *   **Google (Gemini 1.5 Pro)**: 拥有巨大的上下文窗口和多模态能力，未来可能用于更复杂的场景。
*   **优势**:
    *   **顶级性能**: 能生成最复杂、最连贯、最富创造力的内容。
    *   **无需维护**: 无需管理本地硬件和模型。
*   **劣势**:
    *   **成本**: API 调用会产生费用，需要仔细管理。
    *   **延迟**: 网络请求会增加响应时间。

### 4.3. 实现策略

`LLM 适配器` 将通过一个统一的配置文件来管理不同的提供方。

**`config/ai.ts` (示例)**
```typescript
export const aiConfig = {
  // 'ollama' | 'openai' | 'anthropic'
  provider: process.env.LLM_PROVIDER || 'ollama', 

  models: {
    // 用于快速、简单的任务，如战斗描述
    fast: process.env.LLM_FAST_MODEL || 'phi-3-mini', 
    // 用于核心任务，如 NPC 决策、事件生成
    smart: process.env.LLM_SMART_MODEL || 'llama-3-8b', 
  },

  providers: {
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    }
    // ...其他提供方的配置
  }
};
```

通过这种方式，`AI 核心服务` 只需请求 `fast` 或 `smart` 类型的模型，而 `LLM 适配器` 会根据配置自动将请求路由到正确的模型和提供方。


---

## 5. 风险与挑战

集成 LLM 会引入一系列新的技术和设计挑战，必须提前识别并制定应对策略。

| 风险类别 | 具体挑战 | 应对策略 |
| :--- | :--- | :--- |
| **性能** | **延迟 (Latency)**: 每次调用 LLM 都需要时间，尤其是在使用云端 API 时。频繁的调用可能导致游戏卡顿，影响玩家体验。 | - **异步调用**: 所有 LLM 请求都必须是异步的，不阻塞主游戏循环。<br>- **使用快速模型**: 为非核心任务（如战斗描述）使用 `fast` 模型。<br>- **缓存**: 对相似情境的请求结果进行缓存。<br>- **预测性调用**: 在玩家可能进入某个场景前，提前开始生成内容。 |
| **成本** | **API 调用费用**: 如果使用商业 API，大量的 LLM 调用会迅速累积成本，尤其是在 NPC 数量众多或游戏节奏快的情况下。 | - **预算监控**: 集成 API 成本监控和警报系统。<br>- **调用频率限制**: 设定每个 NPC 或每个游戏刻（tick）的最大调用次数。<br>- **本地模型优先**: 在单机版或开发版中，默认使用本地 Ollama。<br>- **有选择的增强**: 只在最高价值的系统（如核心剧情、关键 NPC）上使用最强的 `smart` 模型。 |
| **内容质量** | **不可控性与一致性**: LLM 可能会生成与游戏世界观、角色性格不符的内容，或者产生有害、不当的文本。 | - **精细的 Prompt Engineering**: 在 Prompt 中强化角色扮演、风格和世界观规则。<br>- **输出校验与过滤**: `ResponseParser` 必须包含一个内容过滤器，检查关键词和不当言论。<br>- **结构化输出**: 强制使用 JSON 格式，并进行严格的 Schema 验证，限制 LLM 的“自由发挥”。<br>- **回退机制**: 当 LLM 返回无效或不合规内容时，系统必须能优雅地回退到预设的、静态的行为或文本。 |
| **游戏设计** | **“随机性”破坏核心体验**: 过度的、无意义的随机性可能会破坏游戏的核心循环和玩家的长期目标感。 | - **目标驱动的 AI**: LLM 生成的 NPC 行为不应是完全随机的，而应由其内在的“目标”和“性格”驱动。<br>- **玩家影响**: LLM 生成的事件和行为必须能被玩家的行为所影响，并反过来影响玩家，形成有意义的互动循环。<br>- **核心剧情保护**: 游戏的主线剧情和关键节点应由静态逻辑主导，LLM 作为丰富支线和日常动态的工具。 |
| **技术实现** | **状态同步**: 在异步调用的情况下，当 LLM 正在“思考”时，游戏状态可能已经发生了变化，导致其决策基于过时的信息。 | - **时间戳/版本号**: 在向 LLM 发送请求时附带一个状态版本号。如果收到响应时游戏状态版本已更新，则可以考虑废弃该响应或重新请求。<br>- **简化上下文**: 只向 LLM 提供做出当前决策所必需的、短期内相对稳定的信息。 |
