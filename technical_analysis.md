# Wuxia World Simulator - 技术分析报告

## 1. 系统架构图 (System Architecture)

下图展示了项目的主要模块及其依赖关系。箭头表示“依赖于”。

```mermaid
graph TD
    subgraph "Application Layer"
        direction LR
        MainLoop["主循环 (mainLoop.ts)"]
        CLI["UI/CLI (cli.ts)"]
    end

    subgraph "Narrative Layer (叙事层)"
        direction TB
        SceneManager["场景管理器 (SceneManager)"]
        AIBard["AI说书人 (AIBard)"]
        PromptManager["提示词管理器 (PromptManager)"]
        
        SceneManager --> AIBard
        AIBard --> PromptManager
        AIBard --> AICoreService
    end

    subgraph "Game Systems Layer (游戏系统层)"
        direction TB
        TimeSystem["时间系统 (TimeSystem)"]
        BattleSystem["战斗系统 (BattleSystem)"]
        FactionSystem["门派系统 (sect.ts)"]
        CultivationSystem["修炼系统 (cultivation.ts)"]
    end

    subgraph "Core Services Layer (核心服务层)"
        direction TB
        EventEngine["事件引擎 (EventEngine)"]
        GameStore["状态存储 (GameStore)"]
        TriggerRegistry["触发器注册表 (TriggerRegistry)"]
        ModLoader["Mod加载器 (ModLoader)"]
        AICoreService["AI核心服务 (AICoreService)"]
    end
    
    subgraph "Data & Infrastructure Layer (数据与设施层)"
        direction TB
        Prisma["Prisma ORM"]
        SQLite["SQLite 数据库"]
        LLM["Ollama LLM"]
        FileSystem["文件系统 (mods, templates)"]
    end

    %% Dependencies
    MainLoop --> SceneManager
    MainLoop --> EventEngine
    MainLoop --> GameStore
    MainLoop --> TimeSystem
    CLI --> MainLoop

    SceneManager --> GameStore
    SceneManager --> TimeSystem
    
    EventEngine --> GameStore
    EventEngine --> TriggerRegistry
    EventEngine --> ModLoader
    EventEngine --> AICoreService
    
    GameStore --> AIBard
    GameStore --> TimeSystem

    FactionSystem --> Prisma
    FactionSystem --> TimeSystem
    
    ModLoader --> FileSystem
    PromptManager --> FileSystem
    AICoreService --> LLM
    Prisma --> SQLite
```

**架构解读:**

*   **分层清晰**: 项目大致分为应用层、叙事层、游戏系统层、核心服务层和数据设施层，职责分明。
*   **依赖倒置**: 上层模块（如 `SceneManager`）依赖于下层模块的抽象（通过 DI 注入），而不是具体实现，符合依赖倒置原则。
*   **核心驱动**: `GameStore` (状态) 和 `EventEngine` (事件) 是整个架构的核心，几乎所有上层模块都直接或间接地与它们交互。
*   **AI 作为服务**: AI 功能被封装在 `AICoreService` 和 `AIBard` 中，作为一种可被调用的服务，而不是散落在各处。

## 2. 核心数据流图 (Core Data Flow) - 叙事场景生成

下图展示了当需要生成一个新叙事场景时，系统内部的数据流转过程。

```mermaid
sequenceDiagram
    participant MainLoop as 主循环
    participant SceneManager as 场景管理器
    participant AIBard as AI说书人
    participant GameStore as 状态存储
    participant EventEngine as 事件引擎
    participant LLM as 大语言模型

    MainLoop->>SceneManager: narrateNextScene(摘要, 游戏状态)
    activate SceneManager

    SceneManager->>SceneManager: triggerStoryEngine(游戏状态)
    note right of SceneManager: 第一层AI：决定是否动态生成事件/NPC

    SceneManager->>GameStore: dispatch(UPDATE_SCENE_NPCS)
    activate GameStore
    GameStore-->>SceneManager: 
    deactivate GameStore

    SceneManager->>AIBard: generateNarration(BardPrompt)
    activate AIBard

    AIBard->>LLM: generate(完整Prompt)
    activate LLM
    LLM-->>AIBard: 返回包含叙事和选项的JSON字符串
    deactivate LLM
    
    AIBard-->>SceneManager: 返回结构化的BardOutput
    deactivate AIBard

    SceneManager->>SceneManager: 动态注入NPC交互选项
    
    SceneManager-->>MainLoop: 返回最终的BardOutput
    deactivate SceneManager

    MainLoop->>CLI: render(BardOutput)
```

**数据流解读:**

1.  流程由**主循环**发起，请求**场景管理器**生成新场景。
2.  **场景管理器**首先进行一次“预处理”，通过 `triggerStoryEngine` 询问 AI 是否要即兴发挥，可能会改变当前的游戏状态（如添加 NPC）。
3.  然后，**场景管理器**收集所有上下文信息，请求 **AI说书人** 生成核心叙事。
4.  **AI说书人** 将请求翻译成 LLM 能理解的 Prompt，并从 **LLM** 获取结果。
5.  **场景管理器**在 AI 返回的结果基础上，可能会根据程序逻辑（如场景中有商人）再次加工，添加更多交互选项。
6.  最终结果返回给**主循环**，由 UI 呈现给玩家。

这个流程清晰地展示了程序逻辑与 AI 生成内容是如何协同工作的。